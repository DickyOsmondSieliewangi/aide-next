/**
 * Firebase RTDB functions for managing Telegram chat IDs
 */

import { ref, get, set, update } from 'firebase/database';
import { db } from './config';

/**
 * Save or update an active Telegram chat ID
 */
export async function saveActiveChatId(
  chatId: number,
  username?: string,
  firstName?: string
): Promise<void> {
  try {
    const chatRef = ref(db, `telegram/active_chats/${chatId}`);
    const now = Date.now();

    await set(chatRef, {
      chatId: chatId,
      username: username || null,
      firstName: firstName || null,
      lastActive: now,
      addedAt: now,
    });
  } catch (error) {
    console.error(`Error saving chat ID ${chatId}:`, error);
    throw error;
  }
}

/**
 * Get all active Telegram chat IDs for broadcasting
 */
export async function getAllActiveChatIds(): Promise<number[]> {
  try {
    const chatsRef = ref(db, 'telegram/active_chats');
    const snapshot = await get(chatsRef);

    if (!snapshot.exists()) {
      return [];
    }

    const chats = snapshot.val();
    return Object.keys(chats).map((chatId) => parseInt(chatId, 10));
  } catch (error) {
    console.error('Error getting active chat IDs:', error);
    return [];
  }
}

/**
 * Get the last processed Telegram update ID
 */
export async function getLastUpdateId(): Promise<number> {
  try {
    const updateIdRef = ref(db, 'telegram/last_update_id');
    const snapshot = await get(updateIdRef);

    if (!snapshot.exists()) {
      return 0;
    }

    return snapshot.val();
  } catch (error) {
    console.error('Error getting last update ID:', error);
    return 0;
  }
}

/**
 * Save the last processed Telegram update ID
 */
export async function setLastUpdateId(updateId: number): Promise<void> {
  try {
    const updateIdRef = ref(db, 'telegram/last_update_id');
    await set(updateIdRef, updateId);
  } catch (error) {
    console.error('Error setting last update ID:', error);
    throw error;
  }
}

/**
 * Remove inactive chats older than specified days
 * (Future enhancement - not used yet)
 */
export async function removeInactiveChats(daysOld: number = 90): Promise<number> {
  try {
    const chatsRef = ref(db, 'telegram/active_chats');
    const snapshot = await get(chatsRef);

    if (!snapshot.exists()) {
      return 0;
    }

    const chats = snapshot.val();
    const cutoffTime = Date.now() - daysOld * 24 * 60 * 60 * 1000;
    let removedCount = 0;

    const updates: Record<string, null> = {};

    Object.keys(chats).forEach((chatId) => {
      const chat = chats[chatId];
      if (chat.lastActive < cutoffTime) {
        updates[`telegram/active_chats/${chatId}`] = null;
        removedCount++;
      }
    });

    if (removedCount > 0) {
      await update(ref(db), updates);
    }

    return removedCount;
  } catch (error) {
    console.error('Error removing inactive chats:', error);
    return 0;
  }
}
