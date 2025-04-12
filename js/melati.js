let pendingAction = "";
// Import statements
import { getDatabase, ref, set, onValue } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-database.js";
import { QueueAnalytics } from "./queueAnalytics.js";
import { rtdb } from "./configFirebase.js";
import { QueueManager } from "./antrian.js";
import { initializeUsers } from "./auth/initUsers.js";
import { authService } from "./configFirebase.js";
import { checkAuth } from "./auth/authCheck.js";
import { handleLogout } from "./auth/logout.js";
import {
  playWaitMessageSequence,
  playTakeQueueMessage,
  playQueueAnnouncement,
  announceQueueNumber,
  announceVehicleMessage,
  isAudioBusy,
} from "./audioHandlers.js";

// Global variables
let queueManager;
let queueDisplay;
let nextQueueDisplay;
let delayQueueDisplay;


// Expose handleLogout to global scope for the onclick attribute
window.handleLogout = handleLogout;

// Function to update queue displays
function updateDisplays() {
  // Add null checks and default values
  const currentQueue = queueManager?.getCurrentQueue() || "A01";
  const nextQueue = queueManager?.getNextQueue() || "A02";
  const delayedQueue = queueManager?.getDelayedQueue() || [];
  const skipList = queueManager?.getSkipList() || []; // Tambahkan ini

  if (queueDisplay) queueDisplay.textContent = currentQueue;
  if (nextQueueDisplay) nextQueueDisplay.textContent = nextQueue;
  if (delayQueueDisplay) delayQueueDisplay.textContent = delayedQueue.join(", ") || "-";
  // Perbarui tampilan skipList
  const skipListDisplay = document.getElementById("skipListDisplay");
  if (skipListDisplay) {
    skipListDisplay.textContent = skipList.length > 0 ? skipList.join(", ") : "-";
  } else {
    console.warn("Element skipListDisplay not found");
  }
}

// Main initialization function
async function initializeQueueSystem() {
  try {
    const queueAnalytics = new QueueAnalytics(rtdb);

    // Initialize DOM elements
    queueDisplay = document.getElementById("queueNumber");
    nextQueueDisplay = document.getElementById("nextQueueNumber");
    delayQueueDisplay = document.getElementById("delayQueueNumber");

    if (!queueDisplay) {
      console.log("Queue display elements not found, may not be on queue page");
      return; // Exit if we're not on the queue page
    }

    // Initialize queue manager
    queueManager = new QueueManager();
    await queueManager.initializeFromFirebase();
    await queueManager.initializeCustomerCount();
    updateDisplays();

    // Initialize buttons
    initializeButtons(queueAnalytics);

    // Set up customer count listener
    setupCustomerCountListener();
  } catch (error) {
    console.error("Error initializing queue system:", error);
  }
}

