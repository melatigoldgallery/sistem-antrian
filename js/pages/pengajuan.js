import { getEmployees } from "../services/employee-service.js";
import { submitLeaveRequest, getLeaveRequestsByEmployee } from "../services/leave-service.js";
import { uploadFile, checkTemporaryFiles } from "../services/cloudinary-service.js";

// Initialize data
let employees = [];
let leaveHistory = [];

// Function to calculate days between two dates
function calculateDaysBetween(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffTime = Math.abs(end - start);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 to include both start and end dates
}

// Function to add a new date input field
function addReplacementDateField() {
  const container = document.getElementById("replacementDatesContainer");
  if (!container) return;

  const index = container.children.length;

  const dateItem = document.createElement("div");
  dateItem.className = "mb-3 replacement-date-item";
  dateItem.innerHTML = `
    <label for="replacementDate${index}" class="form-label">Tanggal Ganti Libur ${index + 1}</label>
    <div class="input-group">
      <span class="input-group-text"><i class="fas fa-calendar-check"></i></span>
      <input type="date" class="form-control replacement-date" id="replacementDate${index}" />
      ${
        index > 0
          ? '<button type="button" class="btn btn-outline-danger remove-date"><i class="fas fa-times"></i></button>'
          : ""
      }
    </div>
  `;

  container.appendChild(dateItem);

  // Add event listener to remove button if it exists
  const removeBtn = dateItem.querySelector(".remove-date");
  if (removeBtn) {
    removeBtn.addEventListener("click", function () {
      container.removeChild(dateItem);
      updateReplacementDateLabels();
    });
  }
}

// Function to update labels after removing a date field
function updateReplacementDateLabels() {
  const dateItems = document.querySelectorAll(".replacement-date-item");
  dateItems.forEach((item, index) => {
    const label = item.querySelector("label");
    if (label) {
      label.textContent = `Tanggal Ganti Libur ${index + 1}`;
      label.setAttribute("for", `replacementDate${index}`);
    }

    const input = item.querySelector("input");
    if (input) {
      input.id = `replacementDate${index}`;
    }
  });
}

// Function to update the UI based on leave duration
function updateLeaveReplacementUI() {
  const startDate = document.getElementById("leaveStartDate")?.value;
  const endDate = document.getElementById("leaveEndDate")?.value;
  const replacementType = document.getElementById("replacementType")?.value;
  const multiDateWarning = document.getElementById("multiDateWarning");
  const addMoreDatesBtn = document.getElementById("addMoreDates");
  const container = document.getElementById("replacementDatesContainer");

  // Only proceed if we have both dates and replacement type is libur
  if (!(startDate && endDate && replacementType === "libur")) {
    if (multiDateWarning) multiDateWarning.style.display = "none";
    if (addMoreDatesBtn) addMoreDatesBtn.style.display = "none";
    return;
  }

  // Reset container to have only one date field
  if (container) {
    container.innerHTML = `
      <div class="mb-3 replacement-date-item">
        <label for="replacementDate0" class="form-label">Tanggal Ganti Libur 1</label>
        <div class="input-group">
          <span class="input-group-text"><i class="fas fa-calendar-check"></i></span>
          <input type="date" class="form-control replacement-date" id="replacementDate0" />
        </div>
      </div>
    `;
  }

  const dayCount = calculateDaysBetween(startDate, endDate);

  if (dayCount > 1) {
    // Show warning and add button for multiple days
    if (document.getElementById("totalDaysCount")) document.getElementById("totalDaysCount").textContent = dayCount;
    if (multiDateWarning) multiDateWarning.style.display = "block";
    if (addMoreDatesBtn) addMoreDatesBtn.style.display = "block";

    // Add date fields for each day (minus one because we already have one field)
    for (let i = 1; i < dayCount; i++) {
      addReplacementDateField();
    }
  } else {
    // Hide warning and add button for single day
    if (multiDateWarning) multiDateWarning.style.display = "none";
    if (addMoreDatesBtn) addMoreDatesBtn.style.display = "none";
  }
}

