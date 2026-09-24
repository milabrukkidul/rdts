// ============================================================
// GOOGLE APPS SCRIPT - RAPOR DIGITAL (Rombel-Based + Auth)
// ============================================================
// CARA SETUP (SEKALI SAJA):
// 1. Paste kode ini di Google Apps Script
// 2. Jalankan fungsi setupSheets() SEKALI
// 3. Deploy → New Deployment → Web App
//    Execute as: Me | Who has access: Anyone
// 4. Copy URL Web App → paste ke konstanta GAS_URL di js/api.js
// 5. Commit & push ke GitHub — selesai, tidak perlu diubah lagi
// ============================================================

const SS = SpreadsheetApp.getActiveSpreadsheet();

const SH_USERS   = '_USERS';
const SH_SETTING = '_SETTING';   // setting global (berlaku semua rombel)
const SH_ROMBEL  = '_ROMBEL';    // rombongan belajar

// ===== RESPONSE =====
function R(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ===== SHEET HELPER =====
function getSheet(name) {
  return SS.getSheetByName(name) || SS.insertSheet(name);
}
function shName(rombelId, suffix) {
  return rombelId + '_' + suffix;
}

// ===== AUTH =====
// Token format: "username|base64(username:password)"
// Dikirim via URL sudah di-encodeURIComponent, GAS decode otomatis via e.parameter

function makeToken_(username, password) {
  // Gunakan separator | agar tidak bentrok dengan karakter base64
  const hash = Utilities.base64Encode(username + ':' + password);
  return username + '|' + hash;
}

function verifyToken(token) {
  if (!token) return null;
  // Decode jika masih ter-encode (jaga-jaga)
  try { token = decodeURIComponent(token); } catch(e) {}

  const sep = token.indexOf('|');
  if (sep < 0) return null;
  const username = token.substring(0, sep);
  const hash     = token.substring(sep + 1);

  const { users } = getUsers_();
  const user = users.find(u => u.username === username);
  if (!user) return null;

  const expected = Utilities.base64Encode(username + ':' + user.password);
  if (hash !== expected) return null;
  return user;
}

// Helper: parse rombelId yang bisa berupa string tunggal atau JSON array
function parseRombelId_(rombelId) {
  if (!rombelId) return [];
  try {
    const parsed = JSON.parse(rombelId);
    if (Array.isArray(parsed)) return parsed.filter(Boolean);
  } catch(e) {}
  return rombelId ? [rombelId] : [];
}

function isAdmin(token) {
  const u = verifyToken(token);
  return u && u.role === 'admin';
}

function canAccessRombel(token, rombelId) {
  const u = verifyToken(token);
  if (!u) return false;
  if (u.role === 'admin') return true;
  const requestedRombelId = (rombelId || '').toString().trim().toLowerCase();
  const userRombelId = (u.rombelId || '').toString().trim().toLowerCase();
  Logger.log('canAccessRombel - user: ' + u.username + ', role: ' + u.role + ', user.rombelId: "' + userRombelId + '", requested: "' + requestedRombelId + '"');
  if (userRombelId === requestedRombelId) return true;
  // guruMapel: cek via rombelId array ATAU via mapelGuru di rombel
  if (u.role === 'guruMapel') {
    const rombelList = parseRombelId_(u.rombelId);
    if (rombelList.map(id => id.toLowerCase()).includes(requestedRombelId)) return true;
    // Cek apakah guru ini ada di mapelGuru rombel yang diminta
    return isGuruDiRombel_(u.username, rombelId);
  }
  return false;
}

function canEditNilai(token, rombelId) {
  const u = verifyToken(token);
  if (!u) return false;
  if (u.role === 'admin') return true;
  if (!rombelId) return false;
  const requestedRombelId = (rombelId || '').toString().trim().toLowerCase();
  if (u.role === 'walikelas') {
    const userRombelId = (u.rombelId || '').toString().trim().toLowerCase();
    return userRombelId === requestedRombelId;
  }
  if (u.role === 'guruMapel') {
    const rombelList = parseRombelId_(u.rombelId);
    if (rombelList.map(id => id.toLowerCase()).includes(requestedRombelId)) return true;
    // Cek via mapelGuru di rombel
    return isGuruDiRombel_(u.username, rombelId);
  }
  return false;
}

// Cek apakah username guru ada di mapelGuru rombel tertentu
function isGuruDiRombel_(username, rombelId) {
  try {
    const { rombel } = getRombel_();
    const info = rombel.find(r => r.id.toLowerCase() === (rombelId || '').toLowerCase());
    if (!info || !info.mapelGuru) return false;
    return Object.values(info.mapelGuru).includes(username);
  } catch(e) { return false; }
}

// Ambil semua rombelId yang punya username ini di mapelGuru
function getRombelByGuruMapel_(username) {
  try {
    const { rombel } = getRombel_();
    return rombel
      .filter(r => r.mapelGuru && Object.values(r.mapelGuru).includes(username))
      .map(r => r.id);
  } catch(e) { return []; }
}

// ===== ROUTER =====
// Semua request dikirim via POST dari frontend.
// doGet tetap difungsikan sebagai fallback agar tidak error.
function doGet(e) {
  const p = e.parameter;
  try {
    switch(p.action) {
      case 'login':          return R(login_(p.username, p.password));
      // Fallback: forward ke doPost logic dengan token dari query param
      default:
        const fakeBody = Object.assign({ token: p.token || '' }, p);
        return handleAction_(fakeBody);
    }
  } catch(err) { return R({ error: err.message }); }
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    return handleAction_(body);
  } catch(err) { return R({ error: err.message }); }
}

