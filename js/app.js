// ===== APP CORE =====

// ===== SIDEBAR TOGGLE =====
const PAGE_TITLES = {
  dashboard: 'Dashboard',
  admin:     'Panel Admin',
  setting:   'Setting Madrasah',
  siswa:     'Data Siswa',
  nilai:     'Rekap Nilai',
  ekskul:    'Ekstrakurikuler',
  kkm:       'KKM',
  cetak:     'Cetak Rapor',
  profil:    'Profil Saya',
};

function toggleSidebar() {
  const sidebar  = document.getElementById('sidebar');
  const wrapper  = document.querySelector('.app-wrapper');
  const overlay  = document.getElementById('sidebarOverlay');
  const isMobile = window.innerWidth <= 768;
  if (isMobile) {
    sidebar.classList.toggle('mobile-open');
    overlay.classList.toggle('active');
  } else {
    sidebar.classList.toggle('collapsed');
    wrapper.classList.toggle('sidebar-collapsed');
  }
}

function closeSidebar() {
  document.getElementById('sidebar').classList.remove('mobile-open');
  document.getElementById('sidebarOverlay').classList.remove('active');
}

function showPage(name) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn[data-page]').forEach(b => b.classList.remove('active'));
  const pg = document.getElementById('page-' + name);
  if (pg) pg.classList.add('active');
  const btn = document.querySelector(`.nav-btn[data-page="${name}"]`);
  if (btn) btn.classList.add('active');

  // Update judul topbar
  const titleEl = document.getElementById('topbarTitle');
  if (titleEl) titleEl.textContent = PAGE_TITLES[name] || name;
  // Auto-load data saat pindah halaman
  if (name === 'dashboard' && typeof loadDashboard === 'function') {
    loadDashboard();
  } else if (name === 'profil' && typeof loadProfil === 'function') {
    loadProfil();
  } else if (name === 'admin' && typeof loadAdminData === 'function') {
    loadAdminData();
  } else if (name === 'siswa' && typeof loadSiswa === 'function') {
    loadSiswa();
  } else if (name === 'nilai' && typeof loadNilai === 'function') {
    loadNilai();
  } else if (name === 'ekskul' && typeof loadEkskul === 'function') {
    loadEkskul();
  } else if (name === 'cetak' && typeof initCetakPage === 'function') {
    initCetakPage();
  } else if (name === 'kkm' && typeof loadKKM === 'function') {
    loadKKM();
  }
}

function showLoading(show) {
  const el = document.getElementById('loadingOverlay');
  if (!el) return;
  if (show) {
    el.classList.remove('hidden');
    el.classList.add('visible');
  } else {
    el.classList.remove('visible');
  }
}

function showToast(msg, type = 'info') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast ' + type;
  t.classList.remove('hidden');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.add('hidden'), 3200);
}

function closeModal(id) {
  document.getElementById(id).classList.add('hidden');
}

function saveGasUrl() {
  const url = document.getElementById('adminGasUrl').value.trim();
  if (!url) { showToast('Masukkan URL terlebih dahulu', 'error'); return; }
  localStorage.setItem('gasUrl', url);
  const st = document.getElementById('connStatus');
  st.textContent = '✅ Override tersimpan';
  st.className = 'conn-status ok';
  showToast('URL override disimpan!', 'success');
  loadKelasLogin();
}

function clearGasUrl() {
  localStorage.removeItem('gasUrl');
  document.getElementById('adminGasUrl').value = '';
  const st = document.getElementById('connStatus');
  st.textContent = '✅ Menggunakan URL dari kode';
  st.className = 'conn-status ok';
  showToast('Override dihapus, menggunakan GAS_URL dari api.js', 'success');
}

// ===== ROMBEL AKTIF (admin bisa pilih rombel, wali kelas otomatis) =====

