// Import semua service yang dibutuhkan
import { findEmployeeByBarcode, getEmployees } from "../services/employee-service.js";
import {
  recordAttendance,
  updateAttendanceOut,
  getTodayAttendance,
  getLocalDateString,
} from "../services/attendance-service.js";
import { getLeaveRequestsByDate, getAllLeaveRequestsForDate, clearLeaveCacheForDate } from "../services/leave-service.js";

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
let barcodeBuffer = '';
let lastKeyTime = 0;
let isBarcodeScanner = false;
const SCANNER_CHARACTER_DELAY_THRESHOLD = 50; // Maksimum delay antar karakter (ms) untuk scanner
const SCANNER_COMPLETE_DELAY = 500; // Waktu tunggu setelah input selesai (ms)
let scannerTimeoutId = null;

// Tambahkan variabel global untuk mencegah pemrosesan barcode duplikat
let lastProcessedBarcode = '';
let lastProcessedTime = 0;
const BARCODE_COOLDOWN_MS = 3000; // Waktu tunggu 3 detik sebelum barcode yang sama bisa diproses lagi

// Tambahkan konstanta untuk TTL
const CACHE_TTL_STANDARD = 60 * 60 * 1000; // 1 jam
const CACHE_TTL_TODAY = 5 * 60 * 1000;     // 5 menit untuk data hari ini

// Tambahkan variabel untuk menyimpan timestamp cache stats
let statsLastUpdated = 0;
const STATS_CACHE_TTL = 60000; // 1 menit

// Modifikasi fungsi shouldUpdateCache
function shouldUpdateCache(cacheKey) {
  if (!cacheMeta.has(cacheKey)) return true;
  
  const lastUpdate = cacheMeta.get(cacheKey);
  const now = Date.now();
  
  // Jika cache key adalah tanggal hari ini, gunakan TTL yang lebih pendek
  const today = getLocalDateString();
  if (cacheKey === today) {
    return (now - lastUpdate) > CACHE_TTL_TODAY;
  }
  
  // Untuk data lain, gunakan TTL standar
  return (now - lastUpdate) > CACHE_TTL_STANDARD;
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
    if (error.name === 'QuotaExceededError') {
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
    const threeDaysAgo = now - (3 * 24 * 60 * 60 * 1000);
    
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
      if (key.startsWith('report_') || key.startsWith('temp_')) {
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
  return (now - employeeCacheTimestamp) > EMPLOYEE_CACHE_TTL;
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
    { start: 7 * 60, end: 13 * 60, scanType: "in", shift: "morning" },     // 07:00-13:00: Scan masuk + Shift pagi
    { start: 13 * 60 + 30, end: 16 * 60, scanType: "in", shift: "afternoon" }, // 13:30-16:00: Scan masuk + Shift sore
    { start: 16 * 60 + 20, end: 17 * 60 + 30, scanType: "out", shift: "morning" }, // 16:20-17:30: Scan pulang + Shift pagi
    { start: 21 * 60, end: 23 * 60, scanType: "out", shift: "afternoon" }  // 21:00-23:00: Scan pulang + Shift sore
  ];
  
  // Cari rentang waktu yang sesuai
  const currentRange = ranges.find(range => currentTime >= range.start && currentTime <= range.end);
  
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
  barcodeBuffer = '';
  
  // Nonaktifkan paste untuk mencegah input manual dengan copy-paste
  barcodeInput.addEventListener("paste", function(e) {
    e.preventDefault();
    showScanResult("error", "Gunakan scanner barcode! Paste tidak diizinkan.");
    playNotificationSound('error');
  });
  
  // Tambahkan event listener untuk keydown untuk mendeteksi scanner
  barcodeInput.addEventListener("keydown", function(e) {
    const currentTime = new Date().getTime();
    
    // Jika ini adalah karakter pertama atau jeda antar karakter sangat cepat (tipikal scanner)
    if (barcodeBuffer === '' || (currentTime - lastKeyTime) < SCANNER_CHARACTER_DELAY_THRESHOLD) {
      // Kemungkinan ini adalah scanner barcode
      isBarcodeScanner = true;
    } else if ((currentTime - lastKeyTime) > SCANNER_CHARACTER_DELAY_THRESHOLD) {
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
    scannerTimeoutId = setTimeout(function() {
      isBarcodeScanner = false;
      barcodeInput.dataset.isScanner = "false";
      
      // Jika ada input tapi tidak ada Enter, kemungkinan input manual
      if (barcodeInput.value.length > 0) {
        showScanResult("error", "Gunakan scanner barcode! Input manual tidak diizinkan.");
        playNotificationSound('error');
        barcodeInput.value = "";
      }
    }, SCANNER_COMPLETE_DELAY);
  });
  
  // Tambahkan event listener untuk keypress dengan debounce untuk Enter
  let lastEnterTime = 0;
  const ENTER_DEBOUNCE_MS = 1000; // Debounce 1 detik untuk tombol Enter
  
  barcodeInput.addEventListener("keypress", async function(e) {
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
        playNotificationSound('error');
        this.value = "";
      }
      
      // Reset status scanner
      isBarcodeScanner = false;
      this.dataset.isScanner = "false";
    }
  });
}

