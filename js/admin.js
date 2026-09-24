// ===== ADMIN =====

let adminUserCache  = [];

async function loadAdminData() {
  const token = API.getToken();
  if (!token) { showToast('Sesi tidak valid, silakan login ulang.', 'error'); return; }
  try {
    const [uRes, rRes] = await Promise.all([
      API.call('getUsers'),
      API.call('getRombel')
    ]);
    adminUserCache  = uRes.users || [];
    rombelCache     = rRes.rombel || [];
    renderTabelRombel();
    renderTabelUser();
    onRombelListLoaded(rombelCache);
  } catch(e) {}
}

// ============================================================
// HELPERS
// ============================================================
function buildWaliOptions(sel = '') {
  const list = adminUserCache.filter(u => u.role === 'walikelas');
  let o = '<option value="">-- Pilih Wali Kelas (opsional) --</option>';
  list.forEach(u => { o += `<option value="${u.username}" ${u.username===sel?'selected':''}>${u.nama} (${u.username})</option>`; });
  if (!list.length) o += '<option value="" disabled>Belum ada user Wali Kelas</option>';
  return o;
}
function buildWaliSelect(id, sel = '') {
  const list = adminUserCache.filter(u => u.role === 'walikelas');
  let h = `<select id="${id}" style="width:100%;padding:5px 4px;border:1px solid #d1d5db;border-radius:4px;font-size:0.78rem;"><option value="">-- Pilih --</option>`;
  list.forEach(u => { h += `<option value="${u.username}" ${u.username===sel?'selected':''}>${u.nama}</option>`; });
  return h + '</select>';
}

