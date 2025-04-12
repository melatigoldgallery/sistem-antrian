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

// Cache constants
const CACHE_KEY = 'employees_cache';
const CACHE_TIMESTAMP_KEY = 'employees_cache_timestamp';
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 jam dalam milidetik

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
    // Check cache first if not forcing refresh
    if (!forceRefresh && isCacheValid()) {
      const cachedEmployees = getFromCache();
      if (cachedEmployees) {
        return cachedEmployees;
      }
    }

    // If cache is invalid or we're forcing refresh, get from Firestore
    const employeesCollection = collection(db, "employees");
    const snapshot = await getDocs(employeesCollection);
    const employees = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    
    // Save to cache
    saveToCache(employees);
    
    return employees;
  } catch (error) {
    console.error("Error getting employees:", error);
    
    // If error occurs but we have cached data, return that as fallback
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
    // Get employees from cache if possible to reduce reads
    const employees = await getEmployees();
    
    // Check if employee ID already exists
    const existingWithId = employees.find(emp => emp.employeeId === employee.employeeId);
    if (existingWithId) {
      throw new Error("ID Karyawan sudah digunakan!");
    }
    
    // Check if barcode already exists
    const existingWithBarcode = employees.find(emp => emp.barcode === employee.barcode);
    if (existingWithBarcode) {
      throw new Error("Barcode sudah digunakan!");
    }
    
    // Add timestamp
    employee.createdAt = new Date();
    
    // Add to Firestore
    const employeesCollection = collection(db, "employees");
    const docRef = await addDoc(employeesCollection, employee);
    const newEmployee = { id: docRef.id, ...employee };
    
    // Update cache with new employee
    const updatedEmployees = [...employees, newEmployee];
    saveToCache(updatedEmployees);
    
    return newEmployee;
  } catch (error) {
    console.error("Error adding employee:", error);
    throw error;
  }
}

// Fungsi untuk mendapatkan ID karyawan berikutnya
export async function getNextEmployeeId() {
  try {
    // Use cached data to avoid additional Firestore read
    const employees = await getEmployees();
    
    // Jika belum ada karyawan, mulai dari ID awal
    if (employees.length === 0) {
      return "EMP001";
    }
    
    // Cari ID karyawan terbesar
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
    // Use cached data to avoid additional Firestore read
    const employees = await getEmployees();
    
    // Jika belum ada karyawan, mulai dari barcode awal
    if (employees.length === 0) {
      return "MLT001";
    }
    
    // Cari barcode terbesar
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
    
    // Update cache after successful deletion
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
    // Get employees from cache if possible
    const employees = await getEmployees();
    
    // Check if employee ID already exists (except for this employee)
    const existingWithId = employees.find(emp => 
      emp.employeeId === updatedEmployee.employeeId && emp.id !== id
    );
    
    if (existingWithId) {
      throw new Error("ID Karyawan sudah digunakan!");
    }
    
    // Check if barcode already exists (except for this employee)
    const existingWithBarcode = employees.find(emp => 
      emp.barcode === updatedEmployee.barcode && emp.id !== id
    );
    
    if (existingWithBarcode) {
      throw new Error("Barcode sudah digunakan!");
    }
    
    // Add timestamp
    updatedEmployee.updatedAt = new Date();
    
    // Update in Firestore
    const employeeRef = doc(db, "employees", id);
    await updateDoc(employeeRef, updatedEmployee);
    
    // Update cache
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
    // Use cached data to avoid Firestore read
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
    // Use cached data to avoid Firestore read
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
