# KỊCH BẢN BÀN GIAO HỆ THỐNG TỪ A ĐẾN Z CHO CHỦ QUÁN & HƯỚNG DẪN KẾT NỐI MÁY IN NHIỆT

Tài liệu này được biên soạn theo đúng trình tự một buổi ngồi bàn giao trực tiếp tại quán (khoảng 30 - 45 phút). Bạn chỉ cần mở trang web chính thức **https://munbao.com** trên máy tính thu ngân và điện thoại của Chủ quán, sau đó đi lần lượt từng bước từ Bước 1 đến Bước 6 dưới đây.

---

## PHẦN MỞ ĐẦU: CÁCH GIỚI THIỆU TỔNG QUAN TRONG 2 PHÚT ĐẦU

**Câu nói gợi ý với Chủ quán:**
> "Anh/Chị mở trình duyệt Chrome hoặc Safari vào thẳng địa chỉ **https://munbao.com** (không cần cài phần mềm lên điện thoại). Toàn bộ quán dùng chung 1 đường dẫn duy nhất là **https://munbao.com/login**, ai có mã PIN 4 số của bộ phận nào thì khi bấm vào sẽ tự động mở đúng màn hình công việc của người đó:
> - **Chủ quán & Kế toán:** Xem doanh thu, lãi lỗ thời gian thực, duyệt hủy món/hao hụt, xem ảnh chấm công và cài đặt toàn bộ giá cả, thực đơn.
> - **Thu ngân kiêm Quản lý ca:** Sơ đồ bàn tại quầy, in phiếu tạm tính K80, thu tiền, mở/chốt ca kiểm đếm tiền mặt.
> - **Phục vụ & PG Bia:** Dùng ngay trên điện thoại cá nhân để chấm công bằng camera trước, mở bàn, gọi món tại bàn và đưa mã QR cho khách thanh toán.
> - **Hồ hải sản & Bếp:** Đặt 1 máy tính bảng ở khu vực cân cá để cân ký hải sản sống, nhập kho và kiểm kho mù cuối ca. Còn trong Bếp nấu nếu chỉ cần nhận phiếu chế biến thì chỉ cần cắm 1 máy in nhiệt mạng LAN là phiếu tự động chạy ra và cắt giấy ngay khi Phục vụ bấm gửi món.
> - **Khách hàng:** Vào đường dẫn **https://munbao.com/customer** để tự đặt bàn trước, chuyển cọc giữ chỗ, tra cứu chai rượu gửi và tự xuất hóa đơn đỏ VAT trong 24 giờ."

---

## BƯỚC 1: XÓA DỮ LIỆU MẪU & ĐỔI MÃ PIN CHỦ QUÁN (5 PHÚT)

1. Mở **https://munbao.com/login**, nhập mã PIN mặc định của Chủ quán là **`1111`**.
2. Để xóa sạch dữ liệu mẫu trước giờ mở bán thật:
   - Mở tạm đường dẫn quản trị **https://munbao.com/owner?demo=0** (hoặc tại thanh công cụ quản trị dữ liệu khi mở `https://munbao.com/?demo=1` để kiểm thử, còn trên bản thật bạn bấm vào mục **Thiết lập** kiểm tra danh sách trước, sau đó nếu đang còn đơn mẫu thử nghiệm thì vào **Quản trị dữ liệu -> Khởi tạo Quán Mới**).
   - Hệ thống sẽ xóa sạch toàn bộ bill mẫu, lịch sử 60 ngày mẫu và yêu cầu duyệt mẫu; đồng thời giữ nguyên sơ đồ bàn, thực đơn khung và danh sách vị trí để không phải nhập lại từ đầu.
3. **Đổi ngay mã PIN của Chủ quán để bảo mật:**
   - Vào menu bên trái **Thiết lập** -> chọn nhóm **Nhân viên**.
   - Bấm nút **Sửa** ở dòng tài khoản **Chủ quán**, đổi tên thật của Chủ quán, số điện thoại và đổi mã PIN 4 số riêng (ví dụ `8899`, không dùng `1111` mặc định).
   - Lần lượt thêm hoặc sửa tên, mức lương (theo giờ hoặc theo tháng), ca làm việc và cấp mã PIN 4 số riêng cho từng nhân viên Thu ngân, Phục vụ, Hồ cá, Bếp.

