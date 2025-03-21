import { getEmployees, addEmployee, deleteEmployee, updateEmployee } from '../services/employee-service.js';

// Initialize data
let employees = [];
let currentUserId = null;

// Document ready function
document.addEventListener("DOMContentLoaded", function () {
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

 // Perbaikan untuk memastikan fungsi updateDateTime() berjalan dengan benar
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

// Perbaikan untuk menu toggle
function setupMenuToggle() {
  const menuToggle = document.querySelector(".menu-toggle");
  const appContainer = document.querySelector(".app-container");

  if (menuToggle && appContainer) {
    menuToggle.addEventListener("click", function() {
      appContainer.classList.toggle("sidebar-collapsed");
    });
  }
}

  updateDateTime();
  setInterval(updateDateTime, 1000);

  // Load employees
  loadEmployees();

  // Set up event listeners
  setupEventListeners();
});

// Load employees
async function loadEmployees() {
  try {
    employees = await getEmployees();
    updateStaffTable();
  } catch (error) {
    console.error("Error loading employees:", error);
    showNotification("error", "Gagal memuat data karyawan");
  }
}

// Update staff table
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
    row.innerHTML = `
      <td>${employee.employeeId || '-'}</td>
      <td>${employee.name || '-'}</td>
      <td>${employee.barcode || '-'}</td>
      <td>${formatEmployeeType(employee.type) || '-'}</td>
      <td>${formatShift(employee.defaultShift) || '-'}</td>
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
  document.getElementById('staffForm').addEventListener('submit', handleAddEmployee);
  
  // Filter by employee type
  document.querySelectorAll("[data-employee-filter]").forEach((item) => {
    item.addEventListener("click", function (e) {
      e.preventDefault();
      const filter = this.dataset.employeeFilter;
      filterEmployees("type", filter);
    });
  });
  
 
  
  // Export users
  document.getElementById('exportUsers')?.addEventListener('click', exportUsersToExcel);
  
  // Save user changes in edit modal
  document.getElementById('saveUserChanges')?.addEventListener('click', handleUpdateEmployee);
  
  // Confirm delete
  document.getElementById('confirmDelete')?.addEventListener('click', handleConfirmDelete);
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
    defaultShift: document.getElementById('staffShift').value
  };
  
  try {
    await addEmployee(newStaff);
    this.reset();
    await loadEmployees(); // Reload the list
    showNotification("success", "Karyawan berhasil ditambahkan!");
  } catch (error) {
    console.error("Error adding employee:", error);
    showNotification("error", "Terjadi kesalahan saat menambahkan karyawan");
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
  document.getElementById('editStaffShift').value = employee.defaultShift || 'morning';
  
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
    id: id,
    employeeId: document.getElementById('editStaffId').value,
    name: document.getElementById('editStaffName').value,
    barcode: document.getElementById('editStaffBarcode').value,
    type: document.getElementById('editStaffType').value,
    defaultShift: document.getElementById('editStaffShift').value
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

  // Update dropdown button text
  if (filterType === "type") {
    const buttonText = value === "all" ? "Filter Tipe" : value === "staff" ? "Staff" : "Office Boy";
    document.getElementById("employeeFilterDropdown").innerHTML = `<i class="fas fa-user-tag"></i> ${buttonText}`;
  } else if (filterType === "shift") {
    const buttonText = value === "all" ? "Filter Shift" : value === "morning" ? "Shift Pagi" : "Shift Sore";
    document.getElementById("shiftFilterDropdown").innerHTML = `<i class="fas fa-clock"></i> ${buttonText}`;
  }
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
    'Tipe': emp.type === 'staff' ? 'Staff' : 'Office Boy',
    'Shift Default': emp.defaultShift === 'morning' ? 'Pagi' : 'Sore'
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

// Add CSS for notifications if not already in the CSS file
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
        color: var(--success-color);
      }
      
      .notification.error .notification-icon {
        color: var(--danger-color);
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
        color: var(--gray-700);
      }
      
      .notification-close {
        background: none;
        border: none;
        color: var(--gray-500);
        cursor: pointer;
        font-size: 16px;
        padding: 0;
      }
      
      .notification-close:hover {
        color: var(--gray-700);
      }
    `;
    document.head.appendChild(style);
  }
}

// Call this function when the page loads
document.addEventListener('DOMContentLoaded', addNotificationStyles);

// Create a service for employee operations
export function updateEmployee(id, updatedEmployee) {
  return new Promise((resolve, reject) => {
    try {
      // Get existing employees from localStorage
      const storedEmployees = localStorage.getItem('employees');
      let employees = storedEmployees ? JSON.parse(storedEmployees) : [];
      
      // Find the employee to update
      const index = employees.findIndex(emp => emp.id === id);
      
      if (index !== -1) {
        // Update the employee
        employees[index] = {
          ...employees[index],
          ...updatedEmployee
        };
        
        // Save back to localStorage
        localStorage.setItem('employees', JSON.stringify(employees));
        resolve(employees[index]);
      } else {
        reject(new Error('Employee not found'));
      }
    } catch (error) {
      reject(error);
    }
  });
}