// Tambahkan visual feedback untuk tombol audio
function addAudioButtonFeedback(button) {
  if (!button) return;

  const originalClickHandler = button.onclick;

  button.onclick = function (event) {
    // Jika audio sedang diputar, abaikan klik
    if (isAudioBusy()) {
      console.log("Audio sedang diputar, mengabaikan klik");

      // Tambahkan efek visual untuk menunjukkan tombol tidak aktif
      button.classList.add("audio-busy");
      setTimeout(() => button.classList.remove("audio-busy"), 500);

      return;
    }

    // Tambahkan kelas aktif saat audio diputar
    button.classList.add("audio-active");

    // Hapus kelas aktif saat audio selesai
    const checkAudioStatus = setInterval(() => {
      if (!isAudioBusy()) {
        button.classList.remove("audio-active");
        clearInterval(checkAudioStatus);
      }
    }, 500);

    // Panggil handler asli
    if (originalClickHandler) {
      originalClickHandler.call(this, event);
    }
  };
}
function initializeButtons(queueAnalytics) {
  // Delay queue button
  const delayQueueButton = document.getElementById("delayQueueButton");
  const confirmDelayYes = document.getElementById("confirmDelayYes");

  // Customer count buttons
  const tambahCustomerBtn = document.getElementById("tambahCustomerBtn");
  const kurangiCustomerBtn = document.getElementById("kurangiCustomerBtn");

  if (tambahCustomerBtn) {
    tambahCustomerBtn.addEventListener("click", () => queueManager.incrementCustomer());
  }

  if (kurangiCustomerBtn) {
    kurangiCustomerBtn.addEventListener("click", () => queueManager.decrementCustomer());
  }

  // Tambahkan event listener untuk tombol previous number
  const previousNumber = document.getElementById("previousNumber");
  const confirmPreviousNumber = document.getElementById("confirmPreviousNumber");
  if (previousNumber) {
    previousNumber.addEventListener("click", () => {
      const modal = new bootstrap.Modal(document.getElementById("previousNumberModal"));
      modal.show();
    });
  }
  if (confirmPreviousNumber) {
    confirmPreviousNumber.addEventListener("click", () => {
      // Implementasi logika kembali ke nomor sebelumnya
      // Ini memerlukan penambahan fungsi di QueueManager
      if (queueManager.previousQueue) {
        queueDisplay.textContent = queueManager.previousQueue();
        updateDisplays();
      }
      bootstrap.Modal.getInstance(document.getElementById("previousNumberModal")).hide();
    });
  }

  // Add click handler for delay button
  if (delayQueueButton) {
    delayQueueButton.addEventListener("click", () => {
      const modal = new bootstrap.Modal(document.getElementById("confirmDelayModal"));
      modal.show();
    });
  }

  // Add click handler for confirmation
  if (confirmDelayYes) {
    confirmDelayYes.addEventListener("click", async () => {
      try {
        const currentQueue = queueDisplay.textContent;

        // Track the queue in analytics with delayed status
        await queueAnalytics.trackServedQueue(currentQueue, "delayed");

        // Update queue management
        queueManager.addToDelayedQueue(currentQueue);
        queueDisplay.textContent = queueManager.next();

        // Close modal and update displays
        bootstrap.Modal.getInstance(document.getElementById("confirmDelayModal")).hide();
        updateDisplays();

        console.log("Queue delayed and tracked successfully");
      } catch (error) {
        console.error("Error processing delayed queue:", error);
      }
    });
  }

  // Call Queue Number (Indonesia)
  const callButton = document.getElementById("callButton");
  if (callButton) {
    callButton.addEventListener("click", async () => {
      if (isAudioBusy()) {
        console.log("Audio sedang diputar, mengabaikan klik");
        return;
      }
      callButton.classList.add("audio-active");
      const currentQueue = queueDisplay.textContent;
      await playQueueAnnouncement(currentQueue);
      callButton.classList.remove("audio-active");
    });
  }

  // Tombol Validasi Terlayani
  const handleButton = document.getElementById("handleButton");
  if (handleButton) {
    handleButton.addEventListener("click", () => {
      const modal = new bootstrap.Modal(document.getElementById("confirmModal"));
      modal.show();
    });
  }

  // Update the confirm handlers to decrease customer count
  const confirmYes = document.getElementById("confirmYes");
  if (confirmYes) {
    confirmYes.addEventListener("click", async () => {
      try {
        const currentQueue = queueDisplay.textContent;
        await queueAnalytics.trackServedQueue(currentQueue);
        await queueManager.decrementCustomer(); // Kurangi customer saat dilayani
        queueDisplay.textContent = queueManager.next();

        const modal = bootstrap.Modal.getInstance(document.getElementById("confirmModal"));
        modal.hide();

        updateDisplays();
      } catch (error) {
        console.error("Processing error:", error);
      }
    });
  }

  // Tombol Handle Delay Queue Number
  const delayHandleButton = document.getElementById("delayHandleButton");
  if (delayHandleButton) {
    delayHandleButton.addEventListener("click", () => {
      const delayedNumbers = queueManager.getDelayedQueue();
      if (delayedNumbers.length > 0) {
        // Get the select element
        const selectElement = document.getElementById("delayedQueueSelect");

        // Clear existing options
        selectElement.innerHTML = "";

        // Add options for each delayed number
        delayedNumbers.forEach((number) => {
          const option = document.createElement("option");
          option.value = number;
          option.textContent = number;
          selectElement.appendChild(option);
        });

        const confirmDelayedModal = new bootstrap.Modal("#confirmDelayedModal");
        confirmDelayedModal.show();
      }
    });
  }

  const confirmDelayedYes = document.getElementById("confirmDelayedYes");
  if (confirmDelayedYes) {
    confirmDelayedYes.addEventListener("click", async () => {
      const selectElement = document.getElementById("delayedQueueSelect");
      const selectedQueue = selectElement.value;

      if (selectedQueue) {
        await queueManager.decrementCustomer(); // Kurangi customer saat dilayani
        queueManager.removeFromDelayedQueue(selectedQueue);
        updateDisplays();

        const modal = bootstrap.Modal.getInstance(document.getElementById("confirmDelayedModal"));
        modal.hide();
      }
    });
  }

  // Sequential call button
  const sequentialCallButton = document.getElementById("sequentialCallButton");
  if (sequentialCallButton) {
    sequentialCallButton.addEventListener("click", async () => {
      if (isAudioBusy()) {
        console.log("Audio sedang diputar, mengabaikan klik");
        return;
      }

      sequentialCallButton.classList.add("audio-active");
      await callSequentially("id");
      sequentialCallButton.classList.remove("audio-active");
    });
  }

  // Pengingat Nomor Antrian
  const takeMessage = document.getElementById("takeMessage");
  if (takeMessage) {
    takeMessage.addEventListener("click", async () => {
      if (isAudioBusy()) {
        console.log("Audio sedang diputar, mengabaikan klik");
        return;
      }

      takeMessage.classList.add("audio-active");
      await playTakeQueueMessage();
      takeMessage.classList.remove("audio-active");
    });
  }

  // Update wait message button event listener
  const waitMessage = document.getElementById("waitMessage");
  if (waitMessage) {
    waitMessage.addEventListener("click", async () => {
      if (isAudioBusy()) {
        console.log("Audio sedang diputar, mengabaikan klik");
        return;
      }

      waitMessage.classList.add("audio-active");
      await playWaitMessageSequence();
      waitMessage.classList.remove("audio-active");
    });
  }

// Tambahkan event listener untuk tombol skip
const skipQueueButton = document.getElementById("skipQueueButton");
const confirmSkipQueue = document.getElementById("confirmSkipQueue");

if (skipQueueButton) {
  skipQueueButton.addEventListener("click", () => {
    // Persiapkan informasi untuk modal
    const currentQueue = queueManager.getCurrentQueue();
    
    // Update teks di modal
    document.getElementById("currentQueueText").textContent = currentQueue;
    
    // Set default value untuk select letter berdasarkan huruf saat ini
    const letterSelect = document.getElementById("skipQueueLetter");
    letterSelect.value = queueManager.letters[queueManager.currentLetter];
    
    // Tampilkan modal
    const modal = new bootstrap.Modal(document.getElementById("skipQueueModal"));
    modal.show();
  });
}

if (confirmSkipQueue) {
  confirmSkipQueue.addEventListener("click", () => {
    try {
      const letter = document.getElementById("skipQueueLetter").value;
      const number = parseInt(document.getElementById("skipQueueNumberInput").value);
      
      if (isNaN(number) || number < 1 || number > 50) {
        alert("Masukkan nomor antrian yang valid (1-50)");
        return;
      }
      
      // Tambahkan ke skipList
      if (queueManager.addToSkipList(letter, number)) {
        // Tutup modal
        bootstrap.Modal.getInstance(document.getElementById("skipQueueModal")).hide();
        
        // Bersihkan input
        document.getElementById("skipQueueNumberInput").value = "";
        
        console.log("Nomor antrian berhasil ditambahkan ke skip list");
      } else {
        alert("Nomor antrian ini sudah ada dalam daftar skip");
      }
    } catch (error) {
      console.error("Error saat menambahkan nomor ke skip list:", error);
    }
  });
}


  // Add event listeners for custom queue
  const customQueueButton = document.getElementById("customQueueButton");
  if (customQueueButton) {
    customQueueButton.addEventListener("click", () => {
      // Langsung buka modal custom queue tanpa password
      const customQueueModal = new bootstrap.Modal(document.getElementById("customQueueModal"));
      customQueueModal.show();
    });
  }

  const setCustomQueue = document.getElementById("setCustomQueue");
  if (setCustomQueue) {
    setCustomQueue.addEventListener("click", () => {
      const letter = document.getElementById("queueLetter").value;
      const number = parseInt(document.getElementById("queueNumberInput").value);

      if (number >= 1 && number <= 50) {
        queueManager.setCustomQueue(letter, number);
        updateDisplays();
        bootstrap.Modal.getInstance(document.getElementById("customQueueModal")).hide();
      } else {
        alert("Please enter a valid number between 1 and 50");
      }
    });
  }

  // Tambahkan event listener untuk tombol reset
  const resetButton = document.getElementById("resetButton");
  const confirmResetBtn = document.getElementById("confirmResetBtn");
  if (resetButton) {
    resetButton.addEventListener("click", () => {
      const modal = new bootstrap.Modal(document.getElementById("resetConfirmModal"));
      modal.show();
    });
  }
  if (confirmResetBtn) {
    confirmResetBtn.addEventListener("click", () => {
      queueDisplay.textContent = queueManager.reset();
      bootstrap.Modal.getInstance(document.getElementById("resetConfirmModal")).hide();
      updateDisplays();
    });
  }

  // Tambahkan event listener untuk informasi kendaraan
  const panggilInformasi = document.getElementById("panggilInformasi");
  if (panggilInformasi) {
    panggilInformasi.addEventListener("click", async () => {
      if (isAudioBusy()) {
        console.log("Audio sedang diputar, mengabaikan klik");
        return;
      }

      const carTypeInput = document.getElementById("carType");
      const plateNumberInput = document.getElementById("plateNumber");
      const vehicleColorInput = document.getElementById("vehicleColor");

      const carType = carTypeInput.value;
      const plateNumber = plateNumberInput.value;
      const vehicleColor = vehicleColorInput ? vehicleColorInput.value : "";

      if (!carType || !plateNumber) {
        alert("Mohon isi jenis mobil dan nomor polisi");
        return;
      }

      panggilInformasi.classList.add("audio-active");
      const spelledPlateNumber = spellPlateNumber(plateNumber, "id");
      await announceVehicleMessage(carType, spelledPlateNumber, vehicleColor);
      panggilInformasi.classList.remove("audio-active");
    });
  }
}
// Setup customer count listener
function setupCustomerCountListener() {
  if (queueManager && queueManager.customerRef) {
    onValue(queueManager.customerRef, (snapshot) => {
      const count = snapshot.val() || 0;
      const customerCountDisplay = document.getElementById("customerCount");
      if (customerCountDisplay) {
        customerCountDisplay.textContent = count;
      }
    });
  }
}

