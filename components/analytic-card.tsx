'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ChevronLeft,
  ChevronRight,
  Pencil,
  Trash2,
  RefreshCw,
  AlertTriangle,
  Maximize2,
} from 'lucide-react';
import { Device, TimeRange } from '@/types';
import { useChartData } from '@/lib/hooks/use-chart-data';
import {
  transformToChartData,
  aggregateEnergyByHour,
  aggregateEnergyByDay,
  aggregateEnergyByDayMonthly,
  aggregateEnergyByMonth,
} from '@/lib/utils/chart-aggregation';
import { getLatestReading } from '@/lib/utils/energy-calculator';

interface AnalyticCardProps {
  device: Device;
  onToggle: (deviceId: string, newState: boolean) => void;
  onEdit: (device: Device) => void;
  onDelete: (device: Device) => void;
  onSetLimit: (device: Device) => void;
  onExpand?: (device: Device) => void;
}

const GRAPH_TYPES = [
  { id: 'power', label: 'Power', unit: 'W', key: 'power' },
  { id: 'voltage', label: 'Voltage', unit: 'V', key: 'voltage' },
  { id: 'frequency', label: 'Frequency', unit: 'Hz', key: 'frequency' },
  { id: 'current', label: 'Current', unit: 'A', key: 'current' },
  { id: 'powerFactor', label: 'Power Factor', unit: 'PF', key: 'powerFactor' },
  { id: 'energy', label: 'Energy', unit: 'kWh', key: 'energy' },
];

const TIME_RANGES: { value: TimeRange; label: string }[] = [
  { value: '24h', label: '24 Hours' },
  { value: '7d', label: '7 Days' },
  { value: '1m', label: '1 Month' },
  { value: '1y', label: '1 Year' },
];

