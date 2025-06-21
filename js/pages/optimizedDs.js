import { getServisByMonth, updateServisStatus, smartServisCache } from '../services/servis-service.js';

// Global variables
let currentData = [];
let filteredData = [];
let isDataLoaded = false;
let lastDataCheck = 0;
let cacheVersion = Date.now();

// Enhanced local cache system with TTL
const localCache = new Map();
const cacheMeta = new Map(); // Cache metadata for timestamps
const CACHE_EXPIRATION = 5 * 60 * 1000; // 5 menit
const CACHE_TTL_STANDARD = 60 * 60 * 1000; // 1 jam untuk data standar
const CACHE_TTL_TODAY = 5 * 60 * 1000; // 5 menit untuk data hari ini
const DATA_SYNC_INTERVAL = 30 * 1000; // 30 detik

// PERBAIKAN: Tambahkan flag untuk tracking perubahan data
let lastKnownDataCount = 0;
let currentMonthYear = null;

// Cache management functions
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
  
  // Update cache metadata
  updateCacheTimestamp(key);
}

function clearCacheKey(key) {
  localCache.delete(key);
  cacheMeta.delete(key);
}

function updateCacheTimestamp(cacheKey, timestamp = Date.now()) {
  try {
    cacheMeta.set(cacheKey, timestamp);
  } catch (error) {
    console.error("Error updating cache timestamp:", error);
  }
}

// Perbaiki fungsi untuk selective cache update
function updateCacheSelectively(action, data) {
  try {
    if (!currentMonthYear) return;
    
    const { month, year } = currentMonthYear;
    const cacheKey = `month_${month}_${year}`;
    
    // Get current cached data
    const cached = localCache.get(cacheKey);
    if (!cached) return;
    
    let updatedData = [...cached.data];
    let dataChanged = false;
    
    switch (action) {
      case 'add':
        // Check if data belongs to current month/year
        const dataDate = new Date(data.tanggal);
        if (dataDate.getMonth() + 1 === month && dataDate.getFullYear() === year) {
          updatedData.push(data);
          dataChanged = true;
          console.log('Added new data to cache:', data.id);
        }
        break;
        
      case 'update':
        const updateIndex = updatedData.findIndex(item => item.id === data.id);
        if (updateIndex !== -1) {
          // PERBAIKAN: Handle Timestamp objects dalam update data
          const updateData = { ...data };
          
          // Convert Timestamp objects untuk konsistensi
          if (updateData.waktuPengambilan && updateData.waktuPengambilan.toDate) {
            updateData.waktuPengambilan = updateData.waktuPengambilan.toDate().toISOString();
          }
          if (updateData.createdAt && updateData.createdAt.toDate) {
            updateData.createdAt = updateData.createdAt.toDate().toISOString();
          }
          if (updateData.updatedAt && updateData.updatedAt.toDate) {
            updateData.updatedAt = updateData.updatedAt.toDate().toISOString();
          }
          
          // Merge update data with existing data
          updatedData[updateIndex] = { ...updatedData[updateIndex], ...updateData };
          dataChanged = true;
          console.log('Updated data in cache:', data.id);
        }
        break;
        
      case 'delete':
        const deleteIndex = updatedData.findIndex(item => item.id === data.id);
        if (deleteIndex !== -1) {
          updatedData.splice(deleteIndex, 1);
          dataChanged = true;
          console.log('Removed data from cache:', data.id);
        }
        break;
    }
    
    if (dataChanged) {
      // Update cache with new data
      setCachedData(cacheKey, updatedData);
      
      // Update current data if it's the active dataset
      if (isDataLoaded) {
        currentData = updatedData;
        
        // Update filtered data if item was in current filter
        if (action === 'delete') {
          filteredData = filteredData.filter(item => item.id !== data.id);
        } else if (action === 'update') {
          const filteredIndex = filteredData.findIndex(item => item.id === data.id);
          if (filteredIndex !== -1) {
            filteredData[filteredIndex] = { ...filteredData[filteredIndex], ...data };
          }
        }
        
        // Re-apply filters to show updated data
        applyFilters();
      }
      
      // Update cache version
      cacheVersion = Date.now();
      
      // Save to localStorage
      saveServisCacheToStorage();
    }
  } catch (error) {
    console.error('Error updating cache selectively:', error);
  }
}

