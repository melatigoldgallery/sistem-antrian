// Initialize page
document.addEventListener("DOMContentLoaded", () => {
  // Toggle sidebar collapse
  const menuToggle = document.querySelector(".menu-toggle");
  const appContainer = document.querySelector(".app-container");

  if (menuToggle) {
    menuToggle.addEventListener("click", function () {
      appContainer.classList.toggle("sidebar-collapsed");
    });
  }

  // Vanilla JS dropdown toggle
  const dropdownToggles = document.querySelectorAll('.sidebar .nav-link[data-bs-toggle="collapse"]');

  dropdownToggles.forEach((toggle) => {
    toggle.addEventListener("click", function (e) {
      e.preventDefault();

      const targetId = this.getAttribute("data-bs-target") || this.getAttribute("href");
      const target = document.querySelector(targetId);

      // If sidebar is not collapsed, implement accordion behavior
      if (!appContainer.classList.contains("sidebar-collapsed")) {
        // Close all other dropdowns
        dropdownToggles.forEach((otherToggle) => {
          if (otherToggle !== toggle) {
            const otherId = otherToggle.getAttribute("data-bs-target") || otherToggle.getAttribute("href");
            const other = document.querySelector(otherId);

            if (other && other.classList.contains("show")) {
              other.classList.remove("show");
              otherToggle.classList.add("collapsed");
              otherToggle.setAttribute("aria-expanded", "false");
            }
          }
        });
      }

      // Toggle this dropdown
      if (target) {
        if (target.classList.contains("show")) {
          target.classList.remove("show");
          toggle.classList.add("collapsed");
          toggle.setAttribute("aria-expanded", "false");
        } else {
          target.classList.add("show");
          toggle.classList.remove("collapsed");
          toggle.setAttribute("aria-expanded", "true");
        }
      }
    });
  });

  // Set current date and time
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

  updateDateTime();
  setInterval(updateDateTime, 1000);
  
  // Initialize buyback form
  setupBuybackForm();
});
  // Tambahkan event listener untuk tombol print
  const printButton = document.getElementById("printModalButton");
  if (printButton) {
    printButton.addEventListener("click", printModal);
  }

// Setup buyback form
function setupBuybackForm() {
  // Add row button
  document.getElementById("btnTambahPenerimaan").addEventListener("click", addNewRow);
  
  // Form submission
  document.getElementById("penerimaanForm").addEventListener("submit", calculateBuyback);
  
  // Enable the first delete button
  setupDeleteButtons();
}

// Add new row to the table
function addNewRow() {
  const tbody = document.querySelector("#tablePenerimaan tbody");
  const rowCount = tbody.querySelectorAll("tr").length + 1;
  
  const newRow = document.createElement("tr");
  newRow.innerHTML = `
    <td>${rowCount}</td>
    <td>
      <select name="kadar" class="form-select form-select-sm" required>
        <option value="" disabled selected>Pilih</option>
        <option value="8K">8K</option>
        <option value="9K">9K</option>
        <option value="16K">16K</option>
        <option value="17K">17K</option>
        <option value="18K">18K</option>
        <option value="22K">22K</option>
      </select>
    </td>
    <td>
      <select name="asalToko" class="form-select form-select-sm" required>
        <option value="" disabled selected>Pilih</option>
        <option value="Toko Melati">Toko Melati</option>
        <option value="Luar Toko">Luar Toko</option>
      </select>
    </td>
    <td><input type="text" name="namaBarang" class="form-control form-control-sm" placeholder="Nama Barang" required></td>
    <td>
      <select name="kondisiBarang" class="form-select form-select-sm" required>
        <option value="" disabled selected>Pilih</option>
        <option value="1">K1</option>
        <option value="2">K2</option>
        <option value="3">K3</option>
      </select>
    </td>
    <td>
      <input
        name="hargaBeli"
        class="form-control form-control-sm"
        placeholder="Harga beli"
        type="number"
        required
        min="0"
      />
    </td>
    <td>
      <input
        name="hargaHariIni"
        class="form-control form-control-sm"
        placeholder="Harga hari ini"
        type="number"
        required
        min="0"
      />
    </td>
    <td>
      <button type="button" class="btn btn-danger btn-sm hapus-baris">
        <i class="fas fa-trash"></i>
      </button>
    </td>
  `;
  
  tbody.appendChild(newRow);
  setupDeleteButtons();
}

