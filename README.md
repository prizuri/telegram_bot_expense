# Telegram Expense Bot for Google Sheets

Bot Telegram sederhana untuk mencatat pengeluaran harian langsung ke Google Spreadsheet melalui Google Apps Script. Bot ini mendukung input teks natural seperti `makan siang 25000`, pencatatan dengan subkategori manual, catatan/keterangan, rekap harian, mingguan, bulanan, budget bulanan, dan daftar kategori/subkategori.

---

## Fitur Utama

- Mencatat pengeluaran harian dari Telegram ke Google Sheets.
- Membaca nominal dalam beberapa format, misalnya `25000`, `25.000`, `18k`, `18rb`, dan `1,5 juta`.
- Deteksi tanggal otomatis:
  - hari ini otomatis;
  - `kemarin`;
  - `17/05/2026`;
  - `17 mei 2026`.
- Deteksi kategori otomatis berdasarkan keyword.
- Input subkategori manual, misalnya `Transportasi: bensin 50000`.
- Input catatan/keterangan, misalnya `makan malam 10000 ket: bebek goreng 2pcs`.
- Rekap pengeluaran hari ini, minggu ini, bulan ini, kategori, subkategori, dan alokasi.
- Budget bulanan.
- Anti-duplikat update Telegram menggunakan `LAST_TELEGRAM_UPDATE_ID` dan `TG_PROCESSED_MESSAGE_KEYS`.
- Webhook stabil menggunakan `HtmlService` untuk menghindari masalah retry Telegram akibat response redirect.

---

## Struktur Spreadsheet

Script akan otomatis membuat dua sheet jika belum ada.

### 1. `Transactions`

| Kolom | Keterangan |
|---|---|
| ID | Nomor transaksi otomatis |
| Tanggal | Tanggal transaksi |
| Waktu Input | Waktu saat transaksi dicatat |
| Nama Pengeluaran | Nama transaksi |
| Kategori | Kategori utama |
| Subkategori | Subkategori pengeluaran |
| Alokasi | Jenis alokasi dana |
| Nominal | Nominal pengeluaran |
| Catatan | Keterangan tambahan |
| User ID | ID user Telegram |
| Sumber | Sumber input, default `Telegram` |

### 2. `Budget`

| Kolom | Keterangan |
|---|---|
| User ID | ID user Telegram |
| Bulan | Bulan budget |
| Tahun | Tahun budget |
| Budget | Nominal budget bulanan |

---

## Script Properties

Buka Google Apps Script, lalu masuk ke:

```text
Project Settings → Script Properties
```

### Properti yang wajib diisi manual

| Property | Wajib | Contoh | Keterangan |
|---|---:|---|---|
| `BOT_TOKEN` | Ya | `123456:ABC...` | Token bot dari BotFather |
| `ALLOWED_USER_IDS` | Ya | `123456789` atau `123,456` | ID Telegram yang diizinkan memakai bot |
| `WEBHOOK_SECRET` | Ya | `botuang-web-123` | Secret sederhana agar URL webhook tidak mudah dipakai orang lain |
| `WEB_APP_URL` | Ya | `https://script.google.com/macros/s/.../exec` | URL Web App dari deployment Apps Script |

### Properti yang dibuat otomatis oleh sistem

Dua properti ini **tidak perlu diisi manual**:

| Property | Keterangan |
|---|---|
| `LAST_TELEGRAM_UPDATE_ID` | Menyimpan update Telegram terakhir agar update lama tidak diproses ulang |
| `TG_PROCESSED_MESSAGE_KEYS` | Menyimpan daftar pesan terakhir agar pesan yang sama tidak dicatat berulang |

Jika bot bermasalah atau ingin reset antrean webhook, jalankan:

```js
resetTelegramBotHard()
```

atau untuk stop darurat:

```js
emergencyStopWebhook()
```

---

## Cara Instalasi

### 1. Buat Bot Telegram

