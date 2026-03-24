/**
 * Format a Date to NZ regional format: DD/MM/YYYY hh:mm AM/PM (NZST/NZDT).
 * @param date - The date to format
 * @returns Formatted NZ date/time string
 */
export function formatNZDateTime(date: Date): string {
  return date.toLocaleString('en-NZ', {
    timeZone: 'Pacific/Auckland',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Get UV index severity label.
 * @param uvIndex - The UV index value
 * @returns Severity label string
 */
export function getUVLabel(uvIndex: number): string {
  if (uvIndex <= 2) return 'Low';
  if (uvIndex <= 5) return 'Moderate';
  if (uvIndex <= 7) return 'High';
  if (uvIndex <= 10) return 'Very High';
  return 'Extreme';
}

/**
 * Generate a unique ID for a city card.
 * @returns A simple unique identifier
 */
export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}
