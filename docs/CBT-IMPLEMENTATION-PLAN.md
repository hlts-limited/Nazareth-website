# HLTS Limited: CBT and Result Management System
## Implementation Plan (online and offline)

| | |
|---|---|
| **Status** | Draft v0.1 for review |
| **Date** | 31 October 2026 |
| **Scope** | Computer-Based Testing (CBT) and termly result management for schools served by HLTS Limited, starting with Engreg Schools (this repository) |
| **Runs** | Online (cloud) and offline (on a school LAN or a single device), with reliable sync between them |

---

## 1. Goals

1. **Run CBT exams with or without internet.** Typical cases are a computer lab with an unreliable connection, power cuts in the middle of an exam, and day schools with no connection at all.
2. **Manage results end to end.** That covers CA and exam score entry, computing totals, grades and positions, approval, report cards, broadsheets, and publishing results to parents and students.
3. **Never lose an answer or a score.** Every response and mark is saved on the device first and synced to the cloud later, and every change is logged.
4. **Reuse what already exists.** That means Firebase project `engreg-school` (Auth, Firestore, Storage, Hosting), the admin dashboard, and the audit log.
5. **Be ready for more schools.** Every record carries a `schoolId` from day one, so HLTS can onboard more schools without a rewrite.

### Out of scope for v1
- Remote proctoring through webcam or AI.
- Fee payment and full school ERP features. Result-checker PINs are in scope; payment for them is not.
- Native mobile apps. The installable PWA covers phones and tablets.

---

## 2. Current state (what this builds on)

| Area | Today | Gap for CBT and results |
|---|---|---|
| Hosting | Static HTML/JS site on Firebase Hosting | Needs app-style screens for students, teachers and exam officers |
| Admin | `admin-dashboard.html/js` (Firebase compat SDK v10.8) plus a Flask portal in `engreg-admin/` | Two admin stacks. Pick one and extend it (see §4) |
| Auth | Email and password admin login | `firestore.rules` `isAdmin()` lets **any** signed-in user in. Roles must come from custom claims before students get accounts |
| Data | Registrations, successful-candidate lists, gallery, settings, audit logs | No students, classes, subjects, questions, exams or scores |
| Storage | `registrations/**` accepts public writes with no size or type limit | Must be tightened before more upload surfaces are added |

> **Must happen first:** once students and teachers can sign in, the current rule (`request.auth != null`) would give them admin access. Phase 0 replaces it with role checks.

---

## 3. Users and roles

| Role | Main tasks |
|---|---|
| **HLTS super admin** | Onboard schools, manage licences, view platform health |
| **School admin / principal** | Set up sessions, terms, classes and grading; approve and publish results |
| **Exam officer** | Build exams from the question bank, schedule them, run the exam hub, monitor live sessions |
| **Teacher / subject teacher** | Write questions, enter CA scores, mark theory answers, write remarks |
| **Form (class) teacher** | Check class broadsheet, add affective/psychomotor ratings and comments |
| **Student** | Sit exams and view published results |
| **Parent / guardian** | View published results and report cards, by login or result-checker PIN |

Roles live in **Firebase Auth custom claims** (`{ role, schoolId, classIds? }`), set only by a Cloud Function that admins call. Security rules read the claims. Nothing in the client is trusted.

---

## 4. Architecture

### 4.1 Overview

```
                        ┌───────────────────────── CLOUD (online) ─────────────────────────┐
                        │  Firebase Auth · Firestore · Storage · Hosting · Cloud Functions │
                        │  (scoring, result computation, PDF generation, sync endpoint)    │
                        └──────────────▲───────────────────────────▲───────────────────────┘
                                       │ HTTPS (when available)    │ HTTPS
              ┌────────────────────────┴───────┐          ┌────────┴──────────────────┐
              │  EXAM HUB (offline LAN server) │          │  Online clients           │
              │  mini PC / laptop on UPS       │          │  (home, school with net)  │
              │  Node.js + SQLite, serves PWA  │          │  PWA in browser           │
              └──────▲─────────▲─────────▲─────┘          └───────────────────────────┘
                     │ Wi-Fi / Ethernet LAN (no internet needed)
               ┌─────┴──┐ ┌────┴───┐ ┌───┴────┐
               │ Lab PC │ │ Lab PC │ │ Tablet │   Exam client PWA (IndexedDB autosave)
               └────────┘ └────────┘ └────────┘

      USB "sync bundle" export/import ─── fallback when the hub never gets internet
```

