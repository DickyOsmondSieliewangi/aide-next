/**
 * Firebase Firestore functions for managing Telegram chat IDs
 */

import { doc, getDoc, updateDoc, setDoc } from 'firebase/firestore';
import { firestore } from './config';

/**
 * Save or update an active Telegram chat ID
 */
export async function saveActiveChatId(
  chatId: number,
  username?: string,
  firstName?: string
): Promise<void> {
  try {
    const chatDocRef = doc(firestore, 'telegram/active_chats');
    const now = Date.now();

    // Get current document
    const chatDoc = await getDoc(chatDocRef);

    if (!chatDoc.exists()) {
      // Create new document
      await setDoc(chatDocRef, {
        chats: {
          [chatId]: {
            chatId: chatId,
            username: username || null,
            firstName: firstName || null,
            lastActive: now,
            addedAt: now,
          },
        },
        last_update_id: 0,
      });
    } else {
      // Update existing document
      await updateDoc(chatDocRef, {
        [`chats.${chatId}`]: {
          chatId: chatId,
          username: username || null,
          firstName: firstName || null,
          lastActive: now,
          addedAt: chatDoc.data()?.chats?.[chatId]?.addedAt || now,
        },
      });
    }
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
    const chatDocRef = doc(firestore, 'telegram/active_chats');
    const chatDoc = await getDoc(chatDocRef);

    if (!chatDoc.exists()) {
      return [];
    }

    const data = chatDoc.data();
    const chats = data?.chats || {};
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
    const chatDocRef = doc(firestore, 'telegram/active_chats');
    const chatDoc = await getDoc(chatDocRef);

    if (!chatDoc.exists()) {
      return 0;
    }

    return chatDoc.data()?.last_update_id || 0;
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
    const chatDocRef = doc(firestore, 'telegram/active_chats');

    // Check if document exists
    const chatDoc = await getDoc(chatDocRef);

    if (!chatDoc.exists()) {
      // Create with just last_update_id
      await setDoc(chatDocRef, {
        chats: {},
        last_update_id: updateId,
      });
    } else {
      // Update existing
      await updateDoc(chatDocRef, {
        last_update_id: updateId,
      });
    }
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
    const chatDocRef = doc(firestore, 'telegram/active_chats');
    const chatDoc = await getDoc(chatDocRef);

    if (!chatDoc.exists()) {
      return 0;
    }

    const data = chatDoc.data();
    const chats = data?.chats || {};
    const cutoffTime = Date.now() - daysOld * 24 * 60 * 60 * 1000;
    let removedCount = 0;

    const updates: Record<string, null> = {};

    Object.keys(chats).forEach((chatId) => {
      const chat = chats[chatId];
      if (chat.lastActive < cutoffTime) {
        updates[`chats.${chatId}`] = null;
        removedCount++;
      }
    });

    if (removedCount > 0) {
      await updateDoc(chatDocRef, updates);
    }

    return removedCount;
  } catch (error) {
    console.error('Error removing inactive chats:', error);
    return 0;
  }
}
