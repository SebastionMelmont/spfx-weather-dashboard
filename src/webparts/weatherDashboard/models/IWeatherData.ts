/** Represents a geocoded city result from Open-Meteo */
export interface ICityResult {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  country: string;
  admin1?: string; // region/state
}

/** Current weather data from Open-Meteo */
export interface IWeatherData {
  temperature: number;
  windSpeed: number;
  weatherCode: number;
  humidity: number;
  uvIndex: number;
}

/** A city card in the dashboard with its weather */
export interface ICityWeather {
  id: string;
  city: ICityResult;
  weather: IWeatherData | undefined;
  isLoading: boolean;
  error: string | undefined;
  lastUpdated: Date | undefined;
}
