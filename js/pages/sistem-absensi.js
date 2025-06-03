
// 📦 Caching Logic for Attendance Data
const CACHE_KEY = 'cachedAttendanceData';
const CACHE_EXPIRATION = 5 * 60 * 1000; // 5 minutes

function saveAttendanceToCache(data) {
  const cache = {
    timestamp: Date.now(),
    data: data
  };
  sessionStorage.setItem(CACHE_KEY, JSON.stringify(cache));
}

function getAttendanceFromCache() {
  const raw = sessionStorage.getItem(CACHE_KEY);
  if (!raw) return null;

  const cache = JSON.parse(raw);
  const now = Date.now();

  if ((now - cache.timestamp) > CACHE_EXPIRATION) {
    sessionStorage.removeItem(CACHE_KEY);
    return null;
  }

  return cache.data;
}


// Import semua service yang dibutuhkan
import { findEmployeeByBarcode, getEmployees, getFaceDescriptor } from "../services/employee-service.js";
import {
  recordAttendance,
  updateAttendanceOut,
  getTodayAttendance,
  getLocalDateString,
} from "../services/attendance-service.js";
import {
  getLeaveRequestsByDate,
  getAllLeaveRequestsForDate,
  clearLeaveCacheForDate,
} from "../services/leave-service.js";
// Import modul verifikasi wajah
import { initCamera, detectAndVerifyFace } from "../face-verification.js";

// Tambahkan variabel global untuk verifikasi wajah
let isFaceVerificationEnabled = true; // Dapat diubah menjadi false untuk menonaktifkan fitur
let isFaceVerificationReady = false;
let faceVerificationTimeout = null;
// Tambahkan variabel global untuk face-api
let isFaceApiInitialized = false;
let videoStream = null;
let isFaceVerificationInitialized = false;

// Initialize data
let attendanceRecords = [];
let employees = [];
let leaveRequests = [];

// Tambahkan cache untuk employees
const employeeCache = new Map(); // Cache untuk karyawan berdasarkan barcode
const attendanceCache = new Map(); // Cache untuk data kehadiran berdasarkan tanggal
const cacheMeta = new Map(); // Cache metadata for timestamps
// Variabel global untuk menyimpan suara Indonesia
let indonesianVoice = null;
// Variabel global untuk status suara
let soundEnabled = true;
// Variabel global untuk menyimpan status ketersediaan audio
let isOpeningAudioAvailable = true;
// Tambahkan variabel global untuk mendeteksi scanner barcode
let barcodeBuffer = "";
let lastKeyTime = 0;
let isBarcodeScanner = false;
const SCANNER_CHARACTER_DELAY_THRESHOLD = 50; // Maksimum delay antar karakter (ms) untuk scanner
const SCANNER_COMPLETE_DELAY = 500; // Waktu tunggu setelah input selesai (ms)
let scannerTimeoutId = null;

// Tambahkan variabel global untuk mencegah pemrosesan barcode duplikat
let lastProcessedBarcode = "";
let lastProcessedTime = 0;
const BARCODE_COOLDOWN_MS = 3000; // Waktu tunggu 3 detik sebelum barcode yang sama bisa diproses lagi

// Tambahkan konstanta untuk TTL
const CACHE_TTL_STANDARD = 60 * 60 * 1000; // 1 jam
const CACHE_TTL_TODAY = 5 * 60 * 1000; // 5 menit untuk data hari ini

// Tambahkan variabel untuk menyimpan timestamp cache stats
let statsLastUpdated = 0;
const STATS_CACHE_TTL = 60000; // 1 menit

// Fungsi untuk inisialisasi awal verifikasi wajah
async function initializeFaceVerification() {
  if (isFaceVerificationInitialized) return true;

  try {
    console.log("Initializing face verification system...");

    // Muat model face-api di awal
    await loadFaceApiModels();

    // Siapkan modal verifikasi wajah
    setupFaceVerificationModal();

    isFaceVerificationInitialized = true;
    console.log("Face verification system initialized successfully");
    return true;
  } catch (error) {
    console.error("Error initializing face verification:", error);
    return false;
  }
}

// Fungsi untuk memuat model face-api.js
async function loadFaceApiModels() {
  if (isFaceApiInitialized) return true;

  try {
    // Tampilkan loading state
    showScanResult("info", "Memuat model pengenalan wajah...");

    // Set path ke model
    const MODEL_URL = "js/face-api/models";

    // Muat model secara paralel
    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
      faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
      faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
    ]);

    isFaceApiInitialized = true;
    console.log("Face-api models loaded successfully");
    return true;
  } catch (error) {
    console.error("Error loading face-api models:", error);
    showScanResult("error", "Gagal memuat model pengenalan wajah");
    return false;
  }
}

// Modifikasi fungsi shouldUpdateCache
function shouldUpdateCache(cacheKey) {
  if (!cacheMeta.has(cacheKey)) return true;

  const lastUpdate = cacheMeta.get(cacheKey);
  const now = Date.now();

  // Jika cache key adalah tanggal hari ini, gunakan TTL yang lebih pendek
  const today = getLocalDateString();
  if (cacheKey === today) {
    return now - lastUpdate > CACHE_TTL_TODAY;
  }

  // Untuk data lain, gunakan TTL standar
  return now - lastUpdate > CACHE_TTL_STANDARD;
}

// Tambahkan timestamp untuk cache karyawan
let employeeCacheTimestamp = 0;
const EMPLOYEE_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 jam

// Tambahkan fungsi ini di bagian atas file, setelah deklarasi variabel cache
function saveAttendanceCacheToStorage() {
  try {
    // Konversi Map ke objek untuk localStorage
    const cacheObj = {};
    for (const [key, value] of attendanceCache.entries()) {
      cacheObj[key] = value;
    }

    // Simpan cache ke localStorage
    // Gunakan kompresi data untuk mengurangi ukuran penyimpanan
    const compressedData = JSON.stringify(cacheObj).replace(/\s+/g, "");
    localStorage.setItem("attendanceCache", compressedData);

    // Simpan metadata cache
    const metaObj = {};
    for (const [key, value] of cacheMeta.entries()) {
      metaObj[key] = value;
    }
    localStorage.setItem("attendanceCacheMeta", JSON.stringify(metaObj));

    console.log("Attendance cache saved to localStorage");
    return true;
  } catch (error) {
    console.error("Error saving attendance cache to localStorage:", error);

    // Jika localStorage penuh, coba bersihkan cache lama terlebih dahulu
    if (error.name === "QuotaExceededError") {
      console.log("localStorage quota exceeded, cleaning old cache entries");
      cleanOldCacheEntries();
      // Coba lagi setelah membersihkan
      try {
        const reducedCacheObj = {};
        // Simpan hanya 10 entri terbaru
        const recentKeys = [...attendanceCache.keys()].slice(-10);
        for (const key of recentKeys) {
          reducedCacheObj[key] = attendanceCache.get(key);
        }
        localStorage.setItem("attendanceCache", JSON.stringify(reducedCacheObj));
        console.log("Saved reduced attendance cache to localStorage");
      } catch (retryError) {
        console.error("Still failed to save cache after cleanup:", retryError);
      }
    }
    return false;
  }
}

// Tambahkan fungsi helper untuk membersihkan cache lama
function cleanOldCacheEntries() {
  try {
    // Hapus entri cache yang lebih lama dari 3 hari
    const now = Date.now();
    const threeDaysAgo = now - 3 * 24 * 60 * 60 * 1000;

    // Hapus dari cacheMeta dan attendanceCache
    for (const [key, timestamp] of cacheMeta.entries()) {
      if (timestamp < threeDaysAgo) {
        cacheMeta.delete(key);
        attendanceCache.delete(key);
      }
    }

    // Hapus juga item localStorage lain yang mungkin tidak diperlukan
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      // Hapus cache laporan lama atau data sementara
      if (key.startsWith("report_") || key.startsWith("temp_")) {
        localStorage.removeItem(key);
      }
    }

    console.log("Old cache entries cleaned up");
  } catch (error) {
    console.error("Error cleaning old cache entries:", error);
  }
}

// Fungsi untuk memeriksa apakah cache karyawan masih valid
function shouldUpdateEmployeeCache() {
  const now = Date.now();
  return now - employeeCacheTimestamp > EMPLOYEE_CACHE_TTL;
}

// Fungsi untuk memperbarui timestamp cache
function updateCacheTimestamp(cacheKey, timestamp = Date.now()) {
  try {
    cacheMeta.set(cacheKey, timestamp);
  } catch (error) {
    console.error("Error updating cache timestamp:", error);
  }
}

// Fungsi untuk mengatur radio button berdasarkan waktu
function setRadioButtonsByTime() {
  const now = new Date();
  const hours = now.getHours();
  const minutes = now.getMinutes();
  const currentTime = hours * 60 + minutes; // Konversi ke menit untuk perbandingan yang lebih mudah

  // Definisikan rentang waktu dalam menit (dari 00:00)
  const ranges = [
    { start: 7 * 60, end: 13 * 60, scanType: "in", shift: "morning" }, // 07:00-13:00: Scan masuk + Shift pagi
    { start: 13 * 60, end: 16 * 60, scanType: "in", shift: "afternoon" }, // 13:00-16:00: Scan masuk + Shift sore
    { start: 16 * 60 + 20, end: 17 * 60 + 30, scanType: "out", shift: "morning" }, // 16:20-17:30: Scan pulang + Shift pagi
    { start: 21 * 60, end: 23 * 60, scanType: "out", shift: "afternoon" }, // 21:00-23:00: Scan pulang + Shift sore
  ];

  // Cari rentang waktu yang sesuai
  const currentRange = ranges.find((range) => currentTime >= range.start && currentTime <= range.end);

  // Jika waktu saat ini berada dalam salah satu rentang yang ditentukan
  if (currentRange) {
    // Set scan type (in/out)
    const scanTypeIn = document.getElementById("scanTypeIn");
    const scanTypeOut = document.getElementById("scanTypeOut");
    if (scanTypeIn && scanTypeOut) {
      scanTypeIn.checked = currentRange.scanType === "in";
      scanTypeOut.checked = currentRange.scanType === "out";
    }

    // Set shift (morning/afternoon)
    const shiftMorning = document.getElementById("shiftMorning");
    const shiftAfternoon = document.getElementById("shiftAfternoon");
    if (shiftMorning && shiftAfternoon) {
      shiftMorning.checked = currentRange.shift === "morning";
      shiftAfternoon.checked = currentRange.shift === "afternoon";
    }
    
    // PERBAIKAN: Atur status verifikasi wajah berdasarkan scan type dan shift
    updateFaceVerificationBasedOnScanAndShift();
  }
}

