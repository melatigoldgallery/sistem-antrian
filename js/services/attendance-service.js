import { db } from "../configFirebase.js";
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
  orderBy,
} from "https://www.gstatic.com/firebasejs/10.4.0/firebase-firestore.js";

// Tambahkan cache untuk kehadiran
export const attendanceCache = new Map();

// Record attendance (check-in)
export async function recordAttendance(attendance) {
  try {
    // Add timestamps
    attendance.timeIn = attendance.timeIn || Timestamp.now();
    attendance.date = attendance.date || new Date().toISOString().split("T")[0]; // YYYY-MM-DD format

    // Convert Date objects to Firestore Timestamps
    if (attendance.timeIn instanceof Date) {
      attendance.timeIn = Timestamp.fromDate(attendance.timeIn);
    }

    const attendanceCollection = collection(db, "attendance");
    const docRef = await addDoc(attendanceCollection, attendance);
    
    // Update cache
    const dateKey = attendance.date;
    if (!attendanceCache.has(dateKey)) {
      attendanceCache.set(dateKey, []);
    }
    
    const cachedAttendance = {
      id: docRef.id,
      ...attendance,
      timeIn: attendance.timeIn instanceof Timestamp ? attendance.timeIn.toDate() : attendance.timeIn
    };
    
    attendanceCache.get(dateKey).push(cachedAttendance);
    
    return cachedAttendance;
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
      timeOut: timeOutTimestamp,
    });
    
    // Update cache
    for (const [dateKey, records] of attendanceCache.entries()) {
      const recordIndex = records.findIndex(record => record.id === id);
      if (recordIndex !== -1) {
        records[recordIndex].timeOut = timeOut;
        break;
      }
    }

    return true;
  } catch (error) {
    console.error("Error updating attendance check-out:", error);
    throw error;
  }
}

// Get today's attendance
export async function getTodayAttendance() {
  try {
    const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD format
    
    // Check if data is in cache
    if (attendanceCache.has(today)) {
      console.log("Using cached attendance data for today");
      return attendanceCache.get(today);
    }
    
    const attendanceCollection = collection(db, "attendance");
    const q = query(attendanceCollection, where("date", "==", today), orderBy("timeIn", "desc"));

    const snapshot = await getDocs(q);
    const attendanceData = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      // Convert Firestore Timestamp to JS Date
      timeIn: doc.data().timeIn.toDate(),
      timeOut: doc.data().timeOut ? doc.data().timeOut.toDate() : null,
    }));
    
    // Store in cache
    attendanceCache.set(today, attendanceData);
    
    return attendanceData;
  } catch (error) {
    console.error("Error getting today's attendance:", error);
    throw error;
  }
}

// Get attendance by date range
export async function getAttendanceByDateRange(startDate, endDate) {
  try {
    // Check if all dates in range are in cache
    const allDatesInCache = checkAllDatesInCache(startDate, endDate);
    
    if (allDatesInCache) {
      console.log("Using cached attendance data for date range");
      return getCachedAttendanceByDateRange(startDate, endDate);
    }
    
    const attendanceCollection = collection(db, "attendance");
    const q = query(
      attendanceCollection,
      where("date", ">=", startDate),
      where("date", "<=", endDate),
      orderBy("date", "desc"),
      orderBy("timeIn", "desc")
    );

    const snapshot = await getDocs(q);
    const attendanceData = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      // Convert Firestore Timestamp to JS Date
      timeIn: doc.data().timeIn.toDate(),
      timeOut: doc.data().timeOut ? doc.data().timeOut.toDate() : null,
    }));
    
    // Update cache for each date
    attendanceData.forEach(record => {
      const dateKey = record.date;
      if (!attendanceCache.has(dateKey)) {
        attendanceCache.set(dateKey, []);
      }
      
      // Check if record already exists in cache
      const existingIndex = attendanceCache.get(dateKey).findIndex(item => item.id === record.id);
      if (existingIndex === -1) {
        attendanceCache.get(dateKey).push(record);
      } else {
        attendanceCache.get(dateKey)[existingIndex] = record;
      }
    });
    
    return attendanceData;
  } catch (error) {
    console.error("Error getting attendance by date range:", error);
    throw error;
  }
}

// Helper function to check if all dates in range are in cache
function checkAllDatesInCache(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
    const dateKey = date.toISOString().split('T')[0];
    if (!attendanceCache.has(dateKey)) {
      return false;
    }
  }
  
  return true;
}

// Helper function to get attendance from cache by date range
function getCachedAttendanceByDateRange(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  let result = [];
  
  for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
    const dateKey = date.toISOString().split('T')[0];
    if (attendanceCache.has(dateKey)) {
      result = result.concat(attendanceCache.get(dateKey));
    }
  }
  
  // Sort by date and time
  result.sort((a, b) => {
    if (a.date !== b.date) {
      return new Date(b.date) - new Date(a.date); // Descending date
    }
    return b.timeIn - a.timeIn; // Descending time
  });
  
  return result;
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
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      // Convert Firestore Timestamp to JS Date
      timeIn: doc.data().timeIn.toDate(),
      timeOut: doc.data().timeOut ? doc.data().timeOut.toDate() : null,
    }));
  } catch (error) {
    console.error("Error getting attendance by employee:", error);
    throw error;
  }
}

// Get single attendance record
export async function getAttendanceById(id) {
  try {
    // Check if record exists in cache
    for (const records of attendanceCache.values()) {
      const cachedRecord = records.find(record => record.id === id);
      if (cachedRecord) {
        console.log("Using cached attendance record");
        return cachedRecord;
      }
    }
    
    const attendanceRef = doc(db, "attendance", id);
    const docSnap = await getDoc(attendanceRef);

    if (docSnap.exists()) {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        ...data,
        // Convert Firestore Timestamp to JS Date
        timeIn: data.timeIn.toDate(),
        timeOut: data.timeOut ? data.timeOut.toDate() : null,
      };
    } else {
      throw new Error("Attendance record not found");
    }
  } catch (error) {
    console.error("Error getting attendance by ID:", error);
    throw error;
  }
}
