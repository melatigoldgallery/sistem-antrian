import { getServisByMonth, deleteMultipleServisData } from '../services/servis-service.js';

// Global variables
let currentServisData = [];
let filteredServisData = [];
let isReportDataLoaded = false;
const test = "smlt116";

// Smart cache system
const smartCache = {
  data: new Map(),
  timestamps: new Map(),
  CACHE_DURATION: 5 * 60 * 1000, // 5 minutes
  
  get(key) {
    const cached = this.data.get(key);
    const timestamp = this.timestamps.get(key);
    
    if (cached && timestamp && (Date.now() - timestamp < this.CACHE_DURATION)) {
      return cached;
    }
    return null;
  },
  
  set(key, value) {
    this.data.set(key, value);
    this.timestamps.set(key, Date.now());
  },
  
  updateSpecific(key, updatedItems) {
    const cached = this.data.get(key);
    if (cached) {
      // Update only changed items
      const updatedCache = cached.map(item => {
        const updated = updatedItems.find(u => u.id === item.id);
        return updated || item;
      });
      this.set(key, updatedCache);
    }
  },
  
  removeItems(key, itemIds) {
    const cached = this.data.get(key);
    if (cached) {
      const filteredCache = cached.filter(item => !itemIds.includes(item.id));
      this.set(key, filteredCache);
    }
  },
  
  clear() {
    this.data.clear();
    this.timestamps.clear();
  }
};

// Initialize page
document.addEventListener('DOMContentLoaded', function() {
  initializePage();
  setupEventListeners();
});

