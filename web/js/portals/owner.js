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

  const S = () => App.state(P, {
    range: "",
    _rangeManual: false,
    customFrom: "",
    customTo: "",
    appTab: "pending",
    appScope: "all",
    appType: "all",
    sel: {},
    salesTab: "pl",
    salesQ: "",
    salesPay: "all",
    invTab: "recon",
    invDay: "",
    month: "",
    chart: "",
    _rejDeduct: false,
  });
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
    { value: "yesterday", label: "Hôm qua" },
    { value: "7d", label: "7 ngày" },
    { value: "30d", label: "30 ngày" },
    { value: "month", label: "Tháng này" },
    { value: "lastmonth", label: "Tháng trước" },
    { value: "custom", label: "Tùy chọn" },
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
    let preset = st.range;
    if (!st._rangeManual || !RANGES.some((r) => r.value === preset)) {
      const today = U.dayKey();
      if (Engine.liveDay(today).bills > 0) preset = "today";
      else if ((D().sales || []).length > 0 || (D().dailyStats || []).some((d) => d.revenue > 0)) {
        const [f7, t7] = Engine.rangeKeys("7d");
        preset = Engine.summarize(Engine.days(f7, t7)).bills > 0 ? "7d" : "month";
      } else preset = "today";
    }
    let from, to, label;
    if (preset === "custom") {
      const today = U.dayKey();
      if (!st.customFrom) st.customFrom = shiftKey(today, -6);
      if (!st.customTo) st.customTo = today;
      from = st.customFrom <= st.customTo ? st.customFrom : st.customTo;
      to = st.customFrom <= st.customTo ? st.customTo : st.customFrom;
      label = from === to ? "Ngày " + U.dayLabel(from) : U.dayLabel(from) + " – " + U.dayLabel(to);
    } else {
      [from, to] = Engine.rangeKeys(preset);
      if (preset === "today") label = "Hôm nay (" + U.dayLabel(from) + ")";
      else if (preset === "yesterday") label = "Hôm qua (" + U.dayLabel(from) + ")";
      else if (preset === "7d") label = "7 ngày qua";
      else if (preset === "30d") label = "30 ngày qua";
      else label = U.monthLabel(from);
    }
    return { from, to, n: Math.max(1, daysBetween(from, to)), label, preset };
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
    out.label =
      r.preset === "today" ? "cả ngày hôm qua"
      : r.preset === "yesterday" ? "ngày hôm kia"
      : r.preset === "7d" ? "7 ngày trước đó"
      : r.preset === "30d" ? "30 ngày trước đó"
      : r.preset === "month" ? "cùng kỳ tháng trước"
      : r.preset === "lastmonth" ? "tháng trước đó"
      : r.n + " ngày trước đó";
    return out;
  }
  function rangeSeg() {
    const r = range();
    const customPickers = r.preset === "custom"
      ? '<div class="custom-dates">' +
        '<span class="small muted">Từ</span>' +
        UI.input({ type: "date", change: "owner.customFrom", value: r.from, cls: "date-input" }) +
        '<span class="small muted">đến</span>' +
        UI.input({ type: "date", change: "owner.customTo", value: r.to, cls: "date-input" }) +
        "</div>"
      : "";
    return '<div class="range-bar"><div class="range-seg">' + UI.seg(RANGES, r.preset, "owner.range") + "</div>" + customPickers + "</div>";
  }

  /* ---------- Thang ---------- */
  function months() {
    const set = new Set((D().dailyStats || []).map((d) => d.dayKey.slice(0, 7)));
    (D().sales || []).forEach((s) => { if (s && s.dayKey) set.add(s.dayKey.slice(0, 7)); });
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

    const recent7 = Engine.summarize(Engine.days(shiftKey(today, -6), today));
    const sumText = "Hôm nay đến " + U.time(Date.now()) + ": doanh thu <b>" + U.money(live.revenue) + "</b> từ " + U.num(live.bills) + " bill" +
      (!hasToday && recent7.bills ? " (7 ngày qua: <b>" + U.money(recent7.revenue) + "</b> · " + U.num(recent7.bills) + " bill)" : "") +
      ", đang phục vụ " + U.num(live.openTickets) + " bàn (" + U.moneyShort(live.openValue) + "). " +
      (ownerPend.length ? "Có <b>" + ownerPend.length + " vấn đề lớn chờ Chủ quán</b>" : "Không có vấn đề lớn tồn đọng") +
      (cashierPend.length ? " (cùng " + cashierPend.length + " việc nhỏ thuộc thẩm quyền Thu ngân kiêm Quản lý)" : "") +
      (dangerN ? " và <b>" + dangerN + " cảnh báo nghiêm trọng</b> cần xem." : alerts.length ? ", " + alerts.length + " cảnh báo cần theo dõi." : ", không có cảnh báo.");

    return '<div class="page">' +
      head(
        "Tổng quan",
        U.weekday(U.dayStart(today)) + ", " + U.dayLabel(today) + " · cập nhật lúc " + U.time(Date.now()),
        UI.btn("Thống kê & Xuất CSV", { size: "sm", icon: "download", act: "owner.quickSalesRange", data: { range: hasToday ? "today" : "7d" } }) +
          '<span class="live-dot">' + I("refresh-cw", "ic-sm") + "Số liệu trực tiếp</span>"
      ) +
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


  /* ======================= 3. BAN HANG, THONG KE DOANH THU VA LAI LO ======================= */
  function saleItemsText(s) {
    return (s.lines || [])
      .filter((ln) => ln.status !== "void")
      .map((ln) => (ln.kg ? U.num(ln.kg, 2) + "kg " : (ln.qty || 1) + "x ") + ln.name + (ln.isFree ? " (Tặng)" : ""))
      .join("; ");
  }
  function salePayLabel(s) {
    if (s.paymentSource === "webhook_qr") return "Auto Webhook QR";
    if (s.cashAmt > 0 && s.qrAmt > 0) return "Kết hợp (TM + QR)";
    if (s.qrAmt > 0) return "Chuyển khoản VietQR";
    if (s.cardAmt > 0) return "Thẻ";
    return "Tiền mặt";
  }
  function filterSalesList(sales, st) {
    const pay = st.salesPay || "all";
    const q = (st.salesQ || "").trim();
    return (sales || []).filter((s) => {
      if (pay === "cash" && !(s.cashAmt > 0)) return false;
      if (pay === "qr" && !(s.qrAmt > 0)) return false;
      if (pay === "tip" && !((s.tip || 0) > 0)) return false;
      if (q) {
        const hay = [
          s.id,
          s.payCode || "",
          s.tableCode || s.tableId || "",
          s.areaName || "",
          Engine.staffName(s.waiterId),
          Engine.staffName(s.cashierId),
          saleItemsText(s),
        ].join(" ");
        if (!U.match(hay, q)) return false;
      }
      return true;
    });
  }
  function buildItemStats(fromKey, toKey) {
    const topMap = {};
    Engine.topItems(fromKey, toKey, 500).forEach((t) => { topMap[t.menuId] = t; });
    const seen = new Set();
    const out = C().menu.map((m) => {
      seen.add(m.id);
      const prc = Number(m.kind === "seafood" ? m.pricePerKg : m.price) || 0;
      const cst = Number(m.kind === "seafood" ? m.costPerKg : m.cost) || 0;
      const mg = prc ? ((prc - cst) / prc) * 100 : 0;
      const stat = topMap[m.id] || { qty: 0, freeQty: 0, kg: 0, amount: 0, cost: 0 };
      const qVal = m.kind === "seafood" ? stat.kg : stat.qty;
      const cat = (C().categories.find((c) => c.id === m.categoryId) || {}).name || "";
      return { id: m.id, m, name: m.name, cat, unit: m.unit || (m.kind === "seafood" ? "kg" : "phần"), isSeafood: m.kind === "seafood", prc, cst, mg, qty: qVal, freeQty: stat.freeQty || 0, rev: stat.amount || 0, totalCost: stat.cost || 0, profit: (stat.amount || 0) - (stat.cost || 0) };
    });
    Object.keys(topMap).forEach((mid) => {
      if (seen.has(mid)) return;
      const stat = topMap[mid];
      const qVal = stat.kg > 0 ? stat.kg : stat.qty;
      out.push({ id: mid, m: { id: mid, name: stat.name, kind: stat.kg > 0 ? "seafood" : "kitchen", unit: stat.kg > 0 ? "kg" : "phần" }, name: stat.name, cat: "Món khác", unit: stat.kg > 0 ? "kg" : "phần", isSeafood: stat.kg > 0, prc: 0, cst: 0, mg: stat.amount ? ((stat.amount - stat.cost) / stat.amount) * 100 : 0, qty: qVal, freeQty: stat.freeQty || 0, rev: stat.amount || 0, totalCost: stat.cost || 0, profit: (stat.amount || 0) - (stat.cost || 0) });
    });
    return out.sort((a, b) => b.rev - a.rev || b.qty - a.qty || a.mg - b.mg);
  }
  function csvMetaHeader(title, r) {
    const me = App.me();
    return [
      [title],
      ["Đơn vị", C().store.name || "Quán Nhậu OS", "Điện thoại", C().store.phone || "", "Địa chỉ", C().store.address || ""],
      ["Kỳ thống kê", r.label, "Từ ngày", U.dayLabel(r.from), "Đến ngày", U.dayLabel(r.to)],
      ["Thời điểm xuất", U.dateTime(Date.now()), "Người xuất", me ? me.name : ""],
      [],
    ];
  }
  function exportSalesDailyCsv() {
    const r = range();
    const days = Engine.days(r.from, r.to);
    const sum = Engine.summarize(days);
    const rows = csvMetaHeader("BẢNG KÊ THỐNG KÊ DOANH THU BÁN HÀNG THEO NGÀY", r);
    rows.push([
      "Ngày", "Thứ", "Số hóa đơn", "Lượt khách",
      "Doanh thu đồ ăn & bếp (đ)", "Doanh thu bia rượu & đồ uống (đ)", "Phụ thu VIP (đ)", "Giảm giá (đ)",
      "Doanh thu thuần (đ)", "Thu tiền mặt (đ)", "Thu chuyển khoản VietQR (đ)", "Tiền Tip (đ)",
      "Giá vốn COGS (đ)", "Lãi gộp (đ)", "Biên lãi gộp (%)",
      "Hao hụt đã duyệt (đ)", "Chi phí nhân công (đ)", "Chi phí phụ phẩm (đ)", "Lợi nhuận ròng ước tính (đ)", "Trạng thái sổ",
    ]);
    days.forEach((d) => {
      const gross = (Number(d.revenue) || 0) - (Number(d.cogs) || 0);
      const net = gross - (Number(d.wastage) || 0) - (Number(d.labor) || 0) - (Number(d.utility) || 0);
      const mg = d.revenue ? Number(((gross / d.revenue) * 100).toFixed(1)) : 0;
      const statusText = d.dayKey === U.dayKey() ? "Đang bán hôm nay" : d.live && d.bills > 0 ? "Chưa chốt ca" : d.locked ? "Đã khóa sổ ca" : d.bills > 0 ? "Đã ghi nhận" : "Không phát sinh";
      rows.push([
        U.dayLabel(d.dayKey), U.weekday(U.dayStart(d.dayKey)), d.bills || 0, d.guests || 0,
        d.food || 0, d.alcohol || 0, d.vipFee || 0, d.discount || 0,
        d.revenue || 0, d.cash || 0, d.qr || 0, d.tips || 0,
        d.cogs || 0, gross, mg,
        d.wastage || 0, d.labor || 0, d.utility || 0, net, statusText,
      ]);
    });
    rows.push([
      "TỔNG CỘNG", days.length + " ngày", sum.bills, sum.guests,
      sum.food, sum.alcohol, sum.vipFee, sum.discount,
      sum.revenue, sum.cash, sum.qr, sum.tips,
      sum.cogs, sum.gross, Number((sum.margin || 0).toFixed(1)),
      sum.wastage, sum.labor, sum.utility, sum.net, "",
    ]);
    const span = r.from === r.to ? r.from : r.from + "_den_" + r.to;
    U.downloadCsv("bang_ke_doanh_thu_ngay_" + span + ".csv", rows);
    App.toast("Đã xuất bảng kê doanh thu theo ngày (" + r.label + ")", "success");
  }
  function exportSalesInvoicesCsv(onlyFiltered) {
    const st = S();
    const r = range();
    const bk = Engine.salesBreakdown(r.from, r.to);
    const list = onlyFiltered ? filterSalesList(bk.sales, st) : bk.sales;
    const rows = csvMetaHeader("BẢNG KÊ CHI TIẾT HÓA ĐƠN BÁN HÀNG", r);
    rows.push([
      "STT", "Mã hóa đơn", "Mã định danh QR", "Ngày vận hành", "Giờ mở bàn", "Giờ thanh toán",
      "Bàn", "Khu vực", "Số khách", "Phục vụ", "Thu ngân", "Phương thức thanh toán", "Chi tiết món đã gọi",
      "Tiền đồ ăn (đ)", "Tiền bia rượu (đ)", "Phụ thu VIP (đ)", "Giảm giá (đ)", "Đặt cọc trừ bill (đ)",
      "Tổng doanh thu thuần (đ)", "Thu tiền mặt (đ)", "Thu chuyển khoản QR (đ)", "Tiền Tip (đ)",
      "Thuế GTGT đồ ăn (đ)", "Thuế GTGT bia rượu (đ)", "Giá vốn (đ)", "Lãi gộp (đ)", "Hóa đơn điện tử",
    ]);
    list.forEach((s, idx) => {
      const tb = Engine.table(s.tableId);
      const einv = s.einvoice || (D().einvoices || []).find((e) => e.saleId === s.id);
      rows.push([
        idx + 1,
        s.id,
        s.payCode || "",
        U.dayLabel(s.dayKey || U.dayKey(s.closedAt)),
        s.openedAt ? U.time(s.openedAt) : "",
        s.closedAt ? U.time(s.closedAt) : "",
        tb ? tb.code : s.tableCode || s.tableId || "",
        s.areaName || "",
        s.guests || 0,
        Engine.staffName(s.waiterId),
        Engine.staffName(s.cashierId),
        salePayLabel(s),
        saleItemsText(s),
        s.foodAmt || 0,
        s.alcoholAmt || 0,
        s.vipFee || 0,
        s.discount || 0,
        s.deposit || 0,
        s.grand || 0,
        s.cashAmt || 0,
        s.qrAmt + (s.cardAmt || 0),
        s.tip || 0,
        s.vatFood || 0,
        s.vatAlcohol || 0,
        s.cost || 0,
        s.grossProfit || 0,
        einv ? (einv.invoiceNo || einv.no || "Đã xuất") : "Chưa xuất",
      ]);
    });
    rows.push([
      "TỔNG CỘNG", list.length + " hóa đơn", "", "", "", "",
      "", "", U.sum(list, (s) => s.guests || 0), "", "", "", "",
      U.sum(list, (s) => s.foodAmt || 0),
      U.sum(list, (s) => s.alcoholAmt || 0),
      U.sum(list, (s) => s.vipFee || 0),
      U.sum(list, (s) => s.discount || 0),
      U.sum(list, (s) => s.deposit || 0),
      U.sum(list, (s) => s.grand || 0),
      U.sum(list, (s) => s.cashAmt || 0),
      U.sum(list, (s) => (s.qrAmt || 0) + (s.cardAmt || 0)),
      U.sum(list, (s) => s.tip || 0),
      U.sum(list, (s) => s.vatFood || 0),
      U.sum(list, (s) => s.vatAlcohol || 0),
      U.sum(list, (s) => s.cost || 0),
      U.sum(list, (s) => s.grossProfit || 0),
      "",
    ]);
    const span = r.from === r.to ? r.from : r.from + "_den_" + r.to;
    U.downloadCsv("bang_ke_chi_tiet_hoa_don_" + span + ".csv", rows);
    App.toast("Đã xuất bảng kê " + list.length + " hóa đơn (" + r.label + ")", "success");
  }
  function exportSalesItemsCsv() {
    const r = range();
    const items = buildItemStats(r.from, r.to);
    const rows = csvMetaHeader("BẢNG KÊ SẢN LƯỢNG, DOANH THU & BIÊN LÃI THEO MÓN", r);
    rows.push([
      "STT", "Mã món", "Tên món", "Danh mục", "Đơn vị",
      "Giá bán chuẩn (đ)", "Giá vốn chuẩn (đ)", "Biên lãi chuẩn (%)",
      "Sản lượng bán", "Sản lượng tặng KM", "Doanh thu (đ)", "Tổng giá vốn (đ)", "Lãi gộp (đ)", "Biên lãi thực tế (%)",
    ]);
    items.forEach((x, idx) => {
      const realMg = x.rev ? Number(((x.profit / x.rev) * 100).toFixed(1)) : Number((x.mg || 0).toFixed(1));
      rows.push([
        idx + 1, x.id, x.name, x.cat, x.unit,
        x.prc, x.cst, Number((x.mg || 0).toFixed(1)),
        x.isSeafood ? Number((x.qty || 0).toFixed(2)) : (x.qty || 0),
        x.freeQty || 0,
        x.rev, x.totalCost, x.profit, realMg,
      ]);
    });
    const totRev = U.sum(items, (x) => x.rev);
    const totCost = U.sum(items, (x) => x.totalCost);
    const totProfit = totRev - totCost;
    rows.push([
      "TỔNG CỘNG", items.length + " món", "", "", "",
      "", "", "",
      "", U.sum(items, (x) => x.freeQty || 0),
      totRev, totCost, totProfit, totRev ? Number(((totProfit / totRev) * 100).toFixed(1)) : 0,
    ]);
    const span = r.from === r.to ? r.from : r.from + "_den_" + r.to;
    U.downloadCsv("bang_ke_doanh_thu_mon_" + span + ".csv", rows);
    App.toast("Đã xuất bảng kê doanh thu theo món (" + r.label + ")", "success");
  }
  function exportSalesPlCsv() {
    const r = range();
    const pr = prevRange(r);
    const cur = Engine.summarize(Engine.days(r.from, r.to));
    const prev = Engine.summarize(Engine.days(pr.from, pr.to));
    const rows = csvMetaHeader("BÁO CÁO KẾT QUẢ KINH DOANH (P&L)", r);
    rows.push(["Chỉ tiêu", "Kỳ hiện tại (" + r.label + ") (đ)", "Tỷ trọng doanh thu (%)", "Kỳ so sánh (" + pr.label + ") (đ)", "Chênh lệch (đ)"]);
    const lines = [
      ["Doanh thu đồ ăn & bếp", cur.food, pct(cur.food, cur.revenue), prev.food],
      ["Doanh thu bia, rượu & đồ uống", cur.alcohol, pct(cur.alcohol, cur.revenue), prev.alcohol],
      ["Phụ thu phòng VIP", cur.vipFee, pct(cur.vipFee, cur.revenue), prev.vipFee],
      ["Giảm giá trực tiếp trên bill", -cur.discount, -pct(cur.discount, cur.revenue), -prev.discount],
      ["Tổng doanh thu thuần", cur.revenue, cur.revenue ? 100 : 0, prev.revenue],
      ["Giá vốn nguyên liệu & đồ uống (COGS)", -cur.cogs, -pct(cur.cogs, cur.revenue), -prev.cogs],
      ["Lãi gộp bán hàng", cur.gross, cur.margin, prev.gross],
      ["Chi phí hao hụt đã duyệt", -cur.wastage, -pct(cur.wastage, cur.revenue), -prev.wastage],
      ["Chi phí nhân công trong kỳ", -cur.labor, -pct(cur.labor, cur.revenue), -prev.labor],
      ["Chi phí phụ phẩm ước tính (đá, gas, than)", -cur.utility, -pct(cur.utility, cur.revenue), -prev.utility],
      ["Lợi nhuận ròng ước tính", cur.net, pct(cur.net, cur.revenue), prev.net],
      ["Trong đó: Thu tiền mặt", cur.cash, pct(cur.cash, cur.revenue), prev.cash],
      ["Trong đó: Thu chuyển khoản VietQR", cur.qr, pct(cur.qr, cur.revenue), prev.qr],
      ["Tiền Tip khách thưởng nhân viên", cur.tips, pct(cur.tips, cur.revenue), prev.tips],
      ["Số lượng hóa đơn đã thanh toán", cur.bills, "", prev.bills],
      ["Lượt khách phục vụ", cur.guests, "", prev.guests],
    ];
    lines.forEach((x) => {
      rows.push([x[0], x[1], x[2] === "" ? "" : Number((x[2] || 0).toFixed(1)), x[3], (Number(x[1]) || 0) - (Number(x[3]) || 0)]);
    });
    const span = r.from === r.to ? r.from : r.from + "_den_" + r.to;
    U.downloadCsv("bao_cao_lai_lo_PL_" + span + ".csv", rows);
    App.toast("Đã xuất báo cáo kết quả kinh doanh P&L (" + r.label + ")", "success");
  }
  function exportSalesAuditCsv() {
    const r = range();
    const logs = (D().audit || D().auditLog || []).filter((l) => l && U.dayKey(l.at) >= r.from && U.dayKey(l.at) <= r.to);
    const list = logs.length ? logs : (D().audit || D().auditLog || []).slice(0, 100);
    const rows = csvMetaHeader("NHẬT KÝ KIỂM SOÁT THẤT THOÁT & THAO TÁC NHẠY CẢM", r);
    rows.push(["STT", "Thời gian", "Ngày vận hành", "Thao tác", "Nhân viên thực hiện", "Chi tiết"]);
    list.forEach((l, idx) => {
      rows.push([idx + 1, U.dateTime(l.at), U.dayLabel(U.dayKey(l.at)), l.action || l.title || l.text || "", Engine.staffName(l.by || l.who), l.detail || l.reason || l.text || ""]);
    });
    const span = r.from === r.to ? r.from : r.from + "_den_" + r.to;
    U.downloadCsv("nhat_ky_kiem_soat_" + span + ".csv", rows);
    App.toast("Đã xuất nhật ký kiểm soát CSV", "success");
  }

  function pageSales() {
    const st = S();
    const r = range();
    const pr = prevRange(r);
    const bk = Engine.salesBreakdown(r.from, r.to);
    const curDays = bk.days;
    const prevDays = Engine.days(pr.from, pr.to);
    const cur = bk.summary;
    const prev = Engine.summarize(prevDays);
    const salesInRange = bk.sales;
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

    let emptyTodayHint = "";
    if (r.preset === "today" && cur.bills === 0) {
      const todayKey = U.dayKey();
      const liveToday = Engine.liveDay(todayKey);
      const [f7, t7] = Engine.rangeKeys("7d");
      const s7 = Engine.summarize(Engine.days(f7, t7));
      const yKey = shiftKey(todayKey, -1);
      const yDay = Engine.days(yKey, yKey)[0];
      if (s7.bills > 0 || liveToday.openTickets > 0) {
        emptyTodayHint = UI.banner(
          "info",
          "info",
          '<div class="row between wrap gap-8">' +
            "<div><b>Hôm nay (" + U.dayLabel(todayKey) + ") chưa có hóa đơn thanh toán hoàn tất.</b> " +
            (liveToday.openTickets ? "Hiện có <b>" + liveToday.openTickets + " bàn đang phục vụ (" + U.money(liveToday.openValue) + ")</b> chưa chốt bill. " : "") +
            (s7.bills ? "Trong 7 ngày qua có <b>" + U.num(s7.bills) + " hóa đơn (" + U.money(s7.revenue) + ")</b>" + (yDay && yDay.bills ? " — hôm qua đạt <b>" + U.money(yDay.revenue) + "</b> (" + yDay.bills + " bill)." : ".") : "") +
            "</div>" +
            '<div class="row gap-8 wrap">' +
            (yDay && yDay.bills ? UI.btn("Xem Hôm qua", { size: "sm", act: "owner.range", data: { value: "yesterday" } }) : "") +
            (s7.bills ? UI.btn("Xem 7 ngày qua", { size: "sm", kind: "primary", act: "owner.range", data: { value: "7d" } }) : "") +
            UI.btn("Xem Tháng này", { size: "sm", act: "owner.range", data: { value: "month" } }) +
            "</div></div>"
        );
      }
    }

    const activeTab = ["pl", "invoices", "items", "fraud"].includes(st.salesTab) ? st.salesTab : "pl";
    const tabBar = tabs([
      { value: "pl", label: "Thống kê doanh thu & Lãi lỗ", icon: "file-spreadsheet" },
      { value: "invoices", label: "Bảng kê hóa đơn", icon: "receipt-text", count: salesInRange.length },
      { value: "items", label: "Món bán chạy & Biên lãi", icon: "utensils" },
      { value: "fraud", label: "Chống thất thoát & Ngoại lệ", icon: "shield-alert", count: voidsAfterPrint + unlockCount + postPrebillCount },
    ], activeTab, "owner.salesTab");

    let body = "";
    if (activeTab === "pl") {
      const plRows = [
        ["Doanh thu đồ ăn & bếp", U.money(cur.food), U.pct(pct(cur.food, cur.revenue)), ""],
        ["Doanh thu bia, rượu & đồ uống", U.money(cur.alcohol), U.pct(pct(cur.alcohol, cur.revenue)), ""],
        ["Phụ thu phòng VIP", U.money(cur.vipFee), U.pct(pct(cur.vipFee, cur.revenue)), ""],
        ["Giảm giá trực tiếp trên bill", "-" + U.money(discounts), U.pct(pct(discounts, cur.revenue)), "text-danger"],
        ["Tổng doanh thu thuần", U.money(cur.revenue), cur.revenue ? "100%" : "0%", "strong"],
        ["Giá vốn nguyên liệu & đồ uống (COGS)", "-" + U.money(cur.cogs), U.pct(pct(cur.cogs, cur.revenue)), ""],
        ["Lãi gộp bán hàng", U.money(cur.gross), U.pct(margin), "strong"],
        ["Chi phí hao hụt đã duyệt", "-" + U.money(cur.wastage), U.pct(pct(cur.wastage, cur.revenue)), "text-danger"],
        ["Chi phí nhân công trong kỳ", "-" + U.money(cur.labor), U.pct(pct(cur.labor, cur.revenue)), ""],
        ["Chi phí phụ phẩm ước tính (đá, gas, than)", "-" + U.money(cur.utility), U.pct(pct(cur.utility, cur.revenue)), ""],
        ["Lợi nhuận ròng ước tính", U.money(cur.net), U.pct(pct(cur.net, cur.revenue)), "strong"],
      ].map((x) => '<tr class="' + x[3] + '"><td>' + x[0] + '</td><td class="num">' + x[1] + '</td><td class="num">' + x[2] + "</td></tr>").join("");

      const isSingleDay = r.from === r.to;
      const chart = isSingleDay ? hourChart(r.to, 210) : dailyChart(curDays, 210);
      const paySplit = statRows([
        { l: "Tiền mặt", v: U.money(cur.cash) + " (" + U.pct(pct(cur.cash, cur.revenue || 1), 0) + ")" },
        { l: "Chuyển khoản VietQR", v: U.money(cur.qr) + " (" + U.pct(pct(cur.qr, cur.revenue || 1), 0) + ")" },
        { l: "Tiền tip nhân viên qua QR", v: U.money(cur.tips || 0) },
        { l: "Chi phí phụ phẩm / Doanh thu bếp", v: U.pct(cur.utilityPct), cls: "sr-total" },
      ]);

      const th = Number(C().marginAlert) || 35;
      const dailyRows = curDays.slice().reverse().map((d) => {
        const dGross = (Number(d.revenue) || 0) - (Number(d.cogs) || 0);
        const dMg = d.revenue ? (dGross / d.revenue) * 100 : 0;
        const vipDisc = (Number(d.vipFee) || 0) - (Number(d.discount) || 0);
        const stBadge = d.dayKey === U.dayKey()
          ? UI.badge("Hôm nay", "info")
          : d.live && d.bills > 0
          ? UI.badge("Chưa chốt ca", "warning")
          : "";
        return "<tr" + (d.bills === 0 ? ' class="row-dim"' : "") + ">" +
          '<td class="nowrap"><b>' + U.dayLabel(d.dayKey) + '</b><div class="small muted">' + esc(U.weekday(U.dayStart(d.dayKey))) + (stBadge ? " · " + stBadge : "") + "</div></td>" +
          '<td class="num">' + (d.bills ? U.num(d.bills) : "-") + "</td>" +
          '<td class="num">' + (d.guests ? U.num(d.guests) : "-") + "</td>" +
          '<td class="num">' + (d.food ? U.money(d.food) : "-") + "</td>" +
          '<td class="num">' + (d.alcohol ? U.money(d.alcohol) : "-") + "</td>" +
          '<td class="num ' + (vipDisc < 0 ? "text-danger" : "") + '">' + (vipDisc ? signed(vipDisc, U.money) : "-") + "</td>" +
          '<td class="num strong">' + (d.revenue ? U.money(d.revenue) : "0 đ") + "</td>" +
          '<td class="num">' + (d.cash ? U.money(d.cash) : "-") + "</td>" +
          '<td class="num">' + (d.qr ? U.money(d.qr) : "-") + "</td>" +
          '<td class="num text-success">' + (d.tips ? "+" + U.money(d.tips) : "-") + "</td>" +
          '<td class="num">' + (d.cogs ? U.money(d.cogs) : "-") + "</td>" +
          '<td class="num strong">' + (d.revenue ? U.money(dGross) : "-") + "</td>" +
          '<td class="num">' + (d.revenue ? UI.badge(U.pct(dMg), dMg < th ? "danger" : dMg < th + 10 ? "warning" : "success") : "-") + "</td></tr>";
      }).join("");

      const totVipDisc = (Number(cur.vipFee) || 0) - (Number(cur.discount) || 0);
      const dailyFoot =
        "<td><b>TỔNG CỘNG (" + curDays.length + " ngày)</b></td>" +
        '<td class="num"><b>' + U.num(cur.bills) + "</b></td>" +
        '<td class="num"><b>' + U.num(cur.guests) + "</b></td>" +
        '<td class="num"><b>' + U.money(cur.food) + "</b></td>" +
        '<td class="num"><b>' + U.money(cur.alcohol) + "</b></td>" +
        '<td class="num"><b>' + (totVipDisc ? signed(totVipDisc, U.money) : "0 đ") + "</b></td>" +
        '<td class="num"><b>' + U.money(cur.revenue) + "</b></td>" +
        '<td class="num"><b>' + U.money(cur.cash) + "</b></td>" +
        '<td class="num"><b>' + U.money(cur.qr) + "</b></td>" +
        '<td class="num text-success"><b>' + (cur.tips ? "+" + U.money(cur.tips) : "0 đ") + "</b></td>" +
        '<td class="num"><b>' + U.money(cur.cogs) + "</b></td>" +
        '<td class="num"><b>' + U.money(cur.gross) + "</b></td>" +
        '<td class="num"><b>' + U.pct(margin) + "</b></td>";

      body = '<div class="grid-2">' +
        card("Báo cáo kết quả kinh doanh (" + r.label + ")", tbl('<th>Chỉ tiêu</th><th class="num">Số tiền</th><th class="num">Tỷ trọng</th>', plRows), {
          icon: "file-spreadsheet",
          flush: true,
          right: UI.btn("Xuất CSV P&L", { size: "sm", icon: "download", act: "owner.exportPlCsv" }),
        }) +
        '<div class="col gap-16">' +
        card(isSingleDay ? "Doanh thu theo giờ (" + U.dayLabel(r.to) + ")" : "Diễn biến doanh thu theo ngày (" + r.label + ")", chart, { icon: "chart-line" }) +
        card("Cơ cấu phương thức thanh toán", paySplit, { icon: "wallet" }) +
        "</div></div>" +
        '<div class="mt-16">' +
        card(
          "Bảng thống kê doanh thu bán hàng theo ngày (" + curDays.length + " ngày)",
          tbl(
            '<th>Ngày</th><th class="num">Bill</th><th class="num">Khách</th><th class="num">Đồ ăn & Bếp</th><th class="num">Bia rượu</th><th class="num">VIP / Giảm</th><th class="num">Doanh thu thuần</th><th class="num">Tiền mặt</th><th class="num">VietQR</th><th class="num">Tiền Tip</th><th class="num">Giá vốn</th><th class="num">Lãi gộp</th><th class="num">Biên lãi</th>',
            dailyRows,
            dailyFoot
          ),
          {
            icon: "calendar",
            flush: true,
            sub: "Tổng hợp đầy đủ cả các ca đã chốt sổ và hóa đơn thực thu từ các ca đang mở",
            right: UI.btn("Xuất CSV theo ngày", { size: "sm", kind: "primary", icon: "download", act: "owner.exportDailyCsv" }),
          }
        ) +
        "</div>";
    } else if (activeTab === "invoices") {
      const cashCnt = salesInRange.filter((s) => s.cashAmt > 0).length;
      const qrCnt = salesInRange.filter((s) => s.qrAmt > 0).length;
      const tipCnt = salesInRange.filter((s) => (s.tip || 0) > 0).length;
      const payChips = [
        { value: "all", label: "Tất cả", count: salesInRange.length },
        { value: "cash", label: "Tiền mặt", count: cashCnt },
        { value: "qr", label: "Chuyển khoản QR", count: qrCnt },
        { value: "tip", label: "Có tiền Tip", count: tipCnt },
      ];
      const filtered = filterSalesList(salesInRange, st);
      const toolbar =
        '<div class="sales-toolbar">' +
          UI.chips(payChips, st.salesPay || "all", "owner.salesPay") +
          '<div class="sales-search">' +
            UI.search({ id: "owner-sales-q", model: "owner.salesQ", value: st.salesQ || "", placeholder: "Tìm mã HĐ, mã QR, bàn, món ăn, nhân viên..." }) +
          "</div>" +
        "</div>";

      const invRows = filtered.map((s) => {
        const tb = Engine.table(s.tableId);
        const vipDisc = (Number(s.vipFee) || 0) - (Number(s.discount) || 0);
        const pmBadge = s.paymentSource === "webhook_qr"
          ? UI.badge("Webhook QR", "success")
          : s.cashAmt > 0 && s.qrAmt > 0
          ? UI.badge("TM + QR", "info")
          : s.qrAmt > 0
          ? UI.badge("VietQR", "primary")
          : UI.badge("Tiền mặt", "neutral");
        const itemsPreview = saleItemsText(s);
        return "<tr>" +
          '<td class="nowrap"><b>' + esc(s.payCode || s.id.slice(-8).toUpperCase()) + '</b><div class="small muted">' + esc(s.id) + "</div></td>" +
          '<td class="nowrap">' + U.dayLabel(s.dayKey || U.dayKey(s.closedAt)) + '<div class="small muted">' + U.time(s.openedAt) + " – " + U.time(s.closedAt) + "</div></td>" +
          '<td class="nowrap"><b>' + esc(tb ? tb.code : s.tableCode || s.tableId) + '</b><div class="small muted">' + esc(s.areaName || "") + " · " + (s.guests || 1) + " khách</div></td>" +
          '<td class="nowrap">' + esc(Engine.staffName(s.waiterId)) + '<div class="small muted">TN: ' + esc(Engine.staffName(s.cashierId)) + "</div></td>" +
          '<td class="small sale-items-cell" title="' + esc(itemsPreview) + '">' + esc(itemsPreview || "-") + "</td>" +
          '<td class="num">' + U.money(s.subtotal || s.grand || 0) + "</td>" +
          '<td class="num ' + (vipDisc < 0 ? "text-danger" : "") + '">' + (vipDisc ? signed(vipDisc, U.money) : "-") + "</td>" +
          '<td class="num strong">' + U.money(s.grand || 0) + "</td>" +
          "<td>" + pmBadge + "</td>" +
          '<td class="num text-success">' + (s.tip > 0 ? "+" + U.money(s.tip) : "-") + "</td>" +
          '<td class="right nowrap">' + UI.btn("Phiếu K80", { size: "sm", icon: "receipt", act: "owner.viewSaleReceipt", data: { id: s.id } }) + "</td></tr>";
      }).join("");

      const sumSub = U.sum(filtered, (s) => s.subtotal || s.grand || 0);
      const sumVipDisc = U.sum(filtered, (s) => (Number(s.vipFee) || 0) - (Number(s.discount) || 0));
      const sumGrand = U.sum(filtered, (s) => s.grand || 0);
      const sumTip = U.sum(filtered, (s) => s.tip || 0);
      const sumGuests = U.sum(filtered, (s) => s.guests || 0);
      const invFoot =
        '<td colspan="2"><b>TỔNG CỘNG (' + filtered.length + ' hóa đơn)</b></td>' +
        '<td><b>' + U.num(sumGuests) + " khách</b></td>" +
        '<td colspan="2"></td>' +
        '<td class="num"><b>' + U.money(sumSub) + "</b></td>" +
        '<td class="num"><b>' + (sumVipDisc ? signed(sumVipDisc, U.money) : "0 đ") + "</b></td>" +
        '<td class="num"><b>' + U.money(sumGrand) + "</b></td>" +
        "<td></td>" +
        '<td class="num text-success"><b>' + (sumTip ? "+" + U.money(sumTip) : "0 đ") + "</b></td>" +
        "<td></td>";

      body = card(
        "Sổ chi tiết hóa đơn đã thanh toán (" + filtered.length + "/" + salesInRange.length + " bill)",
        '<div class="card-body border-b">' + toolbar + "</div>" +
          (filtered.length
            ? tbl(
                '<th>Mã QR / Mã HĐ</th><th>Thời gian</th><th>Bàn / Khu</th><th>Phục vụ / Thu ngân</th><th>Món đã gọi</th><th class="num">Tiền món</th><th class="num">VIP / Giảm</th><th class="num">Doanh thu thuần</th><th>Thanh toán</th><th class="num">Tiền Tip</th><th></th>',
                invRows,
                invFoot
              )
            : UI.empty("receipt-text", "Không có hóa đơn phù hợp trong kỳ đã chọn", "Hãy thử đổi bộ lọc thời gian (7 ngày, Tháng này) hoặc xóa từ khóa tìm kiếm.")),
        {
          icon: "receipt-text",
          flush: true,
          sub: "Tra cứu từng bill, đối chiếu phương thức thanh toán, xem lại bản sao K80 và xuất bảng kê chi tiết ra CSV/Excel",
          right: UI.btn("Xuất CSV hóa đơn (" + filtered.length + ")", { size: "sm", kind: "primary", icon: "download", act: "owner.exportInvoicesCsv", data: { filtered: "1" }, disabled: !filtered.length }),
        }
      );
    } else if (activeTab === "items") {
      const th = Number(C().marginAlert) || 35;
      const items = buildItemStats(r.from, r.to);
      const rows = items.map((x) => "<tr>" +
        '<td><div class="strong">' + esc(x.name) + '</div><div class="small muted">' + esc(x.cat) + "</div></td>" +
        '<td class="num">' + (x.prc ? U.money(x.prc) + (x.isSeafood ? "/kg" : "") : "-") + "</td>" +
        '<td class="num">' + (x.cst ? U.money(x.cst) : "-") + "</td>" +
        '<td class="num">' + UI.badge(U.pct(x.mg), x.mg < th ? "danger" : x.mg < th + 10 ? "warning" : "success") + "</td>" +
        '<td class="num">' +
          (x.qty ? U.num(x.qty, x.isSeafood ? 2 : 0) + " " + esc(x.unit) : "-") +
          (x.freeQty ? '<div class="small text-success">+' + U.num(x.freeQty) + " tặng KM</div>" : "") +
        "</td>" +
        '<td class="num strong">' + (x.rev ? U.money(x.rev) : "-") + "</td>" +
        '<td class="num">' + (x.totalCost ? U.money(x.totalCost) : "-") + "</td>" +
        '<td class="num strong">' + (x.rev || x.totalCost ? U.money(x.profit) : "-") + "</td></tr>").join("");
      const totItemRev = U.sum(items, (x) => x.rev);
      const totItemCost = U.sum(items, (x) => x.totalCost);
      const totItemProfit = totItemRev - totItemCost;
      const totFree = U.sum(items, (x) => x.freeQty || 0);
      const itemFoot =
        "<td><b>TỔNG CỘNG (" + items.filter((x) => x.qty > 0 || x.freeQty > 0).length + "/" + items.length + " món phát sinh)</b></td>" +
        '<td colspan="3"></td>' +
        '<td class="num"><b>' + (totFree ? "+" + U.num(totFree) + " KM" : "-") + "</b></td>" +
        '<td class="num"><b>' + U.money(totItemRev) + "</b></td>" +
        '<td class="num"><b>' + U.money(totItemCost) + "</b></td>" +
        '<td class="num"><b>' + U.money(totItemProfit) + "</b></td>";
      body = card("Thống kê sản lượng, doanh thu & biên lãi theo món (" + r.label + ")", tbl('<th>Món</th><th class="num">Giá bán</th><th class="num">Giá vốn ĐV</th><th class="num">Biên chuẩn</th><th class="num">Sản lượng</th><th class="num">Doanh thu</th><th class="num">Tổng giá vốn</th><th class="num">Lãi gộp</th>', rows, itemFoot), {
        icon: "utensils",
        flush: true,
        sub: "Ngưỡng cảnh báo biên lãi hiện tại: " + th + "% (điều chỉnh trong Cài đặt)",
        right: UI.btn("Xuất CSV theo món", { size: "sm", kind: "primary", icon: "download", act: "owner.exportItemsCsv" }),
      });
    } else {
      const allLogs = D().audit || D().auditLog || [];
      const rangeLogs = allLogs.filter((l) => l && U.dayKey(l.at) >= r.from && U.dayKey(l.at) <= r.to);
      const logs = (rangeLogs.length ? rangeLogs : allLogs).slice(0, 50);
      const logRows = logs.map((l) => '<tr><td class="nowrap">' + U.dateTime(l.at) + "</td><td><b>" + esc(l.action || l.title || l.text || "") + "</b></td><td>" + esc(Engine.staffName(l.by || l.who)) + "</td><td>" + esc(l.detail || l.reason || l.text || "") + "</td></tr>").join("");
      body = '<div class="grid-3 mb-16">' +
        UI.kpi({ label: "Mở khóa / Sửa sau tạm tính", icon: "lock-open", value: U.num(unlockCount + postPrebillCount) + " lần", meta: unlockCount + " lần mở khóa · " + postPrebillCount + " lần trả bia sau tạm tính", tone: unlockCount + postPrebillCount > 2 ? "warn" : "" }) +
        UI.kpi({ label: "Hủy món sau khi đã gửi bếp", icon: "ban", value: U.num(voidsAfterPrint) + " món", meta: "Giá trị hủy: " + U.money(voidAmount), tone: voidsAfterPrint ? "warn" : "" }) +
        UI.kpi({ label: "Tổng giảm giá trực tiếp", icon: "badge-percent", value: U.money(discounts), meta: "Chiếm " + U.pct(pct(discounts, cur.revenue || 1)) + " doanh thu" }) +
        "</div>" +
        card(
          "Nhật ký kiểm toán các thao tác nhạy cảm",
          logRows ? tbl("<th>Thời gian</th><th>Thao tác</th><th>Nhân viên</th><th>Chi tiết</th>", logRows) : UI.empty("shield-check", "Không có thao tác nhạy cảm nào"),
          {
            icon: "shield-alert",
            flush: true,
            right: logs.length ? UI.btn("Xuất CSV nhật ký", { size: "sm", icon: "download", act: "owner.exportAuditCsv" }) : "",
          }
        );
    }

    return '<div class="page">' +
      head(
        "Bán hàng và lãi lỗ",
        "Thống kê chi tiết doanh thu theo ngày, sổ hóa đơn bán hàng, biên lãi từng món và xuất bảng kê CSV/Excel.",
        rangeSeg() + UI.btn("Xuất bảng kê CSV", { kind: "primary", size: "sm", icon: "download", act: "owner.exportSalesModal" })
      ) +
      emptyTodayHint +
      summary("Kỳ <b>" + r.label + "</b>: doanh thu thuần <b>" + U.money(cur.revenue) + "</b> (Tiền mặt <b>" + U.money(cur.cash) + "</b> · VietQR <b>" + U.money(cur.qr) + "</b>), lãi gộp <b>" + U.money(cur.gross) + "</b> (biên lãi " + U.pct(margin) + ") từ <b>" + U.num(cur.bills) + " hóa đơn</b> (" + U.num(cur.guests) + " khách).") +
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
      UI.kpi({ label: "Tổng doanh thu chịu thuế", icon: "banknote", value: U.money(tot.revenue), meta: U.monthLabel(mk) + " · " + U.num(tot.bills || 0) + " hóa đơn · " + (isCo ? "Công ty TNHH" : "Hộ kinh doanh") }) +
      UI.kpi({ label: "Thuế GTGT đồ ăn (" + C().tax.food + "%)", icon: "utensils", value: U.money(tot.vatFood), meta: "Doanh thu nhóm đồ ăn: " + U.money(tot.food) }) +
      UI.kpi({ label: "Thuế GTGT rượu bia (" + C().tax.alcohol + "%)", icon: "beer", value: U.money(tot.vatAlcohol), meta: "Doanh thu nhóm rượu bia: " + U.money(tot.alcohol) }) +
      UI.kpi({ label: isCo ? "Tổng thuế GTGT đầu ra" : "Thuế khoán HKD (" + C().tax.hkdRate + "%)", icon: "landmark", value: U.money(isCo ? totalVat : tot.hkdTax), meta: locked ? "Kỳ thuế đã khóa sổ" : "Kỳ thuế đang mở", tone: locked ? "good" : "" }) +
      "</div>";

    const dayTaxRows = tx.rows.slice().reverse().map((d) => {
      const dVat = (d.vatFood || 0) + (d.vatAlcohol || 0);
      return "<tr" + (!d.bills && !d.revenue ? ' class="row-dim"' : "") + ">" +
        '<td class="nowrap"><b>' + U.dayLabel(d.dayKey) + '</b><div class="small muted">' + esc(U.weekday(U.dayStart(d.dayKey))) + (d.live && d.bills > 0 && d.dayKey !== U.dayKey() ? " · " + UI.badge("Chưa chốt ca", "warning") : "") + "</div></td>" +
        '<td class="num">' + (d.bills ? U.num(d.bills) : "-") + "</td>" +
        '<td class="num">' + (d.food ? U.money(d.food) : "-") + "</td>" +
        '<td class="num">' + (d.vatFood ? U.money(d.vatFood) : "-") + "</td>" +
        '<td class="num">' + (d.alcohol ? U.money(d.alcohol) : "-") + "</td>" +
        '<td class="num">' + (d.vatAlcohol ? U.money(d.vatAlcohol) : "-") + "</td>" +
        '<td class="num strong">' + (d.revenue ? U.money(d.revenue) : "0 đ") + "</td>" +
        '<td class="num strong">' + (dVat ? U.money(dVat) : "-") + "</td></tr>";
    }).join("");
    const dayTaxFoot =
      "<td><b>TỔNG CỘNG (" + U.monthLabel(mk) + ")</b></td>" +
      '<td class="num"><b>' + U.num(tot.bills || 0) + "</b></td>" +
      '<td class="num"><b>' + U.money(tot.food) + "</b></td>" +
      '<td class="num"><b>' + U.money(tot.vatFood) + "</b></td>" +
      '<td class="num"><b>' + U.money(tot.alcohol) + "</b></td>" +
      '<td class="num"><b>' + U.money(tot.vatAlcohol) + "</b></td>" +
      '<td class="num"><b>' + U.money(tot.revenue) + "</b></td>" +
      '<td class="num"><b>' + U.money(totalVat) + "</b></td>";

    const invRows = tx.einvoices.slice(0, 50).map((e) => {
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
        UI.btn("Xuất bảng kê CSV", { size: "sm", kind: "primary", icon: "download", act: "owner.exportTax" }) +
        UI.btn(locked ? "Đã khóa kỳ thuế" : "Khóa sổ kỳ thuế", { size: "sm", kind: locked ? "" : "default", icon: "lock", act: "owner.lockTax", disabled: locked })
      ) +
      kpis +
      card(
        "Bảng kê doanh thu & Thuế GTGT đầu ra theo ngày · " + U.monthLabel(mk),
        tbl(
          '<th>Ngày</th><th class="num">Số bill</th><th class="num">Doanh thu đồ ăn</th><th class="num">GTGT đồ ăn (' + C().tax.food + '%)</th><th class="num">Doanh thu rượu bia</th><th class="num">GTGT rượu bia (' + C().tax.alcohol + '%)</th><th class="num">Tổng doanh thu</th><th class="num">Tổng thuế GTGT</th>',
          dayTaxRows,
          dayTaxFoot
        ),
        {
          icon: "file-spreadsheet",
          flush: true,
          sub: C().tax.pricesIncludeVat ? "Giá bán trên menu đã bao gồm thuế GTGT" : "Thuế GTGT cộng thêm trên giá chưa thuế",
          right: UI.btn("Xuất bảng kê thuế CSV", { size: "sm", icon: "download", act: "owner.exportTax" }),
        }
      ) +
      card("Yêu cầu & Hóa đơn điện tử GTGT (" + tx.einvoices.length + ")", invRows ? tbl('<th>Số tham chiếu / HĐ</th><th>Thời điểm</th><th>Đơn vị mua / Mã số thuế / Địa chỉ / Email</th><th class="num">Tổng thanh toán</th><th>Trạng thái</th>', invRows) : UI.empty("receipt-text", "Chưa có yêu cầu hoặc hóa đơn điện tử nào trong " + U.monthLabel(mk)), { icon: "receipt-text", flush: true }) +
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
            UI.btn("PostgreSQL 16", { size: "sm", icon: "database", act: "app.pgModal", cls: "owner-hide-sm" }) +
            UI.btn("Dữ liệu hệ thống", { size: "sm", icon: "hard-drive", act: "app.demoMenu", cls: "owner-hide-sm" }) +
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
      const dirtySet = window.OwnerPages.settings && window.OwnerPages.settings.isDirty && window.OwnerPages.settings.isDirty();
      const extra = NAV.slice(4).concat([SETTINGS]);
      App.sheet({
        title: "Danh mục quản trị",
        sub: "Chọn phân hệ hoặc công cụ hệ thống",
        body: () =>
          '<div class="col">' +
          extra
            .map(
              (n) =>
                '<button type="button" class="opt-card' +
                (cur === n.id ? " active" : "") +
                '" data-act="owner.navSheet" data-page="' +
                n.id +
                '"><span class="ch-icon">' +
                I(n.icon) +
                '</span><div class="grow"><b>' +
                esc(n.label) +
                "</b>" +
                (n.id === "settings" && dirtySet ? ' <span class="badge badge-warning">Chưa lưu</span>' : "") +
                '<div class="small muted">' +
                esc(n.desc) +
                "</div></div></button>"
            )
            .join("") +
          '<div class="nav-sep"></div>' +
          '<div class="small muted strong" style="padding:0 4px">Công cụ hệ thống</div>' +
          '<button type="button" class="opt-card" data-act="owner.sheetAct" data-run="app.demoMenu"><span class="ch-icon">' +
          I("hard-drive") +
          '</span><div class="grow"><b>Dữ liệu hệ thống</b><div class="small muted">Sao lưu JSON, khởi tạo quán mới, dữ liệu mẫu</div></div></button>' +
          '<button type="button" class="opt-card" data-act="owner.sheetAct" data-run="app.pgModal"><span class="ch-icon">' +
          I("database") +
          '</span><div class="grow"><b>Cơ sở dữ liệu PostgreSQL 16</b><div class="small muted">Kiểm tra kết nối 37 bảng và truy vấn SQL</div></div></button>' +
          '<button type="button" class="opt-card" data-act="owner.sheetAct" data-run="app.logout"><span class="ch-icon" style="color:var(--danger);background:var(--danger-50)">' +
          I("log-out") +
          '</span><div class="grow"><b class="text-danger">Đăng xuất</b><div class="small muted">Thoát tài khoản trên thiết bị này</div></div></button>' +
          "</div>",
      });
    },
    "owner.navSheet": (d) => {
      App.closeModal();
      App.go("owner", d.page);
    },
    "owner.sheetAct": (d) => {
      App.closeModal();
      if (d && d.run) App.run(d.run);
    },
    "owner.range": (d) => {
      const st = S();
      st.range = d.value;
      st._rangeManual = true;
      if (d.value === "custom") {
        const today = U.dayKey();
        if (!st.customFrom) st.customFrom = shiftKey(today, -6);
        if (!st.customTo) st.customTo = today;
      }
      App.render();
    },
    "owner.quickSalesRange": (d) => {
      const st = S();
      if (d.range) {
        st.range = d.range;
        st._rangeManual = true;
      }
      App.go("owner", "sales");
    },
    "owner.customFrom": (d, el) => {
      if (!el.value) return;
      S().customFrom = el.value;
      S().range = "custom";
      S()._rangeManual = true;
      App.render();
    },
    "owner.customTo": (d, el) => {
      if (!el.value) return;
      S().customTo = el.value;
      S().range = "custom";
      S()._rangeManual = true;
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
    "owner.salesPay": (d) => {
      S().salesPay = d.value || "all";
      App.render();
    },
    "owner.viewSaleReceipt": (d) => {
      const s = Engine.saleById(d.id);
      if (!s) return App.toast("Không tìm thấy hóa đơn.", "error");
      const doc = Engine.saleReceiptDoc(s);
      const tb = Engine.table(s.tableId);
      App.modal({
        title: "Hóa đơn K80 · Bàn " + (tb ? tb.code : s.tableCode || s.tableId),
        sub: U.dayLabel(s.dayKey || U.dayKey(s.closedAt)) + " · " + U.time(s.closedAt) + (s.payCode ? " · Mã QR: " + s.payCode : ""),
        size: "sm",
        body: () => UI.receipt(doc),
        foot: () => UI.btn("In ra máy in K80", { icon: "printer", act: "app.printK80" }) + UI.btn("Đóng", { kind: "primary", act: "app.closeModal" }),
      });
    },
    "owner.exportSalesModal": () => {
      App.modal({
        title: "Xuất bảng kê doanh thu bán hàng (CSV / Excel)",
        sub: () => {
          const r = range();
          const bk = Engine.salesBreakdown(r.from, r.to);
          return "Kỳ đang chọn: " + r.label + " (" + U.dayLabel(r.from) + " – " + U.dayLabel(r.to) + ") · " + bk.sales.length + " hóa đơn · " + U.money(bk.summary.revenue);
        },
        size: "md",
        body: () => {
          const r = range();
          const bk = Engine.salesBreakdown(r.from, r.to);
          const items = buildItemStats(r.from, r.to);
          const soldItemsCount = items.filter((x) => x.qty > 0 || x.freeQty > 0).length;
          return '<div class="col gap-12">' +
            '<div><div class="small strong mb-6">Chọn kỳ thời gian xuất bảng kê:</div>' + rangeSeg() + "</div>" +
            '<div class="export-grid">' +
              '<button type="button" class="opt-card export-opt" data-act="owner.exportDailyCsv">' +
                '<span class="ch-icon">' + I("calendar") + "</span>" +
                '<div class="grow"><b>1. Bảng kê doanh thu tổng hợp theo ngày (.csv)</b><div class="small muted">' + bk.days.length + " ngày · Đầy đủ số bill, khách, đồ ăn, bia rượu, tiền mặt, VietQR, Tip, giá vốn & lãi gộp mỗi ngày</div></div>" +
                UI.badge("Tải CSV", "primary") +
              "</button>" +
              '<button type="button" class="opt-card export-opt" data-act="owner.exportInvoicesCsv">' +
                '<span class="ch-icon">' + I("receipt-text") + "</span>" +
                '<div class="grow"><b>2. Bảng kê chi tiết từng hóa đơn bán hàng (.csv)</b><div class="small muted">' + bk.sales.length + " hóa đơn · Mã HĐ, Mã QR, giờ vào/ra, bàn, nhân viên, chi tiết món, thuế GTGT, giá vốn & lãi gộp từng bill</div></div>" +
                UI.badge("Tải CSV", "primary") +
              "</button>" +
              '<button type="button" class="opt-card export-opt" data-act="owner.exportItemsCsv">' +
                '<span class="ch-icon">' + I("utensils") + "</span>" +
                '<div class="grow"><b>3. Bảng kê sản lượng & lợi nhuận theo món (.csv)</b><div class="small muted">' + soldItemsCount + "/" + items.length + " mặt hàng phát sinh · Giá bán, giá vốn, sản lượng bán, tặng KM, doanh thu & lãi gộp</div></div>" +
                UI.badge("Tải CSV", "primary") +
              "</button>" +
              '<button type="button" class="opt-card export-opt" data-act="owner.exportPlCsv">' +
                '<span class="ch-icon">' + I("file-spreadsheet") + "</span>" +
                '<div class="grow"><b>4. Báo cáo kết quả kinh doanh P&L (.csv)</b><div class="small muted">Tổng hợp doanh thu, giá vốn, chi phí hao hụt, nhân công, phụ phẩm & so sánh kỳ trước</div></div>' +
                UI.badge("Tải CSV", "primary") +
              "</button>" +
            "</div>" +
            '<div class="small muted">Định dạng chuẩn UTF-8 có BOM — mở trực tiếp bằng <b>Microsoft Excel</b> hoặc <b>Google Sheets</b> hiển thị chuẩn tiếng Việt có dấu và cột số nguyên để tính tổng ngay.</div>' +
          "</div>";
        },
        foot: () => UI.btn("Đóng", { kind: "primary", act: "app.closeModal" }),
      });
    },
    "owner.exportDailyCsv": () => exportSalesDailyCsv(),
    "owner.exportInvoicesCsv": (d) => exportSalesInvoicesCsv(d && d.filtered === "1"),
    "owner.exportItemsCsv": () => exportSalesItemsCsv(),
    "owner.exportPlCsv": () => exportSalesPlCsv(),
    "owner.exportAuditCsv": () => exportSalesAuditCsv(),
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
      const rows = [
        ["BẢNG TỔNG HỢP LƯƠNG NHÂN VIÊN — " + U.monthLabel(mk).toUpperCase()],
        ["Đơn vị", C().store.name || "Quán Nhậu OS", "Kỳ lương", mk, "Xuất lúc", U.dateTime(Date.now())],
        [],
        ["Mã NV", "Họ tên", "Vai trò", "Ngày công", "Giờ chuẩn", "Giờ tăng ca", "Lương cơ bản (đ)", "Tăng ca & ca đêm (đ)", "Thưởng & Tip (đ)", "Phạt & Đền (đ)", "Đã ứng (đ)", "Thực lĩnh (đ)"],
      ];
      const staffList = D().staff.filter((s) => s.payType && s.payType !== "none").map((s) => ({ s, p: Engine.payroll(s.id, mk) }));
      staffList.forEach(({ s, p }) => {
        rows.push([s.id, s.name, Engine.roleLabel(s.role), p.days, p.regular, p.ot, p.base, (p.otPay || 0) + (p.nightPay || 0), (p.commission || 0) + (p.tips || 0), (p.late || 0) + (p.deductions || 0), p.advances, p.net]);
      });
      rows.push([
        "TỔNG CỘNG", staffList.length + " nhân sự", "",
        U.sum(staffList, (x) => x.p.days),
        Number(U.sum(staffList, (x) => x.p.regular).toFixed(1)),
        Number(U.sum(staffList, (x) => x.p.ot).toFixed(1)),
        U.sum(staffList, (x) => x.p.base),
        U.sum(staffList, (x) => (x.p.otPay || 0) + (x.p.nightPay || 0)),
        U.sum(staffList, (x) => (x.p.commission || 0) + (x.p.tips || 0)),
        U.sum(staffList, (x) => (x.p.late || 0) + (x.p.deductions || 0)),
        U.sum(staffList, (x) => x.p.advances),
        U.sum(staffList, (x) => x.p.net),
      ]);
      U.downloadCsv("bang_luong_" + mk + ".csv", rows);
      App.toast("Đã tải xuống file CSV bảng lương " + U.monthLabel(mk), "success");
    },
    "owner.exportTax": () => {
      const mk = curMonth();
      const tx = Engine.taxReport(mk);
      const tot = tx.tot;
      const rows = [
        ["BẢNG KÊ DOANH THU CHỊU THUẾ & HÓA ĐƠN ĐIỆN TỬ — " + U.monthLabel(mk).toUpperCase()],
        ["Đơn vị", C().store.name || "Quán Nhậu OS", "Chế độ kế toán", C().tax.mode === "company" ? "Công ty TNHH" : "Hộ kinh doanh", "Xuất lúc", U.dateTime(Date.now())],
        [],
        ["CHỈ TIÊU TỔNG HỢP KỲ THUẾ", "SỐ TIỀN (VNĐ)"],
        ["Kỳ thuế", mk],
        ["Tổng số hóa đơn phát sinh", tot.bills || 0],
        ["Tổng doanh thu chịu thuế", tot.revenue],
        ["Doanh thu nhóm đồ ăn & dịch vụ", tot.food],
        ["Thuế GTGT đồ ăn (" + C().tax.food + "%)", tot.vatFood],
        ["Doanh thu nhóm rượu bia", tot.alcohol],
        ["Thuế GTGT rượu bia (" + C().tax.alcohol + "%)", tot.vatAlcohol],
        ["Tổng thuế GTGT đầu ra", tot.vatFood + tot.vatAlcohol],
        ["Thuế khoán HKD ước tính (" + C().tax.hkdRate + "%)", tot.hkdTax],
        [],
        ["BẢNG KÊ DOANH THU & THUẾ GTGT THEO NGÀY"],
        ["Ngày", "Thứ", "Số hóa đơn", "Doanh thu đồ ăn (đ)", "Thuế GTGT đồ ăn (đ)", "Doanh thu rượu bia (đ)", "Thuế GTGT rượu bia (đ)", "Tổng doanh thu (đ)", "Tổng thuế GTGT (đ)"],
      ];
      (tx.rows || []).forEach((d) => {
        rows.push([
          U.dayLabel(d.dayKey),
          U.weekday(U.dayStart(d.dayKey)),
          d.bills || 0,
          d.food || 0,
          d.vatFood || 0,
          d.alcohol || 0,
          d.vatAlcohol || 0,
          d.revenue || 0,
          (d.vatFood || 0) + (d.vatAlcohol || 0),
        ]);
      });
      rows.push([
        "TỔNG CỘNG",
        (tx.rows || []).length + " ngày",
        tot.bills || 0,
        tot.food,
        tot.vatFood,
        tot.alcohol,
        tot.vatAlcohol,
        tot.revenue,
        tot.vatFood + tot.vatAlcohol,
      ]);
      rows.push([]);
      rows.push(["DANH SÁCH YÊU CẦU & HÓA ĐƠN ĐIỆN TỬ GTGT TRONG KỲ"]);
      rows.push(["Số HĐ / Tham chiếu", "Thời điểm", "Đơn vị mua", "Mã số thuế", "Địa chỉ", "Email", "Số tiền (đ)", "Trạng thái"]);
      (tx.einvoices || []).forEach((e) => {
        rows.push([e.invoiceNo || e.id, U.dateTime(e.at), e.company || "", e.taxCode || "", e.address || "", e.email || "", e.amount || 0, e.status === "requested" ? "Chờ xuất" : "Đã phát hành"]);
      });
      U.downloadCsv("bao_cao_thue_" + mk + ".csv", rows);
      App.toast("Đã xuất bảng kê thuế & doanh thu " + U.monthLabel(mk), "success");
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
        sh.autoLockedAt = sh.autoLockedAt || Date.now();
      }, "Đã mở khóa ca thu ngân hiện tại");
      App.render();
    },
  });
})();
