# BỘ KỊCH BẢN KIỂM THỬ (TEST CASES) & ĐỐI CHIẾU SỐ LIỆU DÀNH CHO TEAM TEST

**Hướng dẫn từng bước thao tác đầu vào (Input) và Công thức kiểm chứng số liệu đầu ra (Expected Output) trên https://munbao.com**

---

## PHẦN 1: HƯỚNG DẪN MÔI TRƯỜNG & CÁCH CHUẨN BỊ DỮ LIỆU CHO TEAM TEST

Tài liệu này dành riêng cho đội ngũ Tester / QA để kiểm thử toàn diện các luồng nghiệp vụ và kiểm chứng độ chính xác của từng con số tính toán (Hóa đơn, Tồn kho 4 lớp, Khuyến mãi, Tiền Tip, Bảng lương, Báo cáo Lãi lỗ & Thuế) trên hệ thống https://munbao.com.

> **Cách bật Thanh chuyển nhanh vai trò (Chế độ Kiểm thử nhanh cho QA):**
> • Để kiểm thử chuẩn bảo mật Production (bắt buộc nhập PIN khi đổi vai trò): Truy cập https://munbao.com/login
> • Để bật thanh công cụ đen trên cùng giúp Tester chuyển qua lại giữa 6 màn hình (Khách hàng, Phục vụ, PG, Kiosk, Thu ngân, Chủ quán) chỉ bằng 1 cú click mà không cần gõ lại PIN: Truy cập https://munbao.com/login?demo=1

> **Cách làm sạch số liệu về 0 trước khi chạy kịch bản đối chiếu số học:**
> • Để cộng nhẩm và kiểm tra số liệu chính xác từ con số 0: Đăng nhập Chủ quán (PIN 1111) -> Bấm nút 'Dữ liệu hệ thống' (góc trên phải) -> Chọn 'Khởi tạo Quán Mới (Xóa dữ liệu mẫu để bán hàng thật)'.
> • Khi đó: Doanh thu hôm nay = 0 đ, Bill đang mở = 0, Hao hụt = 0 đ, Toàn bộ 22 bàn đều Trống. Tồn kho đầu kỳ được đặt ở mức chuẩn để Tester bắt đầu tạo giao dịch và đối chiếu từng đồng.
> • Khi muốn quay lại bộ dữ liệu mẫu 6 bàn đang ăn & lịch sử 60 ngày: Bấm 'Dữ liệu hệ thống' -> Chọn 'Nạp lại dữ liệu mẫu minh họa'.

---

## PHẦN 2: BẢNG KỊCH BẢN TEST CHI TIẾT & SỐ LIỆU KỲ VỌNG (30 TEST CASES)

Thực hiện tuần tự từng nhóm kịch bản dưới đây (khuyến nghị chạy sau khi đã bấm 'Khởi tạo Quán Mới' để số liệu bắt đầu từ 0) và đối chiếu kết quả hiển thị trên màn hình với cột 'Số liệu kỳ vọng cần kiểm tra'.

### Nhóm 1: Kiểm thử Mở bàn, Gọi món Bếp & Tự động trừ Túi định lượng (BOM)

