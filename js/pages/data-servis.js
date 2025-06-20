import { getServisByMonth, updateServisStatus, smartServisCache } from '../services/servis-service.js';

// Global variables
let currentData = [];
let filteredData = [];
let isDataLoaded = false;

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

  // Search input dengan ID yang benar
  const searchInput = document.getElementById('searchInputTable');
  if (searchInput) {
    searchInput.addEventListener('input', applyFilters);
    searchInput.addEventListener('keypress', function(e) {
      if (e.key === 'Enter') {
        applyFilters();
      }
    });
  }

  // Status filters
const statusServisFilter = document.getElementById('statusServisFilter');
  const statusPengambilanFilter = document.getElementById('statusPengambilanFilter');
  
  if (statusServisFilter) {
    statusServisFilter.addEventListener('change', function() {
      handleFilterLogic();
      // HANYA apply filter jika data sudah loaded
      if (isDataLoaded) {
        applyFilters();
      }
    });
  }
  
  if (statusPengambilanFilter) {
    statusPengambilanFilter.addEventListener('change', function() {
      // HANYA apply filter jika data sudah loaded
      if (isDataLoaded) {
        applyFilters();
      }
    });
  }

  // Save status button
  const saveStatusBtn = document.getElementById('saveStatusBtn');
  if (saveStatusBtn) {
    saveStatusBtn.addEventListener('click', saveStatusUpdate);
  }

    // Setup modal event listeners
  setupModalEventListeners();
}

function setupModalEventListeners() {
  const statusServisSelect = document.getElementById('statusServis');
  const statusPengambilanSelect = document.getElementById('statusPengambilan');
  
  // Event listener untuk Status Servis
  if (statusServisSelect) {
    statusServisSelect.addEventListener('change', function() {
      const pengambilanForm = document.getElementById('pengambilanForm');
      
      if (this.value === 'Belum Selesai') {
        // Jika belum selesai, paksa status pengambilan ke "Belum Diambil"
        statusPengambilanSelect.value = 'Belum Diambil';
        statusPengambilanSelect.disabled = true;
        pengambilanForm.style.display = 'none';
        // Reset form pengambilan
        document.getElementById('stafHandle').value = '';
        document.getElementById('waktuPengambilan').value = '';
      } else {
        // Jika sudah selesai, enable dropdown pengambilan
        statusPengambilanSelect.disabled = false;
      }
    });
  }
  
  // Event listener untuk Status Pengambilan
  if (statusPengambilanSelect) {
    statusPengambilanSelect.addEventListener('change', function() {
      const pengambilanForm = document.getElementById('pengambilanForm');
      const waktuPengambilan = document.getElementById('waktuPengambilan');
      
      if (this.value === 'Sudah Diambil') {
        pengambilanForm.style.display = 'block';
        // Set waktu sekarang
        const now = new Date();
        const localDateTime = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
          .toISOString().slice(0, 16);
        waktuPengambilan.value = localDateTime;
      } else {
        pengambilanForm.style.display = 'none';
        document.getElementById('stafHandle').value = '';
        waktuPengambilan.value = '';
      }
    });
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
    
    // Reset search
    const searchInput = document.getElementById('searchInputTable');
    if (searchInput) {
      searchInput.value = '';
    }
    
    // Set flag bahwa data sudah loaded
    isDataLoaded = true;
    
    // Apply filters setelah data loaded
    applyFilters();
    showLoading(false);
    
  } catch (error) {
    console.error('Error loading servis data:', error);
    showAlert('danger', 'Terjadi kesalahan saat memuat data: ' + error.message);
    showLoading(false);
    isDataLoaded = false;
  }
}

function resetFilters() {
  const searchInput = document.getElementById('searchInputTable');
  
  if (searchInput) searchInput.value = '';
}

function applyFilters() {
  const searchTerm = document.getElementById('searchInputTable')?.value.trim().toLowerCase() || '';
  const statusServisFilter = document.getElementById('statusServisFilter')?.value || '';
  const statusPengambilanFilter = document.getElementById('statusPengambilanFilter')?.value || '';
  
  filteredData = currentData.filter(item => {
    // Search filter
    const matchesSearch = !searchTerm || 
      item.namaCustomer?.toLowerCase().includes(searchTerm) ||
      item.noHp?.includes(searchTerm) ||
      item.namaBarang?.toLowerCase().includes(searchTerm);
    
    // Status filters
    const matchesStatusServis = !statusServisFilter || item.statusServis === statusServisFilter;
    const matchesStatusPengambilan = !statusPengambilanFilter || item.statusPengambilan === statusPengambilanFilter;
    
    return matchesSearch && matchesStatusServis && matchesStatusPengambilan;
  });
  
  displayData();
}

