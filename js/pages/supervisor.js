import {
  getPendingLeaveRequests,
  getAllLeaveRequests,
  updateLeaveRequestStatus,
  updateReplacementStatus,
  clearLeaveCache,
} from "../services/leave-service.js";

// Initialize data
let pendingLeaves = [];
let allLeaves = [];

// Fungsi untuk memuat pengajuan izin yang menunggu persetujuan
async function loadPendingLeaveRequests() {
  try {
    const tbody = document.getElementById("pendingLeaveList");
    if (tbody) {
      // Start with empty table instead of loading message
      tbody.innerHTML = "";
    }

    console.log("Fetching all leave requests to filter pending ones...");
    
    // Dapatkan semua pengajuan izin
    const allRequests = await getAllLeaveRequests();
    console.log("Total leave requests:", allRequests.length);
    
    // Filter secara manual untuk mendapatkan yang menunggu persetujuan
    pendingLeaves = allRequests.filter(request => {
      return request.status === "Menunggu Persetujuan";
    });
    
    console.log("Filtered pending leave requests:", pendingLeaves);
    console.log("Number of pending requests:", pendingLeaves.length);

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

// Fungsi untuk mengambil data pengajuan izin yang menunggu persetujuan
async function fetchPendingLeaves() {
  try {
    // Tampilkan loading state
    const loadingIndicator = document.getElementById("pendingLoadingIndicator");
    if (loadingIndicator) loadingIndicator.style.display = "block";

    // Ambil data dari Firebase
    const pendingLeaves = await getLeaveRequestsByStatus("Menunggu Persetujuan");

    console.log("Data pengajuan yang diambil:", pendingLeaves); // Debugging

    // Update tabel
    updatePendingLeaveTable(pendingLeaves);

    // Sembunyikan loading state
    if (loadingIndicator) loadingIndicator.style.display = "none";
  } catch (error) {
    console.error("Error fetching pending leaves:", error);
    showAlert("error", "Gagal memuat data pengajuan izin");

    // Sembunyikan loading state
    const loadingIndicator = document.getElementById("pendingLoadingIndicator");
    if (loadingIndicator) loadingIndicator.style.display = "none";
  }
}
// Load all leave requests
async function loadAllLeaveRequests() {
  try {
    const tbody = document.getElementById("leaveHistoryList");
    if (tbody) {
      tbody.innerHTML =
        '<tr><td colspan="9" class="text-center"><i class="fas fa-spinner fa-spin me-2"></i> Memuat data...</td></tr>';
    }

    console.log("Fetching all leave requests...");
    allLeaves = await getAllLeaveRequests();
    console.log("All leave requests:", allLeaves); // Debug log

    if (!allLeaves || allLeaves.length === 0) {
      if (tbody) {
        tbody.innerHTML = '<tr><td colspan="9" class="text-center">Belum ada data pengajuan izin</td></tr>';
      }

      // Show empty state if exists
      const emptyState = document.getElementById("emptyAllRequests");
      if (emptyState) emptyState.style.display = "flex";
    } else {
      // Hide empty state if exists
      const emptyState = document.getElementById("emptyAllRequests");
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
  
  console.log("Sorted pending leaves:", sortedLeaves);
  
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
        await refreshData();

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
        await refreshData();

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

  // Add event listeners to replacement status buttons
  document.querySelectorAll(".replacement-status-btn").forEach((button) => {
    button.addEventListener("click", async function () {
      try {
        const id = this.getAttribute("data-id");
        const currentStatus = this.getAttribute("data-status");
        const dayIndex = this.getAttribute("data-day-index");
        const newStatus = currentStatus === "Sudah Diganti" ? "Belum Diganti" : "Sudah Diganti";

        // Show loading state
        this.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        this.disabled = true;

        // Jika ada dayIndex, update status untuk hari tertentu
        if (dayIndex !== null) {
          await updateReplacementStatus(id, newStatus, parseInt(dayIndex));
        } else {
          await updateReplacementStatus(id, newStatus);
        }

        await refreshData();

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

// Update stats cards
function updateStats() {
  // Count total requests
  const totalRequests = pendingLeaves.length + allLeaves.length;
  document.getElementById("totalRequests").textContent = totalRequests;

  // Count approved requests
  const approvedRequests = allLeaves.filter((item) => item.status === "Approved" || item.status === "Disetujui").length;
  document.getElementById("approvedRequests").textContent = approvedRequests;

  // Count rejected requests
  const rejectedRequests = allLeaves.filter((item) => item.status === "Rejected" || item.status === "Ditolak").length;
  document.getElementById("rejectedRequests").textContent = rejectedRequests;

  // Count pending requests
  document.getElementById("pendingRequests").textContent = pendingLeaves.length;

  // Count multi-day leave requests
  const multiDayRequests = allLeaves.filter(
    (item) => item.leaveStartDate && item.leaveEndDate && item.leaveStartDate !== item.leaveEndDate
  ).length;

  // Count replaced status
  const replacedRequests = allLeaves.filter((item) => item.replacementStatus === "Sudah Diganti").length;

  console.log(
    `Stats updated: Total=${totalRequests}, Approved=${approvedRequests}, Rejected=${rejectedRequests}, Pending=${pendingLeaves.length}, Multi-day=${multiDayRequests}, Replaced=${replacedRequests}`
  );
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

// Refresh all data
async function refreshData() {
  try {
    // Reset data arrays
    pendingLeaves = [];
    allLeaves = [];
    
    // Clear cache to ensure fresh data
    clearLeaveCache();
    
    // Show loading message
    showAlert("info", '<i class="fas fa-sync fa-spin me-2"></i> Memperbarui data...', false);

    // Load data in parallel
    await Promise.all([loadPendingLeaveRequests(), loadAllLeaveRequests()]);

    // Hide loading message
    const alertContainer = document.getElementById("alertContainer");
    if (alertContainer) {
      alertContainer.style.display = "none";
    }

    console.log("Data refreshed successfully");
    console.log("Pending leaves:", pendingLeaves.length);
    console.log("All leaves:", allLeaves.length);
  } catch (error) {
    console.error("Error refreshing data:", error);
    showAlert("danger", "Terjadi kesalahan saat memuat ulang data: " + error.message);
  }
}


// Setup refresh button
function setupRefreshButton() {
  const refreshButton = document.getElementById("refreshButton");
  if (refreshButton) {
    refreshButton.addEventListener("click", () => {
      refreshData();
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
  // Load initial data
  refreshData();

  // Setup refresh button
  setupRefreshButton();

  // Setup tab change event to refresh data
  const leaveRequestTabs = document.querySelectorAll('[data-bs-toggle="tab"]');
  leaveRequestTabs.forEach((tab) => {
    tab.addEventListener("shown.bs.tab", function (event) {
      const targetId = event.target.getAttribute("data-bs-target");
      console.log("Tab changed to:", targetId);

      if (targetId === "#all-requests") {
        // Refresh all requests when switching to the tab
        loadAllLeaveRequests();
      } else if (targetId === "#pending-requests") {
        // Refresh pending requests when switching to the tab
        loadPendingLeaveRequests();
      }
    });
  });
  // Setup search functionality
  const searchInput = document.getElementById("searchInput");
  const searchBtn = document.getElementById("searchBtn");

  if (searchInput && searchBtn) {
    searchBtn.addEventListener("click", function () {
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

              // Hanya tampilkan tombol aksi jika status pengajuan adalah Approved/Disetujui
              const actionButton =
                record.status === "Approved" || record.status === "Disetujui"
                  ? `<button class="replacement-status-btn ${buttonClass} btn-sm" data-id="${record.id}" data-status="${replacementStatus}">
                ${buttonText}
              </button>`
                  : "-";

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
                const actionButton =
                  record.status === "Approved" || record.status === "Disetujui"
                    ? `<button class="replacement-status-btn ${buttonClass} btn-sm" data-id="${record.id}" data-status="${dayStatus}" data-day-index="${i}">
                  ${buttonText}
                </button>`
                    : "-";

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
    });

    // Add event listener for Enter key
    searchInput.addEventListener("keyup", function (event) {
      if (event.key === "Enter") {
        searchBtn.click();
      }
    });
  }
});

// Function to add event listeners to all buttons
function addEventListenersToButtons() {
  // Existing code...
  
  // Add event listeners to approve/reject buttons
  document.querySelectorAll(".approve-btn").forEach((button) => {
    button.addEventListener("click", async function() {
      const id = this.getAttribute("data-id");
      try {
        // Show loading state
        this.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        this.disabled = true;

        await updateLeaveRequestStatus(id, "Disetujui");
        await refreshData();

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
        await refreshData();

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

        // Jika ada dayIndex, update status untuk hari tertentu
        if (dayIndex !== null) {
          await updateReplacementStatus(id, newStatus, parseInt(dayIndex));
        } else {
          await updateReplacementStatus(id, newStatus);
        }

        await refreshData();

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
      const record = [...pendingLeaves, ...allLeaves].find((item) => item.id === id);
      
      if (record && record.replacementDetails && record.replacementDetails.medicalCertificateFile) {
        console.log("Viewing medical certificate for record:", id);
        console.log("Certificate data:", record.replacementDetails.medicalCertificateFile);
        viewMedicalCertificate(record.replacementDetails.medicalCertificateFile);
      } else {
        showAlert("warning", "Tidak ada surat keterangan sakit yang tersedia");
      }
    });
  });
}

