// ===== PROGRESS NILAI =====

let progressData = [];
let progressCache = {}; // Cache untuk data nilai per rombel

// Local storage cache key
const PROGRESS_CACHE_KEY = 'rdts_progress_cache';
const CACHE_EXPIRY = 30 * 60 * 1000; // 30 menit

// Load cache from localStorage
function loadProgressCache() {
  try {
    const cached = localStorage.getItem(PROGRESS_CACHE_KEY);
    if (cached) {
      const data = JSON.parse(cached);
      // Cek expiry
      if (data.timestamp && (Date.now() - data.timestamp < CACHE_EXPIRY)) {
        progressCache = data.cache || {};
        console.log('Progress cache loaded from localStorage:', Object.keys(progressCache).length, 'items');
        return true;
      } else {
        // Cache expired, hapus
        localStorage.removeItem(PROGRESS_CACHE_KEY);
      }
    }
  } catch(e) {
    console.warn('Error loading progress cache:', e);
  }
  return false;
}

// Save cache to localStorage
function saveProgressCache() {
  try {
    const data = {
      timestamp: Date.now(),
      cache: progressCache
    };
    localStorage.setItem(PROGRESS_CACHE_KEY, JSON.stringify(data));
    console.log('Progress cache saved to localStorage');
  } catch(e) {
    console.warn('Error saving progress cache:', e);
  }
}

// Clear cache
function clearProgressCache() {
  progressCache = {};
  localStorage.removeItem(PROGRESS_CACHE_KEY);
  showToast('Cache progress dibersihkan!', 'info');
}

async function loadProgressData() {
  const container = document.getElementById('progressContainer');
  container.innerHTML = '<p class="hint">Memuat daftar rombel...</p>';
  
  // Load cache dari localStorage
  loadProgressCache();
  
  try {
    const rombelRes = await API.call('getRombel', {}, true);
    const rombelList = rombelRes.rombel || [];
    
    if (!rombelList.length) {
      container.innerHTML = '<p class="hint">Belum ada data rombel.</p>';
      return;
    }
    
    // BARU: Tampilkan semua rombel tanpa fetch nilai dulu
    // Hanya tampilkan basic info dari rombel
    progressData = rombelList.map(r => ({
      id: r.id,
      nama: r.nama || r.id,
      wali: r.waliNama || r.wali || '-',
      loaded: false, // Flag apakah data nilai sudah dimuat
      totalSiswa: 0,
      siswaComplete: 0,
      siswaPercentage: 0,
      totalMapel: 0,
      totalCells: 0,
      filledCells: 0,
      percentage: 0,
      status: 'low'
    }));
    
    // Cek cache dan update data yang sudah di-cache
    progressData.forEach(p => {
      if (progressCache[p.id]) {
        const cached = progressCache[p.id];
        Object.assign(p, cached);
        p.loaded = true;
        p.fromCache = true;
      }
    });
    
    renderProgress();
    showToast('Daftar rombel dimuat! Klik "Muat Detail" untuk melihat progress.', 'success');
  } catch(e) {
    container.innerHTML = '<p class="hint" style="color:#dc2626;">Error memuat data progress.</p>';
    showToast('Error: ' + e.message, 'error');
    console.error('Error loadProgressData:', e);
  }
}

