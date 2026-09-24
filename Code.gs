/**
 * ==============================================================================
 * APLIKASI PENERIMAAN SISWA BARU (PPDB) ONLINE - BACKEND GOOGLE APPS SCRIPT
 * ==============================================================================
 * Database & Logic Server untuk PPDB berbasis Google Sheets & Web App.
 * Fitur: Auto Setup Database, API GET/POST, Validas Kuota, Real-time Sync.
 * ==============================================================================
 */

// Global Sheet Names
const SHEET_DATA = "DATA_PENDAFTARAN";
const SHEET_SETTINGS = "SETTINGS";
const SHEET_KUOTA = "KUOTA";

/**
 * Main Web App Handler (doGet)
 * Serves the HTML user interface or responds with JSON API for GitHub Pages / External Frontend.
 * Mendukung JSONP via parameter ?callback= untuk mengatasi CORS browser.
 */
function doGet(e) {
  // Force flush spreadsheet changes to guarantee fresh data on reload
  SpreadsheetApp.flush();

  var callback = (e && e.parameter && e.parameter.callback) ? e.parameter.callback : null;

  // Helper: bungkus response dengan JSONP jika ada callback
  function makeOutput(obj) {
    var json = JSON.stringify(obj);
    if (callback) {
      // JSONP response — browser menerima sebagai script tag
      return ContentService
        .createTextOutput(callback + "(" + json + ")")
        .setMimeType(ContentService.MimeType.JAVASCRIPT);
    }
    return ContentService
      .createTextOutput(json)
      .setMimeType(ContentService.MimeType.JSON);
  }

  // Check if call is API request for JSON data (e.g. from GitHub Pages)
  if (e && e.parameter && e.parameter.action === 'getAppData') {
    var data = getAppData();
    return makeOutput(data);
  }

  // Handle saveApiUrl via GET (untuk akses dari luar GAS iframe)
  if (e && e.parameter && e.parameter.action === 'saveApiUrl') {
    var result = saveApiUrl(e.parameter.pin || "", e.parameter.url || "");
    return makeOutput(result);
  }

  // Handle verifyPin via GET
  if (e && e.parameter && e.parameter.action === 'verifyPin') {
    var pinResult = verifyAdminPin(e.parameter.pin || "");
    return makeOutput(pinResult);
  }

  // Render HTML Page inside Google Apps Script with fresh server data
  var template = HtmlService.createTemplateFromFile('index');
  try {
    template.initialAppData = JSON.stringify(getAppData());
  } catch (err) {
    template.initialAppData = "null";
  }

  var htmlOutput = template.evaluate()
    .setTitle("Penerimaan Siswa Baru (PPDB)")
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
    
  return htmlOutput;
}

/**
 * Main API Handler (doPost)
 * Receives form submissions from Web App or GitHub Pages CORS POST
 */
function doPost(e) {
  var lock = LockService.getScriptLock();
  // Wait up to 10 seconds for lock to avoid duplicate concurrency issues
  try {
    lock.waitLock(10000);
  } catch (err) {
    return createJsonResponse({ success: false, message: "Server sedang sibuk, silakan coba lagi beberapa saat." });
  }

  try {
    var payload;
    if (e.postData && e.postData.contents) {
      payload = JSON.parse(e.postData.contents);
    } else if (e.parameter) {
      payload = e.parameter;
    }

    var result = processSubmission(payload);
    return createJsonResponse(result);
  } catch (error) {
    return createJsonResponse({ success: false, message: "Gagal memproses data: " + error.toString() });
  } finally {
    lock.releaseLock();
  }
}

/**
 * Helper to return JSON Response with CORS headers
 */
function createJsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Robust Spreadsheet Resolver with ScriptProperties fallback
 */
