import { 
    getEmployees, 
    addEmployee, 
    deleteEmployee, 
    updateEmployee, 
    getNextEmployeeId, 
    getNextBarcode,
    refreshEmployeeCache,
    saveFaceDescriptor,
    deleteFaceDescriptor,
    getFaceDescriptor
  } from '../services/employee-service.js';
  import { db } from "../configFirebase.js";
  import { collection, getDocs } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-firestore.js";
  
  // Initialize data
  let employees = [];
  let currentUserId = null;
  let lastCacheRefresh = 0;
  
  // Tambahkan variabel global untuk face-api
  let faceDetectionNet;
  let faceLandmarkNet;
  let faceRecognitionNet;
  let isFaceApiInitialized = false;
  let captureStream = null;
  
  // Tambahkan cache global untuk face descriptors
  let faceDescriptorCache = new Map();
  
  // Fungsi untuk memuat model face-api.js
  async function initFaceApi() {
    if (isFaceApiInitialized) return true;
  
    try {
      showNotification("info", "Memuat model pengenalan wajah...");
      const MODEL_URL = "js/face-api/models";
  
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
      ]);
  
      isFaceApiInitialized = true;
      showNotification("success", "Model pengenalan wajah berhasil dimuat");
      return true;
    } catch (error) {
      console.error("Error loading face-api models:", error);
      showNotification("error", "Gagal memuat model pengenalan wajah");
      return false;
    }
  }
  
  // Fungsi untuk memulai capture wajah
  async function startFaceCapture() {
    try {
      if (!isFaceApiInitialized) {
        const initialized = await initFaceApi();
        if (!initialized) return;
      }
  
      const video = document.getElementById("faceVideo");
      const statusElement = document.getElementById("faceDetectionStatus");
  
      this.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Menyiapkan...';
      this.disabled = true;
  
      captureStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: "user",
        },
      });
  
      video.srcObject = captureStream;
  
      video.onloadedmetadata = () => {
        document.getElementById("captureFace").disabled = false;
        document.getElementById("startCamera").innerHTML = '<i class="fas fa-camera"></i> Kamera Aktif';
        detectFace(video, statusElement);
      };
    } catch (error) {
      console.error("Error starting camera:", error);
      showNotification("error", "Gagal mengakses kamera. Pastikan kamera terhubung dan izin diberikan.");
      this.innerHTML = '<i class="fas fa-camera"></i> Mulai Kamera';
      this.disabled = false;
    }
  }
  
  // Fungsi untuk mendeteksi wajah secara real-time
  async function detectFace(videoElement, statusElement) {
    if (!videoElement || !statusElement) return;
  
    const canvas = document.getElementById("faceCanvas");
    const context = canvas.getContext("2d");
    const previewCanvas = document.getElementById("facePreview");
    const previewContext = previewCanvas.getContext("2d");
  
    canvas.width = videoElement.videoWidth;
    canvas.height = videoElement.videoHeight;
  
    async function detect() {
      if (!captureStream) return;
  
      try {
        const detections = await faceapi
          .detectAllFaces(videoElement, new faceapi.TinyFaceDetectorOptions())
          .withFaceLandmarks()
          .withFaceDescriptors();
  
        context.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
  
        if (detections.length === 0) {
          statusElement.textContent = "Tidak ada wajah terdeteksi. Posisikan wajah di depan kamera.";
          statusElement.className = "text-warning";
          document.getElementById("captureFace").disabled = true;
          document.querySelector(".face-preview-container").style.display = "none";
        } else if (detections.length > 1) {
          statusElement.textContent = "Terdeteksi lebih dari satu wajah. Pastikan hanya ada satu wajah.";
          statusElement.className = "text-danger";
          document.getElementById("captureFace").disabled = true;
          document.querySelector(".face-preview-container").style.display = "none";
        } else {
          statusElement.textContent = "Wajah terdeteksi! Klik 'Simpan Wajah' untuk menyimpan.";
          statusElement.className = "text-success";
          document.getElementById("captureFace").disabled = false;
  
          const detection = detections[0];
          const box = detection.detection.box;
  
          document.querySelector(".face-preview-container").style.display = "block";
  
          const faceImg = context.getImageData(box.x, box.y, box.width, box.height);
  
          previewCanvas.width = 150;
          previewCanvas.height = 150;
  
          previewContext.putImageData(faceImg, 0, 0, 0, 0, Math.min(faceImg.width, 150), Math.min(faceImg.height, 150));
        }
  
        requestAnimationFrame(detect);
      } catch (error) {
        console.error("Error in face detection:", error);
        statusElement.textContent = "Terjadi kesalahan saat deteksi wajah.";
        statusElement.className = "text-danger";
      }
    }
  
    detect();
  }
  
  // Fungsi untuk menghentikan capture
  function stopFaceCapture() {
    if (captureStream) {
      captureStream.getTracks().forEach((track) => track.stop());
      captureStream = null;
    }
  
    const video = document.getElementById("faceVideo");
    if (video) video.srcObject = null;
  
    const startButton = document.getElementById("startCamera");
    if (startButton) {
      startButton.innerHTML = '<i class="fas fa-camera"></i> Mulai Kamera';
      startButton.disabled = false;
    }
  
    const captureButton = document.getElementById("captureFace");
    if (captureButton) captureButton.disabled = true;
  
    const previewContainer = document.querySelector(".face-preview-container");
    if (previewContainer) previewContainer.style.display = "none";
  }
  
  // Fungsi untuk mengambil dan menyimpan wajah
  async function captureAndSaveFace() {
    try {
      const modal = document.getElementById("faceRegistrationModal");
      const employeeId = modal.dataset.employeeId;
      const barcode = modal.dataset.barcode;
  
      const video = document.getElementById("faceVideo");
      const statusElement = document.getElementById("faceDetectionStatus");
  
      this.disabled = true;
      this.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Menyimpan...';
  
      const detections = await faceapi
        .detectAllFaces(video, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks()
        .withFaceDescriptors();
  
      if (detections.length === 0) {
        statusElement.textContent = "Tidak ada wajah terdeteksi. Coba lagi.";
        statusElement.className = "text-warning";
        this.disabled = false;
        this.innerHTML = '<i class="fas fa-save"></i> Simpan Wajah';
        return;
      }
  
      if (detections.length > 1) {
        statusElement.textContent = "Terdeteksi lebih dari satu wajah. Pastikan hanya ada satu wajah.";
        statusElement.className = "text-danger";
        this.disabled = false;
        this.innerHTML = '<i class="fas fa-save"></i> Simpan Wajah';
        return;
      }
  
      const faceDescriptor = detections[0].descriptor;
  
      await saveFaceDescriptor(employeeId, faceDescriptor);
  
      // Update cache setelah simpan
      faceDescriptorCache.set(employeeId, true);
  
      showNotification("success", "Data wajah berhasil disimpan!");
  
      const bsModal = bootstrap.Modal.getInstance(modal);
      bsModal.hide();
  
      updateFaceRegistrationStatus(employeeId, true);
    } catch (error) {
      console.error("Error capturing and saving face:", error);
      showNotification("error", "Gagal menyimpan data wajah: " + error.message);
  
      this.disabled = false;
      this.innerHTML = '<i class="fas fa-save"></i> Simpan Wajah';
    }
  }
  
  // Fungsi untuk menampilkan modal pendaftaran/edit wajah
  async function showFaceRegistrationModal(employeeId, employeeName, barcode) {
    let faceModal = document.getElementById('faceRegistrationModal');
    
    if (!faceModal) {
      const modalHtml = `
        <div class="modal fade" id="faceRegistrationModal" tabindex="-1" aria-labelledby="faceRegistrationModalLabel" aria-hidden="true">
          <div class="modal-dialog modal-dialog-centered">
            <div class="modal-content">
              <div class="modal-header">
                <h5 class="modal-title" id="faceRegistrationModalLabel">Daftarkan/Edit Wajah Karyawan</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
              </div>
              <div class="modal-body">
                <div class="employee-info mb-3">
                  <p><strong>Nama:</strong> <span id="faceEmployeeName"></span></p>
                  <p><strong>ID:</strong> <span id="faceEmployeeId"></span></p>
                </div>
                <div class="face-capture-container">
                  <video id="faceVideo" width="100%" autoplay muted></video>
                  <canvas id="faceCanvas" width="400" height="300" style="display:none;"></canvas>
                  <div id="faceDetectionStatus" class="mt-2 text-center">Siapkan kamera...</div>
                </div>
                <div class="face-preview-container mt-3" style="display:none;">
                  <h6>Preview Wajah Terdeteksi:</h6>
                  <canvas id="facePreview" width="150" height="150"></canvas>
                </div>
              </div>
              <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Batal</button>
                <button type="button" class="btn btn-primary" id="startCamera">
                  <i class="fas fa-camera"></i> Mulai Kamera
                </button>
                <button type="button" class="btn btn-success" id="captureFace" disabled>
                  <i class="fas fa-save"></i> Simpan Wajah
                </button>
                <button type="button" class="btn btn-danger" id="deleteFace" style="display:none;">
                  <i class="fas fa-trash"></i> Hapus Data Wajah
                </button>
              </div>
            </div>
          </div>
        </div>
      `;
      
      document.body.insertAdjacentHTML('beforeend', modalHtml);
      faceModal = document.getElementById('faceRegistrationModal');
    }
    
    document.getElementById('faceEmployeeName').textContent = employeeName;
    document.getElementById('faceEmployeeId').textContent = employeeId;
    
    faceModal.dataset.barcode = barcode;
    faceModal.dataset.employeeId = employeeId;
    
    document.getElementById('startCamera').addEventListener('click', startFaceCapture);
    document.getElementById('captureFace').addEventListener('click', captureAndSaveFace);
    
    const deleteButton = document.getElementById('deleteFace');
    deleteButton.addEventListener('click', async function() {
      try {
        if (confirm('Apakah Anda yakin ingin menghapus data wajah karyawan ini?')) {
          await deleteFaceDescriptor(employeeId);
          faceDescriptorCache.delete(employeeId); // Update cache
          showNotification("success", "Data wajah berhasil dihapus!");
          updateFaceRegistrationStatus(employeeId, false);
          
          const bsModal = bootstrap.Modal.getInstance(faceModal);
          bsModal.hide();
        }
      } catch (error) {
        console.error("Error deleting face data:", error);
        showNotification("error", "Gagal menghapus data wajah: " + error.message);
      }
    });
    
    // Gunakan cache untuk cek status pendaftaran wajah
    const isRegistered = faceDescriptorCache.has(employeeId);
    if (isRegistered) {
      deleteButton.style.display = 'block';
      document.getElementById('faceRegistrationModalLabel').textContent = 'Edit Wajah Karyawan';
    } else {
      deleteButton.style.display = 'none';
      document.getElementById('faceRegistrationModalLabel').textContent = 'Daftarkan Wajah Karyawan';
    }
    
    faceModal.addEventListener('hidden.bs.modal', stopFaceCapture);
    
    const modal = new bootstrap.Modal(faceModal);
    modal.show();
  }
  
  // Fungsi untuk memperbarui status pendaftaran wajah di UI
  function updateFaceRegistrationStatus(employeeId, isRegistered) {
    const rows = document.querySelectorAll("#staffList tr");
  
    for (const row of rows) {
      const actionCell = row.querySelector("td:last-child");
      const editButton = actionCell.querySelector(".edit-staff");
  
      if (editButton && editButton.getAttribute("data-id") === employeeId) {
        let faceBadge = actionCell.querySelector(".face-badge");
  
        if (isRegistered) {
          if (!faceBadge) {
            faceBadge = document.createElement("span");
            faceBadge.className = "badge bg-success face-badge ms-1";
            faceBadge.innerHTML = '<i class="fas fa-check"></i> Wajah Terdaftar';
            actionCell.insertBefore(faceBadge, editButton);
          } else {
            faceBadge.className = "badge bg-success face-badge ms-1";
            faceBadge.innerHTML = '<i class="fas fa-check"></i> Wajah Terdaftar';
          }
        } else if (faceBadge) {
          faceBadge.remove();
        }
  
        break;
      }
    }
  }
  
  // Fungsi untuk memeriksa status pendaftaran wajah dan update cache + UI
  async function checkFaceRegistrationStatus() {
    try {
      const snapshot = await getDocs(collection(db, "employeeFaces"));
  
      faceDescriptorCache.clear();
  
      snapshot.forEach((doc) => {
        if (doc.data().faceDescriptor) {
          faceDescriptorCache.set(doc.id, true);
        }
      });
  
      employees.forEach((employee) => {
        updateFaceRegistrationStatus(employee.id, faceDescriptorCache.has(employee.id));
      });
    } catch (error) {
      console.error("Error checking face registration status:", error);
    }
  }
  
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
        margin: 5,
      });
    } catch (error) {
      console.error("Error generating barcode:", error);
    }
  }
  
  // Fungsi download semua barcode (tetap sama)
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
            const container = document.createElement("div");
            container.style.backgroundColor = "white";
            container.style.padding = "10px";
            container.style.textAlign = "center";
            container.style.width = "200px";
            container.style.display = "inline-block";
    
            // Clone barcode element
            const barcodeClone = barcodeElement.cloneNode(true);
            container.appendChild(barcodeClone);
    
            // Tambahkan nama karyawan
            const nameElement = document.createElement("div");
            nameElement.style.marginTop = "10px";
            nameElement.style.fontWeight = "bold";
            nameElement.style.fontSize = "14px";
            nameElement.textContent = employee.name;
            container.appendChild(nameElement);
    
            // Tambahkan ke body sementara untuk dirender
            document.body.appendChild(container);
    
            // Gunakan html2canvas untuk mengambil screenshot dari container
            const canvas = await html2canvas(container, {
              backgroundColor: "#ffffff",
              scale: 2, // Higher resolution
            });
    
            // Hapus container sementara
            document.body.removeChild(container);
    
            // Konversi canvas ke blob
            const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
    
            // Tambahkan ke zip
            const fileName = `barcode_${employee.name.replace(/\s+/g, "_")}.png`;
            barcodeFolder.file(fileName, blob);
    
            // Update notifikasi
            if (i % 5 === 0 || i === employees.length - 1) {
              showNotification("info", `Memproses barcode ${i + 1} dari ${employees.length}...`);
            }
          } catch (err) {
            console.error(`Error processing barcode for ${employee.name}:`, err);
            continue; // Lanjutkan ke barcode berikutnya jika ada error
          }
    
          // Berikan waktu browser untuk "bernapas"
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
    
        // Generate dan download zip file
        showNotification("info", "Membuat file zip...");
        const content = await zip.generateAsync({
          type: "blob",
          compression: "DEFLATE",
          compressionOptions: {
            level: 6, // Level kompresi sedang
          },
        });
    
        saveAs(content, "all_barcodes.zip");
        showNotification("success", "Semua barcode berhasil didownload!");
      } catch (error) {
        console.error("Error downloading all barcodes:", error);
        showNotification("error", `Gagal mendownload semua barcode: ${error.message}`);
      }
  }
  
  // Fungsi untuk mengisi ID dan barcode otomatis
  async function populateAutoFields() {
    try {
      const nextId = await getNextEmployeeId();
      const nextBarcode = await getNextBarcode();
  
      document.getElementById("staffId").value = nextId;
      document.getElementById("staffBarcode").value = nextBarcode;
    } catch (error) {
      console.error("Error populating auto fields:", error);
      showNotification("error", "Gagal menghasilkan ID otomatis");
    }
  }
  
  // Load employees with cache consideration
  async function loadEmployees(forceRefresh = false) {
    try {
      const now = new Date().getTime();
      if (now - lastCacheRefresh > 3600000) {
        forceRefresh = true;
        lastCacheRefresh = now;
      }
  
      employees = await getEmployees(forceRefresh);
      updateStaffTable();
  
      // Panggil sekali untuk update cache face descriptor dan UI
      await checkFaceRegistrationStatus();
    } catch (error) {
      console.error("Error loading employees:", error);
      showNotification("error", "Gagal memuat data karyawan");
    }
  }
  
  // Modifikasi fungsi updateStaffTable (tetap sama)
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
        <button class="btn btn-sm btn-outline-info register-face" data-id="${employee.id}" data-name="${employee.name}" data-barcode="${employee.barcode}" data-bs-toggle="tooltip" title="Daftarkan/Edit Wajah">
          <i class="fas fa-camera"></i>
        </button>
        <!-- Tambahkan tombol download barcode individual -->
        <button class="btn btn-sm btn-outline-success download-barcode" data-id="${employee.id}" data-name="${employee.name}" data-barcode="${employee.barcode}" data-bs-toggle="tooltip" title="Download Barcode">
          <i class="fas fa-download"></i>
        </button>
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
  
  // Periksa status pendaftaran wajah
  checkFaceRegistrationStatus();
  }
  
  // Helper function to format employee type
  function formatEmployeeType(type) {
    return type === "staff" ? "Staff" : "Office Boy";
  }
  
  // Setup event listeners (tetap sama)
  function setupEventListeners() {
    // Add form submission handler
      document.getElementById("staffForm")?.addEventListener("submit", handleAddEmployee);
    
      // Filter by employee type
      document.querySelectorAll("[data-employee-filter]").forEach((item) => {
        item.addEventListener("click", function (e) {
          e.preventDefault();
          const filter = this.dataset.employeeFilter;
          filterEmployees("type", filter);
        });
      });
    
      // Tambahkan event listener untuk tombol refresh ID dan barcode
      document.querySelector(".refresh-id")?.addEventListener("click", async function () {
        try {
          const nextId = await getNextEmployeeId();
          document.getElementById("staffId").value = nextId;
        } catch (error) {
          console.error("Error refreshing ID:", error);
        }
      });
    
      document.querySelector(".refresh-barcode")?.addEventListener("click", async function () {
        try {
          const nextBarcode = await getNextBarcode();
          document.getElementById("staffBarcode").value = nextBarcode;
        } catch (error) {
          console.error("Error refreshing barcode:", error);
        }
      });
      // Tambahkan event listener untuk tombol refresh status wajah
      document.getElementById("refreshFaceStatus")?.addEventListener("click", function () {
        this.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        this.disabled = true;
    
        checkFaceRegistrationStatus().finally(() => {
          this.innerHTML = '<i class="fas fa-sync-alt"></i>';
          this.disabled = false;
          showNotification("success", "Status pendaftaran wajah diperbarui");
        });
      });
      // Tambahkan event listener untuk download semua barcode
      document.getElementById("downloadAllBarcodes")?.addEventListener("click", downloadAllBarcodes);
      // Export users
      document.getElementById("exportUsers")?.addEventListener("click", exportUsersToExcel);
    
      // Save user changes in edit modal
      document.getElementById("saveUserChanges")?.addEventListener("click", handleUpdateEmployee);
    
      // Confirm delete
      document.getElementById("confirmDelete")?.addEventListener("click", handleConfirmDelete);
  }
  
  // Add event listeners to action buttons (tetap sama)
  function addActionButtonListeners() {
    // Edit button
  document.querySelectorAll(".edit-staff").forEach((button) => {
    button.addEventListener("click", handleEditClick);
  });

  // Delete button
  document.querySelectorAll(".delete-staff").forEach((button) => {
    button.addEventListener("click", handleDeleteClick);
  });

  // Register face button
  document.querySelectorAll(".register-face").forEach((button) => {
    button.addEventListener("click", function () {
      const id = this.getAttribute("data-id");
      const name = this.getAttribute("data-name");
      const barcode = this.getAttribute("data-barcode");

      showFaceRegistrationModal(id, name, barcode);
    });
  });
   // Tambahkan event listener untuk tombol download barcode individual
   document.querySelectorAll(".download-barcode").forEach((button) => {
    button.addEventListener("click", function() {
      const id = this.getAttribute("data-id");
      const name = this.getAttribute("data-name");
      
      downloadSingleBarcode(id, name);
    });
  });
  }
  
  // Fungsi download barcode individual (tetap sama)
  async function downloadSingleBarcode(employeeId, employeeName) {
    try {
        showNotification("info", `Memproses barcode untuk ${employeeName}...`);
        
        // Cari karyawan berdasarkan ID
        const employee = employees.find(emp => emp.id === employeeId);
        if (!employee) {
          showNotification("error", "Karyawan tidak ditemukan");
          return;
        }
        
        // Ambil elemen barcode
        const barcodeId = `barcode-${employeeId}`;
        const barcodeElement = document.getElementById(barcodeId);
        
        if (!barcodeElement) {
          showNotification("error", "Barcode tidak ditemukan");
          return;
        }
        
        // Buat container sementara untuk menggabungkan barcode dan nama
        const container = document.createElement('div');
        container.style.backgroundColor = 'white';
        container.style.padding = '20px';
        container.style.textAlign = 'center';
        container.style.width = '300px';
        container.style.display = 'inline-block';
        container.style.borderRadius = '8px';
        container.style.boxShadow = '0 2px 5px rgba(0,0,0,0.1)';
        
        // // Tambahkan judul
        // const titleElement = document.createElement('h4');
        // titleElement.style.marginBottom = '15px';
        // titleElement.style.color = '#333';
        // titleElement.textContent = 'Barcode Karyawan';
        // container.appendChild(titleElement);
        
        // Tambahkan nama karyawan
        const nameElement = document.createElement('div');
        nameElement.style.marginBottom = '5px';
        nameElement.style.fontWeight = 'bold';
        nameElement.style.fontSize = '18px';
        nameElement.textContent = employee.name;
        container.appendChild(nameElement);
        
        // // Tambahkan ID karyawan
        // const idElement = document.createElement('div');
        // idElement.style.marginBottom = '15px';
        // idElement.style.fontSize = '14px';
        // idElement.style.color = '#666';
        // idElement.textContent = `ID: ${employee.employeeId}`;
        // container.appendChild(idElement);
        
        // Clone barcode element
        const barcodeClone = barcodeElement.cloneNode(true);
        barcodeClone.style.width = '100%';
        barcodeClone.style.height = '80px';
        container.appendChild(barcodeClone);
        
        // // Tambahkan nomor barcode
        // const barcodeNumberElement = document.createElement('div');
        // barcodeNumberElement.style.marginTop = '10px';
        // barcodeNumberElement.style.fontSize = '14px';
        // barcodeNumberElement.textContent = employee.barcode;
        // container.appendChild(barcodeNumberElement);
        
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
        
        // Download file
        const fileName = `barcode_${employee.name.replace(/\s+/g, '_')}.png`;
        saveAs(blob, fileName);
        
        showNotification("success", `Barcode untuk ${employee.name} berhasil didownload!`);
      } catch (error) {
        console.error("Error downloading barcode:", error);
        showNotification("error", `Gagal mendownload barcode: ${error.message}`);
      }
  }
  
  // Handle add employee form submission (tetap sama)
  async function handleAddEmployee(e) {
    e.preventDefault();
    
      const newStaff = {
        employeeId: document.getElementById("staffId").value,
        name: document.getElementById("staffName").value,
        barcode: document.getElementById("staffBarcode").value,
        type: document.getElementById("staffType").value,
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
  
  // Handle edit button click (tetap sama)
  function handleEditClick() {
    const id = this.getAttribute("data-id");
  const employee = employees.find((emp) => emp.id === id);

  if (!employee) return;

  // Populate edit form
  document.getElementById("editUserId").value = employee.id;
  document.getElementById("editStaffId").value = employee.employeeId || "";
  document.getElementById("editStaffName").value = employee.name || "";
  document.getElementById("editStaffBarcode").value = employee.barcode || "";
  document.getElementById("editStaffType").value = employee.type || "staff";

  // Show modal
  const editModal = new bootstrap.Modal(document.getElementById("editUserModal"));
  editModal.show();
  }
  
  // Handle delete button click (tetap sama)
  function handleDeleteClick() {
    const id = this.getAttribute("data-id");
  const name = this.getAttribute("data-name");

  // Set current user ID for deletion
  currentUserId = id;

  // Update modal content
  document.getElementById("deleteUserName").textContent = name;

  // Show confirm modal
  const confirmModal = new bootstrap.Modal(document.getElementById("confirmDeleteModal"));
  confirmModal.show();
  }
  
  // Handle update employee (tetap sama)
  async function handleUpdateEmployee() {
    const id = document.getElementById("editUserId").value;
    
      const updatedEmployee = {
        employeeId: document.getElementById("editStaffId").value,
        name: document.getElementById("editStaffName").value,
        barcode: document.getElementById("editStaffBarcode").value,
        type: document.getElementById("editStaffType").value,
      };
    
      try {
        await updateEmployee(id, updatedEmployee);
    
        // Close modal
        const editModal = bootstrap.Modal.getInstance(document.getElementById("editUserModal"));
        editModal.hide();
    
        await loadEmployees(); // Reload the list
        showNotification("success", "Data karyawan berhasil diperbarui!");
      } catch (error) {
        console.error("Error updating employee:", error);
        showNotification("error", "Terjadi kesalahan saat memperbarui data karyawan");
      }
  }
  
  // Handle confirm delete (tetap sama)
  async function handleConfirmDelete() {
    if (!currentUserId) return;
  
    try {
      await deleteEmployee(currentUserId);
      try {
        await deleteFaceDescriptor(currentUserId);
        faceDescriptorCache.delete(currentUserId); // Update cache
      } catch (faceError) {
        console.error("Error deleting face data:", faceError);
      }
      const confirmModal = bootstrap.Modal.getInstance(document.getElementById("confirmDeleteModal"));
      confirmModal.hide();
  
      currentUserId = null;
  
      await loadEmployees();
      showNotification("success", "Karyawan berhasil dihapus!");
    } catch (error) {
      console.error("Error deleting employee:", error);
      showNotification("error", "Terjadi kesalahan saat menghapus karyawan");
    }
  }
  
  // Filter employees (tetap sama)
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
  
  // Export users to Excel (tetap sama)
  function exportUsersToExcel() {
    // Create a workbook
  const wb = XLSX.utils.book_new();

  // Format data for export
  const exportData = employees.map((emp) => ({
    "ID Karyawan": emp.employeeId,
    Nama: emp.name,
    Barcode: emp.barcode,
    Tipe: emp.type === "staff" ? "Staff" : "Office Boy",
  }));

  // Create worksheet
  const ws = XLSX.utils.json_to_sheet(exportData);

  // Add worksheet to workbook
  XLSX.utils.book_append_sheet(wb, ws, "Daftar Karyawan");

  // Generate Excel file and trigger download
  const now = new Date();
  const dateStr = now.toISOString().split("T")[0];
  XLSX.writeFile(wb, `daftar_karyawan_${dateStr}.xlsx`);

  showNotification("success", "Data karyawan berhasil diexport!");
  }
  
  // Show notification (tetap sama)
  function showNotification(type, message) {
    // Create notification element
  const notification = document.createElement("div");
  notification.className = `notification ${type}`;
  notification.innerHTML = `
    <div class="notification-icon">
      <i class="fas fa-${type === "success" ? "check-circle" : "exclamation-circle"}"></i>
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
  notification.querySelector(".notification-close").addEventListener("click", () => {
    notification.classList.add("notification-hiding");
    setTimeout(() => {
      notification.remove();
    }, 300);
  });

  // Auto remove after 3 seconds
  setTimeout(() => {
    notification.classList.add("notification-hiding");
    setTimeout(() => {
      notification.remove();
    }, 300);
  }, 3000);

  // Show with animation
  setTimeout(() => {
    notification.classList.add("notification-show");
  }, 10);
  }
  
  // Add notification styles (tetap sama)
  function addNotificationStyles() {
    if (!document.getElementById("notification-styles")) {
        const style = document.createElement("style");
        style.id = "notification-styles";
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
  
  // Update cache status indicator (tetap sama)
  function updateCacheStatusIndicator() {
    const cacheTimestamp = localStorage.getItem("employees_cache_timestamp");
  const cacheStatusElement = document.getElementById("cacheStatus");

  if (cacheStatusElement && cacheTimestamp) {
    const now = new Date().getTime();
    const cacheTime = parseInt(cacheTimestamp);
    const cacheAge = now - cacheTime;
    const hoursSinceUpdate = Math.floor(cacheAge / (1000 * 60 * 60));
  }
  }
  
  // Logout function (tetap sama)
  window.handleLogout = function () {
    console.log("Logout clicked");
    window.location.href = "index.html";
  };
  
  // Document ready function
  document.addEventListener("DOMContentLoaded", async function () {
    addNotificationStyles();
  
    const cardActions = document.querySelector(".card-actions");
    if (cardActions) {
      const refreshFaceButton = document.createElement("button");
      refreshFaceButton.id = "refreshFaceStatus";
      refreshFaceButton.className = "btn btn-sm btn-outline-info me-2";
      refreshFaceButton.innerHTML = '<i class="fas fa-sync-alt"></i> Refresh Status Wajah';
      cardActions.prepend(refreshFaceButton);
    }
  
    await loadEmployees();
    await populateAutoFields();
  
    setupEventListeners();
    updateCacheStatusIndicator();
  
    setInterval(updateCacheStatusIndicator, 60000);
  
    initFaceApi().then((success) => {
      if (success) {
        console.log("Face API initialized successfully");
      }
    });
  });
  