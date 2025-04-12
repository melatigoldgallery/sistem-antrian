import { getAttendanceByDateRange, deleteAttendanceByDateRange } from "../services/report-service.js";
import {
  attendanceCache,
  shouldUpdateCache as shouldUpdateAttendanceCache,
  updateCacheTimestamp as updateAttendanceCacheTimestamp,
  saveAttendanceCacheToStorage,
} from "../services/attendance-service.js";

// Global variables
let currentAttendanceData = [];
let filteredData = [];
let attendanceDataCache = new Map(); // Cache untuk laporan kehadiran
let attendanceDataCacheMeta = new Map(); // Metadata untuk cache laporan

// Fungsi untuk menampilkan atau menyembunyikan indikator loading
function showLoading(show) {
  const loadingIndicator = document.getElementById("loadingIndicator");

  // Jika elemen loading indicator belum ada, buat baru
  if (!loadingIndicator && show) {
    // Buat elemen loading indicator
    const indicator = document.createElement("div");
    indicator.id = "loadingIndicator";
    indicator.className = "loading-overlay";
    indicator.innerHTML = `
      <div class="spinner-border text-primary" role="status">
        <span class="visually-hidden">Loading...</span>
      </div>
      <p class="mt-2">Memuat data...</p>
    `;

    // Tambahkan style untuk loading overlay jika belum ada
    if (!document.getElementById("loadingStyles")) {
      const style = document.createElement("style");
      style.id = "loadingStyles";
      style.textContent = `
        .loading-overlay {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background-color: rgba(255, 255, 255, 0.8);
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          z-index: 9999;
        }
      `;
      document.head.appendChild(style);
    }

    // Tambahkan ke body
    document.body.appendChild(indicator);
  }
  // Jika elemen sudah ada, tampilkan atau sembunyikan
  else if (loadingIndicator) {
    loadingIndicator.style.display = show ? "flex" : "none";
  }
}
// Fungsi untuk mengompresi data sebelum disimpan ke localStorage
function compressData(data) {
  try {
    // Konversi data ke string JSON
    const jsonString = JSON.stringify(data);

    // Kompresi sederhana dengan menghapus spasi berlebih
    return jsonString.replace(/\s+/g, "");
  } catch (error) {
    console.error("Error compressing data:", error);
    return JSON.stringify(data);
  }
}
// Fungsi untuk mendekompresi data dari localStorage
function decompressData(compressedData) {
  try {
    // Parse string JSON yang telah dikompresi
    return JSON.parse(compressedData);
  } catch (error) {
    console.error("Error decompressing data:", error);
    return null;
  }
}

// Tambahkan persistensi cache menggunakan localStorage
function saveReportCacheToStorage() {
  try {
    // Konversi Map ke objek untuk localStorage
    const cacheObj = {};
    for (const [key, value] of attendanceDataCache.entries()) {
      cacheObj[key] = value;
    }

    const metaObj = {};
    for (const [key, value] of attendanceDataCacheMeta.entries()) {
      metaObj[key] = value;
    }

    localStorage.setItem("reportCache", JSON.stringify(cacheObj));
    localStorage.setItem("reportCacheMeta", JSON.stringify(metaObj));
    console.log("Report cache saved to localStorage");
  } catch (error) {
    console.error("Error saving report cache to localStorage:", error);
  }
}

// Fungsi untuk menampilkan data kehadiran
function displayAttendanceData(data) {
  // Simpan data ke variabel global
  currentAttendanceData = data;
  filteredData = [...data];
  
  // Update summary cards
  updateSummaryCards();
  
  // Tampilkan semua data
  displayAllData();
  
  // Tampilkan elemen laporan jika ada data
  if (data.length > 0) {
    showReportElements();
    
    // Tampilkan tombol aksi
    showActionButtons();
    
    // Sembunyikan pesan "tidak ada data"
    const noDataMessage = document.getElementById("noDataMessage");
    if (noDataMessage) {
      noDataMessage.style.display = "none";
    }
  } else {
    // Sembunyikan elemen laporan jika tidak ada data
    hideReportElements();
    
    // Sembunyikan tombol aksi
    hideActionButtons();
    
    // Tampilkan pesan "tidak ada data"
    const noDataMessage = document.getElementById("noDataMessage");
    if (noDataMessage) {
      noDataMessage.style.display = "block";
    }
  }
}

// Fungsi untuk menampilkan semua data sekaligus
function displayAllData() {
  const tbody = document.getElementById("attendanceReportList");
  if (!tbody) return;
  
  // Clear existing rows
  tbody.innerHTML = "";
  
  // Create document fragment for better performance
  const fragment = document.createDocumentFragment();
  
  // Add all rows
  filteredData.forEach((record, i) => {
    const row = document.createElement("tr");
    
    // Add data attributes for filtering
    row.dataset.shift = record.shift;
    row.dataset.status = record.status.toLowerCase().replace(/\s+/g, "-");
    row.dataset.type = record.type;
    
    // Format times
    const timeIn = record.timeIn ? formatTime(record.timeIn) : "-";
    const timeOut = record.timeOut ? formatTime(record.timeOut) : "-";
    
    // Calculate work duration
    const workDuration = calculateWorkDuration(record.timeIn, record.timeOut);
    
    // Gunakan tanggal dari timeIn jika tersedia
    let displayDate;
    if (record.timeIn) {
      // Gunakan tanggal dari timeIn untuk konsistensi
      displayDate = formatDateForDisplay(record.timeIn);
    } else {
      // Fallback ke field date jika timeIn tidak tersedia
      displayDate = formatDateForDisplay(record.date);
    }
    
    row.innerHTML = `
      <td>${i + 1}</td>
      <td>${record.employeeId || "-"}</td>
      <td>${record.name || "-"}</td>
      <td>${displayDate}</td>
      <td>${formatEmployeeType(record.type)}</td>
      <td>${formatShift(record.shift)}</td>
      <td>${timeIn}</td>
      <td>${timeOut}</td>
      <td>${workDuration}</td>
      <td class="status-${record.status.toLowerCase().replace(/\s+/g, "-")}">
        ${record.status}
        ${record.lateMinutes ? `<span class="late-minutes">(${record.lateMinutes} menit)</span>` : ""}
      </td>
    `;
    
    fragment.appendChild(row);
  });
  
  tbody.appendChild(fragment);
  
  // Tambahkan informasi jumlah data
  const dataCountInfo = document.createElement("div");
  dataCountInfo.className = "text-muted mt-2";
  dataCountInfo.textContent = `Menampilkan ${filteredData.length} data`;
  
  const tableContainer = document.querySelector("#tableContainer .card-body");
  if (tableContainer) {
    const existingInfo = tableContainer.querySelector(".text-muted");
    if (existingInfo) existingInfo.remove();
    tableContainer.appendChild(dataCountInfo);
  }
}