function handleAction_(body) {
  try {
    switch(body.action) {
      // ── Publik (tanpa token) ──
      case 'login':         return R(login_(body.username, body.password));
      
      // ── Admin read ──
      case 'getUsers':      return R(requireAdmin(body.token, () => getUsers_()));
      // getRombel: izinkan semua user yang login (wali kelas perlu data ini untuk cetak rapor)
      case 'getRombel':     return R(verifyToken(body.token) ? getRombel_() : { error: 'Akses ditolak' });
      
      // ── Setting global (semua user bisa baca untuk cetak rapor, hanya admin bisa edit) ──
      case 'getSetting':    return R(verifyToken(body.token) ? getSettingGlobal_() : { error: 'Akses ditolak' });
      
      // ── Per-rombel read (kelasId di parameter sebenarnya adalah rombelId) ──
      case 'getSiswa':      return R(requireRombel(body.token, body.kelasId, () => getSiswa_(body.kelasId)));
      case 'getNilai':      return R(requireNilai(body.token, body.kelasId, () => getNilai_(body.kelasId)));
      case 'getEkskul':     return R(requireRombel(body.token, body.kelasId, () => getEkskul_(body.kelasId)));
      
      // ── KKM (admin only) ──
      case 'getKKM':        return R(requireAdmin(body.token, () => getKKM_(body.kelasId)));
      
      // ── Admin write ──
      case 'saveUser':      return R(requireAdmin(body.token, () => saveUser_(body)));
      case 'deleteUser':    return R(requireAdmin(body.token, () => deleteUser_(body)));
      case 'resetPassword': return R(requireAdmin(body.token, () => resetPassword_(body)));
      case 'saveGuruRombel':return R(requireAdmin(body.token, () => saveGuruRombel_(body)));
      case 'saveSetting':   return R(requireAdmin(body.token, () => saveSettingGlobal_(body)));
      case 'saveRombel':    return R(requireAdmin(body.token, () => saveRombel_(body)));
      case 'deleteRombel':  return R(requireAdmin(body.token, () => deleteRombel_(body)));
      
      // ── Per-rombel write ──
      case 'saveSiswa':     return R(requireRombel(body.token, body.kelasId, () => saveSiswa_(body)));
      case 'deleteSiswa':   return R(requireRombel(body.token, body.kelasId, () => deleteSiswa_(body)));
      case 'importSiswa':   return R(requireRombel(body.token, body.kelasId, () => importSiswa_(body)));
      case 'saveNilai':     return R(requireNilai(body.token, body.kelasId, () => saveNilai_(body)));
      case 'saveEkskul':    return R(requireRombel(body.token, body.kelasId, () => saveEkskul_(body)));
      
      // ── KKM write (admin only) ──
      case 'saveKKM':       return R(requireAdmin(body.token, () => saveKKM_(body)));

      // ── Pengumuman ──
      case 'getAnnouncements':  return R(verifyToken(body.token) ? getAnnouncements_() : { error: 'Akses ditolak' });
      case 'saveAnnouncement':  return R(requireAdmin(body.token, () => saveAnnouncement_(body)));
      case 'deleteAnnouncement':return R(requireAdmin(body.token, () => deleteAnnouncement_(body)));

      default:              return R({ error: 'Unknown action: ' + body.action });
    }
  } catch(err) { return R({ error: err.message }); }
}

