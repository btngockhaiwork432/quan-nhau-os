# TÀI LIỆU GIẢI THÍCH TOÀN BỘ LOGIC HỆ THỐNG QUẢN LÝ QUÁN NHẬU HẢI SẢN (A–Z)

**Tên hệ thống:** Quán Nhậu Phố Biển OS (Web SPA 6 Vai Trò + FastAPI + PostgreSQL 16 + Real-time SSE + VietQR Webhook)  
**Tên miền triển khai thực tế:** https://munbao.com  
**Cơ sở dữ liệu:** PostgreSQL 16 (`quannhau_os` — 38 bảng quan hệ chuẩn ACID)  
**Bộ sơ đồ quy trình:** 10 sơ đồ BPMN 2.0 chuẩn OMG (5 sơ đồ `AS-IS` trước khi lên hệ thống & 5 sơ đồ `TO-BE` sau khi lên hệ thống, mỗi quy trình 1 Pool duy nhất, 0 lỗi quy tắc)

---

## MỤC LỤC TỔNG QUAN 12 KHÂU LOGIC TRONG DỰ ÁN

1. **Khâu 1:** Kiến trúc Tổng thể, Luồng dữ liệu Trung tâm & Đồng bộ Thời gian thực (Real-time SSE)
2. **Khâu 2:** Logic Mở Ca, Nhập Hồ Cá Sống Theo Từng Con (`#CM-01`) & Định Mức Nguyên Liệu Bếp (BOM)
3. **Khâu 3:** Logic Đặt Bàn Trực Tuyến, Bắt Buộc Cọc VIP/Đoàn Đông, Tự Hủy Giữ Chỗ 30 Phút & Gửi Rượu OTP
4. **Khâu 4:** Logic Phân Công Nhân Viên Quản Bàn (`assigned` vs `free`) & Tự Động Bàn Giao Bàn Khi Ra Ca
5. **Khâu 5:** Logic Gọi Hải Sản Tươi Sống: Bán Nguyên Con (Ép Giá 3 Tầng) vs Bán Lẻ Theo Gram (`500g` Cắt Lẻ)
6. **Khâu 6:** Logic Xuất Bia Nguyên Thùng (`24 lon`), Tự Tính Khuyến Mãi Hãng & Trả Lại Bia Dư Chưa Khui
7. **Khâu 7:** Logic Báo Hỏng Mọi Nguyên Liệu Tại Bếp Kèm Ảnh Chụp Bắt Buộc & Tự Động Khóa Món Hết BOM
8. **Khâu 8:** Logic Chuyển Bàn, Ghép Bàn & Tách Bill Bảo Toàn Lịch Sử Mã Thanh Toán VietQR (`mergedPayCodes`)
9. **Khâu 9:** Logic In Tạm Tính Tự Khóa Bill (Ân Hạn 60 Giây) & Phân Quyền Duyệt 2 Tầng (Thu Ngân kiêm Quản Lý Ca vs Chủ Quán)
10. **Khâu 10:** Logic Thanh Toán Nhanh Tại Bàn Bằng VietQR Định Danh, Webhook Biến Động Số Dư & Tự Động Chia Tiền Tip
11. **Khâu 11:** Logic Tách Thuế GTGT Điện Tử (8% Đồ Ăn & 10% Bia Rượu), Đối Soát 4 Lớp & Khóa Sổ Z-Report
12. **Khâu 12:** Logic Tự Động Tính Bảng Lương 10 Nhân Sự & Báo Cáo Lãi Lỗ (P&L) Thời Gian Thực

---

## KHÂU 1: KIẾN TRÚC TỔNG THỂ, LUỒNG DỮ LIỆU TRUNG TÂM & ĐỒNG BỘ THỜI GIAN THỰC

### 1.1. Mô hình 6 Cổng Vai Trò (6 Role-Based Portals)
Hệ thống được thiết kế theo kiến trúc Single-Page Application (SPA) kết hợp Backend FastAPI và cơ sở dữ liệu PostgreSQL 16, chia thành 6 cổng giao diện chuyên biệt theo đúng vị trí làm việc thực tế tại quán nhậu:

| STT | Cổng Giao Diện | Đường dẫn (Route) | File Mã Nguồn Chính | Đối Tượng Sử Dụng & Nhiệm Vụ Cốt Lõi |
| :-: | :--- | :--- | :--- | :--- |
| 1 | **Khách Hàng** | `#/customer` | `web/js/portals/customer.js` | Đặt bàn trực tuyến, nộp cọc QR, xem thực đơn khả dụng theo tồn kho thực, tra cứu rượu gửi bằng mã OTP 6 số, tra cứu Hóa đơn điện tử GTGT (8% & 10%). |
| 2 | **Phục Vụ** | `#/waiter` | `web/js/portals/waiter.js` | Nhận bàn được phân công, mở bàn, xem từng con cá trong bể, gọi cá nguyên con (có ép giá) hoặc cắt lẻ theo gram, gọi bia nguyên thùng (24 lon), bấm trả bia dư, bấm **Thanh toán nhanh tại bàn** hiện mã VietQR định danh và nhận thông báo tích xanh khi tiền về. |
| 3 | **Tiếp Thị Bia (PG)** | `#/pg` | `web/js/portals/pg.js` | Theo dõi các bàn uống bia hãng mình phụ trách (`Tiger`, `Heineken`, `Sabeco`), xuất nhanh nguyên thùng 24 lon / nửa thùng 12 lon, bấm trả bia dư chưa khui, theo dõi định mức khuyến mãi Mua X Tặng Y, nộp nắp/vỏ lon khuyến mãi cuối ca và xem hoa hồng theo thùng. |
| 4 | **Kiosk Bếp & Hồ Cá** | `#/kiosk` | `web/js/portals/kiosk.js` | Giao diện 3 Tab tối giản cho màn hình cảm ứng chống ướt tại Bếp: **Tab 1 (Chế biến & Ra món)** theo SLA 15 phút; **Tab 2 (Báo hỏng nguyên liệu)** cho mọi loại thịt/rau/đậu hũ/hải sản kèm chụp ảnh bắt buộc; **Tab 3 (Nhập cá theo con & Kiểm kho cuối ca)** kèm bảng Đối soát 4 lớp. |
| 5 | **Thu Ngân kiêm Quản Lý Ca** | `#/cashier` | `web/js/portals/cashier.js` | Điều phối sơ đồ bàn, phân công nhân viên phụ trách bàn/khu vực, chuyển/ghép/tách bàn, trả bia dư, in tạm tính K80 tự khóa bill, **Duyệt nhanh tầng 1** (mở khóa lần 1, hủy món <= 200k, giảm giá <= 10%, ép giá cá <= 15%), thu tiền mặt/VietQR, quản lý két tiền mặt (chi vặt, ứng lương, chi Tip) và chốt ca Z-Report. |
| 6 | **Chủ Quán & Kế Toán** | `#/owner` | `web/js/portals/owner.js` | **Phê duyệt tầng 2** cho các vấn đề lớn (mở khóa bill từ lần 2, hủy món > 200k, giảm giá > 10%, ép giá cá > 15%, lệch kho cuối ca), xem Báo cáo Lãi Lỗ (P&L), Bảng lương 10 nhân sự, Sổ thuế HĐĐT GTGT, Nhật ký chống gian lận (Audit Log), Trình quản trị SQL PostgreSQL 16 và Cài đặt toàn bộ thông số quán. |

