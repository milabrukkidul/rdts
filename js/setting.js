// ===== SETTING GLOBAL =====
// Setting berlaku untuk semua kelas — tidak ada pilihan kelas

let settingAutoSaveTimer = null;

async function loadSetting() {
  try {
    const data = await API.call('getSetting');
    const s = data.setting || {};
    document.getElementById('s_urlKop').value         = s.urlKop || '';
    document.getElementById('s_namaSatuan').value     = s.namaSatuan || '';
    document.getElementById('s_namaKepala').value     = s.namaKepala || '';
    document.getElementById('s_semester').value       = s.semester || 'I (GANJIL)';
    document.getElementById('s_tahunPelajaran').value = s.tahunPelajaran || '';
    document.getElementById('s_judul').value          = s.judul || 'LAPORAN HASIL BELAJAR SISWA';
    document.getElementById('s_tempatRapor').value    = s.tempatRapor || '';
    document.getElementById('s_tglRapor').value       = s.tglRapor || '';
    showToast('Setting dimuat!', 'success');
  } catch(e) {}
}

async function saveSetting() {
  const setting = buildSettingObj();
  try {
    await API.post('saveSetting', { setting: JSON.stringify(setting) });
    showToast('Setting disimpan!', 'success');
  } catch(e) {}
}

function buildSettingObj() {
  return {
    urlKop:         document.getElementById('s_urlKop').value.trim(),
    namaSatuan:     document.getElementById('s_namaSatuan').value.trim(),
    namaKepala:     document.getElementById('s_namaKepala').value.trim(),
    semester:       document.getElementById('s_semester').value,
    tahunPelajaran: document.getElementById('s_tahunPelajaran').value.trim(),
    judul:          document.getElementById('s_judul').value.trim(),
    tempatRapor:    document.getElementById('s_tempatRapor').value.trim(),
    tglRapor:       document.getElementById('s_tglRapor').value,
  };
}

// Auto-save 1.5 detik setelah berhenti mengetik
function settingChanged() {
  clearTimeout(settingAutoSaveTimer);
  settingAutoSaveTimer = setTimeout(async () => {
    const setting = buildSettingObj();
    try {
      await API.post('saveSetting', { setting: JSON.stringify(setting) });
      const t = document.getElementById('toast');
      t.textContent = '💾 Tersimpan otomatis';
      t.className = 'toast success';
      t.classList.remove('hidden');
      clearTimeout(t._timer);
      t._timer = setTimeout(() => t.classList.add('hidden'), 1800);
    } catch(e) {}
  }, 1500);
}

document.addEventListener('DOMContentLoaded', () => {
  ['s_urlKop','s_namaSatuan','s_namaKepala','s_semester',
   's_tahunPelajaran','s_judul','s_tempatRapor','s_tglRapor']
  .forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('input',  settingChanged);
      el.addEventListener('change', settingChanged);
    }
  });
});
