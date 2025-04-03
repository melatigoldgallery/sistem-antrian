// Import semua service yang dibutuhkan
import { findEmployeeByBarcode, getEmployees } from "../services/employee-service.js";
import { recordAttendance, updateAttendanceOut, getTodayAttendance } from "../services/attendance-service.js";

// Initialize data
let attendanceRecords = [];
// Hapus variabel yang tidak diperlukan
// let leaveRecords = [];
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

// Load employees
async function loadEmployees() {
  try {
    employees = await getEmployees();
    // Hapus pemanggilan populateEmployeeDropdown karena tidak diperlukan lagi
    // populateEmployeeDropdown();
  } catch (error) {
    console.error("Error loading employees:", error);
  }
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

    // Load data - hapus loadLeaveRequests
    await Promise.all([loadEmployees(), loadTodayAttendance()]);

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
      // Scan out logic
      const existingRecord = attendanceRecords.find(
        (record) => record.employeeId === employee.employeeId && record.date === now.toISOString().split("T")[0]
      );

      if (!existingRecord) {
        showScanResult("error", `${employee.name} belum melakukan scan masuk hari ini!`);
        return;
      }

      if (existingRecord.timeOut) {
        showScanResult("error", `${employee.name} sudah melakukan scan pulang hari ini!`);
        return;
      }

      // Update attendance with checkout time
      await updateAttendanceOut(existingRecord.id, now);

      showScanResult("success", `Absensi pulang berhasil: ${employee.name}`);

      // Reload attendance data
      await loadTodayAttendance();
    }
  } catch (error) {
    console.error("Error scanning barcode:", error);
    showScanResult("error", "Terjadi kesalahan saat memproses barcode");
  }

  // Clear input
  document.getElementById("barcodeInput").value = "";
  document.getElementById("barcodeInput").focus();
}

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

function updateAttendanceTable() {
  // Tidak perlu mengupdate tabel karena card attendance dihapus
  // Tetapi tetap perlu untuk updateStats()
}

// Update statistics
function updateStats() {
  const today = new Date().toISOString().split("T")[0];
  const todayRecords = attendanceRecords.filter((record) => record.date === today);

  const presentCount = todayRecords.length;
  const lateCount = todayRecords.filter((record) => record.status === "Terlambat").length;

  // Update UI elements if they exist
  const presentCountEl = document.getElementById("presentCount");
  if (presentCountEl) presentCountEl.textContent = presentCount;
  
  const lateCountEl = document.getElementById("lateCount");
  if (lateCountEl) lateCountEl.textContent = lateCount;
}


// Helper function to format employee type
function formatEmployeeType(type) {
  return type === "staff" ? "Staff" : "Office Boy";
}

// Helper function to format shift
function formatShift(shift) {
  return shift === "morning" ? "Pagi" : "Sore";
}

// Export fungsi yang diperlukan
export { loadTodayAttendance, processBarcode };
