import { db } from './configFirebase.js';
import { 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  where, 
  Timestamp,
  orderBy
} from "https://www.gstatic.com/firebasejs/10.4.0/firebase-firestore.js";

// Record attendance
export async function recordAttendance(attendance) {
  try {
    // Add timestamp
    attendance.timeIn = Timestamp.now();
    attendance.date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    
    const attendanceCollection = collection(db, "attendance");
    const docRef = await addDoc(attendanceCollection, attendance);
    return { id: docRef.id, ...attendance };
  } catch (error) {
    console.error("Error recording attendance:", error);
    throw error;
  }
}

// Get today's attendance
export async function getTodayAttendance() {
  try {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    const attendanceCollection = collection(db, "attendance");
    const q = query(
      attendanceCollection, 
      where("date", "==", today),
      orderBy("timeIn", "desc")
    );
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      // Convert Firestore Timestamp to JS Date
      timeIn: doc.data().timeIn.toDate()
    }));
  } catch (error) {
    console.error("Error getting today's attendance:", error);
    throw error;
  }
}
