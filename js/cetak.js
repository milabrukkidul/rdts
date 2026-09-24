// ===== CETAK RAPOR (per rombel, A4) =====
// namaRombel & namaWali diambil dari data rombel

let cetakCache = {};

async function loadCetakData() {
  const rombelId = getActiveRombelId('cetak');
  if (!rombelId) { 
    showToast('Pilih rombel terlebih dahulu!', 'error'); 
    return; 
  }
  try {
    // Admin: ambil semua data termasuk KKM
    // Wali kelas: ambil semua data kecuali KKM (KKM akan pakai default 70)
    const isAdmin = currentUser && currentUser.role === 'admin';
    
    let settingRes, siswaRes, nilaiRes, kkmRes, ekskulRes, rombelRes;
    
    if (isAdmin) {
      // Admin: ambil semua data termasuk KKM
      [settingRes, siswaRes, nilaiRes, kkmRes, ekskulRes, rombelRes] = await Promise.all([
        API.call('getSetting'),
        API.call('getSiswa',   { kelasId: rombelId }),
        API.call('getNilai',   { kelasId: rombelId }),
        API.call('getKKM',     { kelasId: rombelId }),
        API.call('getEkskul',  { kelasId: rombelId }),
        API.call('getRombel'),
      ]);
      if (kkmRes.error) { showToast('Error getKKM: ' + kkmRes.error, 'error'); return; }
    } else {
      // Wali kelas: ambil semua data kecuali KKM
      [settingRes, siswaRes, nilaiRes, ekskulRes, rombelRes] = await Promise.all([
        API.call('getSetting'),
        API.call('getSiswa',   { kelasId: rombelId }),
        API.call('getNilai',   { kelasId: rombelId }),
        API.call('getEkskul',  { kelasId: rombelId }),
        API.call('getRombel'),
      ]);
      kkmRes = { kkm: {} }; // KKM kosong untuk wali kelas (akan pakai default 70)
    }

    // Cek error dari setiap response
    if (settingRes.error) { showToast('Error getSetting: ' + settingRes.error, 'error'); return; }
    if (siswaRes.error) { showToast('Error getSiswa: ' + siswaRes.error, 'error'); return; }
    if (nilaiRes.error) { showToast('Error getNilai: ' + nilaiRes.error, 'error'); return; }
    if (ekskulRes.error) { showToast('Error getEkskul: ' + ekskulRes.error, 'error'); return; }
    if (rombelRes.error) { showToast('Error getRombel: ' + rombelRes.error, 'error'); return; }

    // Cari data rombel yang sesuai dengan rombelId user
    const rombelList = rombelRes.rombel || [];
    const rombelInfo = rombelList.find(r => r.id === rombelId) || {};

    cetakCache = {
      setting:    settingRes.setting  || {},
      siswa:      siswaRes.siswa      || [],
      mapel:      nilaiRes.mapel      || [],
      nilai:      nilaiRes.nilai      || [],
      kkm:        kkmRes.kkm          || {},
      kegiatan:   ekskulRes.kegiatan  || [],
      ekskul:     ekskulRes.nilai     || [],
      namaRombel: rombelInfo.nama     || rombelId,
      namaWali:   rombelInfo.waliNama || rombelInfo.wali || '',
    };
    populateSiswaSelect();
    showToast('Data rapor dimuat!', 'success');
  } catch(e) {
    showToast('Error memuat data: ' + e.message, 'error');
    console.error('Error loadCetakData:', e);
  }
}

// Auto-load data untuk wali kelas saat halaman cetak dibuka
function initCetakPage() {
  if (currentUser && currentUser.role === 'walikelas') {
    // Auto-load data untuk wali kelas
    loadCetakData();
  } else if (currentUser && currentUser.role === 'admin') {
    // Admin: auto-load jika sudah ada rombel yang dipilih
    const rombelId = getActiveRombelId('cetak');
    if (rombelId) {
      loadCetakData();
    }
  }
}

function populateSiswaSelect() {
  const sel = document.getElementById('selectSiswa');
  sel.innerHTML = '<option value="">-- Pilih Siswa --</option>';
  cetakCache.siswa.forEach((s, i) => {
    const opt = document.createElement('option');
    opt.value = i;
    opt.textContent = `${i+1}. ${s.nama}`;
    sel.appendChild(opt);
  });
}

