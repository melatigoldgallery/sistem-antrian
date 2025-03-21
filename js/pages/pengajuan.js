//import { checkAuthState } from './auth.js';
import { getEmployees } from '../services/employee-service.js';
import { submitLeaveRequest, getLeaveRequestsByEmployee } from '../services/leave-service.js';

// Check if user is logged in
// checkAuthState((user) => {
//   if (!user) {
//     window.location.href = 'login.html';
//   }
// });

// Initialize data
let employees = [];
let leaveHistory = [];

// Document ready handler
document.addEventListener("DOMContentLoaded", function () {
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
  
  // Initialize the page
  initPage();
});

// Load employees
async function loadEmployees() {
  try {
    employees = await getEmployees();
    console.log("Employees loaded:", employees.length);
    updateStats();
  } catch (error) {
    console.error("Error loading employees:", error);
    showFeedback("error", "Gagal memuat data karyawan. Silakan refresh halaman.");
  }
}

// Initialize page
async function initPage() {
  try {
    // Load employees data
    await loadEmployees();
    
    // Initialize date inputs
    initDateInputs();
    
    // Load leave history if employee ID is in localStorage
    const savedEmployeeId = localStorage.getItem('currentEmployeeId');
    if (savedEmployeeId) {
      document.getElementById('employeeId').value = savedEmployeeId;
      await loadLeaveHistory(savedEmployeeId);
    }
    
    console.log("Pengajuan Izin page initialized successfully");
  } catch (error) {
    console.error("Error initializing page:", error);
    showFeedback("error", "Terjadi kesalahan saat memuat halaman. Silakan refresh browser Anda.");
  }
}

// Load leave history for an employee
async function loadLeaveHistory(employeeId) {
  try {
    if (!employeeId) return;
    
    const employee = employees.find(emp => emp.employeeId === employeeId);
    if (!employee) {
      console.warn("Employee not found:", employeeId);
      return;
    }
    
    leaveHistory = await getLeaveRequestsByEmployee(employeeId);
    updateLeaveHistoryTable();
    updateStats();
  } catch (error) {
    console.error("Error loading leave history:", error);
    showFeedback("error", "Gagal memuat riwayat izin. Silakan coba lagi.");
  }
}

// Update leave history table
function updateLeaveHistoryTable() {
  const tbody = document.getElementById("leaveHistoryList");
  const emptyState = document.getElementById("emptyLeaveHistory");
  
  if (!tbody) return;
  
  tbody.innerHTML = "";
  
  if (leaveHistory.length === 0) {
    if (emptyState) emptyState.style.display = "flex";
    return;
  }
  
  if (emptyState) emptyState.style.display = "none";
  
  // Sort by submission date (newest first)
  const sortedHistory = [...leaveHistory].sort((a, b) => {
    return new Date(b.submissionDate) - new Date(a.submissionDate);
  });
  
  // Display only the 5 most recent requests
  const recentHistory = sortedHistory.slice(0, 5);
  
  recentHistory.forEach(record => {
    const row = document.createElement("tr");
    
    const submissionDate = record.submissionDate ? new Date(record.submissionDate).toLocaleDateString("id-ID") : "-";
    
    const statusClass = 
      record.status === "Disetujui" ? "success" : 
      record.status === "Ditolak" ? "danger" : "warning";
    
    row.innerHTML = `
      <td>${submissionDate}</td>
      <td>${record.leaveDate}</td>
      <td>${record.reason}</td>
      <td>${record.replacementType === "libur" ? "Ganti Libur" : "Ganti Jam"}</td>
      <td><span class="status-badge ${statusClass}">${record.status}</span></td>
    `;
    
    tbody.appendChild(row);
  });
}

// Update statistics
function updateStats() {
  // Default to 0 if no history is loaded yet
  let pendingCount = 0;
  let approvedCount = 0;
  let rejectedCount = 0;
  
  if (leaveHistory.length > 0) {
    pendingCount = leaveHistory.filter(record => record.status === "Pending").length;
    approvedCount = leaveHistory.filter(record => record.status === "Disetujui").length;
    rejectedCount = leaveHistory.filter(record => record.status === "Ditolak").length;
  }
  
  if (document.getElementById("pendingCount")) {
    document.getElementById("pendingCount").textContent = pendingCount;
  }
  if (document.getElementById("approvedCount")) {
    document.getElementById("approvedCount").textContent = approvedCount;
  }
  if (document.getElementById("rejectedCount")) {
    document.getElementById("rejectedCount").textContent = rejectedCount;
  }
}

// Initialize date inputs
function initDateInputs() {
  const dateInputs = document.querySelectorAll('input[type="date"]');
  const today = new Date().toISOString().split("T")[0];
  
  dateInputs.forEach(input => {
    // Set min date to today for future dates
    if (input.id === "leaveDate" || input.id === "replacementDate" || input.id === "replacementHourDate") {
      input.min = today;
    }
  });
}

// Show feedback to user
function showFeedback(type, message) {
  const feedbackEl = document.getElementById("formFeedback");
  if (!feedbackEl) return;
  
  feedbackEl.innerHTML = `
    <div class="alert alert-${type === "success" ? "success" : "danger"} alert-dismissible fade show" role="alert">
      <i class="fas fa-${type === "success" ? "check-circle" : "exclamation-circle"} me-2"></i>
      ${message}
      <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    </div>
  `;
  feedbackEl.style.display = "block";

  // Auto hide after 5 seconds
  if (type === "success") {
    setTimeout(() => {
      const alert = document.querySelector(".alert");
      if (alert) {
        const bsAlert = new bootstrap.Alert(alert);
        bsAlert.close();
      }
    }, 5000);
  }

  // Scroll to feedback
  feedbackEl.scrollIntoView({ behavior: "smooth", block: "start" });
}