// Modifikasi fungsi loadAttendanceData untuk menyertakan filter shift
async function loadAttendanceData(forceRefresh = false) {
  try {
    const startDateInput = document.getElementById("startDate");
    const endDateInput = document.getElementById("endDate");
    const shiftFilterEl = document.getElementById("shiftFilter");
    
    if (!startDateInput || !endDateInput || !shiftFilterEl) {
      console.error("Required inputs not found");
      return;
    }
    
    const startDate = startDateInput.value;
    const endDate = endDateInput.value;
    const selectedShift = shiftFilterEl.value;
    
    if (!startDate || !endDate) {
      showAlert("warning", "Silakan pilih rentang tanggal terlebih dahulu");
      return;
    }
    
    // Validasi shift - harus dipilih
    if (!selectedShift) {
      showAlert("warning", "Mohon pilih shift terlebih dahulu");
      shiftFilterEl.classList.add("is-invalid");
      return;
    } else {
      shiftFilterEl.classList.remove("is-invalid");
    }
    
    // Buat kunci cache dengan shift
    const cacheKey = `range_${startDate}_${endDate}_${selectedShift}`;
    
    // Cek apakah data ada di cache dan masih valid
    if (!forceRefresh && attendanceCache.has(cacheKey) && !shouldUpdateAttendanceCache(cacheKey)) {
      console.log(`Using cached attendance data for range ${startDate} to ${endDate}`);
      
      // Tampilkan indikator cache di UI
      const cacheIndicator = document.getElementById('cacheIndicator');
      if (cacheIndicator) {
        cacheIndicator.textContent = 'Menggunakan data cache';
        cacheIndicator.style.display = 'inline-block';
      }
      
      // Ambil data dari cache
      const cachedData = attendanceCache.get(cacheKey);
      
      // Tampilkan data
      displayAttendanceData(cachedData);
      return;
    }
    
    // Tampilkan indikator loading
    showLoading(true);
    
    // Ambil data dari server - tanpa pagination (limit = 0 atau nilai besar)
    // Tambahkan parameter shift
    const result = await getAttendanceByDateRange(startDate, endDate, null, 1000, selectedShift);
    
    // Update data
    currentAttendanceData = result.attendanceRecords || [];
    
    // Sembunyikan indikator loading
    showLoading(false);
    
    // Sembunyikan indikator cache di UI
    const cacheIndicator = document.getElementById('cacheIndicator');
    if (cacheIndicator) {
      cacheIndicator.style.display = 'none';
    }
    
    // Tampilkan data
    displayAttendanceData(currentAttendanceData);
    
  } catch (error) {
    console.error("Error loading attendance data:", error);
    
    // Coba gunakan cache sebagai fallback jika terjadi error
    const startDate = document.getElementById("startDate").value;
    const endDate = document.getElementById("endDate").value;
    const selectedShift = document.getElementById("shiftFilter").value;
    const cacheKey = `range_${startDate}_${endDate}_${selectedShift}`;
    
    if (attendanceCache.has(cacheKey)) {
      console.log(`Fallback to cached data for range ${startDate} to ${endDate} due to error`);
      // Tampilkan pesan error tapi tetap tampilkan data
      showAlert("warning", "Terjadi kesalahan saat mengambil data terbaru. Menampilkan data dari cache.");
      
      // Tampilkan indikator cache di UI
      const cacheIndicator = document.getElementById('cacheIndicator');
      if (cacheIndicator) {
        cacheIndicator.textContent = 'Menggunakan data cache (fallback)';
        cacheIndicator.style.display = 'inline-block';
      }
      
      // Ambil data dari cache
      const cachedData = attendanceCache.get(cacheKey);
      
      // Tampilkan data
      displayAttendanceData(cachedData);
    } else {
      // Tidak ada cache, tampilkan pesan error
      showAlert("danger", "Terjadi kesalahan saat memuat data kehadiran: " + error.message);
      showLoading(false);
    }
  }
}