// Setup event listeners untuk data changes
function setupDataChangeListeners() {
  // Listen untuk storage events (cross-tab)
  window.addEventListener('storage', function(e) {
    if (e.key === 'servisDataChange' && e.newValue) {
      try {
        const event = JSON.parse(e.newValue);
        console.log('Received cross-tab data change:', event);
        
        // Update cache selectively
        updateCacheSelectively(event.action, event.data);
        
        // Clean up the event
        localStorage.removeItem('servisDataChange');
      } catch (error) {
        console.error('Error handling storage event:', error);
      }
    }
  });
  
  // Listen untuk same-tab events
  window.addEventListener('servisDataChanged', function(e) {
    if (e.detail) {
      console.log('Received same-tab data change:', e.detail);
      updateCacheSelectively(e.detail.action, e.detail.data);
    }
  });
}

function shouldUpdateCache(cacheKey) {
  if (!cacheMeta.has(cacheKey)) return true;

  const lastUpdate = cacheMeta.get(cacheKey);
  const now = Date.now();
  
  // PERBAIKAN: Cek jika ada indikasi data baru dari input-servis
  const hasNewDataIndication = checkForNewDataIndication();
  if (hasNewDataIndication) {
    console.log('New data indication detected, forcing cache update');
    return true;
  }
  
  // Gunakan TTL yang berbeda berdasarkan jenis data
  const today = new Date().toISOString().split('T')[0];
  const currentMonth = today.substring(0, 7); // YYYY-MM format
  
  if (cacheKey.includes(currentMonth)) {
    // Data bulan ini menggunakan TTL lebih pendek
    return now - lastUpdate > CACHE_TTL_TODAY;
  }
  
  // Data bulan lain menggunakan TTL standar
  return now - lastUpdate > CACHE_TTL_STANDARD;
}

// PERBAIKAN: Fungsi untuk deteksi data baru
function checkForNewDataIndication() {
  try {
    // Cek localStorage untuk indikasi data baru dari input-servis
    const newDataFlag = localStorage.getItem('newServisDataAdded');
    const lastInputTime = localStorage.getItem('lastServisInputTime');
    
    if (newDataFlag === 'true') {
      // Reset flag
      localStorage.removeItem('newServisDataAdded');
      return true;
    }
    
    // Cek berdasarkan timestamp input terakhir
    if (lastInputTime) {
      const inputTime = parseInt(lastInputTime);
      const timeDiff = Date.now() - inputTime;
      
      // Jika input dalam 2 menit terakhir, anggap ada data baru
      if (timeDiff < 2 * 60 * 1000) {
        return true;
      }
    }
    
    return false;
  } catch (error) {
    console.error('Error checking new data indication:', error);
    return false;
  }
}

// PERBAIKAN: Fungsi untuk sync data dengan optimasi
async function syncDataIfNeeded(forceSync = false) {
  try {
    if (!isDataLoaded || !currentMonthYear) return;
    
    const { month, year } = currentMonthYear;
    const cacheKey = `month_${month}_${year}`;
    
    // Check if sync is needed
    const needSync = forceSync || checkForNewDataIndication() || shouldUpdateCache(cacheKey);
    
    if (needSync) {
      console.log('Syncing data due to changes detected');
      
      // Get fresh data from Firestore
      const freshData = await getServisByMonth(month, year);
      
      // Compare with current data to detect changes
      const hasChanges = JSON.stringify(freshData) !== JSON.stringify(currentData);
      
      if (hasChanges) {
        // Update cache and current data
        currentData = freshData;
        setCachedData(cacheKey, currentData);
        saveServisCacheToStorage();
        
        // Re-apply filters
        applyFilters();
        
        console.log('Data synced and updated');
        showAlert('info', 'Data telah diperbarui dari server');
      }
    }
  } catch (error) {
    console.error('Error syncing data:', error);
  }
}



// Save cache to localStorage for persistence
function saveServisCacheToStorage() {
  try {
    const cacheObj = {};
    for (const [key, value] of localCache.entries()) {
      cacheObj[key] = value;
    }
    
    const compressedData = JSON.stringify(cacheObj);
    localStorage.setItem("servisCache", compressedData);
    
    // Save metadata
    const metaObj = {};
    for (const [key, value] of cacheMeta.entries()) {
      metaObj[key] = value;
    }
    localStorage.setItem("servisCacheMeta", JSON.stringify(metaObj));
    
    console.log("Servis cache saved to localStorage");
    return true;
  } catch (error) {
    console.error("Error saving servis cache:", error);
    if (error.name === "QuotaExceededError") {
      cleanOldServisCacheEntries();
    }
    return false;
  }
}

