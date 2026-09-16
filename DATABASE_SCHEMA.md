# DATABASE_SCHEMA.md

> Perubahan kebutuhan supplier (16 September 2026): modul/master supplier dihapus. Supplier adalah teks opsional `supplierName` (maksimal 500 karakter) yang diisi langsung saat membuat atau mengedit kredit, tanpa pilihan atau validasi ke collection supplier. Kredit baru tidak menyimpan `supplierId`. Pembacaan relasi lama hanya untuk kompatibilitas; menyimpan edit kredit lama menggantinya dengan teks. Ketentuan ini menggantikan bagian CRUD, relasi, indeks, dan kewajiban supplier pada dokumen ini.

## MongoDB Database Schema
### Sistem Manajemen Kredit / Cicilan

**Version:** 1.0  
**Database:** MongoDB  
**ODM/Driver:** MongoDB Node.js Driver  
**Language:** TypeScript

---

# 1. Database Overview

Database terdiri dari collection berikut:

```text
users
customers
suppliers
credit_contracts
installments
payments
audit_logs
```

Relationship utama:

```text
customers
    │
    └── credit_contracts
            │
            ├── installments
            │
            └── payments
                    │
                    └── allocations → installments

suppliers
    │
    └── credit_contracts

users
    │
    └── audit_logs
```

Tidak ada:

```text
products
inventory
stock
stock_movements
```

Karena bisnis tidak menyimpan stok.

---

# 2. MongoDB Naming Convention

Nama collection menggunakan `snake_case`:

```text
credit_contracts
audit_logs
```

Nama field menggunakan `camelCase`:

```typescript
customerId
purchasePrice
creditPrice
downPayment
createdAt
```

MongoDB `_id` menggunakan `ObjectId`.

---

# 3. Common Fields

Entity yang dapat berubah menggunakan:

```typescript
createdAt: Date
updatedAt: Date
```

Contoh:

```json
{
  "createdAt": ISODate("2026-09-15T10:00:00.000Z"),
  "updatedAt": ISODate("2026-09-15T10:00:00.000Z")
}
```

`payments` bersifat immutable secara default sehingga hanya memiliki `createdAt`.

---

# 4. Money Representation

Semua nominal uang disimpan sebagai integer Rupiah.

Contoh:

```json
{
  "purchasePrice": 10000000,
  "creditPrice": 14000000
}
```

Artinya:

```text
Rp10.000.000
Rp14.000.000
```

Jangan menyimpan:

```json
{
  "price": "Rp14.000.000"
}
```

atau:

```json
{
  "price": 14000000.50
}
```

Formatting hanya dilakukan pada UI.

---

# 5. Collection: users

Collection:

```text
users
```

Digunakan untuk authentication admin.

## Schema

```typescript
interface UserDocument {
  _id: ObjectId;

  username: string;

  passwordHash: string;

  name: string;

  role: "ADMIN";

  createdAt: Date;

  updatedAt: Date;
}
```

## Example

```json
{
  "_id": ObjectId("68c7f0000000000000000001"),
  "username": "admin",
  "passwordHash": "$argon2id$...",
  "name": "Administrator",
  "role": "ADMIN",
  "createdAt": ISODate("2026-09-15T10:00:00.000Z"),
  "updatedAt": ISODate("2026-09-15T10:00:00.000Z")
}
```

## Constraints

```text
username:
    required
    unique
    normalized

passwordHash:
    required

name:
    required

role:
    must be ADMIN
```

Password plaintext tidak boleh disimpan.

---

# 6. users Indexes

```javascript
db.users.createIndex(
  { username: 1 },
  { unique: true }
);
```

---

# 7. Collection: customers

Collection:

```text
customers
```

Menyimpan data customer.

## Schema

```typescript
interface CustomerDocument {
  _id: ObjectId;

  nik: string;

  name: string;

  dateOfBirth?: Date;

  phone: string;

  address: string;

  ktpPhoto?: KtpPhoto;

  createdAt: Date;

  updatedAt: Date;
}

interface KtpPhoto {
  storageKey: string;

  originalName: string;

  mimeType: string;

  size: number;

  uploadedAt: Date;
}
```

---

# 8. Customer KTP Data

Field minimum:

```text
nik
name
dateOfBirth
phone
address
ktpPhoto
```

Tidak perlu menyimpan semua informasi yang terdapat pada KTP jika tidak dibutuhkan oleh sistem.

