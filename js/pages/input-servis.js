import { saveServisData, getServisByDate } from "../services/servis-service.js";

// Global variables
let todayData = [];
let servisItems = [];
let editingIndex = -1;
let verifikasiAction = null;
let verifikasiData = null;
let editingRiwayatId = null;

// Initialize page
document.addEventListener("DOMContentLoaded", function () {
  initializePage();
  setupEventListeners();
});

function initializePage() {
  // Set current date and time
  updateDateTime();
  setInterval(updateDateTime, 1000);

  // Initialize datepicker
  initializeDatePicker();

  // Set default date to today hanya untuk input tanggal
  const today = new Date();
  const formattedDate = today.toLocaleDateString("id-ID");
  document.getElementById("tanggal").value = formattedDate;
  document.getElementById("tanggalRiwayat").value = formattedDate;
}

function initializeDatePicker() {
  $("#tanggal").datepicker({
    format: "dd/mm/yyyy",
    language: "id",
    autoclose: true,
    todayHighlight: true,
    orientation: "bottom auto",
  });

  $("#tanggalRiwayat").datepicker({
    format: "dd/mm/yyyy",
    language: "id",
    autoclose: true,
    todayHighlight: true,
    orientation: "bottom auto",
  });

  // Calendar icon click handlers
  document.getElementById("calendarIcon").addEventListener("click", function () {
    $("#tanggal").datepicker("show");
  });

  document.getElementById("calendarRiwayatIcon").addEventListener("click", function () {
    $("#tanggalRiwayat").datepicker("show");
  });
}

function updateDateTime() {
  const now = new Date();
  const dateElement = document.getElementById("current-date");
  const timeElement = document.getElementById("current-time");

  if (dateElement) {
    dateElement.textContent = now.toLocaleDateString("id-ID", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }

  if (timeElement) {
    timeElement.textContent = now.toLocaleTimeString("id-ID");
  }
}

function setupEventListeners() {
  // Tambah servis button
  document.getElementById("btnTambahServis").addEventListener("click", function () {
    openServisModal();
  });

  // Simpan servis button in modal
  document.getElementById("btnSimpanServis").addEventListener("click", function () {
    saveServisItem();
  });

  // Simpan data button
  document.getElementById("btnSimpanData").addEventListener("click", function () {
    saveAllServisData();
  });

  // Batal button
  document.getElementById("btnBatal").addEventListener("click", function () {
    resetForm();
  });

  // Tampilkan button
  document.getElementById("tampilkanBtn").addEventListener("click", function () {
    loadRiwayatData();
  });

  // Export PDF button
  document.getElementById("exportPdfBtn").addEventListener("click", function () {
    exportToPDF();
  });

  // Print button
  document.getElementById("printBtn").addEventListener("click", function () {
    printReport();
  });

  // Verifikasi button
  document.getElementById("btnVerifikasi").addEventListener("click", function () {
    handleVerifikasi();
  });

  // Modal hidden events
  document.getElementById("modalInputServis").addEventListener("hidden.bs.modal", function () {
    resetModalForm();
  });

  document.getElementById("verifikasiModal").addEventListener("hidden.bs.modal", function () {
    document.getElementById("kodeVerifikasi").value = "";
    verifikasiAction = null;
    verifikasiData = null;
  });

  // Enter key handler untuk modal form
  document.getElementById("formInputServis").addEventListener("keypress", function (e) {
    if (e.key === "Enter") {
      e.preventDefault();
      saveServisItem();
    }
  });

  // Enter key handler untuk form verifikasi
  document.getElementById("formVerifikasi").addEventListener("submit", function (e) {
    e.preventDefault();
    handleVerifikasi();
  });

  document.getElementById("kodeVerifikasi").addEventListener("keypress", function (e) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleVerifikasi();
    }
  });
}

function openServisModal(index = -1) {
  editingIndex = index;

  if (index >= 0) {
    // Edit mode
    const item = servisItems[index];
    document.getElementById("modalInputServisLabel").textContent = "Edit Data Servis";
    document.getElementById("namaSales").value = item.namaSales || "";
    document.getElementById("namaCustomer").value = item.namaCustomer;
    document.getElementById("noHp").value = item.noHp;
    document.getElementById("namaBarang").value = item.namaBarang;
    document.getElementById("jenisServis").value = item.jenisServis;
    document.getElementById("ongkos").value = item.ongkos;
  } else {
    // Add mode
    document.getElementById("modalInputServisLabel").textContent = "Input Data Servis";
    resetModalForm();
  }

  const modal = new bootstrap.Modal(document.getElementById("modalInputServis"));
  modal.show();

  // Auto focus pada nama sales setelah modal terbuka
  document.getElementById("modalInputServis").addEventListener("shown.bs.modal", function () {
    document.getElementById("namaSales").focus();
  }, { once: true });
}