// Event listener for employee ID input change
document.getElementById("employeeId")?.addEventListener("change", async function() {
  const employeeId = this.value.trim();
  if (employeeId) {
    localStorage.setItem('currentEmployeeId', employeeId);
    await loadLeaveHistory(employeeId);
  }
});

// Event listener for replacement type selection
document.getElementById('replacementType')?.addEventListener('change', function() {
  const liburSection = document.getElementById('replacementLibur');
  const jamSection = document.getElementById('replacementJam');
  
  if (!liburSection || !jamSection) return;
  
  liburSection.style.display = 'none';
  jamSection.style.display = 'none';
  
  if (this.value === 'libur') {
    liburSection.style.display = 'block';
    liburSection.classList.add('active');
    jamSection.classList.remove('active');
  } else if (this.value === 'jam') {
    jamSection.style.display = 'block';
    jamSection.classList.add('active');
    liburSection.classList.remove('active');
  }
});

// Handle leave form submission
document.getElementById('leaveForm')?.addEventListener('submit', async function(e) {
  e.preventDefault();
  
  // Show loading state
  const submitBtn = this.querySelector('button[type="submit"]');
  const originalBtnText = submitBtn.innerHTML;
  submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i> Memproses...';
  submitBtn.disabled = true;
  
  const employeeId = document.getElementById('employeeId').value;
  const employee = employees.find(emp => emp.employeeId === employeeId);
  
  if (!employee) {
    showFeedback("error", "ID Karyawan tidak ditemukan! Silakan periksa kembali.");
    submitBtn.innerHTML = originalBtnText;
    submitBtn.disabled = false;
    return;
  }
  
  try {
    const leaveDate = document.getElementById('leaveDate').value;
    const leaveReason = document.getElementById('leaveReason').value;
    const replacementType = document.getElementById('replacementType').value;
    
    // Validasi tanggal
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const selectedDate = new Date(leaveDate);
    selectedDate.setHours(0, 0, 0, 0);

    if (selectedDate < today) {
      showFeedback("error", "Tanggal izin tidak boleh kurang dari hari ini!");
      submitBtn.innerHTML = originalBtnText;
      submitBtn.disabled = false;
      return;
    }
    
    let replacementDetails = {};
    
    if (replacementType === 'libur') {
      const replacementDate = document.getElementById('replacementDate').value;
      if (!replacementDate) {
        showFeedback("error", "Tanggal ganti libur harus diisi!");
        submitBtn.innerHTML = originalBtnText;
        submitBtn.disabled = false;
        return;
      }

      replacementDetails = {
        type: 'libur',
        date: replacementDate,
        formattedDate: new Date(replacementDate).toLocaleDateString('id-ID', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        })
      };
    } else if (replacementType === 'jam') {
      const replacementHourDate = document.getElementById('replacementHourDate').value;
      const replacementHours = document.getElementById('replacementHours').value;
      
      if (!replacementHourDate || !replacementHours) {
        showFeedback("error", "Tanggal dan jumlah jam pengganti harus diisi!");
        submitBtn.innerHTML = originalBtnText;
        submitBtn.disabled = false;
        return;
      }

      replacementDetails = {
        type: 'jam',
        date: replacementHourDate,
        hours: replacementHours,
        formattedDate: new Date(replacementHourDate).toLocaleDateString('id-ID', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        })
      };
    }
    
    const newLeave = {
      employeeId: employee.employeeId,
      name: employee.name,
      type: employee.type || 'staff', // Default to staff if not specified
      shift: employee.defaultShift || 'morning', // Default to morning if not specified
      leaveDate: new Date(leaveDate).toLocaleDateString('id-ID', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }),
      rawLeaveDate: leaveDate, // Store original date for sorting
      reason: leaveReason,
      replacementType: replacementType,
      replacementDetails: replacementDetails,
      status: 'Pending', // Tambahkan status Pending secara default
      replacementStatus: 'Belum Diganti', // Tambahkan status ganti default
      submissionDate: new Date() // Tambahkan tanggal pengajuan
    };
    
    await submitLeaveRequest(newLeave);
    
    showFeedback("success", "Pengajuan izin berhasil diajukan! Silakan cek status pengajuan secara berkala.");
    this.reset();
    
    // Hide replacement sections
    document.getElementById('replacementLibur').style.display = 'none';
    document.getElementById('replacementJam').style.display = 'none';
    
    // Reload leave history
    await loadLeaveHistory(employeeId);
    
  } catch (error) {
    console.error("Error submitting leave request:", error);
    showFeedback("error", "Terjadi kesalahan saat mengajukan izin. Silakan coba lagi.");
  } finally {
    // Restore button state
    submitBtn.innerHTML = originalBtnText;
    submitBtn.disabled = false;
  }
});

// Reset button functionality
document.querySelector('button[type="reset"]')?.addEventListener('click', () => {
  document.getElementById('replacementLibur').style.display = 'none';
  document.getElementById('replacementJam').style.display = 'none';
  document.getElementById('formFeedback').style.display = 'none';
});

// Initialize page
document.addEventListener('DOMContentLoaded', () => {
  loadEmployees();
  initDateInputs();
  
  // Check for saved employee ID
  const savedEmployeeId = localStorage.getItem('currentEmployeeId');
  if (savedEmployeeId && document.getElementById('employeeId')) {
    document.getElementById('employeeId').value = savedEmployeeId;
    loadLeaveHistory(savedEmployeeId);
  }
});
