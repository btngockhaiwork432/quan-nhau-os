/* =========================================================================
   Giao dien 3 - PG BIA (dien thoai, man hinh doc)
   Tab day: Ban | Quy khuyen mai | Ca nhan
   PG khong mo ban, chi ban bia cua hang minh phu trach (+ nuoc ngot, da neu duoc phep)
   ========================================================================= */
(function () {
  const I = U.icon, esc = U.esc;
  const P = "pg";
  const S = () => App.state(P, { tab: "tables", view: "floor", tableId: null, area: "all", cart: {}, cartTable: null, ret: { caps: {}, crates: "", note: "" } });

  /* ---------- Tien ich ---------- */
  const cfg = () => Store.config;
  const brandIdsOf = (me) => (me && me.brandIds && me.brandIds.length ? me.brandIds : cfg().brands.map((b) => b.id));
  const brandName = (id) => { const b = Engine.brand(id); return b ? b.name : id; };
  const brandShort = (id) => brandName(id).replace(/\s*\(.*\)\s*$/, "");
  const promoOf = (menuId) => cfg().promos.find((p) => p.active && p.menuId === menuId);
  const unitOf = (m) => m.unit || "lon";
  function products(me) {
    const ids = brandIdsOf(me);
    const beers = Engine.activeMenu((m) => m.kind === "beer" && ids.includes(m.brandId));
    let soft = [];
    if ((cfg().permissions.pg || {}).sellSoftDrink) {
      soft = Engine.activeMenu((m) => {
        const c = Engine.cat(m.categoryId);
        return m.kind === "drink" && c && c.kind === "drink" && c.vatGroup !== "alcohol";
      });
    }
    return { beers, soft, all: beers.concat(soft) };
  }
  function myMenuIds(me) { return Engine.activeMenu((m) => m.kind === "beer" && brandIdsOf(me).includes(m.brandId)).map((m) => m.id); }
  // So luong tung san pham dang co tren bill: {menuId: {paid, free}}
  function ticketQty(tk) {
    const out = {};
    (tk ? tk.items : []).forEach((i) => {
      if (i.status === "void") return;
      const o = (out[i.menuId] = out[i.menuId] || { paid: 0, free: 0 });
      if (i.isFree) o.free += i.qty; else o.paid += i.qty;
    });
    return out;
  }
  // Du kien so lon tang them khi gui gio hang (theo luat Mua X tang Y, gioi han quy hang)
  function projectedFree(tk, cart) {
    const have = ticketQty(tk);
    const out = {};
    const usedByBrand = {};
    cfg().promos.filter((p) => p.active && p.menuId && cart[p.menuId]).forEach((p) => {
      const h = have[p.menuId] || { paid: 0, free: 0 };
      const haveFree = U.sum(tk.items.filter((i) => i.menuId === p.menuId && i.isFree && i.promoId === p.id && i.status !== "void"), (i) => i.qty);
      const paid = h.paid + (cart[p.menuId] || 0);
      let diff = Math.floor(paid / p.buyQty) * p.freeQty - haveFree;
      if (diff <= 0) return;
      if (p.source === "brand") {
        const left = Engine.promoQuotaRemaining(p.brandId) - (usedByBrand[p.brandId] || 0);
        diff = Math.min(diff, Math.max(0, left));
        usedByBrand[p.brandId] = (usedByBrand[p.brandId] || 0) + diff;
      }
      if (diff > 0) out[p.menuId] = diff;
    });
    return out;
  }
  // Dong bia tang hom nay cua cac hang PG phu trach (ban dang mo + bill da thanh toan)
  function freeLinesToday(me) {
    const key = U.dayKey();
    const ids = myMenuIds(me);
    const out = [];
    Engine.openTickets().forEach((t) => t.items.forEach((i) => {
      if (i.isFree && ids.includes(i.menuId) && i.status !== "void" && U.dayKey(i.sentAt || t.openedAt) === key) out.push({ table: (Engine.table(t.tableId) || {}).code || "", menuId: i.menuId, name: i.name, qty: i.qty, at: i.sentAt || t.openedAt, paid: false, promoId: i.promoId });
    }));
    Store.data.sales.filter((s) => s.dayKey === key).forEach((s) => s.lines.forEach((l) => {
      if (l.isFree && ids.includes(l.menuId) && l.status !== "void") out.push({ table: s.tableCode, menuId: l.menuId, name: l.name, qty: l.qty, at: l.sentAt || s.closedAt, paid: true, promoId: l.promoId });
    }));
    return out.sort((a, b) => b.at - a.at);
  }
  // Nap can thu hoi theo tung loai bia: {menuId: {required, returned, pending}}
  function capsByMenu(me) {
    const key = U.dayKey();
    const res = {};
    freeLinesToday(me).forEach((l) => {
      const p = cfg().promos.find((x) => x.id === l.promoId);
      if (!p || !p.requireCapReturn) return;
      (res[l.menuId] = res[l.menuId] || { required: 0, returned: 0, pending: 0 }).required += l.qty;
    });
    cfg().promos.filter((p) => p.requireCapReturn && brandIdsOf(me).includes(p.brandId)).forEach((p) => { res[p.menuId] = res[p.menuId] || { required: 0, returned: 0, pending: 0 }; });
    Store.data.pgReturns.filter((r) => r.dayKey === key && r.by === me.id).forEach((r) => Object.keys(r.caps || {}).forEach((mid) => { if (res[mid]) res[mid].returned += Number(r.caps[mid]) || 0; }));
    Object.keys(res).forEach((mid) => (res[mid].pending = Math.max(0, res[mid].required - res[mid].returned)));
    return res;
  }
  const casesLabel = (cans) => U.num(cans / 24, 1) + " thùng";

  /* ---------- Thanh so lieu ---------- */
  function kpis(me) {
    const w = cfg().widgets.pg || {};
    const att = Engine.activeAtt(me.id);
    const stats = Engine.pgStats(me.id);
    const cards = [];
    if (w.shift) cards.push(UI.kpi({ label: "Ca trực", icon: "clock", value: att ? UI.since(att.in) : "Chưa vào ca", meta: att ? "Vào lúc " + U.time(att.in) + (att.lateMin > cfg().attendance.graceMinutes ? " · trễ " + att.lateMin + " phút" : " · đúng giờ") : "Chạm để chấm công", tone: att ? "" : "warn", act: "pg.tab", data: { value: "me" } }));
    if (w.sales) {
      const pct = stats.target ? (stats.cases / stats.target) * 100 : 0;
      cards.push(UI.kpi({ label: "Sản lượng ca", icon: "beer", value: U.num(stats.cases, 1) + '<small class="pg-kpi-unit"> / ' + stats.target + " thùng</small>", meta: '<div class="pg-kpi-prog">' + UI.progress(pct, pct >= 100 ? "success" : "") + "</div>" + U.num(stats.cans) + " lon · đạt " + U.num(Math.min(999, pct), 0) + "%", tone: pct >= 100 ? "good" : "" }));
    }
    if (w.quota) {
      const parts = stats.brandIds.map((b) => ({ b, q: stats.quota[b] })).filter((x) => x.q && x.q.total !== null);
      const left = U.sum(parts, (x) => x.q.left);
      const low = parts.some((x) => x.q.total && x.q.left / x.q.total <= 0.15);
      cards.push(UI.kpi({ label: "Quỹ khuyến mãi còn", icon: "badge-percent", value: parts.length ? left + '<small class="pg-kpi-unit"> lon</small>' : "Không giới hạn", meta: parts.map((x) => esc(brandShort(x.b)) + " " + x.q.left).join(" · ") || "Theo cài đặt Chủ quán", tone: low ? "warn" : "", act: "pg.tab", data: { value: "quota" } }));
    }
    if (w.caps) cards.push(UI.kpi({ label: "Nắp cần thu hồi", icon: "package", value: stats.capsPending + '<small class="pg-kpi-unit"> nắp</small>', meta: "Đã nộp " + stats.capsReturned + " / " + stats.capsRequired + " · vỏ két tại bàn " + stats.cratesOut, tone: stats.capsPending ? "warn" : "", act: "pg.tab", data: { value: "quota" } }));
    if (w.commission) cards.push(UI.kpi({ label: "Hoa hồng tạm tính", icon: "hand-coins", value: U.moneyShort(stats.commission), meta: Math.floor(stats.cases) + " thùng x " + U.money(cfg().pg.commissionPerCase) }));
    return cards.length ? '<div class="kpi-strip pg-kpis">' + cards.join("") + "</div>" : "";
  }

  /* ---------- Tab Ban ---------- */
  function floorView(me) {
    const st = S();
    const att = Engine.activeAtt(me.id);
    const ids = myMenuIds(me);
    const areas = [{ value: "all", label: "Tất cả" }].concat(cfg().areas.map((a) => ({ value: a.id, label: a.name })));
    const withBeer = Engine.openTickets().filter((t) => t.items.some((i) => ids.includes(i.menuId) && i.status !== "void")).length;
    return (att ? "" : UI.banner("warning", "clock", "<b>Bạn chưa chấm công vào ca.</b> Chấm công trước khi bán để sản lượng được tính đúng. " + '<a href="#" data-act="pg.checkin">Chấm công ngay</a>')) +
      kpis(me) +
      UI.chips(areas, st.area, "pg.area") +
      '<div class="row between small"><span class="muted">' + I("info", "ic-sm") + " Chạm bàn đang phục vụ để bán bia</span><span class=\"muted\">" + withBeer + "/" + Engine.openTickets().length + " bàn đã có bia hãng</span></div>" +
      UI.floor({
        act: "pg.table",
        areaId: st.area,
        extra: (t, s) => {
          if (!s.ticket) return "";
          const q = ticketQty(s.ticket);
          const cans = U.sum(ids, (id) => (q[id] ? q[id].paid : 0));
          return cans ? '<span class="pg-tile-tag">' + I("beer", "ic-sm") + cans + " lon</span>" : "";
        },
      }) +
      '<div class="mt-8">' + UI.legend() + "</div>";
  }

  function productCard(m, tk, cart, free, locked) {
    const stock = Store.data.drinks[m.id];
    const inCart = cart[m.id] || 0;
    const promo = promoOf(m.id);
    const unit = unitOf(m);
    const left = stock === undefined ? Infinity : stock - inCart;
    let promoLine = "";
    if (promo) {
      const quota = promo.source === "brand" ? Engine.promoQuotaRemaining(promo.brandId) : Infinity;
      const rule = "Mua " + promo.buyQty + " tặng " + promo.freeQty;
      promoLine = quota === Infinity
        ? '<div class="pg-promo">' + I("badge-percent", "ic-sm") + "<span>" + rule + "</span></div>"
        : quota > 0
          ? '<div class="pg-promo">' + I("badge-percent", "ic-sm") + "<span>" + rule + " · quỹ hãng còn <b>" + quota + " " + esc(unit) + "</b></span></div>"
          : '<div class="pg-promo pg-promo-out">' + I("triangle-alert", "ic-sm") + "<span>" + rule + " · quỹ hãng hôm nay đã hết, tạm dừng tặng</span></div>";
    }
    const cs = Number(m.caseSize) || 0;
    const halfCs = cs >= 12 ? Math.round(cs / 2) : 0;
    const caseBtn = cs ? '<button type="button" class="btn btn-lg btn-primary pg-add" data-act="pg.add" data-menu="' + m.id + '" data-q="' + cs + '"' + (locked || left < cs ? " disabled" : "") + ">" + I("boxes") + "<span>+1 thùng (" + cs + " " + esc(unit) + ")</span></button>" : "";
    const halfBtn = halfCs ? '<button type="button" class="btn btn-lg pg-add" data-act="pg.add" data-menu="' + m.id + '" data-q="' + halfCs + '"' + (locked || left < halfCs ? " disabled" : "") + ">" + I("package") + "<span>+Nửa thùng (" + halfCs + ")</span></button>" : "";
    return '<div class="pg-prod' + (inCart ? " in-cart" : "") + (stock !== undefined && stock <= 0 ? " sold-out" : "") + '">' +
      '<div class="pg-prod-head"><div class="grow"><div class="pg-prod-name">' + esc(m.name) + '</div><div class="pg-prod-meta">' + U.money(m.price) + "/" + esc(unit) +
      (cs ? " · <b>" + U.money((m.price || 0) * cs) + "/thùng (" + cs + " " + esc(unit) + ")</b>" : "") +
      (stock !== undefined ? ' · <span class="' + (stock <= (cs || 10) ? "text-warning strong" : "") + '">tồn ' + U.num(stock) + " " + esc(unit) + (cs && stock >= cs ? " (" + Math.floor(stock / cs) + " thùng)" : "") + "</span>" : "") + "</div></div>" +
      (inCart ? '<div class="pg-cart-qty"><button type="button" class="pg-minus" data-act="pg.minus" data-menu="' + m.id + '" aria-label="Bớt 1">' + I(inCart === 1 ? "trash-2" : "minus", "ic-sm") + '</button><span class="num">' + esc(cs ? Engine.formatBeerCaseQty(inCart, cs, unit) : inCart) + "</span></div>" : "") + "</div>" +
      promoLine +
      (free ? '<div class="pg-free-preview">' + I("sparkles", "ic-sm") + "<span>Khi gửi: tự động tặng thêm <b>" + free + " " + esc(unit) + "</b> - trừ quỹ hãng</span></div>" : "") +
      '<div class="pg-prod-actions">' + caseBtn + halfBtn + '<button type="button" class="btn btn-lg pg-add' + (cs ? "" : " pg-add-wide") + '" data-act="pg.add" data-menu="' + m.id + '" data-q="1"' + (locked || left < 1 ? " disabled" : "") + ">" + I("plus") + "<span>+1 " + esc(unit) + "</span></button></div>" +
      (stock !== undefined && stock <= 0 ? '<div class="small text-danger strong">Hết hàng trong kho</div>' : "") +
      "</div>";
  }

  function sellView(me) {
    const st = S();
    const table = Engine.table(st.tableId);
    const tk = table && Engine.ticketByTable(table.id);
    if (!tk) {
      st.view = "floor";
      return floorView(me);
    }
    if (st.cartTable !== tk.id) { st.cart = {}; st.cartTable = tk.id; }
    const locked = tk.status === "locked";
    const prods = products(me);
    const cart = st.cart;
    const free = projectedFree(tk, cart);
    const have = ticketQty(tk);
    const status = Engine.tableStatus(table);
    const haveRows = prods.all.filter((m) => have[m.id]).map((m) => {
      const sum = Engine.beerSummaryOnTicket(tk, m.id);
      const u = unitOf(m);
      const cs = m.caseSize || 24;
      const detailTxt = sum && sum.returnedQty > 0
        ? "Đem " + Engine.formatBeerCaseQty(sum.broughtOutQty, cs, u) + " · Trả " + sum.returnedQty + " " + u + " &rarr; Tính " + have[m.id].paid + " " + u
        : (m.kind === "beer" ? Engine.formatBeerCaseQty(have[m.id].paid, cs, u) : have[m.id].paid + " " + u);
      const retBtn = m.kind === "beer" && have[m.id].paid > 0
        ? '<button type="button" class="btn btn-sm" style="border-color:var(--warning);color:var(--warning)" data-act="pg.returnBeerModal" data-menu="' + m.id + '">Trả bia dư</button>'
        : "";
      return '<div class="pg-have-row wrap gap-6"><span class="grow"><b>' + esc(m.name) + '</b><div class="small muted">' + detailTxt + '</div></span><span class="num strong">' + have[m.id].paid + " " + esc(u) + "</span>" + (have[m.id].free ? UI.badge("Tặng " + have[m.id].free, "success") : "") + retBtn + "</div>";
    }).join("");
    const brands = brandIdsOf(me).map(brandShort).join(", ");
    const items = Object.keys(cart).filter((k) => cart[k] > 0);
    const count = U.sum(items, (k) => cart[k]);
    const amount = U.sum(items, (k) => cart[k] * (Engine.menu(k).price || 0));
    const units = Array.from(new Set(items.map((k) => unitOf(Engine.menu(k)))));
    const unitLabel = units.length === 1 ? units[0] : "sản phẩm";
    const freeTotal = U.sum(Object.values(free));
    return '<div class="row between"><button class="btn btn-ghost" data-act="pg.back">' + I("chevron-left") + "<span>Sơ đồ bàn</span></button>" + UI.badge(Engine.STATUS_LABEL[status.status], locked ? "danger" : status.status === "weigh" ? "warning" : "primary", true) + "</div>" +
      '<div class="card card-pad pg-table-head"><div class="row between"><div><h2>' + esc(table.code) + '</h2><div class="muted small">' + tk.guests + " khách · mở lúc " + U.time(tk.openedAt) + " · " + UI.since(tk.openedAt) + (tk.waiterId ? " · phục vụ " + esc(U.shortName(Engine.staffName(tk.waiterId))) : "") + "</div></div>" +
      '<span class="pg-table-ic">' + I("beer", "ic-lg") + "</span></div>" +
      '<div class="pg-have"><div class="pg-have-title">Đã có tại bàn</div>' + (haveRows || '<div class="small muted">Bàn chưa gọi bia hoặc nước của hãng bạn phụ trách.</div>') + "</div></div>" +
      (locked ? UI.banner("danger", "lock", "<b>Bill đã khóa</b> sau khi in tạm tính lúc " + U.time(tk.prebillAt) + ". Không thể thêm bia. Báo thu ngân nếu khách gọi thêm.") : "") +
      '<div class="section-title pg-sec">Bia ' + esc(brands) + "</div>" +
      (prods.beers.length ? '<div class="pg-grid">' + prods.beers.map((m) => productCard(m, tk, cart, free[m.id], locked)).join("") + "</div>" : UI.empty("beer", "Chưa được phân công hãng bia", "Liên hệ Chủ quán để cài đặt hãng bia bạn phụ trách.")) +
      (prods.soft.length ? '<div class="section-title pg-sec">Nước ngọt và đá</div><div class="pg-grid pg-grid-soft">' + prods.soft.map((m) => productCard(m, tk, cart, free[m.id], locked)).join("") + "</div>" : "") +
      (count ? '<div class="sticky-action"><div class="cart-bar"><button type="button" class="pg-cart-clear" data-act="pg.clear" title="Bỏ danh sách" aria-label="Bỏ danh sách">' + I("x") + '</button><div class="cb-info"><b>' + count + " " + esc(unitLabel) + " · " + U.money(amount) + "</b><span>" + (freeTotal ? "Tặng kèm " + freeTotal + " theo khuyến mãi hãng" : "Bàn " + esc(table.code)) + '</span></div><button class="btn btn-primary" data-act="pg.send"' + (locked ? " disabled" : "") + ">" + I("send") + "Gửi · " + count + " " + esc(unitLabel) + "</button></div></div>" : "");
  }

  /* ---------- Tab Quy khuyen mai ---------- */
  function quotaView(me) {
    const stats = Engine.pgStats(me.id);
    const st = S();
    const lines = freeLinesToday(me);
    const caps = capsByMenu(me);
    const returns = Store.data.pgReturns.filter((r) => r.dayKey === U.dayKey() && r.by === me.id).sort((a, b) => b.at - a.at);
    const brandCards = stats.brandIds.map((b) => {
      const q = stats.quota[b] || {};
      const promos = cfg().promos.filter((p) => p.brandId === b && p.active);
      const unlimited = q.total === null || q.total === undefined;
      const pct = unlimited || !q.total ? 0 : (q.used / q.total) * 100;
      const tone = unlimited ? "" : q.left <= q.total * 0.15 ? "danger" : q.left <= q.total * 0.35 ? "warning" : "success";
      return '<div class="card card-pad pg-quota">' +
        '<div class="row between"><b>' + esc(brandName(b)) + "</b>" + (unlimited ? UI.badge("Không giới hạn", "") : UI.badge(q.left > 0 ? "Còn " + q.left + " lon" : "Đã hết quỹ", tone === "success" ? "success" : tone === "warning" ? "warning" : "danger", true)) + "</div>" +
        '<div class="small muted">' + (promos.length ? promos.map((p) => esc(p.name)).join(" · ") : "Không có chương trình đang chạy") + "</div>" +
        (unlimited ? '<div class="pg-quota-num"><b>' + q.used + '</b><span>lon đã tặng hôm nay</span></div>'
          : '<div class="pg-quota-num"><b>' + q.left + '</b><span>/ ' + q.total + " lon còn lại</span></div>" + UI.progress(pct, tone) +
            '<div class="row between small muted"><span>Đã tặng ' + q.used + " lon</span><span>Quỹ mỗi ca " + q.total + " lon</span></div>") +
        "</div>";
    }).join("");
    const byTable = U.groupBy(lines, (l) => l.table);
    const tableRows = Object.keys(byTable).map((code) => {
      const ls = byTable[code];
      const total = U.sum(ls, (l) => l.qty);
      const paid = ls.every((l) => l.paid);
      return '<div class="list-row"><span class="pg-tcode">' + esc(code) + '</span><div class="grow"><div class="strong">' + ls.map((l) => l.qty + " " + esc(l.name)).join(", ") + '</div><div class="meta">Lần gần nhất ' + U.time(ls[0].at) + "</div></div>" + '<div class="col" style="align-items:flex-end;gap:4px"><b class="num">' + total + " lon</b>" + UI.badge(paid ? "Đã thanh toán" : "Đang phục vụ", paid ? "" : "primary") + "</div></div>";
    }).join("");
    const capIds = Object.keys(caps);
    const capRows = capIds.map((mid) => {
      const m = Engine.menu(mid);
      const c = caps[mid];
      const raw = st.ret.caps[mid];
      const val = raw === undefined || raw === "" ? "" : raw;
      const n = Number(val) || 0;
      const diff = n - c.pending;
      const diffBadge = val === "" ? "" : diff === 0 ? UI.badge("Khớp số cần nộp", "success") : diff < 0 ? UI.badge("Thiếu " + -diff + " nắp", "danger") : UI.badge("Dư " + diff + " nắp", "warning");
      return '<div class="pg-ret-row"><div class="grow"><div class="strong">Nắp ' + esc(m ? m.name : mid) + '</div><div class="small muted">Đã tặng ' + c.required + " · đã nộp " + c.returned + " · cần nộp <b>" + c.pending + "</b></div>" + (diffBadge ? '<div class="mt-4">' + diffBadge + "</div>" : "") + "</div>" +
        numBox("ret-cap-" + mid, "pg.ret.caps." + mid, val, "caps." + mid) + "</div>";
    }).join("");
    return '<h2 class="pg-h2">Quỹ khuyến mãi hôm nay</h2>' +
      '<div class="col gap-12">' + brandCards + "</div>" +
      '<div class="card"><div class="card-head"><h3>Lon tặng theo bàn</h3><span class="sub">' + U.sum(lines, (l) => l.qty) + " lon · " + Object.keys(byTable).length + " bàn</span></div>" +
      (tableRows ? '<div class="list">' + tableRows + "</div>" : UI.empty("badge-percent", "Chưa tặng lon nào hôm nay", "Khi bàn đủ số lượng theo luật khuyến mãi, hệ thống tự thêm lon tặng vào bill.")) + "</div>" +
      '<div class="card"><div class="card-head"><div><h3>Nộp nắp và vỏ két cuối ca</h3><div class="sub">Hệ thống so với số lon đã tặng và báo lệch</div></div>' + (stats.capsPending ? UI.badge("Còn " + stats.capsPending + " nắp", "warning", true) : UI.badge("Đã đủ", "success", true)) + "</div>" +
      '<div class="card-body col gap-12">' +
      (capRows || '<div class="small muted">Không có chương trình nào yêu cầu thu hồi nắp.</div>') +
      '<div class="pg-ret-row"><div class="grow"><div class="strong">Vỏ két</div><div class="small muted">Két bia hãng đang ở các bàn: ' + stats.cratesOut + "</div></div>" + numBox("ret-crates", "pg.ret.crates", st.ret.crates, "crates") + "</div>" +
      UI.field("Ghi chú", UI.input({ id: "ret-note", model: "pg.ret.note", value: st.ret.note, placeholder: "VD: 2 nắp rơi vỡ tại bàn A08" })) +
      (capIds.length ? UI.btn("Điền đúng số cần nộp", { act: "pg.retFill", size: "sm", icon: "list-checks", cls: "pg-fill" }) : "") +
      UI.btn("Nộp nắp và vỏ két", { act: "pg.retSubmit", kind: "primary", size: "lg", block: true, icon: "package" }) +
      "</div></div>" +
      '<div class="card"><div class="card-head"><h3>Đã nộp hôm nay</h3><span class="sub">' + returns.length + " lần</span></div>" +
      (returns.length ? '<div class="list">' + returns.map((r) => {
        const capTxt = Object.keys(r.caps || {}).filter((k) => Number(r.caps[k])).map((k) => r.caps[k] + " nắp " + esc((Engine.menu(k) || {}).name || k)).join(", ");
        return '<div class="list-row"><span class="badge badge-success" style="width:32px;height:32px;padding:0;justify-content:center">' + I("check", "ic-sm") + '</span><div class="grow"><div class="strong">' + (capTxt || "Không nộp nắp") + (r.crates ? " · " + r.crates + " vỏ két" : "") + '</div><div class="meta">Lúc ' + U.time(r.at) + (r.note ? " · " + esc(r.note) : "") + "</div></div></div>";
      }).join("") + "</div>" : UI.empty("history", "Chưa nộp lần nào", "Cuối ca, đếm nắp và vỏ két rồi nộp tại quầy.")) + "</div>";
  }
  function numBox(id, model, value, key) {
    return '<div class="pg-num"><button type="button" data-act="pg.retStep" data-key="' + key + '" data-d="-1" aria-label="Bớt">' + I("minus", "ic-sm") + "</button>" +
      UI.input({ id, model, value, inputmode: "numeric", placeholder: "0", maxlength: 4, live: true, cls: "pg-num-input" }) +
      '<button type="button" data-act="pg.retStep" data-key="' + key + '" data-d="1" aria-label="Thêm">' + I("plus", "ic-sm") + "</button></div>";
  }

  /* ---------- Tab Ca nhan ---------- */
  function meView(me) {
    const att = Engine.activeAtt(me.id);
    const today = Engine.attOfDay(me.id);
    const pay = Engine.payroll(me.id);
    const recent = pay.records.slice(-6).reverse();
    const ac = cfg().attendance;
    return '<div class="card card-pad"><div class="row gap-12">' + UI.avatar(me.name, true) + '<div class="grow"><div class="strong" style="font-size:16px">' + esc(me.name) + '</div><div class="muted small">' + esc(Engine.roleLabel(me.role)) + " · " + esc((Engine.shiftDef(me.shiftId) || {}).name || "") + '</div><div class="small mt-4">Phụ trách: ' + brandIdsOf(me).map((b) => UI.badge(brandShort(b), "primary")).join(" ") + "</div></div></div></div>" +
      '<div class="card"><div class="card-head"><h3>Chấm công</h3>' + (att ? UI.badge("Đang trong ca", "success", true) : UI.badge("Chưa vào ca", "warning", true)) + '</div><div class="card-body col gap-12">' +
      (att
        ? '<div class="row between"><div><div class="muted small">Vào ca lúc</div><div class="strong" style="font-size:20px">' + U.time(att.in) + '</div></div><div class="right"><div class="muted small">Đã làm</div><div class="strong" style="font-size:20px">' + UI.since(att.in) + "</div></div></div>" + (att.lateMin > ac.graceMinutes ? UI.banner("warning", "triangle-alert", "Đi trễ " + att.lateMin + " phút · phạt " + U.money(Engine.latePenalty(att.lateMin))) : "") + UI.btn("Chấm công ra ca", { act: "pg.checkout", size: "lg", block: true, icon: "log-out" })
        : '<p class="muted">Cần kết nối Wi-Fi của quán, ở trong bán kính ' + ac.gpsRadius + " m và chụp ảnh xác thực.</p>" + UI.btn("Chấm công vào ca", { act: "pg.checkin", kind: "primary", size: "lg", block: true, icon: "clock" })) +
      (today.filter((a) => a.out).length ? '<div class="small muted">Hôm nay: ' + today.filter((a) => a.out).map((a) => U.time(a.in) + " - " + U.time(a.out)).join(", ") + "</div>" : "") +
      "</div></div>" +
      '<div class="card"><div class="card-head"><h3>Lương tạm tính</h3><span class="sub">Hoa hồng ' + U.money(cfg().pg.commissionPerCase) + "/thùng</span></div><div class=\"card-body\">" + UI.payslip(pay) +
      '<div class="divider"></div><div class="row between"><div><div class="small muted">Có thể ứng tối đa</div><div class="strong">' + U.money(pay.advanceAvailable) + "</div></div>" + UI.btn("Xin ứng lương", { act: "pg.advance", icon: "wallet", disabled: pay.advanceAvailable < 50000 }) + "</div>" +
      (pay.advPending ? '<div class="mt-8">' + UI.badge("Đang chờ duyệt/chi " + U.money(pay.advPending), "warning") + "</div>" : "") +
      "</div></div>" +
      '<div class="card"><div class="card-head"><h3>Ca gần đây</h3><span class="sub">' + pay.days + " ngày công trong tháng</span></div>" +
      (recent.length ? '<div class="list">' + recent.map((r) => { const h = Engine.attHours(r); return '<div class="list-row"><div class="grow"><div class="strong">' + U.dayLabel(r.dayKey) + '</div><div class="meta">' + U.time(r.in) + " - " + (r.out ? U.time(r.out) : "đang làm") + (r.lateMin > ac.graceMinutes ? " · trễ " + r.lateMin + " phút" : "") + (r.otStatus === "pending" ? " · tăng ca chờ duyệt" : "") + '</div></div><span class="num strong">' + U.num(h.regular + h.ot, 1) + " giờ</span></div>"; }).join("") + "</div>" : UI.empty("calendar", "Chưa có ca nào trong tháng")) +
      "</div>";
  }

  /* ---------- Render ---------- */
  App.portal(P, {
    render() {
      const me = App.me();
      const st = S();
      let content;
      if (st.tab === "tables") content = st.view === "sell" ? sellView(me) : floorView(me);
      else if (st.tab === "quota") content = quotaView(me);
      else content = meView(me);
      const pending = Engine.pgStats(me.id).capsPending;
      return '<div class="mobile-stage"><div class="mobile-app pg-app">' + UI.topbar({ role: "PG Bia" }) +
        '<main class="mobile-content" data-keep-scroll="pg">' + content + "</main>" +
        UI.bottomNav([{ value: "tables", label: "Bàn", icon: "layout-grid" }, { value: "quota", label: "Quỹ khuyến mãi", icon: "badge-percent", count: pending }, { value: "me", label: "Cá nhân", icon: "user" }], st.tab, "pg.tab") +
        "</div></div>";
    },
  });

  function retParse(v) { const n = Math.floor(Number(String(v === undefined ? "" : v).replace(/[^\d]/g, "")) || 0); return Math.max(0, n); }

  /* ---------- Hanh dong ---------- */
  App.actions({
    "pg.tab": (d) => { const st = S(); st.tab = d.value; if (d.value === "tables" && st.view === "sell" && !(st.tableId && Engine.ticketByTable(st.tableId))) st.view = "floor"; App.render(); },
    "pg.area": (d) => { S().area = d.value; App.render(); },
    "pg.back": () => { S().view = "floor"; App.render(); },
    "pg.table": (d) => {
      const st = S();
      const table = Engine.table(d.table);
      const tk = table && Engine.ticketByTable(table.id);
      if (!tk) return App.toast("Bàn chưa mở. Báo phục vụ mở bàn trước.", "warning");
      st.tab = "tables";
      st.tableId = table.id;
      st.view = "sell";
      if (st.cartTable !== tk.id) { st.cart = {}; st.cartTable = tk.id; }
      App.render();
      try { window.scrollTo(0, 0); } catch (e) {}
    },
    "pg.add": (d) => {
      const st = S();
      const m = Engine.menu(d.menu);
      if (!m) return;
      const q = Number(d.q) || 1;
      const stock = Store.data.drinks[m.id];
      const cur = st.cart[m.id] || 0;
      if (stock !== undefined && cur + q > stock) return App.toast("Kho chỉ còn " + stock + " " + unitOf(m) + " " + m.name + ". Báo quầy bar kiểm tra hàng.", "error");
      st.cart[m.id] = cur + q;
      App.render();
    },
    "pg.minus": (d) => { const st = S(); const n = (st.cart[d.menu] || 0) - 1; if (n <= 0) delete st.cart[d.menu]; else st.cart[d.menu] = n; App.render(); },
    "pg.clear": () => { S().cart = {}; App.render(); },
    "pg.send": () => {
      const st = S();
      const me = App.me();
      const tk = Engine.ticketByTable(st.tableId);
      if (!tk) return App.toast("Bàn đã đóng. Không thể gửi.", "error");
      const items = Object.keys(st.cart).filter((k) => st.cart[k] > 0).map((k) => ({ menuId: k, qty: st.cart[k] }));
      if (!items.length) return;
      const code = Engine.table(tk.tableId).code;
      const total = U.sum(items, (i) => i.qty);
      const r = App.commit(() => Engine.addItems(tk.id, items, me.id), (res) => {
        const freeQty = U.sum(res.free, (f) => f.qty);
        return "Đã gửi " + total + " " + (items.length === 1 ? unitOf(Engine.menu(items[0].menuId)) : "sản phẩm") + " cho bàn " + code + (freeQty ? " · tặng " + freeQty + " lon (trừ quỹ hãng)" : "");
      });
      if (r) { st.cart = {}; App.render(); }
    },
    "pg.retStep": (d) => {
      const r = S().ret;
      const parts = d.key.split(".");
      if (parts[0] === "caps") r.caps[parts[1]] = String(Math.max(0, retParse(r.caps[parts[1]]) + Number(d.d)));
      else r.crates = String(Math.max(0, retParse(r.crates) + Number(d.d)));
      App.render();
    },
    "pg.retFill": () => {
      const me = App.me();
      const caps = capsByMenu(me);
      const r = S().ret;
      Object.keys(caps).forEach((mid) => (r.caps[mid] = String(caps[mid].pending)));
      r.crates = String(Engine.pgStats(me.id).cratesOut);
      App.render();
    },
    "pg.retSubmit": async () => {
      const me = App.me();
      const st = S();
      const caps = capsByMenu(me);
      const out = {};
      Object.keys(st.ret.caps || {}).forEach((k) => { const n = retParse(st.ret.caps[k]); if (n) out[k] = n; });
      const crates = retParse(st.ret.crates);
      const totalCaps = U.sum(Object.values(out));
      if (!totalCaps && !crates) return App.toast("Nhập số nắp hoặc vỏ két cần nộp.", "error");
      const short = totalCaps ? Object.keys(caps).filter((k) => (out[k] || 0) < caps[k].pending).map((k) => ({ k, n: caps[k].pending - (out[k] || 0) })) : [];
      let note = String(st.ret.note || "").trim();
      if (short.length) {
        const res = await App.confirm({
          title: "Số nắp nộp còn thiếu",
          message: "Thiếu " + short.map((s) => s.n + " nắp " + esc((Engine.menu(s.k) || {}).name || s.k)).join(", ") + " so với số lon đã tặng. Phần thiếu sẽ được ghi nhận để đối soát với hãng.",
          reason: true, reasonLabel: "Giải trình", placeholder: "VD: khách làm rơi vỡ, sẽ nộp bổ sung", confirm: "Vẫn nộp", danger: true,
        });
        if (!res) return;
        note = (note ? note + ". " : "") + "Giải trình thiếu nắp: " + res.reason;
      }
      const ok = App.commit(() => Engine.submitPgReturn({ by: me.id, caps: out, crates, note }), "Đã ghi nhận nộp " + totalCaps + " nắp" + (crates ? " và " + crates + " vỏ két" : ""));
      if (ok) { st.ret = { caps: {}, crates: "", note: "" }; App.render(); }
    },
    "pg.checkin": () => App.openCheckinModal(),
    "pg.checkout": async () => {
      const me = App.me();
      const pending = Engine.pgStats(me.id).capsPending;
      const ok = await App.confirm({ title: "Chấm công ra ca", message: (pending ? "Bạn còn " + pending + " nắp chưa nộp. Hãy nộp nắp và vỏ két trước khi về. " : "") + "Giờ công được tính tối đa đến giờ đóng bill cuối cộng " + cfg().attendance.cleanupBuffer + " phút dọn dẹp.", confirm: "Chấm công ra" });
      if (!ok) return;
      App.commit(() => Engine.checkOut(me.id), (r) => "Đã chấm công ra lúc " + U.time(r.rec.out) + (r.otPendingMin ? " · " + r.otPendingMin + " phút tăng ca chờ duyệt" : ""));
    },
    "pg.advance": () => {
      const me = App.me();
      const pay = Engine.payroll(me.id);
      const st = S();
      st._adv = { amount: "", reason: "" };
      App.modal({
        title: "Xin ứng lương",
        sub: "Tối đa " + U.money(pay.advanceAvailable) + " (" + cfg().payroll.advanceCapPct + "% lương đã làm trong tháng)",
        sheet: true,
        body: () => UI.field("Số tiền", '<div class="input-group">' + UI.input({ id: "pg-adv-amt", model: "pg._adv.amount", value: st._adv.amount, inputmode: "numeric", placeholder: "VD: 500000", autofocus: true }) + '<span class="addon">đồng</span></div>') +
          '<div class="chips">' + [200000, 500000, 1000000, pay.advanceAvailable].filter((v, i, a) => v >= 50000 && v <= pay.advanceAvailable && a.indexOf(v) === i).map((v) => '<button class="chip" data-act="pg.advSet" data-v="' + v + '">' + U.moneyShort(v) + "</button>").join("") + "</div>" +
          UI.field("Lý do", UI.input({ id: "pg-adv-reason", model: "pg._adv.reason", value: st._adv.reason, placeholder: "Không bắt buộc" })) +
          UI.banner("info", "info", "Sau khi Chủ quán duyệt, nhận tiền mặt tại quầy thu ngân. Khoản ứng tự trừ vào lương cuối tháng."),
        foot: () => UI.btn("Hủy bỏ", { act: "app.closeModal" }) + UI.btn("Gửi yêu cầu", { act: "pg.advSubmit", kind: "primary" }),
      });
    },
    "pg.advSet": (d) => { S()._adv.amount = d.v; App.render(); },
    "pg.advSubmit": () => {
      const a = S()._adv;
      const r = App.commit(() => Engine.requestAdvance(App.me().id, U.parseNum(a.amount), a.reason), "Đã gửi yêu cầu ứng lương, chờ Chủ quán duyệt");
      if (r) App.closeModal(true);
    },
    "pg.returnBeerModal": (d) => {
      const st = S();
      const tk = Engine.ticketByTable(st.tableId);
      if (!tk) return;
      const menuId = d.menu;
      const sum = Engine.beerSummaryOnTicket(tk, menuId);
      if (!sum || sum.paidQty <= 0) return App.toast("Bàn không còn bia này để trả lại.", "error");
      const defRet = Math.min(sum.paidQty, 4);
      st._retBeer = {
        ticketId: tk.id,
        menuId,
        mode: "return",
        returnQty: defRet,
        consumedQty: Math.max(0, sum.paidQty - defRet),
      };
      App.modal({
        title: "Trả bia dư chưa khui · Bàn " + Engine.table(tk.tableId).code,
        sub: sum.menuName + " · Đã đem " + Engine.formatBeerCaseQty(sum.broughtOutQty, sum.caseSize, sum.unit),
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
              '<div class="card card-pad" style="background:var(--surface-2)">' +
                '<div class="row between"><span>Đã đem ra bàn:</span><b>' + esc(Engine.formatBeerCaseQty(curSum.broughtOutQty, cs, u)) + "</b></div>" +
                '<div class="row between mt-4"><span>Đang ghi trên bill:</span><b class="text-primary num">' + curSum.paidQty + " " + esc(u) + " (" + U.money(curSum.paidQty * curSum.price) + ")</b></div>" +
              "</div>" +
              '<div class="seg" style="display:grid;grid-template-columns:1fr 1fr;gap:6px">' +
                '<button type="button" class="' + (rb.mode === "return" ? "active" : "") + '" data-act="pg.retBeerMode" data-mode="return">Nhập số ' + esc(u) + " trả lại</button>" +
                '<button type="button" class="' + (rb.mode === "consumed" ? "active" : "") + '" data-act="pg.retBeerMode" data-mode="consumed">Nhập số ' + esc(u) + " đã uống</button>" +
              "</div>" +
              (rb.mode === "return"
                ? UI.field(
                    "Số " + u + " chưa khui khách trả lại (tối đa " + maxRet + " " + u + ")",
                    '<div class="chips mb-8" style="flex-wrap:wrap">' +
                      quickRets.map((q) => '<button type="button" class="chip ' + (retQ === q ? "active" : "") + '" data-act="pg.retBeerQuick" data-q="' + q + '">Trả ' + q + " " + esc(u) + (q === Math.round(cs / 2) ? " (nửa thùng)" : q === cs ? " (1 thùng)" : "") + "</button>").join("") +
                    "</div>" +
                    '<div class="row gap-8">' +
                      '<div class="stepper"><button type="button" data-act="pg.retBeerStep" data-d="-1">' + I("minus") + '</button><span class="num">' + retQ + " " + esc(u) + '</span><button type="button" data-act="pg.retBeerStep" data-d="1">' + I("plus") + "</button></div>" +
                      '<div class="grow">' + UI.input({ type: "number", min: 1, max: maxRet, model: "pg._retBeer.returnQty", live: true, value: retQ }) + "</div>" +
                    "</div>"
                  )
                : UI.field(
                    "Số " + u + " khách thực tế đã uống",
                    '<div class="row gap-8">' +
                      '<div class="stepper"><button type="button" data-act="pg.retBeerStep" data-d="-1">' + I("minus") + '</button><span class="num">' + consQ + " " + esc(u) + '</span><button type="button" data-act="pg.retBeerStep" data-d="1">' + I("plus") + "</button></div>" +
                      '<div class="grow">' + UI.input({ type: "number", min: 0, max: maxRet - 1, model: "pg._retBeer.consumedQty", live: true, value: consQ }) + "</div>" +
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
          UI.btn("Xác nhận trả bia dư", { act: "pg.retBeerSubmit", kind: "primary", size: "lg", icon: "check" }),
      });
    },
    "pg.retBeerMode": (d) => {
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
    "pg.retBeerQuick": (d) => {
      const rb = S()._retBeer;
      if (!rb) return;
      rb.mode = "return";
      rb.returnQty = Number(d.q) || 1;
      App.render();
    },
    "pg.retBeerStep": (d) => {
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
    "pg.retBeerSubmit": () => {
      const rb = S()._retBeer;
      if (!rb) return;
      const res = App.commit(
        () =>
          Engine.returnUnusedBeer(rb.ticketId, {
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
          r.unit
      );
      if (!res) return;
      App.closeModal(true);
      App.render();
    },
  });
})();
