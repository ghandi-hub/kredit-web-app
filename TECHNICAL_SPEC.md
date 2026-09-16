# Technical Specification

> Perubahan kebutuhan supplier (16 September 2026): modul/master supplier dihapus. Supplier adalah teks opsional `supplierName` (maksimal 500 karakter) yang diisi langsung saat membuat atau mengedit kredit, tanpa pilihan atau validasi ke collection supplier. Kredit baru tidak menyimpan `supplierId`. Pembacaan relasi lama hanya untuk kompatibilitas; menyimpan edit kredit lama menggantinya dengan teks. Ketentuan ini menggantikan bagian CRUD, relasi, indeks, dan kewajiban supplier pada dokumen ini.
## Sistem Manajemen Kredit / Cicilan

**Version:** 1.0  
**Status:** Ready for Implementation  
**Stack:** SvelteKit + TypeScript + MongoDB

---

# 1. Tujuan Dokumen

Dokumen ini menerjemahkan kebutuhan bisnis pada `PRD.md` menjadi spesifikasi teknis yang dapat digunakan sebagai acuan implementasi oleh developer maupun AI coding agent.

Dokumen ini menentukan:

- arsitektur aplikasi
- struktur project
- database schema
- relasi data
- business logic
- perhitungan harga kredit
- pembuatan jadwal cicilan
- mekanisme pembayaran
- partial payment
- pembayaran beberapa cicilan sekaligus
- early settlement
- validation
- authentication
- file KTP
- API/server actions
- error handling
- security
- testing
- deployment

AI coding agent harus mengikuti dokumen ini dan tidak membuat business rule baru tanpa persetujuan.

---

# 2. Tech Stack

## 2.1 Core

- SvelteKit
- TypeScript
- MongoDB
- MongoDB Node.js Driver
- Zod
- Tailwind CSS
- Playwright
- Vitest

## 2.2 Runtime

Node.js LTS.

TypeScript menggunakan strict mode.

## 2.3 Database

MongoDB Atlas direkomendasikan untuk production.

Aplikasi berkomunikasi dengan MongoDB hanya dari server.

MongoDB client tidak boleh dikirim ke browser.

---

# 3. Arsitektur

Arsitektur menggunakan pola:

```text
Browser
   |
   v
SvelteKit
   |
   +-- Authentication
   |
   +-- Server Actions / Server API
   |
   +-- Validation
   |
   +-- Business Services
   |
   +-- MongoDB Repository
   |
   v
MongoDB
```

Untuk operasi yang mengubah data finansial, business logic harus berada di server.

Browser tidak boleh menentukan:

- total kredit
- harga kredit
- total profit
- jumlah cicilan
- jumlah pembayaran yang dialokasikan
- saldo kredit

Semua nilai finansial harus dihitung ulang di server.

---

# 4. Prinsip Utama

## 4.1 Tidak Ada Inventory

Aplikasi tidak memiliki:

- products collection
- inventory collection
- stock
- stock movements
- warehouse

Barang dibeli dari supplier setelah customer meminta barang.

Informasi barang disimpan sebagai snapshot di dalam transaksi kredit.

Contoh:

```json
{
  "item": {
    "name": "iPhone 15 Pro",
    "brand": "Apple",
    "model": "15 Pro",
    "serialNumber": "ABC123"
  }
}
```

Jika supplier atau barang berubah di masa depan, transaksi lama tidak boleh berubah.

---

# 5. Struktur Project

Struktur yang direkomendasikan:

```text
src/
├── lib/
│   ├── components/
│   │   ├── ui/
│   │   ├── customers/
│   │   ├── suppliers/
│   │   ├── credits/
│   │   ├── payments/
│   │   └── dashboard/
│   │
│   ├── server/
│   │   ├── db/
│   │   │   ├── mongodb.ts
│   │   │   └── collections.ts
│   │   │
│   │   ├── auth/
│   │   ├── customers/
│   │   ├── suppliers/
│   │   ├── credits/
│   │   ├── payments/
│   │   ├── reports/
│   │   ├── audit/
│   │   └── storage/
│   │
│   ├── schemas/
│   │   ├── customer.ts
│   │   ├── supplier.ts
│   │   ├── credit.ts
│   │   └── payment.ts
│   │
│   ├── utils/
│   │   ├── money.ts
│   │   ├── dates.ts
│   │   └── formatting.ts
│   │
│   └── types/
│       ├── customer.ts
│       ├── supplier.ts
│       ├── credit.ts
│       └── payment.ts
│
├── routes/
│   ├── login/
│   ├── dashboard/
│   ├── customers/
│   ├── suppliers/
│   ├── credits/
│   ├── payments/
│   └── reports/
│
├── hooks.server.ts
└── app.d.ts
```

---

# 6. Authentication

Aplikasi saat ini hanya memiliki satu user/admin.

Tidak perlu:

- role management kompleks
- staff management
- receiver management
- permission matrix

Tetapi struktur authentication harus memungkinkan pengembangan multi-user di masa depan.

## 6.1 User

Collection:

```text
users
```

Schema:

```typescript
{
  _id: ObjectId,
  username: string,
  passwordHash: string,
  name: string,
  role: "ADMIN",
  createdAt: Date,
  updatedAt: Date
}
```

`username` harus unique.

Password tidak boleh disimpan plaintext.

Gunakan password hashing yang aman, direkomendasikan Argon2id.

---

# 7. Session

Authentication menggunakan server-side session atau signed secure session cookie.

