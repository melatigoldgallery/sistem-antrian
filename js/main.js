import { sidebarToggle } from "./components/sidebar.js";
import { initializeDateTime } from "./components/header.js";
import { setupMenuVisibility } from "./menuControl.js";

// Panggil fungsi-fungsi ini di awal file
try {  
  // Inisialisasi komponen UI utama
  sidebarToggle();
  initializeDateTime();
  
  // Tambahkan event listener untuk dokumen setelah DOM loaded
  document.addEventListener('DOMContentLoaded', function() {
    // Tambahkan event listener untuk menutup sidebar ketika mengklik di luar sidebar
    const appContainer = document.querySelector('.app-container');
    const sidebar = document.querySelector('.sidebar');
    const hamburger = document.querySelector('.hamburger');
    
    if (appContainer && sidebar && hamburger) {
      document.addEventListener('click', function(e) {
        // Jika sidebar sedang aktif dan klik bukan pada sidebar atau elemen di dalamnya
        // dan bukan pada tombol hamburger
        if (
          appContainer.classList.contains('sidebar-active') && 
          !sidebar.contains(e.target) && 
          !hamburger.contains(e.target)
        ) {
          appContainer.classList.remove('sidebar-active');
          document.body.style.overflow = '';
        }
      });
    }
    
    // Panggil fungsi checkSupervisorAuth untuk memeriksa akses ke halaman supervisor
    checkSupervisorAuth();
    
    // Panggil fungsi untuk menyembunyikan menu supervisor jika bukan admin
    setupMenuVisibility();
  });

  // Cek apakah user sudah terotentikasi saat membuka halaman supervisor
  function checkSupervisorAuth() {
    if (window.location.href.includes('supervisor.html') || 
        window.location.href.includes('tambah-pengguna.html')) {
      
      // Gunakan sistem role baru
      const currentUser = JSON.parse(sessionStorage.getItem('currentUser') || '{}');
      const isAdmin = currentUser.username === 'adminmelati' || currentUser.role === 'admin';
      
      if (!isAdmin) {
        // Redirect ke halaman utama jika bukan admin
        window.location.href = 'dashboard.html';
      }
    }
  }

} catch (error) {
  console.error("Error initializing UI components:", error);
}
