import { getLeaveRequestsByMonth, clearLeaveCache } from "../services/leave-service.js";
import { deleteLeaveRequestsByMonth } from "../services/report-service.js";
import { attendanceCache } from "../services/attendance-service.js"; // Impor dari attendance-service

// Global variables
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

  // Initialize report page
  setupYearSelector();
  setDefaultMonthAndYear();
  setupEventListeners();
});

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


// Modifikasi fungsi generateReport untuk memperbaiki filter jenis pengganti
async function generateReport(forceRefresh = false) {
  try {
    const monthSelector = document.getElementById("monthSelector");
    const yearSelector = document.getElementById("yearSelector");
    const replacementTypeFilter = document.getElementById("replacementTypeFilter");

    if (!monthSelector || !yearSelector) {
      console.error("Month or year selector not found");
      return;
    }

    const month = parseInt(monthSelector.value);
    const year = parseInt(yearSelector.value);
    const selectedReplacementType = replacementTypeFilter ? replacementTypeFilter.value : "all";

    // Buat kunci cache
    const cacheKey = `${month}_${year}`;
    
    // Cek apakah data ada di cache dan masih valid (kurang dari 1 jam)
    const now = Date.now();
    const cacheTime = cacheTimestamps.get(cacheKey) || 0;
    const cacheIsValid = now - cacheTime < CACHE_DURATION;
    
    // Gunakan cache jika tersedia dan valid, kecuali jika forceRefresh=true
    if (!forceRefresh && reportCache.has(cacheKey) && cacheIsValid) {
      console.log(`Using cached data for ${month}/${year}, age: ${(now - cacheTime) / 1000} seconds`);
      
      // Ambil data dari cache
      const cachedData = reportCache.get(cacheKey);
      currentLeaveData = cachedData.data;
      lastVisibleDoc = cachedData.lastDoc;
      hasMoreData = cachedData.hasMore;
      
      // Terapkan filter jenis pengganti jika dipilih
      if (selectedReplacementType !== "all") {
        filterByReplacementType(selectedReplacementType);
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
      
      return;
    }

    // Reset pagination variables
    lastVisibleDoc = null;
    hasMoreData = false;
    currentLeaveData = [];

    // Show loading state
    showAlert("info", '<i class="fas fa-spinner fa-spin me-2"></i> Memuat data izin...', false);

    // Fetch data with pagination
    const result = await getLeaveRequestsByMonth(month, year, null, itemsPerPage);

    // Update pagination variables
    currentLeaveData = result.leaveRequests || [];
    lastVisibleDoc = result.lastDoc;
    hasMoreData = result.hasMore;

    // Integrate with attendance data
    await integrateAttendanceData(currentLeaveData, month, year);

    // Hide alert
    hideAlert();

    // Simpan ke cache original data sebelum filter
    reportCache.set(cacheKey, {
      data: [...currentLeaveData],
      lastDoc: lastVisibleDoc,
      hasMore: hasMoreData
    });
    
    // Simpan timestamp cache
    cacheTimestamps.set(cacheKey, now);

    // Terapkan filter jenis pengganti jika dipilih
    if (selectedReplacementType !== "all") {
      filterByReplacementType(selectedReplacementType);
    }

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
  } catch (error) {
    console.error("Error generating report:", error);
    showAlert(
      "danger",
      '<i class="fas fa-exclamation-circle me-2"></i> Terjadi kesalahan saat memuat data: ' + error.message
    );
  }
}
// Tambahkan event listener untuk filter jenis pengganti
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

  // Filter by replacement status
  document.querySelectorAll("[data-replacement-filter]").forEach((item) => {
    item.addEventListener("click", function (e) {
      e.preventDefault();
      const filter = this.dataset.replacementFilter;
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
    replacementTypeFilter.addEventListener("change", function () {
      // Jika sudah ada data, langsung filter
      if (currentLeaveData && currentLeaveData.length > 0) {
        filterByReplacementType(this.value);
      }
    });
  }
}

// Integrate attendance data with leave data
async function integrateAttendanceData(leaveData, month, year) {
  try {
    // Format date range for the month
    const startDate = `${year}-${month.toString().padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${month.toString().padStart(2, '0')}-${lastDay}`;
    
    // Get attendance data for the month
    const attendanceResult = await getAttendanceByDateRange(startDate, endDate);
    const attendanceData = attendanceResult.attendanceRecords || [];
    
    // Map attendance data by employee ID and date for quick lookup
    const attendanceMap = new Map();
    
    attendanceData.forEach(record => {
      const employeeId = record.employeeId;
      const date = record.date;
      
      if (!attendanceMap.has(employeeId)) {
        attendanceMap.set(employeeId, new Map());
      }
      
      attendanceMap.get(employeeId).set(date, record);
    });
    
    // Enhance leave data with attendance information if needed
    // This is a placeholder for future integration
    // For now, we're just returning the original data
    
    return leaveData;
  } catch (error) {
    console.error("Error integrating attendance data:", error);
    return leaveData; // Return original data on error
  }
}

// Load more data (pagination)
async function loadMoreData() {
  if (!hasMoreData || !lastVisibleDoc) return;

  try {
    const month = parseInt(document.getElementById("monthSelector").value);
    const year = parseInt(document.getElementById("yearSelector").value);

       // Show loading state on the button
       const loadMoreBtn = document.getElementById("loadMoreBtn");
       if (loadMoreBtn) {
         loadMoreBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i> Memuat...';
         loadMoreBtn.disabled = true;
       }
   
       // Fetch next page of data
       const result = await getLeaveRequestsByMonth(month, year, lastVisibleDoc, itemsPerPage);
   
       // Update pagination variables
       const newData = result.leaveRequests || [];
       lastVisibleDoc = result.lastDoc;
       hasMoreData = result.hasMore;
   
       // Integrate with attendance data
       await integrateAttendanceData(newData, month, year);
   
       // Add new data to current data
       currentLeaveData = [...currentLeaveData, ...newData];
   
       // Update cache
       const cacheKey = `${month}_${year}`;
       if (reportCache.has(cacheKey)) {
         reportCache.set(cacheKey, {
           data: currentLeaveData,
           lastDoc: lastVisibleDoc,
           hasMore: hasMoreData
         });
         
         // Update timestamp
         cacheTimestamps.set(cacheKey, Date.now());
       }
   
       // Update UI
       populateLeaveTable();
       updateSummaryCards();
   
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
       showAlert("danger", "Terjadi kesalahan saat memuat data tambahan: " + error.message);
   
       // Reset load more button
       const loadMoreBtn = document.getElementById("loadMoreBtn");
       if (loadMoreBtn) {
         loadMoreBtn.innerHTML = '<i class="fas fa-plus me-2"></i> Muat Lebih Banyak';
         loadMoreBtn.disabled = false;
       }
     }
   }
   
   // Update summary cards with statistics
   function updateSummaryCards() {
     try {
       // Total leave requests
       const totalLeaves = document.getElementById("totalLeaves");
       if (totalLeaves) {
         totalLeaves.textContent = currentLeaveData.length;
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
      const isMultiDay = leave.leaveStartDate && leave.leaveEndDate && 
                        leave.leaveStartDate !== leave.leaveEndDate;

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
        
        // Cek apakah izin sakit dengan surat keterangan
        if (leave.leaveType === "sakit" && 
            leave.replacementDetails && 
            leave.replacementDetails.hasMedicalCertificate) {
          // Jika ada surat keterangan sakit
          replacementType = "Ada Surat DC";
          replacementInfo = "Tidak perlu diganti";
        } else {
          // Untuk jenis izin lainnya
          if (leave.replacementType === "libur") {
            replacementType = "Ganti Libur";
            if (leave.replacementDetails && leave.replacementDetails.formattedDate) {
              replacementInfo = `${leave.replacementDetails.formattedDate}`;
            } else if (leave.replacementDetails && leave.replacementDetails.dates && leave.replacementDetails.dates.length > 0) {
              replacementInfo = leave.replacementDetails.dates.map(d => d.formattedDate).join(", ");
            }
          } else if (leave.replacementType === "jam") {
            replacementType = "Ganti Jam";
            if (leave.replacementDetails && leave.replacementDetails.hours && leave.replacementDetails.formattedDate) {
              replacementInfo = `${leave.replacementDetails.hours} jam pada ${leave.replacementDetails.formattedDate}`;
            }
          } else if (leave.replacementType === "tidak") {
            replacementType = "Tidak Perlu Diganti";
          }
        }

        // Determine status classes
        const statusClass = getStatusClass(leave.status);
        const replacementStatusClass = getReplacementStatusClass(leave.replacementStatus);

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
        // Untuk izin multi-hari, buat baris untuk setiap hari
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
        const replacementStatusArray = leave.replacementStatusArray || Array(dayDiff).fill("Belum Diganti");

        // Format replacement type
        let replacementType = "-";
        let baseReplacementInfo = "-";
        
        // Cek apakah izin sakit dengan surat keterangan
        if (leave.leaveType === "sakit" && 
            leave.replacementDetails && 
            leave.replacementDetails.hasMedicalCertificate) {
          // Jika ada surat keterangan sakit
          replacementType = "Ada Surat DC";
          baseReplacementInfo = "Tidak perlu diganti";
        } else {
          // Untuk jenis izin lainnya
          if (leave.replacementType === "libur") {
            replacementType = "Ganti Libur";
          } else if (leave.replacementType === "jam") {
            replacementType = "Ganti Jam";
          } else if (leave.replacementType === "tidak") {
            replacementType = "Tidak Perlu Diganti";
          }
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
          
          // Jika bukan izin sakit dengan surat DC, cek detail pengganti
          if (!(leave.leaveType === "sakit" && 
                leave.replacementDetails && 
                leave.replacementDetails.hasMedicalCertificate)) {
            if (leave.replacementType === "libur" && leave.replacementDetails && leave.replacementDetails.dates) {
              // Jika ada tanggal pengganti spesifik untuk hari ini
              if (leave.replacementDetails.dates[i]) {
                replacementInfo = `${leave.replacementDetails.dates[i].formattedDate}`;
              }
            } else if (leave.replacementType === "jam" && leave.replacementDetails) {
              replacementInfo = `${leave.replacementDetails.hours} jam pada ${leave.replacementDetails.formattedDate}`;
            }
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
       return "bg-success";
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
   
// Filter leave data by status or replacement status
function filterLeaveData(type, filter) {
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
    } else {
      originalData = [...currentLeaveData];
    }

    if (filter === "all") {
      // Reset to original data
      currentLeaveData = [...originalData];
    } else if (type === "status") {
      // Filter by status
      currentLeaveData = originalData.filter((leave) => {
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
      // Filter by replacement status
      currentLeaveData = originalData.filter((leave) => {
        // Check if it's a multi-day leave
        const isMultiDay = leave.leaveStartDate && leave.leaveEndDate && 
                          leave.leaveStartDate !== leave.leaveEndDate;
        
        if (isMultiDay && leave.replacementStatusArray) {
          // For multi-day, check if any day matches the filter
          if (filter === "sudah") {
            return leave.replacementStatusArray.some(s => s === "Sudah Diganti");
          } else if (filter === "belum") {
            return leave.replacementStatusArray.some(s => s === "Belum Diganti" || !s);
          }
        } else {
          // For single-day, check replacementStatus
          const status = leave.replacementStatus ? leave.replacementStatus.toLowerCase() : "";
          if (filter === "sudah") {
            return status === "sudah diganti";
          } else if (filter === "belum") {
            return status === "belum diganti" || status === "";
          }
        }
        return true;
      });
    }

    // Update UI
    populateLeaveTable();
    updateSummaryCards();
  } catch (error) {
    console.error("Error filtering leave data:", error);
    showAlert("danger", "Terjadi kesalahan saat memfilter data: " + error.message);
  }
}

   
   // Filter by replacement type - perbaikan fungsi ini
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
    } else {
      originalData = [...currentLeaveData];
    }

    if (type === "all") {
      // Reset to original data
      currentLeaveData = [...originalData];
    } else if (type === "libur") {
      // Filter izin dengan ganti libur
      currentLeaveData = originalData.filter((leave) => {
        return leave.replacementType === "libur";
      });
    } else if (type === "jam") {
      // Filter izin dengan ganti jam
      currentLeaveData = originalData.filter((leave) => {
        return leave.replacementType === "jam";
      });
    }

    // Update UI
    populateLeaveTable();
    updateSummaryCards();
  } catch (error) {
    console.error("Error filtering by replacement type:", error);
    showAlert("danger", "Terjadi kesalahan saat memfilter data: " + error.message);
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
    if (!currentLeaveData || currentLeaveData.length === 0) {
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
    currentLeaveData.forEach((leave) => {
      // Periksa apakah izin multi-hari
      const isMultiDay = leave.leaveStartDate && leave.leaveEndDate && 
                        leave.leaveStartDate !== leave.leaveEndDate;

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
        
        // Cek apakah izin sakit dengan surat keterangan
        if (leave.leaveType === "sakit" && 
            leave.replacementDetails && 
            leave.replacementDetails.hasMedicalCertificate) {
          // Jika ada surat keterangan sakit
          replacementType = "Ada Surat DC";
          replacementInfo = "Tidak perlu diganti";
        } else {
          // Untuk jenis izin lainnya
          if (leave.replacementType === "libur") {
            replacementType = "Ganti Libur";
            if (leave.replacementDetails && leave.replacementDetails.formattedDate) {
              replacementInfo = `${leave.replacementDetails.formattedDate}`;
            } else if (leave.replacementDetails && leave.replacementDetails.dates && leave.replacementDetails.dates.length > 0) {
              replacementInfo = leave.replacementDetails.dates.map(d => d.formattedDate).join(", ");
            }
          } else if (leave.replacementType === "jam") {
            replacementType = "Ganti Jam";
            if (leave.replacementDetails && leave.replacementDetails.hours && leave.replacementDetails.formattedDate) {
              replacementInfo = `${leave.replacementDetails.hours} jam pada ${leave.replacementDetails.formattedDate}`;
            }
          } else if (leave.replacementType === "tidak") {
            replacementType = "Tidak Perlu Diganti";
          }
        }

        exportData.push({
          "No": rowNumber,
          "ID Karyawan": leave.employeeId || "-",
          "Nama": leave.name || "-",
          "Tanggal Izin": leaveDate,
          "Alasan": leave.reason || "-",
          "Jenis Pengganti": replacementType,
          "Detail Pengganti": replacementInfo,
          "Status": leave.status || "Pending",
          "Status Pengganti": leave.replacementStatus || "Belum Diganti",
        });
        
        rowNumber++;
      } else {
        // Untuk izin multi-hari
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
        const replacementStatusArray = leave.replacementStatusArray || Array(dayDiff).fill("Belum Diganti");

        // Format replacement type
        let replacementType = "-";
        let baseReplacementInfo = "-";
        
        // Cek apakah izin sakit dengan surat keterangan
        if (leave.leaveType === "sakit" && 
            leave.replacementDetails && 
            leave.replacementDetails.hasMedicalCertificate) {
          // Jika ada surat keterangan sakit
          replacementType = "Ada Surat DC";
          baseReplacementInfo = "Tidak perlu diganti";
        } else {
          // Untuk jenis izin lainnya
          if (leave.replacementType === "libur") {
            replacementType = "Ganti Libur";
          } else if (leave.replacementType === "jam") {
            replacementType = "Ganti Jam";
          } else if (leave.replacementType === "tidak") {
            replacementType = "Tidak Perlu Diganti";
          }
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
          
          // Jika bukan izin sakit dengan surat DC, cek detail pengganti
          if (!(leave.leaveType === "sakit" && 
                leave.replacementDetails && 
                leave.replacementDetails.hasMedicalCertificate)) {
            if (leave.replacementType === "libur" && leave.replacementDetails && leave.replacementDetails.dates) {
              // Jika ada tanggal pengganti spesifik untuk hari ini
              if (leave.replacementDetails.dates[i]) {
                replacementInfo = `${leave.replacementDetails.dates[i].formattedDate}`;
              }
            } else if (leave.replacementType === "jam" && leave.replacementDetails) {
              replacementInfo = `${leave.replacementDetails.hours} jam pada ${leave.replacementDetails.formattedDate}`;
            }
          }

          exportData.push({
            "No": `${currentRowNumber} (${i + 1}/${dayDiff})`,
            "ID Karyawan": leave.employeeId || "-",
            "Nama": leave.name || "-",
            "Tanggal Izin": formattedDate,
            "Alasan": leave.reason || "-",
            "Jenis Pengganti": replacementType,
            "Detail Pengganti": replacementInfo,
            "Status": leave.status || "Pending",
            "Status Pengganti": dayStatus,
          });
        }
        
        // Increment row number only once after all days of multi-day leave
        rowNumber++;
      }
    });

    // Create worksheet
    const ws = XLSX.utils.json_to_sheet(exportData);

    // Add title to the worksheet (merge cells A1:I1)
    ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 8 } }];
    
    // Insert title row at the top
    XLSX.utils.sheet_add_aoa(ws, [
      [`Laporan Izin Staff Melati Gold Shop Periode ${monthName} ${year}`]
    ], { origin: 'A1' });
    
    // Style the title (bold and centered)
    if (!ws['!cols']) ws['!cols'] = [];
    ws['!cols'][0] = { wch: 10 }; // No column
    ws['!cols'][1] = { wch: 15 }; // ID Karyawan
    ws['!cols'][2] = { wch: 25 }; // Nama
    ws['!cols'][3] = { wch: 25 }; // Tanggal Izin
    ws['!cols'][4] = { wch: 30 }; // Alasan
    ws['!cols'][5] = { wch: 20 }; // Jenis Pengganti
    ws['!cols'][6] = { wch: 30 }; // Detail Pengganti
    ws['!cols'][7] = { wch: 15 }; // Status
    ws['!cols'][8] = { wch: 15 }; // Status Pengganti

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(wb, ws, "Laporan Izin");

    // Generate Excel file
    const fileName = `Laporan_Izin_${monthName}_${year}.xlsx`;
    XLSX.writeFile(wb, fileName);

    showAlert("success", `Berhasil mengekspor data ke ${fileName}`);
  } catch (error) {
    console.error("Error exporting to Excel:", error);
    showAlert("danger", "Terjadi kesalahan saat mengekspor ke Excel: " + error.message);
  }
}
    
   // Export to PDF - update untuk mendukung format baru
function exportToPDF() {
  try {
    if (!currentLeaveData || currentLeaveData.length === 0) {
      showAlert("warning", "Tidak ada data untuk diekspor");
      return;
    }

    const month = parseInt(document.getElementById("monthSelector").value);
    const year = parseInt(document.getElementById("yearSelector").value);
    const monthName = monthNames[month - 1];

    // Create a new jsPDF instance
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('l', 'mm', 'a4'); // Landscape orientation for more space

    // Add title
    doc.setFontSize(16);
    doc.setFont(undefined, 'bold');
    doc.text(`Laporan Izin Staff Melati Gold Shop`, doc.internal.pageSize.getWidth() / 2, 15, { align: 'center' });
    doc.text(`Periode ${monthName} ${year}`, doc.internal.pageSize.getWidth() / 2, 22, { align: 'center' });
    doc.setFont(undefined, 'normal');

    // Prepare table data
    const tableColumn = ["No", "ID Karyawan", "Nama", "Tanggal Izin", "Alasan", "Jenis Pengganti", "Detail Pengganti", "Status", "Status Pengganti"];
    const tableRows = [];

    // Counter untuk nomor urut
    let rowNumber = 1;

    // Process each leave request
    currentLeaveData.forEach((leave) => {
      // Periksa apakah izin multi-hari
      const isMultiDay = leave.leaveStartDate && leave.leaveEndDate && 
                        leave.leaveStartDate !== leave.leaveEndDate;

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
        
        // Cek apakah izin sakit dengan surat keterangan
        if (leave.leaveType === "sakit" && 
            leave.replacementDetails && 
            leave.replacementDetails.hasMedicalCertificate) {
          // Jika ada surat keterangan sakit
          replacementType = "Ada Surat DC";
          replacementInfo = "Tidak perlu diganti";
        } else {
          // Untuk jenis izin lainnya
          if (leave.replacementType === "libur") {
            replacementType = "Ganti Libur";
            if (leave.replacementDetails && leave.replacementDetails.formattedDate) {
              replacementInfo = `${leave.replacementDetails.formattedDate}`;
            } else if (leave.replacementDetails && leave.replacementDetails.dates && leave.replacementDetails.dates.length > 0) {
              replacementInfo = leave.replacementDetails.dates.map(d => d.formattedDate).join(", ");
            }
          } else if (leave.replacementType === "jam") {
            replacementType = "Ganti Jam";
            if (leave.replacementDetails && leave.replacementDetails.hours && leave.replacementDetails.formattedDate) {
              replacementInfo = `${leave.replacementDetails.hours} jam pada ${leave.replacementDetails.formattedDate}`;
            }
          } else if (leave.replacementType === "tidak") {
            replacementType = "Tidak Perlu Diganti";
          }
        }

        tableRows.push([
          rowNumber.toString(),
          leave.employeeId || "-",
          leave.name || "-",
          leaveDate,
          leave.reason || "-",
          replacementType,
          replacementInfo,
          leave.status || "Pending",
          leave.replacementStatus || "Belum Diganti",
        ]);
        
        rowNumber++;
      } else {
        // Untuk izin multi-hari
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
        const replacementStatusArray = leave.replacementStatusArray || Array(dayDiff).fill("Belum Diganti");

        // Format replacement type
        let replacementType = "-";
        let baseReplacementInfo = "-";
        
        // Cek apakah izin sakit dengan surat keterangan
        if (leave.leaveType === "sakit" && 
            leave.replacementDetails && 
            leave.replacementDetails.hasMedicalCertificate) {
          // Jika ada surat keterangan sakit
          replacementType = "Ada Surat DC";
          baseReplacementInfo = "Tidak perlu diganti";
        } else {
          // Untuk jenis izin lainnya
          if (leave.replacementType === "libur") {
            replacementType = "Ganti Libur";
          } else if (leave.replacementType === "jam") {
            replacementType = "Ganti Jam";
          } else if (leave.replacementType === "tidak") {
            replacementType = "Tidak Perlu Diganti";
          }
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
          
          // Jika bukan izin sakit dengan surat DC, cek detail pengganti
          if (!(leave.leaveType === "sakit" && 
                leave.replacementDetails && 
                leave.replacementDetails.hasMedicalCertificate)) {
            if (leave.replacementType === "libur" && leave.replacementDetails && leave.replacementDetails.dates) {
              // Jika ada tanggal pengganti spesifik untuk hari ini
              if (leave.replacementDetails.dates[i]) {
                replacementInfo = `${leave.replacementDetails.dates[i].formattedDate}`;
              }
            } else if (leave.replacementType === "jam" && leave.replacementDetails) {
              replacementInfo = `${leave.replacementDetails.hours} jam pada ${leave.replacementDetails.formattedDate}`;
            }
          }

          tableRows.push([
            `${currentRowNumber} (${i + 1}/${dayDiff})`,
            leave.employeeId || "-",
            leave.name || "-",
            formattedDate,
            leave.reason || "-",
            replacementType,
            replacementInfo,
            leave.status || "Pending",
            dayStatus,
          ]);
        }
        
        // Increment row number only once after all days of multi-day leave
        rowNumber++;
      }
    });

    // Create table
    doc.autoTable({
      head: [tableColumn],
      body: tableRows,
      startY: 35,
      theme: 'grid',
      styles: {
        fontSize: 8,
        cellPadding: 1,
        overflow: 'linebreak',
        halign: 'left',
        valign: 'middle',
      },
      headStyles: {
        fillColor: [41, 128, 185],
        textColor: 255,
        fontStyle: 'bold',
        halign: 'center',
      },
      columnStyles: {
        0: { cellWidth: 13 }, // No
        1: { cellWidth: 17 }, // ID Karyawan
        2: { cellWidth: 20 }, // Nama
        3: { cellWidth: 25 }, // Tanggal Izin
        4: { cellWidth: 90 }, // Alasan
        5: { cellWidth: 25 }, // Jenis Pengganti
        6: { cellWidth: 35 }, // Detail Pengganti
        7: { cellWidth: 20 }, // Status
        8: { cellWidth: 25 }, // Status Pengganti
      },
      didDrawPage: function(data) {
        // Footer with page number
        const pageSize = doc.internal.pageSize;
        const pageHeight = pageSize.height ? pageSize.height : pageSize.getHeight();
        doc.setFontSize(8);
        doc.text(`Halaman ${doc.internal.getNumberOfPages()}`, pageSize.width - 20, pageHeight - 10);
        
        // Add date printed
        const today = new Date().toLocaleDateString('id-ID', {
          day: 'numeric',
          month: 'long',
          year: 'numeric'
        });
        doc.text(`Dicetak pada: ${today}`, 14, pageHeight - 10);
      }
    });

    // Generate PDF file
    const fileName = `Laporan_Izin_${monthName}_${year}.pdf`;
    doc.save(fileName);

    showAlert("success", `Berhasil mengekspor data ke ${fileName}`);
  } catch (error) {
    console.error("Error exporting to PDF:", error);
    showAlert("danger", "Terjadi kesalahan saat mengekspor ke PDF: " + error.message);
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
    window.handleLogout = function() {
      // Clear all caches before logout
      reportCache.clear();
      cacheTimestamps.clear();
      clearLeaveCache();
      
      // Redirect to login page
      window.location.href = "login.html";
    };
    
    // Expose functions for debugging
    window.debugFunctions = {
      clearCache: function() {
        reportCache.clear();
        cacheTimestamps.clear();
        clearLeaveCache();
        console.log("Cache cleared");
      },
      getCacheStatus: function() {
        return {
          reportCache: Array.from(reportCache.keys()),
          cacheTimestamps: Object.fromEntries(cacheTimestamps.entries()),
          cacheAge: Array.from(cacheTimestamps.entries()).map(([key, time]) => {
            return {
              key,
              age: (Date.now() - time) / 1000 + " seconds",
              isValid: (Date.now() - time) < CACHE_DURATION
            };
          })
        };
      },
      forceRefresh: function() {
        generateReport(true);
      }
    };
      
   
