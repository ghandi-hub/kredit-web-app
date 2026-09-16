# PRD — Sistem Manajemen Kredit Barang

> Perubahan kebutuhan supplier (16 September 2026): modul/master supplier dihapus. Supplier adalah teks opsional `supplierName` (maksimal 500 karakter) yang diisi langsung saat membuat atau mengedit kredit, tanpa pilihan atau validasi ke collection supplier. Kredit baru tidak menyimpan `supplierId`. Pembacaan relasi lama hanya untuk kompatibilitas; menyimpan edit kredit lama menggantinya dengan teks. Ketentuan ini menggantikan bagian CRUD, relasi, indeks, dan kewajiban supplier pada dokumen ini.

**Versi:** 0.2  
**Status:** Draft  
**Platform:** Web Application  
**Frontend / Backend:** SvelteKit  
**Database:** MongoDB  
**Pengguna:** 1 Admin/Pemilik

---

# 1. Ringkasan

Aplikasi web untuk mengelola usaha kredit barang secara sederhana dan terstruktur.

Aplikasi digunakan untuk:

- Menyimpan data pelanggan
- Menyimpan data KTP pelanggan
- Mencatat barang yang dibeli berdasarkan permintaan pelanggan
- Mencatat supplier dan harga beli
- Menghitung harga kredit
- Membuat jadwal cicilan
- Mencatat pembayaran
- Mendukung pembayaran sebagian
- Mendukung pembayaran beberapa cicilan sekaligus
- Mengetahui pelanggan yang terlambat
- Mengetahui sisa piutang
- Menghitung keuntungan setiap transaksi
- Membuat bukti pembayaran
- Melihat laporan bisnis

Aplikasi **tidak memiliki sistem stok/inventory**.

Barang hanya dicatat sebagai bagian dari transaksi ketika pelanggan mengajukan pembelian.

---

# 2. Model Bisnis

Alur utama:

```text
Pelanggan
    ↓
Meminta barang
    ↓
Admin menentukan harga kredit
    ↓
Admin membeli barang dari supplier
    ↓
Transaksi kredit dibuat
    ↓
DP dibayar (jika ada)
    ↓
Jadwal cicilan dibuat
    ↓
Pelanggan membayar cicilan
    ↓
Pembayaran dicatat
    ↓
Sisa piutang diperbarui
    ↓
Kredit lunas
```

Tidak ada:

- Stok barang
- Denda keterlambatan
- Bunga keterlambatan
- Payment gateway
- Akuntansi lengkap

---

# 3. User

Untuk versi pertama hanya terdapat satu jenis pengguna:

## Admin / Pemilik

Pemilik usaha dapat melakukan seluruh aktivitas:

- Mengelola pelanggan
- Mengelola supplier
- Membuat kredit
- Mengubah kredit
- Mencatat pembayaran
- Membatalkan kredit
- Melihat laporan
- Mencetak bukti pembayaran

Belum diperlukan:

- Staff
- Role
- Permission
- Multi-user

Namun struktur aplikasi sebaiknya tidak mengunci kemungkinan tersebut untuk masa depan.

---

# 4. Modul Pelanggan

## 4.1 Data Pelanggan

Data pelanggan wajib:

### Identitas

- Nama lengkap
- NIK
- Nomor HP
- Alamat lengkap
- Foto KTP
- Tanggal lahir, jika diperlukan
- Catatan

NIK bersifat wajib.

Foto KTP digunakan sebagai dokumentasi identitas pelanggan.

---

# 5. Halaman Detail Pelanggan

Halaman pelanggan menampilkan:

```text
Budi Santoso

NIK
327xxxxxxxxxxxx

No. HP
0812xxxxxxxx

Alamat
Jakarta

--------------------------------

Ringkasan

Kredit aktif          2
Total kredit          Rp12.000.000
Total dibayar         Rp5.000.000
Total piutang         Rp7.000.000
```

Kemudian:

### Riwayat Kredit

Menampilkan seluruh kredit pelanggan.

### Riwayat Pembayaran

Menampilkan seluruh pembayaran pelanggan.

### KTP

Admin dapat melihat foto KTP pelanggan.

---

# 6. Modul Supplier

Supplier hanya digunakan untuk mencatat sumber barang.

Tidak ada inventory supplier.

Data:

- Nama supplier
- Nomor HP
- Alamat
- Catatan

Pada transaksi kredit:

- Supplier
- Harga beli
- Tanggal pembelian
- Nomor nota/invoice
- Catatan

---

# 7. Barang

Tidak ada collection `products`.

Barang disimpan sebagai **snapshot di dalam transaksi kredit**.

Contoh:

```text
Samsung TV 43"
Merk: Samsung
Model: UA43...
Harga beli: Rp4.000.000
```

Informasi barang tidak digunakan untuk menghitung stok.

Tidak diperlukan:

- Jumlah stok
- Stok masuk
- Stok keluar
- Gudang
- Inventory adjustment

---

# 8. Transaksi Kredit

Transaksi kredit merupakan entitas utama.

Contoh:

```text
CR-2026-0001

Pelanggan:
Budi Santoso

Barang:
Samsung TV 43"

Supplier:
Supplier ABC

Harga beli:
Rp4.000.000

Harga kredit:
Rp5.600.000

DP:
Rp600.000

Total pembiayaan:
Rp5.000.000
```

---

# 9. Perhitungan Harga Kredit

Aturan default:

```text
Harga Kredit =
Harga Beli + 40%
```

Contoh:

```text
Harga beli = Rp4.000.000

40% = Rp1.600.000

Harga kredit = Rp5.600.000
```

Namun **40% bukan nilai yang dikunci oleh sistem**.

Admin dapat mengubah harga kredit sebelum transaksi disimpan.

Contoh:

```text
Harga beli
Rp4.000.000

Harga kredit otomatis
Rp5.600.000

[ Edit Harga ]

Harga kredit
Rp5.500.000
```

Dengan demikian sistem dapat menangani transaksi dengan margin berbeda.

---

# 10. Keuntungan Transaksi

Sistem menghitung keuntungan berdasarkan:

```text
Keuntungan =
Harga Kredit - Harga Beli
```

Contoh:

```text
Harga beli       Rp4.000.000
Harga kredit     Rp5.600.000
--------------------------------
Keuntungan       Rp1.600.000
```

DP dan pembayaran cicilan tidak mengubah jumlah keuntungan.

Pembayaran hanya mengubah jumlah piutang.

---

# 11. DP

DP bersifat opsional.

Nilai:

```text
Rp0
```

diperbolehkan.

Contoh tanpa DP:

```text
Harga kredit      Rp5.600.000
DP                         Rp0
Piutang           Rp5.600.000
```

Contoh dengan DP:

```text
Harga kredit      Rp5.600.000
DP                  Rp600.000
Piutang            Rp5.000.000
```

DP harus tercatat sebagai pembayaran awal.

---

# 12. Tenor

Untuk MVP:

**Tenor hanya bulanan.**

Contoh:

```text
Tenor: 10 bulan
```

Tanggal jatuh tempo dapat ditentukan ketika kredit dibuat.

Contoh:

```text
Tanggal mulai:
15 September 2026

Tanggal jatuh tempo:
Tanggal 15 setiap bulan
```

Sistem kemudian menghasilkan jadwal.

---

# 13. Jadwal Cicilan

Sistem otomatis membuat jadwal cicilan berdasarkan:

- Total yang harus dicicil
- Tenor
- Tanggal mulai
- Tanggal jatuh tempo

Contoh:

```text
Piutang: Rp5.000.000
Tenor: 10 bulan

Cicilan:
Rp500.000
```

Jadwal:

```text
#1  15 Okt 2026   Rp500.000
#2  15 Nov 2026   Rp500.000
#3  15 Des 2026   Rp500.000
...
#10 15 Jul 2027   Rp500.000
```

---

# 14. Cicilan Tidak Harus Sama

Sistem harus mendukung nominal cicilan yang berbeda.

Contoh:

```text
Total: Rp5.500.000
Tenor: 10 bulan

#1  Rp550.000
#2  Rp550.000
#3  Rp550.000
...
#9  Rp550.000
#10 Rp550.000
```

Tetapi jika terjadi pembulatan:

```text
#1  Rp555.000
#2  Rp555.000
...
#9  Rp555.000
#10 Rp505.000
```

Sistem harus menerima kondisi tersebut.

Yang menjadi sumber kebenaran adalah:

```text
SUM seluruh nominal cicilan
=
Total piutang
```

---

# 15. Pembayaran Sebagian

Pelanggan boleh membayar kurang dari nominal cicilan.

Contoh:

```text
Cicilan:
Rp500.000

Pembayaran:
Rp300.000
```

Maka:

```text
Dibayar:
Rp300.000

Sisa:
Rp200.000

Status:
PARTIAL
```

Pembayaran berikutnya:

```text
Rp200.000
```

Maka:

```text
Status:
PAID
```

Satu cicilan dapat memiliki beberapa payment.

---

# 16. Pembayaran Beberapa Cicilan Sekaligus

Pelanggan boleh membayar lebih dari satu cicilan.

Contoh:

```text
Cicilan #3 = Rp500.000
Cicilan #4 = Rp500.000

Total = Rp1.000.000
```

Pelanggan membayar:

```text
Rp1.000.000
```

Sistem mengalokasikan pembayaran:

```text
#3 → LUNAS
#4 → LUNAS
```

---

# 17. Pembayaran Lebih Besar

Jika pelanggan membayar lebih besar dari kewajiban cicilan saat ini, kelebihan pembayaran digunakan untuk cicilan berikutnya.

Contoh:

```text
Cicilan #3
Rp500.000

Cicilan #4
Rp500.000

Pelanggan membayar
Rp1.200.000
```

Maka:

```text
#3 → LUNAS       Rp500.000
#4 → LUNAS       Rp500.000
Sisa pembayaran  Rp200.000
```

Rp200.000 kemudian dialokasikan ke cicilan berikutnya.

```text
#5
Rp500.000

Dibayar:
Rp200.000

Sisa:
Rp300.000
```

Status:

```text
#5 → PARTIAL
```

---

# 18. Status Cicilan

Status:

### UPCOMING

Belum memasuki tanggal jatuh tempo.

### DUE

Sudah memasuki tanggal jatuh tempo.

### PARTIAL

Sudah ada pembayaran tetapi belum lunas.

### PAID

Sudah lunas.

### OVERDUE

Sudah melewati tanggal jatuh tempo dan belum lunas.

Tidak ada denda.

---

# 19. Keterlambatan

Keterlambatan hanya menghasilkan status:

```text
OVERDUE
```

Tidak ada:

```text
Denda
Bunga keterlambatan
Biaya tambahan
```

Contoh:

```text
Jatuh tempo:
10 September

Hari ini:
15 September

Pembayaran:
Rp0

Status:
OVERDUE

Tagihan:
Tetap Rp500.000
```

---

# 20. Pelunasan Dipercepat

Pelanggan dapat melunasi seluruh sisa piutang sebelum tenor selesai.

Contoh:

```text
Sisa piutang:
Rp2.500.000
```

Pelanggan membayar:

```text
Rp2.500.000
```

Maka:

```text
Kredit → PAID
```

Tidak ada penalti.

---

# 21. Pembayaran

Setiap pembayaran dicatat sebagai transaksi tersendiri.

Data:

- Nomor pembayaran
- Kredit
- Pelanggan
- Nominal
- Tanggal
- Metode pembayaran
- Cicilan yang dibayar
- Catatan

Metode:

- Cash
- Transfer
- QRIS
- Lainnya

---

# 22. Bukti Pembayaran

Setiap pembayaran menghasilkan bukti pembayaran.

Contoh:

```text
================================
BUKTI PEMBAYARAN
================================

No. Pembayaran:
PAY-2026-00125

Pelanggan:
Budi Santoso

Kredit:
CR-2026-0001

Pembayaran:
Rp500.000

Tanggal:
15 September 2026

Metode:
Cash

--------------------------------

Total Kredit:
Rp5.600.000

Total Dibayar:
Rp2.100.000

Sisa:
Rp3.500.000

================================
```

Bukti dapat:

- Dilihat
- Dicetak
- Disimpan sebagai PDF

Untuk MVP, fungsi print browser dapat digunakan terlebih dahulu.

---

# 23. Dashboard

Dashboard menampilkan kondisi bisnis secara ringkas.

## Ringkasan

```text
Pelanggan
128

Kredit Aktif
87

Total Piutang
Rp342.500.000

Pembayaran Hari Ini
Rp8.500.000
```

## Jatuh Tempo

```text
Hari ini
5 pelanggan

Minggu ini
17 pelanggan
```

## Tunggakan

```text
Pelanggan terlambat
12

Total terlambat
Rp22.500.000
```

## Pembayaran terbaru

Menampilkan transaksi pembayaran terbaru.

---

# 24. Halaman Kredit

Daftar seluruh transaksi kredit.

Kolom:

- Nomor kredit
- Pelanggan
- Barang
- Harga kredit
- Total dibayar
- Sisa
- Jatuh tempo berikutnya
- Status

Filter:

- Aktif
- Lunas
- Terlambat
- Dibatalkan

Search:

- Nama pelanggan
- Nomor kredit
- Nama barang

---

# 25. Detail Kredit

Menampilkan seluruh informasi transaksi.

```text
CR-2026-0001

Budi Santoso

Samsung TV 43"

--------------------------------

Harga Beli
Rp4.000.000

Harga Kredit
Rp5.600.000

Keuntungan
Rp1.600.000

DP
Rp600.000

Piutang
Rp5.000.000

Sudah Dibayar
Rp1.600.000

Sisa
Rp3.400.000
```

