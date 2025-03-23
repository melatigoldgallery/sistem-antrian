import { db } from "../configFirebase.js";
import {
  collection,
  addDoc,
  getDocs,
  doc,
  deleteDoc,
  updateDoc,
  query,
  where,
} from "https://www.gstatic.com/firebasejs/10.4.0/firebase-firestore.js";

// Get all employees
export async function getEmployees() {
  try {
    const employeesCollection = collection(db, "employees");
    const snapshot = await getDocs(employeesCollection);
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
  } catch (error) {
    console.error("Error getting employees:", error);
    throw error;
  }
}

// Add new employee
export async function addEmployee(employee) {
  try {
    // Check if employee ID already exists
    const employeesCollection = collection(db, "employees");
    const q = query(employeesCollection, where("employeeId", "==", employee.employeeId));
    const snapshot = await getDocs(q);
    
    if (!snapshot.empty) {
      throw new Error("ID Karyawan sudah digunakan!");
    }
    
    // Check if barcode already exists
    const barcodeQuery = query(employeesCollection, where("barcode", "==", employee.barcode));
    const barcodeSnapshot = await getDocs(barcodeQuery);
    
    if (!barcodeSnapshot.empty) {
      throw new Error("Barcode sudah digunakan!");
    }
    
    // Add timestamp
    employee.createdAt = new Date();
    
    const docRef = await addDoc(employeesCollection, employee);
    return { id: docRef.id, ...employee };
  } catch (error) {
    console.error("Error adding employee:", error);
    throw error;
  }
}
// Fungsi untuk mendapatkan ID karyawan berikutnya
export async function getNextEmployeeId() {
  try {
    const employeesCollection = collection(db, "employees");
    const snapshot = await getDocs(employeesCollection);
    
    // Jika belum ada karyawan, mulai dari ID awal
    if (snapshot.empty) {
      return "EMP001";
    }
    
    // Cari ID karyawan terbesar
    let maxId = 0;
    snapshot.docs.forEach(doc => {
      const employeeId = doc.data().employeeId;
      if (employeeId && employeeId.startsWith("EMP")) {
        const idNumber = parseInt(employeeId.substring(3), 10);
        if (!isNaN(idNumber) && idNumber > maxId) {
          maxId = idNumber;
        }
      }
    });
    
    // Increment dan format ID berikutnya
    const nextId = maxId + 1;
    return `EMP${nextId.toString().padStart(3, '0')}`;
  } catch (error) {
    console.error("Error getting next employee ID:", error);
    throw error;
  }
}

// Fungsi untuk mendapatkan barcode berikutnya
export async function getNextBarcode() {
  try {
    const employeesCollection = collection(db, "employees");
    const snapshot = await getDocs(employeesCollection);
    
    // Jika belum ada karyawan, mulai dari barcode awal
    if (snapshot.empty) {
      return "MLT001";
    }
    
    // Cari barcode terbesar
    let maxBarcode = 0;
    snapshot.docs.forEach(doc => {
      const barcode = doc.data().barcode;
      if (barcode && barcode.startsWith("MLT")) {
        const barcodeNumber = parseInt(barcode.substring(3), 10);
        if (!isNaN(barcodeNumber) && barcodeNumber > maxBarcode) {
          maxBarcode = barcodeNumber;
        }
      }
    });
    
    // Increment dan format barcode berikutnya
    const nextBarcode = maxBarcode + 1;
    return `MLT${nextBarcode.toString().padStart(3, '0')}`;
  } catch (error) {
    console.error("Error getting next barcode:", error);
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

// Update employee
export async function updateEmployee(id, updatedEmployee) {
  try {
    // Check if employee ID already exists (except for this employee)
    const employeesCollection = collection(db, "employees");
    const q = query(employeesCollection, where("employeeId", "==", updatedEmployee.employeeId));
    const snapshot = await getDocs(q);
    
    if (!snapshot.empty && snapshot.docs[0].id !== id) {
      throw new Error("ID Karyawan sudah digunakan!");
    }
    
    // Check if barcode already exists (except for this employee)
    const barcodeQuery = query(employeesCollection, where("barcode", "==", updatedEmployee.barcode));
    const barcodeSnapshot = await getDocs(barcodeQuery);
    
    if (!barcodeSnapshot.empty && barcodeSnapshot.docs[0].id !== id) {
      throw new Error("Barcode sudah digunakan!");
    }
    
    // Add timestamp
    updatedEmployee.updatedAt = new Date();
    
    const employeeRef = doc(db, "employees", id);
    await updateDoc(employeeRef, updatedEmployee);
    return { id, ...updatedEmployee };
  } catch (error) {
    console.error("Error updating employee:", error);
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
      ...doc.data(),
    };
  } catch (error) {
    console.error("Error finding employee by barcode:", error);
    throw error;
  }
}

// Find employee by ID
export async function findEmployeeById(employeeId) {
  try {
    const employeesCollection = collection(db, "employees");
    const q = query(employeesCollection, where("employeeId", "==", employeeId));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return null;
    }

    const doc = snapshot.docs[0];
    return {
      id: doc.id,
      ...doc.data(),
    };
  } catch (error) {
    console.error("Error finding employee by ID:", error);
    throw error;
  }
}
