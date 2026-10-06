// ===== PROGRESS NILAI =====

let progressData = [];

async function loadProgressData() {
  const container = document.getElementById('progressContainer');
  container.innerHTML = '<p class="hint">Memuat data progress...</p>';
  
  try {
    const rombelRes = await API.call('getRombel', {}, true);
    const rombelList = rombelRes.rombel || [];
    
    if (!rombelList.length) {
      container.innerHTML = '<p class="hint">Belum ada data rombel.</p>';
      return;
    }
    
    // Ambil data nilai untuk setiap rombel (parallel)
    const nilaiPromises = rombelList.map(r => 
      API.call('getNilai', { kelasId: r.id }, true).catch(() => ({ mapel: [], nilai: [], siswa: [] }))
    );
    const nilaiResults = await Promise.all(nilaiPromises);
    
    // Hitung progress untuk setiap rombel
    progressData = rombelList.map((r, i) => {
      const nilaiData = nilaiResults[i];
      const mapel = nilaiData.mapel || [];
      const nilai = nilaiData.nilai || [];
      const siswa = nilaiData.siswa || [];
      
      let totalCells = 0;
      let filledCells = 0;
      let totalSiswa = siswa.length;
      let siswaComplete = 0;
      
      if (mapel.length && nilai.length) {
        totalCells = nilai.length * mapel.length;
        
        nilai.forEach((nilaiRow, si) => {
          let siswaFilled = 0;
          mapel.forEach((m, mi) => {
            if (nilaiRow && nilaiRow[mi] !== undefined && nilaiRow[mi] !== '') {
              filledCells++;
              siswaFilled++;
            }
          });
          // Siswa dianggap complete jika semua mapel terisi
          if (siswaFilled === mapel.length) {
            siswaComplete++;
          }
        });
      }
      
      const percentage = totalCells > 0 ? Math.round((filledCells / totalCells) * 100) : 0;
      const siswaPercentage = totalSiswa > 0 ? Math.round((siswaComplete / totalSiswa) * 100) : 0;
      
      return {
        id: r.id,
        nama: r.nama || r.id,
        wali: r.waliNama || r.wali || '-',
        totalSiswa,
        siswaComplete,
        siswaPercentage,
        totalMapel: mapel.length,
        totalCells,
        filledCells,
        percentage,
        status: percentage === 100 ? 'complete' : percentage >= 90 ? 'complete' : percentage >= 50 ? 'medium' : 'low'
      };
    });
    
    renderProgress();
    showToast('Data progress dimuat!', 'success');
  } catch(e) {
    container.innerHTML = '<p class="hint" style="color:#dc2626;">Error memuat data progress.</p>';
    showToast('Error: ' + e.message, 'error');
  }
}

function renderProgress() {
  const container = document.getElementById('progressContainer');
  
  if (!progressData.length) {
    container.innerHTML = '<p class="hint">Belum ada data.</p>';
    return;
  }
  
  // Header summary
  const totalRombel = progressData.length;
  const totalSiswa = progressData.reduce((sum, p) => sum + p.totalSiswa, 0);
  const avgProgress = Math.round(progressData.reduce((sum, p) => sum + p.percentage, 0) / totalRombel);
  const completeRombel = progressData.filter(p => p.percentage === 100).length;
  
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
      <div class="progress-summary-icon">👥</div>
      <div class="progress-summary-content">
        <div class="progress-summary-value">${totalSiswa}</div>
        <div class="progress-summary-label">Total Siswa</div>
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
  
  <div class="progress-list">`;
  
  progressData.forEach((p, idx) => {
    const statusIcon = p.percentage === 100 ? '✅' : p.percentage >= 90 ? '🟢' : p.percentage >= 50 ? '🟡' : '🔴';
    const statusText = p.percentage === 100 ? 'Selesai' : p.percentage >= 90 ? 'Hampir Selesai' : p.percentage >= 50 ? 'Sedang Berjalan' : 'Perlu Perhatian';
    const statusClass = p.percentage === 100 ? 'complete-100' : p.status;
    
    html += `
    <div class="progress-card">
      <div class="progress-card-header">
        <div>
          <h3 class="progress-card-title">${statusIcon} ${p.nama}</h3>
          <p class="progress-card-subtitle">Wali Kelas: ${p.wali}</p>
        </div>
        <div style="display:flex;gap:8px;align-items:center;">
          <div class="progress-card-status ${statusClass}">${statusText}</div>
          <button class="btn-detail" onclick="toggleDetailMapel(${idx})" id="btnDetail${idx}">
            📋 Detail Mapel
          </button>
        </div>
      </div>
      
      <div class="progress-card-body">
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
          <div class="progress-detail-title">📚 Progress per Mata Pelajaran</div>
          <div class="progress-mapel-grid" id="mapelGrid${idx}">
            <p class="hint">Memuat...</p>
          </div>
        </div>
      </div>
    </div>`;
  });
  
  html += '</div>';
  
  container.innerHTML = html;
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
