# HƯỚNG DẪN SETUP HỆ THỐNG QUẢN LÝ QUÁN NHẬU (TỪ A ĐẾN Z)

Tài liệu này hướng dẫn chi tiết toàn bộ quy trình từ **cài đặt kỹ thuật (Local & VPS Production)** đến **8 bước thiết lập dữ liệu quán mới từ con số 0** để bàn giao và đưa vào vận hành thực tế.

---

## PHẦN 1: CÀI ĐẶT & CHẠY HỆ THỐNG TRÊN MÁY TÍNH (LOCAL)

### 1.1. Yêu cầu môi trường
* **Hệ điều hành:** Windows 10/11, macOS hoặc Ubuntu/Debian Linux.
* **Python:** Phiên bản `3.10` trở lên (khuyến nghị `Python 3.11` hoặc `3.12`).
* **Cơ sở dữ liệu:** Hệ thống hỗ trợ 2 chế độ tự động:
  1. Kết nối tới **PostgreSQL 16** độc lập thông qua biến môi trường `DATABASE_URL`.
  2. Tự động khởi chạy **PostgreSQL 16 nhúng (`pgserver`)** lưu trữ tại `backend/pgdata/` nếu không truyền `DATABASE_URL` (không cần cài đặt PostgreSQL thủ công trên máy).

### 1.2. Các bước cài đặt và khởi chạy Local
Mở **PowerShell** (trên Windows) hoặc **Terminal** (trên Linux/macOS) tại thư mục gốc `C:\quan_nhau`:

```powershell
# Bước 1: Di chuyển vào thư mục gốc dự án
cd C:\quan_nhau

# Bước 2: Cài đặt các thư viện Backend (FastAPI, Uvicorn, Psycopg2, SQLAlchemy)
pip install -r backend/requirements.txt

# Bước 3: Khởi chạy máy chủ Backend + Giao diện Web + PostgreSQL
python backend/server.py
```

Sau khi chạy lệnh trên, hệ thống lắng nghe tại cổng `8765`:
* **Giao diện ứng dụng (Production Mode):** `http://127.0.0.1:8765/login`
* **Giao diện ứng dụng (Demo Mode - có thanh chuyển nhanh vai trò):** `http://127.0.0.1:8765/login?demo=1`
* **Kiểm tra trạng thái PostgreSQL 16:** `http://127.0.0.1:8765/api/health`
* **Tài liệu Swagger REST API:** `http://127.0.0.1:8765/api/docs`

---

## PHẦN 2: TRIỂN KHAI LÊN MÁY CHỦ VPS LINUX (DOCKER + NGINX + HTTPS)

Hệ thống hiện đã được triển khai hoàn chỉnh tại `https://munbao.com` (`14.225.253.239`, thư mục `/opt/quan_nhau`). Khi cần cài mới sang một VPS khác hoặc bảo trì, thực hiện theo đúng các bước sau:

### 2.1. Cấu trúc thư mục trên VPS (`/opt/quan_nhau`)
```text
/opt/quan_nhau/
├── docker-compose.yml       # Khởi chạy 2 container: quannhau-db (PostgreSQL 16) & quannhau-app (FastAPI)
├── Dockerfile               # Đóng gói môi trường Python 3.11-slim cho Backend
├── backend/
│   ├── server.py            # Máy chủ FastAPI + SSE Real-time + Webhook + SPA Router
│   ├── db.py                # Lớp đồng bộ ACID 38 bảng quan hệ PostgreSQL 16
│   └── requirements.txt
└── web/                     # Toàn bộ mã nguồn Frontend (6 cổng giao diện)
```

### 2.2. Khởi chạy Docker Compose (Độc lập, không ảnh hưởng hệ thống khác trên VPS)
Trên VPS, toàn bộ ứng dụng và CSDL được đóng gói trong mạng nội bộ Docker và chỉ mở cổng nội bộ `127.0.0.1:8765`:

```bash
cd /opt/quan_nhau

# Khởi dựng và chạy ngầm 2 container (quannhau-db và quannhau-app)
docker compose up -d --build

# Kiểm tra trạng thái container
docker ps --filter "name=quannhau"

# Kiểm tra kết nối PostgreSQL 16 qua API
curl -s http://127.0.0.1:8765/api/health
```

