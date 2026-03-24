import { HttpClient, HttpClientResponse } from '@microsoft/sp-http';
import { ICityResult, IWeatherData, IDailyForecast } from '../models/IWeatherData';

const GEOCODING_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const WEATHER_URL = 'https://api.open-meteo.com/v1/forecast';

export interface IWeatherResponse {
  current: IWeatherData;
  forecast: IDailyForecast[];
}

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
        timezone: (r.timezone as string) || undefined,
      }));
    } catch (error) {
      console.error('City search failed:', error);
      throw new Error(`Failed to search for city "${query}". Please check your network connection.`);
    }
  }

  /**
   * Fetch current weather and 5-day forecast for the given coordinates.
   * @param latitude - Latitude of the location
   * @param longitude - Longitude of the location
   * @param timezone - IANA timezone for the location (default: auto)
   * @returns Current weather data plus 5-day forecast
   */
  public async fetchWeather(latitude: number, longitude: number, timezone?: string): Promise<IWeatherResponse> {
    const tz = timezone || 'auto';
    const params = [
      `latitude=${latitude}`,
      `longitude=${longitude}`,
      'current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,uv_index',
      'daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max',
      `timezone=${encodeURIComponent(tz)}`,
      'temperature_unit=celsius',
      'wind_speed_unit=kmh',
      'forecast_days=6',
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

      // Today's high/low from the daily data
      const todayHigh = data.daily?.temperature_2m_max?.[0] ?? current.temperature_2m;
      const todayLow = data.daily?.temperature_2m_min?.[0] ?? current.temperature_2m;

      const weather: IWeatherData = {
        temperature: current.temperature_2m,
        temperatureHigh: todayHigh,
        temperatureLow: todayLow,
        windSpeed: current.wind_speed_10m,
        weatherCode: current.weather_code,
        humidity: current.relative_humidity_2m,
        uvIndex: current.uv_index,
      };

      // Parse 5-day forecast (skip today = index 0, take indices 1-5)
      const forecast: IDailyForecast[] = [];
      if (data.daily?.time) {
        const days = Math.min(data.daily.time.length, 6);
        for (let i = 1; i < days; i++) {
          forecast.push({
            date: data.daily.time[i],
            weatherCode: data.daily.weather_code[i],
            temperatureHigh: data.daily.temperature_2m_max[i],
            temperatureLow: data.daily.temperature_2m_min[i],
            precipitationProbability: data.daily.precipitation_probability_max?.[i] ?? 0,
          });
        }
      }

      return { current: weather, forecast };
    } catch (error) {
      console.error('Weather fetch failed:', error);
      throw new Error('Failed to fetch weather data. Please try again.');
    }
  }
}
