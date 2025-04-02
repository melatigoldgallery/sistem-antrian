import { 
  getPendingLeaveRequests, 
  getAllLeaveRequests, 
  updateLeaveRequestStatus,
  updateReplacementStatus,
  clearLeaveRequestsCache
} from "../services/leave-service.js";

// Initialize data
let pendingLeaves = [];
let allLeaves = [];

// Load pending leave requests
async function loadPendingLeaveRequests() {
  try {
    const tbody = document.getElementById('pendingLeaveList');
    if (tbody) {
      tbody.innerHTML = '<tr><td colspan="6" class="text-center"><i class="fas fa-spinner fa-spin me-2"></i> Memuat data...</td></tr>';
    }
    
    pendingLeaves = await getPendingLeaveRequests();
    console.log("Pending leave requests:", pendingLeaves); // Debug log
    
    if (!pendingLeaves || pendingLeaves.length === 0) {
      if (tbody) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center">Tidak ada pengajuan izin yang menunggu persetujuan</td></tr>';
      }
      
      // Show empty state if exists
      const emptyState = document.getElementById('emptyPendingRequests');
      if (emptyState) emptyState.style.display = 'flex';
    } else {
      // Hide empty state if exists
      const emptyState = document.getElementById('emptyPendingRequests');
      if (emptyState) emptyState.style.display = 'none';
      
      updatePendingLeaveTable();
    }
    
    // Update stats
    updateStats();
  } catch (error) {
    console.error("Error loading pending leave requests:", error);
    const tbody = document.getElementById('pendingLeaveList');
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="6" class="text-center text-danger">Error: Gagal memuat data - ${error.message}</td></tr>`;
    }
  }
}

// Load all leave requests
async function loadAllLeaveRequests() {
  try {
    const tbody = document.getElementById('leaveHistoryList');
    if (tbody) {
      tbody.innerHTML = '<tr><td colspan="9" class="text-center"><i class="fas fa-spinner fa-spin me-2"></i> Memuat data...</td></tr>';
    }
    
    allLeaves = await getAllLeaveRequests();
    console.log("All leave requests:", allLeaves); // Debug log
    
    if (!allLeaves || allLeaves.length === 0) {
      if (tbody) {
        tbody.innerHTML = '<tr><td colspan="9" class="text-center">Belum ada data pengajuan izin</td></tr>';
      }
      
      // Show empty state if exists
      const emptyState = document.getElementById('emptyAllRequests');
      if (emptyState) emptyState.style.display = 'flex';
    } else {
      // Hide empty state if exists
      const emptyState = document.getElementById('emptyAllRequests');
      if (emptyState) emptyState.style.display = 'none';
      
      updateLeaveHistoryTable();
    }
    
    // Update stats
    updateStats();
  } catch (error) {
    console.error("Error loading all leave requests:", error);
    const tbody = document.getElementById('leaveHistoryList');
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="9" class="text-center text-danger">Error: Gagal memuat data - ${error.message}</td></tr>`;
    }
  }
}

// Update pending leave table
function updatePendingLeaveTable() {
  const tbody = document.getElementById('pendingLeaveList');
  if (!tbody) return;
  
  tbody.innerHTML = '';
  
  pendingLeaves.forEach(record => {
    const replacementInfo = getReplacementInfo(record);
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${record.employeeId || '-'}</td>
      <td>${record.name || '-'}</td>
      <td>${record.leaveDate || '-'}</td>
      <td>${record.reason || '-'}</td>
      <td>${replacementInfo}</td>
      <td>
        <div class="action-buttons">
          <button class="approve-btn btn btn-success btn-sm" data-id="${record.id}">Setuju</button>
          <button class="reject-btn btn btn-danger btn-sm" data-id="${record.id}">Tolak</button>
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
        // Show loading state
        this.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        this.disabled = true;
        
        await updateLeaveRequestStatus(id, 'Disetujui');
        await refreshData();
        
        // Show success message
        showAlert('success', 'Pengajuan izin berhasil disetujui!');
      } catch (error) {
        console.error("Error approving leave request:", error);
        showAlert('danger', 'Terjadi kesalahan saat menyetujui pengajuan izin.');
        
        // Reset button
        this.textContent = 'Setuju';
        this.disabled = false;
      }
    });
  });
  document.querySelectorAll('.reject-btn').forEach(button => {
    button.addEventListener('click', async function() {
      const id = this.getAttribute('data-id');
      try {
        // Show loading state
        this.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        this.disabled = true;
        
        await updateLeaveRequestStatus(id, 'Ditolak');
        await refreshData();
        
        // Show success message
        showAlert('success', 'Pengajuan izin berhasil ditolak.');
      } catch (error) {
        console.error("Error rejecting leave request:", error);
        showAlert('danger', 'Terjadi kesalahan saat menolak pengajuan izin.');
        
        // Reset button
        this.textContent = 'Tolak';
        this.disabled = false;
      }
    });
  });
}

