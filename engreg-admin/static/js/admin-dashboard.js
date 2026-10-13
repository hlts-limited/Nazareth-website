/* ==========================================================================
   Admin Dashboard Script Controller
   ========================================================================== */

document.addEventListener("DOMContentLoaded", () => {
  
  // Collapse/Expand Sidebar
  const sidebar = document.getElementById("sidebar");
  const sidebarCollapse = document.getElementById("sidebarCollapse");
  if (sidebarCollapse && sidebar) {
    sidebarCollapse.addEventListener("click", () => {
      sidebar.classList.toggle("collapsed");
    });
  }

  // Handle SPA Tab Switching
  const sidebarLinks = document.querySelectorAll(".sidebar-link, .sidebar-sublink");
  const tabPanels = document.querySelectorAll(".tab-panel");

  sidebarLinks.forEach(link => {
    link.addEventListener("click", (e) => {
      const tabId = link.getAttribute("data-tab");
      if (!tabId) return; // Dropdowns do not have data-tab

      e.preventDefault();

      // Deactivate all links and panels
      sidebarLinks.forEach(l => l.classList.remove("active"));
      tabPanels.forEach(p => p.classList.remove("active"));

      // Activate clicked link & target panel
      link.classList.add("active");
      const targetPanel = document.getElementById(tabId);
      if (targetPanel) {
        targetPanel.classList.add("active");
        
        // Trigger specific tab loads
        if (tabId === "dashboard-tab") loadDashboardData();
        if (tabId === "gallery-tab") loadGalleryImages();
        if (tabId === "nursery-tab") loadCandidates("nursery");
        if (tabId === "high-tab") loadCandidates("high");
        if (tabId === "successful-tab") loadSuccessfulCandidates();
        if (tabId === "settings-tab") loadSettings();
      }

      // Auto-collapse sidebar on mobile
      if (window.innerWidth <= 991) {
        sidebar.classList.add("collapsed");
      }
    });
  });

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

  // ==========================================================================
  // 1. Dashboard Tab Overview & Analytics Chart
  // ==========================================================================
  let myChartInstance = null;

  function loadDashboardData() {
    fetch("/api/dashboard/stats")
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          // Stat figures
          document.getElementById("statNurseryReg").textContent = data.nursery_reg;
          document.getElementById("statHighReg").textContent = data.high_reg;
          document.getElementById("statSuccessful").textContent = data.total_success;
          
          const max_gallery = data.gallery_max || 100;
          document.getElementById("statGalleryCount").textContent = `${data.gallery_uploaded} / ${max_gallery}`;
          
          // Progress bar
          const progressPct = Math.min((data.gallery_uploaded / max_gallery) * 100, 100);
          const progressBar = document.getElementById("statGalleryProgress");
          progressBar.style.width = `${progressPct}%`;
          progressBar.setAttribute("aria-valuenow", progressPct);

          // Animate Chart.js
          renderChart(data.nursery_reg, data.high_reg, data.nursery_success, data.high_success);
        }
      });

    loadLogs();
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
            backgroundColor: 'rgba(11, 37, 69, 0.85)',
            borderColor: 'rgba(11, 37, 69, 1)',
            borderWidth: 1,
            borderRadius: 6
          },
          {
            label: 'Successful Candidates',
            data: [nursSucc, highSucc],
            backgroundColor: 'rgba(212, 175, 55, 0.95)',
            borderColor: 'rgba(212, 175, 55, 1)',
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

  function loadLogs() {
    fetch("/api/dashboard/logs")
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          const tbody = document.getElementById("logsTableBody");
          tbody.innerHTML = "";
          data.logs.forEach(log => {
            const row = document.createElement("tr");
            row.innerHTML = `
              <td><span class="badge bg-secondary-light text-primary-dark">${log.action}</span></td>
              <td>${log.details}</td>
              <td class="text-nowrap">${log.timestamp}</td>
            `;
            tbody.appendChild(row);
          });
        }
      });
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
    dropzone.addEventListener("click", () => galleryFileInput.click());
    
    // Dragover & Dragenter
    ["dragover", "dragenter"].forEach(type => {
      dropzone.addEventListener(type, (e) => {
        e.preventDefault();
        dropzone.classList.add("dragover");
      });
    });

    // Dragleave & Drop
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
    galleryUploadForm.addEventListener("submit", (e) => {
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
      if (file.size > 4 * 1024 * 1024) {
        errorDiv.textContent = "File size exceeds the 4MB maximum limit.";
        errorDiv.classList.remove("d-none");
        return;
      }

      const formData = new FormData();
      formData.append("file", file);
      formData.append("category", category);
      formData.append("caption", caption);

      progressContainer.classList.remove("d-none");
      progressBar.style.width = "40%";

      fetch("/api/gallery/upload", {
        method: "POST",
        body: formData
      })
        .then(res => res.json())
        .then(data => {
          progressBar.style.width = "100%";
          setTimeout(() => {
            progressContainer.classList.add("d-none");
            progressBar.style.width = "0%";
            if (data.success) {
              showToast("Image uploaded successfully.");
              galleryUploadForm.reset();
              selectedFilename.classList.add("d-none");
              loadGalleryImages();
            } else {
              errorDiv.textContent = data.error || "An error occurred during upload.";
              errorDiv.classList.remove("d-none");
            }
          }, 400);
        })
        .catch(() => {
          progressContainer.classList.add("d-none");
          progressBar.style.width = "0%";
          errorDiv.textContent = "Server connection lost.";
          errorDiv.classList.remove("d-none");
        });
    });
  }

  function loadGalleryImages() {
    if (!adminGalleryGrid) return;
    fetch("/api/gallery")
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          adminGalleryGrid.innerHTML = "";
          
          // Update quota
          const max_gallery = 100;
          document.getElementById("galleryQuotaBadge").textContent = `Quota: ${data.images.length} / ${max_gallery} Uploaded`;

          if (data.images.length === 0) {
            adminGalleryGrid.innerHTML = `<div class="col-12 text-center py-4 text-muted">No images found in the gallery database.</div>`;
            return;
          }

          data.images.forEach(img => {
            const card = document.createElement("div");
            card.className = "col";
            card.innerHTML = `
              <div class="admin-gallery-card">
                <img src="${img.imageUrl}" alt="${img.caption}" onerror="this.src='https://placehold.co/400x300/0b2545/d4af37?text=Image'">
                <span class="gallery-card-badge">${img.category}</span>
                <div class="gallery-card-actions">
                  <button class="btn btn-danger btn-sm rounded-circle shadow-sm" onclick="deleteGalleryImage('${img.id}', '${img.caption}')" title="Delete">
                    <i class="fa-solid fa-trash-can"></i>
                  </button>
                </div>
              </div>
              <p class="small text-truncate text-muted mt-2 mb-0 fw-semibold px-1" title="${img.caption}">${img.caption}</p>
            `;
            adminGalleryGrid.appendChild(card);
          });
        }
      });
  }

  // Delete image global access
  window.deleteGalleryImage = (id, caption) => {
    if (confirm(`Are you sure you want to permanently delete "${caption}"?`)) {
      fetch(`/api/gallery/${id}`, { method: "DELETE" })
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            showToast("Gallery photo deleted.");
            loadGalleryImages();
          } else {
            showToast(data.error || "Failed to delete image.", false);
          }
        });
    }
  };

  // ==========================================================================
  // 3. Admissions Registry: Candidates & Document Downloader
  // ==========================================================================
  let activeCandidates = { nursery: [], high: [] };
  let selectedCandidateIds = { nursery: [], high: [] };

  // Class Selection Listener
  const classFilters = document.querySelectorAll(".filter-trigger-select");
  classFilters.forEach(select => {
    select.addEventListener("change", (e) => {
      const school = select.getAttribute("data-school");
      const tableContainer = document.getElementById(`${school}TableContainer`);
      const placeholderText = document.getElementById(`${school}PlaceholderText`);
      
      tableContainer.classList.remove("d-none");
      placeholderText.classList.add("d-none");

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

  function loadCandidates(school) {
    const classVal = document.getElementById(`${school}ClassFilter`).value;
    const genderVal = document.getElementById(`${school}GenderFilter`).value;

    if (!classVal) return; // A class selection is mandatory

    let url = `/api/admissions/${school}/candidates?class=${encodeURIComponent(classVal)}`;
    if (genderVal) {
      url += `&gender=${genderVal}`;
    }

    fetch(url)
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          activeCandidates[school] = data.candidates;
          selectedCandidateIds[school] = [];
          renderCandidatesTable(school);
        }
      });
  }

  function renderCandidatesTable(school) {
    const tbody = document.getElementById(`${school}TableBody`);
    const searchVal = document.getElementById(`${school}SearchInput`).value.toLowerCase().trim();
    const selectAllCheckbox = document.getElementById(`${school}SelectAll`);
    
    tbody.innerHTML = "";
    selectAllCheckbox.checked = false;

    // Filter activeCandidates by search terms
    const candidates = activeCandidates[school].filter(cand => {
      return cand.name.toLowerCase().includes(searchVal) || cand.parentPhone.includes(searchVal);
    });

    if (candidates.length === 0) {
      tbody.innerHTML = `<tr><td colspan="9" class="text-center py-4 text-muted">No candidate registrations found matching criteria.</td></tr>`;
      updateSelectionCounter(school);
      return;
    }

    candidates.forEach((cand, idx) => {
      const isChecked = selectedCandidateIds[school].includes(cand.id) ? "checked" : "";
      const isPassed = cand.passed ? "checked" : "";
      
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>
          <input class="form-check-input row-select-cb" type="checkbox" data-id="${cand.id}" ${isChecked}>
        </td>
        <td>
          <img src="${cand.passportUrl !== '#' ? cand.passportUrl : 'https://placehold.co/40x40/0b2545/d4af37?text=Avatar'}" 
               alt="Passport" class="rounded shadow-sm" style="width: 40px; height: 40px; object-fit: cover;"
               onerror="this.src='https://placehold.co/40x40/0b2545/d4af37?text=ES'">
        </td>
        <td><strong class="text-primary-dark">${cand.name}</strong></td>
        <td>${cand.gender}</td>
        <td>${cand.parentName}</td>
        <td>${cand.parentPhone}</td>
        <td>
          <div class="d-flex gap-2">
            <button class="btn btn-outline-nav-sm py-1 px-2 border small" onclick="downloadFile('${cand.birthCertUrl}', 'Birth Certificate')" title="Birth Certificate">
              <i class="fa-solid fa-cake-candles text-primary"></i>
            </button>
            <button class="btn btn-outline-nav-sm py-1 px-2 border small" onclick="downloadFile('${cand.resultUrl}', 'Academic Result')" title="Academic Result">
              <i class="fa-solid fa-square-poll-vertical text-warning"></i>
            </button>
            <button class="btn btn-outline-nav-sm py-1 px-2 border small" onclick="downloadFile('${cand.testimonialUrl}', 'School Testimonial')" title="School Testimonial">
              <i class="fa-solid fa-award text-success"></i>
            </button>
          </div>
        </td>
        <td class="text-center">
          <input class="form-check-input passed-toggle-cb" type="checkbox" data-id="${cand.id}" ${isPassed}>
        </td>
        <td class="text-end text-nowrap">
          <button class="btn btn-outline-danger btn-sm rounded-circle me-1" onclick="deleteCandidate('${school}', '${cand.id}', '${cand.name}')" title="Delete">
            <i class="fa-solid fa-trash-can"></i>
          </button>
        </td>
      `;

      // Single checkbox selection listener
      row.querySelector(".row-select-cb").addEventListener("change", (e) => {
        const cid = e.target.getAttribute("data-id");
        if (e.target.checked) {
          selectedCandidateIds[school].push(cid);
        } else {
          selectedCandidateIds[school] = selectedCandidateIds[school].filter(id => id !== cid);
        }
        updateSelectionCounter(school);
      });

      // Single Passed Exam state toggle listener
      row.querySelector(".passed-toggle-cb").addEventListener("change", (e) => {
        const cid = e.target.getAttribute("data-id");
        const passedVal = e.target.checked;
        
        fetch(`/api/admissions/${school}/candidates/${cid}/exam`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ passed: passedVal })
        })
          .then(res => res.json())
          .then(data => {
            if (data.success) {
              // Update state locally
              const target = activeCandidates[school].find(c => c.id === cid);
              if (target) target.passed = passedVal;
              showToast(`Updated examination status for ${cand.name}.`);
            } else {
              e.target.checked = !passedVal;
              showToast("Failed to update exam status.", false);
            }
          });
      });

      tbody.appendChild(row);
    });

    updateSelectionCounter(school);
  }

  // Download files placeholder
  window.downloadFile = (url, name) => {
    if (!url || url === "#") {
      alert(`${name} is not uploaded for this candidate.`);
    } else {
      window.open(url, "_blank");
    }
  };

  // Checkbox Select All Toggle
  const selectAllCbs = document.querySelectorAll("[id$='SelectAll']");
  selectAllCbs.forEach(allCb => {
    allCb.addEventListener("change", (e) => {
      const school = allCb.id.startsWith("nursery") ? "nursery" : "high";
      const tableBody = document.getElementById(`${school}TableBody`);
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
    document.getElementById(`${school}SelectedCount`).textContent = `${count} Candidates Selected`;
    
    // Enable/disable Move successful button
    const btnMove = document.getElementById(`${school}BtnMoveSuccessful`);
    btnMove.disabled = count === 0;
  }

  // Move registration candidates to Successful list
  const moveButtons = document.querySelectorAll("[id$='BtnMoveSuccessful']");
  moveButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      const school = btn.id.startsWith("nursery") ? "nursery" : "high";
      const count = selectedCandidateIds[school].length;
      
      if (confirm(`Are you sure you want to move the ${count} selected candidates to the Successful list? This deletes their original registrations records.`)) {
        btn.disabled = true;
        fetch(`/api/admissions/${school}/candidates/move-successful`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids: selectedCandidateIds[school] })
        })
          .then(res => res.json())
          .then(data => {
            if (data.success) {
              showToast(`Moved ${data.count} candidates to successful admissions list.`);
              loadCandidates(school);
            } else {
              showToast(data.error || "Transfers failed.", false);
              btn.disabled = false;
            }
          });
      }
    });
  });

  // Delete candidate
  window.deleteCandidate = (school, id, name) => {
    if (confirm(`Are you sure you want to permanently delete candidate registration for "${name}"? This deletes all their database fields and uploaded documents.`)) {
      fetch(`/api/admissions/${school}/candidates/${id}`, { method: "DELETE" })
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            showToast("Candidate deleted successfully.");
            loadCandidates(school);
          } else {
            showToast(data.error || "Failed to delete candidate.", false);
          }
        });
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
  // Local state helper for manual form document uploads
  const manualFiles = { passportUrl: "", birthCertUrl: "", resultUrl: "", testimonialUrl: "" };

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

  function setupManualDocumentUploadListeners() {
    const inputs = [
      { id: "addCandPassportFile", key: "passportUrl" },
      { id: "addCandBirthFile", key: "birthCertUrl" },
      { id: "addCandResultFile", key: "resultUrl" },
      { id: "addCandTestimonialFile", key: "testimonialUrl" }
    ];

    inputs.forEach(item => {
      const el = document.getElementById(item.id);
      if (el) {
        el.addEventListener("change", async (e) => {
          const file = e.target.files[0];
          if (!file) return;

          const labelEl = el.closest(".col-md-6")?.querySelector(".form-label");
          const originalLabel = labelEl ? labelEl.textContent.split(" (Max")[0].split(" ✔")[0].split(" ✘")[0] : "";
          if (labelEl) labelEl.innerHTML = `${originalLabel} <span class="text-accent small"><i class="fa-solid fa-spinner fa-spin"></i> Processing...</span>`;

          try {
            const base64Data = await fileToBase64(file);
            manualFiles[item.key] = base64Data;
            if (labelEl) labelEl.innerHTML = `${originalLabel} <span class="text-success small"><i class="fa-solid fa-check"></i> Done</span>`;
          } catch (err) {
            console.error("File processing failed:", err);
            if (labelEl) labelEl.innerHTML = `${originalLabel} <span class="text-danger small">✘ Failed</span>`;
          }
        });
      }
    });
  }

  setupManualDocumentUploadListeners();

  window.openAddCandidateModal = (school) => {
    if (!addCandidateModalInstance) return;
    
    // Set hidden school type
    document.getElementById("addCandSchoolType").value = school;
    document.getElementById("addCandidateForm").reset();
    document.getElementById("addCandidateModalError").classList.add("d-none");

    // Reset uploaded file paths & labels
    manualFiles.passportUrl = "";
    manualFiles.birthCertUrl = "";
    manualFiles.resultUrl = "";
    manualFiles.testimonialUrl = "";

    const resetLabels = [
      { id: "addCandPassportFile", defaultText: "Passport Photograph (Max 4MB)" },
      { id: "addCandBirthFile", defaultText: "Birth Certificate (Max 4MB)" },
      { id: "addCandResultFile", defaultText: "Academic Result (Max 4MB)" },
      { id: "addCandTestimonialFile", defaultText: "School Testimonial (Max 4MB)" }
    ];

    resetLabels.forEach(item => {
      const el = document.getElementById(item.id);
      const labelEl = el?.closest(".col-md-6")?.querySelector(".form-label");
      if (labelEl) {
        labelEl.textContent = item.defaultText;
      }
    });
    
    // Customize modal headers and class selectors
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

  const addCandidateForm = document.getElementById("addCandidateForm");
  if (addCandidateForm) {
    addCandidateForm.addEventListener("submit", (e) => {
      e.preventDefault();
      
      const errorDiv = document.getElementById("addCandidateModalError");
      if (errorDiv) {
        errorDiv.classList.add("d-none");
      }

      try {
        const school = document.getElementById("addCandSchoolType").value;
        const name = document.getElementById("addCandName").value.trim();
        const gender = document.getElementById("addCandGender").value;
        const targetClass = document.getElementById("addCandClass").value;
        const parentName = document.getElementById("addCandParentName").value.trim();
        const parentPhone = document.getElementById("addCandPhone").value.trim();

        const payload = {
          name: name,
          gender: gender,
          class: targetClass,
          parentName: parentName,
          parentPhone: parentPhone,
          passportUrl: manualFiles.passportUrl || "#",
          birthCertUrl: manualFiles.birthCertUrl || "#",
          resultUrl: manualFiles.resultUrl || "#",
          testimonialUrl: manualFiles.testimonialUrl || "#"
        };

        const submitBtn = addCandidateForm.querySelector('button[type="submit"]');
        const originalHTML = submitBtn ? submitBtn.innerHTML : "Add Candidate";
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Saving...';
        }

        fetch(`/api/admissions/${school}/candidates`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        })
        .then(res => {
          if (!res.ok) {
            throw new Error(`HTTP error! Status: ${res.status}`);
          }
          return res.json();
        })
        .then(data => {
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalHTML;
          }

          if (data.success) {
            if (addCandidateModalInstance) {
              addCandidateModalInstance.hide();
            }
            
            // Update the Class Filter to targetClass and reload the table
            const classFilterSelect = document.getElementById(`${school}ClassFilter`);
            if (classFilterSelect) {
              classFilterSelect.value = targetClass;
            }
            loadCandidates(school);

            showSuccessScreen();
          } else {
            if (errorDiv) {
              errorDiv.textContent = data.error || "Failed to register candidate.";
              errorDiv.classList.remove("d-none");
            }
          }
        })
        .catch(err => {
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalHTML;
          }
          if (errorDiv) {
            errorDiv.textContent = "Submission failed: " + err.message;
            errorDiv.classList.remove("d-none");
          }
          console.error("Submission error:", err);
        });
      } catch (err) {
        if (errorDiv) {
          errorDiv.textContent = "Form error: " + err.message;
          errorDiv.classList.remove("d-none");
        }
        console.error("Manual registration crash:", err);
      }
    });
  }

  // ==========================================================================
  // 5. Successful Candidates Module (View/Move back/Delete)
  // ==========================================================================
  let selectedSuccIds = { nursery: [], high: [] };

  function loadSuccessfulCandidates() {
    ["nursery", "high"].forEach(school => {
      fetch(`/api/admissions/${school}/successful`)
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            renderSuccessfulTable(school, data.successful);
          }
        });
    });
  }

  function renderSuccessfulTable(school, list) {
    const tbody = document.getElementById(`succ${school.charAt(0).toUpperCase() + school.slice(1)}TableBody`);
    const selectAll = document.getElementById(`succ${school.charAt(0).toUpperCase() + school.slice(1)}SelectAll`);
    
    tbody.innerHTML = "";
    selectAll.checked = false;
    selectedSuccIds[school] = [];

    if (list.length === 0) {
      tbody.innerHTML = `<tr><td colspan="4" class="text-center py-4 text-muted">No successful candidates found.</td></tr>`;
      updateSuccessfulControls(school);
      return;
    }

    list.forEach(succ => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>
          <input class="form-check-input succ-select-cb" type="checkbox" data-id="${succ.id}">
        </td>
        <td><strong class="text-primary-dark">${succ.name}</strong></td>
        <td>${succ.parentPhone}</td>
        <td class="text-end text-nowrap">
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

    // Select All listener
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
    btnReturn.disabled = selectedSuccIds[school].length === 0;
  }

  // Deletes successful candidate
  window.deleteSuccessful = (school, id, name) => {
    if (confirm(`Are you sure you want to permanently delete successful candidate "${name}"? This removes them from the success directories.`)) {
      fetch(`/api/admissions/${school}/successful/${id}`, { method: "DELETE" })
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            showToast("Successful candidate deleted.");
            loadSuccessfulCandidates();
          } else {
            showToast(data.error || "Failed to delete candidate.", false);
          }
        });
    }
  };

  // Return to registration action
  const returnButtons = document.querySelectorAll("[id$='BtnReturnReg']");
  returnButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      const school = btn.id.startsWith("nursery") ? "nursery" : "high";
      const count = selectedSuccIds[school].length;

      if (confirm(`Are you sure you want to return the ${count} selected candidates back to active Registrations?`)) {
        fetch(`/api/admissions/${school}/successful/move-back`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids: selectedSuccIds[school] })
        })
          .then(res => res.json())
          .then(data => {
            if (data.success) {
              showToast(`Returned ${data.count} candidates to active registrations.`);
              loadSuccessfulCandidates();
              // Reload registry view if selected
              const activeClassVal = document.getElementById(`${school}ClassFilter`).value;
              if (activeClassVal) {
                loadCandidates(school);
              }
            } else {
              showToast(data.error || "Operations failed.", false);
            }
          });
      }
    });
  });

  // ==========================================================================
  // 6. Reports & Downloads Handler (PDF, EXCEL, PRINT)
  // ==========================================================================
  window.exportTable = (tableType, format) => {
    alert(`Exporting ${tableType.toUpperCase()} registry table to ${format.toUpperCase()} format... (Backend task queued)`);
  };

  window.printSuccessfulList = () => {
    window.print();
  };

  // ==========================================================================
  // 7. Global Configurations Settings Form
  // ==========================================================================
  const portalSettingsForm = document.getElementById("portalSettingsForm");
  
  function loadSettings() {
    fetch("/api/settings")
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          const s = data.settings;
          document.getElementById("setSchoolName").value = s.schoolName;
          document.getElementById("setSchoolEmail").value = s.email;
          document.getElementById("setSchoolPhone1").value = s.phone1;
          document.getElementById("setSchoolPhone2").value = s.phone2 || "";
          document.getElementById("setSchoolAddress").value = s.address;
          document.getElementById("setAdmissionFee").value = s.admissionFee;
          document.getElementById("setAcademicSession").value = s.academicSession;
          document.getElementById("setMaxGalleryImages").value = s.maxGalleryImages;
          document.getElementById("setFacebook").value = s.facebook || "";
          document.getElementById("setInstagram").value = s.instagram || "";
          document.getElementById("setTwitter").value = s.twitter || "";
          document.getElementById("setLinkedin").value = s.linkedin || "";
          document.getElementById("setYoutube").value = s.youtube || "";
        }
      });
  }

  if (portalSettingsForm) {
    portalSettingsForm.addEventListener("submit", (e) => {
      e.preventDefault();
      
      const payload = {
        schoolName: document.getElementById("setSchoolName").value,
        email: document.getElementById("setSchoolEmail").value,
        phone1: document.getElementById("setSchoolPhone1").value,
        phone2: document.getElementById("setSchoolPhone2").value,
        address: document.getElementById("setSchoolAddress").value,
        admissionFee: document.getElementById("setAdmissionFee").value,
        academicSession: document.getElementById("setAcademicSession").value,
        maxGalleryImages: document.getElementById("setMaxGalleryImages").value,
        facebook: document.getElementById("setFacebook").value,
        instagram: document.getElementById("setInstagram").value,
        twitter: document.getElementById("setTwitter").value,
        linkedin: document.getElementById("setLinkedin").value,
        youtube: document.getElementById("setYoutube").value
      };

      fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      })
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            const alert = document.getElementById("settingsAlert");
            alert.classList.remove("d-none");
            showToast("Global configurations saved.");
            setTimeout(() => alert.classList.add("d-none"), 3000);
          } else {
            showToast(data.error || "Failed to update configurations.", false);
          }
        });
    });
  }

  // Success Screen overlay handler
  const successScreen = document.getElementById("successScreen");
  const btnAnotherChild = document.getElementById("btnAnotherChild");
  const confettiContainer = document.getElementById("confettiContainer");

  const showSuccessScreen = () => {
    if (!successScreen) return;
    successScreen.classList.remove("d-none");
    document.body.style.overflow = "hidden"; // Lock page scrolling
    startConfetti();
  };

  const hideSuccessScreen = () => {
    if (!successScreen) return;
    successScreen.classList.add("d-none");
    document.body.style.overflow = ""; // Unlock scrolling
    if (confettiContainer) confettiContainer.innerHTML = "";
  };

  if (btnAnotherChild) {
    btnAnotherChild.addEventListener("click", hideSuccessScreen);
  }

  const startConfetti = () => {
    if (!confettiContainer) return;
    confettiContainer.innerHTML = "";
    const colors = ["#D4AF37", "#0B2545", "#134074", "#FFFFFF", "#ffd700", "#c5a028"];

    for (let i = 0; i < 80; i++) {
      const piece = document.createElement("div");
      piece.classList.add("confetti-piece");

      const left = Math.random() * 100;
      const width = Math.random() * 8 + 6;
      const height = Math.random() * 10 + 6;
      const delay = Math.random() * 3.5;
      const duration = Math.random() * 3 + 2;
      const colorIndex = Math.floor(Math.random() * colors.length);

      piece.style.left = left + "%";
      piece.style.width = width + "px";
      piece.style.height = height + "px";
      piece.style.backgroundColor = colors[colorIndex];
      piece.style.animationDelay = delay + "s";
      piece.style.animationDuration = duration + "s";

      confettiContainer.appendChild(piece);
    }
  };

  // Trigger default dashboard tab load on start
  loadDashboardData();
  
});