### 1.2. Cơ chế Đồng bộ Trạng thái Đa Thiết bị (Store -> FastAPI -> PostgreSQL 16 -> SSE)
1. **Kho dữ liệu trung tâm (`web/js/core/store.js`)**:
   - `Store.state.config`: Chứa toàn bộ cấu hình động của quán (sơ đồ bàn, thực đơn, BOM, bảng giá hải sản, hạn mức duyệt, cấu hình VietQR, quy tắc chia Tip).
   - `Store.state.data`: Chứa toàn bộ dữ liệu vận hành phát sinh trong ca (`tables`, `tickets`, `tank`, `stock`, `drinks`, `waste`, `bookings`, `bottles`, `approvals`, `sales`, `cashLog`, `attendance`, `zReports`, `einvoices`, `overpayments`, `audit`).
2. **Cầu nối đồng bộ ACID (`web/js/core/api.js` & `backend/server.py`)**:
   - Mỗi khi một thao tác nghiệp vụ hoàn tất trong `web/js/core/engine.js`, hàm `Store.commit(auditText, who)` được gọi.
   - Dữ liệu lập tức được ghi vào nhật ký kiểm toán `audit` kèm thời gian và người thực hiện, phát sự kiện nội bộ và gửi `POST /api/state/commit` lên máy chủ FastAPI.
   - Máy chủ FastAPI (`backend/db.py`) thực thi giao dịch SQL (Transaction) cập nhật đồng bộ xuống **38 bảng PostgreSQL 16**, tăng số hiệu phiên bản `revision` và phát thông điệp qua luồng **Server-Sent Events (`/api/events`)**.
   - Tất cả điện thoại của Phục vụ, máy tính bảng của PG, màn hình Kiosk Bếp, máy POS Thu ngân và máy Chủ quán nhận sự kiện SSE và tự động vẽ lại giao diện trong vòng `< 50ms` mà không cần tải lại trang.

---

## KHÂU 2: LOGIC MỞ CA, NHẬP HỒ CÁ SỐNG THEO TỪNG CON & ĐỊNH MỨC NGUYÊN LIỆU BẾP (BOM)

### 2.1. Quản lý Hồ Cá Sống Theo Từng Cá Thể (`E.addFishToTank`)
- **Vấn đề thực tế trước khi có hệ thống (`AS-IS`):** Quán chỉ cân tổng khối lượng cá nhập đầu ngày (ví dụ 10 kg cá mú) đổ chung vào bể. Khi bắt cá bán cho khách hoặc khi cá chết, không biết con nào đã bán, con nào bị tráo, hoặc phần cá cắt lẻ còn dư bao nhiêu gram.
- **Logic giải quyết của hệ thống (`TO-BE`):**
  - Trong `Store.data.tank[menuId].fishes`, mỗi con cá sống nhập bể tại **Tab 3 Kiosk (`#/kiosk`)** được cân riêng và cấp một mã định danh duy nhất theo tiền tố loài (`fishPrefix`):
    - Cá mú (`m_grouper`): `#CM-01 (1.36 kg)`, `#CM-02 (1.08 kg)`...
    - Tôm hùm bông (`m_lobster`): `#TH-01 (0.72 kg)`, `#TH-02 (0.68 kg)`...
    - Cua thịt Cà Mau (`m_crab`): `#CT-01 (0.52 kg)`...
    - Cá chẽm (`m_seabass`): `#CC-01 (1.15 kg)`...
  - Cấu trúc dữ liệu của từng con cá trong bể:
    ```json
    {
      "id": "fish_CM_01",
      "code": "CM-01",
      "kg": 1.36,
      "initialKg": 1.36,
      "partial": false,
      "status": "alive",
      "importedAt": 1730800000000,
      "note": "Cá khỏe, nhập sáng"
    }
    ```
  - Tổng số kg khả dụng trong bể luôn bằng tổng trọng lượng `kg` của các cá thể có `status === 'alive'`.

### 2.2. Logic Định Mức Nguyên Liệu Bếp (BOM — Bill of Materials) & Khóa Món Tự Động (`E.menuAvailability`)
- Quán định nghĩa **16 mã nguyên liệu bếp định lượng sẵn** (`Store.config.bags`) chia làm 2 nhóm:
  - **Nhóm Thịt & Gia cầm (`meat`):** Thịt bò thăn (túi 150g), Ba chỉ heo ướp (túi 200g), Mực một nắng (túi 250g), Sườn non heo (túi 250g), Lòng non làm sạch (túi 250g), Thịt ếch (túi 300g), Chân gà rút xương (túi 300g), Gà ta chặt sẵn (phần 700g), Set hải sản nấu lẩu (set 800g).
  - **Nhóm Rau, Đậu hũ & Đồ khô (`veg`):** Đậu hũ non (phần 300g), Khoai tây cắt sợi (phần 250g), Ngó sen & tôm thịt trộn gỏi (phần 300g), Cơm & nhân hải sản chiên (phần 350g), Rau nấm ăn lẩu & lá é (rổ 400g), Hành tây ớt chuông xà lách (phần 150g), Sả tắc ớt tỏi rau răm (set 100g).
- Mỗi món ăn trên thực đơn (`Store.config.menu`) được gắn công thức `bom`. Ví dụ món **Bò lúc lắc (`m_beef`)** cần `1 túi Thịt bò thăn (bag_beef)` + `1 phần Hành tây ớt chuông (bag_veg_side)`.
- Hàm `E.bagAvail(bagId)` tính tồn kho khả dụng tức thời của từng nguyên liệu:
  $$\text{Tồn khả dụng}(b) = \max\big(0,\; \text{open}(b) + \text{in}(b) - \text{sold}(b) - \text{waste}(b)\big)$$
- Hàm `E.menuAvailability(menuId)` tính số đĩa tối đa có thể làm được của một món ăn:
  $$\text{Số đĩa khả dụng} = \min_{(b, q) \in \text{BOM}} \left\lfloor \frac{\text{Tồn khả dụng}(b)}{q} \right\rfloor$$
