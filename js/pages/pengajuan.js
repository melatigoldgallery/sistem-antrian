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

// Event listener untuk jenis izin
document.getElementById('leaveType')?.addEventListener('change', function() {
  const sickLeaveSection = document.getElementById('sickLeaveSection');
  const leaveSection = document.getElementById('leaveSection');
  const replacementTypeSelect = document.getElementById('replacementType');
  const hasMedicalCert = document.getElementById('hasMedicalCertificate');

  // Hide all sections first
  if (sickLeaveSection) sickLeaveSection.style.display = 'none';
  if (leaveSection) leaveSection.style.display = 'none';
  
  // Reset replacement type
  if (replacementTypeSelect) {
    replacementTypeSelect.value = '';
    replacementTypeSelect.disabled = false;
  }
  // Enable all options first
    Array.from(replacementTypeSelect.options).forEach(option => {
      option.disabled = false;
    });
  
   // Show relevant sections based on leave type
   switch(this.value) {
    case 'sakit':
      if (sickLeaveSection) sickLeaveSection.style.display = 'block';
      
      if (replacementTypeSelect) {
        if (hasMedicalCert && hasMedicalCert.checked) {
          // If medical certificate is checked, set to "Tidak Perlu Diganti"
          replacementTypeSelect.value = 'tidak';
          replacementTypeSelect.disabled = true;
        } else {
          // If not checked, disable "Tidak Perlu Diganti" option
          const noReplacementOption = Array.from(replacementTypeSelect.options).find(option => option.value === 'tidak');
          if (noReplacementOption) {
            noReplacementOption.disabled = true;
          }
        }
      }
      break;
    case 'cuti':
      if (leaveSection) leaveSection.style.display = 'block';
      if (replacementTypeSelect) {
        replacementTypeSelect.value = 'tidak';
        replacementTypeSelect.disabled = true;
      }
      break;
    case 'normal':
      // For "Izin Lainnya", disable "Tidak Perlu Diganti" option
      if (replacementTypeSelect) {
        const noReplacementOption = Array.from(replacementTypeSelect.options).find(option => option.value === 'tidak');
        if (noReplacementOption) {
          noReplacementOption.disabled = true;
        }
      }
      break;
  }
  
  // Trigger change event on replacement type to update UI
  if (replacementTypeSelect) {
    const event = new Event('change');
    replacementTypeSelect.dispatchEvent(event);
  }
});

// Modify the event listener for hasMedicalCertificate
document.getElementById('hasMedicalCertificate')?.addEventListener('change', function() {
  const uploadSection = document.getElementById('medicalCertificateUpload');
  const replacementTypeSelect = document.getElementById('replacementType');
  const leaveType = document.getElementById('leaveType')?.value;
  
  if (uploadSection) {
    uploadSection.style.display = this.checked ? 'block' : 'none';
  }
  
  // Only apply this logic if leave type is "sakit"
  if (leaveType === 'sakit' && replacementTypeSelect) {
    if (this.checked) {
      // If medical certificate is checked, set to "Tidak Perlu Diganti" and disable
      replacementTypeSelect.value = 'tidak';
      replacementTypeSelect.disabled = true;
    } else {
      // If unchecked, enable replacement selection but disable "Tidak Perlu Diganti" option
      replacementTypeSelect.disabled = false;
      replacementTypeSelect.value = '';
      
      // Disable "Tidak Perlu Diganti" option
      const noReplacementOption = Array.from(replacementTypeSelect.options).find(option => option.value === 'tidak');
      if (noReplacementOption) {
        noReplacementOption.disabled = true;
      }
    }
    
    // Trigger change event to update UI
    const event = new Event('change');
    replacementTypeSelect.dispatchEvent(event);
  }
});

// Event listener untuk radio button jenis cuti
document.querySelectorAll('input[name="leaveTypeRadio"]')?.forEach(radio => {
  radio.addEventListener('change', function() {
    const specialLeaveReason = document.getElementById('specialLeaveReason');
    if (specialLeaveReason) {
      specialLeaveReason.style.display = this.value === 'special' ? 'block' : 'none';
    }
  });
});

