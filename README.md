# EStude SaaS Admin

Source Next.js riêng cho quản trị toàn nền tảng. Project có `package.json`, lockfile, cấu hình, build và Dockerfile riêng; không import source, auth provider, CSS hoặc dependency từ `estude-frontend`.

## Chạy local

Cần Node.js 22+. Go control API chạy ở port `8092`, PostgreSQL đã migrate và đã có tài khoản quản trị SaaS. Thiết lập backend lần đầu theo [hướng dẫn control plane](../estude-backend-go/docs/saas-console/README.md).

```bash
cd estude-saas-admin
npm ci
npm run dev
```

Mở **http://platform.localhost:3005**. `/` và `/login` chuyển tới `/platform`. Dùng tài khoản SaaS `saas.admin` đã tạo ở backend; mật khẩu local nằm trong `estude-backend-go/.env.platform-local`, biến `BOOTSTRAP_OPERATOR_PASSWORD`.

Không cần chạy FE trường học để quản lý SaaS. Khi mở một portal của trường từ trang chi tiết, FE trường học phục vụ ở port `8091` và được chạy riêng trong `estude-frontend` bằng `npm run dev:saas`.

Các giá trị mặc định hoạt động ngay ở local. Nếu cần thay đổi:

```bash
cp .env.example .env.local
```

| Biến | Phạm vi | Mặc định |
| --- | --- | --- |
| `CONTROL_API_URL` | Chỉ server Next; địa chỉ Go control | `http://127.0.0.1:8092` |
| `PLATFORM_HOST` | Chỉ server; phải khớp Go `PLATFORM_HOST` | `platform.localhost` |
| `NEXT_PUBLIC_TENANT_PORTAL_PORT` | Build time; port của FE trường học ở local | `8091` |

Frontend gọi same-origin `/api/platform/v1`. Next route handler chỉ chuyển HTTP tới Go, giữ Host/Origin/cookie/status; không quyết định quyền, quota hoặc nghiệp vụ. Không thêm JWT key, DB URL hay credential backend vào frontend env. Phiên quản trị dùng cookie HttpOnly do Go cấp; không lưu token trong localStorage.

Phiên SaaS hiện có thời hạn 15 phút. Khi bất kỳ API quản trị nào trả `401`, giao diện đóng hộp thoại, xóa dữ liệu phiên trên màn hình và yêu cầu đăng nhập lại. Những thay đổi chưa lưu không được gửi lại tự động; thời hạn và kiểm tra phiên vẫn do backend quyết định.

## Chức năng

Đăng nhập/đăng xuất, tìm và phân trang trường, tạo trường kèm admin ban đầu, theo dõi provisioning, tạm khóa/mở lại, branding, gán gói đăng ký, quota/usage và audit. Tạo schema và cấp admin do Go provisioner xử lý nguyên tử ở background. Gói hiện là gói nội bộ, chưa thu tiền tự động. Chi tiết contract và giới hạn ở [tài liệu SaaS Console](../estude-backend-go/docs/saas-console/README.md).

Trang **Tổng quan** hiển thị số liệu thực từ backend, yêu cầu khởi tạo cần chú ý và lối tắt tới cấu hình tên miền/gói dịch vụ. Danh sách trường có tìm kiếm, lọc trạng thái, xóa bộ lọc và phân trang; trên mobile hiển thị từng thẻ trường. Form đăng nhập hỗ trợ hiện/ẩn mật khẩu, thông báo lỗi tại chỗ; các hộp thoại hỗ trợ phím Escape, giữ focus và khóa cuộn trang nền.

Form **Tạo trường** hỏi xác nhận khi có dữ liệu chưa lưu và người dùng bấm ra ngoài, Đóng, Hủy hoặc Escape. **Tiếp tục nhập** giữ nguyên các trường đã nhập; **Hủy bỏ thay đổi** đóng và xóa bản nháp. Form chưa thay đổi đóng ngay, kể cả sau khi tải tên miền mặc định. Khi đang gửi yêu cầu, thao tác đóng bị khóa; tải lại/đóng tab dùng cảnh báo rời trang mặc định của trình duyệt khi có dữ liệu chưa lưu. Không lưu bản nháp hoặc mật khẩu vào localStorage.