// ============================================================
// USER
// ============================================================
function renderTabelUser() {
  const tbody = document.getElementById('bodyUser');
  tbody.innerHTML = '';
  if (!adminUserCache.length) { tbody.innerHTML='<tr><td colspan="6" class="hint">Belum ada user.</td></tr>'; return; }
  const rl = { admin:'🔴 Admin', walikelas:'🟡 Wali Kelas', guruMapel:'🟢 Guru Mapel' };
  adminUserCache.forEach((u,i) => {
    let rombelLabel = u.rombelId || '-';
    try { const a = JSON.parse(u.rombelId); if (Array.isArray(a)) rombelLabel = a.length ? a.join(', ') : '-'; } catch(e) {}
    const assignBtn = u.role === 'guruMapel'
      ? `<button class="btn-primary" onclick="modalAssignRombelGuru('${u.username}')" style="padding:3px 8px;font-size:0.78rem;margin-left:4px;" title="Assign Rombel">🏫</button>`
      : '';
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${i+1}</td><td><strong>${u.username}</strong></td><td>${u.nama}</td>
      <td>${rl[u.role]||u.role}</td>
      <td style="font-size:0.8rem;max-width:160px;">${rombelLabel}</td>
      <td style="white-space:nowrap;">
        <button class="btn-warning" onclick="modalUser(${i})" style="padding:3px 8px;font-size:0.78rem;">✏️</button>
        ${assignBtn}
        <button class="btn-primary" onclick="modalResetPassword('${u.username}','${u.nama}')" style="padding:3px 8px;font-size:0.78rem;margin-left:4px;">🔑</button>
        <button class="btn-danger" onclick="hapusUser('${u.username}')" style="padding:3px 8px;font-size:0.78rem;margin-left:4px;">🗑️</button>
      </td>`;
    tbody.appendChild(tr);
  });
}

function modalUser(idx) {
  const isEdit = idx !== undefined;
  document.getElementById('modalUserTitle').textContent = isEdit ? 'Edit User' : 'Tambah User';
  document.getElementById('mu_idx').value = isEdit ? idx : -1;
  if (isEdit) {
    const u = adminUserCache[idx];
    document.getElementById('mu_username').value = u.username;
    document.getElementById('mu_username').disabled = true;
    document.getElementById('mu_password').value = '';
    document.getElementById('mu_nama').value = u.nama;
    document.getElementById('mu_role').value = u.role;
  } else {
    document.getElementById('mu_username').value = '';
    document.getElementById('mu_username').disabled = false;
    document.getElementById('mu_password').value = '';
    document.getElementById('mu_nama').value = '';
    document.getElementById('mu_role').value = 'walikelas';
  }
  document.getElementById('modalUser').classList.remove('hidden');
}
function toggleUserRombel() {}
async function simpanUser() {
  const idx = parseInt(document.getElementById('mu_idx').value);
  const username = document.getElementById('mu_username').value.trim();
  const password = document.getElementById('mu_password').value;
  const nama = document.getElementById('mu_nama').value.trim();
  const role = document.getElementById('mu_role').value;
  if (!username||!nama) { showToast('Username dan Nama wajib!','error'); return; }
  if (idx===-1&&!password) { showToast('Password wajib untuk user baru!','error'); return; }
  try {
    await API.post('saveUser',{user:JSON.stringify({username,password,nama,role,rombelId:''}),isNew:idx===-1});
    closeModal('modalUser'); showToast('User disimpan!','success'); await loadAdminData();
  } catch(e) {}
}
async function hapusUser(username) {
  if (username==='admin') { showToast('User admin tidak bisa dihapus!','error'); return; }
  if (!confirm(`Hapus user "${username}"?`)) return;
  try { await API.post('deleteUser',{username}); showToast('User dihapus!','success'); await loadAdminData(); } catch(e) {}
}

// ============================================================
// RESET PASSWORD
// ============================================================
function modalResetPassword(username, nama) {
  document.getElementById('rp_username').value = username;
  document.getElementById('rp_usernameLabel').textContent = `${nama} (${username})`;
  document.getElementById('rp_newPass').value = '';
  document.getElementById('rp_confirmPass').value = '';
  document.getElementById('rp_error').classList.add('hidden');
  document.getElementById('rp_newPass').type = 'password';
  document.getElementById('rp_eyeBtn').textContent = '👁️';
  document.getElementById('modalResetPass').classList.remove('hidden');
}
function togglePassVisibility(inputId, btnId) {
  const inp = document.getElementById(inputId), btn = document.getElementById(btnId);
  if (inp.type==='password') { inp.type='text'; btn.textContent='🙈'; }
  else { inp.type='password'; btn.textContent='👁️'; }
}
async function simpanResetPassword() {
  const username = document.getElementById('rp_username').value;
  const newPass = document.getElementById('rp_newPass').value;
  const confirmPass = document.getElementById('rp_confirmPass').value;
  const errEl = document.getElementById('rp_error');
  errEl.classList.add('hidden');
  if (!newPass) { errEl.textContent='Password tidak boleh kosong.'; errEl.classList.remove('hidden'); return; }
  if (newPass.length<6) { errEl.textContent='Minimal 6 karakter.'; errEl.classList.remove('hidden'); return; }
  if (newPass!==confirmPass) { errEl.textContent='Konfirmasi tidak cocok.'; errEl.classList.remove('hidden'); return; }
  try { await API.post('resetPassword',{username,newPassword:newPass}); closeModal('modalResetPass'); showToast(`Password ${username} direset!`,'success'); } catch(e) {}
}

// ============================================================
// ROMBEL
// ============================================================
const MAPEL_UTAMA = [
  'Al-Qur\'an Hadits','Aqidah Akhlak','Fiqih','Bahasa Arab',
  'PPKn','Bahasa Indonesia','Matematika','SBdP','PJOK',
  'IPAS','Nahwu-Shorof','Sejarah Kebudayaan Islam'
];
const MAPEL_MULOK = ['Bahasa Daerah','Bahasa Inggris','Pego','Aswaja'];

let rombelCache = [];

async function loadRombelAdmin() {
  try {
    const data = await API.call('getRombel');
    rombelCache = data.rombel || [];
    renderTabelRombel();
  } catch(e) {}
}

function renderTabelRombel() {
  const tbody = document.getElementById('bodyRombel');
  if (!tbody) return;
  tbody.innerHTML = '';
  if (!rombelCache.length) { tbody.innerHTML='<tr><td colspan="6" class="hint">Belum ada rombel. Klik "Tambah Rombel".</td></tr>'; return; }
  rombelCache.forEach((r,i) => {
    const waliNama = r.waliNama || r.wali || '-';
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${i+1}</td><td><strong>${r.id}</strong></td><td>${r.nama}</td>
      <td>${waliNama}</td>
      <td style="font-size:0.8rem;color:#555;max-width:300px;">${r.mapel.join(', ')||'-'}</td>
      <td style="white-space:nowrap;">
        <button class="btn-warning" onclick="modalRombel(${i})" style="padding:3px 8px;font-size:0.78rem;">✏️</button>
        <button class="btn-danger" onclick="hapusRombel('${r.id}')" style="padding:3px 8px;font-size:0.78rem;margin-left:4px;">🗑️</button>
      </td>`;
    tbody.appendChild(tr);
  });
}