// FUNGSI BARU: Fungsi untuk mengatur status verifikasi wajah berdasarkan scan type dan shift
function updateFaceVerificationBasedOnScanAndShift() {
  // Dapatkan status radio button
  const isScanIn = document.getElementById("scanTypeIn")?.checked || false;
  const isMorningShift = document.getElementById("shiftMorning")?.checked || false;
  
  // Aktifkan verifikasi wajah hanya jika scan masuk DAN shift pagi
  const shouldEnableFaceVerification = isScanIn && isMorningShift;
  
  // Dapatkan elemen toggle
  const faceVerificationToggle = document.getElementById("faceVerificationToggle");
  
  if (faceVerificationToggle) {
    // Atur status toggle berdasarkan kondisi
    faceVerificationToggle.checked = shouldEnableFaceVerification;
    
    // Update variabel global
    isFaceVerificationEnabled = shouldEnableFaceVerification;
    
    // Simpan preferensi ke localStorage
    localStorage.setItem("faceVerificationEnabled", shouldEnableFaceVerification ? "true" : "false");
    
    // Update UI terkait verifikasi wajah
    updateFaceVerificationUI(shouldEnableFaceVerification);
    
    // Log perubahan status
    console.log(
      `Verifikasi wajah ${shouldEnableFaceVerification ? "diaktifkan" : "dinonaktifkan"} karena ${
        isScanIn ? "scan masuk" : "scan pulang"
      } dan shift ${isMorningShift ? "pagi" : "sore"}`
    );
  }
}

// FUNGSI BARU: Fungsi untuk memperbarui UI verifikasi wajah
function updateFaceVerificationUI(isEnabled) {
  // Update UI terkait verifikasi wajah
  const faceVerificationContainer = document.querySelector(".face-verification-container");
  if (faceVerificationContainer) {
    faceVerificationContainer.style.display = isEnabled ? "block" : "none";
  }

  // Update tombol terkait verifikasi wajah
  const initCameraButton = document.getElementById("initCamera");
  if (initCameraButton) {
    initCameraButton.style.display = isEnabled ? "inline-block" : "none";
  }

  const resetFaceButton = document.getElementById("resetFaceData");
  if (resetFaceButton) {
    resetFaceButton.style.display = isEnabled ? "inline-block" : "none";
  }
}

// Tambahkan fungsi baru untuk mengatur toggle verifikasi wajah berdasarkan tipe scan
function updateFaceVerificationToggleBasedOnScanType(isCheckIn) {
  // Dapatkan status shift
  const isMorningShift = document.getElementById("shiftMorning")?.checked || false;
  
  // Aktifkan verifikasi wajah hanya jika scan masuk DAN shift pagi
  const shouldEnableFaceVerification = isCheckIn && isMorningShift;
  
  // Dapatkan elemen toggle
  const faceVerificationToggle = document.getElementById("faceVerificationToggle");

  if (faceVerificationToggle) {
    // Atur status toggle berdasarkan kondisi
    faceVerificationToggle.checked = shouldEnableFaceVerification;

    // Update variabel global
    isFaceVerificationEnabled = shouldEnableFaceVerification;

    // Simpan preferensi ke localStorage
    localStorage.setItem("faceVerificationEnabled", shouldEnableFaceVerification ? "true" : "false");

    // Update UI terkait verifikasi wajah
    updateFaceVerificationUI(shouldEnableFaceVerification);

    // Log perubahan status
    console.log(
      `Verifikasi wajah ${shouldEnableFaceVerification ? "diaktifkan" : "dinonaktifkan"} karena ${
        isCheckIn ? "scan masuk" : "scan pulang"
      } dan shift ${isMorningShift ? "pagi" : "sore"}`
    );
  }
}

// Perbaiki fungsi setupBarcodeScanner
function setupBarcodeScanner() {
  const barcodeInput = document.getElementById("barcodeInput");

  if (!barcodeInput) {
    console.error("Barcode input element not found");
    return;
  }

  // Reset status scanner
  barcodeInput.dataset.isScanner = "false";
  barcodeBuffer = "";

  // Nonaktifkan paste untuk mencegah input manual dengan copy-paste
  barcodeInput.addEventListener("paste", function (e) {
    e.preventDefault();
    showScanResult("error", "Gunakan scanner barcode! Paste tidak diizinkan.");
    playNotificationSound("error");
  });

  // Tambahkan event listener untuk keydown untuk mendeteksi scanner
  barcodeInput.addEventListener("keydown", function (e) {
    const currentTime = new Date().getTime();

    // Jika ini adalah karakter pertama atau jeda antar karakter sangat cepat (tipikal scanner)
    if (barcodeBuffer === "" || currentTime - lastKeyTime < SCANNER_CHARACTER_DELAY_THRESHOLD) {
      // Kemungkinan ini adalah scanner barcode
      isBarcodeScanner = true;
    } else if (currentTime - lastKeyTime > SCANNER_CHARACTER_DELAY_THRESHOLD) {
      // Jeda terlalu lama untuk scanner, kemungkinan input manual
      isBarcodeScanner = false;
    }

    // Update waktu terakhir
    lastKeyTime = currentTime;

    // Simpan status scanner sebagai atribut data
    this.dataset.isScanner = isBarcodeScanner ? "true" : "false";

    // Clear timeout sebelumnya jika ada
    if (scannerTimeoutId) {
      clearTimeout(scannerTimeoutId);
    }

    // Set timeout baru untuk reset status scanner setelah beberapa waktu
    scannerTimeoutId = setTimeout(function () {
      isBarcodeScanner = false;
      barcodeInput.dataset.isScanner = "false";

      // Jika ada input tapi tidak ada Enter, kemungkinan input manual
      if (barcodeInput.value.length > 0) {
        showScanResult("error", "Gunakan scanner barcode! Input manual tidak diizinkan.");
        playNotificationSound("error");
        barcodeInput.value = "";
      }
    }, SCANNER_COMPLETE_DELAY);
  });

  // Tambahkan event listener untuk keypress dengan debounce untuk Enter
  let lastEnterTime = 0;
  const ENTER_DEBOUNCE_MS = 1000; // Debounce 1 detik untuk tombol Enter

  barcodeInput.addEventListener("keypress", async function (e) {
    if (e.key === "Enter") {
      e.preventDefault();

      // Cek apakah tombol Enter sudah ditekan dalam waktu debounce
      const currentTime = new Date().getTime();
      if (currentTime - lastEnterTime < ENTER_DEBOUNCE_MS) {
        console.log("Enter key debounced - ignoring");
        return; // Abaikan Enter yang terlalu cepat
      }

      lastEnterTime = currentTime;

      // Cek apakah input berasal dari scanner
      if (this.dataset.isScanner === "true") {
        // Simpan nilai barcode sebelum diproses
        const barcode = this.value.trim();

        // Reset input
        this.value = "";

        // Proses barcode dari scanner
        await processScannedBarcode(barcode);
      } else {
        // Tampilkan pesan error untuk input manual
        showScanResult("error", "Gunakan scanner barcode! Input manual tidak diizinkan.");
        playNotificationSound("error");
        this.value = "";
      }

      // Reset status scanner
      isBarcodeScanner = false;
      this.dataset.isScanner = "false";
    }
  });
}
// Optimasi fungsi showFaceVerificationModal
async function showFaceVerificationModal(employeeId, employeeName) {
  return new Promise(async (resolve, reject) => {
    try {
      console.log(`Showing face verification modal for employee: ${employeeName} (ID: ${employeeId})`);

      // Pastikan sistem verifikasi wajah sudah diinisialisasi
      if (!isFaceVerificationInitialized) {
        await initializeFaceVerification();
      }

      // Get the modal element
      const faceModal = document.getElementById("faceVerificationModal");

      if (!faceModal) {
        console.error("Face verification modal not found in the DOM");

        // PERBAIKAN: Fokus kembali ke input barcode jika modal tidak ditemukan
        focusBarcodeInput();

        reject(new Error("Face verification modal not found"));
        return;
      }

      // Set employee information
      const nameElement = document.getElementById("faceEmployeeName");
      const idElement = document.getElementById("faceEmployeeId");

      if (nameElement) nameElement.textContent = employeeName;
      if (idElement) idElement.textContent = employeeId;

      // Store employeeId as data attribute
      faceModal.dataset.employeeId = employeeId;

      // OPTIMASI: Inisialisasi kamera sebelum menampilkan modal
      try {
        await initCamera();
      } catch (cameraError) {
        console.error("Error initializing camera:", cameraError);

        // PERBAIKAN: Fokus kembali ke input barcode jika kamera gagal
        focusBarcodeInput();

        reject(new Error("Gagal mengakses kamera: " + cameraError.message));
        return;
      }

      // Clean up when modal is closed
      const handleModalHidden = () => {
        // Stop camera
        stopCamera();

        // Remove event listener to prevent memory leaks
        faceModal.removeEventListener("hidden.bs.modal", handleModalHidden);

        // PERBAIKAN: Fokus kembali ke input barcode saat modal ditutup
        focusBarcodeInput();

        // Resolve with failure result if modal is closed without verification
        resolve({ verified: false, message: "Verifikasi dibatalkan" });
      };

      faceModal.addEventListener("hidden.bs.modal", handleModalHidden);

      // Show modal
      const modal = new bootstrap.Modal(faceModal);
      modal.show();

      // OPTIMASI: Mulai verifikasi wajah setelah modal ditampilkan
      setTimeout(async () => {
        try {
          // Lakukan verifikasi wajah
          const result = await detectAndVerifyFace(employeeId);

          // Tunggu sebentar agar hasil dapat dibaca
          await new Promise((resolve) => setTimeout(resolve, 1000));

          // Remove event listener since we're handling the close ourselves
          faceModal.removeEventListener("hidden.bs.modal", handleModalHidden);

          // Close modal after verification is complete
          modal.hide();

          // PERBAIKAN: Fokus kembali ke input barcode setelah verifikasi selesai
          focusBarcodeInput();

          // Return verification result
          resolve(result);
        } catch (verificationError) {
          console.error("Error in face verification:", verificationError);

          // Remove event listener
          faceModal.removeEventListener("hidden.bs.modal", handleModalHidden);

          // Close modal if there's an error
          modal.hide();

          // PERBAIKAN: Fokus kembali ke input barcode jika terjadi error
          focusBarcodeInput();

          // Return failure result
          resolve({ verified: false, message: verificationError.message });
        }
      }, 500); // Berikan waktu 500ms untuk modal ditampilkan
    } catch (error) {
      console.error("Error showing face verification modal:", error);

      // PERBAIKAN: Fokus kembali ke input barcode jika terjadi error
      focusBarcodeInput();

      reject(error);
    }
  });
}

