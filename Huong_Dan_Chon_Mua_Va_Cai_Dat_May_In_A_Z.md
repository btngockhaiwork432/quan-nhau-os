# KẾ HOẠCH MUA SẮM & HƯỚNG DẪN CÀI ĐẶT HỆ THỐNG MÁY IN K80 TỪ A–Z
*(Dành riêng cho mô hình: **1 Laptop tại Quầy + 1 Máy in USB Thu ngân + 1 Máy in Wi-Fi Bếp** — Không cần kéo dây mạng LAN)*

---

## PHẦN 1: KẾ HOẠCH MUA SẮM THIẾT BỊ (CHUẨN BỊ TRƯỚC KHI LẮP)

Để không phải đục tường hay kéo dây mạng LAN từ cục Wi-Fi đi khắp quán, bạn chỉ cần đặt mua đúng **3 món** sau:

| STT | Thiết bị cần mua | Vị trí đặt | Mẫu máy khuyên mua (Ngon - Bổ - Rẻ) | Giá tham khảo | Ghi chú khi đặt hàng |
| :---: | :--- | :--- | :--- | :---: | :--- |
| **1** | **Máy in Thu ngân (Bản cổng USB)** | Đặt ngay cạnh chiếc Laptop tại Quầy | • **Xprinter XP-Q80I (USB)**<br>• **Xprinter XP-N160II (USB)** | `750.000đ – 900.000đ` | Chọn khổ **K80 (80mm)**, tự động cắt giấy, cổng **USB** (trong hộp có sẵn dây cáp USB). |
| **2** | **Máy in Bếp (Bản bắt sóng Wi-Fi)** | Đặt tại Bếp (chỉ cần ổ cắm điện) | • **Xprinter XP-Q80I (Wi-Fi)**<br>• **Xprinter XP-K200L (Wi-Fi)**<br>• **Zywell ZY307 (Wi-Fi)** | `1.200.000đ – 1.450.000đ` | Chọn khổ **K80 (80mm)**, tự động cắt giấy, có loa báo hiệu và kết nối **Wi-Fi**. |
| **3** | **Giấy in nhiệt K80** | Dùng chung cho cả 2 máy | • **Giấy in nhiệt K80x45mm** hoặc **K80x80mm** (1 thùng hoặc lốc 10 cuộn) | `65.000đ – 90.000đ / 10 cuộn` | Hai máy dùng chung 1 cỡ giấy K80 rất tiện quản lý. |

> **Trường hợp muốn tiết kiệm tối đa (Chỉ mua 1 máy in duy nhất dùng chung cho cả Quầy & Bếp):**
> Chỉ cần mua **1 chiếc Máy in USB** (`~800.000đ`) đặt ngay cạnh Laptop (nếu Bếp sát Quầy) hoặc **1 chiếc Máy in Wi-Fi** (`~1.300.000đ`). Khi cấu hình trên web chỉ cần điền cùng thông số cho cả dòng Thu ngân và dòng Bếp là mọi phiếu đều tự động chạy ra chiếc máy đó.

---

## PHẦN 2: CÁC FILE CÔNG CỤ ĐÃ ĐƯỢC LÀM SẴN TRONG `print_agent/`

Toàn bộ công cụ đã được chuẩn bị sẵn trong thư mục `c:\quan_nhau\print_agent` (và tải về trực tiếp trên trang `https://munbao.com/owner/settings` qua nút **"Tải bộ kết nối máy in USB & Wi-Fi/LAN (.zip)"**):

1. **`1_TIM_MAY_IN_TRONG_QUAN.bat`:**
   * Bấm đúp chuột: Tự động kiểm tra **dải IP Wi-Fi của quán bạn** (ví dụ `192.168.1.xxx`), tự phát hiện **Máy in USB** đang cắm vào Laptop và **tự động quét toàn bộ mạng Wi-Fi của quán** để tìm ra địa chỉ IP của chiếc **Máy in Bếp Wi-Fi** trong 3 giây!
2. **`2_CHAY_KET_NOI_MAY_IN.bat`:**
   * Bấm đúp chuột để bật ngay cầu nối in tự động `quannhau_print_bridge.py` (hỗ trợ song song cả **cổng USB Windows trực tiếp** lẫn **Wi-Fi / LAN cổng 9100**).
3. **`3_CAI_TU_KHOI_DONG_CUNG_WINDOWS.bat`:**
   * Bấm đúp chuột **đúng 1 lần duy nhất khi mới lắp**: Từ hôm sau trở đi, hễ nhân viên mở chiếc Laptop lên là hệ thống in tự động chạy ngầm dưới thanh Taskbar.
