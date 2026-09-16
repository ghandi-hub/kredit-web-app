# IMPLEMENTATION_PLAN.md

> Perubahan kebutuhan supplier (16 September 2026): modul/master supplier dihapus. Supplier adalah teks opsional `supplierName` (maksimal 500 karakter) yang diisi langsung saat membuat atau mengedit kredit, tanpa pilihan atau validasi ke collection supplier. Kredit baru tidak menyimpan `supplierId`. Pembacaan relasi lama hanya untuk kompatibilitas; menyimpan edit kredit lama menggantinya dengan teks. Ketentuan ini menggantikan bagian CRUD, relasi, indeks, dan kewajiban supplier pada dokumen ini.

## Implementation Plan
### Sistem Manajemen Kredit / Cicilan

**Version:** 1.0  
**Status:** Ready for Implementation  
**Stack:** SvelteKit + TypeScript + MongoDB

---

# 1. Tujuan

Dokumen ini menjadi panduan implementasi aplikasi berdasarkan:

```text
PRD.md
TECHNICAL_SPEC.md
DATABASE_SCHEMA.md
```

Tujuan utama dokumen ini adalah membuat AI coding agent dapat membangun aplikasi secara bertahap tanpa:

- melompat ke fitur yang belum waktunya
- membuat business logic yang berbeda dari PRD
- membuat schema database yang berbeda
- mencampur frontend dan financial logic
- mengimplementasikan fitur di luar scope MVP

---

# 2. Implementation Strategy

Aplikasi tidak boleh dibangun dengan satu prompt besar.

Implementasi harus dilakukan secara incremental:

```text
Phase 0
Project Foundation
      ↓
Phase 1
Database + Infrastructure
      ↓
Phase 2
Authentication
      ↓
Phase 3
Customer
      ↓
Phase 4
Supplier
      ↓
Phase 5
Credit
      ↓
Phase 6
Installment
      ↓
Phase 7
Payment
      ↓
Phase 8
Receipt
      ↓
Phase 9
Dashboard
      ↓
Phase 10
Reports
      ↓
Phase 11
WhatsApp Reminder
      ↓
Phase 12
Audit + Security
      ↓
Phase 13
Testing + Production
```

Setiap phase harus selesai dan lolos acceptance criteria sebelum lanjut.

---

# 3. Global AI Coding Rules

AI coding agent harus mengikuti aturan berikut.

## Rule 1 — Read Before Coding

Sebelum mengubah kode, agent harus membaca:

```text
PRD.md
TECHNICAL_SPEC.md
DATABASE_SCHEMA.md
IMPLEMENTATION_PLAN.md
```

---

## Rule 2 — Do Not Invent Business Rules

Jika requirement belum ditentukan:

```text
JANGAN membuat asumsi sendiri.
```

Agent harus:

1. berhenti pada bagian yang ambigu
2. menjelaskan ambiguity
3. meminta keputusan

---

## Rule 3 — Do Not Expand Scope

Jangan membuat:

```text
inventory
product catalog
stock
late fee
interest
multi-user
multi-company
accounting
payment gateway
WhatsApp API
```

kecuali diminta secara eksplisit.

---

## Rule 4 — Financial Logic Server-Side

Frontend hanya membantu UX.

Server adalah sumber kebenaran.

---

## Rule 5 — TypeScript Strict

Tidak diperbolehkan:

```typescript
any
```

kecuali benar-benar diperlukan dan diberi alasan.

---

## Rule 6 — Small Changes

Setiap task harus menghasilkan perubahan yang dapat diuji.

Jangan mengubah 20 bagian aplikasi sekaligus jika tidak diperlukan.

---

## Rule 7 — Test Critical Logic

Setiap financial logic harus memiliki unit test.

---

## Rule 8 — Verify After Changes

Setelah perubahan:

```bash
npm run check
npm run lint
npm run test
npm run build
```

harus dijalankan sesuai relevansi phase.

---

# 4. Phase 0 — Project Foundation

## Goal

Membuat project SvelteKit yang bersih dan siap dikembangkan.

---

## Task 0.1 — Initialize Project

Buat:

```text
SvelteKit
TypeScript
Tailwind CSS
```

Gunakan package manager yang konsisten.

Recommended:

```text
npm
```

---

## Task 0.2 — Configure TypeScript

Aktifkan strict mode.

Target:

```text
strict = true
```

---

## Task 0.3 — Install Dependencies

Minimal:

```text
mongodb
zod
argon2
```

Development:

```text
vitest
playwright
```

---

## Task 0.4 — Setup Environment

Buat:

```text
.env.example
```

Isi:

```env
MONGODB_URI=
MONGODB_DB_NAME=

SESSION_SECRET=

CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
```

`.env` tidak boleh masuk Git.

---

## Task 0.5 — Git Setup

Buat:

```text
.gitignore
README.md
```