// Load detail progress untuk 1 rombel
async function loadDetailProgress(idx) {
  const p = progressData[idx];
  const btnLoad = document.getElementById(`btnLoadProgress${idx}`);
  const statusDiv = document.getElementById(`progressStatus${idx}`);
  
  if (!p || !btnLoad || !statusDiv) return;
  
  // Disable button
  btnLoad.disabled = true;
  btnLoad.textContent = '⏳ Memuat...';
  statusDiv.innerHTML = '<span style="color:#f59e0b;">⏳ Memuat data nilai...</span>';
  
  try {
    // Fetch data nilai untuk rombel ini
    const nilaiData = await Promise.race([
      API.call('getNilai', { kelasId: p.id }, true),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 15000))
    ]);
    
    const mapel = nilaiData.mapel || [];
    const nilai = nilaiData.nilai || [];
    const siswa = nilaiData.siswa || [];
    
    let totalCells = 0;
    let filledCells = 0;
    let totalSiswa = siswa.length;
    let siswaComplete = 0;
    
    if (mapel.length && siswa.length) {
      totalCells = siswa.length * mapel.length;
      
      nilai.forEach((nilaiRow, si) => {
        let siswaFilled = 0;
        mapel.forEach((m, mi) => {
          if (nilaiRow && nilaiRow[mi] !== undefined && nilaiRow[mi] !== '') {
            filledCells++;
            siswaFilled++;
          }
        });
        if (siswaFilled === mapel.length) {
          siswaComplete++;
        }
      });
    }
    
    const percentage = totalCells > 0 ? Math.round((filledCells / totalCells) * 100) : 0;
    const siswaPercentage = totalSiswa > 0 ? Math.round((siswaComplete / totalSiswa) * 100) : 0;
    const status = percentage === 100 ? 'complete' : percentage >= 90 ? 'complete' : percentage >= 50 ? 'medium' : 'low';
    
    // Update progressData
    Object.assign(p, {
      loaded: true,
      fromCache: false,
      totalSiswa,
      siswaComplete,
      siswaPercentage,
      totalMapel: mapel.length,
      totalCells,
      filledCells,
      percentage,
      status
    });
    
    // Simpan ke cache
    progressCache[p.id] = {
      loaded: true,
      totalSiswa,
      siswaComplete,
      siswaPercentage,
      totalMapel: mapel.length,
      totalCells,
      filledCells,
      percentage,
      status
    };
    saveProgressCache();
    
    // Re-render card ini saja
    renderProgressCard(idx);
    
    showToast(`Progress ${p.nama} dimuat!`, 'success');
  } catch(e) {
    btnLoad.disabled = false;
    btnLoad.textContent = '🔄 Muat Detail';
    statusDiv.innerHTML = '<span style="color:#dc2626;">❌ Error memuat data</span>';
    showToast('Error: ' + e.message, 'error');
    console.error('Error loadDetailProgress:', e);
  }
}

function renderProgress() {
  const container = document.getElementById('progressContainer');
  
  if (!progressData.length) {
    container.innerHTML = '<p class="hint">Belum ada data.</p>';
    return;
  }
  
  // Header summary - hanya dari data yang sudah loaded
  const loadedData = progressData.filter(p => p.loaded);
  const totalRombel = progressData.length;
  const loadedRombel = loadedData.length;
  const totalSiswa = loadedData.reduce((sum, p) => sum + p.totalSiswa, 0);
  const avgProgress = loadedRombel > 0 ? Math.round(loadedData.reduce((sum, p) => sum + p.percentage, 0) / loadedRombel) : 0;
  const completeRombel = loadedData.filter(p => p.percentage === 100).length;
  
  let html = `
  <div class="progress-summary">
    <div class="progress-summary-card">
      <div class="progress-summary-icon">🏫</div>
      <div class="progress-summary-content">
        <div class="progress-summary-value">${totalRombel}</div>
        <div class="progress-summary-label">Total Rombel</div>
      </div>
    </div>
    <div class="progress-summary-card">
      <div class="progress-summary-icon">📥</div>
      <div class="progress-summary-content">
        <div class="progress-summary-value">${loadedRombel}/${totalRombel}</div>
        <div class="progress-summary-label">Data Dimuat</div>
      </div>
    </div>
    <div class="progress-summary-card">
      <div class="progress-summary-icon">📊</div>
      <div class="progress-summary-content">
        <div class="progress-summary-value">${avgProgress}%</div>
        <div class="progress-summary-label">Rata-rata Progress</div>
      </div>
    </div>
    <div class="progress-summary-card">
      <div class="progress-summary-icon">✅</div>
      <div class="progress-summary-content">
        <div class="progress-summary-value">${completeRombel}</div>
        <div class="progress-summary-label">Rombel Selesai</div>
      </div>
    </div>
  </div>
  
  <div style="margin-bottom:16px;display:flex;gap:8px;align-items:center;">
    <button class="btn-warning" onclick="loadProgressData()" title="Refresh semua data dari server">
      🔄 Muat Ulang Semua
    </button>
    <button class="btn-danger" onclick="clearProgressCache()" title="Hapus cache lokal">
      🗑️ Hapus Cache
    </button>
    <span style="font-size:0.85rem;color:#6b7280;">
      Cache: ${Object.keys(progressCache).length} rombel | Expired: 30 menit
    </span>
  </div>
  
  <div class="progress-list">`;
  
  progressData.forEach((p, idx) => {
    html += renderProgressCardHTML(p, idx);
  });
  
  html += '</div>';
  
  container.innerHTML = html;
}

