'use client';

import { useState, useEffect } from 'react';
import { useUser } from '@/contexts/user-context';
import { useDevices } from '@/lib/hooks/use-devices';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { AnalyticCard } from '@/components/analytic-card';
import { AddDeviceModal } from '@/components/modals/add-device-modal';
import { EditDeviceModal } from '@/components/modals/edit-device-modal';
import { SetLimitModal } from '@/components/modals/set-limit-modal';
import { DeleteDeviceModal } from '@/components/modals/delete-device-modal';
import { Device } from '@/types';
import { toast } from 'sonner';
import Image from 'next/image';

export default function AnalyticPage() {
  const { userProfile } = useUser();
  const {
    devices,
    loading,
    error,
    addDevice,
    updateDevice,
    deleteDevice,
    setEnergyLimit,
    toggleDevice,
  } = useDevices(userProfile?.userId || null);

  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [limitModalOpen, setLimitModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);

  // Sync selectedDevice with updated device data from Firebase
  useEffect(() => {
    if (selectedDevice) {
      const updatedDevice = devices.find(d => d.id === selectedDevice.id);
      if (updatedDevice) {
        // Update if any property changed, but compare by reference to avoid infinite loop
        if (updatedDevice.energyLimit !== selectedDevice.energyLimit ||
            updatedDevice.name !== selectedDevice.name ||
            updatedDevice.isOn !== selectedDevice.isOn) {
          setSelectedDevice(updatedDevice);
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [devices]);

  const handleAddDevice = async (deviceId: string, deviceName: string) => {
    try {
      await addDevice(deviceId, deviceName);
      toast.success(`Device "${deviceName}" added successfully!`);
    } catch (err) {
      throw err;
    }
  };

  const handleEditDevice = (device: Device) => {
    setSelectedDevice(device);
    setEditModalOpen(true);
  };

  const handleUpdateDevice = async (deviceId: string, newName: string) => {
    try {
      await updateDevice(deviceId, newName);
      toast.success(`Device renamed to "${newName}"!`);
    } catch (err) {
      throw err;
    }
  };

  const handleSetLimit = (device: Device) => {
    setSelectedDevice(device);
    setLimitModalOpen(true);
  };

  const handleSetLimitSubmit = async (deviceId: string, limit: number) => {
    try {
      await setEnergyLimit(deviceId, limit);
      toast.success(
        limit > 0
          ? `Energy limit set to ${limit} kWh!`
          : 'Energy limit removed!'
      );
    } catch (err) {
      throw err;
    }
  };

  const handleDeleteDevice = (device: Device) => {
    setSelectedDevice(device);
    setDeleteModalOpen(true);
  };

  const handleDeleteConfirm = async (deviceId: string) => {
    try {
      await deleteDevice(deviceId);
      toast.success('Device deleted successfully!');
    } catch (err) {
      throw err;
    }
  };

  const handleToggleDevice = async (deviceId: string, newState: boolean) => {
    try {
      await toggleDevice(deviceId, newState);
      toast.success(`Device turned ${newState ? 'on' : 'off'}!`, {
        icon: newState ? '🟢' : '🔴',
      });
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to toggle device');
      toast.error(error.message);
      throw err;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="relative flex flex-col items-center gap-3">
          <Image
            src="/Group 4.svg"
            alt="AIDE Logo"
            width={48}
            height={48}
            className="opacity-70"
          />
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-t-2 border-[#00E0FF]" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
        Error loading devices: {error}
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-slate-800">Your Devices</h2>
          <Button
            className="bg-gradient-submit gap-2"
            onClick={() => setAddModalOpen(true)}
          >
            <Plus className="h-4 w-4" />
            Add Device
          </Button>
        </div>

        {devices.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-12 text-center">
            <p className="text-slate-600 text-lg mb-4">No devices found</p>
            <p className="text-slate-500 mb-6">
              Add your first device to start monitoring energy consumption
            </p>
            <Button
              className="bg-gradient-submit gap-2"
              onClick={() => setAddModalOpen(true)}
            >
              <Plus className="h-4 w-4" />
              Add Device
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {devices.map((device) => (
              <AnalyticCard
                key={device.id}
                device={device}
                onToggle={handleToggleDevice}
                onEdit={handleEditDevice}
                onDelete={handleDeleteDevice}
                onSetLimit={handleSetLimit}
              />
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      <AddDeviceModal
        open={addModalOpen}
        onOpenChange={setAddModalOpen}
        onSubmit={handleAddDevice}
      />

      <EditDeviceModal
        open={editModalOpen}
        onOpenChange={setEditModalOpen}
        device={selectedDevice}
        onSubmit={handleUpdateDevice}
      />

      <SetLimitModal
        open={limitModalOpen}
        onOpenChange={setLimitModalOpen}
        device={selectedDevice}
        onSubmit={handleSetLimitSubmit}
      />

      <DeleteDeviceModal
        open={deleteModalOpen}
        onOpenChange={setDeleteModalOpen}
        device={selectedDevice}
        onConfirm={handleDeleteConfirm}
      />
    </>
  );
}
