/* =========================================================================
   app.js - Khung ung dung: dieu huong, phien dang nhap, su kien, hop thoai
   Moi giao dien dang ky bang App.portal(id, def) va App.actions({...})
   ========================================================================= */
(function () {
  const I = U.icon, esc = U.esc;
  const SESSION_KEY = "quannhau_session";
  const DEMO_SESSION_KEY = "quannhau_session_demo";
  const UI_KEY = "quannhau_ui";
  function activeSessionKey() {
    try {
      return new URLSearchParams(location.search).get("demo") === "1" ? DEMO_SESSION_KEY : SESSION_KEY;
    } catch (e) {
      return SESSION_KEY;
    }
  }

  const App = {
    portals: {},
    _actions: {},
    ui: {},
    _modal: null,
    _modalStack: [],
    route: { portal: "login", view: null },
  };

  /* ---------- Dang ky ---------- */
  App.portal = function (id, def) {
    def.id = id;
    App.portals[id] = def;
  };
  App.actions = function (map) {
    Object.assign(App._actions, map);
  };
  // Trang thai giao dien rieng tung portal (luu sessionStorage de F5 khong mat tab)
  App.state = function (portal, defaults) {
    if (!App.ui[portal]) App.ui[portal] = {};
    const st = App.ui[portal];
    Object.keys(defaults || {}).forEach((k) => {
      if (st[k] === undefined) st[k] = U.clone(defaults[k]);
    });
    return st;
  };
  function saveUi() {
    try {
      sessionStorage.setItem(UI_KEY, JSON.stringify(App.ui));
    } catch (e) {}
  }

  /* ---------- Phien dang nhap ---------- */
  App.session = null;
  App.me = () => (App.session ? Engine.staff(App.session.staffId) : null);
  App.role = () => (App.me() || {}).role || null;
  App.login = function (staffId) {
    App.session = { staffId, at: Date.now() };
    sessionStorage.setItem(activeSessionKey(), JSON.stringify(App.session));
  };
  App.logout = function () {
    App.session = null;
    sessionStorage.removeItem(activeSessionKey());
  };

  /* ---------- Dieu huong (HTML5 History API /path tren Web + fallback #/ tren file://) ---------- */
  const USE_HISTORY = location.protocol === "http:" || location.protocol === "https:";
  App.href = function (portal, view) {
    const p = "/" + portal + (view ? "/" + view : "");
    return USE_HISTORY ? p : "#" + p;
  };
  App.go = function (portal, view) {
    if (USE_HISTORY) {
      const targetPath = "/" + portal + (view ? "/" + view : "");
      if (location.pathname !== targetPath || location.hash) {
        history.pushState(null, "", targetPath + location.search);
      }
      App._modal = null;
      App._modalStack = [];
      App.render();
      return;
    }
    const h = "#/" + portal + (view ? "/" + view : "");
    if (location.hash !== h) location.hash = h;
    else App.render();
  };
  function parseHash() {
    if (USE_HISTORY) {
      if (location.hash && location.hash.startsWith("#/")) {
        const cleanPath = location.hash.slice(1);
        history.replaceState(null, "", cleanPath + location.search);
      }
      const raw = (location.pathname || "/").replace(/^\/+|\/+$/g, "");
      const parts = raw ? raw.split("/") : [];
      const first = parts[0] && parts[0] !== "index.html" ? parts[0] : "login";
      App.route = { portal: first, view: parts[1] || null, sub: parts[1] || null };
      return;
    }
    const parts = (location.hash || "").replace(/^#\/?/, "").split("/");
    App.route = { portal: parts[0] || "login", view: parts[1] || null, sub: parts[1] || null };
  }
  App.currentRoute = () => {
    parseHash();
    return App.route;
  };
  const DEMO_USERS = { waiter: "s_lan", pg: "s_thao", kiosk: "s_long", cashier: "s_cash", owner: "s_owner" };
  App.DEMO_USERS = DEMO_USERS;
  App.isDemo = function () {
    return new URLSearchParams(location.search).get("demo") === "1" && !document.body.classList.contains("no-demo");
  };

  function allowed(portalId) {
    const p = App.portals[portalId];
    if (!p) return false;
    if (p.public) return true;
    const me = App.me();
    if (!me) return false;
    if (me.role === "owner") return true;
    return Engine.portalOfRole(me.role) === portalId;
  }

  /* ---------- Ve giao dien ---------- */
  let renderQueued = false;
  App.render = function () {
    if (renderQueued) return;
    renderQueued = true;
    requestAnimationFrame(() => {
      renderQueued = false;
      doRender();
    });
  };
  App.renderNow = doRender;

  function doRender() {
    parseHash();
    let pid = App.route.portal;
    if (!App.portals[pid]) pid = "login";
    if (!allowed(pid) && DEMO_USERS[pid] && !document.body.classList.contains("no-demo")) {
      App.login(DEMO_USERS[pid]);
    }
    if (!allowed(pid)) {
      pid = "login";
      if (USE_HISTORY && location.pathname !== "/login" && location.pathname !== "/") {
        history.replaceState(null, "", "/login" + location.search);
      }
    }
    const portal = App.portals[pid];
    App.current = pid;
    document.body.dataset.portal = pid;
    // Che do toi cho POS / Kiosk theo cai dat
    const th = Store.config.theme || {};
    const dark = (pid === "cashier" && th.posDark) || (pid === "kiosk" && th.kioskDark);
    document.documentElement.dataset.theme = dark ? "dark" : "light";

    // Giu vi tri con tro khi ve lai
    const ae = document.activeElement;
    let focus = null;
    if (ae && (ae.id || ae.dataset.model) && (ae.tagName === "INPUT" || ae.tagName === "TEXTAREA")) {
      focus = { id: ae.id, model: ae.dataset.model, start: ae.selectionStart, end: ae.selectionEnd, inModal: !!ae.closest("#modal-root") };
    }
    const scrollers = Array.from(document.querySelectorAll("[data-keep-scroll]")).map((el) => [el.dataset.keepScroll, el.scrollTop]);

    let html = "";
    try {
      html = portal.render(App.route.view);
    } catch (e) {
      console.error(e);
      html = '<div class="page">' + UI.banner("danger", "triangle-alert", "<b>Lỗi hiển thị:</b> " + esc(e.message)) + "</div>";
    }
    document.getElementById("app").innerHTML = html;
    renderDemoBar();
    renderModal();
    saveUi();

    scrollers.forEach(([k, top]) => {
      const el = document.querySelector('[data-keep-scroll="' + k + '"]');
      if (el) el.scrollTop = top;
    });
    if (focus) {
      const root = focus.inModal ? document.getElementById("modal-root") : document;
      const el = focus.id ? document.getElementById(focus.id) : root.querySelector('[data-model="' + focus.model + '"]');
      if (el) {
        el.focus();
        try {
          if (focus.start !== null && el.setSelectionRange) el.setSelectionRange(focus.start, focus.end);
        } catch (e) {}
      }
    } else {
      const af = document.querySelector("#modal-root [autofocus]") || (!App._modal && document.querySelector("#app [autofocus]"));
      if (af && document.activeElement !== af && !App._autofocused) {
        af.focus();
      }
    }
    if (portal.after) portal.after();
  }

  /* ---------- Thanh demo chuyen vai tro ---------- */
  const DEMO_PORTALS = [
    { id: "customer", label: "Khách hàng", icon: "smartphone" },
    { id: "waiter", label: "Phục vụ", icon: "clipboard-list" },
    { id: "pg", label: "PG Bia", icon: "beer" },
    { id: "kiosk", label: "Kiosk bếp - hồ cá", icon: "tablet" },
    { id: "cashier", label: "Thu ngân", icon: "monitor" },
    { id: "owner", label: "Chủ quán", icon: "chart-line" },
  ];
  function renderDemoBar() {
    const bar = document.getElementById("demo-bar");
    const b = Store.backend || {};
    const isDemo = App.isDemo();
    const pgLabel = isDemo
      ? "Sandbox Demo (Tách biệt vận hành thật)"
      : b.connected
      ? "PostgreSQL · Rev #" + (b.revision || 1)
      : "PostgreSQL (Offline)";
    const pgDot = '<span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:' + (isDemo ? "#2563EB" : b.connected ? "#16A34A" : "#D97706") + '"></span>';
    bar.innerHTML =
      '<span class="demo-label">' + I("layers") + "Bản demo (Dữ liệu độc lập)</span>" +
      '<div class="demo-roles">' + DEMO_PORTALS.map((p) => '<button type="button" class="' + (App.current === p.id ? "active" : "") + '" data-act="app.demo" data-portal="' + p.id + '">' + I(p.icon) + esc(p.label) + "</button>").join("") +
      '<button type="button" class="' + (App.current === "login" ? "active" : "") + '" data-act="app.demoLogin">' + I("key-round") + "Đăng nhập PIN</button></div>" +
      '<span class="grow"></span>' +
      '<button type="button" data-act="app.pgModal" title="Kiểm tra cơ sở dữ liệu">' + pgDot + I("database") + esc(pgLabel) + "</button>" +
      '<button type="button" data-act="app.demoMenu">' + I("settings") + "Dữ liệu demo</button>" +
      '<a href="/login" style="color:#fff;font-size:12px;padding:4px 8px;border-radius:6px;background:rgba(255,255,255,0.14);text-decoration:none" title="Thoát chế độ Demo để về màn hình vận hành thực tế">' + I("shield-check", "ic-xs") + " Vận hành thật</a>";
  }

  /* ---------- Hop thoai ---------- */
  // App.modal({title, sub, body: fn|string, foot: fn|string, size, sheet, onClose})
  App.modal = function (opts) {
    if (App._modal) App._modalStack.push(App._modal);
    App._modal = opts;
    App._autofocused = false;
    App.render();
  };
  App.closeModal = function (all) {
    const m = App._modal;
    App._modal = all ? null : App._modalStack.pop() || null;
    if (all) App._modalStack = [];
    if (m && m.onClose) m.onClose();
    App.render();
  };
  function renderModal() {
    const root = document.getElementById("modal-root");
    const m = App._modal;
    if (!m) {
      root.innerHTML = "";
      return;
    }
    const val = (x) => (typeof x === "function" ? x() : x || "");
    let body = "",
      foot = "";
    try {
      body = val(m.body);
      foot = val(m.foot);
    } catch (e) {
      console.error(e);
      body = UI.banner("danger", "triangle-alert", esc(e.message));
    }
    root.innerHTML =
      '<div class="modal-backdrop ' + (m.sheet ? "sheet-backdrop" : "") + '" data-act="app.backdrop">' +
      '<div class="modal ' + (m.size ? "modal-" + m.size : "") + (m.sheet ? " sheet" : "") + '" role="dialog" aria-modal="true">' +
      '<div class="modal-head"><div><h3>' + esc(val(m.title)) + "</h3>" + (m.sub ? '<div class="sub">' + val(m.sub) + "</div>" : "") + "</div>" + UI.iconBtn("x", { act: "app.closeModal", title: "Đóng" }) + "</div>" +
      '<div class="modal-body" data-keep-scroll="modal">' + body + "</div>" +
      (foot ? '<div class="modal-foot">' + foot + "</div>" : "") +
      "</div></div>";
  }

  // Hop xac nhan. opts: {title, message, confirm, danger, reason: true|'optional', reasonLabel, placeholder}
  App.confirm = function (opts) {
    return new Promise((resolve) => {
      const st = { reason: "" };
      App._confirmState = st;
      App.modal({
        title: opts.title || "Xác nhận",
        size: "sm",
        body: () =>
          (opts.message ? '<p class="subtle">' + opts.message + "</p>" : "") +
          (opts.html || "") +
          (opts.reason ? UI.field(opts.reasonLabel || "Lý do", UI.textarea({ id: "confirm-reason", model: "_confirm.reason", placeholder: opts.placeholder || "Nhập lý do cụ thể", value: st.reason }), { help: opts.reason === true ? "Bắt buộc. Nội dung được lưu vào nhật ký." : "" }) : ""),
        foot: () => UI.btn(opts.cancel || "Hủy bỏ", { act: "app.confirmNo" }) + UI.btn(opts.confirm || "Xác nhận", { act: "app.confirmYes", kind: opts.danger ? "danger-solid" : "primary" }),
        onClose: () => resolve(null),
      });
      App._confirmResolve = (ok) => {
        if (ok && opts.reason === true && st.reason.trim().length < 3) {
          App.toast("Vui lòng nhập lý do (tối thiểu 3 ký tự).", "error");
          return;
        }
        const m = App._modal;
        if (m) m.onClose = null;
        App.closeModal();
        resolve(ok ? { reason: st.reason.trim() } : null);
      };
    });
  };

  // Nhap PIN xac nhan (nguoi thu 2, chu quan...). opts: {title, message, filter(staff)}
  App.pinPrompt = function (opts) {
    return new Promise((resolve) => {
      const st = { pin: "", error: false };
      App._pinState = st;
      App.modal({
        title: opts.title || "Nhập mã PIN",
        size: "sm",
        body: () => (opts.message ? '<p class="subtle center">' + esc(opts.message) + "</p>" : "") + UI.pinDots(st.pin.length, st.error) + (st.error ? '<p class="center text-danger small">' + esc(st.error) + "</p>" : "") + UI.numpad("app.pinKey"),
        onClose: () => resolve(null),
      });
      App._pinResolve = (staff) => {
        const m = App._modal;
        if (m) m.onClose = null;
        App.closeModal();
        resolve(staff);
      };
      App._pinFilter = opts.filter;
    });
  };

  /* ---------- Thong bao noi ---------- */
  App.toast = function (msg, type, o) {
    o = o || {};
    if (typeof type === "object") {
      o = type;
      type = o.type;
    }
    const root = document.getElementById("toast-root");
    const el = document.createElement("div");
    el.className = "toast t-" + (type || "success");
    const icon = type === "error" ? "circle-x" : type === "warning" ? "triangle-alert" : type === "info" ? "info" : "circle-check";
    el.innerHTML = I(icon) + "<span>" + esc(msg) + "</span>";
    if (o.undo) {
      const b = document.createElement("button");
      b.textContent = "Hoàn tác";
      b.onclick = () => {
        o.undo();
        el.remove();
      };
      el.appendChild(b);
    }
    root.appendChild(el);
    setTimeout(() => el.remove(), o.ms || (o.undo ? 5000 : type === "error" ? 4500 : 2600));
  };

  /* ---------- Chay hanh dong ---------- */
  App.run = function (name, data, el, ev) {
    const fn = App._actions[name];
    if (!fn) {
      console.warn("Chưa có hành động", name);
      return;
    }
    try {
      const r = fn(data || {}, el, ev);
      if (r && typeof r.then === "function") r.catch(handleErr);
    } catch (e) {
      handleErr(e);
    }
  };
  function handleErr(e) {
    if (e instanceof Engine.BizError) App.toast(e.message, "error");
    else {
      console.error(e);
      App.toast("Có lỗi xảy ra: " + e.message, "error");
    }
  }
  // Thay doi du lieu nghiep vu + ve lai (bat loi nghiep vu thanh thong bao)
  App.commit = function (fn, okMsg, auditText) {
    try {
      const r = Store.commit(fn, auditText);
      if (okMsg) App.toast(typeof okMsg === "function" ? okMsg(r) : okMsg, "success");
      return r === undefined ? true : r;
    } catch (e) {
      // Khoi phuc du lieu neu loi giua chung
      Store.load();
      handleErr(e);
      App.render();
      return false;
    }
  };

  function setModel(path, value) {
    if (path.startsWith("_confirm.")) {
      App._confirmState[path.slice(9)] = value;
      return;
    }
    const [portal, ...rest] = path.split(".");
    if (!App.ui[portal]) App.ui[portal] = {};
    U.set(App.ui[portal], rest.join("."), value);
  }
  App.getModel = function (path) {
    const [portal, ...rest] = path.split(".");
    return U.get(App.ui[portal] || {}, rest.join("."));
  };

  /* ---------- Su kien toan cuc ---------- */
  document.addEventListener("click", (ev) => {
    const el = ev.target.closest("[data-act]");
    if (!el) return;
    if (el.dataset.act === "app.backdrop" && ev.target !== el) return;
    if (el.disabled) return;
    ev.preventDefault();
    App.run(el.dataset.act, Object.assign({}, el.dataset), el, ev);
  });
  document.addEventListener("input", (ev) => {
    const el = ev.target;
    if (el.dataset && el.dataset.model) {
      const v = el.type === "checkbox" ? el.checked : el.value;
      setModel(el.dataset.model, v);
      if (el.dataset.live !== undefined) App.render();
    }
  });
  document.addEventListener("change", (ev) => {
    const el = ev.target;
    if (el.dataset && el.dataset.model && (el.type === "checkbox" || el.tagName === "SELECT")) {
      setModel(el.dataset.model, el.type === "checkbox" ? el.checked : el.value);
      if (el.dataset.live !== undefined) App.render();
    }
    if (el.dataset && el.dataset.change) App.run(el.dataset.change, Object.assign({ value: el.type === "checkbox" ? el.checked : el.value }, el.dataset), el, ev);
  });
  document.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape" && App._modal) {
      ev.preventDefault();
      App.closeModal();
      return;
    }
    if (ev.key === "Enter" && App._modal && ev.target.tagName !== "TEXTAREA") {
      const primary = document.querySelector("#modal-root .modal-foot .btn-primary:not([disabled]), #modal-root .modal-foot .btn-danger-solid:not([disabled])");
      if (primary && ev.target.tagName !== "BUTTON") {
        ev.preventDefault();
        primary.click();
        return;
      }
    }
    // Ban phim so cho hop PIN
    if (App._modal && App._pinResolve && /^[0-9]$/.test(ev.key) && document.querySelector("#modal-root .pin-dots")) {
      App.run("app.pinKey", { key: ev.key });
      return;
    }
    const p = App.portals[App.current];
    if (p && p.hotkeys) {
      try {
        p.hotkeys(ev);
      } catch (e) {
        handleErr(e);
      }
    }
  });

  /* ---------- Hanh dong chung ---------- */
  App.actions({
    "app.closeModal": () => App.closeModal(),
    "app.backdrop": () => {
      if (App._modal && App._modal.persistent) return;
      App.closeModal();
    },
    "app.confirmYes": () => App._confirmResolve && App._confirmResolve(true),
    "app.confirmNo": () => App._confirmResolve && App._confirmResolve(false),
    "app.pinKey": (d) => {
      const st = App._pinState;
      if (!st) return;
      st.error = false;
      st.pin = UI.applyKey(st.pin, d.key, 4);
      if (st.pin.length === 4) {
        const staff = Store.data.staff.find((s) => s.pin === st.pin && s.active);
        if (!staff || (App._pinFilter && !App._pinFilter(staff))) {
          st.error = staff ? "Mã PIN không có quyền xác nhận thao tác này." : "Mã PIN không đúng.";
          st.pin = "";
        } else {
          App._pinResolve(staff);
          return;
        }
      }
      App.render();
    },
    "app.logout": async () => {
      const ok = await App.confirm({ title: "Đăng xuất", message: "Bạn muốn đăng xuất khỏi thiết bị này?", confirm: "Đăng xuất" });
      if (!ok) return;
      App.logout();
      App.go("login");
    },
    "app.demo": (d) => {
      if (!App.isDemo()) return;
      const pid = d.portal;
      App._modal = null;
      App._modalStack = [];
      if (pid !== "customer") {
        const uid = DEMO_USERS[pid];
        const me = App.me();
        if (!me || (me.role !== "owner" && Engine.portalOfRole(me.role) !== pid) || (me.role === "owner" && pid !== "owner")) App.login(uid);
      }
      App.go(pid);
    },
    "app.demoLogin": () => {
      App.logout();
      App._modal = null;
      App.go("login");
    },
    "app.demoMenu": () => {
      const b = Store.backend || {};
      App.modal({
        title: "Quản trị Dữ liệu & Hệ thống",
        sub: b.connected ? "Đang đồng bộ thời gian thực với PostgreSQL (" + (b.database || "quan_nhau_os") + " · Rev #" + (b.revision || 1) + ")" : "Đang lưu tạm trên trình duyệt (localStorage).",
        body: () =>
          '<div class="col gap-12">' +
          '<div class="list card">' +
          '<button class="list-row" data-act="app.pgModal">' + I("database") + '<div class="grow"><b>Quản trị Cơ sở dữ liệu PostgreSQL 16</b><div class="meta">Xem 37 bảng dữ liệu quan hệ, trạng thái kết nối và chạy truy vấn SQL trực tiếp.</div></div></button>' +
          '<button class="list-row" data-act="app.cleanStart">' + I("check-circle") + '<div class="grow"><b class="text-success">Khởi tạo Quán Mới (Xóa dữ liệu mẫu để bán hàng thật)</b><div class="meta">Xóa toàn bộ bill mẫu, lịch sử 60 ngày và duyệt mẫu; giữ nguyên sơ đồ bàn, thực đơn, định mức kho và nhân sự để bắt đầu vận hành thực tế.</div></div></button>' +
          '<button class="list-row" data-act="app.resetData">' + I("rotate-ccw") + '<div class="grow"><b>Nạp lại dữ liệu mẫu minh họa</b><div class="meta">Tạo lại bộ dữ liệu mẫu (bàn đang ăn, bill, chấm công, lịch sử 60 ngày) để đào tạo nhân viên.</div></div></button>' +
          '<button class="list-row" data-act="app.exportData">' + I("download") + '<div class="grow"><b>Xuất toàn bộ dữ liệu (JSON)</b><div class="meta">Sao lưu cấu hình và dữ liệu vận hành.</div></div></button>' +
          '<label class="list-row" style="cursor:pointer">' + I("upload") + '<div class="grow"><b>Nhập dữ liệu từ tệp JSON</b><div class="meta">Thay thế dữ liệu hiện tại trên PostgreSQL bằng bản sao lưu.</div></div><input type="file" accept=".json" data-change="app.importData" class="hidden"></label>' +
          "</div>" +
          '<div class="banner banner-info">' + I("info") + "<div>Mọi thay đổi trên bất kỳ màn hình nào đều được ghi vào 37 bảng quan hệ PostgreSQL và phát sự kiện thời gian thực (SSE) tới tất cả thiết bị đang mở.</div></div>" +
          "</div>",
      });
    },
    "app.cleanStart": async () => {
      const ok = await App.confirm({
        title: "Khởi tạo Quán Mới (Bắt đầu vận hành thật)?",
        message: "Hệ thống sẽ xóa toàn bộ bill mẫu, đặt bàn mẫu, yêu cầu duyệt mẫu và lịch sử 60 ngày mẫu. Sơ đồ bàn, thực đơn, định mức nguyên liệu, cấu hình ngân hàng VietQR và danh sách nhân sự được giữ nguyên để bắt đầu bán hàng thật.",
        confirm: "Xóa dữ liệu mẫu & Bắt đầu bán thật",
        danger: true,
      });
      if (!ok) return;
      App.closeModal(true);
      App.ui = {};
      Store.resetClean();
      App.toast("Đã làm sạch dữ liệu mẫu. Hệ thống sẵn sàng vận hành thực tế!", "success");
    },
    "app.pgModal": async () => {
      const st = App.state("pgAdmin", {
        sql: "SELECT id, code, area_id, seats, table_type, clean_status FROM restaurant_tables ORDER BY id LIMIT 15",
        rows: null,
        error: "",
        activeTable: "restaurant_tables",
      });
      await Store.fetchDbOverview();
      if (!st.rows && Store.backend.connected) {
        try {
          const res = await Store.querySql(st.sql);
          st.rows = res.rows;
        } catch (e) {
          st.error = e.message;
        }
      }
      App.modal({
        title: "Cơ sở dữ liệu PostgreSQL 16",
        sub: "Kiểm tra kết nối, danh sách 37 bảng quan hệ và chạy truy vấn SQL trực tiếp",
        size: "xl",
        body: () => {
          const b = Store.backend || {};
          const ov = b.overview || {};
          const counts = ov.tableCounts || {};
          const tableKeys = Object.keys(counts);
          const presets = [
            ["Sơ đồ bàn", "SELECT id, code, area_id, seats, table_type, clean_status FROM restaurant_tables ORDER BY id LIMIT 20"],
            ["Thực đơn & Giá", "SELECT id, name, category_id, kind, price, price_per_kg, unit, drink_stock FROM menu_items ORDER BY category_id, id"],
            ["Bể hải sản sống", "SELECT st.menu_id, m.name, st.piece_count, st.weight_kg, m.price_per_kg FROM seafood_tank st JOIN menu_items m ON m.id = st.menu_id"],
            ["Bill đang mở", "SELECT id, table_id, status, guests, waiter_id, deposit FROM tickets"],
            ["Hóa đơn đã thu", "SELECT id, table_code, day_key, subtotal, vip_fee, grand, vat_total, tip FROM sales ORDER BY closed_at DESC LIMIT 15"],
            ["Nhân sự", "SELECT id, name, role, pin, pay_type, base_salary, hourly_rate, shift_id FROM staff ORDER BY id"],
            ["Doanh thu ngày", "SELECT day_key, revenue, food, alcohol, cogs, bills, wastage, labor FROM daily_stats ORDER BY day_key DESC LIMIT 14"],
          ];
          let resultHtml = "";
          if (st.error) {
            resultHtml = UI.banner("danger", "triangle-alert", esc(st.error));
          } else if (st.rows && st.rows.length) {
            const cols = Object.keys(st.rows[0]);
            resultHtml =
              '<div class="table-wrap" style="max-height:260px;overflow:auto"><table class="dt"><thead><tr>' +
              cols.map((c) => "<th>" + esc(c) + "</th>").join("") +
              "</tr></thead><tbody>" +
              st.rows
                .map(
                  (r) =>
                    "<tr>" +
                    cols
                      .map((c) => {
                        const v = r[c];
                        const txt = v === null || v === undefined ? "-" : typeof v === "object" ? JSON.stringify(v) : String(v);
                        return "<td>" + esc(txt.length > 90 ? txt.slice(0, 90) + "..." : txt) + "</td>";
                      })
                      .join("") +
                    "</tr>"
                )
                .join("") +
              "</tbody></table></div>";
          } else if (st.rows) {
            resultHtml = '<div class="muted small">Truy vấn thành công — 0 dòng kết quả.</div>';
          }
          return (
            '<div class="col gap-16">' +
            (b.connected
              ? '<div class="grid-4">' +
                UI.kpi({ label: "Hệ quản trị", value: "PostgreSQL 16.2", meta: esc(ov.database || "quan_nhau_os"), tone: "success", icon: "database" }) +
                UI.kpi({ label: "Phiên bản dữ liệu", value: "Rev #" + (ov.revision || 1), meta: "Đồng bộ ACID", tone: "info", icon: "refresh-cw" }) +
                UI.kpi({ label: "Tổng số bảng", value: (ov.totalTables || 37) + " bảng", meta: "Chuẩn hóa + JSONB", icon: "layers" }) +
                UI.kpi({ label: "Tổng bản ghi", value: U.num(ov.totalRows || 0) + " dòng", meta: U.num(Math.round((ov.sizeBytes || 0) / 1024)) + " KB", icon: "server" }) +
                "</div>" +
                '<div class="card card-pad row between wrap gap-8"><div class="small"><b>URI kết nối PostgreSQL:</b> <code>' +
                esc(ov.uri || "") +
                '</code></div><div class="row gap-8"><a class="btn btn-sm" href="/api/docs" target="_blank" rel="noopener">' +
                I("file-text") +
                'Tài liệu REST API (/api/docs)</a>' +
                UI.btn("Làm mới", { icon: "refresh-cw", size: "sm", act: "app.pgRefresh" }) +
                "</div></div>"
              : UI.banner("warning", "triangle-alert", "Chưa kết nối được tới máy chủ PostgreSQL Backend (/api/health). Hãy chạy <code>python C:/quan_nhau/backend/server.py</code>.")) +
            '<div class="grid-2">' +
            '<div class="card card-pad col gap-8">' +
            '<div class="row between"><b>37 bảng quan hệ trong PostgreSQL</b><span class="muted small">Bấm vào bảng để xem dữ liệu</span></div>' +
            '<div class="table-wrap" style="max-height:310px;overflow:auto"><table class="dt"><thead><tr><th>Tên bảng PostgreSQL</th><th class="num">Số dòng</th><th></th></tr></thead><tbody>' +
            tableKeys
              .map(
                (tb) =>
                  "<tr><td><code>" +
                  esc(tb) +
                  '</code></td><td class="num"><b>' +
                  U.num(counts[tb]) +
                  '</b></td><td class="num"><button class="btn btn-xs" data-act="app.pgTable" data-table="' +
                  esc(tb) +
                  '">Xem</button></td></tr>'
              )
              .join("") +
            "</tbody></table></div></div>" +
            '<div class="card card-pad col gap-8">' +
            '<div class="row between"><b>Truy vấn SQL trực tiếp (PostgreSQL)</b><span class="muted small">Chỉ đọc (SELECT / WITH)</span></div>' +
            '<div class="chips">' +
            presets.map((p) => '<button type="button" class="chip" data-act="app.pgPreset" data-sql="' + esc(p[1]) + '">' + esc(p[0]) + "</button>").join("") +
            "</div>" +
            UI.textarea({ model: "pgAdmin.sql", value: st.sql, rows: 3 }) +
            '<div class="row between"><span class="muted small">' +
            (st.rows ? "Trả về " + st.rows.length + " dòng" : "") +
            "</span>" +
            UI.btn("Chạy truy vấn SQL", { kind: "primary", size: "sm", icon: "play", act: "app.pgRunSql" }) +
            "</div>" +
            resultHtml +
            "</div></div></div>"
          );
        },
        foot: () => UI.btn("Đóng", { act: "app.closeModal" }),
      });
    },
    "app.pgRefresh": async () => {
      await Store.fetchDbOverview();
      App.render();
      App.toast("Đã làm mới trạng thái PostgreSQL.");
    },
    "app.pgTable": async (d) => {
      const st = App.state("pgAdmin", {});
      st.sql = "SELECT * FROM " + d.table + " LIMIT 30";
      st.error = "";
      try {
        const res = await Store.querySql(st.sql);
        st.rows = res.rows;
      } catch (e) {
        st.error = e.message;
      }
      App.render();
    },
    "app.pgPreset": async (d) => {
      const st = App.state("pgAdmin", {});
      st.sql = d.sql;
      st.error = "";
      try {
        const res = await Store.querySql(st.sql);
        st.rows = res.rows;
      } catch (e) {
        st.error = e.message;
      }
      App.render();
    },
    "app.pgRunSql": async () => {
      const st = App.state("pgAdmin", {});
      st.error = "";
      try {
        const res = await Store.querySql(st.sql);
        st.rows = res.rows;
      } catch (e) {
        st.error = e.message;
      }
      App.render();
    },
    "app.resetData": async () => {
      const ok = await App.confirm({ title: "Khôi phục dữ liệu mẫu", message: "Toàn bộ thao tác đã thực hiện sẽ bị xóa. Tiếp tục?", confirm: "Khôi phục", danger: true });
      if (!ok) return;
      App.closeModal(true);
      App.ui = {};
      Store.reset();
      App.toast("Đã khôi phục dữ liệu mẫu.");
    },
    "app.exportData": () => {
      U.download("quannhau-du-lieu-" + U.dayKey() + ".json", Store.exportJson(), "application/json");
    },
    "app.printK80": (d) => {
      const all = document.querySelectorAll("#modal-root .receipt, #app .receipt");
      const idx = d && d.idx !== undefined ? Number(d.idx) : 0;
      const receiptEl = all[idx] || all[0];
      if (!receiptEl) {
        App.toast("Không tìm thấy nội dung phiếu K80 để in.", "error");
        return;
      }
      const prev = document.getElementById("k80-print-frame");
      if (prev) prev.remove();
      const iframe = document.createElement("iframe");
      iframe.id = "k80-print-frame";
      iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0;pointer-events:none";
      document.body.appendChild(iframe);
      const doc = iframe.contentWindow.document;
      doc.open();
      doc.write(
        "<!doctype html><html><head><meta charset='utf-8'><title>Phiếu in K80</title><style>" +
          "@page{size:80mm auto;margin:0}" +
          "*{box-sizing:border-box}" +
          "html,body{margin:0;padding:0;width:78mm;background:#fff;color:#000;font-family:'Be Vietnam Pro',Arial,sans-serif;font-size:12px;line-height:1.45;-webkit-print-color-adjust:exact;print-color-adjust:exact}" +
          ".receipt{width:76mm;margin:0 auto;padding:3mm 2mm 6mm;color:#000;background:#fff}" +
          ".r-center{text-align:center}" +
          ".r-big{font-weight:700;font-size:14px}" +
          ".r-huge{font-weight:800;font-size:20px;letter-spacing:.5px;margin:2px 0}" +
          ".r-sep{border-top:1px dashed #000;margin:6px 0}" +
          ".r-row{display:flex;justify-content:space-between;gap:8px;align-items:baseline;margin:2px 0}" +
          ".r-row span:last-child{white-space:nowrap;font-variant-numeric:tabular-nums}" +
          ".r-qr{display:flex;justify-content:center;margin:6px 0}" +
          ".r-qr svg{width:136px;height:136px}" +
          ".small{font-size:11px}.muted{color:#222}" +
          "</style></head><body>" +
          receiptEl.outerHTML +
          "</body></html>"
      );
      doc.close();
      setTimeout(() => {
        try {
          iframe.contentWindow.focus();
          iframe.contentWindow.print();
        } catch (e) {
          window.print();
        }
        setTimeout(() => {
          try { iframe.remove(); } catch (e) {}
        }, 4000);
      }, 150);
    },
    "app.importData": (d, el) => {
      const f = el.files && el.files[0];
      if (!f) return;
      const r = new FileReader();
      r.onload = () => {
        try {
          Store.importJson(r.result);
          App.closeModal(true);
          App.toast("Đã nhập dữ liệu.");
        } catch (e) {
          App.toast("Tệp không hợp lệ: " + e.message, "error");
        }
      };
      r.readAsText(f);
    },
  });

  /* ---------- Man hinh dang nhap PIN ---------- */
  App.portal("login", {
    public: true,
    render() {
      const st = App.state("login", { pin: "", error: "" });
      const feats = [
        ["layout-grid", "Mỗi vị trí một màn hình riêng", "Phục vụ, PG bia, hồ cá, thu ngân, chủ quán - chỉ thấy đúng việc của mình."],
        ["lock", "Chống thất thoát", "Khóa bill sau khi in tạm tính, kiểm kho không hiện số tồn, tự khóa sổ cuối ca."],
        ["sliders-horizontal", "Chủ quán tự cài đặt", "Bàn, thực đơn, khuyến mãi, ca làm, công thức lương, thuế suất - không cần sửa code."],
      ];
      const demo = Store.data.staff.filter((s) => s.active).map((s) => "<tr><td>" + esc(s.name) + "</td><td>" + esc(Engine.roleLabel(s.role)) + '</td><td class="num"><b>' + s.pin + "</b></td></tr>").join("");
      return '<div class="login-stage">' +
        '<aside class="login-side"><div><div class="brand" style="color:#fff"><span class="brand-mark" style="background:#fff;color:#101828">' + esc(U.initials(Store.config.store.name).slice(0, 2)) + "</span>" + esc(Store.config.store.name) + "</div>" +
        "<h1>Hệ thống vận hành quán nhậu</h1><p style='margin-top:8px'>Đăng nhập bằng mã PIN 4 số. Hệ thống tự mở đúng màn hình theo vị trí làm việc.</p>" +
        feats.map((f) => '<div class="feat">' + I(f[0]) + "<div><b style='color:#fff'>" + f[1] + "</b><div class='small'>" + f[2] + "</div></div></div>").join("") +
        "</div><div class='small'>Khách hàng đặt bàn trực tuyến: <a href='" + App.href("customer") + "' style='color:#fff;text-decoration:underline'>mở trang khách hàng</a></div></aside>" +
        '<main class="login-main"><div class="login-box">' +
        "<div><h2 style='font-size:22px'>Đăng nhập nhân viên</h2><p class='muted'>Nhập mã PIN 4 số của bạn</p></div>" +
        UI.pinDots(st.pin.length, !!st.error) +
        (st.error ? '<p class="center text-danger small">' + esc(st.error) + "</p>" : '<p class="center muted small">Có thể gõ trực tiếp bằng bàn phím</p>') +
        UI.numpad("login.key") +
        (App.isDemo()
          ? '<details class="card card-pad"><summary class="strong" style="cursor:pointer">Mã PIN dùng thử</summary><div class="table-wrap mt-8"><table class="dt"><thead><tr><th>Nhân viên</th><th>Vị trí</th><th class="num">PIN</th></tr></thead><tbody>' + demo + "</tbody></table></div></details>"
          : '<div class="row between items-center card card-pad"><div class="small muted">Dành cho thực khách đặt bàn & tra cứu hóa đơn</div><a class="btn btn-sm" href="' + App.href("customer") + '">' + I("calendar") + " Cổng Khách Hàng</a></div>") +
        "</div></main></div>";
    },
    hotkeys(ev) {
      if (App._modal) return;
      if (/^[0-9]$/.test(ev.key)) App.run("login.key", { key: ev.key });
      else if (ev.key === "Backspace") App.run("login.key", { key: "back" });
    },
  });
  App.actions({
    "login.key": (d) => {
      const st = App.state("login", { pin: "", error: "" });
      st.error = "";
      st.pin = UI.applyKey(st.pin, d.key, 4);
      if (st.pin.length === 4) {
        const staff = Store.data.staff.find((s) => s.pin === st.pin && s.active);
        st.pin = "";
        if (!staff) {
          st.error = "Mã PIN không đúng. Vui lòng thử lại.";
        } else {
          App.login(staff.id);
          const portal = Engine.portalOfRole(staff.role);
          if (staff.role === "chef" || staff.role === "cleaner") App.toast("Vị trí " + Engine.roleLabel(staff.role) + " chấm công tại kiosk bếp.", "info");
          App.go(portal || "login");
          return;
        }
      }
      App.render();
    },
  });

  /* ---------- Khoi dong ---------- */
  App.start = function () {
    if (new URLSearchParams(location.search).get("demo") === "1") {
      document.body.classList.remove("no-demo");
    } else {
      document.body.classList.add("no-demo");
    }
    Store.load();
    try {
      App.session = JSON.parse(sessionStorage.getItem(activeSessionKey()) || "null");
      if (App.session && !Engine.staff(App.session.staffId)) App.session = null;
    } catch (e) {}
    try {
      App.ui = JSON.parse(sessionStorage.getItem(UI_KEY) || "{}") || {};
    } catch (e) {
      App.ui = {};
    }
    Store.subscribe(() => App.render());
    const onRouteChange = () => {
      App._modal = null;
      App._modalStack = [];
      App.render();
    };
    window.addEventListener("hashchange", onRouteChange);
    window.addEventListener("popstate", onRouteChange);
    if (Engine.tick()) Store.save();
    doRender();
    // Dong ho: cap nhat bo dem moi giay, chay luat tu dong moi 15 giay
    setInterval(() => {
      const now = Date.now();
      document.querySelectorAll("[data-tick]").forEach((el) => {
        const ts = Number(el.dataset.ts);
        const mode = el.dataset.tick;
        if (mode === "countdown") el.textContent = U.clock(ts - now);
        else if (mode === "mmss") el.textContent = U.clock(now - ts);
        else if (mode === "clock") el.textContent = U.time(now);
        else el.textContent = U.duration(now - ts);
      });
      if (App.portals[App.current] && App.portals[App.current].tick) App.portals[App.current].tick(now);
    }, 1000);
    setInterval(() => {
      if (Engine.tick()) {
        Store.save();
        App.render();
      } else if (!App._modal && !(document.activeElement && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName))) {
        App.render(); // cap nhat trang thai theo thoi gian (thoi gian ngoi ban, VIP...)
      }
    }, 15000);
  };

  window.App = App;
})();