Tujuannya adalah meminimalkan penyimpanan data pribadi.

---

# 9. NIK

`nik` wajib 16 digit.

Contoh:

```json
{
  "nik": "317xxxxxxxxxxxxx"
}
```

Validation:

```regex
^[0-9]{16}$
```

NIK harus unique.

---

# 10. Customer Example

```json
{
  "_id": ObjectId("68c7f0000000000000000010"),

  "nik": "317xxxxxxxxxxxxx",

  "name": "Budi Santoso",

  "dateOfBirth": ISODate("1995-04-10T00:00:00.000Z"),

  "phone": "081234567890",

  "address": "Jakarta",

  "ktpPhoto": {
    "storageKey": "ktp/68c7f0000000000000000010/main.webp",
    "originalName": "ktp-budi.jpg",
    "mimeType": "image/jpeg",
    "size": 245678,
    "uploadedAt": ISODate("2026-09-15T10:10:00.000Z")
  },

  "createdAt": ISODate("2026-09-15T10:10:00.000Z"),

  "updatedAt": ISODate("2026-09-15T10:10:00.000Z")
}
```

---

# 11. Customer Indexes

Unique NIK:

```javascript
db.customers.createIndex(
  { nik: 1 },
  { unique: true }
);
```

Phone:

```javascript
db.customers.createIndex(
  { phone: 1 }
);
```

Name:

```javascript
db.customers.createIndex(
  { name: 1 }
);
```

Untuk pencarian skala besar, dapat menggunakan MongoDB Atlas Search di masa depan.

---

# 12. Collection: suppliers

Collection:

```text
suppliers
```

Supplier adalah tempat pembelian barang.

Supplier bukan inventory.

## Schema

```typescript
interface SupplierDocument {
  _id: ObjectId;

  name: string;

  phone?: string;

  address?: string;

  notes?: string;

  createdAt: Date;

  updatedAt: Date;
}
```

---

# 13. Supplier Example

```json
{
  "_id": ObjectId("68c7f0000000000000000020"),

  "name": "PT Supplier Elektronik",

  "phone": "081234567890",

  "address": "Jakarta",

  "notes": "Supplier elektronik",

  "createdAt": ISODate("2026-09-15T10:15:00.000Z"),

  "updatedAt": ISODate("2026-09-15T10:15:00.000Z")
}
```

---

# 14. Supplier Indexes

```javascript
db.suppliers.createIndex(
  { name: 1 }
);
```

Optional:

```javascript
db.suppliers.createIndex(
  { phone: 1 }
);
```

---

# 15. Collection: credit_contracts

Collection paling penting dalam sistem.

```text
credit_contracts
```

Satu document merepresentasikan satu transaksi kredit.

---

# 16. Credit Contract Schema

```typescript
interface CreditContractDocument {
  _id: ObjectId;

  contractNumber: string;

  customerId: ObjectId;

  supplierId: ObjectId;

  item: CreditItemSnapshot;

  purchasePrice: number;

  creditPrice: number;

  markupPercent: number;

  profit: number;

  downPayment: number;

  financedAmount: number;

  tenorMonths: number;

  startDate: Date;

  dueDay: number;

  status: "ACTIVE" | "PAID";

  createdAt: Date;

  updatedAt: Date;
}

interface CreditItemSnapshot {
  name: string;

  brand?: string;

  model?: string;

  serialNumber?: string;

  notes?: string;
}
```

---

# 17. Credit Item Snapshot

Barang disimpan langsung dalam credit document.

Contoh:

```json
{
  "item": {
    "name": "iPhone 15 Pro",
    "brand": "Apple",
    "model": "15 Pro",
    "serialNumber": "ABC123",
    "notes": "Natural Titanium"
  }
}
```

Tidak menggunakan:

```json
{
  "productId": "..."
}
```

Karena tidak ada product catalog.

---

# 18. Why Item Is a Snapshot

Misalnya transaksi dibuat:

```text
15 September 2026
```

Barang:

```text
iPhone 15 Pro
```

Beberapa tahun kemudian supplier dapat berubah nama.

Data transaksi lama harus tetap menunjukkan kondisi ketika transaksi dibuat.

Karena itu credit menyimpan:

```text
item snapshot
supplierId
```

Jika diperlukan historical accuracy lebih kuat, informasi supplier juga dapat disimpan sebagai snapshot.

