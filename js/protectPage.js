// File ini menangani proteksi halaman berdasarkan role
import { authService } from './configFirebase.js';

// Fungsi untuk memeriksa autentikasi
async function checkAuth() {
    try {
        const currentUser = await authService.getCurrentUser();
        if (!currentUser) {
            // Redirect ke halaman login
            window.location.href = 'index.html';
            return false;
        }
        return true;
    } catch (error) {
        console.error("Auth check error:", error);
        window.location.href = 'index.html';
        return false;
    }
}

// Fungsi untuk memeriksa apakah pengguna adalah admin
async function isAdmin() {
    try {
        // Gunakan pendekatan yang lebih langsung dan konsisten
        const sessionUser = JSON.parse(sessionStorage.getItem('currentUser') || '{}');
        
        // Periksa username dan role
        return sessionUser.username === 'adminmelati' || sessionUser.role === 'admin';
    } catch (error) {
        console.error("Error checking admin status:", error);
        return false;
    }
}

// Fungsi untuk melindungi halaman khusus admin
async function protectAdminPage() {
    const isAuthenticated = await checkAuth();
    if (!isAuthenticated) return;
    
    const adminAccess = await isAdmin();
    if (!adminAccess) {
        alert('Anda tidak memiliki akses ke halaman ini');
        window.location.href = 'dashboard.html';
    }
}

// Fungsi untuk melindungi halaman umum (hanya perlu login)
async function protectPage() {
    await checkAuth();
}

export { protectPage, protectAdminPage, isAdmin };
