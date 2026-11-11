/* =========================================================================
   store.js - Kho du lieu trung tam + cau hinh dong (SystemConfigStore)
   - state.config : moi thong so do Chu quan chinh trong trang Cai dat
   - state.data   : du lieu van hanh (ban, bill, kho, cham cong, duyet...)
   - Luu localStorage, phat su kien cho moi giao dien cap nhat tuc thoi
   ========================================================================= */
(function () {
  const KEY = "quannhau_os_v1";
  const DEMO_KEY = "quannhau_os_demo_v1";

  function isDemoMode() {
    try {
      return new URLSearchParams(location.search).get("demo") === "1";
    } catch (e) {
      return false;
    }
  }

  function activeStorageKey() {
    return isDemoMode() ? DEMO_KEY : KEY;
  }

  /* ---------------- CAU HINH MAC DINH ---------------- */
  function defaultConfig() {
    return {
      store: {
        name: "Quán Nhậu Phố Biển",
        address: "128 Nguyễn Văn Linh, Q.7, TP. Hồ Chí Minh",
        phone: "0909 123 456",
        taxCode: "0312345678",
        wifiName: "PhoBien_Guest",
        wifiPass: "nhaungon2026",
        bankBin: "970436",
        bankName: "Vietcombank",
        bankAccount: "0071000123456",
        accountName: "NGUYEN VAN HUNG",
        thanks: "Cảm ơn quý khách. Hẹn gặp lại.",
        openTime: "15:00",
        closeTime: "00:00",
      },
      areas: [
        { id: "ar_garden", name: "Sân vườn" },
        { id: "ar_indoor", name: "Trong nhà" },
        { id: "ar_vip", name: "Phòng VIP" },
      ],
      tables: (function () {
        const t = [];
        for (let i = 1; i <= 12; i++) t.push({ id: "t_A" + i, code: "A" + String(i).padStart(2, "0"), areaId: "ar_garden", seats: i % 3 === 0 ? 8 : 6, type: "normal", x: 24 + ((i - 1) % 6) * 96, y: 24 + Math.floor((i - 1) / 6) * 80 });
        for (let i = 1; i <= 8; i++) t.push({ id: "t_B" + i, code: "B" + String(i).padStart(2, "0"), areaId: "ar_indoor", seats: 4, type: "normal", x: 24 + ((i - 1) % 4) * 96, y: 200 + Math.floor((i - 1) / 4) * 80 });
        t.push({ id: "t_V1", code: "VIP 1", areaId: "ar_vip", seats: 12, type: "vip", x: 440, y: 200 });
        t.push({ id: "t_V2", code: "VIP 2", areaId: "ar_vip", seats: 16, type: "vip", x: 440, y: 280 });
        return t;
      })(),
      vip: { hourlyRate: 100000, minimumSpendEnabled: true, minimumSpend: 3000000, freeMinutes: 0 },
      booking: { enabled: true, holdMinutes: 30, depositRequired: true, depositNormal: 200000, depositVip: 500000, noShowMinutes: 30, slotStart: "16:00", slotEnd: "22:00", slotStep: 30 },
      floor: { autoCleanMinutes: 10, slowOrderMinutes: 20, vipWarnMinutes: 15, assignmentMode: "assigned" },

      categories: [
        { id: "c_quick", name: "Món nhanh", kind: "kitchen", vatGroup: "food", order: 1 },
        { id: "c_grill", name: "Nướng", kind: "kitchen", vatGroup: "food", order: 2 },
        { id: "c_hotpot", name: "Lẩu", kind: "kitchen", vatGroup: "food", order: 3 },
        { id: "c_sea", name: "Hải sản tươi sống", kind: "seafood", vatGroup: "food", order: 4 },
        { id: "c_beer", name: "Bia", kind: "drink", vatGroup: "alcohol", order: 5 },
        { id: "c_soft", name: "Nước ngọt - Đá", kind: "drink", vatGroup: "food", order: 6 },
        { id: "c_liquor", name: "Rượu", kind: "drink", vatGroup: "alcohol", order: 7 },
      ],
      styles: [
        { id: "st_hk", name: "Hấp Hồng Kông", surcharge: 0 },
        { id: "st_salt", name: "Nướng muối ớt", surcharge: 0 },
        { id: "st_garlic", name: "Cháy tỏi", surcharge: 20000 },
        { id: "st_hotpot", name: "Nấu lẩu", surcharge: 50000 },
        { id: "st_lemongrass", name: "Hấp sả", surcharge: 0 },
        { id: "st_tamarind", name: "Rang me", surcharge: 20000 },
        { id: "st_sashimi", name: "Sashimi", surcharge: 0 },
      ],
      bags: [
        { id: "bag_beef", name: "Thịt bò thăn (túi định lượng)", group: "meat", unit: "túi", gram: 150, minStock: 12, cost: 52000 },
        { id: "bag_pork", name: "Ba chỉ heo ướp sẵn", group: "meat", unit: "túi", gram: 200, minStock: 12, cost: 32000 },
        { id: "bag_squid", name: "Mực một nắng phơi", group: "meat", unit: "túi", gram: 250, minStock: 8, cost: 95000 },
        { id: "bag_rib", name: "Sườn non heo ướp", group: "meat", unit: "túi", gram: 250, minStock: 10, cost: 45000 },
        { id: "bag_intestine", name: "Lòng non làm sạch", group: "meat", unit: "túi", gram: 250, minStock: 8, cost: 31000 },
        { id: "bag_frog", name: "Thịt ếch làm sạch", group: "meat", unit: "túi", gram: 300, minStock: 8, cost: 48000 },
        { id: "bag_feet", name: "Chân gà rút xương", group: "meat", unit: "túi", gram: 300, minStock: 10, cost: 28000 },
        { id: "bag_chicken", name: "Gà ta chặt sẵn (nấu lẩu)", group: "meat", unit: "phần", gram: 700, minStock: 6, cost: 85000 },
        { id: "bag_hotpot", name: "Set hải sản nấu lẩu", group: "meat", unit: "set", gram: 800, minStock: 6, cost: 105000 },
        { id: "bag_tofu", name: "Đậu hũ non cắt miếng", group: "veg", unit: "phần", gram: 300, minStock: 12, cost: 10000 },
        { id: "bag_fries", name: "Khoai tây cắt sợi", group: "veg", unit: "phần", gram: 250, minStock: 12, cost: 12000 },
        { id: "bag_lotus", name: "Ngó sen & Tôm thịt trộn gỏi", group: "veg", unit: "phần", gram: 300, minStock: 8, cost: 28000 },
        { id: "bag_rice", name: "Cơm & Nhân hải sản chiên", group: "veg", unit: "phần", gram: 350, minStock: 10, cost: 26000 },
        { id: "bag_veg_hotpot", name: "Rau nấm ăn lẩu & Lá é tươi", group: "veg", unit: "rổ", gram: 400, minStock: 10, cost: 18000 },
        { id: "bag_veg_side", name: "Hành tây, ớt chuông, xà lách", group: "veg", unit: "phần", gram: 150, minStock: 12, cost: 8000 },
        { id: "bag_spices", name: "Sả, tắc, ớt, tỏi, rau răm", group: "veg", unit: "set", gram: 100, minStock: 15, cost: 5000 },
      ],
      menu: [
        { id: "m_tofu", name: "Đậu hũ chiên giòn", categoryId: "c_quick", kind: "dish", price: 45000, cost: 12000, unit: "đĩa", active: true, popular: true, bom: [{ bagId: "bag_tofu", qty: 1 }] },
        { id: "m_fries", name: "Khoai tây chiên", categoryId: "c_quick", kind: "dish", price: 45000, cost: 13000, unit: "đĩa", active: true, popular: true, bom: [{ bagId: "bag_fries", qty: 1 }] },
        { id: "m_salad", name: "Gỏi ngó sen tôm thịt", categoryId: "c_quick", kind: "dish", price: 95000, cost: 34000, unit: "đĩa", active: true, bom: [{ bagId: "bag_lotus", qty: 1 }, { bagId: "bag_spices", qty: 1 }] },
        { id: "m_feet", name: "Chân gà sả tắc", categoryId: "c_quick", kind: "dish", price: 89000, cost: 31000, unit: "đĩa", active: true, popular: true, bom: [{ bagId: "bag_feet", qty: 1 }, { bagId: "bag_spices", qty: 1 }] },
        { id: "m_frog", name: "Ếch chiên bơ", categoryId: "c_quick", kind: "dish", price: 135000, cost: 52000, unit: "đĩa", active: true, bom: [{ bagId: "bag_frog", qty: 1 }] },
        { id: "m_beef", name: "Bò lúc lắc", categoryId: "c_quick", kind: "dish", price: 180000, cost: 62000, unit: "đĩa", active: true, popular: true, bom: [{ bagId: "bag_beef", qty: 1 }, { bagId: "bag_veg_side", qty: 1 }] },
        { id: "m_rice", name: "Cơm chiên hải sản", categoryId: "c_quick", kind: "dish", price: 95000, cost: 30000, unit: "đĩa", active: true, bom: [{ bagId: "bag_rice", qty: 1 }] },
        { id: "m_squid", name: "Mực một nắng nướng", categoryId: "c_grill", kind: "dish", price: 220000, cost: 98000, unit: "đĩa", active: true, popular: true, bom: [{ bagId: "bag_squid", qty: 1 }], upsell: 10000 },
        { id: "m_pork", name: "Ba chỉ nướng mật ong", categoryId: "c_grill", kind: "dish", price: 129000, cost: 36000, unit: "đĩa", active: true, bom: [{ bagId: "bag_pork", qty: 1 }] },
        { id: "m_rib", name: "Sườn non nướng", categoryId: "c_grill", kind: "dish", price: 149000, cost: 49000, unit: "đĩa", active: true, bom: [{ bagId: "bag_rib", qty: 1 }] },
        { id: "m_intestine", name: "Lòng non nướng", categoryId: "c_grill", kind: "dish", price: 99000, cost: 33000, unit: "đĩa", active: true, bom: [{ bagId: "bag_intestine", qty: 1 }] },
        { id: "m_hotpot_sea", name: "Lẩu Thái hải sản", categoryId: "c_hotpot", kind: "dish", price: 299000, cost: 128000, unit: "nồi", active: true, popular: true, bom: [{ bagId: "bag_hotpot", qty: 1 }, { bagId: "bag_veg_hotpot", qty: 1 }], upsell: 15000 },
        { id: "m_hotpot_chk", name: "Lẩu gà lá é", categoryId: "c_hotpot", kind: "dish", price: 279000, cost: 105000, unit: "nồi", active: true, bom: [{ bagId: "bag_chicken", qty: 1 }, { bagId: "bag_veg_hotpot", qty: 1 }] },
        { id: "m_grouper", name: "Cá mú", categoryId: "c_sea", kind: "seafood", pricePerKg: 650000, costPerKg: 360000, unit: "kg", active: true, styles: ["st_hk", "st_salt", "st_hotpot", "st_lemongrass"], upsellPerKg: 20000, avgKgPerPiece: 0.95, fishPrefix: "CM" },
        { id: "m_lobster", name: "Tôm hùm bông", categoryId: "c_sea", kind: "seafood", pricePerKg: 2200000, costPerKg: 1450000, unit: "kg", active: true, styles: ["st_garlic", "st_sashimi", "st_hk"], upsellPerKg: 50000, avgKgPerPiece: 0.7, fishPrefix: "TH" },
        { id: "m_crab", name: "Cua thịt Cà Mau", categoryId: "c_sea", kind: "seafood", pricePerKg: 850000, costPerKg: 520000, unit: "kg", active: true, styles: ["st_tamarind", "st_lemongrass", "st_salt"], upsellPerKg: 20000, avgKgPerPiece: 0.5, fishPrefix: "CT" },
        { id: "m_snail", name: "Ốc hương", categoryId: "c_sea", kind: "seafood", pricePerKg: 520000, costPerKg: 310000, unit: "kg", active: true, styles: ["st_garlic", "st_lemongrass", "st_tamarind"], upsellPerKg: 10000, avgKgPerPiece: 0.02 },
        { id: "m_seabass", name: "Cá chẽm", categoryId: "c_sea", kind: "seafood", pricePerKg: 380000, costPerKg: 210000, unit: "kg", active: true, styles: ["st_hk", "st_salt", "st_hotpot"], upsellPerKg: 10000, avgKgPerPiece: 1.1, fishPrefix: "CC" },
        { id: "m_tiger", name: "Tiger Bạc lon", categoryId: "c_beer", kind: "beer", price: 22000, cost: 15500, unit: "lon", caseSize: 24, brandId: "br_tiger", active: true, popular: true },
        { id: "m_heineken", name: "Heineken lon", categoryId: "c_beer", kind: "beer", price: 26000, cost: 18800, unit: "lon", caseSize: 24, brandId: "br_heineken", active: true, popular: true },
        { id: "m_saigon", name: "Saigon Special lon", categoryId: "c_beer", kind: "beer", price: 20000, cost: 14200, unit: "lon", caseSize: 24, brandId: "br_sabeco", active: true },
        { id: "m_coke", name: "Coca-Cola lon", categoryId: "c_soft", kind: "drink", price: 15000, cost: 7500, unit: "lon", caseSize: 24, active: true },
        { id: "m_water", name: "Nước suối", categoryId: "c_soft", kind: "drink", price: 10000, cost: 4000, unit: "chai", caseSize: 24, active: true },
        { id: "m_ice", name: "Đá viên", categoryId: "c_soft", kind: "drink", price: 10000, cost: 3000, unit: "xô", active: true, popular: true },
        { id: "m_chivas", name: "Chivas 12 (700ml)", categoryId: "c_liquor", kind: "drink", price: 1250000, cost: 780000, unit: "chai", active: true, bottleKeep: true },
        { id: "m_ricewine", name: "Rượu nếp cái hoa vàng", categoryId: "c_liquor", kind: "drink", price: 120000, cost: 45000, unit: "chai", active: true },
      ],
      marginAlert: 35,

      brands: [
        { id: "br_tiger", name: "Tiger (Heineken VN)", rebateTarget: 400, rebateUnit: "thùng", rebatePeriod: "quarter", rebateAmount: 12000000 },
        { id: "br_heineken", name: "Heineken", rebateTarget: 300, rebateUnit: "thùng", rebatePeriod: "quarter", rebateAmount: 10000000 },
        { id: "br_sabeco", name: "Sabeco", rebateTarget: 150, rebateUnit: "thùng", rebatePeriod: "month", rebateAmount: 3000000 },
      ],
      promos: [
        { id: "pr_tiger", brandId: "br_tiger", menuId: "m_tiger", name: "Tiger mua 10 tặng 1", buyQty: 10, freeQty: 1, source: "brand", requireCapReturn: true, active: true },
        { id: "pr_heineken", brandId: "br_heineken", menuId: "m_heineken", name: "Heineken mua 12 tặng 1", buyQty: 12, freeQty: 1, source: "brand", requireCapReturn: true, active: true },
      ],
      pg: { brandQuotaPerShift: { br_tiger: 48, br_heineken: 36 }, targetCasesPerShift: 15, commissionPerCase: 8000 },

      inventory: { tankCountTol: 0, tankKgTol: 5, kitchenBagTol: 3, beerTol: 0, utilityCap: 4.5, wasteAutoApproveUnder: 0 },
      seafoodPolicy: {
        allowSellByGram: true,
        minGram: 200,
        gramStep: 100,
        allowWholeFishBargain: true,
        maxStaffBargainPct: 8,
        blockBelowCost: true,
      },
      locks: { prebillLock: true, prebillGraceSec: 0, zLockEnabled: true, zLockTime: "00:30", blindCountLock: true, taxPeriodLock: true, autoCloseBooking: true },

      shifts: [
        { id: "sh_evening", name: "Ca tối", segments: [{ start: "15:30", end: "23:30" }] },
        { id: "sh_split", name: "Ca gãy bếp", segments: [{ start: "09:00", end: "14:00" }, { start: "16:00", end: "23:00" }] },
        { id: "sh_late", name: "Ca khuya", segments: [{ start: "17:00", end: "01:00" }] },
      ],
      attendance: {
        wifiRequired: true, wifiName: "PhoBien_Staff", wifiIp: "",
        gpsRequired: true, gpsRadius: 50, storeLat: null, storeLng: null,
        selfieRequired: true,
        graceMinutes: 5,
        latePenalties: [{ fromMin: 6, amount: 20000 }, { fromMin: 16, amount: 50000 }, { fromMin: 31, amount: 100000 }],
        cleanupBuffer: 30, nightStart: "22:00", nightMultiplier: 1.3, otMultiplier: 1.5,
      },
      payroll: { workDaysPerMonth: 26, standardHoursPerDay: 8, advanceCapPct: 50, tipPolicy: "personal", payDay: 5 },

      roles: {
        owner: { label: "Chủ quán", portal: "owner" },
        accountant: { label: "Kế toán", portal: "owner" },
        cashier: { label: "Thu ngân kiêm Quản lý", portal: "cashier" },
        waiter: { label: "Phục vụ", portal: "waiter" },
        pg: { label: "PG Bia", portal: "pg" },
        tank: { label: "Phụ bếp - Hồ cá", portal: "kiosk" },
        chef: { label: "Bếp chính", portal: "kiosk" },
        cleaner: { label: "Vệ sinh", portal: "kiosk" },
      },
      permissions: {
        cashier: {
          splitBill: true,
          transferTable: true,
          discount: true,
          discountMaxPct: 10,
          voidAfterPrint: true,
          approveVoidUnder: 200000,
          approveWasteUnder: 300000,
          pettyCashMax: 500000,
          payAdvance: true,
          approveAdvanceUnder: 500000,
          approveOvertimeUnderMin: 60,
          approveNoShowUnder: 300000,
          reopenBill: true,
          maxSelfUnlockCount: 1,
          cashierBargainPct: 15,
        },
        waiter: {
          voidBeforeSend: true,
          transferTable: true,
          requestPrebill: true,
          collectPayment: true,
          collectCash: true,
          createBottleKeep: true,
          viewTableTotal: true,
        },
        pg: { giveBrandPromo: true, sellSoftDrink: true },
        tank: { receiveGoods: true, reportWaste: true, blindCount: true },
        accountant: { viewPayroll: true, exportTax: true, editSettings: false, approve: false },
      },
      paymentGateway: {
        enabled: true,
        provider: "SePay / Casso / VietQR",
        webhookPath: "/api/webhooks/payment",
        webhookSecret: "qn_live_wh_982341",
        prefix: "QN",
        autoCloseOnFullPay: true,
        overpayAsTip: true,
      },
      widgets: {
        waiter: { shift: true, tables: true, weigh: true, tips: true, payslip: true },
        pg: { shift: true, sales: true, quota: true, caps: true, commission: true },
        kiosk: { queue: true, tank: true, bags: true, waste: true },
        cashier: { cash: true, qr: true, locked: true, staff: true },
        owner: { revenue: true, profit: true, approvals: true, alerts: true },
      },

      printers: [
        { id: "p_cashier", name: "Máy in quầy thu ngân", location: "Quầy", categories: [], purpose: "bill", copies: 1, online: true, backupId: "", ip: "", port: 9100 },
        { id: "p_kitchen", name: "Máy in bếp nóng", location: "Bếp", categories: ["c_quick", "c_hotpot"], purpose: "kitchen", copies: 1, online: true, backupId: "p_grill", ip: "", port: 9100 },
        { id: "p_grill", name: "Máy in bếp nướng", location: "Bếp nướng", categories: ["c_grill"], purpose: "kitchen", copies: 1, online: true, backupId: "p_kitchen", ip: "", port: 9100 },
        { id: "p_tank", name: "Máy in hồ cá", location: "Hồ hải sản", categories: ["c_sea"], purpose: "tag", copies: 2, online: true, backupId: "p_kitchen", ip: "", port: 9100 },
        { id: "p_bar", name: "Máy in quầy bar", location: "Quầy bar", categories: ["c_beer", "c_soft", "c_liquor"], purpose: "kitchen", copies: 1, online: true, backupId: "p_cashier", ip: "", port: 9100 },
      ],
      scale: { enabled: true, port: "COM3", stableMs: 800, tareKg: 0, decimals: 2 },
      receipt: { showWifi: true, showQr: true, qrLockAmount: false, showVatNote: true, footer: "Quét mã QR để tự xuất hóa đơn VAT trong 24 giờ", copiesPrebill: 1 },

      tax: { pricesIncludeVat: true, food: 8, alcohol: 10, hkdRate: 4.5, mode: "hkd", einvoiceProvider: "Viettel S-Invoice", einvoiceWindowHours: 24 },
      theme: { posDark: false, kioskDark: false },
    };
  }

  /* ---------------- DU LIEU MAU ---------------- */
  function seedData(cfg) {
    const now = Date.now();
    const today = U.dayKey(now);
    const rnd = U.seeded(20261104);
    const min = 60000;

    const staff = [
      { id: "s_owner", name: "Nguyễn Văn Hùng", role: "owner", pin: "1111", phone: "0909123456", payType: "none", active: true },
      { id: "s_acc", name: "Trần Thị Mai", role: "accountant", pin: "2222", phone: "0909000222", payType: "monthly", baseSalary: 9000000, shiftId: "", active: true },
      { id: "s_cash", name: "Lê Minh Tuấn", role: "cashier", pin: "3333", phone: "0909000333", payType: "monthly", baseSalary: 8500000, shiftId: "sh_evening", active: true },
      { id: "s_lan", name: "Phạm Thị Lan", role: "waiter", pin: "4444", phone: "0909000444", payType: "hourly", hourlyRate: 28000, shiftId: "sh_evening", assignedAreas: ["ar_garden"], assignedTables: ["t_A1", "t_A2", "t_A3", "t_A4", "t_A5", "t_A6"], active: true },
      { id: "s_nam", name: "Đỗ Văn Nam", role: "waiter", pin: "4445", phone: "0909000445", payType: "hourly", hourlyRate: 28000, shiftId: "sh_late", assignedAreas: ["ar_garden"], assignedTables: ["t_A7", "t_A8", "t_A9", "t_A10", "t_A11", "t_A12"], active: true },
      { id: "s_hoa", name: "Vũ Thị Hoa", role: "waiter", pin: "4446", phone: "0909000446", payType: "hourly", hourlyRate: 26000, shiftId: "sh_evening", assignedAreas: ["ar_indoor", "ar_vip"], assignedTables: ["t_B1", "t_B2", "t_B3", "t_B4", "t_V1"], active: true },
      { id: "s_duc", name: "Phan Văn Đức", role: "waiter", pin: "4447", phone: "0909000447", payType: "hourly", hourlyRate: 26000, shiftId: "sh_late", assignedAreas: ["ar_indoor", "ar_vip"], assignedTables: ["t_B5", "t_B6", "t_B7", "t_B8", "t_V2"], active: true },
      { id: "s_thao", name: "Ngô Thị Thảo", role: "pg", pin: "5555", phone: "0909000555", payType: "hourly", hourlyRate: 30000, shiftId: "sh_evening", brandIds: ["br_tiger", "br_heineken"], active: true },
      { id: "s_long", name: "Bùi Văn Long", role: "tank", pin: "6666", phone: "0909000666", payType: "monthly", baseSalary: 7500000, shiftId: "sh_split", active: true },
      { id: "s_son", name: "Hoàng Văn Sơn", role: "chef", pin: "7777", phone: "0909000777", payType: "monthly", baseSalary: 14000000, shiftId: "sh_split", active: true },
      { id: "s_hanh", name: "Đinh Thị Hạnh", role: "cleaner", pin: "8888", phone: "0909000888", payType: "hourly", hourlyRate: 24000, shiftId: "sh_evening", active: true },
    ];

    /* Cham cong: thang truoc + cac ngay da qua trong thang nay + hom nay */
    const attendance = [];
    const curMonthStart = new Date(new Date(U.dayStart(today)).getFullYear(), new Date(U.dayStart(today)).getMonth(), 1);
    const prevMonthStart = new Date(curMonthStart.getFullYear(), curMonthStart.getMonth() - 1, 1);
    const shiftOf = (s) => cfg.shifts.find((x) => x.id === s.shiftId);
    for (let d = new Date(prevMonthStart); U.dayKey(d.getTime() + 7 * 3600000) < today; d.setDate(d.getDate() + 1)) {
      const key = U.dayKey(new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12).getTime());
      staff.forEach((s) => {
        if (s.role === "owner" || !s.shiftId) return;
        if (rnd() < 0.13) return; // nghi
        const sh = shiftOf(s);
        sh.segments.forEach((seg, si) => {
          const start = U.atTime(seg.start, key);
          const end = U.atTime(seg.end, key);
          const late = rnd() < 0.18 ? Math.floor(rnd() * 25) + 3 : 0;
          const inAt = start - Math.floor(rnd() * 8) * min + late * min;
          const outAt = end + Math.floor(rnd() * 20 - 5) * min;
          attendance.push(mkAtt(s, key, inAt, outAt, si, cfg));
        });
      });
    }
    // Hom nay: nhung nguoi ca toi / gay da vao
    staff.forEach((s) => {
      if (s.role === "owner" || !s.shiftId) return;
      const sh = shiftOf(s);
      sh.segments.forEach((seg, si) => {
        const start = U.atTime(seg.start, today);
        if (start > now - 5 * min) return;
        const late = s.id === "s_hoa" ? 12 : s.id === "s_duc" ? 3 : 0;
        const inAt = start - 4 * min + late * min;
        const end = U.atTime(seg.end, today);
        const rec = mkAtt(s, today, inAt, end < now ? end + 3 * min : null, si, cfg);
        attendance.push(rec);
      });
    });

    /* Ve sinh/het bill ngay hom qua -> tao 1 yeu cau OT */
    const yKey = U.dayKey(now - 24 * 3600000);
    const namYesterday = attendance.filter((a) => a.staffId === "s_nam" && a.dayKey === yKey).pop();

    /* Kho: ton nguyen lieu bep + be hai san (co tung con & so kg chinh xac) + do uong */
    const stock = {
      bag_beef: 22,
      bag_pork: 18,
      bag_squid: 6,
      bag_rib: 14,
      bag_intestine: 11,
      bag_frog: 9,
      bag_feet: 16,
      bag_chicken: 9,
      bag_hotpot: 7,
      bag_tofu: 26,
      bag_fries: 24,
      bag_lotus: 12,
      bag_rice: 19,
      bag_veg_hotpot: 18,
      bag_veg_side: 25,
      bag_spices: 32,
    };
    const mkFishList = (prefix, weights) => {
      const items = weights.map((kg, idx) => ({
        id: prefix + "-" + String(idx + 1).padStart(2, "0"),
        code: "#" + prefix + "-" + String(idx + 1).padStart(2, "0"),
        kg: Math.round(kg * 100) / 100,
      }));
      const totalKg = Math.round(items.reduce((s, f) => s + f.kg, 0) * 100) / 100;
      return { count: items.length, kg: totalKg, items };
    };
    const tank = {
      m_grouper: mkFishList("CM", [0.78, 0.85, 0.92, 0.95, 1.02, 1.08, 1.1, 1.15]),
      m_lobster: mkFishList("TH", [0.58, 0.64, 0.68, 0.72, 0.78, 0.85]),
      m_crab: mkFishList("CT", [0.42, 0.45, 0.48, 0.48, 0.5, 0.52, 0.54, 0.56, 0.58, 0.62]),
      m_snail: { count: 0, kg: 6.4, items: [] },
      m_seabass: mkFishList("CC", [0.92, 0.98, 1.05, 1.1, 1.15, 1.25, 1.3]),
    };
    const drinks = { m_tiger: 312, m_heineken: 240, m_saigon: 168, m_coke: 96, m_water: 120, m_ice: 60, m_chivas: 8, m_ricewine: 14 };

    /* Bill dang mo */
    const tickets = [];
    const item = (menuId, extra) => {
      const m = cfg.menu.find((x) => x.id === menuId);
      return Object.assign({ id: U.uid("it"), menuId, name: m.name, qty: 1, price: m.price || 0, status: "sent", sentAt: now - 20 * min, addedBy: "s_lan" }, extra || {});
    };
    tickets.push({
      id: "tk_A02", tableId: "t_A2", status: "open", guests: 6, openedAt: now - 42 * min, waiterId: "s_lan",
      items: [item("m_tofu", { qty: 2, status: "served" }), item("m_beef", { status: "served" }), item("m_squid", { sentAt: now - 9 * min }), item("m_tiger", { qty: 12, addedBy: "s_thao", status: "served" }), item("m_tiger", { qty: 1, price: 0, isFree: true, promoId: "pr_tiger", addedBy: "s_thao", status: "served" }), item("m_ice", { qty: 2, status: "served" })],
      payments: [],
    });
    tickets.push({
      id: "tk_A03", tableId: "t_A3", status: "open", guests: 4, openedAt: now - 18 * min, waiterId: "s_lan",
      items: [item("m_fries", { status: "served" }), item("m_grouper", { qty: 1, count: 1, kg: 0.95, price: 0, pricePerKg: 650000, styleId: "st_hk", status: "sent", fishIds: ["CM-00"], fishSummary: "#CM-00 (0,95 kg)", sentAt: now - 5 * min, note: "Cá #CM-00 (0,95 kg) · Ít hành" }), item("m_heineken", { qty: 6, addedBy: "s_thao", status: "served" })],
      payments: [],
    });
    tickets.push({
      id: "tk_A05", tableId: "t_A5", status: "locked", guests: 5, openedAt: now - 96 * min, waiterId: "s_hoa", prebillAt: now - 6 * min,
      items: [item("m_salad", { status: "served", addedBy: "s_hoa" }), item("m_hotpot_sea", { status: "served", addedBy: "s_hoa" }), item("m_pork", { qty: 2, status: "served", addedBy: "s_hoa" }), item("m_crab", { kg: 1.15, count: 2, price: 0, styleId: "st_tamarind", status: "served", addedBy: "s_hoa" }), item("m_saigon", { qty: 18, status: "served", addedBy: "s_hoa" })],
      payments: [],
    });
    tickets.push({
      id: "tk_B02", tableId: "t_B2", status: "open", guests: 3, openedAt: now - 25 * min, waiterId: "s_hoa",
      items: [item("m_feet", { status: "served", addedBy: "s_hoa" }), item("m_intestine", { status: "sent", sentAt: now - 24 * min, addedBy: "s_hoa" }), item("m_heineken", { qty: 12, addedBy: "s_thao" }), item("m_heineken", { qty: 1, price: 0, isFree: true, promoId: "pr_heineken", addedBy: "s_thao" })],
      payments: [],
    });
    tickets.push({
      id: "tk_V1", tableId: "t_V1", status: "open", guests: 10, openedAt: now - 95 * min, waiterId: "s_hoa", bookingId: "bk_1", deposit: 500000,
      items: [item("m_lobster", { kg: 1.42, count: 2, price: 0, styleId: "st_sashimi", status: "served", addedBy: "s_hoa" }), item("m_grouper", { kg: 1.05, count: 1, price: 0, styleId: "st_hk", status: "served", addedBy: "s_hoa" }), item("m_beef", { qty: 2, status: "served", addedBy: "s_hoa" }), item("m_chivas", { qty: 1, status: "served", addedBy: "s_hoa" }), item("m_coke", { qty: 6, status: "served", addedBy: "s_hoa" }), item("m_ice", { qty: 3, status: "served", addedBy: "s_hoa" })],
      payments: [],
    });
    tickets.push({
      id: "tk_A08", tableId: "t_A8", status: "open", guests: 8, openedAt: now - 64 * min, waiterId: "s_nam",
      items: [item("m_hotpot_chk", { status: "served", addedBy: "s_nam" }), item("m_rib", { qty: 2, status: "served", addedBy: "s_nam" }), item("m_snail", { kg: 0.8, price: 0, styleId: "st_garlic", status: "served", addedBy: "s_nam" }), item("m_tiger", { qty: 24, status: "served", addedBy: "s_thao" }), item("m_tiger", { qty: 2, price: 0, isFree: true, promoId: "pr_tiger", addedBy: "s_thao", status: "served" })],
      payments: [],
    });

    /* Cac bill da thanh toan trong ca hom nay */
    const sales = [];
    const saleSpecs = [
      { t: "t_A1", mins: 130, w: "s_lan", items: [["m_tofu", 1], ["m_feet", 1], ["m_tiger", 10], ["m_ice", 1]], pay: "cash" },
      { t: "t_B1", mins: 110, w: "s_hoa", items: [["m_beef", 1], ["m_rice", 1], ["m_coke", 3]], pay: "qr" },
      { t: "t_A6", mins: 95, w: "s_lan", items: [["m_squid", 1], ["m_pork", 1], ["m_heineken", 12], ["m_ice", 2]], pay: "qr", tip: 50000 },
      { t: "t_B3", mins: 80, w: "s_duc", items: [["m_hotpot_sea", 1], ["m_saigon", 12]], pay: "cash" },
      { t: "t_A4", mins: 62, w: "s_nam", items: [["m_frog", 1], ["m_fries", 1], ["m_tiger", 6]], pay: "qr" },
      { t: "t_A9", mins: 40, w: "s_lan", items: [["m_salad", 1], ["m_rib", 1], ["m_ricewine", 1], ["m_water", 2]], pay: "cash" },
      { t: "t_B5", mins: 21, w: "s_hoa", items: [["m_intestine", 1], ["m_tofu", 1], ["m_tiger", 8]], pay: "qr", tip: 20000 },
    ];
    saleSpecs.forEach((sp, i) => {
      const closedAt = now - sp.mins * min;
      const tk = { id: "tk_done_" + i, tableId: sp.t, status: "open", guests: 4, openedAt: closedAt - 75 * min, closedAt, waiterId: sp.w, items: sp.items.map(([mid, q]) => item(mid, { qty: q, status: "served", addedBy: sp.w })), payments: [] };
      sales.push({ ticket: tk, pay: sp.pay, tip: sp.tip || 0 });
    });

    /* Ca thu ngan dang mo */
    const shift = {
      id: "ca_" + today, dayKey: today, cashierId: "s_cash", openedAt: U.atTime("15:20", today) > now ? now - 4 * 3600000 : U.atTime("15:20", today),
      openingCash: 2000000, status: "open",
      petty: [{ id: U.uid("pc"), at: now - 150 * min, amount: 120000, reason: "Mua đá cây bổ sung", by: "s_cash" }, { id: U.uid("pc"), at: now - 70 * min, amount: 85000, reason: "Mua chanh, ớt", by: "s_cash" }],
      tipsPaid: [], advancesPaid: [], denominations: null,
    };

    /* Dat ban */
    const bookings = [
      { id: "bk_1", name: "Anh Khoa", phone: "0912345678", dayKey: today, time: U.time(now - 100 * min), guests: 10, areaId: "ar_vip", tableId: "t_V1", deposit: 500000, depositPaid: true, status: "seated", createdAt: now - 2 * 86400000, note: "Sinh nhật, chuẩn bị bánh" },
      { id: "bk_2", name: "Chị Ngọc", phone: "0987111222", dayKey: today, time: "20:00", guests: 4, areaId: "ar_garden", tableId: "t_A10", deposit: 200000, depositPaid: true, status: "confirmed", createdAt: now - 5 * 3600000, note: "" },
      { id: "bk_3", name: "Anh Phong (Công ty Minh Long)", phone: "0903555666", dayKey: today, time: "20:30", guests: 14, areaId: "ar_vip", tableId: "t_V2", deposit: 500000, depositPaid: true, status: "confirmed", createdAt: now - 26 * 3600000, note: "Cần xuất hóa đơn công ty" },
      { id: "bk_4", name: "Anh Tài", phone: "0938777888", dayKey: today, time: "21:00", guests: 6, areaId: "ar_garden", tableId: "t_A11", deposit: 200000, depositPaid: false, status: "holding", createdAt: now - 8 * min, holdUntil: now + 22 * min, note: "" },
      { id: "bk_5", name: "Chị Vy", phone: "0977333444", dayKey: yKey, time: "19:00", guests: 12, areaId: "ar_vip", tableId: "t_V2", deposit: 500000, depositPaid: true, status: "noshow", createdAt: now - 3 * 86400000, note: "" },
    ];

    const bottleKeeps = [
      { id: "bt_1", code: "RG-0012", phone: "0912345678", name: "Anh Khoa", wine: "Chivas 18 (700ml)", remainingPct: 40, createdAt: now - 12 * 86400000, expiresAt: now + 48 * 86400000, status: "kept" },
      { id: "bt_2", code: "RG-0015", phone: "0912345678", name: "Anh Khoa", wine: "Macallan 12 (700ml)", remainingPct: 75, createdAt: now - 5 * 86400000, expiresAt: now + 55 * 86400000, status: "kept" },
      { id: "bt_3", code: "RG-0016", phone: "0903555666", name: "Anh Phong", wine: "Johnnie Walker Black (1L)", remainingPct: 20, createdAt: now - 40 * 86400000, expiresAt: now + 20 * 86400000, status: "kept" },
    ];

    /* Lich su 60 ngay (tong hop theo ngay) cho bao cao */
    const dailyStats = [];
    for (let i = 60; i >= 1; i--) {
      const key = U.dayKey(now - i * 86400000);
      const dow = new Date(U.dayStart(key)).getDay();
      const weekend = dow === 5 || dow === 6 || dow === 0;
      const base = (weekend ? 46 : 31) * 1e6 * (0.85 + rnd() * 0.3);
      const alcoholShare = 0.36 + rnd() * 0.06;
      const food = Math.round(base * (1 - alcoholShare) / 1000) * 1000;
      const alcohol = Math.round(base * alcoholShare / 1000) * 1000;
      const vipFee = weekend ? 200000 : 0;
      const revenue = food + alcohol + vipFee;
      const cogs = Math.round((food + alcohol) * (0.37 + rnd() * 0.06));
      const bills = Math.round(revenue / (1.05e6 + rnd() * 3e5));
      dailyStats.push({
        dayKey: key, revenue, food, alcohol, cogs,
        vipFee,
        discount: 0,
        cash: Math.round(revenue * (0.35 + rnd() * 0.1)), qr: 0,
        bills, guests: bills * 5,
        wastage: Math.round(150000 + rnd() * 450000),
        labor: Math.round(4.1e6 + rnd() * 6e5),
        utility: Math.round(food * (0.036 + rnd() * 0.012)),
        tips: Math.round(80000 + rnd() * 200000),
        variance: Math.round((rnd() - 0.6) * 60000 / 1000) * 1000,
        closedBy: "s_cash", locked: true,
      });
      dailyStats[dailyStats.length - 1].qr = revenue - dailyStats[dailyStats.length - 1].cash;
    }

    /* Hao hut */
    const wastage = [
      { id: "ws_1", at: now - 35 * min, menuId: "m_seabass", kind: "seafood", count: 1, kg: 0.8, amount: 0.8 * 210000, reason: "Cá chết trong bể, đã cắt đuôi", by: "s_long", photo: true, status: "pending" },
      { id: "ws_2", at: now - 26 * 3600000, bagId: "bag_squid", kind: "bag", qty: 1, amount: 95000, reason: "Túi mực bị rách, ôi", by: "s_long", photo: true, status: "approved", resolvedBy: "s_owner", resolvedAt: now - 25 * 3600000 },
    ];

    const advances = [
      { id: "adv_1", staffId: "s_lan", amount: 1500000, reason: "Đóng học phí cho con", at: now - 50 * min, status: "pending" },
      { id: "adv_2", staffId: "s_long", amount: 1000000, reason: "", at: now - 3 * 86400000, status: "paid", approvedBy: "s_owner", paidAt: now - 3 * 86400000 + 3600000, paidBy: "s_cash" },
    ];

    const counts = [
      {
        id: "cnt_prev", dayKey: yKey, at: U.dayStart(yKey) + 19 * 3600000, by: "s_long", status: "submitted", locked: true, varianceStatus: "pending", varianceValue: 942500,
        lines: [
          { ref: "m_lobster", type: "tank", name: "Tôm hùm bông", theoCount: 7, theoKg: 4.9, actCount: 6, actKg: 4.25 },
          { ref: "m_grouper", type: "tank", name: "Cá mú", theoCount: 14, theoKg: 11.9, actCount: 14, actKg: 11.6 },
          { ref: "bag_beef", type: "bag", name: "Túi bò thăn", theo: 22, act: 22 },
        ],
      },
    ];

    const approvals = [
      { id: "ap_unlock", type: "unlock_bill", status: "pending", at: now - 4 * min, by: "s_cash", ref: "tk_A05", title: "Mở khóa bill bàn A05", amount: 0, reason: "Khách trả lại 1 đĩa ba chỉ chưa dùng" },
      { id: "ap_waste", type: "wastage", status: "pending", at: now - 35 * min, by: "s_long", ref: "ws_1", title: "Hao hụt: Cá chẽm 1 con, 0,80 kg", amount: 0.8 * 210000, reason: "Cá chết trong bể, đã cắt đuôi", photo: true },
      { id: "ap_adv", type: "advance", status: "pending", at: now - 50 * min, by: "s_lan", ref: "adv_1", title: "Ứng lương: Phạm Thị Lan", amount: 1500000, reason: "Đóng học phí cho con" },
      { id: "ap_count", type: "count_variance", status: "pending", at: now - 18 * 3600000, by: "s_long", ref: "cnt_prev", title: "Lệch kiểm kho: Tôm hùm bông thiếu 1 con", amount: 0.65 * 1450000, reason: "Kiểm kho cuối ca ngày " + U.dayLabel(yKey) },
      { id: "ap_noshow", type: "noshow_deposit", status: "pending", at: now - 20 * 3600000, by: "system", ref: "bk_5", title: "Khách không đến: Chị Vy (VIP 2)", amount: 500000, reason: "Quá 30 phút so với giờ hẹn 19:00, đề nghị giữ tiền cọc" },
    ];
    if (namYesterday && namYesterday.out) {
      namYesterday.otPendingMin = 45;
      namYesterday.otStatus = "pending";
      approvals.push({ id: "ap_ot", type: "overtime", status: "pending", at: now - 19 * 3600000, by: "s_nam", ref: namYesterday.id, title: "Tăng ca sau bàn cuối: Đỗ Văn Nam", amount: Math.round(0.75 * 28000 * 1.5), reason: "Ra ca muộn 45 phút so với giới hạn (bàn cuối + 30 phút)", minutes: 45 });
    }

    const receipts = [
      { id: "gr_1", dayKey: today, at: U.dayStart(today) + 3.5 * 3600000, supplier: "Vựa hải sản Năm Căn", by: "s_long", witness: "s_son", lines: [{ ref: "m_crab", type: "tank", name: "Cua thịt Cà Mau", count: 15, kg: 7.8, cost: 7.8 * 520000 }, { ref: "m_grouper", type: "tank", name: "Cá mú", count: 6, kg: 5.1, cost: 5.1 * 360000 }], total: 7.8 * 520000 + 5.1 * 360000 },
    ];

    const data = {
      seededAt: now,
      staff, attendance, tickets, stock, tank, drinks, shift, shiftsHistory: [], bookings, bottleKeeps,
      dailyStats, sales: [], wastage, advances, counts, approvals, receipts,
      tableState: { t_B4: { status: "dirty", since: now - 3 * min } },
      einvoices: [{ id: "ei_1", saleId: null, taxCode: "0301234567", company: "Công ty TNHH Thương mại Minh Long", email: "ketoan@minhlong.vn", amount: 3450000, at: now - 26 * 3600000, status: "issued", invoiceNo: "C26MTT-00001284" }],
      pgReturns: [],
      printLog: [],
      audit: [],
      configHistory: [],
      notifications: [],
      lastBillClosedAt: now - 21 * min,
      taxLocks: [U.monthKey(new Date(curMonthStart.getTime() - 86400000).getTime())],
      unpaidCustomerDebts: [],
      tipPayouts: [],
      deductions: [],
      otherIncome: [],
      pendingConfig: null,
    };

    // Ghi nhan cac bill da thanh toan qua engine de so lieu nhat quan
    data._pendingSales = sales;
    return data;
  }

  function mkAtt(s, key, inAt, outAt, segIndex, cfg) {
    const sh = cfg.shifts.find((x) => x.id === s.shiftId);
    const seg = sh.segments[segIndex];
    const start = U.atTime(seg.start, key);
    const lateMin = Math.max(0, Math.round((inAt - start) / 60000));
    return {
      id: U.uid("att"), staffId: s.id, dayKey: key, segment: segIndex, shiftId: sh.id,
      in: inAt, out: outAt || null, method: s.role === "chef" || s.role === "cleaner" || s.role === "tank" ? "kiosk" : "mobile",
      lateMin, selfie: true, otPendingMin: 0, otApprovedMin: 0, otStatus: "none",
    };
  }

  /* ---------------- STORE ---------------- */
  const Store = {
    state: null,
    listeners: [],
    clientId: "cl_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 7),
    apiBase: location.protocol === "http:" || location.protocol === "https:" ? "" : "http://127.0.0.1:8765",
    backend: {
      connected: false,
      engine: "PostgreSQL",
      database: "quan_nhau_os",
      revision: 0,
      mode: "",
      uri: "",
      version: "",
      lastSyncAt: null,
      overview: null,
    },
    _backendInitStarted: false,
    _sse: null,
    isDemo: isDemoMode,

    load() {
      const storageKey = activeStorageKey();
      try {
        const raw = localStorage.getItem(storageKey);
        if (raw) {
          const st = JSON.parse(raw);
          if (st && st.config && st.data && st.version === 1) {
            // Bo sung khoa cau hinh moi neu phien ban cu thieu
            st.config = deepMerge(defaultConfig(), st.config);
            normalizeState(st);
            this.state = st;
            this.initBackend();
            return;
          }
        }
      } catch (e) {
        console.warn("Không đọc được dữ liệu lưu, tạo dữ liệu mẫu mới", e);
      }
      this.reset(true);
      this.initBackend();
    },
    reset(silent) {
      const config = defaultConfig();
      const data = seedData(config);
      this.state = { version: 1, config, data, session: null };
      normalizeState(this.state);
      if (window.Engine && Engine.finalizeSeed) Engine.finalizeSeed(this.state);
      this.save();
      if (!silent) {
        if (!isDemoMode()) this.seedPostgres(true);
        this.emit();
      }
    },
    resetClean() {
      const config = (this.state && this.state.config) ? deepMerge(defaultConfig(), this.state.config) : defaultConfig();
      const seeded = seedData(config);
      const now = Date.now();
      const today = U.dayKey(now);
      const cleanData = {
        seededAt: now,
        staff: (this.state && this.state.data && Array.isArray(this.state.data.staff) && this.state.data.staff.length)
          ? this.state.data.staff
          : seeded.staff,
        attendance: [],
        tickets: [],
        stock: seeded.stock,
        tank: seeded.tank,
        drinks: seeded.drinks,
        shift: {
          id: "ca_" + today + "_1",
          dayKey: today,
          cashierId: "s_cash",
          openedAt: now,
          openingCash: 2000000,
          status: "open",
          petty: [],
          tipsPaid: [],
          advancesPaid: [],
          denominations: null,
        },
        shiftsHistory: [],
        bookings: [],
        bottleKeeps: [],
        dailyStats: [],
        sales: [],
        wastage: [],
        advances: [],
        counts: [],
        approvals: [],
        receipts: [],
        tableState: {},
        einvoices: [],
        pgReturns: [],
        printLog: [],
        audit: [{ at: now, who: "s_owner", by: "s_owner", action: "Khởi tạo Quán Mới", detail: "Đã xóa dữ liệu mẫu, sẵn sàng bán hàng thật", text: "Khởi tạo Quán Mới (Đã xóa dữ liệu mẫu, sẵn sàng bán hàng thật)" }],
        configHistory: (this.state && this.state.data && this.state.data.configHistory) || [],
        notifications: [],
        lastBillClosedAt: null,
        taxLocks: [],
        unpaidCustomerDebts: [],
        tipPayouts: [],
        deductions: [],
        otherIncome: [],
        webhookLogs: [],
        pendingConfig: null,
      };
      this.state = {
        version: 1,
        config,
        data: cleanData,
        session: this.state ? this.state.session : null,
      };
      normalizeState(this.state);
      this.save();
      if (!isDemoMode()) this.seedPostgres(true);
      this.emit();
    },
    save() {
      try {
        localStorage.setItem(activeStorageKey(), JSON.stringify(this.state));
      } catch (e) {
        console.error("Lưu dữ liệu thất bại", e);
      }
    },
    // Thay doi state: fn(state) -> ket qua; tu luu va bao giao dien ve lai + dong bo PostgreSQL
    commit(fn, auditText) {
      const res = fn(this.state);
      if (auditText) this.audit(auditText);
      this.save();
      if (!isDemoMode()) this.pushToPostgres(auditText, fn);
      this.emit();
      return res;
    },
    audit(text, who, extra) {
      const s = this.state;
      const actor = who || (s.session && s.session.staffId) || "system";
      const entry = Object.assign(
        {
          at: Date.now(),
          who: actor,
          by: actor,
          action: (extra && extra.action) || (String(text || "").includes(":") ? String(text).split(":")[0] : "Thao tác vận hành"),
          detail: (extra && extra.detail) || text,
          text,
        },
        extra || {}
      );
      s.data.audit = s.data.audit || [];
      s.data.audit.unshift(entry);
      if (s.data.audit.length > 500) s.data.audit.length = 500;
      s.data.auditLog = s.data.audit;
    },
    subscribe(fn) {
      this.listeners.push(fn);
    },
    emit() {
      this.listeners.forEach((fn) => {
        try {
          fn(this.state);
        } catch (e) {
          console.error(e);
        }
      });
    },
    get config() {
      if (!this.state) this.load();
      return this.state.config;
    },
    get data() {
      if (!this.state) this.load();
      return this.state.data;
    },
    exportJson() {
      return JSON.stringify(this.state, null, 2);
    },
    importJson(text) {
      const st = JSON.parse(text);
      if (!st.config || !st.data) throw new Error("Tệp không đúng định dạng");
      st.version = 1;
      this.state = st;
      this.save();
      this.pushToPostgres("Nhập dữ liệu từ tệp JSON");
      this.emit();
    },
    defaultConfig,

    /* ---------------- DONG BO POSTGRESQL BACKEND ---------------- */
    async initBackend() {
      if (isDemoMode()) {
        this.backend.connected = false;
        this.backend.engine = "Sandbox Demo";
        this.backend.database = "demo_isolated";
        this.backend.mode = "demo_sandbox";
        return;
      }
      if (this._backendInitStarted) return;
      this._backendInitStarted = true;
      const wakeupSync = () => {
        if (isDemoMode()) return;
        const now = Date.now();
        if (this._lastWakeSync && now - this._lastWakeSync < 1500) return;
        this._lastWakeSync = now;
        this.syncFromPostgres(false).catch(() => {});
        if (!this._sse || this._sse.readyState === 2) {
          try { if (this._sse) this._sse.close(); } catch (e) {}
          this._sse = null;
          this.connectSse();
        }
      };
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") wakeupSync();
      });
      window.addEventListener("focus", wakeupSync);
      window.addEventListener("online", wakeupSync);
      try {
        await this.syncFromPostgres(true);
        this.connectSse();
      } catch (e) {
        this.backend.connected = false;
      }
    },
    async syncFromPostgres(allowInitialSeed) {
      if (isDemoMode()) return;
      const resp = await fetch(this.apiBase + "/api/state", { cache: "no-store" });
      if (!resp.ok) throw new Error("HTTP " + resp.status);
      const res = await resp.json();
      if (!res.seeded && allowInitialSeed) {
        await this.seedPostgres(false);
        await this.fetchDbOverview();
        this.emit();
        return;
      }
      if (res.seeded && res.state) {
        const st = res.state;
        st.config = deepMerge(defaultConfig(), st.config);
        normalizeState(st);
        const oldRev = Number(res.revision) || 1;
        this.state = {
          version: 1,
          config: st.config,
          data: st.data,
          session: this.state ? this.state.session : null,
        };
        this.backend.connected = true;
        this.backend.revision = oldRev;
        this.backend.lastSyncAt = Date.now();
        this.save();
        await this.fetchDbOverview();
        this.emit();
      }
    },
    async seedPostgres(force) {
      if (isDemoMode()) return;
      try {
        const who = (window.App && App.session && App.session.staffId) || "system";
        const resp = await fetch(this.apiBase + "/api/state/seed", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            state: { version: 1, config: this.state.config, data: this.state.data },
            force: !!force,
            who,
            clientId: this.clientId,
          }),
        });
        if (resp.ok) {
          const out = await resp.json();
          this.backend.connected = true;
          this.backend.revision = Number(out.revision) || this.backend.revision;
          this.backend.lastSyncAt = Date.now();
          this.fetchDbOverview();
        }
      } catch (e) {
        this.backend.connected = false;
      }
    },
    pushToPostgres(auditText, replayFn) {
      if (isDemoMode()) return Promise.resolve();
      this._pushChain = (this._pushChain || Promise.resolve()).then(() =>
        this._doPushToPostgres(auditText, replayFn, 0)
      );
      return this._pushChain;
    },
    async _doPushToPostgres(auditText, replayFn, attempt) {
      if (isDemoMode()) return;
      try {
        const who = (window.App && App.session && App.session.staffId) || "system";
        const resp = await fetch(this.apiBase + "/api/state", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            state: { version: 1, config: this.state.config, data: this.state.data },
            who,
            auditText: auditText || null,
            clientId: this.clientId,
            baseRevision: this.backend.revision || null,
          }),
        });
        if (resp.ok) {
          const out = await resp.json();
          this.backend.connected = true;
          this.backend.revision = Number(out.revision) || this.backend.revision;
          this.backend.lastSyncAt = Date.now();
          return;
        }
        if (resp.status === 409) {
          const conflict = await resp.json().catch(() => null);
          if (conflict && conflict.state) {
            const st = conflict.state;
            st.config = deepMerge(defaultConfig(), st.config);
            normalizeState(st);
            this.state = {
              version: 1,
              config: st.config,
              data: st.data,
              session: this.state ? this.state.session : null,
            };
            this.backend.connected = true;
            this.backend.revision = Number(conflict.revision) || this.backend.revision;
            this.backend.lastSyncAt = Date.now();
            if (typeof replayFn === "function" && (attempt || 0) < 3) {
              try {
                replayFn(this.state);
                if (auditText) this.audit(auditText);
                this.save();
                this.emit();
                return await this._doPushToPostgres(auditText, replayFn, (attempt || 0) + 1);
              } catch (replayErr) {
                this.save();
                this.emit();
                if (window.App && App.toast) {
                  App.toast(replayErr.message || "Dữ liệu vừa được cập nhật từ thiết bị khác.", "warning");
                }
                return;
              }
            }
            this.save();
            this.emit();
          }
        }
      } catch (e) {
        this.backend.connected = false;
      }
    },
    async fetchDbOverview() {
      try {
        const resp = await fetch(this.apiBase + "/api/db/overview", { cache: "no-store" });
        if (!resp.ok) return null;
        const ov = await resp.json();
        this.backend.connected = true;
        this.backend.engine = ov.engine || "PostgreSQL";
        this.backend.database = ov.database || "quan_nhau_os";
        this.backend.revision = Number(ov.revision) || this.backend.revision;
        this.backend.mode = ov.mode || "";
        this.backend.uri = ov.uri || "";
        this.backend.version = ov.version || "";
        this.backend.overview = ov;
        return ov;
      } catch (e) {
        this.backend.connected = false;
        return null;
      }
    },
    async querySql(query) {
      const me = window.App && App.me ? App.me() : null;
      const headers = { "Content-Type": "application/json" };
      if (me && me.id) headers["X-Staff-Id"] = me.id;
      if (me && me.pin) headers["X-Staff-Pin"] = String(me.pin);
      const resp = await fetch(this.apiBase + "/api/db/query", {
        method: "POST",
        headers,
        body: JSON.stringify({ query }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.detail || "Lỗi truy vấn PostgreSQL");
      return data;
    },
    connectSse() {
      if (this._sse || typeof EventSource === "undefined") return;
      try {
        const es = new EventSource(this.apiBase + "/api/events");
        this._sse = es;
        es.onmessage = (ev) => {
          try {
            const msg = JSON.parse(ev.data);
            if (msg.type === "connected") {
              this.backend.connected = true;
              if (msg.revision && msg.revision > this.backend.revision) {
                this.syncFromPostgres(false);
              } else {
                this.emit();
              }
            } else if (msg.type === "state_updated") {
              this.backend.connected = true;
              if (msg.clientId !== this.clientId && msg.revision > this.backend.revision) {
                this.syncFromPostgres(false);
              }
            } else if (msg.type === "payment_webhook") {
              this.backend.connected = true;
              this.syncFromPostgres(false).then(() => {
                if (window.App && App.toast) {
                  const tipTxt = msg.tip > 0 ? " · Tip +" + U.money(msg.tip) : "";
                  App.toast("THANH TOÁN VIETQR THÀNH CÔNG: Bàn " + (msg.tableCode || "") + " (" + U.money(msg.amount || 0) + tipTxt + ")", "success");
                }
              });
            }
          } catch (err) {}
        };
        es.onerror = () => {
          this.backend.connected = false;
          if (es.readyState === 2) {
            try { es.close(); } catch (e) {}
            if (this._sse === es) this._sse = null;
            setTimeout(() => {
              if (!isDemoMode() && !this._sse) this.connectSse();
            }, 3000);
          }
        };
      } catch (e) {}
    },
  };

  function deepMerge(base, over) {
    if (Array.isArray(over)) return over;
    if (over && typeof over === "object") {
      const out = Object.assign({}, base);
      Object.keys(over).forEach((k) => {
        out[k] = base && typeof base[k] === "object" && !Array.isArray(base[k]) && base[k] !== null ? deepMerge(base[k], over[k]) : over[k];
      });
      return out;
    }
    return over === undefined ? base : over;
  }

  function normalizeState(st) {
    if (!st || !st.config || !st.data) return st;
    const def = defaultConfig();
    const cfg = st.config;
    const d = st.data;
    d.stock = d.stock || {};
    d.tank = d.tank || {};
    d.drinks = d.drinks || {};

    // 1. Dam bao du danh muc nguyen lieu bep (bags) & ton kho
    const bagMap = {};
    (cfg.bags || []).forEach((b) => { bagMap[b.id] = b; });
    def.bags.forEach((db) => {
      if (!bagMap[db.id]) {
        cfg.bags.push(Object.assign({}, db));
        bagMap[db.id] = db;
      } else {
        if (!bagMap[db.id].group) bagMap[db.id].group = db.group || "meat";
        if (!bagMap[db.id].unit) bagMap[db.id].unit = db.unit || "túi";
      }
      if (d.stock[db.id] === undefined || d.stock[db.id] === null) {
        d.stock[db.id] = Math.max(12, (db.minStock || 8) + 6);
      }
    });

    // 2. Dam bao 100% mon an bep co dinh muc nguyen lieu (bom) & prefix ma ca
    const defMenuMap = {};
    def.menu.forEach((m) => { defMenuMap[m.id] = m; });
    (cfg.menu || []).forEach((m) => {
      const dm = defMenuMap[m.id];
      if (dm) {
        if (m.kind === "dish" && (!m.bom || !m.bom.length) && dm.bom) {
          m.bom = dm.bom.map((x) => Object.assign({}, x));
        }
        if (m.kind === "seafood" && !m.fishPrefix && dm.fishPrefix) {
          m.fishPrefix = dm.fishPrefix;
        }
      } else if (m.kind === "dish" && (!m.bom || !m.bom.length)) {
        m.bom = [{ bagId: "bag_spices", qty: 1 }];
      }
    });

    // 3. Dam bao be hai san luu danh sach tung con ca voi so kg chinh xac
    const defaultWeights = {
      m_grouper: [0.78, 0.85, 0.92, 0.95, 1.02, 1.08, 1.1, 1.15],
      m_lobster: [0.58, 0.64, 0.68, 0.72, 0.78, 0.85],
      m_crab: [0.42, 0.45, 0.48, 0.48, 0.5, 0.52, 0.54, 0.56, 0.58, 0.62],
      m_seabass: [0.92, 0.98, 1.05, 1.1, 1.15, 1.25, 1.3],
    };
    (cfg.menu || []).filter((m) => m.kind === "seafood").forEach((m) => {
      const tk = (d.tank[m.id] = d.tank[m.id] || { count: 0, kg: 0, items: [] });
      const countable = (Number(m.avgKgPerPiece) || 0) >= 0.1;
      const prefix = m.fishPrefix || m.id.replace(/^m_/, "").slice(0, 2).toUpperCase();
      if (!countable) {
        tk.items = [];
        tk.count = 0;
        tk.kg = Math.max(0, Math.round((Number(tk.kg) || 0) * 100) / 100);
        return;
      }
      if (!Array.isArray(tk.items) || (tk.items.length === 0 && (Number(tk.count) || 0) > 0)) {
        const preset = defaultWeights[m.id];
        const targetCount = Number(tk.count) || (preset ? preset.length : 0);
        const totalKg = Number(tk.kg) || 0;
        const list = [];
        if (preset && (targetCount === preset.length || targetCount > 10)) {
          preset.forEach((w, idx) => {
            list.push({
              id: prefix + "-" + String(idx + 1).padStart(2, "0"),
              code: "#" + prefix + "-" + String(idx + 1).padStart(2, "0"),
              kg: w,
            });
          });
        } else if (targetCount > 0) {
          const avg = totalKg > 0 ? totalKg / targetCount : (Number(m.avgKgPerPiece) || 0.85);
          let rem = totalKg > 0 ? totalKg : Math.round(avg * targetCount * 100) / 100;
          for (let i = 0; i < targetCount; i++) {
            const delta = ((i % 3) - 1) * 0.06;
            const w = i === targetCount - 1 ? Math.max(0.2, Math.round(rem * 100) / 100) : Math.max(0.2, Math.round((avg + delta) * 100) / 100);
            rem -= w;
            list.push({
              id: prefix + "-" + String(i + 1).padStart(2, "0"),
              code: "#" + prefix + "-" + String(i + 1).padStart(2, "0"),
              kg: w,
            });
          }
        }
        tk.items = list;
      }
      tk.count = tk.items.length;
      tk.kg = Math.round(tk.items.reduce((s, f) => s + (Number(f.kg) || 0), 0) * 100) / 100;
    });

    // 4. Chuyen cac dong pending_weigh cu sang sent voi so kg chinh xac
    (d.tickets || []).forEach((tk) => {
      (tk.items || []).forEach((it) => {
        if (it.status === "pending_weigh") {
          const m = (cfg.menu || []).find((x) => x.id === it.menuId);
          it.status = "sent";
          if (!(it.kg > 0)) it.kg = (m && Number(m.avgKgPerPiece)) || 0.95;
          if (!it.count && m && (Number(m.avgKgPerPiece) || 0) >= 0.1) it.count = 1;
          if (!it.fishSummary && it.count) it.fishSummary = "#CM-00 (" + String(it.kg).replace(".", ",") + " kg)";
        }
      });
    });

    // 5. Nang cap phan quyen Thu ngan kiem Quan ly ca
    cfg.roles = cfg.roles || def.roles;
    if (cfg.roles.cashier && cfg.roles.cashier.label === "Thu ngân") {
      cfg.roles.cashier.label = "Thu ngân kiêm Quản lý";
    }
    cfg.permissions = cfg.permissions || def.permissions;
    const pCash = (cfg.permissions.cashier = Object.assign({}, def.permissions.cashier, cfg.permissions.cashier || {}));
    if (!pCash._migratedManagerV2) {
      pCash.discount = true;
      if (!(pCash.discountMaxPct > 0)) pCash.discountMaxPct = 10;
      pCash.voidAfterPrint = true;
      if (!(pCash.approveVoidUnder > 0)) pCash.approveVoidUnder = 200000;
      if ((Number(pCash.approveWasteUnder) || 0) < 300000) pCash.approveWasteUnder = 300000;
      pCash.payAdvance = true;
      if (!(pCash.approveAdvanceUnder > 0)) pCash.approveAdvanceUnder = 500000;
      if (!(pCash.approveOvertimeUnderMin > 0)) pCash.approveOvertimeUnderMin = 60;
      if (!(pCash.approveNoShowUnder > 0)) pCash.approveNoShowUnder = 300000;
      pCash.reopenBill = true;
      if (!(pCash.maxSelfUnlockCount > 0)) pCash.maxSelfUnlockCount = 1;
      if (!(pCash.cashierBargainPct > 0)) pCash.cashierBargainPct = 15;
      pCash._migratedManagerV2 = true;
    }

    // 6. Phan cong ban / khu vuc cho Phuc vu + Quyen thu tien tai ban + Ma dinh danh VietQR
    cfg.floor = Object.assign({ autoCleanMinutes: 10, slowOrderMinutes: 20, vipWarnMinutes: 15, assignmentMode: "assigned" }, cfg.floor || {});
    cfg.paymentGateway = Object.assign({}, def.paymentGateway, cfg.paymentGateway || {});
    const pWait = (cfg.permissions.waiter = Object.assign({}, def.permissions.waiter, cfg.permissions.waiter || {}));
    if (pWait.collectPayment === undefined) pWait.collectPayment = true;
    if (pWait.collectCash === undefined) pWait.collectCash = true;
    cfg.receipt = cfg.receipt || {};
    if (cfg.receipt.qrLockAmount === undefined) cfg.receipt.qrLockAmount = false;
    cfg.attendance = cfg.attendance || {};
    if (cfg.attendance.wifiIp === undefined) cfg.attendance.wifiIp = "";
    if (cfg.attendance.storeLat === undefined) cfg.attendance.storeLat = null;
    if (cfg.attendance.storeLng === undefined) cfg.attendance.storeLng = null;
    (cfg.printers || []).forEach((pt) => {
      if (pt.ip === undefined) pt.ip = "";
      if (!pt.port) pt.port = 9100;
    });

    const defaultWaiterAssign = {
      s_lan: { areas: ["ar_garden"], tables: ["t_A1", "t_A2", "t_A3", "t_A4", "t_A5", "t_A6"] },
      s_nam: { areas: ["ar_garden"], tables: ["t_A7", "t_A8", "t_A9", "t_A10", "t_A11", "t_A12"] },
      s_hoa: { areas: ["ar_indoor", "ar_vip"], tables: ["t_B1", "t_B2", "t_B3", "t_B4", "t_V1"] },
      s_duc: { areas: ["ar_indoor", "ar_vip"], tables: ["t_B5", "t_B6", "t_B7", "t_B8", "t_V2"] },
    };
    (d.staff || []).forEach((s) => {
      if (s.role === "waiter") {
        const preset = defaultWaiterAssign[s.id];
        if (!Array.isArray(s.assignedAreas)) s.assignedAreas = preset ? preset.areas.slice() : ["ar_garden"];
        if (!Array.isArray(s.assignedTables)) s.assignedTables = preset ? preset.tables.slice() : [];
      }
    });

    const prefix = (cfg.paymentGateway && cfg.paymentGateway.prefix) || "QN";
    (d.tickets || []).forEach((tk, idx) => {
      if (!tk.payCode) {
        const tb = (cfg.tables || []).find((t) => t.id === tk.tableId);
        const tbCode = ((tb && tb.code) || tk.tableId || "BAN").replace(/[^A-Za-z0-9]/g, "").toUpperCase();
        const suffix = String(tk.id || "")
          .replace(/[^A-Za-z0-9]/g, "")
          .slice(-4)
          .toUpperCase()
          .padStart(4, String((idx + 1) * 173 % 9000 + 1000));
        tk.payCode = prefix + " " + tbCode + " " + suffix;
      }
    });
    // 7. Chuan hoa doanh thu thuan P&L: Doanh thu thuan = Do an + Do uong + Phu thu VIP - Giam gia (TC-19)
    (d.dailyStats || []).forEach((row) => {
      const food = Number(row.food) || 0;
      const alcohol = Number(row.alcohol) || 0;
      const vipFee = Number(row.vipFee) || 0;
      const discount = Number(row.discount) || 0;
      const expectedRev = food + alcohol + vipFee - discount;
      if (expectedRev > 0 && row.revenue !== expectedRev) {
        row.revenue = expectedRev;
        row.qr = Math.max(0, row.revenue - (Number(row.cash) || 0));
      }
    });
    // 8. Dong bo audit va auditLog de trang Chong that thoat & Ngoai le hien thi day du
    d.audit = Array.isArray(d.audit) ? d.audit : Array.isArray(d.auditLog) ? d.auditLog : [];
    d.audit.forEach((a) => {
      if (!a.by) a.by = a.who || "system";
      if (!a.action) a.action = String(a.text || "").includes(":") ? String(a.text).split(":")[0] : "Thao tác vận hành";
      if (!a.detail) a.detail = a.text || "";
    });
    d.auditLog = d.audit;
    d.webhookLogs = d.webhookLogs || [];
    return st;
  }

  // Dong bo giua nhieu tab trinh duyet cung che do (khong tron lan tab Demo va tab Van hanh that)
  window.addEventListener("storage", (e) => {
    if (e.key === activeStorageKey() && e.newValue) {
      try {
        Store.state = JSON.parse(e.newValue);
        Store.emit();
      } catch (err) {}
    }
  });

  window.Store = Store;
})();
