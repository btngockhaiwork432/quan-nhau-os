# THÔNG TIN MÁY CHỦ VPS & HƯỚNG DẪN DÀNH CHO DEVELOPER SỬA CODE

> **CẢNH BÁO QUAN TRỌNG KHI THAO TÁC TRÊN VPS:**
> Trên VPS `14.225.253.239` hiện đang chạy **nhiều hệ thống và dự án khác nhau**.
> Khi sửa code hoặc deploy dự án **Quán Nhậu OS (`munbao.com`)**:
> 1. **CHỈ** thao tác trong thư mục `/opt/quan_nhau`.
> 2. **CHỈ** tác động tới 2 Docker container có tên `quannhau-app` và `quannhau-db`.
> 3. **TUYỆT ĐỐI KHÔNG** chạy các lệnh xóa toàn cục như `docker system prune`, `docker stop $(docker ps -q)`, không xóa các file cấu hình Nginx của các tên miền khác trong `/etc/nginx/sites-enabled/`.

---

## 1. Thông tin Kết nối Máy chủ VPS Production

| Hạng mục | Giá trị cấu hình |
| :--- | :--- |
| **Tên miền chính thức (HTTPS)** | `https://munbao.com` |
| **Địa chỉ IP VPS (Linux Ubuntu)** | `14.225.253.239` |
| **Cổng SSH (Port)** | `22` |
| **Tài khoản SSH (Username)** | `root` |
| **Mật khẩu SSH (Password)** | `2W5K12HgoaOPVaaSr5iT` |
| **Thư mục chứa mã nguồn trên VPS** | `/opt/quan_nhau` |
| **Container Backend + Web (FastAPI)** | `quannhau-app` (chạy cổng nội bộ `127.0.0.1:8765`) |
| **Container Cơ sở dữ liệu (PostgreSQL 16)** | `quannhau-db` (Volume lưu trữ: `quannhau_pgdata`) |
| **Chuỗi kết nối PostgreSQL nội bộ** | `postgresql://postgres:quannhau2026@quannhau-db:5432/quan_nhau_os` |
| **File cấu hình Nginx của dự án** | `/etc/nginx/sites-available/munbao.com` |

---

## 2. Cấu trúc Thư mục Mã nguồn Dự án

```text
quan_nhau/
├── backend/
│   ├── server.py                # FastAPI Server: REST API (/api/*), SSE Real-time (/api/events), Webhook (/api/webhooks/payment), SPA Router
│   ├── db.py                    # Đồng bộ ACID 38 bảng quan hệ PostgreSQL 16 + SQL Query Engine
│   ├── schema.sql               # DDL khởi tạo 38 bảng PostgreSQL 16
│   └── requirements.txt         # Thư viện Python Backend
├── web/
│   ├── index.html               # Entrypoint SPA (Mặc định Production Mode: body.no-demo)
│   ├── css/
│   │   ├── app.css              # Design System & Layout chung
│   │   ├── customer.css         # Giao diện Cổng Thực khách
│   │   ├── pg.css               # Giao diện Cổng PG Bia
│   │   ├── kiosk.css            # Giao diện Kiosk Bếp & Hồ hải sản
│   │   ├── cashier.css          # Giao diện Máy Thu ngân POS
│   │   ├── owner.css            # Giao diện Cổng Chủ quán & Kế toán
│   │   └── settings.css         # Giao diện No-Code Settings Studio
│   └── js/
│       ├── core/
│       │   ├── util.js          # Hàm tiện ích định dạng tiền tệ, ngày giờ, CSV
│       │   ├── store.js         # State Store + Đồng bộ thời gian thực PostgreSQL 16 & SSE
│       │   ├── engine.js        # Toàn bộ Logic Nghiệp vụ lõi (Order, Hải sản, Kho 4 lớp, Lương, Thuế, Webhook)
│       │   ├── ui.js            # Component UI dùng chung (Modal, Numpad, VietQR, K80 Receipt)
│       │   └── app.js           # Bộ định tuyến HTML5 History (/login, /customer, /owner...) & Phân quyền PIN
│       └── portals/
│           ├── customer.js      # Cổng 1: Thực khách (/customer)
│           ├── waiter.js        # Cổng 2: Phục vụ bàn (/waiter)
│           ├── pg.js            # Cổng 3: PG Bia (/pg)
│           ├── kiosk.js         # Cổng 4: Kiosk Bếp & Hồ cá (/kiosk)
│           ├── cashier.js       # Cổng 5: Thu ngân kiêm Quản lý ca (/cashier)
│           ├── owner.js         # Cổng 6: Chủ quán & Kế toán (/owner)
│           └── owner-settings.js# Cổng 6B: Cài đặt hệ thống 8 nhóm (/owner/settings)
├── docs/                        # Trọn bộ tài liệu Word (.docx) bàn giao (Nghiệp vụ, BPMN, Chủ quán, QA Test)
├── bpmn_drawio/                 # 5 sơ đồ BPMN 2.0 TO-BE (.drawio)
├── bpmn_drawio_as_is/           # 5 sơ đồ BPMN 2.0 AS-IS (.drawio)
├── Dockerfile                   # Dockerfile cho container quannhau-app
├── docker-compose.yml           # Docker Compose cho quannhau-db & quannhau-app
├── nginx/munbao.com.conf        # Cấu hình Nginx Reverse Proxy + SSL + SSE
└── deploy_vps.py                # Script tự động đẩy code lên VPS bằng 1 lệnh
```