let rombelMapelTemp = [];
let rombelMapelGuruTemp = {}; // { "NamaMapel": "usernameGuru" }

function modalRombel(idx) {
  const isEdit = idx !== undefined;
  document.getElementById('modalRombelTitle').textContent = isEdit ? 'Edit Rombel' : 'Tambah Rombel';
  document.getElementById('mr_wali').innerHTML = buildWaliOptions();
  if (isEdit) {
    const r = rombelCache[idx];
    document.getElementById('mr_id_hidden').value = r.id;
    document.getElementById('mr_id').value = r.id;
    document.getElementById('mr_id').disabled = true;
    document.getElementById('mr_nama').value = r.nama;
    document.getElementById('mr_wali').innerHTML = buildWaliOptions(r.wali || '');
    rombelMapelTemp      = [...r.mapel];
    rombelMapelGuruTemp  = Object.assign({}, r.mapelGuru || {});
  } else {
    document.getElementById('mr_id_hidden').value = '';
    document.getElementById('mr_id').value = '';
    document.getElementById('mr_id').disabled = false;
    document.getElementById('mr_nama').value = '';
    rombelMapelTemp     = [];
    rombelMapelGuruTemp = {};
  }
  document.getElementById('mr_mapelCustom').value = '';
  renderRefMapel();
  renderRombelMapelList();
  document.getElementById('modalRombel').classList.remove('hidden');
}

