# HLTS Limited: Offline CBT Software
## Implementation Plan for a desktop (executable) CBT system

| | |
|---|---|
| **Status** | Draft v0.4 for review (offline desktop software, CBT only, sold by HLTS to many schools) |
| **Date** | 31 October 2026 |
| **Product** | **HLTS CBT**: installable Windows software (`.exe` installers) that runs exams on a school's own computers with **no internet required** |
| **Business model** | HLTS licenses the software to many schools. Engreg Schools is the first customer and pilot site |
| **Later** | Optional online features (online licence portal, cloud backup, result management) are separate follow-on work. See §13 |

---

## 1. Goals

1. **Fully offline.** Install from a USB stick and run every feature (question bank, exams, marking, reports) with no internet, ever.
2. **Simple to install and run.** One installer for the exam server, one for the exam client. A non-technical exam officer can set up a lab in under an hour.
3. **Never lose an answer.** Every response is saved on the student's PC and on the server at once. A power cut or crashed PC doesn't lose work.
4. **Secure exams.** Questions are encrypted on disk, the student screen is locked down, and every action is logged.
5. **Usable scores straight away.** Automatic marking, Excel/PDF exports in the school's broadsheet layout, and printable answer scripts.
6. **A commercial HLTS product sold to many schools.** Strict offline licensing, per-school branding, editions, an HLTS licence and customer management tool, versioned releases, and a support process. See §7.

### Out of scope for v1
- Result management (CA entry, report cards, positions). CBT scores are exported for now.
- Internet features of any kind. Every design choice still allows them to be added later (§13).
- macOS. Linux support for the server only if a school needs it.

---

## 2. Product overview

HLTS CBT is made of two desktop applications on one local network (LAN). It can also run on a single PC.

| Application | Installed on | What it does |
|---|---|---|
| **HLTS CBT Server** (`HLTS-CBT-Server-Setup.exe`) | One machine per exam centre: exam officer's laptop or a dedicated mini PC | Holds the database, the admin screens (setup, question bank, exams, marking, reports) and the proctor console. Serves exams to clients over the LAN |
| **HLTS CBT Client** (`HLTS-CBT-Client-Setup.exe`) | Every student PC in the lab | Finds the server automatically, locks the PC into a fullscreen exam screen, saves answers locally and on the server |
| **Browser fallback** | Any PC or tablet without the client installed | Opens `http://<server-ip>:8080` in Chrome or Edge to sit the exam with reduced lockdown. Turned off by default, and the exam officer can allow it per exam |

```
        ┌─────────────────────────────────────────────┐
        │  HLTS CBT Server (.exe)                     │
        │  admin UI · proctor console · exam service  │
        │  SQLite (encrypted) · backups to USB        │
        └───────────▲───────────▲───────────▲─────────┘
                    │  LAN (Ethernet / Wi-Fi), no internet
          ┌─────────┴──┐ ┌──────┴─────┐ ┌───┴─────────┐
          │ CBT Client │ │ CBT Client │ │ Browser     │
          │ (kiosk)    │ │ (kiosk)    │ │ fallback    │
          │ local save │ │ local save │ │ (optional)  │
          └────────────┘ └────────────┘ └─────────────┘

   Single-PC mode: server and client run on the same computer (makeup exams, small groups).
```

---

## 3. Users and roles (all local accounts on the server)

| Role | Main tasks |
|---|---|
| **Administrator** | Install, activate the licence, manage users, backups and settings |
| **Exam officer** | Set up classes and students, build and schedule exams, run the proctor console, export scores |
| **Teacher** | Write and review questions for their subjects, mark theory answers |
| **Proctor / invigilator** | Start sessions, move students to spare PCs, give extra time, force-submit |
| **Student** | Log in on a client with admission number and exam PIN, then sit the exam |

Staff accounts use passwords hashed with Argon2, with lockout after failed attempts. Students don't have passwords. Instead they get a PIN for each exam, printed on PIN slips.

---

## 4. Technology choices (recommended)

