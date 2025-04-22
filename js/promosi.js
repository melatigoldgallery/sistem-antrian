// Import Firebase modules
import app, { db, rtdb, auth } from "./configFirebase.js";
import {
  getDatabase,
  ref,
  set,
  get,
  onValue,
  remove,
  push,
} from "https://www.gstatic.com/firebasejs/10.4.0/firebase-database.js";
import { uploadFile, getCloudinaryUrl } from "./services/cloudinary-service.js";

document.addEventListener("DOMContentLoaded", function () {
  // Initialize date and time display
  updateDateTime();
  setInterval(updateDateTime, 1000);

  // Detect which page we're on
  const isDisplayPage = document.querySelector(".fullscreen-container") !== null;
  const isAdminPage = document.querySelector(".app-container") !== null;

  if (isAdminPage) {
    // Check authentication
    checkAuth().then((isAuthenticated) => {
      if (!isAuthenticated) {
        window.location.href = "index.html";
        return;
      }

      // Initialize event listeners for admin page
      initializeEventListeners();

      // Load settings from Firebase
      loadSettingsFromFirebase();

      // Refresh content lists
      refreshEventList();
      refreshCustomList();
      // Update preview carousel
      updatePreviewCarousel();
    });
  } else if (isDisplayPage) {
    // Initialize display page with Firebase
    initializeDisplayPageWithFirebase();
  }
});

// Check if user is authenticated
async function checkAuth() {
  try {
    const user = await new Promise((resolve) => {
      const unsubscribe = auth.onAuthStateChanged((user) => {
        unsubscribe();
        resolve(user);
      });
    });

    return !!user;
  } catch (error) {
    console.error("Auth check error:", error);
    return false;
  }
}

// Update date and time display
function updateDateTime() {
  const now = new Date();
  const dateOptions = { weekday: "long", year: "numeric", month: "long", day: "numeric" };
  const timeOptions = { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false };

  const currentDateElement = document.getElementById("current-date");
  const currentTimeElement = document.getElementById("current-time");

  if (currentDateElement) {
    currentDateElement.textContent = now.toLocaleDateString("id-ID", dateOptions);
  }

  if (currentTimeElement) {
    currentTimeElement.textContent = now.toLocaleTimeString("id-ID", timeOptions);
  }

  // Update last update time for gold price if element exists
  const lastUpdateElement = document.getElementById("last-update");
  if (lastUpdateElement) {
    const hours = now.getHours().toString().padStart(2, "0");
    const minutes = now.getMinutes().toString().padStart(2, "0");
    lastUpdateElement.textContent = `${hours}:${minutes} WIB`;
  }
}

// Initialize display page with Firebase
function initializeDisplayPageWithFirebase() {
  // Listen for settings changes
  const settingsRef = ref(rtdb, "settings/promotion");
  onValue(settingsRef, (snapshot) => {
    const settings = snapshot.val() || {};
    applySettings(settings);
  });

  // Listen for content changes
  const contentRef = ref(rtdb, "content/promotion");
  onValue(contentRef, (snapshot) => {
    const content = snapshot.val() || {};
    updateCarouselContent(content);
  });

  // Initialize AOS if available
  if (typeof AOS !== "undefined") {
    AOS.init({
      duration: 1000,
      once: true,
    });
  }
}

// Apply settings to the carousel
function applySettings(settings) {
  const slideInterval = settings.slideInterval || 30;
  const transitionEffect = settings.transitionEffect || "fade";
  const enableAnimation = settings.enableAnimation !== false;
  const showControls = settings.showControls !== false;

  const carousel = document.getElementById("promotionFullscreen") || document.getElementById("promotionCarousel");
  if (carousel) {
    // Set interval (convert to milliseconds)
    carousel.setAttribute("data-bs-interval", slideInterval * 1000);

    // Apply transition effect
    carousel.classList.remove("carousel-fade");
    document.querySelectorAll(".carousel-item").forEach((item) => {
      item.classList.remove("zoom-effect");
    });

    if (transitionEffect === "fade") {
      carousel.classList.add("carousel-fade");
    } else if (transitionEffect === "zoom") {
      document.querySelectorAll(".carousel-item").forEach((item) => {
        item.classList.add("zoom-effect");
      });
    }

    // Apply animation settings
    if (!enableAnimation) {
      document.querySelectorAll(".slide-content").forEach((content) => {
        content.classList.add("no-animation");
      });
    } else {
      document.querySelectorAll(".slide-content").forEach((content) => {
        content.classList.remove("no-animation");
      });
    }

    // Show/hide controls
    const controls = carousel.querySelectorAll(".carousel-control-prev, .carousel-control-next");
    controls.forEach((control) => {
      control.style.display = showControls ? "flex" : "none";
    });

    // Initialize or update Bootstrap carousel
    let bsCarousel = bootstrap.Carousel.getInstance(carousel);
    if (bsCarousel) {
      bsCarousel.dispose();
    }

    bsCarousel = new bootstrap.Carousel(carousel, {
      interval: slideInterval * 1000,
      wrap: true,
      keyboard: false,
    });
  }
}

