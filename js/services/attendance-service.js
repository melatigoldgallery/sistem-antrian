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
// Tambahkan fungsi untuk koordinasi cache dengan report-service
export function syncCacheWithReport(dateKey, data) {
  try {
    // Jika data sudah ada di cache, gabungkan dengan data baru
    if (attendanceCache.has(dateKey)) {
      const existingData = attendanceCache.get(dateKey);
      
      // Gabungkan data, hindari duplikasi berdasarkan ID
      const mergedData = [...existingData];
      
      data.forEach(newItem => {
        const existingIndex = mergedData.findIndex(item => item.id === newItem.id);
        if (existingIndex === -1) {
          // Item baru, tambahkan ke array
          mergedData.push(newItem);
        } else {
          // Item sudah ada, update jika lebih baru
          const existingItem = mergedData[existingIndex];
          
          // Jika item baru memiliki timeOut yang tidak null, update
          if (newItem.timeOut && (!existingItem.timeOut || newItem.timeOut > existingItem.timeOut)) {
            mergedData[existingIndex] = { ...existingItem, ...newItem };
          }
        }
      });
      
      // Update cache dengan data gabungan
      attendanceCache.set(dateKey, mergedData);
    } else {
      // Jika belum ada di cache, tambahkan langsung
      attendanceCache.set(dateKey, data);
    }
    
    // Update timestamp cache
    updateCacheTimestamp(dateKey);
    
    // Simpan ke localStorage
    saveAttendanceCacheToStorage();
    
    return true;
  } catch (error) {
    console.error("Error syncing cache with report:", error);
    return false;
  }
}

// Tambahkan fungsi untuk validasi integritas data cache
export function validateCacheIntegrity() {
  try {
    let invalidEntries = 0;
    
    // Periksa setiap entri di cache
    for (const [key, data] of attendanceCache.entries()) {
      // Validasi bahwa data adalah array
      if (!Array.isArray(data)) {
        console.warn(`Invalid cache entry for ${key}: not an array`);
        attendanceCache.delete(key);
        cacheMeta.delete(key);
        invalidEntries++;
        continue;
      }
      
      // Validasi bahwa setiap item memiliki properti yang diperlukan
      const invalidItems = data.filter(item => 
        !item.id || !item.date || !item.timeIn
      );
      
      if (invalidItems.length > 0) {
        console.warn(`Found ${invalidItems.length} invalid items in cache for ${key}`);
        // Filter out invalid items
        attendanceCache.set(key, data.filter(item => 
          item.id && item.date && item.timeIn
        ));
        invalidEntries++;
      }
    }
    
    if (invalidEntries > 0) {
      console.log(`Cleaned up ${invalidEntries} invalid cache entries`);
      saveAttendanceCacheToStorage();
    }
    
    return invalidEntries === 0;
  } catch (error) {
    console.error("Error validating cache integrity:", error);
    return false;
  }
}

// Tambahkan event listener untuk validasi cache saat halaman dimuat
document.addEventListener('DOMContentLoaded', function() {
  // Validasi integritas cache
  validateCacheIntegrity();
  
  // Bersihkan cache lama
  cleanupOldCache();
  
  // Batasi ukuran cache
  limitCacheSize();
});

// Tambahkan cache untuk kehadiran dengan timestamp
export const attendanceCache = new Map();
export const cacheMeta = new Map(); // Untuk menyimpan metadata cache (timestamp)

export function getLocalDateString() {
  // Gunakan tanggal lokal Indonesia
  const now = new Date();
   
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  
  const formattedDate = `${year}-${month}-${day}`;
  
  return formattedDate;
}
// Modifikasi saveAttendanceCacheToStorage
export function saveAttendanceCacheToStorage() {
  try {
    // Konversi Map ke objek untuk localStorage
    const cacheObj = {};
    for (const [key, value] of attendanceCache.entries()) {
      cacheObj[key] = value;
    }
    
    const metaObj = {};
    for (const [key, value] of cacheMeta.entries()) {
      metaObj[key] = value;
    }
    
    // Kompresi data sebelum disimpan
    localStorage.setItem('attendanceCache', compressData(cacheObj));
    localStorage.setItem('attendanceCacheMeta', compressData(metaObj));
  } catch (error) {
    console.error("Error saving cache to localStorage:", error);
  }
}