function displayData() {
  const tbody = document.getElementById('dataServisList');
  const tableContainer = document.getElementById('tableContainer');
  const noDataMessage = document.getElementById('noDataMessage');
  
if (!isDataLoaded) {
    tableContainer.style.display = 'none';
    noDataMessage.style.display = 'none';
    return;
  }
  
  // SELALU tampilkan table container (termasuk search section)
  tableContainer.style.display = 'block';
  
  if (filteredData.length === 0) {
    // Kosongkan tbody tapi tetap tampilkan table structure
    tbody.innerHTML = '';
    noDataMessage.style.display = 'block';
    
    // Pastikan table tetap terlihat dengan header
    const tableWrapper = document.getElementById('tableWrapper');
    if (tableWrapper) {
      tableWrapper.style.display = 'block';
    }
    return;
  }
  
  // Ada data - sembunyikan pesan no data
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
    
    // Format waktu pengambilan
    const waktuPengambilan = item.waktuPengambilan 
      ? new Date(item.waktuPengambilan).toLocaleString('id-ID')
      : '-';
    
    row.innerHTML = `
      <td style="border-right: 2px solid #dee2e6;">${index + 1}</td>
      <td style="border-right: 2px solid #dee2e6;">${tanggalFormatted}</td>
      <td style="border-right: 2px solid #dee2e6;">${item.namaCustomer}</td>
      <td style="border-right: 2px solid #dee2e6;">${item.noHp}</td>
      <td style="border-right: 2px solid #dee2e6; min-width: 200px; max-width: 250px; word-wrap: break-word;">${item.namaBarang}</td>
      <td style="border-right: 2px solid #dee2e6;">${item.jenisServis}</td>
      <td style="border-right: 2px solid #dee2e6;">${statusServisBadge}</td>
      <td style="border-right: 2px solid #dee2e6;">${statusPengambilanBadge}</td>
      <td style="border-right: 2px solid #dee2e6;">${item.stafHandle || '-'}</td>
      <td style="border-right: 2px solid #dee2e6;"><small>${waktuPengambilan}</small></td>
      <td>
        <button class="btn btn-sm btn-primary" onclick="openUpdateModal('${item.id}', '${item.statusServis}', '${item.statusPengambilan}', '${item.stafHandle || ''}', '${item.waktuPengambilan || ''}')">
          <i class="fas fa-edit"></i>
        </button>
      </td>
    `;
    
    fragment.appendChild(row);
  });
  
  tbody.appendChild(fragment);
}

// Update openUpdateModal function
window.openUpdateModal = function(servisId, currentStatusServis, currentStatusPengambilan, stafHandle = '', waktuPengambilan = '') {
  document.getElementById('updateServisId').value = servisId;
  document.getElementById('statusServis').value = currentStatusServis;
  document.getElementById('statusPengambilan').value = currentStatusPengambilan;
  
  const statusPengambilanSelect = document.getElementById('statusPengambilan');
  const pengambilanForm = document.getElementById('pengambilanForm');
  
  // Logika disable/enable berdasarkan status servis
  if (currentStatusServis === 'Belum Selesai') {
    statusPengambilanSelect.disabled = true;
    statusPengambilanSelect.value = 'Belum Diambil';
    pengambilanForm.style.display = 'none';
  } else {
    statusPengambilanSelect.disabled = false;
    
    // Set data pengambilan jika ada
    document.getElementById('stafHandle').value = stafHandle;
    if (waktuPengambilan) {
      const waktu = new Date(waktuPengambilan);
      const localDateTime = new Date(waktu.getTime() - waktu.getTimezoneOffset() * 60000)
        .toISOString().slice(0, 16);
      document.getElementById('waktuPengambilan').value = localDateTime;
    }
    
    // Show/hide pengambilan form
    if (currentStatusPengambilan === 'Sudah Diambil') {
      pengambilanForm.style.display = 'block';
    } else {
      pengambilanForm.style.display = 'none';
    }
  }
  
  const modal = new bootstrap.Modal(document.getElementById('updateStatusModal'));
  modal.show();
};

async function saveStatusUpdate() {
  try {
    const servisId = document.getElementById('updateServisId').value;
    const statusServis = document.getElementById('statusServis').value;
    const statusPengambilan = document.getElementById('statusPengambilan').value;
    
    let updateData = {
      statusServis,
      statusPengambilan
    };
    
    // Tambahkan data pengambilan jika status sudah diambil
    if (statusPengambilan === 'Sudah Diambil') {
      const stafHandle = document.getElementById('stafHandle').value.trim();
      const waktuPengambilan = document.getElementById('waktuPengambilan').value;
      
      if (!stafHandle) {
        showAlert('warning', 'Nama staf handle harus diisi');
        return;
      }
      
      updateData.stafHandle = stafHandle;
      updateData.waktuPengambilan = new Date(waktuPengambilan).toISOString();
    } else {
      // Reset data pengambilan jika status berubah ke belum diambil
      updateData.stafHandle = null;
      updateData.waktuPengambilan = null;
    }
    
    showLoading(true);
    
    // Update ke Firestore dengan data lengkap
    await updateServisStatus(servisId, updateData.statusServis, updateData.statusPengambilan, updateData.stafHandle, updateData.waktuPengambilan);
    
    // Update local data
    updateLocalData(servisId, updateData);
    
    // Close modal
    const modal = bootstrap.Modal.getInstance(document.getElementById('updateStatusModal'));
    modal.hide();
    
    // Re-apply filters
    applyFilters();
    
    showAlert('success', 'Status berhasil diperbarui');
    showLoading(false);
    
  } catch (error) {
    console.error('Error updating status:', error);
    showAlert('danger', 'Terjadi kesalahan saat memperbarui status: ' + error.message);
    showLoading(false);
  }
}

function updateLocalData(servisId, updateData) {
  // Update di currentData
  const currentIndex = currentData.findIndex(item => item.id === servisId);
  if (currentIndex !== -1) {
    Object.assign(currentData[currentIndex], updateData);
  }
  
  // Update di filteredData
  const filteredIndex = filteredData.findIndex(item => item.id === servisId);
  if (filteredIndex !== -1) {
    Object.assign(filteredData[filteredIndex], updateData);
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
