// ===== DASHBOARD =====

async function loadDashboard() {
  const role = currentUser?.role;

  // Reset stat
  setStatEl('dash-stat-rombel', '—');
  setStatEl('dash-stat-siswa',  '—');
  setStatEl('dash-stat-user',   '—');
  setStatEl('dash-stat-mapel',  '—');

  // Info user di welcome banner
  const roleLabel = { admin: 'Administrator', walikelas: 'Wali Kelas', guruMapel: 'Guru Mapel' };
  const el = document.getElementById('dash-user-info');
  if (el) {
    el.innerHTML = `
      <div class="dash-avatar">${getInitials(currentUser.nama)}</div>
      <div>
        <div class="dash-user-name">${currentUser.nama}</div>
        <div class="dash-user-role">${roleLabel[role] || role}</div>
      </div>`;
  }

  toggleDashCard('dash-card-rombel', role === 'admin');
  toggleDashCard('dash-card-user',   role === 'admin');

  // Editor hanya untuk admin
  const editor = document.getElementById('dash-announcement-editor');
  if (editor) editor.classList.toggle('hidden', role !== 'admin');

  try {
    if (role === 'admin') {
      const [rRes, uRes] = await Promise.all([
        API.call('getRombel'),
        API.call('getUsers')
      ]);
      const rombelList = rRes.rombel || [];
      setStatEl('dash-stat-rombel', rombelList.length);
      setStatEl('dash-stat-user',   (uRes.users || []).length);

      let totalSiswa = 0, totalMapel = 0;
      if (rombelList.length) {
        const siswaResults = await Promise.all(
          rombelList.map(r => API.call('getSiswa', { kelasId: r.id }).catch(() => ({ siswa: [] })))
        );
        siswaResults.forEach(res => { totalSiswa += (res.siswa || []).length; });
        const nilaiRes = await API.call('getNilai', { kelasId: rombelList[0].id }).catch(() => ({ mapel: [] }));
        totalMapel = (nilaiRes.mapel || []).length;
      }
      setStatEl('dash-stat-siswa', totalSiswa);
      setStatEl('dash-stat-mapel', totalMapel);

    } else if (role === 'walikelas') {
      const rombelId = currentUser.rombelId;
      if (rombelId) {
        const [sRes, nRes] = await Promise.all([
          API.call('getSiswa', { kelasId: rombelId }),
          API.call('getNilai', { kelasId: rombelId })
        ]);
        setStatEl('dash-stat-siswa', (sRes.siswa || []).length);
        setStatEl('dash-stat-mapel', (nRes.mapel || []).length);
      }
    } else {
      const rombelList = Array.isArray(currentUser.rombelId) ? currentUser.rombelId : [];
      setStatEl('dash-stat-rombel', rombelList.length);
    }
  } catch (e) {
    console.error('loadDashboard error:', e);
  }

  // Muat feed pengumuman untuk semua role
  await loadAnnouncementFeed();
}

// ===== PENGUMUMAN — FEED =====

async function loadAnnouncementFeed() {
  const feed = document.getElementById('dash-announcement-feed');
  if (!feed) return;
  const isAdmin = currentUser?.role === 'admin';

  try {
    const res  = await API.call('getAnnouncements');
    const list = res.announcements || [];

    if (!list.length) {
      feed.innerHTML = isAdmin
        ? ''   // admin: tidak perlu pesan kosong, form sudah ada di bawah
        : `<div class="ann-empty">📭 Belum ada pengumuman.</div>`;
      return;
    }

    feed.innerHTML = list.map(ann => renderAnnCard(ann, isAdmin)).join('');
  } catch (e) {
    feed.innerHTML = `<div class="ann-empty" style="color:#dc2626;">Gagal memuat pengumuman.</div>`;
  }
}

function renderAnnCard(ann, isAdmin) {
  const urlBtn = ann.url
    ? `<a href="${escHtml(ann.url)}" target="_blank" rel="noopener" class="ann-card-link">🔗 Buka Tautan</a>`
    : '';
  const adminBtns = isAdmin ? `
    <div class="ann-card-actions">
      <button class="ann-btn-edit"   onclick="editAnnouncement('${escHtml(ann.id)}')">✏️ Edit</button>
      <button class="ann-btn-delete" onclick="deleteAnnouncement('${escHtml(ann.id)}')">🗑️ Hapus</button>
    </div>` : '';

  const waktuFmt = formatWaktuAnn(ann.waktu);

  return `
    <div class="ann-card" id="ann-card-${escHtml(ann.id)}">
      <div class="ann-card-header">
        <span class="ann-card-icon">📢</span>
        <div class="ann-card-meta">
          <div class="ann-card-judul">${escHtml(ann.judul || 'Pengumuman')}</div>
          <div class="ann-card-time">🕐 ${waktuFmt}</div>
        </div>
        ${adminBtns}
      </div>
      <div class="ann-card-isi">${escHtml(ann.isi || '')}</div>
      ${urlBtn}
    </div>`;
}