// Render HTML untuk satu card (digunakan untuk initial render dan update)
function renderProgressCardHTML(p, idx) {
  if (!p.loaded) {
    // Belum dimuat - tampilkan tombol "Muat Detail"
    return `
    <div class="progress-card" id="progressCard${idx}">
      <div class="progress-card-header">
        <div>
          <h3 class="progress-card-title">⚪ ${p.nama}</h3>
          <p class="progress-card-subtitle">Wali Kelas: ${p.wali}</p>
        </div>
        <div style="display:flex;gap:8px;align-items:center;flex-direction:column;">
          <button class="btn-primary" onclick="loadDetailProgress(${idx})" id="btnLoadProgress${idx}">
            🔄 Muat Detail
          </button>
          <div id="progressStatus${idx}" style="font-size:0.85rem;color:#6b7280;">
            Klik untuk memuat data
          </div>
        </div>
      </div>
      
      <div class="progress-card-body">
        <p class="hint" style="text-align:center;padding:20px;">
          📊 Data progress belum dimuat. Klik <strong>"Muat Detail"</strong> untuk melihat progress nilai.
        </p>
      </div>
    </div>`;
  }
  
  // Sudah dimuat - tampilkan progress normal
  const statusIcon = p.percentage === 100 ? '✅' : p.percentage >= 90 ? '🟢' : p.percentage >= 50 ? '🟡' : '🔴';
  const statusText = p.percentage === 100 ? 'Selesai' : p.percentage >= 90 ? 'Hampir Selesai' : p.percentage >= 50 ? 'Sedang Berjalan' : 'Perlu Perhatian';
  const statusClass = p.percentage === 100 ? 'complete-100' : p.status;
  const cacheIcon = p.fromCache ? '💾' : '🌐';
  const cacheText = p.fromCache ? 'Dari Cache' : 'Fresh Data';
  
  return `
  <div class="progress-card" id="progressCard${idx}">
    <div class="progress-card-header">
      <div>
        <h3 class="progress-card-title">${statusIcon} ${p.nama}</h3>
        <p class="progress-card-subtitle">Wali Kelas: ${p.wali}</p>
      </div>
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
        <div class="progress-card-status ${statusClass}">${statusText}</div>
        <button class="btn-detail" onclick="toggleDetailMapel(${idx})" id="btnDetail${idx}">
          📋 Detail Mapel
        </button>
        <button class="btn-warning" onclick="reloadDetailProgress(${idx})" 
          style="padding:6px 12px;font-size:0.8rem;" title="Refresh data dari server">
          🔄
        </button>
      </div>
    </div>
    
    <div class="progress-card-body">
      <div style="font-size:0.75rem;color:#9ca3af;margin-bottom:8px;display:flex;gap:8px;align-items:center;">
        <span>${cacheIcon} ${cacheText}</span>
        ${p.fromCache ? '<span style="color:#f59e0b;">• Klik 🔄 untuk update</span>' : ''}
      </div>
      
      <div class="progress-stats">
        <div class="progress-stat-item">
          <span class="progress-stat-label">Siswa Selesai</span>
          <span class="progress-stat-value">${p.siswaComplete}/${p.totalSiswa} (${p.siswaPercentage}%)</span>
        </div>
        <div class="progress-stat-item">
          <span class="progress-stat-label">Mata Pelajaran</span>
          <span class="progress-stat-value">${p.totalMapel} mapel</span>
        </div>
        <div class="progress-stat-item">
          <span class="progress-stat-label">Nilai Terisi</span>
          <span class="progress-stat-value">${p.filledCells}/${p.totalCells} cell</span>
        </div>
      </div>
      
      <div class="progress-bar-wrapper">
        <div class="progress-bar-container">
          <div class="progress-bar-fill ${p.status}" style="width:${p.percentage}%"></div>
        </div>
        <div class="progress-bar-label">${p.percentage}% Complete</div>
      </div>
      
      <!-- Detail per Mapel (hidden by default) -->
      <div id="detailMapel${idx}" class="progress-detail-mapel" style="display:none;">
        <div class="progress-detail-header">
          <div class="progress-detail-title">📚 Progress per Mata Pelajaran</div>
          <button class="btn-export-detail" onclick="exportDetailMapelJPG(${idx})" title="Export detail mapel ke JPG">
            📸 Export JPG
          </button>
        </div>
        <div class="progress-mapel-grid" id="mapelGrid${idx}">
          <p class="hint">Memuat...</p>
        </div>
      </div>
    </div>
  </div>`;
}

