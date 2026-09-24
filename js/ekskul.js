// ===== EKSTRAKURIKULER (per rombel) =====

// Daftar kegiatan ekskul default (dipakai saat data kosong)
const EKSKUL_DEFAULT = [
  'Pramuka', 'Pencak Silat', 'Puisi', 'Pidato',
  'Albanjari', 'Kaligrafi', 'Qiroah', 'Voly', 'Atletik'
];

let ekskulData = { kegiatan: [], siswa: [], nilai: [] };

async function loadEkskul() {
  const rombelId = getActiveRombelId('ekskul');
  if (!rombelId) {
    if (currentUser && currentUser.role === 'admin') {
      ekskulData = { kegiatan: [], siswa: [], nilai: [] };
      renderTabelEkskul();
      return;
    }
    showToast('Pilih rombel terlebih dahulu!', 'error');
    return;
  }
  try {
    const data = await API.call('getEkskul', { kelasId: rombelId });
    if (data.error) { showToast('Error: ' + data.error, 'error'); return; }
    ekskulData = data;

    // Jika kegiatan masih kosong, isi dengan default
    if (!ekskulData.kegiatan || !ekskulData.kegiatan.length) {
      ekskulData.kegiatan = [...EKSKUL_DEFAULT];
    }

    renderTabelEkskul();
    showToast('Data ekskul dimuat!', 'success');
  } catch(e) {
    showToast('Error memuat data ekskul: ' + e.message, 'error');
    console.error('Error loadEkskul:', e);
  }
}

function renderTabelEkskul() {
  const container = document.getElementById('ekskulContainer');
  const { kegiatan, siswa, nilai } = ekskulData;
  const isAdmin = currentUser && currentUser.role === 'admin';

  if (!siswa || !siswa.length) {
    container.innerHTML = '<p class="hint">Belum ada data siswa.</p>';
    return;
  }
  if (!kegiatan || !kegiatan.length) {
    container.innerHTML = '<p class="hint">Belum ada kegiatan ekskul.</p>';
    return;
  }

  let html = `<div style="overflow-x:auto;"><table>
    <thead><tr><th>No</th><th>Nama Siswa</th>`;

  kegiatan.forEach((k, ki) => {
    if (isAdmin) {
      // Admin: header dengan tombol hapus
      html += `<th style="min-width:110px;">${k}<br/>
        <button class="btn-danger" onclick="hapusKegiatan(${ki})"
          style="padding:1px 5px;font-size:0.7rem;margin-top:3px;">✖</button>
      </th>`;
    } else {
      // Wali kelas: header tanpa tombol hapus
      html += `<th style="min-width:110px;">${k}</th>`;
    }
  });

  html += `</tr></thead><tbody>`;

  siswa.forEach((s, si) => {
    html += `<tr><td>${si+1}</td><td style="white-space:nowrap;">${s.nama}</td>`;
    kegiatan.forEach((_k, ki) => {
      const val = (nilai[si] && nilai[si][ki] !== undefined) ? nilai[si][ki] : '';
      html += `<td>
        <select onchange="updateEkskul(${si},${ki},this.value)" style="width:110px;">
          <option value="">-</option>
          <option value="A" ${val==='A'?'selected':''}>A (Sangat Baik)</option>
          <option value="B" ${val==='B'?'selected':''}>B (Baik)</option>
          <option value="C" ${val==='C'?'selected':''}>C (Cukup)</option>
        </select>
      </td>`;
    });
    html += `</tr>`;
  });

  html += `</tbody></table></div>`;

  // Tombol tambah kegiatan — hanya admin
  if (isAdmin) {
    html += `<div style="margin-top:10px;">
      <button class="btn-success" onclick="tambahEkskul()" style="font-size:0.83rem;">
        ➕ Tambah Kegiatan
      </button>
    </div>`;
  }

  container.innerHTML = html;
}

function updateEkskul(si, ki, val) {
  if (!ekskulData.nilai[si]) ekskulData.nilai[si] = {};
  ekskulData.nilai[si][ki] = val;
}

function tambahEkskul() {
  if (currentUser?.role !== 'admin') {
    showToast('Hanya admin yang bisa menambah kegiatan ekskul.', 'error');
    return;
  }
  const nama = prompt('Nama Kegiatan Ekstrakurikuler:');
  if (!nama || !nama.trim()) return;
  if (ekskulData.kegiatan.includes(nama.trim())) {
    showToast(`"${nama.trim()}" sudah ada!`, 'error');
    return;
  }
  ekskulData.kegiatan.push(nama.trim());
  renderTabelEkskul();
}

function hapusKegiatan(ki) {
  if (currentUser?.role !== 'admin') {
    showToast('Hanya admin yang bisa menghapus kegiatan ekskul.', 'error');
    return;
  }
  if (!confirm(`Hapus kegiatan "${ekskulData.kegiatan[ki]}"? Semua nilai kegiatan ini akan hilang!`)) return;
  ekskulData.kegiatan.splice(ki, 1);
  // Rebuild nilai index setelah hapus
  ekskulData.nilai.forEach(row => {
    if (row && typeof row === 'object') {
      const keys = Object.keys(row).filter(k => !isNaN(k)).map(Number).sort((a, b) => a - b);
      keys.forEach(k => {
        if (k > ki)       { row[k - 1] = row[k]; delete row[k]; }
        else if (k === ki) { delete row[k]; }
      });
    }
  });
  renderTabelEkskul();
}

async function saveEkskul() {
  const rombelId = getActiveRombelId('ekskul');
  if (!rombelId) { showToast('Pilih rombel terlebih dahulu!', 'error'); return; }
  try {
    await API.post('saveEkskul', {
      kelasId:  rombelId,
      kegiatan: JSON.stringify(ekskulData.kegiatan),
      nilai:    JSON.stringify(ekskulData.nilai)
    });
    showToast('Data ekskul disimpan!', 'success');
  } catch(e) {}
}
