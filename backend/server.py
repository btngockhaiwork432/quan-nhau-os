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
import io
import json
import os
import re
import threading
import time
import urllib.request
import zipfile
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any, Dict, List, Optional, Set

from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, Response, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

import db

BACKEND_DIR = Path(__file__).resolve().parent
WEB_DIR = BACKEND_DIR.parent / "web"
UI_VERSION = "20261112h"

# Danh sach hang doi SSE cho cac thiet bi dang ket noi
_sse_Subscribers: Set[asyncio.Queue] = set()
_main_loop: Optional[asyncio.AbstractEventLoop] = None
_state_write_lock = threading.Lock()


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
    baseRevision: Optional[int] = None


class SeedPayload(BaseModel):
    state: Dict[str, Any]
    force: Optional[bool] = False
    who: Optional[str] = "system"
    clientId: Optional[str] = None


class SqlQueryPayload(BaseModel):
    query: str


class PrintAckPayload(BaseModel):
    ids: List[str] = []


def _extract_client_ip(request: Request) -> str:
    xff = (request.headers.get("x-forwarded-for") or "").strip()
    if xff:
        first = xff.split(",")[0].strip()
        if first:
            return first
    xri = (request.headers.get("x-real-ip") or "").strip()
    if xri:
        return xri
    if request.client and request.client.host:
        return str(request.client.host).strip()
    return ""


# ======================= HEALTH & DB INTROSPECTION =======================

@app.get("/api/client-info")
def api_client_info(request: Request):
    return {
        "ok": True,
        "ip": _extract_client_ip(request),
        "at": int(time.time() * 1000),
    }


@app.get("/api/print-queue")
def api_get_print_queue(max_age_sec: int = Query(default=900, ge=10, le=86400)):
    jobs = db.get_pending_print_jobs(max_age_ms=max_age_sec * 1000)
    return {
        "ok": True,
        "count": len(jobs),
        "jobs": jobs,
        "at": int(time.time() * 1000),
    }


@app.post("/api/print-queue/ack")
def api_ack_print_queue(payload: PrintAckPayload):
    acked = db.ack_print_jobs(payload.ids or [])
    return {
        "ok": True,
        "acked": acked,
        "at": int(time.time() * 1000),
    }


@app.get("/api/print-agent/download")
def api_download_print_agent():
    agent_dir = BACKEND_DIR.parent / "print_agent"
    if not agent_dir.exists():
        raise HTTPException(status_code=404, detail="Chưa tìm thấy thư mục print_agent trên máy chủ.")
    mem = io.BytesIO()
    with zipfile.ZipFile(mem, mode="w", compression=zipfile.ZIP_DEFLATED) as zf:
        for p in sorted(agent_dir.iterdir()):
            if p.is_file() and not p.name.startswith(".") and p.name != "printer_cache.json" and not p.name.endswith(".pyc"):
                zf.write(str(p), arcname=f"QuanNhau_MayIn_LAN/{p.name}")
    return Response(
        content=mem.getvalue(),
        media_type="application/zip",
        headers={"Content-Disposition": 'attachment; filename="QuanNhau_MayIn_LAN.zip"'},
    )

@app.get("/api/health")
def api_health():
    try:
        overview = db.get_db_overview()
        return {"ok": True, "uiVersion": UI_VERSION, **overview}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/db/overview")
def api_db_overview():
    try:
        ov = db.get_db_overview()
        ov["uiVersion"] = UI_VERSION
        return ov
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/db/query")
def api_db_query(payload: SqlQueryPayload, request: Request):
    staff_id = request.headers.get("x-staff-id", "")
    staff_pin = request.headers.get("x-staff-pin", "")
    if not db.verify_admin_staff(staff_id, staff_pin):
        raise HTTPException(
            status_code=403,
            detail="Chỉ Chủ quán hoặc Kế toán đã đăng nhập mới có quyền chạy truy vấn SQL trực tiếp.",
        )
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
    with _state_write_lock:
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
    with _state_write_lock:
        if payload.baseRevision is not None:
            cur_rev = db.get_revision()
            if cur_rev > payload.baseRevision:
                latest = db.load_state_from_postgres()
                return JSONResponse(
                    status_code=409,
                    content={
                        "ok": False,
                        "conflict": True,
                        "revision": cur_rev,
                        "state": latest,
                    },
                )
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
                {"type": "connected", "revision": db.get_revision(), "uiVersion": UI_VERSION, "at": int(time.time() * 1000)},
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
    staff = db.execute_readonly_sql(
        "SELECT id, name, role, phone, pay_type, base_salary, hourly_rate, shift_id, brand_ids_json, assigned_areas_json, assigned_tables_json, active FROM staff ORDER BY id ASC"
    )
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


