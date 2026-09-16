# AI Coding Rules

> Perubahan kebutuhan supplier (16 September 2026): modul/master supplier dihapus. Supplier adalah teks opsional `supplierName` (maksimal 500 karakter) yang diisi langsung saat membuat atau mengedit kredit, tanpa pilihan atau validasi ke collection supplier. Kredit baru tidak menyimpan `supplierId`. Pembacaan relasi lama hanya untuk kompatibilitas; menyimpan edit kredit lama menggantinya dengan teks. Ketentuan ini menggantikan bagian CRUD, relasi, indeks, dan kewajiban supplier pada dokumen ini.

**Project:** Credit / Installment Management System\
**Stack:** SvelteKit + TypeScript + MongoDB\
**Document Version:** 1.0

---

## 1. Purpose

Dokumen ini berisi aturan wajib yang harus diikuti oleh AI coding agent ketika mengembangkan aplikasi.

AI coding agent harus menggunakan dokumen berikut sebagai sumber kebenaran:

1. `PRD.md`
2. `TECHNICAL_SPEC.md`
3. `DATABASE_SCHEMA.md`
4. `IMPLEMENTATION_PLAN.md`
5. `AI_CODING_RULES.md`

Urutan prioritas jika terjadi konflik:

```text
AI_CODING_RULES.md
        ↓
TECHNICAL_SPEC.md
        ↓
DATABASE_SCHEMA.md
        ↓
PRD.md
        ↓
IMPLEMENTATION_PLAN.md
```

Namun, jika terdapat konflik antara aturan bisnis yang sudah ditentukan dan asumsi teknis AI, **aturan bisnis yang telah disetujui harus dipertahankan** dan AI harus meminta klarifikasi jika konflik tersebut tidak dapat diselesaikan secara aman.

---

# 2. Core Principle

AI harus bertindak sebagai **software engineer yang mengikuti spesifikasi**, bukan sebagai product manager yang bebas mengubah requirement.

AI:

- boleh memilih implementasi teknis yang paling sesuai;
- boleh melakukan refactoring yang diperlukan;
- boleh memperbaiki bug;
- boleh menambahkan validation/security yang wajar;
- tidak boleh mengubah business rule tanpa persetujuan;
- tidak boleh menambahkan fitur hanya karena dianggap berguna;
- tidak boleh menghapus requirement yang sudah ditentukan;
- tidak boleh mengarang behavior yang belum ditentukan untuk bagian yang berdampak pada keuangan.

Jika requirement belum jelas dan keputusan tersebut dapat memengaruhi:

- uang;
- cicilan;
- pembayaran;
- profit;
- status kredit;
- data pelanggan;
- data KTP;
- keamanan;

maka **jangan menebak**.

Berhenti pada bagian tersebut dan minta klarifikasi.

---

# 3. Read Before Coding

Sebelum mengubah kode, AI wajib membaca:

```text
PRD.md
TECHNICAL_SPEC.md
DATABASE_SCHEMA.md
IMPLEMENTATION_PLAN.md
AI_CODING_RULES.md
```

Jika AI hanya mengerjakan satu phase, AI tetap harus memahami requirement yang berkaitan dengan phase tersebut.

AI tidak boleh mengimplementasikan sebuah fitur hanya berdasarkan nama task tanpa memahami business rule yang terkait.

---

# 4. Scope Control

## 4.1 No Feature Creep

Jangan menambahkan fitur yang tidak diminta.

Contoh fitur yang **tidak boleh dibuat secara otomatis**:

- inventory;
- stock management;
- warehouse;
- supplier purchasing workflow;
- multi-user;
- employee management;
- multi-business;
- customer portal;
- payment gateway;
- WhatsApp API;
- email notification;
- SMS notification;
- accounting module;
- expense management;
- tax module;
- advanced analytics;
- AI chatbot;
- mobile application.

Fitur tersebut hanya boleh dibuat jika masuk requirement resmi.

---

# 5. Important Business Model Rule

Aplikasi ini **bukan inventory management system**.

Barang dibeli dari supplier setelah pelanggan melakukan pemesanan kredit.

Karena itu:

```text
Customer
   ↓
Credit Transaction
   ↓
Supplier
```

Barang hanya disimpan sebagai snapshot pada credit transaction.

Jangan membuat:

```text
products
inventory
stock
stock_movements
warehouse
```

kecuali requirement berubah secara eksplisit.

---

# 6. Financial Rules Are Immutable

Semua perhitungan finansial harus dilakukan di server.

Frontend tidak boleh menjadi sumber kebenaran untuk:

- harga kredit;
- profit;
- DP;
- jumlah yang dibiayai;
- cicilan;
- saldo;
- alokasi pembayaran;
- status pembayaran.

Frontend hanya mengirim input.

Server melakukan:

```text
validate input
      ↓
calculate
      ↓
validate business rules
      ↓
persist transaction
```

---

# 7. Money Handling

Semua nilai uang menggunakan **integer Rupiah**.

Contoh:

```text
Rp 1.500.000
```