1. Buka Telegram.
2. Cari `@BotFather`.
3. Jalankan `/newbot`.
4. Ikuti instruksi sampai mendapatkan `BOT_TOKEN`.
5. Simpan token di Script Properties, jangan ditulis langsung di kode.

### 2. Ambil User ID Telegram

Gunakan bot seperti `@userinfobot`, lalu ambil angka user ID Telegram Anda.

Masukkan ke Script Properties:

```text
ALLOWED_USER_IDS=123456789
```

Jika lebih dari satu user:

```text
ALLOWED_USER_IDS=123456789,987654321
```

### 3. Siapkan Google Spreadsheet

1. Buat Google Spreadsheet baru.
2. Buka menu `Extensions → Apps Script`.
3. Copy isi file `Code.gs` ke Apps Script.
4. Pastikan file Apps Script tersimpan.

### 4. Isi Script Properties

Isi empat properti wajib:

```text
BOT_TOKEN=isi_token_bot_telegram
ALLOWED_USER_IDS=isi_user_id_telegram
WEBHOOK_SECRET=isi_secret_bebas
WEB_APP_URL=isi_url_web_app_setelah_deploy
```

Catatan: `WEB_APP_URL` baru didapat setelah deploy Web App.

### 5. Deploy Web App

Di Apps Script:

```text
Deploy → New deployment → Web app
```

Setelan yang disarankan:

```text
Execute as: Me
Who has access: Anyone
```

Setelah deploy, copy URL `/exec`, lalu masukkan ke Script Properties sebagai `WEB_APP_URL`.

### 6. Aktifkan Webhook

Jalankan fungsi berikut dari Apps Script:

```js
resetTelegramBotHard()
```

Kemudian cek webhook:

```js
getTelegramWebhookInfo()
```

Target yang baik:

```json
"pending_update_count": 0
```

---

## Cara Pakai Bot

### Input dasar

Format wajib:

```text
nama pengeluaran nominal
```

Contoh:

```text
makan siang 25000
bensin 50000
kopi 18k
belanja sabun 12000
```

### Input dengan tanggal

```text
makan malam 10000 kemarin
parkir 5000 17/05/2026
beli buku 75000 17 mei 2026
```

### Input dengan catatan/keterangan

Gunakan `ket:` atau `catatan:`.

```text
makan malam 10000 ket: bebek goreng 2pcs
bensin 50000 ket: pertalite motor
kopi 18k ket: kopi susu di cafe
```

### Input dengan subkategori manual

Format:

```text
Subkategori: nama pengeluaran nominal ket: catatan
```

Contoh:

```text
Makanan & Minuman: makan malam 10000 ket: bebek goreng 2pcs
Transportasi: bensin 50000 ket: isi bensin motor
Jajanan: bakso 10000
Infaq: masjid 50000
```

Jika kata pengeluaran belum dikenali kategori otomatis, pakai format subkategori manual.

---

## Daftar Command Telegram

### Panduan

| Command | Fungsi |
|---|---|
| `/menu` | Menampilkan menu utama |
| `/contoh` | Menampilkan contoh input |
| `/format` | Menampilkan aturan input wajib dan opsional |
| `/daftar_kategori` | Menampilkan kategori dan subkategori |
| `/daftar_subkategori` | Menampilkan daftar subkategori |
| `/perintah` | Menampilkan semua command |
| `/batal` | Membersihkan input/state tertunda |

### Rekap dan laporan

| Command | Fungsi |
|---|---|
| `/hariini` | Total pengeluaran hari ini |
| `/mingguini` | Total pengeluaran minggu ini |
| `/bulanini` | Total pengeluaran bulan ini |
| `/rekap` | Rekap berdasarkan kategori bulan ini |
| `/kategori` | Rekap berdasarkan kategori bulan ini |
| `/subkategori` | Rekap berdasarkan subkategori bulan ini |
| `/alokasi` | Rekap berdasarkan alokasi bulan ini |
| `/terakhir` | Menampilkan 5 transaksi terakhir |
| `/terbesar` | Menampilkan transaksi terbesar |
| `/insight` | Ringkasan dan insight bulan ini |
| `/export` | Menampilkan URL spreadsheet |