// Fungsi forceRefreshData - diperbarui untuk validasi shift
function forceRefreshData() {
  // Tampilkan konfirmasi
  if (confirm("Apakah Anda yakin ingin menyegarkan data dari server?")) {
    // Ambil nilai tanggal dan shift
    const startDate = document.getElementById("startDate").value;
    const endDate = document.getElementById("endDate").value;
    const selectedShift = document.getElementById("shiftFilter").value;
    
    if (!startDate || !endDate) {
      showAlert("warning", "Silakan pilih rentang tanggal terlebih dahulu");
      return;
    }
    
    // Validasi shift - harus dipilih
    if (!selectedShift) {
      showAlert("warning", "Mohon pilih shift terlebih dahulu");
      document.getElementById("shiftFilter").classList.add("is-invalid");
      return;
    } else {
      document.getElementById("shiftFilter").classList.remove("is-invalid");
    }
    
    // Hapus cache untuk rentang tanggal dan shift ini
    const cacheKey = `range_${startDate}_${endDate}_${selectedShift}`;
    if (attendanceCache.has(cacheKey)) {
      attendanceCache.delete(cacheKey);
      saveAttendanceCacheToStorage();
    }
    
    // Panggil loadAttendanceData dengan forceRefresh=true
    loadAttendanceData(true);
    
    // Tampilkan pesan
    showAlert("info", "Data sedang disegarkan dari server...");
  }
}


function loadReportCacheFromStorage() {
  try {
    const cacheStr = localStorage.getItem("reportCache");
    const metaStr = localStorage.getItem("reportCacheMeta");

    if (cacheStr && metaStr) {
      const cacheObj = JSON.parse(cacheStr);
      const metaObj = JSON.parse(metaStr);

      // Konversi objek kembali ke Map
      attendanceDataCache.clear();
      attendanceDataCacheMeta.clear();

      for (const [key, value] of Object.entries(cacheObj)) {
        attendanceDataCache.set(key, value);
      }

      for (const [key, value] of Object.entries(metaObj)) {
        attendanceDataCacheMeta.set(key, value);
      }
    }
  } catch (error) {
    console.error("Error loading report cache from localStorage:", error);
  }
}
// Fungsi untuk memeriksa apakah cache perlu diperbarui (lebih dari 1 jam)
function shouldUpdateReportCache(cacheKey) {
  if (!attendanceDataCacheMeta.has(cacheKey)) return true;

  const lastUpdate = attendanceDataCacheMeta.get(cacheKey);
  const now = Date.now();
  const oneHour = 60 * 60 * 1000; // 1 jam dalam milidetik

  return now - lastUpdate > oneHour;
}

// Modifikasi updateReportCacheTimestamp untuk menyimpan ke localStorage
function updateReportCacheTimestamp(cacheKey) {
  attendanceDataCacheMeta.set(cacheKey, Date.now());
  saveReportCacheToStorage();
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("generateReportBtn").addEventListener("click", async function() {
    try {
      // Tampilkan loading state
      this.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i> Memproses...';
      this.disabled = true;
  
     // Ambil nilai filter
     const startDate = document.getElementById("startDate")?.value || "";
     const endDate = document.getElementById("endDate")?.value || "";
     const employeeType = document.getElementById("employeeTypeFilter")?.value || "all";
     const shift = document.getElementById("shiftFilter")?.value || "";
  
      // Validasi tanggal
      if (!startDate || !endDate) {
        showAlert("warning", "Silakan pilih rentang tanggal terlebih dahulu");
        this.innerHTML = '<i class="fas fa-sync-alt me-2"></i> Generate Laporan';
        this.disabled = false;
        return;
      }
  
      // Panggil fungsi generateReport yang sudah ada
      await generateReport();
  
      // Tampilkan tombol export dan hapus data
      document.getElementById("actionButtons").classList.remove("d-none");
  
      // Kembalikan tombol ke state awal
      this.innerHTML = '<i class="fas fa-sync-alt me-2"></i> Generate Laporan';
      this.disabled = false;
    } catch (error) {
      console.error("Error generating report:", error);
      showAlert("danger", "Terjadi kesalahan saat menghasilkan laporan: " + error.message);
    }
  });
  
  // Tambahkan tombol refresh jika belum ada
  const tableHeader = document.querySelector('.card-header .d-flex');
  if (tableHeader && !document.getElementById('refreshData')) {
    const refreshButton = document.createElement('button');
    refreshButton.id = 'refreshData';
    refreshButton.className = 'btn btn-outline-secondary ms-2';
    refreshButton.innerHTML = '<i class="fas fa-sync-alt"></i> Refresh Data';
    refreshButton.addEventListener('click', forceRefreshData);
    
    // Tambahkan ke UI
    tableHeader.appendChild(refreshButton);
  }
  
  // Hapus event listener untuk tombol load more karena kita tidak menggunakannya lagi
  
  // Set current date and time
  function updateDateTime() {
    const now = new Date();
    const dateElement = document.getElementById("current-date");
    const timeElement = document.getElementById("current-time");

    if (dateElement) {
      dateElement.textContent = now.toLocaleDateString("id-ID", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    }

    if (timeElement) {
      timeElement.textContent = now.toLocaleTimeString("id-ID");
    }
  }

  updateDateTime();
  setInterval(updateDateTime, 1000);

  // Initialize date pickers with default values
  initializeDatePickers();

  // Setup event listeners
  setupEventListeners();
  
  // Sembunyikan tombol aksi saat halaman pertama kali dimuat
  hideActionButtons();
  
  // Sembunyikan elemen laporan lainnya
  hideReportElements();
  loadReportCacheFromStorage();
  
  // Tambahkan event listeners untuk tombol filter
  document.getElementById('filterAll')?.addEventListener('click', () => filterAttendanceByStatus('all'));
  document.getElementById('filterOnTime')?.addEventListener('click', () => filterAttendanceByStatus('ontime'));
  document.getElementById('filterLate')?.addEventListener('click', () => filterAttendanceByStatus('late'));
});