| Layer | Choice | Why |
|---|---|---|
| Desktop shell | **Electron** for both server and client | Mature, good kiosk and fullscreen controls, one JavaScript/TypeScript codebase, easy Windows installers. Alternative: **Tauri** gives much smaller installers and lower memory use, but needs Rust skills |
| Language | **TypeScript** throughout | One language for UI, server logic and marking |
| Shared logic | `@hlts/core` package for item scoring, shuffling seeds, attempt state, scaling, and save-event types | Client and server mark identically |
| UI | React (or Preact) + Vite, KaTeX for maths | Fast on low-end PCs, works the same in the browser fallback |
| Server engine | **Fastify** HTTP/WebSocket server running inside the server app | Real-time proctor updates, many concurrent clients |
| Database | **SQLite** (better-sqlite3) with **SQLCipher** encryption, WAL mode, `synchronous=FULL` | Single encrypted file, no database server to install, survives power cuts, easy to back up |
| Client local store | SQLite file per client (or IndexedDB in the browser fallback) | Answers survive a crash or power cut on the student PC |
| Discovery | UDP broadcast + mDNS (`hlts-cbt.local`), with manual IP entry and a QR code on the server screen as fallback | Clients find the server with no configuration |
| Reports | PDF with pdf-lib, Excel with ExcelJS | No Office installation needed |
| Packaging | **electron-builder** → NSIS `.exe` installers (and portable `.zip`), **code-signed** with an HLTS certificate | Windows SmartScreen trusts signed installers. Schools can install from USB |

**Minimum hardware**
- **Server:** Windows 10/11 64-bit, i5 or Ryzen 5, 8 GB RAM, SSD, wired network. Handles 300 candidates.
- **Client:** Windows 10/11 (64-bit; 32-bit build if needed), 4 GB RAM, 1366×768 screen.
- **Network:** gigabit switch (preferred) or Wi-Fi 6 router. UPS for the server and network gear.

**Repository:** create a new monorepo `hlts-limited/hlts-cbt` with `packages/core`, `apps/server`, `apps/client` and `apps/web-ui` (the screens shared by both apps and the browser fallback). The Engreg website repo stays as it is.

---

## 5. Functional modules

### 5.1 Installation and first run
- Install wizard: choose Server or Client, install location, and Windows Firewall rule (added automatically, with consent).
- Server first run: create the administrator, enter school name and logo, and **activate the licence offline** (§7).
- Client first run: finds servers on the LAN, the proctor approves the PC once (it then gets a device ID), and the PC is assigned a seat number.

### 5.2 School setup
- Sessions and terms, classes and arms, subjects, and teacher-to-subject assignments.
- Students: admission number, name, class, photo (optional). **Import from Excel/CSV.**
- PIN slip generator: prints exam PINs per class (with QR codes) on A4.

### 5.3 Question bank
- Item types: single-choice MCQ, multi-select, true/false, fill-in-the-blank (with accepted variants), numeric (with tolerance), and essay/theory (marked by hand). Images, audio for languages, LaTeX maths, and shared comprehension passages are supported.
- Metadata: subject, class level, topic, difficulty, tags, author, and status (`draft → reviewed → approved`).
- **Import from Excel/CSV templates, Aiken text, and Word (.docx) using a simple numbered format.**
- Version history. An exam keeps the question versions it was built with.
- **Question bank transfer:** export and import as an encrypted `.hltsbank` file, to move questions between schools, campuses or a teacher's laptop.
- Item analysis after each exam: difficulty, discrimination, and distractor counts.

### 5.4 Exam setup and scheduling
- Fixed questions or **blueprint** selection (e.g. 10 easy, 20 medium and 10 hard from topics X and Y).
- Question and option order shuffled per student, so neighbouring screens differ.
- Duration, start time, late-entry cutoff, attempts, pass mark, sections with their own timers, calculator on or off, review allowed or not, show score at the end or not.
- Score scaling (e.g. 40 marks scaled to 60).
- Candidate lists from classes, with extra time for individual students.
- Exam types: class test, mid-term, terminal exam, **entrance exam** (walk-in candidates without student records), and **practice mode** with instant feedback.
- Exams stay **locked (encrypted) until the scheduled start**, and a proctor releases them on the day.

### 5.5 Exam client (student screen)
- **Kiosk mode:** fullscreen, always on top, no window frame. Blocks Alt+F4, Ctrl+W and the Windows key combinations Electron can catch. Logs and warns on focus loss. Can't be closed without a proctor password.
- For stricter lockdown, the installer can optionally set up a **Windows kiosk account** (Assigned Access or Shell Launcher) so the PC boots straight into the exam client. This is documented for school IT.
- Login with admission number and PIN, or by scanning the QR on the PIN slip. Candidate photo shown for the invigilator to check.
- Question navigator (answered, flagged, unanswered), next and previous, flag for review, font size control, calculator.
- **Every answer saved twice at once:** in the client's local database and on the server (acknowledged within 500 ms). If the server can't be reached, answers queue locally and send when it comes back.
- **Server-controlled timer.** The client only shows the countdown. Extra time and pauses come from the proctor.
- **Resume anywhere:** if a PC fails, the student logs in on a spare PC and carries on with answers and time intact.
- Auto-submit at time-up. Submission receipt code shown on screen.

