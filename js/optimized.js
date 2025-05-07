import {
  getLeaveRequestsByMonth,
  clearLeaveCache,
  listenToLeaveRequests,
  stopListeningToLeaveRequests,
  batchGetLeaveRequestsByIds,
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

// Fungsi utama untuk generate report dengan optimasi caching dan batch get
async function generateReport(forceRefresh = false) {
  try {
    const monthSelector = document.getElementById("monthSelector");
    const yearSelector = document.getElementById("yearSelector");

    if (!monthSelector || !yearSelector) {
      console.error("Month or year selector not found");
      return;
    }

    const selectedMonth = parseInt(monthSelector.value);
    const selectedYear = parseInt(yearSelector.value);
    const cacheKey = `${selectedMonth}_${selectedYear}`;

    // Cek cache terlebih dahulu
    if (!forceRefresh && reportCache.has(cacheKey)) {
      const cachedData = reportCache.get(cacheKey);
      const cacheTime = cacheTimestamps.get(cacheKey) || 0;
      const now = Date.now();

      if (now - cacheTime < CACHE_DURATION) {
        // Gunakan data dari cache
        currentLeaveData = [...cachedData.data].slice(0, itemsPerPage);
        allCachedData = [...cachedData.data];
        lastVisibleDoc = cachedData.lastDoc;
        hasMoreData = cachedData.hasMore;

        // Update UI
        populateLeaveTable();
        updateSummaryCards();
        return;
      }
    }

    // Jika tidak ada cache atau forceRefresh, ambil data dari Firestore
    // Optimasi: gunakan pagination dan batch get untuk mengurangi reads

    // Ambil data izin dengan pagination
    const { leaveRequests, lastDoc, hasMore } = await getLeaveRequestsByMonth(
      selectedMonth,
      selectedYear,
      itemsPerPage,
      lastVisibleDoc
    );

    // Jika ada data, lakukan batch get untuk data terkait jika perlu
    // Contoh: jika ada referensi dokumen lain yang perlu diambil, kumpulkan ID-nya dan ambil sekaligus
    // Misal: batchGetLeaveRequestsByIds(ids)

    // Simpan data ke cache
    reportCache.set(cacheKey, {
      data: leaveRequests,
      lastDoc: lastDoc,
      hasMore: hasMore,
    });
    cacheTimestamps.set(cacheKey, Date.now());

    // Simpan ke localStorage
    saveReportCacheToStorage();

    // Update variabel global
    currentLeaveData = leaveRequests.slice(0, itemsPerPage);
    allCachedData = leaveRequests;
    lastVisibleDoc = lastDoc;
    hasMoreData = hasMore;

    // Update UI
    populateLeaveTable();
    updateSummaryCards();
  } catch (error) {
    console.error("Error generating report:", error);
    showAlert("danger", "Terjadi kesalahan saat mengambil data: " + error.message);
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

    // Generate report awal
    generateReport();

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

    // Hentikan listener sebelumnya jika ada
    stopListeningToLeaveRequests();

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
          // Batasi data yang ditampilkan ke itemsPerPage
          currentLeaveData = leaveRequests.slice(0, itemsPerPage);
          // Simpan semua data di variabel terpisah
          allCachedData = leaveRequests;

          // Update UI
          updateSummaryCards();
          populateLeaveTable();

          // Tampilkan tombol Load More jika ada data lebih
          toggleLoadMoreButton(leaveRequests.length > itemsPerPage);
        }
      }
    });
  } catch (error) {
    console.error("Error setting up realtime listener:", error);
  }
}

// Fungsi untuk toggle tombol Load More
function toggleLoadMoreButton(show) {
  const loadMoreBtn = document.getElementById("loadMoreBtn");
  if (!loadMoreBtn) return;

  if (show) {
    loadMoreBtn.style.display = "block";
  } else {
    loadMoreBtn.style.display = "none";
  }
}