disimpan sebagai:

```text
1500000
```

Jangan menyimpan uang sebagai:

```text
1500000.50
```

Jangan menggunakan floating point untuk menyimpan nilai finansial.

Gunakan utility terpusat seperti:

```text
src/lib/utils/money.ts
```

Jangan membuat perhitungan uang sendiri-sendiri di setiap route/component.

---

# 8. Credit Price Calculation

Default harga kredit:

```text
creditPrice = purchasePrice × 140%
```

atau:

```text
creditPrice = round(purchasePrice × 140 / 100)
```

Contoh:

```text
purchasePrice = 10.000.000

creditPrice = 14.000.000
```

Markup 40% adalah **default**, bukan nilai yang harus selalu dipaksakan.

Admin dapat melakukan override harga kredit.

Jangan meng-hardcode:

```ts
creditPrice = purchasePrice * 1.4;
```

di banyak tempat.

Gunakan financial service/utility terpusat.

---

# 9. Profit Calculation

Profit:

```text
profit = creditPrice - purchasePrice
```

Contoh:

```text
purchasePrice = 10.000.000
creditPrice   = 14.000.000

profit = 4.000.000
```

Jika harga kredit di-override, profit harus dihitung berdasarkan harga aktual.

Jangan menggunakan default 40% untuk menghitung profit setelah override.

---

# 10. Down Payment

DP boleh:

```text
0
```

atau lebih besar dari 0.

Formula:

```text
financedAmount = creditPrice - downPayment
```

Contoh:

```text
creditPrice  = 14.000.000
downPayment  = 2.000.000

financedAmount = 12.000.000
```

Server wajib melakukan validasi agar:

```text
downPayment >= 0
downPayment <= creditPrice
```

---

# 11. Installment Generation

Tenor menggunakan bulan.

Contoh:

```text
financedAmount = 10.000.000
tenor = 3
```

Maka:

```text
Installment 1 = 3.333.333
Installment 2 = 3.333.333
Installment 3 = 3.333.334
```

Aturan:

```text
first N-1 installments = floor(financedAmount / tenor)

last installment =
financedAmount - total(first N-1 installments)
```

Invariant:

```text
sum(all installments) === financedAmount
```

Tidak boleh ada selisih pembulatan.

---

# 12. Installment Due Date

Cicilan pertama jatuh tempo satu bulan setelah tanggal mulai kredit.

Jika tanggal tersebut tidak tersedia pada bulan berikutnya, gunakan hari terakhir bulan tersebut.

Contoh:

```text
Start: 31 January

Next month:
28 February
```

atau:

```text
29 February
```

jika tahun kabisat.

Implementasi tanggal harus berada di utility/service terpusat.

---

# 13. Payment Allocation

Satu pembayaran dapat membayar:

- sebagian cicilan;
- satu cicilan penuh;
- beberapa cicilan sekaligus;
- pelunasan seluruh kredit.

Karena itu, payment tidak boleh hanya memiliki satu:

```text
installmentId
```

Payment harus memiliki allocation:

```text
allocations: [
  {
    installmentId,
    amount
  }
]
```

Contoh pembayaran:

```text
Payment = Rp 2.500.000
```

dapat menjadi:

```text
Installment 1 = Rp 1.000.000
Installment 2 = Rp 1.000.000
Installment 3 = Rp 500.000
```

---

# 14. Payment Allocation Order

Default allocation harus menggunakan cicilan paling awal yang masih memiliki outstanding.

Urutan:

```text
ORDER BY installment.sequence ASC
```

Algorithm:

```text
remainingPayment = payment.amount

for each outstanding installment:
    allocation = min(
        remainingPayment,
        installment.remainingAmount
    )

    allocate allocation

    remainingPayment -= allocation

    stop when remainingPayment === 0
```

Jangan mengalokasikan pembayaran secara acak.

---

# 15. Partial Payment

Partial payment diperbolehkan.

Contoh:

```text
Installment = Rp 1.000.000
Payment     = Rp   400.000
```

Maka:

```text
paidAmount      = 400.000
remainingAmount = 600.000
status          = PARTIAL
```

Jangan menganggap installment sebagai PAID hanya karena ada pembayaran.

---

# 16. Multiple-Month Payment

Pelanggan boleh membayar beberapa bulan sekaligus.

Contoh:

```text
Outstanding:
Month 1 = 1.000.000
Month 2 = 1.000.000
Month 3 = 1.000.000

Payment = 2.500.000
```

Allocation:

```text
Month 1 = 1.000.000
Month 2 = 1.000.000
Month 3 =   500.000
```

---

# 17. Overpayment

Pembayaran tidak boleh melebihi outstanding balance.

Jika:

```text
payment > outstandingBalance
```

tolak transaksi dengan error yang jelas.

Contoh:

```text
PAYMENT_EXCEEDS_OUTSTANDING
```

Jangan:

- membuat saldo negatif;
- membuat cicilan negatif;
- menyimpan uang sebagai credit balance;
- diam-diam mengurangi payment;
- membuang kelebihan uang.