// Update leave history table
function updateLeaveHistoryTable() {
  const tbody = document.getElementById('leaveHistoryList');
  if (!tbody) return;
  
  tbody.innerHTML = '';
  
  allLeaves.forEach(record => {
    // Periksa apakah izin multi-hari
    const isMultiDay = record.leaveStartDate && record.leaveEndDate && 
                      record.leaveStartDate !== record.leaveEndDate;
    
    // Jika bukan multi-hari, tampilkan seperti biasa
    if (!isMultiDay) {
      const replacementInfo = getReplacementInfo(record);
      const row = document.createElement('tr');
      
      // Tentukan status ganti dan tombol yang sesuai
      const replacementStatus = record.replacementStatus || 'Belum Diganti';
      const buttonText = replacementStatus === 'Sudah Diganti' ? 'Batalkan' : 'Sudah Diganti';
      const buttonClass = replacementStatus === 'Sudah Diganti' ? 'btn-warning' : 'btn-success';
      
      // Hanya tampilkan tombol aksi jika status pengajuan adalah Approved/Disetujui
      const actionButton = (record.status === 'Approved' || record.status === 'Disetujui') ? 
        `<button class="replacement-status-btn ${buttonClass} btn-sm" data-id="${record.id}" data-status="${replacementStatus}">
          ${buttonText}
        </button>` : '-';
      
      row.innerHTML = `
        <td>${record.employeeId || '-'}</td>
        <td>${record.name || '-'}</td>
        <td>${record.leaveDate || '-'}</td>
        <td>${record.reason || '-'}</td>
        <td>${replacementInfo}</td>
        <td class="status-${record.status.toLowerCase()}">${record.status}</td>
        <td>${record.decisionDate ? formatDate(record.decisionDate) : '-'}</td>
        <td class="status-${replacementStatus.toLowerCase().replace(/\s+/g, '-')}">${replacementStatus}</td>
        <td>${actionButton}</td>
      `;
      tbody.appendChild(row);
    } else {
      // Untuk multi-hari, buat baris untuk setiap hari
      const startDate = new Date(record.leaveStartDate);
      const endDate = new Date(record.leaveEndDate);
      const dayDiff = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
      
      // Pastikan replacementStatusArray ada
      const replacementStatusArray = record.replacementStatusArray || Array(dayDiff).fill("Belum Diganti");
      
      // Buat baris untuk setiap hari
      for (let i = 0; i < dayDiff; i++) {
        const currentDate = new Date(startDate);
        currentDate.setDate(startDate.getDate() + i);
        
        const formattedDate = currentDate.toLocaleDateString("id-ID", {
          day: "numeric",
          month: "long",
          year: "numeric"
        });
        
        const row = document.createElement('tr');
        
        // Jika ini hari pertama, tambahkan kelas untuk styling
        if (i === 0) {
          row.classList.add('first-day-row');
        }
        
        // Tentukan status ganti dan tombol untuk hari ini
        const dayStatus = replacementStatusArray[i] || 'Belum Diganti';
        const buttonText = dayStatus === 'Sudah Diganti' ? 'Batalkan' : 'Sudah Diganti';
        const buttonClass = dayStatus === 'Sudah Diganti' ? 'btn-warning' : 'btn-success';
        
        // Hanya tampilkan tombol aksi jika status pengajuan adalah Approved/Disetujui
        const actionButton = (record.status === 'Approved' || record.status === 'Disetujui') ? 
          `<button class="replacement-status-btn ${buttonClass} btn-sm" 
                   data-id="${record.id}" 
                   data-status="${dayStatus}" 
                   data-day-index="${i}">
            ${buttonText}
          </button>` : '-';
        
        // Tampilkan informasi penggantian untuk hari ini
        let replacementInfo = '-';
        if (record.replacementType === 'libur' && record.replacementDetails && record.replacementDetails.dates) {
          // Jika ada tanggal pengganti spesifik untuk hari ini
          if (record.replacementDetails.dates[i]) {
            replacementInfo = `Ganti libur pada ${record.replacementDetails.dates[i].formattedDate}`;
          }
        } else if (record.replacementType === 'jam' && record.replacementDetails) {
          replacementInfo = `Ganti ${record.replacementDetails.hours} jam pada ${record.replacementDetails.formattedDate}`;
        }
        
        // Untuk baris pertama, tampilkan semua informasi
        if (i === 0) {
          row.innerHTML = `
            <td>${record.employeeId || '-'}</td>
            <td>${record.name || '-'}</td>
            <td>${formattedDate} <span class="badge bg-info">Hari ${i+1}/${dayDiff}</span></td>
            <td>${record.reason || '-'}</td>
            <td>${replacementInfo}</td>
            <td class="status-${record.status.toLowerCase()}">${record.status}</td>
            <td>${record.decisionDate ? formatDate(record.decisionDate) : '-'}</td>
            <td class="status-${dayStatus.toLowerCase().replace(/\s+/g, '-')}">${dayStatus}</td>
            <td>${actionButton}</td>
          `;
        } else {
          // Untuk baris selanjutnya, hanya tampilkan informasi yang berbeda
          row.innerHTML = `
            <td>${record.employeeId || '-'}</td>
            <td>${record.name || '-'}</td>
            <td>${formattedDate} <span class="badge bg-info">Hari ${i+1}/${dayDiff}</span></td>
            <td>${record.reason || '-'}</td>
            <td>${replacementInfo}</td>
            <td class="status-${record.status.toLowerCase()}">${record.status}</td>
            <td>${record.decisionDate ? formatDate(record.decisionDate) : '-'}</td>
            <td class="status-${dayStatus.toLowerCase().replace(/\s+/g, '-')}">${dayStatus}</td>
            <td>${actionButton}</td>
          `;
        }
        
        tbody.appendChild(row);
      }
    }
  });
  
  // Add event listeners to replacement status buttons
  document.querySelectorAll('.replacement-status-btn').forEach(button => {
    button.addEventListener('click', async function() {
      try {
        const id = this.getAttribute('data-id');
        const currentStatus = this.getAttribute('data-status');
        const dayIndex = this.getAttribute('data-day-index');
        const newStatus = currentStatus === 'Sudah Diganti' ? 'Belum Diganti' : 'Sudah Diganti';
        
        // Show loading state
        this.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        this.disabled = true;
        
        // Jika ada dayIndex, update status untuk hari tertentu
        if (dayIndex !== null) {
          await updateReplacementStatus(id, newStatus, parseInt(dayIndex));
        } else {
          await updateReplacementStatus(id, newStatus);
        }
        
        await refreshData();
        
        // Show success message
        showAlert('success', `Status ganti berhasil diubah menjadi "${newStatus}"`);
      } catch (error) {
        console.error("Error updating replacement status:", error);
        showAlert('danger', 'Terjadi kesalahan saat mengubah status ganti: ' + error.message);
        
        // Reset button
        const currentStatus = this.getAttribute('data-status');
        const buttonText = currentStatus === 'Sudah Diganti' ? 'Batalkan' : 'Sudah Diganti';
        this.textContent = buttonText;
        this.disabled = false;
      }
    });
  });
}


