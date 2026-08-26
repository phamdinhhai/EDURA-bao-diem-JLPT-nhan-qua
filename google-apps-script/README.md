# Thiết lập Google Sheets

1. Tạo Google Sheet và mở **Extensions → Apps Script**.
2. Dán nội dung `Code.gs` vào project gắn với Sheet.
3. Trong **Project Settings → Script properties**, tạo `WEBHOOK_SECRET` bằng một chuỗi ngẫu nhiên dài.
4. Chọn **Deploy → New deployment → Web app**:
   - Execute as: Me
   - Who has access: Anyone
5. Lưu Web App URL vào Supabase secret `GOOGLE_SHEETS_WEBHOOK_URL`.
6. Lưu cùng secret vào Supabase secret `GOOGLE_SHEETS_WEBHOOK_SECRET`.

Sheet hiển thị 5 cột nghiệp vụ. Cột kỹ thuật `_spin_id` dùng để chống ghi trùng và có thể ẩn trong Google Sheets.
