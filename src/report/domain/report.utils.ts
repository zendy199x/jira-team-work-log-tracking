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
 * e.g. 5400 → "1.5h"
 */
export function formatHoursFromSeconds(totalSeconds: number): string {
  return `${totalSeconds / 3600}h`;
}