### 2.3. Cấu hình Nginx Reverse Proxy & Chứng chỉ SSL (HTTPS)
Tạo tệp cấu hình `/etc/nginx/sites-available/munbao.com` (lưu ý quan trọng: phải có `proxy_buffering off;` để luồng thông báo thời gian thực SSE `/api/events` không bị nghẽn):

```nginx
server {
    listen 80;
    server_name munbao.com www.munbao.com;

    client_max_body_size 20M;

    location / {
        proxy_pass http://127.0.0.1:8765;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Bắt buộc cho Server-Sent Events (SSE) đồng bộ thời gian thực đa thiết bị
        proxy_set_header Connection "";
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 86400s;
    }
}
```

Kích hoạt cấu hình Nginx và cài đặt chứng chỉ SSL miễn phí bằng Certbot:
```bash
ln -sf /etc/nginx/sites-available/munbao.com /etc/nginx/sites-enabled/munbao.com
nginx -t && systemctl reload nginx
certbot --nginx -d munbao.com -d www.munbao.com
```

### 2.4. Các lệnh bảo trì & sao lưu dữ liệu trên VPS
* **Xem log hoạt động thời gian thực:**
  ```bash
  docker logs -f --tail 100 quannhau-app
  ```
* **Sao lưu (Backup) toàn bộ CSDL PostgreSQL 16 ra file `.sql`:**
  ```bash
  docker exec quannhau-db pg_dump -U postgres quan_nhau_os > /opt/quan_nhau/backup_$(date +%F).sql
  ```
* **Khởi động lại ứng dụng sau khi cập nhật file:**
  ```bash
  docker restart quannhau-app
  ```

---

## PHẦN 3: QUY TRÌNH 8 BƯỚC SETUP QUÁN MỚI TỪ ĐẦU (DÀNH CHO CHỦ QUÁN)

Khi bắt đầu áp dụng vào quán thực tế, Chủ quán thực hiện tuần tự **8 bước cấu hình không cần sửa code (No-Code Settings Studio)** dưới đây:

### Bước 1: Đăng nhập Cổng Chủ quán & Xóa dữ liệu mẫu để bắt đầu bán thật
1. Mở trình duyệt truy cập: `https://munbao.com/login`
2. Nhập mã PIN mặc định của Chủ quán: **`1111`** (Hệ thống tự động chuyển vào `https://munbao.com/owner`).
3. Trên thanh công cụ góc trên bên phải, bấm nút **Dữ liệu hệ thống**.
4. Bấm chọn mục **"Khởi tạo Quán Mới (Xóa dữ liệu mẫu để bán hàng thật)"** -> Xác nhận.
   * *Kết quả:* Toàn bộ hóa đơn mẫu, bàn đang ăn mẫu, lịch sử 60 ngày mẫu và yêu cầu duyệt mẫu được xóa sạch về `0`. Sơ đồ bàn, thực đơn, công thức định lượng và danh sách nhân sự được giữ nguyên.

### Bước 2: Cài đặt Thông tin Quán & Tài khoản Ngân hàng nhận VietQR
1. Tại Cổng Chủ quán (`/owner`), vào mục **Cài đặt** (menu bên trái hoặc nút góc trên phải) -> Chọn nhóm **7. Máy in và mẫu bill**.
2. Tại thẻ **Thông tin quán**:
   * Nhập **Tên quán**, **Địa chỉ**, **Số điện thoại hotline**, **Mã số thuế** (10 hoặc 13 số).
   * Nhập **Tên Wi-Fi** và **Mật khẩu Wi-Fi** (tự động in ở chân phiếu tạm tính và hóa đơn K80 cho khách).
   * Nhập **Giờ mở cửa / đóng cửa** và **Lời cảm ơn cuối bill**.
3. Tại thẻ **Tài khoản nhận VietQR**:
   * Chọn **Ngân hàng** (Vietcombank, VietinBank, BIDV, Techcombank, MB, ACB, VPBank...).
   * Nhập **Số tài khoản** và **Tên chủ tài khoản** (viết hoa không dấu).
   * Kiểm tra hình ảnh mã QR xem trước ngay bên cạnh.