| Mã TC | Mục tiêu kiểm thử | Các bước thực hiện (Input) | Số liệu kỳ vọng cần kiểm tra (Expected Output) |
| --- | --- | --- | --- |
| TC-01 | Mở bàn mới & Kiểm tra sinh mã định danh VietQR riêng cho bill | 1. Vào cổng Phục vụ (/waiter, PIN 4444 - Phạm Thị Lan).<br>2. Chạm vào bàn trống A01 -> Chọn 4 khách -> Bấm 'Mở bàn'. | • Bàn A01 chuyển sang trạng thái 'Đang phục vụ' (màu xanh).<br>• Hệ thống tự sinh mã định danh thanh toán riêng cho bill dạng: 'QN A01 XXXX' (4 ký tự cuối duy nhất).<br>• Trên màn hình Thu ngân (/cashier) và Chủ quán (/owner) lập tức thấy bàn A01 đang mở (nhờ đồng bộ SSE thời gian thực). |
| TC-02 | Gọi món Bếp & Kiểm tra tự động trừ Túi nguyên liệu theo công thức BOM | 1. Trước khi gọi món, mở /owner/inventory (tab Tồn kho hiện tại) ghi nhận số tồn của 'Túi bò thăn 200g' (bag_beef, mặc định đầu kỳ = 28 túi) và 'Đậu hũ non' (bag_tofu = 30 phần).<br>2. Quay lại bàn A01 trên /waiter: Thêm 2 đĩa 'Bò lúc lắc' (165.000 đ/đĩa) và 1 đĩa 'Đậu hũ chiên giòn' (55.000 đ/đĩa) -> Bấm 'Gửi bếp'. | • Tổng tạm tính bàn A01 = (2 × 165.000) + (1 × 55.000) = 385.000 đ.<br>• Mở Kiosk Bếp (/kiosk, PIN 7777): Xuất hiện ngay 2 dòng món chờ chế biến của bàn A01.<br>• Mở /owner/inventory: Tồn kho 'Túi bò thăn 200g' giảm đúng 2 túi (từ 28 xuống 26 túi); 'Đậu hũ non' giảm đúng 1 phần (từ 30 xuống 29 phần). |
| TC-03 | Kiểm tra tự động khóa món ('Hết hàng') khi hết túi nguyên liệu trong kho | 1. Vào /kiosk (tab 2 Báo hỏng) hoặc kiểm tra một nguyên liệu có số tồn thấp.<br>2. Báo hỏng hết số túi còn lại của 'Túi dồi trường' (bag_intestine) về 0 túi.<br>3. Mở lại thực đơn gọi món trên /waiter. | • Món 'Dồi trường hấp hành' tự động hiển thị nhãn 'Hết nguyên liệu' và bị khóa không cho Phục vụ bấm gọi thêm. |

### Nhóm 2: Kiểm thử 3 Chế độ Bán Hải sản Sống tại Bể (Mã cá / Theo Gram / Ép giá)

