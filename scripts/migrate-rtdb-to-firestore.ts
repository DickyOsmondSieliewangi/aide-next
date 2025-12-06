/**
 * RTDB to Firestore Migration Script
 *
 * This script migrates all data from Firebase Realtime Database to Firestore
 * with the following transformations:
 * - users -> user-data
 * - devices -> item-data
 * - user_ids map -> user_ids array
 * - readings_daily -> item-data/{id}/daily subcollection
 * - Remove weekly/yearly readings
 */

import * as admin from 'firebase-admin';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

// Initialize Firebase Admin
// You need to download the service account JSON from Firebase Console
// and place it in the root directory
const serviceAccount = require('../firebase-service-account.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
});

const rtdb = admin.database();
const firestore = admin.firestore();

interface RTDBDevice {
  name: string;
  isOn: boolean;
  energyLimit: number;
  last_updated: any;
  user_ids?: Record<string, boolean>;
}

interface RTDBUser {
  email: string;
  username: string;
  devices?: Record<string, string>;
}

interface Reading {
  power: number;
  voltage: number;
  current: number;
  frequency: number;
  power_factor: number;
  energy: number;
}

async function migrateUsers() {
  console.log('\n=== Migrating Users ===');

  const usersSnapshot = await rtdb.ref('users').once('value');
  const users = usersSnapshot.val() || {};

  let migratedCount = 0;
  let errorCount = 0;

  for (const [userId, userData] of Object.entries(users)) {
    const user = userData as RTDBUser;

    try {
      await firestore.collection('user-data').doc(userId).set({
        email: user.email,
        username: user.username,
        devices: user.devices || {},
      });

      migratedCount++;
      console.log(`✓ Migrated user ${userId} (${user.email})`);
    } catch (error) {
      errorCount++;
      console.error(`✗ Error migrating user ${userId}:`, error);
    }
  }

  console.log(`\nUsers Migration Complete:`);
  console.log(`  Success: ${migratedCount}`);
  console.log(`  Errors: ${errorCount}`);

  return { migratedCount, errorCount };
}

async function migrateDevices() {
  console.log('\n=== Migrating Devices ===');

  const devicesSnapshot = await rtdb.ref('devices').once('value');
  const devices = devicesSnapshot.val() || {};

  let migratedCount = 0;
  let errorCount = 0;

  for (const [deviceId, deviceData] of Object.entries(devices)) {
    const device = deviceData as RTDBDevice;

    try {
      // Convert user_ids map to array
      const userIdsArray: string[] = device.user_ids
        ? Object.keys(device.user_ids).filter(id => id) // Remove empty strings
        : [];

      await firestore.collection('item-data').doc(deviceId).set({
        name: device.name,
        isOn: device.isOn !== undefined ? device.isOn : true,
        energyLimit: device.energyLimit || 0,
        last_updated: device.last_updated || admin.firestore.FieldValue.serverTimestamp(),
        user_ids: userIdsArray,
      });

      migratedCount++;
      console.log(`✓ Migrated device ${deviceId} (${device.name}) - ${userIdsArray.length} users`);
    } catch (error) {
      errorCount++;
      console.error(`✗ Error migrating device ${deviceId}:`, error);
    }
  }

  console.log(`\nDevices Migration Complete:`);
  console.log(`  Success: ${migratedCount}`);
  console.log(`  Errors: ${errorCount}`);

  return { migratedCount, errorCount };
}

async function migrateDailyReadings() {
  console.log('\n=== Migrating Daily Readings ===');

  const readingsSnapshot = await rtdb.ref('readings_daily').once('value');
  const devices = readingsSnapshot.val() || {};

  let totalReadings = 0;
  let totalDevices = 0;
  let errorCount = 0;

  for (const [deviceId, readings] of Object.entries(devices)) {
    const readingsMap = readings as Record<string, Reading>;

    console.log(`\nMigrating readings for device ${deviceId}...`);

    const batch = firestore.batch();
    let batchCount = 0;
    let deviceReadingCount = 0;

    for (const [timestamp, reading] of Object.entries(readingsMap)) {
      // Skip empty readings
      if (!reading || Object.keys(reading).length === 0) {
        continue;
      }

      const dailyDocRef = firestore
        .collection('item-data')
        .doc(deviceId)
        .collection('daily')
        .doc(timestamp);

      batch.set(dailyDocRef, {
        current: reading.current || 0,
        energy: reading.energy || 0,
        frequency: reading.frequency || 0,
        power: reading.power || 0,
        power_factor: reading.power_factor || 0,
        voltage: reading.voltage || 0,
      });

      batchCount++;
      deviceReadingCount++;

      // Commit batch every 500 writes (Firestore limit)
      if (batchCount >= 500) {
        try {
          await batch.commit();
          console.log(`  ✓ Committed batch of ${batchCount} readings`);
          batchCount = 0;
        } catch (error) {
          errorCount++;
          console.error(`  ✗ Error committing batch:`, error);
        }
      }
    }

    // Commit remaining
    if (batchCount > 0) {
      try {
        await batch.commit();
        console.log(`  ✓ Committed final batch of ${batchCount} readings`);
      } catch (error) {
        errorCount++;
        console.error(`  ✗ Error committing final batch:`, error);
      }
    }

    totalReadings += deviceReadingCount;
    totalDevices++;
    console.log(`  Total for ${deviceId}: ${deviceReadingCount} readings`);
  }

  console.log(`\nDaily Readings Migration Complete:`);
  console.log(`  Devices processed: ${totalDevices}`);
  console.log(`  Total readings migrated: ${totalReadings}`);
  console.log(`  Errors: ${errorCount}`);

  return { totalReadings, totalDevices, errorCount };
}

