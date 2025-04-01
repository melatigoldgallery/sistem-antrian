import { db } from "../configFirebase.js";
import {
  collection,
  addDoc,
  getDocs,
  doc,
  updateDoc,
  query,
  where,
  orderBy,
  Timestamp,
  limit,
  startAfter,
} from "https://www.gstatic.com/firebasejs/10.4.0/firebase-firestore.js";

// Cache untuk menyimpan data yang sudah diambil
const leaveRequestsCache = {
  byMonth: {},
  byEmployee: {},
  byDateRange: {},
  lastFetch: null,
  cacheDuration: 5 * 60 * 1000, // 5 menit dalam milidetik
};

// Submit leave request
export async function submitLeaveRequest(leaveRequest) {
  try {
    // Add timestamps and default values
    leaveRequest.submitDate = Timestamp.now();
    leaveRequest.status = "Pending";
    leaveRequest.replacementStatus = "Belum Diganti";
    
    // Tambahkan field untuk memudahkan query bulanan
    const submitDate = new Date();
    leaveRequest.month = submitDate.getMonth() + 1;
    leaveRequest.year = submitDate.getFullYear();
    
    // Tambahkan rawLeaveDate untuk memudahkan query
    if (!leaveRequest.rawLeaveDate && leaveRequest.leaveDate) {
      const dateParts = leaveRequest.leaveDate.split('/');
      if (dateParts.length === 3) {
        leaveRequest.rawLeaveDate = `${dateParts[2]}-${dateParts[1]}-${dateParts[0]}`;
      }
    }

    const leaveCollection = collection(db, "leaveRequests");
    const docRef = await addDoc(leaveCollection, leaveRequest);
    
    // Invalidate cache for the current month
    const cacheKey = `${leaveRequest.month}-${leaveRequest.year}`;
    if (leaveRequestsCache.byMonth[cacheKey]) {
      delete leaveRequestsCache.byMonth[cacheKey];
    }
    
    return { id: docRef.id, ...leaveRequest };
  } catch (error) {
    console.error("Error submitting leave request:", error);
    throw error;
  }
}

// Get leave requests by month with pagination
export async function getLeaveRequestsByMonth(month, year, lastDoc = null, itemsPerPage = 50) {
  try {
    const cacheKey = `${month}-${year}`;
    
    // Check if we have valid cached data
    if (
      leaveRequestsCache.byMonth[cacheKey] && 
      leaveRequestsCache.lastFetch && 
      (Date.now() - leaveRequestsCache.lastFetch) < leaveRequestsCache.cacheDuration
    ) {
      console.log("Using cached data for month:", month, year);
      return leaveRequestsCache.byMonth[cacheKey];
    }
    
    const leaveCollection = collection(db, "leaveRequests");
    let q;
    
    if (lastDoc) {
      // Pagination query
      q = query(
        leaveCollection,
        where("month", "==", month),
        where("year", "==", year),
        orderBy("submitDate", "desc"),
        startAfter(lastDoc),
        limit(itemsPerPage)
      );
    } else {
      // Initial query
      q = query(
        leaveCollection,
        where("month", "==", month),
        where("year", "==", year),
        orderBy("submitDate", "desc"),
        limit(itemsPerPage)
      );
    }

    const snapshot = await getDocs(q);
    const lastVisible = snapshot.docs[snapshot.docs.length - 1];
    
    const leaveRequests = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      // Convert Firestore Timestamp to JS Date
      submitDate: doc.data().submitDate.toDate(),
      decisionDate: doc.data().decisionDate ? doc.data().decisionDate.toDate() : null,
      replacementStatusDate: doc.data().replacementStatusDate ? doc.data().replacementStatusDate.toDate() : null,
    }));
    
    // Cache the results
    leaveRequestsCache.byMonth[cacheKey] = leaveRequests;
    leaveRequestsCache.lastFetch = Date.now();
    
    return {
      leaveRequests,
      lastDoc: lastVisible,
      hasMore: snapshot.docs.length === itemsPerPage
    };
  } catch (error) {
    console.error("Error getting leave requests by month:", error);
    throw error;
  }
}

// Get all leave requests - DEPRECATED, use paginated version instead
export async function getAllLeaveRequests() {
  console.warn("getAllLeaveRequests is deprecated. Use getLeaveRequestsByMonth with pagination instead.");
  try {
    const leaveCollection = collection(db, "leaveRequests");
    const q = query(leaveCollection, orderBy("submitDate", "desc"), limit(100));

    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      // Convert Firestore Timestamp to JS Date
      submitDate: doc.data().submitDate.toDate(),
      decisionDate: doc.data().decisionDate ? doc.data().decisionDate.toDate() : null,
      replacementStatusDate: doc.data().replacementStatusDate ? doc.data().replacementStatusDate.toDate() : null,
    }));
  } catch (error) {
    console.error("Error getting leave requests:", error);
    throw error;
  }
}