---

## 3. Quy trình Chạy Thử Local & Đẩy Code Lên VPS Khi Sửa Code

### Bước 1: Clone repo về máy và chạy thử Local
```bash
git clone https://github.com/btngockhaiwork432/quan-nhau-os.git
cd quan-nhau-os
pip install -r backend/requirements.txt
python backend/server.py
```
* Mở `http://127.0.0.1:8765/login` (Chế độ Production thật — nhập PIN `1111` cho Chủ quán, `3333` cho Thu ngân, `4444` cho Phục vụ).
* Mở `http://127.0.0.1:8765/login?demo=1` nếu muốn bật thanh chuyển nhanh giữa 6 vai trò để test giao diện.

### Bước 2: Đẩy code mới sửa lên VPS (`https://munbao.com`)

**Cách 1 — Chạy 1 lệnh tự động từ máy tính của Developer:**
```bash
pip install paramiko
python deploy_vps.py
```
*(Script `deploy_vps.py` sẽ tự động tải `backend/` và `web/` lên `/opt/quan_nhau`, cập nhật vào container `quannhau-app`, khởi động lại `quannhau-app` và kiểm tra `/api/health`).*

**Cách 2 — Kéo code từ Git trực tiếp trên VPS qua SSH:**
```bash
ssh root@14.225.253.239
# Nhập mật khẩu: 2W5K12HgoaOPVaaSr5iT

cd /opt/quan_nhau
git pull origin main
docker cp /opt/quan_nhau/web/. quannhau-app:/app/web/
docker cp /opt/quan_nhau/backend/. quannhau-app:/app/backend/
docker restart quannhau-app
```

---

## 4. Các Lệnh Quản trị Cơ sở dữ liệu PostgreSQL 16 trên VPS

* **Truy cập trực tiếp vào `psql` của PostgreSQL 16 trên VPS:**
  ```bash
  docker exec -it quannhau-db psql -U postgres -d quan_nhau_os
  ```
* **Sao lưu (Backup) toàn bộ CSDL ra file `.sql`:**
  ```bash
  docker exec quannhau-db pg_dump -U postgres quan_nhau_os > /opt/quan_nhau/backup_$(date +%F).sql
  ```
* **Xem log thời gian thực của Backend FastAPI:**
  ```bash
  docker logs -f --tail 100 quannhau-app
  ```