function getSpreadsheet() {
  var ss = null;
  try {
    ss = SpreadsheetApp.getActiveSpreadsheet();
  } catch (e) {}

  if (!ss) {
    var ssId = PropertiesService.getScriptProperties().getProperty("SPREADSHEET_ID");
    if (ssId) {
      try {
        ss = SpreadsheetApp.openById(ssId);
      } catch (err) {}
    }
  }

  if (!ss) {
    throw new Error("Spreadsheet tidak ditemukan! Pastikan Anda membuka Apps Script dari menu Ekstensi -> Apps Script di Google Sheets Anda, lalu jalankan fungsi setupDatabase().");
  }

  try {
    PropertiesService.getScriptProperties().setProperty("SPREADSHEET_ID", ss.getId());
  } catch (err) {}

  return ss;
}

/**
 * Get App Settings, Logos, and Quota Stats from Spreadsheet
 */
function getAppData() {
  var ss = getSpreadsheet();
  ensureDatabaseReady(ss);

  // Force spreadsheet to flush all pending edits
  SpreadsheetApp.flush();

  // Get Settings
  var sheetSettings = ss.getSheetByName(SHEET_SETTINGS);
  var settingsData = sheetSettings.getDataRange().getValues();
  var settingsMap = {};
  for (var i = 1; i < settingsData.length; i++) {
    if (settingsData[i][0]) {
      settingsMap[settingsData[i][0]] = settingsData[i][1];
    }
  }

  // Get Quota Data
  var sheetKuota = ss.getSheetByName(SHEET_KUOTA);
  var kuotaValues = sheetKuota.getDataRange().getValues();
  var kuotaMap = {};

  for (var j = 1; j < kuotaValues.length; j++) {
    var tahun = String(kuotaValues[j][0]).trim();
    if (tahun) {
      var maxQ = parseInt(kuotaValues[j][1]) || parseInt(settingsMap["KUOTA_DEFAULT"]) || 112;
      
      // Calculate filled count dynamically from Data sheet to ensure exact accuracy
      var terisi = countRegistrationByYear(ss, tahun);
      var sisa = Math.max(0, maxQ - terisi);

      kuotaMap[tahun] = {
        tahun: tahun,
        maxKuota: maxQ,
        terisi: terisi,
        sisa: sisa,
        isFull: sisa <= 0
      };
    }
  }

  return {
    success: true,
    settings: {
      judulWeb: settingsMap["JUDUL_WEB"] || "PPDB ONLINE TERPADU",
      subJudulWeb: settingsMap["SUB_JUDUL_WEB"] || "Sistem Penerimaan Peserta Didik Baru",
      namaSekolah: settingsMap["NAMA_SEKOLAH"] || "TK / RA AL-IKHLAS",
      logoUrl: settingsMap["LOGO_URL"] || "https://cdn-icons-png.flaticon.com/512/2997/2997322.png",
      waAdmin: settingsMap["WA_ADMIN"] || "6281234567890",
      pesanSukses: settingsMap["PESAN_SUKSES"] || "Terima kasih! Pendaftaran Anda telah berhasil disimpan.",
      apiUrl: settingsMap["API_URL"] || ""
    },
    kuota: kuotaMap
  };
}

/**
 * Process Registration Form Submission
 */
