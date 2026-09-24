// ===== API LAYER =====
// ⚠️  URL Google Apps Script Web App (RDTS Database)
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

  // Helper simpan/baca cache lokal
  getCacheKey(action, payload = {}) {
    const k = payload.kelasId || payload.rombelId || payload.username || '';
    return `rdts_cache_${action}_${k}`;
  },

  setLocalCache(cacheKey, data) {
    try { localStorage.setItem(cacheKey, JSON.stringify(data)); } catch(e) {}
  },

  getLocalCache(cacheKey) {
    try {
      const raw = localStorage.getItem(cacheKey);
      return raw ? JSON.parse(raw) : null;
    } catch(e) { return null; }
  },

  // Tambah ke antrean sinkronisasi offline
  addToQueue(action, payload) {
    try {
      const queue = JSON.parse(localStorage.getItem('rdts_offline_queue') || '[]');
      queue.push({ action, token: this.getToken(), payload, timestamp: Date.now() });
      localStorage.setItem('rdts_offline_queue', JSON.stringify(queue));
    } catch(e) {}
  },

  // Sinkronkan antrean data lokal ke database server saat online
  async syncOfflineQueue() {
    if (!navigator.onLine) return;
    let queue = [];
    try {
      queue = JSON.parse(localStorage.getItem('rdts_offline_queue') || '[]');
    } catch(e) { return; }

    if (!queue.length) return;

    showToast(`🔄 Menyinkronkan ${queue.length} perubahan lokal ke server...`, 'info');
    const newQueue = [];
    let syncedCount = 0;

    for (const item of queue) {
      try {
        const url = this.getUrl();
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain' },
          body: JSON.stringify({ action: item.action, token: item.token || this.getToken(), ...item.payload })
        });
        const text = await res.text();
        let data = {};
        try { data = JSON.parse(text); } catch(e) {}
        if (data.error) {
          newQueue.push(item);
        } else {
          syncedCount++;
        }
      } catch(e) {
        newQueue.push(item);
      }
    }

    try { localStorage.setItem('rdts_offline_queue', JSON.stringify(newQueue)); } catch(e) {}
    if (syncedCount > 0) {
      showToast(`✅ ${syncedCount} data lokal berhasil tersimpan ke database server!`, 'success');
    }
  },

  // Semua request (GET & POST) dikirim sebagai POST dengan JSON body
  async call(action, payload = {}) {
    const url = this.getUrl();
    if (!url || url.includes('GANTI_DENGAN')) {
      showToast('URL Apps Script belum diset!', 'error');
      throw new Error('No GAS URL');
    }

    // Coba sync antrean jika online
    if (navigator.onLine) {
      this.syncOfflineQueue().catch(() => {});
    }

    const isReadAction = action.startsWith('get');
    const cacheKey = this.getCacheKey(action, payload);

    showLoading(true);
    try {
      const res = await fetch(url, {
        method:  'POST',
        headers: { 'Content-Type': 'text/plain' }, // GAS butuh text/plain, bukan application/json
        body:    JSON.stringify({ action, token: this.getToken(), ...payload })
      });

      const text = await res.text();

      // Cek apakah response berupa HTML (misal redirect login Google karena perizinan Web App belum Anyone)
      if (text.trim().startsWith('<')) {
        throw new Error('Server mengembalikan HTML. Pastikan Web App Apps Script diset: Execute as: Me & Who has access: Anyone');
      }

      const data = JSON.parse(text);
      if (data.error) throw new Error(data.error);

      // Simpan data read ke cache lokal untuk offline
      if (isReadAction) {
        this.setLocalCache(cacheKey, data);
      }

      return data;

    } catch (e) {
      console.warn(`[API.call] Server offline/error (${action}):`, e.message);

      // Skenario Offline / Gagal koneksi
      if (isReadAction) {
        const cachedData = this.getLocalCache(cacheKey);
        if (cachedData) {
          showToast('📱 Menggunakan data dari penyimpanan lokal (Offline)', 'info');
          return { ...cachedData, _offline: true };
        }
      } else {
        // Untuk simpan/delete saat offline: tambahkan ke queue
        this.addToQueue(action, payload);
        showToast('💾 Disimpan di lokal (Offline). Akan disinkronkan saat terhubung kembali.', 'info');
        return { success: true, _offline: true };
      }

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
      const text = await res.text();

      if (text.trim().startsWith('<')) {
        throw new Error('Server Apps Script mengembalikan HTML. Pastikan Web App diset ke Access: Anyone!');
      }

      const data = JSON.parse(text);

      if (data.success && data.user) {
        // Simpan cache user untuk login offline berikutnya
        const usersCache = this.getLocalCache('rdts_cached_users') || {};
        usersCache[username.toLowerCase()] = { ...data.user, passwordHash: btoa(password) };
        this.setLocalCache('rdts_cached_users', usersCache);
      }

      return data;
    } catch (e) {
      console.warn('[API.login] Server error/offline:', e.message);

      // Fallback login dari cache lokal saat offline
      const usersCache = this.getLocalCache('rdts_cached_users') || {};
      const cachedUser = usersCache[username.toLowerCase()];
      if (cachedUser && cachedUser.passwordHash === btoa(password)) {
        showToast('📱 Login berhasil menggunakan data lokal (Offline)', 'info');
        return { success: true, user: cachedUser, offline: true };
      }

      if (e.message.includes('HTML')) {
        showToast('Gagal: Perizinan Web App GAS belum set ke Anyone!', 'error');
      } else {
        showToast('Gagal terhubung ke server', 'error');
      }
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

// Listen koneksi internet kembali online -> otomatis sinkronkan antrean
window.addEventListener('online', () => {
  API.syncOfflineQueue();
});