Kemudian:

### Jadwal cicilan

```text
#1  Rp500.000  PAID
#2  Rp500.000  PAID
#3  Rp500.000  PARTIAL
#4  Rp500.000  UPCOMING
...
```

### Riwayat pembayaran

Menampilkan seluruh payment.

---

# 26. Pembatalan Kredit

Sesuai aturan bisnis saat ini:

> Jika transaksi dibatalkan, data transaksi dapat dihapus.

Namun sistem perlu memberikan konfirmasi sebelum penghapusan:

```text
Hapus transaksi kredit?

Data yang akan dihapus:
- Kredit
- Jadwal cicilan
- Riwayat pembayaran
- Informasi transaksi

[ Batal ] [ Hapus ]
```

Penghapusan harus bersifat **cascade** sehingga tidak meninggalkan cicilan/payment tanpa kredit induk.

---

# 27. Keuntungan

Sistem menyediakan laporan keuntungan.

Per transaksi:

```text
Harga beli       Rp4.000.000
Harga kredit     Rp5.600.000
Keuntungan       Rp1.600.000
```

Dashboard/laporan dapat menampilkan:

```text
Keuntungan bulan ini
Rp25.500.000
```

Keuntungan dihitung berdasarkan transaksi kredit, bukan berdasarkan pembayaran yang sudah diterima.

---

# 28. Laporan

## Laporan Piutang

- Total piutang
- Belum jatuh tempo
- Jatuh tempo
- Terlambat
- Lunas

## Laporan Pembayaran

Filter:

- Hari
- Minggu
- Bulan
- Custom date range

Menampilkan:

- Total pembayaran
- Jumlah transaksi
- Metode pembayaran

## Laporan Keuntungan

Filter berdasarkan periode.

Menampilkan:

- Jumlah transaksi
- Total harga beli
- Total harga kredit
- Total keuntungan

---

# 29. Pencarian

Pencarian global:

- Nama pelanggan
- NIK
- Nomor HP
- Nomor kredit
- Nomor pembayaran
- Nama barang

---

# 30. WhatsApp

MVP menggunakan WhatsApp manual.

Contoh tombol:

**Kirim Pengingat**

Sistem membuat pesan:

> Halo Budi, mengingatkan bahwa cicilan Samsung TV sebesar Rp500.000 telah jatuh tempo. Terima kasih.

Kemudian membuka WhatsApp.

Tidak diperlukan WhatsApp API pada tahap pertama.

---

# 31. Audit / Riwayat Aktivitas

Walaupun hanya satu user, aktivitas penting tetap sebaiknya dicatat.

Contoh:

```text
15 Sep 2026 10:20
Mencatat pembayaran Rp500.000
CR-2026-0001

15 Sep 2026 11:30
Mengubah data pelanggan
Budi Santoso
```

Aktivitas:

- Membuat pelanggan
- Mengubah pelanggan
- Membuat kredit
- Mengubah kredit
- Mencatat pembayaran
- Menghapus kredit

---

# 32. Struktur Database

Collection utama:

```text
organizations
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
stocks
stock_movements
```

---

# 33. Relasi Data

```text
CUSTOMER
    │
    ├───────────────┐
    │               │
    ▼               ▼
CREDIT          PAYMENTS
    │
    ▼
INSTALLMENTS
```

Sedangkan:

```text
SUPPLIER
    │
    └──── CREDIT
```

---

# 34. Prinsip Penting Database

Nilai finansial tidak boleh bergantung pada angka yang diubah-ubah di frontend.

Sistem harus menghitung ulang di server.

Contoh:

```text
totalPaid =
SUM(payments.amount)

remaining =
credit.totalFinanced - totalPaid
```

SvelteKit menyediakan server-side form actions untuk menerima operasi tulis dari form, sehingga logika pencatatan pembayaran dan validasinya dapat ditempatkan di server, bukan dipercaya dari browser.

---

# 35. Aturan Keuangan Utama

## Harga kredit

```text
hargaKredit =
hargaBeli × 1.40
```

sebagai nilai default.

Admin masih dapat mengubahnya.

## Keuntungan

```text
keuntungan =
hargaKredit - hargaBeli
```

## Piutang awal

```text
piutang =
hargaKredit - DP
```

## Sisa piutang

```text
sisaPiutang =
hargaKredit - seluruh pembayaran
```

## Kredit lunas

```text
sisaPiutang = 0
```

---

# 36. Hal Penting: DP adalah Payment

DP sebaiknya **tidak dibuat sebagai angka yang berdiri sendiri saja**.

Contoh:

```text
Harga Kredit
Rp5.600.000

DP
Rp600.000
```

Secara database:

```text
credit_contract
    totalAmount: 5600000

payment
    amount: 600000
    type: "DOWN_PAYMENT"
```

Dengan demikian seluruh uang yang masuk ke bisnis mempunyai satu sumber data:

**payments**

Ini akan membuat laporan pembayaran lebih akurat.

---

# 37. Prioritas MVP

## P0 — Wajib

1. Login
2. Pelanggan
3. Foto/data KTP
4. Supplier
5. Membuat kredit
6. Perhitungan harga +40%
7. Override harga kredit
8. DP
9. Generate jadwal cicilan
10. Pembayaran
11. Pembayaran sebagian
12. Pembayaran beberapa cicilan
13. Pelunasan
14. Status overdue
15. Perhitungan sisa piutang
16. Perhitungan keuntungan
17. Bukti pembayaran
18. Dashboard

## P1

1. Laporan pembayaran
2. Laporan piutang
3. Laporan keuntungan
4. Search
5. Filter
6. WhatsApp reminder
7. Audit log
8. Print/PDF

## P2

1. Multi-user
2. Role & permission
3. WhatsApp API
4. Multi-cabang
5. Export Excel
6. Fitur akuntansi

---

# 38. Contoh Skenario Lengkap

Budi ingin membeli TV.

Harga beli:

```text
Rp4.000.000
```

Sistem menghitung harga kredit:

```text
Rp4.000.000 × 1.40
= Rp5.600.000
```

Budi membayar DP:

```text
Rp600.000
```

Piutang:

```text
Rp5.000.000
```

Tenor:

```text
10 bulan
```

Jadwal:

```text
10 × Rp500.000
```

Budi kemudian membayar:

```text
Bulan 1:
Rp500.000

Bulan 2:
Rp500.000

Bulan 3:
Rp250.000
```

Sistem:

```text
Total kredit       Rp5.600.000
Total dibayar      Rp1.850.000
Sisa               Rp3.750.000
```

Cicilan #3:

```text
Rp500.000
Dibayar Rp250.000
Sisa Rp250.000

Status PARTIAL
```

Bulan berikutnya Budi membayar:

```text
Rp750.000
```

Sistem mengalokasikan:

```text
Sisa cicilan #3    Rp250.000 → LUNAS
Cicilan #4         Rp500.000 → LUNAS
```

Kemudian:

```text
Cicilan #5
Rp500.000
```

dan seterusnya sampai:

```text
Sisa piutang = Rp0
```

Maka:

```text
Kredit = PAID
```

Keuntungan transaksi tetap:

```text
Rp5.600.000 - Rp4.000.000
= Rp1.600.000
```

---

# 39. Prinsip UX

Karena aplikasi hanya digunakan oleh pemilik usaha, fokus utama bukan kompleksitas enterprise tetapi **kecepatan pencatatan**.

Contoh alur pembayaran:

```text
Dashboard
   ↓
Jatuh Tempo Hari Ini
   ↓
Budi
   ↓
[ Catat Pembayaran ]
   ↓
Nominal
   ↓
Metode
   ↓
[ Simpan ]
   ↓
Bukti Pembayaran
```

Targetnya pembayaran pelanggan dapat dicatat dalam beberapa detik.

---

# 40. Definisi Selesai MVP

MVP dianggap berhasil jika admin dapat melakukan seluruh proses berikut tanpa spreadsheet:

```text
Tambah pelanggan
        ↓
Upload/simpan KTP
        ↓
Buat transaksi kredit
        ↓
Masukkan barang
        ↓
Masukkan supplier
        ↓
Harga kredit otomatis +40%
        ↓
Atur DP
        ↓
Atur tenor
        ↓
Generate cicilan
        ↓
Catat pembayaran
        ↓
Bayar sebagian
        ↓
Bayar beberapa cicilan
        ↓
Lihat sisa piutang
        ↓
Lihat keuntungan
        ↓
Cetak bukti pembayaran
        ↓
Kredit lunas
```

Jika seluruh alur tersebut berjalan dengan benar, versi pertama aplikasi sudah memenuhi kebutuhan inti bisnis.

## Keputusan pemilik — 15 September 2026

- Nominal dan jadwal kredit boleh diubah sebelum ada pembayaran cicilan. Setelah ada pembayaran cicilan, keduanya dikunci.
- Harga kredit minimal sama dengan harga beli; transaksi dengan harga kredit di bawah harga beli ditolak.
- DP yang sudah tercatat tetap mengikuti aturan payment immutable. Mengubah kredit tidak mengubah nominal atau tanggal payment DP yang sudah ada.
