import {
  ref,
  set,
} from 'firebase/database';
import { db } from './config';
/**
 * Set energy limit for a device
 */
export async function setEnergyLimitRTDB(
  deviceId: string,
  limit: number
): Promise<void> {
  try {
    const energyLimitRef = ref(db, `item-data/${deviceId}/energyLimit`);
    await set(energyLimitRef, limit);
  } catch (error: any) {
    throw new Error(error.message || 'Failed to set energy limit');
  }
}

/**
 * Toggle device on/off state
 */
export async function toggleDeviceRTDB(
  deviceId: string,
  newState: boolean
): Promise<void> {
  try {
    const isOnRef = ref(db, `item-data/${deviceId}/isOn`);
    await set(isOnRef, newState);
  } catch (error: any) {
    throw new Error(error.message || 'Failed to toggle device');
  }
}
