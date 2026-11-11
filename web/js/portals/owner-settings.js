/* =========================================================================
   owner-settings.js - Trang "Cai dat" cua Chu quan (No-Code Settings Studio)
   - Moi chinh sua cau hinh ghi vao BAN NHAP: App.state("settings").draft
   - Chi co hieu luc khi bam "Luu va ap dung" -> Engine.saveConfig (ngay / ca sau / hen gio)
   - Nhan vien (Store.data.staff) la du lieu van hanh -> luu ngay qua App.commit
   - Dang ky: OwnerPages.settings.render() -> owner.js chen vao vung noi dung
   ========================================================================= */
(function () {
  const I = U.icon, esc = U.esc;
  const P = "settings";
  const DEF = Store.defaultConfig();
  const S = () => App.state(P, { group: "tables", q: "", menuQ: "", menuCat: "all", selTable: null, open: {}, eff: "now", effAt: "", showPins: false, preview: "prebill" });
  const canEdit = () => (App.ownerCanEdit ? !!App.ownerCanEdit() : App.role() === "owner");
  const meId = () => (App.me() || {}).id || "system";
  const cl = (v) => (v === undefined ? undefined : U.clone(v));
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

  let ERR = {}; // loi hop le cua ban nhap (tinh lai moi lan ve)
  let CHG = []; // danh sach thay doi chua luu

  /* =====================================================================
     BAN NHAP
     ===================================================================== */
  function hashStr(s) {
    let h = 5381;
    for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
    return String(h);
  }
  const cfgHash = () => hashStr(JSON.stringify(Store.config));
  function draft() {
    const st = S();
    const h = cfgHash();
    if (!st.draft || st.baseHash !== h) {
      const had = st.draft && st.baseHash && Engine.diffConfig(Store.config, st.draft).length;
      st.draft = U.clone(Store.config);
      st.baseHash = h;
      if (had) setTimeout(() => App.toast("Cài đặt vừa được cập nhật (khôi phục hoặc áp dụng theo lịch). Bản nháp đã được làm mới.", "info"), 0);
    }
    return st.draft;
  }
  function resetDraft() {
    const st = S();
    st.draft = U.clone(Store.config);
    st.baseHash = cfgHash();
  }
  function isDirty() {
    const st = App.ui && App.ui[P];
    if (!st || !st.draft || !App.session) return false;
    try {
      if (st.baseHash !== cfgHash() || !canEdit()) return false;
      return Engine.diffConfig(Store.config, st.draft).length > 0;
    } catch (e) {
      return false;
    }
  }

  /* =====================================================================
     NHAN, DANH MUC LUA CHON
     ===================================================================== */
  const BANKS = [
    { bin: "970436", name: "Vietcombank" }, { bin: "970415", name: "VietinBank" }, { bin: "970418", name: "BIDV" },
    { bin: "970407", name: "Techcombank" }, { bin: "970422", name: "MB" }, { bin: "970416", name: "ACB" },
    { bin: "970432", name: "VPBank" }, { bin: "970423", name: "TPBank" }, { bin: "970405", name: "Agribank" }, { bin: "970403", name: "Sacombank" },
  ];
  const KIND_LABEL = { dish: "Món bếp", seafood: "Hải sản cân ký", beer: "Bia", drink: "Nước - rượu" };
  const CAT_KIND = { kitchen: "Bếp", seafood: "Hải sản", drink: "Đồ uống" };
  const VAT_GROUP = { food: "Đồ ăn - nước ngọt", alcohol: "Rượu bia" };
  const PURPOSE = { kitchen: "Phiếu bếp", tag: "Tem hải sản", bill: "Hóa đơn" };
  const PERIOD = { month: "Tháng", quarter: "Quý" };
  const SOURCE = { brand: "Quỹ hãng", house: "Quán chịu" };
  const TYPE_LABEL = { normal: "Bàn thường", vip: "Phòng VIP" };
  const PROVIDERS = ["Viettel S-Invoice", "VNPT Invoice", "MISA meInvoice", "BKAV eHoaDon", "EasyInvoice", "FPT eInvoice"];
  const PORTAL_LABEL = { waiter: "Phục vụ", pg: "PG Bia", kiosk: "Kiosk bếp - hồ cá", cashier: "Thu ngân kiêm Quản lý", owner: "Chủ quán" };
  const PERM = {
    splitBill: ["Tách bill", "bool"],
    transferTable: ["Chuyển bàn", "bool"],
    discount: ["Giảm giá trực tiếp trên bill", "bool"],
    discountMaxPct: ["Mức giảm giá tối đa được tự quyết", "pct"],
    cashierBargainPct: ["Tự chốt / duyệt ép giá cá nguyên con tối đa", "pct"],
    voidAfterPrint: ["Hủy món sau khi gửi bếp / in tạm tính", "bool"],
    approveVoidUnder: ["Hạn mức tự hủy / duyệt hủy món dưới", "money"],
    reopenBill: ["Tự mở khóa bill đã in tạm tính", "bool"],
    maxSelfUnlockCount: ["Số lần tự mở khóa tối đa trên mỗi bill", "int", "lần"],
    approveWasteUnder: ["Tự duyệt hao hụt nguyên liệu dưới", "money"],
    approveOvertimeUnderMin: ["Tự duyệt tăng ca dưới", "int", "phút"],
    payAdvance: ["Chi tiền ứng lương & Tự duyệt ứng nhỏ", "bool"],
    approveAdvanceUnder: ["Tự duyệt ứng lương dưới", "money"],
    approveNoShowUnder: ["Tự xử lý cọc bàn khách không đến dưới", "money"],
    pettyCashMax: ["Chi tiền lẻ tối đa mỗi lần", "money"],
    voidBeforeSend: ["Xóa món trước khi gửi bếp", "bool"],
    requestPrebill: ["Yêu cầu in tạm tính", "bool"],
    collectPayment: ["Phục vụ ấn thanh toán nhanh tại bàn (hiện mã QR)", "bool"],
    collectCash: ["Phục vụ thu tiền mặt trực tiếp tại bàn", "bool"],
    createBottleKeep: ["Tạo phiếu rượu gửi", "bool"],
    viewTableTotal: ["Xem tổng tiền của bàn", "bool"],
    giveBrandPromo: ["Tặng bia khuyến mãi của hãng", "bool"],
    sellSoftDrink: ["Bán nước ngọt, đá", "bool"],
    receiveGoods: ["Nhập hàng vào kho", "bool"],
    reportWaste: ["Báo hao hụt", "bool"],
    blindCount: ["Kiểm kho cuối ca", "bool"],
    viewPayroll: ["Xem bảng lương", "bool"],
    exportTax: ["Xuất báo cáo thuế", "bool"],
    editSettings: ["Chỉnh sửa trang Cài đặt", "bool"],
    approve: ["Duyệt yêu cầu (hao hụt, ứng lương...)", "bool"],
  };
  const WIDGET = {
    waiter: { shift: "Ca hôm nay", tables: "Bàn đang phục vụ", weigh: "Chờ cân hải sản", tips: "Thưởng và tip", payslip: "Lương tạm tính" },
    pg: { shift: "Ca hôm nay", sales: "Sản lượng bán", quota: "Hạn mức khuyến mãi", caps: "Thu hồi nắp", commission: "Hoa hồng" },
    kiosk: { queue: "Hàng chờ cân", tank: "Tồn bể hải sản", bags: "Túi định lượng", waste: "Hao hụt" },
    cashier: { cash: "Tiền mặt trong két", qr: "Tiền chuyển khoản", locked: "Bill đã khóa", staff: "Nhân viên trong ca" },
    owner: { revenue: "Doanh thu", profit: "Lợi nhuận", approvals: "Phê duyệt", alerts: "Cảnh báo" },
  };
  const LIST_KEYS = { areas: "Khu vực", tables: "Bàn", categories: "Nhóm món", styles: "Kiểu chế biến", bags: "Túi định lượng", menu: "Món", brands: "Hãng bia", promos: "Khuyến mãi", shifts: "Ca làm", printers: "Máy in" };

  const GROUPS = [
    { id: "tables", label: "Bàn và đặt chỗ", icon: "layout-grid", desc: "Khu vực, sơ đồ bàn, phòng VIP, đặt bàn trực tuyến và cảnh báo trên sơ đồ.", keys: ["areas", "tables", "vip", "booking", "floor"] },
    { id: "menu", label: "Thực đơn và định lượng", icon: "utensils", desc: "Món ăn, giá bán, giá vốn, bán hải sản theo gram, ép giá nguyên con và túi định lượng trừ kho.", keys: ["categories", "styles", "bags", "menu", "marginAlert", "seafoodPolicy"] },
    { id: "promo", label: "Khuyến mãi bia và PG", icon: "badge-percent", desc: "Hãng bia, thưởng sản lượng, chương trình mua tặng và chỉ tiêu PG.", keys: ["brands", "promos", "pg"] },
    { id: "inventory", label: "Kho và khóa sổ", icon: "boxes", desc: "Dung sai kiểm kho và các chốt khóa tự động chống sửa số liệu.", keys: ["inventory", "locks"] },
    { id: "shifts", label: "Ca làm và lương", icon: "clock", desc: "Ca làm, quy định chấm công, đi trễ, tăng ca và cách tính lương.", keys: ["shifts", "attendance", "payroll"] },
    { id: "staff", label: "Nhân viên và phân quyền", icon: "users", desc: "Tài khoản nhân viên, quyền thao tác theo vai trò và thẻ số liệu từng màn hình.", keys: ["roles", "permissions", "widgets"] },
    { id: "printers", label: "Máy in và mẫu bill", icon: "printer", desc: "Máy in, định tuyến phiếu bếp, cổng thanh toán QR Webhook, thông tin quán và mẫu bill K80.", keys: ["printers", "scale", "store", "paymentGateway", "receipt", "theme"] },
    { id: "tax", label: "Thuế và kế toán", icon: "landmark", desc: "Thuế suất GTGT, thuế khoán hộ kinh doanh, chế độ kế toán và hóa đơn điện tử.", keys: ["tax"] },
  ];
  const GROUP_OF = {};
  GROUPS.forEach((g) => g.keys.forEach((k) => (GROUP_OF[k] = g.id)));
  const groupOf = (path) => GROUP_OF[path.split(".")[0]] || "tables";
  const groupLabel = (id) => (GROUPS.find((g) => g.id === id) || { label: "Lịch sử thay đổi" }).label;

  /* =====================================================================
     DANG KY CAC O CAI DAT (truong don)
     ===================================================================== */
  const FIELD = {};
  function f(path, type, label, help, o) {
    const def = Object.assign({ path, type, label, help }, o || {});
    FIELD[path] = def;
    return def;
  }
  const opts = (obj) => Object.keys(obj).map((k) => ({ value: k, label: obj[k] }));
  const minutesOpts = (arr) => arr.map((m) => ({ value: m, label: m + " phút" }));

  // Moi the: { id, group, title, desc, fields | render, keywords, example(d), side(d) }
  const CARDS = [
    /* ---------- 1. Ban va dat cho ---------- */
    { id: "floor", group: "tables", title: "Sơ đồ bàn", desc: "Kéo thả để sắp xếp. Bàn tự căn theo lưới 8 px. Chọn một bàn để sửa thông tin.", render: () => floorCard(), keywords: "sơ đồ bàn kéo thả thêm bàn vị trí lưới" },
    { id: "areas", group: "tables", title: "Khu vực và danh sách bàn", desc: "Mã bàn không được trùng. Bàn đang có khách không thể xóa.", render: () => areasCard(), keywords: "khu vực bàn mã bàn số chỗ vip" },
    {
      id: "vip", group: "tables", title: "Phòng VIP", desc: "Phụ thu theo giờ và mức chi tối thiểu để được miễn phụ thu.",
      fields: [
        f("vip.hourlyRate", "money", "Phụ thu phòng VIP mỗi giờ", "Cộng vào bill theo số giờ sử dụng, làm tròn lên từng giờ. Đặt 0 đ nếu không thu.", { unit: "đ", min: 0, max: 10000000 }),
        f("vip.freeMinutes", "int", "Số phút đầu miễn phụ thu", "Khoảng thời gian đầu không tính phụ thu, ví dụ chờ khách đến đủ.", { unit: "phút", min: 0, max: 240 }),
        f("vip.minimumSpendEnabled", "bool", "Miễn phụ thu khi đạt mức chi tối thiểu", "Bật để bàn VIP chi tiêu đủ mức dưới đây không phải trả phụ thu theo giờ."),
        f("vip.minimumSpend", "money", "Mức chi tối thiểu phòng VIP", "Tổng tiền món (chưa gồm phụ thu) cần đạt để được miễn phụ thu.", { unit: "đ", min: 0, max: 1000000000 }),
      ],
      example: (d) => exVip(d),
    },
    {
      id: "booking", group: "tables", title: "Đặt bàn trực tuyến", desc: "Áp dụng cho trang đặt bàn của khách và màn hình thu ngân.",
      fields: [
        f("booking.enabled", "bool", "Cho phép khách đặt bàn trực tuyến", "Tắt khi quán kín chỗ hoặc tạm ngưng nhận đặt bàn."),
        f("booking.depositRequired", "bool", "Yêu cầu đặt cọc", "Khách phải chuyển khoản tiền cọc thì bàn mới được xác nhận."),
        f("booking.depositNormal", "money", "Tiền cọc bàn thường", "Số tiền cọc mặc định cho bàn ở sân vườn, trong nhà.", { unit: "đ", min: 0, max: 50000000 }),
        f("booking.depositVip", "money", "Tiền cọc phòng VIP", "Số tiền cọc mặc định khi khách đặt phòng VIP.", { unit: "đ", min: 0, max: 50000000 }),
        f("booking.holdMinutes", "select", "Thời gian giữ bàn chờ cọc", "Hết thời gian này mà chưa nhận cọc, bàn tự mở lại cho khách khác.", { t: "int", options: minutesOpts([10, 15, 20, 30, 45, 60, 90, 120]) }),
        f("booking.noShowMinutes", "int", "Số phút trễ tính là khách không đến", "Quá giờ hẹn số phút này, hệ thống báo khách không đến và đề nghị giữ tiền cọc.", { unit: "phút", min: 5, max: 180 }),
        f("booking.slotStart", "time", "Giờ bắt đầu nhận đặt bàn", "Mốc giờ sớm nhất khách có thể chọn trên trang đặt bàn."),
        f("booking.slotEnd", "time", "Giờ kết thúc nhận đặt bàn", "Mốc giờ muộn nhất khách có thể chọn. Phải sau giờ bắt đầu."),
        f("booking.slotStep", "select", "Bước chia khung giờ", "Khoảng cách giữa các mốc giờ khách chọn.", { t: "int", options: minutesOpts([15, 20, 30, 45, 60]) }),
      ],
      example: (d) => exBooking(d),
    },
    {
      id: "floorops", group: "tables", title: "Phân công quản bàn & Cảnh báo trên sơ đồ bàn", desc: "Cấu hình giao bàn cố định cho nhân viên và nhắc phục vụ/thu ngân theo thời gian thực.",
      fields: [
        f("floor.assignmentMode", "seg", "Chế độ phân công nhân viên quản bàn", "Giao bàn/khu cố định cho từng nhân viên hoặc để phục vụ nhận bàn tự do.", { options: [{ value: "assigned", label: "Phân bàn theo nhân viên / khu vực" }, { value: "free", label: "Nhận bàn tự do" }] }),
        f("floor.autoCleanMinutes", "int", "Tự chuyển bàn về Trống sau khi dọn", "Sau khi thanh toán bàn ở trạng thái Cần dọn; quá số phút này tự chuyển về Trống.", { unit: "phút", min: 1, max: 120 }),
        f("floor.slowOrderMinutes", "int", "Cảnh báo món ra chậm", "Món đã gửi bếp quá số phút này sẽ hiện cảnh báo cho phục vụ.", { unit: "phút", min: 5, max: 120 }),
        f("floor.vipWarnMinutes", "int", "Nhắc trước khi phòng VIP sang giờ mới", "Nhắc phục vụ trước khi phụ thu VIP tính thêm một giờ.", { unit: "phút", min: 0, max: 59 }),
      ],
    },

    /* ---------- 2. Thuc don ---------- */
    { id: "menulist", group: "menu", title: "Món ăn và đồ uống", desc: "Giá bán, giá vốn, biên lãi. Tắt Đang bán để ẩn món khỏi màn hình gọi món.", render: () => menuCard(), keywords: "món ăn đồ uống giá bán giá vốn biên lãi ẩn món thêm món bia hải sản định lượng" },
    {
      id: "seafoodPolicy", group: "menu", title: "Bán hải sản theo Gram & Khách ép giá nguyên con", desc: "Cấu hình cho phép khách gọi lẻ theo gram (cắt khúc) hoặc thương lượng giá khi mua nguyên con.",
      fields: [
        f("seafoodPolicy.allowSellByGram", "bool", "Cho phép gọi lẻ hải sản theo gram / cắt khúc", "Khách không lấy nguyên con mà gọi lẻ (ví dụ: 500g cá mú nấu lẩu). Phần cá còn dư tự động lưu lại trong bể."),
        f("seafoodPolicy.minGram", "int", "Định lượng tối thiểu khi gọi theo gram", "Số gram tối thiểu cho một lần cắt lẻ (mặc định 200g).", { unit: "g", min: 50, max: 1000 }),
        f("seafoodPolicy.allowWholeFishBargain", "bool", "Cho phép khách trả giá khi mua nguyên con", "Bật để Phục vụ và Thu ngân có thể nhập giá chốt trọn con khi khách bắt nguyên con."),
        f("seafoodPolicy.maxStaffBargainPct", "pct", "Biên độ giảm tối đa nhân viên được tự chốt tại bàn", "Giảm trong mức này nhân viên tự chốt ngay; khách ép giá sâu hơn sẽ tự động gửi yêu cầu Chủ quán duyệt.", { unit: "%", min: 0, max: 50, slider: true, step: 1 }),
        f("seafoodPolicy.blockBelowCost", "bool", "Chặn tuyệt đối chốt giá thấp hơn giá vốn nhập bể", "Không cho phép nhân viên chốt giá nguyên con thấp hơn giá vốn nhập hàng."),
      ],
    },
    {
      id: "margin", group: "menu", title: "Cảnh báo biên lãi", desc: "Phát hiện món bán dưới giá vốn hợp lý.",
      fields: [f("marginAlert", "pct", "Ngưỡng cảnh báo biên lãi gộp", "Món có biên lãi gộp thấp hơn mức này được đánh dấu đỏ và báo trên Tổng quan.", { unit: "%", min: 0, max: 95 })],
    },
    { id: "categories", group: "menu", title: "Nhóm món", desc: "Nhóm thuế quyết định thuế suất GTGT áp cho món trong nhóm.", render: () => categoriesCard(), keywords: "nhóm món danh mục thứ tự nhóm thuế" },
    { id: "styles", group: "menu", title: "Kiểu chế biến hải sản", desc: "Khách chọn khi gọi hải sản. Phụ thu cộng thêm vào giá món.", render: () => stylesCard(), keywords: "kiểu chế biến hấp nướng phụ thu hải sản" },
    { id: "bags", group: "menu", title: "Túi định lượng", desc: "Nguyên liệu chia sẵn theo túi. Mỗi đĩa bán ra trừ kho theo định lượng.", render: () => bagsCard(), keywords: "túi định lượng gam tồn tối thiểu kho bếp" },

    /* ---------- 3. Khuyen mai ---------- */
    { id: "promos", group: "promo", title: "Chương trình khuyến mãi", desc: "Mua X tặng Y theo từng loại bia. PG chỉ tặng được khi chương trình đang bật.", render: () => promosCard(), keywords: "khuyến mãi mua tặng thu nắp quỹ hãng" },
    { id: "brands", group: "promo", title: "Hãng bia và thưởng sản lượng", desc: "Chỉ tiêu theo tháng hoặc quý để theo dõi tiền thưởng của hãng.", render: () => brandsCard(), keywords: "hãng bia thưởng sản lượng chỉ tiêu rebate" },
    { id: "pg", group: "promo", title: "PG bia", desc: "Hạn mức tặng mỗi ca, chỉ tiêu và hoa hồng của PG.", fieldsFn: (d) => pgFields(d), keywords: "pg hạn mức tặng chỉ tiêu hoa hồng thùng" },

    /* ---------- 4. Kho ---------- */
    {
      id: "tolerance", group: "inventory", title: "Dung sai kiểm kho", desc: "Lệch trong mức này được tự chấp nhận; vượt mức tạo yêu cầu giải trình.",
      fields: [
        f("inventory.tankCountTol", "int", "Lệch số con hải sản cho phép", "Mặc định 0: thiếu một con cũng phải giải trình.", { unit: "con", min: 0, max: 20 }),
        f("inventory.tankKgTol", "pct", "Hao nước hải sản cho phép", "Hải sản sụt ký tự nhiên trong bể. Chênh lệch kg trong mức này không tính là thất thoát.", { unit: "%", min: 0, max: 10, slider: true, step: 0.5 }),
        f("inventory.kitchenBagTol", "pct", "Lệch túi định lượng cho phép", "Tính theo % số túi lý thuyết của từng loại.", { unit: "%", min: 0, max: 20 }),
        f("inventory.beerTol", "int", "Lệch bia, nước cho phép", "Số lon, chai được phép lệch khi kiểm kho cuối ca.", { unit: "lon", min: 0, max: 48 }),
        f("inventory.utilityCap", "pct", "Trần chi phí phụ phẩm", "Đá, gas, than, gia vị tính theo % doanh thu bếp. Vượt trần sẽ cảnh báo trên Tổng quan.", { unit: "%", min: 0, max: 20 }),
        f("inventory.wasteAutoApproveUnder", "money", "Tự duyệt hao hụt dưới", "Hao hụt có giá trị nhỏ hơn mức này được tự duyệt. Đặt 0 đ để mọi hao hụt đều cần duyệt.", { unit: "đ", min: 0, max: 10000000 }),
      ],
    },
    {
      id: "locks", group: "inventory", title: "Khóa tự động", desc: "Chốt chặn chống sửa số liệu sau các mốc quan trọng.",
      fields: [
        f("locks.prebillLock", "bool", "Khóa bill sau khi in tạm tính", "Sau khi in phiếu tạm tính, mọi thay đổi món phải được duyệt mở khóa."),
        f("locks.prebillGraceSec", "int", "Cho phép sửa trong số giây đầu", "Thời gian ngắn sau khi in để sửa lỗi bấm nhầm. Đặt 0 để khóa ngay.", { unit: "giây", min: 0, max: 300 }),
        f("locks.zLockEnabled", "bool", "Tự khóa ca theo giờ", "Đến giờ đã chọn, ca thu ngân tự khóa và không ghi thêm giao dịch."),
        f("locks.zLockTime", "time", "Giờ tự khóa ca", "Ví dụ 00:30, 01:30 hoặc 03:00 tùy giờ đóng cửa."),
        f("locks.blindCountLock", "bool", "Khóa kết quả kiểm kho cuối ca", "Sau khi gửi kết quả kiểm kho, nhân viên không sửa lại được."),
        f("locks.taxPeriodLock", "bool", "Khóa kỳ thuế đã chốt", "Số liệu các tháng đã khóa kỳ thuế không thể chỉnh sửa."),
        f("locks.autoCloseBooking", "bool", "Tự hủy giữ chỗ quá hạn", "Giữ chỗ chưa cọc quá thời gian sẽ tự hủy và mở lại bàn."),
      ],
    },

    /* ---------- 5. Ca lam va luong ---------- */
    { id: "shiftlist", group: "shifts", title: "Ca làm", desc: "Một ca có thể gồm nhiều mốc giờ (ca gãy). Ca qua nửa đêm được tính cho ngày bắt đầu.", render: () => shiftsCard(), keywords: "ca làm ca gãy mốc giờ ca tối ca khuya" },
    {
      id: "attendance", group: "shifts", title: "Chấm công và đi trễ", desc: "Điều kiện để nhân viên chấm công bằng điện thoại.",
      fields: [
        f("attendance.wifiRequired", "bool", "Bắt buộc kết nối Wi-Fi của quán", "Điện thoại nhân viên phải kết nối đúng mạng Wi-Fi bên dưới khi chấm công."),
        f("attendance.wifiName", "text", "Tên Wi-Fi chấm công", "Nhập chính xác tên mạng, phân biệt chữ hoa và chữ thường.", { required: true, placeholder: "Ví dụ: PhoBien_Staff" }),
        f("attendance.gpsRequired", "bool", "Kiểm tra vị trí GPS", "Chỉ cho chấm công khi điện thoại ở trong bán kính quanh quán."),
        f("attendance.gpsRadius", "int", "Bán kính cho phép", "Khoảng cách tối đa từ quán đến vị trí chấm công.", { unit: "m", min: 10, max: 500 }),
        f("attendance.selfieRequired", "bool", "Chụp ảnh khuôn mặt khi chấm công", "Chống chấm công hộ. Ảnh được lưu kèm bản ghi chấm công."),
        f("attendance.graceMinutes", "int", "Số phút cho phép đi trễ", "Đi trễ trong số phút này không bị phạt.", { unit: "phút", min: 0, max: 60 }),
        f("attendance.latePenalties", "tiers", "Bậc tiền phạt đi trễ", "Mỗi bậc áp dụng từ số phút trễ đã nhập. Xóa hết các bậc để tắt phạt đi trễ."),
      ],
      example: (d) => exLate(d),
    },
    {
      id: "overtime", group: "shifts", title: "Giờ công và tăng ca", desc: "Giới hạn giờ công sau bàn cuối và hệ số lương.",
      fields: [
        f("attendance.cleanupBuffer", "int", "Thời gian dọn dẹp sau bàn cuối", "Giờ công được tính tối đa đến giờ đóng bill cuối cộng thêm số phút này. Phần vượt cần duyệt.", { unit: "phút", min: 0, max: 180 }),
        f("attendance.nightStart", "time", "Giờ bắt đầu tính ca đêm", "Giờ làm sau mốc này được nhân hệ số ca đêm."),
        f("attendance.nightMultiplier", "num", "Hệ số lương ca đêm", "Ví dụ 1,3 nghĩa là giờ làm đêm được trả 130% lương giờ.", { unit: "lần", min: 1, max: 3 }),
        f("attendance.otMultiplier", "num", "Hệ số lương tăng ca", "Áp dụng cho giờ tăng ca đã được duyệt.", { unit: "lần", min: 1, max: 3 }),
      ],
      example: (d) => exOvertime(d),
    },
    {
      id: "payroll", group: "shifts", title: "Tính lương & Quy chế chia Tiền Tip", desc: "Áp dụng cho bảng lương tạm tính và phân chia tiền Tip khi khách chuyển khoản dư.",
      fields: [
        f("payroll.tipPolicy", "select", "Quy chế chia Tiền Tip mặc định", "Cách xác định người hưởng tiền Tip khi khách chuyển khoản dư trên mức cần thanh toán.", {
          options: [
            { value: "personal", label: "Nhân viên đứng bàn nhận 100% (Cá nhân)" },
            { value: "pool", label: "Chia đều toàn ca phục vụ" },
            { value: "area", label: "Chia theo tổ phụ trách khu vực bàn" },
          ],
        }),
        f("payroll.workDaysPerMonth", "seg", "Số ngày công chuẩn mỗi tháng", "Lương tháng chia cho số ngày này để ra lương một ngày công.", { t: "int", options: [{ value: 26, label: "26 ngày" }, { value: 30, label: "30 ngày" }] }),
        f("payroll.standardHoursPerDay", "int", "Số giờ chuẩn mỗi ngày công", "Dùng để quy đổi lương tháng ra lương giờ khi tính tăng ca.", { unit: "giờ", min: 1, max: 12 }),
        f("payroll.advanceCapPct", "pct", "Hạn mức ứng lương", "Tối đa bao nhiêu phần trăm lương đã làm được phép ứng trước.", { unit: "%", min: 0, max: 100 }),
        f("payroll.payDay", "int", "Ngày trả lương hằng tháng", "Lương tháng trước được chốt và trả vào ngày này.", { unit: "hằng tháng", min: 1, max: 28 }),
      ],
      example: (d) => exPayroll(d),
    },

    /* ---------- 6. Nhan vien ---------- */
    { id: "staff", group: "staff", title: "Nhân viên", desc: "Thêm nhân viên, gán vai trò, đổi mã PIN, khóa tài khoản người đã nghỉ.", render: () => staffCard(), keywords: "nhân viên mã pin vai trò khóa tài khoản lương ca" },
    { id: "perms", group: "staff", title: "Phân quyền theo vai trò", desc: "Chủ quán luôn có toàn quyền. Ô gạch ngang là quyền không áp dụng cho vai trò đó.", render: () => permsCard(), keywords: "phân quyền quyền hạn " + Object.keys(PERM).map((k) => PERM[k][0]).join(" ") },
    { id: "widgets", group: "staff", title: "Thẻ số liệu trên từng màn hình", desc: "Bật hoặc tắt các thẻ số liệu hiển thị ở đầu màn hình của mỗi vai trò.", render: () => widgetsCard(), keywords: "thẻ số liệu tổng quan hiển thị widget" },

    /* ---------- 7. May in va mau bill ---------- */
    { id: "printers", group: "printers", title: "Máy in", desc: "Khi một máy mất kết nối, phiếu tự chuyển sang máy in dự phòng.", render: () => printersCard(), keywords: "máy in dự phòng số liên kết nối" },
    { id: "routing", group: "printers", title: "Định tuyến phiếu bếp", desc: "Chọn nhóm món in ra máy nào. Một nhóm có thể in ra nhiều máy.", render: () => routingCard(), keywords: "định tuyến phiếu bếp nhóm món in ra máy" },
    {
      id: "store", group: "printers", title: "Thông tin quán", desc: "In ở đầu và cuối bill, hiển thị trên trang khách hàng.",
      fields: [
        f("store.name", "text", "Tên quán", "Hiển thị trên bill, trang đặt bàn và thanh tiêu đề.", { required: true }),
        f("store.address", "text", "Địa chỉ", "In dưới tên quán trên bill.", { required: true }),
        f("store.phone", "text", "Số điện thoại", "Khách gọi đặt bàn, in trên bill.", { required: true }),
        f("store.taxCode", "text", "Mã số thuế", "Gồm 10 số, hoặc 13 số với chi nhánh (dạng 0312345678-001)."),
        f("store.wifiName", "text", "Tên Wi-Fi cho khách", "In trên bill khi bật hiển thị Wi-Fi."),
        f("store.wifiPass", "text", "Mật khẩu Wi-Fi cho khách", "In kèm tên Wi-Fi trên bill."),
        f("store.openTime", "time", "Giờ mở cửa", "Hiển thị trên trang khách hàng."),
        f("store.closeTime", "time", "Giờ đóng cửa", "Hiển thị trên trang khách hàng."),
        f("store.thanks", "text", "Lời cảm ơn cuối bill", "Một câu ngắn in ở cuối bill.", { maxlength: 80 }),
      ],
    },
    {
      id: "bank", group: "printers", title: "Tài khoản nhận VietQR", desc: "Mã QR trên phiếu tạm tính tự điền đúng số tiền và nội dung bàn.",
      fields: [
        f("store.bankBin", "select", "Ngân hàng", "Ngân hàng nhận tiền chuyển khoản của khách.", { options: BANKS.map((b) => ({ value: b.bin, label: b.name + " (" + b.bin + ")" })) }),
        f("store.bankAccount", "text", "Số tài khoản", "Chỉ gồm chữ số, 6 đến 19 số.", { required: true, inputmode: "numeric" }),
        f("store.accountName", "text", "Tên chủ tài khoản", "Viết in hoa không dấu, đúng như đăng ký với ngân hàng.", { required: true }),
      ],
      side: (d) => qrPreview(d),
    },
    {
      id: "paymentGateway", group: "printers", title: "Cổng thanh toán & Webhook Biến động số dư", desc: "Tự động định danh mã nội dung QR (VD: QN A02 1234), báo thanh toán thành công khi tiền về >= số tiền cần thu và tự tách tiền Tip.",
      fields: [
        f("paymentGateway.enabled", "bool", "Kích hoạt Webhook tự động xác nhận thanh toán QR", "Khi cổng thanh toán báo biến động số dư khớp mã nội dung bill, hệ thống tự động chốt bill và báo thành công."),
        f("paymentGateway.provider", "select", "Cổng thanh toán liên kết", "Đơn vị cung cấp API biến động số dư ngân hàng.", {
          options: ["SePay / Casso / VietQR", "PayOS", "VietQR Pro", "Casso Webhook", "SePay Webhook"].map((x) => ({ value: x, label: x })),
        }),
        f("paymentGateway.prefix", "text", "Tiền tố mã định danh nội dung chuyển khoản", "Hệ thống tự sinh mã theo cấu trúc: <Tiền tố> <Mã bàn> <4 ký tự> (VD: QN A02 8491).", { required: true, maxlength: 8 }),
        f("paymentGateway.webhookPath", "text", "Đường dẫn API nhận Webhook (Endpoint)", "Cấu hình URL này trên cổng thanh toán để đẩy biến động số dư về hệ thống."),
        f("paymentGateway.webhookSecret", "text", "Khóa bảo mật Webhook (API Key / Secret Token)", "Nhập chuỗi khóa bí mật khớp với SePay/Casso (Header Authorization hoặc X-Webhook-Secret) để chặn giả mạo gói tin. Để trống nếu chưa bật."),
        f("paymentGateway.autoCloseOnFullPay", "bool", "Tự động đóng bill khi số tiền nhận >= mức thanh toán", "Không bắt buộc khách chuyển đúng số tiền lẻ; chỉ cần >= số tiền cần thu là hệ thống báo thành công."),
        f("paymentGateway.overpayAsTip", "bool", "Tự động ghi nhận phần tiền chuyển dư làm Tiền Tip", "Phần chênh lệch (Thực nhận - Cần thu > 0) tự động hạch toán vào Tiền Tip theo quy chế chia Tip."),
      ],
    },
    {
      id: "receipt", group: "printers", title: "Mẫu bill K80", desc: "Xem trước trực tiếp ở khung bên phải.",
      fields: [
        f("receipt.showWifi", "bool", "In tên và mật khẩu Wi-Fi", "Dòng Wi-Fi in ở cuối phiếu tạm tính và hóa đơn."),
        f("receipt.showQr", "bool", "In mã QR trên bill", "Phiếu tạm tính in VietQR chuyển khoản; hóa đơn in mã tra cứu xuất hóa đơn VAT."),
        f("receipt.showVatNote", "bool", "In dòng thuế GTGT đã gồm trong giá", "Chỉ áp dụng khi giá bán đã gồm thuế GTGT."),
        f("receipt.footer", "text", "Dòng chú thích dưới mã QR hóa đơn", "Hướng dẫn khách quét mã để tự xuất hóa đơn VAT.", { maxlength: 90 }),
      ],
    },
    {
      id: "scale", group: "printers", title: "Cân điện tử", desc: "Cân tại hồ hải sản kết nối với kiosk.",
      fields: [
        f("scale.enabled", "bool", "Kết nối cân điện tử", "Tắt để nhân viên nhập số ký bằng tay (cần chụp ảnh màn hình cân)."),
        f("scale.port", "select", "Cổng kết nối", "Cổng COM hoặc USB của cân trên máy kiosk.", { options: ["COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "USB"].map((x) => ({ value: x, label: x })) }),
        f("scale.stableMs", "int", "Thời gian chờ cân ổn định", "Số đọc phải đứng yên trong khoảng này mới được xác nhận.", { unit: "ms", min: 200, max: 5000 }),
        f("scale.decimals", "select", "Số chữ số thập phân", "Độ chính xác của số ký hiển thị và in tem.", { t: "int", options: [{ value: 1, label: "1 chữ số (0,1 kg)" }, { value: 2, label: "2 chữ số (0,01 kg)" }, { value: 3, label: "3 chữ số (0,001 kg)" }] }),
      ],
    },
    {
      id: "theme", group: "printers", title: "Giao diện màn hình", desc: "Nền tối giúp đỡ chói khi quán tắt bớt đèn về khuya.",
      fields: [
        f("theme.posDark", "bool", "Nền tối cho màn hình thu ngân", "Áp dụng cho màn hình POS tại quầy."),
        f("theme.kioskDark", "bool", "Nền tối cho kiosk bếp - hồ cá", "Áp dụng cho máy tính bảng tại bếp và hồ hải sản."),
      ],
    },

    /* ---------- 8. Thue ---------- */
    {
      id: "vat", group: "tax", title: "Thuế suất", desc: "Đổi được ngay khi luật thay đổi. Nên chọn thời điểm áp dụng khi lưu.",
      fields: [
        f("tax.food", "pct", "Thuế GTGT đồ ăn, nước ngọt", "Áp dụng cho các nhóm món thuộc nhóm thuế Đồ ăn - nước ngọt.", { unit: "%", min: 0, max: 10 }),
        f("tax.alcohol", "pct", "Thuế GTGT rượu bia", "Áp dụng cho các nhóm món thuộc nhóm thuế Rượu bia.", { unit: "%", min: 0, max: 10 }),
        f("tax.pricesIncludeVat", "bool", "Giá bán đã gồm thuế GTGT", "Bật: giá trên thực đơn là giá cuối. Tắt: thuế được cộng thêm ở cuối bill."),
        f("tax.hkdRate", "pct", "Tỷ lệ thuế khoán hộ kinh doanh", "Dịch vụ ăn uống: 3% thuế GTGT và 1,5% thuế thu nhập cá nhân trên doanh thu.", { unit: "%", min: 0, max: 10 }),
      ],
      example: (d) => exTax(d),
    },
    {
      id: "mode", group: "tax", title: "Chế độ kế toán", desc: "Quyết định mẫu sổ sách và báo cáo thuế được xuất.",
      fields: [f("tax.mode", "seg", "Loại hình kinh doanh", "Chọn đúng loại hình đã đăng ký với cơ quan thuế.", { options: [{ value: "hkd", label: "Hộ kinh doanh" }, { value: "company", label: "Công ty TNHH" }] })],
      example: (d) => exMode(d),
    },
    {
      id: "einvoice", group: "tax", title: "Hóa đơn điện tử", desc: "Khách tự xuất hóa đơn VAT bằng cách quét mã QR trên bill.",
      fields: [
        f("tax.einvoiceProvider", "select", "Nhà cung cấp hóa đơn điện tử", "Đơn vị phát hành hóa đơn điện tử quán đã ký hợp đồng.", { options: PROVIDERS.map((x) => ({ value: x, label: x })) }),
        f("tax.einvoiceWindowHours", "int", "Thời hạn khách tự xuất hóa đơn", "Sau thời hạn này mã QR trên bill hết hiệu lực xuất hóa đơn.", { unit: "giờ", min: 1, max: 168 }),
      ],
    },
  ];

  // Truong dong: han muc tang moi ca theo tung hang
  function pgFields(d) {
    const out = d.brands.map((b) => {
      const path = "pg.brandQuotaPerShift." + b.id;
      return FIELD[path] || f(path, "int", "Hạn mức tặng mỗi ca - " + b.name, "Số lon tặng tối đa mỗi ca theo chương trình của hãng. Đặt 0 nếu không tặng.", { unit: "lon", min: 0, max: 500 });
    });
    out.push(FIELD["pg.targetCasesPerShift"]);
    out.push(FIELD["pg.commissionPerCase"]);
    return out;
  }
  f("pg.targetCasesPerShift", "int", "Chỉ tiêu sản lượng mỗi ca", "Số thùng PG cần bán mỗi ca, hiển thị tiến độ trên màn hình PG.", { unit: "thùng", min: 0, max: 200 });
  f("pg.commissionPerCase", "money", "Hoa hồng mỗi thùng", "Tính cho mỗi thùng (24 lon) PG bán được, cộng vào lương tạm tính.", { unit: "đ", min: 0, max: 1000000 });
  DEF.brands.forEach((b) => pgFields(DEF));

  /* =====================================================================
     DINH DANG GIA TRI
     ===================================================================== */
  function fmtField(fd, v) {
    if (v === undefined || v === null || v === "") return fd && fd.type === "money" ? "0 đ" : "Trống";
    const t = fd ? fd.type : typeof v;
    if (t === "bool" || typeof v === "boolean") return v ? "Bật" : "Tắt";
    if (t === "money") return U.money(v);
    if (t === "pct") return U.num(v, v % 1 ? 1 : 0) + "%";
    if (t === "num") return String(v).replace(".", ",") + (fd.unit ? " " + fd.unit : "");
    if (t === "int") return U.num(v) + (fd.unit ? " " + fd.unit : "");
    if (t === "tiers") return (v || []).length ? v.map((x) => "từ " + x.fromMin + " phút: " + U.money(x.amount)).join("; ") : "Không phạt";
    if (t === "select" || t === "seg") {
      const op = (fd.options || []).find((o) => String(o.value) === String(v));
      return op ? op.label : String(v);
    }
    return String(v);
  }
  let LOOK = [Store.config];
  const lookName = (list, id) => {
    for (const c of LOOK) {
      const x = (c[list] || []).find((i) => i.id === id);
      if (x) return x.code || x.name;
    }
    return id || "Không có";
  };
  const ITEM = {
    code: "Mã", areaId: "Khu vực", seats: "Số chỗ", type: "Loại", name: "Tên", categoryId: "Nhóm", kind: "Loại", price: "Giá bán", pricePerKg: "Giá bán/kg", cost: "Giá vốn",
    costPerKg: "Giá vốn/kg", unit: "Đơn vị", caseSize: "Quy cách thùng", brandId: "Hãng", active: "Đang bán", popular: "Gọi nhiều", styles: "Kiểu chế biến", bom: "Định lượng",
    upsell: "Thưởng bán hàng", upsellPerKg: "Thưởng bán hàng/kg", avgKgPerPiece: "Ký trung bình/con", bottleKeep: "Cho gửi rượu", vatGroup: "Nhóm thuế", order: "Thứ tự",
    surcharge: "Phụ thu", gram: "Khối lượng", minStock: "Tồn tối thiểu", rebateTarget: "Chỉ tiêu", rebateUnit: "Đơn vị", rebatePeriod: "Kỳ", rebateAmount: "Tiền thưởng",
    buyQty: "Mua", freeQty: "Tặng", source: "Nguồn trừ", requireCapReturn: "Thu nắp", menuId: "Món", segments: "Mốc giờ", location: "Vị trí đặt", purpose: "Công dụng",
    copies: "Số liên", online: "Kết nối", backupId: "Máy dự phòng", categories: "Nhóm món in",
  };
  const MONEY_KEYS = ["price", "pricePerKg", "cost", "costPerKg", "upsell", "upsellPerKg", "surcharge", "rebateAmount"];
  function fmtItem(k, v, list) {
    if (v === undefined || v === null || v === "") return "Trống";
    if (MONEY_KEYS.includes(k) || (k === "cost" && list === "bags")) return U.money(v);
    if (k === "areaId") return lookName("areas", v);
    if (k === "categoryId") return lookName("categories", v);
    if (k === "brandId") return lookName("brands", v);
    if (k === "menuId") return lookName("menu", v);
    if (k === "backupId") return v ? lookName("printers", v) : "Không có";
    if (k === "categories") return v.length ? v.map((c) => lookName("categories", c)).join(", ") : "Không in phiếu bếp";
    if (k === "styles") return v.length ? v.map((s) => lookName("styles", s)).join(", ") : "Không có";
    if (k === "bom") return v.length ? v.map((b) => lookName("bags", b.bagId) + " x " + b.qty).join(", ") : "Không trừ kho";
    if (k === "segments") return v.map((s) => s.start + "-" + s.end).join(", ");
    if (k === "type") return TYPE_LABEL[v] || v;
    if (k === "kind") return KIND_LABEL[v] || CAT_KIND[v] || v;
    if (k === "vatGroup") return VAT_GROUP[v] || v;
    if (k === "purpose") return PURPOSE[v] || v;
    if (k === "source") return SOURCE[v] || v;
    if (k === "rebatePeriod") return PERIOD[v] || v;
    if (k === "online") return v ? "Đang kết nối" : "Mất kết nối";
    if (k === "gram") return U.num(v) + " g";
    if (typeof v === "boolean") return v ? "Bật" : "Tắt";
    if (typeof v === "number") return U.num(v, v % 1 ? 2 : 0);
    if (Array.isArray(v)) return v.length + " mục";
    return String(v);
  }
  function labelOf(path) {
    if (FIELD[path]) return FIELD[path].label;
    const p = path.split(".");
    if (p[0] === "permissions" && p.length === 3) return "Quyền " + Engine.roleLabel(p[1]) + ": " + ((PERM[p[2]] || [p[2]])[0]);
    if (p[0] === "widgets" && p.length === 3) return "Thẻ " + (PORTAL_LABEL[p[1]] || p[1]) + ": " + ((WIDGET[p[1]] || {})[p[2]] || p[2]);
    if (p[0] === "pg" && p[1] === "brandQuotaPerShift") return "Hạn mức tặng mỗi ca - " + lookName("brands", p[2]);
    if (p[0] === "roles") return "Vai trò " + (p[1] || "");
    if (LIST_KEYS[path]) return "Danh sách " + LIST_KEYS[path].toLowerCase();
    return Engine.pathLabel(path);
  }
  function fmtPath(path, v) {
    if (FIELD[path]) return fmtField(FIELD[path], v);
    const p = path.split(".");
    if (p[0] === "permissions" && PERM[p[2]]) {
      const t = PERM[p[2]][1];
      if (t === "pct") return U.num(v) + "%";
      if (t === "money") return U.money(v);
      return v ? "Cho phép" : "Không cho phép";
    }
    if (p[0] === "widgets") return v ? "Hiện" : "Ẩn";
    if (p[0] === "pg" && p[1] === "brandQuotaPerShift") return v === undefined ? "Không giới hạn" : U.num(v) + " lon";
    if (v === undefined || v === null) return "Trống";
    if (typeof v === "boolean") return v ? "Bật" : "Tắt";
    if (typeof v === "number") return U.num(v, v % 1 ? 2 : 0);
    if (typeof v === "object") return JSON.stringify(v);
    return String(v);
  }

  /* =====================================================================
     SO SANH: danh sach thay doi chi tiet (dung cho thanh luu, hop xac nhan, lich su)
     ===================================================================== */
  function listDiff(path, A, B) {
    const L = LIST_KEYS[path];
    const name = (x) => x.code || x.name || x.id;
    const res = [];
    const mA = {}, mB = {};
    A.forEach((x) => (mA[x.id] = x));
    B.forEach((x) => (mB[x.id] = x));
    B.forEach((x) => { if (!mA[x.id]) res.push({ path, kind: "add", label: L + " " + name(x), old: "Chưa có", new: "Thêm mới" }); });
    A.forEach((x) => { if (!mB[x.id]) res.push({ path, kind: "remove", label: L + " " + name(x), old: "Đang có", new: "Xóa" }); });
    B.forEach((x) => {
      const o = mA[x.id];
      if (!o || same(o, x)) return;
      const keys = Array.from(new Set(Object.keys(o).concat(Object.keys(x)))).filter((k) => k !== "id");
      const olds = [], news = [];
      let moved = false;
      keys.forEach((k) => {
        if (same(o[k], x[k])) return;
        if (k === "x" || k === "y") { moved = true; return; }
        olds.push((ITEM[k] || k) + ": " + fmtItem(k, o[k], path));
        news.push((ITEM[k] || k) + ": " + fmtItem(k, x[k], path));
      });
      if (moved) { olds.push("Vị trí " + o.x + ", " + o.y); news.push("Vị trí " + x.x + ", " + x.y); }
      res.push({ path, kind: "edit", label: L + " " + name(x), old: olds.join(" · "), new: news.join(" · ") });
    });
    if (!res.length) res.push({ path, kind: "edit", label: "Thứ tự " + L.toLowerCase(), old: "Thứ tự cũ", new: "Thứ tự mới" });
    return res;
  }
  function detailedChanges(a, b) {
    LOOK = [b, a];
    const out = [];
    Engine.diffConfig(a, b).forEach((c) => {
      const group = groupOf(c.path);
      if (c.isList && LIST_KEYS[c.path]) listDiff(c.path, U.get(a, c.path) || [], U.get(b, c.path) || []).forEach((x) => out.push(Object.assign({ group }, x)));
      else if (c.isList) out.push({ group, path: c.path, label: labelOf(c.path), old: fmtPath(c.path, U.get(a, c.path)), new: fmtPath(c.path, U.get(b, c.path)) });
      else out.push({ group, path: c.path, label: labelOf(c.path), old: fmtPath(c.path, c.old), new: fmtPath(c.path, c.new) });
    });
    LOOK = [Store.config];
    return out;
  }

  /* =====================================================================
     KIEM TRA HOP LE
     ===================================================================== */
  const isNumType = (t) => t === "money" || t === "int" || t === "num" || t === "pct";
  function rangeMsg(fd) {
    const u = fd.unit === "%" ? "%" : fd.unit ? " " + fd.unit : "";
    const show = (n) => (fd.type === "money" ? U.moneyPlain(n) : U.num(n, n % 1 ? 1 : 0));
    if (fd.min !== undefined && fd.max !== undefined) return "Chỉ nhận giá trị từ " + show(fd.min) + " đến " + show(fd.max) + u + ". Hãy nhập lại trong khoảng này.";
    if (fd.min !== undefined) return "Giá trị phải từ " + show(fd.min) + u + " trở lên.";
    return "Giá trị tối đa là " + show(fd.max) + u + ".";
  }
  const validTime = (v) => /^([01]\d|2[0-3]):[0-5]\d$/.test(String(v || ""));
  function validate(d) {
    const e = {};
    const put = (k, m) => { if (!e[k]) e[k] = m; };
    Object.keys(FIELD).forEach((path) => {
      const fd = FIELD[path];
      if (path.startsWith("pg.brandQuotaPerShift.") && !d.brands.find((b) => "pg.brandQuotaPerShift." + b.id === path)) return;
      const v = U.get(d, path);
      if (fd.required && !String(v === undefined ? "" : v).trim()) return put(path, "Không được để trống. Hãy nhập " + fd.label.toLowerCase() + ".");
      if (isNumType(fd.type) && v !== undefined) {
        if (typeof v !== "number" || isNaN(v)) return put(path, "Giá trị phải là số.");
        if ((fd.min !== undefined && v < fd.min) || (fd.max !== undefined && v > fd.max)) return put(path, rangeMsg(fd));
      }
      if (fd.type === "time" && !validTime(v)) put(path, "Giờ không hợp lệ. Nhập theo dạng giờ:phút, ví dụ 00:30.");
    });
    // Rang buoc rieng
    if (validTime(d.booking.slotStart) && validTime(d.booking.slotEnd) && U.minutesOf(d.booking.slotEnd) <= U.minutesOf(d.booking.slotStart)) put("booking.slotEnd", "Giờ kết thúc phải sau giờ bắt đầu nhận đặt bàn.");
    if (d.store.bankAccount && !/^\d{6,19}$/.test(String(d.store.bankAccount).trim())) put("store.bankAccount", "Số tài khoản chỉ gồm chữ số, từ 6 đến 19 số. Hãy bỏ dấu cách hoặc ký tự khác.");
    if (d.store.accountName && !/^[A-Z0-9 ]+$/.test(String(d.store.accountName).trim())) put("store.accountName", "Viết in hoa không dấu, ví dụ NGUYEN VAN HUNG.");
    if (d.store.taxCode && !/^\d{10}(-\d{3})?$/.test(String(d.store.taxCode).trim())) put("store.taxCode", "Mã số thuế gồm 10 số, hoặc 13 số dạng 0312345678-001.");
    if (d.store.phone && !/^[0-9 .+]{8,15}$/.test(String(d.store.phone).trim())) put("store.phone", "Số điện thoại không hợp lệ. Chỉ gồm chữ số, từ 8 đến 15 ký tự.");
    if (d.attendance.wifiRequired === false) delete e["attendance.wifiName"];

    // Khu vuc
    if (!d.areas.length) put("areas", "Cần ít nhất một khu vực.");
    d.areas.forEach((a, i) => { if (!String(a.name || "").trim()) put("areas." + i + ".name", "Tên khu vực không được để trống."); });
    // Ban
    const codes = {};
    d.tables.forEach((t, i) => {
      const c = String(t.code || "").trim().toUpperCase();
      if (!c) put("tables." + i + ".code", "Mã bàn không được để trống.");
      else if (codes[c] !== undefined) { put("tables." + i + ".code", "Mã bàn " + t.code + " bị trùng. Mỗi bàn cần một mã riêng."); put("tables." + codes[c] + ".code", "Mã bàn " + t.code + " bị trùng. Mỗi bàn cần một mã riêng."); }
      else codes[c] = i;
      if (!(t.seats >= 1 && t.seats <= 60)) put("tables." + i + ".seats", "Số chỗ từ 1 đến 60.");
      if (!d.areas.find((a) => a.id === t.areaId)) put("tables." + i + ".areaId", "Chọn khu vực cho bàn " + (t.code || "") + ".");
    });
    if (!d.tables.length) put("tables", "Cần ít nhất một bàn.");
    Store.config.tables.forEach((t) => { if (!d.tables.find((x) => x.id === t.id) && Engine.ticketByTable(t.id)) put("tables", "Bàn " + t.code + " đang có khách nên không thể xóa. Hãy thanh toán hoặc chuyển bàn trước."); });
    // Thuc don
    d.categories.forEach((c, i) => { if (!String(c.name || "").trim()) put("categories." + i + ".name", "Tên nhóm món không được để trống."); });
    d.styles.forEach((s, i) => {
      if (!String(s.name || "").trim()) put("styles." + i + ".name", "Tên kiểu chế biến không được để trống.");
      if (!(s.surcharge >= 0)) put("styles." + i + ".surcharge", "Phụ thu không được âm.");
    });
    d.bags.forEach((b, i) => {
      if (!String(b.name || "").trim()) put("bags." + i + ".name", "Tên túi không được để trống.");
      if (!(b.gram > 0)) put("bags." + i + ".gram", "Khối lượng túi phải lớn hơn 0 gam.");
    });
    d.menu.forEach((m, i) => {
      if (!String(m.name || "").trim()) put("menu." + i + ".name", "Món chưa có tên.");
      const price = m.kind === "seafood" ? m.pricePerKg : m.price;
      if (!(price > 0)) put("menu." + i + ".price", "Món " + (m.name || "") + " chưa có giá bán.");
      if (!d.categories.find((c) => c.id === m.categoryId)) put("menu." + i + ".categoryId", "Món " + (m.name || "") + " chưa thuộc nhóm món nào.");
    });
    // Khuyen mai
    d.brands.forEach((b, i) => { if (!String(b.name || "").trim()) put("brands." + i + ".name", "Tên hãng không được để trống."); });
    d.promos.forEach((p, i) => {
      if (!(p.buyQty >= 1)) put("promos." + i + ".buyQty", "Số lượng mua phải từ 1 trở lên.");
      if (!(p.freeQty >= 1)) put("promos." + i + ".freeQty", "Số lượng tặng phải từ 1 trở lên.");
      else if (p.freeQty > p.buyQty) put("promos." + i + ".freeQty", "Số lượng tặng không được lớn hơn số lượng mua.");
      if (!d.menu.find((m) => m.id === p.menuId)) put("promos." + i + ".menuId", "Chọn loại bia áp dụng khuyến mãi.");
    });
    // Ca lam
    if (!d.shifts.length) put("shifts", "Cần ít nhất một ca làm.");
    d.shifts.forEach((s, i) => {
      if (!String(s.name || "").trim()) put("shifts." + i + ".name", "Tên ca không được để trống.");
      if (!s.segments.length) put("shifts." + i + ".name", "Ca " + (s.name || "") + " cần ít nhất một mốc giờ.");
      s.segments.forEach((g, j) => {
        if (!validTime(g.start)) put("shifts." + i + ".segments." + j + ".start", "Giờ vào không hợp lệ.");
        if (!validTime(g.end)) put("shifts." + i + ".segments." + j + ".end", "Giờ ra không hợp lệ.");
        if (validTime(g.start) && g.start === g.end) put("shifts." + i + ".segments." + j + ".end", "Giờ ra phải khác giờ vào.");
      });
    });
    const grace = Number(d.attendance.graceMinutes) || 0;
    const seen = {};
    (d.attendance.latePenalties || []).forEach((t, i) => {
      const k = "attendance.latePenalties." + i;
      if (!(t.fromMin > grace)) put(k + ".fromMin", "Bậc phạt phải bắt đầu sau số phút cho phép đi trễ (" + grace + " phút).");
      else if (seen[t.fromMin]) put(k + ".fromMin", "Có hai bậc cùng bắt đầu từ " + t.fromMin + " phút.");
      seen[t.fromMin] = true;
      if (!(t.amount >= 0)) put(k + ".amount", "Tiền phạt không được âm.");
    });
    // Phan quyen
    Object.keys(d.permissions).forEach((r) => Object.keys(d.permissions[r]).forEach((k) => {
      const v = d.permissions[r][k];
      const t = (PERM[k] || [])[1];
      if (t === "pct" && !(v >= 0 && v <= 100)) put("permissions." + r + "." + k, "Mức giảm giá từ 0 đến 100%.");
      if (t === "money" && !(v >= 0)) put("permissions." + r + "." + k, "Số tiền không được âm.");
    }));
    // May in
    d.printers.forEach((p, i) => {
      if (!String(p.name || "").trim()) put("printers." + i + ".name", "Tên máy in không được để trống.");
      if (!(p.copies >= 1 && p.copies <= 5)) put("printers." + i + ".copies", "Số liên từ 1 đến 5.");
      if (p.backupId && p.backupId === p.id) put("printers." + i + ".backupId", "Máy dự phòng phải là máy khác.");
    });
    return e;
  }
  const errsUnder = (prefix) => Object.keys(ERR).filter((k) => k === prefix || k.startsWith(prefix + ".")).map((k) => ERR[k]);

  /* =====================================================================
     O NHAP (gan vao ban nhap qua data-set="duong.dan")
     ===================================================================== */
  const fid = (path) => "sf-" + path.replace(/[^a-zA-Z0-9_]/g, "-");
  function shown(type, v) {
    if (v === undefined || v === null) return "";
    if (type === "money") return U.moneyPlain(v);
    if (type === "num" || type === "pct") return String(v).replace(".", ",");
    return String(v);
  }
  // Giu nguyen chu dang go khi o dang duoc chon (tranh nhay con tro khi ve lai)
  function liveVal(path, fallback) {
    const ae = document.activeElement;
    if (ae && ae.id === fid(path) && ae.tagName === "INPUT" && ae.type === "text") return ae.value;
    return fallback;
  }
  function inp(path, type, o) {
    o = o || {};
    const v = U.get(draft(), path);
    const err = ERR[path];
    const im = o.inputmode || (type === "money" || type === "int" ? "numeric" : type === "num" || type === "pct" ? "decimal" : "");
    let h = '<input class="input' + (isNumType(type) ? " num" : "") + (err ? " invalid" : "") + (o.cls ? " " + o.cls : "") + '" type="text" id="' + fid(path) + '" data-set="' + esc(path) + '" data-t="' + type + '" value="' + esc(liveVal(path, shown(type, v))) + '"' +
      (im ? ' inputmode="' + im + '"' : "") + (o.placeholder ? ' placeholder="' + esc(o.placeholder) + '"' : "") + (o.maxlength ? ' maxlength="' + o.maxlength + '"' : "") + (o.aria ? ' aria-label="' + esc(o.aria) + '"' : "") + (err ? ' title="' + esc(err) + '"' : "") + ' autocomplete="off">';
    if (o.unit) h = '<div class="input-group' + (o.gcls ? " " + o.gcls : "") + '">' + h + '<span class="addon">' + esc(o.unit) + "</span></div>";
    return h;
  }
  function timeInp(path, o) {
    o = o || {};
    const v = U.get(draft(), path);
    return '<input class="input s-time' + (ERR[path] ? " invalid" : "") + '" type="time" id="' + fid(path) + '" data-set="' + esc(path) + '" data-t="time" value="' + esc(v || "") + '"' + (o.aria ? ' aria-label="' + esc(o.aria) + '"' : "") + ">";
  }
  function sel(path, options, o) {
    o = o || {};
    const v = U.get(draft(), path);
    return '<select class="select' + (ERR[path] ? " invalid" : "") + (o.cls ? " " + o.cls : "") + '" id="' + fid(path) + '" data-set="' + esc(path) + '" data-t="' + (o.t || "text") + '"' + (o.aria ? ' aria-label="' + esc(o.aria) + '"' : "") + ">" +
      options.map((op) => '<option value="' + esc(op.value) + '"' + (String(op.value) === String(v === undefined ? "" : v) ? " selected" : "") + ">" + esc(op.label) + "</option>").join("") + "</select>";
  }
  function sw(path, o) {
    o = o || {};
    const v = U.get(draft(), path);
    return '<label class="switch"' + (o.title ? ' title="' + esc(o.title) + '"' : "") + '><input type="checkbox" id="' + fid(path) + '" data-set="' + esc(path) + '" data-t="bool"' + (v ? " checked" : "") + (o.aria ? ' aria-label="' + esc(o.aria) + '"' : "") + "><span></span></label>";
  }
  function segCtl(path, options, t) {
    const v = U.get(draft(), path);
    return '<div class="seg">' + options.map((op) => '<button type="button" class="' + (String(op.value) === String(v) ? "active" : "") + '" data-act="settings.setv" data-path="' + esc(path) + '" data-value="' + esc(op.value) + '" data-t="' + (t || "text") + '">' + esc(op.label) + "</button>").join("") + "</div>";
  }
  function control(fd) {
    const v = U.get(draft(), fd.path);
    switch (fd.type) {
      case "bool": return '<span class="sr-state">' + (v ? "Đang bật" : "Đang tắt") + "</span>" + sw(fd.path, { aria: fd.label });
      case "money": case "int": case "num": case "pct":
        if (fd.slider) return '<input type="range" class="s-range" id="' + fid(fd.path) + '-r" data-set="' + esc(fd.path) + '" data-t="' + fd.type + '" min="' + fd.min + '" max="' + fd.max + '" step="' + (fd.step || 1) + '" value="' + esc(v) + '" aria-label="' + esc(fd.label) + '">' + inp(fd.path, fd.type, { unit: fd.unit, gcls: "s-num s-num-sm", aria: fd.label });
        return inp(fd.path, fd.type, { unit: fd.unit, gcls: fd.type === "money" ? "s-num s-money" : "s-num", aria: fd.label });
      case "text": return inp(fd.path, "text", { cls: "s-text", placeholder: fd.placeholder, maxlength: fd.maxlength, inputmode: fd.inputmode, aria: fd.label });
      case "time": return timeInp(fd.path, { aria: fd.label });
      case "select": return sel(fd.path, fd.options, { t: fd.t, aria: fd.label });
      case "seg": return segCtl(fd.path, fd.options, fd.t);
      case "tiers": return "";
    }
    return "";
  }
  function row(fd) {
    const v = U.get(draft(), fd.path), base = U.get(Store.config, fd.path), def = U.get(DEF, fd.path);
    const changed = !same(v, base);
    const err = ERR[fd.path] || (fd.type === "tiers" ? errsUnder(fd.path)[0] : null);
    const wide = fd.type === "tiers";
    return '<div class="set-row' + (changed ? " changed" : "") + (err ? " has-error" : "") + (wide ? " set-row-wide" : "") + '" data-row="' + esc(fd.path) + '">' +
      '<div class="sr-main"><div class="sr-label">' + esc(fd.label) + (changed ? '<span class="sr-tag">Đã sửa</span>' : "") + "</div>" +
      (fd.help ? '<div class="sr-help">' + esc(fd.help) + "</div>" : "") +
      '<div class="sr-default">Mặc định: ' + esc(fmtField(fd, def)) + (changed ? '<span class="sr-dot"></span>Đang áp dụng: <b>' + esc(fmtField(fd, base)) + '</b><button type="button" class="sr-undo" data-act="settings.revert" data-path="' + esc(fd.path) + '">' + I("undo-2") + "Hoàn tác</button>" : "") + "</div>" +
      (err ? '<div class="sr-err">' + I("circle-alert") + "<span>" + esc(err) + "</span></div>" : "") +
      (wide ? tiersEditor() : "") +
      "</div>" + (wide ? "" : '<div class="sr-control">' + control(fd) + "</div>") + "</div>";
  }
  function cardShell(c, body, o) {
    o = o || {};
    const errs = o.errs || [];
    return '<section class="set-card" id="card-' + c.id + '">' +
      '<div class="set-card-head"><div class="grow"><h3>' + esc(c.title) + (o.badge || "") + "</h3>" + (c.desc ? "<p>" + esc(c.desc) + "</p>" : "") + "</div>" + (o.head ? '<div class="row wrap set-card-actions">' + o.head + "</div>" : "") + "</div>" +
      (errs.length ? '<div class="set-card-errs">' + UI.banner("danger", "circle-alert", "<b>Cần sửa trước khi lưu:</b><ul>" + Array.from(new Set(errs)).slice(0, 6).map((m) => "<li>" + esc(m) + "</li>").join("") + "</ul>") + "</div>" : "") +
      body + "</section>";
  }
  function example(text) {
    return '<div class="set-example">' + I("info") + "<div>" + text + "</div></div>";
  }
  function scalarCard(c, fields) {
    const d = draft();
    fields = fields || (c.fieldsFn ? c.fieldsFn(d) : c.fields);
    const rows = fields.map(row).join("");
    const ex = c.example ? example(c.example(d)) : "";
    if (c.side) return cardShell(c, '<div class="set-split"><div class="set-split-main">' + rows + '</div><aside class="set-split-side">' + c.side(d) + "</aside></div>" + ex);
    return cardShell(c, rows + ex);
  }
  function renderCard(c) {
    return c.render ? c.render() : scalarCard(c);
  }

  /* =====================================================================
     VI DU TINH TRUC TIEP (doc tu ban nhap)
     ===================================================================== */
  const hm = (m) => U.pad(Math.floor(((m % 1440) + 1440) % 1440 / 60)) + ":" + U.pad(((m % 60) + 60) % 60);
  function exVip(d) {
    const v = d.vip;
    const calc = (mins, spend) => {
      const billable = Math.max(0, mins - (Number(v.freeMinutes) || 0));
      const hours = Math.ceil(billable / 60);
      const fee = hours * (Number(v.hourlyRate) || 0);
      const waived = v.minimumSpendEnabled && spend >= (Number(v.minimumSpend) || 0);
      return { hours, fee, waived };
    };
    const a = calc(140, 2500000), b = calc(140, 3500000);
    const s = (x, spend) => "gọi món " + U.money(spend) + " → " + (x.waived ? "<b>miễn phụ thu</b> vì đạt mức chi tối thiểu" : "phụ thu <b>" + x.hours + " giờ x " + U.money(v.hourlyRate) + " = " + U.money(x.fee) + "</b>");
    return "Ví dụ: khách ngồi phòng VIP 2 giờ 20 phút, " + s(a, 2500000) + "; nếu " + s(b, 3500000) + ".";
  }
  function exBooking(d) {
    const b = d.booking;
    if (!validTime(b.slotStart) || !validTime(b.slotEnd)) return "Nhập giờ bắt đầu và kết thúc để xem các mốc giờ khách chọn được.";
    const out = [];
    for (let m = U.minutesOf(b.slotStart); m <= U.minutesOf(b.slotEnd) && out.length < 80; m += Math.max(5, Number(b.slotStep) || 30)) out.push(hm(m));
    const list = out.length > 10 ? out.slice(0, 8).join(", ") + ", ... " + out[out.length - 1] : out.join(", ");
    return "Khách chọn được <b>" + out.length + " mốc giờ</b>: " + esc(list) + ". " + (b.depositRequired ? "Cọc " + U.money(b.depositNormal) + " (VIP " + U.money(b.depositVip) + "), giữ bàn " + b.holdMinutes + " phút chờ chuyển khoản." : "Không yêu cầu đặt cọc.");
  }
  function lateFine(d, lateMin) {
    const a = d.attendance;
    if (lateMin <= (Number(a.graceMinutes) || 0)) return 0;
    let amt = 0;
    (a.latePenalties || []).slice().sort((x, y) => x.fromMin - y.fromMin).forEach((t) => { if (lateMin >= t.fromMin) amt = Number(t.amount) || 0; });
    return amt;
  }
  function exLate(d) {
    const a = d.attendance;
    const g = Number(a.graceMinutes) || 0;
    const parts = [3, 12, 35].map((m) => "trễ " + m + " phút → " + (lateFine(d, m) ? "<b>phạt " + U.money(lateFine(d, m)) + "</b>" : "không phạt"));
    const checks = [a.wifiRequired ? "Wi-Fi " + esc(a.wifiName || "") : null, a.gpsRequired ? "trong bán kính " + a.gpsRadius + " m" : null, a.selfieRequired ? "chụp ảnh khuôn mặt" : null].filter(Boolean);
    return "Ví dụ: " + parts.join("; ") + " (cho phép trễ " + g + " phút). Điều kiện chấm công: " + (checks.length ? checks.join(", ") : "không kiểm tra") + ".";
  }
  function exOvertime(d) {
    const buf = Number(d.attendance.cleanupBuffer) || 0;
    const last = 23 * 60 + 55, out = 24 * 60 + 40;
    const cap = last + buf;
    const pend = Math.max(0, out - cap);
    return "Ví dụ: bàn cuối đóng bill lúc 23:55, nhân viên ra ca lúc 00:40 → tính công đến <b>" + hm(Math.min(out, cap)) + "</b>" + (pend ? ", <b>" + pend + " phút</b> còn lại chờ Chủ quán duyệt tăng ca." : ", không có phút nào phải chờ duyệt.") + " Giờ làm sau " + esc(d.attendance.nightStart) + " được nhân hệ số " + String(d.attendance.nightMultiplier).replace(".", ",") + ".";
  }
  function exPayroll(d) {
    const p = d.payroll;
    const salary = 9000000;
    const day = salary / (Number(p.workDaysPerMonth) || 26);
    const hour = day / (Number(p.standardHoursPerDay) || 8);
    return "Ví dụ: lương tháng " + U.money(salary) + " → một ngày công <b>" + U.money(day) + "</b>, một giờ <b>" + U.money(hour) + "</b>; tăng ca một giờ " + U.money(hour * (Number(d.attendance.otMultiplier) || 1)) + ". Đã làm 15 ngày được ứng tối đa " + U.money(day * 15 * (Number(p.advanceCapPct) || 0) / 100) + ".";
  }
  function exTax(d) {
    const t = d.tax;
    const vat = (gross, r) => (t.pricesIncludeVat ? Math.round((gross * r) / (100 + r)) : Math.round((gross * r) / 100));
    const vf = vat(1000000, Number(t.food) || 0), va = vat(500000, Number(t.alcohol) || 0);
    return "Ví dụ: bill 1.000.000 đ đồ ăn và 500.000 đ bia → thuế GTGT " + U.money(vf) + " + " + U.money(va) + " = <b>" + U.money(vf + va) + "</b>, " + (t.pricesIncludeVat ? "đã gồm trong giá, khách trả 1.500.000 đ." : "cộng thêm, khách trả " + U.money(1500000 + vf + va) + ".") + (t.mode === "hkd" ? " Thuế khoán trên doanh thu 1 tỷ đồng: " + U.money((1e9 * (Number(t.hkdRate) || 0)) / 100) + "." : "");
  }
  function exMode(d) {
    return d.tax.mode === "company"
      ? "<b>Công ty TNHH:</b> kê khai thuế GTGT theo hóa đơn đầu ra, đầu vào. Hệ thống xuất dữ liệu XML và Excel cho MISA, HTKK; hóa đơn điện tử phát hành qua " + esc(d.tax.einvoiceProvider) + "."
      : "<b>Hộ kinh doanh:</b> nộp thuế khoán theo tỷ lệ " + String(d.tax.hkdRate).replace(".", ",") + "% trên doanh thu. Hệ thống lập sổ theo mẫu S1-HKD, S2-HKD và tờ khai 01/CNKD.";
  }

  /* =====================================================================
     NHOM 1 - SO DO BAN
     ===================================================================== */
  const efW = (t) => (t.type === "vip" ? 120 : 72);
  function floorCard() {
    const d = draft(), st = S();
    const aIdx = {};
    d.areas.forEach((a, i) => (aIdx[a.id] = i % 6));
    const maxY = Math.max(0, ...d.tables.map((t) => (Number(t.y) || 0) + 56));
    const maxX = Math.max(0, ...d.tables.map((t) => (Number(t.x) || 0) + efW(t)));
    const h = Math.max(420, maxY + 96);
    const baseIds = {};
    Store.config.tables.forEach((t) => (baseIds[t.id] = t));
    const tiles = d.tables.map((t) => {
      const b = baseIds[t.id];
      const ch = !b ? " ef-new" : !same(b, t) ? " ef-changed" : "";
      const busy = Engine.ticketByTable(t.id);
      return '<div class="ef-table ef-a' + (aIdx[t.areaId] === undefined ? "x" : aIdx[t.areaId]) + (t.type === "vip" ? " vip" : "") + (st.selTable === t.id ? " sel" : "") + ch + '" data-tid="' + esc(t.id) + '" style="left:' + (Number(t.x) || 0) + "px;top:" + (Number(t.y) || 0) + 'px" title="' + esc(t.code + " · " + t.seats + " chỗ") + '">' +
        "<span>" + esc(t.code || "?") + "</span><small>" + t.seats + " chỗ</small>" + (busy ? '<i class="ef-busy" title="Đang có khách"></i>' : "") + "</div>";
    }).join("");
    const legend = d.areas.map((a, i) => '<span class="ef-leg"><i class="ef-a' + (i % 6) + '"></i>' + esc(a.name) + ' <b class="num">' + d.tables.filter((t) => t.areaId === a.id).length + "</b></span>").join("");
    const sel = d.tables.find((t) => t.id === st.selTable);
    return cardShell(CARD.floor,
      '<div class="ef-wrap"><div class="ef-stage"><div class="ef-legend">' + legend + '<span class="grow"></span><span class="small muted">' + d.tables.length + " bàn · " + U.num(U.sum(d.tables, (t) => t.seats)) + ' chỗ ngồi</span></div>' +
      '<div class="editor-floor" id="ef-canvas" style="height:' + h + "px;min-width:" + (maxX + 24) + 'px">' + tiles + "</div>" +
      '<div class="ef-hint small muted">' + I("move", "ic-sm") + "Kéo thả để di chuyển. Khi đang chọn một bàn, dùng phím mũi tên để dịch từng 8 px.</div></div>" +
      '<aside class="ef-insp">' + (sel ? inspector(sel) : '<div class="ef-insp-empty">' + I("armchair", "ic-xl") + "<b>Chưa chọn bàn</b><span>Chạm vào một bàn trên sơ đồ để sửa mã, khu vực, số chỗ và loại bàn.</span></div>") + "</aside></div>",
      { head: UI.btn("Thêm bàn", { act: "settings.tableAdd", icon: "plus", size: "sm" }) });
  }
  function inspector(t) {
    const d = draft();
    const i = d.tables.indexOf(t);
    const p = "tables." + i;
    const busy = Engine.ticketByTable(t.id);
    const fe = (k) => (ERR[p + "." + k] ? '<div class="err">' + esc(ERR[p + "." + k]) + "</div>" : "");
    return '<div class="ef-insp-head"><div><div class="small muted">Đang chọn</div><h4>' + esc(t.code || "Bàn mới") + "</h4></div>" + (busy ? UI.badge("Đang có khách", "primary", true) : UI.badge("Trống", "")) + "</div>" +
      '<div class="field"><label for="' + fid(p + ".code") + '">Mã bàn</label>' + inp(p + ".code", "text", { maxlength: 12 }) + fe("code") + "</div>" +
      '<div class="field"><label for="' + fid(p + ".areaId") + '">Khu vực</label>' + sel(p + ".areaId", d.areas.map((a) => ({ value: a.id, label: a.name }))) + fe("areaId") + "</div>" +
      '<div class="field"><label for="' + fid(p + ".seats") + '">Số chỗ ngồi</label>' + inp(p + ".seats", "int", { unit: "chỗ" }) + fe("seats") + "</div>" +
      '<div class="field"><label>Loại bàn</label>' + segCtl(p + ".type", [{ value: "normal", label: "Bàn thường" }, { value: "vip", label: "Phòng VIP" }]) + "</div>" +
      '<div class="grid-2" style="gap:8px"><div class="field"><label for="' + fid(p + ".x") + '">Ngang (X)</label>' + inp(p + ".x", "int", { unit: "px" }) + '</div><div class="field"><label for="' + fid(p + ".y") + '">Dọc (Y)</label>' + inp(p + ".y", "int", { unit: "px" }) + "</div></div>" +
      '<div class="row wrap mt-4">' + UI.btn("Nhân bản", { act: "settings.tableDup", data: { id: t.id }, icon: "layers", size: "sm" }) + '<span class="grow"></span>' + UI.btn("Xóa bàn", { act: "settings.tableDel", data: { id: t.id }, icon: "trash-2", size: "sm", kind: "danger" }) + "</div>";
  }
  function areasCard() {
    const d = draft();
    const baseT = {};
    Store.config.tables.forEach((t) => (baseT[t.id] = t));
    const areaRows = d.areas.map((a, i) => {
      const n = d.tables.filter((t) => t.areaId === a.id).length;
      return '<div class="area-chip">' + inp("areas." + i + ".name", "text", { aria: "Tên khu vực", maxlength: 40 }) + '<span class="small muted nowrap">' + n + " bàn</span>" + UI.iconBtn("trash-2", { act: "settings.areaDel", data: { id: a.id }, title: "Xóa khu vực " + a.name }) + "</div>";
    }).join("");
    const areaOpts = d.areas.map((a) => ({ value: a.id, label: a.name }));
    const rows = d.tables.map((t, i) => {
      const p = "tables." + i;
      const b = baseT[t.id];
      const tag = !b ? UI.badge("Mới", "primary") : !same(b, t) ? UI.badge("Đã sửa", "warning") : "";
      const busy = Engine.ticketByTable(t.id);
      return '<tr class="' + (!b ? "tr-new" : !same(b, t) ? "tr-changed" : "") + '"><td style="width:140px">' + inp(p + ".code", "text", { cls: "input-sm", aria: "Mã bàn", maxlength: 12 }) + "</td><td>" + sel(p + ".areaId", areaOpts, { cls: "input-sm", aria: "Khu vực" }) + '</td><td style="width:120px">' + inp(p + ".seats", "int", { cls: "input-sm", unit: "chỗ", aria: "Số chỗ" }) + '</td><td style="width:150px">' + sel(p + ".type", opts(TYPE_LABEL), { cls: "input-sm", aria: "Loại bàn" }) + "</td><td>" + (busy ? UI.badge("Có khách", "primary") : "") + " " + tag + '</td><td class="right">' + UI.iconBtn("trash-2", { act: "settings.tableDel", data: { id: t.id }, title: "Xóa bàn " + t.code }) + "</td></tr>";
    }).join("");
    return cardShell(CARD.areas,
      '<div class="card-body"><div class="section-title">Khu vực</div><div class="area-list">' + areaRows + '<button type="button" class="area-add" data-act="settings.areaAdd">' + I("plus") + "Thêm khu vực</button></div></div>" +
      '<div class="table-wrap set-list"><table class="dt"><thead><tr><th>Mã bàn</th><th>Khu vực</th><th>Số chỗ</th><th>Loại</th><th>Trạng thái</th><th></th></tr></thead><tbody>' + rows + "</tbody></table></div>",
      { errs: errsUnder("areas").concat(errsUnder("tables")), head: UI.btn("Thêm bàn", { act: "settings.tableAdd", icon: "plus", size: "sm" }) });
  }

  /* =====================================================================
     NHOM 2 - THUC DON
     ===================================================================== */
  const priceOf = (m) => Number(m.kind === "seafood" ? m.pricePerKg : m.price) || 0;
  const costOf = (m) => Number(m.kind === "seafood" ? m.costPerKg : m.cost) || 0;
  const marginOf = (m) => (priceOf(m) ? ((priceOf(m) - costOf(m)) / priceOf(m)) * 100 : 0);
  function marginBadge(pct, th) {
    return UI.badge(U.pct(pct), pct < th ? "danger" : pct < th + 10 ? "warning" : "success");
  }
  function menuCard() {
    const d = draft(), st = S();
    const th = Number(d.marginAlert) || 0;
    const base = {};
    Store.config.menu.forEach((m) => (base[m.id] = m));
    const cats = d.categories.slice().sort((a, b) => (a.order || 0) - (b.order || 0));
    let list = d.menu.map((m, i) => ({ m, i }));
    if (st.menuCat !== "all") list = list.filter((x) => x.m.categoryId === st.menuCat);
    if (st.menuQ) list = list.filter((x) => U.match(x.m.name, st.menuQ));
    const low = d.menu.filter((m) => m.active && marginOf(m) < th).length;
    const rows = list.map(({ m, i }) => {
      const b = base[m.id];
      const tag = !b ? UI.badge("Mới", "primary") : !same(b, m) ? UI.badge("Đã sửa", "warning") : "";
      const unit = m.kind === "seafood" ? "/kg" : m.unit ? "/" + m.unit : "";
      return '<tr class="' + (m.active ? "" : "tr-muted ") + (!b ? "tr-new" : !same(b, m) ? "tr-changed" : "") + '">' +
        '<td><div class="strong">' + esc(m.name) + '</div><div class="row gap-4 wrap mt-4">' + (m.popular ? UI.badge("Gọi nhiều", "") : "") + (m.bom && m.bom.length ? UI.badge("Trừ " + m.bom.length + " loại túi", "info") : "") + tag + "</div></td>" +
        "<td>" + esc(lookName("categories", m.categoryId)) + '</td><td class="nowrap">' + esc(KIND_LABEL[m.kind] || m.kind) + '</td><td class="num">' + U.moneyPlain(priceOf(m)) + '<span class="muted small">' + esc(unit) + '</span></td><td class="num">' + U.moneyPlain(costOf(m)) + '</td><td class="num">' + marginBadge(marginOf(m), th) + "</td>" +
        '<td class="center">' + sw("menu." + i + ".active", { aria: "Đang bán " + m.name, title: m.active ? "Đang bán" : "Đang ẩn" }) + '</td><td class="right">' + UI.iconBtn("pencil", { act: "settings.menuEdit", data: { id: m.id }, title: "Sửa " + m.name }) + "</td></tr>";
    }).join("");
    const catOpts = [{ value: "all", label: "Tất cả nhóm (" + d.menu.length + ")" }].concat(cats.map((c) => ({ value: c.id, label: c.name + " (" + d.menu.filter((m) => m.categoryId === c.id).length + ")" })));
    return cardShell(CARD.menulist,
      '<div class="set-toolbar">' + UI.search({ id: "set-menu-q", model: "settings.menuQ", placeholder: "Tìm món, gõ không dấu cũng được", value: st.menuQ }) + UI.select({ id: "set-menu-cat", model: "settings.menuCat", live: true, value: st.menuCat, options: catOpts }) +
      (low ? '<span class="badge badge-danger">' + low + " món dưới ngưỡng biên lãi " + th + "%</span>" : '<span class="badge badge-success">Mọi món đạt ngưỡng biên lãi ' + th + "%</span>") + "</div>" +
      (rows ? '<div class="table-wrap set-list"><table class="dt"><thead><tr><th>Món</th><th>Nhóm</th><th>Loại</th><th class="num">Giá bán</th><th class="num">Giá vốn</th><th class="num">Biên lãi</th><th class="center">Đang bán</th><th></th></tr></thead><tbody>' + rows + "</tbody></table></div>" : UI.empty("search", "Không tìm thấy món", "Thử từ khóa khác hoặc chọn Tất cả nhóm.")),
      { errs: errsUnder("menu"), head: UI.btn("Thêm món", { act: "settings.menuNew", icon: "plus", size: "sm" }) });
  }
  function categoriesCard() {
    const d = draft();
    const rows = d.categories.map((c, i) => {
      const p = "categories." + i;
      const n = d.menu.filter((m) => m.categoryId === c.id).length;
      return "<tr><td>" + inp(p + ".name", "text", { cls: "input-sm", aria: "Tên nhóm" }) + '</td><td style="width:150px">' + sel(p + ".kind", opts(CAT_KIND), { cls: "input-sm", aria: "Khu chế biến" }) + '</td><td style="width:230px">' + sel(p + ".vatGroup", [{ value: "food", label: "Đồ ăn - nước ngọt (" + d.tax.food + "%)" }, { value: "alcohol", label: "Rượu bia (" + d.tax.alcohol + "%)" }], { cls: "input-sm", aria: "Nhóm thuế" }) + '</td><td style="width:90px">' + inp(p + ".order", "int", { cls: "input-sm", aria: "Thứ tự" }) + '</td><td class="num muted">' + n + ' món</td><td class="right">' + UI.iconBtn("trash-2", { act: "settings.catDel", data: { id: c.id }, title: "Xóa nhóm " + c.name }) + "</td></tr>";
    }).join("");
    return cardShell(CARD.categories, '<div class="table-wrap set-list"><table class="dt"><thead><tr><th>Tên nhóm</th><th>Khu chế biến</th><th>Nhóm thuế</th><th>Thứ tự</th><th class="num">Số món</th><th></th></tr></thead><tbody>' + rows + "</tbody></table></div>",
      { errs: errsUnder("categories"), head: UI.btn("Thêm nhóm", { act: "settings.catAdd", icon: "plus", size: "sm" }) });
  }
  function stylesCard() {
    const d = draft();
    const rows = d.styles.map((s, i) => {
      const n = d.menu.filter((m) => (m.styles || []).includes(s.id)).length;
      return "<tr><td>" + inp("styles." + i + ".name", "text", { cls: "input-sm", aria: "Tên kiểu chế biến" }) + '</td><td style="width:180px">' + inp("styles." + i + ".surcharge", "money", { cls: "input-sm", unit: "đ", aria: "Phụ thu" }) + '</td><td class="num muted">' + n + ' món</td><td class="right">' + UI.iconBtn("trash-2", { act: "settings.styleDel", data: { id: s.id }, title: "Xóa " + s.name }) + "</td></tr>";
    }).join("");
    return cardShell(CARD.styles, '<div class="table-wrap set-list"><table class="dt"><thead><tr><th>Kiểu chế biến</th><th>Phụ thu</th><th class="num">Dùng cho</th><th></th></tr></thead><tbody>' + rows + "</tbody></table></div>",
      { errs: errsUnder("styles"), head: UI.btn("Thêm kiểu", { act: "settings.styleAdd", icon: "plus", size: "sm" }) });
  }
  function bagsCard() {
    const d = draft();
    const rows = d.bags.map((b, i) => {
      const p = "bags." + i;
      const n = d.menu.filter((m) => (m.bom || []).some((x) => x.bagId === b.id)).length;
      return "<tr><td>" + inp(p + ".name", "text", { cls: "input-sm", aria: "Tên túi" }) + '</td><td style="width:120px">' + inp(p + ".gram", "int", { cls: "input-sm", unit: "g", aria: "Khối lượng" }) + '</td><td style="width:120px">' + inp(p + ".minStock", "int", { cls: "input-sm", unit: "túi", aria: "Tồn tối thiểu" }) + '</td><td style="width:170px">' + inp(p + ".cost", "money", { cls: "input-sm", unit: "đ", aria: "Giá vốn" }) + '</td><td class="num muted">' + n + ' món</td><td class="right">' + UI.iconBtn("trash-2", { act: "settings.bagDel", data: { id: b.id }, title: "Xóa " + b.name }) + "</td></tr>";
    }).join("");
    return cardShell(CARD.bags, '<div class="table-wrap set-list"><table class="dt"><thead><tr><th>Tên túi</th><th>Khối lượng</th><th>Tồn tối thiểu</th><th>Giá vốn mỗi túi</th><th class="num">Dùng cho</th><th></th></tr></thead><tbody>' + rows + "</tbody></table></div>",
      { errs: errsUnder("bags"), head: UI.btn("Thêm túi", { act: "settings.bagAdd", icon: "plus", size: "sm" }) });
  }

  /* =====================================================================
     NHOM 3 - KHUYEN MAI
     ===================================================================== */
  function promoSentence(p, d) {
    const m = d.menu.find((x) => x.id === p.menuId);
    const b = d.brands.find((x) => x.id === p.brandId);
    return "Mua " + (p.buyQty || 0) + " tặng " + (p.freeQty || 0) + (m ? " " + m.name : "") + ", " + (p.source === "brand" ? "trừ quỹ hãng" + (b ? " " + b.name : "") : "quán tự chịu chi phí") + ", " + (p.requireCapReturn ? "bắt buộc thu nắp" : "không cần thu nắp") + ".";
  }
  function promosCard() {
    const d = draft();
    const base = {};
    Store.config.promos.forEach((p) => (base[p.id] = p));
    const items = d.promos.map((p, i) => {
      const k = "promos." + i;
      const beers = d.menu.filter((m) => m.kind === "beer" || m.kind === "drink");
      const ofBrand = beers.filter((m) => m.brandId === p.brandId);
      const menuOpts = (ofBrand.length ? ofBrand : beers).map((m) => ({ value: m.id, label: m.name }));
      if (p.menuId && !menuOpts.find((o) => o.value === p.menuId)) menuOpts.unshift({ value: p.menuId, label: lookName("menu", p.menuId) });
      const b = base[p.id];
      const fe = (x) => (ERR[k + "." + x] ? '<div class="err">' + esc(ERR[k + "." + x]) + "</div>" : "");
      return '<div class="promo-item' + (p.active ? "" : " off") + (!b ? " is-new" : !same(b, p) ? " is-changed" : "") + '">' +
        '<div class="promo-top"><div class="promo-sentence">' + I("ticket") + "<span>" + esc(promoSentence(p, d)) + "</span></div>" +
        '<div class="row">' + (p.active ? UI.badge("Đang chạy", "success", true) : UI.badge("Đang tắt", "", true)) + sw(k + ".active", { aria: "Bật chương trình" }) + UI.iconBtn("trash-2", { act: "settings.promoDel", data: { id: p.id }, title: "Xóa chương trình" }) + "</div></div>" +
        '<div class="promo-grid">' +
        '<div class="field"><label>Tên chương trình</label>' + inp(k + ".name", "text", { placeholder: "Tự đặt tên nếu để trống", maxlength: 60 }) + "</div>" +
        '<div class="field"><label>Hãng</label>' + sel(k + ".brandId", d.brands.map((x) => ({ value: x.id, label: x.name }))) + "</div>" +
        '<div class="field"><label>Áp dụng cho</label>' + sel(k + ".menuId", menuOpts) + fe("menuId") + "</div>" +
        '<div class="field"><label>Mua</label>' + inp(k + ".buyQty", "int", { unit: "lon" }) + fe("buyQty") + "</div>" +
        '<div class="field"><label>Tặng</label>' + inp(k + ".freeQty", "int", { unit: "lon" }) + fe("freeQty") + "</div>" +
        '<div class="field"><label>Nguồn trừ</label>' + segCtl(k + ".source", [{ value: "brand", label: "Quỹ hãng" }, { value: "house", label: "Quán chịu" }]) + "</div>" +
        '<div class="field"><label>Thu hồi nắp</label><label class="check">' + sw(k + ".requireCapReturn", { aria: "Bắt buộc thu nắp" }) + "<span>" + (p.requireCapReturn ? "Bắt buộc thu nắp" : "Không cần") + "</span></label></div>" +
        "</div></div>";
    }).join("");
    return cardShell(CARD.promos, '<div class="promo-list">' + (items || UI.empty("ticket", "Chưa có chương trình khuyến mãi", "Bấm Thêm chương trình để tạo chương trình mua tặng đầu tiên.")) + "</div>",
      { errs: errsUnder("promos"), head: UI.btn("Thêm chương trình", { act: "settings.promoAdd", icon: "plus", size: "sm" }) });
  }
  function brandsCard() {
    const d = draft();
    const rows = d.brands.map((b, i) => {
      const k = "brands." + i;
      return "<tr><td>" + inp(k + ".name", "text", { cls: "input-sm", aria: "Tên hãng" }) + '</td><td style="width:120px">' + inp(k + ".rebateTarget", "int", { cls: "input-sm", aria: "Chỉ tiêu" }) + '</td><td style="width:100px">' + inp(k + ".rebateUnit", "text", { cls: "input-sm", aria: "Đơn vị", maxlength: 10 }) + '</td><td style="width:120px">' + sel(k + ".rebatePeriod", opts(PERIOD), { cls: "input-sm", aria: "Kỳ" }) + '</td><td style="width:190px">' + inp(k + ".rebateAmount", "money", { cls: "input-sm", unit: "đ", aria: "Tiền thưởng" }) + '</td><td class="right">' + UI.iconBtn("trash-2", { act: "settings.brandDel", data: { id: b.id }, title: "Xóa hãng " + b.name }) + "</td></tr>";
    }).join("");
    return cardShell(CARD.brands, '<div class="table-wrap set-list"><table class="dt"><thead><tr><th>Hãng</th><th>Chỉ tiêu</th><th>Đơn vị</th><th>Kỳ</th><th>Tiền thưởng khi đạt</th><th></th></tr></thead><tbody>' + rows + "</tbody></table></div>",
      { errs: errsUnder("brands"), head: UI.btn("Thêm hãng", { act: "settings.brandAdd", icon: "plus", size: "sm" }) });
  }

  /* =====================================================================
     NHOM 5 - CA LAM, BAC PHAT
     ===================================================================== */
  const segMinutes = (g) => (validTime(g.start) && validTime(g.end) ? (U.minutesOf(g.end) - U.minutesOf(g.start) + 1440) % 1440 : 0);
  function shiftsCard() {
    const d = draft();
    const base = {};
    Store.config.shifts.forEach((s) => (base[s.id] = s));
    const items = d.shifts.map((s, i) => {
      const k = "shifts." + i;
      const staff = Store.data.staff.filter((x) => x.shiftId === s.id && x.active).length;
      const total = U.sum(s.segments, segMinutes);
      const b = base[s.id];
      const segs = s.segments.map((g, j) => {
        const sk = k + ".segments." + j;
        const e2 = ERR[sk + ".start"] || ERR[sk + ".end"];
        return '<div class="seg-row"><span class="seg-no">Mốc ' + (j + 1) + "</span>" + timeInp(sk + ".start", { aria: "Giờ vào" }) + '<span class="muted">đến</span>' + timeInp(sk + ".end", { aria: "Giờ ra" }) + '<span class="small muted nowrap">' + U.num(segMinutes(g) / 60, segMinutes(g) % 60 ? 1 : 0) + " giờ" + (validTime(g.end) && validTime(g.start) && U.minutesOf(g.end) < U.minutesOf(g.start) ? " · qua đêm" : "") + "</span>" +
          (s.segments.length > 1 ? UI.iconBtn("x", { act: "settings.segDel", data: { shift: s.id, seg: j }, title: "Bỏ mốc " + (j + 1) }) : "") + (e2 ? '<div class="err seg-err">' + esc(e2) + "</div>" : "") + "</div>";
      }).join("");
      return '<div class="shift-item' + (!b ? " is-new" : !same(b, s) ? " is-changed" : "") + '"><div class="shift-head">' + inp(k + ".name", "text", { aria: "Tên ca", maxlength: 40, cls: "shift-name" }) +
        '<span class="small muted nowrap">' + U.num(total / 60, total % 60 ? 1 : 0) + " giờ · " + staff + " nhân viên</span>" + UI.iconBtn("trash-2", { act: "settings.shiftDel", data: { id: s.id }, title: "Xóa ca " + s.name }) + "</div>" +
        (ERR[k + ".name"] ? '<div class="err">' + esc(ERR[k + ".name"]) + "</div>" : "") +
        '<div class="seg-list">' + segs + "</div>" +
        (s.segments.length < 4 ? '<button type="button" class="link-btn" data-act="settings.segAdd" data-shift="' + esc(s.id) + '">' + I("plus", "ic-sm") + "Thêm mốc giờ (ca gãy)</button>" : "") + "</div>";
    }).join("");
    return cardShell(CARD.shiftlist, '<div class="shift-list">' + items + "</div>", { errs: errsUnder("shifts"), head: UI.btn("Thêm ca", { act: "settings.shiftAdd", icon: "plus", size: "sm" }) });
  }
  function tiersEditor() {
    const d = draft();
    const tiers = d.attendance.latePenalties || [];
    const g = Number(d.attendance.graceMinutes) || 0;
    const sorted = tiers.slice().sort((a, b) => a.fromMin - b.fromMin);
    const summary = [g ? "Trễ đến " + g + " phút: không phạt" : null].concat(sorted.map((t, i) => {
      const next = sorted[i + 1];
      return "Trễ " + (next ? t.fromMin + " - " + (next.fromMin - 1) + " phút" : "từ " + t.fromMin + " phút") + ": " + U.money(t.amount);
    })).filter(Boolean);
    return '<div class="tiers">' + tiers.map((t, i) => {
      const k = "attendance.latePenalties." + i;
      return '<div class="tier-row"><span class="small muted nowrap">Từ phút thứ</span>' + inp(k + ".fromMin", "int", { unit: "phút", gcls: "s-num", aria: "Từ phút" }) + '<span class="small muted nowrap">phạt</span>' + inp(k + ".amount", "money", { unit: "đ", gcls: "s-num s-money", aria: "Tiền phạt" }) + UI.iconBtn("x", { act: "settings.tierDel", data: { i }, title: "Bỏ bậc này" }) +
        (ERR[k + ".fromMin"] || ERR[k + ".amount"] ? '<div class="err">' + esc(ERR[k + ".fromMin"] || ERR[k + ".amount"]) + "</div>" : "") + "</div>";
    }).join("") +
      '<div class="row wrap"><button type="button" class="link-btn" data-act="settings.tierAdd">' + I("plus", "ic-sm") + "Thêm bậc phạt</button>" + (tiers.length ? "" : '<span class="small muted">Đang tắt phạt đi trễ</span>') + "</div>" +
      (summary.length ? '<div class="tier-sum">' + summary.map((x) => "<span>" + esc(x) + "</span>").join("") + "</div>" : "") + "</div>";
  }

  const CARD = {};
  CARDS.forEach((c) => (CARD[c.id] = c));

  /* =====================================================================
     NHOM 6 - NHAN VIEN, PHAN QUYEN, THE SO LIEU
     ===================================================================== */
  const PAY_LABEL = { monthly: "Theo tháng", hourly: "Theo giờ", shift: "Theo ca", none: "Không hưởng lương" };
  function staffRateVal(s) {
    if (!s) return 0;
    if (s.payType === "hourly") return Number(s.hourlyRate || s.baseRate || 0);
    return Number(s.baseSalary || s.baseRate || 0);
  }
  function staffCard() {
    const st = S();
    const list = Store.data.staff;
    const rows = list.map((s) => {
      const sh = draft().shifts.find((x) => x.id === s.shiftId);
      const rate = s.payType === "none" ? "Chủ quán" : U.money(staffRateVal(s)) + (s.payType === "monthly" ? "/tháng" : s.payType === "hourly" ? "/giờ" : "/ca");
      const pinTxt = st.showPins ? '<code class="pin-code">' + esc(s.pin) + "</code>" : "••••";
      return '<tr class="' + (s.active ? "" : "tr-muted") + '">' +
        '<td><div class="row gap-8">' + UI.avatar(s.name) + '<div><div class="strong">' + esc(s.name) + '</div><div class="small muted">' + esc(s.phone || "") + "</div></div></div></td>" +
        "<td>" + UI.badge(Engine.roleLabel(s.role), s.role === "owner" ? "violet" : "primary") + "</td>" +
        "<td>" + esc(sh ? sh.name : "-") + "</td>" +
        '<td class="num">' + esc(rate) + "</td>" +
        '<td class="num">' + pinTxt + "</td>" +
        "<td>" + (s.active ? UI.badge("Đang làm", "success", true) : UI.badge("Đã khóa", "danger", true)) + "</td>" +
        '<td class="right">' + UI.btn("Sửa", { size: "sm", icon: "pencil", act: "settings.staffEdit", data: { id: s.id } }) + "</td></tr>";
    }).join("");
    return cardShell(CARD.staff,
      '<div class="table-wrap set-list"><table class="dt"><thead><tr><th>Nhân viên</th><th>Vai trò</th><th>Ca mặc định</th><th class="num">Mức lương</th><th class="num">Mã PIN</th><th>Trạng thái</th><th></th></tr></thead><tbody>' + rows + "</tbody></table></div>",
      {
        head: UI.btn(st.showPins ? "Ẩn mã PIN" : "Hiện mã PIN", { size: "sm", icon: st.showPins ? "eye-off" : "eye", act: "settings.togglePins" }) +
          UI.btn("Thêm nhân viên", { size: "sm", kind: "primary", icon: "plus", act: "settings.staffNew" }),
      }
    );
  }

  function roleList(d) {
    const r = (d && d.roles) || {};
    if (Array.isArray(r)) return r;
    return Object.keys(r).map((id) => ({ id, name: (r[id] && (r[id].label || r[id].name)) || id }));
  }

  function permsCard() {
    const d = draft();
    const roles = roleList(d).filter((r) => r.id !== "owner");
    const keys = Object.keys(PERM);
    const head = "<th>Quyền thao tác</th>" + roles.map((r) => '<th class="center">' + esc(r.name) + "</th>").join("");
    const rows = keys.map((k) => {
      const [label, type, unit] = PERM[k];
      const cells = roles.map((r) => {
        const rm = d.permissions[r.id] || {};
        if (rm[k] === undefined) return '<td class="center muted">-</td>';
        const path = "permissions." + r.id + "." + k;
        if (type === "bool") return '<td class="center">' + sw(path, { aria: label + " - " + r.name }) + "</td>";
        if (type === "pct") return '<td class="center" style="min-width:130px">' + inp(path, "pct", { cls: "input-sm", unit: "%", aria: label }) + "</td>";
        if (type === "int") return '<td class="center" style="min-width:130px">' + inp(path, "int", { cls: "input-sm", unit: unit || "", aria: label }) + "</td>";
        return '<td class="center" style="min-width:155px">' + inp(path, "money", { cls: "input-sm", unit: "đ", aria: label }) + "</td>";
      }).join("");
      return "<tr><td><b>" + esc(label) + "</b></td>" + cells + "</tr>";
    }).join("");
    return cardShell(CARD.perms,
      '<div class="table-wrap set-list"><table class="dt"><thead><tr>' + head + "</tr></thead><tbody>" + rows + "</tbody></table></div>",
      { errs: errsUnder("permissions") }
    );
  }

  function widgetsCard() {
    const d = draft();
    const groups = Object.keys(WIDGET).map((portal) => {
      const map = WIDGET[portal];
      const items = Object.keys(map).map((wk) => {
        const path = "widgets." + portal + "." + wk;
        const on = U.get(d, path);
        return '<label class="wg-chip' + (on ? " on" : "") + '">' + sw(path, { aria: map[wk] }) + "<span>" + esc(map[wk]) + "</span></label>";
      }).join("");
      return '<div class="wg-row"><div class="wg-role"><b>' + esc(PORTAL_LABEL[portal] || portal) + '</b><span class="small muted">Màn hình ' + esc((PORTAL_LABEL[portal] || portal).toLowerCase()) + '</span></div><div class="wg-items">' + items + "</div></div>";
    }).join("");
    return cardShell(CARD.widgets, '<div class="wg-list">' + groups + "</div>");
  }

  /* =====================================================================
     NHOM 7 - MAY IN, DINH TUYEN, VIETQR & XEM TRUOC BILL K80
     ===================================================================== */
  function printersCard() {
    const d = draft();
    const rows = d.printers.map((p, i) => {
      const k = "printers." + i;
      const bkOpts = [{ value: "", label: "Không có" }].concat(d.printers.filter((x) => x.id !== p.id).map((x) => ({ value: x.id, label: x.name })));
      return "<tr>" +
        "<td>" + inp(k + ".name", "text", { cls: "input-sm", aria: "Tên máy in" }) + "</td>" +
        "<td>" + inp(k + ".location", "text", { cls: "input-sm", aria: "Vị trí đặt" }) + "</td>" +
        '<td style="width:140px">' + sel(k + ".purpose", opts(PURPOSE), { cls: "input-sm", aria: "Công dụng" }) + "</td>" +
        '<td style="width:95px">' + inp(k + ".copies", "int", { cls: "input-sm", aria: "Số liên" }) + "</td>" +
        '<td style="width:180px">' + sel(k + ".backupId", bkOpts, { cls: "input-sm", aria: "Máy dự phòng" }) + "</td>" +
        '<td class="center">' + sw(k + ".online", { aria: "Kết nối " + p.name }) + "</td>" +
        '<td class="right">' + UI.iconBtn("printer", { act: "settings.printerTest", data: { id: p.id }, title: "In thử " + p.name }) + UI.iconBtn("trash-2", { act: "settings.printerDel", data: { id: p.id }, title: "Xóa máy in" }) + "</td></tr>";
    }).join("");
    return cardShell(CARD.printers,
      '<div class="table-wrap set-list"><table class="dt"><thead><tr><th>Tên máy in</th><th>Vị trí</th><th>Công dụng</th><th>Số liên</th><th>Máy dự phòng</th><th class="center">Kết nối</th><th></th></tr></thead><tbody>' + rows + "</tbody></table></div>",
      { errs: errsUnder("printers"), head: UI.btn("Thêm máy in", { act: "settings.printerAdd", icon: "plus", size: "sm" }) }
    );
  }

  function routingCard() {
    const d = draft();
    const kPrinters = d.printers.filter((p) => p.purpose === "kitchen" || p.purpose === "tag");
    const cats = d.categories.slice().sort((a, b) => (a.order || 0) - (b.order || 0));
    const head = "<th>Nhóm món</th>" + kPrinters.map((p) => '<th class="center">' + esc(p.name) + '<div class="small muted">' + esc(p.location || "") + "</div></th>").join("");
    const rows = cats.map((c) => {
      const cells = kPrinters.map((p) => {
        const checked = (p.categories || []).includes(c.id);
        return '<td class="center"><input type="checkbox" data-act="settings.routeToggle" data-printer="' + esc(p.id) + '" data-cat="' + esc(c.id) + '"' + (checked ? " checked" : "") + ' aria-label="' + esc(c.name + " -> " + p.name) + '"></td>';
      }).join("");
      return "<tr><td><b>" + esc(c.name) + '</b><div class="small muted">' + esc(CAT_KIND[c.kind] || c.kind) + "</div></td>" + cells + "</tr>";
    }).join("");
    return cardShell(CARD.routing, '<div class="table-wrap set-list"><table class="dt"><thead><tr>' + head + "</tr></thead><tbody>" + rows + "</tbody></table></div>");
  }

  function qrPreview(d) {
    const s = d.store || {};
    const bank = BANKS.find((b) => b.bin === s.bankBin);
    const payload = U.vietQr({ bin: s.bankBin || "970436", account: s.bankAccount || "00000000", amount: 500000, memo: "BAN T01" });
    return '<div class="qr-box"><div class="small strong">Xem trước mã VietQR</div>' +
      U.qrSvg(payload, 168) +
      '<div class="qr-bank"><b>' + esc(bank ? bank.name : s.bankBin) + " · " + esc(s.bankAccount || "") + "</b><div>" + esc(s.accountName || "") + '</div><div class="muted">Mẫu: 500.000 đ · BAN T01</div></div></div>';
  }

  function billPreview(d) {
    const st = S();
    const kind = st.preview || "prebill";
    const s = d.store || {};
    const rc = d.receipt || {};
    const tax = d.tax || {};
    const lines = [
      { t: "centerBig", text: s.name || "QUÁN NHẬU" },
      { t: "center", text: s.address || "" },
      { t: "center", text: "ĐT: " + (s.phone || "") + (s.taxCode ? " · MST: " + s.taxCode : "") },
      { t: "sep" },
    ];
    if (kind === "kitchen") {
      lines.push(
        { t: "centerHuge", text: "PHIẾU BẾP - BÀN T02" },
        { t: "row", l: "Giờ gọi: 19:25", r: "Phục vụ: Lan" },
        { t: "sep2" },
        { t: "row", l: "1x Cá mú đen (1,25 kg)", r: "Hấp Hồng Kông", bold: true },
        { t: "note", text: "Ghi chú: Ít hành, làm nhanh" },
        { t: "row", l: "2x Bò lúc lắc khoai tây", r: " Đĩa", bold: true }
      );
    } else if (kind === "tag") {
      lines.push(
        { t: "centerHuge", text: "TEM HẢI SẢN · T02" },
        { t: "sep2" },
        { t: "row", l: "Món:", r: "Tôm hùm bông", bold: true },
        { t: "row", l: "Chế biến:", r: "Nướng phô mai" },
        { t: "row", l: "Số lượng:", r: "1 con · 1,15 kg", bold: true },
        { t: "row", l: "Thành tiền:", r: "1.935.000 đ", bold: true },
        { t: "sep" },
        { t: "center", text: "Cân lúc 19:22 · Hồ cá Tuấn" }
      );
    } else {
      lines.push(
        { t: "centerBig", text: kind === "prebill" ? "PHIẾU TẠM TÍNH" : "HÓA ĐƠN THANH TOÁN" },
        { t: "row", l: "Bàn: T02 (Sân vườn)", r: "Khách: 6" },
        { t: "row", l: "Thu ngân: Minh", r: U.dateTime(Date.now()) },
        { t: "sep2" },
        { t: "row", l: "Tôm hùm bông 1,15kg", r: "1.935.000" },
        { t: "row", l: "Bò lúc lắc x2", r: "370.000" },
        { t: "row", l: "Heineken Silver x24", r: "600.000" },
        { t: "row", l: "  KM Mua 10 tặng 2", r: "+4 lon (0)" },
        { t: "sep" },
        { t: "row", l: "Tạm tính", r: "2.905.000 đ" }
      );
      if (!tax.pricesIncludeVat) {
        lines.push({ t: "row", l: "Thuế GTGT (" + tax.food + "% / " + tax.alcohol + "%)", r: "+245.400 đ" });
      }
      lines.push({ t: "sep2" }, { t: "row", l: "TỔNG THANH TOÁN", r: tax.pricesIncludeVat ? "2.905.000 đ" : "3.150.400 đ", big: true });
      if (tax.pricesIncludeVat && rc.showVatNote) {
        lines.push({ t: "center", text: "(Đã gồm thuế GTGT đồ ăn " + tax.food + "%, bia " + tax.alcohol + "%)" });
      }
      if (rc.showQr) {
        const qr = kind === "prebill"
          ? U.vietQr({ bin: s.bankBin || "970436", account: s.bankAccount || "00000000", amount: 2905000, memo: "BAN T02" })
          : ((typeof location !== "undefined" && /^https?:/.test(location.protocol) ? location.origin : "https://munbao.com") + "/customer?inv=HD261104");
        lines.push(
          { t: "sep" },
          { t: "center", text: kind === "prebill" ? "Quét mã VietQR để chuyển khoản" : (rc.footer || "Quét mã để xuất hóa đơn VAT trong 24h") },
          { t: "qr", data: qr }
        );
      }
      if (rc.showWifi && s.wifiName) {
        lines.push({ t: "sep" }, { t: "center", text: "Wi-Fi: " + s.wifiName + (s.wifiPass ? " / MK: " + s.wifiPass : "") });
      }
      if (s.thanks) lines.push({ t: "center", text: s.thanks });
    }
    return '<div class="set-preview-card">' +
      '<div class="row between mb-8"><span class="strong small">Xem trước mẫu in K80</span>' +
      UI.seg([
        { value: "prebill", label: "Tạm tính" },
        { value: "final", label: "Hóa đơn" },
        { value: "kitchen", label: "Phiếu bếp" },
        { value: "tag", label: "Tem cân" },
      ], kind, "settings.previewKind") + "</div>" +
      UI.receipt({ lines }) + "</div>";
  }

  /* =====================================================================
     LICH SU THAY DOI & KHOI PHUC PHIEN BAN
     ===================================================================== */
  function historyView() {
    const hist = Store.data.configHistory || [];
    const pend = Store.data.pendingConfig ? [Store.data.pendingConfig] : (Store.data.pendingConfigs || []);
    const pendHtml = pend.length
      ? '<section class="set-card mb-16"><div class="set-card-head"><div><h3>Cài đặt đang chờ áp dụng (' + pend.length + ')</h3><p>Sẽ tự động có hiệu lực khi chốt ca hoặc đến giờ hẹn.</p></div></div>' +
        '<div class="card-body">' + pend.map((p) => '<div class="row between py-8 border-b"><div><b>Hẹn áp dụng lúc ' + U.dateTime(p.applyAt || p.effectiveAt || Date.now()) + '</b><div class="small muted">Mã phiên bản: ' + esc(p.id || "") + "</div></div></div>").join("") + "</div></section>"
      : "";
    if (!hist.length) return pendHtml + UI.empty("history", "Chưa có lịch sử thay đổi", "Mỗi lần Lưu và áp dụng sẽ tạo một phiên bản tại đây để khôi phục khi cần.");
    const rows = hist.map((h) => {
      const chs = (h.changes || []).slice(0, 6).map((c) => '<div class="diff-row"><span>' + esc(labelOf(c.path)) + '</span><span class="old">' + esc(fmtPath(c.path, c.old)) + '</span><span>→</span><span class="new">' + esc(fmtPath(c.path, c.new)) + "</span></div>").join("");
      const more = (h.changes || []).length > 6 ? '<div class="small muted mt-4">Và ' + (h.changes.length - 6) + " thay đổi khác</div>" : "";
      const eff = h.effective || h.effectiveMode;
      const modeLbl = eff === "next_shift" ? "Áp dụng từ ca sau" : typeof eff === "number" || eff === "scheduled" ? "Hẹn giờ" : "Áp dụng ngay";
      return '<section class="set-card"><div class="set-card-head"><div class="grow"><h3>Phiên bản ' + esc(h.id) + " · " + U.dateTime(h.at) + '</h3><p>Người lưu: ' + esc(Engine.staffName(h.by)) + " · " + modeLbl + (h.note ? " · Ghi chú: " + esc(h.note) : "") + "</p></div>" +
        (h.before || h.snapshot ? UI.btn("Khôi phục phiên bản này", { size: "sm", icon: "rotate-ccw", act: "settings.restoreVer", data: { id: h.id } }) : "") +
        '</div><div class="card-body">' + (chs || '<div class="small muted">Khôi phục hoặc cập nhật danh sách</div>') + more + "</div></section>";
    }).join("");
    return pendHtml + rows;
  }

  /* =====================================================================
     THANH CONG CU LUU & MODAL XAC NHAN
     ===================================================================== */
  function saveBar() {
    const errN = Object.keys(ERR).length;
    if (!CHG.length && !errN) return "";
    return '<div class="save-bar">' +
      '<div class="sb-info">' + I(errN ? "circle-alert" : "SlidersHorizontal" in ICONS ? "sliders-horizontal" : "settings") +
      "<span>" + (errN ? "Có " + errN + " mục chưa hợp lệ cần sửa" : "Có " + CHG.length + " thay đổi chưa lưu") + "</span></div>" +
      '<div class="row gap-8">' +
      UI.btn("Hủy thay đổi", { act: "settings.discard", icon: "undo-2" }) +
      UI.btn("Lưu và áp dụng", { act: "settings.saveOpen", kind: "primary", icon: "check", disabled: errN > 0 || !canEdit() }) +
      "</div></div>";
  }

  function openSaveModal() {
    const st = S();
    st.eff = "now";
    st.effNote = "";
    if (!st.effAt) {
      const t = new Date(Date.now() + 3600000);
      st.effAt = t.getFullYear() + "-" + U.pad(t.getMonth() + 1) + "-" + U.pad(t.getDate()) + "T" + U.pad(t.getHours()) + ":00";
    }
    App.modal({
      title: "Xác nhận lưu cài đặt (" + CHG.length + " thay đổi)",
      sub: "Kiểm tra kỹ Giá trị cũ → Giá trị mới và chọn thời điểm áp dụng.",
      size: "lg",
      body: () => {
        const s = S();
        const diffHtml = '<div class="set-diff-box">' + CHG.map((c) => '<div class="diff-row"><div><b>' + esc(c.label) + '</b><div class="small muted">' + esc(groupLabel(c.group)) + '</div></div><span class="old">' + esc(c.old) + '</span><span>→</span><span class="new">' + esc(c.new) + "</span></div>").join("") + "</div>";
        const effOpts = [
          { value: "now", label: "Ngay bây giờ", desc: "Cập nhật tức thì cho mọi thiết bị đang mở" },
          { value: "next_shift", label: "Từ ca tiếp theo", desc: "Giữ nguyên ca hiện tại, tự áp dụng khi chốt ca" },
          { value: "scheduled", label: "Hẹn giờ áp dụng", desc: "Tự động áp dụng vào ngày giờ chỉ định" },
        ];
        const effCards = '<div class="grid-3">' + effOpts.map((o) => '<button type="button" class="opt-card' + (s.eff === o.value ? " active" : "") + '" data-act="settings.effMode" data-value="' + o.value + '"><div><b>' + esc(o.label) + '</b><div class="small muted">' + esc(o.desc) + "</div></div></button>").join("") + "</div>";
        const schedInput = s.eff === "scheduled" ? '<div class="field"><label>Thời điểm áp dụng</label><input type="datetime-local" class="input" data-model="settings.effAt" value="' + esc(s.effAt) + '"></div>' : "";
        return diffHtml +
          '<div class="section-title">Thời điểm có hiệu lực</div>' + effCards + schedInput +
          UI.field("Ghi chú phiên bản (không bắt buộc)", UI.input({ id: "set-eff-note", model: "settings.effNote", value: s.effNote || "", placeholder: "Ví dụ: Điều chỉnh giá hải sản cuối tuần" }));
      },
      foot: () => UI.btn("Quay lại sửa", { act: "app.closeModal" }) + UI.btn("Xác nhận lưu", { act: "settings.saveConfirm", kind: "primary", icon: "check" }),
    });
  }

  /* =====================================================================
     MODAL THEM / SUA MON AN & NHAN VIEN
     ===================================================================== */
  function openMenuModal(id) {
    const d = draft();
    const existing = id ? d.menu.find((m) => m.id === id) : null;
    const m = existing ? cl(existing) : { id: U.uid("m"), name: "", categoryId: (d.categories[0] || {}).id || "cat_main", kind: "dish", unit: "Đĩa", price: 120000, cost: 48000, pricePerKg: 650000, costPerKg: 420000, avgKgPerPiece: 0.8, styles: [], bom: [], active: true, popular: false };
    S().editMenu = m;
    App.modal({
      title: existing ? "Sửa món: " + existing.name : "Thêm món mới",
      size: "lg",
      body: () => {
        const x = S().editMenu;
        const isSea = x.kind === "seafood";
        const catOpts = d.categories.map((c) => ({ value: c.id, label: c.name }));
        const styleChecks = isSea
          ? '<div class="field"><label>Kiểu chế biến áp dụng</label><div class="row wrap gap-8">' + d.styles.map((s) => '<label class="check"><input type="checkbox" data-act="settings.mStyle" data-id="' + s.id + '"' + ((x.styles || []).includes(s.id) ? " checked" : "") + "><span>" + esc(s.name) + "</span></label>").join("") + "</div></div>"
          : "";
        const bomRows = (x.bom || []).map((b, idx) => '<div class="row gap-8 mb-8">' +
          UI.select({ options: d.bags.map((bg) => ({ value: bg.id, label: bg.name })), value: b.bagId, change: "settings.mBomBag", data: { i: idx } }) +
          '<input type="number" class="input" style="width:90px" min="1" value="' + (b.qty || 1) + '" data-change="settings.mBomQty" data-i="' + idx + '">' +
          UI.iconBtn("trash-2", { act: "settings.mBomDel", data: { i: idx } }) + "</div>").join("");
        return '<div class="grid-2">' +
          UI.field("Tên món", UI.input({ model: "settings.editMenu.name", value: x.name, placeholder: "Ví dụ: Cá tầm nướng muối ớt" })) +
          UI.field("Nhóm món", UI.select({ model: "settings.editMenu.categoryId", value: x.categoryId, options: catOpts })) +
          UI.field("Phân loại", UI.select({ model: "settings.editMenu.kind", live: true, value: x.kind, options: opts(KIND_LABEL) })) +
          UI.field("Đơn vị tính", UI.input({ model: "settings.editMenu.unit", value: x.unit || (isSea ? "kg" : "Đĩa") })) +
          (isSea
            ? UI.field("Giá bán mỗi kg (đ)", UI.input({ type: "number", model: "settings.editMenu.pricePerKg", value: x.pricePerKg })) +
              UI.field("Giá vốn mỗi kg (đ)", UI.input({ type: "number", model: "settings.editMenu.costPerKg", value: x.costPerKg }))
            : UI.field("Giá bán (đ)", UI.input({ type: "number", model: "settings.editMenu.price", value: x.price })) +
              UI.field("Giá vốn (đ)", UI.input({ type: "number", model: "settings.editMenu.cost", value: x.cost }))) +
          "</div>" + styleChecks +
          (!isSea ? '<div class="field"><label>Định lượng trừ kho (túi định lượng)</label>' + bomRows + '<button type="button" class="link-btn" data-act="settings.mBomAdd">' + I("plus", "ic-sm") + "Thêm túi định lượng</button></div>" : "") +
          '<div class="row gap-16"><label class="check"><input type="checkbox" data-model="settings.editMenu.popular"' + (x.popular ? " checked" : "") + '><span>Món gọi nhiều (ưu tiên đầu danh sách)</span></label>' +
          '<label class="check"><input type="checkbox" data-model="settings.editMenu.active"' + (x.active ? " checked" : "") + "><span>Đang bán</span></label></div>";
      },
      foot: () => (existing ? UI.btn("Xóa món", { kind: "danger", icon: "trash-2", act: "settings.menuDel", data: { id: existing.id } }) + '<span class="spacer"></span>' : "") +
        UI.btn("Hủy bỏ", { act: "app.closeModal" }) + UI.btn("Lưu vào bản nháp", { kind: "primary", icon: "check", act: "settings.menuSave", data: { isNew: existing ? "" : "1" } }),
    });
  }

  function openStaffModal(id) {
    const existing = id ? Store.data.staff.find((s) => s.id === id) : null;
    const item = existing ? cl(existing) : { id: U.uid("s"), name: "", role: "waiter", pin: "5566", phone: "", shiftId: (draft().shifts[0] || {}).id || "sh_evening", payType: "monthly", baseSalary: 7500000, hourlyRate: 28000, baseRate: 7500000, active: true };
    if (item.baseRate === undefined) item.baseRate = staffRateVal(item);
    S().editStaff = item;
    App.modal({
      title: existing ? "Sửa nhân viên: " + existing.name : "Thêm nhân viên mới",
      body: () => {
        const x = S().editStaff;
        return '<div class="grid-2">' +
          UI.field("Họ và tên", UI.input({ model: "settings.editStaff.name", value: x.name, placeholder: "Ví dụ: Nguyễn Văn Tâm" })) +
          UI.field("Số điện thoại", UI.input({ model: "settings.editStaff.phone", value: x.phone, placeholder: "090..." })) +
          UI.field("Vai trò", UI.select({ model: "settings.editStaff.role", value: x.role, options: roleList(draft()).map((r) => ({ value: r.id, label: r.name })) })) +
          UI.field("Ca mặc định", UI.select({ model: "settings.editStaff.shiftId", value: x.shiftId, options: draft().shifts.map((s) => ({ value: s.id, label: s.name })) })) +
          UI.field("Hình thức trả lương", UI.select({ model: "settings.editStaff.payType", live: true, value: x.payType, options: opts(PAY_LABEL) })) +
          UI.field("Mức lương cơ bản (đ)", UI.input({ type: "number", model: "settings.editStaff.baseRate", value: x.baseRate || 0 })) +
          UI.field("Mã PIN đăng nhập (4 chữ số)", UI.input({ model: "settings.editStaff.pin", value: x.pin, maxlength: 4 })) +
          '<div class="field"><label>Trạng thái</label><label class="check mt-8"><input type="checkbox" data-model="settings.editStaff.active"' + (x.active ? " checked" : "") + "><span>Đang làm việc (cho phép đăng nhập)</span></label></div>" +
          "</div>";
      },
      foot: () => UI.btn("Hủy bỏ", { act: "app.closeModal" }) + UI.btn("Lưu nhân viên", { kind: "primary", icon: "check", act: "settings.staffSave", data: { isNew: existing ? "" : "1" } }),
    });
  }

  /* =====================================================================
     RENDER CHINH CUA TRANG CAI DAT
     ===================================================================== */
  function render() {
    const d = draft();
    const st = S();
    ERR = validate(d);
    CHG = detailedChanges(Store.config, d);

    const groupCounts = {};
    CHG.forEach((c) => { groupCounts[c.group] = (groupCounts[c.group] || 0) + 1; });
    const groupErrs = {};
    Object.keys(ERR).forEach((p) => { const g = groupOf(p); groupErrs[g] = (groupErrs[g] || 0) + 1; });

    const navItems = GROUPS.map((g) => {
      const cnt = groupCounts[g.id] || 0;
      const er = groupErrs[g.id] || 0;
      return '<button type="button" class="nav-item' + (st.group === g.id && !st.q ? " active" : "") + '" data-act="settings.group" data-id="' + g.id + '">' +
        I(g.icon) + '<span class="grow">' + esc(g.label) + "</span>" +
        (er ? '<span class="count" style="background:var(--danger)">' + er + "</span>" : cnt ? '<span class="count">' + cnt + "</span>" : "") +
        "</button>";
    }).join("") +
      '<button type="button" class="nav-item' + (st.group === "history" && !st.q ? " active" : "") + '" data-act="settings.group" data-id="history">' +
      I("history") + '<span class="grow">Lịch sử phiên bản</span><span class="muted small">' + (Store.data.configHistory || []).length + "</span></button>";

    let mainHtml = "";
    if (st.q && st.q.trim()) {
      const q = st.q.trim();
      const matched = CARDS.filter((c) => {
        if (U.match(c.title + " " + (c.desc || "") + " " + (c.keywords || ""), q)) return true;
        const fs = c.fieldsFn ? c.fieldsFn(d) : c.fields || [];
        return fs.some((fd) => U.match(fd.label + " " + (fd.help || ""), q));
      });
      mainHtml = '<div class="mb-12 row between"><div><b>Kết quả tìm kiếm cho "' + esc(q) + '"</b> (' + matched.length + ' mục)</div>' + UI.btn("Xóa tìm kiếm", { size: "sm", act: "settings.clearQ" }) + "</div>" +
        (matched.length ? matched.map(renderCard).join("") : UI.empty("search", "Không tìm thấy cài đặt phù hợp", "Thử từ khóa khác như: phụ thu VIP, đi trễ, thuế, máy in, khuyến mãi."));
    } else if (st.group === "history") {
      mainHtml = historyView();
    } else {
      const g = GROUPS.find((x) => x.id === st.group) || GROUPS[0];
      const cards = CARDS.filter((c) => c.group === g.id);
      if (g.id === "printers") {
        mainHtml = '<div class="set-printers-grid"><div class="set-printers-main">' + cards.map(renderCard).join("") + '</div><aside class="set-printers-preview">' + billPreview(d) + "</aside></div>";
      } else {
        mainHtml = cards.map(renderCard).join("");
      }
    }

    const roBanner = !canEdit() ? UI.banner("info", "lock", "<b>Chế độ chỉ xem.</b> Chỉ Chủ quán hoặc Kế toán được cấp quyền mới có thể lưu thay đổi cài đặt.") : "";
    return '<div class="page settings-page">' +
      '<div class="page-head"><div class="ph-text"><h1>Cài đặt hệ thống</h1><div class="desc">Chỉnh sửa mọi quy tắc vận hành, thực đơn, sơ đồ bàn, lương và thuế không cần sửa mã nguồn.</div></div>' +
      '<div class="ph-tools">' +
      UI.search({ id: "set-global-q", model: "settings.q", value: st.q, placeholder: "Tìm nhanh cài đặt (VD: VIP, đi trễ, thuế...)" }) +
      UI.btn("Khôi phục mặc định", { size: "sm", icon: "rotate-ccw", act: "settings.resetAll", disabled: !canEdit() }) +
      "</div></div>" +
      roBanner +
      '<div class="settings-layout">' +
      '<nav class="settings-nav" aria-label="Nhóm cài đặt">' + navItems + "</nav>" +
      '<div class="settings-content">' + mainHtml + "</div>" +
      "</div>" +
      saveBar() +
      "</div>";
  }

  window.OwnerPages = window.OwnerPages || {};
  window.OwnerPages.settings = { render, isDirty };

  /* =====================================================================
     SU KIEN O NHAP (data-set) & KEO THA SO DO BAN
     ===================================================================== */
  function parseSetVal(el) {
    const t = el.dataset.t;
    if (t === "bool") return !!el.checked;
    if (t === "int") return Math.round(U.parseNum(el.value));
    if (t === "money") return Math.round(U.parseNum(el.value));
    if (t === "num" || t === "pct") return U.parseFloat(el.value);
    return el.value;
  }

  document.addEventListener("input", (ev) => {
    const el = ev.target.closest("[data-set]");
    if (!el) return;
    if (el.tagName === "SELECT" || el.type === "checkbox") return;
    U.set(draft(), el.dataset.set, parseSetVal(el));
    App.render();
  });

  document.addEventListener("change", (ev) => {
    const el = ev.target.closest("[data-set]");
    if (!el) return;
    U.set(draft(), el.dataset.set, parseSetVal(el));
    App.render();
  });

  // Keo tha ban tren #ef-canvas (căn luoi 8px)
  let drag = null;
  document.addEventListener("pointerdown", (ev) => {
    const tile = ev.target.closest("#ef-canvas .ef-table");
    if (!tile) return;
    const tid = tile.dataset.tid;
    const t = draft().tables.find((x) => x.id === tid);
    if (!t) return;
    S().selTable = tid;
    const canvas = document.getElementById("ef-canvas");
    drag = { t, tile, startX: ev.clientX, startY: ev.clientY, origX: Number(t.x) || 0, origY: Number(t.y) || 0, moved: false, maxW: canvas ? canvas.clientWidth - efW(t) : 800 };
    tile.classList.add("dragging");
    if (tile.setPointerCapture) {
      try { tile.setPointerCapture(ev.pointerId); } catch (_) {}
    }
  });
  document.addEventListener("pointermove", (ev) => {
    if (!drag) return;
    const dx = ev.clientX - drag.startX;
    const dy = ev.clientY - drag.startY;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) drag.moved = true;
    if (!drag.moved) return;
    const nx = Math.max(8, Math.round((drag.origX + dx) / 8) * 8);
    const ny = Math.max(8, Math.round((drag.origY + dy) / 8) * 8);
    drag.t.x = nx;
    drag.t.y = ny;
    drag.tile.style.left = nx + "px";
    drag.tile.style.top = ny + "px";
  });
  document.addEventListener("pointerup", () => {
    if (!drag) return;
    drag.tile.classList.remove("dragging");
    drag = null;
    App.render();
  });

  // Phim mui ten dich chuyen ban dang chon 8px
  document.addEventListener("keydown", (ev) => {
    if (ev.target && /INPUT|TEXTAREA|SELECT/.test(ev.target.tagName)) return;
    const st = S();
    if (!st.selTable || App.currentRoute().portal !== "owner" || App.currentRoute().sub !== "settings" || st.group !== "tables") return;
    const delta = { ArrowLeft: [-8, 0], ArrowRight: [8, 0], ArrowUp: [0, -8], ArrowDown: [0, 8] }[ev.key];
    if (!delta) return;
    const t = draft().tables.find((x) => x.id === st.selTable);
    if (!t) return;
    ev.preventDefault();
    t.x = Math.max(8, (Number(t.x) || 0) + delta[0]);
    t.y = Math.max(8, (Number(t.y) || 0) + delta[1]);
    App.render();
  });

  window.addEventListener("beforeunload", (ev) => {
    if (isDirty()) {
      ev.preventDefault();
      ev.returnValue = "";
    }
  });

  /* =====================================================================
     CAC HANH DONG (settings.*)
     ===================================================================== */
  App.actions({
    "settings.group": (d) => {
      S().group = d.id;
      S().q = "";
      App.render();
    },
    "settings.clearQ": () => {
      S().q = "";
      App.render();
    },
    "settings.setv": (d) => {
      const v = d.t === "int" ? Number(d.value) : d.value;
      U.set(draft(), d.path, v);
      App.render();
    },
    "settings.revert": (d) => {
      U.set(draft(), d.path, cl(U.get(Store.config, d.path)));
      App.render();
    },
    "settings.discard": async () => {
      const ok = await App.confirm({ title: "Hủy các thay đổi chưa lưu?", message: "Bản nháp sẽ quay về đúng cài đặt đang áp dụng hiện tại.", confirm: "Hủy thay đổi", danger: true });
      if (!ok) return;
      resetDraft();
      App.toast("Đã hoàn tác các thay đổi chưa lưu", "info");
      App.render();
    },
    "settings.resetAll": async () => {
      const ok = await App.confirm({ title: "Khôi phục cài đặt mặc định?", message: "Bản nháp sẽ nạp lại bộ thông số mặc định ban đầu. Bạn vẫn có thể xem lại danh sách thay đổi trước khi bấm Lưu và áp dụng.", confirm: "Nạp mặc định" });
      if (!ok) return;
      S().draft = U.clone(DEF);
      App.toast("Đã nạp bộ thông số mặc định vào bản nháp", "info");
      App.render();
    },
    "settings.saveOpen": () => {
      ERR = validate(draft());
      CHG = detailedChanges(Store.config, draft());
      if (Object.keys(ERR).length) return App.toast("Vui lòng sửa các mục báo đỏ trước khi lưu.", "error");
      if (!CHG.length) return App.toast("Chưa có thay đổi nào để lưu.", "info");
      openSaveModal();
    },
    "settings.effMode": (d) => {
      S().eff = d.value;
      App.render();
    },
    "settings.saveConfirm": () => {
      const st = S();
      const atTs = st.eff === "scheduled" && st.effAt ? new Date(st.effAt).getTime() : 0;
      const effArg = st.eff === "scheduled" ? (atTs || Date.now() + 3600000) : st.eff;
      const res = App.commit(() => Engine.saveConfig(draft(), { effective: effArg, by: meId(), note: st.effNote || "" }));
      if (!res) return;
      resetDraft();
      App.closeModal();
      App.toast(st.eff === "now" ? "Đã lưu và áp dụng cài đặt ngay lập tức" : "Đã lưu cài đặt vào lịch chờ áp dụng", "success");
      App.render();
    },
    "settings.restoreVer": async (d) => {
      const ok = await App.confirm({ title: "Khôi phục phiên bản " + d.id + "?", message: "Cài đặt của phiên bản này sẽ được áp dụng ngay và lưu một bản ghi mới trong lịch sử.", confirm: "Khôi phục ngay" });
      if (!ok) return;
      const r = App.commit(() => Engine.restoreConfig(d.id, meId()), "Đã khôi phục phiên bản " + d.id);
      if (!r) return;
      resetDraft();
      App.render();
    },

    /* ---- Sơ đồ bàn & khu vực ---- */
    "settings.tableAdd": () => {
      const d = draft();
      const areaId = (d.areas[0] || {}).id || "a_yard";
      const n = d.tables.length + 1;
      const t = { id: U.uid("tb"), code: "B" + U.pad(n), areaId, seats: 6, type: "normal", x: 24 + ((n * 80) % 560), y: 24 + Math.floor((n * 80) / 560) * 72 };
      d.tables.push(t);
      S().selTable = t.id;
      App.render();
    },
    "settings.tableDup": (d) => {
      const src = draft().tables.find((x) => x.id === d.id);
      if (!src) return;
      const copy = Object.assign({}, cl(src), { id: U.uid("tb"), code: src.code + "-M", x: (Number(src.x) || 0) + 24, y: (Number(src.y) || 0) + 24 });
      draft().tables.push(copy);
      S().selTable = copy.id;
      App.render();
    },
    "settings.tableDel": (d) => {
      if (Engine.ticketByTable(d.id)) return App.toast("Bàn đang có khách phục vụ, không thể xóa.", "error");
      const list = draft().tables;
      const idx = list.findIndex((x) => x.id === d.id);
      if (idx >= 0) list.splice(idx, 1);
      if (S().selTable === d.id) S().selTable = null;
      App.render();
    },
    "settings.areaAdd": () => {
      draft().areas.push({ id: U.uid("area"), name: "Khu mới" });
      App.render();
    },
    "settings.areaDel": (d) => {
      const cfg = draft();
      if (cfg.tables.some((t) => t.areaId === d.id)) return App.toast("Còn bàn thuộc khu vực này. Hãy chuyển hoặc xóa bàn trước.", "error");
      cfg.areas = cfg.areas.filter((a) => a.id !== d.id);
      App.render();
    },

    /* ---- Thực đơn, nhóm món, kiểu chế biến, túi định lượng ---- */
    "settings.menuNew": () => openMenuModal(null),
    "settings.menuEdit": (d) => openMenuModal(d.id),
    "settings.mStyle": (d, el) => {
      const m = S().editMenu;
      if (!m) return;
      m.styles = m.styles || [];
      if (el.checked && !m.styles.includes(d.id)) m.styles.push(d.id);
      if (!el.checked) m.styles = m.styles.filter((x) => x !== d.id);
    },
    "settings.mBomAdd": () => {
      const m = S().editMenu;
      if (!m) return;
      m.bom = m.bom || [];
      const firstBag = (draft().bags[0] || {}).id || "bag_beef";
      m.bom.push({ bagId: firstBag, qty: 1 });
      App.render();
    },
    "settings.mBomBag": (d, el) => {
      const m = S().editMenu;
      if (m && m.bom && m.bom[Number(d.i)]) m.bom[Number(d.i)].bagId = el.value;
    },
    "settings.mBomQty": (d, el) => {
      const m = S().editMenu;
      if (m && m.bom && m.bom[Number(d.i)]) m.bom[Number(d.i)].qty = Math.max(1, Number(el.value) || 1);
    },
    "settings.mBomDel": (d) => {
      const m = S().editMenu;
      if (m && m.bom) m.bom.splice(Number(d.i), 1);
      App.render();
    },
    "settings.menuSave": (d) => {
      const m = S().editMenu;
      if (!m || !String(m.name || "").trim()) return App.toast("Vui lòng nhập tên món.", "error");
      if (m.kind === "seafood") {
        m.pricePerKg = Math.max(0, Number(m.pricePerKg) || 0);
        m.costPerKg = Math.max(0, Number(m.costPerKg) || 0);
      } else {
        m.price = Math.max(0, Number(m.price) || 0);
        m.cost = Math.max(0, Number(m.cost) || 0);
      }
      const list = draft().menu;
      const idx = list.findIndex((x) => x.id === m.id);
      if (idx >= 0) list[idx] = m;
      else list.unshift(m);
      App.closeModal();
      App.render();
    },
    "settings.menuDel": (d) => {
      draft().menu = draft().menu.filter((x) => x.id !== d.id);
      App.closeModal();
      App.render();
    },
    "settings.catAdd": () => {
      const cats = draft().categories;
      cats.push({ id: U.uid("cat"), name: "Nhóm mới", kind: "kitchen", vatGroup: "food", order: cats.length + 1 });
      App.render();
    },
    "settings.catDel": (d) => {
      if (draft().menu.some((m) => m.categoryId === d.id)) return App.toast("Còn món thuộc nhóm này, không thể xóa.", "error");
      draft().categories = draft().categories.filter((c) => c.id !== d.id);
      App.render();
    },
    "settings.styleAdd": () => {
      draft().styles.push({ id: U.uid("st"), name: "Kiểu chế biến mới", surcharge: 0 });
      App.render();
    },
    "settings.styleDel": (d) => {
      draft().styles = draft().styles.filter((s) => s.id !== d.id);
      App.render();
    },
    "settings.bagAdd": () => {
      draft().bags.push({ id: U.uid("bag"), name: "Túi định lượng mới", gram: 200, minStock: 10, cost: 35000 });
      App.render();
    },
    "settings.bagDel": (d) => {
      draft().bags = draft().bags.filter((b) => b.id !== d.id);
      App.render();
    },

    /* ---- Khuyến mãi & hãng bia ---- */
    "settings.promoAdd": () => {
      const cfg = draft();
      const brand = (cfg.brands[0] || {}).id || "b_heineken";
      const beer = (cfg.menu.find((m) => m.kind === "beer") || {}).id || "";
      cfg.promos.push({ id: U.uid("pr"), name: "Mua 10 tặng 2", brandId: brand, menuId: beer, buyQty: 10, freeQty: 2, source: "brand", requireCapReturn: true, active: true });
      App.render();
    },
    "settings.promoDel": (d) => {
      draft().promos = draft().promos.filter((p) => p.id !== d.id);
      App.render();
    },
    "settings.brandAdd": () => {
      draft().brands.push({ id: U.uid("br"), name: "Hãng mới", rebateTarget: 200, rebateUnit: "thùng", rebatePeriod: "month", rebateAmount: 10000000 });
      App.render();
    },
    "settings.brandDel": (d) => {
      draft().brands = draft().brands.filter((b) => b.id !== d.id);
      App.render();
    },

    /* ---- Ca làm & bậc phạt đi trễ ---- */
    "settings.shiftAdd": () => {
      draft().shifts.push({ id: U.uid("sh"), name: "Ca mới", segments: [{ start: "15:00", end: "23:00" }] });
      App.render();
    },
    "settings.shiftDel": (d) => {
      if (draft().shifts.length <= 1) return App.toast("Cần giữ ít nhất 1 ca làm.", "error");
      draft().shifts = draft().shifts.filter((s) => s.id !== d.id);
      App.render();
    },
    "settings.segAdd": (d) => {
      const sh = draft().shifts.find((s) => s.id === d.shift);
      if (sh && sh.segments.length < 4) sh.segments.push({ start: "17:00", end: "22:00" });
      App.render();
    },
    "settings.segDel": (d) => {
      const sh = draft().shifts.find((s) => s.id === d.shift);
      if (sh && sh.segments.length > 1) sh.segments.splice(Number(d.seg), 1);
      App.render();
    },
    "settings.tierAdd": () => {
      const list = draft().attendance.latePenalties || (draft().attendance.latePenalties = []);
      const last = list.length ? Math.max(...list.map((x) => Number(x.fromMin) || 0)) : Number(draft().attendance.graceMinutes) || 5;
      list.push({ fromMin: last + 10, amount: 50000 });
      App.render();
    },
    "settings.tierDel": (d) => {
      draft().attendance.latePenalties.splice(Number(d.i), 1);
      App.render();
    },

    /* ---- Nhân viên ---- */
    "settings.togglePins": () => {
      S().showPins = !S().showPins;
      App.render();
    },
    "settings.staffNew": () => openStaffModal(null),
    "settings.staffEdit": (d) => openStaffModal(d.id),
    "settings.staffSave": (d) => {
      const x = S().editStaff;
      if (!x || !String(x.name || "").trim()) return App.toast("Nhập họ tên nhân viên.", "error");
      if (!/^\d{4}$/.test(String(x.pin || ""))) return App.toast("Mã PIN phải gồm đúng 4 chữ số.", "error");
      const dup = Store.data.staff.find((s) => s.id !== x.id && s.pin === x.pin);
      if (dup) return App.toast("Mã PIN bị trùng với " + dup.name + ".", "error");
      x.baseRate = Math.max(0, Number(x.baseRate) || 0);
      if (x.payType === "hourly") x.hourlyRate = x.baseRate;
      else x.baseSalary = x.baseRate;
      App.commit(() => {
        const list = Store.data.staff;
        const i = list.findIndex((s) => s.id === x.id);
        if (i >= 0) list[i] = x;
        else list.push(x);
      }, d.isNew ? "Đã thêm nhân viên " + x.name : "Đã cập nhật nhân viên " + x.name);
      App.closeModal();
      App.render();
    },

    /* ---- Máy in & mẫu bill ---- */
    "settings.printerAdd": () => {
      draft().printers.push({ id: U.uid("p"), name: "Máy in mới", location: "Quầy", purpose: "kitchen", copies: 1, online: true, backupId: "", categories: [] });
      App.render();
    },
    "settings.printerDel": (d) => {
      draft().printers = draft().printers.filter((p) => p.id !== d.id);
      App.render();
    },
    "settings.printerTest": (d) => {
      const p = draft().printers.find((x) => x.id === d.id);
      if (!p) return;
      App.toast(p.online ? "Đã gửi phiếu in thử tới " + p.name : p.name + " đang mất kết nối, chuyển sang máy dự phòng", p.online ? "success" : "warning");
    },
    "settings.routeToggle": (d, el) => {
      const p = draft().printers.find((x) => x.id === d.printer);
      if (!p) return;
      p.categories = p.categories || [];
      if (el.checked && !p.categories.includes(d.cat)) p.categories.push(d.cat);
      if (!el.checked) p.categories = p.categories.filter((x) => x !== d.cat);
      App.render();
    },
    "settings.previewKind": (d) => {
      S().preview = d.value;
      App.render();
    },
  });
})();
