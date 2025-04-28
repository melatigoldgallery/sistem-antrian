import { AUDIO_PATHS } from "./audioConfig.js";

// Variabel untuk melacak status pemutaran audio
let isAudioPlaying = false;

// Fungsi untuk memeriksa status audio
export function isAudioBusy() {
  return isAudioPlaying;
}

// Fungsi untuk membatalkan semua audio
export function cancelAllAudio() {
  window.speechSynthesis.cancel();
  isAudioPlaying = false;
}

// Fungsi untuk memutar file audio
async function playAudio(audioPath) {
  return new Promise((resolve) => {
    const audio = new Audio(audioPath);
    audio.addEventListener("ended", resolve, { once: true });
    audio.play().catch(err => {
      console.error(`Error playing audio ${audioPath}:`, err);
      resolve(); // Lanjutkan meskipun ada error
    });
  });
}

// Fungsi untuk text-to-speech
async function speak(text, rate = 0.85, pitch = 1.2) {
  if (!('speechSynthesis' in window)) {
    console.warn("Text-to-speech tidak didukung");
    return Promise.resolve();
  }
  
  window.speechSynthesis.cancel(); // Bersihkan antrian
  
  return new Promise((resolve) => {
    // Preload dan siapkan utterance
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "id-ID";
    utterance.rate = rate;
    utterance.pitch = pitch;
    
    // Coba dapatkan suara Indonesia
    const voices = window.speechSynthesis.getVoices();
    const idVoice = voices.find(v => v.lang.includes('id'));
    if (idVoice) utterance.voice = idVoice;
    
    // Siapkan event handlers sebelum memanggil speak
    utterance.onend = resolve;
    utterance.onerror = () => {
      console.error("TTS error");
      resolve();
    };
    
    // Mulai TTS dengan prioritas tinggi
    setTimeout(() => {
      window.speechSynthesis.speak(utterance);
    }, 0);
  });
}


// Fungsi-fungsi ekspor
export async function playWaitMessageSequence() {
  if (isAudioPlaying) return false; // Abaikan jika sudah ada audio yang diputar
  
  try {
    isAudioPlaying = true;
    
    // Putar nada pembuka
    await playAudio(AUDIO_PATHS.informasi);
    
    // Putar pesan
    const message = "Kepada Pelanggan Melati yang belum dilayani, kami mohon kesabarannya untuk menunggu pelayanan. Terima kasih atas perhatiannya";
    await speak(message);
    
    // Putar nada penutup
    await playAudio(AUDIO_PATHS.informasiEnd);
    
    isAudioPlaying = false;
    return true; // Berhasil
  } catch (error) {
    console.error("Error playing wait message:", error);
    isAudioPlaying = false;
    return false; // Gagal
  }
}

export async function playTakeQueueMessage() {
  if (isAudioPlaying) return false; // Abaikan jika sudah ada audio yang diputar
  
  try {
    isAudioPlaying = true;
    
    // Putar nada pembuka
    await playAudio(AUDIO_PATHS.informasi);
    
    // Putar pesan
    const message = "Kepada pelanggan yang belum mendapat nomor antrian, harap meminta nomor antrian terlebih dahulu kepada staff Melati. Terima kasih atas perhatiannya";
    await speak(message);
    
    // Putar nada penutup
    await playAudio(AUDIO_PATHS.informasiEnd);
    
    isAudioPlaying = false;
    return true; // Berhasil
  } catch (error) {
    console.error("Error playing take queue message:", error);
    isAudioPlaying = false;
    return false; // Gagal
  }
}

export async function announceQueueNumber(queueNumber) {
  if (isAudioPlaying) return false; // Abaikan jika sudah ada audio yang diputar
  
  try {
    isAudioPlaying = true;
    
    const letter = queueNumber.charAt(0);
    const numbers = queueNumber.substring(1);
    const text = `Nomor antrian, ${letter}, ${numbers.split("").join("")}`;
    
    await speak(text);
    
    isAudioPlaying = false;
    return true; // Berhasil
  } catch (error) {
    console.error("Error announcing queue number:", error);
    isAudioPlaying = false;
    return false; // Gagal
  }
}