Pastikan:

```text
.env
node_modules
build
.svelte-kit
```

tidak di-commit.

---

## Acceptance Criteria

```text
[ ] SvelteKit berjalan
[ ] TypeScript berjalan
[ ] Tailwind berjalan
[ ] Environment variables tersedia
[ ] Git repository bersih
[ ] npm run check berhasil
[ ] npm run build berhasil
```

---

# 5. Phase 1 — Database Infrastructure

## Goal

Membuat koneksi MongoDB yang aman dan reusable.

---

## Task 1.1 — MongoDB Client

Buat:

```text
src/lib/server/db/mongodb.ts
```

Responsibility:

```text
create MongoClient
reuse connection
export database instance
```

Jangan membuat connection baru pada setiap request jika tidak diperlukan.

---

## Task 1.2 — Database Collections

Buat module:

```text
src/lib/server/db/collections.ts
```

Contoh:

```typescript
export const collections = {
  users: db.collection<UserDocument>("users"),
  customers: db.collection<CustomerDocument>("customers"),
  suppliers: db.collection<SupplierDocument>("suppliers"),
  credits: db.collection<CreditContractDocument>("credit_contracts"),
  installments: db.collection<InstallmentDocument>("installments"),
  payments: db.collection<PaymentDocument>("payments"),
  auditLogs: db.collection<AuditLogDocument>("audit_logs"),
};
```

---

## Task 1.3 — Types

Buat:

```text
src/lib/types/
```

Minimal:

```text
user.ts
customer.ts
supplier.ts
credit.ts
installment.ts
payment.ts
audit.ts
```

Type harus mengikuti `DATABASE_SCHEMA.md`.

---

## Task 1.4 — Index Setup

Buat script:

```text
src/lib/server/db/indexes.ts
```

Atau:

```text
scripts/create-indexes.ts
```

Index minimal:

```text
users.username unique

customers.nik unique
customers.phone
customers.name

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

---

## Acceptance Criteria

```text
[ ] MongoDB dapat terhubung
[ ] Collections dapat diakses
[ ] TypeScript types tersedia
[ ] Index dapat dibuat
[ ] Unique NIK bekerja
[ ] Unique contract number bekerja
[ ] Unique payment number bekerja
```

---

# 6. Phase 2 — Authentication

## Goal

Admin dapat login dan semua halaman private terlindungi.

---

## Task 2.1 — User Repository

Buat:

```text
src/lib/server/auth/user.repository.ts
```

Functions:

```typescript
findUserByUsername()
createUser()
```

---

## Task 2.2 — Password Hashing

Gunakan Argon2id.

Functions:

```typescript
hashPassword()
verifyPassword()
```

---

## Task 2.3 — Session

Buat:

```text
src/lib/server/auth/session.ts
```

Functions:

```typescript
createSession()
getSession()
destroySession()
```

---

## Task 2.4 — Login Page

Route:

```text
/login
```

Form:

```text
username
password
```

---

## Task 2.5 — Auth Guard

Gunakan:

```text
hooks.server.ts
```

Private routes:

```text
/dashboard
/customers
/suppliers
/credits
/payments
/reports
```

---

## Task 2.6 — Seed Admin

Buat:

```text
npm run db:seed
```

Seed:

```text
admin
```

Password development harus berasal dari environment variable atau parameter seed, bukan hard-coded production credential.

---

## Acceptance Criteria

```text
[ ] Admin dapat login
[ ] Password tidak plaintext
[ ] Session cookie secure
[ ] User yang belum login diarahkan ke /login
[ ] User yang sudah login tidak perlu login ulang setiap halaman
[ ] Logout bekerja
```

---

# 7. Phase 3 — Application Layout

## Goal

Membuat layout utama aplikasi.

---

## Task 3.1 — Sidebar

Menu:

```text
Dashboard
Customers
Suppliers
Credits
Payments
Reports
```

---

## Task 3.2 — Header

Menampilkan:

```text
Application name
Admin name
Logout
```

---

## Task 3.3 — UI Components

Buat reusable:

```text
Button
Input
Select
Modal
Table
Badge
Card
Alert
EmptyState
LoadingState
ConfirmDialog
```

---

## Task 3.4 — Responsive Layout

Minimum:

```text
desktop
tablet
mobile
```

---

## Acceptance Criteria

```text
[ ] Semua private page menggunakan layout
[ ] Sidebar bekerja
[ ] Navigation bekerja
[ ] Logout tersedia
[ ] Responsive
```

---

# 8. Phase 4 — Customer Management

## Goal

Admin dapat membuat dan mengelola customer.

---

# Task 4.1 — Customer Repository

Buat:

```text
src/lib/server/customers/customer.repository.ts
```

Functions:

```typescript
createCustomer()
findCustomerById()
findCustomerByNik()
updateCustomer()
searchCustomers()
countCustomerCredits()
```

---

# Task 4.2 — Customer Validation

Buat:

```text
src/lib/schemas/customer.ts
```

Rules:

```text
NIK = 16 digits
name required
phone required
address required
```

---

# Task 4.3 — Customer Service

Buat:

```text
src/lib/server/customers/customer.service.ts
```

Business logic:

```text
createCustomer()
updateCustomer()
```

Service harus melakukan server-side validation.

---

# Task 4.4 — Customer List

Route:

```text
/customers
```

Tampilkan:

```text
Nama
NIK
Phone
Jumlah Kredit
Created At
Action
```

---

# Task 4.5 — Customer Create

Route:

```text
/customers/new
```

Form:

```text
NIK
Nama
Tanggal lahir
Nomor telepon
Alamat
Foto KTP
```

---

# Task 4.6 — Customer Detail

Route:

```text
/customers/[id]
```

Tampilkan:

```text
Data customer
KTP
Daftar credit
```

---

# Task 4.7 — Customer Edit

Route:

```text
/customers/[id]/edit
```

---

# Task 4.8 — KTP Storage

Implement:

```text
FileStorageService
```

Validasi:

```text
allowed MIME types
maximum file size
```

File tidak public.

---

## Acceptance Criteria

```text
[ ] Customer dapat dibuat
[ ] NIK harus 16 digit
[ ] NIK unique
[ ] Customer dapat diedit
[ ] Customer dapat dicari
[ ] KTP dapat diupload
[ ] KTP tidak public
[ ] Customer dengan credit tidak dapat dihapus
```

---

# 9. Phase 5 — Supplier Management

## Goal

Admin dapat mengelola supplier.

---

## Task 5.1 — Supplier Repository

```text
src/lib/server/suppliers/supplier.repository.ts
```

Functions:

```typescript
createSupplier()
findSupplierById()
updateSupplier()
searchSuppliers()
countSupplierCredits()
```

---

## Task 5.2 — Supplier Validation

```text
src/lib/schemas/supplier.ts
```

---

## Task 5.3 — Supplier UI

Routes:

```text
/suppliers
/suppliers/new
/suppliers/[id]
/suppliers/[id]/edit
```

---

## Acceptance Criteria

```text
[ ] Supplier dapat dibuat
[ ] Supplier dapat diedit
[ ] Supplier dapat dicari
[ ] Supplier yang sudah digunakan credit tidak dapat di-hard-delete
```

---

# 10. Phase 6 — Financial Utility Layer

## Goal

Membangun financial calculation sebelum credit UI.

Ini adalah salah satu phase paling penting.

---

## Task 6.1 — Money Utility

Buat:

```text
src/lib/utils/money.ts
```

Functions:

```typescript
calculateCreditPrice()
calculateProfit()
calculateFinancedAmount()
```

---

## Task 6.2 — Credit Price

Default:

```text
purchasePrice × 140 / 100
```

Hasil integer Rupiah.

---

## Task 6.3 — Profit

```text
creditPrice - purchasePrice
```

---

## Task 6.4 — Financed Amount

```text
creditPrice - downPayment
```

---

## Task 6.5 — Unit Tests

Test:

```text
10.000.000 → 14.000.000

10.000.000 → override 13.500.000

14.000.000 - 2.000.000
= 12.000.000
```

---

## Acceptance Criteria

```text
[ ] Semua financial utility mempunyai unit test
[ ] Tidak menggunakan floating point untuk menyimpan uang
[ ] Hasil selalu integer
[ ] Override harga bekerja
```

---

# 11. Phase 7 — Installment Engine

## Goal

Membuat engine jadwal cicilan yang benar sebelum menghubungkannya ke UI.

---

## Task 7.1 — Installment Generator

Buat:

```text
src/lib/server/credits/installment.service.ts
```

Function:

```typescript
generateInstallments()
```

---

## Task 7.2 — Rounding

Gunakan:

```text
first N-1 installments = floor(total / tenor)
last installment = remaining
```

---

## Task 7.3 — Due Date

Function:

```typescript
calculateDueDate()
```

Rules:

```text
first due date = one month after start date
```

Jika tanggal tidak tersedia:

```text
use last day of month
```

---

## Task 7.4 — Status Calculator

Function:

```typescript
getInstallmentStatus()
```

Possible result:

```text
UPCOMING
DUE
PARTIAL
PAID
OVERDUE
```

---

## Task 7.5 — Unit Tests

Test:

```text
10.000.000 / 3

31 January → February

Leap year

Partial payment status

Overdue status

