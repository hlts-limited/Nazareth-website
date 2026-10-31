# HLTS Limited: CBT System
## Implementation Plan (online and offline), CBT first

| | |
|---|---|
| **Status** | Draft v0.2 for review (narrowed to CBT only) |
| **Date** | 31 October 2026 |
| **Scope** | Computer-Based Testing (CBT) for schools served by HLTS Limited, starting with Engreg Schools (this repository) |
| **Runs** | Online (cloud) and offline (on a school LAN or a single device), with reliable sync between them |
| **Later** | Result management (report cards, broadsheets, publishing) is a separate follow-on project. See §13 |

---

## 1. Goals

1. **Run CBT exams with or without internet.** Typical cases are a computer lab with an unreliable connection, power cuts in the middle of an exam, and day schools with no connection at all.
2. **Never lose an answer.** Every response is saved on the device first and synced later, and every change is logged.
3. **Mark objective questions automatically** and give teachers a queue for theory answers.
4. **Hand scores to the school's current results process** as Excel/CSV and printable score sheets, so CBT is useful before any results module exists.
5. **Reuse what already exists.** That means Firebase project `engreg-school` (Auth, Firestore, Storage, Hosting), the admin dashboard, and the audit log.
6. **Be ready for more schools and for a results module later.** Every record carries a `schoolId`, and CBT scores are stored in a shape a results module can read directly.

### Out of scope for this project
- Result management: CA entry, grade computation, positions, approval, report cards, parent portal, result-checker PINs.
- Remote proctoring through webcam or AI.
- Native mobile apps. The installable PWA covers tablets.

---

## 2. Current state (what this builds on)

| Area | Today | Gap for CBT |
|---|---|---|
| Hosting | Static HTML/JS site on Firebase Hosting | Needs app-style screens for students, teachers and exam officers |
| Admin | `admin-dashboard.html/js` (Firebase compat SDK v10.8) plus a Flask portal in `engreg-admin/` | Two admin stacks. Pick one and extend it (see §4.3) |
| Auth | Email and password admin login | `firestore.rules` `isAdmin()` lets **any** signed-in user in. Roles must come from custom claims before students get accounts |
| Data | Registrations, successful-candidate lists, gallery, settings, audit logs | No students, classes, subjects, questions or exams |
| Storage | `registrations/**` accepts public writes with no size or type limit | Must be tightened before more upload surfaces are added |

> **Must happen first:** once students and teachers can sign in, the current rule (`request.auth != null`) would give them admin access. Phase 0 replaces it with role checks.

---

## 3. Users and roles

| Role | Main tasks |
|---|---|
| **HLTS super admin** | Onboard schools, register exam hubs, view platform health |
| **School admin** | Set up classes, subjects, staff and students; approve exams for release |
| **Exam officer** | Build exams from the question bank, schedule them, run the exam hub, monitor live sessions, export scores |
| **Teacher** | Write and review questions, mark theory answers, view their class's scores |
| **Proctor / invigilator** | Start sessions, handle incidents, grant extra time, force-submit |
| **Student** | Sit exams, and see their score if the exam allows it |

Roles live in **Firebase Auth custom claims** (`{ role, schoolId }`), set only by a Cloud Function that admins call. Security rules read the claims. Nothing in the client is trusted. On the hub, staff accounts are synced from the cloud and students log in with their ID and an exam PIN.

---

## 4. Architecture

### 4.1 Overview

```
                        ┌───────────────────────── CLOUD (online) ─────────────────────────┐
                        │  Firebase Auth · Firestore · Storage · Hosting · Cloud Functions │
                        │  (package builder, marking, sync endpoint, score export)         │
                        └──────────────▲───────────────────────────▲───────────────────────┘
                                       │ HTTPS (when available)    │ HTTPS
              ┌────────────────────────┴───────┐          ┌────────┴──────────────────┐
              │  EXAM HUB (offline LAN server) │          │  Online clients           │
              │  mini PC / laptop on UPS       │          │  (school with internet)   │
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
| **A. Online** | School has a dependable connection | PWA talks straight to Firestore and Cloud Functions. Responses autosave to IndexedDB and then to Firestore |
| **B. LAN hub (main offline mode)** | Computer lab without dependable internet | Exam officer downloads encrypted exam packages to the hub before exam day. Lab PCs open `http://cbt.local` (or the hub's IP). The hub marks objective questions locally and pushes results to the cloud whenever it can |
| **C. Standalone device** | One laptop, small groups, makeup exams | PWA installed in advance with the exam package cached. The key is released at start time by a proctor PIN. Results upload later or go out by USB bundle |

