import { db } from "../configFirebase.js";
import {
  collection,
  query,
  where,
  getDocs,
  deleteDoc,
  orderBy,
  startAfter,
  limit,
  Timestamp,
} from "https://www.gstatic.com/firebasejs/10.4.0/firebase-firestore.js";
import { 
  attendanceCache, 
  shouldUpdateCache as shouldUpdateAttendanceCache, 
  updateCacheTimestamp as updateAttendanceCacheTimestamp,
  syncCacheWithReport
} from "./attendance-service.js";
import { leaveCache, leaveMonthCache, updateCacheTimestamp,clearLeaveCache } from "./leave-service.js";

// Perbarui fungsi untuk menyertakan filter shift
export async function getAttendanceByDateRange(startDate, endDate, lastDoc = null, itemLimit = 1000, shift = null, status = "all") {
  try {
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    
    const attendanceRef = collection(db, "attendance");
    
    // Simplified query - hanya filter berdasarkan tanggal
    let queryConstraints = [
      where("date", ">=", startDate),
      where("date", "<=", endDate),
      orderBy("date", "desc"),
      limit(itemLimit * 2) // Ambil lebih banyak data untuk antisipasi filtering
    ];
    
    let q = query(attendanceRef, ...queryConstraints);
    const snapshot = await getDocs(q);
    
    console.log(`Found ${snapshot.docs.length} attendance records before filtering`);
    
    let attendanceRecords = snapshot.docs.map((doc) => {
      const data = doc.data();
      const timeIn = data.timeIn ? new Date(data.timeIn.seconds * 1000) : null;
      const timeOut = data.timeOut ? new Date(data.timeOut.seconds * 1000) : null;
      
      return {
        id: doc.id,
        employeeId: data.employeeId,
        name: data.name,
        date: data.date,
        timeIn: timeIn,
        timeOut: timeOut,
        type: data.type || "staff",
        shift: data.shift || "morning",
        status: data.status || "Tepat Waktu",
        lateMinutes: data.lateMinutes || 0
      };
    });
    
    // Filter berdasarkan shift
    if (shift && shift !== "all") {
      attendanceRecords = attendanceRecords.filter(record => record.shift === shift);
      console.log(`After shift filtering: ${attendanceRecords.length} records`);
    }
    
    // Filter berdasarkan status - PERBAIKAN INI
    if (status && status !== "all") {
      const originalCount = attendanceRecords.length;
      attendanceRecords = attendanceRecords.filter(record => {
        const recordStatus = record.status || "Tepat Waktu";
        return recordStatus === status;
      });
      console.log(`After status filtering (${status}): ${attendanceRecords.length} records (from ${originalCount})`);
    }
    
    // Limit hasil akhir
    if (attendanceRecords.length > itemLimit) {
      attendanceRecords = attendanceRecords.slice(0, itemLimit);
    }
    
    return {
      attendanceRecords: attendanceRecords,
      lastDoc: null,
      hasMore: false
    };
    
  } catch (error) {
    console.error("Error getting attendance by date range:", error);
    throw error;
  }
}


// Modifikasi deleteAttendanceByDateRange untuk membersihkan cache
export async function deleteAttendanceByDateRange(startDate, endDate) {
  try {
    console.log(`Deleting attendance records from ${startDate} to ${endDate}`);
    
    // Kode yang sudah ada untuk menghapus dari Firestore
    const attendanceCollection = collection(db, "attendance");
    const q = query(
      attendanceCollection,
      where("date", ">=", startDate),
      where("date", "<=", endDate)
    );

    const snapshot = await getDocs(q);
    console.log(`Found ${snapshot.docs.length} records to delete`);
    
    if (snapshot.docs.length === 0) {
      return 0;
    }
    
    // Delete each document
    const deletePromises = snapshot.docs.map(doc => {
      console.log(`Deleting document with ID: ${doc.id}`);
      return deleteDoc(doc.ref);
    });
    
    await Promise.all(deletePromises);
    console.log(`Successfully deleted ${snapshot.docs.length} records`);
    
    // Bersihkan cache untuk rentang tanggal ini
    const rangeCacheKey = `range_${startDate}_${endDate}`;
    attendanceCache.delete(rangeCacheKey);
    
    // Bersihkan juga cache per tanggal
    const start = new Date(startDate);
    const end = new Date(endDate);
    const dateRange = getDatesInRange(start, end);
    
    for (const date of dateRange) {
      const dateKey = formatDateToString(date);
      attendanceCache.delete(dateKey);
    }
    
    return snapshot.docs.length; // Return number of deleted records
  } catch (error) {
    console.error("Error deleting attendance by date range:", error);
    throw error;
  }
}
// Fungsi helper untuk mendapatkan array tanggal dalam rentang
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

