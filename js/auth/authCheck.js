import { authService } from './../configFirebase.js';

export async function checkAuth() {
  const user = await authService.getCurrentUser();
  if (!user) {
    window.location.href = 'index.html';
    return false;
  }
  return true;
}
