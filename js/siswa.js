// ===== DATA SISWA (per rombel) =====

let siswaCacheList = [];
let siswaDataCache = {}; // Cache untuk data siswa per rombel

// Local storage cache key
const SISWA_CACHE_KEY = 'rdts_siswa_cache';
const SISWA_CACHE_EXPIRY = 30 * 60 * 1000; // 30 menit

// Load cache from localStorage
function loadSiswaCache() {
  try {
    const cached = localStorage.getItem(SISWA_CACHE_KEY);
    if (cached) {
      const data = JSON.parse(cached);
      // Cek expiry
      if (data.timestamp && (Date.now() - data.timestamp < SISWA_CACHE_EXPIRY)) {
        siswaDataCache = data.cache || {};
        console.log('Siswa cache loaded from localStorage:', Object.keys(siswaDataCache).length, 'rombel');
        return true;
      } else {
        // Cache expired, hapus
        localStorage.removeItem(SISWA_CACHE_KEY);
      }
    }
  } catch(e) {
    console.warn('Error loading siswa cache:', e);
  }
  return false;
}

// Save cache to localStorage
function saveSiswaCache() {
  try {
    const data = {
      timestamp: Date.now(),
      cache: siswaDataCache
    };
    localStorage.setItem(SISWA_CACHE_KEY, JSON.stringify(data));
    console.log('Siswa cache saved to localStorage');
  } catch(e) {
    console.warn('Error saving siswa cache:', e);
  }
}

// Clear cache
function clearSiswaCache() {
  siswaDataCache = {};
  localStorage.removeItem(SISWA_CACHE_KEY);
  showToast('Cache siswa dibersihkan!', 'info');
}

async function loadSiswa() {
  const rombelId = getActiveRombelId('siswa');
  
  // Tampilkan/sembunyikan peringatan untuk admin
  const warning = document.getElementById('siswaRombelWarning');
  if (warning) {
    warning.style.display = !rombelId ? 'block' : 'none';
  }
  
  // Sembunyikan tombol untuk wali kelas
  updateSiswaButtonsVisibility();
  
  if (!rombelId) {
    // Jika admin belum pilih rombel, tampilkan pesan tanpa error
    if (currentUser && currentUser.role === 'admin') {
      renderTabelSiswa([]);
      return;
    }
    showToast('Pilih rombel terlebih dahulu!', 'error');
    return;
  }
  
  // Load cache dari localStorage
  loadSiswaCache();
  
  // Cek apakah data sudah ada di cache
  if (siswaDataCache[rombelId]) {
    const cached = siswaDataCache[rombelId];
    siswaCacheList = cached.siswa || [];
    renderTabelSiswa(siswaCacheList);
    showToast('Data siswa dimuat dari cache! 💾', 'success');
    console.log('Loaded from cache:', rombelId, siswaCacheList.length, 'siswa');
    return;
  }
  
  // Jika tidak ada cache, fetch dari server
  try {
    const data = await API.call('getSiswa', { kelasId: rombelId });
    if (data.error) {
      showToast('Error: ' + data.error, 'error');
      return;
    }
    siswaCacheList = data.siswa || [];
    
    // Simpan ke cache
    siswaDataCache[rombelId] = {
      siswa: siswaCacheList,
      timestamp: Date.now()
    };
    saveSiswaCache();
    
    renderTabelSiswa(siswaCacheList);
    showToast('Data siswa dimuat! 🌐', 'success');
  } catch(e) {
    showToast('Error memuat data siswa: ' + e.message, 'error');
    console.error('Error loadSiswa:', e);
  }
}

// Update visibility tombol berdasarkan role
function updateSiswaButtonsVisibility() {
  const isAdmin = currentUser && currentUser.role === 'admin';
  
  // Sembunyikan tombol Tambah Siswa, Upload Excel, dan Template untuk wali kelas
  const btnTambahSiswa = document.querySelector('#page-siswa .page-header .btn-success');
  const btnUploadExcel = document.querySelector('#page-siswa .page-header .btn-warning');
  const btnTemplate = document.getElementById('btnTemplateSiswa');
  
  if (btnTambahSiswa) btnTambahSiswa.style.display = isAdmin ? '' : 'none';
  if (btnUploadExcel) btnUploadExcel.style.display = isAdmin ? '' : 'none';
  if (btnTemplate) btnTemplate.style.display = isAdmin ? '' : 'none';
}

function renderTabelSiswa(list) {
  const tbody = document.getElementById('bodySiswa');
  const isAdmin = currentUser && currentUser.role === 'admin';
  
  tbody.innerHTML = '';
  if (!list.length) {
    tbody.innerHTML = '<tr><td colspan="9" class="hint">Belum ada data siswa.</td></tr>';
    return;
  }
  list.forEach((s, i) => {
    const tr = document.createElement('tr');
    // Tombol edit dan hapus hanya untuk admin
    const aksiButtons = isAdmin ? `
      <button class="btn-warning" onclick="editSiswa(${i})" style="padding:3px 8px;font-size:0.78rem;">✏️</button>
      <button class="btn-danger"  onclick="hapusSiswa(${i})" style="padding:3px 8px;font-size:0.78rem;margin-left:4px;">🗑️</button>
    ` : '-';
    
    tr.innerHTML = `
      <td>${i+1}</td>
      <td>${s.nisn||''}</td>
      <td>${s.noInduk||''}</td>
      <td>${s.nama||''}</td>
      <td>${s.panggilan||''}</td>
      <td>${s.tempatLahir||''}</td>
      <td>${formatTanggal(s.tglLahir)}</td>
      <td>${s.namaOrtu||''}</td>
      <td>${aksiButtons}</td>`;
    tbody.appendChild(tr);
  });
}