### Bước 3: Kết nối Cổng thanh toán & Webhook Biến động số dư (SePay / Casso)
Để khi khách quét mã VietQR tại bàn, hệ thống tự động báo **THANH TOÁN THÀNH CÔNG** trong `< 1 giây` mà nhân viên không cần chụp màn hình chuyển khoản:
1. Vẫn trong nhóm **7. Máy in và mẫu bill**, kéo tới thẻ **Cổng thanh toán & Webhook Biến động số dư**:
   * Bật công tắc **Kích hoạt Webhook tự động xác nhận thanh toán QR**.
   * Đặt **Tiền tố mã định danh** (mặc định: `QN` -> hệ thống tự sinh nội dung chuyển khoản riêng cho từng bill dạng `QN A02 8491`).
   * Đặt **Khóa bảo mật Webhook (`webhookSecret`)**: nhập một chuỗi mật khẩu bí mật (ví dụ: `QN_SECRET_2026`).
   * Bật **Tự động đóng bill khi số tiền nhận >= mức thanh toán** và **Tự động ghi nhận phần tiền chuyển dư làm Tiền Tip**.
2. Đăng nhập tài khoản **SePay.vn** hoặc **Casso.vn** của quán:
   * Cấu hình URL nhận Webhook: `https://munbao.com/api/webhooks/payment`
   * Điền Khóa bảo mật (`Authorization: Apikey QN_SECRET_2026` hoặc Header `X-Webhook-Secret: QN_SECRET_2026`).

### Bước 4: Thiết lập Khu vực, Sơ đồ Bàn & Chính sách Phòng VIP / Đặt bàn
Chuyển sang nhóm **1. Bàn và đặt chỗ** trong trang **Cài đặt**:
1. **Khu vực và danh sách bàn:** Thêm/sửa các khu vực (VD: *Sân vườn*, *Trong nhà*, *Phòng VIP*) và danh sách bàn (`A01`..`A12`, `B01`..`B08`, `VIP1`, `VIP2`), số ghế và loại bàn (Bàn thường / Phòng VIP).
2. **Sơ đồ bàn trực quan:** Kéo thả từng bàn tới đúng vị trí thực tế của quán để Phục vụ và Thu ngân nhìn sơ đồ nhận diện ngay.
3. **Phòng VIP:** Cài đặt **Phụ thu phòng VIP mỗi giờ** (VD: `100.000 đ/giờ`), **Số phút đầu miễn phụ thu** (VD: `15 phút`), và **Mức chi tối thiểu miễn phụ thu** (VD: bill trên `3.000.000 đ` tự động miễn phí phòng VIP).
4. **Đặt bàn trực tuyến:** Cài đặt số tiền cọc bàn thường (VD: `200.000 đ`), tiền cọc phòng VIP (`500.000 đ`), thời gian giữ chỗ chờ chuyển khoản cọc (`30 phút`) và số phút quá hẹn tính là khách không đến (`No-Show`).

### Bước 5: Thiết lập Thực đơn, Định mức Nguyên liệu (BOM) & Chính sách Hải sản
Chuyển sang nhóm **2. Thực đơn và định lượng**:
1. **Túi định lượng (`bags`):** Khai báo các loại túi nguyên liệu sơ chế sẵn trong bếp (VD: *Túi bò thăn 200g*, *Túi mực lá 250g*, *Túi ếch 300g*, *Gia vị lẩu*...) kèm giá vốn và mức tồn tối thiểu cảnh báo hết hàng.
2. **Nhóm món & Kiểu chế biến hải sản:** Khai báo nhóm món (gắn nhóm thuế GTGT Đồ ăn `8%` hoặc Rượu bia `10%`) và các kiểu chế biến hải sản (*Hấp Hồng Kông*, *Nướng mọi*, *Rang me*, *Sashimi*... kèm phụ thu chế biến nếu có).
3. **Món ăn và đồ uống (`menu`):**
   * Với **Món bếp (`dish`):** Nhập giá bán, giá vốn và gắn công thức **Định mức túi nguyên liệu (BOM)** để mỗi khi bán 1 đĩa, kho bếp tự trừ đúng số túi và tự báo hết món khi nguyên liệu cạn.
   * Với **Hải sản sống cân ký (`seafood`):** Nhập giá bán/kg, giá vốn/kg, trọng lượng trung bình 1 con và tiền tố mã cá (`CM` cho Cá mú, `TH` cho Tôm hùm...).
   * Với **Bia & Đồ uống (`beer` / `drink`):** Nhập giá bán, giá vốn, đơn vị tính (Lon / Chai / Thùng).