// Event listener for leave type
document.getElementById("leaveType")?.addEventListener("change", function () {
  const sickLeaveSection = document.getElementById("sickLeaveSection");
  const leaveSection = document.getElementById("leaveSection");
  const replacementTypeSelect = document.getElementById("replacementType");
  const hasMedicalCert = document.getElementById("hasMedicalCertificate");

  // Hide all sections first
  if (sickLeaveSection) sickLeaveSection.style.display = "none";
  if (leaveSection) leaveSection.style.display = "none";

  // Reset replacement type
  if (replacementTypeSelect) {
    replacementTypeSelect.value = "";
    replacementTypeSelect.disabled = false;
  }

  // Enable all options first
  if (replacementTypeSelect) {
    Array.from(replacementTypeSelect.options).forEach((option) => {
      option.disabled = false;
    });
  }

  // Show relevant sections based on leave type
  switch (this.value) {
    case "sakit":
      if (sickLeaveSection) sickLeaveSection.style.display = "block";

      if (replacementTypeSelect && hasMedicalCert) {
        if (hasMedicalCert.checked) {
          // If medical certificate is checked, set to "Tidak Perlu Diganti"
          replacementTypeSelect.value = "tidak";
          replacementTypeSelect.disabled = true;
        } else {
          // If not checked, disable "Tidak Perlu Diganti" option
          const noReplacementOption = Array.from(replacementTypeSelect.options).find(
            (option) => option.value === "tidak"
          );
          if (noReplacementOption) {
            noReplacementOption.disabled = true;
          }
        }
      }
      break;
    case "cuti":
      if (leaveSection) leaveSection.style.display = "block";
      if (replacementTypeSelect) {
        replacementTypeSelect.value = "tidak";
        replacementTypeSelect.disabled = true;
      }
      break;
    case "normal":
      // For "Izin Lainnya", disable "Tidak Perlu Diganti" option
      if (replacementTypeSelect) {
        const noReplacementOption = Array.from(replacementTypeSelect.options).find(
          (option) => option.value === "tidak"
        );
        if (noReplacementOption) {
          noReplacementOption.disabled = true;
        }
      }
      break;
  }

  // Trigger change event on replacement type to update UI
  if (replacementTypeSelect) {
    const event = new Event("change");
    replacementTypeSelect.dispatchEvent(event);
  }
});

// Event listener for hasMedicalCertificate
document.getElementById("hasMedicalCertificate")?.addEventListener("change", function () {
  const uploadSection = document.getElementById("medicalCertificateUpload");
  const replacementTypeSelect = document.getElementById("replacementType");
  const leaveType = document.getElementById("leaveType")?.value;

  if (uploadSection) {
    uploadSection.style.display = this.checked ? "block" : "none";
  }

  // Only apply this logic if leave type is "sakit"
  if (leaveType === "sakit" && replacementTypeSelect) {
    if (this.checked) {
      // If medical certificate is checked, set to "Tidak Perlu Diganti" and disable
      replacementTypeSelect.value = "tidak";
      replacementTypeSelect.disabled = true;
    } else {
      // If unchecked, enable replacement selection but disable "Tidak Perlu Diganti" option
      replacementTypeSelect.disabled = false;
      replacementTypeSelect.value = "";

      // Disable "Tidak Perlu Diganti" option
      const noReplacementOption = Array.from(replacementTypeSelect.options).find((option) => option.value === "tidak");
      if (noReplacementOption) {
        noReplacementOption.disabled = true;
      }
    }

    // Trigger change event to update UI
    const event = new Event("change");
    replacementTypeSelect.dispatchEvent(event);
  }
});

// Separate event listener for file input validation
document.getElementById("medicalCertificateFile")?.addEventListener("change", function () {
  const maxSize = 2 * 1024 * 1024; // 2MB
  const file = this.files[0];

  if (file) {
    if (file.size > maxSize) {
      showFeedback("error", "Ukuran file melebihi 2MB. Silakan pilih file yang lebih kecil.");
      this.value = ""; // Reset input file
      return;
    }

    const validTypes = ["image/jpeg", "image/png", "image/jpg", "application/pdf"];
    if (!validTypes.includes(file.type)) {
      showFeedback("error", "Format file tidak didukung. Gunakan JPG, PNG, atau PDF.");
      this.value = ""; // Reset input file
      return;
    }

    // Show file preview if valid
    showFilePreview(file);
  } else {
    hideFilePreview();
  }
});

