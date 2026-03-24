import * as React from 'react';
import {
  PrimaryButton,
  MessageBar,
  MessageBarType,
} from '@fluentui/react';
import styles from './WeatherDashboard.module.scss';
import type { IWeatherDashboardProps } from './IWeatherDashboardProps';
import { ICityResult, ICityWeather } from '../models/IWeatherData';
import { WeatherService } from '../services/WeatherService';
import { ReportService } from '../services/ReportService';
import { generateId } from '../helpers/formatHelper';
import CitySearch from './CitySearch/CitySearch';
import WeatherCard from './WeatherCard/WeatherCard';

interface IWeatherDashboardState {
  cities: ICityWeather[];
  message: string | undefined;
  messageType: MessageBarType;
  isSavingReport: boolean;
}

/**
 * Main Weather Dashboard component.
 * Manages multiple city weather cards with search, refresh, and report saving.
 */
export default class WeatherDashboard extends React.Component<IWeatherDashboardProps, IWeatherDashboardState> {
  private weatherService: WeatherService;
  private reportService: ReportService;
  private refreshTimer: ReturnType<typeof setInterval> | undefined = undefined;

  constructor(props: IWeatherDashboardProps) {
    super(props);

    this.weatherService = new WeatherService(props.httpClient);
    this.reportService = new ReportService(props.spHttpClient, props.siteUrl);

    this.state = {
      cities: [],
      message: undefined,
      messageType: MessageBarType.info,
      isSavingReport: false,
    };
  }

  public componentDidMount(): void {
    // Load default city if configured
    if (this.props.defaultCity) {
      this.loadDefaultCity(this.props.defaultCity).catch(() => { /* handled internally */ });
    }

    // Set up auto-refresh
    this.setupRefreshTimer();
  }

  public componentDidUpdate(prevProps: IWeatherDashboardProps): void {
    if (prevProps.refreshInterval !== this.props.refreshInterval) {
      this.setupRefreshTimer();
    }
  }

  public componentWillUnmount(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
    }
  }

  public render(): React.ReactElement<IWeatherDashboardProps> {
    const { title } = this.props;
    const { cities, message, messageType, isSavingReport } = this.state;

    return (
      <div className={styles.weatherDashboard}>
        <div className={styles.header}>
          <h2 className={styles.title}>{title || 'Weather Dashboard'}</h2>
          {cities.length > 0 && (
            <PrimaryButton
              text={isSavingReport ? 'Saving...' : 'Save Report'}
              iconProps={{ iconName: 'Save' }}
              onClick={this.onSaveReport}
              disabled={isSavingReport}
            />
          )}
        </div>

        {message && (
          <MessageBar
            messageBarType={messageType}
            onDismiss={this.onDismissMessage}
            dismissButtonAriaLabel="Close"
          >
            {message}
          </MessageBar>
        )}

        <CitySearch
          weatherService={this.weatherService}
          onCitySelected={this.onCitySelected}
        />

        {cities.length === 0 ? (
          <div className={styles.emptyState}>
            Search for a city above to see its current weather.
          </div>
        ) : (
          <div className={styles.cardGrid}>
            {cities.map((cityWeather) => (
              <WeatherCard
                key={cityWeather.id}
                cityWeather={cityWeather}
                onRemove={this.onRemoveCity}
                onRefresh={this.onRefreshCity}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  private async loadDefaultCity(cityName: string): Promise<void> {
    try {
      const results = await this.weatherService.searchCities(cityName, 1);
      if (results.length > 0) {
        await this.addCity(results[0]);
      }
    } catch (error) {
      console.error('Failed to load default city:', error);
    }
  }

  private onCitySelected = async (city: ICityResult): Promise<void> => {
    // Check for duplicate
    const exists = this.state.cities.some(
      (c) => c.city.latitude === city.latitude && c.city.longitude === city.longitude
    );

    if (exists) {
      this.showMessage('This city is already on the dashboard.', MessageBarType.warning);
      return;
    }

    await this.addCity(city);
  };

  private async addCity(city: ICityResult): Promise<void> {
    const id = generateId();
    const newEntry: ICityWeather = {
      id,
      city,
      weather: undefined,
      isLoading: true,
      error: undefined,
      lastUpdated: undefined,
    };

    this.setState(
      (prev) => ({ cities: [...prev.cities, newEntry] }),
      () => this.fetchWeatherForCity(id).catch(() => { /* handled internally */ })
    );
  }

  private async fetchWeatherForCity(id: string): Promise<void> {
    const entry = this.state.cities.find((c) => c.id === id);
    if (!entry) return;

    this.updateCity(id, { isLoading: true, error: undefined });

    try {
      const weather = await this.weatherService.fetchWeather(
        entry.city.latitude,
        entry.city.longitude
      );
      this.updateCity(id, {
        weather,
        isLoading: false,
        lastUpdated: new Date(),
      });
    } catch (error) {
      this.updateCity(id, {
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to fetch weather',
      });
    }
  }

  private updateCity(id: string, updates: Partial<ICityWeather>): void {
    this.setState((prev) => ({
      cities: prev.cities.map((c) => (c.id === id ? { ...c, ...updates } : c)),
    }));
  }

  private onRemoveCity = (id: string): void => {
    this.setState((prev) => ({
      cities: prev.cities.filter((c) => c.id !== id),
    }));
  };

  private onRefreshCity = (id: string): void => {
    this.fetchWeatherForCity(id).catch(() => { /* handled internally */ });
  };

  private onSaveReport = async (): Promise<void> => {
    this.setState({ isSavingReport: true });

    try {
      const fileUrl = await this.reportService.saveReport(
        this.state.cities,
        this.props.reportLibrary
      );
      this.showMessage(`Report saved: ${fileUrl}`, MessageBarType.success);
    } catch (error) {
      this.showMessage(
        error instanceof Error ? error.message : 'Failed to save report',
        MessageBarType.error
      );
    } finally {
      this.setState({ isSavingReport: false });
    }
  };

  private showMessage(message: string, messageType: MessageBarType): void {
    this.setState({ message, messageType });
  }

  private onDismissMessage = (): void => {
    this.setState({ message: undefined });
  };

  private setupRefreshTimer(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = undefined;
    }

    const intervalMinutes = this.props.refreshInterval;
    if (intervalMinutes > 0) {
      this.refreshTimer = setInterval(() => {
        this.state.cities.forEach((c) => this.fetchWeatherForCity(c.id).catch(() => { /* handled internally */ }));
      }, intervalMinutes * 60 * 1000);
    }
  }
}
