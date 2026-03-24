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
  draggedId: string | undefined;
}

/**
 * Main Weather Dashboard component.
 * Manages multiple city weather cards with search, refresh,
 * drag-and-drop reorder, and cross-browser persistence.
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
      draggedId: undefined,
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
                onDragStart={this.onDragStart}
                onDragOver={this.onDragOver}
                onDrop={this.onDrop}
                onDragEnd={this.onDragEnd}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  // ─── Drag and Drop ──────────────────────────────────────
  private onDragStart = (_e: React.DragEvent, id: string): void => {
    this.setState({ draggedId: id });
  };

  private onDragOver = (e: React.DragEvent): void => {
    e.preventDefault(); // required to allow drop
  };

  private onDrop = (_e: React.DragEvent, targetId: string): void => {
    const { draggedId } = this.state;
    if (!draggedId || draggedId === targetId) return;

    this.setState((prev) => {
      const cities = [...prev.cities];
      const dragIndex = cities.findIndex((c) => c.id === draggedId);
      const targetIndex = cities.findIndex((c) => c.id === targetId);

      if (dragIndex === -1 || targetIndex === -1) return null;

      // Remove dragged item and insert at target position
      const [dragged] = cities.splice(dragIndex, 1);
      cities.splice(targetIndex, 0, dragged);

      return { cities, draggedId: undefined };
    }, () => this.debouncedSave());
  };

  private onDragEnd = (): void => {
    this.setState({ draggedId: undefined });
  };

  // ─── City Management ────────────────────────────────────
  private async loadSavedCities(): Promise<void> {
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
        forecast: undefined,
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
      const response = await this.weatherService.fetchWeather(
        entry.city.latitude,
        entry.city.longitude,
        entry.city.timezone
      );
      this.updateCity(id, {
        weather: response.current,
        forecast: response.forecast,
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
