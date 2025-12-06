/**
 * Energy Alert Cron Job
 * Runs every 30 minutes to check device energy consumption and send alerts
 */

import { NextRequest, NextResponse } from 'next/server';
import { doc, getDoc, collection, getDocs } from 'firebase/firestore';
import { firestore } from '@/lib/firebase/config';
import { sendEnergyAlert } from '@/lib/telegram/telegram';
import { getAllActiveChatIds } from '@/lib/firebase/telegram-chats';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes max execution time

interface DeviceData {
  name: string;
  energyLimit: number;
  isOn: boolean;
  user_ids?: string[];
}

interface ReadingData {
  energy: number;
  timestamp: number;
  voltage: number;
  current: number;
  power: number;
}

export async function GET(request: NextRequest) {
  try {
    // Verify cron secret for security
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret) {
      console.error('CRON_SECRET not configured');
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    if (authHeader !== `Bearer ${cronSecret}`) {
      console.error('Unauthorized cron request');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get all active Telegram chat IDs
    const chatIds = await getAllActiveChatIds();

    if (chatIds.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No active Telegram chats registered',
        alertsSent: 0,
      });
    }

    // Get all devices from Firestore
    const devicesRef = collection(firestore, 'item-data');
    const devicesSnapshot = await getDocs(devicesRef);

    if (devicesSnapshot.empty) {
      return NextResponse.json({
        success: true,
        message: 'No devices found',
        alertsSent: 0,
      });
    }

    let devicesChecked = 0;
    let alertsSent = 0;
    const errors: string[] = [];

    // Process each device
    for (const deviceDoc of devicesSnapshot.docs) {
      const deviceId = deviceDoc.id;
      const device = deviceDoc.data() as DeviceData;
      devicesChecked++;

      // Skip devices without energy limit set
      if (!device.energyLimit || device.energyLimit === 0) {
        continue;
      }

      try {
        // Get latest daily reading for this device
        const dailyRef = collection(firestore, `item-data/${deviceId}/daily`);
        const readingsSnapshot = await getDocs(dailyRef);

        if (readingsSnapshot.empty) {
          console.log(`No readings found for device ${deviceId}`);
          continue;
        }

        // Sort by document ID (timestamp) in descending order to get latest
        const sortedDocs = readingsSnapshot.docs.sort((a, b) => {
          if (a.id > b.id) return -1;
          if (a.id < b.id) return 1;
          return 0;
        });

        const latestReading = sortedDocs[0].data() as ReadingData;

        // Check if energy consumption exceeds limit
        if (latestReading.energy > device.energyLimit) {
          console.log(`Device ${device.name} (${deviceId}) exceeded limit: ${latestReading.energy} kWh > ${device.energyLimit} kWh`);

          // Get custom device names from users who own this device
          let deviceDisplayName = device.name;

          if (device.user_ids && device.user_ids.length > 0) {
            // Try to get custom name from first user
            const userId = device.user_ids[0];
            const userRef = doc(firestore, `user-data/${userId}`);
            const userSnapshot = await getDoc(userRef);

            if (userSnapshot.exists()) {
              const userData = userSnapshot.data();
              const customName = userData?.devices?.[deviceId];
              if (customName) {
                deviceDisplayName = customName;
              }
            }
          }

          // Broadcast alert to ALL active chat IDs
          for (const chatId of chatIds) {
            try {
              const success = await sendEnergyAlert(
                chatId,
                deviceDisplayName,
                latestReading.energy,
                device.energyLimit
              );

              if (success) {
                alertsSent++;
              } else {
                errors.push(`Failed to send alert to chat ${chatId} for device ${device.name}`);
              }
            } catch (error) {
              const errorMsg = `Error sending alert to chat ${chatId}: ${error instanceof Error ? error.message : 'Unknown error'}`;
              errors.push(errorMsg);
              console.error(errorMsg);
            }
          }
        }
      } catch (error) {
        const errorMsg = `Error processing device ${deviceId}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        errors.push(errorMsg);
        console.error(errorMsg);
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Energy alert check completed',
      devicesChecked,
      alertsSent,
      activeChatIds: chatIds.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('Error in energy-alerts cron:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
