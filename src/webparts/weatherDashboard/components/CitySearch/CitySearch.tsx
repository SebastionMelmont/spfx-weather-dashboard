import * as React from 'react';
import {
  SearchBox,
  ISearchBoxStyles,
} from '@fluentui/react/lib/SearchBox';
import {
  List,
} from '@fluentui/react/lib/List';
import styles from './CitySearch.module.scss';
import { ICityResult } from '../../models/IWeatherData';
import { WeatherService } from '../../services/WeatherService';

export interface ICitySearchProps {
  /** WeatherService instance for geocoding */
  weatherService: WeatherService;
  /** Callback when a city is selected */
  onCitySelected: (city: ICityResult) => void;
}

interface ICitySearchState {
  query: string;
  results: ICityResult[];
  isSearching: boolean;
  showDropdown: boolean;
}

/**
 * City search component with autocomplete dropdown.
 * Uses Open-Meteo geocoding via WeatherService.
 */
export default class CitySearch extends React.Component<ICitySearchProps, ICitySearchState> {
  private searchTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(props: ICitySearchProps) {
    super(props);
    this.state = {
      query: '',
      results: [],
      isSearching: false,
      showDropdown: false,
    };
  }

  public render(): React.ReactElement<ICitySearchProps> {
    const { results, isSearching, showDropdown } = this.state;

    const searchBoxStyles: ISearchBoxStyles = {
      root: { width: '100%', maxWidth: 400 },
    };

    return (
      <div className={styles.citySearch}>
        <SearchBox
          placeholder="Search for a city..."
          styles={searchBoxStyles}
          onChange={this.onSearchChange}
          onClear={this.onClear}
          onFocus={this.onFocus}
        />
        {showDropdown && (results.length > 0 || isSearching) && (
          <div className={styles.dropdown}>
            {isSearching ? (
              <div className={styles.loading}>Searching...</div>
            ) : (
              <List
                items={results}
                onRenderCell={this.onRenderCity}
              />
            )}
          </div>
        )}
      </div>
    );
  }

  private onSearchChange = (_ev?: React.ChangeEvent<HTMLInputElement>, newValue?: string): void => {
    const query = newValue || '';
    this.setState({ query, showDropdown: true });

    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }

    if (query.trim().length < 2) {
      this.setState({ results: [], isSearching: false });
      return;
    }

    this.setState({ isSearching: true });
    this.searchTimeout = setTimeout(async () => {
      try {
        const results = await this.props.weatherService.searchCities(query);
        this.setState({ results, isSearching: false });
      } catch {
        this.setState({ results: [], isSearching: false });
      }
    }, 300); // debounce 300ms
  };

  private onClear = (): void => {
    this.setState({ query: '', results: [], showDropdown: false });
  };

  private onFocus = (): void => {
    if (this.state.results.length > 0) {
      this.setState({ showDropdown: true });
    }
  };

  private onRenderCity = (city?: ICityResult): React.ReactElement | null => {
    if (!city) return null;

    const label = city.admin1
      ? `${city.name}, ${city.admin1}, ${city.country}`
      : `${city.name}, ${city.country}`;

    return (
      <div
        className={styles.cityItem}
        onClick={() => this.onSelectCity(city)}
        role="option"
        aria-selected={false}
      >
        {label}
      </div>
    );
  };

  private onSelectCity(city: ICityResult): void {
    this.setState({ query: '', results: [], showDropdown: false });
    this.props.onCitySelected(city);
  }
}