// ===== AUTH GUARDS =====
function requireAdmin(token, fn) {
  if (!isAdmin(token)) return { error: 'Akses ditolak. Hanya admin.' };
  return fn();
}
function requireRombel(token, rombelId, fn) {
  const u = verifyToken(token);
  if (!u) return { error: 'Akses ditolak. Token tidak valid.' };
  if (!canAccessRombel(token, rombelId)) {
    return { error: `Akses ditolak. User ${u.username} (${u.role}) tidak bisa akses rombel ${rombelId}. RombelId user: ${u.rombelId}` };
  }
  return fn();
}
function requireNilai(token, rombelId, fn) {
  if (!canEditNilai(token, rombelId)) return { error: 'Akses ditolak.' };
  return fn();
}

// ============================================================
// LOGIN
// ============================================================
function login_(username, password) {
  if (!username || !password) return { success: false, message: 'Username/password kosong.' };
  const { users } = getUsers_();
  const user = users.find(u => u.username === username && u.password === password);
  if (!user) return { success: false, message: 'Username atau password salah.' };

  // rombelId: admin = '', walikelas = string, guruMapel = array JSON
  let userRombelId;
  if (user.role === 'admin') {
    userRombelId = '';
  } else if (user.role === 'guruMapel') {
    // Gabungkan: rombelId yang di-assign manual + rombel yang punya username ini di mapelGuru
    const fromUser  = parseRombelId_(user.rombelId);
    const fromMapel = getRombelByGuruMapel_(user.username);
    const merged    = [...new Set([...fromUser, ...fromMapel])];
    userRombelId    = merged;
  } else {
    userRombelId = user.rombelId || ''; // string
  }

  const token = makeToken_(user.username, user.password);
  return {
    success: true,
    user: {
      username:  user.username,
      nama:      user.nama,
      role:      user.role,
      rombelId:  userRombelId,  // string untuk admin/walikelas, array untuk guruMapel
      token:     token
    }
  };
}

// ============================================================
// USERS
// Kolom _USERS: username | password | nama | role | rombelId
// ============================================================
function getUsers_() {
  const sh = getSheet(SH_USERS);
  const data = sh.getDataRange().getValues();
  if (data.length <= 1) return { users: [] };
  const users = data.slice(1).map(r => ({
    username: String(r[0] || ''),
    password: String(r[1] || ''),
    nama:     String(r[2] || ''),
    role:     String(r[3] || ''),
    rombelId: String(r[4] || '')
  })).filter(u => u.username);
  return { users };
}

function saveUser_(body) {
  const u     = JSON.parse(body.user);
  const isNew = body.isNew === true || body.isNew === 'true';
  const sh    = getSheet(SH_USERS);
  const data  = sh.getDataRange().getValues();
  let found   = -1;
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === u.username) { found = i + 1; break; }
  }

  // Pertahankan password lama jika kosong (edit)
  let password = u.password;
  if (!isNew && !password && found > 0) password = String(data[found-1][1]);

  // Pertahankan rombelId lama — rombelId HANYA diubah lewat saveRombel atau saveGuruRombel
  let rombelId = u.rombelId || '';
  if (!isNew && found > 0) {
    rombelId = String(data[found-1][4] || ''); // kolom 5 = rombelId
  }

  const row = [u.username, password, u.nama, u.role, rombelId];
  if (found > 0) {
    sh.getRange(found, 1, 1, 5).setValues([row]);
  } else {
    sh.appendRow(row);
  }
  return { success: true };
}