// Re-render hanya satu card (setelah load detail)
function renderProgressCard(idx) {
  const cardDiv = document.getElementById(`progressCard${idx}`);
  if (cardDiv && progressData[idx]) {
    cardDiv.outerHTML = renderProgressCardHTML(progressData[idx], idx);
  }
}

// Reload detail progress (force refresh dari server)
async function reloadDetailProgress(idx) {
  const p = progressData[idx];
  if (!p) return;
  
  // Hapus dari cache
  delete progressCache[p.id];
  saveProgressCache();
  
  // Reset loaded flag
  p.loaded = false;
  
  // Re-render card ke state "belum dimuat"
  renderProgressCard(idx);
  
  // Load ulang
  await loadDetailProgress(idx);
}

// Export Progress as PDF
async function exportProgressPDF() {
  if (!progressData.length) {
    showToast('Muat data progress terlebih dahulu!', 'error');
    return;
  }
  
  showToast('Generating PDF... (menggunakan print to PDF)', 'info');
  
  // Add print class untuk styling
  document.body.classList.add('print-progress');
  
  setTimeout(() => {
    window.print();
    document.body.classList.remove('print-progress');
  }, 500);
}

// Export Progress as JPG using html2canvas
async function exportProgressJPG() {
  if (!progressData.length) {
    showToast('Muat data progress terlebih dahulu!', 'error');
    return;
  }
  
  // Check if html2canvas is available
  if (typeof html2canvas === 'undefined') {
    showToast('Loading html2canvas library...', 'info');
    
    // Load html2canvas dynamically
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
    script.onload = () => {
      performJPGExport();
    };
    script.onerror = () => {
      showToast('Error loading html2canvas. Using screenshot method instead.', 'error');
    };
    document.head.appendChild(script);
  } else {
    performJPGExport();
  }
}

async function performJPGExport() {
  const container = document.getElementById('progressContainer');
  
  showToast('Generating JPG...', 'info');
  
  try {
    const canvas = await html2canvas(container, {
      backgroundColor: '#ffffff',
      scale: 2,
      logging: false,
      useCORS: true
    });
    
    // Convert to JPG
    canvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `progress_nilai_${new Date().toISOString().split('T')[0]}.jpg`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('Progress berhasil di-export sebagai JPG!', 'success');
    }, 'image/jpeg', 0.95);
    
  } catch(e) {
    showToast('Error: ' + e.message, 'error');
    console.error('Export JPG error:', e);
  }
}


