import { getWeatherInfo } from '../helpers/weatherCodes';

describe('getWeatherInfo', () => {
  // Clear conditions
  it('returns correct info for clear sky (code 0)', () => {
    const info = getWeatherInfo(0);
    expect(info.description).toBe('Clear sky');
    expect(info.icon).toBeTruthy();
  });

  it('returns correct info for mainly clear (code 1)', () => {
    const info = getWeatherInfo(1);
    expect(info.description).toBe('Mainly clear');
  });

  it('returns correct info for partly cloudy (code 2)', () => {
    const info = getWeatherInfo(2);
    expect(info.description).toBe('Partly cloudy');
  });

  it('returns correct info for overcast (code 3)', () => {
    const info = getWeatherInfo(3);
    expect(info.description).toBe('Overcast');
  });

  // Fog
  it('returns correct info for fog codes', () => {
    expect(getWeatherInfo(45).description).toBe('Foggy');
    expect(getWeatherInfo(48).description).toBe('Depositing rime fog');
  });

  // Drizzle
  it('returns correct info for drizzle codes', () => {
    expect(getWeatherInfo(51).description).toBe('Light drizzle');
    expect(getWeatherInfo(53).description).toBe('Moderate drizzle');
    expect(getWeatherInfo(55).description).toBe('Dense drizzle');
  });

  // Rain
  it('returns correct info for rain codes', () => {
    expect(getWeatherInfo(61).description).toBe('Slight rain');
    expect(getWeatherInfo(63).description).toBe('Moderate rain');
    expect(getWeatherInfo(65).description).toBe('Heavy rain');
  });

  // Freezing rain
  it('returns correct info for freezing rain codes', () => {
    expect(getWeatherInfo(56).description).toBe('Light freezing drizzle');
    expect(getWeatherInfo(57).description).toBe('Dense freezing drizzle');
    expect(getWeatherInfo(66).description).toBe('Light freezing rain');
    expect(getWeatherInfo(67).description).toBe('Heavy freezing rain');
  });

  // Snow
  it('returns correct info for snow codes', () => {
    expect(getWeatherInfo(71).description).toBe('Slight snow fall');
    expect(getWeatherInfo(73).description).toBe('Moderate snow fall');
    expect(getWeatherInfo(75).description).toBe('Heavy snow fall');
    expect(getWeatherInfo(77).description).toBe('Snow grains');
  });

  // Showers
  it('returns correct info for shower codes', () => {
    expect(getWeatherInfo(80).description).toBe('Slight rain showers');
    expect(getWeatherInfo(81).description).toBe('Moderate rain showers');
    expect(getWeatherInfo(82).description).toBe('Violent rain showers');
    expect(getWeatherInfo(85).description).toBe('Slight snow showers');
    expect(getWeatherInfo(86).description).toBe('Heavy snow showers');
  });

  // Thunderstorms
  it('returns correct info for thunderstorm codes', () => {
    expect(getWeatherInfo(95).description).toBe('Thunderstorm');
    expect(getWeatherInfo(96).description).toBe('Thunderstorm with slight hail');
    expect(getWeatherInfo(99).description).toBe('Thunderstorm with heavy hail');
  });

  // Unknown codes
  it('returns Unknown for unrecognised weather codes', () => {
    const info = getWeatherInfo(999);
    expect(info.description).toBe('Unknown');
    expect(info.icon).toBe('❓');
  });

  it('returns Unknown for negative codes', () => {
    expect(getWeatherInfo(-1).description).toBe('Unknown');
  });

  // All known codes have icons
  it('all known codes have non-empty icons', () => {
    const knownCodes = [0, 1, 2, 3, 45, 48, 51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 71, 73, 75, 77, 80, 81, 82, 85, 86, 95, 96, 99];
    knownCodes.forEach(code => {
      const info = getWeatherInfo(code);
      expect(info.icon).toBeTruthy();
      expect(info.icon).not.toBe('❓');
    });
  });
});
