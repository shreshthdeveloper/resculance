/* eslint-disable no-console */
require('dotenv').config();

const mysql = require('/Users/shreshth/Projects/distrx/resculance_api/node_modules/mysql2/promise');
const path = require('path');
const fs = require('fs');

// Source MySQL credentials live in the original project's .env so we never duplicate them.
const SOURCE_ENV_PATH = '/Users/shreshth/Projects/distrx/resculance_api/.env';
if (fs.existsSync(SOURCE_ENV_PATH)) {
  require('dotenv').config({ path: SOURCE_ENV_PATH });
}

const db = require('../config/database');
const {
  Organization, User, Ambulance, AmbulanceAssignment, AmbulanceDevice,
  Patient, PatientSession, PatientSessionData, VitalSign, Communication,
  Notification, CollaborationRequest, Partnership, ActivityLog, AuditLog
} = require('../models');
const { mongoose } = require('../config/database');
const { Types } = mongoose;

const WIPE = process.argv.includes('--wipe') || true; // default to wipe per user choice
const NO_WIPE = process.argv.includes('--no-wipe');

// ---------- helpers ----------

/**
 * Wrapper around Model.insertMany that REPORTS partial failures.
 * insertMany({ordered:false}) by default silently drops failing docs; we want loud
 * console output if anything is rejected (e.g. validation errors).
 */
async function insertReporting(Model, docs, label) {
  if (!docs.length) return 0;
  try {
    const inserted = await Model.insertMany(docs, { ordered: false });
    if (inserted.length !== docs.length) {
      console.warn(`  ⚠️  ${label}: only ${inserted.length}/${docs.length} inserted`);
    }
    return inserted.length;
  } catch (err) {
    const writeErrors = err.writeErrors || err.result?.result?.writeErrors || [];
    const insertedCount = err.insertedDocs?.length || 0;
    console.warn(`  ⚠️  ${label}: ${insertedCount}/${docs.length} inserted, ${writeErrors.length} errors`);
    writeErrors.slice(0, 5).forEach((we) => {
      const idx = we.index ?? we.err?.index;
      const op = (idx !== undefined && docs[idx]) ? docs[idx] : null;
      const ident = op ? (op.email || op.code || op.ambulance_code || op.session_code || op.patient_code || op._id) : '?';
      console.warn(`     · index=${idx} ident=${ident}  msg=${we.errmsg || we.err?.message || we.message}`);
    });
    return insertedCount;
  }
}

function toBool(v) {
  if (v === null || v === undefined) return undefined;
  return v === 1 || v === true || v === '1' || v === 'true';
}

function toNum(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : parseFloat(v);
  return Number.isFinite(n) ? n : null;
}

function safeJson(value) {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') return value;
  try { return JSON.parse(value); } catch { return null; }
}

function buildIdMap(rows) {
  const m = new Map();
  for (const r of rows) m.set(r.id, new Types.ObjectId());
  return m;
}

function mapId(idMap, id) {
  if (id === null || id === undefined) return null;
  const mapped = idMap.get(id);
  return mapped || null;
}

// ---------- main ----------

