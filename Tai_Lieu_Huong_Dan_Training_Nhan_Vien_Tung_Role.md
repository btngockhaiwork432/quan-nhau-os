# TÀI LIỆU HƯỚNG DẪN TRAINING NHÂN VIÊN QUÁN THEO TỪNG ROLE & MA TRẬN TÁC ĐỘNG LIÊN PHÒNG BAN (A–Z)

**Hệ thống triển khai chính thức:** Quán Nhậu OS (`https://munbao.com`)  
**Đối tượng sử dụng tài liệu:** Đội ngũ Triển khai / Giảng viên đi đào tạo trực tiếp tại quán & Quản lý vận hành quán  
**Mục tiêu đào tạo:** Cầm tay chỉ việc từng bước thao tác cho tất cả các vị trí trong quán, đồng thời giúp từng nhân sự hiểu rõ **"Một cú bấm ở vị trí của mình sẽ lập tức tác động đến màn hình, máy in, tồn kho, két tiền và bảng lương của các bộ phận khác như thế nào"**.

---

## CHƯƠNG 1: CẨM NANG DÀNH CHO TEAM ĐI TRAINING TẠI QUÁN (TRAINER'S PLAYBOOK)

### 1.1. Bức tranh tổng thể Hệ sinh thái 6 Cổng Giao diện & Nguyên lý Đồng bộ Tức thời

Toàn bộ hệ thống tại `https://munbao.com` hoạt động theo cơ chế **Đồng bộ Thời gian thực (Real-time SSE `< 50ms`)** trên cơ sở dữ liệu trung tâm **PostgreSQL 16** kết hợp **Cầu nối Máy in nhiệt LAN ESC/POS (`< 1,5 giây`)**.

> **[NGUYÊN LÝ CỐT LÕI CẦN NHẤN MẠNH VỚI NHÂN VIÊN QUÁN NGAY ĐẦU BUỔI HỌC]**  
> Trên hệ thống này, **không có bộ phận nào làm việc tách rời và không có thao tác nào sửa xóa ngầm được**:
> - Phục vụ vừa bấm **Gửi bếp** trên điện thoại ngoài sân -> **1,5 giây sau** máy in dưới Bếp tự kêu *Bíp* và nhả phiếu chế biến (đầu bếp không cần bấm nút in), kho bếp tự trừ nguyên liệu, quầy Thu ngân tự nhả phiếu xuất bia và cập nhật tiền bàn ngay lập tức.
> - Thu ngân vừa bấm **In tạm tính** -> sau 60 giây hóa đơn tự động **Khóa cứng**, chặn tuyệt đối việc xóa món ngầm sau khi thu tiền khách.
> - Khách hàng vừa quét mã **VietQR** chuyển khoản xong -> cổng Webhook (SePay/Casso/PayOS) tự động bắt biến động số dư, nổ thông báo xanh trên cả điện thoại Phục vụ lẫn Laptop Thu ngân, tự đóng bàn, tự in hóa đơn K80 và tự động bóc tách phần tiền khách chuyển dư vào **Quỹ Tiền Tip** của nhân viên.

---

### 1.2. Bảng Tổng hợp 7 Đường dẫn Truy cập, Thiết bị & Mã PIN Mặc định Theo Từng Role

Khi nhân viên mở địa chỉ duy nhất **`https://munbao.com/login`** và nhập **Mã PIN 4 số cá nhân**, hệ thống tự động nhận diện chức vụ và mở đúng giao diện của người đó (nhân viên không thể vào nhầm trang của bộ phận khác).

| STT | Role (Vị trí tại quán) | Đường dẫn trực tiếp | Thiết bị sử dụng thực tế | Mã PIN bàn giao mặc định | Phạm vi công việc cốt lõi |
| :-: | :--- | :--- | :--- | :---: | :--- |
| **1** | **Nhân viên Phục vụ bàn** | `https://munbao.com/waiter` | Điện thoại cá nhân (màn hình dọc) | `4444`, `4445`, `4446`, `4447` | Chấm công GPS/Selfie, mở bàn, gọi món/hải sản/bia thùng, trả bia dư, gửi rượu, thu tiền VietQR tại bàn *(không cần bấm nút bưng món)*. |
| **2** | **Tiếp thị Bia (PG Bia)** | `https://munbao.com/pg` | Điện thoại cá nhân của PG | `5555` | Xuất bia thùng/lẻ cho các bàn đang ngồi, áp khuyến mãi Mua X Tặng Y của hãng, trả bia dư, bàn giao nắp lon cuối ca. |
| **3** | **Phụ trách Hồ Hải sản** | `https://munbao.com/kiosk` | Điện thoại cá nhân (chỉ mở khi nhập/báo hỏng/kiểm kho) | `6666` | Đầu ca nhập cá sống cấp mã từng con (`#CM-01`); trong ca nếu cá ngộp thì chụp ảnh báo hỏng; cuối ca kiểm kho mù. |
| **4** | **Bếp trưởng / Đầu bếp** | **Máy in LAN Bếp** (+ `/kiosk` đầu/cuối ca) | **Chỉ nhận giấy từ Máy in K80 lúc nấu** (+ Điện thoại lúc kiểm kho) | `7777` | Trong giờ bán **chỉ xé phiếu tự động in tại Bếp để nấu và gọi miệng Phục vụ ra bưng (KHÔNG cần bấm hoàn thành món)**; chỉ mở `/kiosk` khi báo hỏng có ảnh & kiểm kho mù cuối ca. |
| **5** | **Tạp vụ / Hỗ trợ bếp** | `https://munbao.com/kiosk` | Chấm công chung trên máy Kiosk/Điện thoại bếp | `8888` | Chấm công vào/ra ca bằng PIN + chụp ảnh khuôn mặt trực tiếp tại Tab 4 `/kiosk`. |
| **6** | **Thu ngân kiêm Quản lý ca** | `https://munbao.com/cashier` | **Laptop đặt tại quầy** + Máy in K80 Quầy | `3333` | Điều phối sơ đồ bàn, phân công phục vụ, chuyển/ghép/tách bàn, in tạm tính khóa bill, **Duyệt nhanh tầng 1**, thu tiền/QR, chi két vặt, đếm tiền 9 mệnh giá & chốt ca Z-Report. |
| **7** | **Chủ quán & Kế toán** | `https://munbao.com/owner` | Điện thoại / Laptop từ xa hoặc tại quán | Chủ quán: `1111`<br>Kế toán: `2222` | Xem Lãi lỗ ròng (P&L) thời gian thực, **Duyệt ngoại lệ tầng 2**, đối soát kho 4 lớp, bảng lương, sổ thuế GTGT 8%–10%, xuất CSV doanh thu/lương/thuế, cài đặt toàn bộ quán & nối cổng thanh toán. |
| **8** | **Thực khách (Khách hàng)** | `https://munbao.com/customer` | Điện thoại của khách (quét QR) | *Không cần PIN* | Đặt bàn trực tuyến & cọc VietQR, tra cứu rượu gửi & lấy mã OTP 6 số mở rượu, tự nhập MST nhận hóa đơn điện tử VAT trong 24h. |

> **[MẸO DÀNH CHO GIẢNG VIÊN KHI DẠY NHÁP]**  
> - **Cách 1 — Dạy trên môi trường Sandbox độc lập:** Thêm `?demo=1` vào cuối đường dẫn (`https://munbao.com/login?demo=1`). Thanh chuyển nhanh 6 vai trò sẽ hiện trên đỉnh màn hình để Giảng viên chiếu máy chiếu/màn hình Laptop cho cả quán xem luồng nhảy số liên phòng ban mà **không ảnh hưởng đến dữ liệu bán hàng thật**.  
> - **Cách 2 — Thực hành thật 100% với Máy in & VietQR tại quán:** Cho toàn bộ nhân viên đăng nhập `https://munbao.com/login` bấm gọi món thật, in bill Bếp thật, quét QR thật. Kết thúc buổi học, Giảng viên mở tài khoản Chủ quán (`1111`) -> bấm **`Dữ liệu hệ thống -> Khởi tạo Quán Mới (Xóa dữ liệu mẫu để bán hàng thật)`** -> toàn bộ hóa đơn tập dượt sẽ về `0`, trong khi giữ nguyên 100% sơ đồ bàn, thực đơn, nhân sự, máy in và cấu hình cổng thanh toán!

---

### 1.3. Kịch bản Tổ chức Buổi Training Thực chiến 90 Phút Cho Team Triển Khai

Để buổi đào tạo tại quán gọn gàng, nhân viên nhớ bài ngay và không bị rối, Team Training chia buổi hướng dẫn thành **4 chặng chuẩn**:

| Thời lượng | Chặng đào tạo | Người tham gia | Nội dung thực hiện của Team Training |
| :---: | :--- | :--- | :--- |
| **Phút 00 – 15** | **Chặng 1: Chuẩn bị & Phổ biến luật chơi chung** | Toàn bộ nhân sự quán | • Kiểm tra Laptop Thu ngân đã bật cầu nối máy in LAN (`CHAY_KET_NOI_MAY_IN_LAN.bat`), 2 máy in K80 đủ giấy, Wi-Fi quán ổn định.<br>• Phát mã PIN 4 số riêng cho từng nhân viên, hướng dẫn lưu biểu tượng `munbao.com/login` ra màn hình chính điện thoại (*Add to Home Screen*).<br>• Giải thích 3 quy tắc kỷ luật: **(1) Chấm công thật GPS + Selfie**, **(2) In tạm tính là khóa bill**, **(3) Mọi hủy món / báo hỏng đều lưu vết và cần ảnh chụp**. |
| **Phút 15 – 45** | **Chặng 2: Đào tạo chia nhóm theo từng Role** | Chia 3 cụm song song | • **Trainer 1 (Ngoài sảnh):** Dạy nhóm **Phục vụ + PG Bia** trên điện thoại cá nhân.<br>• **Trainer 2 (Khu Bếp & Hồ cá):** Chỉ cho **Đầu bếp** thấy máy in tự nhả phiếu (không cần bấm máy lúc nấu); dạy **Bếp trưởng + Hồ cá** 3 thao tác kho trên `/kiosk` (nhập cá đầu ca, chụp ảnh báo hỏng, kiểm kho mù cuối ca).<br>• **Trainer 3 (Quầy Thu ngân):** Dạy **Thu ngân kiêm Quản lý ca + Chủ quán/Kế toán** trên Laptop quầy. |
| **Phút 45 – 75** | **Chặng 3: Diễn tập phối hợp Liên phòng ban (Role-play)** | Cả quán đóng vai chạy thật | Chạy liên hoàn **5 kịch bản thực chiến** (xem chi tiết tại Chương 8): Mở bàn -> Gọi món & Cá sống -> Máy in Bếp tự nhả giấy (bếp nấu xong tự gọi miệng phục vụ) -> Trả bia dư -> Quét VietQR tự đóng bill & chia Tip -> Báo hỏng có ảnh -> Kiểm kho mù & Chốt ca Z-Report. |
| **Phút 75 – 90** | **Chặng 4: Giải đáp sự cố, Reset dữ liệu & Bàn giao Go-Live** | Chủ quán + Quản lý ca | • Hướng dẫn cách xử lý nhanh khi hết giấy in, mất mạng tạm thời, khách chuyển khoản nhầm.<br>• Bấm **`Khởi tạo Quán Mới`** xóa sạch hóa đơn diễn tập, bàn giao hệ thống sạch 100% để đón khách thật. |

---

### 1.4. Ma trận Tổng quan Luồng Tác Động Liên Phòng Ban (Cross-Role Impact Matrix)

Bảng dưới đây giúp Team Training nắm trọn vẹn mối liên kết nhân quả giữa các Role để giải thích rõ khi nhân viên thắc mắc:

| Hành động khởi phát (Ai bấm?) | Tác động tới Phục vụ (`/waiter`) | Tác động tới PG Bia (`/pg`) | Tác động tới Bếp & Hồ cá (`Máy in Bếp` + `/kiosk`) | Tác động tới Thu ngân (`/cashier` + Máy in Quầy) | Tác động tới Chủ quán & Kế toán (`/owner`) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Phục vụ bấm `Gửi bếp` (Món ăn + Bia thùng)** | Chuyển món sang nhãn xanh **`Đã in bếp`** / **`Đã xuất quầy`** *(không cần bấm nút bưng món)*. | Cộng sản lượng bia bàn đó; tự tính lon KM & cộng nợ nắp lon PG phải thu hồi. | **Máy in LAN Bếp tự nhả phiếu giấy trong 1,5s** *(Đầu bếp xé giấy nấu & tự gọi miệng phục vụ, không cần bấm màn hình)*; tự trừ túi nguyên liệu BOM. | **Máy in Quầy tự nhả phiếu xuất Bia/Đá**; tổng tiền bàn tăng tức thời trên sơ đồ POS. | Trừ tồn kho lý thuyết thời gian thực; tính trước giá vốn COGS dự kiến. |
| **Phục vụ gọi Hải sản sống (`#CM-01` / Cắt gram / Ép giá)** | Tự tính thành tiền ngay theo kg mã cá; tự chốt ép giá nếu giảm `<= 8%`. | *Không ảnh hưởng* | **Máy in LAN Bếp tự in phiếu kèm mã cá `#CM-01`**; rút cá khỏi bể / trừ gram phần dư chống bán trùng. | Nhận yêu cầu **Duyệt ép giá tầng 1** nếu khách xin giảm từ `> 8%` đến `<= 15%`. | Nhận yêu cầu **Duyệt ép giá tầng 2** nếu khách xin giảm `> 15%` (luôn chặn sàn giá vốn); cộng thưởng Upsell theo kg cho Phục vụ. |
| **Phục vụ / PG bấm `Trả bia dư chưa khui`** | Giảm số lon tính tiền trên bill; cảnh báo nếu đã in tạm tính cũ. | **Tự động thu hồi lon KM vượt định mức** & giảm số nắp nợ cuối ca. | *Không ảnh hưởng* | Hoàn bia về kho quầy; gắn cờ vàng `Tạm tính cũ hết hiệu lực` bắt buộc in lại. | Bảo vệ biên lợi nhuận quán (không bị lỗ bia tặng khi khách trả lại thùng). |
| **Bếp bấm `Báo hỏng nguyên liệu` (kèm chụp ảnh)** | **Tự động khóa nút gọi món (`Hết nguyên liệu`)** nếu BOM về `0`. | *Không ảnh hưởng* | Rút cá chết khỏi bể / trừ túi hỏng khỏi kho khả dụng ngay lập tức. | Hiện yêu cầu duyệt nhanh nếu giá trị hao hụt nhỏ (`< 300.000đ`). | Nhận ảnh chụp bằng chứng tại `/owner/approvals`; ghi vào cột Hao hụt của Đối soát 4 lớp & P&L. |
| **Thu ngân bấm `In tạm tính (F2)`** | Sau 60s ân hạn, màn hình bàn hiện băng đỏ **`Bill đã khóa`**, khóa nút xóa/sửa món. | Chặn trừ lùi bia trên bàn đã khóa nếu chưa mở khóa. | *Không ảnh hưởng* | Máy in Quầy nhả phiếu K80 kèm mã VietQR; khóa cứng chỉnh sửa trên POS. | Nếu mở khóa từ **lần thứ 2 trở đi**, bắt buộc Chủ quán phê duyệt trên điện thoại. |
| **Khách quét `VietQR` chuyển tiền thành công** | **Nổ hộp thoại xanh `ĐÃ NHẬN ĐỦ TIỀN`** ngay tại bàn + hiện số tiền Tip được nhận. | Chốt sản lượng bia thực thu của bàn đó vào ca PG. | *Không ảnh hưởng* | Tự gạch nợ, đóng bill, **tự in Hóa đơn K80**, chuyển bàn sang `Cần dọn`. | Cộng Doanh thu thuần, tách VAT 8%/10%, cộng Tiền Tip vào bảng lương `/owner/hr`. |
| **Bếp nộp `Kiểm kho mù` & Thu ngân `Khóa sổ Z-Report`** | Chốt doanh số Upsell và giờ công trong ca. | Đối soát xong nắp/vỏ lon khuyến mãi đã bàn giao. | Khóa phiên kiểm đếm cuối ca (không cho sửa lại số đã nộp). | Đối chiếu tiền mặt 9 mệnh giá với tiền lý thuyết; đóng ca bán hàng. | Tự động chạy **Đối soát 4 lớp**, cảnh báo đỏ mọi khoản lệch kho và chốt báo cáo Lãi lỗ ngày. |

---

## CHƯƠNG 2: HƯỚNG DẪN CHI TIẾT ROLE 1 — NHÂN VIÊN PHỤC VỤ BÀN (`/waiter`)

- **Thiết bị sử dụng:** Điện thoại thông minh cá nhân (iPhone / Android), mở bằng trình duyệt Chrome hoặc Safari.
- **Đường dẫn đăng nhập:** `https://munbao.com/login` -> Nhập mã PIN 4 số cá nhân (mặc định bàn giao: Lan `4444`, Nam `4445`, Hoa `4446`, Đức `4447`).
- **Bố cục màn hình dọc trên điện thoại:**
  - **Thanh chỉ số KPI trên cùng:** Vuốt ngang xem nhanh `Ca hôm nay`, `Bàn đang phục vụ`, `Bể cá & Kho món` (chạm vào xem từng con cá đang bơi & món sắp hết), `Thưởng và tip hôm nay`, `Lương tạm tính`.
  - **3 Tab điều hướng dưới đáy màn hình:**
    1. **`Bàn`**: Sơ đồ bàn theo khu vực, công tắc lọc `Chỉ bàn của tôi`, mở bàn, gọi món, thanh toán QR.
    2. **`Việc cần làm`**: Thông báo tức thời khi khách chuyển khoản VietQR thành công, cảnh báo bàn VIP sắp sang giờ tiếp theo và danh sách bàn khách vừa về cần dọn.
    3. **`Cá nhân`**: Chấm công vào/ra ca, xem lịch sử công, tiền Tip, thưởng Upsell và gửi yêu cầu ứng lương.

---

### Nghiệp vụ 1.1: Chấm công vào ca 3 lớp bảo mật (Wi-Fi quán + GPS + Selfie)

**Cách thao tác từng bước:**
1. Đến quán, kết nối điện thoại vào **mạng Wi-Fi của quán** (tắt 4G/5G để hệ thống xác thực đúng IP mạng quán).
2. Đăng nhập mã PIN -> Nếu chưa vào ca, chạm ngay dòng cảnh báo màu vàng **`Chấm công ngay`** trên đầu màn hình (hoặc vào tab **`Cá nhân` -> `Chấm công vào ca`**).
3. Bấm **Cho phép (Allow)** khi trình duyệt hỏi quyền truy cập **Vị trí (GPS)** và **Máy ảnh (Camera)**.
4. Đưa camera trước lên chụp rõ khuôn mặt tại quán -> Bấm **`Xác nhận vào ca`**.

> **[TÁC ĐỘNG LIÊN ROLE]**
> - **Tại `/waiter` (Phục vụ):** Gỡ bỏ thanh cảnh báo vàng, bắt đầu đếm thời gian làm việc thực tế trên ô KPI `Ca hôm nay`. Nếu trễ quá số phút ân hạn (mặc định `10 phút`), màn hình hiện rõ số phút trễ.
> - **Sang `/cashier` (Thu ngân kiêm Quản lý ca):** Tên nhân viên lập tức sáng đèn xanh trong mục **`Nhân sự ca (Đang trực)`** để Quản lý ca biết ai đã có mặt và phân công bàn.
> - **Sang `/owner/hr` (Chủ quán & Kế toán):** Lưu ảnh chụp Selfie thực tế + khoảng cách mét GPS + IP Wi-Fi vào bảng công; tự động bắt đầu tính lương giờ và tự ghi nhận phạt đi trễ (nếu vào muộn quá quy định).

---

### Nghiệp vụ 1.2: Mở bàn mới (Khách vãng lai & Khách đã đặt bàn trước)

**Cách thao tác từng bước:**
1. Tại tab **`Bàn`**, bật công tắc **`Chỉ bàn của tôi`** nếu quán phân công khu vực cố định (hoặc tắt công tắc để xem toàn bộ bàn hỗ trợ đồng nghiệp).
2. Chạm vào ô bàn đang trống (màu trắng/xám, ví dụ `A01`) -> Chọn **Số lượng khách** ngồi thực tế (VD: `6 khách`) -> Bấm **`Mở bàn`**.
3. *(Trường hợp khách báo đã đặt trước)*: Báo Thu ngân bấm nhận bàn từ danh sách `Đặt bàn trước` (để nạp tiền cọc vào bàn), hoặc mở bàn sau khi đối chiếu tên + 4 số cuối SĐT với Quản lý ca.

> **[TÁC ĐỘNG LIÊN ROLE]**
> - **Sang `/cashier` & `/pg` & máy của các `/waiter` khác:** Ô bàn `A01` lập tức đổi sang trạng thái **`Đang phục vụ`** trên tất cả thiết bị toàn quán trong `< 50ms`, tránh 2 phục vụ mở trùng hoặc xếp chồng khách.
> - **Gán quyền hưởng Tiền Tip (`waiterId`):** Người phụ trách bàn được gắn tên ở nhãn `Đứng bàn: ...` và hệ thống sinh ngay mã định danh chuyển khoản riêng cho phiên bàn đó (ví dụ: `QN A01 K101`).

---

### Nghiệp vụ 1.3: Gọi Món Ăn Bếp & Bia / Đồ Uống Nguyên Thùng (`Gửi bếp` -> Tự động in 100%)

**Cách thao tác từng bước:**
1. Đang ở trong chi tiết bàn `A01`, bấm nút lớn màu cam **`+ Thêm món`** ở góc dưới bên phải.
2. Chọn nhóm món (`Món chạy`, `Khai vị`, `Xào - Nướng`, `Lẩu`, `Bia`, `Nước - Rượu`) hoặc gõ tìm nhanh tên món:
   - **Với Món ăn bếp:** Chạm vào món để cộng số lượng; chạm vào dòng ghi chú để chọn nhanh khẩu vị (`Ít cay`, `Không hành`, `Làm nhanh cho trẻ em`...). *Lưu ý: Món nào hết túi định lượng sẽ hiện chữ `Hết nguyên liệu` và bị làm mờ không bấm được.*
   - **Với Bia đóng thùng (`Tiger`, `Heineken`, `Sài Gòn`):** Chạm vào tên bia -> Cửa sổ thông minh hiện sẵn các nút chọn nhanh **`1 thùng (24 lon)`**, **`2 thùng (48 lon)`**, **`Nửa thùng (12 lon)`**, **`Lốc 6 lon`** hoặc nhập số lon lẻ -> Bấm xác nhận.
3. Kiểm tra lại giỏ món vừa chọn -> Bấm nút **`Gửi bếp`**.

