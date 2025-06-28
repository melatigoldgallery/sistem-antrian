import {
  getLeaveRequestsByMonth,
  clearLeaveCache,
  listenToLeaveRequests,
  stopListeningToLeaveRequests,
} from "../services/leave-service.js";
import { deleteLeaveRequestsByMonth } from "../services/report-service.js";
import { attendanceCache } from "../services/attendance-service.js"; // Impor dari attendance-service

// Global variables
let allCachedData = []; // Untuk menyimpan semua data dari cache
let currentLeaveData = [];
let lastVisibleDoc = null;
let hasMoreData = false;
const itemsPerPage = 20; // Reduced from 50 to 20 for better pagination
const monthNames = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

// Cache settings
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour in milliseconds
const reportCache = new Map(); // Cache untuk laporan
const cacheTimestamps = new Map(); // Untuk menyimpan waktu cache

// Fungsi untuk mengompresi data sebelum disimpan ke localStorage
function compressData(data) {
  try {
    // Konversi data ke string JSON dengan format minimal (tanpa pretty printing)
    // Ini sudah cukup untuk menghemat ruang tanpa menghapus spasi dalam nilai data
    return JSON.stringify(data);
  } catch (error) {
    console.error("Error compressing data:", error);
    return JSON.stringify(data);
  }
}

// Fungsi untuk mendekompresi data dari localStorage
function decompressData(compressedData) {
  try {
    // Parse string JSON
    return JSON.parse(compressedData);
  } catch (error) {
    console.error("Error decompressing data:", error);
    return null;
  }
}

// Fungsi untuk memuat cache laporan dari localStorage
function loadReportCacheFromStorage() {
  try {
    const compressedCache = localStorage.getItem("leaveReportCache");
    const compressedTimestamps = localStorage.getItem("leaveReportTimestamps");

    if (compressedCache && compressedTimestamps) {
      // Dekompresi data
      const cacheObj = decompressData(compressedCache);
      const timestampsObj = decompressData(compressedTimestamps);

      if (cacheObj && timestampsObj) {
        // Konversi objek kembali ke Map
        reportCache.clear();
        cacheTimestamps.clear();

        for (const [key, value] of Object.entries(cacheObj)) {
          reportCache.set(key, value);
        }

        for (const [key, value] of Object.entries(timestampsObj)) {
          cacheTimestamps.set(key, value);
        }
      }
    }
  } catch (error) {
    console.error("Error loading report cache from localStorage:", error);
  }
}

// Fungsi untuk membersihkan cache laporan yang sudah lama
function cleanupOldReportCache() {
  const now = Date.now();
  const oneMonth = 30 * 24 * 60 * 60 * 1000; // 30 hari dalam milidetik

  // Hapus cache yang lebih dari 1 bulan
  const keysToDelete = [];

  for (const [key, timestamp] of cacheTimestamps.entries()) {
    if (now - timestamp > oneMonth) {
      keysToDelete.push(key);
    }
  }

  keysToDelete.forEach((key) => {
    reportCache.delete(key);
    cacheTimestamps.delete(key);
    console.log(`Removed old report cache for ${key}`);
  });

  // Simpan perubahan ke localStorage
  saveReportCacheToStorage();
}

// Fungsi untuk memaksa refresh data
function forceRefreshData() {
  // Tampilkan konfirmasi
  if (confirm("Apakah Anda yakin ingin menyegarkan data dari server?")) {
    // Panggil generateReport dengan forceRefresh=true
    generateReport(true);

    // Tampilkan pesan
    showAlert("info", "Data sedang disegarkan dari server...");
  }
}
// Initialize page
document.addEventListener("DOMContentLoaded", () => {
  try {
    // Load cache dari localStorage
    loadReportCacheFromStorage();
    // Pulihkan status halaman
    restorePageState();
    // Bersihkan cache lama
    cleanupOldReportCache();
    // Tambahkan event listener untuk tombol refresh jika ada
    const refreshButton = document.getElementById("refreshData");
    if (refreshButton) {
      refreshButton.addEventListener("click", forceRefreshData);
    }

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

    // Initialize report page
    setupYearSelector();
    setDefaultMonthAndYear();
    setupEventListeners();

    // Listen for new leave request submissions
    document.addEventListener("leaveRequestSubmitted", function (e) {
      try {
        // Get current selected month and year
        const monthSelector = document.getElementById("monthSelector");
        const yearSelector = document.getElementById("yearSelector");

        if (!monthSelector || !yearSelector) return;

        const selectedMonth = parseInt(monthSelector.value);
        const selectedYear = parseInt(yearSelector.value);

        // Check if the new leave request is for the currently displayed month/year
        const { leaveRequest, month, year } = e.detail;

        if (month === selectedMonth && year === selectedYear) {
          console.log("New leave request submitted for current month/year view:", leaveRequest);

          // Update cache
          const cacheKey = `${month}_${year}`;
          if (reportCache.has(cacheKey)) {
            const cachedData = reportCache.get(cacheKey);
            // Add new request to the beginning of the data array
            cachedData.data = [leaveRequest, ...cachedData.data];
            reportCache.set(cacheKey, cachedData);

            // Update timestamp
            cacheTimestamps.set(cacheKey, Date.now());

            // Save to localStorage
            saveReportCacheToStorage();
          }

          // If we're currently viewing this month/year, update the display
          if (currentLeaveData.length > 0) {
            // Add to current data
            currentLeaveData = [leaveRequest, ...currentLeaveData];

            // Update UI
            updateSummaryCards();
            populateLeaveTable();

            // Show notification
            showAlert("info", "Pengajuan izin baru telah ditambahkan ke laporan", true);
          }
        }
      } catch (error) {
        console.error("Error handling new leave request:", error);
      }
    });
  } catch (error) {
    console.error("Error initializing page:", error);
    showAlert("danger", "Terjadi kesalahan saat menginisialisasi halaman: " + error.message);
  }
});

// Tambahkan event listener untuk storage events
window.addEventListener("storage", function (event) {
  // Cek apakah event berasal dari cache laporan izin
  if (event.key === "leaveReportCache" || event.key === "leaveReportTimestamps") {
    console.log("Cache updated in another tab, reloading...");

    // Reload cache dari localStorage
    loadReportCacheFromStorage();

    // Jika halaman sedang menampilkan laporan, refresh tampilan
    const month = parseInt(document.getElementById("monthSelector").value);
    const year = parseInt(document.getElementById("yearSelector").value);
    const cacheKey = `${month}_${year}`;

    if (reportCache.has(cacheKey)) {
      // Update data yang sedang ditampilkan
      const cachedData = reportCache.get(cacheKey);
      currentLeaveData = [...cachedData.data].slice(0, itemsPerPage);
      allCachedData = [...cachedData.data];
      lastVisibleDoc = cachedData.lastDoc;
      hasMoreData = cachedData.hasMore;

      // Update UI
      populateLeaveTable();
      updateSummaryCards();

      // Show notification
      showAlert("info", "Data telah diperbarui dari tab lain", true, 3000);
    }
  }
});

// Tambahkan event listener untuk beforeunload
window.addEventListener("beforeunload", function () {
  // Hentikan listener untuk menghemat resources
  try {
    // Simpan status halaman saat ini ke localStorage
    const currentState = {
      month: document.getElementById("monthSelector").value,
      year: document.getElementById("yearSelector").value,
      filters: getCurrentFilters(),
      lastUpdate: Date.now(),
    };

    localStorage.setItem("leaveReportLastState", JSON.stringify(currentState));

    // Hentikan listener
    stopListeningToLeaveRequests();

    // Simpan cache ke localStorage untuk memastikan data terbaru tersimpan
    saveReportCacheToStorage();
  } catch (error) {
    console.error("Error during page unload:", error);
  }
});

// Tambahkan fungsi untuk mendapatkan filter yang aktif
function getCurrentFilters() {
  try {
    return {
      status: document.querySelector("[data-status-filter].active")?.getAttribute("data-status-filter") || "all",
      type: document.querySelector("[data-type-filter].active")?.getAttribute("data-type-filter") || "all",
      employee: document.querySelector("[data-employee-filter].active")?.getAttribute("data-employee-filter") || "all",
    };
  } catch (error) {
    console.error("Error getting current filters:", error);
    return { status: "all", type: "all", employee: "all" };
  }
}

// Tambahkan fungsi untuk memulihkan status halaman saat load
function restorePageState() {
  try {
    const stateStr = localStorage.getItem("leaveReportLastState");
    if (!stateStr) return;

    const state = JSON.parse(stateStr);

    // Cek apakah state masih valid (kurang dari 30 menit)
    const now = Date.now();
    const stateAge = now - state.lastUpdate;
    const isStateValid = stateAge < 30 * 60 * 1000; // 30 menit

    if (!isStateValid) {
      localStorage.removeItem("leaveReportLastState");
      return;
    }

    // Pulihkan bulan dan tahun
    if (state.month && state.year) {
      const monthSelector = document.getElementById("monthSelector");
      const yearSelector = document.getElementById("yearSelector");

      if (monthSelector && yearSelector) {
        monthSelector.value = state.month;
        yearSelector.value = state.year;
      }
    }

    // Pulihkan filter setelah data dimuat
    if (state.filters) {
      setTimeout(() => {
        // Terapkan filter status
        if (state.filters.status && state.filters.status !== "all") {
          const statusFilter = document.querySelector(`[data-status-filter="${state.filters.status}"]`);
          if (statusFilter) statusFilter.click();
        }

        // Terapkan filter tipe
        if (state.filters.type && state.filters.type !== "all") {
          const typeFilter = document.querySelector(`[data-type-filter="${state.filters.type}"]`);
          if (typeFilter) typeFilter.click();
        }

        // Terapkan filter karyawan
        if (state.filters.employee && state.filters.employee !== "all") {
          const employeeFilter = document.querySelector(`[data-employee-filter="${state.filters.employee}"]`);
          if (employeeFilter) employeeFilter.click();
        }
      }, 500); // Delay untuk memastikan data sudah dimuat
    }
  } catch (error) {
    console.error("Error restoring page state:", error);
  }
}

// Tambahkan fungsi untuk mendeteksi perubahan cache dan broadcast ke tab lain
function broadcastCacheUpdate(cacheKey) {
  try {
    // Gunakan BroadcastChannel API jika tersedia (lebih efisien)
    if ("BroadcastChannel" in window) {
      const bc = new BroadcastChannel("leaveReportCacheChannel");
      bc.postMessage({
        type: "cacheUpdate",
        key: cacheKey,
        timestamp: Date.now(),
      });
    } else {
      // Fallback ke localStorage untuk browser yang tidak mendukung BroadcastChannel
      const updateMessage = {
        type: "cacheUpdate",
        key: cacheKey,
        timestamp: Date.now(),
      };

      // Gunakan localStorage sebagai mekanisme broadcast
      localStorage.setItem("leaveReportCacheUpdateMessage", JSON.stringify(updateMessage));
      // Hapus setelah beberapa saat untuk menghindari polusi localStorage
      setTimeout(() => {
        localStorage.removeItem("leaveReportCacheUpdateMessage");
      }, 1000);
    }
  } catch (error) {
    console.error("Error broadcasting cache update:", error);
  }
}

