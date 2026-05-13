require('dotenv').config();

const db = require('../config/database');
const {
  Organization,
  User,
  Ambulance,
  AmbulanceAssignment,
  AmbulanceDevice,
  Partnership,
  CollaborationRequest,
  Patient,
  PatientSession,
  PatientSessionData,
  VitalSign,
  Communication,
  Notification,
  ActivityLog
} = require('../models');
const seedSuperadmin = require('./seed-superadmin');
const { generateCode } = require('../utils/codes');

/**
 * Comprehensive sample-data seeder.
 *
 * Creates a realistic ecosystem on top of the SYSTEM org + superadmin:
 *   - 2 hospitals + 2 fleet owners
 *   - admins, doctors, paramedics, staff per org
 *   - ambulances per fleet (with devices)
 *   - partnerships between hospitals and fleets
 *   - patients owned by the hospitals
 *   - 1 completed (offboarded) session + 1 active session
 *   - vital signs and a few messages on the active session
 *   - notifications for relevant users
 *   - activity log entries
 *
 * Idempotent: re-running skips anything that already exists (by unique code/email).
 *
 * `node src/database/seed-sample-data.js [--wipe]` — pass --wipe to drop all
 * collections first.
 */

const WIPE = process.argv.includes('--wipe');

const SHARED_PASSWORD = 'Password@123';

// ---------- helpers ----------

async function getOrCreateOrg(payload) {
  const existing = await Organization.findOne({ code: payload.code });
  if (existing) return existing;
  return Organization.create(payload);
}

async function getOrCreateUser(payload) {
  const existing = await User.findOne({ email: payload.email.toLowerCase() });
  if (existing) return existing;
  // User.create triggers the pre('save') bcrypt hook
  return User.create(payload);
}

async function getOrCreateAmbulance(payload) {
  const existing = await Ambulance.findOne({ registration_number: payload.registration_number });
  if (existing) return existing;
  return Ambulance.create(payload);
}

async function getOrCreateDevice(payload) {
  const existing = await AmbulanceDevice.findOne({
    ambulance_id: payload.ambulance_id,
    device_id: payload.device_id
  });
  if (existing) return existing;
  return AmbulanceDevice.create(payload);
}