// ===== PENGUMUMAN — CRUD =====

async function submitAnnouncement() {
  const id    = document.getElementById('ann-edit-id')?.value.trim() || '';
  const judul = document.getElementById('ann-judul')?.value.trim()   || '';
  const isi   = document.getElementById('ann-isi')?.value.trim()     || '';
  const url   = document.getElementById('ann-url')?.value.trim()     || '';

  if (!judul || !isi) { showToast('Judul dan isi wajib diisi!', 'error'); return; }

  try {
    await API.post('saveAnnouncement', {
      announcement: JSON.stringify({ id, judul, isi, url })
    });
    showToast(id ? 'Pengumuman diperbarui!' : 'Pengumuman diposting!', 'success');
    resetAnnForm();
    await loadAnnouncementFeed();
  } catch (e) {
    showToast('Gagal menyimpan pengumuman.', 'error');
  }
}

async function deleteAnnouncement(id) {
  if (!confirm('Hapus pengumuman ini?')) return;
  try {
    await API.post('deleteAnnouncement', { id });
    showToast('Pengumuman dihapus!', 'success');
    await loadAnnouncementFeed();
  } catch (e) {
    showToast('Gagal menghapus.', 'error');
  }
}

async function editAnnouncement(id) {
  // Ambil data dari card yang sudah dirender
  const card = document.getElementById('ann-card-' + id);
  if (!card) return;

  const judul = card.querySelector('.ann-card-judul')?.textContent || '';
  const isi   = card.querySelector('.ann-card-isi')?.textContent   || '';
  const link  = card.querySelector('.ann-card-link');
  const url   = link ? link.getAttribute('href') : '';

  document.getElementById('ann-edit-id').value  = id;
  document.getElementById('ann-judul').value    = judul;
  document.getElementById('ann-isi').value      = isi;
  document.getElementById('ann-url').value      = url || '';

  // Update tombol
  const submitBtn = document.querySelector('#dash-announcement-editor .btn-primary');
  if (submitBtn) submitBtn.textContent = '💾 Simpan Perubahan';
  const cancelBtn = document.getElementById('ann-cancel-btn');
  if (cancelBtn) cancelBtn.style.display = '';

  // Scroll ke form editor
  document.getElementById('dash-announcement-editor')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function cancelEditAnnouncement() {
  resetAnnForm();
}

function resetAnnForm() {
  document.getElementById('ann-edit-id').value = '';
  document.getElementById('ann-judul').value   = '';
  document.getElementById('ann-isi').value     = '';
  document.getElementById('ann-url').value     = '';
  const submitBtn = document.querySelector('#dash-announcement-editor .btn-primary');
  if (submitBtn) submitBtn.textContent = '💾 Posting';
  const cancelBtn = document.getElementById('ann-cancel-btn');
  if (cancelBtn) cancelBtn.style.display = 'none';
}

// ===== HELPERS =====

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatWaktuAnn(iso) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    if (isNaN(d)) return iso;

    // Konversi UTC → WIB (UTC+7)
    const wib = new Date(d.getTime() + 7 * 60 * 60 * 1000);

    const bulan = [
      'Januari','Februari','Maret','April','Mei','Juni',
      'Juli','Agustus','September','Oktober','November','Desember'
    ];
    const tgl = String(wib.getUTCDate()).padStart(2, '0');
    const bln = bulan[wib.getUTCMonth()];
    const thn = wib.getUTCFullYear();
    const jam = String(wib.getUTCHours()).padStart(2, '0');
    const mnt = String(wib.getUTCMinutes()).padStart(2, '0');

    return `${tgl} ${bln} ${thn} ${jam}.${mnt} WIB`;
  } catch (e) { return iso; }
}

function setStatEl(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

function toggleDashCard(id, show) {
  const el = document.getElementById(id);
  if (el) el.style.display = show ? '' : 'none';
}

function getInitials(nama) {
  if (!nama) return '?';
  return nama.trim().split(/\s+/).slice(0, 2).map(w => w[0].toUpperCase()).join('');
}
