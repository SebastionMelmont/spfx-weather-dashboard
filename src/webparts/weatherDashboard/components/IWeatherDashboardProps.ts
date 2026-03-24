import { HttpClient, SPHttpClient } from '@microsoft/sp-http';

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
  /** Current SharePoint site URL */
  siteUrl: string;
  /** Whether the current theme is dark */
  isDarkTheme: boolean;
}
