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
import { attendanceCache } from "./attendance-service.js";

// Get attendance by date range with pagination
export async function getAttendanceByDateRange(startDate, endDate, lastDoc = null, itemsPerPage = 20) {
  try {
    console.log("Fetching attendance for date range:", startDate, "to", endDate);
    
    const attendanceCollection = collection(db, "attendance");
    let q;
    
    if (lastDoc) {
      q = query(
        attendanceCollection,
        where("date", ">=", startDate),
        where("date", "<=", endDate),
        orderBy("date", "desc"),
        orderBy("timeIn", "desc"),
        startAfter(lastDoc),
        limit(itemsPerPage)
      );
    } else {
      q = query(
        attendanceCollection,
        where("date", ">=", startDate),
        where("date", "<=", endDate),
        orderBy("date", "desc"),
        orderBy("timeIn", "desc"),
        limit(itemsPerPage)
      );
    }

    const snapshot = await getDocs(q);
    
    console.log(`Found ${snapshot.docs.length} attendance records`);
    
    const attendanceRecords = snapshot.docs.map((doc) => {
      const data = doc.data();
      
      // Log data untuk debugging
      console.log("Raw record data:", {
        id: doc.id,
        date: data.date,
        timeIn: data.timeIn ? data.timeIn.toDate() : null
      });
      
      // Pastikan tanggal yang digunakan adalah tanggal dari Firestore
      // JANGAN mengubah format tanggal di sini
      return {
        id: doc.id,
        ...data,
        // Convert Firestore Timestamp to JS Date
        timeIn: data.timeIn ? data.timeIn.toDate() : null,
        timeOut: data.timeOut ? data.timeOut.toDate() : null,
      };
    });
    
    // Determine if there are more records
    const hasMore = attendanceRecords.length === itemsPerPage;
    
    // Get the last document for pagination
    const lastVisible = snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : null;
    
    return {
      attendanceRecords,
      lastDoc: lastVisible,
      hasMore
    };
  } catch (error) {
    console.error("Error getting attendance by date range:", error);
    throw error;
  }
}


// Delete attendance by date range
export async function deleteAttendanceByDateRange(startDate, endDate) {
  try {
    console.log(`Deleting attendance records from ${startDate} to ${endDate}`);
    
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
    
    return snapshot.docs.length; // Return number of deleted records
  } catch (error) {
    console.error("Error deleting attendance by date range:", error);
    throw error;
  }
}

   
   // Get leave requests by month with pagination
   export async function getLeaveRequestsByMonth(month, year, lastDoc = null, itemsPerPage = 20) {
     try {
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
       throw error;
     }
   }
   
   // Delete leave requests by month
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
       const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
       await Promise.all(deletePromises);
       
       return snapshot.docs.length; // Return number of deleted records
     } catch (error) {
       console.error("Error deleting leave requests by month:", error);
       throw error;
     }
   }
   