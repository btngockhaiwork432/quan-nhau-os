# -*- coding: utf-8 -*-
"""
server.py - FastAPI + PostgreSQL 16 Backend Server cho Quan Nhau OS.
Cung cap:
- REST API day du (/api/*) va tai lieu OpenAPI tai /api/docs
- Dong bo thoi gian thuc da thiet bi qua Server-Sent Events (/api/events)
- Luu tru quan he ACID tren 32 bang PostgreSQL 16
- Phuc vu truc tiep giao dien Web (C:/quan_nhau/web) tren cung cong 8765
"""

import asyncio
import json
import os
import time
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any, Dict, List, Optional, Set

from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

import db

BACKEND_DIR = Path(__file__).resolve().parent
WEB_DIR = BACKEND_DIR.parent / "web"

# Danh sach hang doi SSE cho cac thiet bi dang ket noi
_sse_Subscribers: Set[asyncio.Queue] = set()
_main_loop: Optional[asyncio.AbstractEventLoop] = None


def broadcast_event(event_type: str, payload: Dict[str, Any]) -> None:
    msg = json.dumps({"type": event_type, **payload}, ensure_ascii=False)
    if _main_loop and _main_loop.is_running():
        for q in list(_sse_Subscribers):
            _main_loop.call_soon_threadsafe(_safe_put, q, msg)


def _safe_put(q: asyncio.Queue, msg: str) -> None:
    try:
        if q.qsize() < 50:
            q.put_nowait(msg)
    except Exception:
        pass


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _main_loop
    _main_loop = asyncio.get_running_loop()
    info = db.init_schema()
    print(f"[PostgreSQL] Da ket noi: {info['database']} ({info['mode']})")
    print(f"[PostgreSQL] URI: {info['uri']}")
    yield


