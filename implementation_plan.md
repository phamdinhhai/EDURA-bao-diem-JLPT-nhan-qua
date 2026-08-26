Đã đủ dữ liệu để chốt **kiến trúc và plan update tổng thể**. Với yêu cầu mới, tôi sẽ thay đổi định hướng so với phương án trước một chút: **không nên tiếp tục dựa vào engine SpinLucky của LadiPage để quyết định phần thưởng**, vì logic mới yêu cầu một kho quà chung 50 phần và tỷ lệ thay đổi theo tồn kho thực tế.

File hiện tại đang để `SPINLUCKY3` tự quyết định kết quả dựa trên một mảng xác suất cố định `cA`; đây là logic phía LadiPage/client.  Trong khi yêu cầu mới bắt buộc backend phải là nơi duy nhất quyết định phần thưởng. Vì vậy bản V2 nên là **frontend mới + Supabase backend**, còn LadiPage cũ chỉ được dùng làm nguồn tham chiếu nghiệp vụ.

# 1. Kiến trúc V2 nên chốt như sau

```text
┌───────────────────────────────┐
│      LANDING PAGE HTML        │
│                               │
│  Background / Logo / Title    │
│  Wheel / Button / Prize List  │
│  Turn counter / Result modal  │
└───────────────┬───────────────┘
                │
                │ POST /spin
                ▼
┌───────────────────────────────┐
│    SUPABASE EDGE FUNCTION     │
│                               │
│ Validation                    │
│ Anti duplicate               │
│ Authentication participant    │
│ Idempotency                   │
└───────────────┬───────────────┘
                │
                ▼
┌───────────────────────────────┐
│          POSTGRES DB          │
│                               │
│ Campaign                      │
│ 6 Prize types                 │
│ 50 physical prize units       │
│ Participants                  │
│ Spins                         │
│ Claims / Audit                │
└───────────────────────────────┘
```

Điểm quan trọng nhất:

> **Frontend không bao giờ được quyền chọn phần thưởng.**

Frontend chỉ hỏi backend:

> “Người này được quay chưa? Nếu được thì phần thưởng của lượt này là gì?”

Backend trả:

```json
{
  "spin_id": "...",
  "prize_code": "VOUCHER_500K",
  "sector_index": 5,
  "remaining_turn": 0
}
```

Sau đó frontend mới quay animation tới đúng sector tương ứng.

---

# 2. Không sử dụng xác suất cố định nữa

6 phần thưởng mới:

| Prize code        | Phần thưởng              | SL ban đầu | Tỷ lệ ban đầu |
| ----------------- | ------------------------ | ---------: | ------------: |
| `SCHOLARSHIP_100` | Học bổng 100% JLPT Video |         15 |           30% |
| `SCHOLARSHIP_80`  | Học bổng 80% JLPT Video  |          5 |           10% |
| `SCHOLARSHIP_50`  | Học bổng 50% JLPT Video  |          5 |           10% |
| `VOUCHER_1000K`   | Voucher 1.000.000đ       |          2 |            4% |
| `VOUCHER_800K`    | Voucher 800.000đ         |         11 |           22% |
| `VOUCHER_500K`    | Voucher 500.000đ         |         12 |           24% |
| **Tổng**          |                          |     **50** |      **100%** |

Tôi khuyến nghị **không lưu xác suất thành một cột cần cập nhật**.

Backend chỉ cần lưu số lượng quà còn lại.

Ví dụ đang còn:

```text
100%        15
80%          5
50%          5
1 triệu      2
800k        11
500k        11
----------------
Tổng        49
```

Khi đó xác suất tự nhiên là:

```text
P(100%)     = 15 / 49
P(80%)      = 5 / 49
P(50%)      = 5 / 49
P(1 triệu)  = 2 / 49
P(800k)     = 11 / 49
P(500k)     = 11 / 49
```

Không có nguy cơ tỷ lệ trong DB và tồn kho bị lệch nhau.

---

# 3. Tôi còn đề xuất cách lưu kho tốt hơn nữa: 50 “vé quà” thực

Thay vì chỉ có:

```text
Voucher 500k: remaining_qty = 12
```

DB có thể thực sự tạo ra **50 bản ghi inventory**.

Ví dụ:

```text
UNIT-001 → Scholarship 100%
UNIT-002 → Scholarship 100%
...
UNIT-015 → Scholarship 100%

UNIT-016 → Scholarship 80%
...
UNIT-050 → Voucher 500k
```

