import { SPHttpClient, SPHttpClientResponse } from '@microsoft/sp-http';
import { ICityResult } from '../models/IWeatherData';

const LIST_TITLE = 'WeatherDashboardPrefs';

/**
 * Escape a string for use inside an OData $filter expression.
 * Single quotes must be doubled — no URL encoding.
 */
function odataEscape(value: string): string {
  return value.replace(/'/g, "''");
}

/**
 * Service for persisting user weather city preferences in a SharePoint list.
 * Stores one item per user (keyed by user login name).
 * Works across all browsers and devices since data lives in SharePoint.
 */
export class PreferencesService {
  private spHttpClient: SPHttpClient;
  private siteUrl: string;
  private userLoginName: string;
  private listEnsured: boolean = false;

  constructor(
    spHttpClient: SPHttpClient,
    siteUrl: string,
    instanceId: string,
    userLoginName: string
  ) {
    this.spHttpClient = spHttpClient;
    this.siteUrl = siteUrl;
    // Use only user login as key so cities are shared across all pages/instances
    this.userLoginName = userLoginName;
  }

  /**
   * Load saved cities for the current user.
   * @returns Array of saved cities, or empty array if none found
   */
  public async loadCities(): Promise<ICityResult[]> {
    try {
      await this.ensureList();

      const filterKey = odataEscape(this.userLoginName);
      const url = `${this.siteUrl}/_api/web/lists/getbytitle('${LIST_TITLE}')/items?$filter=Title eq '${filterKey}'&$select=Title,CitiesJson&$top=1`;

      console.log('[WeatherDashboard] Loading preferences for:', this.userLoginName);

      const response: SPHttpClientResponse = await this.spHttpClient.get(
        url,
        SPHttpClient.configurations.v1,
        {
          headers: { 'Accept': 'application/json;odata=nometadata' },
        }
      );

      if (!response.ok) {
        console.error('[WeatherDashboard] Load response not OK:', response.status, response.statusText);
        return [];
      }

      const data = await response.json();
      console.log('[WeatherDashboard] Load response data:', JSON.stringify(data));

      if (data.value && data.value.length > 0) {
        const citiesJson = data.value[0].CitiesJson;
        if (citiesJson) {
          const cities = JSON.parse(citiesJson);
          console.log('[WeatherDashboard] Loaded', cities.length, 'saved cities');
          return cities;
        }
      }

      console.log('[WeatherDashboard] No saved cities found');
      return [];
    } catch (error) {
      console.error('[WeatherDashboard] Failed to load preferences:', error);
      return [];
    }
  }

  /**
   * Save cities for the current user.
   * Creates or updates the preference item.
   * @param cities - Array of city data to save
   */
  public async saveCities(cities: ICityResult[]): Promise<void> {
    try {
      await this.ensureList();

      const citiesJson = JSON.stringify(cities);

      // Check if item exists
      const existingId = await this.getExistingItemId();

      if (existingId) {
        await this.updateItem(existingId, citiesJson);
        console.log('[WeatherDashboard] Updated preferences, item ID:', existingId);
      } else {
        await this.createItem(citiesJson);
        console.log('[WeatherDashboard] Created new preferences item');
      }
    } catch (error) {
      console.error('[WeatherDashboard] Failed to save preferences:', error);
    }
  }

  private async getExistingItemId(): Promise<number | undefined> {
    const filterKey = odataEscape(this.userLoginName);
    const url = `${this.siteUrl}/_api/web/lists/getbytitle('${LIST_TITLE}')/items?$filter=Title eq '${filterKey}'&$select=Id&$top=1`;

    const response = await this.spHttpClient.get(
      url,
      SPHttpClient.configurations.v1,
      {
        headers: { 'Accept': 'application/json;odata=nometadata' },
      }
    );

    if (response.ok) {
      const data = await response.json();
      if (data.value && data.value.length > 0) {
        return data.value[0].Id;
      }
    }

    return undefined;
  }

  private async createItem(citiesJson: string): Promise<void> {
    const url = `${this.siteUrl}/_api/web/lists/getbytitle('${LIST_TITLE}')/items`;

    const response = await this.spHttpClient.post(
      url,
      SPHttpClient.configurations.v1,
      {
        headers: {
          'Accept': 'application/json;odata=nometadata',
          'Content-Type': 'application/json;odata=nometadata',
        },
        body: JSON.stringify({
          Title: this.userLoginName,
          CitiesJson: citiesJson,
        }),
      }
    );

    if (!response.ok) {
      const text = await response.text();
      console.error('[WeatherDashboard] Create item failed:', response.status, text);
    }
  }

  private async updateItem(itemId: number, citiesJson: string): Promise<void> {
    const url = `${this.siteUrl}/_api/web/lists/getbytitle('${LIST_TITLE}')/items(${itemId})`;

    const response = await this.spHttpClient.post(
      url,
      SPHttpClient.configurations.v1,
      {
        headers: {
          'Accept': 'application/json;odata=nometadata',
          'Content-Type': 'application/json;odata=nometadata',
          'IF-MATCH': '*',
          'X-HTTP-Method': 'MERGE',
        },
        body: JSON.stringify({
          CitiesJson: citiesJson,
        }),
      }
    );

    if (!response.ok) {
      const text = await response.text();
      console.error('[WeatherDashboard] Update item failed:', response.status, text);
    }
  }

  /**
   * Ensure the preferences list exists, creating it with the CitiesJson field if needed.
   * List is NOT hidden so admins can inspect/debug it.
   */
  private async ensureList(): Promise<void> {
    if (this.listEnsured) return;

    const checkUrl = `${this.siteUrl}/_api/web/lists/getbytitle('${LIST_TITLE}')`;

    try {
      const response = await this.spHttpClient.get(
        checkUrl,
        SPHttpClient.configurations.v1,
        {
          headers: { 'Accept': 'application/json;odata=nometadata' },
        }
      );

      if (response.ok) {
        // List exists — also check that CitiesJson field exists
        await this.ensureField();
        this.listEnsured = true;
        console.log('[WeatherDashboard] Preferences list verified');
        return;
      }
    } catch {
      // List doesn't exist, create it below
    }

    console.log('[WeatherDashboard] Creating preferences list...');

    // Create the list (visible, not hidden)
    const createListUrl = `${this.siteUrl}/_api/web/lists`;
    const createResponse = await this.spHttpClient.post(
      createListUrl,
      SPHttpClient.configurations.v1,
      {
        headers: {
          'Accept': 'application/json;odata=nometadata',
          'Content-Type': 'application/json;odata=nometadata',
        },
        body: JSON.stringify({
          Title: LIST_TITLE,
          Description: 'Weather Dashboard user preferences — stores saved cities per user',
          BaseTemplate: 100,
          Hidden: false,
        }),
      }
    );

    if (!createResponse.ok) {
      const text = await createResponse.text();
      console.error('[WeatherDashboard] Failed to create preferences list:', createResponse.status, text);
      return;
    }

    // Add the CitiesJson field
    await this.addCitiesJsonField();
    this.listEnsured = true;
    console.log('[WeatherDashboard] Preferences list created successfully');
  }

  private async ensureField(): Promise<void> {
    const fieldUrl = `${this.siteUrl}/_api/web/lists/getbytitle('${LIST_TITLE}')/fields?$filter=InternalName eq 'CitiesJson'&$select=InternalName&$top=1`;

    try {
      const response = await this.spHttpClient.get(
        fieldUrl,
        SPHttpClient.configurations.v1,
        {
          headers: { 'Accept': 'application/json;odata=nometadata' },
        }
      );

      if (response.ok) {
        const data = await response.json();
        if (data.value && data.value.length > 0) {
          return; // Field exists
        }
      }
    } catch {
      // Field doesn't exist
    }

    console.log('[WeatherDashboard] Adding CitiesJson field...');
    await this.addCitiesJsonField();
  }

  private async addCitiesJsonField(): Promise<void> {
    const addFieldUrl = `${this.siteUrl}/_api/web/lists/getbytitle('${LIST_TITLE}')/fields`;
    const response = await this.spHttpClient.post(
      addFieldUrl,
      SPHttpClient.configurations.v1,
      {
        headers: {
          'Accept': 'application/json;odata=nometadata',
          'Content-Type': 'application/json;odata=nometadata',
        },
        body: JSON.stringify({
          Title: 'CitiesJson',
          FieldTypeKind: 3, // Multi-line text
          Required: false,
        }),
      }
    );

    if (!response.ok) {
      const text = await response.text();
      console.error('[WeatherDashboard] Failed to add CitiesJson field:', response.status, text);
    }
  }
}