// Tambahkan variabel untuk tracking index pemanggilan
let currentCallIndex = 0;

// Fungsi untuk pemanggilan berurutan
async function callSequentially(language) {
  const delayedNumbers = queueManager.getDelayedQueue();

  if (delayedNumbers.length === 0) {
    return;
  }

  // Panggil nomor antrian sesuai index
  await playQueueAnnouncement(delayedNumbers[currentCallIndex], language);

  // Update index untuk pemanggilan berikutnya
  currentCallIndex = (currentCallIndex + 1) % delayedNumbers.length;
}

// Fungsi untuk mengubah karakter menjadi ejaan
function getCharacterSpelling(char, language) {
  // Mapping untuk pengejaan khusus
  const spellingMap = {
    id: {
      0: "nol",
      1: "satu",
      2: "dua",
      3: "tiga",
      4: "empat",
      5: "lima",
      6: "enam",
      7: "tujuh",
      8: "delapan",
      9: "sembilan",
      A: "a",
      B: "be",
      C: "ce",
      D: "de",
      E: "e",
      F: "ef",
      G: "ge",
      H: "ha",
      I: "i",
      J: "je",
      K: "ka",
      L: "el",
      M: "em",
      N: "en",
      O: "o",
      P: "pe",
      Q: "qi",
      R: "er",
      S: "es",
      T: "te",
      U: "u",
      V: "ve",
      W: "we",
      X: "ex",
      Y: "ye",
      Z: "zet",
    },
  };

  const upperChar = char.toUpperCase();
  return spellingMap[language][upperChar] || char;
}