function renderRefMapel() {
  _renderRefGroup('refMapelUtama', MAPEL_UTAMA);
  _renderRefGroup('refMapelMulok', MAPEL_MULOK);
}
function _renderRefGroup(containerId, list) {
  const c = document.getElementById(containerId);
  if (!c) return;
  c.innerHTML = '';
  list.forEach(m => {
    const dipilih = rombelMapelTemp.includes(m);
    const btn = document.createElement('button');
    btn.textContent = (dipilih ? '✅ ' : '') + m;
    btn.style.cssText = `padding:4px 10px;border-radius:20px;border:1px solid ${dipilih?'#16a34a':'#d1d5db'};
      background:${dipilih?'#dcfce7':'#fff'};color:${dipilih?'#15803d':'#374151'};
      cursor:pointer;font-size:0.8rem;transition:all 0.15s;`;
    btn.onclick = () => toggleRefMapel(m);
    c.appendChild(btn);
  });
}
function toggleRefMapel(nama) {
  const idx = rombelMapelTemp.indexOf(nama);
  if (idx >= 0) rombelMapelTemp.splice(idx,1); else rombelMapelTemp.push(nama);
  renderRefMapel(); renderRombelMapelList();
}
function tambahMapelCustomRombel() {
  const inp = document.getElementById('mr_mapelCustom');
  const nama = inp.value.trim();
  if (!nama) return;
  if (rombelMapelTemp.includes(nama)) { showToast(`"${nama}" sudah ada!`,'error'); return; }
  rombelMapelTemp.push(nama); inp.value = '';
  renderRefMapel(); renderRombelMapelList();
}
function kosongkanMapelRombel() {
  if (!rombelMapelTemp.length) return;
  if (!confirm('Kosongkan semua mapel?')) return;
  rombelMapelTemp = []; renderRefMapel(); renderRombelMapelList();
}
function renderRombelMapelList() {
  const c = document.getElementById('rombelMapelList');
  const j = document.getElementById('mr_jumlah');
  if (j) j.textContent = rombelMapelTemp.length ? `(${rombelMapelTemp.length} mapel)` : '';
  if (!rombelMapelTemp.length) {
    c.innerHTML = '<p style="color:#888;font-size:0.83rem;padding:10px;text-align:center;">Belum ada mapel dipilih.</p>';
    return;
  }

  // Buat opsi guru: semua user role walikelas & guruMapel
  const guruList = adminUserCache.filter(u => u.role === 'walikelas' || u.role === 'guruMapel');
  const guruOptions = guruList.map(u =>
    `<option value="${u.username}">${u.nama} (${u.role === 'walikelas' ? 'Wali' : 'Guru'})</option>`
  ).join('');

  c.innerHTML = rombelMapelTemp.map((m, i) => {
    const guruTerpilih = rombelMapelGuruTemp[m] || '';
    return `
    <div style="display:flex;gap:6px;align-items:center;background:#fff;padding:4px 6px;border-radius:4px;border:1px solid #e5e7eb;">
      <span style="color:#888;font-size:0.78rem;min-width:22px;">${i+1}.</span>
      <input type="text" value="${m}" onchange="updateMapelRombel(${i},this.value)"
        style="flex:1;padding:4px 7px;border:1px solid #d1d5db;border-radius:4px;font-size:0.83rem;"/>
      <select onchange="updateGuruMapelRombel('${m.replace(/'/g,"\\'")}',this.value)"
        style="padding:4px 6px;border:1px solid #d1d5db;border-radius:4px;font-size:0.78rem;min-width:130px;"
        title="Guru pengampu mapel ini">
        <option value="">— Guru —</option>
        ${guruOptions}
      </select>
      <button onclick="naikkMapelRombel(${i})" style="background:none;border:none;cursor:pointer;font-size:0.85rem;">⬆️</button>
      <button onclick="turunMapelRombel(${i})" style="background:none;border:none;cursor:pointer;font-size:0.85rem;">⬇️</button>
      <button onclick="hapusMapelRombel(${i})" style="background:#dc2626;color:#fff;border:none;border-radius:4px;padding:2px 7px;cursor:pointer;font-size:0.78rem;">✖</button>
    </div>`;
  }).join('');

  // Set nilai dropdown setelah render
  rombelMapelTemp.forEach(m => {
    const guruTerpilih = rombelMapelGuruTemp[m] || '';
    if (!guruTerpilih) return;
    // Cari select yang sesuai dan set value-nya
    const selects = c.querySelectorAll('select');
    selects.forEach((sel, i) => {
      if (rombelMapelTemp[i] === m) sel.value = guruTerpilih;
    });
  });
}
function updateMapelRombel(i, val) {
  const lama = rombelMapelTemp[i];
  rombelMapelTemp[i] = val.trim();
  // Pindahkan assignment guru jika nama mapel berubah
  if (lama && lama !== val.trim() && rombelMapelGuruTemp[lama]) {
    rombelMapelGuruTemp[val.trim()] = rombelMapelGuruTemp[lama];
    delete rombelMapelGuruTemp[lama];
  }
  renderRefMapel();
}