function processSubmission(data) {
  if (!data) {
    return { success: false, message: "Data tidak valid atau kosong." };
  }

  // Validate required fields
  var requiredFields = [
    { key: "namaSiswa", label: "Nama Siswa" },
    { key: "jenisKelamin", label: "Jenis Kelamin" },
    { key: "tempatLahir", label: "Tempat Lahir" },
    { key: "tanggalLahir", label: "Tanggal Lahir" },
    { key: "asalSekolah", label: "Asal KB/TK/RA" },
    { key: "nikSiswa", label: "NIK Siswa" },
    { key: "noWhatsapp", label: "Nomor WhatsApp" },
    { key: "noKk", label: "Nomor KK" },
    { key: "namaAyah", label: "Nama Ayah" },
    { key: "nikAyah", label: "NIK Ayah" },
    { key: "namaIbu", label: "Nama Ibu" },
    { key: "nikIbu", label: "NIK Ibu" },
    { key: "tahunPelajaran", label: "Tahun Pelajaran" }
  ];

  var missing = [];
  requiredFields.forEach(function(f) {
    if (!data[f.key] || String(data[f.key]).trim() === "") {
      missing.push(f.label);
    }
  });

  if (missing.length > 0) {
    return {
      success: false,
      message: "Harap isi semua kolom wajib! (Belum diisi: " + missing.join(", ") + ")"
    };
  }

  var ss = getSpreadsheet();
  ensureDatabaseReady(ss);

  var tahunPelajaran = String(data.tahunPelajaran).trim();

  // Quota Verification Server-Side
  var appData = getAppData();
  var quotaInfo = appData.kuota[tahunPelajaran];
  var maxLimit = quotaInfo ? quotaInfo.maxKuota : 112;
  var currentCount = countRegistrationByYear(ss, tahunPelajaran);

  if (currentCount >= maxLimit) {
    return {
      success: false,
      message: "Mohon maaf, kuota pendaftaran untuk Tahun Pelajaran " + tahunPelajaran + " telah memenuhi batas maksimal (" + maxLimit + " siswa)."
    };
  }

  // Generate Registration Number
  var regCodeYear = tahunPelajaran.split('/')[0] || "2027";
  var regIndex = (currentCount + 1).toString();
  while (regIndex.length < 3) regIndex = "0" + regIndex;
  var noPendaftaran = "REG-" + regCodeYear + "-" + regIndex;

  var sheetData = ss.getSheetByName(SHEET_DATA);
  var timestamp = new Date();

  // Append new row
  var rowData = [
    timestamp,
    noPendaftaran,
    tahunPelajaran,
    String(data.namaSiswa).trim(),
    String(data.jenisKelamin).trim(),
    String(data.tempatLahir).trim(),
    String(data.tanggalLahir).trim(),
    String(data.asalSekolah).trim(),
    "'" + String(data.nikSiswa).trim(), // Prefix quote to prevent numeric truncation
    "'" + String(data.noWhatsapp).trim(),
    "'" + String(data.noKk).trim(),
    String(data.namaAyah).trim(),
    "'" + String(data.nikAyah).trim(),
    String(data.namaIbu).trim(),
    "'" + String(data.nikIbu).trim(),
    "DITERIMA / TERSIMPAN"
  ];

  sheetData.appendRow(rowData);

  // CRITICAL: Force flush changes to Google Sheets immediately!
  SpreadsheetApp.flush();

  // Return fresh quota stats
  var updatedAppData = getAppData();

  return {
    success: true,
    message: "Pendaftaran Berhasil Terkirim!",
    noPendaftaran: noPendaftaran,
    dataPendaftar: data,
    updatedKuota: updatedAppData.kuota[tahunPelajaran],
    settings: updatedAppData.settings
  };
}

/**
 * Count total registered students for a specific school year
 */
function countRegistrationByYear(ss, tahun) {
  var sheet = ss.getSheetByName(SHEET_DATA);
  if (!sheet) return 0;
  
  // Flush before reading data range
  SpreadsheetApp.flush();
  var values = sheet.getDataRange().getValues();
  var count = 0;
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][2]).trim() === String(tahun).trim()) {
      count++;
    }
  }
  return count;
}

/**
 * Ensure Database tabs and headers exist
 */
function ensureDatabaseReady(ss) {
  if (!ss.getSheetByName(SHEET_DATA) || !ss.getSheetByName(SHEET_SETTINGS) || !ss.getSheetByName(SHEET_KUOTA)) {
    setupDatabase();
  }
}

/**
 * ==============================================================================
 * FUNCTION SETUP DATABASE OTOMATIS
 * Jalankan fungsi ini sekali dari menu Editor Google Apps Script!
 * ==============================================================================
 */