// Modifikasi saveReportCacheToStorage untuk memanggil broadcastCacheUpdate
function saveReportCacheToStorage() {
  try {
    // Konversi Map ke objek untuk localStorage
    const cacheObj = {};
    for (const [key, value] of reportCache.entries()) {
      cacheObj[key] = value;
    }

    const timestampsObj = {};
    for (const [key, value] of cacheTimestamps.entries()) {
      timestampsObj[key] = value;
    }

    localStorage.setItem("leaveReportCache", compressData(cacheObj));
    localStorage.setItem("leaveReportTimestamps", compressData(timestampsObj));

    // Broadcast update ke tab lain
    broadcastCacheUpdate("all");

    console.log("Report cache saved to localStorage");
  } catch (error) {
    console.error("Error saving report cache to localStorage:", error);
  }
}

// Tambahkan listener untuk BroadcastChannel jika tersedia
if ("BroadcastChannel" in window) {
  const bc = new BroadcastChannel("leaveReportCacheChannel");

  bc.onmessage = function (event) {
    if (event.data && event.data.type === "cacheUpdate") {
      console.log("Cache update received from another tab via BroadcastChannel");

      // Reload cache dari localStorage
      loadReportCacheFromStorage();

      // Refresh tampilan jika perlu
      refreshCurrentView();
    }
  };
}

// Fungsi untuk refresh tampilan saat ini
function refreshCurrentView() {
  try {
    const month = parseInt(document.getElementById("monthSelector").value);
    const year = parseInt(document.getElementById("yearSelector").value);
    const cacheKey = `${month}_${year}`;

    if (reportCache.has(cacheKey)) {
      // Update data yang sedang ditampilkan
      const cachedData = reportCache.get(cacheKey);
      currentLeaveData = [...cachedData.data].slice(0, itemsPerPage);
      allCachedData = [...cachedData.data];
      lastVisibleDoc = cachedData.lastDoc;
      hasMoreData = cachedData.hasMore;

      // Update UI
      populateLeaveTable();
      updateSummaryCards();

      // Show notification
      showAlert("info", "Data telah diperbarui", true, 3000);
    }
  } catch (error) {
    console.error("Error refreshing current view:", error);
  }
}

// Fungsi untuk mengaktifkan listener real-time
function setupRealtimeListener() {
  try {
    const monthSelector = document.getElementById("monthSelector");
    const yearSelector = document.getElementById("yearSelector");

    if (!monthSelector || !yearSelector) {
      console.error("Month or year selector not found");
      return;
    }

    const currentMonth = parseInt(monthSelector.value);
    const currentYear = parseInt(yearSelector.value);

    // Gunakan listener yang sudah ada di leave-service.js
    listenToLeaveRequests(currentMonth, currentYear, (leaveRequests) => {
      // Update cache
      const cacheKey = `${currentMonth}_${currentYear}`;

      // Update report cache
      reportCache.set(cacheKey, {
        data: leaveRequests,
        lastDoc: null, // Tidak perlu lastDoc karena kita mendapatkan semua data
        hasMore: leaveRequests.length > itemsPerPage,
      });

      // Update timestamp
      cacheTimestamps.set(cacheKey, Date.now());

      // Save to localStorage
      saveReportCacheToStorage();

      // Update current data if we're viewing this month/year
      if (currentLeaveData.length > 0) {
        const selectedMonth = parseInt(monthSelector.value);
        const selectedYear = parseInt(yearSelector.value);

        if (currentMonth === selectedMonth && currentYear === selectedYear) {
          // PERBAIKAN: Batasi data yang ditampilkan ke itemsPerPage
          currentLeaveData = leaveRequests.slice(0, itemsPerPage);
          // Simpan semua data di variabel terpisah
          allCachedData = leaveRequests;

          // Update UI
          updateSummaryCards();
          populateLeaveTable();

          // Tampilkan tombol Load More jika ada data lebih
          const loadMoreContainer = document.getElementById("loadMoreContainer");
          if (loadMoreContainer) {
            loadMoreContainer.style.display = leaveRequests.length > itemsPerPage ? "block" : "none";
          }

          // Show cache indicator
          const cacheIndicator = document.getElementById("cacheIndicator");
          if (cacheIndicator) {
            cacheIndicator.textContent = "Data real-time";
            cacheIndicator.style.display = "inline-block";
          }
        }
      }
    });
  } catch (error) {
    console.error("Error setting up real-time listener:", error);
  }
}

// Setup year selector with current year and 5 years back
function setupYearSelector() {
  const yearSelector = document.getElementById("yearSelector");
  if (!yearSelector) return;

  // Clear existing options first
  yearSelector.innerHTML = "";

  const currentYear = new Date().getFullYear();
  for (let i = 0; i < 6; i++) {
    const year = currentYear - i;
    const option = document.createElement("option");
    option.value = year;
    option.textContent = year;
    yearSelector.appendChild(option);
  }
}

// Set default month and year to current month
function setDefaultMonthAndYear() {
  const currentDate = new Date();
  const monthSelector = document.getElementById("monthSelector");
  const yearSelector = document.getElementById("yearSelector");

  if (monthSelector) {
    monthSelector.value = currentDate.getMonth() + 1;
  }

  if (yearSelector) {
    yearSelector.value = currentDate.getFullYear();
  }
}

async function generateReport(forceRefresh = false) {
  try {
   const monthSelector = document.getElementById("monthSelector");
    const yearSelector = document.getElementById("yearSelector");
    const replacementTypeFilter = document.getElementById("replacementTypeFilter");
    const replacementStatusFilter = document.getElementById("replacementStatusFilter");

    if (!monthSelector || !yearSelector) {
      console.error("Month or year selector not found");
      return;
    }

    const month = parseInt(monthSelector.value);
    const year = parseInt(yearSelector.value);
    const selectedReplacementType = replacementTypeFilter ? replacementTypeFilter.value : "all";
    const selectedReplacementStatus = replacementStatusFilter ? replacementStatusFilter.value : "all";

    // Buat kunci cache
    const cacheKey = `${month}_${year}`;

    // Cek apakah data ada di cache dan masih valid (kurang dari 1 jam)
    const now = Date.now();
    const cacheTime = cacheTimestamps.get(cacheKey) || 0;
    const cacheIsValid = now - cacheTime < CACHE_DURATION;

    // Gunakan cache jika tersedia dan valid, kecuali jika forceRefresh=true
    if (!forceRefresh && reportCache.has(cacheKey) && cacheIsValid) {
      console.log(`Using cached data for ${month}/${year}, age: ${(now - cacheTime) / 1000} seconds`);

      // Tampilkan indikator cache di UI
      const cacheIndicator = document.getElementById("cacheIndicator");
      if (cacheIndicator) {
        cacheIndicator.textContent = "Menggunakan data cache";
        cacheIndicator.style.display = "inline-block";
      }

      // Ambil data dari cache
      const cachedData = reportCache.get(cacheKey);
      // PENTING: Simpan semua data di allCachedData terlebih dahulu
      allCachedData = cachedData.data;
      // PERBAIKAN: Batasi data yang ditampilkan ke itemsPerPage
      currentLeaveData = allCachedData.slice(0, itemsPerPage);
      lastVisibleDoc = cachedData.lastDoc;
      // Tandai hasMoreData jika total data lebih dari itemsPerPage
      hasMoreData = allCachedData.length > itemsPerPage;
      // PERBAIKAN: Terapkan kedua filter jika dipilih
      if (selectedReplacementType !== "all" || selectedReplacementStatus !== "all") {
        applyFilters(selectedReplacementType, selectedReplacementStatus);
      } else {
        // Update UI
        updateSummaryCards();
        populateLeaveTable();
      }

      showReportElements();

      // Show/hide load more button
      const loadMoreBtn = document.getElementById("loadMoreBtn");
      const loadMoreContainer = document.getElementById("loadMoreContainer");
      if (loadMoreBtn && loadMoreContainer) {
        loadMoreContainer.style.display = hasMoreData ? "block" : "none";
      }

      // Setup real-time listener untuk pembaruan
      setupRealtimeListener();

      return;
    }

    // Reset pagination variables
    lastVisibleDoc = null;
    hasMoreData = false;
    currentLeaveData = [];

    // Show loading state
    showAlert("info", '<i class="fas fa-spinner fa-spin me-2"></i> Memuat data izin...', false);

    // Sebagai fallback, jika listener gagal, gunakan metode query biasa
    const result = await getLeaveRequestsByMonth(month, year, null, itemsPerPage);

    // Update pagination variables
    currentLeaveData = result.leaveRequests || [];
    lastVisibleDoc = result.lastDoc;
    hasMoreData = result.hasMore;

    // Hide alert
    hideAlert();

    // Simpan ke cache original data sebelum filter
    reportCache.set(cacheKey, {
      data: [...currentLeaveData],
      lastDoc: lastVisibleDoc,
      hasMore: hasMoreData,
    });

    // Simpan timestamp cache
    cacheTimestamps.set(cacheKey, now);

    // Simpan cache ke localStorage
    saveReportCacheToStorage();

    // Simpan semua data di allCachedData
    allCachedData = [...currentLeaveData];

    // Sembunyikan indikator cache di UI
    const cacheIndicator = document.getElementById("cacheIndicator");
    if (cacheIndicator) {
      cacheIndicator.style.display = "none";
    }

    // Terapkan filter jenis pengganti jika dipilih
    if (selectedReplacementType !== "all") {
      filterByReplacementType(selectedReplacementType);
    }
    // Bersihkan cache filter saat data berubah
    clearFilterCache();
    // Update UI based on data
    if (currentLeaveData.length > 0) {
      updateSummaryCards();
      populateLeaveTable();
      showReportElements();

      // Show/hide load more button
      const loadMoreBtn = document.getElementById("loadMoreBtn");
      const loadMoreContainer = document.getElementById("loadMoreContainer");
      if (loadMoreBtn && loadMoreContainer) {
        loadMoreContainer.style.display = hasMoreData ? "block" : "none";
      }
    } else {
      hideReportElements();
      document.getElementById("noDataMessage").style.display = "block";
    }

    // Update delete confirmation modal with month and year
    document.getElementById("deleteMonthName").textContent = monthNames[month - 1];
    document.getElementById("deleteYear").textContent = year;
    // Setup real-time listener untuk pembaruan
    setupRealtimeListener();
  } catch (error) {
    console.error("Error generating report:", error);

    // Coba gunakan cache sebagai fallback jika terjadi error
    const month = parseInt(document.getElementById("monthSelector").value);
    const year = parseInt(document.getElementById("yearSelector").value);
    const cacheKey = `${month}_${year}`;

    if (reportCache.has(cacheKey)) {
      console.log(`Fallback to cached data for ${month}/${year} due to error`);

      // Tampilkan pesan error tapi tetap tampilkan data
      showAlert("warning", "Terjadi kesalahan saat mengambil data terbaru. Menampilkan data dari cache.");

      // Tampilkan indikator cache di UI
      const cacheIndicator = document.getElementById("cacheIndicator");
      if (cacheIndicator) {
        cacheIndicator.textContent = "Menggunakan data cache (fallback)";
        cacheIndicator.style.display = "inline-block";
      }

      // Ambil data dari cache
      const cachedData = reportCache.get(cacheKey);
      currentLeaveData = cachedData.data;
      lastVisibleDoc = cachedData.lastDoc;
      hasMoreData = cachedData.hasMore;

      // Terapkan filter jenis pengganti jika dipilih
      const replacementTypeFilter = document.getElementById("replacementTypeFilter");
      const selectedReplacementType = replacementTypeFilter ? replacementTypeFilter.value : "all";

    if (selectedReplacementType !== "all" || selectedReplacementStatus !== "all") {
      applyFilters(selectedReplacementType, selectedReplacementStatus);
      } else {
        // Update UI
        updateSummaryCards();
        populateLeaveTable();
      }

      showReportElements();
    } else {
      // Tidak ada cache, tampilkan pesan error
      showAlert(
        "danger",
        '<i class="fas fa-exclamation-circle me-2"></i> Terjadi kesalahan saat memuat data: ' + error.message
      );
      hideReportElements();
      document.getElementById("noDataMessage").style.display = "block";
    }
  }
}

