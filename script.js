/**
 * Nazareth School Website Scripts
 * Includes: Sticky Nav, Mobile Menu Collapse, Anthem Video controls, Event countdowns, Form validations, Scroll Reveal, Back-to-Top
 */

document.addEventListener("DOMContentLoaded", () => {

  /* ==========================================================================
     1. Sticky Navbar Scroll Effect & Active Highlight
     ========================================================================== */
  const navbar = document.getElementById("mainNavbar");
  if (navbar) {
    const handleScroll = () => {
      if (window.scrollY > 50) {
        navbar.classList.add("scrolled");
      } else {
        navbar.classList.remove("scrolled");
      }
    };

    window.addEventListener("scroll", handleScroll);
    handleScroll(); // Trigger on load in case page is refreshed while scrolled down
  }

  // Close mobile navbar on link/item click (improves mobile UX)
  const navLinks = document.querySelectorAll("#mainNavbar .nav-link:not(.dropdown-toggle), #mainNavbar .dropdown-item");
  const navbarCollapse = document.getElementById("navbarContent");
  if (navbarCollapse) {
    const bsCollapse = new bootstrap.Collapse(navbarCollapse, { toggle: false });

    navLinks.forEach(link => {
      link.addEventListener("click", () => {
        // Check if hamburger menu is open
        if (navbarCollapse.classList.contains("show")) {
          bsCollapse.hide();
        }
      });
    });
  }

  /* ==========================================================================
     2. School Anthem Custom Video Player
     ========================================================================== */
  const video = document.getElementById("anthemVideo");
  const videoOverlay = document.getElementById("videoOverlay");
  const playBtn = document.getElementById("playBtn");
  const videoControls = document.getElementById("videoControls");
  const playPauseToggle = document.getElementById("videoPlayPause");
  const progressBar = document.getElementById("videoProgressBar");
  const progressFilled = document.getElementById("videoProgress");
  const fullscreenBtn = document.getElementById("videoFullscreen");

  if (video && videoOverlay && playBtn && videoControls && playPauseToggle && progressBar && progressFilled && fullscreenBtn) {
    // Play video on overlay click
    const playVideo = () => {
      video.play();
      videoOverlay.classList.add("fade-out");
      videoControls.classList.remove("d-none");
    };

    playBtn.addEventListener("click", playVideo);
    videoOverlay.addEventListener("click", playVideo);

    // Play/Pause toggle on click of the video screen itself
    video.addEventListener("click", () => {
      if (video.paused) {
        video.play();
      } else {
        video.pause();
      }
    });

    // Track play/pause state to update control icons
    video.addEventListener("play", () => {
      playPauseToggle.innerHTML = '<i class="fa-solid fa-pause"></i>';
      videoOverlay.classList.add("fade-out");
    });

    video.addEventListener("pause", () => {
      playPauseToggle.innerHTML = '<i class="fa-solid fa-play"></i>';
    });

    playPauseToggle.addEventListener("click", (e) => {
      e.stopPropagation();
      if (video.paused) {
        video.play();
      } else {
        video.pause();
      }
    });

    // Update progress bar
    video.addEventListener("timeupdate", () => {
      if (video.duration) {
        const percentage = (video.currentTime / video.duration) * 100;
        progressFilled.style.width = `${percentage}%`;
      }
    });

    // Scrubbing the video on progress bar click
    progressBar.addEventListener("click", (e) => {
      e.stopPropagation();
      const rect = progressBar.getBoundingClientRect();
      const pos = (e.clientX - rect.left) / rect.width;
      video.currentTime = pos * video.duration;
    });

    // Fullscreen support
    fullscreenBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (video.requestFullscreen) {
        video.requestFullscreen();
      } else if (video.webkitRequestFullscreen) { /* Safari */
        video.webkitRequestFullscreen();
      } else if (video.msRequestFullscreen) { /* IE11 */
        video.msRequestFullscreen();
      }
    });
  }

  /* ==========================================================================
     3. Events Countdown Timer & Floating Wristwatch
     ========================================================================== */
  const eventCards = document.querySelectorAll(".event-card");

  // Month string mapping to zero-indexed month integers
  const monthMap = {
    'JAN': 0, 'FEB': 1, 'MAR': 2, 'APR': 3, 'MAY': 4, 'JUN': 5,
    'JUL': 6, 'AUG': 7, 'SEP': 8, 'OCT': 9, 'NOV': 10, 'DEC': 11
  };

  // Initialize targets based on the actual static dates displayed on the cards
  const events = [];
  eventCards.forEach((card, index) => {
    const titleEl = card.querySelector(".event-title");
    const title = titleEl ? titleEl.textContent.trim() : "Upcoming Event";

    // Extract day and month from the HTML layout to sync countdown with display
    const dayEl = card.querySelector(".day");
    const monthEl = card.querySelector(".month");

    let targetDate;
    if (dayEl && monthEl) {
      const day = parseInt(dayEl.textContent.trim(), 10);
      const monthStr = monthEl.textContent.trim().toUpperCase();
      const month = monthMap[monthStr];

      const now = new Date();
      let year = now.getFullYear();

      // Assume event starts at 9:00 AM on the specified date
      targetDate = new Date(year, month, day, 9, 0, 0);

      // If target date in the current calendar year has already passed, use the next year
      if (targetDate.getTime() < now.getTime()) {
        targetDate.setFullYear(year + 1);
      }
    } else {
      // Fallback to offset data attribute if elements are missing
      const offsetDays = parseFloat(card.getAttribute("data-event-days")) || 0;
      targetDate = new Date();
      targetDate.setTime(targetDate.getTime() + (offsetDays * 24 * 60 * 60 * 1000));
    }

    const countdownEl = card.querySelector(".countdown-text");
    events.push({
      title: title,
      target: targetDate,
      element: countdownEl
    });
  });

  const watchEl = document.getElementById("eventWatch");
  const watchEventNameEl = document.getElementById("watchEventName");
  const watchDaysEl = document.getElementById("watchDays");
  const watchHoursEl = document.getElementById("watchHours");
  const watchMinutesEl = document.getElementById("watchMinutes");
  const watchSecondsEl = document.getElementById("watchSeconds");

  const updateCountdowns = () => {
    const now = new Date().getTime();

    // Update main page event cards countdowns
    events.forEach(eventObj => {
      const distance = eventObj.target.getTime() - now;

      if (distance < 0) {
        eventObj.element.textContent = "Event Started";
        return;
      }

      const days = Math.floor(distance / (1000 * 60 * 60 * 24));
      const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((distance % (1000 * 60)) / 1000);

      const pad = (num) => String(num).padStart(2, "0");

      if (days < 10) {
        eventObj.element.innerHTML = `Event Starts In: <span class="text-accent">${pad(days)}</span> Days <span class="text-accent">${pad(hours)}</span> Hours <span class="text-accent">${pad(minutes)}</span> Minutes <span class="text-accent">${pad(seconds)}</span> Seconds`;
      } else {
        eventObj.element.innerHTML = `Starts In: <span class="text-accent">${days}</span> Days`;
      }
    });

    // Update Floating Wristwatch Countdown
    if (watchEl) {
      // Find the nearest upcoming future event
      const futureEvents = events
        .filter(eventObj => eventObj.target.getTime() > now)
        .sort((a, b) => a.target.getTime() - b.target.getTime());

      if (futureEvents.length === 0) {
        watchEl.style.display = "none";
        return;
      }

      watchEl.style.display = "flex";
      const nearestEvent = futureEvents[0];

      if (watchEventNameEl) {
        watchEventNameEl.textContent = nearestEvent.title;
      }

      const distance = nearestEvent.target.getTime() - now;
      const days = Math.floor(distance / (1000 * 60 * 60 * 24));
      const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((distance % (1000 * 60)) / 1000);

      const pad = (num) => String(num).padStart(2, "0");

      if (watchDaysEl) watchDaysEl.textContent = pad(days);
      if (watchHoursEl) watchHoursEl.textContent = pad(hours);
      if (watchMinutesEl) watchMinutesEl.textContent = pad(minutes);
      if (watchSecondsEl) watchSecondsEl.textContent = pad(seconds);
    }
  };

  // Run countdown updates immediately and then every second
  updateCountdowns();
  setInterval(updateCountdowns, 1000);

  /* ==========================================================================
     4. Newsletter Section Validation & Notifications
     ========================================================================== */
  const newsletterForm = document.getElementById("newsletterForm");
  const newsletterSuccess = document.getElementById("newsletterSuccess");

  if (newsletterForm && newsletterSuccess) {
    newsletterForm.addEventListener("submit", (e) => {
      e.preventDefault();

      const nameInput = document.getElementById("newsletterName");
      const emailInput = document.getElementById("newsletterEmail");

      let isValid = true;

      // Validate Name
      if (nameInput.value.trim() === "") {
        nameInput.classList.add("is-invalid");
        isValid = false;
      } else {
        nameInput.classList.remove("is-invalid");
        nameInput.classList.add("is-valid");
      }

      // Validate Email
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(emailInput.value.trim())) {
        emailInput.classList.add("is-invalid");
        isValid = false;
      } else {
        emailInput.classList.remove("is-invalid");
        emailInput.classList.add("is-valid");
      }

      if (isValid) {
        // Clear form inputs
        nameInput.value = "";
        emailInput.value = "";
        nameInput.classList.remove("is-valid");
        emailInput.classList.remove("is-valid");

        // Hide form & show notification
        newsletterForm.classList.add("d-none");
        newsletterSuccess.classList.remove("d-none");

        // Reset back to show form after 6 seconds
        setTimeout(() => {
          newsletterSuccess.classList.add("d-none");
          newsletterForm.classList.remove("d-none");
        }, 6000);
      }
    });

    // Remove invalid state classes on input change
    const nameInp = document.getElementById("newsletterName");
    if (nameInp) {
      nameInp.addEventListener("input", function () {
        this.classList.remove("is-invalid");
      });
    }
    const emailInp = document.getElementById("newsletterEmail");
    if (emailInp) {
      emailInp.addEventListener("input", function () {
        this.classList.remove("is-invalid");
      });
    }
  }

  /* ==========================================================================
     5. Scroll-to-Top Button
     ========================================================================== */
  const scrollToTopBtn = document.getElementById("scrollToTop");

  if (scrollToTopBtn) {
    window.addEventListener("scroll", () => {
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop;
      if (scrollTop > 400) {
        scrollToTopBtn.style.display = "inline-flex";
      } else {
        scrollToTopBtn.style.display = "none";
      }
    });

    scrollToTopBtn.addEventListener("click", () => {
      window.scrollTo({
        top: 0,
        behavior: "smooth"
      });
    });
  }

  /* ==========================================================================
     6. Scroll Reveal Animations (Intersection Observer)
     ========================================================================== */
  const revealElements = document.querySelectorAll(".scroll-reveal");

  const revealObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add("active");
        observer.unobserve(entry.target); // Reveal animation occurs only once
      }
    });
  }, {
    threshold: 0.15, // trigger when 15% of element is in view
    rootMargin: "0px 0px -50px 0px"
  });

  revealElements.forEach(el => {
    revealObserver.observe(el);
  });

  /* ==========================================================================
     7. Curriculum Page ScrollSpy for Sticky Sidebar Menu
     ========================================================================== */
  const scrollSpyLinks = document.querySelectorAll(".jump-link");
  const scrollSpySections = document.querySelectorAll(".curriculum-section-block");

  if (scrollSpyLinks.length > 0 && scrollSpySections.length > 0) {
    const handleScrollSpy = () => {
      let activeSectionId = "";
      const scrollPos = window.scrollY || document.documentElement.scrollTop;
      // Add navbar height and some buffer offset to activate early
      const offset = 180;

      scrollSpySections.forEach(section => {
        const top = section.offsetTop - offset;
        const bottom = top + section.offsetHeight;
        if (scrollPos >= top && scrollPos < bottom) {
          activeSectionId = section.getAttribute("id");
        }
      });

      scrollSpyLinks.forEach(link => {
        const targetId = link.getAttribute("href").substring(1);

        // Remove all possible active classes
        link.classList.remove("active-preschool", "active-primary", "active-secondary");

        if (targetId === activeSectionId) {
          if (targetId === "preschool") {
            link.classList.add("active-preschool");
          } else if (targetId === "primary") {
            link.classList.add("active-primary");
          } else if (targetId === "secondary") {
            link.classList.add("active-secondary");
          }
        }
      });
    };

    window.addEventListener("scroll", handleScrollSpy);
    handleScrollSpy(); // Trigger immediately to highlight correct active item on reload
  }

  /* ==========================================================================
     8. Contact Page Form Validation & Notifications
     ========================================================================== */
  const contactForm = document.getElementById("contactForm");
  const contactSuccess = document.getElementById("contactSuccess");

  if (contactForm && contactSuccess) {
    contactForm.addEventListener("submit", (e) => {
      e.preventDefault();

      const nameInput = document.getElementById("contactName");
      const emailInput = document.getElementById("contactEmail");
      const phoneInput = document.getElementById("contactPhone");
      const subjectInput = document.getElementById("contactSubject");
      const messageInput = document.getElementById("contactMessage");

      let isValid = true;

      // Helper function to validate field
      const validateField = (input, condition) => {
        if (condition) {
          input.classList.remove("is-invalid");
          input.classList.add("is-valid");
        } else {
          input.classList.remove("is-valid");
          input.classList.add("is-invalid");
          isValid = false;
        }
      };

      // Validate Name
      validateField(nameInput, nameInput.value.trim() !== "");

      // Validate Email
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      validateField(emailInput, emailRegex.test(emailInput.value.trim()));

      // Validate Phone (at least 8 chars check)
      validateField(phoneInput, phoneInput.value.trim().length >= 8);

      // Validate Subject
      validateField(subjectInput, subjectInput.value.trim() !== "");

      // Validate Message (at least 10 chars)
      validateField(messageInput, messageInput.value.trim().length >= 10);

      if (isValid) {
        // Reset inputs
        const inputs = [nameInput, emailInput, phoneInput, subjectInput, messageInput];
        inputs.forEach(input => {
          input.value = "";
          input.classList.remove("is-valid");
        });

        // Hide form, show success
        contactForm.classList.add("d-none");
        contactSuccess.classList.remove("d-none");

        // Scroll to success message
        contactSuccess.scrollIntoView({ behavior: "smooth", block: "center" });

        // Show form again after 7 seconds
        setTimeout(() => {
          contactSuccess.classList.add("d-none");
          contactForm.classList.remove("d-none");
        }, 7000);
      }
    });

    // Remove validation classes on input
    const formControls = contactForm.querySelectorAll(".form-control");
    formControls.forEach(control => {
      control.addEventListener("input", function () {
        this.classList.remove("is-invalid");
      });
    });
  }

  /* ==========================================================================
     9. Reasons Card Mobile Tap Flip Toggle
     ========================================================================== */
  const reasonCards = document.querySelectorAll(".reason-card-inner");
  reasonCards.forEach(card => {
    card.addEventListener("click", function (e) {
      this.classList.toggle("flipped");
    });
  });

  /* ==========================================================================
     10. Milestone Cards Mobile Tap Flip Toggle
     ========================================================================== */
  const milestoneCards = document.querySelectorAll(".milestone-card-inner");
  milestoneCards.forEach(card => {
    card.addEventListener("click", function (e) {
      this.classList.toggle("flipped");
    });
  });

  /* ==========================================================================
     11. Animated Counter Effect for Achievement Cards
     ========================================================================== */
  const counters = document.querySelectorAll(".counter-number");

  const countUp = (counter) => {
    const target = +counter.getAttribute("data-target");
    const duration = 2000; // 2 seconds total animation time
    const frameRate = 1000 / 60; // 60 FPS
    const totalFrames = Math.round(duration / frameRate);
    let frame = 0;

    const countAnimation = () => {
      frame++;
      const progress = frame / totalFrames;
      // Easing out quadratic
      const currentVal = Math.round(target * progress * (2 - progress));

      if (frame < totalFrames) {
        counter.innerText = currentVal;
        requestAnimationFrame(countAnimation);
      } else {
        counter.innerText = target;
      }
    };

    countAnimation();
  };

  const counterObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        countUp(entry.target);
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.5 });

  counters.forEach(counter => {
    counterObserver.observe(counter);
  });

  /* ==========================================================================
     12. Apply Online Page Form Actions (Age Calc, Valids, Steppers, Success overlay)
     ========================================================================== */

  // Firebase Upload State Maps & Utilities
  const uploadedFiles = {};

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

  // Setup file uploads directly in Base64 (Bypassing Firebase Storage rules)
  const setupDocumentUploadListeners = () => {
    const fileInputs = document.querySelectorAll('input[type="file"]');
    fileInputs.forEach(input => {
      input.addEventListener("change", async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const card = input.closest(".card");
        let progressEl = card.querySelector(".upload-progress-text");
        if (!progressEl) {
          progressEl = document.createElement("div");
          progressEl.className = "upload-progress-text text-accent small mt-2 fw-bold";
          card.appendChild(progressEl);
        }

        try {
          progressEl.textContent = "Processing file...";
          progressEl.className = "upload-progress-text text-accent small mt-2 fw-bold";

          // Read and compress the file to Base64
          const base64Data = await fileToBase64(file);

          uploadedFiles[input.id] = base64Data;
          progressEl.textContent = "✔ Document Ready";
          progressEl.className = "upload-progress-text text-success small mt-2 fw-bold";
          input.classList.remove("is-invalid");
          input.classList.add("is-valid");
          card.style.backgroundColor = "#e6f4ea";

          // Recalculate form progress
          const form = input.closest("form");
          updateFormProgress(form, form.id === "nurseryAdmissionForm" ? "nurseryFormProgress" : "highSchoolFormProgress", form.id === "nurseryAdmissionForm" ? "nurseryFormPct" : "highSchoolFormPct");

        } catch (err) {
          console.error("File processing failed:", err);
          progressEl.textContent = "Processing failed. Try another file.";
          progressEl.className = "upload-progress-text text-danger small mt-2 fw-bold";
          input.classList.add("is-invalid");
        }
      });
    });
  };

  // Run initial setup for file listeners
  setupDocumentUploadListeners();

  // Helper: Extract form fields into key-value map
  const getFormData = (form) => {
    const data = {};
    const inputs = form.querySelectorAll("input, select, textarea");
    inputs.forEach(input => {
      if (input.type === "file") return;
      if (input.type === "radio" || input.type === "checkbox") {
        if (input.checked) {
          data[input.name || input.id] = input.value;
        }
        return;
      }
      const key = input.name || input.id;
      if (key) {
        data[key] = input.value;
      }
    });
    return data;
  };

  // Dynamic Age Calculation
  const calculateAge = (dobString) => {
    if (!dobString) return "";
    const dob = new Date(dobString);
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const m = today.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
      age--;
    }
    return age >= 0 ? age : 0;
  };

  const nurseryDob = document.getElementById("nurseryDob");
  const nurseryAge = document.getElementById("nurseryAge");
  if (nurseryDob && nurseryAge) {
    ["change", "input"].forEach(evtType => {
      nurseryDob.addEventListener(evtType, () => {
        nurseryAge.value = calculateAge(nurseryDob.value);
        const form = document.getElementById("nurseryAdmissionForm");
        updateFormProgress(form, "nurseryFormProgress", "nurseryFormPct");
      });
    });
  }

  const highSchoolDob = document.getElementById("highSchoolDob");
  const highSchoolAge = document.getElementById("highSchoolAge");
  if (highSchoolDob && highSchoolAge) {
    ["change", "input"].forEach(evtType => {
      highSchoolDob.addEventListener(evtType, () => {
        highSchoolAge.value = calculateAge(highSchoolDob.value);
        const form = document.getElementById("highSchoolAdmissionForm");
        updateFormProgress(form, "highSchoolFormProgress", "highSchoolFormPct");
      });
    });
  }

  // Conditional Visibility of "Special Aid Required"
  const aidYes = document.getElementById("aidYes");
  const aidNo = document.getElementById("aidNo");
  const specialAidDetail = document.getElementById("nurserySpecialAidDetail");
  const specialAidReq = document.getElementById("nurserySpecialAidReq");

  if (aidYes && aidNo && specialAidDetail) {
    const toggleAidDetail = () => {
      if (aidYes.checked) {
        specialAidDetail.classList.remove("d-none");
        if (specialAidReq) specialAidReq.setAttribute("required", "required");
      } else {
        specialAidDetail.classList.add("d-none");
        if (specialAidReq) {
          specialAidReq.removeAttribute("required");
          specialAidReq.value = "";
          specialAidReq.classList.remove("is-valid", "is-invalid");
        }
      }
      const form = document.getElementById("nurseryAdmissionForm");
      updateFormProgress(form, "nurseryFormProgress", "nurseryFormPct");
    };
    aidYes.addEventListener("change", toggleAidDetail);
    aidNo.addEventListener("change", toggleAidDetail);
  }

  // Steppers & Progress Bars Calculator
  const updateFormProgress = (form, progressBarId, pctTextId) => {
    if (!form) return;
    const requiredFields = form.querySelectorAll("[required]");
    if (requiredFields.length === 0) return;

    // Group radio buttons by name to count them as 1 unique required item
    const uniqueRequiredNames = new Set();
    requiredFields.forEach(field => {
      const name = field.getAttribute("name");
      if (name && (field.type === "radio" || field.type === "checkbox")) {
        uniqueRequiredNames.add(name);
      }
    });

    let totalUniqueRequired = 0;
    requiredFields.forEach(field => {
      const name = field.getAttribute("name");
      if (name && (field.type === "radio" || field.type === "checkbox")) {
        // Handled as group
      } else {
        totalUniqueRequired++;
      }
    });
    totalUniqueRequired += uniqueRequiredNames.size;

    let filledUniqueRequired = 0;
    requiredFields.forEach(field => {
      const name = field.getAttribute("name");
      if (name && (field.type === "radio" || field.type === "checkbox")) {
        // Handled as group
      } else if (field.value.trim() !== "" && !field.classList.contains("is-invalid")) {
        filledUniqueRequired++;
      }
    });

    uniqueRequiredNames.forEach(name => {
      const checked = form.querySelector(`input[name="${name}"]:checked`);
      if (checked) filledUniqueRequired++;
    });

    const pct = Math.round((filledUniqueRequired / totalUniqueRequired) * 100);
    const progressBar = document.getElementById(progressBarId);
    const pctText = document.getElementById(pctTextId);

    if (progressBar) {
      progressBar.style.width = pct + "%";
      progressBar.setAttribute("aria-valuenow", pct);
    }
    if (pctText) {
      pctText.textContent = pct + "% Filled";
    }
  };

  // Section Tracking on Modal Body Scroll
  const setupModalScrollTracking = (modalId, stepLabelId) => {
    const modal = document.getElementById(modalId);
    const stepLabel = document.getElementById(stepLabelId);
    if (!modal || !stepLabel) return;

    const modalBody = modal.querySelector(".modal-body");
    if (!modalBody) return;

    modalBody.addEventListener("scroll", () => {
      const sections = modalBody.querySelectorAll(".form-section-header");
      let activeSectionText = "";
      sections.forEach(sec => {
        const rect = sec.getBoundingClientRect();
        const bodyRect = modalBody.getBoundingClientRect();

        // Trigger if section header header is visible within body scroll
        if (rect.top - bodyRect.top < 150) {
          const badge = sec.querySelector(".badge");
          const title = sec.querySelector("h4, h5");
          if (title) {
            activeSectionText = (badge ? badge.textContent + ": " : "") + title.textContent.trim();
          }
        }
      });
      if (activeSectionText) {
        stepLabel.textContent = activeSectionText;
      }
    });
  };

  setupModalScrollTracking("nurseryModal", "nurseryFormStepLabel");
  setupModalScrollTracking("highSchoolModal", "highSchoolFormStepLabel");

  // Real-time field validation checking
  const validateInput = (input) => {
    let isValid = true;
    if (input.hasAttribute("required")) {
      if (input.type === "radio" || input.type === "checkbox") {
        const name = input.getAttribute("name");
        if (name) {
          const form = input.closest("form");
          const checked = form.querySelector(`input[name="${name}"]:checked`);
          isValid = !!checked;
        } else {
          isValid = input.checked;
        }
      } else {
        isValid = input.value.trim() !== "";
      }
    }

    // Additional formats
    if (isValid && input.value.trim() !== "") {
      if (input.type === "email") {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        isValid = emailRegex.test(input.value.trim());
      } else if (input.type === "tel") {
        isValid = input.value.replace(/\D/g, "").length >= 8;
      }
    }

    if (isValid) {
      input.classList.remove("is-invalid");
      if (input.value.trim() !== "" || input.type === "checkbox" || input.type === "radio") {
        input.classList.add("is-valid");
      } else {
        input.classList.remove("is-valid");
      }
    } else {
      input.classList.remove("is-valid");
      input.classList.add("is-invalid");
    }

    return isValid;
  };

  const setupFormValidation = (formId, progressBarId, pctTextId) => {
    const form = document.getElementById(formId);
    if (!form) return;

    const inputs = form.querySelectorAll(".form-control, .form-select, .form-check-input");
    inputs.forEach(input => {
      const eventType = (input.type === "checkbox" || input.type === "radio" || input.tagName === "SELECT" || input.type === "date" || input.type === "file") ? "change" : "blur";

      input.addEventListener(eventType, () => {
        validateInput(input);
        updateFormProgress(form, progressBarId, pctTextId);
      });

      input.addEventListener("input", () => {
        input.classList.remove("is-invalid");
        updateFormProgress(form, progressBarId, pctTextId);
      });
    });

    const handleAdmissionSubmit = async (form, progressBarId, pctTextId) => {
      const submitBtn = form.querySelector('button[type="submit"]');
      const originalBtnHTML = submitBtn.innerHTML;

      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>Submitting Application...';

      const formData = getFormData(form);
      const formType = form.id === "nurseryAdmissionForm" ? "nursery" : "highschool";

      if (formType === "nursery") {
        formData["passportUrl"] = uploadedFiles["nurseryPassport"] || "";
        formData["birthCertUrl"] = uploadedFiles["nurseryBirthCert"] || "";
        formData["resultFileUrl"] = uploadedFiles["nurseryResultFile"] || "";
        formData["testimonialUrl"] = uploadedFiles["nurseryTestimonial"] || "";
      } else {
        formData["passportUrl"] = uploadedFiles["highSchoolPassport"] || "";
        formData["birthCertUrl"] = uploadedFiles["highSchoolBirthCert"] || "";
        formData["resultFileUrl"] = uploadedFiles["highSchoolResultFile"] || "";
        formData["testimonialUrl"] = uploadedFiles["highSchoolTestimonial"] || "";
      }

      formData["status"] = "pending";
      formData["createdAt"] = new Date().toISOString();

      let candidateName = "";
      let collectionName = "";
      if (formType === "nursery") {
        candidateName = formData["nurseryChildName"] || "Nursery Candidate";
        collectionName = "nursery_primary_registration";
      } else {
        candidateName = formData["highSchoolName"] || formData["highSchoolDeclName"] || "School B Candidate";
        collectionName = "high_school_registration";
      }

      if (window.firebaseReady) {
        try {
          const db = firebase.firestore();
          const editingId = form.getAttribute("data-editing-id");
          if (editingId) {
            await db.collection(collectionName).doc(editingId).update(formData);
            console.log(`Updated application for ${candidateName} in Firestore.`);
            form.removeAttribute("data-editing-id");
          } else {
            await db.collection(collectionName).add(formData);
            console.log(`Saved application for ${candidateName} to Firestore.`);
          }
        } catch (err) {
          console.error("Firestore database write failed:", err);
          alert("Database submission failed: " + err.message);
          submitBtn.disabled = false;
          submitBtn.innerHTML = originalBtnHTML;
          return;
        }
      } else {
        console.log("Offline mode: Simulated registration for", candidateName, formData);
      }

      submitBtn.disabled = false;
      submitBtn.innerHTML = originalBtnHTML;

      const modalEl = form.closest(".modal");
      const modal = bootstrap.Modal.getInstance(modalEl);
      if (modal) {
        modal.hide();
      } else {
        const bsModal = new bootstrap.Modal(modalEl);
        bsModal.hide();
      }

      showSuccessScreen();
    };

    // Form Interceptor
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      let formIsValid = true;

      inputs.forEach(input => {
        const isInputValid = validateInput(input);
        if (!isInputValid) {
          formIsValid = false;
        }
      });

      updateFormProgress(form, progressBarId, pctTextId);

      if (formIsValid) {
        handleAdmissionSubmit(form, progressBarId, pctTextId);
      } else {
        // Scroll to first invalid field
        const firstInvalid = form.querySelector(".is-invalid");
        if (firstInvalid) {
          firstInvalid.scrollIntoView({ behavior: "smooth", block: "center" });
          firstInvalid.focus();
        }
      }
    });
  };

  setupFormValidation("nurseryAdmissionForm", "nurseryFormProgress", "nurseryFormPct");
  setupFormValidation("highSchoolAdmissionForm", "highSchoolFormProgress", "highSchoolFormPct");

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

    // Clear forms completely
    const nurseryForm = document.getElementById("nurseryAdmissionForm");
    const highSchoolForm = document.getElementById("highSchoolAdmissionForm");

    if (nurseryForm) {
      nurseryForm.reset();
      nurseryForm.querySelectorAll(".is-valid, .is-invalid").forEach(el => el.classList.remove("is-valid", "is-invalid"));
      updateFormProgress(nurseryForm, "nurseryFormProgress", "nurseryFormPct");
    }
    if (highSchoolForm) {
      highSchoolForm.reset();
      highSchoolForm.querySelectorAll(".is-valid, .is-invalid").forEach(el => el.classList.remove("is-valid", "is-invalid"));
      updateFormProgress(highSchoolForm, "highSchoolFormProgress", "highSchoolFormPct");
    }
  };

  if (btnAnotherChild) {
    btnAnotherChild.addEventListener("click", hideSuccessScreen);
  }

  // Generate confetti items dynamically
  const startConfetti = () => {
    if (!confettiContainer) return;
    confettiContainer.innerHTML = "";
    const colors = ["#E1A0A4", "#4A4163", "#695E89", "#FFFFFF", "#8577A6", "#D4868B"];

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

  // Run progress bars init state on load
  const initFormStates = () => {
    const nurseryForm = document.getElementById("nurseryAdmissionForm");
    const highSchoolForm = document.getElementById("highSchoolAdmissionForm");
    if (nurseryForm) updateFormProgress(nurseryForm, "nurseryFormProgress", "nurseryFormPct");
    if (highSchoolForm) updateFormProgress(highSchoolForm, "highSchoolFormProgress", "highSchoolFormPct");
  };
  initFormStates();

  // Candidate list real-time filtering search engine
  const searchInputs = document.querySelectorAll(".candidate-search");
  searchInputs.forEach(input => {
    input.addEventListener("input", function () {
      const filter = this.value.toLowerCase().trim();
      const tableId = this.getAttribute("data-target-table");
      const table = document.getElementById(tableId);
      if (!table) return;

      const tbody = table.querySelector("tbody");
      const rows = tbody.querySelectorAll("tr");
      const modal = this.closest(".modal");
      const emptyPlaceholder = modal ? modal.querySelector(".empty-search-placeholder") : null;

      let visibleRowsCount = 0;
      rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        if (text.indexOf(filter) > -1) {
          row.style.display = "";
          visibleRowsCount++;
        } else {
          row.style.display = "none";
        }
      });

      if (emptyPlaceholder) {
        if (visibleRowsCount === 0) {
          emptyPlaceholder.classList.remove("d-none");
          table.classList.add("d-none");
        } else {
          emptyPlaceholder.classList.add("d-none");
          table.classList.remove("d-none");
        }
      }
    });
  });

  // Action buttons: Download PDF alerts
  const setupDownloadPDFAlert = (btnId) => {
    const btn = document.getElementById(btnId);
    if (btn) {
      btn.addEventListener("click", () => {
        alert("Downloading Admission list as PDF... (Feature placeholder)");
      });
    }
  };
  setupDownloadPDFAlert("btnDownloadNurseryPDF");
  setupDownloadPDFAlert("btnDownloadHighPDF");

  // Dynamic 3D tilt hover effect for management cards
  const managementCards = document.querySelectorAll(".management-card-3d");
  managementCards.forEach(card => {
    card.addEventListener("mousemove", (e) => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left; // x coordinate within the element
      const y = e.clientY - rect.top;  // y coordinate within the element

      const width = rect.width;
      const height = rect.height;

      // Calculate rotation based on cursor offset from center (-10 to 10 degrees)
      const rotateX = -10 * ((y - height / 2) / (height / 2));
      const rotateY = 10 * ((x - width / 2) / (width / 2));

      // Apply transforms
      card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-10px) scale(1.03)`;
    });

    card.addEventListener("mouseleave", () => {
      // Reset rotation smoothly
      card.style.transform = "";
    });
  });

  // ==========================================================================
  // Gallery Page Engine Setup
  // ==========================================================================
  const GALLERY_IMAGES = [];

  // Bundled photos shown when Firestore is unavailable or has no gallery images yet
  const STARTER_GALLERY = [
    { id: "starter-01", src: "img/nazareth/cultural-day-01.jpg", title: "Cultural Day", category: "cultural" },
    { id: "starter-02", src: "img/nazareth/cultural-day-02.jpg", title: "Cultural Day", category: "cultural" },
    { id: "starter-03", src: "img/nazareth/cultural-day-03.jpg", title: "Cultural Day", category: "cultural" },
    { id: "starter-04", src: "img/nazareth/cultural-day-04.jpg", title: "Cultural Day", category: "cultural" },
    { id: "starter-05", src: "img/nazareth/cultural-day-05.jpg", title: "Cultural Day", category: "cultural" },
    { id: "starter-07", src: "img/nazareth/cultural-day-07.jpg", title: "Cultural Day", category: "cultural" },
    { id: "starter-08", src: "img/nazareth/cultural-day-08.jpg", title: "Cultural Day", category: "cultural" },
    { id: "starter-09", src: "img/nazareth/cultural-day-09.jpg", title: "Cultural Day", category: "cultural" },
    { id: "starter-10", src: "img/nazareth/cultural-day-10.jpg", title: "Cultural Day", category: "cultural" },
    { id: "starter-11", src: "img/nazareth/cultural-day-11.jpg", title: "Cultural Day", category: "cultural" },
    { id: "starter-12", src: "img/nazareth/cultural-day-12.jpg", title: "Cultural Day", category: "cultural" },
    { id: "starter-13", src: "img/nazareth/cultural-day-13.jpg", title: "Cultural Day", category: "cultural" },
    { id: "starter-14", src: "img/nazareth/cultural-day-14.jpg", title: "Cultural Day", category: "cultural" },
    { id: "starter-15", src: "img/nazareth/cultural-day-15.jpg", title: "Cultural Day", category: "cultural" }
  ];

  // Live Gallery Loader
  const loadLiveGallery = async () => {
    if (!galleryGrid) return;

    // Display loading spinner
    galleryGrid.innerHTML = `
      <div class="col-12 text-center py-5 text-muted">
        <span class="spinner-border spinner-border-lg text-accent mb-3" style="width: 3rem; height: 3rem;" role="status" aria-hidden="true"></span>
        <p class="fs-5 fw-medium">Loading gallery images...</p>
      </div>
    `;

    if (window.firebaseReady) {
      try {
        const db = firebase.firestore();
        const snapshot = await db.collection("gallery").get();

        GALLERY_IMAGES.length = 0; // Clear any existing items
        snapshot.forEach(doc => {
          const data = doc.data();
          GALLERY_IMAGES.push({
            id: doc.id,
            src: data.imageUrl || data.src || "",
            title: data.caption || data.title || "Gallery Photo",
            category: data.category || "school-life"
          });
        });
        console.log(`Loaded ${GALLERY_IMAGES.length} gallery images from Firestore.`);
      } catch (err) {
        console.error("Firestore gallery query failed:", err);
      }
    } else {
      console.log("Firebase is offline or uninitialized. Showing bundled gallery photos.");
      GALLERY_IMAGES.length = 0;
    }

    if (GALLERY_IMAGES.length === 0) {
      GALLERY_IMAGES.push(...STARTER_GALLERY);
    }

    updateGalleryData();
  };

  let activeFilter = "all";
  let searchQuery = "";
  let visibleCount = 25;
  let filteredImagesList = [];

  const galleryGrid = document.getElementById("galleryGrid");
  const galleryCounter = document.getElementById("galleryCounter");
  const btnLoadMore = document.getElementById("btnLoadMore");
  const galleryEndText = document.getElementById("galleryEndText");
  const galleryNoMatchesText = document.getElementById("galleryNoMatchesText");
  const activeCategoryTitle = document.getElementById("activeCategoryTitle");
  const gallerySearchInput = document.getElementById("gallerySearchInput");
  const filterBtnContainer = document.getElementById("filterBtnContainer");

  // Check if grid exists (Confirming we are on gallery page)
  if (galleryGrid) {
    updateCategoryTitleDisplay();
    loadLiveGallery();

    // Filtering categories
    if (filterBtnContainer) {
      filterBtnContainer.addEventListener("click", (e) => {
        if (e.target.classList.contains("filter-btn")) {
          filterBtnContainer.querySelectorAll(".filter-btn").forEach(btn => btn.classList.remove("active"));
          e.target.classList.add("active");
          activeFilter = e.target.getAttribute("data-filter");
          visibleCount = 25; // Reset display limit
          updateCategoryTitleDisplay();
          updateGalleryData();
        }
      });
    }

    // Searching titles
    if (gallerySearchInput) {
      gallerySearchInput.addEventListener("input", (e) => {
        searchQuery = e.target.value.toLowerCase().trim();
        visibleCount = 25; // Reset display limit
        updateGalleryData();
      });
    }

    // Pagination trigger
    if (btnLoadMore) {
      btnLoadMore.addEventListener("click", () => {
        visibleCount += 25;
        renderPhotos();
      });
    }
  }

  function updateCategoryTitleDisplay() {
    if (!activeCategoryTitle) return;
    const titles = {
      all: "All Categories",
      graduation: "Graduation Ceremony",
      cultural: "Cultural Day",
      sports: "Sports Day",
      "school-life": "School Life"
    };
    activeCategoryTitle.textContent = titles[activeFilter] || "All Categories";
  }

  function updateGalleryData() {
    filteredImagesList = GALLERY_IMAGES.filter(img => {
      const matchesCategory = (activeFilter === "all" || img.category === activeFilter);
      const matchesSearch = img.title.toLowerCase().includes(searchQuery);
      return matchesCategory && matchesSearch;
    });
    renderPhotos();
  }

  function renderPhotos() {
    if (!galleryGrid) return;
    galleryGrid.innerHTML = "";

    // Show message if no images found
    if (filteredImagesList.length === 0) {
      galleryNoMatchesText.classList.remove("d-none");
      btnLoadMore.classList.add("d-none");
      galleryEndText.classList.add("d-none");
      galleryCounter.textContent = "Showing 0 of 0 Photos";
      return;
    } else {
      galleryNoMatchesText.classList.add("d-none");
    }

    // Render batch selection
    const visibleList = filteredImagesList.slice(0, visibleCount);
    visibleList.forEach((img, index) => {
      const col = document.createElement("div");
      col.className = "col";
      col.innerHTML = `
        <div class="gallery-item-card" data-index="${index}">
          <img src="${img.src}" alt="${img.title}" loading="lazy"
            onerror="this.src='https://placehold.co/400x300/4a4163/e1a0a4?text=Nazareth+Photo'">
          <div class="gallery-item-overlay">
            <div class="gallery-item-icon">
              <i class="fa-solid fa-magnifying-glass-plus"></i>
            </div>
            <p class="gallery-item-title">${img.title}</p>
            <p class="gallery-item-category">${img.category.replace("-", " ")}</p>
          </div>
        </div>
      `;

      col.querySelector(".gallery-item-card").addEventListener("click", () => {
        openLightbox(index);
      });

      galleryGrid.appendChild(col);
    });

    // Update displays counter
    if (filteredImagesList.length <= 25) {
      galleryCounter.textContent = `${filteredImagesList.length} Photos`;
    } else {
      galleryCounter.textContent = `Showing ${Math.min(visibleCount, filteredImagesList.length)} of ${filteredImagesList.length} Photos`;
    }

    // Render page buttons
    if (visibleCount < filteredImagesList.length) {
      btnLoadMore.classList.remove("d-none");
      galleryEndText.classList.add("d-none");
    } else {
      btnLoadMore.classList.add("d-none");
      if (filteredImagesList.length > 25) {
        galleryEndText.classList.remove("d-none");
      } else {
        galleryEndText.classList.add("d-none");
      }
    }
  }

  // ==========================================================================
  // Lightbox Modal Logic
  // ==========================================================================
  let currentLightboxIndex = -1;
  const customLightbox = document.getElementById("customLightbox");
  const lightboxImg = document.getElementById("lightboxImg");
  const lightboxCaption = document.getElementById("lightboxCaption");
  const lightboxCloseBtn = document.getElementById("lightboxCloseBtn");
  const lightboxPrevBtn = document.getElementById("lightboxPrevBtn");
  const lightboxNextBtn = document.getElementById("lightboxNextBtn");

  function openLightbox(index) {
    if (!customLightbox) return;
    currentLightboxIndex = index;
    updateLightboxContent();
    customLightbox.classList.remove("d-none");
    document.body.style.overflow = "hidden"; // Lock scrolling
  }

  function closeLightbox() {
    if (!customLightbox) return;
    customLightbox.classList.add("d-none");
    document.body.style.overflow = ""; // Restore scroll
  }

  function lightboxNext() {
    if (filteredImagesList.length === 0) return;
    const limit = Math.min(visibleCount, filteredImagesList.length);
    currentLightboxIndex = (currentLightboxIndex + 1) % limit;
    updateLightboxContent();
  }

  function lightboxPrev() {
    if (filteredImagesList.length === 0) return;
    const limit = Math.min(visibleCount, filteredImagesList.length);
    currentLightboxIndex = (currentLightboxIndex - 1 + limit) % limit;
    updateLightboxContent();
  }

  function updateLightboxContent() {
    const visibleList = filteredImagesList.slice(0, visibleCount);
    if (!visibleList[currentLightboxIndex]) return;

    const imgData = visibleList[currentLightboxIndex];
    lightboxImg.src = imgData.src;
    lightboxImg.alt = imgData.title;

    lightboxCaption.innerHTML = `
      <h5>${imgData.title}</h5>
      <p class="text-uppercase small fw-bold text-accent">${imgData.category.replace("-", " ")}</p>
    `;
  }

  if (lightboxCloseBtn) lightboxCloseBtn.addEventListener("click", closeLightbox);
  if (lightboxPrevBtn) lightboxPrevBtn.addEventListener("click", lightboxPrev);
  if (lightboxNextBtn) lightboxNextBtn.addEventListener("click", lightboxNext);

  if (customLightbox) {
    customLightbox.addEventListener("click", (e) => {
      if (e.target === customLightbox || e.target.classList.contains("lightbox-content")) {
        closeLightbox();
      }
    });
  }

  // Keyboard navigation
  document.addEventListener("keydown", (e) => {
    if (customLightbox && !customLightbox.classList.contains("d-none")) {
      if (e.key === "ArrowRight") lightboxNext();
      if (e.key === "ArrowLeft") lightboxPrev();
      if (e.key === "Escape") closeLightbox();
    }
  });

  // Mobile Swipe gestures
  let touchStartX = 0;
  let touchEndX = 0;

  if (customLightbox) {
    customLightbox.addEventListener("touchstart", (e) => {
      touchStartX = e.changedTouches[0].screenX;
    }, { passive: true });

    customLightbox.addEventListener("touchend", (e) => {
      touchEndX = e.changedTouches[0].screenX;
      handleSwipe();
    }, { passive: true });
  }

  function handleSwipe() {
    const threshold = 55;
    if (touchEndX < touchStartX - threshold) {
      lightboxNext(); // swipe left -> load next image
    }
    if (touchEndX > touchStartX + threshold) {
      lightboxPrev(); // swipe right -> load previous image
    }
  }
});
