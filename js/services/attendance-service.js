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

// Tambahkan konstanta untuk TTL cache
const CACHE_TTL_STANDARD = 60 * 60 * 1000; // 1 jam
const CACHE_TTL_TODAY = 5 * 60 * 1000;     // 5 menit untuk data hari ini

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

// Tambahkan fungsi untuk notifikasi scan baru
export function notifyNewAttendanceScan(date) {
  try {
    // Simpan timestamp scan terakhir
    localStorage.setItem("lastAttendanceScanTime", Date.now().toString());
    
    // Simpan tanggal scan terakhir
    if (date) {
      localStorage.setItem("lastAttendanceScanDate", typeof date === 'string' ? date : getLocalDateString());
    }
    
    // Broadcast event untuk komponen lain yang mungkin perlu tahu
    const event = new CustomEvent('attendanceScanUpdated', { 
      detail: { 
        timestamp: Date.now(),
        date: date || getLocalDateString()
      } 
    });
    window.dispatchEvent(event);
    
    return true;
  } catch (error) {
    console.error("Error notifying new attendance scan:", error);
    return false;
  }
}

// Tambahkan fungsi untuk memeriksa apakah ada scan baru sejak timestamp tertentu
export function hasNewAttendanceSince(timestamp) {
  try {
    const lastScanTime = localStorage.getItem("lastAttendanceScanTime");
    if (!lastScanTime) return false;
    
    return parseInt(lastScanTime) > timestamp;
  } catch (error) {
    console.error("Error checking for new attendance:", error);
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

// Fungsi untuk menyimpan cache ke localStorage dengan kompresi
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
    const compressedCache = compressData(cacheObj);
    const compressedMeta = compressData(metaObj);
    
    // Simpan data terkompresi ke localStorage
    localStorage.setItem("attendanceCache", compressedCache);
    localStorage.setItem("attendanceCacheMeta", compressedMeta);
    
    // Simpan timestamp terakhir update
    localStorage.setItem("attendanceCacheLastSaved", Date.now().toString());
    
    console.log("Attendance cache saved to localStorage with compression");
  } catch (error) {
    console.error("Error saving attendance cache to localStorage:", error);
    
    // Fallback: simpan tanpa kompresi jika terjadi error
    try {
      localStorage.setItem("attendanceCache", JSON.stringify(Object.fromEntries(attendanceCache)));
      localStorage.setItem("attendanceCacheMeta", JSON.stringify(Object.fromEntries(cacheMeta)));
      console.log("Attendance cache saved to localStorage without compression");
    } catch (fallbackError) {
      console.error("Failed to save cache even without compression:", fallbackError);
    }
  }
}

// Fungsi untuk memuat cache dari localStorage dengan dekompresi
export function loadAttendanceCacheFromStorage() {
  try {
    const compressedCache = localStorage.getItem("attendanceCache");
    const compressedMeta = localStorage.getItem("attendanceCacheMeta");
    
    if (compressedCache && compressedMeta) {
      // Dekompresi data
      const cacheObj = decompressData(compressedCache);
      const metaObj = decompressData(compressedMeta);
      
      if (cacheObj && metaObj) {
        // Reset cache sebelum memuat data baru
        attendanceCache.clear();
        cacheMeta.clear();
        
        // Muat data ke Map
        for (const [key, value] of Object.entries(cacheObj)) {
          attendanceCache.set(key, value);
        }
        
        for (const [key, value] of Object.entries(metaObj)) {
          cacheMeta.set(key, value);
        }
        
        console.log("Attendance cache loaded from localStorage with decompression");
        return true;
      }
    }
    return false;
  } catch (error) {
    console.error("Error loading attendance cache from localStorage:", error);
    return false;
  }
}

// Fungsi untuk mengompresi data sebelum disimpan ke localStorage
function compressData(data) {
  try {
    // Konversi data ke string JSON
    const jsonString = JSON.stringify(data);
    
    // Gunakan algoritma kompresi sederhana: LZW-like
    let compressed = '';
    let dictionary = {};
    let phrase = '';
    let code = 256;
    
    // Inisialisasi dictionary dengan karakter ASCII
    for (let i = 0; i < 256; i++) {
      dictionary[String.fromCharCode(i)] = i;
    }
    
    for (let i = 0; i < jsonString.length; i++) {
      const char = jsonString.charAt(i);
      const phraseChar = phrase + char;
      
      if (dictionary[phraseChar] !== undefined) {
        phrase = phraseChar;
      } else {
        compressed += String.fromCharCode(dictionary[phrase]);
        dictionary[phraseChar] = code++;
        phrase = char;
      }
    }
    
    // Output the last phrase
    if (phrase !== '') {
      compressed += String.fromCharCode(dictionary[phrase]);
    }
    
    return compressed;
  } catch (error) {
    console.error("Error compressing data:", error);
    // Fallback to simple compression if advanced compression fails
    return JSON.stringify(data).replace(/\s+/g, "");
  }
}

