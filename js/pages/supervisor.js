import {
  getPendingLeaveRequests,
  getAllLeaveRequests,
  updateLeaveRequestStatus,
  updateReplacementStatus,
  clearLeaveCache,
  leaveCache,
  leaveMonthCache,
  getLeaveRequestById
} from "../services/leave-service.js";

// Initialize data
let pendingLeaves = [];
let allLeaves = [];
// Filter variables
let currentReplacementFilter = "";
let filterApplied = false; // Flag untuk menandai apakah filter sudah diterapkan
let lastDataRefresh = 0; // Timestamp terakhir refresh data
const CACHE_DURATION = 60 * 60 * 1000;; // 1 jam dalam milidetik

// Fungsi untuk memuat pengajuan izin yang menunggu persetujuan
async function loadPendingLeaveRequests(forceRefresh = false) {
  try {
    const tbody = document.getElementById("pendingLeaveList");
    if (tbody) {
      // Start with empty table instead of loading message
      tbody.innerHTML = "";
    }

    // Cek apakah perlu refresh data dari server
    const now = Date.now();
    const shouldRefresh = forceRefresh || !lastDataRefresh || (now - lastDataRefresh > CACHE_DURATION);
    
    if (shouldRefresh) {
      console.log("Fetching pending leave requests from server...");
      
      // Dapatkan pengajuan izin yang menunggu persetujuan
      const pendingRequests = await getPendingLeaveRequests();
      console.log("Pending leave requests fetched:", pendingRequests.length);
      
      // Update data dan timestamp
      pendingLeaves = pendingRequests;
      lastDataRefresh = now;
    } else {
      console.log("Using cached pending leave requests data");
    }

    if (!pendingLeaves || pendingLeaves.length === 0) {
      // Show empty state if exists, but don't add any text to the table
      const emptyState = document.getElementById("emptyPendingRequests");
      if (emptyState) emptyState.style.display = "flex";
    } else {
      // Hide empty state if exists
      const emptyState = document.getElementById("emptyPendingRequests");
      if (emptyState) emptyState.style.display = "none";

      updatePendingLeaveTable();
    }

    // Update stats
    updateStats();
  } catch (error) {
    console.error("Error loading pending leave requests:", error);
    const tbody = document.getElementById("pendingLeaveList");
    if (tbody) {
      // You might want to keep this error message or remove it as well
      tbody.innerHTML = `<tr><td colspan="6" class="text-center text-danger">Error: Gagal memuat data - ${error.message}</td></tr>`;
    }
  }
}

