/* =========================================================================
   Giao dien 1 - WEBSITE KHACH HANG (cong khai, khong dang nhap)
   Mot cot, uu tien dien thoai. Tab: Dat ban (+ Tra cuu) | Ruou gui | Xuat hoa don
   Moi so lieu lay tu Store.config / Engine, moi thay doi qua App.commit
   ========================================================================= */
(function () {
  const I = U.icon, esc = U.esc;
  const P = "customer";
  const S = () =>
    App.state(P, {
      tab: "book",
      mode: "new",
      bk: { step: 0, day: null, time: null, guests: 4, area: null, name: "", phone: "", note: "", tried: false, bookingId: null },
      lk: { phone: "", searched: "" },
      bt: { phone: "", otp: "", code: "", target: "", verified: "" },
      inv: { code: "", saleId: null, taxCode: "", company: "", address: "", email: "", tried: false, resultId: null },
    });
  const C = () => Store.config;
  const WD_SHORT = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

  /* ---------- Tien ich ---------- */
  const normPhone = (p) => String(p || "").replace(/[\s.\-]/g, "");
  const validPhone = (p) => /^0\d{9}$/.test(normPhone(p));
  const fmtPhone = (p) => normPhone(p).replace(/^(\d{4})(\d{3})(\d{3})$/, "$1 $2 $3");
  const ymd = (d) => d.getFullYear() + "-" + U.pad(d.getMonth() + 1) + "-" + U.pad(d.getDate());
  const keyDate = (key) => { const [y, m, d] = key.split("-").map(Number); return new Date(y, m - 1, d, 12); };
  const addDays = (key, n) => { const d = keyDate(key); d.setDate(d.getDate() + n); return ymd(d); };
  function dayName(key) {
    const cal = ymd(new Date());
    if (key === cal) return "Hôm nay";
    if (key === addDays(cal, 1)) return "Ngày mai";
    return U.weekday(keyDate(key).getTime());
  }
  const dayShort = (key) => { const n = dayName(key); return n.startsWith("Thứ") || n === "Chủ nhật" ? WD_SHORT[keyDate(key).getDay()] : n; };
  const fullDate = (key) => dayName(key) + ", " + U.dayLabel(key);
  const slotOpen = (key, time) => U.atTime(time, key) > Date.now();
  const freeCount = (key, time, areaId, guests) => Engine.freeTablesFor(key, time, areaId, guests).length;
  const slotAvail = (key, time, guests) => slotOpen(key, time) && freeCount(key, time, null, guests) > 0;
  const areaTables = (id) => C().tables.filter((t) => t.areaId === id);
  const isVipArea = (id) => { const t = areaTables(id); return t.length > 0 && t.every((x) => x.type === "vip"); };
  const maxSeats = () => Math.max.apply(null, C().tables.map((t) => t.seats).concat([1]));
  const codeOf = (bk) => bk.code || "DB" + String(bk.id).replace(/[^a-z0-9]/gi, "").toUpperCase().slice(-6);
  const saleCode = (s) => String(s.id).slice(-8).toUpperCase();

  // Danh sach 7 ngay nhan dat ban (bo ngay kinh doanh hien tai neu da het khung gio)
  function bookingDays() {
    const base = U.dayKey();
    const slots = Engine.bookingSlots();
    const out = [];
    for (let i = 0; out.length < 7 && i < 8; i++) {
      const k = addDays(base, i);
      if (i === 0 && !slots.some((t) => slotOpen(k, t))) continue;
      out.push(k);
    }
    return out;
  }
  function depositFor(key, time, areaId, guests) {
    const b = C().booking;
    if (!b.depositRequired) return 0;
    const free = Engine.freeTablesFor(key, time, areaId, guests).sort((a, c) => a.seats - c.seats);
    const t = free[0] || areaTables(areaId)[0];
    return t && t.type === "vip" ? Number(b.depositVip) || 0 : Number(b.depositNormal) || 0;
  }
  function storeHours() {
    const s = C().store;
    const key = U.dayKey();
    const open = U.atTime(s.openTime, key);
    let close = U.atTime(s.closeTime, key);
    if (close <= open) close += 86400000;
    const now = Date.now();
    return { isOpen: now >= open && now < close, label: s.openTime + " - " + s.closeTime };
  }
  const BK_STATUS = {
    holding: ["Chờ đặt cọc", "warning"],
    confirmed: ["Đã xác nhận", "success"],
    seated: ["Đã nhận bàn", "primary"],
    completed: ["Hoàn thành", ""],
    cancelled: ["Đã hủy", "danger"],
    expired: ["Hết hạn giữ chỗ", ""],
    noshow: ["Khách không đến", "danger"],
  };
  const statusBadge = (st) => { const x = BK_STATUS[st] || [st, ""]; return UI.badge(x[0], x[1], true); };
  const dl = (rows) => '<div class="cu-dl">' + rows.filter(Boolean).map((r) => '<div class="cu-dl-row"><span>' + esc(r[0]) + "</span><b" + (r[2] ? ' class="' + r[2] + '"' : "") + ">" + r[1] + "</b></div>").join("") + "</div>";

  function icsFor(bk) {
    const cfg = C();
    const start = U.atTime(bk.time, bk.dayKey);
    const end = start + 2 * 3600000;
    const f = (ts) => { const d = new Date(ts); return d.getFullYear() + U.pad(d.getMonth() + 1) + U.pad(d.getDate()) + "T" + U.pad(d.getHours()) + U.pad(d.getMinutes()) + "00"; };
    const e = (s) => String(s || "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
    const area = Engine.area(bk.areaId);
    return [
      "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Quan Nhau OS//Dat ban//VI", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
      "BEGIN:VEVENT", "UID:" + bk.id + "@quannhau-os", "DTSTAMP:" + f(Date.now()), "DTSTART:" + f(start), "DTEND:" + f(end),
      "SUMMARY:" + e("Đặt bàn tại " + cfg.store.name),
      "LOCATION:" + e(cfg.store.address),
      "DESCRIPTION:" + e("Mã đặt bàn: " + codeOf(bk) + "\n" + bk.guests + " khách · " + (area ? area.name : "") + "\nĐiện thoại quán: " + cfg.store.phone),
      "BEGIN:VALARM", "TRIGGER:-PT1H", "ACTION:DISPLAY", "DESCRIPTION:" + e("Nhắc lịch đặt bàn"), "END:VALARM",
      "END:VEVENT", "END:VCALENDAR",
    ].join("\r\n");
  }

  /* ---------- Khung trang ---------- */
  function header() {
    const s = C().store;
    const h = storeHours();
    const st = S();
    const tabs = [
      { value: "book", label: "Đặt bàn", icon: "calendar-clock" },
      { value: "bottle", label: "Rượu gửi", icon: "wine" },
      { value: "invoice", label: "Xuất hóa đơn", icon: "file-text" },
    ];
    return '<header class="site-header">' +
      '<div class="site-header-in">' +
      '<div class="brand cu-brand"><span class="brand-mark">' + esc(U.initials(s.name).slice(0, 2)) + '</span><div class="cu-brand-text"><span class="cu-brand-name">' + esc(s.name) + '</span><span class="cu-open"><i class="cu-dot ' + (h.isOpen ? "on" : "") + '"></i>' + (h.isOpen ? "Đang mở cửa" : "Đang đóng cửa") + " · " + esc(h.label) + "</span></div></div>" +
      '<a class="btn btn-sm cu-call" href="tel:' + esc(normPhone(s.phone)) + '" aria-label="Gọi quán">' + I("phone") + '<span class="cu-call-text">' + esc(s.phone) + "</span></a>" +
      "</div>" +
      '<nav class="site-nav cu-nav">' + tabs.map((t) => '<button type="button" class="' + (st.tab === t.value ? "active" : "") + '" data-act="customer.tab" data-value="' + t.value + '">' + I(t.icon) + "<span>" + esc(t.label) + "</span></button>").join("") + "</nav>" +
      "</header>";
  }

  function hero() {
    const s = C().store;
    const h = storeHours();
    const st = S();
    const copy = {
      book: ["Đặt bàn trực tuyến", "Chọn giờ, chọn khu vực và nhận xác nhận ngay. Bàn được giữ tự động khi bạn hoàn tất đặt cọc."],
      bottle: ["Tra cứu rượu gửi", "Xem các chai rượu bạn đang gửi tại quán, lượng còn lại và hạn lưu giữ."],
      invoice: ["Xuất hóa đơn điện tử", "Nhập mã tra cứu in cuối hóa đơn để tự xuất hóa đơn công ty trong vòng " + (C().tax.einvoiceWindowHours || 24) + " giờ."],
    }[st.tab] || ["", ""];
    return '<section class="hero cu-hero">' +
      '<span class="cu-hero-tag">' + I("store", "ic-sm") + esc(s.name) + "</span>" +
      "<h2>" + esc(copy[0]) + "</h2><p>" + esc(copy[1]) + "</p>" +
      '<div class="cu-hero-meta">' +
      "<span>" + I("map-pin", "ic-sm") + esc(s.address) + "</span>" +
      "<span>" + I("clock", "ic-sm") + "Mở cửa " + esc(h.label) + " hằng ngày</span>" +
      '<a href="tel:' + esc(normPhone(s.phone)) + '">' + I("phone", "ic-sm") + esc(s.phone) + "</a>" +
      "</div></section>";
  }

  function footer() {
    const s = C().store;
    return '<footer class="cu-footer"><div class="cu-footer-in">' +
      '<div class="strong">' + esc(s.name) + "</div>" +
      "<div>" + esc(s.address) + "</div>" +
      "<div>Điện thoại: " + esc(s.phone) + " · Mã số thuế: " + esc(s.taxCode) + "</div>" +
      '<div class="muted">Mở cửa ' + esc(s.openTime) + " - " + esc(s.closeTime) + " tất cả các ngày trong tuần</div>" +
      "</div></footer>";
  }

  /* ======================= DAT BAN ======================= */
  const STEP_LABELS = ["Thời gian", "Khu vực", "Thông tin và đặt cọc"];

  function bookTab() {
    const st = S();
    const mode = UI.seg([{ value: "new", label: "Đặt bàn mới" }, { value: "lookup", label: "Tra cứu đặt bàn" }], st.mode, "customer.mode", { block: true, lg: true });
    if (st.mode === "lookup") return mode + lookupView();
    if (!C().booking.enabled) {
      return mode + '<div class="card">' + UI.empty("calendar-clock", "Quán tạm ngưng nhận đặt bàn trực tuyến", "Vui lòng gọi " + C().store.phone + " để được giữ bàn trực tiếp.", '<a class="btn btn-primary btn-lg" href="tel:' + esc(normPhone(C().store.phone)) + '">' + I("phone") + "<span>Gọi quán</span></a>") + "</div>";
    }
    const bk = st.bk.bookingId ? Store.data.bookings.find((b) => b.id === st.bk.bookingId) : null;
    if (bk) return mode + bookingResult(bk);
    if (st.bk.bookingId) st.bk.bookingId = null;
    normalizeSelection();
    const step = st.bk.step || 0;
    let body = step === 0 ? stepTime() : step === 1 ? stepArea() : stepInfo();
    return mode + '<div class="card card-pad cu-wizard">' + UI.steps(STEP_LABELS, step) + body + "</div>";
  }

  function normalizeSelection() {
    const b = S().bk;
    const days = bookingDays();
    const slots = Engine.bookingSlots();
    const ms = maxSeats();
    b.guests = Math.max(1, Math.min(ms, Number(b.guests) || 2));
    if (!b.day || !days.includes(b.day)) b.day = days.find((k) => slots.some((t) => slotAvail(k, t, b.guests))) || days[0];
    if (b.time && !slotAvail(b.day, b.time, b.guests)) b.time = null;
    if (b.area && (!b.time || freeCount(b.day, b.time, b.area, b.guests) === 0)) b.area = null;
    if (b.step >= 1 && !b.time) b.step = 0;
    if (b.step >= 2 && !b.area) b.step = 1;
    return { days, slots };
  }

  function stepTime() {
    const b = S().bk;
    const { days, slots } = normalizeSelection();
    const dayChips = days.map((k) => {
      const any = slots.some((t) => slotAvail(k, t, b.guests));
      const d = keyDate(k);
      return '<button type="button" class="cu-day ' + (k === b.day ? "active" : "") + (any ? "" : " full") + '" data-act="customer.day" data-value="' + k + '">' +
        '<span class="cu-day-name">' + esc(dayShort(k)) + '</span><span class="cu-day-num">' + U.pad(d.getDate()) + '</span><span class="cu-day-sub">' + (any ? "Tháng " + (d.getMonth() + 1) : "Kín chỗ") + "</span></button>";
    }).join("");
    const avail = slots.filter((t) => slotAvail(b.day, t, b.guests));
    const grid = slots.map((t) => {
      const open = slotOpen(b.day, t);
      const ok = open && freeCount(b.day, t, null, b.guests) > 0;
      const title = !open ? "Đã qua giờ" : ok ? "Còn bàn" : "Hết chỗ cho " + b.guests + " khách";
      return '<button type="button" class="' + (b.time === t ? "active" : "") + '" data-act="customer.time" data-value="' + t + '" title="' + esc(title) + '"' + (ok ? "" : " disabled") + ">" + t + "</button>";
    }).join("");
    const firstSkipped = days[0] !== U.dayKey();
    return '<div class="cu-sec"><div class="cu-sec-title">' + I("calendar") + "Chọn ngày</div>" +
      '<div class="cu-days">' + dayChips + "</div>" +
      (firstSkipped ? '<div class="small muted mt-8">Khung giờ nhận khách hôm nay đã kết thúc. Bạn có thể đặt cho các ngày tiếp theo.</div>' : "") + "</div>" +
      '<div class="cu-sec"><div class="cu-sec-title">' + I("users") + "Số người</div>" +
      '<div class="row wrap gap-12"><div class="stepper cu-stepper"><button type="button" data-act="customer.guests" data-d="-1" aria-label="Bớt 1 người">' + I("minus") + '</button><span class="num">' + b.guests + '</span><button type="button" data-act="customer.guests" data-d="1" aria-label="Thêm 1 người">' + I("plus") + "</button></div>" +
      '<div class="chips">' + [2, 4, 6, 8, 10, 12].filter((n) => n <= maxSeats()).map((n) => '<button type="button" class="chip ' + (b.guests === n ? "active" : "") + '" data-act="customer.guestsSet" data-n="' + n + '">' + n + " người</button>").join("") + "</div></div>" +
      '<div class="small muted mt-8">Nhóm trên ' + maxSeats() + " người vui lòng gọi " + esc(C().store.phone) + " để quán ghép bàn.</div></div>" +
      '<div class="cu-sec"><div class="cu-sec-title">' + I("clock") + "Chọn giờ đến<span class=\"cu-sec-hint\">" + esc(fullDate(b.day)) + "</span></div>" +
      (avail.length ? "" : UI.banner("warning", "triangle-alert", "Ngày này đã kín chỗ cho " + b.guests + " khách. Vui lòng chọn ngày khác hoặc giảm số người.")) +
      '<div class="time-grid cu-time-grid' + (avail.length ? "" : " mt-12") + '">' + grid + "</div>" +
      '<div class="cu-legend"><span><i class="lg-free"></i>Còn bàn</span><span><i class="lg-sel"></i>Đang chọn</span><span><i class="lg-off"></i>Hết chỗ hoặc đã qua giờ</span></div></div>' +
      '<div class="cu-actions"><span class="cu-actions-info">' + (b.time ? esc(dayName(b.day)) + " · " + b.time + " · " + b.guests + " khách" : "Chọn giờ đến để tiếp tục") + "</span>" +
      UI.btn("Tiếp tục", { act: "customer.next", kind: "primary", size: "lg", icon: "arrow-right", disabled: !b.time }) + "</div>";
  }

  function summaryLine(editStep) {
    const b = S().bk;
    const area = b.area ? Engine.area(b.area) : null;
    return '<div class="cu-summary">' + I("calendar-clock") + '<div class="grow"><b>' + esc(fullDate(b.day)) + " · " + esc(b.time) + "</b><div class=\"small muted\">" + b.guests + " khách" + (area ? " · " + esc(area.name) : "") + '</div></div><button type="button" class="btn btn-ghost btn-sm" data-act="customer.goStep" data-step="' + editStep + '">' + I("pencil", "ic-sm") + "<span>Đổi</span></button></div>";
  }

  function stepArea() {
    const b = S().bk;
    normalizeSelection();
    if (!b.time) return stepTime();
    const vip = C().vip;
    const cards = C().areas.map((a, i) => {
      const tables = areaTables(a.id);
      if (!tables.length) return "";
      const seats = tables.map((t) => t.seats);
      const minS = Math.min.apply(null, seats), maxS = Math.max.apply(null, seats);
      const free = freeCount(b.day, b.time, a.id, b.guests);
      const tooBig = b.guests > maxS;
      const isVip = isVipArea(a.id);
      const dep = depositFor(b.day, b.time, a.id, b.guests);
      const icon = isVip ? "armchair" : /vườn|sân|ngoài/i.test(a.name) ? "sun" : "house";
      const status = tooBig ? UI.badge("Tối đa " + maxS + " khách/bàn", "") : free ? UI.badge("Còn " + free + " bàn", "success", true) : UI.badge("Hết chỗ khung giờ này", "danger");
      const lines = [
        tables.length + " " + (isVip ? "phòng" : "bàn") + " · " + (minS === maxS ? maxS : minS + " - " + maxS) + " chỗ mỗi " + (isVip ? "phòng" : "bàn"),
      ];
      let extra = "";
      if (isVip) {
        extra += '<div class="cu-area-note">' + I("info", "ic-sm") + "<span>Phụ thu " + U.money(vip.hourlyRate) + "/giờ" + (vip.minimumSpendEnabled ? ", miễn phụ thu khi tổng hóa đơn từ " + U.money(vip.minimumSpend) : "") + "</span></div>";
      }
      if (dep) extra += '<div class="cu-area-note">' + I("wallet", "ic-sm") + "<span>Đặt cọc " + U.money(dep) + ", trừ vào hóa đơn</span></div>";
      const disabled = tooBig || !free;
      return '<button type="button" class="opt-card cu-area ' + (b.area === a.id ? "active " : "") + (disabled ? "disabled" : "") + '" data-act="customer.area" data-id="' + a.id + '"' + (disabled ? " disabled" : "") + ">" +
        '<div class="oc-img cu-area-img cu-g' + (i % 4) + '">' + I(icon, "ic-xl") + "</div>" +
        '<div class="grow col gap-4"><div class="row between wrap"><b class="cu-area-name">' + esc(a.name) + "</b>" + status + "</div>" +
        '<div class="small muted">' + esc(lines.join(" · ")) + "</div>" + extra + "</div>" +
        '<span class="cu-radio">' + (b.area === a.id ? I("check", "ic-sm") : "") + "</span></button>";
    }).join("");
    return summaryLine(0) +
      '<div class="cu-sec"><div class="cu-sec-title">' + I("layout-grid") + "Chọn khu vực</div>" +
      '<div class="col gap-12">' + cards + "</div></div>" +
      '<div class="cu-actions">' + UI.btn("Quay lại", { act: "customer.goStep", data: { step: 0 }, icon: "chevron-left", size: "lg" }) +
      UI.btn("Tiếp tục", { act: "customer.next", kind: "primary", size: "lg", icon: "arrow-right", disabled: !b.area }) + "</div>";
  }

  function stepInfo() {
    const b = S().bk;
    normalizeSelection();
    if (!b.area) return stepArea();
    const cfg = C().booking;
    const area = Engine.area(b.area);
    const dep = depositFor(b.day, b.time, b.area, b.guests);
    const phoneErr = b.tried && !validPhone(b.phone) ? "Số điện thoại gồm 10 chữ số, bắt đầu bằng số 0." : normPhone(b.phone).length >= 10 && !validPhone(b.phone) ? "Số điện thoại chưa đúng định dạng." : "";
    const nameErr = b.tried && String(b.name || "").trim().length < 2 ? "Vui lòng nhập họ tên người đặt." : "";
    return summaryLine(1) +
      '<div class="cu-sec"><div class="cu-sec-title">' + I("user") + "Thông tin người đặt</div>" +
      '<div class="col gap-12">' +
      UI.field("Họ và tên", UI.input({ id: "cu-name", model: "customer.bk.name", value: b.name, placeholder: "VD: Nguyễn Minh Anh", cls: "input-lg" + (nameErr ? " invalid" : ""), live: b.tried }), { for: "cu-name", err: nameErr }) +
      UI.field("Số điện thoại", UI.input({ id: "cu-phone", model: "customer.bk.phone", value: b.phone, placeholder: "VD: 0912 345 678", inputmode: "tel", maxlength: 13, cls: "input-lg" + (phoneErr ? " invalid" : ""), live: true }), { for: "cu-phone", err: phoneErr, help: phoneErr ? "" : "Quán gọi lại số này nếu cần xác nhận." }) +
      UI.field("Ghi chú cho quán", UI.textarea({ id: "cu-note", model: "customer.bk.note", value: b.note, rows: 2, placeholder: "VD: tổ chức sinh nhật, cần ghế trẻ em, muốn ngồi gần sân khấu" }), { for: "cu-note", help: "Không bắt buộc" }) +
      "</div></div>" +
      '<div class="cu-sec"><div class="cu-sec-title">' + I("receipt-text") + "Xác nhận thông tin</div>" +
      dl([
        ["Ngày", esc(fullDate(b.day))],
        ["Giờ đến", esc(b.time)],
        ["Số khách", b.guests + " người"],
        ["Khu vực", esc(area.name)],
        dep ? ["Tiền đặt cọc", U.money(dep), "cu-strong-amt"] : ["Tiền đặt cọc", "Không cần đặt cọc"],
      ]) +
      (dep ? '<div class="mt-12">' + UI.banner("info", "info", "Sau khi bấm đặt bàn, bàn được giữ trong <b>" + cfg.holdMinutes + " phút</b> để bạn chuyển khoản cọc qua mã VietQR. Quá thời gian, hệ thống tự hủy giữ chỗ. Tiền cọc được trừ vào hóa đơn khi thanh toán.") + "</div>" : "") +
      '<div class="small muted mt-8">Quán giữ bàn tối đa ' + cfg.noShowMinutes + " phút sau giờ hẹn. Nếu đến muộn hơn, vui lòng gọi trước cho quán.</div></div>" +
      '<div class="cu-actions">' + UI.btn("Quay lại", { act: "customer.goStep", data: { step: 1 }, icon: "chevron-left", size: "lg" }) +
      UI.btn(dep ? "Đặt bàn và đặt cọc" : "Xác nhận đặt bàn", { act: "customer.submit", kind: "primary", size: "lg", icon: "check" }) + "</div>";
  }

  /* ---------- Sau khi tao dat ban ---------- */
  function bookingDetails(bk, withTable) {
    const area = Engine.area(bk.areaId);
    const table = Engine.table(bk.tableId);
    return dl([
      ["Người đặt", esc(bk.name) + " · " + esc(fmtPhone(bk.phone))],
      ["Ngày", esc(fullDate(bk.dayKey))],
      ["Giờ đến", esc(bk.time)],
      ["Số khách", bk.guests + " người"],
      ["Khu vực", esc(area ? area.name : "") + (withTable && table ? " · bàn dự kiến " + esc(table.code) : "")],
      bk.note ? ["Ghi chú", esc(bk.note)] : null,
    ]);
  }

  function bookingResult(bk) {
    if (bk.status === "holding") return payView(bk);
    if (bk.status === "confirmed" || bk.status === "seated" || bk.status === "completed") return doneView(bk);
    return failedView(bk);
  }

  function payView(bk) {
    const s = C().store;
    const cfg = C().booking;
    const memo = "COC " + codeOf(bk);
    const qr = UI.qr(U.vietQr(s.bankBin, s.bankAccount, bk.deposit, memo));
    const copyRow = (label, value, copy, cls) => '<div class="cu-dl-row"><span>' + esc(label) + '</span><span class="row" style="gap:6px"><b class="' + (cls || "") + '">' + esc(value) + "</b>" + (copy ? '<button type="button" class="btn btn-ghost btn-sm btn-icon" data-act="customer.copy" data-text="' + esc(copy) + '" title="Sao chép" aria-label="Sao chép ' + esc(label) + '">' + I("clipboard-check", "ic-sm") + "</button>" : "") + "</span></div>";
    return '<div class="card card-pad cu-wizard">' + UI.steps(STEP_LABELS, 2) +
      '<div class="cu-hold">' +
      '<div class="cu-hold-info"><div class="cu-hold-label">' + I("hourglass", "ic-sm") + "Bàn đang được giữ cho bạn</div>" +
      '<div class="countdown cu-countdown">' + UI.since(bk.holdUntil, "countdown") + "</div>" +
      '<div class="small">Mã đặt bàn <b class="cu-mono">' + esc(codeOf(bk)) + "</b> · giữ đến " + U.time(bk.holdUntil) + "</div></div>" +
      statusBadge(bk.status) + "</div>" +
      '<div class="cu-pay">' +
      '<div class="qr-box cu-qr">' + qr + '<div class="qr-bank"><b>VietQR</b> · quét bằng ứng dụng ngân hàng bất kỳ</div></div>' +
      '<div class="col gap-12 grow"><div class="cu-sec-title" style="margin:0">' + I("landmark") + "Hoặc chuyển khoản thủ công</div>" +
      '<div class="cu-dl">' +
      copyRow("Ngân hàng", s.bankName) +
      copyRow("Số tài khoản", s.bankAccount, s.bankAccount, "cu-mono") +
      copyRow("Chủ tài khoản", s.accountName) +
      copyRow("Số tiền", U.money(bk.deposit), String(bk.deposit), "cu-strong-amt") +
      copyRow("Nội dung", memo, memo, "cu-mono") +
      "</div>" +
      UI.banner("info", "info", "Vui lòng ghi đúng nội dung chuyển khoản. Hệ thống tự xác nhận khi ngân hàng báo nhận tiền. Nếu sau <b>" + cfg.holdMinutes + " phút</b> chưa nhận được cọc, bàn sẽ tự động được nhả cho khách khác.") +
      "</div></div>" +
      '<div class="cu-sec"><div class="cu-sec-title">' + I("receipt-text") + "Thông tin đặt bàn</div>" + bookingDetails(bk, false) + "</div>" +
      '<div class="cu-demo"><span class="cu-demo-tag">' + I("layers", "ic-sm") + "Bản demo</span><span class=\"small\">Trong thực tế bước này do ngân hàng tự động báo về.</span>" +
      UI.btn("Mô phỏng: ngân hàng báo đã nhận cọc", { act: "customer.simPaid", kind: "primary", icon: "circle-check", block: true, size: "lg" }) + "</div>" +
      '<div class="cu-actions cu-actions-end">' + UI.btn("Hủy giữ chỗ", { act: "customer.cancelHold", kind: "danger", icon: "x" }) + "</div>" +
      "</div>";
  }

  function doneView(bk) {
    const st = bk.status;
    const title = st === "confirmed" ? "Đặt bàn thành công" : st === "seated" ? "Bạn đã nhận bàn" : "Cảm ơn bạn đã ghé quán";
    const sub = st === "confirmed" ? "Quán đã giữ bàn cho bạn. Vui lòng đọc mã đặt bàn khi đến quán." : st === "seated" ? "Chúc bạn có buổi tối vui vẻ cùng gia đình và bạn bè." : "Đặt bàn đã hoàn thành.";
    return '<div class="card card-pad cu-done">' +
      '<div class="cu-done-ic">' + I("circle-check", "ic-2xl") + "</div>" +
      "<h3>" + esc(title) + '</h3><p class="muted">' + esc(sub) + "</p>" +
      '<div class="cu-code"><span>Mã đặt bàn</span><b class="cu-mono">' + esc(codeOf(bk)) + "</b>" + statusBadge(st) + "</div>" +
      '<div class="cu-done-body">' + bookingDetails(bk, true) +
      (bk.deposit ? '<div class="cu-deposit">' + I("wallet") + "<div><b>Đã đặt cọc " + U.money(bk.deposit) + '</b><div class="small">Số tiền này sẽ trừ vào hóa đơn khi thanh toán.</div></div></div>' : "") +
      (st === "confirmed" ? '<div class="small muted mt-12">Quán giữ bàn tối đa ' + C().booking.noShowMinutes + " phút sau giờ hẹn. Cần đổi giờ hoặc hủy, vui lòng gọi " + esc(C().store.phone) + " hoặc dùng mục Tra cứu đặt bàn.</div>" : "") +
      "</div>" +
      '<div class="cu-done-actions">' +
      (st === "confirmed" ? UI.btn("Thêm vào lịch", { act: "customer.ics", data: { id: bk.id }, kind: "primary", icon: "calendar", size: "lg" }) : "") +
      UI.btn("Đặt bàn khác", { act: "customer.reset", icon: "plus", size: "lg" }) +
      "</div></div>";
  }

  function failedView(bk) {
    const expired = bk.status === "expired";
    const title = expired ? "Hết thời gian giữ chỗ" : bk.status === "noshow" ? "Đặt bàn đã quá giờ hẹn" : "Đặt bàn đã được hủy";
    const msg = expired
      ? "Đặt bàn " + codeOf(bk) + " đã tự hủy vì quán chưa nhận được tiền cọc sau " + C().booking.holdMinutes + " phút. Nếu bạn đã chuyển khoản, vui lòng gọi " + C().store.phone + " để được hỗ trợ."
      : bk.status === "noshow" ? "Quán đã chờ quá " + C().booking.noShowMinutes + " phút so với giờ hẹn. Vui lòng liên hệ quán nếu cần hỗ trợ." : "Bàn đã được nhả cho khách khác. Bạn có thể đặt lại bất cứ lúc nào.";
    return '<div class="card card-pad cu-done cu-failed">' +
      '<div class="cu-done-ic">' + I(expired ? "hourglass" : "circle-x", "ic-2xl") + "</div>" +
      "<h3>" + esc(title) + '</h3><p class="muted">' + esc(msg) + "</p>" +
      '<div class="cu-code"><span>Mã đặt bàn</span><b class="cu-mono">' + esc(codeOf(bk)) + "</b>" + statusBadge(bk.status) + "</div>" +
      '<div class="cu-done-actions">' + UI.btn("Đặt lại với thông tin cũ", { act: "customer.rebook", kind: "primary", icon: "rotate-ccw", size: "lg" }) +
      '<a class="btn btn-lg" href="tel:' + esc(normPhone(C().store.phone)) + '">' + I("phone") + "<span>Gọi quán</span></a></div></div>";
  }

  /* ---------- Tra cuu dat ban ---------- */
  function lookupView() {
    const l = S().lk;
    const list = l.searched ? Store.data.bookings.filter((b) => b.phone === l.searched).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)) : [];
    const card = (bk) => {
      const area = Engine.area(bk.areaId);
      const canCancel = bk.status === "holding" || bk.status === "confirmed";
      return '<div class="card cu-bk">' +
        '<div class="cu-bk-head"><div><div class="small muted">Mã đặt bàn</div><b class="cu-mono">' + esc(codeOf(bk)) + "</b></div>" + statusBadge(bk.status) + "</div>" +
        '<div class="cu-bk-body">' +
        '<div class="cu-bk-when">' + I("calendar-clock") + "<div><b>" + esc(bk.time) + " · " + esc(fullDate(bk.dayKey)) + '</b><div class="small muted">' + bk.guests + " khách · " + esc(area ? area.name : "") + " · " + esc(bk.name) + "</div></div></div>" +
        (bk.deposit ? '<div class="small">' + (bk.depositPaid ? UI.badge("Đã cọc " + U.money(bk.deposit), "success") : UI.badge("Cần cọc " + U.money(bk.deposit), "warning")) + (bk.status === "holding" && bk.holdUntil ? ' <span class="muted">Giữ chỗ còn ' + UI.since(bk.holdUntil, "countdown") + "</span>" : "") + "</div>" : "") +
        (bk.note ? '<div class="small muted">Ghi chú: ' + esc(bk.note) + "</div>" : "") +
        "</div>" +
        (canCancel || bk.status === "confirmed" ? '<div class="cu-bk-foot">' +
          (canCancel ? UI.btn("Hủy đặt bàn", { act: "customer.cancelBk", data: { id: bk.id }, kind: "danger", size: "sm", icon: "x" }) : "") +
          '<span class="grow"></span>' +
          (bk.status === "confirmed" ? UI.btn("Thêm vào lịch", { act: "customer.ics", data: { id: bk.id }, size: "sm", icon: "calendar" }) : "") +
          (bk.status === "holding" ? UI.btn("Thanh toán cọc", { act: "customer.openPay", data: { id: bk.id }, kind: "primary", size: "sm", icon: "qr-code" }) : "") +
          "</div>" : "") +
        "</div>";
    };
    return '<div class="card card-pad">' +
      '<div class="cu-sec-title">' + I("search") + "Tra cứu bằng số điện thoại đã đặt</div>" +
      '<div class="cu-inline">' + UI.input({ id: "cu-lk-phone", model: "customer.lk.phone", value: l.phone, placeholder: "Nhập số điện thoại", inputmode: "tel", maxlength: 13, cls: "input-lg" }) +
      UI.btn("Tra cứu", { act: "customer.lookup", kind: "primary", size: "lg", icon: "search" }) + "</div>" +
      '<div class="cu-demo-hint">' + I("info", "ic-sm") + 'Số dùng thử: <button type="button" class="cu-link" data-act="customer.lkDemo" data-v="0912345678">0912 345 678</button><button type="button" class="cu-link" data-act="customer.lkDemo" data-v="0903555666">0903 555 666</button></div>' +
      "</div>" +
      (l.searched
        ? '<div class="cu-result-head"><b>' + list.length + " đặt bàn</b> của số " + esc(fmtPhone(l.searched)) + "</div>" +
          (list.length ? '<div class="col gap-12">' + list.map(card).join("") + "</div>" : '<div class="card">' + UI.empty("calendar", "Chưa có đặt bàn nào", "Không tìm thấy đặt bàn với số điện thoại này. Kiểm tra lại số hoặc đặt bàn mới.", UI.btn("Đặt bàn mới", { act: "customer.mode", data: { value: "new" }, kind: "primary", icon: "plus" })) + "</div>")
        : "");
  }

  /* ======================= RUOU GUI ======================= */
  function bottleTab() {
    const b = S().bt;
    if (b.verified) return bottleList(b.verified);
    if (b.code) {
      return '<div class="card card-pad cu-otp">' +
        '<div class="cu-step-ic">' + I("shield-check", "ic-xl") + "</div>" +
        "<h3>Nhập mã xác thực</h3>" +
        '<p class="muted">Mã gồm 6 chữ số vừa được gửi qua tin nhắn tới số <b>' + esc(fmtPhone(b.target)) + "</b>.</p>" +
        (App.isDemo()
          ? UI.banner("info", "layers", "<b>Bản demo:</b> Mã OTP demo: <b class=\"cu-mono\">" + esc(b.code) + "</b>")
          : UI.banner("info", "shield-check", "Mã xác thực hiệu lực trong 5 phút: <b class=\"cu-mono\">" + esc(b.code) + "</b>")) +
        UI.input({ id: "cu-otp", model: "customer.bt.otp", value: b.otp, placeholder: "------", inputmode: "numeric", maxlength: 6, cls: "input-lg cu-otp-input", autofocus: true }) +
        UI.btn("Xác nhận và xem rượu gửi", { act: "customer.otpVerify", kind: "primary", size: "lg", block: true, icon: "check" }) +
        '<div class="row between"><button type="button" class="cu-link" data-act="customer.otpChange">' + I("chevron-left", "ic-sm") + 'Đổi số điện thoại</button><button type="button" class="cu-link" data-act="customer.otpSend">' + I("refresh-cw", "ic-sm") + "Gửi lại mã</button></div>" +
        "</div>";
    }
    return '<div class="card card-pad cu-otp">' +
      '<div class="cu-step-ic">' + I("wine", "ic-xl") + "</div>" +
      "<h3>Tra cứu rượu đang gửi</h3>" +
      '<p class="muted">Nhập số điện thoại đã dùng khi gửi rượu. Chúng tôi sẽ gửi mã xác thực để bảo vệ thông tin của bạn.</p>' +
      UI.field("Số điện thoại", UI.input({ id: "cu-bt-phone", model: "customer.bt.phone", value: b.phone, placeholder: "VD: 0912 345 678", inputmode: "tel", maxlength: 13, cls: "input-lg" }), { for: "cu-bt-phone" }) +
      UI.btn("Gửi mã xác thực", { act: "customer.otpSend", kind: "primary", size: "lg", block: true, icon: "send" }) +
      '<div class="cu-demo-hint">' + I("info", "ic-sm") + 'Số dùng thử có rượu gửi: <button type="button" class="cu-link" data-act="customer.btDemo" data-v="0912345678">0912 345 678</button></div>' +
      "</div>";
  }

  function bottleList(phone) {
    const list = Engine.findBottles(phone).slice().sort((a, b) => a.expiresAt - b.expiresAt);
    const now = Date.now();
    const cards = list.map((bt) => {
      const days = Math.ceil((bt.expiresAt - now) / 86400000);
      const pct = Math.max(0, Math.min(100, Number(bt.remainingPct) || 0));
      const exp = days <= 0 ? UI.badge("Đã hết hạn lưu giữ", "danger", true) : days < 14 ? UI.badge("Sắp hết hạn: còn " + days + " ngày", "warning", true) : UI.badge("Còn " + days + " ngày", "success", true);
      return '<div class="card cu-bottle">' +
        '<div class="cu-btl" aria-hidden="true"><span class="cu-btl-neck"></span><span class="cu-btl-body"><span class="cu-btl-fill" style="height:' + pct + '%"></span></span></div>' +
        '<div class="grow col gap-4">' +
        '<div class="row between wrap" style="align-items:flex-start"><b class="cu-bottle-name">' + esc(bt.wine) + '</b><span class="badge cu-mono">' + esc(bt.code) + "</span></div>" +
        '<div class="cu-level"><div class="row between small"><span class="muted">Lượng còn lại</span><b>' + pct + "%</b></div>" + UI.progress(pct, pct <= 25 ? "warning" : "") + "</div>" +
        '<div class="small muted">Gửi từ ' + U.date(bt.createdAt) + " · lưu giữ đến " + U.date(bt.expiresAt) + "</div>" +
        '<div class="row wrap">' + exp + "</div>" +
        (days > 0 && days < 14 ? '<div class="small text-warning">Vui lòng ghé quán dùng tiếp trước ' + U.date(bt.expiresAt) + ". Sau thời hạn, quán không tiếp tục bảo quản chai rượu.</div>" : "") +
        "</div></div>";
    }).join("");
    return '<div class="cu-result-head row between"><div><b>Rượu đang gửi</b> của số ' + esc(fmtPhone(phone)) + "</div>" + UI.btn("Thoát", { act: "customer.btLogout", size: "sm", icon: "log-out" }) + "</div>" +
      (list.length
        ? '<div class="col gap-12">' + cards + "</div>" + UI.banner("info", "info", "Khi đến quán, đọc mã thẻ (ví dụ " + esc(list[0].code) + ") cho nhân viên để lấy rượu ra bàn.")
        : '<div class="card">' + UI.empty("wine", "Chưa có chai rượu nào đang gửi", "Không tìm thấy rượu gửi với số điện thoại này. Khi gửi rượu tại quán, nhân viên sẽ tạo thẻ theo số điện thoại của bạn.") + "</div>");
  }

  /* ======================= XUAT HOA DON ======================= */
  function invoiceTab() {
    const v = S().inv;
    if (v.resultId) {
      const ei = Store.data.einvoices.find((e) => e.id === v.resultId);
      if (ei) return invoiceDone(ei);
      v.resultId = null;
    }
    const sale = v.saleId ? Engine.saleById(v.saleId) : null;
    if (sale) return invoiceForm(sale);
    v.saleId = null;
    const recent = Store.data.sales.filter((s) => s.dayKey === U.dayKey()).sort((a, b) => b.closedAt - a.closedAt).slice(0, 5);
    return '<div class="card card-pad cu-otp">' +
      '<div class="cu-step-ic">' + I("receipt-text", "ic-xl") + "</div>" +
      "<h3>Nhập mã tra cứu trên hóa đơn</h3>" +
      '<p class="muted">Mã gồm 8 ký tự, in ở cuối hóa đơn thanh toán, ngay dưới mã QR. Bạn cũng có thể quét mã QR trên hóa đơn để mở trang này.</p>' +
      '<div class="cu-inline">' + UI.input({ id: "cu-inv-code", model: "customer.inv.code", value: v.code, placeholder: "VD: K2A1B5XQ", maxlength: 8, cls: "input-lg cu-code-input" }) +
      UI.btn("Tra cứu", { act: "customer.invFind", kind: "primary", size: "lg", icon: "search" }) + "</div>" +
      "</div>" +
      (recent.length && App.isDemo() ? '<div class="card demo-only"><div class="card-head"><h3>Hóa đơn hôm nay</h3><span class="badge badge-violet">' + I("layers", "ic-sm") + "Bản demo</span></div>" +
        '<div class="list">' + recent.map((s) => '<button type="button" class="list-row" data-act="customer.invPick" data-code="' + saleCode(s) + '"><span class="cu-mono strong">' + saleCode(s) + '</span><div class="grow"><div class="small muted">Bàn ' + esc(s.tableCode) + " · thanh toán lúc " + U.time(s.closedAt) + '</div></div><span class="num strong">' + U.money(s.grand) + "</span>" + (s.einvoice ? UI.badge("Đã xuất", "success") : I("chevron-right", "ic-sm")) + "</button>").join("") + "</div></div>" : "");
  }

  function vatRows(sale) {
    const label = { food: "Đồ ăn, nước ngọt", alcohol: "Rượu, bia" };
    const groups = Object.keys(sale.vat || {}).filter((g) => sale.vat[g] && sale.vat[g].gross);
    if (!groups.length) return "";
    return '<div class="table-wrap cu-vat"><table class="dt"><thead><tr><th>Nhóm hàng</th><th class="num">Thuế suất</th><th class="num">Chưa thuế</th><th class="num">Thuế GTGT</th></tr></thead><tbody>' +
      groups.map((g) => { const x = sale.vat[g]; return "<tr><td>" + esc(label[g] || g) + '</td><td class="num">' + x.rate + '%</td><td class="num">' + U.moneyPlain(x.base) + '</td><td class="num">' + U.moneyPlain(x.vat) + "</td></tr>"; }).join("") +
      '</tbody><tfoot><tr><td>Tổng cộng</td><td></td><td class="num">' + U.moneyPlain(U.sum(groups, (g) => sale.vat[g].base)) + '</td><td class="num">' + U.moneyPlain(sale.vatTotal) + "</td></tr></tfoot></table></div>";
  }

  function invoiceForm(sale) {
    const v = S().inv;
    const hours = Number(C().tax.einvoiceWindowHours) || 24;
    const deadline = sale.closedAt + hours * 3600000;
    const expired = Date.now() > deadline;
    const issued = sale.einvoice ? Store.data.einvoices.find((e) => e.saleId === sale.id) : null;
    const lines = (sale.lines || []).filter((l) => l.status !== "void");
    const bill = '<div class="card">' +
      '<div class="card-head"><div><h3>Hóa đơn bàn ' + esc(sale.tableCode) + '</h3><div class="sub">Thanh toán lúc ' + U.time(sale.closedAt) + " · " + U.date(sale.closedAt) + '</div></div><span class="badge cu-mono">' + saleCode(sale) + "</span></div>" +
      '<div class="card-body col gap-12">' +
      '<div class="cu-bill-total"><span>Tổng thanh toán</span><b class="num">' + U.money(sale.grand) + "</b></div>" +
      (sale.deposit ? '<div class="small muted">Đã bao gồm tiền cọc ' + U.money(sale.deposit) + " trừ khi thanh toán.</div>" : "") +
      vatRows(sale) +
      '<details class="cu-lines"><summary>' + I("list", "ic-sm") + "Xem " + lines.length + " dòng món</summary>" +
      lines.map((l) => { const m = Engine.menu(l.menuId); const q = m && m.kind === "seafood" ? U.num(l.kg, 2) + " kg" : l.qty + " x"; return '<div class="line"><span class="l-qty">' + esc(q) + '</span><div class="l-name">' + esc(l.name) + (l.isFree ? ' <span class="badge badge-success">Tặng</span>' : "") + '</div><span class="l-amt">' + U.moneyPlain(l.amount) + "</span></div>"; }).join("") +
      "</details>" +
      "</div>" +
      '<div class="card-foot" style="justify-content:flex-start">' + UI.btn("Tra cứu hóa đơn khác", { act: "customer.invBack", kind: "ghost", size: "sm", icon: "chevron-left" }) + "</div>" +
      "</div>";
    if (issued || sale.einvoice) {
      return bill + '<div class="card card-pad">' + UI.banner("success", "file-check", "<b>Hóa đơn này đã được xuất</b> số " + esc(sale.einvoice.invoiceNo) + " lúc " + U.time(sale.einvoice.at) + " " + U.date(sale.einvoice.at) + (issued ? " cho " + esc(issued.company) + " (MST " + esc(issued.taxCode) + "), đã gửi tới " + esc(issued.email) : "") + ". Mỗi hóa đơn chỉ xuất được một lần. Cần điều chỉnh, vui lòng liên hệ quán.") + "</div>";
    }
    if (expired) {
      return bill + '<div class="card card-pad">' + UI.banner("danger", "triangle-alert", "<b>Đã quá " + hours + " giờ kể từ khi thanh toán.</b> Hệ thống không còn nhận yêu cầu xuất hóa đơn tự động. Vui lòng gọi " + esc(C().store.phone) + " để được hỗ trợ.") + "</div>";
    }
    const left = deadline - Date.now();
    const taxOk = /^\d{10}(\d{3})?$/.test(String(v.taxCode || "").replace(/-/g, ""));
    const emailOk = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v.email || "");
    const taxErr = v.tried && !taxOk ? "Mã số thuế gồm 10 hoặc 13 chữ số." : "";
    const compErr = v.tried && !String(v.company || "").trim() ? "Nhập tên đơn vị mua hàng." : "";
    const mailErr = v.tried && !emailOk ? "Email chưa đúng định dạng." : "";
    return bill +
      '<div class="card card-pad col gap-12">' +
      '<div class="row between wrap"><div class="cu-sec-title" style="margin:0">' + I("landmark") + "Thông tin xuất hóa đơn</div>" + UI.badge("Còn " + U.duration(left) + " để yêu cầu", left < 3 * 3600000 ? "warning" : "info") + "</div>" +
      UI.field("Mã số thuế", '<div class="cu-inline">' + UI.input({ id: "cu-tax", model: "customer.inv.taxCode", value: v.taxCode, placeholder: "10 hoặc 13 chữ số", inputmode: "numeric", maxlength: 14, change: "customer.taxBlur", cls: "input-lg" + (taxErr ? " invalid" : "") }) +
        UI.btn("Tra cứu", { act: "customer.taxLookup", size: "lg", icon: "search" }) + "</div>", { for: "cu-tax", err: taxErr, help: taxErr ? "" : "Tên và địa chỉ đơn vị được điền tự động theo mã số thuế." }) +
      '<div class="cu-demo-hint">' + I("info", "ic-sm") + "MST dùng thử: " + ["0301234567", "0109876543", "0316789012"].map((c) => '<button type="button" class="cu-link" data-act="customer.taxDemo" data-v="' + c + '">' + c + "</button>").join("") + "</div>" +
      UI.field("Tên đơn vị", UI.input({ id: "cu-company", model: "customer.inv.company", value: v.company, placeholder: "VD: Công ty TNHH ABC", cls: "input-lg" + (compErr ? " invalid" : "") }), { for: "cu-company", err: compErr }) +
      UI.field("Địa chỉ", UI.input({ id: "cu-address", model: "customer.inv.address", value: v.address, placeholder: "Địa chỉ theo đăng ký kinh doanh", cls: "input-lg" }), { for: "cu-address" }) +
      UI.field("Email nhận hóa đơn", UI.input({ id: "cu-email", model: "customer.inv.email", value: v.email, placeholder: "VD: ketoan@congty.vn", inputmode: "email", cls: "input-lg" + (mailErr ? " invalid" : "") }), { for: "cu-email", err: mailErr }) +
      UI.btn("Gửi yêu cầu xuất hóa đơn", { act: "customer.invSubmit", kind: "primary", size: "lg", block: true, icon: "send" }) +
      '<div class="small muted center">Hóa đơn điện tử phát hành qua ' + esc(C().tax.einvoiceProvider) + ". Thông tin xuất hóa đơn không thể sửa sau khi gửi.</div>" +
      "</div>";
  }

  function invoiceDone(ei) {
    return '<div class="card card-pad cu-done">' +
      '<div class="cu-done-ic">' + I("file-check", "ic-2xl") + "</div>" +
      "<h3>Đã phát hành hóa đơn điện tử</h3>" +
      '<p class="muted">Yêu cầu của bạn đã được xử lý thành công.</p>' +
      '<div class="cu-code"><span>Số hóa đơn</span><b class="cu-mono">' + esc(ei.invoiceNo) + "</b>" + UI.badge("Đã phát hành", "success", true) + "</div>" +
      '<div class="cu-done-body">' + dl([
        ["Đơn vị mua hàng", esc(ei.company)],
        ["Mã số thuế", '<span class="cu-mono">' + esc(ei.taxCode) + "</span>"],
        ei.address ? ["Địa chỉ", esc(ei.address)] : null,
        ["Tổng tiền thanh toán", U.money(ei.amount), "cu-strong-amt"],
        ["Thời gian phát hành", U.time(ei.at) + " · " + U.date(ei.at)],
      ]) +
      '<div class="mt-12">' + UI.banner("success", "mail", "Hóa đơn điện tử (tệp PDF và XML) đã được gửi tới <b>" + esc(ei.email) + "</b>. Nếu không thấy, vui lòng kiểm tra cả hộp thư rác.") + "</div></div>" +
      '<div class="cu-done-actions">' + UI.btn("Xuất hóa đơn khác", { act: "customer.invReset", icon: "plus", size: "lg" }) + "</div></div>";
  }

  /* ======================= DANG KY GIAO DIEN ======================= */
  App.portal(P, {
    public: true,
    render() {
      const st = S();
      if (!["book", "bottle", "invoice"].includes(st.tab)) st.tab = "book";
      const content = st.tab === "book" ? bookTab() : st.tab === "bottle" ? bottleTab() : invoiceTab();
      return '<div class="site cu-site">' + header() + '<main class="site-main">' + hero() + content + "</main>" + footer() + "</div>";
    },
    tick(now) {
      const st = S();
      if (st.tab !== "book" || !st.bk.bookingId) return;
      const bk = Store.data.bookings.find((b) => b.id === st.bk.bookingId);
      if (bk && bk.status === "holding" && bk.holdUntil && now > bk.holdUntil) Store.commit(() => Engine.tick());
    },
    hotkeys(ev) {
      if (ev.key !== "Enter" || App._modal || !ev.target || !ev.target.id) return;
      const map = { "cu-lk-phone": "customer.lookup", "cu-bt-phone": "customer.otpSend", "cu-otp": "customer.otpVerify", "cu-inv-code": "customer.invFind", "cu-tax": "customer.taxLookup" };
      const act = map[ev.target.id];
      if (act) { ev.preventDefault(); App.run(act, {}); }
    },
  });

  function findSaleByCode(code) {
    const c = String(code || "").trim().toUpperCase().replace(/\s/g, "");
    if (c.length < 6) return null;
    return Store.data.sales.find((s) => saleCode(s) === c) || null;
  }
  function fillTax(code, silent) {
    const v = S().inv;
    const c = String(code || "").replace(/[\s-]/g, "");
    if (!c) return;
    const r = Engine.lookupTaxCode(c);
    if (r) {
      v.company = r.name;
      v.address = r.address;
      if (!silent) App.toast("Đã điền thông tin " + r.name, "success");
    } else if (!silent || /^\d{10}(\d{3})?$/.test(c)) {
      App.toast("Không tìm thấy mã số thuế trong danh bạ. Vui lòng tự nhập tên và địa chỉ đơn vị.", "warning");
    }
    App.render();
  }
  function scrollTop() { try { window.scrollTo({ top: 0, behavior: "smooth" }); } catch (e) { window.scrollTo(0, 0); } }

  /* ======================= HANH DONG ======================= */
  App.actions({
    "customer.tab": (d) => { S().tab = d.value; App.render(); scrollTop(); },
    "customer.mode": (d) => { S().mode = d.value; App.render(); },
    "customer.day": (d) => { const b = S().bk; b.day = d.value; App.render(); },
    "customer.time": (d) => { const b = S().bk; b.time = d.value; App.render(); },
    "customer.guests": (d) => { const b = S().bk; b.guests = Math.max(1, Math.min(maxSeats(), (Number(b.guests) || 1) + Number(d.d))); App.render(); },
    "customer.guestsSet": (d) => { S().bk.guests = Number(d.n); App.render(); },
    "customer.area": (d) => { S().bk.area = d.id; App.render(); },
    "customer.goStep": (d) => { S().bk.step = Number(d.step) || 0; App.render(); scrollTop(); },
    "customer.next": () => {
      const b = S().bk;
      if (b.step === 0 && !b.time) return App.toast("Vui lòng chọn giờ đến.", "error");
      if (b.step === 1 && !b.area) return App.toast("Vui lòng chọn khu vực.", "error");
      b.step = Math.min(2, (b.step || 0) + 1);
      App.render();
      scrollTop();
    },
    "customer.submit": () => {
      const b = S().bk;
      b.tried = true;
      if (!C().booking.enabled) return App.toast("Quán tạm ngưng nhận đặt bàn trực tuyến.", "error");
      if (String(b.name || "").trim().length < 2 || !validPhone(b.phone)) { App.render(); return App.toast("Vui lòng kiểm tra lại họ tên và số điện thoại.", "error"); }
      if (!slotOpen(b.day, b.time)) { b.step = 0; App.render(); return App.toast("Khung giờ đã qua. Vui lòng chọn giờ khác.", "error"); }
      const bk = App.commit(() => Engine.createBooking({ name: String(b.name).trim(), phone: normPhone(b.phone), dayKey: b.day, time: b.time, guests: b.guests, areaId: b.area, note: String(b.note || "").trim(), source: "web" }), (r) => (r.status === "holding" ? "Đã giữ bàn. Vui lòng chuyển khoản cọc trong " + C().booking.holdMinutes + " phút" : "Đặt bàn thành công"));
      if (bk) { b.bookingId = bk.id; b.tried = false; App.render(); scrollTop(); }
    },
    "customer.simPaid": () => {
      const id = S().bk.bookingId;
      App.commit(() => Engine.confirmDeposit(id), "Ngân hàng đã báo nhận tiền cọc. Đặt bàn đã được xác nhận");
      scrollTop();
    },
    "customer.cancelHold": async () => {
      const id = S().bk.bookingId;
      const ok = await App.confirm({ title: "Hủy giữ chỗ", message: "Bàn đang giữ sẽ được nhả cho khách khác. Bạn có chắc muốn hủy?", confirm: "Hủy giữ chỗ", cancel: "Tiếp tục đặt bàn", danger: true });
      if (!ok) return;
      App.commit(() => Engine.cancelBooking(id, "Khách tự hủy khi chờ đặt cọc"), "Đã hủy giữ chỗ");
    },
    "customer.reset": () => {
      const st = S();
      st.bk = { step: 0, day: null, time: null, guests: st.bk.guests || 4, area: null, name: st.bk.name, phone: st.bk.phone, note: "", tried: false, bookingId: null };
      st.mode = "new";
      App.render();
      scrollTop();
    },
    "customer.rebook": () => {
      const b = S().bk;
      b.bookingId = null;
      b.step = 2;
      b.tried = false;
      App.render();
      scrollTop();
    },
    "customer.ics": (d) => {
      const bk = Store.data.bookings.find((x) => x.id === d.id);
      if (!bk) return;
      U.download("dat-ban-" + codeOf(bk) + ".ics", icsFor(bk), "text/calendar;charset=utf-8");
      App.toast("Đã tải tệp lịch. Mở tệp để thêm vào lịch điện thoại.", "success");
    },
    "customer.copy": (d) => {
      const text = d.text || "";
      const done = () => App.toast("Đã sao chép: " + text, "success");
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, () => App.toast(text, "info"));
        else App.toast(text, "info");
      } catch (e) { App.toast(text, "info"); }
    },
    /* Tra cuu dat ban */
    "customer.lookup": () => {
      const l = S().lk;
      if (!validPhone(l.phone)) return App.toast("Số điện thoại gồm 10 chữ số, bắt đầu bằng số 0.", "error");
      l.searched = normPhone(l.phone);
      App.render();
    },
    "customer.lkDemo": (d) => { const l = S().lk; l.phone = d.v; l.searched = d.v; App.render(); },
    "customer.openPay": (d) => { const st = S(); st.mode = "new"; st.bk.bookingId = d.id; App.render(); scrollTop(); },
    "customer.cancelBk": async (d) => {
      const bk = Store.data.bookings.find((x) => x.id === d.id);
      if (!bk) return;
      const res = await App.confirm({ title: "Hủy đặt bàn " + codeOf(bk), message: "Bàn lúc " + esc(bk.time) + " ngày " + esc(U.dayLabel(bk.dayKey)) + " sẽ được nhả cho khách khác." + (bk.depositPaid && bk.deposit ? " Quán sẽ liên hệ qua số điện thoại để xử lý tiền cọc " + U.money(bk.deposit) + "." : ""), reason: "optional", reasonLabel: "Lý do hủy", placeholder: "VD: thay đổi kế hoạch", confirm: "Hủy đặt bàn", cancel: "Giữ đặt bàn", danger: true });
      if (!res) return;
      App.commit(() => Engine.cancelBooking(bk.id, res.reason || "Khách tự hủy trên website"), "Đã hủy đặt bàn " + codeOf(bk));
    },
    /* Ruou gui */
    "customer.btDemo": (d) => { S().bt.phone = d.v; App.render(); },
    "customer.otpSend": () => {
      const b = S().bt;
      const phone = b.code ? b.target : b.phone;
      if (!validPhone(phone)) return App.toast("Số điện thoại gồm 10 chữ số, bắt đầu bằng số 0.", "error");
      b.target = normPhone(phone);
      b.code = String(Math.floor(100000 + Math.random() * 900000));
      b.otp = "";
      App.render();
      App.toast("Đã gửi mã xác thực tới " + fmtPhone(b.target), "success");
    },
    "customer.otpVerify": () => {
      const b = S().bt;
      if (String(b.otp || "").trim() !== b.code) return App.toast("Mã xác thực không đúng. Kiểm tra lại tin nhắn hoặc bấm Gửi lại mã.", "error");
      b.verified = b.target;
      b.code = "";
      b.otp = "";
      App.render();
    },
    "customer.otpChange": () => { const b = S().bt; b.code = ""; b.otp = ""; App.render(); },
    "customer.btLogout": () => { const b = S().bt; b.verified = ""; b.code = ""; b.otp = ""; App.render(); },
    /* Xuat hoa don */
    "customer.invFind": () => {
      const v = S().inv;
      const s = findSaleByCode(v.code);
      if (!s) return App.toast("Không tìm thấy hóa đơn với mã " + (String(v.code || "").toUpperCase() || "vừa nhập") + ". Kiểm tra lại 8 ký tự cuối hóa đơn.", "error");
      v.saleId = s.id;
      v.code = saleCode(s);
      v.tried = false;
      App.render();
    },
    "customer.invPick": (d) => { const v = S().inv; v.code = d.code; App.run("customer.invFind", {}); },
    "customer.invBack": () => { const v = S().inv; v.saleId = null; App.render(); },
    "customer.taxBlur": (d) => fillTax(d.value, true),
    "customer.taxLookup": () => {
      const v = S().inv;
      if (!/^\d{10}(\d{3})?$/.test(String(v.taxCode || "").replace(/[\s-]/g, ""))) return App.toast("Mã số thuế gồm 10 hoặc 13 chữ số.", "error");
      fillTax(v.taxCode, false);
    },
    "customer.taxDemo": (d) => { const v = S().inv; v.taxCode = d.v; fillTax(d.v, false); },
    "customer.invSubmit": () => {
      const v = S().inv;
      v.tried = true;
      const ei = App.commit(() => Engine.requestEInvoice({ saleId: v.saleId, taxCode: String(v.taxCode || "").replace(/[\s-]/g, ""), company: String(v.company || "").trim(), address: String(v.address || "").trim(), email: String(v.email || "").trim() }), (r) => "Đã phát hành hóa đơn " + r.invoiceNo);
      if (ei) { v.resultId = ei.id; v.tried = false; App.render(); scrollTop(); }
      else App.render();
    },
    "customer.invReset": () => {
      const st = S();
      st.inv = { code: "", saleId: null, taxCode: st.inv.taxCode, company: st.inv.company, address: st.inv.address, email: st.inv.email, tried: false, resultId: null };
      App.render();
    },
  });
})();
