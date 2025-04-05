// Import semua service yang dibutuhkan
import { findEmployeeByBarcode, getEmployees } from "../services/employee-service.js";
import { recordAttendance, updateAttendanceOut, getTodayAttendance } from "../services/attendance-service.js";
import { getLeaveRequestsByDate } from "../services/leave-service.js";

// Initialize data
let attendanceRecords = [];
let employees = [];
let leaveRequests = [];

// Tambahkan cache untuk employees
const employeeCache = new Map(); // Cache untuk karyawan berdasarkan barcode
const attendanceCache = new Map(); // Cache untuk data kehadiran berdasarkan tanggal

// Variabel global untuk menyimpan suara Indonesia
let indonesianVoice = null;
// Variabel global untuk status suara
let soundEnabled = true;
// Variabel global untuk menyimpan status ketersediaan audio
let isOpeningAudioAvailable = true;

// Fungsi untuk memeriksa ketersediaan file audio
function checkAudioAvailability(audioPath) {
  return new Promise((resolve, reject) => {
    const audio = new Audio(audioPath);
    
    audio.oncanplaythrough = () => {
      resolve(true);
    };
    
    audio.onerror = () => {
      resolve(false);
    };
    
    // Set timeout untuk menghindari hanging
    setTimeout(() => {
      resolve(false);
    }, 2000);
    
    // Coba load audio
    audio.load();
  });
}

