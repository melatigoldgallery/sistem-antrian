import { sidebarToggle } from "./components/sidebar.js";
import { initializeDateTime } from "./components/header.js";

// Panggil fungsi-fungsi ini di awal file
try {
  console.log("Initializing UI components...");
  sidebarToggle();
  initializeDateTime();
  console.log("UI components initialized successfully");
} catch (error) {
  console.error("Error initializing UI components:", error);
}
