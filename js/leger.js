// ===== CETAK LEGER (Daftar Nilai per Rombel) =====

let legerCache = {};

async function loadLegerData() {
  const rombelId = getActiveRombelId('leger');
  if (!rombelId) { 
    showToast('Pilih rombel terlebih dahulu!', 'error'); 
    return; 
  }
  try {
    const isAdmin = currentUser && currentUser.role === 'admin';
    
    let settingRes, siswaRes, nilaiRes, kkmRes, rombelRes;
    
    if (isAdmin) {
      // Admin: ambil semua data termasuk KKM
      [settingRes, siswaRes, nilaiRes, kkmRes, rombelRes] = await Promise.all([
        API.call('getSetting'),
        API.call('getSiswa',   { kelasId: rombelId }),
        API.call('getNilai',   { kelasId: rombelId }),
        API.call('getKKM',     { kelasId: rombelId }),
        API.call('getRombel'),
      ]);
      if (kkmRes.error) { showToast('Error getKKM: ' + kkmRes.error, 'error'); return; }
    } else {
      // Wali kelas: ambil semua data kecuali KKM
      [settingRes, siswaRes, nilaiRes, rombelRes] = await Promise.all([
        API.call('getSetting'),
        API.call('getSiswa',   { kelasId: rombelId }),
        API.call('getNilai',   { kelasId: rombelId }),
        API.call('getRombel'),
      ]);
      kkmRes = { kkm: {} }; // KKM kosong untuk wali kelas (akan pakai default 70)
    }

    // Cek error dari setiap response
    if (settingRes.error) { showToast('Error getSetting: ' + settingRes.error, 'error'); return; }
    if (siswaRes.error) { showToast('Error getSiswa: ' + siswaRes.error, 'error'); return; }
    if (nilaiRes.error) { showToast('Error getNilai: ' + nilaiRes.error, 'error'); return; }
    if (rombelRes.error) { showToast('Error getRombel: ' + rombelRes.error, 'error'); return; }

    // Cari data rombel yang sesuai dengan rombelId user
    const rombelList = rombelRes.rombel || [];
    const rombelInfo = rombelList.find(r => r.id === rombelId) || {};

    legerCache = {
      setting:    settingRes.setting  || {},
      siswa:      siswaRes.siswa      || [],
      mapel:      nilaiRes.mapel      || [],
      nilai:      nilaiRes.nilai      || [],
      kkm:        kkmRes.kkm          || {},
      namaRombel: rombelInfo.nama ? `${rombelInfo.nama} (${rombelInfo.id})` : rombelId,
      namaWali:   rombelInfo.waliNama || rombelInfo.wali || '',
    };
    
    renderLeger();
    showToast('Data leger dimuat!', 'success');
  } catch(e) {
    showToast('Error memuat data: ' + e.message, 'error');
    console.error('Error loadLegerData:', e);
  }
}

// Auto-load data saat halaman leger dibuka
function initLegerPage() {
  if (currentUser && currentUser.role === 'walikelas') {
    // Auto-load data untuk wali kelas
    loadLegerData();
  } else if (currentUser && currentUser.role === 'admin') {
    // Admin: auto-load jika sudah ada rombel yang dipilih
    const rombelId = getActiveRombelId('leger');
    if (rombelId) {
      loadLegerData();
    }
  }
}

