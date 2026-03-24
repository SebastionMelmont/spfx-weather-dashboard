import * as React from 'react';
import {
  IconButton,
  IIconProps,
} from '@fluentui/react';
import styles from './WeatherCard.module.scss';
import { ICityWeather, IDailyForecast } from '../../models/IWeatherData';
import { getWeatherInfo } from '../../helpers/weatherCodes';
import { getClothingRecommendation } from '../../helpers/clothingHelper';
import { formatNZDateTime, formatLocalTime, getDayName, getUVLabel } from '../../helpers/formatHelper';

export interface IWeatherCardProps {
  /** City weather data to display */
  cityWeather: ICityWeather;
  /** Callback to remove this city from the dashboard */
  onRemove: (id: string) => void;
  /** Callback to refresh weather for this city */
  onRefresh: (id: string) => void;
  /** Drag and drop handlers */
  onDragStart: (e: React.DragEvent, id: string) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent, id: string) => void;
  onDragEnd: () => void;
}

interface IWeatherCardState {
  forecastExpanded: boolean;
  localTime: string;
}

const refreshIcon: IIconProps = { iconName: 'Refresh' };
const removeIcon: IIconProps = { iconName: 'Cancel' };

/**
 * Weather card component displaying current weather for a single city.
 * Shows temperature with high/low, condition, humidity, wind, UV index,
 * clothing recommendation, local time, and expandable 5-day forecast.
 */
export default class WeatherCard extends React.Component<IWeatherCardProps, IWeatherCardState> {
  private timeInterval: ReturnType<typeof setInterval> | undefined;

  constructor(props: IWeatherCardProps) {
    super(props);
    this.state = {
      forecastExpanded: false,
      localTime: this.getLocalTime(),
    };
  }

  public componentDidMount(): void {
    // Update local time every 30 seconds
    this.timeInterval = setInterval(() => {
      this.setState({ localTime: this.getLocalTime() });
    }, 30000);
  }

  public componentWillUnmount(): void {
    if (this.timeInterval) {
      clearInterval(this.timeInterval);
    }
  }

  private getLocalTime(): string {
    const tz = this.props.cityWeather.city.timezone;
    return tz ? formatLocalTime(tz) : '';
  }

  public render(): React.ReactElement<IWeatherCardProps> {
    const { cityWeather, onRemove, onRefresh, onDragStart, onDragOver, onDrop, onDragEnd } = this.props;
    const { city, weather, isLoading, error, lastUpdated } = cityWeather;
    const { localTime } = this.state;

    const locationLabel = city.admin1
      ? `${city.name}, ${city.admin1}`
      : city.name;

    return (
      <div
        className={styles.weatherCard}
        draggable
        onDragStart={(e) => onDragStart(e, cityWeather.id)}
        onDragOver={onDragOver}
        onDrop={(e) => onDrop(e, cityWeather.id)}
        onDragEnd={onDragEnd}
      >
        <div className={styles.cardHeader}>
          <div className={styles.cityInfo}>
            <div className={styles.dragHandle} title="Drag to reorder">&#x2630;</div>
            <div className={styles.cityName}>
              <h3>{locationLabel}</h3>
              <div className={styles.subInfo}>
                <span className={styles.country}>{city.country}</span>
                {localTime && <span className={styles.localTime}>{localTime}</span>}
              </div>
            </div>
          </div>
          <div className={styles.actions}>
            <IconButton
              iconProps={refreshIcon}
              title="Refresh"
              ariaLabel="Refresh weather"
              onClick={() => onRefresh(cityWeather.id)}
              disabled={isLoading}
            />
            <IconButton
              iconProps={removeIcon}
              title="Remove"
              ariaLabel="Remove city"
              onClick={() => onRemove(cityWeather.id)}
            />
          </div>
        </div>

        {isLoading && (
          <div className={styles.loading}>Loading weather data...</div>
        )}

        {error && (
          <div className={styles.error}>{error}</div>
        )}

        {weather && !isLoading && this.renderWeather()}

        {lastUpdated && (
          <div className={styles.updated}>
            Updated: {formatNZDateTime(lastUpdated)}
          </div>
        )}
      </div>
    );
  }

  private renderWeather(): React.ReactElement {
    const { weather, forecast } = this.props.cityWeather;
    const { forecastExpanded } = this.state;
    if (!weather) return <></>;

    const condition = getWeatherInfo(weather.weatherCode);
    const clothing = getClothingRecommendation(weather.temperature);
    const uvLabel = getUVLabel(weather.uvIndex);
    const uvClass = this.getUVClass(weather.uvIndex);

    return (
      <div className={styles.weatherBody}>
        <div className={styles.mainTemp}>
          <span className={styles.icon}>{condition.icon}</span>
          <span className={styles.temperature}>{weather.temperature}&deg;C</span>
        </div>
        <div className={styles.highLow}>
          H: {weather.temperatureHigh}&deg; &nbsp; L: {weather.temperatureLow}&deg;
        </div>
        <div className={styles.condition}>{condition.description}</div>

        <div className={styles.details}>
          <div className={styles.detailRow}>
            <span className={styles.label}>Humidity</span>
            <span className={styles.value}>{weather.humidity}%</span>
          </div>
          <div className={styles.detailRow}>
            <span className={styles.label}>Wind</span>
            <span className={styles.value}>{weather.windSpeed} km/h</span>
          </div>
          <div className={styles.detailRow}>
            <span className={styles.label}>UV Index</span>
            <span className={`${styles.value} ${(styles as unknown as Record<string, string>)[uvClass]}`}>
              {weather.uvIndex} ({uvLabel})
            </span>
          </div>
          <div className={styles.detailRow}>
            <span className={styles.label}>Clothing</span>
            <span className={styles.value}>{clothing}</span>
          </div>
        </div>

        {/* 5-Day Forecast Toggle */}
        {forecast && forecast.length > 0 && (
          <div className={styles.forecastSection}>
            <button
              className={styles.forecastToggle}
              onClick={() => this.setState({ forecastExpanded: !forecastExpanded })}
            >
              {forecastExpanded ? '5-Day Forecast \u25B2' : '5-Day Forecast \u25BC'}
            </button>

            {forecastExpanded && (
              <div className={styles.forecastGrid}>
                {forecast.map((day) => this.renderForecastDay(day))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  private renderForecastDay(day: IDailyForecast): React.ReactElement {
    const condition = getWeatherInfo(day.weatherCode);
    const dayName = getDayName(day.date);

    return (
      <div key={day.date} className={styles.forecastDay}>
        <span className={styles.forecastDayName}>{dayName}</span>
        <span className={styles.forecastIcon}>{condition.icon}</span>
        <span className={styles.forecastTemps}>
          <span className={styles.forecastHigh}>{Math.round(day.temperatureHigh)}&deg;</span>
          <span className={styles.forecastLow}>{Math.round(day.temperatureLow)}&deg;</span>
        </span>
        {day.precipitationProbability > 0 && (
          <span className={styles.forecastRain}>{day.precipitationProbability}%</span>
        )}
      </div>
    );
  }

  private getUVClass(uvIndex: number): string {
    if (uvIndex <= 2) return 'uvLow';
    if (uvIndex <= 5) return 'uvModerate';
    if (uvIndex <= 7) return 'uvHigh';
    if (uvIndex <= 10) return 'uvVeryHigh';
    return 'uvExtreme';
  }
}
