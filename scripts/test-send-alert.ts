/**
 * Test script to send a dummy alert
 * Sends a test energy alert to whoever has chatted with the bot
 */

import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const FIREBASE_DB_URL = process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL;

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

async function testSendAlert() {
  console.log('🧪 Testing Dummy Energy Alert...\n');

  if (!TELEGRAM_BOT_TOKEN) {
    console.error('❌ Error: TELEGRAM_BOT_TOKEN is not set in .env.local');
    process.exit(1);
  }

  if (!FIREBASE_DB_URL) {
    console.error('❌ Error: NEXT_PUBLIC_FIREBASE_DATABASE_URL is not set in .env.local');
    process.exit(1);
  }

  try {
    // Get all active Telegram chat IDs
    console.log('📋 Getting active Telegram chats from Firebase...');
    const activeChats = await getFirebaseData('/telegram/active_chats');

    if (!activeChats) {
      console.log('   ⚠️  No active Telegram chats registered');
      console.log('\n💡 Tip: Run test-telegram-discovery script first!');
      return;
    }

    const chatIds = Object.keys(activeChats).map((id) => parseInt(id, 10));
    console.log(`   ✅ Found ${chatIds.length} active chat(s): ${chatIds.join(', ')}\n`);

    // Send dummy alert to all chats
    console.log('📤 Sending dummy energy alert to all registered chats...\n');

    const dummyData = {
      deviceName: 'Living Room AC (TEST)',
      currentEnergy: 1250.50,
      limit: 1000.00,
    };

    let successCount = 0;

    for (const chatId of chatIds) {
      console.log(`   📱 Sending to chat ${chatId}...`);

      const sent = await sendEnergyAlert(
        chatId,
        dummyData.deviceName,
        dummyData.currentEnergy,
        dummyData.limit
      );

      if (sent) {
        console.log(`      ✅ Sent successfully!`);
        successCount++;
      } else {
        console.log(`      ❌ Failed to send`);
      }
    }

    console.log('\n' + '='.repeat(50));
    console.log('✅ TEST COMPLETED');
    console.log('='.repeat(50));
    console.log(`📊 Total chats: ${chatIds.length}`);
    console.log(`📊 Alerts sent: ${successCount}`);
    console.log('='.repeat(50));
    console.log('\n💡 Check your Telegram to see the alert message!');
  } catch (error) {
    console.error('\n❌ Error during test:', error);
    process.exit(1);
  }
}

// Run the test
testSendAlert()
  .then(() => {
    console.log('\n✅ Test completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  });