- **Hệ quả tự động:** Ngay khi một nguyên liệu bị bán hết hoặc được Đầu bếp báo hỏng tại Tab 2 Kiosk khiến $\text{Tồn khả dụng}(b) < q$, số đĩa khả dụng lập tức về `0`. Trên màn hình của Phục vụ (`#/waiter`) và Khách hàng (`#/customer`), món ăn đó hiện nhãn **"Hết nguyên liệu"** và bị khóa nút chọn, chấm dứt hoàn toàn tình trạng Phục vụ nhận order rồi Bếp mới báo hết đồ.

---

## KHÂU 3: LOGIC ĐẶT BÀN TRỰC TUYẾN, BẮT BUỘC CỌC, TỰ HỦY GIỮ CHỖ 30 PHÚT & GỬI RƯỢU OTP

### 3.1. Quy tắc Đặt cọc Tự động (`E.createBooking`)
- Khi khách đặt bàn tại `#/customer` (hoặc Thu ngân nhập tại `#/cashier`), hệ thống kiểm tra điều kiện bắt buộc đặt cọc:
  $$\text{Bắt buộc cọc} = \big(\text{areaId} === \text{'ar\_vip'}\big) \;\lor\; \big(\text{guests} \ge 8\big)$$
- Số tiền cọc yêu cầu:
  - Nếu đặt **Phòng VIP**: `500.000đ` (`Store.config.booking.depositVip`).
  - Nếu đặt khu vực thường mà đoàn $\ge 8$ khách: `200.000đ` (`Store.config.booking.depositNormal`).
- Đơn đặt bàn mới có trạng thái `status = 'pending'` và thời hạn giữ chỗ `holdUntil = createdAt + 30 phút`.

### 3.2. Tự động Giải phóng Bàn Quá hạn (`E.sweepExpiredBookings`)
- Hàm `E.sweepExpiredBookings()` quét định kỳ các đơn đặt bàn:
  1. Nếu đơn `pending` có yêu cầu cọc nhưng quá `holdMinutes = 30` phút chưa thanh toán cọc (`depositPaid < depositRequired`), đơn tự động chuyển sang `status = 'expired'` và nhả bàn.
  2. Nếu đơn đã xác nhận (`confirmed`) nhưng không cọc và khách trễ quá `noShowMinutes = 30` phút so với giờ hẹn mà chưa nhận bàn, hệ thống tự động đánh dấu `no_show` và giải phóng bàn trống để đón khách vãng lai.
- Khi khách đến nhận bàn (`E.seatBooking`), khoản tiền cọc `depositPaid` được nạp thẳng vào `ticket.deposit` của hóa đơn bàn đó để tự động khấu trừ khi thanh toán.

### 3.3. Gửi Rượu Mạnh & Rút Rượu Bằng Mã OTP 6 Số (`E.keepBottle`, `E.requestBottleOtp`, `E.redeemBottleWithOtp`)
- Khi khách gọi rượu mạnh có cờ `bottleKeep: true` (như `Chivas 12`) mà uống không hết, nhân viên bấm **Gửi rượu** (`E.keepBottle`):
  - Lưu tên khách, SĐT, tên chai rượu, phần trăm còn lại (`remainPct`, ví dụ `60%`), bàn gửi, ngày hết hạn (mặc định `+30 ngày`).
- Khi khách quay lại quán vào hôm sau:
  - Khách mở `#/customer` -> nhập SĐT để tra cứu chai rượu đang gửi -> bấm **Nhận mã OTP mở rượu** (`E.requestBottleOtp`).
  - Hệ thống sinh mã OTP 6 chữ số có hiệu lực 10 phút. Phục vụ/Thu ngân nhập đúng mã OTP này (`E.redeemBottleWithOtp`) thì hệ thống mới chuyển trạng thái chai rượu sang `redeemed` và gắn vào bàn đang ngồi, ngăn chặn tuyệt đối việc nhân viên tự ý lấy rượu gửi của khách ra dùng.

---

## KHÂU 4: LOGIC PHÂN CÔNG NHÂN VIÊN QUẢN BÀN & TỰ ĐỘNG BÀN GIAO BÀN KHI RA CA

### 4.1. Hai Chế độ Phân công Bàn (`Store.config.floor.assignmentMode`)
Trong thực tế vận hành, có quán phân công nhân viên cố định theo từng cụm bàn, có quán cho nhân viên chạy bàn tự do. Hệ thống hỗ trợ cả 2 chế độ:
1. **Chế độ `'assigned'` (Phân công nhân viên phụ trách từng bàn / khu vực — Mặc định):**
   - Thu ngân kiêm Quản lý ca (hoặc Chủ quán) gán nhân viên phụ trách cho từng bàn (`E.assignTableWaiter(tableId, waiterId)`) hoặc gán nhanh theo cả khu vực (`E.assignAreaWaiter(areaId, waiterId)`).
   - Trên cổng `#/waiter`, nhân viên có bộ lọc **"Bàn của tôi"** (chỉ hiện các bàn mình phụ trách) và **"Tất cả bàn"** (để hỗ trợ chéo khi cần).
   - Khi mở bàn mới, hệ thống tự động lấy `assignedWaiterId` của bàn đó làm `ticket.waiterId` (người thụ hưởng tiền Tip mặc định của bàn).
2. **Chế độ `'free'` (Chạy bàn tự do):**
   - Nhân viên nào bấm mở bàn thì được ghi nhận vào `ticket.waiterId`, và từng món gọi thêm đều lưu vết người bấm (`item.by`).

### 4.2. Tự động Bàn giao Bàn đang mở khi Nhân viên Chấm công Ra ca (`E.clockOut`)
- **Tình huống ngoại lệ:** Nhân viên phục vụ A kết thúc ca lúc 22:00 và bấm chấm công ra ca (`E.clockOut`), nhưng bàn `A05` do nhân viên A phụ trách vẫn đang ngồi nhậu chưa thanh toán.
- **Logic xử lý tự động:**
  - Hàm `E.clockOut(userId)` tự động tìm nhân viên phục vụ khác đang trong ca (`att.outAt === null`) hoặc người được chỉ định nhận bàn giao (`handoverToUserId`).
  - Toàn bộ các bàn và hóa đơn đang mở (`ticket.status === 'open'` hoặc `'locked'`) của nhân viên A được chuyển quyền phụ trách sang đồng nghiệp nhận ca, đồng thời lưu vết vào mảng `ticket.handoverHistory` (`fromWaiterId`, `toWaiterId`, `at`, `reason: 'clock_out'`).

---

## KHÂU 5: LOGIC GỌI HẢI SẢN TƯƠI SỐNG — NGUYÊN CON (ÉP GIÁ 3 TẦNG) VS CẮT LẺ THEO GRAM

### 5.1. Bán Hải Sản Nguyên Con & Logic Duyệt Ép Giá 3 Tầng (`E.addSeafoodWholeFish`)
Khi khách chọn 1 con cá cụ thể trong bể (ví dụ Cá mú `#CM-01` nặng `1.36 kg`, đơn giá niêm yết `650.000đ/kg`, kiểu chế biến `Nấu lẩu` phụ thu `50.000đ`):
- **Giá niêm yết của con cá:**
  $$\text{Giá niêm yết} = \text{round}\big(1.36 \times 650.000 + 50.000\big) = 934.000\text{đ}$$
