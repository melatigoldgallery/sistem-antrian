// Import semua service yang dibutuhkan
import { findEmployeeByBarcode, getEmployees } from "../services/employee-service.js";
import { recordAttendance, updateAttendanceOut, getTodayAttendance } from "../services/attendance-service.js";

// Initialize data
let attendanceRecords = [];
let employees = [];

// Tambahkan cache untuk employees
const employeeCache = new Map(); // Cache untuk karyawan berdasarkan barcode
const attendanceCache = new Map(); // Cache untuk data kehadiran berdasarkan tanggal

// Load today's attendance
async function loadTodayAttendance() {
  try {
    attendanceRecords = await getTodayAttendance();
    // Hapus panggilan ke updateAttendanceTable() karena tidak didefinisikan
    // dan sepertinya tidak diperlukan lagi
    updateStats();
    
    // Pastikan data hari ini ada di cache
    const today = new Date().toISOString().split('T')[0];
    if (!attendanceCache.has(today)) {
      attendanceCache.set(today, [...attendanceRecords]);
    }
    
    console.log(`Loaded ${attendanceRecords.length} attendance records for today`);
  } catch (error) {
    console.error("Error loading attendance:", error);
    showScanResult("error", "Gagal memuat data kehadiran");
  }
}

// Load employees and cache them
async function loadEmployees() {
  try {
    if (employeeCache.size === 0) {
      employees = await getEmployees();
      
      // Cache employees by barcode for faster lookup
      employees.forEach(employee => {
        if (employee.barcode) {
          employeeCache.set(employee.barcode, employee);
        }
      });
      
      console.log(`Cached ${employeeCache.size} employees`);
    }
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

    // Load data
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
    // Check if employee exists in cache first to reduce Firestore reads
    let employee = employeeCache.get(barcode);
    
    // If not in cache, fetch from Firestore
    if (!employee) {
      employee = await findEmployeeByBarcode(barcode);
      
      // Add to cache if found
      if (employee && employee.barcode) {
        employeeCache.set(employee.barcode, employee);
      }
    }

    if (!employee) {
      showScanResult("error", "Barcode tidak valid!");
      return;
    }

    // Get scan type (in/out)
    const scanType = document.querySelector('input[name="scanType"]:checked').value;

    // Current time
    const now = new Date();
    const timeString = now.toTimeString().split(" ")[0];
    const today = now.toISOString().split("T")[0];

    if (scanType === "in") {
      // Check if already checked in
      const existingRecord = attendanceRecords.find(
        (record) => record.employeeId === employee.employeeId && record.date === today
      );

      if (existingRecord && existingRecord.timeIn) {
        showScanResult("error", `${employee.name} sudah melakukan scan masuk hari ini!`);
        return;
      }

      // Use employee's default type and shift from their profile
      const employeeType = employee.type || "staff";
      const shift = employee.defaultShift || "morning";

      // Check if late based on employee type and shift
      const isLate = checkIfLate(timeString, employeeType, shift);

      // Calculate late minutes if employee is late
      let lateMinutes = 0;
      if (isLate) {
        const currentTime = new Date(`1970-01-01T${timeString}`);
        const thresholdTime = getThresholdTime(employeeType, shift);
        lateMinutes = Math.floor((currentTime - thresholdTime) / (1000 * 60));
      }

      // Record attendance
      const attendance = {
        employeeId: employee.employeeId,
        name: employee.name,
        type: employeeType,
        shift: shift,
        timeIn: now,
        status: isLate ? "Terlambat" : "Tepat Waktu",
        lateMinutes: isLate ? lateMinutes : 0,
        date: today,
      };

      await recordAttendance(attendance);

      showScanResult(
        "success",
        `Absensi masuk berhasil: ${employee.name} (${formatEmployeeType(employeeType)} - ${formatShift(shift)}) - ${
          isLate ? `Terlambat ${lateMinutes} menit` : "Tepat Waktu"
        }`
      );

      // Reload attendance data
      await loadTodayAttendance();
    } else {
      // Scan out logic
      const existingRecord = attendanceRecords.find(
        (record) => record.employeeId === employee.employeeId && record.date === today
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

// Get threshold time for lateness calculation
function getThresholdTime(employeeType, shift) {
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
    return thresholds.staff.morning;
  }

  return thresholds[employeeType][shift];
}

// Check if employee is late based on type and shift
function checkIfLate(timeString, employeeType, shift) {
  const time = new Date(`1970-01-01T${timeString}`);
  const threshold = getThresholdTime(employeeType, shift);

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
  
  // Update izin count (jika ada)
  const leaveCountEl = document.getElementById("leaveCount");
  if (leaveCountEl) leaveCountEl.textContent = "0"; // Default ke 0 karena kita tidak lagi memuat data izin
}

// Helper function to format employee type
function formatEmployeeType(type) {
  return type === "staff" ? "Staff" : "Office Boy";
}

// Helper function to format shift
function formatShift(shift) {
  return shift === "morning" ? "Pagi" : "Sore";
}

// Export fungsi dan cache yang diperlukan
export { loadTodayAttendance, processBarcode, attendanceCache, employeeCache };
