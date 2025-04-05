import { db } from "../configFirebase.js";
import {
  collection,
  query,
  where,
  getDocs,
  orderBy,
  startAfter,
  limit,
  Timestamp,
  addDoc,
  updateDoc,
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.4.0/firebase-firestore.js";

// Cache untuk data izin
export const leaveCache = new Map();
let leaveMonthCache = new Map(); // Cache untuk data izin per bulan

// Modify the getLeaveRequestsByDate function to ensure it works correctly
export async function getLeaveRequestsByDate(date) {
  try {
    // Check if data is in cache
    if (leaveCache.has(date)) {
      console.log("Using cached leave data for date:", date);
      return leaveCache.get(date);
    }
    
    console.log("Fetching leave data for date:", date);
    
    const leaveCollection = collection(db, "leaveRequests");
    
    // Coba beberapa kemungkinan field untuk tanggal izin
    const possibleDateFields = ["leaveDate", "date", "tanggal"];
    let leaveData = [];
    
    // Coba dengan format string YYYY-MM-DD
    for (const fieldName of possibleDateFields) {
      const q = query(
        leaveCollection,
        where(fieldName, "==", date),
        where("status", "in", ["Approved", "Disetujui", "approved", "disetujui"])
      );
      
      const snapshot = await getDocs(q);
      
      if (!snapshot.empty) {
        console.log(`Found leave data using field: ${fieldName}`);
        leaveData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        break;
      }
    }
    
    // Jika tidak ditemukan, coba dengan format timestamp
    if (leaveData.length === 0) {
      // Konversi string date ke timestamp range (awal dan akhir hari)
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);
      
      for (const fieldName of possibleDateFields) {
        const q = query(
          leaveCollection,
          where(fieldName, ">=", Timestamp.fromDate(startOfDay)),
          where(fieldName, "<=", Timestamp.fromDate(endOfDay)),
          where("status", "in", ["Approved", "Disetujui", "approved", "disetujui"])
        );
        
        const snapshot = await getDocs(q);
        
        if (!snapshot.empty) {
          console.log(`Found leave data using timestamp range for field: ${fieldName}`);
          leaveData = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
          break;
        }
      }
    }
    
    // Jika masih tidak ditemukan, coba query semua data dan filter di client
    if (leaveData.length === 0) {
      console.log("Trying to fetch all leave requests and filter client-side");
      const q = query(leaveCollection);
      const snapshot = await getDocs(q);
      
      const allLeaveData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      // Log struktur data untuk debugging
      if (allLeaveData.length > 0) {
        console.log("Sample leave data structure:", allLeaveData[0]);
      }
      
      // Filter berdasarkan tanggal (coba beberapa format) dan status
      leaveData = allLeaveData.filter(leave => {
        // Check if status is approved
        const status = leave.status || '';
        const isApproved = ['approved', 'disetujui', 'Approved', 'Disetujui'].includes(status);
        
        if (!isApproved) return false;
        
        for (const fieldName of possibleDateFields) {
          const leaveDate = leave[fieldName];
          
          // Jika field ada
          if (leaveDate) {
            // Jika timestamp
            if (leaveDate instanceof Timestamp) {
              const leaveDateTime = leaveDate.toDate();
              const leaveDateStr = leaveDateTime.toISOString().split('T')[0];
              if (leaveDateStr === date) return true;
            } 
            // Jika string
            else if (typeof leaveDate === 'string') {
              // Coba beberapa format
              if (leaveDate === date) return true;
              
              // Coba format lain (DD-MM-YYYY)
              const parts = leaveDate.split(/[-\/]/);
              if (parts.length === 3) {
                // Asumsi format DD-MM-YYYY atau DD/MM/YYYY
                if (parts[2].length === 4) {
                  const formattedDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
                  if (formattedDate === date) return true;
                }
                // Asumsi format MM-DD-YYYY atau MM/DD/YYYY
                else if (parts[0].length === 4) {
                  const formattedDate = `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
                  if (formattedDate === date) return true;
                }
              }
            }
            // Jika Date object
            else if (leaveDate instanceof Date) {
              const leaveDateStr = leaveDate.toISOString().split('T')[0];
              if (leaveDateStr === date) return true;
            }
          }
        }
        return false;
      });
    }
    
    console.log(`Found ${leaveData.length} leave requests for date ${date}`);
    
    // Store in cache
    leaveCache.set(date, leaveData);
    
    return leaveData;
  } catch (error) {
    console.error("Error getting leave requests by date:", error);
    console.log("Stack trace:", error.stack);
    return []; // Return empty array instead of throwing
  }
}


// Get leave requests by date range
export async function getLeaveRequestsByDateRange(startDate, endDate) {
  try {
    console.log(`Fetching leave requests from ${startDate} to ${endDate}`);
    
    const leaveCollection = collection(db, "leaveRequests");
    
    // Coba beberapa kemungkinan field untuk tanggal izin
    const possibleDateFields = ["leaveDate", "date", "tanggal"];
    let leaveData = [];
    
    // Coba dengan format string YYYY-MM-DD
    for (const fieldName of possibleDateFields) {
      const q = query(
        leaveCollection,
        where(fieldName, ">=", startDate),
        where(fieldName, "<=", endDate)
      );
      
      const snapshot = await getDocs(q);
      
      if (!snapshot.empty) {
        console.log(`Found leave data using field: ${fieldName}`);
        leaveData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        break;
      }
    }
    
    // Jika tidak ditemukan, coba dengan format timestamp
    if (leaveData.length === 0) {
      // Konversi string date ke timestamp range
      const startOfRange = new Date(startDate);
      startOfRange.setHours(0, 0, 0, 0);
      const endOfRange = new Date(endDate);
      endOfRange.setHours(23, 59, 59, 999);
      
      for (const fieldName of possibleDateFields) {
        const q = query(
          leaveCollection,
          where(fieldName, ">=", Timestamp.fromDate(startOfRange)),
          where(fieldName, "<=", Timestamp.fromDate(endOfRange))
        );
        
        const snapshot = await getDocs(q);
        
        if (!snapshot.empty) {
          console.log(`Found leave data using timestamp range for field: ${fieldName}`);
          leaveData = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
          break;
        }
      }
    }
    
    // Jika masih tidak ditemukan, coba query semua data dan filter di client
    if (leaveData.length === 0) {
      console.log("Trying to fetch all leave requests and filter client-side");
      const q = query(leaveCollection);
      const snapshot = await getDocs(q);
      
      const allLeaveData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      // Filter berdasarkan rentang tanggal
      leaveData = allLeaveData.filter(leave => {
        for (const fieldName of possibleDateFields) {
          const leaveDate = leave[fieldName];
          
          if (leaveDate) {
            let leaveDateStr;
            
            // Konversi ke string YYYY-MM-DD
            if (leaveDate instanceof Timestamp) {
              leaveDateStr = leaveDate.toDate().toISOString().split('T')[0];
            } else if (typeof leaveDate === 'string') {
              // Coba beberapa format
              if (leaveDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
                leaveDateStr = leaveDate;
              } else {
                // Coba format lain (DD-MM-YYYY atau DD/MM/YYYY)
                const parts = leaveDate.split(/[-\/]/);
                if (parts.length === 3 && parts[2].length === 4) {
                  leaveDateStr = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
                }
              }
            } else if (leaveDate instanceof Date) {
              leaveDateStr = leaveDate.toISOString().split('T')[0];
            }
            
            // Bandingkan dengan rentang tanggal
            if (leaveDateStr && leaveDateStr >= startDate && leaveDateStr <= endDate) {
              return true;
            }
          }
        }
        return false;
      });
    }
    
    console.log(`Found ${leaveData.length} leave requests between ${startDate} and ${endDate}`);
    
    // Update cache untuk setiap tanggal dalam rentang
    const start = new Date(startDate);
    const end = new Date(endDate);
    const dateRange = getDatesInRange(start, end);
    
    for (const date of dateRange) {
      const dateStr = date.toISOString().split('T')[0];
      const leavesForDate = leaveData.filter(leave => {
        for (const fieldName of possibleDateFields) {
          const leaveDate = leave[fieldName];
          if (!leaveDate) continue;
          
          let leaveDateStr;
          if (leaveDate instanceof Timestamp) {
            leaveDateStr = leaveDate.toDate().toISOString().split('T')[0];
          } else if (typeof leaveDate === 'string') {
            if (leaveDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
              leaveDateStr = leaveDate;
            } else {
              const parts = leaveDate.split(/[-\/]/);
              if (parts.length === 3 && parts[2].length === 4) {
                leaveDateStr = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
              }
            }
          } else if (leaveDate instanceof Date) {
            leaveDateStr = leaveDate.toISOString().split('T')[0];
          }
          
          return leaveDateStr === dateStr;
        }
        return false;
      });
      
      leaveCache.set(dateStr, leavesForDate);
    }
    
    return leaveData;
  } catch (error) {
    console.error("Error getting leave requests by date range:", error);
    return [];
  }
}

// Get leave requests by month with pagination
export async function getLeaveRequestsByMonth(month, year, lastDoc = null, itemsPerPage = 20) {
  try {
    console.log(`Fetching leave requests for ${month}/${year}`);
    
    // Create cache key
    const cacheKey = `${month}_${year}`;
    
    // Check if data is in cache and we're not paginating
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
    
    // Try different approaches to query the data
    
    // First try: Query by month and year fields
    if (lastDoc) {
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
    
    let snapshot = await getDocs(q);
    
    // If no results, try by date range
    if (snapshot.empty) {
      console.log("No results with month/year fields, trying date range");
      
      // Convert dates to strings in YYYY-MM-DD format
      const startDateStr = startDate.toISOString().split('T')[0];
      const endDateStr = endDate.toISOString().split('T')[0];
      
      // Try with leaveDate field
      if (lastDoc) {
        q = query(
          leaveCollection,
          where("leaveDate", ">=", startDateStr),
          where("leaveDate", "<=", endDateStr),
          orderBy("leaveDate", "desc"),
          startAfter(lastDoc),
          limit(itemsPerPage)
        );
      } else {
        q = query(
          leaveCollection,
          where("leaveDate", ">=", startDateStr),
          where("leaveDate", "<=", endDateStr),
          orderBy("leaveDate", "desc"),
          limit(itemsPerPage)
        );
      }
      
      snapshot = await getDocs(q);
    }
    
    // If still no results, try with date field
    if (snapshot.empty) {
      console.log("No results with leaveDate field, trying date field");
      
      // Convert dates to strings in YYYY-MM-DD format
      const startDateStr = startDate.toISOString().split('T')[0];
      const endDateStr = endDate.toISOString().split('T')[0];
      
      if (lastDoc) {
        q = query(
          leaveCollection,
          where("date", ">=", startDateStr),
          where("date", "<=", endDateStr),
          orderBy("date", "desc"),
          startAfter(lastDoc),
          limit(itemsPerPage)
        );
      } else {
        q = query(
          leaveCollection,
          where("date", ">=", startDateStr),
          where("date", "<=", endDateStr),
          orderBy("date", "desc"),
          limit(itemsPerPage)
        );
      }
      
      snapshot = await getDocs(q);
    }
    
    // If still no results, try with timestamp fields
    if (snapshot.empty) {
      console.log("No results with date fields, trying timestamp fields");
      
      // Convert dates to Firestore Timestamps
      const startTimestamp = Timestamp.fromDate(startDate);
      const endTimestamp = Timestamp.fromDate(endDate);
      
      // Try with leaveDate field as timestamp
      if (lastDoc) {
        q = query(
          leaveCollection,
          where("leaveDate", ">=", startTimestamp),
          where("leaveDate", "<=", endTimestamp),
          orderBy("leaveDate", "desc"),
          startAfter(lastDoc),
          limit(itemsPerPage)
        );
      } else {
        q = query(
          leaveCollection,
          where("leaveDate", ">=", startTimestamp),
          where("leaveDate", "<=", endTimestamp),
          orderBy("leaveDate", "desc"),
          limit(itemsPerPage)
        );
      }
      
      snapshot = await getDocs(q);
    }
    
    // If still no results, try with date field as timestamp
    if (snapshot.empty) {
      console.log("No results with leaveDate timestamp, trying date timestamp");
      
      // Convert dates to Firestore Timestamps
      const startTimestamp = Timestamp.fromDate(startDate);
      const endTimestamp = Timestamp.fromDate(endDate);
      
      if (lastDoc) {
        q = query(
          leaveCollection,
          where("date", ">=", startTimestamp),
          where("date", "<=", endTimestamp),
          orderBy("date", "desc"),
          startAfter(lastDoc),
          limit(itemsPerPage)
        );
      } else {
        q = query(
          leaveCollection,
          where("date", ">=", startTimestamp),
          where("date", "<=", endTimestamp),
          orderBy("date", "desc"),
          limit(itemsPerPage)
        );
      }
      
      snapshot = await getDocs(q);
    }
    
    // If still no results, try getting all and filtering client-side
    let leaveRequests = [];
    let allLeaveRequests = [];
    
    if (snapshot.empty && !lastDoc) {
      console.log("No results with any field, fetching all and filtering client-side");
      
      q = query(leaveCollection);
      snapshot = await getDocs(q);
      
      allLeaveRequests = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      // Log sample data for debugging
      if (allLeaveRequests.length > 0) {
        console.log("Sample leave request:", allLeaveRequests[0]);
      }
      
      // Filter by month and year
      leaveRequests = allLeaveRequests.filter(leave => {
        // Try to extract date from various fields
        let leaveDate = null;
        
        // Check leaveDate field
        if (leave.leaveDate) {
          if (leave.leaveDate instanceof Timestamp) {
            leaveDate = leave.leaveDate.toDate();
          } else if (typeof leave.leaveDate === 'string') {
            leaveDate = new Date(leave.leaveDate);
          } else if (leave.leaveDate instanceof Date) {
            leaveDate = leave.leaveDate;
          }
        }
        // Check date field
        else if (leave.date) {
          if (leave.date instanceof Timestamp) {
            leaveDate = leave.date.toDate();
          } else if (typeof leave.date === 'string') {
            leaveDate = new Date(leave.date);
          } else if (leave.date instanceof Date) {
            leaveDate = leave.date;
          }
        }
        // Check tanggal field
        else if (leave.tanggal) {
          if (leave.tanggal instanceof Timestamp) {
            leaveDate = leave.tanggal.toDate();
          } else if (typeof leave.tanggal === 'string') {
            leaveDate = new Date(leave.tanggal);
          } else if (leave.tanggal instanceof Date) {
            leaveDate = leave.tanggal;
          }
        }
        
        // If we have a valid date, check if it's in the target month/year
        if (leaveDate && !isNaN(leaveDate.getTime())) {
          return leaveDate.getMonth() + 1 === month && leaveDate.getFullYear() === year;
        }
        
        // If we have month and year fields, use those
        if (leave.month && leave.year) {
          return leave.month === month && leave.year === year;
        }
        
        return false;
      });
      
      // Sort by submitDate or date
      leaveRequests.sort((a, b) => {
        // Try to use submitDate
        if (a.submitDate && b.submitDate) {
          const dateA = a.submitDate instanceof Timestamp ? a.submitDate.toDate() : new Date(a.submitDate);
          const dateB = b.submitDate instanceof Timestamp ? b.submitDate.toDate() : new Date(b.submitDate);
          return dateB - dateA; // Descending
        }
        // Fall back to leaveDate
        else if (a.leaveDate && b.leaveDate) {
          const dateA = a.leaveDate instanceof Timestamp ? a.leaveDate.toDate() : new Date(a.leaveDate);
          const dateB = b.leaveDate instanceof Timestamp ? b.leaveDate.toDate() : new Date(b.leaveDate);
          return dateB - dateA; // Descending
        }
        return 0;
      });
      
      // Store all results in cache
      leaveMonthCache.set(cacheKey, [...leaveRequests]);
      
      // Apply pagination
      const paginatedResults = leaveRequests.slice(0, itemsPerPage);
      
      return {
        leaveRequests: paginatedResults,
        lastDoc: leaveRequests.length > itemsPerPage ? {} : null, // Dummy lastDoc
        hasMore: leaveRequests.length > itemsPerPage
      };
    } else {
      // Process results from Firestore query
      leaveRequests = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          // Convert Firestore Timestamp to JS Date if needed
          submitDate: data.submitDate instanceof Timestamp ? data.submitDate.toDate() : data.submitDate,
          leaveDate: data.leaveDate instanceof Timestamp ? data.leaveDate.toDate() : data.leaveDate,
          date: data.date instanceof Timestamp ? data.date.toDate() : data.date
        };
      });
    }
    
    console.log(`Found ${leaveRequests.length} leave requests for ${month}/${year}`);
    
    // Determine if there are more records
    const hasMore = leaveRequests.length === itemsPerPage;
    
    // Get the last document for pagination
    const lastVisible = snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : null;
    
    // Store in cache if this is the first page
    if (!lastDoc) {
      leaveMonthCache.set(cacheKey, [...leaveRequests]);
    } else if (leaveMonthCache.has(cacheKey)) {
      // Append to existing cache
      const existingData = leaveMonthCache.get(cacheKey);
      leaveMonthCache.set(cacheKey, [...existingData, ...leaveRequests]);
    }
    
    return {
      leaveRequests,
      lastDoc: lastVisible,
      hasMore
    };
  } catch (error) {
    console.error("Error getting leave requests by month:", error);
    return {
      leaveRequests: [],
      lastDoc: null,
      hasMore: false
    };
  }
}

// Submit new leave request
export async function submitLeaveRequest(leaveData) {
  try {
    // Add timestamps
    leaveData.submitDate = Timestamp.now();
    
    // Ensure status is set to "pending" for new requests
    if (!leaveData.status) {
      leaveData.status = "pending";
    }
    
    // Extract month and year from leaveDate
    if (leaveData.leaveDate) {
      let leaveDate;
      if (typeof leaveData.leaveDate === 'string') {
        leaveDate = new Date(leaveData.leaveDate);
      } else if (leaveData.leaveDate instanceof Date) {
        leaveDate = leaveData.leaveDate;
      } else if (leaveData.leaveDate instanceof Timestamp) {
        leaveDate = leaveData.leaveDate.toDate();
      }
      
      if (leaveDate && !isNaN(leaveDate.getTime())) {
        leaveData.month = leaveDate.getMonth() + 1; // 1-12
        leaveData.year = leaveDate.getFullYear();
      }
    }
    
    const leaveCollection = collection(db, "leaveRequests");
    const docRef = await addDoc(leaveCollection, leaveData);
    
    // Update cache
    if (leaveData.leaveDate) {
      let dateKey;
      if (typeof leaveData.leaveDate === 'string') {
        dateKey = leaveData.leaveDate;
      } else if (leaveData.leaveDate instanceof Date) {
        dateKey = leaveData.leaveDate.toISOString().split('T')[0];
      } else if (leaveData.leaveDate instanceof Timestamp) {
        dateKey = leaveData.leaveDate.toDate().toISOString().split('T')[0];
      }
      
      if (dateKey) {
        if (!leaveCache.has(dateKey)) {
          leaveCache.set(dateKey, []);
        }
        
        const newLeave = {
          id: docRef.id,
          ...leaveData,
          submitDate: leaveData.submitDate instanceof Timestamp ? leaveData.submitDate.toDate() : leaveData.submitDate
        };
        
        leaveCache.get(dateKey).push(newLeave);
      }
      
      // Update month cache if exists
      if (leaveData.month && leaveData.year) {
        const monthKey = `${leaveData.month}_${leaveData.year}`;
        if (leaveMonthCache.has(monthKey)) {
          const newLeave = {
            id: docRef.id,
            ...leaveData,
            submitDate: leaveData.submitDate instanceof Timestamp ? leaveData.submitDate.toDate() : leaveData.submitDate
          };
          
          leaveMonthCache.get(monthKey).unshift(newLeave); // Add to beginning (newest first)
        }
      }
    }
    
    return {
      id: docRef.id,
      ...leaveData
    };
  } catch (error) {
    console.error("Error submitting leave request:", error);
    throw error;
  }
}


// Update leave request status
export async function updateLeaveRequestStatus(id, status, decisionBy) {
  try {
    const leaveRef = doc(db, "leaveRequests", id);
    const docSnap = await getDoc(leaveRef);
    
    if (!docSnap.exists()) {
      throw new Error("Leave request not found");
    }
    
    const updateData = {
      status: status,
      decisionDate: Timestamp.now(),
      decisionBy: decisionBy || "admin"
    };
    
    await updateDoc(leaveRef, updateData);
    
    // Update cache
    const leaveData = docSnap.data();
    let dateKey;
    
    if (leaveData.leaveDate) {
      if (typeof leaveData.leaveDate === 'string') {
        dateKey = leaveData.leaveDate;
      } else if (leaveData.leaveDate instanceof Timestamp) {
        dateKey = leaveData.leaveDate.toDate().toISOString().split('T')[0];
      }
      
      if (dateKey && leaveCache.has(dateKey)) {
        const leaves = leaveCache.get(dateKey);
        const index = leaves.findIndex(leave => leave.id === id);
        
        if (index !== -1) {
          leaves[index] = {
            ...leaves[index],
            ...updateData,
            decisionDate: updateData.decisionDate instanceof Timestamp ? updateData.decisionDate.toDate() : updateData.decisionDate
          };
        }
      }
      
      // Update month cache if exists
      if (leaveData.month && leaveData.year) {
        const monthKey = `${leaveData.month}_${leaveData.year}`;
        if (leaveMonthCache.has(monthKey)) {
          const leaves = leaveMonthCache.get(monthKey);
          const index = leaves.findIndex(leave => leave.id === id);
          
          if (index !== -1) {
            leaves[index] = {
              ...leaves[index],
              ...updateData,
              decisionDate: updateData.decisionDate instanceof Timestamp ? updateData.decisionDate.toDate() : updateData.decisionDate
            };
          }
        }
      }
    }
    
    return {
      id,
      ...updateData
    };
  } catch (error) {
    console.error("Error updating leave request status:", error);
    throw error;
  }
}

// Clear leave cache
export function clearLeaveCache() {
  leaveCache.clear();
  leaveMonthCache.clear();
  console.log("Leave cache cleared");
}

// Helper function to get array of dates in range
function getDatesInRange(startDate, endDate) {
  const dates = [];
  let currentDate = new Date(startDate);
  
  while (currentDate <= endDate) {
    dates.push(new Date(currentDate));
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  return dates;
}

// Get leave request by ID
export async function getLeaveRequestById(id) {
  try {
    // Check if in cache first
    for (const leaves of leaveCache.values()) {
      const found = leaves.find(leave => leave.id === id);
      if (found) {
        console.log("Found leave request in cache");
        return found;
      }
    }
    
    // Check month cache
    for (const leaves of leaveMonthCache.values()) {
      const found = leaves.find(leave => leave.id === id);
      if (found) {
        console.log("Found leave request in month cache");
        return found;
      }
    }
    
    // Not in cache, fetch from Firestore
    const leaveRef = doc(db, "leaveRequests", id);
    const docSnap = await getDoc(leaveRef);
    
    if (!docSnap.exists()) {
      throw new Error("Leave request not found");
    }
    
    const data = docSnap.data();
    
    // Convert Timestamp fields to Date
    const result = {
      id: docSnap.id,
      ...data,
      submitDate: data.submitDate instanceof Timestamp ? data.submitDate.toDate() : data.submitDate,
      decisionDate: data.decisionDate instanceof Timestamp ? data.decisionDate.toDate() : data.decisionDate,
      leaveDate: data.leaveDate instanceof Timestamp ? data.leaveDate.toDate() : data.leaveDate,
      date: data.date instanceof Timestamp ? data.date.toDate() : data.date
    };
    
    // Add to cache if possible
    if (data.leaveDate) {
      let dateKey;
      if (typeof data.leaveDate === 'string') {
        dateKey = data.leaveDate;
      } else if (data.leaveDate instanceof Timestamp) {
        dateKey = data.leaveDate.toDate().toISOString().split('T')[0];
      } else if (data.leaveDate instanceof Date) {
        dateKey = data.leaveDate.toISOString().split('T')[0];
      }
      
      if (dateKey) {
        if (!leaveCache.has(dateKey)) {
          leaveCache.set(dateKey, []);
        }
        
        // Check if already in cache
        const leaves = leaveCache.get(dateKey);
        const index = leaves.findIndex(leave => leave.id === id);
        
        if (index === -1) {
          leaves.push(result);
        } else {
          leaves[index] = result;
        }
      }
    }
    
    return result;
  } catch (error) {
    console.error("Error getting leave request by ID:", error);
    throw error;
  }
}

// Delete leave request
export async function deleteLeaveRequest(id) {
  try {
    // Get the leave request first to update cache
    const leaveRef = doc(db, "leaveRequests", id);
    const docSnap = await getDoc(leaveRef);
    
    if (!docSnap.exists()) {
      throw new Error("Leave request not found");
    }
    
    const leaveData = docSnap.data();
    
    // Delete from Firestore
    await deleteDoc(leaveRef);
    
    // Update cache
    let dateKey;
    if (leaveData.leaveDate) {
      if (typeof leaveData.leaveDate === 'string') {
        dateKey = leaveData.leaveDate;
      } else if (leaveData.leaveDate instanceof Timestamp) {
        dateKey = leaveData.leaveDate.toDate().toISOString().split('T')[0];
      } else if (leaveData.leaveDate instanceof Date) {
        dateKey = leaveData.leaveDate.toISOString().split('T')[0];
      }
      
      if (dateKey && leaveCache.has(dateKey)) {
        const leaves = leaveCache.get(dateKey);
        const filteredLeaves = leaves.filter(leave => leave.id !== id);
        leaveCache.set(dateKey, filteredLeaves);
      }
      
      // Update month cache if exists
      if (leaveData.month && leaveData.year) {
        const monthKey = `${leaveData.month}_${leaveData.year}`;
        if (leaveMonthCache.has(monthKey)) {
          const leaves = leaveMonthCache.get(monthKey);
          const filteredLeaves = leaves.filter(leave => leave.id !== id);
          leaveMonthCache.set(monthKey, filteredLeaves);
        }
      }
    }
    
    return { id, success: true };
  } catch (error) {
    console.error("Error deleting leave request:", error);
    throw error;
  }
}

// Get pending leave requests
export async function getPendingLeaveRequests() {
  try {
    const leaveCollection = collection(db, "leaveRequests");
    
    // First try with exact "pending" status
    let q = query(
      leaveCollection,
      where("status", "in", ["pending", "Pending"]),
      orderBy("submitDate", "desc")
    );
    
    let snapshot = await getDocs(q);
    
    // If no results, try with null or undefined status
    if (snapshot.empty) {
      // Get all requests
      q = query(
        leaveCollection,
        orderBy("submitDate", "desc")
      );
      
      const allSnapshot = await getDocs(q);
      
      // Filter for those with null, undefined, or empty status
      const pendingDocs = allSnapshot.docs.filter(doc => {
        const data = doc.data();
        return !data.status || data.status === "" || 
               data.status.toLowerCase() === "pending" ||
               data.status.toLowerCase() === "menunggu";
      });
      
      // Convert to the same format as getDocs result
      return pendingDocs.map(doc => {
        const data = doc.data();
        
        // Check if it's a multi-day leave request
        const isMultiDay = data.leaveStartDate && data.leaveEndDate && 
                          data.leaveStartDate !== data.leaveEndDate;
        
        // For multi-day requests, ensure we have the proper date format
        if (isMultiDay) {
          // Make sure we have leaveDate for compatibility
          if (!data.leaveDate) {
            data.leaveDate = data.leaveStartDate;
          }
        }
        
        return {
          id: doc.id,
          ...data,
          // Convert Firestore Timestamp to JS Date
          submitDate: data.submitDate instanceof Timestamp ? data.submitDate.toDate() : data.submitDate,
          leaveDate: data.leaveDate instanceof Timestamp ? data.leaveDate.toDate() : data.leaveDate,
          date: data.date instanceof Timestamp ? data.date.toDate() : data.date,
          leaveStartDate: data.leaveStartDate instanceof Timestamp ? data.leaveStartDate.toDate() : data.leaveStartDate,
          leaveEndDate: data.leaveEndDate instanceof Timestamp ? data.leaveEndDate.toDate() : data.leaveEndDate
        };
      });
    }
    
    return snapshot.docs.map(doc => {
      const data = doc.data();
      
      // Check if it's a multi-day leave request
      const isMultiDay = data.leaveStartDate && data.leaveEndDate && 
                        data.leaveStartDate !== data.leaveEndDate;
      
      // For multi-day requests, ensure we have the proper date format
      if (isMultiDay) {
        // Make sure we have leaveDate for compatibility
        if (!data.leaveDate) {
          data.leaveDate = data.leaveStartDate;
        }
      }
      
      return {
        id: doc.id,
        ...data,
        // Convert Firestore Timestamp to JS Date
        submitDate: data.submitDate instanceof Timestamp ? data.submitDate.toDate() : data.submitDate,
        leaveDate: data.leaveDate instanceof Timestamp ? data.leaveDate.toDate() : data.leaveDate,
        date: data.date instanceof Timestamp ? data.date.toDate() : data.date,
        leaveStartDate: data.leaveStartDate instanceof Timestamp ? data.leaveStartDate.toDate() : data.leaveStartDate,
        leaveEndDate: data.leaveEndDate instanceof Timestamp ? data.leaveEndDate.toDate() : data.leaveEndDate
      };
    });
  } catch (error) {
    console.error("Error getting pending leave requests:", error);
    throw error;
  }
}



// Get leave requests by employee
export async function getLeaveRequestsByEmployee(employeeId) {
  try {
    const leaveCollection = collection(db, "leaveRequests");
    const q = query(
      leaveCollection,
      where("employeeId", "==", employeeId),
      orderBy("submitDate", "desc")
    );
    
    const snapshot = await getDocs(q);
    
    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        // Convert Firestore Timestamp to JS Date
        submitDate: data.submitDate instanceof Timestamp ? data.submitDate.toDate() : data.submitDate,
        leaveDate: data.leaveDate instanceof Timestamp ? data.leaveDate.toDate() : data.leaveDate,
        date: data.date instanceof Timestamp ? data.date.toDate() : data.date,
        decisionDate: data.decisionDate instanceof Timestamp ? data.decisionDate.toDate() : data.decisionDate
      };
    });
  } catch (error) {
    console.error("Error getting leave requests by employee:", error);
    throw error;
  }
}

// Inspect leave collection structure (for debugging)
export async function inspectLeaveCollection() {
  try {
    const leaveCollection = collection(db, "leaveRequests");
    const snapshot = await getDocs(leaveCollection);
    
    console.log(`Found ${snapshot.docs.length} documents in leaveRequests collection`);
    
    if (snapshot.docs.length > 0) {
      const sampleDoc = snapshot.docs[0].data();
      console.log("Sample document structure:", sampleDoc);
      
      // Log all fields and their types
      console.log("Fields and their types:");
      Object.entries(sampleDoc).forEach(([key, value]) => {
        console.log(`${key}: ${typeof value} ${value instanceof Timestamp ? '(Timestamp)' : ''}`);
      });
    } else {
      console.log("No documents found in leaveRequests collection");
    }
    
    return snapshot.docs.length;
  } catch (error) {
    console.error("Error inspecting leave collection:", error);
    return 0;
  }
}

// Delete leave requests by month
export async function deleteLeaveRequestsByMonth(month, year) {
  try {
    const leaveCollection = collection(db, "leaveRequests");
    
    // Try with month and year fields
    let q = query(
      leaveCollection,
      where("month", "==", month),
      where("year", "==", year)
    );
    
    let snapshot = await getDocs(q);
    
    // If no results, try with date range
    if (snapshot.empty) {
      // Calculate start and end dates for the month
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0); // Last day of month
      
      // Convert to strings in YYYY-MM-DD format
      const startDateStr = startDate.toISOString().split('T')[0];
      const endDateStr = endDate.toISOString().split('T')[0];
      
      // Try with leaveDate field
      q = query(
        leaveCollection,
        where("leaveDate", ">=", startDateStr),
        where("leaveDate", "<=", endDateStr)
      );
      
      snapshot = await getDocs(q);
      
      // If still no results, try with date field
      if (snapshot.empty) {
        q = query(
          leaveCollection,
          where("date", ">=", startDateStr),
          where("date", "<=", endDateStr)
        );
        
        snapshot = await getDocs(q);
      }
    }
    
    // Delete each document
    const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
    await Promise.all(deletePromises);
    
    // Clear cache
    clearLeaveCache();
    
    return snapshot.docs.length; // Return number of deleted records
  } catch (error) {
    console.error("Error deleting leave requests by month:", error);
    throw error;
  }
}
// Get all leave requests
export async function getAllLeaveRequests() {
  try {
    console.log("Fetching all leave requests");
    
    const leaveCollection = collection(db, "leaveRequests");
    const q = query(
      leaveCollection,
      orderBy("submitDate", "desc")
    );
    
    const snapshot = await getDocs(q);
    
    const leaveRequests = snapshot.docs.map(doc => {
      const data = doc.data();
      
      // Ensure status is set
      if (!data.status) {
        data.status = "Pending";
      }
      
      // Check if it's a multi-day leave request
      const isMultiDay = data.leaveStartDate && data.leaveEndDate && 
                        data.leaveStartDate !== data.leaveEndDate;
      
      // For multi-day requests, ensure we have the proper date format
      if (isMultiDay) {
        // Make sure we have leaveDate for compatibility
        if (!data.leaveDate) {
          data.leaveDate = data.leaveStartDate;
        }
      }
      
      return {
        id: doc.id,
        ...data,
        // Convert Firestore Timestamp to JS Date
        submitDate: data.submitDate instanceof Timestamp ? data.submitDate.toDate() : data.submitDate,
        leaveDate: data.leaveDate instanceof Timestamp ? data.leaveDate.toDate() : data.leaveDate,
        date: data.date instanceof Timestamp ? data.date.toDate() : data.date,
        decisionDate: data.decisionDate instanceof Timestamp ? data.decisionDate.toDate() : data.decisionDate,
        leaveStartDate: data.leaveStartDate instanceof Timestamp ? data.leaveStartDate.toDate() : data.leaveStartDate,
        leaveEndDate: data.leaveEndDate instanceof Timestamp ? data.leaveEndDate.toDate() : data.leaveEndDate
      };
    });
    
    console.log(`Retrieved ${leaveRequests.length} leave requests`);
    return leaveRequests;
  } catch (error) {
    console.error("Error getting all leave requests:", error);
    return [];
  }
}


// Update replacement status
export async function updateReplacementStatus(id, status, dayIndex = null) {
  try {
    const leaveRef = doc(db, "leaveRequests", id);
    const docSnap = await getDoc(leaveRef);
    
    if (!docSnap.exists()) {
      throw new Error("Leave request not found");
    }
    
    const leaveData = docSnap.data();
    
    // Check if it's a multi-day leave request
    const isMultiDay = leaveData.leaveStartDate && leaveData.leaveEndDate && 
                      leaveData.leaveStartDate !== leaveData.leaveEndDate;
    
    let updateData = {};
    
    if (isMultiDay && dayIndex !== null) {
      // For multi-day leave, update specific day's status
      let startDate, endDate;
      
      if (leaveData.leaveStartDate instanceof Timestamp) {
        startDate = leaveData.leaveStartDate.toDate();
      } else if (typeof leaveData.leaveStartDate === 'string') {
        startDate = new Date(leaveData.leaveStartDate);
      } else {
        startDate = leaveData.leaveStartDate;
      }
      
      if (leaveData.leaveEndDate instanceof Timestamp) {
        endDate = leaveData.leaveEndDate.toDate();
      } else if (typeof leaveData.leaveEndDate === 'string') {
        endDate = new Date(leaveData.leaveEndDate);
      } else {
        endDate = leaveData.leaveEndDate;
      }
      
      const dayDiff = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
      
      // Initialize or get existing replacementStatusArray
      let replacementStatusArray = leaveData.replacementStatusArray || Array(dayDiff).fill("Belum Diganti");
      
      // Make a copy to avoid modifying the original
      replacementStatusArray = [...replacementStatusArray];
      
      // Update the status for the specific day
      if (dayIndex >= 0 && dayIndex < replacementStatusArray.length) {
        replacementStatusArray[dayIndex] = status;
      }
      
      updateData = {
        replacementStatusArray: replacementStatusArray,
        // Also update the main replacementStatus based on whether all days are replaced
        replacementStatus: replacementStatusArray.every(s => s === "Sudah Diganti") ? "Sudah Diganti" : "Belum Diganti"
      };
    } else {
      // For single-day leave or updating all days at once
      updateData = {
        replacementStatus: status
      };
      
      // If it's multi-day but no specific day index, update all days
      if (isMultiDay) {
        let startDate, endDate;
        
        if (leaveData.leaveStartDate instanceof Timestamp) {
          startDate = leaveData.leaveStartDate.toDate();
        } else if (typeof leaveData.leaveStartDate === 'string') {
          startDate = new Date(leaveData.leaveStartDate);
        } else {
          startDate = leaveData.leaveStartDate;
        }
        
        if (leaveData.leaveEndDate instanceof Timestamp) {
          endDate = leaveData.leaveEndDate.toDate();
        } else if (typeof leaveData.leaveEndDate === 'string') {
          endDate = new Date(leaveData.leaveEndDate);
        } else {
          endDate = leaveData.leaveEndDate;
        }
        
        const dayDiff = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
        
        // Set all days to the same status
        updateData.replacementStatusArray = Array(dayDiff).fill(status);
      }
    }
    
    await updateDoc(leaveRef, updateData);
    
    // Update cache
    let dateKey;
    if (leaveData.leaveDate) {
      if (typeof leaveData.leaveDate === 'string') {
        dateKey = leaveData.leaveDate;
      } else if (leaveData.leaveDate instanceof Timestamp) {
        dateKey = leaveData.leaveDate.toDate().toISOString().split('T')[0];
      } else if (leaveData.leaveDate instanceof Date) {
        dateKey = leaveData.leaveDate.toISOString().split('T')[0];
      }
      
      if (dateKey && leaveCache.has(dateKey)) {
        const leaves = leaveCache.get(dateKey);
        const index = leaves.findIndex(leave => leave.id === id);
        
        if (index !== -1) {
          leaves[index] = {
            ...leaves[index],
            ...updateData
          };
        }
      }
      
      // Update month cache if exists
      if (leaveData.month && leaveData.year) {
        const monthKey = `${leaveData.month}_${leaveData.year}`;
        if (leaveMonthCache.has(monthKey)) {
          const leaves = leaveMonthCache.get(monthKey);
          const index = leaves.findIndex(leave => leave.id === id);
          
          if (index !== -1) {
            leaves[index] = {
              ...leaves[index],
              ...updateData
            };
          }
        }
      }
    }
    
    return {
      id,
      ...updateData
    };
  } catch (error) {
    console.error("Error updating replacement status:", error);
    throw error;
  }
}


// Export all necessary functions and objects
export {
  leaveMonthCache
};


