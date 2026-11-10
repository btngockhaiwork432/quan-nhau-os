# Quán Nhậu OS — Hệ thống Quản lý & Vận hành Quán Nhậu - Hải Sản (Full-Stack ERP)

Hệ thống vận hành khép kín dành cho mô hình **Quán Nhậu - Hải Sản sống**, bao gồm **6 cổng giao diện chuyên biệt theo vai trò**, đồng bộ thời gian thực qua **Server-Sent Events (SSE)** và lưu trữ toàn vẹn ACID trên **38 bảng quan hệ PostgreSQL 16**.

* **Hệ thống Production đang chạy tại:** [https://munbao.com](https://munbao.com)
* **Trang đăng nhập PIN nhân viên:** [https://munbao.com/login](https://munbao.com/login)
* **Cổng Thực khách (Đặt bàn / Rượu gửi / Xuất HĐ VAT):** [https://munbao.com/customer](https://munbao.com/customer)
* **Chế độ Kiểm thử nhanh cho QA/Dev (bật thanh chuyển vai trò):** [https://munbao.com/login?demo=1](https://munbao.com/login?demo=1)
* **Tài liệu Swagger REST API:** [https://munbao.com/api/docs](https://munbao.com/api/docs)

---

## 1. Tài liệu quan trọng trong Repository

1. **[THONG_TIN_VPS_VA_HUONG_DAN_DEV.md](./THONG_TIN_VPS_VA_HUONG_DAN_DEV.md):** Thông tin chi tiết máy chủ VPS (`14.225.253.239`), tài khoản SSH, cấu trúc Docker (`quannhau-app` & `quannhau-db`), và hướng dẫn sửa code / deploy cho Developer.
2. **[So_Tay_Huong_Dan_Danh_Cho_Chu_Quan.docx](./So_Tay_Huong_Dan_Danh_Cho_Chu_Quan.docx)** ([bản `.md`](./So_Tay_Huong_Dan_Danh_Cho_Chu_Quan.md)): Sổ tay hướng dẫn thiết lập và quản lý quán dành riêng cho Chủ quán (100% ngôn ngữ nghiệp vụ, không có thuật ngữ kỹ thuật).
3. **[Bo_Kich_Ban_Test_Va_Doi_Chieu_So_Lieu_QA.docx](./Bo_Kich_Ban_Test_Va_Doi_Chieu_So_Lieu_QA.docx)** ([bản `.md`](./Bo_Kich_Ban_Test_Va_Doi_Chieu_So_Lieu_QA.md)): Bộ kịch bản kiểm thử (Test Cases) và công thức đối chiếu số liệu từng đồng dành cho Team Test / QA.
4. **[Tai_Lieu_Giai_Thich_Toan_Bo_Logic_He_Thong_Quan_Nhau.docx](./Tai_Lieu_Giai_Thich_Toan_Bo_Logic_He_Thong_Quan_Nhau.docx)** ([bản `.md`](./Tai_Lieu_Giai_Thich_Toan_Bo_Logic_He_Thong_Quan_Nhau.md)): Giải thích chi tiết toàn bộ 12 khâu logic nghiệp vụ & kỹ thuật của hệ thống.
5. **Thư mục [`docs/`](./docs/) & [`bpmn_drawio/`](./bpmn_drawio/):** Hồ sơ phân tích nghiệp vụ, 10 sơ đồ BPMN 2.0 chuẩn hóa (`5 AS-IS` + `5 TO-BE`) và đặc tả thiết kế hệ thống.

---

## 2. Danh sách Mã PIN Mặc định

| Vai trò | Tên nhân sự | Mã PIN | Đường dẫn sau đăng nhập |
| :--- | :--- | :---: | :--- |
| **Chủ quán (Toàn quyền)** | Nguyễn Văn Chủ | **`1111`** | `/owner` |
| **Kế toán** | Lê Thị Kế Toán | **`2222`** | `/owner` |
| **Thu ngân kiêm Quản lý ca** | Trần Minh Thu | **`3333`** | `/cashier` |
| **Phục vụ bàn (A01-A06)** | Phạm Thị Lan | **`4444`** | `/waiter` |
| **Phục vụ bàn (A07-A12)** | Đỗ Văn Nam | **`4445`** | `/waiter` |
| **Phục vụ bàn (B01-B04, VIP1)** | Vũ Thị Hoa | **`4446`** | `/waiter` |
| **Phục vụ bàn (B05-B08, VIP2)** | Bùi Minh Đức | **`4447`** | `/waiter` |
| **PG Bia** | Ngô Thanh Thảo | **`5555`** | `/pg` |
| **Phụ trách Hồ hải sản** | Hoàng Văn Long | **`6666`** | `/kiosk` |
| **Bếp trưởng** | Đinh Văn Sơn | **`7777`** | `/kiosk` |
| **Tạp vụ** | Lý Thị Mai | **`8888`** | `/kiosk` |

---

## 3. Khởi chạy Nhanh cho Developer

```bash
# 1. Cài đặt thư viện
pip install -r backend/requirements.txt

# 2. Chạy server tại http://127.0.0.1:8765
python backend/server.py

# 3. Deploy các thay đổi lên VPS https://munbao.com
python deploy_vps.py
```