Mỗi unit có trạng thái:

```text
AVAILABLE
AWARDED
CLAIMED
```

### Vì sao cách này rất tốt?

Backend chỉ cần:

```sql
SELECT một prize_unit bất kỳ
FROM prize_units
WHERE status = 'AVAILABLE'
ORDER BY random()
LIMIT 1;
```

Nếu còn 11 Voucher 500K trên tổng 49 rows thì xác suất chọn nó chính xác là:

**11 / 49**.

Không cần viết riêng thuật toán weighted random.

Và quan trọng hơn: không thể xảy ra trường hợp:

```text
remaining_qty = -1
```

hay:

```text
đã phát 51/50 phần
```

---

# 4. Cấu trúc database đề xuất

Tôi sẽ xây khoảng 5 bảng chính.

### `campaigns`

Quản lý chương trình.

```text
id
code
name
status
starts_at
ends_at
total_inventory
created_at
```

Ví dụ:

```text
JLPT_SPIN_2026
Báo điểm JLPT - Nhận quà Edura
ACTIVE
50
```

---

### `prizes`

6 loại phần thưởng.

```text
id
campaign_id
code
name
total_qty
wheel_index
display_order
active
```

`wheel_index` cực kỳ quan trọng vì nó liên kết backend với hình vòng quay.

Ví dụ:

```text
SCHOLARSHIP_100 → sector 0
SCHOLARSHIP_80  → sector 1
SCHOLARSHIP_50  → sector 2
VOUCHER_1000K   → sector 3
VOUCHER_800K    → sector 4
VOUCHER_500K    → sector 5
```

---

### `prize_units`

Đây là kho 50 phần thực tế.

```text
id
campaign_id
prize_id
unit_no

status
awarded_at
participant_id
spin_id
```

Ban đầu:

```text
50 rows
status = AVAILABLE
```

---

### `participants`

Quản lý người chơi.

```text
id
campaign_id

name
phone
phone_normalized

created_at
```

Có unique constraint:

```text
campaign_id + phone_normalized
```

nếu dùng số điện thoại làm định danh một học viên.

---

### `spins`

Lịch sử quay.

```text
id
campaign_id
participant_id
prize_id
prize_unit_id

request_id
status

created_at
claimed_at
```

Unique:

```text
campaign_id + participant_id
```

=> một người không thể có 2 lượt thắng.

---

# 5. Transaction chọn quà phải atomic

Đây là phần backend quan trọng nhất.

Giả sử chỉ còn **1 Voucher 1 triệu**.

Hai khách bấm QUAY gần như cùng một lúc.

Nếu code làm kiểu:

```text
User A đọc remaining = 1
User B đọc remaining = 1

A trúng
B cũng trúng
```

=> phát quá kho.

Không được làm như vậy.

Backend cần transaction kiểu:

```text
BEGIN

1. Kiểm tra participant đã quay chưa

2. Lock inventory AVAILABLE

3. Random một prize unit

4. Đổi:
   AVAILABLE → AWARDED

5. Insert spin

COMMIT
```

Có thể dùng PostgreSQL:

```sql
FOR UPDATE SKIP LOCKED
```

Do đó 2 người quay cùng thời điểm cũng không lấy được cùng một `prize_unit`.

---

# 6. Cần thêm idempotency

Ví dụ người dùng bấm QUAY.

Backend đã chọn:

> Voucher 800K

nhưng đúng lúc đó mạng người dùng lag.

Browser tưởng request thất bại và gửi lại.

Nếu không có idempotency:

```text
request 1 → mất 1 Voucher 800K
request 2 → mất thêm một quà nữa
```

Sai.

Frontend sẽ tạo:

```text
request_id = UUID
```

Ví dụ:

```text
10d429ea-a023-...
```

Backend lưu nó.

Nếu request cùng ID được gửi lần hai:

```text
Không random lại.
Không trừ thêm kho.

→ Trả lại đúng kết quả request đầu tiên.
```

Đây là bắt buộc đối với vòng quay có kho thật.

---

# 7. Một thay đổi UX tôi khuyến nghị: xác định người chơi TRƯỚC khi random quà

File hiện tại đang làm:

```text
QUAY
 ↓
Có kết quả
 ↓
POPUP
 ↓
Điền Họ tên
Điền số điện thoại
```

