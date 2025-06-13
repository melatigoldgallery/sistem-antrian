import { getFaceDescriptor } from "./services/employee-service.js";


// Variabel global untuk menyimpan status
let isFaceApiInitialized = false;
let videoStream = null;
let faceMatchThreshold = 0.5; // Nilai threshold untuk pencocokan wajah (0.5 = 50% kecocokan)
// Tambahkan cache untuk descriptor wajah
const faceDescriptorCache = new Map();
let lastCacheCleanup = Date.now();
const CACHE_CLEANUP_INTERVAL = 30 * 60 * 1000; // 30 menit
// Fungsi untuk memuat model face-api.js

// Fungsi untuk mendapatkan face descriptor dengan caching
export async function getCachedFaceDescriptor(employeeId) {
  try {
    // Bersihkan cache jika sudah waktunya
    const now = Date.now();
    if (now - lastCacheCleanup > CACHE_CLEANUP_INTERVAL) {
      faceDescriptorCache.clear();
      lastCacheCleanup = now;
    }
    
    // Cek apakah descriptor ada di cache
    if (faceDescriptorCache.has(employeeId)) {
      console.log(`Using cached face descriptor for employee ID: ${employeeId}`);
      return faceDescriptorCache.get(employeeId);
    }
    
    // Jika tidak ada di cache, ambil dari database
    console.log(`Fetching face descriptor for employee ID: ${employeeId}`);
    const descriptor = await getFaceDescriptor(employeeId);
    
    // Simpan ke cache jika ditemukan
    if (descriptor) {
      faceDescriptorCache.set(employeeId, descriptor);
    }
    
    return descriptor;
  } catch (error) {
    console.error("Error getting cached face descriptor:", error);
    throw error;
  }
}

export async function loadFaceApiModels() {
  if (isFaceApiInitialized) return true;
  
  try {
    console.log("Loading face-api models...");
    
    // Set path ke model
    const MODEL_URL = 'js/face-api/models';
    
    // Muat model secara paralel
    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
      faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
      faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
    ]);
    
    console.log("Face-api models loaded successfully");
    isFaceApiInitialized = true;
    return true;
  } catch (error) {
    console.error("Error loading face-api models:", error);
    return false;
  }
}

// Fungsi untuk menginisialisasi kamera
export async function initCamera() {
  try {
    // Hentikan stream sebelumnya jika ada
    if (videoStream) {
      videoStream.getTracks().forEach(track => track.stop());
    }
    
    // Minta akses kamera
    videoStream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 640 },
        height: { ideal: 480 },
        facingMode: "user"
      }
    });
    
    // Tampilkan video di elemen yang sesuai
    const videoElement = document.getElementById('faceVerificationVideo');
    if (videoElement) {
      videoElement.srcObject = videoStream;
    }
    
    return true;
  } catch (error) {
    console.error("Error initializing camera:", error);
    return false;
  }
}

// Fungsi untuk menghentikan kamera
export function stopCamera() {
  if (videoStream) {
    videoStream.getTracks().forEach(track => track.stop());
    videoStream = null;
    
    // Reset video element
    const videoElement = document.getElementById('faceVerificationVideo');
    if (videoElement) {
      videoElement.srcObject = null;
    }
  }
}

// Fungsi untuk memulai verifikasi wajah
export function startFaceVerification() {
  // Tampilkan UI verifikasi wajah
  const container = document.querySelector('.face-verification-container');
  if (container) {
    container.style.display = 'block';
  }
  
  // Pastikan video element ada
  const videoElement = document.getElementById('faceVerificationVideo');
  if (!videoElement) {
    console.error("Video element not found");
    return false;
  }
  
  return true;
}

