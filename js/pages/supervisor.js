//import { checkAuthState } from './auth.js';
import { getPendingLeaveRequests, getAllLeaveRequests, updateLeaveRequestStatus,updateReplacementStatus } from './leave-service.js';

// Check if user is logged in
// checkAuthState((user) => {
//   if (!user) {
//     window.location.href = 'login.html';
//   }
// });

// Initialize data
let pendingLeaves = [];
let allLeaves = [];

// Load pending leave requests
async function loadPendingLeaveRequests() {
  try {
    pendingLeaves = await getPendingLeaveRequests();
    console.log("Pending leave requests:", pendingLeaves); // Tambahkan log untuk debugging
    
    if (pendingLeaves.length === 0) {
      const tbody = document.getElementById('pendingLeaveList');
      tbody.innerHTML = '<tr><td colspan="6" class="text-center">Tidak ada pengajuan izin yang menunggu persetujuan</td></tr>';
    } else {
      updatePendingLeaveTable();
    }
  } catch (error) {
    console.error("Error loading pending leave requests:", error);
    const tbody = document.getElementById('pendingLeaveList');
    tbody.innerHTML = '<tr><td colspan="6" class="text-center">Error: Gagal memuat data</td></tr>';
  }
}

// Load all leave requests
async function loadAllLeaveRequests() {
  try {
    allLeaves = await getAllLeaveRequests();
    updateLeaveHistoryTable();
  } catch (error) {
    console.error("Error loading all leave requests:", error);
  }
}