function deleteUser_(body) {
  const username = body.username;
  if (username === 'admin') return { error: 'User admin tidak bisa dihapus.' };
  const sh   = getSheet(SH_USERS);
  const data = sh.getDataRange().getValues();
  for (let i = data.length - 1; i >= 1; i--) {
    if (String(data[i][0]) === username) { sh.deleteRow(i + 1); break; }
  }
  return { success: true };
}

// Simpan daftar rombel untuk guru mapel (array JSON)
function saveGuruRombel_(body) {
  const { username, rombelList } = body;
  if (!username) return { error: 'Username kosong.' };
  const sh   = getSheet(SH_USERS);
  const data = sh.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === username) {
      sh.getRange(i + 1, 5).setValue(JSON.stringify(rombelList || []));
      return { success: true };
    }
  }
  return { error: 'User tidak ditemukan.' };
}

function resetPassword_(body) {
  const { username, newPassword } = body;
  if (!username || !newPassword) return { error: 'Data tidak lengkap.' };
  if (newPassword.length < 6) return { error: 'Password minimal 6 karakter.' };
  const sh   = getSheet(SH_USERS);
  const data = sh.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === username) {
      sh.getRange(i + 1, 2).setValue(newPassword);
      return { success: true };
    }
  }
  return { error: 'User tidak ditemukan.' };
}

// ============================================================
// SETTING GLOBAL (berlaku semua rombel)
// ============================================================
function getSettingGlobal_() {
  const sh   = getSheet(SH_SETTING);
  const data = sh.getDataRange().getValues();
  const setting = {};
  data.forEach(r => { if (r[0]) setting[r[0]] = r[1] !== undefined ? String(r[1]) : ''; });
  return { setting };
}

function saveSettingGlobal_(body) {
  const setting = JSON.parse(body.setting);
  const sh = getSheet(SH_SETTING);
  sh.clearContents();
  const rows = Object.entries(setting).map(([k, v]) => [k, v]);
  if (rows.length) sh.getRange(1, 1, rows.length, 2).setValues(rows);
  return { success: true };
}

// ============================================================
// ROMBEL (Rombongan Belajar)
// Sheet _ROMBEL: id | namaRombel | wali (username) | waliNama | mapelJSON | mapelGuruJSON
// mapelGuruJSON = { "NamaMapel": "usernameGuru", ... }
// ============================================================
function getRombel_() {
  const sh   = getSheet(SH_ROMBEL);
  const data = sh.getDataRange().getValues();
  if (data.length <= 1) return { rombel: [] };
  const rombel = data.slice(1).map(r => ({
    id:         String(r[0] || ''),
    nama:       String(r[1] || ''),
    wali:       String(r[2] || ''),
    waliNama:   String(r[3] || ''),
    mapel:      r[4] ? JSON.parse(r[4]) : [],
    mapelGuru:  r[5] ? JSON.parse(r[5]) : {}
  })).filter(r => r.id);
  return { rombel };
}

function saveRombel_(body) {
  const r  = JSON.parse(body.rombel);
  const sh = getSheet(SH_ROMBEL);
  const data = sh.getDataRange().getValues();
  
  // Cari nama lengkap wali kelas
  let waliNama = '';
  if (r.wali) {
    const { users } = getUsers_();
    const wu = users.find(u => u.username === r.wali);
    if (wu) waliNama = wu.nama;
  }
  
  let found = -1;
  let mapelLama = [];
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === r.id) { 
      found = i + 1;
      // Simpan mapel lama untuk cek perubahan
      try {
        mapelLama = data[i][4] ? JSON.parse(data[i][4]) : [];
      } catch(e) {}
      break;
    }
  }
  
  // Jika edit dan wali berubah, lepas rombelId dari wali lama
  if (found > 0) {
    const waliLama = String(data[found-1][2] || '');
    if (waliLama && waliLama !== r.wali) updateRombelIdUser_(waliLama, '');
  }
  
  const row = [r.id, r.nama, r.wali || '', waliNama, JSON.stringify(r.mapel || []), JSON.stringify(r.mapelGuru || {})];
  if (found > 0) {
    // Pastikan sheet punya cukup kolom (migrasi dari 5 → 6 kolom)
    if (sh.getLastColumn() < 6) {
      sh.getRange(1, 6, sh.getLastRow(), 1).setValue('');
    }
    sh.getRange(found, 1, 1, 6).setValues([row]);
    // Jika mapel berubah, update sheet nilai
    if (JSON.stringify(mapelLama) !== JSON.stringify(r.mapel)) {
      syncMapelToNilai_(r.id, r.mapel);
    }
  } else {
    sh.appendRow(row);
    initSettingRombel_(r.id);
  }
  
  // Update rombelId di user wali kelas
  if (r.wali) updateRombelIdUser_(r.wali, r.id);
  
  return { success: true };
}