async function loadAllLeaveRequests(forceRefresh = false) {
  try {
    const tbody = document.getElementById("leaveHistoryList");
    const emptyState = document.getElementById("emptyAllRequests");
    
    // Jika filter belum diterapkan, tampilkan pesan dan sembunyikan tabel
    if (!filterApplied) {
      if (tbody) {
        tbody.innerHTML = '<tr><td colspan="9" class="text-center">Silakan pilih filter status penggantian terlebih dahulu</td></tr>';
      }
      
      // Sembunyikan empty state jika ada
      if (emptyState) emptyState.style.display = "none";
      
      // Reset data
      allLeaves = [];
      
      // Update stats
      updateStats();
      return;
    }
    
    // Tampilkan loading state
    if (tbody) {
      tbody.innerHTML =
        '<tr><td colspan="9" class="text-center"><i class="fas fa-spinner fa-spin me-2"></i> Memuat data...</td></tr>';
    }

    // Cek apakah perlu refresh data dari server
    const now = Date.now();
    const shouldRefresh = forceRefresh || !lastDataRefresh || (now - lastDataRefresh > CACHE_DURATION);
    
    // Cek apakah data sudah ada di cache
    const cacheKey = `filter_${currentReplacementFilter}`;
    const cachedData = sessionStorage.getItem(cacheKey);
    
    if (!shouldRefresh && cachedData) {
      console.log("Using cached filtered leave requests data");
      allLeaves = JSON.parse(cachedData);
    } else {
      console.log("Fetching all leave requests...");
      let allRequestsData = await getAllLeaveRequests();
      console.log("Total leave requests before filtering:", allRequestsData.length);
      
      // Filter berdasarkan status penggantian jika filter dipilih
      if (currentReplacementFilter) {
        console.log(`Filtering by replacement status: ${currentReplacementFilter}`);
        
        allRequestsData = allRequestsData.filter(request => {
          // Periksa apakah ini multi-day leave
          const isMultiDay = request.leaveStartDate && request.leaveEndDate && 
                            request.leaveStartDate !== request.leaveEndDate;
          
          if (isMultiDay && request.replacementStatusArray) {
            // Untuk multi-day, periksa apakah ada status yang sesuai filter
            if (currentReplacementFilter === "Sudah Diganti") {
              return request.replacementStatusArray.some(s => s === "Sudah Diganti");
            } else if (currentReplacementFilter === "Belum Diganti") {
              return request.replacementStatusArray.some(s => s === "Belum Diganti" || !s);
            }
          } else {
            // Untuk single-day, periksa replacementStatus
            // Jika status belum diganti, juga periksa null/undefined/empty
            if (currentReplacementFilter === "Belum Diganti") {
              return !request.replacementStatus || 
                     request.replacementStatus === "" || 
                     request.replacementStatus === "Belum Diganti";
            } else {
              return request.replacementStatus === currentReplacementFilter;
            }
          }
          return false;
        });
      }
      
      console.log("Filtered leave requests count:", allRequestsData.length);
      
      // Update allLeaves dengan data yang sudah difilter
      allLeaves = allRequestsData;
      
      // Simpan hasil filter ke sessionStorage
      sessionStorage.setItem(cacheKey, JSON.stringify(allLeaves));
      
      // Update timestamp refresh
      lastDataRefresh = now;
    }

    if (!allLeaves || allLeaves.length === 0) {
      if (tbody) {
        tbody.innerHTML = '<tr><td colspan="9" class="text-center">Tidak ada data pengajuan izin dengan status tersebut</td></tr>';
      }

      // Show empty state if exists
      if (emptyState) emptyState.style.display = "flex";
    } else {
      // Hide empty state if exists
      if (emptyState) emptyState.style.display = "none";

      updateLeaveHistoryTable();
    }

    // Update stats
    updateStats();
  } catch (error) {
    console.error("Error loading all leave requests:", error);
    const tbody = document.getElementById("leaveHistoryList");
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="9" class="text-center text-danger">Error: Gagal memuat data - ${error.message}</td></tr>`;
    }
  }
}

// Update pending leave table
function updatePendingLeaveTable() {
  const tbody = document.getElementById("pendingLeaveList");
  const emptyState = document.getElementById("emptyPendingRequests");
  if (!tbody) return;

  tbody.innerHTML = "";

  if (!pendingLeaves || pendingLeaves.length === 0) {
    if (emptyState) emptyState.style.display = "flex";
    return;
  }
  if (emptyState) emptyState.style.display = "none";

  // Sort by submission date (newest first)
  const sortedLeaves = [...pendingLeaves].sort((a, b) => {
    return new Date(b.submissionDate || 0) - new Date(a.submissionDate || 0);
  });
  
  sortedLeaves.forEach((record) => {
    // Debug log untuk memeriksa data surat keterangan sakit
    if (record.leaveType === "sakit") {
      console.log(`Record ID ${record.id} - leaveType: ${record.leaveType}`);
      console.log("Has replacementDetails:", !!record.replacementDetails);
      if (record.replacementDetails) {
        console.log("Has medical certificate:", record.replacementDetails.hasMedicalCertificate);
        console.log("Medical certificate file:", record.replacementDetails.medicalCertificateFile);
      }
    }
    
    const row = document.createElement("tr");
    
    // Format tanggal izin
    let dateDisplay = record.leaveDate || "-";
    if (record.isMultiDay) {
      dateDisplay += ` (${record.dayCount} hari)`;
    }
    
    // Dapatkan informasi pengganti
    const replacementInfo = getReplacementInfo(record);
    
    // Tambahkan tombol untuk melihat surat keterangan sakit jika ada
    let medicalCertButton = "";
    if (
      record.leaveType === "sakit" &&
      record.replacementDetails &&
      record.replacementDetails.hasMedicalCertificate &&
      record.replacementDetails.medicalCertificateFile &&
      record.replacementDetails.medicalCertificateFile.url // Pastikan URL ada
    ) {
      console.log("Adding view certificate button for record:", record.id);
      medicalCertButton = `
        <button class="btn btn-sm btn-info view-cert-btn ms-2" data-id="${record.id}">
          <i class="fas fa-file-medical me-1"></i> Lihat Surat
        </button>
      `;
    }

    row.innerHTML = `
      <td>${record.employeeId || "-"}</td>
      <td>${record.name || "-"}</td>
      <td>${dateDisplay}</td>
      <td>${record.reason || "-"}</td>
      <td>${replacementInfo}</td>
      <td>
        <div class="action-buttons">
          <button class="approve-btn btn btn-success btn-sm" data-id="${record.id}">Setuju</button>
          <button class="reject-btn btn btn-danger btn-sm" data-id="${record.id}">Tolak</button>
          ${medicalCertButton}
        </div>
      </td>
    `;
    tbody.appendChild(row);
  });
  
  // Tambahkan event listener untuk tombol lihat surat
  document.querySelectorAll(".view-cert-btn").forEach((button) => {
    button.addEventListener("click", function() {
      const id = this.getAttribute("data-id");
      const record = pendingLeaves.find((item) => item.id === id);
      
      if (record && record.replacementDetails && record.replacementDetails.medicalCertificateFile) {
        console.log("Viewing medical certificate for record:", id);
        console.log("Certificate data:", record.replacementDetails.medicalCertificateFile);
        viewMedicalCertificate(record.replacementDetails.medicalCertificateFile);
      } else {
        showAlert("warning", "Tidak ada surat keterangan sakit yang tersedia");
      }
    });
  });
  
  // Add event listeners to action buttons
  document.querySelectorAll(".approve-btn").forEach((button) => {
    button.addEventListener("click", async function() {
      const id = this.getAttribute("data-id");
      try {
        // Show loading state
        this.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        this.disabled = true;

        await updateLeaveRequestStatus(id, "Disetujui");
        
        // Update local data instead of full refresh
        const recordIndex = pendingLeaves.findIndex(item => item.id === id);
        if (recordIndex !== -1) {
          // Remove from pending leaves
          const updatedRecord = {...pendingLeaves[recordIndex], status: "Disetujui"};
          pendingLeaves.splice(recordIndex, 1);
          
          // Add to all leaves if it matches the current filter
          if (filterApplied) {
            if (currentReplacementFilter === "Belum Diganti") {
              allLeaves.unshift(updatedRecord);
            }
          }
          
          // Update UI
          updatePendingLeaveTable();
          if (filterApplied) updateLeaveHistoryTable();
          updateStats();
        }

        // Show success message
        showAlert("success", "Pengajuan izin berhasil disetujui!");
      } catch (error) {
        console.error("Error approving leave request:", error);
        showAlert("danger", "Terjadi kesalahan saat menyetujui pengajuan izin.");

        // Reset button
        this.textContent = "Setuju";
        this.disabled = false;
      }
    });
  });
  
  document.querySelectorAll(".reject-btn").forEach((button) => {
    button.addEventListener("click", async function() {
      const id = this.getAttribute("data-id");
      try {
        // Show loading state
        this.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        this.disabled = true;

        await updateLeaveRequestStatus(id, "Ditolak");
        
        // Update local data instead of full refresh
        const recordIndex = pendingLeaves.findIndex(item => item.id === id);
        if (recordIndex !== -1) {
          // Remove from pending leaves
          pendingLeaves.splice(recordIndex, 1);
          
          // Update UI
          updatePendingLeaveTable();
          updateStats();
        }

        // Show success message
        showAlert("success", "Pengajuan izin berhasil ditolak.");
      } catch (error) {
        console.error("Error rejecting leave request:", error);
        showAlert("danger", "Terjadi kesalahan saat menolak pengajuan izin.");

        // Reset button
        this.textContent = "Tolak";
        this.disabled = false;
      }
    });
  });
}

// Update leave history table
function updateLeaveHistoryTable() {
  const tbody = document.getElementById("leaveHistoryList");
  if (!tbody) return;

  tbody.innerHTML = "";

  if (!allLeaves || allLeaves.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" class="text-center">Belum ada data pengajuan izin</td></tr>';

    // Show empty state if exists
    const emptyState = document.getElementById("emptyAllRequests");
    if (emptyState) emptyState.style.display = "flex";
    return;
  }

  // Hide empty state if exists
  const emptyState = document.getElementById("emptyAllRequests");
  if (emptyState) emptyState.style.display = "none";

  allLeaves.forEach((record) => {
    // Ensure record has a status
    if (!record.status) {
      record.status = "Pending";
    }

    // Periksa apakah izin multi-hari
    const isMultiDay = record.leaveStartDate && record.leaveEndDate && record.leaveStartDate !== record.leaveEndDate;

    // Format the leave date properly
    let formattedLeaveDate = record.leaveDate || record.date || "-";
    if (formattedLeaveDate instanceof Date) {
      formattedLeaveDate = formattedLeaveDate.toLocaleDateString("id-ID");
    } else if (typeof formattedLeaveDate === "object" && formattedLeaveDate !== null) {
      // Handle Timestamp or other date objects
      try {
        formattedLeaveDate = new Date(formattedLeaveDate.seconds * 1000).toLocaleDateString("id-ID");
      } catch (e) {
        console.warn("Could not format leave date:", e);
      }
    }

    // Jika bukan multi-hari, tampilkan seperti biasa
    if (!isMultiDay) {
      const replacementInfo = getReplacementInfo(record);
      const row = document.createElement("tr");

      // Tentukan status ganti dan tombol yang sesuai
      const replacementStatus = record.replacementStatus || "Belum Diganti";
      const buttonText = replacementStatus === "Sudah Diganti" ? "Batalkan" : "Sudah Diganti";
      // Use btn-danger for "Batalkan" and btn-success for "Sudah Diganti"
      const buttonClass = replacementStatus === "Sudah Diganti" ? "btn-danger" : "btn-success";

      // Tambahkan tombol untuk melihat surat keterangan sakit jika ada
      let medicalCertButton = "";
      if (
        record.leaveType === "sakit" &&
        record.replacementDetails &&
        record.replacementDetails.hasMedicalCertificate &&
        record.replacementDetails.medicalCertificateFile &&
        record.replacementDetails.medicalCertificateFile.url
      ) {
        medicalCertButton = `
          <button class="btn btn-sm btn-info view-cert-btn ms-1" data-id="${record.id}">
            <i class="fas fa-file-medical"></i>
          </button>
        `;
      }

      // Hanya tampilkan tombol aksi jika status pengajuan adalah Approved/Disetujui
      let actionButton = "-";
      if (record.status === "Approved" || record.status === "Disetujui") {
        actionButton = `
          <button class="replacement-status-btn ${buttonClass} btn-sm" data-id="${record.id}" data-status="${replacementStatus}">
            ${buttonText}
          </button>
          ${medicalCertButton}
        `;
      } else if (medicalCertButton) {
        // Jika tidak disetujui tapi ada surat keterangan sakit, tetap tampilkan tombol lihat surat
        actionButton = medicalCertButton;
      }

      row.innerHTML = `
        <td>${record.employeeId || "-"}</td>
        <td>${record.name || "-"}</td>
        <td>${formattedLeaveDate}</td>
        <td>${record.reason || "-"}</td>
        <td>${replacementInfo}</td>
        <td class="status-${(record.status || "unknown").toLowerCase()}">${record.status || "Unknown"}</td>
        <td class="status-${(replacementStatus || "unknown").toLowerCase().replace(/\s+/g, "-")}">${
        replacementStatus || "Unknown"
      }</td>
        <td>${actionButton}</td>
      `;
      tbody.appendChild(row);
    } else {
      // For multi-day leave, create multiple rows - one for each day
      const startDate = new Date(
        record.leaveStartDate instanceof Date
          ? record.leaveStartDate
          : record.leaveStartDate.seconds
          ? new Date(record.leaveStartDate.seconds * 1000)
          : record.leaveStartDate
      );
      const endDate = new Date(
        record.leaveEndDate instanceof Date
          ? record.leaveEndDate
          : record.leaveEndDate.seconds
          ? new Date(record.leaveEndDate.seconds * 1000)
          : record.leaveEndDate
      );
      const dayDiff = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;

      // Pastikan replacementStatusArray ada
      const replacementStatusArray = record.replacementStatusArray || Array(dayDiff).fill("Belum Diganti");

      // Tambahkan tombol untuk melihat surat keterangan sakit jika ada
      let medicalCertButton = "";
      if (
        record.leaveType === "sakit" &&
        record.replacementDetails &&
        record.replacementDetails.hasMedicalCertificate &&
        record.replacementDetails.medicalCertificateFile &&
        record.replacementDetails.medicalCertificateFile.url
      ) {
        medicalCertButton = `
          <button class="btn btn-sm btn-info view-cert-btn ms-1" data-id="${record.id}">
            <i class="fas fa-file-medical"></i>
          </button>
        `;
      }

      // Buat baris untuk setiap hari
      for (let i = 0; i < dayDiff; i++) {
        const currentDate = new Date(startDate);
        currentDate.setDate(startDate.getDate() + i);

        const formattedDate = currentDate.toLocaleDateString("id-ID", {
          day: "numeric",
          month: "long",
          year: "numeric",
        });

        const row = document.createElement("tr");

        // Jika ini hari pertama, tambahkan kelas untuk styling
        if (i === 0) {
          row.classList.add("first-day-row");
        }

        // Tentukan status ganti untuk hari ini
        const dayStatus = replacementStatusArray[i] || "Belum Diganti";
        const buttonText = dayStatus === "Sudah Diganti" ? "Batalkan" : "Sudah Diganti";
        const buttonClass = dayStatus === "Sudah Diganti" ? "btn-danger" : "btn-success";

        // Tampilkan informasi penggantian untuk hari ini
        let replacementInfo = "-";
        if (record.replacementType === "libur" && record.replacementDetails && record.replacementDetails.dates) {
          // Jika ada tanggal pengganti spesifik untuk hari ini
          if (record.replacementDetails.dates[i]) {
            replacementInfo = `Ganti libur pada ${record.replacementDetails.dates[i].formattedDate}`;
          }
        } else if (record.replacementType === "jam" && record.replacementDetails) {
          replacementInfo = `Ganti ${record.replacementDetails.hours} jam pada ${record.replacementDetails.formattedDate}`;
        }

        // Hanya tampilkan tombol aksi jika status pengajuan adalah Approved/Disetujui
        let actionButton = "-";
        if (record.status === "Approved" || record.status === "Disetujui") {
          actionButton = `
            <button class="replacement-status-btn ${buttonClass} btn-sm" data-id="${record.id}" data-status="${dayStatus}" data-day-index="${i}">
              ${buttonText}
            </button>
          `;
          
          // Tambahkan tombol lihat surat hanya pada baris pertama
          if (i === 0 && medicalCertButton) {
            actionButton += medicalCertButton;
          }
        } else if (i === 0 && medicalCertButton) {
          // Jika tidak disetujui tapi ada surat keterangan sakit, tetap tampilkan tombol lihat surat di baris pertama
          actionButton = medicalCertButton;
        }

        row.innerHTML = `
          <td>${record.employeeId || "-"}</td>
          <td>${record.name || "-"}</td>
          <td>${formattedDate} <span class="badge bg-info">Hari ${i + 1}/${dayDiff}</span></td>
          <td>${record.reason || "-"}</td>
          <td>${replacementInfo}</td>
          <td class="status-${(record.status || "unknown").toLowerCase()}">${record.status || "Unknown"}</td>
          <td class="status-${(dayStatus || "belum-diganti").toLowerCase().replace(/\s+/g, "-")}">${dayStatus}</td>
          <td>${actionButton}</td>
        `;

        tbody.appendChild(row);
      }
    }
  });

  // Add event listeners to buttons
  addEventListenersToButtons();
}

// Helper function to format replacement information
function getReplacementInfo(record) {
  if (!record.replacementType || record.replacementType === "tidak") {
    return "Tidak perlu diganti";
  } else if (record.replacementType === "libur") {
    // Check if it's a multi-day leave request
    const isMultiDay = record.leaveStartDate && record.leaveEndDate && record.leaveStartDate !== record.leaveEndDate;

    if (isMultiDay) {
      if (record.replacementDetails && record.replacementDetails.dates && record.replacementDetails.dates.length > 0) {
        // Handle multiple dates
        return record.replacementDetails.dates.map((date) => `Ganti libur pada ${date.formattedDate}`).join("<br>");
      } else if (record.replacementDetails && record.replacementDetails.formattedDate) {
        return `Ganti libur pada ${record.replacementDetails.formattedDate}`;
      }
      return "Ganti libur (multi-hari)";
    } else {
      if (record.replacementDetails && record.replacementDetails.dates && record.replacementDetails.dates.length > 0) {
        // Handle multiple dates
        return record.replacementDetails.dates.map((date) => `Ganti libur pada ${date.formattedDate}`).join("<br>");
      } else if (record.replacementDetails && record.replacementDetails.formattedDate) {
        return `Ganti libur pada ${record.replacementDetails.formattedDate}`;
      }
      return "Ganti libur";
    }
  } else if (record.replacementType === "jam") {
    return record.replacementDetails && record.replacementDetails.hours && record.replacementDetails.formattedDate
      ? `Ganti ${record.replacementDetails.hours} jam pada ${record.replacementDetails.formattedDate}`
      : "Ganti jam";
  }
  return "-";
}

// Format date helper
function formatDate(date) {
  if (!date) return "-";

  return new Date(date).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function updateStats() {
  // Count total requests - gunakan jumlah semua pengajuan dari allLeaves
  const totalRequests = allLeaves.length;
  document.getElementById("totalRequests").textContent = totalRequests;

  // Count approved requests
  const approvedRequests = allLeaves.filter((item) => item.status === "Approved" || item.status === "Disetujui").length;
  document.getElementById("approvedRequests").textContent = approvedRequests;

  // Count rejected requests
  const rejectedRequests = allLeaves.filter((item) => item.status === "Rejected" || item.status === "Ditolak").length;
  document.getElementById("rejectedRequests").textContent = rejectedRequests;

  // Count pending requests
  document.getElementById("pendingRequests").textContent = pendingLeaves.length;
}

// Show alert message
function showAlert(type, message, autoHide = true) {
  const alertContainer = document.getElementById("alertContainer");
  if (!alertContainer) return;

  // Create alert element
  const alertDiv = document.createElement("div");
  alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
  alertDiv.innerHTML = `
    ${message}
    <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
  `;

  // Clear previous alerts
  alertContainer.innerHTML = "";
  alertContainer.appendChild(alertDiv);
  alertContainer.style.display = "block";

  // Auto-hide after 5 seconds if autoHide is true
  if (autoHide) {
    setTimeout(() => {
      if (alertDiv.parentNode) {
        alertDiv.classList.remove("show");
        setTimeout(() => {
          if (alertDiv.parentNode) {
            alertDiv.parentNode.removeChild(alertDiv);
          }

          // Hide container if no alerts
          if (alertContainer.children.length === 0) {
            alertContainer.style.display = "none";
          }
        }, 150);
      }
    }, 5000);
  }
}

// Optimized refresh function that only updates what's needed
async function refreshData(forceRefresh = false) {
  try {
    // Show loading message
    showAlert("info", '<i class="fas fa-sync fa-spin me-2"></i> Memperbarui data...', false);

    // Determine which tab is active
    const activeTab = document.querySelector('.nav-link.active[data-bs-toggle="tab"]');
    const targetId = activeTab ? activeTab.getAttribute("data-bs-target") : null;
    
    if (targetId === "#pending-requests" || !targetId) {
      // Only refresh pending requests if on that tab
      await loadPendingLeaveRequests(forceRefresh);
    } else if (targetId === "#all-requests" && filterApplied) {
      // Only refresh all requests if on that tab and filter is applied
      await loadAllLeaveRequests(forceRefresh);
    }

    // Hide loading message
    const alertContainer = document.getElementById("alertContainer");
    if (alertContainer) {
      alertContainer.style.display = "none";
    }

    console.log("Data refreshed successfully");
  } catch (error) {
    console.error("Error refreshing data:", error);
    showAlert("danger", "Terjadi kesalahan saat memuat ulang data: " + error.message);
  }
}

// Optimized function to update a single leave request status
async function updateSingleLeaveStatus(id, newStatus) {
  try {
    await updateLeaveRequestStatus(id, newStatus);
    
    // Update local data
    const pendingIndex = pendingLeaves.findIndex(item => item.id === id);
    if (pendingIndex !== -1) {
      const updatedRecord = {...pendingLeaves[pendingIndex], status: newStatus};
      
      // Remove from pending
      pendingLeaves.splice(pendingIndex, 1);
      
      // If approved and matches current filter, add to allLeaves
      if (newStatus === "Disetujui" && filterApplied) {
        if (currentReplacementFilter === "Belum Diganti") {
          // By default, newly approved leaves have "Belum Diganti" status
          allLeaves.unshift(updatedRecord);
        }
      }
      
      // Update UI without full refresh
      updatePendingLeaveTable();
      if (filterApplied) updateLeaveHistoryTable();
      updateStats();
      
      return true;
    }
    
    // If not found in pending, check if it's in allLeaves
    const allIndex = allLeaves.findIndex(item => item.id === id);
    if (allIndex !== -1) {
      // Update status
      allLeaves[allIndex].status = newStatus;
      
      // Update UI
      updateLeaveHistoryTable();
      updateStats();
      
      return true;
    }
    
    // If we get here, we need to refresh data
    return false;
  } catch (error) {
    console.error("Error updating leave status:", error);
    throw error;
  }
}

// Optimized function to update replacement status
async function updateSingleReplacementStatus(id, newStatus, dayIndex = null) {
  try {
    await updateReplacementStatus(id, newStatus, dayIndex);
    
    // Find the record in allLeaves
    const recordIndex = allLeaves.findIndex(item => item.id === id);
    if (recordIndex !== -1) {
      const record = allLeaves[recordIndex];
      
      // Check if it's a multi-day leave
      const isMultiDay = record.leaveStartDate && record.leaveEndDate && 
                        record.leaveStartDate !== record.leaveEndDate;
      
      if (isMultiDay && dayIndex !== null) {
        // Update specific day in replacementStatusArray
        if (!record.replacementStatusArray) {
          const dayDiff = Math.ceil(
            (new Date(record.leaveEndDate) - new Date(record.leaveStartDate)) / (1000 * 60 * 60 * 24)
          ) + 1;
          record.replacementStatusArray = Array(dayDiff).fill("Belum Diganti");
        }
        
        record.replacementStatusArray[dayIndex] = newStatus;
        
        // Update overall status based on all days
        record.replacementStatus = record.replacementStatusArray.every(s => s === "Sudah Diganti") 
          ? "Sudah Diganti" 
          : "Belum Diganti";
      } else {
        // Update single-day status
        record.replacementStatus = newStatus;
      }
      
      // Check if record still matches filter
      const stillMatches = checkIfMatchesFilter(record);
      
      if (!stillMatches) {
        // Remove from current view if it no longer matches filter
        allLeaves.splice(recordIndex, 1);
      }
      
      // Update UI
      updateLeaveHistoryTable();
      updateStats();
      
      // Update session storage cache
      const cacheKey = `filter_${currentReplacementFilter}`;
      sessionStorage.setItem(cacheKey, JSON.stringify(allLeaves));
      
      return true;
    }
    
    // If record not found, we need to refresh data
    return false;
  } catch (error) {
    console.error("Error updating replacement status:", error);
    throw error;
  }
}

// Helper function to check if a record matches the current filter
function checkIfMatchesFilter(record) {
  if (!currentReplacementFilter) return true;
  
  const isMultiDay = record.leaveStartDate && record.leaveEndDate && 
                    record.leaveStartDate !== record.leaveEndDate;
  
  if (isMultiDay && record.replacementStatusArray) {
    if (currentReplacementFilter === "Sudah Diganti") {
      return record.replacementStatusArray.some(s => s === "Sudah Diganti");
    } else if (currentReplacementFilter === "Belum Diganti") {
      return record.replacementStatusArray.some(s => s === "Belum Diganti" || !s);
    }
  } else {
    if (currentReplacementFilter === "Belum Diganti") {
      return !record.replacementStatus || 
             record.replacementStatus === "" || 
             record.replacementStatus === "Belum Diganti";
    } else {
      return record.replacementStatus === currentReplacementFilter;
    }
  }
  
  return false;
}

// Setup refresh button
function setupRefreshButton() {
  const refreshButton = document.getElementById("refreshButton");
  if (refreshButton) {
    refreshButton.addEventListener("click", () => {
      // Force refresh from server
      refreshData(true);
    });
  }
}

// Fungsi untuk melihat surat keterangan sakit
function viewMedicalCertificate(fileInfo) {
  console.log("Viewing medical certificate:", fileInfo);
  
  if (!fileInfo || !fileInfo.url) {
    console.error("Invalid file info or missing URL:", fileInfo);
    showAlert("warning", "Tidak ada URL surat keterangan sakit yang tersedia");
    return;
  }

  try {
    const modalElement = document.getElementById("medicalCertModal");
    if (!modalElement) {
      console.error("Modal element not found");
      showAlert("error", "Terjadi kesalahan: Modal tidak ditemukan");
      return;
    }
    
    // Pastikan modal sebelumnya sudah dihapus dengan benar
    const existingModal = bootstrap.Modal.getInstance(modalElement);
    if (existingModal) {
      existingModal.dispose();
    }
    
    // Hapus backdrop yang mungkin masih ada
    document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
      backdrop.remove();
    });
    
    // Reset modal state
    modalElement.classList.remove('show');
    modalElement.style.display = 'none';
    modalElement.removeAttribute('aria-modal');
    modalElement.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('modal-open');
    
    // Buat instance modal baru
    const modal = new bootstrap.Modal(modalElement);
    const modalTitle = document.getElementById("medicalCertModalLabel");
    const modalBody = document.getElementById("medicalCertModalBody");
    
    modalTitle.textContent = "Surat Keterangan Sakit";
    
    // Clear previous content
    modalBody.innerHTML = "";
    
    // Tentukan jenis file berdasarkan tipe atau ekstensi
    const isImage = fileInfo.type?.startsWith("image/") || 
                    fileInfo.url.match(/\.(jpg|jpeg|png|gif)$/i);
    const isPdf = fileInfo.type === "application/pdf" || 
                  fileInfo.url.match(/\.pdf$/i);
    
    if (isImage) {
      console.log("Displaying image");
      const img = document.createElement("img");
      img.src = fileInfo.url;
      img.className = "img-fluid";
      img.alt = "Surat Keterangan Sakit";
      modalBody.appendChild(img);
    } else if (isPdf) {
      console.log("Displaying PDF");
      const embed = document.createElement("embed");
      embed.src = fileInfo.url;
      embed.type = "application/pdf";
      embed.width = "100%";
      embed.height = "500px";
      modalBody.appendChild(embed);
      
      const link = document.createElement("a");
      link.href = fileInfo.url;
      link.target = "_blank";
      link.className = "btn btn-primary mt-2";
      link.innerHTML = '<i class="fas fa-external-link-alt me-2"></i>Buka di Tab Baru';
      modalBody.appendChild(link);
    } else {
      console.log("Displaying download link for type:", fileInfo.type);
      const link = document.createElement("a");
      link.href = fileInfo.url;
      link.target = "_blank";
      link.className = "btn btn-primary";
      link.innerHTML = '<i class="fas fa-download me-2"></i>Unduh File';
      modalBody.appendChild(link);
    }
    
    // Tambahkan event listener untuk tombol tutup
    const closeButton = modalElement.querySelector('.btn-close');
    if (closeButton) {
      closeButton.addEventListener('click', function() {
        modal.hide();
        // Pastikan modal benar-benar dihapus
        setTimeout(() => {
          document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
            backdrop.remove();
          });
          document.body.classList.remove('modal-open');
          document.body.style.overflow = '';
          document.body.style.paddingRight = '';
        }, 150);
      });
    }
    
    // Tambahkan event listener untuk tombol tutup di footer
    const closeFooterButton = modalElement.querySelector('.modal-footer .btn-secondary');
    if (closeFooterButton) {
      closeFooterButton.addEventListener('click', function() {
        modal.hide();
        // Pastikan modal benar-benar dihapus
        setTimeout(() => {
          document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
            backdrop.remove();
          });
          document.body.classList.remove('modal-open');
          document.body.style.overflow = '';
          document.body.style.paddingRight = '';
        }, 150);
      });
    }
    
    // Tambahkan event listener untuk event hidden.bs.modal
    modalElement.addEventListener('hidden.bs.modal', function () {
      document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
        backdrop.remove();
      });
      document.body.classList.remove('modal-open');
      document.body.style.overflow = '';
      document.body.style.paddingRight = '';
    });
    
    modal.show();
  } catch (error) {
    console.error("Error showing modal:", error);
    showAlert("error", "Terjadi kesalahan saat menampilkan surat keterangan sakit: " + error.message);
  }
}

// Initialize page
document.addEventListener("DOMContentLoaded", () => {
   // Inisialisasi tampilan filter container berdasarkan tab aktif
   const activeTab = document.querySelector('.nav-link.active[data-bs-toggle="tab"]');
   if (activeTab) {
     const targetId = activeTab.getAttribute("data-bs-target");
     const filterContainer = document.getElementById("filterContainer");
     
     if (targetId === "#all-requests") {
       // Tampilkan filter container jika tab aktif adalah all-requests
       if (filterContainer) {
         filterContainer.classList.remove("d-none");
       }
     } else {
       // Sembunyikan filter container untuk tab lainnya
       if (filterContainer) {
         filterContainer.classList.add("d-none");
       }
     }
   }
   
   // Load initial data untuk pending requests saja
   loadPendingLeaveRequests();

// Setup tab change event to refresh data
const leaveRequestTabs = document.querySelectorAll('[data-bs-toggle="tab"]');
leaveRequestTabs.forEach((tab) => {
  tab.addEventListener("shown.bs.tab", function (event) {
    const targetId = event.target.getAttribute("data-bs-target");
    console.log("Tab changed to:", targetId);

    // Dapatkan container filter
    const filterContainer = document.getElementById("filterContainer");

    if (targetId === "#all-requests") {
      // Tampilkan filter container
      if (filterContainer) {
        filterContainer.classList.remove("d-none");
      }
      
      // Hanya muat data jika filter sudah diterapkan
      if (filterApplied) {
        loadAllLeaveRequests();
      }
    } else if (targetId === "#pending-requests") {
      // Sembunyikan filter container
      if (filterContainer) {
        filterContainer.classList.add("d-none");
      }
      
      // Check if data is stale (older than cache duration)
      const now = Date.now();
      if (!lastDataRefresh || (now - lastDataRefresh > CACHE_DURATION)) {
        loadPendingLeaveRequests(true);
      } else {
        // Just update the UI with existing data
        updatePendingLeaveTable();
      }
    }
  });
});

  // Setup filter button
  const applyFilterBtn = document.getElementById("applyFilterBtn");
  const replacementStatusFilter = document.getElementById("replacementStatusFilter");
  
  if (applyFilterBtn && replacementStatusFilter) {
    applyFilterBtn.addEventListener("click", function() {
      const selectedFilter = replacementStatusFilter.value;
      
      // Validasi filter
      if (!selectedFilter) {
        showAlert("warning", "Silakan pilih status penggantian terlebih dahulu", true);
        return;
      }
      
      // Check if filter has changed
      const filterChanged = currentReplacementFilter !== selectedFilter;
      
      // Set filter dan tandai bahwa filter sudah diterapkan
      currentReplacementFilter = selectedFilter;
      filterApplied = true;
      
      // Tampilkan loading message
      showAlert("info", '<i class="fas fa-sync fa-spin me-2"></i> Memuat data...', false);
      
      // Refresh data dengan filter baru jika filter berubah atau data sudah lama
      const now = Date.now();
      const dataIsStale = !lastDataRefresh || (now - lastDataRefresh > CACHE_DURATION);
      
      if (filterChanged || dataIsStale) {
        // Clear session storage for this filter
        const cacheKey = `filter_${currentReplacementFilter}`;
        sessionStorage.removeItem(cacheKey);
        
        loadAllLeaveRequests(true).then(() => {
          // Sembunyikan loading message setelah selesai
          const alertContainer = document.getElementById("alertContainer");
          if (alertContainer) {
            alertContainer.style.display = "none";
          }
          
          // Tampilkan pesan sukses
          showAlert("success", `Data berhasil difilter: ${selectedFilter}`, true);
        });
      } else {
        // Use cached data
        loadAllLeaveRequests(false).then(() => {
          // Sembunyikan loading message setelah selesai
          const alertContainer = document.getElementById("alertContainer");
          if (alertContainer) {
            alertContainer.style.display = "none";
          }
          
          // Tampilkan pesan sukses
          showAlert("success", `Data berhasil difilter: ${selectedFilter}`, true);
        });
      }
    });
  }

  // Setup search functionality
  const searchInput = document.getElementById("searchInput");
  const searchBtn = document.getElementById("searchBtn");

  if (searchInput && searchBtn) {
    // Debounce function to limit how often search is performed
    let searchTimeout;
    
    const performSearch = () => {
      const searchTerm = searchInput.value.toLowerCase().trim();

      if (searchTerm === "") {
        // If search is empty, reset tables
        updatePendingLeaveTable();
        updateLeaveHistoryTable();
        return;
      }

      // Filter pending leaves
      const filteredPending = pendingLeaves.filter(
        (record) =>
          (record.employeeId && record.employeeId.toLowerCase().includes(searchTerm)) ||
          (record.name && record.name.toLowerCase().includes(searchTerm))
      );

      // Update pending table with filtered results
      const pendingTbody = document.getElementById("pendingLeaveList");
      if (pendingTbody) {
        pendingTbody.innerHTML = "";

        if (filteredPending.length === 0) {
          pendingTbody.innerHTML =
            '<tr><td colspan="6" class="text-center">Tidak ada hasil yang sesuai dengan pencarian</td></tr>';
        } else {
          filteredPending.forEach((record) => {
            const replacementInfo = getReplacementInfo(record);
            const row = document.createElement("tr");

            // Format the leave date properly
            let formattedLeaveDate = record.leaveDate || record.date || "-";
            if (formattedLeaveDate instanceof Date) {
              formattedLeaveDate = formattedLeaveDate.toLocaleDateString("id-ID");
            } else if (typeof formattedLeaveDate === "object" && formattedLeaveDate !== null) {
              // Handle Timestamp or other date objects
              try {
                formattedLeaveDate = new Date(formattedLeaveDate.seconds * 1000).toLocaleDateString("id-ID");
              } catch (e) {
                console.warn("Could not format leave date:", e);
              }
            }

            // Tambahkan tombol untuk melihat surat keterangan sakit jika ada
            let medicalCertButton = "";
            if (
              record.leaveType === "sakit" &&
              record.replacementDetails &&
              record.replacementDetails.hasMedicalCertificate &&
              record.replacementDetails.medicalCertificateFile &&
              record.replacementDetails.medicalCertificateFile.url
            ) {
              medicalCertButton = `
                <button class="btn btn-sm btn-info view-cert-btn ms-2" data-id="${record.id}">
                  <i class="fas fa-file-medical me-1"></i> Lihat Surat
                </button>
              `;
            }

            row.innerHTML = `
            <td>${record.employeeId || "-"}</td>
            <td>${record.name || "-"}</td>
            <td>${formattedLeaveDate}</td>
            <td>${record.reason || "-"}</td>
            <td>${replacementInfo}</td>
            <td>
              <div class="action-buttons">
                <button class="approve-btn btn btn-success btn-sm" data-id="${record.id}">Setuju</button>
                <button class="reject-btn btn btn-danger btn-sm" data-id="${record.id}">Tolak</button>
                ${medicalCertButton}
              </div>
            </td>
          `;
            pendingTbody.appendChild(row);
          });
        }
      }

      // Filter all leaves
      const filteredAll = allLeaves.filter(
        (record) =>
          (record.employeeId && record.employeeId.toLowerCase().includes(searchTerm)) ||
          (record.name && record.name.toLowerCase().includes(searchTerm))
      );

      // Update all leaves table with filtered results
      const allTbody = document.getElementById("leaveHistoryList");
      if (allTbody) {
        allTbody.innerHTML = "";

        if (filteredAll.length === 0) {
          allTbody.innerHTML =
            '<tr><td colspan="8" class="text-center">Tidak ada hasil yang sesuai dengan pencarian</td></tr>';
        } else {
          filteredAll.forEach((record) => {
            // Check if it's a multi-day leave request
            const isMultiDay =
              record.leaveStartDate && record.leaveEndDate && record.leaveStartDate !== record.leaveEndDate;

            // Format the leave date properly
            let formattedLeaveDate = record.leaveDate || record.date || "-";
            if (formattedLeaveDate instanceof Date) {
              formattedLeaveDate = formattedLeaveDate.toLocaleDateString("id-ID");
            } else if (typeof formattedLeaveDate === "object" && formattedLeaveDate !== null) {
              // Handle Timestamp or other date objects
              try {
                formattedLeaveDate = new Date(formattedLeaveDate.seconds * 1000).toLocaleDateString("id-ID");
              } catch (e) {
                console.warn("Could not format leave date:", e);
              }
            }

            if (!isMultiDay) {
              const replacementInfo = getReplacementInfo(record);
              const row = document.createElement("tr");

              // Tentukan status ganti dan tombol yang sesuai
              const replacementStatus = record.replacementStatus || "Belum Diganti";
              const buttonText = replacementStatus === "Sudah Diganti" ? "Batalkan" : "Sudah Diganti";
              // Use btn-danger for "Batalkan" and btn-success for "Sudah Diganti"
              const buttonClass = replacementStatus === "Sudah Diganti" ? "btn-danger" : "btn-success";

              // Tambahkan tombol untuk melihat surat keterangan sakit jika ada
              let medicalCertButton = "";
              if (
                record.leaveType === "sakit" &&
                record.replacementDetails &&
                record.replacementDetails.hasMedicalCertificate &&
                record.replacementDetails.medicalCertificateFile &&
                record.replacementDetails.medicalCertificateFile.url
              ) {
                medicalCertButton = `
                  <button class="btn btn-sm btn-info view-cert-btn ms-1" data-id="${record.id}">
                    <i class="fas fa-file-medical"></i>
                  </button>
                `;
              }

              // Hanya tampilkan tombol aksi jika status pengajuan adalah Approved/Disetujui
              const actionButton =
                record.status === "Approved" || record.status === "Disetujui"
                  ? `<button class="replacement-status-btn ${buttonClass} btn-sm" data-id="${record.id}" data-status="${replacementStatus}">
                ${buttonText}
              </button>
              ${medicalCertButton}`
                  : medicalCertButton || "-";

              row.innerHTML = `
              <td>${record.employeeId || "-"}</td>
              <td>${record.name || "-"}</td>
              <td>${formattedLeaveDate}</td>
              <td>${record.reason || "-"}</td>
              <td>${replacementInfo}</td>
              <td class="status-${(record.status || "unknown").toLowerCase()}">${record.status || "Unknown"}</td>
              <td class="status-${(replacementStatus || "unknown").toLowerCase().replace(/\s+/g, "-")}">${
                replacementStatus || "Unknown"
              }</td>
              <td>${actionButton}</td>
            `;
              allTbody.appendChild(row);
            } else {
              // For multi-day leave, create multiple rows - one for each day
              const startDate = new Date(
                record.leaveStartDate instanceof Date
                  ? record.leaveStartDate
                  : record.leaveStartDate.seconds
                  ? new Date(record.leaveStartDate.seconds * 1000)
                  : record.leaveStartDate
              );
              const endDate = new Date(
                record.leaveEndDate instanceof Date
                  ? record.leaveEndDate
                  : record.leaveEndDate.seconds
                  ? new Date(record.leaveEndDate.seconds * 1000)
                  : record.leaveEndDate
              );
              const dayDiff = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;

              // Pastikan replacementStatusArray ada
              const replacementStatusArray = record.replacementStatusArray || Array(dayDiff).fill("Belum Diganti");

              // Tambahkan tombol untuk melihat surat keterangan sakit jika ada
              let medicalCertButton = "";
              if (
                record.leaveType === "sakit" &&
                record.replacementDetails &&
                record.replacementDetails.hasMedicalCertificate &&
                record.replacementDetails.medicalCertificateFile &&
                record.replacementDetails.medicalCertificateFile.url
              ) {
                medicalCertButton = `
                  <button class="btn btn-sm btn-info view-cert-btn ms-1" data-id="${record.id}">
                    <i class="fas fa-file-medical"></i>
                  </button>
                `;
              }

              // Buat baris untuk setiap hari
              for (let i = 0; i < dayDiff; i++) {
                const currentDate = new Date(startDate);
                currentDate.setDate(startDate.getDate() + i);

                const formattedDate = currentDate.toLocaleDateString("id-ID", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                });

                const row = document.createElement("tr");

                // Jika ini hari pertama, tambahkan kelas untuk styling
                if (i === 0) {
                  row.classList.add("first-day-row");
                }

                // Tentukan status ganti untuk hari ini
                const dayStatus = replacementStatusArray[i] || "Belum Diganti";
                const buttonText = dayStatus === "Sudah Diganti" ? "Batalkan" : "Sudah Diganti";
                // Use btn-danger for "Batalkan" and btn-success for "Sudah Diganti"
                const buttonClass = dayStatus === "Sudah Diganti" ? "btn-danger" : "btn-success";

                // Tampilkan informasi penggantian untuk hari ini
                let replacementInfo = "-";
                if (
                  record.replacementType === "libur" &&
                  record.replacementDetails &&
                  record.replacementDetails.dates
                ) {
                  // Jika ada tanggal pengganti spesifik untuk hari ini
                  if (record.replacementDetails.dates[i]) {
                    replacementInfo = `Ganti libur pada ${record.replacementDetails.dates[i].formattedDate}`;
                  }
                } else if (record.replacementType === "jam" && record.replacementDetails) {
                  replacementInfo = `Ganti ${record.replacementDetails.hours} jam pada ${record.replacementDetails.formattedDate}`;
                }

                // Hanya tampilkan tombol aksi jika status pengajuan adalah Approved/Disetujui
                let actionButton = "-";
                if (record.status === "Approved" || record.status === "Disetujui") {
                  actionButton = `<button class="replacement-status-btn ${buttonClass} btn-sm" data-id="${record.id}" data-status="${dayStatus}" data-day-index="${i}">
                  ${buttonText}
                </button>`;
                  
                  // Tambahkan tombol lihat surat hanya pada baris pertama
                  if (i === 0 && medicalCertButton) {
                    actionButton += medicalCertButton;
                  }
                } else if (i === 0 && medicalCertButton) {
                  // Jika tidak disetujui tapi ada surat keterangan sakit, tetap tampilkan tombol lihat surat di baris pertama
                  actionButton = medicalCertButton;
                }

                row.innerHTML = `
                <td>${record.employeeId || "-"}</td>
                <td>${record.name || "-"}</td>
                <td>${formattedDate} <span class="badge bg-info">Hari ${i + 1}/${dayDiff}</span></td>
                <td>${record.reason || "-"}</td>
                <td>${replacementInfo}</td>
                <td class="status-${(record.status || "unknown").toLowerCase()}">${record.status || "Unknown"}</td>
                <td class="status-${(dayStatus || "belum-diganti")
                  .toLowerCase()
                  .replace(/\s+/g, "-")}">${dayStatus}</td>
                <td>${actionButton}</td>
              `;

                allTbody.appendChild(row);
              }
            }
          });
        }
      }

      // Re-add event listeners after updating the tables
      addEventListenersToButtons();
    };
    
    searchBtn.addEventListener("click", function() {
      // Clear any pending search
      clearTimeout(searchTimeout);
      performSearch();
    });

    // Add event listener for Enter key with debounce
    searchInput.addEventListener("keyup", function(event) {
      if (event.key === "Enter") {
        // Clear any pending search
        clearTimeout(searchTimeout);
        performSearch();
      } else {
        // Debounce for typing
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(performSearch, 500);
      }
    });
  }
  
  // Setup refresh button
  setupRefreshButton();
});

// Function to add event listeners to all buttons
function addEventListenersToButtons() {
  // Add event listeners to approve/reject buttons
  document.querySelectorAll(".approve-btn").forEach((button) => {
    button.addEventListener("click", async function() {
      const id = this.getAttribute("data-id");
      try {
        // Show loading state
        this.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        this.disabled = true;

        // Try to update just this record
        const success = await updateSingleLeaveStatus(id, "Disetujui");
        
        if (!success) {
          // If local update failed, do a full refresh
          await refreshData(true);
        }

        // Show success message
        showAlert("success", "Pengajuan izin berhasil disetujui!");
      } catch (error) {
        console.error("Error approving leave request:", error);
        showAlert("danger", "Terjadi kesalahan saat menyetujui pengajuan izin.");

        // Reset button
        this.textContent = "Setuju";
        this.disabled = false;
      }
    });
  });

  document.querySelectorAll(".reject-btn").forEach((button) => {
    button.addEventListener("click", async function() {
      const id = this.getAttribute("data-id");
      try {
        // Show loading state
        this.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        this.disabled = true;

        // Try to update just this record
        const success = await updateSingleLeaveStatus(id, "Ditolak");
        
        if (!success) {
            // If local update failed, do a full refresh
            await refreshData(true);
          }
  
          // Show success message
          showAlert("success", "Pengajuan izin berhasil ditolak.");
        } catch (error) {
          console.error("Error rejecting leave request:", error);
          showAlert("danger", "Terjadi kesalahan saat menolak pengajuan izin.");
  
          // Reset button
          this.textContent = "Tolak";
          this.disabled = false;
        }
      });
    });
  
    // Add event listeners to replacement status buttons
    document.querySelectorAll(".replacement-status-btn").forEach((button) => {
      button.addEventListener("click", async function() {
        try {
          const id = this.getAttribute("data-id");
          const currentStatus = this.getAttribute("data-status");
          const dayIndex = this.getAttribute("data-day-index");
          const newStatus = currentStatus === "Sudah Diganti" ? "Belum Diganti" : "Sudah Diganti";
  
          // Show loading state
          this.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
          this.disabled = true;
  
          // Try to update just this record
          const success = await updateSingleReplacementStatus(id, newStatus, dayIndex !== null ? parseInt(dayIndex) : null);
          
          if (!success) {
            // If local update failed, do a full refresh
            await refreshData(true);
          }
  
          // Show success message
          showAlert("success", `Status ganti berhasil diubah menjadi "${newStatus}"`);
        } catch (error) {
          console.error("Error updating replacement status:", error);
          showAlert("danger", "Terjadi kesalahan saat mengubah status ganti: " + error.message);
  
          // Reset button
          const currentStatus = this.getAttribute("data-status");
          const buttonText = currentStatus === "Sudah Diganti" ? "Batalkan" : "Sudah Diganti";
          this.textContent = buttonText;
          this.disabled = false;
        }
      });
    });
    
    // Add event listeners to view certificate buttons
    document.querySelectorAll(".view-cert-btn").forEach((button) => {
      button.addEventListener("click", function() {
        const id = this.getAttribute("data-id");
        
        // First check in pendingLeaves
        let record = pendingLeaves.find((item) => item.id === id);
        
        // If not found, check in allLeaves
        if (!record) {
          record = allLeaves.find((item) => item.id === id);
        }
        
        if (record && record.replacementDetails && record.replacementDetails.medicalCertificateFile) {
          console.log("Viewing medical certificate for record:", id);
          console.log("Certificate data:", record.replacementDetails.medicalCertificateFile);
          viewMedicalCertificate(record.replacementDetails.medicalCertificateFile);
        } else {
          // If not found in local data, try to fetch from server
          getLeaveRequestById(id)
            .then(fetchedRecord => {
              if (fetchedRecord && fetchedRecord.replacementDetails && fetchedRecord.replacementDetails.medicalCertificateFile) {
                viewMedicalCertificate(fetchedRecord.replacementDetails.medicalCertificateFile);
              } else {
                showAlert("warning", "Tidak ada surat keterangan sakit yang tersedia");
              }
            })
            .catch(error => {
              console.error("Error fetching leave request:", error);
              showAlert("warning", "Tidak dapat mengambil data surat keterangan sakit");
            });
        }
      });
    });
  }
        

