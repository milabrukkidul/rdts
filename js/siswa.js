// ===== DATA SISWA (per rombel) =====

let siswaCacheList = [];
let siswaDataCache = {}; // { [rombelId]: { siswa: [], timestamp: number } }

const SISWA_CACHE_KEY    = 'rdts_siswa_cache';
const SISWA_CACHE_EXPIRY = 30 * 60 * 1000; // 30 menit per rombel

// Dipanggil SEKALI saat login / app init — muat semua cache dari localStorage ke memori
function initSiswaCache() {
  try {
    const raw = localStorage.getItem(SISWA_CACHE_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw);
    const now   = Date.now();
    // Muat hanya entry yang belum expired, buang yang sudah kadaluarsa
    siswaDataCache = {};
    Object.entries(saved).forEach(([rombelId, entry]) => {
      if (entry && entry.timestamp && (now - entry.timestamp < SISWA_CACHE_EXPIRY)) {
        siswaDataCache[rombelId] = entry;
      }
    });
  } catch(e) {
    siswaDataCache = {};
  }
}

// Simpan satu entry rombel ke localStorage (tidak timpa entri lain)
function persistSiswaCache(rombelId) {
  try {
    // Baca dulu yang sudah ada agar tidak timpa rombel lain
    let saved = {};
    try {
      const raw = localStorage.getItem(SISWA_CACHE_KEY);
      if (raw) saved = JSON.parse(raw);
    } catch(e) {}

    // Tulis/update hanya entry rombel yang baru saja berubah
    if (siswaDataCache[rombelId]) {
      saved[rombelId] = siswaDataCache[rombelId];
    } else {
      delete saved[rombelId];
    }

    localStorage.setItem(SISWA_CACHE_KEY, JSON.stringify(saved));
  } catch(e) {
    console.warn('persistSiswaCache error:', e);
  }
}

// Hapus satu entry rombel dari cache memori dan localStorage
function invalidateSiswaCache(rombelId) {
  delete siswaDataCache[rombelId];
  persistSiswaCache(rombelId); // akan delete entry tsb dari localStorage
}

// Hapus seluruh cache (misal saat logout)
function clearSiswaCache() {
  siswaDataCache = {};
  localStorage.removeItem(SISWA_CACHE_KEY);
  showToast('Cache siswa dibersihkan!', 'info');
}

// ===== LOAD SISWA =====

async function loadSiswa() {
  const rombelId = getActiveRombelId('siswa');

  const warning = document.getElementById('siswaRombelWarning');
  if (warning) warning.style.display = !rombelId ? 'block' : 'none';

  updateSiswaButtonsVisibility();

  if (!rombelId) {
    if (currentUser && currentUser.role === 'admin') {
      renderTabelSiswa([]);
      return;
    }
    showToast('Pilih rombel terlebih dahulu!', 'error');
    return;
  }

  // Cek cache untuk rombelId ini saja — jangan panggil loadSiswaCache() lagi di sini
  const cached = siswaDataCache[rombelId];
  if (cached && cached.siswa && (Date.now() - cached.timestamp < SISWA_CACHE_EXPIRY)) {
    siswaCacheList = cached.siswa;
    renderTabelSiswa(siswaCacheList);
    showToast('Data siswa dimuat dari cache! 💾', 'success');
    return;
  }

  // Fetch dari server
  try {
    const data = await API.call('getSiswa', { kelasId: rombelId });
    if (data.error) { showToast('Error: ' + data.error, 'error'); return; }

    siswaCacheList = data.siswa || [];

    // Simpan hanya untuk rombelId ini
    siswaDataCache[rombelId] = { siswa: siswaCacheList, timestamp: Date.now() };
    persistSiswaCache(rombelId);

    renderTabelSiswa(siswaCacheList);
    showToast('Data siswa dimuat! 🌐', 'success');
  } catch(e) {
    showToast('Error memuat data siswa: ' + e.message, 'error');
    console.error('Error loadSiswa:', e);
  }
}

// ===== TAMPILAN =====

