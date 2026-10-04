// ===== REKAP NILAI (per rombel) =====

let nilaiData = { mapel: [], siswa: [], nilai: [], isLocked: false };

async function loadNilai() {
  const rombelId = getActiveRombelId('nilai');
  if (!rombelId) {
    // Jika admin belum pilih rombel, tampilkan pesan tanpa error
    if (currentUser && currentUser.role === 'admin') {
      nilaiData = { mapel: [], siswa: [], nilai: [], isLocked: false };
      renderTabelNilai();
      updateKunciNilaiUI();
      return;
    }
    showToast('Pilih rombel terlebih dahulu!', 'error');
    return;
  }
  try {
    const data = await API.call('getNilai', { kelasId: rombelId });
    if (data.error) {
      showToast('Error: ' + data.error, 'error');
      return;
    }
    nilaiData = data;
    // Jika tidak ada isLocked, default false
    if (nilaiData.isLocked === undefined) nilaiData.isLocked = false;
    
    renderTabelNilai();
    updateKunciNilaiUI();
    showToast('Data nilai dimuat!', 'success');
  } catch(e) {
    showToast('Error memuat data nilai: ' + e.message, 'error');
    console.error('Error loadNilai:', e);
  }
}

// Hitung jumlah nilai (total semua mapel) untuk satu siswa
function hitungJumlahNilai(nilaiRow, jumlahMapel) {
  let total = 0;
  let ada = false;
  for (let mi = 0; mi < jumlahMapel; mi++) {
    const v = nilaiRow && nilaiRow[mi] !== undefined && nilaiRow[mi] !== '' ? parseFloat(nilaiRow[mi]) : null;
    if (v !== null && !isNaN(v)) { total += v; ada = true; }
  }
  return ada ? total : '';
}

// Hitung rangking seluruh siswa berdasarkan jumlah nilai (desc), kembalikan array rangking per siswa
function hitungRangking(siswa, nilai, jumlahMapel) {
  const jumlah = siswa.map((s, si) => hitungJumlahNilai(nilai[si], jumlahMapel));
  // Buat array [{si, jumlah}] lalu sort desc
  const sorted = jumlah
    .map((j, si) => ({ si, jumlah: j === '' ? -Infinity : j }))
    .sort((a, b) => b.jumlah - a.jumlah);
  const rangking = new Array(siswa.length);
  let rank = 1;
  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i].jumlah === -Infinity) {
      rangking[sorted[i].si] = '-';
    } else {
      // Tangani nilai sama (dense ranking)
      if (i > 0 && sorted[i].jumlah === sorted[i-1].jumlah) {
        rangking[sorted[i].si] = rangking[sorted[i-1].si];
      } else {
        rank = i + 1;
        rangking[sorted[i].si] = rank;
      }
    }
  }
  return rangking;
}