window.editRiwayatItem = function (id, index) {
  verifikasiAction = "edit";
  verifikasiData = { id, index };
  const modal = new bootstrap.Modal(document.getElementById("verifikasiModal"));
  modal.show();

  // Auto focus pada input kode verifikasi setelah modal terbuka
  document.getElementById("verifikasiModal").addEventListener("shown.bs.modal", function () {
    document.getElementById("kodeVerifikasi").focus();
  }, { once: true });
};

window.deleteRiwayatItem = function (id, index) {
  verifikasiAction = "delete";
  verifikasiData = { id, index };
  const modal = new bootstrap.Modal(document.getElementById("verifikasiModal"));
  modal.show();

  // Auto focus pada input kode verifikasi setelah modal terbuka
  document.getElementById("verifikasiModal").addEventListener("shown.bs.modal", function () {
    document.getElementById("kodeVerifikasi").focus();
  }, { once: true });
};

function resetModalForm() {
  document.getElementById("formInputServis").reset();
  editingIndex = -1;
  editingRiwayatId = null; // Reset edit riwayat ID
  document.getElementById("modalInputServisLabel").textContent = "Input Data Servis";
}

async function saveServisItem() {
  const namaSales = document.getElementById("namaSales").value.trim();
  const namaCustomer = document.getElementById("namaCustomer").value.trim();
  const noHp = document.getElementById("noHp").value.trim();
  const namaBarang = document.getElementById("namaBarang").value.trim();
  const jenisServis = document.getElementById("jenisServis").value.trim();
  const ongkos = parseInt(document.getElementById("ongkos").value) || 0;

  // Validation
  if (!namaSales || !namaCustomer || !noHp || !namaBarang || !jenisServis || ongkos <= 0) {
    showErrorModal("Validasi Error", "Semua field harus diisi dengan benar!");
    return;
  }

  const servisItem = {
    namaSales,
    namaCustomer,
    noHp,
    namaBarang,
    jenisServis,
    ongkos,
  };

  // Handle edit riwayat data
  if (editingRiwayatId) {
    try {
      const { updateServisData } = await import("../services/servis-service.js");
      await updateServisData(editingRiwayatId, servisItem);

      // Update todayData langsung
      const itemIndex = todayData.findIndex((item) => item.id === editingRiwayatId);
      if (itemIndex !== -1) {
        todayData[itemIndex] = { ...todayData[itemIndex], ...servisItem };
        updateRiwayatTable();
      }

      alert("Data berhasil diupdate");
      editingRiwayatId = null;
    } catch (error) {
      console.error("Error updating data:", error);
      alert("Terjadi kesalahan saat mengupdate data");
      return;
    }
  }
  // Handle regular servis items
  else if (editingIndex >= 0) {
    servisItems[editingIndex] = servisItem;
  } else {
    servisItems.push(servisItem);
  }

  if (!editingRiwayatId) {
    updateServisTable();
  }

  // Close modal
  const modal = bootstrap.Modal.getInstance(document.getElementById("modalInputServis"));
  modal.hide();
}