// Helper function to format replacement information
function getReplacementInfo(record) {
  if (!record.replacementType || record.replacementType === "tidak") {
    return "Tidak perlu diganti";
  } else if (record.replacementType === "libur") {
    if (record.replacementDetails && record.replacementDetails.dates && record.replacementDetails.dates.length > 0) {
      // Handle multiple dates
      return record.replacementDetails.dates.map(date => 
        `Ganti libur pada ${date.formattedDate}`
      ).join("<br>");
    } else if (record.replacementDetails && record.replacementDetails.formattedDate) {
      return `Ganti libur pada ${record.replacementDetails.formattedDate}`;
    }
    return "Ganti libur";
  } else if (record.replacementType === "jam") {
    return record.replacementDetails && record.replacementDetails.hours && record.replacementDetails.formattedDate
      ? `Ganti ${record.replacementDetails.hours} jam pada ${record.replacementDetails.formattedDate}`
      : "Ganti jam";
  }
  return "-";
}

// Format date helper
function formatDate(date) {
  if (!date) return "-";
  
  return new Date(date).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric"
  });
}

// Update stats cards
function updateStats() {
  // Count total requests
  const totalRequests = pendingLeaves.length + allLeaves.length;
  document.getElementById('totalRequests').textContent = totalRequests;
  
  // Count approved requests
  const approvedRequests = allLeaves.filter(item => 
    item.status === 'Approved' || item.status === 'Disetujui'
  ).length;
  document.getElementById('approvedRequests').textContent = approvedRequests;
  
  // Count rejected requests
  const rejectedRequests = allLeaves.filter(item => 
    item.status === 'Rejected' || item.status === 'Ditolak'
  ).length;
  document.getElementById('rejectedRequests').textContent = rejectedRequests;
  
  // Count pending requests
  document.getElementById('pendingRequests').textContent = pendingLeaves.length;
}