## Kiểm tra và build

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm start
```

`npm start` phục vụ bản production trên port `3005`. Chọn port khác bằng `npm run dev -- --port 3015` hoặc `npm start -- --port 3015`.

Kiểm tra unit/typecheck/lint/build admin và API quản trị với Go/PostgreSQL/Redis fixture cô lập:

```bash
cd ../estude-backend-go
bash scripts/test-console.sh
```

Bài kiểm tra này build admin độc lập, không khởi động hoặc proxy qua FE trường học. Script kiểm thử trình duyệt SaaS Admin đã được bỏ, nên thao tác giao diện cần kiểm tra thủ công.

## Docker độc lập

```bash
docker build -t estude-saas-admin:local .
docker run --rm --network estude-saas_default \
  -p 127.0.0.1:3005:3005 \
  -e CONTROL_API_URL=http://control:8092 \
  -e PLATFORM_HOST=platform.localhost \
  estude-saas-admin:local
```

Network trên là network của Compose backend local. Tắt dev server admin nếu đang chiếm port 3005. Container chạy Next standalone bằng user `node`; không chứa database credential hoặc JWT key.

Deployment đích đặt domain riêng và TLS cho admin. Backend Go phải có cùng `PLATFORM_HOST` và cookie Secure. `CONTROL_API_URL` là cấu hình runtime server, không cần nhúng vào browser bundle. `NEXT_PUBLIC_TENANT_PORTAL_PORT` chỉ áp dụng domain `.localhost`; các domain trường thật dùng HTTPS không có port local. Nginx edge tùy chọn trong backend đã trỏ giao diện admin tới port 3005.

### Vercel với backend AWS

Tạo project Vercel riêng từ source này, dùng Next.js và Node 22+. Đặt biến Production `CONTROL_API_URL=https://saas-api.estude.io.vn` và `PLATFORM_HOST=saas-admin.estude.io.vn`. Thêm domain `saas-admin.estude.io.vn` trong Vercel, tạo CNAME theo giá trị Vercel cung cấp rồi deploy. Đăng nhập tại domain này; preview `.vercel.app` không khớp hostname control đã cấu hình. Backend cần HTTPS hoạt động trước khi đăng nhập.

Proxy giữ HTTP Host của frontend để Go kiểm tra cổng quản trị, đồng thời dùng hostname trong `CONTROL_API_URL` để xác thực chứng chỉ TLS/SNI. Không đưa mật khẩu hoặc JWT key vào Vercel. Xem [triển khai EC2](../estude-backend-go/deploy/ec2/README.md) để cấu hình DNS, HTTPS và backend độc lập với EStude cũ.

## Job operations G12

