/**
 * Strips parenthetical suffixes from Jira display names.
 * Limits custom names to at most two words.
 * e.g. "Nguyen Van A (contractor)" → "Nguyen Van"
 */
export function normalizeAuthorName(rawName: string): string {
  const name = rawName.trim();
  const withoutSuffix = name.split('(')[0]?.trim();

  if (!withoutSuffix) {
    return name;
  }

  const words = withoutSuffix.split(/\s+/).filter(Boolean);
  if (words.length <= 2) {
    return withoutSuffix;
  }

  return `${words[0]} ${words[1]}`;
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
