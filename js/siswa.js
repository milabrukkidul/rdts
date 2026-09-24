// ===== DATA SISWA (per rombel) =====

let siswaCacheList = [];

async function loadSiswa() {
  const rombelId = getActiveRombelId('siswa');
  
  // Tampilkan/sembunyikan peringatan untuk admin
  const warning = document.getElementById('siswaRombelWarning');
  if (warning) {
    warning.style.display = !rombelId ? 'block' : 'none';
  }
  
  if (!rombelId) {
    // Jika admin belum pilih rombel, tampilkan pesan tanpa error
    if (currentUser && currentUser.role === 'admin') {
      renderTabelSiswa([]);
      return;
    }
    showToast('Pilih rombel terlebih dahulu!', 'error');
    return;
  }
  
  try {
    const data = await API.call('getSiswa', { kelasId: rombelId });
    if (data.error) {
      showToast('Error: ' + data.error, 'error');
      return;
    }
    siswaCacheList = data.siswa || [];
    renderTabelSiswa(siswaCacheList);
    showToast('Data siswa dimuat!', 'success');
  } catch(e) {
    showToast('Error memuat data siswa: ' + e.message, 'error');
    console.error('Error loadSiswa:', e);
  }
}

function renderTabelSiswa(list) {
  const tbody = document.getElementById('bodySiswa');
  tbody.innerHTML = '';
  if (!list.length) {
    tbody.innerHTML = '<tr><td colspan="9" class="hint">Belum ada data siswa.</td></tr>';
    return;
  }
  list.forEach((s, i) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${i+1}</td>
      <td>${s.nisn||''}</td>
      <td>${s.noInduk||''}</td>
      <td>${s.nama||''}</td>
      <td>${s.panggilan||''}</td>
      <td>${s.tempatLahir||''}</td>
      <td>${formatTanggal(s.tglLahir)}</td>
      <td>${s.namaOrtu||''}</td>
      <td>
        <button class="btn-warning" onclick="editSiswa(${i})" style="padding:3px 8px;font-size:0.78rem;">✏️</button>
        <button class="btn-danger"  onclick="hapusSiswa(${i})" style="padding:3px 8px;font-size:0.78rem;margin-left:4px;">🗑️</button>
      </td>`;
    tbody.appendChild(tr);
  });
}

function tambahSiswa() {
  document.getElementById('modalSiswaTitle').textContent = 'Tambah Siswa';
  document.getElementById('ms_rowIndex').value = '-1';
  ['ms_nisn','ms_noInduk','ms_nama','ms_panggilan','ms_tempatLahir','ms_tglLahir','ms_namaOrtu']
    .forEach(id => document.getElementById(id).value = '');
  document.getElementById('modalSiswa').classList.remove('hidden');
}

function editSiswa(idx) {
  const s = siswaCacheList[idx];
  document.getElementById('modalSiswaTitle').textContent = 'Edit Siswa';
  document.getElementById('ms_rowIndex').value   = idx;
  document.getElementById('ms_nisn').value       = s.nisn||'';
  document.getElementById('ms_noInduk').value    = s.noInduk||'';
  document.getElementById('ms_nama').value       = s.nama||'';
  document.getElementById('ms_panggilan').value  = s.panggilan||'';
  document.getElementById('ms_tempatLahir').value= s.tempatLahir||'';
  document.getElementById('ms_tglLahir').value   = s.tglLahir||'';
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
    showToast('Data siswa disimpan!', 'success');
    await loadSiswa();
  } catch(e) {}
}

async function hapusSiswa(idx) {
  if (!confirm('Hapus data siswa ini?')) return;
  const rombelId = getActiveRombelId('siswa');
  if (!rombelId) return;
  try {
    await API.post('deleteSiswa', { kelasId: rombelId, rowIndex: idx });
    showToast('Data siswa dihapus!', 'success');
    await loadSiswa();
  } catch(e) {}
}
