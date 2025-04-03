import { getLeaveRequestsByMonth, clearLeaveRequestsCache } from "../services/leave-service.js";
import { deleteLeaveRequestsByMonth } from "../services/report-service.js";
import { attendanceCache } from "../services/attendance-service.js"; // Impor dari attendance-service

// Global variables
let currentLeaveData = [];
let lastVisibleDoc = null;
let hasMoreData = false;
const itemsPerPage = 20; // Reduced from 50 to 20 for better pagination
const monthNames = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember"
];

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
  yearSelector.innerHTML = '';
  
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

// Setup all event listeners
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
      filterByReplacementType(this.value);
    });
  }
}

// Generate report based on selected month and year
async function generateReport() {
  try {
    const monthSelector = document.getElementById("monthSelector");
    const yearSelector = document.getElementById("yearSelector");
    
    if (!monthSelector || !yearSelector) {
      console.error("Month or year selector not found");
      return;
    }
    
    const month = parseInt(monthSelector.value);
    const year = parseInt(yearSelector.value);

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

// Integrate attendance data with leave data
async function integrateAttendanceData(leaveData, month, year) {
  try {
    // Create a map to track which dates we need to check for attendance
    const datesToCheck = new Map();
    
    // Collect all dates from leave requests
    leaveData.forEach(leave => {
      if (leave.leaveDate) {
        datesToCheck.set(leave.leaveDate, true);
      } else if (leave.leaveStartDate && leave.leaveEndDate) {
        // For multi-day leaves, add all dates in range
        const startDate = new Date(leave.leaveStartDate);
        const endDate = new Date(leave.leaveEndDate);
        
        let currentDate = new Date(startDate);
        while (currentDate <= endDate) {
          datesToCheck.set(currentDate.toISOString().split('T')[0], true);
          currentDate.setDate(currentDate.getDate() + 1);
        }
      }
    });
    
    // Check if we have attendance data for these dates in cache
    const dateKeys = Array.from(datesToCheck.keys());
    console.log(`Checking attendance for ${dateKeys.length} dates`);
    
    for (const dateKey of dateKeys) {
      // If we don't have this date in attendance cache, we'll skip it
      // This avoids unnecessary Firestore reads
      if (!attendanceCache.has(dateKey)) {
        console.log(`No attendance data in cache for ${dateKey}`);
        continue;
      }
      
      const attendanceForDate = attendanceCache.get(dateKey);
      console.log(`Found ${attendanceForDate.length} attendance records for ${dateKey}`);
      
      // Update leave data with attendance status
      leaveData.forEach(leave => {
        if (leave.leaveDate === dateKey) {
          // Check if employee was present despite having leave
          const employeeAttendance = attendanceForDate.find(
            record => record.employeeId === leave.employeeId
          );
          
          if (employeeAttendance) {
            leave.attendanceStatus = "Hadir";
            leave.attendanceId = employeeAttendance.id;
          } else {
            leave.attendanceStatus = "Tidak Hadir";
          }
        } else if (leave.leaveStartDate && leave.leaveEndDate) {
          // For multi-day leaves
          const startDate = new Date(leave.leaveStartDate);
          const endDate = new Date(leave.leaveEndDate);
          const checkDate = new Date(dateKey);
          
          if (checkDate >= startDate && checkDate <= endDate) {
            // This date is within the leave range
            const dayIndex = Math.floor((checkDate - startDate) / (1000 * 60 * 60 * 24));
            
            // Check if employee was present despite having leave
            const employeeAttendance = attendanceForDate.find(
              record => record.employeeId === leave.employeeId
            );
            
            if (!leave.attendanceStatusArray) {
              leave.attendanceStatusArray = [];
            }
            
            if (employeeAttendance) {
              leave.attendanceStatusArray[dayIndex] = "Hadir";
            } else {
              leave.attendanceStatusArray[dayIndex] = "Tidak Hadir";
            }
          }
        }
      });
    }
    
    console.log("Attendance integration complete");
  } catch (error) {
    console.error("Error integrating attendance data:", error);
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

    // Fetch next batch of data
    const result = await getLeaveRequestsByMonth(month, year, lastVisibleDoc, itemsPerPage);

    // Update pagination variables
    const newData = result.leaveRequests || [];
    lastVisibleDoc = result.lastDoc;
    hasMoreData = result.hasMore;

    // Integrate with attendance data
    await integrateAttendanceData(newData, month, year);

    // Append new data to current data
    currentLeaveData = [...currentLeaveData, ...newData];

    // Update UI
    populateLeaveTable(true); // true indicates append mode

    // Reset button state
    if (loadMoreBtn) {
      loadMoreBtn.innerHTML = '<i class="fas fa-plus me-2"></i> Muat Lebih Banyak';
      loadMoreBtn.disabled = false;
      
      const loadMoreContainer = document.getElementById("loadMoreContainer");
      if (loadMoreContainer) {
        loadMoreContainer.style.display = hasMoreData ? "block" : "none";
      }
    }
  } catch (error) {
    console.error("Error loading more data:", error);
    showAlert(
      "danger",
      '<i class="fas fa-exclamation-circle me-2"></i> Terjadi kesalahan saat memuat data tambahan: ' + error.message
    );

    // Reset button state
    const loadMoreBtn = document.getElementById("loadMoreBtn");
    if (loadMoreBtn) {
      loadMoreBtn.innerHTML = '<i class="fas fa-plus me-2"></i> Muat Lebih Banyak';
      loadMoreBtn.disabled = false;
    }
  }
}

// Update summary cards with counts
function updateSummaryCards() {
  const totalLeaves = currentLeaveData.length;
  const approvedLeaves = currentLeaveData.filter(
    (item) => item.status === "Approved" || item.status === "Disetujui"
  ).length;
  const rejectedLeaves = currentLeaveData.filter(
    (item) => item.status === "Rejected" || item.status === "Ditolak"
  ).length;
  const pendingLeaves = currentLeaveData.filter((item) => item.status === "Pending").length;

  document.getElementById("totalLeaves").textContent = totalLeaves;
  document.getElementById("approvedLeaves").textContent = approvedLeaves;
  document.getElementById("rejectedLeaves").textContent = rejectedLeaves;
  document.getElementById("pendingLeaves").textContent = pendingLeaves;
}

// Populate leave table with data
function populateLeaveTable(appendMode = false) {
  const tbody = document.getElementById("leaveReportList");
  if (!tbody) return;

  // Clear existing rows if this is a new search and not appending
  if (!appendMode) {
    tbody.innerHTML = "";
  }

  // Get starting index for row numbers
  const startIndex = tbody.children.length;

  // Create document fragment for better performance
  const fragment = document.createDocumentFragment();

  // Process each leave record
  currentLeaveData.slice(startIndex).forEach((record, index) => {
    // Periksa apakah izin multi-hari
    const isMultiDay = record.leaveStartDate && record.leaveEndDate && 
                      record.leaveStartDate !== record.leaveEndDate;
    
    // Jika bukan multi-hari, tampilkan seperti biasa
    if (!isMultiDay) {
      const replacementInfo = getReplacementInfo(record);
      const row = document.createElement("tr");

      // Add data attributes for filtering
      row.dataset.status = record.status.toLowerCase();
      row.dataset.replacementStatus = (record.replacementStatus || "Belum Diganti").toLowerCase().replace(/\s+/g, "-");
      row.dataset.replacementType = record.replacementType || "";
      row.dataset.leaveId = record.id || "";

      // Add attendance status indicator
      const attendanceStatus = record.attendanceStatus || "Tidak Diketahui";
      const attendanceClass = attendanceStatus === "Hadir" ? "text-success" : "text-muted";

      row.innerHTML = `
        <td>${startIndex + index + 1}</td>
        <td>${record.employeeId || '-'}</td>
        <td>${record.name || '-'}</td>
        <td>${formatDate(record.submitDate)}</td>
        <td>
          ${record.leaveDate || '-'}
          <span class="badge bg-${attendanceStatus === 'Hadir' ? 'danger' : 'secondary'} ms-1">
            ${attendanceStatus === 'Hadir' ? 'Hadir Meski Izin' : 'Tidak Hadir'}
          </span>
        </td>
        <td>${record.reason || '-'}</td>
        <td>${
          record.replacementType === "libur"
            ? "Ganti Libur"
            : record.replacementType === "jam"
            ? "Ganti Jam"
            : "Tidak Ada"
        }</td>
        <td>${replacementInfo}</td>
        <td class="status-${record.status.toLowerCase()}">${record.status}</td>
        <td>${record.decisionDate ? formatDate(record.decisionDate) : "-"}</td>
        <td class="status-${(record.replacementStatus || "Belum Diganti").toLowerCase().replace(/\s+/g, "-")}">${
        record.replacementStatus || "Belum Diganti"      }</td>
        `;
        fragment.appendChild(row);
      } else {
        // Untuk multi-hari, buat baris untuk setiap hari
        const startDate = new Date(record.leaveStartDate);
        const endDate = new Date(record.leaveEndDate);
        const dayDiff = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
        
        // Pastikan replacementStatusArray ada
        const replacementStatusArray = record.replacementStatusArray || Array(dayDiff).fill("Belum Diganti");
        // Pastikan attendanceStatusArray ada
        const attendanceStatusArray = record.attendanceStatusArray || Array(dayDiff).fill("Tidak Diketahui");
        
        // Buat baris untuk setiap hari
        for (let i = 0; i < dayDiff; i++) {
          const currentDate = new Date(startDate);
          currentDate.setDate(startDate.getDate() + i);
          
          const formattedDate = currentDate.toLocaleDateString("id-ID", {
            day: "numeric",
            month: "long",
            year: "numeric"
          });
          
          const row = document.createElement('tr');
          
          // Jika ini hari pertama, tambahkan kelas untuk styling
          if (i === 0) {
            row.classList.add('first-day-row');
          }
          
          // Tentukan status ganti untuk hari ini
          const dayStatus = replacementStatusArray[i] || 'Belum Diganti';
          // Tentukan status kehadiran untuk hari ini
          const attendanceStatus = attendanceStatusArray[i] || 'Tidak Diketahui';
          const attendanceClass = attendanceStatus === "Hadir" ? "text-success" : "text-muted";
          
          // Add data attributes for filtering
          row.dataset.status = record.status.toLowerCase();
          row.dataset.replacementStatus = dayStatus.toLowerCase().replace(/\s+/g, "-");
          row.dataset.replacementType = record.replacementType || "";
          row.dataset.leaveId = record.id || "";
          row.dataset.dayIndex = i;
          
          // Tampilkan informasi penggantian untuk hari ini
          let replacementInfo = '-';
          if (record.replacementType === 'libur' && record.replacementDetails && record.replacementDetails.dates) {
            // Jika ada tanggal pengganti spesifik untuk hari ini
            if (record.replacementDetails.dates[i]) {
              replacementInfo = `Ganti libur pada ${record.replacementDetails.dates[i].formattedDate}`;
            }
          } else if (record.replacementType === 'jam' && record.replacementDetails) {
            replacementInfo = `Ganti ${record.replacementDetails.hours} jam pada ${record.replacementDetails.formattedDate}`;
          }
          
          row.innerHTML = `
            <td>${startIndex + index + 1}-${i+1}</td>
            <td>${record.employeeId || '-'}</td>
            <td>${record.name || '-'}</td>
            <td>${formatDate(record.submitDate)}</td>
            <td>
              ${formattedDate} 
              <span class="badge bg-info">Hari ${i+1}/${dayDiff}</span>
              <span class="badge bg-${attendanceStatus === 'Hadir' ? 'danger' : 'secondary'} ms-1">
                ${attendanceStatus === 'Hadir' ? 'Hadir Meski Izin' : 'Tidak Hadir'}
              </span>
            </td>
            <td>${record.reason || '-'}</td>
            <td>${
              record.replacementType === "libur"
                ? "Ganti Libur"
                : record.replacementType === "jam"
                ? "Ganti Jam"
                : "Tidak Ada"
            }</td>
            <td>${replacementInfo}</td>
            <td class="status-${record.status.toLowerCase()}">${record.status}</td>
            <td>${record.decisionDate ? formatDate(record.decisionDate) : "-"}</td>
            <td class="status-${dayStatus.toLowerCase().replace(/\s+/g, "-")}">${dayStatus}</td>
          `;
          
          fragment.appendChild(row);
        }
      }
    });
  
    tbody.appendChild(fragment);
  }
  
  // Helper function to format replacement information
  function getReplacementInfo(record) {
    if (!record.replacementType || record.replacementType === "tidak") {
      return "Tidak perlu diganti";
    } else if (record.replacementType === "libur") {
      if (record.replacementDetails && record.replacementDetails.dates && record.replacementDetails.dates.length > 0) {
        // Handle multiple dates
        return record.replacementDetails.dates.map(date => 
          `Ganti libur pada ${date.formattedDate}`
        ).join("<br>");
      } else if (record.replacementDetails && record.replacementDetails.formattedDate) {
        return `Ganti libur pada ${record.replacementDetails.formattedDate}`;
      }
      return "Ganti libur";
    } else if (record.replacementType === "jam") {
      return record.replacementDetails && record.replacementDetails.hours && record.replacementDetails.formattedDate
        ? `Ganti ${record.replacementDetails.hours} jam pada ${record.replacementDetails.formattedDate}`
        : "Ganti jam";
    }
    return "-";
  }
  
  // Format date to readable format
  function formatDate(date) {
    if (!date) return "-";
  
    return new Date(date).toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  
  // Show report elements
  function showReportElements() {
    document.getElementById("summaryCards").style.display = "flex";
    document.getElementById("actionButtons").style.display = "flex";
    document.getElementById("tableContainer").style.display = "block";
    document.getElementById("noDataMessage").style.display = "none";
  
    // Show load more button if there's more data
    const loadMoreContainer = document.getElementById("loadMoreContainer");
    if (loadMoreContainer) {
      loadMoreContainer.style.display = hasMoreData ? "block" : "none";
    }
  }
  
  // Hide report elements
  function hideReportElements() {
    document.getElementById("summaryCards").style.display = "none";
    document.getElementById("actionButtons").style.display = "none";
    document.getElementById("tableContainer").style.display = "none";
    // Hide load more button
    const loadMoreContainer = document.getElementById("loadMoreContainer");
    if (loadMoreContainer) {
      loadMoreContainer.style.display = "none";
    }
  }
  
  // Filter leave data
  function filterLeaveData(filterType, value) {
    const rows = document.querySelectorAll("#leaveReportList tr");
  
    rows.forEach((row) => {
      let showRow = true;
  
      if (value !== "all") {
        if (filterType === "status") {
          const statusCell = row.querySelector("td:nth-child(9)").textContent.toLowerCase();
          showRow =
            (value === "approved" && (statusCell === "approved" || statusCell === "disetujui")) ||
            (value === "rejected" && (statusCell === "rejected" || statusCell === "ditolak")) ||
            (value === "pending" && statusCell === "pending");
        } else if (filterType === "replacement") {
          const replacementCell = row.querySelector("td:nth-child(11)").textContent.toLowerCase();
          showRow =
            (value === "sudah" && replacementCell === "sudah diganti") ||
            (value === "belum" && replacementCell === "belum diganti");
        }
      }
  
      row.style.display = showRow ? "" : "none";
    });
  
    // Update dropdown button text
    if (filterType === "status") {
      let buttonText = "Filter Status";
      if (value === "approved") buttonText = "Disetujui";
      else if (value === "rejected") buttonText = "Ditolak";
      else if (value === "pending") buttonText = "Pending";
  
      document.getElementById("statusFilterDropdown").innerHTML = `<i class="fas fa-filter"></i> ${buttonText}`;
    } else if (filterType === "replacement") {
      let buttonText = "Filter Pengganti";
      if (value === "sudah") buttonText = "Sudah Diganti";
      else if (value === "belum") buttonText = "Belum Diganti";
  
      document.getElementById(
        "replacementFilterDropdown"
      ).innerHTML = `<i class="fas fa-exchange-alt"></i> ${buttonText}`;
    }
  }
  
  // Filter by replacement type
  function filterByReplacementType(value) {
    const rows = document.querySelectorAll("#leaveReportList tr");
  
    rows.forEach((row) => {
      if (value === "all") {
        row.style.display = "";
      } else {
        const replacementTypeCell = row.querySelector("td:nth-child(7)").textContent.toLowerCase();
        const showRow =
          (value === "libur" && replacementTypeCell.includes("libur")) ||
          (value === "jam" && replacementTypeCell.includes("jam"));
        row.style.display = showRow ? "" : "none";
      }
    });
  }
  
  // Show delete confirmation modal
  function showDeleteConfirmation() {
    const month = parseInt(document.getElementById("monthSelector").value);
    const year = parseInt(document.getElementById("yearSelector").value);
    
    // Update modal text
    document.getElementById("deleteMonthName").textContent = monthNames[month - 1];
    document.getElementById("deleteYear").textContent = year;
    
    // Show modal
    const modal = new bootstrap.Modal(document.getElementById("deleteConfirmModal"));
    modal.show();
  }
  
  // Delete month data
  async function deleteMonthData() {
    try {
      const month = parseInt(document.getElementById("monthSelector").value);
      const year = parseInt(document.getElementById("yearSelector").value);
      
      // Show loading in modal
      const confirmBtn = document.getElementById("confirmDeleteBtn");
      const originalBtnText = confirmBtn.innerHTML;
      confirmBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i> Menghapus...';
      confirmBtn.disabled = true;
      
      // Delete data
      const deletedCount = await deleteLeaveRequestsByMonth(month, year);
      
      // Hide modal
      const modal = bootstrap.Modal.getInstance(document.getElementById("deleteConfirmModal"));
      modal.hide();
      
      // Show success message
      showAlert(
        "success", 
        `<i class="fas fa-check-circle me-2"></i> Berhasil menghapus ${deletedCount} data izin untuk bulan ${monthNames[month - 1]} ${year}`
      );
      
      // Clear cache
      clearLeaveRequestsCache();
      
      // Reset UI
      hideReportElements();
      document.getElementById("noDataMessage").style.display = "block";
      
      // Reset button
      confirmBtn.innerHTML = originalBtnText;
      confirmBtn.disabled = false;
      
    } catch (error) {
      console.error("Error deleting data:", error);
      
      // Show error
      showAlert(
        "danger",
        `<i class="fas fa-exclamation-circle me-2"></i> Gagal menghapus data: ${error.message}`
      );
      
      // Reset button
      const confirmBtn = document.getElementById("confirmDeleteBtn");
      confirmBtn.innerHTML = '<i class="fas fa-trash-alt me-2"></i> Ya, Hapus Data';
      confirmBtn.disabled = false;
      
      // Hide modal
      const modal = bootstrap.Modal.getInstance(document.getElementById("deleteConfirmModal"));
      modal.hide();
    }
  }
  
  // Export to Excel
  function exportToExcel() {
    try {
      if (currentLeaveData.length === 0) {
        showAlert("warning", '<i class="fas fa-exclamation-triangle me-2"></i> Tidak ada data untuk diekspor');
        return;
      }
      
      const month = parseInt(document.getElementById("monthSelector").value);
      const year = parseInt(document.getElementById("yearSelector").value);
      
      // Prepare worksheet data
      const wsData = [
        [
          "No", "ID Staff", "Nama", "Tanggal Pengajuan", "Tanggal Izin", 
          "Alasan", "Jenis Pengganti", "Detail Pengganti", "Status", 
          "Tanggal Keputusan", "Status Ganti", "Status Kehadiran"
        ]
      ];
      
      // Add data rows
      let rowNumber = 1;
      currentLeaveData.forEach((record) => {
        // Periksa apakah izin multi-hari
        const isMultiDay = record.leaveStartDate && record.leaveEndDate && 
                          record.leaveStartDate !== record.leaveEndDate;
        
        if (!isMultiDay) {
          const replacementType = record.replacementType === "libur" 
            ? "Ganti Libur" 
            : record.replacementType === "jam" 
              ? "Ganti Jam" 
              : "Tidak Ada";
              
          const replacementInfo = getReplacementInfoPlain(record);
          const attendanceStatus = record.attendanceStatus || "Tidak Diketahui";
          
          wsData.push([
            rowNumber++,
            record.employeeId || '-',
            record.name || '-',
            formatDatePlain(record.submitDate),
            record.leaveDate || '-',
            record.reason || '-',
            replacementType,
            replacementInfo,
            record.status,
            record.decisionDate ? formatDatePlain(record.decisionDate) : "-",
            record.replacementStatus || "Belum Diganti",
            attendanceStatus
          ]);
        } else {
          // Untuk multi-hari, buat baris untuk setiap hari
          const startDate = new Date(record.leaveStartDate);
          const endDate = new Date(record.leaveEndDate);
          const dayDiff = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
          
          // Pastikan replacementStatusArray ada
          const replacementStatusArray = record.replacementStatusArray || Array(dayDiff).fill("Belum Diganti");
          // Pastikan attendanceStatusArray ada
          const attendanceStatusArray = record.attendanceStatusArray || Array(dayDiff).fill("Tidak Diketahui");
          
          for (let i = 0; i < dayDiff; i++) {
            const currentDate = new Date(startDate);
            currentDate.setDate(startDate.getDate() + i);
            
            const formattedDate = currentDate.toLocaleDateString("id-ID", {
              day: "numeric",
              month: "long",
              year: "numeric"
            });
            
            // Tampilkan informasi penggantian untuk hari ini
            let replacementInfo = '-';
            if (record.replacementType === 'libur' && record.replacementDetails && record.replacementDetails.dates) {
              // Jika ada tanggal pengganti spesifik untuk hari ini
              if (record.replacementDetails.dates[i]) {
                replacementInfo = `Ganti libur pada ${record.replacementDetails.dates[i].formattedDate}`;
              }
            } else if (record.replacementType === 'jam' && record.replacementDetails) {
              replacementInfo = `Ganti ${record.replacementDetails.hours} jam pada ${record.replacementDetails.formattedDate}`;
            }
            
            const replacementType = record.replacementType === "libur" 
              ? "Ganti Libur" 
              : record.replacementType === "jam" 
                ? "Ganti Jam" 
                : "Tidak Ada";
            
            const attendanceStatus = attendanceStatusArray[i] || "Tidak Diketahui";
            
            wsData.push([
              `${rowNumber++} (Hari ${i+1}/${dayDiff})`,
              record.employeeId || '-',
              record.name || '-',
              formatDatePlain(record.submitDate),
              formattedDate,
              record.reason || '-',
              replacementType,
              replacementInfo,
              record.status,
              record.decisionDate ? formatDatePlain(record.decisionDate) : "-",
              replacementStatusArray[i] || "Belum Diganti",
              attendanceStatus
            ]);
          }
        }
      });
      
      // Create worksheet and workbook
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Laporan Izin");
      
      // Set column widths
      const colWidths = [
        { wch: 10 }, // No
        { wch: 10 }, // ID Staff
        { wch: 20 }, // Nama
        { wch: 20 }, // Tanggal Pengajuan
        { wch: 20 }, // Tanggal Izin
        { wch: 30 }, // Alasan
        { wch: 15 }, // Jenis Pengganti
        { wch: 30 }, // Detail Pengganti
        { wch: 10 }, // Status
        { wch: 20 }, // Tanggal Keputusan
        { wch: 15 }, // Status Ganti
        { wch: 15 }  // Status Kehadiran
      ];
      ws['!cols'] = colWidths;
      
      // Generate filename
      const fileName = `Laporan_Izin_${monthNames[month - 1]}_${year}.xlsx`;
      
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
  
  // Helper function for plain text replacement info (for Excel export)
  function getReplacementInfoPlain(record) {
    if (!record.replacementType || record.replacementType === "tidak") {
      return "Tidak perlu diganti";
    } else if (record.replacementType === "libur") {
      if (record.replacementDetails && record.replacementDetails.dates && record.replacementDetails.dates.length > 0) {
        // Handle multiple dates
        return record.replacementDetails.dates.map(date => 
          `Ganti libur pada ${date.formattedDate}`
        ).join(", ");
      } else if (record.replacementDetails && record.replacementDetails.formattedDate) {
        return `Ganti libur pada ${record.replacementDetails.formattedDate}`;
      }
      return "Ganti libur";
    } else if (record.replacementType === "jam") {
      return record.replacementDetails && record.replacementDetails.hours && record.replacementDetails.formattedDate
        ? `Ganti ${record.replacementDetails.hours} jam pada ${record.replacementDetails.formattedDate}`
        : "Ganti jam";
    }
    return "-";
  }
  
  // Format date for Excel export
  function formatDatePlain(date) {
    if (!date) return "-";
  
    return new Date(date).toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  
  // Export to PDF
  function exportToPDF() {
    try {
      if (currentLeaveData.length === 0) {
        showAlert("warning", '<i class="fas fa-exclamation-triangle me-2"></i> Tidak ada data untuk diekspor');
        return;
      }
      
      const month = parseInt(document.getElementById("monthSelector").value);
      const year = parseInt(document.getElementById("yearSelector").value);
      
      // Create PDF document
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF('l', 'mm', 'a4'); // landscape orientation
      
      // Add title
      doc.setFontSize(16);
      doc.text(`Laporan Izin Karyawan - ${monthNames[month - 1]} ${year}`, 14, 15);
      
      // Add subtitle with date
      doc.setFontSize(10);
      doc.text(`Dicetak pada: ${new Date().toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })}`, 14, 22);
      
      // Prepare table data
      const tableData = [];
      let rowNumber = 1;
      
      currentLeaveData.forEach((record) => {
        // Periksa apakah izin multi-hari
        const isMultiDay = record.leaveStartDate && record.leaveEndDate && 
                          record.leaveStartDate !== record.leaveEndDate;
        
        if (!isMultiDay) {
          const replacementType = record.replacementType === "libur" 
            ? "Ganti Libur" 
            : record.replacementType === "jam" 
              ? "Ganti Jam" 
              : "Tidak Ada";
          
          const attendanceStatus = record.attendanceStatus || "Tidak Diketahui";
          const attendanceText = attendanceStatus === "Hadir" ? "Hadir" : "Tidak Hadir";
          
          tableData.push([
            rowNumber++,
            record.employeeId || '-',
            record.name || '-',
            formatDatePlain(record.submitDate).split(' ')[0], // Hanya tanggal tanpa waktu
            record.leaveDate || '-',
            record.reason ? (record.reason.substring(0, 20) + (record.reason.length > 20 ? '...' : '')) : '-',
            replacementType,
            record.status,
            record.replacementStatus || "Belum Diganti",
            attendanceText
          ]);
        } else {
          // Untuk multi-hari, buat baris untuk setiap hari
          const startDate = new Date(record.leaveStartDate);
          const endDate = new Date(record.leaveEndDate);
          const dayDiff = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
          
          // Pastikan replacementStatusArray ada
          const replacementStatusArray = record.replacementStatusArray || Array(dayDiff).fill("Belum Diganti");
          // Pastikan attendanceStatusArray ada
          const attendanceStatusArray = record.attendanceStatusArray || Array(dayDiff).fill("Tidak Diketahui");
          
          for (let i = 0; i < dayDiff; i++) {
            const currentDate = new Date(startDate);
            currentDate.setDate(startDate.getDate() + i);
            
            const formattedDate = currentDate.toLocaleDateString("id-ID", {
              day: "numeric",
              month: "long",
              year: "numeric"
            });
            
            const replacementType = record.replacementType === "libur" 
              ? "Ganti Libur" 
              : record.replacementType === "jam" 
                ? "Ganti Jam" 
                : "Tidak Ada";
            
            const attendanceStatus = attendanceStatusArray[i] || "Tidak Diketahui";
            const attendanceText = attendanceStatus === "Hadir" ? "Hadir" : "Tidak Hadir";
            
            tableData.push([
              `${rowNumber++} (${i+1}/${dayDiff})`,
              record.employeeId || '-',
              record.name || '-',
              formatDatePlain(record.submitDate).split(' ')[0], // Hanya tanggal tanpa waktu
              formattedDate,
              record.reason ? (record.reason.substring(0, 20) + (record.reason.length > 20 ? '...' : '')) : '-',
              replacementType,
              record.status,
              replacementStatusArray[i] || "Belum Diganti",
              attendanceText
            ]);
          }
        }
      });
      
      // Add table
      doc.autoTable({
        startY: 30,
        head: [['No', 'ID', 'Nama', 'Tgl Pengajuan', 'Tgl Izin', 'Alasan', 'Jenis Pengganti', 'Status', 'Status Ganti', 'Kehadiran']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [41, 128, 185], textColor: 255 },
        styles: { fontSize: 8, cellPadding: 2 },
        columnStyles: {
          0: { cellWidth: 10 },
          5: { cellWidth: 30 }
        }
      });
      
      // Generate filename
      const fileName = `Laporan_Izin_${monthNames[month - 1]}_${year}.pdf`;
      
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
  
  