function initializePage() {
  updateDateTime();
  setInterval(updateDateTime, 1000);
  populateYearSelector();
  
  const now = new Date();
  document.getElementById('monthSelector').value = now.getMonth() + 1;
  document.getElementById('yearSelector').value = now.getFullYear();
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

function populateYearSelector() {
  const yearSelector = document.getElementById('yearSelector');
  const currentYear = new Date().getFullYear();
  
  for (let year = currentYear; year >= currentYear - 5; year--) {
    const option = document.createElement('option');
    option.value = year;
    option.textContent = year;
    yearSelector.appendChild(option);
  }
}

function setupEventListeners() {
  // Generate report button
  document.getElementById("generateReportBtn")?.addEventListener("click", () => {
    generateReport();
    isReportDataLoaded = true;
  });

  // Export buttons
  document.getElementById("exportExcelBtn")?.addEventListener("click", exportToExcel);
  document.getElementById("exportPdfBtn")?.addEventListener("click", exportToPDF);

  // Delete data button - PERBAIKAN: langsung ke password verification
  document.getElementById("hapusData")?.addEventListener("click", showPasswordVerification);

  // Verify password button
  document.getElementById("verifyPasswordBtn")?.addEventListener("click", verifyPasswordAndDelete);

  // Enter key pada password input
  document.getElementById("verifyPassword")?.addEventListener("keypress", function(e) {
    if (e.key === 'Enter') {
      verifyPasswordAndDelete();
    }
  });

  // Reset password input saat modal ditutup
  document.getElementById("passwordVerifyModal")?.addEventListener("hidden.bs.modal", function() {
    document.getElementById("verifyPassword").value = "";
    document.getElementById("verifyPassword").classList.remove("is-invalid");
    document.getElementById("passwordError").textContent = "";
  });

  // Status filters
  const statusServisFilter = document.getElementById('statusServisFilter');
  const statusPengambilanFilter = document.getElementById('statusPengambilanFilter');

  if (statusServisFilter) {
    statusServisFilter.addEventListener('change', function() {
      if (isReportDataLoaded) {
        applyFilters();
      }
    });
  }

  if (statusPengambilanFilter) {
    statusPengambilanFilter.addEventListener('change', function() {
      if (isReportDataLoaded) {
        applyFilters();
      }
    });
  }

  // Month/Year selectors
  const monthSelector = document.getElementById("monthSelector");
  const yearSelector = document.getElementById("yearSelector");

  if (monthSelector) {
    monthSelector.addEventListener("change", function () {
      isReportDataLoaded = false;
    });
  }

  if (yearSelector) {
    yearSelector.addEventListener("change", function () {
      isReportDataLoaded = false;
    });
  }
}

function showPasswordVerification() {
  if (filteredServisData.length === 0) {
    showAlert('warning', 'Tidak ada data untuk dihapus');
    return;
  }
  
  // Set jumlah data yang akan dihapus
  document.getElementById('deleteCount').textContent = filteredServisData.length;
  
  // Tampilkan modal password
  const passwordModal = new bootstrap.Modal(document.getElementById('passwordVerifyModal'));
  passwordModal.show();
  
  // Focus ke input password
  setTimeout(() => {
    document.getElementById('verifyPassword').focus();
  }, 500);
}

function verifyPasswordAndDelete() {
  const passwordInput = document.getElementById('verifyPassword');
  const password = passwordInput.value;
  const errorDiv = document.getElementById('passwordError');
  
  if (password === test) {
    // Password benar, tutup modal dan hapus data
    const passwordModal = bootstrap.Modal.getInstance(document.getElementById('passwordVerifyModal'));
    passwordModal.hide();
    
    // Langsung hapus data
    deleteDisplayedData();
  } else {
    // Password salah
    passwordInput.classList.add('is-invalid');
    errorDiv.textContent = 'Password salah!';
    passwordInput.focus();
  }
}


async function generateReport() {
  try {
    const month = parseInt(document.getElementById('monthSelector').value);
    const year = parseInt(document.getElementById('yearSelector').value);
    const cacheKey = `servis_${month}_${year}`;
    
    showLoadingState(true);
    
    // Check smart cache first
    const cachedData = smartCache.get(cacheKey);
    if (cachedData) {
      console.log(`Using cached data for ${month}/${year}`);
      currentServisData = cachedData;
      showCacheIndicator(true);
    } else {
      console.log(`Fetching fresh data for ${month}/${year}`);
      currentServisData = await getServisByMonth(month, year);
      smartCache.set(cacheKey, currentServisData);
      showCacheIndicator(false);
    }
    
    applyFilters();
    showLoadingState(false);
    
  } catch (error) {
    console.error('Error generating report:', error);
    showAlert('danger', 'Terjadi kesalahan saat memuat data: ' + error.message);
    showLoadingState(false);
  }
}

function applyFilters() {
  const statusServis = document.getElementById('statusServisFilter').value;
  const statusPengambilan = document.getElementById('statusPengambilanFilter').value;
  
  filteredServisData = currentServisData.filter(item => {
    const matchesStatusServis = !statusServis || item.statusServis === statusServis;
    const matchesStatusPengambilan = !statusPengambilan || item.statusPengambilan === statusPengambilan;
    return matchesStatusServis && matchesStatusPengambilan;
  });
  
  updateUI();
}

function updateUI() {
  updateSummaryCards();
  populateServisTable();
  
  if (filteredServisData.length > 0) {
    showReportElements();
  } else {
    hideReportElements();
    document.getElementById('noDataMessage').style.display = 'block';
  }
}

function updateSummaryCards() {
  document.getElementById('totalServis').textContent = filteredServisData.length;
  
  const completedCount = filteredServisData.filter(item => 
    item.statusServis === 'Sudah Selesai').length;
  document.getElementById('completedServis').textContent = completedCount;
  
  const pendingCount = filteredServisData.filter(item => 
    item.statusServis === 'Belum Selesai').length;
  document.getElementById('pendingServis').textContent = pendingCount;
  
  const takenCount = filteredServisData.filter(item => 
    item.statusPengambilan === 'Sudah Diambil').length;
  document.getElementById('takenServis').textContent = takenCount;
  
  const totalRevenue = filteredServisData.reduce((sum, item) => sum + (item.ongkos || 0), 0);
  document.getElementById('totalRevenue').textContent = `Rp ${totalRevenue.toLocaleString('id-ID')}`;
}

function populateServisTable() {
  const tableBody = document.getElementById('servisReportList');
  tableBody.innerHTML = '';
  
  if (filteredServisData.length === 0) {
    return;
  }
  
  const fragment = document.createDocumentFragment();
  
  filteredServisData.forEach((item, index) => {
    const row = document.createElement('tr');
    const tanggalFormatted = new Date(item.tanggal).toLocaleDateString('id-ID');
    
    const statusServisBadge = item.statusServis === 'Sudah Selesai' 
      ? '<span class="badge bg-success">Sudah Selesai</span>'
      : '<span class="badge bg-warning">Belum Selesai</span>';
      
    const statusPengambilanBadge = item.statusPengambilan === 'Sudah Diambil'
      ? '<span class="badge bg-success">Sudah Diambil</span>'
      : '<span class="badge bg-danger">Belum Diambil</span>';
    
    // TAMBAHAN: Handle waktu pengambilan dengan proper formatting
    let waktuPengambilan = '-';
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
        } else {
          // ISO string atau Date object
          waktuDate = new Date(item.waktuPengambilan);
        }
        
        // Validasi date
        if (!isNaN(waktuDate.getTime())) {
          waktuPengambilan = waktuDate.toLocaleString('id-ID');
        }
      } catch (error) {
        console.error('Error formatting waktu pengambilan:', error);
        waktuPengambilan = '-';
      }
    }
    
    row.innerHTML = `
      <td>${index + 1}</td>
      <td>${tanggalFormatted}</td>
      <td>${item.namaCustomer}</td>
      <td>${item.noHp}</td>
      <td>${item.namaBarang}</td>
      <td>${item.jenisServis}</td>
      <td>Rp ${item.ongkos.toLocaleString('id-ID')}</td>
      <td>${item.namaSales}</td>
      <td>${statusServisBadge}</td>
      <td>${statusPengambilanBadge}</td>
      <td>${item.stafHandle || '-'}</td>
      <td><small>${waktuPengambilan}</small></td>
    `;
    
    fragment.appendChild(row);
  });
  
  tableBody.appendChild(fragment);
}

