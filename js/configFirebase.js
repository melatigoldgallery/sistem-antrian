import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.4.0/firebase-app.js';
import { getDatabase, ref, get } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-database.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-storage.js";
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
const db = getFirestore(app);
console.log('Firebase initialized successfully');
export { db, database };
export default app;
export const storage = getStorage(app);

export const authService = {
    getCurrentUser: async () => {
        const user = sessionStorage.getItem('currentUser');
        return user ? JSON.parse(user) : null;
    },
    
    setCurrentUser: (user) => {
        sessionStorage.setItem('currentUser', JSON.stringify(user));
    },
    
    logout: () => {
        sessionStorage.removeItem('currentUser');
    }
};