// Initialize date pickers with default values
function initializeDatePickers() {
  // Gunakan Date untuk mendapatkan tanggal lokal
  const today = new Date();

  const startDateInput = document.getElementById("startDate");
  const endDateInput = document.getElementById("endDate");

  if (startDateInput) {
    // Format tanggal untuk input date (YYYY-MM-DD)
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    const formattedDate = `${year}-${month}-${day}`;
    startDateInput.value = formattedDate;
  }

  if (endDateInput) {
    // Format tanggal untuk input date (YYYY-MM-DD)
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    const formattedDate = `${year}-${month}-${day}`;

    endDateInput.value = formattedDate;
  }
}

// Setup event listeners - diperbarui untuk dropdown
function setupEventListeners() {
  // Generate report button
  const generateReportBtn = document.getElementById("generateReportBtn");
  if (generateReportBtn) {
    generateReportBtn.addEventListener("click", generateReport);
  }
  
  // Export buttons
  const exportExcelBtn = document.getElementById("exportExcelBtn");
  if (exportExcelBtn) {
    exportExcelBtn.addEventListener("click", exportToExcel);
  }
  
  const exportPdfBtn = document.getElementById("exportPdfBtn");
  if (exportPdfBtn) {
    exportPdfBtn.addEventListener("click", exportToPDF);
  }
  
  // Delete data button
  const deleteDataBtn = document.getElementById("deleteDataBtn");
  if (deleteDataBtn) {
    deleteDataBtn.addEventListener("click", function() {
      console.log("Delete button clicked");
      showDeleteConfirmation();
    });
  } else {
    console.error("Delete button not found");
  }
  
  // Confirm delete button
  const confirmDeleteBtn = document.getElementById("confirmDeleteBtn");
  if (confirmDeleteBtn) {
    confirmDeleteBtn.addEventListener("click", function() {
      console.log("Confirm delete button clicked");
      deleteAttendanceData();
    });
  } else {
    console.error("Confirm delete button not found");
  }
  
  // Filter status dropdown
  document.getElementById('filterAll')?.addEventListener('click', function(e) {
    e.preventDefault();
    filterAttendanceByStatus('all');
  });
  
  document.getElementById('filterOnTime')?.addEventListener('click', function(e) {
    e.preventDefault();
    filterAttendanceByStatus('ontime');
  });
  
  document.getElementById('filterLate')?.addEventListener('click', function(e) {
    e.preventDefault();
    filterAttendanceByStatus('late');
  });
  
  // Filter tipe karyawan dropdown
  document.querySelectorAll("[data-employee-filter]").forEach((item) => {
    item.addEventListener("click", function (e) {
      e.preventDefault();
      const filter = this.dataset.employeeFilter;
      filterAttendanceData("type", filter);
    });
  });
  
  // Refresh data button
  document.getElementById("refreshData")?.addEventListener("click", forceRefreshData);
  
  // Tambahkan event listener untuk validasi shift saat berubah
  document.getElementById("shiftFilter")?.addEventListener("change", function() {
    if (this.value) {
      this.classList.remove("is-invalid");
    }
  });
}

// Fungsi untuk menyembunyikan tombol aksi (export dan hapus) - versi yang lebih kuat
function hideActionButtons() {
  try {
    const actionButtons = document.getElementById("actionButtons");
    if (actionButtons) {
      // Gunakan !important untuk memastikan style diterapkan
      actionButtons.setAttribute("style", "display: none !important");
      
      // Log untuk debugging
      console.log("Action buttons hidden");
      
      // Tambahan: sembunyikan juga tombol-tombol individual jika ada
      const exportExcelBtn = document.getElementById("exportExcelBtn");
      const exportPdfBtn = document.getElementById("exportPdfBtn");
      const deleteDataBtn = document.getElementById("deleteDataBtn");
      
      if (exportExcelBtn) exportExcelBtn.style.display = "none";
      if (exportPdfBtn) exportPdfBtn.style.display = "none";
      if (deleteDataBtn) deleteDataBtn.style.display = "none";
    } else {
      console.warn("Action buttons element not found with ID 'actionButtons'");
    }
  } catch (error) {
    console.error("Error hiding action buttons:", error);
  }
}

// Fungsi untuk menampilkan tombol aksi (export dan hapus) - versi yang lebih kuat
function showActionButtons() {
  try {
    const actionButtons = document.getElementById("actionButtons");
    if (actionButtons) {
      // Gunakan !important untuk memastikan style diterapkan
      actionButtons.setAttribute("style", "display: flex !important");
      
      // Log untuk debugging
      console.log("Action buttons shown");
      
      // Tambahan: tampilkan juga tombol-tombol individual jika ada
      const exportExcelBtn = document.getElementById("exportExcelBtn");
      const exportPdfBtn = document.getElementById("exportPdfBtn");
      const deleteDataBtn = document.getElementById("deleteDataBtn");
      
      if (exportExcelBtn) exportExcelBtn.style.display = "inline-block";
      if (exportPdfBtn) exportPdfBtn.style.display = "inline-block";
      if (deleteDataBtn) deleteDataBtn.style.display = "inline-block";
    } else {
      console.warn("Action buttons element not found with ID 'actionButtons'");
    }
  } catch (error) {
    console.error("Error showing action buttons:", error);
  }
}

