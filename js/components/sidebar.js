// sidebar.js - Handles all sidebar functionality

// Definisikan fungsi setupSidebarToggle terlebih dahulu
function setupSidebarToggle() {
    const menuToggle = document.querySelector(".menu-toggle");
    const appContainer = document.querySelector(".app-container");

    if (menuToggle) {
        menuToggle.addEventListener("click", function () {
            appContainer.classList.toggle("sidebar-collapsed");
        });
    }
}

// Kemudian definisikan fungsi sidebarToggle yang mengekspor
export function sidebarToggle() {
    setupSidebarToggle();
    setupDropdownToggles();
    setupMobileSidebar();
    highlightActiveMenu();
}

/**
 * Setup dropdown toggles in sidebar
 */
function setupDropdownToggles() {
    console.log("Setting up dropdown toggles");
    const dropdownToggles = document.querySelectorAll('.sidebar .nav-link[data-bs-toggle="collapse"]');
    
    dropdownToggles.forEach(toggle => {
      // Skip if this is the supervisor toggle (will be handled separately)
      if (toggle.classList.contains('supervisor-toggle') || 
          toggle.getAttribute('data-bs-target') === '#supervisorSubmenu' ||
          toggle.textContent.includes('Supervisor')) {
        console.log("Skipping supervisor toggle in sidebar.js");
        return;
      }
      
      toggle.addEventListener('click', function(e) {
        e.preventDefault();
        
        // Get the target dropdown element
        const targetId = this.getAttribute('data-bs-target');
        const target = document.querySelector(targetId);
        
        if (target) {
          // Toggle the 'show' class on the target dropdown
          if (target.classList.contains('show')) {
            // If it's already open, close it
            target.classList.remove('show');
            this.setAttribute('aria-expanded', 'false');
            this.classList.add('collapsed');
          } else {
            // If it's closed, open it and close others
            
            // First close all other dropdowns (accordion behavior)
            dropdownToggles.forEach(otherToggle => {
              if (otherToggle !== this) {
                const otherId = otherToggle.getAttribute('data-bs-target');
                const other = document.querySelector(otherId);
                
                if (other && other.classList.contains('show')) {
                  other.classList.remove('show');
                  otherToggle.setAttribute('aria-expanded', 'false');
                  otherToggle.classList.add('collapsed');
                }
              }
            });
            
            // Then open this dropdown
            target.classList.add('show');
            this.setAttribute('aria-expanded', 'true');
            this.classList.remove('collapsed');
          }
        }
      });
    });
  }

/**
 * Setup mobile sidebar functionality
 */
function setupMobileSidebar() {
    const appContainer = document.querySelector('.app-container');
    const hamburgerBtn = document.querySelector('.hamburger');
    
    // Create overlay element if it doesn't exist
    if (!document.querySelector('.sidebar-overlay')) {
        const overlay = document.createElement('div');
        overlay.className = 'sidebar-overlay';
        appContainer.appendChild(overlay);
    }
    
    const overlay = document.querySelector('.sidebar-overlay');
    
    // Toggle sidebar on hamburger click
    if (hamburgerBtn) {
        hamburgerBtn.addEventListener('click', function() {
            appContainer.classList.toggle('sidebar-active');
            document.body.style.overflow = appContainer.classList.contains('sidebar-active') ? 'hidden' : '';
        });
    }
    
    // Close sidebar when clicking the overlay
    if (overlay) {
        overlay.addEventListener('click', function() {
            appContainer.classList.remove('sidebar-active');
            document.body.style.overflow = '';
        });
    }
    
    // Close sidebar when clicking a menu item on mobile
    const menuItems = document.querySelectorAll('.sidebar .nav-link:not([data-bs-toggle])');
    menuItems.forEach(item => {
        item.addEventListener('click', function() {
            if (window.innerWidth <= 768) {
                appContainer.classList.remove('sidebar-active');
                document.body.style.overflow = '';
            }
        });
    });
    
    // Handle window resize
    window.addEventListener('resize', function() {
        if (window.innerWidth > 768) {
            // Reset to desktop view
            appContainer.classList.remove('sidebar-active');
            document.body.style.overflow = '';
        }
    });
}

/**
 * Highlight active menu based on current page
 */
function highlightActiveMenu() {
    // Get current page path
    const currentPath = window.location.pathname;
    const filename = currentPath.split('/').pop();
    
    // Get all navigation links
    const navLinks = document.querySelectorAll('.sidebar .nav-link');
    
    // Remove active class from all links
    navLinks.forEach(link => {
        link.classList.remove('active');
    });
    
    // Add active class to link matching current page
    navLinks.forEach(link => {
        const href = link.getAttribute('href');
        if (href === filename || (filename === '' && href === 'index.html')) {
            link.classList.add('active');
        }
    });
    
    // If current page is a submenu page, open its parent menu
    const activeLink = document.querySelector('.sidebar .nav-link.active');
    if (activeLink) {
        const parentCollapse = activeLink.closest('.collapse');
        if (parentCollapse) {
            parentCollapse.classList.add('show');
            const parentToggle = document.querySelector(`[data-bs-target="#${parentCollapse.id}"]`);
            if (parentToggle) {
                parentToggle.classList.remove('collapsed');
                parentToggle.setAttribute('aria-expanded', 'true');
            }
        }
    }
}
