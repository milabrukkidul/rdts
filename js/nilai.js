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
    // PENTING: JANGAN gunakan cache untuk getNilai
    // karena status isLocked bisa berubah dan harus selalu fresh
    const data = await API.call('getNilai', { kelasId: rombelId }, false); // ← useCache = false
    if (data.error) {
      showToast('Error: ' + data.error, 'error');
      return;
    }
    
    // Parse isLocked - bisa datang sebagai boolean, string, atau undefined
    let isLocked = false;
    if (data.isLocked !== undefined && data.isLocked !== null) {
      if (typeof data.isLocked === 'boolean') {
        isLocked = data.isLocked;
      } else if (typeof data.isLocked === 'string') {
        isLocked = data.isLocked === 'true' || data.isLocked === '1';
      } else {
        isLocked = Boolean(data.isLocked);
      }
    }
    
    // Pastikan nilaiData memiliki semua properti yang diperlukan
    nilaiData = {
      mapel: data.mapel || [],
      siswa: data.siswa || [],
      nilai: data.nilai || [],
      mapelGuru: data.mapelGuru || {},
      isLocked: isLocked
    };
    
    console.log('Nilai data loaded:', {
      kelasId: rombelId,
      isLocked: nilaiData.isLocked,
      isLockedType: typeof nilaiData.isLocked,
      rawIsLocked: data.isLocked,
      rawIsLockedType: typeof data.isLocked,
      mapelCount: nilaiData.mapel.length,
      siswaCount: nilaiData.siswa.length
    });
    
    renderTabelNilai();
    updateKunciNilaiUI();
    
    // Tampilkan peringatan jika nilai terkunci
    if (nilaiData.isLocked) {
      showToast('⚠️ Nilai terkunci! Tidak dapat diedit.', 'warning');
    } else {
      showToast('Data nilai dimuat!', 'success');
    }
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

  // Tampilkan warning banner jika terkunci
  let warningBanner = '';
  if (isLocked) {
    const isAdminOrWali = currentUser && (currentUser.role === 'admin' || currentUser.role === 'walikelas');
    warningBanner = `
    <div style="background:#fef3c7;border:2px solid #f59e0b;border-radius:8px;padding:12px 16px;margin-bottom:16px;display:flex;align-items:center;gap:12px;">
      <span style="font-size:1.5rem;">🔒</span>
      <div style="flex:1;">
        <strong style="color:#92400e;">Nilai Terkunci</strong>
        <p style="margin:4px 0 0;font-size:0.85rem;color:#92400e;">
          Nilai tidak dapat diedit sampai kunci dibuka. 
          ${isAdminOrWali ? 'Klik tombol "Buka Kunci" di atas untuk mengedit.' : 'Hubungi admin atau wali kelas untuk membuka kunci.'}
        </p>
      </div>
    </div>`;
  }

  // Hitung jumlah & rangking
  const jumlahArr   = siswa.map((s, si) => hitungJumlahNilai(nilai[si], mapel.length));
  const rangkingArr = hitungRangking(siswa, nilai, mapel.length);

  // Tentukan kolom mana yang boleh diedit user ini
  const isAdmin     = currentUser?.role === 'admin';
  const isWali      = currentUser?.role === 'walikelas';
  const mapelGuru   = nilaiData.mapelGuru || {};
  
  // Jika nilai terkunci, tidak boleh edit sama sekali
  const bolehEditMapel = (mi) => {
    if (isLocked) return false;
    if (isAdmin || isWali) return true;
    const namaMapel = mapel[mi];
    return mapelGuru[namaMapel] === currentUser?.username;
  };
  // Sakit/ijin/alpa hanya admin & wali, dan tidak terkunci
  const bolehEditKehadiran = !isLocked && (isAdmin || isWali);

  let html = warningBanner + `<div style="overflow-x:auto;"><table>
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
      const lockedStyle = isLocked ? 'background:#fee2e2;' : '';
      const style  = boleh
        ? `width:65px;${lockedStyle}`
        : `width:65px;background:#f3f4f6;color:#9ca3af;cursor:not-allowed;`;
      const titleText = isLocked 
        ? 'Nilai terkunci - tidak dapat diedit'
        : (boleh ? '' : 'Anda tidak memiliki akses untuk mapel ini');
      html += `<td><input type="number" min="0" max="100" value="${val}"
               ${boleh ? `onchange="updateNilai(${si},${mi},this.value)"` : 'disabled'}
               style="${style}" title="${titleText}"/></td>`;
    });
    // Jumlah & Rangking (read-only, dihitung otomatis)
    const jml = jumlahArr[si] !== '' ? jumlahArr[si] : '-';
    const rnk = rangkingArr[si] !== undefined ? rangkingArr[si] : '-';
    html += `<td style="text-align:center;font-weight:600;background:#f0fdf4;">${jml}</td>`;
    html += `<td style="text-align:center;font-weight:600;background:#eff6ff;">${rnk}</td>`;
    const sakit = (nilai[si] && nilai[si]['sakit']) ? nilai[si]['sakit'] : '';
    const ijin  = (nilai[si] && nilai[si]['ijin'])  ? nilai[si]['ijin']  : '';
    const alpa  = (nilai[si] && nilai[si]['alpa'])  ? nilai[si]['alpa']  : '';
    const lockedStyleKh = isLocked ? 'background:#fee2e2;color:#9ca3af;' : '';
    const kehadiranStyle = bolehEditKehadiran ? lockedStyleKh : 'background:#f3f4f6;color:#9ca3af;';
    html += `<td><input type="number" min="0" value="${sakit}" ${bolehEditKehadiran ? `onchange="updateKehadiran(${si},'sakit',this.value)"` : 'disabled'} style="width:50px;${kehadiranStyle}" title="${isLocked?'Terkunci':''}"/></td>`;
    html += `<td><input type="number" min="0" value="${ijin}"  ${bolehEditKehadiran ? `onchange="updateKehadiran(${si},'ijin',this.value)"`  : 'disabled'} style="width:50px;${kehadiranStyle}" title="${isLocked?'Terkunci':''}"/></td>`;
    html += `<td><input type="number" min="0" value="${alpa}"  ${bolehEditKehadiran ? `onchange="updateKehadiran(${si},'alpa',this.value)"`  : 'disabled'} style="width:50px;${kehadiranStyle}" title="${isLocked?'Terkunci':''}"/></td>`;
    // Pesan Wali Kelas — hanya admin & wali yang bisa edit
    const pesan = (s.pesan !== undefined) ? s.pesan : '';
    const pesanStyle = bolehEditKehadiran ? lockedStyleKh : 'background:#f3f4f6;color:#9ca3af;';
    html += `<td><textarea rows="2" ${bolehEditKehadiran ? `onchange="updatePesan(${si},this.value)"` : 'disabled'}
      style="width:170px;font-size:0.78rem;resize:vertical;${pesanStyle}" title="${isLocked?'Terkunci':''}">${pesan}</textarea></td>`;
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
  
  // Cek apakah nilai terkunci
  if (nilaiData.isLocked) {
    showToast('⚠️ Nilai terkunci! Tidak dapat menyimpan perubahan. Buka kunci terlebih dahulu.', 'error');
    return;
  }
  
  try {
    // Simpan nilai - PENTING: sertakan isLocked untuk mempertahankan status
    await API.post('saveNilai', {
      kelasId: rombelId,
      mapel: JSON.stringify(nilaiData.mapel),
      nilai: JSON.stringify(nilaiData.nilai),
      isLocked: nilaiData.isLocked ? 'true' : 'false'
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
    ? '🔒 Kunci nilai?\n\nSetelah dikunci, nilai tidak dapat diedit oleh siapapun sampai dibuka kembali.\n\nLanjutkan?' 
    : '🔓 Buka kunci nilai?\n\nNilai akan dapat diedit kembali oleh guru mapel, wali kelas, dan admin.\n\nLanjutkan?';
  
  if (!confirm(confirmMsg)) return;
  
  // Disable tombol sementara
  const btnKunci = document.getElementById('btnKunciNilai');
  const originalText = btnKunci ? btnKunci.textContent : '';
  if (btnKunci) {
    btnKunci.disabled = true;
    btnKunci.textContent = '⏳ Menyimpan...';
  }
  
  try {
    // Update status kunci
    nilaiData.isLocked = newLockStatus;
    
    console.log('Toggling lock status:', {
      kelasId: rombelId,
      oldStatus: currentLockStatus,
      newStatus: newLockStatus
    });
    
    // Simpan ke server - PENTING: sertakan isLocked dalam request
    await API.post('saveNilai', {
      kelasId: rombelId,
      mapel: JSON.stringify(nilaiData.mapel),
      nilai: JSON.stringify(nilaiData.nilai),
      isLocked: newLockStatus ? 'true' : 'false' // Kirim sebagai string untuk kompatibilitas
    });
    
    const successMsg = newLockStatus 
      ? '🔒 Nilai berhasil dikunci! Tidak dapat diedit sampai dibuka kembali.'
      : '🔓 Nilai berhasil dibuka! Sekarang dapat diedit kembali.';
    
    showToast(successMsg, 'success');
    
    console.log('Lock status saved successfully:', newLockStatus);
    
    // Update UI
    updateKunciNilaiUI();
    renderTabelNilai();
  } catch(e) {
    // Rollback jika error
    nilaiData.isLocked = currentLockStatus;
    showToast(`Error ${action}: ` + e.message, 'error');
    console.error('Error toggleKunciNilai:', e);
  } finally {
    // Re-enable tombol
    if (btnKunci) {
      btnKunci.disabled = false;
      btnKunci.textContent = originalText;
    }
  }
}
