# -*- coding: utf-8 -*-
"""
db.py - Tang ket noi va dong bo co so du lieu PostgreSQL 16 cho Quan Nhau OS.
Ho tro:
1. Ket noi PostgreSQL ngoai qua bien moi truong DATABASE_URL (hoac tep .env).
2. Tu dong khoi chay PostgreSQL 16.2 tich hop (pgserver) tai C:/quan_nhau/backend/pgdata
   neu chua cau hinh DATABASE_URL ngoai, dam bao he thong luon chay PostgreSQL that 100%.
3. Luu tru va tai du lieu hai chieu giua 32 bang quan he PostgreSQL (schema.sql) va trang thai ung dung.
"""

import json
import os
import re
import subprocess
import threading
import time
from decimal import Decimal
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import psycopg2
import psycopg2.extras

BACKEND_DIR = Path(__file__).resolve().parent
SCHEMA_PATH = BACKEND_DIR / "schema.sql"
PGDATA_DIR = BACKEND_DIR / "pgdata"
PGLOG_PATH = BACKEND_DIR / "postgres.log"
ENV_PATH = BACKEND_DIR / ".env"

_db_lock = threading.RLock()
_pg_server = None
_db_uri: Optional[str] = None
_db_mode: str = "embedded_postgres"


def _load_dotenv() -> Dict[str, str]:
    env: Dict[str, str] = {}
    if ENV_PATH.exists():
        for raw in ENV_PATH.read_text(encoding="utf-8").splitlines():
            line = raw.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            env[k.strip()] = v.strip().strip('"').strip("'")
    return env


def _ensure_local_postgres_running(port: int = 54329) -> str:
    base_uri = f"postgresql://postgres@127.0.0.1:{port}/postgres"
    try:
        conn = psycopg2.connect(base_uri, connect_timeout=2)
        conn.close()
        return base_uri
    except Exception:
        pass

    import pgserver

    pg_bin = Path(pgserver.__file__).resolve().parent / "pginstall" / "bin"
    initdb_exe = pg_bin / ("initdb.exe" if os.name == "nt" else "initdb")
    pg_ctl_exe = pg_bin / ("pg_ctl.exe" if os.name == "nt" else "pg_ctl")

    PGDATA_DIR.parent.mkdir(parents=True, exist_ok=True)
    if not (PGDATA_DIR / "PG_VERSION").exists():
        PGDATA_DIR.mkdir(parents=True, exist_ok=True)
        subprocess.run(
            [str(initdb_exe), "-D", str(PGDATA_DIR), "-U", "postgres", "-A", "trust", "-E", "UTF8", "--no-locale"],
            check=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
        )

    # Xoa tep log cu nam ben trong pgdata (neu co) de tranh xung dot file tren Windows khi recovery
    inner_log = PGDATA_DIR / "log"
    if inner_log.exists() and inner_log.is_file():
        try:
            inner_log.unlink()
        except Exception:
            pass

    subprocess.run(
        [
            str(pg_ctl_exe),
            "-D",
            str(PGDATA_DIR),
            "-l",
            str(PGLOG_PATH),
            "-w",
            "-o",
            f"-h 127.0.0.1 -p {port}",
            "start",
        ],
        check=True,
        stdin=subprocess.DEVNULL,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    return base_uri


def get_database_uri() -> str:
    global _pg_server, _db_uri, _db_mode
    if _db_uri:
        return _db_uri

    with _db_lock:
        if _db_uri:
            return _db_uri

        file_env = _load_dotenv()
        configured_url = os.environ.get("DATABASE_URL") or file_env.get("DATABASE_URL", "")
        db_name = os.environ.get("POSTGRES_DB") or file_env.get("POSTGRES_DB", "quan_nhau_os")
        pg_port = int(os.environ.get("POSTGRES_PORT") or file_env.get("POSTGRES_PORT", "54329"))

        if configured_url and configured_url.lower() != "auto":
            _db_uri = configured_url
            _db_mode = "external_postgres"
            return _db_uri

        base_uri = _ensure_local_postgres_running(port=pg_port)

        # Tao database rieng quan_nhau_os neu chua ton tai
        conn = psycopg2.connect(base_uri)
        conn.autocommit = True
        try:
            with conn.cursor() as cur:
                cur.execute("SELECT 1 FROM pg_database WHERE datname = %s", (db_name,))
                if not cur.fetchone():
                    cur.execute(f'CREATE DATABASE "{db_name}" ENCODING \'UTF8\'')
        finally:
            conn.close()

        _db_uri = f"postgresql://postgres@127.0.0.1:{pg_port}/{db_name}"
        _db_mode = "embedded_postgres"
        return _db_uri


def get_masked_database_uri() -> str:
    uri = get_database_uri()
    return re.sub(r"://([^:/@]+):([^@]+)@", r"://\1:********@", uri)


def get_connection():
    uri = get_database_uri()
    return psycopg2.connect(uri)


def verify_admin_staff(staff_id: str, staff_pin: str) -> bool:
    sid = (staff_id or "").strip()
    pin = (staff_pin or "").strip()
    if not sid or not pin:
        return False
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT 1 FROM staff WHERE id = %s AND pin = %s AND active = TRUE AND role IN ('owner', 'accountant') LIMIT 1",
                (sid, pin),
            )
            return cur.fetchone() is not None
    except Exception:
        return False
    finally:
        conn.close()


def init_schema() -> Dict[str, Any]:
    with _db_lock:
        sql = SCHEMA_PATH.read_text(encoding="utf-8")
        conn = get_connection()
        try:
            with conn:
                with conn.cursor() as cur:
                    cur.execute(sql)
                    cur.execute("ALTER TABLE staff ADD COLUMN IF NOT EXISTS assigned_areas_json JSONB DEFAULT '[]'::jsonb")
                    cur.execute("ALTER TABLE staff ADD COLUMN IF NOT EXISTS assigned_tables_json JSONB DEFAULT '[]'::jsonb")
                    cur.execute("ALTER TABLE tickets ADD COLUMN IF NOT EXISTS pay_code TEXT")
                    cur.execute("ALTER TABLE tickets ADD COLUMN IF NOT EXISTS preferred_tip_mode TEXT")
                    cur.execute("ALTER TABLE tickets ADD COLUMN IF NOT EXISTS merged_pay_codes_json JSONB DEFAULT '[]'::jsonb")
                    cur.execute("ALTER TABLE tickets ADD COLUMN IF NOT EXISTS handed_over_from TEXT")
                    cur.execute("ALTER TABLE tickets ADD COLUMN IF NOT EXISTS extra_json JSONB DEFAULT '{}'::jsonb")
                    cur.execute("ALTER TABLE ticket_items ADD COLUMN IF NOT EXISTS extra_json JSONB DEFAULT '{}'::jsonb")
                    cur.execute("ALTER TABLE wastage_reports ADD COLUMN IF NOT EXISTS photo_url TEXT")
                    cur.execute("ALTER TABLE approvals ADD COLUMN IF NOT EXISTS photo_url TEXT")
                    cur.execute("ALTER TABLE sales ADD COLUMN IF NOT EXISTS pay_code TEXT")
                    cur.execute("ALTER TABLE sales ADD COLUMN IF NOT EXISTS tip_mode TEXT")
                    cur.execute("ALTER TABLE sales ADD COLUMN IF NOT EXISTS tip_shares_json JSONB DEFAULT '[]'::jsonb")
                    cur.execute("ALTER TABLE sales ADD COLUMN IF NOT EXISTS payment_source TEXT DEFAULT 'manual'")
                    cur.execute("ALTER TABLE sales ADD COLUMN IF NOT EXISTS webhook_tx_id TEXT")
                    cur.execute("ALTER TABLE sales ADD COLUMN IF NOT EXISTS paid_by_role TEXT")
                    cur.execute("ALTER TABLE sales ADD COLUMN IF NOT EXISTS merged_pay_codes_json JSONB DEFAULT '[]'::jsonb")
                    cur.execute(
                        """
                        CREATE TABLE IF NOT EXISTS payment_webhooks (
                            id TEXT PRIMARY KEY,
                            tx_id TEXT,
                            received_at BIGINT NOT NULL,
                            gateway TEXT,
                            amount BIGINT NOT NULL DEFAULT 0,
                            content TEXT,
                            status TEXT NOT NULL DEFAULT 'matched_paid',
                            ticket_id TEXT,
                            sale_id TEXT,
                            table_code TEXT,
                            pay_code TEXT,
                            payload_json JSONB
                        )
                        """
                    )
                    cur.execute("SELECT version(), current_database()")
                    ver, dbname = cur.fetchone()
            return {
                "ok": True,
                "mode": _db_mode,
                "uri": get_masked_database_uri(),
                "database": dbname,
                "version": ver,
            }
        finally:
            conn.close()


def _j(val: Any) -> psycopg2.extras.Json:
    return psycopg2.extras.Json(val, dumps=lambda x: json.dumps(x, ensure_ascii=False))


def _num(val: Any, default: int = 0) -> int:
    if val is None or val == "":
        return default
    try:
        return int(round(float(val)))
    except Exception:
        return default


def _flt(val: Any, default: float = 0.0) -> float:
    if val is None or val == "":
        return default
    if isinstance(val, Decimal):
        return float(val)
    try:
        return float(val)
    except Exception:
        return default