Cookie:

```text
httpOnly: true
secure: true (production)
sameSite: lax
```

Session tidak boleh disimpan di `localStorage`.

Semua halaman aplikasi kecuali `/login` harus membutuhkan authentication.

---

# 8. MongoDB Collections

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

Tidak ada collection:

```text
products
inventory
stock
```

---

# 9. Customer Schema

Collection:

```text
customers
```

Schema:

```typescript
{
  _id: ObjectId,

  nik: string,

  name: string,

  dateOfBirth?: Date,

  phone: string,

  address: string,

  ktpPhoto?: {
    storageKey: string,
    originalName: string,
    mimeType: string,
    size: number,
    uploadedAt: Date
  },

  createdAt: Date,
  updatedAt: Date
}
```

## 9.1 NIK

NIK:

- wajib
- 16 digit
- unique

Validation:

```text
^[0-9]{16}$
```

---

# 10. KTP Photo

Foto KTP tidak disimpan sebagai binary langsung di MongoDB.

MongoDB hanya menyimpan metadata dan reference:

```text
storageKey
originalName
mimeType
size
uploadedAt
```

Storage harus menggunakan abstraction:

```typescript
interface FileStorageService {
  upload(file: File): Promise<StoredFile>
  get(key: string): Promise<File>
  delete(key: string): Promise<void>
}
```

Development dan production menggunakan Cloudinary dengan delivery type `authenticated`. Kredensial hanya tersedia di server. Foto diambil melalui endpoint aplikasi dengan signed download URL berumur 60 detik yang tidak dikirim ke browser.

Foto KTP:

- tidak boleh public
- hanya dapat diakses user yang authenticated
- harus divalidasi MIME type
- harus memiliki batas ukuran
- nama file asli tidak boleh digunakan sebagai storage key

---

# 11. Supplier Schema

Collection:

```text
suppliers
```

Schema:

```typescript
{
  _id: ObjectId,

  name: string,

  phone?: string,

  address?: string,

  notes?: string,

  createdAt: Date,
  updatedAt: Date
}
```

Supplier tidak memiliki inventory.

---

# 12. Credit Contract

Collection:

```text
credit_contracts
```

Schema:

```typescript
{
  _id: ObjectId,

  contractNumber: string,

  customerId: ObjectId,

  supplierId: ObjectId,

  item: {
    name: string,
    brand?: string,
    model?: string,
    serialNumber?: string,
    notes?: string
  },

  purchasePrice: number,

  creditPrice: number,

  markupPercent: number,

  profit: number,

  downPayment: number,

  financedAmount: number,

  tenorMonths: number,

  startDate: Date,

  dueDay: number,

  status: "ACTIVE" | "PAID",

  createdAt: Date,
  updatedAt: Date
}
```

---

# 13. Credit Number

Setiap transaksi kredit memiliki nomor unik.

Contoh:

```text
CR-2026-000001
CR-2026-000002
```

`contractNumber` harus unique.

---

# 14. Harga Kredit

Default markup:

```text
40%
```

Harga kredit default:

```text
creditPrice = purchasePrice + 40%
```

Secara matematis:

```text
creditPrice = purchasePrice × 140 / 100
```

Karena Rupiah menggunakan integer, hasil harus dibulatkan ke Rupiah terdekat.

Contoh:

```text
purchasePrice = 10.000.000

creditPrice = 14.000.000
```

---

# 15. Override Harga Kredit

40% hanya merupakan default.

Admin dapat mengubah harga kredit sebelum transaksi disimpan.

Contoh:

```text
Harga beli     : Rp10.000.000
Default kredit : Rp14.000.000

Admin override : Rp13.500.000
```

Maka:

```text
creditPrice = 13.500.000
profit = 13.500.000 - 10.000.000
       = 3.500.000
```

`markupPercent` harus dihitung berdasarkan harga aktual:

```text
markupPercent =
((creditPrice - purchasePrice) / purchasePrice) × 100
```

Untuk laporan, profit tetap menggunakan:

```text
profit = creditPrice - purchasePrice
```

---

# 16. Down Payment

DP boleh:

```text
Rp0
```

atau lebih besar.

Validation:

```text
0 <= downPayment <= creditPrice
```

Financed amount:

```text
financedAmount = creditPrice - downPayment
```

Contoh:

```text
Harga kredit = Rp14.000.000
DP           = Rp2.000.000

Financed:
14.000.000 - 2.000.000
= Rp12.000.000
```

---

# 17. DP Sebagai Payment

DP dianggap sebagai pembayaran.

Namun DP tidak dialokasikan ke installment.

Payment DP memiliki:

```text
type = "DOWN_PAYMENT"
```

Tujuannya agar seluruh uang yang diterima dari customer tercatat dalam payment history.

Contoh:

```text
Credit Price       Rp14.000.000
Down Payment        Rp2.000.000
Remaining Credit   Rp12.000.000
```

---

# 18. Tenor

Tenor menggunakan satuan bulan.

Contoh:

```text
3 bulan
6 bulan
12 bulan
18 bulan
24 bulan
```

`tenorMonths` harus berupa integer positif.

---

# 19. Installment Schema

Collection:

```text
installments
```

Schema:

```typescript
{
  _id: ObjectId,

  creditId: ObjectId,

  sequence: number,

  dueDate: Date,

  amount: number,

  paidAmount: number,

  createdAt: Date,
  updatedAt: Date
}
```

Status installment tidak wajib disimpan sebagai source of truth.