// Setup delete buttons
function setupDeleteButtons() {
  const deleteButtons = document.querySelectorAll(".hapus-baris");
  
  // Enable all delete buttons if there's more than one row
  const rows = document.querySelectorAll("#tablePenerimaan tbody tr");
  if (rows.length > 1) {
    deleteButtons.forEach(btn => {
      btn.disabled = false;
      btn.addEventListener("click", deleteRow);
    });
  } else {
    // Disable the only delete button
    deleteButtons[0].disabled = true;
  }
}

// Delete row
function deleteRow(e) {
  const button = e.currentTarget;
  const row = button.closest("tr");
  row.remove();
  
  // Renumber rows
  const rows = document.querySelectorAll("#tablePenerimaan tbody tr");
  rows.forEach((row, index) => {
    row.cells[0].textContent = index + 1;
  });
  
  // Update delete buttons
  setupDeleteButtons();
}

// Calculate buyback
function calculateBuyback(e) {
  e.preventDefault();
  
  // Get all rows
  const rows = document.querySelectorAll("#tablePenerimaan tbody tr");
  const items = [];
  
  // Validate form
  let isValid = true;
  
  rows.forEach(row => {
    const kadar = row.querySelector("[name='kadar']").value;
    const asalToko = row.querySelector("[name='asalToko']").value;
    const namaBarang = row.querySelector("[name='namaBarang']")?.value || "";
    const kondisiBarang = row.querySelector("[name='kondisiBarang']").value;
    const hargaBeli = parseFloat(row.querySelector("[name='hargaBeli']").value);
    const hargaHariIni = parseFloat(row.querySelector("[name='hargaHariIni']").value);
    
    if (!kadar || !asalToko || !kondisiBarang || isNaN(hargaBeli) || isNaN(hargaHariIni)) {
      isValid = false;
      return;
    }
    
    items.push({
      kadar,
      asalToko,
      namaBarang,
      kondisiBarang,
      hargaBeli,
      hargaHariIni
    });
  });
  
  if (!isValid) {
    showAlert("Mohon lengkapi semua field yang diperlukan", "danger");
    return;
  }
  
  // Calculate buyback price
  const results = calculateBuybackPrice(items);
  
  // Show results
  showResults(results);
}

// Calculate buyback price
function calculateBuybackPrice(items) {
  const results = [];
  
  items.forEach(item => {
    let buybackPercentage = 0;
    let buybackPrice = 0;
    
    // Determine buyback percentage based on store origin and condition
    if (item.asalToko === "Toko Melati") {
      // For items from Melati store, use the new calculateMelatiPersentase function
      // We need to pass the condition and the original purchase percentage
      // Assuming hargaBeli is the original purchase price as a percentage of hargaHariIni
      const persentaseBeli = (item.hargaBeli / item.hargaHariIni) * 100;
      buybackPercentage = calculateMelatiPersentase(item.kondisiBarang, persentaseBeli);
    } else {
      // For items from other stores, use the new calculateLuarTokoPersentase function
      buybackPercentage = calculateLuarTokoPersentase(item.kondisiBarang);
    }
    
    // Calculate buyback price based on current price
    buybackPrice = (item.hargaHariIni * buybackPercentage) / 100;
    
    // Calculate price difference
    const priceDifference = buybackPrice - item.hargaBeli;
    const percentageDifference = ((priceDifference / item.hargaBeli) * 100).toFixed(2);
    
    results.push({
      ...item,
      buybackPercentage,
      buybackPrice,
      priceDifference,
      percentageDifference
    });
  });
  
  return results;
}