// Add a new function to apply both filters at once
function applyFilters(typeFilter, statusFilter) {
  try {
    // If no data, do nothing
    if (!currentLeaveData || currentLeaveData.length === 0) return;

    // Get original data from cache if needed
    const month = parseInt(document.getElementById("monthSelector").value);
    const year = parseInt(document.getElementById("yearSelector").value);
    const cacheKey = `${month}_${year}`;

    let originalData = [];
    if (reportCache.has(cacheKey)) {
      originalData = [...reportCache.get(cacheKey).data];
      // Update allCachedData with complete data from cache
      allCachedData = [...originalData];
    } else {
      originalData = [...allCachedData]; // Gunakan allCachedData sebagai sumber data asli
    }

    console.log(`Applying filters - Type: ${typeFilter}, Status: ${statusFilter}, Total data: ${originalData.length}`);

    // Apply both filters
    let filteredData = originalData;

    // Apply type filter if not "all"
    if (typeFilter !== "all") {
      filteredData = filteredData.filter(leave => leave.replacementType === typeFilter);
      console.log(`After type filter: ${filteredData.length} items`);
    }

    // Apply status filter if not "all"
    if (statusFilter !== "all") {
      filteredData = filteredData.filter(leave => {
        // Check for special cases first (medical certificate or leave)
        const hasMedicalCert = 
          leave.leaveType === "sakit" && 
          leave.replacementDetails && 
          leave.replacementDetails.hasMedicalCertificate;
        
        const isLeave = leave.leaveType === "cuti";
        
        // These types don't need replacement
        if (hasMedicalCert || isLeave) {
          // If filtering for "sudah" or "belum", these should be excluded
          return statusFilter === "all";
        }
        
        // Check if it's a multi-day leave
        const isMultiDay = 
          leave.leaveStartDate && 
          leave.leaveEndDate && 
          leave.leaveStartDate !== leave.leaveEndDate;
        
        if (isMultiDay && leave.replacementStatusArray && leave.replacementStatusArray.length > 0) {
          // For multi-day, check if any day matches the filter
          if (statusFilter === "sudah") {
            // Check for any status containing "sudah" (case insensitive)
            return leave.replacementStatusArray.some(status => {
              if (!status) return false;
              return status.toLowerCase().includes("sudah");
            });
          } else if (statusFilter === "belum") {
            // Check for any status containing "belum" or empty
            return leave.replacementStatusArray.some(status => {
              if (!status) return true;
              return status.toLowerCase().includes("belum");
            });
          }
        } else {
          // For single-day, check replacementStatus
          let status = leave.replacementStatus || "";
          
          // Convert to string and lowercase for consistent comparison
          status = String(status).toLowerCase();
          
          if (statusFilter === "sudah") {
            return status.includes("sudah");
          } else if (statusFilter === "belum") {
            return !status || status.includes("belum");
          }
        }
        
        // Default for "all" filter
        return true;
      });
      console.log(`After status filter: ${filteredData.length} items`);
    }

    // Update data for display
    currentLeaveData = filteredData.slice(0, itemsPerPage);
    allCachedData = filteredData;
    hasMoreData = filteredData.length > itemsPerPage;

    // Update UI
    updateSummaryCards();
    populateLeaveTable();

    // Update Load More button
    const loadMoreContainer = document.getElementById("loadMoreContainer");
    if (loadMoreContainer) {
      loadMoreContainer.style.display = hasMoreData ? "block" : "none";
    }
  } catch (error) {
    console.error("Error applying filters:", error);
    showAlert("danger", "Terjadi kesalahan saat menerapkan filter: " + error.message);
  }
}

function setupEventListeners() {
  // Generate report button
  document.getElementById("generateReportBtn")?.addEventListener("click", generateReport);

  // Export buttons
  document.getElementById("exportExcelBtn")?.addEventListener("click", exportToExcel);
  document.getElementById("exportPdfBtn")?.addEventListener("click", exportToPDF);

  // Delete data button
  document.getElementById("deleteDataBtn")?.addEventListener("click", showDeleteConfirmation);

  // Confirm delete button in modal
  document.getElementById("confirmDeleteBtn")?.addEventListener("click", deleteMonthData);

  // Filter by status
  document.querySelectorAll("[data-status-filter]").forEach((item) => {
    item.addEventListener("click", function (e) {
      e.preventDefault();
      const filter = this.dataset.statusFilter;
      filterLeaveData("status", filter);
    });
  });

  // PERBAIKAN: Filter by replacement status
  document.querySelectorAll("[data-replacement-filter]").forEach((item) => {
    item.addEventListener("click", function (e) {
      e.preventDefault();

      // Hapus kelas active dari semua item filter
      document.querySelectorAll("[data-replacement-filter]").forEach((el) => {
        el.classList.remove("active");
      });

      // Tambahkan kelas active ke item yang diklik
      this.classList.add("active");

      const filter = this.dataset.replacementFilter;
      console.log("Applying replacement filter:", filter); // Debug log
      filterLeaveData("replacement", filter);
    });
  });

  // Load more button
  const loadMoreBtn = document.getElementById("loadMoreBtn");
  if (loadMoreBtn) {
    loadMoreBtn.addEventListener("click", loadMoreData);
  }

 // Replacement type filter
  const replacementTypeFilter = document.getElementById("replacementTypeFilter");
  if (replacementTypeFilter) {
    replacementTypeFilter.addEventListener("change", function() {
      const replacementStatusFilter = document.getElementById("replacementStatusFilter");
      const statusValue = replacementStatusFilter ? replacementStatusFilter.value : "all";
      
      // If data exists, apply both filters
      if (currentLeaveData && currentLeaveData.length > 0) {
        applyFilters(this.value, statusValue);
      }
    });
  }

  // Replacement status filter
  const replacementStatusFilter = document.getElementById("replacementStatusFilter");
  if (replacementStatusFilter) {
    replacementStatusFilter.addEventListener("change", function() {
      const replacementTypeFilter = document.getElementById("replacementTypeFilter");
      const typeValue = replacementTypeFilter ? replacementTypeFilter.value : "all";
      
      // If data exists, apply both filters
      if (currentLeaveData && currentLeaveData.length > 0) {
        applyFilters(typeValue, this.value);
      }
    });
  }

  // Tambahkan event listener untuk perubahan bulan/tahun
  const monthSelector = document.getElementById("monthSelector");
  const yearSelector = document.getElementById("yearSelector");

  if (monthSelector) {
    monthSelector.addEventListener("change", function () {
      // Hentikan listener lama
      stopListeningToLeaveRequests();
      // Generate report baru
      generateReport();
    });
  }

  if (yearSelector) {
    yearSelector.addEventListener("change", function () {
      // Hentikan listener lama
      stopListeningToLeaveRequests();
      // Generate report baru
      generateReport();
    });
  }
}

// 4. Perbaikan pada fungsi loadMoreData
async function loadMoreData() {
  try {
    const month = parseInt(document.getElementById("monthSelector").value);
    const year = parseInt(document.getElementById("yearSelector").value);
    const cacheKey = `${month}_${year}`;

    // Show loading state on the button
    const loadMoreBtn = document.getElementById("loadMoreBtn");
    if (loadMoreBtn) {
      loadMoreBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i> Memuat...';
      loadMoreBtn.disabled = true;
    }

    // Selalu prioritaskan data dari cache jika tersedia
    if (allCachedData.length > currentLeaveData.length) {
      console.log("Using cached data for pagination");

      // Ambil batch berikutnya dari data cache
      const nextBatch = allCachedData.slice(currentLeaveData.length, currentLeaveData.length + itemsPerPage);

      if (nextBatch.length > 0) {
        // Tambahkan data baru ke currentLeaveData
        currentLeaveData = [...currentLeaveData, ...nextBatch];

        // Update UI
        populateLeaveTable();
        updateSummaryCards();

        // Periksa apakah masih ada data lagi
        hasMoreData = currentLeaveData.length < allCachedData.length;
      } else {
        hasMoreData = false;
      }
    } else if (reportCache.has(cacheKey)) {
      // Cek apakah cache memiliki data lebih banyak yang belum dimuat ke allCachedData
      const cachedData = reportCache.get(cacheKey).data || [];

      if (cachedData.length > allCachedData.length) {
        console.log("Loading more data from cache that wasn't in allCachedData");

        // Update allCachedData dengan semua data dari cache
        allCachedData = [...cachedData];

        // Ambil batch berikutnya
        const nextBatch = allCachedData.slice(currentLeaveData.length, currentLeaveData.length + itemsPerPage);

        if (nextBatch.length > 0) {
          // Tambahkan data baru ke currentLeaveData
          currentLeaveData = [...currentLeaveData, ...nextBatch];

          // Update UI
          populateLeaveTable();
          updateSummaryCards();

          // Periksa apakah masih ada data lagi
          hasMoreData = currentLeaveData.length < allCachedData.length;
        } else {
          hasMoreData = false;
        }
      } else if (lastVisibleDoc) {
        // Jika cache tidak memiliki data lebih banyak, tapi masih ada data di Firestore
        await fetchMoreFromFirestore(month, year);
      } else {
        hasMoreData = false;
      }
    } else if (lastVisibleDoc) {
      // Jika tidak ada cache sama sekali, ambil dari Firestore
      await fetchMoreFromFirestore(month, year);
    } else {
      hasMoreData = false;
    }

    // Reset load more button
    if (loadMoreBtn) {
      loadMoreBtn.innerHTML = '<i class="fas fa-plus me-2"></i> Muat Lebih Banyak';
      loadMoreBtn.disabled = false;
    }

    // Show/hide load more button based on hasMoreData
    const loadMoreContainer = document.getElementById("loadMoreContainer");
    if (loadMoreContainer) {
      loadMoreContainer.style.display = hasMoreData ? "block" : "none";
    }
  } catch (error) {
    console.error("Error loading more data:", error);

    // Coba fallback ke cache jika ada error
    try {
      const month = parseInt(document.getElementById("monthSelector").value);
      const year = parseInt(document.getElementById("yearSelector").value);
      const cacheKey = `${month}_${year}`;

      if (reportCache.has(cacheKey)) {
        const cachedData = reportCache.get(cacheKey).data || [];

        if (cachedData.length > currentLeaveData.length) {
          console.log("Fallback to cache after error");

          // Update allCachedData dengan semua data dari cache
          allCachedData = [...cachedData];

          // Ambil batch berikutnya
          const nextBatch = allCachedData.slice(currentLeaveData.length, currentLeaveData.length + itemsPerPage);

          if (nextBatch.length > 0) {
            // Tambahkan data baru ke currentLeaveData
            currentLeaveData = [...currentLeaveData, ...nextBatch];

            // Update UI
            populateLeaveTable();
            updateSummaryCards();

            // Periksa apakah masih ada data lagi
            hasMoreData = currentLeaveData.length < allCachedData.length;

            showAlert("warning", "Menggunakan data cache karena terjadi error saat mengambil data baru");
          }
        }
      }
    } catch (fallbackError) {
      console.error("Error in fallback:", fallbackError);
    }

    showAlert("danger", "Terjadi kesalahan saat memuat data tambahan: " + error.message);

    // Reset load more button
    const loadMoreBtn = document.getElementById("loadMoreBtn");
    if (loadMoreBtn) {
      loadMoreBtn.innerHTML = '<i class="fas fa-plus me-2"></i> Muat Lebih Banyak';
      loadMoreBtn.disabled = false;
    }
  }
}

