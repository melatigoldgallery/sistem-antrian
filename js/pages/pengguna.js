import { 
  getEmployees, 
  addEmployee, 
  deleteEmployee, 
  updateEmployee, 
  getNextEmployeeId, 
  getNextBarcode,
  refreshEmployeeCache
} from '../services/employee-service.js';

// Initialize data
let employees = [];
let currentUserId = null;
let lastCacheRefresh = 0;

// Fungsi untuk menghasilkan barcode
function generateBarcode(barcodeValue, elementId) {
  try {
    JsBarcode(`#${elementId}`, barcodeValue, {
      format: "CODE128",
      lineColor: "#000",
      width: 2,
      height: 50,
      displayValue: false,
      fontSize: 12,
      margin: 5
    });
  } catch (error) {
    console.error("Error generating barcode:", error);
  }
}
// Fungsi untuk download semua barcode
async function downloadAllBarcodes() {
  try {
    if (employees.length === 0) {
      showNotification("error", "Tidak ada barcode untuk didownload");
      return;
    }
    
    // Tampilkan notifikasi proses
    showNotification("info", "Memproses barcode, mohon tunggu...");
    
    // Gunakan pendekatan yang lebih sederhana dengan canvas langsung
    const zip = new JSZip();
    const barcodeFolder = zip.folder("barcodes");
    
    // Proses barcode satu per satu untuk menghindari masalah memori
    for (let i = 0; i < employees.length; i++) {
      const employee = employees[i];
      const barcodeId = `barcode-${employee.id}`;
      const barcodeElement = document.getElementById(barcodeId);
      
      if (!barcodeElement) continue;
      
      // Buat canvas untuk barcode
      try {
        // Buat container sementara untuk menggabungkan barcode dan nama
        const container = document.createElement('div');
        container.style.backgroundColor = 'white';
        container.style.padding = '10px';
        container.style.textAlign = 'center';
        container.style.width = '200px';
        container.style.display = 'inline-block';
        
        // Clone barcode element
        const barcodeClone = barcodeElement.cloneNode(true);
        container.appendChild(barcodeClone);
        
        // Tambahkan nama karyawan
        const nameElement = document.createElement('div');
        nameElement.style.marginTop = '10px';
        nameElement.style.fontWeight = 'bold';
        nameElement.style.fontSize = '14px';
        nameElement.textContent = employee.name;
        container.appendChild(nameElement);
        
        // Tambahkan ke body sementara untuk dirender
        document.body.appendChild(container);
        
        // Gunakan html2canvas untuk mengambil screenshot dari container
        const canvas = await html2canvas(container, {
          backgroundColor: "#ffffff",
          scale: 2 // Higher resolution
        });
        
        // Hapus container sementara
        document.body.removeChild(container);
        
        // Konversi canvas ke blob
        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
        
        // Tambahkan ke zip
        const fileName = `barcode_${employee.name.replace(/\s+/g, '_')}.png`;
        barcodeFolder.file(fileName, blob);
        
        // Update notifikasi
        if (i % 5 === 0 || i === employees.length - 1) {
          showNotification("info", `Memproses barcode ${i+1} dari ${employees.length}...`);
        }
      } catch (err) {
        console.error(`Error processing barcode for ${employee.name}:`, err);
        continue; // Lanjutkan ke barcode berikutnya jika ada error
      }
      
      // Berikan waktu browser untuk "bernapas"
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    // Generate dan download zip file
    showNotification("info", "Membuat file zip...");
    const content = await zip.generateAsync({
      type: "blob",
      compression: "DEFLATE",
      compressionOptions: {
        level: 6 // Level kompresi sedang
      }
    });
    
    saveAs(content, "all_barcodes.zip");
    showNotification("success", "Semua barcode berhasil didownload!");
  } catch (error) {
    console.error("Error downloading all barcodes:", error);
    showNotification("error", `Gagal mendownload semua barcode: ${error.message}`);
  }
}



// Tambahkan fungsi untuk mengisi ID dan barcode otomatis
async function populateAutoFields() {
  try {
    const nextId = await getNextEmployeeId();
    const nextBarcode = await getNextBarcode();
    
    document.getElementById('staffId').value = nextId;
    document.getElementById('staffBarcode').value = nextBarcode;
  } catch (error) {
    console.error("Error populating auto fields:", error);
    showNotification("error", "Gagal menghasilkan ID otomatis");
  }
}

// Load employees with cache consideration
async function loadEmployees(forceRefresh = false) {
  try {
    // Check if we need to force refresh based on time
    const now = new Date().getTime();
    if (now - lastCacheRefresh > 3600000) { // Refresh UI cache every hour
      forceRefresh = true;
      lastCacheRefresh = now;
    }
    
    employees = await getEmployees(forceRefresh);
    updateStaffTable();
  } catch (error) {
    console.error("Error loading employees:", error);
    showNotification("error", "Gagal memuat data karyawan");
  }
}

// Modifikasi fungsi updateStaffTable untuk menampilkan barcode
function updateStaffTable() {
  const tbody = document.getElementById('staffList');
  const emptyState = document.getElementById('emptyStaff');
  
  if (!tbody) return;
  
  tbody.innerHTML = '';
  
  if (employees.length === 0) {
    if (emptyState) emptyState.style.display = "flex";
    return;
  }
  
  if (emptyState) emptyState.style.display = "none";
  
  employees.forEach(employee => {
    const row = document.createElement('tr');
    const barcodeId = `barcode-${employee.id}`;
    
    row.innerHTML = `
      <td>${employee.employeeId || '-'}</td>
      <td>${employee.name || '-'}</td>
      <td>${employee.barcode || '-'}</td>
      <td>
        <div class="barcode-container">
          <svg id="${barcodeId}" class="barcode"></svg>
          <div class="barcode-name">${employee.name}</div>
        </div>
      </td>
      <td>${formatEmployeeType(employee.type) || '-'}</td>
      <td>
        <button class="btn btn-sm btn-outline-primary edit-staff" data-id="${employee.id}" data-bs-toggle="tooltip" title="Edit">
          <i class="fas fa-edit"></i>
        </button>
        <button class="btn btn-sm btn-outline-danger delete-staff" data-id="${employee.id}" data-name="${employee.name}" data-bs-toggle="tooltip" title="Hapus">
          <i class="fas fa-trash"></i>
        </button>
      </td>
    `;
    tbody.appendChild(row);
    
    // Generate barcode untuk setiap karyawan
    if (employee.barcode) {
      generateBarcode(employee.barcode, barcodeId);
    }
  });
  
  // Initialize tooltips
  const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
  tooltipTriggerList.map(function (tooltipTriggerEl) {
    return new bootstrap.Tooltip(tooltipTriggerEl);
  });
  
  // Add event listeners to action buttons
  addActionButtonListeners();
}


// Helper function to format employee type
function formatEmployeeType(type) {
  return type === "staff" ? "Staff" : "Office Boy";
}

// Set up event listeners
function setupEventListeners() {
  // Add form submission handler
  document.getElementById('staffForm')?.addEventListener('submit', handleAddEmployee);
  
  // Filter by employee type
  document.querySelectorAll("[data-employee-filter]").forEach((item) => {
    item.addEventListener("click", function (e) {
      e.preventDefault();
      const filter = this.dataset.employeeFilter;
      filterEmployees("type", filter);
    });
  });
  
  // Tambahkan event listener untuk tombol refresh ID dan barcode
  document.querySelector('.refresh-id')?.addEventListener('click', async function() {
    try {
      const nextId = await getNextEmployeeId();
      document.getElementById('staffId').value = nextId;
    } catch (error) {
      console.error("Error refreshing ID:", error);
    }
  });
  
  document.querySelector('.refresh-barcode')?.addEventListener('click', async function() {
    try {
      const nextBarcode = await getNextBarcode();
      document.getElementById('staffBarcode').value = nextBarcode;
    } catch (error) {
      console.error("Error refreshing barcode:", error);
    }
  });
    // Tambahkan event listener untuk download semua barcode
    document.getElementById('downloadAllBarcodes')?.addEventListener('click', downloadAllBarcodes);
  // Export users
  document.getElementById('exportUsers')?.addEventListener('click', exportUsersToExcel);
  
  // Save user changes in edit modal
  document.getElementById('saveUserChanges')?.addEventListener('click', handleUpdateEmployee);
  
  // Confirm delete
  document.getElementById('confirmDelete')?.addEventListener('click', handleConfirmDelete);
// Tambahkan ke setupEventListeners
document.getElementById('printAllBarcodes')?.addEventListener('click', printAllBarcodes);
}

// Fungsi untuk mencetak semua barcode
function printAllBarcodes() {
  window.print();
}
// Add event listeners to action buttons
function addActionButtonListeners() {
  // Edit button
  document.querySelectorAll('.edit-staff').forEach(button => {
    button.addEventListener('click', handleEditClick);
  });
  
  // Delete button
  document.querySelectorAll('.delete-staff').forEach(button => {
    button.addEventListener('click', handleDeleteClick);
  });
}

// Handle add employee form submission
async function handleAddEmployee(e) {
  e.preventDefault();
  
  const newStaff = {
    employeeId: document.getElementById('staffId').value,
    name: document.getElementById('staffName').value,
    barcode: document.getElementById('staffBarcode').value,
    type: document.getElementById('staffType').value,
  };
  
  try {
    await addEmployee(newStaff);
    this.reset();
    
    // Reload employees dan generate ID baru
    await loadEmployees();
    await populateAutoFields();
    
    showNotification("success", "Karyawan berhasil ditambahkan!");
  } catch (error) {
    console.error("Error adding employee:", error);
    showNotification("error", error.message || "Terjadi kesalahan saat menambahkan karyawan");
  }
}

// Handle edit button click
function handleEditClick() {
  const id = this.getAttribute('data-id');
  const employee = employees.find(emp => emp.id === id);
  
  if (!employee) return;
  
  // Populate edit form
  document.getElementById('editUserId').value = employee.id;
  document.getElementById('editStaffId').value = employee.employeeId || '';
  document.getElementById('editStaffName').value = employee.name || '';
  document.getElementById('editStaffBarcode').value = employee.barcode || '';
  document.getElementById('editStaffType').value = employee.type || 'staff';
   
  // Show modal
  const editModal = new bootstrap.Modal(document.getElementById('editUserModal'));
  editModal.show();
}

// Handle delete button click
function handleDeleteClick() {
  const id = this.getAttribute('data-id');
  const name = this.getAttribute('data-name');
  
  // Set current user ID for deletion
  currentUserId = id;
  
  // Update modal content
  document.getElementById('deleteUserName').textContent = name;
  
  // Show confirm modal
  const confirmModal = new bootstrap.Modal(document.getElementById('confirmDeleteModal'));
  confirmModal.show();
}

// Handle update employee
async function handleUpdateEmployee() {
  const id = document.getElementById('editUserId').value;
  
  const updatedEmployee = {
    employeeId: document.getElementById('editStaffId').value,
    name: document.getElementById('editStaffName').value,
    barcode: document.getElementById('editStaffBarcode').value,
    type: document.getElementById('editStaffType').value
  };
  
  try {
    await updateEmployee(id, updatedEmployee);
    
    // Close modal
    const editModal = bootstrap.Modal.getInstance(document.getElementById('editUserModal'));
    editModal.hide();
    
    await loadEmployees(); // Reload the list
    showNotification("success", "Data karyawan berhasil diperbarui!");
  } catch (error) {
    console.error("Error updating employee:", error);
    showNotification("error", "Terjadi kesalahan saat memperbarui data karyawan");
  }
}

// Handle confirm delete
async function handleConfirmDelete() {
  if (!currentUserId) return;
  
  try {
    await deleteEmployee(currentUserId);
    
    // Close modal
    const confirmModal = bootstrap.Modal.getInstance(document.getElementById('confirmDeleteModal'));
    confirmModal.hide();
    
    currentUserId = null;
    
    await loadEmployees(); // Reload the list
    showNotification("success", "Karyawan berhasil dihapus!");
  } catch (error) {
    console.error("Error deleting employee:", error);
    showNotification("error", "Terjadi kesalahan saat menghapus karyawan");
  }
}

// Filter employees
function filterEmployees(filterType, value) {
  const rows = document.querySelectorAll("#staffList tr");

  rows.forEach((row) => {
    let showRow = true;

    if (value !== "all") {
      if (filterType === "type") {
        const typeCell = row.querySelector("td:nth-child(4)").textContent;
        showRow = (value === "staff" && typeCell === "Staff") || (value === "ob" && typeCell === "Office Boy");
      } else if (filterType === "shift") {
        const shiftCell = row.querySelector("td:nth-child(5)").textContent;
        showRow = (value === "morning" && shiftCell === "Pagi") || (value === "afternoon" && shiftCell === "Sore");
      }
    }

    row.style.display = showRow ? "" : "none";
  });
}

// Export users to Excel
function exportUsersToExcel() {
  // Create a workbook
  const wb = XLSX.utils.book_new();
  
  // Format data for export
  const exportData = employees.map(emp => ({
    'ID Karyawan': emp.employeeId,
    'Nama': emp.name,
    'Barcode': emp.barcode,
    'Tipe': emp.type === 'staff' ? 'Staff' : 'Office Boy'
  }));
  
  // Create worksheet
  const ws = XLSX.utils.json_to_sheet(exportData);
  
  // Add worksheet to workbook
  XLSX.utils.book_append_sheet(wb, ws, "Daftar Karyawan");
  
  // Generate Excel file and trigger download
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];
  XLSX.writeFile(wb, `daftar_karyawan_${dateStr}.xlsx`);
  
  showNotification("success", "Data karyawan berhasil diexport!");
}

