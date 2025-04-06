import { getAttendanceByDateRange, deleteAttendanceByDateRange } from "../services/report-service.js";
import { attendanceCache, shouldUpdateCache, updateCacheTimestamp } from "../services/attendance-service.js"; // Ubah import

// Global variables
let currentAttendanceData = [];
let filteredData = [];
let currentPage = 1;
const itemsPerPage = 20;
let attendanceDataCache = new Map(); // Cache untuk laporan kehadiran
let attendanceDataCacheMeta = new Map(); // Metadata untuk cache laporan
let lastVisibleDoc = null;
let hasMoreData = false;

// Fungsi untuk memeriksa apakah cache perlu diperbarui (lebih dari 1 jam)
function shouldUpdateReportCache(cacheKey) {
  if (!attendanceDataCacheMeta.has(cacheKey)) return true;
  
  const lastUpdate = attendanceDataCacheMeta.get(cacheKey);
  const now = Date.now();
  const oneHour = 60 * 60 * 1000; // 1 jam dalam milidetik
  
  return (now - lastUpdate) > oneHour;
}

// Fungsi untuk memperbarui timestamp cache
function updateReportCacheTimestamp(cacheKey) {
  attendanceDataCacheMeta.set(cacheKey, Date.now());
}

// Initialize page
document.addEventListener("DOMContentLoaded", () => {
  // Toggle sidebar collapse
  const menuToggle = document.querySelector(".menu-toggle");
  const appContainer = document.querySelector(".app-container");

  if (menuToggle) {
    menuToggle.addEventListener("click", function () {
      appContainer.classList.toggle("sidebar-collapsed");
    });
  }

  // Vanilla JS dropdown toggle
  const dropdownToggles = document.querySelectorAll('.sidebar .nav-link[data-bs-toggle="collapse"]');

  dropdownToggles.forEach((toggle) => {
    toggle.addEventListener("click", function (e) {
      e.preventDefault();

      const targetId = this.getAttribute("data-bs-target") || this.getAttribute("href");
      const target = document.querySelector(targetId);

      // If sidebar is not collapsed, implement accordion behavior
      if (!appContainer.classList.contains("sidebar-collapsed")) {
        // Close all other dropdowns
        dropdownToggles.forEach((otherToggle) => {
          if (otherToggle !== toggle) {
            const otherId = otherToggle.getAttribute("data-bs-target") || otherToggle.getAttribute("href");
            const other = document.querySelector(otherId);

            if (other && other.classList.contains("show")) {
              other.classList.remove("show");
              otherToggle.classList.add("collapsed");
              otherToggle.setAttribute("aria-expanded", "false");
            }
          }
        });
      }

      // Toggle this dropdown
      if (target) {
        if (target.classList.contains("show")) {
          target.classList.remove("show");
          toggle.classList.add("collapsed");
          toggle.setAttribute("aria-expanded", "false");
        } else {
          target.classList.add("show");
          toggle.classList.remove("collapsed");
          toggle.setAttribute("aria-expanded", "true");
        }
      }
    });
  });

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
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const formattedDate = `${year}-${month}-${day}`;
    
    console.log(`Setting date picker to: ${formattedDate}`); // Debugging
    startDateInput.value = formattedDate;
  }
  
  if (endDateInput) {
    // Format tanggal untuk input date (YYYY-MM-DD)
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const formattedDate = `${year}-${month}-${day}`;
    
    endDateInput.value = formattedDate;
  }
}

