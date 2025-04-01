import { getLeaveRequestsByMonth, clearLeaveRequestsCache } from "../services/leave-service.js";
import { deleteLeaveRequestsByMonth } from "../services/report-service.js";

// Global variables
let currentLeaveData = [];
let lastVisibleDoc = null;
let hasMoreData = false;
const itemsPerPage = 50;
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

  // Load more button (if added to HTML)
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
    const month = parseInt(document.getElementById("monthSelector").value);
    const year = parseInt(document.getElementById("yearSelector").value);

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

    // Hide alert
    hideAlert();

    // Update UI based on data
    if (currentLeaveData.length > 0) {
      updateSummaryCards();
      populateLeaveTable();
      showReportElements();

      // Show/hide load more button
      const loadMoreBtn = document.getElementById("loadMoreBtn");
      if (loadMoreBtn) {
        loadMoreBtn.style.display = hasMoreData ? "block" : "none";
      }
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

    // Append new data to current data
    currentLeaveData = [...currentLeaveData, ...newData];

    // Update UI
    populateLeaveTable();

    // Reset button state
    if (loadMoreBtn) {
      loadMoreBtn.innerHTML = '<i class="fas fa-plus me-2"></i> Muat Lebih Banyak';
      loadMoreBtn.disabled = false;
      loadMoreBtn.style.display = hasMoreData ? "block" : "none";
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
function populateLeaveTable() {
  const tbody = document.getElementById("leaveReportList");

  // Clear existing rows if this is a new search
  if (lastVisibleDoc === null || currentLeaveData.length <= itemsPerPage) {
    tbody.innerHTML = "";
  }

  // Get starting index for row numbers
  const startIndex = tbody.children.length;

  // Create document fragment for better performance
  const fragment = document.createDocumentFragment();

  currentLeaveData.slice(startIndex).forEach((record, index) => {
    const replacementInfo = getReplacementInfo(record);
    const row = document.createElement("tr");

    // Add data attributes for filtering
    row.dataset.status = record.status.toLowerCase();
    row.dataset.replacementStatus = record.replacementStatus.toLowerCase().replace(/\s+/g, "-");
    row.dataset.replacementType = record.replacementType || "";

    row.innerHTML = `
                    <td>${startIndex + index + 1}</td>
                    <td>${record.employeeId}</td>
                    <td>${record.name}</td>
                    <td>${formatDate(record.submitDate)}</td>
                    <td>${record.leaveDate}</td>
                    <td>${record.reason}</td>
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
                    <td class="status-${record.replacementStatus.toLowerCase().replace(/\s+/g, "-")}">${
      record.replacementStatus
    }</td>
                `;
    fragment.appendChild(row);
  });

  tbody.appendChild(fragment);
}

// Helper function to format replacement information
function getReplacementInfo(record) {
  if (!record.replacementType || record.replacementType === "tidak") {
    return "-";
  } else if (record.replacementType === "libur") {
    return record.replacementDetails && record.replacementDetails.formattedDate
      ? `Ganti libur pada ${record.replacementDetails.formattedDate}`
      : "-";
  } else if (record.replacementType === "jam") {
    return record.replacementDetails && record.replacementDetails.hours && record.replacementDetails.formattedDate
      ? `Ganti ${record.replacementDetails.hours} jam pada ${record.replacementDetails.formattedDate}`
      : "-";
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
  const loadMoreBtn = document.getElementById("loadMoreBtn");
  if (loadMoreBtn) {
    loadMoreBtn.style.display = hasMoreData ? "block" : "none";
  }
}

// Hide report elements
function hideReportElements() {
  document.getElementById("summaryCards").style.display = "none";
  document.getElementById("actionButtons").style.display = "none";
  document.getElementById("tableContainer").style.display = "none";

  // Hide load more button
  const loadMoreBtn = document.getElementById("loadMoreBtn");
  if (loadMoreBtn) {
    loadMoreBtn.style.display = "none";
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

import { db } from "../configFirebase.js";
import {
  collection,
  query,
  where,
  getDocs,
  writeBatch,
  orderBy,
  limit,
  Timestamp,
} from "https://www.gstatic.com/firebasejs/10.4.0/firebase-firestore.js";

// Get leave requests by month
export async function getLeaveRequestsByMonth(month, year) {
  try {
    const leaveCollection = collection(db, "leaveRequests");

    // Create query for the specific month and year
    const q = query(
      leaveCollection,
      where("month", "==", month),
      where("year", "==", year),
      orderBy("submitDate", "desc"),
      limit(500) // Limit to 500 documents to prevent excessive reads
    );

    const snapshot = await getDocs(q);

    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      // Convert Firestore Timestamp to JS Date
      submitDate: doc.data().submitDate.toDate(),
      decisionDate: doc.data().decisionDate ? doc.data().decisionDate.toDate() : null,
      replacementStatusDate: doc.data().replacementStatusDate ? doc.data().replacementStatusDate.toDate() : null,
    }));
  } catch (error) {
    console.error("Error getting leave requests by month:", error);
    throw error;
  }
}

// Delete leave requests by month
export async function deleteLeaveRequestsByMonth(month, year) {
  try {
    const leaveCollection = collection(db, "leaveRequests");

    // Create query for the specific month and year
    const q = query(leaveCollection, where("month", "==", month), where("year", "==", year));

    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return 0;
    }

    // Use batched writes for efficient deletion
    const batchSize = 500; // Firestore batch limit is 500
    let deletedCount = 0;
    const totalDocs = snapshot.docs.length;

    // Process in batches if needed
    for (let i = 0; i < totalDocs; i += batchSize) {
      const batch = writeBatch(db);
      const currentBatch = snapshot.docs.slice(i, i + batchSize);

      currentBatch.forEach((doc) => {
        batch.delete(doc.ref);
        deletedCount++;
      });

      await batch.commit();
    }

    return deletedCount;
  } catch (error) {
    console.error("Error deleting leave requests by month:", error);
    throw error;
  }
}
