require('dotenv').config();

const db = require('../config/database');
require('../models'); // register every schema so collection drops are predictable
const { Organization, User } = require('../models');

/**
 * DESTRUCTIVE: wipe every collection in the database and then seed exactly
 * one superadmin user + the system organization.
 *
 *   Email:    admin@resculance.online
 *   Username: admin
 *   Password: admin@resculance.online
 *
 * Use this when you want a freshly-bootstrapped production database.
 * Everything else — patients, sessions, ambulances, partnerships, logs,
 * notifications, devices — is wiped. There is no undo.
 *
 * Safety: requires `CONFIRM_WIPE=yes` in the environment OR the `--yes`
 * flag on the command line. Without it, the script aborts before touching
 * the DB so an accidental `npm run seed:online` against the wrong env
 * doesn't silently delete a customer's data.
 *
 * Run with:
 *   CONFIRM_WIPE=yes npm run seed:online
 *   # or:
 *   node src/database/seed-superadmin-online.js --yes
 */

const CREDS = {
  email: 'admin@resculance.online',
  username: 'admin',
  password: 'admin@resculance.online',
  firstName: 'Super',
  lastName: 'Admin',
  phone: '+1234567890'
};

// Every collection the app ever writes to. Kept in sync with reset.js.
const COLLECTIONS = [
  'activity_logs',
  'ambulance_assignments',
  'ambulance_devices',
  'ambulance_user_mappings',
  'ambulances',
  'audit_logs',
  'collaboration_requests',
  'communications',
  'notifications',
  'partnerships',
  'patient_session_data',
  'patient_sessions',
  'patients',
  'refresh_tokens',
  'users',
  'vital_signs',
  'organizations'
];

function confirmed() {
  if (process.env.CONFIRM_WIPE === 'yes') return true;
  if (process.argv.includes('--yes') || process.argv.includes('-y')) return true;
  return false;
}

async function wipeAllCollections() {
  console.log('🗑  Dropping all collections from', db.connection.name, '...');
  for (const name of COLLECTIONS) {
    try {
      await db.connection.collection(name).drop();
      console.log(`   - dropped ${name}`);
    } catch (e) {
      // Mongo throws codeName=NamespaceNotFound (code 26) if the collection
      // doesn't exist yet — that's a benign no-op for a first-time seed.
      if (e.codeName === 'NamespaceNotFound' || e.code === 26) {
        console.log(`   - skip ${name} (does not exist)`);
      } else {
        console.error(`   - failed to drop ${name}:`, e.message);
      }
    }
  }
  console.log('✅ Wipe complete');
}

async function seedSuperadmin() {
  console.log('🏢 Seeding superadmin org + user...');

  // Mongoose has the User pre('save') hook that bcrypt-hashes `password`,
  // so we pass plain text here and Mongoose handles the rest.
  const org = await Organization.create({
    name: 'Resculance Admin',
    code: 'SYSTEM',
    type: 'superadmin',
    address: 'System Administration',
    city: 'N/A',
    state: 'N/A',
    country: 'India',
    contact_person: 'System Administrator',
    contact_email: CREDS.email,
    contact_phone: CREDS.phone,
    status: 'active',
    is_active: true
  });
  console.log(`✅ Org created: ${org.name} (${org.code}) [${org._id}]`);

  const user = await User.create({
    first_name: CREDS.firstName,
    last_name: CREDS.lastName,
    email: CREDS.email,
    username: CREDS.username,
    phone: CREDS.phone,
    password: CREDS.password,
    role: 'superadmin',
    organization_id: org._id,
    status: 'active'
  });

  console.log('✅ Superadmin user created');
  console.log(`   Email:    ${CREDS.email}`);
  console.log(`   Username: ${CREDS.username}`);
  console.log(`   Password: ${CREDS.password}`);
  console.log('⚠️  Please rotate this password after first login.');
  return { organizationId: org._id, userId: user._id };
}

async function run() {
  if (!confirmed()) {
    console.error('❌ Refusing to run without explicit confirmation.');
    console.error('   This script DELETES every collection in the database before');
    console.error('   seeding the superadmin. To proceed, set the env var:');
    console.error('       CONFIRM_WIPE=yes npm run seed:online');
    console.error('   …or pass --yes on the command line:');
    console.error('       node src/database/seed-superadmin-online.js --yes');
    process.exit(2);
  }

  await db.connect();
  console.log('🔗 Connected to', db.connection.host + '/' + db.connection.name);

  await wipeAllCollections();
  await seedSuperadmin();

  await db.connection.close();
  console.log('🎉 Done.');
}

if (require.main === module) {
  run()
    .then(() => process.exit(0))
    .catch(async (err) => {
      console.error('❌ Seeding failed:', err);
      try { await db.connection.close(); } catch {}
      process.exit(1);
    });
}

module.exports = run;