- **Giá vốn tối thiểu (Sàn chống bán lỗ):**
  $$\text{Giá vốn sàn} = \text{round}\big(1.36 \times 360.000 + 50.000\big) = 539.600\text{đ}$$
- Nếu khách mặc cả xin trả trọn con với mức giá `bargainPrice`:
  1. **Kiểm tra sàn giá vốn:** Nếu $\text{bargainPrice} < \text{Giá vốn sàn}$, hệ thống **chặn cứng ngay lập tức** và báo lỗi không được bán dưới giá vốn nhập bể.
  2. **Tính tỷ lệ giảm giá ép giá:**
     $$\text{discountPct} = \frac{\text{Giá niêm yết} - \text{bargainPrice}}{\text{Giá niêm yết}} \times 100\%$$
  3. **Phân luồng thẩm quyền 3 tầng:**
     - **Nếu $\text{discountPct} \le 8\%$ (`maxBargainWaiterPct`):** Phục vụ được quyền chốt ngay trên điện thoại tại bàn (`bargainStatus = 'approved'`), không làm khách phải chờ đợi.
     - **Nếu $8\% < \text{discountPct} \le 15\%$ (`maxBargainCashierPct`):** Hệ thống tạo yêu cầu duyệt ở **Tầng 1 (`tier = 'cashier'`)** gửi thẳng về tab **"Duyệt nhanh (Quản lý ca)"** trên máy Thu ngân (`#/cashier`).
     - **Nếu $\text{discountPct} > 15\%$:** Hệ thống tạo yêu cầu duyệt ở **Tầng 2 (`tier = 'owner'`)** đẩy lên màn hình Chủ quán (`#/owner`).
- Ngay khi thêm vào hóa đơn, con cá `#CM-01` được rút khỏi danh sách cá đang bơi trong bể và lưu bản sao `fishSnapshot` vào dòng món ăn để đảm bảo không bàn nào khác chọn trùng con cá đó.

### 5.2. Bán Lẻ Hải Sản Theo Gram (`500g`) & Theo Dõi Cá Đang Xẻ Dở (`E.addSeafoodByGram`)
- Khi khách đi 1–2 người chỉ muốn gọi **500g (`0.5 kg`)** Cá mú hoặc Cá chẽm:
  - Trên `#/waiter`, nhân viên chuyển sang chế độ **"Cắt lẻ theo Gram"**, bấm nút nhanh `500g` (hoặc `300g`, `400g`, `600g`, `700g`) và chọn con cá trong bể để cắt.
  - Hệ thống ưu tiên gợi ý các con cá đang có cờ `partial: true` (đã xẻ một phần trước đó).
  - Sau khi cắt `0.5 kg` từ con cá `#CM-01` (`1.36 kg`):
    - Trọng lượng còn lại của `#CM-01` trong bể được cập nhật thành:
      $$\text{remainingKg} = 1.36 - 0.50 = 0.86\text{ kg}$$
    - Con cá `#CM-01` được gắn cờ `partial: true` (Đang xẻ dở — còn `860g`) để hiển thị nổi bật trên cả `#/waiter` và `#/kiosk`, giúp nhân viên tư vấn bán hết phần cá còn lại ngay trong ca.
    - Nếu cắt vừa hết trọng lượng còn lại ($\text{remainingKg} \le 0.02\text{ kg}$), con cá đó mới được xóa khỏi bể.

---

## KHÂU 6: LOGIC XUẤT BIA NGUYÊN THÙNG (24 LON), TỰ TÍNH KHUYẾN MÃI & TRẢ BIA DƯ CHƯA KHUI

### 6.1. Xuất Bia theo Nguyên Thùng 24 Lon/Chai (`E.addDrink`)
- Đặc thù quán nhậu là đem nguyên thùng bia (24 lon/chai) ướp đá ra bàn cho khách uống thoải mái, cuối giờ uống không hết mới đếm số lon còn nguyên nắp trả lại.
- Khi nhân viên bấm vào mặt hàng bia (`Tiger Bạc`, `Heineken`, `Saigon Special`) hoặc nước ngọt đóng thùng trên `#/waiter`, `#/pg`, `#/cashier`:
  - Modal chọn số lượng hiển thị mặc định ở chế độ **"1 thùng (24 lon)"** (kèm các tùy chọn `2 thùng (48 lon)`, `Nửa thùng (12 lon)`, `Lốc 6 lon`, hoặc `Nhập số lon lẻ`).
  - Khi xác nhận xuất 1 thùng (24 lon):
    - Hệ thống trừ ngay `24` lon khỏi tồn kho bia (`D().drinks[menuId].sold += 24`).
    - Dòng món trên hóa đơn lưu đầy đủ 3 chỉ số:
      - `broughtOutQty = 24` (Tổng số lon đã mang ra bàn)
      - `returnedQty = 0` (Số lon khách trả lại)
      - `qty = 24` (Số lon thực uống tính tiền hiện tại)

### 6.2. Tự động Tính Khuyến Mãi Hãng Mua X Tặng Y (`E.reconcilePromos`)
- Mỗi khi thêm bia hoặc trả lại bia dư, hàm `E.reconcilePromos(ticket)` tự động chạy lại để tính số lon tặng miễn phí theo chương trình khuyến mãi đang bật (`Store.config.promos`):
  - Ví dụ: `Tiger mua 10 tặng 1`, `Heineken mua 12 tặng 1`.
  - Công thức tính tổng số lon được tặng miễn phí của từng mã bia trên bàn:
    $$\text{expectedFree} = \left\lfloor \frac{\text{paidQty}}{\text{buyQty}} \right\rfloor \times \text{freeQty}$$
  - Nếu khách gọi 1 thùng Heineken (`paidQty = 24`), hệ thống tự động sinh dòng khuyến mãi `+2 lon Heineken [KM Hãng 0đ]`, trừ thêm 2 lon khỏi tồn kho bia và cộng `+2` vào chỉ số `capsPending` (số nắp lon khuyến mãi PG phải thu hồi về nộp cho Thu ngân cuối ca).

### 6.3. Logic Trả Lại Bia Dư Chưa Khui & Tự Động Thu Hồi Khuyến Mãi (`E.returnUnusedBeer`)
- Khi khách chuẩn bị tính tiền và trên bàn còn dư các lon bia chưa khui trong thùng (ví dụ đem ra 1 thùng 24 lon Heineken, khách uống 17 lon, còn dư **7 lon**):
- Nhân viên (Phục vụ tại `#/waiter`, PG tại `#/pg`, hoặc Thu ngân tại `#/cashier`) bấm nút **"Trả bia dư"** ngay trên dòng bia đó.
- Giao diện hỗ trợ **2 chế độ nhập đối xứng** để nhân viên không phải tính nhẩm:
  1. **Chế độ "Nhập số lon trả lại":** Nhập `7` lon -> Hệ thống tự tính số lon thực uống = $24 - 7 = 17$ lon.
  2. **Chế độ "Nhập số lon thực uống":** Nhập `17` lon -> Hệ thống tự tính số lon trả lại = $24 - 17 = 7$ lon.