Status dapat dihitung berdasarkan:

```text
amount
paidAmount
dueDate
current date
```

Hal ini menghindari status tanggal yang stale ketika tidak ada aktivitas pembayaran.

---

# 20. Pembuatan Jadwal Cicilan

Financed amount dibagi dengan tenor.

Contoh:

```text
Financed Amount = Rp10.000.000
Tenor = 3 bulan
```

Perhitungan:

```text
base = floor(10.000.000 / 3)
     = 3.333.333
```

Maka:

```text
Installment 1 = 3.333.333
Installment 2 = 3.333.333
Installment 3 = 3.333.334
```

Installment terakhir menampung sisa pembulatan.

Total selalu harus sama:

```text
3.333.333
+ 3.333.333
+ 3.333.334
= 10.000.000
```

---

# 21. Due Date

Tanggal pembayaran pertama adalah satu bulan setelah `startDate`.

Contoh:

```text
Start Date:
15 September 2026

Installment 1:
15 Oktober 2026

Installment 2:
15 November 2026

Installment 3:
15 Desember 2026
```

---

# 22. Edge Case Tanggal

Jika tanggal tidak tersedia di bulan berikutnya, gunakan hari terakhir bulan tersebut.

Contoh:

```text
Start Date:
31 Januari

Next month:
Februari
```

Maka due date:

```text
28 Februari
```

atau:

```text
29 Februari
```

jika leap year.

Untuk bulan berikutnya, gunakan `dueDay` asli jika tersedia.

---

# 23. Installment Status

Status dihitung:

```text
if paidAmount >= amount:
    PAID

else if paidAmount > 0:
    PARTIAL

else if today > dueDate:
    OVERDUE

else if today >= dueDate:
    DUE

else:
    UPCOMING
```

Status:

```text
UPCOMING
DUE
PARTIAL
PAID
OVERDUE
```

Tidak ada status:

```text
LATE_FEE
DEFAULT
```

---

# 24. Tidak Ada Denda

Aplikasi tidak menghitung denda.

Jika customer terlambat:

```text
amount tetap
```

Contoh:

```text
Cicilan:
Rp1.000.000

Terlambat 2 bulan.

Saldo tetap:
Rp1.000.000
```

Tidak ada:

```text
Rp1.000.000 + denda
```

---

# 25. Payment Schema

Collection:

```text
payments
```

Schema:

```typescript
{
  _id: ObjectId,

  paymentNumber: string,

  creditId: ObjectId,

  customerId: ObjectId,

  amount: number,

  paymentDate: Date,

  method: "CASH" | "TRANSFER" | "OTHER",

  type:
    | "DOWN_PAYMENT"
    | "INSTALLMENT"
    | "EARLY_SETTLEMENT",

  allocations: [
    {
      installmentId: ObjectId,
      amount: number
    }
  ],

  notes?: string,

  createdAt: Date
}
```

---

# 26. Mengapa Payment Memiliki Allocations

Satu payment dapat membayar lebih dari satu installment.

Contoh:

```text
Customer membayar Rp3.000.000
```

Cicilan:

```text
Cicilan 1 = Rp1.000.000
Cicilan 2 = Rp1.000.000
Cicilan 3 = Rp1.000.000
```

Satu payment dapat memiliki:

```json
{
  "amount": 3000000,
  "allocations": [
    {
      "installmentId": "...",
      "amount": 1000000
    },
    {
      "installmentId": "...",
      "amount": 1000000
    },
    {
      "installmentId": "...",
      "amount": 1000000
    }
  ]
}
```

Dengan model ini:

- satu installment dapat memiliki banyak payment
- satu payment dapat membayar banyak installment

---

# 27. Payment Allocation Algorithm

Semua payment installment menggunakan prinsip:

> Bayar installment paling awal yang masih memiliki saldo terlebih dahulu.

Misalnya:

```text
Installment 1
Amount: 1.000.000
Paid:   500.000
Remaining: 500.000

Installment 2
Amount: 1.000.000
Paid:   0
Remaining: 1.000.000
```

Customer membayar:

```text
Rp1.000.000
```

Allocation:

```text
Installment 1 = 500.000
Installment 2 = 500.000
```

Setelah pembayaran:

```text
Installment 1 = PAID
Installment 2 = PARTIAL
```

---

# 28. Pembayaran Sebagian

Customer boleh membayar sebagian installment.

Contoh:

```text
Cicilan = Rp1.000.000

Customer bayar = Rp400.000
```

Maka:

```text
paidAmount = Rp400.000
remaining = Rp600.000
status = PARTIAL
```

Tidak ada denda.

---

# 29. Pembayaran Lebih Besar dari Cicilan

Jika:

```text
Cicilan 1 = Rp1.000.000
Cicilan 2 = Rp1.000.000
Cicilan 3 = Rp1.000.000
```

Customer membayar:

```text
Rp2.500.000
```

Maka:

```text
Cicilan 1 = Rp1.000.000
Cicilan 2 = Rp1.000.000
Cicilan 3 = Rp500.000
```

Satu payment memiliki tiga allocation.

---

# 30. Overpayment

Customer tidak boleh membayar lebih besar daripada total outstanding balance.

Contoh:

```text
Outstanding = Rp2.000.000
Payment     = Rp2.500.000
```

Payment harus ditolak:

```text
PAYMENT_EXCEEDS_OUTSTANDING
```

Admin harus memperbaiki nominal pembayaran.

Aplikasi tidak menyimpan saldo customer sebagai "credit balance" pada MVP.

