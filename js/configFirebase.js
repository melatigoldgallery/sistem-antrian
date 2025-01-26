import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.4.0/firebase-app.js';
import { getDatabase } from 'https://www.gstatic.com/firebasejs/10.4.0/firebase-database.js';

const firebaseConfig = {
    apiKey: "AIzaSyC9iHJOSuNIpsviiv52X4sfyXtYdZ7LWcE",
  authDomain: "sistem-antrian-young.firebaseapp.com",
  databaseURL: "https://sistem-antrian-young-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "sistem-antrian-young",
  storageBucket: "sistem-antrian-young.firebasestorage.app",
  messagingSenderId: "991088221390",
  appId: "1:991088221390:web:cb92ef25e942d547eac49f",
  measurementId: "G-FSBYYXSJXT"
};

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);
console.log('Firebase initialized successfully');
export { database };