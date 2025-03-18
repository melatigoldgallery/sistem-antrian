import { db } from './configFirebase.js';
import { 
  collection, 
  addDoc, 
  getDocs, 
  doc, 
  deleteDoc, 
  query, 
  where 
} from "https://www.gstatic.com/firebasejs/10.4.0/firebase-firestore.js";

// Get all employees
export async function getEmployees() {
  try {
    const employeesCollection = collection(db, "employees");
    const snapshot = await getDocs(employeesCollection);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error("Error getting employees:", error);
    throw error;
  }
}

// Add new employee
export async function addEmployee(employee) {
  try {
    const employeesCollection = collection(db, "employees");
    const docRef = await addDoc(employeesCollection, employee);
    return { id: docRef.id, ...employee };
  } catch (error) {
    console.error("Error adding employee:", error);
    throw error;
  }
}

// Delete employee
export async function deleteEmployee(id) {
  try {
    await deleteDoc(doc(db, "employees", id));
    return true;
  } catch (error) {
    console.error("Error deleting employee:", error);
    throw error;
  }
}

// Find employee by barcode
export async function findEmployeeByBarcode(barcode) {
  try {
    const employeesCollection = collection(db, "employees");
    const q = query(employeesCollection, where("barcode", "==", barcode));
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
      return null;
    }
    
    const doc = snapshot.docs[0];
    return {
      id: doc.id,
      ...doc.data()
    };
  } catch (error) {
    console.error("Error! Barcode Karyawan Tidak Ada atau Tidak Ditemukan:", error);
    throw error;
  }
}
