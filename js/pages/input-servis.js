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

    // Tambahkan datepicker untuk field tanggal edit
  $("#tanggalEdit").datepicker({
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

  document.getElementById("calendarEditIcon").addEventListener("click", function () {
    $("#tanggalEdit").datepicker("show");
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

  // Status pembayaran change handler
  document.getElementById("statusPembayaran").addEventListener("change", function () {
    handleStatusPembayaranChange();
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

function handleStatusPembayaranChange() {
  const statusPembayaran = document.getElementById("statusPembayaran").value;
  const ongkosInput = document.getElementById("ongkos");
  const ongkosLabel = document.getElementById("ongkosLabel");

  if (statusPembayaran === "free") {
    ongkosInput.value = 0;
    ongkosInput.disabled = true;
    ongkosInput.required = false;
    ongkosLabel.textContent = "Ongkos / DP";
  } else if (statusPembayaran === "custom") {
    ongkosInput.disabled = false;
    ongkosInput.required = true;
    ongkosLabel.textContent = "DP (Down Payment)";
  } else {
    ongkosInput.disabled = false;
    ongkosLabel.textContent = "Ongkos / DP";
    if (statusPembayaran === "nominal") {
      ongkosInput.required = true;
    } else if (statusPembayaran === "belum_lunas") {
      ongkosInput.required = false;
    }
  }
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
    document.getElementById("statusPembayaran").value = item.statusPembayaran || "nominal";
    document.getElementById("ongkos").value = item.ongkos;
    
    // Trigger status change untuk set proper state
    handleStatusPembayaranChange();
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

function resetModalForm() {
  document.getElementById("formInputServis").reset();
  document.getElementById("ongkos").disabled = false;
  document.getElementById("ongkos").required = true;
  document.getElementById("ongkosLabel").textContent = "Ongkos / DP";
  editingIndex = -1;
  editingRiwayatId = null;
  document.getElementById("modalInputServisLabel").textContent = "Input Data Servis";
  
  // Sembunyikan field tanggal edit
  document.getElementById("tanggalEditRow").style.display = "none";
}

async function saveServisItem() {
  const namaSales = document.getElementById("namaSales").value.trim();
  const namaCustomer = document.getElementById("namaCustomer").value.trim();
  const noHp = document.getElementById("noHp").value.trim();
  const namaBarang = document.getElementById("namaBarang").value.trim();
  const jenisServis = document.getElementById("jenisServis").value.trim();
  const statusPembayaran = document.getElementById("statusPembayaran").value;
  const ongkos = parseInt(document.getElementById("ongkos").value) || 0;

  // Validation
  if (!namaSales || !namaCustomer || !noHp || !namaBarang || !jenisServis || !statusPembayaran) {
    showErrorModal("Validasi Error", "Semua field harus diisi dengan benar!");
    return;
  }

  // Validasi ongkos berdasarkan status
  if ((statusPembayaran === 'nominal' || statusPembayaran === 'custom') && ongkos <= 0) {
    const labelText = statusPembayaran === 'custom' ? 'DP' : 'Ongkos';
    showErrorModal("Validasi Error", `${labelText} harus diisi untuk status ${statusPembayaran}!`);
    return;
  }

  const servisItem = {
    namaSales,
    namaCustomer,
    noHp,
    namaBarang,
    jenisServis,
    ongkos: statusPembayaran === 'free' ? 0 : ongkos,
    statusPembayaran,
  };

  // Handle edit riwayat data
  if (editingRiwayatId) {
    try {
      // Ambil tanggal dari field edit jika sedang edit riwayat
      const tanggalEdit = document.getElementById("tanggalEdit").value;
      if (tanggalEdit) {
        // Convert date format from dd/mm/yyyy to yyyy-mm-dd
        const [day, month, year] = tanggalEdit.split("/");
        const formattedDate = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
        servisItem.tanggal = formattedDate;
      }

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
    const statusPembayaran = item.statusPembayaran || 'nominal';
    
    // Hitung total untuk status nominal dan custom
    if (statusPembayaran === 'nominal' || statusPembayaran === 'custom') {
      totalOngkos += item.ongkos;
    }

    row.innerHTML = `
      <td>${index + 1}</td>
      <td>${item.namaCustomer}</td>
      <td>${item.noHp}</td>
      <td>${item.namaBarang}</td>
      <td>${item.jenisServis}</td>
      <td>${getOngkosDisplay(item)}</td>
      <td>
        <span class="badge bg-${getStatusBadgeColor(statusPembayaran)}">
          ${getStatusLabel(statusPembayaran)}
        </span>
      </td>
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
  });

  document.getElementById("total-ongkos").textContent = `Rp ${totalOngkos.toLocaleString("id-ID")}`;
}

function getOngkosDisplay(item) {
  const statusPembayaran = item.statusPembayaran || 'nominal';
  
  if (statusPembayaran === 'free') {
    return 'GRATIS';
  } else if (statusPembayaran === 'belum_lunas') {
    return item.ongkos > 0 ? `Rp ${item.ongkos.toLocaleString("id-ID")}` : 'BELUM LUNAS';
  } else if (statusPembayaran === 'custom') {
    return `DP: Rp ${item.ongkos.toLocaleString("id-ID")}`;
  } else {
    return `Rp ${item.ongkos.toLocaleString("id-ID")}`;
  }
}

function getStatusLabel(status) {
  const labels = {
    'nominal': 'LUNAS',
    'free': 'GRATIS',
    'belum_lunas': 'BELUM LUNAS',
    'custom': 'CUSTOM'
  };
  return labels[status] || 'LUNAS';
}

function getStatusBadgeColor(status) {
  const colors = {
    'nominal': 'success',
    'free': 'info',
    'belum_lunas': 'warning',
    'custom': 'secondary'
  };
  return colors[status] || 'success';
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

async function handleVerifikasi() {
  const kode = document.getElementById('kodeVerifikasi').value;
  
  if (kode !== 'smlt116') {
    alert('Kode verifikasi salah!');
    document.getElementById("kodeVerifikasi").focus();
    return;
  }

  try {
    if (verifikasiAction === "edit") {
      const item = todayData[verifikasiData.index];
      editingRiwayatId = verifikasiData.id;

      // Set data ke form input servis
      document.getElementById("namaSales").value = item.namaSales;
      document.getElementById("namaCustomer").value = item.namaCustomer;
      document.getElementById("noHp").value = item.noHp;
      document.getElementById("namaBarang").value = item.namaBarang;
      document.getElementById("jenisServis").value = item.jenisServis;
      document.getElementById("statusPembayaran").value = item.statusPembayaran || 'nominal';
      document.getElementById("ongkos").value = item.ongkos;

      // Tampilkan dan isi field tanggal edit
      document.getElementById("tanggalEditRow").style.display = "block";
      const tanggalFormatted = new Date(item.tanggal).toLocaleDateString("id-ID");
      document.getElementById("tanggalEdit").value = tanggalFormatted;

      handleStatusPembayaranChange();
      document.getElementById("modalInputServisLabel").textContent = "Edit Data Riwayat Servis";

      const verifikasiModal = bootstrap.Modal.getInstance(document.getElementById("verifikasiModal"));
      verifikasiModal.hide();

      setTimeout(() => {
        const modal = new bootstrap.Modal(document.getElementById("modalInputServis"));
        modal.show();

        document.getElementById("modalInputServis").addEventListener("shown.bs.modal", function () {
          document.getElementById("namaSales").focus();
        }, { once: true });
      }, 300);

      return;
    } else if (verifikasiAction === "delete") {
      // Delete logic remains the same
      const { deleteServisData } = await import("../services/servis-service.js");
      await deleteServisData(verifikasiData.id);

      todayData = todayData.filter((item) => item.id !== verifikasiData.id);
      updateRiwayatTable();

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

  let totalOngkos = 0;

  if (todayData.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9" class="text-center">Belum ada data servis pada tanggal ini</td></tr>';
    document.getElementById("total-riwayat-ongkos").textContent = "Rp 0";
    return;
  }

  todayData.forEach((item, index) => {
    const row = document.createElement("tr");
    const tanggalFormatted = new Date(item.tanggal).toLocaleDateString("id-ID");
    const statusPembayaran = item.statusPembayaran || 'nominal';
    
    // Hitung total untuk status nominal dan custom
    if (statusPembayaran === 'nominal' || statusPembayaran === 'custom') {
      totalOngkos += item.ongkos || 0;
    }

    row.innerHTML = `
      <td>${index + 1}</td>
      <td>${tanggalFormatted}</td>
      <td>${item.namaCustomer}</td>
      <td>${item.noHp}</td>
      <td>${item.namaBarang}</td>
      <td>${item.jenisServis}</td>
      <td>
        ${getOngkosDisplay(item)}
        <br>
        <span class="badge bg-${getStatusBadgeColor(statusPembayaran)} mt-1">
          ${getStatusLabel(statusPembayaran)}
        </span>
      </td>
      <td>${item.namaSales}</td>
      <td>
        <button class="btn btn-sm btn-warning me-1 mb-1" style="font-size: 12px; padding: 2px 5px;" onclick="editRiwayatItem('${
          item.id
        }', ${index})" title="Edit">
          <i class="fas fa-edit"></i>
        </button>
        <button 
          class="btn btn-sm btn-danger me-1 mb-1" 
          style="font-size: 12px; padding: 2px 5px;"
          onclick="deleteRiwayatItem('${item.id}', ${index})" title="Hapus">
          <i class="fas fa-trash"></i>
        </button>
        <button 
          class="btn btn-sm btn-info mb-1" 
          style="font-size: 12px; padding: 2px 5px;"
          onclick="printSingleItem('${item.id}', ${index})" title="Print Label">
          <i class="fas fa-print"></i>
        </button>
      </td>
    `;
    tbody.appendChild(row);
  });

  document.getElementById("total-riwayat-ongkos").textContent = `Rp ${totalOngkos.toLocaleString("id-ID")}`;
}

// Create shared function for generating print box HTML
function generatePrintBox(item) {
  const statusPembayaran = item.statusPembayaran || 'nominal';
  let statusText = getStatusLabel(statusPembayaran);

  return `
    <div class="print-service-box">
      <div class="print-customer-name">${item.namaCustomer}</div>
      <div class="print-nama-brg">${item.namaBarang}</div>
      <div class="print-service-type">${item.jenisServis}</div>
      <div class="print-status">${statusText}</div>
    </div>
  `;
}

// Create shared print styles function
function getPrintStyles() {
  return `
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
      .print-service-box {
        width: 2.7cm;
        height: 2.7cm;
        border: 1px solid #000;
        padding: 2mm;
        box-sizing: border-box;
        display: flex;
        flex-direction: column;
        justify-content: center;
        text-align: center;
        break-inside: avoid;
      }
      .print-customer-name {
        font-size: 8px;
        font-weight: bold;
        margin-bottom: 1px;
        word-wrap: break-word;
        line-height: 1.1;
      }
      .print-nama-brg {
        font-size: 8px;
        margin: 1px;
        word-wrap: break-word;
        line-height: 1.1;
        margin-top: 2px;
      }
      .print-service-type {
        font-size: 8px;
        font-weight: bold;
        word-wrap: break-word;
        line-height: 1.1;
        margin-top: 2px;
      }
      .print-status {
        font-size: 7px;
        font-weight: bold;
        margin-top: 2px;
        color: #666;
      }
    </style>
  `;
}

// Completely rewrite printSingleItem to match printReport format
window.printSingleItem = function (id, index) {
  const item = todayData[index];
  if (!item) {
    alert("Data tidak ditemukan");
    return;
  }

  const printWindow = window.open("", "_blank");
  const tanggalFormatted = new Date(item.tanggal).toLocaleDateString("id-ID");

  const printContent = `
    <html>
      <head>
        <title>Label Servis - ${item.namaCustomer}</title>
        ${getPrintStyles()}
      </head>
      <body>
        <div class="boxes-container">
          ${generatePrintBox(item)}
        </div>
      </body>
    </html>
  `;

  printWindow.document.write(printContent);
  printWindow.document.close();
  printWindow.print();
};

function printReport() {
  if (todayData.length === 0) {
    alert("Tidak ada data untuk dicetak");
    return;
  }

  const tanggalRiwayat = document.getElementById("tanggalRiwayat").value;
  const printWindow = window.open("", "_blank");

  // Generate boxes menggunakan shared function
  let boxesContent = "";
  todayData.forEach((item) => {
    boxesContent += generatePrintBox(item);
  });

  const printContent = `
    <html>
      <head>
        <title>Label Servis</title>
        ${getPrintStyles()}
      </head>
      <body>
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

function exportToPDF() {
  if (todayData.length === 0) {
    alert("Tidak ada data untuk diekspor");
    return;
  }

  try {
    const tanggalRiwayat = document.getElementById("tanggalRiwayat").value;
    
    // Hitung total ongkos untuk status nominal dan custom
    const totalOngkos = todayData.reduce((sum, item) => {
      const statusPembayaran = item.statusPembayaran || 'nominal';
      return (statusPembayaran === 'nominal' || statusPembayaran === 'custom') ? sum + (item.ongkos || 0) : sum;
    }, 0);
    
    const docDefinition = {
      pageOrientation: 'landscape',
      pageMargins: [20, 30, 20, 30],
      content: [
        {
          text: "LAPORAN INPUT SERVIS",
          style: "header",
          alignment: "center",
          margin: [0, 0, 0, 8]
        },
        {
          text: `Tanggal: ${tanggalRiwayat}`,
          style: "subheader",
          alignment: "center",
          margin: [0, 0, 0, 8],
        },
        {
          table: {
            headerRows: 1,
            widths: [20, 80, 70, 170, 200, 80, 60, 60],
            body: [
              [
                { text: 'No', style: 'tableHeader' },
                { text: 'Nama Customer', style: 'tableHeader' },
                { text: 'No HP', style: 'tableHeader' },
                { text: 'Nama Barang', style: 'tableHeader' },
                { text: 'Jenis Servis / Custom', style: 'tableHeader' },
                { text: 'Ongkos / DP', style: 'tableHeader' },
                { text: 'Status', style: 'tableHeader' },
                { text: 'Sales', style: 'tableHeader' }
              ],
              ...todayData.map((item, index) => {
                const statusPembayaran = item.statusPembayaran || 'nominal';
                let ongkosText = '';
                
                if (statusPembayaran === 'free') {
                  ongkosText = 'GRATIS';
                } else if (statusPembayaran === 'belum_lunas') {
                  ongkosText = item.ongkos > 0 ? `Rp ${(item.ongkos || 0).toLocaleString("id-ID")}` : 'BELUM LUNAS';
                } else if (statusPembayaran === 'custom') {
                  ongkosText = `DP: Rp ${(item.ongkos || 0).toLocaleString("id-ID")}`;
                } else {
                  ongkosText = `Rp ${(item.ongkos || 0).toLocaleString("id-ID")}`;
                }
                
                return [
                  { text: (index + 1).toString(), style: 'tableCell' },
                  { text: item.namaCustomer || '', style: 'tableCell' },
                  { text: item.noHp || '', style: 'tableCell' },
                  { text: item.namaBarang || '', style: 'tableCell' },
                  { text: item.jenisServis || '', style: 'tableCell' },
                  { text: ongkosText, style: 'tableCellRight' },
                  { text: getStatusLabel(statusPembayaran), style: 'tableCell' },
                  { text: item.namaSales || '', style: 'tableCell' }
                ];
              }),
              // Baris total
              [
                { text: '', style: 'tableCell' },
                { text: '', style: 'tableCell' },
                { text: '', style: 'tableCell' },
                { text: '', style: 'tableCell' },
                { text: 'TOTAL NOMINAL:', style: 'tableCellBold', alignment: 'right' },
                { text: `Rp ${totalOngkos.toLocaleString("id-ID")}`, style: 'tableCellBoldRight' },
                { text: '', style: 'tableCell' },
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
            paddingLeft: function(i, node) { return 3; },
            paddingRight: function(i, node) { return 3; },
            paddingTop: function(i, node) { return 2; },
            paddingBottom: function(i, node) { return 1; }
          }
        },
        // Tambahkan keterangan di bawah tabel
        {
          text: "Keterangan: Total Nominal mencakup status LUNAS dan CUSTOM",
          style: "footnote",
          alignment: "left",
          margin: [0, 7, 0, 0]
        }
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
          fontSize: 8,
          margin: [0, 1, 0, 1]
        },
        tableCellRight: {
          fontSize: 8,
          alignment: 'right',
          margin: [0, 1, 0, 1]
        },
        tableCellBold: {
          fontSize: 8,
          bold: true,
          fillColor: '#ecf0f1',
          margin: [0, 1, 0, 1]
        },
        tableCellBoldRight: {
          fontSize: 8,
          bold: true,
          alignment: 'right',
          fillColor: '#ecf0f1',
          margin: [0, 1, 0, 1]
        },
        footnote: {
          fontSize: 8,
          italics: true,
          color: '#666666'
        }
      }
    };

    pdfMake.createPdf(docDefinition).download(`Laporan_Servis_${tanggalRiwayat.replace(/\//g, "-")}.pdf`);
  } catch (error) {
    console.error("Error exporting PDF:", error);
    alert("Terjadi kesalahan saat mengekspor PDF");
  }
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
      const statusPembayaran = item.statusPembayaran || 'nominal';
      let ongkosText = getOngkosDisplay(item);
      
      content += `
        <div class="item">
          <strong>${index + 1}. ${item.namaCustomer}</strong><br>
          Barang: ${item.namaBarang} - ${item.jenisServis}<br>
          Ongkos: ${ongkosText}
          <span class="badge bg-${getStatusBadgeColor(statusPembayaran)} ms-2">
            ${getStatusLabel(statusPembayaran)}
          </span>
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