// Helper function untuk mengambil data dari Firestore
async function fetchMoreFromFirestore(month, year) {
  console.log("Fetching more data from Firestore");

  // Fetch next page of data
  const result = await getLeaveRequestsByMonth(month, year, lastVisibleDoc, itemsPerPage);

  // Update pagination variables
  const newData = result.leaveRequests || [];
  lastVisibleDoc = result.lastDoc;
  hasMoreData = result.hasMore;

  if (newData.length > 0) {
    // Add new data to current data and allCachedData
    currentLeaveData = [...currentLeaveData, ...newData];
    allCachedData = [...allCachedData, ...newData];

    // Update cache
    const cacheKey = `${month}_${year}`;
    if (reportCache.has(cacheKey)) {
      const cachedData = reportCache.get(cacheKey);

      // Merge new data with existing cache
      const mergedData = [...cachedData.data];

      // Add only new items that aren't already in the cache
      for (const item of newData) {
        if (!mergedData.some((existing) => existing.id === item.id)) {
          mergedData.push(item);
        }
      }

      // Update cache with merged data
      reportCache.set(cacheKey, {
        data: mergedData,
        lastDoc: result.lastDoc,
        hasMore: result.hasMore,
      });

      // Update timestamp
      cacheTimestamps.set(cacheKey, Date.now());

      // Save to localStorage
      saveReportCacheToStorage();
    } else {
      // Create new cache entry
      reportCache.set(cacheKey, {
        data: [...allCachedData],
        lastDoc: result.lastDoc,
        hasMore: result.hasMore,
      });

      // Update timestamp
      cacheTimestamps.set(cacheKey, Date.now());

      // Save to localStorage
      saveReportCacheToStorage();
    }

    // Update UI
    populateLeaveTable();
    updateSummaryCards();
  } else {
    hasMoreData = false;
  }

  return newData.length > 0;
}

// Update summary cards with statistics
function updateSummaryCards() {
  try {
    // Total leave requests
    const totalLeaves = document.getElementById("totalLeaves");
    if (totalLeaves) {
      totalLeaves.textContent = allCachedData.length;
    }

    // Count by status
    const approvedCount = currentLeaveData.filter(
      (leave) => leave.status === "Approved" || leave.status === "Disetujui"
    ).length;
    const rejectedCount = currentLeaveData.filter(
      (leave) => leave.status === "Rejected" || leave.status === "Ditolak"
    ).length;
    const pendingCount = currentLeaveData.filter(
      (leave) => leave.status === "Pending" || leave.status === "Menunggu Persetujuan"
    ).length;

    const approvedLeaves = document.getElementById("approvedLeaves");
    const rejectedLeaves = document.getElementById("rejectedLeaves");
    const pendingLeaves = document.getElementById("pendingLeaves");

    if (approvedLeaves) approvedLeaves.textContent = approvedCount;
    if (rejectedLeaves) rejectedLeaves.textContent = rejectedCount;
    if (pendingLeaves) pendingLeaves.textContent = pendingCount;
  } catch (error) {
    console.error("Error updating summary cards:", error);
  }
}

// Populate leave table with data
function populateLeaveTable() {
  try {
    const tableBody = document.getElementById("leaveReportList");
    if (!tableBody) {
      console.error("Table body element not found");
      return;
    }

    // Clear existing rows
    tableBody.innerHTML = "";

    if (currentLeaveData.length === 0) {
      const noDataRow = document.createElement("tr");
      noDataRow.innerHTML = '<td colspan="9" class="text-center">Tidak ada data izin untuk bulan ini</td>';
      tableBody.appendChild(noDataRow);
      return;
    }

    // Counter untuk nomor urut
    let rowNumber = 1;

    // Add rows for each leave request
    currentLeaveData.forEach((leave) => {
      // Periksa apakah izin multi-hari
      const isMultiDay = leave.leaveStartDate && leave.leaveEndDate && leave.leaveStartDate !== leave.leaveEndDate;

      // Cek apakah izin sakit dengan surat dokter
      const hasMedicalCert =
        leave.leaveType === "sakit" && leave.replacementDetails && leave.replacementDetails.hasMedicalCertificate;

      // Cek apakah izin cuti (tidak perlu diganti)
      const isLeave = leave.leaveType === "cuti";

      // Jika izin sakit dengan surat dokter atau cuti, set status penggantian ke "Tidak Perlu Diganti"
      if ((hasMedicalCert || isLeave) && (!leave.replacementStatus || leave.replacementStatus === "Belum Diganti")) {
        leave.replacementStatus = "Tidak Perlu Diganti";
      }

      if (!isMultiDay) {
        // Untuk izin satu hari, tampilkan seperti biasa
        const row = document.createElement("tr");

        // Format dates
        let leaveDate = leave.leaveDate || leave.date || "-";
        if (leaveDate instanceof Date) {
          leaveDate = leaveDate.toLocaleDateString("id-ID");
        } else if (typeof leaveDate === "object" && leaveDate.seconds) {
          // Handle Firestore timestamp
          leaveDate = new Date(leaveDate.seconds * 1000).toLocaleDateString("id-ID");
        }

        // Format replacement info
        let replacementType = "-";
        let replacementInfo = "-";

        // Cek apakah izin sakit dengan surat keterangan atau cuti
        if (hasMedicalCert) {
          // Jika ada surat keterangan sakit
          replacementType = "Ada Surat DC";
          replacementInfo = "Tidak perlu diganti";
        } else if (isLeave) {
          // Jika cuti
          replacementType = "Cuti";
          replacementInfo = "Tidak perlu diganti";
        } else {
          // Untuk jenis izin lainnya
          if (leave.replacementType === "libur") {
            replacementType = "Ganti Libur";
            if (leave.replacementDetails && leave.replacementDetails.formattedDate) {
              replacementInfo = `${leave.replacementDetails.formattedDate}`;
            } else if (
              leave.replacementDetails &&
              leave.replacementDetails.dates &&
              leave.replacementDetails.dates.length > 0
            ) {
              replacementInfo = leave.replacementDetails.dates.map((d) => d.formattedDate).join(", ");
            }
          } else if (leave.replacementType === "jam") {
            replacementType = "Ganti Jam";
            // PERBAIKAN: Tampilkan detail pengganti jam/menit sesuai format baru
            if (leave.replacementDetails) {
              // Cek apakah menggunakan format baru dengan timeUnit dan timeValue
              if (leave.replacementDetails.timeUnit && leave.replacementDetails.timeValue) {
                const timeValue = leave.replacementDetails.timeValue;
                const timeUnit = leave.replacementDetails.timeUnit;
                const formattedDate =
                  leave.replacementDetails.formattedDate ||
                  (leave.replacementDetails.date
                    ? new Date(leave.replacementDetails.date).toLocaleDateString("id-ID")
                    : "-");

                replacementInfo = `${timeValue} ${timeUnit} pada ${formattedDate}`;
              }
              // Cek apakah menggunakan format baru dengan unit dan value
              else if (leave.replacementDetails.unit && leave.replacementDetails.value) {
                const value = leave.replacementDetails.value;
                const unit = leave.replacementDetails.unit;
                const formattedDate =
                  leave.replacementDetails.formattedDate ||
                  (leave.replacementDetails.date
                    ? new Date(leave.replacementDetails.date).toLocaleDateString("id-ID")
                    : "-");

                replacementInfo = `${value} ${unit} pada ${formattedDate}`;
              }
              // Format lama dengan hours
              else if (leave.replacementDetails.hours && leave.replacementDetails.formattedDate) {
                replacementInfo = `${leave.replacementDetails.hours} jam pada ${leave.replacementDetails.formattedDate}`;
              }
              // Format dengan formattedValue
              else if (leave.replacementDetails.formattedValue && leave.replacementDetails.formattedDate) {
                replacementInfo = `${leave.replacementDetails.formattedValue} pada ${leave.replacementDetails.formattedDate}`;
              }
            }
          } else if (leave.replacementType === "tidak") {
            replacementType = "Tidak Perlu Diganti";
          }
        }
        // PERBAIKAN: Pastikan status penggantian ditampilkan dengan benar
        let replacementStatus = leave.replacementStatus || "Belum Diganti";

        // Normalisasi status untuk konsistensi
        if (replacementStatus.toLowerCase().includes("sudah")) {
          replacementStatus = "Sudah Diganti";
        } else if (replacementStatus.toLowerCase().includes("belum")) {
          replacementStatus = "Belum Diganti";
        } else if (hasMedicalCert || isLeave) {
          replacementStatus = "Tidak Perlu Diganti";
        }
        // Determine status classes
        const statusClass = getStatusClass(leave.status);
        const replacementStatusClass = getReplacementStatusClass(replacementStatus);

        row.innerHTML = `
          <td>${rowNumber}</td>
          <td>${leave.employeeId || "-"}</td>
          <td>${leave.name || "-"}</td>
          <td>${leaveDate}</td>
          <td>${leave.reason || "-"}</td>
          <td>${replacementType}</td>
          <td>${replacementInfo}</td>
          <td><span class="badge ${statusClass}">${leave.status || "Pending"}</span></td>
          <td><span class="badge ${replacementStatusClass}">${leave.replacementStatus || "Belum Diganti"}</span></td>
        `;

        tableBody.appendChild(row);
        rowNumber++;
      } else {
        // Untuk izin multi-hari (cuti atau sakit dengan surat dokter), tampilkan dalam satu baris
        if (hasMedicalCert || isLeave) {
          const row = document.createElement("tr");

          // Format tanggal awal dan akhir
          const startDate = new Date(
            leave.leaveStartDate instanceof Date
              ? leave.leaveStartDate
              : leave.leaveStartDate.seconds
              ? new Date(leave.leaveStartDate.seconds * 1000)
              : leave.leaveStartDate
          );

          const endDate = new Date(
            leave.leaveEndDate instanceof Date
              ? leave.leaveEndDate
              : leave.leaveEndDate.seconds
              ? new Date(leave.leaveEndDate.seconds * 1000)
              : leave.leaveEndDate
          );

          // Format tanggal dalam format Indonesia
          const formatDateID = (date) => {
            return date.toLocaleDateString("id-ID", {
              day: "numeric",
              month: "long",
              year: "numeric",
            });
          };

          const dateRange = `${formatDateID(startDate)} - ${formatDateID(endDate)}`;
          const dayDiff = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;

          // Format replacement info
          let replacementType = hasMedicalCert ? "Ada Surat DC" : "Cuti";
          let replacementInfo = "Tidak perlu diganti";

          // Determine status classes
          const statusClass = getStatusClass(leave.status);
          const replacementStatusClass = getReplacementStatusClass("Tidak Perlu Diganti");

          row.innerHTML = `
            <td>${rowNumber}</td>
            <td>${leave.employeeId || "-"}</td>
            <td>${leave.name || "-"}</td>
            <td>${dateRange} (${dayDiff} hari)</td>
            <td>${leave.reason || "-"}</td>
            <td>${replacementType}</td>
            <td>${replacementInfo}</td>
            <td><span class="badge ${statusClass}">${leave.status || "Pending"}</span></td>
            <td><span class="badge ${replacementStatusClass}">Tidak Perlu Diganti</span></td>
          `;

          tableBody.appendChild(row);
          rowNumber++;
        } else {
          // Untuk izin multi-hari lainnya, tampilkan seperti sebelumnya (per hari)
          const startDate = new Date(
            leave.leaveStartDate instanceof Date
              ? leave.leaveStartDate
              : leave.leaveStartDate.seconds
              ? new Date(leave.leaveStartDate.seconds * 1000)
              : leave.leaveStartDate
          );
          const endDate = new Date(
            leave.leaveEndDate instanceof Date
              ? leave.leaveEndDate
              : leave.leaveEndDate.seconds
              ? new Date(leave.leaveEndDate.seconds * 1000)
              : leave.leaveEndDate
          );
          const dayDiff = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;

          // Pastikan replacementStatusArray ada
          let replacementStatusArray = leave.replacementStatusArray || Array(dayDiff).fill("Belum Diganti");

          // Format replacement type
          let replacementType = "-";
          let baseReplacementInfo = "-";

          // Untuk jenis izin lainnya
          if (leave.replacementType === "libur") {
            replacementType = "Ganti Libur";
          } else if (leave.replacementType === "jam") {
            replacementType = "Ganti Jam";
          } else if (leave.replacementType === "tidak") {
            replacementType = "Tidak Perlu Diganti";
          }

          // Gunakan nomor yang sama untuk semua hari dalam izin multi-hari
          const currentRowNumber = rowNumber;

          // Buat baris untuk setiap hari
          for (let i = 0; i < dayDiff; i++) {
            const currentDate = new Date(startDate);
            currentDate.setDate(startDate.getDate() + i);

            const formattedDate = currentDate.toLocaleDateString("id-ID", {
              day: "numeric",
              month: "long",
              year: "numeric",
            });

            const row = document.createElement("tr");

            // Jika ini hari pertama, tambahkan kelas untuk styling
            if (i === 0) {
              row.classList.add("first-day-row");
            }

            // Tentukan status ganti untuk hari ini
            const dayStatus = replacementStatusArray[i] || "Belum Diganti";
            const replacementStatusClass = getReplacementStatusClass(dayStatus);
            const statusClass = getStatusClass(leave.status);

            // Tampilkan informasi penggantian untuk hari ini
            let replacementInfo = baseReplacementInfo;

            if (leave.replacementType === "libur" && leave.replacementDetails && leave.replacementDetails.dates) {
              // Jika ada tanggal pengganti spesifik untuk hari ini
              if (leave.replacementDetails.dates[i]) {
                replacementInfo = `${leave.replacementDetails.dates[i].formattedDate}`;
              }
            } else if (leave.replacementType === "jam" && leave.replacementDetails) {
              replacementInfo = `${leave.replacementDetails.hours} jam pada ${leave.replacementDetails.formattedDate}`;
            }

            row.innerHTML = `
              <td>${currentRowNumber} (${i + 1}/${dayDiff})</td>
              <td>${leave.employeeId || "-"}</td>
              <td>${leave.name || "-"}</td>
              <td>${formattedDate}</td>
              <td>${leave.reason || "-"}</td>
              <td>${replacementType}</td>
              <td>${replacementInfo}</td>
              <td><span class="badge ${statusClass}">${leave.status || "Pending"}</span></td>
              <td><span class="badge ${replacementStatusClass}">${dayStatus}</span></td>
            `;

            tableBody.appendChild(row);
          }

          // Increment row number only once after all days of multi-day leave
          rowNumber++;
        }
      }
    });
  } catch (error) {
    console.error("Error populating leave table:", error);
    showAlert("danger", "Terjadi kesalahan saat menampilkan data: " + error.message);
  }
}

