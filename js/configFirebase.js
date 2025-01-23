import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getDatabase } from "firebase/database";

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
  
 // Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db = getDatabase(app);

export { db, app };