// Setup event listeners
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
    console.log("Delete button found, attaching event listener");
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
    console.log("Confirm delete button found, attaching event listener");
    confirmDeleteBtn.addEventListener("click", function() {
      console.log("Confirm delete button clicked");
      deleteAttendanceData();
    });
  } else {
    console.error("Confirm delete button not found");
  }
  
  // Filter buttons
  document.querySelectorAll("[data-shift-filter]").forEach((item) => {
    item.addEventListener("click", function (e) {
      e.preventDefault();
      const filter = this.dataset.shiftFilter;
      filterAttendanceData("shift", filter);
    });
  });
  
  document.querySelectorAll("[data-status-filter]").forEach((item) => {
    item.addEventListener("click", function (e) {
      e.preventDefault();
      const filter = this.dataset.statusFilter;
      filterAttendanceData("status", filter);
    });
  });
  
  document.querySelectorAll("[data-employee-filter]").forEach((item) => {
    item.addEventListener("click", function (e) {
      e.preventDefault();
      const filter = this.dataset.employeeFilter;
      filterAttendanceData("type", filter);
    });
  });
  
  // Search input
  const searchInput = document.getElementById("searchInput");
  const searchBtn = document.getElementById("searchBtn");
  
  if (searchInput && searchBtn) {
    searchBtn.addEventListener("click", function() {
      searchAttendance(searchInput.value);
    });
    
    searchInput.addEventListener("keyup", function(e) {
      if (e.key === "Enter") {
        searchAttendance(this.value);
      }
    });
  }
  
  // Pagination buttons
  const prevPageBtn = document.getElementById("prevPage");
  const nextPageBtn = document.getElementById("nextPage");
  
  if (prevPageBtn) {
    prevPageBtn.addEventListener("click", function() {
      if (currentPage > 1) {
        currentPage--;
        displayCurrentPage();
      }
    });
  }
  
  if (nextPageBtn) {
    nextPageBtn.addEventListener("click", function() {
      if (currentPage < getTotalPages()) {
        currentPage++;
        displayCurrentPage();
      }
    });
  }
  
  // Load more button
  const loadMoreBtn = document.getElementById("loadMoreBtn");
  if (loadMoreBtn) {
    loadMoreBtn.addEventListener("click", loadMoreData);
  }
}

// Fungsi untuk menyembunyikan tombol aksi (export dan hapus)
function hideActionButtons() {
  const actionButtons = document.getElementById("actionButtons");
  if (actionButtons) {
    actionButtons.style.display = "none";
  }
}

// Fungsi untuk menampilkan tombol aksi (export dan hapus)
function showActionButtons() {
  const actionButtons = document.getElementById("actionButtons");
  if (actionButtons) {
    actionButtons.style.display = "flex";
  }
}

// Generate report based on selected date range
async function generateReport() {
  try {
    const startDateEl = document.getElementById("startDate");
    const endDateEl = document.getElementById("endDate");
    
    if (!startDateEl || !endDateEl) {
      console.error("Start date or end date element not found");
      return;
    }
    
    const startDate = startDateEl.value;
    const endDate = endDateEl.value;
    
    if (!startDate || !endDate) {
      showAlert("warning", "Mohon pilih tanggal mulai dan tanggal akhir");
      return;
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
    
    // Create cache key
    const cacheKey = `${startDate}_${endDate}`;
    
    // Reset pagination variables
    currentPage = 1;
    lastVisibleDoc = null;
    hasMoreData = false;
    
    // Show loading state
    showAlert("info", '<i class="fas fa-spinner fa-spin me-2"></i> Memuat data kehadiran...', false);
    
    let attendanceData;
    
    // Check if data is in cache and still valid (less than 1 hour old)
    if (attendanceDataCache.has(cacheKey) && !shouldUpdateReportCache(cacheKey)) {
      attendanceData = attendanceDataCache.get(cacheKey);
      console.log("Using cached attendance report data (less than 1 hour old)");
      
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
            attendanceData.push(...dayData);
          }
        }
        console.log("Using sistem-absensi cache for report (less than 1 hour old)");
      } else {
        // Fetch from Firestore with pagination
        const result = await getAttendanceByDateRange(startDate, endDate, null, itemsPerPage);
        attendanceData = result.attendanceRecords;
        lastVisibleDoc = result.lastDoc;
        hasMoreData = result.hasMore;
        
        // Store in cache with timestamp
        attendanceDataCache.set(cacheKey, [...attendanceData]);
        updateReportCacheTimestamp(cacheKey);
        
        // Limit cache size (keep max 5 reports)
        if (attendanceDataCache.size > 5) {
          const oldestKey = Array.from(attendanceDataCache.keys())[0];
          attendanceDataCache.delete(oldestKey);
          attendanceDataCacheMeta.delete(oldestKey);
        }
      }
      
      // Hide loading message
      hideAlert();
    }
    
    // Update global data
    currentAttendanceData = attendanceData;
    filteredData = [...attendanceData];
    
    // Get leave count for the date range
    const leaveCount = await getLeaveCountByDateRange(startDate, endDate);
    
    // Store leave count in a global variable for use in updateSummaryCards
    window.currentLeaveCount = leaveCount;
    
    // Update UI
    if (attendanceData.length > 0) {
      updateSummaryCards();
      displayCurrentPage();
      showReportElements();
      
      // Tampilkan tombol export dan hapus data setelah laporan di-generate
      showActionButtons();
      
      // Show/hide load more button
      const loadMoreContainer = document.getElementById("loadMoreContainer");
      if (loadMoreContainer) {
        loadMoreContainer.style.display = hasMoreData ? "block" : "none";
      }
    } else {
      hideReportElements();
      // Pastikan tombol aksi tetap tersembunyi jika tidak ada data
      hideActionButtons();
      const noDataMessage = document.getElementById("noDataMessage");
      if (noDataMessage) noDataMessage.style.display = "block";
    }
    
    // Update delete confirmation modal with date range
    const deleteStartDateEl = document.getElementById("deleteStartDate");
    const deleteEndDateEl = document.getElementById("deleteEndDate");
    
    if (deleteStartDateEl) deleteStartDateEl.textContent = formatDateForDisplay(startDate);
    if (deleteEndDateEl) deleteEndDateEl.textContent = formatDateForDisplay(endDate);
    
  } catch (error) {
    console.error("Error generating report:", error);
    showAlert("danger", `<i class="fas fa-exclamation-circle me-2"></i> Terjadi kesalahan: ${error.message}`);
     // Pastikan tombol aksi tersembunyi jika terjadi error
     hideActionButtons();
  }
}

