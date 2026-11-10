/* =========================================================================
   Giao dien 4 - KIOSK BEP, BE CA, KHO NGUYEN LIEU VA TRAM CHAM CONG
   Route: #/kiosk
   Tab tren: Don bep & Be ca | Bao hong nguyen lieu | Nhap / Kiem kho | Cham cong
   - Quan ly chi tiet tung con ca trong be (ma ca + so kg chinh xac luc nhap)
   - Tinh toan so phan mon an co the lam voi luong nguyen lieu con lai
   - Cho phep bao hong / hao hut voi MOI loai nguyen lieu (Hai san be, Thit so che, Rau cu - Dau - Gia vi, Do uong)
   - Tuong thich moi thiet bi: May tinh, May tinh bang treo tuong, Dien thoai
   ========================================================================= */
(function () {
  const I = U.icon, esc = U.esc;
  const P = "kiosk";
  const newWaste = (kind) => ({
    kind: kind || "seafood", // seafood | meat | veg | drink
    ref: "",
    fishIds: [],
    count: 1,
    kg: 0,
    qty: 1,
    reason: "",
    note: "",
    photo: false,
    photoAt: 0,
  });
  const newReceipt = (type, supplier, lines) => ({
    supplier: supplier || "",
    type: type || "tank", // tank | meat | veg | drink
    ref: "",
    count: 1,
    kg: 0,
    qty: 1,
    lines: lines || [],
  });
  const S = () =>
    App.state(P, {
      tab: "",
      opId: "",
      sel: null,
      idle: false,
      stockView: "receive",
      blindMode: false,
      waste: newWaste(),
      rc: newReceipt(),
      cnt: { entries: {}, focus: null },
    });

  // Trang thai tam thoi (khong luu): luong cham cong, lop phu in tem, ban phim so
  const T = {
    success: null,
    successTimer: null,
    att: { phase: "pin", pin: "", error: "" },
    attTimer: null,
    pad: null,
    flash: {},
    scrollFocus: false,
  };
  let lastAct = Date.now();

  /* ---------- Tien ich ---------- */
  const cfg = () => Store.config;
  const D = () => Store.data;
  const decimals = () => (cfg().scale && cfg().scale.decimals !== undefined ? Number(cfg().scale.decimals) : 2);
  const fmtKg = (n) => U.num(n, decimals());
  const lateMs = () => (Number(cfg().floor && cfg().floor.weighLateMinutes) || 8) * 60000;
  const idleMs = () => App.portals[P].idleMs || (Number(cfg().kiosk && cfg().kiosk.idleSeconds) || 60) * 1000;
  const seafood = () => Engine.activeMenu((m) => m.kind === "seafood");
  const kitchenDishes = () => Engine.activeMenu((m) => m.kind === "kitchen");
  const meatBags = () => cfg().bags.filter((b) => b.group !== "veg");
  const vegBags = () => cfg().bags.filter((b) => b.group === "veg");
  const drinkItems = () => cfg().menu.filter((m) => m.active && D().drinks[m.id] !== undefined);
  const tankOf = (id) => {
    Engine.syncTank(id);
    return D().tank[id] || { count: 0, kg: 0, items: [] };
  };
  const countable = (m) => Engine.isCountableSeafood(m);
  const tankLabel = (m) => {
    const t = tankOf(m.id);
    return countable(m) ? t.count + " con / " + U.kg(t.kg) : U.kg(t.kg);
  };
  const today = () => U.dayKey();
  const roundKg = (v) => Math.round(v * Math.pow(10, decimals())) / Math.pow(10, decimals());

  function defaultTab(me) {
    return me && me.role === "cleaner" ? "clock" : "weigh";
  }
  function perm(me, p) {
    if (me && (me.role === "chef" || me.role === "tank" || me.role === "owner")) {
      if (p === "reportWaste" || p === "receiveGoods" || p === "blindCount") return true;
    }
    return Engine.can(me.role, p);
  }
  function canTab(me, tab) {
    if (tab === "clock") return true;
    if (me.role === "owner" || me.role === "tank" || me.role === "chef") return true;
    if (tab === "waste") return perm(me, "reportWaste");
    if (tab === "stock") return perm(me, "receiveGoods") || perm(me, "blindCount");
    return false;
  }
  function countLocked() {
    return !!(Engine.todayCount() && cfg().locks.blindCountLock);
  }
  function blindActive(me, st) {
    if (!me || !st) return false;
    const hasDraft = !!(st.cnt && st.cnt.entries && Object.keys(st.cnt.entries).length > 0);
    const inCountSession = !!(st.blindMode || (st.tab === "stock" && st.stockView === "count") || hasDraft);
    return inCountSession && canTab(me, "stock") && perm(me, "blindCount") && !countLocked();
  }

  function kbtn(label, act, o) {
    o = o || {};
    return '<button type="button" class="kbtn' + (o.kind ? " kbtn-" + o.kind : "") + (o.block ? " kbtn-block" : "") + (o.cls ? " " + o.cls : "") + '" data-act="' + act + '"' + UI.data(o.data) + (o.disabled ? " disabled" : "") + (o.id ? ' id="' + o.id + '"' : "") + ">" + (o.icon ? I(o.icon) : "") + "<span>" + esc(label) + "</span></button>";
  }
  const stepper = (act, v, extra) => '<div class="kstepper"><button type="button" data-act="' + act + '" data-d="-1" aria-label="Giảm">' + I("minus") + '</button><span class="kv">' + v + '</span><button type="button" data-act="' + act + '" data-d="1" aria-label="Tăng">' + I("plus") + "</button>" + (extra || "") + "</div>";
  const field = (label, html, cls) => '<div class="kx-field ' + (cls || "") + '"><label>' + esc(label) + "</label>" + html + "</div>";
  const kgField = (act, kg) => '<button type="button" class="kx-kgfield' + (kg > 0 ? "" : " empty") + '" data-act="' + act + '"><span class="kx-kg-val">' + (kg > 0 ? fmtKg(kg) : "0,00") + "</span><small>kg</small><span class=\"kx-kg-hint\">" + I("keyboard", "ic-sm") + "Chạm để nhập</span></button>";
  const step = (n, title, done, right) => '<div class="kx-step' + (done ? " done" : "") + '"><span class="kx-step-n">' + (done ? I("check", "ic-sm") : n) + "</span><h3>" + esc(title) + '</h3><span class="grow"></span>' + (right || "") + "</div>";

  function keyInto(cur, key, int) {
    cur = String(cur || "");
    if (key === "," || key === ".") {
      if (int) return cur;
      key = ",";
      if (!cur) return "0,";
    }
    if (/^\d$/.test(key) && cur.includes(",") && cur.split(",")[1].length >= decimals()) return cur;
    return UI.applyKey(cur, key, int ? 4 : 6);
  }

  /* ---------- Ban phim so lon (modal) ---------- */
  function numPad(o) {
    T.pad = { val: o.value > 0 ? String(o.value).replace(".", ",") : "", onDone: o.onDone, int: !!o.int, unit: o.unit || "kg", allowZero: !!o.allowZero };
    App.modal({
      title: o.title,
      sub: o.sub,
      size: "sm",
      onClose: () => {
        T.pad = null;
      },
      body: () => {
        const p = T.pad || { val: "", unit: o.unit || "kg" };
        return '<div class="kx-pad-display"><span>' + esc(p.val || "0") + "</span><small>" + esc(p.unit) + "</small></div>" + UI.numpad("kiosk.padKey", { left: o.int ? "clear" : ",", cls: "k-numpad" }) + (o.hint ? '<p class="kx-pad-hint">' + esc(o.hint) + "</p>" : "");
      },
      foot: () => UI.btn("Xóa", { act: "kiosk.padKey", data: { key: "clear" } }) + '<span class="spacer"></span>' + UI.btn("Hủy bỏ", { act: "app.closeModal" }) + UI.btn(o.okLabel || "Dùng số này", { act: "kiosk.padOk", kind: "primary" }),
    });
  }

  /* =====================================================================
     THANH TREN, THANH SO LIEU, DAI TON BE
     ===================================================================== */
  function topBar(me, st) {
    const q = Engine.kitchenQueue().length;
    const tab = (id, icon, label, extra) => {
      const locked = !canTab(me, id);
      return '<button type="button" class="kiosk-tab' + (st.tab === id ? " active" : "") + (id === "clock" ? " kt-clock" : "") + (locked ? " kx-locked" : "") + '" data-act="kiosk.tab" data-value="' + id + '">' + I(icon) + "<span>" + esc(label) + "</span>" + (locked ? '<span class="kx-tab-lock" title="Không thuộc vị trí của bạn">' + I("lock", "ic-sm") + "</span>" : extra || "") + "</button>";
    };
    const now = Date.now();
    return '<header class="kiosk-top">' +
      tab("weigh", "utensils", "Đơn bếp & Bể cá", UI.count(q)) +
      tab("waste", "trash-2", "Báo hỏng nguyên liệu") +
      tab("stock", "package", "Nhập / Kiểm kho") +
      '<button type="button" class="kx-operator" data-act="kiosk.switchOp" title="Đổi người thao tác">' + UI.avatar(me.name) +
      '<span class="kx-op-text"><span class="kx-op-label">Người thao tác</span><b class="truncate">' + esc(me.name) + '</b><span class="kx-op-switch">' + I("refresh-cw", "ic-sm") + "Đổi người</span></span></button>" +
      '<div class="kx-clock"><b class="num" data-tick="clock" data-ts="0">' + U.time(now) + "</b><span>" + esc(U.weekday(now)) + ", " + U.dateShort(now) + "</span></div>" +
      tab("clock", "clock", "Chấm công") +
      "</header>";
  }

  function kpis() {
    const w = cfg().widgets.kiosk || {};
    const cards = [];
    if (w.queue !== false) {
      const q = Engine.kitchenQueue();
      const old = q[0];
      cards.push(UI.kpi({
        label: "Món đang chế biến",
        icon: "flame",
        value: q.length + " món",
        meta: old ? "Bàn " + (old.table ? old.table.code : "--") + " · chờ " + UI.since(old.item.sentAt, "mmss") : "Bếp đã ra hết món",
        tone: old && old.waitMs > lateMs() ? "alert" : "",
        act: "kiosk.tab",
        data: { value: "weigh" },
      }));
    }
    if (w.tank !== false) {
      const list = seafood();
      const cnt = U.sum(list.filter(countable), (m) => tankOf(m.id).count);
      const kg = U.sum(list, (m) => tankOf(m.id).kg);
      cards.push(UI.kpi({ label: "Tồn cá sống trong bể", icon: "fish", value: cnt + " con", meta: U.kg(kg) + " · " + list.length + " loại hải sản (đã định danh kg)" }));
    }
    if (w.bags !== false) {
      const low = Engine.lowBags();
      const totalMaterials = cfg().bags.length;
      cards.push(UI.kpi({
        label: "Nguyên liệu bếp (" + totalMaterials + " loại)",
        icon: "box",
        value: low.length ? low.length + " sắp hết" : "Đủ định mức",
        meta: low.length ? low.slice(0, 2).map((b) => b.name).join(", ") + (low.length > 2 ? " +" + (low.length - 2) + " loại" : "") : "Thịt, hải sản, rau củ, đậu hũ đều đủ",
        tone: low.length ? "warn" : "good",
        act: "kiosk.tab",
        data: { value: "stock" },
      }));
    }
    if (w.waste !== false) {
      const pend = D().wastage.filter((x) => x.status === "pending");
      cards.push(UI.kpi({
        label: "Báo hỏng chờ duyệt",
        icon: "trash-2",
        value: pend.length + " phiếu",
        meta: pend.length ? "Giá trị " + U.money(U.sum(pend, (x) => x.amount)) : "Không có phiếu chờ",
        tone: pend.length ? "warn" : "",
        act: "kiosk.tab",
        data: { value: "waste" },
      }));
    }
    return cards.length ? '<div class="kx-kpis">' + cards.join("") + "</div>" : "";
  }

  function footer(me, st) {
    if (blindActive(me, st)) return '<footer class="kiosk-footer kx-footer kx-footer-blind">' + I("eye-off", "ic-sm") + "<span>Đang kiểm kho cuối ca: số tồn trên hệ thống được ẩn cho đến khi nộp kết quả.</span></footer>";
    const pr = Engine.printer("p_tank");
    const prOk = pr && pr.online;
    return '<footer class="kiosk-footer kx-footer"><span class="kx-ft-label">' + I("fish", "ic-sm") + "Tồn bể thực tế</span>" +
      seafood().map((m) => '<span class="kx-ft-item">' + esc(m.name) + " <b>" + tankLabel(m) + "</b></span>").join("") +
      '<span class="grow"></span>' +
      '<span class="kx-ft-dev ' + (prOk ? "ok" : "bad") + '"><i></i>' + I("printer", "ic-sm") + (prOk ? "Máy in bếp & hồ cá sẵn sàng" : "Máy in mất kết nối") + "</span>" +
      "</footer>";
  }

  function lockedPanel(me, title) {
    return '<div class="kx-calm kx-calm-lock"><span class="kx-calm-ic lock">' + I("lock") + "</span><h2>" + esc(title) + "</h2><p>Bạn đang thao tác với vị trí " + esc(Engine.roleLabel(me.role)) + ". Chạm Đổi người để người phụ trách thao tác, hoặc chấm công tại tab Chấm công.</p>" +
      '<div class="kx-calm-actions">' + kbtn("Đổi người thao tác", "kiosk.switchOp", { icon: "refresh-cw" }) + kbtn("Đi tới Chấm công", "kiosk.tab", { icon: "clock", kind: "primary", data: { value: "clock" } }) + "</div></div>";
  }

  /* =====================================================================
     TAB 1 - DON BEP, CHI TIET TUNG CON CA TRONG BE & NANG LUC CHE BIEN MON
     ===================================================================== */
  function weighView(me, st) {
    const q = Engine.kitchenQueue();
    const cur = q.find((x) => x.item.id === st.sel) || q[0] || null;
    if (cur) st.sel = cur.item.id;

    const queueHtml = q.length
      ? q.map((x) => {
          const late = x.waitMs > lateMs();
          const style = x.item.styleId ? Engine.style(x.item.styleId) : null;
          const isSea = x.menu.kind === "seafood" || x.item.kind === "seafood";
          const fishTxt = x.item.fishCodes && x.item.fishCodes.length
            ? x.item.fishCodes.join(", ")
            : isSea
              ? (x.item.count ? x.item.count + " con · " : "") + U.kg(x.item.kg)
              : "x" + (x.item.qty || 1) + " " + (x.menu.unit || "phần");
          const sub = [fishTxt, style && style.name, x.item.note].filter(Boolean).join(" · ");
          return '<button type="button" class="kq-item kx-q' + (cur && x.item.id === cur.item.id ? " active" : "") + (late ? " late" : "") + '" data-act="kiosk.pick" data-item="' + x.item.id + '" data-wsent="' + x.item.sentAt + '">' +
            '<span class="kq-table">' + esc(x.table ? x.table.code : "--") + "</span>" +
            '<span class="kx-q-main"><b class="truncate">' + esc(x.item.name) + '</b><span class="truncate">' + esc(sub) + "</span></span>" +
            '<span class="kx-q-right"><span class="kq-timer">' + UI.since(x.item.sentAt, "mmss") + '</span><span class="kx-q-late">Chờ lâu</span></span></button>';
        }).join("")
      : '<div class="kx-placeholder m-12">Tất cả các bàn đã ra đủ món. Chưa có phiếu chế biến mới.</div>';

    return '<div class="kiosk-body kx-weigh-body">' +
      '<aside class="kiosk-queue" data-keep-scroll="kq"><div class="kq-head"><span>Đơn bếp đang làm (' + q.length + ')</span><span class="kx-q-hint">Chọn món để ra món</span></div>' + queueHtml + "</aside>" +
      '<section class="kiosk-work kx-weigh" data-keep-scroll="kw">' +
      (cur ? activeKitchenOrderCard(cur) : "") +
      tankAndMenuCapacitySection() +
      "</section></div>";
  }

  function activeKitchenOrderCard(x) {
    const it = x.item, m = x.menu;
    const isSea = m.kind === "seafood" || it.kind === "seafood";
    const style = it.styleId ? Engine.style(it.styleId) : null;
    const waiter = x.ticket.waiterId ? Engine.staffName(x.ticket.waiterId) : "";
    const fishCodes = it.fishSummary ? it.fishSummary : it.fishCodes && it.fishCodes.length ? it.fishCodes.join(", ") : "";
    const qtyLabel = isSea
      ? (fishCodes ? (it.saleMode === "gram" ? "Cắt lẻ theo gram: " : "Mã cá xuất bể: ") + fishCodes : (it.count ? it.count + " con · " : "") + U.kg(it.kg))
      : "Số lượng: " + (it.qty || 1) + " " + (m.unit || "phần");

    return '<div class="card kx-order-focus mb-16">' +
      '<div class="kx-wh">' +
      '<div class="kx-wh-title"><span class="kx-wh-table">Bàn ' + esc(x.table ? x.table.code : "--") + "</span><span>" + esc(it.name) + "</span>" +
      (style ? '<span class="kx-dot-sep"></span><span class="kx-wh-style">' + esc(style.name) + "</span>" : "") +
      "</div>" +
      '<div class="kx-wh-meta">' +
      "<span>" + I("timer", "ic-sm") + "Chờ " + UI.since(it.sentAt, "mmss") + "</span>" +
      "<span>" + I(isSea ? "fish" : "utensils", "ic-sm") + "<b>" + esc(qtyLabel) + "</b></span>" +
      "<span>" + I("banknote", "ic-sm") + "Thành tiền: <b>" + U.money(Engine.itemAmount(it)) + "</b></span>" +
      (waiter ? "<span>" + I("user", "ic-sm") + "Phục vụ: " + esc(waiter) + "</span>" : "") +
      "</div></div>" +
      (it.note ? UI.banner("warning", "info", "<b>Ghi chú chế biến của bàn:</b> " + esc(it.note)) : "") +
      '<div class="row gap-12 wrap mt-8">' +
      kbtn("Hoàn tất chế biến · Báo phục vụ Ra món", "kiosk.serveItem", { kind: "primary", icon: "check", data: { ticket: x.ticket.id, item: it.id } }) +
      kbtn("In lại phiếu bếp / tem", "kiosk.reprintItem", { icon: "printer", data: { ticket: x.ticket.id, item: it.id } }) +
      "</div></div>";
  }

  function tankAndMenuCapacitySection() {
    const me = App.me();
    const st = S();
    if (blindActive(me, st)) {
      return '<div class="card card-pad" style="border:1px dashed var(--warning);background:var(--surface-2)">' +
        '<div class="row between wrap gap-12">' +
        '<div class="row gap-10" style="align-items:flex-start;flex:1;min-width:240px">' +
        '<span class="kx-calm-ic lock" style="width:42px;height:42px;flex-shrink:0">' + I("eye-off") + "</span>" +
        '<div><b>Đang trong phiên Kiểm kho cuối ca (Kiểm kho mù)</b>' +
        '<div class="small muted mt-4">Số lượng tồn bể hải sản (số con / số kg) và tồn nguyên liệu bếp đang được <b>ẩn trên toàn bộ các tab Kiosk</b> cho đến khi nộp kết quả kiểm kho cuối ca để chống nhìn số hệ thống.</div></div>' +
        "</div>" +
        '<div class="row gap-8 wrap">' +
        kbtn("Quay lại Kiểm kho cuối ca", "kiosk.resumeBlindCount", { kind: "primary", icon: "clipboard-check" }) +
        kbtn("Thoát chế độ kiểm kho mù", "kiosk.cancelBlindCount", { icon: "x" }) +
        "</div></div></div>";
    }
    const seaCards = seafood().map((m) => {
      const t = tankOf(m.id);
      const isCount = countable(m);
      const fishList = isCount ? Engine.tankFishList(m.id) : [];
      const fishBadges = isCount
        ? (fishList.length
            ? '<div class="mi-fish-pills mt-8">' + fishList.map((f) => '<span class="fish-pill"><b>' + esc(f.code) + "</b> · " + (f.partial ? "còn " + f.gram + "g (đang xẻ)" : U.num(f.kg, 2) + " kg") + "</span>").join("") + "</div>"
            : '<div class="small text-danger mt-8">Đã hết cá trong bể</div>')
        : '<div class="small muted mt-8">Tồn theo khối lượng tổng trong bể: <b>' + U.kg(t.kg) + "</b></div>";

      return '<div class="card kx-tank-card">' +
        '<div class="row between"><div class="kx-tank-name">' + I("fish", "ic-sm") + esc(m.name) + '</div><span class="badge badge-info">' + U.money(m.pricePerKg) + "/kg</span></div>" +
        '<div class="kx-tank-val">' + (isCount ? fishList.length + "<small>con</small> · " + U.num(t.kg, 2) + "<small>kg</small>" : U.num(t.kg, 2) + "<small>kg</small>") + "</div>" +
        fishBadges +
        '<div class="row gap-8 mt-8">' +
        '<button type="button" class="btn btn-sm" data-act="kiosk.quickReceiveSea" data-id="' + m.id + '">' + I("plus", "ic-xs") + " Nhập thêm</button>" +
        '<button type="button" class="btn btn-sm btn-danger" data-act="kiosk.quickWasteSea" data-id="' + m.id + '">' + I("trash-2", "ic-xs") + " Báo cá chết</button>" +
        "</div></div>";
    }).join("");

    const dishCards = kitchenDishes().map((m) => {
      const av = Engine.menuAvailability(m.id);
      const toneCls = av.tone === "danger" ? "text-danger" : av.tone === "warning" ? "text-warning" : "text-success";
      const bomTxt = (m.bom || []).map((b) => {
        const bag = Engine.bag(b.bagId);
        const rem = D().stock[b.bagId] || 0;
        return bag ? bag.name + " (còn " + rem + " " + (bag.unit || "túi") + ")" : "";
      }).filter(Boolean).join(" + ");

      return '<div class="card kx-dish-cap">' +
        '<div class="row between"><b>' + esc(m.name) + '</b><span class="num strong ' + toneCls + '">' + esc(av.maxPortions + " " + (m.unit || "phần")) + "</span></div>" +
        '<div class="small muted mt-4">Nguyên liệu: ' + esc(bomTxt || "Sẵn sàng") + "</div>" +
        '<div class="row between mt-8"><span class="small ' + toneCls + '">' + esc(av.label) + "</span>" +
        '<button type="button" class="btn btn-sm" data-act="kiosk.quickWasteDish" data-id="' + m.id + '">Báo hỏng NL</button></div>' +
        "</div>";
    }).join("");

    return '<div class="kx-section-title">1. Số liệu từng con cá / hải sản sống hiện còn trong bể (đã cân lúc nhập)</div>' +
      '<div class="kx-tank-grid mb-16">' + seaCards + "</div>" +
      '<div class="kx-section-title">2. Số phần món ăn có thể làm với lượng nguyên liệu còn lại trong bếp</div>' +
      '<div class="kx-dish-grid">' + dishCards + "</div>";
  }

  function successOverlay() {
    const s = T.success;
    if (!s) return "";
    const tags = (s.tagIds || []).map((id) => D().printLog.find((p) => p.id === id)).filter(Boolean);
    return '<div class="kx-overlay" data-act="kiosk.closeSuccess"><div class="kx-success" role="dialog" aria-live="polite">' +
      '<div class="kx-success-head"><span class="kx-success-ic">' + I("circle-check") + "</span><div><h2>" + esc(s.title || "Đã hoàn tất") + "</h2><p>" + esc(s.sub || "") + "</p></div></div>" +
      (tags.length ? '<div class="kx-tags">' + tags.map((t) => '<div class="kx-tag">' + UI.receipt(t) + "</div>").join("") + "</div>" : "") +
      '<div class="kx-success-foot"><span>Màn hình tự đóng sau vài giây.</span>' + kbtn("Đóng", "kiosk.closeSuccess", { kind: "primary", icon: "check" }) + "</div>" +
      '<div class="kx-autobar"><span></span></div>' +
      "</div></div>";
  }

  /* =====================================================================
     TAB 2 - BAO HONG / HAO HUT MOI LOAI NGUYEN LIEU TRONG BEP & BE CA
     ===================================================================== */
  const REASONS = ["Chết / yếu trong bể", "Hư hỏng, ôi, dập úng", "Rơi vỡ / đổ hỏng", "Hết hạn sử dụng"];

  function wasteListByKind(kind) {
    if (kind === "seafood") return seafood();
    if (kind === "meat") return meatBags();
    if (kind === "veg") return vegBags();
    if (kind === "drink") return drinkItems();
    return cfg().bags;
  }

  function wasteItem(w) {
    if (!w.ref) return null;
    if (w.kind === "seafood" || w.kind === "drink") return Engine.menu(w.ref);
    return Engine.bag(w.ref);
  }

  function wasteValue(w) {
    const x = wasteItem(w);
    if (!x) return 0;
    if (w.kind === "seafood") return Math.round((Number(w.kg) || 0) * (x.costPerKg || 0));
    return (Number(w.qty) || 0) * (x.cost || 0);
  }

  function wasteMissing(w) {
    const miss = [];
    if (!w.ref) miss.push("nguyên liệu bị hỏng");
    else if (w.kind === "seafood" ? !(w.kg > 0) : !(w.qty > 0)) miss.push(w.kind === "seafood" ? "con cá hoặc khối lượng" : "số lượng hỏng");
    if (!w.reason && (w.note || "").trim().length < 3) miss.push("lý do hỏng");
    if (!w.photo) miss.push("ảnh bằng chứng");
    return miss;
  }

  function wasteView(me, st) {
    const w = st.waste;
    const isSea = w.kind === "seafood";
    const items = wasteListByKind(w.kind);
    const sel = wasteItem(w);

    const isBlind = blindActive(me, st);
    const grid = items.map((x) => {
      let sub = "";
      if (isBlind) {
        sub = "Tồn đang ẩn (kiểm kho mù) · Vốn " + (isSea ? U.money(x.costPerKg) + "/kg" : U.money(x.cost || 0));
      } else if (isSea) {
        const t = tankOf(x.id);
        sub = (countable(x) ? t.count + " con · " + U.kg(t.kg) : "Còn " + U.kg(t.kg)) + " · Vốn " + U.money(x.costPerKg) + "/kg";
      } else if (w.kind === "drink") {
        sub = "Tồn: " + (D().drinks[x.id] || 0) + " " + (x.unit || "đơn vị") + " · Vốn " + U.money(x.cost || 0);
      } else {
        const rem = D().stock[x.id] || 0;
        sub = "Tồn: " + rem + " " + (x.unit || "túi") + " (" + x.gram + "g) · Vốn " + U.money(x.cost || 0);
      }
      return '<button type="button" class="k-card' + (w.ref === x.id ? " active" : "") + '" data-act="kiosk.wItem" data-id="' + x.id + '"><b>' + esc(x.name) + "</b><span>" + esc(sub) + "</span></button>";
    }).join("");

    let qtyHtml = "";
    if (!sel) {
      qtyHtml = '<div class="kx-placeholder">Chọn nguyên liệu bị hỏng ở bước 1 (mọi nguyên liệu Hải sản, Thịt sơ chế, Rau củ - Đậu - Gia vị, Đồ uống đều có thể báo hỏng)</div>';
    } else if (isSea) {
      const isCount = countable(sel);
      const fishList = isCount && !isBlind ? Engine.tankFishList(sel.id) : [];
      const selIds = Array.isArray(w.fishIds) ? w.fishIds : [];
      const fishPicker = isCount && fishList.length
        ? '<div class="mb-12"><div class="small muted mb-8">Chạm trực tiếp vào mã con cá bị chết / hỏng trong bể (tự động lấy đúng số kg lúc nhập):</div>' +
          '<div class="fish-pick-grid">' +
          fishList.map((f) => {
            const active = selIds.includes(f.id);
            return '<button type="button" class="fish-pick-card' + (active ? " active" : "") + '" data-act="kiosk.wToggleFish" data-fish="' + esc(f.id) + '">' +
              '<div class="fpc-head"><b>' + esc(f.code) + '</b>' + (active ? '<span class="fpc-check">' + I("check", "ic-xs") + " Chọn báo hỏng</span>" : '<span class="fpc-avail">Trong bể</span>') + "</div>" +
              '<div class="fpc-kg num">' + U.num(f.kg, 2) + " <small>kg</small></div>" +
              '<div class="fpc-price num">Vốn ' + U.money(Math.round(f.kg * (sel.costPerKg || 0))) + "</div></button>";
          }).join("") +
          "</div></div>"
        : "";
      qtyHtml = fishPicker +
        '<div class="kx-qty-row">' +
        (isCount ? field("Số con hỏng", stepper("kiosk.wCount", w.count)) : "") +
        field("Khối lượng hao hụt (kg)", '<div class="kx-inline">' + kgField("kiosk.wKg", w.kg) + "</div>") +
        "</div>";
    } else {
      const unitLabel = w.kind === "drink" ? (sel.unit || "lon/chai") : (sel.unit || "túi/phần");
      const affectedDishes = w.kind !== "drink" && !isBlind
        ? cfg().menu.filter((m) => m.active && Array.isArray(m.bom) && m.bom.some((b) => b.bagId === sel.id)).map((m) => m.name + " (" + Engine.menuAvailability(m.id).label + ")").join(", ")
        : "";
      qtyHtml = '<div class="kx-qty-row">' +
        field("Số " + unitLabel + " bị hỏng / hủy", stepper("kiosk.wQty", w.qty)) +
        (affectedDishes ? '<div class="kx-field"><label>Món ăn dùng nguyên liệu này</label><div class="small muted">' + esc(affectedDishes) + "</div></div>" : "") +
        "</div>";
    }

    const reasonOk = !!w.reason || (w.note || "").trim().length >= 3;
    const reasons = '<div class="kx-chips">' + REASONS.map((r) => '<button type="button" class="kx-chip' + (w.reason === r ? " active" : "") + '" data-act="kiosk.wReason" data-v="' + esc(r) + '">' + esc(r) + "</button>").join("") + "</div>" +
      UI.input({ id: "kx-w-note", model: "kiosk.waste.note", value: w.note, placeholder: "Ghi chú chi tiết tình trạng nguyên liệu hỏng...", cls: "kx-input", live: true });

    const camText = isSea ? "Chụp rõ con cá / hải sản bị hỏng" : "Chụp rõ nguyên liệu / thực phẩm bị hỏng";
    const cam = w.photo
      ? (w.photoUrl
          ? '<div class="camera-sim kx-cam-done" style="padding:8px"><img src="' + esc(w.photoUrl) + '" alt="Ảnh bằng chứng" style="max-height:130px;border-radius:8px;object-fit:contain"><span>Đã đính kèm ảnh lúc ' + U.time(w.photoAt) + "</span></div>"
          : '<div class="camera-sim kx-cam-done">' + I("circle-check", "ic-2xl") + "<span>Đã chụp ảnh bằng chứng lúc " + U.time(w.photoAt) + "</span></div>")
      : UI.cameraSim({ flash: !!T.flash.waste, text: camText });
    const value = wasteValue(w);
    const auto = Number(cfg().inventory.wasteAutoApproveUnder) || 0;
    const miss = wasteMissing(w);

    const todayList = D().wastage.filter((x) => U.dayKey(x.at) === today());
    const ST = { pending: ["Chờ duyệt", "warning"], approved: ["Đã duyệt", "success"], rejected: ["Từ chối", "danger"] };
    const list = todayList.length
      ? '<div class="kx-list">' + todayList.map((x) => {
          const itemObj = x.menuId ? Engine.menu(x.menuId) : Engine.bag(x.bagId);
          const name = (itemObj && itemObj.name) || "Nguyên liệu";
          const det = x.kind === "seafood"
            ? (x.count ? x.count + " con · " : "") + U.kg(x.kg)
            : x.qty + " " + ((itemObj && itemObj.unit) || "túi");
          const s = ST[x.status] || [x.status, ""];
          return '<div class="kx-li"><span class="photo-thumb">' + I("image", "ic-sm") + '</span><div class="kx-li-main"><b>' + esc(name) + " · " + esc(det) + '</b><div class="kx-li-meta">' + esc(x.reason) + '</div><div class="kx-li-meta">' + U.time(x.at) + " · " + esc(Engine.staffName(x.by)) + '</div></div><div class="kx-li-side"><span class="kx-li-amt">' + U.money(x.amount) + "</span>" + UI.badge(s[0], s[1], true) + "</div></div>";
        }).join("") + "</div>"
      : '<div class="kx-placeholder">Chưa có báo cáo nguyên liệu hỏng nào trong hôm nay</div>';

    const kindSeg = UI.seg([
      { value: "seafood", label: "Hải sản bể" },
      { value: "meat", label: "Thịt & Sơ chế" },
      { value: "veg", label: "Rau củ · Đậu · Gia vị" },
      { value: "drink", label: "Đồ uống vỡ/hỏng" },
    ], w.kind, "kiosk.wKind");

    return '<div class="kiosk-body kx-split">' +
      '<section class="kx-pane" data-keep-scroll="kwl">' +
      step(1, "Chọn nhóm & nguyên liệu bị hỏng", !!sel, kindSeg) +
      '<div class="k-grid">' + grid + "</div>" +
      step(2, isSea ? "Chọn con cá hỏng / khối lượng" : "Số lượng nguyên liệu hỏng", !!sel && (isSea ? w.kg > 0 : w.qty > 0)) + qtyHtml +
      step(3, "Nguyên nhân hỏng / hao hụt", reasonOk) + reasons +
      "</section>" +
      '<section class="kx-pane kx-pane-side" data-keep-scroll="kwr">' +
      step(4, "Ảnh bằng chứng (bắt buộc)", !!w.photo) +
      '<div class="kx-cam">' + cam + "</div>" +
      '<div class="row gap-8">' +
      kbtn(w.photo ? "Chụp lại nhanh" : "Chụp nhanh Kiosk", "kiosk.wPhoto", { icon: "camera", cls: "grow", disabled: !!T.flash.waste }) +
      '<label class="kbtn grow" style="cursor:pointer">' + I("upload") + '<span>Tải ảnh / Camera</span><input type="file" accept="image/*" capture="environment" data-change="kiosk.wPhotoFile" class="hidden"></label>' +
      "</div>" +
      '<div class="kx-value"><div><span>Giá trị nguyên liệu hỏng (theo giá vốn)</span><small>' + (value && value <= auto ? "Dưới ngưỡng tự duyệt (" + U.money(auto) + ") · Trừ tồn ngay" : "Trừ tồn kho ngay · Gửi Chủ quán duyệt") + "</small></div><b>" + U.money(value) + "</b></div>" +
      kbtn("Ghi nhận hỏng & Trừ tồn nguyên liệu", "kiosk.wSubmit", { kind: "primary", block: true, icon: "send", disabled: miss.length > 0 }) +
      (miss.length ? '<div class="kx-missing">Còn thiếu: ' + esc(miss.join(", ")) + "</div>" : '<div class="kx-hint">Hệ thống tự động cập nhật lại số phần món ăn có thể làm ngay sau khi gửi.</div>') +
      '<div class="kx-section-title mt-8">Báo cáo hôm nay (' + todayList.length + ")</div>" + list +
      "</section></div>";
  }

  /* =====================================================================
     TAB 3 - NHAP / KIEM KHO TOAN BO NGUYEN LIEU
     ===================================================================== */
  function stockView(me, st) {
    const seg = '<div class="kx-subnav">' + UI.seg([{ value: "receive", label: "Nhập hàng & Cá mới vào bể" }, { value: "count", label: "Kiểm kho cuối ca" }], st.stockView, "kiosk.stockView") +
      '<span class="kx-subnav-note">' + (st.stockView === "receive" ? I("users", "ic-sm") + "Hai người cùng kiểm, nhập cá tự động đánh mã từng con và kg" : I("eye-off", "ic-sm") + "Chỉ nhập số đếm thực tế, nộp xong là khóa") + "</span></div>";
    let inner;
    if (st.stockView === "count") inner = perm(me, "blindCount") ? countView(me, st) : '<div class="kx-center-pane">' + lockedPanel(me, "Kiểm kho dành cho Bếp & Hồ cá") + "</div>";
    else inner = perm(me, "receiveGoods") ? receiveView(me, st) : '<div class="kx-center-pane">' + lockedPanel(me, "Nhập hàng dành cho Bếp & Hồ cá") + "</div>";
    return '<div class="kiosk-body single kx-stock">' + seg + inner + "</div>";
  }

  function rcStoreType(uiType) {
    return uiType === "meat" || uiType === "veg" ? "bag" : uiType;
  }
  function rcRef(type, ref) {
    return type === "bag" || type === "meat" || type === "veg" ? Engine.bag(ref) : Engine.menu(ref);
  }
  function rcLineCost(l) {
    const x = rcRef(l.type, l.ref) || {};
    if (l.type === "tank") return Math.round((Number(l.kg) || 0) * (x.costPerKg || 0));
    return (Number(l.qty) || 0) * (x.cost || 0);
  }
  function rcLineText(l) {
    const x = rcRef(l.type, l.ref) || {};
    if (l.type === "tank") return (l.count ? l.count + " con · " : "") + U.kg(l.kg);
    return l.qty + " " + (x.unit || (l.type === "bag" ? "túi" : "đơn vị"));
  }

  function receiveView(me, st) {
    const r = st.rc;
    const suppliers = [];
    D().receipts.forEach((x) => { if (x.supplier && !suppliers.includes(x.supplier)) suppliers.push(x.supplier); });
    const isBlind = blindActive(me, st);
    const items = r.type === "tank" ? seafood() : r.type === "meat" ? meatBags() : r.type === "veg" ? vegBags() : drinkItems();
    const grid = items.map((x) => {
      const sub = isBlind
        ? "Tồn đang ẩn (kiểm kho mù)"
        : r.type === "tank"
        ? "Đang còn " + tankLabel(x) + " · Vốn " + U.money(x.costPerKg) + "/kg"
        : r.type === "drink"
          ? "Tồn " + (D().drinks[x.id] || 0) + " " + (x.unit || "") + (x.caseSize ? " · thùng " + x.caseSize : "")
          : "Tồn " + (D().stock[x.id] || 0) + " " + (x.unit || "túi") + " (" + x.gram + "g)";
      const inPhieu = r.lines.some((l) => l.ref === x.id);
      return '<button type="button" class="k-card kx-card-sm' + (r.ref === x.id ? " active" : "") + '" data-act="kiosk.rcItem" data-id="' + x.id + '"><b>' + esc(x.name) + "</b><span>" + esc(sub) + "</span>" + (inPhieu ? '<em class="kx-card-tag">' + I("check", "ic-sm") + "Đã có trong phiếu</em>" : "") + "</button>";
    }).join("");
    const sel = r.ref ? rcRef(r.type, r.ref) : null;
    let editor = "";
    if (sel) {
      const isT = r.type === "tank";
      const valid = isT ? r.kg > 0 : r.qty > 0;
      const quick = !isT ? (r.type === "drink" && sel.caseSize ? kbtn("+1 thùng (" + sel.caseSize + ")", "kiosk.rcQty", { data: { d: sel.caseSize } }) : kbtn("+5 " + (sel.unit || "túi"), "kiosk.rcQty", { data: { d: 5 } })) : "";
      editor = '<div class="kx-editor"><div class="kx-editor-head">' + I("package", "ic-sm") + esc(sel.name) + "</div>" +
        '<div class="kx-qty-row">' +
        (isT
          ? (countable(sel) ? field("Số con cá nhập vào bể", stepper("kiosk.rcCount", r.count)) : "") +
            field("Tổng khối lượng cân lúc nhập (kg)", kgField("kiosk.rcKg", r.kg))
          : field("Số " + (sel.unit || "túi/đơn vị") + " thực nhận", '<div class="kx-inline">' + stepper("kiosk.rcQty", r.qty) + quick + "</div>")) +
        "</div>" +
        kbtn("Thêm vào phiếu nhập", "kiosk.rcAdd", { icon: "plus", cls: "kx-kbtn-accent", disabled: !valid }) +
        "</div>";
    } else {
      editor = '<div class="kx-placeholder">Chạm vào mặt hàng để nhập số lượng và số kg thực nhận</div>';
    }

    const lines = r.lines.length
      ? '<div class="kx-list">' + r.lines.map((l, i) => {
          const x = rcRef(l.type, l.ref) || {};
          return '<div class="kx-li kx-li-center"><div class="kx-li-main"><b>' + esc(x.name || "") + '</b><div class="kx-li-meta">' + esc(rcLineText(l)) + '</div></div><span class="kx-li-amt">' + U.money(rcLineCost(l)) + '</span><button type="button" class="kx-iconbtn" data-act="kiosk.rcRemove" data-i="' + i + '" title="Xóa dòng" aria-label="Xóa dòng">' + I("trash-2") + "</button></div>";
        }).join("") + "</div>"
      : '<div class="kx-placeholder">Phiếu nhập chưa có dòng hàng nào</div>';
    const total = U.sum(r.lines, rcLineCost);

    const todayRc = D().receipts.filter((x) => x.dayKey === today());
    const rcList = todayRc.length
      ? '<div class="kx-list">' + todayRc.map((x) => '<div class="kx-li"><span class="kx-li-ic">' + I("truck", "ic-sm") + '</span><div class="kx-li-main"><b>' + esc(x.supplier) + '</b><div class="kx-li-meta">' + esc(x.lines.map((l) => l.name + " " + rcLineText(l)).join(", ")) + '</div><div class="kx-li-meta">' + U.time(x.at) + " · nhận " + esc(Engine.staffName(x.by)) + " · kiểm " + esc(Engine.staffName(x.witness)) + '</div></div><div class="kx-li-side"><span class="kx-li-amt">' + U.money(x.total) + "</span>" + UI.badge("Đã nhập kho", "success", true) + "</div></div>").join("") + "</div>"
      : '<div class="kx-placeholder">Chưa có phiếu nhập nào trong hôm nay</div>';

    const typeSeg = UI.seg([
      { value: "tank", label: "Hải sản bể" },
      { value: "meat", label: "Thịt & Sơ chế" },
      { value: "veg", label: "Rau củ · Đậu" },
      { value: "drink", label: "Bia · Nước" },
    ], r.type, "kiosk.rcType");

    return '<div class="kx-split">' +
      '<section class="kx-pane" data-keep-scroll="krl">' +
      step(1, "Nhà cung cấp", !!(r.supplier || "").trim()) +
      UI.input({ id: "kx-rc-supplier", model: "kiosk.rc.supplier", value: r.supplier, placeholder: "Tên nhà cung cấp, ví dụ: Vựa hải sản Năm Căn / Chợ đầu mối", cls: "kx-input" }) +
      (suppliers.length ? '<div class="kx-chips">' + suppliers.slice(0, 5).map((s) => '<button type="button" class="kx-chip kx-chip-sm' + (r.supplier === s ? " active" : "") + '" data-act="kiosk.rcSupplier" data-v="' + esc(s) + '">' + I("history", "ic-sm") + esc(s) + "</button>").join("") + "</div>" : "") +
      step(2, "Mặt hàng thực nhận", r.lines.length > 0, typeSeg) +
      '<div class="k-grid kx-grid-sm">' + grid + "</div>" + editor +
      "</section>" +
      '<section class="kx-pane kx-pane-side" data-keep-scroll="krr">' +
      '<div class="kx-step"><span class="kx-step-n">3</span><h3>Phiếu nhập hàng</h3><span class="grow"></span><span class="kx-step-meta">' + r.lines.length + " dòng</span></div>" +
      lines +
      '<div class="kx-value"><div><span>Tổng giá trị theo giá vốn</span><small>Người nhận: ' + esc(me.name) + "</small></div><b>" + U.money(total) + "</b></div>" +
      kbtn("Xác nhận nhập kho", "kiosk.rcConfirm", { kind: "primary", block: true, icon: "user-check", disabled: !r.lines.length }) +
      '<div class="kx-hint">Người kiểm thứ hai nhập mã PIN để cùng xác nhận số thực nhận</div>' +
      '<div class="kx-section-title mt-8">Đã nhập hôm nay (' + todayRc.length + ")</div>" + rcList +
      "</section></div>";
  }

  // ---- Kiem kho cuoi ca (kiem mu) ----
  const GROUPS = [
    { key: "tank", filter: (s) => s.type === "tank", title: "1. Hồ hải sản sống", help: "Đếm số con và cân tổng khối lượng từng loại" },
    { key: "meat", filter: (s) => s.type === "bag" && s.group !== "veg", title: "2. Thịt, Hải sản & Cốt lẩu sơ chế", help: "Đếm số túi/nồi định lượng còn trong tủ mát & tủ đông" },
    { key: "veg", filter: (s) => s.type === "bag" && s.group === "veg", title: "3. Rau củ, Đậu hũ & Phụ liệu tươi", help: "Đếm số hộp, rổ, bó còn sử dụng tốt" },
    { key: "drink", filter: (s) => s.type === "drink", title: "4. Bia, Rượu & Nước giải khát", help: "Đếm số lon, chai còn nguyên" },
  ];
  function countFields() {
    const out = [];
    Engine.countSheet().forEach((s) => {
      if (s.type === "tank") {
        const m = Engine.menu(s.ref);
        if (countable(m)) out.push({ ref: s.ref, field: "count", name: s.name, label: "Số con", unit: "con" });
        out.push({ ref: s.ref, field: "kg", name: s.name, label: "Khối lượng", unit: "kg" });
      } else out.push({ ref: s.ref, field: "qty", name: s.name, label: "Số lượng", unit: s.unit || (s.type === "bag" ? "túi" : "đơn vị") });
    });
    return out;
  }
  const filled = (entries, f) => {
    const e = entries[f.ref];
    return !!e && e[f.field] !== undefined && e[f.field] !== "";
  };
  function curFocus(fields, c) {
    const f = c.focus && fields.find((x) => x.ref === c.focus.ref && x.field === c.focus.field);
    return f || fields.find((x) => !filled(c.entries, x)) || fields[0];
  }

  function countView(me, st) {
    const done = Engine.todayCount();
    if (done && cfg().locks.blindCountLock) {
      return '<div class="kx-center-pane"><div class="kx-calm kx-calm-lock"><span class="kx-calm-ic lock">' + I("lock") + "</span>" +
        "<h2>Đã nộp kết quả lúc " + U.time(done.at) + " - đã khóa</h2>" +
        "<p>Kết quả kiểm kho cuối ca đã gửi Chủ quán đối soát và không thể sửa sau khi nộp. Nếu phát hiện đếm nhầm, báo trực tiếp Chủ quán.</p>" +
        '<div class="kx-lock-meta"><span>' + I("user", "ic-sm") + "Người kiểm: " + esc(Engine.staffName(done.by)) + "</span><span>" + I("calendar", "ic-sm") + "Ngày " + U.dayLabel(done.dayKey) + "</span><span>" + I("list-checks", "ic-sm") + (done.lines || []).length + " mục đã đếm</span></div></div></div>";
    }
    const c = st.cnt;
    const fields = countFields();
    const f = curFocus(fields, c);
    const sheet = Engine.countSheet();
    const lineDone = (ref) => fields.filter((x) => x.ref === ref).every((x) => filled(c.entries, x));
    const doneLines = sheet.filter((s) => lineDone(s.ref)).length;
    const pct = sheet.length ? (doneLines / sheet.length) * 100 : 0;
    const allDone = doneLines === sheet.length;

    const cell = (x) => {
      const isF = f && f.ref === x.ref && f.field === x.field;
      const has = filled(c.entries, x);
      const v = has ? c.entries[x.ref][x.field] : "--";
      return '<button type="button" class="kx-cell' + (isF ? " focus" : "") + (has ? " filled" : "") + '" data-act="kiosk.cFocus" data-ref="' + x.ref + '" data-field="' + x.field + '"><span class="kx-cell-label">' + esc(x.label) + '</span><span class="kx-cell-val">' + esc(v) + '</span><span class="kx-cell-unit">' + esc(x.unit) + "</span></button>";
    };
    const groups = GROUPS.map((g) => {
      const rows = sheet.filter(g.filter);
      if (!rows.length) return "";
      const gDone = rows.filter((s) => lineDone(s.ref)).length;
      return '<div class="kx-cgroup"><div class="kx-cgroup-head"><div><h3>' + esc(g.title) + "</h3><span>" + esc(g.help) + '</span></div><span class="kx-cgroup-count">' + gDone + "/" + rows.length + "</span></div>" +
        rows.map((s) => {
          const ok = lineDone(s.ref);
          const fs = fields.filter((x) => x.ref === s.ref);
          const m = s.type === "tank" ? Engine.menu(s.ref) : null;
          return '<div class="kx-crow' + (ok ? " done" : "") + (f && f.ref === s.ref ? " current" : "") + '"><span class="kx-crow-st">' + (ok ? I("check", "ic-sm") : "") + '</span><div class="kx-crow-name"><b>' + esc(s.name) + "</b><span>" + esc(s.type === "tank" ? (countable(m) ? "Đếm con và cân kg" : "Chỉ cân kg") : "Đơn vị: " + (s.unit || "túi")) + "</span></div>" +
            (s.type === "tank" && !countable(m) ? '<span class="kx-cell kx-cell-skip">Không đếm con</span>' : "") + fs.map(cell).join("") + "</div>";
        }).join("") + "</div>";
    }).join("");

    const cur = f ? (c.entries[f.ref] || {})[f.field] || "" : "";
    const pad = f
      ? '<aside class="kx-cpad" data-keep-scroll="kcp"><div class="kx-cpad-label">' + esc(f.name) + '</div><div class="kx-cpad-field">' + esc(f.label) + " thực tế đếm được</div>" +
        '<div class="kx-cpad-val' + (cur === "" ? " empty" : "") + '"><span>' + esc(cur === "" ? "0" : cur) + "</span><small>" + esc(f.unit) + "</small></div>" +
        UI.numpad("kiosk.cKey", { left: f.field === "kg" ? "," : "clear", cls: "k-numpad kx-cpad-np" }) +
        '<div class="kx-cpad-actions">' + kbtn("Xóa ô", "kiosk.cKey", { data: { key: "clear" } }) + kbtn("Mục tiếp theo", "kiosk.cNext", { icon: "arrow-right", cls: "kx-kbtn-accent" }) + "</div></aside>"
      : "";

    return '<div class="kx-split kx-count">' +
      '<section class="kx-pane" data-keep-scroll="kcl">' +
      (done ? UI.banner("info", "info", "Đã nộp một lần lúc " + U.time(done.at) + ". Khóa kết quả kiểm kho đang tắt nên có thể kiểm lại.") : "") +
      '<div class="kx-cprog card"><div class="kx-cprog-text"><b>Đã nhập ' + doneLines + "/" + sheet.length + " mục</b><span>Hệ thống không hiển thị số tồn. Đếm và nhập đúng số thực tế, mục hết hàng nhập 0.</span>" + UI.progress(pct, allDone ? "success" : "") + "</div>" +
      kbtn("Nộp kết quả kiểm kho", "kiosk.cSubmit", { kind: "primary", icon: "lock", disabled: !allDone }) + "</div>" +
      groups + "</section>" + pad + "</div>";
  }

  /* =====================================================================
     TAB 4 - CHAM CONG (tram chung, doc lap voi nguoi thao tac)
     ===================================================================== */
  function resetAtt() {
    clearTimeout(T.attTimer);
    T.att = { phase: "pin", pin: "", error: "" };
  }
  function pinPhase(a) {
    return '<div class="kx-pin">' +
      '<div class="kx-pin-head"><span class="kx-pin-ic">' + I("clock") + "</span><h2>Chấm công</h2><p>Nhập mã PIN 4 số của bạn. Camera tự chụp ảnh xác thực trong 1 giây.</p></div>" +
      UI.pinDots(a.pin.length, !!a.error) +
      '<div class="kx-pin-msg">' + (a.error ? '<span class="text-danger">' + esc(a.error) + "</span>" : "Dùng chung cho mọi vị trí: bếp, hồ cá, vệ sinh, phục vụ") + "</div>" +
      UI.numpad("kiosk.pin", { cls: "k-numpad kx-pin-pad" }) + "</div>";
  }
  function cameraPhase(a) {
    const s = Engine.staff(a.staffId) || {};
    return '<div class="kx-camphase"><h2>Xin chào, ' + esc(s.name || "") + '</h2><p class="kx-camphase-sub">' + esc(Engine.roleLabel(s.role)) + " · Nhìn thẳng vào camera, giữ yên trong giây lát</p>" +
      '<div class="camera-sim kx-selfie' + (a.flash ? " flash" : "") + '"><span class="kx-face"></span><span class="kx-selfie-txt">' + I("camera", "ic-sm") + (a.flash ? "Đã chụp" : "Đang chụp ảnh xác thực...") + '</span><span class="kx-selfie-bar"></span></div></div>';
  }
  function resultPhase(a) {
    const s = Engine.staff(a.staffId);
    if (!s) return pinPhase(a);
    const r = a.result;
    const cfgA = cfg().attendance;
    const sh = Engine.shiftDef(s.shiftId);
    const seg = sh && !r.offSchedule ? sh.segments[r.seg] : null;
    const isIn = a.type === "in";
    let notes = "";
    if (seg) notes += '<div class="kx-res-shift">' + I("calendar-clock", "ic-sm") + esc(sh.name) + (sh.segments.length > 1 ? " · đoạn " + (r.seg + 1) + "/" + sh.segments.length : "") + " · " + seg.start + " - " + seg.end + "</div>";
    if (isIn) {
      if (r.offSchedule) notes += UI.banner("info", "info", "Ngoài lịch ca đã đăng ký. Giờ công được ghi nhận để Chủ quán xem xét.");
      else if (r.penalty) notes += UI.banner("danger", "triangle-alert", "<b>Đi trễ " + r.lateMin + " phút</b> · phạt " + U.money(r.penalty) + " theo quy định của quán");
      else if (r.lateMin > 0) notes += UI.banner("warning", "timer", "Trễ " + r.lateMin + " phút, vẫn trong " + cfgA.graceMinutes + " phút cho phép");
      else notes += UI.banner("success", "circle-check", "<b>Đúng giờ.</b> Chúc một ca làm việc thuận lợi.");
    } else {
      notes += UI.banner("success", "circle-check", "Đã làm <b>" + U.duration(r.at - r.inAt) + "</b> trong lượt này. Cảm ơn bạn.");
      if (r.otAutoMin) notes += UI.banner("info", "clock", "Tăng ca được tính tự động: " + r.otAutoMin + " phút");
      if (r.otPendingMin) notes += UI.banner("warning", "hourglass", "<b>" + r.otPendingMin + " phút tăng ca</b> vượt giới hạn sau bàn cuối, đang chờ Chủ quán duyệt");
    }
    const punches = Engine.attOfDay(s.id).slice().sort((x, y) => x.in - y.in);
    const pTxt = punches.map((p) => U.time(p.in) + " - " + (p.out ? U.time(p.out) : "đang làm")).join(" · ");
    let pay = "";
    if (s.payType && s.payType !== "none") {
      const p = Engine.payroll(s.id);
      pay = '<div class="kx-mini-pay"><div><span>Lương tạm tính ' + esc(U.monthLabel(p.monthKey).toLowerCase()) + "</span><b>" + U.money(p.net) + "</b></div><div><span>Ngày công</span><b>" + p.days + "</b></div><div><span>Giờ công</span><b>" + U.num(p.regular + p.ot, 1) + "</b></div></div>" +
        (p.pendingOt ? '<div class="kx-res-today">' + UI.badge(U.num(p.pendingOt, 1) + " giờ tăng ca đang chờ duyệt", "warning", true) + "</div>" : "");
    }
    const left = Math.max(0, Math.ceil((a.until - Date.now()) / 1000));
    return '<div class="kx-result ' + (isIn ? "in" : "out") + '">' +
      '<div class="kx-result-head"><span class="kx-result-ic">' + I(isIn ? "circle-check" : "log-out") + '</span><div><div class="kx-result-name">' + esc(s.name) + '</div><div class="kx-result-role">' + esc(Engine.roleLabel(s.role)) + "</div></div></div>" +
      '<div class="kx-result-time">' + (isIn ? "Đã chấm công vào ca lúc " : "Đã chấm công ra ca lúc ") + U.time(r.at) + "</div>" +
      notes + pay +
      (pTxt ? '<div class="kx-res-today">' + I("history", "ic-sm") + "Hôm nay: " + esc(pTxt) + "</div>" : "") +
      '<div class="kx-result-foot"><span>Tự đóng sau <b id="kx-autoclose">' + left + "</b> giây</span>" + kbtn("Xong", "kiosk.attDone", { kind: "primary", icon: "check" }) + "</div></div>";
  }
  function clockView() {
    const a = T.att;
    const main = a.phase === "camera" ? cameraPhase(a) : a.phase === "result" ? resultPhase(a) : pinPhase(a);
    const grace = cfg().attendance.graceMinutes;
    const duty = Engine.onDuty().map((s) => ({ s, att: Engine.activeAtt(s.id) })).sort((x, y) => x.att.in - y.att.in);
    const side = '<aside class="kx-duty" data-keep-scroll="kd"><div class="kx-duty-head"><span>Đang trong ca</span><span class="kx-duty-n">' + duty.length + " người</span></div>" +
      (duty.length
        ? duty.map((x) => '<div class="kx-duty-row">' + UI.avatar(x.s.name) + '<div class="kx-duty-main"><b class="truncate">' + esc(x.s.name) + '</b><span>' + esc(Engine.roleLabel(x.s.role)) + " · vào " + U.time(x.att.in) + "</span></div>" + '<div class="kx-duty-side">' + UI.since(x.att.in) + (x.att.lateMin > grace ? UI.badge("Trễ " + x.att.lateMin + " phút", "danger") : x.att.offSchedule ? UI.badge("Ngoài lịch", "info") : UI.badge("Đúng giờ", "success")) + "</div></div>").join("")
        : UI.empty("users", "Chưa có ai trong ca", "Nhân viên chấm công vào ca sẽ hiện ở đây.")) +
      "</aside>";
    return '<div class="kiosk-body kx-clock-body"><section class="kx-station" data-keep-scroll="ks">' + main + "</section>" + side + "</div>";
  }

  function startCamera(staff) {
    const a = T.att;
    a.phase = "camera";
    a.staffId = staff.id;
    a.pin = "";
    a.flash = false;
    App.render();
    clearTimeout(T.attTimer);
    T.attTimer = setTimeout(() => {
      a.flash = true;
      App.render();
      T.attTimer = setTimeout(() => punch(staff.id), 380);
    }, 1000);
  }
  function punch(staffId) {
    const a = T.att;
    const active = Engine.activeAtt(staffId);
    const res = App.commit(() => (active ? Engine.checkOut(staffId, { method: "kiosk" }) : Engine.checkIn(staffId, { method: "kiosk", selfie: true })));
    if (!res) {
      resetAtt();
      App.render();
      return;
    }
    a.phase = "result";
    a.type = active ? "out" : "in";
    a.result = active
      ? { at: res.rec.out, inAt: res.rec.in, seg: res.rec.segment, offSchedule: !!res.rec.offSchedule, otPendingMin: res.otPendingMin || 0, otAutoMin: res.otAutoMin || 0 }
      : { at: res.rec.in, lateMin: res.rec.lateMin || 0, penalty: res.penalty || 0, seg: res.rec.segment, offSchedule: !!res.rec.offSchedule };
    a.until = Date.now() + 4000;
    lastAct = Date.now();
    App.render();
    clearTimeout(T.attTimer);
    T.attTimer = setTimeout(() => {
      resetAtt();
      App.render();
    }, 4000);
  }

  /* =====================================================================
     MAN HINH CHO
     ===================================================================== */
  function idleScreen() {
    const now = Date.now();
    const duty = Engine.onDuty().length;
    const q = Engine.kitchenQueue().length;
    return '<div class="kiosk-idle kx-idle" data-act="kiosk.wake" role="button" tabindex="0">' +
      '<div class="kx-idle-store">' + esc(cfg().store.name) + "</div>" +
      '<div class="clock num" data-tick="clock" data-ts="0">' + U.time(now) + "</div>" +
      '<div class="date">' + esc(U.weekday(now)) + ", " + U.date(now) + "</div>" +
      '<div class="hint">' + I("clock") + "Chạm để chấm công</div>" +
      (q ? '<button type="button" class="kx-idle-q" data-act="kiosk.wakeWeigh">' + I("utensils") + q + " món đang chế biến - chạm để mở Đơn bếp & Bể cá</button>" : "") +
      '<div class="kx-idle-meta">' + duty + " người đang trong ca</div></div>";
  }

  /* =====================================================================
     DANG KY GIAO DIEN
     ===================================================================== */
  App.portal(P, {
    idleMs: 0,
    render() {
      const me = App.me();
      const st = S();
      if (st.opId !== me.id) {
        st.opId = me.id;
        st.tab = defaultTab(me);
        st.sel = null;
      }
      if (!st.tab) st.tab = defaultTab(me);
      let body;
      if (st.tab !== "clock" && !canTab(me, st.tab)) {
        const titles = { weigh: "Đơn bếp & Bể cá dành cho Bếp và Hồ cá", waste: "Báo hỏng nguyên liệu dành cho Bếp và Hồ cá", stock: "Nhập và kiểm kho dành cho Bếp và Hồ cá" };
        body = '<div class="kiosk-body single"><section class="kiosk-work kx-center-pane">' + lockedPanel(me, titles[st.tab] || "Màn hình không thuộc vị trí của bạn") + "</section></div>";
      } else if (st.tab === "waste") body = wasteView(me, st);
      else if (st.tab === "stock") body = stockView(me, st);
      else if (st.tab === "clock") body = clockView(me, st);
      else body = weighView(me, st);
      const showKpi = st.tab !== "clock" && !blindActive(me, st);
      return '<div class="kiosk kx-root" data-tab="' + st.tab + '">' + topBar(me, st) + (showKpi ? kpis() : "") + body + footer(me, st) + successOverlay() + (st.idle ? idleScreen() : "") + "</div>";
    },
    after() {
      if (T.scrollFocus) {
        T.scrollFocus = false;
        const el = document.querySelector(".kx-cell.focus");
        if (el && el.scrollIntoView) el.scrollIntoView({ block: "nearest" });
      }
    },
    hotkeys(ev) {
      const st = S();
      if (ev.target && /INPUT|TEXTAREA|SELECT/.test(ev.target.tagName)) return;
      if (st.idle) {
        ev.preventDefault();
        App.run("kiosk.wake");
        return;
      }
      const k = ev.key;
      const digit = /^[0-9]$/.test(k);
      if (App._modal) {
        if (T.pad && (digit || k === "," || k === "." || k === "Backspace")) {
          ev.preventDefault();
          App.run("kiosk.padKey", { key: digit ? k : k === "Backspace" ? "back" : "," });
        }
        return;
      }
      if (st.tab === "clock" && T.att.phase === "pin" && (digit || k === "Backspace")) {
        ev.preventDefault();
        App.run("kiosk.pin", { key: digit ? k : "back" });
      } else if (st.tab === "clock" && T.att.phase === "result" && (k === "Enter" || k === "Escape")) {
        App.run("kiosk.attDone");
      } else if (st.tab === "stock" && st.stockView === "count" && !countLocked()) {
        if (digit || k === "," || k === "." || k === "Backspace") {
          ev.preventDefault();
          App.run("kiosk.cKey", { key: digit ? k : k === "Backspace" ? "back" : "," });
        } else if (k === "Enter" || k === "Tab") {
          ev.preventDefault();
          App.run("kiosk.cNext");
        }
      }
    },
    tick(now) {
      const st = S();
      const lm = lateMs();
      document.querySelectorAll(".kx-q[data-wsent]").forEach((el) => el.classList.toggle("late", now - Number(el.dataset.wsent) > lm));
      const ac = document.getElementById("kx-autoclose");
      if (ac && T.att.until) ac.textContent = Math.max(0, Math.ceil((T.att.until - now) / 1000));
      if (!st.idle && now - lastAct > idleMs() && !App._modal && !T.success && T.att.phase === "pin") {
        st.idle = true;
        resetAtt();
        App.render();
      }
    },
  });

  ["pointerdown", "keydown", "touchstart", "wheel"].forEach((t) => document.addEventListener(t, () => { lastAct = Date.now(); }, { capture: true, passive: true }));

  /* =====================================================================
     HANH DONG
     ===================================================================== */
  App.actions({
    "kiosk.tab": (d) => {
      const st = S();
      st.tab = d.value;
      if (d.value !== "clock" && T.att.phase === "result") resetAtt();
      App.render();
    },
    "kiosk.wake": () => {
      const st = S();
      st.idle = false;
      st.tab = "clock";
      resetAtt();
      lastAct = Date.now();
      App.render();
    },
    "kiosk.wakeWeigh": () => {
      const st = S();
      st.idle = false;
      lastAct = Date.now();
      st.tab = canTab(App.me(), "weigh") ? "weigh" : "clock";
      App.render();
    },
    "kiosk.switchOp": async () => {
      const s = await App.pinPrompt({
        title: "Đổi người thao tác",
        message: "Nhập mã PIN của " + Engine.roleLabel("tank") + ", " + Engine.roleLabel("chef") + " hoặc " + Engine.roleLabel("owner") + ".",
        filter: (x) => ["tank", "chef", "owner"].includes(x.role),
      });
      if (!s) return;
      const st = S();
      App.login(s.id);
      st.opId = s.id;
      if (!canTab(s, st.tab)) st.tab = defaultTab(s);
      App.toast("Người thao tác: " + s.name, "info");
      App.render();
    },

    /* ---- Don bep & Be ca ---- */
    "kiosk.pick": (d) => {
      S().sel = d.item;
      App.render();
    },
    "kiosk.serveItem": (d) => {
      const tk = Engine.ticket(d.ticket);
      const it = tk && tk.items.find((x) => x.id === d.item);
      if (!tk || !it) return;
      const tb = Engine.table(tk.tableId);
      App.commit(() => Engine.markServed(tk.id, it.id), "Đã hoàn tất món " + it.name + " cho bàn " + (tb ? tb.code : tk.tableId));
      S().sel = null;
      App.render();
    },
    "kiosk.reprintItem": (d) => {
      const tk = Engine.ticket(d.ticket);
      const it = tk && tk.items.find((x) => x.id === d.item);
      if (!tk || !it) return;
      const tb = Engine.table(tk.tableId);
      const m = Engine.menu(it.menuId) || {};
      const style = it.styleId ? Engine.style(it.styleId) : null;
      const job = App.commit(() => Engine.print({
        printerId: m.printerId || (m.kind === "seafood" ? "p_tank" : "p_hot"),
        kind: m.kind === "seafood" ? "tag" : "kitchen",
        title: "PHIẾU BẾP / HỒ CÁ (IN LẠI)",
        meta: [
          { l: "Bàn", r: tb ? tb.code : tk.tableId },
          { l: "Giờ in", r: U.time() },
        ],
        rows: [
          {
            l: (m.kind === "seafood" ? U.kg(it.kg) : it.qty + "x") + " " + it.name,
            r: style ? style.name : "",
            bold: true,
            note: [it.fishCodes && it.fishCodes.length ? "Mã cá: " + it.fishCodes.join(", ") : "", it.note || ""].filter(Boolean).join(" · "),
          },
        ],
      }), "Đã in lại phiếu cho bàn " + (tb ? tb.code : ""));
      if (job) {
        T.success = {
          title: "Đã in lại phiếu chế biến",
          sub: "Bàn " + (tb ? tb.code : "") + " · " + it.name,
          tagIds: [job.id],
        };
        clearTimeout(T.successTimer);
        T.successTimer = setTimeout(() => App.run("kiosk.closeSuccess"), 2800);
      }
      App.render();
    },
    "kiosk.quickReceiveSea": (d) => {
      const st = S();
      st.tab = "stock";
      st.stockView = "receive";
      st.rc.type = "tank";
      st.rc.ref = d.id;
      const m = Engine.menu(d.id);
      st.rc.count = m && !countable(m) ? 0 : 2;
      st.rc.kg = m ? roundKg((m.avgKgPerPiece || 0.8) * (st.rc.count || 1)) : 1.5;
      App.render();
    },
    "kiosk.quickWasteSea": (d) => {
      const st = S();
      st.tab = "waste";
      st.waste = newWaste("seafood");
      st.waste.ref = d.id;
      const m = Engine.menu(d.id);
      const fishList = m && countable(m) ? Engine.tankFishList(d.id) : [];
      if (fishList[0]) {
        st.waste.fishIds = [fishList[0].id];
        st.waste.count = 1;
        st.waste.kg = Number(fishList[0].kg) || 0.5;
      } else {
        st.waste.count = m && countable(m) ? 1 : 0;
        st.waste.kg = 0.5;
      }
      st.waste.reason = REASONS[0];
      App.render();
    },
    "kiosk.quickWasteDish": (d) => {
      const m = Engine.menu(d.id);
      if (!m || !Array.isArray(m.bom) || !m.bom[0]) return;
      const bag = Engine.bag(m.bom[0].bagId);
      if (!bag) return;
      const st = S();
      st.tab = "waste";
      st.waste = newWaste(bag.group === "veg" ? "veg" : "meat");
      st.waste.ref = bag.id;
      st.waste.qty = 1;
      st.waste.reason = REASONS[1];
      App.render();
    },
    "kiosk.closeSuccess": () => {
      clearTimeout(T.successTimer);
      if (!T.success) return;
      T.success = null;
      App.render();
    },

    /* ---- Ban phim so lon ---- */
    "kiosk.padKey": (d) => {
      const p = T.pad;
      if (!p) return;
      p.val = keyInto(p.val, d.key, p.int);
      App.render();
    },
    "kiosk.padOk": () => {
      const p = T.pad;
      if (!p) return;
      const v = U.parseNum(p.val);
      if (!(v > 0) && !p.allowZero) return App.toast("Nhập số lớn hơn 0.", "error");
      const fn = p.onDone;
      const m = App._modal;
      if (m) m.onClose = null;
      T.pad = null;
      App.closeModal();
      fn(v);
      App.render();
    },

    /* ---- Bao hong nguyen lieu ---- */
    "kiosk.wKind": (d) => {
      const st = S();
      if (st.waste.kind !== d.value) {
        const keep = st.waste;
        st.waste = newWaste(d.value);
        st.waste.reason = keep.reason;
        st.waste.note = keep.note;
      }
      App.render();
    },
    "kiosk.wItem": (d) => {
      const w = S().waste;
      if (w.ref !== d.id) {
        w.ref = d.id;
        w.fishIds = [];
        w.kg = 0;
        w.qty = 1;
        if (w.kind === "seafood") {
          const m = Engine.menu(d.id);
          const fishList = m && countable(m) ? Engine.tankFishList(d.id) : [];
          if (fishList[0]) {
            w.fishIds = [fishList[0].id];
            w.count = 1;
            w.kg = Number(fishList[0].kg) || 0.5;
          } else {
            w.count = m && !countable(m) ? 0 : 1;
            w.kg = m && !countable(m) ? 0.5 : 0;
          }
        }
        w.photo = false;
      }
      App.render();
    },
    "kiosk.wToggleFish": (d) => {
      const w = S().waste;
      const cur = Array.isArray(w.fishIds) ? w.fishIds.slice() : [];
      const idx = cur.indexOf(d.fish);
      if (idx >= 0) cur.splice(idx, 1);
      else cur.push(d.fish);
      w.fishIds = cur;
      const fishList = Engine.tankFishList(w.ref);
      const selFish = fishList.filter((f) => cur.includes(f.id));
      w.count = selFish.length;
      w.kg = roundKg(selFish.reduce((sum, f) => sum + (Number(f.kg) || 0), 0));
      App.render();
    },
    "kiosk.wCount": (d) => {
      const w = S().waste;
      w.count = Math.max(0, (Number(w.count) || 0) + Number(d.d));
      App.render();
    },
    "kiosk.wQty": (d) => {
      const w = S().waste;
      w.qty = Math.max(1, (Number(w.qty) || 0) + Number(d.d));
      App.render();
    },
    "kiosk.wKg": () => {
      const w = S().waste;
      const x = wasteItem(w);
      if (!x) return;
      numPad({ title: "Khối lượng hao hụt", sub: x.name, value: w.kg, onDone: (v) => { S().waste.kg = roundKg(v); } });
    },
    "kiosk.wReason": (d) => {
      const w = S().waste;
      w.reason = w.reason === d.v ? "" : d.v;
      App.render();
    },
    "kiosk.wPhoto": () => {
      const w = S().waste;
      w.photo = false;
      T.flash.waste = true;
      App.render();
      setTimeout(() => {
        T.flash.waste = false;
        const w2 = S().waste;
        w2.photo = true;
        w2.photoAt = Date.now();
        App.render();
      }, 450);
    },
    "kiosk.wPhotoFile": (d, el) => {
      const f = el && el.files && el.files[0];
      if (!f) return;
      const reader = new FileReader();
      reader.onload = () => {
        const w = S().waste;
        w.photo = true;
        w.photoUrl = String(reader.result || "");
        w.photoAt = Date.now();
        App.render();
      };
      reader.readAsDataURL(f);
    },
    "kiosk.wSubmit": () => {
      const st = S();
      const w = st.waste;
      const me = App.me();
      const miss = wasteMissing(w);
      if (miss.length) return App.toast("Còn thiếu: " + miss.join(", ") + ".", "error");
      const reason = [w.reason, (w.note || "").trim()].filter(Boolean).join(" - ");
      let payload;
      if (w.kind === "seafood") {
        payload = { kind: "seafood", menuId: w.ref, fishIds: w.fishIds || [], count: w.count, kg: w.kg };
      } else if (w.kind === "drink") {
        payload = { kind: "drink", menuId: w.ref, qty: w.qty };
      } else {
        payload = { kind: "bag", bagId: w.ref, qty: w.qty };
      }
      Object.assign(payload, { reason, photo: !!w.photo, photoUrl: w.photoUrl || null, by: me.id });
      const r = App.commit(
        () => Engine.reportWaste(payload),
        (x) => (x.status === "approved" ? "Đã ghi nhận nguyên liệu hỏng, trừ tồn kho và tự duyệt" : "Đã trừ tồn kho và gửi Chủ quán duyệt hao hụt")
      );
      if (!r) return;
      st.waste = newWaste(w.kind);
      App.render();
    },

    /* ---- Nhap hang ---- */
    "kiosk.stockView": (d) => {
      const st = S();
      st.stockView = d.value;
      if (d.value === "count" && !countLocked()) {
        st.blindMode = true;
      }
      App.render();
    },
    "kiosk.resumeBlindCount": () => {
      const st = S();
      st.tab = "stock";
      st.stockView = "count";
      st.blindMode = true;
      App.render();
    },
    "kiosk.cancelBlindCount": async () => {
      const st = S();
      const hasDraft = !!(st.cnt && st.cnt.entries && Object.keys(st.cnt.entries).length > 0);
      if (hasDraft) {
        const ok = await App.confirm({
          title: "Hủy phiên kiểm kho mù?",
          message: "Nếu thoát phiên kiểm kho mù để xem số tồn thực tế, các số bạn vừa đếm dở sẽ bị xóa để tránh đối chiếu gian lận.",
          confirm: "Xóa số đếm dở & Thoát kiểm kho mù",
          danger: true,
        });
        if (!ok) return;
      }
      st.blindMode = false;
      st.cnt = { entries: {}, focus: null };
      if (st.tab === "stock" && st.stockView === "count") st.stockView = "receive";
      App.render();
    },
    "kiosk.rcSupplier": (d) => {
      S().rc.supplier = d.v;
      App.render();
    },
    "kiosk.rcType": (d) => {
      const r = S().rc;
      if (r.type !== d.value) {
        r.type = d.value;
        r.ref = "";
      }
      App.render();
    },
    "kiosk.rcItem": (d) => {
      const r = S().rc;
      r.ref = d.id;
      const m = r.type === "tank" ? Engine.menu(d.id) : null;
      r.count = m && !countable(m) ? 0 : 1;
      r.kg = m ? roundKg(Number(m.avgKgPerPiece) || 0.8) : 0;
      r.qty = 1;
      App.render();
    },
    "kiosk.rcCount": (d) => {
      const r = S().rc;
      r.count = Math.max(0, (Number(r.count) || 0) + Number(d.d));
      App.render();
    },
    "kiosk.rcQty": (d) => {
      const r = S().rc;
      r.qty = Math.max(1, (Number(r.qty) || 0) + Number(d.d));
      App.render();
    },
    "kiosk.rcKg": () => {
      const r = S().rc;
      const x = rcRef(r.type, r.ref);
      if (!x) return;
      numPad({ title: "Khối lượng thực nhận", sub: x.name + " · cân toàn bộ lô hàng", value: r.kg, onDone: (v) => { S().rc.kg = roundKg(v); } });
    },
    "kiosk.rcAdd": () => {
      const r = S().rc;
      if (!r.ref) return;
      const storeType = rcStoreType(r.type);
      const line = storeType === "tank"
        ? { type: "tank", ref: r.ref, count: Number(r.count) || 0, kg: Number(r.kg) || 0 }
        : { type: storeType, ref: r.ref, qty: Number(r.qty) || 0 };
      if (storeType === "tank" ? !(line.kg > 0) : !(line.qty > 0)) return App.toast("Nhập số lượng thực nhận trước khi thêm.", "error");
      const ex = r.lines.find((l) => l.ref === line.ref && l.type === line.type);
      if (ex) {
        if (line.type === "tank") {
          ex.count = (ex.count || 0) + line.count;
          ex.kg = roundKg((ex.kg || 0) + line.kg);
        } else ex.qty = (ex.qty || 0) + line.qty;
      } else r.lines.push(line);
      r.ref = "";
      App.render();
    },
    "kiosk.rcRemove": (d) => {
      const r = S().rc;
      const removed = r.lines.splice(Number(d.i), 1)[0];
      App.render();
      if (removed) App.toast("Đã xóa dòng khỏi phiếu nhập", { type: "info", undo: () => { S().rc.lines.splice(Number(d.i), 0, removed); App.render(); } });
    },
    "kiosk.rcConfirm": async () => {
      const st = S();
      const r = st.rc;
      const me = App.me();
      const supplier = (r.supplier || "").trim();
      if (!supplier) return App.toast("Nhập tên nhà cung cấp trước khi xác nhận.", "error");
      if (!r.lines.length) return App.toast("Phiếu nhập chưa có dòng hàng nào.", "error");
      const witness = await App.pinPrompt({
        title: "Người kiểm thứ hai",
        message: "Người cùng kiểm đếm hàng nhập mã PIN để xác nhận số thực nhận.",
        filter: (s) => s.id !== me.id && ["tank", "chef", "owner", "cashier"].includes(s.role),
      });
      if (!witness) return;
      const lines = r.lines.map((l) => Object.assign({}, l));
      const rc = App.commit(
        () => Engine.receiveGoods({ supplier, lines, by: me.id, witness: witness.id }),
        (x) => "Đã nhập kho " + x.lines.length + " mặt hàng từ " + supplier + ", kiểm cùng " + witness.name
      );
      if (!rc) return;
      st.rc = newReceipt(r.type);
      App.render();
    },

    /* ---- Kiem kho ---- */
    "kiosk.cFocus": (d) => {
      S().cnt.focus = { ref: d.ref, field: d.field };
      App.render();
    },
    "kiosk.cKey": (d) => {
      const c = S().cnt;
      const fields = countFields();
      const f = curFocus(fields, c);
      if (!f) return;
      c.focus = { ref: f.ref, field: f.field };
      const e = c.entries[f.ref] || (c.entries[f.ref] = {});
      e[f.field] = keyInto(e[f.field] || "", d.key, f.field !== "kg");
      App.render();
    },
    "kiosk.cNext": () => {
      const c = S().cnt;
      const fields = countFields();
      const f = curFocus(fields, c);
      const i = fields.indexOf(f);
      const order = fields.slice(i + 1).concat(fields.slice(0, i + 1));
      const next = order.find((x) => !filled(c.entries, x)) || fields[(i + 1) % fields.length];
      c.focus = { ref: next.ref, field: next.field };
      T.scrollFocus = true;
      App.render();
    },
    "kiosk.cSubmit": async () => {
      const st = S();
      const c = st.cnt;
      const fields = countFields();
      const missing = fields.filter((f) => !filled(c.entries, f)).length;
      if (missing) return App.toast("Còn " + missing + " ô chưa nhập. Mục hết hàng nhập 0.", "error");
      const ok = await App.confirm({
        title: "Nộp kết quả kiểm kho",
        message: "Kết quả sẽ gửi Chủ quán đối soát và <b>khóa ngay sau khi nộp</b>, không thể sửa lại. Kiểm tra kỹ số đã đếm trước khi nộp.",
        confirm: "Nộp và khóa kết quả",
        danger: true,
      });
      if (!ok) return;
      const entries = {};
      Engine.countSheet().forEach((s) => {
        const x = c.entries[s.ref] || {};
        entries[s.ref] = { count: U.parseNum(x.count), kg: U.parseNum(x.kg), qty: U.parseNum(x.qty) };
      });
      const r = App.commit(() => Engine.submitCount(entries, App.me().id), "Đã nộp kết quả kiểm kho cho Chủ quán");
      if (!r) return;
      st.blindMode = false;
      st.cnt = { entries: {}, focus: null };
      App.render();
    },

    /* ---- Cham cong ---- */
    "kiosk.pin": (d) => {
      const a = T.att;
      if (a.phase !== "pin") return;
      a.error = "";
      a.pin = UI.applyKey(a.pin, d.key, 4);
      if (a.pin.length === 4) {
        const staff = D().staff.find((s) => s.pin === a.pin && s.active);
        if (!staff) {
          a.error = "Mã PIN không đúng. Vui lòng nhập lại.";
          a.pin = "";
        } else {
          startCamera(staff);
          return;
        }
      }
      App.render();
    },
    "kiosk.attDone": () => {
      resetAtt();
      App.render();
    },
  });
})();
