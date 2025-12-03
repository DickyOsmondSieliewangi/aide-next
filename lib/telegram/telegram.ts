/**
 * Telegram Bot API Utilities
 * Handles sending messages and interacting with Telegram Bot API
 */

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

/**
 * Send a text message to a specific Telegram chat
 */
export async function sendTelegramMessage(
  chatId: number,
  text: string,
  parseMode: 'HTML' | 'Markdown' | 'MarkdownV2' = 'HTML'
): Promise<boolean> {
  if (!TELEGRAM_BOT_TOKEN) {
    console.error('TELEGRAM_BOT_TOKEN is not set');
    return false;
  }

  try {
    const response = await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
        parse_mode: parseMode,
      }),
    });

    const data = await response.json();

    if (!data.ok) {
      console.error(`Failed to send message to ${chatId}:`, data.description);
      return false;
    }

    return true;
  } catch (error) {
    console.error(`Error sending Telegram message to ${chatId}:`, error);
    return false;
  }
}

/**
 * Send a formatted energy limit alert to a chat
 */
export async function sendEnergyAlert(
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

  return sendTelegramMessage(chatId, message, 'HTML');
}

/**
 * Send welcome message to new chat
 */
export async function sendWelcomeMessage(chatId: number, firstName?: string): Promise<boolean> {
  const greeting = firstName ? `Hi ${firstName}!` : 'Hi there!';

  const message = `
${greeting} 👋

Welcome to <b>AIDE Energy Monitor Bot</b>!

You will receive notifications when any device exceeds its energy limit.

Your chat has been registered for alerts. You'll be notified every 30 minutes about devices that are over their energy limits.

To stop receiving notifications, you can block this bot anytime.
`.trim();

  return sendTelegramMessage(chatId, message, 'HTML');
}

/**
 * Get updates from Telegram Bot API
 */
export async function getUpdates(offset?: number, timeout: number = 30) {
  if (!TELEGRAM_BOT_TOKEN) {
    console.error('TELEGRAM_BOT_TOKEN is not set');
    return null;
  }

  try {
    const params = new URLSearchParams({
      timeout: timeout.toString(),
      ...(offset && { offset: offset.toString() }),
    });

    const response = await fetch(`${TELEGRAM_API}/getUpdates?${params}`);
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