// Load more data (pagination)
async function loadMoreData() {
  if (!hasMoreData || !lastVisibleDoc) return;
  
  try {
    const startDate = document.getElementById("startDate").value;
    const endDate = document.getElementById("endDate").value;
    
    // Show loading state on button
    const loadMoreBtn = document.getElementById("loadMoreBtn");
    if (loadMoreBtn) {
      loadMoreBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i> Memuat...';
      loadMoreBtn.disabled = true;
    }
    
    // Fetch next batch
    const result = await getAttendanceByDateRange(startDate, endDate, lastVisibleDoc, itemsPerPage);
    
      // Update pagination variables
      const newData = result.attendanceRecords;
      lastVisibleDoc = result.lastDoc;
      hasMoreData = result.hasMore;
      
      // Append to current data
      currentAttendanceData = [...currentAttendanceData, ...newData];
      filteredData = [...filteredData, ...newData];
      
      // Update cache
      const cacheKey = `${startDate}_${endDate}`;
      if (attendanceDataCache.has(cacheKey)) {
        attendanceDataCache.set(cacheKey, [...currentAttendanceData]);
        updateReportCacheTimestamp(cacheKey);
      }
      
      // Update UI
      updateSummaryCards();
      displayCurrentPage();
      
      // Reset button state
      if (loadMoreBtn) {
        loadMoreBtn.innerHTML = '<i class="fas fa-plus me-2"></i> Muat Lebih Banyak';
        loadMoreBtn.disabled = false;
        
        // Show/hide load more button
        const loadMoreContainer = document.getElementById("loadMoreContainer");
        if (loadMoreContainer) {
          loadMoreContainer.style.display = hasMoreData ? "block" : "none";
        }
      }
      
    } catch (error) {
      console.error("Error loading more data:", error);
      showAlert("danger", `<i class="fas fa-exclamation-circle me-2"></i> Gagal memuat data tambahan: ${error.message}`);
      
      // Reset button state
      const loadMoreBtn = document.getElementById("loadMoreBtn");
      if (loadMoreBtn) {
        loadMoreBtn.innerHTML = '<i class="fas fa-plus me-2"></i> Muat Lebih Banyak';
        loadMoreBtn.disabled = false;
      }
    }
  }
  
  // Fungsi untuk mengambil data izin berdasarkan rentang tanggal
  async function getLeaveCountByDateRange(startDate, endDate) {
    try {
      // Cek apakah data izin ada di cache dan masih valid
      const cacheKey = `leave_${startDate}_${endDate}`;
      if (attendanceDataCacheMeta.has(cacheKey) && !shouldUpdateReportCache(cacheKey)) {
        console.log("Using cached leave count data");
        return JSON.parse(localStorage.getItem(cacheKey) || "0");
      }
      
      // Import fungsi dari report-service.js
      const { getLeaveRequestsByMonth } = await import("../services/report-service.js");
      
      // Konversi string tanggal ke objek Date
      const start = new Date(startDate);
      const end = new Date(endDate);
      
      // Hitung bulan dan tahun untuk rentang tanggal
      const startMonth = start.getMonth() + 1; // getMonth() returns 0-11
      const startYear = start.getFullYear();
      const endMonth = end.getMonth() + 1;
      const endYear = end.getFullYear();
      
      let totalLeaveCount = 0;
      
      // Jika rentang tanggal dalam bulan yang sama
      if (startMonth === endMonth && startYear === endYear) {
        const result = await getLeaveRequestsByMonth(startMonth, startYear);
        totalLeaveCount = result.leaveRequests.length;
      } else {
        // Jika rentang tanggal mencakup beberapa bulan
        for (let year = startYear; year <= endYear; year++) {
          const monthStart = (year === startYear) ? startMonth : 1;
          const monthEnd = (year === endYear) ? endMonth : 12;
          
          for (let month = monthStart; month <= monthEnd; month++) {
            const result = await getLeaveRequestsByMonth(month, year);
            totalLeaveCount += result.leaveRequests.length;
          }
        }
      }
      
      // Simpan di localStorage dengan timestamp
      localStorage.setItem(cacheKey, totalLeaveCount.toString());
      updateReportCacheTimestamp(cacheKey);
      
      return totalLeaveCount;
    } catch (error) {
      console.error("Error getting leave count:", error);
      return 0;
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
    showAlert(
      "success", 
      `<i class="fas fa-check-circle me-2"></i> Berhasil menghapus ${deletedCount} data kehadiran`
    );
    
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
    showAlert(
      "danger",
      `<i class="fas fa-exclamation-circle me-2"></i> Gagal menghapus data: ${error.message}`
    );
    
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
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  
  console.log(`Converting date ${date} to: ${year}-${month}-${day}`); // Debugging
  
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
  
  const paginationContainer = document.getElementById("paginationContainer");
  if (paginationContainer) paginationContainer.style.display = "flex";
  
  const noDataMessage = document.getElementById("noDataMessage");
  if (noDataMessage) noDataMessage.style.display = "none";
  
  // Show load more button if there's more data
  const loadMoreContainer = document.getElementById("loadMoreContainer");
  if (loadMoreContainer) {
    loadMoreContainer.style.display = hasMoreData ? "block" : "none";
  }
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
  
  const paginationContainer = document.getElementById("paginationContainer");
  if (paginationContainer) paginationContainer.style.display = "none";
  
  // Hide load more button
  const loadMoreContainer = document.getElementById("loadMoreContainer");
  if (loadMoreContainer) {
    loadMoreContainer.style.display = "none";
  }
}

// Update summary cards
function updateSummaryCards() {
  const totalAttendance = filteredData.length;
  const onTimeCount = filteredData.filter(record => record.status === "Tepat Waktu").length;
  const lateCount = filteredData.filter(record => record.status === "Terlambat").length;
  
  // Gunakan data izin yang telah diambil sebelumnya
  const leaveCount = window.currentLeaveCount || 0;
  
  // Update UI with null checks
  const totalAttendanceEl = document.getElementById("totalAttendance");
  if (totalAttendanceEl) totalAttendanceEl.textContent = totalAttendance;
  
  const onTimeCountEl = document.getElementById("onTimeCount");
  if (onTimeCountEl) onTimeCountEl.textContent = onTimeCount;
  
  const lateCountEl = document.getElementById("lateCount");
  if (lateCountEl) lateCountEl.textContent = lateCount;
  
  const leaveCountEl = document.getElementById("leaveCount");
  if (leaveCountEl) leaveCountEl.textContent = leaveCount;
}

// Display current page of data
function displayCurrentPage() {
  const tbody = document.getElementById("attendanceReportList");
  if (!tbody) return;
  
  // Clear existing rows
  tbody.innerHTML = "";
  
  // Calculate start and end index for current page
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, filteredData.length);
  
  // Create document fragment for better performance
  const fragment = document.createDocumentFragment();
  
  // Add rows for current page
  for (let i = startIndex; i < endIndex; i++) {
    const record = filteredData[i];
    
    // Log data untuk debugging
    console.log(`Displaying record ${i+1}:`, {
      date: record.date,
      name: record.name,
      timeIn: record.timeIn
    });
    
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
    
    // PERBAIKAN: Gunakan tanggal dari timeIn jika tersedia
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
  }
  
  tbody.appendChild(fragment);
  
  // Update pagination info
  updatePaginationInfo();
}