---

# 31. Early Settlement

Customer boleh melunasi seluruh kredit lebih awal.

Contoh:

```text
Outstanding:
Rp5.500.000
```

Customer membayar:

```text
Rp5.500.000
```

Semua installment menjadi:

```text
PAID
```

Credit:

```text
PAID
```

Tidak ada penalty.

Payment type:

```text
EARLY_SETTLEMENT
```

---

# 32. Credit Status

Credit memiliki:

```text
ACTIVE
PAID
```

Rules:

```text
remaining > 0
=> ACTIVE

remaining = 0
=> PAID
```

`remaining` dihitung dari:

```text
financedAmount - total installment payments
```

DP sudah dikurangi dari credit price ketika menentukan `financedAmount`.

---

# 33. Total Paid

Total pembayaran kredit:

```text
totalPaid =
sum(payment.amount)
```

Termasuk:

```text
DOWN_PAYMENT
INSTALLMENT
EARLY_SETTLEMENT
```

---

# 34. Remaining Balance

Remaining balance:

```text
remainingBalance =
creditPrice - totalPaid
```

Namun untuk status installment, balance installment dihitung dari:

```text
installment.amount - installment.paidAmount
```

DP tidak dialokasikan ke installment karena DP sudah mengurangi financed amount.

---

# 35. Profit

Profit tidak bergantung pada pembayaran.

Formula:

```text
profit =
creditPrice - purchasePrice
```

Contoh:

```text
Purchase Price = Rp10.000.000
Credit Price   = Rp14.000.000

Profit:
Rp4.000.000
```

Walaupun customer baru membayar Rp2.000.000, profit transaksi tetap:

```text
Rp4.000.000
```

---

# 36. Transaction Creation Flow

Ketika admin membuat transaksi kredit:

```text
1. Validate customer
2. Validate supplier
3. Validate item
4. Validate purchase price
5. Calculate default credit price
6. Allow admin override
7. Validate down payment
8. Calculate financed amount
9. Calculate profit
10. Generate contract number
11. Create credit_contract
12. Generate installments
13. Create DP payment jika DP > 0
14. Write audit log
15. Return credit detail
```

Semua operasi yang harus konsisten dilakukan dalam MongoDB transaction jika deployment MongoDB mendukung transactions.

---

# 37. Payment Creation Flow

Saat admin mencatat pembayaran:

```text
1. Authenticate user
2. Load credit
3. Verify credit is ACTIVE
4. Validate amount
5. Calculate outstanding
6. Reject if payment > outstanding
7. Find unpaid/partial installments
8. Sort by sequence ASC
9. Allocate payment
10. Update installment paidAmount
11. Create payment record
12. Determine credit status
13. Update credit
14. Write audit log
15. Return receipt data
```

Payment creation harus menggunakan MongoDB transaction.

Tujuannya mencegah:

```text
payment tercatat
tetapi installment gagal di-update
```

atau sebaliknya.

---

# 38. MongoDB Transaction

Payment transaction secara konsep:

```text
START TRANSACTION

create payment
update installment 1
update installment 2
update installment 3
update credit

create audit log

COMMIT
```

Jika salah satu operasi gagal:

```text
ROLLBACK
```

---

# 39. Cancellation / Deletion

Jika credit dibatalkan, user meminta data transaksi dihapus.

Cascade deletion:

```text
credit_contract
installments
payments
```

dan allocation yang terdapat di payments ikut hilang.

Audit log dapat dipertahankan jika dibutuhkan untuk audit internal.

Sebelum deletion:

```text
confirm("Hapus transaksi ini?")
```

Tidak boleh ada deletion melalui GET request.

Deletion harus menggunakan POST/action/DELETE.

---

# 40. Customer Deletion

Customer dengan transaksi kredit sebaiknya tidak dapat dihapus secara bebas.

Untuk MVP:

```text
Jika customer memiliki credit:
    jangan izinkan hard delete
```

Customer dapat diedit.

Alasan:

Menjaga referential integrity dan mencegah data transaksi kehilangan customer.

---

# 41. Supplier Deletion

Supplier yang sudah digunakan pada credit juga sebaiknya tidak dihapus secara hard delete.

Gunakan soft delete jika fitur deletion diperlukan di masa depan.

---

# 42. Audit Log

Collection:

```text
audit_logs
```

Schema:

```typescript
{
  _id: ObjectId,

  actorId: ObjectId,

  action: string,

  entityType: string,

  entityId: ObjectId,

  metadata?: Record<string, unknown>,

  createdAt: Date
}
```

Contoh actions:

```text
CUSTOMER_CREATED
CUSTOMER_UPDATED

SUPPLIER_CREATED
SUPPLIER_UPDATED

CREDIT_CREATED
CREDIT_DELETED

PAYMENT_CREATED
```

Audit log tidak boleh menyimpan password.

Data sensitif KTP tidak perlu diduplikasi ke audit log.

---

# 43. Database Index

## users

```text
username: unique
```

## customers

```text
nik: unique
phone
name
```

## suppliers

```text
name
phone
```

## credit_contracts

```text
contractNumber: unique
customerId
supplierId
status
startDate
```

## installments

```text
creditId
creditId + sequence
creditId + dueDate
```

## payments

```text
paymentNumber: unique
creditId
customerId
paymentDate
```

## audit_logs

```text
entityType + entityId
createdAt
```

---

# 44. Money Handling

Semua nominal Rupiah disimpan sebagai integer.