// Update carousel content based on Firebase data
function updateCarouselContent(content) {
  const carouselInner =
    document.querySelector("#promotionFullscreen .carousel-inner") ||
    document.querySelector("#promotionCarousel .carousel-inner");
  const carouselIndicators =
    document.querySelector("#promotionFullscreen .carousel-indicators") ||
    document.querySelector("#promotionCarousel .carousel-indicators");

  if (!carouselInner || !carouselIndicators) return;

  // Clear existing content
  carouselInner.innerHTML = "";
  carouselIndicators.innerHTML = "";

  // Combine all content types
  let allSlides = [];

  // Add events if they exist
  if (content.events) {
    // Convert to array if it's an object
    const events =
      typeof content.events === "object" && !Array.isArray(content.events)
        ? Object.values(content.events)
        : content.events;

    allSlides = allSlides.concat(events.filter((event) => event && event.isActive));
  }

  // Add custom items if they exist
  if (content.customItems) {
    // Convert to array if it's an object
    const customItems =
      typeof content.customItems === "object" && !Array.isArray(content.customItems)
        ? Object.values(content.customItems)
        : content.customItems;

    allSlides = allSlides.concat(customItems.filter((item) => item && item.isActive));
  }

  // Sort slides if needed (e.g., by priority or date)
  allSlides.sort((a, b) => (a.order || 0) - (b.order || 0));

  // Add slides to carousel
  allSlides.forEach((slide, index) => {
    // Create indicator
    const indicator = document.createElement("button");
    indicator.setAttribute("type", "button");
    indicator.setAttribute("data-bs-target", carouselInner.closest(".carousel").id);
    indicator.setAttribute("data-bs-slide-to", index.toString());
    if (index === 0) {
      indicator.classList.add("active");
      indicator.setAttribute("aria-current", "true");
    }
    indicator.setAttribute("aria-label", `Slide ${index + 1}`);
    carouselIndicators.appendChild(indicator);

    // Create slide based on type
    const slideElement = document.createElement("div");
    slideElement.classList.add("carousel-item");
    if (index === 0) slideElement.classList.add("active");

    // Determine slide content based on type
    if (slide.type === "event") {
      slideElement.innerHTML = createEventSlide(slide);
    } else if (slide.type === "custom") {
      slideElement.innerHTML = createCustomSlide(slide);
    }

    carouselInner.appendChild(slideElement);
  });

  // Reinitialize AOS for new content
  if (typeof AOS !== "undefined") {
    AOS.refresh();
  }

  // If no content, show default slide
  if (allSlides.length === 0) {
    addDefaultSlide(carouselInner, carouselIndicators);
  }
}

// Fungsi untuk memperbarui pratinjau
function updatePreview(content) {
  const previewCarousel = document.getElementById("promotionCarousel");
  if (!previewCarousel) return;

  const carouselInner = previewCarousel.querySelector(".carousel-inner");
  const carouselIndicators = previewCarousel.querySelector(".carousel-indicators");

  // Clear existing content
  carouselInner.innerHTML = "";
  carouselIndicators.innerHTML = "";

  // Combine all content types
  let allSlides = [];

  // Add events if they exist
  if (content.events) {
    const events =
      typeof content.events === "object" && !Array.isArray(content.events)
        ? Object.values(content.events)
        : content.events;

    allSlides = allSlides.concat(events.filter((event) => event && event.isActive));
  }

  // Add custom items if they exist
  if (content.customItems) {
    const customItems =
      typeof content.customItems === "object" && !Array.isArray(content.customItems)
        ? Object.values(content.customItems)
        : content.customItems;

    allSlides = allSlides.concat(customItems.filter((item) => item && item.isActive));
  }

  // Sort slides if needed
  allSlides.sort((a, b) => (a.order || 0) - (b.order || 0));

  // If no slides, show default
  if (allSlides.length === 0) {
    carouselInner.innerHTML = `
      <div class="carousel-item active">
        <div class="thank-you-slide">
          <div class="slide-content">
            <div class="slide-title-badge">Default: Terima Kasih</div>
            <h2>Terima Kasih</h2>
            <h3>Telah Mengunjungi Melati Gold Shop</h3>
            <p>Kami sangat menghargai kepercayaan Anda</p>
            <div class="logo-container">
              <img src="img/Melati.jfif" alt="Melati Gold Shop Logo" class="slide-logo">
            </div>
          </div>
        </div>
      </div>
    `;

    carouselIndicators.innerHTML = `
      <button type="button" data-bs-target="#promotionCarousel" data-bs-slide-to="0" class="active" aria-current="true" aria-label="Slide 1"></button>
    `;

    return;
  }

  // Add slides to carousel
  allSlides.forEach((slide, index) => {
    // Create indicator
    const indicator = document.createElement("button");
    indicator.setAttribute("type", "button");
    indicator.setAttribute("data-bs-target", "#promotionCarousel");
    indicator.setAttribute("data-bs-slide-to", index.toString());
    if (index === 0) {
      indicator.classList.add("active");
      indicator.setAttribute("aria-current", "true");
    }
    indicator.setAttribute("aria-label", `Slide ${index + 1}`);
    carouselIndicators.appendChild(indicator);

    // Create slide based on type
    const slideElement = document.createElement("div");
    slideElement.classList.add("carousel-item");
    if (index === 0) slideElement.classList.add("active");

    // Determine slide content based on type
    if (slide.type === "event") {
      slideElement.innerHTML = createPreviewEventSlide(slide);
    } else if (slide.type === "custom") {
      slideElement.innerHTML = createPreviewCustomSlide(slide);
    }

    carouselInner.appendChild(slideElement);
  });
}

// Fungsi untuk membuat slide event untuk pratinjau
function createPreviewEventSlide(slide) {
  return `
    <div class="promo-slide">
      <div class="slide-content">
        <div class="slide-title-badge"><h5>${slide.title}</h5></div>
        <h3>${slide.subtitle || ""}</h3>
        ${
          slide.imageUrl
            ? `<div class="preview-image-container"><img src="${slide.imageUrl}" alt="${slide.title}" class="promo-image"></div>`
            : ""
        }
        ${slide.highlight ? `<div class="promo-highlight">${slide.highlight}</div>` : ""}
      </div>
    </div>
  `;
}

// Fungsi untuk membuat slide kustom untuk pratinjau
function createPreviewCustomSlide(slide) {
  if (slide.contentType === "HTML") {
    return `
      <div class="custom-slide">
        <div class="slide-content">
          <div class="slide-title-badge"><h5>${slide.title}</h5></div>
          <h2>${slide.title}</h2>
          <div class="preview-html-content">
            ${slide.htmlContent || "<p>No content available</p>"}
          </div>
        </div>
      </div>
    `;
  } else if (slide.contentType === "Gambar") {
    return `
      <div class="custom-slide">
        <div class="slide-content">
          <div class="slide-title-badge"><h5>${slide.title}</h5></div>
          
          <div class="preview-image-container">
            <img src="${slide.fileUrl}" alt="${slide.title}" class="preview-image">
          </div>
        </div>
      </div>
    `;
  } else if (slide.contentType === "Video") {
    return `
      <div class="custom-slide">
        <div class="slide-content">
          <div class="slide-title-badge"><h5>${slide.title}</h5></div>
          
          <div class="preview-video-container">
            <video src="${slide.fileUrl}" controls muted class="preview-video"></video>
          </div>
        </div>
      </div>
    `;
  } else if (slide.contentType === "Gallery") {
    const galleryItems = (slide.images || [])
      .map(
        (img) => `
      <div class="preview-gallery-item">
        <img src="${img.url}" alt="${img.caption || ""}" class="gallery-img">
        ${img.caption ? `<div class="preview-item-caption">${img.caption}</div>` : ""}
      </div>
    `
      )
      .join("");

    return `
      <div class="custom-slide">
        <div class="slide-content">
          <div class="slide-title-badge"><h5>${slide.title}</h5></div>
          
          <div class="preview-gallery">
            ${galleryItems}
          </div>
        </div>
      </div>
    `;
  }

  return "";
}

