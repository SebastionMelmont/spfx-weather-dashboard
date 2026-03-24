import { HttpClient } from '@microsoft/sp-http';

export interface IWeatherDashboardProps {
  /** Web part title displayed above the dashboard */
  title: string;
  /** Default city to load on first render */
  defaultCity: string;
  /** Auto-refresh interval in minutes (0 = disabled) */
  refreshInterval: number;
  /** SPFx HttpClient for external API calls */
  httpClient: HttpClient;
  /** Unique instance ID for localStorage key */
  instanceId: string;
  /** Whether the current theme is dark */
  isDarkTheme: boolean;
}