### 5.6 Proctor console (on the server)
- Live seat map: not started, in progress (questions answered), idle, warning (focus lost), submitted, disconnected.
- Actions: release the exam, move a student to another PC, give extra time with a reason, pause or resume, force-submit, unlock a client, and broadcast a message to all screens.
- Incident log, printed in the exam report.

### 5.7 Marking
- Objective questions marked automatically on submission.
- Theory answers go into a **marking queue** per teacher (marked on the server or a staff PC on the LAN), with optional rubric, second marking and moderation.
- Answer key correction re-marks all affected attempts, logged in the audit trail.

### 5.8 Reports and exports
- **Excel/CSV score export** per exam and class in the school's broadsheet layout. A template editor lets the exam officer map the columns.
- Printable score sheet (PDF) for signature, and **per-student answer scripts** (PDF).
- Exam analysis: score distribution, item analysis, and time per question.
- Entrance exams: ranked candidate list (Excel/PDF), which the school can upload to its website's admission lists by hand.

### 5.9 Backup, restore and maintenance
- **Automatic backup** after every exam and daily, to a second disk or USB. Backups are encrypted.
- One-click restore, plus a "move to new server PC" wizard.
- Archive old sessions to keep the database small.
- Licence screen: edition, candidate limit, expiry, machine code, and enter activation or renewal codes.
- Diagnostics: network test, client list with software versions, and a log bundle for HLTS support (exported to USB, with no student data unless chosen).

---

## 6. Data model (SQLite on the server)

| Table | Key fields |
|---|---|
| `users` | id, name, role, passwordHash, active |
| `sessions`, `terms` | name, start, end |
| `classes`, `subjects`, `teacher_subjects` | level, arm, subject codes |
| `students` | id, admissionNo, names, classId, photo |
| `questions`, `question_versions` | type, stem, options, marks, topic, difficulty, status |
| `answer_keys` | questionVersionId, key (stored encrypted separately from questions) |
| `exams`, `exam_items`, `exam_candidates` | config (JSON), item refs, candidate list, extra time, PIN hash |
| `attempts` | id, examId, studentId, seed, startedAt, deadline, status, rawScore, scaledScore, deviceId |
| `answer_events` | eventId (UUIDv7), attemptId, deviceId, seq, questionId, value, clientTs, serverTs |
| `devices` | deviceId, name, seat, approved, lastSeen, clientVersion |
| `incidents` | attemptId, type, note, by, ts |
| `audit_log` | actor, action, target, before, after, ts |
| `license` | licence file contents, activation info, transfer history |
| `school_profile` | name, logo, colours, address, motto, export templates |
| `clock_watermark` | latest trusted time seen (clock rollback detection) |

On each client, a small local SQLite holds unsent `answer_events` and the current attempt state only. It holds no answer keys.

**How saving works:** each answer change is an append-only event with a unique ID. The server stores events by ID, so a resend never duplicates anything. The latest event per question before submission wins. Attempt status only moves forward (`not_started → in_progress → submitted → marked`).

---

## 7. Commercial product: licensing, editions and distribution

HLTS will sell HLTS CBT to other schools, so licensing, branding and support are part of v1, not extras.

### 7.1 Editions (proposal; prices set by HLTS)
| Edition | For | Limits and features |
|---|---|---|
| **Trial** | Schools evaluating | 30 days, up to 20 concurrent candidates, "TRIAL" watermark on exports |
| **Standard** | Primary and small secondary schools | Up to 100 concurrent candidates, 1 server install |
| **Professional** | Larger secondary schools | Up to 300 concurrent candidates, 2 server installs (main + backup), item analysis, Word import |
| **Centre / Enterprise** | Exam centres, school groups, multi-campus | Custom candidate limits, several servers, priority support |

Licences are **annual subscriptions** (renewal keeps updates and support), with an option for a one-off perpetual licence plus paid yearly updates. HLTS decides which to offer. Add-ons can include question packs (e.g. WAEC/NECO/BECE practice banks) and on-site setup.

