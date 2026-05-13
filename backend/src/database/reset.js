require('dotenv').config();

const db = require('../config/database');
require('../models'); // register all schemas

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

async function reset() {
  await db.connect();
  console.log('🗑  Dropping all collections...');
  for (const name of COLLECTIONS) {
    try {
      await db.connection.collection(name).drop();
      console.log(`  - dropped ${name}`);
    } catch (e) {
      if (e.codeName === 'NamespaceNotFound' || e.code === 26) {
        console.log(`  - skip ${name} (does not exist)`);
      } else {
        console.error(`  - failed to drop ${name}:`, e.message);
      }
    }
  }
  await db.connection.close();
  console.log('✅ Reset complete');
}

if (require.main === module) {
  reset()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('❌ Reset failed:', err);
      process.exit(1);
    });
}

module.exports = reset;
