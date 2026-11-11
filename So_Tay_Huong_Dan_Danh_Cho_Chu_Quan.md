# SỔ TAY HƯỚNG DẪN THIẾT LẬP & QUẢN LÝ QUÁN (DÀNH CHO CHỦ QUÁN)

**Hướng dẫn sử dụng trực tiếp trên màn hình https://munbao.com — Hoàn toàn không cần kiến thức kỹ thuật**

---

## PHẦN 1: SƠ ĐỒ THIẾT BỊ THỰC TẾ TẠI QUÁN & ĐƯỜNG DẪN TRUY CẬP

Phần mềm Quản lý Quán Nhậu của bạn đã sẵn sàng trên mạng tại địa chỉ https://munbao.com. Quán vận hành trơn tru chỉ với đúng thiết bị hiện có: 01 chiếc Laptop đặt tại Quầy thu ngân, 02 máy in bill nhiệt K80 (01 máy ở Thu ngân, 01 máy ở Bếp) và điện thoại cá nhân của Chủ quán cùng nhân viên (hoàn toàn không cần mua máy tính bảng riêng cho Bếp hay Hồ cá).

> **Mẹo đưa biểu tượng phần mềm ra màn hình chính Điện thoại (như một App thật):**
> • Trên iPhone / iPad (Safari): Mở https://munbao.com/login -> Bấm nút Chia sẻ (biểu tượng mũi tên lên ở giữa đáy màn hình) -> Chọn 'Thêm vào MH chính' (Add to Home Screen).
> • Trên điện thoại Android (Chrome): Mở https://munbao.com/login -> Bấm dấu 3 chấm góc trên bên phải -> Chọn 'Thêm vào màn hình chính'.

### 1.1. Sơ đồ 3 nhóm thiết bị vận hành thực tế tại quán

| Thiết bị tại quán | Vị trí đặt | Vai trò trong ca bán hàng |
| --- | --- | --- |
| 1. 01 chiếc Laptop duy nhất | Quầy Thu ngân | Mở trình duyệt Chrome cho Thu ngân trực sơ đồ bàn, in tạm tính, thu tiền, chốt ca; đồng thời chạy ngầm bộ kết nối tự động đẩy lệnh in xuống máy in Bếp. |
| 2. 02 máy in bill nhiệt K80 | • Máy 1: Quầy Thu ngân<br>• Máy 2: Khu Bếp | • Máy Thu ngân: In Phiếu tạm tính (kèm mã VietQR), Hóa đơn thanh toán, Chốt ca và Phiếu xuất Bia/Nước/Đá.<br>• Máy Bếp (cắm dây mạng LAN vào Wi-Fi quán): Tự động kêu bíp, nhả phiếu và cắt giấy ngay khi nhân viên bấm gửi món (Bếp không cần màn hình hay bấm nút). |
| 3. Điện thoại cá nhân | Chủ quán & Nhân viên | • Chủ quán / Kế toán: Xem doanh thu, lãi lỗ, kho, ảnh chấm công và duyệt yêu cầu từ xa.<br>• Phục vụ & PG: Chấm công Camera trước + GPS + Wi-Fi quán, gọi món tại bàn, đưa mã VietQR nhận Tip.<br>• Phụ trách Hồ cá / Bếp: Nhập số ký khi cân cá tại bể, chụp ảnh báo hỏng, kiểm kho cuối ca. |

### 1.2. Hai đường dẫn duy nhất cần nhớ tại quán

| Đối tượng sử dụng | Đường dẫn truy cập | Cách đăng nhập & Sử dụng |
| --- | --- | --- |
| 1. Dành cho Chủ quán & Toàn bộ Nhân viên | https://munbao.com/login | Mỗi người nhập Mã PIN 4 số của riêng mình. Phần mềm tự nhận biết ai là Chủ quán, Thu ngân, Phục vụ, PG Bia hay Hồ cá/Bếp để mở đúng màn hình công việc của người đó. |
| 2. Dành cho Khách hàng của quán | https://munbao.com/customer | Khách hàng không cần mật khẩu. Dùng để gắn lên Fanpage/Zalo của quán cho khách Đặt bàn trước, Tra cứu chai rượu đang gửi tại quán, hoặc Tự nhập mã số thuế để lấy Hóa đơn đỏ (VAT). |