// Add default slide when no content is available
function addDefaultSlide(carouselInner, carouselIndicators) {
  carouselInner.innerHTML = `
    <div class="carousel-item active">
      <div class="thank-you-slide elegant-gold">
        <div class="slide-content" data-aos="fade-up">
          <div class="decorative-element left"></div>
          <div class="content-wrapper">
            <h2>Terima Kasih</h2>
            <div class="divider"><span><i class="fas fa-gem"></i></span></div>
            <h3>Telah Mengunjungi Melati Gold Shop</h3>
            <p>Kami sangat menghargai kepercayaan Anda</p>
            <div class="logo-container">
              <img src="img/Melati.jfif" alt="Melati Gold Shop Logo" class="slide-logo">
            </div>
          </div>
          <div class="decorative-element right"></div>
        </div>
      </div>
    </div>
  `;

  // Add default indicator
  const indicator = document.createElement("button");
  indicator.setAttribute("type", "button");
  indicator.setAttribute("data-bs-target", carouselInner.closest(".carousel").id);
  indicator.setAttribute("data-bs-slide-to", "0");
  indicator.classList.add("active");
  indicator.setAttribute("aria-current", "true");
  indicator.setAttribute("aria-label", "Slide 1");
  carouselIndicators.appendChild(indicator);
}

// Create HTML for event slide
function createEventSlide(slide) {
  return `
    <div class="promo-slide ${slide.variant || "luxury-gold"}">
      <div class="slide-content" data-aos="fade-up">
        <div class="decorative-element left"></div>
        <div class="content-wrapper">
          <h2>${slide.title}</h2>
          <div class="divider"><span><i class="fas fa-${slide.icon || "percentage"}"></i></span></div>
          <h3>${slide.subtitle || ""}</h3>
          ${slide.imageUrl ? `<img src="${slide.imageUrl}" alt="${slide.title}" class="promo-image">` : ""}
          ${
            slide.highlight
              ? `
            <div class="promo-highlight">
              <span class="highlight-text">${slide.highlight}</span>
            </div>
          `
              : ""
          }
        </div>
        <div class="decorative-element right"></div>
      </div>
    </div>
  `;
}

// Create HTML for custom slide
function createCustomSlide(slide) {
  if (slide.contentType === "HTML") {
    return slide.htmlContent;
  } else if (slide.contentType === "Gambar") {
    return `
      <div class="custom-slide collection-display">
        <div class="slide-content" data-aos="fade-up">
          <div class="decorative-element left"></div>
          <div class="content-wrapper">
            <h2>${slide.title}</h2>
            <div class="divider"><span><i class="fas fa-image"></i></span></div>
            <div class="image-container">
              <img src="${slide.fileUrl}" alt="${slide.title}" class="custom-image">
            </div>
          </div>
          <div class="decorative-element right"></div>
        </div>
      </div>
    `;
  } else if (slide.contentType === "Video") {
    return `
      <div class="custom-slide">
        <div class="slide-content" data-aos="fade-up">
          <div class="decorative-element left"></div>
          <div class="content-wrapper">
            <h2>${slide.title}</h2>
            <div class="divider"><span><i class="fas fa-video"></i></span></div>
            <div class="video-container">
              <video src="${slide.fileUrl}" controls autoplay muted loop class="custom-video"></video>
            </div>
          </div>
          <div class="decorative-element right"></div>
        </div>
      </div>
    `;
  } else if (slide.contentType === "Gallery") {
    const galleryItems = (slide.images || [])
      .map(
        (img) => `
      <div class="gallery-item">
        <img src="${img.url}" alt="${img.caption || ""}" class="gallery-img">
        ${img.caption ? `<div class="item-caption">${img.caption}</div>` : ""}
      </div>
    `
      )
      .join("");

    return `
      <div class="custom-slide collection-display">
        <div class="slide-content" data-aos="fade-up">
          <div class="decorative-element left"></div>
          <div class="content-wrapper">
            <h2>${slide.title}</h2>
            <div class="divider"><span><i class="fas fa-${slide.icon || "crown"}"></i></span></div>
            <div class="image-gallery">
              ${galleryItems}
            </div>
          </div>
          <div class="decorative-element right"></div>
        </div>
      </div>
    `;
  }

  return "";
}

// Initialize all event listeners for admin page
function initializeEventListeners() {
  // Settings buttons
  const saveSettingsBtn = document.getElementById("saveSettingsBtn");
  if (saveSettingsBtn) {
    saveSettingsBtn.addEventListener("click", saveSettingsToFirebase);
  }

  const previewBtn = document.getElementById("previewBtn");
  if (previewBtn) {
    previewBtn.addEventListener("click", openPreview);
  }

  // Events
  const addEventBtn = document.getElementById("addEventBtn");
  if (addEventBtn) {
    addEventBtn.addEventListener("click", () => openEventModal());
  }

  const saveEventBtn = document.getElementById("saveEvent");
  if (saveEventBtn) {
    saveEventBtn.addEventListener("click", saveEventToFirebase);
  }

  // Custom content
  const addCustomBtn = document.getElementById("addCustomBtn");
  if (addCustomBtn) {
    addCustomBtn.addEventListener("click", () => openCustomModal());
  }

  const saveCustomBtn = document.getElementById("saveCustom");
  if (saveCustomBtn) {
    saveCustomBtn.addEventListener("click", saveCustomToFirebase);
  }

  const customType = document.getElementById("customType");
  if (customType) {
    customType.addEventListener("change", toggleCustomContentFields);
  }

  // Logout button
  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", handleLogout);
  }

  // Set up the tabs to be active on click
  const promoTabs = document.querySelectorAll("#promoTabs .nav-link");
  if (promoTabs.length > 0) {
    // Set the first tab as active by default
    if (!document.querySelector("#promoTabs .nav-link.active")) {
      promoTabs[0].classList.add("active");
      const targetId = promoTabs[0].getAttribute("data-bs-target");
      const targetPane = document.querySelector(targetId);
      if (targetPane) {
        targetPane.classList.add("active", "show");
      }
    }
  }

  // Setup edit and delete listeners
  setupEditDeleteListeners();
}

