import { db } from './configFirebase.js';
import { 
  collection, 
  addDoc, 
  getDocs, 
  doc,
  getDoc,
  updateDoc,
  query, 
  where, 
  Timestamp,
  orderBy
} from "https://www.gstatic.com/firebasejs/10.4.0/firebase-firestore.js";

// Record attendance (check-in)
export async function recordAttendance(attendance) {
  try {
    // Add timestamps
    attendance.timeIn = attendance.timeIn || Timestamp.now();
    attendance.date = attendance.date || new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    
    // Convert Date objects to Firestore Timestamps
    if (attendance.timeIn instanceof Date) {
      attendance.timeIn = Timestamp.fromDate(attendance.timeIn);
    }
    
    const attendanceCollection = collection(db, "attendance");
    const docRef = await addDoc(attendanceCollection, attendance);
    return { id: docRef.id, ...attendance };
  } catch (error) {
    console.error("Error recording attendance:", error);
    throw error;
  }
}

// Update attendance with check-out time
export async function updateAttendanceOut(id, timeOut) {
  try {
    const attendanceRef = doc(db, "attendance", id);
    
    // Convert Date to Firestore Timestamp
    const timeOutTimestamp = timeOut instanceof Date ? Timestamp.fromDate(timeOut) : Timestamp.now();
    
    await updateDoc(attendanceRef, {
      timeOut: timeOutTimestamp
    });
    
    return true;
  } catch (error) {
    console.error("Error updating attendance check-out:", error);
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
      timeIn: doc.data().timeIn.toDate(),
      timeOut: doc.data().timeOut ? doc.data().timeOut.toDate() : null
    }));
  } catch (error) {
    console.error("Error getting today's attendance:", error);
    throw error;
  }
}

// Get attendance by date range
export async function getAttendanceByDateRange(startDate, endDate) {
  try {
    const attendanceCollection = collection(db, "attendance");
    const q = query(
      attendanceCollection,
      where("date", ">=", startDate),
      where("date", "<=", endDate),
      orderBy("date", "desc"),
      orderBy("timeIn", "desc")
    );
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      // Convert Firestore Timestamp to JS Date
      timeIn: doc.data().timeIn.toDate(),
      timeOut: doc.data().timeOut ? doc.data().timeOut.toDate() : null
    }));
  } catch (error) {
    console.error("Error getting attendance by date range:", error);
    throw error;
  }
}

// Get attendance by employee
export async function getAttendanceByEmployee(employeeId) {
  try {
    const attendanceCollection = collection(db, "attendance");
    const q = query(
      attendanceCollection,
      where("employeeId", "==", employeeId),
      orderBy("date", "desc"),
      orderBy("timeIn", "desc")
    );
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      // Convert Firestore Timestamp to JS Date
      timeIn: doc.data().timeIn.toDate(),
      timeOut: doc.data().timeOut ? doc.data().timeOut.toDate() : null
    }));
  } catch (error) {
    console.error("Error getting attendance by employee:", error);
    throw error;
  }
}

// Get single attendance record
export async function getAttendanceById(id) {
  try {
    const attendanceRef = doc(db, "attendance", id);
    const docSnap = await getDoc(attendanceRef);
    
    if (docSnap.exists()) {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        ...data,
        // Convert Firestore Timestamp to JS Date
        timeIn: data.timeIn.toDate(),
        timeOut: data.timeOut ? data.timeOut.toDate() : null
      };
    } else {
      throw new Error("Attendance record not found");
    }
  } catch (error) {
    console.error("Error getting attendance by ID:", error);
    throw error;
  }
}