export async function detectAndVerifyFace(employeeId) {
  try {
    console.log(`Verifying face for employee ID: ${employeeId}`);
    
    // Pastikan model sudah dimuat
    if (!isFaceApiInitialized) {
      await loadFaceApiModels();
    }
    
    // Pastikan kamera sudah diinisialisasi
    const videoElement = document.getElementById('faceVerificationVideo');
    if (!videoElement || !videoElement.srcObject) {
      throw new Error("Kamera belum diinisialisasi");
    }
    
    // Tampilkan status
    const statusElement = document.getElementById('faceVerificationStatus');
    if (statusElement) {
      statusElement.textContent = "Mendeteksi wajah...";
      statusElement.className = "text-info";
    }
    
    // Tunggu video siap - tambahkan pengecekan null
    if (videoElement && videoElement.readyState !== 4) {
      await new Promise(resolve => {
        videoElement.onloadeddata = resolve;
      });
    }
    
    // OPTIMASI: Gunakan TinyFaceDetector dengan parameter yang dioptimalkan
    const options = new faceapi.TinyFaceDetectorOptions({ 
      inputSize: 320,  // Lebih kecil = lebih cepat
      scoreThreshold: 0.5 // Lebih rendah = lebih cepat tapi kurang akurat
    });
    
    // OPTIMASI: Deteksi wajah dengan ukuran gambar yang lebih kecil
    const displaySize = { width: videoElement.width, height: videoElement.height };
    const detections = await faceapi.detectAllFaces(
      videoElement, 
      options
    ).withFaceLandmarks().withFaceDescriptors();
    
    // Periksa hasil deteksi
    if (detections.length === 0) {
      if (statusElement) {
        statusElement.textContent = "Tidak ada wajah terdeteksi. Posisikan wajah Anda di depan kamera.";
        statusElement.className = "text-warning";
      }
      return { verified: false, message: "Tidak ada wajah terdeteksi" };
    }
    
    if (detections.length > 1) {
      if (statusElement) {
        statusElement.textContent = "Terdeteksi lebih dari satu wajah. Pastikan hanya ada satu wajah.";
        statusElement.className = "text-danger";
      }
      return { verified: false, message: "Terdeteksi lebih dari satu wajah" };
    }
    
    // Ambil descriptor wajah yang terdeteksi
    const detectedDescriptor = detections[0].descriptor;
    
    // OPTIMASI: Gunakan cache untuk descriptor wajah
    console.log(`Fetching stored face descriptor for employee ID: ${employeeId}`);
    const storedDescriptor = await getCachedFaceDescriptor(employeeId);
    
    // Log untuk debugging
    console.log("Stored descriptor:", storedDescriptor ? "Found" : "Not found");
    
    // Jika tidak ada data wajah tersimpan, ini adalah pendaftaran pertama kali
    if (!storedDescriptor) {
      if (statusElement) {
        statusElement.textContent = "Data wajah belum terdaftar.";
        statusElement.className = "text-danger";
      }
      
      return { verified: false, message: "Data wajah belum terdaftar" };
    }
    
    // Pastikan storedDescriptor adalah Float32Array
    const storedFloat32Array = storedDescriptor instanceof Float32Array 
      ? storedDescriptor 
      : new Float32Array(storedDescriptor);
    
    // OPTIMASI: Gunakan euclideanDistance yang lebih efisien
    const distance = faceapi.euclideanDistance(detectedDescriptor, storedFloat32Array);
    const similarity = 1 - distance;
    
    console.log(`Face verification result: similarity ${similarity.toFixed(2)} (threshold: ${faceMatchThreshold})`);
    
    // Verifikasi berhasil jika similarity di atas threshold
    const isVerified = similarity >= faceMatchThreshold;
    
    if (statusElement) {
      if (isVerified) {
        statusElement.textContent = `Verifikasi berhasil! Kecocokan: ${(similarity * 100).toFixed(0)}%`;
        statusElement.className = "text-success";
      } else {
        statusElement.textContent = `Verifikasi gagal. Kecocokan: ${(similarity * 100).toFixed(0)}%`;
        statusElement.className = "text-danger";
      }
    }
    
    return { 
      verified: isVerified, 
      similarity: similarity,
      message: isVerified ? "Verifikasi berhasil" : "Wajah tidak cocok"
    };
    
  } catch (error) {
    console.error("Error in face detection and verification:", error);
    
    const statusElement = document.getElementById('faceVerificationStatus');
    if (statusElement) {
      statusElement.textContent = "Terjadi kesalahan saat verifikasi wajah.";
      statusElement.className = "text-danger";
    }
    
    return { verified: false, message: "Terjadi kesalahan: " + error.message };
  }
}


// Fungsi untuk menghapus data wajah
export async function deleteFaceDescriptor(employeeId) {
  try {
    // Import fungsi secara dinamis untuk menghindari circular dependency
    const { deleteFaceDescriptor: deleteDescriptor } = await import("./services/employee-service.js");
    return await deleteDescriptor(employeeId);
  } catch (error) {
    console.error("Error deleting face descriptor:", error);
    throw error;
  }
}