### 1.3. Danh sách Mã PIN bàn giao ban đầu (Chủ quán đổi lại ngay ở Bước 1)

| Vị trí trong quán | Tên tài khoản mẫu | Mã PIN 4 số | Màn hình tự động mở ra sau khi bấm PIN |
| --- | --- | --- | --- |
| Chủ quán (Toàn quyền) | Nguyễn Văn Chủ | 1111 | Màn hình Quản lý Chủ quán (Xem lãi lỗ, duyệt yêu cầu, cài đặt quán) |
| Kế toán | Lê Thị Kế Toán | 2222 | Màn hình Kế toán (Xem doanh thu, kho, bảng lương, báo cáo thuế) |
| Thu ngân kiêm Quản lý ca | Trần Minh Thu | 3333 | Màn hình trên Laptop Quầy thu ngân (Tính tiền, in bill, khóa sổ cuối ca) |
| Phục vụ bàn (Khu Sân vườn 1) | Phạm Thị Lan | 4444 | Màn hình Điện thoại Phục vụ (Phụ trách bàn A01 đến A06) |
| Phục vụ bàn (Khu Sân vườn 2) | Đỗ Văn Nam | 4445 | Màn hình Điện thoại Phục vụ (Phụ trách bàn A07 đến A12) |
| Phục vụ bàn (Trong nhà & VIP 1) | Vũ Thị Hoa | 4446 | Màn hình Điện thoại Phục vụ (Phụ trách bàn B01-B04 & Phòng VIP 1) |
| Phục vụ bàn (Trong nhà & VIP 2) | Bùi Minh Đức | 4447 | Màn hình Điện thoại Phục vụ (Phụ trách bàn B05-B08 & Phòng VIP 2) |
| Nhân viên PG Bia | Ngô Thanh Thảo | 5555 | Màn hình Điện thoại PG (Bán bia, tặng bia khuyến mãi, trả nắp cuối ca) |
| Phụ trách Hồ hải sản | Hoàng Văn Long | 6666 | Mở trên Điện thoại cá nhân (Bắt cá, nhập số ký cân, báo cá chết, kiểm kho) |
| Bếp trưởng | Đinh Văn Sơn | 7777 | Mở trên Điện thoại cá nhân khi cần nhập kho / báo hỏng / kiểm kho cuối ca |
| Tạp vụ | Lý Thị Mai | 8888 | Mở trên Điện thoại cá nhân để bấm Chấm công vào/ra ca bằng Camera trước |

---

## PHẦN 2: 8 BƯỚC CHỦ QUÁN CÀI ĐẶT QUÁN LẦN ĐẦU TRÊN CHIẾC LAPTOP TẠI QUẦY

Trước ngày bắt đầu bán hàng thực tế, Chủ quán ngồi tại chiếc Laptop ở quầy (đang kết nối Wi-Fi của quán), đăng nhập https://munbao.com/login bằng mã PIN 1111 và thực hiện lần lượt 8 bước dưới đây.

### Bước 1: Xóa số liệu mẫu & Đổi ngay mã PIN bảo mật của Chủ quán

- 1. Sau khi nhập mã PIN 1111, nhìn lên góc trên cùng bên phải màn hình, bấm nút 'Dữ liệu hệ thống' -> chọn 'Khởi tạo Quán Mới (Xóa dữ liệu mẫu để bán hàng thật)' -> xác nhận.
- -> Toàn bộ bàn ăn thử và doanh thu mẫu về 0 tròn trĩnh, giữ nguyên sơ đồ bàn và khung thực đơn để chỉnh sửa tiếp.
- 2. Vào mục 'Cài đặt' -> chọn nhóm 'Nhân viên và phân quyền' -> bấm Sửa dòng Chủ quán và ĐỔI NGAY mã PIN 1111 sang 4 số bí mật của riêng bạn.