Popup hiện tại đúng là đang lấy `name` và `phone` sau lượt quay. 

Với kho quà thật thì workflow này có một lỗ hổng.

Người dùng có thể:

```text
quay
→ không thích quà
→ mở incognito
→ quay lại
→ không submit form
```

Backend không biết đó là cùng người.

### V2 tôi đề xuất:

```text
Click QUAY
     ↓
Popup nhỏ:
"Họ tên"
"SĐT"
     ↓
Backend kiểm tra eligibility
     ↓
Nếu chưa quay
     ↓
Backend allocate quà
     ↓
Wheel quay
     ↓
Result popup
     ↓
NHẬN QUÀ
```

Giao diện mặc định vẫn **100% giống mock**.

Form chỉ xuất hiện khi khách click QUAY.

---

# 8. Nếu không muốn nhập thông tin trước thì sao?

Có thể giữ UX hiện tại, nhưng chỉ có thể ngăn theo:

```text
localStorage
cookie
browser session
device
IP
```

Tất cả đều có thể bypass.

Do đó nếu yêu cầu:

> “Mỗi học viên thực sự chỉ 1 lượt.”

thì tôi khuyến nghị dùng:

**SĐT / mã học viên / token cá nhân** làm định danh trước khi backend cấp quà.

Không nên dùng localStorage làm hàng rào nghiệp vụ.

---

# 9. Frontend sẽ build lại, không sửa tiếp cấu trúc Ladi cũ

Đây là thay đổi kiến trúc lớn nhất tôi đề xuất.

File hiện tại có hơn 3.000 dòng và rất nhiều CSS absolute positioning do LadiPage export. Các container hiện tại cũng bị khóa ở desktop 960px và mobile 420px. 

Trong runtime cuối file Ladi cũng tiếp tục khai báo:

```text
desktop_width = 960
mobile_width = 420
```



### Bản mới nên là:

```text
index-v2.html
app.css
app.js
assets/
```

Hoặc nếu bạn bắt buộc muốn tất cả trong một file:

```text
index-v2.html

HTML
CSS
JS
```

vẫn được.

Tôi nghiêng về **một HTML + thư mục assets** vì landing page nhỏ.

---

# 10. Layout desktop mới

Theo đúng mock mới:

```text
┌─────────────────────────────────────────────────────────┐
│                                                        │
│   EDURA LOGO                                           │
│                                                        │
│                           TITLE                        │
│              VÀO LIVE → TRA ĐIỂM → QUAY QUÀ           │
│                                                        │
│      ┌──────────────┐         ┌──────────────────┐     │
│      │              │         │                  │     │
│      │    WHEEL     │         │   PRIZE TABLE    │     │
│      │              │         │                  │     │
│      └──────────────┘         └──────────────────┘     │
│                                                        │
│     LƯỢT QUAY CỦA BẠN: 1                              │
│                                                        │
└─────────────────────────────────────────────────────────┘
```

Không cần:

* cành hoa cũ;
* đèn lồng cũ;
* banner cũ;
* 2 bảng quà riêng;
* BOX cũ.

Vì các décor đó đã nằm trong background mới.

---

# 11. Layout mobile mới

Theo đúng mock mobile:

```text
┌───────────────────────────┐
│ EDURA                     │
│                           │
│ TITLE                     │
│                           │
│        ┌─────────┐        │
│        │         │        │
│        │  WHEEL  │        │
│        │         │        │
│        └─────────┘        │
│                           │
│   LƯỢT QUAY CỦA BẠN: 1   │
│                           │
│     PRIZE TABLE           │
│                           │
└───────────────────────────┘
```

Không phải scale desktop xuống mobile.

Đây là 2 composition khác nhau.

---

# 12. Responsive architecture

Tôi sẽ dùng khoảng 4 breakpoint:

```css
/* mobile */
@media (max-width: 575px)

/* tablet / large mobile */
@media (min-width: 576px) and (max-width: 767px)

/* laptop */
@media (min-width: 768px) and (max-width: 1439px)

/* desktop */
@media (min-width: 1440px)
```

Tuy nhiên visual asset chỉ có hai composition:

```text
Desktop → background PC
Mobile  → background mobile
```

Tablet landscape có thể sử dụng layout desktop.

---

# 13. Hero nên xây bằng “design canvas” responsive

Vì mock PC của bạn là:

**1920 × 1080**

và mobile:

**1080 × 1920**