@app.get("/api/reports/sales.csv")
def api_export_sales_csv(
    kind: str = Query(default="invoices", pattern="^(daily|invoices|items)$"),
    from_key: Optional[str] = None,
    to_key: Optional[str] = None,
):
    import csv as _csv

    st = db.load_state_from_postgres() or {}
    cfg = st.get("config") or {}
    data = st.get("data") or {}
    store_cfg = cfg.get("store") or {}
    staff_map = {s.get("id"): s.get("name") for s in (data.get("staff") or []) if isinstance(s, dict)}
    sales = [s for s in (data.get("sales") or []) if isinstance(s, dict)]
    if from_key:
        sales = [s for s in sales if str(s.get("dayKey") or "") >= from_key]
    if to_key:
        sales = [s for s in sales if str(s.get("dayKey") or "") <= to_key]
    sales.sort(key=lambda x: int(x.get("closedAt") or 0), reverse=True)

    buf = io.StringIO()
    buf.write("\ufeff")
    writer = _csv.writer(buf, lineterminator="\r\n")
    span = f"{from_key or 'all'}_{to_key or 'now'}"

    if kind == "daily":
        writer.writerow(["BẢNG KÊ THỐNG KÊ DOANH THU BÁN HÀNG THEO NGÀY"])
        writer.writerow(["Đơn vị", store_cfg.get("name") or "Quán Nhậu OS", "Từ ngày", from_key or "Đầu kỳ", "Đến ngày", to_key or "Hiện tại"])
        writer.writerow([])
        writer.writerow(["Ngày", "Số hóa đơn", "Lượt khách", "Doanh thu thuần (đ)", "Tiền mặt (đ)", "Chuyển khoản QR (đ)", "Tiền Tip (đ)", "Giá vốn (đ)", "Lãi gộp (đ)"])
        by_day: Dict[str, Dict[str, int]] = {}
        for d in data.get("dailyStats") or []:
            dk = str(d.get("dayKey") or "")
            if not dk or (from_key and dk < from_key) or (to_key and dk > to_key):
                continue
            by_day[dk] = {
                "bills": int(d.get("bills") or 0),
                "guests": int(d.get("guests") or 0),
                "revenue": int(d.get("revenue") or 0),
                "cash": int(d.get("cash") or 0),
                "qr": int(d.get("qr") or 0),
                "tips": int(d.get("tips") or 0),
                "cogs": int(d.get("cogs") or 0),
            }
        sales_by_day: Dict[str, List[Dict[str, Any]]] = {}
        for s in sales:
            dk = str(s.get("dayKey") or "")
            if dk:
                sales_by_day.setdefault(dk, []).append(s)
        for dk, d_sales in sales_by_day.items():
            if dk not in by_day or len(d_sales) >= by_day[dk]["bills"]:
                rev = sum(int(x.get("grand") or 0) for x in d_sales)
                cash = sum(sum(int(p.get("amount") or 0) for p in (x.get("payments") or []) if p.get("method") == "cash") for x in d_sales)
                qr = sum(sum(int(p.get("amount") or 0) for p in (x.get("payments") or []) if p.get("method") != "cash") for x in d_sales)
                by_day[dk] = {
                    "bills": len(d_sales),
                    "guests": sum(int(x.get("guests") or 0) for x in d_sales),
                    "revenue": rev,
                    "cash": cash,
                    "qr": qr,
                    "tips": sum(int(x.get("tip") or 0) for x in d_sales),
                    "cogs": sum(int(x.get("cost") or 0) for x in d_sales),
                }
        for dk in sorted(by_day.keys()):
            r = by_day[dk]
            writer.writerow([dk, r["bills"], r["guests"], r["revenue"], r["cash"], r["qr"], r["tips"], r["cogs"], r["revenue"] - r["cogs"]])
        fname = f"bang_ke_doanh_thu_ngay_{span}.csv"
    elif kind == "items":
        writer.writerow(["BẢNG KÊ SẢN LƯỢNG & DOANH THU THEO MÓN"])
        writer.writerow(["Đơn vị", store_cfg.get("name") or "Quán Nhậu OS", "Từ ngày", from_key or "Đầu kỳ", "Đến ngày", to_key or "Hiện tại"])
        writer.writerow([])
        writer.writerow(["Mã món", "Tên món", "Sản lượng bán", "Khối lượng (kg)", "Sản lượng tặng KM", "Doanh thu (đ)", "Giá vốn (đ)", "Lãi gộp (đ)"])
        agg: Dict[str, Dict[str, Any]] = {}
        for s in sales:
            for ln in s.get("lines") or []:
                if ln.get("status") == "void":
                    continue
                mid = str(ln.get("menuId") or ln.get("name") or "")
                a = agg.setdefault(mid, {"id": mid, "name": ln.get("name") or mid, "qty": 0, "kg": 0.0, "free": 0, "amt": 0, "cost": 0})
                if ln.get("isFree"):
                    a["free"] += int(ln.get("qty") or 0)
                    a["cost"] += int(ln.get("cost") or 0)
                else:
                    a["qty"] += int(ln.get("qty") or 0)
                    a["kg"] += float(ln.get("kg") or 0)
                    a["amt"] += int(ln.get("amount") or 0)
                    a["cost"] += int(ln.get("cost") or 0)
        for a in sorted(agg.values(), key=lambda x: x["amt"], reverse=True):
            writer.writerow([a["id"], a["name"], a["qty"], round(a["kg"], 2), a["free"], a["amt"], a["cost"], a["amt"] - a["cost"]])
        fname = f"bang_ke_doanh_thu_mon_{span}.csv"
    else:
        writer.writerow(["BẢNG KÊ CHI TIẾT HÓA ĐƠN BÁN HÀNG"])
        writer.writerow(["Đơn vị", store_cfg.get("name") or "Quán Nhậu OS", "Từ ngày", from_key or "Đầu kỳ", "Đến ngày", to_key or "Hiện tại"])
        writer.writerow([])
        writer.writerow(["STT", "Mã hóa đơn", "Mã QR", "Ngày", "Bàn", "Số khách", "Phục vụ", "Thu ngân", "Chi tiết món", "Doanh thu thuần (đ)", "Tiền mặt (đ)", "VietQR (đ)", "Tiền Tip (đ)", "Giá vốn (đ)", "Lãi gộp (đ)"])
        for idx, s in enumerate(sales, 1):
            cash = sum(int(p.get("amount") or 0) for p in (s.get("payments") or []) if p.get("method") == "cash")
            qr = sum(int(p.get("amount") or 0) for p in (s.get("payments") or []) if p.get("method") != "cash")
            items_txt = "; ".join(
                f"{round(float(ln.get('kg') or 0), 2)}kg {ln.get('name')}" if float(ln.get("kg") or 0) > 0 else f"{ln.get('qty') or 1}x {ln.get('name')}"
                for ln in (s.get("lines") or [])
                if ln.get("status") != "void"
            )
            grand = int(s.get("grand") or 0)
            cost = int(s.get("cost") or 0)
            writer.writerow([
                idx,
                s.get("id") or "",
                s.get("payCode") or "",
                s.get("dayKey") or "",
                s.get("tableCode") or s.get("tableId") or "",
                int(s.get("guests") or 0),
                staff_map.get(s.get("waiterId"), s.get("waiterId") or ""),
                staff_map.get(s.get("cashierId"), s.get("cashierId") or ""),
                items_txt,
                grand,
                cash,
                qr,
                int(s.get("tip") or 0),
                cost,
                grand - cost,
            ])
        fname = f"bang_ke_chi_tiet_hoa_don_{span}.csv"

    return Response(
        content=buf.getvalue().encode("utf-8"),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{fname}"'},
    )