// PERBAIKAN: Tambahkan fungsi helper untuk fokus ke input barcode
function focusBarcodeInput() {
  // Tunggu sedikit untuk memastikan DOM sudah siap
  setTimeout(() => {
    const barcodeInput = document.getElementById("barcodeInput");
    if (barcodeInput) {
      barcodeInput.focus();

      // Opsional: Pilih semua teks yang ada di input
      barcodeInput.select();

      console.log("Focus set to barcode input");
    } else {
      console.warn("Barcode input element not found");
    }
  }, 100); // Delay kecil untuk memastikan modal benar-benar tertutup
}

/**
 * Menyiapkan modal verifikasi wajah
 */
function setupFaceVerificationModal() {
  try {
    console.log("Setting up face verification modal...");
    
    // Pastikan modal sudah ada di DOM
    const faceModal = document.getElementById("faceVerificationModal");
    if (!faceModal) {
      console.warn("Face verification modal not found in DOM");
      return false;
    }
    
    // Tambahkan event listener untuk membersihkan sumber daya saat modal ditutup
    faceModal.addEventListener("hidden.bs.modal", function() {
      // Hentikan kamera jika masih aktif
      if (videoStream) {
        videoStream.getTracks().forEach(track => track.stop());
        videoStream = null;
      }
      
      // Reset status
      const statusElement = document.getElementById("faceVerificationStatus");
      if (statusElement) {
        statusElement.textContent = "Menyiapkan kamera...";
        statusElement.className = "mt-2 text-center";
      }
      
      // Fokus kembali ke input barcode
      focusBarcodeInput();
    });
    
    console.log("Face verification modal setup completed");
    return true;
  } catch (error) {
    console.error("Error setting up face verification modal:", error);
    return false;
  }
}

/**
 * Memproses barcode yang dipindai dan melakukan verifikasi wajah
 * @param {string} barcode - Barcode yang dipindai
 */
async function processScannedBarcode(barcode) {
  // Validasi input dan cek cooldown
  if (!validateBarcodeInput(barcode)) {
    return;
  }

  try {
    // Current time
    const now = new Date();
    const timeString = now.toTimeString().split(" ")[0];
    const today = getLocalDateString();
    
    console.log("Today's date for attendance:", today);
    console.log("Current time:", now);

    // Dapatkan data karyawan
    const employee = await getEmployeeData(barcode);
    if (!employee) {
      showScanResult("error", "Barcode tidak valid!");
      playNotificationSound("not-found", "");
      return;
    }

     // PERBAIKAN: Periksa kondisi verifikasi wajah berdasarkan scan type dan shift
     const isScanIn = document.getElementById("scanTypeIn")?.checked || false;
     const isMorningShift = document.getElementById("shiftMorning")?.checked || false;
     
     // Aktifkan verifikasi wajah hanya jika scan masuk DAN shift pagi
     isFaceVerificationEnabled = isScanIn && isMorningShift;
     
     // Update UI verifikasi wajah
     updateFaceVerificationUI(isFaceVerificationEnabled);
 
     // Inisialisasi verifikasi wajah jika diperlukan
     if (isFaceVerificationEnabled) {
       initFaceVerificationIfNeeded();
     }

    // Verifikasi wajah jika diaktifkan
    const verificationPassed = await performFaceVerification(employee);
    if (!verificationPassed) return;

    // Proses absensi berdasarkan tipe scan
    await processAttendance(employee, now, timeString, today);
    
  } catch (error) {
    console.error("Error scanning barcode:", error);
    showScanResult("error", "Terjadi kesalahan saat memproses barcode");
    playNotificationSound("error", "");
    focusBarcodeInput();
  }

  // Clear input dan fokus kembali ke input barcode
  resetBarcodeInput();
}

/**
 * Validasi input barcode dan cek cooldown
 * @param {string} barcode - Barcode yang dipindai
 * @returns {boolean} - True jika valid, false jika tidak
 */
function validateBarcodeInput(barcode) {
  // Validasi input barcode
  if (!barcode) {
    showScanResult("error", "Barcode tidak boleh kosong!");
    playNotificationSound("error", "");
    focusBarcodeInput();
    return false;
  }

  // Cek apakah barcode ini baru saja diproses (dalam 3 detik terakhir)
  const currentTime = Date.now();
  if (barcode === lastProcessedBarcode && currentTime - lastProcessedTime < BARCODE_COOLDOWN_MS) {
    console.log(`Barcode ${barcode} diabaikan - sudah diproses dalam ${BARCODE_COOLDOWN_MS}ms terakhir`);
    showScanResult("warning", "Scan terlalu cepat, harap tunggu beberapa detik");
    focusBarcodeInput();
    return false;
  }

  // Update variabel tracking barcode
  lastProcessedBarcode = barcode;
  lastProcessedTime = currentTime;
  console.log("Processing scanned barcode:", barcode);
  
  return true;
}

/**
 * Mendapatkan data karyawan dari cache atau Firestore
 * @param {string} barcode - Barcode karyawan
 * @returns {Object|null} - Data karyawan atau null jika tidak ditemukan
 */
async function getEmployeeData(barcode) {
  // Check if employee exists in cache first to reduce Firestore reads
  let employee = employeeCache.get(barcode);

  // If not in cache, fetch from Firestore
  if (!employee) {
    employee = await findEmployeeByBarcode(barcode);
    
    // Add to cache if found
    if (employee && employee.barcode) {
      employeeCache.set(employee.barcode, employee);
    }
  }
  
  return employee;
}

/**
 * Inisialisasi sistem verifikasi wajah jika diperlukan
 */
function initFaceVerificationIfNeeded() {
  if (!isFaceVerificationInitialized && isFaceVerificationEnabled) {
    // Inisialisasi di background tanpa menunggu
    initializeFaceVerification().then((success) => {
      console.log("Background face verification initialization:", success ? "success" : "failed");
    });
  }
}

/**
 * Melakukan verifikasi wajah
 * @param {Object} employee - Data karyawan
 * @returns {Promise<boolean>} - True jika verifikasi berhasil atau dilewati
 */