### Bước 2: Điền Tên quán, Wi-Fi khách & Tài khoản VietQR mở tự do số tiền nhận Tip

- 1. Trong 'Cài đặt' -> chọn mục 'Máy in và mẫu bill' -> khung 'Thông tin quán': Điền Tên quán, Địa chỉ, Số điện thoại, Mã số thuế, Tên Wi-Fi và Mật khẩu Wi-Fi cho khách (tự động in ở chân hóa đơn).
- 2. Kéo xuống khung 'Tài khoản nhận VietQR': Chọn Ngân hàng, nhập Số tài khoản và Tên chủ tài khoản (IN HOA không dấu).
- 3. Cơ chế nhận Tiền Tip thông minh qua VietQR (đã bật sẵn mặc định):
-    • Khi khách quét mã QR thanh toán, Nội dung chuyển khoản được khóa cố định theo mã riêng của bàn (ví dụ QN A05 KA05), còn ô Số tiền để mở tự do.
-    • Nếu hóa đơn 460.000 đ và khách hài lòng nhập 500.000 đ, phần mềm tự động đối soát đúng bàn A05 và cộng 40.000 đ tiền dư vào Tiền Tip của nhân viên (riêng mã QR đặt cọc giữ bàn trước thì vẫn khóa cứng số tiền cọc).

### Bước 3: Kết nối 02 Máy in bill (1 ở Thu ngân + 1 ở Bếp) với chiếc Laptop tại quán

- 1. Cắm dây cho máy in Bếp (cổng mạng LAN): Cắm dây nguồn và cắm dây mạng LAN từ máy in Bếp vào cục Wi-Fi của quán. Tắt nguồn máy in -> ấn giữ nút FEED đồng thời bật nguồn giữ 2 giây -> tờ giấy in ra ghi dòng 'IP Address' (ví dụ 192.168.1.201, cổng 9100).
- 2. Cắm dây cho máy in Thu ngân (xem máy tại quầy dùng cổng gì):
-    • Cách A (Máy in Thu ngân cũng cắm dây mạng LAN vào cục Wi-Fi — khuyên dùng): Lấy số IP tương tự (ví dụ 192.168.1.200, khác số đuôi với máy Bếp).
-    • Cách B (Máy in Thu ngân cắm cáp USB thẳng vào chiếc Laptop): Cài Driver máy in trên Windows, đặt làm Default Printer (khổ 80mm).
- 3. Vào 'Cài đặt' -> 'Máy in và mẫu bill':
-    • Kéo xuống bảng 'Định tuyến phiếu bếp', bấm nút 'Thiết lập nhanh: 2 máy in (1 Thu ngân + 1 Bếp)' -> Phần mềm tự động gom mọi món ăn & hải sản về Máy in Bếp, còn hóa đơn & phiếu bia/nước về Máy in Thu ngân.
-    • Lên bảng 'Máy in': Nhập IP của máy Bếp (ví dụ 192.168.1.201) vào dòng 'Máy in bếp nóng'. Ở dòng 'Máy in quầy thu ngân', nhập IP nếu dùng dây LAN (Cách A) hoặc để trống ô IP nếu cắm cáp USB vào Laptop (Cách B) -> Bấm 'Lưu và áp dụng'.
- 4. Cài cầu nối in tự động trên Laptop (chỉ làm 1 lần duy nhất): Đảm bảo Laptop đã cài Python 3 (tích Add Python to PATH) -> Bấm nút 'Tải bộ kết nối máy in LAN (.zip)' ngay trên bảng Máy in -> Giải nén ra ổ C:\QuanNhau_MayIn_LAN -> Nhấp đúp 'CAI_TU_KHOI_DONG_CUNG_WINDOWS.bat' và 'CHAY_KET_NOI_MAY_IN_LAN.bat' -> Bấm biểu tượng 'In thử' để máy in Bếp nhả phiếu ngay!
- 5. Nếu máy Thu ngân dùng cáp USB (Cách B): Chuột phải biểu tượng Google Chrome ngoài Desktop -> Properties -> thêm ' --kiosk-printing' vào cuối ô Target -> mở màn hình Thu ngân bấm 'Lịch sử in K80' bật nút 'Đang BẬT tự động in'.
- 6. Chống ngủ đông trên Laptop: Vào Windows Settings -> Power & battery -> Screen and sleep -> chỉnh 'When plugged in, put my device to sleep' thành 'Never' để Laptop không tự ngủ làm gián đoạn lệnh in xuống Bếp.

