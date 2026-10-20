# Rà soát SaaS Admin — 20/10/2026

Phạm vi: `estude-saas-admin`, đối chiếu control API tại `estude-saas-backend`. Không thay đổi frontend trường hoặc API nghiệp vụ.

## Tính năng hiện có

- Phiên quản trị riêng: đăng nhập, đăng xuất, refresh token; không dùng phiên của trường.
- Tổng quan, tìm kiếm/lọc trạng thái/phân trang trường; tạo trường chạy nền.
- Chỉnh tên/subdomain/tên miền, nhận diện, khóa/mở trường; lưu các phần cùng một transaction, kiểm tra revision và xác nhận thay đổi địa chỉ/trạng thái.
- Tạo gói, gán gói, sửa trạng thái đăng ký, gia hạn kỳ hết hạn; xem quota đã dùng/đang giữ/hạn mức.
- Cấu hình tên miền mặc định và xem trước bốn portal.

## Lỗi và thiếu nhất quán đã sửa

1. Form tạo gói chưa bảo vệ bản nháp và có thể đóng trong lúc lưu: dùng cơ chế xác nhận bỏ thay đổi của Modal, khóa cả form khi gửi và chặn gửi trùng.
2. Cấu hình tên miền có thể báo thành công dù không tải lại được revision mới: phân biệt đã ghi thành công với lỗi đọc lại, khóa ghi lại cho đến khi tải được cấu hình.
3. Tải lại/chuyển tab/đăng xuất có thể làm mất bản nháp tên miền: thêm xác nhận dùng chung và cảnh báo khi tải lại trang.
4. Gia hạn chưa kiểm tra đầy đủ ngày trước khi chuyển ISO: kiểm tra ngày thực, thứ tự, kỳ cũ, thời điểm hiện tại và giới hạn 367 ngày theo contract Go; hiển thị lỗi tại form.
5. Trang danh sách có thể vượt trang cuối sau khi số kết quả giảm: tự tải trang hợp lệ, tránh hiển thị khoảng như “21–20”. Tìm kiếm loại khoảng trắng đầu/cuối.
6. Một API tổng quan/gói lỗi có thể làm mất cả kết quả danh sách trường: xử lý kết quả từng API độc lập; không hiện kết quả cũ dưới bộ lọc mới bị lỗi.
7. Poll tạo trường có thể chồng nhiều lượt nếu API chậm hơn 5 giây: đợi lượt hiện tại kết thúc rồi mới đặt lịch tiếp.
8. Gói đang dùng nhưng đã ngừng cung cấp bị biến mất khỏi select: giữ gói hiện tại ở trạng thái không chọn mới, đánh dấu “Ngừng cung cấp”.
9. Ô mật khẩu và thông báo thành công có nhiều cách hiển thị: thống nhất component, giữ liên kết label/input và trạng thái trợ năng. Ngày hiển thị thống nhất múi giờ Việt Nam.

## Component/hook dùng chung

| Thành phần                                     | Nơi sử dụng                                            |
| ---------------------------------------------- | ------------------------------------------------------ |
| `Field`, `PasswordField`                       | Đăng nhập, tạo trường, các form quản trị               |
| `Modal`                                        | Tạo trường/gói, quản lý trường, xác nhận bỏ bản nháp   |
| `DiscardChangesDialog`                         | Tải lại tên miền/thông tin trường và rời trang có bản nháp |
| `Notice`, `SuccessNotice`                      | Lỗi/thành công ở tổng quan, tên miền và quản lý trường |
| `Badge`, `EmptyState`                          | Danh sách, trạng thái và dữ liệu trống                 |
| `inputClass`, `primaryClass`, `secondaryClass` | Kiểu input và nút hành động chung                      |
| `useUnsavedChanges`                            | Tạo trường/gói, tên miền, chỉnh trường                 |
| `renewalPeriod`, `tenantPage`                  | Kiểm tra gia hạn và giới hạn phân trang                |

Các màn hình vẫn dùng cùng bảng màu, bo góc, khoảng cách và cách hiển thị lỗi. Không tạo component chỉ để bọc một class hoặc phần nội dung đặc thù.

## Các tính năng nên bổ sung tiếp

| Ưu tiên                       | Tính năng                                                     | Tình trạng hiện tại và phần cần làm                                                                                                                             |
| ----------------------------- | ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cao                           | Tài khoản SaaS operator: đổi mật khẩu, xem/thu hồi phiên, MFA | Hiện chỉ có đăng nhập/đăng xuất; tạo operator qua CLI. Cần thêm API và UI riêng cho operator.                                                                   |
| Cao                           | Cảnh báo thuê bao sắp hết hạn và quota gần đầy                | Có kỳ/quota theo từng trường, chưa có danh sách cảnh báo tổng hợp hoặc nhắc hạn. Cần projection/API tổng hợp rồi thêm bộ lọc và thông báo.                      |
| Vừa                           | Tra cứu lỗi khởi tạo theo mã yêu cầu                          | Có API `/provision-requests` và bộ đếm lỗi, nhưng UI danh sách tác vụ đã được chủ động ẩn. Có thể bổ sung tra cứu trong luồng tạo trường nếu quyết định mở lại. |
| Vừa                           | Tra cứu lịch sử thay đổi trường/operator                      | Backend ghi audit và có `/audits`; tab lịch sử từng được chủ động bỏ. Không coi việc ẩn là lỗi và không tự khôi phục tab trong đợt này.                         |
| Khi có nhiều nhân sự vận hành | Phân quyền giữa các SaaS operator                             | Chưa có vai trò/quyền riêng ở control plane. Cần thiết kế và thực thi tại backend trước UI.                                                                     |
| Khi mở dịch vụ thương mại     | Thanh toán, hóa đơn và thay đổi gói có lịch                   | Hiện gói/quota nội bộ, không có luồng thu tiền. Đây là tính năng mới, cần xác định nghiệp vụ riêng.                                                             |

Không tự thêm xóa trường vĩnh viễn, đăng nhập thay người dùng trường, hoặc mở lại tab tác vụ/lịch sử đã ẩn.

## Kiểm chứng

- 32 test tự động đã qua: phiên/refresh, proxy và lỗi hồi quy form, bản nháp, ngày gia hạn, tải dữ liệu độc lập, phân trang, ô mật khẩu dùng chung.
- TypeScript, ESLint và production build.
- Kiểm tra Chrome với API giả lập tại local: desktop/mobile, hiện/ẩn mật khẩu, form tạo gói đang lưu, xác nhận bản nháp tên miền, gói cũ và lỗi ngày gia hạn. Không ghi vào dữ liệu người dùng.
