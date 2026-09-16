# Kredit — Sistem Manajemen Kredit & Cicilan Barang

Aplikasi web modern untuk mengelola usaha pembiayaan dan kredit barang secara terstruktur, dirancang khusus untuk satu pemilik usaha (single admin/owner). Dibangun dengan **SvelteKit 2**, **Svelte 5 (Runes)**, **TypeScript**, **Tailwind CSS v4**, dan **MongoDB** (dengan transaksi ACID).

---

## Daftar Isi

- [Tentang Aplikasi](#tentang-aplikasi)
- [Fitur Utama](#fitur-utama)
- [Prinsip & Aturan Bisnis](#prinsip--aturan-bisnis)
- [Tech Stack](#tech-stack)
- [Struktur Proyek](#struktur-proyek)
- [Prasyarat Sistem](#prasyarat-sistem)
- [Panduan Instalasi & Konfigurasi](#panduan-instalasi--konfigurasi)
- [Daftar Perintah (NPM Scripts)](#daftar-perintah-npm-scripts)
- [Pengujian (Testing)](#pengujian-testing)
- [Penyimpanan KTP & Pembersihan Cloudinary](#penyimpanan-ktp--pembersihan-cloudinary)
- [Panduan Produksi & Deployment](#panduan-produksi--deployment)

---

## Tentang Aplikasi

Aplikasi ini menyederhanakan operasional usaha kredit barang skala kecil hingga menengah:

- **Bukan Sistem Stok/Inventory:** Barang dibeli dari supplier/toko setelah ada pesanan dari pelanggan. Data barang disimpan sebagai _snapshot_ transaksi pada kontrak kredit.
- **Supplier Sederhana:** Supplier dicatat langsung sebagai nama toko/sumber barang pada transaksi kredit tanpa perlu mengelola master data supplier terpisah.
- **Tanpa Bunga Berbunga & Tanpa Denda:** Sistem pencatatan cicilan flat, transparan, dan tidak mengenakan denda keterlambatan.

---

## Fitur Utama

### 1. 📊 Dashboard & Metrik Real-Time

- Ringkasan total piutang aktif, penerimaan kas hari ini, total pelanggan, dan keuntungan transaksi bulan berjalan.
- Tabel cicilan yang jatuh tempo hari ini atau sudah terlambat.
- Daftar 5 pembayaran terakhir yang masuk.

### 2. 👥 Manajemen Pelanggan

- Pencatatan data identitas lengkap: Nama, NIK 16 digit (unik), tanggal lahir, nomor telepon, dan alamat.
- Upload foto KTP yang disimpan secara privat dan aman.
- Halaman profil detail pelanggan dengan ringkasan total kredit, total dibayar, sisa piutang, riwayat kredit, dan riwayat pembayaran.
- Proteksi data: Pelanggan yang memiliki riwayat transaksi kredit tidak dapat dihapus.

### 3. 📦 Transaksi Kredit

- Pembuatan kontrak kredit dengan nomor otomatis berurutan (`CR-YYYY-NNNNNN`).
- Detail barang (nama, merek, model, nomor seri, catatan).
- Perhitungan harga kredit otomatis dengan markup default 40% dari harga beli, dengan opsi _override_ nominal oleh admin.
- Dukungan Uang Muka (DP) nol atau lebih besar dari nol.
- Penjadwalan cicilan bulanan otomatis dengan pembagian integer Rupiah presisi (sisa pembagian dialokasikan ke cicilan bulan terakhir).
- Edit nominal dan jadwal hanya diperbolehkan sebelum ada pembayaran cicilan yang masuk.

### 4. 💰 Pencatatan & Alokasi Pembayaran

- Nomor bukti pembayaran otomatis (`PAY-YYYY-NNNNNN`).
- **Sistem Alokasi Waterfall:** Pembayaran secara otomatis dialokasikan ke cicilan tertua yang belum lunas.
- Mendukung pembayaran sebagian (_partial payment_), pembayaran beberapa bulan sekaligus, serta pelunasan dipercepat (_early settlement_).
- Pratinjau alokasi cicilan sebelum transaksi disimpan.
- Validasi server ketat untuk mencegah kelebihan pembayaran (_overpayment_) dan transaksi ganda (_double-submit_).

### 5. 🧾 Bukti Pembayaran (Kwitansi)

- Halaman bukti pembayaran siap cetak (_print-ready_) atau simpan sebagai PDF.
- Dilengkapi snapshot saldo saat pembayaran terjadi (total kredit, total dibayar, dan sisa piutang).
- Rincian alokasi cicilan yang terbayar.

### 6. 📲 Pengingat Tagihan WhatsApp

- Tombol sekali klik pada halaman detail kredit yang langsung membuka WhatsApp Web atau aplikasi WhatsApp dengan nomor pelanggan dan pesan pengingat yang otomatis terformat.

### 7. 📈 Laporan Bisnis

- Filter fleksibel berdasarkan rentang tanggal:
  - **Laporan Keuntungan:** Menampilkan harga beli, harga kredit, dan estimasi keuntungan transaksi.
  - **Laporan Pembayaran:** Rekapitulasi kas masuk yang diterima (termasuk DP).
  - **Laporan Tunggakan:** Daftar cicilan yang melewati batas jatuh tempo dalam periode yang dipilih.
- Tampilan laporan dapat langsung dicetak.

### 8. 🔒 Keamanan & Audit Trail

- Login tunggal pemilik dengan hashing password **Argon2id**.
- Pembatasan percobaan login salah (rate limiting 15 menit jika gagal lebih dari 10 kali).
- Sesi privat berbasis token hash yang dapat dicabut.
- Pencatatan riwayat aktivitas lengkap pada collection `audit_logs`.

### 9. 🤖 Cadangan Database ke Telegram & Pengingat 30 Hari

- **Pengingat di Dashboard:** Sistem otomatis melacak waktu sejak cadangan terakhir berdasarkan log audit. Jika sudah ≥ 30 hari atau belum pernah dicadangkan, dashboard menampilkan banner peringatan mencolok beserta status cadangan di panel samping.
- **Cadangkan Sekali Klik:** Pemilik cukup menekan satu tombol di dashboard untuk mengekspor seluruh koleksi database dan mengirimkannya langsung ke Telegram.
- **Ekspor Ringan & Aman:** Berkas dikompresi menjadi `.json.gz` dan dikirim langsung ke chat Telegram privat pemilik melalui Telegram Bot API.
- **Dukungan CLI:** Perintah `npm run db:backup` juga tersedia untuk pencadangan manual lewat terminal.

---

## Prinsip & Aturan Bisnis

1. **Invarian Finansial (Integer Rupiah):**
   - Semua nilai uang disimpan dan dihitung dalam satuan integer Rupiah bulat (`Number.isSafeInteger`).
   - Tidak ada floating point dalam penyimpanan data moneter.
2. **Kalkulasi Harga Kredit:**
   - Formula default: `creditPrice = round(purchasePrice * 140 / 100)`.
   - Admin dapat menentukan harga sendiri, dengan syarat `creditPrice >= purchasePrice`.
   - Keuntungan: `profit = creditPrice - purchasePrice`.
3. **Uang Muka & Pembiayaan:**
   - `financedAmount = creditPrice - downPayment`.
   - Jika DP dibayarkan saat pembuatan kredit, sistem otomatis mencatat pembayaran bertipe `DOWN_PAYMENT`.
4. **Logika Jatuh Tempo Bulanan:**
   - Clamping tanggal akhir bulan: Jika kredit dimulai pada tanggal 31 Januari, cicilan bulan Februari jatuh tempo pada tanggal 28/29 Februari, dan bulan Maret kembali jatuh tempo pada tanggal 31 Maret.
5. **Integritas Transaksi:**
   - Semua mutasi data finansial dibungkus dalam **MongoDB Multi-Document Transaction** dengan _snapshot isolation_.

---

## Tech Stack

| Komponen               | Teknologi                                                                                       |
| ---------------------- | ----------------------------------------------------------------------------------------------- |
| **Framework**          | [SvelteKit 2](https://kit.svelte.dev/) (dengan Svelte 5 Runes)                                  |
| **Bahasa**             | [TypeScript](https://www.typescriptlang.org/) (Strict Mode)                                     |
| **Styling**            | [Tailwind CSS v4](https://tailwindcss.com/)                                                     |
| **Database**           | [MongoDB Node.js Driver v6](https://www.mongodb.com/)                                           |
| **Penyimpanan Berkas** | [Cloudinary SDK v2](https://cloudinary.com/) (Authenticated Asset)                              |
| **Autentikasi & Hash** | [Argon2](https://github.com/ranisalt/node-argon2)                                               |
| **Validasi Skema**     | [Zod v4](https://zod.dev/)                                                                      |
| **Ikon UI**            | [Lucide Svelte](https://lucide.dev/)                                                            |
| **Testing**            | [Vitest](https://vitest.dev/) (Unit & Integration), [Playwright](https://playwright.dev/) (E2E) |
| **Adapter Produksi**   | `@sveltejs/adapter-node`                                                                        |

---

## Struktur Proyek

```text
kredit/
├── e2e/                        # End-to-End browser tests (Playwright)
├── scripts/                    # Skrip CLI utilitas & pemeliharaan
│   ├── backup-telegram.ts      # Pencadangan database manual ke Telegram via CLI
│   ├── check-cloudinary.ts     # Verifikasi upload & download privat Cloudinary
│   ├── check-db.ts             # Verifikasi koneksi MongoDB Atlas
│   ├── cleanup-storage.ts      # Pembersihan berkas KTP yatim di Cloudinary
│   ├── e2e-server.ts           # Server runner untuk pengujian E2E
│   ├── seed.ts                 # Inisialisasi indeks MongoDB & akun pemilik
│   └── smoke.mjs               # Smoke test server
├── src/
│   ├── app.css                 # Konfigurasi Tailwind CSS v4 & custom stylesheet
│   ├── app.d.ts                # Deklarasi tipe global SvelteKit (locals.user)
│   ├── hooks.server.ts         # Middleware auth, security headers, cleanup trigger
│   ├── lib/
│   │   ├── components/         # Komponen UI Svelte 5 (Dashboard, DataTable, EntryForm, Metrics)
│   │   ├── schemas/            # Skema validasi Zod untuk formulir
│   │   ├── server/             # Logika backend & database
│   │   │   ├── auth.ts         # Login, sesi token, logout, brute-force rate limit
│   │   │   ├── backup.ts       # Service ekspor database & integrasi Telegram Bot API
│   │   │   ├── credits.ts      # Service kontrak kredit & penjadwalan
│   │   │   ├── db.ts           # Koneksi MongoDB, session transaksi, pembuatan indeks
│   │   │   ├── errors.ts       # Domain error handling
│   │   │   ├── finance.ts      # Kalkulasi finansial, harga, pembagian cicilan, waterfall
│   │   │   ├── legacy-supplier.ts # Kompatibilitas pembacaan data supplier lama
│   │   │   ├── payments.ts     # Service pencatatan & alokasi pembayaran
│   │   │   ├── people.ts       # Service CRUD data pelanggan & upload foto KTP
│   │   │   ├── storage.ts      # Integrasi Cloudinary authenticated storage
│   │   │   ├── storage-cleanup.ts # Antrean & retry pembersihan file Cloudinary
│   │   │   └── views.ts        # Query aggregator untuk antarmuka UI
│   │   ├── types/              # Deklarasi tipe TypeScript (entities & UI)
│   │   └── utils/              # Helper tanggal Asia/Jakarta & format mata uang Rupiah
│   └── routes/                 # Halaman & endpoints SvelteKit
│       ├── [...path]/          # Dynamic routing terpadu (customers, credits, payments, reports, search)
│       ├── ktp/[id]/           # Server endpoint pengunduhan privat foto KTP
│       ├── login/              # Halaman login pemilik
│       └── logout/             # Endpoint logout
└── tests/                      # Unit & integration test suites
    ├── backup.test.ts          # Pengujian konfigurasi & kompresi cadangan
    ├── cloudinary-fake.ts      # Mocking Cloudinary untuk testing
    ├── finance.test.ts         # Pengujian logika finansial & waterfall
    ├── integration.test.ts     # Pengujian transaksi MongoDB di memory server
    └── storage.test.ts         # Pengujian upload & cleanup
```

---

## Prasyarat Sistem

1. **Node.js:** Versi **22.9+** atau **24 LTS**.
2. **MongoDB:** MongoDB Atlas atau MongoDB lokal dengan dukungan **Replica Set** (transaksi ACID multi-dokumen).
3. **Akun Cloudinary:** Diperlukan untuk penyimpanan foto KTP terenkripsi/terotentikasi.

---

## Panduan Instalasi & Konfigurasi

### 1. Clone & Instalasi Dependensi

```sh
git clone <repository-url>
cd kredit
npm install
```

### 2. Konfigurasi Variabel Lingkungan (`.env`)

Salin berkas contoh `.env.example` menjadi `.env`:

```sh
cp .env.example .env
```

Sesuaikan nilai variabel berikut pada berkas `.env`:

| Variabel                | Keterangan                                                        | Contoh Nilai                                                             |
| ----------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `MONGODB_URI`           | Connection string MongoDB (Atlas / Replica Set)                   | `mongodb+srv://user:pass@cluster.mongodb.net/?appName=kredit`            |
| `MONGODB_DB_NAME`       | Nama database aplikasi di MongoDB                                 | `kredit`                                                                 |
| `SESSION_SECRET`        | String rahasia acak minimal 32 karakter untuk hashing token sesi  | `k3j4k-r4h4s14-s3ss10n-s3cr3t-m1n-32-k4r4kt3r!`                          |
| `ADMIN_USERNAME`        | Username akun pemilik                                             | `admin`                                                                  |
| `ADMIN_PASSWORD`        | Password akun pemilik saat inisialisasi awal (minimal 6 karakter) | `kataSandiKuat123!`                                                      |
| `CLOUDINARY_CLOUD_NAME` | Cloud name dari dashboard Cloudinary                              | `my-cloud`                                                               |
| `CLOUDINARY_API_KEY`    | API Key Cloudinary                                                | `123456789012345`                                                        |
| `CLOUDINARY_API_SECRET` | API Secret Cloudinary                                             | `AbCdEfGhIjKlMnOpQrStUvWxYz`                                             |
| `ORIGIN`                | URL asal aplikasi untuk CSRF & security check                     | `http://localhost:5173` (lokal) atau `https://kredit.example.com` (prod) |
| `TELEGRAM_BOT_TOKEN`    | Token bot Telegram dari @BotFather (untuk pengiriman cadangan)    | `1234567890:ABCDefGhIJKlmNoPQRsTUVwxyZ`                                  |
| `TELEGRAM_CHAT_ID`      | ID chat Telegram pemilik (dapat dilihat via @userinfobot)         | `987654321`                                                              |

### 3. Inisialisasi Database & Akun Admin

Jalankan perintah seed untuk membangun indeks MongoDB dan membuat akun pemilik:

```sh
npm run db:seed
```

Periksa koneksi database:

```sh
npm run db:check
```

_(Opsional)_ Periksa integrasi Cloudinary:

```sh
npx tsx --env-file=.env scripts/check-cloudinary.ts
```

### 4. Menjalankan Server Development

```sh
npm run dev
```

Buka peramban di `http://localhost:5173`. Masuk menggunakan username dan password yang telah Anda daftarkan di `.env`.

---

## Daftar Perintah (NPM Scripts)

| Perintah                   | Deskripsi                                                                             |
| -------------------------- | ------------------------------------------------------------------------------------- |
| `npm run dev`              | Menjalankan server pengembangan lokal (Vite) di `http://127.0.0.1:5173`               |
| `npm run check`            | Memeriksa tipe TypeScript dan diagnostik komponen Svelte via `svelte-check`           |
| `npm run lint`             | Memeriksa format kode menggunakan Prettier                                            |
| `npm run format`           | Memperbaiki format kode secara otomatis menggunakan Prettier                          |
| `npm run test`             | Menjalankan seluruh pengujian unit & integrasi menggunakan Vitest                     |
| `npm run test:unit`        | Menjalankan pengujian unit invariant finansial (`tests/finance.test.ts`)              |
| `npm run test:integration` | Menjalankan pengujian integrasi transaksi MongoDB di memory replica set               |
| `npm run test:e2e`         | Menjalankan pengujian E2E browser dengan Playwright                                   |
| `npm run test:smoke`       | Menjalankan smoke test build server                                                   |
| `npm run db:seed`          | Menginisialisasi indeks collection dan akun admin pertama                             |
| `npm run db:check`         | Memeriksa status konektivitas ke database MongoDB                                     |
| `npm run db:backup`        | Menjalankan ekspor dan pengiriman cadangan database langsung ke Telegram via CLI      |
| `npm run storage:cleanup`  | Menjalankan batch penghapusan berkas KTP tertunda di Cloudinary (maksimal 100 berkas) |
| `npm run build`            | Melakukan build aplikasi untuk lingkungan produksi                                    |
| `npm run preview`          | Menjalankan pratinjau hasil build lokal                                               |
| `npm start`                | Menjalankan aplikasi hasil build Node.js di lingkungan produksi                       |

---

## Pengujian (Testing)

Aplikasi dilengkapi tiga tingkatan pengujian:

1. **Unit Test (`npm run test:unit`):** Memverifikasi invariant finansial, pembulatan integer, clamping tanggal jatuh tempo, status cicilan, dan alokasi pembayaran waterfall.
2. **Integration Test (`npm run test:integration`):** Memverifikasi transaksi ACID, rollback, locking parent revision, pencegahan race condition, dan cleanup KTP pada MongoDB Memory Server terisolasi.
3. **End-to-End Test (`npm run test:e2e`):** Memverifikasi alur lengkap browser mulai dari login, pembuatan pelanggan, upload KTP, pembuatan kredit, pembayaran, hingga pembuatan kwitansi.

---

## Penyimpanan KTP & Pembersihan Cloudinary

Foto KTP pelanggan diperlakukan sebagai dokumen sensitif:

- **Penyimpanan Terotentikasi:** Disimpan di folder `kredit/ktp` dengan akses bertipe `authenticated` (tidak dapat diakses publik tanpa signature).
- **Proxy Server:** Pengunduhan dilakukan melalui endpoint aplikasi [`/ktp/[id]`](file:///C:/Users/901083/Desktop/svelte/kredit/src/routes/ktp/%5Bid%5D/+server.ts) yang mewajibkan sesi login admin aktif.
- **Sistem Pembersihan Otomatis:**
  - Saat pelanggan dihapus atau foto KTP diperbarui, berkas lama otomatis dijadwalkan untuk dihapus dari Cloudinary.
  - Jika panggilan API Cloudinary mengalami gangguan jaringan, tugas penghapusan disimpan di collection `storage_cleanup` dan akan dicoba kembali secara otomatis pada background request berikutnya atau melalui perintah `npm run storage:cleanup`.
  - Berkas yang masih memiliki referensi di database dijamin tidak akan terhapus.

---

## Panduan Produksi & Deployment

1. **Build Aplikasi:**
   ```sh
   npm run build
   ```
2. **Konfigurasi Lingkungan Produksi:**
   - Pastikan `ORIGIN` diatur ke URL domain HTTPS produksi Anda (misal `https://kredit.perusahaan.com`).
   - Atur `BODY_SIZE_LIMIT=6M` pada environment Node.js untuk mengakomodasi upload berkas KTP hingga batas 5 MB.
   - Pastikan reverse proxy (Nginx, Caddy, atau Cloudflare) mengarahkan traffic ke aplikasi dengan HTTPS dan header `X-Forwarded-For` serta `X-Forwarded-Proto` yang sesuai.
3. **Menjalankan Service:**
   ```sh
   npm start
   ```
   _(Gunakan process manager seperti PM2, Docker, atau Systemd service untuk menjaga ketersediaan aplikasi secara berkelanjutan)._

---

## Lisensi

Hak Cipta © 2026. Aplikasi privat untuk pengelolaan usaha kredit barang. Seluruh hak cipta dilindungi undang-undang.