Contoh:

```typescript
10000000
```

bukan:

```text
"10.000.000"
```

dan bukan:

```text
10000000.50
```

UI melakukan formatting:

```text
10000000
```

menjadi:

```text
Rp10.000.000
```

Business logic tidak boleh melakukan perhitungan menggunakan string hasil formatting.

---

# 45. Money Utility

Buat utility:

```typescript
calculateCreditPrice(purchasePrice)
calculateProfit(purchasePrice, creditPrice)
calculateFinancedAmount(creditPrice, downPayment)
generateInstallments(amount, tenor)
```

Contoh:

```typescript
calculateCreditPrice(10_000_000)
```

menghasilkan:

```text
14_000_000
```

---

# 46. Validation

Gunakan Zod.

## Customer

```text
name:
required

NIK:
required
16 digits

phone:
required

address:
required
```

## Credit

```text
purchasePrice > 0

creditPrice > 0

downPayment >= 0

downPayment <= creditPrice

tenorMonths > 0

startDate valid

dueDay 1..31
```

## Payment

```text
amount > 0

paymentDate valid

creditId valid
```

---

# 47. Business Validation

Server harus melakukan validation walaupun frontend sudah melakukan validation.

Frontend validation:

```text
UX
```

Server validation:

```text
security + correctness
```

Tidak boleh percaya data dari browser.

---

# 48. Error Handling

Gunakan error code yang konsisten.

Contoh:

```text
UNAUTHORIZED
FORBIDDEN

CUSTOMER_NOT_FOUND
CUSTOMER_NIK_ALREADY_EXISTS

SUPPLIER_NOT_FOUND

CREDIT_NOT_FOUND
CREDIT_ALREADY_PAID

INVALID_CREDIT_AMOUNT
INVALID_DOWN_PAYMENT

PAYMENT_AMOUNT_INVALID
PAYMENT_EXCEEDS_OUTSTANDING
PAYMENT_CREDIT_NOT_ACTIVE

INSTALLMENT_NOT_FOUND

FILE_INVALID
FILE_TOO_LARGE
```

UI menampilkan pesan yang mudah dipahami manusia.

Contoh:

```text
Pembayaran melebihi sisa tagihan.
```

Bukan:

```text
PAYMENT_EXCEEDS_OUTSTANDING
```

---

# 49. Routes

## Authentication

```text
/login
```

## Dashboard

```text
/dashboard
```

## Customers

```text
/customers
/customers/new
/customers/[id]
/customers/[id]/edit
```

## Suppliers

```text
/suppliers
/suppliers/new
/suppliers/[id]
/suppliers/[id]/edit
```

## Credits

```text
/credits
/credits/new
/credits/[id]
```

## Payments

```text
/payments
/payments/[id]
```

## Reports

```text
/reports
/reports/profit
/reports/payments
/reports/overdue
```

---

# 50. Credit Detail Page

Credit detail minimal menampilkan:

```text
Customer
NIK

Barang
Supplier

Harga beli
Harga kredit
Profit

DP
Total yang dibiayai

Tenor
Tanggal mulai

Total pembayaran
Sisa pembayaran

Status kredit
```

Kemudian tabel installment:

```text
No | Jatuh Tempo | Nominal | Dibayar | Sisa | Status
```

Dan payment history:

```text
Tanggal | Nomor Pembayaran | Nominal | Metode | Tipe
```

---

# 51. Payment Form

Form pembayaran:

```text
Credit
Customer
Outstanding

Tanggal pembayaran
Nominal
Metode pembayaran
Catatan
```

Sistem menampilkan preview:

```text
Pembayaran:
Rp2.500.000

Akan dialokasikan:

Cicilan 1    Rp1.000.000
Cicilan 2    Rp1.000.000
Cicilan 3      Rp500.000
```

Preview harus menggunakan logic yang sama dengan server.

Server tetap melakukan perhitungan final.

---

# 52. Receipt

Setelah payment berhasil, sistem menampilkan receipt.

Minimal:

```text
BUKTI PEMBAYARAN

Nomor:
PAY-2026-000001

Customer:
Nama Customer

Tanggal:
15 September 2026

Pembayaran:
Rp2.500.000

Dialokasikan ke:

Cicilan 1:
Rp1.000.000

Cicilan 2:
Rp1.000.000

Cicilan 3:
Rp500.000

Sisa kredit:
Rp...
```

MVP:

```text
Printable browser page
```

PDF dapat ditambahkan setelah MVP.

---

# 53. Dashboard

Dashboard menampilkan:

```text
Total customer

Kredit aktif

Kredit lunas

Total outstanding

Pembayaran bulan ini

Profit bulan ini

Cicilan jatuh tempo

Cicilan overdue
```

Dashboard tidak boleh menghitung data finansial hanya dari frontend.

---

# 54. Overdue

Overdue dihitung berdasarkan:

```text
today > dueDate
AND paidAmount < amount
```

Tidak perlu cron job untuk menentukan status.

Contoh query:

```text
dueDate < today
paidAmount < amount
```

---

# 55. Search

Search customer berdasarkan:

```text
nama
NIK
nomor telepon
```

Search credit berdasarkan:

```text
nomor kontrak
nama customer
NIK
```

Search payment berdasarkan:

```text
nomor pembayaran
nama customer
```

---

# 56. WhatsApp Reminder

MVP tidak menggunakan WhatsApp API.

Sistem hanya menyediakan tombol:

```text
Kirim Pengingat WhatsApp
```

