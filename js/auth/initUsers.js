import { getDatabase, ref, set } from 'https://www.gstatic.com/firebasejs/10.4.0/firebase-database.js';

const authorizedUsers = {
    'admin': {
      password: 'admin123',
      role: 'admin'
    },
    'operator': {
      password: 'operator123',
      role: 'operator'
    }
  };
  
  export async function initializeUsers() {
    const db = getDatabase();
    const usersRef = ref(db, 'authorized_users');
    
    // Write the data
    await set(usersRef, authorizedUsers);
    
    // Verify the data was written
    const snapshot = await get(usersRef);
    console.log('Verified stored users:', snapshot.val());
    
    return snapshot.val();
  }
