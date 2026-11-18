# Result Management System: Implementation Plan

**Scope:** Nursery, Primary (Primary 1–6), Junior Secondary (JSS1–3), Senior Secondary (SS1–3)
**Builds on:** the existing Firebase project (`engreg-school`): Hosting, Auth, Firestore and Storage, plus the static admin dashboard (`admin-dashboard.html` / `admin-dashboard.js`).

---

## 1. Goals

1. Teachers enter continuous assessment (CA) and exam scores online, per class and subject.
2. The system computes totals, grades, subject positions, class positions, averages and annual (cumulative) results the same way every time.
3. Form teachers add attendance, behaviour ratings and comments. The Head Teacher or Principal approves.
4. The school publishes results by term. Parents and students view them and download or print the report card.
5. Every score change is logged, and approved results are locked.

**Out of scope for v1:** fees and billing, timetabling, CBT exams, SMS gateway. These can be added later.

---

## 2. Current state and prerequisites (must fix first)

| Finding | Why it matters | Action |
|---|---|---|
| `firestore.rules` defines `isAdmin()` as `request.auth != null` | As soon as teachers, parents or students get logins, **every signed-in user becomes an admin**. They could read registrations and edit results. | Move to role-based **custom claims** (`admin`, `principal`, `teacher`, `parent`, `student`) set by a Cloud Function or admin script. Rewrite the rules around those roles **before** any non-admin account exists. |
| There are two admin implementations: the root `admin-dashboard.js` (client SDK, deployed) and `engreg-admin/` (Flask, excluded from hosting) | Building results into both doubles the work and causes drift. | **Recommendation:** build on the deployed static dashboard plus Cloud Functions. Freeze `engreg-admin/` or retire it. |
| Firebase compat SDK v8-style API | It works, but it is legacy. | Keep compat for consistency with existing pages in v1. New modules can use the modular SDK later. |
| No server-side compute | Positions and report generation must not be computed or written by the browser, because a user could tamper with them. | Enable **Cloud Functions (Python, 2nd gen)**. This requires the **Blaze** (pay-as-you-go) plan. Expected cost at school scale is a few dollars a month or less. |
| No automated tests or emulator setup | Grading logic and security rules are high-stakes. | Add the Firebase Emulator Suite, rules unit tests and pytest for the grading engine. |

---

## 3. Domain model and school rules (configurable)

### 3.1 Academic structure
- **Session**, for example `2026/2027`, contains **3 terms**: First, Second and Third.
- **Section**: `nursery` | `primary` | `jss` | `sss`
- **Class**, for example `JSS2`, contains **arms**, for example `JSS2A` and `JSS2B`. Each arm has one **form teacher**.
- **Subjects:** Primary subjects are usually taught by the class teacher. Secondary subjects have dedicated subject teachers. SS students take **elective combinations** (Science, Arts, Commercial), so a subject sheet lists only the students who offer that subject.

### 3.2 Assessment schemes (per section, admin-editable)

| Section | Default components | Notes |
|---|---|---|
| Nursery | Skill ratings (1–5 or Emerging/Developing/Achieved), optionally a numeric score | Report is mostly descriptive |
| Primary | CA1 20 + CA2 20 + Exam 60 = 100 | |
| JSS / SSS | CA1 10 + CA2 10 + Test 10 + Exam 70 = 100 *(example)* | Weights are confirmed by the school |

The scheme is stored as data, for example `components: [{key, label, max}]`. The system must never hard-code the weights.

### 3.3 Grading scales (admin-editable)
- **Primary / JSS (example):** A 70–100, B 60–69, C 50–59, D 45–49, E 40–44, F 0–39
- **SSS (WAEC-style):** A1 75+, B2 70–74, B3 65–69, C4 60–64, C5 55–59, C6 50–54, D7 45–49, E8 40–44, F9 0–39
- Each band has a grade, a min and max, and a remark such as "Excellent" or "Credit".

### 3.4 Computation rules
- **Subject total** = sum of components. Validate each component against its max.
- **Missing scores:** blank is different from 0. A blank blocks submission unless the score is marked **ABS** (absent) or **EX** (exempt). ABS counts as 0. EX excludes the subject from the average.
- **Subject statistics per class arm:** class average, highest, lowest, and subject position.
- **Overall:** total of all subjects, average = total ÷ number of subjects taken (excluding EX), and position in the arm. An optional position across the whole level (all arms) can be added.
- **Ties:** competition ranking (1, 1, 3), with ordinal formatting (1st, 2nd, 3rd, 11th, 12th, 13th, 21st).
- **Third term / annual:** cumulative average = mean of the term averages, using only terms the student attended. Promotion status is based on rules such as average ≥ 50 **and** a pass in English and Mathematics. The rule set is configurable, and the Principal can override the result with a recorded reason.
- **Display of positions** is a per-section toggle, because many schools hide positions for Nursery and Primary.