Untuk MVP, `supplierId` sudah cukup selama supplier tidak di-hard-delete.

---

# 19. Credit Financial Fields

### purchasePrice

Harga yang dibayar kepada supplier.

### creditPrice

Harga jual kredit kepada customer.

### markupPercent

Markup aktual berdasarkan harga jual kredit.

### profit

```text
creditPrice - purchasePrice
```

### downPayment

DP customer.

### financedAmount

```text
creditPrice - downPayment
```

---

# 20. Credit Financial Example

```json
{
  "purchasePrice": 10000000,

  "creditPrice": 14000000,

  "markupPercent": 40,

  "profit": 4000000,

  "downPayment": 2000000,

  "financedAmount": 12000000
}
```

Invariant:

```text
creditPrice - purchasePrice = profit

creditPrice - downPayment = financedAmount
```

---

# 21. Credit Price Override

`markupPercent` bukan sumber kebenaran harga.

Source of truth:

```text
purchasePrice
creditPrice
```

Jika default:

```text
purchasePrice = 10.000.000
creditPrice = 14.000.000
markupPercent = 40
```

Jika override:

```text
purchasePrice = 10.000.000
creditPrice = 13.500.000
markupPercent = 35
```

Profit:

```text
3.500.000
```

---

# 22. Credit Status

Status:

```text
ACTIVE
PAID
```

Tidak perlu:

```text
OVERDUE
DEFAULT
LATE
```

Overdue adalah status installment, bukan status contract.

---

# 23. Credit Example

```json
{
  "_id": ObjectId("68c7f0000000000000000030"),

  "contractNumber": "CR-2026-000001",

  "customerId": ObjectId("68c7f0000000000000000010"),

  "supplierId": ObjectId("68c7f0000000000000000020"),

  "item": {
    "name": "iPhone 15 Pro",
    "brand": "Apple",
    "model": "15 Pro",
    "serialNumber": "ABC123"
  },

  "purchasePrice": 10000000,

  "creditPrice": 14000000,

  "markupPercent": 40,

  "profit": 4000000,

  "downPayment": 2000000,

  "financedAmount": 12000000,

  "tenorMonths": 12,

  "startDate": ISODate("2026-09-15T00:00:00.000Z"),

  "dueDay": 15,

  "status": "ACTIVE",

  "createdAt": ISODate("2026-09-15T10:20:00.000Z"),

  "updatedAt": ISODate("2026-09-15T10:20:00.000Z")
}
```

---

# 24. Credit Indexes

Contract number:

```javascript
db.credit_contracts.createIndex(
  { contractNumber: 1 },
  { unique: true }
);
```

Customer:

```javascript
db.credit_contracts.createIndex(
  { customerId: 1 }
);
```

Supplier:

```javascript
db.credit_contracts.createIndex(
  { supplierId: 1 }
);
```

Status:

```javascript
db.credit_contracts.createIndex(
  { status: 1 }
);
```

Customer + status:

```javascript
db.credit_contracts.createIndex(
  {
    customerId: 1,
    status: 1
  }
);
```

Start date:

```javascript
db.credit_contracts.createIndex(
  { startDate: -1 }
);
```

---

# 25. Collection: installments

Collection:

```text
installments
```

Setiap credit memiliki beberapa installment.

---

# 26. Installment Schema

```typescript
interface InstallmentDocument {
  _id: ObjectId;

  creditId: ObjectId;

  sequence: number;

  dueDate: Date;

  amount: number;

  paidAmount: number;

  createdAt: Date;

  updatedAt: Date;
}
```

---

# 27. Installment Example

```json
{
  "_id": ObjectId("68c7f0000000000000000040"),

  "creditId": ObjectId("68c7f0000000000000000030"),

  "sequence": 1,

  "dueDate": ISODate("2026-10-15T00:00:00.000Z"),

  "amount": 1000000,

  "paidAmount": 400000,

  "createdAt": ISODate("2026-09-15T10:20:00.000Z"),

  "updatedAt": ISODate("2026-09-20T10:20:00.000Z")
}
```

---

# 28. Installment Remaining

`remainingAmount` tidak wajib disimpan.

Hitung:

```text
remainingAmount =
amount - paidAmount
```

Contoh:

```text
amount = 1.000.000
paidAmount = 400.000

remainingAmount = 600.000
```

Dengan demikian source of truth tetap:

```text
amount
paidAmount
```

---

# 29. Installment Status