// Load settings from Firebase
function loadSettingsFromFirebase() {
  const settingsRef = ref(rtdb, "settings/promotion");
  onValue(settingsRef, (snapshot) => {
    const settings = snapshot.val() || {};

    // Set form values if elements exist
    const slideIntervalElement = document.getElementById("slideInterval");
    if (slideIntervalElement) {
      slideIntervalElement.value = settings.slideInterval || 30;
    }

    const transitionEffectElement = document.getElementById("transitionEffect");
    if (transitionEffectElement) {
      transitionEffectElement.value = settings.transitionEffect || "fade";
    }

    const autoPlaySwitchElement = document.getElementById("autoPlaySwitch");
    if (autoPlaySwitchElement) {
      autoPlaySwitchElement.checked = settings.autoPlay !== false;
    }

    const showControlsSwitchElement = document.getElementById("showControlsSwitch");
    if (showControlsSwitchElement) {
      showControlsSwitchElement.checked = settings.showControls !== false;
    }

    // Apply settings to preview carousel
    applySettingsToPreview(settings);
  });

  // Tambahkan listener untuk konten promosi
  const contentRef = ref(rtdb, "content/promotion");
  onValue(contentRef, () => {
    // Update preview carousel when content changes
    updatePreviewCarousel();
  });
}

// Save settings to Firebase
function saveSettingsToFirebase() {
  const slideIntervalElement = document.getElementById("slideInterval");
  const transitionEffectElement = document.getElementById("transitionEffect");
  const autoPlaySwitchElement = document.getElementById("autoPlaySwitch");
  const showControlsSwitchElement = document.getElementById("showControlsSwitch");

  if (!slideIntervalElement || !transitionEffectElement || !autoPlaySwitchElement || !showControlsSwitchElement) {
    console.error("One or more settings elements not found");
    return;
  }

  const slideInterval = parseInt(slideIntervalElement.value) || 30;
  const transitionEffect = transitionEffectElement.value || "fade";
  const autoPlay = autoPlaySwitchElement.checked;
  const showControls = showControlsSwitchElement.checked;

  // Create settings object
  const settings = {
    slideInterval,
    transitionEffect,
    autoPlay,
    showControls,
    enableAnimation: true, // Default value
    lastUpdated: new Date().toISOString(),
  };

  // Save to Firebase
  set(ref(rtdb, "settings/promotion"), settings)
    .then(() => {
      showToast("Pengaturan berhasil disimpan", "success");

      // Apply settings to preview carousel
      applySettingsToPreview(settings);
    })
    .catch((error) => {
      console.error("Error saving settings:", error);
      showToast("Gagal menyimpan pengaturan", "error");
    });
}

// Apply settings to preview carousel
function applySettingsToPreview(settings) {
  const slideInterval = settings.slideInterval || 30;
  const transitionEffect = settings.transitionEffect || "fade";
  const autoPlay = settings.autoPlay !== false;
  const showControls = settings.showControls !== false;

  const previewCarousel = document.getElementById("promotionCarousel");
  if (previewCarousel) {
    // Set interval
    previewCarousel.setAttribute("data-bs-interval", autoPlay ? slideInterval * 1000 : "false");

    // Apply transition effect
    previewCarousel.classList.remove("carousel-fade");
    document.querySelectorAll("#promotionCarousel .carousel-item").forEach((item) => {
      item.classList.remove("zoom-effect");
    });

    if (transitionEffect === "fade") {
      previewCarousel.classList.add("carousel-fade");
    } else if (transitionEffect === "zoom") {
      document.querySelectorAll("#promotionCarousel .carousel-item").forEach((item) => {
        item.classList.add("zoom-effect");
      });
    }

    // Show/hide controls
    const controls = previewCarousel.querySelectorAll(".carousel-control-prev, .carousel-control-next");
    controls.forEach((control) => {
      control.style.display = showControls ? "flex" : "none";
    });

    // Reinitialize carousel if needed
    const bsCarousel = bootstrap.Carousel.getInstance(previewCarousel);
    if (bsCarousel) {
      if (autoPlay) {
        bsCarousel.cycle();
      } else {
        bsCarousel.pause();
      }
    }
  }
}

// Open preview modal
function openPreview() {
  const previewModal = document.getElementById("previewModal");
  if (previewModal) {
    const modal = new bootstrap.Modal(previewModal);
    modal.show();

    // Apply current settings to the preview carousel
    const fullscreenCarousel = document.getElementById("fullscreenCarousel");
    if (fullscreenCarousel) {
      // Get settings from Firebase
      const settingsRef = ref(rtdb, "settings/promotion");
      get(settingsRef)
        .then((snapshot) => {
          const settings = snapshot.val() || {};

          const slideInterval = settings.slideInterval || 30;
          const transitionEffect = settings.transitionEffect || "fade";
          const autoPlay = settings.autoPlay !== false;

          // Set interval
          fullscreenCarousel.setAttribute("data-bs-interval", autoPlay ? slideInterval * 1000 : "false");

          // Apply transition effect
          fullscreenCarousel.classList.remove("carousel-fade");
          document.querySelectorAll("#fullscreenCarousel .carousel-item").forEach((item) => {
            item.classList.remove("zoom-effect");
          });

          if (transitionEffect === "fade") {
            fullscreenCarousel.classList.add("carousel-fade");
          } else if (transitionEffect === "zoom") {
            document.querySelectorAll("#fullscreenCarousel .carousel-item").forEach((item) => {
              item.classList.add("zoom-effect");
            });
          }

          // Initialize carousel
          const bsCarousel = bootstrap.Carousel.getInstance(fullscreenCarousel);
          if (bsCarousel) {
            bsCarousel.dispose();
          }

          new bootstrap.Carousel(fullscreenCarousel, {
            interval: autoPlay ? slideInterval * 1000 : false,
            wrap: true,
          });
        })
        .catch((error) => {
          console.error("Error getting settings:", error);
        });
    }
  }
}