Chi tiết trường không hiển thị mục Tác vụ LMS và không gọi API liệt kê/chạy lại tác vụ LMS. Các worker, scheduler và API vận hành trong backend vẫn hoạt động. Hai tab **Tác vụ tạo trường** và **Lịch sử thao tác** đã được bỏ khỏi giao diện. Sau khi gửi yêu cầu tạo trường, trang chuyển về danh sách trường và tự cập nhật khi còn yêu cầu đang chờ; frontend không tải danh sách tác vụ tạo trường hoặc nhật ký thao tác. Xem [API vận hành G12](../estude-backend-go/docs/g12/README.md#van-hanh) nếu cần xử lý tác vụ kỹ thuật.

## Tên miền của trường

Vào **Tên miền** để lưu tên miền gốc mặc định, ví dụ `estude.vn`. Trong **Tạo trường**, nhập subdomain như `nguyen-trai`; có thể chọn tên miền gốc khác cho trường đó. Form hiển thị trước bốn địa chỉ `admin/teacher/student/parent.nguyen-trai.estude.vn`. Chỉ nhập hostname, không kèm giao thức, cổng, đường dẫn hoặc wildcard; `localhost` dành cho local.

Cấu hình được lưu trong PostgreSQL, có revision chống ghi đè và lịch sử thao tác. Yêu cầu tạo trường giữ bản tên miền đã chọn; đổi mặc định không đổi trường đã tạo hoặc yêu cầu đang chờ. Khi chưa lưu cấu hình, backend dùng `BASE_DOMAIN` làm giá trị ban đầu. CLI `tenant-create` cũng dùng mặc định này, trừ khi truyền `--base-domain`.

Backend cần migration control **007_domain_settings**. Build backend mới, chạy `migrate-control` bằng owner/migration role và khởi động lại các process Go cùng phiên bản, rồi build/restart SaaS admin. Tenant migration không thay đổi. Không reset database hay tạo lại trường hiện có.

Đây là đăng ký địa chỉ trong hệ thống; cấu hình DNS, gắn domain vào Vercel/ingress và cấp HTTPS vẫn thực hiện trên hạ tầng triển khai. Wildcard `*.estude.vn` không bao phủ hostname hai cấp như `admin.nguyen-trai.estude.vn`.

## Sửa thông tin trường đã tạo

Trong **Trường học → Quản lý → Thông tin trường**, sửa tên trường, subdomain hoặc tên miền gốc rồi chọn **Lưu thay đổi**. Tên này dùng cho tiêu đề và danh sách quản trị SaaS; **Tên hiển thị** trong mục Nhận diện trường được lưu độc lập.

Đổi subdomain/tên miền yêu cầu xác nhận bốn địa chỉ mới. Địa chỉ cũ ngừng truy cập ngay sau khi lưu; người dùng mở địa chỉ mới và đăng nhập lại. Cấu hình DNS, frontend và HTTPS được chuẩn bị trên hạ tầng trước khi chuyển. Không đổi UUID, schema, tài khoản, dữ liệu học tập, gói đăng ký hoặc bản ghi yêu cầu tạo trường trước đó. Không có chuyển hướng tự động từ địa chỉ cũ.

Backend cần migration control **008_tenant_profiles** và các process Go cùng phiên bản. API `GET/PUT /api/platform/v1/tenants/:tenantId/profile` dùng revision để tránh ghi đè thay đổi đồng thời, chặn subdomain trùng cả trường hiện có và yêu cầu đang chờ, cập nhật nguyên tử bốn portal và ghi lịch sử trước/sau cùng audit quản trị. Control role chỉ được gọi hàm cập nhật có kiểm tra phiên; không có quyền UPDATE trực tiếp tenants hoặc domains. Các trường cũ không bị đổi thông tin khi chạy migration.

## Lưu chung chi tiết trường

Popup chi tiết trường có một form và một nút **Lưu thay đổi** tại góc dưới bên phải, luôn hiển thị khi cuộn nội dung. Thông tin trường, nhận diện, gói đăng ký, gia hạn và trạng thái đều là bản nháp cho đến khi lưu. Đóng popup khi có thay đổi sẽ hỏi xác nhận; đổi địa chỉ hoặc trạng thái trường yêu cầu tích xác nhận trước khi lưu.

Frontend gửi một `PUT /api/platform/v1/tenants/:tenantId` với các nhóm đã thay đổi. Backend cập nhật các nhóm và audit trong cùng transaction, kiểm tra revision/quota/phiên hiện tại. Một nhóm lỗi sẽ rollback toàn bộ. Khi xung đột, bản nháp vẫn giữ để kiểm tra; tải lại dữ liệu mới sẽ hỏi xác nhận bỏ bản nháp. Nếu lưu đã thành công nhưng tải lại lỗi, nút lưu bị khóa cho đến khi tải được dữ liệu mới để tránh gửi lại thay đổi đã lưu. Không cần migration mới ngoài control008.