Paid status
```

---

## Acceptance Criteria

```text
[ ] Total installments == financed amount
[ ] Rounding benar
[ ] Due date benar
[ ] Edge case tanggal bekerja
[ ] Status calculation mempunyai test
```

---

# 12. Phase 8 — Credit Management

## Goal

Admin dapat membuat transaksi kredit lengkap.

---

## Task 8.1 — Credit Repository

Buat:

```text
src/lib/server/credits/credit.repository.ts
```

Functions:

```typescript
createCredit()
findCreditById()
findCredits()
findCreditsByCustomer()
updateCreditStatus()
deleteCredit()
```

---

## Task 8.2 — Credit Schema

Buat:

```text
src/lib/schemas/credit.ts
```

Validation:

```text
customerId
supplierId
item
purchasePrice
creditPrice
downPayment
tenorMonths
startDate
dueDay
```

---

## Task 8.3 — Contract Number

Implement atomic counter.

Format:

```text
CR-YYYY-NNNNNN
```

---

## Task 8.4 — Credit Service

Buat:

```text
src/lib/server/credits/credit.service.ts
```

Function:

```typescript
createCredit()
```

Flow:

```text
validate customer
validate supplier
calculate price
calculate profit
calculate DP
calculate financed amount
generate contract number
create credit
generate installments
create DP payment if necessary
create audit log
```

---

## Task 8.5 — MongoDB Transaction

Credit creation harus atomic.

---

## Task 8.6 — Credit Form

Route:

```text
/credits/new
```

Form:

```text
Customer
Supplier

Barang
Brand
Model
Serial Number
Notes

Harga beli
Harga kredit
DP

Tenor
Tanggal mulai
Tanggal jatuh tempo
```

---

## Task 8.7 — Credit Detail

Route:

```text
/credits/[id]
```

Tampilkan:

```text
customer
supplier
item
purchase price
credit price
profit
DP
financed amount
tenor
status

installments
payments
```

---

## Task 8.8 — Credit List

Route:

```text
/credits
```

Filter:

```text
active
paid
customer
date
```

---

## Acceptance Criteria

```text
[ ] Credit dapat dibuat
[ ] Default price 40%
[ ] Price override bekerja
[ ] DP 0 bekerja
[ ] DP > 0 bekerja
[ ] Profit benar
[ ] Financed amount benar
[ ] Installment otomatis dibuat
[ ] Contract number unique
[ ] Credit creation atomic
```

---

# 13. Phase 9 — Payment Engine

## Goal

Membangun sistem pembayaran yang paling penting dalam aplikasi.

---

# Task 9.1 — Payment Repository

Buat:

```text
src/lib/server/payments/payment.repository.ts
```

Functions:

```typescript
createPayment()
findPaymentById()
findPaymentsByCredit()
findPayments()
```

---

# Task 9.2 — Outstanding Calculator

Function:

```typescript
calculateOutstanding()
```

Harus menghasilkan nilai yang konsisten dengan credit dan installments.

---

# Task 9.3 — Payment Allocation Engine

Buat:

```text
src/lib/server/payments/payment-allocation.ts
```

Function:

```typescript
allocatePayment()
```

Algorithm:

```text
1. Ambil installment unpaid/partial
2. Sort sequence ASC
3. Ambil installment pertama
4. Hitung remaining
5. Allocate payment
6. Jika payment masih tersisa:
   lanjut installment berikutnya
7. Jika payment masih tersisa setelah semua installment:
   reject
```

---

# Task 9.4 — Partial Payment

Harus mendukung:

```text
payment < installment remaining
```

---

# Task 9.5 — Multiple Installment Payment

Harus mendukung:

```text
payment > current installment remaining
```

---

# Task 9.6 — Early Settlement

Jika payment sama dengan outstanding:

```text
semua installment PAID
credit PAID
```

---

# Task 9.7 — Overpayment Protection

Jika:

```text
payment > outstanding
```

return:

```text
PAYMENT_EXCEEDS_OUTSTANDING
```

Tidak ada payment yang disimpan.

---

# Task 9.8 — Payment Number

Format:

```text
PAY-YYYY-NNNNNN
```

Atomic counter.

---

# Task 9.9 — Payment Transaction

MongoDB transaction:

```text
START

validate credit
calculate outstanding
allocate payment
update installments
create payment
update credit
create audit log

COMMIT
```

---

# Task 9.10 — Payment Form

Form:

```text
Credit
Customer

