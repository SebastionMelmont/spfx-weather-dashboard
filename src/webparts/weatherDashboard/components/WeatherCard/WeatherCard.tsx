import * as React from 'react';
import {
  IconButton,
  IIconProps,
} from '@fluentui/react';
import styles from './WeatherCard.module.scss';
import { ICityWeather } from '../../models/IWeatherData';
import { getWeatherInfo } from '../../helpers/weatherCodes';
import { getClothingRecommendation } from '../../helpers/clothingHelper';
import { formatNZDateTime, getUVLabel } from '../../helpers/formatHelper';

export interface IWeatherCardProps {
  /** City weather data to display */
  cityWeather: ICityWeather;
  /** Callback to remove this city from the dashboard */
  onRemove: (id: string) => void;
  /** Callback to refresh weather for this city */
  onRefresh: (id: string) => void;
}

const refreshIcon: IIconProps = { iconName: 'Refresh' };
const removeIcon: IIconProps = { iconName: 'Cancel' };

/**
 * Weather card component displaying current weather for a single city.
 * Shows temperature, condition, humidity, wind, UV index, and clothing recommendation.
 */
export default class WeatherCard extends React.Component<IWeatherCardProps> {
  public render(): React.ReactElement<IWeatherCardProps> {
    const { cityWeather, onRemove, onRefresh } = this.props;
    const { city, weather, isLoading, error, lastUpdated } = cityWeather;

    const locationLabel = city.admin1
      ? `${city.name}, ${city.admin1}`
      : city.name;

    return (
      <div className={styles.weatherCard}>
        <div className={styles.cardHeader}>
          <div className={styles.cityName}>
            <h3>{locationLabel}</h3>
            <span className={styles.country}>{city.country}</span>
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
    const { weather } = this.props.cityWeather;
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