> **[TÁC ĐỘNG LIÊN ROLE — CỰC KỲ QUAN TRỌNG KHI TRAINING]**
> - **Xuống Bếp (`Máy in LAN Bếp`):**
>   - **TỰ ĐỘNG IN NGAY LẬP TỨC (1,5 giây) — BẾP KHÔNG CẦN MÀN HÌNH & KHÔNG CẦN BẤM NÚT HOÀN THÀNH:** Nhờ cầu nối chạy ngầm trên Laptop Thu ngân, **Máy in nhiệt K80 đặt trong Bếp tự kêu "Bíp bíp", in ra tờ `PHIẾU BẾP` chữ to rõ kèm ghi chú khẩu vị và tự động cắt giấy**.
>   - Đầu bếp chỉ việc xé phiếu giấy nấu món. Do quầy bếp và khu bàn khách ở ngay gần nhau, nấu xong món nào Đầu bếp đặt lên cửa bếp **tự gọi miệng Phục vụ lại bưng ra bàn** — **cả Bếp lẫn Phục vụ đều KHÔNG CẦN bấm xác nhận hoàn thành món hay đã bưng trên phần mềm!**
>   - Kho nguyên liệu bếp tự động trừ ngay số túi định lượng (BOM). Nếu vừa bán túi bò cuối cùng, món `Bò lúc lắc` lập tức tự khóa thành `Hết nguyên liệu` trên điện thoại của **tất cả Phục vụ khác** và trang `/customer`!
> - **Ra Quầy Thu ngân (`Máy in Quầy` + `/cashier`):**
>   - Các món Bia, Nước ngọt, Đá viên **tự động định tuyến in ra ở Máy in Quầy Thu ngân** để bộ phận quầy/tiếp thực lấy bia và đá mang ra bàn (không làm rác máy in của đầu bếp nấu ăn).
>   - Tổng tiền tạm tính của bàn cập nhật tức thời trên màn hình POS `/cashier`.
> - **Sang PG Bia (`/pg`):**
>   - Nếu khách gọi đủ mốc khuyến mãi hãng (VD: gọi 1 thùng 24 lon Heineken, chương trình `Mua 12 tặng 1`), hệ thống **tự động chèn thêm dòng `+2 lon Heineken [KM Hãng 0đ]`**, trừ kho 2 lon tặng và cộng `+2 nắp lon` vào danh sách nợ nắp cuối ca trên máy của **PG Bia (`/pg`)**!

---

### Nghiệp vụ 1.4: Gọi Hải Sản Tươi Sống Tại Bể (3 Chế Độ Thông Minh)

Khi dẫn khách ra bể chọn cá/tôm/cua, Phục vụ chạm vào món thuộc nhóm **`Hải sản sống`** (VD: *Cá mú đen*, *Tôm hùm bông*, *Cá chẽm*). Cửa sổ gọi hải sản mở ra **3 chế độ thực tế**:

1. **Chế độ 1 — Bắt nguyên con theo mã cân sẵn trong bể (Chuẩn & Nhanh nhất):**
   - Màn hình liệt kê từng con cá đang bơi thật trong bể kèm mã và số cân (VD: `#CM-01 · 1,36 kg`, `#CM-02 · 1,08 kg`).
   - Chạm chọn đúng mã con cá khách chỉ -> Chọn **Kiểu chế biến** (`Hấp Hồng Kông`, `Nướng muối ớt`, `Nấu lẩu`...) -> Hệ thống nhân sẵn thành tiền ngay tại chỗ -> Bấm thêm vào giỏ và **`Gửi bếp`**.
   - *(Nếu bể chưa gắn mã sẵn từng con, chọn `Bắt cân sau` -> Món sẽ mang nhãn vàng **`Chờ cân`** gửi sang Hồ cá).*
2. **Chế độ 2 — Mua lẻ / Cắt khúc theo Gram (VD khách đi 2 người mua `500g` nấu lẩu):**
   - Chuyển sang tab **`Mua theo Gram (Cắt lẻ)`** -> Chạm nút nhanh `500g` (hoặc nhập số gram, tối thiểu `200g`) -> Chọn con cá sẽ xẻ (hệ thống ưu tiên gợi ý con cá đang có nhãn **`Đang xẻ dở`**) -> Chọn kiểu chế biến -> **`Gửi bếp`**.
3. **Chế độ 3 — Khách mặc cả / trả giá trọn con (`Khách trả giá`):**
   - Bật công tắc **`Khách trả giá trọn con`** -> Nhập số tiền chẵn khách muốn chốt (VD: giá niêm yết `934.000đ`, khách trả `880.000đ`).

> **[TÁC ĐỘNG LIÊN ROLE]**
> - **Chống bán trùng trên mọi máy `/waiter` & `/kiosk`:** Ngay khi bấm gửi, con cá `#CM-01` biến mất khỏi danh sách bể bơi của các Phục vụ khác. Nếu cắt lẻ `500g` từ con cá `1,36 kg`, hệ thống tự trừ lùi còn `0,86 kg` và gắn nhãn nổi bật **`Đang xẻ dở (còn dư 860g)`** trên cả `/waiter` và `/kiosk` để cả quán ưu tiên tư vấn bán hết trong ca.
> - **Khóa chống tính tiền sót khi còn món `Chờ cân`:** Nếu bàn có hải sản trạng thái `Chờ cân`, nút **`Thanh toán`** trên cả `/waiter` và `/cashier` tự động bị khóa mờ cho tới khi Nhân viên Hồ cá (`/kiosk`) nhập số cân thực tế!
> - **Phân luồng Duyệt Ép Giá 3 Tầng tự động:**
>   - Nếu giá khách trả **thấp hơn Giá vốn nhập bể**: Hệ thống **chặn cứng đỏ ngay trên máy Phục vụ** (không cho gửi).
>   - Nếu mức giảm **`<= 8%`**: Phục vụ được chốt ngay tại bàn (`Đã duyệt`), phiếu in thẳng xuống Bếp.
>   - Nếu mức giảm từ **`> 8%` đến `<= 15%`**: Bắn yêu cầu sang màn hình **Thu ngân kiêm Quản lý ca (`/cashier` - Duyệt tầng 1)**.
>   - Nếu mức giảm sâu **`> 15%`**: Bắn thẳng thông báo lên điện thoại **Chủ quán (`/owner/approvals` - Duyệt tầng 2)**.
> - **Tự cộng Thưởng Upsell cho Phục vụ (`/owner/hr`):** Sau khi bàn thanh toán, số kg hải sản do nhân viên đó bấm gọi tự động nhân với mức thưởng (VD: Tôm hùm `+50.000đ/kg`, Cá mú `+20.000đ/kg`) cộng thẳng vào ô KPI `Thưởng và tip hôm nay` và bảng lương tháng!

---

### Nghiệp vụ 1.5: Nhận món tại cửa bếp (Tự gọi nhau, không cần bấm máy) & Trả bia dư chưa khui

**Cách thao tác từng bước:**
1. **Khi Bếp nấu xong món:** Vì khu bếp và sảnh bàn ở gần nhau, Đầu bếp đặt đĩa lên quầy ra món và gọi trực tiếp Phục vụ mang ra bàn. Trên điện thoại Phục vụ, dòng món đã mang sẵn nhãn xanh **`Đã in bếp`** ngay từ lúc gửi — **Phục vụ KHÔNG CẦN mở điện thoại bấm nút "Đã bưng"**, giúp tay rảnh hoàn toàn để bê đồ nóng nhanh nhất!
2. **Khi khách chuẩn bị tính tiền và trên bàn còn bia chưa khui trong thùng:**
   - Mở bàn -> Bấm nút **`Trả bia dư (lon/chai)`** màu cam ngay cạnh dòng bia (hoặc đầu danh sách món).
   - Chọn 1 trong 2 cách nhập cực dễ (không cần tính nhẩm):
     - **Cách A — Nhập số lon trả lại:** VD đem ra 1 thùng `24 lon`, trên bàn còn dư `7 lon` nguyên nắp -> gõ `7` -> máy tự tính khách uống `17 lon`.
     - **Cách B — Nhập số lon thực uống:** Đếm vỏ rỗng thấy khách uống `17 lon` -> gõ `17` -> máy tự tính trả kho `7 lon`.
   - Bấm **`Xác nhận trả bia dư`**.

> **[TÁC ĐỘNG LIÊN ROLE KHI TRẢ BIA DƯ]**
> - **Sang Kho & Thu ngân (`/cashier`):** Cộng hoàn trả ngay `7 lon` vào tồn kho bia tại quầy; trên hóa đơn K80 in minh bạch dòng chữ: `Heineken [Đem ra 24 · Trả dư 7 · Tính tiền 17]`. Nếu bàn đó đã lỡ in tạm tính trước đó, hệ thống bật băng cảnh báo vàng **`Phiếu tạm tính cũ đã hết hiệu lực`** trên cả `/waiter` và `/cashier` để Thu ngân in lại tờ mới!
> - **Sang PG Bia (`/pg`):** Hệ thống chạy lại công thức khuyến mãi `E.reconcilePromos` — lúc đầu 24 lon được tặng `2 lon`, nay chỉ uống 17 lon nên chỉ được tặng `1 lon` -> **tự động thu hồi 1 lon khuyến mãi dư về kho** và giảm `1 nắp nợ` cho PG Bia!

---

### Nghiệp vụ 1.6: Hủy món (Trước vs Sau gửi bếp) & Gửi rượu mạnh cho khách (`OTP`)

1. **Hủy món khi khách đổi ý:**
   - **Chưa bấm `Gửi bếp`:** Chạm dấu trừ `-` xóa thoải mái trong giỏ hàng.
   - **Đã bấm `Gửi bếp`:** Bấm vào nút **`Khác` -> `Yêu cầu hủy món`** -> Chọn món cần hủy và chọn lý do (`Khách đổi ý`, `Bếp báo trễ`...). Phục vụ **không thể tự xóa**; dòng món chuyển sang nhãn đỏ `Chờ duyệt hủy`.
2. **Gửi rượu mạnh uống dở / Mở rượu gửi:**
   - Bấm **`Khác` -> `Tạo phiếu gửi rượu`** -> Nhập Tên khách, SĐT khách, Tên chai rượu (VD: *Chivas 18*), ước lượng **`% rượu còn lại`** (VD: `60%`) -> Lưu thẻ rượu.
   - Khi khách quay lại lần sau: Khách đọc mã **OTP 6 số** lấy trên `/customer` -> Phục vụ/Thu ngân nhập mã OTP vào mục **`Mở rượu gửi`** để xác thực đưa rượu ra bàn.

> **[TÁC ĐỘNG LIÊN ROLE]**
> - **Yêu cầu hủy món:** Nếu giá trị món `<= 200.000đ`, bắn sang **Thu ngân (`/cashier`)** duyệt nhanh; nếu `> 200.000đ`, bắn lên **Chủ quán (`/owner/approvals`)**. Ngay khi được duyệt hủy (trước khi chế biến), hệ thống tự động hoàn trả túi nguyên liệu về kho hoặc thả con cá nguyên con quay lại bể bơi!
> - **Thẻ rượu gửi:** Đồng bộ ngay sang cổng **Thực khách (`/customer`)**. Nhân viên không có mã OTP 6 số từ điện thoại của chính chủ SĐT sẽ **không thể xuất chai rượu khỏi kho**, chống thất thoát rượu ngoại đắt tiền.

---

### Nghiệp vụ 1.7: Yêu cầu Tạm tính, Thanh toán VietQR nhanh tại bàn & Ra ca bàn giao bàn

**Cách thao tác từng bước:**
1. **Cách 1 — Nhờ Thu ngân in tờ Tạm tính giấy K80:** Bấm **`Khác` -> `Báo in tạm tính`** -> Thu ngân nhận tín hiệu in tờ giấy K80 đưa Phục vụ cầm ra bàn.
2. **Cách 2 — Khách quét mã VietQR thanh toán ngay trên điện thoại Phục vụ (Siêu tốc):**
   - Bấm nút màu xanh lá **`Thanh toán`** ngay dưới đáy màn hình bàn.
   - Đưa màn hình mã **VietQR định danh của bàn** (VD nội dung tự điền sẵn `QN A01 K101`, ô số tiền mở tự do hoặc điền sẵn tùy cấu hình quán) cho khách mở App Ngân hàng quét.
   - Dặn nhẹ khách: *"Nội dung chuyển khoản máy đã điền sẵn mã bàn mình, anh/chị giữ nguyên nội dung và nhập số tiền thanh toán giúp em ạ (nếu anh/chị thương cho thêm tiền Tip thì cứ gõ gộp luôn vào tổng tiền chuyển ạ)"*.