// Load cache from localStorage
function loadServisCacheFromStorage() {
  try {
    const cacheData = localStorage.getItem("servisCache");
    const metaData = localStorage.getItem("servisCacheMeta");
    
    if (cacheData) {
      const cacheObj = JSON.parse(cacheData);
      for (const [key, value] of Object.entries(cacheObj)) {
        localCache.set(key, value);
      }
    }
    
    if (metaData) {
      const metaObj = JSON.parse(metaData);
      for (const [key, value] of Object.entries(metaObj)) {
        cacheMeta.set(key, value);
      }
    }
    
    console.log("Servis cache loaded from localStorage");
  } catch (error) {
    console.error("Error loading servis cache:", error);
  }
}

function cleanOldServisCacheEntries() {
  try {
    const now = Date.now();
    const threeDaysAgo = now - 3 * 24 * 60 * 60 * 1000;
    
    for (const [key, timestamp] of cacheMeta.entries()) {
      if (timestamp < threeDaysAgo) {
        cacheMeta.delete(key);
        localCache.delete(key);
      }
    }
    
    console.log("Old servis cache entries cleaned up");
  } catch (error) {
    console.error("Error cleaning old cache entries:", error);
  }
}

// Update initialization
document.addEventListener('DOMContentLoaded', function() {
  initializePage();
  setupEventListeners();
  
  // Setup data change listeners
  setupDataChangeListeners();
  
  // Load cache from storage
  loadServisCacheFromStorage();
  
  // Setup periodic sync (reduced frequency)
  setInterval(() => syncDataIfNeeded(), 60 * 1000); // Every 1 minute instead of 30 seconds
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
  
  // PERBAIKAN: Listen untuk event data baru dari input-servis
  window.addEventListener('storage', function(e) {
    if (e.key === 'newServisDataAdded' && e.newValue === 'true') {
      console.log('New servis data detected from another tab');
      syncDataIfNeeded();
    }
    
  });
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
    
    // PERBAIKAN: Set current month/year untuk tracking
    currentMonthYear = { month, year };
    
    // Check if cache should be updated
    const shouldUpdate = shouldUpdateCache(cacheKey);
    
    // Check local cache first
    const cachedData = getCachedData(cacheKey);
    
    if (cachedData && !shouldUpdate) {
      console.log(`Using cached data for ${month}/${year}`);
      currentData = cachedData;
      showCacheIndicator(true);
    } else {
      console.log(`Fetching fresh data for ${month}/${year}`);
      currentData = await getServisByMonth(month, year);
      setCachedData(cacheKey, currentData);
      showCacheIndicator(false);
      
      // Save to localStorage
      saveServisCacheToStorage();
    }
    
    // PERBAIKAN: Update tracking data count
    lastKnownDataCount = currentData.length;
    
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
    
    // PERBAIKAN: Handle waktu pengambilan dengan proper error handling
    let waktuPengambilan = '-';
    let waktuForModal = '';
    
    if (item.waktuPengambilan) {
      try {
        let waktuDate;
        
        // Handle berbagai format waktu
        if (item.waktuPengambilan.toDate) {
          // Firestore Timestamp
          waktuDate = item.waktuPengambilan.toDate();
        } else if (item.waktuPengambilan.seconds) {
          // Firestore Timestamp object dengan seconds
          waktuDate = new Date(item.waktuPengambilan.seconds * 1000);
        } else if (typeof item.waktuPengambilan === 'string') {
          // ISO string
          waktuDate = new Date(item.waktuPengambilan);
        } else {
          // Direct Date object
          waktuDate = new Date(item.waktuPengambilan);
        }
        
        // Validasi date
        if (!isNaN(waktuDate.getTime())) {
          waktuPengambilan = waktuDate.toLocaleString('id-ID');
          waktuForModal = waktuDate.toISOString().slice(0, 16); // Format untuk datetime-local input
        }
      } catch (error) {
        console.error('Error formatting waktu pengambilan for item:', item.id, error);
        waktuPengambilan = '-';
        waktuForModal = '';
      }
    }
    
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
        <button class="btn btn-sm btn-primary" onclick="openUpdateModal('${item.id}', '${item.statusServis}', '${item.statusPengambilan}', '${item.stafHandle || ''}', '${waktuForModal}')">
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
    
    // PERBAIKAN: Handle waktu pengambilan dengan proper validation
    if (waktuPengambilan && waktuPengambilan !== '' && waktuPengambilan !== 'undefined') {
      try {
        // Pastikan format datetime-local yang valid
        let formattedWaktu = waktuPengambilan;
        
        // Jika bukan format ISO, convert dulu
        if (!waktuPengambilan.includes('T')) {
          const date = new Date(waktuPengambilan);
          if (!isNaN(date.getTime())) {
            formattedWaktu = date.toISOString().slice(0, 16);
          }
        } else {
          // Pastikan format datetime-local (YYYY-MM-DDTHH:mm)
          formattedWaktu = waktuPengambilan.slice(0, 16);
        }
        
        document.getElementById('waktuPengambilan').value = formattedWaktu;
      } catch (error) {
        console.error('Error setting waktu pengambilan:', error);
        document.getElementById('waktuPengambilan').value = '';
      }
    } else {
      document.getElementById('waktuPengambilan').value = '';
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
    
    let stafHandle = null;
    let waktuPengambilan = null;
    
    // PERBAIKAN: Pastikan data pengambilan disiapkan dengan benar
    if (statusPengambilan === 'Sudah Diambil') {
      stafHandle = document.getElementById('stafHandle').value.trim();
      const waktuInput = document.getElementById('waktuPengambilan').value;
      
      if (!stafHandle) {
        showAlert('warning', 'Nama staf handle harus diisi');
        return;
      }
      
      waktuPengambilan = waktuInput; // Kirim sebagai string ISO
    }
    
    showLoading(true);
    
    // PERBAIKAN: Panggil updateServisStatus dengan parameter lengkap
    await updateServisStatus(servisId, statusServis, statusPengambilan, stafHandle, waktuPengambilan);
    
    // PERBAIKAN: Update local data dengan semua field
    const updateData = {
      statusServis,
      statusPengambilan,
      stafHandle,
      waktuPengambilan: waktuPengambilan ? new Date(waktuPengambilan).toISOString() : null
    };
    
    updateLocalDataAndCache(servisId, updateData);
    
    // Close modal
    const modal = bootstrap.Modal.getInstance(document.getElementById('updateStatusModal'));
    modal.hide();
    
    // Re-apply filters
    applyFilters();
    
    showAlert('success', 'Status berhasil diperbarui dan disimpan');
    showLoading(false);
    
  } catch (error) {
    console.error('Error updating status:', error);
    showAlert('danger', 'Terjadi kesalahan saat memperbarui status: ' + error.message);
    showLoading(false);
  }
}

// PERBAIKAN: Fungsi untuk update local data dan cache secara konsisten
function updateLocalDataAndCache(servisId, updateData) {
  try {
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
    
    // PERBAIKAN: Update cache dengan data terbaru
    if (currentMonthYear) {
      const { month, year } = currentMonthYear;
      const cacheKey = `month_${month}_${year}`;
      setCachedData(cacheKey, currentData);
    }
    
    // PERBAIKAN: Invalidate cache terkait untuk memastikan konsistensi
    invalidateRelatedCache(servisId);
    
    // Save to localStorage
    saveServisCacheToStorage();
    
    // PERBAIKAN: Trigger event untuk notifikasi update
    notifyServisUpdate(servisId, updateData);
    
    console.log(`Local data and cache updated for servis ID: ${servisId}`);
  } catch (error) {
    console.error('Error updating local data and cache:', error);
  }
}

// PERBAIKAN: Fungsi untuk invalidate cache terkait
function invalidateRelatedCache(servisId) {
  try {
    if (!currentMonthYear) return;
    
    const { month, year } = currentMonthYear;
    
    // Hapus cache untuk laporan yang mungkin terpengaruh
    const reportCacheKeys = [
      `report_${month}_${year}`,
      `report_year_${year}`,
      `stats_${month}_${year}`
    ];
    
    // Hapus cache terkait
    reportCacheKeys.forEach(key => {
      if (localCache.has(key)) {
        console.log(`Invalidating related cache: ${key}`);
        clearCacheKey(key);
      }
    });
    
    // PERBAIKAN: Set timestamp untuk memaksa refresh pada query berikutnya
    updateCacheTimestamp(`month_${month}_${year}`, 0);
    
  } catch (error) {
    console.error('Error invalidating related cache:', error);
  }
}

// PERBAIKAN: Fungsi untuk notifikasi update servis
function notifyServisUpdate(servisId, updateData) {
  try {
    // Trigger custom event untuk notifikasi update
    const event = new CustomEvent('servisUpdated', {
      detail: { 
        servisId: servisId, 
        updateData: updateData, 
        timestamp: Date.now() 
      }
    });
    window.dispatchEvent(event);
    
    // Update localStorage timestamp untuk tracking perubahan
    localStorage.setItem('lastServisUpdate', Date.now().toString());
    localStorage.setItem('lastServisUpdateId', servisId);
    
  } catch (error) {
    console.error('Error notifying servis update:', error);
  }
}

async function refreshData() {
  try {
    if (!currentMonthYear) return;
    
    const { month, year } = currentMonthYear;
    const cacheKey = `month_${month}_${year}`;
    
    // PERBAIKAN: Clear specific cache untuk periode ini
    clearCacheKey(cacheKey);
    
    // Clear smart cache juga
    if (typeof smartServisCache !== 'undefined' && smartServisCache.clearKey) {
      smartServisCache.clearKey(cacheKey);
    }
    
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

// PERBAIKAN: Handle filter logic
function handleFilterLogic() {
  const statusServisFilter = document.getElementById('statusServisFilter');
  const statusPengambilanFilter = document.getElementById('statusPengambilanFilter');
  
  if (statusServisFilter && statusPengambilanFilter) {
    // Jika status servis "Belum Selesai", paksa status pengambilan ke "Belum Diambil"
    if (statusServisFilter.value === 'Belum Selesai') {
      statusPengambilanFilter.value = 'Belum Diambil';
      statusPengambilanFilter.disabled = true;
    } else {
      statusPengambilanFilter.disabled = false;
    }
  }
}

// PERBAIKAN: Event listeners untuk sinkronisasi data
window.addEventListener('servisUpdated', function(event) {
  if (event.detail && event.detail.servisId) {
    console.log('Servis updated from another source:', event.detail.servisId);
    
    // Refresh data jika diperlukan
    const lastUpdate = localStorage.getItem('lastServisUpdate');
    const currentTime = Date.now();
    
    // Jika update terjadi dalam 30 detik terakhir, refresh data
    if (lastUpdate && (currentTime - parseInt(lastUpdate)) < 30000) {
      console.log('Refreshing data due to recent update');
      syncDataIfNeeded();
    }
  }
});


// PERBAIKAN: Cleanup saat window/tab ditutup
window.addEventListener('beforeunload', function() {
  // Save cache sebelum halaman ditutup
  saveServisCacheToStorage();
});

// PERBAIKAN: Periodic cache cleanup
setInterval(() => {
  cleanOldServisCacheEntries();
}, 60 * 60 * 1000); // Cleanup setiap 1 jam

// PERBAIKAN: Enhanced data loading dengan preloading
async function loadServisDataEnhanced() {
  try {
    showLoading(true);
    
    const month = parseInt(document.getElementById('monthSelector').value);
    const year = parseInt(document.getElementById('yearSelector').value);
    
    // Set current month/year untuk tracking
    currentMonthYear = { month, year };
    
    // Load data dengan optimasi cache
    currentData = await getServisDataOptimized(month, year);
    
    // Preload data bulan adjacent di background
    preloadAdjacentMonths(month, year);
    
    // Reset search
    const searchInput = document.getElementById('searchInputTable');
    if (searchInput) {
      searchInput.value = '';
    }
    
    // Update tracking data count
    lastKnownDataCount = currentData.length;
    
    // Set flag bahwa data sudah loaded
    isDataLoaded = true;
    
    // Apply filters setelah data loaded
    applyFilters();
    
    // Show cache indicator
    const cacheKey = `month_${month}_${year}`;
    const isFromCache = localCache.has(cacheKey) && !shouldUpdateCache(cacheKey);
    showCacheIndicator(isFromCache);
    
    showLoading(false);
    
  } catch (error) {
    console.error('Error loading enhanced servis data:', error);
    showAlert('danger', 'Terjadi kesalahan saat memuat data: ' + error.message);
    showLoading(false);
    isDataLoaded = false;
  }
}

// PERBAIKAN: Optimized data fetching
async function getServisDataOptimized(month, year, forceRefresh = false) {
  try {
    const cacheKey = `month_${month}_${year}`;
    
    // Cek apakah perlu refresh berdasarkan TTL atau forceRefresh
    const needRefresh = forceRefresh || shouldUpdateCache(cacheKey);
    
    // Jika tidak perlu refresh dan data ada di cache, gunakan cache
    if (!needRefresh && localCache.has(cacheKey)) {
      console.log(`Using optimized cache for ${month}/${year}`);
      const cached = localCache.get(cacheKey);
      return cached.data;
    }
    
    // Fetch data dari Firestore
    console.log(`Fetching optimized data for ${month}/${year}`);
    const data = await getServisByMonth(month, year);
    
    // Update cache
    setCachedData(cacheKey, data);
    
    // Save to localStorage
    saveServisCacheToStorage();
    
    return data;
  } catch (error) {
    console.error('Error getting optimized servis data:', error);
    throw error;
  }
}

// PERBAIKAN: Preload adjacent months data
async function preloadAdjacentMonths(currentMonth, currentYear) {
  try {
    const adjacentMonths = [];
    
    // Bulan sebelumnya
    let prevMonth = currentMonth - 1;
    let prevYear = currentYear;
    if (prevMonth < 1) {
      prevMonth = 12;
      prevYear--;
    }
    adjacentMonths.push({ month: prevMonth, year: prevYear });
    
    // Bulan selanjutnya
    let nextMonth = currentMonth + 1;
    let nextYear = currentYear;
    if (nextMonth > 12) {
      nextMonth = 1;
      nextYear++;
    }
    adjacentMonths.push({ month: nextMonth, year: nextYear });
    
    // Preload data di background
    adjacentMonths.forEach(async ({ month, year }) => {
      const cacheKey = `month_${month}_${year}`;
      if (!localCache.has(cacheKey)) {
        try {
          console.log(`Preloading data for ${month}/${year}`);
          const data = await getServisByMonth(month, year);
          setCachedData(cacheKey, data);
        } catch (error) {
          console.log(`Failed to preload data for ${month}/${year}:`, error.message);
        }
      }
    });
  } catch (error) {
    console.error('Error preloading adjacent months:', error);
  }
}

// PERBAIKAN: Monitor untuk data baru dari input-servis
function setupNewDataMonitoring() {
  // Listen untuk perubahan di localStorage yang menandakan data baru
  window.addEventListener('storage', function(e) {
    if (e.key === 'newServisDataAdded' && e.newValue === 'true') {
      console.log('New servis data detected from input-servis');
      
      // Reset flag
      localStorage.removeItem('newServisDataAdded');
      
      // Sync data jika sedang menampilkan data
      if (isDataLoaded && currentMonthYear) {
        syncDataIfNeeded();
      }
    }
    
    if (e.key === 'lastServisInputTime') {
      console.log('New servis input detected');
      
      // Sync data dengan delay untuk memastikan data sudah tersimpan
      setTimeout(() => {
        if (isDataLoaded && currentMonthYear) {
          syncDataIfNeeded();
        }
      }, 2000); // Delay 2 detik
    }
  });
  
  // Periodic check untuk data baru (fallback)
  setInterval(() => {
    if (isDataLoaded && currentMonthYear) {
      const lastInputTime = localStorage.getItem('lastServisInputTime');
      if (lastInputTime) {
        const inputTime = parseInt(lastInputTime);
        const timeDiff = Date.now() - inputTime;
        
        // Jika ada input dalam 1 menit terakhir dan belum di-sync
        if (timeDiff < 60 * 1000 && timeDiff > lastDataCheck) {
          console.log('Periodic sync triggered by recent input');
          syncDataIfNeeded();
          lastDataCheck = Date.now();
        }
      }
    }
  }, 30 * 1000); // Check setiap 30 detik
}


// PERBAIKAN: Debug functions untuk development
if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
  window.debugServisCache = function() {
    console.group('Servis Cache Debug Information');
    console.log('Local Cache Size:', localCache.size);
    console.log('Cache Meta Size:', cacheMeta.size);
    console.log('Cache Keys:', Array.from(localCache.keys()));
    console.log('Current Data Count:', currentData.length);
    console.log('Last Known Data Count:', lastKnownDataCount);
    console.log('Current Month/Year:', currentMonthYear);
    console.log('Is Data Loaded:', isDataLoaded);
    console.groupEnd();
  };
  
  window.forceDataSync = function() {
    console.log('Forcing data sync...');
    syncDataIfNeeded();
  };
  
  window.clearAllServisCache = function() {
    localCache.clear();
    cacheMeta.clear();
    localStorage.removeItem('servisCache');
    localStorage.removeItem('servisCacheMeta');
    console.log('All servis cache cleared');
  };
}

// Export functions yang mungkin diperlukan
export { 
  loadServisDataEnhanced as loadServisData,
  syncDataIfNeeded,
  getCachedData,
  setCachedData,
  clearCacheKey
};

