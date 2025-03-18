//import { checkAuthState } from './auth.js';
import { getPendingLeaveRequests, getAllLeaveRequests, updateLeaveRequestStatus } from './leave-service.js';

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
    updatePendingLeaveTable();
  } catch (error) {
    console.error("Error loading pending leave requests:", error);
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
    row.innerHTML = `
      <td>${record.employeeId}</td>
      <td>${record.name}</td>
      <td>${record.leaveDate}</td>
      <td>${record.reason}</td>
      <td>${replacementInfo}</td>
      <td class="status-${record.status.toLowerCase()}">${record.status}</td>
      <td>${record.decisionDate ? new Date(record.decisionDate.seconds * 1000).toLocaleDateString() : '-'}</td>
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

// Refresh all data
async function refreshData() {
  await loadPendingLeaveRequests();
  await loadAllLeaveRequests();
}

// Initialize page
document.addEventListener('DOMContentLoaded', () => {
  refreshData();
});
