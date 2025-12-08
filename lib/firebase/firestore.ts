import {
  doc,
  getDoc,
  updateDoc,
  deleteField,
  collection,
  onSnapshot,
  arrayUnion,
  arrayRemove,
  Unsubscribe,
} from 'firebase/firestore';
import { firestore } from './config';
import { ChartReading } from '@/types';

/**
 * Subscribe to user devices in real-time
 */
export function subscribeToUserDevices(
  userId: string,
  onUpdate: (devices: Record<string, string>) => void,
  onError: (error: Error) => void
): Unsubscribe {
  const userDocRef = doc(firestore, `user-data/${userId}`);

  return onSnapshot(
    userDocRef,
    (snapshot) => {
      if (!snapshot.exists()) {
        onUpdate({});
        return;
      }
      const userData = snapshot.data();
      const devices = userData?.devices || {};
      onUpdate(devices);
    },
    (error) => {
      onError(new Error(error.message || 'Failed to fetch devices'));
    }
  );
}

/**
 * Subscribe to a specific device's metadata in real-time
 */
export function subscribeToDeviceMetadata(
  itemId: string,
  onUpdate: (metadata: Record<string, unknown>) => void,
  onError: (error: Error) => void
): Unsubscribe {
  const itemDocRef = doc(firestore, `item-data/${itemId}`);

  return onSnapshot(
    itemDocRef,
    (snapshot) => {
      if (!snapshot.exists()) {
        onUpdate({});
        return;
      }
      const metadata = snapshot.data();
      onUpdate(metadata);
    },
    (error) => {
      onError(new Error(error.message || 'Failed to fetch device metadata'));
    }
  );
}

/**
 * Subscribe to daily readings for a device
 */
export function subscribeToDailyReadings(
  itemId: string,
  maxResults: number,
  onUpdate: (readings: ChartReading[]) => void,
  onError: (error: Error) => void
): Unsubscribe {
  const dailyRef = collection(firestore, `item-data/${itemId}/daily`);

  return onSnapshot(
    dailyRef,
    (snapshot) => {
      const readings: ChartReading[] = [];
      snapshot.docs.forEach((doc) => {
        readings.push({
          id: doc.id,
          ...doc.data(),
        } as ChartReading);
      });

      // Sort by document ID (timestamp) in descending order
      readings.sort((a, b) => {
        if (a.id > b.id) return -1;
        if (a.id < b.id) return 1;
        return 0;
      });

      // Limit to maxResults
      const limitedReadings = readings.slice(0, maxResults);

      // Reverse to get chronological order (oldest to newest)
      onUpdate(limitedReadings.reverse());
    },
    (error) => {
      onError(new Error(error.message || 'Failed to fetch daily readings'));
    }
  );
}

/**
 * Get device metadata
 */
export async function getDeviceMetadata(itemId: string) {
  const itemRef = doc(firestore, `item-data/${itemId}`);
  const snapshot = await getDoc(itemRef);

  if (!snapshot.exists()) {
    throw new Error('Device not found');
  }

  return snapshot.data();
}

/**
 * Add a new device for the user
 */
export async function addDevice(
  userId: string,
  itemId: string,
  customName: string
): Promise<void> {
  try {
    // Check if device exists
    const itemRef = doc(firestore, `item-data/${itemId}`);
    const itemSnapshot = await getDoc(itemRef);

    if (!itemSnapshot.exists()) {
      throw new Error('Device ID does not exist');
    }

    // Add device to user's devices map
    const userRef = doc(firestore, `user-data/${userId}`);
    await updateDoc(userRef, {
      [`devices.${itemId}`]: customName,
    });

    // Add user to device's user_ids array
    await updateDoc(itemRef, {
      user_ids: arrayUnion(userId),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to add device';
    throw new Error(message);
  }
}

/**
 * Update device name for the user
 */
export async function updateDevice(
  userId: string,
  itemId: string,
  newName: string
): Promise<void> {
  try {
    const userRef = doc(firestore, `user-data/${userId}`);
    const userSnapshot = await getDoc(userRef);

    if (!userSnapshot.exists()) {
      throw new Error('User not found');
    }

    const userData = userSnapshot.data();
    if (!userData?.devices?.[itemId]) {
      throw new Error('Device not found in user devices');
    }

    await updateDoc(userRef, {
      [`devices.${itemId}`]: newName,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update device';
    throw new Error(message);
  }
}

/**
 * Delete a device from the user's list
 */
export async function deleteDevice(
  userId: string,
  itemId: string
): Promise<void> {
  try {
    // Remove from user's devices
    const userRef = doc(firestore, `user-data/${userId}`);
    await updateDoc(userRef, {
      [`devices.${itemId}`]: deleteField(),
    });

    // Remove user from device's user_ids array
    const itemRef = doc(firestore, `item-data/${itemId}`);
    await updateDoc(itemRef, {
      user_ids: arrayRemove(userId),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete device';
    throw new Error(message);
  }
}

/**
 * Set energy limit for a device
 */
export async function setEnergyLimit(
  itemId: string,
  limit: number
): Promise<void> {
  try {
    const itemRef = doc(firestore, `item-data/${itemId}`);
    await updateDoc(itemRef, {
      energyLimit: limit,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to set energy limit';
    throw new Error(message);
  }
}

/**
 * Toggle device on/off state
 */
export async function toggleDevice(
  itemId: string,
  newState: boolean
): Promise<void> {
  try {
    const itemRef = doc(firestore, `item-data/${itemId}`);
    await updateDoc(itemRef, {
      isOn: newState,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to toggle device';
    throw new Error(message);
  }
}