async function deleteDisplayedData() {
  const confirmBtn = document.getElementById('verifyPasswordBtn');
  const originalText = confirmBtn.innerHTML;
  
  try {
    confirmBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i> Menghapus...';
    confirmBtn.disabled = true;
    
    const idsToDelete = filteredServisData.map(item => item.id);
    
    // Delete from Firestore
    await deleteMultipleServisData(idsToDelete);
    
    // Update smart cache efficiently
    const month = parseInt(document.getElementById('monthSelector').value);
    const year = parseInt(document.getElementById('yearSelector').value);
    const cacheKey = `servis_${month}_${year}`;
    smartCache.removeItems(cacheKey, idsToDelete);
    
    // Update current data
    currentServisData = currentServisData.filter(item => !idsToDelete.includes(item.id));
    
    // Update UI immediately
    applyFilters();
    
    showAlert('success', `Berhasil menghapus ${idsToDelete.length} data servis`);
    
  } catch (error) {
    console.error('Error deleting data:', error);
    showAlert('danger', 'Terjadi kesalahan saat menghapus data: ' + error.message);
  } finally {
    confirmBtn.innerHTML = originalText;
    confirmBtn.disabled = false;
  }
}

function showLoadingState(show) {
  const btn = document.getElementById('generateReportBtn');
  if (show) {
    btn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i> Memuat...';
    btn.disabled = true;
  } else {
    btn.innerHTML = '<i class="fas fa-sync-alt me-2"></i> Tampilkan';
    btn.disabled = false;
  }
}

function showCacheIndicator(isCache) {
  const indicator = document.getElementById('cacheIndicator');
  if (indicator) {
    indicator.style.display = isCache ? 'inline-block' : 'none';
  }
}

function showReportElements() {
  document.getElementById('tableContainer').style.display = 'block';
  document.getElementById('summaryCards').style.display = 'flex';
  document.getElementById('actionButtons').style.display = 'flex';
  document.getElementById('noDataMessage').style.display = 'none';
}

function hideReportElements() {
  document.getElementById('tableContainer').style.display = 'none';
  document.getElementById('summaryCards').style.display = 'none';
  document.getElementById('actionButtons').style.display = 'none';
}

function showAlert(type, message, autoHide = true) {
  const alertContainer = document.getElementById('alertContainer');
  if (!alertContainer) return;
  
  alertContainer.innerHTML = `
    <div class="alert alert-${type} alert-dismissible fade show">
      <i class="fas fa-${getAlertIcon(type)} me-2"></i>
      ${message}
      <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    </div>
  `;
  
  alertContainer.style.display = 'block';
  
  if (autoHide) {
    setTimeout(() => {
      const alert = alertContainer.querySelector('.alert');
      if (alert) {
        const bsAlert = new bootstrap.Alert(alert);
        bsAlert.close();
      }
    }, 5000);
  }
}

function getAlertIcon(type) {
  const icons = {
    success: 'check-circle',
    danger: 'exclamation-circle',
    warning: 'exclamation-triangle',
    info: 'info-circle'
  };
  return icons[type] || 'info-circle';
}