// Fungsi untuk memperbarui carousel pratinjau dengan konten dari Firebase
function updatePreviewCarousel() {
  const carouselInner = document.querySelector("#promotionCarousel .carousel-inner");
  const carouselIndicators = document.querySelector("#promotionCarousel .carousel-indicators");

  if (!carouselInner || !carouselIndicators) return;

  // Dapatkan data dari Firebase
  Promise.all([get(ref(rtdb, "content/promotion/events")), get(ref(rtdb, "content/promotion/customItems"))])
    .then(([eventsSnapshot, customItemsSnapshot]) => {
      // Clear existing content
      carouselInner.innerHTML = "";
      carouselIndicators.innerHTML = "";

      // Combine all content types
      let allSlides = [];

      // Add events if they exist
      const events = eventsSnapshot.val() || {};
      allSlides = allSlides.concat(Object.values(events).filter((event) => event && event.isActive));

      // Add custom items if they exist
      const customItems = customItemsSnapshot.val() || {};
      allSlides = allSlides.concat(Object.values(customItems).filter((item) => item && item.isActive));

      // Sort slides if needed
      allSlides.sort((a, b) => (a.order || 0) - (b.order || 0));

      // If no slides, show default
      if (allSlides.length === 0) {
        carouselInner.innerHTML = `
        <div class="carousel-item active">
          <div class="thank-you-slide">
            <div class="slide-content">
              <div class="slide-title-badge">Default: Terima Kasih</div>
              <h2>Terima Kasih</h2>
              <h3>Telah Mengunjungi Melati Gold Shop</h3>
              <p>Kami sangat menghargai kepercayaan Anda</p>
              <div class="logo-container">
                <img src="img/Melati.jfif" alt="Melati Gold Shop Logo" class="slide-logo">
              </div>
            </div>
          </div>
        </div>
      `;

        carouselIndicators.innerHTML = `
        <button type="button" data-bs-target="#promotionCarousel" data-bs-slide-to="0" class="active" aria-current="true" aria-label="Slide 1"></button>
      `;

        return;
      }

      // Add slides to carousel
      allSlides.forEach((slide, index) => {
        // Create indicator
        const indicator = document.createElement("button");
        indicator.setAttribute("type", "button");
        indicator.setAttribute("data-bs-target", "#promotionCarousel");
        indicator.setAttribute("data-bs-slide-to", index.toString());
        if (index === 0) {
          indicator.classList.add("active");
          indicator.setAttribute("aria-current", "true");
        }
        indicator.setAttribute("aria-label", `Slide ${index + 1}`);
        carouselIndicators.appendChild(indicator);

        // Create slide based on type
        const slideElement = document.createElement("div");
        slideElement.classList.add("carousel-item");
        if (index === 0) slideElement.classList.add("active");

        // Determine slide content based on type
        if (slide.type === "event") {
          slideElement.innerHTML = createPreviewEventSlide(slide);
        } else if (slide.type === "custom") {
          slideElement.innerHTML = createPreviewCustomSlide(slide);
        }

        carouselInner.appendChild(slideElement);
      });

      // Reinitialize carousel
      const carousel = document.getElementById("promotionCarousel");
      const bsCarousel = bootstrap.Carousel.getInstance(carousel);
      if (bsCarousel) {
        bsCarousel.dispose();
      }

      // Get settings
      get(ref(rtdb, "settings/promotion")).then((snapshot) => {
        const settings = snapshot.val() || {};
        applySettingsToPreview(settings);
      });
    })
    .catch((error) => {
      console.error("Error getting promotion content:", error);
      showToast("Gagal memuat konten promosi", "error");
    });
}

// Fungsi untuk membersihkan modal backdrop yang tersisa
function cleanupModalBackdrop() {
  // Hapus semua modal-backdrop yang tersisa
  document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
    backdrop.remove();
  });
  
  // Hapus class modal-open dari body
  document.body.classList.remove('modal-open');
  document.body.style.overflow = '';
  document.body.style.paddingRight = '';
}

// Tambahkan event listener untuk semua modal
document.addEventListener('DOMContentLoaded', function() {
  const modals = ['eventModal', 'customModal', 'previewModal'];
  
  modals.forEach(modalId => {
    const modalElement = document.getElementById(modalId);
    if (modalElement) {
      modalElement.addEventListener('hidden.bs.modal', function() {
        // Bersihkan modal backdrop setelah modal ditutup
        setTimeout(cleanupModalBackdrop, 100);
      });
    }
  });
});


// Tambahkan event listener untuk semua modal
document.addEventListener('DOMContentLoaded', function() {
  const modals = ['eventModal', 'customModal', 'previewModal'];
  
  modals.forEach(modalId => {
    const modalElement = document.getElementById(modalId);
    if (modalElement) {
      modalElement.addEventListener('hidden.bs.modal', function() {
        // Bersihkan modal backdrop setelah modal ditutup
        setTimeout(cleanupModalBackdrop, 100);
      });
    }
  });
});


// Event Functions with Firebase and Cloudinary
function openEventModal(isEdit = false) {
  // Reset form if not editing
  if (!isEdit) {
    const eventIdElement = document.getElementById("eventId");
    const eventTitleElement = document.getElementById("eventTitle");
    const eventStartDateElement = document.getElementById("eventStartDate");
    const eventEndDateElement = document.getElementById("eventEndDate");
    const eventImageElement = document.getElementById("eventImage");
    const eventActiveElement = document.getElementById("eventActive");

    if (eventIdElement) eventIdElement.value = "";
    if (eventTitleElement) eventTitleElement.value = "";
    if (eventStartDateElement) eventStartDateElement.value = "";
    if (eventEndDateElement) eventEndDateElement.value = "";
    if (eventImageElement) eventImageElement.value = "";
    if (eventActiveElement) eventActiveElement.checked = true;
  }

  // Update modal title
  const eventModalLabelElement = document.getElementById("eventModalLabel");
  if (eventModalLabelElement) {
    eventModalLabelElement.textContent = isEdit ? "Edit Event" : "Tambah Event";
  }

  // Show modal
  const eventModal = document.getElementById("eventModal");
  if (eventModal) {
    const modal = new bootstrap.Modal(eventModal);
    modal.show();
  }
}

