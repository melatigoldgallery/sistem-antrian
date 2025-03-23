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

// Tambahkan variabel untuk menyimpan jumlah hari izin
let leaveDaysCount = 1;

// Initialize date inputs dengan tambahan validasi rentang tanggal
function initDateInputs() {
  const today = new Date().toISOString().split("T")[0];
  
  // Set min date untuk semua input tanggal
  const dateInputs = document.querySelectorAll('input[type="date"]');
  dateInputs.forEach(input => {
    if (input.id === "leaveStartDate" || input.id === "leaveEndDate" || 
        input.id === "replacementDate" || input.id.startsWith("replacementDate_") || 
        input.id === "replacementHourDate") {
      input.min = today;
    }
  });
  
  // Event listener untuk tanggal mulai izin
  const startDateInput = document.getElementById('leaveStartDate');
  const endDateInput = document.getElementById('leaveEndDate');
  
  if (startDateInput && endDateInput) {
    startDateInput.addEventListener('change', function() {
      // Set tanggal minimal untuk end date = start date
      endDateInput.min = this.value;
      
      // Jika end date sudah diisi dan lebih kecil dari start date, reset
      if (endDateInput.value && endDateInput.value < this.value) {
        endDateInput.value = this.value;
      }
      
      // Update jumlah hari jika kedua tanggal sudah diisi
      if (this.value && endDateInput.value) {
        calculateLeaveDays();
      }
    });
    
    endDateInput.addEventListener('change', function() {
      if (this.value && startDateInput.value) {
        calculateLeaveDays();
      }
    });
  }
}

// Fungsi untuk menghitung jumlah hari izin
function calculateLeaveDays() {
  const startDate = new Date(document.getElementById('leaveStartDate').value);
  const endDate = new Date(document.getElementById('leaveEndDate').value);
  
  // Reset time part to compare dates only
  startDate.setHours(0, 0, 0, 0);
  endDate.setHours(0, 0, 0, 0);
  
  // Calculate difference in days
  const diffTime = Math.abs(endDate - startDate);
  leaveDaysCount = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  
  // Update UI
  const multiDateWarning = document.getElementById('multiDateWarning');
  const totalDaysCount = document.getElementById('totalDaysCount');
  const addMoreDatesBtn = document.getElementById('addMoreDates');
  
  if (multiDateWarning && totalDaysCount) {
    totalDaysCount.textContent = leaveDaysCount;
    
    if (leaveDaysCount > 1) {
      multiDateWarning.style.display = 'block';
      if (addMoreDatesBtn) addMoreDatesBtn.style.display = 'inline-block';
      updateReplacementDatesUI();
    } else {
      multiDateWarning.style.display = 'none';
      if (addMoreDatesBtn) addMoreDatesBtn.style.display = 'none';
      // Reset to single date input
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
    }
  }
}

