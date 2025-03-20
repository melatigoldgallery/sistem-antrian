import { findEmployeeByBarcode } from './employee-service.js';
import { recordAttendance, updateAttendanceOut, getTodayAttendance } from './attendance-service.js';
import { getAllLeaveRequests, submitLeaveRequest } from './leave-service.js';

// Initialize data
let attendanceRecords = [];
let leaveRecords = [];
let employees = [];

// Tambahkan atau perbarui fungsi berikut

// Sidebar toggle functionality
function initializeSidebar() {
  console.log('Initializing sidebar...');
  
  // Toggle sidebar collapse
  const menuToggle = document.querySelector('.menu-toggle');
  const appContainer = document.querySelector('.app-container');
  
  if (menuToggle) {
    console.log('Menu toggle found, adding event listener');
    menuToggle.addEventListener('click', function() {
      appContainer.classList.toggle('sidebar-collapsed');
      console.log('Sidebar collapsed state toggled');
    });
  } else {
    console.log('Menu toggle not found');
  }
  
  // Initialize Bootstrap collapse for submenu items
  // This will use Bootstrap's built-in collapse functionality
  const submenuItems = document.querySelectorAll('.has-submenu > a[data-bs-toggle="collapse"]');
  console.log('Found', submenuItems.length, 'submenu items with Bootstrap collapse');
  
  submenuItems.forEach(item => {
    // Add custom class handling for visual indicators
    item.addEventListener('click', function() {
      const parent = this.parentElement;
      
      // Toggle active class on parent
      if (this.getAttribute('aria-expanded') === 'true') {
        parent.classList.add('active');
      } else {
        parent.classList.remove('active');
      }
    });
  });
  
  // For non-Bootstrap implementation (fallback)
  const nonBootstrapSubmenuItems = document.querySelectorAll('.has-submenu > a:not([data-bs-toggle])');
  console.log('Found', nonBootstrapSubmenuItems.length, 'submenu items without Bootstrap collapse');
  
  nonBootstrapSubmenuItems.forEach(item => {
    item.addEventListener('click', function(e) {
      e.preventDefault();
      const parent = this.parentElement;
      const submenu = parent.querySelector('.submenu');
      
      // Toggle active class and submenu visibility
      parent.classList.toggle('active');
      
      if (submenu) {
        if (parent.classList.contains('active')) {
          submenu.style.display = 'block';
          submenu.style.maxHeight = submenu.scrollHeight + 'px';
        } else {
          submenu.style.maxHeight = '0';
          setTimeout(() => {
            submenu.style.display = 'none';
          }, 300); // Match transition duration
        }
      }
    });
  });
  
  // Initialize active submenu
  const activeSubmenu = document.querySelector('.has-submenu.active > .submenu');
  if (activeSubmenu && !activeSubmenu.classList.contains('show')) {
    console.log('Setting active submenu display');
    activeSubmenu.style.display = 'block';
    activeSubmenu.style.maxHeight = activeSubmenu.scrollHeight + 'px';
  }
}

// Initialize sidebar when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
  console.log('DOM loaded, initializing sidebar');
  initializeSidebar();
  
  // Add debug info to help troubleshoot
  setTimeout(() => {
    console.log('Debug info:');
    console.log('- Sidebar element:', document.querySelector('.sidebar'));
    console.log('- Has-submenu elements:', document.querySelectorAll('.has-submenu').length);
    console.log('- Active submenu:', document.querySelector('.has-submenu.active'));
    console.log('- Bootstrap collapse elements:', document.querySelectorAll('[data-bs-toggle="collapse"]').length);
    
    // Check if Bootstrap is properly initialized
    if (typeof bootstrap !== 'undefined') {
      console.log('- Bootstrap is available');
    } else {
      console.log('- Bootstrap is NOT available, might cause issues with collapse');
    }
  }, 1000);
});

// Rest of your existing code...




// Load today's attendance
async function loadTodayAttendance() {
  try {
    attendanceRecords = await getTodayAttendance();
    updateAttendanceTable();
    updateStats();
  } catch (error) {
    console.error("Error loading attendance:", error);
  }
}

