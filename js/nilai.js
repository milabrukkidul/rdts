// ===== REKAP NILAI (per rombel) =====

let nilaiData = { mapel: [], siswa: [], nilai: [], mapelGuru: {}, isLocked: false };

async function loadNilai() {
  const rombelId = getActiveRombelId('nilai');
  if (!rombelId) {
    if (currentUser && currentUser.role === 'admin') {
      nilaiData = { mapel: [], siswa: [], nilai: [], mapelGuru: {}, isLocked: false };
      renderTabelNilai();
      updateKunciNilaiUI();
      return;
    }
    showToast('Pilih rombel terlebih dahulu!', 'error');
    return;
  }
  try {
    // Selalu fresh — jangan cache, karena isLocked harus selalu akurat
    const data = await API.call('getNilai', { kelasId: rombelId }, false);
    if (data.error) { showToast('Error: ' + data.error, 'error'); return; }

    // isLocked bisa datang sebagai boolean atau string dari GAS
    const isLocked = data.isLocked === true || data.isLocked === 'true';

    nilaiData = {
      mapel:     data.mapel     || [],
      siswa:     data.siswa     || [],
      nilai:     data.nilai     || [],
      mapelGuru: data.mapelGuru || {},
      isLocked
    };

    renderTabelNilai();
    updateKunciNilaiUI();

    if (isLocked) {
      showToast('⚠️ Nilai terkunci! Tidak dapat diedit.', 'warning');
    } else {
      showToast('Data nilai dimuat!', 'success');
    }
  } catch(e) {
    showToast('Error memuat data nilai: ' + e.message, 'error');
    console.error('Error loadNilai:', e);
  }
}

// ===== HITUNG JUMLAH & RANGKING =====

function hitungJumlahNilai(nilaiRow, jumlahMapel) {
  let total = 0, ada = false;
  for (let mi = 0; mi < jumlahMapel; mi++) {
    const v = nilaiRow && nilaiRow[mi] !== undefined && nilaiRow[mi] !== ''
      ? parseFloat(nilaiRow[mi]) : null;
    if (v !== null && !isNaN(v)) { total += v; ada = true; }
  }
  return ada ? total : '';
}

function hitungRangking(siswa, nilai, jumlahMapel) {
  const jumlah = siswa.map((s, si) => hitungJumlahNilai(nilai[si], jumlahMapel));
  const sorted = jumlah
    .map((j, si) => ({ si, jumlah: j === '' ? -Infinity : j }))
    .sort((a, b) => b.jumlah - a.jumlah);
  const rangking = new Array(siswa.length);
  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i].jumlah === -Infinity) {
      rangking[sorted[i].si] = '-';
    } else if (i > 0 && sorted[i].jumlah === sorted[i-1].jumlah) {
      rangking[sorted[i].si] = rangking[sorted[i-1].si];
    } else {
      rangking[sorted[i].si] = i + 1;
    }
  }
  return rangking;
}

// ===== RENDER TABEL =====

