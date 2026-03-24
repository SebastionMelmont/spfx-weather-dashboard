/** Represents a geocoded city result from Open-Meteo */
export interface ICityResult {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  country: string;
  admin1?: string; // region/state
  timezone?: string; // IANA timezone e.g. "Pacific/Auckland"
}

/** Current weather data from Open-Meteo */
export interface IWeatherData {
  temperature: number;
  temperatureHigh: number;
  temperatureLow: number;
  windSpeed: number;
  weatherCode: number;
  humidity: number;
  uvIndex: number;
}

/** Single day forecast from Open-Meteo */
export interface IDailyForecast {
  date: string; // ISO date string e.g. "2026-03-25"
  weatherCode: number;
  temperatureHigh: number;
  temperatureLow: number;
  precipitationProbability: number;
}

/** A city card in the dashboard with its weather */
export interface ICityWeather {
  id: string;
  city: ICityResult;
  weather: IWeatherData | undefined;
  forecast: IDailyForecast[] | undefined;
  isLoading: boolean;
  error: string | undefined;
  lastUpdated: Date | undefined;
}