---

## BƯỚC 2: CÀI ĐẶT THÔNG TIN QUÁN, SƠ ĐỒ BÀN & THỰC ĐƠN (10 PHÚT)

Vẫn ở mục **Thiết lập** của màn hình Chủ quán, bạn hướng dẫn Chủ quán đi từ trên xuống dưới:

1. **Thông tin quán (Nhóm Máy in & Mẫu bill -> Thông tin quán):**
   - Nhập đúng **Tên quán**, **Địa chỉ**, **Số điện thoại hotline**, **Mã số thuế** (nếu có).
   - Nhập **Tên Wi-Fi cho khách** và **Mật khẩu Wi-Fi cho khách** (hai thông tin này sẽ tự động in ở chân phiếu tạm tính và hóa đơn để khách không phải hỏi nhân viên).
2. **Khu vực & Sơ đồ bàn (Nhóm Sơ đồ bàn):**
   - Sửa tên các khu vực đúng thực tế quán (ví dụ: Sân vườn, Trong nhà, Phòng VIP).
   - Thêm/xóa mã bàn (`A01`, `A02`, `VIP 1`...) và số ghế tương ứng.
   - Nếu quán có Phòng VIP tính phụ thu theo giờ: điền **Giá phụ thu mỗi giờ** và **Mức chi tiêu tối thiểu được miễn phụ thu VIP** (ví dụ: ăn trên 3.000.000 đ hệ thống tự động gạch bỏ tiền phòng VIP).
3. **Thực đơn & Định mức nguyên liệu (Nhóm Thực đơn & Giá):**
   - Cập nhật tên món, giá bán, giá vốn ước tính.
   - Với **Hải sản sống tại bể** (Cá mú, Tôm hùm, Cua, Ốc hương...): chọn loại món là *Hải sản cân ký*, nhập đơn giá trên 1 kg và tích chọn các kiểu chế biến (Hấp Hồng Kông, Rang me, Nướng mọi, Nấu lẩu...).
   - Sau khi chỉnh xong bất kỳ mục nào, nhắc Chủ quán bấm nút màu xanh **Lưu và áp dụng** ở thanh dưới cùng màn hình.

---

## BƯỚC 3: CÀI ĐẶT TÀI KHOẢN VIETQR, NHẬN TIỀN TIP TỰ DO & TỰ ĐỘNG BÁO ĐỦ TIỀN (5 PHÚT)

**Câu nói giải thích cơ chế Tiền Tip trên QR cho Chủ quán:**
> "Trước đây nếu mã QR khóa chết số tiền đúng bằng tiền bill (ví dụ 1.250.000 đ) thì khách muốn cho thêm nhân viên 50.000 đ tiền Tip cũng không sửa số tiền trên App ngân hàng được. Hệ thống hiện tại đã thiết lập chuẩn cho quán nhậu:
> 1. Khi khách quét mã VietQR trên tờ Tạm tính hoặc trên điện thoại Phục vụ, **Nội dung chuyển khoản được khóa cố định theo mã riêng của từng bàn** (ví dụ `QN A05 KA05`), còn **ô Số tiền được mở tự do**.
> 2. Khách chỉ cần nhập số tiền **lớn hơn hoặc bằng tiền bill** (ví dụ bill 1.250.000 đ, khách nhập 1.300.000 đ): hệ thống tự động đối chiếu đúng mã `QN A05 KA05`, báo **THANH TOÁN THÀNH CÔNG** ngay lập tức lên máy Phục vụ và Thu ngân, đóng bàn luôn và tự động tách 50.000 đ dư vào quỹ **Tiền Tip** theo đúng quy chế Chủ quán chọn!"

**Thao tác cài đặt thực tế:**
1. Vào **Thiết lập -> Máy in & Mẫu bill -> Tài khoản nhận VietQR**:
   - Chọn đúng **Ngân hàng**, nhập **Số tài khoản** và **Tên chủ tài khoản** nhận tiền của quán.
   - Nhìn khung **Xem trước mã VietQR** bên phải, dùng điện thoại Chủ quán mở App ngân hàng quét thử ngay tại chỗ để kiểm tra: đúng tên chủ tài khoản, nội dung điền sẵn, ô số tiền cho phép gõ tự do.