### 7.2 Licence file and offline activation
- **Licence file** signed by HLTS with Ed25519. It contains: licence ID, school name, edition, maximum concurrent candidates, number of server installs, features enabled, start and expiry dates.
- **Offline activation:** the server shows a short machine code (hardware fingerprint plus licence ID). The school sends it to HLTS by phone, WhatsApp or email. HLTS returns an activation code, which the admin types or pastes in. No internet is needed on the school's PC.
- **Transfers:** if a school replaces its server PC, HLTS issues a deactivation-and-reactivation code. The number of transfers per year is limited.
- **Renewal:** a new code extends the expiry date. Warnings start 30 days before expiry.
- **After expiry:** past data stays readable and exportable, but new exams can't be started. Exams already scheduled for the next 7 days can still run (grace period), so a school is never stopped in the middle of exam week.
- Clients need no licence. The server enforces the concurrent candidate limit.

### 7.3 Protecting the product against piracy
- Licence checked at server start and at every exam release, against the signed file and the machine fingerprint.
- **Clock rollback detection:** the server records the latest time it has seen (in the database and the audit log). If the PC clock goes backwards to dodge expiry, it refuses to start new exams until an admin enters a code from HLTS.
- Core licence and marking code compiled to V8 bytecode (bytenode) and the app bundle integrity-checked at start. This won't stop a determined attacker, but it stops casual copying.
- Each licence ID shows in the footer of every export, so copied installs can be traced.
- An EULA shown at install and a signed customer agreement.

### 7.4 HLTS Licence Manager (internal tool for HLTS staff)
A small separate desktop app that only HLTS uses:
- Customer register: school name, contacts, address, edition, licence history, invoices reference.
- Generate trial, full, renewal and transfer activation codes from a school's machine code.
- The signing private key is stored only on HLTS machines (ideally a hardware token or YubiKey) and backed up offline. **If this key leaks, anyone can make licences**, so access is limited to named staff.
- Reports: licences expiring this month, schools by edition, and active installs.
- Later, this can move online as a licence portal (§13).

### 7.5 Per-school branding (white-label)
- School name, logo, colours, address and motto on the student login screen, exam screen, PIN slips and every PDF/Excel export.
- Set by the school admin in the server app. HLTS branding stays in the "Powered by HLTS CBT" footer and the About screen.
- Customisable export templates so each school's scores match its own broadsheet.

### 7.6 Releases and updates
- Version numbers like `1.4.2`. A changelog ships with every release.
- Signed installers delivered by download link and on USB by HLTS staff or resellers.
- Database migrations run automatically after a backup. Rollback to the previous version is possible from that backup.
- **No updates during an exam:** the server refuses to upgrade while an exam is scheduled within 24 hours.
- Clients must match the server version. The server can push the matching client installer to each lab PC over the LAN.
- One supported release line at a time. Security fixes go to the current version only.

### 7.7 Onboarding and support for each new school
- **Onboarding kit:** installers on a branded USB, quick-start guide, Excel templates for students and questions, PIN slip template, and a lab readiness checklist (PC specs, network, UPS).
- **Setup options:** remote guidance by phone or video, or paid on-site installation.
- **Support:** helpdesk by phone, WhatsApp and email, with an exam-week hotline. Schools send a **diagnostics bundle** (logs, versions, no student data unless chosen) on USB or by email.
- **Training:** exam officer manual, teacher question-entry guide, proctor quick card, and short videos.
- Optional **reseller or agent** programme for regions HLTS doesn't cover directly. Resellers get the onboarding kit but never the licence signing key.

### 7.8 Legal and compliance
- EULA and customer agreement (licence terms, support levels, liability).
- **Nigeria Data Protection Act 2023:** each school is the data controller, and student data stays on its own machines. HLTS only sees data a school sends in a diagnostics bundle, covered by a data processing agreement.
- Register "HLTS CBT" (or the final product name) as a trademark.
- Code ownership stays with HLTS Limited (developer contracts must assign IP).
- **Code-signing certificate** in the name of HLTS Limited so Windows trusts the installers.

---

## 8. Security

