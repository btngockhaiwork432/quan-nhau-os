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

  /* ---------- Phien dang nhap (Nho tai khoan tren thiet bi qua localStorage) ---------- */
  function readSavedSession() {
    const key = activeSessionKey();
    try {
      if (key === DEMO_SESSION_KEY) {
        return JSON.parse(sessionStorage.getItem(DEMO_SESSION_KEY) || "null");
      }
      const rawLocal = localStorage.getItem(SESSION_KEY);
      if (rawLocal) return JSON.parse(rawLocal);
      // Tu dong chuyen phien dang nhap cu tu sessionStorage sang localStorage
      const rawLegacy = sessionStorage.getItem(SESSION_KEY);
      if (rawLegacy) {
        localStorage.setItem(SESSION_KEY, rawLegacy);
        sessionStorage.removeItem(SESSION_KEY);
        return JSON.parse(rawLegacy);
      }
    } catch (e) {}
    return null;
  }
  App.session = null;
  App.me = () => {
    if (!App.session || !App.session.staffId) return null;
    const s = Engine.staff(App.session.staffId);
    return s && s.active !== false ? s : null;
  };
  App.role = () => (App.me() || {}).role || null;
  App.login = function (staffId) {
    App.session = { staffId, at: Date.now() };
    const key = activeSessionKey();
    try {
      if (key === DEMO_SESSION_KEY) sessionStorage.setItem(DEMO_SESSION_KEY, JSON.stringify(App.session));
      else {
        localStorage.setItem(SESSION_KEY, JSON.stringify(App.session));
        sessionStorage.removeItem(SESSION_KEY);
      }
    } catch (e) {}
  };
  App.logout = function () {
    App.session = null;
    const key = activeSessionKey();
    try {
      if (key === DEMO_SESSION_KEY) sessionStorage.removeItem(DEMO_SESSION_KEY);
      else {
        localStorage.removeItem(SESSION_KEY);
        sessionStorage.removeItem(SESSION_KEY);
      }
    } catch (e) {}
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
    // Neu thiet bi da dang nhap san tai khoan con hoat dong, tu dong vao thang giao dien cua tai khoan do (khong bat nhap PIN lai)
    if (!App.isDemo() && App.session) {
      const meRemembered = App.me();
      if (meRemembered) {
        if (pid === "login") {
          const homePortal = Engine.portalOfRole(meRemembered.role);
          if (homePortal && App.portals[homePortal]) {
            pid = homePortal;
            App.route = { portal: pid, view: null, sub: null };
            if (USE_HISTORY && location.pathname !== "/" + pid) {
              history.replaceState(null, "", "/" + pid + location.search);
            }
          }
        }
      } else if (Store.backend && Store.backend.connected) {
        // Tai khoan da bi xoa hoac khoa tren PostgreSQL -> xoa phien cu
        App.logout();
      }
    }
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
      let sStart = null, sEnd = null;
      try {
        sStart = ae.selectionStart;
        sEnd = ae.selectionEnd;
      } catch (e) {}
      focus = { id: ae.id, model: ae.dataset.model, start: sStart, end: sEnd, inModal: !!ae.closest("#modal-root") };
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
          if (el.type === "number") {
            const curVal = el.value;
            el.value = "";
            el.value = curVal;
          } else if (focus.start !== null && el.setSelectionRange) {
            el.setSelectionRange(focus.start, focus.end);
          }
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
  let _modalSeq = 0;
  App.modal = function (opts) {
    if (!opts._uid) opts._uid = ++_modalSeq;
    if (App._modal) App._modalStack.push(App._modal);
    App._modal = opts;
    App._autofocused = false;
    App.render();
  };
  App.sheet = function (opts) {
    return App.modal(Object.assign({}, opts, { sheet: true }));
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
      if (root.innerHTML !== "") root.innerHTML = "";
      return;
    }
    const val = (x) => (typeof x === "function" ? x() : x || "");
    let body = "",
      foot = "",
      titleTxt = "",
      subHtml = "";
    try {
      titleTxt = val(m.title);
      subHtml = m.sub ? val(m.sub) : "";
      body = val(m.body);
      foot = val(m.foot);
    } catch (e) {
      console.error(e);
      body = UI.banner("danger", "triangle-alert", esc(e.message));
    }
    const uidStr = String(m._uid || "");
    const existingModal = root.querySelector(".modal");
    if (existingModal && uidStr && existingModal.dataset.modalUid === uidStr) {
      // Giu nguyen khung popup (.modal-backdrop + .modal) de khong bi mat di roi hien lai khi bam + / -
      const headWrap = existingModal.querySelector(".modal-head > div");
      if (headWrap) {
        const nextHeadHtml = "<h3>" + esc(titleTxt) + "</h3>" + (subHtml ? '<div class="sub">' + subHtml + "</div>" : "");
        if (headWrap.innerHTML !== nextHeadHtml) headWrap.innerHTML = nextHeadHtml;
      }
      const bodyEl = existingModal.querySelector(".modal-body");
      if (bodyEl && bodyEl.innerHTML !== body) {
        bodyEl.innerHTML = body;
      }
      let footEl = existingModal.querySelector(".modal-foot");
      if (foot) {
        if (!footEl) {
          footEl = document.createElement("div");
          footEl.className = "modal-foot";
          existingModal.appendChild(footEl);
        }
        if (footEl.innerHTML !== foot) footEl.innerHTML = foot;
      } else if (footEl) {
        footEl.remove();
      }
    } else {
      root.innerHTML =
        '<div class="modal-backdrop ' + (m.sheet ? "sheet-backdrop" : "") + '" data-act="app.backdrop">' +
        '<div class="modal ' + (m.size ? "modal-" + m.size : "") + (m.sheet ? " sheet" : "") + '" data-modal-uid="' + esc(uidStr) + '" role="dialog" aria-modal="true">' +
        '<div class="modal-head"><div><h3>' + esc(titleTxt) + "</h3>" + (subHtml ? '<div class="sub">' + subHtml + "</div>" : "") + "</div>" + UI.iconBtn("x", { act: "app.closeModal", title: "Đóng" }) + "</div>" +
        '<div class="modal-body" data-keep-scroll="modal">' + body + "</div>" +
        (foot ? '<div class="modal-foot">' + foot + "</div>" : "") +
        "</div></div>";
    }
    if (App._ciStream) {
      const vid = document.getElementById("ci-live-video");
      if (vid && vid.srcObject !== App._ciStream) {
        vid.srcObject = App._ciStream;
        vid.play().catch(() => {});
      }
    }
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
      App.printReceiptHtml(receiptEl.outerHTML);
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
    "app.ciRefreshNet": () => App._ciCheckNetwork && App._ciCheckNetwork(),
    "app.ciRefreshGps": () => App._ciCheckGps && App._ciCheckGps(),
    "app.ciStartCam": () => App._ciStartCamera && App._ciStartCamera(),
    "app.ciSnap": () => {
      const st = App._ciState;
      const vid = document.getElementById("ci-live-video");
      if (!st || !vid || !vid.videoWidth) {
        App.toast("Camera đang khởi động, vui lòng đợi 1 giây rồi bấm chụp.", "warning");
        return;
      }
      const w = 320;
      const h = Math.max(200, Math.round((vid.videoHeight / vid.videoWidth) * w));
      const cv = document.createElement("canvas");
      cv.width = w;
      cv.height = h;
      const ctx = cv.getContext("2d");
      ctx.drawImage(vid, 0, 0, w, h);
      st.selfieUrl = cv.toDataURL("image/jpeg", 0.72);
      App.stopCheckinCamera();
      App.render();
    },
    "app.ciRetake": () => {
      if (!App._ciState) return;
      App._ciState.selfieUrl = null;
      App._ciStartCamera();
      App.render();
    },
    "app.ciFileSelfie": (_d, el) => {
      const file = el && el.files && el.files[0];
      if (!file || !App._ciState) return;
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          const w = 320;
          const h = Math.max(200, Math.round((img.height / Math.max(1, img.width)) * w));
          const cv = document.createElement("canvas");
          cv.width = w;
          cv.height = h;
          cv.getContext("2d").drawImage(img, 0, 0, w, h);
          if (App._ciState) {
            App._ciState.selfieUrl = cv.toDataURL("image/jpeg", 0.72);
            App.stopCheckinCamera();
            App.render();
          }
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    },
    "app.ciSubmit": () => {
      const st = App._ciState;
      const me = App.me();
      if (!st || !me) return;
      const r = App.commit(
        () =>
          Engine.checkIn(me.id, {
            method: "mobile",
            clientIp: st.clientIp,
            gpsVerified: st.gpsVerified,
            gpsMeters: st.gpsMeters,
            selfie: !!st.selfieUrl,
            selfieUrl: st.selfieUrl,
          }),
        (res) =>
          res.rec.lateMin
            ? "Đã vào ca (trễ " + res.rec.lateMin + " phút" + (res.penalty ? ", phạt " + U.money(res.penalty) : "") + ")."
            : "Đã chấm công vào ca đúng giờ.",
        "Chấm công vào ca (xác thực IP/GPS/Camera)"
      );
      if (r) {
        App.stopCheckinCamera();
        App.closeModal();
      }
    },
  });

  App.printReceiptHtml = function (html) {
    if (!html) return;
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
        html +
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
  };

  App.printReceiptDoc = function (docObj) {
    if (!docObj || !window.UI || !UI.receipt) return;
    App.printReceiptHtml(UI.receipt(docObj));
  };

  App.stopCheckinCamera = function () {
    if (App._ciStream) {
      try {
        App._ciStream.getTracks().forEach((t) => t.stop());
      } catch (e) {}
      App._ciStream = null;
    }
  };

  // Hop thoai cham cong thuc te (kiem tra IP mang quan + GPS thuc + Camera truoc chup selfie)
  App.openCheckinModal = function () {
    const me = App.me();
    if (!me) return;
    App.stopCheckinCamera();
    const st = {
      netLoading: true,
      clientIp: "",
      netError: "",
      gpsLoading: true,
      gpsVerified: false,
      gpsMeters: null,
      lat: null,
      lng: null,
      gpsError: "",
      camLoading: false,
      camError: "",
      selfieUrl: null,
    };
    App._ciState = st;

    App._ciCheckNetwork = async function () {
      st.netLoading = true;
      st.netError = "";
      App.render();
      try {
        const resp = await fetch((Store.apiBase || "") + "/api/client-info", { cache: "no-store" });
        const data = await resp.json();
        st.clientIp = (data && data.ip) || "local";
      } catch (e) {
        st.clientIp = location.hostname || "local";
      }
      st.netLoading = false;
      App.render();
    };

    App._ciCheckGps = function () {
      const cfg = Store.config.attendance || {};
      if (!cfg.gpsRequired) {
        st.gpsLoading = false;
        st.gpsVerified = true;
        st.gpsMeters = 0;
        App.render();
        return;
      }
      if (!navigator.geolocation) {
        st.gpsLoading = false;
        st.gpsVerified = false;
        st.gpsError = "Trình duyệt trên thiết bị này không hỗ trợ định vị GPS.";
        App.render();
        return;
      }
      st.gpsLoading = true;
      st.gpsError = "";
      App.render();
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (App._ciState !== st) return;
          st.lat = pos.coords.latitude;
          st.lng = pos.coords.longitude;
          st.gpsVerified = true;
          st.gpsLoading = false;
          const curCfg = Store.config.attendance || {};
          const hasStore = curCfg.storeLat !== null && curCfg.storeLat !== undefined && curCfg.storeLat !== "" && curCfg.storeLng !== null && curCfg.storeLng !== undefined && curCfg.storeLng !== "";
          st.gpsMeters = hasStore ? U.haversineMeters(st.lat, st.lng, curCfg.storeLat, curCfg.storeLng) : 0;
          App.render();
        },
        (err) => {
          if (App._ciState !== st) return;
          st.gpsLoading = false;
          st.gpsVerified = false;
          st.gpsError = err && err.code === 1
            ? "Bạn chưa cho phép quyền Vị trí (Location). Hãy bấm Cho phép trên trình duyệt rồi bấm Định vị lại."
            : "Không lấy được tín hiệu GPS (" + ((err && err.message) || "hết thời gian chờ") + "). Hãy bật Định vị trên điện thoại rồi thử lại.";
          App.render();
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    };

    App._ciStartCamera = async function () {
      const cfg = Store.config.attendance || {};
      if (!cfg.selfieRequired || st.selfieUrl) return;
      App.stopCheckinCamera();
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        st.camError = "Trình duyệt chặn luồng video trực tiếp — hãy bấm nút Mở máy ảnh điện thoại bên dưới để chụp.";
        App.render();
        return;
      }
      st.camLoading = true;
      st.camError = "";
      App.render();
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 480 }, height: { ideal: 360 } },
          audio: false,
        });
        if (App._ciState !== st || !App._modal) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        App._ciStream = stream;
        st.camLoading = false;
        App.render();
      } catch (e) {
        if (App._ciState !== st) return;
        st.camLoading = false;
        st.camError = "Chưa mở được camera trực tiếp (" + ((e && e.message) || "chưa cấp quyền") + "). Bạn có thể bấm Mở máy ảnh điện thoại bên dưới để chụp.";
        App.render();
      }
    };

    const seg = Engine.segmentFor(me, Date.now());
    App.modal({
      title: "Chấm công vào ca",
      sub: seg ? "Ca " + seg.seg.start + " – " + seg.seg.end : "Ngoài lịch ca cố định",
      onClose: () => {
        App.stopCheckinCamera();
        App._ciState = null;
      },
      body: () => {
        const cfg = Store.config.attendance || {};
        const expectedIp = String(cfg.wifiIp || "").trim();
        const netOk = !cfg.wifiRequired || (!!st.clientIp && (!expectedIp || st.clientIp === expectedIp));
        const hasStoreCoords = cfg.storeLat !== null && cfg.storeLat !== undefined && cfg.storeLat !== "" && cfg.storeLng !== null && cfg.storeLng !== undefined && cfg.storeLng !== "";
        const gpsOk = !cfg.gpsRequired || (st.gpsVerified && (!hasStoreCoords || (st.gpsMeters !== null && st.gpsMeters <= cfg.gpsRadius)));
        const camOk = !cfg.selfieRequired || !!st.selfieUrl;

        let netSub = "";
        if (!cfg.wifiRequired) netSub = "Không bắt buộc kiểm tra mạng Wi-Fi";
        else if (st.netLoading) netSub = "Đang kiểm tra địa chỉ mạng kết nối...";
        else if (!st.clientIp) netSub = "Chưa xác định được địa chỉ mạng";
        else if (expectedIp) {
          netSub = netOk
            ? "Đúng mạng Wi-Fi quán (" + esc(cfg.wifiName || "Wi-Fi quán") + " · IP " + esc(st.clientIp) + ")"
            : "Đang dùng mạng khác (IP " + esc(st.clientIp) + " ≠ mạng quán " + esc(expectedIp) + ")";
        } else {
          netSub = "Đã ghi nhận IP mạng: " + esc(st.clientIp) + " (" + esc(cfg.wifiName || "Wi-Fi quán") + ")";
        }

        let gpsSub = "";
        if (!cfg.gpsRequired) gpsSub = "Không bắt buộc định vị GPS";
        else if (st.gpsLoading) gpsSub = "Đang lấy tọa độ GPS thực tế từ thiết bị...";
        else if (st.gpsError) gpsSub = esc(st.gpsError);
        else if (hasStoreCoords) {
          gpsSub = "Cách tâm quán " + st.gpsMeters + " m (bán kính cho phép <= " + cfg.gpsRadius + " m)";
        } else if (st.lat !== null) {
          gpsSub = "Đã xác thực GPS (" + st.lat.toFixed(5) + ", " + st.lng.toFixed(5) + ")";
        }

        return (
          '<div class="col gap-12">' +
          '<div class="list" style="border:1px solid var(--line);border-radius:var(--r)">' +
          '<div class="list-row">' +
          I("wifi") +
          '<div class="grow"><b>Mạng Wi-Fi quán</b><div class="meta">' + netSub + "</div></div>" +
          UI.badge(st.netLoading ? "Đang đo" : netOk ? "Hợp lệ" : "Sai mạng", st.netLoading ? "neutral" : netOk ? "success" : "danger") +
          UI.btn("Kiểm tra lại", { act: "app.ciRefreshNet", size: "sm" }) +
          "</div>" +
          '<div class="list-row">' +
          I("map-pin") +
          '<div class="grow"><b>Vị trí GPS tại quán</b><div class="meta">' + gpsSub + "</div></div>" +
          UI.badge(st.gpsLoading ? "Đang định vị" : gpsOk ? "Hợp lệ" : "Chưa đạt", st.gpsLoading ? "neutral" : gpsOk ? "success" : "danger") +
          UI.btn("Định vị lại", { act: "app.ciRefreshGps", size: "sm" }) +
          "</div>" +
          "</div>" +
          (cfg.selfieRequired
            ? '<div class="card card-pad col gap-8">' +
              '<div class="row between"><b>Ảnh khuôn mặt xác thực trực tiếp</b>' +
              UI.badge(camOk ? "Đã chụp" : "Bắt buộc", camOk ? "success" : "warning") +
              "</div>" +
              (st.selfieUrl
                ? '<div class="col center gap-8">' +
                  '<img src="' + st.selfieUrl + '" alt="Ảnh chấm công" style="width:100%;max-width:280px;border-radius:10px;border:2px solid var(--success);object-fit:cover">' +
                  UI.btn("Chụp lại ảnh khác", { act: "app.ciRetake", icon: "camera", size: "sm" }) +
                  "</div>"
                : '<div class="col center gap-8">' +
                  (App._ciStream
                    ? '<video id="ci-live-video" autoplay playsinline muted style="width:100%;max-width:280px;border-radius:10px;background:#111;transform:scaleX(-1);aspect-ratio:4/3;object-fit:cover"></video>' +
                      UI.btn("Chụp ảnh khuôn mặt", { act: "app.ciSnap", kind: "primary", icon: "camera", block: true })
                    : '<div class="subtle small center" style="padding:12px 8px">' +
                      esc(st.camLoading ? "Đang mở camera trước..." : st.camError || "Đang kết nối camera trước...") +
                      "</div>") +
                  '<div class="row gap-8 wrap center">' +
                  (!App._ciStream && !st.camLoading ? UI.btn("Bật lại Camera", { act: "app.ciStartCam", icon: "video", size: "sm" }) : "") +
                  '<label class="btn btn-sm" style="cursor:pointer">' +
                  I("camera") +
                  '<span>Mở máy ảnh điện thoại</span>' +
                  '<input type="file" accept="image/*" capture="user" data-change="app.ciFileSelfie" class="hidden">' +
                  "</label>" +
                  "</div>" +
                  "</div>") +
              "</div>"
            : "") +
          "</div>"
        );
      },
      foot: () => {
        const cfg = Store.config.attendance || {};
        const expectedIp = String(cfg.wifiIp || "").trim();
        const netOk = !cfg.wifiRequired || (!!st.clientIp && (!expectedIp || st.clientIp === expectedIp));
        const hasStoreCoords = cfg.storeLat !== null && cfg.storeLat !== undefined && cfg.storeLat !== "" && cfg.storeLng !== null && cfg.storeLng !== undefined && cfg.storeLng !== "";
        const gpsOk = !cfg.gpsRequired || (st.gpsVerified && (!hasStoreCoords || (st.gpsMeters !== null && st.gpsMeters <= cfg.gpsRadius)));
        const camOk = !cfg.selfieRequired || !!st.selfieUrl;
        return (
          UI.btn("Đóng", { act: "app.closeModal" }) +
          UI.btn("Xác nhận vào ca", {
            act: "app.ciSubmit",
            kind: "primary",
            icon: "check",
            disabled: !(netOk && gpsOk && camOk),
          })
        );
      },
    });

    App._ciCheckNetwork();
    App._ciCheckGps();
    App._ciStartCamera();
  };

  /* ---------- Khoi dong ---------- */
  App.start = function () {
    if (new URLSearchParams(location.search).get("demo") === "1") {
      document.body.classList.remove("no-demo");
    } else {
      document.body.classList.add("no-demo");
    }
    Store.load();
    App.session = readSavedSession();
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
