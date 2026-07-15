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
  let normalized = String(roundedHours);

  if (!Number.isInteger(roundedHours)) {
    const fixed = roundedHours.toFixed(2);
    const [wholePart, decimalPart = ''] = fixed.split('.');

    if (decimalPart === '00') {
      normalized = wholePart;
    } else if (decimalPart.endsWith('0')) {
      normalized = `${wholePart}.${decimalPart[0]}`;
    } else {
      normalized = fixed;
    }
  }

  return `${normalized}h`;
}

/**
 * Returns English ordinal suffix for a day number.
 * e.g. 1 -> st, 2 -> nd, 3 -> rd, 11 -> th
 */
export function getOrdinalSuffix(day: number): string {
  const lastTwoDigits = day % 100;
  if (lastTwoDigits >= 11 && lastTwoDigits <= 13) {
    return 'th';
  }

  switch (day % 10) {
    case 1:
      return 'st';
    case 2:
      return 'nd';
    case 3:
      return 'rd';
    default:
      return 'th';
  }
}

/**
 * Formats ISO-like date strings to "Mon 3rd, 2026".
 * e.g. 2026-07-03T00:00:00.000+07:00 -> Jul 3rd, 2026
 */
export function formatIsoDateToEnglishWithOrdinal(rawDate: string): string | undefined {
  const normalized = String(rawDate || '').trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(normalized);
  if (!match) {
    return undefined;
  }

  const [, year, month, day] = match;
  const monthNumber = Number(month);
  const dayNumber = Number(day);
  if (!Number.isInteger(monthNumber) || monthNumber < 1 || monthNumber > 12) {
    return undefined;
  }
  if (!Number.isInteger(dayNumber) || dayNumber < 1 || dayNumber > 31) {
    return undefined;
  }

  const monthText = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ][monthNumber - 1];

  return `${monthText} ${dayNumber}${getOrdinalSuffix(dayNumber)}, ${year}`;
}
