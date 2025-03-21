import { getAttendanceByDateRange, deleteAttendanceByDateRange } from "../services/report-service.js";

// Global variables
let currentAttendanceData = [];
let filteredData = [];
let currentPage = 1;
const itemsPerPage = 20;

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
 
});

// Set default date range to current month
function setDefaultDateRange() {
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  
  document.getElementById("startDate").valueAsDate = firstDay;
  document.getElementById("endDate").valueAsDate = lastDay;
}

// Setup all event listeners
function setupEventListeners() {
  // Generate report button
  document.getElementById("generateReportBtn").addEventListener("click", generateReport);

  // Export buttons
  document.getElementById("exportExcelBtn").addEventListener("click", exportToExcel);
  document.getElementById("exportPdfBtn").addEventListener("click", exportToPDF);

  // Delete data button
  document.getElementById("deleteDataBtn").addEventListener("click", showDeleteConfirmation);

  // Confirm delete button in modal
  document.getElementById("confirmDeleteBtn").addEventListener("click", deleteAttendanceData);
  
  // Search button
  document.getElementById("searchBtn").addEventListener("click", searchAttendance);
  
  // Search input (search on Enter key)
  document.getElementById("searchInput").addEventListener("keypress", function(e) {
    if (e.key === "Enter") {
      searchAttendance();
    }
  });
  
  // Filter checkboxes
  document.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
    checkbox.addEventListener("change", applyFilters);
  });
  
  // Employee type and shift filters
  document.getElementById("employeeTypeFilter").addEventListener("change", applyFilters);
  document.getElementById("shiftFilter").addEventListener("change", applyFilters);
}

// Generate report based on selected date range
async function generateReport() {
  try {
    const startDate = document.getElementById("startDate").value;
    const endDate = document.getElementById("endDate").value;
    
    if (!startDate || !endDate) {
      showAlert("danger", "Mohon pilih rentang tanggal yang valid");
      return;
    }
    
    if (new Date(startDate) > new Date(endDate)) {
      showAlert("danger", "Tanggal mulai tidak boleh lebih besar dari tanggal akhir");
      return;
    }

    // Show loading state
    showAlert("info", '<i class="fas fa-spinner fa-spin me-2"></i> Memuat data kehadiran...', false);

    // Fetch data
    currentAttendanceData = await getAttendanceByDateRange(startDate, endDate);

    // Hide alert
    hideAlert();

    // Update UI based on data
    if (currentAttendanceData.length > 0) {
      // Apply initial filters
      applyFilters();
      
      // Show report elements
      showReportElements();
    } else {
      hideReportElements();
      document.getElementById("noDataMessage").style.display = "block";
    }
  } catch (error) {
    console.error("Error generating report:", error);
    showAlert(
      "danger",
      '<i class="fas fa-exclamation-circle me-2"></i> Terjadi kesalahan saat memuat data: ' + error.message
    );
  }
}

// Apply filters to the attendance data
function applyFilters() {
  // Get filter values
  const employeeType = document.getElementById("employeeTypeFilter").value;
  const shift = document.getElementById("shiftFilter").value;
  const showOntime = document.getElementById("ontimeFilter").checked;
  const showLate = document.getElementById("lateFilter").checked;
  const showAbsent = document.getElementById("absentFilter").checked;
  const showLeave = document.getElementById("leaveFilter").checked;
  
  // Filter data
  filteredData = currentAttendanceData.filter(record => {
    // Filter by employee type
    if (employeeType !== "all" && record.type !== employeeType) {
      return false;
    }
    
    // Filter by shift
    if (shift !== "all" && record.shift !== shift) {
      return false;
    }
    
    // Filter by status
    if (record.status === "Tepat Waktu" && !showOntime) {
      return false;
    }
    
    if (record.status === "Terlambat" && !showLate) {
      return false;
    }
    
    if (record.status === "Tidak Hadir" && !showAbsent) {
      return false;
    }
    
    if (record.status === "Izin" && !showLeave) {
      return false;
    }
    
    return true;
  });
  
  // Reset to first page
  currentPage = 1;
  
  // Update UI
  updateSummaryCards();
  updateStatistics();
  populateAttendanceTable();
}

// Search attendance records
function searchAttendance() {
  const searchTerm = document.getElementById("searchInput").value.toLowerCase().trim();
  
  if (!searchTerm) {
    // If search term is empty, just apply filters
    applyFilters();
    return;
  }
  
  // Filter by search term (name or employee ID)
  filteredData = filteredData.filter(record => 
    record.name.toLowerCase().includes(searchTerm) || 
    record.employeeId.toLowerCase().includes(searchTerm)
  );
  
  // Reset to first page
  currentPage = 1;
  
  // Update table
  populateAttendanceTable();
}

// Update summary cards with counts
function updateSummaryCards() {
  const totalAttendance = filteredData.length;
  const ontimeCount = filteredData.filter(record => record.status === "Tepat Waktu").length;
  const lateCount = filteredData.filter(record => record.status === "Terlambat").length;
  const absentCount = filteredData.filter(record => record.status === "Tidak Hadir").length;
  const leaveCount = filteredData.filter(record => record.status === "Izin").length;
  
  document.getElementById("totalAttendance").textContent = totalAttendance;
  document.getElementById("ontimeCount").textContent = ontimeCount;
  document.getElementById("lateCount").textContent = lateCount;
  document.getElementById("absentCount").textContent = absentCount;
}