@app.get("/api/config")
def api_get_config():
    rows = db.execute_readonly_sql("SELECT revision, version, updated_at, updated_by, config_json, pending_config FROM system_config WHERE id = 1")
    history = db.execute_readonly_sql("SELECT id, changed_at, changed_by, effective, apply_at, applied_at, note, changes_json FROM config_history ORDER BY changed_at DESC LIMIT 50")
    return {"ok": True, "config": rows[0] if rows else None, "history": history}


# ======================= PAYMENT GATEWAY WEBHOOK API =======================
# Tuong thich thuc te 100% voi:
# 1. SePay (my.sepay.vn): Flat JSON {id, gateway, transferType: 'in'|'out', transferAmount, content, description, referenceCode, code} + Header 'Authorization: Apikey <KEY>'
# 2. Casso Webhook V1 & V2 (casso.vn): Nested JSON {error: 0, data: [...] | {records: [...]} | {id, tid, reference, description, amount}} + Header 'Secure-Token' hoac 'X-Casso-Signature' (HMAC-SHA256)
# 3. PayOS (payos.vn): Nested JSON {code: '00', data: {orderCode, amount, description, reference}, signature} (bao gom ca goi confirm-webhook ping test)
# 4. Goi truc tiep / tuy chinh: {amount, content, transactionId, gateway, ticketId, ...}

import hashlib
import hmac
import unicodedata


def _norm_code(s: str) -> str:
    txt = str(s or "").replace("đ", "d").replace("Đ", "D")
    txt = unicodedata.normalize("NFKD", txt)
    txt = "".join(ch for ch in txt if not unicodedata.combining(ch))
    return "".join(ch for ch in txt.upper() if ch.isalnum())


def _clean_secret_value(val: str) -> str:
    s = str(val or "").strip()
    low = s.lower()
    if low.startswith("apikey "):
        return s[7:].strip()
    if low.startswith("bearer "):
        return s[7:].strip()
    return s


def _verify_webhook_auth(request: Request, raw_body: bytes, body_dict: Any, expected_secret: str) -> bool:
    secret = _clean_secret_value(expected_secret)
    if not secret:
        return True

    # 1. Kiem tra Header Authorization (SePay: 'Apikey <KEY>' / 'Bearer <KEY>') hoac Secure-Token / X-Webhook-Secret / X-Api-Key
    candidates: List[str] = []
    auth_hdr = (request.headers.get("authorization") or "").strip()
    if auth_hdr:
        candidates.append(_clean_secret_value(auth_hdr))
        parts = auth_hdr.split(None, 1)
        if len(parts) == 2:
            candidates.append(parts[1].strip())
    for hdr_name in ("x-webhook-secret", "secure-token", "x-api-key", "apikey"):
        hv = (request.headers.get(hdr_name) or "").strip()
        if hv:
            candidates.append(_clean_secret_value(hv))
    for qp_name in ("token", "secret", "apikey", "key"):
        qv = (request.query_params.get(qp_name) or "").strip()
        if qv:
            candidates.append(_clean_secret_value(qv))

    for cand in candidates:
        if cand and hmac.compare_digest(cand, secret):
            return True

    # 2. Kiem tra chu ky HMAC Casso Webhook V2 ('X-Casso-Signature: t=...,v1=...')
    casso_sig = (request.headers.get("x-casso-signature") or "").strip()
    if casso_sig:
        ts_val = ""
        v1_val = ""
        for seg in casso_sig.split(","):
            if "=" in seg:
                k, v = seg.split("=", 1)
                if k.strip() == "t":
                    ts_val = v.strip()
                elif k.strip() == "v1":
                    v1_val = v.strip().lower()
        if v1_val:
            raw_str = raw_body.decode("utf-8", errors="replace")
            sorted_str = json.dumps(body_dict, sort_keys=True, separators=(",", ":"), ensure_ascii=False) if isinstance(body_dict, dict) else raw_str
            msg_variants = [
                f"{ts_val}.{sorted_str}" if ts_val else sorted_str,
                f"{ts_val}.{raw_str}" if ts_val else raw_str,
                raw_str,
                sorted_str,
            ]
            for mv in msg_variants:
                for digest_mod in (hashlib.sha256, hashlib.sha512):
                    calc = hmac.new(secret.encode("utf-8"), mv.encode("utf-8"), digest_mod).hexdigest().lower()
                    if hmac.compare_digest(calc, v1_val):
                        return True

    # 3. Kiem tra chu ky PayOS ('signature' trong JSON body)
    if isinstance(body_dict, dict) and body_dict.get("signature") and isinstance(body_dict.get("data"), dict):
        payos_sig = str(body_dict.get("signature") or "").strip().lower()
        d_obj = body_dict["data"]
        query_str = "&".join(
            f"{k}={'' if d_obj[k] is None else d_obj[k]}"
            for k in sorted(d_obj.keys())
        )
        calc_payos = hmac.new(secret.encode("utf-8"), query_str.encode("utf-8"), hashlib.sha256).hexdigest().lower()
        if hmac.compare_digest(calc_payos, payos_sig):
            return True

    return False