3. **Cuối ca làm việc — Chấm công ra ca:**
   - Vào tab **`Cá nhân` -> `Chấm công ra ca`**.

> **[TÁC ĐỘNG LIÊN ROLE]**
> - **Khi khách chuyển khoản VietQR xong (Cổng SePay/Casso/PayOS hoạt động):**
>   - Chỉ sau **1 – 2 giây**, **KHÔNG CẦN** chụp màn hình giao dịch của khách gửi lên nhóm Zalo, **KHÔNG CẦN** gọi bộ đàm hỏi Thu ngân tiền về chưa:
>   - Màn hình điện thoại **Phục vụ (`/waiter`)** tự động bật hộp thoại tích xanh lớn: **`ĐÃ NHẬN ĐỦ TIỀN QUA QR`** kèm số tiền Tip khách thưởng thêm!
>   - Màn hình **Thu ngân (`/cashier`)** đồng thời nổ chuông báo xanh, tự đóng bill, **Máy in Quầy tự nhả Hóa đơn thanh toán K80**, và ô bàn tự chuyển sang màu vàng nhạt **`Cần dọn`** (đếm ngược 10 phút dọn bàn).
>   - Phần tiền khách chuyển dư cao hơn tiền bill tự động chảy thẳng vào **Quỹ Tiền Tip** (nhân viên đứng bàn hưởng 100% hoặc chia đều cả ca theo quy chế Chủ quán chọn) trên bảng lương `/owner/hr`!
> - **Khi Phục vụ bấm `Chấm công ra ca` mà vẫn còn bàn đang ngồi ăn dở:**
>   - Hệ thống **tự động bàn giao quyền phụ trách các bàn đang mở đó sang đồng nghiệp phục vụ khác đang còn trong ca** (ghi nhận lịch sử `handoverHistory`), đảm bảo không bàn nào bị "bỏ rơi" không người chăm sóc!

---

## CHƯƠNG 3: HƯỚNG DẪN CHI TIẾT ROLE 2 — TIẾP THỊ BIA / PG BIA (`/pg`)

- **Thiết bị & Đăng nhập:** Điện thoại cá nhân của nhân viên PG -> Mở `https://munbao.com/login` -> Nhập mã PIN PG (mặc định: `5555`).
- **Quy tắc phân quyền riêng của PG:** PG **không mở bàn mới**, không sửa xóa món ăn bếp và không thu tiền bill; PG chỉ thao tác trên các bàn đã mở với đúng các dòng **Bia thuộc hãng mình phụ trách** (`Tiger`, `Heineken`, `Sài Gòn`...) và nước ngọt/đá (nếu Chủ quán bật cho phép).
- **3 Tab điều hướng dưới đáy:** `Bàn` | `Quỹ khuyến mãi (Trả nắp cuối ca)` | `Cá nhân`.

### Các nghiệp vụ cốt lõi của PG Bia & Tác động Liên Role

1. **Đầu ca — Chấm công GPS & Theo dõi chỉ tiêu thùng (`Tab Cá nhân`):**
   - Chấm công vào ca tương tự Phục vụ. Thanh KPI trên đầu màn hình hiện rõ **Sản lượng ca hiện tại** (VD: `4,5 / 10 thùng` — tiến độ `%` đạt chỉ tiêu) và tiền hoa hồng tạm tính theo thùng.
2. **Trong ca — Châm bia thêm vào bàn & Tặng bia khuyến mãi hãng (`Tab Bàn`):**
   - Chạm vào bàn khách đang ngồi -> Chọn loại bia khách uống (VD: `+1 thùng 24 lon Tiger Bạc` hoặc `+6 lon`).
   - Ngay trên màn hình giỏ hàng, hệ thống **tự động tính trước số lon được tặng miễn phí** theo chương trình `Mua X Tặng Y` (VD: Mua 10 lon Tiger tặng 1 lon -> xuất 24 lon hệ thống báo tự tặng thêm `+2 lon KM`) đồng thời kiểm tra **Hạn mức quỹ khuyến mãi còn lại của hãng** -> Bấm **`Xác nhận xuất bia`**.
3. **Khách uống không hết thùng — Bấm `Trả bia dư`:**
   - Tương tự Phục vụ, PG bấm **`Trả bia dư`**, nhập số lon còn nguyên nắp mang về quầy -> Hệ thống tự trừ tiền bill cho khách và tự thu hồi lại số lon tặng vượt định mức.
4. **Cuối ca — Đối soát & Bàn giao nắp/vỏ lon khuyến mãi (`Tab Quỹ khuyến mãi`):**
   - Cuối buổi tối, PG gom toàn bộ nắp bật / vỏ lon của các lon bia đã xuất tặng `0đ` trong ca mang lại quầy Thu ngân.
   - Mở tab **`Quỹ khuyến mãi`** -> Màn hình hiện rõ từng loại bia: **`Cần nộp: X nắp` | `Đã nộp: Y nắp` | `Còn thiếu: Z nắp`**.
   - Nhập số nắp thực tế bàn giao cho Thu ngân + số két vỏ -> Bấm **`Xác nhận bàn giao nắp`**.

> **[TÁC ĐỘNG LIÊN ROLE CỦA PG BIA]**
> - **Sang Phục vụ (`/waiter`) & Thu ngân (`/cashier`):** Mọi lon bia PG bấm xuất hoặc bấm trả dư đều cập nhật ngay lập tức vào hóa đơn bàn đó trên máy Phục vụ và máy POS Thu ngân; đồng thời **Máy in Quầy Thu ngân** tự nhả phiếu xuất bia để thủ kho/quầy giao bia.
> - **Sang Kết ca Thu ngân (`/cashier`):** Khi Thu ngân bấm Kết ca cuối ngày, hệ thống hiện đối chiếu số nắp lon PG đã trả với số lon tặng trên toàn bộ hóa đơn hôm đó — nếu PG thiếu nắp sẽ cảnh báo ngay lập tức!
> - **Sang Chủ quán (`/owner/rebate` & `/owner/hr`):** Sản lượng từng thùng bia bán ra tự động cộng dồn vào thanh tiến độ **Thưởng doanh số hãng (Rebate Tháng/Quý)** của Chủ quán và tự nhân **Hoa hồng theo thùng** (VD: `8.000đ/thùng`) vào phiếu lương của PG.

---

## CHƯƠNG 4: HƯỚNG DẪN CHI TIẾT ROLE 3 — BỘ PHẬN BẾP & PHỤ TRÁCH HỒ HẢI SẢN (MÁY IN LAN TỰ ĐỘNG & `/kiosk`)

- **Nguyên tắc vận hành thực tế cực gọn tại Bếp (Cần nói rõ ngay cho Đầu bếp yên tâm):**
  - **Trong suốt giờ nấu ăn cao điểm: Đầu bếp KHÔNG CẦN màn hình cảm ứng, KHÔNG CẦN cầm điện thoại và TUYỆT ĐỐI KHÔNG CẦN bấm nút "Hoàn thành món"!**
  - Trong Bếp chỉ đặt **01 Máy in nhiệt K80 cắm dây mạng LAN**. Hễ Phục vụ ngoài bàn bấm gửi món là **1,5 giây sau máy in tự nhả giấy**. Đầu bếp nhìn giấy nấu, nấu xong đặt lên cửa bếp **gọi miệng trực tiếp cho Phục vụ lại bưng** (do khoảng cách bếp và sảnh sát nhau, gọi nhau trực tiếp nhanh hơn bấm máy gấp nhiều lần).
  - **Trang web `https://munbao.com/kiosk` trên điện thoại cá nhân của Bếp trưởng (`PIN 7777`) và Phụ trách Hồ cá (`PIN 6666`) CHỈ MỞ LÊN VÀO 3 THỜI ĐIỂM QUẢN LÝ KHO:**
    1. **Đầu ca (`Tab Nhập / Kiểm kho`):** Nhập hàng mới & cân cá sống nhập bể cấp mã từng con (`#CM-01`).
    2. **Khi có sự cố hao hụt trong ca (`Tab Báo hỏng nguyên liệu` & `Tab Bể cá & Tồn bếp`):** Chụp ảnh báo cá chết / nguyên liệu hỏng để trừ kho hợp lệ, hoặc bấm `In lại phiếu` nếu tờ bill giấy lỡ bị ướt nước/rách.
    3. **Cuối ca (`Tab Nhập / Kiểm kho` & `Tab Chấm công`):** Nhập số đếm **Kiểm kho mù** cuối ngày; nhân viên Tạp vụ (`PIN 8888`) dùng chung Tab 4 để chấm công.

---

### Nghiệp vụ 3.1: Nhận phiếu giấy tự động tại Máy in LAN Bếp & Phối hợp ra món (`Không cần bấm máy`)

**Cách vận hành thực tế:**
1. **Khi Phục vụ bấm `Gửi bếp`:** Trong vòng **1,5 giây**, Máy in nhiệt K80 trong Bếp **tự động kêu Bíp, in tờ `PHIẾU BẾP` chữ to rõ** (tên bàn, tên món, số lượng, mã con cá `#CM-01` hoặc số gram cắt lẻ, kiểu chế biến, ghi chú ít cay/không hành) và **tự cắt rời tờ giấy**.
2. **Đầu bếp chế biến & gọi Phục vụ:**
   - Đầu bếp xé tờ giấy kẹp lên giá, bắt đúng con cá có mã trên phiếu hoặc lấy túi định lượng ra nấu.
   - Món nào nấu xong đặt lên bàn ra món, **kêu trực tiếp Phục vụ bưng ra cho khách** và gạch/bỏ tờ giấy theo thói quen nhà bếp — **không cần chạm tay vào bất kỳ thiết bị điện tử nào!**
3. *(Trường hợp hãn hữu làm ướt/rách tờ phiếu giấy)*: Bếp trưởng có thể mở `/kiosk` (`Tab Bể cá & Tồn bếp`), chạm vào món vừa in ở cột trái bấm **`In lại phiếu bếp / tem`** là máy in nhả lại tờ mới ngay.

> **[TÁC ĐỘNG LIÊN ROLE]**
> - Toàn bộ việc trừ túi nguyên liệu định lượng (BOM) và rút cá khỏi bể đã được hệ thống **xử lý tự động 100% ngay lúc Phục vụ bấm `Gửi bếp`**, nên dù Đầu bếp không bấm nút nào trên màn hình thì số liệu tồn kho của **Chủ quán (`/owner/inventory`)** và hóa đơn của **Thu ngân (`/cashier`)** vẫn chính xác tuyệt đối!
> - Đồng thời hệ thống trên máy **Phục vụ (`/waiter`)** và **Thu ngân (`/cashier`)** đã được tối ưu hiển thị nhãn xanh **`Đã in bếp`**, **không phát sinh cảnh báo ảo "món chờ lâu"** khi khách ngồi nhậu kéo dài hàng giờ.

---

### Nghiệp vụ 3.2: Báo hỏng nguyên liệu / Cá ngộp kèm Ảnh chụp bắt buộc (`Tab 2`)

**Quy định sắt tại Bếp:** Tuyệt đối không tự ý vứt bỏ cá chết hay thịt/rau hỏng vào thùng rác mà không khai báo (nếu không khai báo, cuối ca Kiểm kho mù sẽ báo thiếu hụt và bị trừ lương!).