// Update statistics
function updateStatistics() {
  const totalRecords = filteredData.length;
  
  if (totalRecords === 0) {
    return;
  }
  
  // Calculate percentages
  const ontimeCount = filteredData.filter(record => record.status === "Tepat Waktu").length;
  const lateCount = filteredData.filter(record => record.status === "Terlambat").length;
  const absentCount = filteredData.filter(record => record.status === "Tidak Hadir").length;
  const leaveCount = filteredData.filter(record => record.status === "Izin").length;
  
  const ontimePercentage = (ontimeCount / totalRecords) * 100;
  const latePercentage = (lateCount / totalRecords) * 100;
  const absentPercentage = (absentCount / totalRecords) * 100;
  const leavePercentage = (leaveCount / totalRecords) * 100;
  
  // Update progress bars
  const ontimeBar = document.getElementById("ontimePercentage");
  const lateBar = document.getElementById("latePercentage");
  const absentBar = document.getElementById("absentPercentage");
  const leaveBar = document.getElementById("leavePercentage");
  
  ontimeBar.style.width = `${ontimePercentage}%`;
  lateBar.style.width = `${latePercentage}%`;
  absentBar.style.width = `${absentPercentage}%`;
  leaveBar.style.width = `${leavePercentage}%`;
  
  ontimeBar.textContent = `${Math.round(ontimePercentage)}%`;
  lateBar.textContent = `${Math.round(latePercentage)}%`;
  absentBar.textContent = `${Math.round(absentPercentage)}%`;
  leaveBar.textContent = `${Math.round(leavePercentage)}%`;
  
  // Calculate average work duration
  let totalDurationMinutes = 0;
  let workRecordsCount = 0;
  
  filteredData.forEach(record => {
    if (record.timeIn && record.timeOut) {
      const timeIn = new Date(record.timeIn);
      const timeOut = new Date(record.timeOut);
      const durationMs = timeOut - timeIn;
      const durationMinutes = Math.floor(durationMs / (1000 * 60));
      
      totalDurationMinutes += durationMinutes;
      workRecordsCount++;
    }
  });
  
  const avgDurationMinutes = workRecordsCount > 0 ? totalDurationMinutes / workRecordsCount : 0;
  const avgHours = Math.floor(avgDurationMinutes / 60);
  const avgMinutes = Math.floor(avgDurationMinutes % 60);
  
  document.getElementById("avgWorkDuration").textContent = `${avgHours}j ${avgMinutes}m`;
  
  // Calculate average late time
  let totalLateMinutes = 0;
  let lateRecordsCount = 0;
  
  filteredData.forEach(record => {
    if (record.status === "Terlambat" && record.lateMinutes) {
      totalLateMinutes += record.lateMinutes;
      lateRecordsCount++;
    }
  });
  
  const avgLateMinutes = lateRecordsCount > 0 ? Math.round(totalLateMinutes / lateRecordsCount) : 0;
  document.getElementById("avgLateTime").textContent = `${avgLateMinutes}m`;
}
// Populate attendance table with data
function populateAttendanceTable() {
    const tbody = document.getElementById("attendanceReportList");
    tbody.innerHTML = "";
    
    // Calculate pagination
    const totalPages = Math.ceil(filteredData.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, filteredData.length);
    
    // Get current page data
    const currentPageData = filteredData.slice(startIndex, endIndex);
    
    // Add rows to table
    currentPageData.forEach(record => {
      const row = document.createElement("tr");
      
      // Format date
      const date = new Date(record.date).toLocaleDateString("id-ID", {
        day: "numeric",
        month: "long",
        year: "numeric"
      });
      
      // Format times
      const timeIn = record.timeIn ? new Date(record.timeIn).toLocaleTimeString("id-ID", {
        hour: "2-digit",
        minute: "2-digit"
      }) : "-";
      
      const timeOut = record.timeOut ? new Date(record.timeOut).toLocaleTimeString("id-ID", {
        hour: "2-digit",
        minute: "2-digit"
      }) : "-";
      
      // Calculate duration
      let duration = "-";
      if (record.timeIn && record.timeOut) {
        const timeInDate = new Date(record.timeIn);
        const timeOutDate = new Date(record.timeOut);
        const durationMs = timeOutDate - timeInDate;
        const durationHours = Math.floor(durationMs / (1000 * 60 * 60));
        const durationMinutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
        duration = `${durationHours}j ${durationMinutes}m`;
      }
      
      // Determine status class
      let statusClass = "";
      switch (record.status) {
        case "Tepat Waktu":
          statusClass = "status-ontime";
          break;
        case "Terlambat":
          statusClass = "status-late";
          break;
        case "Tidak Hadir":
          statusClass = "status-absent";
          break;
        case "Izin":
          statusClass = "status-leave";
          break;
      }
      
      // Format employee type and shift
      const employeeType = record.type === "staff" ? "Staff" : "Office Boy";
      const shift = record.shift === "morning" ? "Pagi" : "Sore";
      
      row.innerHTML = `
        <td>${date}</td>
        <td>${record.employeeId}</td>
        <td>${record.name}</td>
        <td>${employeeType}</td>
        <td>${shift}</td>
        <td>${timeIn}</td>
        <td class="${statusClass}">${record.status}</td>
        <td>${timeOut}</td>
        <td>${duration}</td>
        <td>${record.notes || "-"}</td>
      `;
      
      // Add click event to show detail modal
      row.addEventListener("click", () => showAttendanceDetail(record));
      
      tbody.appendChild(row);
    });
    
    // Update pagination
    updatePagination(totalPages);
  }
  
  // Update pagination