// New helper functions for calculating percentages
function calculateMelatiPersentase(kondisiBarang, persentaseBeli) {
  if (persentaseBeli >= 95) {
    const persentaseMap = {
      1: 98,
      2: 97,
      3: 96
    };
    return persentaseMap[kondisiBarang];
  } else if (persentaseBeli >= 90) {
    const persentaseMap = {
      1: 97,
      2: 95,
      3: 94
    };
    return persentaseMap[kondisiBarang];
  } else if (persentaseBeli >= 85) {
    const persentaseMap = {
      1: 95,
      2: 93,
      3: 92
    };
    return persentaseMap[kondisiBarang];
  } else if (persentaseBeli >= 80) {
    const persentaseMap = {
      1: 93,
      2: 90,
      3: 88
    };
    return persentaseMap[kondisiBarang];
  } else if (persentaseBeli >= 75) {
    const persentaseMap = {
      1: 90,
      2: 87,
      3: 80
    };
    return persentaseMap[kondisiBarang];
  } else {
    const persentaseMap = {
      1: 90,
      2: 83,
      3: 79
    };
    return persentaseMap[kondisiBarang];
  }
}

function calculateLuarTokoPersentase(kondisiBarang) {
  const persentaseMap = {
    1: 72,
    2: 70,
    3: 65,
  };
  return persentaseMap[kondisiBarang] || 60;
}


// Show results in modal
function showResults(results) {
  const modalBody = document.getElementById("modalMessage");
  let content = `
    <div class="alert alert-info mb-4">
      <i class="fas fa-info-circle me-2"></i>
      Berikut adalah hasil perhitungan buyback berdasarkan data yang dimasukkan.
    </div>
  `;
  
  results.forEach((result, index) => {
    const conditionText = result.kondisiBarang === "1" ? "Sangat Baik (K1)" : 
                          result.kondisiBarang === "2" ? "Sedang (K2)" : "Kurang (K3)";
    
    const priceStatus = result.priceDifference >= 0 ? "text-success" : "text-danger";
    const priceIcon = result.priceDifference >= 0 ? "fa-arrow-up" : "fa-arrow-down";
    
    content += `
      <div class="result-item">
        <h5 class="fw-bold mb-3">Item #${index + 1}: ${result.namaBarang || "Perhiasan"}</h5>
        <div class="row mb-2">
          <div class="col-md-6">
            <p class="mb-1"><strong>Kadar:</strong> ${result.kadar}</p>
            <p class="mb-1"><strong>Asal Toko:</strong> ${result.asalToko}</p>
            <p class="mb-1"><strong>Kondisi:</strong> ${conditionText}</p>
          </div>
          <div class="col-md-6">
            <p class="mb-1"><strong>Harga Beli:</strong> Rp ${formatNumber(result.hargaBeli)}</p>
            <p class="mb-1"><strong>Harga Hari Ini:</strong> Rp ${formatNumber(result.hargaHariIni)}</p>
            <p class="mb-1"><strong>Persentase Buyback:</strong> ${result.buybackPercentage}%</p>
          </div>
        </div>
                <div class="alert ${result.priceDifference >= 0 ? 'alert-success' : 'alert-danger'} mb-0">
          <div class="row">
            <div class="col-md-6">
              <h5 class="mb-0">Harga Buyback: Rp ${formatNumber(result.buybackPrice)}</h5>
            </div>
            <div class="col-md-6">
              <p class="mb-0 ${priceStatus}">
                <i class="fas ${priceIcon} me-1"></i>
                ${result.priceDifference >= 0 ? 'Untung' : 'Rugi'} Rp ${formatNumber(Math.abs(result.priceDifference))}
                (${Math.abs(result.percentageDifference)}%)
              </p>
            </div>
          </div>
        </div>
      </div>
    `;
  });
  
  // Add summary if there are multiple items
  if (results.length > 1) {
    const totalBuyback = results.reduce((sum, item) => sum + item.buybackPrice, 0);
    const totalOriginal = results.reduce((sum, item) => sum + item.hargaBeli, 0);
    const totalDifference = totalBuyback - totalOriginal;
    const totalPercentage = ((totalDifference / totalOriginal) * 100).toFixed(2);
    
    content += `
      <div class="result-item bg-light">
        <h5 class="fw-bold mb-3">Ringkasan Total</h5>
        <div class="row">
          <div class="col-md-6">
            <p class="mb-1"><strong>Total Harga Beli:</strong> Rp ${formatNumber(totalOriginal)}</p>
            <p class="mb-1"><strong>Total Harga Buyback:</strong> Rp ${formatNumber(totalBuyback)}</p>
          </div>
          <div class="col-md-6">
            <p class="mb-1 ${totalDifference >= 0 ? 'text-success' : 'text-danger'}">
              <strong>Total ${totalDifference >= 0 ? 'Keuntungan' : 'Kerugian'}:</strong> 
              Rp ${formatNumber(Math.abs(totalDifference))}
            </p>
            <p class="mb-1 ${totalDifference >= 0 ? 'text-success' : 'text-danger'}">
              <strong>Persentase:</strong> ${Math.abs(totalPercentage)}%
            </p>
          </div>
        </div>
      </div>
    `;
  }
  
  // Add timestamp
  const now = new Date();
  content += `
    <div class="text-end text-muted mt-3">
      <small>Dihitung pada: ${now.toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })}</small>
    </div>
  `;
  
  modalBody.innerHTML = content;
  
  // Show modal
  const resultModal = new bootstrap.Modal(document.getElementById('resultModal'));
  resultModal.show();
}

