// ===== AUTH =====

let currentUser = null; // { username, nama, role, kelasId, token }

async function initApp() {
  const saved = sessionStorage.getItem('currentUser');
  if (saved) {
    currentUser = JSON.parse(saved);
    showMainApp();
    return;
  }
  document.getElementById('loginScreen').classList.remove('hidden');
  document.getElementById('mainApp').classList.add('hidden');
}

async function doLogin() {
  const username = document.getElementById('loginUser').value.trim();
  const password = document.getElementById('loginPass').value;
  const errEl    = document.getElementById('loginError');
  errEl.classList.add('hidden');

  if (!username || !password) {
    errEl.textContent = 'Username dan password wajib diisi.';
    errEl.classList.remove('hidden');
    return;
  }

  try {
    const data = await API.login(username, password);
    if (!data.success) {
      errEl.textContent = data.message || 'Username atau password salah.';
      errEl.classList.remove('hidden');
      return;
    }
    currentUser = data.user;
    sessionStorage.setItem('currentUser', JSON.stringify(currentUser));
    showMainApp();
  } catch {
    errEl.textContent = 'Gagal terhubung ke server.';
    errEl.classList.remove('hidden');
  }
}

function doLogout() {
  currentUser = null;
  sessionStorage.removeItem('currentUser');
  document.getElementById('loginScreen').classList.remove('hidden');
  document.getElementById('mainApp').classList.add('hidden');
  document.getElementById('loginUser').value = '';
  document.getElementById('loginPass').value = '';
  showToast('Berhasil keluar.', 'success');
}

function showMainApp() {
  document.getElementById('loginScreen').classList.add('hidden');
  document.getElementById('mainApp').classList.remove('hidden');
  buildNavbar();
  if (currentUser.role === 'admin') {
    showPage('dashboard');
    const override = localStorage.getItem('gasUrl');
    const inp = document.getElementById('adminGasUrl');
    if (inp) inp.value = override || '';
    const st = document.getElementById('connStatus');
    if (st) {
      st.textContent = override ? '✅ Override aktif' : '✅ Menggunakan GAS_URL dari api.js';
      st.className = 'conn-status ok';
    }
    loadAdminData();
    loadSetting();
  } else if (currentUser.role === 'walikelas') {
    // Sembunyikan selector rombel untuk wali kelas
    hideRombelSelectorsForWaliKelas();
    showPage('dashboard');
  } else {
    // guruMapel — punya array kelas, tampilkan selector
    showPage('dashboard');
    buildGuruKelasSelector();
  }
}

function buildNavbar() {
  const nav = document.getElementById('navLinks');
  nav.innerHTML = '';
  const { role, nama, rombelId } = currentUser;

  const roleLabel = { admin: 'Administrator', walikelas: 'Wali Kelas', guruMapel: 'Guru Mapel' };

  // Update info user di sidebar
  const avatarEl = document.getElementById('sidebarAvatar');
  const nameEl   = document.getElementById('sidebarUserName');
  const roleEl   = document.getElementById('sidebarUserRole');
  if (avatarEl) avatarEl.textContent = typeof getInitials === 'function' ? getInitials(nama) : nama.charAt(0).toUpperCase();
  if (nameEl)   nameEl.textContent   = nama;
  if (roleEl)   roleEl.textContent   = roleLabel[role] || role;

  const pages = [];
  if (role === 'admin') {
    pages.push({ id: 'dashboard', icon: '🏠', label: 'Dashboard' });
    pages.push({ id: 'admin',     icon: '🛠️', label: 'Panel Admin' });
    pages.push({ id: 'setting',   icon: '⚙️', label: 'Setting' });
    pages.push({ id: 'siswa',     icon: '👤', label: 'Data Siswa' });
    pages.push({ id: 'nilai',     icon: '📊', label: 'Rekap Nilai' });
    pages.push({ id: 'ekskul',    icon: '🏆', label: 'Ekskul' });
    pages.push({ id: 'kkm',       icon: '📌', label: 'KKM' });
    pages.push({ id: 'cetak',     icon: '🖨️', label: 'Cetak Rapor' });
    pages.push({ id: 'profil',    icon: '👤', label: 'Profil Saya' });
  } else if (role === 'walikelas') {
    pages.push({ id: 'dashboard', icon: '🏠', label: 'Dashboard' });
    pages.push({ id: 'siswa',     icon: '👤', label: 'Data Siswa' });
    pages.push({ id: 'nilai',     icon: '📊', label: 'Rekap Nilai' });
    pages.push({ id: 'ekskul',    icon: '🏆', label: 'Ekskul' });
    pages.push({ id: 'cetak',     icon: '🖨️', label: 'Cetak Rapor' });
    pages.push({ id: 'profil',    icon: '👤', label: 'Profil Saya' });
  } else {
    pages.push({ id: 'dashboard', icon: '🏠', label: 'Dashboard' });
    pages.push({ id: 'nilai',     icon: '📊', label: 'Rekap Nilai' });
    pages.push({ id: 'profil',    icon: '👤', label: 'Profil Saya' });
  }

  pages.forEach(p => {
    const btn = document.createElement('button');
    btn.className = 'nav-btn';
    btn.dataset.page = p.id;
    btn.innerHTML = `<span class="nav-btn-icon">${p.icon}</span><span class="sidebar-nav-label">${p.label}</span>`;
    btn.onclick = () => {
      showPage(p.id);
      if (window.innerWidth <= 768) closeSidebar();
    };
    nav.appendChild(btn);
  });
}

window.addEventListener('DOMContentLoaded', () => {
  initApp();
  ['loginUser', 'loginPass'].forEach(id => {
    document.getElementById(id)?.addEventListener('keydown', e => {
      if (e.key === 'Enter') doLogin();
    });
  });
});

// Guru mapel: bangun selector rombel di halaman nilai
async function buildGuruKelasSelector() {
  const rombelList = Array.isArray(currentUser.rombelId) ? currentUser.rombelId : [];
  if (!rombelList.length) {
    showToast('Anda belum ditugaskan ke rombel manapun. Hubungi admin.', 'error');
    return;
  }

  // Ambil nama rombel dari server agar tampil nama lengkap
  let rombelNamaMap = {};
  try {
    const res = await API.call('getRombel');
    (res.rombel || []).forEach(r => { rombelNamaMap[r.id] = r.nama || r.id; });
  } catch(e) {
    rombelList.forEach(id => { rombelNamaMap[id] = id; });
  }

  // Isi selector rombel di halaman nilai
  const bar = document.getElementById('adminRombelBar-nilai');
  const sel = document.getElementById('adminRombelSelect-nilai');
  if (bar && sel) {
    bar.classList.remove('hidden');
    sel.innerHTML = '<option value="">-- Pilih Rombel --</option>';
    rombelList.forEach(rid => {
      const opt = document.createElement('option');
      opt.value = rid;
      opt.textContent = rombelNamaMap[rid] || rid;
      sel.appendChild(opt);
    });
    // Jika hanya 1 rombel, langsung pilih dan load
    if (rombelList.length === 1) {
      sel.value = rombelList[0];
      loadNilai();
    }
  }
}
