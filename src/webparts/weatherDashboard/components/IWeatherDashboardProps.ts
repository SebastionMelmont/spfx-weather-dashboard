import { HttpClient, SPHttpClient } from '@microsoft/sp-http';

export interface IWeatherDashboardProps {
  /** Web part title displayed above the dashboard */
  title: string;
  /** Default city to load on first render */
  defaultCity: string;
  /** Auto-refresh interval in minutes (0 = disabled) */
  refreshInterval: number;
  /** SPFx HttpClient for external API calls */
  httpClient: HttpClient;
  /** SPFx SPHttpClient for SharePoint API calls */
  spHttpClient: SPHttpClient;
  /** Current SharePoint site absolute URL */
  siteUrl: string;
  /** Unique web part instance ID */
  instanceId: string;
  /** Current user login name */
  userLoginName: string;
  /** Whether the current theme is dark */
  isDarkTheme: boolean;
}
