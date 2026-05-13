# Resulance — Smart Ambulance Management Platform

A rewrite of the original `resculance_api` project on **Node.js + Express + MongoDB (Mongoose)**, keeping full feature parity with the existing React frontend.

```
resulance/
├── backend/    # Node.js + Express + Mongoose (replaces the MySQL backend)
└── frontend/   # React + Vite (copied from resculance_api/frontend, patched)
```

## Quick start

### 1. Backend

```bash
cd backend
cp .env.example .env                  # already created with dev defaults
# (edit MONGODB_URI / JWT secrets if needed)
npm install
npm run seed                          # creates the SYSTEM org + superadmin only
# OR, for a populated dev environment:
npm run seed:sample                   # adds 2 hospitals, 2 fleets, 11 users, 4 ambulances,
                                      #   4 devices, 2 partnerships, 5 patients, 2 sessions
npm run seed:sample:wipe              # same but drops all collections first
npm run dev                           # http://localhost:5000
```

Default accounts:
- superadmin → `admin@resulance.local` / `Admin@12345`
- everyone else (from `seed:sample`) → `Password@123`
  - Hospital admins: `admin@cityhospital.example`, `admin@greenlife.example`
  - Fleet admins: `admin@swiftmed.example`, `admin@carewheels.example`
  - Doctors / paramedics / staff per org (see seed output for full list)
  - `paramedic.pending@greenlife.example` stays in `pending_approval` so you can exercise the approval flow.

### 2. Frontend

```bash
cd frontend
npm install
npm run dev                           # http://localhost:5173
```

The `.env` file already points to `http://localhost:5000/api/v1`, matching the backend's defaults.

## What changed vs the original `resculance_api`

- **Database**: MySQL → MongoDB (Mongoose 8.x). All 16 collections re-modelled with ObjectId references and indexes.
- **IDs**: all numeric IDs are now MongoDB ObjectId strings (24-char hex).
- **Auth flow**: unchanged — JWT access + refresh, same response shapes.
- **Transactions**: replaced with sequenced operations (MongoDB standalone). Multi-step flows (org deactivation, partnership cancel, etc.) keep the same semantics but no longer roll back on partial failure.
- **Cascade deletes**: replaced with explicit Mongoose updates (no FK constraints in Mongo).
- **Migrations**: dropped — collections are created on first write. Use `npm run db:reset` to drop everything.
- **External device APIs** (`vehicleview.live`): unchanged, still proxied through `/ambulances/devices/...`.
- **Mediasoup SFU**: unchanged, still on the same Socket.IO connection.

## Frontend patches applied

- ID comparisons changed from `Number(a) === Number(b)` / `parseInt(a) === parseInt(b)` to `String(a) === String(b)` so ObjectIds compare correctly.
  - `src/pages/onboarding/Onboarding.jsx`
  - `src/pages/collaborations/Collaborations.jsx`
- Hardcoded file-download URL in `src/pages/sessions/SessionDetail.jsx` now strips `/api/vN` from `VITE_API_URL` so it hits the `/uploads` static route correctly.
- Removed dead files: `OnboardingDetailNew.jsx.backup`, `OnboardingDetailNew_old.jsx`.

## Smoke test results

Verified working end-to-end against the seeded sample data:
- Login as superadmin / hospital admin / fleet admin / fleet paramedic / carewheels paramedic — all succeed
- Login as `pending_approval` user — correctly rejected with 403
- `GET /ambulances` for hospital admin → 0 (own org has no ambulances)
- `GET /ambulances?partnered=true` for hospital admin → 2 partnered fleet ambulances
- `GET /ambulances/my-ambulances` for assigned paramedic → 1 ambulance
- `GET /collaborations` for hospital admin → only their requests (correctly scoped)
- `GET /dashboard/stats` for superadmin → `{ totalOrganizations: 5, totalHospitals: 2, totalFleets: 2, totalUsers: 12, totalAmbulances: 3, activeTrips: 1, totalPatients: 5, totalCollaborations: 2 }`
- Hospital admin onboards patient onto partnered fleet ambulance → session created
- Cross-org messaging (greenlife doctor → carewheels-staffed session) → works
- Offboard session → metadata snapshot captured (crew, vitals, locations, duration), ambulance released to `available`, patient marked offboarded
- Mediasoup worker initializes on startup
- Socket.IO connection authenticates via JWT in handshake

