import { authService } from './configFirebase.js';

document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;

  try {
    await authService.login(username, password);
    window.location.href = 'index.html';
  } catch (error) {
    alert('Login gagal: Username atau password salah');
  }
});
