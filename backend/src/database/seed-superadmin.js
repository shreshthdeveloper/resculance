require('dotenv').config();

const db = require('../config/database');
const { Organization, User } = require('../models');

/**
 * Seed Superadmin organization + user.
 *
 * Reads optional overrides from env (see .env.example):
 * - SUPERADMIN_EMAIL, SUPERADMIN_USERNAME, SUPERADMIN_PASSWORD,
 *   SUPERADMIN_FIRST_NAME, SUPERADMIN_LAST_NAME
 */
async function seedSuperadmin() {
  console.log('🏢 Seeding superadmin organization and user...');

  const orgPayload = {
    name: 'Resulance Admin',
    code: 'SYSTEM',
    type: 'superadmin',
    address: 'System Administration',
    city: 'N/A',
    state: 'N/A',
    country: 'India',
    contact_person: 'System Administrator',
    contact_email: process.env.SUPERADMIN_EMAIL || 'admin@resulance.local',
    contact_phone: '+1234567890',
    status: 'active',
    is_active: true
  };

  let org = await Organization.findOne({ $or: [{ code: orgPayload.code }, { type: 'superadmin' }] });
  if (org) {
    console.log(`⚠️  Superadmin organization already exists: ${org.name} (${org.code}) [${org._id}]`);
  } else {
    org = await Organization.create(orgPayload);
    console.log(`✅ Superadmin organization created: ${org.name} (${org.code}) [${org._id}]`);
  }

  const email = process.env.SUPERADMIN_EMAIL || 'admin@resulance.local';
  const password = process.env.SUPERADMIN_PASSWORD || 'Admin@12345';
  const username = process.env.SUPERADMIN_USERNAME || 'superadmin';

  const existingUser = await User.findOne({ $or: [{ email }, { role: 'superadmin' }] });
  if (existingUser) {
    console.log(`⚠️  Superadmin user already exists: ${existingUser.email} [${existingUser._id}]`);
    return { organizationId: org._id, userId: existingUser._id, existed: true };
  }

  const user = await User.create({
    first_name: process.env.SUPERADMIN_FIRST_NAME || 'Super',
    last_name: process.env.SUPERADMIN_LAST_NAME || 'Admin',
    email,
    username,
    phone: '+1234567890',
    password,
    role: 'superadmin',
    organization_id: org._id,
    status: 'active'
  });

  console.log('✅ Superadmin user created');
  console.log(`   Email:    ${email}`);
  console.log(`   Username: ${username}`);
  console.log(`   Password: ${password}`);
  console.log('⚠️  Please change the password after first login.');

  return { organizationId: org._id, userId: user._id, existed: false };
}

if (require.main === module) {
  (async () => {
    try {
      await db.connect();
      await seedSuperadmin();
      await db.connection.close();
      process.exit(0);
    } catch (err) {
      console.error('❌ Seeding failed:', err);
      process.exit(1);
    }
  })();
}

module.exports = seedSuperadmin;
