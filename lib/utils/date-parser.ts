/**
 * Parse timestamp from Firestore document ID
 * Handles multiple formats:
 * - "20251030T074839" (YYYYMMDDTHHmmss) - 15 minutes interval
 * - "20251024T0943" (YYYYMMDDTHHmm) - Hourly interval
 * - "20241101" (YYYYMMDD) - Daily interval
 */
export function parseTimestampFromDocId(docId: string): Date {
  // Remove 'T' for easier parsing
  const cleaned = docId.replace('T', '');

  let year: number, month: number, day: number, hour: number = 0, minute: number = 0, second: number = 0;

  if (cleaned.length === 14) {
    // Format: YYYYMMDDHHmmss (with seconds)
    year = parseInt(cleaned.substring(0, 4));
    month = parseInt(cleaned.substring(4, 6)) - 1; // Month is 0-indexed
    day = parseInt(cleaned.substring(6, 8));
    hour = parseInt(cleaned.substring(8, 10));
    minute = parseInt(cleaned.substring(10, 12));
    second = parseInt(cleaned.substring(12, 14));
  } else if (cleaned.length === 12) {
    // Format: YYYYMMDDHHmm (without seconds)
    year = parseInt(cleaned.substring(0, 4));
    month = parseInt(cleaned.substring(4, 6)) - 1;
    day = parseInt(cleaned.substring(6, 8));
    hour = parseInt(cleaned.substring(8, 10));
    minute = parseInt(cleaned.substring(10, 12));
  } else if (cleaned.length === 8) {
    // Format: YYYYMMDD (date only)
    year = parseInt(cleaned.substring(0, 4));
    month = parseInt(cleaned.substring(4, 6)) - 1;
    day = parseInt(cleaned.substring(6, 8));
  } else {
    throw new Error(`Invalid document ID format: ${docId}`);
  }

  return new Date(year, month, day, hour, minute, second);
}

/**
 * Format timestamp to readable string
 * Returns: "10/30/2025, 7:48:39 AM"
 */
export function formatTimestamp(docId: string): string {
  const date = parseTimestampFromDocId(docId);
  return date.toLocaleString('en-US', {
    month: '2-digit',
    day: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });
}

/**
 * Format time only
 * Returns: "07:48" (HH:mm)
 */
export function formatTimeOnly(docId: string): string {
  const date = parseTimestampFromDocId(docId);
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

/**
 * Format date only
 * Returns: "10/30/2025" (MM/DD/YYYY)
 */
export function formatDateOnly(docId: string): string {
  const date = parseTimestampFromDocId(docId);
  return date.toLocaleDateString('en-US', {
    month: '2-digit',
    day: '2-digit',
    year: 'numeric',
  });
}

/**
 * Format for chart labels based on time range
 */
export function formatChartLabel(docId: string, timeRange: '24h' | '7d' | '1m' | '1y'): string {
  const date = parseTimestampFromDocId(docId);

  switch (timeRange) {
    case '24h':
      return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });
    case '7d':
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
      });
    case '1m':
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });
    case '1y':
      return date.toLocaleDateString('en-US', {
        month: 'short',
        year: 'numeric',
      });
    default:
      return date.toLocaleDateString();
  }
}

/**
 * Get day of week name from Date
 * Returns: "Mon", "Tue", "Wed", etc.
 */
export function getDayOfWeekName(date: Date): string {
  return date.toLocaleDateString('en-US', { weekday: 'short' });
}

/**
 * Get month name from Date
 * Returns: "Jan", "Feb", "Mar", etc.
 */
export function getMonthName(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short' });
}

/**
 * Format hour as label
 * Returns: "00:00", "01:00", etc.
 */
export function formatHourLabel(hour: number): string {
  return `${String(hour).padStart(2, '0')}:00`;
}
