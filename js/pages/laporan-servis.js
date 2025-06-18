import { getServisByMonth, clearServisCache } from '../services/servis-service.js';

// Global variables
let currentReportData = [];
let filteredReportData = [];

// Initialize page
document.addEventListener('DOMContentLoaded', function() {
  initializePage();
  setupEventListeners();
});

function initializePage() {
  // Set current date and time
  updateDateTime();
  setInterval(updateDateTime, 1000);
  
  // Initialize month and year selectors
  initializeSelectors();
}

function initializeSelectors() {
  const monthSelector = document.getElementById('monthSelector');
  const yearSelector = document.getElementById('yearSelector');
  
  // Set current month
  const currentDate = new Date();
  const currentMonth = currentDate.getMonth() + 1;
  const currentYear = currentDate.getFullYear();
  
  if (monthSelector) {
    monthSelector.value = currentMonth;
  }
  
  // Populate year selector
  if (yearSelector) {
    for (let year = currentYear - 2; year <= currentYear + 1; year++) {
      const option = document.createElement('option');
      option.value = year;
      option.textContent = year;
      if (year === currentYear) {
        option.selected = true;
      }
      yearSelector.appendChild(option);
    }
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
  // Generate report button
  document.getElementById('generateReportBtn').addEventListener('click', function() {
    generateReport();
  });

  // Filter buttons
  document.getElementById('filterAll').addEventListener('click', function() {
    filterByStatus('all');
  });

  document.getElementById('filterCompleted').addEventListener('click', function() {
    filterByStatus('completed');
  });

  document.getElementById('filterPending').addEventListener('click', function() {
    filterByStatus('pending');
  });

  document.getElementById('filterTaken').addEventListener('click', function() {
    filterByStatus('taken');
  });

  document.getElementById('filterNotTaken').addEventListener('click', function() {
    filterByStatus('not-taken');
  });

  // Export buttons
  document.getElementById('exportExcelBtn').addEventListener('click', function() {
    exportToExcel();
  });

  document.getElementById('exportPdfBtn').addEventListener('click', function() {
    exportToPDF();
  });

  // Refresh data button
  document.getElementById('refreshData').addEventListener('click', function() {
    refreshData();
  });
}

async function generateReport() {
  try {
    const month = parseInt(document.getElementById('monthSelector').value);
    const year = parseInt(document.getElementById('yearSelector').value);
    
    if (!month || !year) {
      showAlert('warning', 'Pilih bulan dan tahun terlebih dahulu');
      return;
    }
    
    showLoading(true);
    
    currentReportData = await getServisByMonth(month, year);
    filteredReportData = [...currentReportData];
    
    displayReport();
    updateSummaryCards();
    showReportElements();
    
    showLoading(false);
    
  } catch (error) {
    console.error('Error generating report:', error);
    showAlert('danger', 'Terjadi kesalahan saat membuat laporan: ' + error.message);
    showLoading(false);
  }
}

function displayReport() {
  const tbody = document.getElementById('servisReportList');
  const tableContainer = document.getElementById('tableContainer');
  const noDataMessage = document.getElementById('noDataMessage');
  
  if (filteredReportData.length === 0) {
    tableContainer.style.display = 'none';
    noDataMessage.style.display = 'block';
    hideActionButtons();
    return;
  }
  
  tableContainer.style.display = 'block';
  noDataMessage.style.display = 'none';
  showActionButtons();
  
  tbody.innerHTML = '';
  
  filteredReportData.forEach((item, index) => {
    const row = document.createElement('tr');
    
    // Format tanggal
    const tanggalFormatted = new Date(item.tanggal).toLocaleDateString('id-ID');
    
    // Status badges
    const statusServisBadge = item.statusServis === 'Sudah Selesai' 
      ? '<span class="badge bg-success">Selesai</span>'
      : '<span class="badge bg-warning">Belum Selesai</span>';
      
    const statusPengambilanBadge = item.statusPengambilan === 'Sudah Diambil'
      ? '<span class="badge bg-success">Diambil</span>'
      : '<span class="badge bg-danger">Belum Diambil</span>';
    
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
    `;
    
    tbody.appendChild(row);
  });
}

function updateSummaryCards() {
  const totalServis = filteredReportData.length;
  const completedServis = filteredReportData.filter(item => item.statusServis === 'Sudah Selesai').length;
  const pendingServis = filteredReportData.filter(item => item.statusServis === 'Belum Selesai').length;
  const takenServis = filteredReportData.filter(item => item.statusPengambilan === 'Sudah Diambil').length;
  const totalRevenue = filteredReportData.reduce((sum, item) => sum + (item.ongkos || 0), 0);

  // Update summary cards
  document.getElementById('totalServis').textContent = totalServis;
  document.getElementById('completedServis').textContent = completedServis;
  document.getElementById('pendingServis').textContent = pendingServis;
  document.getElementById('takenServis').textContent = takenServis;
  document.getElementById('totalRevenue').textContent = `Rp ${totalRevenue.toLocaleString('id-ID')}`;
}

function filterByStatus(status) {
  // Remove active class from all filter buttons
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  
  // Add active class to clicked button
  document.getElementById(`filter${status.charAt(0).toUpperCase() + status.slice(1)}`).classList.add('active');
  
  // Filter data
  switch (status) {
    case 'all':
      filteredReportData = [...currentReportData];
      break;
    case 'completed':
      filteredReportData = currentReportData.filter(item => item.statusServis === 'Sudah Selesai');
      break;
    case 'pending':
      filteredReportData = currentReportData.filter(item => item.statusServis === 'Belum Selesai');
      break;
    case 'taken':
      filteredReportData = currentReportData.filter(item => item.statusPengambilan === 'Sudah Diambil');
      break;
    case 'not-taken':
      filteredReportData = currentReportData.filter(item => item.statusPengambilan === 'Belum Diambil');
      break;
  }
  
  displayReport();
  updateSummaryCards();
}

function exportToExcel() {
  if (filteredReportData.length === 0) {
    showAlert('warning', 'Tidak ada data untuk diekspor');
    return;
  }

  try {
    // Create workbook
    const wb = XLSX.utils.book_new();
    
    const month = document.getElementById('monthSelector').value;
    const year = document.getElementById('yearSelector').value;
    const monthNames = ['', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 
                       'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

    // Prepare data
    const wsData = [
      ['Laporan Servis Bulanan'],
      [`Periode: ${monthNames[month]} ${year}`],
      [`Dicetak pada: ${new Date().toLocaleDateString('id-ID')}`],
      [],
      ['No', 'Tanggal', 'Nama Customer', 'No HP', 'Nama Barang', 'Jenis Servis', 'Ongkos', 'Sales', 'Status Servis', 'Status Pengambilan']
    ];

    filteredReportData.forEach((item, index) => {
      wsData.push([
        index + 1,
        new Date(item.tanggal).toLocaleDateString('id-ID'),
        item.namaCustomer,
        item.noHp,
        item.namaBarang,
        item.jenisServis,
        item.ongkos,
        item.namaSales,
        item.statusServis,
        item.statusPengambilan
      ]);
    });

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    XLSX.utils.book_append_sheet(wb, ws, 'Laporan Servis');

    // Export file
    const fileName = `Laporan_Servis_${monthNames[month]}_${year}.xlsx`;
    XLSX.writeFile(wb, fileName);

    showAlert('success', 'Data berhasil diekspor ke Excel');
  } catch (error) {
    console.error('Error exporting to Excel:', error);
    showAlert('danger', 'Terjadi kesalahan saat mengekspor data');
  }
}

function exportToPDF() {
  if (filteredReportData.length === 0) {
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
          text: `Periode: ${monthNames[month]} ${year}`,
          style: 'subheader',
          alignment: 'center'
        },
        {
          text: `Dicetak pada: ${new Date().toLocaleDateString('id-ID')}`,
          alignment: 'center',
          margin: [0, 0, 0, 20]
        },
        {
          table: {
            headerRows: 1,
            widths: ['auto', 'auto', '*', 'auto', '*', 'auto', 'auto', 'auto', 'auto', 'auto'],
            body: [
              ['No', 'Tanggal', 'Customer', 'No HP', 'Barang', 'Jenis', 'Ongkos', 'Sales', 'Status Servis', 'Status Ambil'],
              ...filteredReportData.map((item, index) => [
                index + 1,
                new Date(item.tanggal).toLocaleDateString('id-ID'),
                item.namaCustomer,
                item.noHp,
                item.namaBarang,
                item.jenisServis,
                `Rp ${item.ongkos.toLocaleString('id-ID')}`,
                item.namaSales,
                item.statusServis,
                item.statusPengambilan
              ])
            ]
          },
          layout: 'lightHorizontalLines'
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
      pageOrientation: 'landscape',
      pageSize: 'A4'
    };

    const fileName = `Laporan_Servis_${monthNames[month]}_${year}.pdf`;
    pdfMake.createPdf(docDefinition).download(fileName);

    showAlert('success', 'Data berhasil diekspor ke PDF');
  } catch (error) {
    console.error('Error exporting to PDF:', error);
    showAlert('danger', 'Terjadi kesalahan saat mengekspor PDF');
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
    
    // Regenerate report
    await generateReport();
    
    showAlert('info', 'Data berhasil diperbarui dari server');
    
  } catch (error) {
    console.error('Error refreshing data:', error);
    showAlert('danger', 'Terjadi kesalahan saat memperbarui data: ' + error.message);
  }
}

function showReportElements() {
  const summaryCards = document.getElementById('summaryCards');
  const filterContainer = document.getElementById('filterContainer');
  const tableContainer = document.getElementById('tableContainer');
  
  if (summaryCards) summaryCards.style.display = 'flex';
  if (filterContainer) filterContainer.style.display = 'block';
  if (tableContainer) tableContainer.style.display = 'block';
}

function hideReportElements() {
  const summaryCards = document.getElementById('summaryCards');
  const filterContainer = document.getElementById('filterContainer');
  const tableContainer = document.getElementById('tableContainer');
  
  if (summaryCards) summaryCards.style.display = 'none';
  if (filterContainer) filterContainer.style.display = 'none';
  if (tableContainer) tableContainer.style.display = 'none';
}

function showActionButtons() {
  const actionButtons = document.getElementById('actionButtons');
  if (actionButtons) {
    actionButtons.style.display = 'flex';
  }
}

function hideActionButtons() {
  const actionButtons = document.getElementById('actionButtons');
  if (actionButtons) {
    actionButtons.style.display = 'none';
  }
}

function showLoading(show) {
  const generateBtn = document.getElementById('generateReportBtn');
  const refreshBtn = document.getElementById('refreshData');
  
  if (show) {
    document.body.style.cursor = 'wait';
    if (generateBtn) {
      generateBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i> Memproses...';
      generateBtn.disabled = true;
    }
    if (refreshBtn) {
      refreshBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i> Loading...';
      refreshBtn.disabled = true;
    }
  } else {
    document.body.style.cursor = 'default';
    if (generateBtn) {
      generateBtn.innerHTML = '<i class="fas fa-sync-alt me-2"></i> Generate Laporan';
      generateBtn.disabled = false;
    }
    if (refreshBtn) {
      refreshBtn.innerHTML = '<i class="fas fa-sync-alt me-1"></i> Refresh Data';
      refreshBtn.disabled = false;
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

