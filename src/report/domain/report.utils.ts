/**
 * Strips parenthetical suffixes from Jira display names.
 * e.g. "Nguyen Van A (contractor)" → "Nguyen Van A"
 */
export function normalizeAuthorName(rawName: string): string {
  const name = rawName.trim();
  return name.split('(')[0]?.trim() || name;
}

/**
 * Converts total seconds to a human-readable hours string.
 * e.g. 5400 → "1.5h", 4800 → "1.33h"
 */
export function formatHoursFromSeconds(totalSeconds: number): string {
  const hours = totalSeconds / 3600;
  const roundedHours = Math.round(hours * 100) / 100;
  const normalized = Number.isInteger(roundedHours)
    ? String(roundedHours)
    : roundedHours.toFixed(2).replace(/\.0+$|0+$/g, '');

  return `${normalized}h`;
}
