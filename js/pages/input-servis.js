import { saveServisData, getServisByDate } from '../services/servis-service.js';

// Global variables
let todayData = [];
let servisItems = [];
let editingIndex = -1;

// Initialize page
document.addEventListener('DOMContentLoaded', function() {
  initializePage();
  setupEventListeners();
  loadTodayData();
});

function initializePage() {
  // Set current date and time
  updateDateTime();
  setInterval(updateDateTime, 1000);
  
  // Initialize datepicker
  initializeDatePicker();
  
  // Set default date to today
  const today = new Date();
  const formattedDate = today.toLocaleDateString('id-ID');
  document.getElementById('tanggal').value = formattedDate;
}

function initializeDatePicker() {
  $('#tanggal').datepicker({
    format: 'dd/mm/yyyy',
    language: 'id',
    autoclose: true,
    todayHighlight: true,
    orientation: 'bottom auto'
  });

  // Calendar icon click handler
  document.getElementById('calendarIcon').addEventListener('click', function() {
    $('#tanggal').datepicker('show');
  });
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
  // Tambah servis button
  document.getElementById('btnTambahServis').addEventListener('click', function() {
    openServisModal();
  });

  // Simpan servis button in modal
  document.getElementById('btnSimpanServis').addEventListener('click', function() {
    saveServisItem();
  });

  // Simpan data button
  document.getElementById('btnSimpanData').addEventListener('click', function() {
    saveAllServisData();
  });

  // Batal button
  document.getElementById('btnBatal').addEventListener('click', function() {
    resetForm();
  });

  // Export PDF button
  document.getElementById('exportPdfBtn').addEventListener('click', function() {
    exportToPDF();
  });

  // Print button
  document.getElementById('printBtn').addEventListener('click', function() {
    printReport();
  });

  // Modal hidden event
  document.getElementById('modalInputServis').addEventListener('hidden.bs.modal', function() {
    resetModalForm();
  });
}

function openServisModal(index = -1) {
  editingIndex = index;
  
  if (index >= 0) {
    // Edit mode
    const item = servisItems[index];
    document.getElementById('modalInputServisLabel').textContent = 'Edit Data Servis';
    document.getElementById('namaCustomer').value = item.namaCustomer;
    document.getElementById('noHp').value = item.noHp;
    document.getElementById('namaBarang').value = item.namaBarang;
    document.getElementById('jenisServis').value = item.jenisServis;
    document.getElementById('ongkos').value = item.ongkos;
  } else {
    // Add mode
    document.getElementById('modalInputServisLabel').textContent = 'Input Data Servis';
    resetModalForm();
  }
  
  const modal = new bootstrap.Modal(document.getElementById('modalInputServis'));
  modal.show();
}

function resetModalForm() {
  document.getElementById('formInputServis').reset();
  editingIndex = -1;
}

function saveServisItem() {
  const namaCustomer = document.getElementById('namaCustomer').value.trim();
  const noHp = document.getElementById('noHp').value.trim();
  const namaBarang = document.getElementById('namaBarang').value.trim();
  const jenisServis = document.getElementById('jenisServis').value;
  const ongkos = parseInt(document.getElementById('ongkos').value) || 0;

  // Validation
  if (!namaCustomer || !noHp || !namaBarang || !jenisServis || ongkos <= 0) {
    showErrorModal('Validasi Error', 'Semua field harus diisi dengan benar!');
    return;
  }

  const servisItem = {
    namaCustomer,
    noHp,
    namaBarang,
    jenisServis,
    ongkos
  };

  if (editingIndex >= 0) {
    // Update existing item
    servisItems[editingIndex] = servisItem;
  } else {
    // Add new item
    servisItems.push(servisItem);
  }

  updateServisTable();
  
  // Close modal
  const modal = bootstrap.Modal.getInstance(document.getElementById('modalInputServis'));
  modal.hide();
}