Tombol membuka WhatsApp dengan pesan yang telah dibuat.

Contoh pesan:

```text
Halo Bapak/Ibu [Nama].

Kami ingin mengingatkan bahwa cicilan sebesar
Rp1.000.000 akan jatuh tempo pada 15 Oktober 2026.

Terima kasih.
```

Nomor telepon harus di-normalisasi ke format yang sesuai.

---

# 57. Reports

MVP minimal:

## Profit Report

Filter:

```text
tanggal mulai
tanggal akhir
```

Menampilkan:

```text
Total harga beli
Total harga kredit
Total profit
```

## Payment Report

Menampilkan:

```text
Total pembayaran
Jumlah transaksi pembayaran
```

## Overdue Report

Menampilkan:

```text
Customer
Credit
Installment
Due date
Outstanding
```

---

# 58. Financial Calculation Rules

Semua calculation harus berada dalam service.

Contoh:

```text
credit.service.ts
payment.service.ts
installment.service.ts
```

Jangan menaruh business logic finansial kompleks langsung di:

```text
+page.svelte
```

---

# 59. Recommended Service Functions

## Credit

```typescript
createCredit()
calculateCreditPrice()
calculateProfit()
calculateFinancedAmount()
generateInstallmentSchedule()
deleteCredit()
getCreditDetail()
```

## Payment

```typescript
createPayment()
allocatePayment()
calculateOutstanding()
calculatePaymentPreview()
getPaymentHistory()
```

## Customer

```typescript
createCustomer()
updateCustomer()
getCustomer()
searchCustomers()
```

## Supplier

```typescript
createSupplier()
updateSupplier()
getSupplier()
searchSuppliers()
```

---

# 60. Payment Allocation Pseudocode

```typescript
function allocatePayment(
  paymentAmount,
  installments
) {
  let remainingPayment = paymentAmount;

  const allocations = [];

  for (const installment of installments) {
    if (remainingPayment <= 0) {
      break;
    }

    const installmentRemaining =
      installment.amount - installment.paidAmount;

    if (installmentRemaining <= 0) {
      continue;
    }

    const allocatedAmount =
      Math.min(
        remainingPayment,
        installmentRemaining
      );

    allocations.push({
      installmentId: installment._id,
      amount: allocatedAmount
    });

    remainingPayment -= allocatedAmount;
  }

  if (remainingPayment > 0) {
    throw PAYMENT_EXCEEDS_OUTSTANDING;
  }

  return allocations;
}
```

Installments harus sudah diurutkan:

```text
sequence ASC
```

---

# 61. Installment Generation Pseudocode

```typescript
function generateInstallments(
  financedAmount,
  tenorMonths,
  startDate
) {
  const base =
    Math.floor(financedAmount / tenorMonths);

  const installments = [];

  let total = 0;

  for (let i = 1; i <= tenorMonths; i++) {
    let amount = base;

    if (i === tenorMonths) {
      amount = financedAmount - total;
    }

    installments.push({
      sequence: i,
      amount,
      dueDate: calculateDueDate(
        startDate,
        i
      ),
      paidAmount: 0
    });

    total += amount;
  }

  return installments;
}
```

Invariant:

```text
sum(installments.amount)
=== financedAmount
```

---

# 62. Financial Invariants

Invariants harus selalu benar.

## Credit

```text
creditPrice >= 0
purchasePrice >= 0
downPayment >= 0
downPayment <= creditPrice
financedAmount = creditPrice - downPayment
```

## Installments

```text
sum(installment.amount)
=== financedAmount
```

## Payments

```text
sum(payment allocations)
=== payment.amount
```

untuk payment installment.

## Installment

```text
0 <= paidAmount <= amount
```

## Profit

```text
profit =
creditPrice - purchasePrice
```

---

# 63. Atomicity

Operasi berikut wajib atomic:

```text
Create credit
Create payment
Delete credit
```

Khusus payment:

```text
payment creation
+
installment updates
+
credit update
+
audit log
```

harus dilakukan dalam satu MongoDB transaction.

---

# 64. Security

Wajib:

- authentication pada seluruh halaman private
- authorization di server
- validation menggunakan Zod
- password hashing
- secure cookies
- CSRF protection sesuai mekanisme SvelteKit
- rate limiting login
- file upload validation
- KTP tidak public
- database credentials hanya di server
- environment secrets tidak dikirim ke client

Jangan pernah mengirim:

```text
MONGODB_URI
passwordHash
storage credentials
```

ke browser.

---

# 65. Environment Variables

Contoh:

```env
MONGODB_URI=
MONGODB_DB_NAME=

SESSION_SECRET=

CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
```

Jangan commit `.env`.

Sediakan:

```text
.env.example
```

---

# 66. Testing

Testing wajib dibuat untuk business logic utama.

## Unit Test

Minimal:

```text
calculateCreditPrice()
calculateProfit()
calculateFinancedAmount()

generateInstallments()

calculateDueDate()

allocatePayment()
```

---

# 67. Test Cases Harga

Test:

```text
purchase = 10.000.000
=> credit = 14.000.000
```

Override:

```text
purchase = 10.000.000
credit = 13.500.000
=> profit = 3.500.000
```

---

# 68. Test Cases Installment

Test:

```text
10.000.000 / 3
```

Expected:

```text
3.333.333
3.333.333
3.333.334
```

Pastikan:

```text
total = 10.000.000
```

Test juga:

```text
12.000.000 / 12
```

Expected:

```text
1.000.000 × 12
```