// Format number to currency format
function formatNumber(number) {
  return number.toLocaleString('id-ID');
}

// Show alert message
function showAlert(message, type = 'warning') {
  // Create alert element
  const alertDiv = document.createElement('div');
  alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
  alertDiv.innerHTML = `
    <i class="fas fa-${type === 'danger' ? 'exclamation-circle' : 'exclamation-triangle'} me-2"></i>
    ${message}
    <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
  `;
  
  // Insert at the top of the form
  const form = document.getElementById('penerimaanForm');
  form.parentNode.insertBefore(alertDiv, form);
  
  // Auto dismiss after 5 seconds
  setTimeout(() => {
    const bsAlert = new bootstrap.Alert(alertDiv);
    bsAlert.close();
  }, 5000);
}
// Pastikan fungsi printModal tersedia secara global
window.printModal = printModal;

// Print modal content - simplified and direct approach
function printModal() {
  const modalContent = document.getElementById("modalMessage").innerHTML;
  
  // Create a simplified print window with direct content
  const printContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Print</title>
      <style>
        @page {
          size: 75mm auto;  /* Width fixed, height auto */
          margin: 2mm;
        }
        body { 
          font-family: Arial, sans-serif;
          width: 70mm;
          font-size: 9pt;
          line-height: 1.2;
          margin: 0;
          padding: 2mm;
        }
        .header {
          text-align: center;
          font-weight: bold;
          font-size: 10pt;
          margin-bottom: 3mm;
        }
        .divider {
          border-top: 1px dashed #000;
          margin: 2mm 0;
        }
        .result-item {
          margin-bottom: 3mm;
          border-bottom: 1px dashed #000;
          padding-bottom: 2mm;
        }
        .result-item h5 {
          font-size: 9pt;
          margin: 1mm 0;
          font-weight: bold;
        }
        .result-item p {
          margin: 1mm 0;
          font-size: 8pt;
        }
        .alert {
          margin-top: 2mm;
          padding: 1mm;
        }
        .alert h5 {
          font-weight: bold;
          margin: 1mm 0;
        }
        .footer {
          text-align: center;
          font-size: 8pt;
          margin-top: 3mm;
        }
        /* Simplify the layout */
        .row::after {
          content: "";
          display: table;
          clear: both;
        }
        .col-md-6 {
          width: 100%;
        }
        /* Remove background colors and borders */
        .alert-success, .alert-danger, .alert-info {
          background: none !important;
          border: none !important;
        }
        /* Remove icons */
        .fas {
          display: none;
        }
      </style>
    </head>
    <body>
      <div class="header">
        Melati Gold Shop
      </div>
      <div class="header">
        Perhitungan Buyback
      </div>
      <div class="divider"></div>
      
      <!-- Insert modal content directly -->
      ${modalContent}
      
      <div class="divider"></div>
      <div class="footer">
        ${new Date().toLocaleDateString('id-ID', {
          day: 'numeric',
          month: 'numeric',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })}
      </div>
    </body>
    </html>
  `;

  // Open a new window with the content
  const printWindow = window.open('', '_blank');
  printWindow.document.write(printContent);
  printWindow.document.close();

  // Print immediately when loaded
  printWindow.onload = function() {
    // Short delay to ensure content is rendered
    setTimeout(() => {
      printWindow.print();
      printWindow.onafterprint = function() {
        printWindow.close();
      };
    }, 500);
  };
}



