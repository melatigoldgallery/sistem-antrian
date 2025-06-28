import { sidebarToggle } from "./components/sidebar.js";
import { initializeDateTime } from "./components/header.js";
import { setupMenuVisibility } from "./menuControl.js";

// Authentication functions
async function checkLoginStatus() {
  // Skip jika di halaman login
  if (window.location.pathname.includes('index.html') || 
      window.location.pathname === '/' || 
      window.location.pathname.endsWith('/')) {
    return true;
  }

  try {
    // Cek sessionStorage dulu (synchronous dan cepat)
    const sessionUser = sessionStorage.getItem("currentUser");
    if (!sessionUser) {
      console.log("No session user found, redirecting to login");
      window.location.href = "index.html";
      return false;
    }

    // Cek Firebase Auth sebagai validasi tambahan
    try {
      const { authService } = await import('./configFirebase.js');
      const user = await authService.getCurrentUser();
      
      // Jika Firebase Auth mengembalikan null tapi sessionStorage ada
      if (!user) {
        console.log("Firebase auth user not found, but session exists");
        // Biarkan sessionStorage sebagai fallback untuk kompatibilitas
        // Tidak redirect karena mungkin Firebase Auth belum ready
      } else {
        // Sinkronisasi data jika Firebase Auth berhasil
        const parsedSessionUser = JSON.parse(sessionUser);
        if (!parsedSessionUser.uid && user.uid) {
          sessionStorage.setItem('currentUser', JSON.stringify({
            uid: user.uid,
            email: user.email,
            role: user.role || user.displayName || parsedSessionUser.role || 'user',
            username: parsedSessionUser.username || user.email
          }));
        }
      }
    } catch (firebaseError) {
      console.warn("Firebase auth check failed, using session fallback:", firebaseError);
      // Lanjutkan dengan sessionStorage jika Firebase gagal
    }

    return true;
  } catch (error) {
    console.error("Error checking login status:", error);
    window.location.href = "index.html";
    return false;
  }
}

function handleLogout() {
  // Clear session immediately
  sessionStorage.removeItem("currentUser");
  
  // Try Firebase logout
  import('./configFirebase.js').then(({ authService }) => {
    authService.logout().then(() => {
      window.location.href = "index.html";
    }).catch(() => {
      window.location.href = "index.html";
    });
  }).catch(() => {
    window.location.href = "index.html";
  });
}

function checkSupervisorAuth() {
  if (window.location.href.includes("supervisor.html") || window.location.href.includes("tambah-pengguna.html")) {
    const currentUser = JSON.parse(sessionStorage.getItem("currentUser") || "{}");
    const isAdmin = currentUser.username === "adminmelati" || currentUser.role === "admin";

    if (!isAdmin) {
      window.location.href = "dashboard.html";
    }
  }
}

// Initialize UI components
try {
  sidebarToggle();
  initializeDateTime();

  // DOM Content Loaded Handler
  document.addEventListener("DOMContentLoaded", async function () {
    // Auth check pertama dan terpenting
    const isAuthenticated = await checkLoginStatus();
    
    if (!isAuthenticated) {
      return; // Stop execution jika tidak terautentikasi
    }
    
    // Setup UI components setelah auth berhasil
    const appContainer = document.querySelector(".app-container");
    const sidebar = document.querySelector(".sidebar");
    const hamburger = document.querySelector(".hamburger");

    if (appContainer && sidebar && hamburger) {
      document.addEventListener("click", function (e) {
        if (
          appContainer.classList.contains("sidebar-active") &&
          !sidebar.contains(e.target) &&
          !hamburger.contains(e.target)
        ) {
          appContainer.classList.remove("sidebar-active");
          document.body.style.overflow = "";
        }
      });
    }

    checkSupervisorAuth();
    setupMenuVisibility();
  });

} catch (error) {
  console.error("Error initializing UI components:", error);
}

// Export global functions
window.handleLogout = handleLogout;
