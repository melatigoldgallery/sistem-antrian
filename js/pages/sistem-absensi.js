// Import semua service yang dibutuhkan
import { findEmployeeByBarcode, getEmployees } from "../services/employee-service.js";
import { recordAttendance, updateAttendanceOut, getTodayAttendance } from "../services/attendance-service.js";
import { getAllLeaveRequests, submitLeaveRequest } from "../services/leave-service.js";

// Initialize data
let attendanceRecords = [];
let leaveRecords = [];
let employees = [];

// Load today's attendance
async function loadTodayAttendance() {
  try {
    attendanceRecords = await getTodayAttendance();
    updateAttendanceTable();
    updateStats();
  } catch (error) {
    console.error("Error loading attendance:", error);
    showScanResult("error", "Gagal memuat data kehadiran");
  }
}

// Load leave requests
async function loadLeaveRequests() {
  try {
    leaveRecords = await getAllLeaveRequests();
    updateLeaveTable();
  } catch (error) {
    console.error("Error loading leave requests:", error);
  }
}

// Load employees
async function loadEmployees() {
  try {
    employees = await getEmployees();
    populateEmployeeDropdown();
  } catch (error) {
    console.error("Error loading employees:", error);
  }
}

// Populate employee dropdown
function populateEmployeeDropdown() {
  const employeeSelect = document.getElementById("leaveEmployeeId");
  if (!employeeSelect) return;

  employeeSelect.innerHTML = '<option value="" selected disabled>Pilih Karyawan</option>';

  employees.forEach((emp) => {
    const option = document.createElement("option");
    option.value = emp.employeeId;
    option.textContent = `${emp.employeeId} - ${emp.name}`;
    option.dataset.type = emp.type;
    option.dataset.defaultShift = emp.defaultShift;
    employeeSelect.appendChild(option);
  });

  // Add change event to auto-fill employee type and shift
  employeeSelect.addEventListener("change", function () {
    const selectedOption = this.options[this.selectedIndex];
    const employeeType = selectedOption.dataset.type;
    const defaultShift = selectedOption.dataset.defaultShift;

    if (document.getElementById("leaveEmployeeType")) {
      document.getElementById("leaveEmployeeType").value = employeeType || "";
    }

    if (document.getElementById("leaveShift")) {
      document.getElementById("leaveShift").value = defaultShift || "";
    }
  });
}

// Inisialisasi event listeners saat DOM sudah siap
document.addEventListener("DOMContentLoaded", async () => {
  try {
    

    // Setup barcode scanning
    const barcodeInput = document.getElementById("barcodeInput");
    if (barcodeInput) {
      barcodeInput.addEventListener("keypress", async function (e) {
        if (e.key === "Enter") {
          e.preventDefault();
          await processBarcode();
        }
      });
    }

    const manualSubmit = document.getElementById("manualSubmit");
    if (manualSubmit) {
      manualSubmit.addEventListener("click", async function () {
        await processBarcode();
      });
    }

    // Setup refresh scanner button
    const refreshScanner = document.getElementById("refreshScanner");
    if (refreshScanner) {
      refreshScanner.addEventListener("click", function () {
        if (barcodeInput) {
          barcodeInput.value = "";
          barcodeInput.focus();
        }
        const scanResult = document.getElementById("scanResult");
        if (scanResult) {
          scanResult.style.display = "none";
        }
      });
    }

    // Setup filter buttons
    document.querySelectorAll("[data-shift-filter]").forEach((item) => {
      item.addEventListener("click", function (e) {
        e.preventDefault();
        const filter = this.dataset.shiftFilter;
        filterAttendance("shift", filter);
      });
    });

    document.querySelectorAll("[data-status-filter]").forEach((item) => {
      item.addEventListener("click", function (e) {
        e.preventDefault();
        const filter = this.dataset.statusFilter;
        filterAttendance("status", filter);
      });
    });

    document.querySelectorAll("[data-employee-filter]").forEach((item) => {
      item.addEventListener("click", function (e) {
        e.preventDefault();
        const filter = this.dataset.employeeFilter;
        filterAttendance("type", filter);
      });
    });

    // Setup leave form submission
    const submitLeaveBtn = document.getElementById("submitLeaveBtn");
    if (submitLeaveBtn) {
      submitLeaveBtn.addEventListener("click", async function () {
        await handleLeaveSubmission();
      });
    }

    // Setup replacement type toggle
    const leaveReplacementType = document.getElementById("leaveReplacementType");
    if (leaveReplacementType) {
      leaveReplacementType.addEventListener("change", function () {
        const type = this.value;
        document.querySelectorAll(".replacement-fields").forEach((el) => (el.style.display = "none"));

        if (type === "libur") {
          document.getElementById("replacementLiburFields").style.display = "block";
        } else if (type === "jam") {
          document.getElementById("replacementJamFields").style.display = "block";
        }
      });
    }

    // Load data
    await Promise.all([loadEmployees(), loadTodayAttendance(), loadLeaveRequests()]);

    console.log("Attendance system initialized successfully");
  } catch (error) {
    console.error("Error initializing attendance system:", error);
  }
});