| Mã TC | Mục tiêu kiểm thử | Các bước thực hiện (Input) | Số liệu kỳ vọng cần kiểm tra (Expected Output) |
| --- | --- | --- | --- |
| TC-04 | Chế độ 1: Bắt nguyên con theo mã định danh cá trong bể | 1. Kiểm tra tồn bể 'Cá mú' (m_grouper, giá 650.000 đ/kg, đầu kỳ có 8 con: #CM-01 nặng 0,78 kg, #CM-02 nặng 0,85 kg...).<br>2. Tại bàn A01 trên /waiter, bấm chọn món 'Cá mú' -> Chọn chế độ 'Bắt nguyên con' -> Tích chọn con cá '#CM-02 (0,85 kg)' -> Chọn kiểu chế biến 'Hấp Hồng Kông' (phụ thu 0 đ) -> Bấm 'Thêm vào đơn' & 'Gửi bếp'. | • Tiền món Cá mú được tính chính xác ngay tại bàn: 0,85 kg × 650.000 đ/kg = 552.500 đ.<br>• Tổng bill bàn A01 tăng lên: 385.000 + 552.500 = 937.500 đ.<br>• Mở danh sách cá trong bể: Con cá #CM-02 đã bị rút khỏi bể; tồn bể Cá mú giảm từ 8 con xuống 7 con, tổng số kg giảm đúng 0,85 kg. |
| TC-05 | Chế độ 2: Khách mua lẻ hải sản theo Gram (Cắt khúc, giữ phần dư trong bể) | 1. Tại bàn A01, bấm chọn món 'Cá mú' -> Chuyển sang tab 'Mua lẻ theo Gram (cắt khúc)'.<br>2. Chọn cắt từ con cá '#CM-08 (1,15 kg)' -> Nhập số lượng khách mua: 500 gram (0,50 kg) -> Chọn chế biến 'Nấu lẩu (phụ thu 30.000 đ)' -> Bấm 'Thêm vào đơn'. | • Tiền món = (0,50 kg × 650.000 đ) + 30.000 đ phụ thu = 325.000 + 30.000 = 355.000 đ.<br>• Kiểm tra lại bể Cá mú: Con cá #CM-08 KHÔNG bị xóa khỏi bể mà tự động cập nhật khối lượng còn lại = 1,15 - 0,50 = 0,65 kg (kèm nhãn 'còn dư'). Tổng số con trong bể vẫn là 7 con, tổng khối lượng bể giảm đúng 0,50 kg. |
| TC-06 | Chế độ 3A: Khách trả giá nguyên con trong hạn mức Phục vụ tự chốt (<= 5%) | 1. Tại bàn A01, chọn 'Tôm hùm bông' (giá niêm yết 1.950.000 đ/kg, giá vốn 1.450.000 đ/kg).<br>2. Chọn con '#TH-06 (0,85 kg)' -> Giá niêm yết = 0,85 × 1.950.000 = 1.657.500 đ.<br>3. Bật 'Khách trả giá nguyên con' -> Nhập giá chốt: 1.600.000 đ (giảm 57.500 đ = 3,47% <= 5%). | • Vì mức giảm 3,47% nằm trong quyền tự quyết 5% của Phục vụ, hệ thống cho phép chốt ngay lập tức với giá 1.600.000 đ mà không cần chờ duyệt. |
| TC-07 | Chế độ 3B: Khách ép giá sâu (> 5%) và Chặn bán dưới giá vốn | 1. Chọn con Tôm hùm '#TH-05 (0,78 kg)' -> Giá niêm yết = 1.521.000 đ, Giá vốn = 0,78 × 1.450.000 = 1.131.000 đ.<br>2. Thử nhập giá chốt 1.100.000 đ (thấp hơn giá vốn 1.131.000 đ).<br>3. Sau đó sửa lại giá chốt = 1.350.000 đ (giảm 11,2% — vượt 5% của Phục vụ nhưng trong hạn mức 15% của Quản lý ca). | • Ở bước 2 (nhập 1.100.000 đ): Hệ thống báo lỗi đỏ chặn tuyệt đối vì thấp hơn giá vốn nhập bể (1.131.000 đ).<br>• Ở bước 3 (nhập 1.350.000 đ): Món được thêm kèm trạng thái 'Chờ duyệt giá' và tự động đẩy yêu cầu sang màn hình Thu ngân (/cashier) & Chủ quán (/owner/approvals). |

### Nhóm 3: Kiểm thử PG Bia, Khuyến mãi Mua X Tặng Y & Đối soát Nắp lon cuối ca

| Mã TC | Mục tiêu kiểm thử | Các bước thực hiện (Input) | Số liệu kỳ vọng cần kiểm tra (Expected Output) |
| --- | --- | --- | --- |
| TC-08 | PG thêm bia & Áp dụng khuyến mãi Mua 10 Tặng 1 của hãng | 1. Mở cổng PG Bia (/pg, PIN 5555 - Ngô Thanh Thảo).<br>2. Chọn bàn A01 -> Bấm thêm 10 lon 'Bia Tiger Crystal' (25.000 đ/lon).<br>3. Khi đủ 10 lon, bấm nút 'Tặng 1 lon khuyến mãi (Mua 10 tặng 1)'. | • Trong bill bàn A01 xuất hiện: 10 lon Tiger tính tiền (10 × 25.000 = 250.000 đ) và 1 dòng riêng 'Bia Tiger Crystal (Tặng KM)' số lượng 1 lon với thành tiền = 0 đ.<br>• Kiểm tra tồn kho bia Tiger: Giảm tổng cộng 11 lon (10 lon bán + 1 lon tặng).<br>• Kiểm tra bộ đếm của PG Thảo: Sản lượng bán +10 lon, Hạn mức tặng đã dùng 1/24 lon, Số nắp cần thu hồi cuối ca = 1 nắp. |
| TC-09 | Đối soát nắp bia khuyến mãi cuối ca tại Quầy Thu ngân | 1. Cuối ca, PG Thảo vào tab 'Bàn giao nắp' trên /pg hoặc Thu ngân mở mục 'Đối soát PG' trên /cashier.<br>2. Thử nhập số nắp thực tế PG nộp = 0 nắp (thiếu 1 nắp so với 1 lon đã tặng). | • Hệ thống lập tức cảnh báo lệch thiếu 1 nắp bia khuyến mãi (tương đương 25.000 đ) để quy trách nhiệm bồi thường nếu gian lận bấm tặng khống. |

### Nhóm 4: Kiểm thử Phụ thu Phòng VIP theo Giờ & Miễn Phụ thu khi Đạt mức chi tối thiểu

| Mã TC | Mục tiêu kiểm thử | Các bước thực hiện (Input) | Số liệu kỳ vọng cần kiểm tra (Expected Output) |
| --- | --- | --- | --- |
| TC-10 | Kiểm tra tự động tính phụ thu Phòng VIP & Tự miễn phí khi tiền món >= 3.000.000 đ | 1. Kiểm tra bàn VIP 1 (hoặc mở bàn VIP 2): Cấu hình chuẩn là miễn phí 15 phút đầu, sau đó tính 100.000 đ/giờ (làm tròn lên), miễn phụ thu nếu tiền món >= 3.000.000 đ.<br>2. Khi bàn VIP ngồi > 15 phút và tiền món mới đạt 1.500.000 đ -> Xem dòng 'Phụ thu VIP' trên bill.<br>3. Thêm tiếp 1 chai rượu Chivas 18 (2.200.000 đ) để tổng tiền món lên 3.700.000 đ (>= 3.000.000 đ). | • Ở bước 2 (tiền món 1.500.000 đ < 3 triệu): Dòng 'Phụ thu phòng VIP' tự động cộng 100.000 đ/giờ vào tổng thanh toán.<br>• Ở bước 3 (tiền món 3.700.000 đ >= 3 triệu): Dòng 'Phụ thu phòng VIP' tự động nhảy về 0 đ (hiển thị nhãn 'Đã miễn phụ thu VIP do đạt mức chi tối thiểu'). |

### Nhóm 5: Kiểm thử Khóa Bill sau In tạm tính, Thanh toán VietQR Định danh & Tự chia Tiền Tip

| Mã TC | Mục tiêu kiểm thử | Các bước thực hiện (Input) | Số liệu kỳ vọng cần kiểm tra (Expected Output) |
| --- | --- | --- | --- |
| TC-11 | In phiếu tạm tính -> Tự động Khóa Bill chống sửa/xóa món ngầm | 1. Mở màn hình Thu ngân (/cashier, PIN 3333) -> Chọn bàn A01.<br>2. Bấm nút 'In tạm tính'.<br>3. Quay lại màn hình Phục vụ (/waiter) hoặc Thu ngân thử bấm xóa bớt 1 món hoặc giảm số lượng trên bàn A01. | • Ngay khi bấm 'In tạm tính', trạng thái bàn A01 chuyển sang 'Đã khóa (Chờ thanh toán)'.<br>• Mọi nút xóa món / giảm số lượng đều bị khóa cứng.<br>• Khi bấm 'Mở khóa bill' lần 1 trên máy Thu ngân (nhập lý do): Quản lý ca tự mở khóa được ngay (do hạn mức maxSelfUnlockCount = 1). Nếu bấm khóa lại rồi xin mở khóa lần thứ 2 trên cùng bill đó: Hệ thống chặn lại và bắt buộc chờ Chủ quán duyệt trên /owner/approvals. |
| TC-12 | Thanh toán VietQR 1 phần (Nhiều khách trên bàn chuyển khoản góp tiền) | 1. Giả sử tổng cần thanh toán của bàn A01 là 1.187.500 đ (mã nội dung QR: QN A01 XXXX).<br>2. Gửi gói tin Webhook (hoặc dùng chế độ ?demo=1 bấm nút chuyển 1 phần) với số tiền lần 1 = 500.000 đ kèm nội dung 'QN A01 XXXX'. | • Hệ thống KHÔNG đóng bill mà ghi nhận 'Đã thu 1 phần: 500.000 đ' và cập nhật số tiền còn thiếu = 1.187.500 - 500.000 = 687.500 đ.<br>• Mã QR trên màn hình tự động cập nhật lại số tiền cần quét tiếp theo là 687.500 đ. |
| TC-13 | Thanh toán VietQR đủ/dư tiền -> Tự động chốt Bill & Tự động tách Tiền Tip theo 3 quy chế | 1. Bàn A01 đang còn thiếu 687.500 đ. Chọn quy chế chia Tip là 'Chia đều toàn ca phục vụ (pool)'.<br>2. Khách thứ hai chuyển khoản 737.500 đ (tức là dư +50.000 đ so với 687.500 đ cần thu) với nội dung 'QN A01 XXXX'. | • Tổng thực nhận = 500.000 + 737.500 = 1.237.500 đ (vượt mức cần thu 1.187.500 đ đúng 50.000 đ).<br>• Hệ thống lập tức chốt đóng bill bàn A01, phát thông báo xanh 'THANH TOÁN VIETQR THÀNH CÔNG' trên cả máy Phục vụ & Thu ngân.<br>• Doanh thu hóa đơn ghi nhận đúng 1.187.500 đ (không bị lệch bởi tiền Tip).<br>• Khoản dư 50.000 đ tự động hạch toán vào quỹ Tiền Tip và chia đều cho các nhân viên phục vụ đang trong ca (kiểm tra ngay tại /owner/hr cột Thưởng & Tip tăng thêm đúng 50.000 đ).<br>• Bàn A01 chuyển sang trạng thái 'Cần dọn' (và tự động về 'Trống' sau 10 phút). |
| TC-14 | Gộp bàn (Merge Tables) & Kiểm tra nhận diện mã QR của cả bàn cũ lẫn bàn mới | 1. Mở bàn A02 và bàn A03, gọi món trên cả 2 bàn.<br>2. Trên /cashier, thực hiện 'Gộp bàn' A03 vào A02.<br>3. Khách cầm phiếu tạm tính cũ của bàn A03 quét mã QR (mang nội dung mã cũ của bàn A03). | • Khi gộp bàn, mã thanh toán của A03 được lưu vào danh sách mergedPayCodes của bill A02.<br>• Khi khách chuyển khoản theo mã QR của A03 hay A02, hệ thống đều nhận diện đúng bill gộp của bàn A02 và tự động chốt thanh toán chính xác. |

### Nhóm 6: Kiểm thử Báo hỏng, Kiểm kho mù cuối ca & Công thức Đối soát Tồn kho 4 Lớp

| Mã TC | Mục tiêu kiểm thử | Các bước thực hiện (Input) | Số liệu kỳ vọng cần kiểm tra (Expected Output) |
| --- | --- | --- | --- |
| TC-15 | Báo hỏng nguyên liệu kèm ảnh chụp Camera & Kiểm tra ngưỡng tự duyệt | 1. Mở Kiosk (/kiosk, PIN 6666) -> Tab 2 'Báo hỏng nguyên liệu'.<br>2. Chọn 'Hải sản bể' -> Chọn 'Cá chẽm' -> Chọn 1 con (0,92 kg, giá vốn 210.000 đ/kg -> Giá trị hỏng = 193.200 đ > ngưỡng tự duyệt 100.000 đ).<br>3. Chọn lý do 'Cá chết trong bể' -> Bấm đính kèm ảnh chụp -> Bấm 'Ghi nhận hỏng & Trừ tồn'. | • Tồn bể Cá chẽm giảm ngay 1 con (0,92 kg) để Phục vụ không bán nhầm cá chết.<br>• Vì 193.200 đ > 100.000 đ, phiếu báo hỏng ở trạng thái 'Chờ duyệt' và xuất hiện tại /owner/approvals.<br>• Chủ quán vào /owner/approvals bấm 'Xem ảnh' (thấy đúng bức ảnh đã tải lên) -> Bấm 'Duyệt' -> Chi phí hao hụt trong báo cáo Lãi lỗ tăng đúng 193.200 đ. |
| TC-16 | Kiểm kho mù cuối ca (Blind Count) & Đối chiếu công thức Tồn kho 4 Lớp | 1. Mở /kiosk -> Tab 3 'Nhập & Kiểm kho' -> Chọn 'Kiểm kho cuối ca'.<br>2. Quan sát giao diện: Không hiển thị số tồn trên máy.<br>3. Nhập số đếm thực tế cho 'Tôm hùm bông' thấp hơn số thực còn trong bể 1 con (0,70 kg) -> Bấm 'Nộp kết quả kiểm kho'.<br>4. Mở /owner/inventory (tab Đối soát 4 lớp). | • Ngay sau khi bấm Nộp, bảng kiểm kho trên Kiosk bị khóa cứng (không thể sửa lại số đã nộp).<br>• Tại /owner/inventory, kiểm tra dòng 'Tôm hùm bông' khớp tuyệt đối công thức:<br>  [Tồn lý thuyết] = [Đầu kỳ] + [Nhập] - [Bán] - [Hao hụt đã duyệt].<br>  [Chênh lệch] = [Kiểm thực tế] - [Tồn lý thuyết] = -1 con (-0,70 kg).<br>• Vì lệch 1 con vượt dung sai cho phép (0 con), hệ thống tự động tạo yêu cầu giải trình tại /owner/approvals. Khi Chủ quán tích chọn 'Trừ lương người kiểm' và bấm Duyệt, số tiền đền bù tự động cộng vào cột 'Phạt & Đền' trong bảng lương của Hoàng Văn Long. |

### Nhóm 7: Kiểm thử Chấm công, Chặn Tăng ca sau Bàn cuối, Bảng lương & Báo cáo Lãi lỗ / Thuế

| Mã TC | Mục tiêu kiểm thử | Các bước thực hiện (Input) | Số liệu kỳ vọng cần kiểm tra (Expected Output) |
| --- | --- | --- | --- |
| TC-17 | Kiểm chứng quy tắc Chặn tự tính tăng ca sau bàn cuối (cleanupBuffer = 30 phút) | 1. Giả sử hóa đơn cuối cùng trong ngày đóng lúc 22:00.<br>2. Nhân viên phục vụ Đỗ Văn Nam chấm công ra ca lúc 23:15 (tức là muộn 75 phút sau khi bàn cuối cùng đã về, vượt quá 30 phút dọn dẹp cho phép là 22:30). | • Hệ thống chỉ tự động tính giờ công chuẩn đến 22:30.<br>• Khoảng thời gian 45 phút dôi ra (từ 22:30 đến 23:15) bị gắn trạng thái 'Chờ duyệt tăng ca' và đẩy lên /owner/approvals. Chỉ khi Chủ quán bấm Duyệt thì 45 phút này mới được nhân hệ số 1,5 vào lương. |
| TC-18 | Kiểm chứng công thức Bảng lương (/owner/hr) | Mở /owner/hr -> Bấm vào tên một nhân viên bất kỳ để mở 'Phiếu lương chi tiết'. | • Kiểm tra tổng Thực lĩnh khớp chính xác công thức:<br>  [Thực lĩnh] = [Lương cơ bản theo ngày/giờ công] + [Lương tăng ca & Phụ cấp ca đêm] + [Hoa hồng bán bia] + [Tiền Tip được chia] - [Phạt đi trễ] - [Đền bù thất thoát kho] - [Tiền đã ứng trong tháng]. |
| TC-19 | Kiểm chứng công thức Báo cáo Lãi lỗ P&L (/owner/sales) & Báo cáo Thuế (/owner/tax) | 1. Mở /owner/sales -> Xem bảng Báo cáo Lãi lỗ (P&L).<br>2. Mở /owner/tax -> Xem Bảng kê thuế GTGT & Thuế khoán HKD. | • Tại /owner/sales, kiểm tra:<br>  [Doanh thu thuần] = [Doanh thu món ăn] + [Doanh thu đồ uống] + [Phụ thu VIP] - [Giảm giá].<br>  [Lãi gộp] = [Doanh thu thuần] - [Giá vốn hàng bán (COGS)].<br>  [Lợi nhuận ròng (Net Profit)] = [Lãi gộp] - [Chi phí nhân sự] - [Chi phí hao hụt] - [Chi phí phụ phẩm điện/nước/gas].<br>• Tại /owner/tax, kiểm tra:<br>  - Doanh thu nhóm Đồ ăn & Nước ngọt tách riêng và tính đúng thuế GTGT 8%.<br>  - Doanh thu nhóm Rượu & Bia tách riêng và tính đúng thuế GTGT 10%.<br>  - Thuế khoán Hộ kinh doanh = 4,5% × Tổng doanh thu (gồm 3% GTGT + 1,5% TNCN). |

---