// Fungsi untuk memuat data lebih banyak (pagination)
async function loadMoreData() {
  try {
    if (!hasMoreData) return;

    const monthSelector = document.getElementById("monthSelector");
    const yearSelector = document.getElementById("yearSelector");

    if (!monthSelector || !yearSelector) return;

    const selectedMonth = parseInt(monthSelector.value);
    const selectedYear = parseInt(yearSelector.value);
    const cacheKey = `${selectedMonth}_${selectedYear}`;

    // Ambil data berikutnya dari Firestore menggunakan lastVisibleDoc
    const { leaveRequests, lastDoc, hasMore } = await getLeaveRequestsByMonth(
      selectedMonth,
      selectedYear,
      itemsPerPage,
      lastVisibleDoc
    );

    // Gabungkan data baru dengan data lama
    allCachedData = [...allCachedData, ...leaveRequests];
    currentLeaveData = [...currentLeaveData, ...leaveRequests];
    lastVisibleDoc = lastDoc;
    hasMoreData = hasMore;

    // Update cache
    reportCache.set(cacheKey, {
      data: allCachedData,
      lastDoc: lastVisibleDoc,
      hasMore: hasMoreData,
    });
    cacheTimestamps.set(cacheKey, Date.now());

    // Simpan ke localStorage
    saveReportCacheToStorage();

    // Update UI
    populateLeaveTable();
    updateSummaryCards();

    // Toggle tombol Load More
    toggleLoadMoreButton(hasMoreData);
  } catch (error) {
    console.error("Error loading more data:", error);
  }
}

// Fungsi untuk mengisi tabel izin dengan data currentLeaveData
function populateLeaveTable() {
  const tableBody = document.getElementById("leaveTableBody");
  if (!tableBody) return;

  tableBody.innerHTML = "";

  currentLeaveData.forEach((leave) => {
    const row = document.createElement("tr");

    // Contoh kolom: tanggal, nama karyawan, jenis izin, status
    const dateCell = document.createElement("td");
    dateCell.textContent = new Date(leave.date).toLocaleDateString("id-ID");
    row.appendChild(dateCell);

    const employeeCell = document.createElement("td");
    employeeCell.textContent = leave.employeeName || "-";
    row.appendChild(employeeCell);

    const typeCell = document.createElement("td");
    typeCell.textContent = leave.type || "-";
    row.appendChild(typeCell);

    const statusCell = document.createElement("td");
    statusCell.textContent = leave.status || "-";
    row.appendChild(statusCell);

    tableBody.appendChild(row);
  });
}

// Fungsi untuk update summary cards (contoh: total izin, izin disetujui, dll)
function updateSummaryCards() {
  const totalCard = document.getElementById("totalLeaves");
  const approvedCard = document.getElementById("approvedLeaves");
  const pendingCard = document.getElementById("pendingLeaves");

  if (!totalCard || !approvedCard || !pendingCard) return;

  const total = allCachedData.length;
  const approved = allCachedData.filter((item) => item.status === "approved").length;
  const pending = allCachedData.filter((item) => item.status === "pending").length;

  totalCard.textContent = total;
  approvedCard.textContent = approved;
  pendingCard.textContent = pending;
}

// Fungsi setup event listeners untuk UI controls
function setupEventListeners() {
  const monthSelector = document.getElementById("monthSelector");
  const yearSelector = document.getElementById("yearSelector");
  const loadMoreBtn = document.getElementById("loadMoreBtn");

  if (monthSelector) {
    monthSelector.addEventListener("change", () => {
      lastVisibleDoc = null;
      hasMoreData = false;
      generateReport();
      setupRealtimeListener();
    });
  }

  if (yearSelector) {
    yearSelector.addEventListener("change", () => {
      lastVisibleDoc = null;
      hasMoreData = false;
      generateReport();
      setupRealtimeListener();
    });
  }

  if (loadMoreBtn) {
    loadMoreBtn.addEventListener("click", () => {
      loadMoreData();
    });
  }
}

// Fungsi setup year selector dengan rentang tahun tertentu
function setupYearSelector() {
  const yearSelector = document.getElementById("yearSelector");
  if (!yearSelector) return;

  const currentYear = new Date().getFullYear();
  const startYear = currentYear - 5;
  const endYear = currentYear + 5;

  for (let year = startYear; year <= endYear; year++) {
    const option = document.createElement("option");
    option.value = year;
    option.textContent = year;
    yearSelector.appendChild(option);
  }
}

// Fungsi set default bulan dan tahun ke bulan dan tahun sekarang
function setDefaultMonthAndYear() {
  const monthSelector = document.getElementById("monthSelector");
  const yearSelector = document.getElementById("yearSelector");

  if (monthSelector) {
    monthSelector.value = new Date().getMonth() + 1; // getMonth() 0-based
  }
  if (yearSelector) {
    yearSelector.value = new Date().getFullYear();
  }
}