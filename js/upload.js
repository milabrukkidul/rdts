// ===== UPLOAD & DOWNLOAD EXCEL (SheetJS) =====
// Membutuhkan: https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js

// ─── HELPER: Render tabel preview ──────────────────────────
function renderPreviewTable(headers, rows, maxRows = 6) {
  if (!rows.length) return '<p style="color:#888;font-size:0.85rem;">Tidak ada data.</p>';
  let html = `<div style="overflow-x:auto;max-height:200px;overflow-y:auto;border:1px solid #e5e7eb;border-radius:6px;">
    <table style="font-size:0.78rem;width:100%;border-collapse:collapse;">
      <thead><tr style="background:#1e3a5f;color:#fff;position:sticky;top:0;">`;
  headers.forEach(h => html += `<th style="padding:5px 8px;white-space:nowrap;">${h}</th>`);
  html += `</tr></thead><tbody>`;
  rows.slice(0, maxRows).forEach((r, i) => {
    html += `<tr style="background:${i%2===0?'#fff':'#f8fafc'}">`;
    r.forEach(c => html += `<td style="padding:3px 8px;border-bottom:1px solid #e5e7eb;">${c ?? ''}</td>`);
    html += '</tr>';
  });
  if (rows.length > maxRows) {
    html += `<tr><td colspan="${headers.length}" style="text-align:center;padding:5px;color:#888;font-size:0.78rem;font-style:italic;">
      ... dan ${rows.length - maxRows} baris lainnya</td></tr>`;
  }
  html += `</tbody></table></div>
  <p style="font-size:0.82rem;color:#16a34a;margin-top:6px;font-weight:600;">✅ ${rows.length} baris siap diimport.</p>`;
  return html;
}