function exportToExcel() {
  if (filteredServisData.length === 0) {
    showAlert('warning', 'Tidak ada data untuk diekspor');
    return;
  }

  try {
    const month = document.getElementById('monthSelector').value;
    const year = document.getElementById('yearSelector').value;
    const monthNames = ['', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 
                       'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    
    const worksheetData = [
      [`Laporan Servis - ${monthNames[month]} ${year}`],
      [],
      ['No', 'Tanggal', 'Nama Customer', 'No HP', 'Nama Barang', 'Jenis Servis', 'Ongkos', 'Sales', 'Status Servis', 'Status Pengambilan', 'Handle Pengambilan', 'Waktu Pengambilan'],
      ...filteredServisData.map((item, index) => {
        // TAMBAHAN: Format waktu pengambilan untuk Excel
        let waktuPengambilan = '-';
        if (item.waktuPengambilan) {
          try {
            let waktuDate;
            if (item.waktuPengambilan.toDate) {
              waktuDate = item.waktuPengambilan.toDate();
            } else if (item.waktuPengambilan.seconds) {
              waktuDate = new Date(item.waktuPengambilan.seconds * 1000);
            } else {
              waktuDate = new Date(item.waktuPengambilan);
            }
            
            if (!isNaN(waktuDate.getTime())) {
              waktuPengambilan = waktuDate.toLocaleString('id-ID');
            }
          } catch (error) {
            waktuPengambilan = '-';
          }
        }
        
        return [
          index + 1,
          new Date(item.tanggal).toLocaleDateString('id-ID'),
          item.namaCustomer,
          item.noHp,
          item.namaBarang,
          item.jenisServis,
          item.ongkos,
          item.namaSales,
          item.statusServis,
          item.statusPengambilan,
          item.stafHandle || '-',
          waktuPengambilan
        ];
      })
    ];

    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Laporan Servis');
    
    XLSX.writeFile(workbook, `Laporan_Servis_${monthNames[month]}_${year}.xlsx`);
    
    showAlert('success', 'File Excel berhasil diunduh');
  } catch (error) {
    console.error('Error exporting Excel:', error);
    showAlert('danger', 'Terjadi kesalahan saat mengekspor Excel');
  }
}

function exportToPDF() {
  if (filteredServisData.length === 0) {
    showAlert('warning', 'Tidak ada data untuk diekspor');
    return;
  }

  try {
    const month = document.getElementById('monthSelector').value;
    const year = document.getElementById('yearSelector').value;
    const monthNames = ['', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 
                       'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    
    const docDefinition = {
      content: [
        {
          text: 'Laporan Servis Bulanan',
          style: 'header',
          alignment: 'center'
        },
        {
          text: `${monthNames[month]} ${year}`,
          style: 'subheader',
          alignment: 'center',
          margin: [0, 0, 0, 20]
        },
        {
          table: {
            headerRows: 1,
            widths: ['auto', 'auto', '*', 'auto', '*', 'auto', 'auto', 'auto', 'auto', 'auto', 'auto', 'auto'],
            body: [
              ['No', 'Tanggal', 'Customer', 'HP', 'Barang', 'Servis', 'Ongkos', 'Sales', 'Status Servis', 'Status Ambil', 'Handle', 'Waktu Ambil'],
              ...filteredServisData.map((item, index) => {
                // TAMBAHAN: Format waktu pengambilan untuk PDF
                let waktuPengambilan = '-';
                if (item.waktuPengambilan) {
                  try {
                    let waktuDate;
                    if (item.waktuPengambilan.toDate) {
                      waktuDate = item.waktuPengambilan.toDate();
                    } else if (item.waktuPengambilan.seconds) {
                      waktuDate = new Date(item.waktuPengambilan.seconds * 1000);
                    } else {
                      waktuDate = new Date(item.waktuPengambilan);
                    }
                    
                    if (!isNaN(waktuDate.getTime())) {
                      waktuPengambilan = waktuDate.toLocaleDateString('id-ID') + ' ' + waktuDate.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
                    }
                  } catch (error) {
                    waktuPengambilan = '-';
                  }
                }
                
                return [
                  index + 1,
                  new Date(item.tanggal).toLocaleDateString('id-ID'),
                  item.namaCustomer,
                  item.noHp,
                  item.namaBarang,
                  item.jenisServis,
                  `Rp ${item.ongkos.toLocaleString('id-ID')}`,
                  item.namaSales,
                  item.statusServis,
                  item.statusPengambilan,
                  item.stafHandle || '-',
                  waktuPengambilan
                ];
              })
            ]
          }
        }
      ],
      styles: {
        header: {
          fontSize: 18,
          bold: true
        },
        subheader: {
          fontSize: 14,
          bold: true
        }
      },
      pageOrientation: 'landscape'
    };

    pdfMake.createPdf(docDefinition).download(`Laporan_Servis_${monthNames[month]}_${year}.pdf`);
    
    showAlert('success', 'File PDF berhasil diunduh');
  } catch (error) {
    console.error('Error exporting PDF:', error);
    showAlert('danger', 'Terjadi kesalahan saat mengekspor PDF');
  }
}