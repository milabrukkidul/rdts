// ===== KKM (per rombel) =====

let kkmData = {};
let kkmMapelList = [];

async function loadKKM() {
  const rombelId = getActiveRombelId('kkm');
  if (!rombelId) { showToast('Pilih rombel terlebih dahulu!', 'error'); return; }
  try {
    const [kkmRes, nilaiRes] = await Promise.all([
      API.call('getKKM', { kelasId: rombelId }),
      API.call('getNilai', { kelasId: rombelId })
    ]);
    kkmData     = kkmRes.kkm || {};
    kkmMapelList = nilaiRes.mapel || [];
    renderKKM();
    showToast('KKM dimuat!', 'success');
  } catch(e) {}
}

function renderKKM() {
  const container = document.getElementById('kkmContainer');
  if (!kkmMapelList.length) {
    container.innerHTML = '<p class="hint">Belum ada mata pelajaran. Tambahkan di menu Rekap Nilai.</p>';
    return;
  }
  let html = `<table>
    <thead><tr><th>No</th><th>Mata Pelajaran</th><th>KKM (0–100)</th></tr></thead>
    <tbody>`;
  kkmMapelList.forEach((m, i) => {
    const val = kkmData[m] !== undefined ? kkmData[m] : 70;
    const mEsc = m.replace(/\\/g,'\\\\').replace(/'/g,"\\'");
    html += `<tr>
      <td>${i+1}</td>
      <td>${m}</td>
      <td><input type="number" min="0" max="100" value="${val}"
          onchange="updateKKM('${mEsc}',this.value)" style="width:80px;"/></td>
    </tr>`;
  });
  html += `</tbody></table>`;
  container.innerHTML = html;
}

function updateKKM(mapel, val) {
  kkmData[mapel] = parseInt(val) || 70;
}

async function saveKKM() {
  const rombelId = getActiveRombelId('kkm');
  if (!rombelId) { showToast('Pilih rombel terlebih dahulu!', 'error'); return; }
  try {
    await API.post('saveKKM', { kelasId: rombelId, kkm: JSON.stringify(kkmData) });
    showToast('KKM disimpan!', 'success');
  } catch(e) {}
}