async function performFaceVerification(employee) {
  // Default jika verifikasi wajah dinonaktifkan
  let verificationPassed = true; 

  if (isFaceVerificationEnabled) {
    try {
      // Import fungsi verifikasi wajah jika belum diimpor
      await importFaceVerificationIfNeeded();

      // Lakukan verifikasi wajah
      const verificationResult = await showFaceVerificationModal(employee.id, employee.name);

      // Jika verifikasi gagal, hentikan proses absensi
      if (!verificationResult || !verificationResult.verified) {
        showScanResult("error", `Verifikasi wajah gagal: ${verificationResult?.message || "Wajah tidak dikenali"}`);
        playNotificationSound("error", "");
        focusBarcodeInput();
        return false;
      }

      // Jika verifikasi berhasil, lanjutkan proses absensi
      showScanResult("success", "Verifikasi wajah berhasil!");
      verificationPassed = true;
    } catch (verificationError) {
      console.error("Error during face verification:", verificationError);
      
      // Jika fitur verifikasi wajah gagal, tampilkan pesan dan lanjutkan proses
      showScanResult("warning", "Verifikasi wajah dilewati: " + verificationError.message);
      
      // Tunggu sebentar agar pesan dapat dibaca
      await new Promise((resolve) => setTimeout(resolve, 1500));
      
      // Tetap lanjutkan proses jika terjadi error teknis
      verificationPassed = true;
    }
  } else {
    // Jika verifikasi wajah dinonaktifkan, tampilkan pesan
    console.log("Face verification is disabled, proceeding with barcode only");
    
    // Tunggu sebentar agar pesan dapat dibaca
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  return verificationPassed;
}

/**
 * Import modul verifikasi wajah jika belum diimpor
 */
async function importFaceVerificationIfNeeded() {
  if (typeof showFaceVerificationModal !== "function") {
    const faceVerification = await import("../face-verification.js");
    window.showFaceVerificationModal = async function (employeeId, employeeName) {
      try {
        // Inisialisasi kamera
        await faceVerification.loadFaceApiModels();
        await faceVerification.initCamera();

        // Tampilkan modal verifikasi wajah
        const modal = new bootstrap.Modal(document.getElementById("faceVerificationModal"));

        // Isi informasi karyawan
        document.getElementById("faceEmployeeName").textContent = employeeName;
        document.getElementById("faceEmployeeId").textContent = employeeId;

        modal.show();

        // Lakukan verifikasi wajah
        const result = await faceVerification.detectAndVerifyFace(employeeId);

        // Tutup modal
        modal.hide();

        // Hentikan kamera
        faceVerification.stopCamera();

        return result;
      } catch (error) {
        console.error("Error in face verification:", error);
        return { verified: false, message: error.message };
      }
    };
  }
}

/**
 * Proses absensi berdasarkan tipe scan
 * @param {Object} employee - Data karyawan
 * @param {Date} now - Waktu saat ini
 * @param {string} timeString - String waktu saat ini
 * @param {string} today - Tanggal hari ini dalam format YYYY-MM-DD
 */
async function processAttendance(employee, now, timeString, today) {
  // Get scan type (in/out/latepermission)
  const scanType = document.querySelector('input[name="scanType"]:checked')?.value || "in";
  
  // Get selected shift
  const selectedShift = document.querySelector('input[name="shiftOption"]:checked')?.value || "morning";
  
  // Cek apakah data kehadiran hari ini sudah di-cache
  let todayRecords = attendanceCache.get(today) || [];
  
  // Cari record kehadiran karyawan ini
  const existingRecord = todayRecords.find(
    (record) =>
      record.employeeId === employee.employeeId &&
      (record.date === today || (record.date instanceof Date && getLocalDateStringFromDate(record.date) === today))
  );

  // Proses berdasarkan tipe scan
  if (scanType === "latepermission") {
    await processLatePermission(employee, existingRecord, now, today, selectedShift, todayRecords);
  } else if (scanType === "in") {
    await processCheckIn(employee, existingRecord, now, timeString, today, selectedShift, todayRecords);
  } else {
    await processCheckOut(employee, existingRecord, now, today, todayRecords);
  }
}

/**
 * Proses izin terlambat
 * @param {Object} employee - Data karyawan
 * @param {Object} existingRecord - Record kehadiran yang sudah ada (jika ada)
 * @param {Date} now - Waktu saat ini
 * @param {string} today - Tanggal hari ini dalam format YYYY-MM-DD
 * @param {string} selectedShift - Shift yang dipilih
 * @param {Array} todayRecords - Record kehadiran hari ini
 */
async function processLatePermission(employee, existingRecord, now, today, selectedShift, todayRecords) {
  try {
    // Cek apakah sudah ada record kehadiran
    if (existingRecord && existingRecord.timeIn) {
      showScanResult("error", `${employee.name} sudah melakukan scan masuk hari ini!`);
      playNotificationSound("already-in", employee.name);
      focusBarcodeInput();
      return;
    }

    // Ambil kode verifikasi saja (tanpa reason)
    const latePermissionCode = document.getElementById("latePermissionCode");
    
    // Periksa apakah elemen form ada
    if (!latePermissionCode) {
      showScanResult("error", "Form kode verifikasi tidak ditemukan!");
      console.error("Form element not found: latePermissionCode");
      playNotificationSound("error", "");
      focusBarcodeInput();
      return;
    }
    
    const verificationCode = latePermissionCode.value || "";

    // Validasi input
    if (!verificationCode.trim()) {
      showScanResult("error", "Kode verifikasi harus diisi!");
      playNotificationSound("error", "");
      focusBarcodeInput();
      return;
    }

    // Verifikasi kode sederhana - gunakan tanggal dan ID karyawan
    // Format kode: YYYYMMDD-XX (2 digit terakhir ID karyawan)
    const dateFormatted = today.replace(/-/g, "");
    const expectedCode = `${dateFormatted}-${employee.employeeId.slice(-2)}`; // Gunakan 2 digit terakhir

    if (verificationCode !== expectedCode) {
      showScanResult("error", "Kode verifikasi tidak valid!");
      playNotificationSound("error", "");
      focusBarcodeInput();
      return;
    }

    // Use employee's default type and shift from their profile
    const employeeType = employee.type || "staff";
    const shift = selectedShift;

    // Record attendance with late permission - TANPA reason
    const attendance = {
      employeeId: employee.employeeId,
      name: employee.name,
      type: employeeType,
      shift: shift,
      timeIn: now,
      status: "Izin Terlambat", // Pastikan status adalah "Izin Terlambat"
      lateMinutes: 0, // Tidak dihitung sebagai terlambat
      date: today,
      latePermission: {
        verificationCode: verificationCode
        // Tidak menyertakan field reason
      },
      faceVerified: isFaceVerificationEnabled,
    };

    console.log("Saving attendance record with late permission:", attendance);
    
    const savedRecord = await recordAttendance(attendance);

    // Update cache dan UI
    await updateCacheAndUI(savedRecord, attendance, todayRecords, today);

    // PERBAIKAN: Update counter izin terlambat secara langsung
    const latePermissionCountEl = document.getElementById("latePermissionCount");
    if (latePermissionCountEl) {
      const currentCount = parseInt(latePermissionCountEl.textContent || "0");
      latePermissionCountEl.textContent = currentCount + 1;
    }
    // Tampilkan pesan sukses
    showScanResult(
      "success",
      `Izin terlambat berhasil dicatat: ${employee.name} (${formatEmployeeType(employeeType)} - ${formatShift(shift)})`
    );

    // Play notification sound
    playNotificationSound("late-permission", employee.name);0

    // Reset form
    latePermissionCode.value = "";
  } catch (error) {
    console.error("Error saving late permission:", error);
    showScanResult("error", "Gagal menyimpan izin terlambat: " + error.message);
    playNotificationSound("error", "");
  }
}


/**
 * Proses check-in
 * @param {Object} employee - Data karyawan
 * @param {Object} existingRecord - Record kehadiran yang sudah ada (jika ada)
 * @param {Date} now - Waktu saat ini
 * @param {string} timeString - String waktu saat ini
 * @param {string} today - Tanggal hari ini dalam format YYYY-MM-DD
 * @param {string} selectedShift - Shift yang dipilih
 * @param {Array} todayRecords - Record kehadiran hari ini
 */
async function processCheckIn(employee, existingRecord, now, timeString, today, selectedShift, todayRecords) {
  // Check if already checked in
  if (existingRecord && existingRecord.timeIn) {
    showScanResult("error", `${employee.name} sudah melakukan scan masuk hari ini!`);
    playNotificationSound("already-in", employee.name);
    focusBarcodeInput();
    return;
  }

  // Use employee's default type and shift from their profile
  const employeeType = employee.type || "staff";
  const shift = selectedShift;

  // Check if late based on employee type and shift
  const isLate = checkIfLate(timeString, employeeType, shift);

  // Calculate late minutes if employee is late
  let lateMinutes = 0;
  if (isLate) {
    const currentTime = new Date(`1970-01-01T${timeString}`);
    const thresholdTime = getThresholdTime(employeeType, shift);
    lateMinutes = Math.floor((currentTime - thresholdTime) / (1000 * 60));
  }

  // Record attendance
  const attendance = {
    employeeId: employee.employeeId,
    name: employee.name,
    type: employeeType,
    shift: shift,
    timeIn: now,
    status: isLate ? "Terlambat" : "Tepat Waktu",
    lateMinutes: isLate ? lateMinutes : 0,
    date: today,
    // TAMBAHAN: Tambahkan flag verifikasi wajah
    faceVerified: isFaceVerificationEnabled,
  };

  console.log("Saving attendance record:", attendance);
  const savedRecord = await recordAttendance(attendance);

  // Update cache dan UI
  await updateCacheAndUI(savedRecord, attendance, todayRecords, today);

  // Tampilkan pesan sukses
  showScanResult(
    "success",
    `Absensi masuk berhasil: ${employee.name} (${formatEmployeeType(employeeType)} - ${formatShift(shift)}) - ${
      isLate ? `Terlambat ${lateMinutes} menit` : "Tepat Waktu"
    }`
  );

  // Play notification sound based on status
  if (isLate) {
    playNotificationSound("late", employee.name);
  } else {
    playNotificationSound("success-in", employee.name);
  }
}

/**
 * Proses check-out
 * @param {Object} employee - Data karyawan
 * @param {Object} existingRecord - Record kehadiran yang sudah ada (jika ada)
 * @param {Date} now - Waktu saat ini
 * @param {string} today - Tanggal hari ini dalam format YYYY-MM-DD
 * @param {Array} todayRecords - Record kehadiran hari ini
 */
async function processCheckOut(employee, existingRecord, now, today, todayRecords) {
  // Scan out logic
  if (!existingRecord) {
    showScanResult("error", `${employee.name} belum melakukan scan masuk hari ini!`);
    playNotificationSound("error", "");
    focusBarcodeInput();
    return;
  }

  if (existingRecord.timeOut) {
    showScanResult("error", `${employee.name} sudah melakukan scan pulang hari ini!`);
    playNotificationSound("already-out", employee.name);
    focusBarcodeInput();
    return;
  }

  // Update attendance with checkout time
  await updateAttendanceOut(existingRecord.id, now);

  // Update local cache
  const updatedRecords = todayRecords.map((record) => {
    if (record.id === existingRecord.id) {
      return {
        ...record,
        timeOut: now,
      };
    }
    return record;
  });

  // Update cache
  attendanceCache.set(today, updatedRecords);

  // Update variabel global
  attendanceRecords = updatedRecords;

  // Tandai bahwa ada perubahan data
  localStorage.setItem("lastAttendanceUpdate", Date.now().toString());

  // Perbarui cache untuk hari ini
  updateCacheTimestamp(today, 0); // Set timestamp ke 0 untuk memaksa refresh berikutnya

  // Tampilkan pesan sukses
  showScanResult("success", `Absensi pulang berhasil: ${employee.name}`);
  playNotificationSound("success-out", employee.name);

  // Trigger event untuk update UI
  notifyAttendanceUpdate(today);

  // Update UI stats tanpa query baru
  updateAttendanceStats();
}

/**
 * Update cache dan UI setelah menyimpan record kehadiran
 * @param {Object} savedRecord - Record yang disimpan ke database
 * @param {Object} attendance - Data kehadiran
 * @param {Array} todayRecords - Record kehadiran hari ini
 * @param {string} today - Tanggal hari ini dalam format YYYY-MM-DD
 */
async function updateCacheAndUI(savedRecord, attendance, todayRecords, today) {
  // Update local cache dengan record baru
  if (savedRecord && savedRecord.id) {
    // Tambahkan record baru ke cache
    const newRecord = {
      ...attendance,
      id: savedRecord.id,
    };

    // Update cache
    const updatedRecords = [...todayRecords];
    updatedRecords.push(newRecord);
    attendanceCache.set(today, updatedRecords);

    // Update variabel global
    attendanceRecords = updatedRecords;
  }

  // Invalidate cache untuk laporan kehadiran
  localStorage.setItem("lastAttendanceScanTime", Date.now().toString());
  localStorage.setItem("lastAttendanceScanDate", today);

  // Hapus cache laporan yang mungkin mencakup hari ini
  clearTodayAttendanceCache();

  // Trigger event untuk update UI
  notifyAttendanceUpdate(today);

  // Update UI stats tanpa query baru
  updateAttendanceStats();
}

/**
 * Reset input barcode dan fokus kembali ke input
 */
function resetBarcodeInput() {
  const barcodeInput = document.getElementById("barcodeInput");
  if (barcodeInput) {
    barcodeInput.value = "";
    barcodeInput.focus();
  }
  focusBarcodeInput();
}


/**
 * Fungsi untuk memperbarui statistik kehadiran di UI
 * Menghitung jumlah karyawan yang hadir, terlambat, dan izin hari ini
 */
async function updateAttendanceStats() {
  try {
    // Gunakan fungsi helper untuk mendapatkan tanggal hari ini
    const today = getLocalDateString();

    // Coba ambil dari cache terlebih dahulu
    let todayRecords = attendanceCache.get(today) || [];

    // Jika cache kosong, ambil dari server
    if (todayRecords.length === 0) {
      console.log("Cache kosong, mengambil data kehadiran dari server...");
      todayRecords = await getAttendanceByDate(today);

      // Simpan ke cache
      if (todayRecords && todayRecords.length > 0) {
        attendanceCache.set(today, todayRecords);
      }
    }

    // Hitung statistik
    let presentCount = 0;
    let lateCount = 0;
    let latePermissionCount = 0; // Tambahkan counter untuk izin terlambat

    // Hitung jumlah hadir, terlambat, dan izin terlambat
    todayRecords.forEach((record) => {
      // Cek status untuk menentukan kategori
      if (record.status === "present" || record.status === "Tepat Waktu") {
        presentCount++;
      } else if (record.status === "late" || record.status === "Terlambat") {
        lateCount++;
        presentCount++; // Karyawan terlambat juga dihitung sebagai hadir
      } else if (record.status === "Izin Terlambat") {
        latePermissionCount++; // Hitung izin terlambat
        presentCount++; // Karyawan izin terlambat juga dihitung sebagai hadir
      }
    });

    // Ambil jumlah izin hari ini (cuti/sakit)
    let leaveCount = 0;

    try {
      // Coba ambil dari cache izin terlebih dahulu
      if (leaveRequests.length > 0) {
        // Filter izin yang disetujui untuk hari ini
        leaveCount = leaveRequests.filter(
          (request) =>
            (request.status === "Approved" || request.status === "Disetujui") &&
            isDateInLeaveRange(today, request.startDate, request.endDate)
        ).length;
      } else {
        // PERBAIKAN: Tangani error dengan lebih baik
        try {
          // Gunakan null check sebelum memanggil getLeaveRequestsByDate
          const todayLeaves = await getLeaveRequestsByDate(today);
          if (todayLeaves && todayLeaves.length > 0) {
            leaveCount = todayLeaves.filter((req) => req.status === "Approved" || req.status === "Disetujui").length;
          }
        } catch (leaveError) {
          console.error("Error fetching leave requests:", leaveError);
          // Lanjutkan dengan leaveCount = 0
        }
      }
    } catch (leaveCountError) {
      console.error("Error calculating leave count:", leaveCountError);
      // Lanjutkan dengan leaveCount = 0
    }

    // Perbarui UI
    const presentCountElement = document.getElementById("presentCount");
    const lateCountElement = document.getElementById("lateCount");
    const latePermissionCountElement = document.getElementById("latePermissionCount"); // Tambahkan elemen untuk izin terlambat
    const leaveCountElement = document.getElementById("leaveCount");

    if (presentCountElement) presentCountElement.textContent = presentCount;
    if (lateCountElement) lateCountElement.textContent = lateCount;
    if (latePermissionCountElement) latePermissionCountElement.textContent = latePermissionCount;
    if (leaveCountElement) leaveCountElement.textContent = leaveCount;

    console.log(`Statistik diperbarui: ${presentCount} hadir, ${lateCount} terlambat, ${latePermissionCount} izin terlambat, ${leaveCount} izin`);
  } catch (error) {
    console.error("Error updating attendance stats:", error);
    // Jangan biarkan error menghentikan aplikasi
  }
}


// Fungsi untuk memulai verifikasi wajah
async function startFaceVerification(employeeId) {
  try {
    // Pastikan model face-api sudah dimuat
    if (!isFaceApiInitialized) {
      await loadFaceApiModels();
      isFaceApiInitialized = true;
    }

    // Inisialisasi kamera
    const videoElement = document.getElementById("faceVerificationVideo");
    const statusElement = document.getElementById("faceVerificationStatus");

    if (!videoElement || !statusElement) {
      throw new Error("Elemen video atau status tidak ditemukan");
    }

    // Update status
    statusElement.textContent = "Mengakses kamera...";

    // Minta akses kamera
    videoStream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 640 },
        height: { ideal: 480 },
        facingMode: "user",
      },
    });

    // Tampilkan video
    videoElement.srcObject = videoStream;

    // Tunggu video siap
    await new Promise((resolve) => {
      videoElement.onloadedmetadata = () => {
        videoElement.play();
        resolve();
      };
    });

    // Update status
    statusElement.textContent = "Mendeteksi wajah...";

    // Berikan waktu untuk kamera menampilkan gambar
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Lakukan verifikasi wajah
    const result = await detectAndVerifyFace(employeeId);

    // Update status berdasarkan hasil
    if (result.verified) {
      statusElement.textContent = `Verifikasi berhasil! Kecocokan: ${(result.similarity * 100).toFixed(0)}%`;
      statusElement.className = "text-success";
    } else {
      statusElement.textContent = result.message || "Verifikasi gagal";
      statusElement.className = "text-danger";
    }

    // Berikan waktu untuk melihat hasil
    await new Promise((resolve) => setTimeout(resolve, 1500));

    return result;
  } catch (error) {
    console.error("Error in face verification:", error);
    throw error;
  } finally {
    // Pastikan kamera dimatikan
    if (videoStream) {
      videoStream.getTracks().forEach((track) => track.stop());
    }
  }
}

