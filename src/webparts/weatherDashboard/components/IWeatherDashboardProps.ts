import { HttpClient } from '@microsoft/sp-http';
import { ICityResult } from '../models/IWeatherData';

export interface IWeatherDashboardProps {
  /** Web part title displayed above the dashboard */
  title: string;
  /** Default city to load on first render */
  defaultCity: string;
  /** Auto-refresh interval in minutes (0 = disabled) */
  refreshInterval: number;
  /** SPFx HttpClient for external API calls */
  httpClient: HttpClient;
  /** Callback to persist saved cities to web part properties */
  onCitiesChanged: (cities: ICityResult[]) => void;
  /** Previously saved cities JSON string */
  savedCities: string;
  /** Whether the current theme is dark */
  isDarkTheme: boolean;
}