Kecuali business rule diubah secara eksplisit.

---

# 18. Early Settlement

Pelunasan lebih awal diperbolehkan.

Tidak ada penalty.

Jika payment sama dengan outstanding:

```text
outstanding = 0
```

maka:

```text
credit.status = PAID
```

dan seluruh installment harus menjadi:

```text
PAID
```

---

# 19. No Late Payment Fine

Aplikasi tidak menggunakan denda keterlambatan.

Jika cicilan terlambat:

```text
outstandingAmount
```

tetap sama.

Jangan menambahkan:

```text
lateFee
fine
penalty
interest
```

ke saldo secara otomatis.

---

# 20. Installment Status

Status harus mengikuti kondisi aktual.

Rules:

```text
paidAmount >= amount
    → PAID

paidAmount > 0 && paidAmount < amount
    → PARTIAL

paidAmount == 0 && today > dueDate
    → OVERDUE

paidAmount == 0 && today >= dueDate
    → DUE

today < dueDate
    → UPCOMING
```

Perhatikan bahwa status berbasis tanggal dapat berubah seiring waktu.

Jangan mengandalkan status database sebagai satu-satunya sumber kebenaran jika status dapat dihitung secara deterministik.

---

# 21. Credit Status

Credit harus menjadi:

```text
PAID
```

ketika seluruh outstanding:

```text
0
```

Credit tidak boleh menjadi PAID jika masih ada outstanding.

---

# 22. Down Payment Payment Record

DP dianggap sebagai payment transaction.

Jika DP > 0, buat payment:

```text
type = DOWN_PAYMENT
```

DP tidak perlu dialokasikan ke installment.

Contoh:

```text
Credit Price = 14.000.000
DP           = 2.000.000
Financed     = 12.000.000
```

Installment hanya dibuat untuk:

```text
12.000.000
```

---

# 23. Database Rules

Gunakan MongoDB sesuai `DATABASE_SCHEMA.md`.

Jangan membuat collection baru tanpa alasan yang jelas.

Collection utama:

```text
users
customers
suppliers
credit_contracts
installments
payments
audit_logs
```

Tidak ada:

```text
products
inventory
stock_movements
```

---

# 24. MongoDB Transactions

Gunakan MongoDB transaction untuk operasi finansial yang melibatkan beberapa dokumen.

Contoh create credit:

```text
create credit
+
create installments
+
create DP payment
+
create audit log
```

harus diproses secara atomic jika seluruh operasi harus berhasil bersama.

Contoh payment:

```text
create payment
+
update installment(s)
+
update credit
+
create audit log
```

harus konsisten.

Jika salah satu bagian gagal:

```text
ROLLBACK
```

---

# 25. Concurrency

Payment adalah operasi yang sensitif terhadap race condition.

Contoh:

```text
Outstanding = Rp 1.000.000
```

Dua request datang hampir bersamaan:

```text
Payment A = Rp 700.000
Payment B = Rp 700.000
```

Sistem tidak boleh menghasilkan:

```text
Total paid = Rp 1.400.000
```

untuk outstanding Rp 1.000.000.

Gunakan transaction dan validation berdasarkan state database terbaru.

Jangan mengandalkan state yang dikirim frontend.

---

# 26. Customer Data

Customer minimal memiliki:

```text
NIK
Nama lengkap
Tanggal lahir
Alamat
Nomor telepon
Foto KTP
```

NIK harus unique.

Foto KTP adalah data private.

Jangan:

- membuat URL publik;
- memasukkan file KTP ke public directory;
- menampilkan file tanpa authentication;
- mengirim file ke frontend tanpa authorization.

---

# 27. KTP File Storage

File KTP disimpan di Cloudinary sebagai aset `authenticated`.

MongoDB menyimpan metadata seperti:

```text
storageKey
originalName
mimeType
size
uploadedAt
```

Jangan menyimpan binary file besar langsung dalam document customer kecuali architecture secara eksplisit memutuskan demikian.

Gunakan abstraction:

```text
FileStorageService
```

agar storage provider dapat diganti.

---

# 28. File Upload Validation

Upload KTP harus divalidasi di server.

Minimal validasi:

```text
MIME type
file size
file extension
```

Jangan mempercayai:

```text
filename
Content-Type dari browser
```

sebagai satu-satunya security check.

---

# 29. Customer Deletion

Customer tidak boleh dihapus jika masih memiliki credit transaction aktif atau histori yang bergantung pada customer.

Default behavior:

```text
HAS_REFERENCES
```

→ reject deletion.

Jangan melakukan cascade delete customer secara otomatis.

---

# 30. Supplier Deletion

Supplier tidak boleh dihapus jika telah digunakan oleh credit transaction.

Jangan menghapus supplier dan credit history secara cascade.

---

# 31. Credit Deletion

Business requirement saat ini memperbolehkan credit dibatalkan dengan penghapusan data.

Jika credit dihapus, data yang terkait harus diproses secara konsisten:

```text
credit
installments
payments
```