- Database encrypted with SQLCipher. The key is protected with Windows DPAPI on the server machine, and the admin can export a recovery key.
- Answer keys are never sent to clients. Marking runs on the server.
- Exams stay encrypted until release. Each exam's content key is unlocked only at the scheduled start by proctor action.
- Server-to-client traffic: TLS with a self-signed server certificate that clients pin when the PC is first approved, so a rogue machine on the LAN can't pretend to be the server.
- Only approved devices can join an exam (device ID and seat). Browser fallback is off by default.
- Kiosk lockdown on clients (§5.5), with focus loss logged.
- Full audit log of staff actions. Export and backup are restricted to admin and exam officer.
- **Nigeria Data Protection Act 2023:** data stays on the school's own machines, backups are encrypted, and there's a retention setting for answer scripts.

---

## 9. Performance and reliability targets

| Metric | Target |
|---|---|
| Concurrent candidates per server | 300 (mid-range PC, gigabit LAN) |
| Answer saved locally | under 50 ms |
| Answer acknowledged by server | under 500 ms (p95) |
| Data loss on power cut (server on UPS or not) | 0 acknowledged answers. Unacknowledged answers are kept on the client and resent |
| Client resume after PC failure | under 1 minute on a spare PC |
| Objective scores ready | within 1 minute of the last submission |
| Installer size | under 150 MB each (Electron). Under 20 MB if Tauri is chosen |
| Setup time for a 50-PC lab | under 1 hour, including client approval |

---

## 10. Delivery phases

Assumes 2–3 developers, 1 QA/support person, and a named school contact (exam officer). Durations are estimates.

### Phase 0: Foundations (weeks 1–2)
- Create the monorepo and CI (lint, unit tests, Windows build on every commit).
- Electron server and client shells, encrypted SQLite schema with migrations.
- `@hlts/core` item scoring for every type and seeded shuffling, with full unit tests.
- Installer pipeline (electron-builder, NSIS) and code signing set up.
- Licence file format and signature check in `@hlts/core`, so every later feature can check its edition limits.
- **Exit:** signed server and client installers that install, start, and find each other on a LAN.

### Phase 1: Server app (weeks 3–6)
- User accounts and roles, school setup, and student Excel import.
- Question bank with all question types, Excel/Aiken/Word import, review workflow, and `.hltsbank` transfer.
- Exam builder, scheduling, shuffling, scaling, candidate lists, and PIN slips.
- **Exit:** Engreg teachers enter one subject's questions and build a real test.

### Phase 2: Exam delivery (weeks 7–10)
- Client kiosk app, device approval, login, exam screen, and double saving (local + server).
- Server timer, resume on another PC, auto-submit.
- Proctor console with live seat map and all actions.
- Automatic marking, theory marking queue, and score export (Excel/PDF) with answer scripts.
- **Exit:** a 30-candidate test in a real lab, with scores exported into the school's broadsheet.

### Phase 3: Hardening and product features (weeks 11–14)
- Offline licensing in the server app: activation, renewal, transfer, trial, edition limits, grace period, clock rollback detection.
- **HLTS Licence Manager** app for HLTS staff, with the signing key on a hardware token.
- Per-school branding and export template editor.
- Code protection (bytecode, integrity check), EULA at install, client auto-push from server.
- Backup and restore, server migration wizard, diagnostics bundle.
- TLS pinning, exam content encryption and release, audit log screens.
- Browser fallback mode, single-PC mode, optional Windows kiosk-account setup guide.
- Failure drills: pull network cables, cut power to server and clients mid-exam, fill the disk, kill the client process, change PC clocks.
- Load test with 300 simulated clients.
- **Exit:** every failure drill passes with zero lost acknowledged answers.

### Phase 4: Pilots and commercial launch (weeks 15–18)
- Pilot 1: a real mid-term test or mock exam at Engreg, run by school staff with HLTS on standby.
- **Pilot 2: a second school**, installed only with the onboarding kit and remote support, to prove HLTS can onboard schools without developers on site.
- Fix pilot issues, then release v1.0 installers.
- Finish the onboarding kit, training videos, EULA and customer agreement, support process and price list.
- **Exit:** both schools sign off, and HLTS is ready to sell.

**Total: about 18 weeks** (2 weeks more than the single-school plan, for licensing, branding, the Licence Manager and a second pilot).

---

## 11. Testing strategy