// Fungsi untuk memperbarui UI tanggal ganti libur
function updateReplacementDatesUI() {
  const container = document.getElementById('replacementDatesContainer');
  if (!container) return;
  
  // Clear container
  container.innerHTML = '';
  
  // Add date inputs based on leave days count
  for (let i = 0; i < leaveDaysCount; i++) {
    const dateItem = document.createElement('div');
    dateItem.className = 'mb-3 replacement-date-item';
    
    const startDate = new Date(document.getElementById('leaveStartDate').value);
    startDate.setDate(startDate.getDate() + i);
    const dateLabel = startDate.toLocaleDateString('id-ID', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    
    dateItem.innerHTML = `
      <label for="replacementDate_${i}" class="form-label">
        Tanggal Ganti untuk ${dateLabel}
      </label>
      <div class="input-group">
        <span class="input-group-text"><i class="fas fa-calendar-check"></i></span>
        <input type="date" class="form-control" id="replacementDate_${i}" min="${new Date().toISOString().split('T')[0]}" />
      </div>
    `;
    
    container.appendChild(dateItem);
  }
}

// Event listener untuk tombol tambah tanggal ganti
document.getElementById('addMoreDates')?.addEventListener('click', function() {
  const container = document.getElementById('replacementDatesContainer');
  if (!container) return;
  
  const dateItems = container.querySelectorAll('.replacement-date-item');
  const newIndex = dateItems.length;
  
  const dateItem = document.createElement('div');
  dateItem.className = 'mb-3 replacement-date-item';
  
  dateItem.innerHTML = `
    <label for="replacementDate_${newIndex}" class="form-label">
      Tanggal Ganti Tambahan
    </label>
    <div class="input-group">
      <span class="input-group-text"><i class="fas fa-calendar-check"></i></span>
      <input type="date" class="form-control" id="replacementDate_${newIndex}" min="${new Date().toISOString().split('T')[0]}" />
      <button type="button" class="btn btn-outline-danger remove-date">
        <i class="fas fa-times"></i>
      </button>
    </div>
  `;
  
  container.appendChild(dateItem);
  
  // Add event listener to remove button
  dateItem.querySelector('.remove-date').addEventListener('click', function() {
    container.removeChild(dateItem);
  });
});

// Event listener untuk jenis izin
document.getElementById('leaveType')?.addEventListener('change', function() {
  const sickLeaveSection = document.getElementById('sickLeaveSection');
  const leaveSection = document.getElementById('leaveSection');
  const replacementTypeSelect = document.getElementById('replacementType');
  
  // Hide all sections first
  if (sickLeaveSection) sickLeaveSection.style.display = 'none';
  if (leaveSection) leaveSection.style.display = 'none';
  
  // Reset replacement type
  if (replacementTypeSelect) {
    replacementTypeSelect.value = '';
    replacementTypeSelect.disabled = false;
  }
  
  // Show relevant sections based on leave type
  switch(this.value) {
    case 'sakit':
      if (sickLeaveSection) sickLeaveSection.style.display = 'block';
      if (replacementTypeSelect) {
        replacementTypeSelect.value = 'tidak';
        replacementTypeSelect.disabled = true;
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
      if (replacementTypeSelect) {
        replacementTypeSelect.disabled = false;
      }
      break;
  }
  
  // Trigger change event on replacement type to update UI
  if (replacementTypeSelect) {
    const event = new Event('change');
    replacementTypeSelect.dispatchEvent(event);
  }
});

// Event listener untuk checkbox surat keterangan sakit
document.getElementById('hasMedicalCertificate')?.addEventListener('change', function() {
  const uploadSection = document.getElementById('medicalCertificateUpload');
  if (uploadSection) {
    uploadSection.style.display = this.checked ? 'block' : 'none';
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
    
    // Update UI for multiple dates if needed
    if (leaveDaysCount > 1) {
      document.getElementById('multiDateWarning').style.display = 'block';
      document.getElementById('addMoreDates').style.display = 'inline-block';
      updateReplacementDatesUI();
    }
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
    
    // Hitung jumlah hari izin
    const diffTime = Math.abs(endDate - startDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    
    // Buat array tanggal izin
    const leaveDates = [];
    for (let i = 0; i < diffDays; i++) {
      const currentDate = new Date(startDate);
      currentDate.setDate(currentDate.getDate() + i);
      leaveDates.push({
        date: currentDate.toISOString().split('T')[0],
        formatted: currentDate.toLocaleDateString('id-ID', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        })
      });
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
        
        // Check if all days have replacement dates
        if (replacementDates.length < diffDays) {
          showFeedback("error", "Silakan isi semua tanggal ganti libur!");
          submitBtn.innerHTML = originalBtnText;
          submitBtn.disabled = false;
          return;
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
        
        const repDate = new Date(replacementDate);
        replacementDates.push({
          date: replacementDate,
          formatted: repDate.toLocaleDateString('id-ID', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          })
        });
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
    
    const newLeave = {
      employeeId: employee.employeeId,
      name: employee.name,
      type: employee.type || 'staff',
      shift: employee.defaultShift || 'morning',
      leaveType: leaveType,
      leaveStartDate: leaveStartDate,
      leaveEndDate: leaveEndDate,
      leaveDays: diffDays,
      leaveDates: leaveDates,
      // Untuk kompatibilitas dengan kode lama
      leaveDate: leaveDates[0].formatted,
      rawLeaveDate: leaveStartDate,
      reason: leaveReason,
      replacementType: replacementType,
      replacementDetails: replacementDetails,
      status: 'Pending',
      replacementStatus: replacementDetails.needReplacement ? 'Belum Diganti' : 'Tidak Perlu Diganti',
      submissionDate: new Date()
    };
    
    await submitLeaveRequest(newLeave);
    
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