Tanggal
Nominal
Metode
Catatan
```

Tampilkan allocation preview.

---

# Task 9.11 — Payment History

Tampilkan:

```text
Payment Number
Date
Amount
Method
Type
```

---

## Acceptance Criteria

```text
[ ] Partial payment bekerja
[ ] Payment beberapa bulan bekerja
[ ] Allocation benar
[ ] Payment tidak dapat melebihi outstanding
[ ] Early settlement bekerja
[ ] Credit berubah PAID saat lunas
[ ] Semua installment berubah PAID
[ ] Payment transaction atomic
```

---

# 14. Phase 10 — Receipt

## Goal

Membuat bukti pembayaran.

---

## Task 10.1 — Receipt Data

Buat service:

```text
getPaymentReceipt()
```

Data:

```text
payment number
customer
credit
payment date
payment amount
payment method
allocation
remaining balance
```

---

## Task 10.2 — Receipt Page

Route:

```text
/payments/[id]
```

---

## Task 10.3 — Print

Tambahkan:

```text
Print
```

menggunakan browser print.

---

## Acceptance Criteria

```text
[ ] Receipt dapat dibuka
[ ] Nomor payment tampil
[ ] Customer tampil
[ ] Nominal benar
[ ] Allocation benar
[ ] Outstanding benar
[ ] Print bekerja
```

PDF bukan bagian wajib MVP awal.

---

# 15. Phase 11 — Dashboard

## Goal

Memberikan overview kondisi bisnis.

---

## Task 11.1 — Dashboard Service

Buat:

```text
src/lib/server/dashboard/dashboard.service.ts
```

Metrics:

```text
total customers
active credits
paid credits
total outstanding
payments this month
profit this month
due installments
overdue installments
```

---

## Task 11.2 — Dashboard UI

Route:

```text
/dashboard
```

---

## Task 11.3 — Overdue Widget

Tampilkan:

```text
customer
credit
due date
remaining
```

---

## Acceptance Criteria

```text
[ ] Dashboard menampilkan angka yang benar
[ ] Outstanding benar
[ ] Profit benar
[ ] Overdue benar
[ ] Data berasal dari server
```

---

# 16. Phase 12 — Search & Filtering

## Goal

Mempermudah pencarian data.

---

## Customer Search

```text
nama
NIK
phone
```

---

## Credit Search

```text
contract number
customer name
NIK
```

---

## Payment Search

```text
payment number
customer
```

---

## Filters

Credit:

```text
ACTIVE
PAID
OVERDUE
```

Payment:

```text
date range
payment method
```

---

## Acceptance Criteria

```text
[ ] Search customer bekerja
[ ] Search credit bekerja
[ ] Search payment bekerja
[ ] Filter bekerja
[ ] Query menggunakan index yang sesuai
```

---

# 17. Phase 13 — Reports

## Goal

Menyediakan laporan bisnis dasar.

---

# Task 13.1 — Profit Report

Route:

```text
/reports/profit
```

Filter:

```text
date from
date to
```

Output:

```text
total purchase price
total credit price
total profit
```

---

# Task 13.2 — Payment Report

Route:

```text
/reports/payments
```

Output:

```text
total payment
number of payments
```

---

# Task 13.3 — Overdue Report

Route:

```text
/reports/overdue
```

Output:

```text
customer
contract
installment
due date
outstanding
```

---

## Acceptance Criteria

```text
[ ] Profit report benar
[ ] Payment report benar
[ ] Overdue report benar
[ ] Date filtering bekerja
```

---

# 18. Phase 14 — WhatsApp Reminder

## Goal

Menyediakan reminder manual.

---

## Task 14.1 — Message Generator

Function:

```text
generatePaymentReminder()
```

---

## Task 14.2 — WhatsApp Link

Buat button:

```text
Kirim Pengingat WhatsApp
```

Tidak menggunakan WhatsApp API.

---

## Acceptance Criteria

```text
[ ] Pesan otomatis dibuat
[ ] Nama customer benar
[ ] Nominal benar
[ ] Due date benar
[ ] Link WhatsApp terbuka
```

---

# 19. Phase 15 — Audit Log

## Goal

Mencatat aktivitas penting.

---

## Actions

Minimal:

```text
CUSTOMER_CREATED
CUSTOMER_UPDATED

SUPPLIER_CREATED
SUPPLIER_UPDATED

CREDIT_CREATED
CREDIT_DELETED