dan data terkait lainnya sesuai schema.

Penghapusan harus:

1. meminta confirmation;
2. dilakukan server-side;
3. menggunakan transaction;
4. mencegah partial deletion.

Karena penghapusan data finansial menghilangkan histori, audit log deletion harus dipertimbangkan untuk menjaga traceability.

Jangan mengubah requirement menjadi soft-delete tanpa persetujuan.

---

# 32. Audit Log

Perubahan penting harus dapat dilacak.

Contoh:

```text
CREATE_CUSTOMER
UPDATE_CUSTOMER
CREATE_SUPPLIER
CREATE_CREDIT
CREATE_PAYMENT
DELETE_CREDIT
LOGIN
```

Audit log tidak boleh digunakan untuk menyimpan password atau data rahasia yang tidak diperlukan.

Untuk operasi deletion, simpan metadata yang cukup untuk mengetahui bahwa transaksi pernah dihapus.

---

# 33. Authentication

Aplikasi saat ini hanya memiliki:

```text
1 admin / owner
```

Tidak perlu membangun:

```text
staff roles
cashier roles
manager roles
permission matrix
```

kecuali requirement berubah.

Password harus di-hash menggunakan algoritma password hashing yang aman seperti Argon2id.

Jangan menyimpan password plaintext.

---

# 34. Authorization

Semua route/data sensitif harus membutuhkan authentication.

Khusus:

```text
customers
KTP
suppliers
credits
payments
reports
audit logs
```

tidak boleh dapat diakses oleh anonymous user.

Server harus memvalidasi session.

Jangan hanya menyembunyikan menu frontend.

---

# 35. Validation

Gunakan schema validation terpusat, misalnya Zod.

Validation dilakukan:

```text
Client
+
Server
```

Tetapi:

> Server validation adalah sumber kebenaran.

Client-side validation hanya untuk UX.

---

# 36. Error Handling

Gunakan error code yang konsisten.

Contoh:

```text
VALIDATION_ERROR
UNAUTHORIZED
FORBIDDEN
NOT_FOUND
DUPLICATE_NIK
CREDIT_NOT_FOUND
INSTALLMENT_NOT_FOUND
PAYMENT_EXCEEDS_OUTSTANDING
INVALID_PAYMENT_AMOUNT
INVALID_DOWN_PAYMENT
INVALID_TENOR
CONCURRENT_MODIFICATION
```

Jangan mengirim stack trace ke user.

Jangan menampilkan error database mentah kepada user.

---

# 37. TypeScript Rules

Gunakan:

```text
strict: true
```

Hindari:

```ts
any;
```

`any` hanya boleh digunakan jika benar-benar diperlukan dan harus memiliki alasan yang jelas.

Lebih baik menggunakan:

```ts
unknown;
```

kemudian melakukan type narrowing.

Jangan membuat type duplicate untuk entity yang sama.

---

# 38. Server / Client Separation

Kode server harus tetap berada di server.

Contoh:

```text
src/lib/server/
```

Jangan import module server-only ke client component.

Data sensitif seperti:

```text
MONGODB_URI
SESSION_SECRET
CLOUDINARY_API_SECRET
```

tidak boleh masuk bundle browser.

---

# 39. Repository / Service Architecture

Gunakan pemisahan tanggung jawab.

Contoh:

```text
Repository
    ↓
Database access

Service
    ↓
Business logic

Schema
    ↓
Validation

Route / Server Action
    ↓
HTTP / form interaction

Component
    ↓
UI
```

Jangan memasukkan seluruh business logic ke Svelte component.

---

# 40. Financial Service Architecture

Logic finansial penting harus dapat digunakan dan diuji secara terpisah.

Contoh:

```text
money.ts
installment-generator.ts
payment-allocation.ts
credit-calculator.ts
```

Tujuannya agar logic dapat diuji tanpa harus menjalankan browser.

---

# 41. No Financial Logic in UI

Jangan melakukan logic seperti ini hanya di frontend:

```ts
const total = purchasePrice * 1.4;
```

atau:

```ts
const remaining = installmentAmount - paidAmount;
```

Frontend boleh melakukan preview untuk UX, tetapi server harus menghitung ulang.

Contoh:

```text
Frontend preview:
Rp 14.000.000

Server:
menghitung ulang → Rp 14.000.000
```

Jika hasil berbeda, server menjadi sumber kebenaran.

---

# 42. Date Handling

Gunakan utility tanggal terpusat.

Hindari manipulasi tanggal secara sembarangan di berbagai component.

Perhatikan:

- timezone;
- akhir bulan;
- tahun kabisat;
- due date;
- payment date;
- start date.

Tanggal bisnis harus konsisten menggunakan timezone yang telah ditentukan pada technical specification.

---

# 43. UI Rules

UI harus:

- style brutalism
- sederhana;
- cepat dipahami;
- responsive;
- cocok untuk penggunaan desktop;
- tetap usable pada mobile;
- memiliki feedback ketika submit;
- menampilkan loading state;
- menampilkan error yang jelas;
- memiliki confirmation untuk operasi destruktif.

