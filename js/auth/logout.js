import { authService } from '../configFirebase.js';

export async function handleLogout() {
    try {
        // Logout dari Firebase Authentication
        const result = await authService.logout();
        
        if (result.success) {
            // Redirect ke halaman login
            window.location.href = 'index.html';
        } else {
            console.error("Logout failed:", result.message);
            alert("Gagal logout: " + result.message);
        }
    } catch (error) {
        console.error("Logout error:", error);
        alert("Terjadi kesalahan saat logout");
    }
}