// Fungsi untuk debugging - memeriksa apakah data wajah tersedia
async function checkFaceDataAvailability(employeeId) {
  try {
    const faceData = await getFaceDescriptor(employeeId);
    console.log(`Face data for employee ID ${employeeId}:`, faceData ? "Available" : "Not available");
    if (faceData) {
      console.log("Face descriptor length:", faceData.length);
      console.log("Face descriptor type:", faceData instanceof Float32Array ? "Float32Array" : typeof faceData);
    }
    return !!faceData;
  } catch (error) {
    console.error("Error checking face data:", error);
    return false;
  }
}

/**
 * Fungsi untuk membersihkan cache kehadiran hari ini secara selektif
 * Hanya menghapus cache yang relevan dengan hari ini
 */
function clearTodayAttendanceCache() {
  try {
    const today = getLocalDateString();
    console.log(`Clearing attendance cache for today (${today})`);

    // 1. Hapus cache spesifik untuk hari ini
    attendanceCache.delete(today);

    // 2. Hapus cache range yang secara eksplisit mencakup hari ini
    // Cari cache dengan format range_startDate_endDate_shift
    for (const key of attendanceCache.keys()) {
      if (key.startsWith("range_")) {
        const parts = key.split("_");
        if (parts.length >= 3) {
          const rangeStartDate = parts[1];
          const rangeEndDate = parts[2];

          // Cek apakah range mencakup hari ini
          if (rangeStartDate <= today && today <= rangeEndDate) {
            console.log(`Clearing range cache that includes today: ${key}`);
            attendanceCache.delete(key);
          }
        }
      }
    }

    // 3. Hapus timestamp cache untuk memaksa refresh pada query berikutnya
    if (typeof cacheMeta !== "undefined" && cacheMeta instanceof Map) {
      cacheMeta.delete(today);

      // Hapus juga timestamp untuk range yang mencakup hari ini
      for (const key of cacheMeta.keys()) {
        if (key.startsWith("range_")) {
          const parts = key.split("_");
          if (parts.length >= 3) {
            const rangeStartDate = parts[1];
            const rangeEndDate = parts[2];

            if (rangeStartDate <= today && today <= rangeEndDate) {
              console.log(`Clearing timestamp for range cache: ${key}`);
              cacheMeta.delete(key);
            }
          }
        }
      }
    }

    // 4. Simpan perubahan ke localStorage
    if (typeof saveAttendanceCacheToStorage === "function") {
      saveAttendanceCacheToStorage();
    } else {
      // Fallback jika fungsi saveAttendanceCacheToStorage tidak tersedia
      try {
        localStorage.setItem("attendanceCache", JSON.stringify(Object.fromEntries(attendanceCache)));
        if (typeof cacheMeta !== "undefined" && cacheMeta instanceof Map) {
          localStorage.setItem("attendanceCacheMeta", JSON.stringify(Object.fromEntries(cacheMeta)));
        }
      } catch (storageError) {
        console.error("Error saving cache to localStorage:", storageError);
      }
    }

    // 5. Tandai bahwa cache telah dibersihkan
    localStorage.setItem("attendanceCacheCleared", Date.now().toString());
    localStorage.setItem("attendanceCacheClearedDate", today);

    console.log("Today's attendance cache cleared successfully");
    return true;
  } catch (error) {
    console.error("Error clearing today's attendance cache:", error);
    return false;
  }
}

// Fungsi untuk memutar notifikasi suara dengan audio pembuka yang sesuai
function playNotificationSound(type, staffName = "") {
  // Jika suara dinonaktifkan, keluar dari fungsi
  if (!soundEnabled) return;

  try {
    // Hentikan semua suara yang sedang diputar
    window.speechSynthesis.cancel();

    // Tentukan file audio pembuka berdasarkan tipe notifikasi
    let audioFile = "audio/notifOn.mp3"; // Default audio untuk notifikasi sukses

    // Gunakan audio berbeda untuk notifikasi error
    if (type === "error" || type === "not-found") {
      audioFile = "audio/failed.mp3"; // Audio khusus untuk error
    }

    // Putar audio pembuka yang sesuai
    const openingAudio = new Audio(audioFile);

    // Set volume audio pembuka
    openingAudio.volume = 0.7;

    // Buat instance SpeechSynthesisUtterance untuk pesan
    const utterance = new SpeechSynthesisUtterance();

    // Set bahasa ke Indonesia
    utterance.lang = "id-ID";

    // Set volume dan kecepatan untuk kejelasan yang lebih baik
    utterance.volume = 1; // 0 to 1
    utterance.rate = 1; // Sedikit lebih lambat untuk kejelasan
    utterance.pitch = 1.2; // Sedikit lebih tinggi untuk kejelasan

    // Gunakan suara Indonesia yang telah dimuat
    if (indonesianVoice) {
      utterance.voice = indonesianVoice;
    }

    // Set teks berdasarkan tipe notifikasi
    switch (type) {
      case "success-in":
        utterance.text = staffName ? `Oke ${staffName}` : "Oke";
        break;
      case "success-out":
        utterance.text = staffName ? `${staffName} pulang` : "pulang";
        break;
      case "already-in":
        utterance.text = staffName ? `${staffName} sudah absen` : "sudah absen";
        break;
      case "already-out":
        utterance.text = staffName ? `${staffName} sudah absen` : "sudah absen pulang";
        break;
      case "late":
        utterance.text = staffName ? `${staffName} terlambat` : "terlambat";
        break;
        // TAMBAHAN: Case baru untuk izin terlambat
      case "late-permission":
        utterance.text = staffName ? `${staffName} izin terlambat` : "izin terlambat";
        break;
      case "not-found":
        utterance.text = "Barcode tidak terdaftar";
        break;
      case "error":
        utterance.text = "Terjadi kesalahan";
        break;
      default:
        utterance.text = type; // Gunakan tipe sebagai fallback
    }

    // Tambahkan event untuk debugging
    utterance.onstart = () => {
      console.log("Speech started:", utterance.text);
    };

    utterance.onend = () => {
      console.log("Speech ended");
    };

    utterance.onerror = (event) => {
      console.error("Speech error:", event);
    };

    // Putar audio pembuka dan kemudian baca teks
    openingAudio.onended = () => {
      // Berikan jeda kecil setelah audio pembuka
      setTimeout(() => {
        // Putar suara
        window.speechSynthesis.speak(utterance);

        // Pastikan suara diputar (workaround untuk bug di beberapa browser)
        setTimeout(() => {
          if (window.speechSynthesis.paused) {
            window.speechSynthesis.resume();
          }
        }, 100);
      }, 100); // Jeda 100ms setelah audio pembuka
    };

    // Tangani error pada audio pembuka
    openingAudio.onerror = (error) => {
      console.error("Error playing opening audio:", error);
      // Jika audio pembuka gagal, langsung baca teks
      window.speechSynthesis.speak(utterance);
    };

    // Mulai putar audio pembuka
    openingAudio.play().catch((error) => {
      console.error("Error playing opening audio:", error);
      // Jika audio pembuka gagal, langsung baca teks
      window.speechSynthesis.speak(utterance);
    });
  } catch (error) {
    console.error("Error playing notification sound:", error);
  }
}

