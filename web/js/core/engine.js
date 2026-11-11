/* =========================================================================
   engine.js - Toan bo nghiep vu dung chung cho 6 giao dien
   Moi giao dien chi goi Engine, khong tu tinh toan rieng -> so lieu nhat quan.
   Tat ca thong so lay tu Store.state.config (khong viet cung).
   ========================================================================= */
(function () {
  const E = {};
  const S = () => Store.state;
  const C = () => Store.state.config;
  const D = () => Store.state.data;
  const MIN = 60000;

  class BizError extends Error {}
  E.BizError = BizError;
  function fail(msg) {
    throw new BizError(msg);
  }

  /* ======================= TRA CUU ======================= */
  E.menu = (id) => C().menu.find((m) => m.id === id);
  E.cat = (id) => C().categories.find((c) => c.id === id);
  E.table = (id) => C().tables.find((t) => t.id === id);
  E.area = (id) => C().areas.find((a) => a.id === id);
  E.style = (id) => C().styles.find((s) => s.id === id);
  E.staff = (id) => D().staff.find((s) => s.id === id);
  E.printer = (id) => C().printers.find((p) => p.id === id);
  E.brand = (id) => C().brands.find((b) => b.id === id);
  E.bag = (id) => C().bags.find((b) => b.id === id);
  E.shiftDef = (id) => C().shifts.find((s) => s.id === id);
  E.roleLabel = (role) => (C().roles[role] && C().roles[role].label) || role;
  E.staffName = (id) => (id === "system" ? "Hệ thống" : (E.staff(id) || {}).name || "Không rõ");
  E.portalOfRole = (role) => (C().roles[role] && C().roles[role].portal) || null;
  E.activeMenu = (filterFn) => C().menu.filter((m) => m.active && (!filterFn || filterFn(m)));
  E.can = function (role, perm) {
    if (role === "owner") return true;
    const p = C().permissions[role];
    return !!(p && p[perm]);
  };
  E.sortedCategories = () => C().categories.slice().sort((a, b) => (a.order || 0) - (b.order || 0));

  /* ======================= TON KHO BE CA & NANG LUC CHE BIEN MON ======================= */
  E.isCountableSeafood = (m) => !!(m && m.kind === "seafood" && (Number(m.avgKgPerPiece) || 0) >= 0.1);

  E.syncTank = function (menuId) {
    const m = E.menu(menuId);
    if (!m || m.kind !== "seafood") return null;
    const d = D();
    const tk = (d.tank[menuId] = d.tank[menuId] || { count: 0, kg: 0, items: [] });
    if (!E.isCountableSeafood(m)) {
      tk.items = [];
      tk.count = 0;
      tk.kg = Math.max(0, Math.round((Number(tk.kg) || 0) * 100) / 100);
      return tk;
    }
    tk.items = Array.isArray(tk.items) ? tk.items : [];
    tk.count = tk.items.length;
    tk.kg = Math.round(tk.items.reduce((s, f) => s + (Number(f.kg) || 0), 0) * 100) / 100;
    return tk;
  };

  E.seafoodPolicy = () =>
    Object.assign(
      {
        allowSellByGram: true,
        minGram: 200,
        gramStep: 100,
        allowWholeFishBargain: true,
        maxStaffBargainPct: 8,
        blockBelowCost: true,
      },
      C().seafoodPolicy || {}
    );

  // Danh gia muc ep gia / chot gia khi khach mua nguyen con
  E.evaluateSeafoodBargain = function (menuId, kg, dealAmount, role) {
    const m = typeof menuId === "object" ? menuId : E.menu(menuId);
    const pol = E.seafoodPolicy();
    const pCash = (C().permissions && C().permissions.cashier) || {};
    const cashierMaxPct = Number(pCash.cashierBargainPct) || 15;
    const ppk = Number((m && m.pricePerKg) || 0);
    const cpk = Number((m && m.costPerKg) || 0);
    const w = Math.max(0, Number(kg) || 0);
    const listAmount = Math.round((w * ppk) / 1000) * 1000;
    const costAmount = Math.round((w * cpk) / 1000) * 1000;
    const maxPct =
      role === "owner"
        ? 100
        : role === "cashier"
        ? cashierMaxPct
        : Number(pol.maxStaffBargainPct) || 0;
    const minSelfAmount = Math.max(
      pol.blockBelowCost ? costAmount : 0,
      Math.round((listAmount * (1 - maxPct / 100)) / 1000) * 1000
    );
    const minCashierAmount = Math.max(
      pol.blockBelowCost ? costAmount : 0,
      Math.round((listAmount * (1 - cashierMaxPct / 100)) / 1000) * 1000
    );
    const deal =
      dealAmount !== undefined && dealAmount !== null && Number(dealAmount) > 0
        ? Math.round(Number(dealAmount) / 1000) * 1000
        : listAmount;
    const discount = Math.max(0, listAmount - deal);
    const pct = listAmount > 0 ? Math.round((discount / listAmount) * 1000) / 10 : 0;
    const effectivePpk = w > 0 ? Math.round(deal / w / 1000) * 1000 : ppk;
    const belowCost = deal < costAmount;
    const withinSelfLimit = !belowCost && (role === "owner" || pct <= maxPct + 0.05 || deal >= minSelfAmount);
    const withinCashierLimit = !belowCost && (pct <= cashierMaxPct + 0.05 || deal >= minCashierAmount);
    const needsApproval = discount > 0 && !withinSelfLimit;
    const quickDeals = [];
    if (listAmount > 0) {
      const candidates = [
        Math.floor(listAmount / 50000) * 50000,
        Math.floor(listAmount / 100000) * 100000,
        listAmount - 20000,
        listAmount - 30000,
        listAmount - 50000,
        minSelfAmount,
      ];
      candidates.forEach((c) => {
        if (c > costAmount && c < listAmount && !quickDeals.includes(c)) quickDeals.push(c);
      });
      quickDeals.sort((a, b) => b - a);
    }
    return {
      listAmount,
      costAmount,
      minSelfAmount,
      minCashierAmount,
      maxPct,
      cashierMaxPct,
      dealAmount: deal,
      discount,
      pct,
      effectivePpk,
      belowCost,
      withinSelfLimit,
      withinCashierLimit,
      needsApproval,
      quickDeals: quickDeals.slice(0, 4),
    };
  };

  E.tankFishList = function (menuId) {
    const m = E.menu(menuId);
    if (!m || m.kind !== "seafood") return [];
    const tk = E.syncTank(menuId) || { count: 0, kg: 0, items: [] };
    const ppk = Number(m.pricePerKg) || 0;
    return (tk.items || []).map((f, idx) => ({
      id: f.id || ("F-" + (idx + 1)),
      code: f.code || ("#" + (f.id || (idx + 1))),
      kg: Math.round((Number(f.kg) || 0) * 100) / 100,
      gram: Math.round((Number(f.kg) || 0) * 1000),
      origKg: Math.round((Number(f.origKg || f.kg) || 0) * 100) / 100,
      partial: !!f.partial,
      amount: Math.round((Number(f.kg) || 0) * ppk / 1000) * 1000,
    }));
  };

  E.menuAvailability = function (menuId) {
    const m = typeof menuId === "object" ? menuId : E.menu(menuId);
    if (!m) return { available: false, maxPortions: 0, unit: "phần", label: "Không rõ", tone: "danger", fishList: [] };
    const d = D();
    if (m.kind === "seafood") {
      const tk = E.syncTank(m.id) || { count: 0, kg: 0, items: [] };
      if (E.isCountableSeafood(m)) {
        const fishList = E.tankFishList(m.id);
        const n = fishList.length;
        if (n <= 0) {
          return { available: false, maxPortions: 0, unit: "con", label: "Bể hết hàng (0 con)", shortLabel: "Hết cá trong bể", tone: "danger", fishList: [], totalKg: 0 };
        }
        const kgs = fishList.map((f) => f.kg);
        const minKg = Math.min.apply(null, kgs);
        const maxKg = Math.max.apply(null, kgs);
        const range = Math.abs(maxKg - minKg) < 0.02 ? U.num(minKg, 2) + " kg/con" : U.num(minKg, 2) + "–" + U.num(maxKg, 2) + " kg/con";
        return {
          available: true,
          maxPortions: n,
          unit: "con",
          label: "Bể còn " + n + " con · " + range,
          shortLabel: "Bể còn " + n + " con (" + U.kg(tk.kg) + ")",
          tone: n <= 3 ? "warning" : "info",
          fishList,
          totalKg: tk.kg,
        };
      }
      const kg = Math.max(0, Number(tk.kg) || 0);
      const avail = kg >= 0.2;
      return {
        available: avail,
        maxPortions: Math.floor(kg / 0.5),
        unit: "kg",
        label: avail ? "Bể còn " + U.kg(kg) + " (khoảng " + Math.max(1, Math.floor(kg / 0.5)) + " đĩa)" : "Bể hết hàng (0 kg)",
        shortLabel: avail ? "Bể còn " + U.kg(kg) : "Hết hàng",
        tone: !avail ? "danger" : kg < 1.5 ? "warning" : "info",
        fishList: [],
        totalKg: kg,
      };
    }
    if (m.kind === "dish") {
      const bom = m.bom && m.bom.length ? m.bom : [];
      if (!bom.length) {
        return { available: true, maxPortions: 50, unit: m.unit || "phần", label: "Sẵn sàng phục vụ", shortLabel: "Còn hàng", tone: "success", ingredients: [] };
      }
      let minPortions = Infinity;
      let limitingBag = null;
      const ingredients = bom.map((b) => {
        const bg = E.bag(b.bagId) || { id: b.bagId, name: b.bagId, unit: "túi" };
        const have = Math.max(0, Number(d.stock[b.bagId]) || 0);
        const need = Math.max(1, Number(b.qty) || 1);
        const portions = Math.floor(have / need);
        if (portions < minPortions) {
          minPortions = portions;
          limitingBag = bg;
        }
        return { bagId: bg.id, name: bg.name, unit: bg.unit || "túi", have, need, portions };
      });
      if (!isFinite(minPortions)) minPortions = 0;
      const unit = m.unit || "đĩa";
      if (minPortions <= 0) {
        return {
          available: false,
          maxPortions: 0,
          unit,
          limitingBag,
          ingredients,
          label: "Hết nguyên liệu" + (limitingBag ? " (" + limitingBag.name + ")" : ""),
          shortLabel: "Hết NL",
          tone: "danger",
        };
      }
      return {
        available: true,
        maxPortions: minPortions,
        unit,
        limitingBag,
        ingredients,
        label: (minPortions <= 6 ? "Sắp hết · " : "") + "Làm được " + minPortions + " " + unit,
        shortLabel: "Còn " + minPortions + " " + unit,
        tone: minPortions <= 6 ? "warning" : "success",
      };
    }
    // Đồ uống (beer | drink)
    const qty = Math.max(0, Number(d.drinks[m.id]) || 0);
    const unit = m.unit || "lon";
    return {
      available: qty > 0,
      maxPortions: qty,
      unit,
      label: qty > 0 ? "Kho còn " + qty + " " + unit : "Hết kho (0 " + unit + ")",
      shortLabel: qty > 0 ? "Còn " + qty + " " + unit : "Hết kho",
      tone: qty <= 0 ? "danger" : qty <= 24 ? "warning" : "neutral",
    };
  };

  /* ======================= TINH TIEN ======================= */
  E.vatGroupOf = function (it) {
    const m = E.menu(it.menuId);
    const c = m && E.cat(m.categoryId);
    return (c && c.vatGroup) || "food";
  };
  E.vatRate = (group) => Number(C().tax[group] !== undefined ? C().tax[group] : C().tax.food) || 0;

  E.itemAmount = function (it) {
    if (it.isFree || it.status === "void") return 0;
    const m = E.menu(it.menuId);
    const st = it.styleId ? E.style(it.styleId) : null;
    const sur = st ? Number(st.surcharge) || 0 : 0;
    if (m && m.kind === "seafood") {
      if (it.status === "pending_weigh") return 0;
      if (it.dealAmount !== undefined && it.dealAmount !== null && Number(it.dealAmount) > 0 && (!it.bargain || it.bargain.status !== "rejected")) {
        return Math.round(Number(it.dealAmount)) + sur;
      }
      const ppk = it.pricePerKg !== undefined ? it.pricePerKg : m.pricePerKg;
      return Math.round((Number(it.kg) || 0) * ppk / 1000) * 1000 + sur;
    }
    return (Number(it.qty) || 0) * ((Number(it.price) || 0) + sur);
  };
  E.itemCost = function (it) {
    if (it.status === "void") return 0;
    const m = E.menu(it.menuId);
    if (!m) return 0;
    if (m.kind === "seafood") return Math.round((Number(it.kg) || 0) * (m.costPerKg || 0));
    return (Number(it.qty) || 0) * (m.cost || 0);
  };
  E.formatBeerCaseQty = function (qty, caseSize, unit) {
    qty = Math.max(0, Math.round(Number(qty) || 0));
    const cs = Math.max(1, Number(caseSize) || 24);
    const u = unit || "lon";
    if (qty >= cs) {
      const cases = Math.floor(qty / cs);
      const rem = qty % cs;
      if (rem === 0) return cases + " thùng (" + qty + " " + u + ")";
      return cases + " thùng + " + rem + " " + u + " (" + qty + " " + u + ")";
    }
    if (cs >= 12 && qty === Math.round(cs / 2)) {
      return "Nửa thùng (" + qty + " " + u + ")";
    }
    return qty + " " + u;
  };

  E.itemLabel = function (it) {
    const parts = [];
    const st = it.styleId ? E.style(it.styleId) : null;
    if (st) parts.push(st.name);
    const m = E.menu(it.menuId);
    if (m && m.kind === "seafood") {
      if (it.fishSummary) parts.push(it.fishSummary);
      else if (it.status === "pending_weigh") parts.push("Chờ cân" + (it.count ? " · " + it.count + " con" : ""));
      else parts.push(U.kg(it.kg) + (it.count ? " · " + it.count + " con" : ""));
      if (it.bargain && it.bargain.discount > 0 && it.bargain.status !== "rejected") {
        parts.push("Chốt nguyên con " + U.money(it.dealAmount) + " (-" + U.money(it.bargain.discount) + (it.bargain.status === "pending" ? " · chờ duyệt" : "") + ")");
      }
    } else if (m && m.kind === "beer" && !it.isFree) {
      const cs = Number(m.caseSize) || 24;
      const u = m.unit || "lon";
      const ret = Number(it.returnedQty) || 0;
      const brought = Number(it.broughtOutQty) || (Number(it.qty) || 0) + ret;
      if (ret > 0) {
        parts.push("Đem ra " + E.formatBeerCaseQty(brought, cs, u) + " · Trả lại " + ret + " " + u + " dư · Tính tiền " + it.qty + " " + u);
      } else if (it.qty >= cs && it.qty % cs === 0) {
        parts.push("Nguyên thùng: " + (it.qty / cs) + " thùng (" + it.qty + " " + u + ")");
      } else if (cs >= 12 && it.qty === Math.round(cs / 2)) {
        parts.push("Nửa thùng (" + it.qty + " " + u + ")");
      }
    }
    if (it.isFree) parts.push("Tặng - " + (it.promoId ? "khuyến mãi hãng" : "quán tặng"));
    if (it.note) parts.push(it.note);
    return parts.join(" · ");
  };

  E.vipInfo = function (ticket, subtotal, at) {
    const t = E.table(ticket.tableId);
    if (!t || t.type !== "vip") return null;
    const v = C().vip;
    const now = at || ticket.closedAt || Date.now();
    const minutes = Math.max(0, Math.floor((now - ticket.openedAt) / MIN) - (Number(v.freeMinutes) || 0));
    const hours = Math.ceil(minutes / 60);
    const fee = hours * (Number(v.hourlyRate) || 0);
    const waived = !!v.minimumSpendEnabled && subtotal >= (Number(v.minimumSpend) || 0);
    const nextHourIn = 60 - (minutes % 60);
    return { minutes, hours, fee: waived ? 0 : fee, rawFee: fee, waived, minimumSpend: v.minimumSpend, minimumSpendEnabled: v.minimumSpendEnabled, remainingToMin: Math.max(0, (v.minimumSpend || 0) - subtotal), nextHourIn };
  };

  E.totals = function (ticket, at) {
    const items = ticket.items || [];
    const groups = { food: 0, alcohol: 0 };
    let subtotal = 0,
      cost = 0,
      pendingWeigh = 0;
    items.forEach((it) => {
      const a = E.itemAmount(it);
      subtotal += a;
      cost += E.itemCost(it);
      const g = E.vatGroupOf(it);
      groups[g] = (groups[g] || 0) + a;
      if (it.status === "pending_weigh") pendingWeigh++;
    });
    const vip = E.vipInfo(ticket, subtotal, at);
    const vipFee = vip ? vip.fee : 0;
    groups.food += vipFee;
    let discount = 0;
    if (ticket.discount) {
      discount = ticket.discount.type === "pct" ? Math.round((subtotal * ticket.discount.value) / 100 / 1000) * 1000 : Number(ticket.discount.value) || 0;
      // Giam tru phan bo ty le theo nhom
      const base = groups.food + groups.alcohol || 1;
      const f = groups.food / base;
      groups.food -= Math.round(discount * f);
      groups.alcohol -= discount - Math.round(discount * f);
    }
    const inc = !!C().tax.pricesIncludeVat;
    const vat = {};
    let vatTotal = 0;
    Object.keys(groups).forEach((g) => {
      const r = E.vatRate(g);
      const gross = groups[g];
      const v = inc ? Math.round((gross * r) / (100 + r)) : Math.round((gross * r) / 100);
      vat[g] = { base: inc ? gross - v : gross, rate: r, vat: v, gross: inc ? gross : gross + v };
      vatTotal += v;
    });
    const grand = subtotal + vipFee - discount + (inc ? 0 : vatTotal);
    const deposit = Number(ticket.deposit) || 0;
    const paid = U.sum(ticket.payments, (p) => p.amount);
    const due = Math.max(0, grand - deposit - paid);
    return { subtotal, vip, vipFee, discount, vat, vatTotal, inc, grand, deposit, paid, due, cost, pendingWeigh, itemCount: U.sum(items.filter((i) => i.status !== "void" && !i.isFree), (i) => (E.menu(i.menuId) || {}).kind === "seafood" ? 1 : i.qty) };
  };

  /* ======================= BAN & BILL ======================= */
  E.ticketsOfTable = (tableId) => D().tickets.filter((t) => t.tableId === tableId && t.status !== "paid");
  E.ticketByTable = (tableId) => E.ticketsOfTable(tableId)[0] || null;
  E.ticket = (id) => D().tickets.find((t) => t.id === id);
  E.openTickets = () => D().tickets.filter((t) => t.status !== "paid");

  E.bookingForTable = function (tableId, at) {
    const now = at || Date.now();
    const key = U.dayKey(now);
    return D().bookings.find((b) => {
      if (b.tableId !== tableId || b.dayKey !== key) return false;
      if (!(b.status === "confirmed" || b.status === "holding")) return false;
      const t = U.atTime(b.time, b.dayKey);
      return t - now < 3 * 3600000 && now - t < (C().booking.noShowMinutes + 60) * MIN;
    });
  };

  /* ---------- Phan cong Nhan vien Phu trach Ban / Khu vuc & Ma dinh danh VietQR ---------- */
  E.generatePayCode = function (tableId, ticketId) {
    const prefix = (C().paymentGateway && C().paymentGateway.prefix) || "QN";
    const tb = E.table(tableId);
    const tbCode = ((tb && tb.code) || tableId || "BAN").replace(/[^A-Za-z0-9]/g, "").toUpperCase();
    const rawSuffix = String(ticketId || U.uid("tk")).replace(/[^A-Za-z0-9]/g, "").slice(-4).toUpperCase();
    const suffix = rawSuffix.padStart(4, "8");
    return prefix + " " + tbCode + " " + suffix;
  };

  E.ensurePayCode = function (tk) {
    if (!tk) return "";
    if (!tk.payCode) tk.payCode = E.generatePayCode(tk.tableId, tk.id);
    return tk.payCode;
  };

  E.normalizePayCode = function (s) {
    return String(s || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "d")
      .replace(/Đ/g, "D")
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "");
  };

  E.assignedWaitersForTable = function (tableId) {
    const tb = E.table(tableId);
    if (!tb) return [];
    const waiters = (D().staff || []).filter((s) => s.active && s.role === "waiter");
    const byTable = waiters.filter((s) => Array.isArray(s.assignedTables) && s.assignedTables.includes(tableId));
    if (byTable.length) return byTable;
    const byArea = waiters.filter((s) => Array.isArray(s.assignedAreas) && s.assignedAreas.includes(tb.areaId));
    return byArea.length ? byArea : waiters;
  };

  E.defaultWaiterForTable = function (tableId) {
    const assigned = E.assignedWaitersForTable(tableId);
    const dutyIds = new Set(E.onDuty().map((s) => s.id));
    const onDutyAssigned = assigned.find((s) => dutyIds.has(s.id));
    if (onDutyAssigned) return onDutyAssigned.id;
    if (assigned[0]) return assigned[0].id;
    const tk = E.ticketByTable(tableId);
    if (tk && tk.waiterId) return tk.waiterId;
    const anyWaiter = (D().staff || []).find((s) => s.active && s.role === "waiter");
    return anyWaiter ? anyWaiter.id : null;
  };

  E.isMyTable = function (staffId, tableId) {
    if (!staffId || !tableId) return false;
    const tk = E.ticketByTable(tableId);
    if (tk && tk.waiterId === staffId) return true;
    const st = E.staff(staffId);
    if (!st || st.role !== "waiter") return true;
    if (Array.isArray(st.assignedTables) && st.assignedTables.length) {
      return st.assignedTables.includes(tableId);
    }
    const tb = E.table(tableId);
    if (tb && Array.isArray(st.assignedAreas) && st.assignedAreas.length) {
      return st.assignedAreas.includes(tb.areaId);
    }
    return true;
  };

  E.assignWaiterToTable = function (tableId, waiterId) {
    const st = E.staff(waiterId);
    if (!st) fail("Không tìm thấy nhân viên.");
    const tk = E.ticketByTable(tableId);
    if (tk) tk.waiterId = waiterId;
    (D().staff || []).filter((s) => s.role === "waiter").forEach((s) => {
      s.assignedTables = (s.assignedTables || []).filter((tid) => tid !== tableId);
    });
    st.assignedTables = st.assignedTables || [];
    if (!st.assignedTables.includes(tableId)) st.assignedTables.push(tableId);
    const tb = E.table(tableId);
    if (tb) {
      st.assignedAreas = st.assignedAreas || [];
      if (!st.assignedAreas.includes(tb.areaId)) st.assignedAreas.push(tb.areaId);
    }
    return { tableId, waiterId };
  };

  E.updateStaffAssignments = function (staffId, areaIds, tableIds) {
    const st = E.staff(staffId);
    if (!st) fail("Không tìm thấy nhân viên.");
    if (areaIds && typeof areaIds === "object" && !Array.isArray(areaIds)) {
      if (Array.isArray(areaIds.assignedAreas)) st.assignedAreas = Array.from(new Set(areaIds.assignedAreas));
      if (Array.isArray(areaIds.assignedTables)) st.assignedTables = Array.from(new Set(areaIds.assignedTables));
      return st;
    }
    if (Array.isArray(areaIds)) st.assignedAreas = Array.from(new Set(areaIds));
    if (Array.isArray(tableIds)) st.assignedTables = Array.from(new Set(tableIds));
    return st;
  };

  // Trang thai hien thi 1 ban: empty | booked | active | weigh | locked | dirty
  E.tableStatus = function (table, at) {
    const now = at || Date.now();
    const tk = E.ticketByTable(table.id);
    const defWaiterId = E.defaultWaiterForTable(table.id);
    const defWaiterShort = defWaiterId ? U.shortName(E.staffName(defWaiterId)) : "";
    if (tk) {
      E.ensurePayCode(tk);
      if (!tk.waiterId && defWaiterId) tk.waiterId = defWaiterId;
      const wShort = tk.waiterId ? U.shortName(E.staffName(tk.waiterId)) : defWaiterShort;
      const tot = E.totals(tk, now);
      const dur = U.duration(now - tk.openedAt);
      if (tk.status === "locked") return { status: "locked", label: "Đã in tạm tính", sub: U.moneyPlain(tot.grand) + (wShort ? " · " + wShort : ""), ticket: tk, totals: tot, waiterId: tk.waiterId, waiterName: wShort, icon: "lock" };
      if (tk.prebillOutdated) return { status: "active", label: "Cần in lại tạm tính", sub: U.moneyPlain(tot.grand) + (wShort ? " · " + wShort : ""), ticket: tk, totals: tot, waiterId: tk.waiterId, waiterName: wShort, icon: "triangle-alert", tone: "warning" };
      if (tot.pendingWeigh) return { status: "weigh", label: "Chờ cân hải sản", sub: dur + (wShort ? " · " + wShort : ""), ticket: tk, totals: tot, waiterId: tk.waiterId, waiterName: wShort, icon: "scale" };
      return { status: "active", label: dur, sub: U.moneyPlain(tot.grand) + (wShort ? " · " + wShort : ""), ticket: tk, totals: tot, waiterId: tk.waiterId, waiterName: wShort, icon: null };
    }
    const ts = D().tableState[table.id];
    if (ts && ts.status === "dirty") return { status: "dirty", label: "Cần dọn", sub: "Từ " + U.time(ts.since) + (defWaiterShort ? " · " + defWaiterShort : ""), waiterId: defWaiterId, waiterName: defWaiterShort, icon: "sparkles" };
    const bk = E.bookingForTable(table.id, now);
    if (bk) return { status: "booked", label: "Đặt " + bk.time, sub: bk.name + " · " + bk.guests + " khách", booking: bk, waiterId: defWaiterId, waiterName: defWaiterShort, icon: "calendar-clock" };
    return { status: "empty", label: "Trống", sub: table.seats + " chỗ" + (defWaiterShort ? " · " + defWaiterShort : ""), waiterId: defWaiterId, waiterName: defWaiterShort, icon: null };
  };
  E.STATUS_LABEL = { empty: "Trống", booked: "Đặt trước", active: "Đang phục vụ", weigh: "Chờ cân", locked: "Đã in tạm tính", dirty: "Cần dọn" };

  E.openTable = function (tableId, opts) {
    opts = opts || {};
    if (E.ticketByTable(tableId)) return E.ticketByTable(tableId);
    const bk = opts.bookingId ? D().bookings.find((b) => b.id === opts.bookingId) : E.bookingForTable(tableId);
    const id = U.uid("tk");
    const waiterId = opts.waiterId || E.defaultWaiterForTable(tableId) || null;
    const tk = {
      id,
      tableId,
      payCode: E.generatePayCode(tableId, id),
      status: "open",
      guests: opts.guests || (bk ? bk.guests : 2),
      openedAt: opts.at || Date.now(),
      waiterId,
      items: [],
      payments: [],
    };
    if (bk && bk.depositPaid) {
      tk.bookingId = bk.id;
      tk.deposit = bk.deposit;
      bk.status = "seated";
    }
    D().tickets.push(tk);
    delete D().tableState[tableId];
    return tk;
  };

  function assertEditable(tk) {
    if (!tk) fail("Không tìm thấy bill.");
    if (tk.status === "locked") fail("Bill đã khóa sau khi in tạm tính. Cần gửi yêu cầu mở khóa.");
    if (tk.status === "paid") fail("Bill đã thanh toán.");
    if (E.isShiftLocked()) fail("Ca đã tự khóa sổ. Không thể ghi thêm giao dịch.");
  }

  // items: [{menuId, qty, styleId, note, count, kg, gram, saleMode, sourceFishId, fishIds, dealAmount, bargain}]
  E.addItems = function (ticketId, items, by, at) {
    const tk = E.ticket(ticketId);
    assertEditable(tk);
    const now = at || Date.now();
    const added = [];
    const pendingBargains = [];
    const staffObj = by ? E.staff(by) : null;
    const role = staffObj ? staffObj.role : "waiter";
    items.forEach((x) => {
      const m = E.menu(x.menuId);
      if (!m) return;
      const it = { id: U.uid("it"), menuId: m.id, name: m.name, qty: Number(x.qty) || 1, price: m.price || 0, styleId: x.styleId || (m.styles && m.styles[0]) || null, note: x.note || "", addedBy: by, sentAt: now, status: "sent" };
      if (m.kind === "seafood") {
        it.qty = 1;
        it.pricePerKg = m.pricePerKg;
        const tank = E.syncTank(m.id);
        const isGramMode = x.saleMode === "gram" || (!E.isCountableSeafood(m) && (Number(x.gram) || 0) > 0);
        if (isGramMode) {
          // Ban le theo gram / cat khuc (vd: 500gr ca mu / ca chem)
          const minG = Number(E.seafoodPolicy().minGram) || 100;
          const reqGram = Math.max(minG, Math.round(Number(x.gram) || Math.round(((Number(x.kg) || 0.5) * 1000))));
          const reqKg = Math.round((reqGram / 1000) * 100) / 100;
          it.saleMode = "gram";
          it.gram = reqGram;
          it.kg = reqKg;
          it.count = 0;
          if (E.isCountableSeafood(m) && tank && Array.isArray(tank.items) && tank.items.length) {
            let needKg = reqKg;
            const cutParts = [];
            const prefId = x.sourceFishId || (Array.isArray(x.fishIds) && x.fishIds[0]) || null;
            const orderIndices = tank.items.map((_, i) => i).sort((a, b) => {
              const fa = tank.items[a], fb = tank.items[b];
              const pa = prefId && (fa.id === prefId || fa.code === prefId) ? 2 : fa.partial ? 1 : 0;
              const pb = prefId && (fb.id === prefId || fb.code === prefId) ? 2 : fb.partial ? 1 : 0;
              return pb - pa;
            });
            for (let k = 0; k < orderIndices.length && needKg > 0.009; k++) {
              const f = tank.items[orderIndices[k]];
              if (!f || !(f.kg > 0)) continue;
              const takeKg = Math.round(Math.min(f.kg, needKg) * 100) / 100;
              if (takeKg <= 0) continue;
              if (!f.origKg) f.origKg = f.kg;
              f.kg = Math.round((f.kg - takeKg) * 100) / 100;
              f.partial = true;
              needKg = Math.round((needKg - takeKg) * 100) / 100;
              cutParts.push({
                id: f.id,
                code: f.code || ("#" + f.id),
                takeKg,
                takeGram: Math.round(takeKg * 1000),
                leftKg: f.kg,
              });
            }
            tank.items = tank.items.filter((f) => (Number(f.kg) || 0) > 0.04);
            E.syncTank(m.id);
            it.cutFrom = cutParts;
            it.fishCodes = cutParts.map((c) => c.code + " (cắt " + c.takeGram + "g)");
            it.fishSummary = reqGram + "g (" + U.num(reqKg, 2) + " kg" + (cutParts.length ? " · cắt từ " + cutParts.map((c) => c.code).join(", ") : "") + ")";
          } else {
            it.fishSummary = reqGram + "g (" + U.num(reqKg, 2) + " kg)";
            if (tank) {
              tank.kg = Math.max(0, Math.round(((tank.kg || 0) - reqKg) * 100) / 100);
            }
          }
        } else if (E.isCountableSeafood(m)) {
          it.saleMode = "whole";
          let picked = [];
          const wantIds = Array.isArray(x.fishIds) ? x.fishIds : x.fishId ? [x.fishId] : [];
          if (wantIds.length && tank && Array.isArray(tank.items)) {
            wantIds.forEach((fid) => {
              const idx = tank.items.findIndex((f) => f.id === fid || f.code === fid);
              if (idx >= 0) picked.push(tank.items.splice(idx, 1)[0]);
            });
          }
          if (!picked.length && tank && Array.isArray(tank.items) && tank.items.length) {
            const needCount = Math.max(1, Number(x.count) || 1);
            picked = tank.items.splice(0, Math.min(needCount, tank.items.length));
          }
          if (picked.length) {
            it.count = picked.length;
            it.kg = Math.round(picked.reduce((s, f) => s + (Number(f.kg) || 0), 0) * 100) / 100;
            it.fishIds = picked.map((f) => f.id);
            it.fishItems = picked.map((f) => Object.assign({}, f));
            it.fishCodes = picked.map((f) => (f.code || ("#" + f.id)) + " (" + U.num(f.kg, 2) + " kg)");
            it.fishSummary = it.fishCodes.join(", ");
            E.syncTank(m.id);
          } else {
            it.count = Math.max(1, Number(x.count) || 1);
            it.kg = Math.round(((Number(x.kg) || 0) > 0 ? Number(x.kg) : it.count * (Number(m.avgKgPerPiece) || 0.9)) * 100) / 100;
            if (tank) {
              tank.count = Math.max(0, (tank.count || 0) - it.count);
              tank.kg = Math.max(0, Math.round(((tank.kg || 0) - it.kg) * 100) / 100);
            }
          }
          // Xu ly khach ep gia / thuong luong gia khi mua nguyen con
          const rawDeal = x.dealAmount !== undefined ? x.dealAmount : x.bargain && x.bargain.dealAmount;
          if (rawDeal !== undefined && rawDeal !== null && Number(rawDeal) > 0) {
            const bg = E.evaluateSeafoodBargain(m, it.kg, rawDeal, role);
            if (bg.belowCost && E.seafoodPolicy().blockBelowCost && role !== "owner") {
              fail("Giá khách ép (" + U.money(bg.dealAmount) + ") thấp hơn giá vốn nhập bể (" + U.money(bg.costAmount) + "). Không thể chốt dưới giá vốn.");
            }
            if (bg.discount > 0) {
              it.dealAmount = bg.dealAmount;
              it.bargain = {
                listAmount: bg.listAmount,
                dealAmount: bg.dealAmount,
                discount: bg.discount,
                pct: bg.pct,
                effectivePpk: bg.effectivePpk,
                note: (x.bargain && x.bargain.note) || "Khách mua nguyên con ép giá",
                status: bg.needsApproval ? "pending" : "approved",
                by,
              };
              if (bg.needsApproval) pendingBargains.push({ it, bg, m });
            }
          }
        } else {
          // Hai san can theo kg (vd: Oc huong)
          const reqKg = Math.round(((Number(x.kg) || 0) > 0 ? Number(x.kg) : 0.5) * 100) / 100;
          it.saleMode = "kg";
          it.count = 0;
          it.kg = reqKg;
          it.gram = Math.round(reqKg * 1000);
          it.fishSummary = Math.round(reqKg * 1000) + "g (" + U.kg(reqKg) + ")";
          if (tank) {
            tank.kg = Math.max(0, Math.round(((tank.kg || 0) - reqKg) * 100) / 100);
          }
        }
        it.status = "sent";
        it.weighedAt = now;
        it.weighedBy = by || "system";
        const table = E.table(tk.tableId);
        const st = it.styleId ? E.style(it.styleId) : null;
        const tagRows = [
          { l: m.name, big: true },
          { l: it.saleMode === "gram" ? "Định lượng cắt lẻ" : "Mã cá / Khối lượng", r: it.fishSummary || U.kg(it.kg) },
          { l: "Chế biến", r: st ? st.name : "Theo yêu cầu" },
          it.bargain ? { l: "Giá chốt nguyên con", r: U.money(it.dealAmount) + " (-" + U.money(it.bargain.discount) + ")" } : null,
          { l: "Thành tiền", r: U.money(E.itemAmount(it)) },
        ].filter(Boolean);
        if (table) {
          E.print("p_tank", { kind: "tag", title: "PHIẾU BẮT CÁ & CHẾ BIẾN BẾP", big: table.code, rows: tagRows, footer: ["Gọi lúc " + U.time(now) + " · " + E.staffName(by)] });
        }
      } else {
        if (m.kind === "beer") {
          it.broughtOutQty = it.qty;
          it.returnedQty = 0;
        }
        consumeStock(m, it.qty, 1);
      }
      tk.items.push(it);
      added.push(it);
    });
    const table = E.table(tk.tableId);
    pendingBargains.forEach(({ it, bg, m }) => {
      E.createApproval({
        type: "seafood_bargain",
        by,
        ref: tk.id,
        itemId: it.id,
        title: "Duyệt giá ép cá nguyên con bàn " + (table ? table.code : tk.tableId) + ": " + m.name,
        amount: bg.discount,
        reason: "Niêm yết " + U.money(bg.listAmount) + " -> Khách trả " + U.money(bg.dealAmount) + " (giảm " + U.money(bg.discount) + " · -" + bg.pct + "% · " + it.fishSummary + "). " + (it.bargain.note || ""),
        payload: { ticketId: tk.id, itemId: it.id, dealAmount: bg.dealAmount, listAmount: bg.listAmount, pct: bg.pct },
      });
    });
    if (!tk.waiterId && by) {
      const st = E.staff(by);
      if (st && st.role === "waiter") tk.waiterId = by;
    }
    const free = E.applyPromos(tk, now);
    E.printKitchen(tk, added.filter((i) => i.status === "sent").concat(free), now);
    return { added, free, pendingBargains: pendingBargains.length };
  };

  function consumeStock(m, qty, sign) {
    const d = D();
    if (m.bom) m.bom.forEach((b) => (d.stock[b.bagId] = (d.stock[b.bagId] || 0) - sign * b.qty * qty));
    if (d.drinks[m.id] !== undefined) d.drinks[m.id] -= sign * qty;
  }

  E.promoGivenToday = function (brandId) {
    const key = U.dayKey();
    let n = 0;
    const promoIds = C().promos.filter((p) => p.brandId === brandId && p.source === "brand").map((p) => p.id);
    const count = (items, when) => items.forEach((i) => { if (i.isFree && promoIds.includes(i.promoId) && i.status !== "void" && U.dayKey(i.sentAt || when) === key) n += i.qty; });
    D().tickets.forEach((t) => count(t.items, t.openedAt));
    D().sales.filter((s) => s.dayKey === key).forEach((s) => count(s.lines, s.closedAt));
    return n;
  };
  E.promoQuotaRemaining = function (brandId) {
    const q = (C().pg.brandQuotaPerShift || {})[brandId];
    if (q === undefined || q === null || q === "") return Infinity;
    return Math.max(0, Number(q) - E.promoGivenToday(brandId));
  };

  // Tu dong them dong bia tang theo luat Mua X tang Y dang bat
  E.applyPromos = function (tk, at) {
    const added = [];
    C().promos.filter((p) => p.active && p.menuId).forEach((p) => {
      const paid = U.sum(tk.items.filter((i) => i.menuId === p.menuId && !i.isFree && i.status !== "void"), (i) => i.qty);
      const should = Math.floor(paid / p.buyQty) * p.freeQty;
      const have = U.sum(tk.items.filter((i) => i.menuId === p.menuId && i.isFree && i.promoId === p.id && i.status !== "void"), (i) => i.qty);
      let diff = should - have;
      if (diff <= 0) return;
      if (p.source === "brand") diff = Math.min(diff, E.promoQuotaRemaining(p.brandId));
      if (diff <= 0) return;
      const m = E.menu(p.menuId);
      const it = { id: U.uid("it"), menuId: m.id, name: m.name, qty: diff, price: 0, isFree: true, promoId: p.id, addedBy: "system", sentAt: at || Date.now(), status: "sent", note: p.name };
      if (p.source === "house" || p.source === "brand") consumeStock(m, diff, 1);
      tk.items.push(it);
      added.push(it);
    });
    return added;
  };

  // Dong bo lai bia tang khuyen mai khi khach huy bớt bia tinh tien
  E.reconcilePromos = function (tk) {
    if (!tk || !Array.isArray(tk.items)) return;
    C().promos.filter((p) => p.active && p.menuId).forEach((p) => {
      const paid = U.sum(tk.items.filter((i) => i.menuId === p.menuId && !i.isFree && i.status !== "void"), (i) => i.qty);
      const should = Math.floor(paid / p.buyQty) * p.freeQty;
      const freeItems = tk.items.filter((i) => i.menuId === p.menuId && i.isFree && i.promoId === p.id && i.status !== "void");
      let have = U.sum(freeItems, (i) => i.qty);
      let excess = have - should;
      if (excess <= 0) return;
      const m = E.menu(p.menuId);
      for (let idx = freeItems.length - 1; idx >= 0 && excess > 0; idx--) {
        const fi = freeItems[idx];
        const reduce = Math.min(excess, fi.qty);
        if (reduce >= fi.qty) {
          fi.status = "void";
          fi.voidReason = "Tự động thu hồi khuyến mãi do hủy món chính";
        } else {
          fi.qty -= reduce;
        }
        if (m && (p.source === "house" || p.source === "brand")) consumeStock(m, reduce, -1);
        excess -= reduce;
      }
    });
  };

  E.pendingTicketApprovals = function (ticketId) {
    if (!ticketId) return [];
    return (D().approvals || []).filter((a) => a.status === "pending" && a.ref === ticketId);
  };

  // Tong hop so luong bia (da dem ra ban, da tra lai, dang tinh tien, bia tang) tren 1 ticket theo menuId
  E.beerSummaryOnTicket = function (tk, menuId) {
    if (!tk || !Array.isArray(tk.items)) return null;
    const m = E.menu(menuId);
    if (!m) return null;
    const paidLines = tk.items.filter((i) => i.menuId === menuId && !i.isFree && i.status !== "void");
    const voidReturnedLines = tk.items.filter((i) => i.menuId === menuId && !i.isFree && i.status === "void" && Number(i.returnedQty) > 0);
    const freeLines = tk.items.filter((i) => i.menuId === menuId && i.isFree && i.status !== "void");
    const paidQty = U.sum(paidLines, (i) => Number(i.qty) || 0);
    const returnedQty =
      U.sum(paidLines, (i) => Number(i.returnedQty) || 0) +
      U.sum(voidReturnedLines, (i) => Number(i.returnedQty) || 0);
    const broughtOutQty = paidQty + returnedQty;
    const freeQty = U.sum(freeLines, (i) => Number(i.qty) || 0);
    const cs = Number(m.caseSize) || 24;
    const unit = m.unit || "lon";
    const promo = C().promos.find((p) => p.active && p.menuId === menuId) || null;
    return {
      menuId,
      menuName: m.name,
      price: Number(m.price) || 0,
      caseSize: cs,
      unit,
      broughtOutQty,
      returnedQty,
      paidQty,
      billedQty: paidQty,
      freeQty,
      promo,
      paidLines,
    };
  };

  // Tra lai bia du (lon / chai chua khui) khi khach goi nguyen thung / ket nhung khong uong het
  // opts: { itemId, menuId, returnQty, consumedQty, by, note }
  E.returnUnusedBeer = function (ticketId, opts) {
    opts = opts || {};
    const tk = E.ticket(ticketId);
    if (!tk) fail("Không tìm thấy bill.");
    if (tk.status === "paid") fail("Bill đã thanh toán.");
    if (E.isShiftLocked()) fail("Ca đã tự khóa sổ. Không thể điều chỉnh thêm.");

    let targetItem = opts.itemId ? tk.items.find((i) => i.id === opts.itemId) : null;
    const menuId = opts.menuId || (targetItem && targetItem.menuId);
    const m = E.menu(menuId);
    if (!m) fail("Không tìm thấy sản phẩm bia cần trả.");
    const unit = m.unit || "lon";
    const cs = Number(m.caseSize) || 24;

    // Uu tien tru tren dong item duoc chon truoc, sau do den cac dong bia cung loai tren ban
    let paidLines = tk.items.filter((i) => i.menuId === m.id && !i.isFree && i.status !== "void");
    if (!paidLines.length) fail("Bàn hiện không còn " + m.name + " đang tính tiền để trả lại.");
    if (targetItem && !targetItem.isFree && targetItem.status !== "void") {
      paidLines = [targetItem].concat(paidLines.filter((i) => i.id !== targetItem.id));
    } else {
      paidLines = paidLines.slice().reverse();
    }

    const currentPaid = U.sum(paidLines, (i) => Number(i.qty) || 0);
    let returnQty = 0;
    if (opts.consumedQty !== undefined && opts.consumedQty !== null && opts.consumedQty !== "") {
      const consumed = Math.max(0, Math.round(Number(opts.consumedQty) || 0));
      if (consumed >= currentPaid) fail("Số " + unit + " thực uống (" + consumed + ") phải nhỏ hơn số lượng đang ghi trên bàn (" + currentPaid + " " + unit + ").");
      returnQty = currentPaid - consumed;
    } else {
      returnQty = Math.round(Number(opts.returnQty) || 0);
    }

    if (returnQty <= 0) fail("Vui lòng nhập số " + unit + " trả lại lớn hơn 0.");
    if (returnQty > currentPaid) {
      fail("Số " + unit + " trả lại (" + returnQty + ") vượt quá số lượng đang tính tiền tại bàn (" + currentPaid + " " + unit + ").");
    }

    const beforeTot = E.totals(tk);
    const beforeGrand = beforeTot.grand;
    const wasLockedOrPrebilled = tk.status === "locked" || !!tk.prebillAt || (Number(tk.prebillCount) || 0) > 0;
    const oldPrebillAt = tk.prebillAt || null;

    const freeBefore = U.sum(tk.items.filter((i) => i.menuId === m.id && i.isFree && i.status !== "void"), (i) => Number(i.qty) || 0);
    let rem = returnQty;
    for (let idx = 0; idx < paidLines.length && rem > 0; idx++) {
      const li = paidLines[idx];
      const curQ = Number(li.qty) || 0;
      if (curQ <= 0) continue;
      if (!li.broughtOutQty) li.broughtOutQty = curQ + (Number(li.returnedQty) || 0);
      const take = Math.min(rem, curQ);
      li.qty = curQ - take;
      li.returnedQty = (Number(li.returnedQty) || 0) + take;
      if (li.qty <= 0) {
        li.status = "void";
        li.voidBy = opts.by || "system";
        li.voidReason = "Trả lại toàn bộ " + li.broughtOutQty + " " + unit + " bia chưa khui";
      }
      rem -= take;
    }

    // Hoan lai ton kho bia ngay lap tuc
    consumeStock(m, returnQty, -1);
    // Tu dong dong bo lai bia tang khuyen mai (neu co)
    E.reconcilePromos(tk);

    const afterPaid = currentPaid - returnQty;
    const freeAfter = U.sum(tk.items.filter((i) => i.menuId === m.id && i.isFree && i.status !== "void"), (i) => Number(i.qty) || 0);
    const freeRevoked = Math.max(0, freeBefore - freeAfter);
    const summary = E.beerSummaryOnTicket(tk, m.id);
    const tbl = E.table(tk.tableId);
    const tblCode = (tbl && tbl.code) || tk.tableId;
    const afterTot = E.totals(tk);
    const afterGrand = afterTot.grand;

    if (wasLockedOrPrebilled) {
      const now = Date.now();
      const reasonText =
        "Trả dư " +
        returnQty +
        " " +
        unit +
        " " +
        m.name +
        (freeRevoked > 0 ? " (thu hồi " + freeRevoked + " " + unit + " KM)" : "") +
        " · Bill giảm từ " +
        U.money(beforeGrand) +
        " xuống " +
        U.money(afterGrand);
      // 1. Danh dau tat ca phieu tam tinh cu cua bill nay trong printLog la HET HIEU LUC
      (D().printLog || []).forEach((p) => {
        if (
          p.kind === "prebill" &&
          !p.superseded &&
          (p.ticketId === tk.id || (!p.ticketId && Array.isArray(p.meta) && p.meta.some((x) => x.l === "Bàn" && x.r === tblCode)))
        ) {
          p.superseded = true;
          p.invalidatedAt = now;
          p.invalidatedBy = opts.by || "system";
          p.invalidatedReason = reasonText;
          p.title = "PHIẾU TẠM TÍNH (HẾT HIỆU LỰC)";
          p.footer = Array.isArray(p.footer) ? p.footer.slice() : [];
          p.footer.unshift("⚠ PHIẾU CŨ HẾT HIỆU LỰC LÚC " + U.time(now) + " (" + reasonText + ")");
        }
      });
      // 2. Chuyen trang thai bill khoi 'locked' va bat canh bao can in lai tam tinh + luu dau vet rieng
      tk.status = "open";
      tk.prebillOutdated = true;
      tk.prebillInvalidatedAt = now;
      tk.prebillInvalidatedBy = opts.by || "system";
      tk.prebillInvalidatedReason = reasonText;
      tk.prebillAt = null;
      tk.postPrebillAdjustments = Array.isArray(tk.postPrebillAdjustments) ? tk.postPrebillAdjustments : [];
      tk.postPrebillAdjustments.unshift({
        id: U.uid("adj"),
        at: now,
        by: opts.by || "system",
        byName: E.staffName(opts.by || "system"),
        type: "return_beer",
        menuId: m.id,
        menuName: m.name,
        qty: returnQty,
        returned: returnQty,
        unit,
        freeRevoked,
        beforeGrand,
        afterGrand,
        diffAmount: beforeGrand - afterGrand,
        deductedAmount: beforeGrand - afterGrand,
        oldPrebillAt,
        note: opts.note || "Trả bia dư chưa khui sau khi đã in tạm tính",
      });
      // 3. Ghi dau vet rieng vao Nhat ky Kiem toan (audit / auditLog)
      if (window.Store && Store.audit) {
        Store.audit(
          "Sửa sau tạm tính [Bàn " + tblCode + "]: " + reasonText + " · Đã đánh dấu phiếu tạm tính cũ hết hiệu lực",
          opts.by || "system",
          {
            type: "post_prebill_return_beer",
            action: "Trả bia sau tạm tính (Hủy phiếu cũ)",
            detail: "Bàn " + tblCode + ": " + reasonText + " · Phiếu tạm tính cũ đã hết hiệu lực, yêu cầu in lại phiếu mới",
            ticketId: tk.id,
            tableCode: tblCode,
            beforeGrand,
            afterGrand,
          }
        );
      }
    }

    const refundAmt = returnQty * (Number(m.price) || 0);
    return {
      ok: true,
      ticketId: tk.id,
      tableCode: tblCode,
      menuId: m.id,
      menuName: m.name,
      unit,
      caseSize: cs,
      returned: returnQty,
      broughtOut: summary ? summary.broughtOutQty : currentPaid,
      beforePaid: currentPaid,
      afterPaid,
      remainingBilled: afterPaid,
      freeBefore,
      freeAfter,
      freeRevoked,
      refundAmount: refundAmt,
      deductedAmount: refundAmt,
      beforeGrand,
      afterGrand,
      prebillInvalidated: wasLockedOrPrebilled,
      invalidatedPrebill: wasLockedOrPrebilled,
    };
  };

  E.removeQtyFromCartNotSent = null; // gio hang chua gui duoc xu ly o giao dien

  E.markServed = function (ticketId, itemId) {
    const tk = E.ticket(ticketId);
    const it = tk && tk.items.find((i) => i.id === itemId);
    if (it && it.status === "sent") it.status = "served";
  };

  // Yeu cau huy mon da gui bep -> Thu ngan kiem Quan ly duoc huy nhanh trong han muc, vuot han muc chuyen Chu quan
  E.requestVoid = function (ticketId, itemId, reason, by) {
    const tk = E.ticket(ticketId);
    const it = tk && tk.items.find((i) => i.id === itemId);
    if (!it) fail("Không tìm thấy món.");
    if (it.status === "pending_weigh") {
      it.status = "void";
      it.voidReason = reason || "Hủy trước khi cân";
      return { done: true };
    }
    const st = E.staff(by);
    const amt = E.itemAmount(it);
    const pCash = (C().permissions && C().permissions.cashier) || {};
    const maxVoid = Number(pCash.approveVoidUnder) || 200000;
    if (st && st.role === "owner") {
      voidItem(tk, it, reason, by);
      return { done: true };
    }
    if (tk.status === "locked") fail("Bill đã khóa. Hãy mở khóa bill trước.");
    if (st && st.role === "cashier" && pCash.voidAfterPrint !== false && amt <= maxVoid) {
      voidItem(tk, it, reason, by);
      D().approvals.unshift({
        id: U.uid("ap"),
        type: "void_item",
        status: "approved",
        at: Date.now(),
        by,
        resolvedBy: by,
        resolvedAt: Date.now(),
        resolveNote: "Thu ngân kiêm Quản lý xử lý trực tiếp tại quầy (trong hạn mức " + U.money(maxVoid) + ")",
        ref: tk.id,
        itemId,
        title: "Hủy món: " + it.name + " (" + E.table(tk.tableId).code + ")",
        amount: amt,
        reason: reason || "",
      });
      return { done: true, autoApproved: true };
    }
    it.voidRequested = true;
    const ap = E.createApproval({
      type: "void_item",
      by,
      ref: tk.id,
      itemId,
      title: "Hủy món: " + it.name + " (" + E.table(tk.tableId).code + ")",
      amount: amt,
      reason: reason || "",
    });
    return { done: false, escalated: E.approvalTier(ap) === "owner", approval: ap };
  };
  function voidItem(tk, it, reason, by) {
    const prevStatus = it.status;
    it.status = "void";
    it.voidReason = reason;
    it.voidBy = by;
    it.voidRequested = false;
    // Tu dong dong yeu cau duyet ep gia ca dang cho (neu co) cua mon bi huy
    (D().approvals || []).forEach((ap) => {
      if (ap.status === "pending" && ap.ref === tk.id && ap.itemId === it.id && ap.type === "seafood_bargain") {
        ap.status = "rejected";
        ap.resolvedBy = by || "system";
        ap.resolvedAt = Date.now();
        ap.resolveNote = "Tự động đóng do món đã bị hủy";
      }
    });
    const m = E.menu(it.menuId);
    if (!m) return;
    if (m.kind === "seafood" && prevStatus === "sent") {
      // Neu chua che bien/ra mon, hoan ca lai vao be (ca nguyen con hoac phan cat le theo gram)
      const tank = E.syncTank(m.id);
      if (tank) {
        if (E.isCountableSeafood(m) && Array.isArray(it.fishItems) && it.fishItems.length) {
          it.fishItems.forEach((f) => tank.items.push(Object.assign({}, f)));
          E.syncTank(m.id);
        } else if (E.isCountableSeafood(m) && Array.isArray(it.cutFrom) && it.cutFrom.length) {
          it.cutFrom.forEach((part) => {
            const exist = (tank.items || []).find((f) => f.id === part.id || f.code === part.code);
            if (exist) {
              exist.kg = Math.round(((Number(exist.kg) || 0) + (Number(part.takeKg) || 0)) * 100) / 100;
              if (exist.origKg && Math.abs(exist.kg - exist.origKg) < 0.02) exist.partial = false;
            } else {
              tank.items.push({
                id: part.id,
                code: part.code,
                kg: Math.round((Number(part.takeKg) || 0) * 100) / 100,
                partial: true,
              });
            }
          });
          E.syncTank(m.id);
        } else {
          tank.kg = Math.round(((tank.kg || 0) + (Number(it.kg) || 0)) * 100) / 100;
        }
      }
    } else if (m.kind !== "seafood") {
      consumeStock(m, it.qty, -1);
      if (m.kind === "beer") E.reconcilePromos(tk);
    }
  }

  /* ---------- Don bep & Be hai san (Kiosk) ---------- */
  E.kitchenQueue = function () {
    const q = [];
    E.openTickets().forEach((tk) => {
      const tb = E.table(tk.tableId);
      (tk.items || []).forEach((it) => {
        const m = E.menu(it.menuId);
        if (!m || m.kind === "beer" || m.kind === "drink") return;
        if (it.status === "sent" || it.status === "pending_weigh") {
          q.push({
            ticket: tk,
            item: it,
            table: tb,
            menu: m,
            waitMs: Date.now() - (it.sentAt || tk.openedAt),
          });
        }
      });
    });
    return q.sort((a, b) => (a.item.sentAt || 0) - (b.item.sentAt || 0));
  };

  E.weighQueue = function () {
    const q = [];
    E.openTickets().forEach((tk) => tk.items.forEach((it) => { if (it.status === "pending_weigh") q.push({ ticket: tk, item: it, table: E.table(tk.tableId), menu: E.menu(it.menuId), waitMs: Date.now() - it.sentAt }); }));
    return q.sort((a, b) => a.item.sentAt - b.item.sentAt);
  };
  E.confirmWeigh = function (ticketId, itemId, kg, count, by) {
    const tk = E.ticket(ticketId);
    if (!tk) fail("Không tìm thấy bill.");
    const it = tk.items.find((i) => i.id === itemId);
    if (!it || it.status !== "pending_weigh") fail("Lệnh cân không còn hiệu lực.");
    kg = Math.round(Number(kg) * 100) / 100;
    if (!(kg > 0)) fail("Khối lượng phải lớn hơn 0.");
    const tank = D().tank[it.menuId];
    if (tank && tank.kg < kg) fail("Khối lượng vượt quá tồn bể trên hệ thống (" + U.kg(tank.kg) + "). Kiểm tra lại cân hoặc nhập kho.");
    it.kg = kg;
    it.count = Number(count) || 0;
    it.status = "sent";
    it.weighedAt = Date.now();
    it.weighedBy = by;
    if (tank) {
      tank.kg = Math.round((tank.kg - kg) * 100) / 100;
      tank.count = Math.max(0, tank.count - it.count);
    }
    const table = E.table(tk.tableId);
    const m = E.menu(it.menuId);
    const st = it.styleId ? E.style(it.styleId) : null;
    const tagRows = [
      { l: m.name, big: true },
      { l: "Chế biến", r: st ? st.name : "Theo yêu cầu" },
      { l: "Khối lượng", r: U.kg(kg) },
      { l: "Số con", r: String(it.count || "-") },
      { l: "Thành tiền", r: U.money(E.itemAmount(it)) },
    ];
    E.print("p_tank", { kind: "tag", title: "TEM HẢI SẢN - LIÊN 1 (GẮN VÀO HẢI SẢN)", big: table.code, rows: tagRows, footer: ["Cân lúc " + U.time(it.weighedAt) + " · " + E.staffName(by)] });
    E.print("p_tank", { kind: "tag", title: "TEM HẢI SẢN - LIÊN 2 (KẸP PHIẾU BẾP)", big: table.code, rows: tagRows.slice(0, 4), footer: ["Mã lệnh " + it.id.slice(-6).toUpperCase()] });
    E.printKitchen(tk, [it]);
    notify("weighed", { ticketId: tk.id, waiterId: tk.waiterId, text: "Bàn " + table.code + ": " + m.name + " " + U.kg(kg) + " đã cân" });
    return it;
  };

  /* ---------- In phieu K80 ---------- */
  E.print = function (printerId, doc) {
    let p = E.printer(printerId);
    let rerouted = false;
    if (p && !p.online && p.backupId) {
      const b = E.printer(p.backupId);
      if (b && b.online) {
        rerouted = p.name;
        p = b;
      }
    }
    const entry = Object.assign({ id: U.uid("pr"), at: Date.now(), printerId: p ? p.id : printerId, printerName: p ? p.name : "Không có máy in", rerouted, failed: !p || !p.online }, doc);
    D().printLog.unshift(entry);
    if (D().printLog.length > 80) D().printLog.length = 80;
    return entry;
  };
  E.printKitchen = function (tk, items, at) {
    if (!items || !items.length) return;
    const table = E.table(tk.tableId);
    const byPrinter = {};
    items.forEach((it) => {
      const m = E.menu(it.menuId);
      const p = C().printers.find((pr) => pr.purpose !== "tag" && pr.purpose !== "bill" && (pr.categories || []).includes(m.categoryId));
      const pid = p ? p.id : "p_kitchen";
      (byPrinter[pid] = byPrinter[pid] || []).push(it);
    });
    Object.keys(byPrinter).forEach((pid) => {
      // Moi mon 1 phieu rieng de bep kep vao dia khi ra mon
      byPrinter[pid].forEach((it) => {
        const st = it.styleId ? E.style(it.styleId) : null;
        const m = E.menu(it.menuId);
        E.print(pid, {
          kind: "kitchen", title: "PHIẾU BẾP", big: table.code,
          rows: [
            { l: (m.kind === "seafood" ? "" : it.qty + " x ") + it.name, big: true },
            st ? { l: "Chế biến: " + st.name } : null,
            m.kind === "seafood" ? { l: "Khối lượng: " + U.kg(it.kg) + (it.count ? " · " + it.count + " con" : "") } : null,
            it.note ? { l: "Ghi chú: " + it.note } : null,
            it.isFree ? { l: "Hàng tặng - khuyến mãi" } : null,
          ].filter(Boolean),
          footer: ["Gửi lúc " + U.time(at || Date.now()) + " · " + E.staffName(it.addedBy)],
        });
      });
    });
  };

  /* ---------- Tam tinh, khoa bill, thanh toan ---------- */
  E.requestPrebill = function (ticketId, by) {
    const tk = E.ticket(ticketId);
    if (!tk) fail("Không tìm thấy bill.");
    if (tk.status === "locked") fail("Bàn này đã in tạm tính.");
    tk.prebillRequestedAt = Date.now();
    tk.prebillRequestedBy = by;
    notify("prebill_request", { ticketId, text: "Bàn " + E.table(tk.tableId).code + " yêu cầu in tạm tính" });
  };

  E.billDoc = function (tk, kind, extra) {
    const cfg = C();
    const table = E.table(tk.tableId);
    const tot = E.totals(tk, extra && extra.at);
    const rows = [];
    tk.items.filter((i) => i.status !== "void").forEach((it) => {
      const m = E.menu(it.menuId);
      const qtyLabel = m && m.kind === "seafood" ? (it.saleMode === "gram" && it.gram ? it.gram + "g" : U.num(it.kg, 2) + "kg") : String(it.qty);
      rows.push({ l: qtyLabel + " " + it.name + (it.isFree ? " (Tặng)" : ""), r: U.moneyPlain(E.itemAmount(it)) });
      const st = it.styleId ? E.style(it.styleId) : null;
      if (st) rows.push({ l: "   " + st.name + (st.surcharge ? " +" + U.moneyPlain(st.surcharge) : ""), small: true });
      if (it.bargain && it.bargain.discount > 0 && it.bargain.status !== "rejected") {
        rows.push({ l: "   Giá chốt nguyên con (-" + U.moneyPlain(it.bargain.discount) + ")", small: true });
      }
    });
    const sumRows = [{ l: "Cộng tiền hàng", r: U.moneyPlain(tot.subtotal) }];
    if (tot.vip) sumRows.push({ l: "Phụ thu phòng VIP (" + tot.vip.hours + " giờ)" + (tot.vip.waived ? " - miễn" : ""), r: U.moneyPlain(tot.vipFee) });
    if (tot.discount) sumRows.push({ l: "Giảm giá", r: "-" + U.moneyPlain(tot.discount) });
    if (!tot.inc) sumRows.push({ l: "Thuế GTGT", r: U.moneyPlain(tot.vatTotal) });
    sumRows.push({ l: "TỔNG CỘNG", r: U.moneyPlain(tot.grand), bold: true, big: true });
    if (tot.deposit) sumRows.push({ l: "Đã đặt cọc", r: "-" + U.moneyPlain(tot.deposit) });
    if (kind === "prebill" && tot.paid > 0) sumRows.push({ l: "Đã thu 1 phần (QR/TM)", r: "-" + U.moneyPlain(tot.paid) });
    if (tot.deposit || (kind === "prebill" && tot.paid > 0)) {
      sumRows.push({ l: "CÒN PHẢI TRẢ", r: U.moneyPlain(Math.max(0, tot.grand - tot.deposit - (kind === "prebill" ? tot.paid : 0))), bold: true });
    }
    const vatNote = tot.inc && cfg.receipt.showVatNote ? Object.keys(tot.vat).filter((g) => tot.vat[g].gross).map((g) => "Giá đã gồm VAT " + tot.vat[g].rate + "%: " + U.moneyPlain(tot.vat[g].vat)) : [];
    return Object.assign({
      kind, title: kind === "prebill" ? "PHIẾU TẠM TÍNH" : "HÓA ĐƠN THANH TOÁN",
      header: [cfg.store.name, cfg.store.address, "ĐT: " + cfg.store.phone],
      meta: [{ l: "Bàn", r: table.code }, { l: "Giờ vào", r: U.time(tk.openedAt) }, { l: kind === "prebill" ? "In lúc" : "Giờ ra", r: U.time((extra && extra.at) || Date.now()) }, { l: "Số khách", r: String(tk.guests || "") }, { l: "Phục vụ", r: tk.waiterId ? U.shortName(E.staffName(tk.waiterId)) : "-" }],
      rows, sumRows, vatNote,
      footer: [cfg.receipt.showWifi ? "Wi-Fi: " + cfg.store.wifiName + " / " + cfg.store.wifiPass : null, cfg.store.thanks].filter(Boolean),
    }, extra || {});
  };

  E.printPrebill = function (ticketId, by) {
    const tk = E.ticket(ticketId);
    if (!tk) fail("Không tìm thấy bill.");
    if (tk.status === "paid") fail("Bill đã thanh toán.");
    const tot = E.totals(tk);
    if (tot.pendingWeigh) fail("Còn " + tot.pendingWeigh + " món hải sản chưa cân. Hãy cân xong trước khi in tạm tính.");
    if (!tk.items.filter((i) => i.status !== "void").length) fail("Bill chưa có món nào.");
    const cfg = C();
    const tbl = E.table(tk.tableId);
    const tblCode = (tbl && tbl.code) || tk.tableId;
    const now = Date.now();
    // Neu in lai tam tinh, danh dau cac phieu tam tinh cu cua bill nay la da thay the
    (D().printLog || []).forEach((p) => {
      if (
        p.kind === "prebill" &&
        !p.superseded &&
        (p.ticketId === tk.id || (!p.ticketId && Array.isArray(p.meta) && p.meta.some((x) => x.l === "Bàn" && x.r === tblCode)))
      ) {
        p.superseded = true;
        p.invalidatedAt = now;
        p.invalidatedBy = by || "system";
        p.invalidatedReason = "Đã in phiếu tạm tính mới lúc " + U.time(now) + " (" + U.money(tot.grand) + ")";
        p.title = "PHIẾU TẠM TÍNH (HẾT HIỆU LỰC)";
      }
    });
    const amt = Math.max(0, tot.due !== undefined ? tot.due : tot.grand - tot.deposit);
    const payCode = E.ensurePayCode(tk);
    const doc = E.billDoc(tk, "prebill", {
      ticketId: tk.id,
      tableId: tk.tableId,
      tableCode: tblCode,
      qr: cfg.receipt.showQr ? U.vietQr(cfg.store.bankBin, cfg.store.bankAccount, amt, payCode) : null,
      qrLabel: "Quét VietQR · Nội dung định danh: " + payCode,
    });
    E.print("p_cashier", doc);
    tk.prebillAt = now;
    tk.prebillBy = by;
    tk.prebillCount = (tk.prebillCount || 0) + 1;
    tk.prebillRequestedAt = null;
    tk.prebillOutdated = false;
    tk.prebillInvalidatedReason = null;
    if (cfg.locks.prebillLock) tk.status = "locked";
    clearNotify("prebill_request", ticketId);
    return doc;
  };

  E.requestUnlock = function (ticketId, reason, by) {
    const tk = E.ticket(ticketId);
    if (!tk || tk.status !== "locked") fail("Bill không ở trạng thái khóa.");
    if (D().approvals.find((a) => a.type === "unlock_bill" && a.ref === ticketId && a.status === "pending")) fail("Đã có yêu cầu mở khóa đang chờ duyệt.");
    if (!reason || reason.trim().length < 3) fail("Vui lòng nhập lý do mở khóa.");
    const st = E.staff(by);
    const pCash = (C().permissions && C().permissions.cashier) || {};
    const maxUnlock = Number(pCash.maxSelfUnlockCount) || 1;
    const attempt = (tk.unlockCount || 0) + 1;
    const tableCode = (E.table(tk.tableId) || {}).code || tk.tableId;
    if (st && (st.role === "owner" || (st.role === "cashier" && pCash.reopenBill !== false && attempt <= maxUnlock))) {
      tk.status = "open";
      tk.unlockCount = attempt;
      tk.prebillAt = null;
      const ap = {
        id: U.uid("ap"),
        type: "unlock_bill",
        status: "approved",
        at: Date.now(),
        by,
        resolvedBy: by,
        resolvedAt: Date.now(),
        resolveNote:
          st.role === "owner"
            ? "Chủ quán mở khóa trực tiếp"
            : "Thu ngân kiêm Quản lý mở khóa trực tiếp (lần " + attempt + "/" + maxUnlock + ")",
        ref: ticketId,
        title: "Mở khóa bill bàn " + tableCode + " (Lần " + attempt + ")",
        amount: E.totals(tk).grand,
        reason,
        payload: { unlockAttempt: attempt },
      };
      D().approvals.unshift(ap);
      return { done: true, autoApproved: true, unlockCount: attempt, approval: ap };
    }
    const ap = E.createApproval({
      type: "unlock_bill",
      by,
      ref: ticketId,
      title: "Mở khóa bill bàn " + tableCode + (attempt > 1 ? " (Lần " + attempt + ")" : ""),
      amount: E.totals(tk).grand,
      reason,
      payload: { unlockAttempt: attempt },
    });
    return { done: false, escalated: E.approvalTier(ap) === "owner", unlockCount: attempt, approval: ap };
  };

  E.setDiscount = function (ticketId, type, value, reason, by) {
    const tk = E.ticket(ticketId);
    assertEditable(tk);
    const st = E.staff(by);
    const role = st ? st.role : "owner";
    const tot = E.totals(tk);
    const pct = type === "pct" ? Number(value) || 0 : ((Number(value) || 0) / Math.max(1, tot.subtotal)) * 100;
    const pctRound = Math.round(pct * 10) / 10;
    const maxPct = role === "owner" ? 100 : Number((C().permissions[role] || {}).discountMaxPct) || 0;
    if (!E.can(role, "discount") || pct > maxPct) {
      const ap = E.createApproval({
        type: "discount",
        by,
        ref: ticketId,
        title: "Giảm giá bàn " + E.table(tk.tableId).code + ": " + (type === "pct" ? value + "%" : U.money(value) + " (" + pctRound + "%)"),
        amount: type === "pct" ? Math.round((tot.subtotal * value) / 100) : Number(value) || 0,
        reason,
        payload: { type, value: Number(value) || 0, pct: pctRound },
      });
      return { pending: true, escalated: E.approvalTier(ap) === "owner", approval: ap };
    }
    tk.discount = { type, value: Number(value), reason, by };
    return { pending: false };
  };

  E.TIP_MODES = {
    personal: "Nhân viên đứng bàn nhận 100%",
    pool: "Chia đều toàn ca phục vụ",
    area: "Chia theo tổ khu vực bàn",
  };

  E.onDutyWaiters = function () {
    return E.onDuty().filter((s) => s.role === "waiter" && s.active);
  };

  // Tinh phan chia tien tip theo quy che (personal / pool / area) — Dong bo 100% voi trang thai cham cong trong ca
  E.computeTipShares = function (tk, tipAmount, tipMode, primaryStaffId) {
    tipAmount = Math.max(0, Math.round(Number(tipAmount) || 0));
    if (tipAmount <= 0) return [];
    const mode = tipMode || (C().payroll && C().payroll.tipPolicy) || "personal";
    const fallbackStaff = primaryStaffId || (tk && tk.waiterId) || E.defaultWaiterForTable(tk && tk.tableId) || "s_lan";
    let recipients = [];
    if (mode === "pool") {
      // Chi chia deu cho cac phuc vu THUC SU DANG TRONG CA (da cham cong check-in)
      const onDutyWaiters = E.onDutyWaiters();
      recipients = onDutyWaiters.length ? onDutyWaiters.map((s) => s.id) : [fallbackStaff];
    } else if (mode === "area") {
      // Chia deu cho cac phuc vu phu trach khu vuc/ban do dang trong ca (neu chua ai check-in thi ve nguoi dung ban)
      const areaWaiters = tk ? E.assignedWaitersForTable(tk.tableId) : [];
      const onDutyArea = areaWaiters.filter((s) => E.activeAtt(s.id));
      recipients = onDutyArea.length ? onDutyArea.map((s) => s.id) : areaWaiters.length ? [fallbackStaff] : [fallbackStaff];
    } else {
      recipients = [fallbackStaff];
    }
    recipients = Array.from(new Set(recipients.filter(Boolean)));
    if (!recipients.length) recipients = [fallbackStaff];
    const perHead = Math.floor(tipAmount / recipients.length);
    let rem = tipAmount - perHead * recipients.length;
    return recipients.map((sid, idx) => ({
      staffId: sid,
      amount: perHead + (idx === 0 ? rem : 0),
    }));
  };

  // Tinh tong tien tip 1 nhan vien duoc huong tu danh sach sales (ho tro ca tipShares chia deu va tipStaffId cu)
  E.tipEarnedByStaff = function (staffId, salesList) {
    return U.sum(salesList || [], (s) => {
      if (!s || !s.tip) return 0;
      if (Array.isArray(s.tipShares) && s.tipShares.length) {
        return U.sum(s.tipShares.filter((sh) => sh.staffId === staffId), (sh) => Number(sh.amount) || 0);
      }
      return s.tipStaffId === staffId ? Number(s.tip) || 0 : 0;
    });
  };

  // payments: [{method:'cash'|'qr'|'card', amount, received}]
  E.pay = function (ticketId, opts) {
    opts = opts || {};
    const tk = E.ticket(ticketId);
    if (!tk) fail("Không tìm thấy bill.");
    if (tk.status === "paid") fail("Bill đã thanh toán.");
    if (E.isShiftLocked() && !opts.force) fail("Ca đã tự khóa sổ. Không thể thu tiền thêm.");
    const at = opts.at || Date.now();
    const tot = E.totals(tk, at);
    if (tot.pendingWeigh) fail("Còn món hải sản chưa cân.");
    E.ensurePayCode(tk);
    const need = Math.max(0, tot.grand - tot.deposit);
    const priorPays = !opts.ignorePriorPayments && Array.isArray(tk.payments)
      ? tk.payments.filter((p) => p && p.amount > 0)
      : [];
    const seenTx = new Set(priorPays.map((p) => p.txId).filter(Boolean));
    const newPays = (opts.payments || []).filter((p) => p && p.amount > 0 && (!p.txId || !seenTx.has(p.txId)));
    const pays = priorPays.concat(newPays);
    const paid = U.sum(pays, (p) => p.amount);
    if (paid < need) fail("Số tiền thanh toán còn thiếu " + U.money(need - paid) + ".");
    // Tien du qua VietQR (hoac tien mat neu chon cashOverAsTip) -> ghi nhan tip; con lai -> tien thoi
    let tip = Math.max(0, Number(opts.explicitTip) || 0);
    let change = 0;
    const over = paid - need;
    if (over > 0 && !opts.explicitTip) {
      const qrPaid = U.sum(pays.filter((p) => p.method === "qr"), (p) => p.amount);
      if (opts.overAsTip && qrPaid > 0) tip = Math.min(over, qrPaid);
      else if (opts.cashOverAsTip) tip = over;
      change = Math.max(0, over - tip);
    }
    const tipMode = opts.tipMode || (C().payroll && C().payroll.tipPolicy) || "personal";
    const primaryTipStaff = opts.tipStaffId || tk.waiterId || E.defaultWaiterForTable(tk.tableId) || opts.by;
    const tipShares = tip > 0 ? E.computeTipShares(tk, tip, tipMode, primaryTipStaff) : [];
    const sh = D().shift;
    const lines = tk.items.map((it) => ({ menuId: it.menuId, name: it.name, qty: it.qty, kg: it.kg || 0, count: it.count || 0, amount: E.itemAmount(it), cost: E.itemCost(it), vatGroup: E.vatGroupOf(it), isFree: !!it.isFree, promoId: it.promoId || null, addedBy: it.addedBy, styleId: it.styleId || null, status: it.status, categoryId: (E.menu(it.menuId) || {}).categoryId, sentAt: it.sentAt }));
    // Ghi nhan so tien thuc thu theo phuong thuc: tien mat tru tien thoi.
    // Tien VietQR giu nguyen (gom ca tip); tip se duoc tra tien mat tu ket -> tipsPaid.
    const netPays = pays.map((p) => Object.assign({}, p));
    let ch = change;
    for (let i = netPays.length - 1; i >= 0 && ch > 0; i--) {
      if (netPays[i].method !== "cash") continue;
      const take = Math.min(ch, netPays[i].amount);
      netPays[i].amount -= take;
      ch -= take;
    }
    if (ch > 0) netPays.push({ method: "cash", amount: -ch, note: "Thối lại tiền mặt do chuyển khoản dư" });
    const payerStaff = E.staff(opts.by);
    const sale = {
      id: U.uid("sale"), ticketId: tk.id, tableId: tk.tableId, tableCode: E.table(tk.tableId).code, payCode: tk.payCode,
      mergedPayCodes: Array.isArray(tk.mergedPayCodes) ? tk.mergedPayCodes.slice() : [],
      openedAt: tk.openedAt, closedAt: at, dayKey: U.dayKey(at),
      shiftId: sh ? sh.id : null, waiterId: tk.waiterId, cashierId: opts.by, paidByRole: payerStaff ? payerStaff.role : (opts.source || "cashier"),
      paymentSource: opts.source || "manual", webhookTxId: opts.webhookTxId || null,
      guests: tk.guests, lines,
      subtotal: tot.subtotal, vipFee: tot.vipFee, discount: tot.discount, deposit: tot.deposit, grand: tot.grand, vat: tot.vat, vatTotal: tot.vatTotal,
      cost: tot.cost, payments: netPays, received: paid, change, tip,
      tipMode: tip > 0 ? tipMode : null,
      tipStaffId: tip > 0 ? primaryTipStaff : null,
      tipShares,
      einvoice: null, unlockCount: tk.unlockCount || 0,
    };
    D().sales.push(sale);
    tk.status = "paid";
    tk.closedAt = at;
    tk.saleId = sale.id;
    D().tickets = D().tickets.filter((t) => t.id !== tk.id);
    D().tableState[tk.tableId] = { status: "dirty", since: at };
    D().lastBillClosedAt = Math.max(D().lastBillClosedAt || 0, at);
    if (tk.bookingId) {
      const bk = D().bookings.find((b) => b.id === tk.bookingId);
      if (bk) bk.status = "completed";
    }
    if (!opts.silentPrint) {
      const doc = E.billDoc(tk, "receipt", { at, payments: pays, change, tip, qr: C().receipt.showQr ? E.invoiceQrUrl(sale.id) : null, qrLabel: C().receipt.footer, saleId: sale.id });
      E.print("p_cashier", doc);
      sale.receipt = true;
    }
    clearNotify("prebill_request", tk.id);
    return sale;
  };

  E.invoiceQrUrl = function (saleId) {
    const code = String(saleId || "").slice(-8).toUpperCase();
    const origin = typeof location !== "undefined" && /^https?:/.test(location.protocol) ? location.origin : "https://munbao.com";
    return origin + "/customer?inv=" + encodeURIComponent(code);
  };

  // Tim ticket dang mo khop voi noi dung chuyen khoan ngan hang (chua payCode, mergedPayCodes hoac ma ban)
  E.matchTicketByTransferContent = function (content) {
    const norm = E.normalizePayCode(content);
    if (!norm) return null;
    const open = E.openTickets();
    // 1. Khop chinh xac payCode day du hoac mergedPayCodes (tu ban chuyen/ghep)
    for (let i = 0; i < open.length; i++) {
      const tk = open[i];
      const codeNorm = E.normalizePayCode(E.ensurePayCode(tk));
      if (codeNorm && norm.includes(codeNorm)) return tk;
      if (Array.isArray(tk.mergedPayCodes)) {
        for (let j = 0; j < tk.mergedPayCodes.length; j++) {
          const mNorm = E.normalizePayCode(tk.mergedPayCodes[j]);
          if (mNorm && norm.includes(mNorm)) return tk;
        }
      }
    }
    // 2. Fallback: khop QN + ma ban neu chi co 1 bill tren ban do (VD: QNA02)
    const prefix = E.normalizePayCode((C().paymentGateway && C().paymentGateway.prefix) || "QN");
    for (let i = 0; i < open.length; i++) {
      const tk = open[i];
      const tbl = E.table(tk.tableId);
      const tblNorm = E.normalizePayCode(prefix + ((tbl && tbl.code) || ""));
      if (tblNorm && norm.includes(tblNorm) && E.ticketsOfTable(tk.tableId).length === 1) return tk;
    }
    return null;
  };

  // Tim hoa don da dong (sale) khop voi noi dung chuyen khoan (phat hien khach chuyen trung 2 lan hoac chuyen sau khi da thu tien mat)
  E.matchClosedSaleByTransferContent = function (content) {
    const norm = E.normalizePayCode(content);
    if (!norm) return null;
    const sales = (D().sales || []).slice().reverse();
    for (let i = 0; i < sales.length; i++) {
      const s = sales[i];
      const codeNorm = E.normalizePayCode(s.payCode || "");
      if (codeNorm && norm.includes(codeNorm)) return s;
      if (Array.isArray(s.mergedPayCodes)) {
        for (let j = 0; j < s.mergedPayCodes.length; j++) {
          const mNorm = E.normalizePayCode(s.mergedPayCodes[j]);
          if (mNorm && norm.includes(mNorm)) return s;
        }
      }
    }
    return null;
  };

  // Xu ly bien dong so du tu cong thanh toan / webhook ngan hang (SePay / Casso / VietQR)
  // payload: { amount, content, transactionId, gateway, tipMode, tipStaffId, by }
  E.processPaymentWebhook = function (payload) {
    payload = payload || {};
    const amount = Math.round(Number(payload.amount || payload.transferAmount || 0));
    const content = String(payload.content || payload.description || payload.memo || "").trim();
    const txId = String(payload.transactionId || payload.referenceCode || U.uid("tx"));
    const gateway = String(payload.gateway || (C().paymentGateway && C().paymentGateway.provider) || "VietQR Webhook");
    if (amount <= 0) fail("Số tiền giao dịch không hợp lệ.");
    if (!content) fail("Thiếu nội dung chuyển khoản để định danh bàn.");
    D().webhookLogs = D().webhookLogs || [];
    // Chong trung lap giao dich (ca matched_paid va partial_paid)
    const dup = D().webhookLogs.find((w) => w.txId === txId && (w.status === "matched_paid" || w.status === "partial_paid"));
    if (dup) return { duplicate: true, log: dup, sale: D().sales.find((s) => s.id === dup.saleId) };

    const tk = payload.ticketId ? E.ticket(payload.ticketId) : E.matchTicketByTransferContent(content);
    if (!tk) {
      // Ngoai le: Kiem tra xem ma chuyen khoan co khop voi 1 bill VUA DONG khong (khach chuyen trung 2 lan hoac tien ve tre sau khi da thu tien mat)
      const closedSale = E.matchClosedSaleByTransferContent(content);
      if (closedSale) {
        const warnReason =
          "CẢNH BÁO: Bàn " +
          closedSale.tableCode +
          " (" +
          (closedSale.payCode || content) +
          ") đã thanh toán trước đó nhưng vừa nhận thêm chuyển khoản " +
          U.money(amount) +
          " — Cần kiểm tra hoàn tiền hoặc ghi nhận Tip!";
        const log = {
          id: U.uid("wh"),
          txId,
          at: Date.now(),
          gateway,
          amount,
          content,
          saleId: closedSale.id,
          tableId: closedSale.tableId,
          tableCode: closedSale.tableCode,
          payCode: closedSale.payCode,
          waiterId: closedSale.waiterId,
          status: "overpaid_closed_bill",
          reason: warnReason,
        };
        D().webhookLogs.unshift(log);
        E.notify("payment_overpaid_closed", {
          tableId: closedSale.tableId,
          saleId: closedSale.id,
          waiterId: closedSale.waiterId,
          amount,
          payCode: closedSale.payCode,
          text: warnReason,
          msg: warnReason,
        });
        fail(warnReason);
      }
      const log = { id: U.uid("wh"), txId, at: Date.now(), gateway, amount, content, status: "unmatched", reason: "Không tìm thấy bill đang mở khớp mã nội dung" };
      D().webhookLogs.unshift(log);
      fail("Không tìm thấy bill đang mở khớp nội dung chuyển khoản: \"" + content + "\".");
    }
    const tot = E.totals(tk);
    if (tot.pendingWeigh) fail("Bàn " + E.table(tk.tableId).code + " còn hải sản chưa cân, chưa thể chốt tự động.");
    const needTotal = Math.max(0, tot.grand - tot.deposit);
    const dueNow = Math.max(0, tot.due !== undefined ? tot.due : needTotal - (tot.paid || 0));
    if (amount < dueNow) {
      // Ngoai le: Khach chuyen khoan 1 phan (nhieu nguoi cung chuyen gop hoac chuyen khoan + tien mat)
      tk.payments = Array.isArray(tk.payments) ? tk.payments : [];
      tk.payments.push({
        id: U.uid("pm"),
        method: "qr",
        amount,
        received: amount,
        txId,
        content,
        gateway,
        at: Date.now(),
      });
      const afterTot = E.totals(tk);
      const tblCode = E.table(tk.tableId).code;
      const partialMsg =
        "Bàn " +
        tblCode +
        " vừa chuyển khoản 1 phần " +
        U.money(amount) +
        " (Đã thu: " +
        U.money(afterTot.paid) +
        " · Còn thiếu: " +
        U.money(afterTot.due) +
        ")";
      const log = {
        id: U.uid("wh"),
        txId,
        at: Date.now(),
        gateway,
        amount,
        content,
        ticketId: tk.id,
        tableId: tk.tableId,
        tableCode: tblCode,
        payCode: E.ensurePayCode(tk),
        need: needTotal,
        paidSoFar: afterTot.paid,
        remaining: afterTot.due,
        waiterId: tk.waiterId,
        status: "partial_paid",
        reason: "Đã thu 1 phần " + U.money(afterTot.paid) + " · Còn thiếu " + U.money(afterTot.due),
      };
      D().webhookLogs.unshift(log);
      E.notify("payment_partial", {
        tableId: tk.tableId,
        ticketId: tk.id,
        waiterId: tk.waiterId,
        amount,
        paidSoFar: afterTot.paid,
        remaining: afterTot.due,
        need: needTotal,
        payCode: tk.payCode,
        text: partialMsg,
        msg: partialMsg,
      });
      return {
        ok: true,
        partial: true,
        ticket: tk,
        ticketId: tk.id,
        tableCode: tblCode,
        payCode: tk.payCode,
        need: needTotal,
        received: amount,
        paidSoFar: afterTot.paid,
        remaining: afterTot.due,
        log,
      };
    }
    const overAsTip = C().paymentGateway ? C().paymentGateway.overpayAsTip !== false : true;
    const tipMode = payload.tipMode || tk.preferredTipMode || (C().payroll && C().payroll.tipPolicy) || "personal";
    const tipStaffId = payload.tipStaffId || tk.waiterId || E.defaultWaiterForTable(tk.tableId);
    const paidBy = payload.by || tk.waiterId || (D().shift && D().shift.cashierId) || "s_thu";
    const sale = E.pay(tk.id, {
      by: paidBy,
      source: "webhook_qr",
      webhookTxId: txId,
      overAsTip,
      tipMode,
      tipStaffId,
      payments: [{ method: "qr", amount, received: amount, txId, content, gateway, at: Date.now() }],
    });
    const log = {
      id: U.uid("wh"), txId, at: Date.now(), gateway, amount, content,
      ticketId: tk.id, saleId: sale.id, tableId: tk.tableId, tableCode: sale.tableCode,
      payCode: sale.payCode, need: needTotal, receivedTotal: sale.received, tip: sale.tip, tipMode: sale.tipMode, tipShares: sale.tipShares,
      waiterId: sale.waiterId, status: "matched_paid",
    };
    D().webhookLogs.unshift(log);
    E.notify("payment_success", {
      tableId: sale.tableId,
      ticketId: tk.id,
      saleId: sale.id,
      waiterId: sale.waiterId,
      amount,
      receivedTotal: sale.received,
      need: needTotal,
      tip: sale.tip,
      tipMode: sale.tipMode,
      payCode: sale.payCode,
      text: "Bàn " + sale.tableCode + " thanh toán QR thành công " + U.money(sale.received) + (sale.tip > 0 ? " (Tip: " + U.money(sale.tip) + " - " + (E.TIP_MODES[sale.tipMode] || sale.tipMode) + ")" : ""),
      msg: "Bàn " + sale.tableCode + " thanh toán QR thành công " + U.money(sale.received) + (sale.tip > 0 ? " (Tip: " + U.money(sale.tip) + " - " + (E.TIP_MODES[sale.tipMode] || sale.tipMode) + ")" : ""),
    });
    return { ok: true, partial: false, sale, log, need: needTotal, received: amount, receivedTotal: sale.received, tip: sale.tip, tipShares: sale.tipShares };
  };

  // Xu ly giao dich chuyen trung / chuyen tre vao bill da dong (chuyen thanh Tip bo sung hoac Xac nhan da hoan tien)
  E.resolveOverpaidWebhook = function (whId, action, by) {
    const w = (D().webhookLogs || []).find((x) => x.id === whId);
    if (!w) fail("Không tìm thấy giao dịch biến động số dư.");
    if (w.status !== "overpaid_closed_bill") fail("Giao dịch này đã được xử lý trước đó.");
    const sale = (D().sales || []).find((s) => s.id === w.saleId);
    const now = Date.now();
    if (action === "tip") {
      if (sale) {
        const extraTip = Math.max(0, Math.round(Number(w.amount) || 0));
        sale.tip = (Number(sale.tip) || 0) + extraTip;
        sale.received = (Number(sale.received) || 0) + extraTip;
        sale.tipMode = sale.tipMode || (C().payroll && C().payroll.tipPolicy) || "personal";
        sale.tipStaffId = sale.tipStaffId || sale.waiterId || E.defaultWaiterForTable(sale.tableId) || by;
        sale.tipShares = E.computeTipShares(
          { tableId: sale.tableId, waiterId: sale.waiterId },
          sale.tip,
          sale.tipMode,
          sale.tipStaffId
        );
        sale.payments = Array.isArray(sale.payments) ? sale.payments : [];
        sale.payments.push({
          method: "qr",
          amount: extraTip,
          received: extraTip,
          txId: w.txId,
          content: w.content,
          note: "Chuyển khoản bổ sung sau đóng bill -> Ghi nhận Tip",
          at: now,
        });
      }
      w.status = "resolved_as_tip";
      w.tip = w.amount;
      w.tipMode = (sale && sale.tipMode) || "personal";
      w.resolvedAt = now;
      w.resolvedBy = by || "s_thu";
      w.reason = "Đã ghi nhận thành Tip bổ sung (" + U.money(w.amount) + ")";
    } else {
      w.status = "resolved_refunded";
      w.resolvedAt = now;
      w.resolvedBy = by || "s_thu";
      w.reason = "Đã đối soát & hoàn tiền chuyển trùng cho khách";
    }
    (D().notifications || []).forEach((n) => {
      if (n.type === "payment_overpaid_closed" && n.saleId === w.saleId) n.read = true;
    });
    return w;
  };

  E.splitByItems = function (ticketId, itemIds) {
    const tk = E.ticket(ticketId);
    if (!tk) fail("Không tìm thấy bill.");
    if (!itemIds.length) fail("Chọn ít nhất 1 món để tách.");
    if (itemIds.length >= tk.items.filter((i) => i.status !== "void").length) fail("Không thể tách toàn bộ món sang bill mới.");
    const part = E.ticketsOfTable(tk.tableId).length + 1;
    const nt = { id: U.uid("tk"), tableId: tk.tableId, payCode: E.generatePayCode(tk.tableId, null), status: tk.status === "locked" ? "open" : tk.status, guests: 1, openedAt: tk.openedAt, waiterId: tk.waiterId, items: [], payments: [], part, splitFrom: tk.id };
    nt.items = tk.items.filter((i) => itemIds.includes(i.id));
    tk.items = tk.items.filter((i) => !itemIds.includes(i.id));
    tk.part = tk.part || 1;
    // Neu co yeu cau duyet cua mon duoc tach sang bill moi -> cap nhat ref sang nt.id
    (D().approvals || []).forEach((ap) => {
      if (ap.status === "pending" && ap.ref === tk.id && ap.itemId && itemIds.includes(ap.itemId)) {
        ap.ref = nt.id;
        if (ap.payload && ap.payload.ticketId === tk.id) ap.payload.ticketId = nt.id;
      }
    });
    D().tickets.push(nt);
    return nt;
  };
  E.transferTable = function (ticketId, toTableId) {
    const tk = E.ticket(ticketId);
    if (!tk) fail("Không tìm thấy bill.");
    if (E.ticketByTable(toTableId)) fail("Bàn đích đang có khách. Hãy dùng chức năng Ghép bàn.");
    const from = tk.tableId;
    const oldPayCode = tk.payCode;
    tk.tableId = toTableId;
    tk.payCode = E.generatePayCode(toTableId, tk.id);
    if (oldPayCode && oldPayCode !== tk.payCode) {
      tk.mergedPayCodes = Array.from(new Set((tk.mergedPayCodes || []).concat([oldPayCode])));
    }
    D().tableState[from] = { status: "dirty", since: Date.now() };
    delete D().tableState[toTableId];
    return tk;
  };
  E.mergeTickets = function (fromId, intoId) {
    const a = E.ticket(fromId),
      b = E.ticket(intoId);
    if (!a || !b) fail("Không tìm thấy bill.");
    if (a.status === "locked" || b.status === "locked") fail("Không thể ghép bill đã khóa.");
    b.items = b.items.concat(a.items);
    b.guests = (b.guests || 0) + (a.guests || 0);
    b.deposit = (b.deposit || 0) + (a.deposit || 0);
    b.payments = (b.payments || []).concat(a.payments || []);
    const oldCodes = [a.payCode].concat(a.mergedPayCodes || []).filter(Boolean);
    if (oldCodes.length) {
      b.mergedPayCodes = Array.from(new Set((b.mergedPayCodes || []).concat(oldCodes)));
    }
    // Chuyen cac yeu cau duyet dang cho tu bill a sang bill b
    (D().approvals || []).forEach((ap) => {
      if (ap.status === "pending" && ap.ref === a.id) {
        ap.ref = b.id;
        if (ap.payload && ap.payload.ticketId === a.id) ap.payload.ticketId = b.id;
      }
    });
    D().tickets = D().tickets.filter((t) => t.id !== a.id);
    D().tableState[a.tableId] = { status: "dirty", since: Date.now() };
    E.applyPromos(b);
    return b;
  };
  E.markClean = function (tableId) {
    delete D().tableState[tableId];
  };

  /* ======================= CA THU NGAN ======================= */
  E.currentShift = () => (D().shift && D().shift.status !== "closed" ? D().shift : null);
  E.shiftSales = (sh) => (sh ? D().sales.filter((s) => s.shiftId === sh.id) : []);
  E.shiftStats = function (sh) {
    sh = sh || E.currentShift();
    if (!sh) return null;
    const sales = E.shiftSales(sh);
    const cash = U.sum(sales, (s) => U.sum(s.payments.filter((p) => p.method === "cash"), (p) => p.amount));
    const qr = U.sum(sales, (s) => U.sum(s.payments.filter((p) => p.method === "qr"), (p) => p.amount));
    const card = U.sum(sales, (s) => U.sum(s.payments.filter((p) => p.method === "card"), (p) => p.amount));
    const deposits = U.sum(sales, (s) => s.deposit);
    const petty = U.sum(sh.petty, (p) => p.amount);
    const tipsPaid = U.sum(sh.tipsPaid, (p) => p.amount);
    const advancesPaid = U.sum(sh.advancesPaid, (p) => p.amount);
    const tips = U.sum(sales, (s) => s.tip);
    const expected = sh.openingCash + cash - petty - tipsPaid - advancesPaid;
    return { sales, bills: sales.length, revenue: U.sum(sales, (s) => s.grand), cash, qr, card, deposits, petty, tipsPaid, advancesPaid, tips, expected, opening: sh.openingCash };
  };
  E.isShiftLocked = function () {
    const sh = D().shift;
    return !!(sh && sh.status === "auto_locked");
  };
  E.addPetty = function (amount, reason, by) {
    const sh = E.currentShift();
    if (!sh) fail("Chưa mở ca.");
    amount = Number(amount) || 0;
    if (amount <= 0) fail("Số tiền phải lớn hơn 0.");
    if (!reason || reason.trim().length < 3) fail("Vui lòng nhập nội dung chi.");
    const st = E.staff(by);
    const max = st && st.role !== "owner" ? Number((C().permissions[st.role] || {}).pettyCashMax) || 0 : Infinity;
    if (amount > max) fail("Vượt hạn mức chi vặt (" + U.money(max) + "). Cần Chủ quán chi trực tiếp.");
    sh.petty.push({ id: U.uid("pc"), at: Date.now(), amount, reason, by });
  };
  E.payoutTip = function (staffId, amount, by) {
    const sh = E.currentShift();
    if (!sh) fail("Chưa mở ca.");
    const owed = E.tipOwed(staffId);
    if (amount > owed) fail("Số tiền vượt quá tiền tip chưa nhận (" + U.money(owed) + ").");
    const rec = { id: U.uid("tp"), at: Date.now(), staffId, amount, by };
    sh.tipsPaid.push(rec);
    (D().tipPayouts = D().tipPayouts || []).push(rec);
  };
  E.tipOwed = function (staffId) {
    const sh = E.currentShift();
    if (!sh) return 0;
    const earned = E.tipEarnedByStaff(staffId, E.shiftSales(sh));
    const paid = U.sum(sh.tipsPaid.filter((t) => t.staffId === staffId), (t) => t.amount);
    return Math.max(0, earned - paid);
  };
  E.payAdvance = function (advId, by) {
    const sh = E.currentShift();
    if (!sh) fail("Chưa mở ca.");
    const adv = D().advances.find((a) => a.id === advId);
    if (!adv || adv.status !== "approved") fail("Khoản ứng chưa được duyệt.");
    adv.status = "paid";
    adv.paidAt = Date.now();
    adv.paidBy = by;
    sh.advancesPaid.push({ id: U.uid("ap"), at: Date.now(), staffId: adv.staffId, amount: adv.amount, advId, by });
  };
  E.openShift = function (openingCash, by) {
    if (E.currentShift()) fail("Ca hiện tại chưa chốt.");
    const key = U.dayKey();
    D().shift = { id: "ca_" + key + "_" + Date.now().toString(36), dayKey: key, cashierId: by, openedAt: Date.now(), openingCash: Number(openingCash) || 0, status: "open", petty: [], tipsPaid: [], advancesPaid: [] };
    return D().shift;
  };
  // denominations: {500000: n, ...}
  E.closeShift = function (opts) {
    const sh = D().shift;
    if (!sh || sh.status === "closed") fail("Không có ca đang mở.");
    if (E.openTickets().length && !opts.force) fail("Còn " + E.openTickets().length + " bàn chưa thanh toán. Hãy thu tiền hoặc chuyển sang ca sau trước khi chốt.");
    const st = E.shiftStats(sh);
    const counted = opts.counted !== undefined ? Number(opts.counted) : U.sum(Object.keys(opts.denominations || {}), (k) => Number(k) * (Number(opts.denominations[k]) || 0));
    const variance = counted - st.expected;
    if (variance !== 0 && (!opts.note || opts.note.trim().length < 3)) fail("Tiền thực đếm lệch " + U.money(variance) + ". Vui lòng nhập giải trình.");
    const z = {
      id: "z_" + sh.id, shiftId: sh.id, dayKey: sh.dayKey, openedAt: sh.openedAt, closedAt: Date.now(), cashierId: sh.cashierId, closedBy: opts.by,
      opening: sh.openingCash, cash: st.cash, qr: st.qr, card: st.card, petty: st.petty, tipsPaid: st.tipsPaid, advancesPaid: st.advancesPaid,
      expected: st.expected, counted, variance, note: opts.note || "", bills: st.bills, revenue: st.revenue, denominations: opts.denominations || null,
      vat: aggregateVat(st.sales), locked: true,
    };
    sh.status = "closed";
    sh.closedAt = z.closedAt;
    sh.z = z;
    D().shiftsHistory.unshift(z);
    E.rollupDay(sh.dayKey, z);
    E.print("p_cashier", { kind: "z", title: "BÁO CÁO CHỐT CA", header: [C().store.name], meta: [{ l: "Ca", r: U.dayLabel(sh.dayKey) }, { l: "Mở ca", r: U.time(sh.openedAt) }, { l: "Chốt ca", r: U.time(z.closedAt) }, { l: "Thu ngân", r: E.staffName(sh.cashierId) }], rows: [{ l: "Số bill", r: String(z.bills) }, { l: "Doanh thu", r: U.moneyPlain(z.revenue) }, { l: "Tiền mặt thu", r: U.moneyPlain(z.cash) }, { l: "Chuyển khoản VietQR", r: U.moneyPlain(z.qr) }, { l: "Chi vặt", r: "-" + U.moneyPlain(z.petty) }, { l: "Trả tip tiền mặt", r: "-" + U.moneyPlain(z.tipsPaid) }, { l: "Chi ứng lương", r: "-" + U.moneyPlain(z.advancesPaid) }], sumRows: [{ l: "Tiền mặt phải có", r: U.moneyPlain(z.expected) }, { l: "Tiền mặt thực đếm", r: U.moneyPlain(z.counted) }, { l: "Chênh lệch", r: U.moneyPlain(z.variance), bold: true }], footer: [z.note ? "Giải trình: " + z.note : "Không chênh lệch", "Ca đã khóa sổ - không thể sửa"] });
    return z;
  };
  function aggregateVat(sales) {
    const out = { food: { gross: 0, vat: 0 }, alcohol: { gross: 0, vat: 0 } };
    sales.forEach((s) => Object.keys(s.vat || {}).forEach((g) => { out[g] = out[g] || { gross: 0, vat: 0 }; out[g].gross += s.vat[g].gross; out[g].vat += s.vat[g].vat; }));
    return out;
  }
  function saleFoodGross(s) {
    if (Array.isArray(s.lines) && s.lines.length) {
      return U.sum(s.lines.filter((l) => l.status !== "void" && !l.isFree && l.vatGroup !== "alcohol"), (l) => Number(l.amount) || 0);
    }
    return Math.max(0, ((s.vat && s.vat.food && s.vat.food.gross) || 0) - (Number(s.vipFee) || 0));
  }
  function saleAlcoholGross(s) {
    if (Array.isArray(s.lines) && s.lines.length) {
      return U.sum(s.lines.filter((l) => l.status !== "void" && !l.isFree && l.vatGroup === "alcohol"), (l) => Number(l.amount) || 0);
    }
    return Math.max(0, (s.vat && s.vat.alcohol && s.vat.alcohol.gross) || 0);
  }
  // Tong hop 1 ngay vao dailyStats (khi chot ca)
  E.rollupDay = function (key, z) {
    const sales = D().sales.filter((s) => s.dayKey === key);
    const food = U.sum(sales, saleFoodGross);
    const alcohol = U.sum(sales, saleAlcoholGross);
    const vipFee = U.sum(sales, (s) => Number(s.vipFee) || 0);
    const discount = U.sum(sales, (s) => Number(s.discount) || 0);
    const revenue = food + alcohol + vipFee - discount;
    const rec = {
      dayKey: key, revenue, food, alcohol, cogs: U.sum(sales, (s) => s.cost), vipFee, discount,
      cash: U.sum(sales, (s) => U.sum(s.payments.filter((p) => p.method === "cash"), (p) => p.amount)), qr: U.sum(sales, (s) => U.sum(s.payments.filter((p) => p.method !== "cash"), (p) => p.amount)),
      bills: sales.length, guests: U.sum(sales, (s) => s.guests), wastage: U.sum(D().wastage.filter((w) => U.dayKey(w.at) === key && w.status === "approved"), (w) => w.amount),
      labor: Math.round(E.laborCostOfDay(key)), utility: 0, tips: U.sum(sales, (s) => s.tip), variance: z ? z.variance : 0, closedBy: z ? z.closedBy : null, locked: true,
    };
    D().dailyStats = D().dailyStats.filter((d) => d.dayKey !== key);
    D().dailyStats.push(rec);
    D().dailyStats.sort((a, b) => (a.dayKey < b.dayKey ? -1 : 1));
    return rec;
  };

  /* ======================= CHAM CONG & LUONG ======================= */
  E.attOfDay = (staffId, key) => D().attendance.filter((a) => a.staffId === staffId && a.dayKey === (key || U.dayKey()));
  E.activeAtt = (staffId) => D().attendance.find((a) => a.staffId === staffId && !a.out && a.dayKey === U.dayKey());
  E.onDuty = () => D().staff.filter((s) => E.activeAtt(s.id));

  E.latePenalty = function (lateMin) {
    const cfg = C().attendance;
    if (lateMin <= (Number(cfg.graceMinutes) || 0)) return 0;
    let amt = 0;
    (cfg.latePenalties || []).slice().sort((a, b) => a.fromMin - b.fromMin).forEach((t) => { if (lateMin >= t.fromMin) amt = Number(t.amount) || 0; });
    return amt;
  };
  // Tim doan ca gan nhat voi thoi diem
  E.segmentFor = function (staff, at) {
    const sh = E.shiftDef(staff.shiftId);
    if (!sh) return null;
    const key = U.dayKey(at);
    const done = E.attOfDay(staff.id, key).map((a) => a.segment);
    let best = null;
    sh.segments.forEach((seg, i) => {
      if (done.includes(i)) return;
      const start = U.atTime(seg.start, key);
      const end = U.atTime(seg.end, key);
      const d = Math.abs(at - start);
      if (at < end && (!best || d < best.d)) best = { i, seg, start, end, d };
    });
    return best;
  };
  // opts: {method:'mobile'|'kiosk', wifi:'PhoBien_Staff', gpsMeters: 12, selfie: true}
  E.checkIn = function (staffId, opts) {
    opts = opts || {};
    const st = E.staff(staffId);
    if (!st || !st.active) fail("Tài khoản không hợp lệ.");
    if (E.activeAtt(staffId)) fail("Bạn đang trong ca, chưa chấm công ra.");
    const cfg = C().attendance;
    if (opts.method === "mobile") {
      if (cfg.wifiRequired && opts.wifi !== cfg.wifiName) fail("Chưa kết nối Wi-Fi của quán (" + cfg.wifiName + "). Hãy kết nối rồi thử lại.");
      if (cfg.gpsRequired && !(opts.gpsMeters <= cfg.gpsRadius)) fail("Vị trí cách quán " + Math.round(opts.gpsMeters || 9999) + " m, vượt bán kính cho phép " + cfg.gpsRadius + " m.");
    }
    if (cfg.selfieRequired && !opts.selfie) fail("Cần chụp ảnh xác thực khi chấm công.");
    const now = opts.at || Date.now();
    const seg = E.segmentFor(st, now);
    const lateMin = seg ? Math.max(0, Math.round((now - seg.start) / MIN)) : 0;
    const rec = { id: U.uid("att"), staffId, dayKey: U.dayKey(now), segment: seg ? seg.i : 0, shiftId: st.shiftId, in: now, out: null, method: opts.method || "kiosk", lateMin, selfie: !!opts.selfie, otPendingMin: 0, otApprovedMin: 0, otAutoMin: 0, otStatus: "none", offSchedule: !seg };
    D().attendance.push(rec);
    return { rec, penalty: E.latePenalty(lateMin), seg };
  };
  E.checkOut = function (staffId, opts) {
    opts = opts || {};
    const rec = E.activeAtt(staffId);
    if (!rec) fail("Bạn chưa chấm công vào ca.");
    const now = opts.at || Date.now();
    rec.out = now;
    const st = E.staff(staffId);
    const sh = E.shiftDef(rec.shiftId);
    const seg = sh && sh.segments[rec.segment];
    const handoverTables = [];
    // Ngoai le: Neu phuc vu ra ca ma van con ban dang mo -> tu dong ban giao sang phuc vu cung khu vuc dang trong ca
    if (st && st.role === "waiter" && opts.autoHandover !== false) {
      const myOpen = E.openTickets().filter((t) => t.waiterId === staffId);
      myOpen.forEach((tk) => {
        let nextId = opts.handoverTo || null;
        if (!nextId) {
          const areaWaiters = E.assignedWaitersForTable(tk.tableId).filter((w) => w.id !== staffId);
          const onDutyArea = areaWaiters.find((w) => E.activeAtt(w.id));
          const anyOnDuty = E.onDuty().find((w) => w.role === "waiter" && w.id !== staffId);
          nextId = (onDutyArea && onDutyArea.id) || (anyOnDuty && anyOnDuty.id) || (areaWaiters[0] && areaWaiters[0].id) || null;
        }
        if (nextId && nextId !== staffId) {
          tk.handedOverFrom = staffId;
          tk.handedOverAt = now;
          tk.waiterId = nextId;
          const tblCode = (E.table(tk.tableId) || {}).code || tk.tableId;
          handoverTables.push({ ticketId: tk.id, tableId: tk.tableId, tableCode: tblCode, toWaiterId: nextId, toWaiterName: E.staffName(nextId) });
          E.notify("table_handover", {
            tableId: tk.tableId,
            ticketId: tk.id,
            waiterId: nextId,
            fromWaiterId: staffId,
            text: "Bàn " + tblCode + " được bàn giao từ " + U.shortName(st.name) + " (ra ca) sang " + U.shortName(E.staffName(nextId)),
          });
        }
      });
    }
    const result = { rec, otPendingMin: 0, otAutoMin: 0, handoverTables };
    if (seg) {
      const end = U.atTime(seg.end, rec.dayKey);
      if (now > end) {
        const lastBill = D().lastBillClosedAt || 0;
        const cap = Math.max(end, lastBill + (Number(C().attendance.cleanupBuffer) || 0) * MIN);
        rec.otAutoMin = Math.max(0, Math.round((Math.min(now, cap) - end) / MIN));
        const pending = Math.max(0, Math.round((now - cap) / MIN));
        result.otAutoMin = rec.otAutoMin;
        if (pending > 5) {
          rec.otPendingMin = pending;
          rec.otStatus = "pending";
          result.otPendingMin = pending;
          const rate = E.hourlyRateOf(st);
          E.createApproval({ type: "overtime", by: staffId, ref: rec.id, title: "Tăng ca sau bàn cuối: " + st.name, amount: Math.round((pending / 60) * rate * C().attendance.otMultiplier), minutes: pending, reason: "Ra ca lúc " + U.time(now) + ", vượt giới hạn (bàn cuối " + U.time(lastBill) + " + " + C().attendance.cleanupBuffer + " phút) " + pending + " phút" });
        }
      }
    }
    return result;
  };
  E.hourlyRateOf = function (st) {
    if (!st) return 0;
    if (st.payType === "hourly") return Number(st.hourlyRate) || 0;
    if (st.payType === "monthly") return (Number(st.baseSalary) || 0) / ((Number(C().payroll.workDaysPerMonth) || 26) * (Number(C().payroll.standardHoursPerDay) || 8));
    return 0;
  };
  function overlapMs(a1, a2, b1, b2) {
    return Math.max(0, Math.min(a2, b2) - Math.max(a1, b1));
  }
  // Gio cong cua 1 ban ghi cham cong
  E.attHours = function (rec, at) {
    const sh = E.shiftDef(rec.shiftId);
    const seg = sh && sh.segments[rec.segment];
    const out = rec.out || (rec.dayKey === U.dayKey() ? at || Date.now() : rec.in);
    let start = rec.in,
      end = out;
    if (seg && !rec.offSchedule) {
      const s = U.atTime(seg.start, rec.dayKey);
      const e = U.atTime(seg.end, rec.dayKey);
      start = Math.max(rec.in, s);
      end = Math.min(out, e);
    }
    const regularMs = Math.max(0, end - start);
    const otMin = (rec.otAutoMin || 0) + (rec.otStatus === "approved" ? rec.otApprovedMin || rec.otPendingMin || 0 : 0);
    const ns = U.atTime(C().attendance.nightStart, rec.dayKey);
    const nightMs = overlapMs(start, end, ns, ns + 8 * 3600000);
    return { regular: regularMs / 3600000, night: nightMs / 3600000, ot: otMin / 60, pendingOt: rec.otStatus === "pending" ? rec.otPendingMin / 60 : 0 };
  };
  E.laborCostOfDay = function (key) {
    return U.sum(D().attendance.filter((a) => a.dayKey === key), (a) => {
      const st = E.staff(a.staffId);
      const h = E.attHours(a);
      return (h.regular + h.ot) * E.hourlyRateOf(st);
    });
  };

  // Bang luong chi tiet 1 nhan vien trong 1 thang (monthKey 'yyyy-mm')
  E.payroll = function (staffId, monthKey) {
    const st = E.staff(staffId);
    const cfg = C();
    monthKey = monthKey || U.monthKey();
    const recs = D().attendance.filter((a) => a.staffId === staffId && a.dayKey.slice(0, 7) === monthKey).sort((a, b) => a.in - b.in);
    const rate = E.hourlyRateOf(st);
    let regular = 0, night = 0, ot = 0, pendingOt = 0, late = 0, lateCount = 0;
    const days = new Set();
    recs.forEach((r) => {
      const h = E.attHours(r);
      regular += h.regular;
      night += h.night;
      ot += h.ot;
      pendingOt += h.pendingOt;
      days.add(r.dayKey);
      const p = E.latePenalty(r.lateMin);
      if (p) { late += p; lateCount++; }
    });
    let base = 0;
    if (st.payType === "hourly") base = Math.round(regular * rate);
    else if (st.payType === "monthly") base = Math.round(((Number(st.baseSalary) || 0) / (Number(cfg.payroll.workDaysPerMonth) || 26)) * days.size);
    const otPay = Math.round(ot * rate * (Number(cfg.attendance.otMultiplier) || 1));
    const nightPay = Math.round(night * rate * ((Number(cfg.attendance.nightMultiplier) || 1) - 1));
    // Thuong ban hang: hai san theo kg, mon dac biet theo phan, PG theo thung
    const monthSales = D().sales.filter((s) => s.dayKey.slice(0, 7) === monthKey);
    let commission = 0;
    const commissionLines = [];
    const openItems = [];
    monthSales.forEach((s) => s.lines.forEach((l) => openItems.push(l)));
    openItems.forEach((l) => {
      if (l.addedBy !== staffId || l.isFree || l.status === "void") return;
      const m = E.menu(l.menuId);
      if (!m) return;
      if (st.role === "pg") return;
      if (m.kind === "seafood" && m.upsellPerKg) commission += l.kg * m.upsellPerKg;
      else if (m.upsell) commission += l.qty * m.upsell;
    });
    if (st.role === "pg") {
      const cans = U.sum(openItems.filter((l) => l.addedBy === staffId && !l.isFree && (E.menu(l.menuId) || {}).kind === "beer"), (l) => l.qty);
      commission = Math.floor(cans / 24) * (Number(cfg.pg.commissionPerCase) || 0);
      commissionLines.push({ label: Math.floor(cans / 24) + " thùng x " + U.money(cfg.pg.commissionPerCase), amount: commission });
    }
    commission = Math.round(commission / 1000) * 1000;
    const tips = Math.round(E.tipEarnedByStaff(staffId, monthSales));
    const deductions = Math.round(U.sum((D().deductions || []).filter((d) => d.staffId === staffId && d.monthKey === monthKey), (d) => d.amount));
    const advList = D().advances.filter((a) => a.staffId === staffId && a.status === "paid" && U.monthKey(a.paidAt || a.at) === monthKey);
    const advances = Math.round(U.sum(advList, (a) => a.amount));
    const advPending = Math.round(U.sum(D().advances.filter((a) => a.staffId === staffId && (a.status === "pending" || a.status === "approved") && U.monthKey(a.at) === monthKey), (a) => a.amount));
    // Tip tien mat da nhan tai quay khong tru luong (da nhan truc tiep)
    const tipsPaidCash = Math.round(U.sum((D().tipPayouts || []).filter((t) => t.staffId === staffId && U.monthKey(t.at) === monthKey), (t) => t.amount));
    const gross = base + otPay + nightPay + commission + tips;
    const net = gross - late - deductions - advances - tipsPaidCash;
    const cap = (Number(cfg.payroll.advanceCapPct) || 0) / 100;
    const advanceAvailable = Math.max(0, Math.floor((gross * cap - advances - advPending) / 10000) * 10000);
    return {
      staff: st, monthKey, rate, days: days.size, records: recs, regular, night, ot, pendingOt,
      base, otPay, nightPay, commission, commissionLines, tips,
      late, lateCount, deductions, advances, advPending, tipsPaidCash, gross, net, advanceAvailable,
    };
  };

  E.requestAdvance = function (staffId, amount, reason) {
    amount = Math.round(Number(amount) || 0);
    if (amount < 50000) fail("Số tiền ứng tối thiểu 50.000 đ.");
    const p = E.payroll(staffId);
    if (amount > p.advanceAvailable) fail("Vượt hạn mức được ứng. Bạn có thể ứng tối đa " + U.money(p.advanceAvailable) + ".");
    const adv = { id: U.uid("adv"), staffId, amount, reason: reason || "", at: Date.now(), status: "pending" };
    D().advances.push(adv);
    E.createApproval({ type: "advance", by: staffId, ref: adv.id, title: "Ứng lương: " + E.staffName(staffId), amount, reason: reason || "Không ghi lý do" });
    return adv;
  };

  /* ======================= PHE DUYET ======================= */
  E.APPROVAL_TYPES = {
    unlock_bill: { label: "Mở khóa bill", icon: "lock-open" },
    void_item: { label: "Hủy món", icon: "ban" },
    discount: { label: "Giảm giá", icon: "badge-percent" },
    seafood_bargain: { label: "Khách ép giá cá nguyên con", icon: "fish" },
    wastage: { label: "Hao hụt", icon: "fish" },
    advance: { label: "Ứng lương", icon: "wallet" },
    overtime: { label: "Tăng ca", icon: "clock" },
    count_variance: { label: "Lệch kiểm kho", icon: "package" },
    noshow_deposit: { label: "Cọc khách không đến", icon: "calendar-clock" },
  };
  E.createApproval = function (a) {
    const ap = Object.assign({ id: U.uid("ap"), status: "pending", at: Date.now() }, a);
    D().approvals.unshift(ap);
    return ap;
  };
  E.pendingApprovals = () => D().approvals.filter((a) => a.status === "pending");

  // Phan tang phe duyet: "cashier" (Thu ngan kiem Quan ly xu ly nhanh) vs "owner" (Van de lon can Chu quan quyet)
  E.approvalTier = function (ap) {
    if (!ap) return "owner";
    const pCash = (C().permissions && C().permissions.cashier) || {};
    const amt = Number(ap.amount) || 0;
    const pl = ap.payload || {};
    switch (ap.type) {
      case "count_variance":
        return "owner";
      case "void_item": {
        const maxVoid = Number(pCash.approveVoidUnder) || 200000;
        return pCash.voidAfterPrint !== false && amt <= maxVoid ? "cashier" : "owner";
      }
      case "unlock_bill": {
        const maxUnlock = Number(pCash.maxSelfUnlockCount) || 1;
        const tk = E.ticket(ap.ref);
        const attempt = Number(pl.unlockAttempt) || ((tk && Number(tk.unlockCount)) || 0) + 1;
        return pCash.reopenBill !== false && attempt <= maxUnlock ? "cashier" : "owner";
      }
      case "discount": {
        const maxDiscPct = Number(pCash.discountMaxPct) || 10;
        const pct = pl.pct !== undefined ? Number(pl.pct) : pl.type === "pct" ? Number(pl.value) || 0 : 100;
        return pCash.discount !== false && pct <= maxDiscPct + 0.05 ? "cashier" : "owner";
      }
      case "seafood_bargain": {
        const maxBargainPct = Number(pCash.cashierBargainPct) || 15;
        const listAmt = Number(pl.listAmount) || 0;
        const dealAmt = Number(pl.dealAmount) || 0;
        const pct =
          pl.pct !== undefined
            ? Number(pl.pct)
            : listAmt > 0
            ? Math.round(((listAmt - dealAmt) / listAmt) * 1000) / 10
            : 100;
        return pct <= maxBargainPct + 0.05 ? "cashier" : "owner";
      }
      case "wastage": {
        const maxWaste = Number(pCash.approveWasteUnder) || 300000;
        return amt <= maxWaste ? "cashier" : "owner";
      }
      case "overtime": {
        const maxOt = Number(pCash.approveOvertimeUnderMin) || 60;
        const mins = Number(ap.minutes) || 0;
        return mins <= maxOt ? "cashier" : "owner";
      }
      case "advance": {
        const maxAdv = Number(pCash.approveAdvanceUnder) || 500000;
        return pCash.payAdvance !== false && amt <= maxAdv ? "cashier" : "owner";
      }
      case "noshow_deposit": {
        const maxNoShow = Number(pCash.approveNoShowUnder) || 300000;
        return amt <= maxNoShow ? "cashier" : "owner";
      }
      default:
        return "owner";
    }
  };

  E.approvalTierMeta = function (ap) {
    const tier = E.approvalTier(ap);
    const pCash = (C().permissions && C().permissions.cashier) || {};
    if (tier === "cashier") {
      return {
        tier: "cashier",
        badgeLabel: "Quản lý ca duyệt nhanh",
        badgeTone: "info",
        desc: "Trong hạn mức phân quyền cho Thu ngân kiêm Quản lý xử lý ngay tại quầy",
      };
    }
    let desc = "Vượt hạn mức Quản lý ca — Bắt buộc Chủ quán phê duyệt";
    if (ap && ap.type === "count_variance") desc = "Lệch kiểm kho cuối ca — Chủ quán quyết định chấp nhận hoặc trừ lương";
    else if (ap && ap.type === "void_item") desc = "Món hủy giá trị lớn (> " + U.money(Number(pCash.approveVoidUnder) || 200000) + ") — Chủ quán duyệt";
    else if (ap && ap.type === "seafood_bargain") desc = "Khách ép giá cá sâu (> " + (Number(pCash.cashierBargainPct) || 15) + "%) — Chủ quán duyệt";
    else if (ap && ap.type === "discount") desc = "Giảm giá sâu (> " + (Number(pCash.discountMaxPct) || 10) + "%) — Chủ quán duyệt";
    else if (ap && ap.type === "unlock_bill") desc = "Mở khóa bill lặp lại từ lần 2 trở lên — Chủ quán kiểm soát chống gian lận";
    else if (ap && ap.type === "advance") desc = "Ứng lương khoản lớn (> " + U.money(Number(pCash.approveAdvanceUnder) || 500000) + ") — Chủ quán duyệt";
    else if (ap && ap.type === "wastage") desc = "Hao hụt nguyên liệu lớn (> " + U.money(Number(pCash.approveWasteUnder) || 300000) + ") — Chủ quán duyệt";
    else if (ap && ap.type === "noshow_deposit") desc = "Cọc bàn lớn / Phòng VIP (> " + U.money(Number(pCash.approveNoShowUnder) || 300000) + ") — Chủ quán duyệt";
    return {
      tier: "owner",
      badgeLabel: "Vấn đề lớn · Chủ quán duyệt",
      badgeTone: "danger",
      desc,
    };
  };

  E.pendingApprovalsByTier = function (tier) {
    const all = E.pendingApprovals();
    if (!tier || tier === "all") return all;
    return all.filter((a) => E.approvalTier(a) === tier);
  };

  E.canApprove = function (staffId, ap) {
    const st = E.staff(staffId);
    if (!st) return false;
    if (st.role === "owner") return true;
    if (st.role === "accountant") return E.can("accountant", "approve");
    if (st.role === "cashier") return E.approvalTier(ap) === "cashier";
    return false;
  };
  // opts: {deduct: true} cho lech kho -> tru luong nguoi kiem
  E.resolveApproval = function (id, approve, reason, by, opts) {
    opts = opts || {};
    const ap = D().approvals.find((a) => a.id === id);
    if (!ap || ap.status !== "pending") fail("Yêu cầu không còn chờ duyệt.");
    if (!approve && (!reason || reason.trim().length < 3)) fail("Vui lòng nhập lý do từ chối.");
    ap.status = approve ? "approved" : "rejected";
    ap.resolvedBy = by;
    ap.resolvedAt = Date.now();
    ap.resolveNote = reason || "";
    const d = D();
    switch (ap.type) {
      case "unlock_bill": {
        const tk = E.ticket(ap.ref);
        if (tk && approve) { tk.status = "open"; tk.unlockCount = (tk.unlockCount || 0) + 1; tk.prebillAt = null; }
        break;
      }
      case "void_item": {
        const tk = E.ticket(ap.ref);
        const it = tk && tk.items.find((i) => i.id === ap.itemId);
        if (it) { if (approve) voidItem(tk, it, ap.reason, by); else it.voidRequested = false; }
        break;
      }
      case "discount": {
        const tk = E.ticket(ap.ref);
        if (tk && approve) tk.discount = { type: ap.payload.type, value: ap.payload.value, reason: ap.reason, by: ap.by, approvedBy: by };
        break;
      }
      case "seafood_bargain": {
        const tk = E.ticket(ap.ref);
        const it = tk && tk.items.find((i) => i.id === ap.itemId);
        if (it && it.bargain) {
          it.bargain.status = approve ? "approved" : "rejected";
          it.bargain.approvedBy = by;
          if (!approve) it.dealAmount = null;
          else it.dealAmount = ap.payload.dealAmount;
        }
        break;
      }
      case "wastage": {
        const w = d.wastage.find((x) => x.id === ap.ref);
        if (w) { w.status = approve ? "approved" : "rejected"; w.resolvedBy = by; w.resolvedAt = Date.now(); }
        if (w && !approve && opts.deduct) addDeduction(w.by, w.amount, "Hao hụt không được chấp nhận: " + ap.title);
        break;
      }
      case "advance": {
        const adv = d.advances.find((x) => x.id === ap.ref);
        if (adv) { adv.status = approve ? "approved" : "rejected"; adv.approvedBy = by; }
        break;
      }
      case "overtime": {
        const r = d.attendance.find((x) => x.id === ap.ref);
        if (r) { r.otStatus = approve ? "approved" : "rejected"; r.otApprovedMin = approve ? r.otPendingMin : 0; }
        break;
      }
      case "count_variance": {
        const c = d.counts.find((x) => x.id === ap.ref);
        if (c) c.varianceStatus = approve ? (opts.deduct ? "deducted" : "accepted") : "rejected";
        if (approve && opts.deduct && c) addDeduction(c.by, ap.amount, "Bồi hoàn lệch kiểm kho " + U.dayLabel(c.dayKey));
        break;
      }
      case "noshow_deposit": {
        const bk = d.bookings.find((x) => x.id === ap.ref);
        if (bk) { bk.depositStatus = approve ? "forfeited" : "refunded"; }
        if (approve) (d.otherIncome = d.otherIncome || []).push({ at: Date.now(), dayKey: U.dayKey(), amount: ap.amount, reason: "Giữ cọc khách không đến: " + (bk ? bk.name : "") });
        break;
      }
    }
    return ap;
  };
  function addDeduction(staffId, amount, reason) {
    (D().deductions = D().deductions || []).push({ id: U.uid("dd"), staffId, amount: Math.round(amount), reason, monthKey: U.monthKey(), at: Date.now() });
  }

  /* ======================= KHO ======================= */
  E.stockValue = function () {
    let v = 0;
    C().bags.forEach((b) => (v += (D().stock[b.id] || 0) * (b.cost || 0)));
    Object.keys(D().tank).forEach((mid) => (v += D().tank[mid].kg * ((E.menu(mid) || {}).costPerKg || 0)));
    Object.keys(D().drinks).forEach((mid) => (v += D().drinks[mid] * ((E.menu(mid) || {}).cost || 0)));
    return v;
  };
  E.lowBags = () => C().bags.filter((b) => (D().stock[b.id] || 0) < b.minStock);

  // {menuId | bagId | drinkId, fishIds, count, kg, qty, reason, photo, by}
  E.reportWaste = function (x) {
    if (!x.photo) fail("Cần chụp ảnh bằng chứng trước khi gửi.");
    if (!x.reason || x.reason.trim().length < 3) fail("Vui lòng nhập lý do.");
    const d = D();
    const photoUrl = x.photoUrl || null;
    let w;
    let name = "";
    const drinkRef = x.drinkId || (x.kind === "drink" ? x.menuId : null) || (x.menuId && E.menu(x.menuId) && E.menu(x.menuId).kind !== "seafood" ? x.menuId : null);
    if (drinkRef) {
      const m = E.menu(drinkRef);
      if (!m) fail("Không tìm thấy mặt hàng đồ uống.");
      const qty = Number(x.qty) || 0;
      if (!(qty > 0)) fail("Nhập số lượng hao hụt.");
      d.drinks[m.id] = Math.max(0, (d.drinks[m.id] || 0) - qty);
      w = { id: U.uid("ws"), at: Date.now(), menuId: m.id, kind: "drink", qty, amount: qty * (m.cost || 0), reason: x.reason, by: x.by, photo: true, photoUrl, status: "pending" };
      name = m.name + " x" + w.qty + " " + (m.unit || "lon");
    } else if (x.menuId) {
      const m = E.menu(x.menuId);
      if (!m) fail("Không tìm thấy mặt hàng hải sản.");
      const t = E.syncTank(x.menuId);
      let kg = Math.round((Number(x.kg) || 0) * 100) / 100;
      let count = Number(x.count) || 0;
      let removedFish = [];
      if (E.isCountableSeafood(m) && t && Array.isArray(t.items)) {
        const wantIds = Array.isArray(x.fishIds) ? x.fishIds : x.fishId ? [x.fishId] : [];
        if (wantIds.length) {
          wantIds.forEach((fid) => {
            const idx = t.items.findIndex((f) => f.id === fid || f.code === fid);
            if (idx >= 0) removedFish.push(t.items.splice(idx, 1)[0]);
          });
        } else if (count > 0 && t.items.length) {
          removedFish = t.items.splice(0, Math.min(count, t.items.length));
        }
        if (removedFish.length) {
          count = removedFish.length;
          if (!(kg > 0)) kg = Math.round(removedFish.reduce((s, f) => s + (Number(f.kg) || 0), 0) * 100) / 100;
        }
        E.syncTank(x.menuId);
      } else if (t) {
        if (!(kg > 0)) fail("Nhập khối lượng hao hụt.");
        t.kg = Math.max(0, Math.round((t.kg - kg) * 100) / 100);
        t.count = Math.max(0, t.count - count);
      }
      if (!(kg > 0)) fail("Nhập khối lượng hoặc chọn con cá bị hỏng.");
      const fishNote = removedFish.length ? " (" + removedFish.map((f) => f.code).join(", ") + ")" : "";
      w = { id: U.uid("ws"), at: Date.now(), menuId: m.id, kind: "seafood", count, kg, fishIds: removedFish.map((f) => f.id), amount: Math.round(kg * (m.costPerKg || 0)), reason: x.reason + fishNote, by: x.by, photo: true, photoUrl, status: "pending" };
      name = m.name + " " + (w.count ? w.count + " con, " : "") + U.kg(w.kg) + fishNote;
    } else {
      const b = E.bag(x.bagId);
      if (!b) fail("Không tìm thấy nguyên liệu bếp.");
      const qty = Number(x.qty) || 0;
      if (!(qty > 0)) fail("Nhập số lượng hao hụt.");
      d.stock[b.id] = Math.max(0, (d.stock[b.id] || 0) - qty);
      w = { id: U.uid("ws"), at: Date.now(), bagId: b.id, kind: "bag", qty, amount: qty * (b.cost || 0), reason: x.reason, by: x.by, photo: true, photoUrl, status: "pending" };
      name = b.name + " x" + w.qty + " " + (b.unit || "túi");
    }
    d.wastage.unshift(w);
    const auto = Number(C().inventory.wasteAutoApproveUnder) || 0;
    if (w.amount <= auto) w.status = "approved";
    else E.createApproval({ type: "wastage", by: x.by, ref: w.id, title: "Hao hụt: " + name, amount: w.amount, reason: w.reason, photo: true, photoUrl });
    return w;
  };

  // lines: [{type:'tank'|'bag'|'drink', ref, count, kg, qty, cost, fishWeights}]
  E.receiveGoods = function (x) {
    if (!x.supplier) fail("Nhập tên nhà cung cấp.");
    if (!x.witness || x.witness === x.by) fail("Cần người thứ hai cùng kiểm và xác nhận bằng PIN.");
    const lines = (x.lines || []).filter((l) => (l.kg || 0) > 0 || (l.qty || 0) > 0 || (l.count || 0) > 0);
    if (!lines.length) fail("Chưa có dòng hàng nào.");
    const d = D();
    lines.forEach((l) => {
      if (l.type === "tank") {
        const m = E.menu(l.ref);
        const t = E.syncTank(l.ref) || (d.tank[l.ref] = { count: 0, kg: 0, items: [] });
        const addCount = Number(l.count) || 0;
        const addKg = Math.round((Number(l.kg) || 0) * 100) / 100;
        if (m && E.isCountableSeafood(m)) {
          t.items = Array.isArray(t.items) ? t.items : [];
          const prefix = m.fishPrefix || m.id.replace(/^m_/, "").slice(0, 2).toUpperCase();
          const baseIdx = t.items.length;
          const cnt = Math.max(1, addCount || Math.round(addKg / (Number(m.avgKgPerPiece) || 0.85)));
          const weights = Array.isArray(l.fishWeights) && l.fishWeights.length ? l.fishWeights : null;
          if (weights) {
            weights.forEach((w, idx) => {
              const num = baseIdx + idx + 1;
              t.items.push({ id: prefix + "-" + String(num).padStart(2, "0"), code: "#" + prefix + "-" + String(num).padStart(2, "0"), kg: Math.round(Number(w) * 100) / 100 });
            });
          } else {
            const avg = addKg / cnt;
            let rem = addKg;
            for (let i = 0; i < cnt; i++) {
              const num = baseIdx + i + 1;
              const w = i === cnt - 1 ? Math.max(0.15, Math.round(rem * 100) / 100) : Math.max(0.15, Math.round(avg * 100) / 100);
              rem -= w;
              t.items.push({ id: prefix + "-" + String(num).padStart(2, "0"), code: "#" + prefix + "-" + String(num).padStart(2, "0"), kg: w });
            }
          }
          E.syncTank(l.ref);
        } else {
          t.count += addCount;
          t.kg = Math.round((t.kg + addKg) * 100) / 100;
        }
        l.name = m ? m.name : l.ref;
        l.cost = l.cost || Math.round(addKg * ((m && m.costPerKg) || 0));
      } else if (l.type === "bag") {
        const b = E.bag(l.ref);
        d.stock[l.ref] = (d.stock[l.ref] || 0) + (Number(l.qty) || 0);
        l.name = b ? b.name : l.ref;
        l.cost = l.cost || (l.qty || 0) * ((b && b.cost) || 0);
      } else {
        const m = E.menu(l.ref);
        d.drinks[l.ref] = (d.drinks[l.ref] || 0) + (Number(l.qty) || 0);
        l.name = m ? m.name : l.ref;
        l.cost = l.cost || (l.qty || 0) * ((m && m.cost) || 0);
      }
    });
    const rc = { id: U.uid("gr"), dayKey: U.dayKey(), at: Date.now(), supplier: x.supplier, by: x.by, witness: x.witness, lines, total: U.sum(lines, (l) => l.cost) };
    d.receipts.unshift(rc);
    return rc;
  };

  // Danh sach can kiem kho cuoi ca (khong tra ve so ly thuyet cho giao dien kiem)
  E.countSheet = function () {
    const lines = [];
    C().menu.filter((m) => m.kind === "seafood" && m.active).forEach((m) => lines.push({ type: "tank", ref: m.id, name: m.name, unit: E.isCountableSeafood(m) ? "con + kg" : "kg" }));
    C().bags.forEach((b) => lines.push({ type: "bag", ref: b.id, name: b.name, unit: b.unit || "túi", group: b.group || "meat" }));
    C().menu.filter((m) => (m.kind === "beer" || m.kind === "drink") && m.active).forEach((m) => lines.push({ type: "drink", ref: m.id, name: m.name, unit: m.unit || "lon" }));
    return lines;
  };
  E.todayCount = () => D().counts.find((c) => c.dayKey === U.dayKey());
  // entries: {ref: {count, kg, qty}}
  E.submitCount = function (entries, by) {
    if (C().locks.blindCountLock && E.todayCount()) fail("Ca hôm nay đã nộp kết quả kiểm kho và đã khóa.");
    const d = D();
    const inv = C().inventory;
    const lines = [];
    const over = [];
    let varianceValue = 0;
    E.countSheet().forEach((s) => {
      const e = entries[s.ref] || {};
      if (s.type === "tank") {
        const t = d.tank[s.ref] || { count: 0, kg: 0 };
        const m = E.menu(s.ref);
        const actCount = Number(e.count) || 0;
        const actKg = Math.round((Number(e.kg) || 0) * 100) / 100;
        const dCount = actCount - t.count;
        const dKgPct = t.kg ? ((actKg - t.kg) / t.kg) * 100 : actKg ? 100 : 0;
        const bad = (m.avgKgPerPiece >= 0.1 && Math.abs(dCount) > inv.tankCountTol) || dKgPct < -inv.tankKgTol;
        const val = Math.round(Math.min(0, actKg - t.kg) * m.costPerKg);
        lines.push({ type: "tank", ref: s.ref, name: s.name, theoCount: t.count, theoKg: t.kg, actCount, actKg, dCount, dKgPct, bad, value: val });
        if (bad) { over.push(s.name + (dCount ? " lệch " + dCount + " con" : "") + " (" + U.num(dKgPct, 1) + "% kg)"); varianceValue += -val; }
        t.count = actCount;
        t.kg = actKg;
        d.tank[s.ref] = t;
      } else {
        const store = s.type === "bag" ? d.stock : d.drinks;
        const theo = store[s.ref] || 0;
        const act = Number(e.qty) || 0;
        const diff = act - theo;
        const tol = s.type === "bag" ? Math.ceil((theo * inv.kitchenBagTol) / 100) : inv.beerTol;
        const unitCost = s.type === "bag" ? E.bag(s.ref).cost : E.menu(s.ref).cost;
        const bad = diff < 0 && Math.abs(diff) > tol;
        lines.push({ type: s.type, ref: s.ref, name: s.name, theo, act, diff, bad, value: Math.min(0, diff) * unitCost });
        if (bad) { over.push(s.name + " thiếu " + Math.abs(diff)); varianceValue += -Math.min(0, diff) * unitCost; }
        store[s.ref] = act;
      }
    });
    const c = { id: U.uid("cnt"), dayKey: U.dayKey(), at: Date.now(), by, lines, status: "submitted", locked: !!C().locks.blindCountLock, varianceValue, varianceStatus: over.length ? "pending" : "ok" };
    d.counts.unshift(c);
    if (over.length) E.createApproval({ type: "count_variance", by, ref: c.id, title: "Lệch kiểm kho: " + over.slice(0, 2).join(", ") + (over.length > 2 ? " và " + (over.length - 2) + " mục khác" : ""), amount: Math.round(varianceValue), reason: "Vượt dung sai cho phép. Kiểm kho lúc " + U.time(c.at) });
    return c;
  };

  // Doi soat 4 lop cho 1 ngay (hom nay: so lieu song)
  E.reconciliation = function (key) {
    key = key || U.dayKey();
    const d = D();
    const cnt = d.counts.find((c) => c.dayKey === key);
    const sales = d.sales.filter((s) => s.dayKey === key);
    const openLines = [];
    if (key === U.dayKey()) E.openTickets().forEach((t) => t.items.forEach((i) => openLines.push(i)));
    const allLines = sales.reduce((a, s) => a.concat(s.lines), []).concat(openLines);
    const sold = {};
    allLines.forEach((l) => {
      if (l.status === "void") return;
      const m = E.menu(l.menuId);
      if (!m) return;
      if (m.kind === "seafood") { sold[m.id] = sold[m.id] || { kg: 0, count: 0 }; sold[m.id].kg += l.kg || 0; sold[m.id].count += l.count || 0; }
      else { sold[m.id] = sold[m.id] || { qty: 0 }; sold[m.id].qty += l.qty; }
    });
    const received = {};
    d.receipts.filter((r) => r.dayKey === key).forEach((r) => r.lines.forEach((l) => { received[l.ref] = received[l.ref] || { kg: 0, count: 0, qty: 0 }; received[l.ref].kg += l.kg || 0; received[l.ref].count += l.count || 0; received[l.ref].qty += l.qty || 0; }));
    const waste = {};
    d.wastage.filter((w) => U.dayKey(w.at) === key).forEach((w) => { const k = w.menuId || w.bagId; waste[k] = waste[k] || { kg: 0, count: 0, qty: 0, pending: 0 }; waste[k].kg += w.kg || 0; waste[k].count += w.count || 0; waste[k].qty += w.qty || 0; if (w.status === "pending") waste[k].pending++; });
    const tank = C().menu.filter((m) => m.kind === "seafood").map((m) => {
      const line = cnt && cnt.lines.find((l) => l.ref === m.id);
      return { ref: m.id, name: m.name, received: received[m.id] || { kg: 0, count: 0 }, sold: sold[m.id] || { kg: 0, count: 0 }, waste: waste[m.id] || { kg: 0, count: 0 }, system: d.tank[m.id], count: line || null };
    });
    const bags = C().bags.map((b) => {
      const usedBy = C().menu.filter((m) => (m.bom || []).some((x) => x.bagId === b.id));
      const used = U.sum(usedBy, (m) => ((sold[m.id] || {}).qty || 0) * m.bom.find((x) => x.bagId === b.id).qty);
      const line = cnt && cnt.lines.find((l) => l.ref === b.id);
      return { ref: b.id, name: b.name, received: (received[b.id] || {}).qty || 0, used, waste: (waste[b.id] || {}).qty || 0, system: d.stock[b.id] || 0, count: line || null, min: b.minStock };
    });
    const beers = C().menu.filter((m) => m.kind === "beer").map((m) => {
      const paid = U.sum(allLines.filter((l) => l.menuId === m.id && !l.isFree && l.status !== "void"), (l) => l.qty);
      const free = U.sum(allLines.filter((l) => l.menuId === m.id && l.isFree && l.status !== "void"), (l) => l.qty);
      const promo = C().promos.find((p) => p.menuId === m.id);
      const capsReturned = U.sum(d.pgReturns.filter((r) => r.dayKey === key), (r) => (r.caps || {})[m.id] || 0);
      const line = cnt && cnt.lines.find((l) => l.ref === m.id);
      return { ref: m.id, name: m.name, paid, free, capsReturned, capsRequired: promo && promo.requireCapReturn ? free : 0, system: d.drinks[m.id] || 0, count: line || null };
    });
    const sh = d.shift && d.shift.dayKey === key ? d.shift : null;
    const z = d.shiftsHistory.find((x) => x.dayKey === key);
    const cash = z ? { expected: z.expected, counted: z.counted, variance: z.variance, closed: true } : sh ? { expected: E.shiftStats(sh).expected, counted: null, variance: null, closed: false } : null;
    return { key, tank, bags, beers, cash, count: cnt, salesCount: sales.length };
  };

  /* ======================= PG BIA ======================= */
  E.pgStats = function (staffId, key) {
    key = key || U.dayKey();
    const st = E.staff(staffId);
    const brandIds = (st && st.brandIds) || C().brands.map((b) => b.id);
    const menuIds = C().menu.filter((m) => m.kind === "beer" && brandIds.includes(m.brandId)).map((m) => m.id);
    const lines = [];
    D().sales.filter((s) => s.dayKey === key).forEach((s) => s.lines.forEach((l) => lines.push(l)));
    if (key === U.dayKey()) E.openTickets().forEach((t) => t.items.forEach((i) => lines.push(i)));
    const mine = lines.filter((l) => menuIds.includes(l.menuId) && l.status !== "void");
    const cans = U.sum(mine.filter((l) => !l.isFree && l.addedBy === staffId), (l) => l.qty);
    const free = {};
    brandIds.forEach((b) => (free[b] = 0));
    mine.filter((l) => l.isFree).forEach((l) => { const m = E.menu(l.menuId); free[m.brandId] = (free[m.brandId] || 0) + l.qty; });
    const quota = {};
    brandIds.forEach((b) => { const q = (C().pg.brandQuotaPerShift || {})[b]; quota[b] = { total: q === undefined ? null : Number(q), used: free[b] || 0, left: q === undefined ? null : Math.max(0, Number(q) - (free[b] || 0)) }; });
    const capsRequired = U.sum(mine.filter((l) => l.isFree && (C().promos.find((p) => p.id === l.promoId) || {}).requireCapReturn), (l) => l.qty);
    const capsReturned = U.sum(D().pgReturns.filter((r) => r.dayKey === key && r.by === staffId), (r) => U.sum(Object.values(r.caps || {})));
    const cases = cans / 24;
    const target = Number(C().pg.targetCasesPerShift) || 0;
    const commission = Math.floor(cases) * (Number(C().pg.commissionPerCase) || 0);
    const cratesOut = E.openTickets().reduce((n, t) => n + Math.floor(U.sum(t.items.filter((i) => menuIds.includes(i.menuId)), (i) => i.qty) / 24), 0);
    return { brandIds, menuIds, cans, cases, target, commission, free, quota, capsRequired, capsReturned, capsPending: Math.max(0, capsRequired - capsReturned), cratesOut };
  };
  E.submitPgReturn = function (x) {
    const r = { id: U.uid("pgr"), dayKey: U.dayKey(), at: Date.now(), by: x.by, caps: x.caps || {}, crates: Number(x.crates) || 0, note: x.note || "" };
    D().pgReturns.push(r);
    return r;
  };
  E.rebateProgress = function (brandId) {
    const b = E.brand(brandId);
    const menuIds = C().menu.filter((m) => m.brandId === brandId).map((m) => m.id);
    const now = new Date(U.dayStart(U.dayKey()));
    const start = b.rebatePeriod === "quarter" ? new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1) : new Date(now.getFullYear(), now.getMonth(), 1);
    const startKey = U.dayKey(start.getTime() + 12 * 3600000);
    // Uoc tinh tu lich su: ty le bia/doanh thu ruou bia
    const hist = D().dailyStats.filter((d) => d.dayKey >= startKey);
    const shareOfBrand = brandId === "br_tiger" ? 0.45 : brandId === "br_heineken" ? 0.35 : 0.2;
    let cans = U.sum(hist, (d) => (d.alcohol * 0.8 * shareOfBrand) / 22000);
    D().sales.filter((s) => s.dayKey >= startKey).forEach((s) => s.lines.forEach((l) => { if (menuIds.includes(l.menuId) && !l.isFree) cans += l.qty; }));
    const cases = Math.round(cans / 24);
    const periodEnd = b.rebatePeriod === "quarter" ? new Date(start.getFullYear(), start.getMonth() + 3, 0) : new Date(start.getFullYear(), start.getMonth() + 1, 0);
    const daysTotal = Math.round((periodEnd - start) / 86400000) + 1;
    const daysPassed = Math.max(1, Math.round((now - start) / 86400000) + 1);
    const forecast = Math.round((cases / daysPassed) * daysTotal);
    return { brand: b, cases, target: b.rebateTarget, pct: Math.min(100, (cases / b.rebateTarget) * 100), forecast, daysLeft: daysTotal - daysPassed, onTrack: forecast >= b.rebateTarget, periodLabel: b.rebatePeriod === "quarter" ? "Quý " + (Math.floor(start.getMonth() / 3) + 1) + "/" + start.getFullYear() : U.monthLabel(startKey) };
  };

  /* ======================= DAT BAN & KHACH ======================= */
  E.bookingSlots = function () {
    const b = C().booking;
    const out = [];
    for (let m = U.minutesOf(b.slotStart); m <= U.minutesOf(b.slotEnd); m += Number(b.slotStep) || 30) out.push(U.pad(Math.floor(m / 60) % 24) + ":" + U.pad(m % 60));
    return out;
  };
  // Ban trong phu hop (khong co booking trong +-2 gio)
  E.freeTablesFor = function (key, time, areaId, guests) {
    const t0 = U.atTime(time, key);
    return C().tables.filter((t) => {
      if (areaId && t.areaId !== areaId) return false;
      if (guests && t.seats < guests) return false;
      const clash = D().bookings.some((b) => b.tableId === t.id && b.dayKey === key && ["holding", "confirmed", "seated"].includes(b.status) && Math.abs(U.atTime(b.time, b.dayKey) - t0) < 2 * 3600000);
      if (clash) return false;
      if (key === U.dayKey() && t0 - Date.now() < 90 * MIN && E.ticketByTable(t.id)) return false;
      return true;
    });
  };
  E.createBooking = function (x) {
    if (!x.name || !x.phone) fail("Vui lòng nhập họ tên và số điện thoại.");
    if (!/^0\d{9}$/.test(String(x.phone).replace(/\s/g, ""))) fail("Số điện thoại không hợp lệ (10 số, bắt đầu bằng 0).");
    const free = E.freeTablesFor(x.dayKey, x.time, x.areaId, x.guests);
    if (!free.length) fail("Khu vực này đã hết chỗ trong khung giờ đã chọn.");
    const table = free.sort((a, b) => a.seats - b.seats)[0];
    const cfg = C().booking;
    const isVip = table.type === "vip";
    const deposit = x.deposit !== undefined && x.deposit !== null ? Math.max(0, Number(x.deposit) || 0) : (cfg.depositRequired ? (isVip ? cfg.depositVip : cfg.depositNormal) : 0);
    const bk = { id: U.uid("bk"), code: "DB" + String(Date.now()).slice(-6), name: x.name, phone: String(x.phone).replace(/\s/g, ""), dayKey: x.dayKey, time: x.time, guests: Number(x.guests) || 2, areaId: x.areaId, tableId: table.id, deposit, depositPaid: deposit === 0, status: deposit ? "holding" : "confirmed", createdAt: Date.now(), holdUntil: deposit ? Date.now() + cfg.holdMinutes * MIN : null, note: x.note || "", source: x.source || "web" };
    D().bookings.push(bk);
    return bk;
  };
  E.confirmDeposit = function (bookingId) {
    const bk = D().bookings.find((b) => b.id === bookingId);
    if (!bk) fail("Không tìm thấy đặt bàn.");
    if (bk.status !== "holding") fail("Đặt bàn không còn ở trạng thái chờ cọc.");
    bk.depositPaid = true;
    bk.status = "confirmed";
    bk.paidAt = Date.now();
    return bk;
  };
  E.cancelBooking = function (bookingId, reason) {
    const bk = D().bookings.find((b) => b.id === bookingId);
    if (bk) { bk.status = "cancelled"; bk.cancelReason = reason || ""; }
  };
  E.findBottles = (phone) => D().bottleKeeps.filter((b) => b.phone === String(phone).replace(/\s/g, "") && b.status === "kept");
  E.createBottleKeep = function (x) {
    if (!/^0\d{9}$/.test(String(x.phone || "").replace(/\s/g, ""))) fail("Số điện thoại không hợp lệ.");
    if (!x.wine) fail("Nhập tên rượu.");
    const n = D().bottleKeeps.length + 17;
    const bt = { id: U.uid("bt"), code: "RG-" + String(n).padStart(4, "0"), phone: String(x.phone).replace(/\s/g, ""), name: x.name || "", wine: x.wine, remainingPct: Number(x.remainingPct) || 50, createdAt: Date.now(), expiresAt: Date.now() + 60 * 86400000, status: "kept", by: x.by, tableId: x.tableId };
    D().bottleKeeps.push(bt);
    E.print("p_bar", { kind: "tag", title: "THẺ GỬI RƯỢU", big: bt.code, rows: [{ l: bt.wine, big: true }, { l: "Khách", r: bt.name || "-" }, { l: "SĐT", r: bt.phone.replace(/(\d{4})(\d{3})(\d{3})/, "$1 $2 $3") }, { l: "Còn lại", r: bt.remainingPct + "%" }, { l: "Hạn giữ", r: U.date(bt.expiresAt) }], footer: ["Dán thẻ lên chai và cất vào tủ rượu"] });
    return bt;
  };
  const TAX_DIR = {
    "0301234567": { name: "Công ty TNHH Thương mại Minh Long", address: "45 Lê Lợi, P. Bến Nghé, Q.1, TP. Hồ Chí Minh" },
    "0312345678": { name: "Hộ kinh doanh Quán Nhậu Phố Biển", address: "128 Nguyễn Văn Linh, Q.7, TP. Hồ Chí Minh" },
    "0109876543": { name: "Công ty Cổ phần Công nghệ An Phát", address: "12 Duy Tân, Cầu Giấy, Hà Nội" },
    "0316789012": { name: "Công ty TNHH Dịch vụ Sao Việt", address: "220 Điện Biên Phủ, Q.3, TP. Hồ Chí Minh" },
  };
  E.lookupTaxCode = function (code) {
    const c = String(code || "").trim().replace(/[\s-]/g, "");
    if (!c) return null;
    const prev = (D().einvoices || []).find((e) => String(e.taxCode || "").replace(/[\s-]/g, "") === c && e.company);
    if (prev) return { name: prev.company, address: prev.address || "", email: prev.email || "" };
    return TAX_DIR[c] || null;
  };
  E.saleById = (id) => D().sales.find((s) => s.id === id);
  E.requestEInvoice = function (x) {
    const s = E.saleById(x.saleId);
    if (!s) fail("Không tìm thấy hóa đơn. Kiểm tra lại mã trên bill.");
    if (s.einvoice) fail("Hóa đơn này đã được yêu cầu (" + s.einvoice.invoiceNo + ").");
    const hours = Number(C().tax.einvoiceWindowHours) || 24;
    if (Date.now() - s.closedAt > hours * 3600000) fail("Đã quá " + hours + " giờ kể từ khi thanh toán. Vui lòng liên hệ quán.");
    if (!/^\d{10}(\d{3})?$/.test(String(x.taxCode || "").replace(/-/g, ""))) fail("Mã số thuế gồm 10 hoặc 13 chữ số.");
    if (!x.company) fail("Nhập tên đơn vị.");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(x.email || "")) fail("Email không hợp lệ.");
    const isDemoMode = typeof window !== "undefined" && window.App && typeof window.App.isDemo === "function" && window.App.isDemo();
    const no = (isDemoMode ? "C26MTT-" : "YCHD-") + String(1285 + D().einvoices.length).padStart(8, "0");
    const status = isDemoMode ? "issued" : "requested";
    const ei = { id: U.uid("ei"), saleId: s.id, taxCode: x.taxCode, company: x.company, address: x.address || "", email: x.email, amount: s.grand, at: Date.now(), status, invoiceNo: no };
    D().einvoices.unshift(ei);
    s.einvoice = { invoiceNo: no, at: ei.at, status };
    return ei;
  };
  E.markEInvoiceIssued = function (id, officialNo) {
    const ei = (D().einvoices || []).find((x) => x.id === id);
    if (!ei) fail("Không tìm thấy yêu cầu xuất hóa đơn.");
    ei.status = "issued";
    if (officialNo && String(officialNo).trim()) ei.invoiceNo = String(officialNo).trim();
    else if (String(ei.invoiceNo || "").startsWith("YCHD-")) ei.invoiceNo = ei.invoiceNo.replace(/^YCHD-/, "C26MTT-");
    const s = ei.saleId ? E.saleById(ei.saleId) : null;
    if (s) s.einvoice = { invoiceNo: ei.invoiceNo, at: Date.now(), status: "issued" };
    return ei;
  };

  /* ======================= BAO CAO ======================= */
  E.liveDay = function (key) {
    key = key || U.dayKey();
    const sales = D().sales.filter((s) => s.dayKey === key);
    const food = U.sum(sales, saleFoodGross);
    const alcohol = U.sum(sales, saleAlcoholGross);
    const vipFee = U.sum(sales, (s) => Number(s.vipFee) || 0);
    const discount = U.sum(sales, (s) => Number(s.discount) || 0);
    const vatFood = U.sum(sales, (s) => (s.vat.food || {}).vat || 0);
    const vatAlcohol = U.sum(sales, (s) => (s.vat.alcohol || {}).vat || 0);
    const open = E.openTickets();
    const openValue = U.sum(open, (t) => E.totals(t).grand);
    const wastage = U.sum(D().wastage.filter((w) => U.dayKey(w.at) === key && w.status !== "rejected"), (w) => w.amount);
    const labor = E.laborCostOfDay(key);
    const revenue = food + alcohol + vipFee - discount;
    const cogs = U.sum(sales, (s) => s.cost);
    return {
      dayKey: key, sales, revenue, food, alcohol, vatFood, vatAlcohol, cogs, bills: sales.length, guests: U.sum(sales, (s) => s.guests),
      cash: U.sum(sales, (s) => U.sum(s.payments.filter((p) => p.method === "cash"), (p) => p.amount)), qr: U.sum(sales, (s) => U.sum(s.payments.filter((p) => p.method !== "cash"), (p) => p.amount)),
      tips: U.sum(sales, (s) => s.tip), vipFee, discount, openTickets: open.length, openValue, wastage, labor,
      gross: revenue - cogs, net: revenue - cogs - wastage - labor, utility: Math.round(food * 0.041),
    };
  };
  // Gop lich su + ngay hom nay (song)
  E.days = function (fromKey, toKey) {
    const today = U.dayKey();
    const out = D().dailyStats.filter((d) => d.dayKey >= fromKey && d.dayKey <= toKey && d.dayKey !== today).map((d) => {
      const row = Object.assign({}, d);
      const expected = (Number(row.food) || 0) + (Number(row.alcohol) || 0) + (Number(row.vipFee) || 0) - (Number(row.discount) || 0);
      if (expected > 0 && row.revenue !== expected) {
        row.revenue = expected;
        row.qr = Math.max(0, row.revenue - (Number(row.cash) || 0));
      }
      return row;
    });
    if (today >= fromKey && today <= toKey) {
      const l = E.liveDay(today);
      out.push({ dayKey: today, revenue: l.revenue, food: l.food, alcohol: l.alcohol, cogs: l.cogs, cash: l.cash, qr: l.qr, bills: l.bills, guests: l.guests, wastage: l.wastage, labor: l.labor, utility: l.utility, tips: l.tips, vipFee: l.vipFee, discount: l.discount, live: true });
    }
    return out.sort((a, b) => (a.dayKey < b.dayKey ? -1 : 1));
  };
  E.rangeKeys = function (preset) {
    const today = U.dayKey();
    const t = new Date(U.dayStart(today));
    const k = (d) => U.dayKey(d.getTime() + 12 * 3600000);
    if (preset === "today") return [today, today];
    if (preset === "yesterday") { const y = U.dayKey(Date.now() - 86400000); return [y, y]; }
    if (preset === "week") { const d = new Date(t); const dow = (d.getDay() + 6) % 7; d.setDate(d.getDate() - dow); return [k(d), today]; }
    if (preset === "7d") { const d = new Date(t); d.setDate(d.getDate() - 6); return [k(d), today]; }
    if (preset === "30d") { const d = new Date(t); d.setDate(d.getDate() - 29); return [k(d), today]; }
    if (preset === "month") return [today.slice(0, 7) + "-01", today];
    if (preset === "lastmonth") { const d = new Date(t.getFullYear(), t.getMonth() - 1, 1); const e = new Date(t.getFullYear(), t.getMonth(), 0); return [k(d), k(e)]; }
    return [today, today];
  };
  E.summarize = function (days) {
    const s = { revenue: 0, food: 0, alcohol: 0, cogs: 0, cash: 0, qr: 0, bills: 0, guests: 0, wastage: 0, labor: 0, utility: 0, tips: 0, vipFee: 0, discount: 0 };
    days.forEach((d) => Object.keys(s).forEach((k) => (s[k] += Number(d[k]) || 0)));
    s.revenue = s.food + s.alcohol + s.vipFee - s.discount;
    s.gross = s.revenue - s.cogs;
    s.net = s.gross - s.wastage - s.labor - s.utility;
    s.margin = s.revenue ? (s.gross / s.revenue) * 100 : 0;
    s.avgBill = s.bills ? s.revenue / s.bills : 0;
    s.utilityPct = s.food ? (s.utility / s.food) * 100 : 0;
    return s;
  };
  E.marginAlerts = function () {
    const th = Number(C().marginAlert) || 0;
    return C().menu.filter((m) => m.active).map((m) => {
      const price = m.kind === "seafood" ? m.pricePerKg : m.price;
      const cost = m.kind === "seafood" ? m.costPerKg : m.cost;
      const margin = price ? ((price - cost) / price) * 100 : 0;
      return { menu: m, price, cost, margin };
    }).filter((x) => x.margin < th).sort((a, b) => a.margin - b.margin);
  };
  E.alerts = function () {
    const out = [];
    E.marginAlerts().forEach((x) => out.push({ level: "warning", icon: "trending-down", title: "Biên lãi " + x.menu.name + " " + U.pct(x.margin), detail: "Thấp hơn ngưỡng " + C().marginAlert + "%. Giá vốn " + U.money(x.cost) + (x.menu.kind === "seafood" ? "/kg" : "") }));
    E.lowBags().forEach((b) => out.push({ level: "warning", icon: "package", title: b.name + " sắp hết", detail: "Còn " + (D().stock[b.id] || 0) + " túi, tối thiểu " + b.minStock }));
    const key = U.dayKey();
    const unlocks = D().approvals.filter((a) => a.type === "unlock_bill" && U.dayKey(a.at) === key).length;
    if (unlocks >= 2) out.push({ level: "danger", icon: "lock-open", title: unlocks + " yêu cầu mở khóa bill hôm nay", detail: "Theo dõi thao tác sửa bill sau khi in tạm tính" });
    const voids = D().approvals.filter((a) => a.type === "void_item" && U.dayKey(a.at) === key).length;
    if (voids >= 3) out.push({ level: "danger", icon: "ban", title: voids + " yêu cầu hủy món hôm nay", detail: "Số lần hủy món cao bất thường" });
    const lastCount = D().counts[0];
    if (lastCount && lastCount.varianceStatus === "pending") out.push({ level: "danger", icon: "scale", title: "Lệch kiểm kho chưa xử lý", detail: "Ngày " + U.dayLabel(lastCount.dayKey) + " · giá trị " + U.money(lastCount.varianceValue || 0) });
    const offline = C().printers.filter((p) => !p.online);
    offline.forEach((p) => out.push({ level: "danger", icon: "printer", title: p.name + " mất kết nối", detail: p.backupId ? "Đang in tạm sang " + ((E.printer(p.backupId) || {}).name || "") : "Không có máy dự phòng" }));
    const recent = D().dailyStats.slice(-7);
    const util = E.summarize(recent).utilityPct;
    if (util > C().inventory.utilityCap) out.push({ level: "warning", icon: "flame", title: "Chi phí phụ phẩm " + U.pct(util) + " doanh thu bếp", detail: "Vượt trần " + C().inventory.utilityCap + "% (7 ngày gần nhất)" });
    const negVar = D().shiftsHistory.filter((z) => z.variance < 0).slice(0, 3);
    negVar.forEach((z) => out.push({ level: "danger", icon: "banknote", title: "Thiếu tiền mặt khi chốt ca " + U.dayLabel(z.dayKey), detail: U.money(z.variance) + " · " + (z.note || "") }));
    return out;
  };
  E.topItems = function (fromKey, toKey, n) {
    const agg = {};
    D().sales.filter((s) => s.dayKey >= fromKey && s.dayKey <= toKey).forEach((s) => s.lines.forEach((l) => {
      if (l.isFree || l.status === "void") return;
      const a = (agg[l.menuId] = agg[l.menuId] || { menuId: l.menuId, name: l.name, qty: 0, kg: 0, amount: 0, cost: 0 });
      a.qty += l.qty; a.kg += l.kg || 0; a.amount += l.amount; a.cost += l.cost;
    }));
    return Object.values(agg).sort((a, b) => b.amount - a.amount).slice(0, n || 10);
  };
  E.revenueByHour = function (key) {
    const hours = {};
    D().sales.filter((s) => s.dayKey === (key || U.dayKey())).forEach((s) => { const h = new Date(s.closedAt).getHours(); hours[h] = (hours[h] || 0) + s.grand; });
    return hours;
  };
  E.taxReport = function (monthKey) {
    const from = monthKey + "-01";
    const to = monthKey + "-31";
    const days = E.days(from, to);
    const rf = E.vatRate("food"), ra = E.vatRate("alcohol");
    const inc = C().tax.pricesIncludeVat;
    const rows = days.map((d) => {
      const foodWithVip = (Number(d.food) || 0) + (Number(d.vipFee) || 0) - (Number(d.discount) || 0);
      const vf = inc ? Math.round((foodWithVip * rf) / (100 + rf)) : Math.round((foodWithVip * rf) / 100);
      const va = inc ? Math.round((d.alcohol * ra) / (100 + ra)) : Math.round((d.alcohol * ra) / 100);
      return { dayKey: d.dayKey, food: foodWithVip, alcohol: d.alcohol, revenue: d.revenue, vatFood: vf, vatAlcohol: va, live: d.live };
    });
    const tot = { food: U.sum(rows, (r) => r.food), alcohol: U.sum(rows, (r) => r.alcohol), revenue: U.sum(rows, (r) => r.revenue), vatFood: U.sum(rows, (r) => r.vatFood), vatAlcohol: U.sum(rows, (r) => r.vatAlcohol) };
    const hkdRate = Number(C().tax.hkdRate) || 0;
    tot.hkdTax = Math.round((tot.revenue * hkdRate) / 100);
    tot.hkdVat = Math.round((tot.revenue * 3) / 100);
    tot.hkdPit = tot.hkdTax - tot.hkdVat;
    const einv = D().einvoices.filter((e) => U.monthKey(e.at) === monthKey);
    return { monthKey, rows, tot, rates: { food: rf, alcohol: ra, hkd: hkdRate }, mode: C().tax.mode, locked: D().taxLocks.includes(monthKey), einvoices: einv };
  };
  E.lockTaxPeriod = function (monthKey) {
    if (!D().taxLocks.includes(monthKey)) D().taxLocks.push(monthKey);
  };

  /* ======================= CAU HINH DONG ======================= */
  const PATH_LABELS = {
    "store.name": "Tên quán", "vip.hourlyRate": "Phụ thu phòng VIP mỗi giờ", "vip.minimumSpend": "Mức chi tối thiểu phòng VIP", "vip.minimumSpendEnabled": "Miễn phụ thu khi đạt mức chi tối thiểu",
    "booking.holdMinutes": "Thời gian giữ bàn chờ cọc", "booking.noShowMinutes": "Số phút trễ tính là khách không đến", "marginAlert": "Ngưỡng cảnh báo biên lãi",
    "attendance.cleanupBuffer": "Thời gian dọn dẹp sau bàn cuối", "attendance.graceMinutes": "Số phút cho phép đi trễ", "attendance.otMultiplier": "Hệ số tăng ca", "attendance.nightMultiplier": "Hệ số ca đêm",
    "payroll.advanceCapPct": "Hạn mức ứng lương", "locks.zLockTime": "Giờ tự khóa ca", "locks.prebillLock": "Khóa bill khi in tạm tính", "tax.food": "Thuế GTGT đồ ăn", "tax.alcohol": "Thuế GTGT rượu bia",
    "tax.mode": "Chế độ kế toán", "inventory.tankKgTol": "Dung sai hao nước hải sản", "inventory.kitchenBagTol": "Dung sai túi định lượng", "inventory.utilityCap": "Trần chi phí phụ phẩm",
  };
  E.pathLabel = (p) => PATH_LABELS[p] || p;
  E.diffConfig = function (a, b, prefix, out) {
    out = out || [];
    prefix = prefix || "";
    const keys = new Set(Object.keys(a || {}).concat(Object.keys(b || {})));
    keys.forEach((k) => {
      const p = prefix ? prefix + "." + k : k;
      const va = a ? a[k] : undefined, vb = b ? b[k] : undefined;
      if (Array.isArray(va) || Array.isArray(vb)) {
        if (JSON.stringify(va) !== JSON.stringify(vb)) out.push({ path: p, old: summarizeArr(va), new: summarizeArr(vb), isList: true });
      } else if (va && vb && typeof va === "object" && typeof vb === "object") E.diffConfig(va, vb, p, out);
      else if (JSON.stringify(va) !== JSON.stringify(vb)) out.push({ path: p, old: va, new: vb });
    });
    return out;
  };
  function summarizeArr(arr) {
    if (!Array.isArray(arr)) return arr;
    return arr.length + " mục";
  }
  // effective: 'now' | 'next_shift' | timestamp
  E.saveConfig = function (newCfg, opts) {
    opts = opts || {};
    const old = C();
    const changes = E.diffConfig(old, newCfg);
    if (!changes.length) return { changes };
    const entry = { id: U.uid("cfg"), at: Date.now(), by: opts.by, changes, before: U.clone(old), after: U.clone(newCfg), effective: opts.effective || "now", note: opts.note || "" };
    if (!opts.effective || opts.effective === "now") {
      Store.state.config = U.clone(newCfg);
      entry.appliedAt = Date.now();
    } else {
      const at = opts.effective === "next_shift" ? E.nextShiftStart() : Number(opts.effective);
      entry.applyAt = at;
      D().pendingConfig = { id: entry.id, applyAt: at, config: U.clone(newCfg) };
    }
    D().configHistory.unshift(entry);
    if (D().configHistory.length > 50) D().configHistory.length = 50;
    return { changes, entry };
  };
  E.nextShiftStart = function () {
    const now = Date.now();
    const starts = [];
    C().shifts.forEach((s) => s.segments.forEach((seg) => { [U.dayKey(), U.dayKey(now + 86400000)].forEach((k) => starts.push(U.atTime(seg.start, k))); }));
    return starts.filter((t) => t > now).sort((a, b) => a - b)[0] || now + 3600000;
  };
  E.restoreConfig = function (historyId, by) {
    const h = D().configHistory.find((x) => x.id === historyId);
    if (!h) fail("Không tìm thấy phiên bản.");
    return E.saveConfig(U.clone(h.before), { by, note: "Khôi phục phiên bản lúc " + U.dateTime(h.at) });
  };

  /* ======================= THONG BAO ======================= */
  function notify(type, x) {
    D().notifications.unshift(Object.assign({ id: U.uid("nt"), type, at: Date.now(), read: false }, x));
    if (D().notifications.length > 100) D().notifications.length = 100;
  }
  function clearNotify(type, ticketId) {
    D().notifications.forEach((n) => { if (n.type === type && n.ticketId === ticketId) n.read = true; });
  }
  E.notify = notify;
  E.notificationsFor = function (staffId) {
    const st = E.staff(staffId);
    if (!st) return [];
    return D().notifications.filter((n) => !n.read && (!n.waiterId || n.waiterId === staffId));
  };

  /* ======================= DONG HO HE THONG ======================= */
  // Chay dinh ky: tu huy giu cho, bao khach khong den, tu don ban, ap cau hinh hen gio, tu khoa ca
  E.tick = function () {
    const d = D();
    const now = Date.now();
    let changed = false;
    d.bookings.forEach((b) => {
      if (b.status === "holding" && b.holdUntil && now > b.holdUntil) { b.status = "expired"; changed = true; }
      if (b.status === "confirmed" && b.dayKey <= U.dayKey() && now > U.atTime(b.time, b.dayKey) + C().booking.noShowMinutes * MIN) {
        b.status = "noshow";
        if (b.deposit && b.depositPaid) E.createApproval({ type: "noshow_deposit", by: "system", ref: b.id, title: "Khách không đến: " + b.name + " (" + E.table(b.tableId).code + ")", amount: b.deposit, reason: "Quá " + C().booking.noShowMinutes + " phút so với giờ hẹn " + b.time + ", đề nghị giữ tiền cọc" });
        changed = true;
      }
    });
    Object.keys(d.tableState).forEach((tid) => {
      const ts = d.tableState[tid];
      if (ts.status === "dirty" && now - ts.since > C().floor.autoCleanMinutes * MIN) { delete d.tableState[tid]; changed = true; }
    });
    if (d.pendingConfig && now >= d.pendingConfig.applyAt) {
      Store.state.config = d.pendingConfig.config;
      const h = d.configHistory.find((x) => x.id === d.pendingConfig.id);
      if (h) h.appliedAt = now;
      d.pendingConfig = null;
      changed = true;
    }
    const sh = d.shift;
    if (sh && sh.status === "open" && C().locks.zLockEnabled) {
      const lockAt = U.atTime(C().locks.zLockTime, sh.dayKey);
      if (now > lockAt && now - lockAt < 6 * 3600000) { sh.status = "auto_locked"; sh.autoLockedAt = now; changed = true; }
    }
    return changed;
  };

  /* ======================= KHOI TAO DU LIEU MAU ======================= */
  E.finalizeSeed = function (state) {
    const pend = state.data._pendingSales || [];
    delete state.data._pendingSales;
    const prevState = Store.state;
    Store.state = state;
    pend.forEach((p) => {
      state.data.tickets.push(p.ticket);
      const tot = E.totals(p.ticket, p.ticket.closedAt);
      const need = tot.grand - tot.deposit;
      const amount = p.pay === "qr" ? need + (p.tip || 0) : Math.ceil(need / 50000) * 50000;
      E.pay(p.ticket.id, { payments: [{ method: p.pay, amount }], overAsTip: !!p.tip, by: "s_cash", at: p.ticket.closedAt, silentPrint: true, force: true });
      delete state.data.tableState[p.ticket.tableId];
    });
    state.data.lastBillClosedAt = Math.max.apply(null, state.data.sales.map((s) => s.closedAt).concat([0]));
    // Phieu in mau cho man hinh lich su in
    const a3 = state.data.tickets.find((t) => t.id === "tk_A02");
    if (a3) E.printKitchen(a3, a3.items.filter((i) => i.menuId === "m_squid"));
    Store.state = prevState || state;
  };

  window.Engine = E;
})();