// Modifikasi fungsi generateReport untuk memvalidasi shift
async function generateReport() {
  try {
    const startDateEl = document.getElementById("startDate");
    const endDateEl = document.getElementById("endDate");
    const shiftFilterEl = document.getElementById("shiftFilter");
    
    if (!startDateEl || !endDateEl || !shiftFilterEl) {
      console.error("Required elements not found");
      return;
    }
    
    const startDate = startDateEl.value;
    const endDate = endDateEl.value;
    const selectedShift = shiftFilterEl.value;
    
    // Validasi tanggal
    if (!startDate || !endDate) {
      showAlert("warning", "Mohon pilih tanggal mulai dan tanggal akhir");
      return;
    }
    
    // Validasi shift - harus dipilih
    if (!selectedShift) {
      showAlert("warning", "Mohon pilih shift terlebih dahulu");
      shiftFilterEl.classList.add("is-invalid");
      return;
    } else {
      shiftFilterEl.classList.remove("is-invalid");
    }
    
    // Validate date range
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    if (start > end) {
      showAlert("warning", "Tanggal mulai tidak boleh lebih besar dari tanggal akhir");
      return;
    }
    
    // Check if date range is too large
    const dayDiff = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
    if (dayDiff > 31) {
      showAlert("warning", "Rentang tanggal maksimal adalah 31 hari");
      return;
    }
    
    // Create cache key - tambahkan shift ke cache key
    const cacheKey = `${startDate}_${endDate}_${selectedShift}`;
    
    // Show loading state
    showAlert("info", '<i class="fas fa-spinner fa-spin me-2"></i> Memuat data kehadiran...', false);
    
    let attendanceData;
    
    // Check if data is in cache and still valid (less than 1 hour old)
    if (attendanceDataCache.has(cacheKey) && !shouldUpdateReportCache(cacheKey)) {
      attendanceData = attendanceDataCache.get(cacheKey);      
      // Hide loading message
      hideAlert();
    } else {
      // Check if we can use data from sistem-absensi cache
      let canUseSystemCache = true;
      const dateRange = getDatesInRange(start, end);
      
      for (const date of dateRange) {
        // Gunakan format tanggal lokal yang konsisten
        const dateStr = getLocalDateStringFromDate(date);
        if (!attendanceCache.has(dateStr) || shouldUpdateCache(dateStr)) {
          canUseSystemCache = false;
          break;
        }
      }
      
      if (canUseSystemCache) {
        // Combine data from sistem-absensi cache
        attendanceData = [];
        for (const date of dateRange) {
          // Gunakan format tanggal lokal yang konsisten
          const dateStr = getLocalDateStringFromDate(date);
          const dayData = attendanceCache.get(dateStr);
          if (dayData && dayData.length > 0) {
            // Filter berdasarkan shift yang dipilih
            const filteredData = selectedShift === "all" 
              ? dayData 
              : dayData.filter(record => record.shift === selectedShift);
            attendanceData.push(...filteredData);
          }
        }
        console.log("Using sistem-absensi cache for report (less than 1 hour old)");
      } else {
        // Fetch from Firestore - tanpa pagination (limit besar)
        const result = await getAttendanceByDateRange(startDate, endDate, null, 1000, selectedShift);
        attendanceData = result.attendanceRecords;
        
        // Store in cache with timestamp
        attendanceDataCache.set(cacheKey, [...attendanceData]);
        updateReportCacheTimestamp(cacheKey);
      }
      
      // Hide loading message
      hideAlert();
    }
    
    // Update global data
    currentAttendanceData = attendanceData;
    filteredData = [...attendanceData];
   
    // Update UI
    if (attendanceData.length > 0) {
      updateSummaryCards();
      displayAllData(); // Gunakan fungsi baru untuk menampilkan semua data
      showReportElements();
      
      // Tampilkan tombol export dan hapus data setelah laporan di-generate
      showActionButtons();
      // Sembunyikan pesan tidak ada data
        const noDataMessage = document.getElementById("noDataMessage");
        if (noDataMessage) noDataMessage.style.display = "none";
    } else {
      hideReportElements();
      // Pastikan tombol aksi tetap tersembunyi jika tidak ada data
      hideActionButtons();

      const noDataMessage = document.getElementById("noDataMessage");
      if (noDataMessage) noDataMessage.style.display = "block";

     // TAMBAHAN: Tampilkan alert peringatan bahwa tidak ada data
     showAlert("warning", '<i class="fas fa-exclamation-triangle me-2"></i> Tidak ada data kehadiran untuk periode yang dipilih');
    }
    
    // Update delete confirmation modal with date range
    const deletePeriod = document.getElementById("deletePeriod");
    if (deletePeriod) {
      deletePeriod.textContent = `${formatDateForDisplay(startDate)} hingga ${formatDateForDisplay(endDate)}`;
    }
    
  } catch (error) {
    console.error("Error generating report:", error);
    showAlert("danger", `<i class="fas fa-exclamation-circle me-2"></i> Terjadi kesalahan: ${error.message}`);
    // Pastikan tombol aksi tersembunyi jika terjadi error
    hideActionButtons();
  }
}

