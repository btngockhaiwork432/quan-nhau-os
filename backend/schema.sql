-- =========================================================================
-- QUAN NHAU OS - POSTGRESQL 16 RELATIONAL SCHEMA
-- Luu tru day du 32 bang quan he chuan hoa + JSONB cho cau hinh dong No-Code
-- =========================================================================

CREATE TABLE IF NOT EXISTS system_config (
    id              SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    revision        BIGINT NOT NULL DEFAULT 1,
    version         INTEGER NOT NULL DEFAULT 1,
    seeded_at       BIGINT NOT NULL DEFAULT 0,
    last_bill_closed_at BIGINT NOT NULL DEFAULT 0,
    config_json     JSONB NOT NULL,
    pending_config  JSONB,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by      TEXT DEFAULT 'system'
);

CREATE TABLE IF NOT EXISTS config_history (
    id              TEXT PRIMARY KEY,
    changed_at      BIGINT NOT NULL,
    changed_by      TEXT,
    effective       TEXT NOT NULL DEFAULT 'now',
    apply_at        BIGINT,
    applied_at      BIGINT,
    note            TEXT DEFAULT '',
    changes_json    JSONB NOT NULL DEFAULT '[]'::jsonb,
    before_json     JSONB NOT NULL,
    after_json      JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS areas (
    id              TEXT PRIMARY KEY,
    name            TEXT NOT NULL,
    sort_order      INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS restaurant_tables (
    id              TEXT PRIMARY KEY,
    code            TEXT NOT NULL,
    area_id         TEXT NOT NULL REFERENCES areas(id) ON DELETE CASCADE,
    seats           INTEGER NOT NULL DEFAULT 4,
    table_type      TEXT NOT NULL DEFAULT 'normal',
    pos_x           INTEGER NOT NULL DEFAULT 0,
    pos_y           INTEGER NOT NULL DEFAULT 0,
    clean_status    TEXT NOT NULL DEFAULT 'clean',
    dirty_since     BIGINT
);

CREATE TABLE IF NOT EXISTS categories (
    id              TEXT PRIMARY KEY,
    name            TEXT NOT NULL,
    kind            TEXT NOT NULL,
    vat_group       TEXT NOT NULL DEFAULT 'food',
    sort_order      INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS cooking_styles (
    id              TEXT PRIMARY KEY,
    name            TEXT NOT NULL,
    surcharge       BIGINT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS portion_bags (
    id              TEXT PRIMARY KEY,
    name            TEXT NOT NULL,
    item_group      TEXT NOT NULL DEFAULT 'meat',
    unit            TEXT NOT NULL DEFAULT 'túi',
    gram            INTEGER NOT NULL DEFAULT 0,
    min_stock       INTEGER NOT NULL DEFAULT 0,
    cost            BIGINT NOT NULL DEFAULT 0,
    stock_qty       INTEGER NOT NULL DEFAULT 0
);
ALTER TABLE portion_bags ADD COLUMN IF NOT EXISTS item_group TEXT NOT NULL DEFAULT 'meat';
ALTER TABLE portion_bags ADD COLUMN IF NOT EXISTS unit TEXT NOT NULL DEFAULT 'túi';

CREATE TABLE IF NOT EXISTS brands (
    id              TEXT PRIMARY KEY,
    name            TEXT NOT NULL,
    rebate_target   INTEGER NOT NULL DEFAULT 0,
    rebate_unit     TEXT NOT NULL DEFAULT 'thùng',
    rebate_period   TEXT NOT NULL DEFAULT 'quarter',
    rebate_amount   BIGINT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS menu_items (
    id              TEXT PRIMARY KEY,
    name            TEXT NOT NULL,
    category_id     TEXT NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
    kind            TEXT NOT NULL,
    price           BIGINT NOT NULL DEFAULT 0,
    cost            BIGINT NOT NULL DEFAULT 0,
    price_per_kg    BIGINT NOT NULL DEFAULT 0,
    cost_per_kg     BIGINT NOT NULL DEFAULT 0,
    unit            TEXT NOT NULL DEFAULT 'đĩa',
    case_size       INTEGER,
    brand_id        TEXT,
    active          BOOLEAN NOT NULL DEFAULT TRUE,
    popular         BOOLEAN NOT NULL DEFAULT FALSE,
    bottle_keep     BOOLEAN NOT NULL DEFAULT FALSE,
    upsell          BIGINT NOT NULL DEFAULT 0,
    upsell_per_kg   BIGINT NOT NULL DEFAULT 0,
    avg_kg_per_piece NUMERIC(10,3) DEFAULT 0,
    styles_json     JSONB NOT NULL DEFAULT '[]'::jsonb,
    bom_json        JSONB NOT NULL DEFAULT '[]'::jsonb,
    drink_stock     INTEGER
);

CREATE TABLE IF NOT EXISTS promos (
    id                  TEXT PRIMARY KEY,
    brand_id            TEXT NOT NULL,
    menu_id             TEXT NOT NULL,
    name                TEXT NOT NULL,
    buy_qty             INTEGER NOT NULL DEFAULT 10,
    free_qty            INTEGER NOT NULL DEFAULT 1,
    source              TEXT NOT NULL DEFAULT 'brand',
    require_cap_return  BOOLEAN NOT NULL DEFAULT TRUE,
    active              BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS printers (
    id              TEXT PRIMARY KEY,
    name            TEXT NOT NULL,
    location        TEXT NOT NULL DEFAULT '',
    purpose         TEXT NOT NULL DEFAULT 'kitchen',
    copies          INTEGER NOT NULL DEFAULT 1,
    online          BOOLEAN NOT NULL DEFAULT TRUE,
    backup_id       TEXT DEFAULT '',
    ip_address      TEXT NOT NULL DEFAULT '',
    port            INTEGER NOT NULL DEFAULT 9100,
    categories_json JSONB NOT NULL DEFAULT '[]'::jsonb
);

CREATE TABLE IF NOT EXISTS work_shifts (
    id              TEXT PRIMARY KEY,
    name            TEXT NOT NULL,
    segments_json   JSONB NOT NULL DEFAULT '[]'::jsonb
);

CREATE TABLE IF NOT EXISTS seafood_tank (
    menu_id         TEXT PRIMARY KEY,
    piece_count     INTEGER NOT NULL DEFAULT 0,
    weight_kg       NUMERIC(10,2) NOT NULL DEFAULT 0,
    items_json      JSONB NOT NULL DEFAULT '[]'::jsonb,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE seafood_tank ADD COLUMN IF NOT EXISTS items_json JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE TABLE IF NOT EXISTS staff (
    id              TEXT PRIMARY KEY,
    name            TEXT NOT NULL,
    role            TEXT NOT NULL,
    pin             TEXT NOT NULL,
    phone           TEXT DEFAULT '',
    pay_type        TEXT NOT NULL DEFAULT 'hourly',
    base_salary     BIGINT NOT NULL DEFAULT 0,
    hourly_rate     BIGINT NOT NULL DEFAULT 0,
    shift_id        TEXT DEFAULT '',
    brand_ids_json  JSONB NOT NULL DEFAULT '[]'::jsonb,
    active          BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS attendance (
    id              TEXT PRIMARY KEY,
    staff_id        TEXT NOT NULL,
    day_key         TEXT NOT NULL,
    segment         INTEGER NOT NULL DEFAULT 0,
    shift_id        TEXT DEFAULT '',
    check_in        BIGINT NOT NULL,
    check_out       BIGINT,
    method          TEXT NOT NULL DEFAULT 'kiosk',
    late_min        INTEGER NOT NULL DEFAULT 0,
    selfie          BOOLEAN NOT NULL DEFAULT TRUE,
    selfie_url      TEXT,
    gps_meters      INTEGER,
    client_ip       TEXT,
    ot_pending_min  INTEGER NOT NULL DEFAULT 0,
    ot_approved_min INTEGER NOT NULL DEFAULT 0,
    ot_auto_min     INTEGER NOT NULL DEFAULT 0,
    ot_status       TEXT NOT NULL DEFAULT 'none',
    off_schedule    BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS idx_attendance_staff_day ON attendance(staff_id, day_key);

CREATE TABLE IF NOT EXISTS bookings (
    id              TEXT PRIMARY KEY,
    code            TEXT,
    customer_name   TEXT NOT NULL,
    phone           TEXT NOT NULL,
    day_key         TEXT NOT NULL,
    booking_time    TEXT NOT NULL,
    guests          INTEGER NOT NULL DEFAULT 2,
    area_id         TEXT NOT NULL,
    table_id        TEXT NOT NULL,
    deposit         BIGINT NOT NULL DEFAULT 0,
    deposit_paid    BOOLEAN NOT NULL DEFAULT FALSE,
    deposit_status  TEXT,
    status          TEXT NOT NULL DEFAULT 'holding',
    created_at      BIGINT NOT NULL,
    hold_until      BIGINT,
    paid_at         BIGINT,
    note            TEXT DEFAULT '',
    source          TEXT DEFAULT 'web',
    cancel_reason   TEXT DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_bookings_day_table ON bookings(day_key, table_id);

CREATE TABLE IF NOT EXISTS tickets (
    id                   TEXT PRIMARY KEY,
    table_id             TEXT NOT NULL,
    status               TEXT NOT NULL DEFAULT 'open',
    guests               INTEGER NOT NULL DEFAULT 2,
    opened_at            BIGINT NOT NULL,
    closed_at            BIGINT,
    waiter_id            TEXT,
    booking_id           TEXT,
    deposit              BIGINT NOT NULL DEFAULT 0,
    prebill_at           BIGINT,
    prebill_by           TEXT,
    prebill_count        INTEGER NOT NULL DEFAULT 0,
    prebill_requested_at BIGINT,
    prebill_requested_by TEXT,
    unlock_count         INTEGER NOT NULL DEFAULT 0,
    part                 INTEGER,
    split_from           TEXT,
    discount_json        JSONB,
    payments_json        JSONB NOT NULL DEFAULT '[]'::jsonb,
    sale_id              TEXT
);
CREATE INDEX IF NOT EXISTS idx_tickets_table_status ON tickets(table_id, status);

CREATE TABLE IF NOT EXISTS ticket_items (
    id              TEXT PRIMARY KEY,
    ticket_id       TEXT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    sort_idx        INTEGER NOT NULL DEFAULT 0,
    menu_id         TEXT NOT NULL,
    name            TEXT NOT NULL,
    qty             INTEGER NOT NULL DEFAULT 1,
    piece_count     INTEGER NOT NULL DEFAULT 0,
    weight_kg       NUMERIC(10,2) NOT NULL DEFAULT 0,
    price           BIGINT NOT NULL DEFAULT 0,
    price_per_kg    BIGINT,
    style_id        TEXT,
    note            TEXT DEFAULT '',
    added_by        TEXT,
    sent_at         BIGINT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'sent',
    is_free         BOOLEAN NOT NULL DEFAULT FALSE,
    promo_id        TEXT,
    weighed_at      BIGINT,
    weighed_by      TEXT,
    void_reason     TEXT,
    void_by         TEXT,
    void_requested  BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS idx_ticket_items_ticket ON ticket_items(ticket_id, sort_idx);

CREATE TABLE IF NOT EXISTS sales (
    id              TEXT PRIMARY KEY,
    ticket_id       TEXT NOT NULL,
    table_id        TEXT NOT NULL,
    table_code      TEXT NOT NULL,
    opened_at       BIGINT NOT NULL,
    closed_at       BIGINT NOT NULL,
    day_key         TEXT NOT NULL,
    shift_id        TEXT,
    waiter_id       TEXT,
    cashier_id      TEXT,
    guests          INTEGER NOT NULL DEFAULT 2,
    subtotal        BIGINT NOT NULL DEFAULT 0,
    vip_fee         BIGINT NOT NULL DEFAULT 0,
    discount        BIGINT NOT NULL DEFAULT 0,
    deposit         BIGINT NOT NULL DEFAULT 0,
    grand           BIGINT NOT NULL DEFAULT 0,
    vat_total       BIGINT NOT NULL DEFAULT 0,
    cost            BIGINT NOT NULL DEFAULT 0,
    received        BIGINT NOT NULL DEFAULT 0,
    change_amt      BIGINT NOT NULL DEFAULT 0,
    tip             BIGINT NOT NULL DEFAULT 0,
    tip_staff_id    TEXT,
    unlock_count    INTEGER NOT NULL DEFAULT 0,
    receipt_printed BOOLEAN NOT NULL DEFAULT FALSE,
    lines_json      JSONB NOT NULL DEFAULT '[]'::jsonb,
    payments_json   JSONB NOT NULL DEFAULT '[]'::jsonb,
    vat_json        JSONB NOT NULL DEFAULT '{}'::jsonb,
    einvoice_json   JSONB
);
CREATE INDEX IF NOT EXISTS idx_sales_day_key ON sales(day_key);
CREATE INDEX IF NOT EXISTS idx_sales_shift_id ON sales(shift_id);

CREATE TABLE IF NOT EXISTS cash_shifts (
    id                  TEXT PRIMARY KEY,
    day_key             TEXT NOT NULL,
    cashier_id          TEXT NOT NULL,
    opened_at           BIGINT NOT NULL,
    closed_at           BIGINT,
    opening_cash        BIGINT NOT NULL DEFAULT 0,
    status              TEXT NOT NULL DEFAULT 'open',
    auto_locked_at      BIGINT,
    is_current          BOOLEAN NOT NULL DEFAULT FALSE,
    petty_json          JSONB NOT NULL DEFAULT '[]'::jsonb,
    tips_paid_json      JSONB NOT NULL DEFAULT '[]'::jsonb,
    advances_paid_json  JSONB NOT NULL DEFAULT '[]'::jsonb,
    denominations_json  JSONB,
    z_report_json       JSONB
);

CREATE TABLE IF NOT EXISTS shifts_history (
    id              TEXT PRIMARY KEY,
    shift_id        TEXT NOT NULL,
    day_key         TEXT NOT NULL,
    opened_at       BIGINT NOT NULL,
    closed_at       BIGINT NOT NULL,
    cashier_id      TEXT,
    closed_by       TEXT,
    opening         BIGINT NOT NULL DEFAULT 0,
    cash            BIGINT NOT NULL DEFAULT 0,
    qr              BIGINT NOT NULL DEFAULT 0,
    card            BIGINT NOT NULL DEFAULT 0,
    petty           BIGINT NOT NULL DEFAULT 0,
    tips_paid       BIGINT NOT NULL DEFAULT 0,
    advances_paid   BIGINT NOT NULL DEFAULT 0,
    expected        BIGINT NOT NULL DEFAULT 0,
    counted         BIGINT NOT NULL DEFAULT 0,
    variance        BIGINT NOT NULL DEFAULT 0,
    note            TEXT DEFAULT '',
    bills           INTEGER NOT NULL DEFAULT 0,
    revenue         BIGINT NOT NULL DEFAULT 0,
    denominations_json JSONB,
    vat_json        JSONB,
    locked          BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS bottle_keeps (
    id              TEXT PRIMARY KEY,
    code            TEXT NOT NULL,
    phone           TEXT NOT NULL,
    customer_name   TEXT NOT NULL DEFAULT '',
    wine            TEXT NOT NULL,
    remaining_pct   INTEGER NOT NULL DEFAULT 50,
    created_at      BIGINT NOT NULL,
    expires_at      BIGINT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'kept',
    created_by      TEXT,
    table_id        TEXT
);
CREATE INDEX IF NOT EXISTS idx_bottle_keeps_phone ON bottle_keeps(phone);

CREATE TABLE IF NOT EXISTS goods_receipts (
    id              TEXT PRIMARY KEY,
    day_key         TEXT NOT NULL,
    received_at     BIGINT NOT NULL,
    supplier        TEXT NOT NULL,
    received_by     TEXT NOT NULL,
    witness_by      TEXT NOT NULL,
    total           BIGINT NOT NULL DEFAULT 0,
    lines_json      JSONB NOT NULL DEFAULT '[]'::jsonb
);

CREATE TABLE IF NOT EXISTS wastage_reports (
    id              TEXT PRIMARY KEY,
    reported_at     BIGINT NOT NULL,
    menu_id         TEXT,
    bag_id          TEXT,
    kind            TEXT NOT NULL,
    piece_count     INTEGER NOT NULL DEFAULT 0,
    weight_kg       NUMERIC(10,2) NOT NULL DEFAULT 0,
    qty             INTEGER NOT NULL DEFAULT 0,
    amount          BIGINT NOT NULL DEFAULT 0,
    reason          TEXT NOT NULL,
    reported_by     TEXT NOT NULL,
    photo           BOOLEAN NOT NULL DEFAULT TRUE,
    status          TEXT NOT NULL DEFAULT 'pending',
    resolved_by     TEXT,
    resolved_at     BIGINT
);

CREATE TABLE IF NOT EXISTS stock_counts (
    id              TEXT PRIMARY KEY,
    day_key         TEXT NOT NULL,
    counted_at      BIGINT NOT NULL,
    counted_by      TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'submitted',
    locked          BOOLEAN NOT NULL DEFAULT TRUE,
    variance_status TEXT NOT NULL DEFAULT 'ok',
    variance_value  BIGINT NOT NULL DEFAULT 0,
    lines_json      JSONB NOT NULL DEFAULT '[]'::jsonb
);

CREATE TABLE IF NOT EXISTS salary_advances (
    id              TEXT PRIMARY KEY,
    staff_id        TEXT NOT NULL,
    amount          BIGINT NOT NULL,
    reason          TEXT DEFAULT '',
    requested_at    BIGINT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'pending',
    approved_by     TEXT,
    paid_at         BIGINT,
    paid_by         TEXT
);

CREATE TABLE IF NOT EXISTS salary_deductions (
    id              TEXT PRIMARY KEY,
    staff_id        TEXT NOT NULL,
    amount          BIGINT NOT NULL,
    reason          TEXT DEFAULT '',
    month_key       TEXT NOT NULL,
    created_at      BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS tip_payouts (
    id              TEXT PRIMARY KEY,
    paid_at         BIGINT NOT NULL,
    staff_id        TEXT NOT NULL,
    amount          BIGINT NOT NULL,
    paid_by         TEXT
);

CREATE TABLE IF NOT EXISTS pg_returns (
    id              TEXT PRIMARY KEY,
    day_key         TEXT NOT NULL,
    returned_at     BIGINT NOT NULL,
    staff_id        TEXT NOT NULL,
    crates          INTEGER NOT NULL DEFAULT 0,
    note            TEXT DEFAULT '',
    caps_json       JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS approvals (
    id              TEXT PRIMARY KEY,
    approval_type   TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'pending',
    created_at      BIGINT NOT NULL,
    requested_by    TEXT NOT NULL,
    ref_id          TEXT,
    item_id         TEXT,
    title           TEXT NOT NULL,
    amount          BIGINT NOT NULL DEFAULT 0,
    minutes         INTEGER,
    reason          TEXT DEFAULT '',
    photo           BOOLEAN NOT NULL DEFAULT FALSE,
    payload_json    JSONB,
    resolved_by     TEXT,
    resolved_at     BIGINT,
    resolve_note    TEXT DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_approvals_status ON approvals(status);

CREATE TABLE IF NOT EXISTS einvoices (
    id              TEXT PRIMARY KEY,
    sale_id         TEXT,
    tax_code        TEXT NOT NULL,
    company         TEXT NOT NULL,
    address         TEXT DEFAULT '',
    email           TEXT NOT NULL,
    amount          BIGINT NOT NULL DEFAULT 0,
    issued_at       BIGINT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'issued',
    invoice_no      TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS daily_stats (
    day_key         TEXT PRIMARY KEY,
    revenue         BIGINT NOT NULL DEFAULT 0,
    food            BIGINT NOT NULL DEFAULT 0,
    alcohol         BIGINT NOT NULL DEFAULT 0,
    cogs            BIGINT NOT NULL DEFAULT 0,
    vip_fee         BIGINT NOT NULL DEFAULT 0,
    cash            BIGINT NOT NULL DEFAULT 0,
    qr              BIGINT NOT NULL DEFAULT 0,
    bills           INTEGER NOT NULL DEFAULT 0,
    guests          INTEGER NOT NULL DEFAULT 0,
    wastage         BIGINT NOT NULL DEFAULT 0,
    labor           BIGINT NOT NULL DEFAULT 0,
    utility         BIGINT NOT NULL DEFAULT 0,
    tips            BIGINT NOT NULL DEFAULT 0,
    variance        BIGINT NOT NULL DEFAULT 0,
    closed_by       TEXT,
    locked          BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS print_logs (
    id                  TEXT PRIMARY KEY,
    printed_at          BIGINT NOT NULL,
    printer_id          TEXT NOT NULL,
    printer_name        TEXT NOT NULL,
    kind                TEXT NOT NULL,
    title               TEXT NOT NULL,
    rerouted            TEXT,
    failed              BOOLEAN NOT NULL DEFAULT FALSE,
    printed_physical    BOOLEAN NOT NULL DEFAULT FALSE,
    printed_physical_at BIGINT,
    doc_json            JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id              BIGSERIAL PRIMARY KEY,
    logged_at       BIGINT NOT NULL,
    who             TEXT NOT NULL DEFAULT 'system',
    action_text     TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS notifications (
    id              TEXT PRIMARY KEY,
    notif_type      TEXT NOT NULL,
    created_at      BIGINT NOT NULL,
    is_read         BOOLEAN NOT NULL DEFAULT FALSE,
    ticket_id       TEXT,
    waiter_id       TEXT,
    message_text    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS other_income (
    id              BIGSERIAL PRIMARY KEY,
    created_at      BIGINT NOT NULL,
    day_key         TEXT NOT NULL,
    amount          BIGINT NOT NULL,
    reason          TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tax_locks (
    month_key       TEXT PRIMARY KEY,
    locked_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
