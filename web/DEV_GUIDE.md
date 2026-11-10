# Quán Nhậu OS - Hướng dẫn phát triển

Website vận hành quán nhậu theo vai trò. Thuần HTML/CSS/JavaScript, **không cần build, không cần server**:
mở `web/index.html` bằng trình duyệt là chạy (file://). Dữ liệu lưu `localStorage`.

## 1. Cấu trúc

```
web/
  index.html                 nạp CSS + JS theo thứ tự (script thường, KHÔNG dùng ES module)
  css/app.css                Hệ thống thiết kế dùng chung (màu, chữ, nút, thẻ, bảng, modal, POS, kiosk...)
  css/<portal>.css           CSS riêng từng giao diện (customer, pg, kiosk, cashier, owner, settings)
  fonts/                     Be Vietnam Pro (offline)
  js/vendor/qrcode.js        Thư viện tạo mã QR
  js/core/icons.js           window.ICONS - bộ icon Lucide (SVG). Dùng U.icon("ten-icon")
  js/core/util.js            window.U - tiện ích: định dạng tiền/giờ, dayKey, tìm kiếm không dấu, QR, VietQR, CSV
  js/core/store.js           window.Store - cấu hình động (config) + dữ liệu mẫu (data) + lưu localStorage
  js/core/engine.js          window.Engine - TOÀN BỘ nghiệp vụ (bill, VAT, khóa bill, cân, kho, chấm công, lương, duyệt, báo cáo, cấu hình)
  js/core/ui.js              window.UI - thành phần HTML dùng chung (kpi, tile, floor, receipt, payslip, numpad, modal field...)
  js/core/app.js             window.App - điều hướng hash, phiên PIN, sự kiện, modal, confirm, toast, thanh demo, màn hình đăng nhập
  js/portals/*.js            6 giao diện: customer, waiter, pg, kiosk, cashier, owner (+ owner-settings)
```

## 2. Quy tắc bắt buộc

1. **Không emoji** ở bất kỳ đâu (giao diện, thông báo, phiếu in, comment hiển thị). Chỉ dùng icon `U.icon(name)`.
   Danh sách icon có sẵn: xem khóa của `window.ICONS` trong `js/core/icons.js`.
2. **Không viết cứng thông số nghiệp vụ.** Mọi con số (giá, %, phút, ngưỡng, thuế...) lấy từ `Store.config`.
3. **Mọi tính toán nghiệp vụ gọi `Engine`**, không tự tính lại ở giao diện (để số liệu 6 giao diện khớp nhau).
4. **Mọi thay đổi dữ liệu đi qua `App.commit(fn, thongBaoThanhCong)`**. Lỗi nghiệp vụ (`Engine.BizError`) tự hiện thông báo đỏ và dữ liệu được khôi phục.
5. Chữ hiển thị tiếng Việt thông dụng, nút bắt đầu bằng động từ ("Gửi bếp", "In tạm tính", "Xác nhận và in tem"). Không dùng "OK", "Submit". Không dấu chấm than.
6. Định dạng: tiền `U.money(n)` -> `1.250.000 đ`, `U.moneyPlain`, `U.moneyShort` (38,5 tr); kg `U.kg`; giờ `U.time`; ngày `U.date`/`U.dayLabel`.
7. Mỗi màn hình **một nút chính** (`kind: "primary"`); nút hủy/xóa dùng `kind: "danger"` và đặt tách xa.
8. Thao tác không đảo ngược được -> `await App.confirm({ title, message, reason: true, danger: true })`.
9. Trạng thái luôn có chữ + màu (dùng `UI.badge(text, tone)`), không chỉ màu.
10. Kích thước chạm: điện thoại >= 48px, kiosk >= 80px (`.kbtn`, `.kiosk-tab`), desktop >= 40px.

## 3. Cách viết một giao diện

```js
(function () {
  const I = U.icon, esc = U.esc;
  const P = "cashier";
  const S = () => App.state(P, { tab: "floor", tableId: null });   // trạng thái giao diện (sessionStorage)

  App.portal(P, {
    render(view) { /* trả về chuỗi HTML của toàn bộ #app */ },
    hotkeys(ev) { /* phím tắt (tùy chọn) */ },
    tick(now) { /* chạy mỗi giây (tùy chọn) - KHÔNG gọi App.render() mỗi giây */ },
  });

  App.actions({
    "cashier.select": (d, el, ev) => { S().tableId = d.table; App.render(); },          // d = dataset của phần tử
    "cashier.prebill": () => App.commit(() => Engine.printPrebill(S().ticketId, App.me().id), "Đã in tạm tính"),
  });
})();
```

- Gắn hành động: `<button data-act="cashier.select" data-table="t_A2">`.
- Ô nhập gắn trạng thái: `UI.input({ id: "x", model: "cashier.search", live: true })` (`live` = vẽ lại khi gõ, con trỏ được giữ nguyên). Luôn đặt `id` cho input để giữ focus.
- `<select>`/checkbox: `data-model` + `data-change="ten.hanh.dong"` (nhận `d.value`).
- Modal: `App.modal({ title, sub, size: "sm|lg|xl", sheet: true, body: () => html, foot: () => html })`; đóng `App.closeModal()`; `App.closeModal(true)` đóng tất cả.
- Thông báo: `App.toast(msg, "success|error|warning|info")`, có hoàn tác: `App.toast(msg, { type: "info", undo: () => {...} })`.
- PIN người thứ hai: `const staff = await App.pinPrompt({ title, message, filter: s => s.role === "owner" })`.
- Đồng hồ tự chạy: `UI.since(ts)` (thời lượng), `UI.since(ts, "mmss")`, `UI.since(ts, "countdown")`.
- Phiếu in K80: `UI.receipt(doc)`; lịch sử in: `Store.data.printLog`.
- Người dùng hiện tại: `App.me()` (staff), `App.role()`.

## 4. Dữ liệu chính (Store.data)

`staff, attendance, tickets (bill đang mở), sales (bill đã thanh toán), stock (túi định lượng), tank (bể hải sản {count,kg}),
drinks (bia/nước/rượu), shift (ca thu ngân), shiftsHistory (báo cáo chốt ca), bookings, bottleKeeps, dailyStats (60 ngày lịch sử),
wastage, advances, counts (kiểm kho), approvals, receipts (nhập kho), tableState (bàn cần dọn), einvoices, pgReturns, printLog,
audit, configHistory, notifications, deductions, tipPayouts, otherIncome, taxLocks, pendingConfig`.

## 5. Mã PIN dùng thử

| Nhân viên | Vai trò | PIN |
| --- | --- | --- |
| Nguyễn Văn Hùng | Chủ quán | 1111 |
| Trần Thị Mai | Kế toán | 2222 |
| Lê Minh Tuấn | Thu ngân | 3333 |
| Phạm Thị Lan / Đỗ Văn Nam / Vũ Thị Hoa / Phan Văn Đức | Phục vụ | 4444 / 4445 / 4446 / 4447 |
| Ngô Thị Thảo | PG Bia | 5555 |
| Bùi Văn Long | Phụ bếp - Hồ cá | 6666 |
| Hoàng Văn Sơn | Bếp chính | 7777 |
| Đinh Thị Hạnh | Vệ sinh | 8888 |

## 6. Kiến trúc Backend + PostgreSQL 16 (`C:/quan_nhau/backend/`)

Hệ thống đi kèm máy chủ Backend **FastAPI + PostgreSQL 16** tại `C:/quan_nhau/backend/`:

```
backend/
  schema.sql                 Lược đồ 36 bảng quan hệ PostgreSQL 16 chuẩn hóa + JSONB
  db.py                      Tầng kết nối psycopg2, tự khởi chạy PostgreSQL 16.2 tích hợp (pgdata/) hoặc kết nối DATABASE_URL ngoài
  server.py                  Máy chủ FastAPI + Uvicorn + Server-Sent Events (/api/events) + phục vụ Web tĩnh
  .env                       Cấu hình DATABASE_URL, POSTGRES_DB, PORT
  docker-compose.yml         Cấu hình Docker PostgreSQL 16 chuẩn
  requirements.txt           Danh sách thư viện Python
```

### Cách khởi chạy

1. **Chạy trực tiếp trên Windows (tự động bật PostgreSQL 16.2 tích hợp):**
   ```powershell
   python C:\quan_nhau\backend\server.py
   ```
   Hoặc bấm đúp vào `C:\quan_nhau\start_server.bat`.
   Mở trình duyệt tại `http://localhost:8765` (hoặc tài liệu Swagger API tại `http://localhost:8765/api/docs`).

2. **Kết nối PostgreSQL ngoài hoặc Docker:**
   Chỉnh tệp `C:\quan_nhau\backend\.env`:
   ```env
   DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/quan_nhau_os
   ```

### Các nhóm REST API chính

- `GET /api/health` & `GET /api/db/overview`: Trạng thái kết nối PostgreSQL 16, số phiên bản (`revision`), dung lượng và số dòng của toàn bộ 36 bảng.
- `POST /api/db/query`: Chạy câu lệnh SQL `SELECT` trực tiếp trên PostgreSQL.
- `GET /api/state`, `PUT /api/state`, `POST /api/state/seed`: Đồng bộ toàn bộ trạng thái ACID hai chiều với 36 bảng PostgreSQL.
- `GET /api/events`: Luồng Server-Sent Events (SSE) đẩy thông báo cập nhật thời gian thực tới mọi thiết bị trong mạng LAN/Wi-Fi.
- Các endpoint nghiệp vụ: `/api/tables`, `/api/menu`, `/api/tickets`, `/api/sales`, `/api/inventory`, `/api/staff`, `/api/bookings`, `/api/bottle-keeps`, `/api/approvals`, `/api/reports/daily`, `/api/config`.

