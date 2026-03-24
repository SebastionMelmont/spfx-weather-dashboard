import { SPHttpClient, SPHttpClientResponse } from '@microsoft/sp-http';
import { ICityResult } from '../models/IWeatherData';

const LIST_TITLE = 'WeatherDashboardPrefs';

/**
 * Service for persisting user weather city preferences in a SharePoint list.
 * Stores one item per user (keyed by user login name).
 * Works across all browsers and devices since data lives in SharePoint.
 *
 * Avoids OData $filter entirely — fetches all items and matches client-side
 * to avoid encoding issues with @ and special characters in login names.
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
    this.userLoginName = userLoginName;
    console.log('[WeatherPrefs] Initialized for user:', this.userLoginName, 'site:', this.siteUrl);
  }

  /**
   * Load saved cities for the current user.
   * Fetches all preference items and matches by Title client-side.
   * @returns Array of saved cities, or empty array if none found
   */
  public async loadCities(): Promise<ICityResult[]> {
    try {
      await this.ensureList();

      // No $filter — fetch all items and match client-side to avoid OData encoding issues
      const url = `${this.siteUrl}/_api/web/lists/getbytitle('${LIST_TITLE}')/items?$select=Id,Title,CitiesJson&$top=500`;

      console.log('[WeatherPrefs] Loading all preference items...');

      const response: SPHttpClientResponse = await this.spHttpClient.get(
        url,
        SPHttpClient.configurations.v1,
        {
          headers: { 'Accept': 'application/json;odata=nometadata' },
        }
      );

      if (!response.ok) {
        console.error('[WeatherPrefs] Load failed:', response.status, response.statusText);
        return [];
      }

      const data = await response.json();
      const items = data.value || [];
      console.log('[WeatherPrefs] Found', items.length, 'total preference items');

      // Match by user login (case-insensitive)
      const userItem = items.find(
        (item: { Title: string }) => item.Title && item.Title.toLowerCase() === this.userLoginName.toLowerCase()
      );

      if (userItem && userItem.CitiesJson) {
        const cities = JSON.parse(userItem.CitiesJson);
        console.log('[WeatherPrefs] Loaded', cities.length, 'cities for user');
        return cities;
      }

      console.log('[WeatherPrefs] No saved cities for this user');
      return [];
    } catch (error) {
      console.error('[WeatherPrefs] Failed to load:', error);
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
      console.log('[WeatherPrefs] Saving', cities.length, 'cities...');

      // Fetch all items to find existing one (no $filter)
      const existingItem = await this.findUserItem();

      if (existingItem) {
        await this.updateItem(existingItem.Id, citiesJson);
        console.log('[WeatherPrefs] Updated item ID:', existingItem.Id);
      } else {
        await this.createItem(citiesJson);
        console.log('[WeatherPrefs] Created new preference item');
      }
    } catch (error) {
      console.error('[WeatherPrefs] Failed to save:', error);
    }
  }

  /**
   * Find the current user's preference item by fetching all and matching client-side.
   */
  private async findUserItem(): Promise<{ Id: number; Title: string } | undefined> {
    const url = `${this.siteUrl}/_api/web/lists/getbytitle('${LIST_TITLE}')/items?$select=Id,Title&$top=500`;

    const response = await this.spHttpClient.get(
      url,
      SPHttpClient.configurations.v1,
      {
        headers: { 'Accept': 'application/json;odata=nometadata' },
      }
    );

    if (response.ok) {
      const data = await response.json();
      const items = data.value || [];
      return items.find(
        (item: { Id: number; Title: string }) =>
          item.Title && item.Title.toLowerCase() === this.userLoginName.toLowerCase()
      );
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
      console.error('[WeatherPrefs] Create failed:', response.status, text);
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
      console.error('[WeatherPrefs] Update failed:', response.status, text);
    }
  }

  /**
   * Ensure the preferences list exists with the CitiesJson field.
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
        await this.ensureField();
        this.listEnsured = true;
        console.log('[WeatherPrefs] List verified');
        return;
      }
    } catch {
      // List doesn't exist
    }

    console.log('[WeatherPrefs] Creating list...');

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
          BaseTemplate: 100,
          Hidden: false,
        }),
      }
    );

    if (!createResponse.ok) {
      const text = await createResponse.text();
      console.error('[WeatherPrefs] List creation failed:', createResponse.status, text);
      return;
    }

    await this.addCitiesJsonField();
    this.listEnsured = true;
    console.log('[WeatherPrefs] List created');
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
          return;
        }
      }
    } catch {
      // Field check failed
    }

    console.log('[WeatherPrefs] Adding CitiesJson field...');
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
          FieldTypeKind: 3,
          Required: false,
        }),
      }
    );

    if (!response.ok) {
      const text = await response.text();
      console.error('[WeatherPrefs] Field creation failed:', response.status, text);
    }
  }
}
