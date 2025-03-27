//import { checkAuthState } from './auth.js';
import { getEmployees } from "../services/employee-service.js";
import { submitLeaveRequest, getLeaveRequestsByEmployee } from "../services/leave-service.js";

// Initialize data
let employees = [];
let leaveHistory = [];

// Function to calculate days between two dates
function calculateDaysBetween(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffTime = Math.abs(end - start);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 to include both start and end dates
}

// Function to add a new date input field
function addReplacementDateField() {
  const container = document.getElementById('replacementDatesContainer');
  if (!container) return;
  
  const index = container.children.length;
  
  const dateItem = document.createElement('div');
  dateItem.className = 'mb-3 replacement-date-item';
  dateItem.innerHTML = `
    <label for="replacementDate${index}" class="form-label">Tanggal Ganti Libur ${index + 1}</label>
    <div class="input-group">
      <span class="input-group-text"><i class="fas fa-calendar-check"></i></span>
      <input type="date" class="form-control replacement-date" id="replacementDate${index}" />
      ${index > 0 ? '<button type="button" class="btn btn-outline-danger remove-date"><i class="fas fa-times"></i></button>' : ''}
    </div>
  `;
  
  container.appendChild(dateItem);
  
  // Add event listener to remove button if it exists
  const removeBtn = dateItem.querySelector('.remove-date');
  if (removeBtn) {
    removeBtn.addEventListener('click', function() {
      container.removeChild(dateItem);
      updateReplacementDateLabels();
    });
  }
}

// Function to update labels after removing a date field
function updateReplacementDateLabels() {
  const dateItems = document.querySelectorAll('.replacement-date-item');
  dateItems.forEach((item, index) => {
    const label = item.querySelector('label');
    if (label) {
      label.textContent = `Tanggal Ganti Libur ${index + 1}`;
      label.setAttribute('for', `replacementDate${index}`);
    }
    
    const input = item.querySelector('input');
    if (input) {
      input.id = `replacementDate${index}`;
    }
  });
}

// Function to update the UI based on leave duration
function updateLeaveReplacementUI() {
  const startDate = document.getElementById('leaveStartDate')?.value;
  const endDate = document.getElementById('leaveEndDate')?.value;
  const replacementType = document.getElementById('replacementType')?.value;
  const multiDateWarning = document.getElementById('multiDateWarning');
  const addMoreDatesBtn = document.getElementById('addMoreDates');
  const container = document.getElementById('replacementDatesContainer');
  
  // Only proceed if we have both dates and replacement type is libur
  if (!(startDate && endDate && replacementType === 'libur')) {
    if (multiDateWarning) multiDateWarning.style.display = 'none';
    if (addMoreDatesBtn) addMoreDatesBtn.style.display = 'none';
    return;
  }
  
  // Reset container to have only one date field
  if (container) {
    container.innerHTML = `
      <div class="mb-3 replacement-date-item">
        <label for="replacementDate0" class="form-label">Tanggal Ganti Libur 1</label>
        <div class="input-group">
          <span class="input-group-text"><i class="fas fa-calendar-check"></i></span>
          <input type="date" class="form-control replacement-date" id="replacementDate0" />
        </div>
      </div>
    `;
  }
  
  const dayCount = calculateDaysBetween(startDate, endDate);
  
  if (dayCount > 1) {
    // Show warning and add button for multiple days
    if (document.getElementById('totalDaysCount')) 
      document.getElementById('totalDaysCount').textContent = dayCount;
    if (multiDateWarning) multiDateWarning.style.display = 'block';
    if (addMoreDatesBtn) addMoreDatesBtn.style.display = 'block';
    
    // Add date fields for each day (minus one because we already have one field)
    for (let i = 1; i < dayCount; i++) {
      addReplacementDateField();
    }
  } else {
    // Hide warning and add button for single day
    if (multiDateWarning) multiDateWarning.style.display = 'none';
    if (addMoreDatesBtn) addMoreDatesBtn.style.display = 'none';
  }
}