### Edit dan budget

| Command | Fungsi |
|---|---|
| `/hapus_terakhir` | Menghapus transaksi terakhir user tersebut |
| `/ubah_terakhir 30000` | Mengubah nominal transaksi terakhir |
| `/budget 3000000` | Mengatur budget bulan ini |
| `/cek_budget` | Mengecek pemakaian budget bulan ini |

---

## Kategori dan Subkategori Default

### Kebutuhan wajib

- Makanan & Minuman
- Belanja Harian
- Transportasi
- Utilities (internet, pakaian kerja, alat kerja)
- Sewa / Kos

### Gaya hidup

- Jajanan
- Hiburan & Keperluannya
- Nongkrong / Cafe
- Belanja Impulsif

### Pengembangan diri

- Kursus
- Buku
- Seminar / Workshop
- Tools Belajar

### Kesehatan & Olahraga

- Olahraga
- Gym
- Suplemen
- Kesehatan (dokter, obat)

### Sosial & Spiritual

- Infaq
- Sedekah
- Zakat
- Fidyah
- Hadiah untuk Orang Lain

### Keuangan

- Hutang (bayar cicilan)
- Memberi Pinjaman
- Biaya Admin Bank

### Penyesuaian

- Lupa Catat
- Koreksi
- Selisih

### Investasi

- Beli Saham
- Beli Emas
- Reksadana

### Dana Darurat

- Top up Dana Darurat
- Tarik Dana Darurat

---

## Push ke GitHub

### Opsi A — upload manual dari website GitHub

1. Buat repository baru di GitHub.
2. Jangan centang template yang tidak diperlukan.
3. Upload file:
   - `Code.gs`
   - `README.md`
   - `.gitignore`
   - `appsscript.json`
4. Pastikan tidak ada token, user ID pribadi sensitif, atau URL secret yang ikut ditulis di README atau kode.

### Opsi B — push dari Git di komputer

```bash
git init
git add Code.gs README.md .gitignore appsscript.json
git commit -m "Initial commit: Telegram expense bot"
git branch -M main
git remote add origin https://github.com/USERNAME/NAMA-REPO.git
git push -u origin main
```

Ganti:

```text
USERNAME = username GitHub Anda
NAMA-REPO = nama repository Anda
```

Contoh:

```bash
git remote add origin https://github.com/username/telegram-expense-bot.git
```

---

## Catatan Keamanan

Jangan pernah commit atau push data berikut ke GitHub:

- `BOT_TOKEN`
- isi `WEBHOOK_SECRET`
- URL Web App yang sudah mengandung `?secret=...`
- file `.clasp.json` jika tidak ingin Script ID terlihat publik
- credential Google/service account
- screenshot Script Properties yang menampilkan nilai token/secret

Jika token Telegram pernah terlanjur dipush ke repository publik, segera buka BotFather dan regenerate token.

---

## Troubleshooting

### Bot tidak membalas command

Jalankan:

```js
getTelegramWebhookInfo()
```

Jika `pending_update_count` bertambah, jalankan:

```js
resetTelegramBotHard()
```

### Bot mencatat transaksi dobel

Jalankan:

```js
clearTelegramDedupeState()
resetTelegramBotHard()
```

Pastikan kode yang aktif adalah deployment versi terbaru.

### Webhook error 302

Pastikan fungsi `jsonResponse()` menggunakan `HtmlService`, bukan `ContentService`.

### `/menu` bisa, tapi command lain tidak membalas

Biasanya Web App URL masih mengarah ke deployment lama. Deploy ulang dengan:

```text
Deploy → Manage deployments → Edit/Pensil → Version: New version → Deploy
```

Lalu jalankan ulang:

```js
resetTelegramBotHard()
```

---

## Lisensi

Gunakan bebas untuk kebutuhan pribadi dan pembelajaran.