// Load leave requests
async function loadLeaveRequests() {
  try {
    leaveRecords = await getAllLeaveRequests();
    updateLeaveTable();
  } catch (error) {
    console.error("Error loading leave requests:", error);
  }
}

// Load employees
async function loadEmployees() {
  try {
    employees = await getEmployees();
    populateEmployeeDropdown();
  } catch (error) {
    console.error("Error loading employees:", error);
  }
}

// Populate employee dropdown
function populateEmployeeDropdown() {
  const employeeSelect = document.getElementById("leaveEmployeeId");
  if (!employeeSelect) return;
  
  employeeSelect.innerHTML = '<option value="" selected disabled>Pilih Karyawan</option>';
  
  employees.forEach(emp => {
    const option = document.createElement('option');
    option.value = emp.employeeId;
    option.textContent = `${emp.employeeId} - ${emp.name}`;
    option.dataset.type = emp.type;
    option.dataset.defaultShift = emp.defaultShift;
    employeeSelect.appendChild(option);
  });
  
  // Add change event to auto-fill employee type and shift
  employeeSelect.addEventListener('change', function() {
    const selectedOption = this.options[this.selectedIndex];
    const employeeType = selectedOption.dataset.type;
    const defaultShift = selectedOption.dataset.defaultShift;
    
    if (document.getElementById("leaveEmployeeType")) {
      document.getElementById("leaveEmployeeType").value = employeeType || '';
    }
    
    if (document.getElementById("leaveShift")) {
      document.getElementById("leaveShift").value = defaultShift || '';
    }
  });
}

// Handle barcode scanning
document.getElementById("barcodeInput").addEventListener("keypress", async function (e) {
  if (e.key === "Enter") {
    e.preventDefault();
    await processBarcode();
  }
});

document.getElementById("manualSubmit").addEventListener("click", async function() {
  await processBarcode();
});