2. Tại mục **Mẫu bill K80**:
   - Công tắc **Khóa cố định số tiền trong mã VietQR thanh toán** mặc định đang **TẮT** (để khách nhập tự do nhận Tip). Nếu sau này Chủ quán muốn khóa cứng số tiền không nhận Tip qua QR thì chỉ cần gạt bật công tắc này lên.
3. Tại mục **Tính lương & Quy chế chia Tiền Tip (Nhóm Ca làm & Lương)**:
   - Cho Chủ quán chọn 1 trong 3 cách chia tiền Tip chuyển khoản:
     - *Nhân viên đứng bàn nhận 100%*
     - *Chia đều toàn ca phục vụ đang làm việc*
     - *Chia theo tổ phụ trách khu vực bàn*
4. **Kết nối tự động báo biến động số dư (SePay / Casso) — nếu Chủ quán dùng gói tự động khớp 1 giây:**
   - Đăng ký tài khoản SePay (`sepay.vn`) hoặc Casso (`casso.vn`) gắn với tài khoản ngân hàng của quán.
   - Tại trang cấu hình Webhook của SePay/Casso, dán đường dẫn nhận thông báo: **`https://munbao.com/api/webhooks/payment`**.
   - Đặt một mã khóa bảo mật (Secret Key / API Key) giống nhau ở cả SePay/Casso và ô **Khóa bảo mật Webhook** trong **Thiết lập -> Cổng thanh toán & Webhook Biến động số dư**, rồi bấm **Lưu và áp dụng**.
   - *(Lưu ý: Ngay cả khi quán chưa đăng ký SePay/Casso, Phục vụ và Thu ngân vẫn bấm nút **"Xác nhận khách đã chuyển khoản đủ"** bằng tay bình thường 100%).*

---

## BƯỚC 4: CÀI ĐẶT CHẤM CÔNG THẬT 100% — KHÓA MẠNG WI-FI QUÁN, TỌA ĐỘ GPS & CAMERA SELFIE (5 PHÚT)

Hệ thống đã bỏ hoàn toàn chế độ mô phỏng thử nghiệm và chuyển sang **xác thực phần cứng thực tế 3 lớp**: Địa chỉ IP mạng Wi-Fi quán + Định vị GPS thực tế từng mét + Chụp ảnh khuôn mặt trực tiếp bằng camera trước.

**Thao tác cầm tay chỉ Chủ quán làm đúng 1 lần ngay tại quán:**
1. Kết nối điện thoại (hoặc laptop đang ngồi tại quán) vào đúng mạng **Wi-Fi nội bộ của quán** mà nhân viên sẽ dùng để chấm công.
2. Mở **Chủ quán -> Thiết lập -> Ca làm & Lương -> Chấm công và đi trễ**.
3. Nhìn sang khung **Thiết lập nhanh tại quán (1 chạm)** ở bên phải:
   - **Bấm nút 1: `Gắn IP Wi-Fi hiện tại làm mạng quán`** -> Hệ thống tự động đọc địa chỉ IP đường truyền Internet hiện tại của quán và điền vào ô khóa mạng. (Nếu nhân viên ở nhà bật 4G hoặc tự đặt tên Wi-Fi ở nhà trùng tên Wi-Fi quán cũng sẽ bị chặn ngay vì khác địa chỉ IP).
   - **Bấm nút 2: `Lấy tọa độ GPS hiện tại làm vị trí quán`** -> Trình duyệt hỏi quyền Vị trí, bấm **Cho phép (Allow)** -> Hệ thống tự động điền chính xác Vĩ độ và Kinh độ tâm quán (6 chữ số thập phân).