### 3.5 Report card content
Report cards include:
- the school header, logo, session and term
- the student's photo, name, admission number, class, age and gender
- a subject table showing components, total, grade, position, class average, highest, lowest and remark
- the overall total, average, position and number in class
- attendance (days school opened, days present)
- affective ratings (punctuality, neatness, honesty, and so on) and psychomotor ratings (handwriting, sports, crafts, and so on)
- the form teacher's comment and the Head Teacher's or Principal's comment
- the date the next term begins, fees notice text (optional) and a signature or stamp image
- a **QR code** that links to an online verification URL

---

## 4. Architecture

```
Browser (Firebase Hosting, static HTML/JS)
 ├─ admin-dashboard.html     (+ Academic Setup, Students, Results, Publish tabs)
 ├─ teacher.html             (score entry, form-teacher review)
 ├─ results.html             (parent/student portal + report card view/print)
 └─ verify.html              (public QR verification: name, class, term, average only)
        │  Firebase Auth (custom claims)      │ Firestore (rules-enforced reads/writes)
        ▼                                     ▼
Cloud Functions (Python)
 ├─ setUserRole / createStaffAccount / createGuardianAccount (callable, admin only)
 ├─ submitScoreSheet / approveScoreSheet / unlockScoreSheet (callable, status machine + audit)
 ├─ computeClassResults(termId, classArmId)   → writes termReports/*  (only writer)
 ├─ publishResults(termId, classArmIds[])
 ├─ computeAnnualResults(sessionId, classArmId) + promote
 ├─ redeemResultPin (optional scratch-card mode, rate-limited)
 └─ exportBroadsheet (XLSX) / generateReportPdf (optional, see §7.4)
```

**Principle:** the browser writes only **raw inputs**: scores, attendance, ratings and comments. **Derived data** (totals, grades, positions, published reports) is written only by Cloud Functions using the Admin SDK. Security rules deny client writes to those collections.

---

## 5. Firestore data model

| Collection | Doc ID | Key fields | Written by |
|---|---|---|---|
| `users` | uid | `role`, `name`, `email`, `staffId`, `linkedStudentIds[]` | Functions |
| `sessions` | `2026-2027` | `name`, `current: bool` | Admin |
| `terms` | `2026-2027_T1` | `sessionId`, `termNo`, `startDate`, `endDate`, `daysOpened`, `nextTermBegins`, `status: open/closed` | Admin |
| `sections` | `primary` | `assessmentSchemeId`, `gradingScaleId`, `showPositions`, `affectiveTraits[]`, `psychomotorSkills[]` | Admin |
| `assessmentSchemes` | auto | `components[]` | Admin |
| `gradingScales` | auto | `bands[]` | Admin |
| `subjects` | `MTH` | `name`, `sections[]`, `category` (core/elective) | Admin |
| `classArms` | `JSS2A` | `level`, `section`, `formTeacherUid`, `capacity` | Admin |
| `classSubjects` | `2026-2027_JSS2A_MTH` | `sessionId`, `classArmId`, `subjectId`, `teacherUid` | Admin |
| `students` | auto | `admissionNo` (unique), names, `dob`, `gender`, `photoUrl`, `guardian{name,phone,email}`, `status` (active/graduated/withdrawn) | Admin |
| `enrollments` | `2026-2027_{studentId}` | `sessionId`, `studentId`, `classArmId`, `subjectIds[]` (SS electives) | Admin |
| `scoreSheets` | `{termId}_{classArmId}_{subjectId}` | `teacherUid`, `status: draft/submitted/approved/locked`, `scores: {studentId: {ca1, ca2, exam, flag}}`, `updatedAt`, `updatedBy` | Teacher (draft only), Functions for status changes |
| `classReviews` | `{termId}_{classArmId}` | `students: {studentId: {daysPresent, affective{}, psychomotor{}, formTeacherComment, principalComment}}`, `status` | Form teacher / Principal |
| `termReports` | `{termId}_{studentId}` | Computed snapshot of everything on the report card, plus `published: bool` and `verifyCode` | **Functions only** |
| `annualReports` | `{sessionId}_{studentId}` | Term averages, cumulative average, promotion status | **Functions only** |
| `commentBank` | auto | `text`, `minAvg`, `maxAvg`, `section` | Admin |
| `resultPins` *(optional)* | pin hash | `serial`, `usesLeft`, `boundStudentId`, `termId` | Functions |
| `audit_logs` | auto | Existing collection, extended with `entity`, `before`, `after` | Functions |