def _extract_gateway_transactions(body_dict: Any) -> tuple[List[Dict[str, Any]], bool]:
    """
    Chuan hoa payload tu SePay / Casso (v1, v2) / PayOS / Custom JSON thanh danh sach giao dich.
    Tra ve: (transactions, is_ping)
    """
    if not isinstance(body_dict, dict) or not body_dict:
        return [], True
    if body_dict.get("isTestPing") or body_dict.get("ping"):
        return [], True

    # 1. PayOS format: {"code": "00", "data": {"orderCode": ..., "amount": ..., "description": ...}, "signature": ...}
    if isinstance(body_dict.get("data"), dict) and ("orderCode" in body_dict["data"] or "paymentLinkId" in body_dict["data"]):
        d = body_dict["data"]
        desc = str(d.get("description") or "").strip()
        order_code = d.get("orderCode")
        # PayOS confirm-webhook test goi orderCode=123, description='VQRIO123'
        if str(order_code) == "123" and desc.upper() in ("VQRIO123", "TEST", ""):
            return [], True
        amt = int(round(float(d.get("amount") or 0)))
        tx_id = str(d.get("reference") or d.get("paymentLinkId") or f"payos_{order_code}").strip()
        return [
            {
                "amount": amt,
                "direction": "in" if amt >= 0 else "out",
                "content": desc or f"ORDER {order_code}",
                "searchText": f"{desc} {order_code}",
                "txId": tx_id,
                "gateway": "PayOS",
                "ticketId": None,
                "tipMode": None,
                "tipStaffId": None,
                "by": None,
            }
        ], False

    # 2. Casso Webhook v1 / v2 format: {"error": 0, "data": [...] | {"records": [...]} | {...}}
    if "data" in body_dict and body_dict["data"] is not None:
        raw_data = body_dict["data"]
        if isinstance(raw_data, list):
            records = raw_data
        elif isinstance(raw_data, dict) and isinstance(raw_data.get("records"), list):
            records = raw_data["records"]
        elif isinstance(raw_data, dict):
            records = [raw_data]
        else:
            records = []
        if not records:
            return [], True
        out_list: List[Dict[str, Any]] = []
        for idx, rec in enumerate(records):
            if not isinstance(rec, dict):
                continue
            raw_amt = float(rec.get("amount") if rec.get("amount") is not None else (rec.get("transferAmount") or 0))
            amt_int = int(round(abs(raw_amt)))
            t_type = str(rec.get("transferType") or "").strip().lower()
            direction = "out" if (raw_amt < 0 or t_type == "out") else "in"
            desc = str(rec.get("description") or rec.get("content") or rec.get("memo") or "").strip()
            search_txt = " ".join(filter(None, [str(rec.get("code") or ""), str(rec.get("content") or ""), str(rec.get("description") or "")])).strip()
            tx_id = str(rec.get("tid") or rec.get("reference") or rec.get("referenceCode") or rec.get("id") or f"casso_{int(time.time()*1000)}_{idx}").strip()
            gw = str(rec.get("bankName") or rec.get("bankAbbreviation") or rec.get("corresponsiveBankName") or body_dict.get("gateway") or "Casso Webhook").strip()
            out_list.append(
                {
                    "amount": amt_int,
                    "direction": direction,
                    "content": desc,
                    "searchText": search_txt or desc,
                    "txId": tx_id,
                    "gateway": gw,
                    "ticketId": rec.get("ticketId"),
                    "tipMode": rec.get("tipMode"),
                    "tipStaffId": rec.get("tipStaffId"),
                    "by": rec.get("by"),
                }
            )
        return (out_list, False) if out_list else ([], True)

    # 3. SePay & Direct / Custom flat JSON
    raw_amt_field = body_dict.get("amount") if body_dict.get("amount") is not None else body_dict.get("transferAmount")
    if raw_amt_field is None and not body_dict.get("content") and not body_dict.get("description") and not body_dict.get("ticketId"):
        return [], True
    raw_amt = float(raw_amt_field or 0)
    amt_int = int(round(abs(raw_amt)))
    t_type = str(body_dict.get("transferType") or "in").strip().lower()
    direction = "out" if (t_type == "out" or raw_amt < 0) else "in"
    content_disp = str(body_dict.get("content") or body_dict.get("description") or body_dict.get("memo") or body_dict.get("code") or "").strip()
    search_txt = " ".join(
        filter(
            None,
            [
                str(body_dict.get("code") or "").strip(),
                str(body_dict.get("content") or "").strip(),
                str(body_dict.get("description") or "").strip(),
                str(body_dict.get("memo") or "").strip(),
            ],
        )
    ).strip()
    sepay_id = body_dict.get("id")
    tx_id = str(
        body_dict.get("transactionId")
        or body_dict.get("referenceCode")
        or (f"sepay_{sepay_id}" if sepay_id is not None else f"tx_{int(time.time() * 1000)}")
    ).strip()
    gw = str(body_dict.get("gateway") or "SePay / VietQR").strip()
    return [
        {
            "amount": amt_int,
            "direction": direction,
            "content": content_disp,
            "searchText": search_txt or content_disp,
            "txId": tx_id,
            "gateway": gw,
            "ticketId": body_dict.get("ticketId"),
            "tipMode": body_dict.get("tipMode"),
            "tipStaffId": body_dict.get("tipStaffId"),
            "by": body_dict.get("by"),
        }
    ], False