### 4.3 Technology choices (recommended)

| Layer | Choice | Why |
|---|---|---|
| Shared domain logic | **TypeScript package `@hlts/core`** for item scoring, shuffling seeds, attempt state and sync event types | One implementation runs in the browser, Cloud Functions and the hub, so offline and online marking always match |
| Front end | **PWA in TypeScript with Vite**; Preact or React; Workbox service worker; Dexie for IndexedDB; KaTeX for maths | Installable, works offline, small bundle for low-end lab PCs |
| Cloud | Firebase Auth, Firestore, Storage, **Cloud Functions (Node 20, TS)**, Hosting, App Check | Already in use |
| Hub server | **Node.js (Fastify) + SQLite (better-sqlite3)**, packaged as one Windows/Linux installer (pkg or Electron tray app) | Runs on cheap hardware. SQLite is one file and easy to back up. Same TS core as the cloud |
| Admin | New CBT screens in the PWA (staff area). Link to them from the existing `admin-dashboard.html` | Avoids growing the 90 KB dashboard script and keeps one codebase for hub and cloud screens |

> **Repository decision:** keep the public website in this repo and put the CBT product in a **new monorepo** (`hlts-limited/hlts-cbt`) with `packages/core`, `apps/web` (PWA), `apps/hub` and `functions/`. Engreg's site then links to it. A results module can be added to the same monorepo later.

---

## 5. Functional modules

### 5.1 Minimal school setup
Only what CBT needs:
- Sessions and terms, used to tag exams.
- Classes and arms (e.g. JSS1A, SS2B), subjects, and teacher-to-subject assignments.
- Students: admission number, name, class, photo (optional), and exam PIN. Import from CSV and from the existing `*_successful` admission lists.

### 5.2 Question bank
- Item types: single-choice MCQ, multi-select, true/false, fill-in-the-blank (with accepted variants), numeric (with tolerance), and essay/theory (marked by hand). Images, audio for languages, LaTeX maths, and shared comprehension passages are supported.
- Metadata: subject, class level, topic, difficulty, tags, author, and status (`draft → reviewed → approved`).
- Import from **Excel/CSV templates** and **Aiken/GIFT** text. Word (.docx) import comes later.
- Version history. An exam keeps the item versions it was published with.
- Item analysis after each exam: difficulty index, discrimination, and distractor counts.

### 5.3 Exam setup and scheduling
- Fixed questions or **blueprint** selection (e.g. 10 easy, 20 medium and 10 hard from topics X and Y).
- Question and option order shuffled with a per-attempt seed, so neighbouring screens differ.
- Duration, start and end window, late-entry cutoff, attempts allowed, pass mark, section timing, calculator on or off, review allowed or not, and show score immediately or after release.
- **Score scaling** (e.g. 40 marks scaled to 60) and a label for the result component it counts towards, such as "First Term Exam". This is the hook a results module will use later.
- Candidate lists come from the class arm, with per-student extra time for accessibility needs.
- Exam types: class test, mid-term, terminal exam, entrance exam (for admissions candidates without student accounts), and practice mode with instant feedback.

### 5.4 Exam delivery client
- Login: student ID and exam PIN, or a QR card. Device check and instructions screen.
- Question navigator grid (answered, flagged, unanswered), next and previous, flag for review, font size control, and light and dark themes.
- **Autosave on every change** to IndexedDB at once, then to the hub or cloud within about 2 seconds, retrying with backoff.
- **Timer from the server's clock** (hub or cloud). The local clock is only a display fallback, and drift is corrected on each sync.
- **Crash and power-loss recovery:** on reload or on another PC, the attempt resumes with answers and remaining time intact.
- Integrity measures (deterrents, not guarantees): fullscreen request, logging of tab and blur events, copy and paste blocked, right-click disabled, one active session per candidate, and IP/LAN restriction on the hub.
- Auto-submit when time runs out. Submission receipt showing a code built from a hash of the answers.