// Fungsi untuk mengeja nomor polisi
function spellPlateNumber(plateNumber, language) {
  const chars = plateNumber.split("");
  return chars.map((char) => getCharacterSpelling(char, language)).join(" ");
}

// Extend QueueManager with custom methods if needed
if (typeof QueueManager !== "undefined") {
  // Reset index when queue changes
  const originalRemoveFromDelayedQueue = QueueManager.prototype.removeFromDelayedQueue;
  QueueManager.prototype.removeFromDelayedQueue = function (queueNumber) {
    originalRemoveFromDelayedQueue.call(this, queueNumber);
    currentCallIndex = 0; // Reset index when queue changes
  };

  const originalAddToDelayedQueue = QueueManager.prototype.addToDelayedQueue;
  QueueManager.prototype.addToDelayedQueue = function (queueNumber) {
    originalAddToDelayedQueue.call(this, queueNumber);
    if (this.delayedQueue.length === 1) {
      currentCallIndex = 0; // Reset index when first item added
    }
  };
}


// Main initialization function
async function initializePage() {
  try {
    await initializeUsers();
  } catch (error) {
    console.error("Authentication initialization error:", error);
  }
}

// Add this to ensure voices are loaded
window.speechSynthesis.onvoiceschanged = () => {
  const voices = window.speechSynthesis.getVoices();
};

// Main DOM content loaded event
document.addEventListener("DOMContentLoaded", function () {
  
     // Tambahkan event listener untuk tombol logout jika menggunakan event listener
     const logoutBtn = document.getElementById('logoutBtn');
     if (logoutBtn) {
         logoutBtn.addEventListener('click', handleLogout);
     }
  // Initialize authentication
  initializePage();

  // Initialize queue system if on queue page
  if (document.getElementById("queueNumber")) {
    initializeQueueSystem();
  }

  // Initialize buyback functionality if on buyback page
  const btnTambahPenerimaan = document.getElementById("btnTambahPenerimaan");
  if (btnTambahPenerimaan) {
    btnTambahPenerimaan.addEventListener("click", () => {
      tambahBaris("#tablePenerimaan tbody");
    });
  }

  if (typeof penerimaanHandler !== "undefined") {
    penerimaanHandler.initializeForm();
  }
});
