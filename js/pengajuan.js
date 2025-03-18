//import { checkAuthState } from './auth.js';
import { getEmployees } from './employee-service.js';
import { submitLeaveRequest } from './leave-service.js';

// Check if user is logged in
// checkAuthState((user) => {
//   if (!user) {
//     window.location.href = 'login.html';
//   }
// });

// Initialize data
let employees = [];

// Load employees
async function loadEmployees() {
  try {
    employees = await getEmployees();
  } catch (error) {
    console.error("Error loading employees:", error);
  }
}

// Event listener for replacement type selection
document.getElementById('replacementType').addEventListener('change', function() {
  const liburSection = document.getElementById('replacementLibur');
  const jamSection = document.getElementById('replacementJam');
  
  if (this.value === 'libur') {
    liburSection.style.display = 'block';
    jamSection.style.display = 'none';
  } else if (this.value === 'jam') {
    liburSection.style.display = 'none';
    jamSection.style.display = 'block';
  } else {
    liburSection.style.display = 'none';
    jamSection.style.display = 'none';
  }
});

// Handle leave form submission
document.getElementById('leaveForm').addEventListener('submit', async function(e) {
  e.preventDefault();
  
  const employeeId = document.getElementById('employeeId').value;
  const employee = employees.find(emp => emp.employeeId === employeeId);
  
  if (!employee) {
    alert('ID Karyawan tidak ditemukan!');
    return;
  }
  
  try {
    const leaveDate = document.getElementById('leaveDate').value;
    const leaveReason = document.getElementById('leaveReason').value;
    const replacementType = document.getElementById('replacementType').value;
    
    let replacementDetails = {};
    
    if (replacementType === 'libur') {
      const replacementDate = document.getElementById('replacementDate').value;
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
      leaveDate: new Date(leaveDate).toLocaleDateString('id-ID', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }),
      rawLeaveDate: leaveDate, // Store original date for sorting
      reason: leaveReason,
      replacementType: replacementType,
      replacementDetails: replacementDetails
    };
    
    await submitLeaveRequest(newLeave);
    
    alert('Pengajuan izin berhasil diajukan!');
    this.reset();
    
    // Hide replacement sections
    document.getElementById('replacementLibur').style.display = 'none';
    document.getElementById('replacementJam').style.display = 'none';
    
  } catch (error) {
    console.error("Error submitting leave request:", error);
    alert('Terjadi kesalahan saat mengajukan izin. Silakan coba lagi.');
  }
});

// Initialize page
document.addEventListener('DOMContentLoaded', () => {
  loadEmployees();
});
