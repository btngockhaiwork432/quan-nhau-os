/* =========================================================================
   Giao dien 6 - CHU QUAN VA KE TOAN (laptop + dien thoai)
   Route: #/owner/<trang>. Desktop: thanh dieu huong trai. Dien thoai (<960px):
   5 muc o day man hinh + muc "Them".
   Trang: overview | approvals | sales | inventory | hr | tax | rebate | settings
   Trang Cai dat do owner-settings.js dang ky qua window.OwnerPages.settings.
   ========================================================================= */
(function () {
  const I = U.icon, esc = U.esc;
  const P = "owner";
  window.OwnerPages = window.OwnerPages || {};
  // Quyen chinh sua cai dat (trang Cai dat dung ham nay, co fallback rieng)
  App.ownerCanEdit = () => App.role() === "owner" || Engine.can("accountant", "editSettings");

  const S = () => App.state(P, { range: "today", appTab: "pending", appScope: "all", appType: "all", sel: {}, salesTab: "pl", invTab: "recon", invDay: "", month: "", chart: "", _rejDeduct: false });
  const D = () => Store.data;
  const C = () => Store.config;

  const NAV = [
    { id: "overview", label: "Tổng quan", short: "Tổng quan", icon: "gauge", desc: "Số liệu hôm nay, việc cần duyệt, cảnh báo" },
    { id: "approvals", label: "Phê duyệt", short: "Phê duyệt", icon: "circle-check", desc: "Mở khóa bill, hao hụt, ứng lương, tăng ca" },
    { id: "sales", label: "Bán hàng và lãi lỗ", short: "Bán hàng", icon: "chart-line", desc: "Doanh thu, giá vốn, lãi lỗ, chống thất thoát" },
    { id: "inventory", label: "Kho và đối soát", short: "Kho", icon: "package", desc: "Đối soát 4 lớp, tồn kho, hao hụt, kiểm kho" },
    { id: "hr", label: "Nhân sự và lương", short: "Nhân sự", icon: "users", desc: "Bảng lương tạm tính, chấm công, ứng lương" },
    { id: "tax", label: "Thuế và hóa đơn", short: "Thuế", icon: "receipt-text", desc: "Bảng kê doanh thu, thuế, hóa đơn điện tử" },
    { id: "rebate", label: "Thưởng hãng và chi phí", short: "Thưởng hãng", icon: "hand-coins", desc: "Tiến độ thưởng sản lượng bia, chi phí phụ phẩm" },
  ];
  const SETTINGS = { id: "settings", label: "Cài đặt", short: "Cài đặt", icon: "settings", desc: "Bàn, thực đơn, ca làm, lương, thuế, phân quyền" };
  const MOBILE_MAIN = ["overview", "approvals", "sales", "inventory"];
  const PAGE_IDS = NAV.map((n) => n.id).concat(["settings"]);
  const navOf = (id) => NAV.concat([SETTINGS]).find((n) => n.id === id) || NAV[0];

  const RANGES = [
    { value: "today", label: "Hôm nay" },
    { value: "7d", label: "7 ngày" },
    { value: "month", label: "Tháng này" },
    { value: "lastmonth", label: "Tháng trước" },
  ];
  const TYPE_TONE = { unlock_bill: "danger", void_item: "danger", discount: "warning", wastage: "warning", advance: "primary", overtime: "info", count_variance: "danger", noshow_deposit: "violet" };
  const LOW_RISK_TYPES = ["wastage", "overtime", "void_item"];

  /* ======================= TIEN ICH ======================= */
  const pct = (a, b) => (b ? (a / b) * 100 : 0);
  const shiftKey = (key, d) => U.dayKey(U.dayStart(key) + d * 86400000 + 6 * 3600000);
  const daysBetween = (a, b) => Math.round((U.dayStart(b) - U.dayStart(a)) / 86400000) + 1;
  const NB = "\u00a0";
  function ago(ts) {
    const m = Math.floor((Date.now() - ts) / 60000);
    if (m < 1) return "vừa xong";
    if (m < 60) return m + " phút trước";
    const h = Math.floor(m / 60);
    if (h < 24) return h + " giờ trước";
    const d = Math.floor(h / 24);
    if (d < 7) return d + " ngày trước";
    return U.date(ts);
  }
  function delta(cur, prev, invert) {
    if (!prev) return '<span class="muted">chưa có số liệu so sánh</span>';
    const d = ((cur - prev) / Math.abs(prev)) * 100;
    const good = invert ? d <= 0 : d >= 0;
    return '<span class="' + (good ? "delta-up" : "delta-down") + '">' + (d >= 0 ? "+" : "") + U.pct(d) + "</span>";
  }
  const typeInfo = (t) => Engine.APPROVAL_TYPES[t] || { label: t, icon: "circle-alert" };
  const roleOf = (id) => { const s = Engine.staff(id); return s ? Engine.roleLabel(s.role) : id === "system" ? "Tự động" : ""; };
  const ckg = (count, kg) => (count || kg ? (count ? U.num(count) + " con · " : "") + U.kg(kg || 0) : "-");
  const signed = (n, fmt) => (n > 0 ? "+" : n < 0 ? "-" : "") + fmt(Math.abs(n));

  function head(title, desc, right) {
    return '<div class="page-head"><div class="ph-text"><h1>' + esc(title) + '</h1><div class="desc">' + desc + "</div></div>" + (right ? '<div class="ph-tools">' + right + "</div>" : "") + "</div>";
  }
  function summary(html, tone) {
    return '<div class="summary-line' + (tone ? " sl-" + tone : "") + '">' + I(tone === "warning" ? "triangle-alert" : tone === "success" ? "circle-check" : "info") + "<div>" + html + "</div></div>";
  }
  // o: {icon, sub, right, flush, cls}
  function card(title, body, o) {
    o = o || {};
    return '<section class="card ' + (o.cls || "") + '"><div class="card-head"><div class="ch-title">' + (o.icon ? '<span class="ch-icon">' + I(o.icon) + "</span>" : "") + "<div><h3>" + esc(title) + "</h3>" + (o.sub ? '<div class="sub">' + o.sub + "</div>" : "") + "</div></div>" + (o.right ? '<div class="ch-right">' + o.right + "</div>" : "") + "</div>" + (o.flush ? body : '<div class="card-body">' + body + "</div>") + "</section>";
  }
  function tbl(headHtml, rowsHtml, footHtml, cls) {
    return '<div class="table-wrap"><table class="dt ' + (cls || "") + '"><thead><tr>' + headHtml + "</tr></thead><tbody>" + rowsHtml + "</tbody>" + (footHtml ? "<tfoot><tr>" + footHtml + "</tr></tfoot>" : "") + "</table></div>";
  }
  function tabs(options, active, act) {
    return '<div class="otabs" role="tablist">' + options.map((o) => '<button type="button" role="tab" class="' + (o.value === active ? "active" : "") + '" data-act="' + act + '" data-value="' + esc(o.value) + '">' + (o.icon ? I(o.icon) : "") + "<span>" + esc(o.label) + "</span>" + (o.count ? ' <span class="count">' + o.count + "</span>" : "") + "</button>").join("") + "</div>";
  }
  function statRows(rows) {
    return '<div class="stat-rows">' + rows.map((r) => '<div class="sr' + (r.cls ? " " + r.cls : "") + '"><span>' + r.l + '</span><span class="num">' + r.v + "</span></div>").join("") + "</div>";
  }

  /* ---------- Bo loc thoi gian thong nhat ---------- */
  function range() {
    const st = S();
    if (!RANGES.some((r) => r.value === st.range)) st.range = "today";
    const [from, to] = Engine.rangeKeys(st.range);
    const label = st.range === "today" ? "Hôm nay" : st.range === "7d" ? "7 ngày qua" : U.monthLabel(from);
    return { from, to, n: daysBetween(from, to), label, preset: st.range };
  }
  function prevRange(r) {
    let out;
    if (r.preset === "month" || r.preset === "lastmonth") {
      const d = new Date(U.dayStart(r.from));
      const from = U.dayKey(new Date(d.getFullYear(), d.getMonth() - 1, 1, 12).getTime());
      let to = U.dayKey(new Date(d.getFullYear(), d.getMonth(), 0, 12).getTime());
      if (r.preset === "month") { const t2 = shiftKey(from, r.n - 1); if (t2 < to) to = t2; }
      out = { from, to };
    } else out = { from: shiftKey(r.from, -r.n), to: shiftKey(r.to, -r.n) };
    out.label = r.preset === "today" ? "cả ngày hôm qua" : r.preset === "7d" ? "7 ngày trước đó" : r.preset === "month" ? "cùng kỳ tháng trước" : "tháng trước đó";
    return out;
  }
  const rangeSeg = () => '<div class="range-seg">' + UI.seg(RANGES, S().range, "owner.range") + "</div>";

  /* ---------- Thang ---------- */
  function months() {
    const set = new Set(D().dailyStats.map((d) => d.dayKey.slice(0, 7)));
    set.add(U.monthKey());
    return Array.from(set).sort().reverse();
  }
  function curMonth() {
    const st = S();
    const ms = months();
    if (!ms.includes(st.month)) st.month = ms[0];
    return st.month;
  }
  const monthSelect = () => UI.select({ id: "owner-month", options: months().map((m) => ({ value: m, label: U.monthLabel(m) })), value: curMonth(), change: "owner.month", cls: "select-auto" });
  function dayOptions(n) {
    const out = [];
    const seen = new Set();
    for (let i = 0; i < n; i++) {
      const k = U.dayKey(Date.now() - i * 86400000);
      if (seen.has(k)) continue;
      seen.add(k);
      out.push({ value: k, label: (i === 0 ? "Hôm nay" : i === 1 ? "Hôm qua" : U.weekday(U.dayStart(k))) + ", " + U.dayLabel(k) });
    }
    return out;
  }

  /* ---------- Bieu do ---------- */
  function hourChart(key, height) {
    const by = Engine.revenueByHour(key);
    const open = Math.floor(U.minutesOf(C().store.openTime || "15:00") / 60);
    let close = Math.floor(U.minutesOf(C().store.closeTime || "00:00") / 60);
    if (close <= open) close += 24;
    const hrs = Object.keys(by).map(Number).map((h) => (h < U.CUTOFF_HOUR ? h + 24 : h));
    let nowH = new Date().getHours();
    if (nowH < U.CUTOFF_HOUR) nowH += 24;
    const isToday = key === U.dayKey();
    const start = Math.min.apply(null, [open].concat(hrs));
    const end = Math.max.apply(null, [close - 1].concat(hrs, isToday && nowH >= open ? [nowH] : []));
    const data = [];
    for (let h = start; h <= end; h++) {
      const v = by[h % 24] || 0;
      data.push({ label: (h % 24) + "h", value: v, hl: isToday && h === nowH, tip: U.pad(h % 24) + ":00 · " + U.money(v) });
    }
    return UI.barChart(data, { height: height || 200 });
  }
  function dailyChart(days, height, field) {
    field = field || "revenue";
    const n = days.length;
    const step = n > 16 ? Math.ceil(n / 12) : 1;
    return UI.barChart(days.map((d, i) => ({ label: (n - 1 - i) % step === 0 ? U.dateShort(U.dayStart(d.dayKey)) : NB, value: d[field] || 0, hl: !!d.live, tip: U.dayLabel(d.dayKey) + " · " + U.money(d[field] || 0) + (d.live ? " (đang bán)" : "") })), { height: height || 200 });
  }

  /* ======================= THE PHE DUYET ======================= */
  function bulkCap() {
    return Number(U.get(C(), "approvals.bulkMaxAmount")) || Number(U.get(C(), "permissions.cashier.approveWasteUnder")) || 0;
  }
  const isLowRisk = (ap) => ap.status === "pending" && LOW_RISK_TYPES.includes(ap.type) && (Number(ap.amount) || 0) <= bulkCap();
  function amountOf(ap) {
    if (ap.amount) return ap.amount;
    if (ap.type === "unlock_bill" || ap.type === "discount" || ap.type === "void_item") {
      const tk = Engine.ticket(ap.ref);
      if (tk) return Engine.totals(tk).grand;
    }
    return 0;
  }
  function noPermText() {
    const me = App.me();
    return "Tài khoản " + Engine.roleLabel(me.role) + " chỉ có quyền xem. Chủ quán có thể cấp quyền duyệt trong Cài đặt, mục Nhân viên và phân quyền.";
  }
  function resultBadge(ap) {
    if (ap.status === "pending") return UI.badge("Chờ duyệt", "warning", true);
    if (ap.status === "approved") {
      if (ap.type === "count_variance") {
        const c = D().counts.find((x) => x.id === ap.ref);
        if (c && c.varianceStatus === "deducted") return UI.badge("Đã trừ lương", "danger", true);
        return UI.badge("Chấp nhận hao hụt", "success", true);
      }
      if (ap.type === "noshow_deposit") return UI.badge("Giữ tiền cọc", "success", true);
      return UI.badge("Đã duyệt", "success", true);
    }
    if (ap.type === "noshow_deposit") return UI.badge("Hoàn cọc", "", true);
    return UI.badge("Từ chối", "danger", true);
  }
  // o: {compact, bulk, selected}
  function apprCard(ap, o) {
    o = o || {};
    const me = App.me();
    const t = typeInfo(ap.type);
    const can = Engine.canApprove(me.id, ap);
    const dis = !can;
    const why = can ? "" : noPermText();
    const amt = amountOf(ap);
    const pending = ap.status === "pending";
    const b = (label, act, kind, data, title) => UI.btn(label, { act, kind, size: "sm", data: Object.assign({ id: ap.id }, data || {}), disabled: dis, title: dis ? why : title || "" });
    let actions = "";
    if (!pending) actions = resultBadge(ap);
    else if (ap.type === "count_variance") actions = b("Từ chối", "owner.reject", "danger", null, "Yêu cầu kiểm lại") + b("Trừ lương người kiểm", "owner.approve", "", { deduct: "1" }) + b("Chấp nhận hao hụt", "owner.approve", "primary");
    else if (ap.type === "noshow_deposit") actions = b("Hoàn cọc", "owner.reject", "danger") + b("Giữ tiền cọc", "owner.approve", "primary");
    else actions = b("Từ chối", "owner.reject", "danger") + b(ap.type === "advance" ? "Duyệt ứng" : "Duyệt", "owner.approve", "primary");
    const low = o.bulk && isLowRisk(ap) && can;
    const viewBill = (ap.type === "unlock_bill" || ap.type === "void_item" || ap.type === "discount" || ap.type === "seafood_bargain") && Engine.ticket(ap.ref);
    const tierMeta = Engine.approvalTierMeta ? Engine.approvalTierMeta(ap) : null;
    const meta = [t.label, esc(Engine.staffName(ap.by)) + (roleOf(ap.by) && ap.by !== "system" ? " (" + esc(roleOf(ap.by)) + ")" : ""), '<span title="' + esc(U.dateTime(ap.at)) + '">' + U.time(ap.at) + " · " + ago(ap.at) + "</span>"];
    return '<div class="appr ' + (o.compact ? "appr-compact " : "") + (o.selected ? "appr-selected" : "") + '">' +
      (o.bulk ? '<div class="ap-check">' + (low ? '<input type="checkbox" aria-label="Chọn để duyệt hàng loạt" data-change="owner.sel" data-id="' + ap.id + '"' + (o.selected ? " checked" : "") + ">" : "") + "</div>" : "") +
      '<div class="ap-icon tone-' + (TYPE_TONE[ap.type] || "") + '">' + I(t.icon) + "</div>" +
      '<div class="ap-main">' +
      '<div class="ap-top"><span class="ap-title">' + esc(ap.title) + "</span>" + (amt ? '<span class="ap-amount num">' + U.money(amt) + "</span>" : "") + "</div>" +
      '<div class="ap-meta">' + meta.join(" · ") + (tierMeta ? " · " + UI.badge(tierMeta.badgeLabel, tierMeta.badgeTone) : "") + (o.bulk && isLowRisk(ap) ? " · " + UI.badge("Rủi ro thấp", "success") : "") + "</div>" +
      (ap.reason ? '<div class="ap-reason">Lý do: ' + esc(ap.reason) + "</div>" : "") +
      (ap.photo || ap.type === "wastage" || viewBill ? '<div class="ap-extra">' +
        (ap.photo || ap.type === "wastage" ? '<button type="button" class="photo-thumb" data-act="owner.photo" data-id="' + ap.id + '" title="Xem ảnh bằng chứng">' + I("image") + "</button>" : "") +
        (viewBill ? UI.btn("Xem bill", { size: "sm", kind: "ghost", icon: "eye", act: "owner.viewTicket", data: { ref: ap.ref } }) : "") + "</div>" : "") +
      (!pending && ap.resolvedBy ? '<div class="ap-meta">Xử lý bởi ' + esc(Engine.staffName(ap.resolvedBy)) + " lúc " + U.dateTime(ap.resolvedAt) + (ap.resolveNote ? " · " + esc(ap.resolveNote) : "") + "</div>" : "") +
      (pending && !can ? '<div class="ap-note">' + I("lock", "ic-sm") + "<span>" + esc(why) + "</span></div>" : "") +
      "</div>" +
      '<div class="ap-actions">' + actions + "</div></div>";
  }

  /* ======================= 1. TONG QUAN ======================= */
  function pageOverview() {
    const st = S();
    const today = U.dayKey();
    const yKey = shiftKey(today, -1);
    const live = Engine.liveDay(today);
    const y = Engine.days(yKey, yKey)[0] || null;
    const pend = Engine.pendingApprovals();
    const ownerPend = Engine.pendingApprovalsByTier ? Engine.pendingApprovalsByTier("owner") : pend;
    const cashierPend = Engine.pendingApprovalsByTier ? Engine.pendingApprovalsByTier("cashier") : [];
    const prioritizedPend = ownerPend.concat(cashierPend);
    const alerts = Engine.alerts();
    const dangerN = alerts.filter((a) => a.level === "danger").length;
    const margin = pct(live.gross, live.revenue);
    const oldest = (ownerPend[0] ? ownerPend : pend).slice().sort((a, b) => a.at - b.at)[0];

    const kpis = '<div class="grid-4 owner-kpis">' +
      UI.kpi({ label: "Doanh thu hôm nay", icon: "banknote", value: U.money(live.revenue), meta: y && y.revenue ? "Bằng " + U.pct(pct(live.revenue, y.revenue), 0) + " cả ngày hôm qua (" + U.moneyShort(y.revenue) + ")" : U.num(live.bills) + " bill đã thanh toán" }) +
      UI.kpi({ label: "Lãi gộp ước tính", icon: "trending-up", value: U.money(live.gross), meta: "Biên lãi gộp " + U.pct(margin) + " · giá vốn " + U.moneyShort(live.cogs), tone: live.revenue && margin < Number(C().marginAlert) ? "warn" : "" }) +
      UI.kpi({ label: "Vấn đề lớn chờ Chủ quán", icon: "circle-check", value: U.num(ownerPend.length) + " việc lớn", meta: cashierPend.length ? "+ " + cashierPend.length + " việc nhỏ đã phân quyền Quản lý ca" : oldest ? "Lâu nhất " + ago(oldest.at) : "Không có việc tồn đọng", act: "owner.nav", data: { page: "approvals" }, tone: ownerPend.length ? "warn" : "good" }) +
      UI.kpi({ label: "Cảnh báo bất thường", icon: "triangle-alert", value: U.num(alerts.length), meta: alerts.length ? dangerN + " nghiêm trọng · " + (alerts.length - dangerN) + " cần theo dõi" : "Vận hành bình thường", tone: dangerN ? "alert" : alerts.length ? "warn" : "good" }) +
      "</div>";

    const apCard = card(
      "Vấn đề lớn cần Chủ quán quyết",
      prioritizedPend.length
        ? '<div class="appr-list">' + prioritizedPend.slice(0, 5).map((a) => apprCard(a, { compact: true })).join("") + "</div>"
        : UI.empty("circle-check", "Không có vấn đề lớn chờ Chủ quán", "Các việc thường ngày do Thu ngân kiêm Quản lý xử lý trực tiếp tại quầy."),
      {
        icon: "circle-check",
        flush: true,
        sub: pend.length
          ? ownerPend.length + " vấn đề lớn · " + cashierPend.length + " việc thường ngày (Thu ngân kiêm Quản lý)"
          : "Đã xử lý hết",
        right: pend.length ? UI.btn("Xem tất cả (" + pend.length + ")", { size: "sm", act: "owner.nav", data: { page: "approvals" } }) : "",
      }
    );
    const alCard = card("Cảnh báo bất thường", alerts.length ? '<div class="alert-list">' + alerts.slice(0, 8).map((a) => '<div class="alert-row lv-' + a.level + '"><span class="al-icon">' + I(a.icon) + '</span><div class="grow"><div class="al-title">' + esc(a.title) + '</div><div class="al-detail">' + esc(a.detail) + "</div></div>" + UI.badge(a.level === "danger" ? "Nghiêm trọng" : "Theo dõi", a.level === "danger" ? "danger" : "warning") + "</div>").join("") + "</div>" + (alerts.length > 8 ? '<div class="card-note">Còn ' + (alerts.length - 8) + " cảnh báo khác.</div>" : "") : UI.empty("shield-check", "Không có bất thường", "Biên lãi, tồn kho, tiền mặt và máy in đều trong ngưỡng."), { icon: "triangle-alert", flush: true, sub: "Biên lãi, tồn kho, kiểm kho, tiền mặt, máy in" });

    const hasToday = live.bills > 0;
    const mode = st.chart || (hasToday ? "hour" : "14d");
    const chartBody = mode === "hour" ? hourChart(today, 200) : dailyChart(Engine.days(shiftKey(today, -13), today), 200);
    const chartCard = card(mode === "hour" ? "Doanh thu theo giờ hôm nay" : "Doanh thu 14 ngày gần nhất", chartBody, { icon: "chart-line", sub: mode === "hour" ? U.num(live.bills) + " bill · trung bình " + U.money(live.bills ? live.revenue / live.bills : 0) + "/bill" : "Cột đậm là hôm nay (đang bán)", right: UI.seg([{ value: "hour", label: "Theo giờ" }, { value: "14d", label: "14 ngày" }], mode, "owner.chart") });

    const open = Engine.openTickets().map((t) => ({ t, tot: Engine.totals(t) })).sort((a, b) => b.tot.grand - a.tot.grand);
    const openCard = card("Bàn đang mở", open.length ? '<div class="mini-list">' + open.slice(0, 6).map((x) => { const tb = Engine.table(x.t.tableId); return '<div class="ml-row"><b class="ml-code">' + esc(tb ? tb.code : "") + '</b><div class="grow"><div class="small">' + x.t.guests + " khách · " + UI.since(x.t.openedAt) + '</div></div><div class="right"><div class="num strong">' + U.money(x.tot.grand) + "</div>" + (x.t.status === "locked" ? UI.badge("Đã in tạm tính", "danger") : x.tot.pendingWeigh ? UI.badge("Chờ cân", "warning") : "") + "</div></div>"; }).join("") + "</div>" + (open.length > 6 ? '<div class="card-note">Và ' + (open.length - 6) + " bàn khác</div>" : "") : UI.empty("layout-grid", "Chưa có bàn nào đang mở"), { icon: "layout-grid", flush: true, sub: U.num(open.length) + " bàn · " + U.money(live.openValue) + " chưa thanh toán" });

    const duty = Engine.onDuty();
    const grace = Number(C().attendance.graceMinutes) || 0;
    const dutyCard = card("Nhân viên đang trong ca", duty.length ? '<div class="mini-list">' + duty.map((s) => { const a = Engine.activeAtt(s.id); return '<div class="ml-row">' + UI.avatar(s.name) + '<div class="grow"><div class="strong small">' + esc(s.name) + '</div><div class="small muted">' + esc(Engine.roleLabel(s.role)) + " · vào " + U.time(a.in) + "</div></div>" + (a.lateMin > grace ? UI.badge("Trễ " + a.lateMin + " phút", "warning") : UI.badge("Đúng giờ", "success")) + "</div>"; }).join("") + "</div>" : UI.empty("users", "Chưa có ai chấm công vào ca"), { icon: "user-check", flush: true, sub: duty.length + "/" + D().staff.filter((s) => s.active && s.role !== "owner").length + " nhân viên" });

    const sh = Engine.currentShift();
    let shiftBody;
    if (sh) {
      const ss = Engine.shiftStats(sh);
      shiftBody = '<div class="row between mb-12"><div class="small muted">' + esc(Engine.staffName(sh.cashierId)) + " · mở ca " + U.time(sh.openedAt) + "</div>" + (sh.status === "auto_locked" ? UI.badge("Đã tự khóa sổ lúc " + U.time(sh.autoLockedAt), "danger", true) : UI.badge("Đang mở", "success", true)) + "</div>" +
        statRows([{ l: "Tiền đầu ca", v: U.money(ss.opening) }, { l: "Tiền mặt thu", v: U.money(ss.cash) }, { l: "Chuyển khoản VietQR", v: U.money(ss.qr) }, { l: "Chi vặt, trả tip, ứng lương", v: "-" + U.money(ss.petty + ss.tipsPaid + ss.advancesPaid) }, { l: "Tiền mặt phải có trong két", v: U.money(ss.expected), cls: "sr-total" }]);
    } else {
      const z = D().shiftsHistory[0];
      shiftBody = z ? '<div class="row between mb-12"><div class="small muted">Ca gần nhất ' + U.dayLabel(z.dayKey) + "</div>" + UI.badge("Đã chốt", "", true) + "</div>" + statRows([{ l: "Tiền mặt phải có", v: U.money(z.expected) }, { l: "Thực đếm", v: U.money(z.counted) }, { l: "Chênh lệch", v: '<span class="' + (z.variance < 0 ? "text-danger" : "") + '">' + signed(z.variance, U.money) + "</span>", cls: "sr-total" }]) : UI.empty("banknote", "Chưa mở ca thu ngân");
    }
    const shiftCard = card("Két tiền mặt ca hiện tại", shiftBody, { icon: "banknote" });

    const sumText = "Hôm nay đến " + U.time(Date.now()) + ": doanh thu <b>" + U.money(live.revenue) + "</b> từ " + U.num(live.bills) + " bill, đang phục vụ " + U.num(live.openTickets) + " bàn (" + U.moneyShort(live.openValue) + "). " +
      (ownerPend.length ? "Có <b>" + ownerPend.length + " vấn đề lớn chờ Chủ quán</b>" : "Không có vấn đề lớn tồn đọng") +
      (cashierPend.length ? " (cùng " + cashierPend.length + " việc nhỏ thuộc thẩm quyền Thu ngân kiêm Quản lý)" : "") +
      (dangerN ? " và <b>" + dangerN + " cảnh báo nghiêm trọng</b> cần xem." : alerts.length ? ", " + alerts.length + " cảnh báo cần theo dõi." : ", không có cảnh báo.");

    return '<div class="page">' +
      head("Tổng quan", U.weekday(U.dayStart(today)) + ", " + U.dayLabel(today) + " · cập nhật lúc " + U.time(Date.now()), '<span class="live-dot">' + I("refresh-cw", "ic-sm") + "Số liệu trực tiếp</span>") +
      summary(sumText, dangerN ? "warning" : "") + kpis +
      '<div class="ov-grid">' + apCard + alCard + "</div>" +
      chartCard +
      '<div class="grid-3 ov-mini">' + openCard + dutyCard + shiftCard + "</div>" +
      "</div>";
  }

  /* ======================= 2. PHE DUYET ======================= */
  function bulkCandidates() {
    const st = S();
    const me = App.me();
    return Engine.pendingApprovals().filter((a) => (st.appType === "all" || a.type === st.appType) && isLowRisk(a) && Engine.canApprove(me.id, a)).map((a) => a.id);
  }
  function pageApprovals() {
    const st = S();
    const me = App.me();
    if (st.appTab !== "history") st.appTab = "pending";
    if (!st.appScope) st.appScope = "all";
    const isPend = st.appTab === "pending";
    const all = D().approvals;
    const pendAll = all.filter((a) => a.status === "pending");
    const ownerPendAll = pendAll.filter((a) => Engine.approvalTier(a) === "owner");
    const cashierPendAll = pendAll.filter((a) => Engine.approvalTier(a) === "cashier");
    const base = isPend ? pendAll : all.filter((a) => a.status !== "pending").sort((a, b) => (b.resolvedAt || 0) - (a.resolvedAt || 0));
    const types = Object.keys(Engine.APPROVAL_TYPES);
    const chips = [{ value: "all", label: "Tất cả", count: base.length }].concat(types.map((t) => ({ value: t, label: typeInfo(t).label, count: base.filter((a) => a.type === t).length })).filter((c) => c.count > 0 || c.value === st.appType));
    const list = base.filter((a) => st.appType === "all" || a.type === st.appType);
    const canAny = Engine.canApprove(me.id, { type: "advance", amount: 0 });

    let body = "";
    if (isPend) {
      const cand = bulkCandidates();
      const selN = cand.filter((id) => st.sel[id]).length;
      const selAmt = U.sum(cand.filter((id) => st.sel[id]).map((id) => all.find((a) => a.id === id)), (a) => a.amount);
      const bulkBar = cand.length ? '<div class="bulk-bar"><label class="check"><input type="checkbox" data-change="owner.selAll"' + (selN && selN === cand.length ? " checked" : "") + '><span>Chọn tất cả mục rủi ro thấp (' + cand.length + ')</span></label><span class="small muted grow">Áp dụng cho hao hụt, tăng ca, hủy món có giá trị đến ' + U.money(bulkCap()) + "." + (selN ? " Đã chọn " + selN + " mục · " + U.money(selAmt) : "") + "</span>" + UI.btn("Duyệt tất cả mục đã chọn", { act: "owner.bulkApprove", kind: "primary", icon: "list-checks", disabled: !selN }) + "</div>" : "";

      const ownerList = list.filter((a) => Engine.approvalTier(a) === "owner");
      const cashierList = list.filter((a) => Engine.approvalTier(a) === "cashier");
      const scopeSeg = UI.seg([
        { value: "all", label: "Phân tầng rõ (" + list.length + ")" },
        { value: "owner", label: "Chỉ vấn đề lớn (" + ownerList.length + ")" },
        { value: "cashier", label: "Việc Quản lý ca (" + cashierList.length + ")" },
      ], st.appScope, "owner.appScope");

      const majorSection = card(
        "Vấn đề lớn cần Chủ quán quyết định (" + ownerList.length + ")",
        ownerList.length
          ? '<div class="appr-list">' + ownerList.map((a) => apprCard(a, { bulk: false, selected: !!st.sel[a.id] })).join("") + "</div>"
          : UI.empty("shield-check", "Không có vấn đề lớn nào đang chờ Chủ quán", "Các vấn đề lớn như lệch kiểm kho cuối ca, hủy món đắt tiền, giảm giá/ép giá sâu, ứng lương lớn, mở khóa bill lần 2+ sẽ xuất hiện tại đây."),
        {
          icon: "shield-alert",
          flush: true,
          sub: "Lệch kiểm kho cuối ca · Hủy món > 200k · Giảm giá > 10% · Ép giá cá > 15% · Ứng lương > 500k · Mở khóa bill từ lần 2",
          right: scopeSeg,
        }
      );

      const routineSection = card(
        "Việc thường ngày — Đã phân quyền Thu ngân kiêm Quản lý xử lý nhanh (" + cashierList.length + ")",
        (bulkBar ? '<div class="card-body bulk-wrap">' + bulkBar + "</div>" : "") +
          (cashierList.length
            ? '<div class="appr-list">' + cashierList.map((a) => apprCard(a, { bulk: !!cand.length, selected: !!st.sel[a.id] })).join("") + "</div>"
            : UI.empty("circle-check", "Thu ngân kiêm Quản lý đã xử lý gọn các việc thường ngày", "Không còn yêu cầu nhỏ nào tồn đọng.")),
        {
          icon: "zap",
          flush: true,
          sub: "Thu ngân kiêm Quản lý tự duyệt tại quầy (#/cashier); Chủ quán chỉ giám sát hoặc duyệt hộ khi cần",
        }
      );

      if (st.appScope === "owner") body = majorSection;
      else if (st.appScope === "cashier") body = '<div class="mb-12">' + scopeSeg + "</div>" + routineSection;
      else body = '<div class="col gap-16">' + majorSection + routineSection + "</div>";
    } else {
      const rows = list.slice(0, 100).map((a) => "<tr><td class=\"nowrap\">" + (a.resolvedAt ? U.time(a.resolvedAt) + '<div class="small muted">' + U.date(a.resolvedAt) + "</div>" : "-") + '</td><td><span class="row gap-4 nowrap">' + I(typeInfo(a.type).icon, "ic-sm") + esc(typeInfo(a.type).label) + "</span></td><td><div class=\"strong\">" + esc(a.title) + '</div><div class="small muted">' + esc(a.reason || "") + "</div></td><td>" + esc(Engine.staffName(a.by)) + '</td><td class="num">' + (amountOf(a) ? U.money(amountOf(a)) : "-") + "</td><td>" + resultBadge(a) + "</td><td>" + esc(a.resolvedBy ? Engine.staffName(a.resolvedBy) : "-") + '</td><td class="small">' + esc(a.resolveNote || "") + "</td></tr>").join("");
      body = card("Lịch sử phê duyệt", list.length ? tbl('<th>Xử lý lúc</th><th>Loại</th><th>Nội dung</th><th>Người đề nghị</th><th class="num">Số tiền</th><th>Kết quả</th><th>Người xử lý</th><th>Ghi chú</th>', rows) : UI.empty("history", "Chưa có yêu cầu đã xử lý"), { icon: "history", flush: true, sub: list.length + " yêu cầu" + (list.length > 100 ? ", hiển thị 100 mục gần nhất" : "") });
    }

    const totalAmt = U.sum(pendAll, (a) => amountOf(a));
    const resolved = all.filter((a) => a.status !== "pending");
    const sumText = isPend
      ? pendAll.length
        ? "Có <b>" + ownerPendAll.length + " vấn đề lớn cần Chủ quán quyết</b> và <b>" + cashierPendAll.length + " việc thường ngày đã phân quyền cho Thu ngân kiêm Quản lý</b> (tổng giá trị ảnh hưởng " + U.money(totalAmt) + ")."
        : "Không có yêu cầu chờ duyệt. Các vấn đề lớn vượt hạn mức Quản lý ca sẽ hiện ở đây tức thời."
      : "Đã xử lý " + resolved.length + " yêu cầu: " + resolved.filter((a) => a.status === "approved").length + " duyệt, " + resolved.filter((a) => a.status === "rejected").length + " từ chối.";

    return '<div class="page">' +
      head("Phê duyệt & Phân cấp Quản lý", "Chủ quán tập trung quyết định các vấn đề lớn; việc thường ngày do Thu ngân kiêm Quản lý xử lý nhanh tại quầy.", UI.seg([{ value: "pending", label: "Chờ duyệt (" + pendAll.length + ")" }, { value: "history", label: "Lịch sử" }], st.appTab, "owner.appTab")) +
      summary(sumText, isPend && ownerPendAll.length ? "warning" : "") +
      (!canAny ? UI.banner("info", "lock", "<b>Chế độ chỉ xem.</b> " + esc(noPermText())) : "") +
      UI.chips(chips, st.appType, "owner.appType") +
      body + "</div>";
  }


  /* ======================= 3. BAN HANG VA LAI LO ======================= */
  function pageSales() {
    const st = S();
    const r = range();
    const pr = prevRange(r);
    const curDays = Engine.days(r.from, r.to);
    const prevDays = Engine.days(pr.from, pr.to);
    const cur = Engine.summarize(curDays);
    const prev = Engine.summarize(prevDays);
    const salesInRange = D().sales.filter((s) => s.dayKey >= r.from && s.dayKey <= r.to);
    const discounts = cur.discount !== undefined ? cur.discount : U.sum(salesInRange, (s) => s.discount || 0);
    const unlockCount = D().approvals.filter((a) => a.type === "unlock_bill" && U.dayKey(a.at) >= r.from && U.dayKey(a.at) <= r.to).length;
    const voidApps = D().approvals.filter((a) => a.type === "void_item" && U.dayKey(a.at) >= r.from && U.dayKey(a.at) <= r.to);
    const voidsAfterPrint = voidApps.length;
    const voidAmount = U.sum(voidApps, (a) => a.amount || 0);
    const postPrebillCount = (D().audit || D().auditLog || []).filter((l) => l && (l.type === "post_prebill_return_beer" || String(l.action || l.text || "").includes("Sửa sau tạm tính")) && U.dayKey(l.at) >= r.from && U.dayKey(l.at) <= r.to).length;
    const margin = cur.margin;
    const avgBill = cur.avgBill;

    const kpis = '<div class="grid-4 owner-kpis">' +
      UI.kpi({ label: "Tổng doanh thu (" + r.label + ")", icon: "banknote", value: U.money(cur.revenue), meta: delta(cur.revenue, prev.revenue) + " so với " + pr.label }) +
      UI.kpi({ label: "Giá vốn hàng bán (COGS)", icon: "package", value: U.money(cur.cogs), meta: "Chiếm " + U.pct(pct(cur.cogs, cur.revenue)) + " doanh thu · " + delta(cur.cogs, prev.cogs, true) }) +
      UI.kpi({ label: "Lãi gộp (Gross Profit)", icon: "trending-up", value: U.money(cur.gross), meta: "Biên lãi gộp " + U.pct(margin) + " · " + delta(cur.gross, prev.gross), tone: cur.revenue && margin < Number(C().marginAlert) ? "warn" : "good" }) +
      UI.kpi({ label: "Số lượng hóa đơn", icon: "receipt", value: U.num(cur.bills) + " bill", meta: "Trung bình " + U.money(avgBill) + "/bill · " + U.num(cur.guests) + " lượt khách" }) +
      "</div>";

    const tabBar = tabs([
      { value: "pl", label: "Báo cáo lãi lỗ (P&L)", icon: "file-spreadsheet" },
      { value: "items", label: "Món bán chạy & biên lãi", icon: "utensils" },
      { value: "fraud", label: "Chống thất thoát & ngoại lệ", icon: "shield-alert", count: voidsAfterPrint + unlockCount + postPrebillCount },
    ], st.salesTab || "pl", "owner.salesTab");

    let body = "";
    if ((st.salesTab || "pl") === "pl") {
      const plRows = [
        ["Doanh thu đồ ăn & bếp", U.money(cur.food), U.pct(pct(cur.food, cur.revenue)), ""],
        ["Doanh thu bia, rượu & đồ uống", U.money(cur.alcohol), U.pct(pct(cur.alcohol, cur.revenue)), ""],
        ["Phụ thu phòng VIP", U.money(cur.vipFee), U.pct(pct(cur.vipFee, cur.revenue)), ""],
        ["Giảm giá trực tiếp trên bill", "-" + U.money(discounts), U.pct(pct(discounts, cur.revenue)), "text-danger"],
        ["Tổng doanh thu thuần", U.money(cur.revenue), "100%", "strong"],
        ["Giá vốn nguyên liệu & đồ uống (COGS)", "-" + U.money(cur.cogs), U.pct(pct(cur.cogs, cur.revenue)), ""],
        ["Lãi gộp bán hàng", U.money(cur.gross), U.pct(margin), "strong"],
        ["Chi phí hao hụt đã duyệt", "-" + U.money(cur.wastage), U.pct(pct(cur.wastage, cur.revenue)), "text-danger"],
        ["Chi phí nhân công trong kỳ", "-" + U.money(cur.labor), U.pct(pct(cur.labor, cur.revenue)), ""],
        ["Chi phí phụ phẩm ước tính (đá, gas, than)", "-" + U.money(cur.utility), U.pct(pct(cur.utility, cur.revenue)), ""],
        ["Lợi nhuận ròng ước tính", U.money(cur.net), U.pct(pct(cur.net, cur.revenue)), "strong"],
      ].map((x) => '<tr class="' + x[3] + '"><td>' + x[0] + '</td><td class="num">' + x[1] + '</td><td class="num">' + x[2] + "</td></tr>").join("");

      const chart = r.preset === "today" ? hourChart(r.to, 210) : dailyChart(curDays, 210);
      const paySplit = statRows([
        { l: "Tiền mặt", v: U.money(cur.cash) + " (" + U.pct(pct(cur.cash, cur.revenue || 1), 0) + ")" },
        { l: "Chuyển khoản VietQR", v: U.money(cur.qr) + " (" + U.pct(pct(cur.qr, cur.revenue || 1), 0) + ")" },
        { l: "Tiền tip nhân viên qua QR", v: U.money(cur.tips || 0) },
        { l: "Chi phí phụ phẩm / Doanh thu bếp", v: U.pct(cur.utilityPct), cls: "sr-total" },
      ]);
      body = '<div class="grid-2">' +
        card("Báo cáo kết quả kinh doanh (" + r.label + ")", tbl('<th>Chỉ tiêu</th><th class="num">Số tiền</th><th class="num">Tỷ trọng</th>', plRows), { icon: "file-spreadsheet", flush: true }) +
        '<div class="col gap-16">' +
        card(r.preset === "today" ? "Doanh thu theo giờ hôm nay" : "Diễn biến doanh thu theo ngày", chart, { icon: "chart-line" }) +
        card("Cơ cấu phương thức thanh toán", paySplit, { icon: "wallet" }) +
        "</div></div>";
    } else if (st.salesTab === "items") {
      const th = Number(C().marginAlert) || 35;
      const topMap = {};
      Engine.topItems(r.from, r.to, 100).forEach((t) => { topMap[t.menuId] = t; });
      const items = C().menu.map((m) => {
        const prc = Number(m.kind === "seafood" ? m.pricePerKg : m.price) || 0;
        const cst = Number(m.kind === "seafood" ? m.costPerKg : m.cost) || 0;
        const mg = prc ? ((prc - cst) / prc) * 100 : 0;
        const stat = topMap[m.id] || { qty: 0, kg: 0, amount: 0, cost: 0 };
        const qVal = m.kind === "seafood" ? stat.kg : stat.qty;
        return { m, prc, cst, mg, qty: qVal, rev: stat.amount, profit: stat.amount - stat.cost };
      }).sort((a, b) => b.rev - a.rev || a.mg - b.mg);
      const rows = items.map((x) => "<tr>" +
        '<td><div class="strong">' + esc(x.m.name) + '</div><div class="small muted">' + esc((C().categories.find((c) => c.id === x.m.categoryId) || {}).name || "") + "</div></td>" +
        '<td class="num">' + U.money(x.prc) + (x.m.kind === "seafood" ? "/kg" : "") + "</td>" +
        '<td class="num">' + U.money(x.cst) + "</td>" +
        '<td class="num">' + UI.badge(U.pct(x.mg), x.mg < th ? "danger" : x.mg < th + 10 ? "warning" : "success") + "</td>" +
        '<td class="num">' + (x.qty ? U.num(x.qty, x.m.kind === "seafood" ? 2 : 0) + " " + esc(x.m.unit || "") : "-") + "</td>" +
        '<td class="num strong">' + (x.rev ? U.money(x.rev) : "-") + "</td>" +
        '<td class="num">' + (x.rev ? U.money(x.profit) : "-") + "</td></tr>").join("");
      body = card("Hiệu quả món ăn & kiểm soát biên lãi gộp", tbl('<th>Món</th><th class="num">Giá bán</th><th class="num">Giá vốn</th><th class="num">Biên lãi</th><th class="num">Sản lượng</th><th class="num">Doanh thu</th><th class="num">Lãi gộp</th>', rows), {
        icon: "utensils", flush: true, sub: "Ngưỡng cảnh báo biên lãi hiện tại: " + th + "% (điều chỉnh trong Cài đặt)",
      });
    } else {
      const logs = (D().audit || D().auditLog || []).slice(0, 40);
      const logRows = logs.map((l) => '<tr><td class="nowrap">' + U.dateTime(l.at) + "</td><td><b>" + esc(l.action || l.title || l.text || "") + "</b></td><td>" + esc(Engine.staffName(l.by || l.who)) + "</td><td>" + esc(l.detail || l.reason || l.text || "") + "</td></tr>").join("");
      body = '<div class="grid-3 mb-16">' +
        UI.kpi({ label: "Mở khóa / Sửa sau tạm tính", icon: "lock-open", value: U.num(unlockCount + postPrebillCount) + " lần", meta: unlockCount + " lần mở khóa · " + postPrebillCount + " lần trả bia sau tạm tính", tone: unlockCount + postPrebillCount > 2 ? "warn" : "" }) +
        UI.kpi({ label: "Hủy món sau khi đã gửi bếp", icon: "ban", value: U.num(voidsAfterPrint) + " món", meta: "Giá trị hủy: " + U.money(voidAmount), tone: voidsAfterPrint ? "warn" : "" }) +
        UI.kpi({ label: "Tổng giảm giá trực tiếp", icon: "badge-percent", value: U.money(discounts), meta: "Chiếm " + U.pct(pct(discounts, cur.revenue || 1)) + " doanh thu" }) +
        "</div>" +
        card("Nhật ký kiểm toán các thao tác nhạy cảm", logRows ? tbl("<th>Thời gian</th><th>Thao tác</th><th>Nhân viên</th><th>Chi tiết</th>", logRows) : UI.empty("shield-check", "Không có thao tác nhạy cảm nào"), { icon: "shield-alert", flush: true });
    }

    return '<div class="page">' +
      head("Bán hàng và lãi lỗ", "Theo dõi doanh thu, giá vốn, biên lãi gộp và các ngoại lệ vận hành.", rangeSeg()) +
      summary("Kỳ <b>" + r.label + "</b>: doanh thu <b>" + U.money(cur.revenue) + "</b>, lãi gộp <b>" + U.money(cur.gross) + "</b> (biên lãi " + U.pct(margin) + ") từ " + U.num(cur.bills) + " hóa đơn.") +
      kpis + tabBar + body + "</div>";
  }

  /* ======================= 4. KHO VA DOI SOAT 4 LOP ======================= */
  function pageInventory() {
    const st = S();
    const days = dayOptions(14);
    if (!st.invDay || !days.some((d) => d.value === st.invDay)) st.invDay = days[0].value;
    const rec = Engine.reconciliation(st.invDay);
    const daySum = Engine.summarize(Engine.days(st.invDay, st.invDay));

    const tabBar = tabs([
      { value: "recon", label: "Đối soát 4 lớp cuối ca", icon: "scale" },
      { value: "stock", label: "Tồn kho tức thời", icon: "boxes" },
      { value: "history", label: "Phiếu nhập & kiểm kho mù", icon: "clipboard-check" },
    ], st.invTab || "recon", "owner.invTab");

    let body = "";
    if ((st.invTab || "recon") === "recon") {
      // Lop 1: Hai san
      const tankRows = rec.tank.map((r) => {
        const sys = r.system || { count: 0, kg: 0 };
        const c = r.count;
        return "<tr>" +
          "<td><b>" + esc(r.name) + "</b></td>" +
          '<td class="num">' + ckg(r.received.count, r.received.kg) + "</td>" +
          '<td class="num">' + ckg(r.sold.count, r.sold.kg) + "</td>" +
          '<td class="num">' + ckg(r.waste.count, r.waste.kg) + "</td>" +
          '<td class="num strong">' + ckg(c ? c.theoCount : sys.count, c ? c.theoKg : sys.kg) + "</td>" +
          '<td class="num">' + (c ? ckg(c.actCount, c.actKg) : '<span class="muted">Chưa kiểm</span>') + "</td>" +
          '<td class="num">' + (c ? (c.dCount ? signed(c.dCount, U.num) + " con · " : "") + signed(c.actKg - c.theoKg, U.kg) : "-") + "</td>" +
          "<td>" + (c ? UI.badge(!c.bad ? "Trong dung sai" : "Vượt dung sai", !c.bad ? "success" : "danger", true) : UI.badge("Chờ kiểm cuối ca", "warning")) + "</td></tr>";
      }).join("");

      // Lop 2: Tui dinh luong bep
      const bagRows = rec.bags.map((r) => {
        const c = r.count;
        return "<tr>" +
          "<td><b>" + esc(r.name) + "</b></td>" +
          '<td class="num">' + U.num(r.received) + "</td>" +
          '<td class="num">' + U.num(r.used) + "</td>" +
          '<td class="num">' + U.num(r.waste) + "</td>" +
          '<td class="num strong">' + U.num(c ? c.theo : r.system) + "</td>" +
          '<td class="num">' + (c ? U.num(c.act) : '<span class="muted">Chưa kiểm</span>') + "</td>" +
          '<td class="num">' + (c ? signed(c.diff, U.num) + " túi" : "-") + "</td>" +
          "<td>" + (c ? UI.badge(!c.bad ? "Khớp" : "Lệch " + signed(c.diff, U.num) + " túi", !c.bad ? "success" : "danger", true) : UI.badge("Chờ kiểm", "warning")) + "</td></tr>";
      }).join("");

      // Lop 3: Bia, ruou, nuoc
      const drinkRows = rec.beers.map((r) => {
        const c = r.count;
        return "<tr>" +
          "<td><b>" + esc(r.name) + "</b></td>" +
          '<td class="num">' + U.num(r.paid) + " lon</td>" +
          '<td class="num">' + U.num(r.free) + " lon</td>" +
          '<td class="num">' + U.num(r.capsReturned) + "/" + U.num(r.capsRequired) + " nắp</td>" +
          '<td class="num strong">' + U.num(c ? c.theo : r.system) + "</td>" +
          '<td class="num">' + (c ? U.num(c.act) : '<span class="muted">Chưa kiểm</span>') + "</td>" +
          '<td class="num">' + (c ? signed(c.diff, U.num) + " lon" : "-") + "</td>" +
          "<td>" + (c ? UI.badge(!c.bad ? "Khớp" : "Lệch " + signed(c.diff, U.num), !c.bad ? "success" : "danger", true) : UI.badge("Chờ kiểm", "warning")) + "</td></tr>";
      }).join("");

      // Lop 4: Chi phi phu pham
      const capPct = Number(C().inventory.utilityCap) || 4.5;
      const uOk = daySum.utilityPct <= capPct;
      const utilCard = card("Lớp 4 · Khoán định mức phụ phẩm (đá, gas, than, gia vị)",
        statRows([
          { l: "Doanh thu bếp làm cơ sở tính định mức", v: U.money(daySum.food) },
          { l: "Trần chi phí phụ phẩm cho phép", v: U.pct(capPct) + " (" + U.money((daySum.food * capPct) / 100) + ")" },
          { l: "Chi phí phụ phẩm thực tế phát sinh", v: U.money(daySum.utility) + " (" + U.pct(daySum.utilityPct) + ")", cls: "sr-total" },
        ]),
        { icon: "flame", right: UI.badge(uOk ? "Đạt định mức" : "Vượt trần phụ phẩm", uOk ? "success" : "danger", true) }
      );

      body = card("Lớp 1 · Hồ hải sản sống (đối soát kép Số con & Số kg, hao nước tự nhiên " + C().inventory.tankKgTol + "%)",
        tbl('<th>Hải sản</th><th class="num">Nhập thêm</th><th class="num">Đã bán (cân)</th><th class="num">Báo chết</th><th class="num">Tồn lý thuyết</th><th class="num">Kiểm thực tế</th><th class="num">Chênh lệch</th><th>Kết luận</th>', tankRows),
        { icon: "fish", flush: true }) +
        card("Lớp 2 · Túi định lượng bếp (trừ tự động theo BOM mỗi đĩa gọi)",
          tbl('<th>Túi định lượng</th><th class="num">Nhập/Chia</th><th class="num">Trừ theo món</th><th class="num">Hao hụt</th><th class="num">Tồn lý thuyết</th><th class="num">Kiểm thực tế</th><th class="num">Chênh lệch</th><th>Kết luận</th>', bagRows),
          { icon: "package", flush: true }) +
        card("Lớp 3 · Bia & khuyến mãi hãng (đối chiếu lon bán, lon tặng và thu hồi nắp)",
          tbl('<th>Mặt hàng</th><th class="num">Bán thu tiền</th><th class="num">Tặng KM</th><th class="num">Nắp thu hồi</th><th class="num">Tồn lý thuyết</th><th class="num">Kiểm thực tế</th><th class="num">Chênh lệch</th><th>Kết luận</th>', drinkRows),
          { icon: "beer", flush: true }) +
        utilCard;
    } else if (st.invTab === "stock") {
      const seaRows = C().menu.filter((m) => m.kind === "seafood" && m.active).map((m) => {
        Engine.syncTank(m.id);
        const t = D().tank[m.id] || { count: 0, kg: 0, items: [] };
        const fishList = Engine.isCountableSeafood(m) ? Engine.tankFishList(m.id) : [];
        const fishDetail = fishList.length
          ? '<div class="mi-fish-pills mt-4">' + fishList.map((f) => '<span class="fish-pill">' + esc(f.code) + ": " + U.num(f.kg, 2) + "kg</span>").join("") + "</div>"
          : "";
        return "<tr><td><b>" + esc(m.name) + "</b>" + fishDetail + '</td><td class="num">' + (Engine.isCountableSeafood(m) ? U.num(t.count) + " con" : "-") + '</td><td class="num">' + U.kg(t.kg) + '</td><td class="num">' + U.money(m.costPerKg) + '/kg</td><td class="num strong">' + U.money(t.kg * (m.costPerKg || 0)) + "</td></tr>";
      }).join("");
      const bagRows = C().bags.map((b) => {
        const q = D().stock[b.id] || 0;
        const low = q < b.minStock;
        const unit = b.unit || "túi";
        return "<tr><td><b>" + esc(b.name) + '</b><div class="small muted">' + (b.group === "veg" ? "Rau củ · Đậu · Gia vị" : "Thịt · Hải sản sơ chế") + '</div></td><td class="num">' + b.gram + " g/" + esc(unit) + '</td><td class="num">' + U.num(q) + " " + esc(unit) + '</td><td class="num">' + U.num(b.minStock) + " " + esc(unit) + '</td><td class="num">' + U.money(q * (b.cost || 0)) + "</td><td>" + UI.badge(low ? "Dưới định mức" : "Đủ hàng", low ? "warning" : "success", true) + "</td></tr>";
      }).join("");
      const dishCapRows = C().menu.filter((m) => m.kind === "kitchen" && m.active).map((m) => {
        const av = Engine.menuAvailability(m.id);
        const limName = (av.limitingBag && av.limitingBag.name) || av.limiting || "Đủ nguyên liệu";
        return "<tr><td><b>" + esc(m.name) + "</b></td><td>" + esc(limName) + '</td><td class="num">' + UI.badge(av.label, av.tone === "danger" ? "danger" : av.tone === "warning" ? "warning" : "success", true) + "</td></tr>";
      }).join("");
      body = '<div class="grid-2 mb-16">' +
        card("Tồn bể hải sản hiện tại (chi tiết từng con & số kg)", tbl('<th>Hải sản & Mã cá trong bể</th><th class="num">Số con</th><th class="num">Khối lượng</th><th class="num">Giá vốn</th><th class="num">Giá trị tồn</th>', seaRows), { icon: "fish", flush: true }) +
        card("Khả năng phục vụ món bếp theo nguyên liệu còn lại", tbl('<th>Món ăn</th><th>Nguyên liệu giới hạn</th><th class="num">Số phần làm được</th>', dishCapRows), { icon: "utensils", flush: true }) +
        "</div>" +
        card("Tồn nguyên liệu bếp (Thịt sơ chế, Rau củ, Đậu hũ, Gia vị tươi)", tbl('<th>Nguyên liệu</th><th class="num">Quy cách</th><th class="num">Tồn hiện tại</th><th class="num">Tối thiểu</th><th class="num">Giá trị</th><th>Trạng thái</th>', bagRows), { icon: "box", flush: true });
    } else {
      const rcRows = D().receipts.slice(0, 30).map((r) => "<tr><td>" + U.dateTime(r.at) + "</td><td><b>" + esc(r.supplier) + "</b></td><td>" + esc(r.lines.map((l) => l.name).join(", ")) + "</td><td>" + esc(Engine.staffName(r.by)) + "</td><td>" + esc(Engine.staffName(r.witness)) + '</td><td class="num strong">' + U.money(r.total) + "</td></tr>").join("");
      const cntRows = D().counts.slice(0, 20).map((c) => "<tr><td>" + U.dateTime(c.at) + "</td><td>" + U.dayLabel(c.dayKey) + "</td><td>" + esc(Engine.staffName(c.by)) + '</td><td class="num">' + (c.lines || []).length + " mục</td><td>" + UI.badge(c.locked ? "Đã khóa sau nộp" : "Mở", "info", true) + "</td></tr>").join("");
      body = card("Phiếu nhập hàng đồng kiểm 2 người", rcRows ? tbl('<th>Thời gian</th><th>Nhà cung cấp</th><th>Mặt hàng</th><th>Người nhận</th><th>Người đồng kiểm</th><th class="num">Tổng tiền</th>', rcRows) : UI.empty("truck", "Chưa có phiếu nhập"), { icon: "truck", flush: true }) +
        card("Lịch sử nộp kiểm kho mù cuối ca", cntRows ? tbl('<th>Nộp lúc</th><th>Ngày vận hành</th><th>Người đếm</th><th class="num">Số mục</th><th>Trạng thái</th>', cntRows) : UI.empty("clipboard-check", "Chưa có phiếu kiểm kho"), { icon: "clipboard-check", flush: true });
    }

    return '<div class="page">' +
      head("Kho và đối soát 4 lớp", "Đối chiếu tồn lý thuyết từ POS với số đếm thực tế tại Kiosk cuối ca.", UI.select({ id: "owner-inv-day", options: days, value: st.invDay, change: "owner.invDay", cls: "select-auto" })) +
      tabBar + body + "</div>";
  }

  /* ======================= 5. NHAN SU VA LUONG ======================= */
  function pageHr() {
    const mk = curMonth();
    const list = D().staff.filter((s) => s.payType && s.payType !== "none").map((s) => ({ s, p: Engine.payroll(s.id, mk) }));
    const totGross = U.sum(list, (x) => x.p.gross);
    const totNet = U.sum(list, (x) => x.p.net);
    const totAdv = U.sum(list, (x) => x.p.advances);
    const totFine = U.sum(list, (x) => (x.p.late || 0) + (x.p.deductions || 0));

    const kpis = '<div class="grid-4 owner-kpis">' +
      UI.kpi({ label: "Tổng quỹ lương tạm tính", icon: "wallet", value: U.money(totGross), meta: list.length + " nhân sự hưởng lương · " + U.monthLabel(mk) }) +
      UI.kpi({ label: "Đã ứng trước trong tháng", icon: "hand-coins", value: U.money(totAdv), meta: "Hạn mức ứng " + C().payroll.advanceCapPct + "% lương tích lũy" }) +
      UI.kpi({ label: "Khấu trừ đi trễ & đền thất thoát", icon: "triangle-alert", value: U.money(totFine), meta: "Tự động tính theo bậc phạt trong Cài đặt" }) +
      UI.kpi({ label: "Còn thực lĩnh cuối kỳ", icon: "banknote", value: U.money(totNet), meta: "Ngày trả lương: ngày " + C().payroll.payDay + " hằng tháng", tone: "good" }) +
      "</div>";

    const rows = list.map(({ s, p }) => "<tr>" +
      '<td><div class="row gap-8">' + UI.avatar(s.name) + '<div><div class="strong">' + esc(s.name) + '</div><div class="small muted">' + esc(Engine.roleLabel(s.role)) + "</div></div></div></td>" +
      '<td class="num">' + p.days + " ngày · " + U.num(p.regular, 1) + "h</td>" +
      '<td class="num">' + (p.ot ? U.num(p.ot, 1) + "h" : "-") + (p.pendingOt ? ' <span class="badge badge-warning">+' + U.num(p.pendingOt, 1) + "h chờ duyệt</span>" : "") + "</td>" +
      '<td class="num">' + U.money(p.base) + "</td>" +
      '<td class="num">' + U.money((p.otPay || 0) + (p.nightPay || 0)) + "</td>" +
      '<td class="num">' + U.money((p.commission || 0) + (p.tips || 0)) + "</td>" +
      '<td class="num text-danger">' + ((p.late || 0) + (p.deductions || 0) ? "-" + U.money((p.late || 0) + (p.deductions || 0)) : "-") + "</td>" +
      '<td class="num">' + (p.advances ? "-" + U.money(p.advances) : "-") + "</td>" +
      '<td class="num strong">' + U.money(p.net) + "</td>" +
      '<td class="right">' + UI.btn("Phiếu lương", { size: "sm", icon: "receipt-text", act: "owner.payslip", data: { id: s.id } }) + "</td></tr>").join("");

    const attRows = D().attendance.slice().reverse().slice(0, 30).map((a) => {
      const s = Engine.staff(a.staffId);
      const pen = Engine.latePenalty(a.lateMin);
      const locMeta = [
        a.gpsMeters !== undefined && a.gpsMeters !== null ? "GPS " + a.gpsMeters + "m" : "",
        a.clientIp ? "IP " + a.clientIp : "",
      ].filter(Boolean).join(" · ");
      const photoCell = a.selfieUrl
        ? '<button type="button" class="btn btn-xs btn-ghost" data-act="owner.attPhoto" data-id="' + esc(a.id) + '" style="padding:2px 6px;height:auto"><img src="' + a.selfieUrl + '" alt="Selfie" style="width:32px;height:24px;object-fit:cover;border-radius:4px;margin-right:4px">Xem ảnh</button>'
        : UI.badge(a.method === "kiosk" ? "PIN Kiosk" : "Đã xác thực", "neutral");
      return "<tr><td>" + U.dayLabel(a.dayKey) + "</td><td><b>" + esc(s ? s.name : a.staffId) + "</b></td><td>" + esc(s ? Engine.roleLabel(s.role) : "") + '</td><td class="num">' + U.time(a.in) + '</td><td class="num">' + (a.out ? U.time(a.out) : '<span class="badge badge-success">Đang làm</span>') + "</td><td>" + (a.lateMin > C().attendance.graceMinutes ? UI.badge("Trễ " + a.lateMin + " phút (-" + U.money(pen) + ")", "danger") : UI.badge("Đúng giờ", "success")) + "</td><td>" + photoCell + "</td><td>" + esc(a.method === "kiosk" ? "Kiosk bếp" : "Điện thoại") + (locMeta ? '<div class="small muted">' + esc(locMeta) + "</div>" : "") + "</td></tr>";
    }).join("");

    return '<div class="page">' +
      head("Nhân sự và bảng lương", "Tự động tổng hợp công, phụ cấp ca đêm, tăng ca, hoa hồng, tiền tip và khấu trừ.", monthSelect() + UI.btn("Xuất bảng lương CSV", { size: "sm", icon: "download", act: "owner.exportPayroll" })) +
      kpis +
      card("Bảng lương chi tiết · " + U.monthLabel(mk), tbl('<th>Nhân viên</th><th class="num">Công chuẩn</th><th class="num">Tăng ca</th><th class="num">Lương cơ bản</th><th class="num">Tăng ca & đêm</th><th class="num">Thưởng & tip</th><th class="num">Phạt & đền</th><th class="num">Đã ứng</th><th class="num">Thực lĩnh</th><th></th>', rows), { icon: "users", flush: true }) +
      card("Nhật ký chấm công gần đây", tbl('<th>Ngày</th><th>Nhân viên</th><th>Vai trò</th><th class="num">Giờ vào</th><th class="num">Giờ ra</th><th>Ghi nhận</th><th>Ảnh xác thực</th><th>Thiết bị & Mạng</th>', attRows), { icon: "clock", flush: true }) +
      "</div>";
  }

  /* ======================= 6. THUE VA HOA DON DIEN TU ======================= */
  function pageTax() {
    const mk = curMonth();
    const tx = Engine.taxReport(mk);
    const tot = tx.tot;
    const locked = tx.locked;
    const isCo = C().tax.mode === "company";
    const totalVat = tot.vatFood + tot.vatAlcohol;

    const kpis = '<div class="grid-4 owner-kpis">' +
      UI.kpi({ label: "Tổng doanh thu chịu thuế", icon: "banknote", value: U.money(tot.revenue), meta: U.monthLabel(mk) + " · " + (isCo ? "Công ty TNHH" : "Hộ kinh doanh") }) +
      UI.kpi({ label: "Thuế GTGT đồ ăn (" + C().tax.food + "%)", icon: "utensils", value: U.money(tot.vatFood), meta: "Doanh thu nhóm đồ ăn: " + U.money(tot.food) }) +
      UI.kpi({ label: "Thuế GTGT rượu bia (" + C().tax.alcohol + "%)", icon: "beer", value: U.money(tot.vatAlcohol), meta: "Doanh thu nhóm rượu bia: " + U.money(tot.alcohol) }) +
      UI.kpi({ label: isCo ? "Tổng thuế GTGT đầu ra" : "Thuế khoán HKD (" + C().tax.hkdRate + "%)", icon: "landmark", value: U.money(isCo ? totalVat : tot.hkdTax), meta: locked ? "Kỳ thuế đã khóa sổ" : "Kỳ thuế đang mở", tone: locked ? "good" : "" }) +
      "</div>";

    const invRows = D().einvoices.slice(0, 50).map((e) => {
      const isPending = e.status === "requested";
      return "<tr>" +
        '<td class="nowrap"><b>' + esc(e.invoiceNo || e.no || e.id) + "</b></td>" +
        "<td>" + U.dateTime(e.at) + "</td>" +
        "<td><b>" + esc(e.company || "Khách lẻ") + '</b><div class="small muted">MST: ' + esc(e.taxCode || "-") + (e.address ? " · " + esc(e.address) : "") + " · " + esc(e.email || "") + "</div></td>" +
        '<td class="num strong">' + U.money(e.amount || e.total || 0) + "</td>" +
        "<td>" + (isPending
          ? '<div class="row gap-8 wrap">' + UI.badge("Chờ kế toán xuất", "warning", true) + UI.btn("Đánh dấu đã xuất", { size: "sm", kind: "primary", icon: "check", act: "owner.issueEInvoice", data: { id: e.id } }) + "</div>"
          : UI.badge("Đã phát hành (" + C().tax.einvoiceProvider + ")", "success", true)) + "</td></tr>";
    }).join("");

    return '<div class="page">' +
      head("Thuế và hóa đơn điện tử", "Tách tự động thuế suất đồ ăn (" + C().tax.food + "%) và rượu bia (" + C().tax.alcohol + "%), xuất bảng kê chuẩn kế toán.",
        monthSelect() +
        UI.btn("Xuất bảng kê CSV", { size: "sm", icon: "download", act: "owner.exportTax" }) +
        UI.btn(locked ? "Đã khóa kỳ thuế" : "Khóa sổ kỳ thuế", { size: "sm", kind: locked ? "" : "primary", icon: "lock", act: "owner.lockTax", disabled: locked })
      ) +
      kpis +
      card("Yêu cầu & Hóa đơn điện tử GTGT (" + D().einvoices.length + ")", invRows ? tbl('<th>Số tham chiếu / HĐ</th><th>Thời điểm</th><th>Đơn vị mua / Mã số thuế / Địa chỉ / Email</th><th class="num">Tổng thanh toán</th><th>Trạng thái</th>', invRows) : UI.empty("receipt-text", "Chưa có yêu cầu hoặc hóa đơn điện tử nào"), { icon: "receipt-text", flush: true }) +
      "</div>";
  }

  /* ======================= 7. THUONG HANG VA CHI PHI ======================= */
  function pageRebate() {
    const rebates = C().brands.map((b) => Engine.rebateProgress(b.id));
    const cards = rebates.map((r) => {
      const p = Math.min(100, Math.round(r.pct || 0));
      return '<div class="card"><div class="card-head"><div class="ch-title"><span class="ch-icon">' + I("beer") + "</span><div><h3>" + esc(r.brand.name) + '</h3><div class="sub">' + esc(r.periodLabel) + " · Chỉ tiêu " + U.num(r.target) + " " + esc(r.brand.rebateUnit) + "</div></div></div>" +
        UI.badge(r.onTrack ? "Đúng tiến độ" : "Đạt " + p + "%", r.onTrack ? "success" : p >= 75 ? "info" : "warning", true) +
        '</div><div class="card-body col gap-12">' +
        UI.progress(p, r.onTrack ? "success" : "") +
        statRows([
          { l: "Sản lượng đã tiêu thụ", v: U.num(r.cases) + " / " + U.num(r.target) + " " + esc(r.brand.rebateUnit) },
          { l: "Dự báo cuối kỳ (còn " + r.daysLeft + " ngày)", v: U.num(r.forecast) + " " + esc(r.brand.rebateUnit) },
          { l: "Tiền thưởng Rebate khi đạt", v: U.money(r.brand.rebateAmount), cls: "sr-total" },
        ]) +
        "</div></div>";
    }).join("");

    const capRows = (D().pgReturns || []).slice(0, 20).map((c) => {
      const totalCaps = U.sum(Object.values(c.caps || {}));
      return "<tr><td>" + U.dateTime(c.at) + "</td><td><b>" + esc(Engine.staffName(c.by)) + '</b></td><td class="num">' + U.num(totalCaps) + ' nắp</td><td class="num">' + U.num(c.crates || 0) + " két</td><td>" + esc(c.note || "-") + "</td><td>" + UI.badge("Đã bàn giao cuối ca", "success", true) + "</td></tr>";
    }).join("");

    return '<div class="page">' +
      head("Thưởng sản lượng hãng bia (Rebate)", "Theo dõi tiến độ đạt thưởng tháng/quý của từng hãng bia và đối soát thu hồi nắp khuyến mãi.", monthSelect()) +
      '<div class="grid-3 mb-16">' + cards + "</div>" +
      card("Đối soát thu hồi nắp & vỏ két PG cuối ca", capRows ? tbl('<th>Thời gian</th><th>Nhân viên PG</th><th class="num">Tổng nắp nộp</th><th class="num">Số két vỏ</th><th>Ghi chú</th><th>Kết quả</th>', capRows) : UI.empty("badge-percent", "Chưa có biên bản bàn giao nắp"), { icon: "badge-percent", flush: true }) +
      "</div>";
  }

  /* ======================= KHUNG GIAO DIEN CHU QUAN ======================= */
  function curPage() {
    const sub = App.currentRoute().sub || "overview";
    return PAGE_IDS.includes(sub) ? sub : "overview";
  }

  App.portal(P, {
    render() {
      const me = App.me();
      const page = curPage();
      const pendN = Engine.pendingApprovals().length;
      const dirtySet = window.OwnerPages.settings && window.OwnerPages.settings.isDirty && window.OwnerPages.settings.isDirty();

      const navBtn = (n) => {
        const cnt = n.id === "approvals" ? pendN : n.id === "settings" && dirtySet ? "!" : 0;
        return '<button type="button" class="nav-item' + (page === n.id ? " active" : "") + '" data-act="owner.nav" data-page="' + n.id + '">' +
          I(n.icon) + "<span>" + esc(n.label) + "</span>" +
          (cnt ? '<span class="count">' + cnt + "</span>" : "") + "</button>";
      };

      const sidebar = '<aside class="sidebar">' +
        '<div class="sidebar-brand"><span class="brand-mark">' + I("utensils") + '</span><div class="truncate"><b>' + esc(C().store.name) + '</b><div class="small muted">' + esc(Engine.roleLabel(me.role)) + "</div></div></div>" +
        '<nav class="sidebar-nav" aria-label="Điều hướng Chủ quán">' +
        '<div class="sidebar-section">Vận hành & báo cáo</div>' +
        NAV.map(navBtn).join("") +
        '<div class="sidebar-section">Cấu hình</div>' +
        navBtn(SETTINGS) +
        '<button type="button" class="nav-item" data-act="app.demoMenu">' + I("database") + '<span>Dữ liệu & PostgreSQL</span></button>' +
        "</nav>" +
        '<div class="sidebar-foot"><div class="row gap-8">' + UI.avatar(me.name) + '<div class="grow truncate"><div class="small strong truncate">' + esc(me.name) + '</div><div class="small muted">' + esc(Engine.roleLabel(me.role)) + "</div></div>" +
        UI.iconBtn("log-out", { act: "app.logout", title: "Đăng xuất" }) + "</div></div></aside>";

      let content = "";
      if (page === "settings") content = window.OwnerPages.settings ? window.OwnerPages.settings.render() : "";
      else if (page === "approvals") content = pageApprovals();
      else if (page === "sales") content = pageSales();
      else if (page === "inventory") content = pageInventory();
      else if (page === "hr") content = pageHr();
      else if (page === "tax") content = pageTax();
      else if (page === "rebate") content = pageRebate();
      else content = pageOverview();

      const mobileTabs = MOBILE_MAIN.map((id) => {
        const n = navOf(id);
        return '<button type="button" class="' + (page === id ? "active" : "") + '" data-act="owner.nav" data-page="' + id + '">' +
          I(n.icon) + "<span>" + esc(n.short) + "</span>" + (id === "approvals" && pendN ? '<span class="count">' + pendN + "</span>" : "") + "</button>";
      }).join("") +
        '<button type="button" class="' + (!MOBILE_MAIN.includes(page) ? "active" : "") + '" data-act="owner.more">' + I("menu") + "<span>Thêm</span></button>";

      return '<div class="owner-shell">' +
        UI.topbar({
          subtitle: navOf(page).label,
          right: (Engine.currentShift() && Engine.currentShift().status === "auto_locked"
            ? UI.btn("Mở khóa ca thu ngân", { size: "sm", kind: "warning", icon: "lock-open", act: "owner.unlockShift" })
            : "") +
            UI.btn("PostgreSQL 16", { size: "sm", icon: "database", act: "app.pgModal" }) +
            UI.btn("Dữ liệu hệ thống", { size: "sm", icon: "hard-drive", act: "app.demoMenu" }) +
            UI.btn("Cài đặt", { size: "sm", kind: page === "settings" ? "primary" : "default", icon: "settings", act: "owner.nav", data: { page: "settings" } }),
        }) +
        '<div class="app-with-sidebar">' + sidebar + '<main class="main-col">' + content + "</main></div>" +
        '<nav class="bottom-nav owner-bnav" aria-label="Điều hướng di động">' + mobileTabs + "</nav>" +
        "</div>";
    },
  });

  /* ======================= HANH DONG CHU QUAN ======================= */
  App.actions({
    "owner.nav": (d) => {
      App.go("owner", d.page || "overview");
    },
    "owner.more": () => {
      const cur = curPage();
      const extra = NAV.slice(4).concat([SETTINGS]);
      App.sheet({
        title: "Danh mục quản trị",
        body: () => '<div class="col gap-8">' + extra.map((n) => '<button type="button" class="opt-card' + (cur === n.id ? " active" : "") + '" data-act="owner.navSheet" data-page="' + n.id + '"><span class="ch-icon">' + I(n.icon) + '</span><div><b>' + esc(n.label) + '</b><div class="small muted">' + esc(n.desc) + "</div></div></button>").join("") + "</div>",
      });
    },
    "owner.navSheet": (d) => {
      App.closeModal();
      App.go("owner", d.page);
    },
    "owner.range": (d) => {
      S().range = d.value;
      App.render();
    },
    "owner.chart": (d) => {
      S().chart = d.value;
      App.render();
    },
    "owner.month": (d, el) => {
      S().month = el.value;
      App.render();
    },
    "owner.appTab": (d) => {
      S().appTab = d.value;
      App.render();
    },
    "owner.appScope": (d) => {
      S().appScope = d.value || "all";
      App.render();
    },
    "owner.appType": (d) => {
      S().appType = d.value;
      App.render();
    },
    "owner.sel": (d, el) => {
      S().sel[d.id] = !!el.checked;
      App.render();
    },
    "owner.selAll": (d, el) => {
      const st = S();
      bulkCandidates().forEach((id) => { st.sel[id] = !!el.checked; });
      App.render();
    },
    "owner.approve": (d) => {
      const me = App.me();
      const deduct = d.deduct === "1";
      const r = App.commit(() => Engine.resolveApproval(d.id, true, deduct ? "Trừ lương người kiểm" : "Đã duyệt", me.id, { deduct }), "Đã phê duyệt yêu cầu");
      if (r) {
        delete S().sel[d.id];
        App.render();
      }
    },
    "owner.reject": (d) => {
      const ap = D().approvals.find((a) => a.id === d.id);
      if (!ap) return;
      S().rejNote = "";
      App.modal({
        title: "Từ chối yêu cầu",
        sub: ap.title,
        size: "sm",
        body: () => UI.field("Lý do từ chối (bắt buộc)", UI.textarea({ model: "owner.rejNote", value: S().rejNote || "", placeholder: "Nhập lý do để nhân viên nắm rõ..." })),
        foot: () => UI.btn("Hủy bỏ", { act: "app.closeModal" }) + UI.btn("Xác nhận từ chối", { kind: "danger", act: "owner.rejectConfirm", data: { id: ap.id } }),
      });
    },
    "owner.rejectConfirm": (d) => {
      const note = String(S().rejNote || "").trim();
      if (!note) return App.toast("Vui lòng nhập lý do từ chối (tối thiểu 3 ký tự).", "error");
      const r = App.commit(() => Engine.resolveApproval(d.id, false, note, App.me().id), "Đã từ chối yêu cầu");
      if (!r) return;
      delete S().sel[d.id];
      App.closeModal();
      App.render();
    },
    "owner.bulkApprove": () => {
      const st = S();
      const ids = bulkCandidates().filter((id) => st.sel[id]);
      if (!ids.length) return;
      const n = App.commit(() => {
        ids.forEach((id) => Engine.resolveApproval(id, true, "Duyệt hàng loạt mục rủi ro thấp", App.me().id));
        return ids.length;
      }, (c) => "Đã duyệt hàng loạt " + c + " yêu cầu");
      if (n) {
        st.sel = {};
        App.render();
      }
    },
    "owner.photo": (d) => {
      const ap = D().approvals.find((a) => a.id === d.id);
      if (!ap) return;
      const ws = ap.ref ? (D().wastage || []).find((w) => w.id === ap.ref) : null;
      const imgUrl = ap.photoUrl || (ws && ws.photoUrl) || null;
      App.modal({
        title: "Ảnh bằng chứng",
        sub: ap.title,
        size: "sm",
        body: () =>
          imgUrl
            ? '<div class="col gap-8 items-center"><img src="' + esc(imgUrl) + '" alt="Ảnh bằng chứng" style="max-width:100%;max-height:360px;border-radius:8px;object-fit:contain"><span class="small muted">Ảnh chụp lúc ' + U.dateTime(ap.at) + " bởi " + esc(Engine.staffName(ap.by)) + "</span></div>"
            : '<div class="camera-sim">' + I("image", "ic-2xl") + "<span>Ảnh chụp lúc " + U.dateTime(ap.at) + " bởi " + esc(Engine.staffName(ap.by)) + "</span></div>",
        foot: () => UI.btn("Đóng", { act: "app.closeModal", kind: "primary" }),
      });
    },
    "owner.viewTicket": (d) => {
      const tk = Engine.ticket(d.ref);
      if (!tk) return App.toast("Không tìm thấy bill.", "error");
      const tb = Engine.table(tk.tableId);
      const tot = Engine.totals(tk);
      App.modal({
        title: "Chi tiết bill bàn " + (tb ? tb.code : tk.tableId),
        sub: "Mở lúc " + U.dateTime(tk.openedAt) + " · " + tk.guests + " khách",
        body: () => '<div class="col gap-8">' + tk.items.map((it) => '<div class="row between py-4 border-b"><div><b>' + esc(it.name) + '</b><div class="small muted">' + (it.kg ? U.kg(it.kg) : "SL: " + it.qty) + "</div></div><span class=\"num strong\">" + U.money(Engine.itemAmount(it)) + "</span></div>").join("") +
          '<div class="row between pt-8"><span class="strong">Tổng thanh toán</span><b class="num big-amount" style="font-size:22px">' + U.money(tot.grand) + "</b></div></div>",
        foot: () => UI.btn("Đóng", { act: "app.closeModal", kind: "primary" }),
      });
    },
    "owner.salesTab": (d) => {
      S().salesTab = d.value;
      App.render();
    },
    "owner.invTab": (d) => {
      S().invTab = d.value;
      App.render();
    },
    "owner.invDay": (d, el) => {
      S().invDay = el.value;
      App.render();
    },
    "owner.payslip": (d) => {
      const p = Engine.payroll(d.id, curMonth());
      const s = Engine.staff(d.id);
      if (!p || !s) return;
      App.modal({
        title: "Phiếu lương · " + s.name,
        sub: Engine.roleLabel(s.role) + " · " + U.monthLabel(p.monthKey),
        body: () => UI.payslip(p),
        foot: () => UI.btn("Đóng", { act: "app.closeModal", kind: "primary" }),
      });
    },
    "owner.exportPayroll": () => {
      const mk = curMonth();
      const rows = [["Mã NV", "Họ tên", "Vai trò", "Ngày công", "Giờ chuẩn", "Giờ tăng ca", "Lương cơ bản", "Tăng ca & ca đêm", "Thưởng & Tip", "Phạt & Đền", "Đã ứng", "Thực lĩnh"]];
      D().staff.filter((s) => s.payType && s.payType !== "none").forEach((s) => {
        const p = Engine.payroll(s.id, mk);
        rows.push([s.id, s.name, Engine.roleLabel(s.role), p.days, p.regular, p.ot, p.base, (p.otPay || 0) + (p.nightPay || 0), (p.commission || 0) + (p.tips || 0), (p.late || 0) + (p.deductions || 0), p.advances, p.net]);
      });
      U.downloadCsv("bang_luong_" + mk + ".csv", rows);
      App.toast("Đã tải xuống file CSV bảng lương " + U.monthLabel(mk), "success");
    },
    "owner.exportTax": () => {
      const mk = curMonth();
      const tx = Engine.taxReport(mk);
      const tot = tx.tot;
      const rows = [
        ["Kỳ thuế", mk],
        ["Tổng doanh thu", tot.revenue],
        ["Doanh thu đồ ăn", tot.food],
        ["Thuế GTGT đồ ăn", tot.vatFood],
        ["Doanh thu rượu bia", tot.alcohol],
        ["Thuế GTGT rượu bia", tot.vatAlcohol],
        ["Tổng thuế GTGT", tot.vatFood + tot.vatAlcohol],
        ["Thuế khoán HKD", tot.hkdTax],
        [],
        ["Số HĐ / Tham chiếu", "Thời điểm", "Đơn vị mua", "Mã số thuế", "Địa chỉ", "Email", "Số tiền", "Trạng thái"],
      ];
      (tx.einvoices || []).forEach((e) => {
        rows.push([e.invoiceNo || e.id, U.dateTime(e.at), e.company || "", e.taxCode || "", e.address || "", e.email || "", e.amount || 0, e.status === "requested" ? "Chờ xuất" : "Đã phát hành"]);
      });
      U.downloadCsv("bao_cao_thue_" + mk + ".csv", rows);
      App.toast("Đã xuất bảng kê thuế " + U.monthLabel(mk), "success");
    },
    "owner.issueEInvoice": (d) => {
      const r = App.commit(() => Engine.markEInvoiceIssued(d.id), "Đã đánh dấu phát hành hóa đơn điện tử");
      if (r) App.render();
    },
    "owner.lockTax": async () => {
      const mk = curMonth();
      const ok = await App.confirm({ title: "Khóa sổ kỳ thuế " + U.monthLabel(mk) + "?", message: "Sau khi khóa, toàn bộ hóa đơn và doanh thu thuộc kỳ này không thể chỉnh sửa.", confirm: "Khóa kỳ thuế", danger: true });
      if (!ok) return;
      App.commit(() => Engine.lockTaxPeriod(mk), "Đã khóa sổ kỳ thuế " + U.monthLabel(mk));
      App.render();
    },
    "owner.attPhoto": (d) => {
      const a = (D().attendance || []).find((x) => x.id === d.id);
      if (!a || !a.selfieUrl) return;
      const st = Engine.staff(a.staffId);
      App.modal({
        title: "Ảnh xác thực chấm công · " + (st ? st.name : a.staffId),
        sub: U.dayLabel(a.dayKey) + " · Vào ca lúc " + U.time(a.in),
        size: "sm",
        body: () =>
          '<div class="col center gap-8">' +
          '<img src="' + a.selfieUrl + '" alt="Ảnh chấm công" style="width:100%;max-width:340px;border-radius:12px;border:1px solid var(--line)">' +
          '<div class="small muted">' +
          esc([a.gpsMeters !== undefined && a.gpsMeters !== null ? "Khoảng cách GPS: " + a.gpsMeters + " m" : "", a.clientIp ? "IP mạng: " + a.clientIp : ""].filter(Boolean).join(" · ")) +
          "</div></div>",
        foot: () => UI.btn("Đóng", { kind: "primary", act: "app.closeModal" }),
      });
    },
    "owner.unlockShift": () => {
      const sh = Engine.currentShift();
      if (!sh) return;
      App.commit(() => {
        sh.status = "open";
        delete sh.autoLockedAt;
      }, "Đã mở khóa ca thu ngân hiện tại");
      App.render();
    },
  });
})();
