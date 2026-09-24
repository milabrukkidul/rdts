# 📋 Rapor Digital - Sistem Informasi Rapor Madrasah

Aplikasi web untuk mengelola data rapor siswa madrasah dengan sistem berbasis **Rombongan Belajar (Rombel)**.

## ✨ Fitur Utama

- 🏫 **Manajemen Rombel** - Kelola rombongan belajar dengan daftar mata pelajaran
- 👥 **Multi-User & Role** - Admin, Wali Kelas, dan Guru Mapel
- 👤 **Data Siswa** - Input data siswa per rombel
- 📊 **Rekap Nilai** - Input dan kelola nilai siswa
- 🏆 **Ekstrakurikuler** - Catat kegiatan ekskul siswa
- 📌 **KKM** - Atur Kriteria Ketuntasan Minimal per mata pelajaran
- 🖨️ **Cetak Rapor** - Generate rapor dalam format A4 siap cetak
- 📤 **Upload Excel** - Import data siswa dan nilai dari file Excel
- 🔐 **Autentikasi** - Login dengan username dan password

## 🏗️ Arsitektur Sistem

### Frontend
- **HTML5** + **CSS3** + **Vanilla JavaScript**
- **SheetJS (xlsx)** - Untuk baca/tulis file Excel
- Responsive design untuk desktop dan tablet

### Backend
- **Google Apps Script** - Serverless backend
- **Google Sheets** - Database
- RESTful API dengan autentikasi token

## 📊 Struktur Data

### Rombel (Rombongan Belajar)
Rombel adalah unit organisasi utama yang berisi:
- ID dan nama rombel
- Wali kelas yang ditugaskan
- Daftar mata pelajaran

### User Roles
1. **Admin** - Akses penuh ke semua fitur
2. **Wali Kelas** - Kelola 1 rombel yang ditugaskan
3. **Guru Mapel** - Kelola nilai di beberapa rombel

### Data Per Rombel
- Data Siswa (NISN, nama, tempat/tanggal lahir, dll)
- Nilai mata pelajaran
- KKM per mata pelajaran
- Ekstrakurikuler
- Kehadiran (sakit, ijin, alpa)

## 🚀 Cara Setup

### 1. Setup Backend (Google Apps Script)

1. Buat Google Spreadsheet baru
2. Buka **Extensions → Apps Script**
3. Hapus kode default, copy-paste kode dari `gas/Code.gs`
4. Save (Ctrl+S)
5. Jalankan fungsi `setupSheets()` **SEKALI**
6. **Deploy → New Deployment → Web App**
   - Execute as: **Me**
   - Who has access: **Anyone**
7. Copy URL Web App

### 2. Setup Frontend

1. Clone repository ini
2. Buka file `js/api.js`
3. Paste URL Web App ke konstanta `GAS_URL`:
   ```javascript
   const GAS_URL = 'https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec';
   ```
4. Commit dan push ke GitHub
5. Deploy ke GitHub Pages atau hosting lainnya

### 3. Login Pertama Kali

- **Username:** `admin`
- **Password:** `admin123`

⚠️ **PENTING:** Segera ganti password admin setelah login pertama!

## 📖 Panduan Penggunaan

### Untuk Admin

1. **Kelola Rombel**
   - Buat rombel baru (contoh: "Kelas 1", "Kelas 2")
   - Tentukan daftar mata pelajaran untuk setiap rombel
   - Assign wali kelas ke rombel

2. **Kelola User**
   - Buat user baru (Wali Kelas atau Guru Mapel)
   - Assign rombel ke guru mapel (bisa lebih dari 1)

3. **Setting Global**
   - Atur nama madrasah, kepala madrasah
   - Atur semester dan tahun pelajaran
   - Upload logo/KOP rapor

### Untuk Wali Kelas

1. **Data Siswa**
   - Input data siswa satu per satu
   - Atau upload dari file Excel (download template terlebih dahulu)

2. **Input Nilai**
   - Isi nilai untuk setiap mata pelajaran
   - Isi kehadiran (sakit, ijin, alpa)

3. **Ekstrakurikuler**
   - Tambah kegiatan ekskul
   - Beri nilai untuk setiap siswa

4. **KKM**
   - Atur KKM untuk setiap mata pelajaran

5. **Cetak Rapor**
   - Pilih siswa
   - Preview rapor
   - Print atau save as PDF