### Bước 4: Khóa Chấm công thật 1 chạm tại quán (Wi-Fi quán + GPS + Selfie Camera trước)

- 1. Dùng điện thoại của Chủ quán bắt đúng mạng Wi-Fi của quán, mở 'Cài đặt' -> 'Ca làm và lương' -> khung 'Chấm công và đi trễ'.
- 2. Bấm nút 'Gắn IP Wi-Fi hiện tại làm mạng quán' và nút 'Lấy tọa độ GPS hiện tại làm vị trí quán' (bấm Cho phép Vị trí).
- 3. Điền bán kính cho phép (ví dụ 50 m - 80 m), bật yêu cầu chụp ảnh Selfie và chọn quy chế chia Tiền Tip -> Bấm 'Lưu và áp dụng'.
- -> Từ lúc này, nhân viên bắt buộc phải đứng tại quán, bắt Wi-Fi quán và chụp khuôn mặt trực tiếp bằng camera trước mới vào ca được.

### Bước 5: Sắp xếp Sơ đồ bàn, Giá phòng VIP & Tiền cọc đặt bàn

- Trong trang Cài đặt, bấm chọn mục 'Bàn và đặt chỗ':
- 1. Đổi tên khu vực (Sân vườn, Trong nhà, Phòng VIP...), thêm/xóa bàn và kéo từng bàn vào đúng vị trí thực tế ngoài quán.
- 2. Điền giá phụ thu mỗi giờ ngồi phòng VIP và mức chi tối thiểu được miễn tiền giờ phòng VIP (ví dụ ăn trên 3.000.000 đ tự miễn phí phòng).
- 3. Điền mức tiền cọc khi khách đặt bàn trực tuyến (mã QR đặt cọc sẽ tự khóa cứng đúng số tiền cọc này).

### Bước 6: Cập nhật Thực đơn, Giá bán, Túi nguyên liệu Bếp & Cách bán Hải sản bể

- Trong trang Cài đặt, bấm chọn mục 'Thực đơn và định lượng':
- 1. Khung 'Túi định lượng': Khai báo các loại túi thịt/mực/ếch chia sẵn trong bếp để khách gọi 1 đĩa phần mềm tự trừ đúng 1 túi.
- 2. Khung 'Món ăn và đồ uống': Chỉnh sửa Giá bán, Giá vốn, kiểu chế biến hải sản cân ký.
- 3. Khung 'Bán hải sản theo Gram & Khách ép giá nguyên con': Bật cho phép bán lẻ theo gram và quy định % giảm tối đa nhân viên được tự chốt tại bàn.

### Bước 7: Cài đặt Khuyến mãi Bia (Mua 10 tặng 1) & Chỉ tiêu hãng bia

- Trong trang Cài đặt, bấm chọn mục 'Khuyến mãi bia và PG':
- 1. Cài đặt chương trình (ví dụ Mua 10 tặng 1), chọn bên chịu chi phí ('Quỹ hãng' hoặc 'Quán chịu') và bật 'Thu hồi nắp/vỏ lon' để cuối ca PG nộp đủ nắp cho Thu ngân.
- 2. Điền sản lượng cam kết với hãng bia trong tháng/quý để phần mềm tự theo dõi % tiến độ nhận thưởng.

### Bước 8: Tạo tài khoản Nhân viên thật & Giao hạn mức cho Thu ngân kiêm Quản lý