function renderTabelNilai() {
  const container = document.getElementById('nilaiContainer');
  const { mapel, siswa, nilai, isLocked } = nilaiData;

  if (!siswa || !siswa.length) {
    container.innerHTML = '<p class="hint">Belum ada data siswa di kelas ini.</p>';
    return;
  }
  if (!mapel || !mapel.length) {
    const isAdminCheck = currentUser?.role === 'admin';
    container.innerHTML = `<p class="hint">Belum ada mata pelajaran.${
      isAdminCheck ? ' Tambahkan di panel Admin → Kelola Mapel.' : ' Hubungi admin untuk menambahkan mata pelajaran.'
    }</p>`;
    return;
  }

  // Banner terkunci
  let warningBanner = '';
  if (isLocked) {
    const canUnlock = currentUser && (currentUser.role === 'admin' || currentUser.role === 'walikelas');
    warningBanner = `
    <div style="background:#fef3c7;border:2px solid #f59e0b;border-radius:8px;padding:12px 16px;
                margin-bottom:16px;display:flex;align-items:center;gap:12px;">
      <span style="font-size:1.5rem;">🔒</span>
      <div>
        <strong style="color:#92400e;">Nilai Terkunci</strong>
        <p style="margin:4px 0 0;font-size:0.85rem;color:#92400e;">
          Nilai tidak dapat diedit.
          ${canUnlock ? 'Klik tombol "Buka Kunci" di atas untuk mengedit.' : 'Hubungi admin atau wali kelas.'}
        </p>
      </div>
    </div>`;
  }

  const jumlahArr   = siswa.map((s, si) => hitungJumlahNilai(nilai[si], mapel.length));
  const rangkingArr = hitungRangking(siswa, nilai, mapel.length);

  const isAdmin   = currentUser?.role === 'admin';
  const isWali    = currentUser?.role === 'walikelas';
  const mapelGuru = nilaiData.mapelGuru || {};

  const bolehEditMapel = (mi) => {
    if (isLocked) return false;
    if (isAdmin || isWali) return true;
    return mapelGuru[mapel[mi]] === currentUser?.username;
  };
  const bolehEditKehadiran = !isLocked && (isAdmin || isWali);

  let html = warningBanner + `<div style="overflow-x:auto;"><table>
    <thead><tr><th>No</th><th>Nama Siswa</th>`;

  mapel.forEach(m => { html += `<th style="min-width:90px;">${m}</th>`; });
  html += `<th style="min-width:70px;">Jumlah</th><th style="min-width:70px;">Rangking</th>
           <th>Sakit</th><th>Ijin</th><th>Alpa</th>
           <th style="min-width:180px;">Pesan Wali Kelas</th></tr></thead><tbody>`;

  siswa.forEach((s, si) => {
    html += `<tr><td>${si+1}</td><td style="white-space:nowrap;">${s.nama}</td>`;
    mapel.forEach((m, mi) => {
      const val   = (nilai[si] && nilai[si][mi] !== undefined) ? nilai[si][mi] : '';
      const boleh = bolehEditMapel(mi);
      const style = boleh
        ? 'width:65px;'
        : `width:65px;background:${isLocked ? '#fee2e2' : '#f3f4f6'};color:#9ca3af;cursor:not-allowed;`;
      const title = isLocked ? 'Nilai terkunci' : (boleh ? '' : 'Tidak ada akses mapel ini');
      html += `<td><input type="number" min="0" max="100" value="${val}"
        ${boleh ? `onchange="updateNilai(${si},${mi},this.value)"` : 'disabled'}
        style="${style}" title="${title}"/></td>`;
    });

    const jml = jumlahArr[si]   !== '' ? jumlahArr[si]   : '-';
    const rnk = rangkingArr[si] !== undefined ? rangkingArr[si] : '-';
    html += `<td style="text-align:center;font-weight:600;background:#f0fdf4;">${jml}</td>`;
    html += `<td style="text-align:center;font-weight:600;background:#eff6ff;">${rnk}</td>`;

    const sakit = (nilai[si] && nilai[si]['sakit']) ? nilai[si]['sakit'] : '';
    const ijin  = (nilai[si] && nilai[si]['ijin'])  ? nilai[si]['ijin']  : '';
    const alpa  = (nilai[si] && nilai[si]['alpa'])  ? nilai[si]['alpa']  : '';
    const khStyle = bolehEditKehadiran ? '' : `background:${isLocked ? '#fee2e2' : '#f3f4f6'};color:#9ca3af;`;
    const khTitle = isLocked ? 'Terkunci' : '';

    html += `<td><input type="number" min="0" value="${sakit}"
      ${bolehEditKehadiran ? `onchange="updateKehadiran(${si},'sakit',this.value)"` : 'disabled'}
      style="width:50px;${khStyle}" title="${khTitle}"/></td>`;
    html += `<td><input type="number" min="0" value="${ijin}"
      ${bolehEditKehadiran ? `onchange="updateKehadiran(${si},'ijin',this.value)"` : 'disabled'}
      style="width:50px;${khStyle}" title="${khTitle}"/></td>`;
    html += `<td><input type="number" min="0" value="${alpa}"
      ${bolehEditKehadiran ? `onchange="updateKehadiran(${si},'alpa',this.value)"` : 'disabled'}
      style="width:50px;${khStyle}" title="${khTitle}"/></td>`;

    const pesan = s.pesan || '';
    html += `<td><textarea rows="2"
      ${bolehEditKehadiran ? `onchange="updatePesan(${si},this.value)"` : 'disabled'}
      style="width:170px;font-size:0.78rem;resize:vertical;${khStyle}"
      title="${khTitle}">${pesan}</textarea></td>`;
    html += `</tr>`;
  });

  html += `</tbody></table></div>`;
  container.innerHTML = html;
}

// ===== UPDATE LOCAL STATE =====

function updateNilai(si, mi, val) {
  if (!nilaiData.nilai[si]) nilaiData.nilai[si] = {};
  nilaiData.nilai[si][mi] = val;
  refreshJumlahRangking();
}

