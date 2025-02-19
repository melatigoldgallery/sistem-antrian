import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.4.0/firebase-app.js';
import { getDatabase, ref, get, child } from 'https://www.gstatic.com/firebasejs/10.4.0/firebase-database.js';

const firebaseConfig = {
    apiKey: "AIzaSyB6WS177m4mFIIlDE9sSSW21XHkWHQdwdU",
    authDomain: "sistem-antrian-76aa8.firebaseapp.com",
    databaseURL: "https://sistem-antrian-76aa8-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "sistem-antrian-76aa8",
    storageBucket: "sistem-antrian-76aa8.firebasestorage.app",
    messagingSenderId: "545586001781",
    appId: "1:545586001781:web:cae2e84ad9c8d905c7053c",
    measurementId: "G-2SYW19ZQD8"
};

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);
console.log('Firebase initialized successfully');
export { database };

export const authService = {
    async login(username, password) {
      const usersRef = ref(database, 'authorized_users');
      const snapshot = await get(child(usersRef, username));
      
      console.log('Login attempt:', { username }); // Debug log
      console.log('User data found:', snapshot.val()); // Debug log
      
      if (snapshot.exists()) {
        const userData = snapshot.val();
        if (userData.password === password) {
          localStorage.setItem('isAuthenticated', 'true');
          localStorage.setItem('username', username);
          return true;
        }
      }
      throw new Error('Invalid username or password');
    }
  };