/**
 * Test script for energy alerts
 * Simulates the energy alert cron job to check devices and send notifications
 * No authentication required - uses Firebase REST API directly
 */

import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const FIREBASE_DB_URL = process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL;

interface DeviceData {
  name: string;
  energyLimit: number;
  isOn: boolean;
  user_ids?: Record<string, boolean>;
}

interface ReadingData {
  energy: number;
  timestamp: number;
  voltage: number;
  current: number;
  power: number;
}

/**
 * Send energy alert via Telegram
 */
async function sendEnergyAlert(
  chatId: number,
  deviceName: string,
  currentEnergy: number,
  limit: number
): Promise<boolean> {
  const overBy = currentEnergy - limit;
  const timestamp = new Date().toLocaleString('en-US', {
    timeZone: 'UTC',
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  const message = `
⚠️ <b>Energy Limit Exceeded</b>

Device: <b>${deviceName}</b>
Current: <b>${currentEnergy.toFixed(2)} kWh</b>
Limit: <b>${limit.toFixed(2)} kWh</b>
Over by: <b>${overBy.toFixed(2)} kWh</b>

Time: ${timestamp} UTC

Please check your device to reduce energy consumption.
`.trim();

  try {
    const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML',
      }),
    });

    const data = await response.json();
    return data.ok;
  } catch (error) {
    console.error('Error sending Telegram message:', error);
    return false;
  }
}

/**
 * Get data from Firebase RTDB using REST API
 */
async function getFirebaseData(path: string): Promise<any> {
  const url = `${FIREBASE_DB_URL}${path}.json`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Firebase request failed: ${response.status}`);
  }

  return response.json();
}

async function testEnergyAlerts() {
  console.log('⚡ Starting Energy Alerts Test...\n');

  if (!TELEGRAM_BOT_TOKEN) {
    console.error('❌ Error: TELEGRAM_BOT_TOKEN is not set in .env.local');
    process.exit(1);
  }

  if (!FIREBASE_DB_URL) {
    console.error('❌ Error: NEXT_PUBLIC_FIREBASE_DATABASE_URL is not set in .env.local');
    process.exit(1);
  }

  try {
    // Get all active Telegram chat IDs from Firebase
    console.log('📋 Getting active Telegram chats from Firebase...');
    const activeChats = await getFirebaseData('/telegram/active_chats');

    if (!activeChats) {
      console.log('   ⚠️  No active Telegram chats registered');
      console.log('\n💡 Tip: Run test-telegram-discovery script first to register a chat!');
      return;
    }

    const chatIds = Object.keys(activeChats).map((id) => parseInt(id, 10));
    console.log(`   ✅ Found ${chatIds.length} active chat(s): ${chatIds.join(', ')}\n`);

    // Get all devices from Firebase
    console.log('📋 Getting all devices from Firebase...');
    const devices = await getFirebaseData('/devices');

    if (!devices) {
      console.log('   ⚠️  No devices found in database');
      return;
    }
    const deviceIds = Object.keys(devices);
    console.log(`   ✅ Found ${deviceIds.length} device(s)\n`);

    let devicesChecked = 0;
    let devicesOverLimit = 0;
    let alertsSent = 0;

    // Process each device
    for (const [deviceId, deviceData] of Object.entries(devices)) {
      const device = deviceData as DeviceData;
      devicesChecked++;

      console.log(`\n🔌 Checking device: ${device.name} (${deviceId})`);
      console.log(`   Energy limit: ${device.energyLimit} kWh`);

      // Skip devices without energy limit
      if (!device.energyLimit || device.energyLimit === 0) {
        console.log('   ⏭️  Skipped (no limit set)');
        continue;
      }

      try {
        // Get latest daily reading
        const readings = await getFirebaseData(`/readings_daily/${deviceId}`);

        if (!readings) {
          console.log('   ⏭️  Skipped (no readings found)');
          continue;
        }
        const timestamps = Object.keys(readings).sort((a, b) => parseInt(b) - parseInt(a));

        if (timestamps.length === 0) {
          console.log('   ⏭️  Skipped (no readings available)');
          continue;
        }

        const latestTimestamp = timestamps[0];
        const latestReading = readings[latestTimestamp] as ReadingData;

        console.log(`   Current energy: ${latestReading.energy.toFixed(2)} kWh`);
        console.log(`   Last reading: ${new Date(parseInt(latestTimestamp)).toLocaleString()}`);

        // Check if over limit
        if (latestReading.energy > device.energyLimit) {
          const overBy = latestReading.energy - device.energyLimit;
          console.log(`   ⚠️  OVER LIMIT by ${overBy.toFixed(2)} kWh!`);
          devicesOverLimit++;

          // Get custom device name from user
          let deviceDisplayName = device.name;

          if (device.user_ids) {
            const userIds = Object.keys(device.user_ids);

            if (userIds.length > 0) {
              const userId = userIds[0];
              const userData = await getFirebaseData(`/users/${userId}`);

              if (userData) {
                const customName = userData.devices?.[deviceId];
                if (customName) {
                  deviceDisplayName = customName;
                  console.log(`   📝 Custom name: "${customName}"`);
                }
              }
            }
          }

          // Send alerts to all chat IDs
          console.log(`   📤 Broadcasting alert to ${chatIds.length} chat(s)...`);

          for (const chatId of chatIds) {
            try {
              const sent = await sendEnergyAlert(
                chatId,
                deviceDisplayName,
                latestReading.energy,
                device.energyLimit
              );

              if (sent) {
                console.log(`      ✅ Sent to chat ${chatId}`);
                alertsSent++;
              } else {
                console.log(`      ❌ Failed to send to chat ${chatId}`);
              }
            } catch (error) {
              console.error(`      ❌ Error sending to chat ${chatId}:`, error);
            }
          }
        } else {
          console.log(`   ✅ Within limit`);
        }
      } catch (error) {
        console.error(`   ❌ Error processing device ${deviceId}:`, error);
      }
    }

    console.log('\n' + '='.repeat(50));
    console.log('✅ ENERGY ALERTS TEST COMPLETED');
    console.log('='.repeat(50));
    console.log(`📊 Devices checked: ${devicesChecked}`);
    console.log(`📊 Devices over limit: ${devicesOverLimit}`);
    console.log(`📊 Alerts sent: ${alertsSent}`);
    console.log(`📊 Active chats: ${chatIds.length}`);
    console.log('='.repeat(50));
  } catch (error) {
    console.error('\n❌ Error during energy alerts test:', error);
    process.exit(1);
  }
}

// Run the test
testEnergyAlerts()
  .then(() => {
    console.log('\n✅ Test completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  });
