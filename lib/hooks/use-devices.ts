'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  subscribeToUserDevices,
  getDeviceMetadata,
  addDevice as addDeviceRTDB,
  updateDevice as updateDeviceRTDB,
  deleteDevice as deleteDeviceRTDB,
  setEnergyLimit as setEnergyLimitRTDB,
  toggleDevice as toggleDeviceRTDB,
} from '@/lib/firebase/firestore';
import { Device } from '@/types';

// Global cache for devices
let cachedDevices: Device[] | null = null;
let activeDeviceSubscription: (() => void) | null = null;
let subscriberCount = 0;

export function useDevices(userId: string | null) {
  const [devices, setDevices] = useState<Device[]>(cachedDevices || []);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) {
      setDevices([]);
      setLoading(false);
      return;
    }

    subscriberCount++;

    // If we already have an active subscription, just use the cached data
    if (activeDeviceSubscription && cachedDevices) {
      setDevices(cachedDevices);
      setLoading(false);
      return () => {
        subscriberCount--;
        if (subscriberCount === 0 && activeDeviceSubscription) {
          activeDeviceSubscription();
          activeDeviceSubscription = null;
          cachedDevices = null;
        }
      };
    }

    // Create new subscription
    const fetchDeviceDetails = async (deviceMap: { [key: string]: string }) => {
      try {
        const deviceIds = Object.keys(deviceMap);
        const deviceDetails: Device[] = [];

        for (const deviceId of deviceIds) {
          try {
            const metadata = await getDeviceMetadata(deviceId);
            deviceDetails.push({
              id: deviceId,
              name: deviceMap[deviceId],
              isOn: metadata.isOn || false,
              user_id: userId,
              energyLimit: metadata.energyLimit || 0,
              last_updated: metadata.last_updated,
            });
          } catch (err) {
            console.error(`Error fetching device ${deviceId}:`, err);
          }
        }

        cachedDevices = deviceDetails;
        setDevices(deviceDetails);
        setLoading(false);
      } catch (err: any) {
        setError(err.message);
        setLoading(false);
      }
    };

    activeDeviceSubscription = subscribeToUserDevices(
      userId,
      (deviceMap) => {
        fetchDeviceDetails(deviceMap);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      }
    );

    return () => {
      subscriberCount--;
      if (subscriberCount === 0 && activeDeviceSubscription) {
        activeDeviceSubscription();
        activeDeviceSubscription = null;
        cachedDevices = null;
      }
    };
  }, [userId]);

  const addDevice = useCallback(
    async (deviceId: string, customName: string) => {
      if (!userId) throw new Error('User not authenticated');
      await addDeviceRTDB(userId, deviceId, customName);
    },
    [userId]
  );

  const updateDevice = useCallback(
    async (deviceId: string, newName: string) => {
      if (!userId) throw new Error('User not authenticated');
      await updateDeviceRTDB(userId, deviceId, newName);
    },
    [userId]
  );

  const deleteDevice = useCallback(
    async (deviceId: string) => {
      if (!userId) throw new Error('User not authenticated');
      await deleteDeviceRTDB(userId, deviceId);
    },
    [userId]
  );

  const setEnergyLimit = useCallback(async (deviceId: string, limit: number) => {
    await setEnergyLimitRTDB(deviceId, limit);
  }, []);

  const toggleDevice = useCallback(async (deviceId: string, newState: boolean) => {
    await toggleDeviceRTDB(deviceId, newState);

    // Update the cached device immediately
    if (cachedDevices) {
      cachedDevices = cachedDevices.map(device =>
        device.id === deviceId ? { ...device, isOn: newState } : device
      );
      setDevices([...cachedDevices]);
    }
  }, []);

  return {
    devices,
    loading,
    error,
    addDevice,
    updateDevice,
    deleteDevice,
    setEnergyLimit,
    toggleDevice,
  };
}