4. **Chính sách Bán hải sản theo Gram & Khách ép giá nguyên con:**
   * Bật/tắt cho phép khách mua lẻ theo gram (cắt khúc nấu lẩu/nướng, phần dư tự động lưu lại bể).
   * Cài đặt **Biên độ giảm tối đa nhân viên được tự chốt tại bàn** khi khách trả giá mua nguyên con (VD: Phục vụ tự giảm tối đa `5%`, Thu ngân kiêm Quản lý tự duyệt tối đa `15%`, vượt quá phải đẩy lên Chủ quán duyệt; chặn tuyệt đối bán dưới giá vốn).

### Bước 6: Thiết lập Khuyến mãi Bia, Thưởng Hãng (Rebate) & Chỉ tiêu PG
Chuyển sang nhóm **3. Khuyến mãi bia và PG**:
1. **Chương trình khuyến mãi:** Cấu hình các chương trình như *Mua 10 tặng 1* (Tiger, Heineken), chọn nguồn chịu chi phí (*Quỹ hãng* hoặc *Quán chịu*) và bật **Bắt buộc thu hồi nắp/vỏ lon khuyến mãi** cuối ca.
2. **Hãng bia và thưởng sản lượng:** Nhập chỉ tiêu sản lượng tháng/quý cam kết với từng hãng bia và số tiền thưởng (Rebate) để hệ thống tự động theo dõi tiến độ đạt thưởng.
3. **Chỉ tiêu & Hoa hồng PG:** Cài đặt hạn mức lon tặng tối đa mỗi ca của PG và mức hoa hồng trên mỗi lon/thùng bán ra.

### Bước 7: Thiết lập Ca làm việc, Nhân viên, Mã PIN & Phân quyền
Chuyển sang nhóm **5. Ca làm và lương** và **6. Nhân viên và phân quyền**:
1. **Ca làm việc & Chấm công:** Khai báo giờ vào/ra của từng ca (Ca sáng, Ca chiều, Ca gãy), số phút đi trễ cho phép, tiền phạt đi trễ mỗi phút, thời gian dọn dẹp tối đa sau khi đóng bàn cuối cùng (`cleanupBuffer`, mặc định `30 phút`) và hệ số lương tăng ca / ca đêm.
2. **Quy chế chia Tiền Tip mặc định:** Chọn 1 trong 3 chế độ:
   * `Cá nhân (personal)`: Nhân viên đứng bàn hưởng 100%.
   * `Chia đều toàn ca (pool)`: Chia đều cho tất cả phục vụ đang trong ca.
   * `Chia theo tổ khu vực (area)`: Chia cho nhóm phục vụ phụ trách khu vực đó.
3. **Danh sách Nhân viên & Mã PIN:**
   * Thêm nhân viên thực tế của quán, chọn vai trò (*Chủ quán*, *Kế toán*, *Thu ngân kiêm Quản lý*, *Phục vụ*, *PG Bia*, *Hồ cá*, *Bếp*, *Tạp vụ*), mức lương và **cấp mã PIN 4 số riêng cho từng người**.
   * **Lưu ý bảo mật:** Đổi ngay mã PIN mặc định của Chủ quán (`1111`) và Thu ngân (`3333`) sang mã PIN bí mật của riêng quán.
   * Gán khu vực / bàn phụ trách cố định cho từng nhân viên Phục vụ.
4. **Lưu cấu hình:** Bấm nút **"Lưu và áp dụng"** ở thanh dưới cùng và chọn **Áp dụng ngay lập tức**.