Status tidak perlu disimpan sebagai permanent field.

Hitung dari:

```text
amount
paidAmount
dueDate
currentDate
```

Algorithm:

```typescript
if (paidAmount >= amount) {
  return "PAID";
}

if (paidAmount > 0) {
  return "PARTIAL";
}

if (today > dueDate) {
  return "OVERDUE";
}

if (today >= dueDate) {
  return "DUE";
}

return "UPCOMING";
```

---

# 30. Installment Indexes

Credit:

```javascript
db.installments.createIndex(
  { creditId: 1 }
);
```

Credit + sequence:

```javascript
db.installments.createIndex(
  {
    creditId: 1,
    sequence: 1
  },
  { unique: true }
);
```

Credit + due date:

```javascript
db.installments.createIndex(
  {
    creditId: 1,
    dueDate: 1
  }
);
```

Overdue query:

```javascript
db.installments.createIndex(
  {
    dueDate: 1,
    paidAmount: 1
  }
);
```

---

# 31. Collection: payments

Collection:

```text
payments
```

Setiap document merepresentasikan satu penerimaan uang dari customer.

---

# 32. Payment Schema

```typescript
interface PaymentDocument {
  _id: ObjectId;

  paymentNumber: string;

  creditId: ObjectId;

  customerId: ObjectId;

  amount: number;

  paymentDate: Date;

  method: PaymentMethod;

  type: PaymentType;

  allocations: PaymentAllocation[];

  notes?: string;

  createdAt: Date;
}

type PaymentMethod =
  | "CASH"
  | "TRANSFER"
  | "OTHER";

type PaymentType =
  | "DOWN_PAYMENT"
  | "INSTALLMENT"
  | "EARLY_SETTLEMENT";

interface PaymentAllocation {
  installmentId: ObjectId;

  amount: number;
}
```

---

# 33. Payment Example — DP

DP tidak dialokasikan ke installment.

```json
{
  "_id": ObjectId("68c7f0000000000000000050"),

  "paymentNumber": "PAY-2026-000001",

  "creditId": ObjectId("68c7f0000000000000000030"),

  "customerId": ObjectId("68c7f0000000000000000010"),

  "amount": 2000000,

  "paymentDate": ISODate("2026-09-15T00:00:00.000Z"),

  "method": "TRANSFER",

  "type": "DOWN_PAYMENT",

  "allocations": [],

  "createdAt": ISODate("2026-09-15T10:21:00.000Z")
}
```

---

# 34. Payment Example — Single Installment

Customer membayar:

```text
Rp1.000.000
```

Allocation:

```json
{
  "allocations": [
    {
      "installmentId": ObjectId("68c7f0000000000000000040"),
      "amount": 1000000
    }
  ]
}
```

---

# 35. Payment Example — Partial

Customer membayar:

```text
Rp400.000
```

Allocation:

```json
{
  "allocations": [
    {
      "installmentId": ObjectId("68c7f0000000000000000040"),
      "amount": 400000
    }
  ]
}
```

Installment menjadi:

```json
{
  "amount": 1000000,
  "paidAmount": 400000
}
```

Status:

```text
PARTIAL
```

---

# 36. Payment Example — Multiple Installments

Customer membayar:

```text
Rp2.500.000
```

Outstanding:

```text
Installment 1 = 1.000.000
Installment 2 = 1.000.000
Installment 3 = 1.000.000
```

Payment:

```json
{
  "amount": 2500000,

  "allocations": [
    {
      "installmentId": ObjectId("...001"),
      "amount": 1000000
    },
    {
      "installmentId": ObjectId("...002"),
      "amount": 1000000
    },
    {
      "installmentId": ObjectId("...003"),
      "amount": 500000
    }
  ]
}
```

---

# 37. Payment Allocation Invariants

Untuk payment type:

```text
INSTALLMENT
EARLY_SETTLEMENT
```

harus berlaku:

```text
sum(allocations.amount)
=== payment.amount
```

Untuk DP:

```text
allocations.length === 0
```

---

# 38. Installment Allocation Invariant

Setiap installment:

```text
0 <= paidAmount <= amount
```

Jika:

```text
paidAmount === amount
```

status:

```text
PAID
```

---

# 39. Payment Immutability

Setelah payment dibuat, payment sebaiknya immutable.

Jangan mengubah:

```text
amount
paymentDate
allocations
type
```

secara langsung.