// Delete attendance data
async function deleteAttendanceData() {
  try {
    const startDate = document.getElementById("startDate").value;
    const endDate = document.getElementById("endDate").value;

    if (!startDate || !endDate) {
      showAlert("warning", "Pilih rentang tanggal terlebih dahulu");
      return;
    }

    // Show loading in modal
    const confirmBtn = document.getElementById("confirmDeleteBtn");
    if (!confirmBtn) {
      console.error("Confirm delete button not found");
      return;
    }

    const originalBtnText = confirmBtn.innerHTML;
    confirmBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i> Menghapus...';
    confirmBtn.disabled = true;

    // Delete data
    console.log(`Deleting data from ${startDate} to ${endDate}`);
    const deletedCount = await deleteAttendanceByDateRange(startDate, endDate);

    // Hide modal
    const deleteConfirmModal = document.getElementById("deleteConfirmModal");
    if (deleteConfirmModal) {
      const modal = bootstrap.Modal.getInstance(deleteConfirmModal);
      if (modal) {
        modal.hide();
      } else {
        // Fallback if modal instance not found
        const newModal = new bootstrap.Modal(deleteConfirmModal);
        newModal.hide();
      }
    }

    // Show success message
    showAlert("success", `<i class="fas fa-check-circle me-2"></i> Berhasil menghapus ${deletedCount} data kehadiran`);

    // Clear cache
    const cacheKey = `${startDate}_${endDate}`;
    attendanceDataCache.delete(cacheKey);
    attendanceDataCacheMeta.delete(cacheKey);

    // Clear sistem-absensi cache for affected dates
    const start = new Date(startDate);
    const end = new Date(endDate);
    const dateRange = getDatesInRange(start, end);

    for (const date of dateRange) {
      // Gunakan format tanggal lokal yang konsisten
      const dateStr = getLocalDateStringFromDate(date);
      if (attendanceCache.has(dateStr)) {
        attendanceCache.delete(dateStr);
      }
    }

    // Reset UI
    hideReportElements();
    const noDataMessage = document.getElementById("noDataMessage");
    if (noDataMessage) noDataMessage.style.display = "block";

    // Reset button
    confirmBtn.innerHTML = originalBtnText;
    confirmBtn.disabled = false;

    // Reset data
    currentAttendanceData = [];
    filteredData = [];
  } catch (error) {
    console.error("Error deleting data:", error);

    // Show error
    showAlert("danger", `<i class="fas fa-exclamation-circle me-2"></i> Gagal menghapus data: ${error.message}`);

    // Reset button
    const confirmBtn = document.getElementById("confirmDeleteBtn");
    if (confirmBtn) {
      confirmBtn.innerHTML = '<i class="fas fa-trash-alt me-2"></i> Ya, Hapus Data';
      confirmBtn.disabled = false;
    }

    // Hide modal
    const deleteConfirmModal = document.getElementById("deleteConfirmModal");
    if (deleteConfirmModal) {
      const modal = bootstrap.Modal.getInstance(deleteConfirmModal);
      if (modal) {
        modal.hide();
      }
    }
  }
}

// Get array of dates in range
function getDatesInRange(startDate, endDate) {
  const dates = [];
  let currentDate = new Date(startDate);
  const endDateObj = new Date(endDate);

  // Set waktu ke 00:00:00 untuk menghindari masalah perbandingan
  currentDate.setHours(0, 0, 0, 0);
  endDateObj.setHours(0, 0, 0, 0);

  while (currentDate <= endDateObj) {
    dates.push(new Date(currentDate));
    currentDate.setDate(currentDate.getDate() + 1);
  }

  return dates;
}