// Sinkronisasi mapel rombel ke sheet nilai (pertahankan nilai yang sudah ada)
function syncMapelToNilai_(rombelId, mapelBaru) {
  const existing = getNilai_(rombelId);
  const mapelLama = existing.mapel || [];
  const nilaiLama = existing.nilai || [];
  const siswa     = existing.siswa || [];
  
  if (!siswa.length) return; // Tidak ada siswa, skip
  
  // Petakan nilai lama ke mapel baru berdasarkan nama mapel
  const nilaiMapped = siswa.map((s, si) => {
    const rowLama = nilaiLama[si] || {};
    const rowBaru = {};
    mapelBaru.forEach((m, mi) => {
      const idxLama = mapelLama.indexOf(m);
      rowBaru[mi] = idxLama >= 0 && rowLama[idxLama] !== undefined ? rowLama[idxLama] : '';
    });
    rowBaru['sakit'] = rowLama['sakit'] || 0;
    rowBaru['ijin']  = rowLama['ijin']  || 0;
    rowBaru['alpa']  = rowLama['alpa']  || 0;
    return rowBaru;
  });
  
  // Tulis ulang sheet dengan mapel baru + nilai yang dipertahankan
  const sh     = getSheet(shName(rombelId, 'NILAI'));
  sh.clearContents();
  const header = ['NAMA', ...mapelBaru, 'sakit', 'ijin', 'alpa'];
  const rows   = [header];
  siswa.forEach((s, si) => {
    const n   = nilaiMapped[si] || {};
    const row = [s.nama];
    mapelBaru.forEach((m, mi) => row.push(n[mi] !== undefined ? n[mi] : ''));
    row.push(n['sakit'] || 0, n['ijin'] || 0, n['alpa'] || 0);
    rows.push(row);
  });
  if (rows.length > 0) {
    sh.getRange(1, 1, rows.length, header.length).setValues(rows);
  }
}

function updateRombelIdUser_(username, rombelId) {
  if (!username) return;
  const sh   = getSheet(SH_USERS);
  const data = sh.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === username) {
      sh.getRange(i + 1, 5).setValue(rombelId);
      break;
    }
  }
}

// Inisialisasi setting default saat rombel baru dibuat
function initSettingRombel_(rombelId) {
  const sh = getSheet(shName(rombelId, 'SETTING'));
  if (sh.getLastRow() === 0) {
    sh.getRange(1,1,1,2).setValues([['_init','1']]);
  }
}

function deleteRombel_(body) {
  const rombelId = body.rombelId;
  const sh = getSheet(SH_ROMBEL);
  const data = sh.getDataRange().getValues();
  for (let i = data.length - 1; i >= 1; i--) {
    if (String(data[i][0]) === rombelId) {
      // Lepas wali kelas
      const wali = String(data[i][2] || '');
      if (wali) updateRombelIdUser_(wali, '');
      sh.deleteRow(i + 1);
      break;
    }
  }
  // Hapus semua sheet terkait rombel
  ['_SETTING','_SISWA','_NILAI','_KKM','_EKSKUL'].forEach(suffix => {
    const s = SS.getSheetByName(rombelId + suffix);
    if (s) SS.deleteSheet(s);
  });
  return { success: true };
}

// ============================================================
// SISWA (per rombel)
// ============================================================
const SISWA_H = ['nisn','noInduk','nama','panggilan','tempatLahir','tglLahir','namaOrtu','pesan'];

function getSiswa_(rombelId) {
  const sh   = getSheet(shName(rombelId, 'SISWA'));
  const data = sh.getDataRange().getValues();
  if (data.length <= 1) return { siswa: [] };
  return {
    siswa: data.slice(1).map(r => {
      const obj = {};
      SISWA_H.forEach((h, i) => obj[h] = r[i] !== undefined ? String(r[i]) : '');
      return obj;
    }).filter(s => s.nama)
  };
}