// Get pending leave requests
export async function getPendingLeaveRequests(itemsPerPage = 20) {
  try {
    const leaveCollection = collection(db, "leaveRequests");
    const q = query(
      leaveCollection, 
      where("status", "==", "Pending"), 
      orderBy("submitDate", "desc"),
      limit(itemsPerPage)
    );

    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      // Convert Firestore Timestamp to JS Date
      submitDate: doc.data().submitDate.toDate(),
    }));
  } catch (error) {
    console.error("Error getting pending leave requests:", error);
    throw error;
  }
}

// Get leave requests by employee
export async function getLeaveRequestsByEmployee(employeeId, itemsPerPage = 20) {
  try {
    // Check cache first
    if (
      leaveRequestsCache.byEmployee[employeeId] && 
      leaveRequestsCache.lastFetch && 
      (Date.now() - leaveRequestsCache.lastFetch) < leaveRequestsCache.cacheDuration
    ) {
      return leaveRequestsCache.byEmployee[employeeId];
    }
    
    const leaveCollection = collection(db, "leaveRequests");
    const q = query(
      leaveCollection, 
      where("employeeId", "==", employeeId), 
      orderBy("submitDate", "desc"),
      limit(itemsPerPage)
    );

    const querySnapshot = await getDocs(q);

    const results = querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      // Convert Firestore Timestamp to JS Date
      submitDate: doc.data().submitDate.toDate(),
      decisionDate: doc.data().decisionDate ? doc.data().decisionDate.toDate() : null,
      replacementStatusDate: doc.data().replacementStatusDate ? doc.data().replacementStatusDate.toDate() : null,
    }));
    
    // Cache the results
    leaveRequestsCache.byEmployee[employeeId] = results;
    
    return results;
  } catch (error) {
    console.error("Error getting leave requests by employee:", error);
    throw error;
  }
}

// Update leave request status
export async function updateLeaveRequestStatus(id, status) {
  try {
    const leaveDoc = doc(db, "leaveRequests", id);
    await updateDoc(leaveDoc, {
      status: status,
      decisionDate: Timestamp.now(),
    });
    
    // Invalidate caches since data has changed
    leaveRequestsCache.byMonth = {};
    leaveRequestsCache.byEmployee = {};
    leaveRequestsCache.byDateRange = {};
    
    return true;
  } catch (error) {
    console.error("Error updating leave request status:", error);
    throw error;
  }
}

// Update replacement status
export async function updateReplacementStatus(id, status) {
  try {
    const leaveRef = doc(db, "leaveRequests", id);

    await updateDoc(leaveRef, {
      replacementStatus: status,
      replacementStatusDate: Timestamp.now(),
    });

    // Invalidate caches since data has changed
    leaveRequestsCache.byMonth = {};
    leaveRequestsCache.byEmployee = {};
    leaveRequestsCache.byDateRange = {};
    
    return true;
  } catch (error) {
    console.error("Error updating replacement status:", error);
    throw error;
  }
}

// Get leave requests by date range
export async function getLeaveRequestsByDateRange(startDate, endDate, itemsPerPage = 50) {
  try {
    const cacheKey = `${startDate}-${endDate}`;
    
    // Check cache first
    if (
      leaveRequestsCache.byDateRange[cacheKey] && 
      leaveRequestsCache.lastFetch && 
      (Date.now() - leaveRequestsCache.lastFetch) < leaveRequestsCache.cacheDuration
    ) {
      return leaveRequestsCache.byDateRange[cacheKey];
    }
    
    const leaveCollection = collection(db, "leaveRequests");
    const q = query(
      leaveCollection,
      where("rawLeaveDate", ">=", startDate),
      where("rawLeaveDate", "<=", endDate),
      orderBy("rawLeaveDate", "desc"),
      limit(itemsPerPage)
    );

    const querySnapshot = await getDocs(q);

    const results = querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      // Convert Firestore Timestamp to JS Date
      submitDate: doc.data().submitDate.toDate(),
      decisionDate: doc.data().decisionDate ? doc.data().decisionDate.toDate() : null,
      replacementStatusDate: doc.data().replacementStatusDate ? doc.data().replacementStatusDate.toDate() : null,
    }));
    
    // Cache the results
    leaveRequestsCache.byDateRange[cacheKey] = results;
    leaveRequestsCache.lastFetch = Date.now();
    
    return results;
  } catch (error) {
    console.error("Error getting leave requests by date range:", error);
    throw error;
  }
}

// Get approved leave requests for today
export async function getTodayApprovedLeaves() {
  try {
    const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD format

    const leaveCollection = collection(db, "leaveRequests");
    const q = query(
      leaveCollection, 
      where("rawLeaveDate", "==", today), 
      where("status", "==", "Disetujui"),
      limit(50)
    );

    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      // Convert Firestore Timestamp to JS Date
      submitDate: doc.data().submitDate.toDate(),
      decisionDate: doc.data().decisionDate ? doc.data().decisionDate.toDate() : null,
    }));
  } catch (error) {
    console.error("Error getting today's approved leaves:", error);
    throw error;
  }
}

// Clear cache manually if needed
export function clearLeaveRequestsCache() {
  leaveRequestsCache.byMonth = {};
  leaveRequestsCache.byEmployee = {};
  leaveRequestsCache.byDateRange = {};
  leaveRequestsCache.lastFetch = null;
  console.log("Leave requests cache cleared");
}