## Migrating real production data from MySQL

`migrate-from-mysql.js` reads from the legacy MySQL DB and copies everything into Mongo with proper FK → ObjectId mapping:

```bash
cd backend
npm run migrate:mysql       # uses resculance_api/.env for MySQL creds, wipes Mongo first
```

What it does:
- Builds an `int_id → ObjectId` map per table, so all foreign keys land correctly.
- Parses JSON columns (`session_metadata`, `communications.metadata` & `read_by`, `notifications.data`, `patient_session_data.content`, `activity_logs.metadata`, `audit_logs.old_values` / `new_values`).
- Maps user IDs inside `communications.read_by` arrays.
- Uses `insertMany` so the bcrypt `pre('save')` hook does NOT run — production password hashes are preserved verbatim.
- Loud reporting on partial failures (any rejected docs print row identifier + error).
- Heals approved CollaborationRequests that are missing matching active Partnerships (production had 7 such inconsistencies; healing creates 2 + reactivates 5).

After migrating, only the production users' real passwords can log in. If you need a known test password on the superadmin, run:

```bash
node -e "const b=require('bcryptjs');const d=require('./src/config/database');const {User}=require('./src/models');(async()=>{await d.connect();await User.updateOne({email:'superadmin@resculance.com'},{\$set:{password:await b.hash('Test@12345',10)}});await d.connection.close();})();"
```

## Bugs found and fixed during audit

- **`populateAmbulance` / `populateRequest` were mistakenly `async`** — wrapped the Mongoose `Query` in a `Promise`, so any subsequent `.lean()` call failed with `TypeError: ... .lean is not a function`. Removed `async`. Affected: most `GET /ambulances` and `GET /collaborations` reads.
- **`User.last_name: required` rejected real production users** — 26 of 77 production users had empty `last_name` and Mongoose `required: true` rejects empty strings, so they were silently dropped on first migration. Schema now has `last_name: { type: String, default: '' }`. Matches what the original validator middleware did (`lastName` was already optional there).
- **Migration's `insertMany({ordered:false})` was silently swallowing partial failures** — added a `insertReporting()` wrapper that prints row identifier + error for any rejected doc.
- **Production data inconsistency: 7 approved collab requests had no active partnership** — frontend `Ambulances?partnered=true` and `partnerships/my` returned 0 for affected hospitals. Migration now heals them automatically.
- **Camera stream URL had `/808gps/` duplicated** (also a bug in the original `resculance_api`). `apiBase` defaults to `https://vehicleview.live/808gps`, but the backend then appended `/808gps/open/player/video.html` producing `.../808gps/808gps/open/...` (a 404). Fixed in `ambulanceDeviceController.getDeviceData` (CAMERA branch) and `ambulanceDeviceController.authenticate`. Now matches the frontend `cameraService` URL exactly.
- **`ambulanceDeviceController.authenticate` rejected devices without `device_api`** even though the other endpoints fall back to the default base. Made it consistent — now falls back to `https://vehicleview.live/808gps`.
- **Hospital dashboards showed all zeros** because the original SQL counted patients/trips via *ambulances owned by the hospital* — but hospitals don't own ambulances. Reworked `DashboardController.getStats`:
  - hospitals now see (a) their own patients via `Patient.organization_id`, (b) active trips where they own the session or are the destination, (c) own + partnered fleet ambulances
  - fleet owners keep the original behaviour (count via their own ambulances)
  - superadmin unchanged

## Useful scripts

```bash
# in backend/
npm run dev                # nodemon
npm run start              # production
npm run seed               # idempotent superadmin seed
npm run seed:sample        # idempotent sample data on top
npm run seed:sample:wipe   # drop all collections, then seed sample data
npm run migrate:mysql      # wipe + migrate real data from production MySQL (creds in resculance_api/.env)
npm run db:reset           # drop all collections (DANGEROUS)
```