nên tôi sẽ dùng một stage giữ tỷ lệ.

Desktop:

```css
.hero-stage {
    aspect-ratio: 16 / 9;
}
```

Mobile:

```css
.hero-stage {
    aspect-ratio: 9 / 16;
}
```

Các element dùng `%` thay vì tọa độ pixel cố định.

Ví dụ:

```css
.hero-wheel {
    width: 34%;
    left: 5%;
    top: 22%;
}
```

Nhờ vậy:

```text
1920×1080
1536×864
1440×810
1366×768
1280×720
```

đều giữ đúng tương quan.

---

# 14. Asset mới sẽ được chuẩn hóa

Tôi sẽ xử lý các file:

```text
background PC.png
background mobile.png

logo edura.png
title chính.png

vòng quay.png
nút tròn quay hiện mũi tên chỉ phần thưởng.png

box lượt quay của bạn.png
bảng danh sách phần quà.png
```

thành:

```text
/assets/bg-desktop.webp
/assets/bg-mobile.webp

/assets/logo-edura.webp
/assets/hero-title.webp

/assets/wheel.webp
/assets/wheel-button.webp

/assets/turn-box.webp
/assets/prize-table.webp
```

Các file transparency lớn sẽ được crop phần rỗng nhưng **không chỉnh sửa nội dung thiết kế**.

---

# 15. Vòng quay frontend không còn tự random

Đây là một khác biệt rất quan trọng.

### Sai

```javascript
const prize = Math.random();
```

hoặc dựa trên `cA`.

### Đúng

```text
User click
       ↓
Backend trả prize = VOUCHER_800K
       ↓
Frontend tra:
VOUCHER_800K → sector 4
       ↓
Frontend animate sector 4
```

Animation chỉ mang tính trình diễn.

**Kết quả đã được backend quyết định trước khi wheel bắt đầu xoay.**

---

# 16. Mapping 6 sector

Tôi sẽ tạo một config duy nhất trong JS:

```javascript
const WHEEL_SECTORS = {
  SCHOLARSHIP_100: 0,
  SCHOLARSHIP_80: 1,
  SCHOLARSHIP_50: 2,
  VOUCHER_1000K: 3,
  VOUCHER_800K: 4,
  VOUCHER_500K: 5,
};
```

Một vòng có:

```text
360 / 6 = 60°
```

Mỗi sector rộng 60°.

Khi backend trả:

```text
VOUCHER_800K
```

JS biết cần dừng ở sector tương ứng.

---

# 17. Animation

Ví dụ:

```text
5–8 vòng quay đầy đủ
+
góc đến sector chiến thắng
+
offset nhỏ bên trong sector
```

Ví dụ:

```text
360 × 7
+
240°
+
4°
```

Không dừng sát ranh giới giữa hai phần thưởng.

Dùng:

```css
transition:
transform 6s cubic-bezier(...)
```

Button QUAY cố định.

Wheel phía sau xoay.

---

# 18. Đồng bộ mũi tên và sector phải QA thật

Tôi sẽ không hardcode góc dựa trên phỏng đoán.

Sau khi render:

```text
Backend mock → SCHOLARSHIP_100
→ kiểm tra mũi tên

Backend mock → SCHOLARSHIP_80
→ kiểm tra

...

6/6 phần thưởng
```

Sau đó mới khóa bảng angle.

Đây là cách tránh trường hợp:

> hình chỉ 800K nhưng popup lại báo 500K.

---

# 19. Turn counter

PNG mới:

> LƯỢT QUAY CỦA BẠN:

sẽ là background.

Phía trên nó có:

```html
<span id="turn-count">1</span>
```

Ban đầu:

```text
1
```

Sau khi backend đã allocation thành công:

```text
0
```

Nếu reload:

frontend gọi backend:

```text
GET /participant-status
```

Nếu người này đã quay:

```text
turn_left = 0
```

Không reset về 1.

---

# 20. Không cho quay khi hết 50 quà

Nếu kho:

```text
remaining = 0
```

backend trả:

```json
{
  "code": "CAMPAIGN_SOLD_OUT"
}
```

Frontend sẽ:

```text
Disable nút QUAY

"LƯỢT QUAY CỦA BẠN: 0"

Hiện popup/thông báo:
"Chương trình đã phát hết quà."
```

Quan trọng là **backend kiểm tra**, không chỉ frontend.

---

# 21. Trường hợp quà riêng lẻ hết

