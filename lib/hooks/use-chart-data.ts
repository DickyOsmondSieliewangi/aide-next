'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  subscribeToDailyReadings,
} from '@/lib/firebase/firestore';
import { ChartReading, TimeRange } from '@/types';
import {
  aggregateToHourlyAverages,
  aggregateToDailyAverages,
} from '@/lib/utils/chart-aggregation';

// Global cache for chart data
const chartDataCache: {
  [deviceId: string]: {
    [timeRange: string]: ChartReading[];
  };
} = {};

const activeSubscriptions: {
  [deviceId: string]: {
    [timeRange: string]: {
      unsubscribe: () => void;
      count: number;
    };
  };
} = {};

export function useChartData(deviceId: string | null, timeRange: TimeRange) {
  const [data, setData] = useState<ChartReading[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!deviceId) {
      setData([]);
      setLoading(false);
      return;
    }

    const cacheKey = `${deviceId}-${timeRange}`;

    // Check if we have cached data
    if (chartDataCache[deviceId]?.[timeRange]) {
      setData(chartDataCache[deviceId][timeRange]);
      setLoading(false);
    }

    // Initialize cache and subscriptions for this device if needed
    if (!chartDataCache[deviceId]) {
      chartDataCache[deviceId] = {};
    }
    if (!activeSubscriptions[deviceId]) {
      activeSubscriptions[deviceId] = {};
    }

    // If there's already an active subscription, increment count
    if (activeSubscriptions[deviceId][timeRange]) {
      activeSubscriptions[deviceId][timeRange].count++;
      return () => {
        if (activeSubscriptions[deviceId]?.[timeRange]) {
          activeSubscriptions[deviceId][timeRange].count--;
          if (activeSubscriptions[deviceId][timeRange].count === 0) {
            activeSubscriptions[deviceId][timeRange].unsubscribe();
            delete activeSubscriptions[deviceId][timeRange];
          }
        }
      };
    }

    // Determine which subscription to use based on time range
    let unsubscribe: () => void;

    const handleUpdate = (readings: ChartReading[]) => {
      let processedReadings = readings;

      // Apply aggregation based on time range
      if (timeRange === '7d') {
        processedReadings = aggregateToHourlyAverages(readings);
      } else if (timeRange === '1m') {
        processedReadings = aggregateToDailyAverages(readings);
      }

      chartDataCache[deviceId][timeRange] = processedReadings;
      setData(processedReadings);
      setLoading(false);
    };

    const handleError = (err: Error) => {
      setError(err.message);
      setLoading(false);
    };

    switch (timeRange) {
      case '24h':
        // 288 readings (every 15 minutes for 24 hours)
        unsubscribe = subscribeToDailyReadings(deviceId, 288, handleUpdate, handleError);
        break;
      case '7d':
        // 2016 readings (15-min intervals × 7 days) → aggregated to 168 hourly
        unsubscribe = subscribeToDailyReadings(deviceId, 2016, handleUpdate, handleError);
        break;
      case '1m':
        // 8640 readings (15-min intervals × 30 days) → aggregated to 30 daily
        unsubscribe = subscribeToDailyReadings(deviceId, 8640, handleUpdate, handleError);
        break;
      case '1y':
        // 35040 readings (15-min intervals × 365 days) → aggregated to monthly
        unsubscribe = subscribeToDailyReadings(deviceId, 35040, handleUpdate, handleError);
        break;
      default:
        unsubscribe = subscribeToDailyReadings(deviceId, 288, handleUpdate, handleError);
    }

    // Store subscription
    activeSubscriptions[deviceId][timeRange] = {
      unsubscribe,
      count: 1,
    };

    return () => {
      if (activeSubscriptions[deviceId]?.[timeRange]) {
        activeSubscriptions[deviceId][timeRange].count--;
        if (activeSubscriptions[deviceId][timeRange].count === 0) {
          activeSubscriptions[deviceId][timeRange].unsubscribe();
          delete activeSubscriptions[deviceId][timeRange];
        }
      }
    };
  }, [deviceId, timeRange]);

  const refresh = useCallback(() => {
    if (deviceId && chartDataCache[deviceId]?.[timeRange]) {
      setData([...chartDataCache[deviceId][timeRange]]);
    }
  }, [deviceId, timeRange]);

  return { data, loading, error, refresh };
}

/**
 * Hook to fetch chart data for all devices
 * Used for home dashboard pie charts
 */
export function useAllDevicesChartData(deviceIds: string[]) {
  const [devicesData, setDevicesData] = useState<{ [deviceId: string]: ChartReading[] }>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (deviceIds.length === 0) {
      setDevicesData({});
      setLoading(false);
      return;
    }

    const unsubscribes: (() => void)[] = [];
    const dataMap: { [deviceId: string]: ChartReading[] } = {};
    let loadedCount = 0;

    deviceIds.forEach((deviceId) => {
      const unsubscribe = subscribeToDailyReadings(
        deviceId,
        288,
        (readings) => {
          dataMap[deviceId] = readings;
          loadedCount++;

          if (loadedCount === deviceIds.length) {
            setDevicesData({ ...dataMap });
            setLoading(false);
          }
        },
        (error) => {
          console.error(`Error fetching data for device ${deviceId}:`, error);
          loadedCount++;

          if (loadedCount === deviceIds.length) {
            setDevicesData({ ...dataMap });
            setLoading(false);
          }
        }
      );

      unsubscribes.push(unsubscribe);
    });

    return () => {
      unsubscribes.forEach((unsub) => unsub());
    };
  }, [deviceIds.join(',')]);

  return { devicesData, loading };
}