---

# 69. Test Cases Partial Payment

Initial:

```text
Installment = 1.000.000
Paid = 0
```

Payment:

```text
400.000
```

Expected:

```text
Paid = 400.000
Remaining = 600.000
Status = PARTIAL
```

---

# 70. Test Cases Multiple Installments

Initial:

```text
I1 = 1.000.000
I2 = 1.000.000
I3 = 1.000.000
```

Payment:

```text
2.500.000
```

Expected:

```text
I1 = PAID
I2 = PAID
I3 = PARTIAL
I3 paid = 500.000
```

---

# 71. Test Cases Early Settlement

Initial:

```text
Outstanding = 5.500.000
```

Payment:

```text
5.500.000
```

Expected:

```text
All installments = PAID
Credit = PAID
```

---

# 72. Test Cases Overpayment

Initial:

```text
Outstanding = 2.000.000
```

Payment:

```text
2.500.000
```

Expected:

```text
ERROR PAYMENT_EXCEEDS_OUTSTANDING
```

Tidak ada data payment yang tersimpan.

---

# 73. Test Cases Date

Test:

```text
15 Jan
=> 15 Feb
=> 15 Mar
```

Test:

```text
31 Jan
=> last day of Feb
```

Test leap year:

```text
31 Jan 2028
=> 29 Feb 2028
```

---

# 74. E2E Test

Gunakan Playwright.

Minimal flow:

```text
Login
  ↓
Create customer
  ↓
Create supplier
  ↓
Create credit
  ↓
Verify installments
  ↓
Create payment
  ↓
Verify allocation
  ↓
Verify credit balance
  ↓
Print receipt
```

---

# 75. Seed Data

Development harus memiliki seed command.

Contoh:

```text
npm run db:seed
```

Seed minimal:

```text
1 admin
3 customers
2 suppliers
3 credit transactions
multiple installments
multiple payments
```

Data seed harus mencakup:

```text
active credit
paid credit
partial payment
overdue installment
multiple installment payment
```

---

# 76. AI Coding Rules

Coding agent harus mengikuti aturan berikut.

## Rule 1

Jangan membuat inventory system.

## Rule 2

Jangan menambahkan denda.

## Rule 3

Jangan membuat product management.

## Rule 4

Barang hanya snapshot di credit transaction.

## Rule 5

40% adalah default, bukan nilai fixed.

## Rule 6

Admin dapat override credit price.

## Rule 7

DP boleh 0.

## Rule 8

Installment dapat memiliki nilai berbeda.

## Rule 9

Payment dapat partial.

## Rule 10

Satu payment dapat membayar beberapa installment.

## Rule 11

Payment harus dialokasikan dari installment paling awal.

## Rule 12

Overpayment terhadap total outstanding ditolak.

## Rule 13

Early settlement tidak dikenakan penalty.

## Rule 14

Semua calculation finansial dilakukan server-side.

## Rule 15

Semua nominal disimpan sebagai integer Rupiah.

## Rule 16

Payment update harus atomic.

## Rule 17

Jangan mengubah schema tanpa memperbarui technical specification.

---

# 77. Development Workflow

Implementasi dilakukan bertahap.

## Phase 1 — Foundation

Implement:

```text
SvelteKit
TypeScript
Tailwind
MongoDB connection
Environment config
Authentication
Layout
```

Acceptance:

```text
Admin dapat login.
Private routes terlindungi.
MongoDB berhasil terhubung.
```

---

# 78. Phase 2 — Customer

Implement:

```text
Customer CRUD
NIK validation
KTP upload
Customer search
```

Acceptance:

```text
Admin dapat membuat customer.
NIK harus unique.
Foto KTP dapat diupload.
Customer dapat dicari.
```

---

# 79. Phase 3 — Supplier

Implement:

```text
Supplier CRUD
Supplier search
```

Acceptance:

```text
Admin dapat membuat supplier.
Supplier dapat dipilih ketika membuat credit.
```

---

# 80. Phase 4 — Credit

Implement:

```text
Create credit
40% default
Price override
DP
Profit
Installment generation
Credit detail
```

Acceptance:

```text
Credit dapat dibuat.
Installment otomatis dibuat.
Total installment == financed amount.
```

---

# 81. Phase 5 — Payment

Implement:

```text
Payment form
Partial payment
Multiple installment allocation
Early settlement
Payment history
Receipt
```

Acceptance:

```text
Payment selalu dialokasikan dengan benar.
Tidak ada overpayment.
Saldo kredit akurat.
```

---

# 82. Phase 6 — Dashboard & Reports

Implement:

```text
Dashboard
Outstanding
Overdue
Payment report
Profit report
```

---

# 83. Phase 7 — WhatsApp

Implement:

```text
WhatsApp reminder
```

Tidak perlu WhatsApp API pada MVP.

---

# 84. Phase 8 — Hardening

Implement:

```text
Unit tests
Integration tests
E2E tests
Security review
Validation review
Error handling
Database indexes
Performance review
Production configuration
```

---

# 85. Definition of Done

Feature dianggap selesai jika:

```text
[ ] UI selesai
[ ] Server logic selesai
[ ] Validation selesai
[ ] Error handling selesai
[ ] Database query selesai
[ ] Index sesuai
[ ] Unit test selesai
[ ] E2E test relevan selesai
[ ] Loading state selesai
[ ] Empty state selesai
[ ] Error state selesai
[ ] Mobile responsive
[ ] TypeScript tidak memiliki error
[ ] Lint tidak memiliki error
[ ] Build berhasil
```