function renderTabelNilai() {
  const container = document.getElementById('nilaiContainer');
  const { mapel, siswa, nilai, isLocked } = nilaiData;

  if (!siswa || !siswa.length) {
    container.innerHTML = '<p class="hint">Belum ada data siswa di kelas ini.</p>';
    return;
  }
  if (!mapel || !mapel.length) {
    const isAdminCheck = currentUser?.role === 'admin';
    container.innerHTML = `<p class="hint">Belum ada mata pelajaran.${isAdminCheck ? ' Tambahkan di panel Admin → Kelola Mapel.' : ' Hubungi admin untuk menambahkan mata pelajaran.'}</p>`;
    return;
  }

  // Hitung jumlah & rangking
  const jumlahArr   = siswa.map((s, si) => hitungJumlahNilai(nilai[si], mapel.length));
  const rangkingArr = hitungRangking(siswa, nilai, mapel.length);

  // Tentukan kolom mana yang boleh diedit user ini
  const isAdmin     = currentUser?.role === 'admin';
  const isWali      = currentUser?.role === 'walikelas';
  const mapelGuru   = nilaiData.mapelGuru || {};
  
  // Jika nilai terkunci, tidak boleh edit
  const bolehEditMapel = (mi) => {
    if (isLocked) return false;
    if (isAdmin || isWali) return true;
    const namaMapel = mapel[mi];
    return mapelGuru[namaMapel] === currentUser?.username;
  };
  // Sakit/ijin/alpa hanya admin & wali, dan tidak terkunci
  const bolehEditKehadiran = !isLocked && (isAdmin || isWali);

  let html = `<div style="overflow-x:auto;"><table>
    <thead><tr>
      <th>No</th><th>Nama Siswa</th>`;
  mapel.forEach(m => {
    html += `<th style="min-width:90px;">${m}</th>`;
  });
  html += `<th style="min-width:70px;">Jumlah</th><th style="min-width:70px;">Rangking</th>`;
  html += `<th>Sakit</th><th>Ijin</th><th>Alpa</th><th style="min-width:180px;">Pesan Wali Kelas</th></tr></thead><tbody>`;

  siswa.forEach((s, si) => {
    html += `<tr><td>${si+1}</td><td style="white-space:nowrap;">${s.nama}</td>`;
    mapel.forEach((m, mi) => {
      const val    = (nilai[si] && nilai[si][mi] !== undefined) ? nilai[si][mi] : '';
      const boleh  = bolehEditMapel(mi);
      const style  = boleh
        ? 'width:65px;'
        : 'width:65px;background:#f3f4f6;color:#9ca3af;cursor:not-allowed;';
      html += `<td><input type="number" min="0" max="100" value="${val}"
               ${boleh ? `onchange="updateNilai(${si},${mi},this.value)"` : 'disabled'}
               style="${style}" title="${boleh ? '' : 'Anda tidak memiliki akses untuk mapel ini'}"/></td>`;
    });
    // Jumlah & Rangking (read-only, dihitung otomatis)
    const jml = jumlahArr[si] !== '' ? jumlahArr[si] : '-';
    const rnk = rangkingArr[si] !== undefined ? rangkingArr[si] : '-';
    html += `<td style="text-align:center;font-weight:600;background:#f0fdf4;">${jml}</td>`;
    html += `<td style="text-align:center;font-weight:600;background:#eff6ff;">${rnk}</td>`;
    const sakit = (nilai[si] && nilai[si]['sakit']) ? nilai[si]['sakit'] : '';
    const ijin  = (nilai[si] && nilai[si]['ijin'])  ? nilai[si]['ijin']  : '';
    const alpa  = (nilai[si] && nilai[si]['alpa'])  ? nilai[si]['alpa']  : '';
    const kdis  = bolehEditKehadiran ? '' : 'disabled style="background:#f3f4f6;color:#9ca3af;cursor:not-allowed;"';
    html += `<td><input type="number" min="0" value="${sakit}" ${bolehEditKehadiran ? `onchange="updateKehadiran(${si},'sakit',this.value)"` : 'disabled'} style="width:50px;${bolehEditKehadiran?'':'background:#f3f4f6;color:#9ca3af;'}"/></td>`;
    html += `<td><input type="number" min="0" value="${ijin}"  ${bolehEditKehadiran ? `onchange="updateKehadiran(${si},'ijin',this.value)"`  : 'disabled'} style="width:50px;${bolehEditKehadiran?'':'background:#f3f4f6;color:#9ca3af;'}"/></td>`;
    html += `<td><input type="number" min="0" value="${alpa}"  ${bolehEditKehadiran ? `onchange="updateKehadiran(${si},'alpa',this.value)"`  : 'disabled'} style="width:50px;${bolehEditKehadiran?'':'background:#f3f4f6;color:#9ca3af;'}"/></td>`;
    // Pesan Wali Kelas — hanya admin & wali yang bisa edit
    const pesan = (s.pesan !== undefined) ? s.pesan : '';
    html += `<td><textarea rows="2" ${bolehEditKehadiran ? `onchange="updatePesan(${si},this.value)"` : 'disabled'}
      style="width:170px;font-size:0.78rem;resize:vertical;${bolehEditKehadiran?'':'background:#f3f4f6;color:#9ca3af;'}">${pesan}</textarea></td>`;
    html += `</tr>`;
  });
  html += `</tbody></table></div>`;
  container.innerHTML = html;
}

function updateNilai(si, mi, val) {
  if (!nilaiData.nilai[si]) nilaiData.nilai[si] = {};
  nilaiData.nilai[si][mi] = val;
  // Refresh kolom Jumlah & Rangking di tabel tanpa re-render penuh
  refreshJumlahRangking();
}

// Refresh hanya kolom Jumlah & Rangking tanpa mengganggu input yang sedang aktif
function refreshJumlahRangking() {
  const { mapel, siswa, nilai } = nilaiData;
  if (!siswa || !mapel) return;
  const jumlahArr   = siswa.map((s, si) => hitungJumlahNilai(nilai[si], mapel.length));
  const rangkingArr = hitungRangking(siswa, nilai, mapel.length);
  const rows = document.querySelectorAll('#nilaiContainer tbody tr');
  rows.forEach((tr, si) => {
    // Kolom Jumlah = mapel.length + 2 (No, Nama, ...mapel, Jumlah)
    const tdJml = tr.cells[mapel.length + 2];
    const tdRnk = tr.cells[mapel.length + 3];
    if (tdJml) tdJml.textContent = jumlahArr[si] !== '' ? jumlahArr[si] : '-';
    if (tdRnk) tdRnk.textContent = rangkingArr[si] !== undefined ? rangkingArr[si] : '-';
  });
}

function updateKehadiran(si, key, val) {
  if (!nilaiData.nilai[si]) nilaiData.nilai[si] = {};
  nilaiData.nilai[si][key] = val;
}

// Update pesan wali kelas langsung di data siswa (disimpan bersama saveNilai)
function updatePesan(si, val) {
  if (!nilaiData.siswa[si]) return;
  nilaiData.siswa[si].pesan = val;
}