Jangan membuat UI terlalu kompleks hanya untuk terlihat modern.

---

# 44. Destructive Actions

Operasi seperti:

```text
delete customer
delete supplier
delete credit
```

harus memiliki confirmation.

Untuk credit deletion, confirmation harus cukup jelas bahwa data terkait dapat ikut terhapus.

Jangan melakukan destructive operation hanya dengan satu accidental click.

---

# 45. Receipt

MVP receipt menggunakan browser print.

Receipt harus menampilkan informasi yang relevan seperti:

```text
Nomor pembayaran
Nama customer
Nomor kontrak
Tanggal pembayaran
Jumlah pembayaran
Alokasi pembayaran
Sisa saldo
```

PDF generation bukan prioritas MVP kecuali requirement berubah.

---

# 46. WhatsApp Reminder

WhatsApp reminder untuk MVP adalah **manual**.

Sistem dapat menghasilkan pesan dan membuka WhatsApp melalui link.

Jangan mengimplementasikan:

```text
WhatsApp Business API
automatic messaging
message queue
webhook
```

tanpa requirement tambahan.

---

# 47. Testing Rules

Setiap business logic penting wajib memiliki test.

Prioritas testing:

```text
Money calculation
Installment generation
Payment allocation
Outstanding calculation
Credit status
```

Minimal test scenario:

### Credit price

```text
10.000.000 → 14.000.000
```

### Override

```text
10.000.000 → 13.500.000
```

### DP

```text
14.000.000 - 2.000.000
= 12.000.000 financed
```

### Zero DP

```text
DP = 0
```

### Rounding

```text
10.000.000 / 3

3.333.333
3.333.333
3.333.334
```

### Partial payment

```text
Installment = 1.000.000
Payment     = 400.000

Remaining = 600.000
```

### Multiple installments

```text
Payment = 2.500.000
```

dialokasikan ke installment paling awal terlebih dahulu.

### Exact settlement

```text
payment = outstanding
```

→ credit PAID.

### Overpayment

```text
payment > outstanding
```

→ reject.

### Overdue

```text
overdue
```

→ tidak ada denda.

---

# 48. Test Before Refactor

Sebelum melakukan refactor besar pada financial engine:

1. pastikan test existing berjalan;
2. lakukan perubahan;
3. jalankan test;
4. pastikan invariant tetap terpenuhi.

Jangan melakukan refactor finansial besar tanpa regression test.

---

# 49. Financial Invariants

Invariant berikut harus selalu benar.

### Invariant 1

```text
financedAmount
=
creditPrice - downPayment
```

### Invariant 2

```text
sum(installment.amount)
=
financedAmount
```

### Invariant 3

```text
0 <= installment.paidAmount
<= installment.amount
```

### Invariant 4

Untuk payment normal:

```text
sum(payment.allocations.amount)
=
payment.amount
```

### Invariant 5

```text
paymentAmount
<=
outstandingBalance
```

### Invariant 6

```text
profit
=
creditPrice - purchasePrice
```

### Invariant 7

```text
outstandingBalance
>= 0
```

### Invariant 8

Jika:

```text
outstandingBalance === 0
```

maka:

```text
credit.status === PAID
```

---

# 50. Atomicity Rule

Jangan membuat kondisi database setengah jadi.

Contoh yang salah:

```text
1. create payment
2. update installment
3. error
```

Jika step 3 gagal, payment tidak boleh tetap tersimpan jika keseluruhan operasi seharusnya atomic.

Gunakan transaction.

---

# 51. Avoid Premature Optimization

Jangan melakukan optimisasi kompleks sebelum diperlukan.

Prioritas:

```text
Correctness
    ↓
Security
    ↓
Maintainability
    ↓
Performance
```

Jangan mengorbankan correctness demi performance.

---

# 52. Avoid Overengineering

Jangan membuat architecture yang terlalu kompleks untuk aplikasi yang hanya memiliki satu admin.

Contoh yang tidak perlu:

```text
microservices
event sourcing
CQRS
message broker
distributed cache
Kubernetes
complex permission engine
```

Gunakan architecture sederhana yang mudah dipelihara.

---

# 53. Database Indexes

Index harus dibuat berdasarkan query nyata.

Index penting antara lain:

```text
users.username unique

customers.nik unique
customers.phone

suppliers.name
suppliers.phone

credit_contracts.contractNumber unique
credit_contracts.customerId
credit_contracts.supplierId
credit_contracts.status

installments.creditId
installments.creditId + sequence unique
installments.dueDate

payments.paymentNumber unique
payments.creditId
payments.customerId
payments.paymentDate

audit_logs.entityType + entityId
audit_logs.createdAt
```

Jangan membuat index secara berlebihan tanpa alasan.

---

# 54. Number Generation

Nomor kontrak dan pembayaran harus unik.

Contoh:

```text
CR-2026-000001
PAY-2026-000001
```

Jika menggunakan counter, increment counter harus atomic.

Jangan membuat nomor berdasarkan:

```ts
collection.countDocuments() + 1;
```

karena dapat menyebabkan duplicate number pada concurrent requests.

---

# 55. Data Consistency

Jangan mengandalkan data turunan dari client.

Contoh request:

```json
{
  "purchasePrice": 10000000,
  "creditPrice": 14000000,
  "profit": 4000000
}
```

Server tidak boleh begitu saja mempercayai:

```text
creditPrice
profit
```

Server harus menghitung ulang.

---

# 56. API / Server Action Rules

Semua mutation harus:

1. authenticate user;
2. validate input;
3. load required database state;
4. validate business rule;
5. calculate server-side;
6. execute transaction jika diperlukan;
7. write audit log;
8. return safe response.

---

# 57. Logging

Log informasi yang membantu debugging tanpa membocorkan data sensitif.

Jangan log:

```text
password
passwordHash
session secret
storage secret
KTP image
NIK secara penuh jika tidak diperlukan
```

Gunakan redaction untuk informasi sensitif.

---

# 58. Git Rules

Gunakan commit kecil dan terfokus.

Contoh:

```text
feat: add customer repository
feat: add customer creation form
feat: add installment generator
test: add installment rounding tests
feat: add payment allocation engine
test: add payment allocation tests
fix: prevent payment over outstanding balance
security: protect ktp file access
```

Jangan mencampur:

```text
feature + unrelated refactor + formatting + bug fix
```

dalam satu commit besar.

---

# 59. AI Change Size

AI sebaiknya mengerjakan perubahan kecil.

Ideal:

```text
1 task
→
1 logical change
→
test
→
verify
```

Jangan mengubah puluhan file sekaligus jika tidak diperlukan.

Jika sebuah task membutuhkan perubahan besar, pecah menjadi beberapa subtask.

---

# 60. Verification After Every Phase

Setelah menyelesaikan sebuah phase, jalankan pemeriksaan yang relevan.

Minimal:

```bash
npm run check
npm run lint
npm run test
npm run build
```

Jika script tertentu belum tersedia, jangan mengarang command baru secara sembarangan.

Gunakan script yang tersedia di `package.json`.

---

# 61. Do Not Hide Errors

Jangan melakukan:

```ts
try {
  ...
} catch {
  return null;
}
```

jika error tersebut penting.

Error harus:

- ditangani;
- dilog jika perlu;
- dikembalikan sebagai error yang aman;
- atau diteruskan ke layer yang tepat.

Jangan membuat aplikasi terlihat berhasil padahal operasi gagal.

---

# 62. Loading and Empty States

Setiap halaman data harus memiliki state yang jelas:

```text
Loading
Success
Empty
Error
```

Contoh:

```text
Tidak ada pelanggan.
```

lebih baik daripada halaman kosong.

---

# 63. Form Rules

Form harus:

- memiliki validation;
- menampilkan error field;
- mempertahankan input yang valid ketika terjadi error;
- menampilkan loading state;
- mencegah duplicate submission jika diperlukan;
- menggunakan server validation.

Untuk operasi payment, duplicate submission harus menjadi perhatian khusus.

---

# 64. Duplicate Payment Protection

Payment creation harus dirancang agar double-click atau request ulang tidak menyebabkan pembayaran tercatat dua kali secara tidak sengaja.

Gunakan mekanisme yang sesuai dengan architecture, seperti:

```text
idempotency key
```

atau mekanisme duplicate submission protection lain yang konsisten.

Jangan mengandalkan tombol frontend saja.

---

# 65. Security First for KTP

KTP adalah data sensitif.

AI wajib memperlakukan KTP sebagai private data.

Jangan:

```text
/public/ktp/...
```

Jangan menggunakan public bucket URL.

Akses harus melalui authenticated server endpoint atau mekanisme private object storage yang aman.

---

# 66. Security Review Before Production

Sebelum production, pastikan:

```text
Authentication
Authorization
Session security
Password hashing
Input validation
File upload security
KTP access control
CSRF protection where applicable
Rate limiting
Secret management
Error handling
Database access security
```

sudah diperiksa.

---

# 67. Do Not Commit Secrets

Jangan commit:

```text
.env
.env.local
database passwords
API keys
storage credentials
SESSION_SECRET
```

Gunakan:

```text
.env.example
```

untuk dokumentasi variable environment.

---

# 68. Environment Variables

Environment variables harus hanya digunakan di server untuk secret.

Contoh:

```text
MONGODB_URI
MONGODB_DB_NAME
SESSION_SECRET
CLOUDINARY_CLOUD_NAME
CLOUDINARY_API_KEY
CLOUDINARY_API_SECRET
```

Jangan mengekspos secret ke browser.

---

# 69. Production Data Safety

Sebelum migration yang berpotensi merusak data:

- backup database;
- verifikasi migration;
- test pada development/staging;
- jangan langsung menjalankan destructive migration pada production.

AI tidak boleh menjalankan operasi destructive terhadap production database tanpa explicit approval.

---

# 70. Never Invent Missing Financial Rules