def is_seeded() -> bool:
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) FROM system_config WHERE id = 1")
            row = cur.fetchone()
            return bool(row and row[0] > 0)
    finally:
        conn.close()


def get_revision() -> int:
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT revision FROM system_config WHERE id = 1")
            row = cur.fetchone()
            return int(row[0]) if row else 0
    finally:
        conn.close()


def persist_state_to_postgres(state: Dict[str, Any], who: str = "system", audit_text: Optional[str] = None) -> int:
    """
    Dong bo toan bo state (config + data) vao 32 bang quan he PostgreSQL trong 1 giao dich ACID.
    Tra ve so revision moi nhat.
    """
    cfg = state.get("config") or {}
    data = state.get("data") or {}
    now_ms = int(time.time() * 1000)

    if audit_text:
        audit_list = data.setdefault("audit", [])
        audit_list.insert(0, {"at": now_ms, "who": who or "system", "text": audit_text})
        if len(audit_list) > 500:
            del audit_list[500:]

    with _db_lock:
        conn = get_connection()
        try:
            with conn:
                with conn.cursor() as cur:
                    # 1. system_config
                    cur.execute("SELECT revision FROM system_config WHERE id = 1 FOR UPDATE")
                    row = cur.fetchone()
                    new_rev = (int(row[0]) + 1) if row else 1

                    cur.execute(
                        """
                        INSERT INTO system_config (id, revision, version, seeded_at, last_bill_closed_at, config_json, pending_config, updated_at, updated_by)
                        VALUES (1, %s, %s, %s, %s, %s, %s, NOW(), %s)
                        ON CONFLICT (id) DO UPDATE SET
                            revision = EXCLUDED.revision,
                            version = EXCLUDED.version,
                            seeded_at = EXCLUDED.seeded_at,
                            last_bill_closed_at = EXCLUDED.last_bill_closed_at,
                            config_json = EXCLUDED.config_json,
                            pending_config = EXCLUDED.pending_config,
                            updated_at = NOW(),
                            updated_by = EXCLUDED.updated_by
                        """,
                        (
                            new_rev,
                            _num(state.get("version"), 1),
                            _num(data.get("seededAt"), now_ms),
                            _num(data.get("lastBillClosedAt"), 0),
                            _j(cfg),
                            _j(data.get("pendingConfig")) if data.get("pendingConfig") else None,
                            who or "system",
                        ),
                    )

                    # 2. config_history
                    cur.execute("DELETE FROM config_history")
                    for h in data.get("configHistory") or []:
                        cur.execute(
                            """
                            INSERT INTO config_history (id, changed_at, changed_by, effective, apply_at, applied_at, note, changes_json, before_json, after_json)
                            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                            """,
                            (
                                h.get("id"),
                                _num(h.get("at"), now_ms),
                                h.get("by"),
                                h.get("effective") or "now",
                                h.get("applyAt"),
                                h.get("appliedAt"),
                                h.get("note") or "",
                                _j(h.get("changes") or []),
                                _j(h.get("before") or {}),
                                _j(h.get("after") or {}),
                            ),
                        )

                    # 3. areas & restaurant_tables
                    cur.execute("DELETE FROM restaurant_tables")
                    cur.execute("DELETE FROM areas")
                    for idx, ar in enumerate(cfg.get("areas") or []):
                        cur.execute(
                            "INSERT INTO areas (id, name, sort_order) VALUES (%s, %s, %s)",
                            (ar["id"], ar["name"], idx),
                        )

                    table_state = data.get("tableState") or {}
                    for tb in cfg.get("tables") or []:
                        ts = table_state.get(tb["id"]) or {}
                        cur.execute(
                            """
                            INSERT INTO restaurant_tables (id, code, area_id, seats, table_type, pos_x, pos_y, clean_status, dirty_since)
                            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                            """,
                            (
                                tb["id"],
                                tb["code"],
                                tb["areaId"],
                                _num(tb.get("seats"), 4),
                                tb.get("type") or "normal",
                                _num(tb.get("x"), 0),
                                _num(tb.get("y"), 0),
                                ts.get("status") or "clean",
                                ts.get("since"),
                            ),
                        )

                    # 4. categories, cooking_styles, portion_bags, brands, menu_items, promos, printers, work_shifts
                    cur.execute("DELETE FROM menu_items")
                    cur.execute("DELETE FROM categories")
                    for cat in cfg.get("categories") or []:
                        cur.execute(
                            "INSERT INTO categories (id, name, kind, vat_group, sort_order) VALUES (%s, %s, %s, %s, %s)",
                            (cat["id"], cat["name"], cat.get("kind") or "kitchen", cat.get("vatGroup") or "food", _num(cat.get("order"), 0)),
                        )

                    cur.execute("DELETE FROM cooking_styles")
                    for st in cfg.get("styles") or []:
                        cur.execute(
                            "INSERT INTO cooking_styles (id, name, surcharge) VALUES (%s, %s, %s)",
                            (st["id"], st["name"], _num(st.get("surcharge"), 0)),
                        )

                    stock_map = data.get("stock") or {}
                    cur.execute("DELETE FROM portion_bags")
                    for bg in cfg.get("bags") or []:
                        cur.execute(
                            "INSERT INTO portion_bags (id, name, item_group, unit, gram, min_stock, cost, stock_qty) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)",
                            (
                                bg["id"],
                                bg["name"],
                                bg.get("group") or "meat",
                                bg.get("unit") or "túi",
                                _num(bg.get("gram"), 0),
                                _num(bg.get("minStock"), 0),
                                _num(bg.get("cost"), 0),
                                _num(stock_map.get(bg["id"]), 0),
                            ),
                        )

                    cur.execute("DELETE FROM brands")
                    for br in cfg.get("brands") or []:
                        cur.execute(
                            "INSERT INTO brands (id, name, rebate_target, rebate_unit, rebate_period, rebate_amount) VALUES (%s, %s, %s, %s, %s, %s)",
                            (
                                br["id"],
                                br["name"],
                                _num(br.get("rebateTarget"), 0),
                                br.get("rebateUnit") or "thùng",
                                br.get("rebatePeriod") or "quarter",
                                _num(br.get("rebateAmount"), 0),
                            ),
                        )

                    drinks_map = data.get("drinks") or {}
                    for m in cfg.get("menu") or []:
                        mid = m["id"]
                        drink_stock = _num(drinks_map[mid]) if mid in drinks_map else None
                        cur.execute(
                            """
                            INSERT INTO menu_items (
                                id, name, category_id, kind, price, cost, price_per_kg, cost_per_kg,
                                unit, case_size, brand_id, active, popular, bottle_keep,
                                upsell, upsell_per_kg, avg_kg_per_piece, styles_json, bom_json, drink_stock
                            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                            """,
                            (
                                mid,
                                m["name"],
                                m["categoryId"],
                                m["kind"],
                                _num(m.get("price"), 0),
                                _num(m.get("cost"), 0),
                                _num(m.get("pricePerKg"), 0),
                                _num(m.get("costPerKg"), 0),
                                m.get("unit") or "đĩa",
                                m.get("caseSize"),
                                m.get("brandId"),
                                bool(m.get("active", True)),
                                bool(m.get("popular", False)),
                                bool(m.get("bottleKeep", False)),
                                _num(m.get("upsell"), 0),
                                _num(m.get("upsellPerKg"), 0),
                                _flt(m.get("avgKgPerPiece"), 0.0),
                                _j(m.get("styles") or []),
                                _j(m.get("bom") or []),
                                drink_stock,
                            ),
                        )

                    cur.execute("DELETE FROM promos")
                    for pr in cfg.get("promos") or []:
                        cur.execute(
                            """
                            INSERT INTO promos (id, brand_id, menu_id, name, buy_qty, free_qty, source, require_cap_return, active)
                            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                            """,
                            (
                                pr["id"],
                                pr.get("brandId") or "",
                                pr.get("menuId") or "",
                                pr["name"],
                                _num(pr.get("buyQty"), 10),
                                _num(pr.get("freeQty"), 1),
                                pr.get("source") or "brand",
                                bool(pr.get("requireCapReturn", True)),
                                bool(pr.get("active", True)),
                            ),
                        )

                    cur.execute("DELETE FROM printers")
                    for pt in cfg.get("printers") or []:
                        cur.execute(
                            """
                            INSERT INTO printers (id, name, location, purpose, copies, online, backup_id, categories_json)
                            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                            """,
                            (
                                pt["id"],
                                pt["name"],
                                pt.get("location") or "",
                                pt.get("purpose") or "kitchen",
                                _num(pt.get("copies"), 1),
                                bool(pt.get("online", True)),
                                pt.get("backupId") or "",
                                _j(pt.get("categories") or []),
                            ),
                        )

                    cur.execute("DELETE FROM work_shifts")
                    for ws in cfg.get("shifts") or []:
                        cur.execute(
                            "INSERT INTO work_shifts (id, name, segments_json) VALUES (%s, %s, %s)",
                            (ws["id"], ws["name"], _j(ws.get("segments") or [])),
                        )

                    # 5. seafood_tank
                    cur.execute("DELETE FROM seafood_tank")
                    for mid, tk_info in (data.get("tank") or {}).items():
                        cur.execute(
                            "INSERT INTO seafood_tank (menu_id, piece_count, weight_kg, items_json, updated_at) VALUES (%s, %s, %s, %s, NOW())",
                            (
                                mid,
                                _num(tk_info.get("count"), 0),
                                _flt(tk_info.get("kg"), 0.0),
                                _j(tk_info.get("items") or []),
                            ),
                        )

                    # 6. staff
                    cur.execute("DELETE FROM staff")
                    for sf in data.get("staff") or []:
                        cur.execute(
                            """
                            INSERT INTO staff (id, name, role, pin, phone, pay_type, base_salary, hourly_rate, shift_id, brand_ids_json, assigned_areas_json, assigned_tables_json, active)
                            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                            """,
                            (
                                sf["id"],
                                sf["name"],
                                sf["role"],
                                str(sf.get("pin") or ""),
                                sf.get("phone") or "",
                                sf.get("payType") or "hourly",
                                _num(sf.get("baseSalary"), 0),
                                _num(sf.get("hourlyRate"), 0),
                                sf.get("shiftId") or "",
                                _j(sf.get("brandIds") or []),
                                _j(sf.get("assignedAreas") or []),
                                _j(sf.get("assignedTables") or []),
                                bool(sf.get("active", True)),
                            ),
                        )

                    # 7. attendance
                    cur.execute("DELETE FROM attendance")
                    for att in data.get("attendance") or []:
                        cur.execute(
                            """
                            INSERT INTO attendance (
                                id, staff_id, day_key, segment, shift_id, check_in, check_out,
                                method, late_min, selfie, ot_pending_min, ot_approved_min, ot_auto_min, ot_status, off_schedule
                            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                            """,
                            (
                                att["id"],
                                att["staffId"],
                                att["dayKey"],
                                _num(att.get("segment"), 0),
                                att.get("shiftId") or "",
                                _num(att.get("in"), 0),
                                att.get("out"),
                                att.get("method") or "kiosk",
                                _num(att.get("lateMin"), 0),
                                bool(att.get("selfie", True)),
                                _num(att.get("otPendingMin"), 0),
                                _num(att.get("otApprovedMin"), 0),
                                _num(att.get("otAutoMin"), 0),
                                att.get("otStatus") or "none",
                                bool(att.get("offSchedule", False)),
                            ),
                        )

                    # 8. bookings
                    cur.execute("DELETE FROM bookings")
                    for bk in data.get("bookings") or []:
                        cur.execute(
                            """
                            INSERT INTO bookings (
                                id, code, customer_name, phone, day_key, booking_time, guests,
                                area_id, table_id, deposit, deposit_paid, deposit_status, status,
                                created_at, hold_until, paid_at, note, source, cancel_reason
                            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                            """,
                            (
                                bk["id"],
                                bk.get("code"),
                                bk["name"],
                                bk["phone"],
                                bk["dayKey"],
                                bk["time"],
                                _num(bk.get("guests"), 2),
                                bk.get("areaId") or "",
                                bk.get("tableId") or "",
                                _num(bk.get("deposit"), 0),
                                bool(bk.get("depositPaid", False)),
                                bk.get("depositStatus"),
                                bk.get("status") or "holding",
                                _num(bk.get("createdAt"), now_ms),
                                bk.get("holdUntil"),
                                bk.get("paidAt"),
                                bk.get("note") or "",
                                bk.get("source") or "web",
                                bk.get("cancelReason") or "",
                            ),
                        )

                    # 9. tickets & ticket_items
                    cur.execute("DELETE FROM ticket_items")
                    cur.execute("DELETE FROM tickets")
                    for tk in data.get("tickets") or []:
                        tk_extra = {
                            k: tk[k]
                            for k in (
                                "prebillOutdated",
                                "prebillInvalidatedAt",
                                "prebillInvalidatedBy",
                                "prebillInvalidatedReason",
                                "postPrebillAdjustments",
                                "handedOverAt",
                            )
                            if k in tk and tk[k] is not None
                        }
                        cur.execute(
                            """
                            INSERT INTO tickets (
                                id, table_id, status, guests, opened_at, closed_at, waiter_id,
                                booking_id, deposit, prebill_at, prebill_by, prebill_count,
                                prebill_requested_at, prebill_requested_by, unlock_count, part,
                                split_from, discount_json, payments_json, sale_id, pay_code, preferred_tip_mode,
                                merged_pay_codes_json, handed_over_from, extra_json
                            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                            """,
                            (
                                tk["id"],
                                tk["tableId"],
                                tk.get("status") or "open",
                                _num(tk.get("guests"), 2),
                                _num(tk.get("openedAt"), now_ms),
                                tk.get("closedAt"),
                                tk.get("waiterId"),
                                tk.get("bookingId"),
                                _num(tk.get("deposit"), 0),
                                tk.get("prebillAt"),
                                tk.get("prebillBy"),
                                _num(tk.get("prebillCount"), 0),
                                tk.get("prebillRequestedAt"),
                                tk.get("prebillRequestedBy"),
                                _num(tk.get("unlockCount"), 0),
                                tk.get("part"),
                                tk.get("splitFrom"),
                                _j(tk["discount"]) if tk.get("discount") else None,
                                _j(tk.get("payments") or []),
                                tk.get("saleId"),
                                tk.get("payCode"),
                                tk.get("preferredTipMode"),
                                _j(tk.get("mergedPayCodes") or []),
                                tk.get("handedOverFrom"),
                                _j(tk_extra),
                            ),
                        )
                        for idx, it in enumerate(tk.get("items") or []):
                            extra_fields = {
                                k: it[k]
                                for k in (
                                    "saleMode",
                                    "gram",
                                    "cutFrom",
                                    "fishItems",
                                    "fishIds",
                                    "fishCodes",
                                    "fishSummary",
                                    "dealAmount",
                                    "bargain",
                                    "broughtOutQty",
                                    "returnedQty",
                                )
                                if k in it and it[k] is not None
                            }
                            cur.execute(
                                """
                                INSERT INTO ticket_items (
                                    id, ticket_id, sort_idx, menu_id, name, qty, piece_count, weight_kg,
                                    price, price_per_kg, style_id, note, added_by, sent_at, status,
                                    is_free, promo_id, weighed_at, weighed_by, void_reason, void_by, void_requested,
                                    extra_json
                                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                                """,
                                (
                                    it["id"],
                                    tk["id"],
                                    idx,
                                    it["menuId"],
                                    it["name"],
                                    _num(it.get("qty"), 1),
                                    _num(it.get("count"), 0),
                                    _flt(it.get("kg"), 0.0),
                                    _num(it.get("price"), 0),
                                    it.get("pricePerKg"),
                                    it.get("styleId"),
                                    it.get("note") or "",
                                    it.get("addedBy"),
                                    _num(it.get("sentAt"), now_ms),
                                    it.get("status") or "sent",
                                    bool(it.get("isFree", False)),
                                    it.get("promoId"),
                                    it.get("weighedAt"),
                                    it.get("weighedBy"),
                                    it.get("voidReason"),
                                    it.get("voidBy"),
                                    bool(it.get("voidRequested", False)),
                                    _j(extra_fields),
                                ),
                            )

                    # 10. sales
                    cur.execute("DELETE FROM sales")
                    for sl in data.get("sales") or []:
                        cur.execute(
                            """
                            INSERT INTO sales (
                                id, ticket_id, table_id, table_code, opened_at, closed_at, day_key,
                                shift_id, waiter_id, cashier_id, guests, subtotal, vip_fee, discount,
                                deposit, grand, vat_total, cost, received, change_amt, tip,
                                tip_staff_id, unlock_count, receipt_printed, lines_json, payments_json, vat_json, einvoice_json,
                                pay_code, tip_mode, tip_shares_json, payment_source, webhook_tx_id, paid_by_role, merged_pay_codes_json
                            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                            """,
                            (
                                sl["id"],
                                sl.get("ticketId") or "",
                                sl.get("tableId") or "",
                                sl.get("tableCode") or "",
                                _num(sl.get("openedAt"), 0),
                                _num(sl.get("closedAt"), 0),
                                sl.get("dayKey") or "",
                                sl.get("shiftId"),
                                sl.get("waiterId"),
                                sl.get("cashierId"),
                                _num(sl.get("guests"), 2),
                                _num(sl.get("subtotal"), 0),
                                _num(sl.get("vipFee"), 0),
                                _num(sl.get("discount"), 0),
                                _num(sl.get("deposit"), 0),
                                _num(sl.get("grand"), 0),
                                _num(sl.get("vatTotal"), 0),
                                _num(sl.get("cost"), 0),
                                _num(sl.get("received"), 0),
                                _num(sl.get("change"), 0),
                                _num(sl.get("tip"), 0),
                                sl.get("tipStaffId"),
                                _num(sl.get("unlockCount"), 0),
                                bool(sl.get("receipt", False)),
                                _j(sl.get("lines") or []),
                                _j(sl.get("payments") or []),
                                _j(sl.get("vat") or {}),
                                _j(sl["einvoice"]) if sl.get("einvoice") else None,
                                sl.get("payCode"),
                                sl.get("tipMode"),
                                _j(sl.get("tipShares") or []),
                                sl.get("paymentSource") or "manual",
                                sl.get("webhookTxId"),
                                sl.get("paidByRole"),
                                _j(sl.get("mergedPayCodes") or []),
                            ),
                        )

                    # 11. cash_shifts & shifts_history
                    cur.execute("DELETE FROM cash_shifts")
                    sh = data.get("shift")
                    if sh:
                        cur.execute(
                            """
                            INSERT INTO cash_shifts (
                                id, day_key, cashier_id, opened_at, closed_at, opening_cash,
                                status, auto_locked_at, is_current, petty_json, tips_paid_json,
                                advances_paid_json, denominations_json, z_report_json
                            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, TRUE, %s, %s, %s, %s, %s)
                            """,
                            (
                                sh["id"],
                                sh["dayKey"],
                                sh.get("cashierId") or "s_cash",
                                _num(sh.get("openedAt"), now_ms),
                                sh.get("closedAt"),
                                _num(sh.get("openingCash"), 0),
                                sh.get("status") or "open",
                                sh.get("autoLockedAt"),
                                _j(sh.get("petty") or []),
                                _j(sh.get("tipsPaid") or []),
                                _j(sh.get("advancesPaid") or []),
                                _j(sh.get("denominations")) if sh.get("denominations") else None,
                                _j(sh.get("z")) if sh.get("z") else None,
                            ),
                        )

                    cur.execute("DELETE FROM shifts_history")
                    for z in data.get("shiftsHistory") or []:
                        cur.execute(
                            """
                            INSERT INTO shifts_history (
                                id, shift_id, day_key, opened_at, closed_at, cashier_id, closed_by,
                                opening, cash, qr, card, petty, tips_paid, advances_paid,
                                expected, counted, variance, note, bills, revenue,
                                denominations_json, vat_json, locked
                            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                            """,
                            (
                                z["id"],
                                z.get("shiftId") or "",
                                z.get("dayKey") or "",
                                _num(z.get("openedAt"), 0),
                                _num(z.get("closedAt"), 0),
                                z.get("cashierId"),
                                z.get("closedBy"),
                                _num(z.get("opening"), 0),
                                _num(z.get("cash"), 0),
                                _num(z.get("qr"), 0),
                                _num(z.get("card"), 0),
                                _num(z.get("petty"), 0),
                                _num(z.get("tipsPaid"), 0),
                                _num(z.get("advancesPaid"), 0),
                                _num(z.get("expected"), 0),
                                _num(z.get("counted"), 0),
                                _num(z.get("variance"), 0),
                                z.get("note") or "",
                                _num(z.get("bills"), 0),
                                _num(z.get("revenue"), 0),
                                _j(z.get("denominations")) if z.get("denominations") else None,
                                _j(z.get("vat") or {}),
                                bool(z.get("locked", True)),
                            ),
                        )

                    # 12. bottle_keeps
                    cur.execute("DELETE FROM bottle_keeps")
                    for bt in data.get("bottleKeeps") or []:
                        cur.execute(
                            """
                            INSERT INTO bottle_keeps (id, code, phone, customer_name, wine, remaining_pct, created_at, expires_at, status, created_by, table_id)
                            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                            """,
                            (
                                bt["id"],
                                bt["code"],
                                bt["phone"],
                                bt.get("name") or "",
                                bt["wine"],
                                _num(bt.get("remainingPct"), 50),
                                _num(bt.get("createdAt"), now_ms),
                                _num(bt.get("expiresAt"), now_ms),
                                bt.get("status") or "kept",
                                bt.get("by"),
                                bt.get("tableId"),
                            ),
                        )

                    # 13. goods_receipts
                    cur.execute("DELETE FROM goods_receipts")
                    for gr in data.get("receipts") or []:
                        cur.execute(
                            """
                            INSERT INTO goods_receipts (id, day_key, received_at, supplier, received_by, witness_by, total, lines_json)
                            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                            """,
                            (
                                gr["id"],
                                gr["dayKey"],
                                _num(gr.get("at"), now_ms),
                                gr["supplier"],
                                gr["by"],
                                gr["witness"],
                                _num(gr.get("total"), 0),
                                _j(gr.get("lines") or []),
                            ),
                        )

                    # 14. wastage_reports
                    cur.execute("DELETE FROM wastage_reports")
                    for ws in data.get("wastage") or []:
                        cur.execute(
                            """
                            INSERT INTO wastage_reports (
                                id, reported_at, menu_id, bag_id, kind, piece_count, weight_kg,
                                qty, amount, reason, reported_by, photo, photo_url, status, resolved_by, resolved_at
                            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                            """,
                            (
                                ws["id"],
                                _num(ws.get("at"), now_ms),
                                ws.get("menuId"),
                                ws.get("bagId"),
                                ws.get("kind") or "seafood",
                                _num(ws.get("count"), 0),
                                _flt(ws.get("kg"), 0.0),
                                _num(ws.get("qty"), 0),
                                _num(ws.get("amount"), 0),
                                ws.get("reason") or "",
                                ws.get("by") or "",
                                bool(ws.get("photo", True)),
                                ws.get("photoUrl"),
                                ws.get("status") or "pending",
                                ws.get("resolvedBy"),
                                ws.get("resolvedAt"),
                            ),
                        )

                    # 15. stock_counts
                    cur.execute("DELETE FROM stock_counts")
                    for cnt in data.get("counts") or []:
                        cur.execute(
                            """
                            INSERT INTO stock_counts (id, day_key, counted_at, counted_by, status, locked, variance_status, variance_value, lines_json)
                            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                            """,
                            (
                                cnt["id"],
                                cnt["dayKey"],
                                _num(cnt.get("at"), now_ms),
                                cnt.get("by") or "",
                                cnt.get("status") or "submitted",
                                bool(cnt.get("locked", True)),
                                cnt.get("varianceStatus") or "ok",
                                _num(cnt.get("varianceValue"), 0),
                                _j(cnt.get("lines") or []),
                            ),
                        )

                    # 16. salary_advances, salary_deductions, tip_payouts, pg_returns
                    cur.execute("DELETE FROM salary_advances")
                    for adv in data.get("advances") or []:
                        cur.execute(
                            """
                            INSERT INTO salary_advances (id, staff_id, amount, reason, requested_at, status, approved_by, paid_at, paid_by)
                            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                            """,
                            (
                                adv["id"],
                                adv["staffId"],
                                _num(adv.get("amount"), 0),
                                adv.get("reason") or "",
                                _num(adv.get("at"), now_ms),
                                adv.get("status") or "pending",
                                adv.get("approvedBy"),
                                adv.get("paidAt"),
                                adv.get("paidBy"),
                            ),
                        )

                    cur.execute("DELETE FROM salary_deductions")
                    for dd in data.get("deductions") or []:
                        cur.execute(
                            """
                            INSERT INTO salary_deductions (id, staff_id, amount, reason, month_key, created_at)
                            VALUES (%s, %s, %s, %s, %s, %s)
                            """,
                            (
                                dd["id"],
                                dd["staffId"],
                                _num(dd.get("amount"), 0),
                                dd.get("reason") or "",
                                dd["monthKey"],
                                _num(dd.get("at"), now_ms),
                            ),
                        )

                    cur.execute("DELETE FROM tip_payouts")
                    for tp in data.get("tipPayouts") or []:
                        cur.execute(
                            """
                            INSERT INTO tip_payouts (id, paid_at, staff_id, amount, paid_by)
                            VALUES (%s, %s, %s, %s, %s)
                            """,
                            (
                                tp["id"],
                                _num(tp.get("at"), now_ms),
                                tp["staffId"],
                                _num(tp.get("amount"), 0),
                                tp.get("by"),
                            ),
                        )

                    cur.execute("DELETE FROM pg_returns")
                    for pgr in data.get("pgReturns") or []:
                        cur.execute(
                            """
                            INSERT INTO pg_returns (id, day_key, returned_at, staff_id, crates, note, caps_json)
                            VALUES (%s, %s, %s, %s, %s, %s, %s)
                            """,
                            (
                                pgr["id"],
                                pgr["dayKey"],
                                _num(pgr.get("at"), now_ms),
                                pgr.get("by") or "",
                                _num(pgr.get("crates"), 0),
                                pgr.get("note") or "",
                                _j(pgr.get("caps") or {}),
                            ),
                        )

                    # 17. approvals
                    cur.execute("DELETE FROM approvals")
                    for ap in data.get("approvals") or []:
                        cur.execute(
                            """
                            INSERT INTO approvals (
                                id, approval_type, status, created_at, requested_by, ref_id, item_id,
                                title, amount, minutes, reason, photo, photo_url, payload_json, resolved_by, resolved_at, resolve_note
                            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                            """,
                            (
                                ap["id"],
                                ap["type"],
                                ap.get("status") or "pending",
                                _num(ap.get("at"), now_ms),
                                ap.get("by") or "system",
                                ap.get("ref"),
                                ap.get("itemId"),
                                ap.get("title") or "",
                                _num(ap.get("amount"), 0),
                                ap.get("minutes"),
                                ap.get("reason") or "",
                                bool(ap.get("photo", False)),
                                ap.get("photoUrl"),
                                _j(ap["payload"]) if ap.get("payload") else None,
                                ap.get("resolvedBy"),
                                ap.get("resolvedAt"),
                                ap.get("resolveNote") or "",
                            ),
                        )

                    # 18. einvoices
                    cur.execute("DELETE FROM einvoices")
                    for ei in data.get("einvoices") or []:
                        cur.execute(
                            """
                            INSERT INTO einvoices (id, sale_id, tax_code, company, address, email, amount, issued_at, status, invoice_no)
                            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                            """,
                            (
                                ei["id"],
                                ei.get("saleId"),
                                ei["taxCode"],
                                ei["company"],
                                ei.get("address") or "",
                                ei["email"],
                                _num(ei.get("amount"), 0),
                                _num(ei.get("at"), now_ms),
                                ei.get("status") or "issued",
                                ei["invoiceNo"],
                            ),
                        )

                    # 19. daily_stats
                    cur.execute("DELETE FROM daily_stats")
                    for ds in data.get("dailyStats") or []:
                        cur.execute(
                            """
                            INSERT INTO daily_stats (
                                day_key, revenue, food, alcohol, cogs, vip_fee, cash, qr,
                                bills, guests, wastage, labor, utility, tips, variance, closed_by, locked
                            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                            """,
                            (
                                ds["dayKey"],
                                _num(ds.get("revenue"), 0),
                                _num(ds.get("food"), 0),
                                _num(ds.get("alcohol"), 0),
                                _num(ds.get("cogs"), 0),
                                _num(ds.get("vipFee"), 0),
                                _num(ds.get("cash"), 0),
                                _num(ds.get("qr"), 0),
                                _num(ds.get("bills"), 0),
                                _num(ds.get("guests"), 0),
                                _num(ds.get("wastage"), 0),
                                _num(ds.get("labor"), 0),
                                _num(ds.get("utility"), 0),
                                _num(ds.get("tips"), 0),
                                _num(ds.get("variance"), 0),
                                ds.get("closedBy"),
                                bool(ds.get("locked", True)),
                            ),
                        )

                    # 20. print_logs, audit_logs, notifications, other_income, tax_locks
                    cur.execute("DELETE FROM print_logs")
                    for pl in data.get("printLog") or []:
                        cur.execute(
                            """
                            INSERT INTO print_logs (id, printed_at, printer_id, printer_name, kind, title, rerouted, failed, doc_json)
                            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                            """,
                            (
                                pl["id"],
                                _num(pl.get("at"), now_ms),
                                pl.get("printerId") or "",
                                pl.get("printerName") or "",
                                pl.get("kind") or "kitchen",
                                pl.get("title") or "",
                                str(pl["rerouted"]) if pl.get("rerouted") else None,
                                bool(pl.get("failed", False)),
                                _j(pl),
                            ),
                        )

                    cur.execute("DELETE FROM audit_logs")
                    for au in reversed(data.get("audit") or []):
                        cur.execute(
                            "INSERT INTO audit_logs (logged_at, who, action_text) VALUES (%s, %s, %s)",
                            (_num(au.get("at"), now_ms), au.get("who") or "system", au.get("text") or ""),
                        )

                    cur.execute("DELETE FROM notifications")
                    for nt in data.get("notifications") or []:
                        cur.execute(
                            """
                            INSERT INTO notifications (id, notif_type, created_at, is_read, ticket_id, waiter_id, message_text)
                            VALUES (%s, %s, %s, %s, %s, %s, %s)
                            """,
                            (
                                nt["id"],
                                nt.get("type") or "info",
                                _num(nt.get("at"), now_ms),
                                bool(nt.get("read", False)),
                                nt.get("ticketId"),
                                nt.get("waiterId"),
                                nt.get("text") or "",
                            ),
                        )

                    cur.execute("DELETE FROM other_income")
                    for oi in data.get("otherIncome") or []:
                        cur.execute(
                            "INSERT INTO other_income (created_at, day_key, amount, reason) VALUES (%s, %s, %s, %s)",
                            (_num(oi.get("at"), now_ms), oi.get("dayKey") or "", _num(oi.get("amount"), 0), oi.get("reason") or ""),
                        )

                    cur.execute("DELETE FROM tax_locks")
                    for mk in data.get("taxLocks") or []:
                        cur.execute("INSERT INTO tax_locks (month_key) VALUES (%s) ON CONFLICT DO NOTHING", (mk,))

                    cur.execute("DELETE FROM payment_webhooks")
                    for wh in (data.get("webhookLogs") or [])[:200]:
                        cur.execute(
                            """
                            INSERT INTO payment_webhooks (
                                id, tx_id, received_at, gateway, amount, content,
                                status, ticket_id, sale_id, table_code, pay_code, payload_json
                            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                            ON CONFLICT (id) DO NOTHING
                            """,
                            (
                                wh.get("id") or f"wh_{now_ms}",
                                wh.get("txId") or "",
                                _num(wh.get("at"), now_ms),
                                wh.get("gateway") or "VietQR Webhook",
                                _num(wh.get("amount"), 0),
                                wh.get("content") or "",
                                wh.get("status") or "matched_paid",
                                wh.get("ticketId"),
                                wh.get("saleId"),
                                wh.get("tableCode"),
                                wh.get("payCode"),
                                _j(wh),
                            ),
                        )

                    return new_rev
        finally:
            conn.close()