// Process barcode scan
async function processBarcode() {
  const barcode = document.getElementById("barcodeInput").value.trim();

  if (!barcode) {
    showScanResult("error", "Barcode tidak boleh kosong!");
    return;
  }

  try {
    const employee = await findEmployeeByBarcode(barcode);

    if (!employee) {
      showScanResult("error", "Barcode tidak valid!");
      return;
    }

    // Get scan type (in/out)
    const scanType = document.querySelector('input[name="scanType"]:checked').value;

    // Get employee type (auto/staff/ob)
    const employeeTypeSelection = document.querySelector('input[name="employeeType"]:checked').value;
    // Pastikan employeeType selalu valid (staff atau ob)
    const employeeType = employeeTypeSelection === "auto" 
      ? (employee.type === "staff" || employee.type === "ob" ? employee.type : "staff") 
      : employeeTypeSelection;

    // Get shift (auto/morning/afternoon)
    const shiftSelection = document.querySelector('input[name="shiftOption"]:checked').value;
    // Pastikan shift selalu valid (morning atau afternoon)
    const shift = shiftSelection === "auto" 
      ? (employee.defaultShift === "morning" || employee.defaultShift === "afternoon" ? employee.defaultShift : "morning") 
      : shiftSelection;

    console.log(`Employee type: ${employeeType}, Shift: ${shift}`); // Debugging

    // Current time
    const now = new Date();
    const timeString = now.toTimeString().split(" ")[0];

    if (scanType === "in") {
      // Check if already checked in
      const existingRecord = attendanceRecords.find(
        (record) => record.employeeId === employee.employeeId && record.date === now.toISOString().split("T")[0]
      );

      if (existingRecord && existingRecord.timeIn) {
        showScanResult("error", `${employee.name} sudah melakukan scan masuk hari ini!`);
        return;
      }

      // Check if late based on employee type and shift
      const isLate = checkIfLate(timeString, employeeType, shift);

      // Record attendance
      const attendance = {
        employeeId: employee.employeeId,
        name: employee.name,
        type: employeeType,
        shift: shift,
        timeIn: now,
        status: isLate ? "Terlambat" : "Tepat Waktu",
        date: now.toISOString().split("T")[0],
      };

      await recordAttendance(attendance);

      showScanResult(
        "success",
        `Absensi masuk berhasil: ${employee.name} (${formatEmployeeType(employeeType)} - ${formatShift(shift)}) - ${
          isLate ? "Terlambat" : "Tepat Waktu"
        }`
      );

      // Reload attendance data
      await loadTodayAttendance();
    } else {
      // Kode untuk scan out tetap sama
      // ...
    }
  } catch (error) {
    console.error("Error scanning barcode:", error);
    showScanResult("error", "Terjadi kesalahan saat memproses barcode");
  }

  // Clear input
  document.getElementById("barcodeInput").value = "";
  document.getElementById("barcodeInput").focus();
}


