import { db } from './configFirebase.js';
import { 
  collection, 
  addDoc, 
  getDocs, 
  doc, 
  updateDoc, 
  query, 
  where, 
  orderBy,
  Timestamp 
} from "https://www.gstatic.com/firebasejs/10.4.0/firebase-firestore.js";

// Submit leave request
export async function submitLeaveRequest(leaveRequest) {
  try {
    // Add timestamps and default values
    leaveRequest.submitDate = Timestamp.now();
    leaveRequest.status = 'Pending';
    leaveRequest.replacementStatus = 'Belum Diganti';
    
    const leaveCollection = collection(db, "leaveRequests");
    const docRef = await addDoc(leaveCollection, leaveRequest);
    return { id: docRef.id, ...leaveRequest };
  } catch (error) {
    console.error("Error submitting leave request:", error);
    throw error;
  }
}

// Get all leave requests
export async function getAllLeaveRequests() {
  try {
    const leaveCollection = collection(db, "leaveRequests");
    const q = query(leaveCollection, orderBy("submitDate", "desc"));
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      // Convert Firestore Timestamp to JS Date
      submitDate: doc.data().submitDate.toDate(),
      decisionDate: doc.data().decisionDate ? doc.data().decisionDate.toDate() : null,
      replacementStatusDate: doc.data().replacementStatusDate ? doc.data().replacementStatusDate.toDate() : null
    }));
  } catch (error) {
    console.error("Error getting leave requests:", error);
    throw error;
  }
}

// Get pending leave requests
export async function getPendingLeaveRequests() {
  try {
    const leaveCollection = collection(db, 'leaveRequests');
    const q = query(
      leaveCollection, 
      where('status', '==', 'Pending'), 
      orderBy('submitDate', 'desc')
    );
    
    const querySnapshot = await getDocs(q);
    
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      // Convert Firestore Timestamp to JS Date
      submitDate: doc.data().submitDate.toDate()
    }));
  } catch (error) {
    console.error("Error getting pending leave requests:", error);
    throw error;
  }
}

// Get leave requests by employee
export async function getLeaveRequestsByEmployee(employeeId) {
  try {
    const leaveCollection = collection(db, 'leaveRequests');
    const q = query(
      leaveCollection, 
      where('employeeId', '==', employeeId), 
      orderBy('submitDate', 'desc')
    );
    
    const querySnapshot = await getDocs(q);
    
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      // Convert Firestore Timestamp to JS Date
      submitDate: doc.data().submitDate.toDate(),
      decisionDate: doc.data().decisionDate ? doc.data().decisionDate.toDate() : null,
      replacementStatusDate: doc.data().replacementStatusDate ? doc.data().replacementStatusDate.toDate() : null
    }));
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
      decisionDate: Timestamp.now()
    });
    return true;
  } catch (error) {
    console.error("Error updating leave request status:", error);
    throw error;
  }
}

// Update replacement status
export async function updateReplacementStatus(id, status) {
  try {
    const leaveRef = doc(db, 'leaveRequests', id);
    
    await updateDoc(leaveRef, {
      replacementStatus: status,
      replacementStatusDate: Timestamp.now()
    });
    
    return true;
  } catch (error) {
    console.error("Error updating replacement status:", error);
    throw error;
  }
}

// Get leave requests by date range
export async function getLeaveRequestsByDateRange(startDate, endDate) {
  try {
    const leaveCollection = collection(db, 'leaveRequests');
    const q = query(
      leaveCollection,
      where('rawLeaveDate', '>=', startDate),
      where('rawLeaveDate', '<=', endDate),
      orderBy('rawLeaveDate', 'desc'),
      orderBy('submitDate', 'desc')
    );
    
    const querySnapshot = await getDocs(q);
    
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      // Convert Firestore Timestamp to JS Date
      submitDate: doc.data().submitDate.toDate(),
      decisionDate: doc.data().decisionDate ? doc.data().decisionDate.toDate() : null,
      replacementStatusDate: doc.data().replacementStatusDate ? doc.data().replacementStatusDate.toDate() : null
    }));
  } catch (error) {
    console.error("Error getting leave requests by date range:", error);
    throw error;
  }
}

// Get approved leave requests for today
export async function getTodayApprovedLeaves() {
  try {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    
    const leaveCollection = collection(db, 'leaveRequests');
    const q = query(
      leaveCollection,
      where('rawLeaveDate', '==', today),
      where('status', '==', 'Disetujui')
    );
    
    const querySnapshot = await getDocs(q);
    
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      // Convert Firestore Timestamp to JS Date
      submitDate: doc.data().submitDate.toDate(),
      decisionDate: doc.data().decisionDate ? doc.data().decisionDate.toDate() : null
    }));
  } catch (error) {
    console.error("Error getting today's approved leaves:", error);
    throw error;
  }
}