---

# 86. Required Commands

Project harus menyediakan command:

```bash
npm run dev
npm run build
npm run preview
npm run check
npm run lint
npm run test
npm run test:e2e
npm run db:seed
```

---

# 87. Final Architecture

Target architecture:

```text
                 ┌──────────────────┐
                 │     Browser      │
                 └────────┬─────────┘
                          │
                          ▼
                 ┌──────────────────┐
                 │    SvelteKit     │
                 │                  │
                 │ Routes / UI      │
                 │ Server Actions   │
                 └────────┬─────────┘
                          │
                          ▼
                 ┌──────────────────┐
                 │ Business Layer   │
                 │                  │
                 │ Credit Service   │
                 │ Payment Service  │
                 │ Customer Service │
                 │ Supplier Service │
                 └────────┬─────────┘
                          │
                 ┌────────┴─────────┐
                 │                  │
                 ▼                  ▼
        ┌─────────────────┐  ┌─────────────────┐
        │    MongoDB      │  │ File Storage    │
        │                 │  │                 │
        │ Customers       │  │ KTP Photos      │
        │ Suppliers       │  │                 │
        │ Credits         │  │                 │
        │ Installments    │  │                 │
        │ Payments        │  │                 │
        │ Audit Logs      │  │                 │
        └─────────────────┘  └─────────────────┘
```

---

# 88. Final Data Relationship

```text
CUSTOMER
   │
   ├───────────────┐
   │               │
   ▼               ▼
CREDIT          PAYMENTS
   │               │
   │               │
   ▼               │
INSTALLMENTS ◄─────┘
   │
   │
   └── Payment Allocations


SUPPLIER
   │
   │
   ▼
CREDIT
```

---

# 89. Core Financial Flow

```text
Supplier
   │
   │ Purchase
   ▼
Purchase Price
   │
   │ + default 40%
   ▼
Credit Price
   │
   ├── Down Payment
   │
   ▼
Financed Amount
   │
   ▼
Installment Schedule
   │
   ▼
Customer Payments
   │
   ▼
Payment Allocation
   │
   ├── Installment 1
   ├── Installment 2
   ├── Installment 3
   └── ...
   │
   ▼
Outstanding Balance
   │
   ▼
PAID
```

---

# 90. MVP Boundary

MVP harus fokus pada:

```text
Authentication
Customer
KTP
Supplier
Credit
DP
40% default markup
Price override
Installment
Partial payment
Multiple installment payment
Early settlement
Payment receipt
Dashboard
Search
Overdue
Profit report
Audit log
```

Jangan implementasikan terlebih dahulu:

```text
Inventory
Product catalog
Stock management
Denda
WhatsApp API
Multi-user
Multi-company
Accounting integration
Online payment gateway
Complex analytics
Mobile app
```

Fitur tersebut dapat ditambahkan setelah core credit system stabil.

---

# 91. Prinsip Implementasi Terpenting

Sistem harus mengutamakan **akurasi transaksi finansial** dibandingkan kompleksitas UI.

Prioritas:

```text
1. Correctness
2. Data integrity
3. Security
4. Testability
5. Performance
6. UI polish
```

Jika terdapat konflik antara UI dan business logic, business logic server adalah sumber kebenaran.

Jika terdapat konflik antara data browser dan database, database adalah sumber kebenaran.

Jika terdapat konflik antara hasil perhitungan frontend dan backend, backend adalah sumber kebenaran.

---

# 92. Status Dokumen

Dokumen ini merupakan technical baseline untuk memulai implementasi.

Sebelum coding dimulai, perubahan business rule harus terlebih dahulu dicatat pada:

```text
PRD.md
```

kemudian perubahan teknis dicatat pada:

```text
TECHNICAL_SPEC.md
```

AI coding agent tidak boleh mengasumsikan business rule baru tanpa persetujuan.

## Catatan implementasi — 15 September 2026

- Keputusan pemilik pada PRD: edit nominal/jadwal hanya sebelum payment non-DP; harga kredit tidak boleh di bawah harga beli.
- Edit memeriksa payment dalam transaksi MongoDB, menulis ulang jadwal, menghitung ulang profit, dan mencatat audit. DP yang sudah tercatat tidak diubah.
- `revision` internal pada customer, supplier, dan credit digunakan untuk memaksa konflik write saat operasi konkuren menyentuh induk yang sama.
- Session disimpan sebagai hash token acak dalam collection internal `sessions`, kedaluwarsa delapan jam dan dapat dicabut saat logout. Collection `login_attempts` membatasi sepuluh percobaan per alamat dalam 15 menit. Keduanya menggunakan indeks TTL.
- `_id` payment digunakan sebagai idempotency key yang dibuat server untuk formulir. Pengiriman ulang dengan key dan input identik mengembalikan payment yang sama; input berbeda ditolak.
- Snapshot bukti pembayaran menyimpan harga kredit, total dibayar, dan sisa saat pencatatan, sehingga edit kredit sebelum cicilan tidak mengubah bukti DP lama.
- Cloudinary merupakan implementasi `FileStorageService`, menggunakan aset `authenticated`. Validasi JPG/PNG/WebP memeriksa signature, MIME, ekstensi, dan ukuran maksimal 5 MB.
- Pengujian tanpa database: `npm run test:unit`. Pengujian MongoDB dan E2E disediakan terpisah, ditunda sesuai permintaan pemilik sampai penyiapan database.