// Fungsi untuk mendapatkan string tanggal lokal dari objek Date
function getLocalDateStringFromDate(date) {
  // Pastikan kita menggunakan tanggal lokal
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// Clear attendance data cache
function clearAttendanceDataCache() {
  attendanceDataCache.clear();
  attendanceDataCacheMeta.clear();
  console.log("Attendance data cache cleared");
}

// Show report elements
function showReportElements() {
  const summaryCards = document.getElementById("summaryCards");
  if (summaryCards) summaryCards.style.display = "flex";
  
  // Tombol aksi ditangani oleh fungsi showActionButtons()
  
  const tableContainer = document.getElementById("tableContainer");
  if (tableContainer) tableContainer.style.display = "block";
  
  const noDataMessage = document.getElementById("noDataMessage");
  if (noDataMessage) noDataMessage.style.display = "none";
}


// Hide report elements
function hideReportElements() {
  const summaryCards = document.getElementById("summaryCards");
  if (summaryCards) summaryCards.style.display = "none";
  
  // Tombol aksi ditangani oleh fungsi hideActionButtons()
  hideActionButtons();
  
  const tableContainer = document.getElementById("tableContainer");
  if (tableContainer) tableContainer.style.display = "none";
  
  const noDataMessage = document.getElementById("noDataMessage");
  if (noDataMessage) noDataMessage.style.display = "none";
}


// Update summary cards
function updateSummaryCards() {
  const totalAttendance = filteredData.length;
  const onTimeCount = filteredData.filter((record) => record.status === "Tepat Waktu").length;
  const lateCount = filteredData.filter((record) => record.status === "Terlambat").length;

  // Update UI with null checks
  const totalAttendanceEl = document.getElementById("totalAttendance");
  if (totalAttendanceEl) totalAttendanceEl.textContent = totalAttendance;

  const onTimeCountEl = document.getElementById("onTimeCount");
  if (onTimeCountEl) onTimeCountEl.textContent = onTimeCount;

  const lateCountEl = document.getElementById("lateCount");
  if (lateCountEl) lateCountEl.textContent = lateCount;
}

// Filter attendance data - diperbarui untuk dropdown
function filterAttendanceData(filterType, value) {
  if (value === "all") {
    // Reset filter
    filteredData = [...currentAttendanceData];
  } else {
    filteredData = currentAttendanceData.filter(record => {
      if (filterType === "shift") {
        return record.shift === value;
      } else if (filterType === "status") {
        return (value === "ontime" && record.status === "Tepat Waktu") || 
               (value === "late" && record.status === "Terlambat");
      } else if (filterType === "type") {
        return record.type === value;
      }
      return true;
    });
  }
  
  // Update UI
  updateSummaryCards();
  displayAllData();
  
  // Update dropdown button text
  if (filterType === "type") {
    let buttonText = "Semua Karyawan";
    if (value === "staff") buttonText = "Staff";
    else if (value === "ob") buttonText = "Office Boy";
    
    document.getElementById("employeeFilterDropdown").innerHTML = `<i class="fas fa-users"></i> ${buttonText}`;
  }
}


// Filter attendance by status - diperbarui untuk dropdown
function filterAttendanceByStatus(status) {
  if (status === 'all') {
    // Reset filter
    filteredData = [...currentAttendanceData];
  } else if (status === 'ontime') {
    // Filter tepat waktu
    filteredData = currentAttendanceData.filter(record => record.status === "Tepat Waktu");
  } else if (status === 'late') {
    // Filter terlambat
    filteredData = currentAttendanceData.filter(record => record.status === "Terlambat");
  }
  
  // Update UI
  updateSummaryCards();
  displayAllData();
  
  // Update dropdown text
  const statusFilterDropdown = document.getElementById('statusFilterDropdown');
  if (statusFilterDropdown) {
    if (status === 'all') {
      statusFilterDropdown.innerHTML = '<i class="fas fa-filter"></i> Semua Status';
    } else if (status === 'ontime') {
      statusFilterDropdown.innerHTML = '<i class="fas fa-filter"></i> Tepat Waktu';
    } else if (status === 'late') {
      statusFilterDropdown.innerHTML = '<i class="fas fa-filter"></i> Terlambat';
    }
  }
}



// Show delete confirmation modal
function showDeleteConfirmation() {
  const startDate = document.getElementById("startDate").value;
  const endDate = document.getElementById("endDate").value;

  if (!startDate || !endDate) {
    showAlert("warning", "Pilih rentang tanggal terlebih dahulu");
    return;
  }

  // Update modal text
  const deleteStartDateEl = document.getElementById("deleteStartDate");
  const deleteEndDateEl = document.getElementById("deleteEndDate");

  if (deleteStartDateEl) deleteStartDateEl.textContent = formatDateForDisplay(startDate);
  if (deleteEndDateEl) deleteEndDateEl.textContent = formatDateForDisplay(endDate);

  // Show modal
  const deleteConfirmModal = document.getElementById("deleteConfirmModal");
  if (deleteConfirmModal) {
    const modal = new bootstrap.Modal(deleteConfirmModal);
    modal.show();
  } else {
    console.error("Delete confirmation modal not found");
  }
}

// Export to Excel
function exportToExcel() {
  try {
    if (filteredData.length === 0) {
      showAlert("warning", '<i class="fas fa-exclamation-triangle me-2"></i> Tidak ada data untuk diekspor');
      return;
    }

    const startDate = document.getElementById("startDate").value;
    const endDate = document.getElementById("endDate").value;

    // Create workbook
    const wb = XLSX.utils.book_new();

    // Prepare title and information
    const title = "Laporan Kehadiran Karyawan";
    const dateRange = `Periode: ${formatDateForDisplay(startDate)} - ${formatDateForDisplay(endDate)}`;
    const printDate = `Dicetak pada: ${new Date().toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })}`;

    // Create worksheet with headers and data
    const wsData = [
      [title], // Title row
      [dateRange], // Date range row
      [printDate], // Print date row
      [], // Empty row for spacing
      [
        "No",
        "ID Karyawan",
        "Nama",
        "Tanggal",
        "Tipe Karyawan",
        "Shift",
        "Jam Masuk",
        "Jam Keluar",
        "Durasi Kerja",
        "Status",
      ], // Header row
    ];

    // Add data rows
    filteredData.forEach((record, index) => {
      const timeIn = record.timeIn ? formatTime(record.timeIn) : "-";
      const timeOut = record.timeOut ? formatTime(record.timeOut) : "-";
      const workDuration = calculateWorkDuration(record.timeIn, record.timeOut);

      wsData.push([
        index + 1,
        record.employeeId || "-",
        record.name || "-",
        formatDateForDisplay(record.date),
        formatEmployeeType(record.type),
        formatShift(record.shift),
        timeIn,
        timeOut,
        workDuration,
        record.status + (record.lateMinutes ? ` (${record.lateMinutes} menit)` : ""),
      ]);
    });

    // Create worksheet
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Set column widths
    const colWidths = [
      { wch: 5 }, // No
      { wch: 10 }, // ID Karyawan
      { wch: 20 }, // Nama
      { wch: 15 }, // Tanggal
      { wch: 15 }, // Tipe Karyawan
      { wch: 10 }, // Shift
      { wch: 10 }, // Jam Masuk
      { wch: 10 }, // Jam Keluar
      { wch: 15 }, // Durasi Kerja
      { wch: 20 }, // Status
    ];
    ws["!cols"] = colWidths;

    // Merge cells for title and info rows
    ws["!merges"] = [
      // Merge cells for title (A1:J1)
      { s: { r: 0, c: 0 }, e: { r: 0, c: 9 } },
      // Merge cells for date range (A2:J2)
      { s: { r: 1, c: 0 }, e: { r: 1, c: 9 } },
      // Merge cells for print date (A3:J3)
      { s: { r: 2, c: 0 }, e: { r: 2, c: 9 } },
    ];

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(wb, ws, "Laporan Kehadiran");

    // Generate filename
    const fileName = `Laporan_Kehadiran_${formatDateForFilename(startDate)}_${formatDateForFilename(endDate)}.xlsx`;

    // Export file
    XLSX.writeFile(wb, fileName);

    showAlert("success", `<i class="fas fa-check-circle me-2"></i> Berhasil mengekspor data ke Excel`);
  } catch (error) {
    console.error("Error exporting to Excel:", error);
    showAlert("danger", `<i class="fas fa-exclamation-circle me-2"></i> Gagal mengekspor data: ${error.message}`);
  }
}

// Export to PDF
function exportToPDF() {
  try {
    if (filteredData.length === 0) {
      showAlert("warning", '<i class="fas fa-exclamation-triangle me-2"></i> Tidak ada data untuk diekspor');
      return;
    }

    const startDate = document.getElementById("startDate").value;
    const endDate = document.getElementById("endDate").value;

    // Create PDF document
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF("l", "mm", "a4"); // landscape orientation

    // Add title
    doc.setFontSize(16);
    doc.text(`Laporan Kehadiran Karyawan`, 14, 15);

    // Add subtitle with date range
    doc.setFontSize(12);
    doc.text(`Periode: ${formatDateForDisplay(startDate)} - ${formatDateForDisplay(endDate)}`, 14, 22);

    // Add subtitle with date
    doc.setFontSize(10);
    doc.text(
      `Dicetak pada: ${new Date().toLocaleDateString("id-ID", {
        day: "numeric",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })}`,
      14,
      28
    );

    // Prepare table data
    const tableData = filteredData.map((record, index) => {
      const timeIn = record.timeIn ? formatTime(record.timeIn) : "-";
      const timeOut = record.timeOut ? formatTime(record.timeOut) : "-";
      const workDuration = calculateWorkDuration(record.timeIn, record.timeOut);

      return [
        index + 1,
        record.employeeId || "-",
        record.name || "-",
        formatDateForDisplay(record.date),
        formatEmployeeType(record.type),
        formatShift(record.shift),
        timeIn,
        timeOut,
        record.status + (record.lateMinutes ? ` (${record.lateMinutes} menit)` : ""),
      ];
    });

    // Add table
    doc.autoTable({
      startY: 35,
      head: [["No", "ID", "Nama", "Tanggal", "Tipe", "Shift", "Masuk", "Keluar", "Status"]],
      body: tableData,
      theme: "grid",
      headStyles: { fillColor: [41, 128, 185], textColor: 255 },
      styles: { fontSize: 8, cellPadding: 2 },
      columnStyles: {
        0: { cellWidth: 8 },
        2: { cellWidth: 30 },
      },
    });

    // Generate filename
    const fileName = `Laporan_Kehadiran_${formatDateForFilename(startDate)}_${formatDateForFilename(endDate)}.pdf`;

    // Save PDF
    doc.save(fileName);

    showAlert("success", `<i class="fas fa-check-circle me-2"></i> Berhasil mengekspor data ke PDF`);
  } catch (error) {
    console.error("Error exporting to PDF:", error);
    showAlert("danger", `<i class="fas fa-exclamation-circle me-2"></i> Gagal mengekspor data: ${error.message}`);
  }
}

// Helper function to format time
function formatTime(timestamp) {
  if (!timestamp) return "-";

  const date = timestamp instanceof Date ? timestamp : new Date(timestamp);

  return date.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Helper function to format date for display
function formatDateForDisplay(dateInput) {
  if (!dateInput) return "-";

  let date;

  // Jika input sudah berupa objek Date
  if (dateInput instanceof Date) {
    date = dateInput;
  }
  // Jika input berupa string dalam format YYYY-MM-DD
  else if (typeof dateInput === "string" && dateInput.match(/^\d{4}-\d{2}-\d{2}$/)) {
    // Pastikan tanggal diinterpretasikan sebagai tanggal lokal, bukan UTC
    const [year, month, day] = dateInput.split("-");
    date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  }
  // Jika format lain
  else {
    date = new Date(dateInput);
  }

  // Gunakan toLocaleDateString untuk memastikan format tanggal lokal yang benar
  return date.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

// Helper function to format date for filename
function formatDateForFilename(dateString) {
  if (!dateString) return "";

  const date = new Date(dateString);

  return date
    .toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    })
    .replace(/\//g, "-");
}

// Helper function to calculate work duration
function calculateWorkDuration(timeIn, timeOut) {
  if (!timeIn || !timeOut) return "-";

  const inTime = timeIn instanceof Date ? timeIn : new Date(timeIn);
  const outTime = timeOut instanceof Date ? timeOut : new Date(timeOut);

  // Calculate duration in minutes
  const durationMinutes = Math.floor((outTime - inTime) / (1000 * 60));

  // Convert to hours and minutes
  const hours = Math.floor(durationMinutes / 60);
  const minutes = durationMinutes % 60;

  return `${hours} jam ${minutes} menit`;
}

// Helper function to format employee type
function formatEmployeeType(type) {
  return type === "staff" ? "Staff" : "Office Boy";
}

// Helper function to format shift
function formatShift(shift) {
  return shift === "morning" ? "Pagi" : "Sore";
}

// Show alert message
function showAlert(type, message, autoHide = true) {
  const alertContainer = document.getElementById("alertContainer");
  if (!alertContainer) return;

  alertContainer.innerHTML = `
    <div class="alert alert-${type} alert-dismissible fade show">
      ${message}
      <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    </div>
  `;

  alertContainer.style.display = "block";

  if (autoHide) {
    setTimeout(() => {
      const alert = alertContainer.querySelector(".alert");
      if (alert) {
        const bsAlert = new bootstrap.Alert(alert);
        bsAlert.close();
      }
    }, 5000);
  }
}

// Hide alert
function hideAlert() {
  const alertContainer = document.getElementById("alertContainer");
  if (alertContainer) {
    alertContainer.innerHTML = "";
    alertContainer.style.display = "none";
  }
}

// Export functions
export { generateReport, exportToExcel, exportToPDF, clearAttendanceDataCache };