4. Chỉnh **Bán kính cho phép** (ví dụ `50 m` hoặc `80 m` nếu mặt bằng sân vườn rộng), chỉnh **Số phút cho phép đi trễ** (ví dụ `5 phút`) và các bậc phạt đi trễ.
5. Bấm **Lưu và áp dụng**.
6. **Kiểm tra ngay trên điện thoại nhân viên:**
   - Đăng nhập mã PIN Phục vụ -> sang tab **Cá nhân** -> bấm **Chấm công vào ca**.
   - Điện thoại hỏi quyền Vị trí (Location) và Máy ảnh (Camera) -> nhắc nhân viên bấm **Cho phép (Allow)**.
   - Chụp ảnh khuôn mặt trực tiếp -> bấm **Xác nhận vào ca**.
   - Mở lại màn hình **Chủ quán -> Nhân sự & Bảng lương -> Nhật ký chấm công gần đây**: cho Chủ quán bấm nút **Xem ảnh** để thấy ngay ảnh chụp khuôn mặt thật, khoảng cách GPS và địa chỉ IP của nhân viên!

---

## BƯỚC 5: KẾT NỐI MÁY IN NHIỆT K80 TỪ A ĐẾN Z (BẾP TỰ ĐỘNG IN 100% & QUẦY THU NGÂN) (10 PHÚT)

### Giải đáp nguyên tắc vận hành cho Bếp:
- **Câu hỏi thường gặp:** *"Bên Bếp chỉ cần lắp duy nhất 1 máy in nhiệt, hễ Phục vụ bấm order món là máy in đó tự động chạy ra giấy luôn chứ không cần đặt máy tính hay bấm nút gì ở Bếp đúng không?"*
- **Trả lời khẳng định:** **ĐÚNG 100%!** Khu vực Bếp **không cần đặt máy tính, không cần người đứng bấm in**. Chỉ cần đặt **1 máy in nhiệt khổ K80 có cổng mạng LAN** (loại phổ biến ở các quán nhậu như Xprinter XP-N160II, XP-Q200, XP-Q80B, Zywell ZY307, Epson TM-T82... giá khoảng 1,1 - 1,8 triệu đồng), cắm dây mạng LAN từ máy in vào cục Router/Switch Wi-Fi của quán là xong.
  - Với **món ăn thường** (nướng, lẩu, xào, khai vị): Phục vụ vừa bấm **Gửi bếp** trên điện thoại -> sau **1,5 giây** máy in trong Bếp tự kêu *"Bíp bíp bíp"*, in phiếu chữ to rõ tên bàn + tên món + ghi chú và tự cắt giấy.
  - Với **hải sản sống tính theo ký**: Phục vụ bấm gọi -> Hồ cá bắt cá lên cân xong bấm xác nhận ký -> máy in Bếp lập tức tự động in phiếu chế biến kèm số ký để Bếp nấu.

---

### Hướng dẫn lắp đặt thực tế từng bước:

#### 5.1. Lấy địa chỉ IP của máy in nhiệt mạng LAN (2 phút)
1. Lắp cuộn giấy in nhiệt K80 vào máy in, cắm dây nguồn và cắm dây mạng LAN từ cổng mạng sau lưng máy in vào cục mạng Wi-Fi của quán.
2. **Cách xem số IP hiện tại của máy in (áp dụng cho mọi dòng máy in nhiệt K80):**
   - Tắt công tắc nguồn máy in.
   - Một tay **ấn giữ nút `FEED`** (nút đẩy giấy trên mặt máy in), tay kia **bật công tắc nguồn** lên, giữ thêm 2 giây rồi thả nút `FEED` ra.
   - Máy in sẽ tự chạy ra 1 tờ giấy kiểm tra thông số (*Self-Test Page*). Nhìn dòng **`IP Address`** trên tờ giấy đó (thường là dạng `192.168.1.201` hoặc `192.168.1.100`, và `Port: 9100`).
   - *(Lưu ý: Nếu tờ giấy ghi IP khác lớp mạng Wi-Fi của quán — ví dụ Wi-Fi quán là `192.168.0.x` mà máy in là `192.168.1.100` — dùng công cụ đổi IP kèm theo đĩa/trang web hãng Xprinter đổi 1 lần sang cùng dải số mạng của quán).*