function setupDatabase() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (ss) {
    try {
      PropertiesService.getScriptProperties().setProperty("SPREADSHEET_ID", ss.getId());
    } catch(e) {}
  } else {
    ss = getSpreadsheet();
  }

  // ---------------------------------------------------------------------------
  // 1. SHEET DATA PENDAFTARAN
  // ---------------------------------------------------------------------------
  var sheetData = ss.getSheetByName(SHEET_DATA);
  if (!sheetData) {
    sheetData = ss.insertSheet(SHEET_DATA);
  }
  sheetData.clear();

  var dataHeaders = [
    "Timestamp", "No Pendaftaran", "Tahun Pelajaran", "Nama Siswa",
    "Jenis Kelamin", "Tempat Lahir", "Tanggal Lahir", "Asal KB/TK/RA",
    "NIK Siswa", "No WhatsApp", "No KK", "Nama Ayah", "NIK Ayah",
    "Nama Ibu", "NIK Ibu", "Status"
  ];

  sheetData.getRange(1, 1, 1, dataHeaders.length)
    .setValues([dataHeaders])
    .setBackground("#00A896")
    .setFontColor("#FFFFFF")
    .setFontWeight("bold")
    .setHorizontalAlignment("center")
    .setVerticalAlignment("middle");
    
  sheetData.setRowHeight(1, 35);
  sheetData.setFrozenRows(1);

  // Insert Sample Data if empty
  var sampleRows = [
    [
      new Date(), "REG-2027-001", "2027/2028", "Ahmad Fauzi", "L",
      "Jakarta", "2021-05-12", "TK Pembina", "'3171011205210001",
      "'081234567890", "'3171010101100002", "Budi Santoso", "'3171011508800001",
      "Siti Rahma", "'3171012010850003", "DITERIMA"
    ],
    [
      new Date(), "REG-2027-002", "2027/2028", "Aisyah Putri", "P",
      "Bandung", "2021-08-20", "RA Al-Azhar", "'3273016008210002",
      "'082198765432", "'3273010101100005", "Dedi Kurniawan", "'3273011004780002",
      "Dewi Lestari", "'3273014506820004", "DITERIMA"
    ]
  ];
  sheetData.getRange(2, 1, sampleRows.length, dataHeaders.length).setValues(sampleRows);

  // Format Text columns for NIK & WA
  sheetData.getRange("I2:O1000").setNumberFormat("@");

  // ---------------------------------------------------------------------------
  // 2. SHEET SETTINGS
  // ---------------------------------------------------------------------------
  var sheetSettings = ss.getSheetByName(SHEET_SETTINGS);
  if (!sheetSettings) {
    sheetSettings = ss.insertSheet(SHEET_SETTINGS);
  }
  sheetSettings.clear();

  var settingsHeaders = ["Key", "Value", "Keterangan"];
  var settingsRows = [
    ["JUDUL_WEB", "PPDB ONLINE TERPADU", "Judul Utama Web Header"],
    ["SUB_JUDUL_WEB", "Penerimaan Peserta Didik Baru", "Sub Judul Header Web"],
    ["NAMA_SEKOLAH", "TK / RA AL-IKHLAS", "Nama Lembaga / Sekolah"],
    ["LOGO_URL", "https://cdn-icons-png.flaticon.com/512/2997/2997322.png", "URL Gambar Logo Header Web"],
    ["WA_ADMIN", "6281234567890", "Nomor WhatsApp Admin (Format 62...)"],
    ["PESAN_SUKSES", "Terima kasih! Pendaftaran calon siswa baru berhasil tersimpan di sistem.", "Pesan setelah pendaftaran berhasil"],
    ["KUOTA_DEFAULT", "112", "Jumlah Kuota Maksimal Default Siswa Per Tahun"],
    ["TAHUN_PELAJARAN_UTAMA", "2027/2028", "Tahun Pelajaran Utama Aktif"],
    ["PIN_ADMIN", "1234", "PIN Akses Mode Admin (Default: 1234)"],
    ["API_URL", "https://script.google.com/macros/s/AKfycbzG2ZvYAO0t0HbAO5w_ujh0bnxcqhHX7R7szXV5iuFqM-VktwNnt0dN0n5gcbxWgUh-/exec", "URL Web App GAS (diisi otomatis setelah deploy, atau paste manual)"]
  ];

  sheetSettings.getRange(1, 1, 1, settingsHeaders.length)
    .setValues([settingsHeaders])
    .setBackground("#028090")
    .setFontColor("#FFFFFF")
    .setFontWeight("bold");

  sheetSettings.getRange(2, 1, settingsRows.length, settingsHeaders.length).setValues(settingsRows);
  sheetSettings.setRowHeight(1, 30);
  sheetSettings.setFrozenRows(1);

  // ---------------------------------------------------------------------------
  // 3. SHEET KUOTA
  // ---------------------------------------------------------------------------
  var sheetKuota = ss.getSheetByName(SHEET_KUOTA);
  if (!sheetKuota) {
    sheetKuota = ss.insertSheet(SHEET_KUOTA);
  }
  sheetKuota.clear();

  var kuotaHeaders = ["Tahun Pelajaran", "Kuota Maksimal", "Terisi (Otomatis)", "Sisa Kuota (Otomatis)"];
  var kuotaRows = [
    ["2027/2028", 112, '=COUNTIF(DATA_PENDAFTARAN!C:C, "2027/2028")', '=B2-C2'],
    ["2028/2029", 112, '=COUNTIF(DATA_PENDAFTARAN!C:C, "2028/2029")', '=B3-C3']
  ];

  sheetKuota.getRange(1, 1, 1, kuotaHeaders.length)
    .setValues([kuotaHeaders])
    .setBackground("#05668D")
    .setFontColor("#FFFFFF")
    .setFontWeight("bold")
    .setHorizontalAlignment("center");

  sheetKuota.getRange(2, 1, kuotaRows.length, kuotaHeaders.length).setValues(kuotaRows);
  sheetKuota.setRowHeight(1, 30);
  sheetKuota.setFrozenRows(1);

  // Delete default "Sheet1" or "Sheet1" if redundant
  var defaultSheet = ss.getSheetByName("Sheet1") || ss.getSheetByName("Lembar1");
  if (defaultSheet && ss.getSheets().length > 3) {
    try { ss.deleteSheet(defaultSheet); } catch (e) {}
  }

  // Auto resize columns for neat presentation
  [sheetData, sheetSettings, sheetKuota].forEach(function(sh) {
    for (var col = 1; col <= sh.getLastColumn(); col++) {
      sh.autoResizeColumn(col);
    }
  });

  Logger.log("SETUP DATABASE BERHASIL! Tab DATA_PENDAFTARAN, SETTINGS, dan KUOTA siap digunakan.");
  return "Database Berhasil Diinisialisasi! Tab DATA_PENDAFTARAN, SETTINGS, dan KUOTA telah siap.";
}