async function ensureAssignment({ ambulance_id, user_id, assigning_organization_id, assigned_by, role }) {
  return AmbulanceAssignment.findOneAndUpdate(
    { ambulance_id, user_id, assigning_organization_id: assigning_organization_id || null },
    {
      ambulance_id,
      user_id,
      assigning_organization_id: assigning_organization_id || null,
      assigned_by,
      role,
      is_active: true,
      assigned_at: new Date()
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

async function ensurePartnership(fleetId, hospitalId, createdBy) {
  return Partnership.findOneAndUpdate(
    { fleet_id: fleetId, hospital_id: hospitalId },
    {
      $setOnInsert: { fleet_id: fleetId, hospital_id: hospitalId, created_by: createdBy },
      $set: { status: 'active' }
    },
    { upsert: true, new: true }
  );
}

async function getOrCreatePatient(payload) {
  const existing = await Patient.findOne({ patient_code: payload.patient_code });
  if (existing) return existing;
  return Patient.create(payload);
}

// ---------- main ----------

async function seed() {
  await db.connect();

  if (WIPE) {
    console.log('🧨 --wipe flag passed; dropping all collections first...');
    const reset = require('./reset');
    // reset() opens its own connection — but we already have one. Use connection directly.
    const collections = await db.connection.db.collections();
    for (const c of collections) {
      try { await c.drop(); } catch (e) {}
    }
    console.log('   done');
  }

  // 1. Make sure SYSTEM org + superadmin exist
  console.log('\n👤 Ensuring superadmin...');
  const { userId: superadminId } = await seedSuperadmin();

  // 2. Hospitals
  console.log('\n🏥 Seeding hospitals...');
  const cityHospital = await getOrCreateOrg({
    name: 'City General Hospital',
    code: 'HOSP-CITY',
    type: 'hospital',
    address: '123 Main Street',
    city: 'Mumbai',
    state: 'Maharashtra',
    country: 'India',
    pincode: '400001',
    contact_person: 'Dr. Anita Sharma',
    contact_email: 'admin@cityhospital.example',
    contact_phone: '+919812345601',
    license_number: 'HOSP-LIC-CITY-001',
    status: 'active',
    is_active: true
  });
  console.log(`  ✅ ${cityHospital.name} (${cityHospital.code}) [${cityHospital._id}]`);

  const greenLifeHospital = await getOrCreateOrg({
    name: 'GreenLife Multispeciality',
    code: 'HOSP-GREEN',
    type: 'hospital',
    address: '8 Park Avenue',
    city: 'Pune',
    state: 'Maharashtra',
    country: 'India',
    pincode: '411001',
    contact_person: 'Dr. Rohit Verma',
    contact_email: 'admin@greenlife.example',
    contact_phone: '+919812345602',
    license_number: 'HOSP-LIC-GREEN-001',
    status: 'active',
    is_active: true
  });
  console.log(`  ✅ ${greenLifeHospital.name} (${greenLifeHospital.code})`);

  // 3. Fleet owners
  console.log('\n🚛 Seeding fleet owners...');
  const swiftFleet = await getOrCreateOrg({
    name: 'SwiftMed Ambulance Services',
    code: 'FLEET-SWIFT',
    type: 'fleet_owner',
    address: 'Sector 17, Industrial Area',
    city: 'Mumbai',
    state: 'Maharashtra',
    country: 'India',
    pincode: '400020',
    contact_person: 'Vikram Patel',
    contact_email: 'ops@swiftmed.example',
    contact_phone: '+919812345610',
    license_number: 'FLEET-LIC-SWIFT-001',
    status: 'active',
    is_active: true
  });
  console.log(`  ✅ ${swiftFleet.name} (${swiftFleet.code})`);

  const careWheelsFleet = await getOrCreateOrg({
    name: 'CareWheels Pvt Ltd',
    code: 'FLEET-CARE',
    type: 'fleet_owner',
    address: '24 East Wing, Tech Park',
    city: 'Pune',
    state: 'Maharashtra',
    country: 'India',
    pincode: '411014',
    contact_person: 'Priya Iyer',
    contact_email: 'contact@carewheels.example',
    contact_phone: '+919812345611',
    license_number: 'FLEET-LIC-CARE-001',
    status: 'active',
    is_active: true
  });
  console.log(`  ✅ ${careWheelsFleet.name} (${careWheelsFleet.code})`);

  // 4. Users per org
  console.log('\n👥 Seeding users...');

  // City Hospital
  const cityAdmin = await getOrCreateUser({
    email: 'admin@cityhospital.example',
    username: 'cityhospital_admin',
    password: SHARED_PASSWORD,
    first_name: 'Anita',
    last_name: 'Sharma',
    phone: '+919812345601',
    role: 'hospital_admin',
    organization_id: cityHospital._id,
    status: 'active',
    created_by: superadminId
  });
  const cityDoctor = await getOrCreateUser({
    email: 'doctor@cityhospital.example',
    username: 'cityhospital_doc',
    password: SHARED_PASSWORD,
    first_name: 'Suresh',
    last_name: 'Iyer',
    phone: '+919812345621',
    role: 'hospital_doctor',
    organization_id: cityHospital._id,
    status: 'active',
    created_by: cityAdmin._id
  });
  const cityParamedic = await getOrCreateUser({
    email: 'paramedic@cityhospital.example',
    username: 'cityhospital_para',
    password: SHARED_PASSWORD,
    first_name: 'Rahul',
    last_name: 'Khanna',
    phone: '+919812345631',
    role: 'hospital_paramedic',
    organization_id: cityHospital._id,
    status: 'active',
    created_by: cityAdmin._id
  });
  const cityStaff = await getOrCreateUser({
    email: 'staff@cityhospital.example',
    username: 'cityhospital_staff',
    password: SHARED_PASSWORD,
    first_name: 'Meena',
    last_name: 'Pillai',
    phone: '+919812345641',
    role: 'hospital_staff',
    organization_id: cityHospital._id,
    status: 'active',
    created_by: cityAdmin._id
  });

  // GreenLife Hospital
  const greenAdmin = await getOrCreateUser({
    email: 'admin@greenlife.example',
    username: 'greenlife_admin',
    password: SHARED_PASSWORD,
    first_name: 'Rohit',
    last_name: 'Verma',
    phone: '+919812345602',
    role: 'hospital_admin',
    organization_id: greenLifeHospital._id,
    status: 'active',
    created_by: superadminId
  });
  const greenDoctor = await getOrCreateUser({
    email: 'doctor@greenlife.example',
    username: 'greenlife_doc',
    password: SHARED_PASSWORD,
    first_name: 'Kavita',
    last_name: 'Rao',
    phone: '+919812345622',
    role: 'hospital_doctor',
    organization_id: greenLifeHospital._id,
    status: 'active',
    created_by: greenAdmin._id
  });
  const greenPendingParamedic = await getOrCreateUser({
    email: 'paramedic.pending@greenlife.example',
    username: 'greenlife_para_pending',
    password: SHARED_PASSWORD,
    first_name: 'Arjun',
    last_name: 'Mehta',
    phone: '+919812345632',
    role: 'hospital_paramedic',
    organization_id: greenLifeHospital._id,
    status: 'pending_approval', // demonstrate the approval flow
    created_by: greenAdmin._id
  });

  // SwiftMed Fleet
  const swiftAdmin = await getOrCreateUser({
    email: 'admin@swiftmed.example',
    username: 'swiftmed_admin',
    password: SHARED_PASSWORD,
    first_name: 'Vikram',
    last_name: 'Patel',
    phone: '+919812345610',
    role: 'fleet_admin',
    organization_id: swiftFleet._id,
    status: 'active',
    created_by: superadminId
  });
  const swiftDoctor = await getOrCreateUser({
    email: 'doctor@swiftmed.example',
    username: 'swiftmed_doc',
    password: SHARED_PASSWORD,
    first_name: 'Sanjay',
    last_name: 'Joshi',
    phone: '+919812345650',
    role: 'fleet_doctor',
    organization_id: swiftFleet._id,
    status: 'active',
    created_by: swiftAdmin._id
  });
  const swiftParamedic = await getOrCreateUser({
    email: 'paramedic@swiftmed.example',
    username: 'swiftmed_para',
    password: SHARED_PASSWORD,
    first_name: 'Deepak',
    last_name: 'Kapoor',
    phone: '+919812345651',
    role: 'fleet_paramedic',
    organization_id: swiftFleet._id,
    status: 'active',
    created_by: swiftAdmin._id
  });

  // CareWheels Fleet
  const careAdmin = await getOrCreateUser({
    email: 'admin@carewheels.example',
    username: 'carewheels_admin',
    password: SHARED_PASSWORD,
    first_name: 'Priya',
    last_name: 'Iyer',
    phone: '+919812345611',
    role: 'fleet_admin',
    organization_id: careWheelsFleet._id,
    status: 'active',
    created_by: superadminId
  });
  const careParamedic = await getOrCreateUser({
    email: 'paramedic@carewheels.example',
    username: 'carewheels_para',
    password: SHARED_PASSWORD,
    first_name: 'Neha',
    last_name: 'Singh',
    phone: '+919812345661',
    role: 'fleet_paramedic',
    organization_id: careWheelsFleet._id,
    status: 'active',
    created_by: careAdmin._id
  });

  console.log('  ✅ created/verified 11 users');

  // 5. Ambulances
  console.log('\n🚑 Seeding ambulances...');
  const swiftAmb1 = await getOrCreateAmbulance({
    organization_id: swiftFleet._id,
    ambulance_code: 'SWIFT-AMB-001',
    registration_number: 'MH-01-AB-1234',
    vehicle_model: 'Force Traveller',
    vehicle_type: 'ALS',
    status: 'available',
    approved_by: superadminId,
    approved_at: new Date(),
    created_by: swiftAdmin._id
  });
  const swiftAmb2 = await getOrCreateAmbulance({
    organization_id: swiftFleet._id,
    ambulance_code: 'SWIFT-AMB-002',
    registration_number: 'MH-01-CD-5678',
    vehicle_model: 'Tata Winger',
    vehicle_type: 'BLS',
    status: 'available',
    approved_by: superadminId,
    approved_at: new Date(),
    created_by: swiftAdmin._id
  });
  const swiftAmbPending = await getOrCreateAmbulance({
    organization_id: swiftFleet._id,
    ambulance_code: 'SWIFT-AMB-003',
    registration_number: 'MH-01-EF-9012',
    vehicle_model: 'Mahindra Cruiso',
    vehicle_type: 'SCU',
    status: 'pending_approval', // demonstrate approval workflow
    created_by: swiftAdmin._id
  });

  const careAmb1 = await getOrCreateAmbulance({
    organization_id: careWheelsFleet._id,
    ambulance_code: 'CARE-AMB-001',
    registration_number: 'MH-12-GH-3456',
    vehicle_model: 'Tata Winger',
    vehicle_type: 'ALS',
    status: 'available',
    approved_by: superadminId,
    approved_at: new Date(),
    created_by: careAdmin._id
  });
  console.log('  ✅ created/verified 4 ambulances');

  // 6. Devices
  console.log('\n📡 Seeding ambulance devices...');
  await getOrCreateDevice({
    ambulance_id: swiftAmb1._id,
    device_name: 'Front Cam',
    device_type: 'CAMERA',
    device_id: 'CAM-SWIFT-001',
    manufacturer: 'Hikvision',
    model: 'DS-2CD',
    status: 'active'
  });
  await getOrCreateDevice({
    ambulance_id: swiftAmb1._id,
    device_name: 'GPS Tracker',
    device_type: 'GPS_TRACKER',
    device_id: 'GPS-SWIFT-001',
    manufacturer: 'Teltonika',
    model: 'FMB920',
    status: 'active'
  });
  await getOrCreateDevice({
    ambulance_id: swiftAmb2._id,
    device_name: 'Vital Monitor',
    device_type: 'VITAL_MONITOR',
    device_id: 'VM-SWIFT-002',
    manufacturer: 'Philips',
    model: 'IntelliVue',
    status: 'active'
  });
  await getOrCreateDevice({
    ambulance_id: careAmb1._id,
    device_name: 'ECG',
    device_type: 'ECG',
    device_id: 'ECG-CARE-001',
    manufacturer: 'GE Healthcare',
    model: 'MAC 2000',
    status: 'active'
  });

  // Cameras with placeholder credentials so the camera-feed modal can be exercised
  // end-to-end in dev. These won't authenticate against the real 808GPS server unless
  // you replace the placeholders with real account credentials.
  await getOrCreateDevice({
    ambulance_id: swiftAmb1._id,
    device_name: 'Patient Bay Camera (with creds)',
    device_type: 'CAMERA',
    device_id: 'DEMO-CAM-SWIFT',
    device_username: 'demo_account',
    device_password: 'demo_password',
    device_api: 'https://vehicleview.live/808gps',
    manufacturer: 'Hikvision',
    model: 'DS-2CD',
    status: 'active'
  });
  await getOrCreateDevice({
    ambulance_id: careAmb1._id,
    device_name: 'Patient Bay Camera',
    device_type: 'CAMERA',
    device_id: 'DEMO-CAM-CARE',
    device_username: 'demo_account',
    device_password: 'demo_password',
    device_api: 'https://vehicleview.live/808gps',
    manufacturer: 'Dahua',
    model: 'IPC-HFW',
    status: 'active'
  });
  console.log('  ✅ created/verified 6 devices (incl. 2 cameras with placeholder creds)');

  // 7. Crew assignments (fleet doctors/paramedics → fleet ambulances)
  console.log('\n🧑‍⚕️ Assigning crew to ambulances...');
  await ensureAssignment({
    ambulance_id: swiftAmb1._id,
    user_id: swiftDoctor._id,
    assigning_organization_id: swiftFleet._id,
    assigned_by: swiftAdmin._id,
    role: 'fleet_doctor'
  });
  await ensureAssignment({
    ambulance_id: swiftAmb1._id,
    user_id: swiftParamedic._id,
    assigning_organization_id: swiftFleet._id,
    assigned_by: swiftAdmin._id,
    role: 'fleet_paramedic'
  });
  await ensureAssignment({
    ambulance_id: careAmb1._id,
    user_id: careParamedic._id,
    assigning_organization_id: careWheelsFleet._id,
    assigned_by: careAdmin._id,
    role: 'fleet_paramedic'
  });
  console.log('  ✅ created/verified 3 assignments');

  // 8. Partnerships (+ collaboration requests for audit trail)
  console.log('\n🤝 Seeding partnerships...');
  await ensurePartnership(swiftFleet._id, cityHospital._id, superadminId);
  await ensurePartnership(careWheelsFleet._id, greenLifeHospital._id, superadminId);

  // Mirror as approved collaboration requests so the Collaborations UI lights up
  await CollaborationRequest.findOneAndUpdate(
    { fleet_id: swiftFleet._id, hospital_id: cityHospital._id },
    {
      $setOnInsert: {
        fleet_id: swiftFleet._id,
        hospital_id: cityHospital._id,
        request_type: 'partnership',
        message: 'Long-term partnership for emergency response',
        terms: '24x7 availability, response within 10 minutes',
        requested_by: cityAdmin._id
      },
      $set: { status: 'approved', approved_by: swiftAdmin._id, approved_at: new Date() }
    },
    { upsert: true, new: true }
  );
  await CollaborationRequest.findOneAndUpdate(
    { fleet_id: careWheelsFleet._id, hospital_id: greenLifeHospital._id },
    {
      $setOnInsert: {
        fleet_id: careWheelsFleet._id,
        hospital_id: greenLifeHospital._id,
        request_type: 'partnership',
        message: 'Emergency response collaboration',
        terms: 'Priority on weekdays 8am-8pm',
        requested_by: greenAdmin._id
      },
      $set: { status: 'approved', approved_by: careAdmin._id, approved_at: new Date() }
    },
    { upsert: true, new: true }
  );

  // A pending request, between SwiftMed and GreenLife (to demonstrate pending state)
  await CollaborationRequest.findOneAndUpdate(
    { fleet_id: swiftFleet._id, hospital_id: greenLifeHospital._id, status: 'pending' },
    {
      $setOnInsert: {
        fleet_id: swiftFleet._id,
        hospital_id: greenLifeHospital._id,
        request_type: 'partnership',
        message: 'Looking to expand coverage to Pune region',
        terms: 'TBD',
        requested_by: swiftAdmin._id,
        status: 'pending'
      }
    },
    { upsert: true, new: true }
  );
  console.log('  ✅ created/verified 2 active partnerships + 1 pending request');

  // 9. Patients (owned by hospitals)
  console.log('\n🧍 Seeding patients...');
  const patient1 = await getOrCreatePatient({
    organization_id: cityHospital._id,
    patient_code: 'PAT-DEMO-001',
    first_name: 'Ramesh',
    last_name: 'Gupta',
    age: 64,
    gender: 'male',
    blood_group: 'B+',
    phone: '+919812340001',
    emergency_contact_name: 'Sunita Gupta',
    emergency_contact_phone: '+919812340002',
    emergency_contact_relation: 'Spouse',
    medical_history: 'Hypertension, Type 2 Diabetes',
    allergies: 'Penicillin',
    current_medications: 'Metformin, Amlodipine',
    created_by: cityAdmin._id,
    is_active: true
  });
  const patient2 = await getOrCreatePatient({
    organization_id: cityHospital._id,
    patient_code: 'PAT-DEMO-002',
    first_name: 'Anjali',
    last_name: 'Desai',
    age: 32,
    gender: 'female',
    blood_group: 'O+',
    phone: '+919812340003',
    emergency_contact_name: 'Karan Desai',
    emergency_contact_phone: '+919812340004',
    emergency_contact_relation: 'Husband',
    medical_history: 'Asthma',
    created_by: cityDoctor._id,
    is_active: true
  });
  const patient3 = await getOrCreatePatient({
    organization_id: greenLifeHospital._id,
    patient_code: 'PAT-DEMO-003',
    first_name: 'Faisal',
    last_name: 'Khan',
    age: 45,
    gender: 'male',
    blood_group: 'A+',
    phone: '+919812340005',
    medical_history: 'Recent cardiac event',
    created_by: greenAdmin._id,
    is_active: true
  });
  await getOrCreatePatient({
    organization_id: greenLifeHospital._id,
    patient_code: 'PAT-DEMO-004',
    first_name: 'Lakshmi',
    last_name: 'Nair',
    age: 28,
    gender: 'female',
    blood_group: 'AB-',
    phone: '+919812340006',
    created_by: greenDoctor._id,
    is_active: true
  });
  await getOrCreatePatient({
    organization_id: cityHospital._id,
    patient_code: 'PAT-DEMO-005',
    first_name: 'Vivek',
    last_name: 'Menon',
    age: 71,
    gender: 'male',
    blood_group: 'O-',
    phone: '+919812340007',
    medical_history: 'COPD',
    created_by: cityAdmin._id,
    is_active: true
  });
  console.log('  ✅ created/verified 5 patients');

  // 10. Sessions: 1 completed (offboarded) + 1 active
  console.log('\n📋 Seeding patient sessions...');

  // Completed session (patient1, swiftAmb2, City -> City)
  let completedSession = await PatientSession.findOne({ session_code: 'SES-DEMO-COMPLETED' });
  if (!completedSession) {
    const onboardedAt = new Date(Date.now() - 1000 * 60 * 60 * 24 * 2); // 2 days ago
    const offboardedAt = new Date(onboardedAt.getTime() + 1000 * 60 * 35); // 35 min later

    completedSession = await PatientSession.create({
      session_code: 'SES-DEMO-COMPLETED',
      patient_id: patient1._id,
      ambulance_id: swiftAmb2._id,
      organization_id: cityHospital._id,
      status: 'offboarded',
      pickup_location: '15 Marine Drive, Mumbai',
      pickup_latitude: 18.9438,
      pickup_longitude: 72.8231,
      destination_hospital_id: cityHospital._id,
      destination_location: cityHospital.address,
      destination_latitude: 19.076,
      destination_longitude: 72.8777,
      chief_complaint: 'Chest pain radiating to left arm',
      initial_assessment: 'Suspected angina; pt awake, mildly hypertensive',
      treatment_notes: 'Aspirin 325mg PO, GTN 0.5mg SL, oxygen via nasal cannula; pt stable on arrival',
      outcome_status: 'stable',
      onboarded_at: onboardedAt,
      offboarded_at: offboardedAt,
      onboarded_by: swiftParamedic._id,
      offboarded_by: cityDoctor._id,
      distance_km: 8.4,
      duration_minutes: 35,
      session_metadata: {
        timeline: {
          onboarded_at: onboardedAt,
          offboarded_at: offboardedAt,
          duration_minutes: 35
        },
        medical: {
          chief_complaint: 'Chest pain radiating to left arm',
          outcome_status: 'stable'
        }
      }
    });
    console.log(`  ✅ completed session: ${completedSession.session_code}`);
  } else {
    console.log(`  ⚠️  completed session already exists: ${completedSession.session_code}`);
  }

  // Active session (patient3, careAmb1, GreenLife)
  let activeSession = await PatientSession.findOne({ session_code: 'SES-DEMO-ACTIVE' });
  if (!activeSession) {
    activeSession = await PatientSession.create({
      session_code: 'SES-DEMO-ACTIVE',
      patient_id: patient3._id,
      ambulance_id: careAmb1._id,
      organization_id: greenLifeHospital._id,
      status: 'in_transit',
      pickup_location: 'Aundh, Pune',
      pickup_latitude: 18.5604,
      pickup_longitude: 73.8077,
      destination_hospital_id: greenLifeHospital._id,
      destination_location: greenLifeHospital.address,
      destination_latitude: 18.5204,
      destination_longitude: 73.8567,
      chief_complaint: 'Acute breathlessness',
      initial_assessment: 'SpO2 89%, tachycardic, pt anxious',
      onboarded_at: new Date(Date.now() - 1000 * 60 * 8), // 8 min ago
      onboarded_by: careParamedic._id
    });

    // mark patient as onboarded, ambulance as active locked to greenlife
    patient3.is_onboarded = true;
    patient3.current_session_id = activeSession._id;
    patient3.onboarded_at = activeSession.onboarded_at;
    await patient3.save();

    careAmb1.status = 'active';
    careAmb1.current_hospital_id = greenLifeHospital._id;
    await careAmb1.save();

    // Vital signs + a sample message
    await VitalSign.create({
      patient_id: patient3._id,
      session_id: activeSession._id,
      heart_rate: 112,
      blood_pressure_systolic: 142,
      blood_pressure_diastolic: 90,
      temperature: 37.2,
      respiratory_rate: 24,
      oxygen_saturation: 89,
      consciousness_level: 'alert',
      pain_scale: 6,
      recorded_by: careParamedic._id,
      recorded_at: new Date(Date.now() - 1000 * 60 * 6)
    });
    await VitalSign.create({
      patient_id: patient3._id,
      session_id: activeSession._id,
      heart_rate: 105,
      blood_pressure_systolic: 138,
      blood_pressure_diastolic: 86,
      temperature: 37.1,
      respiratory_rate: 22,
      oxygen_saturation: 93,
      consciousness_level: 'alert',
      pain_scale: 5,
      recorded_by: careParamedic._id,
      recorded_at: new Date(Date.now() - 1000 * 60 * 2)
    });

    await Communication.create({
      session_id: activeSession._id,
      sender_id: careParamedic._id,
      message_type: 'text',
      message: 'Patient onboarded, en route. ETA 12 minutes.'
    });
    await Communication.create({
      session_id: activeSession._id,
      sender_id: greenDoctor._id,
      message_type: 'text',
      message: 'Prep oxygen and IV access. Ready in trauma bay.'
    });

    await PatientSessionData.create({
      session_id: activeSession._id,
      data_type: 'note',
      content: { text: 'O2 at 6L/min via face mask. SpO2 improving.' },
      added_by: careParamedic._id
    });
    await PatientSessionData.create({
      session_id: activeSession._id,
      data_type: 'medication',
      content: { name: 'Salbutamol', dosage: '5mg', route: 'Nebulized' },
      added_by: careParamedic._id
    });

    console.log(`  ✅ active session: ${activeSession.session_code} (with 2 vitals, 2 messages, 2 data entries)`);
  } else {
    console.log(`  ⚠️  active session already exists: ${activeSession.session_code}`);
  }

  // 11. Some notifications
  console.log('\n🔔 Seeding notifications...');
  await Notification.deleteMany({ user_id: { $in: [cityAdmin._id, swiftAdmin._id, greenAdmin._id] }, type: 'seed_demo' });
  await Notification.insertMany([
    {
      user_id: cityAdmin._id,
      type: 'seed_demo',
      title: 'Welcome to Resulance',
      message: 'Your hospital is partnered with SwiftMed.',
      data: { partnership: 'SWIFT-CITY' },
      is_read: false
    },
    {
      user_id: swiftAdmin._id,
      type: 'seed_demo',
      title: 'New partnership accepted',
      message: 'City General Hospital is now a partner.',
      data: { partnership: 'SWIFT-CITY' },
      is_read: false
    },
    {
      user_id: greenAdmin._id,
      type: 'seed_demo',
      title: 'Pending partnership request',
      message: 'SwiftMed Ambulance Services wants to partner.',
      data: { request_type: 'partnership' },
      is_read: false
    }
  ]);
  console.log('  ✅ 3 demo notifications created');

  // 12. Activity log
  console.log('\n📝 Seeding activity log...');
  await ActivityLog.deleteMany({ activity: 'seed_demo' });
  await ActivityLog.insertMany([
    {
      activity: 'seed_demo',
      comments: 'Sample data seeded',
      user_id: superadminId,
      user_name: 'Super Admin',
      organization_id: null,
      organization_name: null
    }
  ]);
  console.log('  ✅ activity log entry created');

  // 13. Summary
  console.log('\n✅ Seed complete. Summary:');
  console.log('   ───────────────────────────────────────');
  console.log('   Login credentials (all share the same password unless noted):');
  console.log(`   Password: ${SHARED_PASSWORD}`);
  console.log('   ───────────────────────────────────────');
  const accounts = [
    ['superadmin',          'admin@resulance.local',             '(see seed-superadmin output for password)'],
    ['city hospital admin', 'admin@cityhospital.example',        ''],
    ['city hospital doc',   'doctor@cityhospital.example',       ''],
    ['city hospital para',  'paramedic@cityhospital.example',    ''],
    ['city hospital staff', 'staff@cityhospital.example',        ''],
    ['greenlife admin',     'admin@greenlife.example',           ''],
    ['greenlife doctor',    'doctor@greenlife.example',          ''],
    ['greenlife para',      'paramedic.pending@greenlife.example', '(status: pending_approval)'],
    ['swiftmed admin',      'admin@swiftmed.example',            ''],
    ['swiftmed doctor',     'doctor@swiftmed.example',           ''],
    ['swiftmed paramedic',  'paramedic@swiftmed.example',        ''],
    ['carewheels admin',    'admin@carewheels.example',          ''],
    ['carewheels paramedic','paramedic@carewheels.example',      '']
  ];
  accounts.forEach(([label, email, note]) => {
    console.log(`     ${label.padEnd(24)} ${email}${note ? '  ' + note : ''}`);
  });
  console.log('   ───────────────────────────────────────');
}

if (require.main === module) {
  seed()
    .then(async () => {
      await db.connection.close();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error('❌ Seed failed:', err);
      try { await db.connection.close(); } catch {}
      process.exit(1);
    });
}

module.exports = seed;