- **Chuỗi xử lý tự động trong `E.returnUnusedBeer(tableId, itemId, returnQty, who)`:**
  1. Kiểm tra hợp lệ: $1 \le \text{returnQty} \le \text{qty hiện tại}$.
  2. Hoàn trả ngay `7` lon vào tồn kho bia tại quầy: `D().drinks[menuId].sold -= 7`.
  3. Cập nhật dòng bia trên bill: `qty = 17`, `returnedQty += 7`, `broughtOutQty = 24`.
  4. Hiển thị nhãn minh bạch trên cả màn hình và phiếu in K80:  
     `Heineken lon [Đem ra 1 thùng (24 lon) · Trả lại 7 lon dư · Tính tiền 17 lon]`.
  5. **Gọi lại `E.reconcilePromos(ticket)` để thu hồi bia tặng KM vượt định mức:**
     - Lúc đầu mang ra 24 lon Heineken (`Mua 12 tặng 1`) nên bàn được tặng `2 lon` miễn phí.
     - Nay khách trả lại 7 lon, chỉ còn uống `17 lon` ($12 \le 17 < 24$), nên chỉ còn đủ điều kiện tặng **`1 lon`**!
     - Hệ thống tự động giảm dòng khuyến mãi từ `2 lon` xuống `1 lon`, hoàn trả `1 lon` KM về kho và giảm `capsPending` đi `1`. Đây là chốt chặn cực kỳ quan trọng giúp quán không bị lỗ bia khuyến mãi khi khách gọi nguyên thùng rồi trả lại!

---

## KHÂU 7: LOGIC BÁO HỎNG NGUYÊN LIỆU TẠI BẾP KÈM ẢNH CHỤP BẮT BUỘC (`#/kiosk` TAB 2)

- **Nguyên tắc nghiệp vụ:** Trong bếp quán nhậu, không chỉ có hải sản trong bể bị ngộp/chết mà bất kỳ nguyên liệu nào (thịt bò, ba chỉ heo, lòng non, chân gà, đậu hũ, rau lẩu...) cũng có thể bị hỏng, chua, dập nát hoặc rơi đổ trong ca.
- **Quy trình xử lý trong `E.reportWaste({ targetType, itemId, qty, reason, hasPhoto, fishId, who })`:**
  1. **Chốt chặn Bằng chứng Hình ảnh:** Nếu `hasPhoto !== true`, hệ thống từ chối lưu và yêu cầu chụp ảnh thực tế tại Kiosk Bếp.
  2. **Nếu báo hỏng Nguyên liệu bếp (`targetType === 'bag'`):**
     - Cộng số lượng hỏng vào `D().stock[bagId].waste += qty`.
     - Tính giá trị tổn thất: $\text{lossCost} = \text{qty} \times \text{bag.cost}$.
     - Tự động giảm ngay số phần món ăn có sử dụng nguyên liệu đó trong công thức BOM (`E.menuAvailability`).
  3. **Nếu báo hỏng Hải sản bể (`targetType === 'seafood'`):**
     - Nếu chọn đích danh con cá bị ngộp (`fishId`, ví dụ `#CM-02`), con cá đó được đánh dấu `status = 'dead'` và rút khỏi bể bơi.
     - Cộng khối lượng vào `D().tank[menuId].wasteKg += kg`, tính giá trị tổn thất $\text{lossCost} = \text{kg} \times \text{costPerKg}$.
  4. Toàn bộ các phiếu báo hỏng đều xuất hiện tức thời trong bảng **Đối soát 4 lớp** và báo cáo **P&L** của Chủ quán.

---

## KHÂU 8: LOGIC CHUYỂN BÀN, GHÉP BÀN & TÁCH BILL BẢO TOÀN MÃ VIETQR

1. **Chuyển bàn (`E.transferTable(fromTableId, toTableId)`):**
   - Dùng khi khách đổi chỗ ngồi (ví dụ từ bàn ngoài trời vào trong nhà khi mưa).
   - Hệ thống chuyển `ticket.tableId = toTableId`, giữ nguyên mã thanh toán VietQR hoặc cập nhật bàn mới, chuyển trạng thái bàn cũ về `cleaning` (chờ dọn 10 phút) và bàn mới sang `occupied`.
2. **Ghép bàn (`E.mergeTables(sourceTableId, targetTableId)`):**
   - Dùng khi 2 bàn gộp chung 1 hóa đơn.
   - Toàn bộ dòng món (`items`), tiền cọc (`deposit`) và số tiền đã trả một phần (`paidAmount`) của bàn nguồn được cộng gộp sang bàn đích.
   - **Bảo toàn mã thanh toán QR (`mergedPayCodes`):** Mã `payCode` của bàn nguồn (ví dụ `QN A02 K102`) được đẩy vào mảng `targetTicket.mergedPayCodes`. Nếu khách đã quét mã QR của bàn `A02` trước khi ghép bàn và tiền mới về ngân hàng sau khi đã ghép vào `A01`, Webhook vẫn tìm thấy mã `QN A02 K102` trong `mergedPayCodes` của bàn `A01` và gạch nợ chính xác cho bàn `A01`!
3. **Tách bill (`E.splitTicket(fromTableId, toTableId, itemSelections)`):**
   - Cho phép tách một số lượng món bất kỳ từ bàn hiện tại sang một bàn trống khác để khách thanh toán riêng từng phần.

---

## KHÂU 9: LOGIC IN TẠM TÍNH TỰ KHÓA BILL & PHÂN QUYỀN DUYỆT 2 TẦNG

### 9.1. Cơ chế Tự động Khóa Bill khi In Phiếu Tạm Tính (`E.printPrebill` & `E.isTicketLocked`)
- **Lỗ hổng kinh điển của quán nhậu:** Nhân viên in phiếu tạm tính mang ra thu đủ 100% tiền mặt của khách, nhưng trước khi bấm thanh toán chốt bill trên máy, nhân viên quay lại xóa bớt 3–4 món ăn hoặc giảm số lon bia để bỏ túi riêng phần tiền chênh lệch.
- **Logic khóa cứng của hệ thống:**
  1. Ngay khi bấm **In Phiếu Tạm Tính** (`E.printPrebill`), hệ thống ghi nhận `ticket.status = 'locked'` và mốc thời gian `ticket.prebillPrintedAt = Date.now()`.
  2. Hệ thống cấp một khoảng **Ân hạn 60 giây** (`graceSecondsAfterPrebill = 60`). Trong 60 giây đầu sau khi in tạm tính, nếu phát hiện bấm nhầm vẫn có thể chỉnh sửa nhanh.
  3. Ngay khi vượt quá 60 giây (`Date.now() - prebillPrintedAt > 60000`), hàm `E.isTicketLocked(ticket)` trả về `true`: Toàn bộ các nút giảm số lượng, xóa món, áp giảm giá trên hóa đơn đó bị khóa chặt. Muốn sửa bắt buộc phải gửi yêu cầu **Mở khóa Bill (`unlock_ticket`)**.

