import { initializeUsers } from './auth/initUsers.js';
import { loginUser } from './auth/initUsers.js';
import { getAuth, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-auth.js";

document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    
    if (!username || !password) {
      alert('Mohon isi username dan password');
      return;
    }
  
    try {
      // Tampilkan indikator loading
      const loginButton = document.querySelector('#loginForm button[type="submit"]');
      const originalButtonText = loginButton ? loginButton.innerHTML : 'Login';
      if (loginButton) {
        loginButton.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Loading...';
        loginButton.disabled = true;
      }
      
      console.log("Attempting to login with username:", username);
      
      // Coba login dengan hardcoded credentials terlebih dahulu
      let result = { success: false };
      
      // Hardcoded login untuk admin
      if (username === 'adminmelati' && password === 'admin') {
        console.log("Using hardcoded admin credentials");
        const auth = getAuth();
        try {
          await signInWithEmailAndPassword(auth, 'melatigoldshopid@gmail.com', 'admin');
          result = { success: true, role: 'admin', username: 'adminmelati' };
          console.log("Hardcoded admin login successful");
        } catch (authError) {
          console.error("Direct admin auth failed:", authError);
        }
      } 
      // Hardcoded login untuk operator
      else if (username === 'operator' && password === 'operator123') {
        console.log("Using hardcoded operator credentials");
        const auth = getAuth();
        try {
          await signInWithEmailAndPassword(auth, 'operator@melatigold.com', 'operator123');
          result = { success: true, role: 'operator', username: 'operator' };
          console.log("Hardcoded operator login successful");
        } catch (authError) {
          console.error("Direct operator auth failed:", authError);
        }
      }
      
      // Jika hardcoded login gagal, coba dengan metode normal
      if (!result.success) {
        console.log("Hardcoded login failed, trying normal login flow");
        try {
          // Initialize users first
          await initializeUsers();
          
          // Login dengan username/password
          result = await loginUser(username, password);
          console.log("Normal login result:", result);
        } catch (initError) {
          console.error("Login process error:", initError);
          result = { success: false, message: "Terjadi kesalahan saat login" };
        }
      }
      
      // Kembalikan tombol ke keadaan semula
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
        
        if (result.role === 'admin') {
          window.location.href = 'dashboard.html';
        } else {
          window.location.href = 'operator.html';
        }
      } else {
        console.warn("Login failed:", result.message);
        alert(result.message || 'Username atau password salah');
      }
    } catch (error) {
      console.error('Login error:', error);
      alert('Gagal login: Silakan periksa koneksi internet dan coba lagi');
      
      // Pastikan tombol login dikembalikan ke keadaan semula
      const loginButton = document.querySelector('#loginForm button[type="submit"]');
      if (loginButton) {
        loginButton.innerHTML = 'Login';
        loginButton.disabled = false;
      }
    }
  });