// Update pagination info
function updatePaginationInfo() {
  const paginationInfo = document.getElementById("paginationInfo");
  const totalPages = getTotalPages();
  
  if (paginationInfo) {
    paginationInfo.textContent = `Halaman ${currentPage} dari ${totalPages}`;
  }
  
  // Enable/disable pagination buttons
  const prevPageBtn = document.getElementById("prevPage");
  const nextPageBtn = document.getElementById("nextPage");
  
  if (prevPageBtn) {
    prevPageBtn.disabled = currentPage <= 1;
  }
  
  if (nextPageBtn) {
    nextPageBtn.disabled = currentPage >= totalPages;
  }
}

// Get total pages
function getTotalPages() {
  return Math.ceil(filteredData.length / itemsPerPage);
}

// Filter attendance data
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
  
  // Reset to first page
  currentPage = 1;
  
  // Update UI
  updateSummaryCards();
  displayCurrentPage();
  
  // Update dropdown button text
  if (filterType === "shift") {
    let buttonText = "Semua Shift";
    if (value === "morning") buttonText = "Shift Pagi";
    else if (value === "afternoon") buttonText = "Shift Sore";
    
    document.getElementById("shiftFilterDropdown").innerHTML = `<i class="fas fa-filter"></i> ${buttonText}`;
  } else if (filterType === "status") {
    let buttonText = "Semua Status";
    if (value === "ontime") buttonText = "Tepat Waktu";
    else if (value === "late") buttonText = "Terlambat";
    
    document.getElementById("statusFilterDropdown").innerHTML = `<i class="fas fa-filter"></i> ${buttonText}`;
  } else if (filterType === "type") {
    let buttonText = "Semua Karyawan";
    if (value === "staff") buttonText = "Staff";
    else if (value === "ob") buttonText = "Office Boy";
    
    document.getElementById("employeeFilterDropdown").innerHTML = `<i class="fas fa-filter"></i> ${buttonText}`;
  }
}

