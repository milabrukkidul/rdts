# Aplikasi Penerimaan Siswa Baru (PPDB) Online - GAS & GitHub Web

Aplikasi Penerimaan Peserta Didik Baru (PPDB) berbasis **Google Apps Script (GAS)** dan **Google Sheets Database** dengan antarmuka modern bertema **Hijau Tosca & Putih Glassmorphism**, dilengkapi dengan animasi **Orbit Dot Logo**, efek **Pulse**, layout **Side View (Desktop & Mobile)**, serta sistem **Pembatasan Kuota Otomatis** untuk Tahun Pelajaran **2027/2028** dan **2028/2029**.

---

## 🌟 Fitur Utama
1. **Tema & Desain Visual Premium**:
   - Tema warna Hijau Tosca (`#00A896`, `#028090`) & Putih dengan efek *Glassmorphism Transparan Melayang* (`backdrop-filter blur`).
   - Animasi **Orbit Dot Logo** (titik mengorbit berputar melingkari logo sekolah).
   - Animasi **Pulse Glow** pada background, badge kuota, dan tombol pendaftaran keren (*cool glowing button*).
   - Animasi **Loading Modal Orbit Dot** saat memproses kiriman data.
2. **Layout Responsif (Side View & Mobile View)**:
   - **Desktop Side View**: Left Sidebar (Logo, Judul, Switcher Tahun Pelajaran, Cards Info Kuota) & Main Content (Formulir Data Siswa & Data Keluarga).
   - **Mobile View**: Drawer responsif yang nyaman digunakan di smartphone.
3. **Formulir Pendaftaran Lengkap**:
   - **SUB "DATA SISWA"**:
     - Nama (catatan: *"Nama Sesuai Akte Kelahiran"*)
     - Jenis Kelamin (pilihan pill L & P)
     - Tempat Lahir (catatan: *"Kota Kelahiran Sesuai Akte"*)
     - Tanggal Lahir (date picker)
     - Asal KB/TK/RA Sebelumnya
     - NIK Siswa (catatan: *"NIK Sesuai Akte/KK"*, filter 16 angka)
     - Nomor WhatsApp yang aktif (catatan: *"hanya angka"*)
   - **SUB "DATA KELUARGA"**:
     - Nomor KK
     - Nama Ayah
     - NIK Ayah
     - Nama Ibu
     - NIK Ibu
4. **Validasi Merah & Notifikasi**:
   - Peringatan instan warna **Merah** (`notice Merah apabila ada yang belum diisi`) dan highlight input merah jika ada kolom wajib yang kosong.
5. **Sistem Penguncian Kuota Otomatis**:
   - Batas kuota maksimal default **112** (bisa di-setting di spreadsheet).
   - Pilihan Tahun Pelajaran **2027/2028** dan **2028/2029**.
   - Indikator Live Kuota (Total Kuota, Terisi, Sisa Kuota).
   - Tombol **"KIRIM PENDAFTARAN"** otomatis terkunci (disabled) ketika kuota penuh.
6. **Otomatisasi Database Spreadsheet**:
   - Script `setupDatabase()` membuat dan memformat tab **`DATA_PENDAFTARAN`**, **`SETTINGS`**, dan **`KUOTA`** secara otomatis lengkap dengan formula & sampel data.
7. **Bukti Pendaftaran & Integrasi WhatsApp**:
   - Menampilkan modal Bukti Pendaftaran (*Receipt Card*) dengan Nomor Pendaftaran unik (contoh: `REG-2027-001`) dan tombol konfirmasi otomatis ke WhatsApp Admin.

---

## 🛠️ Cara Penggunaan & Deployment

### Langkah 1: Inisialisasi Database Spreadsheet Otomatis
1. Buka [Google Sheets](https://sheets.google.com) baru.
2. Klik menu **Ekstensi** > **Apps Script**.
3. Hapus kode bawaan, lalu salin isi file [`Code.gs`](file:///d:/appscript%20github%20%28xampp%29/indenppdb/Code.gs) ke editor Apps Script.
4. Salin isi file [`index.html`](file:///d:/appscript%20github%20%28xampp%29/indenppdb/index.html) (Buat file HTML baru bernama `index` di Apps Script).
5. Pada dropdown fungsi di bagian atas editor Apps Script, pilih fungsi **`setupDatabase`**, lalu klik tombol **▶ Jalankan (Run)**.
6. Berikan izin otorisasi (*Grant Permissions*).
7. Kembali ke Google Sheets Anda. Tab **`DATA_PENDAFTARAN`**, **`SETTINGS`**, dan **`KUOTA`** akan otomatis terbuat lengkap dengan warna header tosca, formula, dan data sampel!

### Langkah 2: Deploy Web App Google Apps Script
1. Di editor Apps Script, klik tombol **Terapkan (Deploy)** > **Pengembangan Baru (New Deployment)**.
2. Klik ikon ⚙️ (*Select type*) dan pilih **Aplikasi Web (Web App)**.
3. Isikan data berikut:
   - **Deskripsi**: PPDB Web App V1
   - **Jalankan sebagai (Execute as)**: *Saya (Me / Email Anda)*
   - **Yang memiliki akses (Who has access)**: *Siapa saja (Anyone)*
4. Klik **Deploy**.
5. Salin **URL Aplikasi Web** (*Web App URL*) yang dihasilkan.

### Langkah 3: Deploy di GitHub Pages (Opsional)
Jika Anda ingin memasang web ini di **GitHub Pages** atau Hosting Web Mandiri:
1. Upload file `index.html` ke repositori GitHub Anda.
2. Aktifkan **GitHub Pages** di tab Settings repositori.
3. Buka halaman web GitHub Pages Anda.
4. Klik tombol ⚙️ **Setup API URL** di sudut kanan bawah web, lalu tempelkan **URL Web App GAS** yang Anda salin pada Langkah 2.

---

## 📁 Struktur File
- [`Code.gs`](file:///d:/appscript%20github%20%28xampp%29/indenppdb/Code.gs): Backend server script (API GET/POST, validasi kuota server-side, setup database otomatis).
- [`index.html`](file:///d:/appscript%20github%20%28xampp%29/indenppdb/index.html): Single-page frontend (HTML, CSS Tosca Glassmorphism, JS Logic, Side View Desktop & Mobile).
- [`appsscript.json`](file:///d:/appscript%20github%20%28xampp%29/indenppdb/appsscript.json): Manifest Apps Script runtime V8 & timezone.