async function migrateTelegramData() {
  console.log('\n=== Migrating Telegram Data ===');

  try {
    const chatsSnapshot = await rtdb.ref('telegram/active_chats').once('value');
    const chats = chatsSnapshot.val() || {};

    const lastUpdateIdSnapshot = await rtdb.ref('telegram/last_update_id').once('value');
    const lastUpdateId = lastUpdateIdSnapshot.val() || 0;

    await firestore.collection('telegram').doc('active_chats').set({
      chats: chats,
      last_update_id: lastUpdateId,
    });

    console.log(`✓ Migrated ${Object.keys(chats).length} Telegram chats`);
    console.log(`✓ Last update ID: ${lastUpdateId}`);

    return { chatCount: Object.keys(chats).length };
  } catch (error) {
    console.error('✗ Error migrating Telegram data:', error);
    return { chatCount: 0, error };
  }
}

async function validateMigration() {
  console.log('\n=== Validating Migration ===');

  // Count users
  const rtdbUsersSnapshot = await rtdb.ref('users').once('value');
  const rtdbUsersCount = Object.keys(rtdbUsersSnapshot.val() || {}).length;

  const firestoreUsersSnapshot = await firestore.collection('user-data').get();
  const firestoreUsersCount = firestoreUsersSnapshot.size;

  console.log(`Users: RTDB=${rtdbUsersCount}, Firestore=${firestoreUsersCount} ${rtdbUsersCount === firestoreUsersCount ? '✓' : '✗'}`);

  // Count devices
  const rtdbDevicesSnapshot = await rtdb.ref('devices').once('value');
  const rtdbDevicesCount = Object.keys(rtdbDevicesSnapshot.val() || {}).length;

  const firestoreDevicesSnapshot = await firestore.collection('item-data').get();
  const firestoreDevicesCount = firestoreDevicesSnapshot.size;

  console.log(`Devices: RTDB=${rtdbDevicesCount}, Firestore=${firestoreDevicesCount} ${rtdbDevicesCount === firestoreDevicesCount ? '✓' : '✗'}`);

  // Sample check: Verify first device's readings
  const rtdbDevices = rtdbDevicesSnapshot.val() || {};
  const firstDeviceId = Object.keys(rtdbDevices)[0];

  if (firstDeviceId) {
    const rtdbReadingsSnapshot = await rtdb.ref(`readings_daily/${firstDeviceId}`).once('value');
    const rtdbReadingsCount = Object.keys(rtdbReadingsSnapshot.val() || {}).length;

    const firestoreDailySnapshot = await firestore
      .collection('item-data')
      .doc(firstDeviceId)
      .collection('daily')
      .get();
    const firestoreReadingsCount = firestoreDailySnapshot.size;

    console.log(`Sample device ${firstDeviceId} readings: RTDB=${rtdbReadingsCount}, Firestore=${firestoreReadingsCount} ${rtdbReadingsCount === firestoreReadingsCount ? '✓' : '✗'}`);
  }

  const isValid = rtdbUsersCount === firestoreUsersCount && rtdbDevicesCount === firestoreDevicesCount;

  if (isValid) {
    console.log('\n✓ Validation PASSED - All counts match!');
  } else {
    console.log('\n✗ Validation FAILED - Counts do not match!');
  }

  return isValid;
}

async function migrate() {
  console.log('╔════════════════════════════════════════════════╗');
  console.log('║  RTDB to Firestore Migration Script          ║');
  console.log('╚════════════════════════════════════════════════╝');

  const startTime = Date.now();

  try {
    // Run migrations
    const usersResult = await migrateUsers();
    const devicesResult = await migrateDevices();
    const readingsResult = await migrateDailyReadings();
    const telegramResult = await migrateTelegramData();

    // Validate
    const isValid = await validateMigration();

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log('\n╔════════════════════════════════════════════════╗');
    console.log('║  Migration Summary                            ║');
    console.log('╚════════════════════════════════════════════════╝');
    console.log(`Duration: ${duration}s`);
    console.log(`Users migrated: ${usersResult.migratedCount}`);
    console.log(`Devices migrated: ${devicesResult.migratedCount}`);
    console.log(`Readings migrated: ${readingsResult.totalReadings}`);
    console.log(`Telegram chats migrated: ${telegramResult.chatCount}`);
    console.log(`Validation: ${isValid ? '✓ PASSED' : '✗ FAILED'}`);

    if (isValid) {
      console.log('\n✓ Migration completed successfully!');
      console.log('\nNext steps:');
      console.log('1. Deploy code changes');
      console.log('2. Deploy Firestore indexes: firebase deploy --only firestore:indexes');
      console.log('3. Deploy security rules: firebase deploy --only firestore:rules');
      console.log('4. Test the application thoroughly');
      console.log('5. Keep RTDB as backup for 7 days before disabling');
    } else {
      console.log('\n✗ Migration completed with errors. Please review the logs.');
    }

    process.exit(isValid ? 0 : 1);
  } catch (error) {
    console.error('\n✗ Migration failed with critical error:', error);
    process.exit(1);
  }
}

// Run migration
migrate();