export async function playQueueAnnouncement(queueNumber) {
  if (isAudioPlaying) return false; // Abaikan jika sudah ada audio yang diputar
  
  try {
    isAudioPlaying = true;
    
    // Siapkan teks pengumuman terlebih dahulu
    const letter = queueNumber.charAt(0);
    const numbers = queueNumber.substring(1);
    const text = `Nomor antrian, ${letter}, ${numbers.split("").join("")}`;
    
    // Siapkan utterance sebelum memulai audio
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "id-ID";
    utterance.rate = 0.85;
    utterance.pitch = 1.2;
    
    // Coba dapatkan suara Indonesia
    const voices = window.speechSynthesis.getVoices();
    const idVoice = voices.find(v => v.lang.includes('id'));
    if (idVoice) utterance.voice = idVoice;
    
    // Putar nada pembuka dengan Promise yang lebih efisien
    const openingAudio = new Audio(AUDIO_PATHS.antrian);
    
    // Gunakan event listener untuk memastikan TTS dimulai segera setelah audio selesai
    await new Promise((resolve) => {
      openingAudio.addEventListener("ended", () => {
        // Mulai TTS segera setelah audio selesai
        window.speechSynthesis.speak(utterance);
        
        // Tunggu TTS selesai
        utterance.onend = resolve;
        utterance.onerror = () => {
          console.error("TTS error");
          resolve();
        };
      }, { once: true });
      
      openingAudio.play().catch(err => {
        console.error(`Error playing opening audio:`, err);
        resolve(); // Lanjutkan meskipun ada error
      });
    });
    
    isAudioPlaying = false;
    return true; // Berhasil
  } catch (error) {
    console.error("Error announcing queue:", error);
    isAudioPlaying = false;
    return false; // Gagal
  }
}


export async function announceVehicleMessage(carType, plateNumber, vehicleColor = '') {
  if (isAudioPlaying) return false; // Abaikan jika sudah ada audio yang diputar
  
  try {
    isAudioPlaying = true;
    
    // Putar nada pembuka
    await playAudio(AUDIO_PATHS.informasi);
    
    // Buat pesan dengan kondisional untuk warna kendaraan
    const colorInfo = vehicleColor ? `warna ${vehicleColor}` : '';
    const message = `Mohon kepada pemilik ${carType} ${colorInfo} dengan nomor polisi, ${plateNumber}, untuk memindahkan kendaraan karena ada kendaraan yang akan keluar. Terima kasih atas perhatiannya`;
    
    await speak(message);
    
    // Putar nada penutup
    await playAudio(AUDIO_PATHS.informasiEnd);
    
    isAudioPlaying = false;
    return true; // Berhasil
  } catch (error) {
    console.error("Error announcing vehicle message:", error);
    isAudioPlaying = false;
    return false; // Gagal
  }
}

export function playNotificationSound() {
  if (isAudioPlaying) return false; // Abaikan jika sudah ada audio yang diputar
  
  try {
    const audio = new Audio(AUDIO_PATHS.notifOn);
    audio.play().catch(err => console.error("Error playing notification:", err));
    return true; // Berhasil
  } catch (error) {
    console.error("Error playing notification sound:", error);
    return false; // Gagal
  }
}

// Inisialisasi
(function init() {
  // Preload audio files
  Object.values(AUDIO_PATHS).forEach(path => {
    const audio = new Audio();
    audio.src = path;
    audio.preload = 'auto';
  });
  
  // Fix untuk speechSynthesis yang "macet"
  setInterval(() => {
    if (window.speechSynthesis.speaking) {
      window.speechSynthesis.pause();
      window.speechSynthesis.resume();
    }
  }, 5000);
  
  // Reset saat halaman tidak aktif/aktif kembali
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      window.speechSynthesis.cancel();
      isAudioPlaying = false;
    }
  });
})();