### 5.5 Proctor console
- Live grid of candidates: not started, in progress (questions answered), idle, submitted, disconnected.
- Actions: unlock a candidate onto another PC, grant extra time with a reason, pause or resume a candidate, force-submit, and post an announcement to all screens.
- Incident log, which is included in the exam report.

### 5.6 Marking
- Objective items are marked automatically by `@hlts/core`, on the hub when offline and in Functions when online.
- Theory items go into a **marking queue** per teacher, with optional rubric, second marking, and moderation by the head of department.
- Re-scoring: if an answer key is corrected, all affected attempts are re-marked, with an audit entry.

### 5.7 Scores output (instead of a results module for now)
- Per exam and class arm: **Excel/CSV export** (admission number, name, raw score, scaled score, per-section scores) in a layout that pastes into the school's current broadsheet.
- Printable score sheet (PDF) for the class teacher to sign.
- Per-student answer script (PDF) for disputes and moderation.
- Exam analysis: score distribution, item analysis, and time spent per question.
- Entrance exams: ranked candidate list that can be pushed into the existing `*_successful` admission lists.

---

## 6. Data model (Firestore, cloud)

Every document carries `schoolId`. Paths below sit under `schools/{schoolId}/`.

| Collection | Key fields |
|---|---|
| `sessions/{sessionId}/terms/{termId}` | name, start, end |
| `classes/{classId}` | level, arm |
| `subjects/{subjectId}` | name, code, levels[] |
| `students/{studentId}` | admissionNo, names, classId, photoPath, examPinHash |
| `staff/{uid}` | role, subjectIds[], classIds[] |
| `questions/{qid}` (+ `versions/{v}`) | type, stem, options[], marks, topic, difficulty, status |
| `questions/{qid}/keys/current` | answer key. Readable only by Functions and the hub |
| `exams/{examId}` | title, subjectId, termId, classIds[], config{duration, window, shuffle, scaling…}, itemRefs[{qid, v}], resultComponent, status |
| `exams/{examId}/attempts/{attemptId}` | studentId, seed, startedAt, deadline, status, rawScore, scaledScore, deviceId, source(`online|hub:<id>|device:<id>`) |
| `exams/{examId}/attempts/{attemptId}/events/{eventId}` | type(answer/flag/blur/submit), qid, value, clientTs, seq, hmac |
| `hubs/{hubId}` | name, publicKey, lastSyncAt, softwareVersion |
| `audit_logs/{id}` | actor, action, target, before, after, ts (existing collection, extended) |

The hub's SQLite schema mirrors the subset it needs (exams, items, keys, candidates, attempts, events, sync_outbox, sync_inbox).

**Results-ready:** `attempts` store `termId`, `subjectId`, `resultComponent` and `scaledScore`, so a later results module can read CBT scores without migrating data.

---

## 7. Offline sync design

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
- No internet for days: the exam officer **exports a sync bundle** (signed and encrypted) to USB and uploads it from any connected computer.

### 7.3 Conflict rules
| Data | Rule |
|---|---|
| Answer events | Combine all events and order them by `(attemptId, seq)`. The latest event per question before the submit event wins |
| Attempt status | Moves one way only: `not_started → in_progress → submitted → marked`. Never goes back |
| Same student active on two devices | Hub enforces one active session. If both appear after sync, flag for exam officer review instead of merging silently |
| Answer key corrections | Cloud is the source of truth. Hubs pull new key versions and re-mark |
| Hub score vs cloud re-mark | Cloud re-marks every synced attempt with the same core. Any mismatch is flagged, never silently overwritten |

### 7.4 Time integrity offline
- The hub is the time authority on the LAN. It records any clock jump and is set from NTP whenever online.
- The deadline is stored as `startedAt + duration + extraTime` in **hub time**. Clients only display a countdown.