function renderRapor() {
  const idx = document.getElementById('selectSiswa').value;
  if (idx === '') { document.getElementById('raporPreview').innerHTML = ''; return; }
  const si = parseInt(idx);
  const { setting, siswa, mapel, nilai, kkm, kegiatan, ekskul, namaRombel, namaWali } = cetakCache;
  const s = siswa[si];
  if (!s) return;

  const nilaiSiswa  = nilai[si]  || {};
  const ekskulSiswa = ekskul[si] || {};

  // ===== KOP =====
  let kopHtml = '';
  if (setting.urlKop) {
    kopHtml = `<img src="${setting.urlKop}" class="rapor-kop-img" alt="KOP"
      onerror="this.style.display='none';this.nextElementSibling.style.display='block'"/>
      <div class="rapor-kop-text" style="display:none;">
        <h2>${setting.namaSatuan || ''}</h2>
      </div>`;
  } else {
    kopHtml = `<div class="rapor-kop-text">
      <h2>${setting.namaSatuan || 'NAMA SATUAN PENDIDIKAN'}</h2>
    </div>`;
  }

  // ===== IDENTITAS =====
  const tglFmt = formatTanggal(s.tglLahir);
  const ttl    = [s.tempatLahir, tglFmt].filter(Boolean).join(', ');

  // ===== TABEL NILAI =====
  // Pisahkan mapel utama dan muatan lokal
  // MAPEL_MULOK didefinisikan di admin.js, akses via window atau fallback
  const daftarMulok = (typeof MAPEL_MULOK !== 'undefined' ? MAPEL_MULOK : [
    'Bahasa Daerah', 'Bahasa Inggris', 'Pego'
  ]);

  // Kelompokkan: utama dulu, lalu mulok
  const mapelUtama = mapel.filter(m => !daftarMulok.includes(m));
  const mapelMulok = mapel.filter(m =>  daftarMulok.includes(m));
  const adaMulok   = mapelMulok.length > 0;

  // Buat baris nilai dengan subheader MUATAN LOKAL jika ada
  let nilaiRows = '';
  let noCounter = 1;

  // Fungsi bantu render satu baris nilai
  const buatBaris = (m, mi) => {
    const nVal     = (nilaiSiswa[mi] !== undefined && nilaiSiswa[mi] !== '') ? nilaiSiswa[mi] : '';
    const kkmVal   = kkm[m] !== undefined ? kkm[m] : 70;
    const predikat = nVal !== '' ? hitungPredikat(nVal, kkmVal) : '-';
    const predClass= predikat !== '-' ? `predikat-${predikat}` : '';
    const deskripsi= nVal !== '' ? deskripsiPredikat(predikat, s.panggilan || s.nama, m) : '-';
    return `<tr>
      <td>${noCounter++}</td>
      <td>${m}</td>
      <td>${kkmVal}</td>
      <td>${nVal !== '' ? nVal : '-'}</td>
      <td class="${predClass}">${predikat}</td>
      <td>${deskripsi}</td>
    </tr>`;
  };

  // Render mapel utama
  mapelUtama.forEach(m => {
    const mi = mapel.indexOf(m);
    nilaiRows += buatBaris(m, mi);
  });

  // Render subheader + mapel mulok (hanya jika ada)
  if (adaMulok) {
    nilaiRows += `<tr>
      <td colspan="6" style="background:#e8ecf4;font-weight:bold;font-size:9.5pt;
        font-style:italic;padding:3px 6px;border:1px solid #000;text-align:left;
        border-left:4px solid #1e3a5f;">
        Muatan Lokal
      </td>
    </tr>`;
    mapelMulok.forEach(m => {
      const mi = mapel.indexOf(m);
      nilaiRows += buatBaris(m, mi);
    });
  }

  // ===== HITUNG JUMLAH NILAI & RANGKING =====
  // Jumlah dari semua mapel (utama + mulok)
  let jumlahNilai = 0;
  let adaNilai = false;
  mapel.forEach((_m, mi) => {
    const v = nilaiSiswa[mi] !== undefined && nilaiSiswa[mi] !== '' ? parseFloat(nilaiSiswa[mi]) : null;
    if (v !== null && !isNaN(v)) { jumlahNilai += v; adaNilai = true; }
  });
  const jumlahNilaiStr = adaNilai ? jumlahNilai : '-';

  // Rangking: hitung dari semua siswa di rombel
  const jumlahSemuaSiswa = siswa.map((_ss, ssi) => {
    const nr = nilai[ssi] || {};
    let tot = 0; let ada = false;
    mapel.forEach((_m, mi) => {
      const v = nr[mi] !== undefined && nr[mi] !== '' ? parseFloat(nr[mi]) : null;
      if (v !== null && !isNaN(v)) { tot += v; ada = true; }
    });
    return ada ? tot : -Infinity;
  });
  const sortedJml = [...jumlahSemuaSiswa].sort((a, b) => b - a);
  let rangkingSiswa = '-';
  if (adaNilai) {
    const uniqueSorted = [...new Set(sortedJml.filter(v => v !== -Infinity))].sort((a, b) => b - a);
    rangkingSiswa = uniqueSorted.indexOf(jumlahNilai) + 1;
  }

  // Baris jumlah di bawah tabel nilai (di kolom Nilai), rangking rata tengah di pojok kanan
  const jumlahRow = `<tr style="font-weight:bold;background:#f0fdf4;">
    <td colspan="3" style="text-align:right;font-style:italic;">Jumlah Nilai</td>
    <td style="text-align:center;">${jumlahNilaiStr}</td>
    <td style="text-align:center;"></td>
    <td style="text-align:center;">
      <div style="font-size:8.5pt;font-weight:normal;color:#555;">Rangking</div>
      <div style="font-size:13pt;font-weight:bold;">${rangkingSiswa}</div>
    </td>
  </tr>`;

  // ===== EKSKUL (hanya yang terisi) =====
  let ekskulRows = '';
  let adaEkskul  = false;
  kegiatan.forEach((k, ki) => {
    const val = ekskulSiswa[ki];
    if (val) {
      adaEkskul = true;
      const ket = val === 'A' ? 'Sangat Baik' : val === 'B' ? 'Baik' : 'Cukup';
      ekskulRows += `<tr>
        <td>${ki+1}</td>
        <td>${k}</td>
        <td class="predikat-${val}">${val} – ${ket}</td>
      </tr>`;
    }
  });

  // ===== KEHADIRAN =====
  const sakit = nilaiSiswa['sakit'] || 0;
  const ijin  = nilaiSiswa['ijin']  || 0;
  const alpa  = nilaiSiswa['alpa']  || 0;

  // ===== TEMPAT & TGL =====
  const tglRaporFmt = formatTanggal(setting.tglRapor);
  const tempatTgl   = [setting.tempatRapor, tglRaporFmt].filter(Boolean).join(', ');

  // Huruf seksi
  const sekEkskul  = 'B';
  const sekHadir   = adaEkskul ? 'C' : 'B';
  const sekCatatan = adaEkskul ? 'D' : 'C';

  const html = `
  <div class="rapor-page">

    ${kopHtml}
    <hr class="rapor-divider"/>

    <div class="rapor-judul">
      <h3>${setting.judul || 'LAPORAN HASIL BELAJAR SISWA'}</h3>
      <p>Semester ${setting.semester || ''} &nbsp;&bull;&nbsp; Tahun Pelajaran ${setting.tahunPelajaran || ''}</p>
    </div>

    <div class="rapor-identitas">
      <table>
        <tr><td>N a m a</td><td>:</td><td><strong>${s.nama || ''}</strong></td></tr>
        <tr><td>Tempat, Tanggal Lahir</td><td>:</td><td>${ttl}</td></tr>
        <tr><td>Nama Orang Tua</td><td>:</td><td>${s.namaOrtu || ''}</td></tr>
        <tr><td>Nomor Induk</td><td>:</td><td>${s.noInduk || ''}</td></tr>
        <tr><td>NISN</td><td>:</td><td>${s.nisn || ''}</td></tr>
        <tr><td>Rombel</td><td>:</td><td>${namaRombel}</td></tr>
      </table>
    </div>

    <div class="rapor-section-title">A. NILAI MATA PELAJARAN</div>
    <table class="rapor-nilai-table">
      <thead>
        <tr>
          <th style="width:32px;">No</th>
          <th>Mata Pelajaran</th>
          <th style="width:48px;">KKM</th>
          <th style="width:48px;">Nilai</th>
          <th style="width:60px;">Predikat</th>
          <th>Deskripsi</th>
        </tr>
      </thead>
      <tbody>
        ${nilaiRows || '<tr><td colspan="6" style="text-align:center;">Belum ada data nilai</td></tr>'}
        ${jumlahRow}
      </tbody>
    </table>

    ${adaEkskul ? `
    <div class="rapor-section-title">${sekEkskul}. EKSTRAKURIKULER</div>
    <table class="rapor-ekskul-table">
      <thead><tr>
        <th style="width:32px;">No</th>
        <th>Kegiatan</th>
        <th style="width:130px;">Predikat</th>
      </tr></thead>
      <tbody>${ekskulRows}</tbody>
    </table>` : ''}

    <div class="rapor-section-title">${sekHadir}. KETIDAKHADIRAN</div>
    <table class="rapor-kehadiran-table">
      <thead><tr><th>Sakit</th><th>Ijin</th><th>Alpa</th></tr></thead>
      <tbody><tr>
        <td>${sakit} hari</td>
        <td>${ijin} hari</td>
        <td>${alpa} hari</td>
      </tr></tbody>
    </table>

    ${s.pesan ? `
    <div class="rapor-section-title">${sekCatatan}. CATATAN WALI KELAS</div>
    <div class="rapor-catatan">${s.pesan}</div>` : ''}

    <div class="rapor-tempat-tgl">${tempatTgl}</div>

    <div class="rapor-ttd">
      <div class="ttd-box">
        <p>Orang Tua / Wali Murid</p>
        <div class="ttd-space"></div>
        <div class="ttd-name">( &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; )</div>
      </div>
      <div class="ttd-box">
        <p>Wali Kelas</p>
        <div class="ttd-space"></div>
        <div class="ttd-name">( ${namaWali || '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;'} )</div>
      </div>
      <div class="ttd-box">
        <p>Kepala Madrasah</p>
        <div class="ttd-space"></div>
        <div class="ttd-name">( ${setting.namaKepala || '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;'} )</div>
      </div>
    </div>

  </div>`;

  document.getElementById('raporPreview').innerHTML = html;
}

function cetakRapor() {
  const idx = document.getElementById('selectSiswa').value;
  if (idx === '') { showToast('Pilih siswa terlebih dahulu!', 'error'); return; }
  window.print();
}