function saveEventToFirebase() {
  const eventIdElement = document.getElementById("eventId");
  const eventTitleElement = document.getElementById("eventTitle");
  const eventStartDateElement = document.getElementById("eventStartDate");
  const eventEndDateElement = document.getElementById("eventEndDate");
  const eventImageElement = document.getElementById("eventImage");
  const eventActiveElement = document.getElementById("eventActive");

  if (!eventTitleElement || !eventStartDateElement || !eventActiveElement) {
    console.error("One or more event form elements not found");
    return;
  }

  const id = eventIdElement.value || Date.now().toString();
  const title = eventTitleElement.value;
  const startDate = eventStartDateElement.value;
  const endDate = eventEndDateElement.value;
  const isActive = eventActiveElement.checked;

  // Validate inputs
  if (!title || !startDate) {
    showToast("Judu dan tanggal mulai harus diisi", "error");
    return;
  }

  // Handle image upload with Cloudinary
  const imageFile = eventImageElement.files && eventImageElement.files[0];

  // Function to save event data after image upload (if any)
  const saveEventData = (imageUrl = null) => {
    // Create event object
    const event = {
      id,
      type: "event",
      title,
      startDate,
      endDate,
      isActive,
      variant: "luxury-gold", // Default variant
      icon: "percentage", // Default icon
      lastUpdated: new Date().toISOString(),
    };

    // Add image URL if available
    if (imageUrl) {
      event.imageUrl = imageUrl;
    }

    // Save to Firebase
    set(ref(rtdb, `content/promotion/events/${id}`), event)
      .then(() => {
         // Close modal
    const eventModal = document.getElementById('eventModal');
    if (eventModal) {
      const modal = bootstrap.Modal.getInstance(eventModal);
      if (modal) {
        modal.hide();
        setTimeout(cleanupModalBackdrop, 100);
      }
    }

        showToast("Event berhasil disimpan", "success");

        // Refresh list
        refreshEventList();

        // Update preview
        get(ref(rtdb, "content/promotion")).then((snapshot) => {
          updatePreview(snapshot.val() || {});
        });
      })
      .catch((error) => {
        console.error("Error saving event:", error);
        showToast("Gagal menyimpan event", "error");
      });
  };

  if (imageFile) {
    // Show loading indicator
    showToast("Mengunggah gambar...", "info");

    // Upload to Cloudinary using our service
    uploadFile(imageFile, "promotion/events")
      .then((result) => {
        if (result.url) {
          saveEventData(result.url);
        } else {
          throw new Error("Failed to get image URL from Cloudinary");
        }
      })
      .catch((error) => {
        console.error("Error uploading image:", error);
        showToast("Gagal mengunggah gambar", "error");

        // Still save the event without image
        saveEventData();
      });
  } else {
    // If no new image, check if we're editing and keep the existing image URL
    if (eventIdElement.value) {
      const eventRef = ref(rtdb, `content/promotion/events/${id}`);
      get(eventRef)
        .then((snapshot) => {
          const existingEvent = snapshot.val();
          saveEventData(existingEvent?.imageUrl);
        })
        .catch((error) => {
          console.error("Error getting existing event:", error);
          saveEventData();
        });
    } else {
      // New event without image
      saveEventData();
    }
  }
}

function editEvent(id) {
  // Get data from Firebase
  const eventRef = ref(rtdb, `content/promotion/events/${id}`);
  get(eventRef)
    .then((snapshot) => {
      const event = snapshot.val();

      if (event) {
        // Populate form
        const eventIdElement = document.getElementById("eventId");
        const eventTitleElement = document.getElementById("eventTitle");
        const eventStartDateElement = document.getElementById("eventStartDate");
        const eventEndDateElement = document.getElementById("eventEndDate");
        const eventActiveElement = document.getElementById("eventActive");

        if (eventIdElement) eventIdElement.value = event.id;
        if (eventTitleElement) eventTitleElement.value = event.title;
        if (eventStartDateElement) eventStartDateElement.value = event.startDate;
        if (eventEndDateElement) eventEndDateElement.value = event.endDate || "";
        if (eventActiveElement) eventActiveElement.checked = event.isActive;

        // Open modal in edit mode
        openEventModal(true);
      }
    })
    .catch((error) => {
      console.error("Error getting event:", error);
      showToast("Gagal mendapatkan data event", "error");
    });
}

function deleteEvent(id) {
  if (confirm("Apakah Anda yakin ingin menghapus event ini?")) {
    // Delete from Firebase
    remove(ref(rtdb, `content/promotion/events/${id}`))
      .then(() => {
        showToast("Event berhasil dihapus", "success");
        refreshEventList();
      })
      .catch((error) => {
        console.error("Error deleting event:", error);
        showToast("Gagal menghapus event", "error");
      });
  }
}

function refreshEventList() {
  const eventList = document.getElementById("eventList");
  if (!eventList) return;

  // Get data from Firebase
  const eventRef = ref(rtdb, "content/promotion/events");
  onValue(eventRef, (snapshot) => {
    // Clear current list
    eventList.innerHTML = "";

    const data = snapshot.val() || {};
    const events = Object.values(data);

    // Add each item to the list
    events.forEach((event, index) => {
      const row = document.createElement("tr");

      // Format dates
      const startDate = new Date(event.startDate);
      let dateDisplay = startDate.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });

      if (event.endDate) {
        const endDate = new Date(event.endDate);
        dateDisplay += " - " + endDate.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
      }

      // Determine status
      let status = "Aktif";
      let statusClass = "bg-success";

      if (!event.isActive) {
        status = "Tidak Aktif";
        statusClass = "bg-secondary";
      } else {
        const now = new Date();
        const start = new Date(event.startDate);

        if (start > now) {
          status = "Mendatang";
          statusClass = "bg-warning";
        } else if (event.endDate && new Date(event.endDate) < now) {
          status = "Selesai";
          statusClass = "bg-secondary";
        }
      }

      row.innerHTML = `
        <td>${index + 1}</td>
        <td>${event.title}</td>
        <td>${dateDisplay}</td>
        <td><span class="badge ${statusClass}">${status}</span></td>
        <td>
          <button class="btn btn-sm btn-info edit-event" data-id="${event.id}">
            <i class="fas fa-edit"></i>
          </button>
          <button class="btn btn-sm btn-danger delete-event" data-id="${event.id}">
            <i class="fas fa-trash"></i>
          </button>
        </td>
      `;
      eventList.appendChild(row);
    });

    // Re-attach event listeners
    setupEditDeleteListeners();
  });
  updatePreviewCarousel();
}