// Fungsi untuk mendekompresi data dari localStorage
function decompressData(compressedData) {
  try {
    // Cek apakah data menggunakan kompresi lanjutan atau sederhana
    if (compressedData.startsWith('{') || compressedData.startsWith('[')) {
      // Data menggunakan kompresi sederhana atau tidak dikompresi
      return JSON.parse(compressedData);
    }
    
    // Dekompresi untuk algoritma LZW-like
    let dictionary = {};
    let phrase = compressedData.charAt(0);
    let result = phrase;
    let code = 256;
    let currChar = '';
    
    // Inisialisasi dictionary dengan karakter ASCII
    for (let i = 0; i < 256; i++) {
      dictionary[i] = String.fromCharCode(i);
    }
    
    for (let i = 1; i < compressedData.length; i++) {
      const currCode = compressedData.charCodeAt(i);
      
      if (currCode < 256) {
        currChar = String.fromCharCode(currCode);
      } else if (dictionary[currCode] !== undefined) {
        currChar = dictionary[currCode];
      } else {
        currChar = phrase + phrase.charAt(0);
      }
      
      result += currChar;
      dictionary[code++] = phrase + currChar.charAt(0);
      phrase = currChar;
    }
    
    // Parse the decompressed JSON string
    return JSON.parse(result);
  } catch (error) {
    console.error("Error decompressing data:", error);
    
    // Fallback: try to parse as regular JSON
    try {
      return JSON.parse(compressedData);
    } catch (parseError) {
      console.error("Failed to parse decompressed data:", parseError);
      return null;
    }
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

// Tambahkan fungsi untuk menghapus cache berdasarkan tanggal
export function clearCacheForDate(dateStr) {
  try {
    // Hapus cache harian
    if (attendanceCache.has(dateStr)) {
      attendanceCache.delete(dateStr);
      if (cacheMeta.has(dateStr)) {
        cacheMeta.delete(dateStr);
      }
    }
    
    // Hapus cache rentang tanggal yang mencakup tanggal ini
    for (const [key, value] of attendanceCache.entries()) {
      if (key.includes('_') && key.includes(dateStr)) {
        attendanceCache.delete(key);
        if (cacheMeta.has(key)) {
          cacheMeta.delete(key);
        }
      }
    }
    
    // Simpan perubahan ke localStorage
    saveAttendanceCacheToStorage();
    
    return true;
  } catch (error) {
    console.error("Error clearing cache for date:", error);
    return false;
  }
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
    
    // PERBAIKAN: Hapus semua cache laporan yang mungkin mencakup tanggal ini
    clearCacheForDate(dateKey);
    
    // PERBAIKAN: Tandai bahwa ada scan baru
    localStorage.setItem("lastAttendanceScanTime", Date.now().toString());
    localStorage.setItem("lastAttendanceScanDate", dateKey);
    
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
  
  // Jika cache key adalah tanggal hari ini, gunakan TTL yang lebih pendek
  const today = getLocalDateString();
  if (cacheKey === today || cacheKey.includes(today)) {
    return (now - lastUpdate) > CACHE_TTL_TODAY;
  }
  
  // Untuk data lain, gunakan TTL standar
  return (now - lastUpdate) > CACHE_TTL_STANDARD;
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
    let updatedDateKey = null;
    
    for (const [dateKey, records] of attendanceCache.entries()) {
      const recordIndex = records.findIndex(record => record.id === id);
      if (recordIndex !== -1) {
        records[recordIndex].timeOut = timeOut instanceof Date ? timeOut : new Date();
        updateCacheTimestamp(dateKey); // Perbarui timestamp cache
        updatedDateKey = dateKey;
        break;
      }
    }

    // PERBAIKAN: Hapus semua cache laporan yang mungkin mencakup tanggal ini
    if (updatedDateKey) {
      clearCacheForDate(updatedDateKey);
      
      // PERBAIKAN: Tandai bahwa ada scan baru
      localStorage.setItem("lastAttendanceScanTime", Date.now().toString());
      localStorage.setItem("lastAttendanceScanDate", updatedDateKey);
    }

    return true;
  } catch (error) {
    console.error("Error updating attendance check-out:", error);
    throw error;
  }
}

// Modifikasi getTodayAttendance untuk mencegah duplikasi
export async function getTodayAttendance() {
  try {
    const today = getLocalDateString();
    
    // Cek apakah data sudah ada di cache dan masih valid
    if (attendanceCache.has(today) && !shouldUpdateCache(today)) {
      console.log("Using cached attendance data for today");
      return attendanceCache.get(today);
    }
    
    console.log("Fetching today's attendance from Firestore");
    
    // Query Firestore untuk data hari ini
    const attendanceCollection = collection(db, "attendance");
    const q = query(
      attendanceCollection, 
      where("date", "==", today), 
      orderBy("timeIn", "desc")
    );
    
    const snapshot = await getDocs(q);
    
    // Konversi snapshot ke array dengan pencegahan duplikasi
    const records = [];
    const employeeIds = new Set(); // Untuk mencegah duplikasi
    
    snapshot.forEach(doc => {
      const data = doc.data();
      const record = {
        id: doc.id,
        ...data,
        // Convert Firestore Timestamp to JS Date
        timeIn: data.timeIn ? data.timeIn.toDate() : null,
        timeOut: data.timeOut ? data.timeOut.toDate() : null,
      };
      
      // Cek duplikasi berdasarkan employeeId
      if (!employeeIds.has(data.employeeId)) {
        employeeIds.add(data.employeeId);
        records.push(record);
      } else {
        console.warn(`Duplicate attendance record found for employee ${data.employeeId} on ${today}`);
      }
    });
    
    // Store in cache with timestamp
    attendanceCache.set(today, records);
    updateCacheTimestamp(today);
    saveAttendanceCacheToStorage();
    
    return records;
  } catch (error) {
    console.error("Error getting today's attendance:", error);
    
    // Fallback to cache if available
    if (attendanceCache.has(today)) {
      console.log("Using cached data as fallback due to error");
      return attendanceCache.get(today);
    }
    
    throw error;
  }
}

/**
 * Mendapatkan data kehadiran berdasarkan rentang tanggal dengan optimasi cache dan batching
 * @param {string} startDate - Tanggal awal dalam format YYYY-MM-DD
 * @param {string} endDate - Tanggal akhir dalam format YYYY-MM-DD
 * @param {number} page - Halaman untuk pagination
 * @param {number} limit - Jumlah data per halaman
 * @param {string|null} shift - Filter berdasarkan shift (morning/afternoon/all/null)
 * @returns {Promise<Object>} - Object berisi data kehadiran dan info pagination
 */
export async function getAttendanceByDateRange(startDate, endDate, page = 1, limit = 100, shift = null) {
  try {
    // Buat cache key berdasarkan parameter
    const cacheKey = shift ? `range_${startDate}_${endDate}_${shift}` : `range_${startDate}_${endDate}`;
    
    // Cek apakah rentang tanggal mencakup hari ini
    const today = getLocalDateString();
    const includesCurrentDay = (startDate <= today && today <= endDate);
    
    // Cek apakah rentang tanggal terlalu besar (lebih dari 30 hari)
    const daysDiff = calculateDateDifference(startDate, endDate);
    const isLargeRange = daysDiff > 30;
    
    // Jika tidak mencakup hari ini, tidak terlalu besar, dan cache masih valid, gunakan cache
    if (!includesCurrentDay && !isLargeRange && cacheMeta.has(cacheKey) && !shouldUpdateCache(cacheKey)) {
      console.log(`Using cached attendance data for range ${startDate} to ${endDate}`);
      
      // Ambil data dari cache dan terapkan pagination di memory
      const cachedData = getCachedAttendanceByDateRange(startDate, endDate, shift);
      const startIndex = (page - 1) * limit;
      const paginatedData = cachedData.slice(startIndex, startIndex + limit);
      
      return {
        attendanceRecords: paginatedData,
        totalPages: Math.ceil(cachedData.length / limit),
        currentPage: page,
        totalRecords: cachedData.length,
        fromCache: true
      };
    }
    
    // Jika rentang tanggal terlalu besar, gunakan batching
    if (isLargeRange) {
      console.log(`Large date range detected (${daysDiff} days), using batch operations`);
      return await getAttendanceByDateRangeBatched(startDate, endDate, page, limit, shift);
    }
    
    console.log(`Fetching attendance data for range ${startDate} to ${endDate}, limit: ${limit}, page: ${page}`);
    
    // Cek apakah ada data parsial di cache yang bisa digunakan
    const partialCacheData = getPartialCachedData(startDate, endDate, shift);
    
    // Jika semua tanggal dalam rentang sudah ada di cache dan valid, gunakan cache
    if (partialCacheData.complete && !includesCurrentDay) {
      console.log(`Using complete partial cache for range ${startDate} to ${endDate}`);
      
      // Gabungkan dan urutkan data
      const combinedData = partialCacheData.data;
      combinedData.sort((a, b) => {
        // Sort by date desc, then by timeIn desc
        const dateCompare = new Date(b.date) - new Date(a.date);
        if (dateCompare !== 0) return dateCompare;
        
        // If dates are equal, compare timeIn
        const timeA = a.timeIn instanceof Date ? a.timeIn : new Date(a.timeIn);
        const timeB = b.timeIn instanceof Date ? b.timeIn : new Date(b.timeIn);
        return timeB - timeA;
      });
      
      // Terapkan pagination
      const startIndex = (page - 1) * limit;
      const paginatedData = combinedData.slice(startIndex, startIndex + limit);
      
      // Update range cache untuk mempercepat query berikutnya
      attendanceCache.set(cacheKey, combinedData);
      updateCacheTimestamp(cacheKey);
      saveAttendanceCacheToStorage();
      
      return {
        attendanceRecords: paginatedData,
        totalPages: Math.ceil(combinedData.length / limit),
        currentPage: page,
        totalRecords: combinedData.length,
        fromCache: true
      };
    }
    
    // Jika ada tanggal yang tidak ada di cache atau tidak valid, ambil dari Firestore
    // Buat query dasar
    const attendanceCollection = collection(db, "attendance");
    let baseQuery = query(
      attendanceCollection,
      where("date", ">=", startDate),
      where("date", "<=", endDate),
      orderBy("date", "desc"),
      orderBy("timeIn", "desc")
    );
    
    // Tambahkan filter shift jika diperlukan
    if (shift && shift !== "all") {
      baseQuery = query(
        baseQuery,
        where("shift", "==", shift)
      );
    }
    
    // Tambahkan limit untuk pagination
    const paginatedQuery = query(baseQuery, limit(limit));
    
    // Eksekusi query
    const snapshot = await getDocs(paginatedQuery);
    
    // Konversi snapshot ke array dengan pencegahan duplikasi
    const attendanceData = [];
    const employeeIdDateMap = new Map(); // Map untuk mencegah duplikasi (employeeId+date)
    
    snapshot.docs.forEach((doc) => {
      const data = doc.data();
      const record = {
        id: doc.id,
        ...data,
        // Convert Firestore Timestamp to JS Date
        timeIn: data.timeIn ? data.timeIn.toDate() : null,
        timeOut: data.timeOut ? data.timeOut.toDate() : null,
      };
      
      // Buat key unik untuk setiap kombinasi employeeId dan date
      const uniqueKey = `${data.employeeId}_${data.date}`;
      
      // Cek apakah sudah ada record dengan employeeId dan date yang sama
      if (!employeeIdDateMap.has(uniqueKey)) {
        employeeIdDateMap.set(uniqueKey, record);
        attendanceData.push(record);
      } else {
        console.warn(`Duplicate record found for ${data.employeeId} on ${data.date}`);
      }
    });
    
    // Update cache untuk setiap tanggal
    const dateMap = {};
    attendanceData.forEach(record => {
      const dateKey = record.date;
      if (!dateMap[dateKey]) dateMap[dateKey] = [];
      dateMap[dateKey].push(record);
    });
    
    // Update individual date caches
    for (const [dateKey, records] of Object.entries(dateMap)) {
      // Jika sudah ada data di cache untuk tanggal ini, gabungkan
      if (attendanceCache.has(dateKey)) {
        const existingRecords = attendanceCache.get(dateKey);
        const mergedRecords = mergeAttendanceRecords(existingRecords, records);
        attendanceCache.set(dateKey, mergedRecords);
      } else {
        attendanceCache.set(dateKey, records);
      }
      updateCacheTimestamp(dateKey);
    }
    
    // Update range cache dengan menggabungkan data baru dan data cache yang valid
    if (partialCacheData.data.length > 0) {
      // Gabungkan data baru dengan data cache yang valid
      const allRecords = mergeAttendanceRecords(partialCacheData.data, attendanceData);
      attendanceCache.set(cacheKey, allRecords);
    } else {
      attendanceCache.set(cacheKey, attendanceData);
    }
    
    updateCacheTimestamp(cacheKey);
    saveAttendanceCacheToStorage();
    
    return {
      attendanceRecords: attendanceData,
      totalPages: Math.ceil(snapshot.size / limit),
      currentPage: page,
      totalRecords: snapshot.size,
      fromCache: false
    };
  } catch (error) {
    console.error("Error getting attendance by date range:", error);
    
    // Try to use cache as fallback
    const cacheKey = shift ? `range_${startDate}_${endDate}_${shift}` : `range_${startDate}_${endDate}`;
    if (cacheMeta.has(cacheKey)) {
      console.log(`Using cached data as fallback for range ${startDate} to ${endDate}`);
      
      // Ambil data dari cache dan terapkan pagination di memory
      const cachedData = getCachedAttendanceByDateRange(startDate, endDate, shift);
      const startIndex = (page - 1) * limit;
      const paginatedData = cachedData.slice(startIndex, startIndex + limit);
      
      return {
        attendanceRecords: paginatedData,
        totalPages: Math.ceil(cachedData.length / limit),
        currentPage: page,
        totalRecords: cachedData.length,
        fromCache: true,
        isErrorFallback: true
      };
    }
    
    throw error;
  }
}

/**
 * Mendapatkan data kehadiran untuk rentang tanggal besar dengan metode batching
 * @param {string} startDate - Tanggal awal
 * @param {string} endDate - Tanggal akhir
 * @param {number} page - Halaman
 * @param {number} limit - Limit per halaman
 * @param {string|null} shift - Filter shift
 * @returns {Promise<Object>} - Data kehadiran dan info pagination
 */
async function getAttendanceByDateRangeBatched(startDate, endDate, page = 1, limit = 100, shift = null) {
  // Bagi rentang tanggal menjadi batch-batch kecil (7 hari per batch)
  const batches = splitDateRange(startDate, endDate, 7);
  const cacheKey = shift ? `range_${startDate}_${endDate}_${shift}` : `range_${startDate}_${endDate}`;
  
  // Cek apakah cache range sudah ada dan valid
  if (attendanceCache.has(cacheKey) && !shouldUpdateCache(cacheKey)) {
    console.log(`Using cached data for large range ${startDate} to ${endDate}`);
    
    const cachedData = attendanceCache.get(cacheKey);
    const startIndex = (page - 1) * limit;
    const paginatedData = cachedData.slice(startIndex, startIndex + limit);
    
    return {
      attendanceRecords: paginatedData,
      totalPages: Math.ceil(cachedData.length / limit),
      currentPage: page,
      totalRecords: cachedData.length,
      fromCache: true
    };
  }
  
  console.log(`Processing ${batches.length} batches for range ${startDate} to ${endDate}`);
  
  // Cek cache untuk setiap batch dan buat daftar batch yang perlu diambil dari Firestore
  const batchesToFetch = [];
  const cachedBatchData = [];
  
  for (const batch of batches) {
    const batchCacheKey = shift ? `range_${batch.start}_${batch.end}_${shift}` : `range_${batch.start}_${batch.end}`;
    
    if (attendanceCache.has(batchCacheKey) && !shouldUpdateCache(batchCacheKey)) {
      // Batch ini sudah ada di cache dan masih valid
      cachedBatchData.push(...attendanceCache.get(batchCacheKey));
    } else {
      // Batch ini perlu diambil dari Firestore
      batchesToFetch.push(batch);
    }
  }
  
  // Ambil data untuk batch yang tidak ada di cache
  const fetchedData = [];
  
  if (batchesToFetch.length > 0) {
    console.log(`Fetching ${batchesToFetch.length} batches from Firestore`);
    
    // Batasi jumlah batch yang diproses secara paralel untuk menghindari rate limit
    const PARALLEL_BATCH_LIMIT = 3;
    
    for (let i = 0; i < batchesToFetch.length; i += PARALLEL_BATCH_LIMIT) {
      const currentBatches = batchesToFetch.slice(i, i + PARALLEL_BATCH_LIMIT);
      
      // Proses batch secara paralel
      const batchPromises = currentBatches.map(async (batch) => {
        try {
          const batchData = await fetchBatchData(batch.start, batch.end, shift);
          
          // Cache batch data
          const batchCacheKey = shift ? `range_${batch.start}_${batch.end}_${shift}` : `range_${batch.start}_${batch.end}`;
          attendanceCache.set(batchCacheKey, batchData);
          updateCacheTimestamp(batchCacheKey);
          
          return batchData;
        } catch (error) {
          console.error(`Error fetching batch ${batch.start} to ${batch.end}:`, error);
          return [];
        }
      });
      
      // Tunggu semua batch dalam grup ini selesai
      const batchResults = await Promise.all(batchPromises);
      
      // Gabungkan hasil
      for (const batchData of batchResults) {
        fetchedData.push(...batchData);
      }
      
      // Simpan cache setelah setiap grup batch untuk menghindari kehilangan data jika terjadi error
      saveAttendanceCacheToStorage();
    }
  }
  
  // Gabungkan data dari cache dan data yang baru diambil
  const allData = [...cachedBatchData, ...fetchedData];
  
  // Hapus duplikat berdasarkan id
  const uniqueData = removeDuplicates(allData);
  
  // Urutkan data
  uniqueData.sort((a, b) => {
    // Sort by date desc, then by timeIn desc
    const dateCompare = new Date(b.date) - new Date(a.date);
    if (dateCompare !== 0) return dateCompare;
    
    // If dates are equal, compare timeIn
    const timeA = a.timeIn instanceof Date ? a.timeIn : new Date(a.timeIn);
    const timeB = b.timeIn instanceof Date ? b.timeIn : new Date(b.timeIn);
    return timeB - timeA;
  });
  
  // Cache hasil gabungan untuk range penuh
  attendanceCache.set(cacheKey, uniqueData);
  updateCacheTimestamp(cacheKey);
  saveAttendanceCacheToStorage();
  
  // Terapkan pagination
  const startIndex = (page - 1) * limit;
  const paginatedData = uniqueData.slice(startIndex, startIndex + limit);
  
  return {
    attendanceRecords: paginatedData,
    totalPages: Math.ceil(uniqueData.length / limit),
    currentPage: page,
    totalRecords: uniqueData.length,
    fromCache: false
  };
}

/**
 * Mengambil data untuk satu batch dari Firestore
 * @param {string} startDate - Tanggal awal batch
 * @param {string} endDate - Tanggal akhir batch
 * @param {string|null} shift - Filter shift
 * @returns {Promise<Array>} - Array data kehadiran
 */
async function fetchBatchData(startDate, endDate, shift = null) {
  try {
    console.log(`Fetching batch data from ${startDate} to ${endDate}`);
    
    // Buat query dasar
    const attendanceCollection = collection(db, "attendance");
    let batchQuery = query(
      attendanceCollection,
      where("date", ">=", startDate),
      where("date", "<=", endDate),
      orderBy("date", "desc"),
      orderBy("timeIn", "desc")
    );
    
    // Tambahkan filter shift jika diperlukan
    if (shift && shift !== "all") {
      batchQuery = query(
        attendanceCollection,
        where("date", ">=", startDate),
        where("date", "<=", endDate),
        where("shift", "==", shift),
        orderBy("date", "desc"),
        orderBy("timeIn", "desc")
      );
    }
    
    // Eksekusi query
    const snapshot = await getDocs(batchQuery);
    
    // Konversi snapshot ke array dengan pencegahan duplikasi
    const attendanceData = [];
    const employeeIdDateMap = new Map(); // Map untuk mencegah duplikasi (employeeId+date)
    
    snapshot.docs.forEach((doc) => {
      const data = doc.data();
      const record = {
        id: doc.id,
        ...data,
        // Convert Firestore Timestamp to JS Date
        timeIn: data.timeIn ? data.timeIn.toDate() : null,
        timeOut: data.timeOut ? data.timeOut.toDate() : null,
      };
      
      // Buat key unik untuk setiap kombinasi employeeId dan date
      const uniqueKey = `${data.employeeId}_${data.date}`;
      
      // Cek apakah sudah ada record dengan employeeId dan date yang sama
      if (!employeeIdDateMap.has(uniqueKey)) {
        employeeIdDateMap.set(uniqueKey, record);
        attendanceData.push(record);
      } else {
        console.warn(`Duplicate record found for ${data.employeeId} on ${data.date}`);
      }
    });
    
    // Update cache untuk setiap tanggal
    const dateMap = {};
    attendanceData.forEach(record => {
      const dateKey = record.date;
      if (!dateMap[dateKey]) dateMap[dateKey] = [];
      dateMap[dateKey].push(record);
    });
    
    // Update individual date caches
    for (const [dateKey, records] of Object.entries(dateMap)) {
      // Jika sudah ada data di cache untuk tanggal ini, gabungkan
      if (attendanceCache.has(dateKey)) {
        const existingRecords = attendanceCache.get(dateKey);
        const mergedRecords = mergeAttendanceRecords(existingRecords, records);
        attendanceCache.set(dateKey, mergedRecords);
      } else {
        attendanceCache.set(dateKey, records);
      }
      updateCacheTimestamp(dateKey);
    }
    
    return attendanceData;
  } catch (error) {
    console.error(`Error fetching batch data from ${startDate} to ${endDate}:`, error);
    throw error;
  }
}

/**
 * Membagi rentang tanggal menjadi batch-batch kecil
 * @param {string} startDate - Tanggal awal dalam format YYYY-MM-DD
 * @param {string} endDate - Tanggal akhir dalam format YYYY-MM-DD
 * @param {number} batchSize - Ukuran batch dalam hari
 * @returns {Array<Object>} - Array objek batch dengan properti start dan end
 */
function splitDateRange(startDate, endDate, batchSize = 7) {
  const batches = [];
  
  // Konversi string tanggal ke objek Date
  let currentDate = new Date(startDate);
  const endDateObj = new Date(endDate);
  
  // Set waktu ke 00:00:00 untuk menghindari masalah perbandingan
  currentDate.setHours(0, 0, 0, 0);
  endDateObj.setHours(0, 0, 0, 0);
  
  while (currentDate <= endDateObj) {
    const batchStart = formatDateForAPI(currentDate);
    
    // Hitung tanggal akhir batch (maksimal batchSize hari atau sampai endDate)
    const batchEndDate = new Date(currentDate);
    batchEndDate.setDate(batchEndDate.getDate() + batchSize - 1);
    
    // Jika batchEndDate melebihi endDateObj, gunakan endDateObj
    const batchEnd = batchEndDate <= endDateObj 
      ? formatDateForAPI(batchEndDate) 
      : formatDateForAPI(endDateObj);
    
    batches.push({ start: batchStart, end: batchEnd });
    
    // Pindah ke batch berikutnya
    currentDate.setDate(currentDate.getDate() + batchSize);
  }
  
  return batches;
}

/**
 * Menggabungkan dua array data kehadiran dan menghapus duplikat
 * @param {Array} existingRecords - Array data kehadiran yang sudah ada
 * @param {Array} newRecords - Array data kehadiran baru
 * @returns {Array} - Array gabungan tanpa duplikat
 */
function mergeAttendanceRecords(existingRecords, newRecords) {
  // Buat map dari record yang sudah ada berdasarkan id
  const recordMap = new Map();
  
  // Tambahkan record yang sudah ada ke map
  existingRecords.forEach(record => {
    recordMap.set(record.id, record);
  });
  
  // Tambahkan atau update dengan record baru
  newRecords.forEach(record => {
    recordMap.set(record.id, record);
  });
  
  // Konversi kembali ke array
  return Array.from(recordMap.values());
}

/**
 * Menghapus duplikat dari array data kehadiran berdasarkan id
 * @param {Array} records - Array data kehadiran
 * @returns {Array} - Array tanpa duplikat
 */
function removeDuplicates(records) {
  const uniqueMap = new Map();
  
  records.forEach(record => {
    uniqueMap.set(record.id, record);
  });
  
  return Array.from(uniqueMap.values());
}

/**
 * Mendapatkan data kehadiran dari cache berdasarkan rentang tanggal
 * @param {string} startDate - Tanggal awal
 * @param {string} endDate - Tanggal akhir
 * @param {string|null} shift - Filter shift
 * @returns {Array} - Array data kehadiran
 */
function getCachedAttendanceByDateRange(startDate, endDate, shift = null) {
  // Cek apakah ada cache untuk rentang tanggal ini
  const cacheKey = shift ? `range_${startDate}_${endDate}_${shift}` : `range_${startDate}_${endDate}`;
  
  if (attendanceCache.has(cacheKey)) {
    return attendanceCache.get(cacheKey);
  }
  
  // Jika tidak ada cache untuk rentang, coba gabungkan dari cache per tanggal
  const result = [];
  const dates = getDatesInRange(startDate, endDate);
  
  for (const date of dates) {
    const dateStr = formatDateForAPI(date);
    
    if (attendanceCache.has(dateStr)) {
      const dateRecords = attendanceCache.get(dateStr);
      
      // Filter berdasarkan shift jika diperlukan
      if (shift && shift !== "all") {
        const filteredRecords = dateRecords.filter(record => record.shift === shift);
        result.push(...filteredRecords);
      } else {
        result.push(...dateRecords);
      }
    }
  }
  
  // Urutkan hasil
  result.sort((a, b) => {
    // Sort by date desc, then by timeIn desc
    const dateCompare = new Date(b.date) - new Date(a.date);
    if (dateCompare !== 0) return dateCompare;
    
    // If dates are equal, compare timeIn
    const timeA = a.timeIn instanceof Date ? a.timeIn : new Date(a.timeIn);
    const timeB = b.timeIn instanceof Date ? b.timeIn : new Date(b.timeIn);
    return timeB - timeA;
  });
  
  return result;
}

/**
 * Mendapatkan data parsial dari cache untuk rentang tanggal
 * @param {string} startDate - Tanggal awal
 * @param {string} endDate - Tanggal akhir
 * @param {string|null} shift - Filter shift
 * @returns {Object} - Objek dengan properti complete dan data
 */
function getPartialCachedData(startDate, endDate, shift = null) {
  const dates = getDatesInRange(startDate, endDate);
  const data = [];
  let complete = true;
  
  for (const date of dates) {
    const dateStr = formatDateForAPI(date);
    
    // Cek apakah tanggal ini ada di cache dan masih valid
    if (attendanceCache.has(dateStr) && !shouldUpdateCache(dateStr)) {
      const dateRecords = attendanceCache.get(dateStr);
      
      // Filter berdasarkan shift jika diperlukan
      if (shift && shift !== "all") {
        const filteredRecords = dateRecords.filter(record => record.shift === shift);
        data.push(...filteredRecords);
      } else {
        data.push(...dateRecords);
      }
    } else {
      // Jika ada satu tanggal yang tidak ada di cache atau tidak valid,
      // tandai bahwa data tidak lengkap
      complete = false;
    }
  }
  
  return { complete, data };
}

/**
 * Mendapatkan array tanggal dalam rentang
 * @param {string} startDate - Tanggal awal dalam format YYYY-MM-DD
 * @param {string} endDate - Tanggal akhir dalam format YYYY-MM-DD
 * @returns {Array<Date>} - Array objek Date
 */
function getDatesInRange(startDate, endDate) {
  const dates = [];
  let currentDate = new Date(startDate);
  const endDateObj = new Date(endDate);
  
  // Set waktu ke 00:00:00 untuk menghindari masalah perbandingan
  currentDate.setHours(0, 0, 0, 0);
  endDateObj.setHours(0, 0, 0, 0);
  
  while (currentDate <= endDateObj) {
    dates.push(new Date(currentDate));
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  return dates;
}

/**
 * Format tanggal untuk API (YYYY-MM-DD)
 * @param {Date} date - Objek Date
 * @returns {string} - String tanggal dalam format YYYY-MM-DD
 */
function formatDateForAPI(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Menghitung selisih hari antara dua tanggal
 * @param {string} startDate - Tanggal awal dalam format YYYY-MM-DD
 * @param {string} endDate - Tanggal akhir dalam format YYYY-MM-DD
 * @returns {number} - Selisih hari
 */
function calculateDateDifference(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  // Set waktu ke 00:00:00 untuk menghindari masalah perbandingan
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  
  // Hitung selisih dalam milidetik dan konversi ke hari
  const diffTime = Math.abs(end - start);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return diffDays;
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
