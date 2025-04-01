import { storage } from "../configFirebase.js";
import { 
  ref, 
  uploadBytesResumable, 
  getDownloadURL,
  deleteObject 
} from "https://www.gstatic.com/firebasejs/10.4.0/firebase-storage.js";

// Fungsi untuk mengompres gambar sebelum upload
async function compressImage(file, maxWidth = 1200, quality = 0.7) {
  return new Promise((resolve, reject) => {
    // Jika bukan gambar atau ukuran < 100KB, tidak perlu kompresi
    if (!file.type.startsWith('image/') || file.size < 100 * 1024) {
      resolve(file);
      return;
    }
    
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = function(event) {
      const img = new Image();
      img.src = event.target.result;
      
      img.onload = function() {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        
        // Resize jika gambar terlalu besar
        if (width > maxWidth) {
          height = Math.round(height * maxWidth / width);
          width = maxWidth;
        }
        
        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        
        // Convert to Blob
        canvas.toBlob((blob) => {
          // Buat file baru dari blob hasil kompresi
          const compressedFile = new File([blob], file.name, {
            type: file.type,
            lastModified: Date.now()
          });
          
          resolve(compressedFile);
        }, file.type, quality);
      };
    };
    reader.onerror = reject;
  });
}

// Upload file ke Firebase Storage
export async function uploadFile(file, folder = 'medical-certificates') {
  try {
    // Validasi ukuran file (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      throw new Error('Ukuran file melebihi 2MB');
    }
    
    // Kompresi gambar jika tipe file adalah gambar
    let fileToUpload = file;
    if (file.type.startsWith('image/')) {
      fileToUpload = await compressImage(file);
    }
    
    // Buat nama file unik dengan timestamp
    const timestamp = Date.now();
    const fileName = `${folder}/${timestamp}_${file.name.replace(/\s+/g, '_')}`;
    
    // Buat referensi ke Storage
    const storageRef = ref(storage, fileName);
    
    // Upload file
    const uploadTask = uploadBytesResumable(storageRef, fileToUpload);
    
    // Return promise yang menunggu upload selesai
    return new Promise((resolve, reject) => {
      uploadTask.on('state_changed', 
        // Progress callback
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          console.log('Upload progress: ' + progress + '%');
        },
        // Error callback
        (error) => {
          reject(error);
        },
        // Complete callback
        async () => {
          // Dapatkan URL download
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          
          // Return object dengan info file
          resolve({
            url: downloadURL,
            path: fileName,
            name: file.name,
            size: fileToUpload.size,
            type: file.type,
            uploadedAt: timestamp
          });
        }
      );
    });
  } catch (error) {
    console.error('Error uploading file:', error);
    throw error;
  }
}

// Hapus file dari Firebase Storage
export async function deleteFile(filePath) {
  try {
    if (!filePath) return false;
    
    const fileRef = ref(storage, filePath);
    await deleteObject(fileRef);
    return true;
  } catch (error) {
    console.error('Error deleting file:', error);
    return false;
  }
}