function renderLeger() {
  const { setting, siswa, mapel, nilai, kkm, namaRombel, namaWali } = legerCache;
  
  if (!siswa.length) {
    document.getElementById('legerPreview').innerHTML = 
      '<p class="hint">Belum ada data siswa untuk rombel ini.</p>';
    return;
  }

  // ===== KOP =====
  let kopHtml = '';
  if (setting.urlKop) {
    kopHtml = `<img src="${setting.urlKop}" class="leger-kop-img" alt="KOP"
      onerror="this.style.display='none';this.nextElementSibling.style.display='block'"/>
      <div class="leger-kop-text" style="display:none;">
        <h2>${setting.namaSatuan || ''}</h2>
      </div>`;
  } else {
    kopHtml = `<div class="leger-kop-text">
      <h2>${setting.namaSatuan || 'NAMA SATUAN PENDIDIKAN'}</h2>
    </div>`;
  }

  // ===== HEADER INFO =====
  const headerInfo = `
    <div class="leger-header-info">
      <div class="leger-info-left">
        <div class="leger-info-row">
          <span class="leger-info-label">Rombel</span>
          <span class="leger-info-colon">:</span>
          <span class="leger-info-value">${namaRombel}</span>
        </div>
        <div class="leger-info-row">
          <span class="leger-info-label">Wali Kelas</span>
          <span class="leger-info-colon">:</span>
          <span class="leger-info-value">${namaWali || '-'}</span>
        </div>
      </div>
      <div class="leger-info-right">
        <div class="leger-info-row">
          <span class="leger-info-label">Semester</span>
          <span class="leger-info-colon">:</span>
          <span class="leger-info-value">${setting.semester || '-'}</span>
        </div>
        <div class="leger-info-row">
          <span class="leger-info-label">Tahun Pelajaran</span>
          <span class="leger-info-colon">:</span>
          <span class="leger-info-value">${setting.tahunPelajaran || '-'}</span>
        </div>
      </div>
    </div>
  `;

  // ===== TABEL NILAI =====
  // Header kolom: No, Nama Siswa, [Mata Pelajaran...], Jumlah, Rata-rata, Rangking
  let headerCols = '<th style="width:30px;">No</th><th style="min-width:140px;">Nama Siswa</th>';
  mapel.forEach(m => {
    headerCols += `<th style="min-width:45px;writing-mode:vertical-rl;text-orientation:mixed;height:100px;font-size:7pt;">${m}</th>`;
  });
  headerCols += '<th style="width:50px;">Jml</th><th style="width:50px;">Rata</th><th style="width:50px;">Rank</th>';

  // Hitung jumlah dan rata-rata untuk setiap siswa
  const siswaStats = siswa.map((s, si) => {
    const nilaiSiswa = nilai[si] || {};
    let jumlah = 0;
    let count = 0;
    mapel.forEach((m, mi) => {
      const v = nilaiSiswa[mi];
      if (v !== undefined && v !== '' && !isNaN(v)) {
        jumlah += parseFloat(v);
        count++;
      }
    });
    const rata = count > 0 ? (jumlah / count).toFixed(2) : '-';
    return { siswa: s, jumlah, rata, nilaiSiswa };
  });

  // Hitung rangking berdasarkan jumlah nilai
  const sorted = [...siswaStats].sort((a, b) => b.jumlah - a.jumlah);
  const rankMap = {};
  sorted.forEach((item, idx) => {
    const nama = item.siswa.nama;
    // Cari indeks asli siswa ini
    const originalIdx = siswaStats.findIndex(ss => ss.siswa.nama === nama);
    rankMap[originalIdx] = idx + 1;
  });

  // Buat baris tabel
  let bodyRows = '';
  siswaStats.forEach((stat, si) => {
    const s = stat.siswa;
    const nilaiSiswa = stat.nilaiSiswa;
    let row = `<tr>
      <td style="text-align:center;">${si + 1}</td>
      <td>${s.nama || ''}</td>`;
    
    mapel.forEach((m, mi) => {
      const kkmVal = kkm[m] !== undefined ? kkm[m] : 70;
      const v = nilaiSiswa[mi];
      const nilaiStr = (v !== undefined && v !== '') ? v : '-';
      const predikat = (v !== undefined && v !== '' && !isNaN(v)) ? hitungPredikat(v, kkmVal) : '-';
      const predClass = predikat !== '-' ? `predikat-${predikat}` : '';
      row += `<td style="text-align:center;" class="${predClass}">${nilaiStr}</td>`;
    });
    
    row += `<td style="text-align:center;font-weight:bold;">${stat.jumlah || '-'}</td>`;
    row += `<td style="text-align:center;font-weight:bold;">${stat.rata}</td>`;
    row += `<td style="text-align:center;font-weight:bold;">${rankMap[si] || '-'}</td>`;
    row += '</tr>';
    bodyRows += row;
  });

  const html = `
  <div class="leger-page">
    ${kopHtml}
    <hr class="leger-divider"/>
    
    <div class="leger-judul">
      <h3>LEGER NILAI</h3>
    </div>

    ${headerInfo}

    <div class="leger-table-wrapper">
      <table class="leger-table">
        <thead>
          <tr>${headerCols}</tr>
        </thead>
        <tbody>
          ${bodyRows}
        </tbody>
      </table>
    </div>

    <div class="leger-footer">
      <div class="leger-ttd-section">
        <p>${setting.tempatRapor || ''}, ${formatTanggal(setting.tglRapor) || '....................'}</p>
        <p>Wali Kelas</p>
        <div class="leger-ttd-space"></div>
        <p class="leger-ttd-name">
          ${namaWali ? namaWali : '( ................... )'}
        </p>
      </div>
      <div class="leger-ttd-section">
        <p>Mengetahui,</p>
        <p>Kepala Madrasah</p>
        <div class="leger-ttd-space"></div>
        <p class="leger-ttd-name">
          ${setting.namaKepala ? setting.namaKepala : '( ................... )'}
        </p>
      </div>
    </div>
  </div>`;

  document.getElementById('legerPreview').innerHTML = html;
}