// Custom Content Functions with Firebase and Cloudinary
function openCustomModal(isEdit = false) {
  // Reset form if not editing
  if (!isEdit) {
    const customIdElement = document.getElementById("customId");
    const customTitleElement = document.getElementById("customTitle");
    const customTypeElement = document.getElementById("customType");
    const customFileElement = document.getElementById("customFile");
    const customHtmlElement = document.getElementById("customHtml");
    const customActiveElement = document.getElementById("customActive");

    if (customIdElement) customIdElement.value = "";
    if (customTitleElement) customTitleElement.value = "";
    if (customTypeElement) customTypeElement.value = "";
    if (customFileElement) customFileElement.value = "";
    if (customHtmlElement) customHtmlElement.value = "";
    if (customActiveElement) customActiveElement.checked = true;

    // Hide HTML field initially
    const contentHtmlElement = document.querySelector(".content-html");
    const contentUploadElement = document.querySelector(".content-upload");

    if (contentHtmlElement) contentHtmlElement.classList.add("d-none");
    if (contentUploadElement) contentUploadElement.classList.remove("d-none");
  }

  // Update modal title
  const customModalLabelElement = document.getElementById("customModalLabel");
  if (customModalLabelElement) {
    customModalLabelElement.textContent = isEdit ? "Edit Konten Kustom" : "Tambah Konten Kustom";
  }

  // Show modal
  const customModal = document.getElementById("customModal");
  if (customModal) {
    const modal = new bootstrap.Modal(customModal);
    modal.show();
  }
}

function toggleCustomContentFields() {
  const contentType = document.getElementById("customType").value;
  const contentUpload = document.querySelector(".content-upload");
  const contentHtml = document.querySelector(".content-html");

  if (contentType === "HTML") {
    if (contentUpload) contentUpload.classList.add("d-none");
    if (contentHtml) contentHtml.classList.remove("d-none");
  } else {
    if (contentUpload) contentUpload.classList.remove("d-none");
    if (contentHtml) contentHtml.classList.add("d-none");
  }
}

function saveCustomToFirebase() {
  const customIdElement = document.getElementById("customId");
  const customTitleElement = document.getElementById("customTitle");
  const customTypeElement = document.getElementById("customType");
  const customFileElement = document.getElementById("customFile");
  const customHtmlElement = document.getElementById("customHtml");
  const customActiveElement = document.getElementById("customActive");

  if (!customTitleElement || !customTypeElement || !customActiveElement) {
    console.error("One or more custom content form elements not found");
    return;
  }

  const id = customIdElement.value || Date.now().toString();
  const title = customTitleElement.value;
  const contentType = customTypeElement.value;
  const isActive = customActiveElement.checked;

  // Validate inputs
  if (!title || !contentType) {
    showToast("Judul dan jenis konten harus diisi", "error");
    return;
  }

  // Function to save custom content data
  const saveCustomData = (contentData = {}) => {
    // Create custom content object
    const customContent = {
      id,
      type: "custom",
      contentType,
      title,
      isActive,
      ...contentData,
      lastUpdated: new Date().toISOString(),
    };

    // Save to Firebase
    set(ref(rtdb, `content/promotion/customItems/${id}`), customContent)
      .then(() => {
         // Close modal
    const customModal = document.getElementById('customModal');
    if (customModal) {
      const modal = bootstrap.Modal.getInstance(customModal);
      if (modal) {
        modal.hide();
        setTimeout(cleanupModalBackdrop, 100);
      }
    }

        showToast("Konten kustom berhasil disimpan", "success");

        // Refresh list
        refreshCustomList();

        // Update preview
        get(ref(rtdb, "content/promotion")).then((snapshot) => {
          updatePreview(snapshot.val() || {});
        });
      })
      .catch((error) => {
        console.error("Error saving custom content:", error);
        showToast("Gagal menyimpan konten kustom", "error");
      });
  };

  if (contentType === "HTML") {
    const htmlContent = customHtmlElement.value;
    if (!htmlContent) {
      showToast("Kode HTML harus diisi", "error");
      return;
    }

    // Pastikan konten HTML disimpan dengan benar
    saveCustomData({ htmlContent });
  } else {
    const file = customFileElement.files && customFileElement.files[0];

    if (!file) {
      // If editing, don't require a new file
      if (customIdElement.value) {
        const customRef = ref(rtdb, `content/promotion/customItems/${id}`);
        get(customRef)
          .then((snapshot) => {
            const existingCustom = snapshot.val();
            saveCustomData({
              fileUrl: existingCustom?.fileUrl,
              fileType: existingCustom?.fileType
            });
          })
          .catch((error) => {
            console.error("Error getting existing custom content:", error);
            showToast("Gagal mendapatkan data konten kustom", "error");
          });
      } else {
        showToast("File harus diunggah", "error");
        return;
      }
      return;
    }

    // Show loading indicator
    showToast("Mengunggah file...", "info");

    // Upload to Cloudinary using our service
    uploadFile(file, "promotion/custom")
      .then((result) => {
        if (result.url) {
          saveCustomData({
            fileUrl: result.url,
            fileType: file.type
          });
        } else {
          throw new Error("Failed to get file URL from Cloudinary");
        }
      })
      .catch((error) => {
        console.error("Error uploading file:", error);
        showToast("Gagal mengunggah file", "error");
      });
  }
}

function editCustom(id) {
  // Get data from Firebase
  const customRef = ref(rtdb, `content/promotion/customItems/${id}`);
  get(customRef)
    .then((snapshot) => {
      const customItem = snapshot.val();

      if (customItem) {
        // Populate form
        const customIdElement = document.getElementById("customId");
        const customTitleElement = document.getElementById("customTitle");
        const customTypeElement = document.getElementById("customType");
        const customHtmlElement = document.getElementById("customHtml");
        const customActiveElement = document.getElementById("customActive");

        if (customIdElement) customIdElement.value = customItem.id;
        if (customTitleElement) customTitleElement.value = customItem.title;
        if (customTypeElement) customTypeElement.value = customItem.contentType;
        if (customActiveElement) customActiveElement.checked = customItem.isActive;

        // Show/hide appropriate fields
        const contentHtmlElement = document.querySelector(".content-html");
        const contentUploadElement = document.querySelector(".content-upload");

        if (customItem.contentType === "HTML") {
          if (contentUploadElement) contentUploadElement.classList.add("d-none");
          if (contentHtmlElement) contentHtmlElement.classList.remove("d-none");
          if (customHtmlElement) customHtmlElement.value = customItem.htmlContent || "";
        } else {
          if (contentUploadElement) contentUploadElement.classList.remove("d-none");
          if (contentHtmlElement) contentHtmlElement.classList.add("d-none");
        }

        // Open modal in edit mode
        openCustomModal(true);
      }
    })
    .catch((error) => {
      console.error("Error getting custom content:", error);
      showToast("Gagal mendapatkan data konten kustom", "error");
    });
}