function updatePagination(totalPages) {
    const pagination = document.getElementById("pagination");
    pagination.innerHTML = "";
    
    if (totalPages <= 1) {
      return;
    }
    
    // Previous button
    const prevLi = document.createElement("li");
    prevLi.className = `page-item ${currentPage === 1 ? 'disabled' : ''}`;
    prevLi.innerHTML = `<a class="page-link" href="#" aria-label="Previous">
                          <span aria-hidden="true">&laquo;</span>
                        </a>`;
    if (currentPage > 1) {
      prevLi.addEventListener("click", () => {
        currentPage--;
        populateAttendanceTable();
      });
    }
    pagination.appendChild(prevLi);
    
    // Page numbers
    const maxVisiblePages = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
    
    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }
    
    // First page
    if (startPage > 1) {
      const firstLi = document.createElement("li");
      firstLi.className = "page-item";
      firstLi.innerHTML = `<a class="page-link" href="#">1</a>`;
      firstLi.addEventListener("click", () => {
        currentPage = 1;
        populateAttendanceTable();
      });
      pagination.appendChild(firstLi);
      
      if (startPage > 2) {
        const ellipsisLi = document.createElement("li");
        ellipsisLi.className = "page-item disabled";
        ellipsisLi.innerHTML = `<a class="page-link" href="#">...</a>`;
        pagination.appendChild(ellipsisLi);
      }
    }
    
    // Page numbers
    for (let i = startPage; i <= endPage; i++) {
      const pageLi = document.createElement("li");
      pageLi.className = `page-item ${i === currentPage ? 'active' : ''}`;
      pageLi.innerHTML = `<a class="page-link" href="#">${i}</a>`;
      
      if (i !== currentPage) {
        pageLi.addEventListener("click", () => {
          currentPage = i;
          populateAttendanceTable();
        });
      }
      
      pagination.appendChild(pageLi);
    }
    
    // Last page
    if (endPage < totalPages) {
      if (endPage < totalPages - 1) {
        const ellipsisLi = document.createElement("li");
        ellipsisLi.className = "page-item disabled";
        ellipsisLi.innerHTML = `<a class="page-link" href="#">...</a>`;
        pagination.appendChild(ellipsisLi);
      }
      
      const lastLi = document.createElement("li");
      lastLi.className = "page-item";
      lastLi.innerHTML = `<a class="page-link" href="#">${totalPages}</a>`;
      lastLi.addEventListener("click", () => {
        currentPage = totalPages;
        populateAttendanceTable();
      });
      pagination.appendChild(lastLi);
    }
    
    // Next button
    const nextLi = document.createElement("li");
    nextLi.className = `page-item ${currentPage === totalPages ? 'disabled' : ''}`;
    nextLi.innerHTML = `<a class="page-link" href="#" aria-label="Next">
                          <span aria-hidden="true">&raquo;</span>
                        </a>`;
    if (currentPage < totalPages) {
      nextLi.addEventListener("click", () => {
        currentPage++;
        populateAttendanceTable();
      });
    }
    pagination.appendChild(nextLi);
  }
  
  // Show attendance detail modal
  function showAttendanceDetail(record) {
    // Format date
    const date = new Date(record.date).toLocaleDateString("id-ID", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric"
    });
    
    // Format times
    const timeIn = record.timeIn ? new Date(record.timeIn).toLocaleTimeString("id-ID") : "-";
    const timeOut = record.timeOut ? new Date(record.timeOut).toLocaleTimeString("id-ID") : "-";
    
    // Calculate duration
    let duration = "-";
    if (record.timeIn && record.timeOut) {
      const timeInDate = new Date(record.timeIn);
      const timeOutDate = new Date(record.timeOut);
      const durationMs = timeOutDate - timeInDate;
      const durationHours = Math.floor(durationMs / (1000 * 60 * 60));
      const durationMinutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
      duration = `${durationHours} jam ${durationMinutes} menit`;
    }
    
    // Format employee type and shift
    const employeeType = record.type === "staff" ? "Staff" : "Office Boy";
    const shift = record.shift === "morning" ? "Shift Pagi" : "Shift Sore";
    
    // Set modal content
    document.getElementById("detailEmployeeId").textContent = record.employeeId;
    document.getElementById("detailName").textContent = record.name;
    document.getElementById("detailDate").textContent = date;
    document.getElementById("detailStatus").textContent = record.status;
    document.getElementById("detailTimeIn").textContent = timeIn;
    document.getElementById("detailTimeOut").textContent = timeOut;
    document.getElementById("detailType").textContent = employeeType;
    document.getElementById("detailShift").textContent = shift;
    document.getElementById("detailDuration").textContent = duration;
    document.getElementById("detailNotes").textContent = record.notes || "-";
    
    // Add status color to status text
    const statusElement = document.getElementById("detailStatus");
    statusElement.className = "";
    
    switch (record.status) {
      case "Tepat Waktu":
        statusElement.classList.add("status-ontime");
        break;
      case "Terlambat":
        statusElement.classList.add("status-late");
        break;
      case "Tidak Hadir":
        statusElement.classList.add("status-absent");
        break;
      case "Izin":
        statusElement.classList.add("status-leave");
        break;
    }
    
    // Show modal
    const modal = new bootstrap.Modal(document.getElementById("attendanceDetailModal"));
    modal.show();
  }
  
  // Show report elements
  function showReportElements() {
    document.getElementById("summaryCards").style.display = "flex";
    document.getElementById("actionButtons").style.display = "flex";
    document.getElementById("statisticsCard").style.display = "block";
    document.getElementById("tableContainer").style.display = "block";
    document.getElementById("noDataMessage").style.display = "none";
  }
  
  // Hide report elements
  function hideReportElements() {
    document.getElementById("summaryCards").style.display = "none";
    document.getElementById("actionButtons").style.display = "none";
    document.getElementById("statisticsCard").style.display = "none";
    document.getElementById("tableContainer").style.display = "none";
  }
  
  // Export data to Excel
  function exportToExcel() {
    try {
      const startDate = new Date(document.getElementById("startDate").value);
      const endDate = new Date(document.getElementById("endDate").value);
      
      // Format date range for filename
      const startDateStr = startDate.toLocaleDateString("id-ID", {
        day: "numeric",
        month: "short",
        year: "numeric"
      });
      
      const endDateStr = endDate.toLocaleDateString("id-ID", {
        day: "numeric",
        month: "short",
        year: "numeric"
      });
      
      // Prepare worksheet data
      const wsData = [
        ["LAPORAN KEHADIRAN KARYAWAN MELATI GOLD SHOP"],
        [`PERIODE: ${startDateStr} - ${endDateStr}`],
        [""],
        [
          "Tanggal",
          "ID Staff",
          "Nama",
          "Tipe",
          "Shift",
          "Waktu Masuk",
          "Status",
          "Waktu Pulang",
          "Durasi Kerja",
          "Keterangan"
        ],
      ];
      
      // Add data rows
      filteredData.forEach(record => {
        // Format date
        const date = new Date(record.date).toLocaleDateString("id-ID", {
          day: "numeric",
          month: "long",
          year: "numeric"
        });
        
        // Format times
        const timeIn = record.timeIn ? new Date(record.timeIn).toLocaleTimeString("id-ID", {
          hour: "2-digit",
          minute: "2-digit"
        }) : "-";
        
        const timeOut = record.timeOut ? new Date(record.timeOut).toLocaleTimeString("id-ID", {
          hour: "2-digit",
          minute: "2-digit"
        }) : "-";
        
        // Calculate duration
        let duration = "-";
        if (record.timeIn && record.timeOut) {
          const timeInDate = new Date(record.timeIn);
          const timeOutDate = new Date(record.timeOut);
          const durationMs = timeOutDate - timeInDate;
          const durationHours = Math.floor(durationMs / (1000 * 60 * 60));
          const durationMinutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
          duration = `${durationHours}j ${durationMinutes}m`;
        }
        
        // Format employee type and shift
        const employeeType = record.type === "staff" ? "Staff" : "Office Boy";
        const shift = record.shift === "morning" ? "Pagi" : "Sore";
        
        wsData.push([
          date,
          record.employeeId,
          record.name,
          employeeType,
          shift,
          timeIn,
          record.status,
          timeOut,
          duration,
          record.notes || "-"
        ]);
      });
      
      // Create worksheet and workbook
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      const wb = XLSX.utils.book_new();
      
      // Set column widths
      const colWidths = [
        { wch: 20 }, // Tanggal
        { wch: 10 }, // ID Staff
        { wch: 20 }, // Nama
        { wch: 10 }, // Tipe
        { wch: 10 }, // Shift
        { wch: 15 }, // Waktu Masuk
        { wch: 15 }, // Status
        { wch: 15 }, // Waktu Pulang
        { wch: 15 }, // Durasi Kerja
        { wch: 25 }, // Keterangan
      ];
      ws["!cols"] = colWidths;
      
      // Merge cells for title and period
      ws["!merges"] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 9 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: 9 } },
      ];
      
      // Style the header cells
      for (let i = 0; i <= 9; i++) {
        const cellRef = XLSX.utils.encode_cell({ r: 3, c: i });
        if (!ws[cellRef]) ws[cellRef] = {};
        ws[cellRef].s = {
          font: { bold: true },
          fill: { fgColor: { rgb: "EEEEEE" } },
        };
      }
      
      XLSX.utils.book_append_sheet(wb, ws, "Laporan Kehadiran");
      
      // Generate filename
      const fileName = `Laporan_Kehadiran_${startDate.toISOString().split('T')[0]}_${endDate.toISOString().split('T')[0]}.xlsx`;
      
      // Export file
      XLSX.writeFile(wb, fileName);
      
      showAlert("success", `<i class="fas fa-check-circle me-2"></i> Berhasil mengekspor data ke Excel: ${fileName}`);
    } catch (error) {
      console.error("Error exporting to Excel:", error);
      showAlert("danger", '<i class="fas fa-exclamation-circle me-2"></i> Gagal mengekspor data ke Excel');
    }
  }
  
  // Export data to PDF
  function exportToPDF() {
    try {
      const startDate = new Date(document.getElementById("startDate").value);
      const endDate = new Date(document.getElementById("endDate").value);
      
      // Format date range for title
      const startDateStr = startDate.toLocaleDateString("id-ID", {
        day: "numeric",
        month: "long",
        year: "numeric"
      });
      
      const endDateStr = endDate.toLocaleDateString("id-ID", {
        day: "numeric",
        month: "long",
        year: "numeric"
      });
      
      // Create PDF document
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF("landscape", "mm", "a4");
      
      // Add title
      doc.setFontSize(16);
      doc.setFont(undefined, "bold");
      doc.text("LAPORAN KEHADIRAN KARYAWAN MELATI GOLD SHOP", 149, 15, { align: "center" });
      
      // Add period
      doc.setFontSize(12);
      doc.text(`PERIODE: ${startDateStr} - ${endDateStr}`, 149, 22, { align: "center" });
      
      // Add current date
      const currentDate = new Date().toLocaleDateString("id-ID", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
      doc.setFontSize(10);
      doc.setFont(undefined, "normal");
      doc.text(`Dicetak pada: ${currentDate}`, 149, 28, { align: "center" });
      
      // Add summary
      doc.setFontSize(11);
      doc.setFont(undefined, "bold");
      
      const totalAttendance = filteredData.length;
      const ontimeCount = filteredData.filter(record => record.status === "Tepat Waktu").length;
      const lateCount = filteredData.filter(record => record.status === "Terlambat").length;
      const absentCount = filteredData.filter(record => record.status === "Tidak Hadir").length;
      const leaveCount = filteredData.filter(record => record.status === "Izin").length;
      
      doc.text(`Total: ${totalAttendance}`, 15, 35);
      doc.text(`Tepat Waktu: ${ontimeCount}`, 65, 35);
      doc.text(`Terlambat: ${lateCount}`, 115, 35);
      doc.text(`Tidak Hadir: ${absentCount}`, 165, 35);
      doc.text(`Izin: ${leaveCount}`, 215, 35);
      
      // Prepare table data
      const tableColumn = [
        "Tanggal",
        "ID Staff",
        "Nama",
        "Tipe",
        "Shift",
        "Waktu Masuk",
        "Status",
        "Waktu Pulang",
        "Durasi"
      ];
      
      const tableRows = [];
      
      // Add data rows (limit to first 100 records to avoid PDF size issues)
      const maxRows = Math.min(filteredData.length, 100);
      for (let i = 0; i < maxRows; i++) {
        const record = filteredData[i];
        
        // Format date
        const date = new Date(record.date).toLocaleDateString("id-ID", {
          day: "numeric",
          month: "short",
          year: "numeric"
        });
        
        // Format times
        const timeIn = record.timeIn ? new Date(record.timeIn).toLocaleTimeString("id-ID", {
          hour: "2-digit",
          minute: "2-digit"
        }) : "-";
        
        const timeOut = record.timeOut ? new Date(record.timeOut).toLocaleTimeString("id-ID", {
          hour: "2-digit",
          minute: "2-digit"
        }) : "-";
        
        // Calculate duration
        let duration = "-";
        if (record.timeIn && record.timeOut) {
          const timeInDate = new Date(record.timeIn);
          const timeOutDate = new Date(record.timeOut);
          const durationMs = timeOutDate - timeInDate;
          const durationHours = Math.floor(durationMs / (1000 * 60 * 60));
          const durationMinutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
          duration = `${durationHours}j ${durationMinutes}m`;
        }
        
        // Format employee type and shift
        const employeeType = record.type === "staff" ? "Staff" : "OB";
        const shift = record.shift === "morning" ? "Pagi" : "Sore";
        
        tableRows.push([
          date,
          record.employeeId,
          record.name,
          employeeType,
          shift,
          timeIn,
          record.status,
          timeOut,
          duration
        ]);
      }
      
      // Add table
      doc.autoTable({
        head: [tableColumn],
        body: tableRows,
        startY: 40,
        theme: "grid",
        styles: {
          fontSize: 8,
          cellPadding: 2,
        },
        headStyles: {
          fillColor: [66, 66, 66],
          textColor: 255,
          fontStyle: "bold",
        },
        alternateRowStyles: {
          fillColor: [245, 245, 245],
        },
        columnStyles: {
          0: { cellWidth: 25 }, // Tanggal
          1: { cellWidth: 20 }, // ID Staff
          2: { cellWidth: 35 }, // Nama
          3: { cellWidth: 15 }, // Tipe
          4: { cellWidth: 15 }, // Shift
          5: { cellWidth: 20 }, // Waktu Masuk
          6: { cellWidth: 20 }, // Status
          7: { cellWidth: 20 }, // Waktu Pulang
          8: { cellWidth: 20 }, // Durasi
        },
      });
      
      // Add note if data was truncated
      if (filteredData.length > 100) {
        const finalY = doc.lastAutoTable.finalY || 150;
        doc.setFontSize(10);
        doc.setFont(undefined, "italic");
        doc.setTextColor(100, 100, 100);
        doc.text(`* Catatan: Hanya 100 data pertama yang ditampilkan dari total ${filteredData.length} data.`, 15, finalY + 10);
      }
      
      // Add footer
      const pageCount = doc.internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(100, 100, 100);
        doc.text(`Halaman ${i} dari ${pageCount}`, 290, 200, { align: "right" });
        doc.text("© Melati Gold Shop", 15, 200);
      }
      
      // Generate filename
      const fileName = `Laporan_Kehadiran_${startDate.toISOString().split('T')[0]}_${endDate.toISOString().split('T')[0]}.pdf`;
      
      // Save PDF
      doc.save(fileName);
      
      showAlert("success", `<i class="fas fa-check-circle me-2"></i> Berhasil mengekspor data ke PDF: ${fileName}`);
    } catch (error) {
      console.error("Error exporting to PDF:", error);
      showAlert("danger", '<i class="fas fa-exclamation-circle me-2"></i> Gagal mengekspor data ke PDF');
    }
  }
  
  // Show delete confirmation modal
  function showDeleteConfirmation() {
    const startDate = new Date(document.getElementById("startDate").value);
    const endDate = new Date(document.getElementById("endDate").value);
    
    // Format date range for display
    const startDateStr = startDate.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric"
    });
    
    const endDateStr = endDate.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric"
    });
    
    // Update modal content
    document.getElementById("deletePeriod").textContent = `${startDateStr} hingga ${endDateStr}`;
    
    // Show modal
    const deleteModal = new bootstrap.Modal(document.getElementById("deleteConfirmModal"));
    deleteModal.show();
  }
  
  // Delete attendance data for the selected period
  async function deleteAttendanceData() {
    try {
      const startDate = document.getElementById("startDate").value;
      const endDate = document.getElementById("endDate").value;
      
      // Close modal
      const deleteModal = bootstrap.Modal.getInstance(document.getElementById("deleteConfirmModal"));
      deleteModal.hide();
      
      // Show loading state
      showAlert("info", '<i class="fas fa-spinner fa-spin me-2"></i> Menghapus data kehadiran...', false);
      
      // Delete data
      const deletedCount = await deleteAttendanceByDateRange(startDate, endDate);
      
      if (deletedCount > 0) {
        showAlert(
          "success",
          `<i class="fas fa-check-circle me-2"></i> Berhasil menghapus ${deletedCount} data kehadiran untuk periode yang dipilih`
        );
        
        // Reset UI
        hideReportElements();
        document.getElementById("noDataMessage").style.display = "block";
        currentAttendanceData = [];
        filteredData = [];
      } else {
        showAlert(
          "warning",
          `<i class="fas fa-exclamation-triangle me-2"></i> Tidak ada data kehadiran untuk dihapus pada periode yang dipilih`
        );
      }
    } catch (error) {
      console.error("Error deleting data:", error);
      showAlert(
        "danger",
        '<i class="fas fa-exclamation-circle me-2"></i> Terjadi kesalahan saat menghapus data: ' + error.message
      );
    }
  }
  
  // Show alert message
  function showAlert(type, message, autoHide = true) {
    const alertContainer = document.getElementById("alertContainer");
    alertContainer.innerHTML = `
      <div class="alert alert-${type} alert-dismissible fade show" role="alert">
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
      </div>
    `;
    alertContainer.style.display = "block";
    
    // Auto hide after 5 seconds if needed
    if (autoHide) {
      setTimeout(() => {
        const alert = document.querySelector(".alert");
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
    alertContainer.innerHTML = "";
    alertContainer.style.display = "none";
  }
  // Get attendance data by date range
export async function getAttendanceByDateRange(startDate, endDate) {
    try {
      // Format dates for API
      const formattedStartDate = new Date(startDate).toISOString().split('T')[0];
      const formattedEndDate = new Date(endDate).toISOString().split('T')[0];
      
      // Fetch data from API or local storage
      // This is a placeholder - replace with actual API call
      const response = await fetch(`/api/attendance?startDate=${formattedStartDate}&endDate=${formattedEndDate}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      return data;
    } catch (error) {
      console.error("Error fetching attendance data:", error);
      
      // For development/demo purposes, return mock data
      return generateMockAttendanceData(startDate, endDate);
    }
  }
  
  // Delete attendance data by date range
  export async function deleteAttendanceByDateRange(startDate, endDate) {
    try {
      // Format dates for API
      const formattedStartDate = new Date(startDate).toISOString().split('T')[0];
      const formattedEndDate = new Date(endDate).toISOString().split('T')[0];
      
      // Delete data via API
      // This is a placeholder - replace with actual API call
      const response = await fetch(`/api/attendance?startDate=${formattedStartDate}&endDate=${formattedEndDate}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      return result.deletedCount || 0;
    } catch (error) {
      console.error("Error deleting attendance data:", error);
      
      // For development/demo purposes, return mock result
      return 15; // Mock number of deleted records
    }
  }
  
  // Get leave requests by month
  export async function getLeaveRequestsByMonth(month, year) {
    try {
      // Fetch data from API or local storage
      // This is a placeholder - replace with actual API call
      const response = await fetch(`/api/leave-requests?month=${month}&year=${year}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      return data;
    } catch (error) {
      console.error("Error fetching leave requests:", error);
      
      // For development/demo purposes, return mock data
      return generateMockLeaveData(month, year);
    }
  }
  
  // Delete leave requests by month
  export async function deleteLeaveRequestsByMonth(month, year) {
    try {
      // Delete data via API
      // This is a placeholder - replace with actual API call
      const response = await fetch(`/api/leave-requests?month=${month}&year=${year}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      return result.deletedCount || 0;
    } catch (error) {
      console.error("Error deleting leave requests:", error);
      
      // For development/demo purposes, return mock result
      return 8; // Mock number of deleted records
    }
  }
  
  // Generate mock attendance data for development/demo purposes
  function generateMockAttendanceData(startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const mockData = [];
    
    const employees = [
      { employeeId: "EMP001", name: "Budi Santoso", type: "staff", shift: "morning" },
      { employeeId: "EMP002", name: "Siti Rahayu", type: "staff", shift: "afternoon" },
      { employeeId: "EMP003", name: "Ahmad Hidayat", type: "staff", shift: "morning" },
      { employeeId: "EMP004", name: "Dewi Lestari", type: "staff", shift: "afternoon" },
      { employeeId: "EMP005", name: "Joko Widodo", type: "ob", shift: "morning" },
      { employeeId: "EMP006", name: "Rina Marlina", type: "ob", shift: "afternoon" }
    ];
    
    // Loop through each day in the date range
    for (let day = new Date(start); day <= end; day.setDate(day.getDate() + 1)) {
      const currentDate = new Date(day);
      
      // Skip weekends for some employees to simulate days off
      const isWeekend = currentDate.getDay() === 0 || currentDate.getDay() === 6;
      
      // For each employee, create an attendance record
      employees.forEach(employee => {
        // Skip some weekend records
        if (isWeekend && Math.random() > 0.3) {
          return;
        }
        
        // Determine if employee is present, absent, or on leave
        const rand = Math.random();
        let status, timeIn, timeOut, notes, lateMinutes;
        
        if (rand > 0.9) {
          // Employee is absent
          status = "Tidak Hadir";
          timeIn = null;
          timeOut = null;
          notes = "Tidak ada keterangan";
        } else if (rand > 0.8) {
          // Employee is on leave
          status = "Izin";
          timeIn = null;
          timeOut = null;
          notes = "Izin sakit";
        } else {
          // Employee is present
          // Set base time based on shift
          let baseHourIn, baseMinuteIn, baseHourOut, baseMinuteOut;
          
          if (employee.type === "staff") {
            if (employee.shift === "morning") {
              baseHourIn = 8;
              baseMinuteIn = 45;
              baseHourOut = 16;
              baseMinuteOut = 30;
            } else {
                baseHourIn = 14;
                baseMinuteIn = 20;
                baseHourOut = 21;
                baseMinuteOut = 0;
              }
            } else { // Office Boy
              if (employee.shift === "morning") {
                baseHourIn = 7;
                baseMinuteIn = 30;
                baseHourOut = 15;
                baseMinuteOut = 30;
              } else {
                baseHourIn = 13;
                baseMinuteIn = 30;
                baseHourOut = 21;
                baseMinuteOut = 0;
              }
            }
            
            // Add some randomness to check-in time
            const minuteVariation = Math.floor(Math.random() * 30) - 10; // -10 to +19 minutes
            
            // Create time in
            const timeInObj = new Date(currentDate);
            timeInObj.setHours(baseHourIn, baseMinuteIn + minuteVariation, 0);
            timeIn = timeInObj.toISOString();
            
            // Determine if late
            const isLate = minuteVariation > 0;
            status = isLate ? "Terlambat" : "Tepat Waktu";
            lateMinutes = isLate ? minuteVariation : 0;
            
            // Create time out (if present)
            if (rand > 0.05) { // 5% chance of missing checkout
              // Add some randomness to checkout time
              const checkoutVariation = Math.floor(Math.random() * 60) - 10; // -10 to +49 minutes
              
              const timeOutObj = new Date(currentDate);
              timeOutObj.setHours(baseHourOut, baseMinuteOut + checkoutVariation, 0);
              timeOut = timeOutObj.toISOString();
            } else {
              timeOut = null;
              notes = "Lupa checkout";
            }
          }
          
          // Create the attendance record
          mockData.push({
            id: `att-${mockData.length + 1}`,
            employeeId: employee.employeeId,
            name: employee.name,
            type: employee.type,
            shift: employee.shift,
            date: currentDate.toISOString().split('T')[0],
            timeIn: timeIn,
            timeOut: timeOut,
            status: status,
            lateMinutes: lateMinutes,
            notes: notes
          });
        });
      }
      
      return mockData;
    }
    
    // Generate mock leave data for development/demo purposes
    function generateMockLeaveData(month, year) {
      const mockData = [];
      
      const employees = [
        { employeeId: "EMP001", name: "Budi Santoso", type: "staff", shift: "morning" },
        { employeeId: "EMP002", name: "Siti Rahayu", type: "staff", shift: "afternoon" },
        { employeeId: "EMP003", name: "Ahmad Hidayat", type: "staff", shift: "morning" },
        { employeeId: "EMP004", name: "Dewi Lestari", type: "staff", shift: "afternoon" },
        { employeeId: "EMP005", name: "Joko Widodo", type: "ob", shift: "morning" },
        { employeeId: "EMP006", name: "Rina Marlina", type: "ob", shift: "afternoon" }
      ];
      
      const reasons = [
        "Sakit",
        "Urusan keluarga",
        "Acara keluarga",
        "Keperluan pribadi",
        "Kendaraan rusak"
      ];
      
      // Generate between 5-15 leave requests for the month
      const numRequests = 5 + Math.floor(Math.random() * 10);
      
      for (let i = 0; i < numRequests; i++) {
        // Random employee
        const employee = employees[Math.floor(Math.random() * employees.length)];
        
        // Random date in the month
        const daysInMonth = new Date(year, month, 0).getDate();
        const day = 1 + Math.floor(Math.random() * daysInMonth);
        const leaveDate = new Date(year, month - 1, day);
        
        // Format leave date
        const formattedLeaveDate = leaveDate.toLocaleDateString("id-ID", {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric"
        });
        
        // Random reason
        const reason = reasons[Math.floor(Math.random() * reasons.length)];
        
        // Random replacement type
        const replacementType = Math.random() > 0.5 ? "libur" : "jam";
        
        // Random replacement details
        let replacementDetails;
        if (replacementType === "libur") {
          // Random replacement date (1-4 weeks after leave date)
          const replacementDate = new Date(leaveDate);
          replacementDate.setDate(replacementDate.getDate() + 7 + Math.floor(Math.random() * 21));
          
          replacementDetails = {
            date: replacementDate.toISOString().split('T')[0],
            formattedDate: replacementDate.toLocaleDateString("id-ID", {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric"
            })
          };
        } else {
          // Random replacement date (1-2 weeks after leave date)
          const replacementDate = new Date(leaveDate);
          replacementDate.setDate(replacementDate.getDate() + 7 + Math.floor(Math.random() * 7));
          
          // Random hours (2-8)
          const hours = 2 + Math.floor(Math.random() * 6);
          
          replacementDetails = {
            date: replacementDate.toISOString().split('T')[0],
            hours: hours,
            formattedDate: replacementDate.toLocaleDateString("id-ID", {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric"
            })
          };
        }
        
        // Random status
        const statusRand = Math.random();
        let status, replacementStatus, decisionDate;
        
        if (statusRand < 0.7) {
          // Approved
          status = "Approved";
          
          // Decision date (1-2 days after submit)
          const submitDate = new Date(leaveDate);
          submitDate.setDate(submitDate.getDate() - 7 - Math.floor(Math.random() * 7)); // Submit 1-2 weeks before
          
          decisionDate = new Date(submitDate);
          decisionDate.setDate(decisionDate.getDate() + 1 + Math.floor(Math.random() * 2));
          
          // Replacement status
          replacementStatus = leaveDate < new Date() ? 
            (Math.random() > 0.3 ? "Sudah Diganti" : "Belum Diganti") : 
            "Belum Diganti";
        } else if (statusRand < 0.9) {
          // Rejected
          status = "Rejected";
          
          // Decision date (1-2 days after submit)
          const submitDate = new Date(leaveDate);
          submitDate.setDate(submitDate.getDate() - 7 - Math.floor(Math.random() * 7)); // Submit 1-2 weeks before
          
          decisionDate = new Date(submitDate);
          decisionDate.setDate(decisionDate.getDate() + 1 + Math.floor(Math.random() * 2));
          
          replacementStatus = "Tidak Perlu Diganti";
        } else {
          // Pending
          status = "Pending";
          decisionDate = null;
          replacementStatus = "Belum Diganti";
        }
        
        // Create leave request
        mockData.push({
          id: `leave-${mockData.length + 1}`,
          employeeId: employee.employeeId,
          name: employee.name,
          type: employee.type,
          shift: employee.shift,
          submitDate: new Date(leaveDate.getFullYear(), leaveDate.getMonth(), leaveDate.getDate() - 7 - Math.floor(Math.random() * 7)).toISOString(),
          leaveDate: formattedLeaveDate,
          rawLeaveDate: leaveDate.toISOString().split('T')[0],
          reason: reason,
          replacementType: replacementType,
          replacementDetails: replacementDetails,
          status: status,
          decisionDate: decisionDate ? decisionDate.toISOString() : null,
          replacementStatus: replacementStatus
        });
      }
      
      return mockData;
    }