**Cách thao tác từng bước:**
1. Mở Tab 2 **`Báo hỏng nguyên liệu`**.
2. Chọn nhóm nguyên liệu bị hỏng: **`Hải sản bể`** | **`Thịt & Sơ chế`** | **`Rau củ - Đậu - Gia vị`** | **`Đồ uống`**.
3. Chọn đúng mặt hàng:
   - Nếu là Hải sản bể: Chạm chọn đích danh **mã con cá bị ngộp/chết** (VD: `#CM-03 · 1,10 kg`).
   - Nếu là Túi nguyên liệu bếp / Đồ uống: Chọn tên túi (VD: *Túi bò thăn 200g*) và nhập số lượng hỏng.
4. Chọn **Nguyên nhân** (`Cá ngộp oxy`, `Rã đông quá hạn`, `Rơi đổ khi chế biến`, `Hàng dập nát`...).
5. **BẮT BUỘC CHỤP ẢNH THỰC TẾ:** Bấm nút **`Tải ảnh / Camera`** -> Chụp rõ con cá chết hoặc phần nguyên liệu hỏng (nếu chưa có ảnh, nút Lưu sẽ bị khóa chặn!).
6. Bấm **`Ghi nhận hỏng & Trừ tồn`**.

> **[TÁC ĐỘNG LIÊN ROLE]**
> - **Sang Phục vụ (`/waiter`) & Thực khách (`/customer`):** Con cá chết bị rút ngay khỏi danh sách bể bơi; túi nguyên liệu hỏng bị trừ khỏi tồn khả dụng. Nếu làm cạn nguyên liệu cấu thành món ăn (BOM), món đó **tự động khóa sang trạng thái `Hết nguyên liệu`** trên điện thoại Phục vụ để không nhận order hố với khách!
> - **Sang Thu ngân (`/cashier`) & Chủ quán (`/owner/approvals`):** Nếu giá trị tổn thất nhỏ nằm trong hạn mức ca (`< 300.000đ`), Quản lý ca duyệt nhanh tại quầy; nếu giá trị lớn (như Tôm hùm bông ngộp), phiếu kèm **ảnh chụp bằng chứng** đẩy thẳng lên điện thoại Chủ quán xem xét phê duyệt.
> - **Sang Đối soát kho & Lãi lỗ (`/owner/inventory` & `/owner/sales`):** Được cộng vào cột `Hao hụt đã duyệt` để cuối ca nhân viên Bếp không bị tính oan là làm mất cắp hàng!

---

### Nghiệp vụ 3.3: Nhập hàng Đồng kiểm Đầu ca & Kiểm kho mù Cuối ca (`Tab 3`)

1. **Đầu ca — Nhập hàng & Nhập cá sống vào bể (`Nhập hàng & Cá mới vào bể`):**
   - Chọn **Nhà cung cấp**, chọn **Người đồng kiểm thứ 2** (bắt buộc có người chứng kiến đồng kiểm, ví dụ Thu ngân hoặc Phục vụ hỗ trợ).
   - **Với Hải sản sống:** Nhập từng con hoặc lô cá vừa giao -> Hệ thống tự sinh mã định danh từng cá thể (`#CM-01`, `#CM-02`...) kèm số kg riêng biệt.
   - **Với Túi nguyên liệu sơ chế & Bia nước:** Nhập số lượng túi chia sẵn trong tủ mát và số thùng bia nhập mới -> Bấm **`Hoàn tất nhập kho`**.
2. **Cuối ca — Kiểm kho mù (`Kiểm kho cuối ca` — Blind Count):**
   - Cuối ngày khi Thu ngân báo kết ca, Bếp trưởng & Phụ trách Hồ cá chuyển sang mục **`Kiểm kho cuối ca`**.
   - **Đặc điểm Kiểm kho mù:** Màn hình **ẨN HOÀN TOÀN con số tồn lý thuyết trên máy tính**! Nhân viên không biết trên phần mềm đang ghi còn bao nhiêu túi bò hay bao nhiêu con cá, bắt buộc phải mở tủ lạnh và nhìn bể đếm thật 100% rồi gõ số thực đếm vào từng ô.
   - Kiểm tra kỹ một lượt rồi bấm **`Nộp phiếu kiểm kho cuối ca`** (sau khi bấm Nộp, bảng kiểm tự động khóa lại không cho sửa số).

> **[TÁC ĐỘNG LIÊN ROLE]**
> - **Khi Nhập kho đầu ca:** Mở bán tức thời các mã cá mới và các món ăn tương ứng trên điện thoại **Phục vụ (`/waiter`)**.
> - **Khi Nộp Kiểm kho mù cuối ca:**
>   - Hệ thống lập tức khớp số đếm thực tế với công thức **Đối soát 4 lớp** trên trang **Chủ quán (`/owner/inventory`)**:
>     `Tồn Lý Thuyết = Tồn Đầu Ca + Nhập Trong Ca - Đã Bán Theo Bill - Báo Hỏng Có Ảnh`.
>   - Nếu `Thực đếm = Lý thuyết` (hoặc nằm trong dung sai hao nước tự nhiên `<= 3%`): Báo xanh **`Khớp kho`**.
>   - Nếu phát sinh thiếu hụt vượt dung sai (VD: thiếu `1 con cua` hoặc thiếu `4 túi bò thăn` không rõ lý do): Tự động tạo phiếu cảnh báo đỏ **`Chênh lệch kiểm kho`** đẩy thẳng lên điện thoại **Chủ quán (`/owner/approvals`)**, nơi Chủ quán có sẵn nút tích **`Khấu trừ vào lương người chịu trách nhiệm`**!

---

## CHƯƠNG 5: HƯỚNG DẪN CHI TIẾT ROLE 4 — THU NGÂN KIÊM QUẢN LÝ CA (`/cashier`)

- **Thiết bị sử dụng:** **01 Chiếc Laptop đặt cố định tại quầy Thu ngân** (màn hình ngang Split-Screen 60/40) + **Máy in K80 tại Quầy**.
- **Đường dẫn & Mã PIN:** `https://munbao.com/login` -> Nhập PIN Thu ngân kiêm Quản lý ca (mặc định: `3333`).
- **Vai trò kép cực kỳ quan trọng:** Chiếc Laptop tại quầy vừa là trạm điều hành thu ngân, vừa chạy ngầm **Cầu nối Máy in LAN** truyền lệnh in cho cả quán, đồng thời người Thu ngân đóng vai trò **Quản lý ca (Người duyệt Tầng 1)** giải quyết nhanh các phát sinh tại sảnh.
- **Bố cục màn hình chia đôi 60% / 40%:**
  - **Cột Trái (60%):** 4 thẻ điều hành gồm `Sơ đồ bàn` | `Đặt bàn trước` | `Hóa đơn đã thu` | `Nhân sự ca`, kèm thanh KPI ca trực ở trên cùng (`Tiền mặt két`, `Thu QR`, `Bàn đã khóa`, `Duyệt trong ca`).
  - **Cột Phải (40%):** Chi tiết hóa đơn của bàn đang chọn + Cụm nút thao tác chuẩn có phím tắt bàn phím: **`In tạm tính (F2)`** -> **`THANH TOÁN (F9)`** -> **`Tách bill (F4)`** -> **`Chuyển / Gộp bàn (F6)`**.

---

### Nghiệp vụ 4.1: Đầu ca — Bật Laptop, Kiểm tra Cầu nối Máy in LAN & Mở ca Két tiền

**Cách thao tác từng bước (2 phút đầu ngày):**
1. Cắm sạc điện liên tục cho Laptop (không để sập nguồn hoặc gập nắp ngủ đông).
2. Kiểm tra dưới thanh Taskbar Windows đã có biểu tượng cửa sổ đen **`QuanNhau_MayIn_LAN` (`[San sang] Dang lang nghe lenh in...`)** tự khởi động cùng Windows chưa. *(Nếu chưa thấy, nhấp đúp mở `C:\QuanNhau_MayIn_LAN\CHAY_KET_NOI_MAY_IN_LAN.bat` rồi thu nhỏ xuống dưới — tuyệt đối không bấm dấu `X` tắt cửa sổ này trong giờ bán hàng)*.
3. Mở Google Chrome vào `https://munbao.com/login` -> Nhập PIN `3333`.
4. Nếu ca mới chưa mở: Nhập **Số tiền mặt quỹ lẻ đầu ca** để thối cho khách (VD: `2.000.000đ`) -> Bấm **`Mở ca bán hàng`**.
5. Vào thẻ **`Nhân sự ca`** kiểm tra phân công khu vực/bàn cho các bạn Phục vụ đi làm hôm nay (có thể đổi người phụ trách từng bàn hoặc cả khu Sân vườn / Trong nhà / VIP chỉ bằng 2 cú nhấp chuột).

> **[TÁC ĐỘNG LIÊN ROLE]**
> - Mở thông suốt luồng in tự động từ điện thoại **Phục vụ (`/waiter`)** và **PG (`/pg`)** xuống **Máy in Bếp** & **Máy in Quầy**.
> - Việc gán khu vực bàn cập nhật ngay bộ lọc `Chỉ bàn của tôi` trên điện thoại từng bạn Phục vụ.

---

### Nghiệp vụ 4.2: Quản lý Đặt bàn trước, Chuyển bàn, Gộp bàn (`mergedPayCodes`) & Tách bill

1. **Tiếp nhận khách Đặt bàn trước (`Thẻ Đặt bàn trước`):**
   - Xem danh sách khách đặt từ web `/customer` hoặc gọi điện đặt qua hotline (Thu ngân có nút **`+ Tạo đặt bàn`** ngay trên màn hình).
   - Khi khách đến quán, đối chiếu tên + 4 số cuối SĐT -> Bấm **`Xếp khách vào bàn`**. Toàn bộ số tiền khách đã đặt cọc trước (VD: `500.000đ` phòng VIP) tự động nạp vào dòng **`Đã đặt cọc`** trên bill để cấn trừ lúc thanh toán!
   - *Lưu ý:* Nếu khách đặt quá giờ hẹn 30 phút không đến (`No-show`), hệ thống tự giải phóng bàn để đón khách vãng lai.
2. **Chuyển bàn / Gộp bàn (`Phím F6`):**
   - **Chuyển bàn** (VD trời mưa khách từ sân vườn `A02` chạy vào nhà `B01`): Chọn bàn `A02` -> Bấm `Chuyển bàn` -> Chọn bàn trống `B01` -> Xác nhận. Bàn `A02` chuyển sang `Cần dọn`, toàn bộ món chuyển nguyên vẹn sang `B01`.
   - **Gộp bàn** (VD đoàn khách đông ngồi 2 bàn `A01` và `A02` muốn tính chung 1 bill vào `A01`): Chọn bàn phụ `A02` -> Chọn gộp vào bàn chính `A01`.
3. **Tách bill (`Phím F4`):**
   - Khách ngồi chung nhưng muốn tách riêng vài món sang bill khác để thanh toán riêng: Bấm **`Tách bill (F4)`** -> Chọn số lượng từng món muốn tách và chọn bàn đích -> Xác nhận.

> **[TÁC ĐỘNG LIÊN ROLE ĐẶC BIỆT KHI GỘP BÀN]**
> - Hệ thống tự động lưu giữ mã thanh toán VietQR cũ của bàn `A02` vào danh sách **`mergedPayCodes`** của bàn gộp `A01`. Nhờ vậy, dù Phục vụ hay khách hàng lỡ quét lại tờ mã QR cũ của bàn `A02` trước lúc gộp, cổng Webhook khi nhận tiền **vẫn tự động tìm thấy và gạch nợ chính xác cho bàn gộp `A01`** mà không bao giờ bị lạc giao dịch!

---