// Function to show file preview
function showFilePreview(file) {
  const previewContainer = document.getElementById("filePreviewContainer");
  if (!previewContainer) return;

  // Create preview container if it doesn't exist
  if (!document.getElementById("filePreviewName")) {
    previewContainer.innerHTML = `
      <div class="card">
        <div class="card-body p-2">
          <div class="d-flex align-items-center">
            <i class="fas fa-file-medical me-2 text-primary"></i>
            <span id="filePreviewName"></span>
            <button type="button" class="btn btn-sm btn-link text-danger ms-auto" id="removeFileBtn">
              <i class="fas fa-times"></i> Hapus
            </button>
          </div>
          <div id="imagePreview" class="mt-2" style="display: none;">
            <img src="" class="img-fluid img-thumbnail" style="max-height: 150px;" />
          </div>
        </div>
      </div>
    `;

    // Add event listener to remove button
    document.getElementById("removeFileBtn")?.addEventListener("click", function () {
      document.getElementById("medicalCertificateFile").value = "";
      hideFilePreview();
    });
  }

  // Update preview
  const previewName = document.getElementById("filePreviewName");
  const imagePreview = document.getElementById("imagePreview");
  const previewImage = imagePreview?.querySelector("img");

  if (previewName) previewName.textContent = file.name;
  previewContainer.style.display = "block";

  // Show image preview for images
  if (file.type.startsWith("image/") && imagePreview && previewImage) {
    const reader = new FileReader();
    reader.onload = function (e) {
      previewImage.src = e.target.result;
    };
    reader.readAsDataURL(file);
    imagePreview.style.display = "block";
  } else if (file.type === "application/pdf" && imagePreview) {
    // For PDF, show icon
    imagePreview.style.display = "none";
  } else {
    if (imagePreview) imagePreview.style.display = "none";
  }
}

// Function to hide file preview
function hideFilePreview() {
  const previewContainer = document.getElementById("filePreviewContainer");
  if (previewContainer) previewContainer.style.display = "none";
}

// Event listener for radio button jenis cuti
document.querySelectorAll('input[name="leaveTypeRadio"]')?.forEach((radio) => {
  radio.addEventListener("change", function () {
    const specialLeaveReason = document.getElementById("specialLeaveReason");
    if (specialLeaveReason) {
      specialLeaveReason.style.display = this.value === "special" ? "block" : "none";
    }
  });
});

// Event listener for replacement type selection
document.getElementById("replacementType")?.addEventListener("change", function () {
  const liburSection = document.getElementById("replacementLibur");
  const jamSection = document.getElementById("replacementJam");

  // Hide both sections first
  if (liburSection) liburSection.style.display = "none";
  if (jamSection) jamSection.style.display = "none";

  // Show the appropriate section based on selection
  if (this.value === "libur" && liburSection) {
    liburSection.style.display = "block";
    // Force update of the UI for multiple dates
    setTimeout(updateLeaveReplacementUI, 0);
  } else if (this.value === "jam" && jamSection) {
    jamSection.style.display = "block";
  }
});

// Add event listeners for date inputs
document.getElementById("leaveStartDate")?.addEventListener("change", updateLeaveReplacementUI);
document.getElementById("leaveEndDate")?.addEventListener("change", updateLeaveReplacementUI);

// Add event listener for the "Add More Dates" button
document.getElementById("addMoreDates")?.addEventListener("click", addReplacementDateField);

// Function to compress image before upload
async function compressImage(file, maxWidth = 1200, quality = 0.7) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      resolve(file);
      return;
    }

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error("Canvas to Blob failed"));
              return;
            }

            const compressedFile = new File([blob], file.name, {
              type: file.type,
              lastModified: Date.now(),
            });

            resolve(compressedFile);
          },
          file.type,
          quality
        );
      };
      img.onerror = (error) => {
        reject(error);
      };
    };
    reader.onerror = (error) => {
      reject(error);
    };
  });
}