// Event listener untuk replacement type selection
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
    const leaveType = document.getElementById('leaveType').value;
    const leaveStartDate = document.getElementById('leaveStartDate').value;
    const leaveEndDate = document.getElementById('leaveEndDate').value;
    const leaveReason = document.getElementById('leaveReason').value;
    const replacementType = document.getElementById('replacementType').value;
    
    // Validasi tanggal
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startDate = new Date(leaveStartDate);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(leaveEndDate);
    endDate.setHours(0, 0, 0, 0);

    if (startDate < today) {
      showFeedback("error", "Tanggal mulai izin tidak boleh kurang dari hari ini!");
      submitBtn.innerHTML = originalBtnText;
      submitBtn.disabled = false;
      return;
    }
    
    if (endDate < startDate) {
      showFeedback("error", "Tanggal selesai izin tidak boleh kurang dari tanggal mulai!");
      submitBtn.innerHTML = originalBtnText;
      submitBtn.disabled = false;
      return;
    }
        
    let replacementDetails = {};
    
    // Proses berdasarkan jenis izin dan pengganti
    if (leaveType === 'sakit') {
      const hasMedicalCertificate = document.getElementById('hasMedicalCertificate').checked;
      
      replacementDetails = {
        type: 'sakit',
        needReplacement: false,
        hasMedicalCertificate: hasMedicalCertificate,
        medicalCertificateFile: hasMedicalCertificate ? 
          document.getElementById('medicalCertificateFile').files[0]?.name || null : null
      };
    } else if (leaveType === 'cuti') {
      const cutiType = document.querySelector('input[name="leaveTypeRadio"]:checked').value;
      let specialReason = null;
      
      if (cutiType === 'special') {
        specialReason = document.getElementById('specialLeaveDetail').value;
      }
      
      replacementDetails = {
        type: 'cuti',
        needReplacement: false,
        cutiType: cutiType,
        specialReason: specialReason
      };
    } else if (replacementType === 'libur') {
      // Collect all replacement dates
      const replacementDates = [];
      
      if (diffDays > 1) {
        // Multiple days
        for (let i = 0; i < diffDays; i++) {
          const dateInput = document.getElementById(`replacementDate_${i}`);
          if (dateInput && dateInput.value) {
            const repDate = new Date(dateInput.value);
            replacementDates.push({
              date: dateInput.value,
              formatted: repDate.toLocaleDateString('id-ID', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })
            });
          }
        }
        
     
      } else {
        // Single day
        const replacementDate = document.getElementById('replacementDate').value;
        if (!replacementDate) {
          showFeedback("error", "Tanggal ganti libur harus diisi!");
          submitBtn.innerHTML = originalBtnText;
          submitBtn.disabled = false;
          return;
        }
      }

      replacementDetails = {
        type: 'libur',
        needReplacement: true,
        dates: replacementDates
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
        needReplacement: true,
        date: replacementHourDate,
        hours: replacementHours,
        formatted: new Date(replacementHourDate).toLocaleDateString('id-ID', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        })
      };
    } else if (replacementType === 'tidak') {
      replacementDetails = {
        type: 'tidak',
        needReplacement: false
      };
    }
    
 
    
    showFeedback("success", "Pengajuan izin berhasil diajukan! Silakan cek status pengajuan secara berkala.");
    this.reset();
    
    // Hide all sections
    document.getElementById('replacementLibur').style.display = 'none';
    document.getElementById('replacementJam').style.display = 'none';
    document.getElementById('sickLeaveSection').style.display = 'none';
    document.getElementById('leaveSection').style.display = 'none';
    document.getElementById('multiDateWarning').style.display = 'none';
    
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

// Update leave history table untuk menampilkan rentang tanggal
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
    
    // Format tanggal izin
    let leaveDateDisplay = record.leaveDate || "-";
    if (record.leaveStartDate && record.leaveEndDate) {
      const startDate = new Date(record.leaveStartDate).toLocaleDateString("id-ID", {day: 'numeric', month: 'short'});
      const endDate = new Date(record.leaveEndDate).toLocaleDateString("id-ID", {day: 'numeric', month: 'short'});
      
      if (record.leaveStartDate === record.leaveEndDate) {
        leaveDateDisplay = startDate;
      } else {
        leaveDateDisplay = `${startDate} - ${endDate}`;
      }
    }
    
    // Format jenis izin
    let leaveTypeDisplay = "Izin Normal";
    if (record.leaveType === 'sakit') {
      leaveTypeDisplay = "Izin Sakit";
    } else if (record.leaveType === 'cuti') {
      leaveTypeDisplay = "Cuti";
    }
    
    // Format jenis pengganti
    let replacementTypeDisplay = "Tidak Perlu Diganti";
    if (record.replacementType === 'libur') {
      replacementTypeDisplay = "Ganti Libur";
    } else if (record.replacementType === 'jam') {
      replacementTypeDisplay = "Ganti Jam";
    }
    
    const statusClass = 
      record.status === "Disetujui" ? "success" : 
      record.status === "Ditolak" ? "danger" : "warning";
    
    row.innerHTML = `
      <td>${submissionDate}</td>
      <td>${leaveDateDisplay}</td>
      <td>${leaveTypeDisplay}<br><small class="text-muted">${record.reason}</small></td>
      <td>${replacementTypeDisplay}</td>
      <td><span class="status-badge ${statusClass}">${record.status}</span></td>
    `;
    
    tbody.appendChild(row);
  });
}

// Reset button functionality
document.querySelector('button[type="reset"]')?.addEventListener('click', () => {
  // Hide all sections
  document.getElementById('replacementLibur').style.display = 'none';
  document.getElementById('replacementJam').style.display = 'none';
  document.getElementById('sickLeaveSection').style.display = 'none';
  document.getElementById('leaveSection').style.display = 'none';
  document.getElementById('multiDateWarning').style.display = 'none';
  document.getElementById('formFeedback').style.display = 'none';
  
  // Reset leaveDaysCount
  leaveDaysCount = 1;
  
  // Reset replacement dates container
  const container = document.getElementById('replacementDatesContainer');
  if (container) {
    container.innerHTML = `
      <div class="mb-3 replacement-date-item">
        <label for="replacementDate" class="form-label">Tanggal Ganti Libur</label>
        <div class="input-group">
          <span class="input-group-text"><i class="fas fa-calendar-check"></i></span>
          <input type="date" class="form-control" id="replacementDate" min="${new Date().toISOString().split('T')[0]}" />
        </div>
      </div>
    `;
  }
  
  // Enable replacement type select if it was disabled
  const replacementTypeSelect = document.getElementById('replacementType');
  if (replacementTypeSelect) {
    replacementTypeSelect.disabled = false;
  }
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
