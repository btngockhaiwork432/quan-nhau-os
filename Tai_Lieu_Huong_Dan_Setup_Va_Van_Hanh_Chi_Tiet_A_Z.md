# TÀI LIỆU HƯỚNG DẪN SETUP & VẬN HÀNH CHI TIẾT (TỪ A ĐẾN Z)

**Hệ thống Quản lý & Vận hành Quán Nhậu - Hải Sản (Bản Production Chính thức tại https://munbao.com)**

---

## CHƯƠNG 1: TỔNG QUAN KIẾN TRÚC, ĐƯỜNG DẪN & TÀI KHOẢN BÀN GIAO

Hệ thống Quản lý & Vận hành Quán Nhậu - Hải Sản (Quán Nhậu OS) là nền tảng ERP chuyên biệt gồm 6 cổng giao diện theo vai trò, đồng bộ thời gian thực qua Server-Sent Events (SSE) và lưu trữ toàn vẹn ACID trên 38 bảng quan hệ PostgreSQL 16. Toàn bộ hệ thống được triển khai ở chế độ Production (Không Demo) tại tên miền chính thức https://munbao.com.

### 1.1. Danh mục 7 Đường dẫn Truy cập Chính thức (Clean URL - Không dùng #/)

| Phân hệ / Cổng | Đường dẫn Production | Thiết bị sử dụng | Mục đích & Quyền truy cập |
| --- | --- | --- | --- |
| Cổng Đăng nhập PIN | https://munbao.com/login | Mọi thiết bị nhân viên | Màn hình nhập mã PIN 4 số cá nhân; tự động nhận diện vai trò và mở đúng cổng làm việc. |
| Cổng Thực khách | https://munbao.com/customer | Điện thoại của khách hàng | Công khai (Không cần PIN). Đặt bàn trực tuyến, cọc VietQR, tra cứu rượu gửi (OTP), tự xuất hóa đơn VAT. |
| Cổng Phục vụ bàn | https://munbao.com/waiter | Điện thoại / Tablet phục vụ | Yêu cầu PIN Phục vụ (4444..4447). Mở bàn, gọi món, bắt cá theo mã/gram/trả giá, tạo thẻ rượu, thu tiền QR/Tiền mặt tại bàn. |
| Cổng PG Bia | https://munbao.com/pg | Điện thoại của PG Bia | Yêu cầu PIN PG (5555). Thêm bia vào bàn, tặng bia khuyến mãi Mua X Tặng Y, theo dõi sản lượng & bàn giao nắp lon cuối ca. |
| Kiosk Bếp & Hồ cá | https://munbao.com/kiosk | Máy tính bảng treo tường tại Bếp/Hồ cá | Yêu cầu PIN Hồ cá (6666) / Bếp (7777). Nhận đơn bếp/bể cá, cân ký & in tem, báo hỏng nguyên liệu (kèm ảnh Camera), nhập hàng đồng kiểm, kiểm kho mù cuối ca, chấm công Kiosk. |
| Máy Thu ngân POS | https://munbao.com/cashier | Máy POS cảm ứng tại quầy + Máy in K80 | Yêu cầu PIN Thu ngân kiêm Quản lý (3333). Quản lý sơ đồ bàn, tách/gộp/chuyển bàn, in tạm tính khóa bill, thu tiền, duyệt nhanh trong hạn mức, đếm tiền theo mệnh giá & khóa sổ ca. |
| Cổng Chủ quán & Kế toán | https://munbao.com/owner | Laptop / Điện thoại Chủ quán & Kế toán | Yêu cầu PIN Chủ quán (1111) hoặc Kế toán (2222). Xem lãi lỗ thực (Net Profit), duyệt ngoại lệ, đối soát tồn kho 4 lớp, bảng lương, báo cáo thuế, quản trị 38 bảng PostgreSQL 16 và cài đặt toàn bộ quán. |

### 1.2. Bảng Tài khoản & Mã PIN Nhân sự Mặc định khi Bàn giao

| Mã NV | Họ và tên | Vai trò trong hệ thống | Mã PIN | Khu vực / Bàn phân công mặc định |
| --- | --- | --- | --- | --- |
| s_owner | Nguyễn Văn Chủ | Chủ quán (Toàn quyền) | 1111 | Toàn bộ hệ thống & 8 nhóm Cài đặt |
| s_acc | Lê Thị Kế Toán | Kế toán | 2222 | Báo cáo lãi lỗ, kho, lương, thuế |
| s_cash | Trần Minh Thu | Thu ngân kiêm Quản lý ca | 3333 | Quầy POS trung tâm & duyệt hạn mức ca |
| s_lan | Phạm Thị Lan | Phục vụ bàn | 4444 | Khu Sân vườn: Bàn A01 đến A06 |
| s_nam | Đỗ Văn Nam | Phục vụ bàn | 4445 | Khu Sân vườn: Bàn A07 đến A12 |
| s_hoa | Vũ Thị Hoa | Phục vụ bàn | 4446 | Khu Trong nhà (B01-B04) & Phòng VIP 1 |
| s_duc | Bùi Minh Đức | Phục vụ bàn | 4447 | Khu Trong nhà (B05-B08) & Phòng VIP 2 |
| s_thao | Ngô Thanh Thảo | PG Bia | 5555 | Toàn bộ các bàn có gọi bia |
| s_long | Hoàng Văn Long | Phụ trách Bể hải sản | 6666 | Kiosk Bể hải sản & Kiểm kho |
| s_son | Đinh Văn Sơn | Bếp trưởng | 7777 | Kiosk Bếp & Định lượng nguyên liệu |
| s_mai | Lý Thị Mai | Tạp vụ | 8888 | Chấm công tại Kiosk Bếp |

---

## CHƯƠNG 2: HƯỚNG DẪN CÀI ĐẶT KỸ THUẬT CHI TIẾT (LOCAL & VPS LINUX)

Chương này hướng dẫn chi tiết từng câu lệnh để kỹ thuật viên hoặc chủ hệ thống có thể tự cài đặt lại từ đầu trên máy tính cá nhân (Windows/macOS/Linux) hoặc triển khai lên một máy chủ VPS Linux mới.

### 2.1. Cài đặt và chạy trên Máy tính cá nhân (Local Windows / macOS / Linux)

- Bước 1: Cài đặt Python 3.10 trở lên (khuyến nghị Python 3.11 hoặc 3.12) từ trang chủ python.org. Khi cài trên Windows, tích chọn 'Add Python to PATH'.
- Bước 2: Giải nén mã nguồn dự án vào thư mục C:\quan_nhau (gồm 2 thư mục chính: backend/ và web/).
- Bước 3: Mở PowerShell hoặc Command Prompt tại thư mục C:\quan_nhau và cài đặt các gói thư viện Python cần thiết:

```bash
cd C:\quan_nhau
pip install -r backend/requirements.txt
```

- Bước 4: Khởi chạy máy chủ Backend + Giao diện Web + PostgreSQL 16:
```yaml
# Cách 1: Tự động dùng PostgreSQL 16 nhúng (pgserver) tại backend/pgdata
python backend/server.py

# Cách 2: Kết nối tới PostgreSQL 16 độc lập cài trên máy hoặc Docker
$env:DATABASE_URL="postgresql://postgres:matkhau@127.0.0.1:5432/quan_nhau_os"
python backend/server.py
```

- Sau khi khởi chạy, mở trình duyệt tại http://127.0.0.1:8765/login để sử dụng bản Production.
- Nếu muốn bật thanh công cụ chuyển nhanh vai trò để đào tạo nhân viên, truy cập http://127.0.0.1:8765/login?demo=1.

### 2.2. Cài đặt và triển khai trên Máy chủ VPS Linux (Ubuntu/Debian + Docker + Nginx + SSL)

- Bước 1: Kết nối SSH vào VPS bằng quyền root và tạo thư mục độc lập /opt/quan_nhau (tuyệt đối không đụng chạm tới các dịch vụ khác đang chạy trên VPS):

```bash
ssh root@14.225.253.239
mkdir -p /opt/quan_nhau/backend /opt/quan_nhau/web
```

- Bước 2: Tải thư mục backend/, web/, Dockerfile và docker-compose.yml lên /opt/quan_nhau. Nội dung chuẩn của tệp /opt/quan_nhau/docker-compose.yml như sau:
```yaml
version: "3.8"
services:
  quannhau-db:
    image: postgres:16-alpine
    container_name: quannhau-db
    restart: unless-stopped
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: quannhau2026
      POSTGRES_DB: quan_nhau_os
    volumes:
      - quannhau_pgdata:/var/lib/postgresql/data

  quannhau-app:
    build: .
    container_name: quannhau-app
    restart: unless-stopped
    depends_on:
      - quannhau-db
    environment:
      DATABASE_URL: postgresql://postgres:quannhau2026@quannhau-db:5432/quan_nhau_os
      PORT: "8765"
    ports:
      - "127.0.0.1:8765:8765"

volumes:
  quannhau_pgdata:
```

- Bước 3: Chạy lệnh 'cd /opt/quan_nhau && docker compose up -d --build' để khởi tạo container PostgreSQL 16 (quannhau-db) và ứng dụng FastAPI (quannhau-app).
- Bước 4: Cấu hình Nginx Reverse Proxy tại /etc/nginx/sites-available/munbao.com trỏ về http://127.0.0.1:8765 (bắt buộc bật 'proxy_buffering off;' để truyền sự kiện SSE thời gian thực) và chạy 'certbot --nginx -d munbao.com' để kích hoạt HTTPS tự động.

---

## CHƯƠNG 3: HƯỚNG DẪN TỶ MỶ 8 BƯỚC THIẾT LẬP QUÁN MỚI TỪ CON SỐ 0

Ngay sau khi nhận bàn giao, Chủ quán đăng nhập vào https://munbao.com/login bằng mã PIN 1111 và thực hiện tuần tự 8 bước dưới đây để làm sạch dữ liệu mẫu và thiết lập toàn bộ thông số vận hành thực tế của quán.

### Bước 1: Xóa sạch dữ liệu mẫu (Khởi tạo Quán Mới)

- 1. Đăng nhập https://munbao.com/login bằng mã PIN Chủ quán (1111) -> Hệ thống tự động mở Cổng Chủ quán (/owner).
- 2. Nhìn lên thanh công cụ trên cùng bên phải, bấm vào nút 'Dữ liệu hệ thống' (cạnh nút PostgreSQL 16 và Cài đặt).
- 3. Trong cửa sổ hiện ra, bấm chọn dòng thứ 2: 'Khởi tạo Quán Mới (Xóa dữ liệu mẫu để bán hàng thật)'.
- 4. Bấm nút đỏ 'Xóa dữ liệu mẫu & Bắt đầu bán thật' để xác nhận.
- 5. Kết quả: Toàn bộ hóa đơn mẫu, bàn đang ăn mẫu, đặt bàn mẫu, yêu cầu duyệt mẫu và lịch sử doanh thu 60 ngày mẫu bị xóa sạch về 0. Toàn bộ 22 bàn chuyển về trạng thái Trống, đồng thời mở sẵn Ca thu ngân đầu tiên của ngày hôm nay. Danh mục bàn, thực đơn, túi định lượng và nhân sự được giữ nguyên để bạn chỉnh sửa tiếp ở các bước sau.


### Bước 2: Thiết lập Nhóm 1 - Bàn, Khu vực, Phòng VIP & Đặt bàn trực tuyến (/owner/settings)

- Bấm vào mục 'Cài đặt' trên menu trái -> Chọn nhóm '1. Bàn và đặt chỗ':
- • Thẻ 'Sơ đồ bàn': Dùng chuột kéo thả từng ô bàn (A01..A12, B01..B08, VIP1, VIP2) tới đúng vị trí thực tế ngoài quán. Bấm vào một bàn bất kỳ để sửa nhanh Mã bàn, Số ghế hoặc chuyển đổi giữa 'Bàn thường' và 'Phòng VIP'.
- • Thẻ 'Khu vực và danh sách bàn': Bấm '+ Thêm khu vực' nếu quán có thêm tầng/khu mới (VD: Sân thượng, Hồ bơi). Bấm '+ Thêm bàn' để tạo bàn mới. Lưu ý: Mã bàn không được trùng nhau và bàn đang có khách ngồi sẽ được khóa không cho xóa.
- • Thẻ 'Phòng VIP': Nhập 'Phụ thu phòng VIP mỗi giờ' (VD: 100.000 đ), 'Số phút đầu miễn phụ thu' (VD: 15 phút đầu chờ khách), bật 'Miễn phụ thu khi đạt mức chi tối thiểu' và nhập 'Mức chi tối thiểu phòng VIP' (VD: 3.000.000 đ). Hệ thống sẽ tự động tính phụ thu theo blốc giờ làm tròn lên và tự miễn phí khi tiền món của bàn VIP đạt ngưỡng.
- • Thẻ 'Đặt bàn trực tuyến': Bật cho phép đặt bàn trên cổng /customer, nhập 'Tiền cọc bàn thường' (VD: 200.000 đ), 'Tiền cọc phòng VIP' (VD: 500.000 đ), 'Thời gian giữ bàn chờ cọc' (VD: 30 phút — quá hạn chưa chuyển khoản hệ thống tự hủy giữ chỗ), 'Số phút trễ tính là khách không đến' (VD: 30 phút sau giờ hẹn) và khung giờ nhận khách (10:30 đến 21:30).
- • Thẻ 'Phân công quản bàn & Cảnh báo': Chọn chế độ 'Phân bàn theo nhân viên / khu vực' (mỗi phục vụ chỉ thấy bàn của mình ở tab mặc định) hoặc 'Nhận bàn tự do'; cài đặt thời gian tự chuyển bàn Cần dọn về Trống (10 phút) và ngưỡng cảnh báo món ra chậm (20 phút).


### Bước 3: Thiết lập Nhóm 2 - Thực đơn, Túi định lượng (BOM) & Chính sách Hải sản

- Chọn nhóm '2. Thực đơn và định lượng' trong trang Cài đặt:
- • Thẻ 'Túi định lượng' (Thiết lập trước tiên): Khai báo các loại túi nguyên liệu sơ chế sẵn trong bếp (VD: Túi bò thăn 200g, Túi mực lá 250g, Túi ếch đồng 300g, Túi sườn heo, Gia vị lẩu...). Mỗi túi cần nhập: Tên túi, Nhóm (Thịt & Sơ chế / Rau củ & Gia vị), Đơn vị (túi/phần), Khối lượng (gam), Giá vốn 1 túi (đ) và Mức tồn tối thiểu cảnh báo.
- • Thẻ 'Nhóm món': Tạo các nhóm thực đơn (Khai vị, Món xào - nướng, Lẩu, Hải sản sống, Bia, Rượu - Nước ngọt) và gán đúng 'Nhóm thuế GTGT' ('Đồ ăn - nước ngọt' chịu 8% hoặc 'Rượu bia' chịu 10%).
- • Thẻ 'Kiểu chế biến hải sản': Khai báo các cách chế biến khi khách bắt cá/tôm/cua (Hấp Hồng Kông, Nướng mọi, Nướng muối ớt, Rang me, Rang muối, Sashimi, Nấu lẩu) kèm mức phụ thu chế biến (VD: 0 đ hoặc 30.000 - 50.000 đ/món).
- • Thẻ 'Món ăn và đồ uống': Bấm '+ Thêm món' để thêm hoặc chỉnh sửa từng món theo 4 phân loại:
-    1) Món bếp (dish): Nhập Giá bán, Giá vốn và gắn công thức 'Túi định lượng trừ kho (BOM)' (VD: 1 đĩa Bò lúc lắc trừ 1 Túi bò thăn + 1 phần Gia vị). Khi kho hết túi nguyên liệu, món ăn tự động chuyển sang trạng thái 'Hết' trên máy Phục vụ.
-    2) Hải sản cân ký (seafood): Nhập Giá bán mỗi kg (VD: Cá mú 650.000 đ/kg), Giá vốn mỗi kg (360.000 đ/kg), Số kg trung bình 1 con (VD: 0,95 kg) và Mã tiền tố con cá (VD: CM). Đặt Số kg trung bình < 0,1 kg nếu là hải sản bán theo kg không đếm từng con (như Ốc hương, Nghêu).
-    3) Bia (beer) & Nước - rượu (drink): Nhập Giá bán, Giá vốn, Đơn vị (Lon/Chai) và Hãng bia (để tính thưởng sản lượng Rebate).
- • Thẻ 'Bán hải sản theo Gram & Khách ép giá nguyên con':
-    - Bật 'Cho phép gọi lẻ hải sản theo gram / cắt khúc' và nhập 'Định lượng tối thiểu' (VD: 200g) để khách có thể mua lẻ 500g cá mú nấu lẩu; phần cá còn dư hệ thống tự động trừ lùi và giữ lại trong bể với nhãn '(còn dư)'.
-    - Bật 'Cho phép khách trả giá khi mua nguyên con', đặt 'Biên độ giảm tối đa nhân viên được tự chốt tại bàn' (VD: 5%) và bật 'Chặn tuyệt đối chốt giá thấp hơn giá vốn nhập bể'.