def load_state_from_postgres() -> Optional[Dict[str, Any]]:
    """
    Doc du lieu tu 32 bang quan he PostgreSQL va tai tao state {version, revision, config, data}.
    """
    with _db_lock:
        conn = get_connection()
        try:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute("SELECT * FROM system_config WHERE id = 1")
                sys_row = cur.fetchone()
                if not sys_row:
                    return None

                cfg = dict(sys_row["config_json"] or {})
                revision = int(sys_row["revision"])
                version = int(sys_row["version"])
                seeded_at = int(sys_row["seeded_at"])
                last_bill_closed_at = int(sys_row["last_bill_closed_at"])
                pending_config = sys_row["pending_config"]

                # Areas
                cur.execute("SELECT * FROM areas ORDER BY sort_order ASC")
                cfg["areas"] = [{"id": r["id"], "name": r["name"]} for r in cur.fetchall()]

                # Tables & tableState
                cur.execute("SELECT * FROM restaurant_tables ORDER BY id ASC")
                tables = []
                table_state = {}
                for r in cur.fetchall():
                    tables.append(
                        {
                            "id": r["id"],
                            "code": r["code"],
                            "areaId": r["area_id"],
                            "seats": int(r["seats"]),
                            "type": r["table_type"],
                            "x": int(r["pos_x"]),
                            "y": int(r["pos_y"]),
                        }
                    )
                    if r["clean_status"] == "dirty":
                        table_state[r["id"]] = {"status": "dirty", "since": int(r["dirty_since"] or seeded_at)}
                # Giữ thứ tự bàn gốc nếu có trong config_json
                orig_order = {t["id"]: i for i, t in enumerate(cfg.get("tables") or [])}
                tables.sort(key=lambda x: orig_order.get(x["id"], 9999))
                cfg["tables"] = tables

                # Categories
                cur.execute("SELECT * FROM categories ORDER BY sort_order ASC")
                cfg["categories"] = [
                    {"id": r["id"], "name": r["name"], "kind": r["kind"], "vatGroup": r["vat_group"], "order": int(r["sort_order"])}
                    for r in cur.fetchall()
                ]

                # Styles
                cur.execute("SELECT * FROM cooking_styles")
                styles_Order = {s["id"]: i for i, s in enumerate(cfg.get("styles") or [])}
                styles = [{"id": r["id"], "name": r["name"], "surcharge": int(r["surcharge"])} for r in cur.fetchall()]
                styles.sort(key=lambda x: styles_Order.get(x["id"], 9999))
                cfg["styles"] = styles

                # Bags & stock
                cur.execute("SELECT * FROM portion_bags")
                bag_order = {b["id"]: i for i, b in enumerate(cfg.get("bags") or [])}
                bags = []
                stock = {}
                for r in cur.fetchall():
                    bags.append(
                        {
                            "id": r["id"],
                            "name": r["name"],
                            "group": r.get("item_group") or "meat",
                            "unit": r.get("unit") or "túi",
                            "gram": int(r["gram"]),
                            "minStock": int(r["min_stock"]),
                            "cost": int(r["cost"]),
                        }
                    )
                    stock[r["id"]] = int(r["stock_qty"])
                bags.sort(key=lambda x: bag_order.get(x["id"], 9999))
                cfg["bags"] = bags

                # Brands
                cur.execute("SELECT * FROM brands")
                brand_order = {b["id"]: i for i, b in enumerate(cfg.get("brands") or [])}
                brands = [
                    {
                        "id": r["id"],
                        "name": r["name"],
                        "rebateTarget": int(r["rebate_target"]),
                        "rebateUnit": r["rebate_unit"],
                        "rebatePeriod": r["rebate_period"],
                        "rebateAmount": int(r["rebate_amount"]),
                    }
                    for r in cur.fetchall()
                ]
                brands.sort(key=lambda x: brand_order.get(x["id"], 9999))
                cfg["brands"] = brands

                # Menu items & drinks stock
                cur.execute("SELECT * FROM menu_items")
                menu_order = {m["id"]: i for i, m in enumerate(cfg.get("menu") or [])}
                menu = []
                drinks = {}
                for r in cur.fetchall():
                    item: Dict[str, Any] = {
                        "id": r["id"],
                        "name": r["name"],
                        "categoryId": r["category_id"],
                        "kind": r["kind"],
                        "unit": r["unit"],
                        "active": bool(r["active"]),
                    }
                    if r["kind"] == "seafood":
                        item["pricePerKg"] = int(r["price_per_kg"])
                        item["costPerKg"] = int(r["cost_per_kg"])
                        item["styles"] = r["styles_json"] or []
                        item["upsellPerKg"] = int(r["upsell_per_kg"])
                        item["avgKgPerPiece"] = _flt(r["avg_kg_per_piece"])
                    else:
                        item["price"] = int(r["price"])
                        item["cost"] = int(r["cost"])
                        if r["popular"]:
                            item["popular"] = True
                        if r["bom_json"]:
                            item["bom"] = r["bom_json"]
                        if r["upsell"]:
                            item["upsell"] = int(r["upsell"])
                        if r["case_size"]:
                            item["caseSize"] = int(r["case_size"])
                        if r["brand_id"]:
                            item["brandId"] = r["brand_id"]
                        if r["bottle_keep"]:
                            item["bottleKeep"] = True
                    menu.append(item)
                    if r["drink_stock"] is not None:
                        drinks[r["id"]] = int(r["drink_stock"])
                menu.sort(key=lambda x: menu_order.get(x["id"], 9999))
                cfg["menu"] = menu

                # Promos
                cur.execute("SELECT * FROM promos")
                cfg["promos"] = [
                    {
                        "id": r["id"],
                        "brandId": r["brand_id"],
                        "menuId": r["menu_id"],
                        "name": r["name"],
                        "buyQty": int(r["buy_qty"]),
                        "freeQty": int(r["free_qty"]),
                        "source": r["source"],
                        "requireCapReturn": bool(r["require_cap_return"]),
                        "active": bool(r["active"]),
                    }
                    for r in cur.fetchall()
                ]

                # Printers
                cur.execute("SELECT * FROM printers")
                printer_order = {p["id"]: i for i, p in enumerate(cfg.get("printers") or [])}
                printers = [
                    {
                        "id": r["id"],
                        "name": r["name"],
                        "location": r["location"],
                        "categories": r["categories_json"] or [],
                        "purpose": r["purpose"],
                        "copies": int(r["copies"]),
                        "online": bool(r["online"]),
                        "backupId": r["backup_id"] or "",
                    }
                    for r in cur.fetchall()
                ]
                printers.sort(key=lambda x: printer_order.get(x["id"], 9999))
                cfg["printers"] = printers

                # Shifts
                cur.execute("SELECT * FROM work_shifts")
                shift_order = {s["id"]: i for i, s in enumerate(cfg.get("shifts") or [])}
                shifts = [{"id": r["id"], "name": r["name"], "segments": r["segments_json"] or []} for r in cur.fetchall()]
                shifts.sort(key=lambda x: shift_order.get(x["id"], 9999))
                cfg["shifts"] = shifts

                # Seafood tank
                cur.execute("SELECT * FROM seafood_tank")
                tank = {
                    r["menu_id"]: {
                        "count": int(r["piece_count"]),
                        "kg": _flt(r["weight_kg"]),
                        "items": r.get("items_json") or [],
                    }
                    for r in cur.fetchall()
                }

                # Staff
                cur.execute("SELECT * FROM staff")
                staff = []
                for r in cur.fetchall():
                    sf: Dict[str, Any] = {
                        "id": r["id"],
                        "name": r["name"],
                        "role": r["role"],
                        "pin": r["pin"],
                        "phone": r["phone"],
                        "payType": r["pay_type"],
                        "active": bool(r["active"]),
                    }
                    if r["pay_type"] == "monthly":
                        sf["baseSalary"] = int(r["base_salary"])
                    elif r["pay_type"] == "hourly":
                        sf["hourlyRate"] = int(r["hourly_rate"])
                    sf["shiftId"] = r["shift_id"] or ""
                    if r["brand_ids_json"]:
                        sf["brandIds"] = r["brand_ids_json"]
                    if r.get("assigned_areas_json") is not None:
                        sf["assignedAreas"] = r["assigned_areas_json"]
                    if r.get("assigned_tables_json") is not None:
                        sf["assignedTables"] = r["assigned_tables_json"]
                    staff.append(sf)

                # Attendance
                cur.execute("SELECT * FROM attendance ORDER BY check_in ASC")
                attendance = [
                    {
                        "id": r["id"],
                        "staffId": r["staff_id"],
                        "dayKey": r["day_key"],
                        "segment": int(r["segment"]),
                        "shiftId": r["shift_id"],
                        "in": int(r["check_in"]),
                        "out": int(r["check_out"]) if r["check_out"] is not None else None,
                        "method": r["method"],
                        "lateMin": int(r["late_min"]),
                        "selfie": bool(r["selfie"]),
                        "otPendingMin": int(r["ot_pending_min"]),
                        "otApprovedMin": int(r["ot_approved_min"]),
                        "otAutoMin": int(r["ot_auto_min"]),
                        "otStatus": r["ot_status"],
                        "offSchedule": bool(r["off_schedule"]),
                    }
                    for r in cur.fetchall()
                ]

                # Bookings
                cur.execute("SELECT * FROM bookings ORDER BY created_at ASC")
                bookings = []
                for r in cur.fetchall():
                    bk: Dict[str, Any] = {
                        "id": r["id"],
                        "name": r["customer_name"],
                        "phone": r["phone"],
                        "dayKey": r["day_key"],
                        "time": r["booking_time"],
                        "guests": int(r["guests"]),
                        "areaId": r["area_id"],
                        "tableId": r["table_id"],
                        "deposit": int(r["deposit"]),
                        "depositPaid": bool(r["deposit_paid"]),
                        "status": r["status"],
                        "createdAt": int(r["created_at"]),
                        "note": r["note"] or "",
                    }
                    if r["code"]:
                        bk["code"] = r["code"]
                    if r["deposit_status"]:
                        bk["depositStatus"] = r["deposit_status"]
                    if r["hold_until"] is not None:
                        bk["holdUntil"] = int(r["hold_until"])
                    if r["paid_at"] is not None:
                        bk["paidAt"] = int(r["paid_at"])
                    if r["source"]:
                        bk["source"] = r["source"]
                    if r["cancel_reason"]:
                        bk["cancelReason"] = r["cancel_reason"]
                    bookings.append(bk)

                # Tickets & Ticket Items
                cur.execute("SELECT * FROM ticket_items ORDER BY ticket_id ASC, sort_idx ASC")
                items_by_tk: Dict[str, List[Dict[str, Any]]] = {}
                for r in cur.fetchall():
                    it: Dict[str, Any] = {
                        "id": r["id"],
                        "menuId": r["menu_id"],
                        "name": r["name"],
                        "qty": int(r["qty"]),
                        "price": int(r["price"]),
                        "status": r["status"],
                        "sentAt": int(r["sent_at"]),
                        "addedBy": r["added_by"],
                    }
                    if r["piece_count"]:
                        it["count"] = int(r["piece_count"])
                    if r["weight_kg"] is not None and _flt(r["weight_kg"]) > 0 or r["status"] == "pending_weigh":
                        it["kg"] = _flt(r["weight_kg"])
                    if r["price_per_kg"] is not None:
                        it["pricePerKg"] = int(r["price_per_kg"])
                    if r["style_id"]:
                        it["styleId"] = r["style_id"]
                    if r["note"]:
                        it["note"] = r["note"]
                    if r["is_free"]:
                        it["isFree"] = True
                    if r["promo_id"]:
                        it["promoId"] = r["promo_id"]
                    if r["weighed_at"] is not None:
                        it["weighedAt"] = int(r["weighed_at"])
                    if r["weighed_by"]:
                        it["weighedBy"] = r["weighed_by"]
                    if r["void_reason"]:
                        it["voidReason"] = r["void_reason"]
                    if r["void_by"]:
                        it["voidBy"] = r["void_by"]
                    if r["void_requested"]:
                        it["voidRequested"] = True
                    if isinstance(r.get("extra_json"), dict):
                        for ek, ev in r["extra_json"].items():
                            if ev is not None:
                                it[ek] = ev
                    items_by_tk.setdefault(r["ticket_id"], []).append(it)

                cur.execute("SELECT * FROM tickets ORDER BY opened_at ASC")
                tickets = []
                for r in cur.fetchall():
                    tk: Dict[str, Any] = {
                        "id": r["id"],
                        "tableId": r["table_id"],
                        "status": r["status"],
                        "guests": int(r["guests"]),
                        "openedAt": int(r["opened_at"]),
                        "waiterId": r["waiter_id"],
                        "items": items_by_tk.get(r["id"], []),
                        "payments": r["payments_json"] or [],
                    }
                    if r["closed_at"] is not None:
                        tk["closedAt"] = int(r["closed_at"])
                    if r["booking_id"]:
                        tk["bookingId"] = r["booking_id"]
                    if r["deposit"]:
                        tk["deposit"] = int(r["deposit"])
                    if r["prebill_at"] is not None:
                        tk["prebillAt"] = int(r["prebill_at"])
                    if r["prebill_by"]:
                        tk["prebillBy"] = r["prebill_by"]
                    if r["prebill_count"]:
                        tk["prebillCount"] = int(r["prebill_count"])
                    if r["prebill_requested_at"] is not None:
                        tk["prebillRequestedAt"] = int(r["prebill_requested_at"])
                    if r["prebill_requested_by"]:
                        tk["prebillRequestedBy"] = r["prebill_requested_by"]
                    if r["unlock_count"]:
                        tk["unlockCount"] = int(r["unlock_count"])
                    if r["part"] is not None:
                        tk["part"] = int(r["part"])
                    if r["split_from"]:
                        tk["splitFrom"] = r["split_from"]
                    if r["discount_json"]:
                        tk["discount"] = r["discount_json"]
                    if r["sale_id"]:
                        tk["saleId"] = r["sale_id"]
                    if r.get("pay_code"):
                        tk["payCode"] = r["pay_code"]
                    if r.get("preferred_tip_mode"):
                        tk["preferredTipMode"] = r["preferred_tip_mode"]
                    if r.get("merged_pay_codes_json"):
                        tk["mergedPayCodes"] = r["merged_pay_codes_json"]
                    if r.get("handed_over_from"):
                        tk["handedOverFrom"] = r["handed_over_from"]
                    tk_ex = r.get("extra_json") or {}
                    if isinstance(tk_ex, dict):
                        for ek, ev in tk_ex.items():
                            if ev is not None:
                                tk[ek] = ev
                    tickets.append(tk)

                # Sales
                cur.execute("SELECT * FROM sales ORDER BY closed_at ASC")
                sales = []
                for r in cur.fetchall():
                    sl_obj: Dict[str, Any] = {
                        "id": r["id"],
                        "ticketId": r["ticket_id"],
                        "tableId": r["table_id"],
                        "tableCode": r["table_code"],
                        "openedAt": int(r["opened_at"]),
                        "closedAt": int(r["closed_at"]),
                        "dayKey": r["day_key"],
                        "shiftId": r["shift_id"],
                        "waiterId": r["waiter_id"],
                        "cashierId": r["cashier_id"],
                        "guests": int(r["guests"]),
                        "lines": r["lines_json"] or [],
                        "subtotal": int(r["subtotal"]),
                        "vipFee": int(r["vip_fee"]),
                        "discount": int(r["discount"]),
                        "deposit": int(r["deposit"]),
                        "grand": int(r["grand"]),
                        "vat": r["vat_json"] or {},
                        "vatTotal": int(r["vat_total"]),
                        "cost": int(r["cost"]),
                        "payments": r["payments_json"] or [],
                        "received": int(r["received"]),
                        "change": int(r["change_amt"]),
                        "tip": int(r["tip"]),
                        "tipStaffId": r["tip_staff_id"],
                        "einvoice": r["einvoice_json"],
                        "unlockCount": int(r["unlock_count"]),
                        "receipt": bool(r["receipt_printed"]),
                    }
                    if r.get("pay_code"):
                        sl_obj["payCode"] = r["pay_code"]
                    if r.get("tip_mode"):
                        sl_obj["tipMode"] = r["tip_mode"]
                    if r.get("tip_shares_json"):
                        sl_obj["tipShares"] = r["tip_shares_json"]
                    if r.get("payment_source"):
                        sl_obj["paymentSource"] = r["payment_source"]
                    if r.get("webhook_tx_id"):
                        sl_obj["webhookTxId"] = r["webhook_tx_id"]
                    if r.get("paid_by_role"):
                        sl_obj["paidByRole"] = r["paid_by_role"]
                    if r.get("merged_pay_codes_json"):
                        sl_obj["mergedPayCodes"] = r["merged_pay_codes_json"]
                    sales.append(sl_obj)

                # Current shift & shiftsHistory
                cur.execute("SELECT * FROM cash_shifts WHERE is_current = TRUE LIMIT 1")
                sh_row = cur.fetchone()
                shift = None
                if sh_row:
                    shift = {
                        "id": sh_row["id"],
                        "dayKey": sh_row["day_key"],
                        "cashierId": sh_row["cashier_id"],
                        "openedAt": int(sh_row["opened_at"]),
                        "openingCash": int(sh_row["opening_cash"]),
                        "status": sh_row["status"],
                        "petty": sh_row["petty_json"] or [],
                        "tipsPaid": sh_row["tips_paid_json"] or [],
                        "advancesPaid": sh_row["advances_paid_json"] or [],
                        "denominations": sh_row["denominations_json"],
                    }
                    if sh_row["closed_at"] is not None:
                        shift["closedAt"] = int(sh_row["closed_at"])
                    if sh_row["auto_locked_at"] is not None:
                        shift["autoLockedAt"] = int(sh_row["auto_locked_at"])
                    if sh_row["z_report_json"]:
                        shift["z"] = sh_row["z_report_json"]

                cur.execute("SELECT * FROM shifts_history ORDER BY closed_at DESC")
                shifts_history = [
                    {
                        "id": r["id"],
                        "shiftId": r["shift_id"],
                        "dayKey": r["day_key"],
                        "openedAt": int(r["opened_at"]),
                        "closedAt": int(r["closed_at"]),
                        "cashierId": r["cashier_id"],
                        "closedBy": r["closed_by"],
                        "opening": int(r["opening"]),
                        "cash": int(r["cash"]),
                        "qr": int(r["qr"]),
                        "card": int(r["card"]),
                        "petty": int(r["petty"]),
                        "tipsPaid": int(r["tips_paid"]),
                        "advancesPaid": int(r["advances_paid"]),
                        "expected": int(r["expected"]),
                        "counted": int(r["counted"]),
                        "variance": int(r["variance"]),
                        "note": r["note"] or "",
                        "bills": int(r["bills"]),
                        "revenue": int(r["revenue"]),
                        "denominations": r["denominations_json"],
                        "vat": r["vat_json"] or {},
                        "locked": bool(r["locked"]),
                    }
                    for r in cur.fetchall()
                ]

                # Bottle keeps
                cur.execute("SELECT * FROM bottle_keeps ORDER BY created_at DESC")
                bottle_keeps = [
                    {
                        "id": r["id"],
                        "code": r["code"],
                        "phone": r["phone"],
                        "name": r["customer_name"],
                        "wine": r["wine"],
                        "remainingPct": int(r["remaining_pct"]),
                        "createdAt": int(r["created_at"]),
                        "expiresAt": int(r["expires_at"]),
                        "status": r["status"],
                        "by": r["created_by"],
                        "tableId": r["table_id"],
                    }
                    for r in cur.fetchall()
                ]

                # Goods receipts
                cur.execute("SELECT * FROM goods_receipts ORDER BY received_at DESC")
                receipts = [
                    {
                        "id": r["id"],
                        "dayKey": r["day_key"],
                        "at": int(r["received_at"]),
                        "supplier": r["supplier"],
                        "by": r["received_by"],
                        "witness": r["witness_by"],
                        "lines": r["lines_json"] or [],
                        "total": int(r["total"]),
                    }
                    for r in cur.fetchall()
                ]

                # Wastage
                cur.execute("SELECT * FROM wastage_reports ORDER BY reported_at DESC")
                wastage = []
                for r in cur.fetchall():
                    w: Dict[str, Any] = {
                        "id": r["id"],
                        "at": int(r["reported_at"]),
                        "kind": r["kind"],
                        "amount": int(r["amount"]),
                        "reason": r["reason"],
                        "by": r["reported_by"],
                        "photo": bool(r["photo"]),
                        "status": r["status"],
                    }
                    if r["menu_id"]:
                        w["menuId"] = r["menu_id"]
                        if r["kind"] == "seafood":
                            w["count"] = int(r["piece_count"])
                            w["kg"] = _flt(r["weight_kg"])
                    if r["bag_id"]:
                        w["bagId"] = r["bag_id"]
                    if r["qty"]:
                        w["qty"] = int(r["qty"])
                    if r.get("photo_url"):
                        w["photoUrl"] = r["photo_url"]
                    if r["resolved_by"]:
                        w["resolvedBy"] = r["resolved_by"]
                    if r["resolved_at"] is not None:
                        w["resolvedAt"] = int(r["resolved_at"])
                    wastage.append(w)

                # Counts
                cur.execute("SELECT * FROM stock_counts ORDER BY counted_at DESC")
                counts = [
                    {
                        "id": r["id"],
                        "dayKey": r["day_key"],
                        "at": int(r["counted_at"]),
                        "by": r["counted_by"],
                        "status": r["status"],
                        "locked": bool(r["locked"]),
                        "varianceStatus": r["variance_status"],
                        "varianceValue": int(r["variance_value"]),
                        "lines": r["lines_json"] or [],
                    }
                    for r in cur.fetchall()
                ]

                # Advances, deductions, tipPayouts, pgReturns
                cur.execute("SELECT * FROM salary_advances ORDER BY requested_at DESC")
                advances = [
                    {
                        "id": r["id"],
                        "staffId": r["staff_id"],
                        "amount": int(r["amount"]),
                        "reason": r["reason"] or "",
                        "at": int(r["requested_at"]),
                        "status": r["status"],
                        "approvedBy": r["approved_by"],
                        "paidAt": int(r["paid_at"]) if r["paid_at"] is not None else None,
                        "paidBy": r["paid_by"],
                    }
                    for r in cur.fetchall()
                ]

                cur.execute("SELECT * FROM salary_deductions ORDER BY created_at DESC")
                deductions = [
                    {
                        "id": r["id"],
                        "staffId": r["staff_id"],
                        "amount": int(r["amount"]),
                        "reason": r["reason"] or "",
                        "monthKey": r["month_key"],
                        "at": int(r["created_at"]),
                    }
                    for r in cur.fetchall()
                ]

                cur.execute("SELECT * FROM tip_payouts ORDER BY paid_at DESC")
                tip_payouts = [
                    {
                        "id": r["id"],
                        "at": int(r["paid_at"]),
                        "staffId": r["staff_id"],
                        "amount": int(r["amount"]),
                        "by": r["paid_by"],
                    }
                    for r in cur.fetchall()
                ]

                cur.execute("SELECT * FROM pg_returns ORDER BY returned_at DESC")
                pg_returns = [
                    {
                        "id": r["id"],
                        "dayKey": r["day_key"],
                        "at": int(r["returned_at"]),
                        "by": r["staff_id"],
                        "caps": r["caps_json"] or {},
                        "crates": int(r["crates"]),
                        "note": r["note"] or "",
                    }
                    for r in cur.fetchall()
                ]

                # Approvals
                cur.execute("SELECT * FROM approvals ORDER BY created_at DESC")
                approvals = []
                for r in cur.fetchall():
                    ap: Dict[str, Any] = {
                        "id": r["id"],
                        "type": r["approval_type"],
                        "status": r["status"],
                        "at": int(r["created_at"]),
                        "by": r["requested_by"],
                        "ref": r["ref_id"],
                        "title": r["title"],
                        "amount": int(r["amount"]),
                        "reason": r["reason"] or "",
                    }
                    if r["item_id"]:
                        ap["itemId"] = r["item_id"]
                    if r["minutes"] is not None:
                        ap["minutes"] = int(r["minutes"])
                    if r["photo"]:
                        ap["photo"] = True
                    if r.get("photo_url"):
                        ap["photoUrl"] = r["photo_url"]
                    if r["payload_json"]:
                        ap["payload"] = r["payload_json"]
                    if r["resolved_by"]:
                        ap["resolvedBy"] = r["resolved_by"]
                    if r["resolved_at"] is not None:
                        ap["resolvedAt"] = int(r["resolved_at"])
                    if r["resolve_note"]:
                        ap["resolveNote"] = r["resolve_note"]
                    approvals.append(ap)

                # Einvoices
                cur.execute("SELECT * FROM einvoices ORDER BY issued_at DESC")
                einvoices = [
                    {
                        "id": r["id"],
                        "saleId": r["sale_id"],
                        "taxCode": r["tax_code"],
                        "company": r["company"],
                        "address": r["address"] or "",
                        "email": r["email"],
                        "amount": int(r["amount"]),
                        "at": int(r["issued_at"]),
                        "status": r["status"],
                        "invoiceNo": r["invoice_no"],
                    }
                    for r in cur.fetchall()
                ]

                # Daily stats
                cur.execute("SELECT * FROM daily_stats ORDER BY day_key ASC")
                daily_stats = [
                    {
                        "dayKey": r["day_key"],
                        "revenue": int(r["revenue"]),
                        "food": int(r["food"]),
                        "alcohol": int(r["alcohol"]),
                        "cogs": int(r["cogs"]),
                        "vipFee": int(r["vip_fee"]),
                        "cash": int(r["cash"]),
                        "qr": int(r["qr"]),
                        "bills": int(r["bills"]),
                        "guests": int(r["guests"]),
                        "wastage": int(r["wastage"]),
                        "labor": int(r["labor"]),
                        "utility": int(r["utility"]),
                        "tips": int(r["tips"]),
                        "variance": int(r["variance"]),
                        "closedBy": r["closed_by"],
                        "locked": bool(r["locked"]),
                    }
                    for r in cur.fetchall()
                ]

                # Print logs
                cur.execute("SELECT doc_json FROM print_logs ORDER BY printed_at DESC")
                print_log = [r["doc_json"] for r in cur.fetchall()]

                # Audit logs
                cur.execute("SELECT logged_at, who, action_text FROM audit_logs ORDER BY id DESC LIMIT 500")
                audit = [{"at": int(r["logged_at"]), "who": r["who"], "text": r["action_text"]} for r in cur.fetchall()]

                # Config history
                cur.execute("SELECT * FROM config_history ORDER BY changed_at DESC")
                config_history = [
                    {
                        "id": r["id"],
                        "at": int(r["changed_at"]),
                        "by": r["changed_by"],
                        "effective": r["effective"],
                        "applyAt": int(r["apply_at"]) if r["apply_at"] is not None else None,
                        "appliedAt": int(r["applied_at"]) if r["applied_at"] is not None else None,
                        "note": r["note"] or "",
                        "changes": r["changes_json"] or [],
                        "before": r["before_json"] or {},
                        "after": r["after_json"] or {},
                    }
                    for r in cur.fetchall()
                ]

                # Notifications
                cur.execute("SELECT * FROM notifications ORDER BY created_at DESC")
                notifications = [
                    {
                        "id": r["id"],
                        "type": r["notif_type"],
                        "at": int(r["created_at"]),
                        "read": bool(r["is_read"]),
                        "ticketId": r["ticket_id"],
                        "waiterId": r["waiter_id"],
                        "text": r["message_text"],
                    }
                    for r in cur.fetchall()
                ]

                # Other income
                cur.execute("SELECT * FROM other_income ORDER BY id ASC")
                other_income = [
                    {"at": int(r["created_at"]), "dayKey": r["day_key"], "amount": int(r["amount"]), "reason": r["reason"]}
                    for r in cur.fetchall()
                ]

                # Tax locks
                cur.execute("SELECT month_key FROM tax_locks ORDER BY month_key ASC")
                tax_locks = [r["month_key"] for r in cur.fetchall()]

                # Payment webhooks
                cur.execute("SELECT payload_json FROM payment_webhooks ORDER BY received_at DESC LIMIT 200")
                webhook_logs = [r["payload_json"] for r in cur.fetchall() if r.get("payload_json")]

                data = {
                    "seededAt": seeded_at,
                    "staff": staff,
                    "attendance": attendance,
                    "tickets": tickets,
                    "stock": stock,
                    "tank": tank,
                    "drinks": drinks,
                    "shift": shift,
                    "shiftsHistory": shifts_history,
                    "bookings": bookings,
                    "bottleKeeps": bottle_keeps,
                    "dailyStats": daily_stats,
                    "sales": sales,
                    "wastage": wastage,
                    "advances": advances,
                    "counts": counts,
                    "approvals": approvals,
                    "receipts": receipts,
                    "tableState": table_state,
                    "einvoices": einvoices,
                    "pgReturns": pg_returns,
                    "printLog": print_log,
                    "audit": audit,
                    "configHistory": config_history,
                    "notifications": notifications,
                    "lastBillClosedAt": last_bill_closed_at,
                    "taxLocks": tax_locks,
                    "unpaidCustomerDebts": [],
                    "tipPayouts": tip_payouts,
                    "deductions": deductions,
                    "otherIncome": other_income,
                    "pendingConfig": pending_config,
                    "webhookLogs": webhook_logs,
                }
                return {
                    "version": version,
                    "revision": revision,
                    "config": cfg,
                    "data": data,
                }
        finally:
            conn.close()


