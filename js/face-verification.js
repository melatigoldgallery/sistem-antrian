// Modul untuk verifikasi wajah menggunakan face-api.js

// Variabel global untuk menyimpan status
let isFaceApiInitialized = false;
let videoStream = null;
let faceMatchThreshold = 0.6; // Nilai threshold untuk pencocokan wajah (0.6 = 60% kecocokan)

// Import layanan karyawan untuk mengakses data wajah
import { getFaceDescriptor } from "./services/employee-service.js";

// Fungsi untuk memuat model face-api.js
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

// Fungsi untuk mendeteksi dan memverifikasi wajah
export async function detectAndVerifyFace(employeeId) {
  try {
    // Pastikan model sudah dimuat
    if (!isFaceApiInitialized) {
      await loadFaceApiModels();
    }
    
    // Pastikan kamera sudah diinisialisasi
    const videoElement = document.getElementById('faceVerificationVideo');
    if (!videoElement || !videoElement.srcObject) {
      await initCamera();
    }
    
    // Tampilkan status
    const statusElement = document.getElementById('faceVerificationStatus');
    if (statusElement) {
      statusElement.textContent = "Mendeteksi wajah...";
      statusElement.className = "text-info";
    }
    
    // Tunggu video siap
    if (videoElement.readyState !== 4) {
      await new Promise(resolve => {
        videoElement.onloadeddata = resolve;
      });
    }
    
    // Deteksi wajah dari video
    const detections = await faceapi.detectAllFaces(
      videoElement, 
      new faceapi.TinyFaceDetectorOptions()
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
    
    // Ambil descriptor wajah dari database
    const storedDescriptor = await getFaceDescriptor(employeeId);
    
    // Jika tidak ada data wajah tersimpan, ini adalah pendaftaran pertama kali
    if (!storedDescriptor) {
      if (statusElement) {
        statusElement.textContent = "Data wajah belum terdaftar. Menyimpan data wajah baru...";
        statusElement.className = "text-info";
      }
      
      // Simpan descriptor wajah baru
      await saveFaceDescriptor(employeeId, detectedDescriptor);
      
      return { verified: true, isFirstTime: true, message: "Data wajah berhasil disimpan" };
    }
    
    // Bandingkan descriptor wajah
    const distance = faceapi.euclideanDistance(detectedDescriptor, storedDescriptor);
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
