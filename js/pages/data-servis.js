import { getServisByDate, searchServis, updateServisStatus, clearServisCache } from '../services/servis-service.js';

// Global variables
let currentData = [];
let filteredData = [];

// Initialize page
document.addEventListener('DOMContentLoaded', function() {
  initializePage();
  setupEventListeners();
});

function initializePage() {
  // Set current date and time
  updateDateTime();
  setInterval(updateDateTime, 1000);
  
  // Set default date to today
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('tanggalFilter').value = today;
}

function updateDateTime() {
  const now = new Date();
  const dateElement = document.getElementById('current-date');
  const timeElement = document.getElementById('current-time');

  if (dateElement) {
    dateElement.textContent = now.toLocaleDateString('id-ID', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  if (timeElement) {
    timeElement.textContent = now.toLocaleTimeString('id-ID');
  }
}

function setupEventListeners() {
  // Tampilkan button
  document.getElementById('tampilkanBtn').addEventListener('click', function() {
    loadServisData();
  });

  // Search input
  document.getElementById('searchInput').addEventListener('input', function() {
    filterData();
  });

  // Refresh data button
  document.getElementById('refreshData').addEventListener('click', function() {
    refreshData();
  });

  // Save status button
  document.getElementById('saveStatusBtn').addEventListener('click', function() {
    saveStatusUpdate();
  });

  // Enter key on search
  document.getElementById('searchInput').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
      filterData();
    }
  });
}

async function loadServisData() {
  try {
    showLoading(true);
    
    const tanggal = document.getElementById('tanggalFilter').value;
    const searchTerm = document.getElementById('searchInput').value.trim();
    
    if (!tanggal && !searchTerm) {
      showAlert('warning', 'Pilih tanggal atau masukkan kata kunci pencarian');
      showLoading(false);
      return;
    }
    
    if (tanggal) {
      currentData = await getServisByDate(tanggal);
    } else {
      currentData = await searchServis(searchTerm);
    }
    
    filteredData = [...currentData];
    displayData();
    showLoading(false);
    
  } catch (error) {
    console.error('Error loading servis data:', error);
    showAlert('danger', 'Terjadi kesalahan saat memuat data: ' + error.message);
    showLoading(false);
  }
}

function filterData() {
  const searchTerm = document.getElementById('searchInput').value.trim().toLowerCase();
  
  if (!searchTerm) {
    filteredData = [...currentData];
  } else {
    filteredData = currentData.filter(item => 
      item.namaCustomer?.toLowerCase().includes(searchTerm) ||
      item.noHp?.includes(searchTerm) ||
      item.namaBarang?.toLowerCase().includes(searchTerm)
    );
  }
  
  displayData();
}

function displayData() {
  const tbody = document.getElementById('dataServisList');
  const tableContainer = document.getElementById('tableContainer');
  const noDataMessage = document.getElementById('noDataMessage');
  
  if (filteredData.length === 0) {
    tableContainer.style.display = 'none';
    noDataMessage.style.display = 'block';
    return;
  }
  
  tableContainer.style.display = 'block';
  noDataMessage.style.display = 'none';
  
  tbody.innerHTML = '';
  
  filteredData.forEach((item, index) => {
    const row = document.createElement('tr');
    
    // Status badges
    const statusServisBadge = item.statusServis === 'Sudah Selesai' 
      ? '<span class="badge bg-success">Sudah Selesai</span>'
      : '<span class="badge bg-warning">Belum Selesai</span>';
      
    const statusPengambilanBadge = item.statusPengambilan === 'Sudah Diambil'
      ? '<span class="badge bg-success">Sudah Diambil</span>'
      : '<span class="badge bg-danger">Belum Diambil</span>';
    
    row.innerHTML = `
      <td>${index + 1}</td>
      <td>${item.namaCustomer}</td>
      <td>${item.noHp}</td>
      <td>${item.namaBarang}</td>
      <td>${item.jenisServis}</td>
      <td>${statusServisBadge}</td>
      <td>${statusPengambilanBadge}</td>
      <td>
        <button class="btn btn-sm btn-primary" onclick="openUpdateModal('${item.id}', '${item.statusServis}', '${item.statusPengambilan}')">
          <i class="fas fa-edit"></i> Update
        </button>
      </td>
    `;
    
    tbody.appendChild(row);
  });
  
  // Hide cache indicator
  const cacheIndicator = document.getElementById('cacheIndicator');
  if (cacheIndicator) {
    cacheIndicator.style.display = 'none';
  }
}