### 9.2. Bảng Phân Quyền Duyệt 2 Tầng (Thu Ngân kiêm Quản Lý Ca vs Chủ Quán)
Để Chủ quán chỉ cần tập trung kiểm soát những vấn đề lớn, còn các nghiệp vụ phát sinh thường xuyên tại sảnh được xử lý nhanh gọn bởi **Thu ngân kiêm Quản lý ca**, hàm `E.needApproval` phân tầng tự động như sau:

| Loại Nghiệp Vụ Cần Duyệt | Tầng 1: Thu Ngân kiêm Quản Lý Ca (`#/cashier`) | Tầng 2: Chủ Quán (`#/owner`) |
| :--- | :--- | :--- |
| **1. Mở khóa Bill sau tạm tính (`unlock_ticket`)** | Mở khóa **lần thứ 1** trên hóa đơn đó (`unlockCount === 0`). | Mở khóa từ **lần thứ 2 trở đi** trên cùng 1 hóa đơn (`unlockCount >= 1`). |
| **2. Hủy món đã gửi bếp (`void_item`)** | Giá trị dòng món hủy **$\le 200.000\text{đ}$** (`voidCashierLimit`). | Giá trị dòng món hủy **$> 200.000\text{đ}$**. |
| **3. Giảm giá Bill (`discount_bill`)** | Tỷ lệ giảm giá **$\le 10\%$** (`discountCashierPct`). | Tỷ lệ giảm giá **$> 10\%$** (tối đa $\le 20\%$). |
| **4. Ép giá Hải sản nguyên con (`seafood_bargain`)** | Mức giảm từ **trên $8\%$ đến $\le 15\%$** (Từ $\le 8\%$ Phục vụ tự chốt). | Mức giảm sâu **$> 15\%$** (và luôn phải $\ge$ Giá vốn). |
| **5. Chênh lệch Kiểm kho cuối ca (`stock_variance`)** | Không được tự duyệt lệch kho. | Chủ quán xét duyệt 100% các khoản lệch kho cuối ca. |

- **Cơ chế Bồi hoàn tự động (`Compensation`) khi duyệt hủy món:**
  - Nếu yêu cầu hủy một dòng món hải sản (nguyên con hoặc cắt lẻ theo gram) được phê duyệt trước khi chế biến, hàm `E.restoreSeafoodToTank(item)` tự động khôi phục con cá nguyên con về lại bể bơi hoặc cộng hoàn trả đúng số gram vừa cắt vào lại con cá đang xẻ dở!

---

## KHÂU 10: LOGIC THANH TOÁN NHANH TẠI BÀN BẰNG VIETQR ĐỊNH DANH, WEBHOOK BIẾN ĐỘNG SỐ DƯ & CHIA TIP

### 10.1. Sinh Mã VietQR Định Danh Riêng Cho Từng Bàn (`E.ensurePayCode` & `E.getVietQRInfo`)
- Mỗi hóa đơn (`ticket`) ngay khi khởi tạo được hàm `E.ensurePayCode(ticket)` cấp một mã định danh chuyển khoản duy nhất:
  $$\text{payCode} = \text{``QN ''} + \text{MãBànViếtLiền} + \text{`` ''} + \text{4KýTựCuốiTicketId}$$
  - Ví dụ: Bàn `A01` có `ticket.id = 'tk_101'` -> `payCode = "QN A01 K101"`.
  - Phòng `VIP 1` có `ticket.id = 'tk_v1'` -> `payCode = "QN VIP1 TKV1"`.
- Khi Phục vụ ấn nút **"Thanh toán nhanh tại bàn"** trên điện thoại (`#/waiter`) hoặc Thu ngân mở modal thanh toán (`#/cashier`), hàm `E.getVietQRInfo(tableId)` tạo URL VietQR động chuẩn Napas247:
  - Ngân hàng: `bankBin` (VD: `970436` - Vietcombank), Số TK: `bankAccount`.
  - Số tiền (`amount`): Điền sẵn số tiền còn phải thu (`remaining = grand - paidAmount`).
  - Nội dung chuyển khoản (`addInfo`): Điền sẵn `QN A01 K101`.
- Khách hàng chỉ cần mở App Ngân hàng quét mã QR ngay trên màn hình điện thoại của Phục vụ (hoặc trên tờ phiếu tạm tính), không cần sửa nội dung chuyển khoản. Nếu khách muốn thưởng thêm **Tiền Tip** cho nhân viên, khách chỉ cần sửa số tiền chuyển cao hơn số tiền cần thu (ví dụ bill `850.000đ`, khách chuyển chẵn `900.000đ`).

### 10.2. Xử lý Webhook Biến Động Số Dư Tự Động (`POST /api/webhooks/payment` -> `E.processPaymentWebhook`)
Khi ngân hàng báo biến động số dư qua cổng thanh toán (SePay / Casso / Cổng VietQR), cổng thanh toán gọi API `POST /api/webhooks/payment` gửi kèm `content` (nội dung CK), `transferAmount` (số tiền nhận được), `referenceCode` (mã giao dịch ngân hàng). Hệ thống thực hiện tuần tự 5 bước:

1. **Bước 1 — Chống xử lý trùng (`Idempotency`):**
   - Kiểm tra `referenceCode` trong lịch sử giao dịch. Nếu mã giao dịch này đã được xử lý trước đó, trả về kết quả `duplicate: true` và không cộng tiền 2 lần.
2. **Bước 2 — Nhận diện Bàn từ Nội dung chuyển khoản:**
   - Chuẩn hóa chuỗi `content` (bỏ dấu, viết hoa) và đối chiếu với `ticket.payCode` cũng như mảng `ticket.mergedPayCodes` (của các bàn đã ghép).
3. **Bước 3 — Xử lý trường hợp Tiền về muộn sau khi Bill đã đóng (`Overpayment`):**
   - Nếu mã `payCode` không còn nằm ở bàn đang mở mà nằm trong danh sách hóa đơn đã đóng (`D().sales`), nghĩa là khách chuyển khoản trùng 2 lần hoặc tiền về muộn sau khi đã thu tiền mặt:
   - Hệ thống tự động tạo bản ghi trong `D().overpayments` và phát cảnh báo đỏ trên màn hình Thu ngân. Thu ngân chỉ cần bấm 1 nút để chọn: **"Ghi nhận toàn bộ thành Tiền Tip"** hoặc **"Đã rút két hoàn tiền mặt cho khách"** (`E.resolveOverpayment`).
