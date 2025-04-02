import { db } from "../configFirebase.js";
import {
  collection,
  query,
  where,
  getDocs,
  writeBatch,
  limit,
} from "https://www.gstatic.com/firebasejs/10.4.0/firebase-firestore.js";

// Delete leave requests by month
export async function deleteLeaveRequestsByMonth(month, year) {
  try {
    const leaveCollection = collection(db, "leaveRequests");

    // Create query for the specific month and year
    const q = query(
      leaveCollection, 
      where("month", "==", month), 
      where("year", "==", year)
    );

    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return 0;
    }

    // Use batched writes for efficient deletion
    const batchSize = 500; // Firestore batch limit is 500
    let deletedCount = 0;
    const totalDocs = snapshot.docs.length;

    // Process in batches if needed
    for (let i = 0; i < totalDocs; i += batchSize) {
      const batch = writeBatch(db);
      const currentBatch = snapshot.docs.slice(i, i + batchSize);

      currentBatch.forEach((doc) => {
        batch.delete(doc.ref);
        deletedCount++;
      });

      await batch.commit();
    }

    return deletedCount;
  } catch (error) {
    console.error("Error deleting leave requests by month:", error);
    throw error;
  }
}