// Global function for button clicks
window.openUpdateModal = function(servisId, currentStatusServis, currentStatusPengambilan) {
  document.getElementById('updateServisId').value = servisId;
  document.getElementById('statusServis').value = currentStatusServis;
  document.getElementById('statusPengambilan').value = currentStatusPengambilan;
  
  const modal = new bootstrap.Modal(document.getElementById('updateStatusModal'));
  modal.show();
};

async function saveStatusUpdate() {
  try {
    const servisId = document.getElementById('updateServisId').value;
    const statusServis = document.getElementById('statusServis').value;
    const statusPengambilan = document.getElementById('statusPengambilan').value;
    
    showLoading(true);
    
    await updateServisStatus(servisId, statusServis, statusPengambilan);
    
    // Close modal
    const modal = bootstrap.Modal.getInstance(document.getElementById('updateStatusModal'));
    modal.hide();
    
    // Reload data
    await loadServisData();
    
    showAlert('success', 'Status berhasil diperbarui');
    showLoading(false);
    
  } catch (error) {
    console.error('Error updating status:', error);
    showAlert('danger', 'Terjadi kesalahan saat memperbarui status: ' + error.message);
    showLoading(false);
  }
}

async function refreshData() {
  try {
    // Clear cache
    clearServisCache();
    
    // Show cache indicator
    const cacheIndicator = document.getElementById('cacheIndicator');
    if (cacheIndicator) {
      cacheIndicator.style.display = 'inline-block';
      cacheIndicator.textContent = 'Refreshing...';
    }
    
    // Reload data
    await loadServisData();
    
    showAlert('info', 'Data berhasil diperbarui dari server');
    
  } catch (error) {
    console.error('Error refreshing data:', error);
    showAlert('danger', 'Terjadi kesalahan saat memperbarui data: ' + error.message);
  }
}

function showLoading(show) {
  const refreshBtn = document.getElementById('refreshData');
  const tampilkanBtn = document.getElementById('tampilkanBtn');
  
  if (show) {
    document.body.style.cursor = 'wait';
    if (refreshBtn) {
      refreshBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i> Loading...';
      refreshBtn.disabled = true;
    }
    if (tampilkanBtn) {
      tampilkanBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i> Memuat...';
      tampilkanBtn.disabled = true;
    }
  } else {
    document.body.style.cursor = 'default';
    if (refreshBtn) {
      refreshBtn.innerHTML = '<i class="fas fa-sync-alt me-1"></i> Refresh Data';
      refreshBtn.disabled = false;
    }
    if (tampilkanBtn) {
      tampilkanBtn.innerHTML = '<i class="fas fa-search me-2"></i> Tampilkan';
      tampilkanBtn.disabled = false;
    }
  }
}

function showAlert(type, message) {
  const alertContainer = document.getElementById('alertContainer');
  if (!alertContainer) return;

  alertContainer.innerHTML = `
    <div class="alert alert-${type} alert-dismissible fade show">
      <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'warning' ? 'exclamation-triangle' : type === 'danger' ? 'exclamation-circle' : 'info-circle'} me-2"></i>
      ${message}
      <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    </div>
  `;

  alertContainer.style.display = 'block';

  // Auto hide after 5 seconds
  setTimeout(() => {
    const alert = alertContainer.querySelector('.alert');
    if (alert) {
      const bsAlert = new bootstrap.Alert(alert);
      bsAlert.close();
    }
  }, 5000);
}