function cetakLeger() {
  if (!legerCache.siswa || !legerCache.siswa.length) {
    showToast('Muat data leger terlebih dahulu!', 'error');
    return;
  }
  
  // Add print-leger class to body untuk force landscape
  document.body.classList.add('print-leger');
  document.body.classList.remove('print-rapor');
  
  // Set page style to landscape
  const style = document.createElement('style');
  style.id = 'leger-print-style';
  style.textContent = `
    @page { size: A4 landscape; margin: 5mm 4mm; }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  `;
  document.head.appendChild(style);
  
  window.print();
  
  // Remove class and style setelah print
  setTimeout(() => {
    document.body.classList.remove('print-leger');
    const styleEl = document.getElementById('leger-print-style');
    if (styleEl) styleEl.remove();
  }, 100);
}

// Export leger ke Excel (tanpa tanda tangan)
function exportLegerExcel() {
  if (!legerCache.siswa || !legerCache.siswa.length) {
    showToast('Muat data leger terlebih dahulu!', 'error');
    return;
  }

  const { setting, siswa, mapel, nilai, kkm, namaRombel, namaWali } = legerCache;

  // Header info
  const infoRows = [
    ['LEGER NILAI'],
    [''],
    ['Semester', setting.semester || '-'],
    ['Tahun Pelajaran', setting.tahunPelajaran || '-'],
    ['Rombel', namaRombel],
    ['Wali Kelas', namaWali || '-'],
    [''],
  ];

  // Header kolom tabel
  const headerRow = ['No', 'Nama Siswa'];
  mapel.forEach(m => headerRow.push(m));
  headerRow.push('Jumlah', 'Rata-rata', 'Rangking');

  // Hitung jumlah dan rata-rata untuk setiap siswa
  const siswaStats = siswa.map((s, si) => {
    const nilaiSiswa = nilai[si] || {};
    let jumlah = 0;
    let count = 0;
    mapel.forEach((m, mi) => {
      const v = nilaiSiswa[mi];
      if (v !== undefined && v !== '' && !isNaN(v)) {
        jumlah += parseFloat(v);
        count++;
      }
    });
    const rata = count > 0 ? (jumlah / count).toFixed(2) : '-';
    return { siswa: s, jumlah, rata, nilaiSiswa };
  });

  // Hitung rangking berdasarkan jumlah nilai
  const sorted = [...siswaStats].sort((a, b) => b.jumlah - a.jumlah);
  const rankMap = {};
  sorted.forEach((item, idx) => {
    const nama = item.siswa.nama;
    const originalIdx = siswaStats.findIndex(ss => ss.siswa.nama === nama);
    rankMap[originalIdx] = idx + 1;
  });

  // Data rows
  const dataRows = siswaStats.map((stat, si) => {
    const s = stat.siswa;
    const nilaiSiswa = stat.nilaiSiswa;
    const row = [si + 1, s.nama || ''];
    
    mapel.forEach((m, mi) => {
      const v = nilaiSiswa[mi];
      row.push((v !== undefined && v !== '') ? v : '-');
    });
    
    row.push(stat.jumlah || '-', stat.rata, rankMap[si] || '-');
    return row;
  });

  // Gabungkan semua data
  const allRows = [...infoRows, headerRow, ...dataRows];

  // Buat workbook
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(allRows);

  // Set lebar kolom
  const colWidths = [
    { wch: 5 },  // No
    { wch: 25 }, // Nama Siswa
    ...mapel.map(() => ({ wch: 8 })), // Mapel
    { wch: 10 }, // Jumlah
    { wch: 10 }, // Rata-rata
    { wch: 10 }, // Rangking
  ];
  ws['!cols'] = colWidths;

  // Styling
  const range = XLSX.utils.decode_range(ws['!ref']);
  
  // Style untuk judul (baris 1)
  if (ws['A1']) {
    ws['A1'].s = {
      font: { bold: true, sz: 14, color: { rgb: '1E3A5F' } },
      alignment: { horizontal: 'center', vertical: 'center' }
    };
  }

  // Merge cell untuk judul
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: headerRow.length - 1 } } // Merge judul
  ];

  // Style untuk info (baris 3-6)
  for (let r = 2; r <= 5; r++) {
    for (let c = 0; c < 2; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      if (ws[addr]) {
        ws[addr].s = {
          font: { bold: c === 0 },
          alignment: { horizontal: 'left', vertical: 'center' }
        };
      }
    }
  }

  // Style untuk header tabel (baris 8 = index 7)
  const headerRowIdx = 7;
  for (let c = 0; c < headerRow.length; c++) {
    const addr = XLSX.utils.encode_cell({ r: headerRowIdx, c });
    if (ws[addr]) {
      ws[addr].s = {
        font: { bold: true, color: { rgb: 'FFFFFF' } },
        fill: { fgColor: { rgb: '1E3A5F' } },
        alignment: { horizontal: 'center', vertical: 'center' },
        border: {
          top: { style: 'thin', color: { rgb: '000000' } },
          bottom: { style: 'thin', color: { rgb: '000000' } },
          left: { style: 'thin', color: { rgb: '000000' } },
          right: { style: 'thin', color: { rgb: '000000' } },
        }
      };
    }
  }

  // Style untuk data rows
  for (let r = headerRowIdx + 1; r <= range.e.r; r++) {
    const bg = (r - headerRowIdx) % 2 === 0 ? 'F8FAFC' : 'FFFFFF';
    for (let c = 0; c < headerRow.length; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      if (!ws[addr]) ws[addr] = { t: 's', v: '' };
      ws[addr].s = {
        fill: { fgColor: { rgb: bg } },
        alignment: { horizontal: c === 1 ? 'left' : 'center', vertical: 'center' },
        border: {
          top: { style: 'thin', color: { rgb: 'D1D5DB' } },
          bottom: { style: 'thin', color: { rgb: 'D1D5DB' } },
          left: { style: 'thin', color: { rgb: 'D1D5DB' } },
          right: { style: 'thin', color: { rgb: 'D1D5DB' } },
        }
      };
    }
  }

  XLSX.utils.book_append_sheet(wb, ws, 'LEGER NILAI');

  // Download
  const rombelId = getActiveRombelId('leger') || 'rombel';
  const filename = `leger_${rombelId}_${setting.semester || 'semester'}_${setting.tahunPelajaran || 'tahun'}.xlsx`;
  XLSX.writeFile(wb, filename, { bookType: 'xlsx', type: 'binary', cellStyles: true });
  
  showToast('Leger berhasil di-export ke Excel!', 'success');
}
