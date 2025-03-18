//import { checkAuthState } from './auth.js';
import { getEmployees, addEmployee, deleteEmployee } from './employee-service.js';

// Check if user is logged in
// checkAuthState((user) => {
//   if (!user) {
//     window.location.href = 'login.html';
//   }
// });

// Initialize data
let employees = [];

// Load employees
async function loadEmployees() {
  try {
    employees = await getEmployees();
    updateStaffTable();
  } catch (error) {
    console.error("Error loading employees:", error);
  }
}

// Update staff table
function updateStaffTable() {
  const tbody = document.getElementById('staffList');
  tbody.innerHTML = '';
  
  employees.forEach(employee => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${employee.employeeId}</td>
      <td>${employee.name}</td>
      <td>${employee.barcode}</td>
      <td>
        <button class="btn btn-danger btn-sm delete-staff" data-id="${employee.id}">
          Hapus
        </button>
      </td>
    `;
    tbody.appendChild(row);
  });
  
  // Add event listeners to delete buttons
  document.querySelectorAll('.delete-staff').forEach(button => {
    button.addEventListener('click', async function() {
      const id = this.getAttribute('data-id');
      if (confirm('Apakah Anda yakin ingin menghapus karyawan ini?')) {
        try {
          await deleteEmployee(id);
          await loadEmployees(); // Reload the list
        } catch (error) {
          console.error("Error deleting employee:", error);
          alert('Terjadi kesalahan saat menghapus karyawan.');
        }
      }
    });
  });
}

// Add form submission handler
document.getElementById('staffForm').addEventListener('submit', async function(e) {
  e.preventDefault();
  
  const newStaff = {
    employeeId: document.getElementById('staffId').value,
    name: document.getElementById('staffName').value,
    barcode: document.getElementById('staffBarcode').value
  };
  
  try {
    await addEmployee(newStaff);
    this.reset();
    await loadEmployees(); // Reload the list
    alert('Karyawan berhasil ditambahkan!');
  } catch (error) {
    console.error("Error adding employee:", error);
    alert('Terjadi kesalahan saat menambahkan karyawan.');
  }
});

// Initialize page
document.addEventListener('DOMContentLoaded', () => {
  loadEmployees();
});