### Nghiệp vụ 4.3: In Phiếu Tạm Tính (`Phím F2`) & Quy tắc Tự Động Khóa Bill Chống Thất Thoát

**Cách thao tác từng bước:**
1. Khi khách gọi tính tiền (hoặc Phục vụ bấm báo in tạm tính làm bàn nháy thông báo trên màn hình POS), Thu ngân chọn bàn đó ở cột trái.
2. Nhìn lướt kiểm tra: còn món nào đang `Chờ cân` không, khách có trả lại bia dư chưa khui không (nếu có trả bia dư thì bấm **`Trả bia dư`** trừ trước khi in).
3. Bấm nút **`In tạm tính (F2)`** ở cột phải.
4. **Máy in K80 tại Quầy** lập tức nhả tờ **`PHIẾU TẠM TÍNH`** (in đầy đủ chi tiết món, khuyến mãi bia 0đ, tách thuế, mật khẩu Wi-Fi và **in sẵn hình mã VietQR của đúng bàn đó ở cuối phiếu**). Thu ngân đưa phiếu cho Phục vụ mang ra bàn.

> **[TÁC ĐỘNG LIÊN ROLE — CHỐT CHẶN CHỐNG GIAN LẬN SỐ 1 CỦA QUÁN]**
> - Trong **60 giây đầu tiên** sau khi bấm `In tạm tính` (*thời gian ân hạn*): Nếu vừa in ra thấy gõ nhầm vẫn sửa nhanh được.
> - Đúng **giây thứ 61 trở đi**, hóa đơn lập tức chuyển sang trạng thái màu đỏ **`ĐÃ KHÓA (Locked)`** trên cả màn hình **Thu ngân (`/cashier`)** lẫn điện thoại **Phục vụ (`/waiter`)**!
> - Mọi nút xóa món, giảm số lượng, thêm chiết khấu trên bill đó đều bị khóa cứng. Điều này triệt tiêu 100% mánh khóe kinh điển ở quán nhậu: *In tờ tạm tính đầy đủ ra thu đủ tiền mặt của khách, rồi quay vào máy xóa bớt vài đĩa mồi / vài lon bia để đút túi riêng!*
> - **Nếu khách thực sự đổi ý sau khi xem bill** (VD trả lại mấy lon bia chưa khui hoặc khiếu nại món chưa lên):
>   - **Mở khóa lần thứ 1:** Thu ngân kiêm Quản lý ca bấm nút **`Mở khóa bill`** -> Nhập rõ lý do (VD: *Khách trả lại 5 lon Tiger chưa khui*) -> Hệ thống mở khóa ngay lập tức để sửa và **lưu vết đỏ vào Nhật ký kiểm toán của Chủ quán**.
>   - **Mở khóa từ lần thứ 2 trở đi trên cùng 1 bàn:** Thu ngân **hết quyền tự mở**! Yêu cầu lập tức bắn lên điện thoại của **Chủ quán (`/owner/approvals`)** — Chủ quán bấm Duyệt từ xa thì máy quầy mới sửa tiếp được.

---

### Nghiệp vụ 4.4: Duyệt nhanh Tầng 1 ngay tại Quầy (`Nút Duyệt trong ca`)

Khi trên thanh KPI đầu trang xuất hiện huy hiệu đếm số ở mục **`Duyệt trong ca`**, nghĩa là Phục vụ hoặc Bếp vừa gửi một yêu cầu nằm trong thẩm quyền của Quản lý ca:

| Yêu cầu từ bộ phận khác gửi lên | Hạn mức Thu ngân kiêm Quản lý ca được tự duyệt ngay (Tầng 1) | Khi vượt hạn mức (Tự động chuyển lên Chủ quán - Tầng 2) |
| :--- | :--- | :--- |
| **1. Hủy món đã gửi bếp** (từ `/waiter`) | Giá trị dòng món hủy **`<= 200.000đ`** | Giá trị dòng món hủy **`> 200.000đ`** |
| **2. Khách ép giá Hải sản nguyên con** (từ `/waiter`) | Mức giảm từ **`> 8%` đến `<= 15%`** (và trên giá vốn) | Mức giảm sâu **`> 15%`** |
| **3. Giảm giá / Chiết khấu trên Bill** | Mức giảm **`<= 10%`** | Mức giảm **`> 10%`** (tối đa 20%) |
| **4. Mở khóa Bill đã in tạm tính** | **Lần thứ 1** trên hóa đơn đó | Từ **lần thứ 2 trở đi** trên cùng hóa đơn |
| **5. Báo hỏng nguyên liệu / Cá ngộp** (từ `/kiosk`) | Giá trị tổn thất **`< 300.000đ`** | Giá trị tổn thất **`>= 300.000đ`** |
| **6. Ứng lương nhân viên / Duyệt tăng ca nhỏ** | Ứng lương **`< 500.000đ`** / Tăng ca ngắn | Vượt hạn mức hoặc **Lệch kiểm kho cuối ca (100% Chủ quán duyệt)** |

> **[TÁC ĐỘNG LIÊN ROLE]**  
> Chỉ cần Thu ngân bấm **`Duyệt`** hoặc **`Từ chối`** (mất 3 giây), màn hình điện thoại của **Phục vụ** ngoài bàn hoặc màn hình **Bếp** lập tức cập nhật kết quả mà nhân viên không phải chạy bộ về quầy xin chữ ký, còn **Chủ quán** không bị làm phiền bởi các việc lặt vặt nhưng vẫn xem lại được 100% lịch sử ai duyệt cái gì trong trang `/owner/approvals`!

---

### Nghiệp vụ 4.5: Chốt Thanh Toán Hóa Đơn (`Phím F9`) — 4 Phương Thức Linh Hoạt

Bấm nút lớn màu xanh **`THANH TOÁN (F9)`** ở cột phải, hệ thống hỗ trợ trọn vẹn mọi tình huống trả tiền tại quán nhậu:

1. **Phương thức 1 — Khách quét mã VietQR (Tự động 100% qua Webhook SePay/Casso/PayOS):**
   - Khách quét mã VietQR trên tờ Phiếu tạm tính giấy K80 (hoặc trên màn hình POS / điện thoại Phục vụ).
   - **Trường hợp khách chuyển đủ hoặc chuyển dư cho Tip:** Ngay khi tiền vào tài khoản ngân hàng của Chủ quán (1–2 giây), hệ thống **tự động đóng bill**, nổ thông báo thành công, tự tách phần tiền dư vào **Tiền Tip** và **tự động in Hóa đơn thanh toán K80** tại quầy!
   - **Trường hợp nhóm bạn ngồi nhậu chia tiền nhiều người cùng quét QR chuyển lẻ từng phần:** Người thứ nhất chuyển `500.000đ` -> Hệ thống tự động cộng `Đã thu: 500.000đ` và cập nhật số tiền **`Còn phải thu`** mới trên màn hình. Người thứ hai, thứ ba quét chuyển nốt phần còn lại -> Khi tổng tiền cộng dồn đạt đủ bill, hệ thống tự động chốt hoàn tất hóa đơn!
   - *(Dự phòng khi chưa nối Webhook hoặc ngân hàng bảo trì)*: Thu ngân đối chiếu tin nhắn nhận tiền của Chủ quán rồi bấm nút **`Xác nhận đã nhận chuyển khoản`** bằng tay.
2. **Phương thức 2 — Tiền mặt (`Cash`):**
   - Chọn tab **`Tiền mặt`** -> Nhập số tiền mặt khách đưa (hoặc chọn mệnh giá gợi ý `500k`, `1 triệu`, `2 triệu`) -> Màn hình hiện to rõ **Số tiền thừa phải thối lại cho khách** -> Bấm **`Hoàn tất thanh toán & In hóa đơn`**.
3. **Phương thức 3 — Kết hợp vừa Tiền mặt vừa Chuyển khoản (`Chia đôi thanh toán`):**
   - Ví dụ bill `1.350.000đ`, khách đưa `500.000đ` tiền mặt lẻ và chuyển khoản `850.000đ`: Chọn **`Kết hợp (TM + QR)`**, nhập `500.000đ` tiền mặt -> Hệ thống tự ghi đúng `500k` vào ngăn kéo két tiền mặt và `850k` vào doanh thu ngân hàng để cuối ca đếm két không bị lệch!
4. **Xử lý cảnh báo đỏ khi khách chuyển khoản trùng 2 lần (`Overpayment`):**
   - Nếu bàn đã thu tiền mặt và đóng bill xong, nhưng một người bạn khác trong bàn không biết lại quét tờ tạm tính chuyển khoản thêm lần nữa: Hệ thống tự động chặn không tạo đơn trùng và bật cảnh báo đỏ **`Tiền về sau khi đóng bill`**. Thu ngân bấm chọn 1 trong 2 nút: **`Đã rút két hoàn tiền mặt lại cho khách`** (hệ thống tự trừ tiền két) hoặc **`Khách tặng làm Tiền Tip`**.

> **[TÁC ĐỘNG LIÊN ROLE KHI CHỐT THANH TOÁN]**
> - **Tại Máy in Quầy:** Nhả tờ **Hóa đơn thanh toán K80** chính thức, dưới chân bill có in **Mã tra cứu 8 ký tự + QR** để khách tự xuất hóa đơn đỏ VAT trên điện thoại trong vòng 24h.
> - **Sang Phục vụ (`/waiter`):** Bàn chuyển sang màu vàng **`Cần dọn`** để nhân viên thu dọn bát đũa, thay khăn trải bàn đón lượt khách mới.
> - **Sang Chủ quán & Kế toán (`/owner`):** Doanh thu thuần, Giá vốn (COGS), Thuế GTGT tách riêng `8%` (đồ ăn) và `10%` (bia rượu), Tiền mặt két, Tiền ngân hàng và Lợi nhuận ròng lập tức nhảy số thời gian thực!

---

### Nghiệp vụ 4.6: Quản lý Két tiền mặt trong ca & Đếm tiền 9 mệnh giá Khóa sổ Z-Report cuối ngày

1. **Chi tiền mặt tại quầy trong ca (`Quản lý két tiền`):**
   - Bất kỳ khoản tiền mặt nào rút ra khỏi ngăn kéo đều phải nhập vào máy (mất 10 giây) theo 3 phân loại:
     - **`Chi vặt vận hành`:** Mua thêm đá viên, đổi bình gas, mua chanh ớt... (nhập số tiền + lý do).
     - **`Chi ứng lương nhân viên`:** Chọn tên nhân viên xin ứng + số tiền.
     - **`Chi trả Tiền Tip mặt cho nhân viên`:** Khi khách Tip qua QR nhưng quán muốn rút tiền mặt trong két phát nóng cho anh em cuối buổi.
2. **Cuối ngày — Kết ca & Khóa sổ Z-Report (`Kết ca & Két tiền`):**
   - **Bước 1:** Kiểm tra không còn bàn nào đang mở dở; đối soát số nắp lon khuyến mãi PG Bia bàn giao; nhắc Bếp & Hồ cá nộp xong Kiểm kho mù.
   - **Bước 2 (Đếm tiền mặt theo 9 mệnh giá):** Mở ngăn kéo tiền mặt, đếm từng xấp tờ `500.000đ`, `200.000đ`, `100.000đ`, `50.000đ`, `20.000đ`, `10.000đ`, `5.000đ`, `2.000đ`, `1.000đ` và gõ **số tờ** vào bảng.
   - **Bước 3:** Hệ thống tự nhân tổng tiền thực đếm và so sánh với công thức:  
     `Tiền mặt lý thuyết phải có = Quỹ đầu ca + Thu tiền mặt các Bill + Cọc tiền mặt - Chi vặt - Chi ứng lương - Chi Tip tiền mặt`.
   - Nếu lệch quá `1.000đ`, bắt buộc phải gõ **Lý do giải trình chênh lệch** mới bấm được nút **`Khóa sổ Z-Report & In phiếu chốt ca`**.

