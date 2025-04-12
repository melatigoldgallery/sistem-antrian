import { getDatabase, ref, set, get } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-database.js";
import { getAuth, createUserWithEmailAndPassword, updateProfile, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-auth.js";
import app from '../configFirebase.js';
import { authService } from '../configFirebase.js';

const db = getDatabase(app);
const auth = getAuth(app);

// Data pengguna default
const authorizedUsers = {
  'adminmelati': {
    email: 'melatigoldshopid@gmail.com',
    password: 'admin',
    role: 'admin'
  },
  'operator': {
    email: 'operator@melatigold.com',
    password: 'operator123',
    role: 'operator'
  }
};

// Fungsi untuk membuat pengguna di Firebase Authentication
async function createFirebaseAuthUser(email, password, role) {
  try {
    // Buat user di Firebase Auth
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    // Set displayName sebagai role
    await updateProfile(user, {
      displayName: role
    });
    
    console.log(`User ${email} created in Firebase Auth with role ${role}`);
    return true;
  } catch (error) {
    // Jika error karena email sudah digunakan, anggap berhasil
    if (error.code === 'auth/email-already-in-use') {
      console.log(`User ${email} already exists in Firebase Auth`);
      return true;
    }
    console.error(`Error creating user ${email} in Firebase Auth:`, error);
    return false;
  }
}

export async function initializeUsers() {
  try {
    console.log("Initializing users...");
    const db = getDatabase();
    const usersRef = ref(db, 'authorized_users');
    
    // Check if users already exist in Realtime Database
    let snapshot;
    try {
      snapshot = await get(usersRef);
      console.log("Database read result:", snapshot.exists() ? "Users exist" : "No users found");
    } catch (dbError) {
      console.error("Error reading from database:", dbError);
      // Jika tidak bisa membaca dari database, anggap tidak ada data
      snapshot = { exists: () => false };
    }
    
    if (!snapshot.exists()) {
      console.log("Attempting to create users in database...");
      
      try {
        // Coba tulis ke database
        await set(usersRef, authorizedUsers);
        console.log("Users successfully written to database");
      } catch (writeError) {
        console.error("Error writing to database:", writeError);
        
        // Jika tidak bisa menulis ke database, buat user di Firebase Auth saja
        console.log("Creating users in Firebase Auth only...");
        for (const [username, userData] of Object.entries(authorizedUsers)) {
          await createFirebaseAuthUser(userData.email, userData.password, userData.role);
        }
      }
    }
    
    return true;
  } catch (error) {
    console.error("Error in initializeUsers:", error);
    return false;
  }
}

export async function loginUser(username, password) {
  try {
    console.log(`Attempting to login user: ${username}`);
    
    // Cek apakah username ada di daftar hardcoded
    if (authorizedUsers[username]) {
      const userData = authorizedUsers[username];
      console.log(`User ${username} found in hardcoded list, attempting Firebase Auth login`);
      
      try {
        // Login langsung dengan Firebase Auth
        const auth = getAuth();
        await signInWithEmailAndPassword(auth, userData.email, password);
        
        console.log(`User ${username} successfully authenticated`);
        return {
          success: true,
          role: userData.role,
          username: username
        };
      } catch (authError) {
        console.error(`Firebase Auth login failed for ${username}:`, authError);
        return {
          success: false,
          message: 'Username atau password salah'
        };
      }
    }
    
    // Jika tidak ada di hardcoded list, coba cari di database
    try {
      const db = getDatabase();
      const usersRef = ref(db, 'authorized_users');
      const snapshot = await get(usersRef);
      
      if (snapshot.exists()) {
        const users = snapshot.val();
        
        if (users[username] && users[username].password === password) {
          console.log(`User ${username} found in database and password matches`);
          
          // Coba login dengan Firebase Auth juga
          try {
            const auth = getAuth();
            await signInWithEmailAndPassword(auth, users[username].email, password);
          } catch (authError) {
            console.warn(`Firebase Auth login failed but database auth succeeded:`, authError);
            // Lanjutkan meskipun Firebase Auth gagal
          }
          
          return {
            success: true,
            role: users[username].role,
            username: username
          };
        }
      }
    } catch (dbError) {
      console.error("Error reading from database during login:", dbError);
      // Lanjutkan dengan mencoba metode lain
    }
    
    console.log(`Login failed for user ${username}`);
    return {
      success: false,
      message: 'Username atau password salah'
    };
    
  } catch (error) {
    console.error('Login error:', error);
    return {
      success: false,
      message: 'Terjadi kesalahan saat login. Silakan coba lagi.'
    };
  }
}