function updateServisTable() {
  const tbody = document.querySelector("#tableInputServis tbody");
  tbody.innerHTML = "";

  let totalOngkos = 0;

  servisItems.forEach((item, index) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${index + 1}</td>
      <td>${item.namaCustomer}</td>
      <td>${item.noHp}</td>
      <td>${item.namaBarang}</td>
      <td>${item.jenisServis}</td>
      <td>Rp ${item.ongkos.toLocaleString("id-ID")}</td>
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

  document.getElementById("total-ongkos").textContent = `Rp ${totalOngkos.toLocaleString("id-ID")}`;
}

// Global functions for button clicks
window.editServisItem = function (index) {
  openServisModal(index);
};

window.deleteServisItem = function (index) {
  if (confirm("Apakah Anda yakin ingin menghapus item ini?")) {
    servisItems.splice(index, 1);
    updateServisTable();
  }
};

window.editRiwayatItem = function (id, index) {
  verifikasiAction = "edit";
  verifikasiData = { id, index };
  const modal = new bootstrap.Modal(document.getElementById("verifikasiModal"));
  modal.show();
};

window.deleteRiwayatItem = function (id, index) {
  verifikasiAction = "delete";
  verifikasiData = { id, index };
  const modal = new bootstrap.Modal(document.getElementById("verifikasiModal"));
  modal.show();
};

async function handleVerifikasi() {
  const kode = document.getElementById('kodeVerifikasi').value;
  
  if (kode !== 'smlt116') {
    alert('Kode verifikasi salah!');
        // Tetap focus pada input setelah error
        document.getElementById("kodeVerifikasi").focus();
    return;
  }

  try {
    if (verifikasiAction === "edit") {
      const item = todayData[verifikasiData.index];
      editingRiwayatId = verifikasiData.id; // Set ID untuk edit mode

      // Set data ke form input servis
      document.getElementById("namaSales").value = item.namaSales;
      document.getElementById("namaCustomer").value = item.namaCustomer;
      document.getElementById("noHp").value = item.noHp;
      document.getElementById("namaBarang").value = item.namaBarang;
      document.getElementById("jenisServis").value = item.jenisServis;
      document.getElementById("ongkos").value = item.ongkos;

      // Update modal title
      document.getElementById("modalInputServisLabel").textContent = "Edit Data Riwayat Servis";

      // Close verifikasi modal first
      const verifikasiModal = bootstrap.Modal.getInstance(document.getElementById("verifikasiModal"));
      verifikasiModal.hide();

      // Buka modal edit dengan delay untuk memastikan modal verifikasi tertutup
      setTimeout(() => {
        const modal = new bootstrap.Modal(document.getElementById("modalInputServis"));
        modal.show();

        // Auto focus pada nama sales setelah modal edit terbuka
        document.getElementById("modalInputServis").addEventListener("shown.bs.modal", function () {
          document.getElementById("namaSales").focus();
        }, { once: true });
      }, 300);

      return; // Exit early untuk edit case
    } else if (verifikasiAction === "delete") {
      const { deleteServisData } = await import("../services/servis-service.js");
      await deleteServisData(verifikasiData.id);

      // Update UI langsung tanpa reload
      todayData = todayData.filter((item) => item.id !== verifikasiData.id);
      updateRiwayatTable();

      // Show delete success modal
      showDeleteSuccessModal();
    }
  } catch (error) {
    console.error("Error:", error);
    alert("Terjadi kesalahan: " + error.message);
  }

  const modal = bootstrap.Modal.getInstance(document.getElementById("verifikasiModal"));
  modal.hide();
}

function showDeleteSuccessModal() {
  const modal = new bootstrap.Modal(document.getElementById("deleteSuccessModal"));
  modal.show();
}

async function saveAllServisData() {
  if (servisItems.length === 0) {
    showErrorModal("Validasi Error", "Tidak ada data servis untuk disimpan!");
    return;
  }

  const tanggal = document.getElementById("tanggal").value;

  if (!tanggal) {
    showErrorModal("Validasi Error", "Tanggal harus diisi!");
    return;
  }

  // Convert date format from dd/mm/yyyy to yyyy-mm-dd
  const [day, month, year] = tanggal.split("/");
  const formattedDate = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;

  try {
    showLoading(true);
    const savedItems = [];

    for (const item of servisItems) {
      const servisData = {
        tanggal: formattedDate,
        ...item,
      };

      const docId = await saveServisData(servisData);
      const savedItem = { ...servisData, id: docId };
      savedItems.push(savedItem);
    }

    showLoading(false);
     // Broadcast each new item
     savedItems.forEach(item => {
      const event = {
        action: 'add',
        data: item,
        timestamp: Date.now(),
        source: 'input-servis'
      };
      
      localStorage.setItem('servisDataChange', JSON.stringify(event));
      window.dispatchEvent(new CustomEvent('servisDataChanged', { detail: event }));
    });
    // Show success modal
    showSuccessModal("Data Berhasil Disimpan", `${savedItems.length} data servis berhasil disimpan.`, savedItems);

    // Reset form
    resetForm();
  } catch (error) {
    console.error("Error saving servis data:", error);
    showLoading(false);
    showErrorModal("Error", "Terjadi kesalahan saat menyimpan data: " + error.message);
  }
}

function resetForm() {
  servisItems = [];
  updateServisTable();

  // Reset date to today
  const today = new Date();
  const formattedDate = today.toLocaleDateString("id-ID");
  document.getElementById("tanggal").value = formattedDate;
}

async function loadRiwayatData() {
  const tanggalRiwayat = document.getElementById("tanggalRiwayat").value;

  if (!tanggalRiwayat) {
    alert("Pilih tanggal terlebih dahulu");
    return;
  }

  try {
    // Convert date format from dd/mm/yyyy to yyyy-mm-dd
    const [day, month, year] = tanggalRiwayat.split("/");
    const formattedDate = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;

    todayData = await getServisByDate(formattedDate);
    updateRiwayatTable();

    // Tampilkan tombol export dan print setelah data ditampilkan
    const actionButtons = document.getElementById("actionButtons");
    if (todayData.length > 0) {
      actionButtons.style.display = "block";
    } else {
      actionButtons.style.display = "none";
    }
  } catch (error) {
    console.error("Error loading riwayat data:", error);
    alert("Terjadi kesalahan saat memuat data");
  }
}

function updateRiwayatTable() {
  const tbody = document.querySelector("#tableRiwayatServis tbody");
  tbody.innerHTML = "";

  if (todayData.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" class="text-center">Belum ada data servis pada tanggal ini</td></tr>';
    return;
  }

  todayData.forEach((item, index) => {
    const row = document.createElement("tr");
    const tanggalFormatted = new Date(item.tanggal).toLocaleDateString("id-ID");

    row.innerHTML = `
      <td>${tanggalFormatted}</td>
      <td>${item.namaCustomer}</td>
      <td>${item.noHp}</td>
      <td>${item.namaBarang}</td>
      <td>${item.jenisServis}</td>
      <td>Rp ${item.ongkos.toLocaleString("id-ID")}</td>
      <td>${item.namaSales}</td>
      <td>
        <button class="btn btn-sm btn-warning me-1 m-1" style="font-size: 14px; padding: 2px 5px;" onclick="editRiwayatItem('${
          item.id
        }', ${index})">
          <i class="fas fa-edit"></i>
        </button>
        <button 
          class="btn btn-sm btn-danger m-1" 
          style="font-size: 14px; padding: 2px 5px;"
          onclick="deleteRiwayatItem('${item.id}', ${index})">
          <i class="fas fa-trash"></i>
        </button>
      </td>
    `;
    tbody.appendChild(row);
  });
}

function exportToPDF() {
  if (todayData.length === 0) {
    alert("Tidak ada data untuk diekspor");
    return;
  }

  try {
    const tanggalRiwayat = document.getElementById("tanggalRiwayat").value;
    
    // Hitung total ongkos
    const totalOngkos = todayData.reduce((sum, item) => sum + (item.ongkos || 0), 0);
    
    const docDefinition = {
      pageOrientation: 'landscape', // Ubah ke landscape
      pageMargins: [20, 30, 20, 30],
      content: [
        {
          text: "LAPORAN INPUT SERVIS",
          style: "header",
          alignment: "center",
          margin: [0, 0, 0, 10]
        },
        {
          text: `Tanggal: ${tanggalRiwayat}`,
          style: "subheader",
          alignment: "center",
          margin: [0, 0, 0, 10],
        },
        {
          table: {
            headerRows: 1,
            widths: [30, 80, 70, 170, 170, 80, 70],
            body: [
              [
                { text: 'No', style: 'tableHeader' },
                { text: 'Nama Customer', style: 'tableHeader' },
                { text: 'No HP', style: 'tableHeader' },
                { text: 'Nama Barang', style: 'tableHeader' },
                { text: 'Jenis Servis / Custom', style: 'tableHeader' },
                { text: 'Ongkos / DP', style: 'tableHeader' },
                { text: 'Sales', style: 'tableHeader' }
              ],
              ...todayData.map((item, index) => [
                { text: (index + 1).toString(), style: 'tableCell' },
                { text: item.namaCustomer || '', style: 'tableCell' },
                { text: item.noHp || '', style: 'tableCell' },
                { text: item.namaBarang || '', style: 'tableCell' },
                { text: item.jenisServis || '', style: 'tableCell' },
                { text: `Rp ${(item.ongkos || 0).toLocaleString("id-ID")}`, style: 'tableCellRight' },
                { text: item.namaSales || '', style: 'tableCell' }
              ]),
              // Baris total
              [
                { text: '', style: 'tableCell' },
                { text: '', style: 'tableCell' },
                { text: '', style: 'tableCell' },
                { text: '', style: 'tableCell' },
                { text: 'TOTAL:', style: 'tableCellBold', alignment: 'right' },
                { text: `Rp ${totalOngkos.toLocaleString("id-ID")}`, style: 'tableCellBoldRight' },
                { text: '', style: 'tableCell' }
              ]
            ],
          },
          layout: {
            hLineWidth: function (i, node) {
              return (i === 0 || i === node.table.body.length) ? 2 : 1;
            },
            vLineWidth: function (i, node) {
              return (i === 0 || i === node.table.widths.length) ? 2 : 1;
            },
            hLineColor: function (i, node) {
              return (i === 0 || i === node.table.body.length) ? '#666666' : '#cccccc';
            },
            vLineColor: function (i, node) {
              return (i === 0 || i === node.table.widths.length) ? '#666666' : '#cccccc';
            },
            paddingLeft: function(i, node) { return 8; },
            paddingRight: function(i, node) { return 8; },
            paddingTop: function(i, node) { return 6; },
            paddingBottom: function(i, node) { return 6; }
          }
        },
      ],
      styles: {
        header: {
          fontSize: 16,
          bold: true,
          color: '#2c3e50'
        },
        subheader: {
          fontSize: 12,
          bold: true,
          color: '#34495e'
        },
        tableHeader: {
          bold: true,
          fontSize: 10,
          color: 'white',
          fillColor: '#3498db',
          alignment: 'center'
        },
        tableCell: {
          fontSize: 9,
          margin: [0, 1, 0, 1]
        },
        tableCellRight: {
          fontSize: 9,
          alignment: 'right',
          margin: [0, 1, 0, 1]
        },
        tableCellBold: {
          fontSize: 10,
          bold: true,
          fillColor: '#ecf0f1',
          margin: [0, 1, 0, 1]
        },
        tableCellBoldRight: {
          fontSize: 10,
          bold: true,
          alignment: 'right',
          fillColor: '#ecf0f1',
          margin: [0, 1, 0, 1]
        },
      }
    };

    pdfMake.createPdf(docDefinition).download(`Laporan_Servis_${tanggalRiwayat.replace(/\//g, "-")}.pdf`);
  } catch (error) {
    console.error("Error exporting PDF:", error);
    alert("Terjadi kesalahan saat mengekspor PDF");
  }
}

function printReport() {
  if (todayData.length === 0) {
    alert("Tidak ada data untuk dicetak");
    return;
  }

  const tanggalRiwayat = document.getElementById("tanggalRiwayat").value;
  const printWindow = window.open("", "_blank");

  // Generate boxes dengan ukuran 2.5cm x 2.5cm
  let boxesContent = "";
  todayData.forEach((item, index) => {
    boxesContent += `
      <div class="service-box">
        <div class="customer-name">${item.namaCustomer}</div>
        <div class="nama-brg">${item.namaBarang}</div>
        <div class="service-type">${item.jenisServis}</div>
      </div>
    `;
  });

  const printContent = `
    <html>
      <head>
        <title>Label Servis</title>
        <style>
          @page {
            size: A4;
            margin: 1cm;
          }
          body { 
            font-family: Arial, sans-serif; 
            margin: 0;
            padding: 0;
          }
          .header { 
            text-align: center; 
            margin-bottom: 20px; 
          }
          .boxes-container {
            display: flex;
            flex-wrap: wrap;
            justify-content: flex-start;
            gap: 3mm;
          }
          .service-box {
            width: 2.5cm;
            height: 2.5cm;
            border: 1px solid #000;
            padding: 2mm;
            box-sizing: border-box;
            display: flex;
            flex-direction: column;
            justify-content: center;
            text-align: center;
            break-inside: avoid;
          }
          .customer-name {
            font-size: 8px;
            font-weight: bold;
            margin-bottom: 2px;
            word-wrap: break-word;
            line-height: 1.1;
          }
          .nama-brg {
            font-size: 7px;
            font-weight: bold;
            margin: 3px;
            word-wrap: break-word;
            line-height: 1.1;
          }
          .service-type {
            font-size: 7px;
            word-wrap: break-word;
            line-height: 1.1;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h3>Label Servis - ${tanggalRiwayat}</h3>
        </div>
        <div class="boxes-container">
          ${boxesContent}
        </div>
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
    document.body.style.cursor = "wait";
  } else {
    document.body.style.cursor = "default";
  }
}

function showSuccessModal(title, message, items = []) {
  document.getElementById("successModalTitle").textContent = title;

  let content = `<p>${message}</p>`;
  if (items.length > 0) {
    content += '<div class="item-list">';
    items.forEach((item, index) => {
      content += `
        <div class="item">
          <strong>${index + 1}. ${item.namaCustomer}</strong><br>
          Barang: ${item.namaBarang} - ${item.jenisServis}<br>
          Ongkos: Rp ${item.ongkos.toLocaleString("id-ID")}
        </div>
      `;
    });
    content += "</div>";
  }

  document.getElementById("successModalContent").innerHTML = content;

  const modal = new bootstrap.Modal(document.getElementById("successModal"));
  modal.show();
}

function showErrorModal(title, message) {
  document.getElementById("errorModalTitle").textContent = title;
  document.getElementById("errorModalContent").innerHTML = `<p>${message}</p>`;

  const modal = new bootstrap.Modal(document.getElementById("errorModal"));
  modal.show();
}