def _fmt_vnd_plain(n: int) -> str:
    return f"{int(round(n or 0)):,}".replace(",", ".")


def _hm_str(ms: int) -> str:
    return time.strftime("%H:%M", time.localtime((ms or int(time.time() * 1000)) / 1000.0))


def _resolve_expected_secret(pg_cfg: Dict[str, Any]) -> str:
    """
    Uu tien Khoa bao mat Webhook do Chu quan / Dev cau hinh truc tiep tren giao dien Web UI (/owner/settings).
    Chi fallback sang bien moi truong WEBHOOK_SECRET khi trong config chua co truong webhookSecret.
    """
    if isinstance(pg_cfg, dict) and "webhookSecret" in pg_cfg and pg_cfg.get("webhookSecret") is not None:
        return _clean_secret_value(str(pg_cfg.get("webhookSecret") or ""))
    return _clean_secret_value(os.environ.get("WEBHOOK_SECRET") or "")


@app.get("/api/webhooks/payment")
def api_list_payment_webhooks(limit: int = Query(50, ge=1, le=200)):
    st = db.load_state_from_postgres()
    cfg = (st or {}).get("config") or {}
    pg_cfg = cfg.get("paymentGateway") or {}
    logs = (st.get("data", {}).get("webhookLogs") if st else None) or []
    return {
        "ok": True,
        "success": True,
        "endpoint": pg_cfg.get("webhookPath") or "/api/webhooks/payment",
        "enabled": pg_cfg.get("enabled", True) is not False,
        "provider": pg_cfg.get("provider") or "SePay / Casso / VietQR",
        "secretConfigured": bool(_resolve_expected_secret(pg_cfg)),
        "count": len(logs[:limit]),
        "webhooks": logs[:limit],
    }


@app.post("/api/webhooks/payment/test")
async def api_test_payment_webhook(request: Request):
    """
    Kiem tra ket noi truc tiep tu giao dien Cai dat cua Chu quan (khong tao doanh thu ao):
    - Xac thuc dung Header / Secret hien tai
    - Luu 1 dong log 'ping_ok' vao webhookLogs & day SSE de xac minh luong end-to-end hoat dong 100%
    """
    raw_body = await request.body()
    try:
        body_dict = json.loads(raw_body.decode("utf-8")) if raw_body else {}
    except Exception:
        body_dict = {}

    with _state_write_lock:
        st = db.load_state_from_postgres()
        if not st:
            raise HTTPException(status_code=400, detail="Cơ sở dữ liệu chưa được khởi tạo.")
        cfg = st.get("config") or {}
        pg_cfg = cfg.get("paymentGateway") or {}
        expected_secret = _resolve_expected_secret(pg_cfg)
        if not _verify_webhook_auth(request, raw_body, body_dict, expected_secret):
            raise HTTPException(status_code=401, detail="Khóa bảo mật Webhook (API Key / Secret) chưa khớp.")

        now_ms = int(time.time() * 1000)
        data = st.get("data") or {}
        webhook_logs = data.setdefault("webhookLogs", [])
        log_entry = {
            "id": f"wh_{now_ms}",
            "txId": f"ping_{now_ms}",
            "at": now_ms,
            "gateway": str(body_dict.get("gateway") or pg_cfg.get("provider") or "Kiểm tra kết nối"),
            "amount": 0,
            "content": "KIEM TRA KET NOI WEBHOOK",
            "status": "ping_ok",
            "reason": "Kết nối cổng thanh toán & xác thực bảo mật thành công",
        }
        webhook_logs.insert(0, log_entry)
        rev = db.persist_state_to_postgres(
            st,
            who="webhook_test",
            audit_text="Kiểm tra kết nối Cổng thanh toán Webhook thành công",
        )
    broadcast_event("state_updated", {"revision": rev, "who": "webhook_test", "at": now_ms})
    return {
        "ok": True,
        "success": True,
        "status": "ping_ok",
        "secretVerified": bool(expected_secret),
        "revision": rev,
        "webhook": log_entry,
    }


@app.post("/api/webhooks/payment")
async def api_receive_payment_webhook(request: Request):
    raw_body = await request.body()
    if not raw_body or not raw_body.strip():
        return {"ok": True, "success": True, "ping": True, "message": "Webhook endpoint ready"}
    try:
        body_dict = json.loads(raw_body.decode("utf-8"))
    except Exception:
        raise HTTPException(status_code=400, detail="Payload JSON không hợp lệ.")

    with _state_write_lock:
        return _process_payment_webhook_locked(body_dict, raw_body, request)


def _process_payment_webhook_locked(body_dict: Any, raw_body: bytes, request: Request):
    """
    Xu ly Webhook bien dong so du tu SePay, Casso (V1/V2), PayOS, VietQR:
    - Tra ve HTTP 200 OK cho moi goi tin hop le (ke ca ping xac thuc cong, giao dich tien ra, giao dich le khong ma ban)
      de SePay/Casso/PayOS luon xac thuc URL thanh cong ngay lan dau va khong retry spam.
    - Chi tra HTTP 401 khi giao dich that sai Secret / chu ky HMAC.
    - Tu dong chot bill + day phieu K80 xuong may in Thu ngan + tach Tien Tip + dong bo SSE tuc thi (< 1 giay).
    """
    tx_list, is_ping = _extract_gateway_transactions(body_dict)
    if is_ping:
        return {"ok": True, "success": True, "ping": True, "message": "Webhook verified successfully"}

    st = db.load_state_from_postgres()
    if not st:
        raise HTTPException(status_code=400, detail="Cơ sở dữ liệu chưa được khởi tạo.")

    cfg = st.get("config") or {}
    pg_cfg = cfg.get("paymentGateway") or {}
    expected_secret = _resolve_expected_secret(pg_cfg)
    if not _verify_webhook_auth(request, raw_body, body_dict, expected_secret):
        raise HTTPException(status_code=401, detail="Xác thực Webhook Secret / chữ ký không hợp lệ.")

    if pg_cfg.get("enabled", True) is False:
        return {"ok": True, "success": True, "ignored": "gateway_disabled", "message": "Webhook đang tạm tắt trong Cài đặt."}

    results = []
    for tx in tx_list:
        res = _process_single_gateway_tx(st, cfg, tx, request)
        results.append(res)

    if len(results) == 1:
        return {"ok": True, "success": True, **results[0]}
    return {"ok": True, "success": True, "count": len(results), "results": results}


