// Import statements
import { getDatabase, ref, set, onValue } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-database.js";
import { QueueAnalytics } from './queueAnalytics.js';
import { database } from './configFirebase.js';
import { dateHandler } from "./date.js";
import { QueueManager } from "./antrian.js";
import { initializeUsers } from './auth/initUsers.js';
import { authService } from './configFirebase.js';
import { checkAuth } from './auth/authCheck.js';
import {
  playWaitMessageSequence,
  playTakeQueueMessage,
  playQueueAnnouncement,
  announceQueueNumber,
  announceVehicleMessage,
} from "./audioHandlers.js";
async function initializePage() {
  try {
      // Initialize authorized users
      await initializeUsers();
      console.log('Users initialized successfully');

      // Check authentication
      const isAuthenticated = await checkAuth();
      if (!isAuthenticated) {
          window.location.href = 'index.html';
          return;
      }

      // Add logout button handler
      document.getElementById('logoutBtn').addEventListener('click', async () => {
          try {
              await authService.logout();
              window.location.href = 'index.html';
          } catch (error) {
              console.error('Logout failed:', error);
          }
      });

  } catch (error) {
      console.error('Initialization error:', error);
  }
}

// Start the application
initializePage();
// Hamberger Menu
const hamburgerMenu = document.querySelector('.hamburger-menu');
const navList = document.querySelector('.nav-list');

// Toggle menu when hamburger is clicked
hamburgerMenu.addEventListener('click', (event) => {
  event.stopPropagation();
  navList.classList.toggle('active');
});

// Close menu when clicking anywhere on the document
document.addEventListener('click', (event) => {
  if (!navList.contains(event.target) && !hamburgerMenu.contains(event.target)) {
    navList.classList.remove('active');
  }
});

// Prevent menu from closing when clicking inside nav-list
navList.addEventListener('click', (event) => {
  event.stopPropagation();
});

document.querySelector(".hamburger-menu").addEventListener("click", function () {
  document.querySelector(".sidebar").classList.toggle("active");
});
dateHandler.initializeDatepicker();
document.addEventListener("DOMContentLoaded", () => {
  aksesorisSaleHandler.init();
  initTableToggles();
  initPengeluaranInput();
});
// Add jQuery ready check for datepicker
$(document).ready(function () {
  dateHandler.initializeDatepicker();
});
document.addEventListener("DOMContentLoaded", function () {
  // Re-initialize date handling after DOM is loaded
  dateHandler.initializeDatepicker();
});

// Add this to ensure voices are loaded
window.speechSynthesis.onvoiceschanged = () => {
  const voices = window.speechSynthesis.getVoices();
  console.log("Available voices:", voices);
};
// Global variables
let queueManager;
let queueDisplay;
let nextQueueDisplay;
let delayQueueDisplay;

