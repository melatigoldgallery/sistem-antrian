import { getLeaveRequestsByMonth, deleteLeaveRequestsByMonth } from "../services/report-service.js";

// Global variables
let currentLeaveData = [];
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
  document.getElementById("monthSelector").value = currentDate.getMonth() + 1;
  document.getElementById("yearSelector").value = currentDate.getFullYear();
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
  document.getElementById("confirmDeleteBtn").addEventListener("click", deleteMonthData);
  
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
}

// Generate report based on selected month and year
async function generateReport() {
  try {
    const month = parseInt(document.getElementById("monthSelector").value);
    const year = parseInt(document.getElementById("yearSelector").value);

    // Show loading state
    showAlert("info", '<i class="fas fa-spinner fa-spin me-2"></i> Memuat data izin...', false);

    // Fetch data
    currentLeaveData = await getLeaveRequestsByMonth(month, year);

    // Hide alert
    hideAlert();

    // Update UI based on data
    if (currentLeaveData.length > 0) {
      updateSummaryCards();
      populateLeaveTable();
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

// Update summary cards with counts
function updateSummaryCards() {
  const totalLeaves = currentLeaveData.length;
  const approvedLeaves = currentLeaveData.filter((item) => item.status === "Approved").length;
  const rejectedLeaves = currentLeaveData.filter((item) => item.status === "Rejected").length;
  const pendingLeaves = currentLeaveData.filter((item) => item.status === "Pending").length;

  document.getElementById("totalLeaves").textContent = totalLeaves;
  document.getElementById("approvedLeaves").textContent = approvedLeaves;
  document.getElementById("rejectedLeaves").textContent = rejectedLeaves;
  document.getElementById("pendingLeaves").textContent = pendingLeaves;
}

// Populate leave table with data
function populateLeaveTable() {
  const tbody = document.getElementById("leaveReportList");
  tbody.innerHTML = "";

  currentLeaveData.forEach((record, index) => {
    const replacementInfo = getReplacementInfo(record);
    const row = document.createElement("tr");

    row.innerHTML = `
            <td>${index + 1}</td>
            <td>${record.employeeId}</td>
            <td>${record.name}</td>
            <td>${formatDate(record.submitDate)}</td>
            <td>${record.leaveDate}</td>
            <td>${record.reason}</td>
            <td>${record.replacementType === "libur" ? "Ganti Libur" : "Ganti Jam"}</td>
            <td>${replacementInfo}</td>
            <td class="status-${record.status.toLowerCase()}">${record.status}</td>
            <td>${record.decisionDate ? formatDate(record.decisionDate) : "-"}</td>
            <td class="status-${record.replacementStatus.toLowerCase().replace(/\s+/g, "-")}">${
      record.replacementStatus
    }</td>
        `;
    tbody.appendChild(row);
  });
}

// Helper function to format replacement information
function getReplacementInfo(record) {
  if (record.replacementType === "libur") {
    return `Ganti libur pada ${record.replacementDetails.formattedDate}`;
  } else if (record.replacementType === "jam") {
    return `Ganti ${record.replacementDetails.hours} jam pada ${record.replacementDetails.formattedDate}`;
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
}

// Hide report elements
function hideReportElements() {
  document.getElementById("summaryCards").style.display = "none";
  document.getElementById("actionButtons").style.display = "none";
  document.getElementById("tableContainer").style.display = "none";
}

// Filter leave data
function filterLeaveData(filterType, value) {
  const rows = document.querySelectorAll("#leaveReportList tr");

  rows.forEach((row) => {
    let showRow = true;

    if (value !== "all") {
      if (filterType === "status") {
        const statusCell = row.querySelector("td:nth-child(9)").textContent.toLowerCase();
        showRow = (
          (value === "approved" && statusCell === "approved") || 
          (value === "rejected" && statusCell === "rejected") || 
          (value === "pending" && statusCell === "pending")
        );
      } else if (filterType === "replacement") {
        const replacementCell = row.querySelector("td:nth-child(11)").textContent.toLowerCase();
        showRow = (
          (value === "sudah" && replacementCell === "sudah diganti") || 
          (value === "belum" && replacementCell === "belum diganti")
        );
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
    
    document.getElementById("replacementFilterDropdown").innerHTML = `<i class="fas fa-exchange-alt"></i> ${buttonText}`;
  }
}

// Export data to Excel
function exportToExcel() {
  try {
    const month = parseInt(document.getElementById("monthSelector").value);
    const year = parseInt(document.getElementById("yearSelector").value);
    const monthName = monthNames[month - 1];

    // Prepare worksheet data
    const wsData = [
      ["LAPORAN IZIN KARYAWAN MELATI GOLD SHOP"],
      [`PERIODE: ${monthName.toUpperCase()} ${year}`],
      [""],
      [
        "No",
        "ID Staff",
        "Nama",
        "Tanggal Pengajuan",
        "Tanggal Izin",
        "Alasan",
        "Jenis Pengganti",
        "Detail Pengganti",
        "Status",
        "Tanggal Keputusan",
        "Status Ganti",
      ],
    ];

    // Add data rows
    currentLeaveData.forEach((record, index) => {
      wsData.push([
        index + 1,
        record.employeeId,
        record.name,
        formatDate(record.submitDate),
        record.leaveDate,
        record.reason,
        record.replacementType === "libur" ? "Ganti Libur" : "Ganti Jam",
        getReplacementInfo(record),
        record.status,
        record.decisionDate ? formatDate(record.decisionDate) : "-",
        record.replacementStatus,
      ]);
    });

    // Create worksheet and workbook
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();

    // Set column widths
    const colWidths = [
      { wch: 5 }, // No
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
    ];
    ws["!cols"] = colWidths;

    // Merge cells for title and period
    ws["!merges"] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 10 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: 10 } },
    ];

    // Style the header cells
    for (let i = 0; i <= 10; i++) {
      const cellRef = XLSX.utils.encode_cell({ r: 3, c: i });
      if (!ws[cellRef]) ws[cellRef] = {};
      ws[cellRef].s = {
        font: { bold: true },
        fill: { fgColor: { rgb: "EEEEEE" } },
      };
    }

    XLSX.utils.book_append_sheet(wb, ws, "Laporan Izin");

    // Generate filename
    const fileName = `Laporan_Izin_${monthName}_${year}.xlsx`;

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
    const month = parseInt(document.getElementById("monthSelector").value);
    const year = parseInt(document.getElementById("yearSelector").value);
    const monthName = monthNames[month - 1];

    // Create PDF document
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF("landscape", "mm", "a4");

    // Add title
    doc.setFontSize(16);
    doc.setFont(undefined, "bold");
    doc.text("LAPORAN IZIN KARYAWAN MELATI GOLD SHOP", 149, 15, { align: "center" });

    // Add period
    doc.setFontSize(12);
    doc.text(`PERIODE: ${monthName.toUpperCase()} ${year}`, 149, 22, { align: "center" });

    // Add current date
    const currentDate = new Date().toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    doc.setFontSize(10);
    doc.setFont(undefined, "normal");
    doc.text(`Dicetak pada: ${currentDate}`, 149, 28, { align: "center" });

    // Prepare table data
    const tableColumn = [
      "No",
      "ID Staff",
      "Nama",
      "Tanggal Izin",
      "Alasan",
      "Jenis Pengganti",
      "Status",
      "Status Ganti",
    ];
    const tableRows = [];

    currentLeaveData.forEach((record, index) => {
      const rowData = [
        (index + 1).toString(),
        record.employeeId,
        record.name,
        record.leaveDate,
        record.reason,
        record.replacementType === "libur" ? "Ganti Libur" : "Ganti Jam",
        record.status,
        record.replacementStatus,
      ];
      tableRows.push(rowData);
    });

    // Add summary
    doc.setFontSize(11);
    doc.setFont(undefined, "bold");
    doc.text(`Total Izin: ${currentLeaveData.length}`, 15, 35);
    doc.text(`Disetujui: ${currentLeaveData.filter((item) => item.status === "Approved").length}`, 65, 35);
    doc.text(`Ditolak: ${currentLeaveData.filter((item) => item.status === "Rejected").length}`, 115, 35);
    doc.text(`Pending: ${currentLeaveData.filter((item) => item.status === "Pending").length}`, 165, 35);

    // Add table
    doc.autoTable({
      head: [tableColumn],
      body: tableRows,
      startY: 40,
      theme: "grid",
      styles: {
        fontSize: 9,
        cellPadding: 3,
      },
      headStyles: {
        fillColor: [67, 97, 238], // Primary color
        textColor: 255,
        fontStyle: "bold",
      },
      alternateRowStyles: {
        fillColor: [245, 245, 245],
      },
      columnStyles: {
        0: { cellWidth: 10 }, // No
        1: { cellWidth: 20 }, // ID Staff
        2: { cellWidth: 35 }, // Nama
        3: { cellWidth: 35 }, // Tanggal Izin
        4: { cellWidth: 50 }, // Alasan
        5: { cellWidth: 30 }, // Jenis Pengganti
        6: { cellWidth: 20 }, // Status
        7: { cellWidth: 25 }, // Status Ganti
      },
    });

    // Add footer
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.text(`Halaman ${i} dari ${pageCount}`, 290, 200, { align: "right" });
      doc.text("© Melati Gold Shop", 15, 200);
    }

    // Generate filename
    const fileName = `Laporan_Izin_${monthName}_${year}.pdf`;

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
  const month = parseInt(document.getElementById("monthSelector").value);
  const year = parseInt(document.getElementById("yearSelector").value);
  const monthName = monthNames[month - 1];

  // Update modal content
  document.getElementById("deleteMonthName").textContent = monthName;
  document.getElementById("deleteYear").textContent = year;

  // Show modal
  const deleteModal = new bootstrap.Modal(document.getElementById("deleteConfirmModal"));
  deleteModal.show();
}

// Delete data for the selected month
async function deleteMonthData() {
  try {
    const month = parseInt(document.getElementById("monthSelector").value);
    const year = parseInt(document.getElementById("yearSelector").value);
    const monthName = monthNames[month - 1];

    // Close modal
    const deleteModal = bootstrap.Modal.getInstance(document.getElementById("deleteConfirmModal"));
    deleteModal.hide();

    // Show loading state
    showAlert("info", '<i class="fas fa-spinner fa-spin me-2"></i> Menghapus data izin...', false);

    // Delete data
    const deletedCount = await deleteLeaveRequestsByMonth(month, year);

    if (deletedCount > 0) {
      showAlert(
        "success",
        `<i class="fas fa-check-circle me-2"></i> Berhasil menghapus ${deletedCount} data izin untuk bulan ${monthName} ${year}`
      );

      // Reset UI
      hideReportElements();
      document.getElementById("noDataMessage").style.display = "block";
      currentLeaveData = [];
    } else {
      showAlert(
        "warning",
        `<i class="fas fa-exclamation-triangle me-2"></i> Tidak ada data izin untuk dihapus pada bulan ${monthName} ${year}`
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

