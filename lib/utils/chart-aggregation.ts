import { ChartReading, ChartDataPoint } from '@/types';
import { parseTimestampFromDocId, formatChartLabel, formatHourLabel, getDayOfWeekName, getMonthName } from './date-parser';

/**
 * Aggregate readings to hourly averages
 * Used for 7-day view (2016 readings → 168 hourly points)
 */
export function aggregateToHourlyAverages(readings: ChartReading[]): ChartReading[] {
  const hourlyGroups: { [key: string]: ChartReading[] } = {};

  // Group readings by hour
  readings.forEach((reading) => {
    const date = parseTimestampFromDocId(reading.id);
    const hourKey = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}${String(date.getHours()).padStart(2, '0')}`;

    if (!hourlyGroups[hourKey]) {
      hourlyGroups[hourKey] = [];
    }
    hourlyGroups[hourKey].push(reading);
  });

  // Calculate averages for each hour
  const aggregated: ChartReading[] = [];

  Object.keys(hourlyGroups).sort().forEach((hourKey) => {
    const group = hourlyGroups[hourKey];
    const count = group.length;

    // Average all parameters except energy
    const avgPower = group.reduce((sum, r) => sum + r.power, 0) / count;
    const avgVoltage = group.reduce((sum, r) => sum + r.voltage, 0) / count;
    const avgFrequency = group.reduce((sum, r) => sum + r.frequency, 0) / count;
    const avgCurrent = group.reduce((sum, r) => sum + r.current, 0) / count;
    const avgPowerFactor = group.reduce((sum, r) => sum + r.power_factor, 0) / count;

    // For energy, use the last reading's value (it's cumulative)
    const lastEnergy = group[group.length - 1].energy;

    aggregated.push({
      id: group[0].id, // Use first reading's ID for timestamp
      power: avgPower,
      voltage: avgVoltage,
      frequency: avgFrequency,
      current: avgCurrent,
      power_factor: avgPowerFactor,
      energy: lastEnergy,
    });
  });

  return aggregated;
}

/**
 * Aggregate readings to daily averages
 * Used for 1-month view (8640 readings → 30 daily points)
 */
export function aggregateToDailyAverages(readings: ChartReading[]): ChartReading[] {
  const dailyGroups: { [key: string]: ChartReading[] } = {};

  // Group readings by day
  readings.forEach((reading) => {
    const date = parseTimestampFromDocId(reading.id);
    const dayKey = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;

    if (!dailyGroups[dayKey]) {
      dailyGroups[dayKey] = [];
    }
    dailyGroups[dayKey].push(reading);
  });

  // Calculate averages for each day
  const aggregated: ChartReading[] = [];

  Object.keys(dailyGroups).sort().forEach((dayKey) => {
    const group = dailyGroups[dayKey];
    const count = group.length;

    // Average all parameters except energy
    const avgPower = group.reduce((sum, r) => sum + r.power, 0) / count;
    const avgVoltage = group.reduce((sum, r) => sum + r.voltage, 0) / count;
    const avgFrequency = group.reduce((sum, r) => sum + r.frequency, 0) / count;
    const avgCurrent = group.reduce((sum, r) => sum + r.current, 0) / count;
    const avgPowerFactor = group.reduce((sum, r) => sum + r.power_factor, 0) / count;

    // For energy, use the last reading's value (it's cumulative)
    const lastEnergy = group[group.length - 1].energy;

    aggregated.push({
      id: group[0].id, // Use first reading's ID for timestamp
      power: avgPower,
      voltage: avgVoltage,
      frequency: avgFrequency,
      current: avgCurrent,
      power_factor: avgPowerFactor,
      energy: lastEnergy,
    });
  });

  return aggregated;
}

/**
 * Transform chart readings to data points for visualization
 */
export function transformToChartData(
  readings: ChartReading[],
  timeRange: '24h' | '7d' | '1m' | '1y'
): ChartDataPoint[] {
  // Aggregate based on time range for non-energy metrics
  let processedReadings: ChartReading[];

  switch (timeRange) {
    case '7d':
      processedReadings = aggregateToHourlyAverages(readings);
      break;
    case '1m':
      processedReadings = aggregateToDailyAverages(readings);
      break;
    case '1y':
      // Yearly view can stay as raw daily readings
      processedReadings = readings;
      break;
    default:
      // 24h view uses raw 15-minute readings
      processedReadings = readings;
  }

  // Transform to chart data points
  return processedReadings.map((reading) => ({
    name: formatChartLabel(reading.id, timeRange),
    power: reading.power,
    voltage: reading.voltage,
    frequency: reading.frequency,
    current: reading.current,
    powerFactor: reading.power_factor,
    timestamp: reading.id,
    energy: reading.energy,
  }));
}

/**
 * Calculate energy consumption from readings
 * Energy is cumulative, so consumption = last - first
 */
export function calculateEnergyConsumption(readings: ChartReading[]): number {
  if (readings.length === 0) return 0;
  if (readings.length === 1) return readings[0].energy;

  const firstReading = readings[0];
  const lastReading = readings[readings.length - 1];

  return lastReading.energy - firstReading.energy;
}

/**
 * Calculate energy consumption per time period (for bar charts)
 */
export function calculateEnergyPerPeriod(readings: ChartReading[]): ChartDataPoint[] {
  if (readings.length === 0) return [];

  const result: ChartDataPoint[] = [];

  for (let i = 1; i < readings.length; i++) {
    const prevReading = readings[i - 1];
    const currReading = readings[i];

    const consumption = currReading.energy - prevReading.energy;

    result.push({
      name: formatChartLabel(currReading.id, '1m'), // Adjust based on time range
      power: currReading.power,
      voltage: currReading.voltage,
      frequency: currReading.frequency,
      current: currReading.current,
      powerFactor: currReading.power_factor,
      timestamp: currReading.id,
      energy: Math.max(0, consumption), // Ensure non-negative
    });
  }

  return result;
}

/**
 * Calculate overall average consumption from readings
 * Used to fill missing time periods
 */
function calculateOverallAverageConsumption(readings: ChartReading[]): number {
  if (readings.length === 0) return 0;

  // Group by time periods and calculate average consumption per period
  const dailyGroups: { [key: string]: ChartReading[] } = {};

  readings.forEach((reading) => {
    const date = parseTimestampFromDocId(reading.id);
    const dayKey = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
    if (!dailyGroups[dayKey]) {
      dailyGroups[dayKey] = [];
    }
    dailyGroups[dayKey].push(reading);
  });

  // Calculate consumption for each day
  const consumptions: number[] = [];
  Object.values(dailyGroups).forEach(group => {
    if (group.length > 0) {
      const sorted = group.sort((a, b) => a.id.localeCompare(b.id));
      const consumption = sorted[sorted.length - 1].energy - sorted[0].energy;
      if (consumption > 0) consumptions.push(consumption);
    }
  });

  if (consumptions.length === 0) return 0;
  return consumptions.reduce((sum, c) => sum + c, 0) / consumptions.length;
}

/**
 * Aggregate energy readings into exactly 24 hourly consumption totals
 * Used for 24-hour view
 */
export function aggregateEnergyByHour(readings: ChartReading[]): ChartDataPoint[] {
  if (readings.length === 0) {
    // Return 24 empty hours with 0 consumption
    return Array.from({ length: 24 }, (_, i) => ({
      name: formatHourLabel(i),
      power: 0,
      voltage: 0,
      frequency: 0,
      current: 0,
      powerFactor: 0,
      timestamp: '',
      energy: 0,
    }));
  }

  // Group readings by hour
  const hourlyGroups: { [hour: number]: ChartReading[] } = {};

  readings.forEach((reading) => {
    const date = parseTimestampFromDocId(reading.id);
    const hour = date.getHours();
    if (!hourlyGroups[hour]) {
      hourlyGroups[hour] = [];
    }
    hourlyGroups[hour].push(reading);
  });

  // Calculate overall average consumption as fallback
  const overallAverage = calculateOverallAverageConsumption(readings);

  // Generate complete 24-hour array
  const result: ChartDataPoint[] = [];

  for (let hour = 0; hour < 24; hour++) {
    const group = hourlyGroups[hour];

    if (group && group.length > 0) {
      // Sort by timestamp
      const sorted = group.sort((a, b) => a.id.localeCompare(b.id));

      // Calculate consumption: last reading - first reading
      const consumption = sorted[sorted.length - 1].energy - sorted[0].energy;

      // Calculate averages for other metrics
      const avgPower = group.reduce((sum, r) => sum + r.power, 0) / group.length;
      const avgVoltage = group.reduce((sum, r) => sum + r.voltage, 0) / group.length;
      const avgFrequency = group.reduce((sum, r) => sum + r.frequency, 0) / group.length;
      const avgCurrent = group.reduce((sum, r) => sum + r.current, 0) / group.length;
      const avgPowerFactor = group.reduce((sum, r) => sum + r.power_factor, 0) / group.length;

      result.push({
        name: formatHourLabel(hour),
        power: avgPower,
        voltage: avgVoltage,
        frequency: avgFrequency,
        current: avgCurrent,
        powerFactor: avgPowerFactor,
        timestamp: sorted[0].id,
        energy: Math.max(0, consumption), // Ensure non-negative
      });
    } else {
      // Use overall average for missing hours
      result.push({
        name: formatHourLabel(hour),
        power: 0,
        voltage: 0,
        frequency: 0,
        current: 0,
        powerFactor: 0,
        timestamp: '',
        energy: overallAverage,
      });
    }
  }

  return result;
}

/**
 * Aggregate energy readings into exactly 7 daily consumption totals
 * Used for 7-day (week) view
 */
export function aggregateEnergyByDay(readings: ChartReading[]): ChartDataPoint[] {
  if (readings.length === 0) {
    // Return 7 empty days with 0 consumption
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return days.map(day => ({
      name: day,
      power: 0,
      voltage: 0,
      frequency: 0,
      current: 0,
      powerFactor: 0,
      timestamp: '',
      energy: 0,
    }));
  }

  // Group readings by day
  const dailyGroups: { [dayKey: string]: ChartReading[] } = {};

  readings.forEach((reading) => {
    const date = parseTimestampFromDocId(reading.id);
    const dayKey = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;

    if (!dailyGroups[dayKey]) {
      dailyGroups[dayKey] = [];
    }
    dailyGroups[dayKey].push(reading);
  });

  // Calculate overall average consumption as fallback
  const overallAverage = calculateOverallAverageConsumption(readings);

  // Generate result for last 7 days
  const result: ChartDataPoint[] = [];
  const now = new Date();

  for (let i = 6; i >= 0; i--) {
    const targetDate = new Date(now);
    targetDate.setDate(now.getDate() - i);
    const dayKey = `${targetDate.getFullYear()}${String(targetDate.getMonth() + 1).padStart(2, '0')}${String(targetDate.getDate()).padStart(2, '0')}`;

    const group = dailyGroups[dayKey];

    if (group && group.length > 0) {
      // Sort by timestamp
      const sorted = group.sort((a, b) => a.id.localeCompare(b.id));

      // Calculate consumption: last reading - first reading
      const consumption = sorted[sorted.length - 1].energy - sorted[0].energy;

      // Calculate averages for other metrics
      const avgPower = group.reduce((sum, r) => sum + r.power, 0) / group.length;
      const avgVoltage = group.reduce((sum, r) => sum + r.voltage, 0) / group.length;
      const avgFrequency = group.reduce((sum, r) => sum + r.frequency, 0) / group.length;
      const avgCurrent = group.reduce((sum, r) => sum + r.current, 0) / group.length;
      const avgPowerFactor = group.reduce((sum, r) => sum + r.power_factor, 0) / group.length;

      result.push({
        name: getDayOfWeekName(targetDate),
        power: avgPower,
        voltage: avgVoltage,
        frequency: avgFrequency,
        current: avgCurrent,
        powerFactor: avgPowerFactor,
        timestamp: sorted[0].id,
        energy: Math.max(0, consumption), // Ensure non-negative
      });
    } else {
      // Use overall average for missing days
      result.push({
        name: getDayOfWeekName(targetDate),
        power: 0,
        voltage: 0,
        frequency: 0,
        current: 0,
        powerFactor: 0,
        timestamp: '',
        energy: overallAverage,
      });
    }
  }

  return result;
}

/**
 * Aggregate energy readings into exactly 30 daily consumption totals
 * Used for 1-month view
 */
export function aggregateEnergyByDayMonthly(readings: ChartReading[]): ChartDataPoint[] {
  if (readings.length === 0) {
    // Return 30 empty days with 0 consumption
    return Array.from({ length: 30 }, (_, i) => ({
      name: `Day ${i + 1}`,
      power: 0,
      voltage: 0,
      frequency: 0,
      current: 0,
      powerFactor: 0,
      timestamp: '',
      energy: 0,
    }));
  }

  // Group readings by day
  const dailyGroups: { [dayKey: string]: ChartReading[] } = {};

  readings.forEach((reading) => {
    const date = parseTimestampFromDocId(reading.id);
    const dayKey = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;

    if (!dailyGroups[dayKey]) {
      dailyGroups[dayKey] = [];
    }
    dailyGroups[dayKey].push(reading);
  });

  // Calculate overall average consumption as fallback
  const overallAverage = calculateOverallAverageConsumption(readings);

  // Generate result for last 30 days
  const result: ChartDataPoint[] = [];
  const now = new Date();

  for (let i = 29; i >= 0; i--) {
    const targetDate = new Date(now);
    targetDate.setDate(now.getDate() - i);
    const dayKey = `${targetDate.getFullYear()}${String(targetDate.getMonth() + 1).padStart(2, '0')}${String(targetDate.getDate()).padStart(2, '0')}`;

    const group = dailyGroups[dayKey];

    if (group && group.length > 0) {
      // Sort by timestamp
      const sorted = group.sort((a, b) => a.id.localeCompare(b.id));

      // Calculate consumption: last reading - first reading
      const consumption = sorted[sorted.length - 1].energy - sorted[0].energy;

      // Calculate averages for other metrics
      const avgPower = group.reduce((sum, r) => sum + r.power, 0) / group.length;
      const avgVoltage = group.reduce((sum, r) => sum + r.voltage, 0) / group.length;
      const avgFrequency = group.reduce((sum, r) => sum + r.frequency, 0) / group.length;
      const avgCurrent = group.reduce((sum, r) => sum + r.current, 0) / group.length;
      const avgPowerFactor = group.reduce((sum, r) => sum + r.power_factor, 0) / group.length;

      result.push({
        name: `${getMonthName(targetDate)} ${targetDate.getDate()}`,
        power: avgPower,
        voltage: avgVoltage,
        frequency: avgFrequency,
        current: avgCurrent,
        powerFactor: avgPowerFactor,
        timestamp: sorted[0].id,
        energy: Math.max(0, consumption), // Ensure non-negative
      });
    } else {
      // Use overall average for missing days
      result.push({
        name: `${getMonthName(targetDate)} ${targetDate.getDate()}`,
        power: 0,
        voltage: 0,
        frequency: 0,
        current: 0,
        powerFactor: 0,
        timestamp: '',
        energy: overallAverage,
      });
    }
  }

  return result;
}

/**
 * Aggregate energy readings into exactly 12 monthly consumption totals
 * Used for 1-year view
 * Note: Yearly readings are daily snapshots (365 readings, one per day)
 */
export function aggregateEnergyByMonth(readings: ChartReading[]): ChartDataPoint[] {
  if (readings.length === 0) {
    // Return 12 empty months with 0 consumption
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return months.map(month => ({
      name: month,
      power: 0,
      voltage: 0,
      frequency: 0,
      current: 0,
      powerFactor: 0,
      timestamp: '',
      energy: 0,
    }));
  }

  // Sort all readings by timestamp first
  const sortedReadings = [...readings].sort((a, b) => a.id.localeCompare(b.id));

  // Group readings by month
  const monthlyGroups: { [monthKey: string]: ChartReading[] } = {};

  sortedReadings.forEach((reading) => {
    const date = parseTimestampFromDocId(reading.id);
    const monthKey = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}`;

    if (!monthlyGroups[monthKey]) {
      monthlyGroups[monthKey] = [];
    }
    monthlyGroups[monthKey].push(reading);
  });

  // Calculate overall average consumption as fallback
  const overallAverage = calculateOverallAverageConsumption(readings);

  // Generate result for last 12 months
  const result: ChartDataPoint[] = [];
  const now = new Date();

  for (let i = 11; i >= 0; i--) {
    const targetDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthKey = `${targetDate.getFullYear()}${String(targetDate.getMonth() + 1).padStart(2, '0')}`;

    const group = monthlyGroups[monthKey];

    if (group && group.length > 0) {
      // For yearly data, readings are daily snapshots
      // Calculate total consumption by summing daily deltas
      let monthlyConsumption = 0;

      for (let j = 1; j < group.length; j++) {
        const dailyConsumption = group[j].energy - group[j - 1].energy;
        monthlyConsumption += Math.max(0, dailyConsumption);
      }

      // Calculate averages for other metrics
      const avgPower = group.reduce((sum, r) => sum + r.power, 0) / group.length;
      const avgVoltage = group.reduce((sum, r) => sum + r.voltage, 0) / group.length;
      const avgFrequency = group.reduce((sum, r) => sum + r.frequency, 0) / group.length;
      const avgCurrent = group.reduce((sum, r) => sum + r.current, 0) / group.length;
      const avgPowerFactor = group.reduce((sum, r) => sum + r.power_factor, 0) / group.length;

      result.push({
        name: getMonthName(targetDate),
        power: avgPower,
        voltage: avgVoltage,
        frequency: avgFrequency,
        current: avgCurrent,
        powerFactor: avgPowerFactor,
        timestamp: group[0].id,
        energy: monthlyConsumption,
      });
    } else {
      // Use overall average for missing months
      result.push({
        name: getMonthName(targetDate),
        power: 0,
        voltage: 0,
        frequency: 0,
        current: 0,
        powerFactor: 0,
        timestamp: '',
        energy: overallAverage,
      });
    }
  }

  return result;
}