def _process_single_gateway_tx(st: Dict[str, Any], cfg: Dict[str, Any], tx: Dict[str, Any], request: Request) -> Dict[str, Any]:
    amount = int(tx.get("amount") or 0)
    direction = tx.get("direction") or "in"
    content = (tx.get("content") or "").strip()
    search_text = (tx.get("searchText") or content).strip()
    tx_id = (tx.get("txId") or f"tx_{int(time.time() * 1000)}").strip()
    gateway = (tx.get("gateway") or "SePay / Casso / VietQR").strip()

    # Bo qua an toan giao dich TIEN RA (VD: chu quan chuyen khoan thanh toan nha cung cap)
    if direction == "out":
        return {"matched": False, "ignored": "outgoing_transfer", "txId": tx_id, "amount": amount}
    if amount <= 0:
        return {"matched": False, "ignored": "zero_amount", "txId": tx_id}

    data = st.get("data") or {}
    now_ms = int(time.time() * 1000)
    webhook_logs = data.setdefault("webhookLogs", [])

    # Kiem tra giao dich trung lap (Idempotency)
    for existing in webhook_logs:
        if existing.get("txId") == tx_id and existing.get("status") in ("matched_paid", "partial_paid", "matched_booking_deposit"):
            return {"duplicate": True, "matched": True, "status": existing.get("status"), "webhook": existing}

    tickets = data.get("tickets") or []
    tables_list = cfg.get("tables") or (cfg.get("floor") or {}).get("tables") or []
    tables_by_id = {t["id"]: t for t in tables_list if isinstance(t, dict) and "id" in t}
    staff_list = data.get("staff") or []
    staff_name_map = {s.get("id"): s.get("name") for s in staff_list if isinstance(s, dict)}
    norm_content = _norm_code(search_text)
    prefix = _norm_code((cfg.get("paymentGateway") or {}).get("prefix") or "QN")

    matched_tk = None
    if tx.get("ticketId"):
        matched_tk = next((t for t in tickets if t.get("id") == tx.get("ticketId") and t.get("status") != "paid"), None)
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
        # 1. Kiem tra chuyen khoan TIEN COC DAT BAN TRUC TUYEN (Noi dung: COC <Ma dat ban>)
        if norm_content:
            for bk in data.get("bookings") or []:
                if bk.get("status") not in ("holding", "pending_deposit"):
                    continue
                raw_id = "".join(ch for ch in str(bk.get("id") or "") if ch.isalnum()).upper()[-6:]
                bk_code = _norm_code(bk.get("code") or f"DB{raw_id}")
                if bk_code and bk_code in norm_content:
                    dep_need = int(bk.get("deposit") or 0)
                    if amount >= dep_need:
                        bk["depositPaid"] = True
                        bk["status"] = "confirmed"
                        bk["paidAt"] = now_ms
                        log_entry = {
                            "id": f"wh_{now_ms}",
                            "txId": tx_id,
                            "at": now_ms,
                            "gateway": gateway,
                            "amount": amount,
                            "content": content,
                            "bookingId": bk.get("id"),
                            "bookingCode": bk_code,
                            "tableId": bk.get("tableId"),
                            "status": "matched_booking_deposit",
                        }
                        webhook_logs.insert(0, log_entry)
                        rev = db.persist_state_to_postgres(
                            st,
                            who="webhook",
                            audit_text=f"Webhook QR tự động xác nhận tiền cọc đặt bàn {bk_code} ({bk.get('name')}): {amount:,} đ",
                        )
                        broadcast_event(
                            "state_updated",
                            {"revision": rev, "who": "webhook", "auditText": f"Đã nhận cọc đặt bàn {bk_code}", "at": now_ms},
                        )
                        return {"matched": True, "status": "matched_booking_deposit", "revision": rev, "booking": bk, "webhook": log_entry}

        # 2. Kiem tra ngoai le: Ma chuyen khoan khop voi 1 bill DA DONG (khach chuyen trung 2 lan hoac chuyen sau khi da thu tien mat)
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
            rev = db.persist_state_to_postgres(st, who="webhook", audit_text=warn_msg)
            broadcast_event(
                "payment_webhook",
                {
                    "revision": rev,
                    "webhook": log_entry,
                    "overpaid": True,
                    "tableCode": closed_sale.get("tableCode") or "",
                    "amount": amount,
                    "reason": warn_msg,
                    "at": now_ms,
                },
            )
            return {"matched": False, "status": "overpaid_closed_bill", "revision": rev, "warning": warn_msg, "webhook": log_entry}

        log_entry = {
            "id": f"wh_{now_ms}",
            "txId": tx_id,
            "at": now_ms,
            "gateway": gateway,
            "amount": amount,
            "content": content,
            "status": "unmatched",
            "reason": "Giao dịch không chứa mã định danh bàn đang mở",
        }
        webhook_logs.insert(0, log_entry)
        rev = db.persist_state_to_postgres(st, who="webhook", audit_text=f"Webhook QR không khớp bàn: {content} ({amount:,} đ)")
        broadcast_event("state_updated", {"revision": rev, "who": "webhook", "at": now_ms})
        return {"matched": False, "status": "unmatched", "revision": rev, "webhook": log_entry}

    # Neu ban con hai san chua can -> luu vao payments tam (partial) de khong mat giao dich ngan hang
    has_pending_weigh = any(
        it.get("status") == "pending_weigh"
        for it in (matched_tk.get("items") or [])
    )

    # Tinh tong tien bill
    menu_by_id = {m["id"]: m for m in (cfg.get("menu") or [])}
    cats_by_id = {c["id"]: c for c in (cfg.get("categories") or [])}
    styles_by_id = {s["id"]: s for s in (cfg.get("styles") or [])}
    subtotal = 0
    cost_total = 0
    lines = []
    vat_map: Dict[str, Dict[str, Any]] = {"food": {"gross": 0, "vat": 0, "rate": 8}, "alcohol": {"gross": 0, "vat": 0, "rate": 10}}
    for it in matched_tk.get("items") or []:
        if it.get("status") in ("void", "pending_weigh"):
            continue
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
        vat_map.setdefault(vg, {"gross": 0, "vat": 0, "rate": rate})
        vat_map[vg]["rate"] = rate
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
    auto_close = (cfg.get("paymentGateway") or {}).get("autoCloseOnFullPay", True) is not False

    if amount < due_now or has_pending_weigh or not auto_close:
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
        reason_txt = (
            f"Đã ghi nhận {paid_so_far:,} đ (còn hải sản chờ cân)"
            if has_pending_weigh
            else f"Đã nhận đủ {paid_so_far:,} đ (chờ thu ngân bấm đóng bill)"
            if not auto_close and remaining_due == 0
            else f"Đã thu 1 phần {paid_so_far:,} đ · Còn thiếu {remaining_due:,} đ"
        )
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
            "reason": reason_txt,
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
                "text": f"Bàn {tbl_code} vừa chuyển khoản {amount:,} đ ({reason_txt})",
            },
        )
        rev = db.persist_state_to_postgres(
            st,
            who="webhook",
            audit_text=f"Webhook QR ghi nhận tiền vào bàn {tbl_code}: +{amount:,} đ ({reason_txt})",
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
            "matched": True,
            "partial": True,
            "status": "partial_paid",
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
    over_as_tip = (cfg.get("paymentGateway") or {}).get("overpayAsTip", True) is not False
    tip = max(0, total_received - need) if over_as_tip else 0
    tip_mode = tx.get("tipMode") or matched_tk.get("preferredTipMode") or (cfg.get("payroll") or {}).get("tipPolicy") or "personal"
    primary_staff = tx.get("tipStaffId") or matched_tk.get("waiterId") or "s_lan"

    # Tinh tipShares
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
        "cashierId": tx.get("by") or matched_tk.get("waiterId") or (sh.get("cashierId") if sh else "s_thu"),
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

    # Hoan tat booking lien ket (neu co) & xoa thong bao xin in tam tinh cu
    if matched_tk.get("bookingId"):
        for bk in data.get("bookings") or []:
            if bk.get("id") == matched_tk.get("bookingId"):
                bk["status"] = "completed"
    data["notifications"] = [
        n for n in (data.get("notifications") or [])
        if not (n.get("type") == "prebill_request" and n.get("ticketId") == matched_tk["id"])
    ]

    # Day tu dong HOA DON THANH TOAN K80 vao hang doi in (printLog) de may in Thu ngan tu nha bill (< 2s)
    store_cfg = cfg.get("store") or {}
    rc_cfg = cfg.get("receipt") or {}
    printers = cfg.get("printers") or []
    cashier_pr = next((p for p in printers if p.get("id") == "p_cashier"), None) or next((p for p in printers if p.get("purpose") == "bill"), None)
    rerouted_from: Any = False
    if cashier_pr and not cashier_pr.get("online", True) and cashier_pr.get("backupId"):
        bk_pr = next((p for p in printers if p.get("id") == cashier_pr.get("backupId") and p.get("online", True)), None)
        if bk_pr:
            rerouted_from = cashier_pr.get("name") or "Máy in Thu ngân"
            cashier_pr = bk_pr
    sum_rows: List[Dict[str, Any]] = [{"l": "Cộng tiền hàng", "r": _fmt_vnd_plain(subtotal)}]
    if vip_fee:
        sum_rows.append({"l": "Phụ thu phòng VIP", "r": _fmt_vnd_plain(vip_fee)})
    if discount:
        sum_rows.append({"l": "Giảm giá", "r": "-" + _fmt_vnd_plain(discount)})
    sum_rows.append({"l": "TỔNG CỘNG", "r": _fmt_vnd_plain(grand), "bold": True, "big": True})
    if deposit:
        sum_rows.append({"l": "Đã đặt cọc", "r": "-" + _fmt_vnd_plain(deposit)})
    vat_notes = []
    if cfg.get("tax", {}).get("pricesIncludeVat", True) and rc_cfg.get("showVatNote", True):
        for g_key, vg_info in vat_map.items():
            if vg_info.get("gross", 0) > 0:
                vat_notes.append(f"Giá đã gồm VAT {int(vg_info.get('rate') or 8)}%: {_fmt_vnd_plain(vg_info.get('vat') or 0)}")
    origin_url = f"{request.url.scheme}://{request.headers.get('host') or 'munbao.com'}"
    inv_code = sale_id[-8:].upper()
    receipt_doc = {
        "id": f"pr_{now_ms}",
        "at": now_ms,
        "printerId": cashier_pr.get("id") if cashier_pr else "p_cashier",
        "printerName": cashier_pr.get("name") if cashier_pr else "Máy in Thu ngân",
        "rerouted": rerouted_from,
        "failed": bool(not cashier_pr or not cashier_pr.get("online", True)),
        "kind": "receipt",
        "title": "HÓA ĐƠN THANH TOÁN",
        "header": [store_cfg.get("name") or "QUÁN NHẬU", store_cfg.get("address") or "", "ĐT: " + str(store_cfg.get("phone") or "")],
        "meta": [
            {"l": "Bàn", "r": sale_obj["tableCode"]},
            {"l": "Giờ vào", "r": _hm_str(sale_obj["openedAt"])},
            {"l": "Giờ ra", "r": _hm_str(now_ms)},
            {"l": "Số khách", "r": str(sale_obj["guests"])},
            {"l": "Phục vụ", "r": staff_name_map.get(sale_obj["waiterId"]) or "-"},
            {"l": "Thanh toán", "r": f"VietQR ({sale_obj['payCode']})"},
        ],
        "rows": [
            {
                "l": (f"{round(float(ln.get('kg') or 0), 2)}kg " if float(ln.get("kg") or 0) > 0 else f"{ln.get('qty') or 1}x ")
                + str(ln.get("name") or "")
                + (" (Tặng)" if ln.get("isFree") else ""),
                "r": _fmt_vnd_plain(int(ln.get("amount") or 0)),
            }
            for ln in lines
        ],
        "sumRows": sum_rows,
        "payments": all_pays,
        "change": 0,
        "tip": tip,
        "vatNote": vat_notes,
        "qr": f"{origin_url}/customer?inv={inv_code}" if rc_cfg.get("showQr", True) else None,
        "qrLabel": rc_cfg.get("footer") or "Quét mã xuất hóa đơn VAT trong 24h",
        "saleId": sale_id,
        "footer": [
            f"Wi-Fi: {store_cfg.get('wifiName')} / {store_cfg.get('wifiPass')}" if rc_cfg.get("showWifi") and store_cfg.get("wifiName") else None,
            store_cfg.get("thanks") or "Cảm ơn quý khách & hẹn gặp lại!",
        ],
    }
    receipt_doc["footer"] = [f for f in receipt_doc["footer"] if f]
    print_log = data.setdefault("printLog", [])
    print_log.insert(0, receipt_doc)
    if len(print_log) > 80:
        del print_log[80:]

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
        who=tx.get("by") or sale_obj["waiterId"] or "webhook",
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
        "matched": True,
        "status": "matched_paid",
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
_tax_lookup_cache: Dict[str, Dict[str, str]] = {}


@app.get("/api/tax-lookup/{tax_code}")
def api_lookup_tax_code(tax_code: str):
    code = re.sub(r"[\s\-]", "", str(tax_code or ""))
    if not re.match(r"^\d{10}(\d{3})?$", code):
        return {"ok": False, "error": "Mã số thuế không hợp lệ."}
    # 1. Uu tien khach doanh nghiep da tung xuat hoa don tai quan
    try:
        rows = db.execute_readonly_sql(
            "SELECT company, address, email FROM einvoices WHERE tax_code = %s ORDER BY issued_at DESC LIMIT 1",
            (code,),
        )
        if rows and rows[0].get("company"):
            return {
                "ok": True,
                "name": rows[0]["company"],
                "address": rows[0].get("address") or "",
                "email": rows[0].get("email") or "",
                "source": "history",
            }
    except Exception:
        pass
    # 2. Bo nho dem & cong tra cuu doanh nghiep VietQR
    if code in _tax_lookup_cache:
        return {"ok": True, **_tax_lookup_cache[code], "source": "cache"}
    try:
        req = urllib.request.Request(
            f"https://api.vietqr.io/v2/business/{code}",
            headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)", "Accept": "application/json"},
        )
        with urllib.request.urlopen(req, timeout=5) as resp:
            body = json.loads(resp.read().decode("utf-8"))
            data = body.get("data") or {}
            if body.get("code") == "00" and data.get("name"):
                entry = {"name": str(data["name"]).strip(), "address": str(data.get("address") or "").strip()}
                _tax_lookup_cache[code] = entry
                return {"ok": True, **entry, "source": "vietqr"}
    except Exception:
        pass
    return {"ok": False}