// Ambil rombelId yang sedang aktif untuk halaman tertentu
function getActiveRombelId(page) {
  if (!currentUser) return '';
  const role = currentUser.role;
  // Admin: ambil dari selector halaman
  if (role === 'admin') {
    const sel = document.getElementById(`adminRombelSelect-${page}`);
    return sel ? sel.value : '';
  }
  // Guru mapel: rombelId adalah array, ambil dari selector nilai
  if (role === 'guruMapel') {
    const sel = document.getElementById(`adminRombelSelect-${page}`);
    return sel ? sel.value : '';
  }
  // Wali kelas: string tunggal (rombelId) - langsung return
  return currentUser.rombelId || '';
}

// Isi semua selector rombel admin dengan daftar rombel dari cache
function populateAdminRombelSelectors() {
  if (!currentUser || currentUser.role !== 'admin') return;
  const pages = ['setting','siswa','nilai','ekskul','kkm','cetak'];
  pages.forEach(page => {
    const bar = document.getElementById(`adminRombelBar-${page}`);
    const sel = document.getElementById(`adminRombelSelect-${page}`);
    if (!bar || !sel) return;
    bar.classList.remove('hidden');
    const prev = sel.value;
    sel.innerHTML = '<option value="">-- Pilih Rombel --</option>';
    (window._rombelList || []).forEach(r => {
      const opt = document.createElement('option');
      opt.value = r.id;
      opt.textContent = `${r.nama} (${r.id})`;
      if (r.id === prev) opt.selected = true;
      sel.appendChild(opt);
    });
  });
}

// Sembunyikan selector rombel untuk wali kelas (mereka otomatis pakai rombel yang di-assign)
function hideRombelSelectorsForWaliKelas() {
  if (!currentUser || currentUser.role !== 'walikelas') return;
  const pages = ['siswa','nilai','ekskul','cetak'];
  pages.forEach(page => {
    const bar = document.getElementById(`adminRombelBar-${page}`);
    if (bar) bar.classList.add('hidden');
  });
}

// Dipanggil setelah loadAdminData berhasil
function onRombelListLoaded(rombelList) {
  window._rombelList = rombelList || [];
  populateAdminRombelSelectors();
}

// ===== HELPERS =====
function formatTanggal(dateStr) {
  if (!dateStr) return '';
  const bulan = ['Januari','Februari','Maret','April','Mei','Juni',
                 'Juli','Agustus','September','Oktober','November','Desember'];
  const d = new Date(dateStr);
  if (isNaN(d)) return dateStr;
  return `${d.getDate()} ${bulan[d.getMonth()]} ${d.getFullYear()}`;
}

function hitungPredikat(nilai, kkm) {
  nilai = parseFloat(nilai);
  kkm   = parseFloat(kkm) || 70;
  if (isNaN(nilai) || nilai === '') return '-';
  if (nilai >= 90)   return 'A';
  if (nilai >= kkm)  return 'B';
  if (nilai >= 60)   return 'C';
  return 'D';
}

function deskripsiPredikat(predikat, panggilan, mapel) {
  const ket = { A: 'sangat baik', B: 'baik', C: 'cukup', D: 'perlu bimbingan' };
  return `Ananda ${panggilan} ${ket[predikat] || 'cukup'} dalam memahami pelajaran ${mapel}.`;
}

function adminTab(name, btn) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  document.getElementById('adminTab-' + name).classList.add('active');
  if (btn) btn.classList.add('active');
}

// Preview KOP
document.addEventListener('DOMContentLoaded', () => {
  const inp = document.getElementById('s_urlKop');
  if (inp) {
    inp.addEventListener('blur', () => {
      const prev = document.getElementById('kopPreview');
      if (!prev) return;
      const url = inp.value.trim();
      prev.innerHTML = url
        ? `<img src="${url}" style="max-height:80px;max-width:300px;border:1px solid #ddd;border-radius:4px;" onerror="this.style.display='none'" />`
        : '';
    });
  }
});