> **[TÁC ĐỘNG LIÊN ROLE]**
> - Lưu vĩnh viễn biên bản chốt ca **Z-Report** vào cơ sở dữ liệu PostgreSQL 16; khóa sổ doanh thu ngày trên trang `/owner/sales` và khấu trừ tự động các khoản tiền ứng vào phiếu lương của nhân viên tương ứng trên `/owner/hr`!

---

## CHƯƠNG 6: HƯỚNG DẪN CHI TIẾT ROLE 5 — CHỦ QUÁN & KẾ TOÁN (`/owner` & `/owner/settings`)

- **Thiết bị & Đăng nhập:** Điện thoại cá nhân khi đi vắng hoặc Laptop văn phòng -> Mở `https://munbao.com/login`.
  - **Chủ quán (PIN mặc định `1111` — *đổi ngay sang số bí mật riêng khi nhận bàn giao*):** Toàn quyền xem mọi báo cáo, phê duyệt tầng 2, quản trị dữ liệu hệ thống và chỉnh sửa toàn bộ 8 nhóm Cài đặt.
  - **Kế toán (PIN mặc định `2222`):** Chuyên trách theo dõi doanh thu - lãi lỗ, đối soát tồn kho 4 lớp, bảng chấm công - tính lương, sổ thuế GTGT 8% & 10% và **xuất các bảng kê ra file Excel/CSV** (mặc định khóa quyền sửa Cài đặt vận hành trừ khi Chủ quán cấp phép).

---

### 6.1. Hướng dẫn sử dụng 7 Phân hệ Báo cáo, Phê duyệt & Xuất Bảng Kê CSV

Trên thanh menu trái (Laptop) hoặc thanh đáy (Điện thoại), Chủ quán và Kế toán sử dụng bộ lọc thời gian thống nhất (`Hôm nay`, `Hôm qua`, `7 ngày`, `30 ngày`, `Tháng này`, `Tháng trước`, `Tùy chọn từ ngày - đến ngày`):

1. **`Tổng quan (/owner/overview)` — Bảng điều khiển 30 giây của Chủ quán:**
   - Nhìn ngay các con số sống còn đang nhảy trực tiếp: **Doanh thu thuần**, **Lợi nhuận ròng bỏ túi (Net Profit)** sau khi đã trừ hết giá vốn + lương ca + hao hụt + chi phí cố định phân bổ ngày, số bàn đang ngồi, danh sách việc khẩn cần duyệt và cảnh báo thất thoát.
2. **`Phê duyệt (/owner/approvals)` — Trung tâm kiểm soát ngoại lệ Tầng 2:**
   - Xem và bấm **`Duyệt` / `Từ chối`** từ xa đối với: Mở khóa bill từ lần 2, hủy món giá trị lớn (`> 200k`), giảm giá sâu (`> 10%`), ép giá cá sâu (`> 15%`), báo hỏng hải sản đắt tiền (bấm xem trực tiếp **ảnh chụp thật** từ Bếp gửi lên) và **Lệch kiểm kho cuối ca** (có ô tích **`Trừ vào lương nhân sự kiểm kho`** khi từ chối giải trình).
   - Có tab xem lại toàn bộ các yêu cầu mà Quản lý ca (Thu ngân) đã tự duyệt ở Tầng 1 trong ngày.
3. **`Bán hàng và lãi lỗ (/owner/sales)` — Thống kê Doanh thu chi tiết & Xuất CSV Kế toán:**
   - Bao gồm đầy đủ báo cáo Lãi lỗ (P&L), biểu đồ doanh thu theo ngày/khung giờ, thống kê sức bán & biên lãi gộp từng món ăn/hải sản/bia, danh sách hóa đơn chi tiết và nhật ký chống thất thoát (in lại bill, mở khóa bill, hủy món).
   - **Cách xuất Bảng kê CSV mở trực tiếp trên Excel:** Ngay trên góc phải các bảng trong `/owner/sales`, Kế toán/Chủ quán bấm:
     - **`Xuất CSV theo ngày`**: Tải file `bang_ke_doanh_thu_ngay_...csv` (bóc tách từng ngày: số bill, lượt khách, doanh thu đồ ăn, bia rượu, phụ thu VIP, giảm giá, thu tiền mặt, thu QR, tiền Tip, giá vốn COGS, lãi gộp, hao hụt, nhân công, lãi ròng).
     - **`Xuất CSV hóa đơn`**: Tải file `bang_ke_hoa_don_...csv` (chi tiết từng hóa đơn, mã QR, giờ mở/đóng, phục vụ, thu ngân, danh sách món, tách VAT 8% và 10%, trạng thái hóa đơn điện tử).
     - **`Xuất CSV theo món`**: Thống kê số lượng bán, số kg hải sản, số lon KM tặng, doanh thu, giá vốn và lợi nhuận gộp từng mặt hàng để biết món nào đang nuôi sống quán, món nào ế cần cắt bỏ.
4. **`Kho và đối soát (/owner/inventory)` — Bảng Đối Soát 4 Lớp chống thất thoát:**
   - Hiển thị rõ trên cùng 1 dòng cho từng loài hải sản bể, từng túi nguyên liệu bếp và từng loại bia:  
     `[1] Đầu ca` + `[2] Nhập thêm` - `[3] Bán theo Bill` - `[4] Báo hỏng có ảnh` = **`Tồn Lý Thuyết`** đem so với **`Kiểm Thực Tế Cuối Ca`** -> Chỉ đích danh chênh lệch thừa/thiếu bao nhiêu con/kg/túi và quy ra tiền đồng!
5. **`Nhân sự và lương (/owner/hr)`:**
   - Xem giờ vào/ra ca, xem lại ảnh chụp Selfie chấm công + vị trí GPS của từng nhân viên, bảng lương tự động cộng giờ chuẩn + tăng ca (`1,5x`) + phụ cấp đêm (`+30%`) + thưởng Upsell + hoa hồng PG + tiền Tip QR trừ phạt trễ/ứng lương/đền bù vỡ hỏng -> Bấm **`Xuất CSV bảng lương`** để chuyển khoản trả lương cuối tháng.
6. **`Thuế và hóa đơn (/owner/tax)` & `Thưởng hãng (/owner/rebate)`:**
   - Sổ kê khai thuế tách chuẩn **Thuế GTGT 8% (Đồ ăn & Nước ngọt)** và **Thuế GTGT 10% (Bia & Rượu)** hoặc thuế khoán hộ kinh doanh `4,5%`, quản lý các hóa đơn điện tử đã phát hành cho khách, bấm **`Xuất bảng kê thuế (CSV)`** và **`Khóa sổ kỳ thuế`**.
   - Theo dõi tiến độ đạt mốc thưởng sản lượng thùng bia (`Rebate`) với các hãng Tiger, Heineken, Sabeco.

---

### 6.2. Hướng dẫn Nối Cổng Thanh Toán VietQR Tự Động (SePay / Casso / PayOS) Ngay Trên Giao Diện Web (3 Phút — Không cần đụng Code)

Khi Team triển khai ngồi trực tiếp cùng Chủ quán để kích hoạt tính năng **khách chuyển khoản tiền vừa về tài khoản là Web tự báo xanh & tự đóng bill**, thực hiện đúng 4 bước ngay trên trình duyệt:

1. Đăng nhập quyền Chủ quán (`https://munbao.com/owner`) -> Vào mục **`Cài đặt` (`/owner/settings`)** -> Chọn nhóm **`7. Máy in và mẫu bill`**.
2. **Khai báo tài khoản nhận tiền tại khung `Tài khoản nhận VietQR`:**
   - Chọn **Ngân hàng** (hỗ trợ đầy đủ 36 ngân hàng Napas247 & tài khoản định danh VA `VQR...` / `96247...`), nhập **Số tài khoản** và **Tên chủ tài khoản** (viết IN HOA không dấu).
   - Nhìn khung **Xem trước mã VietQR** bên phải, lấy điện thoại quét thử kiểm tra đúng tên Chủ quán.
3. **Lấy thông số tại khung `Cổng thanh toán & Webhook Biến động số dư`:**
   - Bật công tắc **`Kích hoạt Webhook tự động xác nhận thanh toán QR`**.
   - Chọn nhà cung cấp cổng thanh toán Chủ quán đăng ký (**SePay** `my.sepay.vn` / **Casso** `casso.vn` / **PayOS** `my.payos.vn`).
   - Bấm nút **`Tạo khóa ngẫu nhiên`** để sinh mã bảo mật (hoặc dán `Checksum Key` từ PayOS vào ô Khóa bảo mật), sau đó bấm nút màu cam **`Lưu và áp dụng`** ở góc dưới cùng bên phải màn hình!
4. **Dán sang Cổng thanh toán & Bấm Kiểm tra trực tiếp:**
   - Bấm nút 1 chạm **`Sao chép Webhook URL`** (`https://munbao.com/api/webhooks/payment`) và **`Sao chép Khóa`**, dán vào mục cấu hình Webhook trên trang quản trị SePay / Casso / PayOS của Chủ quán (chi tiết 3 bước cho từng cổng hiện sẵn ngay trên màn hình bên phải).
   - Quay lại màn hình Web của quán, bấm nút **`Kiểm tra kết nối Webhook trực tiếp`** -> Hệ thống hiện thông báo xanh **`Kết nối chuẩn 100% (HTTP 200 OK)`** và ghi nhận vào bảng **`Nhật ký tín hiệu Webhook ngân hàng nhận gần nhất`** ngay trước mặt Chủ quán!

> **[TÁC ĐỘNG TỪ CÀI ĐẶT CỦA CHỦ QUÁN XUỐNG TOÀN BỘ CÁC ROLE]**  
> Mọi chỉnh sửa trong `/owner/settings` (thêm món mới, đổi giá cá theo ngày, sửa hạn mức duyệt của Thu ngân, gắn lại IP Wi-Fi / tọa độ GPS quán, đổi quy chế chia Tiền Tip) đều được viết trên **Bản nháp an toàn** và ngay khi bấm **`Lưu và áp dụng` -> `Áp dụng ngay`**, toàn bộ thiết bị của Thu ngân, Phục vụ, PG, Bếp và Thực khách cập nhật đồng loạt trong tích tắc mà không làm gián đoạn các bàn đang ăn!

---

## CHƯƠNG 7: HƯỚNG DẪN CHI TIẾT ROLE 6 — THỰC KHÁCH (`/customer`)

Đường dẫn công khai `https://munbao.com/customer` (in thành mã QR đặt tại quầy lễ tân, fanpage Facebook/Zalo của quán và dưới chân hóa đơn K80 — khách quét mở ngay không cần tải App hay nhập PIN):

1. **Tab 1 — `Đặt bàn` (+ Tra cứu đơn đặt):**
   - Khách chọn Ngày -> Khung giờ còn trống -> Số lượng khách -> Khu vực ngồi (`Sân vườn`, `Trong nhà`, `Phòng VIP`) -> Điền Tên & SĐT.
   - Nếu chọn **Phòng VIP** hoặc đi đoàn đông **`>= 8 khách`**, hệ thống tự động hiện mã **VietQR đặt cọc** (khóa cứng đúng số tiền cọc `200.000đ` hoặc `500.000đ`) và đồng hồ đếm ngược giữ chỗ **30 phút**.
   - *Tác động:* Đơn hiện ngay ở tab `Đặt bàn trước` của **Thu ngân (`/cashier`)**; khách chuyển khoản cọc xong Webhook tự đổi trạng thái sang xanh lá **`Đã xác nhận`** và cho phép tải lịch hẹn `.ics` về điện thoại; quá 30 phút không cọc hệ thống tự hủy giữ chỗ trả lại bàn trống cho quán!