function updateServisTable() {
  const tbody = document.querySelector('#tableInputServis tbody');
  tbody.innerHTML = '';

  let totalOngkos = 0;

  servisItems.forEach((item, index) => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${index + 1}</td>
      <td>${item.namaCustomer}</td>
      <td>${item.noHp}</td>
      <td>${item.namaBarang}</td>
      <td>${item.jenisServis}</td>
      <td>Rp ${item.ongkos.toLocaleString('id-ID')}</td>
      <td>
        <button class="btn btn-sm btn-warning me-1" onclick="editServisItem(${index})">
          <i class="fas fa-edit"></i>
        </button>
        <button class="btn btn-sm btn-danger" onclick="deleteServisItem(${index})">
          <i class="fas fa-trash"></i>
        </button>
      </td>
    `;
    tbody.appendChild(row);
    totalOngkos += item.ongkos;
  });

  document.getElementById('total-ongkos').textContent = `Rp ${totalOngkos.toLocaleString('id-ID')}`;
}

// Global functions for button clicks
window.editServisItem = function(index) {
  openServisModal(index);
};

window.deleteServisItem = function(index) {
  if (confirm('Apakah Anda yakin ingin menghapus item ini?')) {
    servisItems.splice(index, 1);
    updateServisTable();
  }
};

async function saveAllServisData() {
  if (servisItems.length === 0) {
    showErrorModal('Validasi Error', 'Tidak ada data servis untuk disimpan!');
    return;
  }

  const tanggal = document.getElementById('tanggal').value;
  const namaSales = document.getElementById('namaSales').value.trim();

  if (!tanggal || !namaSales) {
    showErrorModal('Validasi Error', 'Tanggal dan nama sales harus diisi!');
    return;
  }

  // Convert date format from dd/mm/yyyy to yyyy-mm-dd
  const [day, month, year] = tanggal.split('/');
  const formattedDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;

  try {
    showLoading(true);
    const savedItems = [];
    
    for (const item of servisItems) {
      const servisData = {
        tanggal: formattedDate,
        namaSales,
        ...item
      };
      
      const docId = await saveServisData(servisData);
      savedItems.push({ ...servisData, id: docId });
    }

    showLoading(false);
    
    // Show success modal
    showSuccessModal('Data Berhasil Disimpan', `${savedItems.length} data servis berhasil disimpan.`, savedItems);
    
    // Reset form
    resetForm();
    
    // Reload today's data
    loadTodayData();
    
  } catch (error) {
    console.error('Error saving servis data:', error);
    showLoading(false);
    showErrorModal('Error', 'Terjadi kesalahan saat menyimpan data: ' + error.message);
  }
}

function resetForm() {
  servisItems = [];
  updateServisTable();
  document.getElementById('namaSales').value = '';
  
  // Reset date to today
  const today = new Date();
  const formattedDate = today.toLocaleDateString('id-ID');
  document.getElementById('tanggal').value = formattedDate;
}

async function loadTodayData() {
  try {
    const today = new Date().toISOString().split('T')[0];
    todayData = await getServisByDate(today);
    updateRiwayatTable();
  } catch (error) {
    console.error('Error loading today data:', error);
  }
}

function updateRiwayatTable() {
  const tbody = document.querySelector('#tableRiwayatServis tbody');
  tbody.innerHTML = '';

  if (todayData.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="text-center">Belum ada data servis hari ini</td></tr>';
    return;
  }

  todayData.forEach((item) => {
    const row = document.createElement('tr');
    const tanggalFormatted = new Date(item.tanggal).toLocaleDateString('id-ID');
    
    row.innerHTML = `
      <td>${tanggalFormatted}</td>
      <td>${item.namaCustomer}</td>
      <td>${item.noHp}</td>
      <td>${item.namaBarang}</td>
      <td>${item.jenisServis}</td>
      <td>Rp ${item.ongkos.toLocaleString('id-ID')}</td>
      <td>${item.namaSales}</td>
    `;
    tbody.appendChild(row);
  });
}

function exportToPDF() {
  if (todayData.length === 0) {
    alert('Tidak ada data untuk diekspor');
    return;
  }

  try {
    const docDefinition = {
      content: [
        {
          text: 'Laporan Input Servis Harian',
          style: 'header',
          alignment: 'center'
        },
        {
          text: `Tanggal: ${new Date().toLocaleDateString('id-ID')}`,
          style: 'subheader',
          alignment: 'center',
          margin: [0, 0, 0, 20]
        },
        {
          table: {
            headerRows: 1,
            widths: ['auto', '*', 'auto', '*', 'auto', 'auto', 'auto'],
            body: [
              ['No', 'Nama Customer', 'No HP', 'Nama Barang', 'Jenis Servis', 'Ongkos', 'Sales'],
              ...todayData.map((item, index) => [
                index + 1,
                item.namaCustomer,
                item.noHp,
                item.namaBarang,
                item.jenisServis,
                `Rp ${item.ongkos.toLocaleString('id-ID')}`,
                item.namaSales
              ])
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
      }
    };

    pdfMake.createPdf(docDefinition).download(`Laporan_Servis_${new Date().toISOString().split('T')[0]}.pdf`);
  } catch (error) {
    console.error('Error exporting PDF:', error);
    alert('Terjadi kesalahan saat mengekspor PDF');
  }
}

function printReport() {
  if (todayData.length === 0) {
    alert('Tidak ada data untuk dicetak');
    return;
  }

  const printWindow = window.open('', '_blank');
  const printContent = `
    <html>
      <head>
        <title>Laporan Input Servis</title>
        <style>
          body { font-family: Arial, sans-serif; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #f2f2f2; }
          .header { text-align: center; margin-bottom: 20px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h2>Laporan Input Servis Harian</h2>
          <p>Tanggal: ${new Date().toLocaleDateString('id-ID')}</p>
        </div>
        <table>
          <thead>
            <tr>
              <th>No</th>
              <th>Nama Customer</th>
              <th>No HP</th>
              <th>Nama Barang</th>
              <th>Jenis Servis</th>
              <th>Ongkos</th>
              <th>Sales</th>
            </tr>
          </thead>
          <tbody>
            ${todayData.map((item, index) => `
              <tr>
                <td>${index + 1}</td>
                <td>${item.namaCustomer}</td>
                <td>${item.noHp}</td>
                <td>${item.namaBarang}</td>
                <td>${item.jenisServis}</td>
                <td>Rp ${item.ongkos.toLocaleString('id-ID')}</td>
                <td>${item.namaSales}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </body>
    </html>
  `;
  
  printWindow.document.write(printContent);
  printWindow.document.close();
  printWindow.print();
}

function showLoading(show) {
  // Simple loading implementation
  if (show) {
    document.body.style.cursor = 'wait';
  } else {
    document.body.style.cursor = 'default';
  }
}

function showSuccessModal(title, message, items = []) {
  document.getElementById('successModalTitle').textContent = title;
  
  let content = `<p>${message}</p>`;
  if (items.length > 0) {
    content += '<div class="item-list">';
    items.forEach((item, index) => {
      content += `
        <div class="item">
          <strong>${index + 1}. ${item.namaCustomer}</strong><br>
          Barang: ${item.namaBarang} - ${item.jenisServis}<br>
          Ongkos: Rp ${item.ongkos.toLocaleString('id-ID')}
        </div>
      `;
    });
    content += '</div>';
  }
  
  document.getElementById('successModalContent').innerHTML = content;
  
  const modal = new bootstrap.Modal(document.getElementById('successModal'));
  modal.show();
}

function showErrorModal(title, message) {
  document.getElementById('errorModalTitle').textContent = title;
  document.getElementById('errorModalContent').innerHTML = `<p>${message}</p>`;
  
  const modal = new bootstrap.Modal(document.getElementById('errorModal'));
  modal.show();
}