function updateGuruMapelRombel(mapelNama, guruUsername) {
  if (guruUsername) {
    rombelMapelGuruTemp[mapelNama] = guruUsername;
  } else {
    delete rombelMapelGuruTemp[mapelNama];
  }
}
function hapusMapelRombel(i) {
  const nama = rombelMapelTemp[i];
  rombelMapelTemp.splice(i, 1);
  if (nama) delete rombelMapelGuruTemp[nama];
  renderRefMapel(); renderRombelMapelList();
}
function naikkMapelRombel(i) { if(i>0){[rombelMapelTemp[i-1],rombelMapelTemp[i]]=[rombelMapelTemp[i],rombelMapelTemp[i-1]];renderRombelMapelList();} }
function turunMapelRombel(i) { if(i<rombelMapelTemp.length-1){[rombelMapelTemp[i],rombelMapelTemp[i+1]]=[rombelMapelTemp[i+1],rombelMapelTemp[i]];renderRombelMapelList();} }

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('mr_mapelCustom')?.addEventListener('keydown', e => {
    if (e.key==='Enter') tambahMapelCustomRombel();
  });
});

async function simpanRombel() {
  const id = (document.getElementById('mr_id_hidden').value||document.getElementById('mr_id').value).trim().replace(/\s+/g,'_');
  const nama = document.getElementById('mr_nama').value.trim();
  const wali = document.getElementById('mr_wali').value;
  if (!id) { showToast('ID Rombel wajib!','error'); return; }
  if (!nama) { showToast('Nama Rombel wajib!','error'); return; }
  if (!rombelMapelTemp.length) { showToast('Minimal 1 mapel!','error'); return; }
  try {
    await API.post('saveRombel', { rombel: JSON.stringify({ id, nama, wali, mapel: rombelMapelTemp, mapelGuru: rombelMapelGuruTemp }) });
    closeModal('modalRombel');
    showToast(`Rombel "${nama}" disimpan!`,'success');
    await loadAdminData();
  } catch(e) {}
}
async function hapusRombel(id) {
  if (!confirm(`Hapus rombel "${id}"?\nSEMUA data (siswa, nilai, ekskul, KKM) akan terhapus permanen!`)) return;
  try { await API.post('deleteRombel',{rombelId:id}); showToast('Rombel dihapus!','success'); await loadAdminData(); } catch(e) {}
}

// ============================================================
// ASSIGN ROMBEL KE GURU MAPEL
// ============================================================
function modalAssignRombelGuru(username) {
  const user = adminUserCache.find(u => u.username === username);
  if (!user) return;
  document.getElementById('assignGuruUsername').value = username;
  document.getElementById('assignGuruLabel').textContent = `${user.nama} (${username})`;
  document.getElementById('assignError').textContent = '';
  let assigned = [];
  try { const p = JSON.parse(user.rombelId); if (Array.isArray(p)) assigned = p; } catch(e) { if (user.rombelId) assigned = [user.rombelId]; }
  const box = document.getElementById('assignRombelCheckboxes');
  box.innerHTML = '';
  if (!rombelCache.length) { box.innerHTML='<p style="color:#888;font-size:0.85rem;">Belum ada rombel.</p>'; }
  else {
    rombelCache.forEach(r => {
      const lbl = document.createElement('label');
      lbl.style.cssText = 'display:flex;align-items:center;gap:8px;cursor:pointer;font-size:0.88rem;padding:4px 0;';
      lbl.innerHTML = `<input type="checkbox" value="${r.id}" ${assigned.includes(r.id)?'checked':''} style="width:16px;height:16px;"/>
        <span>${r.nama} <small style="color:#888;">(${r.id})</small></span>`;
      box.appendChild(lbl);
    });
  }
  document.getElementById('modalAssignRombelGuru').classList.remove('hidden');
}
async function simpanAssignRombelGuru() {
  const username   = document.getElementById('assignGuruUsername').value;
  const rombelList = [...document.querySelectorAll('#assignRombelCheckboxes input:checked')].map(c=>c.value);
  try {
    await API.post('saveGuruRombel',{username,rombelList});
    closeModal('modalAssignRombelGuru');
    showToast(`Rombel untuk ${username} disimpan (${rombelList.length} rombel)!`,'success');
    await loadAdminData();
  } catch(e) {}
}