PAYMENT_CREATED
```

---

## Task 15.1 — Audit Service

Buat:

```text
src/lib/server/audit/audit.service.ts
```

Function:

```typescript
createAuditLog()
```

---

## Task 15.2 — Integrate

Integrasikan ke:

```text
customer service
supplier service
credit service
payment service
```

---

## Acceptance Criteria

```text
[ ] Create customer tercatat
[ ] Update customer tercatat
[ ] Create credit tercatat
[ ] Delete credit tercatat
[ ] Create payment tercatat
```

---

# 20. Phase 16 — Credit Deletion

## Goal

Mengimplementasikan aturan deletion yang sudah ditentukan.

---

## Task 16.1 — Confirmation

User harus melakukan confirmation.

---

## Task 16.2 — Cascade Delete

Dalam satu transaction:

```text
delete installments
delete payments
delete credit
create audit log
```

---

## Task 16.3 — Verify

Setelah deletion:

```text
credit tidak ditemukan
installments tidak ditemukan
payments tidak ditemukan
```

---

## Acceptance Criteria

```text
[ ] Confirmation diperlukan
[ ] Cascade bekerja
[ ] Tidak ada orphan installment
[ ] Tidak ada orphan payment
[ ] Audit log tercatat
```

---

# 21. Phase 17 — Validation & Error UX

## Goal

Semua error dapat dipahami user.

---

# Task 17.1 — Error Codes

Gunakan error codes dari:

```text
TECHNICAL_SPEC.md
```

---

# Task 17.2 — User Messages

Contoh:

```text
PAYMENT_EXCEEDS_OUTSTANDING
```

ditampilkan:

```text
Pembayaran melebihi sisa tagihan.
```

---

# Task 17.3 — Form Validation

Semua form harus mempunyai:

```text
loading
success
error
validation
```

state.

---

## Acceptance Criteria

```text
[ ] Tidak ada raw server error ke user
[ ] Validation message jelas
[ ] Button memiliki loading state
[ ] Error state tersedia
[ ] Empty state tersedia
```

---

# 22. Phase 18 — Financial Integrity Testing

Ini adalah phase wajib sebelum production.

---

# Test 18.1 — Credit Price

```text
Purchase = 10.000.000
Default = 14.000.000
```

---

# Test 18.2 — Override

```text
Purchase = 10.000.000
Credit = 13.500.000
Profit = 3.500.000
```

---

# Test 18.3 — DP

```text
Credit = 14.000.000
DP = 2.000.000
Financed = 12.000.000
```

---

# Test 18.4 — Zero DP

```text
DP = 0
```

Harus valid.

---

# Test 18.5 — Installment Rounding

```text
10.000.000 / 3
```

Expected:

```text
3.333.333
3.333.333
3.333.334
```

---

# Test 18.6 — Partial Payment

```text
Installment = 1.000.000
Payment = 400.000
```

Expected:

```text
Paid = 400.000
Remaining = 600.000
PARTIAL
```

---

# Test 18.7 — Multiple Installments

```text
Payment = 2.500.000
```

Expected:

```text
I1 = PAID
I2 = PAID
I3 = PARTIAL
```

---

# Test 18.8 — Early Settlement

```text
Outstanding = 5.500.000
Payment = 5.500.000
```

Expected:

```text
Credit = PAID
```

---

# Test 18.9 — Overpayment

```text
Outstanding = 5.500.000
Payment = 5.500.001
```

Expected:

```text
Rejected
```

---

# Test 18.10 — Late Payment

Past due installment:

```text
amount = 1.000.000
paid = 0
```

Expected:

```text
OVERDUE
```

No denda.

---

# 23. Phase 19 — Integration Testing

Gunakan database test khusus.

Jangan menjalankan integration test terhadap production database.

---

## Scenario

```text
Create customer
    ↓
Create supplier
    ↓
Create credit
    ↓
Generate installments
    ↓
Create DP
    ↓
Create payment
    ↓
Verify allocation
    ↓
Verify outstanding
    ↓
Verify credit status
```

---

# 24. Phase 20 — E2E Testing

Gunakan Playwright.

---

## E2E 1 — Login

```text
Open login
Enter credentials
Submit
Dashboard appears
```

---

## E2E 2 — Create Customer

```text
Login
Customers
New Customer
Fill form
Upload KTP
Save
Verify customer
```

---

## E2E 3 — Create Supplier

```text
Suppliers
New Supplier
Fill form
Save
```

---

## E2E 4 — Create Credit

```text
Credits
New Credit
Select customer
Select supplier
Enter item
Enter purchase price
Verify default 40%
Enter DP
Select tenor
Save
Verify installments
```

---

## E2E 5 — Payment

```text
Open credit
Add payment
Enter amount
Verify allocation preview
Save
Verify installment
Verify receipt
```

---

## E2E 6 — Early Settlement

```text
Open active credit
Pay outstanding
Verify all installments PAID
Verify credit PAID
```

---

# 25. Phase 21 — Performance Review

## Database

Periksa:

```text
indexes
query count
unnecessary queries
N+1 queries
```

---

## UI

Periksa:

```text
large tables
loading state
pagination
image size
```

---

## KTP

Thumbnail/list tidak boleh selalu mengambil original image ukuran besar.

Gunakan thumbnail atau optimized image jika diperlukan.

---

# 26. Phase 22 — Security Review

Checklist:

```text
[ ] Authentication enforced
[ ] Authorization server-side
[ ] Password hashed
[ ] Secure cookies
[ ] Secrets not exposed
[ ] MongoDB URI server-only
[ ] KTP private
[ ] Upload validation
[ ] File size limit
[ ] Input validation
[ ] Payment validation
[ ] No client-side financial trust
[ ] No GET mutation
[ ] CSRF protection
[ ] Login rate limiting
```

---

# 27. Phase 23 — Production Preparation

## Environment

Production:

```text
MONGODB_URI
MONGODB_DB_NAME
SESSION_SECRET
CLOUDINARY_*
```

---

## Database

Pastikan:

```text
indexes created
backup configured
database user restricted
```

---

## Application

Run:

```bash
npm run check
npm run lint
npm run test
npm run build
```

Semua harus berhasil.

---

# 28. Recommended File Structure After MVP

Target:

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
│   │   ├── auth/
│   │   ├── db/
│   │   ├── customers/
│   │   ├── suppliers/
│   │   ├── credits/
│   │   ├── payments/
│   │   ├── dashboard/
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
│   ├── types/
│   │   ├── user.ts
│   │   ├── customer.ts
│   │   ├── supplier.ts
│   │   ├── credit.ts
│   │   ├── installment.ts
│   │   ├── payment.ts
│   │   └── audit.ts
│   │
│   └── utils/
│       ├── money.ts
│       ├── dates.ts
│       └── formatting.ts
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

# 29. AI Agent Prompt Strategy

Jangan memberikan seluruh `IMPLEMENTATION_PLAN.md` sebagai satu perintah coding besar.

Gunakan pendekatan:

```text
Read the project specification files.