function saveSiswa_(body) {
  const { kelasId, rowIndex } = body; // kelasId sebenarnya adalah rombelId
  const siswa = JSON.parse(body.siswa);
  const sh    = getSheet(shName(kelasId, 'SISWA'));
  if (sh.getLastRow() === 0) sh.appendRow(SISWA_H);
  const rowData = SISWA_H.map(h => siswa[h] || '');
  if (parseInt(rowIndex) === -1) {
    sh.appendRow(rowData);
  } else {
    sh.getRange(parseInt(rowIndex) + 2, 1, 1, rowData.length).setValues([rowData]);
  }
  return { success: true };
}

function deleteSiswa_(body) {
  const sh = getSheet(shName(body.kelasId, 'SISWA'));
  sh.deleteRow(parseInt(body.rowIndex) + 2);
  return { success: true };
}

function importSiswa_(body) {
  const { kelasId } = body; // kelasId sebenarnya adalah rombelId
  const siswaList   = JSON.parse(body.siswaList);
  if (!siswaList || !siswaList.length) return { error: 'Data kosong.' };
  const sh = getSheet(shName(kelasId, 'SISWA'));
  if (sh.getLastRow() === 0) sh.appendRow(SISWA_H);
  const rows = siswaList.filter(s => s.nama).map(s => SISWA_H.map(h => s[h] || ''));
  if (rows.length) sh.getRange(sh.getLastRow() + 1, 1, rows.length, SISWA_H.length).setValues(rows);
  return { success: true, imported: rows.length };
}

// ============================================================
// NILAI (per rombel)
// ============================================================
function getNilai_(rombelId) {
  const sh       = getSheet(shName(rombelId, 'NILAI'));
  const data     = sh.getDataRange().getValues();
  const siswaRes = getSiswa_(rombelId).siswa;
  
  // Jika sheet nilai kosong, ambil mapel dari rombel
  if (data.length < 2) {
    const { rombel } = getRombel_();
    const rombelInfo = rombel.find(r => r.id === rombelId);
    const mapelFromRombel = rombelInfo ? rombelInfo.mapel : [];
    
    // Jika ada mapel dari rombel, inisialisasi sheet nilai
    if (mapelFromRombel.length > 0) {
      const header = ['NAMA', ...mapelFromRombel, 'sakit', 'ijin', 'alpa'];
      const rows = [header];
      siswaRes.forEach(s => {
        const row = [s.nama];
        mapelFromRombel.forEach(() => row.push(''));
        row.push(0, 0, 0);
        rows.push(row);
      });
      if (rows.length > 1) {
        sh.getRange(1, 1, rows.length, header.length).setValues(rows);
      }
      
      // Return data dengan mapel dari rombel
      const nilai = siswaRes.map(() => {
        const obj = {};
        mapelFromRombel.forEach((m, mi) => obj[mi] = '');
        obj['sakit'] = 0;
        obj['ijin'] = 0;
        obj['alpa'] = 0;
        return obj;
      });
      return { mapel: mapelFromRombel, siswa: siswaRes, nilai };
    }
    
    return { mapel: [], siswa: siswaRes, nilai: [] };
  }

  const header = data[0];
  const mapel  = header.slice(1, header.length - 3);
  const nilaiMap = {};
  data.slice(1).forEach(r => { nilaiMap[r[0]] = r.slice(1); });

  const nilai = siswaRes.map(s => {
    const row  = nilaiMap[s.nama] || [];
    const obj  = {};
    mapel.forEach((m, mi) => obj[mi] = row[mi] !== undefined ? row[mi] : '');
    const base = mapel.length;
    obj['sakit'] = row[base]   || 0;
    obj['ijin']  = row[base+1] || 0;
    obj['alpa']  = row[base+2] || 0;
    return obj;
  });

  // Ambil mapelGuru dari data rombel
  const { rombel } = getRombel_();
  const rombelInfo = rombel.find(r => r.id === rombelId) || {};
  const mapelGuru  = rombelInfo.mapelGuru || {};

  return { mapel, siswa: siswaRes, nilai, mapelGuru };
}