function tambahSiswa() {
  // Hanya admin yang boleh tambah siswa
  if (currentUser && currentUser.role !== 'admin') {
    showToast('Hanya admin yang dapat menambah siswa!', 'error');
    return;
  }
  document.getElementById('modalSiswaTitle').textContent = 'Tambah Siswa';
  document.getElementById('ms_rowIndex').value = '-1';
  ['ms_nisn','ms_noInduk','ms_nama','ms_panggilan','ms_tempatLahir','ms_tglLahir','ms_namaOrtu']
    .forEach(id => document.getElementById(id).value = '');
  document.getElementById('modalSiswa').classList.remove('hidden');
}

function editSiswa(idx) {
  // Hanya admin yang boleh edit siswa
  if (currentUser && currentUser.role !== 'admin') {
    showToast('Hanya admin yang dapat mengedit siswa!', 'error');
    return;
  }
  const s = siswaCacheList[idx];
  console.log('Edit Siswa - Data asli:', s);
  
  document.getElementById('modalSiswaTitle').textContent = 'Edit Siswa';
  document.getElementById('ms_rowIndex').value   = idx;
  document.getElementById('ms_nisn').value       = s.nisn||'';
  document.getElementById('ms_noInduk').value    = s.noInduk||'';
  document.getElementById('ms_nama').value       = s.nama||'';
  document.getElementById('ms_panggilan').value  = s.panggilan||'';
  document.getElementById('ms_tempatLahir').value= s.tempatLahir||'';
  
  // Format tanggal untuk input type="date" (harus YYYY-MM-DD)
  let tglLahir = s.tglLahir || '';
  console.log('Tanggal lahir asli:', tglLahir, 'Type:', typeof tglLahir);
  
  if (tglLahir) {
    // Convert string to string (hapus spasi/tab)
    tglLahir = String(tglLahir).trim();
    
    // Jika format DD/MM/YYYY atau D/M/YYYY, konversi ke YYYY-MM-DD
    if (tglLahir.includes('/')) {
      const parts = tglLahir.split('/');
      if (parts.length === 3) {
        const day = parts[0].padStart(2,'0');
        const month = parts[1].padStart(2,'0');
        const year = parts[2];
        tglLahir = `${year}-${month}-${day}`;
      }
    } 
    // Jika sudah format YYYY-MM-DD tapi ada jam
    else if (tglLahir.includes(' ')) {
      tglLahir = tglLahir.split(' ')[0];
    }
    // Jika format timestamp Excel (angka serial date)
    else if (!isNaN(tglLahir) && Number(tglLahir) > 1000) {
      // Convert Excel serial date to JS date
      const excelEpoch = new Date(1899, 11, 30);
      const jsDate = new Date(excelEpoch.getTime() + Number(tglLahir) * 86400000);
      const year = jsDate.getFullYear();
      const month = String(jsDate.getMonth() + 1).padStart(2, '0');
      const day = String(jsDate.getDate()).padStart(2, '0');
      tglLahir = `${year}-${month}-${day}`;
    }
  }
  
  console.log('Tanggal lahir setelah konversi:', tglLahir);
  document.getElementById('ms_tglLahir').value   = tglLahir;
  
  document.getElementById('ms_namaOrtu').value   = s.namaOrtu||'';
  document.getElementById('modalSiswa').classList.remove('hidden');
}

async function simpanSiswa() {
  const rombelId = getActiveRombelId('siswa');
  if (!rombelId) { showToast('Pilih rombel terlebih dahulu!', 'error'); return; }
  const idx = parseInt(document.getElementById('ms_rowIndex').value);
  const siswa = {
    nisn:        document.getElementById('ms_nisn').value.trim(),
    noInduk:     document.getElementById('ms_noInduk').value.trim(),
    nama:        document.getElementById('ms_nama').value.trim(),
    panggilan:   document.getElementById('ms_panggilan').value.trim(),
    tempatLahir: document.getElementById('ms_tempatLahir').value.trim(),
    tglLahir:    document.getElementById('ms_tglLahir').value,
    namaOrtu:    document.getElementById('ms_namaOrtu').value.trim(),
  };
  if (!siswa.nama) { showToast('Nama siswa wajib diisi!', 'error'); return; }
  try {
    await API.post('saveSiswa', { kelasId: rombelId, siswa: JSON.stringify(siswa), rowIndex: idx });
    closeModal('modalSiswa');
    
    // Hapus cache untuk rombel ini karena data berubah
    delete siswaDataCache[rombelId];
    saveSiswaCache();
    
    showToast('Data siswa disimpan!', 'success');
    await loadSiswa();
  } catch(e) {}
}

async function hapusSiswa(idx) {
  // Hanya admin yang boleh hapus siswa
  if (currentUser && currentUser.role !== 'admin') {
    showToast('Hanya admin yang dapat menghapus siswa!', 'error');
    return;
  }
  if (!confirm('Hapus data siswa ini?')) return;
  const rombelId = getActiveRombelId('siswa');
  if (!rombelId) return;
  try {
    await API.post('deleteSiswa', { kelasId: rombelId, rowIndex: idx });
    
    // Hapus cache untuk rombel ini karena data berubah
    delete siswaDataCache[rombelId];
    saveSiswaCache();
    
    showToast('Data siswa dihapus!', 'success');
    await loadSiswa();
  } catch(e) {}
}
