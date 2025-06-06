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
  setDoc,
  getDoc,
  writeBatch
} from "https://www.gstatic.com/firebasejs/10.4.0/firebase-firestore.js";

// Cache constants
const CACHE_KEY = 'employees_cache';
const CACHE_TIMESTAMP_KEY = 'employees_cache_timestamp';
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

// Save face descriptor for an employee
export async function saveFaceDescriptor(employeeId, descriptor) {
  try {
    // Convert Float32Array to regular array for Firestore storage
    const descriptorArray = Array.from(descriptor);

    // Save to Firestore
    const faceRef = doc(db, "employeeFaces", employeeId);
    await setDoc(faceRef, {
      employeeId: employeeId,
      faceDescriptor: descriptorArray,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    return true;
  } catch (error) {
    console.error("Error saving face descriptor:", error);
    throw error;
  }
}

// Get face descriptor by employee ID
export async function getFaceDescriptor(employeeId) {
  try {
    const faceRef = doc(db, "employeeFaces", employeeId);
    const faceDoc = await getDoc(faceRef);

    if (faceDoc.exists() && faceDoc.data().faceDescriptor) {
      const descriptorData = faceDoc.data().faceDescriptor;
      return new Float32Array(descriptorData);
    }

    return null;
  } catch (error) {
    console.error("Error getting face descriptor:", error);
    throw error;
  }
}

// Batch get face descriptors for multiple employee IDs
export async function getFaceDescriptorsBatch(employeeIds) {
  if (!employeeIds || employeeIds.length === 0) return {};

  const chunkSize = 10; // Firestore 'in' query limit
  const faceDescriptors = {};

  try {
    for (let i = 0; i < employeeIds.length; i += chunkSize) {
      const chunk = employeeIds.slice(i, i + chunkSize);
      const q = query(collection(db, "employeeFaces"), where("__name__", "in", chunk));
      const snapshot = await getDocs(q);

      snapshot.forEach((doc) => {
        const data = doc.data();
        if (data.faceDescriptor) {
          faceDescriptors[doc.id] = new Float32Array(data.faceDescriptor);
        }
      });
    }
    return faceDescriptors;
  } catch (error) {
    console.error("Error batch getting face descriptors:", error);
    throw error;
  }
}

// Delete face descriptor (for reset)
export async function deleteFaceDescriptor(employeeId) {
  try {
    const faceRef = doc(db, "employeeFaces", employeeId);
    await deleteDoc(faceRef);
    return true;
  } catch (error) {
    console.error("Error deleting face descriptor:", error);
    throw error;
  }
}

// Batch save face descriptors (for mass storage)
export async function saveFaceDescriptorsBatch(faceDataArray) {
  if (!faceDataArray || faceDataArray.length === 0) return;

  const batch = writeBatch(db);

  faceDataArray.forEach(({ employeeId, faceDescriptor }) => {
    const docRef = doc(db, "employeeFaces", employeeId);
    batch.set(docRef, {
      employeeId,
      faceDescriptor: Array.from(faceDescriptor),
      updatedAt: new Date()
    });
  });

  try {
    await batch.commit();
    // Optionally notify success here
  } catch (error) {
    console.error("Error batch saving face descriptors:", error);
    throw error;
  }
}

// Helper function to check if cache is valid
function isCacheValid() {
  const timestamp = localStorage.getItem(CACHE_TIMESTAMP_KEY);
  if (!timestamp) return false;

  const now = new Date().getTime();
  return (now - parseInt(timestamp)) < CACHE_DURATION;
}

// Helper function to save data to cache
function saveToCache(employees) {
  localStorage.setItem(CACHE_KEY, JSON.stringify(employees));
  localStorage.setItem(CACHE_TIMESTAMP_KEY, new Date().getTime().toString());
}

// Helper function to get data from cache
function getFromCache() {
  const cachedData = localStorage.getItem(CACHE_KEY);
  return cachedData ? JSON.parse(cachedData) : null;
}

// Helper function to clear cache
function clearCache() {
  localStorage.removeItem(CACHE_KEY);
  localStorage.removeItem(CACHE_TIMESTAMP_KEY);
}

// Get all employees with caching
export async function getEmployees(forceRefresh = false) {
  try {
    if (!forceRefresh && isCacheValid()) {
      const cachedEmployees = getFromCache();
      if (cachedEmployees) {
        return cachedEmployees;
      }
    }

    const employeesCollection = collection(db, "employees");
    const snapshot = await getDocs(employeesCollection);
    const employees = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    saveToCache(employees);

    return employees;
  } catch (error) {
    console.error("Error getting employees:", error);

    const cachedEmployees = getFromCache();
    if (cachedEmployees) {
      console.log("Using cached data as fallback after error");
      return cachedEmployees;
    }

    throw error;
  }
}

// Add new employee
export async function addEmployee(employee) {
  try {
    const employees = await getEmployees();

    const existingWithId = employees.find(emp => emp.employeeId === employee.employeeId);
    if (existingWithId) {
      throw new Error("ID Karyawan sudah digunakan!");
    }

    const existingWithBarcode = employees.find(emp => emp.barcode === employee.barcode);
    if (existingWithBarcode) {
      throw new Error("Barcode sudah digunakan!");
    }

    employee.createdAt = new Date();

    const employeesCollection = collection(db, "employees");
    const docRef = await addDoc(employeesCollection, employee);
    const newEmployee = { id: docRef.id, ...employee };

    const updatedEmployees = [...employees, newEmployee];
    saveToCache(updatedEmployees);

    return newEmployee;
  } catch (error) {
    console.error("Error adding employee:", error);
    throw error;
  }
}

// Get next employee ID
export async function getNextEmployeeId() {
  try {
    const employees = await getEmployees();

    if (employees.length === 0) {
      return "EMP001";
    }

    let maxId = 0;
    employees.forEach(employee => {
      const employeeId = employee.employeeId;
      if (employeeId && employeeId.startsWith("EMP")) {
        const idNumber = parseInt(employeeId.substring(3), 10);
        if (!isNaN(idNumber) && idNumber > maxId) {
          maxId = idNumber;
        }
      }
    });

    const nextId = maxId + 1;
    return `EMP${nextId.toString().padStart(3, '0')}`;
  } catch (error) {
    console.error("Error getting next employee ID:", error);
    throw error;
  }
}

// Get next barcode
export async function getNextBarcode() {
  try {
    const employees = await getEmployees();

    if (employees.length === 0) {
      return "MLT001";
    }

    let maxBarcode = 0;
    employees.forEach(employee => {
      const barcode = employee.barcode;
      if (barcode && barcode.startsWith("MLT")) {
        const barcodeNumber = parseInt(barcode.substring(3), 10);
        if (!isNaN(barcodeNumber) && barcodeNumber > maxBarcode) {
          maxBarcode = barcodeNumber;
        }
      }
    });

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

    const employees = await getEmployees();
    const updatedEmployees = employees.filter(emp => emp.id !== id);
    saveToCache(updatedEmployees);

    return true;
  } catch (error) {
    console.error("Error deleting employee:", error);
    throw error;
  }
}

// Update employee
export async function updateEmployee(id, updatedEmployee) {
  try {
    const employees = await getEmployees();

    const existingWithId = employees.find(emp =>
      emp.employeeId === updatedEmployee.employeeId && emp.id !== id
    );

    if (existingWithId) {
      throw new Error("ID Karyawan sudah digunakan!");
    }

    const existingWithBarcode = employees.find(emp =>
      emp.barcode === updatedEmployee.barcode && emp.id !== id
    );

    if (existingWithBarcode) {
      throw new Error("Barcode sudah digunakan!");
    }

    updatedEmployee.updatedAt = new Date();

    const employeeRef = doc(db, "employees", id);
    await updateDoc(employeeRef, updatedEmployee);

    const updatedEmployees = employees.map(emp =>
      emp.id === id ? { id, ...updatedEmployee } : emp
    );
    saveToCache(updatedEmployees);

    return { id, ...updatedEmployee };
  } catch (error) {
    console.error("Error updating employee:", error);
    throw error;
  }
}

// Find employee by barcode
export async function findEmployeeByBarcode(barcode) {
  try {
    const employees = await getEmployees();
    return employees.find(emp => emp.barcode === barcode) || null;
  } catch (error) {
    console.error("Error finding employee by barcode:", error);
    throw error;
  }
}

// Find employee by ID
export async function findEmployeeById(employeeId) {
  try {
    const employees = await getEmployees();
    return employees.find(emp => emp.employeeId === employeeId) || null;
  } catch (error) {
    console.error("Error finding employee by ID:", error);
    throw error;
  }
}

// Force refresh cache - can be called when needed
export async function refreshEmployeeCache() {
  clearCache();
  return await getEmployees(true);
}