4. **Bước 4 — Xử lý trường hợp Chuyển khoản thiếu / Thanh toán từng phần ($\text{transferAmount} < \text{remaining}$):**
   - Cộng số tiền vừa nhận vào `ticket.paidAmount += transferAmount`.
   - Lưu giao dịch vào `ticket.payments`.
   - Giữ bàn ở trạng thái mở và cập nhật số tiền **Còn phải thu (`remaining`)** mới để khách quét tiếp hoặc trả phần còn lại bằng tiền mặt.
5. **Bước 5 — Xử lý trường hợp Chuyển đủ hoặc Chuyển vượt mức có Tiền Tip ($\text{transferAmount} \ge \text{remaining}$):**
   - **Tự động tách Tiền Tip:**
     $$\text{tipAmount} = \max(0,\; \text{transferAmount} - \text{remaining})$$
   - **Tự động phân bổ Tiền Tip theo cấu hình của quán (`Store.config.payment.tipRule`):**
     - Nếu `tipRule === 'assigned'` (**Nhân viên quản bàn hưởng 100%**): Toàn bộ `tipAmount` được ghi nhận trực tiếp cho nhân viên phụ trách bàn đó (`ticket.waiterId`).
     - Nếu `tipRule === 'equal_shift'` (**Chia đều toàn ca**): Khoản `tipAmount` được đánh dấu `tipRecipientMode = 'equal_shift'` và tự động chia đều cho tất cả nhân viên phục vụ có mặt trong ca vào bảng lương.
   - **Tự động đóng Bill & Báo thành công tức thời:**
     - Gọi `E.checkout` chốt hóa đơn sang `paid`, giải phóng bàn sang trạng thái chờ dọn (`cleaning`), và phát sóng sự kiện SSE `payment_webhook_matched`.
     - Ngay lập tức, màn hình điện thoại của Phục vụ đang đứng tại bàn hiện hộp thoại xanh **"ĐÃ NHẬN ĐỦ TIỀN QUA QR + TIỀN TIP"** — nhân viên phục vụ không cần chụp ảnh màn hình điện thoại của khách gửi vào nhóm Zalo và Thu ngân không cần mở điện thoại dò sao kê!

---

## KHÂU 11: LOGIC TÁCH THUẾ GTGT (8% & 10%), ĐỐI SOÁT 4 LỚP & KHÓA SỔ Z-REPORT

### 11.1. Công thức Tính Tổng Hóa Đơn & Tách Thuế GTGT 2 Nhóm (`E.totals`)
Theo quy định thuế hiện hành đối với ngành dịch vụ ăn uống (F&B):
- **Nhóm Đồ ăn, Hải sản tươi sống, Nước ngọt (`vatGroup = 'food'`):** Thuế suất GTGT **$8\%$**.
- **Nhóm Bia, Rượu (`vatGroup = 'alcohol'`):** Thuế suất GTGT **$10\%$**.

Cho một hóa đơn có tổng tiền món nhóm Đồ ăn là $S_{\text{food}}$, tổng tiền nhóm Bia rượu là $S_{\text{alcohol}}$, phụ thu phòng VIP là $S_{\text{vip}}$, và tỷ lệ giảm giá là $d\%$ (`discountPct`):
1. **Tổng tiền hàng cộng phụ thu VIP:**
   $$S_{\text{raw}} = S_{\text{food}} + S_{\text{alcohol}} + S_{\text{vip}}$$
2. **Số tiền giảm giá:**
   $$D = \text{round}\left(S_{\text{raw}} \times \frac{d}{100}\right)$$
3. **Doanh thu tính thuế sau giảm giá (phân bổ theo tỷ trọng):**
   $$B_{\text{food}} = (S_{\text{food}} + S_{\text{vip}}) \times \left(1 - \frac{d}{100}\right), \qquad B_{\text{alcohol}} = S_{\text{alcohol}} \times \left(1 - \frac{d}{100}\right)$$
4. **Tiền thuế GTGT tách riêng từng nhóm:**
   $$\text{VAT}_{8\%} = \text{round}(B_{\text{food}} \times 8\%), \qquad \text{VAT}_{10\%} = \text{round}(B_{\text{alcohol}} \times 10\%)$$
5. **Tổng thanh toán (`grand`) và Số tiền còn phải thu sau khi trừ cọc (`remaining`):**
   $$\text{grand} = (S_{\text{raw}} - D) + \text{VAT}_{8\%} + \text{VAT}_{10\%}$$
   $$\text{remaining} = \max\big(0,\; \text{grand} - \text{deposit} - \text{paidAmount}\big)$$

### 11.2. Công thức Đối Soát Kho 4 Lớp Cuối Ca (`E.reconciliation`)
Cuối ca, hệ thống chạy đối soát 4 lớp trên toàn bộ **16 mã nguyên liệu bếp**, **5 loài hải sản bể** và **3 hãng bia**:
$$\text{Lý thuyết (expected)} = \text{Đầu ca (open)} + \text{Nhập trong ca (in)} - \text{Đã bán (sold)} - \text{Báo hỏng có ảnh (waste)}$$
$$\text{Chênh lệch (diff)} = \text{Thực đếm cuối ca (actual)} - \text{Lý thuyết (expected)}$$
$$\text{Giá trị lệch (diffCost)} = \text{diff} \times \text{Giá vốn đơn vị (cost)}$$
- Nếu $\text{diff} = 0$: Kho khớp 100%.
- Nếu $\text{diff} < 0$: Phát sinh thất thoát chưa rõ nguyên nhân -> Tự động đẩy yêu cầu giải trình/duyệt lệch kho lên Chủ quán.

### 11.3. Đối Chiếu Két Tiền Mặt Theo Mệnh Giá & Khóa Sổ Z-Report (`E.cashSummary` & `E.closeShift`)
- **Công thức tính Tiền mặt Lý thuyết trong ngăn kéo (`expectedCash`):**
  $$\text{expectedCash} = \text{Quỹ đầu ca} + \text{Thu tiền mặt từ Bill} + \text{Thu cọc tiền mặt} - \text{Chi tiền vặt (Petty Cash)} - \text{Chi ứng lương} - \text{Chi trả Tip tiền mặt}$$
- Khi chốt ca Z-Report, Thu ngân nhập số tờ thực đếm của 9 mệnh giá (`500.000đ` đến `1.000đ`). Hệ thống tự nhân tổng tiền thực đếm `countedCash`:
  - Nếu $|\text{countedCash} - \text{expectedCash}| > 1.000\text{đ}$ mà Thu ngân bỏ trống ô **Lý do giải trình**, hệ thống chặn không cho khóa sổ.
  - Khi bấm **Khóa sổ Z-Report**, ca làm việc được đóng dấu `closedAt` và lưu vĩnh viễn vào bảng `z_reports` trên PostgreSQL 16.