### Bước 4: Thiết lập Nhóm 3 & 4 - Khuyến mãi Bia, PG & Khóa chống thất thoát Kho

- Chọn nhóm '3. Khuyến mãi bia và PG':
- • Thẻ 'Chương trình khuyến mãi': Khai báo các chương trình Mua X Tặng Y (VD: Mua 10 lon Tiger tặng 1 lon, Mua 12 lon Heineken tặng 1 lon), chọn Nguồn chịu chi phí ('Quỹ hãng' — không trừ vào lợi nhuận quán, hoặc 'Quán chịu') và bật 'Thu hồi nắp/vỏ lon' để bắt buộc PG bàn giao đủ nắp cho Thu ngân cuối ca.
- • Thẻ 'Hãng bia và thưởng sản lượng': Nhập chỉ tiêu số thùng cam kết theo Tháng/Quý với từng hãng (Tiger, Heineken, Sài Gòn) và số tiền thưởng hãng trả khi đạt mốc.
- • Thẻ 'PG bia': Nhập hạn mức số lon khuyến mãi tối đa 1 PG được phép bấm tặng trong 1 ca (VD: 24 lon/ca) và tiền hoa hồng PG nhận được trên mỗi thùng bán ra.
- Chọn tiếp nhóm '4. Kho và khóa sổ':
- • Thẻ 'Dung sai kiểm kho': Đặt độ lệch cho phép khi kiểm kho cuối ca (Lệch số con hải sản = 0 con; Hao nước tự nhiên = 3%; Lệch túi định lượng bếp = 2%; Lệch bia nước = 2 lon; Ngưỡng tự duyệt hao hụt nhỏ = 100.000 đ).
- • Thẻ 'Khóa tự động': Bật cả 3 chốt chặn: (1) Khóa bill ngay sau khi in phiếu tạm tính, (2) Kiểm kho mù cuối ca (ẩn hoàn toàn số tồn lý thuyết trên máy Kiosk để nhân viên bắt buộc phải đếm thật), và (3) Tự động khóa sổ ca thu ngân sau giờ đóng cửa.


