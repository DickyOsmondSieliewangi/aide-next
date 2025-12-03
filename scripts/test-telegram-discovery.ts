/**
 * Test script for Telegram chat discovery
 * Simulates the discovery cron job to register new Telegram chats
 * No authentication required - uses Firebase REST API directly
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
 * Set data in Firebase RTDB using REST API
 */
async function setFirebaseData(path: string, data: any): Promise<void> {
  const url = `${FIREBASE_DB_URL}${path}.json`;
  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error(`Firebase request failed: ${response.status}`);
  }
}

/**
 * Get Telegram updates
 */
async function getUpdates(offset?: number, timeout: number = 30) {
  try {
    const params = new URLSearchParams({
      timeout: timeout.toString(),
      ...(offset && { offset: offset.toString() }),
    });

    const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getUpdates?${params}`);
    const data = await response.json();

    if (!data.ok) {
      console.error('Failed to get updates:', data.description);
      return null;
    }

    return data.result;
  } catch (error) {
    console.error('Error getting Telegram updates:', error);
    return null;
  }
}

/**
 * Send welcome message
 */
async function sendWelcomeMessage(chatId: number, firstName?: string): Promise<boolean> {
  const greeting = firstName ? `Hi ${firstName}!` : 'Hi there!';

  const message = `
${greeting} 👋

Welcome to <b>AIDE Energy Monitor Bot</b>!

You will receive notifications when any device exceeds its energy limit.

Your chat has been registered for alerts. You'll be notified every 30 minutes about devices that are over their energy limits.

To stop receiving notifications, you can block this bot anytime.
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
    console.error('Error sending welcome message:', error);
    return false;
  }
}

async function testTelegramDiscovery() {
  console.log('🔍 Starting Telegram Chat Discovery Test...\n');

  if (!TELEGRAM_BOT_TOKEN) {
    console.error('❌ Error: TELEGRAM_BOT_TOKEN is not set in .env.local');
    process.exit(1);
  }

  if (!FIREBASE_DB_URL) {
    console.error('❌ Error: NEXT_PUBLIC_FIREBASE_DATABASE_URL is not set in .env.local');
    process.exit(1);
  }

  try {
    // Get last processed update ID
    console.log('📋 Getting last update ID from Firebase...');
    const lastUpdateId = (await getFirebaseData('/telegram/last_update_id')) || 0;
    console.log(`   Last update ID: ${lastUpdateId}`);

    const offset = lastUpdateId > 0 ? lastUpdateId + 1 : undefined;

    // Poll Telegram for new updates
    console.log('\n📥 Polling Telegram for new updates...');
    const updates = await getUpdates(offset, 30);

    if (!updates || updates.length === 0) {
      console.log('   ℹ️  No new updates available');
      console.log('\n💡 Tip: Send a message to @aidenext_bot on Telegram to test!');
      return;
    }

    console.log(`   ✅ Found ${updates.length} update(s)\n`);

    let newChatsCount = 0;
    let latestUpdateId = lastUpdateId;

    // Process each update
    for (const update of updates) {
      console.log(`\n📨 Processing update #${update.update_id}:`);

      // Update the latest update ID
      if (update.update_id > latestUpdateId) {
        latestUpdateId = update.update_id;
      }

      // Skip if no message
      if (!update.message) {
        console.log('   ⏭️  Skipped (no message)');
        continue;
      }

      const message = update.message;
      const chat = message.chat;

      // Only process private chats
      if (chat.type !== 'private') {
        console.log(`   ⏭️  Skipped (${chat.type} chat)`);
        continue;
      }

      const chatId = chat.id;
      const username = chat.username;
      const firstName = chat.first_name;
      const messageText = message.text || '[no text]';

      console.log(`   👤 Chat ID: ${chatId}`);
      console.log(`   👤 Username: @${username || 'none'}`);
      console.log(`   👤 First Name: ${firstName || 'none'}`);
      console.log(`   💬 Message: "${messageText}"`);

      try {
        // Save chat ID to Firebase
        console.log('   💾 Saving to Firebase...');
        const now = Date.now();
        await setFirebaseData(`/telegram/active_chats/${chatId}`, {
          chatId: chatId,
          username: username || null,
          firstName: firstName || null,
          lastActive: now,
          addedAt: now,
        });
        console.log('   ✅ Saved successfully');

        // Send welcome message
        console.log('   📤 Sending welcome message...');
        const sent = await sendWelcomeMessage(chatId, firstName);

        if (sent) {
          console.log('   ✅ Welcome message sent!');
          newChatsCount++;
        } else {
          console.log('   ❌ Failed to send welcome message');
        }
      } catch (error) {
        console.error(`   ❌ Error processing chat ${chatId}:`, error);
      }
    }

    // Save the latest update ID
    if (latestUpdateId > lastUpdateId) {
      console.log(`\n💾 Updating last update ID: ${lastUpdateId} → ${latestUpdateId}`);
      await setFirebaseData('/telegram/last_update_id', latestUpdateId);
      console.log('   ✅ Updated successfully');
    }

    console.log('\n' + '='.repeat(50));
    console.log('✅ DISCOVERY TEST COMPLETED');
    console.log('='.repeat(50));
    console.log(`📊 Updates processed: ${updates.length}`);
    console.log(`📊 New chats registered: ${newChatsCount}`);
    console.log(`📊 Latest update ID: ${latestUpdateId}`);
    console.log('='.repeat(50));
  } catch (error) {
    console.error('\n❌ Error during discovery test:', error);
    process.exit(1);
  }
}

// Run the test
testTelegramDiscovery()
  .then(() => {
    console.log('\n✅ Test completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  });