- Trong trang Cài đặt, bấm chọn mục 'Nhân viên và phân quyền':
- 1. Bấm '+ Thêm nhân viên' để nhập tên nhân viên thật của quán, chọn vị trí làm việc, mức lương, khu vực phụ trách và cấp mã PIN 4 số riêng.
- 2. Tại khung 'Phân quyền theo vai trò', chỉnh hạn mức việc nhỏ mà Thu ngân kiêm Quản lý ca được tự xử lý tại quầy (vượt hạn mức sẽ tự động đẩy về điện thoại Chủ quán).
- 3. Bấm nút màu cam 'Lưu và áp dụng' ở góc dưới cùng bên phải màn hình là hoàn tất!

---

## PHẦN 3: HƯỚNG DẪN CHỦ QUÁN GIAO VIỆC HẰNG NGÀY CHO TỪNG BỘ PHẬN

Với mô hình 01 Laptop tại quầy + 02 Máy in bill (Thu ngân & Bếp) + Điện thoại cá nhân nhân viên, mỗi bộ phận thao tác hằng ngày cực kỳ gọn nhẹ như sau:

### 3.1. Bảng phân công thao tác hằng ngày theo từng vị trí nhân viên

| Vị trí nhân viên | Thao tác bắt buộc trong ca làm việc |
| --- | --- |
| 1. Phục vụ bàn<br>(Dùng điện thoại cá nhân) | • Đầu ca: Bắt Wi-Fi quán -> Mở https://munbao.com/login -> Nhập mã PIN 4 số -> Chụp ảnh mặt Camera trước + GPS để Chấm công vào ca.<br>• Khi khách vào: Chạm vào bàn trống -> Chọn số khách -> Chọn món ăn & bia bấm 'Gửi bếp' (Máy in Bếp tự nhả phiếu món ăn, Máy in Thu ngân nhả phiếu xuất bia/nước).<br>• Khi khách gọi Hải sản sống tại bể: Chọn con cá theo mã hoặc chờ người phụ trách Hồ cá cân ký.<br>• Khi khách tính tiền tại bàn: Mở mã VietQR của bàn đưa khách quét (nội dung chuyển khoản đã khóa sẵn mã bàn, ô số tiền mở tự do để khách có thể nhập dư cho thêm Tiền Tip). |
| 2. Nhân viên PG Bia<br>(Dùng điện thoại cá nhân) | • Mở https://munbao.com/login -> Nhập mã PIN PG -> Chấm công bằng Camera trước.<br>• Khi rót thêm bia cho bàn nào, chạm vào bàn đó bấm cộng số lon bia.<br>• Khi bàn uống đủ điều kiện khuyến mãi (ví dụ đủ 10 lon), bấm 'Tặng bia khuyến mãi' và thu hồi nắp lon nộp cho Thu ngân cuối ca. |
| 3. Phụ trách Hồ cá & Bếp<br>(Dùng điện thoại cá nhân + 01 Máy in LAN tại Bếp) | • Trong Khu Bếp nấu: Đầu bếp KHÔNG cần dùng điện thoại hay màn hình — cứ nghe máy in nhiệt K80 kêu bíp và tự cắt phiếu ra là xé phiếu chế biến theo đúng số bàn.<br>• Tại Hồ hải sản (mở PIN 6666 trên điện thoại cá nhân): Khi có lệnh bắt cá, đặt cá lên cân rồi gõ số ký bấm Xác nhận -> Máy in trong Bếp lập tức tự nhả phiếu chế biến kèm số ký.<br>• Khi nhập hàng / có cá chết / cuối ca: Dùng điện thoại cá nhân (PIN 6666 hoặc 7777) để nhập kho, chụp ảnh thực tế con cá chết gửi Chủ quán duyệt và nhập số đếm kiểm kho mù cuối tối. |
| 4. Thu ngân kiêm Quản lý ca<br>(Ngồi tại chiếc Laptop ở Quầy thu ngân) | • Đầu ca: Bật nguồn chiếc Laptop tại quầy (giữ Laptop cắm sạc và luôn mở trong suốt ca bán để truyền lệnh in cho toàn quán), nhập số tiền mặt lẻ đầu ca.<br>• Trong ca: Bấm In tạm tính trên máy in Thu ngân (hóa đơn lập tức tự khóa chống sửa món gian lận), thu tiền mặt / đối soát chuyển khoản VietQR và xử lý các việc nhỏ trong hạn mức.<br>• Cuối ca: Nhận nắp bia từ PG, kiểm đếm tờ tiền mặt theo mệnh giá và bấm 'Khóa sổ kết ca (Z-Report)'. |