// Fungsi untuk memeriksa ketersediaan audio pembuka
async function checkOpeningAudio() {
  try {
    isOpeningAudioAvailable = await checkAudioAvailability('audio/antrian.mp3');
    console.log("Opening audio available:", isOpeningAudioAvailable);
  } catch (error) {
    console.error("Error checking audio availability:", error);
    isOpeningAudioAvailable = false;
  }
}
// Fungsi untuk memutar notifikasi suara dengan audio pembuka
function playNotificationSound(type) {
  // Jika suara dinonaktifkan, keluar dari fungsi
  if (!soundEnabled) return;
  
  try {
    // Hentikan semua suara yang sedang diputar
    window.speechSynthesis.cancel();
    
    // Putar audio pembuka terlebih dahulu
    const openingAudio = new Audio('audio/antrian.mp3');
    
    // Set volume audio pembuka
    openingAudio.volume = 0.7;
    
    // Buat instance SpeechSynthesisUtterance untuk pesan
    const utterance = new SpeechSynthesisUtterance();
    
    // Set bahasa ke Indonesia
    utterance.lang = 'id-ID';
    
    // Set volume dan kecepatan untuk kejelasan yang lebih baik
    utterance.volume = 1;    // 0 to 1
    utterance.rate = 0.8;    // Sedikit lebih lambat untuk kejelasan
    utterance.pitch = 1.1;   // Sedikit lebih tinggi untuk kejelasan
    
    // Gunakan suara Indonesia yang telah dimuat
    if (indonesianVoice) {
      utterance.voice = indonesianVoice;
    }
    
    // Set teks berdasarkan tipe notifikasi
    switch(type) {
      case 'success-in':
        utterance.text = "Absensi berhasil";
        break;
      case 'success-out':
        utterance.text = "Berhasil scen pulang";
        break;
      case 'already-in':
        utterance.text = "Kamu sudah scen";
        break;
      case 'already-out':
        utterance.text = "Kamu sudah scen pulang";
        break;
      case 'late':
        utterance.text = "Kamu terlambat";
        break;
      case 'not-found':
        utterance.text = "Barcode tidak terdaftar";
        break;
      case 'error':
        utterance.text = "Terjadi kesalahan";
        break;
      default:
        utterance.text = "Operasi berhasil";
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
      }, 300); // Jeda 300ms setelah audio pembuka
    };
    
    // Tangani error pada audio pembuka
    openingAudio.onerror = (error) => {
      console.error("Error playing opening audio:", error);
      // Jika audio pembuka gagal, langsung baca teks
      window.speechSynthesis.speak(utterance);
    };
    
    // Mulai putar audio pembuka
    openingAudio.play().catch(error => {
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
  if ('speechSynthesis' in window) {
    console.log("Speech synthesis supported");
    
    // Fungsi untuk mencari suara Indonesia
    const findIndonesianVoice = () => {
      const voices = window.speechSynthesis.getVoices();
      console.log("Available voices:", voices.map(v => `${v.name} (${v.lang})`).join(', '));
      
      // Cari suara Indonesia atau Melayu (sebagai fallback)
      const idVoice = voices.find(voice => 
        voice.lang.includes('id-ID') || voice.lang.includes('id')
      );
      
      // Jika tidak ada suara Indonesia, coba cari suara Melayu
      const msVoice = voices.find(voice => 
        voice.lang.includes('ms-MY') || voice.lang.includes('ms')
      );
      
      // Jika masih tidak ada, gunakan suara default
      indonesianVoice = idVoice || msVoice || voices.find(v => v.default) || voices[0];
      
      if (indonesianVoice) {
        console.log("Selected voice:", indonesianVoice.name, indonesianVoice.lang);
        
        // Test suara
        const testUtterance = new SpeechSynthesisUtterance("Sistem absensi siap digunakan");
        testUtterance.voice = indonesianVoice;
        testUtterance.lang = 'id-ID';
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

// Fungsi untuk mengatasi bug umum pada Web Speech API
function fixSpeechSynthesisBugs() {
  // Bug di Chrome: speechSynthesis berhenti setelah sekitar 15 detik
  // Solusi: resume secara periodik
  setInterval(() => {
    if (window.speechSynthesis && window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
    }
  }, 5000);
  
  // Bug di beberapa browser: speechSynthesis tidak berfungsi setelah tab tidak aktif
  // Solusi: reset saat tab menjadi aktif
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  });
}

// Fungsi untuk mengaktifkan/menonaktifkan suara
function toggleSound() {
  soundEnabled = !soundEnabled;
  
  // Update icon
  const soundIcon = document.querySelector('#toggleSound + label i');
  if (soundIcon) {
    soundIcon.className = soundEnabled ? 'fas fa-volume-up' : 'fas fa-volume-mute';
  }
  
  // Simpan preferensi di localStorage
  localStorage.setItem('soundEnabled', soundEnabled);
  
  // Notifikasi
  showScanResult(
    "info", 
    `Suara notifikasi ${soundEnabled ? 'diaktifkan' : 'dinonaktifkan'}`
  );
  
  // Jika diaktifkan, putar suara konfirmasi
  if (soundEnabled) {
    const confirmUtterance = new SpeechSynthesisUtterance("Suara notifikasi diaktifkan");
    confirmUtterance.lang = 'id-ID';
    confirmUtterance.volume = 0.8;
    
    if (indonesianVoice) {
      confirmUtterance.voice = indonesianVoice;
    }
    
    window.speechSynthesis.speak(confirmUtterance);
  }
}

async function processBarcode() {
  const barcode = document.getElementById("barcodeInput").value.trim();

  if (!barcode) {
    showScanResult("error", "Barcode tidak boleh kosong!");
    playNotificationSound('error');
    return;
  }

  try {
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
      playNotificationSound('not-found');
      return;
    }

    // Get scan type (in/out)
    const scanType = document.querySelector('input[name="scanType"]:checked').value;
    
    // Get selected shift
    const selectedShift = document.querySelector('input[name="shiftOption"]:checked').value;

    // Current time
    const now = new Date();
    const timeString = now.toTimeString().split(" ")[0];
    const today = now.toISOString().split("T")[0];

    if (scanType === "in") {
      // Check if already checked in
      const existingRecord = attendanceRecords.find(
        (record) => record.employeeId === employee.employeeId && record.date === today
      );

      if (existingRecord && existingRecord.timeIn) {
        showScanResult("error", `${employee.name} sudah melakukan scan masuk hari ini!`);
        playNotificationSound('already-in');
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

      await recordAttendance(attendance);

      showScanResult(
        "success",
        `Absensi masuk berhasil: ${employee.name} (${formatEmployeeType(employeeType)} - ${formatShift(shift)}) - ${
          isLate ? `Terlambat ${lateMinutes} menit` : "Tepat Waktu"
        }`
      );
      
      // Play notification sound based on status
      if (isLate) {
        playNotificationSound('late');
      } else {
        playNotificationSound('success-in');
      }

      // Reload attendance data
      await loadTodayAttendance();
    } else {
      // Scan out logic
      const existingRecord = attendanceRecords.find(
        (record) => record.employeeId === employee.employeeId && record.date === today
      );

      if (!existingRecord) {
        showScanResult("error", `${employee.name} belum melakukan scan masuk hari ini!`);
        playNotificationSound('error');
        return;
      }

      if (existingRecord.timeOut) {
        showScanResult("error", `${employee.name} sudah melakukan scan pulang hari ini!`);
        playNotificationSound('already-out');
        return;
      }

      // Update attendance with checkout time
      await updateAttendanceOut(existingRecord.id, now);

      showScanResult("success", `Absensi pulang berhasil: ${employee.name}`);
      playNotificationSound('success-out');

      // Reload attendance data
      await loadTodayAttendance();
    }
  } catch (error) {
    console.error("Error scanning barcode:", error);
    showScanResult("error", "Terjadi kesalahan saat memproses barcode");
    playNotificationSound('error');
  }

  // Clear input
  document.getElementById("barcodeInput").value = "";
  document.getElementById("barcodeInput").focus();
}



// Modifikasi fungsi loadTodayAttendance untuk memastikan data izin diambil dengan benar
async function loadTodayAttendance() {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    // Load attendance data
    attendanceRecords = await getTodayAttendance();
    
    // Load leave requests for today - dengan penanganan error yang lebih baik
    try {
      console.log("Fetching leave requests for today:", today);
      leaveRequests = await getLeaveRequestsByDate(today);
      console.log(`Loaded ${leaveRequests.length} leave requests for today:`, leaveRequests);
    } catch (leaveError) {
      console.error("Error loading leave requests:", leaveError);
      leaveRequests = []; // Set to empty array on error
    }
    
    // Update UI
    updateStats();
    
    // Pastikan data hari ini ada di cache
    if (!attendanceCache.has(today)) {
      attendanceCache.set(today, [...attendanceRecords]);
    }
    
    console.log(`Loaded ${attendanceRecords.length} attendance records for today`);
  } catch (error) {
    console.error("Error loading attendance:", error);
    showScanResult("error", "Gagal memuat data kehadiran");
  }
}

// Tambahkan fungsi untuk menampilkan informasi tanggal
function updateDateInfo() {
  const today = new Date();
  const dateInfoEl = document.getElementById("dateInfo");
  
  if (dateInfoEl) {
    const options = { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    };
    
    dateInfoEl.textContent = today.toLocaleDateString('id-ID', options);
    console.log("Date info updated:", dateInfoEl.textContent);
  } else {
    console.warn("dateInfo element not found");
  }
}

// Modifikasi fungsi updateStats untuk memastikan jumlah izin ditampilkan dengan benar
function updateStats() {
  const today = new Date().toISOString().split("T")[0];
  const todayRecords = attendanceRecords.filter((record) => record.date === today);

  const presentCount = todayRecords.length;
  const lateCount = todayRecords.filter((record) => record.status === "Terlambat").length;
  
  // Pastikan leaveRequests sudah diinisialisasi dan hanya hitung yang disetujui
  const approvedLeaves = Array.isArray(leaveRequests) ? 
    leaveRequests.filter(leave => {
      const status = leave.status || '';
      return ['approved', 'disetujui', 'Approved', 'Disetujui'].includes(status.toLowerCase());
    }) : [];
  
  const leaveCount = approvedLeaves.length;
  
  console.log("Updating stats:", {
    presentCount,
    lateCount,
    leaveCount,
    totalLeaveRequests: leaveRequests.length,
    approvedLeaves: approvedLeaves.length
  });

  // Update UI elements if they exist
  const presentCountEl = document.getElementById("presentCount");
  if (presentCountEl) {
    presentCountEl.textContent = presentCount;
    console.log("Updated presentCount:", presentCount);
  } else {
    console.warn("presentCount element not found");
  }
  
  const lateCountEl = document.getElementById("lateCount");
  if (lateCountEl) {
    lateCountEl.textContent = lateCount;
    console.log("Updated lateCount:", lateCount);
  } else {
    console.warn("lateCount element not found");
  }
  
  // Update izin count
  const leaveCountEl = document.getElementById("leaveCount");
  if (leaveCountEl) {
    leaveCountEl.textContent = leaveCount;
    console.log("Updated leaveCount:", leaveCount);
  } else {
    console.warn("leaveCount element not found in DOM");
    // Try to find the element by other means
    console.log("Available elements with 'count' in ID:", 
      Array.from(document.querySelectorAll('[id*="count"]')).map(el => el.id));
  }
  
  // Update tanggal absensi
  updateDateInfo();
}

// Inisialisasi event listeners saat DOM sudah siap
document.addEventListener("DOMContentLoaded", async () => {
  try {
    console.log("DOM Content Loaded - Initializing attendance system");
    // Periksa ketersediaan audio pembuka
    await checkOpeningAudio();
    
    // Inisialisasi Web Speech API
    initSpeechSynthesis();
    
    // Perbaiki bug umum pada Web Speech API
    fixSpeechSynthesisBugs();
    
    // Preload audio untuk mengurangi delay
    if (isOpeningAudioAvailable) {
      const preloadAudio = new Audio('audio/antrian.mp3');
      preloadAudio.preload = 'auto';
      preloadAudio.load();
    }
    // Setup barcode scanning
    const barcodeInput = document.getElementById("barcodeInput");
    if (barcodeInput) {
      barcodeInput.addEventListener("keypress", async function (e) {
        if (e.key === "Enter") {
          e.preventDefault();
          await processBarcode();
        }
      });
    }

    const manualSubmit = document.getElementById("manualSubmit");
    if (manualSubmit) {
      manualSubmit.addEventListener("click", async function () {
        await processBarcode();
      });
    }

    // Setup refresh scanner button
    const refreshScanner = document.getElementById("refreshScanner");
    if (refreshScanner) {
      refreshScanner.addEventListener("click", function () {
        if (barcodeInput) {
          barcodeInput.value = "";
          barcodeInput.focus();
        }
        const scanResult = document.getElementById("scanResult");
        if (scanResult) {
          scanResult.style.display = "none";
        }
      });
    }

    // Load data
    await Promise.all([loadEmployees(), loadTodayAttendance()]);

    console.log("Attendance system initialized successfully");
  } catch (error) {
    console.error("Error initializing attendance system:", error);
  }
}); 

// Helper function to format employee type
function formatEmployeeType(type) {
  return type === "staff" ? "Staff" : "Office Boy";
}

// Helper function to format shift
function formatShift(shift) {
  return shift === "morning" ? "Pagi" : "Sore";
}

// Show scan result message
function showScanResult(type, message) {
  const scanResult = document.getElementById("scanResult");
  if (!scanResult) return;
  
  scanResult.className = "scan-result " + type;
  scanResult.innerHTML = message;
  scanResult.style.display = "block";

  // Hide result after 3 seconds
  setTimeout(() => {
    scanResult.style.display = "none";
  }, 3000);
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
      afternoon: new Date("1970-01-01T13:30:00"),
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
    if (employeeCache.size === 0) {
      employees = await getEmployees();
      
      // Cache employees by barcode for faster lookup
      employees.forEach(employee => {
        if (employee.barcode) {
          employeeCache.set(employee.barcode, employee);
        }
      });
      
      console.log(`Cached ${employeeCache.size} employees`);
    }
  } catch (error) {
    console.error("Error loading employees:", error);
  }
}

// Export fungsi dan cache yang diperlukan
export { loadTodayAttendance, processBarcode, attendanceCache, employeeCache };