### 4.2 Three ways to run

| Mode | When | How it works |
|---|---|---|
| **A. Online** | School or home has a dependable connection | PWA talks straight to Firestore and Cloud Functions. Responses autosave to IndexedDB and then to Firestore |
| **B. LAN hub (main offline mode)** | Computer lab without dependable internet | Exam officer downloads encrypted exam packages to the hub before exam day. Lab PCs open `http://cbt.local` (or the hub's IP). The hub marks objective questions locally and pushes results to the cloud whenever it can |
| **C. Standalone device** | One laptop, small classes, makeup exams | PWA installed in advance with the exam package cached. The key is released at start time by a proctor PIN. Results upload later or go out by USB bundle |

**Result management offline:** teachers' score-entry screens use **Firestore offline persistence** (IndexedDB). They can enter CA and exam scores with no connection, and the writes sync on their own when the device reconnects. The custom sync protocol in §7 is only needed for CBT, where many devices share one LAN and none of them has a cloud session.

### 4.3 Technology choices (recommended)

| Layer | Choice | Why |
|---|---|---|
| Shared domain logic | **TypeScript package `@hlts/core`** for scoring, grading scales, positions, result computation and sync types | One implementation runs in the browser, Cloud Functions and the hub, so offline and online results always match |
| Front end | **PWA in TypeScript with Vite**; Preact or React; Workbox service worker; Dexie for IndexedDB; KaTeX for maths | Installable, works offline, small bundle for low-end lab PCs |
| Cloud | Firebase Auth, Firestore, Storage, **Cloud Functions (Node 20, TS)**, Hosting, App Check | Already in use, and the free and Blaze tiers suit school-sized loads |
| Hub server | **Node.js (Fastify) + SQLite (better-sqlite3)**, packaged as one Windows/Linux installer (pkg or Electron tray app) | Runs on cheap hardware. SQLite is one file and easy to back up. Same TS core as the cloud |
| Reports | Server-side PDF (pdf-lib or Puppeteer in Functions) and client-side printing | Report cards and broadsheets |
| Admin | Extend **`admin-dashboard.html/js`** with new modules at first, then move them into the PWA. Retire the Flask `engreg-admin/` portal or limit it to batch jobs | Avoids running two admin UIs |

> **Repository decision:** keep the public website in this repo and put the CBT and results product in a **new monorepo** (`hlts-limited/hlts-cbt`) with `packages/core`, `apps/web` (PWA), `apps/hub` and `functions/`. Engreg's site then links to it, for example at `portal.engreg…`. Building everything inside this static site is possible but harder to reuse for other schools.

---

## 5. Functional modules

### 5.1 Academic setup
- Schools, sessions (e.g. 2026/2027) and terms, with term start and end dates and "next term begins".
- Classes and arms (Nursery 1 to Primary 6, JSS1 to SS3, arms A, B and so on), subjects, and subject-to-class mapping. SS electives are assigned per student.
- Student enrolment per session and class. Import from the existing `*_successful` admission lists and CSV.
- Staff assignments (teacher, subject, class arm) and form teachers.

### 5.2 Grading configuration (per school, per level)
- Score components with maximums, e.g. `CA1 10 · CA2 10 · Project 10 · Test 10 · Exam 60 = 100`.
- Grade scales, e.g. primary A–F and senior secondary A1–F9 (WAEC style), with remarks such as "Excellent" or "Credit".
- Rules for subject position, class position, ties (shared position: 1st, 1st, 3rd), and cumulative or annual averages (average of terms or third term only).
- Affective and psychomotor domains (punctuality, neatness and so on, rated 1–5), attendance, and remark templates.

### 5.3 Question bank
- Item types: single-choice MCQ, multi-select, true/false, fill-in-the-blank (with accepted variants), numeric (with tolerance), and essay/theory (marked by hand). Images, audio for languages, LaTeX maths, and shared comprehension passages are supported.
- Metadata: subject, class level, topic, difficulty, tags, author, and status (`draft → reviewed → approved`).
- Import from **Excel/CSV templates** and **Aiken/GIFT** text. Word (.docx) import comes in phase 2.
- Version history. An exam keeps the item versions it was published with.
- Item analysis after each exam: difficulty index, discrimination, and distractor counts.

### 5.4 Exam setup and scheduling
- Fixed questions or **blueprint** selection (e.g. 10 easy, 20 medium and 10 hard from topics X and Y).
- Question and option order shuffled with a per-attempt seed, so neighbouring screens differ.
- Duration, start and end window, late-entry cutoff, attempts allowed, pass mark, section timing, calculator on or off, review allowed or not, and show score immediately or after release.
- Each exam is linked to a **result component** (e.g. "First Term Exam, 60%"), so CBT scores flow straight into results after scaling.
- Candidate lists come from the class arm, with per-student extra time for accessibility needs.

### 5.5 Exam delivery client
- Login: student ID and exam PIN, or a QR card. Device check and instructions screen.
- Question navigator grid (answered, flagged, unanswered), next and previous, flag for review, font size control, and light and dark themes.
- **Autosave on every change** to IndexedDB at once, then to the hub or cloud within about 2 seconds, retrying with backoff.
- **Timer from the server's clock** (hub or cloud). The local clock is only a display fallback, and drift is corrected on each sync.
- **Crash and power-loss recovery:** on reload or on another PC, the attempt resumes with answers and remaining time intact. The proctor can grant extra time.
- Integrity measures (deterrents, not guarantees): fullscreen request, logging of tab and blur events, copy and paste blocked, right-click disabled, one active session per candidate, IP/LAN restriction on the hub, and a proctor console with live status, warnings and force-submit.
- Auto-submit when time runs out. Submission receipt showing a code built from a hash of the answers.

### 5.6 Marking
- Objective items are marked automatically by `@hlts/core`, on the hub when offline and in Functions when online.
- Theory items go into a **marking queue** per teacher, with optional rubric, second marking, and moderation by the head of department.
- Re-scoring: if an answer key is corrected, all affected attempts are re-marked, with an audit entry.

### 5.7 Result management
- **Score entry grid** per class arm and subject, built like a spreadsheet: keyboard entry, paste from Excel, CSV import, checks against component maximums, and works offline.
- CBT scores fill in their component automatically. Teachers can't edit them, but an admin can override with a reason.
- **Computation (Cloud Function, using the same core):** totals, grades, subject positions, class averages, highest and lowest per subject, overall average, class position, and cumulative averages.
- **Approval workflow:** `draft → submitted (subject teacher) → reviewed (form teacher) → approved (principal) → published`. Once approved, scores are locked. Unlocking needs an admin and a reason.
- **Outputs:** report card PDF (school branding, photo, domains, attendance, remarks, next-term date), class broadsheet, subject analysis, and transcript over several terms.
- **Publishing:** parents and students see results only after `published`. Options are parent login, or a **result-checker PIN** (single-use or limited-use, tied to one student and term), checked by a Cloud Function and rate-limited.
- Optional fee-clearance block before release, set by a manual flag in v1.

### 5.8 Analytics
- Exam dashboards: score distribution, item analysis, and time spent per question.
- Result dashboards: performance by class, subject, teacher and term, plus at-risk students (falling averages).

---

## 6. Data model (Firestore, cloud)

Every document carries `schoolId`. Paths below sit under `schools/{schoolId}/`.

| Collection | Key fields |
|---|---|
| `sessions/{sessionId}/terms/{termId}` | name, start, end, nextTermBegins, status |
| `classes/{classId}` | level, arm, formTeacherId |
| `subjects/{subjectId}` | name, code, levels[] |
| `students/{studentId}` | admissionNo, names, dob, gender, photoPath, guardianIds[], currentClassId |
| `enrolments/{sessionId_studentId}` | classId, subjectIds[] |
| `staff/{uid}` | role, assignments[{classId, subjectId}] |
| `gradingSchemes/{schemeId}` | components[], scale[], positionRules |
| `questions/{qid}` (+ `versions/{v}`) | type, stem, options[], answerKey*, marks, topic, difficulty, status |
| `exams/{examId}` | title, subjectId, classIds[], config{duration, window, shuffle…}, itemRefs[{qid, v}], resultComponent, status |
| `exams/{examId}/attempts/{attemptId}` | studentId, seed, startedAt, deadline, status, score, deviceId, source(`online|hub:<id>|device:<id>`) |
| `exams/{examId}/attempts/{attemptId}/events/{eventId}` | type(answer/flag/blur/submit), qid, value, clientTs, seq, hmac |
| `scores/{termId_classId_subjectId}` | rows{studentId: {components{}, total, grade, pos}}, status, version, lockedBy |
| `results/{termId_studentId}` | computed summary, positions, remarks, domains, attendance, pdfPath, published |
| `resultPins/{pinHash}` | studentId, termId, usesLeft, expiresAt |
| `hubs/{hubId}` | name, publicKey, lastSyncAt, softwareVersion |
| `audit_logs/{id}` | actor, action, target, before, after, ts (existing collection, extended) |

\* Answer keys live in a **separate locked subcollection** (`questions/{qid}/keys/current`) that only Functions and the hub can read, never students.

The hub's SQLite schema mirrors the subset it needs (exams, items, candidates, attempts, events, sync_outbox, sync_inbox).

---

## 7. Offline sync design (CBT)

### 7.1 Exam packages (cloud → hub/device)
1. The exam officer publishes an exam, and a Function builds a **package**: exam config, item versions, media, candidate list, and answer keys (for hub marking).
2. The package is encrypted with **AES-256-GCM** using a per-exam content key, and the manifest is **signed** with the platform key so the hub can check it is genuine.
3. The content key is wrapped with the hub's public key (registered when the hub is set up). For standalone devices it is released by proctor PIN at start time.
4. Delivery is a download from the cloud, or a **USB `.hltspkg` file** when the hub has no connection at all.
5. The hub refuses to decrypt or show questions before the exam's start window, which limits leaks.

### 7.2 Responses (device → hub → cloud)
- Each answer change is an **append-only event**: `{eventId: UUIDv7, attemptId, deviceId, seq, qid, value, clientTs}`.
- The device writes it to IndexedDB, then posts it to the hub or cloud. The server **upserts by `eventId`**, so retries are safe and duplicates do no harm.
- The hub writes events into SQLite (WAL mode, `synchronous=FULL`) before acknowledging, so a power cut doesn't lose them.
- The hub's **outbox** pushes batches to a Cloud Function `syncHubBatch` whenever internet is available. Each batch is HMAC-signed with the hub's key and checked against the hub's registered identity.
- No internet for days: the exam officer **exports a sync bundle** (signed and encrypted) to USB and uploads it from any connected computer in the admin dashboard.

### 7.3 Conflict rules
| Data | Rule |
|---|---|
| Answer events | Combine all events and order them by `(attemptId, seq)`. The latest event per question before the submit event wins |
| Attempt status | Moves one way only: `not_started → in_progress → submitted → marked`. Never goes back |
| Same student active on two devices | Hub enforces one active session. If both appear after sync, flag for exam officer review instead of merging silently |
| Scores and results (Firestore offline) | Each sheet has a `version`, and writes use transactions. If the server version is newer, the UI shows a conflict for that cell and the teacher chooses. Locked sheets reject offline writes when they sync |
| Answer key corrections | Cloud is the source of truth. Hubs pull new key versions and re-mark |

### 7.4 Time integrity offline
- The hub is the time authority on the LAN. It records any clock jump and is set from NTP whenever online.
- The deadline is stored as `startedAt + duration + extraTime` in **hub time**. Clients only display a countdown.

---

## 8. Security, privacy and compliance

- **Role-based Firestore and Storage rules** using custom claims and `schoolId` matching, with unit tests in the Firebase emulator. This replaces today's `request.auth != null`.
- **App Check** on web clients, and rate limits on the result-checker and login Functions.
- Answer keys and unpublished results are **never** readable by clients. Marking and computation run in Functions or on the hub.
- Exam packages are encrypted at rest and keys are released only at start time. Hub admin access is protected by password and device binding.
- Every privileged action (unlock scores, override, re-mark, publish) is written to `audit_logs` with before and after values.
- Storage hygiene: size and content-type limits on uploads, and fixing the open `registrations/**` write rule.
- **Nigeria Data Protection Act 2023 (NDPA):** minimal data collection, guardian consent for minors, a retention policy, data subject access requests, and a privacy notice on the portal.
- Backups: Firestore scheduled exports (daily), nightly SQLite snapshots on the hub plus copy to USB, and a documented restore procedure tested every term.
- Secrets: service account JSON stays out of git (already in `.gitignore`). Use Functions secrets or environment config, and rotate any key that has ever been shared.

---

## 9. Non-functional targets

| Metric | Target |
|---|---|
| Concurrent candidates per hub | 300 on a mid-range mini PC (i5, 8 GB RAM, SSD) on gigabit LAN |
| Concurrent online candidates | 2,000 per school without degradation |
| Answer saved locally | under 50 ms. Acknowledged by hub under 500 ms (p95) |
| Data loss on power cut | 0 acknowledged events. Client keeps unacknowledged events and resends |
| Client hardware | Works on Chrome or Edge from the last 2 years, 4 GB RAM PCs, and 1366×768 screens |
| Result computation | under 10 s for a 60-student class arm. Under 2 min for a whole school term |
| Report card PDF | under 3 s each. Batch of one class arm under 1 min |
| Availability | Hub needs no internet during an exam. Cloud uses Firebase's SLA |

---

## 10. Delivery phases

Assumes a team of 2–3 developers, 1 QA/support person, and a named school contact (exam officer). Durations are estimates.

### Phase 0: Foundations (weeks 1–2)
- Create the monorepo, CI (lint, test, emulator rule tests), and staging and production Firebase projects.
- Custom claims and role management Function. Rewrite Firestore and Storage rules.
- `@hlts/core` skeleton: grading scale and position algorithms with full unit tests.
- Academic setup screens: sessions, terms, classes, subjects, staff, and student import.
- **Exit:** roles enforced (proven by rule tests), and Engreg's classes and students imported in staging.

### Phase 1: Results management (weeks 3–7)
Results ship first because they are needed every term, even without CBT.
- Grading scheme configuration and score entry grid (offline-capable through Firestore persistence), with CSV import and export.
- Computation Function, approval workflow, locking, and audit.
- Report card PDF template (Engreg branding), broadsheet, and printing.
- Parent and student portal, result-checker PINs, and publishing.
- **Exit:** a full past term re-entered and checked against the school's existing manual broadsheet, with identical totals and positions.

### Phase 2: Online CBT (weeks 8–12)
- Question bank (all objective types, plus theory with manual marking), Excel and Aiken import.
- Exam builder, scheduling, shuffling, and candidate lists.
- Exam client PWA with autosave, resume, timer, and integrity events. Proctor console.
- Auto-marking, theory marking queue, and CBT score flowing into results.
- **Exit:** a mock test for one class arm runs online end to end.

### Phase 3: Offline hub and sync (weeks 13–18)
- Hub server (Fastify + SQLite), installer, first-run pairing with the cloud (key exchange), and LAN discovery (`cbt.local` through mDNS, plus a fallback of IP on the screen and a QR code).
- Encrypted exam packages, outbox and inbox sync, USB bundle import and export.
- Standalone device mode (Mode C).
- Failure testing: pull network cables, cut power to hub and clients during an exam, run clocks fast or slow, sync the same bundle twice.
- **Exit:** a 100-candidate lab exam with no internet, results synced and matching a re-mark in the cloud.

### Phase 4: Pilot, hardening and rollout (weeks 19–22)
- Pilot: one real mid-term test or mock exam at Engreg with the full process (package to hub, exam, sync, results, report cards).
- Load test (300 simulated candidates on the hub, 2,000 online), security review, and accessibility pass.
- Training materials: exam officer runbook, teacher quick-start, parent guide. Support rota during exam weeks.
- **Exit:** sign-off from the school, and a go or no-go decision for the first-term exams of the next session.

### Later (v1.x)
- Word (.docx) question import, item analysis reports, SMS or WhatsApp result notifications, payment for PINs, a multi-school HLTS super-admin console, and transcripts.

---

## 11. Testing strategy

| Level | What |
|---|---|
| Unit | `@hlts/core`: grading, rounding, ties and positions, cumulative averages, shuffling seeds, and scoring per item type. Property-based tests for sync merge (any event order gives the same final answers) |
| Rules | Firestore and Storage rules tested in the emulator for every role (allowed and denied cases) |
| Integration | Functions with emulators. Hub with an in-memory SQLite and a fake cloud |
| End to end | Playwright: student sits exam, network drops, reload, resume, submit. Teacher enters scores offline, comes back online, and the scores sync |
| Load | k6 or Artillery against the hub and a staging Functions endpoint |
| Failure drills | Scripted power-cut and network-loss scenarios, run before every pilot |
| Acceptance | Parallel run with the school's manual results for one term |

---

## 12. Exam-day operations (offline runbook outline)

1. **T−3 days:** exam officer downloads packages to the hub. The hub checks signatures and shows "Ready: N exams, M candidates".
2. **T−1 day:** lab check. All PCs open the hub URL and run the device check. UPS charged. Spare PCs set aside.
3. **Exam start:** the hub releases keys at the start time. Students log in with ID and PIN. The proctor console shows who is live.
4. **Incident:** if a PC fails, the student moves to a spare PC and the attempt resumes. If power fails, the hub (on UPS) keeps state, and clients resume when power returns. Extra time can be granted with a logged reason.
5. **End:** auto-submit, and the hub shows "All submitted". Sync now if online. Otherwise export a USB bundle.
6. **After:** the cloud confirms receipt (counts match), and the hub archives the package.

**Recommended hardware per exam centre:** 1 hub (mini PC or laptop, i5, 8 GB RAM, 256 GB SSD), 1 gigabit switch or a decent Wi-Fi 6 router for tablets, a UPS for the hub and network gear (at least 1 hr), and 10% spare client PCs.

---

## 13. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Power outages during exams | UPS on hub and network, durable local writes, resume on any PC |
| Questions leak before the exam | Encrypted packages, time-locked key release, audit of package downloads |
| Cheating in the lab | Shuffling, proctor console, LAN-only access, logged blur events, seating plan |
| Offline and online results differ | One shared `@hlts/core`, plus a re-mark in the cloud on sync with mismatches flagged |
| Low staff digital skills | Excel-friendly imports, spreadsheet-like grids, short training videos, exam-week support |
| Firebase costs grow with autosave writes | Debounce and batch events (e.g. every 2 s or 5 events). Hub batches before upload. Budget alerts |
| Scope creep into a full ERP | Strict v1 scope (§1). Change requests go through HLTS product owner |

---

## 14. Open questions for HLTS / Engreg

1. Is this for **Engreg only** at first, or should multi-school onboarding (HLTS as SaaS provider) be in v1?
2. Exact **score components and grade scales** for each level (Nursery, Primary, JSS, SSS), and how ties and cumulative averages are handled.
3. Preferred result access for parents: **login accounts, scratch-card PINs, or both**? Should results be withheld until fees are paid?
4. How many lab PCs, which OS, and is there Wi-Fi or wired LAN? Is a dedicated hub machine available?
5. Should theory/essay questions be answered on screen, or stay on paper with only scores entered?
6. Branding and layout of the current report card (please share a sample).
7. Hosting region and data-residency expectations (Firestore location is fixed once chosen).
8. Who owns support on exam days (HLTS staff on site, or school ICT staff)?

---

## 15. Immediate next steps

1. Review this plan and answer §14.
2. Approve the repository decision (§4.3) and create `hlts-limited/hlts-cbt`.
3. Start Phase 0 by fixing the Firestore and Storage rules in this repo now, independent of the new system.
4. Collect a sample report card, the grading policy, and one term's broadsheet for the Phase 1 acceptance test.