4. **`HUONG_DAN_CAI_DAT_NHANH.txt`:**
   * Bản hướng dẫn nhanh 4 bước nằm sẵn bên trong tệp `.zip`.

---

## PHẦN 3: HƯỚNG DẪN LẮP ĐẶT CHI TIẾT TỪNG BƯỚC (KHI MÁY VỀ TỚI QUÁN)

### Bước 1: Lắp giấy & Cắm Máy in số 1 (Máy in Thu ngân cổng USB) vào Laptop
1. Bật nắp máy in, đặt cuộn giấy nhiệt K80 vào (để **mặt giấy trơn bóng quay lên phía lưỡi dao cắt**), kéo thừa 1 đoạn giấy ra ngoài rồi đóng nắp.
2. Cắm dây nguồn máy in và bật công tắc nguồn.
3. Lấy sợi **dây cáp USB** (có sẵn trong hộp máy in) cắm 1 đầu vào máy in, đầu kia cắm vào **cổng USB của chiếc Laptop**.
4. Cài đặt Driver máy in lên Laptop (chạy bộ cài `Xprinter Driver V7.77` đi kèm máy, chọn khổ `XP-80C` rồi bấm `Install`).

### Bước 2: Cắm điện & Cho Máy in số 2 (Máy in Bếp Wi-Fi) bắt sóng Wi-Fi của quán
1. Đặt máy in tại Bếp, lắp cuộn giấy K80 và cắm dây nguồn.
2. Cho máy in kết nối vào tên Wi-Fi và mật khẩu Wi-Fi của quán (theo tờ hướng dẫn đi kèm máy in).
3. **Cách kiểm tra nhanh trên máy in (nếu muốn xem giấy):** Tắt nguồn máy in Bếp -> Giữ nút `FEED` đồng thời bật công tắc nguồn trong 3 giây rồi thả tay -> Máy tự in tờ giấy ghi rõ `IP Address` mà cục Wi-Fi quán vừa cấp cho máy.

### Bước 3: Chạy công cụ tự động dò tìm Máy in trên Laptop (Mất 5 giây)
1. Trên chiếc Laptop tại quán, mở `https://munbao.com/owner/settings` (đăng nhập mã PIN Chủ quán `1111`).
2. Chọn mục **Máy in, VietQR & Bill** -> Bấm nút **"Tải bộ kết nối máy in USB & Wi-Fi/LAN (.zip)"** và giải nén ra màn hình Desktop của Laptop.
3. Mở thư mục vừa giải nén, bấm đúp vào file **`1_TIM_MAY_IN_TRONG_QUAN.bat`**:
   * **Mục [2]** sẽ hiện tên máy in USB vừa cắm vào Laptop (trên web chỉ cần điền chữ **`USB`**).
   * **Mục [3]** sẽ tự quét và hiện địa chỉ IP của chiếc **Máy in Bếp Wi-Fi** (ví dụ: `192.168.1.201`).

### Bước 4: Điền thông số lên trang Cài đặt & Bật tự động in
1. Quay lại trang `https://munbao.com/owner/settings` (mục **Máy in, VietQR & Bill**):
   * Kéo xuống bảng **Định tuyến**, bấm nút **"Thiết lập nhanh: 2 máy in (1 Thu ngân + 1 Bếp)"**:
     * Hệ thống tự động điền sẵn chữ **`USB`** vào ô kết nối của **Máy in Thu ngân** và tự gộp toàn bộ nhóm món ăn + hải sản về **Máy in Bếp**.
   * Ở dòng **Máy in Bếp**, gõ địa chỉ IP vừa tìm được ở Bước 3 (ví dụ `192.168.1.201`) vào cột **`IP Wi-Fi/LAN / USB`**.
   * Bấm nút **"Lưu và áp dụng"** ở thanh dưới cùng.
2. Mở lại thư mục trên Laptop:
   * Bấm đúp vào **`3_CAI_TU_KHOI_DONG_CUNG_WINDOWS.bat`** (để tự chạy mỗi ngày khi bật Laptop).
   * Bấm đúp vào **`2_CHAY_KET_NOI_MAY_IN.bat`** để kích hoạt ngay.
3. **Kiểm tra thành quả:** Trên trang web Cài đặt, bấm vào biểu tượng chiếc máy in (**In thử**) ở từng dòng -> Cả 2 máy sẽ lập tức nhả phiếu in thử và tự động cắt giấy!