Jika ada kesalahan input, gunakan mekanisme reversal/void di fitur masa depan.

Untuk MVP, payment deletion tidak disediakan dari UI.

---

# 40. Payment Indexes

Payment number:

```javascript
db.payments.createIndex(
  { paymentNumber: 1 },
  { unique: true }
);
```

Credit:

```javascript
db.payments.createIndex(
  { creditId: 1 }
);
```

Customer:

```javascript
db.payments.createIndex(
  { customerId: 1 }
);
```

Payment date:

```javascript
db.payments.createIndex(
  { paymentDate: -1 }
);
```

Credit + payment date:

```javascript
db.payments.createIndex(
  {
    creditId: 1,
    paymentDate: -1
  }
);
```

---

# 41. Collection: audit_logs

Collection:

```text
audit_logs
```

Digunakan untuk mencatat aktivitas penting.

---

# 42. Audit Log Schema

```typescript
interface AuditLogDocument {
  _id: ObjectId;

  actorId: ObjectId;

  action: string;

  entityType: AuditEntityType;

  entityId: ObjectId;

  metadata?: Record<string, unknown>;

  createdAt: Date;
}

type AuditEntityType =
  | "USER"
  | "CUSTOMER"
  | "SUPPLIER"
  | "CREDIT"
  | "INSTALLMENT"
  | "PAYMENT";
```

---

# 43. Audit Example

```json
{
  "_id": ObjectId("68c7f0000000000000000060"),

  "actorId": ObjectId("68c7f0000000000000000001"),

  "action": "PAYMENT_CREATED",

  "entityType": "PAYMENT",

  "entityId": ObjectId("68c7f0000000000000000051"),

  "metadata": {
    "amount": 2500000,
    "creditId": "68c7f0000000000000000030"
  },

  "createdAt": ISODate("2026-09-20T10:30:00.000Z")
}
```

Jangan menyimpan:

```text
password
passwordHash
KTP image
KTP storage credentials
```

ke metadata audit.

---

# 44. Audit Indexes

Entity:

```javascript
db.audit_logs.createIndex(
  {
    entityType: 1,
    entityId: 1
  }
);
```

Date:

```javascript
db.audit_logs.createIndex(
  {
    createdAt: -1
  }
);
```

Actor:

```javascript
db.audit_logs.createIndex(
  {
    actorId: 1,
    createdAt: -1
  }
);
```

---

# 45. Relationship: Customer → Credit

Relationship:

```text
customers._id
      │
      ▼
credit_contracts.customerId
```

One customer:

```text
1 → many credits
```

Contoh:

```text
Budi
 ├── CR-2026-000001
 ├── CR-2026-000015
 └── CR-2026-000021
```

---

# 46. Relationship: Supplier → Credit

```text
suppliers._id
      │
      ▼
credit_contracts.supplierId
```

One supplier dapat digunakan oleh banyak credit.

---

# 47. Relationship: Credit → Installments

```text
credit_contracts._id
      │
      ▼
installments.creditId
```

One credit:

```text
1 → many installments
```

---

# 48. Relationship: Credit → Payments

```text
credit_contracts._id
      │
      ▼
payments.creditId
```

One credit:

```text
1 → many payments
```

---

# 49. Relationship: Payment → Installments

Tidak menggunakan satu `installmentId` pada payment.

Sebagai gantinya:

```text
payments.allocations[]
```

Contoh:

```text
Payment
  │
  ├── Allocation → Installment 1
  ├── Allocation → Installment 2
  └── Allocation → Installment 3
```

Hal ini memungkinkan satu pembayaran membayar banyak cicilan.

---

# 50. Why Allocation Is Embedded

Untuk MVP, allocation disimpan sebagai embedded array dalam `payments`.

Contoh:

```json
{
  "paymentNumber": "PAY-2026-000010",

  "amount": 2500000,

  "allocations": [
    {
      "installmentId": ObjectId("...")
      ,
      "amount": 1000000
    },
    {
      "installmentId": ObjectId("...")
      ,
      "amount": 1000000
    },
    {
      "installmentId": ObjectId("...")
      ,
      "amount": 500000
    }
  ]
}
```

Keuntungannya:

- satu payment selalu menyimpan seluruh detail allocation
- receipt mudah dibuat
- payment history mudah ditampilkan
- tidak membutuhkan collection tambahan

---

# 51. Why Not Embed Installments in Credit

