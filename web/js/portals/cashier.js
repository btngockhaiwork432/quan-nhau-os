/* =========================================================================
   Giao dien 5 - POS THU NGAN VA QUAN LY CA (Desktop Split-Screen 60/40)
   Route: #/cashier
   - Cot trai (60%): So do ban / Dat ban truoc / Hoa don da thu / Nhan su ca
   - Cot phai (40%): Chi tiet bill cua ban dang chon + cum nut thao tac theo thu tu:
     In tam tinh (F2) -> THANH TOAN (F9) -> Tach bill (F4) / Chuyen ban (F6)
   - Tu dong khoa bill sau khi in tam tinh; mo khoa phai xin Chu quan duyet
   ========================================================================= */
(function () {
  const I = U.icon, esc = U.esc;
  const P = "cashier";
  const DENOMS = [500000, 200000, 100000, 50000, 20000, 10000, 5000, 2000, 1000];

  const S = () =>
    App.state(P, {
      leftTab: "floor", // floor | bookings | paid | staff
      area: "all",
      filter: "all", // all | occupied | locked | weigh | free | cleaning
      q: "",
      tableId: "",
      mobilePane: "floor", // floor | bill (cho man hinh nho / dien thoai)
      openGuests: 4,
      openWaiter: "",
      // Modal states
      addCat: "all",
      addQ: "",
      addSeaMenuId: "",
      addFishIds: [],
      addSeaKg: 0.5,
      addStyleId: "",
      addNote: "",
      payMethod: "cash", // cash | qr | split_pay | even
      cashGiven: 0,
      qrReceived: 0,
      splitCash: 0,
      evenPeople: 4,
      drawerTab: "petty", // petty | tip | advance
      pettyAmt: 50000,
      pettyReason: "",
      pettyCat: "Mua đá viên, gas, than",
      tipAmt: 0,
      tipStaff: "",
      zStep: 1,
      zDenoms: {},
      zNote: "",
      openFloat: 2000000,
      splitSel: {},
      transferTarget: "",
      discType: "pct",
      discVal: 5,
      discReason: "Khách quen / sinh nhật",
      bkName: "",
      bkPhone: "",
      bkGuests: 6,
      bkTime: "19:00",
      bkArea: "a_yard",
      bkTable: "",
      bkDeposit: 300000,
      bkNote: "",
    });

  const cfg = () => Store.config;
  const D = () => Store.data;

  function ensureSelectedTable() {
    const st = S();
    const tables = cfg().tables;
    if (st.tableId && tables.some((t) => t.id === st.tableId)) return st.tableId;
    const locked = Engine.openTickets().find((t) => t.status === "locked");
    const open = Engine.openTickets()[0];
    st.tableId = (locked && locked.tableId) || (open && open.tableId) || (tables[0] && tables[0].id) || "";
    return st.tableId;
  }

  /* =====================================================================
     THANH KPI CA HIEN TAI
     ===================================================================== */
  function kpiBar() {
    const w = (cfg().widgets && cfg().widgets.cashier) || { cash: true, qr: true, locked: true, staff: true };
    const sh = Engine.currentShift();
    const ss = sh ? Engine.shiftStats(sh) : { opening: 0, cash: 0, qr: 0, expected: 0, petty: 0, tipsPaid: 0, advancesPaid: 0, bills: 0 };
    const openTks = Engine.openTickets();
    const lockedN = openTks.filter((t) => t.status === "locked").length;
    const kitN = Engine.kitchenQueue().length;
    const fishCnt = U.sum(Engine.activeMenu((m) => m.kind === "seafood" && Engine.isCountableSeafood(m)), (m) => Engine.tankFishList(m.id).length);
    const dutyN = Engine.onDuty().length;
    const bks = D().bookings.filter((b) => b.dayKey === U.dayKey() && (b.status === "confirmed" || b.status === "holding" || b.status === "pending_deposit")).length;
    const cashierPend = Engine.pendingApprovalsByTier ? Engine.pendingApprovalsByTier("cashier") : [];
    const ownerPend = Engine.pendingApprovalsByTier ? Engine.pendingApprovalsByTier("owner") : [];

    const items = [];
    if (w.cash !== false) {
      items.push(
        '<button type="button" class="pos-kpi" data-act="cashier.drawer" title="Bấm để quản lý thu chi két tiền">' +
          '<span class="pk-label">Tiền mặt phải có trong két</span>' +
          '<span class="pk-value num">' + U.money(ss.expected) + ' <small class="muted">(' + (sh ? "đầu ca " + U.moneyShort(ss.opening) : "đã đóng ca") + ")</small></span></button>"
      );
    }
    if (w.qr !== false) {
      items.push(
        '<div class="pos-kpi"><span class="pk-label">Chuyển khoản VietQR trong ca</span><span class="pk-value num text-primary">' +
          U.money(ss.qr) + ' <small class="muted">(' + ss.bills + " bill)</small></span></div>"
      );
    }
    items.push(
      '<button type="button" class="pos-kpi" data-act="cashier.leftTab" data-value="approvals" title="Xử lý nhanh các yêu cầu trong hạn mức Quản lý ca">' +
        '<span class="pk-label">Duyệt nhanh (Quản lý ca)</span>' +
        '<span class="pk-value num ' + (cashierPend.length ? "text-warning" : "text-success") + '">' +
        cashierPend.length + " việc cần duyệt · <small class=\"muted\">" + ownerPend.length + " trình Chủ quán</small></span></button>"
    );
    if (w.locked !== false) {
      items.push(
        '<button type="button" class="pos-kpi" data-act="cashier.filter" data-value="locked">' +
          '<span class="pk-label">Bill đã in tạm tính (khóa)</span>' +
          '<span class="pk-value num ' + (lockedN ? "text-danger" : "") + '">' + lockedN + " bàn · " + openTks.length + " bàn đang mở</span></button>"
      );
    }
    items.push(
      '<button type="button" class="pos-kpi" data-act="cashier.stockModal" title="Xem chi tiết từng con cá trong bể và số đĩa món làm được">' +
        '<span class="pk-label">Đặt bàn / Bể cá & Kho món</span>' +
        '<span class="pk-value num">' + bks + " đặt bàn · " + fishCnt + " cá bể · " + kitN + " món đang nấu</span></button>"
    );
    if (w.staff !== false) {
      items.push(
        '<button type="button" class="pos-kpi" data-act="cashier.leftTab" data-value="staff">' +
          '<span class="pk-label">Nhân sự trong ca</span>' +
          '<span class="pk-value num">' + dutyN + " người đang làm</span></button>"
      );
    }
    return '<div class="pos-kpis">' + items.join("") + '<span class="grow"></span>' +
      '<div class="kbd-hints px-12"><kbd>F2</kbd>In tạm tính <kbd>F9</kbd>Thanh toán <kbd>F4</kbd>Tách bill <kbd>F6</kbd>Chuyển bàn <kbd>F3</kbd>Tìm bàn</div></div>';
  }

  /* =====================================================================
     COT TRAI (60%): SO DO BAN, DUYET NHANH QUAN LY CA, DAT BAN, BILL DA THU, NHAN SU
     ===================================================================== */
  function leftColumn() {
    const st = S();
    const openTks = Engine.openTickets();
    const bks = D().bookings.filter((b) => b.dayKey === U.dayKey() && b.status !== "cancelled");
    const paidTks = D().sales.filter((s) => s.dayKey === U.dayKey()).slice().sort((a, b) => b.closedAt - a.closedAt);
    const cashierPend = Engine.pendingApprovalsByTier ? Engine.pendingApprovalsByTier("cashier") : [];
    const ownerPend = Engine.pendingApprovalsByTier ? Engine.pendingApprovalsByTier("owner") : [];

    const nav = UI.seg([
      { value: "floor", label: "Sơ đồ bàn (" + openTks.length + "/" + cfg().tables.length + ")" },
      { value: "approvals", label: "Duyệt nhanh (" + cashierPend.length + ")" },
      { value: "bookings", label: "Đặt bàn (" + bks.length + ")" },
      { value: "paid", label: "Bill đã thu (" + paidTks.length + ")" },
      { value: "staff", label: "Nhân sự & Két" },
    ], st.leftTab, "cashier.leftTab");

    let headExtra = "";
    let body = "";

    if (st.leftTab === "floor") {
      const areaChips = [{ value: "all", label: "Tất cả khu", count: cfg().tables.length }].concat(
        cfg().areas.map((a) => ({
          value: a.id,
          label: a.name,
          count: cfg().tables.filter((t) => t.areaId === a.id).length,
        }))
      );
      const statusChips = [
        { value: "all", label: "Mọi trạng thái" },
        { value: "occupied", label: "Đang có khách (" + openTks.length + ")" },
        { value: "locked", label: "Đã in tạm tính (" + openTks.filter((t) => t.status === "locked").length + ")" },
        { value: "free", label: "Bàn trống" },
        { value: "cleaning", label: "Cần dọn" },
      ];
      headExtra = '<div class="row between gap-8 wrap">' +
        UI.chips(areaChips, st.area, "cashier.area") +
        '<div style="min-width:210px">' + UI.search({ id: "pos-table-q", model: "cashier.q", value: st.q, placeholder: "Tìm mã bàn, tên khách (F3)..." }) + "</div></div>" +
        UI.chips(statusChips, st.filter, "cashier.filter");

      const filterFn = (tb, stt) => {
        stt = stt || Engine.tableStatus(tb);
        if (st.q && st.q.trim()) {
          const tk = Engine.ticketByTable(tb.id);
          const bk = Engine.bookingForTable(tb.id);
          const hay = tb.code + " " + (tk ? tk.note || "" : "") + " " + (bk ? bk.name + " " + bk.phone : "");
          if (!U.match(hay, st.q)) return false;
        }
        if (st.filter === "occupied") return stt.status === "active" || stt.status === "locked" || stt.status === "weigh";
        if (st.filter === "locked") return stt.status === "locked";
        if (st.filter === "weigh") return stt.status === "weigh";
        if (st.filter === "free") return stt.status === "empty" || stt.status === "booked";
        if (st.filter === "cleaning") return stt.status === "dirty";
        return true;
      };

      // Dai theo doi phong VIP dang mo
      const vipOpen = openTks.filter((t) => {
        const tb = Engine.table(t.tableId);
        return tb && tb.type === "vip";
      });
      const vipStrip = vipOpen.length
        ? '<div class="pos-vip-strip">' + vipOpen.map((tk) => {
            const tb = Engine.table(tk.tableId);
            const tot = Engine.totals(tk);
            const waived = tot.vip && tot.vip.waived;
            const hrs = tot.vip ? tot.vip.hours : 1;
            return '<button type="button" class="pos-vip-card' + (st.tableId === tb.id ? " active" : "") + '" data-act="cashier.pickTable" data-table="' + tb.id + '">' +
              '<div class="row between"><b class="text-violet">' + I("crown", "ic-sm") + " " + esc(tb.code) + '</b><span class="small num">' + UI.since(tk.openedAt) + "</span></div>" +
              '<div class="small muted">' + (waived ? "Đã miễn phụ thu VIP (đạt mức chi)" : "Phụ thu VIP: " + U.money(tot.vipFee) + " (" + hrs + "h)") + "</div></button>";
          }).join("") + "</div>"
        : "";

      body = vipStrip + UI.floor({ areaId: st.area, selected: ensureSelectedTable(), act: "cashier.pickTable", mode: "grid", filter: filterFn });
    } else if (st.leftTab === "approvals") {
      const pCash = (cfg().permissions && cfg().permissions.cashier) || {};
      headExtra =
        '<div class="row between wrap gap-8">' +
        '<div><b>Phân quyền Duyệt nhanh — Thu ngân kiêm Quản lý ca</b><div class="small muted">Các nghiệp vụ thường ngày xử lý ngay tại quầy; chỉ vấn đề lớn hoặc vượt hạn mức mới trình Chủ quán.</div></div>' +
        UI.badge("Tự quyết " + cashierPend.length + " việc · Trình Chủ quán " + ownerPend.length + " việc", cashierPend.length ? "warning" : "success", true) +
        "</div>";

      const renderReqCard = (a, isCashierTier) => {
        const meta = Engine.APPROVAL_TYPES[a.type] || { label: a.type, icon: "circle-alert" };
        const tierMeta = Engine.approvalTierMeta ? Engine.approvalTierMeta(a) : { badgeLabel: "", badgeTone: "info", desc: "" };
        const canMe = Engine.canApprove(App.me().id, a);
        return (
          '<div class="card"><div class="card-body row between wrap gap-12">' +
          '<div class="row gap-10" style="align-items:flex-start;flex:1;min-width:240px">' +
          '<span class="nav-ic" style="background:var(--' + (isCashierTier ? "primary" : "danger") + '-soft);color:var(--' + (isCashierTier ? "primary" : "danger") + ')">' + I(meta.icon) + "</span>" +
          '<div class="col gap-4">' +
          '<div class="row gap-8 wrap"><b>' + esc(a.title) + "</b>" + UI.badge(meta.label, isCashierTier ? "info" : "warning") + UI.badge(tierMeta.badgeLabel, tierMeta.badgeTone) + "</div>" +
          '<div class="small muted">Người gửi: <b>' + esc(Engine.staffName(a.by)) + "</b> · " + UI.since(a.at) + " trước" + (a.amount ? " · Giá trị: <b class=\"num text-primary\">" + U.money(a.amount) + "</b>" : "") + "</div>" +
          '<div class="small">Lý do: ' + esc(a.reason || "Không ghi lý do") + "</div>" +
          '<div class="small muted">' + esc(tierMeta.desc) + "</div>" +
          "</div></div>" +
          '<div class="row gap-8">' +
          (canMe
            ? UI.btn("Từ chối", { size: "sm", kind: "danger", icon: "x", act: "cashier.rejectReq", data: { id: a.id } }) +
              UI.btn("Duyệt ngay", { size: "sm", kind: "primary", icon: "check", act: "cashier.approveReq", data: { id: a.id } })
            : UI.badge("Chờ Chủ quán quyết định", "danger", true)) +
          "</div></div></div>"
        );
      };

      const resolvedRecent = D()
        .approvals.filter((a) => a.status !== "pending")
        .slice(0, 6);

      body =
        '<div class="col gap-14">' +
        '<div class="card" style="background:var(--surface-2)"><div class="card-body">' +
        '<div class="small strong mb-6">Hạn mức Thu ngân kiêm Quản lý xử lý trực tiếp tại quầy (không cần chờ Chủ quán):</div>' +
        '<div class="chips">' +
        '<span class="chip active">Giảm giá bill &le; ' + (Number(pCash.discountMaxPct) || 10) + "%</span>" +
        '<span class="chip active">Chốt giá cá nguyên con &le; ' + (Number(pCash.cashierBargainPct) || 15) + "%</span>" +
        '<span class="chip active">Hủy món sau in bếp &le; ' + U.money(Number(pCash.approveVoidUnder) || 200000) + "</span>" +
        '<span class="chip active">Mở khóa bill tạm tính: Lần 1 (' + (Number(pCash.maxSelfUnlockCount) || 1) + " lần/bill)</span>" +
        '<span class="chip active">Duyệt hao hụt &le; ' + U.money(Number(pCash.approveWasteUnder) || 300000) + "</span>" +
        '<span class="chip active">Duyệt tăng ca &le; ' + (Number(pCash.approveOvertimeUnderMin) || 60) + " phút</span>" +
        '<span class="chip active">Duyệt ứng lương &le; ' + U.money(Number(pCash.approveAdvanceUnder) || 500000) + "</span>" +
        "</div></div></div>" +
        '<div><div class="row between mb-8"><b>Việc thường ngày — Thu ngân kiêm Quản lý duyệt ngay (' + cashierPend.length + ')</b><span class="small muted">Bấm Duyệt ngay để giải phóng bàn/bếp tức thì</span></div>' +
        (cashierPend.length
          ? '<div class="col gap-10">' + cashierPend.map((a) => renderReqCard(a, true)).join("") + "</div>"
          : UI.empty("circle-check", "Không có yêu cầu thường ngày nào đang tồn", "Mọi yêu cầu trong hạn mức Quản lý ca đã được giải quyết gọn.")) +
        "</div>" +
        '<div><div class="row between mb-8"><b>Vấn đề lớn — Đã chuyển Chủ quán phê duyệt (' + ownerPend.length + ')</b><span class="small muted">Lệch kho cuối ca, giảm giá/ép giá sâu, hủy món đắt tiền, ứng lương lớn, mở khóa bill lần 2+</span></div>' +
        (ownerPend.length
          ? '<div class="col gap-10">' + ownerPend.map((a) => renderReqCard(a, false)).join("") + "</div>"
          : '<div class="small muted">Không có vấn đề lớn nào đang chờ Chủ quán.</div>') +
        "</div>" +
        (resolvedRecent.length
          ? '<div class="card"><div class="card-head"><div><h3>Nhật ký duyệt & xử lý gần đây (' + resolvedRecent.length + ')</h3></div></div><div class="table-wrap"><table class="dt"><thead><tr><th>Thời gian</th><th>Nội dung</th><th>Giá trị</th><th>Người xử lý</th><th>Kết quả</th></tr></thead><tbody>' +
            resolvedRecent
              .map(
                (a) =>
                  "<tr><td>" +
                  U.time(a.resolvedAt || a.at) +
                  "</td><td><b>" +
                  esc(a.title) +
                  '</b><div class="small muted">' +
                  esc(a.resolveNote || a.reason || "") +
                  '</div></td><td class="num">' +
                  (a.amount ? U.money(a.amount) : "-") +
                  "</td><td>" +
                  esc(Engine.staffName(a.resolvedBy || a.by)) +
                  "</td><td>" +
                  UI.badge(a.status === "approved" ? "Đã duyệt" : "Từ chối", a.status === "approved" ? "success" : "danger") +
                  "</td></tr>"
              )
              .join("") +
            "</tbody></table></div></div>"
          : "") +
        "</div>";
    } else if (st.leftTab === "bookings") {
      headExtra = '<div class="row between"><div><b>Danh sách đặt bàn trước</b><span class="small muted ml-8">Tự động cảnh báo khách trễ quá ' + cfg().booking.noShowMinutes + " phút</span></div>" +
        UI.btn("Nhận đặt bàn mới", { size: "sm", kind: "primary", icon: "plus", act: "cashier.bookingNew" }) + "</div>";
      const list = D().bookings.slice().sort((a, b) => b.createdAt - a.createdAt);
      const ST_BADGE = {
        holding: ["Chờ chuyển cọc", "warning"],
        pending_deposit: ["Chờ chuyển cọc", "warning"],
        confirmed: ["Đã nhận cọc", "info"],
        seated: ["Đã nhận bàn", "success"],
        completed: ["Đã hoàn tất", "success"],
        noshow: ["Khách không đến", "danger"],
        expired: ["Hết hạn giữ chỗ", ""],
        cancelled: ["Đã hủy", ""],
      };
      body = list.length
        ? '<div class="col gap-10">' + list.map((b) => {
            const tb = b.tableId ? Engine.table(b.tableId) : null;
            const area = cfg().areas.find((a) => a.id === b.areaId);
            const sb = ST_BADGE[b.status] || [b.status, ""];
            let acts = "";
            if (b.status === "holding" || b.status === "pending_deposit") {
              acts = UI.btn("Xác nhận đã nhận cọc", { size: "sm", kind: "primary", icon: "check", act: "cashier.bkConfirm", data: { id: b.id } }) +
                UI.btn("Hủy", { size: "sm", kind: "danger", act: "cashier.bkCancel", data: { id: b.id } });
            } else if (b.status === "confirmed") {
              acts = UI.btn("Xếp bàn & Mở bill", { size: "sm", kind: "primary", icon: "log-in", act: "cashier.bkSeat", data: { id: b.id } }) +
                UI.btn("Báo không đến", { size: "sm", kind: "danger", act: "cashier.bkNoShow", data: { id: b.id } });
            } else if (b.status === "seated" && b.tableId) {
              acts = UI.btn("Xem bàn " + (tb ? tb.code : ""), { size: "sm", icon: "eye", act: "cashier.pickTable", data: { table: b.tableId } });
            }
            return '<div class="card pos-bk-card"><div class="card-body row between wrap gap-12">' +
              '<div><div class="row gap-8"><b>' + esc(b.name) + '</b><span class="num muted">' + esc(b.phone) + "</span>" + UI.badge(sb[0], sb[1], true) + "</div>" +
              '<div class="small muted mt-4">Mã: <b>' + esc(b.code || b.id) + "</b> · Giờ hẹn: <b>" + esc(b.time) + "</b> (" + U.dayLabel(b.dayKey) + ") · " + b.guests + " khách · " + esc(area ? area.name : "") + (tb ? " · Bàn <b>" + esc(tb.code) + "</b>" : "") + "</div>" +
              (b.deposit ? '<div class="small mt-4">Tiền cọc: <b class="num text-primary">' + U.money(b.deposit) + "</b> (" + (b.depositPaid ? "Đã thanh toán" : "Chưa thanh toán") + ")</div>" : "") +
              (b.note ? '<div class="small muted mt-4">Ghi chú: ' + esc(b.note) + "</div>" : "") +
              '</div><div class="row gap-8">' + acts + "</div></div></div>";
          }).join("") + "</div>"
        : UI.empty("calendar", "Chưa có lịch đặt bàn", "Bấm Nhận đặt bàn mới hoặc khách đặt trực tiếp trên trang Khách hàng.");
    } else if (st.leftTab === "paid") {
      headExtra = '<div class="row between"><b>Hóa đơn đã thanh toán trong ca (' + paidTks.length + ')</b><span class="small muted">Hỗ trợ tự động khớp mã QR định danh, tách Tip tự động và phát hành HĐ VAT</span></div>';
      body = paidTks.length
        ? '<div class="table-wrap card"><table class="dt"><thead><tr><th>Giờ đóng</th><th>Bàn / Mã QR</th><th>Phục vụ</th><th>Phương thức</th><th class="num">Tổng thu</th><th class="num">Tiền Tip</th><th>HĐ điện tử</th><th></th></tr></thead><tbody>' +
          paidTks.map((t) => {
            const tb = Engine.table(t.tableId);
            const pm = t.paymentSource === "webhook_qr" ? UI.badge("Auto Webhook QR", "success") : t.payments && t.payments.length > 1 ? "Kết hợp" : (t.payments && t.payments[0] && t.payments[0].method === "qr" ? "VietQR" : "Tiền mặt");
            const einv = t.einvoice || D().einvoices.find((e) => e.saleId === t.id);
            const tipDetail = t.tip > 0
              ? '<b class="text-success num">+' + U.money(t.tip) + '</b><div class="small muted">' + esc(Engine.TIP_MODES[t.tipMode] || "Cá nhân") + "</div>"
              : '<span class="muted">0 đ</span>';
            return "<tr><td>" + U.time(t.closedAt) + "</td><td><b>" + esc(tb ? tb.code : t.tableCode || t.tableId) + "</b>" + (t.payCode ? '<div class="small muted">' + esc(t.payCode) + "</div>" : "") + "</td><td>" + esc(Engine.staffName(t.waiterId)) + "</td><td>" + pm + '</td><td class="num strong">' + U.money(t.received || t.grand) + '</td><td class="num">' + tipDetail + "</td><td>" +
              (einv ? UI.badge("Đã xuất " + (einv.invoiceNo || einv.no), "success") : UI.btn("Xuất HĐ VAT", { size: "sm", icon: "receipt-text", act: "cashier.issueVat", data: { id: t.id } })) +
              '</td><td class="right">' + UI.btn("In lại bill", { size: "sm", icon: "printer", act: "cashier.reprintBill", data: { id: t.id } }) + "</td></tr>";
          }).join("") + "</tbody></table></div>"
        : UI.empty("receipt", "Chưa có hóa đơn đã thu trong hôm nay");
    } else {
      const duty = Engine.onDuty();
      const waitersAll = D().staff.filter((s) => s.role === "waiter" && s.active);
      const advApproved = D().advances.filter((a) => a.status === "approved");
      const whLogs = (D().webhookLogs || []).slice(0, 8);
      headExtra = '<div class="row between wrap gap-8"><b>Nhân sự trong ca, Phân công quản bàn & Két tiền mặt</b>' +
        '<div class="row gap-8">' +
        UI.btn("Mở két thu chi tiền mặt", { size: "sm", kind: "primary", icon: "wallet", act: "cashier.drawer" }) +
        "</div></div>";
      body = '<div class="col gap-16">' +
        (advApproved.length
          ? '<div class="card"><div class="card-head"><div><h3>Phiếu ứng lương đã duyệt - Chờ chi tiền (' + advApproved.length + ')</h3></div></div><div class="card-body col gap-8">' +
            advApproved.map((a) => '<div class="row between py-4 border-b"><div><b>' + esc(Engine.staffName(a.staffId)) + '</b> · <span class="num strong text-primary">' + U.money(a.amount) + '</span><div class="small muted">Lý do: ' + esc(a.reason || "") + "</div></div>" +
              UI.btn("Chi tiền mặt từ két", { size: "sm", kind: "primary", icon: "banknote", act: "cashier.payAdvanceNow", data: { id: a.id } }) + "</div>").join("") + "</div></div>"
          : "") +
        '<div class="card"><div class="card-head"><div class="row between wrap gap-8" style="width:100%"><div><h3>Phân công Nhân viên Quản bàn & Khu vực (' + waitersAll.length + ' phục vụ)</h3><div class="sub">Thu ngân kiêm Quản lý phân bàn cố định cho từng nhân viên hoặc điều chuyển theo ca</div></div>' +
        UI.badge((cfg().floor && cfg().floor.assignmentMode) === "free" ? "Chế độ: Nhận bàn tự do" : "Chế độ: Phân công bàn theo nhân viên", "info", true) +
        '</div></div><div class="table-wrap"><table class="dt"><thead><tr><th>Phục vụ</th><th>Khu vực phụ trách</th><th>Các bàn được giao quản lý</th><th class="num">Tip ca hôm nay</th><th class="right">Điều phối</th></tr></thead><tbody>' +
        waitersAll.map((w) => {
          const areaNames = (w.assignedAreas || []).map((aid) => (Engine.area(aid) || {}).name).filter(Boolean).join(", ") || "Chưa gán khu";
          const tableCodes = (w.assignedTables || []).map((tid) => (Engine.table(tid) || {}).code).filter(Boolean).join(", ") || "Tất cả bàn";
          const todayTip = Engine.tipEarnedByStaff(w.id, D().sales.filter((s) => s.dayKey === U.dayKey()));
          return "<tr><td><b>" + esc(w.name) + "</b></td><td>" + esc(areaNames) + "</td><td><b>" + esc(tableCodes) + '</b></td><td class="num text-success strong">' + U.money(todayTip) + '</td><td class="right">' +
            UI.btn("Phân bàn", { size: "sm", icon: "layout-grid", act: "cashier.editStaffAssignModal", data: { staff: w.id } }) +
            "</td></tr>";
        }).join("") +
        "</tbody></table></div></div>" +
        (whLogs.length
          ? '<div class="card"><div class="card-head"><div><h3>Nhật ký Biến động số dư Cổng thanh toán VietQR (' + whLogs.length + ')</h3><div class="sub">Tự động đối soát mã định danh QR, cộng dồn chuyển khoản nhiều lần và tách tiền Tip không cần kiểm tra thủ công</div></div></div><div class="table-wrap"><table class="dt"><thead><tr><th>Thời gian</th><th>Mã nội dung CK</th><th>Bàn</th><th class="num">Cần thu</th><th class="num">Thực nhận</th><th class="num">Tiền Tip</th><th>Trạng thái / Xử lý</th></tr></thead><tbody>' +
            whLogs.map((w) => {
              let badge;
              if (w.status === "matched_paid") {
                badge = UI.badge("Đã khớp & Chốt bill", "success");
              } else if (w.status === "partial_paid") {
                badge = UI.badge(w.reason || "Đã thu 1 phần", "warning");
              } else if (w.status === "resolved_as_tip") {
                badge = UI.badge(w.reason || "Đã cộng vào Tip", "success");
              } else if (w.status === "resolved_refunded") {
                badge = UI.badge(w.reason || "Đã hoàn tiền", "info");
              } else if (w.status === "overpaid_closed_bill") {
                badge =
                  '<div class="col gap-4">' +
                  UI.badge("Chuyển trùng sau khi đóng bill", "danger") +
                  '<div class="row gap-4">' +
                  UI.btn("Cộng vào Tip", { size: "sm", kind: "primary", act: "cashier.resolveOverpaid", data: { id: w.id, mode: "tip" } }) +
                  UI.btn("Đã hoàn tiền", { size: "sm", act: "cashier.resolveOverpaid", data: { id: w.id, mode: "refund" } }) +
                  "</div></div>";
              } else {
                badge = UI.badge(w.reason || w.status, "danger");
              }
              return "<tr><td>" + U.time(w.at) + "</td><td><code>" + esc(w.content || w.payCode || "") + "</code></td><td><b>" + esc(w.tableCode || "-") + '</b></td><td class="num">' + U.money(w.need || 0) + '</td><td class="num strong text-primary">' + U.money(w.amount || 0) + '</td><td class="num text-success">' + (w.tip > 0 ? "+" + U.money(w.tip) + " (" + esc(Engine.TIP_MODES[w.tipMode] || w.tipMode) + ")" : "0 đ") + "</td><td>" + badge + "</td></tr>";
            }).join("") +
            "</tbody></table></div></div>"
          : "") +
        '<div class="card"><div class="card-head"><div><h3>Nhân viên đang trực trong ca (' + duty.length + ')</h3></div></div><div class="table-wrap"><table class="dt"><thead><tr><th>Nhân viên</th><th>Vai trò</th><th>Giờ vào ca</th><th>Trạng thái</th></tr></thead><tbody>' +
        duty.map((s) => {
          const att = Engine.activeAtt(s.id);
          return "<tr><td><b>" + esc(s.name) + "</b></td><td>" + esc(Engine.roleLabel(s.role)) + "</td><td>" + (att ? U.time(att.in) : "-") + "</td><td>" + UI.badge("Đang làm việc", "success") + "</td></tr>";
        }).join("") + "</tbody></table></div></div></div>";
    }

    return '<section class="pos-left">' +
      '<div class="pos-left-head">' + nav + headExtra + "</div>" +
      '<div class="pos-left-body" data-keep-scroll="pos-left">' + body + "</div></section>";
  }

  /* =====================================================================
     COT PHAI (40%): CHI TIET BAN & BILL THANH TOAN
     ===================================================================== */
  function rightColumn() {
    const st = S();
    const tid = ensureSelectedTable();
    const tb = Engine.table(tid);
    if (!tb) {
      return '<aside class="pos-right"><div class="pos-empty-pane">' + UI.empty("layout-grid", "Chọn một bàn ở sơ đồ bên trái", "Mọi thao tác mở bàn, gọi món, in tạm tính và thanh toán thực hiện tại đây.") + "</div></aside>";
    }
    const tk = Engine.ticketByTable(tb.id);
    if (!tk) return emptyTablePanel(tb, st);
    return activeTicketPanel(tb, tk);
  }

  function emptyTablePanel(tb, st) {
    const stt = Engine.tableStatus(tb);
    const area = cfg().areas.find((a) => a.id === tb.areaId);
    const bk = Engine.bookingForTable(tb.id);
    const waiters = D().staff.filter((s) => s.active && (s.role === "waiter" || s.role === "cashier"));
    const defWaiterId = Engine.defaultWaiterForTable ? Engine.defaultWaiterForTable(tb.id) : (waiters[0] && waiters[0].id);
    const defWaiter = defWaiterId ? Engine.staff(defWaiterId) : waiters[0];
    if (!st.openWaiter || st._lastOpenTableId !== tb.id) {
      st.openWaiter = (defWaiter && defWaiter.id) || (waiters[0] && waiters[0].id);
      st._lastOpenTableId = tb.id;
    }

    return '<aside class="pos-right">' +
      '<div class="pos-bill-head"><div class="row between"><div><div class="row gap-8"><h2 class="pos-tb-title">Bàn ' + esc(tb.code) + "</h2>" +
      (tb.type === "vip" ? UI.badge("Phòng VIP", "violet", true) : UI.badge("Bàn thường", "")) +
      UI.badge(stt.label, stt.tone || "", true) + "</div>" +
      '<div class="small muted mt-4">' + esc(area ? area.name : "") + " · Sức chứa " + tb.seats + " chỗ ngồi" + (defWaiter ? " · Phụ trách: <b>" + esc(defWaiter.name) + "</b>" : "") +
      (tb.type === "vip" ? " · Phụ thu " + U.money(cfg().vip.hourlyRate) + "/giờ (miễn khi đạt " + U.money(cfg().vip.minimumSpend) + ")" : "") + "</div></div></div></div>" +
      '<div class="pos-bill-lines pos-open-form">' +
      (stt.status === "dirty"
        ? UI.banner("warning", "sparkles", "<b>Bàn vừa thanh toán xong và đang chờ dọn.</b> Bấm xác nhận dọn bàn bên dưới để đón lượt khách mới.") +
          UI.btn("Đã dọn bàn xong - Chuyển về Bàn trống", { kind: "primary", block: true, size: "lg", icon: "check", act: "cashier.finishClean", data: { table: tb.id } })
        : "") +
      (bk
        ? '<div class="card pos-bk-alert"><div class="card-body col gap-8">' +
          '<div class="row between"><b>' + I("calendar", "ic-sm") + " Đã có khách đặt trước: " + esc(bk.name) + '</b><span class="badge badge-info">Hẹn ' + esc(bk.time) + "</span></div>" +
          '<div class="small muted">SĐT: ' + esc(bk.phone) + " · " + bk.guests + " khách · Tiền cọc: <b>" + U.money(bk.deposit || 0) + "</b></div>" +
          UI.btn("Nhận khách đặt bàn vào " + tb.code, { kind: "primary", block: true, icon: "log-in", act: "cashier.bkSeat", data: { id: bk.id, table: tb.id } }) +
          "</div></div>"
        : "") +
      '<div class="card"><div class="card-head"><div><h3>Mở bàn đón khách mới</h3><div class="sub">Khởi tạo hóa đơn mới cho bàn ' + esc(tb.code) + '</div></div></div>' +
      '<div class="card-body col gap-12">' +
      '<div class="row between"><span>Số lượng khách</span>' +
      '<div class="stepper"><button type="button" data-act="cashier.guestStep" data-d="-1">-</button><span>' + (st.openGuests || tb.seats || 4) + '</span><button type="button" data-act="cashier.guestStep" data-d="1">+</button></div></div>' +
      UI.field("Phục vụ phụ trách bàn", UI.select({ model: "cashier.openWaiter", value: st.openWaiter, options: waiters.map((w) => ({ value: w.id, label: w.name + " (" + Engine.roleLabel(w.role) + ")" })) })) +
      UI.btn("Mở bàn " + tb.code + " & Gọi món ngay", { kind: "primary", size: "lg", block: true, icon: "plus", act: "cashier.openTable", data: { table: tb.id } }) +
      "</div></div></div></aside>";
  }

  function activeTicketPanel(tb, tk) {
    const tot = Engine.totals(tk);
    const area = cfg().areas.find((a) => a.id === tb.areaId);
    const locked = tk.status === "locked";
    const graceSec = Number(cfg().locks.prebillGraceSec) || 0;
    const lockTs = tk.prebillAt || tk.lockedAt;
    const inGrace = locked && lockTs && Date.now() - lockTs <= graceSec * 1000;
    const pendUnlock = D().approvals.find((a) => a.type === "unlock_bill" && a.ref === tk.id && a.status === "pending");
    const pCash = (cfg().permissions && cfg().permissions.cashier) || {};
    const maxUnlock = Number(pCash.maxSelfUnlockCount) || 1;
    const nextAttempt = (tk.unlockCount || 0) + 1;
    const canSelfUnlock = App.role() === "owner" || (App.role() === "cashier" && pCash.reopenBill !== false && nextAttempt <= maxUnlock);

    const postAdjs = Array.isArray(tk.postPrebillAdjustments) ? tk.postPrebillAdjustments : [];
    const head = '<div class="pos-bill-head">' +
      '<div class="row between"><div class="row gap-8 wrap"><h2 class="pos-tb-title">Bàn ' + esc(tb.code) + "</h2>" +
      '<span class="small muted">' + esc(area ? area.name : "") + "</span>" +
      UI.badge("PV: " + Engine.staffName(tk.waiterId), "info") +
      UI.badge("QR: " + Engine.ensurePayCode(tk), "neutral") +
      (tb.type === "vip" ? UI.badge("VIP · " + UI.since(tk.openedAt), "violet", true) : "") +
      (locked
        ? UI.badge("Đã in tạm tính · Khóa", "danger", true)
        : tk.prebillOutdated
        ? UI.badge("Phiếu tạm tính cũ hết hiệu lực · Cần in lại", "danger", true)
        : tot.pendingWeigh
        ? UI.badge("Chờ cân " + tot.pendingWeigh + " món", "warning", true)
        : UI.badge("Đang phục vụ", "primary", true)) +
      (tk.unlockCount ? UI.badge("Đã mở khóa " + tk.unlockCount + " lần", "warning") : "") +
      (postAdjs.length ? UI.badge("Sửa sau tạm tính " + postAdjs.length + " lần", "danger") : "") +
      '</div><div class="small muted num">Mở lúc ' + U.time(tk.openedAt) + " · " + tk.guests + " khách</div></div>" +
      '<div class="pos-bill-tools mt-8">' +
      UI.btn("Gọi thêm món", { size: "sm", kind: "primary", icon: "plus", act: "cashier.addDishModal", disabled: locked && !inGrace }) +
      (tk.items.some((i) => !i.isFree && i.status !== "void" && (Engine.menu(i.menuId) || {}).kind === "beer")
        ? UI.btn("Trả bia dư (lon/chai)", { size: "sm", kind: "warning", icon: "beer", act: "cashier.returnBeerModal" })
        : "") +
      UI.btn("Bể cá & Kho món", { size: "sm", icon: "fish", act: "cashier.stockModal" }) +
      UI.btn(tk.discount ? "Giảm giá (" + (tk.discount.type === "pct" ? tk.discount.value + "%" : U.moneyShort(tk.discount.value)) + ")" : "Giảm giá", { size: "sm", icon: "badge-percent", act: "cashier.discountModal", disabled: locked && !inGrace }) +
      UI.btn("Gửi rượu", { size: "sm", icon: "wine", act: "cashier.bottleModal" }) +
      "</div>" +
      (locked
        ? '<div class="lock-line mt-8">' + I("lock", "ic-sm") +
          '<div class="grow"><b>Bill đã khóa sau khi in tạm tính.</b> ' +
          (inGrace
            ? "Đang trong " + graceSec + " giây ân hạn sửa nhanh."
            : pendUnlock
            ? "Đã gửi yêu cầu mở khóa, đang chờ Chủ quán duyệt."
            : canSelfUnlock
            ? "Thu ngân kiêm Quản lý được mở khóa trực tiếp lần " + nextAttempt + "/" + maxUnlock + " (lưu nhật ký chống gian lận)."
            : "Đã hết lượt tự mở khóa (" + (tk.unlockCount || 0) + "/" + maxUnlock + " lần). Mở khóa thêm phải trình Chủ quán duyệt.") +
          "</div>" +
          (inGrace
            ? UI.btn("Mở khóa ngay", { size: "sm", act: "cashier.unlockGrace", data: { id: tk.id } })
            : pendUnlock
              ? (Engine.canApprove(App.me().id, pendUnlock)
                  ? UI.btn("Duyệt mở ngay", { size: "sm", kind: "primary", act: "cashier.ownerQuickUnlock", data: { apId: pendUnlock.id } })
                  : UI.badge("Chờ Chủ quán duyệt", "warning"))
              : UI.btn(
                  canSelfUnlock ? "Mở khóa sửa bill (Quản lý ca)" : "Xin Chủ quán mở khóa (Lần " + nextAttempt + ")",
                  { size: "sm", kind: canSelfUnlock ? "primary" : "danger", icon: "lock-open", act: "cashier.reqUnlock", data: { id: tk.id } }
                )) +
          "</div>"
        : "") +
      (tk.prebillOutdated
        ? '<div class="lock-line mt-8" style="border-color:var(--danger);background:var(--danger-soft)">' + I("triangle-alert", "ic-sm") +
          '<div class="grow"><b>Phiếu tạm tính cũ đã hết hiệu lực do giảm tiền sau tạm tính.</b><div class="small">' +
          esc(tk.prebillInvalidatedReason || "Đã trả bia dư sau khi in tạm tính.") +
          " · Vui lòng in lại phiếu tạm tính mới để giao cho khách.</div></div>" +
          UI.btn("In lại tạm tính mới", { size: "sm", kind: "primary", icon: "printer", act: "cashier.prebill" }) +
          "</div>"
        : "") +
      (postAdjs.length
        ? '<div class="mt-8" style="padding:6px 10px;border-radius:8px;background:var(--surface-2);border:1px dashed var(--warning);font-size:12px">' +
          '<div class="strong text-warning mb-4">Dấu vết chỉnh sửa sau tạm tính (' + postAdjs.length + ' lần):</div>' +
          postAdjs.slice(0, 3).map((adj) =>
            '<div class="row between wrap gap-4"><span>• ' + U.time(adj.at) + " · <b>" + esc(adj.byName || Engine.staffName(adj.by)) + "</b>: Trả dư " + adj.returned + " " + esc(adj.unit || "lon") + " " + esc(adj.menuName || "") +
            '</span><span class="num strong">' + U.money(adj.beforeGrand) + " &rarr; " + U.money(adj.afterGrand) + " (-" + U.money(adj.deductedAmount) + ")</span></div>"
          ).join("") +
          "</div>"
        : "") +
      "</div>";

    const items = tk.items.filter((i) => i.status !== "void" && i.status !== "voided");
    const linesHtml = items.length
      ? items.map((it) => {
          const m = Engine.menu(it.menuId) || {};
          const isSea = m.kind === "seafood" || it.kind === "seafood";
          const isFree = it.isFree || it.promoFree;
          const isPaidBeer = m.kind === "beer" && !isFree;
          const style = it.styleId ? Engine.style(it.styleId) : null;
          const amt = Engine.itemAmount(it);
          const ppk = it.pricePerKg || m.pricePerKg || 0;
          const fishMeta = it.fishSummary ? it.fishSummary : it.fishCodes && it.fishCodes.length ? "Mã bể: " + it.fishCodes.join(", ") : "";
          const bargainMeta = it.bargain && it.bargain.discount > 0 && it.bargain.status !== "rejected"
            ? "Giá chốt nguyên con: " + U.money(it.dealAmount) + " (giảm " + U.money(it.bargain.discount) + (it.bargain.status === "pending" ? " · chờ duyệt" : "") + ")"
            : "";
          const beerMeta = isPaidBeer ? Engine.itemLabel(it) : "";
          const meta = [
            fishMeta,
            bargainMeta,
            beerMeta,
            style ? style.name + (style.surcharge ? " (+" + U.money(style.surcharge) + ")" : "") : "",
            isSea ? (it.saleMode === "gram" && it.gram ? it.gram + "g · " : it.count ? it.count + " con · " : "") + U.kg(it.kg) + " x " + U.money(ppk) + "/kg" : U.money(it.price || m.price || 0) + "/" + (m.unit || it.unit || "phần"),
            it.promoId ? "KM tặng kèm" : "",
            it.note && !beerMeta.includes(it.note) ? "Ghi chú: " + it.note : "",
          ].filter(Boolean).join(" · ");

          const canStep = (!locked || inGrace) && !isSea && !isFree;
          const canVoid = !locked || inGrace;
          return '<div class="bill-line">' +
            '<div class="bl-main"><div class="bl-name">' + esc(it.name) + " " +
            (isFree ? UI.badge("Tặng 0đ", "success") : it.status === "served" ? UI.badge("Đã ra món", "success") : "") +
            '</div><div class="bl-meta">' + esc(meta) + "</div></div>" +
            '<div class="bl-qty row gap-4">' +
            (isPaidBeer
              ? '<button type="button" class="btn btn-sm" style="border-color:var(--warning);color:var(--warning)" data-act="cashier.returnBeerModal" data-item="' + it.id + '" data-menu="' + it.menuId + '" title="Trả lại bia dư chưa khui">Trả dư</button>'
              : "") +
            (canStep
              ? '<div class="stepper"><button type="button" data-act="cashier.itemStep" data-item="' + it.id + '" data-d="-1">-</button><span>' + it.qty + '</span><button type="button" data-act="cashier.itemStep" data-item="' + it.id + '" data-d="1">+</button></div>'
              : '<span class="num strong">' + (isSea ? U.kg(it.kg) : "x" + it.qty) + "</span>") +
            "</div>" +
            '<div class="bl-amt num">' + U.money(amt) + "</div>" +
            (canVoid ? UI.iconBtn("trash-2", { act: "cashier.voidItem", data: { item: it.id }, title: "Hủy món" }) : "") +
            "</div>";
        }).join("")
      : UI.empty("utensils", "Bàn chưa có món nào", "Bấm Gọi thêm món để thêm món vào bàn.");

    const foot = '<div class="pos-bill-foot">' +
      UI.totals(tk) +
      '<div class="pos-actions">' +
      UI.btn("In tạm tính (F2)", { icon: "printer", act: "cashier.prebill", disabled: !items.length }) +
      UI.btn("Tách bill (F4)", { icon: "split", act: "cashier.splitModal", disabled: items.length < 2 }) +
      UI.btn("Chuyển / Ghép bàn (F6)", { icon: "arrow-left-right", act: "cashier.transferModal" }) +
      UI.btn("Xem mẫu K80", { icon: "receipt", act: "cashier.previewK80" }) +
      UI.btn("THANH TOÁN · " + U.money(tot.due !== undefined ? tot.due : tot.grand) + " (F9)", {
        kind: "primary",
        cls: "span-2 btn-pay",
        icon: "check",
        act: "cashier.payModal",
        disabled: !items.length,
      }) +
      "</div></div>";

    return '<aside class="pos-right">' + head + '<div class="pos-bill-lines" data-keep-scroll="pos-bill">' + linesHtml + "</div>" + foot + "</aside>";
  }

  /* =====================================================================
     CAC HOP THOAI CHUC NANG (THANH TOAN, TACH BILL, CHUYEN BAN, CHOT CA)
     ===================================================================== */
  function openPayModal(tk) {
    const st = S();
    const tb = Engine.table(tk.tableId);
    const tot = Engine.totals(tk);
    const need = Math.max(0, tot.due !== undefined ? tot.due : tot.grand - tot.deposit - (tot.paid || 0));
    const payCode = Engine.ensurePayCode(tk);
    st.payMethod = "cash";
    st.cashGiven = need;
    st.qrReceived = need;
    st.splitCash = Math.round(need / 2 / 1000) * 1000;
    st.evenPeople = Math.max(2, tk.guests || 4);
    st.payTipMode = tk.preferredTipMode || (cfg().payroll && cfg().payroll.tipPolicy) || "personal";

    App.modal({
      title: "Thanh toán bàn " + (tb ? tb.code : tk.tableId) + " · Mã QR: " + payCode,
      sub: tk.guests + " khách · Mở lúc " + U.time(tk.openedAt) + " · Đứng bàn: " + Engine.staffName(tk.waiterId),
      size: "lg",
      body: () => {
        const s = S();
        const curTk = Engine.ticket(tk.id) || tk;
        const curTot = Engine.totals(curTk);
        const grand = Math.max(0, curTot.due !== undefined ? curTot.due : curTot.grand - curTot.deposit - (curTot.paid || 0));
        const pendingAps = Engine.pendingTicketApprovals ? Engine.pendingTicketApprovals(curTk.id) : [];
        const partialBanner = curTot.paid > 0
          ? UI.banner("warning", "coins", "<b>Đã thu 1 phần: " + U.money(curTot.paid) + "</b> (" + (curTk.payments || []).length + " giao dịch) &rarr; <b>Còn phải thu thêm: " + U.money(grand) + "</b>. Mã VietQR đã tự cập nhật đúng số tiền còn thiếu.")
          : "";
        const pendingApBanner = pendingAps.length > 0
          ? UI.banner("danger", "triangle-alert", "<b>Chú ý:</b> Bàn đang có <b>" + pendingAps.length + " yêu cầu chờ duyệt</b> (" + pendingAps.map((a) => esc(a.title)).join("; ") + "). Hãy duyệt hoặc từ chối trước khi chốt bill.")
          : "";
        const tabs = UI.seg([
          { value: "cash", label: "Tiền mặt" },
          { value: "qr", label: "Chuyển khoản VietQR (" + payCode + ")" },
          { value: "split_pay", label: "Kết hợp (TM + QR)" },
          { value: "even", label: "Chia đều đầu người" },
        ], s.payMethod, "cashier.payMethod");

        const quickDenoms = [grand, Math.ceil(grand / 100000) * 100000, Math.ceil(grand / 500000) * 500000, grand + 100000, grand + 500000]
          .filter((v, i, a) => v >= grand && a.indexOf(v) === i)
          .slice(0, 4);

        let pane = "";
        if (s.payMethod === "cash") {
          const change = Math.max(0, (Number(s.cashGiven) || 0) - grand);
          pane = '<div class="col gap-12">' +
            '<div class="row between"><span class="muted">Khách cần thanh toán</span><span class="big-amount num">' + U.money(grand) + "</span></div>" +
            '<div class="denoms">' + quickDenoms.map((v) => '<button type="button" data-act="cashier.cashQuick" data-v="' + v + '">' + (v === grand ? "Đúng tiền (" + U.moneyShort(v) + ")" : U.moneyPlain(v)) + "</button>").join("") + "</div>" +
            '<div class="grid-2">' +
            UI.field("Tiền mặt khách đưa (đ)", UI.input({ type: "number", model: "cashier.cashGiven", live: true, value: s.cashGiven })) +
            '<div class="field"><label>Tiền thối lại cho khách</label><div class="change-amount num">' + U.money(change) + "</div></div></div></div>";
        } else if (s.payMethod === "qr") {
          const tip = Math.max(0, (Number(s.qrReceived) || 0) - grand);
          const shares = tip > 0 ? Engine.computeTipShares(curTk, tip, s.payTipMode, curTk.waiterId) : [];
          const onDutyW = Engine.onDutyWaiters ? Engine.onDutyWaiters() : [];
          const poolLabel = onDutyW.length
            ? "Chia đều toàn ca phục vụ (" + onDutyW.length + " người trong ca)"
            : "Chia đều toàn ca phục vụ (0 người trong ca → về người đứng bàn)";
          pane = '<div class="grid-2">' +
            UI.qrBox({ amount: grand, memo: payCode, caption: "Quét VietQR tự điền số tiền & mã định danh " + payCode }) +
            '<div class="col gap-12">' +
            '<div class="row between"><span class="muted">Số tiền cần thanh toán</span><b class="big-amount num" style="font-size:26px">' + U.money(grand) + "</b></div>" +
            '<div class="chips">' +
              (grand >= 100000 ? [Math.round(grand / 2 / 1000) * 1000] : []).map((half) => '<button type="button" class="chip ' + (Number(s.qrReceived) === half ? "active" : "") + '" data-act="cashier.qrQuick" data-v="' + half + '">Chuyển 1 phần ' + U.moneyShort(half) + "</button>").join("") +
              [0, 20000, 50000, 100000].map((add) => '<button type="button" class="chip ' + (Number(s.qrReceived) === grand + add ? "active" : "") + '" data-act="cashier.qrQuick" data-v="' + (grand + add) + '">' + (add === 0 ? "Đúng " + U.moneyShort(grand) : "+" + U.moneyShort(add) + " Tip") + "</button>").join("") +
            "</div>" +
            UI.field("Số tiền khách chuyển thực tế (đ)", UI.input({ type: "number", model: "cashier.qrReceived", live: true, value: s.qrReceived }), "Hỗ trợ chuyển 1 phần (cộng dồn) hoặc >= mức thanh toán (dư tự tính vào Tiền Tip).") +
            UI.field("Quy chế xác định Tiền Tip", UI.select({
              model: "cashier.payTipMode",
              live: true,
              value: s.payTipMode,
              options: [
                { value: "personal", label: "Nhân viên đứng bàn nhận 100% (" + Engine.staffName(curTk.waiterId) + ")" },
                { value: "pool", label: poolLabel },
                { value: "area", label: "Chia theo tổ khu vực bàn" },
              ],
            })) +
            (tip > 0
              ? UI.banner("success", "hand-coins", "<b>Tự động tách tiền Tip QR: +" + U.money(tip) + "</b> (" + shares.map((sh) => esc(Engine.staffName(sh.staffId)) + ": " + U.money(sh.amount)).join(", ") + ")")
              : "") +
            (App.isDemo()
              ? UI.btn("Giả lập Webhook Biến động số dư báo về (Auto-Chốt)", { kind: "info", icon: "zap", act: "cashier.simulateWebhook", data: { id: curTk.id } })
              : "") +
            "</div></div>";
        } else if (s.payMethod === "split_pay") {
          const cashPart = Math.min(grand, Math.max(0, Number(s.splitCash) || 0));
          const qrPart = Math.max(0, grand - cashPart);
          pane = '<div class="grid-2">' +
            '<div class="col gap-12">' +
            UI.field("Phần trả bằng Tiền mặt (đ)", UI.input({ type: "number", model: "cashier.splitCash", live: true, value: cashPart })) +
            '<div class="field"><label>Phần còn lại chuyển khoản VietQR</label><div class="big-amount num text-primary" style="font-size:26px">' + U.money(qrPart) + "</div></div></div>" +
            UI.qrBox({ amount: qrPart, memo: payCode, caption: "VietQR cho phần chuyển khoản (" + payCode + ")" }) +
            "</div>";
        } else {
          const n = Math.max(1, Number(s.evenPeople) || 2);
          const per = Math.ceil(grand / n / 1000) * 1000;
          pane = '<div class="col gap-12">' +
            '<div class="row between"><span>Số người chia đều</span><div class="stepper"><button type="button" data-act="cashier.evenStep" data-d="-1">-</button><span>' + n + '</span><button type="button" data-act="cashier.evenStep" data-d="1">+</button></div></div>' +
            '<div class="card"><div class="card-body row between"><span>Mỗi người thanh toán (làm tròn nghìn)</span><b class="big-amount num text-primary" style="font-size:28px">' + U.money(per) + "/người</b></div></div></div>";
        }

        return partialBanner + pendingApBanner + tabs + pane + UI.totals(curTk);
      },
      foot: () => UI.btn("Đóng", { act: "app.closeModal" }) +
        UI.btn("Xác nhận đã thu tiền & In hóa đơn", { kind: "primary", size: "lg", icon: "check", act: "cashier.payConfirm", data: { id: tk.id } }),
    });
  }

  function openAddDishModal(tk) {
    const st = S();
    st.addSeaMenuId = "";
    st.addBeerMenuId = "";
    st.addBeerQty = 24;
    st.addSeaMode = "whole";
    st.addFishIds = [];
    st.addSourceFishId = "";
    st.addSeaGram = 500;
    st.addSeaKg = 0.5;
    st.addBargainOn = false;
    st.addDealAmount = null;
    st.addStyleId = "";
    st.addNote = "";
    const tb = Engine.table(tk.tableId);
    App.modal({
      title: "Gọi thêm món · Bàn " + (tb ? tb.code : tk.tableId),
      sub: "Hỗ trợ xuất Bia nguyên thùng/két (trả lại lẻ lon dư), chọn cá nguyên con trong bể hoặc gọi lẻ theo gram.",
      size: "lg",
      body: () => {
        const s = S();
        if (s.addBeerMenuId) {
          const m = Engine.menu(s.addBeerMenuId);
          if (m) {
            const avail = Engine.menuAvailability(m.id);
            const caseSize = Number(m.caseSize) || 24;
            const halfCase = Math.round(caseSize / 2);
            const unit = m.unit || "lon";
            const maxStock = Math.max(1, Number(avail.maxPortions) || 999);
            const curQty = Math.min(maxStock, Math.max(1, Number(s.addBeerQty) || caseSize));
            s.addBeerQty = curQty;
            const totalAmt = (Number(m.price) || 0) * curQty;
            const promo = D().promos.find((p) => p.active && p.brand === m.brand && p.menuId === m.id);
            const freeQty = promo && promo.buyQty > 0 ? Math.floor(curQty / promo.buyQty) * (Number(promo.freeQty) || 0) : 0;
            const presets = [
              { q: caseSize, label: "1 thùng (" + caseSize + " " + unit + ")", sub: U.money(m.price * caseSize) },
              { q: caseSize * 2, label: "2 thùng (" + (caseSize * 2) + " " + unit + ")", sub: U.money(m.price * caseSize * 2) },
              { q: halfCase, label: "Nửa thùng (" + halfCase + " " + unit + ")", sub: U.money(m.price * halfCase) },
              { q: 6, label: "Lốc 6 " + unit, sub: U.money(m.price * 6) },
              { q: 1, label: "Lẻ 1 " + unit, sub: U.money(m.price) },
              { q: 2, label: "Lẻ 2 " + unit, sub: U.money(m.price * 2) },
              { q: 5, label: "Lẻ 5 " + unit, sub: U.money(m.price * 5) },
            ].filter((p) => p.q <= maxStock);

            return '<div class="col gap-12">' +
              '<div class="row between wrap gap-8">' +
                '<div class="row gap-8"><button type="button" class="btn btn-sm" data-act="cashier.addBeerBack">' + I("arrow-left", "ic-sm") + ' Quay lại thực đơn</button><b>' + esc(m.name) + '</b><span class="badge badge-primary">' + U.money(m.price) + '/' + esc(unit) + ' · ' + U.money(m.price * caseSize) + '/thùng (' + caseSize + ' ' + esc(unit) + ')</span></div>' +
                '<span class="small muted">Tồn kho tại quầy: <b>' + maxStock + ' ' + esc(unit) + ' (' + Engine.formatBeerCaseQty(maxStock, caseSize, unit) + ')</b></span>' +
              '</div>' +
              '<div class="card card-pad" style="background:var(--surface-2);border:1px solid var(--border)">' +
                '<div class="row between wrap gap-8 mb-8">' +
                  '<div><b>Chọn xuất Nguyên thùng / Két hoặc Lẻ ' + esc(unit) + ' ra bàn</b><div class="small muted">Khách uống không hết nguyên thùng được trả lại theo từng ' + esc(unit) + ' chưa khui ngay trên bill.</div></div>' +
                  '<span class="badge badge-info">1 thùng = ' + caseSize + ' ' + esc(unit) + '</span>' +
                '</div>' +
                '<div class="chips mb-10">' +
                  presets.map((p) => '<button type="button" class="chip' + (curQty === p.q ? " active" : "") + '" data-act="cashier.addBeerSetQty" data-q="' + p.q + '"><b>' + esc(p.label) + '</b> · ' + p.sub + '</button>').join("") +
                '</div>' +
                '<div class="row between wrap gap-8">' +
                  '<div class="row gap-6 wrap">' +
                    '<div class="stepper">' +
                      '<button type="button" data-act="cashier.addBeerStep" data-d="-1">-</button>' +
                      '<span>' + curQty + ' ' + esc(unit) + '</span>' +
                      '<button type="button" data-act="cashier.addBeerStep" data-d="1">+</button>' +
                    '</div>' +
                    '<button type="button" class="btn btn-sm" data-act="cashier.addBeerStep" data-d="' + caseSize + '">+1 thùng (+' + caseSize + ')</button>' +
                    (curQty > caseSize ? '<button type="button" class="btn btn-sm" data-act="cashier.addBeerStep" data-d="-' + caseSize + '">-1 thùng (-' + caseSize + ')</button>' : '') +
                  '</div>' +
                  '<div class="right">' +
                    '<div class="small muted">Đem ra bàn: <b>' + Engine.formatBeerCaseQty(curQty, caseSize, unit) + '</b></div>' +
                    '<div class="num strong text-primary" style="font-size:16px">' + U.money(totalAmt) + '</div>' +
                  '</div>' +
                '</div>' +
                (promo
                  ? '<div class="mt-8 small" style="color:var(--success)">' + I("gift", "ic-xs") + ' Khuyến mãi <b>' + esc(promo.title) + '</b>: ' +
                    (freeQty > 0 ? 'Tự động tặng kèm <b>+' + freeQty + ' ' + esc(unit) + '</b> miễn phí trên bill.' : 'Mua đủ ' + promo.buyQty + ' ' + esc(unit) + ' tặng ' + promo.freeQty + ' ' + esc(unit) + '.') +
                    '</div>'
                  : '') +
              '</div>' +
              UI.field("Ghi chú (tùy chọn)", UI.input({ model: "cashier.addNote", value: s.addNote, placeholder: "Ví dụ: Ướp lạnh sâu, thêm xô đá lớn..." })) +
              UI.btn("Xác nhận xuất " + Engine.formatBeerCaseQty(curQty, caseSize, unit) + " · " + U.money(totalAmt), {
                kind: "primary",
                size: "lg",
                block: true,
                icon: "check",
                act: "cashier.addBeerConfirm",
              }) +
            '</div>';
          }
        }
        if (s.addSeaMenuId) {
          const m = Engine.menu(s.addSeaMenuId);
          if (m) {
            const isCountable = Engine.isCountableSeafood(m);
            const pol = Engine.seafoodPolicy();
            const fishList = isCountable ? Engine.tankFishList(m.id) : [];
            const saleMode = isCountable ? (s.addSeaMode || "whole") : "gram";
            const selIds = Array.isArray(s.addFishIds) ? s.addFishIds : [];
            const selFish = fishList.filter((f) => selIds.includes(f.id));
            const curGram = Math.max(Number(pol.minGram) || 200, Number(s.addSeaGram) || 500);
            const totalKg = saleMode === "whole" && isCountable
              ? Math.round(selFish.reduce((sum, f) => sum + (Number(f.kg) || 0), 0) * 100) / 100
              : Math.round((curGram / 1000) * 100) / 100;
            const styles = (m.styles || []).map((id) => Engine.style(id)).filter(Boolean);
            const curStyle = Engine.style(s.addStyleId) || styles[0] || null;
            const sur = curStyle ? Number(curStyle.surcharge) || 0 : 0;
            const role = (App.me() || {}).role || "cashier";
            const bg = Engine.evaluateSeafoodBargain(m, totalKg, saleMode === "whole" && s.addBargainOn ? s.addDealAmount : null, role);
            const estAmt = (saleMode === "whole" && s.addBargainOn && bg.dealAmount ? bg.dealAmount : Math.round(totalKg * (m.pricePerKg || 0) / 1000) * 1000) + sur;

            const modeToggle = isCountable && pol.allowSellByGram
              ? '<div class="seg" style="display:grid;grid-template-columns:1fr 1fr;gap:6px">' +
                '<button type="button" class="' + (saleMode === "whole" ? "active" : "") + '" data-act="cashier.addSeaMode" data-mode="whole">' + I("fish", "ic-sm") + " Nguyên con (" + fishList.length + " con)</button>" +
                '<button type="button" class="' + (saleMode === "gram" ? "active" : "") + '" data-act="cashier.addSeaMode" data-mode="gram">' + I("scale", "ic-sm") + " Theo gram / Cắt khúc (VD: 500g)</button>" +
                "</div>"
              : "";

            const bargainBox = saleMode === "whole" && isCountable && pol.allowWholeFishBargain && selFish.length
              ? '<div class="card card-pad" style="background:var(--surface-2)">' +
                '<div class="row between wrap gap-8">' +
                '<div><b>Khách trả giá / Ép giá nguyên con</b><div class="small muted">Giá niêm yết tiền cá: <b>' + U.money(bg.listAmount) + "</b> (" + U.money(m.pricePerKg) + "/kg)</div></div>" +
                '<button type="button" class="btn btn-sm ' + (s.addBargainOn ? "btn-primary" : "") + '" data-act="cashier.addBargainToggle">' + I("badge-percent", "ic-sm") + (s.addBargainOn ? "Đang bật chốt giá" : "Khách trả giá") + "</button>" +
                "</div>" +
                (s.addBargainOn
                  ? '<div class="col gap-8 mt-8">' +
                    (bg.quickDeals.length
                      ? '<div class="chips">' + bg.quickDeals.map((v) => '<button type="button" class="chip' + (bg.dealAmount === v ? " active" : "") + '" data-act="cashier.addDealSet" data-v="' + v + '">Chốt ' + U.money(v) + " (-" + U.moneyShort(bg.listAmount - v) + ")</button>").join("") + "</div>"
                      : "") +
                    '<div class="row wrap gap-8"><div class="grow">' + UI.input({ type: "number", step: 5000, model: "cashier.addDealAmount", live: true, value: bg.dealAmount, placeholder: "Nhập giá chốt nguyên con (VNĐ)" }) + "</div></div>" +
                    (bg.belowCost
                      ? UI.banner("danger", "triangle-alert", "Giá khách trả thấp hơn giá vốn nhập bể (" + U.money(bg.costAmount) + "). Không thể chốt lỗ.")
                      : bg.discount <= 0
                      ? '<div class="small muted">Đang giữ giá niêm yết ' + U.money(bg.listAmount) + ".</div>"
                      : bg.withinSelfLimit
                      ? '<div class="badge badge-success" style="align-self:flex-start">Giảm ' + U.money(bg.discount) + " (-" + bg.pct + "%) · Tự chốt ngay tại quầy (tối đa " + bg.maxPct + "%)</div>"
                      : '<div class="badge badge-warning" style="align-self:flex-start">Giảm ' + U.money(bg.discount) + " (-" + bg.pct + "%) · Vượt khung tự chốt " + bg.maxPct + "% — Sẽ tạo yêu cầu Chủ quán duyệt</div>") +
                    "</div>"
                  : "") +
                "</div>"
              : "";

            const srcFish = isCountable ? (fishList.find((f) => f.id === s.addSourceFishId) || fishList.find((f) => f.partial) || fishList[0] || null) : null;
            if (srcFish) s.addSourceFishId = srcFish.id;

            return '<div class="col gap-12">' +
              '<div class="row between"><div class="row gap-8"><button type="button" class="btn btn-sm" data-act="cashier.addSeaBack">' + I("arrow-left", "ic-sm") + ' Quay lại thực đơn</button><b>' + esc(m.name) + '</b><span class="badge badge-info">' + U.money(m.pricePerKg) + '/kg</span></div>' +
              '<span class="small muted">Đang còn trong bể: <b>' + (isCountable ? fishList.length + " con (" + U.kg((D().tank[m.id] || {}).kg || 0) + ")" : U.kg((D().tank[m.id] || {}).kg || 0)) + "</b></span></div>" +
              modeToggle +
              (saleMode === "whole" && isCountable
                ? '<div class="field">' +
                  '<div class="row between wrap gap-8 mb-6">' +
                    '<label style="margin:0">1. Chọn con cá thực tế trong bể (số kg đã cân lúc nhập bể)</label>' +
                    (fishList.length > 1
                      ? '<button type="button" class="chip' + (s.addMultiFish ? " active" : "") + '" data-act="cashier.addMultiFishToggle" style="font-size:12px;padding:3px 10px">' +
                        (s.addMultiFish ? "Đang bật: Chọn ghép nhiều con" : "Chọn ghép nhiều con") +
                        "</button>"
                      : "") +
                  "</div>" +
                  '<div class="fish-pick-grid">' +
                  fishList.map((f) => {
                    const active = selIds.includes(f.id);
                    const fishMoney = Math.round((Number(f.kg) || 0) * (m.pricePerKg || 0));
                    return '<button type="button" class="fish-pick-card' + (active ? " active" : "") + '" data-act="cashier.addToggleFish" data-fish="' + esc(f.id) + '">' +
                      '<div class="fpc-head"><b>' + esc(f.code) + '</b>' + (active ? '<span class="fpc-check">' + I("check", "ic-xs") + " Đã chọn</span>" : '<span class="fpc-avail">' + (f.partial ? "Đang xẻ" : "Trong bể") + "</span>") + "</div>" +
                      '<div class="fpc-kg num">' + (f.partial ? f.gram + " <small>g</small>" : U.num(f.kg, 2) + " <small>kg</small>") + "</div>" +
                      '<div class="fpc-price num">' + U.money(fishMoney) + "</div></button>";
                  }).join("") +
                  "</div>" +
                  '<div class="fish-pick-summary"><span>' +
                  (selFish.length
                    ? "Đã chọn: <b>" + selFish.length + " con</b> (" + selFish.map((f) => f.code).join(", ") + ") · Tổng: <b>" + U.kg(totalKg) + "</b>"
                    : '<span class="text-warning">Chạm chọn 1 con cá thực tế trong bể để thêm vào bàn</span>') +
                  '</span><b class="text-primary num">' + U.money(estAmt) + "</b></div></div>" +
                  bargainBox
                : '<div class="field"><label>1. Chọn khối lượng gọi lẻ theo Gram (còn ' + Math.round(((D().tank[m.id] || {}).kg || 0) * 1000) + 'g trong bể)</label>' +
                  '<div class="chips mb-8">' + [200, 300, 400, 500, 600, 700, 800, 1000, 1500].map((g) => '<button type="button" class="chip' + (curGram === g ? " active" : "") + '" data-act="cashier.addPickGram" data-gram="' + g + '">' + (g >= 1000 ? U.num(g / 1000, 1) + " kg (" + g + "g)" : g + "g") + " · " + U.money(Math.round((g / 1000) * m.pricePerKg)) + "</button>").join("") + "</div>" +
                  '<div class="row wrap gap-8"><div style="width:180px">' + UI.input({ type: "number", step: 50, model: "cashier.addSeaGram", live: true, value: curGram, placeholder: "Nhập số gram (VD: 500)" }) + '</div><span class="small muted">Định lượng: <b>' + curGram + "g (" + U.num(totalKg, 2) + " kg)</b> · Thành tiền: <b class='text-primary'>" + U.money(estAmt) + "</b></span></div>" +
                  (isCountable && fishList.length
                    ? '<div class="mt-8"><div class="small strong mb-4">Xẻ từ con cá trong bể:</div><div class="chips">' +
                      fishList.map((f) => '<button type="button" class="chip' + (s.addSourceFishId === f.id ? " active" : "") + '" data-act="cashier.addSourceFish" data-fish="' + esc(f.id) + '">' + esc(f.code) + " (" + f.gram + "g" + (f.partial ? " · đang xẻ" : "") + ")</button>").join("") +
                      "</div></div>"
                    : "") +
                  "</div>") +
              (styles.length
                ? '<div class="field"><label>2. Kiểu chế biến</label><div class="chips">' +
                  styles.map((stItem) => '<button type="button" class="chip' + ((s.addStyleId || styles[0].id) === stItem.id ? " active" : "") + '" data-act="cashier.addPickStyle" data-style="' + stItem.id + '">' + esc(stItem.name) + (stItem.surcharge ? " (+" + U.moneyShort(stItem.surcharge) + ")" : "") + "</button>").join("") +
                  "</div></div>"
                : "") +
              UI.field("3. Ghi chú chế biến cho bếp", UI.input({ model: "cashier.addNote", value: s.addNote, placeholder: "Ví dụ: Cắt khúc nấu lẩu, ít cay, tách riêng đầu nấu cháo..." })) +
              UI.btn("Xác nhận thêm " + m.name + " (" + (saleMode === "gram" ? curGram + "g" : U.kg(totalKg)) + " · " + U.money(estAmt) + ")", {
                kind: "primary",
                size: "lg",
                block: true,
                icon: "check",
                act: "cashier.addSeaConfirm",
                disabled: saleMode === "whole" && isCountable && !selFish.length,
              }) +
              "</div>";
          }
        }
        const cats = [{ value: "all", label: "Tất cả" }].concat(cfg().categories.map((c) => ({ value: c.id, label: c.name })));
        const list = Engine.activeMenu((m) => (s.addCat === "all" || m.categoryId === s.addCat) && (!s.addQ || U.match(m.name, s.addQ)));
        return UI.search({ id: "pos-add-q", model: "cashier.addQ", value: s.addQ, placeholder: "Tìm tên món..." }) +
          UI.chips(cats, s.addCat, "cashier.addCat") +
          '<div class="grid-3" style="max-height:380px;overflow-y:auto">' +
          list.map((m) => {
            const p = m.kind === "seafood"
              ? U.money(m.pricePerKg) + "/kg"
              : m.kind === "beer"
              ? U.money(m.price) + "/" + (m.unit || "lon") + " · " + U.money(m.price * (m.caseSize || 24)) + "/thùng (" + (m.caseSize || 24) + " " + (m.unit || "lon") + ")"
              : U.money(m.price) + "/" + (m.unit || "phần");
            const avail = Engine.menuAvailability(m.id);
            const out = avail.maxPortions <= 0;
            const fishPills = m.kind === "seafood" && avail.fishList && avail.fishList.length
              ? '<div class="mi-fish-pills mt-4">' + avail.fishList.slice(0, 3).map((f) => '<span class="fish-pill">' + esc(f.code) + ": " + U.num(f.kg, 2) + "kg</span>").join("") + (avail.fishList.length > 3 ? '<span class="fish-pill more">+' + (avail.fishList.length - 3) + "</span>" : "") + "</div>"
              : "";
            return '<button type="button" class="opt-card' + (out ? " is-out" : "") + '" data-act="cashier.addDishPick" data-menu="' + m.id + '"' + (out ? " disabled" : "") + '><div><b>' + esc(m.name) + '</b><div class="small muted">' + p + '</div><div class="mi-avail tone-' + (avail.tone || "good") + ' mt-4">' + esc(avail.label) + "</div>" + fishPills + "</div></button>";
          }).join("") + "</div>";
      },
      foot: () => UI.btn("Đóng", { kind: "primary", act: "app.closeModal" }),
    });
  }

  function openStockModal() {
    const seaList = Engine.activeMenu((m) => m.kind === "seafood");
    const dishList = Engine.activeMenu((m) => m.kind !== "seafood");
    App.modal({
      title: "Tồn bể cá thực tế & Số phần món ăn có thể làm",
      sub: "Cập nhật tức thời theo từng con cá trong bể và định mức nguyên liệu tồn trong bếp",
      size: "lg",
      body: () => {
        const seaHtml = seaList.map((m) => {
          const isCountable = Engine.isCountableSeafood(m);
          const fish = isCountable ? Engine.tankFishList(m.id) : [];
          const t = D().tank[m.id] || { count: 0, kg: 0 };
          return '<div class="card mb-8"><div class="card-body col gap-8">' +
            '<div class="row between"><div><b>' + esc(m.name) + '</b> <span class="small muted">(' + U.money(m.pricePerKg) + '/kg)</span></div>' +
            UI.badge(isCountable ? fish.length + " con · " + U.kg(t.kg) : U.kg(t.kg), (isCountable ? fish.length : t.kg) > 0 ? "success" : "danger", true) +
            "</div>" +
            (isCountable
              ? (fish.length
                  ? '<div class="mi-fish-pills">' + fish.map((f) => '<span class="fish-pill"><b>' + esc(f.code) + "</b> · " + U.num(f.kg, 2) + " kg · " + U.money(Math.round(f.kg * m.pricePerKg)) + "</span>").join("") + "</div>"
                  : '<div class="small text-danger">Đã hết trong bể</div>')
              : '<div class="small muted">Quản lý theo khối lượng tổng trong bể: còn <b>' + U.kg(t.kg) + "</b></div>") +
            "</div></div>";
        }).join("");

        const dishRows = dishList.map((m) => {
          const av = Engine.menuAvailability(m.id);
          const limName = (av.limitingBag && av.limitingBag.name) || av.limiting || "Đủ nguyên liệu";
          return "<tr><td><b>" + esc(m.name) + "</b></td><td>" + esc(limName) + '</td><td class="num">' +
            UI.badge(av.label, av.tone === "danger" ? "danger" : av.tone === "warning" ? "warning" : "success", true) + "</td></tr>";
        }).join("");

        return '<div class="col gap-12">' +
          '<div><h4 class="mb-8">1. Danh sách từng con cá / hải sản hiện còn trong bể</h4>' + seaHtml + "</div>" +
          '<div><h4 class="mb-8">2. Số phần món ăn có thể chế biến theo nguyên liệu còn lại</h4>' +
          '<div class="table-wrap card"><table class="dt"><thead><tr><th>Món ăn / Đồ uống</th><th>Nguyên liệu quyết định</th><th class="num">Khả năng phục vụ</th></tr></thead><tbody>' + dishRows + "</tbody></table></div></div>" +
          "</div>";
      },
      foot: () => UI.btn("Đóng", { kind: "primary", act: "app.closeModal" }),
    });
  }

  function openDrawerModal() {
    const st = S();
    const waiters = D().staff.filter((s) => s.active);
    if (!st.tipStaff && waiters[0]) st.tipStaff = waiters[0].id;
    App.modal({
      title: "Quản lý két tiền mặt tại quầy",
      size: "lg",
      body: () => {
        const sh = Engine.currentShift();
        if (!sh) return UI.empty("lock", "Ca thu ngân đã đóng", "Mở ca mới để thực hiện giao dịch tiền mặt.");
        const ss = Engine.shiftStats(sh);
        const s = S();
        const advs = D().advances.filter((a) => a.status === "approved");
        const nav = UI.seg([
          { value: "petty", label: "Chi tiền vặt (" + U.moneyShort(ss.petty) + ")" },
          { value: "tip", label: "Chi trả Tip QR (" + U.moneyShort(ss.tipsPaid) + ")" },
          { value: "advance", label: "Chi ứng lương (" + advs.length + ")" },
        ], s.drawerTab, "cashier.drawerTab");

        let form = "";
        if (s.drawerTab === "petty") {
          form = '<div class="grid-2">' +
            UI.field("Số tiền chi (đ) · Tối đa " + U.money(cfg().permissions.cashier.pettyCashMax) + "/lần", UI.input({ type: "number", model: "cashier.pettyAmt", value: s.pettyAmt })) +
            UI.field("Nội dung chi vặt", UI.input({ model: "cashier.pettyReason", value: s.pettyReason, placeholder: "Ví dụ: Mua thêm 10 bao đá viên" })) +
            "</div>" + UI.btn("Ghi phiếu chi tiền mặt", { kind: "primary", icon: "check", act: "cashier.pettySubmit" });
        } else if (s.drawerTab === "tip") {
          form = '<div class="grid-2">' +
            UI.field("Nhân viên nhận tiền tip", UI.select({ model: "cashier.tipStaff", value: s.tipStaff, options: waiters.map((w) => ({ value: w.id, label: w.name + " (Còn " + U.money(Engine.tipOwed(w.id)) + ")" })) })) +
            UI.field("Số tiền tip rút từ két (đ)", UI.input({ type: "number", model: "cashier.tipAmt", value: s.tipAmt || Engine.tipOwed(s.tipStaff) })) +
            "</div>" + UI.btn("Chi trả tiền Tip từ két", { kind: "primary", icon: "check", act: "cashier.tipSubmit" });
        } else {
          form = advs.length
            ? '<div class="col gap-8">' + advs.map((a) => '<div class="row between py-4 border-b"><div><b>' + esc(Engine.staffName(a.staffId)) + "</b> · " + U.money(a.amount) + '</div>' + UI.btn("Chi tiền ngay", { size: "sm", kind: "primary", act: "cashier.payAdvanceNow", data: { id: a.id } }) + "</div>").join("") + "</div>"
            : UI.empty("check", "Không có phiếu ứng lương nào chờ chi");
        }

        return '<div class="grid-3">' +
          UI.kpi({ label: "Tiền đầu ca", value: U.money(ss.opening) }) +
          UI.kpi({ label: "Thu tiền mặt", value: U.money(ss.cash) }) +
          UI.kpi({ label: "Phải có trong két", value: U.money(ss.expected), tone: "good" }) +
          "</div>" + nav + form;
      },
      foot: () => UI.btn("Đóng", { act: "app.closeModal" }),
    });
  }

  function openZReportModal() {
    const st = S();
    st.zStep = 1;
    st.zDenoms = {};
    st.zNote = "";
    App.modal({
      title: "Chốt ca thu ngân & Lập báo cáo Z-Report",
      size: "lg",
      body: () => {
        const s = S();
        const sh = Engine.currentShift();
        if (!sh) return UI.empty("circle-check", "Ca hiện tại đã chốt", "Bạn có thể mở ca mới khi bắt đầu ngày làm việc tiếp theo.");
        const ss = Engine.shiftStats(sh);
        const openTks = Engine.openTickets();
        const counted = DENOMS.reduce((acc, d) => acc + d * (Number(s.zDenoms[d]) || 0), 0);
        const diff = counted - ss.expected;

        const steps = UI.steps(["1. Rà soát bàn & kho", "2. Kiểm đếm tiền mặt", "3. Đối chiếu & Khóa sổ"], s.zStep - 1);
        if (s.zStep === 1) {
          return steps +
            (openTks.length
              ? UI.banner("warning", "triangle-alert", "<b>Còn " + openTks.length + " bàn đang mở chưa thanh toán.</b> Bạn nên thanh toán hoặc chuyển giao trước khi chốt ca.")
              : UI.banner("success", "circle-check", "Tất cả các bàn đã đóng bill. Sẵn sàng kiểm đếm tiền mặt.")) +
            '<div class="grid-3">' +
            UI.kpi({ label: "Tổng số hóa đơn đã thu", value: ss.bills + " bill" }) +
            UI.kpi({ label: "Doanh thu Tiền mặt", value: U.money(ss.cash) }) +
            UI.kpi({ label: "Doanh thu VietQR", value: U.money(ss.qr) }) +
            "</div>";
        }
        if (s.zStep === 2) {
          const rows = DENOMS.map((d) => {
            const c = Number(s.zDenoms[d]) || 0;
            return "<tr><td><b>" + U.money(d) + '</b></td><td style="width:150px"><input type="number" min="0" class="input input-sm num" data-change="cashier.zDenom" data-d="' + d + '" value="' + (c || "") + '" placeholder="0"></td><td class="num strong">' + U.money(d * c) + "</td></tr>";
          }).join("");
          return steps +
            '<div class="row between"><span>Nhập số tờ theo từng mệnh giá (hoặc bấm Điền khớp lý thuyết để thử nhanh)</span>' +
            UI.btn("Điền khớp lý thuyết", { size: "sm", act: "cashier.zFillExact", data: { expected: ss.expected } }) + "</div>" +
            '<div class="table-wrap"><table class="dt"><thead><tr><th>Mệnh giá</th><th>Số tờ</th><th class="num">Thành tiền</th></tr></thead><tbody>' + rows + "</tbody></table></div>" +
            '<div class="row between pt-8"><span class="strong">Tổng tiền mặt thực đếm</span><b class="big-amount num text-primary" style="font-size:26px">' + U.money(counted) + "</b></div>";
        }
        return steps +
          '<div class="grid-3">' +
          UI.kpi({ label: "Tiền mặt lý thuyết phải có", value: U.money(ss.expected) }) +
          UI.kpi({ label: "Tiền mặt thực đếm", value: U.money(counted) }) +
          UI.kpi({ label: "Chênh lệch két tiền", value: (diff >= 0 ? "+" : "") + U.money(diff), tone: diff === 0 ? "good" : "alert" }) +
          "</div>" +
          (diff !== 0 ? UI.field("Giải trình lý do chênh lệch tiền mặt (bắt buộc khi lệch)", UI.textarea({ model: "cashier.zNote", value: s.zNote, placeholder: "Ghi rõ nguyên nhân thừa/thiếu tiền mặt..." })) : UI.banner("success", "circle-check", "Tiền mặt thực đếm khớp 100% với sổ cái hệ thống."));
      },
      foot: () => {
        const s = S();
        if (s.zStep === 1) return UI.btn("Đóng", { act: "app.closeModal" }) + UI.btn("Tiếp tục kiểm tiền", { kind: "primary", icon: "arrow-right", act: "cashier.zNext", data: { step: 2 } });
        if (s.zStep === 2) return UI.btn("Quay lại", { act: "cashier.zNext", data: { step: 1 } }) + UI.btn("Tiếp tục đối chiếu", { kind: "primary", icon: "arrow-right", act: "cashier.zNext", data: { step: 3 } });
        return UI.btn("Quay lại đếm tiền", { act: "cashier.zNext", data: { step: 2 } }) + UI.btn("Xác nhận Chốt ca & In Z-Report", { kind: "primary", icon: "lock", act: "cashier.zSubmit" });
      },
    });
  }

  /* =====================================================================
     DANG KY PORTAL THU NGAN
     ===================================================================== */
  App.portal(P, {
    render() {
      const sh = Engine.currentShift();
      const autoLocked = sh && sh.status === "auto_locked";
      const closed = !sh || sh.status === "closed";

      const rightBtns =
        (closed
          ? UI.btn("Mở ca thu ngân mới", { size: "sm", kind: "primary", icon: "play", act: "cashier.openShift" })
          : autoLocked
            ? UI.btn("Mở khóa ca (đang khóa tự động)", { size: "sm", kind: "warning", icon: "lock-open", act: "cashier.reopenShift" })
            : "") +
        UI.btn("Két tiền mặt", { size: "sm", icon: "wallet", act: "cashier.drawer" }) +
        UI.btn("Lịch sử in K80 (" + D().printLog.length + ")", { size: "sm", icon: "printer", act: "cashier.printLog" }) +
        UI.btn("Chốt ca (Z-Report)", { size: "sm", kind: "primary", icon: "file-check", act: "cashier.zReport", disabled: closed });

      const shiftBanner = autoLocked
        ? '<div class="px-16 pt-8">' + UI.banner("warning", "lock", "<b>Ca thu ngân đã tự động khóa sổ theo giờ cài đặt (" + cfg().locks.zLockTime + ").</b> Để tiếp tục tạo order hoặc thanh toán trong bản demo, bấm nút <b>Mở khóa ca</b> ở góc phải trên cùng.") + "</div>"
        : closed
          ? '<div class="px-16 pt-8">' + UI.banner("info", "info", "<b>Ca thu ngân hiện đã đóng.</b> Bấm <b>Mở ca thu ngân mới</b> ở góc trên bên phải để bắt đầu nhận bàn và thanh toán.") + "</div>"
          : "";

      const st = S();
      const selTb = Engine.table(ensureSelectedTable());
      const selTk = selTb ? Engine.ticketByTable(selTb.id) : null;
      const selTot = selTk ? Engine.totals(selTk) : null;
      const mobileSwitch = '<div class="pos-mobile-switch">' +
        '<button type="button" class="pms-btn' + (st.mobilePane !== "bill" ? " active" : "") + '" data-act="cashier.mobilePane" data-value="floor">' +
          I("layout-grid", "ic-sm") + '<span>Sơ đồ bàn & Ca (' + Engine.openTickets().length + ')</span></button>' +
        '<button type="button" class="pms-btn' + (st.mobilePane === "bill" ? " active" : "") + '" data-act="cashier.mobilePane" data-value="bill">' +
          I("receipt", "ic-sm") + '<span>' + (selTb ? "Bàn " + esc(selTb.code) + (selTot ? " · " + U.moneyShort(selTot.grand) : " · Trống") : "Chi tiết Bill") + "</span></button>" +
        "</div>";

      return '<div class="pos">' +
        UI.topbar({ subtitle: "POS Thu ngân kiêm Quản lý ca", right: rightBtns }) +
        kpiBar() +
        shiftBanner +
        mobileSwitch +
        '<div class="pos-body" data-mobile-pane="' + (st.mobilePane || "floor") + '">' + leftColumn() + rightColumn() + "</div></div>";
    },
    hotkeys(ev) {
      if (App._modal) return;
      const tk = Engine.ticketByTable(ensureSelectedTable());
      if (ev.key === "F2") {
        ev.preventDefault();
        if (tk) App.run("cashier.prebill");
      } else if (ev.key === "F9") {
        ev.preventDefault();
        if (tk) App.run("cashier.payModal");
      } else if (ev.key === "F4") {
        ev.preventDefault();
        if (tk) App.run("cashier.splitModal");
      } else if (ev.key === "F6") {
        ev.preventDefault();
        if (tk) App.run("cashier.transferModal");
      } else if (ev.key === "F3") {
        ev.preventDefault();
        const el = document.getElementById("pos-table-q");
        if (el) el.focus();
      }
    },
  });

  /* =====================================================================
     HANH DONG THU NGAN (cashier.*)
     ===================================================================== */
  App.actions({
    "cashier.leftTab": (d) => { S().leftTab = d.value; S().mobilePane = "floor"; App.render(); },
    "cashier.mobilePane": (d) => { S().mobilePane = d.value || "floor"; App.render(); },
    "cashier.stockModal": () => openStockModal(),
    "cashier.area": (d) => { S().area = d.value; App.render(); },
    "cashier.filter": (d) => { S().filter = d.value; S().leftTab = "floor"; S().mobilePane = "floor"; App.render(); },
    "cashier.pickTable": (d) => {
      S().tableId = d.table;
      S().mobilePane = "bill";
      const tb = Engine.table(d.table);
      if (tb) S().openGuests = tb.seats || 4;
      App.render();
    },
    "cashier.guestStep": (d) => {
      S().openGuests = Math.max(1, (Number(S().openGuests) || 4) + Number(d.d));
      App.render();
    },
    "cashier.openTable": (d) => {
      const st = S();
      const tk = App.commit(() => Engine.openTable(d.table, { guests: st.openGuests || 4, waiterId: st.openWaiter || App.me().id }), "Đã mở bàn");
      if (!tk) return;
      App.render();
      openAddDishModal(tk);
    },
    "cashier.finishClean": (d) => {
      App.commit(() => Engine.markClean(d.table), "Đã chuyển bàn về trạng thái Bàn trống");
      App.render();
    },

    /* ---- Mở lại ca / mở ca mới ---- */
    "cashier.reopenShift": () => {
      const sh = Engine.currentShift();
      if (!sh) return;
      App.commit(() => {
        sh.status = "open";
        delete sh.autoLockedAt;
      }, "Đã mở khóa ca thu ngân");
      App.render();
    },
    "cashier.openShift": () => {
      App.commit(() => Engine.openShift(S().openFloat || 2000000, App.me().id), "Đã mở ca thu ngân mới");
      App.render();
    },

    /* ---- Gọi thêm món & sửa bill ---- */
    "cashier.addDishModal": () => {
      const tk = Engine.ticketByTable(ensureSelectedTable());
      if (tk) openAddDishModal(tk);
    },
    "cashier.addCat": (d) => { S().addCat = d.value; S().addSeaMenuId = ""; App.render(); },
    "cashier.addSeaBack": () => { S().addSeaMenuId = ""; App.render(); },
    "cashier.addSeaMode": (d) => {
      const s = S();
      s.addSeaMode = d.mode === "gram" ? "gram" : "whole";
      if (s.addSeaMode === "gram") s.addBargainOn = false;
      App.render();
    },
    "cashier.addMultiFishToggle": () => {
      const s = S();
      s.addMultiFish = !s.addMultiFish;
      if (!s.addMultiFish && Array.isArray(s.addFishIds) && s.addFishIds.length > 1) {
        s.addFishIds = [s.addFishIds[s.addFishIds.length - 1]];
      }
      App.render();
    },
    "cashier.addToggleFish": (d) => {
      const s = S();
      const cur = Array.isArray(s.addFishIds) ? s.addFishIds.slice() : [];
      if (s.addMultiFish) {
        const idx = cur.indexOf(d.fish);
        if (idx >= 0) cur.splice(idx, 1);
        else cur.push(d.fish);
        s.addFishIds = cur;
      } else {
        s.addFishIds = cur.length === 1 && cur[0] === d.fish ? [] : [d.fish];
      }
      if (s.addBargainOn) {
        const m = Engine.menu(s.addSeaMenuId);
        const fishList = m ? Engine.tankFishList(m.id) : [];
        const selFish = fishList.filter((f) => s.addFishIds.includes(f.id));
        const totalKg = Math.round(selFish.reduce((sum, f) => sum + (Number(f.kg) || 0), 0) * 100) / 100;
        const bg = Engine.evaluateSeafoodBargain(m, totalKg, null, (App.me() || {}).role || "cashier");
        s.addDealAmount = bg.quickDeals[0] || bg.listAmount;
      }
      App.render();
    },
    "cashier.addSourceFish": (d) => { S().addSourceFishId = d.fish; App.render(); },
    "cashier.addPickGram": (d) => {
      const s = S();
      s.addSeaGram = Number(d.gram) || 500;
      s.addSeaKg = Math.round((s.addSeaGram / 1000) * 100) / 100;
      App.render();
    },
    "cashier.addBargainToggle": () => {
      const s = S();
      s.addBargainOn = !s.addBargainOn;
      if (s.addBargainOn) {
        const m = Engine.menu(s.addSeaMenuId);
        const fishList = m ? Engine.tankFishList(m.id) : [];
        const selFish = fishList.filter((f) => (s.addFishIds || []).includes(f.id));
        const totalKg = Math.round(selFish.reduce((sum, f) => sum + (Number(f.kg) || 0), 0) * 100) / 100;
        const bg = Engine.evaluateSeafoodBargain(m, totalKg, null, (App.me() || {}).role || "cashier");
        if (!s.addDealAmount || s.addDealAmount >= bg.listAmount) {
          s.addDealAmount = bg.quickDeals[0] || bg.listAmount;
        }
      }
      App.render();
    },
    "cashier.addDealSet": (d) => { S().addDealAmount = Number(d.v) || 0; App.render(); },
    "cashier.addPickKg": (d) => {
      S().addSeaKg = Number(d.kg) || 0.5;
      S().addSeaGram = Math.round(S().addSeaKg * 1000);
      App.render();
    },
    "cashier.addPickStyle": (d) => { S().addStyleId = d.style || ""; App.render(); },
    "cashier.addSeaConfirm": () => {
      const tk = Engine.ticketByTable(ensureSelectedTable());
      const s = S();
      const m = Engine.menu(s.addSeaMenuId);
      if (!tk || !m) return;
      const isCountable = Engine.isCountableSeafood(m);
      const saleMode = isCountable ? (s.addSeaMode || "whole") : "gram";
      let item;
      if (saleMode === "whole" && isCountable) {
        const fishList = Engine.tankFishList(m.id);
        const selFish = fishList.filter((f) => (s.addFishIds || []).includes(f.id));
        if (!selFish.length) return App.toast("Vui lòng chọn ít nhất 1 con trong bể.", "error");
        const totalKg = Math.round(selFish.reduce((sum, f) => sum + (Number(f.kg) || 0), 0) * 100) / 100;
        let dealAmount = null;
        if (s.addBargainOn && s.addDealAmount) {
          const role = (App.me() || {}).role || "cashier";
          const bg = Engine.evaluateSeafoodBargain(m, totalKg, s.addDealAmount, role);
          if (bg.belowCost && Engine.seafoodPolicy().blockBelowCost && role !== "owner") {
            return App.toast("Giá khách trả thấp hơn giá vốn nhập bể (" + U.money(bg.costAmount) + "). Không thể chốt lỗ.", "error");
          }
          if (bg.discount > 0) dealAmount = bg.dealAmount;
        }
        item = {
          menuId: m.id,
          saleMode: "whole",
          fishIds: selFish.map((f) => f.id),
          fishCodes: selFish.map((f) => f.code + " (" + U.num(f.kg, 2) + " kg)"),
          count: selFish.length,
          kg: totalKg,
          dealAmount,
          styleId: s.addStyleId || (m.styles && m.styles[0]) || "",
          note: s.addNote || "",
        };
      } else {
        const gram = Math.max(Number(Engine.seafoodPolicy().minGram) || 200, Math.round(Number(s.addSeaGram) || 500));
        const totalKg = Math.round((gram / 1000) * 100) / 100;
        item = {
          menuId: m.id,
          saleMode: "gram",
          gram,
          sourceFishId: s.addSourceFishId || null,
          count: 0,
          kg: totalKg,
          styleId: s.addStyleId || (m.styles && m.styles[0]) || "",
          note: s.addNote || "",
        };
      }
      App.commit(
        () => Engine.addItems(tk.id, [item], App.me().id),
        (r) =>
          "Đã thêm " +
          m.name +
          " (" +
          (item.saleMode === "gram" ? item.gram + "g" : U.kg(item.kg)) +
          ") vào bàn" +
          (r && r.pendingBargains ? " · đã gửi Chủ quán duyệt giá ép nguyên con" : "")
      );
      s.addSeaMenuId = "";
      s.addFishIds = [];
      App.render();
    },
    "cashier.addBeerBack": () => {
      S().addBeerMenuId = "";
      App.render();
    },
    "cashier.addBeerSetQty": (d) => {
      S().addBeerQty = Math.max(1, Number(d.q) || 1);
      App.render();
    },
    "cashier.addBeerStep": (d) => {
      const s = S();
      const m = Engine.menu(s.addBeerMenuId);
      const avail = m ? Engine.menuAvailability(m.id) : { maxPortions: 999 };
      const maxStock = Math.max(1, Number(avail.maxPortions) || 999);
      s.addBeerQty = Math.min(maxStock, Math.max(1, (Number(s.addBeerQty) || 1) + Number(d.d)));
      App.render();
    },
    "cashier.addBeerConfirm": () => {
      const s = S();
      const tk = Engine.ticketByTable(ensureSelectedTable());
      const m = Engine.menu(s.addBeerMenuId);
      if (!tk || !m) return;
      const qty = Math.max(1, Number(s.addBeerQty) || (Number(m.caseSize) || 24));
      const caseSize = Number(m.caseSize) || 24;
      const unit = m.unit || "lon";
      const item = { menuId: m.id, qty, note: s.addNote || "" };
      App.commit(
        () => Engine.addItems(tk.id, [item], App.me().id),
        "Đã xuất " + m.name + " (" + Engine.formatBeerCaseQty(qty, caseSize, unit) + ") ra bàn"
      );
      s.addBeerMenuId = "";
      s.addNote = "";
      App.render();
    },
    "cashier.addDishPick": (d) => {
      const tk = Engine.ticketByTable(ensureSelectedTable());
      const m = Engine.menu(d.menu);
      if (!tk || !m) return;
      const avail = Engine.menuAvailability(m.id);
      if (avail.maxPortions <= 0) return App.toast("Món này đã hết nguyên liệu trong kho/bể.", "error");
      if (m.kind === "beer") {
        const s = S();
        s.addBeerMenuId = m.id;
        s.addSeaMenuId = "";
        const caseSize = Number(m.caseSize) || 24;
        s.addBeerQty = Math.min(caseSize, Math.max(1, Number(avail.maxPortions) || caseSize));
        s.addNote = "";
        App.render();
        return;
      }
      if (m.kind === "seafood") {
        const s = S();
        s.addSeaMenuId = m.id;
        s.addBeerMenuId = "";
        const isCountable = Engine.isCountableSeafood(m);
        const fishList = isCountable ? Engine.tankFishList(m.id) : [];
        s.addSeaMode = isCountable ? "whole" : "gram";
        s.addFishIds = [];
        s.addMultiFish = false;
        const defSrc = fishList.find((f) => f.partial) || fishList[0] || null;
        s.addSourceFishId = defSrc ? defSrc.id : "";
        s.addSeaGram = 500;
        s.addSeaKg = 0.5;
        s.addBargainOn = false;
        s.addDealAmount = null;
        s.addStyleId = (m.styles && m.styles[0]) || "";
        s.addNote = "";
        App.render();
        return;
      }
      const item = { menuId: m.id, qty: 1 };
      App.commit(() => Engine.addItems(tk.id, [item], App.me().id), "Đã thêm " + m.name + " vào bàn");
      App.render();
    },
    "cashier.itemStep": (d) => {
      const tk = Engine.ticketByTable(ensureSelectedTable());
      if (!tk) return;
      const it = tk.items.find((x) => x.id === d.item);
      if (!it) return;
      const delta = Number(d.d) || 0;
      const m = Engine.menu(it.menuId) || {};
      const isBeer = it.kind === "beer" || m.kind === "beer";
      if (isBeer && delta < 0) {
        App.commit(
          () => Engine.returnUnusedBeer(tk.id, { itemId: it.id, returnQty: Math.abs(delta), by: App.me().id }),
          (r) =>
            "Đã nhận trả lại " +
            Math.abs(delta) +
            " " +
            (it.unit || m.unit || "lon") +
            " " +
            it.name +
            " chưa khui" +
            (r && r.invalidatedPrebill ? " · Đã hủy hiệu lực phiếu tạm tính cũ & lưu dấu vết sửa sau tạm tính" : "")
        );
        App.render();
        return;
      }
      if (isBeer && delta > 0) {
        App.commit(
          () => {
            it.qty = (Number(it.qty) || 1) + delta;
            it.broughtOutQty = (Number(it.broughtOutQty) || (it.qty - delta)) + delta;
            D().drinks[it.menuId] = Math.max(0, (Number(D().drinks[it.menuId]) || 0) - delta);
            Engine.applyPromos(tk);
            Engine.reconcilePromos(tk);
          },
          null
        );
        App.render();
        return;
      }
      const next = (Number(it.qty) || 1) + delta;
      if (next <= 0) {
        App.commit(() => Engine.requestVoid(tk.id, it.id, "Giảm số lượng về 0", App.me().id), "Đã xử lý xóa món");
      } else {
        App.commit(() => { it.qty = next; }, null);
      }
      App.render();
    },
    "cashier.voidItem": async (d) => {
      const tk = Engine.ticketByTable(ensureSelectedTable());
      if (!tk) return;
      const it = tk.items.find((x) => x.id === d.item);
      if (!it) return;
      const amt = Engine.itemAmount(it);
      const maxVoid = Number((cfg().permissions.cashier || {}).approveVoidUnder) || 200000;
      const isDirect = App.role() === "owner" || (App.role() === "cashier" && amt <= maxVoid);
      const ok = await App.confirm({
        title: "Hủy món " + it.name + " (" + U.money(amt) + ")?",
        message: isDirect
          ? "Trong hạn mức Thu ngân kiêm Quản lý (&le; " + U.money(maxVoid) + "): Món sẽ được hủy ngay và lưu vào nhật ký chống thất thoát."
          : "Giá trị món vượt hạn mức tự hủy của Quản lý ca (&gt; " + U.money(maxVoid) + "): Yêu cầu hủy sẽ được trình Chủ quán phê duyệt.",
        confirm: isDirect ? "Hủy món ngay" : "Gửi Chủ quán duyệt hủy",
        danger: true,
      });
      if (!ok) return;
      const res = App.commit(() => Engine.requestVoid(tk.id, it.id, "Khách đổi ý / Hủy tại quầy", App.me().id), "Đã xử lý hủy món " + it.name);
      if (res && res.done) App.toast("Đã hủy món " + it.name + " trực tiếp tại quầy", "success");
      else App.toast("Món giá trị lớn — Đã trình Chủ quán duyệt hủy", "info");
      App.render();
    },

    /* ---- In tạm tính & khóa/mở khóa bill ---- */
    "cashier.prebill": () => {
      const tk = Engine.ticketByTable(ensureSelectedTable());
      if (!tk) return;
      const job = App.commit(() => Engine.printPrebill(tk.id, App.me().id), "Đã in phiếu tạm tính và khóa bill");
      if (!job) return;
      App.render();
      App.modal({
        title: "Phiếu tạm tính K80 (Đã gửi máy in quầy)",
        sub: "Bill đã tự động chuyển sang trạng thái Khóa chống sửa đổi.",
        size: "sm",
        body: () => UI.receipt(job),
        foot: () => UI.btn("In ra máy in K80", { icon: "printer", act: "app.printK80" }) + UI.btn("Đóng", { kind: "primary", act: "app.closeModal" }),
      });
    },
    "cashier.previewK80": () => {
      const tk = Engine.ticketByTable(ensureSelectedTable());
      if (!tk) return;
      const job = Engine.billDoc(tk, "prebill");
      App.modal({
        title: "Xem trước mẫu in K80",
        size: "sm",
        body: () => UI.receipt(job),
        foot: () => UI.btn("In ra máy in K80", { icon: "printer", act: "app.printK80" }) + UI.btn("Đóng", { kind: "primary", act: "app.closeModal" }),
      });
    },
    "cashier.unlockGrace": (d) => {
      const tk = Engine.ticket(d.id);
      if (!tk) return;
      App.commit(() => {
        tk.status = "open";
      }, "Đã mở khóa bill");
      App.render();
    },
    "cashier.reqUnlock": (d) => {
      const tk = Engine.ticket(d.id);
      const pCash = (cfg().permissions && cfg().permissions.cashier) || {};
      const maxUnlock = Number(pCash.maxSelfUnlockCount) || 1;
      const nextAttempt = ((tk && tk.unlockCount) || 0) + 1;
      const canSelfUnlock = App.role() === "owner" || (App.role() === "cashier" && pCash.reopenBill !== false && nextAttempt <= maxUnlock);
      S().unlockReason = "Khách gọi thêm món / đổi phương thức";
      App.modal({
        title: canSelfUnlock
          ? "Mở khóa bill tạm tính (Quản lý ca · Lần " + nextAttempt + "/" + maxUnlock + ")"
          : "Xin Chủ quán mở khóa bill (Lần " + nextAttempt + ")",
        sub: canSelfUnlock
          ? "Thu ngân kiêm Quản lý được mở khóa trực tiếp trong hạn mức. Lý do mở khóa được lưu vào nhật ký chống thất thoát."
          : "Bill này đã vượt số lần Quản lý ca tự mở khóa (" + maxUnlock + " lần). Cần trình Chủ quán phê duyệt.",
        size: "sm",
        body: () => UI.field("Lý do mở khóa bill đã in tạm tính", UI.textarea({ model: "cashier.unlockReason", value: S().unlockReason })),
        foot: () =>
          UI.btn("Hủy", { act: "app.closeModal" }) +
          UI.btn(canSelfUnlock ? "Mở khóa ngay & Lưu nhật ký" : "Gửi Chủ quán duyệt mở khóa", {
            kind: "primary",
            act: "cashier.reqUnlockSend",
            data: { id: d.id },
          }),
      });
    },
    "cashier.reqUnlockSend": (d) => {
      const r = String(S().unlockReason || "").trim();
      if (!r) return App.toast("Vui lòng nhập lý do mở khóa.", "error");
      const res = App.commit(() => Engine.requestUnlock(d.id, r, App.me().id), "Đã xử lý mở khóa bill");
      App.closeModal();
      if (res && res.done) App.toast("Đã mở khóa bill trực tiếp (Thẩm quyền Quản lý ca)", "success");
      else App.toast("Đã trình Chủ quán duyệt mở khóa bill (vượt hạn mức tự mở)", "info");
      App.render();
    },
    "cashier.ownerQuickUnlock": (d) => {
      App.commit(() => Engine.resolveApproval(d.apId, true, "Duyệt mở khóa tại quầy", App.me().id), "Đã duyệt mở khóa bill");
      App.render();
    },
    "cashier.approveReq": (d) => {
      const ap = D().approvals.find((a) => a.id === d.id);
      if (!ap) return;
      if (!Engine.canApprove(App.me().id, ap)) {
        return App.toast("Yêu cầu này vượt hạn mức Quản lý ca, cần Chủ quán phê duyệt.", "error");
      }
      App.commit(() => Engine.resolveApproval(d.id, true, "Thu ngân kiêm Quản lý duyệt nhanh tại quầy", App.me().id), "Đã duyệt: " + ap.title);
      App.toast("Đã duyệt: " + ap.title, "success");
      App.render();
    },
    "cashier.rejectReq": (d) => {
      const ap = D().approvals.find((a) => a.id === d.id);
      if (!ap) return;
      S().rejectReason = "Không hợp lệ / yêu cầu kiểm tra lại";
      App.modal({
        title: "Từ chối yêu cầu: " + ap.title,
        size: "sm",
        body: () => UI.field("Lý do từ chối", UI.textarea({ model: "cashier.rejectReason", value: S().rejectReason })),
        foot: () =>
          UI.btn("Hủy", { act: "app.closeModal" }) +
          UI.btn("Xác nhận từ chối", { kind: "danger", act: "cashier.rejectReqConfirm", data: { id: d.id } }),
      });
    },
    "cashier.rejectReqConfirm": (d) => {
      const r = String(S().rejectReason || "").trim();
      if (!r || r.length < 3) return App.toast("Vui lòng nhập lý do từ chối.", "error");
      App.commit(() => Engine.resolveApproval(d.id, false, r, App.me().id), "Đã từ chối yêu cầu");
      App.closeModal();
      App.render();
    },

    /* ---- Giảm giá & Gửi rượu ---- */
    "cashier.discountModal": () => {
      const tk = Engine.ticketByTable(ensureSelectedTable());
      if (!tk) return;
      const maxPct = Number((cfg().permissions.cashier || {}).discountMaxPct) || 10;
      App.modal({
        title: "Áp dụng giảm giá trên bill",
        sub: "Thu ngân được giảm tối đa " + maxPct + "%. Vượt mức này sẽ gửi Chủ quán phê duyệt.",
        size: "sm",
        body: () => {
          const s = S();
          return UI.seg([{ value: "pct", label: "Theo phần trăm (%)" }, { value: "amount", label: "Số tiền (đ)" }], s.discType, "cashier.discType") +
            UI.field(s.discType === "pct" ? "Phần trăm giảm (%)" : "Số tiền giảm (đ)", UI.input({ type: "number", model: "cashier.discVal", value: s.discVal })) +
            UI.field("Lý do giảm giá", UI.input({ model: "cashier.discReason", value: s.discReason }));
        },
        foot: () => UI.btn("Hủy", { act: "app.closeModal" }) + UI.btn("Áp dụng", { kind: "primary", act: "cashier.discountApply", data: { id: tk.id } }),
      });
    },
    "cashier.discType": (d) => { S().discType = d.value; S().discVal = d.value === "pct" ? 5 : 100000; App.render(); },
    "cashier.discountApply": (d) => {
      const s = S();
      const res = App.commit(() => Engine.setDiscount(d.id, s.discType, Number(s.discVal) || 0, s.discReason || "Khuyến mãi", App.me().id));
      if (!res) return;
      App.toast(res.pending ? "Đã gửi yêu cầu giảm giá vượt hạn mức tới Chủ quán" : "Đã cập nhật giảm giá", res.pending ? "info" : "success");
      App.closeModal();
      App.render();
    },
    "cashier.bottleModal": () => {
      const tk = Engine.ticketByTable(ensureSelectedTable());
      if (!tk) return;
      S().btCust = "";
      S().btPhone = "";
      S().btWine = "Chivas 18 (700ml)";
      S().btPct = 60;
      App.modal({
        title: "Tạo thẻ gửi rượu (Bottle-Keep)",
        size: "sm",
        body: () => {
          const s = S();
          return UI.field("Tên khách gửi rượu", UI.input({ model: "cashier.btCust", value: s.btCust, placeholder: "Anh Hùng..." })) +
            UI.field("Số điện thoại nhận mã OTP", UI.input({ model: "cashier.btPhone", value: s.btPhone, placeholder: "090..." })) +
            UI.field("Tên chai rượu", UI.input({ model: "cashier.btWine", value: s.btWine })) +
            UI.field("Lượng rượu còn lại (%)", UI.input({ type: "number", model: "cashier.btPct", value: s.btPct }));
        },
        foot: () => UI.btn("Hủy", { act: "app.closeModal" }) + UI.btn("Tạo thẻ & In tem dán chai", { kind: "primary", icon: "printer", act: "cashier.bottleSave", data: { table: tk.tableId } }),
      });
    },
    "cashier.bottleSave": (d) => {
      const s = S();
      if (!s.btCust || !s.btPhone) return App.toast("Nhập tên và số điện thoại khách gửi.", "error");
      const bt = App.commit(() => Engine.createBottleKeep({ name: s.btCust, phone: s.btPhone, wine: s.btWine, remainingPct: Number(s.btPct) || 50, tableId: d.table, by: App.me().id }), "Đã tạo thẻ gửi rượu và in tem dán chai");
      if (!bt) return;
      App.closeModal();
      App.render();
    },

    /* ---- Tách bill (F4) & Chuyển bàn (F6) ---- */
    "cashier.splitModal": () => {
      const tk = Engine.ticketByTable(ensureSelectedTable());
      if (!tk) return;
      S().splitSel = {};
      const freeTables = cfg().tables.filter((t) => Engine.tableStatus(t).status === "empty");
      S().transferTarget = (freeTables[0] || {}).id || "";
      App.modal({
        title: "Tách bill sang bàn khác (F4)",
        body: () => {
          const s = S();
          const items = tk.items.filter((i) => i.status !== "void" && i.status !== "voided" && !i.isFree && !i.promoFree);
          return UI.field("Chọn bàn nhận các món tách ra", UI.select({ model: "cashier.transferTarget", value: s.transferTarget, options: freeTables.map((t) => ({ value: t.id, label: "Bàn " + t.code + " (" + t.seats + " chỗ)" })) })) +
            '<div class="col gap-8">' + items.map((it) => {
              const checked = !!s.splitSel[it.id];
              return '<label class="row between py-4 border-b" style="cursor:pointer"><div><b>' + esc(it.name) + '</b><div class="small muted">Số lượng: ' + (it.kg ? U.kg(it.kg) : it.qty) + " · " + U.money(Engine.itemAmount(it)) + "</div></div>" +
                '<input type="checkbox" data-act="cashier.splitToggle" data-item="' + it.id + '"' + (checked ? " checked" : "") + "></label>";
            }).join("") + "</div>";
        },
        foot: () => UI.btn("Hủy", { act: "app.closeModal" }) + UI.btn("Tách sang bàn mới", { kind: "primary", act: "cashier.splitConfirm", data: { id: tk.id } }),
      });
    },
    "cashier.splitToggle": (d, el) => {
      S().splitSel[d.item] = !!(el ? el.checked : !S().splitSel[d.item]);
      App.render();
    },
    "cashier.splitConfirm": (d) => {
      const s = S();
      const map = s.splitSel || {};
      const itemIds = Object.keys(map).filter((k) => map[k]);
      if (!itemIds.length) return App.toast("Chọn ít nhất 1 món để tách bill.", "error");
      if (!s.transferTarget) return App.toast("Chọn bàn đích để tách sang.", "error");
      const newTk = App.commit(() => {
        const nt = Engine.splitByItems(d.id, itemIds);
        if (s.transferTarget && s.transferTarget !== nt.tableId) {
          Engine.transferTable(nt.id, s.transferTarget);
        }
        return nt;
      }, "Đã tách bill sang bàn mới");
      if (!newTk) return;
      S().tableId = s.transferTarget;
      App.closeModal();
      App.render();
    },
    "cashier.transferModal": () => {
      const tk = Engine.ticketByTable(ensureSelectedTable());
      if (!tk) return;
      const others = cfg().tables.filter((t) => t.id !== tk.tableId);
      S().transferTarget = (others[0] || {}).id || "";
      App.modal({
        title: "Chuyển bàn hoặc Ghép bàn (F6)",
        size: "sm",
        body: () => UI.field("Chọn bàn chuyển tới (nếu bàn đích đang có khách sẽ tự động ghép chung bill)", UI.select({
          model: "cashier.transferTarget",
          value: S().transferTarget,
          options: others.map((t) => {
            const stt = Engine.tableStatus(t);
            return { value: t.id, label: "Bàn " + t.code + " · " + stt.label };
          }),
        })),
        foot: () => UI.btn("Hủy", { act: "app.closeModal" }) + UI.btn("Xác nhận chuyển/ghép", { kind: "primary", act: "cashier.transferConfirm", data: { id: tk.id } }),
      });
    },
    "cashier.transferConfirm": (d) => {
      const target = S().transferTarget;
      if (!target) return;
      const destTk = Engine.ticketByTable(target);
      const res = App.commit(() => (destTk ? Engine.mergeTickets(d.id, destTk.id) : Engine.transferTable(d.id, target)), destTk ? "Đã ghép chung bill với bàn đích" : "Đã chuyển bàn thành công");
      if (!res) return;
      S().tableId = target;
      App.closeModal();
      App.render();
    },

    /* ---- Thanh toán (F9) ---- */
    "cashier.payModal": () => {
      const tk = Engine.ticketByTable(ensureSelectedTable());
      if (tk) openPayModal(tk);
    },
    "cashier.payMethod": (d) => { S().payMethod = d.value; App.render(); },
    "cashier.cashQuick": (d) => { S().cashGiven = Number(d.v) || 0; App.render(); },
    "cashier.qrQuick": (d) => { S().qrReceived = Number(d.v) || 0; App.render(); },
    "cashier.evenStep": (d) => { S().evenPeople = Math.max(2, (Number(S().evenPeople) || 2) + Number(d.d)); App.render(); },
    "cashier.simulateWebhook": (d) => {
      const tk = Engine.ticket(d.id);
      if (!tk) return;
      const s = S();
      const payCode = Engine.ensurePayCode(tk);
      const tot = Engine.totals(tk);
      const need = Math.max(0, tot.due !== undefined ? tot.due : tot.grand - tot.deposit - (tot.paid || 0));
      const amt = Math.max(1000, Number(s.qrReceived) || need);
      const res = App.commit(
        () =>
          Engine.processPaymentWebhook({
            ticketId: tk.id,
            amount: amt,
            content: payCode,
            tipMode: s.payTipMode || "personal",
            tipStaffId: tk.waiterId,
            by: App.me().id,
          }),
        (r) =>
          r.partial
            ? "Đã ghi nhận chuyển khoản 1 phần " + U.money(r.received) + " · Còn thiếu " + U.money(r.remaining)
            : "THANH TOÁN QR THÀNH CÔNG (Tự động khớp " +
              r.sale.payCode +
              "): " +
              U.money(r.receivedTotal || r.received) +
              (r.tip > 0 ? " · Tip +" + U.money(r.tip) + " (" + (Engine.TIP_MODES[r.sale.tipMode] || r.sale.tipMode) + ")" : "")
      );
      if (!res) return;
      if (res.partial) {
        s.qrReceived = res.remaining;
        s.cashGiven = res.remaining;
        App.render();
        return;
      }
      App.closeModal();
      App.render();
    },
    "cashier.editStaffAssignModal": (d) => {
      const w = Engine.staff(d.staff);
      if (!w) return;
      const s = S();
      s._assignStaffId = w.id;
      s._assignAreas = (w.assignedAreas || []).slice();
      s._assignTables = (w.assignedTables || []).slice();
      App.modal({
        title: "Phân công khu vực & bàn cho " + w.name,
        sub: "Thu ngân kiêm Quản lý điều phối bàn cố định hoặc theo khu cho nhân viên phục vụ",
        size: "lg",
        body: () => {
          const st = S();
          const areas = cfg().areas || [];
          const tables = cfg().tables || [];
          return '<div class="col gap-12">' +
            '<div><div class="small strong mb-6">1. Chọn khu vực phụ trách (chạm để bật/tắt):</div><div class="chips">' +
            areas.map((a) => {
              const on = (st._assignAreas || []).includes(a.id);
              return '<button type="button" class="chip ' + (on ? "active" : "") + '" data-act="cashier.toggleStaffArea" data-area="' + a.id + '">' + esc(a.name) + "</button>";
            }).join("") +
            "</div></div>" +
            '<div><div class="small strong mb-6">2. Chọn các bàn cụ thể giao cho ' + esc(w.name) + ' quản lý (' + (st._assignTables || []).length + ' bàn):</div>' +
            '<div class="chips" style="flex-wrap:wrap">' +
            tables.map((t) => {
              const on = (st._assignTables || []).includes(t.id);
              return '<button type="button" class="chip ' + (on ? "active" : "") + '" data-act="cashier.toggleStaffTable" data-table="' + t.id + '">' + esc(t.code) + "</button>";
            }).join("") +
            "</div></div>" +
            UI.banner("info", "info", "Khi khách mở bàn thuộc danh sách trên, hệ thống tự động gán <b>" + esc(w.name) + "</b> phụ trách và nhận thông báo món / tiền Tip của bàn đó.") +
            "</div>";
        },
        foot: () => UI.btn("Hủy", { act: "app.closeModal" }) + UI.btn("Lưu phân công bàn", { kind: "primary", icon: "check", act: "cashier.saveStaffAssign" }),
      });
    },
    "cashier.toggleStaffArea": (d) => {
      const s = S();
      s._assignAreas = s._assignAreas || [];
      const idx = s._assignAreas.indexOf(d.area);
      if (idx >= 0) s._assignAreas.splice(idx, 1);
      else s._assignAreas.push(d.area);
      App.render();
    },
    "cashier.toggleStaffTable": (d) => {
      const s = S();
      s._assignTables = s._assignTables || [];
      const idx = s._assignTables.indexOf(d.table);
      if (idx >= 0) s._assignTables.splice(idx, 1);
      else s._assignTables.push(d.table);
      App.render();
    },
    "cashier.saveStaffAssign": () => {
      const s = S();
      const w = Engine.staff(s._assignStaffId);
      if (!w) return;
      App.commit(
        () => Engine.updateStaffAssignments(w.id, { assignedAreas: s._assignAreas, assignedTables: s._assignTables }, App.me().id),
        "Đã cập nhật phân công bàn cho " + w.name
      );
      App.closeModal();
      App.render();
    },
    "cashier.payConfirm": (d) => {
      const tk = Engine.ticket(d.id);
      if (!tk) return;
      const tot = Engine.totals(tk);
      const need = Math.max(0, tot.due !== undefined ? tot.due : tot.grand - tot.deposit - (tot.paid || 0));
      const s = S();
      let payments = [{ method: "cash", amount: Math.max(need, Number(s.cashGiven) || need) }];
      if (s.payMethod === "qr") {
        payments = [{ method: "qr", amount: Math.max(need, Number(s.qrReceived) || need) }];
      } else if (s.payMethod === "split_pay") {
        const cash = Math.min(need, Math.max(0, Number(s.splitCash) || 0));
        payments = [
          { method: "cash", amount: cash },
          { method: "qr", amount: Math.max(0, need - cash) },
        ];
      } else if (s.payMethod === "even") {
        payments = [{ method: "cash", amount: need }];
      }
      const res = App.commit(() => Engine.pay(tk.id, { payments, overAsTip: true, tipMode: s.payTipMode || "personal", by: App.me().id }), "Đã hoàn tất thanh toán và in hóa đơn");
      if (!res) return;
      App.closeModal();
      App.render();
      const job = D().printLog.find((p) => p.saleId === res.id) || D().printLog[0];
      if (job) {
        App.modal({
          title: "Hóa đơn thanh toán K80",
          sub: "Đã mở két tiền và in mã QR tự xuất hóa đơn VAT trong 24h.",
          size: "sm",
          body: () => UI.receipt(job),
          foot: () => UI.btn("In ra máy in K80", { icon: "printer", act: "app.printK80" }) + UI.btn("Hoàn tất", { kind: "primary", act: "app.closeModal" }),
        });
      }
    },

    /* ---- Đặt bàn trước ---- */
    "cashier.bookingNew": () => {
      const s = S();
      s.bkName = "";
      s.bkPhone = "";
      s.bkGuests = 6;
      s.bkDay = U.dayKey();
      s.bkTime = "19:00";
      s.bkArea = (cfg().areas[0] || {}).id || "ar_garden";
      s.bkDeposit = cfg().booking.depositNormal || 200000;
      s.bkNote = "";
      App.modal({
        title: "Nhận đặt bàn mới qua điện thoại / tại quầy",
        body: () => {
          const st = S();
          return '<div class="grid-2">' +
            UI.field("Tên khách đặt", UI.input({ model: "cashier.bkName", value: st.bkName, placeholder: "Anh Tuấn..." })) +
            UI.field("Số điện thoại", UI.input({ model: "cashier.bkPhone", value: st.bkPhone, placeholder: "090..." })) +
            UI.field("Ngày hẹn đến", UI.input({ type: "date", model: "cashier.bkDay", value: st.bkDay, min: U.dayKey() })) +
            UI.field("Giờ hẹn đến", UI.input({ type: "time", model: "cashier.bkTime", value: st.bkTime })) +
            UI.field("Số lượng khách", UI.input({ type: "number", model: "cashier.bkGuests", value: st.bkGuests })) +
            UI.field("Khu vực ưu tiên", UI.select({ model: "cashier.bkArea", value: st.bkArea, options: cfg().areas.map((a) => ({ value: a.id, label: a.name })) })) +
            UI.field("Tiền cọc (đ)", UI.input({ type: "number", model: "cashier.bkDeposit", value: st.bkDeposit })) +
            UI.field("Ghi chú", UI.input({ model: "cashier.bkNote", value: st.bkNote, placeholder: "Có trẻ em, cần ghế phụ..." })) +
            "</div>";
        },
        foot: () => UI.btn("Hủy", { act: "app.closeModal" }) + UI.btn("Tạo phiếu đặt bàn", { kind: "primary", act: "cashier.bookingCreate" }),
      });
    },
    "cashier.bookingCreate": () => {
      const s = S();
      if (!s.bkName || !s.bkPhone) return App.toast("Nhập tên và số điện thoại khách.", "error");
      const bk = App.commit(() => Engine.createBooking({
        name: s.bkName,
        phone: s.bkPhone,
        guests: Number(s.bkGuests) || 4,
        dayKey: s.bkDay || U.dayKey(),
        time: s.bkTime || "19:00",
        areaId: s.bkArea,
        deposit: s.bkDeposit !== undefined && s.bkDeposit !== "" ? Number(s.bkDeposit) : undefined,
        note: s.bkNote || "",
        source: "cashier",
      }), "Đã tạo lịch đặt bàn");
      if (!bk) return;
      App.closeModal();
      App.render();
    },
    "cashier.bkConfirm": (d) => {
      App.commit(() => Engine.confirmDeposit(d.id), "Đã xác nhận nhận tiền cọc");
      App.render();
    },
    "cashier.bkCancel": (d) => {
      App.commit(() => Engine.cancelBooking(d.id, "Hủy tại quầy"), "Đã hủy lịch đặt bàn");
      App.render();
    },
    "cashier.bkSeat": (d) => {
      const b = D().bookings.find((x) => x.id === d.id);
      if (!b) return;
      const tbId = d.table || b.tableId || (cfg().tables.find((t) => t.areaId === b.areaId && Engine.tableStatus(t).status === "empty") || cfg().tables.find((t) => Engine.tableStatus(t).status === "empty") || {}).id;
      if (!tbId) return App.toast("Không còn bàn trống để xếp khách.", "error");
      const tk = App.commit(() => Engine.openTable(tbId, { bookingId: b.id, guests: b.guests, waiterId: App.me().id }), "Đã nhận khách vào bàn");
      if (!tk) return;
      S().tableId = tbId;
      S().leftTab = "floor";
      App.render();
    },
    "cashier.bkNoShow": (d) => {
      const b = D().bookings.find((x) => x.id === d.id);
      if (!b) return;
      App.commit(() => {
        b.status = "noshow";
        if (b.deposit && b.depositPaid) {
          Engine.createApproval({
            type: "noshow_deposit",
            by: App.me().id,
            ref: b.id,
            title: "Khách không đến: " + b.name,
            amount: b.deposit,
            reason: "Khách không đến theo lịch hẹn " + b.time,
          });
        }
      }, "Đã đánh dấu khách không đến và chuyển Chủ quán duyệt cọc");
      App.render();
    },

    /* ---- Hóa đơn đã thu & VAT ---- */
    "cashier.reprintBill": (d) => {
      const s = Engine.saleById(d.id);
      if (!s) return;
      const logged = D().printLog.find((p) => p.saleId === s.id);
      const doc = logged || {
        kind: "receipt",
        title: "HÓA ĐƠN THANH TOÁN (BẢN SAO)",
        header: [cfg().store.name, cfg().store.address, "ĐT: " + cfg().store.phone],
        meta: [{ l: "Bàn", r: s.tableCode || s.tableId }, { l: "Giờ đóng", r: U.time(s.closedAt) }, { l: "Số khách", r: String(s.guests || 4) }],
        rows: (s.lines || []).map((ln) => ({ l: (ln.kg ? U.num(ln.kg, 2) + "kg " : ln.qty + "x ") + ln.name, r: U.moneyPlain(ln.amount) })),
        sumRows: [{ l: "TỔNG CỘNG", r: U.moneyPlain(s.grand), bold: true }],
        qr: cfg().receipt.showQr && Engine.invoiceQrUrl ? Engine.invoiceQrUrl(s.id) : null,
        qrLabel: cfg().receipt.footer,
        saleId: s.id,
      };
      App.modal({
        title: "Bản sao hóa đơn thanh toán",
        size: "sm",
        body: () => UI.receipt(doc),
        foot: () => UI.btn("In ra máy in K80", { icon: "printer", act: "app.printK80" }) + UI.btn("Đóng", { kind: "primary", act: "app.closeModal" }),
      });
    },
    "cashier.issueVat": (d) => {
      S().vatCo = "";
      S().vatTax = "";
      S().vatAddr = "";
      S().vatEmail = "";
      App.modal({
        title: "Phát hành hóa đơn điện tử GTGT",
        size: "sm",
        body: () => {
          const s = S();
          return UI.field("Tên công ty / đơn vị", UI.input({ model: "cashier.vatCo", value: s.vatCo, placeholder: "Công ty TNHH..." })) +
            UI.field("Mã số thuế (10 hoặc 13 chữ số)", UI.input({ model: "cashier.vatTax", value: s.vatTax, placeholder: "0301234567" })) +
            UI.field("Địa chỉ", UI.input({ model: "cashier.vatAddr", value: s.vatAddr })) +
            UI.field("Email nhận hóa đơn", UI.input({ model: "cashier.vatEmail", value: s.vatEmail, placeholder: "ketoan@congty.vn" }));
        },
        foot: () => UI.btn("Hủy", { act: "app.closeModal" }) + UI.btn("Phát hành ngay", { kind: "primary", act: "cashier.issueVatConfirm", data: { id: d.id } }),
      });
    },
    "cashier.issueVatConfirm": (d) => {
      const s = S();
      if (!s.vatCo || !s.vatTax) return App.toast("Nhập tên đơn vị và mã số thuế.", "error");
      const ei = App.commit(() => Engine.requestEInvoice({ saleId: d.id, company: s.vatCo, taxCode: s.vatTax, address: s.vatAddr, email: s.vatEmail || "ketoan@congty.vn" }), "Đã phát hành hóa đơn điện tử GTGT");
      if (!ei) return;
      App.closeModal();
      App.render();
    },

    /* ---- Két tiền mặt & Chốt ca Z-Report ---- */
    "cashier.drawer": () => openDrawerModal(),
    "cashier.drawerTab": (d) => { S().drawerTab = d.value; App.render(); },
    "cashier.pettySubmit": () => {
      const s = S();
      if (!s.pettyReason) return App.toast("Nhập nội dung chi tiền vặt.", "error");
      const r = App.commit(() => { Engine.addPetty(Number(s.pettyAmt) || 0, s.pettyReason, App.me().id); return true; }, "Đã ghi phiếu chi tiền vặt");
      if (!r) return;
      s.pettyReason = "";
      App.render();
    },
    "cashier.tipSubmit": () => {
      const s = S();
      const r = App.commit(() => { Engine.payoutTip(s.tipStaff, Number(s.tipAmt) || 0, App.me().id); return true; }, "Đã chi trả tiền tip từ két");
      if (r) App.render();
    },
    "cashier.payAdvanceNow": (d) => {
      App.commit(() => { Engine.payAdvance(d.id, App.me().id); return true; }, "Đã chi tiền mặt ứng lương cho nhân viên");
      App.render();
    },
    "cashier.printLog": () => {
      const logs = D().printLog.slice(0, 12);
      App.modal({
        title: "Nhật ký lệnh in nhiệt K80 (" + D().printLog.length + ")",
        size: "lg",
        body: () => logs.length
          ? '<div class="print-log">' + logs.map((p, idx) => '<div class="col gap-4"><div class="row between items-center small muted"><span>' + U.dateTime(p.at) + " · " + esc(p.printerName || "") + (p.rerouted ? " (Chuyển dự phòng từ " + esc(p.rerouted) + ")" : "") + (p.superseded ? ' <span class="badge badge-danger">HẾT HIỆU LỰC</span>' : "") + "</span>" + UI.btn("In lại K80", { size: "xs", icon: "printer", act: "app.printK80", data: { idx } }) + "</div>" + UI.receipt(p) + "</div>").join("") + "</div>"
          : UI.empty("printer", "Chưa có lệnh in nào"),
        foot: () => UI.btn("Đóng", { kind: "primary", act: "app.closeModal" }),
      });
    },
    "cashier.zReport": () => openZReportModal(),
    "cashier.zNext": (d) => { S().zStep = Number(d.step) || 1; App.render(); },
    "cashier.zDenom": (d, el) => {
      S().zDenoms[d.d] = Math.max(0, Number(el.value) || 0);
      App.render();
    },
    "cashier.zFillExact": (d) => {
      let rem = Math.max(0, Math.round(Number(d.expected) || 0));
      const map = {};
      DENOMS.forEach((denom) => {
        const cnt = Math.floor(rem / denom);
        if (cnt > 0) {
          map[denom] = cnt;
          rem -= cnt * denom;
        }
      });
      S().zDenoms = map;
      App.render();
    },
    "cashier.zSubmit": () => {
      const s = S();
      const sh = Engine.currentShift();
      if (!sh) return;
      const ss = Engine.shiftStats(sh);
      const counted = DENOMS.reduce((acc, d) => acc + d * (Number(s.zDenoms[d]) || 0), 0);
      if (counted !== ss.expected && !String(s.zNote || "").trim()) {
        return App.toast("Vui lòng nhập lý do giải trình chênh lệch tiền mặt.", "error");
      }
      const z = App.commit(() => Engine.closeShift({ counted, denominations: s.zDenoms, note: s.zNote || "Khớp tiền mặt cuối ca", force: true, by: App.me().id }), "Đã chốt ca và khóa sổ Z-Report");
      if (!z) return;
      App.closeModal();
      App.render();
    },
    "cashier.resolveOverpaid": (d) => {
      const mode = d.mode === "tip" ? "tip" : "refund";
      const res = App.commit(
        () => Engine.resolveOverpaidWebhook(d.id, mode, App.me().id),
        mode === "tip" ? "Đã cộng khoản chuyển dư vào tiền Tip cho nhân viên" : "Đã xác nhận hoàn tiền chuyển trùng cho khách"
      );
      if (res) App.render();
    },

    /* ---- Trả lại bia dư theo lon / chai chưa khui tại quầy Thu ngân ---- */
    "cashier.returnBeerModal": (d) => {
      const tk = Engine.ticketByTable(ensureSelectedTable());
      if (!tk) return;
      const beerMenuIds = [];
      tk.items.forEach((it) => {
        const m = Engine.menu(it.menuId) || {};
        if (it.status !== "void" && !it.voided && !it.isFree && !it.promo && (it.kind === "beer" || m.kind === "beer") && Number(it.qty) > 0 && !beerMenuIds.includes(it.menuId)) {
          beerMenuIds.push(it.menuId);
        }
      });
      if (!beerMenuIds.length) return App.toast("Bàn này chưa có bia để trả lại.", "info");
      let targetMenuId = d.menu || beerMenuIds[0];
      if (d.item) {
        const line = tk.items.find((x) => x.id === d.item);
        if (line && line.menuId) targetMenuId = line.menuId;
      }
      const sum = Engine.beerSummaryOnTicket(tk, targetMenuId);
      const s = S();
      s.retBeerTicketId = tk.id;
      s.retBeerMenuId = targetMenuId;
      s.retBeerMode = "return";
      s.retBeerReturnQty = Math.min(4, Math.max(1, sum.billedQty - 1 || 1));
      s.retBeerConsumedQty = Math.max(0, sum.billedQty - s.retBeerReturnQty);
      s.retBeerNote = "";

      const tb = Engine.table(tk.tableId);
      App.modal({
        title: "Trả bia dư chưa khui · Bàn " + (tb ? tb.code : tk.tableId),
        sub: "Trừ trực tiếp số lon/chai bia nguyên vẹn khách không uống hết trên bill, hoàn kho bia tại quầy và tự động tính lại khuyến mãi.",
        size: "md",
        body: () => {
          const curTk = Engine.ticket(s.retBeerTicketId) || tk;
          const m = Engine.menu(s.retBeerMenuId);
          const curSum = Engine.beerSummaryOnTicket(curTk, s.retBeerMenuId);
          const unit = curSum.unit || (m && m.unit) || "lon";
          const caseSize = curSum.caseSize || (m && m.caseSize) || 24;
          const price = Number(m && m.price) || 0;
          const mode = s.retBeerMode || "return";
          const maxRet = Math.max(0, curSum.billedQty);
          const retQty = mode === "consumed"
            ? Math.max(0, maxRet - Math.min(maxRet, Math.max(0, Number(s.retBeerConsumedQty) || 0)))
            : Math.min(maxRet, Math.max(0, Number(s.retBeerReturnQty) || 0));
          const remainBilled = Math.max(0, maxRet - retQty);
          const deductAmt = retQty * price;

          const brandPicker = beerMenuIds.length > 1
            ? '<div class="field"><label>Chọn loại bia trên bàn</label><div class="chips">' +
              beerMenuIds.map((mid) => {
                const bm = Engine.menu(mid);
                const bsum = Engine.beerSummaryOnTicket(curTk, mid);
                return '<button type="button" class="chip' + (s.retBeerMenuId === mid ? " active" : "") + '" data-act="cashier.retBeerMenu" data-menu="' + mid + '">' + esc(bm ? bm.name : mid) + " (" + bsum.billedQty + " " + bsum.unit + ")</button>";
              }).join("") +
              "</div></div>"
            : "";

          const quickRet = [1, 2, 3, 4, 6, 8, 10, 12, 18, 24].filter((q) => q <= maxRet);
          const quickConsumed = [6, 10, 12, 15, 16, 18, 20, 22].filter((q) => q < maxRet);
          const wasPrebilled = curTk.status === "locked" || !!curTk.prebillAt;

          return '<div class="col gap-12">' +
            (wasPrebilled
              ? UI.banner(
                  "warning",
                  "triangle-alert",
                  "<b>Bill đã in tạm tính:</b> Khi trả bia dư, <b>phiếu tạm tính cũ sẽ tự động bị đánh dấu hết hiệu lực</b>, trạng thái bàn chuyển sang <b>Cần in lại tạm tính</b> và hệ thống lưu dấu vết chỉnh sửa riêng (tổng tiền trước/sau) vào nhật ký kiểm soát."
                )
              : "") +
            brandPicker +
            '<div class="card card-pad" style="background:var(--surface-2)">' +
              '<div class="row between wrap gap-8">' +
                '<div><b>' + esc(m ? m.name : "") + '</b><div class="small muted">Đã đem ra bàn: <b>' + Engine.formatBeerCaseQty(curSum.broughtOutQty, caseSize, unit) + '</b>' + (curSum.returnedQty > 0 ? ' · Đã trả trước đó: <b>' + curSum.returnedQty + ' ' + esc(unit) + '</b>' : '') + '</div></div>' +
                '<div class="right"><div class="small muted">Đang tính tiền</div><b class="num" style="font-size:16px">' + curSum.billedQty + ' ' + esc(unit) + ' (' + U.money(curSum.billedQty * price) + ')</b></div>' +
              '</div>' +
            '</div>' +
            '<div class="seg" style="display:grid;grid-template-columns:1fr 1fr;gap:6px">' +
              '<button type="button" class="' + (mode === "return" ? "active" : "") + '" data-act="cashier.retBeerMode" data-mode="return">Nhập số ' + esc(unit) + ' trả lại</button>' +
              '<button type="button" class="' + (mode === "consumed" ? "active" : "") + '" data-act="cashier.retBeerMode" data-mode="consumed">Nhập số ' + esc(unit) + ' thực uống</button>' +
            '</div>' +
            (mode === "return"
              ? '<div class="field"><label>Số ' + esc(unit) + ' bia chưa khui trả lại quầy (tối đa ' + maxRet + ' ' + esc(unit) + ')</label>' +
                '<div class="chips mb-8">' +
                  quickRet.map((q) => '<button type="button" class="chip' + (retQty === q ? " active" : "") + '" data-act="cashier.retBeerQuick" data-q="' + q + '">Trả ' + q + ' ' + esc(unit) + (q === 12 ? " (Nửa thùng)" : q === 24 ? " (1 thùng)" : "") + '</button>').join("") +
                '</div>' +
                '<div class="row between wrap gap-8">' +
                  '<div class="stepper">' +
                    '<button type="button" data-act="cashier.retBeerStep" data-d="-1">-</button>' +
                    '<span>Trả ' + retQty + ' ' + esc(unit) + '</span>' +
                    '<button type="button" data-act="cashier.retBeerStep" data-d="1">+</button>' +
                  '</div>' +
                  '<div style="width:160px">' + UI.input({ type: "number", min: 1, max: maxRet, model: "cashier.retBeerReturnQty", live: true, value: retQty }) + '</div>' +
                '</div></div>'
              : '<div class="field"><label>Số ' + esc(unit) + ' khách thực tế đã khui uống (trong tổng ' + maxRet + ' ' + esc(unit) + ')</label>' +
                (quickConsumed.length
                  ? '<div class="chips mb-8">' +
                    quickConsumed.map((q) => '<button type="button" class="chip' + (( maxRet - retQty ) === q ? " active" : "") + '" data-act="cashier.retBeerQuick" data-q="' + q + '">Uống ' + q + ' ' + esc(unit) + ' (Trả ' + (maxRet - q) + ')</button>').join("") +
                    '</div>'
                  : '') +
                '<div class="row between wrap gap-8">' +
                  '<div class="stepper">' +
                    '<button type="button" data-act="cashier.retBeerStep" data-d="-1">-</button>' +
                    '<span>Uống ' + (maxRet - retQty) + ' ' + esc(unit) + '</span>' +
                    '<button type="button" data-act="cashier.retBeerStep" data-d="1">+</button>' +
                  '</div>' +
                  '<div style="width:160px">' + UI.input({ type: "number", min: 0, max: maxRet, model: "cashier.retBeerConsumedQty", live: true, value: maxRet - retQty }) + '</div>' +
                '</div></div>') +
            '<div class="card card-pad" style="background:var(--surface-2);border:1px solid var(--border)">' +
              '<div class="row between mb-4"><span>Trả lại kho bia:</span><b class="text-success">+' + retQty + ' ' + esc(unit) + ' (-' + U.money(deductAmt) + ')</b></div>' +
              '<div class="row between"><span>Còn tính tiền trên bill:</span><b class="text-primary num">' + remainBilled + ' ' + esc(unit) + ' · ' + U.money(remainBilled * price) + '</b></div>' +
            '</div>' +
            UI.field("Ghi chú (tùy chọn)", UI.input({ model: "cashier.retBeerNote", value: s.retBeerNote, placeholder: "Ví dụ: Bia còn nguyên nắp, thu hồi về tủ mát..." })) +
          '</div>';
        },
        foot: () =>
          UI.btn("Hủy", { act: "app.closeModal" }) +
          UI.btn("Xác nhận trả bia dư & Trừ bill", { kind: "primary", icon: "check", act: "cashier.retBeerSubmit" }),
      });
    },
    "cashier.retBeerMenu": (d) => {
      const s = S();
      s.retBeerMenuId = d.menu;
      const tk = Engine.ticket(s.retBeerTicketId);
      const sum = Engine.beerSummaryOnTicket(tk, d.menu);
      s.retBeerReturnQty = Math.min(4, Math.max(1, sum.billedQty - 1 || 1));
      s.retBeerConsumedQty = Math.max(0, sum.billedQty - s.retBeerReturnQty);
      App.render();
    },
    "cashier.retBeerMode": (d) => {
      const s = S();
      const tk = Engine.ticket(s.retBeerTicketId);
      const sum = Engine.beerSummaryOnTicket(tk, s.retBeerMenuId);
      s.retBeerMode = d.mode === "consumed" ? "consumed" : "return";
      if (s.retBeerMode === "consumed") {
        s.retBeerConsumedQty = Math.max(0, sum.billedQty - (Number(s.retBeerReturnQty) || 0));
      } else {
        s.retBeerReturnQty = Math.max(1, sum.billedQty - (Number(s.retBeerConsumedQty) || 0));
      }
      App.render();
    },
    "cashier.retBeerQuick": (d) => {
      const s = S();
      const q = Math.max(0, Number(d.q) || 0);
      if (s.retBeerMode === "consumed") s.retBeerConsumedQty = q;
      else s.retBeerReturnQty = q;
      App.render();
    },
    "cashier.retBeerStep": (d) => {
      const s = S();
      const tk = Engine.ticket(s.retBeerTicketId);
      const sum = Engine.beerSummaryOnTicket(tk, s.retBeerMenuId);
      const delta = Number(d.d) || 0;
      if (s.retBeerMode === "consumed") {
        s.retBeerConsumedQty = Math.min(sum.billedQty, Math.max(0, (Number(s.retBeerConsumedQty) || 0) + delta));
      } else {
        s.retBeerReturnQty = Math.min(sum.billedQty, Math.max(1, (Number(s.retBeerReturnQty) || 1) + delta));
      }
      App.render();
    },
    "cashier.retBeerSubmit": () => {
      const s = S();
      const tk = Engine.ticket(s.retBeerTicketId);
      if (!tk) return;
      const sum = Engine.beerSummaryOnTicket(tk, s.retBeerMenuId);
      const retQty = s.retBeerMode === "consumed"
        ? Math.max(0, sum.billedQty - Math.max(0, Number(s.retBeerConsumedQty) || 0))
        : Math.max(0, Number(s.retBeerReturnQty) || 0);
      if (retQty <= 0) return App.toast("Số lượng trả lại phải lớn hơn 0.", "error");
      const res = App.commit(
        () => Engine.returnUnusedBeer(tk.id, {
          menuId: s.retBeerMenuId,
          returnQty: retQty,
          note: s.retBeerNote,
          by: App.me().id,
        }),
        (r) =>
          "Đã nhận trả lại " +
          r.returned +
          " " +
          r.unit +
          " " +
          r.menuName +
          " · Trừ bill " +
          U.money(r.deductedAmount) +
          " (Còn tính " +
          r.remainingBilled +
          " " +
          r.unit +
          ")" +
          (r.invalidatedPrebill ? " · Đã hủy hiệu lực phiếu tạm tính cũ & lưu dấu vết sửa sau tạm tính" : "")
      );
      if (!res) return;
      App.closeModal();
      App.render();
    },
  });
})();