_STATIC_EXTS = (".js", ".css", ".woff2", ".woff", ".ttf", ".png", ".jpg", ".jpeg", ".svg", ".ico", ".json", ".map")


def _serve_spa_index():
    return FileResponse(
        str(WEB_DIR / "index.html"),
        headers={"Cache-Control": "no-cache, no-store, must-revalidate"},
    )


def _serve_spa_subpath(subpath: str = ""):
    rel = (subpath or "").lstrip("/")
    if rel and (rel.startswith(("js/", "css/", "fonts/")) or rel.lower().endswith(_STATIC_EXTS)):
        candidate = (WEB_DIR / rel).resolve()
        try:
            candidate.relative_to(WEB_DIR.resolve())
        except ValueError:
            raise HTTPException(status_code=404)
        if candidate.is_file():
            return FileResponse(str(candidate))
        raise HTTPException(status_code=404)
    return _serve_spa_index()


@app.get("/", include_in_schema=False)
def _serve_root_index():
    return _serve_spa_index()


for _p in _SPA_PORTALS:
    app.add_api_route(f"/{_p}", _serve_spa_index, methods=["GET"], include_in_schema=False)
    app.add_api_route(f"/{_p}/{{subpath:path}}", _serve_spa_subpath, methods=["GET"], include_in_schema=False)


# Phuc vu toan bo giao dien Web tinh (C:/quan_nhau/web)
if WEB_DIR.exists():
    app.mount("/", StaticFiles(directory=str(WEB_DIR), html=True), name="web")


if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("PORT", "8765"))
    uvicorn.run("server:app", host="0.0.0.0", port=port, reload=False)
