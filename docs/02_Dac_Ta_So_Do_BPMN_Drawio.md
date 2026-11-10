# Đặc Tả Hệ Thống 10 Sơ Đồ BPMN 2.0 Quán Nhậu Hải Sản Trên Draw.io: Đối Chiếu Trước Khi Lên Hệ Thống (`AS-IS`) & Sau Khi Lên Hệ Thống (`TO-BE`)

Tài liệu này đặc tả trọn bộ **10 sơ đồ BPMN 2.0 trên Draw.io** (gồm **5 sơ đồ `AS-IS` trước khi lên hệ thống** và **5 sơ đồ `TO-BE` sau khi lên hệ thống Website 6 Role + PostgreSQL 16**), tuân thủ tuyệt đối các nguyên tắc trong [BPMN.pptx](file:///C:/quan_nhau/BPMN.pptx):

1. **Mỗi quy trình chỉ có đúng 1 Pool duy nhất (`Single-Pool Process`)**:
   - Toàn bộ 10 sơ đồ (`5 AS-IS` + `5 TO-BE`) đều chỉ sử dụng **đúng 1 Pool duy nhất** cho mỗi quy trình, bên trong chia thành các **Swimlanes (Lanes)** theo từng vai trò tham gia.
   - **Tách chi tiết từng bước trong mỗi Lane (`Atomic Tasks`)**: Không gộp chung nhiều việc vào một ô; mỗi bước thủ công (`[Manual Task]` ở `AS-IS`) hoặc bước hệ thống (`[User Task]`, `[Service Task]`, `[Business Rule]`, `[Script Task]`, `[Transaction]` ở `TO-BE`) đều được vẽ tách bạch và nối tiếp rõ ràng.
2. **Sử dụng đầy đủ bộ ký hiệu BPMN 2.0 nâng cao (`Table 10.93`)**:
   - Đầy đủ **`Timer Event`**, **`Link Event [Throw/Catch]`** (`LINK A`, `LINK B`, `LINK C`, `LINK PAY`), **`Signal Event`**, **`Escalation Event`**, **`Error Event`**, **`Compensation Event`**, **`Conditional Event`**, **`Terminate End`** và **`Cancel End`**.
3. **Đối chiếu trực diện Hiện trạng Thủ công (`AS-IS`) và Giải pháp Hệ thống (`TO-BE`)**:
   - Trên 5 sơ đồ `AS-IS`, mọi lỗ hổng thất thoát, nghẽn cổ chai và sai sót thủ công đều được gắn nhãn **`[ĐIỂM NGHẼN / RỦI RO AS-IS]`** màu đỏ để đối chiếu 1–1 với cơ chế tự động hóa trên 5 sơ đồ `TO-BE`.

---

## 1. Danh Sách Các File Draw.io (`AS-IS` & `TO-BE`)

### A. File Tổng Hợp Đa Tab Trên Draw.io
1. **File Tổng Hợp Trọn Bộ 10 Tab (5 Tab `AS-IS` + 5 Tab `TO-BE` trong 1 file):**
   - [He_Thong_Quan_Nhau_BPMN_Toan_Tap.drawio](file:///C:/quan_nhau/He_Thong_Quan_Nhau_BPMN_Toan_Tap.drawio)
2. **File Tổng Hợp Riêng 5 Tab `AS-IS` (Trước khi lên hệ thống - Quy trình thủ công):**
   - [He_Thong_Quan_Nhau_BPMN_AS_IS_Thu_Cong.drawio](file:///C:/quan_nhau/He_Thong_Quan_Nhau_BPMN_AS_IS_Thu_Cong.drawio)
3. **Gói nén toàn bộ các sơ đồ Draw.io:**
   - [bpmn_drawio.zip](file:///C:/quan_nhau/bpmn_drawio.zip)

### B. Bộ 5 Sơ Đồ `AS-IS` — Trước Khi Lên Hệ Thống (`C:\quan_nhau\bpmn_drawio_as_is\`)
1. **AS-IS 00 — Tổng Quan Vận Hành Thủ Công Trước Khi Lên Hệ Thống:** [00_AS_IS_Tong_Quan_Thu_Cong_Truoc_He_Thong.drawio](file:///C:/quan_nhau/bpmn_drawio_as_is/00_AS_IS_Tong_Quan_Thu_Cong_Truoc_He_Thong.drawio) *(1 Pool duy nhất | 6 Swimlanes | 78 phần tử BPMN)*
2. **AS-IS 01 — Đặt Bàn Sổ Tay, Ghi Order Giấy 2 Liên, Cân Cá Thủ Công & Xuất/Trả Bia Thùng Không Phiếu:** [01_AS_IS_Dat_Ban_Order_Giay_Bep_HaiSan_Bia.drawio](file:///C:/quan_nhau/bpmn_drawio_as_is/01_AS_IS_Dat_Ban_Order_Giay_Bep_HaiSan_Bia.drawio) *(1 Pool duy nhất | 6 Swimlanes | 62 phần tử BPMN)*
3. **AS-IS 02 — Tính Tiền Cộng Tay, Gạch Xóa Tạm Tính, Chụp Ảnh Chuyển Khoản Gửi Zalo & Mất Tip:** [02_AS_IS_Tinh_Tien_Thu_Cong_Chup_Bill_Zalo.drawio](file:///C:/quan_nhau/bpmn_drawio_as_is/02_AS_IS_Tinh_Tien_Thu_Cong_Chup_Bill_Zalo.drawio) *(1 Pool duy nhất | 5 Swimlanes | 43 phần tử BPMN)*
4. **AS-IS 03 — Nhập Hàng Sổ Tay, Đồ Hỏng Tự Vứt Bỏ & Kiểm Kho Giấy Không Đối Soát 4 Lớp:** [03_AS_IS_Nhap_Hang_So_Tay_Hao_Hut_Kiem_Kho.drawio](file:///C:/quan_nhau/bpmn_drawio_as_is/03_AS_IS_Nhap_Hang_So_Tay_Hao_Hut_Kiem_Kho.drawio) *(1 Pool duy nhất | 5 Swimlanes | 35 phần tử BPMN)*
5. **AS-IS 04 — Đếm Két Sổ Tay, Viết Giấy Hẹn Hóa Đơn VAT & Nhập Lại Bill Vào Excel Tính Lương/P&L:** [04_AS_IS_Ket_Tien_So_Giay_Thue_Va_Luong_Excel.drawio](file:///C:/quan_nhau/bpmn_drawio_as_is/04_AS_IS_Ket_Tien_So_Giay_Thue_Va_Luong_Excel.drawio) *(1 Pool duy nhất | 4 Swimlanes | 26 phần tử BPMN)*

### C. Bộ 5 Sơ Đồ `TO-BE` — Sau Khi Lên Hệ Thống Website & PostgreSQL 16 (`C:\quan_nhau\bpmn_drawio\`)
1. **TO-BE 00 — Tổng Quan Hệ Thống Tự Động Hóa A–Z:** [00_BPMN_Tong_Quan_He_Thong_A_Z.drawio](file:///C:/quan_nhau/bpmn_drawio/00_BPMN_Tong_Quan_He_Thong_A_Z.drawio) *(1 Pool duy nhất | 7 Swimlanes | 110 phần tử BPMN)*
2. **TO-BE 01 — Đặt Bàn Cọc QR, Gọi Hải Sản (Nguyên Con Ép Giá / Cắt Lẻ Gram) & Xuất Bia Nguyên Thùng / Trả Bia Dư:** [01_BPMN_Dat_Ban_Order_Bep_HaiSan_Bia.drawio](file:///C:/quan_nhau/bpmn_drawio/01_BPMN_Dat_Ban_Order_Bep_HaiSan_Bia.drawio) *(1 Pool duy nhất | 6 Swimlanes | 100 phần tử BPMN)*
3. **TO-BE 02 — Phân Quyền 2 Tầng, Khóa Bill, Thanh Toán Nhanh VietQR Định Danh & Webhook Chia Tip:** [02_BPMN_Thanh_Toan_VIP_Va_Khoa_Bill.drawio](file:///C:/quan_nhau/bpmn_drawio/02_BPMN_Thanh_Toan_VIP_Va_Khoa_Bill.drawio) *(1 Pool duy nhất | 6 Swimlanes | 86 phần tử BPMN)*
4. **TO-BE 03 — Kiosk Bếp & Hồ Cá (Nhập Cá Theo Con, Báo Hỏng Nguyên Liệu, Thu Hồi Nắp Bia KM & Đối Soát 4 Lớp):** [03_BPMN_Nhap_Kho_Ton_That_Kiem_Mu_Doi_Soat.drawio](file:///C:/quan_nhau/bpmn_drawio/03_BPMN_Nhap_Kho_Ton_That_Kiem_Mu_Doi_Soat.drawio) *(1 Pool duy nhất | 6 Swimlanes | 62 phần tử BPMN)*
5. **TO-BE 04 — Xuất HĐĐT GTGT (8% & 10%), Chốt Ca Z-Report, Bảng Lương & Báo Cáo Lãi Lỗ P&L:** [04_BPMN_In_Bill_HDDT_Thue_Va_Khoa_So_Odoo.drawio](file:///C:/quan_nhau/bpmn_drawio/04_BPMN_In_Bill_HDDT_Thue_Va_Khoa_So_Odoo.drawio) *(1 Pool duy nhất | 5 Swimlanes | 50 phần tử BPMN)*

---

## 2. Bảng Đối Chiếu Chi Tiết Quy Trình Trước Khi Lên Hệ Thống (`AS-IS`) vs. Sau Khi Lên Hệ Thống (`TO-BE`)

| Nghiệp Vụ Cốt Lõi | Trước Khi Lên Hệ Thống (`AS-IS` — Thủ Công) | Sau Khi Lên Hệ Thống (`TO-BE` — Website 6 Role + PostgreSQL 16) |
| :--- | :--- | :--- |
| **1. Đặt bàn trước & Quản lý Rượu gửi** | • Ghi lịch đặt bàn vào sổ tay / giấy dán tường; quên kiểm tra khách quá 30 phút chưa cọc gây giữ phòng VIP ảo hoặc xếp trùng bàn.<br/>• Thẻ gửi rượu bằng giấy dễ rách/mất, nhân viên khác tự lấy rượu uống bớt. | • Đặt bàn trên `#/customer`, tự động tính cọc (`VIP` hoặc `>= 8 khách`), `Event-Based Gateway` + `Timer (30p)` tự động giải phóng bàn nếu quá hạn cọc.<br/>• Tra cứu và lấy rượu gửi xác thực bằng mã **OTP 6 số** kèm theo dõi `%` rượu còn lại. |
| **2. Gọi Hải sản bể (Nguyên con ép giá & Bán lẻ theo Gram)** | • Nhập cá chỉ cân tổng số kg; Phục vụ không biết trong bể còn mấy con cá nên phải chạy bộ xuống hỏi.<br/>• Khách mua lẻ `500g` chặt đại 1 con cá nguyên, phần dư cất tủ dễ hỏng.<br/>• Khách trả giá nguyên con phải chạy tìm Chủ quán hỏi miệng mất 5–10 phút (`Escalation` thủ công). | • Nhập bể tại Tab 3 `#/kiosk` cân và gắn mã từng con (`#CM-01: 1.36kg`).<br/>• Phục vụ xem trực tiếp từng con cá trên ĐT; mua lẻ `500g` tự động ưu tiên xẻ từ con cá đang xẻ dở (`partial = true`).<br/>• Khách ép giá nguyên con: Chặn nếu `< Giá vốn` (`Error Event`); tự chốt nếu `<= 8%` (Phục vụ) hoặc `<= 15%` (Thu ngân kiêm Quản lý ca), chỉ leo thang `Escalation` lên Chủ quán khi `> 15%`. |
| **3. Xuất Bia Nguyên Thùng (24 lon) & Trả Bia Dư** | • PG/Phục vụ tự bê nguyên thùng 24 lon ra bàn không qua phiếu.<br/>• Cuối bữa khách trả lại 7 lon dư chưa khui: Tự gạch xóa tay trên giấy từ 24 xuống 17 lon, quên thu hồi số lon tặng khuyến mãi (`Error Event`) hoặc gạch khống số lon trả lại để biển thủ tiền mặt. | • Chọn xuất nhanh **`1 thùng (24 lon/chai)`**, **`2 thùng (48)`**, **`Nửa thùng (12)`** trên `#/waiter`, `#/pg`, `#/cashier`.<br/>• Khi trả bia dư: Bấm **`Trả bia dư`** (nhập số lon trả lại hoặc số lon thực uống) $\rightarrow$ Kích hoạt `Compensation` hoàn kho bia, tự động đồng bộ lại số lon tặng KM (`Engine.reconcilePromos`) và ghi rõ trên bill: `Đem ra 1 thùng (24 lon) · Trả lại 7 lon dư · Tính tiền 17 lon`. |
| **4. Báo hỏng nguyên liệu bếp & Định mức món ăn (BOM)** | • Đầu bếp thấy thịt/đậu hũ/rau hỏng tự vứt bỏ không chụp ảnh, không báo ngay.<br/>• Phục vụ không biết nguyên liệu đã hết vẫn nhận order, 15 phút sau phải chạy ra bàn xin lỗi khách đổi món (`Compensation` thủ công). | • Tab 2 `#/kiosk` hỗ trợ báo hỏng **mọi nguyên liệu** (thịt, rau, đậu hũ, hải sản) kèm ảnh chụp bắt buộc $\rightarrow$ Trừ tồn kho tức thời và phát `Signal [SYNC_STOCK]` giảm ngay **số phần món ăn có thể làm** trên màn hình Phục vụ & Thu ngân. |
| **5. Khóa Bill tạm tính & Phân quyền duyệt 2 tầng** | • Viết/in phiếu tạm tính xong không có cơ chế khóa bill $\rightarrow$ Nhân viên thu đủ tiền mặt của khách rồi quay lại gạch xóa món trên giấy.<br/>• Mọi việc nhỏ đều phải gọi điện hỏi Chủ quán làm nghẽn quầy thu ngân. | • In tạm tính K80 tự động khóa bill (`locked`, `Timer 60s ân hạn`).<br/>• **Phân quyền 2 tầng**: **Thu ngân kiêm Quản lý ca** tự duyệt nhanh trong hạn mức (hủy món `<= 200k`, giảm giá `<= 10%`, mở khóa lần `1/1`, cá ép giá `<= 15%`); chỉ các vấn đề lớn mới phát `Escalation Event` trình **Chủ quán**. |
| **6. Thanh toán QR tại bàn, Webhook Biến động số dư & Chia Tip** | • Quét mã QR tĩnh không có nội dung định danh bàn $\rightarrow$ Phục vụ phải chụp màn hình ĐT của khách gửi vào nhóm Zalo chờ Chủ quán mở App ngân hàng dò sao kê (`Timer 5–10p`), dễ bị ảnh bill giả.<br/>• Tiền Tip khách chuyển dư bị lẫn vào doanh thu quán, không tách chia cho nhân viên được. | • Phân công rõ nhân viên phụ trách từng bàn/khu vực; Phục vụ ấn **`Thanh toán nhanh tại bàn`** hiện mã VietQR định danh riêng `QN <Bàn> <Code>` (giữ cả mã cũ khi ghép bàn).<br/>• Webhook `POST /api/webhooks/payment` tự động khớp lệnh, phát `Signal [WEBHOOK_PAID]` báo **Thanh toán thành công** tức thời và tự động tách tiền chuyển dư vào **Quỹ Tip QR** (gán **100% cho NV đứng bàn** hoặc **chia đều trong ca**). |
| **7. Đối soát kho cuối ca, Chốt két Z-Report, Thuế VAT & Lương/P&L** | • Cuối ca chỉ đếm tồn cuối ghi giấy, không đối soát được 4 lớp (`Đầu ca + Nhập - Bán - Hỏng`).<br/>• Khách xin hóa đơn VAT phải ghi giấy hẹn hôm sau kế toán mới gõ lại vào Excel, dễ nhầm thuế 8% và 10%.<br/>• Cuối tháng mất 2–3 ngày cộng tay bảng lương, hoa hồng PG, Tip và P&L. | • Tự động chạy **Đối soát 4 lớp** trên 16 nguyên liệu bếp, 5 hải sản bể, 3 hãng bia.<br/>• Xuất HĐĐT trực tiếp tách tự động bảng thuế **8% (Đồ ăn)** và **10% (Bia rượu)**.<br/>• Kiểm tiền theo mệnh giá, khóa sổ `Z-Report` (`Signal [SHIFT_LOCKED]`) và tự động tính **Báo cáo Lãi lỗ (P&L)** cùng **Bảng lương 10 nhân sự** thời gian thực. |