### Bước 8: Nhập Kho / Bể Hải sản Đầu kỳ & Mở Ca Thu ngân Đầu tiên
1. **Nhập hàng vào Kho bếp & Bể hải sản (`/kiosk`):**
   * Đăng nhập `/login` bằng PIN Phụ trách Hồ cá (`6666`) hoặc Bếp trưởng (`7777`) -> Hệ thống mở `/kiosk`.
   * Chọn Tab 3 **Nhập & Kiểm kho** -> Mục **Nhập hàng & Cá mới vào bể**.
   * Chọn nhà cung cấp, chọn người chứng kiến đồng kiểm, nhập số lượng túi nguyên liệu bếp, số lượng bia/nước ngọt và số con + số kg từng loại hải sản sống (hệ thống tự động sinh mã từng con cá trong bể như `#CM-01`, `#CM-02`...).
2. **Mở ca Thu ngân (`/cashier`):**
   * Đăng nhập `/login` bằng PIN Thu ngân kiêm Quản lý (`3333`) -> Hệ thống mở `/cashier`.
   * Kiểm tra số **Tiền mặt đầu ca** trong két (mặc định `2.000.000 đ`), sẵn sàng đón khách và mở bàn.

---

## PHẦN 4: BỐ TRÍ THIẾT BỊ TẠI QUÁN & ĐƯỜNG DẪN TRUY CẬP

Hệ thống là **Web App đa nền tảng (Responsive PWA)**, không cần cài đặt phần mềm phức tạp. Tại mỗi vị trí trong quán, chỉ cần mở trình duyệt (Chrome / Safari / Edge) và chọn **"Thêm vào màn hình chính" (Add to Home Screen)**:

| Bộ phận sử dụng | Thiết bị khuyên dùng | Đường dẫn truy cập | Chức năng chính |
| :--- | :--- | :--- | :--- |
| **Thực khách** | Điện thoại của khách (quét QR tại cổng/trên bill) | `https://munbao.com/customer` | Đặt bàn trực tuyến, chuyển khoản đặt cọc VietQR, tra cứu thẻ rượu gửi (OTP), tự nhập MST xuất hóa đơn điện tử VAT trong 24h. |
| **Nhân viêntất cả bộ phận** | Điện thoại / Tablet / Máy POS | `https://munbao.com/login` | Nhập mã PIN 4 số cá nhân để hệ thống tự động mở đúng màn hình công việc được phân quyền. |
| **Phục vụ bàn** | Điện thoại cá nhân hoặc máy tính bảng | `https://munbao.com/waiter` | Chấm công vào ca, mở bàn, gọi món, chọn đích danh con cá trong bể (hoặc gọi theo gram / trả giá), tạo thẻ rượu gửi, bật mã VietQR định danh thu tiền tại bàn. |
| **PG Bia** | Điện thoại cá nhân của PG | `https://munbao.com/pg` | Thêm bia vào bàn, áp dụng khuyến mãi Mua X Tặng Y của hãng, theo dõi tiến độ sản lượng & hoa hồng, bàn giao nắp/vỏ lon cuối ca. |
| **Bếp & Hồ hải sản** | Máy tính bảng cảm ứng treo tường (Kiosk) | `https://munbao.com/kiosk` | Nhận đơn bếp & đơn bắt cá thời gian thực, xác nhận cân ký & in tem hải sản, báo hỏng nguyên liệu (chụp ảnh bằng chứng từ Camera), nhập hàng đồng kiểm, kiểm kho mù cuối ca, chấm công Kiosk. |
| **Thu ngân kiêm Quản lý ca** | Máy tính / Máy POS màn hình cảm ứng tại quầy + Máy in nhiệt K80 | `https://munbao.com/cashier` | Mở/đóng bàn, tách/gộp bill, in tạm tính (tự khóa bill), thu tiền mặt / VietQR / chia đôi thanh toán, duyệt nhanh yêu cầu trong hạn mức, chi tiền lẻ/ứng lương/trả Tip, đối soát nắp bia PG, đếm tiền mặt theo mệnh giá và khóa sổ cuối ca. |
| **Chủ quán & Kế toán** | Laptop hoặc Điện thoại từ xa | `https://munbao.com/owner` | Xem bảng điều khiển lãi lỗ thực (Net Profit) thời gian thực, duyệt các ngoại lệ vượt hạn mức, xem đối soát tồn kho 4 lớp, xuất bảng lương CSV, xuất tờ khai thuế GTGT/HKD, quản trị trực tiếp 38 bảng PostgreSQL 16 và cài đặt toàn bộ quy tắc của quán. |