### Untuk Guru Mapel

1. **Input Nilai**
   - Pilih rombel yang ditugaskan
   - Isi nilai mata pelajaran yang diampu

## 📁 Struktur File

```
rapor-digital/
├── index.html              # Halaman utama
├── css/
│   ├── style.css          # Styling utama
│   └── print.css          # Styling untuk print rapor
├── js/
│   ├── api.js             # API layer & konfigurasi URL
│   ├── app.js             # Core aplikasi
│   ├── auth.js            # Autentikasi & login
│   ├── admin.js           # Panel admin (rombel & user)
│   ├── setting.js         # Setting global
│   ├── siswa.js           # Manajemen data siswa
│   ├── nilai.js           # Input nilai
│   ├── ekskul.js          # Ekstrakurikuler
│   ├── kkm.js             # KKM
│   ├── cetak.js           # Generate rapor
│   └── upload.js          # Upload Excel
├── gas/
│   └── Code.gs            # Backend Google Apps Script
└── README.md              # Dokumentasi ini
```

## 🔧 Konfigurasi

### URL Apps Script
Edit file `js/api.js`:
```javascript
const GAS_URL = 'https://script.google.com/macros/s/YOUR_ID/exec';
```

### Mata Pelajaran Default
Edit file `js/admin.js` untuk mengubah daftar mata pelajaran:
```javascript
const MAPEL_UTAMA = [
  'Al-Qur\'an Hadits', 'Aqidah Akhlak', 'Fiqih', 'Bahasa Arab',
  'PPKn', 'Bahasa Indonesia', 'Matematika', 'SBdP', 'PJOK',
  'IPA', 'IPS', 'Sejarah Kebudayaan Islam'
];
const MAPEL_MULOK = ['Bahasa Daerah', 'Bahasa Inggris', 'Pego'];
```

## 📤 Format Upload Excel

### Template Siswa
Kolom yang diperlukan:
- NISN
- No Induk
- Nama Siswa (wajib)
- Nama Panggilan
- Tempat Lahir
- Tanggal Lahir (format: YYYY-MM-DD)
- Nama Orang Tua
- Pesan Wali Kelas

### Template Nilai
Kolom yang diperlukan:
- Nama Siswa (wajib, harus sama dengan data siswa)
- [Mata Pelajaran 1]
- [Mata Pelajaran 2]
- ...
- Sakit
- Ijin
- Alpa

💡 **Tip:** Download template dari aplikasi untuk memastikan format yang benar.

## 🔒 Keamanan

- ✅ Autentikasi berbasis token
- ✅ Role-based access control
- ✅ Password minimal 6 karakter
- ✅ Session management
- ⚠️ **Ganti password default admin setelah setup**
- ⚠️ **Jangan share URL deployment ke publik**

## 🐛 Troubleshooting

### "URL Apps Script belum diset"
- Pastikan `GAS_URL` di `js/api.js` sudah diisi dengan URL deployment yang benar

### "Akses ditolak"
- Logout dan login ulang
- Pastikan user sudah di-assign ke rombel yang benar

### Data tidak muncul
- Cek koneksi internet
- Cek console browser (F12) untuk error
- Pastikan backend sudah di-deploy dengan benar

### Upload Excel gagal
- Pastikan format file sesuai template
- Pastikan kolom wajib sudah diisi
- Pastikan nama siswa tidak duplikat

## 📝 Changelog

### v2.0.0 (2026-04-28)
- ♻️ Refactor: Hapus konsep "Kelas", gunakan "Rombel" sebagai unit utama
- ✨ Wali kelas langsung di-assign di Rombel
- ✨ Guru mapel bisa mengajar di beberapa rombel
- 🐛 Fix: Template Excel menampilkan info rombel tujuan
- 🐛 Fix: Rapor menampilkan nama rombel

### v1.0.0
- 🎉 Rilis awal
- ✨ Manajemen kelas dan rombel
- ✨ Multi-user dengan role
- ✨ Input nilai dan cetak rapor

## 📄 Lisensi

MIT License - Bebas digunakan untuk keperluan pendidikan

## 🤝 Kontribusi

Kontribusi sangat diterima! Silakan buat issue atau pull request.

## 📞 Dukungan

Jika ada pertanyaan atau masalah, silakan buat issue di repository ini.

---

Dibuat dengan ❤️ untuk pendidikan Indonesia