def get_db_overview() -> Dict[str, Any]:
    """
    Tra ve thong tin chi tiet cac bang trong PostgreSQL va so luong ban ghi thuc te.
    """
    tables = [
        "system_config",
        "config_history",
        "areas",
        "restaurant_tables",
        "categories",
        "cooking_styles",
        "portion_bags",
        "brands",
        "menu_items",
        "promos",
        "printers",
        "work_shifts",
        "seafood_tank",
        "staff",
        "attendance",
        "bookings",
        "tickets",
        "ticket_items",
        "sales",
        "cash_shifts",
        "shifts_history",
        "bottle_keeps",
        "goods_receipts",
        "wastage_reports",
        "stock_counts",
        "salary_advances",
        "salary_deductions",
        "tip_payouts",
        "pg_returns",
        "approvals",
        "einvoices",
        "daily_stats",
        "print_logs",
        "audit_logs",
        "notifications",
        "other_income",
        "tax_locks",
        "payment_webhooks",
    ]
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT version(), current_database(), pg_database_size(current_database())")
            ver, dbname, dbsize = cur.fetchone()
            counts: Dict[str, int] = {}
            for tb in tables:
                cur.execute(f"SELECT COUNT(*) FROM {tb}")
                counts[tb] = int(cur.fetchone()[0])
            cur.execute("SELECT revision, updated_at, updated_by FROM system_config WHERE id = 1")
            sys_row = cur.fetchone()
            return {
                "engine": "PostgreSQL",
                "mode": _db_mode,
                "uri": get_masked_database_uri(),
                "database": dbname,
                "version": ver,
                "sizeBytes": int(dbsize),
                "revision": int(sys_row[0]) if sys_row else 0,
                "updatedAt": sys_row[1].isoformat() if sys_row and sys_row[1] else None,
                "updatedBy": sys_row[2] if sys_row else None,
                "tableCounts": counts,
                "totalTables": len(tables),
                "totalRows": sum(counts.values()),
            }
    finally:
        conn.close()


def execute_readonly_sql(query: str, params: Optional[Tuple[Any, ...]] = None) -> List[Dict[str, Any]]:
    """
    Chay truy van SELECT tren PostgreSQL (danh cho bao cao, kiem tra hoac tich hop BI).
    Chi cho phep SELECT / WITH.
    """
    q = (query or "").strip()
    first_word = q.split(None, 1)[0].upper() if q else ""
    if first_word not in ("SELECT", "WITH", "EXPLAIN"):
        raise ValueError("Chỉ cho phép truy vấn đọc dữ liệu (SELECT / WITH).")
    conn = get_connection()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(q, params)
            rows = cur.fetchall()
            out = []
            for r in rows:
                item = {}
                for k, v in r.items():
                    if isinstance(v, Decimal):
                        item[k] = float(v)
                    elif hasattr(v, "isoformat"):
                        item[k] = v.isoformat()
                    else:
                        item[k] = v
                out.append(item)
            return out
    finally:
        conn.close()
