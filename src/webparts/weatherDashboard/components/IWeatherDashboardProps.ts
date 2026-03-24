import { HttpClient, SPHttpClient } from '@microsoft/sp-http';
import { ICityResult } from '../models/IWeatherData';

export interface IWeatherDashboardProps {
  /** Web part title displayed above the dashboard */
  title: string;
  /** Default city to load on first render */
  defaultCity: string;
  /** Auto-refresh interval in minutes (0 = disabled) */
  refreshInterval: number;
  /** SharePoint document library name for saving reports */
  reportLibrary: string;
  /** SPFx HttpClient for external API calls */
  httpClient: HttpClient;
  /** SPFx SPHttpClient for SharePoint API calls */
  spHttpClient: SPHttpClient;
  /** Current SharePoint site absolute URL */
  siteUrl: string;
  /** Server-relative URL of the site (e.g., /sites/TravelHub) */
  siteServerRelativeUrl: string;
  /** Callback to persist saved cities to web part properties */
  onCitiesChanged: (cities: ICityResult[]) => void;
  /** Previously saved cities to restore on load */
  savedCities: string;
  /** Whether the current theme is dark */
  isDarkTheme: boolean;
}