function deleteCustom(id) {
  if (confirm("Apakah Anda yakin ingin menghapus konten kustom ini?")) {
    // Delete from Firebase
    remove(ref(rtdb, `content/promotion/customItems/${id}`))
      .then(() => {
        showToast("Konten kustom berhasil dihapus", "success");
        refreshCustomList();
      })
      .catch((error) => {
        console.error("Error deleting custom content:", error);
        showToast("Gagal menghapus konten kustom", "error");
      });
  }
}

function refreshCustomList() {
  const customList = document.getElementById("customList");
  if (!customList) return;

  // Get data from Firebase
  const customRef = ref(rtdb, "content/promotion/customItems");
  onValue(customRef, (snapshot) => {
    // Clear current list
    customList.innerHTML = "";

    const data = snapshot.val() || {};
    const customItems = Object.values(data);

    // Add each item to the list
    customItems.forEach((item, index) => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${index + 1}</td>
        <td>${item.title}</td>
        <td>${item.contentType}</td>
        <td><span class="badge ${item.isActive ? "bg-success" : "bg-secondary"}">${
        item.isActive ? "Aktif" : "Tidak Aktif"
      }</span></td>
        <td>
          <button class="btn btn-sm btn-info edit-custom" data-id="${item.id}">
            <i class="fas fa-edit"></i>
          </button>
          <button class="btn btn-sm btn-danger delete-custom" data-id="${item.id}">
            <i class="fas fa-trash"></i>
          </button>
        </td>
      `;
      customList.appendChild(row);
    });

    // Re-attach event listeners
    setupEditDeleteListeners();
  });
  updatePreviewCarousel();
}

// Setup edit and delete button listeners
function setupEditDeleteListeners() {
  // Event edit buttons
  document.querySelectorAll(".edit-event").forEach((button) => {
    button.addEventListener("click", function () {
      const id = this.getAttribute("data-id");
      editEvent(id);
    });
  });

  // Event delete buttons
  document.querySelectorAll(".delete-event").forEach((button) => {
    button.addEventListener("click", function () {
      const id = this.getAttribute("data-id");
      deleteEvent(id);
    });
  });

  // Custom content edit buttons
  document.querySelectorAll(".edit-custom").forEach((button) => {
    button.addEventListener("click", function () {
      const id = this.getAttribute("data-id");
      editCustom(id);
    });
  });

  // Custom content delete buttons
  document.querySelectorAll(".delete-custom").forEach((button) => {
    button.addEventListener("click", function () {
      const id = this.getAttribute("data-id");
      deleteCustom(id);
    });
  });
}

// Helper function to show toast notifications
function showToast(message, type = "info") {
  // Create toast container if it doesn't exist
  let toastContainer = document.querySelector(".toast-container");

  if (!toastContainer) {
    toastContainer = document.createElement("div");
    toastContainer.className = "toast-container position-fixed bottom-0 end-0 p-3";
    document.body.appendChild(toastContainer);
  }

  // Create toast element
  const toastId = "toast-" + Date.now();
  const toast = document.createElement("div");
  toast.className = `toast align-items-center text-white bg-${type === "error" ? "danger" : type}`;
  toast.setAttribute("role", "alert");
  toast.setAttribute("aria-live", "assertive");
  toast.setAttribute("aria-atomic", "true");
  toast.setAttribute("id", toastId);

  // Toast content
  toast.innerHTML = `
    <div class="d-flex">
      <div class="toast-body">
        ${message}
      </div>
            <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
    </div>
  `;

  // Add to container
  toastContainer.appendChild(toast);

  // Initialize and show toast
  const bsToast = new bootstrap.Toast(toast, {
    autohide: true,
    delay: 3000,
  });
  bsToast.show();

  // Remove from DOM after hiding
  toast.addEventListener("hidden.bs.toast", function () {
    toast.remove();
  });
}

// Function to handle logout
function handleLogout() {
  auth
    .signOut()
    .then(() => {
      // Redirect to login page
      window.location.href = "index.html";
    })
    .catch((error) => {
      console.error("Error signing out:", error);
      showToast("Gagal logout", "error");

      // Fallback logout method using sessionStorage
      sessionStorage.removeItem("currentUser");
      window.location.href = "index.html";
    });
}

// Function to check if a date is valid
function isValidDate(dateString) {
  const date = new Date(dateString);
  return !isNaN(date.getTime());
}

// Function to format date for display
function formatDate(dateString) {
  if (!dateString || !isValidDate(dateString)) return "";

  const date = new Date(dateString);
  return date.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

// Function to check if a URL is valid
function isValidUrl(url) {
  try {
    new URL(url);
    return true;
  } catch (e) {
    return false;
  }
}

// Function to sanitize HTML content
function sanitizeHtml(html) {
  // This is a very basic sanitization
  // For production, consider using a library like DOMPurify
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/on\w+="[^"]*"/g, "")
    .replace(/javascript:/g, "");
}

// Initialize the page
document.addEventListener("DOMContentLoaded", function () {
  // Initialize date and time display
  updateDateTime();
  setInterval(updateDateTime, 1000);

  // Detect which page we're on
  const isDisplayPage = document.querySelector(".fullscreen-container") !== null;
  const isAdminPage = document.querySelector(".app-container") !== null;

  if (isAdminPage) {
    // Check authentication
    checkAuth().then((isAuthenticated) => {
      if (!isAuthenticated) {
        window.location.href = "index.html";
        return;
      }

      // Initialize event listeners for admin page
      initializeEventListeners();

      // Load settings from Firebase
      loadSettingsFromFirebase();

      // Refresh content lists
      refreshEventList();
      refreshCustomList();
    });
  } else if (isDisplayPage) {
    // Initialize display page with Firebase
    initializeDisplayPageWithFirebase();
  }
});
