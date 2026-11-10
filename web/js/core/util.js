/* =========================================================================
   util.js - Ham tien ich dung chung (khong phu thuoc nghiep vu)
   ========================================================================= */
(function () {
  const U = {};

  U.icon = function (name, cls) {
    const body = (window.ICONS && window.ICONS[name]) || window.ICONS["circle-alert"];
    return '<svg class="ic ' + (cls || "") + '" viewBox="0 0 24 24" aria-hidden="true">' + body + "</svg>";
  };

  U.esc = function (s) {
    if (s === null || s === undefined) return "";
    return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  };
  // Dung trong template: attr an toan
  U.attr = U.esc;

  U.round = function (n, step) {
    step = step || 1;
    return Math.round((Number(n) || 0) / step) * step;
  };

  U.num = function (n, dec) {
    n = Number(n) || 0;
    dec = dec === undefined ? 0 : dec;
    return n.toLocaleString("vi-VN", { minimumFractionDigits: dec, maximumFractionDigits: dec });
  };
  U.money = function (n) {
    return U.num(Math.round(Number(n) || 0)) + " đ";
  };
  U.moneyPlain = function (n) {
    return U.num(Math.round(Number(n) || 0));
  };
  // 38,5 tr / 1,2 tỷ cho the KPI
  U.moneyShort = function (n) {
    n = Number(n) || 0;
    const a = Math.abs(n);
    if (a >= 1e9) return U.num(n / 1e9, 2) + " tỷ";
    if (a >= 1e6) return U.num(n / 1e6, a >= 1e8 ? 0 : 1) + " tr";
    if (a >= 1e3) return U.num(n / 1e3, 0) + "k";
    return U.num(n);
  };
  U.kg = function (n) {
    return U.num(n, 2) + " kg";
  };
  U.pct = function (n, dec) {
    return U.num(n, dec === undefined ? 1 : dec) + "%";
  };
  U.parseNum = function (s) {
    if (typeof s === "number") return s;
    if (s === null || s === undefined) return 0;
    s = String(s).trim().replace(/\s/g, "").replace(/đ/g, "");
    // "1.250.000" -> 1250000 ; "1,25" -> 1.25
    if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, "").replace(",", ".");
    else s = s.replace(",", ".");
    const v = parseFloat(s);
    return isNaN(v) ? 0 : v;
  };

  const pad = (n) => (n < 10 ? "0" : "") + n;
  U.pad = pad;
  U.time = function (ts) {
    if (!ts) return "--:--";
    const d = new Date(ts);
    return pad(d.getHours()) + ":" + pad(d.getMinutes());
  };
  U.date = function (ts) {
    if (!ts) return "";
    const d = new Date(ts);
    return pad(d.getDate()) + "/" + pad(d.getMonth() + 1) + "/" + d.getFullYear();
  };
  U.dateShort = function (ts) {
    const d = new Date(ts);
    return pad(d.getDate()) + "/" + pad(d.getMonth() + 1);
  };
  U.dateTime = function (ts) {
    return U.time(ts) + " " + U.date(ts);
  };
  U.weekday = function (ts) {
    return ["Chủ nhật", "Thứ hai", "Thứ ba", "Thứ tư", "Thứ năm", "Thứ sáu", "Thứ bảy"][new Date(ts).getDay()];
  };
  // "42 phút", "1 giờ 05 phút"
  U.duration = function (ms) {
    const m = Math.max(0, Math.floor(ms / 60000));
    if (m < 60) return m + " phút";
    const h = Math.floor(m / 60);
    return h + " giờ " + pad(m % 60) + " phút";
  };
  U.durShort = function (ms) {
    const m = Math.max(0, Math.floor(ms / 60000));
    if (m < 60) return m + "p";
    return Math.floor(m / 60) + "h" + pad(m % 60);
  };
  U.hours = function (ms) {
    return Math.max(0, ms) / 3600000;
  };
  // mm:ss
  U.clock = function (ms) {
    const s = Math.max(0, Math.floor(ms / 1000));
    return pad(Math.floor(s / 60)) + ":" + pad(s % 60);
  };
  // Ngay kinh doanh: truoc 06:00 tinh cho ngay hom truoc
  U.CUTOFF_HOUR = 6;
  U.dayKey = function (ts) {
    const d = new Date(ts === undefined ? Date.now() : ts);
    if (d.getHours() < U.CUTOFF_HOUR) d.setDate(d.getDate() - 1);
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  };
  U.monthKey = function (ts) {
    return U.dayKey(ts).slice(0, 7);
  };
  U.dayStart = function (key) {
    const [y, m, d] = key.split("-").map(Number);
    return new Date(y, m - 1, d, U.CUTOFF_HOUR, 0, 0).getTime();
  };
  U.dayLabel = function (key) {
    const [y, m, d] = key.split("-");
    return d + "/" + m + "/" + y;
  };
  U.monthLabel = function (key) {
    const [y, m] = key.split("-");
    return "Tháng " + Number(m) + "/" + y;
  };
  // "19:30" + dayKey -> timestamp
  U.atTime = function (hhmm, key) {
    const [h, mi] = hhmm.split(":").map(Number);
    const base = new Date(U.dayStart(key || U.dayKey()));
    base.setHours(h, mi, 0, 0);
    if (h < U.CUTOFF_HOUR) base.setDate(base.getDate() + 1);
    return base.getTime();
  };
  U.minutesOf = function (hhmm) {
    const [h, m] = hhmm.split(":").map(Number);
    return h * 60 + m;
  };

  let _uid = 0;
  U.uid = function (prefix) {
    _uid++;
    return (prefix || "id") + "_" + Date.now().toString(36) + _uid.toString(36) + Math.random().toString(36).slice(2, 5);
  };

  U.norm = function (s) {
    return String(s || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "d")
      .replace(/Đ/g, "D")
      .toLowerCase()
      .trim();
  };
  U.match = function (text, q) {
    if (!q) return true;
    const t = U.norm(text);
    return U.norm(q)
      .split(/\s+/)
      .every((w) => t.includes(w));
  };
  U.initials = function (name) {
    const parts = String(name || "").trim().split(/\s+/);
    if (!parts.length) return "";
    const last = parts[parts.length - 1][0] || "";
    const first = parts.length > 1 ? parts[0][0] : "";
    return (first + last).toUpperCase();
  };
  U.shortName = function (name) {
    const parts = String(name || "").trim().split(/\s+/);
    return parts.slice(-1)[0] || name;
  };

  U.clone = function (o) {
    return JSON.parse(JSON.stringify(o));
  };
  U.get = function (obj, path) {
    return path.split(".").reduce((o, k) => (o == null ? undefined : o[k]), obj);
  };
  U.set = function (obj, path, val) {
    const ks = path.split(".");
    let o = obj;
    for (let i = 0; i < ks.length - 1; i++) {
      if (o[ks[i]] == null) o[ks[i]] = {};
      o = o[ks[i]];
    }
    o[ks[ks.length - 1]] = val;
  };
  U.sum = function (arr, fn) {
    return (arr || []).reduce((s, x) => s + (Number(fn ? fn(x) : x) || 0), 0);
  };
  U.groupBy = function (arr, fn) {
    const m = {};
    (arr || []).forEach((x) => {
      const k = fn(x);
      (m[k] = m[k] || []).push(x);
    });
    return m;
  };
  U.byId = function (arr, id) {
    return (arr || []).find((x) => x.id === id);
  };
  U.seeded = function (seed) {
    let s = seed % 2147483647;
    if (s <= 0) s += 2147483646;
    return function () {
      s = (s * 16807) % 2147483647;
      return (s - 1) / 2147483646;
    };
  };

  /* ---------- QR ---------- */
  U.qrSvg = function (text, opts) {
    opts = opts || {};
    try {
      const qr = window.qrcode(0, "M");
      qr.addData(unescape(encodeURIComponent(text)));
      qr.make();
      const n = qr.getModuleCount();
      const q = 2;
      let path = "";
      for (let r = 0; r < n; r++)
        for (let c = 0; c < n; c++) if (qr.isDark(r, c)) path += "M" + (c + q) + " " + (r + q) + "h1v1h-1z";
      const size = n + q * 2;
      return '<svg viewBox="0 0 ' + size + " " + size + '" shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#fff"/><path d="' + path + '" fill="#111"/></svg>';
    } catch (e) {
      return '<svg viewBox="0 0 10 10"><rect width="10" height="10" fill="#eee"/></svg>';
    }
  };

  // CRC16-CCITT (0x1021, init 0xFFFF) cho chuan EMVCo / VietQR
  function crc16(str) {
    let crc = 0xffff;
    for (let i = 0; i < str.length; i++) {
      crc ^= str.charCodeAt(i) << 8;
      for (let j = 0; j < 8; j++) crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
      crc &= 0xffff;
    }
    return crc.toString(16).toUpperCase().padStart(4, "0");
  }
  function tlv(id, val) {
    val = String(val);
    return id + String(val.length).padStart(2, "0") + val;
  }
  // Tao chuoi VietQR dong (NAPAS 247) theo chuan EMVCo
  U.vietQr = function (bin, account, amount, memo) {
    if (bin && typeof bin === "object") {
      account = bin.account;
      amount = bin.amount;
      memo = bin.memo;
      bin = bin.bin;
    }
    const memoClean = U.norm(memo || "").replace(/[^a-z0-9 ]/gi, "").toUpperCase().slice(0, 25);
    const merchant = tlv("00", "A000000727") + tlv("01", tlv("00", bin) + tlv("01", account)) + tlv("02", "QRIBFTTA");
    let s = tlv("00", "01") + tlv("01", amount ? "12" : "11") + tlv("38", merchant) + tlv("53", "704");
    if (amount) s += tlv("54", Math.round(amount));
    s += tlv("58", "VN");
    if (memoClean) s += tlv("62", tlv("08", memoClean));
    s += "6304";
    return s + crc16(s);
  };

  U.download = function (filename, content, mime) {
    const blob = new Blob([content], { type: mime || "text/plain;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 200);
  };
  U.csv = function (rows) {
    return (
      "\ufeff" +
      rows
        .map((r) =>
          r
            .map((c) => {
              c = c === null || c === undefined ? "" : String(c);
              return /[",;\n]/.test(c) ? '"' + c.replace(/"/g, '""') + '"' : c;
            })
            .join(",")
        )
        .join("\r\n")
    );
  };

  window.U = U;
})();
