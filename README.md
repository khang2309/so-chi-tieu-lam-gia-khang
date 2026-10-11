# Sổ Chi Tiêu của Lâm Gia Khang 📒✨

Ứng dụng quản lý tài chính cá nhân mang phong cách **"Sổ Giấy Đương Đại"** (Contemporary Paper Journal), hỗ trợ chạy trên nền tảng Web/Local và sẵn sàng đóng gói thành ứng dụng Android (APK) thông qua Capacitor & GitHub Actions.

---

## 🎨 Điểm nổi bật về Giao diện & Trải nghiệm
- **Phong cách Sổ Giấy Đương Đại:**
  - Nền giấy ấm: `#fdf8f0`
  - Văn bản màu nâu đen mực cổ điển: `#3e332a`
  - Văn bản màu nâu nhạt: `#7a6a58`
  - Các đường kẻ tinh tế (`paper-lined-bg`) tại phần hiển thị số dư mang lại cảm giác mở một cuốn sổ tay cá nhân ghi chép thủ công.
  - Bộ icon sinh động từ thư viện `lucide-react`.
  - Tối ưu giao diện Mobile Responsive và chuẩn safe-area cho ứng dụng di động.

---

## 🚀 Tính năng Cốt lõi (Lưu trữ toàn bộ qua LocalStorage)
1. **Quản lý Sổ chi tiêu độc lập (Ledgers):**
   - 3 Sổ mặc định:
     1. `Chi tiêu cá nhân`: Ăn uống, sinh hoạt cá nhân hằng ngày.
     2. `Tiền trọ`: Quản lý tiền phòng, điện, nước, mạng chia 3 người.
     3. `Chi tiêu ở quê`: Gửi biếu gia đình, chi phí sắm sửa ở quê.
   - Chuyển đổi linh hoạt giữa các sổ hoặc xem tổng hợp "Tất cả các sổ".
   - Thêm, sửa, xóa các cuốn sổ mới tùy ý.

2. **Tiện ích Đặc Biệt cho Sổ Tiền Trọ (Roommate Split Calculator):**
   - Nhập tiền phòng cố định.
   - Tự động tính số điện (chỉ số mới - cũ x đơn giá kWh).
   - Tự động tính số nước (chỉ số mới - cũ x đơn giá khối).
   - Phí Internet & rác dịch vụ.
   - Tự động chia đều cho 3 người (Lâm Gia Khang + 2 bạn trọ).
   - **1-Click:** Tự động ghi khoản phải đóng vào sổ "Tiền trọ" trừ ví tương ứng.
   - **1-Click:** Sao chép bảng kê chi tiết để dán vào tin nhắn nhóm Zalo/Messenger phòng trọ.

3. **Quản lý Nguồn tiền & Ví (Wallets):**
   - 6 Ví mặc định: `Tiền mặt`, `MB Bank`, `Timo`, `BIDV`, `Sacombank`, `MoMo`.
   - Tính năng **Nút gạt (Toggle) "Tính tổng tất cả các ví"** ngay màn hình chính.
   - Khi tắt toggle: Người dùng có thể chọn xem chi tiết số dư và giao dịch của từng ví riêng lẻ.
   - Hỗ trợ chuyển tiền nội bộ giữa 2 ví (ví dụ: rút ATM từ MB Bank ra Tiền mặt, nạp MoMo...).

4. **Quản lý Danh mục (Custom Categories):**
   - Danh mục mặc định: Ăn, Uống, Mua sắm, Cắt tóc, Đồ điện tử, Đồ gia dụng, Xăng xe (Yamaha Janus), Hóa đơn, Tiền lương.
   - Thêm / Sửa / Xóa danh mục chi tiêu & thu nhập dễ dàng.

5. **Quản lý Giao dịch & Quét hóa đơn (Transactions & Smart OCR):**
   - Thêm / Sửa / Xóa giao dịch thu, chi, chuyển ví.
   - Nút **"Quét hóa đơn"**: Hỗ trợ chụp/tải ảnh hóa đơn hoặc chọn mẫu hóa đơn (Xăng Petrolimex, Bách Hóa Xanh, Cafe Highlands, Barbershop), tự động trích xuất số tiền, ngày và danh mục để điền vào form giao dịch.

6. **Thống kê & Bộ lọc thời gian (Dashboard Statistics):**
   - Tổng thu, Tổng chi, Số dư thực tế, Khoản tiết kiệm/dư trong kỳ.
   - Bộ lọc thời gian theo: Tuần (Week), Tháng (Month), Năm (Year), hoặc Tất cả (All).
   - Biểu đồ phân bổ chi tiêu theo danh mục (tỉ lệ % và số tiền).

7. **Sao lưu & Phục hồi dữ liệu:**
   - Xuất dữ liệu JSON dự phòng.
   - Nhập file JSON khôi phục dữ liệu.
   - Đặt lại dữ liệu gốc ban đầu bất cứ lúc nào.

---

## 💻 Hướng dẫn Chạy Trực Tiếp (Local Web)
```bash
# 1. Cài đặt các thư viện (đã cài sẵn)
npm install

# 2. Khởi chạy server phát triển
npm run dev

# 3. Mở trình duyệt tại:
http://localhost:3000
```

---

## 📱 Đóng gói Ứng dụng Android (Capacitor)
Dự án đã được cấu hình với App ID: `com.lamgiakhang.sochitieu`.

```bash
# 1. Build ứng dụng Web
npm run build

# 2. Đồng bộ mã nguồn sang thư mục native Android
npx cap sync android

# 3. Mở dự án trong Android Studio để chạy máy ảo hoặc cắm cáp nạp điện thoại:
npx cap open android
```

---

## 🤖 Tự động xuất file APK qua GitHub Actions
File cấu hình CI/CD đã được tạo sẵn tại `.github/workflows/build-apk.yml`.

Khi bạn đẩy code lên repository GitHub (nhánh `main` hoặc `master`), GitHub Actions sẽ:
1. Cài đặt Node.js 18 & build web frontend (`npm run build`).
2. Cài đặt Java JDK 17 & đồng bộ Capacitor (`npx cap sync android`).
3. Chạy lệnh Gradle `./gradlew assembleDebug` để sinh file `app-debug.apk`.
4. Xuất file APK lên mục **Artifacts** của GitHub Actions để tải về cài trực tiếp vào điện thoại Android.