Implement Phase X, Task Y only.

Before coding:
- inspect the existing project
- inspect relevant specification
- inspect existing implementation

Do not modify unrelated features.

After implementation:
- run relevant tests
- run typecheck
- run lint
- run build if appropriate

Report:
1. files changed
2. implementation summary
3. tests executed
4. test results
5. unresolved issues
```

---

# 30. Example Prompt — Phase 0

```text
Read:
- PRD.md
- TECHNICAL_SPEC.md
- DATABASE_SCHEMA.md
- IMPLEMENTATION_PLAN.md

Implement Phase 0 only.

Tasks:
1. Initialize SvelteKit project
2. Configure TypeScript strict mode
3. Configure Tailwind CSS
4. Install required dependencies
5. Create .env.example
6. Create .gitignore
7. Create basic README

Do not implement authentication, customer, supplier,
credit, payment, or dashboard features yet.

After implementation run:
- npm run check
- npm run lint
- npm run build

Report all files created or modified.
```

---

# 31. Example Prompt — Phase 6

```text
Read:
- PRD.md
- TECHNICAL_SPEC.md
- DATABASE_SCHEMA.md
- IMPLEMENTATION_PLAN.md

Implement Phase 6 only:
Financial Utility Layer.

Implement:
- calculateCreditPrice()
- calculateProfit()
- calculateFinancedAmount()

Rules:
- default credit price = purchase price + 40%
- price can be overridden by caller
- all money values are integer Rupiah
- no floating-point money storage
- profit = creditPrice - purchasePrice
- financedAmount = creditPrice - downPayment

Add unit tests for:
- default 40%
- price override
- profit
- DP = 0
- DP > 0

Do not implement UI or payment logic yet.

Run:
- npm run check
- npm run lint
- npm run test

Report files changed and test results.
```

---

# 32. Example Prompt — Payment Phase

```text
Read:
- PRD.md
- TECHNICAL_SPEC.md
- DATABASE_SCHEMA.md
- IMPLEMENTATION_PLAN.md

Implement the Payment Engine only.

Requirements:
1. Partial payment is supported.
2. One payment can allocate to multiple installments.
3. Allocation starts from the earliest unpaid/partial installment.
4. Payment greater than outstanding must be rejected.
5. Early settlement is supported.
6. Payment, installment updates, credit update,
   and audit log must be atomic using MongoDB transaction.
7. Payment records contain allocations[].
8. Do not create payment_balance or customer credit balance.
9. Do not add late fees.
10. Do not modify unrelated modules.

Add unit tests and integration tests for:
- partial payment
- multiple installment payment
- exact settlement
- overpayment
- already-paid installment
- mixed partial + full installments

Run:
- npm run check
- npm run lint
- npm run test
```

---

# 33. Git Commit Strategy

Recommended commit granularity:

```text
feat: initialize sveltekit project
feat: add mongodb infrastructure
feat: add authentication
feat: add customer management
feat: add ktp storage
feat: add supplier management
feat: add financial utilities
feat: add installment engine
feat: add credit management
feat: add payment allocation engine
feat: add payment UI
feat: add payment receipt
feat: add dashboard
feat: add reports
feat: add whatsapp reminder
test: add financial integration tests
security: harden authentication and file storage
```

Jangan membuat satu commit berisi seluruh aplikasi.

---

# 34. Phase Dependency Graph

```text
Phase 0
   │
   ▼
Phase 1
   │
   ▼
Phase 2
   │
   ▼
Phase 3
   │
   ├──────────────┐
   ▼              ▼