function updateDisplays() {
    // Add null checks and default values
    const currentQueue = queueManager?.getCurrentQueue() || 'A01';
    const nextQueue = queueManager?.getNextQueue() || 'A02';
    const delayedQueue = queueManager?.getDelayedQueue() || [];

    if (queueDisplay) queueDisplay.textContent = currentQueue;
    if (nextQueueDisplay) nextQueueDisplay.textContent = nextQueue;
    if (delayQueueDisplay) delayQueueDisplay.textContent = delayedQueue.join(", ") || "-";
}
document.addEventListener("DOMContentLoaded", async () => {
  const queueAnalytics = new QueueAnalytics(database);
  // Initialize DOM elements
  queueDisplay = document.getElementById("queueNumber");
  nextQueueDisplay = document.getElementById("nextQueueNumber");
  delayQueueDisplay = document.getElementById("delayQueueNumber");
  
  // Initialize queue manager
  queueManager = new QueueManager();
  await queueManager.initializeFromFirebase();
  await queueManager.initializeCustomerCount();
  updateDisplays();
  
  // Update the delay queue button handler
  // Initialize buttons
  const delayQueueButton = document.getElementById("delayQueueButton");
  const confirmDelayYes = document.getElementById("confirmDelayYes");
  
 // Customer count button handlers
 const tambahCustomerBtn = document.getElementById("tambahCustomerBtn");
  const kurangiCustomerBtn = document.getElementById("kurangiCustomerBtn");

  tambahCustomerBtn.addEventListener("click", () => queueManager.incrementCustomer());
  kurangiCustomerBtn.addEventListener("click", () => queueManager.decrementCustomer());
   
  
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
            await queueAnalytics.trackServedQueue(currentQueue, 'delayed');
            
            // Update queue management
            queueManager.addToDelayedQueue(currentQueue);
            queueDisplay.textContent = queueManager.next();
            
            // Close modal and update displays
            bootstrap.Modal.getInstance(document.getElementById("confirmDelayModal")).hide();
            updateDisplays();
            
            console.log('Queue delayed and tracked successfully');
        } catch (error) {
            console.error('Error processing delayed queue:', error);
        }
    });
}
  // Call Queue Number (Indonesia)
  document.getElementById("callButton").addEventListener("click", async () => {
    const currentQueue = queueDisplay.textContent;
    await playQueueAnnouncement(currentQueue, "id");
});
  // Call Queue Number (English)
  document.getElementById("callQueue").addEventListener("click", async () => {
    const currentQueue = queueDisplay.textContent;
    await playQueueAnnouncement(currentQueue, "en");
  });

  // Tombol Validasi Terlayani
  document.getElementById("handleButton").addEventListener("click", () => {
    const modal = new bootstrap.Modal(document.getElementById("confirmModal"));
    modal.show();
  });
  // Update the confirm handlers to decrease customer count
  document.getElementById("confirmYes").addEventListener("click", async () => {
    try {
      const currentQueue = queueDisplay.textContent;
      await queueAnalytics.trackServedQueue(currentQueue);
      await queueManager.decrementCustomer(); // Kurangi customer saat dilayani
      queueDisplay.textContent = queueManager.next();
      
      const modal = bootstrap.Modal.getInstance(document.getElementById("confirmModal"));
      modal.hide();
      
      updateDisplays();
    } catch (error) {
      console.error('Processing error:', error);
    }
  });
  
  // Tombol Handle Delay Queue Number
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
  
  document.getElementById("confirmDelayedYes").addEventListener("click", async () => {
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

  // Tambahkan listener untuk perubahan data customer count di Firebase
// Customer count real-time listener
onValue(queueManager.customerRef, (snapshot) => {
  const count = snapshot.val() || 0;
  const customerCountDisplay = document.getElementById("customerCount");
  if (customerCountDisplay) {
    customerCountDisplay.textContent = count;
    
    // Start or stop notifications based on count
    if (count > 0) {
      startPeriodicNotifications();
    } else {
      stopPeriodicNotifications();
    }
  }
});

//Fungsi notifikasi setiap 30 detik
let notificationInterval;

// Function to start periodic notifications
function startPeriodicNotifications() {
  if (!notificationInterval) {
    notificationInterval = setInterval(() => {
      const count = parseInt(document.getElementById("customerCount").textContent);
      if (count > 0) {
        playNotificationSound();
      }
    }, 60000); // 60 seconds
  }
}

// Function to stop periodic notifications
function stopPeriodicNotifications() {
  if (notificationInterval) {
    clearInterval(notificationInterval);
    notificationInterval = null;
  }
}
// Clean up interval when page unloads
window.addEventListener('beforeunload', () => {
  stopPeriodicNotifications();
});

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

// Event listener untuk tombol panggilan berurutan Indonesia
document.getElementById("sequentialCallButton").addEventListener("click", async () => {
  await callSequentially("id");
});

// Event listener untuk tombol panggilan berurutan English
document.getElementById("sequentialCallQueueButton").addEventListener("click", async () => {
  await callSequentially("en");
});

// Reset index saat ada perubahan pada delayed queue
const originalRemoveFromDelayedQueue = queueManager.removeFromDelayedQueue;
queueManager.removeFromDelayedQueue = function(queueNumber) {
  originalRemoveFromDelayedQueue.call(this, queueNumber);
  currentCallIndex = 0; // Reset index when queue changes
};

const originalAddToDelayedQueue = queueManager.addToDelayedQueue;
queueManager.addToDelayedQueue = function(queueNumber) {
  originalAddToDelayedQueue.call(this, queueNumber);
  if (this.delayedQueue.length === 1) {
    currentCallIndex = 0; // Reset index when first item added
  }
};


  // Pengingat Nomor Antrian
  document.getElementById("takeMessage").addEventListener("click", () => {
    playTakeQueueMessage("id");
  });

  document.getElementById("takeQueue").addEventListener("click", () => {
    playTakeQueueMessage("en");
  });

  // Update wait message button event listener
  document.getElementById("waitMessage").addEventListener("click", () => {
    playWaitMessageSequence("id");
  });
  document.getElementById("waitInformation").addEventListener("click", () => {
    playWaitMessageSequence("en");
  });

  // Store the intended action
let pendingAction = '';
  // Add event listeners for custom queue
  document.getElementById("customQueueButton").addEventListener("click", () => {
    pendingAction = 'custom';
    const passwordModal = new bootstrap.Modal(document.getElementById("passwordModal"));
    passwordModal.show();
  });
  document.getElementById("setCustomQueue").addEventListener("click", () => {
    const letter = document.getElementById("queueLetter").value;
    const number = parseInt(document.getElementById("queueNumberInput").value);
  

    if (number >= 1 && number <= 50) {
      queueDisplay.textContent = queueManager.setCustomQueue(letter, number);
      bootstrap.Modal.getInstance(document.getElementById("customQueueModal")).hide();
    } else {
      alert("Please enter a valid number between 1 and 50");
    }
    updateDisplays();
  });
  document.getElementById("confirmPassword").addEventListener("click", () => {
    const adminId = document.getElementById("adminId").value;
    const password = document.getElementById("adminPassword").value;
    
    // Replace these credentials with your actual authentication logic
    if (adminId === "adminmelati" && password === "melatijaya") {
      // Hide password modal
      bootstrap.Modal.getInstance(document.getElementById("passwordModal")).hide();
      
      // Clear the form
      document.getElementById("adminId").value = '';
      document.getElementById("adminPassword").value = '';
      
      // Proceed with the intended action
      if (pendingAction === 'custom') {
        const customQueueModal = new bootstrap.Modal(document.getElementById("customQueueModal"));
        customQueueModal.show();
      } else if (pendingAction === 'reset') {
        const resetModal = new bootstrap.Modal(document.getElementById("resetModal"));
        resetModal.show();
      }
    } else {
      alert("Invalid credentials. Please try again.");
    }
  });

  // Update event listener for reset button
  document.getElementById("resetButton").addEventListener("click", () => {
    pendingAction = 'reset';
    const passwordModal = new bootstrap.Modal(document.getElementById("passwordModal"));
    passwordModal.show();
  });
  document.getElementById("resetYes").addEventListener("click", () => {
    queueDisplay.textContent = queueManager.reset();
    bootstrap.Modal.getInstance(document.getElementById("resetModal")).hide();
    updateDisplays();
  });
  // Informasi Kendaraan
  const carTypeInput = document.getElementById("carType");
  const plateNumberInput = document.getElementById("plateNumber");
  // Fungsi untuk mengubah karakter menjadi ejaan
function getCharacterSpelling(char, language) {
  // Mapping untuk pengejaan khusus
  const spellingMap = {
    id: {
      '0': 'nol',
      '1': 'satu',
      '2': 'dua',
      '3': 'tiga',
      '4': 'empat',
      '5': 'lima',
      '6': 'enam',
      '7': 'tujuh',
      '8': 'delapan',
      '9': 'sembilan',
      'A': 'a',
      'B': 'be',
      'C': 'ce',
      'D': 'de',
      'E': 'e',
      'F': 'ef',
      'G': 'ge',
      'H': 'ha',
      'I': 'i',
      'J': 'je',
      'K': 'ka',
      'L': 'el',
      'M': 'em',
      'N': 'en',
      'O': 'o',
      'P': 'pe',
      'Q': 'qi',
      'R': 'er',
      'S': 'es',
      'T': 'te',
      'U': 'u',
      'V': 've',
      'W': 'we',
      'X': 'ex',
      'Y': 'ye',
      'Z': 'zet'
    },
    en: {
      '0': 'zero',
      '1': 'one',
      '2': 'two',
      '3': 'three',
      '4': 'four',
      '5': 'five',
      '6': 'six',
      '7': 'seven',
      '8': 'eight',
      '9': 'nine',
      'A': 'a',
      'B': 'b',
      'C': 'c',
      'D': 'd',
      'E': 'e',
      'F': 'f',
      'G': 'g',
      'H': 'h',
      'I': 'i',
      'J': 'j',
      'K': 'k',
      'L': 'l',
      'M': 'm',
      'N': 'n',
      'O': 'o',
      'P': 'p',
      'Q': 'q',
      'R': 'r',
      'S': 's',
      'T': 't',
      'U': 'u',
      'V': 'v',
      'W': 'w',
      'X': 'x',
      'Y': 'y',
      'Z': 'z'
    }
  };

  const upperChar = char.toUpperCase();
  return spellingMap[language][upperChar] || char;
}

// Fungsi untuk mengeja nomor polisi
function spellPlateNumber(plateNumber, language) {
  const chars = plateNumber.split('');
  return chars.map(char => getCharacterSpelling(char, language)).join(' ');
}

 // Modifikasi event listener untuk tombol Bahasa Indonesia
document.getElementById("panggilInformasi").addEventListener("click", () => {
  const carType = carTypeInput.value;
  const plateNumber = plateNumberInput.value;

  if (!carType || !plateNumber) {
    alert("Mohon isi jenis mobil dan nomor polisi");
    return;
  }

  const spelledPlateNumber = spellPlateNumber(plateNumber, "id");
  announceVehicleMessage(carType, spelledPlateNumber, "id");
});

// Modifikasi event listener untuk tombol Bahasa Inggris
document.getElementById("callInformation").addEventListener("click", () => {
  const carType = carTypeInput.value;
  const plateNumber = plateNumberInput.value;

  if (!carType || !plateNumber) {
    alert("Please fill in car type and plate number");
    return;
  }

  const spelledPlateNumber = spellPlateNumber(plateNumber, "en");
  announceVehicleMessage(carType, spelledPlateNumber, "en");
});

// Documentation modal handler
document.getElementById('documentationLink').addEventListener('click', (e) => {
  e.preventDefault();
  const documentationModal = new bootstrap.Modal(document.getElementById('documentationModal'));
  documentationModal.show();
});
});
// Add event listener for password confirmation