// Fungsi untuk menginisialisasi dan memuat suara Indonesia
function initSpeechSynthesis() {
  if ("speechSynthesis" in window) {
    // Fungsi untuk mencari suara Indonesia
    const findIndonesianVoice = () => {
      const voices = window.speechSynthesis.getVoices();

      // Cari suara Indonesia atau Melayu (sebagai fallback)
      const idVoice = voices.find((voice) => voice.lang.includes("id-ID") || voice.lang.includes("id"));

      // Jika tidak ada suara Indonesia, coba cari suara Melayu
      const msVoice = voices.find((voice) => voice.lang.includes("ms-MY") || voice.lang.includes("ms"));

      // Jika masih tidak ada, gunakan suara default
      indonesianVoice = idVoice || msVoice || voices.find((v) => v.default) || voices[0];

      if (indonesianVoice) {
        // Test suara
        const testUtterance = new SpeechSynthesisUtterance("Sistem absensi siap digunakan");
        testUtterance.voice = indonesianVoice;
        testUtterance.lang = "id-ID";
        testUtterance.volume = 0.5; // Lebih pelan untuk test
        window.speechSynthesis.speak(testUtterance);
      } else {
        console.warn("No suitable voice found");
      }
    };

    // Periksa apakah suara sudah dimuat
    if (window.speechSynthesis.getVoices().length > 0) {
      findIndonesianVoice();
    } else {
      // Jika belum, tunggu event onvoiceschanged
      window.speechSynthesis.onvoiceschanged = findIndonesianVoice;
    }
  } else {
    console.warn("Speech synthesis not supported in this browser");
  }
}

/**
 * Fungsi yang dioptimalkan untuk menangani bug umum pada Web Speech API
 * Hanya menerapkan perbaikan untuk bug yang benar-benar relevan
 */
function fixSpeechSynthesisBugs() {
  // Deteksi browser untuk penanganan bug yang spesifik
  const isChrome = navigator.userAgent.indexOf("Chrome") !== -1;
  const isSafari = navigator.userAgent.indexOf("Safari") !== -1 && navigator.userAgent.indexOf("Chrome") === -1;

  // Bug di Chrome: speechSynthesis berhenti setelah sekitar 15 detik
  // Hanya terapkan di Chrome untuk menghindari interval yang tidak perlu di browser lain
  if (isChrome && window.speechSynthesis) {
    console.log("Applying Chrome-specific speech synthesis fix");

    // Gunakan variabel untuk menyimpan interval agar bisa dihapus jika perlu
    let resumeInterval = null;

    // Fungsi untuk memeriksa dan melanjutkan speechSynthesis
    const checkAndResumeSpeech = () => {
      if (window.speechSynthesis.paused) {
        console.log("Resuming paused speech synthesis");
        window.speechSynthesis.resume();
      }
    };

    // Hanya aktifkan interval ketika ada utterance yang sedang diproses
    window.speechSynthesis.addEventListener("start", () => {
      if (!resumeInterval) {
        resumeInterval = setInterval(checkAndResumeSpeech, 5000);
      }
    });

    // Hentikan interval ketika tidak ada utterance yang diproses
    window.speechSynthesis.addEventListener("end", () => {
      if (resumeInterval && !window.speechSynthesis.pending && !window.speechSynthesis.speaking) {
        clearInterval(resumeInterval);
        resumeInterval = null;
      }
    });
  }

  // Bug di beberapa browser: speechSynthesis tidak berfungsi setelah tab tidak aktif
  // Ini adalah masalah umum di banyak browser, jadi tetap terapkan
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && window.speechSynthesis) {
      // Hanya reset jika ada utterance yang tertunda atau sedang berbicara
      if (window.speechSynthesis.pending || window.speechSynthesis.speaking) {
        console.log("Tab became visible, resetting speech synthesis");
        window.speechSynthesis.cancel();
      }
    }
  });

  // Bug di Safari: speechSynthesis memerlukan interaksi pengguna
  if (isSafari && window.speechSynthesis) {
    console.log("Applying Safari-specific speech synthesis fix");

    // Tambahkan event listener untuk interaksi pengguna pertama
    const initSafariSpeech = () => {
      // Buat utterance kosong untuk "mengaktifkan" speechSynthesis
      const utterance = new SpeechSynthesisUtterance("");
      utterance.volume = 0; // Tidak terdengar
      window.speechSynthesis.speak(utterance);

      // Hapus event listener setelah digunakan
      document.removeEventListener("click", initSafariSpeech);
    };

    document.addEventListener("click", initSafariSpeech, { once: true });
  }
}

// Fungsi untuk memuat data kehadiran dan izin hari ini
async function loadTodayAttendance(forceRefresh = false) {
  try {
    const today = getLocalDateString();

    // Cek apakah perlu refresh stats berdasarkan TTL atau forceRefresh
    const needStatsRefresh = forceRefresh || Date.now() - statsLastUpdated > STATS_CACHE_TTL;

    // Jika tidak perlu refresh dan data sudah ada di cache, gunakan data cache
    if (!needStatsRefresh && attendanceCache.has(today) && leaveRequests.length > 0) {
      console.log("Using cached attendance and leave data");
      attendanceRecords = attendanceCache.get(today);
      // Update UI dengan data cache
      updateStats();
      return;
    }

    // Tampilkan loading indicator hanya jika akan refresh data
    if (needStatsRefresh) {
      const leaveCountEl = document.getElementById("leaveCount");
      if (leaveCountEl) {
        leaveCountEl.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
      }

      // Load attendance data
      attendanceRecords = await getTodayAttendance();

      // Load leave requests
      try {
        leaveRequests = await getAllLeaveRequestsForDate(today, forceRefresh);
      } catch (leaveError) {
        console.error("Error loading leave requests:", leaveError);
        leaveRequests = [];
      }

      // Update UI
      updateStats();

      // Cache attendance data
      attendanceCache.set(today, [...attendanceRecords]);

      // Update timestamp cache
      statsLastUpdated = Date.now();
    }

    // Tampilkan pesan jika refresh dipaksa
    if (forceRefresh && needStatsRefresh) {
      if (typeof showAlert === "function") {
        showAlert("success", "Data berhasil diperbarui dari server", 3000);
      } else {
        showScanResult("success", "Data berhasil diperbarui dari server");
      }
    }
  } catch (error) {
    console.error("Error loading today's attendance:", error);

    // Use showScanResult instead of showAlert if showAlert is not available
    if (typeof showAlert === "function") {
      showAlert("danger", "Gagal memuat data kehadiran: " + error.message, 5000);
    } else {
      showScanResult("error", "Gagal memuat data kehadiran");
    }
  }
}

// Tambahkan fungsi untuk memicu event saat ada scan baru
function notifyAttendanceUpdate(date) {
  const event = new CustomEvent("attendanceScanUpdated", {
    detail: { date: date, timestamp: Date.now() },
  });
  window.dispatchEvent(event);
}

// Tambahkan fungsi untuk menampilkan informasi tanggal
function updateDateInfo() {
  const today = new Date();
  const dateInfoEl = document.getElementById("dateInfo");

  if (dateInfoEl) {
    const options = {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    };

    dateInfoEl.textContent = today.toLocaleDateString("id-ID", options);
  } else {
    console.warn("dateInfo element not found");
  }
}

function updateStats() {
  // Gunakan fungsi helper untuk mendapatkan tanggal hari ini
  const today = getLocalDateString();

  // PERBAIKAN: Gunakan data dari cache jika tersedia
  let todayRecords;

  // Cek apakah data hari ini tersedia di cache
  if (attendanceCache.has(today)) {
    console.log("Using cached attendance data for stats");
    todayRecords = attendanceCache.get(today);
  } else {
    // Jika tidak ada di cache, gunakan data dari variabel global
    // dan filter berdasarkan tanggal
    todayRecords = attendanceRecords.filter((record) => {
      // Jika record.date adalah string, bandingkan langsung
      if (typeof record.date === "string") {
        return record.date === today;
      }

      // Jika record.date adalah Date, konversi ke string format YYYY-MM-DD
      if (record.date instanceof Date) {
        const recordDateStr = getLocalDateStringFromDate(record.date);
        return recordDateStr === today;
      }

      // Fallback: coba konversi ke string dan bandingkan
      return String(record.date) === today;
    });

    // Simpan hasil filter ke cache untuk penggunaan berikutnya
    attendanceCache.set(today, todayRecords);
  }

  // PERBAIKAN: Hitung statistik dengan lebih teliti
  let presentCount = 0;
  let lateCount = 0;
  let latePermissionCount = 0;

  // Hitung berdasarkan status
  todayRecords.forEach((record) => {
    // PERBAIKAN: Periksa status dengan lebih teliti dan case-insensitive
    const status = record.status ? record.status.toLowerCase() : "";
    
    if (status.includes("izin terlambat")) {
      latePermissionCount++;
      presentCount++; // Karyawan izin terlambat juga dihitung sebagai hadir
    } else if (status.includes("terlambat")) {
      lateCount++;
      presentCount++; // Karyawan terlambat juga dihitung sebagai hadir
    } else if (status.includes("tepat waktu") || status === "present") {
      presentCount++;
    }
  });

  // PERBAIKAN: Gunakan data izin yang sudah di-cache
  // Tidak perlu query baru ke Firestore
  const leaveCount = Array.isArray(leaveRequests) 
    ? leaveRequests.filter(leave => {
        // Pastikan leave valid dan memiliki status
        if (!leave || !leave.status) return false;
        
        // Hanya hitung izin yang disetujui
        const status = leave.status.toLowerCase();
        return status === "approved" || status === "disetujui";
      }).length 
    : 0;

  // Update UI
  const presentCountEl = document.getElementById("presentCount");
  if (presentCountEl) {
    presentCountEl.textContent = presentCount;
  } else {
    console.warn("presentCount element not found");
  }

  const lateCountEl = document.getElementById("lateCount");
  if (lateCountEl) {
    lateCountEl.textContent = lateCount;
  } else {
    console.warn("lateCount element not found");
  }

  // PERBAIKAN: Update counter izin terlambat
  const latePermissionCountEl = document.getElementById("latePermissionCount");
  if (latePermissionCountEl) {
    latePermissionCountEl.textContent = latePermissionCount;
  } else {
    console.warn("latePermissionCount element not found");
  }

  const leaveCountEl = document.getElementById("leaveCount");
  if (leaveCountEl) {
    leaveCountEl.textContent = leaveCount;
  } else {
    console.warn("leaveCount element not found");
  }

  // Update tanggal absensi
  updateDateInfo();
  
  // Log untuk debugging
  console.log(`Stats updated: ${presentCount} present, ${lateCount} late, ${latePermissionCount} late with permission, ${leaveCount} on leave`);
}