### Bước 5: Thiết lập Nhóm 5 & 6 - Ca làm, Lương, Tiền Tip, Nhân sự & Phân quyền

- Chọn nhóm '5. Ca làm và lương':
- • Thẻ 'Ca làm': Khai báo giờ bắt đầu và kết thúc của Ca chiều (15:00 - 23:00), Ca gãy hoặc Ca toàn thời gian.
- • Thẻ 'Chấm công và tăng ca': Nhập Số phút đi trễ cho phép (10 phút), Mức phạt đi trễ (2.000 đ/phút), Thời gian dọn dẹp sau bàn cuối (30 phút — nếu nhân viên chấm công ra muộn hơn 30 phút kể từ lúc đóng bàn cuối cùng, phần giờ dôi ra sẽ bị chặn và phải gửi yêu cầu duyệt tăng ca), Hệ số ca đêm (1,3 lần sau 22:00) và Hệ số tăng ca (1,5 lần).
- • Thẻ 'Tính lương & Quy chế chia Tiền Tip': Chọn quy chế chia Tiền Tip mặc định khi khách chuyển khoản dư ('Nhân viên đứng bàn nhận 100%', 'Chia đều toàn ca phục vụ' hoặc 'Chia theo tổ phụ trách khu vực bàn'), số ngày công chuẩn (26 hoặc 30 ngày) và hạn mức cho phép ứng lương (tối đa 50% lương đã tích lũy).
- Chọn tiếp nhóm '6. Nhân viên và phân quyền':
- • Thẻ 'Nhân viên': Bấm '+ Thêm nhân viên' để tạo tài khoản cho từng người, chọn Vai trò, Ca làm, Hình thức trả lương (Lương tháng / Lương giờ), Mức lương cơ bản, chọn Khu vực & Bàn giao phụ trách cố định (đối với Phục vụ) và đặt Mã PIN 4 số. LƯU Ý QUAN TRỌNG: Hãy bấm hiển thị PIN và đổi ngay mã PIN của Chủ quán (1111) sang mã số bí mật của riêng bạn.
- • Thẻ 'Phân quyền theo vai trò': Kiểm tra và điều chỉnh hạn mức tự quyết của 'Thu ngân kiêm Quản lý' (mặc định: tự giảm giá tối đa 10%, tự duyệt hủy món dưới 200.000 đ, tự duyệt hao hụt dưới 300.000 đ, tự duyệt ứng lương dưới 500.000 đ, tự mở khóa bill tối đa 1 lần).