Installments menggunakan collection terpisah.

Tidak disimpan seperti:

```json
{
  "installments": [
    {}
  ]
}
```

di dalam credit.

Alasannya:

- jumlah installment dapat banyak
- payment harus meng-update installment tertentu
- query overdue lebih mudah
- indexing lebih fleksibel
- payment allocation lebih sederhana
- document credit tetap kecil

---

# 52. Credit Deletion

Ketika credit dihapus:

```text
credit_contracts
       │
       ├── installments
       │
       └── payments
```

harus dihapus bersama.

Pseudo-flow:

```text
START TRANSACTION

delete installments
where creditId = creditId

delete payments
where creditId = creditId

delete credit_contract

create audit log

COMMIT
```

Jika gagal:

```text
ROLLBACK
```

---

# 53. Customer Deletion

Hard delete customer tidak diperbolehkan jika memiliki credit.

Query:

```javascript
db.credit_contracts.countDocuments({
  customerId
});
```

Jika hasil:

```text
> 0
```

maka customer tidak dapat dihapus.

---

# 54. Supplier Deletion

Supplier yang sudah digunakan oleh credit tidak boleh di-hard-delete.

Untuk MVP:

```text
Supplier delete:
    disabled if referenced by credit
```

Fitur soft-delete dapat ditambahkan kemudian.

---

# 55. Referential Integrity

MongoDB tidak menyediakan foreign key enforcement seperti SQL.

Karena itu application layer harus memastikan:

```text
customerId exists
supplierId exists
creditId exists
installmentId exists
```

sebelum membuat relationship.

---

# 56. Credit Creation Transaction

Ketika membuat credit:

```text
START TRANSACTION

1. verify customer
2. verify supplier
3. calculate credit price
4. calculate profit
5. calculate financed amount
6. create credit
7. create installments
8. create DP payment if necessary
9. create audit log

COMMIT
```

---

# 57. Payment Creation Transaction

Ketika membuat payment:

```text
START TRANSACTION

1. load credit
2. verify ACTIVE
3. calculate outstanding
4. validate payment amount
5. load unpaid installments
6. calculate allocation
7. update installments
8. create payment
9. calculate new credit status
10. update credit
11. create audit log

COMMIT
```

---

# 58. Payment Allocation Query

Ambil installment:

```javascript
db.installments.find({
  creditId: creditId,
  $expr: {
    $lt: ["$paidAmount", "$amount"]
  }
})
.sort({
  sequence: 1
});
```

Kemudian allocation dilakukan dari sequence terkecil.

---

# 59. Outstanding Calculation

Outstanding credit:

```text
creditPrice - total payments
```

atau equivalently:

```text
financedAmount - installment payments
```

Untuk payment installment, source of truth dapat diverifikasi melalui installment allocations.

DP sudah mengurangi `financedAmount`.

---

# 60. Recommended Denormalized Fields

Untuk MVP, jangan menyimpan terlalu banyak calculated field.

Source of truth:

```text
creditPrice
purchasePrice
downPayment
financedAmount

installment.amount
installment.paidAmount

payment.amount
payment.allocations
```

`profit` boleh disimpan sebagai denormalized value karena merupakan nilai transaksi yang immutable.

---

# 61. Data Consistency Checks

Secara periodik atau melalui admin diagnostic tool dapat dilakukan:

### Credit

```text
financedAmount
===
sum(installment.amount)
```

### Installment

```text
paidAmount
===
sum(payment.allocations.amount)
```

### Payment

```text
payment.amount
===
sum(payment.allocations.amount)
```

kecuali:

```text
payment.type === DOWN_PAYMENT
```

---

# 62. Recommended MongoDB Validation

MongoDB JSON Schema validation dapat digunakan sebagai lapisan kedua.

Contoh konsep:

```javascript
db.createCollection("customers", {
  validator: {
    $jsonSchema: {
      bsonType: "object",

      required: [
        "nik",
        "name",
        "phone",
        "address",
        "createdAt",
        "updatedAt"
      ],

      properties: {
        nik: {
          bsonType: "string"
        },

        name: {
          bsonType: "string"
        },

        phone: {
          bsonType: "string"
        },

        address: {
          bsonType: "string"
        }
      }
    }
  }
});
```

Business validation tetap dilakukan di application layer.

---

# 63. Date Handling

Semua tanggal disimpan sebagai BSON Date.

Jangan menyimpan:

```json
{
  "dueDate": "15/10/2026"
}
```

Gunakan:

```json
{
  "dueDate": ISODate("2026-10-15T00:00:00.000Z")
}
```

Formatting dilakukan pada frontend.

---

# 64. Timezone

Business timezone:

```text
Asia/Jakarta
```

Aplikasi harus konsisten ketika menentukan:

- tanggal pembayaran
- tanggal mulai kredit
- tanggal jatuh tempo
- overdue status

Jangan mencampur timezone secara sembarangan.

Database tetap menyimpan absolute Date.

Business date calculation harus menggunakan timezone bisnis.

---

# 65. Contract Number Generation

Format:

```text
CR-YYYY-NNNNNN
```

Contoh:

```text
CR-2026-000001
CR-2026-000002
```

Nomor harus unique.

Generation harus aman terhadap concurrent requests.

Jangan hanya melakukan:

```text
countDocuments() + 1
```

karena dapat menghasilkan duplicate number ketika dua request berjalan bersamaan.

Gunakan atomic counter atau UUID-backed sequence mechanism.

---

# 66. Payment Number Generation

Format:

```text
PAY-YYYY-NNNNNN
```

Contoh:

```text
PAY-2026-000001
PAY-2026-000002
```

Sama seperti contract number, generation harus concurrency-safe.

---

# 67. Atomic Counter Collection

Jika menggunakan sequential numbering, dapat ditambahkan collection internal:

```text
counters
```

Walaupun bukan business collection utama.

Schema:

```typescript
interface CounterDocument {
  _id: string;

  sequence: number;
}
```

Contoh:

```json
{
  "_id": "credit:2026",
  "sequence": 15
}
```

dan:

```json
{
  "_id": "payment:2026",
  "sequence": 42
}
```

Gunakan:

```javascript
findOneAndUpdate(
  { _id: "credit:2026" },
  { $inc: { sequence: 1 } },
  {
    upsert: true,
    returnDocument: "after"
  }
);
```

---

# 68. Complete Database Map

```text
users
│
└── audit_logs.actorId


customers
│
├── credit_contracts.customerId
│
└── payments.customerId


suppliers
│
└── credit_contracts.supplierId


credit_contracts
│
├── installments.creditId
│
└── payments.creditId


payments
│
└── allocations[].installmentId
```

---

# 69. Example Complete Transaction

Customer:

```json
{
  "_id": ObjectId("CUSTOMER_1"),
  "nik": "317xxxxxxxxxxxxx",
  "name": "Budi Santoso",
  "phone": "081234567890",
  "address": "Jakarta"
}
```

Supplier:

```json
{
  "_id": ObjectId("SUPPLIER_1"),
  "name": "Supplier Elektronik"
}
```

Credit:

```json
{
  "_id": ObjectId("CREDIT_1"),

  "contractNumber": "CR-2026-000001",

  "customerId": ObjectId("CUSTOMER_1"),

  "supplierId": ObjectId("SUPPLIER_1"),

  "item": {
    "name": "Laptop ASUS",
    "brand": "ASUS",
    "model": "Vivobook"
  },

  "purchasePrice": 10000000,

  "creditPrice": 14000000,

  "markupPercent": 40,

  "profit": 4000000,

  "downPayment": 2000000,

  "financedAmount": 12000000,

  "tenorMonths": 12,

  "startDate": ISODate("2026-09-15T00:00:00.000Z"),

  "dueDay": 15,

  "status": "ACTIVE"
}
```

Installments:

```text
I1  = 1.000.000
I2  = 1.000.000
I3  = 1.000.000
...
I12 = 1.000.000
```

DP payment:

```text
PAY-2026-000001
Rp2.000.000
type = DOWN_PAYMENT
```

Customer kemudian membayar:

```text
PAY-2026-000002
Rp2.500.000
```

Allocation:

```text
I1 = Rp1.000.000
I2 = Rp1.000.000
I3 = Rp500.000
```

Result:

```text
I1 = PAID
I2 = PAID
I3 = PARTIAL
```

---

# 70. Collection Summary

| Collection | Purpose | Relationship |
|---|---|---|
| `users` | Admin authentication | 1 → many audit logs |
| `customers` | Customer data | 1 → many credits |
| `suppliers` | Supplier data | 1 → many credits |
| `credit_contracts` | Credit transaction | 1 → many installments/payments |
| `installments` | Payment schedule | belongs to credit |
| `payments` | Money received | belongs to credit |
| `audit_logs` | Activity history | belongs to user/entity |
| `counters` | Sequential numbering | internal |

