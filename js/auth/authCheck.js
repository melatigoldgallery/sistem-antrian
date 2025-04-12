import { authService } from './../configFirebase.js';
export async function checkAuth() {
    try {
        const currentUser = await authService.getCurrentUser();
        if (!currentUser) {
            // Redirect ke halaman login jika tidak ada user yang login
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