// Toggle detail mapel
async function toggleDetailMapel(idx) {
  const detailDiv = document.getElementById(`detailMapel${idx}`);
  const btn = document.getElementById(`btnDetail${idx}`);
  
  if (!detailDiv) return;
  
  if (detailDiv.style.display === 'none') {
    // Show detail
    detailDiv.style.display = 'block';
    btn.textContent = '📋 Sembunyikan';
    btn.classList.add('active');
    
    // Load detail jika belum
    await loadDetailMapel(idx);
  } else {
    // Hide detail
    detailDiv.style.display = 'none';
    btn.textContent = '📋 Detail Mapel';
    btn.classList.remove('active');
  }
}

// Load detail progress per mapel
async function loadDetailMapel(idx) {
  const p = progressData[idx];
  const gridDiv = document.getElementById(`mapelGrid${idx}`);
  
  if (!p || !gridDiv) return;
  
  gridDiv.innerHTML = '<p class="hint">Memuat detail...</p>';
  
  try {
    // Ambil data nilai untuk rombel ini
    const nilaiData = await API.call('getNilai', { kelasId: p.id }, true);
    const mapel = nilaiData.mapel || [];
    const nilai = nilaiData.nilai || [];
    const siswa = nilaiData.siswa || [];
    
    if (!mapel.length) {
      gridDiv.innerHTML = '<p class="hint">Belum ada mata pelajaran.</p>';
      return;
    }
    
    // Hitung progress per mapel
    const mapelProgress = mapel.map((m, mi) => {
      let filled = 0;
      let total = siswa.length;
      
      nilai.forEach(nilaiRow => {
        if (nilaiRow && nilaiRow[mi] !== undefined && nilaiRow[mi] !== '') {
          filled++;
        }
      });
      
      const percentage = total > 0 ? Math.round((filled / total) * 100) : 0;
      const status = percentage === 100 ? 'complete-100' : 
                     percentage >= 90 ? 'complete' : 
                     percentage >= 50 ? 'medium' : 'low';
      
      return { nama: m, filled, total, percentage, status };
    });
    
    // Render grid mapel
    let html = '';
    mapelProgress.forEach(mp => {
      html += `
      <div class="progress-mapel-item">
        <div class="progress-mapel-header">
          <span class="progress-mapel-name">${mp.nama}</span>
          <span class="progress-mapel-percentage ${mp.status}">${mp.percentage}%</span>
        </div>
        <div class="progress-mapel-bar">
          <div class="progress-mapel-fill ${mp.status}" style="width:${mp.percentage}%"></div>
        </div>
        <div class="progress-mapel-info">${mp.filled}/${mp.total} siswa</div>
      </div>`;
    });
    
    gridDiv.innerHTML = html;
    
  } catch(e) {
    gridDiv.innerHTML = '<p class="hint" style="color:#dc2626;">Error memuat detail.</p>';
    console.error('Error loadDetailMapel:', e);
  }
}


// Export Detail Mapel per Kelas sebagai JPG
async function exportDetailMapelJPG(idx) {
  const p = progressData[idx];
  const detailDiv = document.getElementById(`detailMapel${idx}`);
  
  if (!detailDiv || detailDiv.style.display === 'none') {
    showToast('Buka detail mapel terlebih dahulu!', 'error');
    return;
  }
  
  const mapelGrid = document.getElementById(`mapelGrid${idx}`);
  if (!mapelGrid || !mapelGrid.children.length) {
    showToast('Belum ada data mapel untuk di-export!', 'error');
    return;
  }
  
  // Check if html2canvas is available
  if (typeof html2canvas === 'undefined') {
    showToast('Loading html2canvas library...', 'info');
    
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
    script.onload = () => {
      performDetailMapelJPGExport(idx, p.nama);
    };
    script.onerror = () => {
      showToast('Error loading html2canvas library!', 'error');
    };
    document.head.appendChild(script);
  } else {
    performDetailMapelJPGExport(idx, p.nama);
  }
}