---

## KHÂU 12: LOGIC TỰ ĐỘNG TÍNH BẢNG LƯƠNG 10 NHÂN SỰ & BÁO CÁO LÃI LỖ (P&L)

### 12.1. Công thức Tính Bảng Lương Tự Động (`E.payroll`)
Hệ thống tự động tổng hợp dữ liệu từ bảng chấm công (`attendance`), hóa đơn đã bán (`sales`), lịch sử ứng lương (`cashLog`) và tiền Tip QR để tính lương thời gian thực cho từng nhân viên trong 10 nhân sự của quán:
1. **Lương giờ cơ bản (`basePay`):** $\text{Số giờ làm} \times \text{Lương giờ cơ bản (`hourlyRate`)}$.
2. **Phụ cấp Tăng ca (`overtimePay`):** Phần giờ vượt trên 8 tiếng/ca được nhân hệ số $1.5\times$ (`overtimeRate = 1.5`).
3. **Phụ cấp Ca đêm (`nightPay`):** Các ca làm việc sau 22:00 đêm được cộng thêm $+30\%$ (`nightAllowancePct = 30`).
4. **Thưởng Gợi ý món lời cao (`upsellBonus`):** Khi Phục vụ bán được các món có cấu hình thưởng Upsell (như Cá mú $+20.000\text{đ/kg}$, Tôm hùm $+50.000\text{đ/kg}$, Lẩu Thái $+15.000\text{đ/nồi}$).
5. **Hoa hồng Tiếp thị Bia PG (`pgCommission`):** Tính theo tổng số thùng bia (24 lon/thùng) hãng đó đã bán thực tế trong ca nhân với định mức hoa hồng/thùng (`commissionPerCase = 8.000đ/thùng`).
6. **Tiền Tip Chuyển khoản QR (`tipShare`):**
   - Cộng toàn bộ các khoản Tip từ hóa đơn có `tipRecipientMode === 'assigned'` mà nhân viên đó phụ trách bàn.
   - Cộng phần chia đều từ các hóa đơn có `tipRecipientMode === 'equal_shift'`.
7. **Các khoản giảm trừ:**
   - Phạt đi trễ (`latePenalty`): Nếu chấm công vào ca trễ quá `graceMinutes = 10` phút -> trừ `50.000đ/lần`.
   - Đền bù làm vỡ đồ / lệch kho (`breakage`).
   - Tiền đã ứng lương trong kỳ (`advance`).
8. **Thực lĩnh (`netPay`):**
   $$\text{netPay} = \text{basePay} + \text{overtimePay} + \text{nightPay} + \text{upsellBonus} + \text{pgCommission} + \text{tipShare} - \text{latePenalty} - \text{breakage} - \text{advance}$$

### 12.2. Công thức Báo Cáo Lãi Lỗ P&L Thời Gian Thực (`E.pnl`)
Trên cổng Chủ quán (`#/owner`), hàm `E.pnl()` bóc tách toàn bộ bức tranh tài chính của quán:
1. **Doanh thu gộp (`grossSales`):** Tổng tiền món ăn + hải sản + đồ uống + phụ thu phòng VIP trước giảm giá.
2. **Doanh thu thuần (`netSales`):** $\text{grossSales} - \text{Tổng giảm giá (`discounts`)}$ (không bao gồm thuế GTGT thu hộ nhà nước và không trộn lẫn tiền Tip của nhân viên).
3. **Giá vốn hàng bán (`COGS`):**
   $$\text{COGS} = \text{Giá vốn Món bếp theo BOM} + \text{Giá vốn Hải sản thực xuất} + \text{Giá vốn Bia & Đồ uống}$$
4. **Lợi nhuận gộp (`grossProfit`) & Biên lãi gộp (`grossMargin`):**
   $$\text{grossProfit} = \text{netSales} - \text{COGS}, \qquad \text{grossMargin} = \frac{\text{grossProfit}}{\text{netSales}} \times 100\%$$
5. **Chi phí vận hành trong ngày (`operatingExpenses`):**
   - Chi phí cố định phân bổ theo ngày ($\frac{\text{Thuê mặt bằng} + \text{Điện nước} + \text{Phần mềm} + \text{Khấu hao}}{30}$).
   - Chi phí quỹ lương nhân sự trong ca (`laborCost`).
   - Giá trị nguyên liệu hỏng / cá ngộp đã báo hỏng (`wasteLoss`).
   - Chi phí tiền vặt mua đá, gas, gia vị phát sinh tại quầy (`pettyCash`).
6. **Lợi nhuận ròng bỏ túi Chủ quán (`netProfit`):**
   $$\text{netProfit} = \text{grossProfit} - \big(\text{Chi phí cố định ngày} + \text{laborCost} + \text{wasteLoss} + \text{pettyCash}\big)$$

---

## PHỤ LỤC: CẤU TRÚC THƯCC MỤC & CÁC TỆP TÀI LIỆU TRONG DỰ ÁN

- **Mã nguồn Giao diện & Logic Nghiệp vụ (`C:\quan_nhau\web\`):**
  - `web/index.html`, `web/styles.css`: Khung giao diện SPA & Hệ thống thiết kế UI.
  - `web/js/core/store.js`: Kho dữ liệu cấu hình & trạng thái trung tâm.
  - `web/js/core/engine.js`: Toàn bộ các hàm logic nghiệp vụ A–Z (`Engine`).
  - `web/js/core/api.js`: Cầu nối đồng bộ REST API & Real-time SSE.
  - `web/js/portals/customer.js`, `waiter.js`, `pg.js`, `kiosk.js`, `cashier.js`, `owner.js`: 6 cổng giao diện theo vai trò.
- **Mã nguồn Backend & Cơ sở dữ liệu (`C:\quan_nhau\backend\`):**
  - `backend/server.py`: Máy chủ FastAPI, các endpoint REST API, Webhook thanh toán `/api/webhooks/payment` và kênh SSE `/api/events`.
  - `backend/db.py`: Tầng kết nối và ánh xạ 38 bảng quan hệ trên PostgreSQL 16.
- **Bộ Sơ đồ Quy trình BPMN 2.0 (`C:\quan_nhau\`):**
  - `He_Thong_Quan_Nhau_BPMN_Toan_Tap.drawio`: File tổng hợp 10 Tab (5 sơ đồ `AS-IS` trước khi lên hệ thống + 5 sơ đồ `TO-BE` sau khi lên hệ thống).
  - `bpmn_drawio_as_is\`: 5 file `.drawio` quy trình thủ công trước khi lên hệ thống.
  - `bpmn_drawio\`: 5 file `.drawio` quy trình tự động hóa sau khi lên hệ thống.
