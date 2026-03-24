import * as React from 'react';
import {
  MessageBar,
  MessageBarType,
} from '@fluentui/react';
import styles from './WeatherDashboard.module.scss';
import type { IWeatherDashboardProps } from './IWeatherDashboardProps';
import { ICityResult, ICityWeather } from '../models/IWeatherData';
import { WeatherService } from '../services/WeatherService';
import { PreferencesService } from '../services/PreferencesService';
import { generateId } from '../helpers/formatHelper';
import CitySearch from './CitySearch/CitySearch';
import WeatherCard from './WeatherCard/WeatherCard';

interface IWeatherDashboardState {
  cities: ICityWeather[];
  message: string | undefined;
  messageType: MessageBarType;
}

/**
 * Main Weather Dashboard component.
 * Manages multiple city weather cards with search, refresh, and
 * cross-browser persistence via a SharePoint list.
 */
export default class WeatherDashboard extends React.Component<IWeatherDashboardProps, IWeatherDashboardState> {
  private weatherService: WeatherService;
  private preferencesService: PreferencesService;
  private refreshTimer: ReturnType<typeof setInterval> | undefined = undefined;
  private saveTimeout: ReturnType<typeof setTimeout> | undefined = undefined;

  constructor(props: IWeatherDashboardProps) {
    super(props);

    this.weatherService = new WeatherService(props.httpClient);
    this.preferencesService = new PreferencesService(
      props.spHttpClient,
      props.siteUrl,
      props.instanceId,
      props.userLoginName
    );

    this.state = {
      cities: [],
      message: undefined,
      messageType: MessageBarType.info,
    };
  }

  public componentDidMount(): void {
    this.loadSavedCities().catch(() => { /* handled internally */ });
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
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }
  }

  public render(): React.ReactElement<IWeatherDashboardProps> {
    const { title } = this.props;
    const { cities, message, messageType } = this.state;

    return (
      <div className={styles.weatherDashboard}>
        <div className={styles.header}>
          <h2 className={styles.title}>{title || 'Weather Dashboard'}</h2>
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

  private async loadSavedCities(): Promise<void> {
    // Try loading from SharePoint preferences list
    try {
      const saved = await this.preferencesService.loadCities();
      if (saved.length > 0) {
        for (const city of saved) {
          await this.addCity(city, false);
        }
        return;
      }
    } catch {
      // Fall through to default
    }

    // No saved cities — load the default
    if (this.props.defaultCity) {
      try {
        const results = await this.weatherService.searchCities(this.props.defaultCity, 1);
        if (results.length > 0) {
          await this.addCity(results[0], true);
        }
      } catch (error) {
        console.error('Failed to load default city:', error);
      }
    }
  }

  private onCitySelected = async (city: ICityResult): Promise<void> => {
    const exists = this.state.cities.some(
      (c) => c.city.latitude === city.latitude && c.city.longitude === city.longitude
    );

    if (exists) {
      this.showMessage('This city is already on the dashboard.', MessageBarType.warning);
      return;
    }

    await this.addCity(city, true);
  };

  private addCity(city: ICityResult, persist: boolean): Promise<void> {
    return new Promise((resolve) => {
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
        () => {
          this.fetchWeatherForCity(id).catch(() => { /* handled internally */ });
          if (persist) {
            this.debouncedSave();
          }
          resolve();
        }
      );
    });
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
    this.setState(
      (prev) => ({ cities: prev.cities.filter((c) => c.id !== id) }),
      () => this.debouncedSave()
    );
  };

  private onRefreshCity = (id: string): void => {
    this.fetchWeatherForCity(id).catch(() => { /* handled internally */ });
  };

  private showMessage(message: string, messageType: MessageBarType): void {
    this.setState({ message, messageType });
  }

  private onDismissMessage = (): void => {
    this.setState({ message: undefined });
  };

  /**
   * Debounced save — waits 500ms after the last change before saving to SharePoint.
   * Prevents rapid API calls when adding multiple cities quickly.
   */
  private debouncedSave(): void {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }
    this.saveTimeout = setTimeout(() => {
      const cityData = this.state.cities.map((c) => c.city);
      this.preferencesService.saveCities(cityData).catch(() => {
        console.error('Failed to save city preferences');
      });
    }, 500);
  }

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