// Process barcode scan
async function processBarcode() {
  const barcode = document.getElementById("barcodeInput").value.trim();
  const scanResult = document.getElementById("scanResult");
  
  if (!barcode) {
    showScanResult("error", "Barcode tidak boleh kosong!");
    return;
  }
  
  try {
    const employee = await findEmployeeByBarcode(barcode);
    
    if (!employee) {
      showScanResult("error", "Barcode tidak valid!");
      return;
    }
    
    // Get scan type (in/out)
    const scanType = document.querySelector('input[name="scanType"]:checked').value;
    
    // Get employee type (auto/staff/ob)
    const employeeTypeSelection = document.querySelector('input[name="employeeType"]:checked').value;
    const employeeType = employeeTypeSelection === 'auto' ? employee.type : employeeTypeSelection;
    
    // Get shift (auto/morning/afternoon)
    const shiftSelection = document.querySelector('input[name="shiftOption"]:checked').value;
    const shift = shiftSelection === 'auto' ? employee.defaultShift : shiftSelection;
    
    // Current time
    const now = new Date();
    const timeString = now.toTimeString().split(' ')[0];
    
    if (scanType === 'in') {
      // Check if already checked in
      const existingRecord = attendanceRecords.find(record => 
        record.employeeId === employee.employeeId && record.date === now.toISOString().split('T')[0]
      );
      
      if (existingRecord && existingRecord.timeIn) {
        showScanResult("error", `${employee.name} sudah melakukan scan masuk hari ini!`);
        return;
      }
      
      // Check if late based on employee type and shift
      const isLate = checkIfLate(timeString, employeeType, shift);
      
           // Record attendance
           const attendance = {
            employeeId: employee.employeeId,
            name: employee.name,
            type: employeeType,
            shift: shift,
            timeIn: now,
            status: isLate ? "Terlambat" : "Tepat Waktu",
            date: now.toISOString().split('T')[0]
          };
          
          await recordAttendance(attendance);
          
          showScanResult("success", `Absensi masuk berhasil: ${employee.name} (${formatEmployeeType(employeeType)} - ${formatShift(shift)}) - ${isLate ? "Terlambat" : "Tepat Waktu"}`);
          
          // Reload attendance data
          await loadTodayAttendance();
        } else {
          // Scan out (pulang)
          const existingRecord = attendanceRecords.find(record => 
            record.employeeId === employee.employeeId && record.date === now.toISOString().split('T')[0]
          );
          
          if (!existingRecord) {
            showScanResult("error", `${employee.name} belum melakukan scan masuk hari ini!`);
            return;
          }
          
          if (existingRecord.timeOut) {
            showScanResult("error", `${employee.name} sudah melakukan scan pulang hari ini!`);
            return;
          }
          
          // Update attendance with time out
          await updateAttendanceOut(existingRecord.id, now);
          
          showScanResult("success", `Absensi pulang berhasil: ${employee.name}`);
          
          // Reload attendance data
          await loadTodayAttendance();
        }
      } catch (error) {
        console.error("Error scanning barcode:", error);
        showScanResult("error", "Terjadi kesalahan saat memproses barcode");
      }
      
      // Clear input
      document.getElementById("barcodeInput").value = "";
      document.getElementById("barcodeInput").focus();
    }
    
    // Check if employee is late based on type and shift
    function checkIfLate(timeString, employeeType, shift) {
      const time = new Date(`1970-01-01T${timeString}`);
      
      // Define late thresholds for each employee type and shift
      const thresholds = {
        staff: {
          morning: new Date('1970-01-01T08:45:00'),
          afternoon: new Date('1970-01-01T14:20:00')
        },
        ob: {
          morning: new Date('1970-01-01T07:30:00'),
          afternoon: new Date('1970-01-01T13:30:00')
        }
      };
      
      // Get appropriate threshold
      const threshold = thresholds[employeeType][shift];
      
      // Check if time is later than threshold
      return time > threshold;
    }
    
    // Show scan result message
    function showScanResult(type, message) {
      const scanResult = document.getElementById("scanResult");
      scanResult.className = "scan-result " + type;
      scanResult.innerHTML = message;
      scanResult.style.display = "block";
      
      // Hide result after 3 seconds
      setTimeout(() => {
        scanResult.style.display = "none";
      }, 3000);
    }
    
    // Update attendance table
    function updateAttendanceTable() {
      const tbody = document.getElementById("attendanceList");
      const emptyState = document.getElementById("emptyAttendance");
      
      if (!tbody) return;
      
      tbody.innerHTML = "";
      
      if (attendanceRecords.length === 0) {
        if (emptyState) emptyState.style.display = "flex";
        return;
      }
      
      if (emptyState) emptyState.style.display = "none";
      
      attendanceRecords.forEach((record) => {
        const row = document.createElement("tr");
        
        // Calculate work duration if both timeIn and timeOut exist
        let durationText = "-";
        if (record.timeIn && record.timeOut) {
          const timeIn = new Date(record.timeIn);
          const timeOut = new Date(record.timeOut);
          const durationMs = timeOut - timeIn;
          const durationHours = Math.floor(durationMs / (1000 * 60 * 60));
          const durationMinutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
          durationText = `${durationHours}j ${durationMinutes}m`;
        }
        
        const statusClass = record.status === "Tepat Waktu" ? "success" : "warning";
        
        row.innerHTML = `
          <td>${record.employeeId}</td>
          <td>${record.name}</td>
          <td>${formatEmployeeType(record.type)}</td>
          <td>${formatShift(record.shift)}</td>
          <td>${record.timeIn ? new Date(record.timeIn).toLocaleTimeString() : "-"}</td>
          <td><span class="status-badge ${statusClass}">${record.status}</span></td>
          <td>${record.timeOut ? new Date(record.timeOut).toLocaleTimeString() : "-"}</td>
          <td>${durationText}</td>
          <td>
            <button class="btn btn-sm btn-outline-info view-btn" data-id="${record.id}" data-bs-toggle="tooltip" title="Detail">
              <i class="fas fa-eye"></i>
            </button>
            ${!record.timeOut ? `
            <button class="btn btn-sm btn-outline-primary checkout-btn" data-id="${record.id}" data-bs-toggle="tooltip" title="Checkout Manual">
              <i class="fas fa-sign-out-alt"></i>
            </button>
            ` : ''}
          </td>
        `;
        
        tbody.appendChild(row);
      });
      
      // Add event listeners to buttons
      document.querySelectorAll('.checkout-btn').forEach(btn => {
        btn.addEventListener('click', handleManualCheckout);
      });
      
      document.querySelectorAll('.view-btn').forEach(btn => {
        btn.addEventListener('click', handleViewAttendance);
      });
      
      // Initialize tooltips
      const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
      tooltipTriggerList.map(function (tooltipTriggerEl) {
        return new bootstrap.Tooltip(tooltipTriggerEl);
      });
    }
    
    // Handle manual checkout
    async function handleManualCheckout(e) {
      const recordId = e.currentTarget.dataset.id;
      const record = attendanceRecords.find(r => r.id === recordId);
      
      if (!record) return;
      
      if (confirm(`Apakah Anda yakin ingin melakukan checkout manual untuk ${record.name}?`)) {
        try {
          await updateAttendanceOut(recordId, new Date());
          await loadTodayAttendance();
          showScanResult("success", `Checkout manual berhasil untuk ${record.name}`);
        } catch (error) {
          console.error("Error during manual checkout:", error);
          showScanResult("error", "Terjadi kesalahan saat melakukan checkout manual");
        }
      }
    }
    
    // Handle view attendance details
    function handleViewAttendance(e) {
      const recordId = e.currentTarget.dataset.id;
      const record = attendanceRecords.find(r => r.id === recordId);
      
      if (!record) return;
      
      // Implement view details functionality
      // This could open a modal with detailed information
      console.log("View attendance details for:", record);
    }
    
    // Helper function to format employee type
    function formatEmployeeType(type) {
      return type === 'staff' ? 'Staff' : 'Office Boy';
    }
    
    // Helper function to format shift
    function formatShift(shift) {
      return shift === 'morning' ? 'Pagi' : 'Sore';
    }
    
    // Helper function to format replacement information
    function getReplacementInfo(record) {
      if (!record.replacementDetails) return '-';
      
      if (record.replacementType === 'libur') {
        return `Ganti libur pada ${record.replacementDetails.formattedDate}`;
      } else if (record.replacementType === 'jam') {
        return `Ganti ${record.replacementDetails.hours} jam pada ${record.replacementDetails.formattedDate}`;
      }
      return '-';
    }
    
    // Update leave table
    function updateLeaveTable() {
      const tbody = document.getElementById('leaveList');
      const emptyState = document.getElementById('emptyLeave');
      
      if (!tbody) return;
      
      tbody.innerHTML = '';
      
      if (leaveRecords.length === 0) {
        if (emptyState) emptyState.style.display = "flex";
        return;
      }
      
      if (emptyState) emptyState.style.display = "none";
      
      leaveRecords.forEach(record => {
        const replacementInfo = getReplacementInfo(record);
        const row = document.createElement('tr');
        
        const statusClass = record.status === 'Disetujui' ? 'success' : record.status === 'Ditolak' ? 'danger' : 'warning';
        const replacementStatusClass = record.replacementStatus === 'Sudah Diganti' ? 'success' : 'danger';
        
        row.innerHTML = `
          <td>${record.employeeId}</td>
          <td>${record.name}</td>
          <td>${formatEmployeeType(record.type)}</td>
          <td>${formatShift(record.shift)}</td>
          <td>${record.leaveDate}</td>
          <td>${record.reason}</td>
          <td>${record.replacementType === 'libur' ? 'Ganti Libur' : 'Ganti Jam'}</td>
          <td>${replacementInfo}</td>
          <td><span class="status-badge ${statusClass}">${record.status}</span></td>
          <td><span class="status-badge ${replacementStatusClass}">${record.replacementStatus}</span></td>
        `;
        
        tbody.appendChild(row);
      });
    }
    
    // Update statistics
    function updateStats() {
      const today = new Date().toISOString().split('T')[0];
      const todayRecords = attendanceRecords.filter(record => record.date === today);
      
      const presentCount = todayRecords.length;
      const lateCount = todayRecords.filter(record => record.status === 'Terlambat').length;
      const leaveCount = leaveRecords.filter(record => record.leaveDate === today && record.status === 'Disetujui').length;
      
      // Calculate expected attendance (this would need to be based on your total staff count)
      const totalStaffCount = 10; // Example value, replace with actual count
      const absentCount = totalStaffCount - presentCount - leaveCount;
      
      document.getElementById('presentCount').textContent = presentCount;
      document.getElementById('lateCount').textContent = lateCount;
      document.getElementById('absentCount').textContent = absentCount > 0 ? absentCount : 0;
      document.getElementById('leaveCount').textContent = leaveCount;
    }
    
    // Handle leave form submission
    document.getElementById('submitLeaveBtn')?.addEventListener('click', async function() {
      const form = document.getElementById('addLeaveForm');
      
      // Basic form validation
      const employeeId = document.getElementById('leaveEmployeeId').value;
      const employeeType = document.getElementById('leaveEmployeeType').value;
      const shift = document.getElementById('leaveShift').value;
      const leaveDate = document.getElementById('leaveDate').value;
      const reason = document.getElementById('leaveReason').value;
      const replacementType = document.getElementById('leaveReplacementType').value;
      
      if (!employeeId || !employeeType || !shift || !leaveDate || !reason || !replacementType) {
        alert('Mohon lengkapi semua field yang diperlukan');
        return;
      }
      
      // Get employee name
      const employee = employees.find(emp => emp.employeeId === employeeId);
      if (!employee) {
        alert('Karyawan tidak ditemukan');
        return;
      }
      
      // Get replacement details
      let replacementDetails = {};
      
      if (replacementType === 'libur') {
        const replacementDate = document.getElementById('replacementDate').value;
        if (!replacementDate) {
          alert('Mohon isi tanggal ganti libur');
          return;
        }
        
        replacementDetails = {
          type: 'libur',
          date: replacementDate,
          formattedDate: new Date(replacementDate).toLocaleDateString('id-ID', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          })
        };
      } else if (replacementType === 'jam') {
        const replacementHourDate = document.getElementById('replacementHourDate').value;
        const replacementHours = document.getElementById('replacementHours').value;
        
        if (!replacementHourDate || !replacementHours) {
          alert('Mohon isi tanggal dan jumlah jam pengganti');
          return;
        }
        
        replacementDetails = {
          type: 'jam',
          date: replacementHourDate,
          hours: replacementHours,
          formattedDate: new Date(replacementHourDate).toLocaleDateString('id-ID', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          })
        };
      }
      
      // Create leave request object
      const leaveRequest = {
        employeeId: employeeId,
        name: employee.name,
        type: employeeType,
        shift: shift,
        leaveDate: new Date(leaveDate).toLocaleDateString('id-ID', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        }),
        rawLeaveDate: leaveDate,
        reason: reason,
        replacementType: replacementType,
        replacementDetails: replacementDetails,
        status: 'Pending',
        replacementStatus: 'Belum Diganti'
      };
      
      try {
        await submitLeaveRequest(leaveRequest);
        
        // Close modal and show success message
        const modal = bootstrap.Modal.getInstance(document.getElementById('addLeaveModal'));
        modal.hide();
        
        showScanResult('success', 'Pengajuan izin berhasil disimpan');
        
        // Reset form
        form.reset();
        
        // Reload leave data
        await loadLeaveRequests();
      } catch (error) {
        console.error('Error submitting leave request:', error);
        alert('Terjadi kesalahan saat menyimpan pengajuan izin');
      }
    });
    
    // Filter attendance by shift
    document.querySelectorAll('[data-shift-filter]').forEach(item => {
      item.addEventListener('click', function(e) {
        e.preventDefault();
        const filter = this.dataset.shiftFilter;
        filterAttendance('shift', filter);
      });
    });
    
    // Filter attendance by status
    document.querySelectorAll('[data-status-filter]').forEach(item => {
      item.addEventListener('click', function(e) {
        e.preventDefault();
        const filter = this.dataset.statusFilter;
        filterAttendance('status', filter);
      });
    });
    
    // Filter attendance by employee type
    document.querySelectorAll('[data-employee-filter]').forEach(item => {
      item.addEventListener('click', function(e) {
        e.preventDefault();
        const filter = this.dataset.employeeFilter;
        filterAttendance('type', filter);
      });
    });
    
    // Filter attendance records
    function filterAttendance(filterType, value) {
      const rows = document.querySelectorAll('#attendanceList tr');
      
      rows.forEach(row => {
        let showRow = true;
        
        if (value !== 'all') {
          if (filterType === 'shift') {
            const shiftCell = row.querySelector('td:nth-child(4)').textContent;
            showRow = (value === 'morning' && shiftCell === 'Pagi') || 
                      (value === 'afternoon' && shiftCell === 'Sore');
          } else if (filterType === 'status') {
            const statusCell = row.querySelector('td:nth-child(6) .status-badge').textContent;
            showRow = (value === 'ontime' && statusCell === 'Tepat Waktu') || 
                      (value === 'late' && statusCell === 'Terlambat');
          } else if (filterType === 'type') {
            const typeCell = row.querySelector('td:nth-child(3)').textContent;
            showRow = (value === 'staff' && typeCell === 'Staff') || 
                      (value === 'ob' && typeCell === 'Office Boy');
          }
        }
        
        row.style.display = showRow ? '' : 'none';
      });
      
      // Update dropdown button text
      if (filterType === 'shift') {
        const buttonText = value === 'all' ? 'Shift' : value === 'morning' ? 'Shift Pagi' : 'Shift Sore';
        document.getElementById('shiftFilterDropdown').innerHTML = `<i class="fas fa-clock"></i> ${buttonText}`;
      } else if (filterType === 'status') {
        const buttonText = value === 'all' ? 'Status' : value === 'ontime' ? 'Tepat Waktu' : 'Terlambat';
        document.getElementById('statusFilterDropdown').innerHTML = `<i class="fas fa-filter"></i> ${buttonText}`;
      } else if (filterType === 'type') {
        const buttonText = value === 'all' ? 'Tipe' : value === 'staff' ? 'Staff' : 'Office Boy';
        document.getElementById('employeeFilterDropdown').innerHTML = `<i class="fas fa-user-tag"></i> ${buttonText}`;
      }
    }
    
    
    // Calculate duration between two timestamps
    function calculateDuration(timeIn, timeOut) {
      const start = new Date(timeIn);
      const end = new Date(timeOut);
      const durationMs = end - start;
      const hours = Math.floor(durationMs / (1000 * 60 * 60));
      const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
      return `${hours}j ${minutes}m`;
    }
    
    // Refresh scanner
    document.getElementById('refreshScanner')?.addEventListener('click', function() {
      document.getElementById('barcodeInput').value = '';
      document.getElementById('barcodeInput').focus();
      document.getElementById('scanResult').style.display = 'none';
    });
    
    // Initialize page
    document.addEventListener('DOMContentLoaded', async () => {
      try {
        // Load data
        await Promise.all([
          loadEmployees(),
          loadTodayAttendance(),
          loadLeaveRequests()
        ]);
        
        // Set up replacement type toggle
        document.getElementById('leaveReplacementType')?.addEventListener('change', function() {
          const type = this.value;
          document.querySelectorAll('.replacement-fields').forEach(el => el.style.display = 'none');
          
          if (type === 'libur') {
            document.getElementById('replacementLiburFields').style.display = 'block';
          } else if (type === 'jam') {
            document.getElementById('replacementJamFields').style.display = 'block';
          }
        });
        
        console.log('Attendance system initialized successfully');
      } catch (error) {
        console.error('Error initializing attendance system:', error);
      }
    });
    
    
    