// Event listener for leave type
document.getElementById("leaveType")?.addEventListener("change", function () {
  const sickLeaveSection = document.getElementById("sickLeaveSection");
  const leaveSection = document.getElementById("leaveSection");
  const replacementTypeSelect = document.getElementById("replacementType");
  const hasMedicalCert = document.getElementById("hasMedicalCertificate");

  // Hide all sections first
  if (sickLeaveSection) sickLeaveSection.style.display = "none";
  if (leaveSection) leaveSection.style.display = "none";

  // Reset replacement type
  if (replacementTypeSelect) {
    replacementTypeSelect.value = "";
    replacementTypeSelect.disabled = false;
  }
  
  // Enable all options first
  if (replacementTypeSelect) {
    Array.from(replacementTypeSelect.options).forEach((option) => {
      option.disabled = false;
    });
  }

  // Show relevant sections based on leave type
  switch (this.value) {
    case "sakit":
      if (sickLeaveSection) sickLeaveSection.style.display = "block";

      if (replacementTypeSelect && hasMedicalCert) {
        if (hasMedicalCert.checked) {
          // If medical certificate is checked, set to "Tidak Perlu Diganti"
          replacementTypeSelect.value = "tidak";
          replacementTypeSelect.disabled = true;
        } else {
          // If not checked, disable "Tidak Perlu Diganti" option
          const noReplacementOption = Array.from(replacementTypeSelect.options).find(
            (option) => option.value === "tidak"
          );
          if (noReplacementOption) {
            noReplacementOption.disabled = true;
          }
        }
      }
      break;
    case "cuti":
      if (leaveSection) leaveSection.style.display = "block";
      if (replacementTypeSelect) {
        replacementTypeSelect.value = "tidak";
        replacementTypeSelect.disabled = true;
      }
      break;
    case "normal":
      // For "Izin Lainnya", disable "Tidak Perlu Diganti" option
      if (replacementTypeSelect) {
        const noReplacementOption = Array.from(replacementTypeSelect.options).find(
          (option) => option.value === "tidak"
        );
        if (noReplacementOption) {
          noReplacementOption.disabled = true;
        }
      }
      break;
  }

  // Trigger change event on replacement type to update UI
  if (replacementTypeSelect) {
    const event = new Event("change");
    replacementTypeSelect.dispatchEvent(event);
  }
});

// Event listener for hasMedicalCertificate
document.getElementById("hasMedicalCertificate")?.addEventListener("change", function () {
  const uploadSection = document.getElementById("medicalCertificateUpload");
  const replacementTypeSelect = document.getElementById("replacementType");
  const leaveType = document.getElementById("leaveType")?.value;

  if (uploadSection) {
    uploadSection.style.display = this.checked ? "block" : "none";
  }

  // Only apply this logic if leave type is "sakit"
  if (leaveType === "sakit" && replacementTypeSelect) {
    if (this.checked) {
      // If medical certificate is checked, set to "Tidak Perlu Diganti" and disable
      replacementTypeSelect.value = "tidak";
      replacementTypeSelect.disabled = true;
    } else {
      // If unchecked, enable replacement selection but disable "Tidak Perlu Diganti" option
      replacementTypeSelect.disabled = false;
      replacementTypeSelect.value = "";

      // Disable "Tidak Perlu Diganti" option
      const noReplacementOption = Array.from(replacementTypeSelect.options).find((option) => option.value === "tidak");
      if (noReplacementOption) {
        noReplacementOption.disabled = true;
      }
    }

    // Trigger change event to update UI
    const event = new Event("change");
    replacementTypeSelect.dispatchEvent(event);
  }
});

// Event listener for radio button jenis cuti
document.querySelectorAll('input[name="leaveTypeRadio"]')?.forEach((radio) => {
  radio.addEventListener("change", function () {
    const specialLeaveReason = document.getElementById("specialLeaveReason");
    if (specialLeaveReason) {
      specialLeaveReason.style.display = this.value === "special" ? "block" : "none";
    }
  });
});

// Event listener for replacement type selection - FIXED
document.getElementById("replacementType")?.addEventListener("change", function () {
  const liburSection = document.getElementById("replacementLibur");
  const jamSection = document.getElementById("replacementJam");

  // Hide both sections first
  if (liburSection) liburSection.style.display = "none";
  if (jamSection) jamSection.style.display = "none";

  // Show the appropriate section based on selection
  if (this.value === "libur" && liburSection) {
    liburSection.style.display = "block";
    // Force update of the UI for multiple dates
    setTimeout(updateLeaveReplacementUI, 0);
  } else if (this.value === "jam" && jamSection) {
    jamSection.style.display = "block";
  }
});

// Add event listeners for date inputs
document.getElementById('leaveStartDate')?.addEventListener('change', updateLeaveReplacementUI);
document.getElementById('leaveEndDate')?.addEventListener('change', updateLeaveReplacementUI);

// Add event listener for the "Add More Dates" button
document.getElementById('addMoreDates')?.addEventListener('click', addReplacementDateField);

