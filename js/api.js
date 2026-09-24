// ===== API LAYER =====
// ⚠️  GANTI URL INI dengan URL Google Apps Script Web App Anda.
//     Setelah diisi, tidak perlu diubah lagi.
const GAS_URL = 'https://script.google.com/macros/s/AKfycbyLLBo0pqj-DxlM2-enhOEJoznz6Gf_5RI1MYp-sf_AGdi1bBA_SWKNjlxWMsfBSfwumA/exec';

const API = {
  getUrl() {
    return localStorage.getItem('gasUrl') || GAS_URL;
  },

  getToken() {
    try {
      const u = JSON.parse(sessionStorage.getItem('currentUser') || '{}');
      return u.token || '';
    } catch { return ''; }
  },

  // Semua request (GET & POST) dikirim sebagai POST dengan JSON body
  // agar token tidak rusak di URL (base64 mengandung +/= yang bermasalah di query string)
  async call(action, payload = {}) {
    const url = this.getUrl();
    if (!url || url.includes('GANTI_DENGAN')) {
      showToast('URL Apps Script belum diset!', 'error');
      throw new Error('No GAS URL');
    }
    showLoading(true);
    try {
      const res  = await fetch(url, {
        method:  'POST',
        headers: { 'Content-Type': 'text/plain' }, // GAS butuh text/plain, bukan application/json
        body:    JSON.stringify({ action, token: this.getToken(), ...payload })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      return data;
    } catch (e) {
      showToast('Error: ' + e.message, 'error');
      throw e;
    } finally {
      showLoading(false);
    }
  },

  async post(action, body = {}) {
    return this.call(action, body);
  },

  async login(username, password) {
    const url = this.getUrl();
    if (!url || url.includes('GANTI_DENGAN')) {
      showToast('URL Apps Script belum diset!', 'error');
      throw new Error('No GAS URL');
    }
    showLoading(true);
    try {
      const res = await fetch(url, {
        method:  'POST',
        headers: { 'Content-Type': 'text/plain' },
        body:    JSON.stringify({ action: 'login', username, password })
      });
      return await res.json();
    } catch (e) {
      showToast('Gagal terhubung ke server', 'error');
      throw e;
    } finally {
      showLoading(false);
    }
  },

  // Kelas publik — masih dipakai di cetak rapor untuk ambil info kelas
  async getKelasPublic() {
    const url = this.getUrl();
    if (!url || url.includes('GANTI_DENGAN')) return { kelas: [] };
    try {
      const res = await fetch(`${url}?action=getKelasPublic`);
      return await res.json();
    } catch { return { kelas: [] }; }
  }
};