// Update pending leave table
function updatePendingLeaveTable() {
  const tbody = document.getElementById('pendingLeaveList');
  tbody.innerHTML = '';
  
  pendingLeaves.forEach(record => {
    const replacementInfo = getReplacementInfo(record);
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${record.employeeId}</td>
      <td>${record.name}</td>
      <td>${record.leaveDate}</td>
      <td>${record.reason}</td>
      <td>${replacementInfo}</td>
      <td>
        <div class="action-buttons">
          <button class="approve-btn" data-id="${record.id}">Setuju</button>
          <button class="reject-btn" data-id="${record.id}">Tolak</button>
        </div>
      </td>
    `;
    tbody.appendChild(row);
  });
  
  // Add event listeners to action buttons
  document.querySelectorAll('.approve-btn').forEach(button => {
    button.addEventListener('click', async function() {
      const id = this.getAttribute('data-id');
      try {
        await updateLeaveRequestStatus(id, 'Approved');
        await refreshData();
      } catch (error) {
        console.error("Error approving leave request:", error);
        alert('Terjadi kesalahan saat menyetujui pengajuan izin.');
      }
    });
  });
  
  document.querySelectorAll('.reject-btn').forEach(button => {
    button.addEventListener('click', async function() {
      const id = this.getAttribute('data-id');
      try {
        await updateLeaveRequestStatus(id, 'Rejected');
        await refreshData();
      } catch (error) {
        console.error("Error rejecting leave request:", error);
        alert('Terjadi kesalahan saat menolak pengajuan izin.');
      }
    });
  });
}

// Update leave history table
function updateLeaveHistoryTable() {
  const tbody = document.getElementById('leaveHistoryList');
  tbody.innerHTML = '';
  
  allLeaves.forEach(record => {
    const replacementInfo = getReplacementInfo(record);
    const row = document.createElement('tr');
    
    // Tentukan status ganti dan tombol yang sesuai
    const replacementStatus = record.replacementStatus || 'Belum Diganti';
    const buttonText = replacementStatus === 'Sudah Diganti' ? 'Batalkan' : 'Sudah Diganti';
    const buttonClass = replacementStatus === 'Sudah Diganti' ? 'btn-warning' : 'btn-success';
    
    // Hanya tampilkan tombol aksi jika status pengajuan adalah Approved
    const actionButton = record.status === 'Approved' ? 
      `<button class="replacement-status-btn ${buttonClass} btn-sm" data-id="${record.id}" data-status="${replacementStatus}">
        ${buttonText}
      </button>` : '-';
    
    row.innerHTML = `
      <td>${record.employeeId}</td>
      <td>${record.name}</td>
      <td>${record.leaveDate}</td>
      <td>${record.reason}</td>
      <td>${replacementInfo}</td>
      <td class="status-${record.status.toLowerCase()}">${record.status}</td>
      <td>${record.decisionDate ? new Date(record.decisionDate.seconds * 1000).toLocaleDateString() : '-'}</td>
      <td class="status-${replacementStatus.toLowerCase().replace(/\s+/g, '-')}">${replacementStatus}</td>
      <td>${actionButton}</td>
    `;
    tbody.appendChild(row);
  });
   // Tambahkan event listener untuk tombol status ganti
  document.querySelectorAll('.replacement-status-btn').forEach(button => {
    button.addEventListener('click', async function() {
      try {
        const id = this.getAttribute('data-id');
        const currentStatus = this.getAttribute('data-status');
        const newStatus = currentStatus === 'Sudah Diganti' ? 'Belum Diganti' : 'Sudah Diganti';
        
        // Tampilkan indikator loading
        this.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Loading...';
        this.disabled = true;
        
        await updateReplacementStatus(id, newStatus);
        await refreshData();
        
        // Notifikasi sukses
        alert(`Status ganti berhasil diubah menjadi "${newStatus}"`);
      } catch (error) {
        console.error("Error updating replacement status:", error);
        alert('Terjadi kesalahan saat mengubah status ganti: ' + error.message);
        
        // Kembalikan tombol ke keadaan semula
        const currentStatus = this.getAttribute('data-status');
        const buttonText = currentStatus === 'Sudah Diganti' ? 'Batalkan' : 'Tandai Sudah Diganti';
        this.innerHTML = buttonText;
        this.disabled = false;
      }
    });
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

// Refresh all data
async function refreshData() {
  await loadPendingLeaveRequests();
  await loadAllLeaveRequests();
}

// Tambahkan fungsi ini di bagian akhir file
function setupRefreshButton() {
  const refreshButton = document.getElementById('refreshButton');
  if (refreshButton) {
    refreshButton.addEventListener('click', () => {
      refreshData();
    });
  }
}

// Modifikasi fungsi initialize
document.addEventListener('DOMContentLoaded', () => {
  refreshData();
  setupRefreshButton();
  
  // Tambahkan refresh otomatis setiap 30 detik
  setInterval(refreshData, 30000);
});

// Fungsi untuk menampilkan surat keterangan sakit
function viewMedicalCertificate(fileInfo) {
  if (!fileInfo || !fileInfo.url) {
    showAlert("warning", "Tidak ada surat keterangan sakit yang tersedia");
    return;
  }
  
  const modal = new bootstrap.Modal(document.getElementById('medicalCertModal'));
  const modalTitle = document.getElementById('medicalCertModalLabel');
  const modalBody = document.getElementById('medicalCertModalBody');
  
  modalTitle.textContent = 'Surat Keterangan Sakit';
  
  // Clear previous content
  modalBody.innerHTML = '';
  
  if (fileInfo.type.startsWith('image/')) {
    // If it's an image, display it
    const img = document.createElement('img');
    img.src = fileInfo.url;
    img.className = 'img-fluid';
    img.alt = 'Surat Keterangan Sakit';
    modalBody.appendChild(img);
  } else if (fileInfo.type === 'application/pdf') {
    // If it's a PDF, embed it
    const embed = document.createElement('embed');
    embed.src = fileInfo.url;
    embed.type = 'application/pdf';
    embed.width = '100%';
    embed.height = '500px';
    modalBody.appendChild(embed);
    
    // Also add a direct link
    const link = document.createElement('a');
    link.href = fileInfo.url;
    link.target = '_blank';
    link.className = 'btn btn-primary mt-2';
    link.innerHTML = '<i class="fas fa-external-link-alt me-2"></i>Buka di Tab Baru';
    modalBody.appendChild(link);
  } else {
    // For other file types, just show a download link
    const link = document.createElement('a');
    link.href = fileInfo.url;
    link.target = '_blank';
    link.className = 'btn btn-primary';
    link.innerHTML = '<i class="fas fa-download me-2"></i>Unduh File';
    modalBody.appendChild(link);
  }
  
  modal.show();
}