**Why use one document per score sheet:**
- One read loads the whole grid.
- A class of about 60 students is far below the 1 MiB document limit.
- Security rules can check `resource.data.teacherUid == request.auth.uid && resource.data.status == 'draft'` in one place.
- Batch saves are atomic.

**Migration:** add an admin action **"Enrol as student"** on records in `nursery_primary_successful` and `high_school_successful`. It creates `students` and `enrollments` documents from admitted candidates and generates admission numbers. Also provide a **CSV bulk import** for existing students.

---

## 6. Workflow and state machine

```
[Admin] Set up session/term, classes, subjects, teacher assignments, enrolments
   ↓
[Subject teacher] scoreSheet: draft ──submit──▶ submitted
   ↓                                     (HoD/Admin can return ◀── with note)
[Admin/HoD] approve ──▶ approved
   ↓
[Form teacher] classReview: attendance, ratings, comment ──submit──▶
   ↓
[Function] computeClassResults  (re-runnable while unpublished; preview broadsheet)
   ↓
[Principal/Head] principal comments (or comment bank) ──approve──▶
   ↓
[Admin] publishResults(term, arms)  → termReports.published = true, sheets → locked
   ↓
[Parent/Student] view, print, download; QR verify
```

- **Corrections after publishing:** an Admin runs `unlockScoreSheet` with a mandatory reason. The sheet reopens, the report is unpublished, and the change is audited. After the fix, the results are recomputed and republished.
- **Progress tracker:** an admin view shows a grid of class arms × subjects, coloured by sheet status. Admins can send reminders to late teachers.

---

## 7. User interfaces

### 7.1 Admin dashboard (new tabs in `admin-dashboard.html`)
- **Academic Setup:** sessions and terms, classes and arms, subjects, class-subject teacher assignment, assessment schemes, grading scales, traits, and comment bank.
- **Students:** list, search and filter by class; profile; enrol from admissions; CSV import; promote or graduate in bulk; guardian account creation.
- **Staff:** create teacher accounts and assign roles. Uses a callable Function that sets custom claims.
- **Results:** the progress tracker, sheet approval, class broadsheet preview, compute, and publish or unpublish.
- **Analytics:** subject pass rates, class averages across terms, and top students. Reuses the existing Chart.js setup.

### 7.2 Teacher portal (`teacher.html`)
- **My Subjects:** a list of assigned class-subject sheets with their status.
- **Score entry grid:** spreadsheet-like editing. Enter or Tab moves between cells, and arrow keys navigate.
  - Each value is validated against the component max. Over-max cells turn red and block saving.
  - The total and grade appear live, as a preview only.
  - Drafts autosave with debouncing. An "unsaved changes" guard prevents data loss.
  - Teachers can download the sheet as CSV, fill it offline, and upload it again.
- **Form teacher view:** the class broadsheet (read-only), plus attendance, ratings and comment entry. Comments can be picked from the comment bank based on the student's average.
- **Mobile:** the grid must work on a phone in landscape. Many teachers will enter scores from phones.

### 7.3 Parent / Student portal (`results.html`)
- **Login:** parents use email or phone (Firebase Auth) and see all linked children. Students use their admission number and a password; the admission number maps to a synthetic email `adm-<no>@students.<domain>`.
- **Optional scratch-card PIN mode:** a common Nigerian practice that also collects result fees. The user enters the admission number and a PIN, and a Function checks it with a usage limit.
- **Views:** term selector → report card view → **Print / Download PDF**, plus an annual summary for the third term.
- Only `published == true` reports for linked students are readable. Rules enforce this.

### 7.4 Report card rendering
- **v1 (recommended):** a dedicated print stylesheet (`@media print`, A4, page-break control) on `results.html`. Users print or save as PDF from the browser. This costs nothing, and the layout is easy to iterate on.
- **v2 (optional):** a server-side PDF Function using WeasyPrint, which renders the same HTML template. Use it for bulk "download class report cards as ZIP" for the admin office and for emailing PDFs.
- **Broadsheet:** an XLSX export (openpyxl in a Function, or SheetJS in the browser) for staff meetings.

---

## 8. Security and compliance

