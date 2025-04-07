import { sidebarToggle } from "./components/sidebar.js";
import { initializeDateTime } from "./components/header.js";

// Panggil fungsi-fungsi ini di awal file
try {
  console.log("Initializing UI components...");
  sidebarToggle();
  initializeDateTime();
  
  // Tambahkan kode untuk menangani dropdown Supervisor dan mobile sidebar
  document.addEventListener('DOMContentLoaded', function() {
    // Inisialisasi handler untuk sidebar mobile
    initMobileSidebarHandlers();
    
    // Cek apakah halaman saat ini adalah supervisor.html
    if (window.location.href.includes('supervisor.html')) {
      // Menangani dropdown Supervisor
      const supervisorToggle = document.querySelector('[data-bs-target="#supervisorSubmenu"]');
      const supervisorDropdown = document.getElementById('supervisorSubmenu');
      const absensiDropdown = document.getElementById('absensiSubmenu');
      
      if (supervisorToggle && supervisorDropdown && absensiDropdown) {
        // Buka dropdown Absensi secara otomatis saat halaman dimuat
        new bootstrap.Collapse(absensiDropdown, { toggle: true });
        
        // Tambahkan event listener untuk dropdown Supervisor
        supervisorToggle.addEventListener('click', function(event) {
          event.preventDefault();
          
          // Toggle dropdown Supervisor tanpa menutup dropdown Absensi
          new bootstrap.Collapse(supervisorDropdown, { toggle: true });
        });
      }
    } else {
      // Untuk halaman lain, tambahkan autentikasi untuk menu Supervisor
      setupSupervisorAuthentication();
    }
  });
  
  // Fungsi untuk menginisialisasi handler sidebar pada mobile
  function initMobileSidebarHandlers() {
    console.log("Initializing mobile sidebar handlers");
    
    // Ambil semua elemen yang diperlukan
    const hamburgerBtn = document.querySelector('.hamburger');
    const sidebarOverlay = document.querySelector('.sidebar-overlay');
    const appContainer = document.querySelector('.app-container');
    const sidebar = document.querySelector('.sidebar');
    
    // Handler untuk membuka sidebar
    if (hamburgerBtn) {
      hamburgerBtn.addEventListener('click', function(e) {
        e.preventDefault();
        appContainer.classList.add('sidebar-active');
        console.log("Sidebar opened");
      });
    }
    
    // Handler untuk menutup sidebar saat overlay diklik
    if (sidebarOverlay) {
      sidebarOverlay.addEventListener('click', function(e) {
        e.preventDefault();
        appContainer.classList.remove('sidebar-active');
        console.log("Sidebar closed via overlay");
      });
    }
    
    // Perbaikan untuk menu sidebar pada mobile
    const navLinks = document.querySelectorAll('.sidebar .nav-link');
    
    navLinks.forEach(link => {
      // Hapus event listener yang mungkin sudah ada
      const newLink = link.cloneNode(true);
      link.parentNode.replaceChild(newLink, link);
      
      // Tambahkan event listener baru
      newLink.addEventListener('click', function(e) {
        // Jika link memiliki submenu, jangan hentikan propagasi
        if (this.getAttribute('data-bs-toggle') === 'collapse') {
          // Biarkan Bootstrap collapse handler bekerja
          return;
        }
        
        // Jika link adalah Supervisor, gunakan handler khusus
        if (this.getAttribute('data-bs-target') === '#supervisorSubmenu') {
          // Handler akan ditangani oleh setupSupervisorAuthentication
          return;
        }
        
        // Untuk link lain, tutup sidebar setelah diklik (hanya pada mobile)
        if (window.innerWidth <= 768) {
          setTimeout(() => {
            appContainer.classList.remove('sidebar-active');
            console.log("Sidebar closed after link click");
          }, 150); // Delay sedikit untuk memastikan event click selesai
        }
      });
    });
    
    console.log("Mobile sidebar handlers initialized");
  }
  
  // Fungsi untuk setup autentikasi Supervisor
  function setupSupervisorAuthentication() {
    console.log("Setting up supervisor authentication");
    
    // Cari tombol toggle Supervisor di sidebar dengan selector yang lebih spesifik
    // Gunakan beberapa selector alternatif untuk memastikan kita menemukan elemen yang benar
    let supervisorToggle = document.querySelector('.sidebar a[data-bs-target="#supervisorSubmenu"]');
    
    // Alternatif selector jika yang pertama tidak berhasil
    if (!supervisorToggle) {
      supervisorToggle = document.querySelector('.sidebar .nav-link[data-bs-target="#supervisorSubmenu"]');
    }
    
    // Alternatif lain
    if (!supervisorToggle) {
      const links = document.querySelectorAll('.sidebar .nav-link');
      for (const link of links) {
        if (link.textContent.includes('Supervisor')) {
          supervisorToggle = link;
          break;
        }
      }
    }
    
    console.log("Supervisor toggle element:", supervisorToggle);
    
    if (supervisorToggle) {
      // Buat modal autentikasi jika belum ada
      if (!document.getElementById('supervisorAuthModal')) {
        createSupervisorAuthModal();
      }
      
      // Hapus event listener yang mungkin sudah ada
      const newToggle = supervisorToggle.cloneNode(true);
      supervisorToggle.parentNode.replaceChild(newToggle, supervisorToggle);
      
      // Tambahkan event listener baru
      newToggle.addEventListener('click', supervisorClickHandler);
      
      console.log("Supervisor click handler attached");
    } else {
      console.error("Supervisor toggle element not found");
    }
  }
  
  // Handler function untuk click event
  function supervisorClickHandler(event) {
    console.log("Supervisor toggle clicked");
    event.preventDefault();
    
    // Tampilkan modal autentikasi
    const authModal = document.getElementById('supervisorAuthModal');
    if (authModal) {
      const bsModal = new bootstrap.Modal(authModal);
      bsModal.show();
      console.log("Auth modal shown");
    } else {
      console.error("Auth modal element not found");
    }
  }
  
  // Fungsi untuk membuat modal autentikasi
  function createSupervisorAuthModal() {
    console.log("Creating supervisor auth modal");
    
    // Buat elemen modal
    const modalHTML = `
      <div class="modal fade" id="supervisorAuthModal" tabindex="-1" aria-labelledby="supervisorAuthModalLabel" aria-hidden="true">
        <div class="modal-dialog modal-dialog-centered">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title" id="supervisorAuthModalLabel">Autentikasi Supervisor</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body">
              <form id="supervisorAuthForm">
                <div class="mb-3">
                  <label for="supervisorUsername" class="form-label">Username</label>
                  <input type="text" class="form-control" id="supervisorUsername" required>
                </div>
                <div class="mb-3">
                  <label for="supervisorPassword" class="form-label">Password</label>
                  <div class="input-group">
                    <input type="password" class="form-control" id="supervisorPassword" required>
                    <button class="btn btn-outline-secondary toggle-password" type="button">
                      <i class="fas fa-eye"></i>
                    </button>
                  </div>
                </div>
                <div class="alert alert-danger d-none" id="authError">
                  Username atau password salah!
                </div>
              </form>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Batal</button>
              <button type="button" class="btn btn-primary" id="supervisorLoginBtn">Login</button>
            </div>
          </div>
        </div>
      </div>
    `;
    
    // Tambahkan modal ke body
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    // Setup event listeners untuk modal
    setupSupervisorAuthEvents();
    
    console.log("Supervisor auth modal created");
  }
  
  // Fungsi untuk setup event listeners pada modal autentikasi
  function setupSupervisorAuthEvents() {
    console.log("Setting up supervisor auth events");
    
    // Ambil elemen-elemen yang diperlukan
    const modal = document.getElementById('supervisorAuthModal');
    const loginBtn = document.getElementById('supervisorLoginBtn');
    const authForm = document.getElementById('supervisorAuthForm');
    const usernameInput = document.getElementById('supervisorUsername');
    const passwordInput = document.getElementById('supervisorPassword');
    const errorAlert = document.getElementById('authError');
    const togglePasswordBtn = document.querySelector('.toggle-password');
    
    // Kredensial yang valid (dalam praktiknya, ini harus diambil dari server)
    const validCredentials = {
      username: 'supervisor',
      password: 'admin123'
    };
    
    // Event listener untuk tombol login
    if (loginBtn) {
      loginBtn.addEventListener('click', function() {
        console.log("Login button clicked");
        
        const username = usernameInput.value.trim();
        const password = passwordInput.value.trim();
        
        // Validasi input
        if (!username || !password) {
          errorAlert.textContent = 'Username dan password harus diisi!';
          errorAlert.classList.remove('d-none');
          return;
        }
        
        // Cek kredensial
        if (username === validCredentials.username && password === validCredentials.password) {
          // Simpan status autentikasi di sessionStorage
          sessionStorage.setItem('supervisorAuthenticated', 'true');
          
          // Tutup modal
          const authModal = bootstrap.Modal.getInstance(modal);
          authModal.hide();
          
          // Redirect ke halaman supervisor
          window.location.href = 'supervisor.html';
        } else {
          // Tampilkan pesan error
          errorAlert.textContent = 'Username atau password salah!';
          errorAlert.classList.remove('d-none');
        }
      });
      
      console.log("Login button event listener attached");
    }
    
    // Event listener untuk form submit
    if (authForm) {
      authForm.addEventListener('submit', function(event) {
        event.preventDefault();
        loginBtn.click();
      });
      
      console.log("Form submit event listener attached");
    }
    
    // Event listener untuk toggle password visibility
    if (togglePasswordBtn) {
      togglePasswordBtn.addEventListener('click', function() {
        const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
        passwordInput.setAttribute('type', type);
        
        // Ganti ikon
        const icon = this.querySelector('i');
        if (type === 'text') {
          icon.classList.remove('fa-eye');
          icon.classList.add('fa-eye-slash');
        } else {
          icon.classList.remove('fa-eye-slash');
          icon.classList.add('fa-eye');
        }
      });
      
      console.log("Toggle password button event listener attached");
    }
    
    // Reset form saat modal ditutup
    if (modal) {
      modal.addEventListener('hidden.bs.modal', function() {
        authForm.reset();
        errorAlert.classList.add('d-none');
        
        // Reset password field type
        passwordInput.setAttribute('type', 'password');
        const icon = togglePasswordBtn.querySelector('i');
        icon.classList.remove('fa-eye-slash');
        icon.classList.add('fa-eye');
      });
      
      console.log("Modal hidden event listener attached");
    }
  }
  
  // Cek apakah user sudah terotentikasi saat membuka halaman supervisor
  function checkSupervisorAuth() {
    if (window.location.href.includes('supervisor.html') || 
        window.location.href.includes('tambah-pengguna.html')) {
      const isAuthenticated = sessionStorage.getItem('supervisorAuthenticated') === 'true';
      
      if (!isAuthenticated) {
        // Redirect ke halaman utama jika belum terotentikasi
        window.location.href = 'dashboard.html';
      }
    }
  }
  
  // Tambahkan event listener untuk resize window
  window.addEventListener('resize', function() {
    // Reinisialisasi handler untuk sidebar mobile saat ukuran window berubah
    if (window.innerWidth <= 768) {
      initMobileSidebarHandlers();
    }
  });
  
  // Panggil fungsi untuk cek autentikasi
  checkSupervisorAuth();
  
  console.log("UI components initialized successfully");
} catch (error) {
  console.error("Error initializing UI components:", error);
}
