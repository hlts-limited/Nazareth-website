/* ==========================================================================
   Admin Dashboard client-side Controller (Direct Firestore/Storage)
   ========================================================================== */

document.addEventListener("DOMContentLoaded", () => {

  // 1. Session Auth Security Check (Firebase Auth Only)
  const checkSessionSecurity = () => {
    if (window.firebaseReady) {
      firebase.auth().onAuthStateChanged((user) => {
        if (!user) {
          console.warn("Security rejection: Unauthorized user session redirected to login.");
          window.location.href = "admin-login.html";
        } else {
          document.getElementById("adminEmailHeader").textContent = user.email || "admin@engreg.com";
          initializeController();
        }
      });
    } else {
      console.error("Firebase SDK uninitialized. Forcing login redirect.");
      window.location.href = "admin-login.html";
    }
  };

  // Logout Trigger
  const adminLogoutBtn = document.getElementById("adminLogoutBtn");
  if (adminLogoutBtn) {
    adminLogoutBtn.addEventListener("click", async (e) => {
      e.preventDefault();
      if (window.firebaseReady && firebase.auth().currentUser) {
        try {
          await firebase.auth().signOut();
        } catch (err) {
          console.error("Signout error:", err);
        }
      }
      window.location.href = "admin-login.html";
    });
  }

  // Initialize Auth Security Check
  checkSessionSecurity();

  // Core initialization logic
  function initializeController() {
    // Collapse/Expand Sidebar Handler (Mobile & Desktop)
    const sidebar = document.getElementById("sidebar");
    const sidebarCollapse = document.getElementById("sidebarCollapse");
    const sidebarCloseBtn = document.getElementById("sidebarCloseBtn");
    const sidebarBackdrop = document.getElementById("sidebarBackdrop");

    const toggleSidebar = (forceState) => {
      if (!sidebar) return;
      const isMobile = window.innerWidth <= 991;

      if (isMobile) {
        const isShowing = forceState !== undefined ? forceState : !sidebar.classList.contains("show");
        if (isShowing) {
          sidebar.classList.add("show");
          sidebar.classList.remove("collapsed");
          if (sidebarBackdrop) sidebarBackdrop.classList.add("show");
        } else {
          sidebar.classList.remove("show");
          sidebar.classList.add("collapsed");
          if (sidebarBackdrop) sidebarBackdrop.classList.remove("show");
        }
      } else {
        if (forceState !== undefined) {
          if (forceState) sidebar.classList.remove("collapsed");
          else sidebar.classList.add("collapsed");
        } else {
          sidebar.classList.toggle("collapsed");
        }
        if (sidebarBackdrop) sidebarBackdrop.classList.remove("show");
      }
    };

    if (sidebarCollapse) {
      sidebarCollapse.addEventListener("click", (e) => {
        e.stopPropagation();
        toggleSidebar();
      });
    }

    if (sidebarCloseBtn) {
      sidebarCloseBtn.addEventListener("click", () => toggleSidebar(false));
    }

    if (sidebarBackdrop) {
      sidebarBackdrop.addEventListener("click", () => toggleSidebar(false));
    }

    // Handle SPA Tab Switching
    const sidebarLinks = document.querySelectorAll(".sidebar-link, .sidebar-sublink");
    const tabPanels = document.querySelectorAll(".tab-panel");

    sidebarLinks.forEach(link => {
      link.addEventListener("click", (e) => {
        const tabId = link.getAttribute("data-tab");
        if (!tabId) return; // Dropdowns

        e.preventDefault();

        sidebarLinks.forEach(l => l.classList.remove("active"));
        tabPanels.forEach(p => p.classList.remove("active"));

        link.classList.add("active");
        const targetPanel = document.getElementById(tabId);
        if (targetPanel) {
          targetPanel.classList.add("active");
          
          if (tabId === "dashboard-tab") loadDashboardData();
          if (tabId === "gallery-tab") loadGalleryImages();
          if (tabId === "nursery-tab") loadCandidates("nursery");
          if (tabId === "high-tab") loadCandidates("high");
          if (tabId === "successful-tab") loadSuccessfulCandidates();
          if (tabId === "settings-tab") loadSettings();
        }

        // Auto close sidebar on mobile when a link is clicked
        if (window.innerWidth <= 991) {
          toggleSidebar(false);
        }
      });
    });

    // Run first dashboard view load on start
    loadDashboardData();
    loadGalleryImages(); 
    setupDocumentUploadListeners();

    // Listen for public form submissions closing to refresh tables
    const nurseryModalEl = document.getElementById("nurseryModal");
    if (nurseryModalEl) {
      nurseryModalEl.addEventListener("hidden.bs.modal", () => {
        const form = document.getElementById("nurseryAdmissionForm");
        if (form) {
          form.removeAttribute("data-editing-id");
          form.reset();
        }
        loadCandidates("nursery");
        loadDashboardData();
      });
    }
    const highSchoolModalEl = document.getElementById("highSchoolModal");
    if (highSchoolModalEl) {
      highSchoolModalEl.addEventListener("hidden.bs.modal", () => {
        const form = document.getElementById("highSchoolAdmissionForm");
        if (form) {
          form.removeAttribute("data-editing-id");
          form.reset();
        }
        loadCandidates("high");
        loadDashboardData();
      });
    }
  }

  // Global Toast notifier
  const liveToast = document.getElementById("liveToast");
  const toastMessage = document.getElementById("toastMessage");
  let toastInstance = null;
  if (liveToast) {
    toastInstance = new bootstrap.Toast(liveToast);
  }

  function showToast(message, isSuccess = true) {
    if (!liveToast || !toastInstance) return;
    toastMessage.textContent = message;
    liveToast.className = `toast align-items-center text-white border-0 ${isSuccess ? 'bg-success' : 'bg-danger'}`;
    toastInstance.show();
  }

  // Helper: Write Logs directly to Firestore
  async function writeAuditLog(action, details) {
    if (!window.firebaseReady) return;
    try {
      const db = firebase.firestore();
      await db.collection("audit_logs").add({
        action: action,
        details: details,
        timestamp: new Date().toLocaleString(),
        createdAt: new Date().toISOString()
      });
    } catch (err) {
      console.error("Failed to write audit log:", err);
    }
  }

  // ==========================================================================
  // 1. Dashboard Tab Overview & Analytics Chart
  // ==========================================================================
  let myChartInstance = null;

  async function loadDashboardData() {
    if (!window.firebaseReady) return;

    try {
      const db = firebase.firestore();

      const nurserySnapshot = await db.collection("nursery_primary_registration").get();
      const highSnapshot = await db.collection("high_school_registration").get();
      const nurserySuccessSnapshot = await db.collection("nursery_primary_successful").get();
      const highSuccessSnapshot = await db.collection("high_school_successful").get();
      const gallerySnapshot = await db.collection("gallery").get();

      const nurseryCount = nurserySnapshot.size;
      const highCount = highSnapshot.size;
      const nurserySuccessCount = nurserySuccessSnapshot.size;
      const highSuccessCount = highSuccessSnapshot.size;
      const totalSuccessCount = nurserySuccessCount + highSuccessCount;
      const galleryCount = gallerySnapshot.size;

      // Update figures
      document.getElementById("statNurseryReg").textContent = nurseryCount;
      document.getElementById("statHighReg").textContent = highCount;
      document.getElementById("statSuccessful").textContent = totalSuccessCount;

      // Load max image configurations limit
      const settingsDoc = await db.collection("settings").doc("global_config").get();
      let maxGallery = 100;
      if (settingsDoc.exists) {
        maxGallery = settingsDoc.data().maxGalleryImages || 100;
      }
      document.getElementById("statGalleryCount").textContent = `${galleryCount} / ${maxGallery}`;
      
      const progressPct = Math.min((galleryCount / maxGallery) * 100, 100);
      const progressBar = document.getElementById("statGalleryProgress");
      progressBar.style.width = `${progressPct}%`;
      progressBar.setAttribute("aria-valuenow", progressPct);

      renderChart(nurseryCount, highCount, nurserySuccessCount, highSuccessCount);
      loadLogs();
    } catch (err) {
      console.error("Dashboard statistics loading failed:", err);
    }
  }

  function renderChart(nursReg, highReg, nursSucc, highSucc) {
    const ctx = document.getElementById("admissionAnalyticsChart");
    if (!ctx) return;

    if (myChartInstance) {
      myChartInstance.destroy();
    }

    myChartInstance = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: ['School A', 'School B'],
        datasets: [
          {
            label: 'Registered Candidates',
            data: [nursReg, highReg],
            backgroundColor: 'rgba(74, 65, 99, 0.85)',
            borderColor: 'rgba(74, 65, 99, 1)',
            borderWidth: 1,
            borderRadius: 6
          },
          {
            label: 'Successful Candidates',
            data: [nursSucc, highSucc],
            backgroundColor: 'rgba(225, 160, 164, 0.95)',
            borderColor: 'rgba(225, 160, 164, 1)',
            borderWidth: 1,
            borderRadius: 6
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            ticks: { stepSize: 5 }
          }
        },
        plugins: {
          legend: { position: 'bottom' }
        }
      }
    });
  }

  async function loadLogs() {
    if (!window.firebaseReady) return;
    try {
      const db = firebase.firestore();
      const snapshot = await db.collection("audit_logs").orderBy("createdAt", "desc").limit(10).get();
      
      const tbody = document.getElementById("logsTableBody");
      if (!tbody) return;
      tbody.innerHTML = "";
      
      snapshot.forEach(doc => {
        const log = doc.data();
        const row = document.createElement("tr");
        row.innerHTML = `
          <td><span class="badge bg-secondary-light text-primary-dark">${log.action}</span></td>
          <td>${log.details}</td>
          <td class="text-nowrap">${log.timestamp}</td>
        `;
        tbody.appendChild(row);
      });
    } catch (err) {
      console.error("Failed to load logs:", err);
    }
  }

  // ==========================================================================
  // 2. Gallery Assets Management Panel
  // ==========================================================================
  const dropzone = document.getElementById("dropzone");
  const galleryFileInput = document.getElementById("galleryFileInput");
  const selectedFilename = document.getElementById("selectedFilename");
  const galleryUploadForm = document.getElementById("galleryUploadForm");
  const adminGalleryGrid = document.getElementById("adminGalleryGrid");

  if (dropzone && galleryFileInput) {
    dropzone.addEventListener("click", (e) => {
      if (e.target !== galleryFileInput) {
        galleryFileInput.click();
      }
    });
    
    ["dragover", "dragenter"].forEach(type => {
      dropzone.addEventListener(type, (e) => {
        e.preventDefault();
        dropzone.classList.add("dragover");
      });
    });

    ["dragleave", "drop"].forEach(type => {
      dropzone.addEventListener(type, (e) => {
        e.preventDefault();
        dropzone.classList.remove("dragover");
      });
    });

    dropzone.addEventListener("drop", (e) => {
      const files = e.dataTransfer.files;
      if (files.length > 0 && files[0].type.startsWith("image/")) {
        galleryFileInput.files = files;
        updateSelectedFileName(files[0].name);
      }
    });

    galleryFileInput.addEventListener("change", () => {
      if (galleryFileInput.files.length > 0) {
        updateSelectedFileName(galleryFileInput.files[0].name);
      }
    });
  }

  function updateSelectedFileName(name) {
    selectedFilename.textContent = name;
    selectedFilename.classList.remove("d-none");
  }

  if (galleryUploadForm) {
    galleryUploadForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      
      const fileInput = document.getElementById("galleryFileInput");
      const category = document.getElementById("uploadCategory").value;
      const caption = document.getElementById("uploadCaption").value;
      const errorDiv = document.getElementById("uploadFormError");
      const progressBar = document.getElementById("uploadProgressBar");
      const progressContainer = document.getElementById("uploadProgressBarContainer");

      errorDiv.classList.add("d-none");

      if (fileInput.files.length === 0) {
        errorDiv.textContent = "Please select an image file to upload.";
        errorDiv.classList.remove("d-none");
        return;
      }

      const file = fileInput.files[0];
      progressContainer.classList.remove("d-none");
      progressBar.style.width = "20%";

      try {
        progressBar.style.width = "50%";
        const base64Data = await fileToBase64(file, 800, 0.7);
        progressBar.style.width = "80%";

        if (!window.firebaseReady) {
          throw new Error("Firebase database connection is uninitialized.");
        }

        const db = firebase.firestore();
        await db.collection("gallery").add({
          imageUrl: base64Data,
          category: category,
          caption: caption,
          createdAt: new Date().toISOString()
        });

        await writeAuditLog("Upload Photo", `Uploaded new gallery photo "${caption}" in category [${category}].`);
        
        progressBar.style.width = "100%";
        setTimeout(() => {
          progressContainer.classList.add("d-none");
          progressBar.style.width = "0%";
          showToast("Image uploaded successfully.");
          galleryUploadForm.reset();
          selectedFilename.classList.add("d-none");
          loadGalleryImages();
          loadDashboardData();
        }, 300);

      } catch (err) {
        console.error("Direct upload failed:", err);
        progressContainer.classList.add("d-none");
        errorDiv.textContent = "Upload failed: " + err.message;
        errorDiv.classList.remove("d-none");
      }
    });
  }

  async function loadGalleryImages() {
    if (!adminGalleryGrid) return;
    if (!window.firebaseReady) return;

    try {
      const db = firebase.firestore();
      const snapshot = await db.collection("gallery").orderBy("createdAt", "desc").get();
      
      adminGalleryGrid.innerHTML = "";
      const max_gallery = 100;
      document.getElementById("galleryQuotaBadge").textContent = `Quota: ${snapshot.size} / ${max_gallery} Uploaded`;

      if (snapshot.empty) {
        adminGalleryGrid.innerHTML = `<div class="col-12 text-center py-4 text-muted">No images found in the gallery database.</div>`;
        return;
      }

      snapshot.forEach(doc => {
        const img = doc.data();
        const card = document.createElement("div");
        card.className = "col";
        card.innerHTML = `
          <div class="admin-gallery-card">
            <img src="${img.imageUrl}" alt="${img.caption}" onerror="this.src='https://placehold.co/400x300/4a4163/e1a0a4?text=Image'">
            <span class="gallery-card-badge">${img.category}</span>
            <div class="gallery-card-actions">
              <button class="btn btn-danger btn-sm rounded-circle shadow-sm" onclick="deleteGalleryImage('${doc.id}', '${img.caption}')" title="Delete">
                <i class="fa-solid fa-trash-can"></i>
              </button>
            </div>
          </div>
          <p class="small text-truncate text-muted mt-2 mb-0 fw-semibold px-1" title="${img.caption}">${img.caption}</p>
        `;
        adminGalleryGrid.appendChild(card);
      });
    } catch (err) {
      console.error("Failed to load gallery images:", err);
    }
  }

  window.deleteGalleryImage = async (id, caption) => {
    if (!window.firebaseReady) return;
    if (confirm(`Are you sure you want to permanently delete "${caption}"?`)) {
      try {
        const db = firebase.firestore();
        await db.collection("gallery").doc(id).delete();
        await writeAuditLog("Delete Photo", `Permanently deleted gallery photo "${caption}".`);
        showToast("Gallery photo deleted.");
        loadGalleryImages();
        loadDashboardData();
      } catch (err) {
        console.error("Failed to delete gallery image:", err);
        showToast("Failed to delete image: " + err.message, false);
      }
    }
  };

  // ==========================================================================
  // 3. Admissions Registry: Candidates & Document Downloader
  // ==========================================================================
  let activeCandidates = { nursery: [], high: [] };
  let activeSuccessful = { nursery: [], high: [] };
  let selectedCandidateIds = { nursery: [], high: [] };

  // Class Selection Listener
  const classFilters = document.querySelectorAll(".filter-trigger-select");
  classFilters.forEach(select => {
    select.addEventListener("change", () => {
      const school = select.getAttribute("data-school");
      const tableContainer = document.getElementById(`${school}TableContainer`);
      const placeholderText = document.getElementById(`${school}PlaceholderText`);
      
      if (tableContainer) tableContainer.classList.remove("d-none");
      if (placeholderText) placeholderText.classList.add("d-none");

      loadCandidates(school);
    });
  });

  // Genders Filter selection
  const genderFilters = document.querySelectorAll("[id$='GenderFilter']");
  genderFilters.forEach(select => {
    select.addEventListener("change", () => {
      const school = select.id.startsWith("nursery") ? "nursery" : "high";
      loadCandidates(school);
    });
  });

  // Search input listeners
  const searchInputs = document.querySelectorAll("[id$='SearchInput']");
  searchInputs.forEach(input => {
    input.addEventListener("input", () => {
      const school = input.id.startsWith("nursery") ? "nursery" : "high";
      renderCandidatesTable(school);
    });
  });

  async function loadCandidates(school) {
    const classVal = document.getElementById(`${school}ClassFilter`).value;
    const genderVal = document.getElementById(`${school}GenderFilter`).value;

    if (!classVal) return;
    if (!window.firebaseReady) return;

    try {
      const db = firebase.firestore();
      const colName = school === "nursery" ? "nursery_primary_registration" : "high_school_registration";
      
      let query = db.collection(colName);
      if (classVal !== "all") {
        query = query.where("class", "==", classVal);
      }
      if (genderVal) {
        query = query.where("gender", "==", genderVal);
      }

      const snapshot = await query.get();
      const list = [];
      snapshot.forEach(doc => {
        const d = doc.data();
        
        let candName = "Unnamed Candidate";
        if (school === "nursery") {
          candName = d.nurseryChildName || "Unnamed Pupil";
        } else {
          if (d.highSchoolSurname || d.highSchoolOtherNames) {
            candName = `${d.highSchoolSurname || ""} ${d.highSchoolOtherNames || ""}`.trim();
          } else {
            candName = d.highSchoolName || d.highSchoolDeclName || "Unnamed Student";
          }
        }

        const parentNameVal = d.nurseryFatherName || d.nurseryMotherName || d.nurseryParentName || d.highSchoolParentName || "";
        const parentPhoneVal = d.nurseryFatherHomeTel || d.nurseryMotherHomeTel || d.nurseryPhone || d.highSchoolParentHomeTel || d.highSchoolPhone || "";

        list.push({
          id: doc.id,
          ...d,
          name: candName,
          class: d.class || d.nurseryClass || d.highSchoolClass || "",
          gender: d.gender || d.nurseryGender || d.highSchoolGender || "",
          parentName: parentNameVal,
          parentPhone: parentPhoneVal,
          passportUrl: d.passportUrl || "",
          birthCertUrl: d.birthCertUrl || "",
          resultUrl: d.resultFileUrl || d.resultUrl || "",
          testimonialUrl: d.testimonialUrl || "",
          passed: d.passed || false
        });
      });

      activeCandidates[school] = list;
      selectedCandidateIds[school] = [];
      renderCandidatesTable(school);
    } catch (err) {
      console.error("Candidates fetch failed:", err);
    }
  }

  function renderCandidatesTable(school) {
    const tbody = document.getElementById(`${school}TableBody`);
    if (!tbody) return;
    
    const searchVal = document.getElementById(`${school}SearchInput`).value.toLowerCase().trim();
    const selectAllCheckbox = document.getElementById(`${school}SelectAll`);
    
    tbody.innerHTML = "";
    selectAllCheckbox.checked = false;

    const candidates = activeCandidates[school].filter(cand => {
      return cand.name.toLowerCase().includes(searchVal) || cand.parentPhone.includes(searchVal);
    });

    if (candidates.length === 0) {
      tbody.innerHTML = `<tr><td colspan="9" class="text-center py-4 text-muted">No candidate registrations found matching criteria.</td></tr>`;
      updateSelectionCounter(school);
      return;
    }

    candidates.forEach((cand) => {
      const isChecked = selectedCandidateIds[school].includes(cand.id) ? "checked" : "";
      const isPassed = cand.passed ? "checked" : "";
      
      const passportSrc = cand.passportUrl && cand.passportUrl !== '#' ? cand.passportUrl : 'https://placehold.co/40x40/4a4163/e1a0a4?text=Avatar';
      const hasBirth = cand.birthCertUrl && cand.birthCertUrl !== '#' && cand.birthCertUrl.length > 20;
      const hasResult = (cand.resultUrl || cand.resultFileUrl) && (cand.resultUrl || cand.resultFileUrl) !== '#' && (cand.resultUrl || cand.resultFileUrl).length > 20;
      const hasTestimonial = cand.testimonialUrl && cand.testimonialUrl !== '#' && cand.testimonialUrl.length > 20;

      const row = document.createElement("tr");
      row.innerHTML = `
        <td>
          <input class="form-check-input row-select-cb" type="checkbox" data-id="${cand.id}" ${isChecked}>
        </td>
        <td>
          <img src="${passportSrc}" 
               alt="Passport" class="rounded shadow-sm" style="width: 40px; height: 40px; object-fit: cover;"
               onerror="this.src='https://placehold.co/40x40/4a4163/e1a0a4?text=NS'">
        </td>
        <td>
          <strong class="text-primary-dark d-block">${cand.name}</strong>
          <span class="badge bg-light text-dark border small">${cand.class || 'No Class'}</span>
        </td>
        <td>${cand.gender || 'N/A'}</td>
        <td>${cand.parentName || 'N/A'}</td>
        <td>${cand.parentPhone || 'N/A'}</td>
        <td>
          <div class="d-flex gap-1 align-items-center">
            <button class="btn btn-sm ${hasBirth ? 'btn-outline-primary' : 'btn-light text-muted disabled'} py-1 px-2 border" 
              onclick="downloadFile('${cand.birthCertUrl}', '${cand.name}_Birth_Certificate')" title="${hasBirth ? 'Download Birth Certificate' : 'No Birth Certificate'}">
              <i class="fa-solid fa-cake-candles"></i>
            </button>
            <button class="btn btn-sm ${hasResult ? 'btn-outline-warning text-dark' : 'btn-light text-muted disabled'} py-1 px-2 border" 
              onclick="downloadFile('${cand.resultUrl || cand.resultFileUrl}', '${cand.name}_Academic_Result')" title="${hasResult ? 'Download Academic Result' : 'No Academic Result'}">
              <i class="fa-solid fa-square-poll-vertical"></i>
            </button>
            <button class="btn btn-sm ${hasTestimonial ? 'btn-outline-success' : 'btn-light text-muted disabled'} py-1 px-2 border" 
              onclick="downloadFile('${cand.testimonialUrl}', '${cand.name}_Testimonial')" title="${hasTestimonial ? 'Download Testimonial' : 'No Testimonial'}">
              <i class="fa-solid fa-award"></i>
            </button>
            <button class="btn btn-sm btn-outline-dark py-1 px-2 border" 
              onclick="downloadCandidateDocuments('${school}', '${cand.id}')" title="Download All Documents">
              <i class="fa-solid fa-file-arrow-down"></i>
            </button>
          </div>
        </td>
        <td class="text-center">
          <input class="form-check-input passed-toggle-cb" type="checkbox" data-id="${cand.id}" ${isPassed}>
        </td>
        <td class="text-end text-nowrap">
          <button class="btn btn-outline-info btn-sm rounded-circle me-1" onclick="printCandidateForm('${school}', '${cand.id}', 'registration')" title="Print Application Form">
            <i class="fa-solid fa-print"></i>
          </button>
          <button class="btn btn-outline-primary btn-sm rounded-circle me-1" onclick="editCandidate('${school}', '${cand.id}')" title="Edit">
            <i class="fa-solid fa-pen-to-square"></i>
          </button>
          <button class="btn btn-outline-danger btn-sm rounded-circle me-1" onclick="deleteCandidate('${school}', '${cand.id}', '${cand.name}')" title="Delete">
            <i class="fa-solid fa-trash-can"></i>
          </button>
        </td>
      `;

      // Single Checkbox Selection listener
      row.querySelector(".row-select-cb").addEventListener("change", (e) => {
        const cid = e.target.getAttribute("data-id");
        if (e.target.checked) {
          selectedCandidateIds[school].push(cid);
        } else {
          selectedCandidateIds[school] = selectedCandidateIds[school].filter(id => id !== cid);
        }
        updateSelectionCounter(school);
      });

      // Exam state toggle listener
      row.querySelector(".passed-toggle-cb").addEventListener("change", async (e) => {
        const cid = e.target.getAttribute("data-id");
        const passedVal = e.target.checked;
        
        if (!window.firebaseReady) return;
        try {
          const db = firebase.firestore();
          const colName = school === "nursery" ? "nursery_primary_registration" : "high_school_registration";
          await db.collection(colName).doc(cid).update({ passed: passedVal });
          
          const target = activeCandidates[school].find(c => c.id === cid);
          if (target) target.passed = passedVal;
          
          await writeAuditLog("Exam Toggle", `Set examination status for candidate "${cand.name}" to ${passedVal ? 'PASSED' : 'PENDING'}.`);
          showToast(`Updated examination status for ${cand.name}.`);
        } catch (err) {
          e.target.checked = !passedVal;
          showToast("Failed to update status: " + err.message, false);
        }
      });

      tbody.appendChild(row);
    });

    updateSelectionCounter(school);
  }

  window.downloadFile = (url, name) => {
    if (!url || url === "#" || url === "data:" || url.trim() === "") {
      alert(`${name} is not uploaded for this candidate.`);
      return;
    }
    
    try {
      // Determine file extension
      let ext = "png";
      if (url.startsWith("data:")) {
        const mime = url.split(";")[0].split(":")[1] || "";
        if (mime.includes("pdf")) ext = "pdf";
        else if (mime.includes("jpeg") || mime.includes("jpg")) ext = "jpg";
        else if (mime.includes("png")) ext = "png";
        else if (mime.includes("gif")) ext = "gif";
        else if (mime.includes("webp")) ext = "webp";
      } else if (url.includes(".")) {
        const cleanUrl = url.split("?")[0];
        const lastPart = cleanUrl.split(".").pop();
        if (lastPart && lastPart.length <= 4) ext = lastPart;
      }
      
      const cleanName = (name || "Document").replace(/[^a-zA-Z0-9_-]/g, "_");
      const link = document.createElement("a");
      link.href = url;
      link.download = `${cleanName}.${ext}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast(`Downloaded ${cleanName}.${ext}`);
    } catch (err) {
      console.error("Download failed, fallback to open in window:", err);
      window.open(url, "_blank");
    }
  };

  // Batch download all documents for candidate
  window.downloadCandidateDocuments = async (school, id) => {
    const cand = (activeCandidates[school] || []).find(c => c.id === id) || (activeSuccessful[school] || []).find(c => c.id === id);
    if (!cand) {
      alert("Candidate data not found.");
      return;
    }

    const docItems = [
      { key: "passportUrl", label: `${cand.name}_Passport` },
      { key: "birthCertUrl", label: `${cand.name}_Birth_Certificate` },
      { key: "resultUrl", label: `${cand.name}_Academic_Result` },
      { key: "resultFileUrl", label: `${cand.name}_Academic_Result` },
      { key: "testimonialUrl", label: `${cand.name}_Testimonial` }
    ];

    const validDocs = [];
    const seenKeys = new Set();
    docItems.forEach(item => {
      const url = cand[item.key];
      if (url && url !== "#" && url.length > 20 && !seenKeys.has(item.label)) {
        seenKeys.add(item.label);
        validDocs.push({ url, label: item.label });
      }
    });

    if (validDocs.length === 0) {
      alert("No uploaded documents are on file for this candidate.");
      return;
    }

    showToast(`Downloading ${validDocs.length} document(s) for ${cand.name}...`);
    validDocs.forEach((doc, idx) => {
      setTimeout(() => {
        window.downloadFile(doc.url, doc.label);
      }, idx * 400);
    });
  };

  window.editCandidate = async (school, id) => {
    if (!window.firebaseReady) return;

    try {
      const db = firebase.firestore();
      const colName = school === "nursery" ? "nursery_primary_registration" : "high_school_registration";
      
      const doc = await db.collection(colName).doc(id).get();
      if (!doc.exists) {
        alert("Candidate document not found.");
        return;
      }
      
      const data = doc.data();
      const form = document.getElementById(school === "nursery" ? "nurseryAdmissionForm" : "highSchoolAdmissionForm");
      if (!form) return;
      
      form.setAttribute("data-editing-id", id);
      
      const inputs = form.querySelectorAll("input, select, textarea");
      inputs.forEach(input => {
        if (input.type === "file") return;
        
        const key = input.name || input.id;
        if (key && data[key] !== undefined) {
          if (input.type === "radio" || input.type === "checkbox") {
            input.checked = (input.value === data[key]);
          } else {
            input.value = data[key];
          }
        }
      });
      
      // Trigger DOB update to refresh age display
      const dobEl = form.querySelector('input[type="date"]');
      if (dobEl) {
        dobEl.dispatchEvent(new Event("change"));
        dobEl.dispatchEvent(new Event("input"));
      }

      // Show the Bootstrap modal
      const modalEl = document.getElementById(school === "nursery" ? "nurseryModal" : "highSchoolModal");
      if (modalEl) {
        let modal = bootstrap.Modal.getInstance(modalEl);
        if (!modal) {
          modal = new bootstrap.Modal(modalEl);
        }
        modal.show();
      }
    } catch (err) {
      console.error("Failed to load candidate details for edit:", err);
      alert("Error loading candidate details: " + err.message);
    }
  };

  // Checkbox Select All Toggle for Registrations
  const selectAllCbs = document.querySelectorAll("#nurserySelectAll, #highSelectAll");
  selectAllCbs.forEach(allCb => {
    allCb.addEventListener("change", (e) => {
      const school = allCb.id.startsWith("nursery") ? "nursery" : "high";
      const tableBody = document.getElementById(`${school}TableBody`);
      if (!tableBody) return;
      const rowCbs = tableBody.querySelectorAll(".row-select-cb");

      selectedCandidateIds[school] = [];
      rowCbs.forEach(cb => {
        cb.checked = e.target.checked;
        if (e.target.checked) {
          selectedCandidateIds[school].push(cb.getAttribute("data-id"));
        }
      });
      updateSelectionCounter(school);
    });
  });

  function updateSelectionCounter(school) {
    const count = selectedCandidateIds[school].length;
    const countEl = document.getElementById(`${school}SelectedCount`);
    if (countEl) countEl.textContent = `${count} Candidates Selected`;
    const btnMove = document.getElementById(`${school}BtnMoveSuccessful`);
    if (btnMove) btnMove.disabled = count === 0;
  }

  // Move registration candidates to Successful list (Preserving ALL data & documents)
  const moveButtons = document.querySelectorAll("[id$='BtnMoveSuccessful']");
  moveButtons.forEach(btn => {
    btn.addEventListener("click", async () => {
      const school = btn.id.startsWith("nursery") ? "nursery" : "high";
      const count = selectedCandidateIds[school].length;
      
      if (confirm(`Are you sure you want to move the ${count} selected candidates to the Successful list? This preserves ALL submitted details and uploaded documents.`)) {
        btn.disabled = true;
        if (!window.firebaseReady) return;

        try {
          const db = firebase.firestore();
          const sourceCol = school === "nursery" ? "nursery_primary_registration" : "high_school_registration";
          const destCol = school === "nursery" ? "nursery_primary_successful" : "high_school_successful";

          for (const cid of selectedCandidateIds[school]) {
            const doc = await db.collection(sourceCol).doc(cid).get();
            if (doc.exists) {
              const data = doc.data();
              let candName = "Unnamed Candidate";
              if (school === "nursery") {
                candName = data.nurseryChildName || data.name || "Unnamed Pupil";
              } else {
                if (data.highSchoolSurname || data.highSchoolOtherNames) {
                  candName = `${data.highSchoolSurname || ""} ${data.highSchoolOtherNames || ""}`.trim();
                } else {
                  candName = data.highSchoolName || data.highSchoolDeclName || data.name || "Unnamed Student";
                }
              }

              // Save ALL data to Successful collection
              await db.collection(destCol).doc(cid).set({
                ...data,
                name: candName,
                parentPhone: data.nurseryPhone || data.nurseryFatherHomeTel || data.nurseryMotherHomeTel || data.highSchoolPhone || data.highSchoolParentHomeTel || data.parentPhone || "",
                parentName: data.nurseryFatherName || data.nurseryMotherName || data.nurseryParentName || data.highSchoolParentName || data.parentName || "",
                class: data.class || data.nurseryClass || data.highSchoolClass || "",
                gender: data.gender || data.nurseryGender || data.highSchoolGender || "",
                passportUrl: data.passportUrl || "",
                birthCertUrl: data.birthCertUrl || "",
                resultUrl: data.resultFileUrl || data.resultUrl || "",
                testimonialUrl: data.testimonialUrl || "",
                passed: true,
                promotedAt: new Date().toISOString()
              });
              
              // Delete from original applications
              await db.collection(sourceCol).doc(cid).delete();
            }
          }

          await writeAuditLog("Promote Candidates", `Moved ${count} candidates with all documents and records to successful admissions database.`);
          showToast(`Successfully moved ${count} candidates to successful admissions list.`);
          loadCandidates(school);
          loadDashboardData();
        } catch (err) {
          showToast("Failed to promote candidates: " + err.message, false);
          btn.disabled = false;
        }
      }
    });
  });

  // Delete active application candidate
  window.deleteCandidate = async (school, id, name) => {
    if (confirm(`Are you sure you want to permanently delete candidate registration for "${name}"? This deletes all their database fields.`)) {
      if (!window.firebaseReady) return;
      try {
        const db = firebase.firestore();
        const col = school === "nursery" ? "nursery_primary_registration" : "high_school_registration";
        await db.collection(col).doc(id).delete();
        
        await writeAuditLog("Delete Candidate", `Permanently deleted active candidate application for "${name}".`);
        showToast("Candidate deleted successfully.");
        loadCandidates(school);
        loadDashboardData();
      } catch (err) {
        showToast("Delete failed: " + err.message, false);
      }
    }
  };

  // ==========================================================================
  // 4. Manual Candidate Registration Form (Modal popup)
  // ==========================================================================
  const addCandidateModalEl = document.getElementById("addCandidateModal");
  let addCandidateModalInstance = null;
  if (addCandidateModalEl) {
    addCandidateModalInstance = new bootstrap.Modal(addCandidateModalEl);
  }

  window.openAddCandidateModal = (school) => {
    if (!addCandidateModalInstance) return;
    
    document.getElementById("addCandSchoolType").value = school;
    document.getElementById("addCandidateForm").reset();
    document.getElementById("addCandidateModalError").classList.add("d-none");
    
    const label = document.getElementById("addCandidateModalLabel");
    const classSelect = document.getElementById("addCandClass");
    classSelect.innerHTML = "";

    if (school === "nursery") {
      label.textContent = "Register New Pupil (School A)";
      const classes = ["Foundation 1", "Foundation 2", "Nursery 1", "Nursery 2", "Primary 1", "Primary 2", "Primary 3", "Primary 4", "Primary 5", "Primary 6"];
      classes.forEach(c => classSelect.innerHTML += `<option value="${c}">${c}</option>`);
    } else {
      label.textContent = "Register New Student (School B)";
      const classes = ["JSS 1", "JSS 2", "JSS 3", "SSS 1", "SSS 2", "SSS 3"];
      classes.forEach(c => classSelect.innerHTML += `<option value="${c}">${c}</option>`);
    }

    addCandidateModalInstance.show();
  };

  // Local state helper for file uploads on manual form
  const manualFiles = {};
  function setupDocumentUploadListeners() {
    const inputs = [
      { id: "addCandPassportFile", key: "passportUrl" },
      { id: "addCandBirthFile", key: "birthCertUrl" },
      { id: "addCandResultFile", key: "resultFileUrl" },
      { id: "addCandTestimonialFile", key: "testimonialUrl" }
    ];

    inputs.forEach(item => {
      const el = document.getElementById(item.id);
      if (el) {
        el.addEventListener("change", async (e) => {
          const file = e.target.files[0];
          if (!file) return;

          const labelEl = el.closest(".mb-3")?.querySelector(".form-label");
          const originalLabel = labelEl ? labelEl.textContent : "";
          if (labelEl) labelEl.innerHTML = `${originalLabel} <span class="text-accent small"><i class="fa-solid fa-spinner fa-spin"></i> Processing...</span>`;

          try {
            const base64Data = await fileToBase64(file);
            manualFiles[item.key] = base64Data;
            if (labelEl) labelEl.innerHTML = `${originalLabel} <span class="text-success small"><i class="fa-solid fa-check"></i> Done</span>`;
          } catch (err) {
            console.error("File processing failed:", err);
            if (labelEl) labelEl.innerHTML = `${originalLabel} <span class="text-danger small">Processing failed</span>`;
          }
        });
      }
    });
  }

  const addCandidateForm = document.getElementById("addCandidateForm");
  if (addCandidateForm) {
    addCandidateForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      
      const school = document.getElementById("addCandSchoolType").value;
      const name = document.getElementById("addCandName").value.trim();
      const gender = document.getElementById("addCandGender").value;
      const targetClass = document.getElementById("addCandClass").value;
      const parentName = document.getElementById("addCandParentName").value.trim();
      const parentPhone = document.getElementById("addCandPhone").value.trim();
      
      if (!window.firebaseReady) return;

      try {
        const db = firebase.firestore();
        const col = school === "nursery" ? "nursery_primary_registration" : "high_school_registration";

        const payload = {
          class: targetClass,
          gender: gender,
          createdAt: new Date().toISOString(),
          status: "pending",
          passed: false,
          passportUrl: manualFiles["passportUrl"] || "",
          birthCertUrl: manualFiles["birthCertUrl"] || "",
          resultFileUrl: manualFiles["resultFileUrl"] || "",
          testimonialUrl: manualFiles["testimonialUrl"] || ""
        };

        if (school === "nursery") {
          payload.nurseryChildName = name;
          payload.nurseryParentName = parentName;
          payload.nurseryPhone = parentPhone;
        } else {
          payload.highSchoolName = name;
          payload.highSchoolParentName = parentName;
          payload.highSchoolPhone = parentPhone;
        }

        await db.collection(col).add(payload);
        await writeAuditLog("Manual Register", `Registered new candidate "${name}" manually in class [${targetClass}].`);
        
        showToast(`Successfully registered ${name} in ${targetClass}.`);
        addCandidateModalInstance.hide();
        loadCandidates(school);
        loadDashboardData();
      } catch (err) {
        showToast("Registration failed: " + err.message, false);
      }
    });
  }

  // ==========================================================================
  // 5. Successful Candidates Module (View/Move back/Delete)
  // ==========================================================================
  let selectedSuccIds = { nursery: [], high: [] };

  async function loadSuccessfulCandidates() {
    if (!window.firebaseReady) return;

    try {
      const db = firebase.firestore();

      const nurserySnapshot = await db.collection("nursery_primary_successful").get();
      const nurseryList = [];
      nurserySnapshot.forEach(doc => {
        const d = doc.data();
        nurseryList.push({
          id: doc.id,
          ...d,
          name: d.nurseryChildName || d.name || "Unnamed Pupil",
          class: d.class || d.nurseryClass || "Primary",
          gender: d.gender || d.nurseryGender || "",
          parentName: d.nurseryFatherName || d.nurseryMotherName || d.nurseryParentName || d.parentName || "",
          parentPhone: d.nurseryPhone || d.nurseryFatherHomeTel || d.nurseryMotherHomeTel || d.parentPhone || "",
          passportUrl: d.passportUrl || "",
          birthCertUrl: d.birthCertUrl || "",
          resultUrl: d.resultFileUrl || d.resultUrl || "",
          testimonialUrl: d.testimonialUrl || ""
        });
      });
      activeSuccessful["nursery"] = nurseryList;
      renderSuccessfulTable("nursery", nurseryList);

      const highSnapshot = await db.collection("high_school_successful").get();
      const highList = [];
      highSnapshot.forEach(doc => {
        const d = doc.data();
        let candName = d.name;
        if (d.highSchoolSurname || d.highSchoolOtherNames) {
          candName = `${d.highSchoolSurname || ""} ${d.highSchoolOtherNames || ""}`.trim();
        } else if (!candName) {
          candName = d.highSchoolName || d.highSchoolDeclName || "Unnamed Student";
        }
        highList.push({
          id: doc.id,
          ...d,
          name: candName,
          class: d.class || d.highSchoolClass || "School B",
          gender: d.gender || d.highSchoolGender || "",
          parentName: d.highSchoolParentName || d.parentName || "",
          parentPhone: d.highSchoolPhone || d.highSchoolParentHomeTel || d.parentPhone || "",
          passportUrl: d.passportUrl || "",
          birthCertUrl: d.birthCertUrl || "",
          resultUrl: d.resultFileUrl || d.resultUrl || "",
          testimonialUrl: d.testimonialUrl || ""
        });
      });
      activeSuccessful["high"] = highList;
      renderSuccessfulTable("high", highList);
    } catch (err) {
      console.error("Failed to load successful candidates:", err);
    }
  }

  function renderSuccessfulTable(school, list) {
    const tbody = document.getElementById(`succ${school.charAt(0).toUpperCase() + school.slice(1)}TableBody`);
    const selectAll = document.getElementById(`succ${school.charAt(0).toUpperCase() + school.slice(1)}SelectAll`);
    if (!tbody || !selectAll) return;
    
    tbody.innerHTML = "";
    selectAll.checked = false;
    selectedSuccIds[school] = [];

    if (list.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" class="text-center py-4 text-muted">No successful candidates found.</td></tr>`;
      updateSuccessfulControls(school);
      return;
    }

    list.forEach(succ => {
      const passportSrc = succ.passportUrl && succ.passportUrl !== '#' ? succ.passportUrl : 'https://placehold.co/40x40/4a4163/e1a0a4?text=Avatar';
      const hasBirth = succ.birthCertUrl && succ.birthCertUrl !== '#' && succ.birthCertUrl.length > 20;
      const hasResult = (succ.resultUrl || succ.resultFileUrl) && (succ.resultUrl || succ.resultFileUrl) !== '#' && (succ.resultUrl || succ.resultFileUrl).length > 20;
      const hasTestimonial = succ.testimonialUrl && succ.testimonialUrl !== '#' && succ.testimonialUrl.length > 20;

      const row = document.createElement("tr");
      row.innerHTML = `
        <td>
          <input class="form-check-input succ-select-cb" type="checkbox" data-id="${succ.id}">
        </td>
        <td>
          <img src="${passportSrc}" 
               alt="Passport" class="rounded shadow-sm" style="width: 36px; height: 36px; object-fit: cover;"
               onerror="this.src='https://placehold.co/40x40/4a4163/e1a0a4?text=NS'">
        </td>
        <td>
          <strong class="text-primary-dark d-block">${succ.name}</strong>
          <span class="badge bg-success text-white small"><i class="fa-solid fa-check me-1"></i>Admitted</span>
        </td>
        <td><span class="badge bg-light text-dark border">${succ.class || 'N/A'}</span></td>
        <td>
          <div class="small"><strong>${succ.parentName || 'Parent'}</strong></div>
          <div class="text-muted small">${succ.parentPhone || 'No Phone'}</div>
        </td>
        <td>
          <div class="d-flex gap-1 align-items-center">
            <button class="btn btn-sm ${hasBirth ? 'btn-outline-primary' : 'btn-light text-muted disabled'} py-1 px-2 border" 
              onclick="downloadFile('${succ.birthCertUrl}', '${succ.name}_Birth_Certificate')" title="${hasBirth ? 'Download Birth Certificate' : 'No Birth Certificate'}">
              <i class="fa-solid fa-cake-candles"></i>
            </button>
            <button class="btn btn-sm ${hasResult ? 'btn-outline-warning text-dark' : 'btn-light text-muted disabled'} py-1 px-2 border" 
              onclick="downloadFile('${succ.resultUrl || succ.resultFileUrl}', '${succ.name}_Academic_Result')" title="${hasResult ? 'Download Academic Result' : 'No Academic Result'}">
              <i class="fa-solid fa-square-poll-vertical"></i>
            </button>
            <button class="btn btn-sm ${hasTestimonial ? 'btn-outline-success' : 'btn-light text-muted disabled'} py-1 px-2 border" 
              onclick="downloadFile('${succ.testimonialUrl}', '${succ.name}_Testimonial')" title="${hasTestimonial ? 'Download Testimonial' : 'No Testimonial'}">
              <i class="fa-solid fa-award"></i>
            </button>
            <button class="btn btn-sm btn-outline-dark py-1 px-2 border" 
              onclick="downloadCandidateDocuments('${school}', '${succ.id}')" title="Download All Documents">
              <i class="fa-solid fa-file-arrow-down"></i>
            </button>
          </div>
        </td>
        <td class="text-end text-nowrap">
          <button class="btn btn-outline-info btn-sm rounded-circle me-1" onclick="printCandidateForm('${school}', '${succ.id}', 'successful')" title="Print Application Form">
            <i class="fa-solid fa-print"></i>
          </button>
          <button class="btn btn-outline-danger btn-sm rounded-circle me-1" onclick="deleteSuccessful('${school}', '${succ.id}', '${succ.name}')" title="Delete">
            <i class="fa-solid fa-trash-can"></i>
          </button>
        </td>
      `;

      row.querySelector(".succ-select-cb").addEventListener("change", (e) => {
        const id = e.target.getAttribute("data-id");
        if (e.target.checked) {
          selectedSuccIds[school].push(id);
        } else {
          selectedSuccIds[school] = selectedSuccIds[school].filter(i => i !== id);
        }
        updateSuccessfulControls(school);
      });

      tbody.appendChild(row);
    });

    selectAll.onchange = (e) => {
      const cbs = tbody.querySelectorAll(".succ-select-cb");
      selectedSuccIds[school] = [];
      cbs.forEach(cb => {
        cb.checked = e.target.checked;
        if (e.target.checked) {
          selectedSuccIds[school].push(cb.getAttribute("data-id"));
        }
      });
      updateSuccessfulControls(school);
    };

    updateSuccessfulControls(school);
  }

  function updateSuccessfulControls(school) {
    const btnReturn = document.getElementById(`${school}BtnReturnReg`);
    if (btnReturn) btnReturn.disabled = selectedSuccIds[school].length === 0;
  }

  window.deleteSuccessful = async (school, id, name) => {
    if (confirm(`Are you sure you want to permanently delete successful candidate "${name}"? This removes them from the success directories.`)) {
      if (!window.firebaseReady) return;

      try {
        const db = firebase.firestore();
        const col = school === "nursery" ? "nursery_primary_successful" : "high_school_successful";
        await db.collection(col).doc(id).delete();

        await writeAuditLog("Delete Successful", `Deleted "${name}" from successful candidate notice rosters.`);
        showToast("Successful candidate deleted.");
        loadSuccessfulCandidates();
        loadDashboardData();
      } catch (err) {
        showToast("Delete failed: " + err.message, false);
      }
    }
  };

  // Return to active registration action (Preserving ALL data & documents)
  const returnButtons = document.querySelectorAll("[id$='BtnReturnReg']");
  returnButtons.forEach(btn => {
    btn.addEventListener("click", async () => {
      const school = btn.id.startsWith("nursery") ? "nursery" : "high";
      const count = selectedSuccIds[school].length;

      if (confirm(`Are you sure you want to return the ${count} selected candidates back to active Registrations? All their details and uploaded documents will remain intact.`)) {
        if (!window.firebaseReady) return;

        try {
          const db = firebase.firestore();
          const sourceCol = school === "nursery" ? "nursery_primary_successful" : "high_school_successful";
          const destCol = school === "nursery" ? "nursery_primary_registration" : "high_school_registration";

          for (const sid of selectedSuccIds[school]) {
            const doc = await db.collection(sourceCol).doc(sid).get();
            if (doc.exists) {
              const data = doc.data();
              
              // Restore all original data into registration collection
              await db.collection(destCol).doc(sid).set({
                ...data,
                status: "pending",
                passed: true,
                returnedAt: new Date().toISOString()
              });
              await db.collection(sourceCol).doc(sid).delete();
            }
          }

          await writeAuditLog("Demote Candidates", `Returned ${count} candidates back to active registration registry with all documents intact.`);
          showToast(`Returned ${count} candidates to active registrations.`);
          loadSuccessfulCandidates();
          loadDashboardData();
        } catch (err) {
          showToast("Failed to return candidates: " + err.message, false);
        }
      }
    });
  });

  // ==========================================================================
  // Print & Download Full Candidate Application Form
  // ==========================================================================
  window.printCandidateForm = async (school, id, source = "registration") => {
    let cand = null;
    if (source === "registration") {
      cand = (activeCandidates[school] || []).find(c => c.id === id);
    } else {
      cand = (activeSuccessful[school] || []).find(c => c.id === id);
    }

    if (!cand && window.firebaseReady) {
      try {
        const db = firebase.firestore();
        const col = source === "registration" 
          ? (school === "nursery" ? "nursery_primary_registration" : "high_school_registration")
          : (school === "nursery" ? "nursery_primary_successful" : "high_school_successful");
        const doc = await db.collection(col).doc(id).get();
        if (doc.exists) cand = { id: doc.id, ...doc.data() };
      } catch (err) {
        console.error("Fetch candidate failed:", err);
      }
    }

    if (!cand) {
      alert("Candidate record could not be loaded.");
      return;
    }

    const printArea = document.getElementById("printableFormArea");
    const docButtonsContainer = document.getElementById("printModalDocButtons");
    if (!printArea) return;

    const fullName = cand.name || cand.nurseryChildName || cand.highSchoolName || (cand.highSchoolSurname ? `${cand.highSchoolSurname} ${cand.highSchoolOtherNames || ''}`.trim() : 'Unnamed Candidate');
    const candClass = cand.class || cand.nurseryClass || cand.highSchoolClass || 'N/A';
    const gender = cand.gender || cand.nurseryGender || cand.highSchoolGender || 'N/A';
    const dob = cand.nurseryDob || cand.highSchoolDob || cand.dob || 'N/A';
    const age = cand.nurseryAge || cand.highSchoolAge || cand.age || 'N/A';
    const nationality = cand.nurseryNationality || cand.highSchoolNationality || cand.nationality || 'Nigerian';
    const state = cand.nurseryState || cand.highSchoolState || cand.state || 'N/A';
    const lga = cand.nurseryLga || cand.highSchoolLga || cand.lga || '';
    const religion = cand.nurseryReligion || cand.highSchoolReligion || cand.religion || 'N/A';
    const bloodGroup = cand.nurseryBloodGroup || cand.highSchoolBloodGroup || cand.bloodGroup || 'N/A';
    const genotype = cand.nurseryGenotype || cand.highSchoolGenotype || cand.genotype || 'N/A';

    const address = cand.nurseryAddress || cand.highSchoolAddress || cand.address || 'N/A';
    const landmark = cand.nurseryLandmark || cand.highSchoolLandmark || cand.landmark || 'N/A';
    const phone = cand.nurseryPhone || cand.highSchoolPhone || cand.parentPhone || 'N/A';

    const fatherName = cand.nurseryFatherName || cand.highSchoolFatherName || cand.fatherName || '';
    const fatherPhone = cand.nurseryFatherPhone || cand.nurseryFatherHomeTel || cand.highSchoolFatherPhone || cand.highSchoolFatherHomeTel || cand.fatherPhone || '';
    const fatherEmail = cand.nurseryFatherEmail || cand.highSchoolFatherEmail || cand.fatherEmail || '';
    const fatherOcc = cand.nurseryFatherOccupation || cand.highSchoolFatherOccupation || cand.fatherOccupation || '';
    const fatherWork = cand.nurseryFatherWork || cand.highSchoolFatherWork || cand.fatherWork || '';

    const motherName = cand.nurseryMotherName || cand.highSchoolMotherName || cand.motherName || '';
    const motherPhone = cand.nurseryMotherPhone || cand.nurseryMotherHomeTel || cand.highSchoolMotherPhone || cand.highSchoolMotherHomeTel || cand.motherPhone || '';
    const motherEmail = cand.nurseryMotherEmail || cand.highSchoolMotherEmail || cand.motherEmail || '';
    const motherOcc = cand.nurseryMotherOccupation || cand.highSchoolMotherOccupation || cand.motherOccupation || '';
    const motherWork = cand.nurseryMotherWork || cand.highSchoolMotherWork || cand.motherWork || '';

    const emergencyName = cand.nurseryEmergencyName || cand.highSchoolEmergencyName || cand.emergencyName || 'N/A';
    const emergencyPhone = cand.nurseryEmergencyPhone || cand.highSchoolEmergencyPhone || cand.emergencyPhone || 'N/A';
    const medicalCond = cand.nurserySpecialAidDetail || cand.nurserySpecialAidReq || cand.highSchoolMedical || cand.medical || 'None Reported / Fit';

    const prevSchool = cand.nurseryPrevSchool || cand.highSchoolPrevSchool || cand.prevSchool || 'N/A';
    const lastClass = cand.nurseryLastClass || cand.highSchoolLastClass || cand.lastClass || 'N/A';

    const passportUrl = cand.passportUrl || '';
    const birthCertUrl = cand.birthCertUrl || '';
    const resultUrl = cand.resultUrl || cand.resultFileUrl || '';
    const testimonialUrl = cand.testimonialUrl || '';

    const hasPassport = passportUrl && passportUrl !== '#' && passportUrl.length > 20;
    const hasBirth = birthCertUrl && birthCertUrl !== '#' && birthCertUrl.length > 20;
    const hasResult = resultUrl && resultUrl !== '#' && resultUrl.length > 20;
    const hasTestimonial = testimonialUrl && testimonialUrl !== '#' && testimonialUrl.length > 20;

    const passportImg = hasPassport ? passportUrl : 'https://placehold.co/120x140/4a4163/e1a0a4?text=No+Photo';
    const subDate = cand.createdAt ? new Date(cand.createdAt).toLocaleDateString("en-GB", { day: 'numeric', month: 'short', year: 'numeric' }) : new Date().toLocaleDateString();

    printArea.innerHTML = `
      <div class="printable-form-header d-flex justify-content-between align-items-center">
        <div class="d-flex align-items-center gap-3">
          <img src="img/logo.png" alt="School Logo" style="width: 75px; height: 75px; object-fit: cover;" class="rounded border">
          <div>
            <h3 class="fw-bold mb-0 text-primary-dark" style="font-family: 'Playfair Display', serif; letter-spacing: 0.5px;">ENGREG SCHOOLS</h3>
            <p class="mb-0 text-muted small"><strong>School A & School B</strong></p>
            <p class="mb-0 text-muted small">24 Bankole St, Somolu, Lagos, Nigeria | Tel: +2347061359270 | Email: info@engregschool.com</p>
            <p class="mb-0 text-accent small fw-bold">MOTTO: Nurturing Future Leaders</p>
          </div>
        </div>
        <div class="text-end">
          <div class="print-passport-box shadow-sm ms-auto">
            <img src="${passportImg}" alt="Passport Photograph" onerror="this.src='https://placehold.co/120x140/4a4163/e1a0a4?text=No+Photo'">
          </div>
          <span class="badge bg-primary-dark text-accent mt-2 py-1 px-2 d-block small">${school === 'nursery' ? 'SCHOOL A' : 'SCHOOL B'}</span>
        </div>
      </div>

      <div class="text-center my-3 pb-2 border-bottom">
        <h4 class="fw-bold text-uppercase mb-1" style="letter-spacing: 1px;">Official Admission Application Form</h4>
        <div class="d-flex justify-content-between text-muted small px-2">
          <span><strong>Application Ref:</strong> ${cand.id}</span>
          <span><strong>Academic Session:</strong> 2026/2027</span>
          <span><strong>Date Submitted:</strong> ${subDate}</span>
          <span><strong>Status:</strong> <span class="badge ${source === 'successful' ? 'bg-success' : 'bg-primary'}">${source === 'successful' ? 'ADMITTED / SUCCESSFUL' : 'REGISTERED'}</span></span>
        </div>
      </div>

      <div class="printable-form-section-title">1. Candidate Information (Bio-Data)</div>
      <table class="print-data-table">
        <tr>
          <th>Full Name</th>
          <td colspan="3"><strong class="text-primary-dark fs-6">${fullName}</strong></td>
        </tr>
        <tr>
          <th>Date of Birth</th>
          <td>${dob}</td>
          <th>Calculated Age</th>
          <td>${age} yrs</td>
        </tr>
        <tr>
          <th>Gender</th>
          <td>${gender}</td>
          <th>Class Applied For</th>
          <td><strong class="text-primary-dark">${candClass}</strong></td>
        </tr>
        <tr>
          <th>Nationality</th>
          <td>${nationality}</td>
          <th>State of Origin / LGA</th>
          <td>${state} ${lga ? '(' + lga + ')' : ''}</td>
        </tr>
        <tr>
          <th>Religion</th>
          <td>${religion}</td>
          <th>Blood Group / Genotype</th>
          <td>${bloodGroup} / ${genotype}</td>
        </tr>
      </table>

      <div class="printable-form-section-title">2. Residential & Contact Information</div>
      <table class="print-data-table">
        <tr>
          <th>Residential Address</th>
          <td colspan="3">${address}</td>
        </tr>
        <tr>
          <th>Nearest Landmark / City</th>
          <td>${landmark}</td>
          <th>Primary Phone</th>
          <td>${phone}</td>
        </tr>
      </table>

      <div class="printable-form-section-title">3. Parent / Guardian Background</div>
      <table class="print-data-table">
        <tr>
          <th colspan="2" class="text-center bg-light">Father / Male Guardian</th>
          <th colspan="2" class="text-center bg-light">Mother / Female Guardian</th>
        </tr>
        <tr>
          <th>Full Name</th>
          <td>${fatherName || cand.parentName || 'N/A'}</td>
          <th>Full Name</th>
          <td>${motherName || 'N/A'}</td>
        </tr>
        <tr>
          <th>Phone Number</th>
          <td>${fatherPhone || cand.parentPhone || 'N/A'}</td>
          <th>Phone Number</th>
          <td>${motherPhone || 'N/A'}</td>
        </tr>
        <tr>
          <th>Email Address</th>
          <td>${fatherEmail || 'N/A'}</td>
          <th>Email Address</th>
          <td>${motherEmail || 'N/A'}</td>
        </tr>
        <tr>
          <th>Occupation</th>
          <td>${fatherOcc || 'N/A'}</td>
          <th>Occupation</th>
          <td>${motherOcc || 'N/A'}</td>
        </tr>
        <tr>
          <th>Work Address</th>
          <td>${fatherWork || 'N/A'}</td>
          <th>Work Address</th>
          <td>${motherWork || 'N/A'}</td>
        </tr>
      </table>

      <div class="printable-form-section-title">4. Medical, Health & Emergency Contacts</div>
      <table class="print-data-table">
        <tr>
          <th>Emergency Contact Person</th>
          <td>${emergencyName}</td>
          <th>Emergency Phone</th>
          <td>${emergencyPhone}</td>
        </tr>
        <tr>
          <th>Medical Allergies / Special Needs</th>
          <td colspan="3">${medicalCond}</td>
        </tr>
      </table>

      <div class="printable-form-section-title">5. Previous Educational Record</div>
      <table class="print-data-table">
        <tr>
          <th>Previous School Attended</th>
          <td>${prevSchool}</td>
          <th>Last Class Passed</th>
          <td>${lastClass}</td>
        </tr>
      </table>

      <div class="printable-form-section-title">6. Attached Verification Documents</div>
      <table class="print-data-table">
        <tr>
          <th>Passport Photograph</th>
          <td>${hasPassport ? '<span class="text-success fw-bold">✔ Attached</span>' : '<span class="text-muted">Not Attached</span>'}</td>
          <th>Birth Certificate</th>
          <td>
            ${hasBirth ? `<span class="text-success fw-bold">✔ Attached</span> <button class="btn btn-sm btn-outline-primary py-0 px-2 ms-2 no-print" onclick="downloadFile('${birthCertUrl}', '${fullName}_BirthCert')"><i class="fa-solid fa-download"></i> Download</button>` : '<span class="text-muted">Not Attached</span>'}
          </td>
        </tr>
        <tr>
          <th>Academic Result Slip</th>
          <td>
            ${hasResult ? `<span class="text-success fw-bold">✔ Attached</span> <button class="btn btn-sm btn-outline-warning text-dark py-0 px-2 ms-2 no-print" onclick="downloadFile('${resultUrl}', '${fullName}_AcademicResult')"><i class="fa-solid fa-download"></i> Download</button>` : '<span class="text-muted">Not Attached</span>'}
          </td>
          <th>School Testimonial</th>
          <td>
            ${hasTestimonial ? `<span class="text-success fw-bold">✔ Attached</span> <button class="btn btn-sm btn-outline-success py-0 px-2 ms-2 no-print" onclick="downloadFile('${testimonialUrl}', '${fullName}_Testimonial')"><i class="fa-solid fa-download"></i> Download</button>` : '<span class="text-muted">Not Attached</span>'}
          </td>
        </tr>
      </table>

      <div class="printable-form-section-title">7. Declaration & Official Endorsement</div>
      <div class="border p-3 rounded mb-2 bg-light" style="font-size: 11.5px;">
        <p class="mb-2"><strong>PARENT / GUARDIAN DECLARATION:</strong> I hereby declare that the information provided in this admission form is complete and accurate to the best of my knowledge. If admitted, I agree that the child will abide by all rules and regulations of Engreg Schools.</p>
        <div class="row pt-4 mt-2">
          <div class="col-6">
            <div class="border-bottom border-dark" style="height: 25px;"></div>
            <p class="small text-muted mb-0 pt-1">Parent / Guardian Signature & Date</p>
          </div>
          <div class="col-6 text-end">
            <div class="border-bottom border-dark" style="height: 25px;"></div>
            <p class="small text-muted mb-0 pt-1">School Registrar / Principal Endorsement Stamp & Date</p>
          </div>
        </div>
      </div>
    `;

    // Setup Footer Document buttons
    if (docButtonsContainer) {
      docButtonsContainer.innerHTML = `
        <button class="btn btn-outline-dark btn-sm" onclick="downloadCandidateDocuments('${school}', '${cand.id}')">
          <i class="fa-solid fa-file-arrow-down me-1"></i> Download All Documents
        </button>
      `;
    }

    const modalEl = document.getElementById("printApplicationModal");
    if (modalEl) {
      let modal = bootstrap.Modal.getInstance(modalEl);
      if (!modal) modal = new bootstrap.Modal(modalEl);
      modal.show();
    }
  };

  // ==========================================================================
  // 6. Reports & Downloads Handler (PDF, EXCEL, PRINT)
  // ==========================================================================
  
  // Helper to fetch all records for a school registry
  async function fetchRegistryRecords(colName, schoolKey) {
    let records = [];
    if (window.firebaseReady) {
      try {
        const db = firebase.firestore();
        const snapshot = await db.collection(colName).get();
        snapshot.forEach(doc => {
          const d = doc.data();
          let candName = "Unnamed Candidate";
          if (schoolKey === "nursery") {
            candName = d.nurseryChildName || d.name || "Unnamed Pupil";
          } else {
            if (d.highSchoolSurname || d.highSchoolOtherNames) {
              candName = `${d.highSchoolSurname || ""} ${d.highSchoolOtherNames || ""}`.trim();
            } else {
              candName = d.highSchoolName || d.highSchoolDeclName || d.name || "Unnamed Student";
            }
          }
          
          records.push({
            id: doc.id,
            ...d,
            name: candName,
            class: d.class || d.nurseryClass || d.highSchoolClass || "N/A",
            gender: d.gender || d.nurseryGender || d.highSchoolGender || "N/A",
            dob: d.nurseryDob || d.highSchoolDob || d.dob || "N/A",
            parentName: d.nurseryFatherName || d.nurseryMotherName || d.nurseryParentName || d.highSchoolParentName || d.parentName || "N/A",
            parentPhone: d.nurseryFatherHomeTel || d.nurseryMotherHomeTel || d.nurseryPhone || d.highSchoolParentHomeTel || d.highSchoolPhone || d.parentPhone || "N/A",
            parentEmail: d.nurseryFatherEmail || d.nurseryMotherEmail || d.email || "N/A",
            address: d.nurseryResAddress || d.highSchoolParentResAddress || d.address || "N/A",
            passed: d.passed || false,
            createdAt: d.createdAt || d.submissionDate || ""
          });
        });
      } catch (err) {
        console.warn("Firestore fetch error, falling back to cached candidates:", err);
      }
    }

    if (records.length === 0 && activeCandidates[schoolKey] && activeCandidates[schoolKey].length > 0) {
      records = [...activeCandidates[schoolKey]];
    }

    return records;
  }

  // Export Registry Table to Excel (CSV) or Printable PDF Report
  window.exportTable = async (tableType, format) => {
    const isNursery = tableType.includes("nursery");
    const colName = isNursery ? "nursery_primary_registration" : "high_school_registration";
    const schoolKey = isNursery ? "nursery" : "high";
    const schoolTitle = isNursery ? "School A" : "School B";

    showToast(`Preparing ${schoolTitle} registry ${format.toUpperCase()}...`);

    const records = await fetchRegistryRecords(colName, schoolKey);

    if (!records || records.length === 0) {
      alert(`No registered candidates found in the ${schoolTitle} registry.`);
      return;
    }

    if (format === "excel" || format === "csv") {
      // Generate clean UTF-8 CSV with Excel BOM
      const escapeCsv = (str) => `"${String(str || "").replace(/"/g, '""')}"`;
      
      const headers = [
        "S/N",
        "Candidate Full Name",
        "Applied Class",
        "Gender",
        "Date of Birth",
        "Parent / Guardian Name",
        "Parent Phone Number",
        "Parent Email",
        "Residential Address",
        "Entrance Exam Status",
        "Registration Date"
      ];

      const csvRows = [headers.map(escapeCsv).join(",")];

      records.forEach((r, idx) => {
        const formattedDate = r.createdAt ? new Date(r.createdAt).toLocaleDateString() : "N/A";
        csvRows.push([
          idx + 1,
          r.name,
          r.class,
          r.gender,
          r.dob,
          r.parentName,
          r.parentPhone,
          r.parentEmail,
          r.address,
          r.passed ? "Passed / Qualified" : "Pending / Under Review",
          formattedDate
        ].map(escapeCsv).join(","));
      });

      const csvContent = "\uFEFF" + csvRows.join("\r\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const dateStr = new Date().toISOString().slice(0, 10);
      link.href = url;
      link.download = `Engreg_Schools_${schoolKey.toUpperCase()}_Registry_${dateStr}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      showToast(`Exported ${records.length} candidate records to Excel.`);
      await writeAuditLog("Export Registry", `Exported ${records.length} ${schoolTitle} registration records to Excel/CSV.`);

    } else if (format === "pdf") {
      // Render Printable PDF / Sheet in the print modal
      const printableArea = document.getElementById("printableFormArea");
      const docButtons = document.getElementById("printModalDocButtons");
      const modalLabel = document.getElementById("printApplicationModalLabel");

      if (!printableArea) {
        alert("Printable container not found in DOM.");
        return;
      }

      if (docButtons) docButtons.innerHTML = "";
      if (modalLabel) modalLabel.textContent = `${schoolTitle} — Admissions Registry Directory`;

      const today = new Date().toLocaleDateString("en-GB", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric"
      });

      let rowsHtml = "";
      records.forEach((r, idx) => {
        rowsHtml += `
          <tr>
            <td class="text-center fw-bold">${idx + 1}</td>
            <td>
              <strong class="text-primary-dark">${r.name}</strong>
              ${r.dob && r.dob !== 'N/A' ? `<div class="small text-muted">DOB: ${r.dob}</div>` : ''}
            </td>
            <td><span class="badge bg-light text-dark border">${r.class}</span></td>
            <td>${r.gender}</td>
            <td>
              <div>${r.parentName}</div>
              <small class="text-muted">${r.parentPhone}</small>
            </td>
            <td class="text-center">
              <span class="badge ${r.passed ? 'bg-success text-white' : 'bg-secondary-light text-dark'}">
                ${r.passed ? 'Passed' : 'Pending'}
              </span>
            </td>
          </tr>
        `;
      });

      printableArea.innerHTML = `
        <div class="printable-form-header d-flex align-items-center justify-content-between pb-3 border-bottom border-dark mb-4">
          <div class="d-flex align-items-center gap-3">
            <img src="img/logo.png" alt="Logo" style="width: 65px; height: 65px; object-fit: cover; border-radius: 8px;">
            <div>
              <h3 class="fw-bold text-primary-dark mb-0 tracking-wide">ENGREG SCHOOLS</h3>
              <p class="mb-0 small text-muted">24 Bankole St, Somolu, Lagos 102216, Lagos, Nigeria | Tel: +234 706 135 9270</p>
              <span class="badge bg-primary text-white mt-1 px-3 py-1">OFFICIAL ADMISSIONS REGISTRY</span>
            </div>
          </div>
          <div class="text-end">
            <h6 class="fw-bold text-primary mb-1">${schoolTitle.toUpperCase()}</h6>
            <div class="small text-muted">Generated: ${today}</div>
            <div class="small fw-bold text-dark mt-1">Total Candidates: ${records.length}</div>
          </div>
        </div>

        <div class="mb-4">
          <table class="table table-bordered table-striped align-middle print-data-table mb-0" style="font-size: 13px;">
            <thead class="table-dark">
              <tr>
                <th style="width: 5%;" class="text-center">S/N</th>
                <th style="width: 28%;">Candidate Name</th>
                <th style="width: 14%;">Class</th>
                <th style="width: 10%;">Gender</th>
                <th style="width: 28%;">Parent / Contact</th>
                <th style="width: 15%;" class="text-center">Exam Status</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
        </div>

        <div class="d-flex justify-content-between pt-4 mt-4 border-top border-secondary">
          <div class="text-center" style="width: 250px;">
            <div class="border-bottom border-dark pb-4 mb-2"></div>
            <p class="small fw-bold mb-0">Admissions Officer Signature</p>
          </div>
          <div class="text-center" style="width: 250px;">
            <div class="border-bottom border-dark pb-4 mb-2"></div>
            <p class="small fw-bold mb-0">Principal's Seal & Date</p>
          </div>
        </div>
      `;

      const modalEl = document.getElementById("printApplicationModal");
      if (modalEl) {
        let modal = bootstrap.Modal.getInstance(modalEl);
        if (!modal) modal = new bootstrap.Modal(modalEl);
        modal.show();
      }

      await writeAuditLog("View Registry Report", `Generated printable registry report for ${records.length} ${schoolTitle} applicants.`);
    }
  };

  // Official Notice Board Admission List Printout
  window.printSuccessfulList = async () => {
    showToast("Generating official admission list for notice board...");

    let nurseryList = [];
    let highList = [];

    if (window.firebaseReady) {
      try {
        const db = firebase.firestore();
        const nSnap = await db.collection("nursery_primary_successful").get();
        nSnap.forEach(doc => {
          const d = doc.data();
          nurseryList.push({
            id: doc.id,
            name: d.nurseryChildName || d.name || "Unnamed Pupil",
            class: d.class || d.nurseryClass || "Nursery/Primary",
            gender: d.gender || d.nurseryGender || "N/A"
          });
        });

        const hSnap = await db.collection("high_school_successful").get();
        hSnap.forEach(doc => {
          const d = doc.data();
          let candName = d.name;
          if (d.highSchoolSurname || d.highSchoolOtherNames) {
            candName = `${d.highSchoolSurname || ""} ${d.highSchoolOtherNames || ""}`.trim();
          } else if (!candName) {
            candName = d.highSchoolName || d.highSchoolDeclName || "Unnamed Student";
          }
          highList.push({
            id: doc.id,
            name: candName,
            class: d.class || d.highSchoolClass || "School B",
            gender: d.gender || d.highSchoolGender || "N/A"
          });
        });
      } catch (err) {
        console.warn("Firestore error fetching successful list:", err);
      }
    }

    if (nurseryList.length === 0 && activeSuccessful["nursery"]) {
      nurseryList = [...activeSuccessful["nursery"]];
    }
    if (highList.length === 0 && activeSuccessful["high"]) {
      highList = [...activeSuccessful["high"]];
    }

    if (nurseryList.length === 0 && highList.length === 0) {
      alert("No successful candidates have been published yet. Please move qualified candidates to the Successful list first.");
      return;
    }

    const printableArea = document.getElementById("printableFormArea");
    const docButtons = document.getElementById("printModalDocButtons");
    const modalLabel = document.getElementById("printApplicationModalLabel");

    if (!printableArea) {
      alert("Printable container not found in DOM.");
      return;
    }

    if (docButtons) docButtons.innerHTML = "";
    if (modalLabel) modalLabel.textContent = "Official Notice Board — Admission List";

    const today = new Date().toLocaleDateString("en-GB", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric"
    });

    const renderCandidateRows = (list) => {
      if (list.length === 0) {
        return `<tr><td colspan="4" class="text-center text-muted py-3">No candidates admitted in this category.</td></tr>`;
      }
      return list.map((cand, idx) => `
        <tr>
          <td class="text-center fw-bold">${idx + 1}</td>
          <td><strong class="text-primary-dark">${cand.name}</strong></td>
          <td><span class="badge bg-light text-dark border px-2 py-1">${cand.class}</span></td>
          <td class="text-center">
            <span class="badge bg-success text-white px-3 py-1">PROVISIONAL ADMISSION</span>
          </td>
        </tr>
      `).join("");
    };

    printableArea.innerHTML = `
      <div class="printable-form-header text-center pb-3 border-bottom border-dark mb-4">
        <div class="d-flex align-items-center justify-content-center gap-3 mb-2">
          <img src="img/logo.png" alt="Logo" style="width: 70px; height: 70px; object-fit: cover; border-radius: 8px;">
          <div class="text-start">
            <h2 class="fw-bold text-primary-dark mb-0 tracking-wide">ENGREG SCHOOLS</h2>
            <p class="mb-0 text-muted small">24 Bankole St, Somolu, Lagos 102216, Lagos, Nigeria | Tel: +234 706 135 9270</p>
            <p class="mb-0 small text-accent fw-bold">Motto: Excellence in Character & Learning</p>
          </div>
        </div>
        <div class="py-2 bg-primary-dark text-white rounded mt-3">
          <h5 class="fw-bold mb-0 text-accent letter-spacing-1">OFFICIAL ADMISSION LIST — NOTICE BOARD PUBLICATION</h5>
          <small class="text-white-50">2026/2027 ACADEMIC SESSION</small>
        </div>
      </div>

      <div class="alert alert-light border border-secondary-light p-3 mb-4 text-center">
        <strong class="text-primary-dark d-block mb-1">NOTICE TO PARENTS & GUARDIANS</strong>
        <span class="small text-muted">
          The underlisted candidates have been offered provisional admission into Engreg Schools for the 2026/2027 Academic Session.
          Successful applicants are advised to visit the Admissions Office with their credentials to complete acceptance formalities and collect admission packs.
        </span>
      </div>

      <!-- SECTION 1: SCHOOL A -->
      <div class="mb-5">
        <div class="d-flex align-items-center justify-content-between bg-light border-start border-4 border-primary p-2 mb-2">
          <h6 class="fw-bold text-primary-dark mb-0 text-uppercase">1. School A Admitted Candidates</h6>
          <span class="badge bg-primary text-white">${nurseryList.length} Admitted</span>
        </div>
        <table class="table table-bordered align-middle print-data-table mb-0" style="font-size: 13px;">
          <thead class="table-light">
            <tr>
              <th style="width: 8%;" class="text-center">S/N</th>
              <th style="width: 45%;">Candidate Full Name</th>
              <th style="width: 22%;">Admitted Class</th>
              <th style="width: 25%;" class="text-center">Status</th>
            </tr>
          </thead>
          <tbody>
            ${renderCandidateRows(nurseryList)}
          </tbody>
        </table>
      </div>

      <!-- SECTION 2: SCHOOL B -->
      <div class="mb-4">
        <div class="d-flex align-items-center justify-content-between bg-light border-start border-4 border-primary p-2 mb-2">
          <h6 class="fw-bold text-primary-dark mb-0 text-uppercase">2. School B Admitted Candidates</h6>
          <span class="badge bg-primary text-white">${highList.length} Admitted</span>
        </div>
        <table class="table table-bordered align-middle print-data-table mb-0" style="font-size: 13px;">
          <thead class="table-light">
            <tr>
              <th style="width: 8%;" class="text-center">S/N</th>
              <th style="width: 45%;">Candidate Full Name</th>
              <th style="width: 22%;">Admitted Class</th>
              <th style="width: 25%;" class="text-center">Status</th>
            </tr>
          </thead>
          <tbody>
            ${renderCandidateRows(highList)}
          </tbody>
        </table>
      </div>

      <!-- Official Sign-off block -->
      <div class="d-flex justify-content-between pt-4 mt-5 border-top border-dark">
        <div class="text-center" style="width: 220px;">
          <div class="border-bottom border-dark pb-4 mb-2"></div>
          <p class="small fw-bold mb-0">Chairman, Admissions Board</p>
          <small class="text-muted">Engreg Schools</small>
        </div>
        <div class="text-center" style="width: 200px;">
          <div class="border border-dark p-2 rounded small text-muted text-uppercase fw-bold" style="height: 65px; display: flex; align-items: center; justify-content: center;">
            Official School Stamp
          </div>
          <small class="text-muted d-block mt-1">Date: ${today}</small>
        </div>
        <div class="text-center" style="width: 220px;">
          <div class="border-bottom border-dark pb-4 mb-2"></div>
          <p class="small fw-bold mb-0">School Principal</p>
          <small class="text-muted">Engreg Schools</small>
        </div>
      </div>
    `;

    const modalEl = document.getElementById("printApplicationModal");
    if (modalEl) {
      let modal = bootstrap.Modal.getInstance(modalEl);
      if (!modal) modal = new bootstrap.Modal(modalEl);
      modal.show();
    }

    await writeAuditLog("Print Admission List", `Generated official admission notice board publication with ${nurseryList.length + highList.length} admitted candidates.`);
  };

  // ==========================================================================
  // 7. Portal Settings Config Manager
  // ==========================================================================
  const portalSettingsForm = document.getElementById("portalSettingsForm");
  
  async function loadSettings() {
    if (!window.firebaseReady) return;

    try {
      const db = firebase.firestore();
      const doc = await db.collection("settings").doc("global_config").get();
      
      if (doc.exists) {
        const config = doc.data();
        document.getElementById("setSchoolName").value = config.schoolName || "";
        document.getElementById("setSchoolEmail").value = config.administrativeEmail || "";
        document.getElementById("setSchoolPhone1").value = config.primaryPhone || "";
        document.getElementById("setSchoolPhone2").value = config.secondaryPhone || "";
        document.getElementById("setSchoolAddress").value = config.schoolContactAddress || "";
        document.getElementById("setAdmissionFee").value = config.applicationFormFee || "";
        document.getElementById("setAcademicSession").value = config.activeAcademicSession || "";
        document.getElementById("setMaxGalleryImages").value = config.maxGalleryImages || "";
        document.getElementById("setFacebook").value = config.facebookLink || "";
        document.getElementById("setInstagram").value = config.instagramLink || "";
        document.getElementById("setTwitter").value = config.twitterLink || "";
        document.getElementById("setLinkedin").value = config.linkedinLink || "";
        document.getElementById("setYoutube").value = config.youtubeLink || "";
      }
    } catch (err) {
      console.error("Failed to load settings:", err);
    }
  }

  if (portalSettingsForm) {
    portalSettingsForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      
      const payload = {
        schoolName: document.getElementById("setSchoolName").value.trim(),
        administrativeEmail: document.getElementById("setSchoolEmail").value.trim(),
        primaryPhone: document.getElementById("setSchoolPhone1").value.trim(),
        secondaryPhone: document.getElementById("setSchoolPhone2").value.trim(),
        schoolContactAddress: document.getElementById("setSchoolAddress").value.trim(),
        applicationFormFee: parseInt(document.getElementById("setAdmissionFee").value),
        activeAcademicSession: document.getElementById("setAcademicSession").value.trim(),
        maxGalleryImages: parseInt(document.getElementById("setMaxGalleryImages").value),
        facebookLink: document.getElementById("setFacebook").value.trim(),
        instagramLink: document.getElementById("setInstagram").value.trim(),
        twitterLink: document.getElementById("setTwitter").value.trim(),
        linkedinLink: document.getElementById("setLinkedin").value.trim(),
        youtubeLink: document.getElementById("setYoutube").value.trim()
      };

      if (!window.firebaseReady) return;

      try {
        const db = firebase.firestore();
        await db.collection("settings").doc("global_config").set(payload);

        await writeAuditLog("Update Settings", "Updated global portal settings configurations.");
        
        const settingsAlert = document.getElementById("settingsAlert");
        settingsAlert.classList.remove("d-none");
        showToast("Configuration settings saved successfully.");
        setTimeout(() => {
          settingsAlert.classList.add("d-none");
        }, 3000);
      } catch (err) {
        showToast("Failed to save settings: " + err.message, false);
      }
    });
  }

  // Helper: Convert File to Base64 (with optional compression for images)
  const fileToBase64 = (file, maxDimension = 800, quality = 0.7) => {
    return new Promise((resolve, reject) => {
      if (file.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onload = function (event) {
          const img = new Image();
          img.onload = function () {
            const canvas = document.createElement("canvas");
            let width = img.width;
            let height = img.height;

            if (width > maxDimension || height > maxDimension) {
              if (width > height) {
                height = Math.round((height * maxDimension) / width);
                width = maxDimension;
              } else {
                width = Math.round((width * maxDimension) / height);
                height = maxDimension;
              }
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext("2d");
            ctx.drawImage(img, 0, 0, width, height);

            const dataUrl = canvas.toDataURL("image/jpeg", quality);
            resolve(dataUrl);
          };
          img.onerror = (err) => reject(err);
          img.src = event.target.result;
        };
        reader.onerror = (err) => reject(err);
        reader.readAsDataURL(file);
      } else {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = (err) => reject(err);
        reader.readAsDataURL(file);
      }
    });
  };

});
