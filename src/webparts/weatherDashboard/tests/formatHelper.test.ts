import { getUVLabel, generateId, formatLocalTime, getDayName } from '../helpers/formatHelper';

describe('getUVLabel', () => {
  it('returns Low for UV 0-2', () => {
    expect(getUVLabel(0)).toBe('Low');
    expect(getUVLabel(1)).toBe('Low');
    expect(getUVLabel(2)).toBe('Low');
  });

  it('returns Moderate for UV 3-5', () => {
    expect(getUVLabel(3)).toBe('Moderate');
    expect(getUVLabel(4)).toBe('Moderate');
    expect(getUVLabel(5)).toBe('Moderate');
  });

  it('returns High for UV 6-7', () => {
    expect(getUVLabel(6)).toBe('High');
    expect(getUVLabel(7)).toBe('High');
  });

  it('returns Very High for UV 8-10', () => {
    expect(getUVLabel(8)).toBe('Very High');
    expect(getUVLabel(9)).toBe('Very High');
    expect(getUVLabel(10)).toBe('Very High');
  });

  it('returns Extreme for UV above 10', () => {
    expect(getUVLabel(11)).toBe('Extreme');
    expect(getUVLabel(14)).toBe('Extreme');
  });

  it('handles decimal UV values', () => {
    expect(getUVLabel(2.5)).toBe('Moderate');
    expect(getUVLabel(5.5)).toBe('High');
    expect(getUVLabel(7.9)).toBe('Very High');
    expect(getUVLabel(0.5)).toBe('Low');
  });
});

describe('generateId', () => {
  it('returns a non-empty string', () => {
    const id = generateId();
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
  });

  it('returns unique IDs on successive calls', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 100; i++) {
      ids.add(generateId());
    }
    // All 100 should be unique
    expect(ids.size).toBe(100);
  });
});

describe('formatLocalTime', () => {
  it('returns a non-empty string for valid timezone', () => {
    const time = formatLocalTime('Pacific/Auckland');
    expect(time.length).toBeGreaterThan(0);
  });

  it('returns time in 12-hour format with am/pm', () => {
    const time = formatLocalTime('Pacific/Auckland');
    expect(time).toMatch(/\d{1,2}:\d{2}\s?(am|pm)/i);
  });

  it('returns empty string for invalid timezone', () => {
    const time = formatLocalTime('Invalid/Timezone');
    expect(time).toBe('');
  });

  it('works with different timezones', () => {
    const nzTime = formatLocalTime('Pacific/Auckland');
    const utcTime = formatLocalTime('UTC');
    // Both should return valid time strings
    expect(nzTime.length).toBeGreaterThan(0);
    expect(utcTime.length).toBeGreaterThan(0);
  });
});

describe('getDayName', () => {
  it('returns a 3-letter day abbreviation', () => {
    const day = getDayName('2026-03-24');
    expect(day.length).toBeLessThanOrEqual(4); // "Tue" or "Tue."
    expect(day.length).toBeGreaterThan(0);
  });

  it('returns correct day for known dates', () => {
    // 24 March 2026 is a Tuesday
    const day = getDayName('2026-03-24');
    expect(day.toLowerCase()).toContain('tue');
  });

  it('handles different dates', () => {
    const mon = getDayName('2026-03-23');
    const wed = getDayName('2026-03-25');
    expect(mon.toLowerCase()).toContain('mon');
    expect(wed.toLowerCase()).toContain('wed');
  });
});