// Handle leave form submission
document.getElementById("leaveForm")?.addEventListener("submit", async function (e) {
  e.preventDefault();

  // Show loading state
  const submitBtn = this.querySelector('button[type="submit"]');
  const originalBtnText = submitBtn.innerHTML;
  submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i> Memproses...';
  submitBtn.disabled = true;

  const employeeId = document.getElementById("employeeId").value;
  const employee = employees.find((emp) => emp.employeeId === employeeId);

  if (!employee) {
    showFeedback("error", "ID Karyawan tidak ditemukan! Silakan periksa kembali.");
    submitBtn.innerHTML = originalBtnText;
    submitBtn.disabled = false;
    return;
  }

  try {
    const leaveType = document.getElementById("leaveType").value;
    const leaveStartDate = document.getElementById("leaveStartDate").value;
    const leaveEndDate = document.getElementById("leaveEndDate").value;
    const leaveReason = document.getElementById("leaveReason").value;
    const replacementType = document.getElementById("replacementType").value;
    
    let replacementDetails;

    // Proses berdasarkan jenis izin dan pengganti
    if (leaveType === "sakit") {
      const hasMedicalCertificate = document.getElementById("hasMedicalCertificate").checked;

      replacementDetails = {
        type: "sakit",
        needReplacement: replacementType !== "tidak",
        hasMedicalCertificate: hasMedicalCertificate,
        medicalCertificateFile: hasMedicalCertificate
          ? document.getElementById("medicalCertificateFile").files[0]?.name || null
          : null,
      };
      
      // Add replacement details based on type
      if (replacementType === "libur") {
        const replacementDates = [];
        document.querySelectorAll('.replacement-date').forEach(input => {
          if (input.value) {
            replacementDates.push({
              date: input.value,
              formatted: new Date(input.value).toLocaleDateString("id-ID", {
                weekday: "long", year: "numeric", month: "long", day: "numeric"
              })
            });
          }
        });
        
        if (replacementDates.length === 0) {
          showFeedback("error", "Tanggal pengganti harus diisi!");
          submitBtn.innerHTML = originalBtnText;
          submitBtn.disabled = false;
          return;
        }
        
        replacementDetails.dates = replacementDates;
      } else if (replacementType === "jam") {
        const replacementHourDate = document.getElementById("replacementHourDate").value;
        const replacementHours = document.getElementById("replacementHours").value;
        
        if (!replacementHourDate || !replacementHours) {
          showFeedback("error", "Tanggal dan jumlah jam pengganti harus diisi!");
          submitBtn.innerHTML = originalBtnText;
          submitBtn.disabled = false;
          return;
        }
        
        replacementDetails.date = replacementHourDate;
        replacementDetails.hours = replacementHours;
      }
    } else if (leaveType === "cuti") {
      const cutiType = document.querySelector('input[name="leaveTypeRadio"]:checked')?.value || "regular";
      let specialReason = null;

      if (cutiType === "special") {
        specialReason = document.getElementById("specialLeaveDetail").value;
      }

      replacementDetails = {
        type: "cuti",
        needReplacement: false,
        cutiType: cutiType,
        specialReason: specialReason,
      };
    } else if (replacementType === "libur") {
      // Collect all replacement dates
      const replacementDates = [];
      document.querySelectorAll('.replacement-date').forEach(input => {
        if (input.value) {
          replacementDates.push({
            date: input.value,
            formatted: new Date(input.value).toLocaleDateString("id-ID", {
              weekday: "long", year: "numeric", month: "long", day: "numeric"
            })
          });
        }
      });
      
      if (replacementDates.length === 0) {
        showFeedback("error", "Tanggal pengganti harus diisi!");
        submitBtn.innerHTML = originalBtnText;
        submitBtn.disabled = false;
        return;
      }
      
      replacementDetails = {
        type: "libur",
        needReplacement: true,
        dates: replacementDates,
      };
    } else if (replacementType === "jam") {
      const replacementHourDate = document.getElementById("replacementHourDate").value;
      const replacementHours = document.getElementById("replacementHours").value;

      if (!replacementHourDate || !replacementHours) {
        showFeedback("error", "Tanggal dan jumlah jam pengganti harus diisi!");
        submitBtn.innerHTML = originalBtnText;
        submitBtn.disabled = false;
        return;
      }

      replacementDetails = {
        type: "jam",
        needReplacement: true,
        date: replacementHourDate,
        hours: replacementHours,
        formatted: new Date(replacementHourDate).toLocaleDateString("id-ID", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        }),
      };
    } else if (replacementType === "tidak") {
      replacementDetails = {
        type: "tidak",
        needReplacement: false,
      };
    }

    // Here you would call your API to submit the leave request
    // await submitLeaveRequest(...);

    showFeedback("success", "Pengajuan izin berhasil diajukan! Silakan cek status pengajuan secara berkala.");
    this.reset();

    // Hide all sections
    document.getElementById("replacementLibur").style.display = "none";
    document.getElementById("replacementJam").style.display = "none";
    document.getElementById("sickLeaveSection").style.display = "none";
    document.getElementById("leaveSection").style.display = "none";
    document.getElementById("multiDateWarning").style.display = "none";

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

// Function to show feedback messages
function showFeedback(type, message) {
  const feedbackElement = document.getElementById("formFeedback");
  if (!feedbackElement) return;

  feedbackElement.className = `alert alert-${type === "error" ? "danger" : "success"} mb-4`;
  feedbackElement.innerHTML = `<i class="fas fa-${type === "error" ? "exclamation-circle" : "check-circle"} me-2"></i> ${message}`;
  feedbackElement.style.display = "block";

  // Auto-hide after 5 seconds
  setTimeout(() => {
    feedbackElement.style.display = "none";
  }, 5000);
}

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

  recentHistory.forEach((record) => {
    const row = document.createElement("tr");

    const submissionDate = record.submissionDate ? new Date(record.submissionDate).toLocaleDateString("id-ID") : "-";

    // Format tanggal izin
    let leaveDateDisplay = record.leaveDate || "-";
    if (record.leaveStartDate && record.leaveEndDate) {
      const startDate = new Date(record.leaveStartDate).toLocaleDateString("id-ID", { day: "numeric", month: "short" });
      const endDate = new Date(record.leaveEndDate).toLocaleDateString("id-ID", { day: "numeric", month: "short" });

      if (record.leaveStartDate === record.leaveEndDate) {
        leaveDateDisplay = startDate;
      } else {
        leaveDateDisplay = `${startDate} - ${endDate}`;
      }
    }

    // Format jenis izin
    let leaveTypeDisplay = "Izin Normal";
    if (record.leaveType === "sakit") {
      leaveTypeDisplay = "Izin Sakit";
    } else if (record.leaveType === "cuti") {
      leaveTypeDisplay = "Cuti";
    }

    // Format jenis pengganti
    let replacementTypeDisplay = "Tidak Perlu Diganti";
    if (record.replacementType === "libur") {
      replacementTypeDisplay = "Ganti Libur";
    } else if (record.replacementType === "jam") {
      replacementTypeDisplay = "Ganti Jam";
    }

    const statusClass = record.status === "Disetujui" ? "success" : record.status === "Ditolak" ? "danger" : "warning";

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

// Function to load employee data
async function loadEmployees() {
try {
  employees = await getEmployees();
} catch (error) {
  console.error("Error loading employees:", error);
  showFeedback("error", "Gagal memuat data karyawan. Silakan refresh halaman.");
}
}

// Function to load leave history for an employee
async function loadLeaveHistory(employeeId) {
try {
  if (!employeeId) return;
  
  // Save current employee ID to localStorage
  localStorage.setItem("currentEmployeeId", employeeId);
  
  leaveHistory = await getLeaveRequestsByEmployee(employeeId);
  updateLeaveHistoryTable();
} catch (error) {
  console.error("Error loading leave history:", error);
  showFeedback("error", "Gagal memuat riwayat izin. Silakan refresh halaman.");
}
}

// Initialize date inputs with min date validation
function initDateInputs() {
const today = new Date();
const tomorrow = new Date(today);
tomorrow.setDate(tomorrow.getDate() + 1);

const formattedTomorrow = tomorrow.toISOString().split('T')[0];

const startDateInput = document.getElementById('leaveStartDate');
const endDateInput = document.getElementById('leaveEndDate');

if (startDateInput) {
  startDateInput.min = formattedTomorrow;
}

if (endDateInput) {
  endDateInput.min = formattedTomorrow;
}
}

// Reset button functionality
document.querySelector('button[type="reset"]')?.addEventListener("click", () => {
// Hide all sections
const sections = [
  "replacementLibur", 
  "replacementJam", 
  "sickLeaveSection", 
  "leaveSection", 
  "multiDateWarning", 
  "formFeedback"
];

sections.forEach(id => {
  const element = document.getElementById(id);
  if (element) element.style.display = "none";
});

// Reset replacement dates container to only have one date field
const container = document.getElementById('replacementDatesContainer');
if (container) {
  container.innerHTML = `
    <div class="mb-3 replacement-date-item">
      <label for="replacementDate0" class="form-label">Tanggal Ganti Libur 1</label>
      <div class="input-group">
        <span class="input-group-text"><i class="fas fa-calendar-check"></i></span>
        <input type="date" class="form-control replacement-date" id="replacementDate0" />
      </div>
    </div>
  `;
}

// Hide add more dates button
const addMoreDatesBtn = document.getElementById('addMoreDates');
if (addMoreDatesBtn) {
  addMoreDatesBtn.style.display = "none";
}
});

// Initialize page
document.addEventListener("DOMContentLoaded", () => {
loadEmployees();
initDateInputs();

// Check for saved employee ID
const savedEmployeeId = localStorage.getItem("currentEmployeeId");
if (savedEmployeeId && document.getElementById("employeeId")) {
  document.getElementById("employeeId").value = savedEmployeeId;
  loadLeaveHistory(savedEmployeeId);
}
});
