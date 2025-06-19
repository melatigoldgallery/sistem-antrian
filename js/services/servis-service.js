// Firebase imports
import { 
  collection, 
  addDoc, 
  getDocs, 
  doc, 
  updateDoc, 
  deleteDoc,
  query, 
  where, 
  orderBy, 
  limit,
  Timestamp 
} from 'https://www.gstatic.com/firebasejs/10.4.0/firebase-firestore.js';
import { db } from '../configFirebase.js';

// Collection reference
const SERVIS_COLLECTION = 'servis';

// Cache untuk optimasi reads
const servisCache = new Map();
const CACHE_EXPIRATION = 5 * 60 * 1000; // 5 menit

// Smart cache system dengan optimasi reads
export const smartServisCache = {
  data: new Map(),
  timestamps: new Map(),
  CACHE_DURATION: 5 * 60 * 1000, // 5 menit
  
  get(key) {
    const cached = this.data.get(key);
    const timestamp = this.timestamps.get(key);
    
    if (cached && timestamp && (Date.now() - timestamp < this.CACHE_DURATION)) {
      console.log(`Cache hit for key: ${key}`);
      return cached;
    }
    
    if (cached) {
      console.log(`Cache expired for key: ${key}`);
    }
    return null;
  },
  
  set(key, value) {
    this.data.set(key, [...value]); // Deep copy untuk mencegah mutation
    this.timestamps.set(key, Date.now());
    console.log(`Cache updated for key: ${key}, items: ${value.length}`);
  },
  
  // Clear cache untuk key tertentu
  clearKey(key) {
    this.data.delete(key);
    this.timestamps.delete(key);
    console.log(`Cache cleared for key: ${key}`);
  },
  
  // Clear semua cache
  clearAll() {
    this.data.clear();
    this.timestamps.clear();
    console.log('All cache cleared');
  }
};

// Fungsi untuk menghapus multiple data servis
export async function deleteMultipleServisData(docIds) {
  try {
    const deletePromises = docIds.map(docId => 
      deleteDoc(doc(db, SERVIS_COLLECTION, docId))
    );
    
    await Promise.all(deletePromises);
    
    // Update cache secara spesifik
    updateCacheAfterMultipleDelete(docIds);
    
    return true;
  } catch (error) {
    console.error('Error deleting multiple servis data:', error);
    throw error;
  }
}

// Perbaiki getServisByMonth untuk mendukung filter
export async function getServisByMonthWithFilters(month, year, statusServis = '', statusPengambilan = '') {
  try {
    const cacheKey = `month_${month}_${year}_${statusServis}_${statusPengambilan}`;
    
    // Cek cache terlebih dahulu
    if (servisCache.has(cacheKey)) {
      const cached = servisCache.get(cacheKey);
      if (Date.now() - cached.timestamp < CACHE_EXPIRATION) {
        console.log('Using cached filtered monthly data:', month, year);
        return cached.data;
      }
    }
    
    // Ambil data dasar
    let baseData = await getServisByMonth(month, year);
    
    // Filter data berdasarkan status
    let filteredData = baseData;
    
    if (statusServis) {
      filteredData = filteredData.filter(item => item.statusServis === statusServis);
    }
    
    if (statusPengambilan) {
      filteredData = filteredData.filter(item => item.statusPengambilan === statusPengambilan);
    }
    
    // Simpan hasil filter ke cache
    servisCache.set(cacheKey, {
      data: filteredData,
      timestamp: Date.now()
    });
    
    return filteredData;
  } catch (error) {
    console.error('Error getting filtered monthly servis data:', error);
    throw error;
  }
}

// Fungsi untuk update cache setelah multiple delete
function updateCacheAfterMultipleDelete(docIds) {
  servisCache.forEach((cached, key) => {
    if (cached.data) {
      const filteredArray = cached.data.filter(item => !docIds.includes(item.id));
      servisCache.set(key, {
        data: filteredArray,
        timestamp: Date.now()
      });
    }
  });
}

// Tambahkan fungsi update servis data
export async function updateServisData(docId, servisData) {
  try {
    const servisRef = doc(db, SERVIS_COLLECTION, docId);
    
    await updateDoc(servisRef, {
      ...servisData,
      updatedAt: Timestamp.now()
    });
    
    // Update cache secara spesifik
    updateCacheAfterEdit(docId, servisData);
    
    return true;
  } catch (error) {
    console.error('Error updating servis data:', error);
    throw error;
  }
}