// Helper function untuk mendapatkan string tanggal dari objek Date
function getLocalDateStringFromDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// Inisialisasi event listeners saat DOM sudah siap
document.addEventListener("DOMContentLoaded", async () => {
  try {
     // Tampilkan/sembunyikan form izin terlambat berdasarkan radio button
     const scanTypeLatePerm = document.getElementById("scanTypeLatePerm");
     const scanTypeIn = document.getElementById("scanTypeIn");
     const scanTypeOut = document.getElementById("scanTypeOut");
     const latePermissionForm = document.getElementById("latePermissionForm");
     
     // Fungsi untuk menangani tampilan form izin terlambat
     function handleLatePermissionFormVisibility() {
       if (latePermissionForm) {
         // Cek apakah radio button izin terlambat dipilih
         const isLatePermSelected = scanTypeLatePerm && scanTypeLatePerm.checked;
         
         // Tampilkan/sembunyikan form berdasarkan status radio button
         latePermissionForm.style.display = isLatePermSelected ? "block" : "none";
         
         // Reset form jika tidak dipilih
         if (!isLatePermSelected && latePermissionForm.querySelector("input")) {
           latePermissionForm.querySelector("input").value = "";
         }
       }
     }
     
     // Panggil fungsi saat halaman dimuat untuk mengatur status awal
     handleLatePermissionFormVisibility();
     
     // Tambahkan event listener untuk semua radio button
     if (scanTypeLatePerm) {
       scanTypeLatePerm.addEventListener("change", handleLatePermissionFormVisibility);
     }
     
     if (scanTypeIn) {
       scanTypeIn.addEventListener("change", handleLatePermissionFormVisibility);
     }
     
     if (scanTypeOut) {
       scanTypeOut.addEventListener("change", handleLatePermissionFormVisibility);
     }
  
  // TAMBAHAN: Tambahkan event listener untuk radio button scan type dan shift
  
  const shiftMorning = document.getElementById("shiftMorning");
  const shiftAfternoon = document.getElementById("shiftAfternoon");
  
  // Event listener untuk scan type
  if (scanTypeIn) {
    scanTypeIn.addEventListener("change", updateFaceVerificationBasedOnScanAndShift);
  }
  
  if (scanTypeOut) {
    scanTypeOut.addEventListener("change", updateFaceVerificationBasedOnScanAndShift);
  }
  
  // Event listener untuk shift
  if (shiftMorning) {
    shiftMorning.addEventListener("change", updateFaceVerificationBasedOnScanAndShift);
  }
  
  if (shiftAfternoon) {
    shiftAfternoon.addEventListener("change", updateFaceVerificationBasedOnScanAndShift);
  }

    // Inisialisasi status verifikasi wajah berdasarkan radio button saat ini
    updateFaceVerificationBasedOnScanAndShift();

    // Inisialisasi Web Speech API
    initSpeechSynthesis();

    // Perbaiki bug umum pada Web Speech API
    fixSpeechSynthesisBugs();

    // Preload audio untuk mengurangi delay
    if (isOpeningAudioAvailable) {
      const preloadAudio = new Audio("audio/notifOn.mp3");
      preloadAudio.preload = "auto";
      preloadAudio.load();
    }

    // Atur radio button berdasarkan waktu saat ini
    setRadioButtonsByTime();

    // Atur timer untuk memperbarui radio button setiap menit
    setInterval(setRadioButtonsByTime, 60000);

    // Setup barcode scanner detection - ini adalah satu-satunya setup yang diperlukan
    setupBarcodeScanner();

    // TAMBAHAN: Inisialisasi verifikasi wajah jika fitur diaktifkan
    if (isFaceVerificationEnabled) {
      console.log("Memulai inisialisasi verifikasi wajah...");

      // Tambahkan toggle switch untuk mengaktifkan/menonaktifkan verifikasi wajah
      const scannerHeader = document.querySelector(".scanner-card .card-header");
      if (scannerHeader) {
        const faceVerificationToggle = document.createElement("div");
        faceVerificationToggle.className = "face-verification-toggle ms-2";
        faceVerificationToggle.innerHTML = `
          <div class="form-check form-switch d-none">
            <input class="form-check-input" type="checkbox" id="faceVerificationToggle" ${
              isFaceVerificationEnabled ? "checked" : ""
            }>
            <label class="form-check-label" for="faceVerificationToggle">Verifikasi Wajah</label>
          </div>
        `;
        scannerHeader.appendChild(faceVerificationToggle);

        // Tambahkan event listener untuk toggle dengan perbaikan
        const toggleElement = document.getElementById("faceVerificationToggle");
        if (toggleElement) {
          toggleElement.addEventListener("change", function () {
            // Update variabel global
            isFaceVerificationEnabled = this.checked;
            console.log(`Verifikasi wajah ${isFaceVerificationEnabled ? "diaktifkan" : "dinonaktifkan"}`);

            // Simpan preferensi ke localStorage agar tetap konsisten setelah refresh
            localStorage.setItem("faceVerificationEnabled", isFaceVerificationEnabled ? "true" : "false");

            // Tampilkan pesan konfirmasi
            showScanResult(
              "info",
              `Verifikasi wajah telah ${isFaceVerificationEnabled ? "diaktifkan" : "dinonaktifkan"}`,
              false,
              true,
              2000
            );

            // Sembunyikan/tampilkan UI terkait verifikasi wajah
            const faceVerificationContainer = document.querySelector(".face-verification-container");
            if (faceVerificationContainer) {
              faceVerificationContainer.style.display = isFaceVerificationEnabled ? "block" : "none";
            }

            // Sembunyikan/tampilkan tombol inisialisasi kamera
            const initCameraButton = document.getElementById("initCamera");
            if (initCameraButton) {
              initCameraButton.style.display = isFaceVerificationEnabled ? "inline-block" : "none";
            }

            // Sembunyikan/tampilkan tombol reset data wajah
            const resetFaceButton = document.getElementById("resetFaceData");
            if (resetFaceButton) {
              resetFaceButton.style.display = isFaceVerificationEnabled ? "inline-block" : "none";
            }

            // Jika verifikasi wajah diaktifkan, coba inisialisasi di background
            if (isFaceVerificationEnabled && !isFaceVerificationInitialized) {
              initializeFaceVerification().then((success) => {
                console.log("Background face verification initialization:", success ? "success" : "failed");
              });
            }

            // Jika verifikasi wajah dinonaktifkan, hentikan kamera jika sedang aktif
            if (!isFaceVerificationEnabled && videoStream) {
              stopCamera();
            }
          });

          // Inisialisasi toggle berdasarkan nilai yang tersimpan di localStorage
          const savedPreference = localStorage.getItem("faceVerificationEnabled");
          if (savedPreference !== null) {
            const isEnabled = savedPreference === "true";
            // Hanya update jika berbeda dari nilai default
            if (isEnabled !== isFaceVerificationEnabled) {
              toggleElement.checked = isEnabled;
              isFaceVerificationEnabled = isEnabled;

              // Trigger event change untuk menerapkan perubahan UI
              const event = new Event("change");
              toggleElement.dispatchEvent(event);
            }
          }
        }
      }

      // Sembunyikan UI verifikasi wajah jika fitur dinonaktifkan
      const faceVerificationContainer = document.querySelector(".face-verification-container");
      if (faceVerificationContainer) {
        faceVerificationContainer.style.display = isFaceVerificationEnabled ? "block" : "none";
      }

      // // TAMBAHAN: Tambahkan event listener untuk radio button scan type
      // const scanTypeIn = document.getElementById("scanTypeIn");
      // const scanTypeOut = document.getElementById("scanTypeOut");

      // if (scanTypeIn) {
      //   scanTypeIn.addEventListener("change", function () {
      //     if (this.checked) {
      //       updateFaceVerificationToggleBasedOnScanType(true);
      //     }
      //   });
      // }

      // if (scanTypeOut) {
      //   scanTypeOut.addEventListener("change", function () {
      //     if (this.checked) {
      //       updateFaceVerificationToggleBasedOnScanType(false);
      //     }
      //   });
      // }

      // Coba inisialisasi model di background
      try {
        await loadFaceApiModels();
        console.log("Model verifikasi wajah berhasil dimuat");

        // Tambahkan tombol untuk reset data wajah
        const scannerContainer = document.querySelector(".scanner-container");
        if (scannerContainer) {
          const resetFaceButton = document.createElement("button");
          resetFaceButton.id = "resetFaceData";
          resetFaceButton.className = "btn btn-sm btn-outline-warning mt-2";
          resetFaceButton.innerHTML = '<i class="fas fa-redo-alt"></i> Reset Data Wajah';
          scannerContainer.appendChild(resetFaceButton);

          // Tambahkan event listener untuk tombol reset
          resetFaceButton.addEventListener("click", async function () {
            const barcodeInput = document.getElementById("barcodeInput");
            if (!barcodeInput || !barcodeInput.value.trim()) {
              showScanResult("error", "Scan barcode terlebih dahulu untuk mereset data wajah");
              return;
            }

            const barcode = barcodeInput.value.trim();
            try {
              await deleteFaceDescriptor(barcode);
              showScanResult(
                "success",
                "Data wajah berhasil direset. Silakan scan ulang untuk menyimpan data wajah baru."
              );
            } catch (error) {
              console.error("Error saat mereset data wajah:", error);
              showScanResult("error", "Gagal mereset data wajah");
            }
          });
        }
      } catch (error) {
        console.error("Gagal memuat model verifikasi wajah:", error);
        showScanResult("error", "Gagal memuat model verifikasi wajah. Fitur dinonaktifkan.");

        // Nonaktifkan fitur jika gagal memuat model
        isFaceVerificationEnabled = false;

        // Update toggle switch
        const faceVerificationToggle = document.getElementById("faceVerificationToggle");
        if (faceVerificationToggle) {
          faceVerificationToggle.checked = false;
          faceVerificationToggle.disabled = true;
        }
      }
    }

    // Setup refresh scanner button
    const refreshScanner = document.getElementById("refreshScanner");
    if (refreshScanner) {
      refreshScanner.addEventListener("click", function () {
        const barcodeInput = document.getElementById("barcodeInput");
        if (barcodeInput) {
          barcodeInput.value = "";
          barcodeInput.focus();
          barcodeInput.dataset.isScanner = "false";
        }
        const scanResult = document.getElementById("scanResult");
        if (scanResult) {
          scanResult.style.display = "none";
        }

        // TAMBAHAN: Sembunyikan UI verifikasi wajah saat refresh
        if (isFaceVerificationEnabled) {
          const faceVerificationContainer = document.querySelector(".face-verification-container");
          if (faceVerificationContainer) {
            faceVerificationContainer.style.display = "none";
          }
        }
      });
    }

    // Setup manual submit button
    const manualSubmit = document.getElementById("manualSubmit");
    if (manualSubmit) {
      manualSubmit.addEventListener("click", function () {
        const barcodeInput = document.getElementById("barcodeInput");
        if (barcodeInput && barcodeInput.dataset.isScanner === "true") {
          processScannedBarcode(barcodeInput.value.trim());
          barcodeInput.value = "";
        } else {
          showScanResult("error", "Gunakan scanner barcode! Input manual tidak diizinkan.");
          playNotificationSound("error");
          if (barcodeInput) barcodeInput.value = "";
        }
      });
    }

    // PERBAIKAN: Tambahkan event listener untuk memperbarui data saat ada perubahan
    window.addEventListener("attendanceScanUpdated", function (event) {
      // Perbarui stats tanpa melakukan query baru ke Firestore
      if (event.detail && event.detail.date === getLocalDateString()) {
        console.log("Attendance scan updated, refreshing stats");
        // Hanya perbarui UI tanpa query baru
        updateStats();
      }
    });

    // Load data
    await Promise.all([loadEmployees(), loadTodayAttendance()]);

    // PERBAIKAN: Bersihkan cache yang sudah tidak relevan
    cleanupAttendanceCache();

    // Fokus pada input barcode setelah semua inisialisasi
    const barcodeInput = document.getElementById("barcodeInput");
    if (barcodeInput) {
      barcodeInput.focus();
    }

    // TAMBAHAN: Inisialisasi kamera jika verifikasi wajah diaktifkan
    if (isFaceVerificationEnabled) {
      // Inisialisasi kamera hanya saat diperlukan untuk menghemat sumber daya
      const initCameraButton = document.createElement("button");
      initCameraButton.id = "initCamera";
      initCameraButton.className = "btn btn-sm btn-outline-primary mt-2 me-2";
      initCameraButton.innerHTML = '<i class="fas fa-camera"></i> Siapkan Kamera';

      // Tambahkan tombol ke container yang sesuai
      const scannerContainer = document.querySelector(".scanner-container");
      if (scannerContainer && !document.getElementById("initCamera")) {
        scannerContainer.appendChild(initCameraButton);

        // Tambahkan event listener
        initCameraButton.addEventListener("click", async function () {
          try {
            this.disabled = true;
            this.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Menyiapkan...';

            // Inisialisasi kamera
            const result = await initCamera();
            if (result) {
              showScanResult("success", "Kamera siap digunakan untuk verifikasi wajah");
              isFaceVerificationReady = true;

              // Sembunyikan tombol setelah berhasil
              this.style.display = "none";
            } else {
              showScanResult("error", "Gagal menyiapkan kamera. Periksa izin kamera.");
              this.disabled = false;
              this.innerHTML = '<i class="fas fa-camera"></i> Coba Lagi';
            }
          } catch (error) {
            console.error("Error saat inisialisasi kamera:", error);
            showScanResult("error", "Terjadi kesalahan saat menyiapkan kamera");
            this.disabled = false;
            this.innerHTML = '<i class="fas fa-camera"></i> Coba Lagi';
          }
        });
      }
    }
  } catch (error) {
    console.error("Error initializing attendance system:", error);
  }

  // Tambahkan event listener untuk tombol refresh
  const refreshBtn = document.getElementById("refreshLeaveData");
  if (refreshBtn) {
    refreshBtn.addEventListener("click", function () {
      // Tampilkan loading state
      this.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
      this.disabled = true;

      // Refresh data
      loadTodayAttendance(true).finally(() => {
        // Kembalikan tombol ke keadaan semula
        this.innerHTML = '<i class="fas fa-sync-alt"></i> Refresh Data';
        this.disabled = false;
      });
    });
  }
});

