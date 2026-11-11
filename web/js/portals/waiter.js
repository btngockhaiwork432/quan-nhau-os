/* =========================================================================
   Giao dien 2 - PHUC VU (dien thoai, man hinh doc)
   Tab day: Ban | Viec can lam | Ca nhan
   Goi mon luon bat dau tu ban -> khong goi nham ban
   ========================================================================= */
(function () {
  const I = U.icon, esc = U.esc;
  const P = "waiter";
  const S = () => App.state(P, { tab: "tables", view: "floor", tableId: null, area: "all", mine: false, cat: "popular", q: "", cart: [], pendingSend: null, guests: 4 });

  /* ---------- Thanh so lieu ---------- */
  function kpis(me) {
    const w = Store.config.widgets.waiter || {};
    const att = Engine.activeAtt(me.id);
    const myTickets = Engine.openTickets().filter((t) => t.waiterId === me.id);
    const seaMenus = Store.config.menu.filter((m) => m.kind === "seafood" && m.active);
    const totalFish = U.sum(seaMenus, (m) => (Engine.syncTank(m.id) || {}).count || 0);
    const lowDishes = Store.config.menu.filter((m) => m.kind === "dish" && m.active && Engine.menuAvailability(m.id).maxPortions <= 6).length;
    const todaySales = Store.data.sales.filter((s) => s.dayKey === U.dayKey());
    const tips = Engine.tipEarnedByStaff(me.id, todaySales);
    let up = 0;
    todaySales.forEach((s) => s.lines.forEach((l) => { if (l.addedBy === me.id && !l.isFree) { const m = Engine.menu(l.menuId); if (m && m.kind === "seafood") up += (l.kg || 0) * (m.upsellPerKg || 0); else if (m && m.upsell) up += l.qty * m.upsell; } }));
    const pay = Engine.payroll(me.id);
    const cards = [];
    if (w.shift) cards.push(UI.kpi({ label: "Ca hôm nay", icon: "clock", value: att ? UI.since(att.in) : "Chưa vào ca", meta: att ? "Vào lúc " + U.time(att.in) + (att.lateMin > Store.config.attendance.graceMinutes ? " · trễ " + att.lateMin + " phút" : " · đúng giờ") : "Chạm để chấm công", tone: att ? "" : "warn", act: "waiter.tab", data: { value: "me" } }));
    if (w.tables) cards.push(UI.kpi({ label: "Bàn đang phục vụ", icon: "layout-grid", value: myTickets.length, meta: myTickets.length ? U.moneyShort(U.sum(myTickets, (t) => Engine.totals(t).grand)) + " đang mở" : "Chưa có bàn" }));
    if (w.weigh !== false) cards.push(UI.kpi({ label: "Bể cá & Kho món", icon: "fish", value: totalFish + " con cá", meta: lowDishes ? lowDishes + " món sắp hết NL · Chạm xem" : "Xem từng con cá & số phần", tone: lowDishes ? "warn" : "good", act: "waiter.stockModal" }));
    if (w.tips) cards.push(UI.kpi({ label: "Thưởng và tip hôm nay", icon: "hand-coins", value: U.moneyShort(Math.round(up / 1000) * 1000 + tips), meta: "Tip " + U.moneyShort(tips) + " · thưởng " + U.moneyShort(up) }));
    if (w.payslip) cards.push(UI.kpi({ label: "Lương tạm tính", icon: "wallet", value: U.moneyShort(pay.net), meta: U.monthLabel(pay.monthKey), act: "waiter.tab", data: { value: "me" } }));
    return cards.length ? '<div class="kpi-strip">' + cards.join("") + "</div>" : "";
  }

  /* ---------- Tab Ban ---------- */
  function floorView(me) {
    const st = S();
    const att = Engine.activeAtt(me.id);
    const areas = [{ value: "all", label: "Tất cả" }].concat(Store.config.areas.map((a) => ({ value: a.id, label: a.name })));
    const myAssignedTables = (me.assignedTables || []).map((tid) => (Engine.table(tid) || {}).code).filter(Boolean);
    const myAssignedAreas = (me.assignedAreas || []).map((aid) => (Engine.area(aid) || {}).name).filter(Boolean);
    const assignSummary = myAssignedTables.length
      ? "Phân công bàn của <b>" + esc(me.name) + "</b>: <b>" + esc(myAssignedTables.join(", ")) + "</b>" + (myAssignedAreas.length ? " (" + esc(myAssignedAreas.join(", ")) + ")" : "")
      : myAssignedAreas.length
      ? "Phân công khu vực của <b>" + esc(me.name) + "</b>: <b>" + esc(myAssignedAreas.join(", ")) + "</b>"
      : "Chế độ nhận bàn tự do";
    return (att ? "" : UI.banner("warning", "clock", "<b>Bạn chưa chấm công vào ca.</b> Chấm công trước khi nhận bàn. " + '<a href="#" data-act="waiter.checkin">Chấm công ngay</a>')) +
      kpis(me) +
      '<div class="card card-pad" style="padding:10px 12px;background:var(--surface-2)">' +
        '<div class="row between wrap gap-8">' +
          '<div class="small">' + I("user-check", "ic-sm") + " " + assignSummary + "</div>" +
          '<label class="check small">' + UI.switchInput({ checked: st.mine, change: "waiter.mine" }) + "<span>Chỉ bàn của tôi (" + Store.config.tables.filter((t) => Engine.isMyTable(me.id, t.id)).length + " bàn)</span></label>" +
        "</div>" +
      "</div>" +
      '<div class="row between">' + UI.chips(areas, st.area, "waiter.area") + "</div>" +
      UI.floor({ act: "waiter.table", areaId: st.area, filter: st.mine ? (t) => Engine.isMyTable(me.id, t.id) : null }) +
      '<div class="mt-8">' + UI.legend() + "</div>";
  }

  function tableView(me) {
    const st = S();
    const table = Engine.table(st.tableId);
    const tk = table && Engine.ticketByTable(table.id);
    if (!tk) {
      st.view = "floor";
      return floorView(me);
    }
    const payCode = Engine.ensurePayCode(tk);
    const tot = Engine.totals(tk);
    const need = Math.max(0, tot.grand - tot.deposit);
    const status = Engine.tableStatus(table);
    const pend = st.pendingSend && st.pendingSend.ticketId === tk.id ? st.pendingSend.items : [];
    const canTotal = Engine.can(me.role, "viewTableTotal");
    const canPay = Engine.can(me.role, "collectPayment") !== false;
    const waiterName = Engine.staffName(tk.waiterId || me.id);
    const items = tk.items.slice().reverse();
    const hasPaidBeer = tk.items.some((i) => !i.isFree && i.status !== "void" && (Engine.menu(i.menuId) || {}).kind === "beer");
    const lineHtml = (it) => {
      const m = Engine.menu(it.menuId);
      const isPaidBeer = m && m.kind === "beer" && !it.isFree && it.status !== "void";
      let badge = "";
      if (it.status === "void") badge = UI.badge("Đã hủy", "");
      else if (it.status === "pending_weigh") badge = UI.badge("Chờ cân", "warning");
      else if (it.voidRequested) badge = UI.badge("Chờ duyệt hủy", "danger");
      else if (it.status === "sent") badge = '<button class="btn btn-sm" data-act="waiter.served" data-item="' + it.id + '">Đã bưng</button>';
      else if (it.status === "served") badge = UI.badge("Đã ra", "success");
      const retBtn = isPaidBeer
        ? '<button type="button" class="btn btn-sm" style="border-color:var(--warning);color:var(--warning)" data-act="waiter.returnBeerModal" data-item="' + it.id + '" data-menu="' + it.menuId + '">Trả bia dư</button>'
        : "";
      return '<div class="line ' + (it.status === "void" ? "void" : "") + '"><span class="l-qty">' + (m && m.kind === "seafood" ? "" : it.qty + "x") + '</span><div class="l-name"><div class="strong">' + esc(it.name) + '</div><div class="l-note">' + esc([Engine.itemLabel(it), it.sentAt ? U.time(it.sentAt) : ""].filter(Boolean).join(" · ")) + "</div></div>" + '<div class="col" style="align-items:flex-end;gap:4px">' + (canTotal ? '<span class="l-amt">' + (it.status === "pending_weigh" ? "--" : U.moneyPlain(Engine.itemAmount(it))) + "</span>" : "") + '<div class="row gap-4">' + retBtn + badge + "</div></div></div>";
    };
    return '<div class="row between"><button class="btn btn-ghost" data-act="waiter.back">' + I("chevron-left") + "Sơ đồ bàn</button>" + UI.badge(Engine.STATUS_LABEL[status.status], status.status === "locked" ? "danger" : status.status === "weigh" ? "warning" : "primary", true) + "</div>" +
      '<div class="card card-pad"><div class="row between gap-8"><div><h2 style="font-size:24px">' + esc(table.code) + '</h2><div class="muted small">' + tk.guests + " khách · vào lúc " + U.time(tk.openedAt) + " · " + UI.since(tk.openedAt) + "</div></div>" +
      (canTotal ? '<div class="right" style="flex-shrink:0"><div class="muted small">Cần thanh toán</div><div class="strong num" style="font-size:20px;white-space:nowrap">' + U.money(need) + "</div></div>" : "") + "</div>" +
      '<div class="row between wrap gap-8 mt-8">' +
        '<div class="row gap-6 wrap">' +
          UI.badge("Đứng bàn: " + waiterName, tk.waiterId === me.id ? "success" : "info") +
          UI.badge("Mã QR: " + payCode, "neutral") +
        "</div>" +
        '<button type="button" class="btn btn-sm btn-ghost" data-act="waiter.assignWaiterModal">' + I("user-pen", "ic-sm") + " Đổi người phụ trách</button>" +
      "</div>" +
      (tot.vip ? '<div class="mt-8">' + (tot.vip.waived ? UI.badge("Đã đạt mức chi tối thiểu - miễn phụ thu VIP", "success") : UI.badge("Phụ thu VIP " + U.money(tot.vip.fee) + " · còn " + U.moneyShort(tot.vip.remainingToMin) + " để được miễn", "violet")) + "</div>" : "") +
      (tk.deposit ? '<div class="mt-8">' + UI.badge("Đã cọc " + U.money(tk.deposit), "success") + "</div>" : "") +
      "</div>" +
      (tk.status === "locked" ? UI.banner("danger", "lock", "<b>Bill đã khóa</b> sau khi in tạm tính lúc " + U.time(tk.prebillAt) + ". Muốn gọi thêm, báo thu ngân gửi yêu cầu mở khóa.") : "") +
      (tk.prebillOutdated ? UI.banner("warning", "triangle-alert", "<b>Phiếu tạm tính cũ đã hết hiệu lực</b> (" + esc(tk.prebillInvalidatedReason || "Đã chỉnh sửa trả bia dư") + "). Vui lòng báo Thu ngân <b>In lại tạm tính</b> trước khi gửi khách.") : "") +
      (tk.prebillRequestedAt && tk.status !== "locked" ? UI.banner("info", "receipt-text", "Đã báo thu ngân in tạm tính lúc " + U.time(tk.prebillRequestedAt) + ".") : "") +
      '<div class="card"><div class="card-head"><div><h3>Món đã gọi</h3><span class="sub">' + tot.itemCount + " phần</span></div>" +
      (hasPaidBeer ? UI.btn("Trả bia dư (lon/chai)", { size: "sm", icon: "beer", act: "waiter.returnBeerModal" }) : "") +
      "</div><div class='card-body' style='padding-top:0;padding-bottom:0'>" +
      (pend.length ? pend.map((c) => '<div class="line"><span class="l-qty">' + c.qty + 'x</span><div class="l-name"><div class="strong">' + esc(Engine.menu(c.menuId).name) + '</div><div class="l-note">Đang gửi bếp...</div></div>' + UI.badge("Đang gửi", "info") + "</div>").join("") : "") +
      (items.length ? items.map(lineHtml).join("") : pend.length ? "" : UI.empty("clipboard-list", "Chưa gọi món", "Chạm Thêm món để bắt đầu.")) +
      "</div></div>" +
      '<div class="sticky-action"><div class="row gap-8">' +
        UI.btn("Khác", { act: "waiter.more", icon: "ellipsis", size: "lg" }) +
        (canPay && tot.itemCount > 0 ? UI.btn("Thanh toán", { act: "waiter.payModal", kind: "success", size: "lg", icon: "qr-code", cls: "grow", disabled: !!tot.pendingWeigh }) : "") +
        UI.btn("Thêm món", { act: "waiter.order", kind: "primary", size: "lg", icon: "plus", cls: "grow", disabled: tk.status === "locked" }) +
      "</div></div>";
  }

  /* ---------- Man hinh goi mon ---------- */
  function cartLineAmount(c) {
    const m = Engine.menu(c.menuId);
    if (!m) return 0;
    const s = c.styleId ? Engine.style(c.styleId) : null;
    const sur = s ? Number(s.surcharge) || 0 : 0;
    if (m.kind === "seafood") {
      if (c.dealAmount !== undefined && c.dealAmount !== null && Number(c.dealAmount) > 0) {
        return Math.round(Number(c.dealAmount)) + sur;
      }
      return Math.round((Number(c.kg) || 0) * (m.pricePerKg || 0) / 1000) * 1000 + sur;
    }
    return (Number(c.qty) || 1) * ((m.price || 0) + sur);
  }

  function orderView(me) {
    const st = S();
    const table = Engine.table(st.tableId);
    const cats = [{ value: "popular", label: "Gọi nhiều" }].concat(Engine.sortedCategories().map((c) => ({ value: c.id, label: c.name })));
    let items = Engine.activeMenu();
    if (st.q) items = items.filter((m) => U.match(m.name, st.q));
    else if (st.cat === "popular") items = items.filter((m) => m.popular);
    else items = items.filter((m) => m.categoryId === st.cat);
    const inCart = {};
    st.cart.forEach((c) => (inCart[c.menuId] = (inCart[c.menuId] || 0) + (Engine.menu(c.menuId).kind === "seafood" ? (c.count || 1) : c.qty)));
    const grid = items.map((m) => {
      const av = Engine.menuAvailability(m.id);
      const out = !av.available;
      const price = m.kind === "seafood" ? U.moneyPlain(m.pricePerKg) + " /kg" : U.moneyPlain(m.price) + " /" + m.unit;
      const fishPreview = m.kind === "seafood" && av.fishList && av.fishList.length
        ? '<span class="mi-fish-pills">' + av.fishList.slice(0, 4).map((f) => '<i>' + esc(f.code) + ": " + U.num(f.kg, 2) + "kg</i>").join("") + (av.fishList.length > 4 ? "<i>+" + (av.fishList.length - 4) + " con</i>" : "") + "</span>"
        : m.kind === "beer"
        ? '<span class="mi-fish-pills"><i>1 thùng = ' + (m.caseSize || 24) + " " + esc(m.unit || "lon") + ' (' + U.moneyShort((m.price || 0) * (m.caseSize || 24)) + ')</i><i>Có trả lẻ ' + esc(m.unit || "lon") + ' dư</i></span>'
        : "";
      return '<button type="button" class="menu-item ' + (inCart[m.id] ? "in-cart " : "") + (out ? "sold-out" : "") + '" data-act="waiter.add" data-menu="' + m.id + '" data-long="waiter.options">' +
        '<span class="mi-name">' + esc(m.name) + "</span>" +
        '<span class="mi-price">' + price + "</span>" +
        '<span class="mi-avail tone-' + (av.tone || "neutral") + '">' + esc(av.label) + "</span>" +
        fishPreview +
        (inCart[m.id] ? '<span class="mi-qty">' + inCart[m.id] + "</span>" : "") + "</button>";
    }).join("");
    const count = U.sum(st.cart, (c) => (Engine.menu(c.menuId).kind === "seafood" ? 1 : c.qty));
    const amount = U.sum(st.cart, cartLineAmount);
    return '<div class="row between wrap gap-8"><button class="btn btn-ghost" data-act="waiter.cancelOrder">' + I("chevron-left") + "Bàn " + esc(table.code) + "</button>" +
      '<div class="row gap-8">' +
      UI.btn("Xem bể cá & Kho món", { size: "sm", icon: "fish", act: "waiter.stockModal" }) +
      '<span class="small muted">Chạm: chọn món · Giữ: tùy chọn</span></div></div>' +
      UI.search({ id: "waiter-q", model: "waiter.q", placeholder: "Tìm món, gõ không dấu cũng được", value: st.q }) +
      (st.q ? "" : UI.chips(cats, st.cat, "waiter.cat")) +
      (grid ? '<div class="menu-grid">' + grid + "</div>" : UI.empty("search", "Không tìm thấy món", "Thử từ khóa khác.")) +
      (count ? '<div class="sticky-action"><div class="cart-bar"><div class="cb-info" data-act="waiter.cart" style="cursor:pointer"><b>' + count + " món · " + U.money(amount) + '</b><span>Giá đã tính chuẩn theo số kg thực tế · Chạm xem lại</span></div><button class="btn btn-primary" data-act="waiter.send">' + I("send") + "Gửi bếp</button></div></div>" : "");
  }

  /* ---------- Tab Viec can lam ---------- */
  function tasks(me) {
    const now = Date.now();
    const out = [];
    const cfg = Store.config;
    Store.data.notifications.filter((n) => !n.read && n.type === "payment_success" && (!n.waiterId || n.waiterId === me.id)).forEach((n) => out.push({ id: n.id, icon: "circle-check", tone: "success", title: n.text, meta: "Lúc " + U.time(n.at) + " · Tự động khớp VietQR", act: "waiter.readNote" }));
    Store.data.notifications.filter((n) => !n.read && n.type === "payment_partial" && (!n.waiterId || n.waiterId === me.id)).forEach((n) => out.push({ id: n.id, icon: "coins", tone: "warning", title: n.text, meta: "Lúc " + U.time(n.at) + " · Khách chuyển 1 phần VietQR", act: "waiter.readNote" }));
    Store.data.notifications.filter((n) => !n.read && n.type === "payment_overpaid_closed" && (!n.waiterId || n.waiterId === me.id)).forEach((n) => out.push({ id: n.id, icon: "triangle-alert", tone: "danger", title: n.text, meta: "Lúc " + U.time(n.at) + " · Báo thu ngân xử lý", act: "waiter.readNote" }));
    Store.data.notifications.filter((n) => !n.read && n.type === "weighed" && (!n.waiterId || n.waiterId === me.id)).forEach((n) => out.push({ id: n.id, icon: "scale", tone: "success", title: n.text, meta: "Lúc " + U.time(n.at) + " · đã chuyển bếp", act: "waiter.readNote" }));
    Engine.openTickets().filter((t) => t.waiterId === me.id || !t.waiterId).forEach((t) => {
      const table = Engine.table(t.tableId);
      t.items.filter((i) => i.status === "sent" && now - i.sentAt > cfg.floor.slowOrderMinutes * 60000).forEach((i) => out.push({ icon: "timer", tone: "danger", title: "Bàn " + table.code + ": " + i.name + " chờ lâu", meta: "Đã gửi " + U.duration(now - i.sentAt) + " - kiểm tra với bếp", table: t.tableId }));
      const tot = Engine.totals(t);
      if (tot.vip && !tot.vip.waived && tot.vip.nextHourIn <= cfg.floor.vipWarnMinutes) out.push({ icon: "hourglass", tone: "warning", title: table.code + " sắp sang giờ tiếp theo", meta: "Còn " + tot.vip.nextHourIn + " phút, phụ thu thêm " + U.money(cfg.vip.hourlyRate), table: t.tableId });
      if (t.status === "locked") out.push({ icon: "lock", tone: "info", title: "Bàn " + table.code + " đã in tạm tính", meta: "Chờ khách thanh toán · " + U.money(tot.grand), table: t.tableId });
    });
    Engine.weighQueue().filter((q) => q.ticket.waiterId === me.id).forEach((q) => out.push({ icon: "fish", tone: "warning", title: "Bàn " + q.table.code + ": " + q.item.name + " đang chờ cân", meta: "Đã chờ " + U.clock(q.waitMs), table: q.ticket.tableId }));
    Object.keys(Store.data.tableState).forEach((tid) => out.push({ icon: "sparkles", tone: "", title: "Bàn " + Engine.table(tid).code + " cần dọn", meta: "Khách rời lúc " + U.time(Store.data.tableState[tid].since), clean: tid }));
    return out;
  }
  function tasksView(me) {
    const list = tasks(me);
    return "<h2 style='font-size:18px'>Việc cần làm</h2>" + (list.length ? '<div class="card list">' + list.map((t) => '<div class="list-row"><span class="badge badge-' + (t.tone || "") + '" style="width:32px;height:32px;padding:0;justify-content:center">' + I(t.icon, "ic-sm") + '</span><div class="grow"><div class="strong">' + esc(t.title) + '</div><div class="meta">' + esc(t.meta) + "</div></div>" + (t.act ? UI.btn("Đã xem", { size: "sm", act: t.act, data: { id: t.id } }) : t.clean ? UI.btn("Đã dọn", { size: "sm", act: "waiter.clean", data: { table: t.clean } }) : t.table ? UI.iconBtn("chevron-right", { act: "waiter.table", data: { table: t.table }, title: "Mở bàn" }) : "") + "</div>").join("") + "</div>" : UI.empty("circle-check", "Không có việc tồn đọng", "Món ra, hải sản đã cân và bàn cần dọn sẽ hiện ở đây."));
  }

  /* ---------- Tab Ca nhan ---------- */
  function meView(me) {
    const att = Engine.activeAtt(me.id);
    const today = Engine.attOfDay(me.id);
    const pay = Engine.payroll(me.id);
    const recent = pay.records.slice(-6).reverse();
    return '<div class="card card-pad"><div class="row gap-12">' + UI.avatar(me.name, true) + '<div class="grow"><div class="strong" style="font-size:16px">' + esc(me.name) + '</div><div class="muted small">' + esc(Engine.roleLabel(me.role)) + " · " + esc((Engine.shiftDef(me.shiftId) || {}).name || "") + "</div></div></div></div>" +
      '<div class="card"><div class="card-head"><h3>Chấm công</h3>' + (att ? UI.badge("Đang trong ca", "success", true) : UI.badge("Chưa vào ca", "warning", true)) + '</div><div class="card-body col gap-12">' +
      (att ? '<div class="row between"><div><div class="muted small">Vào ca lúc</div><div class="strong" style="font-size:20px">' + U.time(att.in) + '</div></div><div class="right"><div class="muted small">Đã làm</div><div class="strong" style="font-size:20px">' + UI.since(att.in) + "</div></div></div>" + (att.lateMin > Store.config.attendance.graceMinutes ? UI.banner("warning", "triangle-alert", "Đi trễ " + att.lateMin + " phút · phạt " + U.money(Engine.latePenalty(att.lateMin))) : "") + UI.btn("Chấm công ra ca", { act: "waiter.checkout", size: "lg", block: true, icon: "log-out" })
        : '<p class="muted">Cần kết nối Wi-Fi của quán, ở trong bán kính ' + Store.config.attendance.gpsRadius + " m và chụp ảnh xác thực.</p>" + UI.btn("Chấm công vào ca", { act: "waiter.checkin", kind: "primary", size: "lg", block: true, icon: "clock" })) +
      (today.filter((a) => a.out).length ? '<div class="small muted">Hôm nay: ' + today.filter((a) => a.out).map((a) => U.time(a.in) + " - " + U.time(a.out)).join(", ") + "</div>" : "") +
      "</div></div>" +
      '<div class="card"><div class="card-head"><h3>Lương tạm tính</h3><span class="sub">Cập nhật theo từng bill</span></div><div class="card-body">' + UI.payslip(pay) +
      '<div class="divider"></div><div class="row between"><div><div class="small muted">Có thể ứng tối đa</div><div class="strong">' + U.money(pay.advanceAvailable) + "</div></div>" + UI.btn("Xin ứng lương", { act: "waiter.advance", icon: "wallet", disabled: pay.advanceAvailable < 50000 }) + "</div>" +
      (pay.advPending ? '<div class="mt-8">' + UI.badge("Đang chờ duyệt/chi " + U.money(pay.advPending), "warning") + "</div>" : "") +
      "</div></div>" +
      '<div class="card"><div class="card-head"><h3>Ca gần đây</h3><span class="sub">' + pay.days + " ngày công trong tháng</span></div>" +
      (recent.length ? '<div class="list">' + recent.map((r) => { const h = Engine.attHours(r); return '<div class="list-row"><div class="grow"><div class="strong">' + U.dayLabel(r.dayKey) + '</div><div class="meta">' + U.time(r.in) + " - " + (r.out ? U.time(r.out) : "đang làm") + (r.lateMin > Store.config.attendance.graceMinutes ? " · trễ " + r.lateMin + " phút" : "") + (r.otStatus === "pending" ? " · tăng ca chờ duyệt" : "") + '</div></div><span class="num strong">' + U.num(h.regular + h.ot, 1) + " giờ</span></div>"; }).join("") + "</div>" : UI.empty("calendar", "Chưa có ca nào trong tháng")) +
      "</div>";
  }

  /* ---------- Render ---------- */
  App.portal(P, {
    render() {
      const me = App.me();
      const st = S();
      let content;
      if (st.tab === "tables") content = st.view === "table" ? tableView(me) : st.view === "order" ? orderView(me) : floorView(me);
      else if (st.tab === "tasks") content = tasksView(me);
      else content = meView(me);
      const taskCount = tasks(me).length;
      return '<div class="mobile-stage"><div class="mobile-app">' + UI.topbar({ role: "Phục vụ" }) +
        '<main class="mobile-content" data-keep-scroll="waiter">' + content + "</main>" +
        UI.bottomNav([{ value: "tables", label: "Bàn", icon: "layout-grid" }, { value: "tasks", label: "Việc cần làm", icon: "bell", count: taskCount }, { value: "me", label: "Cá nhân", icon: "user" }], st.tab, "waiter.tab") +
        "</div></div>";
    },
  });

  /* ---------- Nhan giu (long press) tren mon ---------- */
  let lpTimer = null, lpFired = false;
  document.addEventListener("pointerdown", (e) => {
    const el = e.target.closest("[data-long]");
    if (!el) return;
    lpFired = false;
    lpTimer = setTimeout(() => {
      lpFired = true;
      App.run(el.dataset.long, Object.assign({}, el.dataset), el, e);
    }, 480);
  });
  ["pointerup", "pointerleave", "pointercancel", "pointermove"].forEach((t) => document.addEventListener(t, (e) => {
    if (t === "pointermove" && (Math.abs(e.movementX) + Math.abs(e.movementY) < 4)) return;
    clearTimeout(lpTimer);
  }));
  document.addEventListener("click", (e) => {
    if (lpFired && e.target.closest("[data-long]")) {
      e.stopPropagation();
      e.preventDefault();
      lpFired = false;
    }
  }, true);
  document.addEventListener("contextmenu", (e) => { if (e.target.closest("[data-long]")) e.preventDefault(); });

  /* ---------- Hop chon tuy chon mon (Chon con ca trong be, Ban theo gram & Khach ep gia nguyen con) ---------- */
  function optionsModal(menuId, existingIndex) {
    const m = Engine.menu(menuId);
    const st = S();
    const ex = existingIndex !== undefined ? st.cart[existingIndex] : null;
    const av = Engine.menuAvailability(m.id);
    const isCountSea = Engine.isCountableSeafood(m);
    const pol = Engine.seafoodPolicy();
    const reservedIds = new Set();
    st.cart.forEach((c, idx) => {
      if (idx !== existingIndex && c.menuId === m.id && c.saleMode !== "gram" && Array.isArray(c.fishIds)) {
        c.fishIds.forEach((fid) => reservedIds.add(fid));
      }
    });
    const availFish = (av.fishList || []).filter((f) => !reservedIds.has(f.id));
    const initFishIds = ex && Array.isArray(ex.fishIds) ? ex.fishIds.slice() : [];
    const defaultSourceFish = availFish.find((f) => f.partial) || availFish[0] || null;
    const defaultBeerQty = m.kind === "beer" ? Math.min(Number(m.caseSize) || 24, av.maxPortions || 24) : 1;
    const o = (st._opt = {
      menuId,
      qty: ex ? ex.qty : defaultBeerQty,
      styleId: ex ? ex.styleId : (m.styles && m.styles[0]) || null,
      note: ex ? ex.note : "",
      saleMode: ex && ex.saleMode ? ex.saleMode : isCountSea ? "whole" : "gram",
      fishIds: initFishIds,
      multiFish: initFishIds.length > 1,
      sourceFishId: ex && ex.sourceFishId ? ex.sourceFishId : defaultSourceFish ? defaultSourceFish.id : "",
      gram: ex && ex.gram ? ex.gram : 500,
      kg: ex && ex.kg ? ex.kg : isCountSea ? U.sum(availFish.filter((f) => initFishIds.includes(f.id)), (f) => f.kg) : 0.5,
      count: ex && ex.count ? ex.count : initFishIds.length || 0,
      bargainOn: !!(ex && ex.dealAmount),
      dealAmount: ex && ex.dealAmount ? ex.dealAmount : null,
      bargainNote: (ex && ex.bargain && ex.bargain.note) || "",
      index: existingIndex,
    });

    App.modal({
      title: m.name,
      sub: m.kind === "seafood"
        ? U.money(m.pricePerKg) + "/kg · Chọn nguyên con trong bể hoặc cắt lẻ theo gram"
        : m.kind === "beer"
        ? U.money(m.price) + " / " + (m.unit || "lon") + " · 1 thùng = " + (m.caseSize || 24) + " " + (m.unit || "lon") + " (" + U.money((m.price || 0) * (m.caseSize || 24)) + ") · " + av.label
        : U.money(m.price) + " / " + m.unit + " · " + av.label,
      sheet: true,
      body: () => {
        const styles = (m.styles || []).map((id) => Engine.style(id)).filter(Boolean);
        const stObj = o.styleId ? Engine.style(o.styleId) : null;
        const sur = stObj ? Number(stObj.surcharge) || 0 : 0;
        let seaSection = "";
        if (m.kind === "seafood") {
          const modeSwitch = isCountSea && pol.allowSellByGram
            ? '<div class="seg mb-8" style="display:grid;grid-template-columns:1fr 1fr;gap:6px">' +
              '<button type="button" class="' + (o.saleMode === "whole" ? "active" : "") + '" data-act="waiter.optSaleMode" data-mode="whole">' + I("fish", "ic-sm") + " Nguyên con (" + availFish.length + " con)</button>" +
              '<button type="button" class="' + (o.saleMode === "gram" ? "active" : "") + '" data-act="waiter.optSaleMode" data-mode="gram">' + I("scale", "ic-sm") + " Theo gram / Cắt khúc</button>" +
              "</div>"
            : "";

          if (isCountSea && o.saleMode === "whole") {
            const pickedFish = availFish.filter((f) => o.fishIds.includes(f.id));
            const totalKg = Math.round(U.sum(pickedFish, (f) => f.kg) * 100) / 100;
            const role = (App.me() || {}).role || "waiter";
            const bg = Engine.evaluateSeafoodBargain(m, totalKg, o.bargainOn ? o.dealAmount : null, role);
            const finalFishAmt = o.bargainOn && bg.dealAmount ? bg.dealAmount : bg.listAmount;
            const estAmt = finalFishAmt + sur;

            const bargainHtml = pol.allowWholeFishBargain && pickedFish.length
              ? '<div class="card card-pad mt-8" style="background:var(--surface-2)">' +
                '<div class="row between wrap gap-8">' +
                '<div><div class="strong small">Khách trả giá / Ép giá nguyên con</div><div class="muted" style="font-size:12px">Giá niêm yết tiền cá: <b>' + U.money(bg.listAmount) + '</b> (' + U.money(m.pricePerKg) + '/kg)</div></div>' +
                '<button type="button" class="btn btn-sm ' + (o.bargainOn ? "btn-primary" : "") + '" data-act="waiter.optBargainToggle">' + I("badge-percent", "ic-sm") + (o.bargainOn ? "Đang bật chốt giá" : "Khách trả giá") + "</button>" +
                "</div>" +
                (o.bargainOn
                  ? '<div class="col gap-8 mt-8">' +
                    (bg.quickDeals.length
                      ? '<div class="chips">' +
                        bg.quickDeals.map((v) => '<button type="button" class="chip ' + (bg.dealAmount === v ? "active" : "") + '" data-act="waiter.optDealSet" data-v="' + v + '">Chốt ' + U.money(v) + " (-" + U.moneyShort(bg.listAmount - v) + ")</button>").join("") +
                        "</div>"
                      : "") +
                    '<div class="row wrap gap-8">' +
                    '<div class="stepper"><button type="button" data-act="waiter.optDealStep" data-d="-10000">' + I("minus") + '</button><span class="num">' + U.money(bg.dealAmount) + '</span><button type="button" data-act="waiter.optDealStep" data-d="10000">' + I("plus") + "</button></div>" +
                    '<div class="grow">' + UI.input({ type: "number", step: 5000, model: "waiter._opt.dealAmount", live: true, value: bg.dealAmount, placeholder: "Nhập giá chốt nguyên con (VNĐ)" }) + "</div>" +
                    "</div>" +
                    (bg.belowCost
                      ? UI.banner("danger", "triangle-alert", "Giá khách trả (<b>" + U.money(bg.dealAmount) + "</b>) thấp hơn giá vốn nhập bể (<b>" + U.money(bg.costAmount) + "</b>). Không thể chốt lỗ.")
                      : bg.discount <= 0
                      ? '<div class="small muted">Đang giữ nguyên giá niêm yết ' + U.money(bg.listAmount) + ".</div>"
                      : bg.withinSelfLimit
                      ? '<div class="badge badge-success" style="align-self:flex-start">Giảm ' + U.money(bg.discount) + " (-" + bg.pct + "%) · Tương đương " + U.money(bg.effectivePpk) + "/kg · Tự chốt ngay tại bàn (tối đa " + bg.maxPct + "%)</div>"
                      : '<div class="badge badge-warning" style="align-self:flex-start">Giảm ' + U.money(bg.discount) + " (-" + bg.pct + "%) · Vượt khung tự chốt " + bg.maxPct + "% (sàn " + U.money(bg.minSelfAmount) + ") — Sẽ gửi Chủ quán duyệt</div>") +
                    "</div>"
                  : "") +
                "</div>"
              : "";

            seaSection = modeSwitch + UI.field(
              "Chọn con cá trong bể (" + availFish.length + " con sẵn sàng · " + (o.multiFish ? "Đang bật chọn nhiều con" : "Mặc định chọn 1 con") + ")",
              availFish.length
                ? '<div class="row between items-center mb-6">' +
                    '<span class="small muted">' + (o.multiFish ? "Chạm để cộng dồn nhiều con cá vào 1 lần gọi" : "Chạm vào mã cá khách chọn (chọn con khác sẽ tự đổi)") + '</span>' +
                    '<button type="button" class="btn btn-xs ' + (o.multiFish ? "btn-primary" : "") + '" data-act="waiter.optMultiFishToggle">' + I("layers", "ic-xs") + (o.multiFish ? " Đang chọn nhiều con" : " Chọn ghép nhiều con") + '</button>' +
                  '</div>' +
                  '<div class="fish-pick-grid">' +
                  availFish.map((f) => {
                    const sel = o.fishIds.includes(f.id);
                    return '<button type="button" class="fish-pick-card' + (sel ? " active" : "") + '" data-act="waiter.optFish" data-id="' + f.id + '">' +
                      '<div class="row between"><b>' + esc(f.code) + '</b><span class="badge ' + (sel ? "badge-primary" : f.partial ? "badge-warning" : "") + '">' + (f.partial ? "Còn " + f.gram + "g" : U.num(f.kg, 2) + " kg") + "</span></div>" +
                      '<div class="small muted num mt-4">' + U.money(f.amount) + (f.partial ? " · đang xẻ" : "") + "</div></button>";
                  }).join("") +
                  "</div>" +
                  '<div class="fish-pick-summary mt-8">' +
                  (pickedFish.length
                    ? "Đã chọn: <b>" + pickedFish.length + " con (" + pickedFish.map((f) => f.code).join(", ") + " · " + U.kg(totalKg) + ")</b> · Tổng thành tiền: <b class='text-primary num'>" + U.money(estAmt) + "</b>" + (sur ? " <span class='muted small'>(gồm chế biến +" + U.money(sur) + ")</span>" : "")
                    : "<span class='text-danger strong'>Vui lòng chạm chọn 1 con cá trong bể bên trên trước khi thêm</span>") +
                  "</div>" +
                  bargainHtml
                : UI.banner("danger", "fish", "Hiện tại trong bể đã hết " + esc(m.name) + ".")
            );
          } else {
            // Ban theo gram / cat khuc (cho ca ca lon cat khuc va hai san can le nhu Oc huong)
            const maxGram = Math.max(200, Math.round((Number(av.totalKg) || 0) * 1000));
            const minGram = Math.min(maxGram, Number(pol.minGram) || 200);
            const curGram = Math.min(maxGram, Math.max(minGram, Math.round((Number(o.gram) || 500) / 50) * 50));
            o.gram = curGram;
            o.kg = Math.round((curGram / 1000) * 100) / 100;
            const estAmt = Math.round(o.kg * (m.pricePerKg || 0) / 1000) * 1000 + sur;
            const gramPresets = [200, 300, 400, 500, 600, 700, 800, 1000, 1500].filter((g) => g >= minGram && g <= maxGram);
            const srcFish = isCountSea ? (availFish.find((f) => f.id === o.sourceFishId) || availFish[0] || null) : null;
            if (srcFish) o.sourceFishId = srcFish.id;

            const sourcePicker = isCountSea && availFish.length
              ? '<div class="mt-8"><div class="small strong mb-4">Xẻ từ con cá trong bể (phần còn dư vẫn lưu lại trong bể):</div>' +
                '<div class="chips">' +
                availFish.map((f) => '<button type="button" class="chip ' + (o.sourceFishId === f.id ? "active" : "") + '" data-act="waiter.optSourceFish" data-id="' + f.id + '">' + esc(f.code) + " (" + f.gram + "g" + (f.partial ? " · đang xẻ" : "") + ")</button>").join("") +
                "</div></div>"
              : "";

            seaSection = modeSwitch + UI.field(
              "Định lượng khách gọi theo Gram (Bể còn " + Math.round((av.totalKg || 0) * 1000) + "g · " + U.kg(av.totalKg) + ")",
              '<div class="chips mb-8">' +
                gramPresets.map((g) => '<button type="button" class="chip ' + (curGram === g ? "active" : "") + '" data-act="waiter.optGramSet" data-v="' + g + '">' + (g >= 1000 ? U.num(g / 1000, 1) + " kg (" + g + "g)" : g + "g") + "</button>").join("") +
                "</div>" +
                '<div class="row wrap gap-8">' +
                '<div class="stepper"><button type="button" data-act="waiter.optGramStep" data-d="-100">' + I("minus") + "</button><span>" + curGram + "g (" + U.num(o.kg, 2) + ' kg)</span><button type="button" data-act="waiter.optGramStep" data-d="100">' + I("plus") + "</button></div>" +
                '<div style="width:150px">' + UI.input({ type: "number", step: 50, model: "waiter._opt.gram", live: true, value: curGram, placeholder: "Số gram (VD: 500)" }) + "</div>" +
                "</div>" +
                sourcePicker +
                '<div class="fish-pick-summary mt-8">Khách gọi lẻ: <b>' + curGram + "g (" + U.num(o.kg, 2) + " kg)</b>" +
                (srcFish ? " · Xẻ từ <b>" + esc(srcFish.code) + "</b> (còn lại trong bể <b>" + Math.max(0, srcFish.gram - curGram) + "g</b>)" : "") +
                " · Thành tiền: <b class='text-primary num'>" + U.money(estAmt) + "</b></div>"
            );
          }
        } else if (m.kind === "beer") {
          const cs = Number(m.caseSize) || 24;
          const half = Math.round(cs / 2);
          const u = m.unit || "lon";
          const maxP = Math.max(1, av.maxPortions || 999);
          const presets = [
            { q: cs, label: "1 thùng (" + cs + " " + u + ")" },
            { q: cs * 2, label: "2 thùng (" + cs * 2 + " " + u + ")" },
            { q: half, label: "Nửa thùng (" + half + " " + u + ")" },
            { q: 6, label: "Lốc 6 " + u },
            { q: 1, label: "Lẻ 1 " + u },
            { q: 2, label: "Lẻ 2 " + u },
            { q: 5, label: "Lẻ 5 " + u },
          ].filter((p) => p.q <= maxP);
          const promo = Store.config.promos.find((p) => p.active && p.menuId === m.id);
          const estFree = promo ? Math.floor(o.qty / promo.buyQty) * promo.freeQty : 0;
          seaSection = UI.field(
            "Chọn đem ra bàn theo Nguyên thùng / Két hoặc Lẻ " + u + " (" + av.label + ")",
            '<div class="chips mb-8" style="flex-wrap:wrap">' +
              presets.map((p) => '<button type="button" class="chip ' + (o.qty === p.q ? "active" : "") + '" data-act="waiter.optSetQty" data-q="' + p.q + '">' + esc(p.label) + "</button>").join("") +
              "</div>" +
              '<div class="row wrap gap-8">' +
              '<div class="stepper"><button type="button" data-act="waiter.optQty" data-d="-1">' + I("minus") + "</button><span>" + o.qty + " " + esc(u) + '</span><button type="button" data-act="waiter.optQty" data-d="1">' + I("plus") + "</button></div>" +
              '<button type="button" class="btn btn-sm" data-act="waiter.optQty" data-d="' + cs + '">+1 thùng (+' + cs + ")</button>" +
              (o.qty > cs ? '<button type="button" class="btn btn-sm" data-act="waiter.optQty" data-d="-' + cs + '">-1 thùng (-' + cs + ")</button>" : "") +
              "</div>" +
              '<div class="fish-pick-summary mt-8">' +
              "Đem ra bàn: <b>" + esc(Engine.formatBeerCaseQty(o.qty, cs, u)) + "</b> · Tạm tính: <b class='text-primary num'>" + U.money(o.qty * (m.price || 0)) + "</b>" +
              (estFree > 0 ? '<div class="text-success small strong mt-4">Khuyến mãi ' + esc(promo.name) + ": Tự động tặng kèm +" + estFree + " " + esc(u) + " miễn phí!</div>" : "") +
              '<div class="small muted mt-4">Nếu khách không uống hết thùng, bấm <b>"Trả bia dư"</b> trên bàn để trừ lại theo từng ' + esc(u) + " chưa khui.</div>" +
              "</div>"
          );
        } else {
          seaSection = UI.field(
            "Số lượng (" + av.label + ")",
            '<div class="row wrap gap-8"><div class="stepper"><button type="button" data-act="waiter.optQty" data-d="-1">' + I("minus") + "</button><span>" + o.qty + '</span><button type="button" data-act="waiter.optQty" data-d="1">' + I("plus") + "</button></div>" +
              (m.caseSize ? ' <button type="button" class="btn btn-sm" data-act="waiter.optQty" data-d="' + m.caseSize + '">+1 thùng (' + m.caseSize + ")</button>" : "") +
              "</div>"
          );
        }

        return seaSection +
          (styles.length ? UI.field("Kiểu chế biến", '<div class="chips" style="flex-wrap:wrap">' + styles.map((s) => '<button type="button" class="chip ' + (o.styleId === s.id ? "active" : "") + '" data-act="waiter.optStyle" data-id="' + s.id + '">' + esc(s.name) + (s.surcharge ? " +" + U.moneyShort(s.surcharge) : "") + "</button>").join("") + "</div>") : "") +
          UI.field("Ghi chú cho bếp", UI.input({ id: "opt-note", model: "waiter._opt.note", value: o.note, placeholder: m.kind === "seafood" ? "VD: Cắt khúc nấu lẩu, hấp vừa chín, tách đầu nấu cháo" : "VD: ít cay, không hành" })) +
          '<div class="chips">' + ["Ít cay", "Không hành", "Ra sau", "Làm nhanh"].map((q) => '<button type="button" class="chip" data-act="waiter.optQuick" data-v="' + q + '">' + q + "</button>").join("") + "</div>";
      },
      foot: () => (o.index !== undefined ? UI.btn("Xóa khỏi danh sách", { act: "waiter.optRemove", kind: "danger" }) + '<span class="spacer"></span>' : "") + UI.btn(o.index !== undefined ? "Cập nhật" : "Thêm vào danh sách", { act: "waiter.optSave", kind: "primary", size: "lg", disabled: m.kind === "seafood" && isCountSea && o.saleMode === "whole" && !o.fishIds.length }),
    });
  }

  function cartModal() {
    const st = S();
    App.modal({
      title: "Kiểm tra trước khi gửi bếp",
      sub: "Bàn " + Engine.table(st.tableId).code + " · Tổng tạm tính: " + U.money(U.sum(st.cart, cartLineAmount)),
      sheet: true,
      body: () => (st.cart.length ? st.cart.map((c, i) => {
        const m = Engine.menu(c.menuId);
        const s = c.styleId ? Engine.style(c.styleId) : null;
        const amt = cartLineAmount(c);
        return '<div class="line"><div class="l-name"><div class="strong">' + esc(m.name) + ' <span class="num text-primary">' + U.money(amt) + '</span></div><div class="l-note">' + esc([s && s.name, m.kind === "seafood" ? (c.fishSummary || U.kg(c.kg)) : null, c.note].filter(Boolean).join(" · ")) + '</div><button class="btn btn-ghost btn-sm" style="padding:0;height:24px" data-act="waiter.editCart" data-i="' + i + '">Sửa tùy chọn</button></div>' + (m.kind === "seafood" ? UI.iconBtn("trash-2", { act: "waiter.cartQty", data: { i, d: -1 }, title: "Xóa" }) : '<div class="stepper"><button data-act="waiter.cartQty" data-i="' + i + '" data-d="-1">' + I(c.qty === 1 ? "trash-2" : "minus") + "</button><span>" + c.qty + '</span><button data-act="waiter.cartQty" data-i="' + i + '" data-d="1">' + I("plus") + "</button></div>") + "</div>";
      }).join("") : UI.empty("clipboard-list", "Danh sách trống")),
      foot: () => UI.btn("Gọi thêm", { act: "app.closeModal" }) + UI.btn("Gửi bếp ngay", { act: "waiter.send", kind: "primary", icon: "send", disabled: !st.cart.length }),
    });
  }

  function stockModal() {
    const seaList = Store.config.menu.filter((m) => m.kind === "seafood" && m.active);
    const dishList = Store.config.menu.filter((m) => m.kind === "dish" && m.active);
    App.modal({
      title: "Số liệu cá trong bể & Số phần món có thể làm",
      sub: "Cập nhật trực tiếp theo tồn bể hải sản và kho nguyên liệu bếp",
      size: "lg",
      sheet: true,
      body: () => {
        const seaHtml = seaList.map((m) => {
          const av = Engine.menuAvailability(m.id);
          const pills = av.fishList && av.fishList.length
            ? '<div class="fish-pick-grid mt-8">' + av.fishList.map((f) => '<div class="fish-pick-card static"><div class="row between"><b>' + esc(f.code) + '</b><span class="badge badge-info">' + U.num(f.kg, 2) + ' kg</span></div><div class="small muted num mt-4">' + U.money(f.amount) + "</div></div>").join("") + "</div>"
            : '<div class="small muted mt-4">' + esc(av.label) + "</div>";
          return '<div class="card card-pad"><div class="row between"><div><b>' + esc(m.name) + '</b><div class="small muted">' + U.money(m.pricePerKg) + "/kg</div></div>" + UI.badge(av.shortLabel || av.label, av.tone) + "</div>" + pills + "</div>";
        }).join("");

        const dishHtml = dishList.map((m) => {
          const av = Engine.menuAvailability(m.id);
          const bomText = (av.ingredients || []).map((ing) => ing.name + ": còn " + ing.have + " " + ing.unit).join(" · ");
          return '<div class="list-row"><div class="grow"><div class="strong">' + esc(m.name) + ' <span class="muted small">(' + U.money(m.price) + "/" + esc(m.unit) + ')</span></div><div class="meta">' + esc(bomText) + "</div></div>" + UI.badge(av.label, av.tone) + "</div>";
        }).join("");

        return '<div class="col gap-12">' +
          '<h3 style="font-size:15px">1. Danh sách từng con cá / hải sản còn trong bể</h3>' +
          '<div class="col gap-8">' + seaHtml + "</div>" +
          '<h3 style="font-size:15px" class="mt-8">2. Số phần món ăn có thể làm với nguyên liệu còn lại</h3>' +
          '<div class="card list">' + dishHtml + "</div>" +
          "</div>";
      },
      foot: () => UI.btn("Đóng", { kind: "primary", act: "app.closeModal" }),
    });
  }

  function doSend() {
    const st = S();
    if (!st.cart.length) return;
    const tk = Engine.ticketByTable(st.tableId);
    if (!tk) return;
    if (tk.status === "locked") return App.toast("Bill đã khóa, không thể gọi thêm.", "error");
    const items = st.cart.slice();
    st.cart = [];
    st.view = "table";
    if (App._modal) App.closeModal(true);
    const me = App.me();
    const pending = { ticketId: tk.id, items, timer: null };
    st.pendingSend = { ticketId: tk.id, items };
    const commitSend = () => {
      if (!S().pendingSend) return;
      S().pendingSend = null;
      App.commit(
        (s) => Engine.addItems(tk.id, items, me.id),
        (r) =>
          "Đã gửi bếp " +
          items.length +
          " món" +
          (r.free.length ? " · tự động tặng " + U.sum(r.free, (f) => f.qty) + " " + r.free[0].name : "") +
          (r.pendingBargains ? " · đã gửi Chủ quán duyệt giá ép nguyên con" : "")
      );
    };
    pending.timer = setTimeout(commitSend, 4000);
    App.toast("Đang gửi " + U.sum(items, (i) => i.qty) + " món xuống bếp", { type: "info", ms: 4000, undo: () => { clearTimeout(pending.timer); S().pendingSend = null; S().cart = items; S().view = "order"; App.render(); } });
    App.render();
  }

  function renderPaidSummaryHtml(sale) {
    const need = Math.max(0, (sale.grand || 0) - (sale.deposit || 0));
    const shares = Array.isArray(sale.tipShares) && sale.tipShares.length
      ? sale.tipShares
      : sale.tip > 0 && sale.tipStaffId
      ? [{ staffId: sale.tipStaffId, amount: sale.tip }]
      : [];
    return (
      '<div class="col gap-12">' +
        '<div class="banner banner-success">' +
          I("circle-check") +
          '<div><b style="font-size:16px">THANH TOÁN THÀNH CÔNG — KHÔNG CẦN KIỂM TRA LẠI</b><br>Hệ thống đã tự động định danh mã <b>' + esc(sale.payCode || sale.tableCode) + "</b> và khóa sổ hóa đơn bàn <b>" + esc(sale.tableCode) + "</b>.</div>" +
        "</div>" +
        '<div class="card card-pad">' +
          '<div class="tot-row"><span>Bàn / Mã định danh QR</span><span class="strong">' + esc(sale.tableCode) + " · " + esc(sale.payCode || "--") + "</span></div>" +
          '<div class="tot-row"><span>Số tiền cần thanh toán</span><span class="num">' + U.money(need) + "</span></div>" +
          '<div class="tot-row"><span>Số tiền thực nhận</span><span class="num strong text-primary">' + U.money(sale.received || need) + "</span></div>" +
          (sale.change > 0 ? '<div class="tot-row"><span>Tiền thối lại khách</span><span class="num">' + U.money(sale.change) + "</span></div>" : "") +
          (sale.tip > 0
            ? '<div class="tot-row text-success"><span>Tiền Tip tự động xác định (' + esc(Engine.TIP_MODES[sale.tipMode] || "Cá nhân") + ')</span><span class="num strong">+' + U.money(sale.tip) + "</span></div>" +
              '<div class="mt-8" style="padding:8px 10px;background:var(--surface-2);border-radius:8px">' +
                '<div class="small strong mb-4">Phân bổ Tiền Tip vào lương / két trả mặt:</div>' +
                shares.map((sh) => '<div class="row between small"><span>' + esc(Engine.staffName(sh.staffId)) + '</span><b class="text-success num">+' + U.money(sh.amount) + "</b></div>").join("") +
              "</div>"
            : "") +
        "</div>" +
      "</div>"
    );
  }

  function showPaymentSuccessModal(sale) {
    App.modal({
      title: "Đã thanh toán bàn " + sale.tableCode,
      sub: "Mã giao dịch: " + (sale.payCode || sale.id) + " · Lúc " + U.time(sale.closedAt || Date.now()),
      sheet: true,
      body: () => renderPaidSummaryHtml(sale),
      foot: () => UI.btn("Hoàn tất · Về sơ đồ bàn", { act: "waiter.closeSuccessPay", kind: "primary", size: "lg", block: true, icon: "check" }),
    });
  }

  /* ---------- Hanh dong ---------- */
  App.actions({
    "waiter.tab": (d) => { const st = S(); st.tab = d.value; if (d.value === "tables" && st.view !== "order") st.view = st.tableId && Engine.ticketByTable(st.tableId) && st.view === "table" ? "table" : "floor"; App.render(); },
    "waiter.area": (d) => { S().area = d.value; App.render(); },
    "waiter.mine": (d) => { S().mine = d.value; App.render(); },
    "waiter.back": () => { S().view = "floor"; App.render(); },
    "waiter.table": async (d) => {
      const st = S();
      const me = App.me();
      const table = Engine.table(d.table);
      const status = Engine.tableStatus(table);
      st.tab = "tables";
      if (me && me.role === "waiter" && !Engine.activeAtt(me.id)) {
        App.toast("Bạn chưa chấm công vào ca. Vui lòng chấm công trước khi nhận bàn.", "warning");
        checkinModal(me);
        return;
      }
      if (status.ticket) { st.tableId = table.id; st.view = "table"; App.render(); return; }
      if (status.status === "dirty") {
        const ok = await App.confirm({ title: "Bàn " + table.code + " đang chờ dọn", message: "Xác nhận bàn đã dọn sạch và mở bàn cho khách mới?", confirm: "Đã dọn, mở bàn" });
        if (!ok) return;
        App.commit(() => Engine.markClean(table.id));
      }
      st.guests = status.booking ? status.booking.guests : Math.min(4, table.seats);
      App.modal({
        title: "Mở bàn " + table.code,
        sub: table.seats + " chỗ · " + Engine.area(table.areaId).name,
        sheet: true,
        body: () => (status.booking ? UI.banner("info", "calendar-clock", "<b>Khách đặt trước: " + esc(status.booking.name) + "</b> · " + status.booking.guests + " khách · " + status.booking.time + (status.booking.depositPaid ? " · đã cọc " + U.money(status.booking.deposit) : " · chưa cọc") + (status.booking.note ? "<br>" + esc(status.booking.note) : "")) : "") +
          UI.field("Số khách", '<div class="row"><div class="stepper"><button data-act="waiter.guests" data-d="-1">' + I("minus") + "</button><span>" + st.guests + '</span><button data-act="waiter.guests" data-d="1">' + I("plus") + "</button></div>" + [2, 4, 6, 8, 10].map((n) => '<button class="chip ' + (st.guests === n ? "active" : "") + '" data-act="waiter.guestsSet" data-n="' + n + '">' + n + "</button>").join("") + "</div>"),
        foot: () => UI.btn("Hủy bỏ", { act: "app.closeModal" }) + UI.btn(status.booking ? "Nhận khách và gọi món" : "Mở bàn và gọi món", { act: "waiter.open", kind: "primary", data: { table: table.id, booking: status.booking ? status.booking.id : "" } }),
      });
    },
    "waiter.guests": (d) => { const st = S(); st.guests = Math.max(1, st.guests + Number(d.d)); App.render(); },
    "waiter.guestsSet": (d) => { S().guests = Number(d.n); App.render(); },
    "waiter.open": (d) => {
      const st = S();
      const me = App.me();
      if (me && me.role === "waiter" && !Engine.activeAtt(me.id)) {
        App.closeModal(true);
        App.toast("Bạn chưa chấm công vào ca. Vui lòng chấm công trước khi mở bàn.", "warning");
        checkinModal(me);
        return;
      }
      const ok = App.commit(() => Engine.openTable(d.table, { guests: st.guests, waiterId: me.id, bookingId: d.booking || null }), "Đã mở bàn " + Engine.table(d.table).code);
      if (!ok) return;
      App.closeModal(true);
      st.tableId = d.table;
      st.view = "order";
      st.cart = [];
      st.q = "";
      App.render();
    },
    "waiter.order": () => {
      const me = App.me();
      if (me && me.role === "waiter" && !Engine.activeAtt(me.id)) {
        App.toast("Bạn chưa chấm công vào ca. Vui lòng chấm công trước khi gọi món.", "warning");
        checkinModal(me);
        return;
      }
      const st = S();
      st.view = "order";
      st.q = "";
      App.render();
    },
    "waiter.cancelOrder": async () => {
      const st = S();
      if (st.cart.length) {
        const ok = await App.confirm({ title: "Bỏ danh sách đang chọn?", message: "Có " + st.cart.length + " món chưa gửi bếp.", confirm: "Bỏ danh sách", danger: true });
        if (!ok) return;
      }
      st.cart = [];
      st.view = "table";
      App.render();
    },
    "waiter.cat": (d) => { S().cat = d.value; App.render(); },
    "waiter.stockModal": () => stockModal(),
    "waiter.add": (d) => {
      const m = Engine.menu(d.menu);
      const av = Engine.menuAvailability(m.id);
      if (!av.available) return App.toast(m.name + ": " + av.label, "error");
      if (m.kind === "seafood" || m.kind === "beer") return optionsModal(m.id);
      const st = S();
      const inCartQty = U.sum(st.cart.filter((c) => c.menuId === m.id), (c) => c.qty);
      if (inCartQty + 1 > av.maxPortions) {
        return App.toast("Chỉ còn đủ nguyên liệu làm tối đa " + av.maxPortions + " " + (m.unit || "phần") + " " + m.name, "error");
      }
      const ex = st.cart.find((c) => c.menuId === m.id && !c.note && c.styleId === ((m.styles && m.styles[0]) || null));
      if (ex) ex.qty++;
      else st.cart.push({ menuId: m.id, qty: 1, styleId: (m.styles && m.styles[0]) || null, note: "" });
      App.render();
    },
    "waiter.options": (d) => optionsModal(d.menu),
    "waiter.optStyle": (d) => { S()._opt.styleId = d.id; App.render(); },
    "waiter.optQty": (d) => {
      const o = S()._opt;
      const av = Engine.menuAvailability(o.menuId);
      o.qty = Math.min(Math.max(1, av.maxPortions || 999), Math.max(1, o.qty + Number(d.d)));
      App.render();
    },
    "waiter.optSetQty": (d) => {
      const o = S()._opt;
      const av = Engine.menuAvailability(o.menuId);
      o.qty = Math.min(Math.max(1, av.maxPortions || 999), Math.max(1, Number(d.q) || 1));
      App.render();
    },
    "waiter.optFish": (d) => {
      const o = S()._opt;
      o.fishIds = Array.isArray(o.fishIds) ? o.fishIds : [];
      if (o.multiFish) {
        const idx = o.fishIds.indexOf(d.id);
        if (idx >= 0) o.fishIds.splice(idx, 1);
        else o.fishIds.push(d.id);
      } else {
        o.fishIds = o.fishIds.length === 1 && o.fishIds[0] === d.id ? [] : [d.id];
      }
      if (o.bargainOn) {
        const m = Engine.menu(o.menuId);
        const av = Engine.menuAvailability(m.id);
        const picked = (av.fishList || []).filter((f) => o.fishIds.includes(f.id));
        const totalKg = Math.round(U.sum(picked, (f) => f.kg) * 100) / 100;
        const bg = Engine.evaluateSeafoodBargain(m, totalKg, null, (App.me() || {}).role || "waiter");
        o.dealAmount = bg.quickDeals[0] || bg.listAmount;
      }
      App.render();
    },
    "waiter.optMultiFishToggle": () => {
      const o = S()._opt;
      o.multiFish = !o.multiFish;
      if (!o.multiFish && Array.isArray(o.fishIds) && o.fishIds.length > 1) {
        o.fishIds = [o.fishIds[o.fishIds.length - 1]];
      }
      App.render();
    },
    "waiter.optSaleMode": (d) => {
      const o = S()._opt;
      o.saleMode = d.mode === "gram" ? "gram" : "whole";
      if (o.saleMode === "gram") o.bargainOn = false;
      App.render();
    },
    "waiter.optSourceFish": (d) => {
      S()._opt.sourceFishId = d.id;
      App.render();
    },
    "waiter.optGramStep": (d) => {
      const o = S()._opt;
      const av = Engine.menuAvailability(o.menuId);
      const maxGram = Math.max(200, Math.round((Number(av.totalKg) || 10) * 1000));
      const minGram = Number(Engine.seafoodPolicy().minGram) || 200;
      o.gram = Math.min(maxGram, Math.max(minGram, (Number(o.gram) || 500) + Number(d.d)));
      o.kg = Math.round((o.gram / 1000) * 100) / 100;
      App.render();
    },
    "waiter.optGramSet": (d) => {
      const o = S()._opt;
      o.gram = Number(d.v) || 500;
      o.kg = Math.round((o.gram / 1000) * 100) / 100;
      App.render();
    },
    "waiter.optBargainToggle": () => {
      const o = S()._opt;
      o.bargainOn = !o.bargainOn;
      if (o.bargainOn) {
        const m = Engine.menu(o.menuId);
        const av = Engine.menuAvailability(m.id);
        const picked = (av.fishList || []).filter((f) => (o.fishIds || []).includes(f.id));
        const totalKg = Math.round(U.sum(picked, (f) => f.kg) * 100) / 100;
        const bg = Engine.evaluateSeafoodBargain(m, totalKg, null, (App.me() || {}).role || "waiter");
        if (!o.dealAmount || o.dealAmount >= bg.listAmount) {
          o.dealAmount = bg.quickDeals[0] || bg.listAmount;
        }
      }
      App.render();
    },
    "waiter.optDealSet": (d) => {
      S()._opt.dealAmount = Number(d.v) || 0;
      App.render();
    },
    "waiter.optDealStep": (d) => {
      const o = S()._opt;
      const m = Engine.menu(o.menuId);
      const av = Engine.menuAvailability(m.id);
      const picked = (av.fishList || []).filter((f) => (o.fishIds || []).includes(f.id));
      const totalKg = Math.round(U.sum(picked, (f) => f.kg) * 100) / 100;
      const bg = Engine.evaluateSeafoodBargain(m, totalKg, o.dealAmount, (App.me() || {}).role || "waiter");
      o.dealAmount = Math.min(bg.listAmount, Math.max(bg.costAmount, (Number(o.dealAmount) || bg.listAmount) + Number(d.d)));
      App.render();
    },
    "waiter.optKgStep": (d) => {
      const o = S()._opt;
      const av = Engine.menuAvailability(o.menuId);
      o.kg = Math.min(Math.max(0.2, av.totalKg || 10), Math.max(0.2, Math.round(((Number(o.kg) || 0.5) + Number(d.d)) * 10) / 10));
      o.gram = Math.round(o.kg * 1000);
      App.render();
    },
    "waiter.optKgSet": (d) => {
      S()._opt.kg = Number(d.v) || 0.5;
      S()._opt.gram = Math.round(S()._opt.kg * 1000);
      App.render();
    },
    "waiter.optCount": (d) => { const o = S()._opt; o.count = Math.max(1, o.count + Number(d.d)); App.render(); },
    "waiter.optQuick": (d) => { const o = S()._opt; o.note = o.note ? o.note + ", " + d.v.toLowerCase() : d.v; App.render(); },
    "waiter.optSave": () => {
      const st = S();
      const o = st._opt;
      const m = Engine.menu(o.menuId);
      let item;
      if (m.kind === "seafood") {
        const isCountSea = Engine.isCountableSeafood(m);
        if (isCountSea && o.saleMode === "whole") {
          const allFish = Engine.tankFishList(m.id);
          const picked = allFish.filter((f) => (o.fishIds || []).includes(f.id));
          if (!picked.length) return App.toast("Vui lòng chọn ít nhất 1 con cá trong bể.", "error");
          const kg = Math.round(U.sum(picked, (f) => f.kg) * 100) / 100;
          const role = (App.me() || {}).role || "waiter";
          let dealAmount = null;
          let bargain = null;
          if (o.bargainOn && o.dealAmount) {
            const bg = Engine.evaluateSeafoodBargain(m, kg, o.dealAmount, role);
            if (bg.belowCost && Engine.seafoodPolicy().blockBelowCost && role !== "owner") {
              return App.toast("Giá khách trả thấp hơn giá vốn nhập bể (" + U.money(bg.costAmount) + "). Không thể chốt lỗ.", "error");
            }
            if (bg.discount > 0) {
              dealAmount = bg.dealAmount;
              bargain = {
                listAmount: bg.listAmount,
                dealAmount: bg.dealAmount,
                discount: bg.discount,
                pct: bg.pct,
                note: o.bargainNote || "Khách mua nguyên con ép giá",
              };
            }
          }
          item = {
            menuId: o.menuId,
            qty: 1,
            saleMode: "whole",
            count: picked.length,
            kg,
            fishIds: picked.map((f) => f.id),
            fishSummary: picked.map((f) => f.code + " (" + U.num(f.kg, 2) + " kg)").join(", ") + (bargain ? " · Chốt " + U.money(dealAmount) + " (-" + U.moneyShort(bargain.discount) + ")" : ""),
            dealAmount,
            bargain,
            styleId: o.styleId,
            note: o.note || "",
          };
        } else {
          // Ban theo gram / cat khuc
          const gram = Math.max(Number(Engine.seafoodPolicy().minGram) || 200, Math.round(Number(o.gram) || Math.round((Number(o.kg) || 0.5) * 1000)));
          const kg = Math.round((gram / 1000) * 100) / 100;
          const allFish = isCountSea ? Engine.tankFishList(m.id) : [];
          const srcFish = allFish.find((f) => f.id === o.sourceFishId) || allFish[0] || null;
          item = {
            menuId: o.menuId,
            qty: 1,
            saleMode: "gram",
            gram,
            count: 0,
            kg,
            sourceFishId: srcFish ? srcFish.id : null,
            fishSummary: gram + "g (" + U.num(kg, 2) + " kg" + (srcFish ? " · cắt từ " + srcFish.code : "") + ")",
            styleId: o.styleId,
            note: o.note || "",
          };
        }
      } else {
        item = { menuId: o.menuId, qty: o.qty, styleId: o.styleId, note: o.note || "" };
      }
      if (o.index !== undefined) st.cart[o.index] = item;
      else st.cart.push(item);
      App.closeModal();
    },
    "waiter.optRemove": () => { const st = S(); st.cart.splice(st._opt.index, 1); App.closeModal(); },
    "waiter.cart": () => cartModal(),
    "waiter.editCart": (d) => { const st = S(); optionsModal(st.cart[Number(d.i)].menuId, Number(d.i)); },
    "waiter.cartQty": (d) => {
      const st = S();
      const c = st.cart[Number(d.i)];
      if (!c) return;
      c.qty += Number(d.d);
      if (c.qty <= 0) st.cart.splice(Number(d.i), 1);
      if (!st.cart.length) App.closeModal(true);
      else App.render();
    },
    "waiter.send": () => doSend(),
    "waiter.served": (d) => { const st = S(); const tk = Engine.ticketByTable(st.tableId); App.commit(() => Engine.markServed(tk.id, d.item)); },
    "waiter.more": () => {
      const st = S();
      const me = App.me();
      const tk = Engine.ticketByTable(st.tableId);
      const hasBeer = tk && tk.items.some((i) => !i.isFree && i.status !== "void" && (Engine.menu(i.menuId) || {}).kind === "beer");
      const row = (icon, title, desc, act, dis) => '<button class="list-row" data-act="' + act + '"' + (dis ? " disabled style='opacity:.45'" : "") + ">" + I(icon) + '<div class="grow"><b>' + title + '</b><div class="meta">' + desc + "</div></div>" + I("chevron-right", "ic-sm") + "</button>";
      App.modal({
        title: "Thao tác bàn " + Engine.table(st.tableId).code,
        sheet: true,
        body: () => '<div class="card list">' +
          row("beer", "Trả lại bia dư (lon / chai chưa khui)", "Khách gọi nguyên thùng/két không uống hết, trừ lại trực tiếp trên bill", "waiter.returnBeerModal", !hasBeer) +
          row("qr-code", "Thanh toán nhanh tại bàn", "Hiện mã VietQR định danh " + (tk ? Engine.ensurePayCode(tk) : "") + " hoặc thu tiền mặt", "waiter.payModal", !tk || !Engine.can(me.role, "collectPayment")) +
          row("user-pen", "Đổi người phụ trách bàn", "Bàn giao hoặc nhận đứng bàn " + Engine.table(st.tableId).code, "waiter.assignWaiterModal", !tk) +
          row("receipt-text", "Yêu cầu in tạm tính", "Báo thu ngân in phiếu tạm tính cho khách kiểm tra", "waiter.prebill", tk.status === "locked" || !Engine.can(me.role, "requestPrebill")) +
          row("wine", "Tạo thẻ gửi rượu", "Khách gửi lại chai rượu chưa dùng hết", "waiter.bottle", !Engine.can(me.role, "createBottleKeep")) +
          row("arrow-right-left", "Chuyển bàn", "Chuyển toàn bộ bill sang bàn trống khác", "waiter.transfer", !Engine.can(me.role, "transferTable")) +
          row("ban", "Hủy món đã gửi", "Gửi yêu cầu hủy, cần Chủ quán duyệt", "waiter.void", tk.status === "locked") +
          "</div>",
      });
    },
    "waiter.returnBeerModal": (d) => {
      const st = S();
      const tk = Engine.ticketByTable(st.tableId);
      if (!tk) return;
      const beerIds = Array.from(
        new Set(
          tk.items
            .filter((i) => !i.isFree && i.status !== "void" && (Engine.menu(i.menuId) || {}).kind === "beer")
            .map((i) => i.menuId)
        )
      );
      if (!beerIds.length) return App.toast("Bàn chưa có bia đang tính tiền để trả lại.", "error");
      const pickMenuId = (d && d.menu && beerIds.includes(d.menu)) ? d.menu : beerIds[0];
      const sum = Engine.beerSummaryOnTicket(tk, pickMenuId);
      const defRet = Math.min(sum.paidQty, 4);
      st._retBeer = {
        ticketId: tk.id,
        itemId: (d && d.item) || null,
        menuId: pickMenuId,
        mode: "return", // 'return' (nhap so lon tra lai) | 'consumed' (nhap so lon thuc uong)
        returnQty: defRet,
        consumedQty: Math.max(0, sum.paidQty - defRet),
      };
      App.modal({
        title: "Trả bia dư chưa khui · Bàn " + Engine.table(tk.tableId).code,
        sub: "Khách đem nguyên thùng/két không uống hết -> Trừ trực tiếp số lon/chai trả lại trên bill & hoàn kho",
        sheet: true,
        body: () => {
          const rb = S()._retBeer;
          const curTk = Engine.ticket(rb.ticketId) || tk;
          const curSum = Engine.beerSummaryOnTicket(curTk, rb.menuId);
          if (!curSum || curSum.paidQty <= 0) return UI.empty("beer", "Đã trả hết bia của loại này");
          const u = curSum.unit;
          const cs = curSum.caseSize;
          const maxRet = curSum.paidQty;
          const retQ = rb.mode === "consumed"
            ? Math.max(0, Math.min(maxRet, maxRet - Math.max(0, Math.round(Number(rb.consumedQty) || 0))))
            : Math.max(1, Math.min(maxRet, Math.round(Number(rb.returnQty) || 1)));
          const consQ = maxRet - retQ;
          const promo = curSum.promo;
          const freeAfter = promo ? Math.floor(consQ / promo.buyQty) * promo.freeQty : curSum.freeQty;
          const quickRets = [1, 2, 3, 4, 5, 6, 8, 10, Math.round(cs / 2), cs].filter((q, idx, arr) => q > 0 && q <= maxRet && arr.indexOf(q) === idx);

          return (
            '<div class="col gap-12">' +
              (beerIds.length > 1
                ? UI.field(
                    "Chọn loại bia khách trả lại",
                    '<div class="chips">' +
                      beerIds.map((mid) => {
                        const bs = Engine.beerSummaryOnTicket(curTk, mid);
                        return '<button type="button" class="chip ' + (rb.menuId === mid ? "active" : "") + '" data-act="waiter.retBeerMenu" data-menu="' + mid + '">' + esc(bs.menuName) + " (đang tính " + bs.paidQty + " " + esc(bs.unit) + ")</button>";
                      }).join("") +
                    "</div>"
                  )
                : "") +
              '<div class="card card-pad" style="background:var(--surface-2)">' +
                '<div class="row between"><span>Đã đem ra bàn:</span><b>' + esc(Engine.formatBeerCaseQty(curSum.broughtOutQty, cs, u)) + "</b></div>" +
                (curSum.returnedQty > 0 ? '<div class="row between small muted mt-4"><span>Đã trả trước đó:</span><span>' + curSum.returnedQty + " " + esc(u) + "</span></div>" : "") +
                '<div class="row between mt-4"><span>Đang ghi trên bill:</span><b class="text-primary num">' + curSum.paidQty + " " + esc(u) + " (" + U.money(curSum.paidQty * curSum.price) + ")</b></div>" +
              "</div>" +
              '<div class="seg" style="display:grid;grid-template-columns:1fr 1fr;gap:6px">' +
                '<button type="button" class="' + (rb.mode === "return" ? "active" : "") + '" data-act="waiter.retBeerMode" data-mode="return">Nhập số ' + esc(u) + " trả lại</button>" +
                '<button type="button" class="' + (rb.mode === "consumed" ? "active" : "") + '" data-act="waiter.retBeerMode" data-mode="consumed">Nhập số ' + esc(u) + " đã uống</button>" +
              "</div>" +
              (rb.mode === "return"
                ? UI.field(
                    "Số " + u + " chưa khui khách trả lại (tối đa " + maxRet + " " + u + ")",
                    '<div class="chips mb-8" style="flex-wrap:wrap">' +
                      quickRets.map((q) => '<button type="button" class="chip ' + (retQ === q ? "active" : "") + '" data-act="waiter.retBeerQuick" data-q="' + q + '">Trả ' + q + " " + esc(u) + (q === Math.round(cs / 2) ? " (nửa thùng)" : q === cs ? " (1 thùng)" : "") + "</button>").join("") +
                    "</div>" +
                    '<div class="row gap-8">' +
                      '<div class="stepper"><button type="button" data-act="waiter.retBeerStep" data-d="-1">' + I("minus") + '</button><span class="num">' + retQ + " " + esc(u) + '</span><button type="button" data-act="waiter.retBeerStep" data-d="1">' + I("plus") + "</button></div>" +
                      '<div class="grow">' + UI.input({ type: "number", min: 1, max: maxRet, model: "waiter._retBeer.returnQty", live: true, value: retQ }) + "</div>" +
                    "</div>"
                  )
                : UI.field(
                    "Số " + u + " khách thực tế đã uống (đếm vỏ tại bàn)",
                    '<div class="row gap-8">' +
                      '<div class="stepper"><button type="button" data-act="waiter.retBeerStep" data-d="-1">' + I("minus") + '</button><span class="num">' + consQ + " " + esc(u) + '</span><button type="button" data-act="waiter.retBeerStep" data-d="1">' + I("plus") + "</button></div>" +
                      '<div class="grow">' + UI.input({ type: "number", min: 0, max: maxRet - 1, model: "waiter._retBeer.consumedQty", live: true, value: consQ }) + "</div>" +
                    "</div>"
                  )) +
              '<div class="banner banner-success">' +
                I("circle-check") +
                "<div><b>Sau khi trừ " + retQ + " " + esc(u) + " trả lại:</b><br>" +
                "Tính tiền thực uống: <b>" + consQ + " " + esc(u) + " (" + U.money(consQ * curSum.price) + ")</b> · Giảm trừ: <b>-" + U.money(retQ * curSum.price) + "</b>" +
                (curSum.freeQty !== freeAfter ? "<br>Khuyến mãi tặng kèm tự động điều chỉnh: <b>" + curSum.freeQty + " &rarr; " + freeAfter + " " + esc(u) + "</b>" : "") +
                "</div>" +
              "</div>" +
            "</div>"
          );
        },
        foot: () =>
          UI.btn("Đóng", { act: "app.closeModal" }) +
          UI.btn("Xác nhận trả bia dư", { act: "waiter.retBeerSubmit", kind: "primary", size: "lg", icon: "check" }),
      });
    },
    "waiter.retBeerMenu": (d) => {
      const rb = S()._retBeer;
      if (!rb) return;
      rb.menuId = d.menu;
      const sum = Engine.beerSummaryOnTicket(Engine.ticket(rb.ticketId), d.menu);
      rb.returnQty = Math.min(sum ? sum.paidQty : 1, 4);
      rb.consumedQty = Math.max(0, (sum ? sum.paidQty : 1) - rb.returnQty);
      App.render();
    },
    "waiter.retBeerMode": (d) => {
      const rb = S()._retBeer;
      if (!rb) return;
      const sum = Engine.beerSummaryOnTicket(Engine.ticket(rb.ticketId), rb.menuId);
      const maxRet = sum ? sum.paidQty : 1;
      if (d.mode === "consumed" && rb.mode !== "consumed") {
        rb.consumedQty = Math.max(0, maxRet - (Number(rb.returnQty) || 1));
      } else if (d.mode === "return" && rb.mode !== "return") {
        rb.returnQty = Math.max(1, maxRet - (Number(rb.consumedQty) || 0));
      }
      rb.mode = d.mode;
      App.render();
    },
    "waiter.retBeerQuick": (d) => {
      const rb = S()._retBeer;
      if (!rb) return;
      rb.mode = "return";
      rb.returnQty = Number(d.q) || 1;
      App.render();
    },
    "waiter.retBeerStep": (d) => {
      const rb = S()._retBeer;
      if (!rb) return;
      const sum = Engine.beerSummaryOnTicket(Engine.ticket(rb.ticketId), rb.menuId);
      const maxRet = sum ? sum.paidQty : 1;
      if (rb.mode === "consumed") {
        rb.consumedQty = Math.max(0, Math.min(maxRet - 1, (Number(rb.consumedQty) || 0) + Number(d.d)));
      } else {
        rb.returnQty = Math.max(1, Math.min(maxRet, (Number(rb.returnQty) || 1) + Number(d.d)));
      }
      App.render();
    },
    "waiter.retBeerSubmit": () => {
      const rb = S()._retBeer;
      if (!rb) return;
      const res = App.commit(
        () =>
          Engine.returnUnusedBeer(rb.ticketId, {
            itemId: rb.itemId,
            menuId: rb.menuId,
            returnQty: rb.mode === "return" ? Number(rb.returnQty) : null,
            consumedQty: rb.mode === "consumed" ? Number(rb.consumedQty) : null,
            by: App.me().id,
          }),
        (r) =>
          "Đã nhận trả lại " +
          r.returned +
          " " +
          r.unit +
          " " +
          r.menuName +
          " dư · Tính tiền " +
          r.afterPaid +
          " " +
          r.unit +
          (r.freeRevoked > 0 ? " (thu hồi " + r.freeRevoked + " " + r.unit + " KM)" : "")
      );
      if (!res) return;
      App.closeModal(true);
      App.render();
    },
    "waiter.assignWaiterModal": () => {
      const st = S();
      const tk = Engine.ticketByTable(st.tableId);
      if (!tk) return;
      const waiters = Store.data.staff.filter((s) => s.role === "waiter" && s.active);
      App.modal({
        title: "Phân công phục vụ bàn " + Engine.table(st.tableId).code,
        sub: "Nhân viên đứng bàn sẽ nhận thông báo món và tiền Tip cá nhân của bàn này",
        sheet: true,
        body: () => '<div class="card list">' +
          waiters.map((w) => {
            const isCur = tk.waiterId === w.id;
            const assignedHere = Engine.isMyTable(w.id, tk.tableId);
            return '<button type="button" class="list-row" data-act="waiter.assignWaiterTo" data-staff="' + w.id + '">' +
              UI.avatar(w.name) +
              '<div class="grow"><div class="strong">' + esc(w.name) + " " + (isCur ? UI.badge("Đang đứng bàn", "success") : "") + (assignedHere && !isCur ? UI.badge("Phụ trách khu này", "info") : "") + '</div>' +
              '<div class="meta">Bàn phân công: ' + esc(((w.assignedTables || []).map((tid) => (Engine.table(tid) || {}).code).filter(Boolean).join(", ")) || "Tất cả") + "</div></div>" +
              I(isCur ? "check" : "chevron-right", "ic-sm") +
            "</button>";
          }).join("") +
        "</div>",
      });
    },
    "waiter.assignWaiterTo": (d) => {
      const st = S();
      const tk = Engine.ticketByTable(st.tableId);
      if (!tk) return;
      App.commit(() => Engine.assignWaiterToTable(tk.tableId, d.staff, App.me().id), "Đã giao bàn " + Engine.table(tk.tableId).code + " cho " + Engine.staffName(d.staff));
      App.closeModal(true);
    },
    "waiter.payModal": () => {
      const st = S();
      const me = App.me();
      const tk = Engine.ticketByTable(st.tableId);
      if (!tk) return;
      const tot = Engine.totals(tk);
      if (tot.pendingWeigh) return App.toast("Bàn còn món hải sản chưa cân.", "error");
      const payCode = Engine.ensurePayCode(tk);
      const need = Math.max(0, tot.due !== undefined ? tot.due : tot.grand - tot.deposit - (tot.paid || 0));
      const canCash = Engine.can(me.role, "collectCash") !== false;
      const defaultTipMode = tk.preferredTipMode || (Store.config.payroll && Store.config.payroll.tipPolicy) || "personal";
      st._pay = {
        ticketId: tk.id,
        tableId: tk.tableId,
        method: "qr",
        tipMode: defaultTipMode,
        tipStaffId: tk.waiterId || me.id,
        whAmount: need,
        whContent: payCode,
        cashReceived: need,
        cashOverAsTip: false,
      };
      App.modal({
        title: "Thanh toán tại bàn " + Engine.table(tk.tableId).code,
        sub: "Mã định danh QR duy nhất: " + payCode + " · Cần thu: " + U.money(need),
        size: "lg",
        sheet: true,
        body: () => {
          const p = st._pay;
          const curTk = Engine.ticket(p.ticketId);
          if (!curTk || curTk.status === "paid") {
            const paidSale = Store.data.sales.slice().reverse().find((s) => s.ticketId === p.ticketId);
            if (paidSale) return renderPaidSummaryHtml(paidSale);
            return UI.banner("success", "circle-check", "Hóa đơn đã được thanh toán thành công.");
          }
          const curTot = Engine.totals(curTk);
          const curNeed = Math.max(0, curTot.due !== undefined ? curTot.due : curTot.grand - curTot.deposit - (curTot.paid || 0));
          const pendingAps = Engine.pendingTicketApprovals ? Engine.pendingTicketApprovals(curTk.id) : [];
          const simOver = Math.max(0, (Number(p.whAmount) || 0) - curNeed);
          const simShares = simOver > 0 ? Engine.computeTipShares(curTk, simOver, p.tipMode, p.tipStaffId) : [];
          const cashOver = Math.max(0, (Number(p.cashReceived) || 0) - curNeed);
          const cashTip = p.cashOverAsTip ? cashOver : 0;
          const cashChange = Math.max(0, cashOver - cashTip);
          const cashShares = cashTip > 0 ? Engine.computeTipShares(curTk, cashTip, p.tipMode, p.tipStaffId) : [];

          const partialBanner = curTot.paid > 0
            ? '<div class="banner banner-warning mt-8">' +
                I("coins") +
                '<div><b>Đã thu 1 phần: ' + U.money(curTot.paid) + '</b> (' + (curTk.payments || []).length + ' lần giao dịch) &rarr; <b>Còn phải thu thêm: ' + U.money(curNeed) + '</b>. Mã VietQR bên dưới đã tự động cập nhật số tiền còn lại (khách có thể chuyển khoản tiếp hoặc trả nốt bằng tiền mặt).</div>' +
              "</div>"
            : "";

          const pendingApBanner = pendingAps.length > 0
            ? '<div class="banner banner-danger mt-8">' +
                I("triangle-alert") +
                '<div><b>Chú ý:</b> Bàn đang có <b>' + pendingAps.length + ' yêu cầu chờ duyệt</b> (' + pendingAps.map((a) => esc(a.title)).join("; ") + '). Nên chờ Quản lý ca / Chủ quán duyệt xong trước khi chốt thanh toán.</div>' +
              "</div>"
            : "";

          const dutyWaiters = Engine.onDutyWaiters ? Engine.onDutyWaiters() : [];
          const poolLabel = dutyWaiters.length
            ? "Chia đều toàn ca phục vụ (" + dutyWaiters.length + " người trong ca)"
            : "Chia đều toàn ca phục vụ (0 người trong ca → về người đứng bàn)";
          const tipModeSelector =
            '<div class="card card-pad mt-8" style="background:var(--surface-2)">' +
              '<div class="small strong mb-4">' + I("hand-coins", "ic-sm") + " Quy chế xác định Tiền Tip (khi khách chuyển dư trên mức thanh toán):</div>" +
              '<div class="chips chips-wrap">' +
                '<button type="button" class="chip ' + (p.tipMode === "personal" ? "active" : "") + '" data-act="waiter.payTipMode" data-mode="personal">Nhân viên đứng bàn hưởng 100% (' + esc(Engine.staffName(p.tipStaffId)) + ")</button>" +
                '<button type="button" class="chip ' + (p.tipMode === "pool" ? "active" : "") + '" data-act="waiter.payTipMode" data-mode="pool">' + esc(poolLabel) + "</button>" +
                '<button type="button" class="chip ' + (p.tipMode === "area" ? "active" : "") + '" data-act="waiter.payTipMode" data-mode="area">Chia theo tổ khu vực bàn</button>' +
              "</div>" +
            "</div>";

          const qrBody =
            '<div class="col gap-12 mt-8">' +
              UI.qrBox({
                amount: curNeed,
                memo: payCode,
                size: 176,
                caption: "Đưa khách quét VietQR — Nội dung cố định, số tiền nhập tự do (nhận Tip)",
              }) +
              '<div class="banner banner-info">' +
                I("zap") +
                '<div><b>Số tiền mở tự do + Nội dung cố định (' + esc(payCode) + '):</b> Khi khách quét mã trên App ngân hàng, nội dung <b>' + esc(payCode) + '</b> được điền cố định còn ô số tiền để mở tự do. Khách nhập <b>&gt;= ' + U.money(curNeed) + '</b> (ví dụ chuyển thêm Tiền Tip), hệ thống tự động xác nhận hoàn tất bill và cộng phần dư vào Tiền Tip!</div>' +
              "</div>" +
              (!App.isDemo()
                ? '<div class="row gap-8 mt-4">' +
                    UI.btn("Xác nhận khách đã chuyển khoản đủ (" + U.money(curNeed) + ")", { act: "waiter.confirmManualPay", kind: "primary", size: "lg", icon: "check", block: true }) +
                  "</div>"
                : "") +
              '<div class="card card-pad demo-only" style="border:1.5px dashed var(--primary);background:var(--surface-2)">' +
                '<div class="row between wrap gap-8 mb-8">' +
                  '<div><div class="strong">' + I("webhook", "ic-sm") + ' Mô phỏng Cổng thanh toán báo Biến động số dư (API Webhook)</div><div class="small muted">Endpoint: <code>POST /api/webhooks/payment</code> · Nội dung định danh: <b>' + esc(payCode) + "</b></div></div>" +
                  UI.badge("Tự động khớp < 1 giây", "success") +
                "</div>" +
                '<div class="small strong mb-4">Chọn nhanh số tiền khách chuyển khoản (Cần thu: ' + U.money(curNeed) + '):</div>' +
                '<div class="chips mb-8">' +
                  (curNeed >= 100000 ? [Math.round(curNeed / 2 / 1000) * 1000] : []).map((halfVal) =>
                    '<button type="button" class="chip ' + (Number(p.whAmount) === halfVal ? "active" : "") + '" data-act="waiter.whPreset" data-v="' + halfVal + '">Chuyển 1 phần ' + U.money(halfVal) + "</button>"
                  ).join("") +
                  [0, 20000, 50000, 100000].map((tipAdd) => {
                    const v = curNeed + tipAdd;
                    return '<button type="button" class="chip ' + (Number(p.whAmount) === v ? "active" : "") + '" data-act="waiter.whPreset" data-v="' + v + '">' +
                      (tipAdd === 0 ? "Đúng " + U.money(v) + " (Tip 0đ)" : "Chuyển " + U.money(v) + " (+" + U.moneyShort(tipAdd) + " Tip)") +
                    "</button>";
                  }).join("") +
                "</div>" +
                '<div class="grid-2 gap-8">' +
                  UI.field("Số tiền biến động báo về (VNĐ)", UI.input({ id: "w-wh-amt", type: "number", step: 10000, model: "waiter._pay.whAmount", live: true, value: p.whAmount })) +
                  UI.field("Nội dung chuyển khoản ngân hàng", UI.input({ id: "w-wh-content", model: "waiter._pay.whContent", live: true, value: p.whContent })) +
                "</div>" +
                (simOver > 0
                  ? '<div class="banner banner-success mt-8">' +
                      I("hand-coins") +
                      '<div>Khách chuyển dư <b>+' + U.money(simOver) + '</b> trên mức cần thanh toán (' + U.money(curNeed) + ') &rarr; Hệ thống tự động ghi nhận <b>Tiền Tip ' + U.money(simOver) + '</b> (' + esc(Engine.TIP_MODES[p.tipMode]) + '): ' +
                      simShares.map((sh) => "<b>" + esc(Engine.staffName(sh.staffId)) + ": +" + U.money(sh.amount) + "</b>").join(", ") +
                      "</div></div>"
                  : (Number(p.whAmount) || 0) < curNeed
                  ? '<div class="small text-warning mt-4">Khách chuyển <b>' + U.money(Number(p.whAmount) || 0) + '</b> (&lt; ' + U.money(curNeed) + ') &rarr; Hệ thống sẽ ghi nhận <b>Đã thu 1 phần</b> và cập nhật số tiền còn thiếu <b>' + U.money(curNeed - (Number(p.whAmount) || 0)) + '</b>.</div>'
                  : '<div class="small muted mt-4">Khách chuyển đúng bằng mức cần thanh toán (' + U.money(curNeed) + ').</div>') +
                '<div class="row gap-8 mt-8 wrap">' +
                  UI.btn("Giả lập Ngân hàng báo tiền về (Auto-Chốt)", { act: "waiter.simulateWebhookPay", kind: "primary", size: "lg", icon: "zap", cls: "grow" }) +
                  UI.btn("Xác nhận thủ công", { act: "waiter.confirmManualPay", size: "lg", icon: "check" }) +
                "</div>" +
              "</div>" +
            "</div>";

          const cashBody =
            '<div class="col gap-12 mt-8">' +
              '<div class="card card-pad">' +
                '<div class="small strong mb-4">Chọn nhanh mệnh giá tiền mặt khách đưa tại bàn (Cần thu: ' + U.money(curNeed) + '):</div>' +
                '<div class="chips mb-8">' +
                  [curNeed, curNeed + 20000, curNeed + 50000, Math.ceil(curNeed / 100000) * 100000, Math.ceil(curNeed / 500000) * 500000]
                    .filter((v, i, a) => v >= curNeed && a.indexOf(v) === i)
                    .map((v) => '<button type="button" class="chip ' + (Number(p.cashReceived) === v ? "active" : "") + '" data-act="waiter.cashPreset" data-v="' + v + '">' + U.money(v) + "</button>")
                    .join("") +
                "</div>" +
                UI.field("Số tiền mặt khách đưa (VNĐ)", UI.input({ id: "w-cash-amt", type: "number", step: 10000, model: "waiter._pay.cashReceived", live: true, value: p.cashReceived })) +
                (cashOver > 0
                  ? '<div class="mt-8"><label class="check">' + UI.switchInput({ checked: p.cashOverAsTip, change: "waiter.cashTipToggle" }) + '<span><b>Khách bo luôn tiền thừa ' + U.money(cashOver) + ' làm Tiền Tip</b> (không cần thối lại)</span></label></div>'
                  : "") +
                '<div class="row between mt-12" style="padding:10px 12px;background:var(--surface-2);border-radius:8px">' +
                  (cashTip > 0
                    ? '<div><div class="small muted">Tiền Tip ghi nhận (' + esc(Engine.TIP_MODES[p.tipMode]) + ')</div><div class="strong text-success num">+' + U.money(cashTip) + " (" + cashShares.map((s) => esc(Engine.staffName(s.staffId)) + ": " + U.money(s.amount)).join(", ") + ")</div></div>"
                    : '<div><div class="small muted">Tiền thối lại khách</div><div class="strong num" style="font-size:18px">' + U.money(cashChange) + "</div></div>") +
                "</div>" +
                '<div class="mt-12">' +
                  UI.btn("Hoàn tất Thu Tiền mặt tại bàn (" + U.money(curNeed) + ")", { act: "waiter.confirmCashPay", kind: "primary", size: "lg", block: true, icon: "banknote", disabled: (Number(p.cashReceived) || 0) < curNeed }) +
                "</div>" +
              "</div>" +
            "</div>";

          return UI.totals(curTk) +
            partialBanner +
            pendingApBanner +
            tipModeSelector +
            (canCash
              ? '<div class="mt-8">' + UI.seg([{ value: "qr", label: "Quét VietQR Định danh (" + payCode + ")" }, { value: "cash", label: "Thu Tiền mặt tại bàn" }], p.method, "waiter.payMethod", { block: true }) + "</div>"
              : "") +
            (p.method === "cash" && canCash ? cashBody : qrBody);
        },
        foot: () => UI.btn("Đóng", { act: "app.closeModal" }),
      });
    },
    "waiter.payMethod": (d) => { if (S()._pay) { S()._pay.method = d.value; App.render(); } },
    "waiter.payTipMode": (d) => {
      const p = S()._pay;
      if (!p) return;
      p.tipMode = d.mode;
      const tk = Engine.ticket(p.ticketId);
      if (tk) tk.preferredTipMode = d.mode;
      App.render();
    },
    "waiter.whPreset": (d) => { if (S()._pay) { S()._pay.whAmount = Number(d.v) || 0; App.render(); } },
    "waiter.cashPreset": (d) => { if (S()._pay) { S()._pay.cashReceived = Number(d.v) || 0; App.render(); } },
    "waiter.cashTipToggle": (d) => { if (S()._pay) { S()._pay.cashOverAsTip = !!d.value; App.render(); } },
    "waiter.simulateWebhookPay": async () => {
      const st = S();
      const p = st._pay;
      if (!p) return;
      const me = App.me();
      const res = App.commit(
        () =>
          Engine.processPaymentWebhook({
            ticketId: p.ticketId,
            amount: Number(p.whAmount) || 0,
            content: p.whContent,
            tipMode: p.tipMode,
            tipStaffId: p.tipStaffId,
            by: me.id,
            gateway: (Store.config.paymentGateway && Store.config.paymentGateway.provider) || "SePay / Casso / VietQR",
          }),
        (r) =>
          r.partial
            ? "Đã ghi nhận chuyển khoản 1 phần " + U.money(r.received) + " · Còn thiếu " + U.money(r.remaining)
            : "THANH TOÁN QR THÀNH CÔNG bàn " +
              r.sale.tableCode +
              " (" +
              r.sale.payCode +
              "): " +
              U.money(r.receivedTotal || r.received) +
              (r.tip > 0 ? " · Tip +" + U.money(r.tip) : "")
      );
      if (!res) return;
      if (res.partial) {
        p.whAmount = res.remaining;
        p.cashReceived = res.remaining;
        App.render();
        return;
      }
      if (!res.sale) return;
      st.view = "floor";
      showPaymentSuccessModal(res.sale);
    },
    "waiter.confirmManualPay": () => {
      const st = S();
      const p = st._pay;
      if (!p) return;
      const me = App.me();
      const tk = Engine.ticket(p.ticketId);
      if (!tk) return;
      const tot = Engine.totals(tk);
      const need = Math.max(0, tot.due !== undefined ? tot.due : tot.grand - tot.deposit - (tot.paid || 0));
      const amt = Math.max(need, Number(p.whAmount) || need);
      const sale = App.commit(
        () =>
          Engine.pay(tk.id, {
            by: me.id,
            source: "waiter_qr",
            overAsTip: true,
            tipMode: p.tipMode,
            tipStaffId: p.tipStaffId,
            payments: [{ method: "qr", amount: amt, received: amt }],
          }),
        (s) => "Đã thu VietQR tại bàn " + s.tableCode + ": " + U.money(s.received) + (s.tip > 0 ? " (Tip +" + U.money(s.tip) + ")" : "")
      );
      if (!sale) return;
      st.view = "floor";
      showPaymentSuccessModal(sale);
    },
    "waiter.confirmCashPay": () => {
      const st = S();
      const p = st._pay;
      if (!p) return;
      const me = App.me();
      const tk = Engine.ticket(p.ticketId);
      if (!tk) return;
      const amt = Number(p.cashReceived) || 0;
      const sale = App.commit(
        () =>
          Engine.pay(tk.id, {
            by: me.id,
            source: "waiter_cash",
            cashOverAsTip: !!p.cashOverAsTip,
            tipMode: p.tipMode,
            tipStaffId: p.tipStaffId,
            payments: [{ method: "cash", amount: amt, received: amt }],
          }),
        (s) => "Đã thu tiền mặt tại bàn " + s.tableCode + ": " + U.money(s.grand) + (s.tip > 0 ? " (Tip +" + U.money(s.tip) + ")" : "")
      );
      if (!sale) return;
      st.view = "floor";
      showPaymentSuccessModal(sale);
    },
    "waiter.closeSuccessPay": () => {
      App.closeModal(true);
      S().view = "floor";
      App.render();
    },
    "waiter.prebill": () => {
      const st = S();
      const tk = Engine.ticketByTable(st.tableId);
      App.closeModal(true);
      App.commit(() => Engine.requestPrebill(tk.id, App.me().id), "Đã báo thu ngân in tạm tính bàn " + Engine.table(st.tableId).code);
    },
    "waiter.bottle": () => {
      const st = S();
      st._bt = { phone: "", name: "", wine: "", pct: 50 };
      App.closeModal(true);
      App.modal({
        title: "Tạo thẻ gửi rượu",
        sub: "Bàn " + Engine.table(st.tableId).code + " · thẻ in tại quầy bar",
        sheet: true,
        body: () => UI.field("Số điện thoại khách", UI.input({ id: "bt-phone", model: "waiter._bt.phone", value: st._bt.phone, inputmode: "tel", placeholder: "09xx xxx xxx", autofocus: true })) +
          UI.field("Tên khách", UI.input({ id: "bt-name", model: "waiter._bt.name", value: st._bt.name, placeholder: "VD: Anh Khoa" })) +
          UI.field("Tên rượu", UI.input({ id: "bt-wine", model: "waiter._bt.wine", value: st._bt.wine, placeholder: "VD: Chivas 12 (700ml)" })) +
          UI.field("Lượng còn lại", '<div class="chips">' + [25, 50, 75, 90].map((p) => '<button class="chip ' + (st._bt.pct === p ? "active" : "") + '" data-act="waiter.btPct" data-p="' + p + '">' + p + "%</button>").join("") + "</div>"),
        foot: () => UI.btn("Hủy bỏ", { act: "app.closeModal" }) + UI.btn("Tạo thẻ và in", { act: "waiter.btSave", kind: "primary", icon: "printer" }),
      });
    },
    "waiter.btPct": (d) => { S()._bt.pct = Number(d.p); App.render(); },
    "waiter.btSave": () => {
      const st = S();
      const b = st._bt;
      const r = App.commit(() => Engine.createBottleKeep({ phone: b.phone, name: b.name, wine: b.wine, remainingPct: b.pct, tableId: st.tableId, by: App.me().id }), (bt) => "Đã tạo thẻ " + bt.code + ", đang in tại quầy bar");
      if (r) App.closeModal(true);
    },
    "waiter.transfer": () => {
      const st = S();
      App.closeModal(true);
      const free = Store.config.tables.filter((t) => Engine.tableStatus(t).status === "empty");
      App.modal({
        title: "Chuyển bàn " + Engine.table(st.tableId).code + " sang",
        sheet: true,
        body: () => (free.length ? '<div class="floor">' + free.map((t) => UI.tile(t, Engine.tableStatus(t), { act: "waiter.transferTo" })).join("") + "</div>" : UI.empty("layout-grid", "Không còn bàn trống")),
      });
    },
    "waiter.transferTo": (d) => {
      const st = S();
      const tk = Engine.ticketByTable(st.tableId);
      const from = Engine.table(st.tableId).code;
      const ok = App.commit(() => Engine.transferTable(tk.id, d.table), "Đã chuyển " + from + " sang " + Engine.table(d.table).code);
      if (ok) { st.tableId = d.table; App.closeModal(true); }
    },
    "waiter.void": () => {
      const st = S();
      const tk = Engine.ticketByTable(st.tableId);
      App.closeModal(true);
      const items = tk.items.filter((i) => i.status !== "void" && !i.voidRequested && !i.isFree);
      App.modal({
        title: "Chọn món cần hủy",
        sub: "Món chưa cân được hủy ngay. Món đã gửi bếp cần Chủ quán duyệt.",
        sheet: true,
        body: () => (items.length ? '<div class="card list">' + items.map((i) => '<button class="list-row" data-act="waiter.voidItem" data-item="' + i.id + '"><div class="grow"><b>' + esc((Engine.menu(i.menuId).kind === "seafood" ? "" : i.qty + "x ") + i.name) + '</b><div class="meta">' + esc(Engine.itemLabel(i) || "Gửi lúc " + U.time(i.sentAt)) + "</div></div>" + I("chevron-right", "ic-sm") + "</button>").join("") + "</div>" : UI.empty("clipboard-list", "Không có món có thể hủy")),
      });
    },
    "waiter.voidItem": async (d) => {
      const st = S();
      const tk = Engine.ticketByTable(st.tableId);
      const it = tk.items.find((i) => i.id === d.item);
      App.closeModal(true);
      const res = await App.confirm({ title: "Hủy món " + it.name, message: it.status === "pending_weigh" ? "Món chưa cân sẽ được hủy ngay." : "Món đã in phiếu bếp. Yêu cầu sẽ gửi Chủ quán duyệt.", reason: true, placeholder: "VD: Khách đổi món, bếp hết nguyên liệu", confirm: "Gửi yêu cầu hủy", danger: true });
      if (!res) return;
      App.commit(() => Engine.requestVoid(tk.id, it.id, res.reason, App.me().id), (r) => (r.done ? "Đã hủy món" : "Đã gửi yêu cầu hủy món, chờ duyệt"));
    },
    "waiter.readNote": (d) => App.commit((s) => { const n = s.data.notifications.find((x) => x.id === d.id); if (n) n.read = true; }),
    "waiter.clean": (d) => App.commit(() => Engine.markClean(d.table), "Đã cập nhật bàn " + Engine.table(d.table).code + " sạch"),
    "waiter.checkin": () => App.openCheckinModal(),
    "waiter.checkout": async () => {
      const me = App.me();
      const myOpen = Engine.openTickets().filter((t) => t.waiterId === me.id);
      const ok = await App.confirm({
        title: "Chấm công ra ca",
        message:
          (myOpen.length
            ? "Bạn còn " + myOpen.length + " bàn đang phục vụ (" + myOpen.map((t) => Engine.table(t.tableId).code).join(", ") + "). Hệ thống sẽ tự động bàn giao sang đồng nghiệp cùng khu vực đang trong ca. "
            : "") +
          "Giờ công được tính tối đa đến giờ đóng bill cuối cộng " +
          Store.config.attendance.cleanupBuffer +
          " phút dọn dẹp.",
        confirm: "Chấm công ra & Bàn giao bàn",
      });
      if (!ok) return;
      App.commit(
        () => Engine.checkOut(me.id),
        (r) =>
          "Đã chấm công ra lúc " +
          U.time(r.rec.out) +
          (r.handoverTables && r.handoverTables.length
            ? " · Đã tự động bàn giao " +
              r.handoverTables.map((h) => h.tableCode + " -> " + U.shortName(h.toWaiterName)).join(", ")
            : "") +
          (r.otPendingMin ? " · " + r.otPendingMin + " phút tăng ca chờ duyệt" : "")
      );
    },
    "waiter.advance": () => {
      const me = App.me();
      const pay = Engine.payroll(me.id);
      const st = S();
      st._adv = { amount: "", reason: "" };
      App.modal({
        title: "Xin ứng lương",
        sub: "Tối đa " + U.money(pay.advanceAvailable) + " (" + Store.config.payroll.advanceCapPct + "% lương đã làm trong tháng)",
        sheet: true,
        body: () => UI.field("Số tiền", '<div class="input-group">' + UI.input({ id: "adv-amt", model: "waiter._adv.amount", value: st._adv.amount, inputmode: "numeric", placeholder: "VD: 1000000", autofocus: true }) + '<span class="addon">đồng</span></div>') +
          '<div class="chips">' + [500000, 1000000, 1500000, pay.advanceAvailable].filter((v, i, a) => v >= 50000 && v <= pay.advanceAvailable && a.indexOf(v) === i).map((v) => '<button class="chip" data-act="waiter.advSet" data-v="' + v + '">' + U.moneyShort(v) + "</button>").join("") + "</div>" +
          UI.field("Lý do", UI.input({ id: "adv-reason", model: "waiter._adv.reason", value: st._adv.reason, placeholder: "Không bắt buộc" })) +
          UI.banner("info", "info", "Sau khi Chủ quán duyệt, nhận tiền mặt tại quầy thu ngân. Khoản ứng tự trừ vào lương cuối tháng."),
        foot: () => UI.btn("Hủy bỏ", { act: "app.closeModal" }) + UI.btn("Gửi yêu cầu", { act: "waiter.advSubmit", kind: "primary" }),
      });
    },
    "waiter.advSet": (d) => { S()._adv.amount = d.v; App.render(); },
    "waiter.advSubmit": () => {
      const a = S()._adv;
      const r = App.commit(() => Engine.requestAdvance(App.me().id, U.parseNum(a.amount), a.reason), "Đã gửi yêu cầu ứng lương, chờ Chủ quán duyệt");
      if (r) App.closeModal(true);
    },
  });
})();