async function performDetailMapelJPGExport(idx, namaKelas) {
  const detailDiv = document.getElementById(`detailMapel${idx}`);
  
  showToast(`Generating JPG untuk ${namaKelas}...`, 'info');
  
  try {
    // Buat container temporary untuk export dengan header yang lebih bagus
    const exportContainer = document.createElement('div');
    exportContainer.style.cssText = `
      position: absolute;
      left: -9999px;
      top: 0;
      background: #fff;
      padding: 30px;
      width: 1200px;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    `;
    
    // Header untuk export
    const header = document.createElement('div');
    header.style.cssText = `
      margin-bottom: 24px;
      border-bottom: 3px solid #2563eb;
      padding-bottom: 16px;
    `;
    header.innerHTML = `
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">
        <div style="font-size:2rem;">📚</div>
        <div>
          <h1 style="margin:0;font-size:1.8rem;color:#1e3a5f;">Progress Nilai per Mata Pelajaran</h1>
          <p style="margin:4px 0 0;font-size:1rem;color:#6b7280;">${namaKelas}</p>
        </div>
      </div>
      <div style="display:flex;gap:20px;font-size:0.9rem;color:#4b5563;">
        <span>📅 ${new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
        <span>🏫 MI Labkid</span>
      </div>
    `;
    
    // Clone detail content
    const contentClone = detailDiv.cloneNode(true);
    contentClone.style.display = 'block';
    contentClone.style.marginTop = '0';
    contentClone.style.paddingTop = '0';
    contentClone.style.borderTop = 'none';
    
    // Sembunyikan tombol export di clone
    const btnExport = contentClone.querySelector('.btn-export-detail');
    if (btnExport) btnExport.style.display = 'none';
    
    // Modifikasi title
    const detailTitle = contentClone.querySelector('.progress-detail-title');
    if (detailTitle) {
      detailTitle.style.fontSize = '1.3rem';
      detailTitle.style.marginBottom = '20px';
    }
    
    // Append ke container
    exportContainer.appendChild(header);
    exportContainer.appendChild(contentClone);
    
    // Tambahkan footer
    const footer = document.createElement('div');
    footer.style.cssText = `
      margin-top: 30px;
      padding-top: 16px;
      border-top: 2px solid #e5e7eb;
      text-align: center;
      font-size: 0.85rem;
      color: #9ca3af;
    `;
    footer.innerHTML = `
      <p style="margin:0;">Rapor Digital Tengah Semester (RDTS) - MI Labkid</p>
      <p style="margin:4px 0 0;">Generated by RDTS System</p>
    `;
    exportContainer.appendChild(footer);
    
    // Append to body
    document.body.appendChild(exportContainer);
    
    // Generate canvas
    const canvas = await html2canvas(exportContainer, {
      backgroundColor: '#ffffff',
      scale: 2,
      logging: false,
      useCORS: true,
      width: 1200,
      windowWidth: 1200
    });
    
    // Remove temporary container
    document.body.removeChild(exportContainer);
    
    // Convert to JPG
    canvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      
      // Sanitize filename
      const safeKelasName = namaKelas.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      const timestamp = new Date().toISOString().split('T')[0];
      a.download = `progress_detail_${safeKelasName}_${timestamp}.jpg`;
      
      a.click();
      URL.revokeObjectURL(url);
      showToast(`Progress ${namaKelas} berhasil di-export!`, 'success');
    }, 'image/jpeg', 0.95);
    
  } catch(e) {
    showToast('Error: ' + e.message, 'error');
    console.error('Export Detail JPG error:', e);
  }
}