---

## 8. Security and privacy

- **Role-based Firestore and Storage rules** using custom claims and `schoolId` matching, with unit tests in the Firebase emulator. This replaces today's `request.auth != null`.
- **App Check** on web clients, and rate limits on login and sync Functions.
- Answer keys are **never** readable by student clients. Marking runs in Functions or on the hub.
- Exam packages are encrypted at rest and keys are released only at start time. Hub admin access is protected by password and device binding. Package downloads are logged.
- Every privileged action (extra time, force-submit, re-mark, key change, score export) is written to `audit_logs`.
- **Nigeria Data Protection Act 2023:** minimal student data, a retention policy for answer scripts, and a privacy notice.
- Backups: Firestore scheduled exports (daily), and SQLite snapshots on the hub after every exam plus copy to USB.
- Secrets: service account JSON stays out of git (already in `.gitignore`). Use Functions secrets, and rotate any key that has ever been shared.

---

## 9. Non-functional targets

| Metric | Target |
|---|---|
| Concurrent candidates per hub | 300 on a mid-range mini PC (i5, 8 GB RAM, SSD) on gigabit LAN |
| Concurrent online candidates | 2,000 per school without degradation |
| Answer saved locally | under 50 ms. Acknowledged by hub under 500 ms (p95) |
| Data loss on power cut | 0 acknowledged events. Client keeps unacknowledged events and resends |
| Client hardware | Works on Chrome or Edge from the last 2 years, 4 GB RAM PCs, and 1366×768 screens |
| Objective marking | Scores ready within 1 min of the last submission |
| Availability | Hub needs no internet during an exam. Cloud uses Firebase's SLA |

---

## 10. Delivery phases (CBT only)

Assumes a team of 2–3 developers, 1 QA/support person, and a named school contact (exam officer). Durations are estimates.

### Phase 0: Foundations (weeks 1–2)
- Create the monorepo, CI (lint, test, emulator rule tests), and staging and production Firebase projects.
- Custom claims and role management Function. Rewrite Firestore and Storage rules.
- `@hlts/core` skeleton: item scoring for every type and seeded shuffling, with full unit tests.
- Minimal school setup screens: classes, subjects, staff, and student CSV import.
- **Exit:** roles enforced (proven by rule tests), and Engreg's classes and students imported in staging.

### Phase 1: Online CBT (weeks 3–7)
- Question bank (all objective types, plus theory with manual marking), Excel and Aiken import, and review workflow.
- Exam builder, scheduling, shuffling, scaling, and candidate lists.
- Exam client PWA with autosave, resume, server timer, and integrity events.
- Proctor console.
- Auto-marking, theory marking queue, score export (Excel/CSV/PDF), and answer scripts.
- **Exit:** a real class test for one class arm runs online end to end, and the exported scores go into the school's existing broadsheet.

### Phase 2: Offline hub and sync (weeks 8–13)
- Hub server (Fastify + SQLite), installer, first-run pairing with the cloud (key exchange), and LAN discovery (`cbt.local` through mDNS, plus a fallback of IP on the screen and a QR code).
- Encrypted exam packages, outbox and inbox sync, USB bundle import and export.
- Proctor console and marking running on the hub.
- Standalone device mode (Mode C).
- Failure testing: pull network cables, cut power to hub and clients during an exam, run clocks fast or slow, sync the same bundle twice.
- **Exit:** a 100-candidate lab exam with no internet, results synced and matching a re-mark in the cloud.

### Phase 3: Pilot and rollout (weeks 14–16)
- Pilot: one real mid-term test or mock exam at Engreg with the full process (package to hub, exam, sync, marking, export).
- Load test (300 simulated candidates on the hub, 2,000 online), security review, and accessibility pass.
- Training materials: exam officer runbook, proctor card, teacher quick-start for question entry. Support rota during exam weeks.
- **Exit:** sign-off from the school, and a go or no-go for CBT in the next terminal exams.

**Total: about 16 weeks** (down from 22 for the combined plan).

---

## 11. Testing strategy

