# Edura JLPT Spin V2

Landing page vòng quay 7 phần thưởng / 80 đơn vị quà, frontend deploy trên Vercel; inventory và kết quả do Supabase quyết định; claim được đồng bộ sang Google Sheets. Xác suất tại mỗi lượt bằng số unit `AVAILABLE` của từng quà chia cho tổng unit `AVAILABLE`, nên tự thay đổi theo tồn kho thực tế.

## 1. Chạy local

```powershell
npm run dev
```

Localhost tự chạy demo mode, không trừ kho và không ghi Google Sheets.

## 2. Chuẩn bị Supabase

1. Tạo Supabase project.
2. Sửa `project_id` trong `supabase/config.toml`.
3. Chạy lần lượt SQL `001_schema.sql` → `006_admin.sql` trong SQL Editor, hoặc dùng Supabase CLI migration workflow.
4. Cài Supabase CLI và đăng nhập:

```powershell
npx -y supabase@latest login
npx -y supabase@latest link --project-ref YOUR_PROJECT_REF
npx -y supabase@latest functions deploy spin
npx -y supabase@latest functions deploy claim
npx -y supabase@latest functions deploy campaign-status
npx -y supabase@latest functions deploy admin
```

## 2.1. Thiết lập tài khoản Admin

1. Vào **Supabase Dashboard → Authentication → Users → Add user**.
2. Tạo user bằng email và mật khẩu mạnh, bật **Auto Confirm User**.
3. Sao chép UUID của user vừa tạo.
4. Chạy trong SQL Editor:

```sql
insert into public.admin_users(user_id, display_name)
values ('UUID_USER_VỪA_TẠO', 'Quản trị Edura');
```

5. Truy cập `https://TEN-MIEN-CUA-BAN/admin/` và đăng nhập.

> Chỉ user có UUID trong `admin_users` mới gọi được API báo cáo hoặc điều chỉnh kho. Khi giảm tồn kho, hệ thống chỉ xóa các đơn vị còn `AVAILABLE`; quà đã trao hoặc đã nhận không bị thay đổi.

## 3. Google Sheets

Làm theo `google-apps-script/README.md`, sau đó đặt secrets:

```powershell
npx -y supabase@latest secrets set GOOGLE_SHEETS_WEBHOOK_URL="YOUR_APPS_SCRIPT_WEB_APP_URL"
npx -y supabase@latest secrets set GOOGLE_SHEETS_WEBHOOK_SECRET="YOUR_LONG_RANDOM_SECRET"
```

Không commit các secret này.

## 4. Kết nối frontend production

Sửa `config.js`:

```js
window.EDURA_CONFIG = Object.freeze({
  apiUrl: "https://YOUR_PROJECT_REF.supabase.co/functions/v1",
  demoMode: false
});
```

> Production sẽ báo lỗi nếu API chưa cấu hình; không tự phát quà demo trên domain Vercel.

## 5. Deploy Vercel

1. Push repository lên GitHub/GitLab.
2. Import repository trong Vercel.
3. Framework Preset: **Other**.
4. Build Command: để trống.
5. Output Directory: `.`.
6. Deploy và gắn domain `quatang.edura.edu.vn` nếu cần.

## Dữ liệu Google Sheet

Các cột hiển thị: `Ngày / Giờ`, `Họ và tên`, `SDT`, `Phần thưởng`, `Link web`. Cột `_spin_id` là cột kỹ thuật chống trùng và có thể ẩn.

## Bảo mật quan trọng

- Frontend không chứa Supabase service role hoặc Google webhook secret.
- Frontend không quyết định phần thưởng.
- Spin được cấp trong PostgreSQL transaction atomic.
- Mỗi SĐT chỉ có một spin trong campaign.
- Claim retry không tạo dòng Google Sheet trùng.
