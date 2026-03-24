import { WeatherService } from '../services/WeatherService';
import { HttpClient } from '@microsoft/sp-http';

// Mock HttpClient
function createMockHttpClient(responseData: unknown, ok: boolean = true, status: number = 200): HttpClient {
  return {
    get: jest.fn().mockResolvedValue({
      ok,
      status,
      statusText: ok ? 'OK' : 'Error',
      json: jest.fn().mockResolvedValue(responseData),
    }),
  } as unknown as HttpClient;
}

describe('WeatherService', () => {
  describe('searchCities', () => {
    it('returns parsed city results from API response', async () => {
      const mockResponse = {
        results: [
          {
            id: 2193733,
            name: 'Auckland',
            latitude: -36.8485,
            longitude: 174.7633,
            country: 'New Zealand',
            admin1: 'Auckland',
          },
        ],
      };

      const httpClient = createMockHttpClient(mockResponse);
      const service = new WeatherService(httpClient);
      const results = await service.searchCities('Auckland');

      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Auckland');
      expect(results[0].latitude).toBe(-36.8485);
      expect(results[0].longitude).toBe(174.7633);
      expect(results[0].country).toBe('New Zealand');
      expect(results[0].admin1).toBe('Auckland');
    });

    it('returns empty array for short queries', async () => {
      const httpClient = createMockHttpClient({});
      const service = new WeatherService(httpClient);

      expect(await service.searchCities('')).toEqual([]);
      expect(await service.searchCities('a')).toEqual([]);
      // httpClient.get should NOT have been called
      expect(httpClient.get).not.toHaveBeenCalled();
    });

    it('returns empty array when API returns no results', async () => {
      const httpClient = createMockHttpClient({ results: [] });
      const service = new WeatherService(httpClient);
      const results = await service.searchCities('xyznonexistent');
      expect(results).toEqual([]);
    });

    it('returns empty array when API returns no results key', async () => {
      const httpClient = createMockHttpClient({});
      const service = new WeatherService(httpClient);
      const results = await service.searchCities('xyznonexistent');
      expect(results).toEqual([]);
    });

    it('handles multiple results', async () => {
      const mockResponse = {
        results: [
          { id: 1, name: 'Napier', latitude: -39.49, longitude: 176.91, country: 'New Zealand', admin1: "Hawke's Bay" },
          { id: 2, name: 'Napier', latitude: 38.35, longitude: -81.1, country: 'United States', admin1: 'West Virginia' },
        ],
      };

      const httpClient = createMockHttpClient(mockResponse);
      const service = new WeatherService(httpClient);
      const results = await service.searchCities('Napier');

      expect(results).toHaveLength(2);
      expect(results[0].country).toBe('New Zealand');
      expect(results[1].country).toBe('United States');
    });

    it('throws on API error', async () => {
      const httpClient = createMockHttpClient({}, false, 500);
      const service = new WeatherService(httpClient);

      await expect(service.searchCities('Auckland')).rejects.toThrow('Failed to search for city');
    });

    it('passes correct URL with encoded query', async () => {
      const httpClient = createMockHttpClient({ results: [] });
      const service = new WeatherService(httpClient);
      await service.searchCities('New Plymouth');

      expect(httpClient.get).toHaveBeenCalledWith(
        expect.stringContaining('name=New%20Plymouth'),
        expect.anything()
      );
    });

    it('respects count parameter', async () => {
      const httpClient = createMockHttpClient({ results: [] });
      const service = new WeatherService(httpClient);
      await service.searchCities('Auckland', 3);

      expect(httpClient.get).toHaveBeenCalledWith(
        expect.stringContaining('count=3'),
        expect.anything()
      );
    });

    it('handles missing admin1 field gracefully', async () => {
      const mockResponse = {
        results: [
          { id: 1, name: 'Test', latitude: 0, longitude: 0, country: 'Test' },
        ],
      };

      const httpClient = createMockHttpClient(mockResponse);
      const service = new WeatherService(httpClient);
      const results = await service.searchCities('Test');

      expect(results[0].admin1).toBeUndefined();
    });
  });

  describe('fetchWeather', () => {
    it('returns parsed weather data from API response', async () => {
      const mockResponse = {
        current: {
          temperature_2m: 22.3,
          wind_speed_10m: 20.9,
          weather_code: 3,
          relative_humidity_2m: 46,
          uv_index: 5.85,
        },
      };

      const httpClient = createMockHttpClient(mockResponse);
      const service = new WeatherService(httpClient);
      const weather = await service.fetchWeather(-36.8485, 174.7633);

      expect(weather.temperature).toBe(22.3);
      expect(weather.windSpeed).toBe(20.9);
      expect(weather.weatherCode).toBe(3);
      expect(weather.humidity).toBe(46);
      expect(weather.uvIndex).toBe(5.85);
    });

    it('passes coordinates in the API URL', async () => {
      const mockResponse = { current: { temperature_2m: 20, wind_speed_10m: 10, weather_code: 0, relative_humidity_2m: 50, uv_index: 3 } };
      const httpClient = createMockHttpClient(mockResponse);
      const service = new WeatherService(httpClient);
      await service.fetchWeather(-36.85, 174.76);

      expect(httpClient.get).toHaveBeenCalledWith(
        expect.stringContaining('latitude=-36.85'),
        expect.anything()
      );
      expect(httpClient.get).toHaveBeenCalledWith(
        expect.stringContaining('longitude=174.76'),
        expect.anything()
      );
    });

    it('requests NZ timezone and celsius units', async () => {
      const mockResponse = { current: { temperature_2m: 20, wind_speed_10m: 10, weather_code: 0, relative_humidity_2m: 50, uv_index: 3 } };
      const httpClient = createMockHttpClient(mockResponse);
      const service = new WeatherService(httpClient);
      await service.fetchWeather(0, 0);

      const callUrl = (httpClient.get as jest.Mock).mock.calls[0][0] as string;
      expect(callUrl).toContain('timezone=Pacific/Auckland');
      expect(callUrl).toContain('temperature_unit=celsius');
      expect(callUrl).toContain('wind_speed_unit=kmh');
    });

    it('throws when API returns no current data', async () => {
      const httpClient = createMockHttpClient({});
      const service = new WeatherService(httpClient);

      await expect(service.fetchWeather(0, 0)).rejects.toThrow('Failed to fetch weather data');
    });

    it('throws on API error response', async () => {
      const httpClient = createMockHttpClient({}, false, 500);
      const service = new WeatherService(httpClient);

      await expect(service.fetchWeather(0, 0)).rejects.toThrow('Failed to fetch weather data');
    });
  });
});