| Level | What |
|---|---|
| Unit | `@hlts/core`: scoring per item type, partial credit, scaling, and shuffling seeds. Property-based tests for sync merge (any event order gives the same final answers) |
| Rules | Firestore and Storage rules tested in the emulator for every role (allowed and denied cases) |
| Integration | Functions with emulators. Hub with an in-memory SQLite and a fake cloud |
| End to end | Playwright: student sits exam, network drops, reload, resume on another PC, submit, score appears in export |
| Load | k6 or Artillery against the hub and a staging Functions endpoint |
| Failure drills | Scripted power-cut and network-loss scenarios, run before every pilot |
| Acceptance | Pilot exam marked by CBT and spot-checked by hand for a sample of scripts |

---

## 12. Exam-day operations (offline runbook outline)

1. **T−3 days:** exam officer downloads packages to the hub. The hub checks signatures and shows "Ready: N exams, M candidates".
2. **T−1 day:** lab check. All PCs open the hub URL and run the device check. UPS charged. Spare PCs set aside. PIN slips printed.
3. **Exam start:** the hub releases keys at the start time. Students log in with ID and PIN. The proctor console shows who is live.
4. **Incident:** if a PC fails, the student moves to a spare PC and the attempt resumes. If power fails, the hub (on UPS) keeps state, and clients resume when power returns. Extra time can be granted with a logged reason.
5. **End:** auto-submit, and the hub shows "All submitted". Sync now if online. Otherwise export a USB bundle.
6. **After:** the cloud confirms receipt (counts match), and the hub archives the package. The exam officer exports scores.

**Recommended hardware per exam centre:** 1 hub (mini PC or laptop, i5, 8 GB RAM, 256 GB SSD), 1 gigabit switch or a decent Wi-Fi 6 router for tablets, a UPS for the hub and network gear (at least 1 hr), and 10% spare client PCs.

---

## 13. Later: result management (separate project)

Not part of this plan. The CBT is built so it can plug in later without rework:
- `attempts` already carry `termId`, `subjectId`, `resultComponent` and `scaledScore`.
- `@hlts/core` is where grading scales and positions will be added.
- The results module would cover: CA score entry (offline through Firestore persistence), grade and position computation, approval and locking, report cards, broadsheets, and parent access by login or result-checker PIN.

Rough estimate for that project when it's time: 5–6 weeks on top of the CBT.

---

## 14. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Power outages during exams | UPS on hub and network, durable local writes, resume on any PC |
| Questions leak before the exam | Encrypted packages, time-locked key release, audit of package downloads |
| Cheating in the lab | Shuffling, proctor console, LAN-only access, logged blur events, seating plan |
| Offline and online scores differ | One shared `@hlts/core`, plus a re-mark in the cloud on sync with mismatches flagged |
| Teachers slow to enter questions | Excel/Aiken import, a question-entry template, and a data-entry sprint before the pilot |
| Low staff and student digital skills | Practice mode for students before real exams, short training videos, exam-week support |
| Firebase costs grow with autosave writes | Debounce and batch events (e.g. every 2 s or 5 events). Hub batches before upload. Budget alerts |

---

## 15. Open questions for HLTS / Engreg

1. Is this for **Engreg only** at first, or should multi-school onboarding be in this first release?
2. Which exams go on CBT first: class tests, mid-terms, terminal exams, or **entrance exams** for admissions?
3. Should theory/essay questions be answered on screen, or stay on paper with CBT covering only objective sections?
4. How many lab PCs, which OS, and is there Wi-Fi or wired LAN? Is a dedicated hub machine available?
5. What layout does the school's current broadsheet use, so the score export matches it?
6. Where are the questions now (Word files, past papers, nowhere yet)?
7. Who owns support on exam days (HLTS staff on site, or school ICT staff)?

---

## 16. Immediate next steps

1. Review this plan and answer §15.
2. Approve the repository decision (§4.3) and create `hlts-limited/hlts-cbt`.
3. Start Phase 0 by fixing the Firestore and Storage rules in this repo now, independent of the new system.
4. Collect one subject's questions in the import template and a sample broadsheet for the Phase 1 pilot test.
