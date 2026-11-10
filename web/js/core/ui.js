/* =========================================================================
   ui.js - Thanh phan giao dien dung chung (tra ve chuoi HTML)
   ========================================================================= */
(function () {
  const I = U.icon, esc = U.esc;
  const UI = {};

  function dataAttrs(d) {
    if (!d) return "";
    return Object.keys(d).map((k) => " data-" + k + '="' + esc(d[k]) + '"').join("");
  }
  UI.data = dataAttrs;

  UI.btn = function (label, o) {
    o = o || {};
    const cls = ["btn", o.kind ? "btn-" + o.kind : "", o.size ? "btn-" + o.size : "", o.block ? "btn-block" : "", o.cls || ""].join(" ");
    return '<button type="button" class="' + cls + '"' + (o.act ? ' data-act="' + o.act + '"' : "") + dataAttrs(o.data) + (o.disabled ? " disabled" : "") + (o.title ? ' title="' + esc(o.title) + '"' : "") + (o.id ? ' id="' + o.id + '"' : "") + ">" + (o.icon ? I(o.icon) : "") + (label ? "<span>" + esc(label) + "</span>" : "") + (o.kbd ? '<span class="kbd">' + esc(o.kbd) + "</span>" : "") + "</button>";
  };
  UI.iconBtn = function (icon, o) {
    o = o || {};
    return '<button type="button" class="btn btn-icon ' + (o.kind ? "btn-" + o.kind : "btn-ghost") + " " + (o.size ? "btn-" + o.size : "") + '"' + (o.act ? ' data-act="' + o.act + '"' : "") + dataAttrs(o.data) + ' title="' + esc(o.title || "") + '" aria-label="' + esc(o.title || "") + '">' + I(icon) + "</button>";
  };

  UI.kpi = function (o) {
    const tone = o.tone ? " kpi-" + o.tone : "";
    const tag = o.act ? "button" : "div";
    return "<" + tag + ' class="kpi' + tone + '"' + (o.act ? ' type="button" data-act="' + o.act + '"' : "") + dataAttrs(o.data) + ">" +
      '<div class="kpi-label">' + (o.icon ? I(o.icon) : "") + "<span>" + esc(o.label) + "</span></div>" +
      '<div class="kpi-value">' + o.value + "</div>" +
      (o.meta ? '<div class="kpi-meta">' + o.meta + "</div>" : "") + "</" + tag + ">";
  };

  UI.badge = function (text, tone, dot) {
    return '<span class="badge ' + (tone ? "badge-" + tone : "") + '">' + (dot ? '<span class="dot"></span>' : "") + esc(text) + "</span>";
  };
  UI.count = (n) => (n ? '<span class="count">' + n + "</span>" : "");

  UI.empty = function (icon, title, text, action) {
    return '<div class="empty">' + I(icon) + "<h4>" + esc(title) + "</h4>" + (text ? "<p>" + esc(text) + "</p>" : "") + (action || "") + "</div>";
  };
  UI.banner = function (tone, icon, html) {
    return '<div class="banner banner-' + tone + '">' + I(icon) + "<div>" + html + "</div></div>";
  };

  UI.seg = function (options, active, act, o) {
    o = o || {};
    return '<div class="seg ' + (o.block ? "seg-block " : "") + (o.lg ? "seg-lg" : "") + '">' + options.map((op) => '<button type="button" class="' + (op.value === active ? "active" : "") + '" data-act="' + act + '" data-value="' + esc(op.value) + '"' + dataAttrs(o.data) + ">" + esc(op.label) + "</button>").join("") + "</div>";
  };
  UI.chips = function (options, active, act) {
    return '<div class="chips">' + options.map((op) => '<button type="button" class="chip ' + (op.value === active ? "active" : "") + '" data-act="' + act + '" data-value="' + esc(op.value) + '">' + esc(op.label) + (op.count !== undefined ? ' <span class="count">' + op.count + "</span>" : "") + "</button>").join("") + "</div>";
  };
  UI.steps = function (labels, current) {
    return '<div class="steps">' + labels.map((l, i) => '<div class="st ' + (i < current ? "done" : i === current ? "current" : "") + '"><i></i><span>' + (i + 1) + ". " + esc(l) + "</span></div>").join("") + "</div>";
  };
  UI.progress = function (pct, tone) {
    return '<div class="progress ' + (tone || "") + '"><span style="width:' + Math.max(0, Math.min(100, pct)).toFixed(1) + '%"></span></div>';
  };
  UI.switchInput = function (o) {
    return '<label class="switch"><input type="checkbox"' + (o.checked ? " checked" : "") + (o.model ? ' data-model="' + o.model + '"' : "") + (o.change ? ' data-change="' + o.change + '"' : "") + dataAttrs(o.data) + '><span></span></label>';
  };
  UI.avatar = (name, lg) => '<span class="avatar ' + (lg ? "avatar-lg" : "") + '">' + esc(U.initials(name)) + "</span>";
  UI.qr = (text) => U.qrSvg(text);

  UI.field = function (label, control, o) {
    o = o || {};
    return '<div class="field ' + (o.cls || "") + '">' + (label ? "<label" + (o.for ? ' for="' + o.for + '"' : "") + ">" + esc(label) + "</label>" : "") + control + (o.help ? '<div class="help">' + esc(o.help) + "</div>" : "") + (o.err ? '<div class="err">' + esc(o.err) + "</div>" : "") + "</div>";
  };
  UI.input = function (o) {
    return '<input class="input ' + (o.cls || "") + '" type="' + (o.type || "text") + '"' + (o.id ? ' id="' + o.id + '"' : "") + (o.model ? ' data-model="' + o.model + '"' : "") + (o.live ? " data-live" : "") + ' value="' + esc(o.value === undefined || o.value === null ? "" : o.value) + '"' + (o.placeholder ? ' placeholder="' + esc(o.placeholder) + '"' : "") + (o.inputmode ? ' inputmode="' + o.inputmode + '"' : "") + (o.min !== undefined ? ' min="' + o.min + '"' : "") + (o.max !== undefined ? ' max="' + o.max + '"' : "") + (o.step ? ' step="' + o.step + '"' : "") + (o.maxlength ? ' maxlength="' + o.maxlength + '"' : "") + (o.change ? ' data-change="' + o.change + '"' : "") + dataAttrs(o.data) + (o.autofocus ? " autofocus" : "") + (o.disabled ? " disabled" : "") + ' autocomplete="off">';
  };
  UI.select = function (o) {
    return '<select class="select ' + (o.cls || "") + '"' + (o.id ? ' id="' + o.id + '"' : "") + (o.model ? ' data-model="' + o.model + '"' : "") + (o.live ? " data-live" : "") + (o.change ? ' data-change="' + o.change + '"' : "") + dataAttrs(o.data) + ">" + o.options.map((op) => '<option value="' + esc(op.value) + '"' + (String(op.value) === String(o.value) ? " selected" : "") + ">" + esc(op.label) + "</option>").join("") + "</select>";
  };
  UI.textarea = function (o) {
    return '<textarea class="textarea"' + (o.id ? ' id="' + o.id + '"' : "") + (o.model ? ' data-model="' + o.model + '"' : "") + (o.placeholder ? ' placeholder="' + esc(o.placeholder) + '"' : "") + ' rows="' + (o.rows || 3) + '">' + esc(o.value || "") + "</textarea>";
  };
  UI.search = function (o) {
    return '<div class="search">' + I("search") + UI.input(Object.assign({ live: true }, o)) + "</div>";
  };

  UI.legend = function () {
    return '<div class="legend">' + [["empty", "Trống"], ["booked", "Đặt trước"], ["active", "Đang phục vụ"], ["weigh", "Chờ cân"], ["locked", "Đã in tạm tính"], ["dirty", "Cần dọn"]].map((x) => '<span><i class="l-' + x[0] + '"></i>' + x[1] + "</span>").join("") + "</div>";
  };
  // Mot o ban tren so do
  UI.tile = function (table, st, o) {
    o = o || {};
    const vip = table.type === "vip";
    return '<button type="button" class="tile s-' + st.status + (vip ? " tile-vip" : "") + (o.selected ? " selected" : "") + '" data-act="' + (o.act || "") + '" data-table="' + table.id + '" title="' + esc(table.code + " - " + Engine.STATUS_LABEL[st.status] + (st.waiterName ? " (" + st.waiterName + ")" : "")) + '">' +
      '<span class="tile-code">' + esc(table.code) + "</span>" +
      (st.icon ? '<span class="tile-corner">' + I(st.icon, "ic-sm") + "</span>" : "") +
      '<span class="tile-status">' + esc(st.label) + "</span>" +
      '<span class="tile-sub">' + esc(st.sub || "") + (o.extra || "") + "</span></button>";
  };
  // So do ban theo khu vuc. o: {act, selected, filter(table, st) -> bool, areaId, statusFilter}
  UI.floor = function (o) {
    o = o || {};
    const cfg = Store.config;
    const now = Date.now();
    const selId = o.selected || o.selectedId;
    let html = "";
    cfg.areas.forEach((a) => {
      if (o.areaId && o.areaId !== "all" && o.areaId !== a.id) return;
      const tables = cfg.tables.filter((t) => t.areaId === a.id).map((t) => ({ t, st: Engine.tableStatus(t, now) })).filter((x) => (!o.filter || o.filter(x.t, x.st)) && (!o.statusFilter || o.statusFilter === "all" || o.statusFilter === x.st.status));
      if (!tables.length) return;
      const busy = tables.filter((x) => x.st.status !== "empty" && x.st.status !== "booked").length;
      html += '<div class="floor-area"><div class="floor-area-title"><span>' + esc(a.name) + "</span><span>" + busy + "/" + tables.length + " bàn có khách</span></div>" +
        '<div class="floor">' + tables.map((x) => UI.tile(x.t, x.st, { act: o.act, selected: selId === x.t.id, extra: o.extra ? o.extra(x.t, x.st) : "" })).join("") + "</div></div>";
    });
    return html || UI.empty("layout-grid", "Không có bàn phù hợp", "Thử đổi bộ lọc khu vực hoặc trạng thái.");
  };

  /* ---------- Tong tien bill & VietQR ---------- */
  UI.totals = function (tk) {
    if (!tk) return "";
    const tot = Engine.totals(tk);
    const r = (l, v, cls) => '<div class="tot-row ' + (cls || "") + '"><span>' + esc(l) + '</span><span class="num">' + esc(v) + "</span></div>";
    let h = '<div class="bill-totals">';
    h += r("Tạm tính tiền món", U.money(tot.subtotal));
    if (tot.vip) {
      h += r("Phụ thu phòng VIP (" + tot.vip.hours + " giờ)" + (tot.vip.waived ? " - đã miễn" : ""), tot.vip.waived ? "0 đ" : U.money(tot.vipFee));
    }
    if (tot.discount > 0) h += r("Giảm giá", "-" + U.money(tot.discount), "text-success");
    if (!tot.inc && tot.vatTotal > 0) h += r("Thuế GTGT", "+" + U.money(tot.vatTotal));
    if (tot.deposit > 0) h += r("Trừ tiền đặt cọc", "-" + U.money(tot.deposit), "text-primary");
    if (tot.paid > 0) h += r("Đã thu 1 phần (QR/TM)", "-" + U.money(tot.paid), "text-success");
    const need = tot.due !== undefined ? tot.due : Math.max(0, tot.grand - tot.deposit - (tot.paid || 0));
    h += r(tot.deposit > 0 || tot.paid > 0 ? "Còn phải thanh toán" : "Tổng thanh toán", U.money(need), "tot-grand");
    if (tot.inc) {
      const vNotes = Object.keys(tot.vat || {}).filter((g) => tot.vat[g].gross > 0).map((g) => (g === "food" ? "Đồ ăn " : "Bia rượu ") + tot.vat[g].rate + "%: " + U.money(tot.vat[g].vat));
      if (vNotes.length) h += '<div class="small muted mt-4">Giá đã gồm thuế GTGT (' + esc(vNotes.join(" · ")) + ")</div>";
    }
    return h + "</div>";
  };

  UI.qrBox = function (o) {
    o = o || {};
    const s = Store.config.store || {};
    const payload = U.vietQr(s.bankBin || "970436", s.bankAccount || "00000000", o.amount || 0, o.memo || "");
    return '<div class="qr-box">' +
      (o.caption ? '<div class="small strong">' + esc(o.caption) + "</div>" : "") +
      U.qrSvg(payload, o.size || 168) +
      '<div class="qr-bank"><b>' + esc(s.bankName || s.bankBin || "Ngân hàng") + " · " + esc(s.bankAccount || "") + "</b>" +
      "<div>" + esc(s.accountName || s.bankHolder || "") + "</div>" +
      '<div class="strong num text-primary" style="font-size:15px;margin-top:4px">' + U.money(o.amount || 0) + "</div>" +
      (o.memo ? '<div class="mt-4"><span class="badge badge-info">Nội dung CK: <b>' + esc(o.memo) + "</b></span></div>" : "") +
      "</div></div>";
  };

  /* ---------- Phieu in K80 ---------- */
  UI.receipt = function (doc) {
    if (!doc) return "";
    if (Array.isArray(doc.lines)) {
      const renderLine = (ln) => {
        if (!ln) return "";
        if (ln.t === "sep" || ln.t === "sep2") return "<div class='r-sep'></div>";
        if (ln.t === "centerHuge") return '<div class="r-center r-huge">' + esc(ln.text || "") + "</div>";
        if (ln.t === "centerBig") return '<div class="r-center r-big">' + esc(ln.text || "") + "</div>";
        if (ln.t === "center") return '<div class="r-center small">' + esc(ln.text || "") + "</div>";
        if (ln.t === "note") return '<div class="small muted">' + esc(ln.text || "") + "</div>";
        if (ln.t === "qr") return '<div class="r-qr">' + U.qrSvg(ln.data || "") + "</div>";
        if (ln.t === "row") return '<div class="r-row' + (ln.bold || ln.big ? " r-big" : "") + '"><span>' + esc(ln.l || "") + "</span><span>" + esc(ln.r || "") + "</span></div>";
        return '<div>' + esc(ln.text || ln.l || "") + "</div>";
      };
      return '<div class="receipt">' + doc.lines.map(renderLine).join("") + "</div>";
    }
    const row = (r) => (r.r !== undefined ? '<div class="r-row' + (r.bold ? " r-big" : "") + '"><span>' + esc(r.l) + "</span><span>" + esc(r.r) + "</span></div>" : '<div class="' + (r.big ? "r-big" : r.small ? "small" : "") + '">' + esc(r.l) + "</div>");
    let h = '<div class="receipt' + (doc.superseded ? ' receipt-superseded' : '') + '">';
    if (doc.superseded) {
      h += '<div style="background:#FEE2E2;color:#B91C1C;border:1.5px dashed #DC2626;border-radius:6px;padding:6px 8px;margin-bottom:8px;text-align:center;font-weight:700;font-size:12px">' +
        '<div>PHIẾU TẠM TÍNH CŨ — ĐÃ HẾT HIỆU LỰC</div>' +
        (doc.invalidatedReason ? '<div style="font-weight:500;font-size:11px;margin-top:2px">' + esc(doc.invalidatedReason) + '</div>' : '') +
        '</div>';
    }
    if (doc.header) h += '<div class="r-center">' + doc.header.map((x, i) => (i === 0 ? '<div class="r-big">' + esc(x) + "</div>" : "<div>" + esc(x) + "</div>")).join("") + "</div><div class='r-sep'></div>";
    h += '<div class="r-center r-big">' + esc(doc.title) + "</div>";
    if (doc.big) h += '<div class="r-center r-huge">' + esc(doc.big) + "</div>";
    if (doc.meta) h += doc.meta.map(row).join("") + "<div class='r-sep'></div>";
    else h += "<div class='r-sep'></div>";
    if (doc.rows) h += doc.rows.map(row).join("");
    if (doc.sumRows) h += "<div class='r-sep'></div>" + doc.sumRows.map(row).join("");
    if (doc.payments && doc.payments.length) h += "<div class='r-sep'></div>" + doc.payments.map((p) => row({ l: p.method === "cash" ? "Tiền mặt" : p.method === "qr" ? "Chuyển khoản VietQR" : "Thẻ", r: U.moneyPlain(p.amount) })).join("") + (doc.change ? row({ l: "Tiền thối", r: U.moneyPlain(doc.change) }) : "") + (doc.tip ? row({ l: "Tiền tip cho nhân viên", r: U.moneyPlain(doc.tip) }) : "");
    if (doc.vatNote && doc.vatNote.length) h += '<div class="small">' + doc.vatNote.map(esc).join("<br>") + "</div>";
    if (doc.qr) h += "<div class='r-sep'></div><div class='r-qr'>" + U.qrSvg(doc.qr) + "</div>" + (doc.qrLabel ? '<div class="r-center small">' + esc(doc.qrLabel) + "</div>" : "");
    if (doc.saleId) h += '<div class="r-center small">Mã tra cứu: ' + esc(doc.saleId.slice(-8).toUpperCase()) + "</div>";
    if (doc.footer && doc.footer.length) h += "<div class='r-sep'></div>" + doc.footer.map((f) => '<div class="r-center small">' + esc(f) + "</div>").join("");
    h += '<div class="r-center small" style="margin-top:6px;color:#666">' + esc((doc.printerName || "") + (doc.at ? " · " + U.time(doc.at) : "")) + (doc.rerouted ? "<br>In thay cho: " + esc(doc.rerouted) : "") + "</div>";
    return h + "</div>";
  };

  /* ---------- Phieu luong tam tinh ---------- */
  UI.payslip = function (p, o) {
    o = o || {};
    const r = (l, v, minus, sub) => '<div class="ps-row"><span>' + esc(l) + (sub ? '<div class="small muted">' + esc(sub) + "</div>" : "") + '</span><span class="' + (minus ? "ps-minus" : "") + ' strong">' + (minus && v ? "-" : "") + U.money(v) + "</span></div>";
    const st = p.staff;
    let rows = "";
    rows += r(st.payType === "hourly" ? "Lương giờ công" : "Lương cơ bản theo ngày công", p.base, false, st.payType === "hourly" ? U.num(p.regular, 1) + " giờ x " + U.money(p.rate) : p.days + " ngày công / " + Store.config.payroll.workDaysPerMonth);
    if (p.otPay || p.ot) rows += r("Tăng ca", p.otPay, false, U.num(p.ot, 1) + " giờ x hệ số " + Store.config.attendance.otMultiplier);
    if (p.nightPay) rows += r("Phụ cấp ca đêm", p.nightPay, false, U.num(p.night, 1) + " giờ sau " + Store.config.attendance.nightStart);
    rows += r(st.role === "pg" ? "Hoa hồng sản lượng" : "Thưởng bán hàng", p.commission);
    if (p.tips || st.role === "waiter") rows += r("Tiền tip khách chuyển khoản", p.tips);
    if (p.late) rows += r("Phạt đi trễ", p.late, true, p.lateCount + " lần");
    if (p.deductions) rows += r("Bồi hoàn hao hụt", p.deductions, true);
    if (p.advances) rows += r("Đã ứng lương", p.advances, true);
    if (p.tipsPaidCash) rows += r("Tip đã nhận tiền mặt tại quầy", p.tipsPaidCash, true);
    return '<div class="payslip">' +
      '<div class="row between"><div><div class="muted small">Thực lĩnh tạm tính ' + esc(U.monthLabel(p.monthKey).toLowerCase()) + '</div><div class="ps-total num">' + U.money(p.net) + "</div></div>" + (o.action || "") + "</div>" +
      (p.pendingOt ? '<div class="mt-8">' + UI.badge(U.num(p.pendingOt, 1) + " giờ tăng ca đang chờ duyệt", "warning") + "</div>" : "") +
      '<div class="mt-12">' + rows + "</div></div>";
  };

  /* ---------- Ban phim so ---------- */
  UI.numpad = function (act, o) {
    o = o || {};
    const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", o.left || "clear", "0", "back"];
    return '<div class="numpad ' + (o.cls || "") + '">' + keys.map((k) => {
      if (k === "clear") return '<button type="button" class="np-muted" data-act="' + act + '" data-key="clear">Xóa</button>';
      if (k === "back") return '<button type="button" class="np-muted" data-act="' + act + '" data-key="back" aria-label="Xóa lùi">' + I("delete") + "</button>";
      if (k === "000") return '<button type="button" data-act="' + act + '" data-key="000">000</button>';
      if (k === ",") return '<button type="button" data-act="' + act + '" data-key=",">,</button>';
      return '<button type="button" data-act="' + act + '" data-key="' + k + '">' + k + "</button>";
    }).join("") + "</div>";
  };
  UI.pinDots = function (len, error) {
    let h = '<div class="pin-dots ' + (error ? "error" : "") + '">';
    for (let i = 0; i < 4; i++) h += '<i class="' + (i < len ? "on" : "") + '"></i>';
    return h + "</div>";
  };
  // Cap nhat chuoi so tu phim bam
  UI.applyKey = function (cur, key, max) {
    cur = String(cur || "");
    if (key === "clear") return "";
    if (key === "back") return cur.slice(0, -1);
    if (key === "," && cur.includes(",")) return cur;
    const next = cur + key;
    if (max && next.replace(",", "").length > max) return cur;
    return next.replace(/^0+(?=\d)/, "");
  };

  UI.barChart = function (data, o) {
    o = o || {};
    const max = Math.max.apply(null, data.map((d) => d.value).concat([1]));
    return '<div class="bar-chart" style="height:' + (o.height || 180) + 'px">' + data.map((d) => '<div class="bc-col"><div class="bc-bar ' + (d.hl ? "hl" : "") + '" style="height:' + Math.max(2, (d.value / max) * 100).toFixed(1) + '%"><span class="bc-tip">' + esc(d.tip || U.money(d.value)) + '</span></div><span class="bc-label">' + esc(d.label) + "</span></div>").join("") + "</div>";
  };
  UI.hbars = function (rows) {
    const max = Math.max.apply(null, rows.map((r) => r.value).concat([1]));
    return '<div class="hbar">' + rows.map((r) => '<div class="hb-row"><span class="truncate">' + esc(r.label) + '</span><div class="hb-track"><span style="width:' + ((r.value / max) * 100).toFixed(1) + "%;" + (r.color ? "background:" + r.color : "") + '"></span></div><span class="right num strong">' + esc(r.text || U.money(r.value)) + "</span></div>").join("") + "</div>";
  };

  // Thanh tieu de dung chung
  UI.topbar = function (o) {
    const me = App.me();
    return '<header class="topbar">' +
      '<div class="brand"><span class="brand-mark">' + esc(U.initials(Store.config.store.name).slice(0, 2)) + '</span><span class="truncate" style="max-width:220px">' + esc(Store.config.store.name) + "</span></div>" +
      (o.role ? '<span class="role-tag">' + esc(o.role) + "</span>" : "") +
      '<div class="grow">' + (o.center || "") + "</div>" +
      (o.right || "") +
      (me && !o.hideUser ? '<div class="user-chip">' + UI.avatar(me.name) + '<div class="col gap-4" style="gap:0"><b class="small">' + esc(me.name) + '</b><span class="small muted">' + esc(Engine.roleLabel(me.role)) + "</span></div>" + UI.iconBtn("log-out", { act: "app.logout", title: "Đăng xuất" }) + "</div>" : "") +
      "</header>";
  };

  UI.bottomNav = function (items, active, act) {
    return '<nav class="bottom-nav">' + items.map((it) => '<button type="button" class="' + (it.value === active ? "active" : "") + '" data-act="' + act + '" data-value="' + it.value + '">' + U.icon(it.icon) + "<span>" + esc(it.label) + "</span>" + (it.count ? '<span class="count">' + it.count + "</span>" : "") + "</button>").join("") + "</nav>";
  };

  UI.cameraSim = function (o) {
    o = o || {};
    return '<div class="camera-sim ' + (o.flash ? "flash" : "") + '">' + U.icon("camera", "ic-2xl") + "<span>" + esc(o.text || "Camera trước - căn khuôn mặt vào khung") + "</span></div>";
  };

  // Thoi gian dong (cap nhat moi giay khong can ve lai): mode since|countdown|clock
  UI.since = (ts, mode) => '<span class="num" data-tick="' + (mode || "since") + '" data-ts="' + ts + '">' + (mode === "countdown" ? U.clock(ts - Date.now()) : mode === "mmss" ? U.clock(Date.now() - ts) : U.duration(Date.now() - ts)) + "</span>";

  window.UI = UI;
})();