- **Custom claims:** `role`, plus `classArmIds` for form teachers if needed. Rules check `request.auth.token.role`.
- **Rules sketch:**
  ```
  function role() { return request.auth.token.role; }
  function isAdmin() { return request.auth != null && role() in ['admin','principal']; }

  match /scoreSheets/{id} {
    allow read: if isAdmin() || resource.data.teacherUid == request.auth.uid;
    allow update: if resource.data.teacherUid == request.auth.uid
                  && resource.data.status == 'draft'
                  && request.resource.data.diff(resource.data).affectedKeys()
                       .hasOnly(['scores','updatedAt','updatedBy']);
  }
  match /termReports/{id} {
    allow read: if isAdmin()
      || (resource.data.published == true
          && resource.data.studentId in get(/databases/$(database)/documents/users/$(request.auth.uid)).data.linkedStudentIds);
    allow write: if false; // Functions only
  }
  ```
- **Other controls:**
  - Turn on **App Check** to stop scripted abuse of the portal and PIN endpoints.
  - Rate-limit PIN and login attempts in Functions.
  - Audit every status change and every post-approval edit, recording the before and after values.
- **Data protection:** the data covers minors, so the system must follow the Nigeria Data Protection Act 2023. Collect the minimum data needed, restrict access by role, give a retention policy for withdrawn students, and add a privacy notice on the portal.
- **Backups:** schedule Firestore exports to a Cloud Storage bucket, daily during result periods.

---

## 9. Delivery phases

Estimates assume one full-stack developer. Each phase ends with a demo to school administration.

| Phase | Deliverables | Est. |
|---|---|---|
| **0. Foundations** | Choose a canonical admin (static + Functions). Upgrade to Blaze, set up Functions (Python), the emulator suite and CI. **Rewrite security rules with custom claims** and migrate existing admin accounts. Add a rules test harness. | 1 wk |
| **1. Academic setup and students** | Sessions/terms, sections, classes/arms, subjects, assessment schemes, grading scales. Student CRUD, CSV import, "enrol from admissions", enrolments, staff accounts and roles. | 2 wk |
| **2. Score entry** | Teacher portal, score grid with validation and autosave, CSV round-trip, submit/return/approve flow, progress tracker, audit. | 2 wk |
| **3. Computation and review** | Grading engine as a pure Python module with pytest coverage. `computeClassResults`, broadsheet preview, form-teacher review (attendance, ratings, comments), comment bank, principal approval. | 1.5 wk |
| **4. Report cards and publishing** | `termReports` snapshot, print-ready report card template (one each for Nursery, Primary and Secondary), QR verify page, publish/unpublish/unlock flow, broadsheet XLSX. | 1.5 wk |
| **5. Parent/student portal** | Guardian and student logins, child switcher, results view, print/PDF, optional PIN mode, App Check. | 1.5 wk |
| **6. Annual results and analytics** | Third-term cumulative results, promotion rules and overrides, bulk promotion to the next session, analytics charts, optional bulk PDF ZIP. | 1.5 wk |
| **7. Pilot and rollout** | Pilot with 1 primary arm and 1 JSS arm during mid-term tests. Fix issues, run teacher training (short video plus a one-page guide), then go live school-wide for end-of-term exams. | 2 wk (overlaps) |

**Total:** about 11–13 weeks to full rollout. A **minimum viable release** covers phases 0–4, with results printed by the school office. That takes about 8 weeks, and the parent portal can follow.

---

## 10. Testing strategy

- **Grading engine (pytest):**
  - component validation, grade boundaries (39/40, 49/50, 74/75)
  - ABS and EX handling, and tie ranking (1, 1, 3)
  - ordinals (11th, 12th, 13th, 21st, 22nd)
  - averages with exempt subjects, cumulative averages with a missed term
  - promotion rules
- **Security rules (emulator plus `@firebase/rules-unit-testing`):**
  - A teacher cannot edit another teacher's sheet, cannot edit a submitted sheet, and cannot write `termReports`.
  - A parent cannot read an unpublished report or another family's child.
  - A student cannot read registrations.
- **End-to-end (Playwright against the emulator):**
  - admin setup → teacher entry → approve → compute → publish → parent views and prints
- **Data check before go-live:** recompute one past term's paper results in the system and compare them line by line with the manual broadsheet.

---

## 11. Decisions needed from the school

1. Exact **assessment weights** per section, and whether the second CA or a mid-term test is included.
2. **Grading scales** and remarks for Primary/JSS vs SSS.
3. Whether to **show positions** per section, and whether they are per arm or across the whole level.
4. **Promotion criteria** and which subjects are mandatory passes.
5. Parent access model: **free login** or **scratch-card PIN** (a revenue decision).
6. Who approves results: HoD, Vice-Principal, Principal or Head Teacher, separately for each section.
7. Report card design: logo, signature or stamp images, and which fields appear (for example a fees notice).
8. Approval to move the Firebase project to the **Blaze plan**.
9. Confirmation that the Flask `engreg-admin/` app can be retired in favour of the deployed static admin.
