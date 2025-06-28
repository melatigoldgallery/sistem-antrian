import { initializeApp } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-app.js";
import { getDatabase, ref, get } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-database.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-firestore.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.4.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyB6WS177m4mFIIlDE9sSSW21XHkWHQdwdU",
  authDomain: "sistem-antrian-76aa8.firebaseapp.com",
  databaseURL: "https://sistem-antrian-76aa8-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "sistem-antrian-76aa8",
  storageBucket: "sistem-antrian-76aa8.firebasestorage.app",
  messagingSenderId: "545586001781",
  appId: "1:545586001781:web:cae2e84ad9c8d905c7053c",
  measurementId: "G-2SYW19ZQD8",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const rtdb = getDatabase(app);
const auth = getAuth(app);

// Auth service untuk digunakan di seluruh aplikasi
export const authService = {
  // Login dengan Firebase Authentication
  async login(email, password) {
    try {
      console.log(`Attempting Firebase Auth login with email: ${email}`);
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      console.log("Firebase Auth login successful:", user.email);

      // Simpan data user di sessionStorage untuk kompatibilitas dengan kode lama
      sessionStorage.setItem(
        "currentUser",
        JSON.stringify({
          uid: user.uid,
          email: user.email,
          role: user.displayName || "user",
        })
      );

      return {
        success: true,
        user: user,
      };
    } catch (error) {
      console.error("Firebase Auth login error:", error);
      return {
        success: false,
        message: error.message,
      };
    }
  },

  // Logout dari Firebase Authentication
  async logout() {
    try {
      await signOut(auth);
      // Hapus data user dari sessionStorage
      sessionStorage.removeItem("currentUser");
      return { success: true };
    } catch (error) {
      console.error("Logout error:", error);
      return {
        success: false,
        message: error.message,
      };
    }
  },

  // Mendapatkan user saat ini
  getCurrentUser() {
    return new Promise((resolve) => {
      // Cek Firebase Auth state
      const unsubscribe = onAuthStateChanged(auth, (user) => {
        unsubscribe();

        if (user) {
          // User sudah login di Firebase Auth
          console.log("Firebase Auth user found:", user.email);
          resolve(user);
        } else {
          // Cek sessionStorage sebagai fallback untuk kompatibilitas
          const sessionUser = sessionStorage.getItem("currentUser");
          if (sessionUser) {
            console.log("Session user found as fallback");
            resolve(JSON.parse(sessionUser));
          } else {
            console.log("No user found in Firebase Auth or session");
            resolve(null);
          }
        }
      });
    });
  },

  // Mendapatkan token autentikasi untuk Firestore
  async getIdToken() {
    const user = auth.currentUser;
    if (user) {
      return user.getIdToken();
    }
    return null;
  },
};

export default app;
export { db, rtdb, auth };
