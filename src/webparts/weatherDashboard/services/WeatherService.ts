import { HttpClient, HttpClientResponse } from '@microsoft/sp-http';
import { ICityResult, IWeatherData } from '../models/IWeatherData';

const GEOCODING_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const WEATHER_URL = 'https://api.open-meteo.com/v1/forecast';

/**
 * Service for fetching weather data from the Open-Meteo API.
 * Uses SPFx HttpClient for external API calls.
 */
export class WeatherService {
  private httpClient: HttpClient;

  constructor(httpClient: HttpClient) {
    this.httpClient = httpClient;
  }

  /**
   * Search for cities by name using the Open-Meteo Geocoding API.
   * @param query - City name to search for
   * @param count - Maximum number of results (default 5)
   * @returns Array of matching city results
   */
  public async searchCities(query: string, count: number = 5): Promise<ICityResult[]> {
    if (!query || query.trim().length < 2) {
      return [];
    }

    const url = `${GEOCODING_URL}?name=${encodeURIComponent(query.trim())}&count=${count}&language=en&format=json`;

    try {
      const response: HttpClientResponse = await this.httpClient.get(
        url,
        HttpClient.configurations.v1
      );

      if (!response.ok) {
        throw new Error(`Geocoding API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      if (!data.results || !Array.isArray(data.results)) {
        return [];
      }

      return data.results.map((r: Record<string, unknown>) => ({
        id: r.id as number,
        name: r.name as string,
        latitude: r.latitude as number,
        longitude: r.longitude as number,
        country: r.country as string,
        admin1: (r.admin1 as string) || undefined,
      }));
    } catch (error) {
      console.error('City search failed:', error);
      throw new Error(`Failed to search for city "${query}". Please check your network connection.`);
    }
  }

  /**
   * Fetch current weather for the given coordinates.
   * Uses the Open-Meteo current= parameter for temp, wind, humidity, weather code, and UV.
   * @param latitude - Latitude of the location
   * @param longitude - Longitude of the location
   * @returns Current weather data
   */
  public async fetchWeather(latitude: number, longitude: number): Promise<IWeatherData> {
    const params = [
      `latitude=${latitude}`,
      `longitude=${longitude}`,
      'current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,uv_index',
      'timezone=Pacific/Auckland',
      'temperature_unit=celsius',
      'wind_speed_unit=kmh',
    ].join('&');

    const url = `${WEATHER_URL}?${params}`;

    try {
      const response: HttpClientResponse = await this.httpClient.get(
        url,
        HttpClient.configurations.v1
      );

      if (!response.ok) {
        throw new Error(`Weather API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      if (!data.current) {
        throw new Error('Weather API returned no current data');
      }

      const current = data.current;
      return {
        temperature: current.temperature_2m,
        windSpeed: current.wind_speed_10m,
        weatherCode: current.weather_code,
        humidity: current.relative_humidity_2m,
        uvIndex: current.uv_index,
      };
    } catch (error) {
      console.error('Weather fetch failed:', error);
      throw new Error('Failed to fetch weather data. Please try again.');
    }
  }
}