// PERBAIKAN: Tambahkan fungsi untuk membersihkan cache yang sudah tidak relevan
function cleanupAttendanceCache() {
  try {
    const now = Date.now();
    const today = getLocalDateString();
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const oneWeekAgoStr = getLocalDateStringFromDate(oneWeekAgo);

    // Hapus cache untuk tanggal yang lebih lama dari seminggu yang lalu
    for (const [key, value] of cacheMeta.entries()) {
      // Jika key adalah tanggal (format YYYY-MM-DD) dan lebih lama dari seminggu
      if (key.match(/^\d{4}-\d{2}-\d{2}$/) && key < oneWeekAgoStr && key !== today) {
        console.log(`Removing old cache for date: ${key}`);
        cacheMeta.delete(key);
        attendanceCache.delete(key);
      }
    }

    // Simpan perubahan ke localStorage
    saveAttendanceCacheToStorage();

    console.log("Attendance cache cleanup completed");
    return true;
  } catch (error) {
    console.error("Error cleaning up attendance cache:", error);
    return false;
  }
}

// Helper function to format employee type
function formatEmployeeType(type) {
  return type === "staff" ? "Staff" : "Office Boy";
}

// Helper function to format shift
function formatShift(shift) {
  return shift === "morning" ? "Pagi" : "Sore";
}

/**
 * Fungsi terpadu untuk menampilkan pesan hasil scan atau alert
 * @param {string} type - Tipe pesan: "success", "error", "warning", "info"
 * @param {string} message - Pesan yang akan ditampilkan
 * @param {boolean} isAlert - Apakah pesan ditampilkan sebagai alert (true) atau scan result (false)
 * @param {boolean} autoHide - Apakah pesan otomatis disembunyikan setelah beberapa detik
 * @param {number} duration - Durasi tampilan dalam milidetik
 */
function showScanResult(type, message, isAlert = false, autoHide = true, duration = 3000) {
  try {
    if (!isAlert) {
      // Tampilkan pesan di area scan result
      const scanResult = document.getElementById("scanResult");
      if (!scanResult) return;

      // Set class dan pesan
      scanResult.className = "scan-result " + type;
      scanResult.innerHTML = message;
      scanResult.style.display = "block";

      // Auto hide jika diperlukan
      if (autoHide) {
        setTimeout(() => {
          scanResult.style.display = "none";
        }, duration);
      }
    } else {
      // Tampilkan sebagai alert umum
      let alertContainer = document.getElementById("alertContainer");

      // Buat container jika belum ada
      if (!alertContainer) {
        alertContainer = document.createElement("div");
        alertContainer.id = "alertContainer";
        alertContainer.className = "alert-container";
        document.body.appendChild(alertContainer);
      }

      // Buat alert element
      const alertEl = document.createElement("div");
      alertEl.className = `alert alert-${type} alert-dismissible fade show`;
      alertEl.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
      `;

      // Tambahkan ke container
      alertContainer.appendChild(alertEl);

      // Auto hide jika diperlukan
      if (autoHide) {
        setTimeout(() => {
          alertEl.classList.remove("show");
          setTimeout(() => alertEl.remove(), 300);
        }, duration);
      }

      return alertEl;
    }
  } catch (error) {
    console.error("Error showing message:", error);
  }
}

/**
 * Fungsi untuk menyembunyikan pesan
 * @param {boolean} isAlert - Apakah yang disembunyikan adalah alert (true) atau scan result (false)
 */
function hideScanResult(isAlert = false) {
  try {
    if (!isAlert) {
      const scanResult = document.getElementById("scanResult");
      if (scanResult) {
        scanResult.style.display = "none";
      }
    } else {
      const alerts = document.querySelectorAll(".alert");
      alerts.forEach((alert) => {
        alert.classList.remove("show");
        setTimeout(() => alert.remove(), 300);
      });
    }
  } catch (error) {
    console.error("Error hiding messages:", error);
  }
}

// Alias untuk showAlert untuk kompatibilitas dengan kode yang sudah ada
function showAlert(type, message, autoHide = true, duration = 5000) {
  return showScanResult(type, message, true, autoHide, duration);
}

// Alias untuk hideAlert untuk kompatibilitas dengan kode yang sudah ada
function hideAlert() {
  hideScanResult(true);
}

// Get threshold time for lateness calculation
function getThresholdTime(employeeType, shift) {
  const thresholds = {
    staff: {
      morning: new Date("1970-01-01T08:50:00"),
      afternoon: new Date("1970-01-01T14:21:00"),
    },
    ob: {
      morning: new Date("1970-01-01T07:31:00"),
      afternoon: new Date("1970-01-01T13:46:00"),
    },
  };

  // Validasi employeeType dan shift
  if (!employeeType || !shift || !thresholds[employeeType] || !thresholds[employeeType][shift]) {
    console.warn(`Invalid employee type or shift: ${employeeType}, ${shift}`);
    // Default ke staff morning jika tipe atau shift tidak valid
    return thresholds.staff.morning;
  }

  return thresholds[employeeType][shift];
}

// Check if employee is late based on type and shift
function checkIfLate(timeString, employeeType, shift) {
  const time = new Date(`1970-01-01T${timeString}`);
  const threshold = getThresholdTime(employeeType, shift);

  // Check if time is later than threshold
  return time > threshold;
}

// Load employees and cache them
async function loadEmployees() {
  try {
    // Periksa apakah cache perlu diperbarui berdasarkan TTL
    if (employeeCache.size === 0 || shouldUpdateEmployeeCache()) {
      employees = await getEmployees();

      // Cache employees by barcode for faster lookup
      employees.forEach((employee) => {
        if (employee.barcode) {
          employeeCache.set(employee.barcode, employee);
        }
      });

      // Update timestamp
      employeeCacheTimestamp = Date.now();
    }
  } catch (error) {
    console.error("Error loading employees:", error);
  }
}

// Export fungsi dan cache yang diperlukan
export { loadTodayAttendance, attendanceCache, employeeCache };
