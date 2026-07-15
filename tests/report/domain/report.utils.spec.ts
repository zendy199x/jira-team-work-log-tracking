import {
    formatHoursFromSeconds,
    formatIsoDateToEnglishWithOrdinal,
    getOrdinalSuffix,
    normalizeAuthorName,
} from '../../../src/report/domain/report.utils';

describe('report.utils', () => {
  it('normalizes author names with suffix and long names', () => {
    expect(normalizeAuthorName('Alice Nguyen (BKM4)')).toBe('Alice Nguyen');
    expect(normalizeAuthorName('Nguyen Van A')).toBe('Nguyen Van');
  });

  it('formats hours with integer and decimal outputs', () => {
    expect(formatHoursFromSeconds(3600)).toBe('1h');
    expect(formatHoursFromSeconds(4320)).toBe('1.2h');
    expect(formatHoursFromSeconds(4799)).toBe('1.33h');
  });

  it('normalizes decimal .00 when number is treated as non-integer', () => {
    const isIntegerSpy = jest.spyOn(Number, 'isInteger').mockReturnValue(false);

    expect(formatHoursFromSeconds(3600)).toBe('1h');

    isIntegerSpy.mockRestore();
  });

  it('handles NaN seconds input safely', () => {
    expect(formatHoursFromSeconds(Number.NaN)).toBe('NaNh');
  });

  it('returns correct ordinal suffixes including special teen days', () => {
    expect(getOrdinalSuffix(1)).toBe('st');
    expect(getOrdinalSuffix(2)).toBe('nd');
    expect(getOrdinalSuffix(3)).toBe('rd');
    expect(getOrdinalSuffix(11)).toBe('th');
    expect(getOrdinalSuffix(12)).toBe('th');
    expect(getOrdinalSuffix(13)).toBe('th');
    expect(getOrdinalSuffix(21)).toBe('st');
  });

  it('formats ISO-like date with month text and ordinal day', () => {
    expect(formatIsoDateToEnglishWithOrdinal('2026-07-03T00:00:00.000+07:00')).toBe('Jul 3rd, 2026');
  });

  it('returns undefined for invalid date patterns and invalid month/day', () => {
    expect(formatIsoDateToEnglishWithOrdinal('invalid-date')).toBeUndefined();
    expect(formatIsoDateToEnglishWithOrdinal(undefined as unknown as string)).toBeUndefined();
    expect(formatIsoDateToEnglishWithOrdinal('2026-13-03')).toBeUndefined();
    expect(formatIsoDateToEnglishWithOrdinal('2026-07-00')).toBeUndefined();
    expect(formatIsoDateToEnglishWithOrdinal('2026-07-32')).toBeUndefined();
  });
});