Phase 4        Phase 5
   │              │
   └──────┬───────┘
          ▼
       Phase 6
          │
          ▼
       Phase 7
          │
          ▼
       Phase 8
          │
          ▼
       Phase 9
          │
          ▼
      Phase 10
          │
          ├──────────► Phase 11
          │
          ├──────────► Phase 12
          │
          └──────────► Phase 13
                           │
                           ▼
                       Phase 14
                           │
                           ▼
                       Phase 15
                           │
                           ▼
                       Phase 16
                           │
                           ▼
                       Phase 17
                           │
                           ▼
                       Phase 18
                           │
                           ▼
                       Phase 19
                           │
                           ▼
                       Phase 20
                           │
                           ▼
                       Phase 21
                           │
                           ▼
                       Phase 22
                           │
                           ▼
                       Phase 23
```

---

# 35. MVP Completion Checklist

## Foundation

```text
[ ] SvelteKit
[ ] TypeScript
[ ] Tailwind
[ ] MongoDB
[ ] Environment configuration
```

## Authentication

```text
[ ] Login
[ ] Logout
[ ] Session
[ ] Auth guard
```

## Customer

```text
[ ] CRUD
[ ] NIK
[ ] KTP
[ ] Search
```

## Supplier

```text
[ ] CRUD
[ ] Search
```

## Credit

```text
[ ] Create credit
[ ] Item snapshot
[ ] Purchase price
[ ] 40% default
[ ] Price override
[ ] Profit
[ ] DP
[ ] Tenor
```

## Installment

```text
[ ] Automatic schedule
[ ] Rounding
[ ] Due date
[ ] Partial
[ ] Overdue
```

## Payment

```text
[ ] Payment
[ ] Partial payment
[ ] Multi-installment
[ ] Allocation
[ ] Early settlement
[ ] Overpayment protection
```

## Receipt

```text
[ ] Receipt
[ ] Print
```

## Dashboard

```text
[ ] Customer metrics
[ ] Credit metrics
[ ] Outstanding
[ ] Payment
[ ] Profit
[ ] Overdue
```

## Reports

```text
[ ] Profit
[ ] Payment
[ ] Overdue
```

## Communication

```text
[ ] WhatsApp reminder
```

## Security

```text
[ ] Authentication
[ ] Authorization
[ ] KTP protection
[ ] File validation
[ ] Input validation
```

## Testing

```text
[ ] Unit
[ ] Integration
[ ] E2E
```

---

# 36. Final Definition of Done

Aplikasi MVP dianggap selesai hanya jika:

```text
[ ] Semua P0 feature selesai
[ ] Database schema sesuai DATABASE_SCHEMA.md
[ ] Business logic sesuai TECHNICAL_SPEC.md
[ ] UI sesuai PRD
[ ] Financial tests passing
[ ] Integration tests passing
[ ] E2E critical flow passing
[ ] npm run check passing
[ ] npm run lint passing
[ ] npm run test passing
[ ] npm run build passing
[ ] Tidak ada TypeScript error
[ ] Tidak ada critical security issue
[ ] Tidak ada financial invariant violation
```

---

# 37. Most Important Financial Invariants

Sebelum production, sistem harus selalu memenuhi:

```text
financedAmount
=
creditPrice - downPayment
```

```text
sum(installment.amount)
=
financedAmount
```

```text
0 <= installment.paidAmount <= installment.amount
```

```text
sum(payment.allocations.amount)
=
payment.amount
```

untuk payment selain DP.

```text
profit
=
creditPrice - purchasePrice
```

Dan:

```text
paymentAmount
<=
outstandingBalance
```

Tidak boleh ada kondisi di mana invariant tersebut rusak.

---

# 38. Final Implementation Philosophy

Sistem ini bukan sekadar CRUD.

Bagian terpenting adalah:

```text
Credit
   ↓
Installments
   ↓
Payments
   ↓
Allocations
   ↓
Outstanding
```

Karena itu implementasi harus mengikuti urutan:

```text
Financial utility
       ↓
Installment engine
       ↓
Credit creation
       ↓
Payment allocation
       ↓
Dashboard/report
```

Jangan membuat dashboard terlebih dahulu dan kemudian mencoba menyesuaikan business logic.

Business logic harus benar terlebih dahulu, kemudian UI membaca hasilnya.

---

# 39. Final Project State

Target akhir:

```text
SvelteKit
│
├── Authentication
│
├── Customer Management
│   └── KTP
│
├── Supplier Management
│
├── Credit Management
│   ├── Item Snapshot
│   ├── Price Calculation
│   ├── DP
│   └── Installments
│
├── Payment Management
│   ├── Partial Payment
│   ├── Multi Installment
│   ├── Allocation
│   └── Early Settlement
│
├── Receipt
│
├── Dashboard
│
├── Reports
│
├── WhatsApp Reminder
│
└── Audit Log
        │
        ▼
     MongoDB
```

MVP tidak mencakup inventory, product catalog, stock, denda, bunga, atau payment gateway.