function updateSiswaButtonsVisibility() {
  const isAdmin = currentUser && currentUser.role === 'admin';
  const btnTambah  = document.querySelector('#page-siswa .page-header .btn-success');
  const btnUpload  = document.querySelector('#page-siswa .page-header .btn-warning');
  const btnTemplate = document.getElementById('btnTemplateSiswa');
  if (btnTambah)   btnTambah.style.display   = isAdmin ? '' : 'none';
  if (btnUpload)   btnUpload.style.display   = isAdmin ? '' : 'none';
  if (btnTemplate) btnTemplate.style.display = isAdmin ? '' : 'none';
}

function renderTabelSiswa(list) {
  const tbody   = document.getElementById('bodySiswa');
  const isAdmin = currentUser && currentUser.role === 'admin';
  tbody.innerHTML = '';
  if (!list.length) {
    tbody.innerHTML = '<tr><td colspan="9" class="hint">Belum ada data siswa.</td></tr>';
    return;
  }
  list.forEach((s, i) => {
    const tr = document.createElement('tr');
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

// ===== CRUD =====

function tambahSiswa() {
  if (currentUser && currentUser.role !== 'admin') {
    showToast('Hanya admin yang dapat menambah siswa!', 'error'); return;
  }
  document.getElementById('modalSiswaTitle').textContent = 'Tambah Siswa';
  document.getElementById('ms_rowIndex').value = '-1';
  ['ms_nisn','ms_noInduk','ms_nama','ms_panggilan','ms_tempatLahir','ms_tglLahir','ms_namaOrtu']
    .forEach(id => document.getElementById(id).value = '');
  document.getElementById('modalSiswa').classList.remove('hidden');
}

function editSiswa(idx) {
  if (currentUser && currentUser.role !== 'admin') {
    showToast('Hanya admin yang dapat mengedit siswa!', 'error'); return;
  }
  const s = siswaCacheList[idx];
  document.getElementById('modalSiswaTitle').textContent = 'Edit Siswa';
  document.getElementById('ms_rowIndex').value    = idx;
  document.getElementById('ms_nisn').value        = s.nisn||'';
  document.getElementById('ms_noInduk').value     = s.noInduk||'';
  document.getElementById('ms_nama').value        = s.nama||'';
  document.getElementById('ms_panggilan').value   = s.panggilan||'';
  document.getElementById('ms_tempatLahir').value = s.tempatLahir||'';

  // Format tanggal → YYYY-MM-DD untuk input type="date"
  let tgl = String(s.tglLahir || '').trim();
  if (tgl) {
    if (tgl.includes('/')) {
      const [d, m, y] = tgl.split('/');
      tgl = `${y}-${(m||'').padStart(2,'0')}-${(d||'').padStart(2,'0')}`;
    } else if (tgl.includes(' ')) {
      tgl = tgl.split(' ')[0];
    } else if (!isNaN(tgl) && Number(tgl) > 1000) {
      const jsDate = new Date(new Date(1899,11,30).getTime() + Number(tgl) * 86400000);
      tgl = `${jsDate.getFullYear()}-${String(jsDate.getMonth()+1).padStart(2,'0')}-${String(jsDate.getDate()).padStart(2,'0')}`;
    }
  }
  document.getElementById('ms_tglLahir').value  = tgl;
  document.getElementById('ms_namaOrtu').value  = s.namaOrtu||'';
  document.getElementById('modalSiswa').classList.remove('hidden');
}

async function simpanSiswa() {
  const rombelId = getActiveRombelId('siswa');
  if (!rombelId) { showToast('Pilih rombel terlebih dahulu!', 'error'); return; }
  const idx   = parseInt(document.getElementById('ms_rowIndex').value);
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
    invalidateSiswaCache(rombelId); // hapus cache rombel ini saja
    showToast('Data siswa disimpan!', 'success');
    await loadSiswa();
  } catch(e) {}
}

async function hapusSiswa(idx) {
  if (currentUser && currentUser.role !== 'admin') {
    showToast('Hanya admin yang dapat menghapus siswa!', 'error'); return;
  }
  if (!confirm('Hapus data siswa ini?')) return;
  const rombelId = getActiveRombelId('siswa');
  if (!rombelId) return;
  try {
    await API.post('deleteSiswa', { kelasId: rombelId, rowIndex: idx });
    invalidateSiswaCache(rombelId); // hapus cache rombel ini saja
    showToast('Data siswa dihapus!', 'success');
    await loadSiswa();
  } catch(e) {}
}