| Level | What |
|---|---|
| Unit | `@hlts/core`: scoring per question type, partial credit, scaling, shuffling. Property-based tests that any order of resent answers gives the same final answers |
| Integration | Server API with a temporary database. Client save queue against a server that goes offline and comes back |
| End to end | Playwright driving Electron: install, approve PC, log in, answer, kill client, resume on another PC, submit, export |
| Installer | Clean Windows 10 and 11 virtual machines (including 4 GB RAM clients): install, upgrade from the previous version, uninstall |
| Load | 300 simulated clients against the server on lab-grade hardware |
| Failure drills | Scripted power-cut, network-loss and disk-full scenarios before every release |
| Licensing | Expired, tampered, wrong-machine and clock-rolled-back licences are all refused. Grace period works. Transfer codes can only be used once |
| Acceptance | Pilot exams at two schools with a sample of scripts marked by hand to compare |

---

## 12. Exam-day operations (runbook outline)

1. **Install day (once):** install the server, activate the licence, install clients from USB, approve each PC and assign seats.
2. **T−3 days:** exam officer builds the exam and prints PIN slips. Automatic backup.
3. **T−1 day:** lab check. All clients connect, and the network test passes. UPS charged. Spare PCs ready.
4. **Exam start:** proctor releases the exam. Students log in with PINs. The seat map shows everyone live.
5. **Incident:** if a PC fails, move the student to a spare PC and they resume. If power fails, clients resume when power returns, and give extra time with a logged reason.
6. **End:** auto-submit, then "All submitted" on the console. Scores are marked, the exam officer exports Excel/PDF, and a backup runs automatically.

---

## 13. Later: optional online features

Not in v1. The design leaves room for them:
- **HLTS licence portal:** online activation and renewal (offline activation stays available).
- **Cloud backup:** encrypted backups uploaded when the server has internet.
- **Central question banks:** HLTS distributes question packs (e.g. WAEC/NECO practice) as `.hltsbank` files.
- **Result management module:** CA entry, report cards and positions, built into the server app and reading CBT scores directly from `attempts`.
- **Online results for parents:** a sync of published results to a website, such as the Engreg site's existing Firebase project.

---

## 14. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Power outages during exams | UPS on server and network, every answer saved on client and server, resume on any PC |
| Students escaping the exam screen | Electron kiosk mode, focus-loss logging, optional Windows kiosk account, invigilator seat map |
| Antivirus or SmartScreen blocking installers | Code-signed installers, documented firewall and antivirus exceptions |
| Old or mixed lab PCs | Test on 4 GB Windows 10 machines, 32-bit client build if needed, browser fallback |
| Software piracy | Signed, machine-bound licences, clock rollback detection, licence ID on every export, bytecode protection |
| Licence signing key leaks | Key on a hardware token, limited to named HLTS staff, offline backup, and a key-rotation plan in the next release |
| Support load grows with each school | Onboarding kit, diagnostics bundle, training videos, resellers for regions |
| A school is blocked during exam week | 7-day grace period after expiry, no updates within 24 hours of an exam |
| Server PC failure | Automatic encrypted backups to USB, restore and migrate wizard |
| Teachers slow to enter questions | Excel and Word import, templates, a data-entry sprint before the pilot |
| Electron memory use on old PCs | Measure in Phase 0. Move the client to Tauri if 4 GB PCs struggle |

---

## 15. Open questions for HLTS / Engreg

1. **Windows only**, or are any lab PCs on Linux or older systems (e.g. Windows 7, 32-bit)?
2. How many PCs are in the lab, and is the network wired or Wi-Fi? Which machine would be the server?
3. **Electron or Tauri?** Electron is faster to build; Tauri is lighter on old PCs but needs Rust skills. Who will maintain the code?
4. Which exams go on CBT first: class tests, mid-terms, terminal exams or entrance exams?
5. Should theory questions be answered on screen, or stay on paper?
6. ~~Will HLTS sell this to other schools?~~ **Yes, confirmed.** Still to decide: annual subscription, perpetual licence, or both; edition limits and prices (§7.1); final product name.
7. Where are the questions now (Word files, past papers, nowhere yet)?
8. A sample of the school's broadsheet, so the score export matches it.

---

## 16. Immediate next steps

1. Review this plan and answer §15.
2. Create `hlts-limited/hlts-cbt` and buy a code-signing certificate for HLTS Limited (this can take 1–3 weeks).
3. Pick the product name and start trademark registration. Draft the EULA and customer agreement with a lawyer.
4. Choose a second pilot school.
5. Collect hardware details for Engreg's lab, and borrow one typical lab PC for testing.
6. Collect one subject's questions in the import template and a sample broadsheet for the pilot.
