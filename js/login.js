import { initializeUsers } from './auth/initUsers.js';
import { loginUser } from './auth/initUsers.js';
import { getAuth, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-auth.js";

function showToast(message) {
  const toast = document.getElementById('toast');
  const toastMessage = document.getElementById('toastMessage');
  toastMessage.textContent = message;
  toast.classList.add('show');
  setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}

document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;
  
  if (!username || !password) {
    showToast('Mohon isi username dan password');
    return;
  }
  
  try {
    const loginButton = document.querySelector('#loginForm button[type="submit"]');
    const originalButtonText = loginButton ? loginButton.innerHTML : 'Login';
    if (loginButton) {
      loginButton.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Loading...';
      loginButton.disabled = true;
    }
    
    console.log("Attempting to login with username:", username);
    
    let result = { success: false };
    
    if (username === 'supervisor' && password === 'svmlt116') {
      console.log("Using hardcoded admin credentials");
      const auth = getAuth();
      try {
        await signInWithEmailAndPassword(auth, 'melatigoldshopid@gmail.com', 'svmlt116');
        result = { success: true, role: 'admin', username: 'supervisor' };
        console.log("Hardcoded admin login successful");
      } catch (authError) {
        console.error("Direct admin auth failed:", authError);
      }
    } else if (username === 'stafmelati' && password === 'staf116') {
      console.log("Using hardcoded operator credentials");
      const auth = getAuth();
      try {
        await signInWithEmailAndPassword(auth, 'fattahula43@gmail.com', 'staf116');
        result = { success: true, role: 'staf', username: 'staf' };
        console.log("Hardcoded operator login successful");
      } catch (authError) {
        console.error("Direct operator auth failed:", authError);
      }
    }
    
    if (!result.success) {
      console.log("Hardcoded login failed, trying normal login flow");
      try {
        await initializeUsers();
        result = await loginUser(username, password);
        console.log("Normal login result:", result);
      } catch (initError) {
        console.error("Login process error:", initError);
        result = { success: false, message: "Terjadi kesalahan saat login" };
      }
    }
    
    if (loginButton) {
      loginButton.innerHTML = originalButtonText;
      loginButton.disabled = false;
    }
    
    if (result.success) {
      console.log("Login successful, redirecting...");
      sessionStorage.setItem('currentUser', JSON.stringify({
        username: result.username,
        role: result.role
      }));
      sessionStorage.setItem('userRole', result.role);
      window.location.href = 'dashboard.html';
    } else {
      showToast('Username atau password salah. Silakan coba lagi.');
    }
  } catch (error) {
    console.error('Login error:', error);
    showToast('Terjadi kesalahan saat login. Silakan periksa koneksi internet dan coba lagi.');
    const loginButton = document.querySelector('#loginForm button[type="submit"]');
    if (loginButton) {
      loginButton.innerHTML = 'Login';
      loginButton.disabled = false;
    }
  }
});

  document.addEventListener('DOMContentLoaded', function() {
    // Toggle password visibility
    const togglePasswordButton = document.querySelector('.toggle-password');
    const passwordInput = document.getElementById('password');
    
    if (togglePasswordButton && passwordInput) {
        togglePasswordButton.addEventListener('click', function() {
            // Toggle tipe input antara 'password' dan 'text'
            const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
            passwordInput.setAttribute('type', type);
            
            // Toggle icon antara 'eye' dan 'eye-slash'
            const icon = this.querySelector('i');
            if (type === 'password') {
                icon.classList.remove('fa-eye-slash');
                icon.classList.add('fa-eye');
            } else {
                icon.classList.remove('fa-eye');
                icon.classList.add('fa-eye-slash');
            }
        });
    }
    
    // Kode login lainnya yang sudah ada...
});
