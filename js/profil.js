// ===== PROFIL USER =====

function loadProfil() {
  if (!currentUser) return;

  const roleLabel = { admin: 'Administrator', walikelas: 'Wali Kelas', guruMapel: 'Guru Mapel' };

  // Avatar & info
  const avatarEl = document.getElementById('profil-avatar');
  if (avatarEl) avatarEl.textContent = getInitials(currentUser.nama);

  setProfilEl('profil-nama-display', currentUser.nama);
  setProfilEl('profil-role-display', roleLabel[currentUser.role] || currentUser.role);
  setProfilEl('profil-username-display', currentUser.username);

  // Rombel info
  const rombelEl = document.getElementById('profil-rombel-display');
  if (rombelEl) {
    const role = currentUser.role;
    if (role === 'admin') {
      rombelEl.textContent = 'Semua Rombel';
    } else if (role === 'walikelas') {
      rombelEl.textContent = currentUser.rombelId || '-';
    } else if (role === 'guruMapel') {
      const list = Array.isArray(currentUser.rombelId) ? currentUser.rombelId : [];
      rombelEl.textContent = list.length ? list.join(', ') : '-';
    }
  }

  // Isi form edit nama
  const namaInput = document.getElementById('profil-nama-input');
  if (namaInput) namaInput.value = currentUser.nama || '';

  // Reset form password
  ['profil-pass-lama', 'profil-pass-baru', 'profil-pass-konfirm'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });

  const errEl = document.getElementById('profil-pass-error');
  if (errEl) { errEl.textContent = ''; errEl.classList.add('hidden'); }
}

function setProfilEl(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

async function simpanNamaProfil() {
  const namaBaru = document.getElementById('profil-nama-input')?.value.trim();
  if (!namaBaru) { showToast('Nama tidak boleh kosong!', 'error'); return; }

  try {
    // Simpan nama baru via API (update user)
    await API.post('saveUser', {
      user: JSON.stringify({
        username: currentUser.username,
        password: '',          // kosong = tidak ubah password
        nama: namaBaru,
        role: currentUser.role,
        rombelId: typeof currentUser.rombelId === 'object'
          ? JSON.stringify(currentUser.rombelId)
          : (currentUser.rombelId || '')
      }),
      isNew: false
    });

    // Update session
    currentUser.nama = namaBaru;
    sessionStorage.setItem('currentUser', JSON.stringify(currentUser));

    // Refresh tampilan
    loadProfil();
    buildNavbar();
    showToast('Nama berhasil diperbarui!', 'success');
  } catch (e) {
    showToast('Gagal menyimpan nama: ' + e.message, 'error');
  }
}

async function simpanPasswordProfil() {
  const passLama    = document.getElementById('profil-pass-lama')?.value;
  const passBaru    = document.getElementById('profil-pass-baru')?.value;
  const passKonfirm = document.getElementById('profil-pass-konfirm')?.value;
  const errEl       = document.getElementById('profil-pass-error');

  // Reset error
  if (errEl) { errEl.textContent = ''; errEl.classList.add('hidden'); }

  const showErr = (msg) => {
    if (errEl) { errEl.textContent = msg; errEl.classList.remove('hidden'); }
    else showToast(msg, 'error');
  };

  if (!passLama)    { showErr('Masukkan password lama.'); return; }
  if (!passBaru)    { showErr('Masukkan password baru.'); return; }
  if (passBaru.length < 6) { showErr('Password baru minimal 6 karakter.'); return; }
  if (passBaru !== passKonfirm) { showErr('Konfirmasi password tidak cocok.'); return; }

  try {
    // Verifikasi password lama via login
    const verif = await API.login(currentUser.username, passLama);
    if (!verif.success) { showErr('Password lama salah.'); return; }

    // Simpan password baru
    await API.post('resetPassword', {
      username: currentUser.username,
      newPassword: passBaru
    });

    // Reset form
    ['profil-pass-lama', 'profil-pass-baru', 'profil-pass-konfirm'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });

    showToast('Password berhasil diubah!', 'success');
  } catch (e) {
    showErr('Gagal mengubah password: ' + e.message);
  }
}

function toggleProfilPass(inputId, btnId) {
  const inp = document.getElementById(inputId);
  const btn = document.getElementById(btnId);
  if (!inp || !btn) return;
  if (inp.type === 'password') { inp.type = 'text'; btn.textContent = '🙈'; }
  else { inp.type = 'password'; btn.textContent = '👁️'; }
}