// Function to retry upload with exponential backoff
async function retryUpload(file, path, maxRetries = 3) {
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Percobaan upload ke-${attempt}...`);
      return await uploadFile(file, path);
    } catch (error) {
      console.warn(`Percobaan ke-${attempt} gagal:`, error);
      lastError = error;

      if (attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s, ...
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError || new Error("Gagal mengunggah file setelah beberapa percobaan");
}

// Function to validate file
function validateFile(file) {
  const maxSize = 2 * 1024 * 1024; // 2MB
  if (file.size > maxSize) {
    return {
      valid: false,
      message: "Ukuran file melebihi 2MB. Silakan pilih file yang lebih kecil.",
    };
  }

  const validTypes = ["image/jpeg", "image/png", "image/jpg", "application/pdf"];
  if (!validTypes.includes(file.type)) {
    return {
      valid: false,
      message: "Format file tidak didukung. Gunakan JPG, PNG, atau PDF.",
    };
  }

  return { valid: true };
}

async function checkInternetConnection() {
  try {
    const controller = new AbortController();
    const signal = controller.signal;

    // Set timeout untuk request
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    // Gunakan mode 'no-cors' untuk menghindari masalah CORS
    const response = await fetch("https://www.cloudinary.com/favicon.ico", {
      method: "HEAD",
      signal,
      mode: "no-cors", // Tambahkan ini
    });

    clearTimeout(timeoutId);
    return true; // Jika berhasil mencapai sini, berarti online
  } catch (error) {
    return false;
  }
}

// Function to handle offline mode
function handleOfflineMode() {
  const offlineAlert = document.createElement("div");
  offlineAlert.className = "alert alert-warning offline-alert";
  offlineAlert.innerHTML = `
    <i class="fas fa-wifi-slash me-2"></i>
    <strong>Anda sedang offline.</strong> File akan disimpan sementara dan diunggah saat koneksi tersedia.
  `;

  const formFeedback = document.getElementById("formFeedback");
  if (formFeedback) {
    formFeedback.parentNode.insertBefore(offlineAlert, formFeedback);
  }
}

// Function to check pending uploads
function checkPendingUploads() {
  const tempFiles = checkTemporaryFiles();
  if (tempFiles && tempFiles.length > 0) {
    showFeedback(
      "warning",
      `Terdapat ${tempFiles.length} file yang belum terunggah karena masalah koneksi. 
      <button class="btn btn-sm btn-outline-warning ms-2" id="uploadPendingBtn">
        <i class="fas fa-cloud-upload-alt me-1"></i> Unggah Sekarang
      </button>`,
      false,
      10000
    );

    document.getElementById("uploadPendingBtn")?.addEventListener("click", async function () {
      this.disabled = true;
      this.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i> Mengunggah...';

      let successCount = 0;
      let failCount = 0;

      for (const tempFile of tempFiles) {
        try {
          if (tempFile.dataUrl) {
            const response = await fetch(tempFile.dataUrl);
            const blob = await response.blob();
            const file = new File([blob], tempFile.name, { type: tempFile.type });

            await uploadFile(file, tempFile.path);
            successCount++;
          } else {
            failCount++;
          }
        } catch (error) {
          console.error("Error uploading pending file:", error);
          failCount++;
        }
      }

      if (successCount > 0) {
        showFeedback("success", `Berhasil mengunggah ${successCount} file.`);
      }
      if (failCount > 0) {
        showFeedback("error", `Gagal mengunggah ${failCount} file.`);
      }
    });
  }
}

// Submit form event listener
document.getElementById("leaveForm")?.addEventListener("submit", async function (e) {
  e.preventDefault();

   // Scroll ke atas halaman terlebih dahulu
   window.scrollTo({
    top: 0,
    behavior: "smooth"
  });

  // Show loading state
  const submitBtn = this.querySelector('button[type="submit"]');
  const originalBtnText = submitBtn.innerHTML;
  submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i> Memproses...';
  submitBtn.disabled = true;

  const employeeId = document.getElementById("employeeId").value;
  const employee = employees.find((emp) => emp.employeeId === employeeId);

  if (!employee) {
    showFeedback("error", "ID Karyawan tidak ditemukan! Silakan periksa kembali.");
    submitBtn.innerHTML = originalBtnText;
    submitBtn.disabled = false;
    return;
  }

  try {
    const leaveType = document.getElementById("leaveType").value;
    const leaveStartDate = document.getElementById("leaveStartDate").value;
    const leaveEndDate = document.getElementById("leaveEndDate").value;
    const leaveReason = document.getElementById("leaveReason").value;
    const replacementType = document.getElementById("replacementType").value;

    // Validasi tanggal
    if (new Date(leaveStartDate) > new Date(leaveEndDate)) {
      showFeedback("error", "Tanggal mulai tidak boleh lebih besar dari tanggal selesai!");
      submitBtn.innerHTML = originalBtnText;
      submitBtn.disabled = false;
      return;
    }

    // Hitung jumlah hari izin
    const startDate = new Date(leaveStartDate);
    const endDate = new Date(leaveEndDate);
    const dayDiff = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
    const isMultiDay = dayDiff > 1;

    // Format tanggal untuk tampilan
    const formattedStartDate = new Date(leaveStartDate).toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });

    const formattedEndDate = new Date(leaveEndDate).toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });

    // Format tanggal izin untuk tampilan
    let leaveDate;
    if (leaveStartDate === leaveEndDate) {
      leaveDate = formattedStartDate;
    } else {
      leaveDate = `${formattedStartDate} s/d ${formattedEndDate}`;
    }

    let replacementDetails;
    let medicalCertificateFileInfo = null;

    // Proses berdasarkan jenis izin dan pengganti
    if (leaveType === "sakit") {
      const hasMedicalCertificate = document.getElementById("hasMedicalCertificate").checked;

      // Upload file surat keterangan sakit jika ada
      if (hasMedicalCertificate) {
        const fileInput = document.getElementById("medicalCertificateFile");
        if (fileInput.files.length > 0) {
          const file = fileInput.files[0];
          
          // Validasi file
          const validation = validateFile(file);
          if (!validation.valid) {
            showFeedback("error", validation.message);
            submitBtn.innerHTML = originalBtnText;
            submitBtn.disabled = false;
            return;
          }

          // Tampilkan indikator upload
          showFeedback("info", '<i class="fas fa-upload me-2"></i> Mengunggah surat keterangan sakit...', false);

          try {
            // Kompresi gambar jika ukurannya besar
            let fileToUpload = file;
            if (file.type.startsWith("image/") && file.size > 1024 * 1024) {
              try {
                fileToUpload = await compressImage(file);
                console.log(`File dikompresi dari ${file.size} menjadi ${fileToUpload.size} bytes`);
              } catch (compressError) {
                console.warn("Gagal mengompresi gambar:", compressError);
              }
            }

            // Upload file dengan retry mechanism
            const uploadResult = await retryUpload(
              fileToUpload,
              `medical-certificates/${employeeId}`,
              3 // maksimal 3 kali percobaan
            );
            
            console.log("Upload result:", uploadResult); // Debugging

            // Simpan informasi file
            medicalCertificateFileInfo = {
              url: uploadResult.url,
              publicId: uploadResult.publicId,
              name: file.name,
              type: file.type,
              size: file.size
            };

            // Jika file disimpan sementara (offline)
            if (uploadResult.isOffline) {
              showFeedback(
                "warning",
                "File disimpan sementara karena Anda sedang offline. File akan diunggah otomatis saat koneksi tersedia."
              );
            }
          } catch (uploadError) {
            console.error("Error uploading file:", uploadError);
            showFeedback("error", `Gagal mengunggah file: ${uploadError.message}`);
            submitBtn.innerHTML = originalBtnText;
            submitBtn.disabled = false;
            return;
          }
        }
      }

      replacementDetails = {
        type: "sakit",
        needReplacement: replacementType !== "tidak",
        hasMedicalCertificate: hasMedicalCertificate,
        medicalCertificateFile: medicalCertificateFileInfo
      };
      
      console.log("Replacement details with medical certificate:", replacementDetails); // Debugging
    } else if (leaveType === "cuti") {
      const cutiType = document.querySelector('input[name="leaveTypeRadio"]:checked')?.value || "regular";
      let specialReason = null;

      if (cutiType === "special") {
        specialReason = document.getElementById("specialLeaveDetail").value;
      }

      replacementDetails = {
        type: "cuti",
        needReplacement: false,
        cutiType: cutiType,
        specialReason: specialReason,
      };
    } else if (replacementType === "libur") {
      // Collect all replacement dates
      const replacementDates = [];
      document.querySelectorAll(".replacement-date").forEach((input) => {
        if (input.value) {
          const formattedDate = new Date(input.value).toLocaleDateString("id-ID", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          });

          replacementDates.push({
            date: input.value,
            formattedDate: formattedDate,
          });
        }
      });

      if (replacementDates.length === 0) {
        showFeedback("error", "Tanggal pengganti harus diisi!");
        submitBtn.innerHTML = originalBtnText;
        submitBtn.disabled = false;
        return;
      }

      replacementDetails = {
        type: "libur",
        needReplacement: true,
        dates: replacementDates,
      };
    } else if (replacementType === "jam") {
      const replacementHourDate = document.getElementById("replacementHourDate").value;
      const replacementHours = document.getElementById("replacementHours").value;

      if (!replacementHourDate || !replacementHours) {
        showFeedback("error", "Tanggal dan jumlah jam pengganti harus diisi!");
        submitBtn.innerHTML = originalBtnText;
        submitBtn.disabled = false;
        return;
      }

      replacementDetails = {
        type: "jam",
        needReplacement: true,
        date: replacementHourDate,
        hours: replacementHours,
        formattedDate: new Date(replacementHourDate).toLocaleDateString("id-ID", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        }),
      };
    } else if (replacementType === "tidak") {
      replacementDetails = {
        type: "tidak",
        needReplacement: false,
      };
    }

    // Prepare leave request data with additional fields for efficient querying
    const leaveRequest = {
      employeeId: employeeId,
      name: employee.name,
      leaveDate: leaveDate,
      leaveStartDate: leaveStartDate,
      leaveEndDate: leaveEndDate,
      reason: leaveReason,
      leaveType: leaveType,
      replacementType: replacementType,
      replacementDetails: replacementDetails,
      // Add these fields for efficient querying
      rawLeaveDate: leaveStartDate, // For date range queries
      month: new Date(leaveStartDate).getMonth() + 1, // For monthly reports
      year: new Date(leaveStartDate).getFullYear(), // For yearly reports
      // Tambahkan informasi multi-hari jika perlu
      isMultiDay: isMultiDay,
      dayCount: dayDiff,
      // Tambahkan timestamp untuk sorting
      submissionDate: new Date().toISOString(),
      status: "Menunggu Persetujuan",
    };
    
    console.log("Final leave request data:", leaveRequest); // Debugging

    // Submit the leave request
    await submitLeaveRequest(leaveRequest);

   // Setelah berhasil submit
   showFeedback("success", "Pengajuan izin berhasil diajukan! Silakan cek status pengajuan secara berkala.");
   this.reset();
   
   // Perbaikan: Periksa apakah elemen ada sebelum mengakses propertinya
   const elementsToHide = [
     "replacementLibur",
     "replacementJam",
     "sickLeaveSection",
     "leaveSection",
     "multiDateWarning",
     "filePreviewContainer",
   ];

   elementsToHide.forEach((id) => {
     const element = document.getElementById(id);
     if (element) element.style.display = "none";
   });
   // Reload leave history
   await loadLeaveHistory(employeeId);
 } catch (error) {
   console.error("Error submitting leave request:", error);
   showFeedback("error", "Terjadi kesalahan saat mengajukan izin. Silakan coba lagi.");
 } finally {
   // Restore button state
   submitBtn.innerHTML = originalBtnText;
   submitBtn.disabled = false;
 }
});


// Function to show feedback messages with custom duration
function showFeedback(type, message, autoHide = true, duration = 5000) {
  const feedbackElement = document.getElementById("formFeedback");
  if (!feedbackElement) return;

  // Tambahkan class untuk styling dan animasi
  feedbackElement.className = `alert alert-${
    type === "error" ? "danger" : type === "warning" ? "warning" : type === "info" ? "info" : "success"
  } mb-4 feedback-popup`;
  
  feedbackElement.innerHTML = message;
  feedbackElement.style.display = "block";
  
  // Tambahkan style untuk membuat feedback lebih menonjol
  feedbackElement.style.position = "sticky";
  feedbackElement.style.top = "20px";
  feedbackElement.style.zIndex = "1050";
  feedbackElement.style.boxShadow = "0 4px 12px rgba(0,0,0,0.15)";
  feedbackElement.style.borderLeft = type === "error" ? "5px solid #dc3545" : 
                                     type === "warning" ? "5px solid #ffc107" : 
                                     type === "info" ? "5px solid #0dcaf0" : 
                                     "5px solid #198754";
  
  // Tambahkan animasi untuk menarik perhatian
  feedbackElement.style.animation = "feedbackPulse 0.5s ease-in-out";
  
  // Scroll ke elemen dengan posisi di atas viewport
  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
  
  // Auto-hide after specified duration if autoHide is true
  if (autoHide) {
    setTimeout(() => {
      // Tambahkan animasi fade out
      feedbackElement.style.animation = "feedbackFadeOut 0.5s ease-in-out";
      feedbackElement.style.opacity = "0";
      
      setTimeout(() => {
        feedbackElement.style.display = "none";
        // Reset opacity untuk penggunaan berikutnya
        feedbackElement.style.opacity = "1";
      }, 500);
    }, duration);
  }
}


// Update leave history table
function updateLeaveHistoryTable() {
  const tbody = document.getElementById("leaveHistoryList");
  const emptyState = document.getElementById("emptyLeaveHistory");

  if (!tbody) return;

  tbody.innerHTML = "";

  if (leaveHistory.length === 0) {
    if (emptyState) emptyState.style.display = "flex";
    return;
  }

  if (emptyState) emptyState.style.display = "none";

  // Sort by submission date (newest first)
  const sortedHistory = [...leaveHistory].sort((a, b) => {
    return new Date(b.submissionDate || 0) - new Date(a.submissionDate || 0);
  });

  // Display only the 5 most recent requests
  const recentHistory = sortedHistory.slice(0, 5);

  recentHistory.forEach((record) => {
    const row = document.createElement("tr");

    const submissionDate = record.submissionDate ? new Date(record.submissionDate).toLocaleDateString("id-ID") : "-";

    // Format tanggal izin
    let leaveDateDisplay = record.leaveDate || "-";
    if (record.leaveStartDate && record.leaveEndDate) {
      const startDate = new Date(record.leaveStartDate).toLocaleDateString("id-ID", { day: "numeric", month: "short" });
      const endDate = new Date(record.leaveEndDate).toLocaleDateString("id-ID", { day: "numeric", month: "short" });

      if (record.leaveStartDate === record.leaveEndDate) {
        leaveDateDisplay = startDate;
      } else {
        leaveDateDisplay = `${startDate} - ${endDate}`;
      }
    }

    // Format jenis izin
    let leaveTypeDisplay = "Izin Normal";
    if (record.leaveType === "sakit") {
      leaveTypeDisplay = "Izin Sakit";
    } else if (record.leaveType === "cuti") {
      leaveTypeDisplay = "Cuti";
    }

    // Format jenis pengganti
    let replacementTypeDisplay = "Tidak Perlu Diganti";
    if (record.replacementType === "libur") {
      replacementTypeDisplay = "Ganti Libur";
    } else if (record.replacementType === "jam") {
      replacementTypeDisplay = "Ganti Jam";
    }

    const statusClass = record.status === "Disetujui" ? "success" : record.status === "Ditolak" ? "danger" : "warning";

    row.innerHTML = `
    <td>${submissionDate}</td>
    <td>${leaveDateDisplay}</td>
    <td>${leaveTypeDisplay}<br><small class="text-muted">${record.reason}</small></td>
    <td>${replacementTypeDisplay}</td>
    <td><span class="status-badge ${statusClass}">${record.status || "Menunggu Persetujuan"}</span></td>
  `;

    tbody.appendChild(row);
  });
}

// Function to load employee data
async function loadEmployees() {
  try {
    employees = await getEmployees();
  } catch (error) {
    console.error("Error loading employees:", error);
    showFeedback("error", "Gagal memuat data karyawan. Silakan refresh halaman.");
  }
}

// Function to load leave history for an employee
async function loadLeaveHistory(employeeId) {
  try {
    if (!employeeId) return;

    // Save current employee ID to localStorage
    localStorage.setItem("currentEmployeeId", employeeId);

    leaveHistory = await getLeaveRequestsByEmployee(employeeId);
    updateLeaveHistoryTable();
  } catch (error) {
    console.error("Error loading leave history:", error);
    showFeedback("error", "Gagal memuat riwayat izin. Silakan refresh halaman.");
  }
}

// Initialize date inputs with min date validation
function initDateInputs() {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const formattedTomorrow = tomorrow.toISOString().split("T")[0];

  const startDateInput = document.getElementById("leaveStartDate");
  const endDateInput = document.getElementById("leaveEndDate");

  if (startDateInput) {
    startDateInput.min = formattedTomorrow;
  }

  if (endDateInput) {
    endDateInput.min = formattedTomorrow;
  }
}

// Reset button functionality
document.querySelector('button[type="reset"]')?.addEventListener("click", () => {
  // Hide all sections
  const sections = [
    "replacementLibur",
    "replacementJam",
    "sickLeaveSection",
    "leaveSection",
    "multiDateWarning",
    "formFeedback",
    "filePreviewContainer",
  ];

  sections.forEach((id) => {
    const element = document.getElementById(id);
    if (element) element.style.display = "none";
  });

  // Reset replacement dates container to only have one date field
  const container = document.getElementById("replacementDatesContainer");
  if (container) {
    container.innerHTML = `
      <div class="mb-3 replacement-date-item">
        <label for="replacementDate0" class="form-label">Tanggal Ganti Libur 1</label>
        <div class="input-group">
          <span class="input-group-text"><i class="fas fa-calendar-check"></i></span>
          <input type="date" class="form-control replacement-date" id="replacementDate0" />
        </div>
      </div>
    `;
  }

  // Hide add more dates button
  const addMoreDatesBtn = document.getElementById("addMoreDates");
  if (addMoreDatesBtn) {
    addMoreDatesBtn.style.display = "none";
  }
});

// Event listeners for online/offline status
window.addEventListener("online", function () {
  document.querySelectorAll(".offline-alert").forEach((el) => el.remove());
  showFeedback("success", "Koneksi internet tersedia. File yang disimpan sementara dapat diunggah sekarang.");
  checkPendingUploads();
});

window.addEventListener("offline", function () {
  showFeedback("warning", "Anda sedang offline. File akan disimpan sementara dan diunggah saat koneksi tersedia.");
  handleOfflineMode();
});

// Initialize page
document.addEventListener("DOMContentLoaded", () => {
  loadEmployees();
  initDateInputs();

  // Periksa koneksi internet
  checkInternetConnection().then((isOnline) => {
    if (!isOnline) {
      handleOfflineMode();
    }
  });

  // Tambahkan pemeriksaan file yang belum terunggah
  checkPendingUploads();

  // Check for saved employee ID
  const savedEmployeeId = localStorage.getItem("currentEmployeeId");
  if (savedEmployeeId && document.getElementById("employeeId")) {
    document.getElementById("employeeId").value = savedEmployeeId;
    loadLeaveHistory(savedEmployeeId);
  }
});