// Fungsi untuk update cache secara spesifik
function updateCacheAfterEdit(docId, updatedData) {
  servisCache.forEach((cached, key) => {
    if (key.startsWith('date_') && cached.data) {
      const updatedArray = cached.data.map(item => 
        item.id === docId ? { ...item, ...updatedData } : item
      );
      servisCache.set(key, {
        data: updatedArray,
        timestamp: Date.now()
      });
    }
  });
}

// Tambahkan function ini di file servis-service.js
export async function deleteServisData(docId) {
  try {
    await deleteDoc(doc(db, SERVIS_COLLECTION, docId));
    
    // Update cache secara spesifik
    updateCacheAfterDelete(docId);
    
    return true;
  } catch (error) {
    console.error('Error deleting servis data:', error);
    throw error;
  }
}

// Fungsi untuk update cache setelah delete
function updateCacheAfterDelete(docId) {
  servisCache.forEach((cached, key) => {
    if (key.startsWith('date_') && cached.data) {
      const filteredArray = cached.data.filter(item => item.id !== docId);
      servisCache.set(key, {
        data: filteredArray,
        timestamp: Date.now()
      });
    }
  });
}

// Fungsi untuk menyimpan data servis
export async function saveServisData(servisData) {
  try {
    const docRef = await addDoc(collection(db, SERVIS_COLLECTION), {
      ...servisData,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      statusServis: 'Belum Selesai',
      statusPengambilan: 'Belum Diambil'
    });
    
    // Update cache secara spesifik
    const newData = {
      id: docRef.id,
      ...servisData,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      statusServis: 'Belum Selesai',
      statusPengambilan: 'Belum Diambil'
    };
    
    updateCacheAfterAdd(newData);
    
    return docRef.id;
  } catch (error) {
    console.error('Error saving servis data:', error);
    throw error;
  }
}

// Fungsi untuk update cache setelah add
function updateCacheAfterAdd(newData) {
  const dateKey = `date_${newData.tanggal}`;
  if (servisCache.has(dateKey)) {
    const cached = servisCache.get(dateKey);
    cached.data.unshift(newData); // Tambah di awal array
    servisCache.set(dateKey, {
      data: cached.data,
      timestamp: Date.now()
    });
  }
}

