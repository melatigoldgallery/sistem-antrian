import { sidebarToggle } from "./components/sidebar.js";
import { initializeDateTime } from "./components/header.js";

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
  });
  
  // Fungsi untuk setup autentikasi Supervisor
  function setupSupervisorAuthentication() {
    // Cari tombol toggle Supervisor di sidebar
    const supervisorToggle = document.querySelector('.sidebar a[data-bs-target="#supervisorSubmenu"]');
    
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
    }
  }
  
  // Handler function untuk click event
  function supervisorClickHandler(event) {
    event.preventDefault();
    
    // Tampilkan modal autentikasi
    const authModal = document.getElementById('supervisorAuthModal');
    if (authModal) {
      const bsModal = new bootstrap.Modal(authModal);
      bsModal.show();
    }
  }
  
  // Fungsi untuk membuat modal autentikasi
  function createSupervisorAuthModal() {
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
  }
  
  // Fungsi untuk setup event listeners pada modal autentikasi
  function setupSupervisorAuthEvents() {
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
    }
    
    // Event listener untuk form submit
    if (authForm) {
      authForm.addEventListener('submit', function(event) {
        event.preventDefault();
        loginBtn.click();
      });
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
  
  // Panggil fungsi untuk setup autentikasi supervisor
  setupSupervisorAuthentication();
  
  // Panggil fungsi untuk cek autentikasi
  checkSupervisorAuth();
} catch (error) {
  console.error("Error initializing UI components:", error);
}
