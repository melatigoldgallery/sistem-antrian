// Firebase configuration - sesuaikan dengan config Firebase Anda
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-app.js";
import {
  getDatabase,
  ref,
  push,
  onValue,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.4.0/firebase-database.js";

// Gunakan config Firebase yang sama dengan aplikasi utama
const firebaseConfig = {
  // Sesuaikan dengan config Firebase Anda
  apiKey: "AIzaSyB6WS177m4mFIIlDE9sSSW21XHkWHQdwdU",
  authDomain: "sistem-antrian-76aa8.firebaseapp.com",
  databaseURL: "https://sistem-antrian-76aa8-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "sistem-antrian-76aa8",
  storageBucket: "sistem-antrian-76aa8.firebasestorage.app",
  messagingSenderId: "545586001781",
  appId: "1:545586001781:web:cae2e84ad9c8d905c7053c",
  measurementId: "G-2SYW19ZQD8",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

class InfoRealtimeSystem {
  constructor() {
    this.currentMode = "admin";
    this.isConnected = false;
    this.audioVolume = 1;
    this.notificationSounds = {
      gojek: "Halo admin, ada Gojek",
      servis: "Halo admin, tolong ambilkan barang servisan",
    };

    this.init();
  }

  init() {
    this.setupEventListeners();
    this.setupFirebaseListeners();
    this.updateSystemStartTime();
    this.setupAudioControls();
  }

  setupEventListeners() {
    // Mode toggle
    document.getElementById("buttonModeBtn").addEventListener("click", () => {
      this.switchMode("button");
    });

    document.getElementById("adminModeBtn").addEventListener("click", () => {
      this.switchMode("admin");
    });

    // Info buttons
    document.getElementById("gojekBtn").addEventListener("click", () => {
      this.sendNotification("gojek");
    });

    document.getElementById("servisBtn").addEventListener("click", () => {
      this.sendNotification("servis");
    });
  }

  setupFirebaseListeners() {
    const notificationsRef = ref(database, "notifications");

    // Listen for connection status
    const connectedRef = ref(database, ".info/connected");
    onValue(connectedRef, (snapshot) => {
      this.isConnected = snapshot.val();
      this.updateConnectionStatus();
    });

    // Listen for new notifications - PERBAIKAN: untuk semua mode
    onValue(notificationsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const notifications = Object.values(data);
        const latestNotification = notifications[notifications.length - 1];

        // PERBAIKAN: Handle notification di semua mode
        if (latestNotification) {
          this.handleNotification(latestNotification);
        }
      }
    });
  }

  switchMode(mode) {
    this.currentMode = mode;

    // Update button states
    document.getElementById("buttonModeBtn").classList.toggle("active", mode === "button");
    document.getElementById("adminModeBtn").classList.toggle("active", mode === "admin");

    // Show/hide panels - PERBAIKAN LOGIC
    document.getElementById("buttonPanel").style.display = mode === "button" ? "block" : "none";
    document.getElementById("adminPanel").style.display = mode === "admin" ? "block" : "none";
  }

  async sendNotification(type) {
    if (!this.isConnected) {
      this.showAlert("Tidak terhubung ke server", "error");
      return;
    }

    try {
      const notificationsRef = ref(database, "notifications");
      await push(notificationsRef, {
        type: type,
        message: this.notificationSounds[type],
        timestamp: serverTimestamp(),
        status: "sent",
      });

      this.animateButton(type);
    } catch (error) {
      console.error("Error sending notification:", error);
      this.showAlert("Gagal mengirim notifikasi", "error");
    }
  }

  handleNotification(notification) {
    // PERBAIKAN: Perpanjang waktu validasi dan tambah fallback
    const now = Date.now();
    const notifTime = notification.timestamp || now;
    const timeDiff = now - notifTime;

    // Perpanjang dari 5 detik ke 30 detik
    if (timeDiff < 30000) {
      this.playNotificationSound(notification.message);
      this.addToLog(notification);

      // Tambah visual feedback
      this.showNotificationAlert(notification);
    }
  }

  showNotificationAlert(notification) {
    // Tambah alert visual untuk semua mode
    const alertDiv = document.createElement("div");
    alertDiv.className = "alert alert-info alert-dismissible fade show position-fixed";
    alertDiv.style.cssText = `
    top: 20px; 
    right: 20px; 
    z-index: 9999; 
    min-width: 300px;
  `;
    alertDiv.innerHTML = `
    <strong>Notifikasi Baru!</strong><br>
    ${notification.message}
    <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
  `;

    document.body.appendChild(alertDiv);

    // Auto remove setelah 5 detik
    setTimeout(() => {
      if (alertDiv.parentNode) {
        alertDiv.remove();
      }
    }, 5000);
  }

  playNotificationSound(message) {
    // Text-to-Speech
    if ("speechSynthesis" in window) {
      const utterance = new SpeechSynthesisUtterance(message);
      utterance.volume = this.audioVolume;
      utterance.rate = 0.8;
      utterance.pitch = 1.2;
      utterance.lang = "id-ID";

      speechSynthesis.speak(utterance);
    }

    // Backup: Play notification sound
    this.playBeepSound();
  }

  playBeepSound() {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.value = 1000;
    oscillator.type = "sine";

    gainNode.gain.setValueAtTime(this.audioVolume * 0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.5);
  }

  addToLog(notification) {
    const logContainer = document.getElementById("notificationLog");
    const logItem = document.createElement("div");
    logItem.className = "log-item";

    const now = new Date();
    const timeString = now.toLocaleTimeString("id-ID");

    logItem.innerHTML = `
            <div class="log-time">${timeString}</div>
    `;

    logContainer.appendChild(logItem);

    // Keep only last 10 notifications
    const logItems = logContainer.querySelectorAll(".log-item");
    if (logItems.length > 10) {
      logContainer.removeChild(logItems[1]); // Keep the first "system ready" message
    }

    // Scroll to bottom
    logContainer.scrollTop = logContainer.scrollHeight;
  }

  setupAudioControls() {
    const volumeSlider = document.getElementById("volumeSlider");
    const volumeValue = document.getElementById("volumeValue");

    // Set default value ke 100%
    volumeSlider.value = 100;
    volumeValue.textContent = "100%";
    this.audioVolume = 1;

    volumeSlider.addEventListener("input", (e) => {
      this.audioVolume = e.target.value / 100;
      volumeValue.textContent = e.target.value + "%";
    });
  }

  updateConnectionStatus() {
    const buttonDot = document.getElementById("connectionDot");
    const buttonText = document.getElementById("connectionText");
    const adminDot = document.getElementById("adminConnectionDot");
    const adminText = document.getElementById("adminConnectionText");

    const status = this.isConnected ? "connected" : "";
    const text = this.isConnected ? "Terhubung" : "Terputus";

    [buttonDot, adminDot].forEach((dot) => {
      dot.className = `status-dot ${status}`;
    });

    [buttonText, adminText].forEach((textEl) => {
      textEl.textContent = text;
    });
  }

  animateButton(type) {
    const button = document.getElementById(type + "Btn");
    button.style.transform = "scale(0.95)";
    button.style.opacity = "0.7";

    setTimeout(() => {
      button.style.transform = "scale(1)";
      button.style.opacity = "1";
    }, 150);
  }

  showAlert(message, type) {
    // Create toast notification
    const toast = document.createElement("div");
    toast.className = `alert alert-${type === "success" ? "success" : "danger"} position-fixed`;
    toast.style.cssText = `
      top: 20px;
      right: 20px;
      z-index: 9999;
      min-width: 300px;
      animation: slideIn 0.3s ease;
    `;

    toast.innerHTML = `
      <div class="d-flex align-items-center">
        <i class="fas fa-${type === "success" ? "check-circle" : "exclamation-triangle"} me-2"></i>
        ${message}
      </div>
    `;

    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.animation = "slideOut 0.3s ease";
      setTimeout(() => {
        document.body.removeChild(toast);
      }, 300);
    }, 3000);
  }

  updateSystemStartTime() {
    const systemStartTime = document.getElementById("systemStartTime");
    const now = new Date();
    systemStartTime.textContent = now.toLocaleString("id-ID");
  }
}

// CSS animations
const style = document.createElement("style");
style.textContent = `
  @keyframes slideIn {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
  
  @keyframes slideOut {
    from {
      transform: translateX(0);
      opacity: 1;
    }
    to {
      transform: translateX(100%);
      opacity: 0;
    }
  }
`;
document.head.appendChild(style);

// Initialize the system when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  new InfoRealtimeSystem();
});

export default InfoRealtimeSystem;
