'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  subscribeToUserDevices,
  subscribeToDeviceMetadata,
  getDeviceMetadata,
  addDevice as addDeviceFS,
  updateDevice as updateDeviceFS,
  deleteDevice as deleteDeviceFS,
  setEnergyLimit as setEnergyLimitFS,
  toggleDevice as toggleDeviceFS,
} from '@/lib/firebase/firestore';

import {
  setEnergyLimitRTDB,
  toggleDeviceRTDB,
} from '@/lib/firebase/rtdb'
import { Device } from '@/types';

// Global cache for devices
let cachedDevices: Device[] | null = null;
let activeDeviceSubscription: (() => void) | null = null;
const deviceMetadataSubscriptions: Map<string, () => void> = new Map();
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

        // Clean up old metadata subscriptions for removed devices
        const currentDeviceIds = new Set(deviceIds);
        for (const [subscribedId, unsubscribe] of deviceMetadataSubscriptions.entries()) {
          if (!currentDeviceIds.has(subscribedId)) {
            unsubscribe();
            deviceMetadataSubscriptions.delete(subscribedId);
          }
        }

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

            // Subscribe to metadata changes if not already subscribed
            if (!deviceMetadataSubscriptions.has(deviceId)) {
              const unsubscribe = subscribeToDeviceMetadata(
                deviceId,
                (updatedMetadata) => {
                  // Update the cached device when metadata changes
                  if (cachedDevices) {
                    cachedDevices = cachedDevices.map(device =>
                      device.id === deviceId
                        ? {
                            ...device,
                            isOn: typeof updatedMetadata.isOn === 'boolean' ? updatedMetadata.isOn : false,
                            energyLimit: typeof updatedMetadata.energyLimit === 'number' ? updatedMetadata.energyLimit : 0,
                            last_updated: updatedMetadata.last_updated as string | undefined,
                          }
                        : device
                    );
                    setDevices([...cachedDevices]);
                  }
                },
                (err) => {
                  console.error(`Error subscribing to device ${deviceId} metadata:`, err);
                }
              );
              deviceMetadataSubscriptions.set(deviceId, unsubscribe);
            }
          } catch (err) {
            console.error(`Error fetching device ${deviceId}:`, err);
          }
        }

        cachedDevices = deviceDetails;
        setDevices(deviceDetails);
        setLoading(false);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to fetch device details';
        setError(errorMessage);
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
      if (subscriberCount === 0) {
        if (activeDeviceSubscription) {
          activeDeviceSubscription();
          activeDeviceSubscription = null;
        }
        // Unsubscribe from all device metadata subscriptions
        for (const unsubscribe of deviceMetadataSubscriptions.values()) {
          unsubscribe();
        }
        deviceMetadataSubscriptions.clear();
        cachedDevices = null;
      }
    };
  }, [userId]);

  const addDevice = useCallback(
    async (deviceId: string, customName: string) => {
      if (!userId) throw new Error('User not authenticated');
      await addDeviceFS(userId, deviceId, customName);
    },
    [userId]
  );

  const updateDevice = useCallback(
    async (deviceId: string, newName: string) => {
      if (!userId) throw new Error('User not authenticated');
      await updateDeviceFS(userId, deviceId, newName);
    },
    [userId]
  );

  const deleteDevice = useCallback(
    async (deviceId: string) => {
      if (!userId) throw new Error('User not authenticated');
      await deleteDeviceFS(userId, deviceId);
    },
    [userId]
  );

  const setEnergyLimit = useCallback(async (deviceId: string, limit: number) => {
    await setEnergyLimitFS(deviceId, limit);
    await setEnergyLimitRTDB(deviceId, limit);
  }, []);

  const toggleDevice = useCallback(async (deviceId: string, newState: boolean) => {
    await toggleDeviceFS(deviceId, newState);
    await toggleDeviceRTDB(deviceId,newState);

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