Ví dụ Voucher 1 triệu:

```text
remaining = 0
```

Các `prize_units` Voucher 1 triệu đều `AWARDED`.

Do đó random trên:

```text
WHERE status = AVAILABLE
```

tự động không còn Voucher 1 triệu.

Không cần:

```javascript
if voucher1000 === 0 ...
```

---

# 22. Luồng hoàn chỉnh tôi đề xuất

```text
PAGE LOAD
   │
   ├─ load campaign status
   │
   └─ load participant state
           │
           ▼
         READY
           │
        Click QUAY
           │
           ▼
    Identify participant
           │
           ▼
       POST /spin
           │
           ├─ đã quay → reject
           ├─ hết quà → reject
           └─ valid
                │
                ▼
         atomic allocation
                │
                ▼
          return prize
                │
                ▼
          animate wheel
                │
                ▼
          show result
                │
                ▼
             CLAIM
```

---

# 23. Result popup nên build mới

Không nên tiếp tục dùng popup Ladi cũ.

Popup hiện tại đang dùng `POPUP2`, `FORM3` và các input Ladi-generated. 

Bản mới nên có custom modal:

```text
🎉 CHÚC MỪNG!

Bạn nhận được

VOUCHER 800.000Đ

[ NHẬN QUÀ ]
```

Sau đó:

```text
Tên
SĐT
```

hoặc nếu đã nhập trước thì chỉ xác nhận thông tin.

---

# 24. Backend nên có 3 API chính

### `campaign-status`

Trả:

```json
{
  "active": true,
  "remaining": 37
}
```

---

### `spin`

Input:

```json
{
  "campaign": "JLPT_SPIN_2026",
  "participant": "...",
  "request_id": "uuid"
}
```

Output:

```json
{
  "spin_id": "...",
  "prize_code": "VOUCHER_800K",
  "prize_name": "Voucher 800.000 VNĐ",
  "sector": 4,
  "turn_left": 0
}
```

---

### `claim`

Input:

```json
{
  "spin_id": "...",
  "award_token": "...",
  "name": "...",
  "phone": "..."
}
```

Backend tuyệt đối không nhận:

```json
{
  "prize": "SCHOLARSHIP_100"
}
```

từ người dùng để quyết định quà.

---

# 25. Supabase security

Browser chỉ được biết:

```text
SUPABASE_URL
anon/public key
```

Tuyệt đối không có:

```text
service_role
database password
```

trong HTML.

Edge Function dùng:

```text
SUPABASE_SERVICE_ROLE_KEY
```

ở environment server-side.

RLS:

```text
participants: no direct public write
spins: no direct public write
prize_units: no public write
prizes: read only nếu cần
```

Tất cả allocation đi qua backend function.

---

# 26. Rate limiting và chống spam

Ngoài một lượt/người, endpoint `/spin` nên có:

```text
IP rate limit
request_id idempotency
participant unique
cooldown vài giây
```

Nếu cần chống bot mạnh hơn có thể thêm CAPTCHA ở giai đoạn sau.

---

# 27. Refresh trong lúc vòng quay đang chạy

Case:

```text
Backend đã phát quà
↓
Wheel đang quay
↓
Khách F5
```

Không được phát lại.

Khi reload:

```text
participant status
↓
Backend thấy có spin
↓
turn = 0
↓
Frontend restore kết quả cũ
```

Có thể hiển thị:

> Bạn đã nhận Voucher 800.000đ.

---

# 28. Double-click

Ngay khi click:

```javascript
spinButton.disabled = true;
```

Nhưng đó chỉ là UX.

Backend vẫn phải chống:

```text
click 1
click 2
touch event
network retry
```

bằng transaction + unique constraint + idempotency.

---

# 29. Dashboard tồn kho chưa cần làm ngay

Supabase Table Editor đã có thể cho admin xem:

```text
100% còn 8/15
80% còn 4/5
50% còn 3/5
1M còn 0/2
800K còn 7/11
500K còn 10/12
```

Sau này có thể làm admin mini-dashboard nếu cần.

Không nên phức tạp hóa phase đầu.

---

# 30. Các file cuối cùng nên có

Tôi đề xuất project:

```text
edura-jlpt-spin/
│
├── index.html
│
├── assets/
│   ├── bg-desktop.webp
│   ├── bg-mobile.webp
│   ├── logo-edura.webp
│   ├── hero-title.webp
│   ├── wheel.webp
│   ├── wheel-button.webp
│   ├── turn-box.webp
│   └── prize-table.webp
│
├── js/
│   ├── app.js
│   ├── wheel.js
│   └── api.js
│
├── css/
│   └── app.css
│
└── supabase/
    ├── 001_schema.sql
    ├── 002_seed_campaign.sql
    ├── 003_spin_function.sql
    ├── 004_rls.sql
    └── functions/
        ├── spin/
        ├── claim/
        └── campaign-status/
```

Để deploy đơn giản, cũng có thể bundle CSS/JS trở lại `index.html` sau khi hoàn thiện.

---

# 31. Lộ trình triển khai cụ thể

| Phase  | Công việc                    | Kết quả                    |
| ------ | ---------------------------- | -------------------------- |
| **1**  | Backup HTML cũ + audit logic | Không mất bản production   |
| **2**  | Crop/optimize toàn bộ PNG    | Asset sạch                 |
| **3**  | Build UI desktop             | Match ảnh PC               |
| **4**  | Build UI mobile              | Match ảnh mobile           |
| **5**  | Build custom 6-sector wheel  | Wheel animation hoàn chỉnh |
| **6**  | Tạo Supabase schema          | Kho 50 phần                |
| **7**  | Seed 6 prize + 50 units      | Inventory chính xác        |
| **8**  | Viết atomic spin RPC         | Không oversell             |
| **9**  | Edge Function `/spin`        | Backend production         |
| **10** | Participant/1-turn logic     | Không quay lặp             |
| **11** | Result + claim modal         | Hoàn thiện UX              |
| **12** | Connect frontend/backend     | End-to-end                 |
| **13** | Concurrency test             | 50 quà chính xác           |
| **14** | Responsive QA                | PC/laptop/mobile           |
| **15** | Deploy staging               | Test thật                  |
| **16** | Production                   | Go-live                    |

---

# 32. Test backend bắt buộc trước khi chạy chương trình

Tôi đặc biệt muốn chạy automated test khoảng **100–200 request concurrent**.

Kết quả phải đảm bảo:

```text
successful spins = 50

awards:
100% = 15
80% = 5
50% = 5
1M = 2
800K = 11
500K = 12

51st request:
CAMPAIGN_SOLD_OUT
```

Và:

```text
duplicate participant
→ không được award lần 2
```

Đây mới là tiêu chí backend đạt production.

---

# 33. Test frontend

Tôi sẽ test ít nhất:

```text
1920 × 1080
1600 × 900
1536 × 864
1440 × 900
1366 × 768
1280 × 720

430 × 932
412 × 915
390 × 844
375 × 812
360 × 800
```

Kiểm tra:

```text
title
wheel
button
pointer
turn box
prize table
background crop
popup
keyboard mobile
loading
animation
result
```

---

# 34. Hai cấu hình nghiệp vụ còn thiếu nhưng không cản việc bắt đầu code

Kiến trúc và frontend **đã đủ dữ liệu để làm**.

Trước khi production chỉ cần chốt thêm:

**Định danh “1 học viên = 1 lượt”**: tôi khuyến nghị dùng **số điện thoại trước khi quay**, hoặc tốt hơn là `student_id / unique URL token` nếu Edura đã có danh sách học viên.

Và **cách thực sự cấp quà**: ví dụ mỗi Voucher 800K có một mã coupon riêng, hay tất cả người trúng Voucher 800K dùng chung một mã. Điều này chỉ ảnh hưởng phần `claim`, không ảnh hưởng logic vòng quay và inventory.

---

## Hướng triển khai tôi chốt

Với yêu cầu hiện tại, tôi sẽ **không patch tiếp giao diện LadiPage cũ**. Bản hiện tại có component SpinLucky với 9 label và logic xác suất cố định phía LadiPage.  Điều đó không còn phù hợp với nghiệp vụ mới.

Bản V2 nên được xây thành một landing page responsive sạch, bám đúng hai mock PC/mobile, **6 sector**, wheel chỉ làm animation; **Supabase mới là source of truth cho cả 50 phần quà và mỗi lượt quay**.

Cách này giải quyết đồng thời cả ba mục tiêu: giao diện đúng design mới, chạy tốt PC/laptop/mobile, và quan trọng nhất là **không thể phát quá 50 quà hoặc phát một phần thưởng đã hết tồn kho**.
