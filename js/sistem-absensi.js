//import { checkAuthState } from './auth.js';
import { findEmployeeByBarcode } from './employee-service.js';
import { recordAttendance, getTodayAttendance } from './attendance-service.js';
import { getAllLeaveRequests } from './leave-service.js';

// Check if user is logged in
// checkAuthState((user) => {
//   if (!user) {
//     window.location.href = 'login.html';
//   }
// });

// Initialize data
let attendanceRecords = [];
let leaveRecords = [];

// Load today's attendance
async function loadTodayAttendance() {
  try {
    attendanceRecords = await getTodayAttendance();
    updateAttendanceTable();
  } catch (error) {
    console.error("Error loading attendance:", error);
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

// Handle barcode scanning
document.getElementById("barcodeInput").addEventListener("keypress", async function (e) {
  if (e.key === "Enter") {
    const barcode = this.value;
    const scanResult = document.getElementById("scanResult");
    
    try {
      const employee = await findEmployeeByBarcode(barcode);
      
      if (employee) {
        // Record attendance
        const attendance = {
          employeeId: employee.employeeId,
          name: employee.name,
          status: "Hadir"
        };
        
        await recordAttendance(attendance);
        
        scanResult.innerHTML = `Absensi berhasil: ${employee.name}`;
        scanResult.className = "success";
        
        // Reload attendance data
        await loadTodayAttendance();
      } else {
        scanResult.innerHTML = "Barcode tidak valid!";
        scanResult.className = "error";
      }
    } catch (error) {
      console.error("Error scanning barcode:", error);
      scanResult.innerHTML = "Terjadi kesalahan saat memproses barcode";
      scanResult.className = "error";
    }
    
    scanResult.style.display = "block";
    this.value = "";
    
    // Hide result after 3 seconds
    setTimeout(() => {
      scanResult.style.display = "none";
    }, 3000);
  }
});

// Update attendance table
function updateAttendanceTable() {
  const tbody = document.getElementById("attendanceList");
  tbody.innerHTML = "";
  
  attendanceRecords.forEach((record) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${record.employeeId}</td>
      <td>${record.name}</td>
      <td>${record.timeIn.toLocaleTimeString()}</td>
      <td>${record.status}</td>
    `;
    tbody.appendChild(row);
  });
}

// Helper function to format replacement information
function getReplacementInfo(record) {
  if (record.replacementType === 'libur') {
    return `Ganti libur pada ${record.replacementDetails.formattedDate}`;
  } else if (record.replacementType === 'jam') {
    return `Ganti ${record.replacementDetails.hours} jam pada ${record.replacementDetails.formattedDate}`;
  }
  return '-';
}

// Update leave table
function updateLeaveTable() {
  const tbody = document.getElementById('leaveList');
  tbody.innerHTML = '';
  
  leaveRecords.forEach(record => {
    const replacementInfo = getReplacementInfo(record);
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${record.employeeId}</td>
      <td>${record.name}</td>
      <td>${record.leaveDate}</td>
      <td>${record.reason}</td>
      <td>${record.replacementType === 'libur' ? 'Ganti Libur' : 'Ganti Jam'}</td>
      <td>${replacementInfo}</td>
      <td class="status-${record.status.toLowerCase()}">${record.status}</td>
      <td class="replacement-status-${record.replacementStatus.toLowerCase().replace(/\s+/g, '-')}">${record.replacementStatus}</td>
    `;
    tbody.appendChild(row);
  });
}

// Initialize page
document.addEventListener('DOMContentLoaded', () => {
  loadTodayAttendance();
  loadLeaveRequests();
});
