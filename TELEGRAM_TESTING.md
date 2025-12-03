# Telegram Notification System - Testing Guide

This guide explains how to test the Telegram notification system locally before deploying to Vercel.

## Prerequisites

1. **Environment Variables**: Make sure `.env.local` contains:
   ```
   TELEGRAM_BOT_TOKEN=7831900009:AAGuBagbeBVt-eN69Ytyz9oba84cYzJFTS8
   CRON_SECRET=aide-cron-secret-2025-secure-token-xyz789
   ```

2. **Firebase Setup**: Ensure Firebase RTDB is configured and accessible.

3. **Telegram Bot**: Your bot `@aidenext_bot` should be active.

## Testing Steps

### Step 1: Register a Telegram Chat

1. Open Telegram and search for `@aidenext_bot`
2. Send any message (e.g., `/start` or "Hi")
3. Run the discovery test script:

```bash
npm run test:telegram-discovery
```

**Note**: This test script does NOT require authentication - it uses Firebase REST API directly!

**Expected Output:**
```
🔍 Starting Telegram Chat Discovery Test...

📋 Getting last update ID from Firebase...
   Last update ID: 0

📥 Polling Telegram for new updates...
   ✅ Found 1 update(s)

📨 Processing update #123456:
   👤 Chat ID: 123456789
   👤 Username: @yourusername
   👤 First Name: YourName
   💬 Message: "Hi"
   💾 Saving to Firebase...
   ✅ Saved successfully
   📤 Sending welcome message...
   ✅ Welcome message sent!

==================================================
✅ DISCOVERY TEST COMPLETED
==================================================
📊 Updates processed: 1
📊 New chats registered: 1
📊 Latest update ID: 123456
==================================================
```

4. You should receive a welcome message from the bot on Telegram!

### Step 2: Send a Dummy Alert (Quick Test)

To quickly test if alerts work without waiting for a real device to exceed its limit:

```bash
npm run test:send-alert
```

This will send a test alert message to all registered Telegram chats with dummy data.

**Expected**: You should receive an energy alert on Telegram immediately!

### Step 3: Test Real Energy Alerts

1. Ensure at least one device has an energy limit set and is over that limit
   - You can set this in the web app UI
   - Or temporarily lower a limit for testing

2. Run the energy alerts test script:

```bash
npm run test:energy-alerts
```

**Note**: This test script does NOT require authentication - it uses Firebase REST API directly!

**Expected Output:**
```
⚡ Starting Energy Alerts Test...

📋 Getting active Telegram chats from Firebase...
   ✅ Found 1 active chat(s): 123456789

📋 Getting all devices from Firebase...
   ✅ Found 3 device(s)

🔌 Checking device: Living Room AC (device-001)
   Energy limit: 1000 kWh
   Current energy: 1250.50 kWh
   Last reading: 12/3/2025, 2:30:00 PM
   ⚠️  OVER LIMIT by 250.50 kWh!
   📤 Broadcasting alert to 1 chat(s)...
      ✅ Sent to chat 123456789

==================================================
✅ ENERGY ALERTS TEST COMPLETED
==================================================
📊 Devices checked: 3
📊 Devices over limit: 1
📊 Alerts sent: 1
📊 Active chats: 1
==================================================
```

3. You should receive an energy alert on Telegram with device details!

## Alert Message Format

When a device exceeds its limit, you'll receive a message like:

```
⚠️ Energy Limit Exceeded

Device: Living Room AC
Current: 1250.50 kWh
Limit: 1000.00 kWh
Over by: 250.50 kWh

Time: Dec 3, 2025, 2:30 PM UTC

Please check your device to reduce energy consumption.
```

## Troubleshooting

### No Updates Found
- **Issue**: `No new updates available`
- **Solution**: Make sure you've sent a message to @aidenext_bot on Telegram

### No Active Chats
- **Issue**: `No active Telegram chats registered`
- **Solution**: Run `npm run test:telegram-discovery` first to register your chat

### No Devices Over Limit
- **Issue**: All devices are within their limits
- **Solution**:
  - Set a lower energy limit on a test device
  - Or wait for a device to naturally exceed its limit

### Bot Token Error
- **Issue**: `TELEGRAM_BOT_TOKEN is not set`
- **Solution**: Check that `.env.local` contains the correct token

## Production Deployment

Once local testing works:

1. **Add Environment Variables to Vercel**:
   - Go to your Vercel project settings
   - Add `CRON_SECRET` environment variable
   - `TELEGRAM_BOT_TOKEN` should already be set

2. **Deploy**:
   ```bash
   git add .
   git commit -m "Add Telegram notification system"
   git push
   ```

3. **Verify Cron Jobs**:
   - Check Vercel dashboard → Your Project → Logs
   - You should see cron job executions every 1 minute (discovery) and 30 minutes (alerts)

4. **Monitor**:
   - Discovery cron: `/api/cron/telegram-discovery` runs every minute
   - Alert cron: `/api/cron/energy-alerts` runs every 30 minutes

## Test Scripts

| Script | Purpose | When to Use | Requires Auth? |
|--------|---------|-------------|----------------|
| `npm run test:telegram-discovery` | Register Telegram chats | After sending a message to the bot | ❌ No |
| `npm run test:send-alert` | Send dummy alert immediately | Quick test to verify alerts work | ❌ No |
| `npm run test:energy-alerts` | Test real energy limit alerts | After registering a chat and setting device limits | ❌ No |

**All test scripts use Firebase REST API directly - no authentication required!** This means you can test the Telegram notification system without logging into the web app.

## Notes

- **Broadcast Mode**: All registered users receive ALL alerts (no user-specific filtering)
- **Alert Frequency**: Production alerts sent every 30 minutes while device is over limit
- **No Deduplication**: Same alert can be sent multiple times (every 30 min)
- **Custom Names**: Alerts show custom device names from user profiles if available

## Need Help?

If tests fail, check:
1. Firebase RTDB connection and permissions
2. Telegram bot token validity
3. Environment variables are loaded correctly
4. Bot has permission to send messages (not blocked by user)