function saveNilai_(body) {
  const { kelasId } = body;
  const mapel    = JSON.parse(body.mapel);
  const nilaiNew = JSON.parse(body.nilai);
  const siswa    = getSiswa_(kelasId).siswa;
  const sh       = getSheet(shName(kelasId, 'NILAI'));

  // Ambil nilai yang sudah ada (untuk merge — jaga nilai mapel lain)
  const existing   = getNilai_(kelasId);
  const nilaiLama  = existing.nilai || [];

  // Cari user yang sedang menyimpan
  const token = body.token || '';
  const user  = verifyToken(token);

  // Ambil mapelGuru dari rombel (untuk validasi per mapel)
  const { rombel } = getRombel_();
  const rombelInfo = rombel.find(r => r.id === kelasId) || {};
  const mapelGuru  = rombelInfo.mapelGuru || {};

  sh.clearContents();
  const header = ['NAMA', ...mapel, 'sakit', 'ijin', 'alpa'];
  const rows   = [header];

  siswa.forEach((s, si) => {
    const nNew  = nilaiNew[si] || {};
    const nLama = nilaiLama[si] || {};
    const row   = [s.nama];

    mapel.forEach((m, mi) => {
      // Cek apakah user boleh edit mapel ini
      const guruMapel   = mapelGuru[m] || '';
      const bolehEdit   = !user || user.role === 'admin'
                          || user.role === 'walikelas'
                          || guruMapel === user.username;
      // Jika boleh edit, pakai nilai baru; jika tidak, pertahankan nilai lama
      const val = bolehEdit
        ? (nNew[mi] !== undefined ? nNew[mi] : '')
        : (nLama[mi] !== undefined ? nLama[mi] : '');
      row.push(val);
    });

    // Sakit/ijin/alpa: hanya wali kelas & admin yang boleh edit
    const bolehKehadiran = !user || user.role === 'admin' || user.role === 'walikelas';
    row.push(
      bolehKehadiran ? (nNew['sakit'] || 0) : (nLama['sakit'] || 0),
      bolehKehadiran ? (nNew['ijin']  || 0) : (nLama['ijin']  || 0),
      bolehKehadiran ? (nNew['alpa']  || 0) : (nLama['alpa']  || 0)
    );
    rows.push(row);
  });

  if (rows.length > 0) {
    sh.getRange(1, 1, rows.length, header.length).setValues(rows);
  }
  return { success: true };
}

// ============================================================
// KKM (per rombel)
// ============================================================
function getKKM_(rombelId) {
  const sh   = getSheet(shName(rombelId, 'KKM'));
  const data = sh.getDataRange().getValues();
  const kkm  = {};
  data.forEach(r => { if (r[0]) kkm[String(r[0])] = r[1] || 70; });
  return { kkm };
}

function saveKKM_(body) {
  const { kelasId } = body; // kelasId sebenarnya adalah rombelId
  const kkm = JSON.parse(body.kkm);
  const sh  = getSheet(shName(kelasId, 'KKM'));
  sh.clearContents();
  const rows = Object.entries(kkm).map(([k, v]) => [k, v]);
  if (rows.length) sh.getRange(1, 1, rows.length, 2).setValues(rows);
  return { success: true };
}

// ============================================================
// EKSKUL (per rombel)
// ============================================================
function getEkskul_(rombelId) {
  const sh       = getSheet(shName(rombelId, 'EKSKUL'));
  const data     = sh.getDataRange().getValues();
  const siswaRes = getSiswa_(rombelId).siswa;
  if (data.length < 2) return { kegiatan: [], siswa: siswaRes, nilai: [] };

  const kegiatan  = data[0].slice(1);
  const ekskulMap = {};
  data.slice(1).forEach(r => { ekskulMap[r[0]] = r.slice(1); });

  const nilai = siswaRes.map(s => {
    const row = ekskulMap[s.nama] || [];
    const obj = {};
    kegiatan.forEach((k, ki) => obj[ki] = row[ki] || '');
    return obj;
  });
  return { kegiatan, siswa: siswaRes, nilai };
}