// Get CSS class for status badge
function getStatusClass(status) {
  if (!status) return "bg-secondary";

  status = status.toLowerCase();
  if (status === "approved" || status === "disetujui") {
    return "bg-primary";
  } else if (status === "rejected" || status === "ditolak") {
    return "bg-danger";
  } else {
    return "bg-warning";
  }
}

// Get CSS class for replacement status badge
function getReplacementStatusClass(status) {
  if (!status || status === "Belum Diganti") {
    return "bg-danger";
  } else if (status === "Sudah Diganti") {
    return "bg-success";
  } else {
    return "bg-secondary";
  }
}

// Show report elements
function showReportElements() {
  try {
    // Show table container
    const tableContainer = document.getElementById("tableContainer");
    if (tableContainer) {
      tableContainer.style.display = "block";
    }

    // Show summary cards
    const summaryCards = document.getElementById("summaryCards");
    if (summaryCards) {
      summaryCards.style.display = "flex";
    }

    // Show action buttons
    const actionButtons = document.getElementById("actionButtons");
    if (actionButtons) {
      actionButtons.style.display = "flex !important";
      // Force display style with inline style
      actionButtons.setAttribute("style", "display: flex !important");
    }

    // Hide no data message
    const noDataMessage = document.getElementById("noDataMessage");
    if (noDataMessage) {
      noDataMessage.style.display = "none";
    }
  } catch (error) {
    console.error("Error showing report elements:", error);
  }
}

// Hide report elements
function hideReportElements() {
  try {
    // Hide table container
    const tableContainer = document.getElementById("tableContainer");
    if (tableContainer) {
      tableContainer.style.display = "none";
    }

    // Hide summary cards
    const summaryCards = document.getElementById("summaryCards");
    if (summaryCards) {
      summaryCards.style.display = "none";
    }

    // Hide action buttons
    const actionButtons = document.getElementById("actionButtons");
    if (actionButtons) {
      actionButtons.style.display = "none !important";
      // Force display style with inline style
      actionButtons.setAttribute("style", "display: none !important");
    }
  } catch (error) {
    console.error("Error hiding report elements:", error);
  }
}

// Cache untuk hasil filter
const filterCache = new Map();

function filterLeaveData(type, filter) {
  try {
    // If no data, do nothing
    if (!currentLeaveData || currentLeaveData.length === 0) return;
    
    // Buat kunci cache untuk filter ini
    const month = parseInt(document.getElementById("monthSelector").value);
    const year = parseInt(document.getElementById("yearSelector").value);
    const filterCacheKey = `${month}_${year}_${type}_${filter}`;
    
    // Clear filter cache to ensure fresh filtering
    if (filterCache.has(filterCacheKey)) {
      filterCache.delete(filterCacheKey);
    }
    
    // Get original data from cache if needed
    const cacheKey = `${month}_${year}`;
    let originalData = [];
    
    if (reportCache.has(cacheKey)) {
      originalData = [...reportCache.get(cacheKey).data];
      // Update allCachedData dengan data lengkap dari cache
      allCachedData = [...originalData];
    } else {
      originalData = [...currentLeaveData];
    }
    
    console.log(`Filtering by ${type}, filter: ${filter}, total data: ${originalData.length}`);
    
    let filteredData = [];
    
    if (filter === "all") {
      // Reset to original data
      filteredData = [...originalData];
    } else if (type === "status") {
      // Filter by status
      filteredData = originalData.filter((leave) => {
        const status = leave.status ? leave.status.toLowerCase() : "";
        if (filter === "approved") {
          return status === "approved" || status === "disetujui";
        } else if (filter === "rejected") {
          return status === "rejected" || status === "ditolak";
        } else if (filter === "pending") {
          return status === "pending" || status === "menunggu persetujuan";
        }
        return true;
      });
    } else if (type === "replacement") {
      // Filter by replacement status - FIXED VERSION
      filteredData = originalData.filter((leave) => {
        // Check for special cases first (medical certificate or leave)
        const hasMedicalCert = 
          leave.leaveType === "sakit" && 
          leave.replacementDetails && 
          leave.replacementDetails.hasMedicalCertificate;
        
        const isLeave = leave.leaveType === "cuti";
        
        // These types don't need replacement
        if (hasMedicalCert || isLeave) {
          // If filtering for "sudah" or "belum", these should be excluded
          return filter === "all";
        }
        
        // Check if it's a multi-day leave
        const isMultiDay = 
          leave.leaveStartDate && 
          leave.leaveEndDate && 
          leave.leaveStartDate !== leave.leaveEndDate;
        
        if (isMultiDay && leave.replacementStatusArray && leave.replacementStatusArray.length > 0) {
          // For multi-day, check if any day matches the filter
          if (filter === "sudah") {
            // Check for any status containing "sudah" (case insensitive)
            return leave.replacementStatusArray.some(status => {
              if (!status) return false;
              return status.toLowerCase().includes("sudah");
            });
          } else if (filter === "belum") {
            // Check for any status containing "belum" or empty
            return leave.replacementStatusArray.some(status => {
              if (!status) return true;
              return status.toLowerCase().includes("belum");
            });
          }
        } else {
          // For single-day, check replacementStatus
          let status = leave.replacementStatus || "";
          
          // Convert to string and lowercase for consistent comparison
          status = String(status).toLowerCase();
          
          if (filter === "sudah") {
            return status.includes("sudah");
          } else if (filter === "belum") {
            return !status || status.includes("belum");
          }
        }
        
        // Default for "all" filter
        return true;
      });
    }
    
    console.log(`Filter results: ${filteredData.length} items found`);
    
    // If no results found, show a message
    if (filteredData.length === 0) {
      showAlert("info", `Tidak ada data izin dengan filter yang dipilih`, true);
    }
    
    // Cache hasil filter dengan timestamp
    filterCache.set(filterCacheKey, {
      data: filteredData,
      timestamp: Date.now(),
    });
    
    // Update data untuk tampilan dan ekspor
    currentLeaveData = filteredData.slice(0, itemsPerPage);
    allCachedData = filteredData;
    hasMoreData = filteredData.length > itemsPerPage;
    
    // Update UI
    populateLeaveTable();
    updateSummaryCards();
    
    // Update tombol Load More
    const loadMoreContainer = document.getElementById("loadMoreContainer");
    if (loadMoreContainer) {
      loadMoreContainer.style.display = hasMoreData ? "block" : "none";
    }
  } catch (error) {
    console.error("Error filtering leave data:", error);
    showAlert("danger", "Terjadi kesalahan saat memfilter data: " + error.message);
  }
}


// Fungsi untuk memeriksa validitas cache filter
function isFilterCacheValid(filterCacheKey) {
  if (!filterCache.has(filterCacheKey)) return false;

  const parts = filterCacheKey.split("_");
  if (parts.length < 2) return false;

  const month = parts[0];
  const year = parts[1];
  const dataCacheKey = `${month}_${year}`;

  const filterCacheEntry = filterCache.get(filterCacheKey);
  const dataTimestamp = cacheTimestamps.get(dataCacheKey) || 0;

  // Filter cache valid jika dibuat setelah data terakhir diperbarui
  return filterCacheEntry.timestamp >= dataTimestamp;
}

function clearFilterCache(type, filter) {
  // Jika parameter diberikan, hanya bersihkan cache untuk filter tertentu
  if (type && filter) {
    const month = parseInt(document.getElementById("monthSelector").value);
    const year = parseInt(document.getElementById("yearSelector").value);
    const filterCacheKey = `${month}_${year}_${type}_${filter}`;

    if (filterCache.has(filterCacheKey)) {
      filterCache.delete(filterCacheKey);
      console.log(`Cleared filter cache for ${filterCacheKey}`);
    }
  } else {
    // Bersihkan semua cache filter
    filterCache.clear();
    console.log("All filter cache cleared");
  }
}