/**
 * ==============================================================================
 * ADMIN MODE SERVER-SIDE LOGIC & API
 * ==============================================================================
 */

/**
 * Verify Admin PIN against SETTINGS sheet
 */
function verifyAdminPin(pin) {
  var ss = getSpreadsheet();
  var sheetSettings = ss.getSheetByName(SHEET_SETTINGS);
  if (!sheetSettings) return { success: false, message: "Database SETTINGS belum siap." };

  var values = sheetSettings.getDataRange().getValues();
  var savedPin = "1234"; // Default fallback PIN

  for (var i = 1; i < values.length; i++) {
    if (String(values[i][0]).trim() === "PIN_ADMIN") {
      savedPin = String(values[i][1]).trim();
      break;
    }
  }

  if (String(pin).trim() === savedPin) {
    return { success: true, message: "PIN Valid! Selamat datang Admin." };
  } else {
    return { success: false, message: "PIN Admin Salah! Akses ditolak." };
  }
}

/**
 * Fetch Full Registered Student List for Admin Dashboard
 */
function getAdminDataList(pin) {
  var auth = verifyAdminPin(pin);
  if (!auth.success) return auth;

  var ss = getSpreadsheet();
  SpreadsheetApp.flush();
  var sheetData = ss.getSheetByName(SHEET_DATA);
  if (!sheetData) return { success: false, message: "Tab DATA_PENDAFTARAN tidak ditemukan." };

  var values = sheetData.getDataRange().getValues();
  var students = [];

  for (var i = 1; i < values.length; i++) {
    if (values[i][1]) { // If No Pendaftaran exists
      students.push({
        rowIndex: i + 1,
        timestamp: values[i][0] ? Utilities.formatDate(new Date(values[i][0]), "Asia/Jakarta", "dd/MM/yyyy HH:mm") : "-",
        noPendaftaran: String(values[i][1]),
        tahunPelajaran: String(values[i][2]),
        namaSiswa: String(values[i][3]),
        jenisKelamin: String(values[i][4]),
        tempatLahir: String(values[i][5]),
        tanggalLahir: values[i][6] ? String(values[i][6]) : "-",
        asalSekolah: String(values[i][7]),
        nikSiswa: String(values[i][8]).replace(/^'/, ''),
        noWhatsapp: String(values[i][9]).replace(/^'/, ''),
        noKk: String(values[i][10]).replace(/^'/, ''),
        namaAyah: String(values[i][11]),
        nikAyah: String(values[i][12]).replace(/^'/, ''),
        namaIbu: String(values[i][13]),
        nikIbu: String(values[i][14]).replace(/^'/, ''),
        status: values[i][15] ? String(values[i][15]) : "PENDING"
      });
    }
  }

  var appData = getAppData();

  return {
    success: true,
    students: students,
    settings: appData.settings,
    kuota: appData.kuota
  };
}

/**
 * Update Student Status (e.g. DITERIMA / DITOLAK / VERIFIKASI)
 */
function updateStudentStatus(pin, noPendaftaran, newStatus) {
  var auth = verifyAdminPin(pin);
  if (!auth.success) return auth;

  var ss = getSpreadsheet();
  var sheetData = ss.getSheetByName(SHEET_DATA);
  var values = sheetData.getDataRange().getValues();

  for (var i = 1; i < values.length; i++) {
    if (String(values[i][1]).trim() === String(noPendaftaran).trim()) {
      sheetData.getRange(i + 1, 16).setValue(newStatus); // Col 16 = Status
      SpreadsheetApp.flush();
      return { success: true, message: "Status peserta " + noPendaftaran + " berhasil diubah menjadi '" + newStatus + "'." };
    }
  }

  return { success: false, message: "Nomor Pendaftaran tidak ditemukan." };
}

/**
 * Update Quota Limit per Academic Year from Admin Dashboard
 */
function updateQuotaLimit(pin, tahunPelajaran, newLimit) {
  var auth = verifyAdminPin(pin);
  if (!auth.success) return auth;

  var ss = getSpreadsheet();
  var sheetKuota = ss.getSheetByName(SHEET_KUOTA);
  var values = sheetKuota.getDataRange().getValues();

  for (var i = 1; i < values.length; i++) {
    if (String(values[i][0]).trim() === String(tahunPelajaran).trim()) {
      sheetKuota.getRange(i + 1, 2).setValue(parseInt(newLimit) || 112); // Col 2 = Kuota Maksimal
      SpreadsheetApp.flush();
      var updatedAppData = getAppData();
      return {
        success: true,
        message: "Kuota Tahun Pelajaran " + tahunPelajaran + " berhasil diubah menjadi " + newLimit + " siswa.",
        kuota: updatedAppData.kuota
      };
    }
  }

  return { success: false, message: "Tahun Pelajaran tidak ditemukan di sheet KUOTA." };
}

/**
 * Delete Student Row
 */
function deleteStudentRow(pin, noPendaftaran) {
  var auth = verifyAdminPin(pin);
  if (!auth.success) return auth;

  var ss = getSpreadsheet();
  var sheetData = ss.getSheetByName(SHEET_DATA);
  var values = sheetData.getDataRange().getValues();

  for (var i = 1; i < values.length; i++) {
    if (String(values[i][1]).trim() === String(noPendaftaran).trim()) {
      sheetData.deleteRow(i + 1);
      SpreadsheetApp.flush();
      return { success: true, message: "Data pendaftaran " + noPendaftaran + " berhasil dihapus." };
    }
  }

  return { success: false, message: "Data tidak ditemukan." };
}

/**
 * ==============================================================================
 * API URL MANAGEMENT — Simpan & Baca dari Sheet SETTINGS
 * ==============================================================================
 */

/**
 * Simpan API URL ke sheet SETTINGS (dipanggil dari frontend admin)
 * PIN wajib untuk keamanan
 */
function saveApiUrl(pin, apiUrl) {
  var auth = verifyAdminPin(pin);
  if (!auth.success) return auth;

  if (!apiUrl || String(apiUrl).trim() === "") {
    return { success: false, message: "URL tidak boleh kosong." };
  }

  var url = String(apiUrl).trim();

  // Validasi dasar — harus diawali https://
  if (!url.startsWith("https://")) {
    return { success: false, message: "URL harus diawali dengan https://" };
  }

  var ss = getSpreadsheet();
  var sheetSettings = ss.getSheetByName(SHEET_SETTINGS);
  if (!sheetSettings) return { success: false, message: "Sheet SETTINGS tidak ditemukan." };

  var values = sheetSettings.getDataRange().getValues();
  var found = false;

  for (var i = 1; i < values.length; i++) {
    if (String(values[i][0]).trim() === "API_URL") {
      sheetSettings.getRange(i + 1, 2).setValue(url);
      found = true;
      break;
    }
  }

  // Jika key belum ada, tambahkan baris baru
  if (!found) {
    var lastRow = sheetSettings.getLastRow() + 1;
    sheetSettings.getRange(lastRow, 1, 1, 3).setValues([
      ["API_URL", url, "URL Web App GAS (diisi otomatis setelah deploy)"]
    ]);
  }

  SpreadsheetApp.flush();

  return {
    success: true,
    message: "API URL berhasil disimpan ke spreadsheet!",
    apiUrl: url
  };
}

/**
 * Baca API URL dari sheet SETTINGS — tidak butuh PIN (hanya baca)
 */
function getApiUrl() {
  try {
    var ss = getSpreadsheet();
    var sheetSettings = ss.getSheetByName(SHEET_SETTINGS);
    if (!sheetSettings) return { success: false, apiUrl: "" };

    var values = sheetSettings.getDataRange().getValues();
    for (var i = 1; i < values.length; i++) {
      if (String(values[i][0]).trim() === "API_URL") {
        var url = String(values[i][1]).trim();
        return { success: true, apiUrl: url };
      }
    }
    return { success: true, apiUrl: "" };
  } catch (e) {
    return { success: false, apiUrl: "" };
  }
}

/**
 * Auto-detect dan simpan URL dari request aktif (jalankan sekali setelah deploy)
 * Jalankan fungsi ini dari editor GAS setelah deploy sebagai Web App
 */
function autoSaveDeployedUrl() {
  try {
    var url = ScriptApp.getService().getUrl();
    if (url) {
      var ss = getSpreadsheet();
      var sheetSettings = ss.getSheetByName(SHEET_SETTINGS);
      var values = sheetSettings.getDataRange().getValues();
      for (var i = 1; i < values.length; i++) {
        if (String(values[i][0]).trim() === "API_URL") {
          sheetSettings.getRange(i + 1, 2).setValue(url);
          SpreadsheetApp.flush();
          Logger.log("API URL otomatis tersimpan: " + url);
          return url;
        }
      }
    }
  } catch (e) {
    Logger.log("autoSaveDeployedUrl error: " + e.toString());
  }
  return null;
}