function saveEkskul_(body) {
  const { kelasId } = body; // kelasId sebenarnya adalah rombelId
  const kegiatan = JSON.parse(body.kegiatan);
  const nilai    = JSON.parse(body.nilai);
  const siswa    = getSiswa_(kelasId).siswa;
  const sh       = getSheet(shName(kelasId, 'EKSKUL'));
  sh.clearContents();
  const header = ['NAMA', ...kegiatan];
  const rows   = [header];
  siswa.forEach((s, si) => {
    const n   = nilai[si] || {};
    const row = [s.nama];
    kegiatan.forEach((k, ki) => row.push(n[ki] || ''));
    rows.push(row);
  });
  if (rows.length > 0) sh.getRange(1, 1, rows.length, header.length).setValues(rows);
  return { success: true };
}

// ============================================================
// PENGUMUMAN — multi-post, tersimpan di sheet _ANNOUNCEMENTS
// Kolom: id | judul | isi | url | waktu (ISO string)
// ============================================================
const SH_ANN = '_ANNOUNCEMENTS';

function getAnnouncements_() {
  const sh   = getSheet(SH_ANN);
  const data = sh.getDataRange().getValues();
  if (data.length < 2) return { announcements: [] };
  // Urutkan terbaru di atas (sort by waktu desc)
  const rows = data.slice(1)
    .filter(r => r[0])
    .map(r => ({
      id:    String(r[0] || ''),
      judul: String(r[1] || ''),
      isi:   String(r[2] || ''),
      url:   String(r[3] || ''),
      waktu: String(r[4] || '')
    }))
    .sort((a, b) => (b.waktu > a.waktu ? 1 : -1));
  return { announcements: rows };
}

function saveAnnouncement_(body) {
  const ann = JSON.parse(body.announcement);
  const sh  = getSheet(SH_ANN);

  // Pastikan header ada
  if (sh.getLastRow() === 0) {
    sh.appendRow(['id', 'judul', 'isi', 'url', 'waktu']);
  }

  const now = new Date().toISOString();

  if (ann.id) {
    // Edit: cari baris dengan id yang sama
    const data = sh.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]) === ann.id) {
        sh.getRange(i + 1, 1, 1, 5).setValues([[
          ann.id,
          ann.judul || '',
          ann.isi   || '',
          ann.url   || '',
          data[i][4] // pertahankan waktu asli
        ]]);
        return { success: true };
      }
    }
  }

  // Baru: buat id unik dari timestamp
  const newId = 'ann_' + Date.now();
  sh.appendRow([newId, ann.judul || '', ann.isi || '', ann.url || '', now]);
  return { success: true };
}

function deleteAnnouncement_(body) {
  const id = body.id;
  if (!id) return { error: 'ID tidak ditemukan.' };
  const sh   = getSheet(SH_ANN);
  const data = sh.getDataRange().getValues();
  for (let i = data.length - 1; i >= 1; i--) {
    if (String(data[i][0]) === id) {
      sh.deleteRow(i + 1);
      return { success: true };
    }
  }
  return { error: 'Pengumuman tidak ditemukan.' };
}

// ============================================================
// SETUP AWAL — Jalankan SEKALI setelah paste kode ini
// ============================================================
function setupSheets() {
  const shUsers = getSheet(SH_USERS);
  if (shUsers.getLastRow() === 0) {
    shUsers.appendRow(['username','password','nama','role','rombelId']);
    shUsers.appendRow(['admin','admin123','Administrator','admin','']);
  }
  const shSetting = getSheet(SH_SETTING);
  if (shSetting.getLastRow() === 0) {
    shSetting.getRange(1,1,8,2).setValues([
      ['urlKop',''],['namaSatuan',''],['namaKepala',''],
      ['semester','I (GANJIL)'],['tahunPelajaran',''],
      ['judul','LAPORAN HASIL BELAJAR SISWA'],
      ['tempatRapor',''],['tglRapor','']
    ]);
  }
  const shRombel = getSheet(SH_ROMBEL);
  if (shRombel.getLastRow() === 0) {
    shRombel.appendRow(['id','namaRombel','wali','waliNama','mapelJSON']);
  }
  SpreadsheetApp.getUi().alert(
    '✅ Setup selesai!\n\nUser default:\n  Username: admin\n  Password: admin123\n\n' +
    'Deploy sebagai Web App lalu copy URL ke GAS_URL di js/api.js'
  );
}