// Show delete confirmation modal
function showDeleteConfirmation() {
  try {
    const deleteModal = document.getElementById("deleteConfirmModal");
    if (deleteModal) {
      const bsModal = new bootstrap.Modal(deleteModal);
      bsModal.show();
    }
  } catch (error) {
    console.error("Error showing delete confirmation:", error);
    showAlert("danger", "Terjadi kesalahan saat menampilkan konfirmasi: " + error.message);
  }
}

// Delete month data
async function deleteMonthData() {
  try {
    const month = parseInt(document.getElementById("monthSelector").value);
    const year = parseInt(document.getElementById("yearSelector").value);

    // Show loading state
    const confirmDeleteBtn = document.getElementById("confirmDeleteBtn");
    if (confirmDeleteBtn) {
      confirmDeleteBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i> Menghapus...';
      confirmDeleteBtn.disabled = true;
    }

    // Delete data
    const deletedCount = await deleteLeaveRequestsByMonth(month, year);

    // Hide modal
    const deleteModal = document.getElementById("deleteConfirmModal");
    if (deleteModal) {
      const bsModal = bootstrap.Modal.getInstance(deleteModal);
      if (bsModal) {
        bsModal.hide();
      }
    }

    // Reset button
    if (confirmDeleteBtn) {
      confirmDeleteBtn.innerHTML = '<i class="fas fa-trash-alt me-2"></i> Ya, Hapus Data';
      confirmDeleteBtn.disabled = false;
    }

    // Show success message
    showAlert("success", `Berhasil menghapus ${deletedCount} data izin untuk bulan ${monthNames[month - 1]} ${year}`);

    // Clear cache for this month/year
    const cacheKey = `${month}_${year}`;
    reportCache.delete(cacheKey);
    cacheTimestamps.delete(cacheKey);

    // Clear leave service cache
    clearLeaveCache();

    // Reset UI
    currentLeaveData = [];
    hideReportElements();
    document.getElementById("noDataMessage").style.display = "block";
  } catch (error) {
    console.error("Error deleting month data:", error);
    showAlert("danger", "Terjadi kesalahan saat menghapus data: " + error.message);

    // Reset button
    const confirmDeleteBtn = document.getElementById("confirmDeleteBtn");
    if (confirmDeleteBtn) {
      confirmDeleteBtn.innerHTML = '<i class="fas fa-trash-alt me-2"></i> Ya, Hapus Data';
      confirmDeleteBtn.disabled = false;
    }
  }
}

// Export to Excel - update untuk mendukung format baru
function exportToExcel() {
  try {
    // Gunakan allCachedData jika tersedia, jika tidak gunakan currentLeaveData
    const dataToExport = allCachedData.length > 0 ? allCachedData : currentLeaveData;

    if (!dataToExport || dataToExport.length === 0) {
      showAlert("warning", "Tidak ada data untuk diekspor");
      return;
    }

    const month = parseInt(document.getElementById("monthSelector").value);
    const year = parseInt(document.getElementById("yearSelector").value);
    const monthName = monthNames[month - 1];

    // Create a new workbook
    const wb = XLSX.utils.book_new();

    // Prepare data for export
    const exportData = [];
    let rowNumber = 1;

    // Process each leave request
    dataToExport.forEach((leave) => {
      // Periksa apakah izin multi-hari
      const isMultiDay = leave.leaveStartDate && leave.leaveEndDate && leave.leaveStartDate !== leave.leaveEndDate;

      // Cek apakah izin sakit dengan surat dokter atau cuti
      const hasMedicalCert =
        leave.leaveType === "sakit" && leave.replacementDetails && leave.replacementDetails.hasMedicalCertificate;
      const isLeave = leave.leaveType === "cuti";

      if (!isMultiDay) {
        // Format dates
        let leaveDate = leave.leaveDate || leave.date || "-";
        if (leaveDate instanceof Date) {
          leaveDate = leaveDate.toLocaleDateString("id-ID");
        } else if (typeof leaveDate === "object" && leaveDate.seconds) {
          // Handle Firestore timestamp
          leaveDate = new Date(leaveDate.seconds * 1000).toLocaleDateString("id-ID");
        }

        // Format replacement info
        let replacementType = "-";
        let replacementInfo = "-";
        let replacementStatus = leave.replacementStatus || "Belum Diganti";

        // Cek apakah izin sakit dengan surat keterangan atau cuti
        if (hasMedicalCert) {
          // Jika ada surat keterangan sakit
          replacementType = "Ada Surat DC";
          replacementInfo = "Tidak perlu diganti";
          replacementStatus = "Tidak Perlu Diganti";
        } else if (isLeave) {
          // Jika cuti
          replacementType = "Cuti";
          replacementInfo = "Tidak perlu diganti";
          replacementStatus = "Tidak Perlu Diganti";
        } else {
          // Untuk jenis izin lainnya
          if (leave.replacementType === "libur") {
            replacementType = "Ganti Libur";
            if (leave.replacementDetails && leave.replacementDetails.formattedDate) {
              replacementInfo = `${leave.replacementDetails.formattedDate}`;
            } else if (
              leave.replacementDetails &&
              leave.replacementDetails.dates &&
              leave.replacementDetails.dates.length > 0
            ) {
              replacementInfo = leave.replacementDetails.dates.map((d) => d.formattedDate).join(", ");
            }
          } else if (leave.replacementType === "jam") {
            replacementType = "Ganti Jam";
            // PERBAIKAN: Format pengganti jam/menit sesuai format baru
            if (leave.replacementDetails) {
              // Cek apakah menggunakan format baru dengan timeUnit dan timeValue
              if (leave.replacementDetails.timeUnit && leave.replacementDetails.timeValue) {
                const timeValue = leave.replacementDetails.timeValue;
                const timeUnit = leave.replacementDetails.timeUnit;
                const formattedDate =
                  leave.replacementDetails.formattedDate ||
                  (leave.replacementDetails.date
                    ? new Date(leave.replacementDetails.date).toLocaleDateString("id-ID")
                    : "-");

                replacementInfo = `${timeValue} ${timeUnit} pada ${formattedDate}`;
              }
              // Cek apakah menggunakan format baru dengan unit dan value
              else if (leave.replacementDetails.unit && leave.replacementDetails.value) {
                const value = leave.replacementDetails.value;
                const unit = leave.replacementDetails.unit;
                const formattedDate =
                  leave.replacementDetails.formattedDate ||
                  (leave.replacementDetails.date
                    ? new Date(leave.replacementDetails.date).toLocaleDateString("id-ID")
                    : "-");

                replacementInfo = `${value} ${unit} pada ${formattedDate}`;
              }
              // Format lama dengan hours
              else if (leave.replacementDetails.hours && leave.replacementDetails.formattedDate) {
                replacementInfo = `${leave.replacementDetails.hours} jam pada ${leave.replacementDetails.formattedDate}`;
              }
              // Format dengan formattedValue
              else if (leave.replacementDetails.formattedValue && leave.replacementDetails.formattedDate) {
                replacementInfo = `${leave.replacementDetails.formattedValue} pada ${leave.replacementDetails.formattedDate}`;
              }
            }
          } else if (leave.replacementType === "tidak") {
            replacementType = "Tidak Perlu Diganti";
          }
        }

        // Add to export data
        exportData.push({
          No: rowNumber,
          "ID Karyawan": leave.employeeId || "-",
          Nama: leave.name || "-",
          "Tanggal Izin": leaveDate,
          Alasan: leave.reason || "-",
          "Jenis Pengganti": replacementType,
          "Informasi Pengganti": replacementInfo,
          "Status Izin": leave.status || "Pending",
          "Status Penggantian": replacementStatus,
        });

        rowNumber++;
      } else {
        // Untuk izin multi-hari (cuti atau sakit dengan surat dokter), tampilkan dalam satu baris
        if (hasMedicalCert || isLeave) {
          // Format tanggal awal dan akhir
          const startDate = new Date(
            leave.leaveStartDate instanceof Date
              ? leave.leaveStartDate
              : leave.leaveStartDate.seconds
              ? new Date(leave.leaveStartDate.seconds * 1000)
              : leave.leaveStartDate
          );

          const endDate = new Date(
            leave.leaveEndDate instanceof Date
              ? leave.leaveEndDate
              : leave.leaveEndDate.seconds
              ? new Date(leave.leaveEndDate.seconds * 1000)
              : leave.leaveEndDate
          );

          // Format tanggal dalam format Indonesia
          const formatDateID = (date) => {
            return date.toLocaleDateString("id-ID", {
              day: "numeric",
              month: "long",
              year: "numeric",
            });
          };

          const dateRange = `${formatDateID(startDate)} - ${formatDateID(endDate)}`;
          const dayDiff = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;

          // Format replacement info
          let replacementType = hasMedicalCert ? "Ada Surat DC" : "Cuti";
          let replacementInfo = "Tidak perlu diganti";

          // Add to export data
          exportData.push({
            No: rowNumber,
            "ID Karyawan": leave.employeeId || "-",
            Nama: leave.name || "-",
            "Tanggal Izin": `${dateRange} (${dayDiff} hari)`,
            Alasan: leave.reason || "-",
            "Jenis Pengganti": replacementType,
            "Informasi Pengganti": replacementInfo,
            "Status Izin": leave.status || "Pending",
            "Status Penggantian": "Tidak Perlu Diganti",
          });

          rowNumber++;
        } else {
          // Untuk izin multi-hari lainnya, tampilkan seperti sebelumnya (per hari)
          const startDate = new Date(
            leave.leaveStartDate instanceof Date
              ? leave.leaveStartDate
              : leave.leaveStartDate.seconds
              ? new Date(leave.leaveStartDate.seconds * 1000)
              : leave.leaveStartDate
          );
          const endDate = new Date(
            leave.leaveEndDate instanceof Date
              ? leave.leaveEndDate
              : leave.leaveEndDate.seconds
              ? new Date(leave.leaveEndDate.seconds * 1000)
              : leave.leaveEndDate
          );
          const dayDiff = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;

          // Pastikan replacementStatusArray ada
          let replacementStatusArray = leave.replacementStatusArray || Array(dayDiff).fill("Belum Diganti");

          // Format replacement type
          let replacementType = "-";
          let baseReplacementInfo = "-";

          // Untuk jenis izin lainnya
          if (leave.replacementType === "libur") {
            replacementType = "Ganti Libur";
          } else if (leave.replacementType === "jam") {
            replacementType = "Ganti Jam";
          } else if (leave.replacementType === "tidak") {
            replacementType = "Tidak Perlu Diganti";
          }

          // Gunakan nomor yang sama untuk semua hari dalam izin multi-hari
          const currentRowNumber = rowNumber;

          // Buat baris untuk setiap hari
          for (let i = 0; i < dayDiff; i++) {
            const currentDate = new Date(startDate);
            currentDate.setDate(startDate.getDate() + i);

            const formattedDate = currentDate.toLocaleDateString("id-ID", {
              day: "numeric",
              month: "long",
              year: "numeric",
            });

            // Tentukan status ganti untuk hari ini
            const dayStatus = replacementStatusArray[i] || "Belum Diganti";

            // Tampilkan informasi penggantian untuk hari ini
            let replacementInfo = baseReplacementInfo;

            if (leave.replacementType === "libur" && leave.replacementDetails && leave.replacementDetails.dates) {
              // Jika ada tanggal pengganti spesifik untuk hari ini
              if (leave.replacementDetails.dates[i]) {
                replacementInfo = `${leave.replacementDetails.dates[i].formattedDate}`;
              }
            } else if (leave.replacementType === "jam" && leave.replacementDetails) {
              replacementInfo = `${leave.replacementDetails.hours} jam pada ${leave.replacementDetails.formattedDate}`;
            }

            // Add to export data
            exportData.push({
              No: `${currentRowNumber} (${i + 1}/${dayDiff})`,
              "ID Karyawan": leave.employeeId || "-",
              Nama: leave.name || "-",
              "Tanggal Izin": formattedDate,
              Alasan: leave.reason || "-",
              "Jenis Pengganti": replacementType,
              "Informasi Pengganti": replacementInfo,
              "Status Izin": leave.status || "Pending",
              "Status Penggantian": dayStatus,
            });
          }

          // Increment row number only once after all days of multi-day leave
          rowNumber++;
        }
      }
    });

    // Create worksheet
    const ws = XLSX.utils.json_to_sheet(exportData, { origin: "A4" }); // Mulai dari baris ke-4 untuk memberi ruang judul

    // Tambahkan judul laporan
    XLSX.utils.sheet_add_aoa(
      ws,
      [[`LAPORAN IZIN KARYAWAN`], [`MELATI GOLD SHOP`], [`BULAN ${monthName.toUpperCase()} ${year}`]],
      { origin: "A1" }
    );

    // Set column widths
    const colWidths = [
      { wch: 5 }, // No
      { wch: 10 }, // ID Karyawan
      { wch: 10 }, // Nama
      { wch: 25 }, // Tanggal Izin
      { wch: 30 }, // Alasan
      { wch: 20 }, // Jenis Pengganti
      { wch: 30 }, // Informasi Pengganti
      { wch: 10 }, // Status Izin
      { wch: 20 }, // Status Penggantian
    ];
    ws["!cols"] = colWidths;

    // Styling untuk judul
    // Merge cells untuk judul
    ws["!merges"] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 8 } }, // Merge first row (LAPORAN IZIN KARYAWAN)
      { s: { r: 1, c: 0 }, e: { r: 1, c: 8 } }, // Merge second row (MELATI GOLD SHOP)
      { s: { r: 2, c: 0 }, e: { r: 2, c: 8 } }, // Merge third row (BULAN ... TAHUN ...)
    ];

    // Tambahkan style untuk judul (harus menggunakan cell object)
    const titleStyle = {
      font: { bold: true, sz: 16 },
      alignment: { horizontal: "center", vertical: "center" },
    };

    // Mengatur style untuk sel judul
    for (let i = 0; i < 3; i++) {
      const cellRef = XLSX.utils.encode_cell({ r: i, c: 0 });
      if (!ws[cellRef]) ws[cellRef] = {};
      ws[cellRef].s = titleStyle;
    }

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(wb, ws, "Laporan Izin");

    // Generate filename
    const fileName = `Laporan_Izin_${monthName}_${year}.xlsx`;

    // Export to file
    XLSX.writeFile(wb, fileName);

    showAlert("success", `Berhasil mengekspor data ke ${fileName}`);
  } catch (error) {
    console.error("Error exporting to Excel:", error);
    showAlert("danger", "Terjadi kesalahan saat mengekspor data: " + error.message);
  }
}

