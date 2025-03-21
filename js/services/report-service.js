import { db } from "../configFirebase.js";
import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  Timestamp,
  deleteDoc,
  doc,
  writeBatch,
} from "https://www.gstatic.com/firebasejs/10.4.0/firebase-firestore.js";

// Get leave requests by month and year
export async function getLeaveRequestsByMonth(month, year) {
  try {
    // Create date range for the specified month
    const startDate = new Date(year, month - 1, 1); // Month is 0-indexed in JS Date
    const endDate = new Date(year, month, 0); // Last day of the month

    // Convert to Firestore Timestamp
    const startTimestamp = Timestamp.fromDate(startDate);
    const endTimestamp = Timestamp.fromDate(endDate);

    const leaveCollection = collection(db, "leaveRequests");

    // Query using submitDate field
    const q = query(
      leaveCollection,
      where("submitDate", ">=", startTimestamp),
      where("submitDate", "<=", endTimestamp),
      orderBy("submitDate", "desc")
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      // Convert Firestore Timestamp to JS Date
      submitDate: doc.data().submitDate.toDate(),
      decisionDate: doc.data().decisionDate ? doc.data().decisionDate.toDate() : null,
      replacementStatusDate: doc.data().replacementStatusDate ? new Date(doc.data().replacementStatusDate) : null,
    }));
  } catch (error) {
    console.error("Error getting leave requests by month:", error);
    throw error;
  }
}

// Delete leave requests by month and year
export async function deleteLeaveRequestsByMonth(month, year) {
  try {
    // Create date range for the specified month
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    // Convert to Firestore Timestamp
    const startTimestamp = Timestamp.fromDate(startDate);
    const endTimestamp = Timestamp.fromDate(endDate);

    const leaveCollection = collection(db, "leaveRequests");

    // Query using submitDate field
    const q = query(
      leaveCollection,
      where("submitDate", ">=", startTimestamp),
      where("submitDate", "<=", endTimestamp)
    );

    const snapshot = await getDocs(q);

    // Use batch to delete multiple documents
    const batch = writeBatch(db);
    snapshot.docs.forEach((document) => {
      batch.delete(doc(db, "leaveRequests", document.id));
    });

    await batch.commit();
    return snapshot.docs.length; // Return number of deleted documents
  } catch (error) {
    console.error("Error deleting leave requests by month:", error);
    throw error;
  }
}