// ─── HELPER: Konversi serial date Excel → string YYYY-MM-DD ─
function excelDateToString(val) {
  if (!val && val !== 0) return '';
  // Jika sudah string (misal "2010-05-17" atau "17/05/2010")
  if (typeof val === 'string') {
    // Coba parse berbagai format
    const s = val.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s; // sudah YYYY-MM-DD
    // Format DD/MM/YYYY
    const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (m) return `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;
    return s;
  }
  // Jika number (serial date Excel)
  if (typeof val === 'number') {
    const d = XLSX.SSF.parse_date_code(val);
    if (d) {
      const mm = String(d.m).padStart(2,'0');
      const dd = String(d.d).padStart(2,'0');
      return `${d.y}-${mm}-${dd}`;
    }
  }
  // Jika Date object
  if (val instanceof Date) {
    const mm = String(val.getMonth()+1).padStart(2,'0');
    const dd = String(val.getDate()).padStart(2,'0');
    return `${val.getFullYear()}-${mm}-${dd}`;
  }
  return String(val);
}

// ─── HELPER: Buat workbook dengan styling header ────────────
function buatWorkbook(sheetName, headers, rows, kolomLebar) {
  const wb = XLSX.utils.book_new();
  const wsData = [headers, ...rows];
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Lebar kolom otomatis
  ws['!cols'] = (kolomLebar || headers.map(() => ({ wch: 18 }))).map(w =>
    typeof w === 'number' ? { wch: w } : w
  );

  // Style header (baris pertama) — warna biru tua, teks putih, bold
  const range = XLSX.utils.decode_range(ws['!ref']);
  for (let C = range.s.c; C <= range.e.c; C++) {
    const addr = XLSX.utils.encode_cell({ r: 0, c: C });
    if (!ws[addr]) continue;
    ws[addr].s = {
      font:      { bold: true, color: { rgb: 'FFFFFF' } },
      fill:      { fgColor: { rgb: '1E3A5F' } },
      alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
      border: {
        top:    { style: 'thin', color: { rgb: '000000' } },
        bottom: { style: 'thin', color: { rgb: '000000' } },
        left:   { style: 'thin', color: { rgb: '000000' } },
        right:  { style: 'thin', color: { rgb: '000000' } },
      }
    };
  }

  // Style baris data — border tipis, alternating color
  for (let R = 1; R <= range.e.r; R++) {
    const bg = R % 2 === 0 ? 'EFF6FF' : 'FFFFFF';
    for (let C = range.s.c; C <= range.e.c; C++) {
      const addr = XLSX.utils.encode_cell({ r: R, c: C });
      if (!ws[addr]) ws[addr] = { t: 's', v: '' };
      ws[addr].s = {
        fill:   { fgColor: { rgb: bg } },
        border: {
          top:    { style: 'thin', color: { rgb: 'D1D5DB' } },
          bottom: { style: 'thin', color: { rgb: 'D1D5DB' } },
          left:   { style: 'thin', color: { rgb: 'D1D5DB' } },
          right:  { style: 'thin', color: { rgb: 'D1D5DB' } },
        },
        alignment: { vertical: 'center' }
      };
    }
  }

  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  return wb;
}

// ─── HELPER: Unduh workbook ─────────────────────────────────
function unduhExcel(wb, filename) {
  XLSX.writeFile(wb, filename, { bookType: 'xlsx', type: 'binary', cellStyles: true });
}

// ─── HELPER: Baca file Excel → array of arrays ──────────────
function bacaExcel(file, callback) {
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const wb   = XLSX.read(e.target.result, { type: 'array', cellDates: false, raw: false });
      const ws   = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
      callback(null, rows);
    } catch(err) {
      callback(err, null);
    }
  };
  reader.readAsArrayBuffer(file);
}

// ═══════════════════════════════════════════════════════════
// TEMPLATE & UPLOAD SISWA
// ═══════════════════════════════════════════════════════════

function downloadTemplateSiswa() {
  const rombelId = getActiveRombelId('siswa');
  if (!rombelId) {
    showToast('Pilih rombel terlebih dahulu sebelum download template!', 'error');
    return;
  }

  const headers = [
    'NISN', 'No Induk', 'Nama Siswa', 'Nama Panggilan',
    'Tempat Lahir', 'Tanggal Lahir (YYYY-MM-DD)',
    'Nama Orang Tua'
  ];
  const contoh = [
    ['1234567890', '001', 'Ahmad Fauzi',   'Fauzi', 'Jakarta',  '2010-05-17', 'Budi Santoso' ],
    ['0987654321', '002', 'Siti Rahayu',   'Siti',  'Bandung',  '2010-08-23', 'Hendra Wijaya'],
    ['1122334455', '003', 'Budi Prasetyo', 'Budi',  'Surabaya', '2010-11-01', 'Agus Wibowo'  ],
  ];
  const lebar = [14, 10, 22, 14, 14, 22, 22];
  const wb = buatWorkbook('DATA SISWA', headers, contoh, lebar);

  // Tambah sheet petunjuk dengan info rombel
  const petunjukData = [
    ['PETUNJUK PENGISIAN DATA SISWA'],
    [''],
    [`ROMBEL TUJUAN: ${rombelId}`],
    [''],
    ['PENTING:'],
    ['• Data siswa akan diimport ke rombel yang dipilih saat ini'],
    ['• Pastikan Anda memilih rombel yang benar sebelum upload'],
    ['• Jika ingin upload ke rombel lain, pilih rombel tersebut terlebih dahulu'],
    [''],
    ['CARA PENGISIAN:'],
    ['1. Isi data siswa pada sheet "DATA SISWA"'],
    ['2. Tanggal Lahir gunakan format YYYY-MM-DD (contoh: 2010-05-17)'],
    ['3. Jangan mengubah nama kolom di baris pertama'],
    ['4. Jangan menambah/menghapus kolom'],
    ['5. Simpan sebagai .xlsx lalu upload'],
    [''],
    ['KOLOM WAJIB:'],
    ['• Nama Siswa (kolom C) - WAJIB diisi'],
    [''],
    ['KOLOM OPSIONAL:'],
    ['• NISN, No Induk, Nama Panggilan, Tempat Lahir, Tanggal Lahir,'],
    ['  Nama Orang Tua - boleh dikosongkan'],
  ];
  const wsPetunjuk = XLSX.utils.aoa_to_sheet(petunjukData);
  wsPetunjuk['!cols'] = [{ wch: 70 }];
  
  // Style untuk judul dan info rombel
  if (wsPetunjuk['A1']) {
    wsPetunjuk['A1'].s = {
      font: { bold: true, sz: 14, color: { rgb: '1E3A5F' } },
      alignment: { horizontal: 'left', vertical: 'center' }
    };
  }
  if (wsPetunjuk['A3']) {
    wsPetunjuk['A3'].s = {
      font: { bold: true, sz: 12, color: { rgb: 'DC2626' } },
      fill: { fgColor: { rgb: 'FEF2F2' } },
      alignment: { horizontal: 'left', vertical: 'center' }
    };
  }

  XLSX.utils.book_append_sheet(wb, wsPetunjuk, 'PETUNJUK');

  unduhExcel(wb, `template_siswa_${rombelId}.xlsx`);
  showToast(`Template siswa untuk rombel ${rombelId} diunduh!`, 'success');
}

let xlsSiswaParsed = [];

function showModalUploadSiswa() {
  const rombelId = getActiveRombelId('siswa');
  if (!rombelId) {
    showToast('Pilih rombel terlebih dahulu sebelum upload!', 'error');
    return;
  }

  xlsSiswaParsed = [];
  document.getElementById('xlsSiswaFile').value = '';
  document.getElementById('xlsSiswaPreview').innerHTML = '';
  document.getElementById('btnImportSiswa').disabled = true;
  
  // Tampilkan info rombel tujuan
  const infoRombel = document.getElementById('uploadSiswaRombelInfo');
  if (infoRombel) {
    infoRombel.textContent = `Rombel Tujuan: ${rombelId}`;
    infoRombel.style.display = 'block';
  }
  
  document.getElementById('modalUploadSiswa').classList.remove('hidden');
}

function previewXlsSiswa() {
  const file = document.getElementById('xlsSiswaFile').files[0];
  if (!file) { showToast('Pilih file Excel terlebih dahulu!', 'error'); return; }

  bacaExcel(file, (err, rows) => {
    if (err || rows.length < 2) {
      document.getElementById('xlsSiswaPreview').innerHTML =
        '<p style="color:#dc2626;">File tidak valid atau kosong.</p>';
      return;
    }
    const header = rows[0].map(String);
    const data   = rows.slice(1).filter(r => r[2]); // kolom 2 = Nama Siswa

    xlsSiswaParsed = data.map(r => ({
      nisn:        String(r[0] ?? ''),
      noInduk:     String(r[1] ?? ''),
      nama:        String(r[2] ?? ''),
      panggilan:   String(r[3] ?? ''),
      tempatLahir: String(r[4] ?? ''),
      tglLahir:    excelDateToString(r[5]),
      namaOrtu:    String(r[6] ?? ''),
    })).filter(s => s.nama.trim());

    document.getElementById('xlsSiswaPreview').innerHTML =
      renderPreviewTable(header, data.map(r => r.map(c => c ?? '')));
    document.getElementById('btnImportSiswa').disabled = xlsSiswaParsed.length === 0;
  });
}

async function importXlsSiswa() {
  if (!xlsSiswaParsed.length) return;
  const rombelId = getActiveRombelId('siswa');
  if (!rombelId) { showToast('Pilih rombel terlebih dahulu!', 'error'); return; }
  try {
    await API.post('importSiswa', { kelasId: rombelId, siswaList: JSON.stringify(xlsSiswaParsed) });
    closeModal('modalUploadSiswa');
    showToast(`${xlsSiswaParsed.length} siswa berhasil diimport!`, 'success');
    await loadSiswa();
  } catch(e) {}
}

// ═══════════════════════════════════════════════════════════
// TEMPLATE & UPLOAD NILAI
// ═══════════════════════════════════════════════════════════

// Helper: ambil daftar mapel yang boleh diedit user saat ini
function getMapelBolehEdit() {
  const mapelSemua  = nilaiData.mapel || [];
  const mapelGuru   = nilaiData.mapelGuru || {};
  const role        = currentUser?.role;
  const username    = currentUser?.username;

  if (role === 'admin' || role === 'walikelas') return mapelSemua;
  // guruMapel: hanya mapel yang di-assign ke username ini
  return mapelSemua.filter(m => mapelGuru[m] === username);
}

function downloadTemplateNilai() {
  // Siswa tersedia di nilaiData.siswa (halaman nilai) atau siswaCacheList (halaman siswa)
  const siswa = (nilaiData.siswa && nilaiData.siswa.length) ? nilaiData.siswa : siswaCacheList;

  if (!siswa.length) {
    showToast('Muat data nilai terlebih dahulu!', 'error');
    return;
  }

  const role           = currentUser?.role;
  const isWaliOrAdmin  = role === 'admin' || role === 'walikelas';
  const mapelBoleh     = getMapelBolehEdit();

  if (!mapelBoleh.length) {
    showToast('Anda tidak memiliki mapel yang bisa diisi.', 'error');
    return;
  }

  // Header: Nama Siswa + mapel yang boleh + (Sakit/Ijin/Alpa hanya wali/admin)
  const headers = isWaliOrAdmin
    ? ['Nama Siswa', ...mapelBoleh, 'Sakit', 'Ijin', 'Alpa']
    : ['Nama Siswa', ...mapelBoleh];

  // Isi baris dengan nilai yang sudah ada (agar tidak perlu isi ulang dari nol)
  const mapelSemua = nilaiData.mapel || [];
  const rows = siswa.map((s, si) => {
    const nilaiSiswa = nilaiData.nilai[si] || {};
    const row = [s.nama];
    mapelBoleh.forEach(m => {
      const mi = mapelSemua.indexOf(m);
      row.push(mi >= 0 && nilaiSiswa[mi] !== undefined ? nilaiSiswa[mi] : '');
    });
    if (isWaliOrAdmin) {
      row.push(nilaiSiswa['sakit'] || '', nilaiSiswa['ijin'] || '', nilaiSiswa['alpa'] || '');
    }
    return row;
  });

  const lebar = [24, ...mapelBoleh.map(() => 10), ...(isWaliOrAdmin ? [8, 8, 8] : [])];
  const wb = buatWorkbook('REKAP NILAI', headers, rows, lebar);

  // Sheet petunjuk
  const rombelId = getActiveRombelId('nilai');
  const petunjukData = [
    ['PETUNJUK PENGISIAN REKAP NILAI'],
    [''],
    [`Rombel : ${rombelId}`],
    [`Diisi oleh : ${currentUser?.nama || currentUser?.username} (${role})`],
    [''],
    ['1. Isi nilai pada kolom mata pelajaran (0-100)'],
    ...(isWaliOrAdmin ? [['2. Isi Sakit, Ijin, Alpa dengan jumlah hari']] : []),
    ['3. Jangan mengubah nama siswa di kolom pertama'],
    ['4. Jangan menambah/menghapus kolom'],
    ['5. Simpan sebagai .xlsx lalu upload'],
    [''],
    ['KOLOM YANG BISA DIISI:'],
    ...mapelBoleh.map(m => [`• ${m}`]),
    ...(isWaliOrAdmin ? [['• Sakit, Ijin, Alpa']] : []),
  ];
  const wsPetunjuk = XLSX.utils.aoa_to_sheet(petunjukData);
  wsPetunjuk['!cols'] = [{ wch: 55 }];
  XLSX.utils.book_append_sheet(wb, wsPetunjuk, 'PETUNJUK');

  unduhExcel(wb, `template_nilai_${rombelId}_${currentUser?.username || 'user'}.xlsx`);
  showToast('Template nilai diunduh!', 'success');
}

let xlsNilaiParsed = { mapel: [], nilai: [] };

function showModalUploadNilai() {
  xlsNilaiParsed = { mapel: [], nilai: [] };
  document.getElementById('xlsNilaiFile').value = '';
  document.getElementById('xlsNilaiPreview').innerHTML = '';
  document.getElementById('btnImportNilai').disabled = true;
  document.getElementById('modalUploadNilai').classList.remove('hidden');
}

function previewXlsNilai() {
  const file = document.getElementById('xlsNilaiFile').files[0];
  if (!file) { showToast('Pilih file Excel terlebih dahulu!', 'error'); return; }

  bacaExcel(file, (err, rows) => {
    if (err || rows.length < 2) {
      document.getElementById('xlsNilaiPreview').innerHTML =
        '<p style="color:#dc2626;">File tidak valid atau kosong.</p>';
      return;
    }
    const header = rows[0].map(String);

    // Validasi: kolom pertama harus "Nama Siswa", bukan template siswa (NISN)
    const kolomPertama = (header[0] || '').trim().toLowerCase();
    if (kolomPertama !== 'nama siswa') {
      document.getElementById('xlsNilaiPreview').innerHTML =
        `<p style="color:#dc2626;font-weight:600;">
          ❌ File tidak sesuai. Kolom pertama harus <strong>Nama Siswa</strong>, 
          bukan "<strong>${header[0]}</strong>".<br/>
          Pastikan Anda menggunakan template dari tombol 📥 Template .xlsx di halaman Rekap Nilai.
        </p>`;
      document.getElementById('btnImportNilai').disabled = true;
      return;
    }
    const data       = rows.slice(1).filter(r => r[0]);
    const mapelBoleh = getMapelBolehEdit();
    const isWaliOrAdmin = currentUser?.role === 'admin' || currentUser?.role === 'walikelas';

    // Deteksi apakah file punya kolom Sakit/Ijin/Alpa (3 kolom terakhir)
    const punya3Akhir = ['sakit','ijin','alpa'].some(k =>
      header[header.length - 3]?.toLowerCase().includes('sakit') ||
      header[header.length - 2]?.toLowerCase().includes('ijin') ||
      header[header.length - 1]?.toLowerCase().includes('alpa')
    );
    const mapelCols  = punya3Akhir ? header.slice(1, header.length - 3) : header.slice(1);

    xlsNilaiParsed.mapel = mapelCols;
    xlsNilaiParsed.nilai = data.map(r => {
      const obj = { _nama: String(r[0] ?? '') };
      mapelCols.forEach((m, mi) => {
        // Hanya simpan nilai untuk mapel yang boleh diedit user ini
        if (mapelBoleh.includes(m)) {
          const v = r[mi + 1];
          obj[mi] = (v !== '' && v !== null && v !== undefined) ? v : '';
        }
        // Mapel yang tidak boleh diedit: tandai sebagai skip
      });
      if (isWaliOrAdmin && punya3Akhir) {
        const base = mapelCols.length;
        obj['sakit'] = Number(r[base + 1]) || 0;
        obj['ijin']  = Number(r[base + 2]) || 0;
        obj['alpa']  = Number(r[base + 3]) || 0;
      }
      return obj;
    });

    // Validasi: cek apakah ada kolom yang tidak dikenali
    const mapelTidakBoleh = mapelCols.filter(m => !mapelBoleh.includes(m));
    let warningHtml = '';
    if (mapelTidakBoleh.length) {
      warningHtml = `<p style="color:#d97706;font-size:0.82rem;margin-top:6px;">
        ⚠️ Kolom berikut tidak akan diimport (bukan mapel Anda): 
        <strong>${mapelTidakBoleh.join(', ')}</strong>
      </p>`;
    }

    document.getElementById('xlsNilaiPreview').innerHTML =
      renderPreviewTable(header, data.map(r => r.map(c => c ?? ''))) + warningHtml;
    document.getElementById('btnImportNilai').disabled = xlsNilaiParsed.nilai.length === 0;
  });
}

async function importXlsNilai() {
  if (!xlsNilaiParsed.nilai.length) return;
  const rombelId = getActiveRombelId('nilai');
  if (!rombelId) { showToast('Pilih rombel terlebih dahulu!', 'error'); return; }

  const siswa = (nilaiData.siswa && nilaiData.siswa.length) ? nilaiData.siswa : siswaCacheList;
  if (!siswa.length) {
    showToast('Muat data nilai terlebih dahulu!', 'error');
    return;
  }

  const mapelBoleh  = getMapelBolehEdit();
  const mapelSemua  = nilaiData.mapel || [];
  const mapelCols   = xlsNilaiParsed.mapel;

  // Cocokkan berdasarkan nama (case-insensitive, trim)
  const nilaiByNama = {};
  xlsNilaiParsed.nilai.forEach(n => {
    nilaiByNama[n._nama.trim().toLowerCase()] = n;
  });

  // Merge: ambil nilai lama, timpa hanya kolom yang boleh diedit
  const nilaiMapped = siswa.map((s, si) => {
    const fromFile  = nilaiByNama[s.nama.trim().toLowerCase()] || {};
    const nilaiLama = nilaiData.nilai[si] || {};
    const merged    = Object.assign({}, nilaiLama); // mulai dari nilai lama

    mapelSemua.forEach((m, mi) => {
      if (!mapelBoleh.includes(m)) return; // skip mapel yang bukan milik user
      const idxFile = mapelCols.indexOf(m);
      if (idxFile >= 0 && fromFile[idxFile] !== undefined) {
        merged[mi] = fromFile[idxFile];
      }
    });

    // Sakit/ijin/alpa hanya wali/admin
    const isWaliOrAdmin = currentUser?.role === 'admin' || currentUser?.role === 'walikelas';
    if (isWaliOrAdmin) {
      if (fromFile['sakit'] !== undefined) merged['sakit'] = fromFile['sakit'];
      if (fromFile['ijin']  !== undefined) merged['ijin']  = fromFile['ijin'];
      if (fromFile['alpa']  !== undefined) merged['alpa']  = fromFile['alpa'];
    }
    return merged;
  });

  // Update nilaiData di memori dengan hasil merge
  nilaiData.nilai = nilaiMapped;

  try {
    await API.post('saveNilai', {
      kelasId: rombelId,
      mapel:   JSON.stringify(nilaiData.mapel),
      nilai:   JSON.stringify(nilaiData.nilai)
    });
    closeModal('modalUploadNilai');
    showToast(`Nilai ${xlsNilaiParsed.nilai.length} siswa berhasil diimport!`, 'success');
    await loadNilai();
  } catch(e) {}
}