function exportToPDF() {
  try {
    // Gunakan allCachedData jika tersedia, jika tidak gunakan currentLeaveData
    const dataToExport = allCachedData.length > 0 ? allCachedData : currentLeaveData;

    if (!dataToExport || dataToExport.length === 0) {
      showAlert("warning", "Tidak ada data untuk diekspor");
      return;
    }

    const month = parseInt(document.getElementById("monthSelector").value);
    const year = parseInt(document.getElementById("yearSelector").value);
    const monthName = monthNames[month - 1];

    // Prepare document definition
    const docDefinition = {
      pageSize: "A4",
      pageOrientation: "landscape",
      pageMargins: [20, 80, 20, 20], // Tambahkan margin atas lebih besar untuk header

      // Perbaikan header menggunakan array teks
      header: {
        stack: [
          { text: "LAPORAN IZIN KARYAWAN", alignment: "center", fontSize: 14, bold: true, margin: [0, 20, 0, 0] },
          { text: "MELATI GOLD SHOP", alignment: "center", fontSize: 12, bold: true, margin: [0, 5, 0, 0] },
          {
            text: `BULAN ${monthName.toUpperCase()} ${year}`,
            alignment: "center",
            fontSize: 12,
            bold: true,
            margin: [0, 5, 0, 10],
          },
        ],
      },

      footer: function (currentPage, pageCount) {
        return {
          text: `Halaman ${currentPage} dari ${pageCount}`,
          alignment: "center",
          margin: [0, 10, 0, 0],
        };
      },
      content: [
        {
          table: {
            headerRows: 1,
            widths: ["auto", "auto", "auto", "*", "*", "auto", "*", "auto", "auto"],
            body: [
              [
                { text: "No", style: "tableHeader" },
                { text: "ID Karyawan", style: "tableHeader" },
                { text: "Nama", style: "tableHeader" },
                { text: "Tanggal Izin", style: "tableHeader" },
                { text: "Alasan", style: "tableHeader" },
                { text: "Jenis Pengganti", style: "tableHeader" },
                { text: "Informasi Pengganti", style: "tableHeader" },
                { text: "Status Izin", style: "tableHeader" },
                { text: "Status Penggantian", style: "tableHeader" },
              ],
            ],
          },
        },
      ],
      styles: {
        tableHeader: {
          bold: true,
          fontSize: 10,
          fillColor: "#eeeeee",
          alignment: "center",
        },
        tableCell: {
          fontSize: 9,
        },
        statusPending: {
          color: "#ffc107",
          bold: true,
        },
        statusRejected: {
          color: "#dc3545",
          bold: true,
        },
        replacementDone: {
          color: "#198754",
          bold: true,
        },
        replacementPending: {
          color: "#dc3545",
          bold: true,
        },
        replacementNotNeeded: {
          color: "#6c757d",
          bold: true,
        },
      },
    };

    // Add rows for each leave request
    let rowNumber = 1;

    // Proses data untuk PDF
    dataToExport.forEach((leave) => {
      // Periksa apakah izin multi-hari
      const isMultiDay = leave.leaveStartDate && leave.leaveEndDate && leave.leaveStartDate !== leave.leaveEndDate;

      // Cek apakah izin sakit dengan surat dokter atau cuti
      const hasMedicalCert =
        leave.leaveType === "sakit" && leave.replacementDetails && leave.replacementDetails.hasMedicalCertificate;
      const isLeave = leave.leaveType === "cuti";

      // Jika izin sakit dengan surat dokter atau cuti, set status penggantian ke "Tidak Perlu Diganti"
      if ((hasMedicalCert || isLeave) && (!leave.replacementStatus || leave.replacementStatus === "Belum Diganti")) {
        leave.replacementStatus = "Tidak Perlu Diganti";
      }

      if (!isMultiDay) {
        // Untuk izin satu hari, tampilkan seperti biasa
        // Format dates
        let leaveDate = leave.leaveDate || leave.date || "-";
        if (leaveDate instanceof Date) {
          leaveDate = leaveDate.toLocaleDateString("id-ID");
        } else if (typeof leaveDate === "object" && leaveDate.seconds) {
          // Handle Firestore timestamp
          leaveDate = new Date(leaveDate.seconds * 1000).toLocaleDateString("id-ID");
        }

        // Format replacement info
        let replacementType = "-";
        let replacementInfo = "-";

        // Cek apakah izin sakit dengan surat keterangan atau cuti
        if (hasMedicalCert) {
          // Jika ada surat keterangan sakit
          replacementType = "Ada Surat DC";
          replacementInfo = "Tidak perlu diganti";
        } else if (isLeave) {
          // Jika cuti
          replacementType = "Cuti";
          replacementInfo = "Tidak perlu diganti";
        } else {
          // Untuk jenis izin lainnya
          if (leave.replacementType === "libur") {
            replacementType = "Ganti Libur";
            if (leave.replacementDetails && leave.replacementDetails.formattedDate) {
              replacementInfo = `${leave.replacementDetails.formattedDate}`;
            } else if (
              leave.replacementDetails &&
              leave.replacementDetails.dates &&
              leave.replacementDetails.dates.length > 0
            ) {
              replacementInfo = leave.replacementDetails.dates.map((d) => d.formattedDate).join(", ");
            }
          } else if (leave.replacementType === "jam") {
            replacementType = "Ganti Jam";
            // PERBAIKAN: Format pengganti jam/menit sesuai format baru
            if (leave.replacementDetails) {
              // Cek apakah menggunakan format baru dengan timeUnit dan timeValue
              if (leave.replacementDetails.timeUnit && leave.replacementDetails.timeValue) {
                const timeValue = leave.replacementDetails.timeValue;
                const timeUnit = leave.replacementDetails.timeUnit;
                const formattedDate =
                  leave.replacementDetails.formattedDate ||
                  (leave.replacementDetails.date
                    ? new Date(leave.replacementDetails.date).toLocaleDateString("id-ID")
                    : "-");

                replacementInfo = `${timeValue} ${timeUnit} pada ${formattedDate}`;
              }
              // Cek apakah menggunakan format baru dengan unit dan value
              else if (leave.replacementDetails.unit && leave.replacementDetails.value) {
                const value = leave.replacementDetails.value;
                const unit = leave.replacementDetails.unit;
                const formattedDate =
                  leave.replacementDetails.formattedDate ||
                  (leave.replacementDetails.date
                    ? new Date(leave.replacementDetails.date).toLocaleDateString("id-ID")
                    : "-");

                replacementInfo = `${value} ${unit} pada ${formattedDate}`;
              }
              // Format lama dengan hours
              else if (leave.replacementDetails.hours && leave.replacementDetails.formattedDate) {
                replacementInfo = `${leave.replacementDetails.hours} jam pada ${leave.replacementDetails.formattedDate}`;
              }
              // Format dengan formattedValue
              else if (leave.replacementDetails.formattedValue && leave.replacementDetails.formattedDate) {
                replacementInfo = `${leave.replacementDetails.formattedValue} pada ${leave.replacementDetails.formattedDate}`;
              }
            }
          } else if (leave.replacementType === "tidak") {
            replacementType = "Tidak Perlu Diganti";
          }
        }

        // Determine status style
        const statusStyle =
          leave.status === "Disetujui"
            ? "statusApproved"
            : leave.status === "Ditolak"
            ? "statusRejected"
            : "statusPending";

        // Determine replacement status style
        const replacementStatusStyle =
          leave.replacementStatus === "Sudah Diganti"
            ? "replacementDone"
            : leave.replacementStatus === "Tidak Perlu Diganti"
            ? "replacementNotNeeded"
            : "replacementPending";

        // Add row to table
        docDefinition.content[0].table.body.push([
          { text: rowNumber, style: "tableCell", alignment: "center" },
          { text: leave.employeeId || "-", style: "tableCell" },
          { text: leave.name || "-", style: "tableCell" },
          { text: leaveDate, style: "tableCell" },
          { text: leave.reason || "-", style: "tableCell" },
          { text: replacementType, style: "tableCell" },
          { text: replacementInfo, style: "tableCell" },
          { text: leave.status || "Pending", style: ["tableCell", statusStyle] },
          { text: leave.replacementStatus || "Belum Diganti", style: ["tableCell", replacementStatusStyle] },
        ]);

        rowNumber++;
      } else {
        // Untuk izin multi-hari (cuti atau sakit dengan surat dokter), tampilkan dalam satu baris
        if (hasMedicalCert || isLeave) {
          // Format tanggal awal dan akhir
          const startDate = new Date(
            leave.leaveStartDate instanceof Date
              ? leave.leaveStartDate
              : leave.leaveStartDate.seconds
              ? new Date(leave.leaveStartDate.seconds * 1000)
              : leave.leaveStartDate
          );

          const endDate = new Date(
            leave.leaveEndDate instanceof Date
              ? leave.leaveEndDate
              : leave.leaveEndDate.seconds
              ? new Date(leave.leaveEndDate.seconds * 1000)
              : leave.leaveEndDate
          );

          // Format tanggal dalam format Indonesia
          const formatDateID = (date) => {
            return date.toLocaleDateString("id-ID", {
              day: "numeric",
              month: "long",
              year: "numeric",
            });
          };

          const dateRange = `${formatDateID(startDate)} - ${formatDateID(endDate)}`;
          const dayDiff = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;

          // Format replacement info
          let replacementType = hasMedicalCert ? "Ada Surat DC" : "Cuti";
          let replacementInfo = "Tidak perlu diganti";

          // Determine status style
          const statusStyle =
            leave.status === "Disetujui"
              ? "statusApproved"
              : leave.status === "Ditolak"
              ? "statusRejected"
              : "statusPending";

          // Add row to table
          docDefinition.content[0].table.body.push([
            { text: rowNumber, style: "tableCell", alignment: "center" },
            { text: leave.employeeId || "-", style: "tableCell" },
            { text: leave.name || "-", style: "tableCell" },
            { text: `${dateRange} (${dayDiff} hari)`, style: "tableCell" },
            { text: leave.reason || "-", style: "tableCell" },
            { text: replacementType, style: "tableCell" },
            { text: replacementInfo, style: "tableCell" },
            { text: leave.status || "Pending", style: ["tableCell", statusStyle] },
            { text: "Tidak Perlu Diganti", style: ["tableCell", "replacementNotNeeded"] },
          ]);

          rowNumber++;
        } else {
          // Untuk izin multi-hari lainnya, tampilkan seperti sebelumnya (per hari)
          const startDate = new Date(
            leave.leaveStartDate instanceof Date
              ? leave.leaveStartDate
              : leave.leaveStartDate.seconds
              ? new Date(leave.leaveStartDate.seconds * 1000)
              : leave.leaveStartDate
          );
          const endDate = new Date(
            leave.leaveEndDate instanceof Date
              ? leave.leaveEndDate
              : leave.leaveEndDate.seconds
              ? new Date(leave.leaveEndDate.seconds * 1000)
              : leave.leaveEndDate
          );
          const dayDiff = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;

          // Pastikan replacementStatusArray ada
          let replacementStatusArray = leave.replacementStatusArray || Array(dayDiff).fill("Belum Diganti");

          // Format replacement type
          let replacementType = "-";
          let baseReplacementInfo = "-";

          // Untuk jenis izin lainnya
          if (leave.replacementType === "libur") {
            replacementType = "Ganti Libur";
          } else if (leave.replacementType === "jam") {
            replacementType = "Ganti Jam";
          } else if (leave.replacementType === "tidak") {
            replacementType = "Tidak Perlu Diganti";
          }

          // Gunakan nomor yang sama untuk semua hari dalam izin multi-hari
          const currentRowNumber = rowNumber;

          // Buat baris untuk setiap hari
          for (let i = 0; i < dayDiff; i++) {
            const currentDate = new Date(startDate);
            currentDate.setDate(startDate.getDate() + i);

            const formattedDate = currentDate.toLocaleDateString("id-ID", {
              day: "numeric",
              month: "long",
              year: "numeric",
            });

            // Tentukan status ganti untuk hari ini
            const dayStatus = replacementStatusArray[i] || "Belum Diganti";

            // Determine status styles
            const statusStyle =
              leave.status === "Disetujui"
                ? "statusApproved"
                : leave.status === "Ditolak"
                ? "statusRejected"
                : "statusPending";

            const replacementStatusStyle =
              dayStatus === "Sudah Diganti"
                ? "replacementDone"
                : dayStatus === "Tidak Perlu Diganti"
                ? "replacementNotNeeded"
                : "replacementPending";

            // Tampilkan informasi penggantian untuk hari ini
            let replacementInfo = baseReplacementInfo;

            if (leave.replacementType === "libur" && leave.replacementDetails && leave.replacementDetails.dates) {
              // Jika ada tanggal pengganti spesifik untuk hari ini
              if (leave.replacementDetails.dates[i]) {
                replacementInfo = `${leave.replacementDetails.dates[i].formattedDate}`;
              }
            } else if (leave.replacementType === "jam" && leave.replacementDetails) {
              replacementInfo = `${leave.replacementDetails.hours} jam pada ${leave.replacementDetails.formattedDate}`;
            }

            // Add row to table
            docDefinition.content[0].table.body.push([
              { text: `${currentRowNumber} (${i + 1}/${dayDiff})`, style: "tableCell", alignment: "center" },
              { text: leave.employeeId || "-", style: "tableCell" },
              { text: leave.name || "-", style: "tableCell" },
              { text: formattedDate, style: "tableCell" },
              { text: leave.reason || "-", style: "tableCell" },
              { text: replacementType, style: "tableCell" },
              { text: replacementInfo, style: "tableCell" },
              { text: leave.status || "Pending", style: ["tableCell", statusStyle] },
              { text: dayStatus, style: ["tableCell", replacementStatusStyle] },
            ]);
          }

          // Increment row number only once after all days of multi-day leave
          rowNumber++;
        }
      }
    });

    // Generate filename
    const fileName = `Laporan_Izin_${monthName}_${year}.pdf`;

    // Create PDF
    pdfMake.createPdf(docDefinition).download(fileName);

    showAlert("success", `Berhasil mengekspor data ke ${fileName}`);
  } catch (error) {
    console.error("Error exporting to PDF:", error);
    showAlert("danger", "Terjadi kesalahan saat mengekspor data: " + error.message);
  }
}

