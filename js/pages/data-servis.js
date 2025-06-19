import { getServisByMonth, updateServisStatus, smartServisCache } from '../services/servis-service.js';

// Global variables
let currentData = [];
let filteredData = [];

// Local cache system
const localCache = new Map();
const CACHE_EXPIRATION = 5 * 60 * 1000; // 5 menit

function getCachedData(key) {
  const cached = localCache.get(key);
  if (cached && (Date.now() - cached.timestamp < CACHE_EXPIRATION)) {
    return cached.data;
  }
  return null;
}

function setCachedData(key, data) {
  localCache.set(key, {
    data: data,
    timestamp: Date.now()
  });
}

function clearCacheKey(key) {
  localCache.delete(key);
}
// Initialize page
document.addEventListener('DOMContentLoaded', function() {
  initializePage();
  setupEventListeners();
});

function initializePage() {
  updateDateTime();
  setInterval(updateDateTime, 1000);
  
  // Populate year selector dan set default ke bulan/tahun sekarang
  populateYearSelector();
  const now = new Date();
  document.getElementById('monthSelector').value = now.getMonth() + 1;
  document.getElementById('yearSelector').value = now.getFullYear();
}

function populateYearSelector() {
  const yearSelector = document.getElementById('yearSelector');
  const currentYear = new Date().getFullYear();
  
  // Clear existing options
  yearSelector.innerHTML = '';
  
  // Add years (current year and 5 years back)
  for (let year = currentYear; year >= currentYear - 5; year--) {
    const option = document.createElement('option');
    option.value = year;
    option.textContent = year;
    yearSelector.appendChild(option);
  }
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
  const tampilkanBtn = document.getElementById('tampilkanBtn');
  if (tampilkanBtn) {
    tampilkanBtn.addEventListener('click', loadServisData);
  }

  // Search input
  const searchInput = document.getElementById('searchInput');
  if (searchInput) {
    searchInput.addEventListener('input', filterData);
    searchInput.addEventListener('keypress', function(e) {
      if (e.key === 'Enter') {
        filterData();
      }
    });
  }

  // Refresh data button
  const refreshBtn = document.getElementById('refreshData');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', refreshData);
  }

  // Save status button
  const saveStatusBtn = document.getElementById('saveStatusBtn');
  if (saveStatusBtn) {
    saveStatusBtn.addEventListener('click', saveStatusUpdate);
  }
}

async function loadServisData() {
  try {
    showLoading(true);
    
    const month = parseInt(document.getElementById('monthSelector').value);
    const year = parseInt(document.getElementById('yearSelector').value);
    const cacheKey = `month_${month}_${year}`;
    
    // Check local cache first
    const cachedData = getCachedData(cacheKey);
    
    if (cachedData) {
      console.log(`Using cached data for ${month}/${year}`);
      currentData = cachedData;
      showCacheIndicator(true);
    } else {
      console.log(`Fetching fresh data for ${month}/${year}`);
      currentData = await getServisByMonth(month, year);
      setCachedData(cacheKey, currentData);
      showCacheIndicator(false);
    }
    
    // Reset search dan tampilkan semua data - dengan pengecekan element
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
      searchInput.value = '';
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
  
  const fragment = document.createDocumentFragment();
  
  filteredData.forEach((item, index) => {
    const row = document.createElement('tr');
    const tanggalFormatted = new Date(item.tanggal).toLocaleDateString('id-ID');
    
    const statusServisBadge = item.statusServis === 'Sudah Selesai' 
      ? '<span class="badge bg-success">Sudah Selesai</span>'
      : '<span class="badge bg-warning">Belum Selesai</span>';
      
    const statusPengambilanBadge = item.statusPengambilan === 'Sudah Diambil'
      ? '<span class="badge bg-success">Sudah Diambil</span>'
      : '<span class="badge bg-danger">Belum Diambil</span>';
    
    row.innerHTML = `
      <td>${index + 1}</td>
      <td>${tanggalFormatted}</td>
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
    
    fragment.appendChild(row);
  });
  
  tbody.appendChild(fragment);
}

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
    
    // Update local data immediately untuk UX yang lebih baik
    updateLocalData(servisId, statusServis, statusPengambilan);
    
    // Close modal
    const modal = bootstrap.Modal.getInstance(document.getElementById('updateStatusModal'));
    modal.hide();
    
    // Update display immediately
    displayData();
    
    showAlert('success', 'Status berhasil diperbarui');
    showLoading(false);
    
  } catch (error) {
    console.error('Error updating status:', error);
    showAlert('danger', 'Terjadi kesalahan saat memperbarui status: ' + error.message);
    showLoading(false);
  }
}

function updateLocalData(servisId, statusServis, statusPengambilan) {
  // Update di currentData
  const currentIndex = currentData.findIndex(item => item.id === servisId);
  if (currentIndex !== -1) {
    currentData[currentIndex].statusServis = statusServis;
    currentData[currentIndex].statusPengambilan = statusPengambilan;
  }
  
  // Update di filteredData
  const filteredIndex = filteredData.findIndex(item => item.id === servisId);
  if (filteredIndex !== -1) {
    filteredData[filteredIndex].statusServis = statusServis;
    filteredData[filteredIndex].statusPengambilan = statusPengambilan;
  }
}

async function refreshData() {
  try {
    const month = parseInt(document.getElementById('monthSelector').value);
    const year = parseInt(document.getElementById('yearSelector').value);
    const cacheKey = `month_${month}_${year}`;
    
    // Clear specific cache untuk periode ini
    smartServisCache.clearKey(cacheKey);
    
    showCacheIndicator(false, 'Refreshing...');
    
    // Reload data fresh dari Firestore
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

function showCacheIndicator(isCache, customText = null) {
  const indicator = document.getElementById('cacheIndicator');
  if (indicator) {
    if (customText) {
      indicator.style.display = 'inline-block';
      indicator.innerHTML = `<i class="fas fa-spinner fa-spin me-1"></i> ${customText}`;
    } else {
      indicator.style.display = isCache ? 'inline-block' : 'none';
      if (isCache) {
        indicator.innerHTML = '<i class="fas fa-database me-1"></i> Cache';
      }
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

  setTimeout(() => {
    const alert = alertContainer.querySelector('.alert');
    if (alert) {
      const bsAlert = new bootstrap.Alert(alert);
      bsAlert.close();
    }
  }, 5000);
}