2. **Tab 2 — `Rượu gửi`:**
   - Khách nhập SĐT -> Xem danh sách các chai rượu ngoại mình đã gửi tại quán, phần trăm rượu còn lại và hạn gửi -> Bấm **`Nhận mã OTP mở rượu`** -> Đọc 6 chữ số OTP cho **Phục vụ / Thu ngân** để mang rượu ra bàn.
3. **Tab 3 — `Xuất hóa đơn` (Tự lấy Hóa đơn đỏ GTGT trong 24 giờ):**
   - Khách đi tiếp khách công ty về không cần đứng đợi ở quầy thu ngân lúc khuya: Chỉ cần quét mã QR dưới chân tờ hóa đơn thanh toán K80 (hoặc nhập **Mã tra cứu 8 ký tự**), gõ **Mã số thuế công ty** (bấm `Tra cứu` tự điền tên & địa chỉ doanh nghiệp) + **Email kế toán** -> Bấm **`Gửi yêu cầu xuất hóa đơn`**.
   - *Tác động:* Hệ thống tự động bóc tách chuẩn thuế suất `8%` (nhóm đồ ăn, nước ngọt) và `10%` (nhóm bia, rượu) của hóa đơn đó, phát hành và lưu thẳng vào phân hệ **`Thuế và hóa đơn (/owner/tax)`** cho Kế toán quán!

---

## CHƯƠNG 8: 5 BÀI TẬP ĐÓNG VAI THỰC HÀNH LIÊN PHÒNG BAN (DÙNG TRONG BUỔI TRAINING)

Sau khi hướng dẫn xong lý thuyết từng Role, Giảng viên cho toàn bộ nhân viên cầm thiết bị của mình và chạy lần lượt **5 bài tập phối hợp thực tế** dưới đây (mỗi bài 5–6 phút) để kiểm tra độ thuộc bài trước khi kết thúc buổi đào tạo:

### Bài tập 1: Luồng chuẩn Gọi món + Bia thùng -> Máy in Bếp tự nhả giấy -> Trả bia dư -> Quét QR có Tip
1. **Phục vụ (`4444`):** Mở bàn `A01` (4 khách), gọi `1 Bò lúc lắc (ghi chú: ít hành)` + `1 Lẩu Thái hải sản` + `1 thùng Tiger Bạc (24 lon)` -> Bấm **`Gửi bếp`**.
2. **Bếp & Thu ngân kiểm chứng:** Nghe **Máy in Bếp** tự kêu Bíp nhả phiếu giấy 2 món ăn trong 1,5 giây *(Đầu bếp xé giấy nấu và tự kêu miệng Phục vụ nhận món — không cần bấm nút nào trên máy)*; **Máy in Quầy** tự nhả phiếu 24 lon Tiger (+2 lon KM hãng); **PG Bia (`5555`)** mở máy thấy tự cộng sản lượng 1 thùng & nợ 2 nắp lon.
3. **Phục vụ (`4444`):** Khách uống không hết thùng, bấm **`Trả bia dư`** -> nhập trả lại `8 lon` -> Cả lớp quan sát bill tự lùi về `16 lon` và lon tặng KM tự động giảm từ `2 lon` xuống còn `1 lon`!
4. **Thanh toán QR:** Phục vụ bấm **`Thanh toán`** tại bàn (hoặc Giảng viên test chuyển khoản dư thêm `20.000đ`) -> Quan sát hộp thoại xanh nổ đồng thời trên điện thoại Phục vụ & Laptop Thu ngân, bill tự đóng và `20.000đ` nhảy thẳng vào mục Tiền Tip của Phục vụ!

### Bài tập 2: Luồng Hải sản sống — Cắt lẻ theo Gram & Khách ép giá nguyên con
1. **Phục vụ (`4445`):** Mở bàn `A02`, vào món *Cá mú đen*:
   - Gọi 1 phần **Cắt lẻ `500g`** nấu cháo.
   - Gọi thêm 1 con **Nguyên con `#CM-01`** hấp Hồng Kông, bật **`Khách trả giá`** xin giảm khoảng `12%` -> Bấm gửi.
2. **Thu ngân (`3333`):** Thấy chuông báo tại **`Duyệt trong ca`** (vì giảm 12% nằm trong khung 8%–15% của Quản lý ca) -> Bấm **`Duyệt`** ngay tại quầy.
3. **Hồ cá (`6666`):** Quan sát bể cá thấy con cá bị cắt lẻ tự động hiện nhãn **`Đang xẻ dở (còn dư ...g)`**, còn con `#CM-01` đã rút khỏi bể không bàn nào chọn trùng được nữa.

### Bài tập 3: Chốt chặn Khóa Bill sau Tạm tính & Phân quyền Mở khóa 2 tầng
1. **Thu ngân (`3333`):** Chọn bàn `A02` -> Bấm **`In tạm tính (F2)`**.
2. **Phục vụ (`4445`):** Đợi qua 60 giây (hoặc kiểm tra khi bill khóa), thử bấm xóa món hoặc thêm món -> Thấy băng đỏ **`Bill đã khóa`** chặn lại.
3. **Thu ngân (`3333`):** Thực hiện **Mở khóa lần 1** (ghi lý do: *Khách gọi thêm khăn lạnh*) -> Mở được ngay. Sau đó bấm `In tạm tính` lại và thử bấm **Mở khóa lần 2** -> Hệ thống chặn quyền Thu ngân và bắn thẳng yêu cầu lên điện thoại **Chủ quán (`1111`)** duyệt!

### Bài tập 4: Báo hỏng nguyên liệu có Ảnh chụp & Kiểm kho mù cuối ca
1. **Bếp (`7777`):** Vào `/kiosk` Tab 2 **`Báo hỏng nguyên liệu`** -> Chọn 1 túi nguyên liệu bị rách hỏng -> Thử bấm Lưu khi chưa chụp ảnh (bị chặn) -> Bấm chụp ảnh thật bằng Camera rồi Lưu.
2. **Bếp (`7777`):** Sang Tab 3 **`Kiểm kho cuối ca`** -> Cố tình nhập thiếu `2 túi bò thăn` so với thực tế rồi bấm **`Nộp`**.
3. **Chủ quán (`1111`):** Mở `/owner/inventory` xem bảng **Đối soát 4 lớp** chỉ đích danh dòng thiếu 2 túi bò, và vào `/owner/approvals` xử lý phiếu lệch kho!

### Bài tập 5: Bàn giao nắp PG, Đếm tiền 9 mệnh giá & Xuất CSV Kế toán
1. **PG Bia (`5555`):** Vào tab **`Quỹ khuyến mãi`** nhập số nắp lon bàn giao cho Thu ngân.
2. **Thu ngân (`3333`):** Vào `Quản lý két` nhập chi vặt `50.000đ` mua đá viên -> Sang mục **`Kết ca & Két tiền`** nhập số tờ thực đếm của 9 mệnh giá tiền mặt -> Khóa sổ **Z-Report**.
3. **Kế toán (`2222`) / Chủ quán (`1111`):** Mở `/owner/sales` và `/owner/hr` bấm thử **`Xuất CSV theo ngày`**, **`Xuất CSV hóa đơn`** và **`Xuất CSV bảng lương`** mở lên kiểm tra bảng kê hoàn chỉnh.

---

## CHƯƠNG 9: CẨM NANG XỬ LÝ NHANH SỰ CỐ TẠI HIỆN TRƯỜNG (TROUBLESHOOTING)

| Tình huống gặp phải khi Training / Vận hành | Nguyên nhân phổ biến | Cách xử lý dứt điểm trong 30 giây |
| :--- | :--- | :--- |
| **1. Phục vụ bấm `Gửi bếp` nhưng Máy in trong Bếp không nhả giấy** | • Cửa sổ cầu nối `QuanNhau_MayIn_LAN` trên Laptop bị ai đó bấm dấu `X` tắt mất.<br>• Laptop bị chuyển sang chế độ Ngủ (Sleep) khi gập nắp.<br>• Máy in Bếp lỏng dây LAN hoặc hết giấy. | 1. Mở lại `C:\QuanNhau_MayIn_LAN\CHAY_KET_NOI_MAY_IN_LAN.bat` trên Laptop Thu ngân (chỉnh Power Options của Windows thành `Never Sleep` & `Close lid: Do nothing`).<br>2. Nhờ tính năng **Máy in dự phòng**, nếu máy Bếp tuột dây LAN/hết giấy, phiếu món ăn sẽ tự động in tràn sang **Máy in Quầy Thu ngân** để không bao giờ mất order! |
| **2. Nhân viên đứng ngay trong quán nhưng bấm Chấm công báo lỗi Wi-Fi hoặc lỗi khoảng cách GPS** | • Điện thoại nhân viên đang bật mạng di động **4G/5G** thay vì bắt Wi-Fi của quán.<br>• Trình duyệt điện thoại bị chặn quyền Vị trí (Location). | 1. Bảo nhân viên tắt hẳn 4G, kết nối đúng vào Wi-Fi nội bộ của quán.<br>2. Bấm biểu tượng ổ khóa cạnh thanh địa chỉ trình duyệt -> Cho phép **Vị trí (Allow Location)** & **Máy ảnh**.<br>3. Nếu nhà mạng vừa đổi IP động của cục Modem quán: Chủ quán mở `Cài đặt -> Ca làm và lương -> Chấm công` bấm 1 chạm **`Gắn IP Wi-Fi hiện tại làm mạng quán`**. |
| **3. Khách đã quét VietQR chuyển khoản thành công trên App ngân hàng nhưng 10 giây chưa thấy màn hình nổ báo xanh** | • Khách lỡ tay xóa mất mã định danh bàn (VD xóa mất chữ `QN A05 ...`) trong ô Nội dung chuyển khoản.<br>• Ngân hàng nhận tiền bị trễ tin biến động vài chục giây giờ cao điểm. | 1. Mở `Chủ quán -> Cài đặt -> Máy in và mẫu bill` kéo xuống xem **Nhật ký tín hiệu Webhook**: nếu thấy giao dịch hiện chữ `Giao dịch lẻ (không khớp mã bàn)` là do khách xóa nội dung CK.<br>2. Kiểm tra đúng tiền đã vào tài khoản Chủ quán -> Thu ngân bấm nút **`Xác nhận đã nhận QR`** thủ công ngay trên modal Thanh toán để đóng bàn bình thường (không bị đứng quầy). |
| **4. Món ăn trên điện thoại Phục vụ hiện chữ mờ `Hết nguyên liệu` không cho bấm gọi dù dưới bếp bảo vẫn còn đồ** | Tồn kho túi định lượng (BOM) trên phần mềm đã trừ về `0` do đầu ngày Bếp nhập thiếu số lượng sơ chế vào kho. | Bếp trưởng (`7777`) hoặc Phụ trách kho (`6666`) mở `/kiosk` -> Tab 3 **`Nhập / Kiểm kho`** -> Nhập bổ sung số túi nguyên liệu vừa sơ chế thêm -> Món ăn trên máy Phục vụ lập tức sáng lại ngay! |
| **5. Đã tập dượt thử nghiệm xong xuôi, muốn xóa sạch mọi bill nháp để quán mở cửa bán thật ngay** | Dữ liệu diễn tập đang nằm trong doanh thu hôm nay. | Đăng nhập Chủ quán (`1111` hoặc PIN mới) -> Bấm nút **`Dữ liệu hệ thống`** góc trên phải -> Chọn **`Khởi tạo Quán Mới (Xóa dữ liệu mẫu để bán hàng thật)`** -> Xác nhận. Toàn bộ bill nháp về `0`, giữ nguyên 100% cài đặt bàn, món, nhân viên, máy in và cổng VietQR! |