// Show alert message
function showAlert(type, message, autoHide = true) {
  const alertContainer = document.getElementById('alertContainer');
  if (!alertContainer) return;
  
  // Create alert element
  const alertDiv = document.createElement('div');
  alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
  alertDiv.innerHTML = `
    ${message}
    <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
  `;
  
  // Clear previous alerts
  alertContainer.innerHTML = '';
  alertContainer.appendChild(alertDiv);
  alertContainer.style.display = 'block';
  
  // Auto-hide after 5 seconds if autoHide is true
  if (autoHide) {
    setTimeout(() => {
      if (alertDiv.parentNode) {
        alertDiv.classList.remove('show');
        setTimeout(() => {
          if (alertDiv.parentNode) {
            alertDiv.parentNode.removeChild(alertDiv);
          }
          
          // Hide container if no alerts
          if (alertContainer.children.length === 0) {
            alertContainer.style.display = 'none';
          }
        }, 150);
      }
    }, 5000);
  }
}

// Refresh all data
async function refreshData() {
  try {
    // Clear cache to ensure fresh data
    clearLeaveRequestsCache();
    
    // Show loading message
    showAlert('info', '<i class="fas fa-sync fa-spin me-2"></i> Memperbarui data...', false);
    
    // Load data in parallel
    await Promise.all([
      loadPendingLeaveRequests(),
      loadAllLeaveRequests()
    ]);
    
    // Hide loading message
    const alertContainer = document.getElementById('alertContainer');
    if (alertContainer) {
      alertContainer.style.display = 'none';
    }
  } catch (error) {
    console.error("Error refreshing data:", error);
    showAlert('danger', 'Terjadi kesalahan saat memuat ulang data: ' + error.message);
  }
}

// Setup refresh button
function setupRefreshButton() {
  const refreshButton = document.getElementById('refreshButton');
  if (refreshButton) {
    refreshButton.addEventListener('click', () => {
      refreshData();
    });
  }
}