Jika ditemukan pertanyaan seperti:

> Apakah customer boleh membayar kurang dari Rp 1.000?

atau:

> Apakah DP boleh lebih besar dari harga barang?

atau:

> Apakah harga kredit boleh lebih rendah dari harga beli?

AI tidak boleh membuat keputusan bisnis sendiri jika requirement belum menentukan jawabannya.

Gunakan:

```text
CLARIFICATION_REQUIRED
```

dan minta keputusan.

---

# 71. Assumption Rules

Untuk hal non-finansial yang tidak berdampak signifikan, AI boleh menggunakan reasonable default.

Contoh:

```text
button placement
component naming
internal helper naming
CSS structure
```

Untuk business-critical behavior, jangan menggunakan asumsi.

---

# 72. Existing Code Is Not Automatically Correct

AI harus mengikuti dokumentasi, bukan secara otomatis mengikuti behavior kode lama jika kode tersebut bertentangan dengan specification.

Jika menemukan:

```text
existing code != documented business rule
```

AI harus:

1. identify conflict;
2. determine impact;
3. fix if clearly wrong;
4. otherwise ask for clarification.

---

# 73. Backward Compatibility

Jika database sudah berisi data production, jangan mengubah schema secara destructive tanpa migration strategy.

Contoh perubahan:

```text
rename field
remove field
change data type
change payment structure
```

harus mempertimbangkan data existing.

---

# 74. No Silent Data Mutation

Jangan mengubah histori finansial secara diam-diam.

Contoh:

```text
old payment
old installment
old credit price
old purchase price
```

tidak boleh berubah hanya karena business calculation saat ini berubah.

Data transaksi harus merepresentasikan kondisi saat transaksi dibuat.

---

# 75. Snapshot Principle

Data barang pada credit harus menjadi snapshot.

Contoh:

```text
item: {
  name,
  description,
  purchasePrice
}
```

Perubahan data supplier atau informasi lain di masa depan tidak boleh mengubah histori transaksi lama.

---

# 76. Reports

Report harus menggunakan data transaksi aktual.

Profit:

```text
creditPrice - purchasePrice
```

bukan:

```text
default markup 40%
```

jika credit price telah di-override.

---

# 77. Dashboard

Dashboard harus menampilkan informasi yang konsisten dengan database.

Contoh:

```text
Total customer
Active credits
Outstanding balance
Overdue installments
Total profit
Payments received
```

Perhitungan dashboard tidak boleh menghasilkan angka yang berbeda dari detail transaction.

---

# 78. Search

Search harus menggunakan field yang memang relevan.

Customer:

```text
name
NIK
phone
```

Credit:

```text
contract number
customer
```

Payment:

```text
payment number
customer
contract
```

Jangan membuat search engine kompleks untuk MVP.

---

# 79. Accessibility

UI minimal harus memperhatikan:

- label form;
- keyboard navigation;
- readable text;
- clear validation messages;
- button states;
- semantic HTML jika memungkinkan.

Jangan membuat UI yang hanya dapat digunakan dengan mouse.

---

# 80. Responsive Design

Desktop adalah primary use case, tetapi halaman harus tetap usable pada layar kecil.

Prioritas responsive:

```text
Dashboard
Customer list
Credit list
Credit detail
Payment form
Receipt
```

Table besar dapat menggunakan horizontal scrolling pada mobile jika diperlukan.

---

# 81. AI Must Explain Important Changes

Jika AI melakukan perubahan yang signifikan terhadap:

- database;
- financial logic;
- authentication;
- payment allocation;
- deletion;
- file security;

AI harus menjelaskan secara singkat:

```text
What changed
Why it changed
How it was verified
```

---

# 82. Stop Conditions

AI harus berhenti dan meminta keputusan manusia jika:

1. business rule belum jelas;
2. dua dokumen memiliki conflict;
3. schema tidak cukup untuk memenuhi requirement;
4. perubahan dapat menyebabkan kehilangan data;
5. perubahan memengaruhi histori finansial;
6. perubahan memerlukan keputusan product;
7. security impact tidak dapat ditentukan;
8. migration destructive diperlukan.

---

# 83. Coding Workflow

Untuk setiap task gunakan workflow:

```text
1. Read relevant documentation
2. Inspect existing code
3. Identify affected modules
4. Plan minimal change
5. Implement
6. Add/update tests
7. Run checks
8. Review business invariants
9. Review security implications
10. Summarize changes
```

---

# 84. Recommended AI Task Format

Ketika memberikan task kepada coding agent, gunakan format:

```text
## Task

[deskripsi task]

## Scope

[apa yang boleh diubah]

## Do Not Change

[apa yang tidak boleh disentuh]

## Requirements

[requirement]

## Acceptance Criteria

[kriteria selesai]

## Tests

[test yang harus dibuat/dijalankan]
```

Contoh:

```text
## Task

Implement payment allocation engine.

## Scope

Only payment domain logic.

## Do Not Change

Do not change installment calculation rules.

## Requirements

- Support partial payment.
- Support multiple installments.
- Allocate from earliest outstanding installment.
- Reject payment above outstanding balance.

## Acceptance Criteria

- Allocation sum equals payment amount.
- No installment becomes negative.
- Exact settlement marks credit as PAID.

## Tests

Add unit tests for:
- partial payment
- multiple installments
- exact settlement
- overpayment
```

---

# 85. AI Should Not Work With Giant Prompts

Jangan memberikan seluruh aplikasi sebagai satu task.

Gunakan incremental development:

```text
Foundation
    ↓
Database
    ↓
Authentication
    ↓
Customers
    ↓
Suppliers
    ↓
Financial utilities
    ↓
Installment engine
    ↓
Credits
    ↓
Payments
    ↓
Reports
    ↓
Testing
    ↓
Security
    ↓
Production
```

---

# 86. Definition of Done

Sebuah task dianggap selesai jika:

- requirement telah diimplementasikan;
- tidak melanggar business rule;
- TypeScript check berhasil;
- lint berhasil;
- test relevan berhasil;
- build berhasil jika relevan;
- tidak ada secret yang bocor;
- tidak ada financial invariant yang rusak;
- error handling tersedia;
- loading/empty/error state tersedia jika diperlukan;
- perubahan tidak memperluas scope tanpa alasan.

---

# 87. Final Financial Checklist

Sebelum menyatakan sistem siap digunakan, pastikan:

```text
[ ] Credit price default = purchase price + 40%
[ ] Credit price dapat di-override
[ ] Profit dihitung dari actual credit price
[ ] DP dapat 0
[ ] DP mengurangi financed amount
[ ] Installment menggunakan integer Rupiah
[ ] Rounding tidak menghasilkan selisih
[ ] Due date mengikuti aturan bulanan
[ ] Partial payment bekerja
[ ] Multiple installment payment bekerja
[ ] Payment allocation berurutan
[ ] Overpayment ditolak
[ ] Early settlement bekerja
[ ] Tidak ada late fee
[ ] Outstanding tidak pernah negatif
[ ] Semua installment selesai → credit PAID
[ ] Payment transaction atomic
[ ] Concurrent payment aman
```

---

# 88. Final Security Checklist

```text
[ ] Password tidak disimpan plaintext
[ ] Authentication bekerja
[ ] Authorization bekerja
[ ] Session aman
[ ] Secret tidak masuk repository
[ ] MongoDB credentials aman
[ ] KTP private
[ ] KTP tidak berada di public directory
[ ] File upload divalidasi
[ ] Server-side validation aktif
[ ] Financial calculation server-side
[ ] Error tidak membocorkan internal details
[ ] Login rate limiting dipertimbangkan
[ ] Destructive operation membutuhkan confirmation
[ ] Production database tidak dapat dihapus secara tidak sengaja
```

---

# 89. Final Architecture Principle

Arsitektur aplikasi harus mengikuti prinsip:

```text
UI
 ↓
Route / Server Action
 ↓
Validation
 ↓
Service
 ↓
Repository
 ↓
MongoDB
```

Untuk financial operation:

```text
Request
 ↓
Authentication
 ↓
Validation
 ↓
Load latest database state
 ↓
Business validation
 ↓
Financial calculation
 ↓
MongoDB transaction
 ├── Payment
 ├── Installment updates
 ├── Credit update
 └── Audit log
 ↓
Response
```

---

# 90. Golden Rule

Jika hanya ada satu aturan yang harus diingat AI coding agent:

> **Jangan pernah mengorbankan kebenaran data finansial, keamanan data pelanggan, atau business rule demi membuat implementasi lebih cepat.**

Jika requirement jelas:

```text
IMPLEMENT
```

Jika implementation detail belum jelas tetapi business rule jelas:

```text
CHOOSE THE SIMPLEST SAFE IMPLEMENTATION
```

Jika business rule belum jelas:

```text
STOP → ASK FOR CLARIFICATION
```

Jika ada risiko kehilangan data:

```text
STOP → REQUIRE EXPLICIT APPROVAL
```

---

# 91. Source of Truth

AI coding agent harus memperlakukan dokumen proyek sebagai kontrak.

```text
PRD.md
TECHNICAL_SPEC.md
DATABASE_SCHEMA.md
IMPLEMENTATION_PLAN.md
AI_CODING_RULES.md
```

Kode harus mengikuti dokumen.

Jika kode dan dokumen berbeda, jangan mengubah business rule secara diam-diam.

Perubahan requirement harus dilakukan secara eksplisit melalui dokumentasi terlebih dahulu, kemudian implementasi disesuaikan.

---

# 92. End

**AI Coding Agent Instruction:**

> Read the project documentation before coding.\
> Follow the defined architecture and business rules.\
> Keep financial calculations server-side.\
> Preserve database consistency and financial invariants.\
> Do not invent business rules.\
> Do not add features outside the scope.\
> Prefer simple, maintainable implementations.\
> Test critical financial logic.\
> Protect customer and KTP data.\
> When a business-critical requirement is ambiguous, stop and ask.