// Hapus seluruh fungsi processBarcode() yang lama

// Perbaiki fungsi processScannedBarcode() untuk mencakup semua logika yang diperlukan
async function processScannedBarcode(barcode) {
  // Validasi input barcode
  if (!barcode) {
    showScanResult("error", "Barcode tidak boleh kosong!");
    playNotificationSound('error', '');
    return;
  }
  
  // Cek apakah barcode ini baru saja diproses (dalam 3 detik terakhir)
  const currentTime = Date.now();
  if (barcode === lastProcessedBarcode && (currentTime - lastProcessedTime) < BARCODE_COOLDOWN_MS) {
    console.log(`Barcode ${barcode} diabaikan - sudah diproses dalam ${BARCODE_COOLDOWN_MS}ms terakhir`);
    showScanResult("warning", "Scan terlalu cepat, harap tunggu beberapa detik");
    return;
  }
  
  // Update variabel tracking barcode
  lastProcessedBarcode = barcode;
  lastProcessedTime = currentTime;
  
  console.log("Processing scanned barcode:", barcode);
  
  try {
    // Current time
    const now = new Date();
    const timeString = now.toTimeString().split(" ")[0];
    
    // Gunakan fungsi helper untuk mendapatkan tanggal hari ini
    const today = getLocalDateString();
    
    console.log("Today's date for attendance:", today);
    console.log("Current time:", now);

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

    if (!employee) {
      showScanResult("error", "Barcode tidak valid!");
      playNotificationSound('not-found', '');
      return;
    }

    // Get scan type (in/out)
    const scanType = document.querySelector('input[name="scanType"]:checked')?.value || "in";
    
    // Get selected shift
    const selectedShift = document.querySelector('input[name="shiftOption"]:checked')?.value || "morning";

    // Cek apakah data kehadiran hari ini sudah di-cache
    let todayRecords = attendanceCache.get(today) || [];
    
    // Cari record kehadiran karyawan ini
    const existingRecord = todayRecords.find(
      (record) => record.employeeId === employee.employeeId && 
                  (record.date === today || 
                   (record.date instanceof Date && getLocalDateStringFromDate(record.date) === today))
    );

    if (scanType === "in") {
      // Check if already checked in
      if (existingRecord && existingRecord.timeIn) {
        showScanResult("error", `${employee.name} sudah melakukan scan masuk hari ini!`);
        playNotificationSound('already-in', employee.name);
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
      };

      console.log("Saving attendance record:", attendance);
      const savedRecord = await recordAttendance(attendance);

      // Update local cache dengan record baru
      if (savedRecord && savedRecord.id) {
        // Tambahkan record baru ke cache
        const newRecord = {
          ...attendance,
          id: savedRecord.id
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

      // Tampilkan pesan sukses
      showScanResult(
        "success",
        `Absensi masuk berhasil: ${employee.name} (${formatEmployeeType(employeeType)} - ${formatShift(shift)}) - ${
          isLate ? `Terlambat ${lateMinutes} menit` : "Tepat Waktu"
        }`
      );
      
      // Play notification sound based on status
      if (isLate) {
        playNotificationSound('late', employee.name);
      } else {
        playNotificationSound('success-in', employee.name);
      }

      // Trigger event untuk update UI
      notifyAttendanceUpdate(today);
      
      // Update UI stats tanpa query baru
      updateStats();
    } else {
      // Scan out logic
      if (!existingRecord) {
        showScanResult("error", `${employee.name} belum melakukan scan masuk hari ini!`);
        playNotificationSound('error', '');
        return;
      }

      if (existingRecord.timeOut) {
        showScanResult("error", `${employee.name} sudah melakukan scan pulang hari ini!`);
        playNotificationSound('already-out', employee.name);
        return;
      }

      // Update attendance with checkout time
      await updateAttendanceOut(existingRecord.id, now);

      // Update local cache
      const updatedRecords = todayRecords.map(record => {
        if (record.id === existingRecord.id) {
          return {
            ...record,
            timeOut: now
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
      playNotificationSound('success-out', employee.name);
      
      // Trigger event untuk update UI
      notifyAttendanceUpdate(today);
      
      // Update UI stats tanpa query baru
      updateStats();
    }
  } catch (error) {
    console.error("Error scanning barcode:", error);
    showScanResult("error", "Terjadi kesalahan saat memproses barcode");
    playNotificationSound('error', '');
  }
  
  // Clear input dan fokus kembali ke input barcode
  const barcodeInput = document.getElementById("barcodeInput");
  if (barcodeInput) {
    barcodeInput.value = "";
    barcodeInput.focus();
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
      if (key.startsWith('range_')) {
        const parts = key.split('_');
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
    if (typeof cacheMeta !== 'undefined' && cacheMeta instanceof Map) {
      cacheMeta.delete(today);
      
      // Hapus juga timestamp untuk range yang mencakup hari ini
      for (const key of cacheMeta.keys()) {
        if (key.startsWith('range_')) {
          const parts = key.split('_');
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
    if (typeof saveAttendanceCacheToStorage === 'function') {
      saveAttendanceCacheToStorage();
    } else {
      // Fallback jika fungsi saveAttendanceCacheToStorage tidak tersedia
      try {
        localStorage.setItem("attendanceCache", JSON.stringify(Object.fromEntries(attendanceCache)));
        if (typeof cacheMeta !== 'undefined' && cacheMeta instanceof Map) {
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
function playNotificationSound(type, staffName = '') {
  // Jika suara dinonaktifkan, keluar dari fungsi
  if (!soundEnabled) return;

  try {
    // Hentikan semua suara yang sedang diputar
    window.speechSynthesis.cancel();

    // Tentukan file audio pembuka berdasarkan tipe notifikasi
    let audioFile = "audio/notifOn.mp3"; // Default audio untuk notifikasi sukses
    
    // Gunakan audio berbeda untuk notifikasi error
    if (type === 'error' || type === 'not-found') {
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
    window.speechSynthesis.addEventListener('start', () => {
      if (!resumeInterval) {
        resumeInterval = setInterval(checkAndResumeSpeech, 5000);
      }
    });
    
    // Hentikan interval ketika tidak ada utterance yang diproses
    window.speechSynthesis.addEventListener('end', () => {
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
      document.removeEventListener('click', initSafariSpeech);
    };
    
    document.addEventListener('click', initSafariSpeech, { once: true });
  }
}


// Fungsi untuk memuat data kehadiran dan izin hari ini
async function loadTodayAttendance(forceRefresh = false) {
  try {
    const today = getLocalDateString();
    
    // Cek apakah perlu refresh stats berdasarkan TTL atau forceRefresh
    const needStatsRefresh = forceRefresh || (Date.now() - statsLastUpdated > STATS_CACHE_TTL);
    
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
      if (typeof showAlert === 'function') {
        showAlert("success", "Data berhasil diperbarui dari server", 3000);
      } else {
        showScanResult("success", "Data berhasil diperbarui dari server");
      }
    }
  } catch (error) {
    console.error("Error loading today's attendance:", error);
    
    // Use showScanResult instead of showAlert if showAlert is not available
    if (typeof showAlert === 'function') {
      showAlert("danger", "Gagal memuat data kehadiran: " + error.message, 5000);
    } else {
      showScanResult("error", "Gagal memuat data kehadiran");
    }
  }
}

// Tambahkan fungsi untuk memicu event saat ada scan baru
function notifyAttendanceUpdate(date) {
  const event = new CustomEvent('attendanceScanUpdated', {
    detail: { date: date, timestamp: Date.now() }
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
    todayRecords = attendanceRecords.filter(record => {
      // Jika record.date adalah string, bandingkan langsung
      if (typeof record.date === 'string') {
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

  // Hitung statistik dari data yang sudah difilter
  const presentCount = todayRecords.length;
  const lateCount = todayRecords.filter((record) => record.status === "Terlambat").length;
  
  // PERBAIKAN: Gunakan data izin yang sudah di-cache
  // Tidak perlu query baru ke Firestore
  const leaveCount = Array.isArray(leaveRequests) ? leaveRequests.length : 0;
  
  // Hitung berdasarkan status (untuk informasi tambahan)
  // Ini tidak memerlukan query baru ke Firestore
  const approvedLeaves = Array.isArray(leaveRequests) 
    ? leaveRequests.filter(leave => 
        leave.status === "Approved" || 
        leave.status === "Disetujui"
      ).length 
    : 0;
  
  const pendingLeaves = Array.isArray(leaveRequests)
    ? leaveRequests.filter(leave => 
        !leave.status || 
        leave.status === "Pending"
      ).length
    : 0;
     
  // Update UI
  const leaveCountEl = document.getElementById("leaveCount");
  if (leaveCountEl) {
    leaveCountEl.textContent = leaveCount;
  }

  // Update UI elements if they exist
  const presentCountEl = document.getElementById("presentCount");
  if (presentCountEl) {
    presentCountEl.textContent = presentCount;
  } else {
    console.warn("presentCount element not found");
  }

  const lateCountEl = document.getElementById("lateCount");
  if (lateCountEl) {
    lateCountEl.textContent = lateCount;
  }
  
  // Update tanggal absensi
  updateDateInfo();
}

// Helper function untuk mendapatkan string tanggal dari objek Date
function getLocalDateStringFromDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Inisialisasi event listeners saat DOM sudah siap
document.addEventListener("DOMContentLoaded", async () => {
  try {
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
    
    // Setup refresh scanner button
    const refreshScanner = document.getElementById("refreshScanner");
    if (refreshScanner) {
      refreshScanner.addEventListener("click", function() {
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
      });
    }

    // Setup manual submit button
    const manualSubmit = document.getElementById("manualSubmit");
    if (manualSubmit) {
      manualSubmit.addEventListener("click", function() {
        const barcodeInput = document.getElementById("barcodeInput");
        if (barcodeInput && barcodeInput.dataset.isScanner === "true") {
          processScannedBarcode(barcodeInput.value.trim());
          barcodeInput.value = "";
        } else {
          showScanResult("error", "Gunakan scanner barcode! Input manual tidak diizinkan.");
          playNotificationSound('error');
          if (barcodeInput) barcodeInput.value = "";
        }
      });
    }

    // PERBAIKAN: Tambahkan event listener untuk memperbarui data saat ada perubahan
    window.addEventListener('attendanceScanUpdated', function(event) {
      // Perbarui stats tanpa melakukan query baru ke Firestore
      if (event.detail && event.detail.date === getLocalDateString()) {
        console.log('Attendance scan updated, refreshing stats');
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
  } catch (error) {
    console.error("Error initializing attendance system:", error);
  }
  
  // Tambahkan event listener untuk tombol refresh
  const refreshBtn = document.getElementById("refreshLeaveData");
  if (refreshBtn) {
    refreshBtn.addEventListener("click", function() {
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
      alerts.forEach(alert => {
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
      morning: new Date("1970-01-01T08:45:00"),
      afternoon: new Date("1970-01-01T14:20:00"),
    },
    ob: {
      morning: new Date("1970-01-01T07:30:00"),
      afternoon: new Date("1970-01-01T13:45:00"),
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
export { loadTodayAttendance,attendanceCache, employeeCache };