app = FastAPI(
    title="Quán Nhậu OS — PostgreSQL Backend API",
    description="Hệ thống Backend + Cơ sở dữ liệu PostgreSQL 16 cho 6 giao diện vận hành Quán Nhậu OS",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class StateCommitPayload(BaseModel):
    state: Dict[str, Any]
    who: Optional[str] = "system"
    auditText: Optional[str] = None
    clientId: Optional[str] = None


class SeedPayload(BaseModel):
    state: Dict[str, Any]
    force: Optional[bool] = False
    who: Optional[str] = "system"
    clientId: Optional[str] = None


class SqlQueryPayload(BaseModel):
    query: str


# ======================= HEALTH & DB INTROSPECTION =======================

@app.get("/api/health")
def api_health():
    try:
        overview = db.get_db_overview()
        return {"ok": True, **overview}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/db/overview")
def api_db_overview():
    try:
        return db.get_db_overview()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/db/query")
def api_db_query(payload: SqlQueryPayload):
    try:
        rows = db.execute_readonly_sql(payload.query)
        return {"ok": True, "count": len(rows), "rows": rows}
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Lỗi truy vấn PostgreSQL: {e}")


# ======================= STATE SYNC & REAL-TIME SSE =======================

@app.get("/api/state")
def api_get_state():
    st = db.load_state_from_postgres()
    if not st:
        return {"seeded": False, "state": None, "revision": 0}
    return {
        "seeded": True,
        "revision": st["revision"],
        "state": st,
    }


@app.post("/api/state/seed")
def api_seed_state(payload: SeedPayload):
    if db.is_seeded() and not payload.force:
        st = db.load_state_from_postgres()
        return {"ok": True, "seeded": False, "revision": st["revision"] if st else 0, "state": st}

    rev = db.persist_state_to_postgres(
        payload.state,
        who=payload.who or "system",
        audit_text="Khởi tạo / Khôi phục dữ liệu mẫu trên PostgreSQL" if payload.force else "Khởi tạo dữ liệu gốc trên PostgreSQL",
    )
    broadcast_event(
        "state_updated",
        {
            "revision": rev,
            "who": payload.who or "system",
            "clientId": payload.clientId,
            "reset": bool(payload.force),
            "at": int(time.time() * 1000),
        },
    )
    return {"ok": True, "seeded": True, "revision": rev}


@app.put("/api/state")
def api_put_state(payload: StateCommitPayload):
    rev = db.persist_state_to_postgres(
        payload.state,
        who=payload.who or "system",
        audit_text=payload.auditText,
    )
    broadcast_event(
        "state_updated",
        {
            "revision": rev,
            "who": payload.who or "system",
            "auditText": payload.auditText,
            "clientId": payload.clientId,
            "at": int(time.time() * 1000),
        },
    )
    return {"ok": True, "revision": rev}


@app.get("/api/events")
async def api_sse_events(request: Request):
    queue: asyncio.Queue = asyncio.Queue()
    _sse_Subscribers.add(queue)

    async def event_generator():
        try:
            init_msg = json.dumps(
                {"type": "connected", "revision": db.get_revision(), "at": int(time.time() * 1000)},
                ensure_ascii=False,
            )
            yield f"data: {init_msg}\n\n"
            while True:
                if await request.is_disconnected():
                    break
                try:
                    data = await asyncio.wait_for(queue.get(), timeout=15.0)
                    yield f"data: {data}\n\n"
                except asyncio.TimeoutError:
                    yield ": keepalive\n\n"
        finally:
            _sse_Subscribers.discard(queue)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


# ======================= DOMAIN RELATIONAL ENDPOINTS =======================

@app.get("/api/tables")
def api_list_tables():
    rows = db.execute_readonly_sql(
        """
        SELECT t.id, t.code, t.area_id, a.name AS area_name, t.seats, t.table_type,
               t.pos_x, t.pos_y, t.clean_status, t.dirty_since,
               tk.id AS active_ticket_id, tk.status AS ticket_status, tk.guests AS ticket_guests, tk.opened_at
        FROM restaurant_tables t
        JOIN areas a ON a.id = t.area_id
        LEFT JOIN tickets tk ON tk.table_id = t.id AND tk.status <> 'paid'
        ORDER BY a.sort_order ASC, t.code ASC
        """
    )
    return {"ok": True, "tables": rows}


@app.get("/api/menu")
def api_list_menu(category_id: Optional[str] = None, active_only: bool = False):
    conds = []
    params: List[Any] = []
    if category_id:
        conds.append("m.category_id = %s")
        params.append(category_id)
    if active_only:
        conds.append("m.active = TRUE")
    where_sql = ("WHERE " + " AND ".join(conds)) if conds else ""
    items = db.execute_readonly_sql(
        f"""
        SELECT m.*, c.name AS category_name, c.vat_group,
               st.piece_count AS tank_count, st.weight_kg AS tank_kg
        FROM menu_items m
        JOIN categories c ON c.id = m.category_id
        LEFT JOIN seafood_tank st ON st.menu_id = m.id
        {where_sql}
        ORDER BY c.sort_order ASC, m.name ASC
        """,
        tuple(params) if params else None,
    )
    categories = db.execute_readonly_sql("SELECT * FROM categories ORDER BY sort_order ASC")
    styles = db.execute_readonly_sql("SELECT * FROM cooking_styles ORDER BY id ASC")
    return {"ok": True, "categories": categories, "styles": styles, "items": items}


@app.get("/api/tickets")
def api_list_tickets():
    tickets = db.execute_readonly_sql(
        """
        SELECT tk.*, tb.code AS table_code, s.name AS waiter_name
        FROM tickets tk
        LEFT JOIN restaurant_tables tb ON tb.id = tk.table_id
        LEFT JOIN staff s ON s.id = tk.waiter_id
        ORDER BY tk.opened_at ASC
        """
    )
    items = db.execute_readonly_sql("SELECT * FROM ticket_items ORDER BY ticket_id ASC, sort_idx ASC")
    by_tk: Dict[str, List[Dict[str, Any]]] = {}
    for it in items:
        by_tk.setdefault(it["ticket_id"], []).append(it)
    for tk in tickets:
        tk["items"] = by_tk.get(tk["id"], [])
    return {"ok": True, "tickets": tickets}


@app.get("/api/sales")
def api_list_sales(day_key: Optional[str] = None, limit: int = Query(100, ge=1, le=1000)):
    if day_key:
        rows = db.execute_readonly_sql(
            "SELECT * FROM sales WHERE day_key = %s ORDER BY closed_at DESC LIMIT %s",
            (day_key, limit),
        )
    else:
        rows = db.execute_readonly_sql(
            "SELECT * FROM sales ORDER BY closed_at DESC LIMIT %s",
            (limit,),
        )
    return {"ok": True, "sales": rows}


@app.get("/api/inventory")
def api_get_inventory():
    tank = db.execute_readonly_sql(
        """
        SELECT st.menu_id, m.name, st.piece_count, st.weight_kg, m.cost_per_kg, m.price_per_kg, st.updated_at
        FROM seafood_tank st
        JOIN menu_items m ON m.id = st.menu_id
        ORDER BY m.name ASC
        """
    )
    bags = db.execute_readonly_sql("SELECT * FROM portion_bags ORDER BY id ASC")
    drinks = db.execute_readonly_sql(
        "SELECT id, name, kind, unit, cost, price, drink_stock FROM menu_items WHERE drink_stock IS NOT NULL ORDER BY name ASC"
    )
    counts = db.execute_readonly_sql("SELECT * FROM stock_counts ORDER BY counted_at DESC LIMIT 30")
    wastage = db.execute_readonly_sql("SELECT * FROM wastage_reports ORDER BY reported_at DESC LIMIT 50")
    receipts = db.execute_readonly_sql("SELECT * FROM goods_receipts ORDER BY received_at DESC LIMIT 50")
    return {
        "ok": True,
        "tank": tank,
        "bags": bags,
        "drinks": drinks,
        "counts": counts,
        "wastage": wastage,
        "receipts": receipts,
    }


@app.get("/api/staff")
def api_list_staff(day_key: Optional[str] = None):
    staff = db.execute_readonly_sql("SELECT * FROM staff ORDER BY id ASC")
    if day_key:
        att = db.execute_readonly_sql(
            "SELECT * FROM attendance WHERE day_key = %s ORDER BY check_in ASC",
            (day_key,),
        )
    else:
        att = db.execute_readonly_sql("SELECT * FROM attendance ORDER BY check_in DESC LIMIT 200")
    return {"ok": True, "staff": staff, "attendance": att}


@app.get("/api/bookings")
def api_list_bookings(day_key: Optional[str] = None, phone: Optional[str] = None):
    conds = []
    params: List[Any] = []
    if day_key:
        conds.append("day_key = %s")
        params.append(day_key)
    if phone:
        conds.append("phone = %s")
        params.append(phone.strip())
    where_sql = ("WHERE " + " AND ".join(conds)) if conds else ""
    rows = db.execute_readonly_sql(
        f"SELECT * FROM bookings {where_sql} ORDER BY created_at DESC",
        tuple(params) if params else None,
    )
    return {"ok": True, "bookings": rows}


@app.get("/api/bottle-keeps")
def api_list_bottles(phone: Optional[str] = None):
    if phone:
        rows = db.execute_readonly_sql(
            "SELECT * FROM bottle_keeps WHERE phone = %s ORDER BY created_at DESC",
            (phone.strip(),),
        )
    else:
        rows = db.execute_readonly_sql("SELECT * FROM bottle_keeps ORDER BY created_at DESC")
    return {"ok": True, "bottleKeeps": rows}


@app.get("/api/approvals")
def api_list_approvals(status: Optional[str] = None):
    if status:
        rows = db.execute_readonly_sql(
            "SELECT * FROM approvals WHERE status = %s ORDER BY created_at DESC",
            (status,),
        )
    else:
        rows = db.execute_readonly_sql("SELECT * FROM approvals ORDER BY created_at DESC")
    return {"ok": True, "approvals": rows}


@app.get("/api/reports/daily")
def api_daily_reports(from_key: Optional[str] = None, to_key: Optional[str] = None):
    conds = []
    params: List[Any] = []
    if from_key:
        conds.append("day_key >= %s")
        params.append(from_key)
    if to_key:
        conds.append("day_key <= %s")
        params.append(to_key)
    where_sql = ("WHERE " + " AND ".join(conds)) if conds else ""
    rows = db.execute_readonly_sql(
        f"SELECT * FROM daily_stats {where_sql} ORDER BY day_key ASC",
        tuple(params) if params else None,
    )
    return {"ok": True, "days": rows}


@app.get("/api/config")
def api_get_config():
    rows = db.execute_readonly_sql("SELECT revision, version, updated_at, updated_by, config_json, pending_config FROM system_config WHERE id = 1")
    history = db.execute_readonly_sql("SELECT id, changed_at, changed_by, effective, apply_at, applied_at, note, changes_json FROM config_history ORDER BY changed_at DESC LIMIT 50")
    return {"ok": True, "config": rows[0] if rows else None, "history": history}


# ======================= PAYMENT GATEWAY WEBHOOK API =======================

class PaymentWebhookPayload(BaseModel):
    amount: Optional[int] = None
    transferAmount: Optional[int] = None
    content: Optional[str] = None
    description: Optional[str] = None
    memo: Optional[str] = None
    transactionId: Optional[str] = None
    referenceCode: Optional[str] = None
    gateway: Optional[str] = "SePay / Casso / VietQR"
    ticketId: Optional[str] = None
    tipMode: Optional[str] = None
    tipStaffId: Optional[str] = None
    by: Optional[str] = None


def _norm_code(s: str) -> str:
    return "".join(ch for ch in (s or "").upper() if ch.isalnum())


@app.get("/api/webhooks/payment")
def api_list_payment_webhooks(limit: int = Query(50, ge=1, le=200)):
    st = db.load_state_from_postgres()
    logs = (st.get("data", {}).get("webhookLogs") if st else None) or []
    return {
        "ok": True,
        "endpoint": "/api/webhooks/payment",
        "count": len(logs[:limit]),
        "webhooks": logs[:limit],
    }


@app.post("/api/webhooks/payment")
def api_receive_payment_webhook(payload: PaymentWebhookPayload, request: Request):
    """
    Endpoint nhan Webhook bien dong so du tu cong thanh toan (SePay, Casso, PayOS, VietQR).
    Dinh danh hoa don qua ma noi dung chuyen khoan (payCode, VD: 'QN A02 1234').
    Chi can so tien chuyen >= so tien can thanh toan:
    - Tu dong chot thanh toan bill & dong bo tuc thi len man hinh Phuc vu + Thu ngan.
    - Phan tien du (over = amount - need > 0) tu dong ghi nhan la Tien Tip va chia theo quy che (personal / pool / area).
    """
    amount = int(payload.amount if payload.amount is not None else (payload.transferAmount or 0))
    content = (payload.content or payload.description or payload.memo or "").strip()
    tx_id = (payload.transactionId or payload.referenceCode or f"tx_{int(time.time() * 1000)}").strip()
    gateway = (payload.gateway or "SePay / Casso / VietQR").strip()

    if amount <= 0:
        raise HTTPException(status_code=400, detail="Số tiền giao dịch phải lớn hơn 0.")
    if not content and not payload.ticketId:
        raise HTTPException(status_code=400, detail="Thiếu nội dung chuyển khoản (content) để định danh bàn.")

    st = db.load_state_from_postgres()
    if not st:
        raise HTTPException(status_code=400, detail="Cơ sở dữ liệu chưa được khởi tạo.")

    cfg = st.get("config") or {}
    expected_secret = (os.environ.get("WEBHOOK_SECRET") or (cfg.get("paymentGateway") or {}).get("webhookSecret") or "").strip()
    if expected_secret:
        auth_hdr = (request.headers.get("authorization") or "").strip()
        sec_hdr = (request.headers.get("x-webhook-secret") or request.headers.get("secure-token") or "").strip()
        token = sec_hdr
        if not token and auth_hdr:
            parts = auth_hdr.split(" ", 1)
            token = parts[1].strip() if len(parts) > 1 else auth_hdr
        if token != expected_secret:
            raise HTTPException(status_code=401, detail="Xác thực Webhook Secret không hợp lệ.")
    data = st.get("data") or {}
    now_ms = int(time.time() * 1000)
    webhook_logs = data.setdefault("webhookLogs", [])

    # Kiem tra giao dich trung lap
    for existing in webhook_logs:
        if existing.get("txId") == tx_id and existing.get("status") in ("matched_paid", "partial_paid"):
            return {"ok": True, "duplicate": True, "webhook": existing}

    tickets = data.get("tickets") or []
    tables_list = cfg.get("tables") or (cfg.get("floor") or {}).get("tables") or []
    tables_by_id = {t["id"]: t for t in tables_list if isinstance(t, dict) and "id" in t}
    norm_content = _norm_code(content)
    prefix = _norm_code((cfg.get("paymentGateway") or {}).get("prefix") or "QN")

    matched_tk = None
    if payload.ticketId:
        matched_tk = next((t for t in tickets if t.get("id") == payload.ticketId and t.get("status") != "paid"), None)
    if not matched_tk and norm_content:
        for t in tickets:
            if t.get("status") == "paid":
                continue
            pcode = _norm_code(t.get("payCode") or "")
            if pcode and pcode in norm_content:
                matched_tk = t
                break
            for mcode in t.get("mergedPayCodes") or []:
                mc = _norm_code(mcode)
                if mc and mc in norm_content:
                    matched_tk = t
                    break
            if matched_tk:
                break
    if not matched_tk and norm_content:
        for t in tickets:
            if t.get("status") == "paid":
                continue
            tb = tables_by_id.get(t.get("tableId"), {})
            tcode = _norm_code(prefix + (tb.get("code") or ""))
            open_on_table = [x for x in tickets if x.get("tableId") == t.get("tableId") and x.get("status") != "paid"]
            if tcode and tcode in norm_content and len(open_on_table) == 1:
                matched_tk = t
                break

    if not matched_tk:
        # Kiem tra ngoai le: Ma chuyen khoan khop voi 1 bill DA DONG (khach chuyen trung 2 lan hoac chuyen sau khi da thu tien mat)
        closed_sale = None
        if norm_content:
            for s in reversed(data.get("sales") or []):
                scode = _norm_code(s.get("payCode") or "")
                if scode and scode in norm_content:
                    closed_sale = s
                    break
                for mcode in s.get("mergedPayCodes") or []:
                    mc = _norm_code(mcode)
                    if mc and mc in norm_content:
                        closed_sale = s
                        break
                if closed_sale:
                    break
        if closed_sale:
            warn_msg = (
                f"CẢNH BÁO: Bàn {closed_sale.get('tableCode') or ''} ({closed_sale.get('payCode') or content}) "
                f"đã thanh toán trước đó nhưng vừa nhận thêm chuyển khoản {amount:,} đ — Cần kiểm tra hoàn tiền hoặc ghi nhận Tip!"
            )
            log_entry = {
                "id": f"wh_{now_ms}",
                "txId": tx_id,
                "at": now_ms,
                "gateway": gateway,
                "amount": amount,
                "content": content,
                "saleId": closed_sale.get("id"),
                "tableId": closed_sale.get("tableId"),
                "tableCode": closed_sale.get("tableCode") or "",
                "payCode": closed_sale.get("payCode") or "",
                "waiterId": closed_sale.get("waiterId"),
                "status": "overpaid_closed_bill",
                "reason": warn_msg,
            }
            webhook_logs.insert(0, log_entry)
            data.setdefault("notifications", []).insert(
                0,
                {
                    "id": f"nt_{now_ms}",
                    "type": "payment_overpaid_closed",
                    "at": now_ms,
                    "read": False,
                    "saleId": closed_sale.get("id"),
                    "waiterId": closed_sale.get("waiterId"),
                    "text": warn_msg,
                },
            )
            db.persist_state_to_postgres(st, who="webhook", audit_text=warn_msg)
            raise HTTPException(status_code=409, detail=warn_msg)

        log_entry = {
            "id": f"wh_{now_ms}",
            "txId": tx_id,
            "at": now_ms,
            "gateway": gateway,
            "amount": amount,
            "content": content,
            "status": "unmatched",
            "reason": "Không tìm thấy bill đang mở khớp mã nội dung chuyển khoản",
        }
        webhook_logs.insert(0, log_entry)
        db.persist_state_to_postgres(st, who="webhook", audit_text=f"Webhook QR không khớp bàn: {content} ({amount:,} đ)")
        raise HTTPException(status_code=404, detail=f"Không tìm thấy bill đang mở khớp nội dung: {content}")

    # Tinh tong tien bill
    menu_by_id = {m["id"]: m for m in (cfg.get("menu") or [])}
    cats_by_id = {c["id"]: c for c in (cfg.get("categories") or [])}
    styles_by_id = {s["id"]: s for s in (cfg.get("styles") or [])}
    subtotal = 0
    cost_total = 0
    lines = []
    vat_map: Dict[str, Dict[str, int]] = {"food": {"gross": 0, "vat": 0}, "alcohol": {"gross": 0, "vat": 0}}
    for it in matched_tk.get("items") or []:
        if it.get("status") == "void":
            continue
        if it.get("status") == "pending_weigh":
            raise HTTPException(status_code=400, detail="Bàn còn hải sản chưa cân, chưa thể chốt tự động.")
        m = menu_by_id.get(it.get("menuId"), {})
        st_obj = styles_by_id.get(it.get("styleId") or "", {})
        sur = int(st_obj.get("surcharge") or 0)
        if it.get("isFree"):
            amt = 0
        elif m.get("kind") == "seafood":
            deal_amt = it.get("dealAmount")
            bg_obj = it.get("bargain") or {}
            if deal_amt and int(deal_amt) > 0 and bg_obj.get("status") != "rejected":
                amt = int(round(float(deal_amt))) + sur
            else:
                ppk = int(it.get("pricePerKg") if it.get("pricePerKg") is not None else (m.get("pricePerKg") or 0))
                amt = int(round(float(it.get("kg") or 0) * ppk / 1000.0)) * 1000 + sur
        else:
            amt = int(it.get("qty") or 0) * (int(it.get("price") or m.get("price") or 0) + sur)
        if m.get("kind") == "seafood":
            cst = int(round(float(it.get("kg") or 0) * int(m.get("costPerKg") or 0)))
        else:
            cst = int(it.get("qty") or 0) * int(m.get("cost") or 0)
        subtotal += amt
        cost_total += cst
        cat = cats_by_id.get(m.get("categoryId"), {})
        vg = cat.get("vatGroup") or "food"
        rate = float((cfg.get("tax") or {}).get(vg, (cfg.get("tax", {}).get("vatRates") or {}).get(vg, 8)))
        v_amt = int(round(amt - amt / (1 + rate / 100.0))) if cfg.get("tax", {}).get("pricesIncludeVat", True) else int(round(amt * rate / 100.0))
        vat_map.setdefault(vg, {"gross": 0, "vat": 0})
        vat_map[vg]["gross"] += amt
        vat_map[vg]["vat"] += v_amt
        lines.append(
            {
                "menuId": it.get("menuId"),
                "name": it.get("name"),
                "qty": it.get("qty") or 1,
                "kg": it.get("kg") or 0,
                "count": it.get("count") or 0,
                "amount": amt,
                "cost": cst,
                "vatGroup": vg,
                "isFree": bool(it.get("isFree", False)),
                "promoId": it.get("promoId"),
                "addedBy": it.get("addedBy"),
                "styleId": it.get("styleId"),
                "status": it.get("status"),
                "categoryId": m.get("categoryId"),
                "sentAt": it.get("sentAt"),
            }
        )

    tb_info = tables_by_id.get(matched_tk.get("tableId"), {})
    vip_fee = 0
    if tb_info.get("type") == "vip":
        vip_cfg = cfg.get("vip") or {}
        free_mins = int(vip_cfg.get("freeMinutes") or 0)
        mins = max(0, int((now_ms - int(matched_tk.get("openedAt") or now_ms)) // 60000) - free_mins)
        import math
        hrs = int(math.ceil(mins / 60.0))
        hourly_rate = int(vip_cfg.get("hourlyRate") or (cfg.get("floor") or {}).get("vipHourlyFee") or 0)
        vip_fee = hrs * hourly_rate
        min_spend = int(vip_cfg.get("minimumSpend") or (cfg.get("floor") or {}).get("vipFreeThreshold") or 0)
        if vip_cfg.get("minimumSpendEnabled", True) and subtotal >= min_spend:
            vip_fee = 0

    disc_obj = matched_tk.get("discount")
    discount = 0
    if disc_obj:
        if disc_obj.get("type") == "pct":
            discount = int(round(subtotal * float(disc_obj.get("value") or 0) / 100.0 / 1000.0)) * 1000
        else:
            discount = int(disc_obj.get("value") or 0)
        discount = min(subtotal, max(0, discount))

    vat_total = sum(v["vat"] for v in vat_map.values())
    grand = max(0, subtotal + vip_fee - discount + (0 if cfg.get("tax", {}).get("pricesIncludeVat", True) else vat_total))
    deposit = int(matched_tk.get("deposit") or 0)
    need = max(0, grand - deposit)
    prior_pays = [p for p in (matched_tk.get("payments") or []) if int(p.get("amount") or 0) > 0]
    prior_paid = sum(int(p.get("amount") or 0) for p in prior_pays)
    due_now = max(0, need - prior_paid)

    if amount < due_now:
        # Ngoai le: Khach chuyen khoan 1 phan -> ghi nhan vao matched_tk['payments'] va cap nhat so tien con thieu
        new_pay = {
            "id": f"pm_{now_ms}",
            "method": "qr",
            "amount": amount,
            "received": amount,
            "txId": tx_id,
            "content": content,
            "gateway": gateway,
            "at": now_ms,
        }
        matched_tk.setdefault("payments", []).append(new_pay)
        paid_so_far = prior_paid + amount
        remaining_due = max(0, need - paid_so_far)
        tbl_code = tb_info.get("code") or ""
        log_entry = {
            "id": f"wh_{now_ms}",
            "txId": tx_id,
            "at": now_ms,
            "gateway": gateway,
            "amount": amount,
            "content": content,
            "ticketId": matched_tk.get("id"),
            "tableId": matched_tk.get("tableId"),
            "tableCode": tbl_code,
            "payCode": matched_tk.get("payCode") or "",
            "need": need,
            "paidSoFar": paid_so_far,
            "remaining": remaining_due,
            "waiterId": matched_tk.get("waiterId"),
            "status": "partial_paid",
            "reason": f"Đã thu 1 phần {paid_so_far:,} đ · Còn thiếu {remaining_due:,} đ",
        }
        webhook_logs.insert(0, log_entry)
        data.setdefault("notifications", []).insert(
            0,
            {
                "id": f"nt_{now_ms}",
                "type": "payment_partial",
                "at": now_ms,
                "read": False,
                "ticketId": matched_tk.get("id"),
                "waiterId": matched_tk.get("waiterId"),
                "text": f"Bàn {tbl_code} vừa chuyển khoản 1 phần {amount:,} đ (Đã thu: {paid_so_far:,} đ · Còn thiếu: {remaining_due:,} đ)",
            },
        )
        rev = db.persist_state_to_postgres(
            st,
            who="webhook",
            audit_text=f"Webhook QR thu 1 phần bàn {tbl_code}: +{amount:,} đ (Đã thu {paid_so_far:,}/{need:,} đ)",
        )
        broadcast_event(
            "payment_webhook",
            {
                "revision": rev,
                "webhook": log_entry,
                "partial": True,
                "ticketId": matched_tk.get("id"),
                "tableCode": tbl_code,
                "amount": amount,
                "paidSoFar": paid_so_far,
                "remaining": remaining_due,
                "need": need,
                "at": now_ms,
            },
        )
        return {
            "ok": True,
            "partial": True,
            "revision": rev,
            "ticketId": matched_tk.get("id"),
            "tableCode": tbl_code,
            "webhook": log_entry,
            "need": need,
            "received": amount,
            "paidSoFar": paid_so_far,
            "remaining": remaining_due,
        }

    total_received = prior_paid + amount
    over_as_tip = (cfg.get("paymentGateway") or {}).get("overpayAsTip", True)
    tip = max(0, total_received - need) if over_as_tip else 0
    tip_mode = payload.tipMode or matched_tk.get("preferredTipMode") or (cfg.get("payroll") or {}).get("tipPolicy") or "personal"
    primary_staff = payload.tipStaffId or matched_tk.get("waiterId") or "s_lan"

    # Tinh tipShares
    staff_list = data.get("staff") or []
    att_list = data.get("attendance") or []
    day_key = time.strftime("%Y-%m-%d", time.localtime(now_ms / 1000.0))
    on_duty_ids = {a.get("staffId") for a in att_list if a.get("dayKey") == day_key and not a.get("out")}
    recipients: List[str] = []
    if tip > 0:
        if tip_mode == "pool":
            waiters = [s["id"] for s in staff_list if s.get("role") == "waiter" and s.get("active", True) and s["id"] in on_duty_ids]
            if not waiters:
                waiters = [s["id"] for s in staff_list if s.get("role") == "waiter" and s.get("active", True)]
            recipients = waiters or [primary_staff]
        elif tip_mode == "area":
            tbl_id = matched_tk.get("tableId")
            area_id = tb_info.get("areaId")
            area_waiters = [
                s["id"]
                for s in staff_list
                if s.get("role") == "waiter"
                and s.get("active", True)
                and (tbl_id in (s.get("assignedTables") or []) or area_id in (s.get("assignedAreas") or []))
            ]
            recipients = area_waiters or [primary_staff]
        else:
            recipients = [primary_staff]
    tip_shares = []
    if tip > 0 and recipients:
        per_head = tip // len(recipients)
        rem = tip - per_head * len(recipients)
        for idx, sid in enumerate(recipients):
            tip_shares.append({"staffId": sid, "amount": per_head + (rem if idx == 0 else 0)})

    sh = data.get("shift")
    sale_id = f"sale_{now_ms}"
    all_pays = list(prior_pays) + [{"method": "qr", "amount": amount, "received": amount, "txId": tx_id, "content": content, "gateway": gateway, "at": now_ms}]
    sale_obj = {
        "id": sale_id,
        "ticketId": matched_tk["id"],
        "tableId": matched_tk["tableId"],
        "tableCode": tb_info.get("code") or "",
        "payCode": matched_tk.get("payCode") or content,
        "mergedPayCodes": list(matched_tk.get("mergedPayCodes") or []),
        "openedAt": int(matched_tk.get("openedAt") or now_ms),
        "closedAt": now_ms,
        "dayKey": day_key,
        "shiftId": sh.get("id") if sh else None,
        "waiterId": matched_tk.get("waiterId"),
        "cashierId": payload.by or matched_tk.get("waiterId") or (sh.get("cashierId") if sh else "s_thu"),
        "paidByRole": "webhook_qr",
        "paymentSource": "webhook_qr",
        "webhookTxId": tx_id,
        "guests": int(matched_tk.get("guests") or 2),
        "lines": lines,
        "subtotal": subtotal,
        "vipFee": vip_fee,
        "discount": discount,
        "deposit": deposit,
        "grand": grand,
        "vat": vat_map,
        "vatTotal": vat_total,
        "cost": cost_total,
        "payments": all_pays,
        "received": total_received,
        "change": 0,
        "tip": tip,
        "tipMode": tip_mode if tip > 0 else None,
        "tipStaffId": primary_staff if tip > 0 else None,
        "tipShares": tip_shares,
        "einvoice": None,
        "unlockCount": int(matched_tk.get("unlockCount") or 0),
        "receipt": True,
    }
    data.setdefault("sales", []).append(sale_obj)
    data["tickets"] = [t for t in tickets if t.get("id") != matched_tk["id"]]
    data.setdefault("tableState", {})[matched_tk["tableId"]] = {"status": "dirty", "since": now_ms}
    data["lastBillClosedAt"] = max(int(data.get("lastBillClosedAt") or 0), now_ms)

    log_entry = {
        "id": f"wh_{now_ms}",
        "txId": tx_id,
        "at": now_ms,
        "gateway": gateway,
        "amount": amount,
        "content": content,
        "ticketId": matched_tk["id"],
        "saleId": sale_id,
        "tableId": matched_tk["tableId"],
        "tableCode": sale_obj["tableCode"],
        "payCode": sale_obj["payCode"],
        "need": need,
        "receivedTotal": total_received,
        "tip": tip,
        "tipMode": sale_obj["tipMode"],
        "tipShares": tip_shares,
        "waiterId": sale_obj["waiterId"],
        "status": "matched_paid",
    }
    webhook_logs.insert(0, log_entry)
    data.setdefault("notifications", []).insert(
        0,
        {
            "id": f"nt_{now_ms}",
            "type": "payment_success",
            "at": now_ms,
            "read": False,
            "ticketId": matched_tk["id"],
            "waiterId": sale_obj["waiterId"],
            "text": f"Bàn {sale_obj['tableCode']} thanh toán VietQR thành công {amount:,} đ" + (f" (Tip +{tip:,} đ)" if tip > 0 else ""),
        },
    )

    rev = db.persist_state_to_postgres(
        st,
        who=payload.by or sale_obj["waiterId"] or "webhook",
        audit_text=f"Webhook QR tự động chốt bàn {sale_obj['tableCode']} ({sale_obj['payCode']}): nhận {amount:,} đ / cần {need:,} đ" + (f", Tip +{tip:,} đ ({tip_mode})" if tip > 0 else ""),
    )
    broadcast_event(
        "payment_webhook",
        {
            "revision": rev,
            "webhook": log_entry,
            "saleId": sale_id,
            "tableCode": sale_obj["tableCode"],
            "amount": amount,
            "need": need,
            "tip": tip,
            "tipMode": sale_obj["tipMode"],
            "at": now_ms,
        },
    )
    return {
        "ok": True,
        "revision": rev,
        "sale": sale_obj,
        "webhook": log_entry,
        "need": need,
        "received": amount,
        "tip": tip,
        "tipShares": tip_shares,
    }


# Phuc vu cac duong dan SPA sach (khong can dau #): /login, /customer, /waiter, /pg, /kiosk, /cashier, /owner
_SPA_PORTALS = ("login", "customer", "waiter", "pg", "kiosk", "cashier", "owner")


def _serve_spa_index():
    return FileResponse(str(WEB_DIR / "index.html"))


for _p in _SPA_PORTALS:
    app.add_api_route(f"/{_p}", _serve_spa_index, methods=["GET"], include_in_schema=False)
    app.add_api_route(f"/{_p}/{{subpath:path}}", _serve_spa_index, methods=["GET"], include_in_schema=False)


# Phuc vu toan bo giao dien Web tinh (C:/quan_nhau/web)
if WEB_DIR.exists():
    app.mount("/", StaticFiles(directory=str(WEB_DIR), html=True), name="web")


if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("PORT", "8765"))
    uvicorn.run("server:app", host="0.0.0.0", port=port, reload=False)
