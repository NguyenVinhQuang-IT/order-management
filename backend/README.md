# Flask backend — Order Management

REST API cho ứng dụng quản lý đơn, dùng SQLite với đúng các bảng:

- `emp` — nhân viên
- `process` — công đoạn
- `oders` — đơn hàng (giữ nguyên tên bảng)
- `config` — cấu hình JSON theo công đoạn (thời gian, slug, mật khẩu)

Bảng hệ thống `sqlite_master` / `sqlite_sequence` không dùng trong API.

## Chạy server

Chạy backend rồi frontend (Vite proxy `/api` sang cổng 5000):

```powershell
python backend/run.py
npm run dev
```

Mở `http://localhost:5173`. Đăng nhập bằng tài khoản seed, đơn hàng/nhân viên/cài đặt giây đi qua API.

Từ thư mục gốc project hoặc `backend/`:

```powershell
python backend/run.py
```

hoặc double-click `backend/start.bat`.

Lần đầu sẽ tự tạo `.venv` và cài Flask nếu chưa có. API: `http://127.0.0.1:5000/api`

Vite (frontend) đã proxy `/api` tới cổng 5000.

## Tài khoản mặc định

| Mã NV | Tên  | Vai trò   | Mật khẩu |
| ----- | ---- | --------- | -------- |
| 1     | Quang | employee | 123456   |
| 2     | Lan   | employee | 123456   |
| 169   | Trúc  | manager  | 123456   |

## Auth

`POST /api/auth/login`

```json
{ "employee_id": "1", "password": "123456", "role": "employee" }
```

Gửi token ở header: `Authorization: Bearer <token>`

## Endpoint chính

| Method | Path | Mô tả |
| ------ | ---- | ----- |
| GET | `/api/health` | Kiểm tra server |
| POST | `/api/auth/login` | Đăng nhập |
| GET | `/api/auth/me` | User hiện tại |
| GET/POST | `/api/employees` | Danh sách / tạo NV (tạo: manager) |
| PUT/DELETE | `/api/employees/<id>` | Sửa / xóa NV |
| GET/POST | `/api/processes` | Công đoạn |
| PUT/DELETE | `/api/processes/<id>` | Sửa / xóa công đoạn |
| GET/POST | `/api/orders` | Liệt kê / nhập đơn (tối đa 50 mã/lần) |
| PUT/DELETE | `/api/orders/<id>` | Sửa / xóa đơn |
| POST | `/api/orders/delete` | Xóa hàng loạt `{ "ids": [] }` |
| POST | `/api/orders/clear` | Xóa đơn của mình (manager: tất cả) |
| PUT | `/api/orders/<id>/seconds` | Sửa giây (manager) |
| GET | `/api/settings` | `type_seconds`, `code_seconds` |
| PUT | `/api/settings/type-seconds` | `{ "type": "lam-don", "seconds": 120 }` |
| PUT | `/api/settings/code-seconds` | `{ "type": "lam-don", "codes": ["PD1"], "seconds": 90 }` |
| GET/POST | `/api/config` | CRUD JSON `config` |
| GET | `/api/stats` | Thống kê (manager) |

### Nhập đơn

```json
{
  "codes": ["CO001", "CO002"],
  "type": "lam-don",
  "kind": "co",
  "note": "gấp"
}
```

`kind` = `pd` chỉ dùng cho công đoạn `lam-don` và `kiem-don`. Mã PD được lưu trong cột `oders.co` với tiền tố `PD|` để không đụng schema.

Cột `config.data` (JSON) lưu:

- `slug` — id công đoạn phía frontend
- `seconds` — giây mặc định theo công đoạn
- `code_seconds` — giây theo mã
- `order_seconds` — giây ghi đè theo `oders.id`
- hàng `process_id IS NULL` — `auth` (password hash + role)

## Biến môi trường

- `SECRET_KEY` — ký token (đổi khi chạy thật)
- `DATABASE` — đường dẫn file SQLite (mặc định `backend/data/order-management.db`)

## Test

```powershell
cd backend
python -m pytest -q
```