// Show notification
function showNotification(type, message) {
  // Create notification element
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.innerHTML = `
    <div class="notification-icon">
      <i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'}"></i>
    </div>
    <div class="notification-content">
      <p>${message}</p>
    </div>
    <button class="notification-close">
      <i class="fas fa-times"></i>
    </button>
  `;
  
  // Add to document
  document.body.appendChild(notification);
  
  // Add close button functionality
  notification.querySelector('.notification-close').addEventListener('click', () => {
    notification.classList.add('notification-hiding');
    setTimeout(() => {
      notification.remove();
    }, 300);
  });
  
  // Auto remove after 3 seconds
  setTimeout(() => {
    notification.classList.add('notification-hiding');
    setTimeout(() => {
      notification.remove();
    }, 300);
  }, 3000);
  
  // Show with animation
  setTimeout(() => {
    notification.classList.add('notification-show');
  }, 10);
}

// Add notification styles if not already in CSS file
function addNotificationStyles() {
  if (!document.getElementById('notification-styles')) {
    const style = document.createElement('style');
    style.id = 'notification-styles';
    style.textContent = `
      .notification {
        position: fixed;
        top: 20px;
        right: -350px;
        width: 320px;
        background-color: white;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        display: flex;
        align-items: center;
        padding: 15px;
        z-index: 9999;
        transition: right 0.3s ease;
      }
      
      .notification-show {
        right: 20px;
      }
      
      .notification-hiding {
        right: -350px;
      }
      
      .notification.success .notification-icon {
        color: var(--success-color, #28a745);
      }
      
      .notification.error .notification-icon {
        color: var(--danger-color, #dc3545);
      }
      
      .notification-icon {
        font-size: 24px;
        margin-right: 15px;
      }
      
      .notification-content {
        flex: 1;
      }
      
      .notification-content p {
        margin: 0;
        font-size: 14px;
        color: var(--gray-700, #495057);
      }
      
      .notification-close {
        background: none;
        border: none;
        color: var(--gray-500, #adb5bd);
        cursor: pointer;
        font-size: 16px;
        padding: 0;
      }
      
      .notification-close:hover {
        color: var(--gray-700, #495057);
      }
    `;
    document.head.appendChild(style);
  }
}

// Check cache status and display indicator
function updateCacheStatusIndicator() {
  const cacheTimestamp = localStorage.getItem('employees_cache_timestamp');
  const cacheStatusElement = document.getElementById('cacheStatus');
  
  if (cacheStatusElement && cacheTimestamp) {
    const now = new Date().getTime();
    const cacheTime = parseInt(cacheTimestamp);
    const cacheAge = now - cacheTime;
    const hoursSinceUpdate = Math.floor(cacheAge / (1000 * 60 * 60));
    
  }
}
// Expose logout function to window object for HTML access
window.handleLogout = function() {
  console.log("Logout clicked");
  // Implementasi logout - bisa disesuaikan dengan kebutuhan
  window.location.href = "index.html";
};

// Document ready function - PENTING: Ini harus berada di akhir file
document.addEventListener("DOMContentLoaded", async function () {
  // Add notification styles
  addNotificationStyles();
  
  // Load employees
  await loadEmployees();
  
  // Populate auto-generated fields
  await populateAutoFields();
  
  // Set up event listeners
  setupEventListeners();
  // Update cache status indicator if it exists
  updateCacheStatusIndicator();
  
  // Set interval to update cache status indicator every minute
  setInterval(updateCacheStatusIndicator, 60000);
});
