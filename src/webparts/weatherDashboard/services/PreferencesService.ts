import { SPHttpClient, SPHttpClientResponse } from '@microsoft/sp-http';
import { ICityResult } from '../models/IWeatherData';

const LIST_TITLE = 'WeatherDashboardPrefs';

/**
 * Service for persisting user weather city preferences in a SharePoint list.
 * Stores one item per user (keyed by web part instance ID + user login).
 * Works across all browsers since data lives in SharePoint.
 */
export class PreferencesService {
  private spHttpClient: SPHttpClient;
  private siteUrl: string;
  private instanceId: string;
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
    this.instanceId = instanceId;
    this.userLoginName = userLoginName;
  }

  /**
   * Load saved cities for the current user and web part instance.
   * @returns Array of saved cities, or empty array if none found
   */
  public async loadCities(): Promise<ICityResult[]> {
    try {
      await this.ensureList();

      const filterKey = this.getPreferenceKey();
      const url = `${this.siteUrl}/_api/web/lists/getbytitle('${LIST_TITLE}')/items?$filter=Title eq '${encodeURIComponent(filterKey)}'&$select=Title,CitiesJson&$top=1`;

      const response: SPHttpClientResponse = await this.spHttpClient.get(
        url,
        SPHttpClient.configurations.v1,
        {
          headers: { 'Accept': 'application/json;odata=nometadata' },
        }
      );

      if (!response.ok) {
        return [];
      }

      const data = await response.json();
      if (data.value && data.value.length > 0) {
        const citiesJson = data.value[0].CitiesJson;
        if (citiesJson) {
          return JSON.parse(citiesJson);
        }
      }

      return [];
    } catch (error) {
      console.error('Failed to load preferences:', error);
      return [];
    }
  }

  /**
   * Save cities for the current user and web part instance.
   * Creates or updates the preference item.
   * @param cities - Array of city data to save
   */
  public async saveCities(cities: ICityResult[]): Promise<void> {
    try {
      await this.ensureList();

      const filterKey = this.getPreferenceKey();
      const citiesJson = JSON.stringify(cities);

      // Check if item exists
      const existingId = await this.getExistingItemId(filterKey);

      if (existingId) {
        // Update existing item
        await this.updateItem(existingId, citiesJson);
      } else {
        // Create new item
        await this.createItem(filterKey, citiesJson);
      }
    } catch (error) {
      console.error('Failed to save preferences:', error);
    }
  }

  private getPreferenceKey(): string {
    return `${this.instanceId}_${this.userLoginName}`;
  }

  private async getExistingItemId(filterKey: string): Promise<number | undefined> {
    const url = `${this.siteUrl}/_api/web/lists/getbytitle('${LIST_TITLE}')/items?$filter=Title eq '${encodeURIComponent(filterKey)}'&$select=Id&$top=1`;

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

  private async createItem(title: string, citiesJson: string): Promise<void> {
    const url = `${this.siteUrl}/_api/web/lists/getbytitle('${LIST_TITLE}')/items`;

    await this.spHttpClient.post(
      url,
      SPHttpClient.configurations.v1,
      {
        headers: {
          'Accept': 'application/json;odata=nometadata',
          'Content-Type': 'application/json;odata=nometadata',
        },
        body: JSON.stringify({
          Title: title,
          CitiesJson: citiesJson,
        }),
      }
    );
  }

  private async updateItem(itemId: number, citiesJson: string): Promise<void> {
    const url = `${this.siteUrl}/_api/web/lists/getbytitle('${LIST_TITLE}')/items(${itemId})`;

    await this.spHttpClient.post(
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
  }

  /**
   * Ensure the preferences list exists, creating it with the CitiesJson field if needed.
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
        this.listEnsured = true;
        return;
      }
    } catch {
      // List doesn't exist, create it
    }

    // Create the list
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
          Description: 'Weather Dashboard user preferences',
          BaseTemplate: 100, // Generic list
          Hidden: true,
        }),
      }
    );

    if (!createResponse.ok) {
      console.error('Failed to create preferences list');
      return;
    }

    // Add the CitiesJson field (multi-line text to hold JSON)
    const addFieldUrl = `${this.siteUrl}/_api/web/lists/getbytitle('${LIST_TITLE}')/fields`;
    await this.spHttpClient.post(
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

    this.listEnsured = true;
  }
}