// Modifikasi loadAttendanceCacheFromStorage
export function loadAttendanceCacheFromStorage() {
  try {
    const compressedCache = localStorage.getItem('attendanceCache');
    const compressedMeta = localStorage.getItem('attendanceCacheMeta');
    
    if (compressedCache && compressedMeta) {
      // Dekompresi data
      const cacheObj = decompressData(compressedCache);
      const metaObj = decompressData(compressedMeta);
      
      if (!cacheObj || !metaObj) {
        console.error("Failed to decompress cache data");
        return;
      }
      
      // Konversi objek kembali ke Map
      attendanceCache.clear();
      cacheMeta.clear();
      
      for (const [key, value] of Object.entries(cacheObj)) {
        attendanceCache.set(key, value);
      }
      
      for (const [key, value] of Object.entries(metaObj)) {
        cacheMeta.set(key, value);
      }
      
      console.log("Attendance cache loaded from localStorage (decompressed)");
    }
  } catch (error) {
    console.error("Error loading cache from localStorage:", error);
  }
}

// Fungsi untuk mengompresi data sebelum disimpan ke localStorage
function compressData(data) {
  try {
    // Konversi data ke string JSON
    const jsonString = JSON.stringify(data);
    
    // Kompresi sederhana dengan menghapus spasi berlebih
    return jsonString.replace(/\s+/g, '');
  } catch (error) {
    console.error("Error compressing data:", error);
    return JSON.stringify(data);
  }
}

// Fungsi untuk mendekompresi data dari localStorage
function decompressData(compressedData) {
  try {
    // Parse string JSON yang telah dikompresi
    return JSON.parse(compressedData);
  } catch (error) {
    console.error("Error decompressing data:", error);
    return null;
  }
}
// Tambahkan fungsi untuk membersihkan cache lama
export function cleanupOldCache() {
  const now = Date.now();
  const oneDay = 24 * 60 * 60 * 1000; // 24 jam dalam milidetik

  // Hapus cache yang lebih dari 7 hari
  for (const [key, timestamp] of cacheMeta.entries()) {
    if (now - timestamp > 7 * oneDay) {
      attendanceCache.delete(key);
      cacheMeta.delete(key);
      console.log(`Removed old cache for ${key}`);
    }
  }
 // Simpan perubahan ke localStorage
 saveAttendanceCacheToStorage();
} 
// Fungsi untuk membatasi ukuran cache
export function limitCacheSize(maxEntries = 50) {
  // Jika ukuran cache melebihi batas, hapus entri tertua
  if (attendanceCache.size > maxEntries) {
    // Dapatkan entri tertua berdasarkan timestamp
    let oldestKey = null;
    let oldestTimestamp = Date.now();
    
    for (const [key, timestamp] of cacheMeta.entries()) {
      if (timestamp < oldestTimestamp) {
        oldestTimestamp = timestamp;
        oldestKey = key;
      }
    }
    
    // Hapus entri tertua
    if (oldestKey) {
      attendanceCache.delete(oldestKey);
      cacheMeta.delete(oldestKey);
      console.log(`Removed oldest cache entry: ${oldestKey}`);
    }
    
    // Simpan perubahan ke localStorage
    saveAttendanceCacheToStorage();
  }
}
// Modifikasi updateCacheTimestamp untuk menyimpan ke localStorage
export function updateCacheTimestamp(cacheKey) {
  cacheMeta.set(cacheKey, Date.now());
  saveAttendanceCacheToStorage();
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


// Fungsi untuk memeriksa apakah cache perlu diperbarui (lebih dari 1 jam)
export function shouldUpdateCache(cacheKey) {
  if (!cacheMeta.has(cacheKey)) return true;
  
  const lastUpdate = cacheMeta.get(cacheKey);
  const now = Date.now();
  const oneHour = 60 * 60 * 1000; // 1 jam dalam milidetik
  
  return (now - lastUpdate) > oneHour;
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
    
    const attendanceData = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        // Convert Firestore Timestamp to JS Date
        timeIn: data.timeIn ? data.timeIn.toDate() : null,
        timeOut: data.timeOut ? data.timeOut.toDate() : null,
      };
    });
    
    
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