// Fungsi untuk mengambil data servis berdasarkan tanggal
export async function getServisByDate(date) {
  try {
    const cacheKey = `date_${date}`;
    
    // Cek cache terlebih dahulu
    if (servisCache.has(cacheKey)) {
      const cached = servisCache.get(cacheKey);
      if (Date.now() - cached.timestamp < CACHE_EXPIRATION) {
        console.log('Using cached data for date:', date);
        return cached.data;
      }
    }
    
    const q = query(
      collection(db, SERVIS_COLLECTION),
      where('tanggal', '==', date),
      orderBy('createdAt', 'desc')
    );
    
    const querySnapshot = await getDocs(q);
    const servisData = [];
    
    querySnapshot.forEach((doc) => {
      servisData.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    // Simpan ke cache
    servisCache.set(cacheKey, {
      data: servisData,
      timestamp: Date.now()
    });
    
    console.log(`Loaded ${servisData.length} servis records for date:`, date);
    return servisData;
  } catch (error) {
    console.error('Error getting servis by date:', error);
    throw error;
  }
}

// Fungsi untuk mengambil data servis berdasarkan bulan dan tahun
export async function getServisByMonth(month, year, statusPengambilan = 'all') {
  try {
    const cacheKey = `month_${month}_${year}_${statusPengambilan}`;
    
    // Cek cache terlebih dahulu
    if (servisCache.has(cacheKey)) {
      const cached = servisCache.get(cacheKey);
      if (Date.now() - cached.timestamp < CACHE_EXPIRATION) {
        console.log('Using cached data for month:', month, year);
        return cached.data;
      }
    }
    
    const startDate = `${year}-${month.toString().padStart(2, '0')}-01`;
    const endDate = `${year}-${month.toString().padStart(2, '0')}-31`;
    
    let q = query(
      collection(db, SERVIS_COLLECTION),
      where('tanggal', '>=', startDate),
      where('tanggal', '<=', endDate),
      orderBy('tanggal', 'desc')
    );
    
    const querySnapshot = await getDocs(q);
    let servisData = [];
    
    querySnapshot.forEach((doc) => {
      servisData.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    // Filter berdasarkan status pengambilan jika diperlukan
    if (statusPengambilan !== 'all') {
      servisData = servisData.filter(item => item.statusPengambilan === statusPengambilan);
    }
    
    // Simpan ke cache
    servisCache.set(cacheKey, {
      data: servisData,
      timestamp: Date.now()
    });
    
    console.log(`Loaded ${servisData.length} servis records for month:`, month, year);
    return servisData;
  } catch (error) {
    console.error('Error getting servis by month:', error);
    throw error;
  }
}

// Fungsi untuk search data servis
export async function searchServis(searchTerm, date = null) {
  try {
    let q;
    
    if (date) {
      q = query(
        collection(db, SERVIS_COLLECTION),
        where('tanggal', '==', date),
        orderBy('createdAt', 'desc')
      );
    } else {
      q = query(
        collection(db, SERVIS_COLLECTION),
        orderBy('createdAt', 'desc'),
        limit(100) // Batasi hasil untuk efisiensi
      );
    }
    
    const querySnapshot = await getDocs(q);
    let servisData = [];
    
    querySnapshot.forEach((doc) => {
      servisData.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    // Filter berdasarkan search term di client side
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      servisData = servisData.filter(item => 
        item.namaCustomer?.toLowerCase().includes(term) ||
        item.noHp?.includes(term) ||
        item.namaBarang?.toLowerCase().includes(term)
      );
    }
    
    return servisData;
  } catch (error) {
    console.error('Error searching servis:', error);
    throw error;
  }
}

// Fungsi untuk update status servis
export async function updateServisStatus(servisId, statusServis, statusPengambilan) {
  try {
    const servisRef = doc(db, SERVIS_COLLECTION, servisId);
    
    const updateData = {
      statusServis,
      statusPengambilan,
      updatedAt: Timestamp.now()
    };
    
    await updateDoc(servisRef, updateData);
    
    // Update cache secara spesifik
    updateCacheAfterStatusUpdate(servisId, updateData);
    
    return true;
  } catch (error) {
    console.error('Error updating servis status:', error);
    throw error;
  }
}

// Fungsi untuk update cache setelah status update
function updateCacheAfterStatusUpdate(docId, updateData) {
  servisCache.forEach((cached, key) => {
    if (cached.data) {
      const updatedArray = cached.data.map(item => 
        item.id === docId ? { ...item, ...updateData } : item
      );
      servisCache.set(key, {
        data: updatedArray,
        timestamp: Date.now()
      });
    }
  });
}

// Tambahkan fungsi untuk filter data dengan cache key yang lebih spesifik
export async function getServisByDateWithFilters(date, statusServis = '', statusPengambilan = '') {
  try {
    const cacheKey = `date_${date}_${statusServis}_${statusPengambilan}`;
    
    // Cek cache terlebih dahulu
    if (servisCache.has(cacheKey)) {
      const cached = servisCache.get(cacheKey);
      if (Date.now() - cached.timestamp < CACHE_EXPIRATION) {
        console.log('Using cached filtered data for date:', date);
        return cached.data;
      }
    }
    
    // Ambil data dasar dari cache atau firestore
    let baseData = await getServisByDate(date);
    
    // Filter data berdasarkan status
    let filteredData = baseData;
    
    if (statusServis) {
      filteredData = filteredData.filter(item => item.statusServis === statusServis);
    }
    
    if (statusPengambilan) {
      filteredData = filteredData.filter(item => item.statusPengambilan === statusPengambilan);
    }
    
    // Simpan hasil filter ke cache
    servisCache.set(cacheKey, {
      data: filteredData,
      timestamp: Date.now()
    });
    
    return filteredData;
  } catch (error) {
    console.error('Error getting filtered servis data:', error);
    throw error;
  }
}

// Fungsi untuk clear cache
export function clearServisCache() {
  servisCache.clear();
}