#### 5.2. Cài đặt chế độ "1 máy in Bếp duy nhất" trên giao diện Chủ quán (2 phút)
1. Mở **Chủ quán -> Thiết lập -> Máy in & Mẫu bill**.
2. Tại bảng **Máy in**:
   - Ở dòng **Máy in bếp nóng** (`Bếp`), nhập đúng số IP vừa xem trên tờ giấy vào cột **IP LAN** (ví dụ `192.168.1.201`) và cột **Cổng** để mặc định là **`9100`**.
   - Nếu tại Quầy thu ngân cũng dùng máy in mạng LAN: nhập luôn số IP của máy in quầy (ví dụ `192.168.1.200`) vào dòng **Máy in quầy thu ngân**.
   - Nếu quán không dùng riêng máy in Bếp nướng / Quầy bar / Hồ cá: gạt tắt nút **Kết nối** ở các dòng máy không lắp thật, hoặc bấm biểu tượng thùng rác xóa bớt cho gọn.
3. Kéo xuống ngay bảng **Định tuyến phiếu bếp** bên dưới:
   - Bấm đúng 1 nút ở góc phải tiêu đề thẻ: **`Chế độ 1 máy in Bếp duy nhất (Gộp mọi món ăn về Bếp)`**.
   - Toàn bộ các nhóm món ăn (Món nhanh, Đồ nướng, Lẩu, Hải sản...) sẽ tự động gom hết về 1 máy in Bếp đó!
4. Bấm nút **Lưu và áp dụng** ở cuối màn hình.

#### 5.3. Bật cầu nối tự động in trên máy tính Thu ngân (3 phút — chỉ cài 1 lần duy nhất)
Vì website **https://munbao.com** chạy trên máy chủ đám mây Internet còn máy in nhiệt nằm trong mạng Wi-Fi nội bộ của quán, máy tính đặt tại Quầy thu ngân sẽ đóng vai trò cầu nối chuyển lệnh in ngầm xuống các máy in LAN trong quán:

1. Ngồi tại máy tính Windows ở Quầy thu ngân (đang kết nối cùng mạng Wi-Fi/LAN với máy in Bếp).
2. Đảm bảo máy tính đã cài **Python 3** (nếu chưa có, tải miễn phí tại `https://www.python.org/downloads/`, lúc cài nhớ tích ô **"Add Python to PATH"** rồi bấm Install Now — mất 1 phút).
3. Mở **Chủ quán -> Thiết lập -> Máy in**, bấm nút **`Tải bộ kết nối máy in LAN (.zip)`** ngay góc trên bảng Máy in.
4. Giải nén tệp `QuanNhau_MayIn_LAN.zip` ra ổ đĩa (ví dụ `C:\QuanNhau_MayIn_LAN\`), bên trong có sẵn 3 tệp:
   - `CHAY_KET_NOI_MAY_IN_LAN.bat`: Bấm đúp vào tệp này -> một cửa sổ đen hiện lên báo **`[San sang] Dang lang nghe lenh in tu he thong...`**. Thu nhỏ cửa sổ này xuống thanh Taskbar.
   - `CAI_TU_KHOI_DONG_CUNG_WINDOWS.bat`: Bấm đúp 1 lần vào tệp này -> từ ngày mai trở đi, hễ nhân viên thu ngân bật nút nguồn máy tính lên là cầu nối máy in **tự động chạy ngầm** luôn, không cần mở tay nữa!
5. **Bấm in thử kiểm tra ngay:**
   - Trên màn hình **Thiết lập -> Máy in**, bấm biểu tượng **Hình máy in (In thử)** ở dòng Máy in Bếp -> sau chưa đầy 2 giây, máy in trong Bếp kêu *"Bíp bíp bíp"* và chạy ra tờ **`PHIẾU IN THỬ KẾT NỐI`** cắt giấy gọn gàng!

#### 5.4. Trường hợp máy in Quầy thu ngân cắm bằng dây USB (không có cổng mạng LAN)
Nếu máy in hóa đơn tại Quầy thu ngân là loại rẻ chỉ có dây **USB** cắm thẳng vào máy tính Thu ngân (còn máy Bếp vẫn dùng dây LAN):
1. Cài Driver Windows của máy in USB đó và chuột phải đặt làm **Máy in mặc định (Set as Default Printer)** trên Windows, khổ giấy 80mm.
2. Trên màn hình máy tính (Desktop), chuột phải vào biểu tượng trình duyệt **Google Chrome** -> chọn **Properties** -> ở ô **Target**, gõ thêm dấu cách và dòng chữ `--kiosk-printing` vào cuối cùng (ví dụ: `"C:\Program Files\Google\Chrome\Application\chrome.exe" --kiosk-printing`) -> bấm **OK**.
3. Mở Google Chrome từ biểu tượng đó vào màn hình **Thu ngân (`https://munbao.com/cashier`)** -> bấm nút **Lịch sử in K80** trên thanh trên cùng -> bấm bật nút **`Đang BẬT tự động in`**. Từ lúc đó, mỗi khi Thu ngân bấm **In tạm tính** hoặc **Thanh toán & In hóa đơn**, máy in USB tại quầy đẩy hóa đơn ra ngay lập tức mà không hiện hộp thoại hỏi xác nhận!

---

## BƯỚC 6: DIỄN TẬP NGHIỆM THU 5 PHÚT CÙNG CHỦ QUÁN TRƯỚC KHI BÀN GIAO

Trước khi kết thúc buổi bàn giao, bạn cùng Chủ quán làm đúng 1 vòng khép kín 6 bước sau (mất đúng 5 phút):

1. **Chấm công thật:** Lấy điện thoại Phục vụ vào `https://munbao.com/login` -> nhập PIN Phục vụ -> vào **Cá nhân -> Chấm công vào ca** -> kiểm tra xanh cả 3 mục (Wi-Fi quán + GPS + Chụp ảnh mặt) -> xác nhận vào ca.
2. **Mở bàn & Gọi món:** Mở bàn `A01` (4 khách), chọn 2 món ăn thường + 10 lon bia -> bấm **Gửi bếp** -> nghe máy in trong Bếp kêu bíp và tự cắt phiếu món ăn ra ngay!
3. **Cân hải sản (nếu quán bán hải sản sống):** Gọi thêm 1 con Cá mú -> qua máy tính bảng Hồ cá (`/kiosk`) nhập số ký -> bấm xác nhận -> phiếu chế biến cá kèm số ký tự động in ra tại Bếp và tiền cá tự nhảy vào bill bàn `A01`.
4. **In tạm tính & Khóa bill chống sửa món:** Qua màn hình Thu ngân (`/cashier`) bấm **In tạm tính (F2)** -> tờ phiếu tạm tính K80 in ra có sẵn mã **VietQR** của quán, kiểm tra thấy bàn `A01` chuyển sang màu đỏ **Đã khóa** (Phục vụ không thể tự ý xóa món sau khi đã đưa giấy cho khách).
5. **Quét mã VietQR kèm Tiền Tip:** Dùng điện thoại quét mã QR trên tờ phiếu -> kiểm tra thấy **Nội dung chuyển khoản giữ cố định mã bàn**, còn **ô Số tiền để trống cho nhập tự do** -> xác nhận thu tiền (kèm thử 20.000 đ tiền Tip) -> kiểm tra hóa đơn thanh toán in ra có mã QR để khách tự xuất hóa đơn VAT.
6. **Đối soát trên điện thoại Chủ quán:** Chủ quán mở điện thoại cá nhân vào `https://munbao.com/owner` -> thấy ngay doanh thu bàn `A01`, lãi gộp ước tính, tồn kho bia tự động trừ 10 lon, tiền Tip 20.000 đ cộng vào bảng lương nhân viên và ảnh chấm công hiển thị rõ nét.

*(Sau khi kiểm tra xong vòng thử nghiệm này, nếu muốn xóa đơn thử `A01` để chiều mở hàng từ con số 0 tròn trĩnh, vào lại mục Khởi tạo Quán Mới bấm làm sạch 1 lần cuối cùng — toàn bộ cài đặt máy in, ngân hàng, Wi-Fi, GPS, thực đơn và nhân sự vừa thiết lập vẫn được giữ nguyên 100%!).*