### Bước 6: Thiết lập Nhóm 7 & 8 - Máy in, VietQR, Webhook Ngân hàng & Thuế

- Chọn nhóm '7. Máy in và mẫu bill':
- • Thẻ 'Máy in' & 'Định tuyến phiếu bếp': Khai báo địa chỉ IP / cổng của các máy in nhiệt K80 (Bếp nóng, Bếp nướng - lẩu, Hồ hải sản, Quầy bar, Thu ngân) và chọn 'Máy in dự phòng' cho từng máy (khi máy in bếp mất mạng, phiếu bếp tự động nhảy sang máy in dự phòng để không sót món).
- • Thẻ 'Thông tin quán' & 'Tài khoản nhận VietQR': Điền tên quán, địa chỉ, SĐT, MST, Wi-Fi, chọn Ngân hàng nhận tiền và nhập Số tài khoản + Tên chủ tài khoản.
- • Thẻ 'Cổng thanh toán & Webhook Biến động số dư':
-    - Bật 'Kích hoạt Webhook tự động xác nhận thanh toán QR'.
-    - Đặt Tiền tố mã định danh (VD: QN).
-    - Đường dẫn API nhận Webhook: /api/webhooks/payment (URL đầy đủ cấu hình trên SePay/Casso là https://munbao.com/api/webhooks/payment).
-    - Khóa bảo mật Webhook (API Key / Secret Token): Nhập chuỗi bí mật khớp với SePay/Casso để xác thực gói tin.
- Chọn nhóm '8. Thuế và kế toán':
- • Kiểm tra Thuế suất GTGT Đồ ăn (8%), Rượu bia (10%), Thuế khoán Hộ kinh doanh (4,5% = 3% GTGT + 1,5% TNCN) và chọn Nhà cung cấp Hóa đơn điện tử (Viettel S-Invoice, VNPT Invoice, MISA meInvoice...).
- • Cuối cùng: Bấm nút 'Lưu và áp dụng' ở góc dưới bên phải -> Chọn 'Áp dụng ngay' -> Bấm 'Xác nhận lưu'.


### Bước 7 & Bước 8: Nhập tồn kho đầu kỳ tại Kiosk (/kiosk) & Mở ca Thu ngân (/cashier)

- 1. Đăng nhập https://munbao.com/login bằng mã PIN Hồ cá (6666) hoặc Bếp trưởng (7777) -> Vào Tab 3 'Nhập & Kiểm kho' -> Mục 'Nhập hàng & Cá mới vào bể'.
- 2. Chọn Nhà cung cấp, chọn Người đồng kiểm, lần lượt nhập số lượng ban đầu của từng loại Hải sản sống (hệ thống tự cấp mã từng con cá và số kg như #CM-01 0,95kg), Túi nguyên liệu bếp và Bia/Đồ uống -> Bấm 'Hoàn tất nhập kho'.
- 3. Đăng nhập https://munbao.com/login bằng mã PIN Thu ngân (3333) -> Kiểm tra tiền mặt đầu ca trên màn hình /cashier để bắt đầu đón khách.


---

## CHƯƠNG 4: HƯỚNG DẪN VẬN HÀNH HẰNG NGÀY TỪNG NÚT BẤM CHO 6 VAI TRÒ (SOP)

Phần này mô tả chi tiết thao tác chuẩn hằng ngày cho từng vị trí nhân sự trong quán, đảm bảo luồng dữ liệu chảy khép kín từ lúc khách đặt bàn đến khi khóa sổ cuối ca.

### 4.1. Thao tác chuẩn trên từng Cổng giao diện

| Cổng vai trò | Quy trình thao tác chuẩn từng bước trên màn hình |
| --- | --- |
| 1. Thực khách<br>(/customer) | • Đặt bàn: Chọn Ngày -> Chọn Giờ -> Chọn Số người -> Chọn Khu vực (Sân vườn/Trong nhà/VIP) -> Nhập Tên & SĐT -> Quét mã VietQR chuyển khoản tiền cọc trong thời gian giữ chỗ.<br>• Rượu gửi: Chuyển sang tab 'Rượu gửi' -> Nhập SĐT -> Nhập mã xác thực 6 số -> Xem danh sách chai rượu đang gửi, lượng rượu còn lại (%) và ngày hết hạn.<br>• Xuất hóa đơn VAT: Chuyển sang tab 'Xuất hóa đơn' -> Nhập Mã tra cứu 8 ký tự in ở chân hóa đơn K80 -> Nhập Mã số thuế công ty (bấm 'Tra cứu' để tự điền tên & địa chỉ) + Email kế toán -> Bấm 'Gửi yêu cầu xuất hóa đơn' (trong vòng 24 giờ sau thanh toán). |
| 2. Phục vụ bàn<br>(/waiter) | • Đầu ca: Mở /login -> Nhập PIN (4444..4447) -> Vào tab 'Ca & Lương' bấm 'Chấm công vào ca'.<br>• Mở bàn & Gọi món: Tại tab 'Bàn của tôi', chạm vào bàn trống -> Chọn số khách -> Bấm 'Mở bàn'. Chọn món ăn/đồ uống trong thực đơn.<br>• Gọi Hải sản sống (3 chế độ): Khi chạm vào món Hải sản (VD: Cá mú), cửa sổ thông minh hiện ra 3 lựa chọn:<br>   (1) Bắt nguyên con theo giá niêm yết: Chạm chọn đích danh mã con cá đang bơi trong bể (VD: #CM-02 · 0,92 kg) + chọn Kiểu chế biến -> Giá tiền tự tính chính xác ngay tại bàn.<br>   (2) Gọi lẻ theo Gram (cắt khúc): Chuyển sang chế độ 'Mua theo Gram' -> Nhập số gram khách mua (VD: 500g) + chọn con cá sẽ cắt -> Hệ thống tự trừ 0,50 kg khỏi con cá đó và giữ phần dư trong bể.<br>   (3) Khách trả giá nguyên con: Bật 'Khách trả giá trọn con' -> Nhập mức giá khách muốn chốt. Nếu giảm <= 5%, hệ thống chốt ngay; nếu giảm sâu hơn, đơn tự gắn nhãn chờ Thu ngân/Chủ quán duyệt.<br>• Gửi bếp & Phục vụ: Bấm 'Gửi bếp' -> Món chuyển ngay lên màn hình Kiosk Bếp. Khi món hoàn thành, bấm xác nhận đã bưng ra bàn.<br>• Thu tiền nhanh tại bàn: Bấm nút 'Thanh toán tại bàn' -> Chọn quy chế chia Tip -> Đưa mã VietQR định danh (VD: QN A02 8491) cho khách quét. Khi khách chuyển khoản >= số tiền cần thu, hệ thống tự động báo THANH TOÁN THÀNH CÔNG và tách tiền dư vào quỹ Tip. |
| 3. PG Bia<br>(/pg) | • Mở /login -> Nhập PIN (5555). Trên màn hình hiện danh sách các bàn đang mở.<br>• Chạm vào bàn khách -> Bấm cộng số lượng bia bán ra -> Khi đủ điều kiện khuyến mãi của hãng (VD: đủ 10 lon Tiger), nút 'Tặng bia khuyến mãi' sáng lên để PG bấm tặng (tự động kiểm tra hạn mức tặng trong ca).<br>• Cuối ca: Chuyển sang tab 'Trả nắp cuối ca' -> Kiểm tra tổng số lon đã tặng và bàn giao đủ số nắp/vỏ lon cho Thu ngân đối soát. |
| 4. Bếp & Hồ cá<br>(/kiosk) | • Tab 1 - Đơn bếp & Bể cá: Xem danh sách món chờ chế biến theo thứ tự thời gian (món chờ lâu tự động đổi màu cảnh báo). Bấm 'Hoàn tất & In tem' ngay khi làm xong.<br>• Tab 2 - Báo hỏng nguyên liệu: Chọn nhóm nguyên liệu (Hải sản bể / Thịt sơ chế / Rau củ / Đồ uống) -> Chọn nguyên liệu hoặc đích danh mã con cá bị chết -> Chọn nguyên nhân -> Bấm 'Tải ảnh / Camera' để chụp ảnh thực tế (hoặc 'Chụp nhanh Kiosk') -> Bấm 'Ghi nhận hỏng & Trừ tồn'. Tồn kho trừ ngay lập tức và gửi ảnh lên Chủ quán duyệt.<br>• Tab 3 - Nhập / Kiểm kho: Đầu ca dùng mục 'Nhập hàng & Cá mới vào bể' (bắt buộc chọn người đồng kiểm thứ 2). Cuối ca dùng mục 'Kiểm kho cuối ca' (chế độ Kiểm kho mù ẩn số tồn máy, chỉ nhập số đếm thực tế và bấm Nộp).<br>• Tab 4 - Chấm công: Nhân viên Bếp, Hồ cá, Tạp vụ chọn tên -> Nhập PIN 4 số -> Chụp ảnh khuôn mặt tại Kiosk để vào/ra ca. |
| 5. Thu ngân kiêm Quản lý<br>(/cashier) | • Quản lý bàn & Bill: Chọn bàn trên sơ đồ -> Thêm món, Tách bill, Chuyển bàn hoặc Gộp bàn (khi gộp bàn, toàn bộ mã QR của các bàn phụ được lưu vào mergedPayCodes để khách quét mã cũ hay mới đều khớp).<br>• In tạm tính (Khóa bill): Bấm 'In tạm tính' -> Bill tự động chuyển sang trạng thái ĐÃ KHÓA (chặn sửa/xóa món ngầm). Nếu khách đổi ý trả lại món, Quản lý ca được tự mở khóa tối đa 1 lần kèm lý do; từ lần thứ 2 bắt buộc Chủ quán duyệt.<br>• Duyệt nhanh tại quầy: Tại mục 'Duyệt trong ca', Thu ngân kiêm Quản lý duyệt ngay các yêu cầu hủy món nhỏ, hao hụt nhỏ, khách trả giá cá hoặc ứng lương trong hạn mức được Chủ quán giao.<br>• Thanh toán: Chọn Tiền mặt, Chuyển khoản VietQR hoặc Chia đôi thanh toán (vừa tiền mặt vừa QR). Hỗ trợ chuyển khoản 1 phần (cộng dồn nhiều người chuyển trên cùng 1 bàn) và tự động tách tiền chuyển dư thành Tiền Tip.<br>• Đóng ca & Khóa sổ: Cuối ngày vào tab 'Kết ca & Két tiền' -> Đối soát nắp bia PG -> Nhập số tờ của từng mệnh giá tiền mặt (500k, 200k, 100k...) -> Hệ thống tự tính chênh lệch két và khóa sổ ca. |
| 6. Chủ quán & Kế toán<br>(/owner) | • Tổng quan (/owner/overview): Theo dõi Doanh thu, Giá vốn, Chi phí vận hành và Lợi nhuận ròng thực tế (Net Profit) theo thời gian thực.<br>• Phê duyệt (/owner/approvals): Duyệt hoặc từ chối các yêu cầu vượt hạn mức (Mở khóa bill, Hao hụt nguyên liệu kèm xem ảnh chụp bằng chứng, Ứng lương, Tăng ca sau bàn cuối, Lệch kiểm kho cuối ca — có nút tích 'Trừ lương người kiểm').<br>• Kho & Đối soát (/owner/inventory): Xem bảng Đối soát 4 lớp (Đầu kỳ + Nhập - Bán lý thuyết - Hao hụt đã duyệt = Tồn lý thuyết so với Kiểm thực tế) để phát hiện chính xác khâu nào làm thất thoát.<br>• Nhân sự (/owner/hr) & Thuế (/owner/tax): Xem phiếu lương chi tiết từng nhân viên, bấm 'Xuất CSV bảng lương'; xem bảng kê thuế tách riêng VAT 8% và 10%, bấm 'Xuất bảng kê thuế' và 'Khóa sổ kỳ thuế'.<br>• Quản trị PostgreSQL 16: Bấm nút 'PostgreSQL 16' trên thanh tiêu đề để xem trực tiếp 38 bảng dữ liệu quan hệ và chạy truy vấn SQL chỉ đọc. |

---

## CHƯƠNG 5: SAO LƯU DỮ LIỆU, XỬ LÝ TÌNH HUỐNG & BẢO TRÌ HỆ THỐNG

Để hệ thống vận hành bền bỉ 24/7 tại quán, Chủ quán và kỹ thuật viên cần nắm rõ các thao tác sao lưu, khôi phục và xử lý nhanh các tình huống thực tế dưới đây.

### 5.1. Cẩm nang xử lý nhanh các tình huống thực tế tại quán

| Tình huống phát sinh | Cách xử lý trên hệ thống |
| --- | --- |
| Khách ngồi bàn ghép muốn chia tiền nhiều người chuyển khoản QR riêng lẻ | Phục vụ hoặc Thu ngân chỉ cần mở mã VietQR của bàn đó. Người thứ nhất chuyển một phần (VD: 500.000 đ) -> Hệ thống tự động ghi nhận 'Đã thu 1 phần' và cập nhật số tiền còn thiếu. Người thứ hai chuyển nốt phần còn lại -> Hệ thống tự động cộng dồn và chốt hoàn tất hóa đơn. |
| Khách đã thanh toán tiền mặt xong nhưng một người bạn trong bàn không biết lại quét QR chuyển khoản thêm lần nữa | Hệ thống tự động phát hiện mã định danh thuộc về hóa đơn đã đóng, lập tức chặn không tạo hóa đơn trùng, ghi vào nhật ký 'overpaid_closed_bill' và phát cảnh báo đỏ lên màn hình Thu ngân & Phục vụ để hoàn tiền hoặc ghi nhận Tip. |
| Đã in phiếu tạm tính (Bill bị khóa) nhưng khách trả lại các lon bia chưa khui | Thu ngân bấm nút 'Mở khóa bill' ngay trên màn hình POS -> Nhập lý do 'Khách trả lại bia chưa khui'. Trong lần đầu tiên (nằm trong hạn mức maxSelfUnlockCount = 1), hệ thống mở khóa ngay lập tức để trừ lại số bia và ghi nhận vào nhật ký kiểm toán của Chủ quán. |
| Mất kết nối mạng Internet tạm thời tại quán | Ứng dụng tự động lưu trạng thái dự phòng vào bộ nhớ trình duyệt (localStorage) để không làm gián đoạn thao tác gọi món và tính tiền tại quầy. Ngay khi có mạng trở lại, hệ thống tự động đồng bộ toàn bộ lên PostgreSQL 16. |
| Cần sao lưu (Backup) toàn bộ dữ liệu quán về máy tính cá nhân của Chủ quán | Tại Cổng Chủ quán (/owner), bấm nút 'Dữ liệu hệ thống' -> Chọn 'Xuất toàn bộ dữ liệu (JSON)'. Hệ thống tải về tệp quannhau-du-lieu-YYYY-MM-DD.json chứa toàn bộ cấu hình và lịch sử giao dịch. Khi cần khôi phục, chỉ cần chọn 'Nhập dữ liệu từ tệp JSON'. |

---