// Handle leave submission
async function handleLeaveSubmission() {
  const form = document.getElementById("addLeaveForm");

  // Basic form validation
  const employeeId = document.getElementById("leaveEmployeeId").value;
  const employeeType = document.getElementById("leaveEmployeeType").value;
  const shift = document.getElementById("leaveShift").value;
  const leaveDate = document.getElementById("leaveDate").value;
  const reason = document.getElementById("leaveReason").value;
  const replacementType = document.getElementById("leaveReplacementType").value;

  if (!employeeId || !employeeType || !shift || !leaveDate || !reason || !replacementType) {
    alert("Mohon lengkapi semua field yang diperlukan");
    return;
  }

  // Get employee name
  const employee = employees.find((emp) => emp.employeeId === employeeId);
  if (!employee) {
    alert("Karyawan tidak ditemukan");
    return;
  }

  // Get replacement details
  let replacementDetails = {};

  if (replacementType === "libur") {
    const replacementDate = document.getElementById("replacementDate").value;
    if (!replacementDate) {
      alert("Mohon isi tanggal ganti libur");
      return;
    }

    replacementDetails = {
      type: "libur",
      date: replacementDate,
      formattedDate: new Date(replacementDate).toLocaleDateString("id-ID", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
    };
  } else if (replacementType === "jam") {
    const replacementHourDate = document.getElementById("replacementHourDate").value;
    const replacementHours = document.getElementById("replacementHours").value;

    if (!replacementHourDate || !replacementHours) {
      alert("Mohon isi tanggal dan jumlah jam pengganti");
      return;
    }

    replacementDetails = {
      type: "jam",
      date: replacementHourDate,
      hours: replacementHours,
      formattedDate: new Date(replacementHourDate).toLocaleDateString("id-ID", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
    };
  }

  // Create leave request object
  const leaveRequest = {
    employeeId: employeeId,
    name: employee.name,
    type: employeeType,
    shift: shift,
    leaveDate: new Date(leaveDate).toLocaleDateString("id-ID", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    }),
    rawLeaveDate: leaveDate,
    reason: reason,
    replacementType: replacementType,
    replacementDetails: replacementDetails,
    status: "Pending",
    replacementStatus: "Belum Diganti",
  };

  try {
    await submitLeaveRequest(leaveRequest);

    // Close modal and show success message
    const modal = bootstrap.Modal.getInstance(document.getElementById("addLeaveModal"));
    modal.hide();

    showScanResult("success", "Pengajuan izin berhasil disimpan");

    // Reset form
    form.reset();

    // Reload leave data
    await loadLeaveRequests();
  } catch (error) {
    console.error("Error submitting leave request:", error);
    alert("Terjadi kesalahan saat menyimpan pengajuan izin");
  }
}

// Check if employee is late based on type and shift
// Check if employee is late based on type and shift
function checkIfLate(timeString, employeeType, shift) {
  const time = new Date(`1970-01-01T${timeString}`);

  // Define late thresholds for each employee type and shift
  const thresholds = {
    staff: {
      morning: new Date("1970-01-01T08:45:00"),
      afternoon: new Date("1970-01-01T14:20:00"),
    },
    ob: {
      morning: new Date("1970-01-01T07:30:00"),
      afternoon: new Date("1970-01-01T13:30:00"),
    },
  };

  // Validasi employeeType dan shift
  if (!employeeType || !shift || !thresholds[employeeType] || !thresholds[employeeType][shift]) {
    console.warn(`Invalid employee type or shift: ${employeeType}, ${shift}`);
    // Default ke staff morning jika tipe atau shift tidak valid
    return time > thresholds.staff.morning;
  }

  // Get appropriate threshold
  const threshold = thresholds[employeeType][shift];

  // Check if time is later than threshold
  return time > threshold;
}


// Show scan result message
function showScanResult(type, message) {
  const scanResult = document.getElementById("scanResult");
  if (!scanResult) return;
  
  scanResult.className = "scan-result " + type;
  scanResult.innerHTML = message;
  scanResult.style.display = "block";

  // Hide result after 3 seconds
  setTimeout(() => {
    scanResult.style.display = "none";
  }, 3000);
}

// Update attendance table
function updateAttendanceTable() {
  const tbody = document.getElementById("attendanceList");
  const emptyState = document.getElementById("emptyAttendance");

  if (!tbody) return;

  tbody.innerHTML = "";

  if (attendanceRecords.length === 0) {
    if (emptyState) emptyState.style.display = "flex";
    return;
  }

  if (emptyState) emptyState.style.display = "none";

  attendanceRecords.forEach((record) => {
    const row = document.createElement("tr");

    // Calculate work duration if both timeIn and timeOut exist
    let durationText = "-";
    if (record.timeIn && record.timeOut) {
      const timeIn = new Date(record.timeIn);
      const timeOut = new Date(record.timeOut);
      const durationMs = timeOut - timeIn;
      const durationHours = Math.floor(durationMs / (1000 * 60 * 60));
      const durationMinutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
      durationText = `${durationHours}j ${durationMinutes}m`;
    }

    const statusClass = record.status === "Tepat Waktu" ? "success" : "warning";

    row.innerHTML = `
          <td>${record.employeeId}</td>
          <td>${record.name}</td>
          <td>${formatEmployeeType(record.type)}</td>
          <td>${formatShift(record.shift)}</td>
          <td>${record.timeIn ? new Date(record.timeIn).toLocaleTimeString() : "-"}</td>
          <td><span class="status-badge ${statusClass}">${record.status}</span></td>
          <td>${record.timeOut ? new Date(record.timeOut).toLocaleTimeString() : "-"}</td>
          <td>${durationText}</td>
          <td>
            <button class="btn btn-sm btn-outline-info view-btn" data-id="${
              record.id
            }" data-bs-toggle="tooltip" title="Detail">
              <i class="fas fa-eye"></i>
            </button>
            ${
              !record.timeOut
                ? `
            <button class="btn btn-sm btn-outline-primary checkout-btn" data-id="${record.id}" data-bs-toggle="tooltip" title="Checkout Manual">
              <i class="fas fa-sign-out-alt"></i>
            </button>
            `
                : ""
            }
          </td>
        `;

    tbody.appendChild(row);
  });

  // Add event listeners to buttons
  document.querySelectorAll(".checkout-btn").forEach((btn) => {
    btn.addEventListener("click", handleManualCheckout);
  });

  document.querySelectorAll(".view-btn").forEach((btn) => {
    btn.addEventListener("click", handleViewAttendance);
  });

  // Initialize tooltips
  const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
  tooltipTriggerList.map(function (tooltipTriggerEl) {
    return new bootstrap.Tooltip(tooltipTriggerEl);
  });
}

// Handle manual checkout
async function handleManualCheckout(e) {
  const recordId = e.currentTarget.dataset.id;
  const record = attendanceRecords.find((r) => r.id === recordId);

  if (!record) return;

  if (confirm(`Apakah Anda yakin ingin melakukan checkout manual untuk ${record.name}?`)) {
    try {
      await updateAttendanceOut(recordId, new Date());
      await loadTodayAttendance();
      showScanResult("success", `Checkout manual berhasil untuk ${record.name}`);
    } catch (error) {
      console.error("Error during manual checkout:", error);
      showScanResult("error", "Terjadi kesalahan saat melakukan checkout manual");
    }
  }
}

// Handle view attendance details
function handleViewAttendance(e) {
  const recordId = e.currentTarget.dataset.id;
  const record = attendanceRecords.find((r) => r.id === recordId);

  if (!record) return;

  // Implement view details functionality
  // This could open a modal with detailed information
  console.log("View attendance details for:", record);
  
  // Contoh implementasi sederhana - bisa dikembangkan lebih lanjut
  alert(`Detail Kehadiran:
  Nama: ${record.name}
  ID: ${record.employeeId}
  Tipe: ${formatEmployeeType(record.type)}
  Shift: ${formatShift(record.shift)}
  Waktu Masuk: ${record.timeIn ? new Date(record.timeIn).toLocaleTimeString() : "-"}
  Status: ${record.status}
  Waktu Pulang: ${record.timeOut ? new Date(record.timeOut).toLocaleTimeString() : "-"}
  `);
}

// Update leave table
function updateLeaveTable() {
  const tbody = document.getElementById("leaveList");
  const emptyState = document.getElementById("emptyLeave");

  if (!tbody) return;

  tbody.innerHTML = "";

  if (leaveRecords.length === 0) {
    if (emptyState) emptyState.style.display = "flex";
    return;
  }

  if (emptyState) emptyState.style.display = "none";

  leaveRecords.forEach((record) => {
    const replacementInfo = getReplacementInfo(record);
    const row = document.createElement("tr");

    const statusClass = record.status === "Disetujui" ? "success" : record.status === "Ditolak" ? "danger" : "warning";
    const replacementStatusClass = record.replacementStatus === "Sudah Diganti" ? "success" : "danger";

    row.innerHTML = `
          <td>${record.employeeId}</td>
          <td>${record.name}</td>
          <td>${formatEmployeeType(record.type)}</td>
          <td>${formatShift(record.shift)}</td>
          <td>${record.leaveDate}</td>
          <td>${record.reason}</td>
          <td>${record.replacementType === "libur" ? "Ganti Libur" : "Ganti Jam"}</td>
          <td>${replacementInfo}</td>
          <td><span class="status-badge ${statusClass}">${record.status}</span></td>
          <td><span class="status-badge ${replacementStatusClass}">${record.replacementStatus}</span></td>
        `;

    tbody.appendChild(row);
  });
}

// Update statistics
function updateStats() {
  const today = new Date().toISOString().split("T")[0];
  const todayRecords = attendanceRecords.filter((record) => record.date === today);

  const presentCount = todayRecords.length;
  const lateCount = todayRecords.filter((record) => record.status === "Terlambat").length;
  const leaveCount = leaveRecords.filter(
    (record) => record.rawLeaveDate === today && record.status === "Disetujui"
  ).length;

  // Update UI elements if they exist
  const presentCountEl = document.getElementById("presentCount");
  if (presentCountEl) presentCountEl.textContent = presentCount;
  
  const lateCountEl = document.getElementById("lateCount");
  if (lateCountEl) lateCountEl.textContent = lateCount;
  
  const leaveCountEl = document.getElementById("leaveCount");
  if (leaveCountEl) leaveCountEl.textContent = leaveCount;
}

// Filter attendance records
function filterAttendance(filterType, value) {
  const rows = document.querySelectorAll("#attendanceList tr");

  rows.forEach((row) => {
    let showRow = true;

    if (value !== "all") {
      if (filterType === "shift") {
        const shiftCell = row.querySelector("td:nth-child(4)").textContent;
        showRow = (value === "morning" && shiftCell === "Pagi") || (value === "afternoon" && shiftCell === "Sore");
      } else if (filterType === "status") {
        const statusCell = row.querySelector("td:nth-child(6) .status-badge").textContent;
        showRow =
          (value === "ontime" && statusCell === "Tepat Waktu") || (value === "late" && statusCell === "Terlambat");
      } else if (filterType === "type") {
        const typeCell = row.querySelector("td:nth-child(3)").textContent;
        showRow = (value === "staff" && typeCell === "Staff") || (value === "ob" && typeCell === "Office Boy");
      }
    }

    row.style.display = showRow ? "" : "none";
  });

  // Update dropdown button text
  if (filterType === "shift") {
    const buttonText = value === "all" ? "Shift" : value === "morning" ? "Shift Pagi" : "Shift Sore";
    const dropdown = document.getElementById("shiftFilterDropdown");
    if (dropdown) dropdown.innerHTML = `<i class="fas fa-clock"></i> ${buttonText}`;
  } else if (filterType === "status") {
    const buttonText = value === "all" ? "Status" : value === "ontime" ? "Tepat Waktu" : "Terlambat";
    const dropdown = document.getElementById("statusFilterDropdown");
    if (dropdown) dropdown.innerHTML = `<i class="fas fa-filter"></i> ${buttonText}`;
  } else if (filterType === "type") {
    const buttonText = value === "all" ? "Tipe" : value === "staff" ? "Staff" : "Office Boy";
    const dropdown = document.getElementById("employeeFilterDropdown");
    if (dropdown) dropdown.innerHTML = `<i class="fas fa-user-tag"></i> ${buttonText}`;
  }
}

// Helper function to format employee type
function formatEmployeeType(type) {
  return type === "staff" ? "Staff" : "Office Boy";
}

// Helper function to format shift
function formatShift(shift) {
  return shift === "morning" ? "Pagi" : "Sore";
}

// Helper function to format replacement information
function getReplacementInfo(record) {
  if (!record.replacementDetails) return "-";

  if (record.replacementType === "libur") {
    return `Ganti libur pada ${record.replacementDetails.formattedDate}`;
  } else if (record.replacementType === "jam") {
    return `Ganti ${record.replacementDetails.hours} jam pada ${record.replacementDetails.formattedDate}`;
  }
  return "-";
}

// Expose logout function to window object for HTML access
window.handleLogout = function() {
  console.log("Logout clicked");
  // Implementasi logout - bisa disesuaikan dengan kebutuhan
  window.location.href = "index.html";
};