---

## PHẦN 4: THÓI QUEN 5 PHÚT MỖI NGÀY CỦA CHỦ QUÁN TRÊN ĐIỆN THOẠI

Dù bạn đang có mặt ở quán hay đi vắng, chỉ cần mở điện thoại đăng nhập https://munbao.com/login bằng mã PIN Chủ quán, bạn nắm trọn toàn bộ tình hình tiền nong và kho bãi của quán qua 4 việc sau:

### 1. Xem ngay Hôm nay quán thu bao nhiêu, Lãi thực bỏ túi bao nhiêu (Mục 'Tổng quan' & 'Bán hàng')

- • Ngay màn hình đầu tiên ('Tổng quan'), bạn thấy rõ: Tổng doanh thu hôm nay, Tiền mặt trong két đang có bao nhiêu, Tiền chuyển khoản ngân hàng bao nhiêu, có bao nhiêu bàn đang ngồi.
- • Bấm sang mục 'Bán hàng và lãi lỗ': Phần mềm tự động lấy Doanh thu trừ đi Giá vốn nguyên liệu, trừ Hao hụt cá chết, trừ Chi phí nhân công và Điện/Nước/Gas để tính ra con số 'Lợi nhuận ròng' (tiền lãi thực sự bạn thu về).

### 2. Bấm Duyệt hoặc Từ chối các việc bất thường (Mục 'Phê duyệt')

- Mọi hành động nhạy cảm tại quán đều hiện ở mục 'Phê duyệt' kèm số đếm thông báo:
- • Duyệt báo hỏng / cá chết: Bấm nút 'Xem ảnh' để kiểm tra hình chụp thực tế con cá chết từ bếp gửi lên trước khi bấm Duyệt.
- • Duyệt mở khóa hóa đơn: Xem rõ lý do vì sao Thu ngân xin mở khóa tờ hóa đơn đã in tạm tính.
- • Duyệt lệch kho cuối ca: Khi nhân viên đếm kho cuối tối bị thiếu cá hoặc thiếu thịt/bia vượt mức cho phép, bạn có thể bấm nút tích 'Trừ lương người kiểm' rồi bấm Duyệt -> Số tiền hàng bị mất sẽ tự động trừ thẳng vào lương tháng của nhân viên đó.

### 3. Kiểm tra thất thoát kho bãi 4 lớp (Mục 'Kho và đối soát')

- • Bấm vào mục 'Kho và đối soát': Bạn sẽ thấy bảng so sánh cực kỳ rõ ràng cho từng loại hải sản, từng loại túi thịt và từng loại bia:
-   [Tồn đầu ngày] + [Nhập thêm] - [Đã bán cho khách] - [Hàng hỏng đã duyệt] = [Số lượng phải còn] so với [Số nhân viên đếm thực tế cuối ca].
- • Thiếu đúng bao nhiêu con cá, bao nhiêu lạng hay bao nhiêu lon bia đều hiện màu đỏ kèm quy đổi ra số tiền thất thoát.

### 4. Cuối tháng tải Bảng lương & Bảng kê Thuế chỉ bằng 1 nút bấm (Mục 'Nhân sự' & 'Thuế')

- • Tại mục 'Nhân sự và lương': Phần mềm đã tự cộng sẵn Ngày công, Giờ tăng ca, Hoa hồng PG, Tiền Tip khách bo và tự trừ Đi trễ, Ứng lương, Đền hàng mất cho từng nhân viên. Bạn chỉ cần bấm nút 'Xuất CSV bảng lương' để mở trên Excel kiểm tra và trả lương.
- • Tại mục 'Thuế và hóa đơn': Phần mềm tự tách sẵn doanh thu Đồ ăn (thuế 8%) và Rượu bia (thuế 10%). Cuối kỳ chỉ cần bấm 'Xuất bảng kê thuế' để gửi cho kế toán hoặc cơ quan thuế.

---
