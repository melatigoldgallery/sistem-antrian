// Firebase imports
import { 
  collection, 
  addDoc, 
  getDocs, 
  doc, 
  updateDoc, 
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
    
    // Clear cache setelah menambah data
    servisCache.clear();
    
    return docRef.id;
  } catch (error) {
    console.error('Error saving servis data:', error);
    throw error;
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
    
    await updateDoc(servisRef, {
      statusServis,
      statusPengambilan,
      updatedAt: Timestamp.now()
    });
    
    // Clear cache setelah update
    servisCache.clear();
    
    return true;
  } catch (error) {
    console.error('Error updating servis status:', error);
    throw error;
  }
}

// Fungsi untuk clear cache
export function clearServisCache() {
  servisCache.clear();
}