// Function to view medical certificate
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

// Initialize page
document.addEventListener('DOMContentLoaded', () => {
  // Load initial data
  refreshData();
  
  // Setup refresh button
  setupRefreshButton();
  
  // Setup tab change event to refresh data
  const leaveRequestTabs = document.querySelectorAll('[data-bs-toggle="tab"]');
  leaveRequestTabs.forEach(tab => {
    tab.addEventListener('shown.bs.tab', function (event) {
      const targetId = event.target.getAttribute('data-bs-target');
      if (targetId === '#all-requests') {
        // Refresh all requests when switching to the tab
        loadAllLeaveRequests();
      } else if (targetId === '#pending-requests') {
        // Refresh pending requests when switching to the tab
        loadPendingLeaveRequests();
      }
    });
  });
  
  // Setup search functionality
  const searchInput = document.getElementById('searchInput');
  const searchBtn = document.getElementById('searchBtn');
  
  if (searchInput && searchBtn) {
    searchBtn.addEventListener('click', function() {
      const searchTerm = searchInput.value.toLowerCase().trim();
      
      if (searchTerm === '') {
        // If search is empty, reset tables
        updatePendingLeaveTable();
        updateLeaveHistoryTable();
        return;
      }
      
      // Filter pending leaves
      const filteredPending = pendingLeaves.filter(record => 
        (record.employeeId && record.employeeId.toLowerCase().includes(searchTerm)) || 
        (record.name && record.name.toLowerCase().includes(searchTerm))
      );
      
      // Update pending table with filtered results
      const pendingTbody = document.getElementById('pendingLeaveList');
      if (pendingTbody) {
        pendingTbody.innerHTML = '';
        
        if (filteredPending.length === 0) {
          pendingTbody.innerHTML = '<tr><td colspan="6" class="text-center">Tidak ada hasil yang sesuai dengan pencarian</td></tr>';
        } else {
          filteredPending.forEach(record => {
            const replacementInfo = getReplacementInfo(record);
            const row = document.createElement('tr');
            
            row.innerHTML = `
              <td>${record.employeeId || '-'}</td>
              <td>${record.name || '-'}</td>
              <td>${record.leaveDate || '-'}</td>
              <td>${record.reason || '-'}</td>
              <td>${replacementInfo}</td>
              <td>
                <div class="action-buttons">
                  <button class="approve-btn btn btn-success btn-sm" data-id="${record.id}">Setuju</button>
                  <button class="reject-btn btn btn-danger btn-sm" data-id="${record.id}">Tolak</button>
                </div>
              </td>
            `;
            pendingTbody.appendChild(row);
          });
        }
      }
      
      // Filter all leaves
      const filteredAll = allLeaves.filter(record => 
        (record.employeeId && record.employeeId.toLowerCase().includes(searchTerm)) || 
        (record.name && record.name.toLowerCase().includes(searchTerm))
      );
      
      // Update all leaves table with filtered results
      const allTbody = document.getElementById('leaveHistoryList');
      if (allTbody) {
        allTbody.innerHTML = '';
        
        if (filteredAll.length === 0) {
          allTbody.innerHTML = '<tr><td colspan="9" class="text-center">Tidak ada hasil yang sesuai dengan pencarian</td></tr>';
        } else {
          filteredAll.forEach(record => {
            const replacementInfo = getReplacementInfo(record);
            const row = document.createElement('tr');
            
            // Tentukan status ganti dan tombol yang sesuai
            const replacementStatus = record.replacementStatus || 'Belum Diganti';
            const buttonText = replacementStatus === 'Sudah Diganti' ? 'Batalkan' : 'Sudah Diganti';
            const buttonClass = replacementStatus === 'Sudah Diganti' ? 'btn-warning' : 'btn-success';
            
                       // Hanya tampilkan tombol aksi jika status pengajuan adalah Approved/Disetujui
                       const actionButton = (record.status === 'Approved' || record.status === 'Disetujui') ? 
                       `<button class="replacement-status-btn ${buttonClass} btn-sm" data-id="${record.id}" data-status="${replacementStatus}">
                         ${buttonText}
                       </button>` : '-';
                     
                     row.innerHTML = `
                       <td>${record.employeeId || '-'}</td>
                       <td>${record.name || '-'}</td>
                       <td>${record.leaveDate || '-'}</td>
                       <td>${record.reason || '-'}</td>
                       <td>${replacementInfo}</td>
                       <td class="status-${record.status.toLowerCase()}">${record.status}</td>
                       <td>${record.decisionDate ? formatDate(record.decisionDate) : '-'}</td>
                       <td class="status-${replacementStatus.toLowerCase().replace(/\s+/g, '-')}">${replacementStatus}</td>
                       <td>${actionButton}</td>
                     `;
                     allTbody.appendChild(row);
                   });
                 }
               }
               
               // Re-add event listeners after updating the tables
               addEventListenersToButtons();
             });
             
             // Add event listener for Enter key
             searchInput.addEventListener('keyup', function(event) {
               if (event.key === 'Enter') {
                 searchBtn.click();
               }
             });
           }
           
           // Tambahkan refresh otomatis setiap 60 detik (lebih lama untuk menghemat reads)
           setInterval(refreshData, 60000);
         });
         
         // Function to add event listeners to all buttons
         function addEventListenersToButtons() {
           // Add event listeners to approve/reject buttons
           document.querySelectorAll('.approve-btn').forEach(button => {
             button.addEventListener('click', async function() {
               const id = this.getAttribute('data-id');
               try {
                 // Show loading state
                 this.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
                 this.disabled = true;
                 
                 await updateLeaveRequestStatus(id, 'Disetujui');
                 await refreshData();
                 
                 // Show success message
                 showAlert('success', 'Pengajuan izin berhasil disetujui!');
               } catch (error) {
                 console.error("Error approving leave request:", error);
                 showAlert('danger', 'Terjadi kesalahan saat menyetujui pengajuan izin.');
                 
                 // Reset button
                 this.textContent = 'Setuju';
                 this.disabled = false;
               }
             });
           });
           
           document.querySelectorAll('.reject-btn').forEach(button => {
             button.addEventListener('click', async function() {
               const id = this.getAttribute('data-id');
               try {
                 // Show loading state
                 this.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
                 this.disabled = true;
                 
                 await updateLeaveRequestStatus(id, 'Ditolak');
                 await refreshData();
                 
                 // Show success message
                 showAlert('success', 'Pengajuan izin berhasil ditolak.');
               } catch (error) {
                 console.error("Error rejecting leave request:", error);
                 showAlert('danger', 'Terjadi kesalahan saat menolak pengajuan izin.');
                 
                 // Reset button
                 this.textContent = 'Tolak';
                 this.disabled = false;
               }
             });
           });
           
           // Add event listeners to replacement status buttons
           document.querySelectorAll('.replacement-status-btn').forEach(button => {
             button.addEventListener('click', async function() {
               try {
                 const id = this.getAttribute('data-id');
                 const currentStatus = this.getAttribute('data-status');
                 const newStatus = currentStatus === 'Sudah Diganti' ? 'Belum Diganti' : 'Sudah Diganti';
                 
                 // Show loading state
                 this.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
                 this.disabled = true;
                 
                 await updateReplacementStatus(id, newStatus);
                 await refreshData();
                 
                 // Show success message
                 showAlert('success', `Status ganti berhasil diubah menjadi "${newStatus}"`);
               } catch (error) {
                 console.error("Error updating replacement status:", error);
                 showAlert('danger', 'Terjadi kesalahan saat mengubah status ganti: ' + error.message);
                 
                 // Reset button
                 const currentStatus = this.getAttribute('data-status');
                 const buttonText = currentStatus === 'Sudah Diganti' ? 'Batalkan' : 'Sudah Diganti';
                 this.textContent = buttonText;
                 this.disabled = false;
               }
             });
           });
         }
         