export function AnalyticCard({
  device,
  onToggle,
  onEdit,
  onDelete,
  onSetLimit,
  onExpand,
}: AnalyticCardProps) {
  const [currentGraphIndex, setCurrentGraphIndex] = useState(0);
  const [timeRange, setTimeRange] = useState<TimeRange>('24h');
  const [isToggling, setIsToggling] = useState(false);
  const [optimisticState, setOptimisticState] = useState<boolean | null>(null);
  const [displayedEnergyLimit, setDisplayedEnergyLimit] = useState(device.energyLimit);

  const { data, loading, error, refresh } = useChartData(device.id, timeRange);

  const currentGraph = GRAPH_TYPES[currentGraphIndex];
  const latestReading = getLatestReading(data);

  // Use optimistic state if available, otherwise use device state
  const displayState = optimisticState !== null ? optimisticState : device.isOn;

  // Update displayed energy limit when device prop changes
  useEffect(() => {
    setDisplayedEnergyLimit(device.energyLimit);
  }, [device.energyLimit]);

  // Clear optimistic state when device prop updates to match it
  useEffect(() => {
    if (optimisticState !== null && device.isOn === optimisticState) {
      setOptimisticState(null);
    }
  }, [device.isOn, optimisticState]);

  const handleToggle = async (checked: boolean) => {
    setIsToggling(true);
    setOptimisticState(checked); // Optimistic update
    try {
      await onToggle(device.id, checked);
      // Keep optimistic state - it will sync with Firebase when data arrives
    } catch (error) {
      // Revert optimistic update on error
      setOptimisticState(null);
      throw error;
    } finally {
      setIsToggling(false);
    }
  };

  const nextGraph = () => {
    setCurrentGraphIndex((prev) => (prev + 1) % GRAPH_TYPES.length);
  };

  const prevGraph = () => {
    setCurrentGraphIndex((prev) => (prev - 1 + GRAPH_TYPES.length) % GRAPH_TYPES.length);
  };

  // Transform data for charts
  const chartData = useMemo(() => {
    if (currentGraph.id === 'energy') {
      switch (timeRange) {
        case '24h':
          return aggregateEnergyByHour(data);
        case '7d':
          return aggregateEnergyByDay(data);
        case '1m':
          return aggregateEnergyByDayMonthly(data);
        case '1y':
          return aggregateEnergyByMonth(data);
        default:
          return [];
      }
    } else {
      return transformToChartData(data, timeRange);
    }
  }, [data, currentGraph.id, timeRange]);

  const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ payload: { name: string }; value: number }> }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-800 text-white px-4 py-2 rounded-lg shadow-lg border border-slate-600">
          <p className="text-xs text-slate-300">{payload[0].payload.name}</p>
          <p className="text-sm font-semibold">
            {payload[0].value.toFixed(2)} {currentGraph.unit}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <Card className="bg-white rounded-xl shadow-md p-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <h3 className="text-xl font-bold text-slate-800 mb-1">{device.name}</h3>
          <p className="text-sm text-slate-500 font-mono">{device.id}</p>
        </div>
        <div className="flex items-center gap-3">
          <Switch
            checked={displayState}
            onCheckedChange={handleToggle}
            disabled={isToggling}
            className="data-[state=checked]:bg-green-500 data-[state=unchecked]:bg-red-400 shadow-lg"
          />
          <span className={`text-sm font-bold ${displayState ? 'text-green-600' : 'text-red-600'}`}>
            {displayState ? 'ON' : 'OFF'}
          </span>
        </div>
      </div>

      {/* Time Range Selector */}
      <Tabs value={timeRange} onValueChange={(value) => setTimeRange(value as TimeRange)} className="mb-4">
        <TabsList className="grid grid-cols-4 w-full">
          {TIME_RANGES.map((range) => (
            <TabsTrigger key={range.value} value={range.value} className="text-xs">
              {range.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* Graph Navigation */}
      <div className="flex items-center justify-between mb-4">
        <Button variant="outline" size="icon" onClick={prevGraph} className="h-8 w-8">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="text-center">
          <p className="text-lg font-semibold text-slate-800">
            {currentGraph.label}
          </p>
          <div className="flex gap-1 justify-center mt-1">
            {GRAPH_TYPES.map((_, index) => (
              <div
                key={index}
                className={`h-1 w-6 rounded-full transition-colors ${
                  index === currentGraphIndex ? 'bg-[#4A90E2]' : 'bg-slate-300'
                }`}
              />
            ))}
          </div>
        </div>
        <Button variant="outline" size="icon" onClick={nextGraph} className="h-8 w-8">
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Chart */}
      <div className="mb-4">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#4A90E2]" />
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-64 text-red-600">
            <p>Error loading data</p>
          </div>
        ) : chartData.length === 0 ? (
          <div className="flex items-center justify-center h-64 text-slate-400">
            <p>No data available</p>
          </div>
        ) : currentGraph.id === 'energy' ? (
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis
                dataKey="name"
                stroke="#64748b"
                style={{ fontSize: '0.75rem' }}
                interval="preserveStartEnd"
                minTickGap={30}
              />
              <YAxis stroke="#64748b" width={45} style={{ fontSize: '0.75rem' }} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="energy" fill="#4A90E2" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis
                dataKey="name"
                stroke="#64748b"
                style={{ fontSize: '0.75rem' }}
                interval="preserveStartEnd"
                minTickGap={30}
              />
              <YAxis stroke="#64748b" width={45} style={{ fontSize: '0.75rem' }} />
              <Tooltip content={<CustomTooltip />} />
              <Line
                type="monotone"
                dataKey={currentGraph.key}
                stroke="#4A90E2"
                strokeWidth={2}
                dot={{ r: 2 }}
                activeDot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Latest Readings */}
      {latestReading && (
        <div className="bg-slate-50 rounded-lg p-4 mb-4">
          <p className="text-xs font-semibold text-slate-600 mb-2 uppercase">Latest Readings</p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div>
              <p className="text-xs text-slate-500">Power</p>
              <p className="text-sm font-semibold text-slate-800">{latestReading.power.toFixed(2)} W</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Voltage</p>
              <p className="text-sm font-semibold text-slate-800">{latestReading.voltage.toFixed(2)} V</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Current</p>
              <p className="text-sm font-semibold text-slate-800">{latestReading.current.toFixed(2)} A</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Frequency</p>
              <p className="text-sm font-semibold text-slate-800">{latestReading.frequency.toFixed(2)} Hz</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Power Factor</p>
              <p className="text-sm font-semibold text-slate-800">{latestReading.power_factor.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Total Energy</p>
              <p className="text-sm font-semibold text-slate-800">{latestReading.energy.toFixed(2)} kWh</p>
            </div>
          </div>
        </div>
      )}

      {/* Energy Limit Warning */}
      {displayedEnergyLimit > 0 && latestReading && latestReading.energy >= displayedEnergyLimit && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-red-600" />
          <p className="text-sm text-red-800">
            Energy limit exceeded: {latestReading.energy.toFixed(2)} / {displayedEnergyLimit} kWh
          </p>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={() => onEdit(device)} className="flex-1 min-w-[100px]">
          <Pencil className="h-4 w-4 mr-2" />
          Edit
        </Button>
        <Button variant="outline" size="sm" onClick={refresh} className="flex-1 min-w-[100px]">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
        <Button variant="outline" size="sm" onClick={() => onSetLimit(device)} className="flex-1 min-w-[100px]">
          <AlertTriangle className="h-4 w-4 mr-2" />
          Set Limit
        </Button>
        {onExpand && (
          <Button variant="outline" size="sm" onClick={() => onExpand(device)} className="flex-1 min-w-[100px]">
            <Maximize2 className="h-4 w-4 mr-2" />
            Expand
          </Button>
        )}
        <Button
          variant="destructive"
          size="sm"
          onClick={() => onDelete(device)}
          className="flex-1 min-w-[100px]"
        >
          <Trash2 className="h-4 w-4 mr-2" />
          Delete
        </Button>
      </div>
    </Card>
  );
}