// Search attendance by employee ID or name
function searchAttendance(query) {
  if (!query.trim()) {
    // Reset search
    filteredData = [...currentAttendanceData];
  } else {
    const searchTerm = query.toLowerCase().trim();
    filteredData = currentAttendanceData.filter(record => 
      (record.employeeId && record.employeeId.toLowerCase().includes(searchTerm)) ||
      (record.name && record.name.toLowerCase().includes(searchTerm))
    );
  }
  
  // Reset to first page
  currentPage = 1;
  
  // Update UI
  updateSummaryCards();
  displayCurrentPage();
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
    const printDate = `Dicetak pada: ${new Date().toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })}`;
    
    // Create worksheet with headers and data
    const wsData = [
      [title], // Title row
      [dateRange], // Date range row
      [printDate], // Print date row
      [], // Empty row for spacing
      [
        "No", "ID Karyawan", "Nama", "Tanggal", "Tipe Karyawan", "Shift", 
        "Jam Masuk", "Jam Keluar", "Durasi Kerja", "Status"
      ] // Header row
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
        record.status + (record.lateMinutes ? ` (${record.lateMinutes} menit)` : "")
      ]);
    });
    
    // Create worksheet
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    
    // Set column widths
    const colWidths = [
      { wch: 5 },  // No
      { wch: 10 }, // ID Karyawan
      { wch: 20 }, // Nama
      { wch: 15 }, // Tanggal
      { wch: 15 }, // Tipe Karyawan
      { wch: 10 }, // Shift
      { wch: 10 }, // Jam Masuk
      { wch: 10 }, // Jam Keluar
      { wch: 15 }, // Durasi Kerja
      { wch: 20 }  // Status
    ];
    ws['!cols'] = colWidths;
    
    // Merge cells for title and info rows
    ws['!merges'] = [
      // Merge cells for title (A1:J1)
      { s: { r: 0, c: 0 }, e: { r: 0, c: 9 } },
      // Merge cells for date range (A2:J2)
      { s: { r: 1, c: 0 }, e: { r: 1, c: 9 } },
      // Merge cells for print date (A3:J3)
      { s: { r: 2, c: 0 }, e: { r: 2, c: 9 } }
    ];
    
    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(wb, ws, "Laporan Kehadiran");
    
    // Generate filename
    const fileName = `Laporan_Kehadiran_${formatDateForFilename(startDate)}_${formatDateForFilename(endDate)}.xlsx`;
    
    // Export file
    XLSX.writeFile(wb, fileName);
    
    showAlert(
      "success", 
      `<i class="fas fa-check-circle me-2"></i> Berhasil mengekspor data ke Excel`
    );
    
  } catch (error) {
    console.error("Error exporting to Excel:", error);
    showAlert(
      "danger",
      `<i class="fas fa-exclamation-circle me-2"></i> Gagal mengekspor data: ${error.message}`
    );
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
    const doc = new jsPDF('l', 'mm', 'a4'); // landscape orientation
    
    // Add title
    doc.setFontSize(16);
    doc.text(`Laporan Kehadiran Karyawan`, 14, 15);
    
    // Add subtitle with date range
    doc.setFontSize(12);
    doc.text(`Periode: ${formatDateForDisplay(startDate)} - ${formatDateForDisplay(endDate)}`, 14, 22);
    
    // Add subtitle with date
    doc.setFontSize(10);
    doc.text(`Dicetak pada: ${new Date().toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })}`, 14, 28);
    
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
        record.status + (record.lateMinutes ? ` (${record.lateMinutes} menit)` : "")
      ];
    });
    
    // Add table
    doc.autoTable({
      startY: 35,
      head: [['No', 'ID', 'Nama', 'Tanggal', 'Tipe', 'Shift', 'Masuk', 'Keluar', 'Status']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [41, 128, 185], textColor: 255 },
      styles: { fontSize: 8, cellPadding: 2 },
      columnStyles: {
        0: { cellWidth: 8 },
        2: { cellWidth: 30 }
      }
    });
    
    // Generate filename
    const fileName = `Laporan_Kehadiran_${formatDateForFilename(startDate)}_${formatDateForFilename(endDate)}.pdf`;
    
    // Save PDF
    doc.save(fileName);
    
    showAlert(
      "success", 
      `<i class="fas fa-check-circle me-2"></i> Berhasil mengekspor data ke PDF`
    );
    
  } catch (error) {
    console.error("Error exporting to PDF:", error);
    showAlert(
      "danger",
      `<i class="fas fa-exclamation-circle me-2"></i> Gagal mengekspor data: ${error.message}`
    );
  }
}

// Helper function to format time
function formatTime(timestamp) {
  if (!timestamp) return "-";
  
  const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
  
  return date.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit"
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
  else if (typeof dateInput === 'string' && dateInput.match(/^\d{4}-\d{2}-\d{2}$/)) {
    // Pastikan tanggal diinterpretasikan sebagai tanggal lokal, bukan UTC
    const [year, month, day] = dateInput.split('-');
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
    year: "numeric"
  });
}



// Helper function to format date for filename
function formatDateForFilename(dateString) {
  if (!dateString) return "";
  
  const date = new Date(dateString);
  
  return date.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).replace(/\//g, '-');
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
      const alert = alertContainer.querySelector('.alert');
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
    alertContainer.innerHTML = '';
    alertContainer.style.display = "none";
  }
}
  
  // Export functions
  export {
    generateReport,
    exportToExcel,
    exportToPDF,
    clearAttendanceDataCache
  };
  