// Fungsi helper untuk memformat tanggal ke string
function formatDateToString(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
}

// Get leave requests by month with pagination - UPDATED WITH CACHE INTEGRATION
export async function getLeaveRequestsByMonth(month, year, lastDoc = null, itemsPerPage = 1000) {
  try {
    console.log("Fetching leave requests for month:", month, "year:", year);
    
    // Buat kunci cache
    const cacheKey = `${month}_${year}`;
    
    // Cek apakah data ada di cache dan kita tidak sedang melakukan pagination
    if (leaveMonthCache.has(cacheKey) && !lastDoc) {
      console.log("Using cached leave data for month:", cacheKey);
      const cachedData = leaveMonthCache.get(cacheKey);
      return {
        leaveRequests: cachedData.slice(0, itemsPerPage),
        lastDoc: cachedData.length > itemsPerPage ? {} : null, // Dummy lastDoc if there's more data
        hasMore: cachedData.length > itemsPerPage
      };
    }
    
    // Calculate start and end dates for the month
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0); // Last day of month
    
    const leaveCollection = collection(db, "leaveRequests");
    let q;
    
    if (lastDoc) {
      // Query for multi-day leaves that overlap with the month
      q = query(
        leaveCollection,
        where("month", "==", month),
        where("year", "==", year),
        orderBy("submitDate", "desc"),
        startAfter(lastDoc),
        limit(itemsPerPage)
      );
    } else {
      q = query(
        leaveCollection,
        where("month", "==", month),
        where("year", "==", year),
        orderBy("submitDate", "desc"),
        limit(itemsPerPage)
      );
    }
    
    const snapshot = await getDocs(q);
    
    const leaveRequests = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        // Convert Firestore Timestamp to JS Date if needed
        submitDate: data.submitDate instanceof Timestamp ? data.submitDate.toDate() : data.submitDate,
        decisionDate: data.decisionDate instanceof Timestamp ? data.decisionDate.toDate() : data.decisionDate
      };
    });
    
    // Store in cache if this is the first page
    if (!lastDoc) {
      leaveMonthCache.set(cacheKey, [...leaveRequests]);
      updateCacheTimestamp(cacheKey);
      saveLeaveCacheToStorage(); // Simpan ke localStorage
    } else if (leaveMonthCache.has(cacheKey)) {
      // Append to existing cache
      const existingData = leaveMonthCache.get(cacheKey);
      leaveMonthCache.set(cacheKey, [...existingData, ...leaveRequests]);
      updateCacheTimestamp(cacheKey);
      saveLeaveCacheToStorage(); // Simpan ke localStorage
    }
    
    // Determine if there are more records
    const hasMore = leaveRequests.length === itemsPerPage;
    
    // Get the last document for pagination
    const lastVisible = snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : null;
    
    return {
      leaveRequests,
      lastDoc: lastVisible,
      hasMore
    };
  } catch (error) {
    console.error("Error getting leave requests by month:", error);
    
    // Fallback to cache if available
    const cacheKey = `${month}_${year}`;
    if (leaveMonthCache.has(cacheKey)) {
      console.log("Fallback to cached leave data due to error");
      const cachedData = leaveMonthCache.get(cacheKey);
      return {
        leaveRequests: cachedData.slice(0, itemsPerPage),
        lastDoc: null, // No pagination for fallback
        hasMore: false
      };
    }
    
    throw error;
  }
}

// Delete leave requests by month - UPDATED WITH CACHE INTEGRATION
export async function deleteLeaveRequestsByMonth(month, year) {
  try {
    const leaveCollection = collection(db, "leaveRequests");
    const q = query(
      leaveCollection,
      where("month", "==", month),
      where("year", "==", year)
    );

    const snapshot = await getDocs(q);
    
     // Delete each document
     const deletePromises = snapshot.docs.map((doc) => deleteDoc(doc.ref));
     await Promise.all(deletePromises);
 
     // Clear cache menggunakan fungsi yang diimpor
     clearLeaveCache();
 
     return snapshot.docs.length; // Return number of deleted records
   } catch (error) {
     console.error("Error deleting leave requests by month:", error);
     throw error;
   }
}