// Tambahkan fungsi untuk memastikan allCachedData selalu berisi data lengkap
function ensureCompleteDataForExport() {
  const month = parseInt(document.getElementById("monthSelector").value);
  const year = parseInt(document.getElementById("yearSelector").value);
  const cacheKey = `${month}_${year}`;

  // Jika allCachedData kosong tapi ada data di cache, ambil dari cache
  if (allCachedData.length === 0 && reportCache.has(cacheKey)) {
    allCachedData = reportCache.get(cacheKey).data;
  }

  // Jika masih kosong tapi currentLeaveData ada isinya, gunakan currentLeaveData
  if (allCachedData.length === 0 && currentLeaveData.length > 0) {
    allCachedData = [...currentLeaveData];
  }

  return allCachedData.length > 0;
}

// Pastikan allCachedData diperbarui saat filter diterapkan
function filterByReplacementType(type) {
  try {
    // If no data, do nothing
    if (!currentLeaveData || currentLeaveData.length === 0) return;

    // Get original data from cache if needed
    const month = parseInt(document.getElementById("monthSelector").value);
    const year = parseInt(document.getElementById("yearSelector").value);
    const cacheKey = `${month}_${year}`;

    let originalData = [];
    if (reportCache.has(cacheKey)) {
      originalData = [...reportCache.get(cacheKey).data];
      // Update allCachedData dengan data lengkap dari cache
      allCachedData = [...originalData];
    } else {
      originalData = [...currentLeaveData];
    }

    if (type === "all") {
      // Reset to original data
      currentLeaveData = originalData.slice(0, itemsPerPage); // Batasi tampilan
      hasMoreData = originalData.length > itemsPerPage;
    } else if (type === "libur") {
      // Filter izin dengan ganti libur
      const filteredData = originalData.filter((leave) => {
        return leave.replacementType === "libur";
      });
      currentLeaveData = filteredData.slice(0, itemsPerPage); // Batasi tampilan
      allCachedData = filteredData; // Update allCachedData dengan hasil filter
      hasMoreData = filteredData.length > itemsPerPage;
    } else if (type === "jam") {
      // Filter izin dengan ganti jam
      const filteredData = originalData.filter((leave) => {
        return leave.replacementType === "jam";
      });
      currentLeaveData = filteredData.slice(0, itemsPerPage); // Batasi tampilan
      allCachedData = filteredData; // Update allCachedData dengan hasil filter
      hasMoreData = filteredData.length > itemsPerPage;
    }

    // Update UI
    populateLeaveTable();
    updateSummaryCards();

    // Update tombol Load More
    const loadMoreContainer = document.getElementById("loadMoreContainer");
    if (loadMoreContainer) {
      loadMoreContainer.style.display = hasMoreData ? "block" : "none";
    }
  } catch (error) {
    console.error("Error filtering by replacement type:", error);
    showAlert("danger", "Terjadi kesalahan saat memfilter data: " + error.message);
  }
}

// Show alert message
function showAlert(type, message, autoHide = true) {
  try {
    const alertContainer = document.getElementById("alertContainer");
    if (!alertContainer) {
      console.error("Alert container not found");
      return;
    }

    // Create alert element
    const alertDiv = document.createElement("div");
    alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
    alertDiv.innerHTML = `
          ${message}
          <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
        `;

    // Clear previous alerts
    alertContainer.innerHTML = "";
    alertContainer.appendChild(alertDiv);
    alertContainer.style.display = "block";

    // Auto-hide after 5 seconds if autoHide is true
    if (autoHide) {
      setTimeout(() => {
        if (alertDiv.parentNode) {
          alertDiv.classList.remove("show");
          setTimeout(() => {
            if (alertDiv.parentNode) {
              alertDiv.parentNode.removeChild(alertDiv);
            }

            // Hide container if no alerts
            if (alertContainer.children.length === 0) {
              alertContainer.style.display = "none";
            }
          }, 150);
        }
      }, 5000);
    }
  } catch (error) {
    console.error("Error showing alert:", error);
  }
}

// Hide alert
function hideAlert() {
  try {
    const alertContainer = document.getElementById("alertContainer");
    if (alertContainer) {
      alertContainer.innerHTML = "";
      alertContainer.style.display = "none";
    }
  } catch (error) {
    console.error("Error hiding alert:", error);
  }
}

// Logout handler
window.handleLogout = function () {
  // Clear all caches before logout
  reportCache.clear();
  cacheTimestamps.clear();
  clearLeaveCache();

  // Redirect to login page
  window.location.href = "login.html";
};

// Expose functions for debugging
window.debugFunctions = {
  clearCache: function () {
    reportCache.clear();
    cacheTimestamps.clear();
    clearLeaveCache();
    console.log("Cache cleared");
  },
  getCacheStatus: function () {
    return {
      reportCache: Array.from(reportCache.keys()),
      cacheTimestamps: Object.fromEntries(cacheTimestamps.entries()),
      cacheAge: Array.from(cacheTimestamps.entries()).map(([key, time]) => {
        return {
          key,
          age: (Date.now() - time) / 1000 + " seconds",
          isValid: Date.now() - time < CACHE_DURATION,
        };
      }),
    };
  },
  forceRefresh: function () {
    generateReport(true);
  },
};