async function run() {
  console.log('🔌 Connecting to source MySQL...');
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT, 10) || 3306,
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    connectTimeout: 15000,
    timezone: '+00:00'
  });
  console.log('   connected to', `${process.env.DB_HOST}/${process.env.DB_NAME}`);

  console.log('🔌 Connecting to target MongoDB...');
  await db.connect();

  if (WIPE && !NO_WIPE) {
    console.log('🧨 Wiping target Mongo collections...');
    const collections = await db.connection.db.collections();
    for (const c of collections) {
      try { await c.drop(); } catch (e) { /* ignore */ }
    }
  }

  const idMaps = {};
  const counts = {};

  // ---------- organizations ----------
  {
    const [rows] = await conn.query(`SELECT * FROM organizations`);
    idMaps.organization = buildIdMap(rows);
    const docs = rows.map((r) => ({
      _id: idMaps.organization.get(r.id),
      name: r.name,
      code: r.code,
      type: r.type,
      address: r.address,
      city: r.city,
      state: r.state,
      country: r.country || 'India',
      pincode: r.pincode,
      contact_person: r.contact_person,
      contact_email: r.contact_email,
      contact_phone: r.contact_phone,
      status: r.status || 'active',
      is_active: toBool(r.is_active) ?? true,
      created_at: r.created_at,
      updated_at: r.updated_at
    }));
    if (docs.length) await insertReporting(Organization, docs, "organizations");
    counts.organizations = docs.length;
    console.log(`  ✅ organizations: ${docs.length}`);
  }

  // ---------- users (pass 1 without created_by, pass 2 to set created_by) ----------
  // We need the user id map first because created_by references users.
  {
    const [rows] = await conn.query(`SELECT * FROM users`);
    idMaps.user = buildIdMap(rows);
    const docs = rows.map((r) => ({
      _id: idMaps.user.get(r.id),
      organization_id: mapId(idMaps.organization, r.organization_id),
      username: r.username,
      email: (r.email || '').toLowerCase(),
      password: r.password, // bcrypt hash already
      role: r.role,
      first_name: r.first_name,
      last_name: r.last_name,
      phone: r.phone,
      status: r.status || 'pending_approval',
      last_login: r.last_login,
      created_by: mapId(idMaps.user, r.created_by),
      profile_image_url: r.profile_image_url,
      created_at: r.created_at,
      updated_at: r.updated_at
    }));
    // insertMany bypasses pre('save'), so the bcrypt hook does NOT re-hash.
    if (docs.length) await insertReporting(User, docs, "users");
    counts.users = docs.length;
    console.log(`  ✅ users: ${docs.length} (passwords preserved as-is)`);
  }

  // ---------- ambulances ----------
  {
    const [rows] = await conn.query(`SELECT * FROM ambulances`);
    idMaps.ambulance = buildIdMap(rows);
    const docs = rows.map((r) => ({
      _id: idMaps.ambulance.get(r.id),
      organization_id: mapId(idMaps.organization, r.organization_id),
      ambulance_code: r.ambulance_code,
      registration_number: r.registration_number,
      vehicle_model: r.vehicle_model,
      vehicle_type: r.vehicle_type,
      status: r.status || 'pending_approval',
      current_location_lat: toNum(r.current_location_lat),
      current_location_lng: toNum(r.current_location_lng),
      current_hospital_id: mapId(idMaps.organization, r.current_hospital_id),
      last_location_update: r.last_location_update,
      approved_by: mapId(idMaps.user, r.approved_by),
      approved_at: r.approved_at,
      created_by: mapId(idMaps.user, r.created_by),
      created_at: r.created_at,
      updated_at: r.updated_at
    }));
    if (docs.length) await insertReporting(Ambulance, docs, "ambulances");
    counts.ambulances = docs.length;
    console.log(`  ✅ ambulances: ${docs.length}`);
  }

  // ---------- ambulance_devices ----------
  {
    const [rows] = await conn.query(`SELECT * FROM ambulance_devices`);
    const docs = rows.map((r) => ({
      _id: new Types.ObjectId(),
      ambulance_id: mapId(idMaps.ambulance, r.ambulance_id),
      device_name: r.device_name,
      device_type: r.device_type,
      device_id: r.device_id,
      device_username: r.device_username,
      device_password: r.device_password,
      device_api: r.device_api,
      jsession: r.jsession,
      manufacturer: r.manufacturer,
      model: r.model,
      status: r.status || 'active',
      last_sync: r.last_sync,
      created_at: r.created_at,
      updated_at: r.updated_at
    })).filter((d) => d.ambulance_id);
    if (docs.length) await insertReporting(AmbulanceDevice, docs, "ambulance_devices");
    counts.ambulance_devices = docs.length;
    console.log(`  ✅ ambulance_devices: ${docs.length}`);
  }

  // ---------- ambulance_assignments ----------
  {
    const [rows] = await conn.query(`SELECT * FROM ambulance_assignments`);
    // Deduplicate on (ambulance_id, user_id, assigning_organization_id) to satisfy the unique index.
    const seen = new Set();
    const docs = [];
    for (const r of rows) {
      const amb = mapId(idMaps.ambulance, r.ambulance_id);
      const usr = mapId(idMaps.user, r.user_id);
      if (!amb || !usr) continue;
      const assigningOrg = mapId(idMaps.organization, r.assigning_organization_id);
      const key = `${amb}_${usr}_${assigningOrg || 'null'}`;
      if (seen.has(key)) continue;
      seen.add(key);
      docs.push({
        _id: new Types.ObjectId(),
        ambulance_id: amb,
        user_id: usr,
        assigning_organization_id: assigningOrg,
        assigned_by: mapId(idMaps.user, r.assigned_by),
        role: r.role,
        assigned_at: r.assigned_at,
        is_active: toBool(r.is_active) ?? true,
        created_at: r.created_at,
        updated_at: r.updated_at
      });
    }
    if (docs.length) await insertReporting(AmbulanceAssignment, docs, "ambulance_assignments");
    counts.ambulance_assignments = docs.length;
    console.log(`  ✅ ambulance_assignments: ${docs.length} (deduped from ${rows.length})`);
  }

  // ---------- patients ----------
  {
    const [rows] = await conn.query(`SELECT * FROM patients`);
    idMaps.patient = buildIdMap(rows);
    const docs = rows.map((r) => ({
      _id: idMaps.patient.get(r.id),
      organization_id: mapId(idMaps.organization, r.organization_id),
      patient_code: r.patient_code,
      first_name: r.first_name,
      last_name: r.last_name,
      age: r.age,
      gender: r.gender,
      blood_group: r.blood_group,
      phone: r.phone,
      contact_phone: r.contact_phone,
      email: r.email,
      address: r.address,
      city: r.city,
      state: r.state,
      country: r.country || 'India',
      pincode: r.pincode,
      emergency_contact_name: r.emergency_contact_name,
      emergency_contact_phone: r.emergency_contact_phone,
      emergency_contact_relation: r.emergency_contact_relation,
      medical_history: r.medical_history,
      allergies: r.allergies,
      current_medications: r.current_medications,
      insurance_provider: r.insurance_provider,
      insurance_number: r.insurance_number,
      created_by: mapId(idMaps.user, r.created_by),
      is_active: toBool(r.is_active) ?? true,
      is_onboarded: toBool(r.is_onboarded) ?? false,
      // current_session_id is patched in pass 2 below (sessions don't exist yet)
      onboarded_at: r.onboarded_at,
      created_at: r.created_at,
      updated_at: r.updated_at
    }));
    if (docs.length) await insertReporting(Patient, docs, "patients");
    counts.patients = docs.length;
    console.log(`  ✅ patients: ${docs.length}`);
  }

  // ---------- patient_sessions ----------
  {
    const [rows] = await conn.query(`SELECT * FROM patient_sessions`);
    idMaps.session = buildIdMap(rows);
    const docs = rows.map((r) => ({
      _id: idMaps.session.get(r.id),
      session_code: r.session_code,
      patient_id: mapId(idMaps.patient, r.patient_id),
      ambulance_id: mapId(idMaps.ambulance, r.ambulance_id),
      organization_id: mapId(idMaps.organization, r.organization_id),
      status: r.status || 'onboarded',
      pickup_location: r.pickup_location,
      pickup_latitude: toNum(r.pickup_latitude),
      pickup_longitude: toNum(r.pickup_longitude),
      destination_hospital_id: mapId(idMaps.organization, r.destination_hospital_id),
      destination_location: r.destination_location,
      destination_latitude: toNum(r.destination_latitude),
      destination_longitude: toNum(r.destination_longitude),
      chief_complaint: r.chief_complaint,
      initial_assessment: r.initial_assessment,
      treatment_notes: r.treatment_notes,
      outcome_status: r.outcome_status,
      onboarded_at: r.onboarded_at,
      offboarded_at: r.offboarded_at,
      onboarded_by: mapId(idMaps.user, r.onboarded_by),
      offboarded_by: mapId(idMaps.user, r.offboarded_by),
      estimated_arrival_time: r.estimated_arrival_time,
      actual_arrival_time: r.actual_arrival_time,
      distance_km: toNum(r.distance_km),
      duration_minutes: r.duration_minutes,
      session_metadata: safeJson(r.session_metadata),
      created_at: r.created_at,
      updated_at: r.updated_at
    })).filter((d) => d.patient_id && d.ambulance_id && d.organization_id && d.onboarded_by);
    if (docs.length) await insertReporting(PatientSession, docs, "patient_sessions");
    counts.patient_sessions = docs.length;
    console.log(`  ✅ patient_sessions: ${docs.length}`);
  }

  // ---------- patients pass 2: patch current_session_id ----------
  {
    const [rows] = await conn.query(`SELECT id, current_session_id FROM patients WHERE current_session_id IS NOT NULL`);
    let n = 0;
    for (const r of rows) {
      const pid = idMaps.patient.get(r.id);
      const sid = idMaps.session.get(r.current_session_id);
      if (pid && sid) {
        await Patient.updateOne({ _id: pid }, { $set: { current_session_id: sid } });
        n++;
      }
    }
    console.log(`  ✅ patients.current_session_id patched on ${n} rows`);
  }

  // ---------- patient_session_data ----------
  {
    const [rows] = await conn.query(`SELECT * FROM patient_session_data`);
    const docs = rows.map((r) => ({
      _id: new Types.ObjectId(),
      session_id: mapId(idMaps.session, r.session_id),
      data_type: r.data_type,
      content: safeJson(r.content) || r.content, // fall back to raw if not JSON
      added_by: mapId(idMaps.user, r.added_by),
      added_at: r.added_at,
      created_at: r.created_at,
      updated_at: r.updated_at
    })).filter((d) => d.session_id && d.added_by);
    if (docs.length) await insertReporting(PatientSessionData, docs, "patient_session_data");
    counts.patient_session_data = docs.length;
    console.log(`  ✅ patient_session_data: ${docs.length}`);
  }

  // ---------- vital_signs ----------
  {
    const [rows] = await conn.query(`SELECT * FROM vital_signs`);
    const docs = rows.map((r) => ({
      _id: new Types.ObjectId(),
      patient_id: mapId(idMaps.patient, r.patient_id),
      session_id: mapId(idMaps.session, r.session_id),
      heart_rate: r.heart_rate,
      blood_pressure_systolic: r.blood_pressure_systolic,
      blood_pressure_diastolic: r.blood_pressure_diastolic,
      temperature: toNum(r.temperature),
      respiratory_rate: r.respiratory_rate,
      oxygen_saturation: r.oxygen_saturation,
      blood_glucose: r.blood_glucose,
      consciousness_level: r.consciousness_level,
      pain_scale: r.pain_scale,
      notes: r.notes,
      recorded_by: mapId(idMaps.user, r.recorded_by),
      recorded_at: r.recorded_at
    })).filter((d) => d.patient_id && d.recorded_by);
    if (docs.length) await insertReporting(VitalSign, docs, "vital_signs");
    counts.vital_signs = docs.length;
    console.log(`  ✅ vital_signs: ${docs.length}`);
  }

  // ---------- communications ----------
  {
    const [rows] = await conn.query(`SELECT * FROM communications`);
    const docs = rows.map((r) => {
      let readByRaw = safeJson(r.read_by);
      if (!Array.isArray(readByRaw)) readByRaw = [];
      const readByMapped = readByRaw
        .map((v) => {
          const intId = typeof v === 'number' ? v : parseInt(v, 10);
          if (!Number.isFinite(intId)) return null;
          return idMaps.user.get(intId);
        })
        .filter(Boolean);
      return {
        _id: new Types.ObjectId(),
        session_id: mapId(idMaps.session, r.session_id),
        sender_id: mapId(idMaps.user, r.sender_id),
        message_type: r.message_type || 'text',
        message: r.message,
        metadata: safeJson(r.metadata),
        read_by: readByMapped,
        created_at: r.created_at,
        updated_at: r.created_at
      };
    }).filter((d) => d.session_id && d.sender_id);
    if (docs.length) await insertReporting(Communication, docs, "communications");
    counts.communications = docs.length;
    console.log(`  ✅ communications: ${docs.length}`);
  }

  // ---------- notifications ----------
  {
    const [rows] = await conn.query(`SELECT * FROM notifications`);
    const docs = rows.map((r) => ({
      _id: new Types.ObjectId(),
      user_id: mapId(idMaps.user, r.user_id),
      type: r.type,
      title: r.title,
      message: r.message,
      data: safeJson(r.data),
      is_read: toBool(r.is_read) ?? false,
      read_at: r.read_at,
      created_at: r.created_at
    })).filter((d) => d.user_id);
    if (docs.length) await insertReporting(Notification, docs, "notifications");
    counts.notifications = docs.length;
    console.log(`  ✅ notifications: ${docs.length}`);
  }

  // ---------- collaboration_requests ----------
  {
    const [rows] = await conn.query(`SELECT * FROM collaboration_requests`);
    const docs = rows.map((r) => ({
      _id: new Types.ObjectId(),
      hospital_id: mapId(idMaps.organization, r.hospital_id),
      fleet_id: mapId(idMaps.organization, r.fleet_id),
      request_type: r.request_type || 'partnership',
      status: r.status || 'pending',
      message: r.message,
      terms: r.terms,
      requested_by: mapId(idMaps.user, r.requested_by),
      approved_by: mapId(idMaps.user, r.approved_by),
      approved_at: r.approved_at,
      rejected_reason: r.rejected_reason,
      created_at: r.created_at,
      updated_at: r.updated_at
    })).filter((d) => d.hospital_id && d.fleet_id && d.requested_by);
    if (docs.length) await insertReporting(CollaborationRequest, docs, "collaboration_requests");
    counts.collaboration_requests = docs.length;
    console.log(`  ✅ collaboration_requests: ${docs.length}`);
  }

  // ---------- partnerships ----------
  {
    const [rows] = await conn.query(`SELECT * FROM partnerships`);
    const seen = new Set();
    const docs = [];
    for (const r of rows) {
      const f = mapId(idMaps.organization, r.fleet_id);
      const h = mapId(idMaps.organization, r.hospital_id);
      if (!f || !h) continue;
      const key = `${f}_${h}`;
      if (seen.has(key)) continue;
      seen.add(key);
      docs.push({
        _id: new Types.ObjectId(),
        fleet_id: f,
        hospital_id: h,
        status: r.status || 'active',
        duration_months: r.duration_months,
        start_date: r.start_date,
        end_date: r.end_date,
        created_by: mapId(idMaps.user, r.created_by),
        created_at: r.created_at,
        updated_at: r.updated_at
      });
    }
    if (docs.length) await insertReporting(Partnership, docs, "partnerships");
    counts.partnerships = docs.length;
    console.log(`  ✅ partnerships: ${docs.length} (deduped from ${rows.length})`);
  }

  // ---------- activity_logs ----------
  {
    const [rows] = await conn.query(`SELECT * FROM activity_logs`);
    const docs = rows.map((r) => ({
      _id: new Types.ObjectId(),
      activity: r.activity,
      comments: r.comments,
      user_id: mapId(idMaps.user, r.user_id),
      user_name: r.user_name || 'Unknown',
      organization_id: mapId(idMaps.organization, r.organization_id),
      organization_name: r.organization_name,
      metadata: safeJson(r.metadata),
      ip_address: r.ip_address,
      user_agent: r.user_agent,
      created_at: r.created_at
    })).filter((d) => d.user_id);
    if (docs.length) await insertReporting(ActivityLog, docs, "activity_logs");
    counts.activity_logs = docs.length;
    console.log(`  ✅ activity_logs: ${docs.length}`);
  }

  // ---------- audit_logs ----------
  {
    const [rows] = await conn.query(`SELECT * FROM audit_logs`);
    const docs = rows.map((r) => ({
      _id: new Types.ObjectId(),
      user_id: mapId(idMaps.user, r.user_id),
      action: r.action,
      entity_type: r.entity_type,
      entity_id: null, // original int id won't map cleanly across all entity types; store null
      old_values: safeJson(r.old_values),
      new_values: safeJson(r.new_values),
      ip_address: r.ip_address,
      user_agent: r.user_agent,
      created_at: r.created_at
    }));
    if (docs.length) await insertReporting(AuditLog, docs, "audit_logs");
    counts.audit_logs = docs.length;
    console.log(`  ✅ audit_logs: ${docs.length}`);
  }

  // ---------- heal: backfill missing partnerships for approved collab requests ----------
  // Some approved CollaborationRequests in production never got a matching Partnership row
  // (or the partnership got later marked inactive). Without an active Partnership the
  // hospital/fleet UIs show 0 partnered ambulances even though the collab is approved.
  // Backfill so the migrated dataset is internally consistent.
  {
    const approved = await CollaborationRequest.find({ status: 'approved' }).lean();
    let created = 0;
    let activated = 0;
    for (const c of approved) {
      const existing = await Partnership.findOne({ fleet_id: c.fleet_id, hospital_id: c.hospital_id });
      if (!existing) {
        await Partnership.create({
          fleet_id: c.fleet_id,
          hospital_id: c.hospital_id,
          status: 'active',
          created_by: c.approved_by || c.requested_by,
          created_at: c.approved_at || c.created_at
        });
        created++;
      } else if (existing.status !== 'active') {
        existing.status = 'active';
        await existing.save();
        activated++;
      }
    }
    console.log(`  ♻️  partnerships healed: created=${created}, reactivated=${activated}`);
  }

  await conn.end();
  await db.connection.close();

  console.log('\n📊 Final counts:');
  Object.entries(counts).forEach(([k, v]) => console.log(`  ${k.padEnd(28)} ${v}`));
  console.log('\n✅ Migration complete.');
}

if (require.main === module) {
  run().catch((e) => {
    console.error('❌ Migration failed:', e);
    process.exit(1);
  });
}

module.exports = run;