// tambahMapel & hapusMapel hanya dipanggil dari panel admin
function tambahMapel() {
  if (currentUser?.role !== 'admin') {
    showToast('Hanya admin yang bisa menambah mata pelajaran.', 'error'); return;
  }
  const nama = prompt('Nama Mata Pelajaran:');
  if (!nama || !nama.trim()) return;
  nilaiData.mapel.push(nama.trim());
  renderTabelNilai();
}

function hapusMapel(mi) {
  if (currentUser?.role !== 'admin') {
    showToast('Hanya admin yang bisa menghapus mata pelajaran.', 'error'); return;
  }
  if (!confirm(`Hapus mata pelajaran "${nilaiData.mapel[mi]}"? Semua nilai mapel ini akan hilang!`)) return;
  nilaiData.mapel.splice(mi, 1);
  nilaiData.nilai.forEach(row => {
    if (row && typeof row === 'object') {
      const keys = Object.keys(row).filter(k => !isNaN(k)).map(Number).sort((a,b)=>a-b);
      keys.forEach(k => {
        if (k > mi)      { row[k-1] = row[k]; delete row[k]; }
        else if (k === mi) { delete row[k]; }
      });
    }
  });
  renderTabelNilai();
}

async function saveNilai() {
  const rombelId = getActiveRombelId('nilai');
  if (!rombelId) { showToast('Pilih rombel terlebih dahulu!', 'error'); return; }
  try {
    // Simpan nilai
    await API.post('saveNilai', {
      kelasId: rombelId,
      mapel: JSON.stringify(nilaiData.mapel),
      nilai: JSON.stringify(nilaiData.nilai)
    });
    // Simpan pesan wali kelas untuk setiap siswa (batch)
    const savePromises = nilaiData.siswa.map((s, si) =>
      API.post('saveSiswa', {
        kelasId: rombelId,
        rowIndex: String(si),
        siswa: JSON.stringify(s)
      })
    );
    await Promise.all(savePromises);
    showToast('Data nilai & pesan wali disimpan!', 'success');
  } catch(e) {
    showToast('Error menyimpan: ' + e.message, 'error');
  }
}


// ===== KUNCI NILAI =====
function updateKunciNilaiUI() {
  const isAdminOrWali = currentUser && (currentUser.role === 'admin' || currentUser.role === 'walikelas');
  const btnKunci = document.getElementById('btnKunciNilai');
  const statusBox = document.getElementById('nilaiLockStatus');
  const rombelId = getActiveRombelId('nilai');
  
  // Hanya tampilkan tombol kunci untuk admin dan wali kelas
  if (!isAdminOrWali || !rombelId) {
    if (btnKunci) btnKunci.style.display = 'none';
    if (statusBox) statusBox.style.display = 'none';
    return;
  }
  
  if (btnKunci) {
    btnKunci.style.display = '';
    if (nilaiData.isLocked) {
      btnKunci.textContent = '🔓 Buka Kunci';
      btnKunci.className = 'btn-danger';
    } else {
      btnKunci.textContent = '🔒 Kunci Nilai';
      btnKunci.className = 'btn-primary';
    }
  }
  
  if (statusBox) {
    statusBox.style.display = nilaiData.isLocked ? 'block' : 'none';
  }
}

async function toggleKunciNilai() {
  const rombelId = getActiveRombelId('nilai');
  if (!rombelId) {
    showToast('Pilih rombel terlebih dahulu!', 'error');
    return;
  }
  
  const isAdminOrWali = currentUser && (currentUser.role === 'admin' || currentUser.role === 'walikelas');
  if (!isAdminOrWali) {
    showToast('Hanya admin dan wali kelas yang dapat mengunci nilai!', 'error');
    return;
  }
  
  const currentLockStatus = nilaiData.isLocked || false;
  const newLockStatus = !currentLockStatus;
  
  const action = newLockStatus ? 'mengunci' : 'membuka kunci';
  const confirmMsg = newLockStatus 
    ? 'Kunci nilai? Setelah dikunci, nilai tidak dapat diedit sampai dibuka kembali.'
    : 'Buka kunci nilai? Nilai akan dapat diedit kembali.';
  
  if (!confirm(confirmMsg)) return;
  
  try {
    // Update status kunci
    nilaiData.isLocked = newLockStatus;
    
    // Simpan ke server
    await API.post('saveNilai', {
      kelasId: rombelId,
      mapel: JSON.stringify(nilaiData.mapel),
      nilai: JSON.stringify(nilaiData.nilai),
      isLocked: newLockStatus
    });
    
    showToast(`Nilai berhasil ${newLockStatus ? 'dikunci' : 'dibuka'}!`, 'success');
    
    // Update UI
    updateKunciNilaiUI();
    renderTabelNilai();
  } catch(e) {
    nilaiData.isLocked = currentLockStatus; // Rollback
    showToast(`Error ${action}: ` + e.message, 'error');
  }
}