---

# 71. Collections That Must Not Exist

AI coding agent **must not** create these collections unless the PRD is explicitly changed:

```text
products
product_variants
inventory
stock
stock_movements
warehouses
purchase_orders
sales_orders
late_fees
interest
```

Karena fitur tersebut berada di luar scope MVP.

---

# 72. Database Design Principles

## Principle 1 — Credit Is the Financial Contract

`credit_contracts` merupakan sumber informasi utama transaksi.

## Principle 2 — Installment Is the Schedule

`installments` menyimpan kewajiban pembayaran.

## Principle 3 — Payment Is the Money Event

`payments` menyimpan uang yang benar-benar diterima.

## Principle 4 — Allocation Connects Payment to Schedule

`payments.allocations` menjelaskan payment digunakan untuk cicilan mana.

## Principle 5 — Never Trust Client Calculations

Semua angka finansial harus dihitung ulang server-side.

## Principle 6 — Preserve Transaction Snapshot

Perubahan customer/supplier tidak boleh mengubah historical credit item.

## Principle 7 — Financial Updates Must Be Atomic

Payment dan installment update harus berada dalam MongoDB transaction.

---

# 73. Database Definition of Done

Database implementation dianggap selesai jika:

```text
[ ] Semua collections tersedia
[ ] Semua schema TypeScript tersedia
[ ] Semua required fields tervalidasi
[ ] NIK unique
[ ] Contract number unique
[ ] Payment number unique
[ ] Index tersedia
[ ] Credit → installment relationship bekerja
[ ] Credit → payment relationship bekerja
[ ] Payment → installment allocation bekerja
[ ] Partial payment bekerja
[ ] Multi-installment payment bekerja
[ ] Overpayment ditolak
[ ] Early settlement bekerja
[ ] Credit deletion cascade bekerja
[ ] MongoDB transaction digunakan untuk financial mutations
[ ] Seed data tersedia
[ ] Database tests tersedia
```

---

# 74. Final Source of Truth

Jika terjadi perbedaan nilai:

```text
UI
↓
Server
↓
MongoDB
```

MongoDB + server-side business logic menjadi sumber kebenaran.

Untuk payment:

```text
payments
+
installments
```

harus selalu konsisten.

Untuk credit:

```text
credit_contracts
+
installments
+
payments
```

harus selalu konsisten.

Tidak boleh ada situasi:

```text
Credit menunjukkan lunas
tetapi installment masih memiliki saldo.
```

atau:

```text
Payment Rp2.000.000
tetapi allocation hanya Rp1.500.000.
```

atau:

```text
Total installments
!=
Financed amount
```

Semua invariant tersebut harus dijaga oleh application layer dan MongoDB transactions.

---

# 75. Final Schema Structure

```text
DATABASE
│
├── users
│
├── customers
│
├── suppliers
│
├── credit_contracts
│   │
│   └── item snapshot
│
├── installments
│
├── payments
│   │
│   └── allocations[]
│
├── audit_logs
│
└── counters
```

This schema is the database baseline for implementation of the credit management MVP.

## Internal implementation fields — 15 September 2026

These fields support concurrency, security, and immutable receipts without adding business modules:

- `customers.revision`, `suppliers.revision`, `credit_contracts.revision`: optional integer, incremented to serialize related mutations.
- `payments.receiptSnapshot`: `{ creditPrice: number, totalPaid: number, outstanding: number }`, integer Rupiah captured atomically when the payment is created.
- Internal collection `sessions`: `{ tokenHash: string, userId: ObjectId, expiresAt: Date }`. Unique token hash and TTL on `expiresAt`.
- Internal collection `login_attempts`: `{ _id: string, count: number, expiresAt: Date }`. The key is an HMAC of the client address; TTL on `expiresAt`.
- A payment `_id` also serves as its unique submission key. Existing keys require identical input.
- Internal collection `storage_cleanup`: `{ _id: string, createdAt: Date, nextAttemptAt: Date, attempts: number }`. `_id` is the retired KTP storage key. Index on `nextAttemptAt`; no TTL. Customer deletion/replacement queues the retired file in the same transaction. Cloudinary deletion runs only after commit; failed jobs remain for retry. Active customer references prevent file deletion.
