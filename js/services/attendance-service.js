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

// Tambahkan cache untuk kehadiran dengan timestamp
export const attendanceCache = new Map();
export const cacheMeta = new Map(); // Untuk menyimpan metadata cache (timestamp)

export function getLocalDateString() {
  // Gunakan tanggal lokal Indonesia
  const now = new Date();
  
  // Tambahkan logging untuk debugging
  console.log("Raw Date:", now);
  console.log("Timezone Offset:", now.getTimezoneOffset());
  
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  
  const formattedDate = `${year}-${month}-${day}`;
  console.log("Formatted local date:", formattedDate);
  
  return formattedDate;
}



// Fungsi untuk memeriksa apakah cache perlu diperbarui (lebih dari 1 jam)
export function shouldUpdateCache(cacheKey) {
  if (!cacheMeta.has(cacheKey)) return true;
  
  const lastUpdate = cacheMeta.get(cacheKey);
  const now = Date.now();
  const oneHour = 60 * 60 * 1000; // 1 jam dalam milidetik
  
  return (now - lastUpdate) > oneHour;
}

// Fungsi untuk memperbarui timestamp cache
export function updateCacheTimestamp(cacheKey) {
  cacheMeta.set(cacheKey, Date.now());
}

export async function recordAttendance(attendance) {
  try {
    // Add timestamps
    attendance.timeIn = attendance.timeIn || Timestamp.now();
    
    // PERBAIKAN: Gunakan tanggal dari timeIn untuk konsistensi
    if (!attendance.date) {
      const timeInDate = attendance.timeIn instanceof Timestamp 
        ? attendance.timeIn.toDate() 
        : attendance.timeIn;
      
      const year = timeInDate.getFullYear();
      const month = String(timeInDate.getMonth() + 1).padStart(2, '0');
      const day = String(timeInDate.getDate()).padStart(2, '0');
      
      attendance.date = `${year}-${month}-${day}`;
      console.log("Setting attendance date from timeIn:", attendance.date);
    }

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
    updateCacheTimestamp(dateKey); // Perbarui timestamp cache
    
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
        records[recordIndex].timeOut = timeOut instanceof Date ? timeOut : new Date();
        updateCacheTimestamp(dateKey); // Perbarui timestamp cache
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
    // Gunakan tanggal lokal untuk konsistensi
    const today = getLocalDateString();
    
    // Check if data is in cache and still valid
    if (attendanceCache.has(today) && !shouldUpdateCache(today)) {
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
    
    // Store in cache with timestamp
    attendanceCache.set(today, attendanceData);
    updateCacheTimestamp(today);
    
    return attendanceData;
  } catch (error) {
    console.error("Error getting today's attendance:", error);
    throw error;
  }
}

// Get attendance by date range
export async function getAttendanceByDateRange(startDate, endDate) {
  try {
    const cacheKey = `${startDate}_${endDate}`;
    
    // Check if all dates in range are in cache and still valid
    const allDatesInCache = checkAllDatesInCache(startDate, endDate);
    
    if (allDatesInCache && !shouldUpdateCache(cacheKey)) {
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
        updateCacheTimestamp(dateKey);
      }
      
      // Check if record already exists in cache
      const existingIndex = attendanceCache.get(dateKey).findIndex(item => item.id === record.id);
      if (existingIndex === -1) {
        attendanceCache.get(dateKey).push(record);
      } else {
        attendanceCache.get(dateKey)[existingIndex] = record;
      }
    });
    
    // Update timestamp for the date range
    updateCacheTimestamp(cacheKey);
    
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
  const cacheKey = `${startDate}_${endDate}`;
  
  // If we have the combined cache key and it's still valid, use it
  if (cacheMeta.has(cacheKey) && !shouldUpdateCache(cacheKey)) {
    return true;
  }
  
  // Otherwise check each date
  for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
    // Konversi ke format YYYY-MM-DD dengan zona waktu lokal
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateKey = `${year}-${month}-${day}`;
    
    if (!attendanceCache.has(dateKey) || shouldUpdateCache(dateKey)) {
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
  
  console.log("Getting cached attendance from", startDate, "to", endDate);
  
  for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
    // Konversi ke format YYYY-MM-DD dengan zona waktu lokal
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateKey = `${year}-${month}-${day}`;
    
    console.log("Checking cache for date:", dateKey);
    
    if (attendanceCache.has(dateKey)) {
      const cachedData = attendanceCache.get(dateKey);
      console.log(`Found ${cachedData.length} records for ${dateKey}`);
      result = result.concat(cachedData);
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
    const cacheKey = `employee_${employeeId}`;
    
    // Check if employee data is in cache and still valid
    if (cacheMeta.has(cacheKey) && !shouldUpdateCache(cacheKey)) {
      console.log("Using cached attendance data for employee");
      return JSON.parse(localStorage.getItem(cacheKey) || "[]");
    }
    
    const attendanceCollection = collection(db, "attendance");
    const q = query(
      attendanceCollection,
      where("employeeId", "==", employeeId),
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
    
    // Store in localStorage for larger datasets
    localStorage.setItem(cacheKey, JSON.stringify(attendanceData));
    updateCacheTimestamp(cacheKey);
    
    return attendanceData;
  } catch (error) {
    console.error("Error getting attendance by employee:", error);
    throw error;
  }
}

// Get single attendance record
export async function getAttendanceById(id) {
  try {
    const cacheKey = `record_${id}`;
    
    // Check if record is in cache and still valid
    if (cacheMeta.has(cacheKey) && !shouldUpdateCache(cacheKey)) {
      console.log("Using cached attendance record");
      return JSON.parse(localStorage.getItem(cacheKey) || "null");
    }
    
    // Check if record exists in date cache
    for (const [dateKey, records] of attendanceCache.entries()) {
      if (!shouldUpdateCache(dateKey)) {
        const cachedRecord = records.find(record => record.id === id);
        if (cachedRecord) {
          console.log("Using cached attendance record from date cache");
          return cachedRecord;
        }
      }
    }
    
    const attendanceRef = doc(db, "attendance", id);
    const docSnap = await getDoc(attendanceRef);

    if (docSnap.exists()) {
      const data = docSnap.data();
      const record = {
        id: docSnap.id,
        ...data,
        // Convert Firestore Timestamp to JS Date
        timeIn: data.timeIn.toDate(),
        timeOut: data.timeOut ? data.timeOut.toDate() : null,
      };
      
      // Store in localStorage
      localStorage.setItem(cacheKey, JSON.stringify(record));
      updateCacheTimestamp(cacheKey);
      
      return record;
    } else {
      throw new Error("Attendance record not found");
    }
  } catch (error) {
    console.error("Error getting attendance by ID:", error);
    throw error;
  }
}