function refreshJumlahRangking() {
  const { mapel, siswa, nilai } = nilaiData;
  if (!siswa || !mapel) return;
  const jumlahArr   = siswa.map((s, si) => hitungJumlahNilai(nilai[si], mapel.length));
  const rangkingArr = hitungRangking(siswa, nilai, mapel.length);
  document.querySelectorAll('#nilaiContainer tbody tr').forEach((tr, si) => {
    const tdJml = tr.cells[mapel.length + 2];
    const tdRnk = tr.cells[mapel.length + 3];
    if (tdJml) tdJml.textContent = jumlahArr[si]   !== '' ? jumlahArr[si]   : '-';
    if (tdRnk) tdRnk.textContent = rangkingArr[si] !== undefined ? rangkingArr[si] : '-';
  });
}

function updateKehadiran(si, key, val) {
  if (!nilaiData.nilai[si]) nilaiData.nilai[si] = {};
  nilaiData.nilai[si][key] = val;
}

function updatePesan(si, val) {
  if (!nilaiData.siswa[si]) return;
  nilaiData.siswa[si].pesan = val;
}

// ===== MAPEL (admin only) =====

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
      const keys = Object.keys(row).filter(k => !isNaN(k)).map(Number).sort((a,b) => a-b);
      keys.forEach(k => {
        if (k > mi)        { row[k-1] = row[k]; delete row[k]; }
        else if (k === mi) { delete row[k]; }
      });
    }
  });
  renderTabelNilai();
}

// ===== SIMPAN NILAI =====

async function saveNilai() {
  const rombelId = getActiveRombelId('nilai');
  if (!rombelId) { showToast('Pilih rombel terlebih dahulu!', 'error'); return; }
  if (nilaiData.isLocked) {
    showToast('⚠️ Nilai terkunci! Buka kunci terlebih dahulu.', 'error');
    return;
  }
  try {
    await API.post('saveNilai', {
      kelasId: rombelId,
      mapel:   JSON.stringify(nilaiData.mapel),
      nilai:   JSON.stringify(nilaiData.nilai)
    });
    // Simpan pesan wali kelas
    await Promise.all(nilaiData.siswa.map((s, si) =>
      API.post('saveSiswa', {
        kelasId:  rombelId,
        rowIndex: String(si),
        siswa:    JSON.stringify(s)
      })
    ));
    showToast('Data nilai & pesan wali disimpan!', 'success');
  } catch(e) {
    showToast('Error menyimpan: ' + e.message, 'error');
  }
}

// ===== KUNCI NILAI =====

function updateKunciNilaiUI() {
  const canToggle = currentUser && (currentUser.role === 'admin' || currentUser.role === 'walikelas');
  const btnKunci  = document.getElementById('btnKunciNilai');
  const statusBox = document.getElementById('nilaiLockStatus');
  const rombelId  = getActiveRombelId('nilai');

  if (!canToggle || !rombelId) {
    if (btnKunci)  btnKunci.style.display  = 'none';
    if (statusBox) statusBox.style.display = 'none';
    return;
  }

  if (btnKunci) {
    btnKunci.style.display = '';
    btnKunci.textContent   = nilaiData.isLocked ? '🔓 Buka Kunci' : '🔒 Kunci Nilai';
    btnKunci.className     = nilaiData.isLocked ? 'btn-danger'    : 'btn-primary';
  }
  if (statusBox) {
    statusBox.style.display = nilaiData.isLocked ? 'block' : 'none';
  }
}

async function toggleKunciNilai() {
  const rombelId = getActiveRombelId('nilai');
  if (!rombelId) { showToast('Pilih rombel terlebih dahulu!', 'error'); return; }

  const canToggle = currentUser && (currentUser.role === 'admin' || currentUser.role === 'walikelas');
  if (!canToggle) { showToast('Hanya admin dan wali kelas yang dapat mengunci nilai!', 'error'); return; }

  const newLocked = !nilaiData.isLocked;
  const msg = newLocked
    ? '🔒 Kunci nilai?\n\nSetelah dikunci tidak bisa diedit sampai dibuka kembali.'
    : '🔓 Buka kunci nilai?\n\nNilai dapat diedit kembali.';
  if (!confirm(msg)) return;

  const btn = document.getElementById('btnKunciNilai');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Menyimpan...'; }

  try {
    // Gunakan action saveLock — ringan, tidak perlu kirim data nilai
    await API.post('saveLock', {
      kelasId:  rombelId,
      isLocked: newLocked ? 'true' : 'false'
    });

    nilaiData.isLocked = newLocked;
    showToast(
      newLocked ? '🔒 Nilai berhasil dikunci!' : '🔓 Nilai berhasil dibuka!',
      'success'
    );
    updateKunciNilaiUI();
    renderTabelNilai();
  } catch(e) {
    showToast('Error: ' + e.message, 'error');
    console.error('Error toggleKunciNilai:', e);
  } finally {
    if (btn) btn.disabled = false;
    updateKunciNilaiUI(); // pastikan teks tombol kembali benar
  }
}
