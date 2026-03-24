import { SPHttpClient, SPHttpClientResponse } from '@microsoft/sp-http';
import { ICityResult } from '../models/IWeatherData';

/**
 * List name for storing weather city preferences.
 * Uses a fresh name to avoid any conflicts with previously broken lists.
 */
const LIST_TITLE = 'WeatherCities';

/**
 * Service for persisting user weather city preferences in a SharePoint list.
 *
 * IMPORTANT: Uses ONLY built-in SharePoint list fields (Title + a Note field
 * created via XML schema) to avoid field provisioning failures.
 *
 * Schema:
 *   - Title: user login name (e.g. markus@thestylecollective.co.nz)
 *   - CitiesData: multi-line text field containing JSON array of saved cities
 *
 * The list is created via XML schema definition which creates the field
 * atomically with the list, avoiding the separate field-creation call that
 * was failing.
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
    console.log('[WeatherPrefs] Init — user:', this.userLoginName);
  }

  /**
   * Load saved cities for the current user.
   */
  public async loadCities(): Promise<ICityResult[]> {
    try {
      const ok = await this.ensureList();
      if (!ok) return [];

      const url = `${this.siteUrl}/_api/web/lists/getbytitle('${LIST_TITLE}')/items?$select=Id,Title,CitiesData&$top=500`;
      console.log('[WeatherPrefs] Loading items...');

      const response: SPHttpClientResponse = await this.spHttpClient.get(
        url,
        SPHttpClient.configurations.v1,
        { headers: { 'Accept': 'application/json;odata=nometadata' } }
      );

      if (!response.ok) {
        const errText = await response.text();
        console.error('[WeatherPrefs] Load failed:', response.status, errText);
        return [];
      }

      const data = await response.json();
      const items = data.value || [];
      console.log('[WeatherPrefs] Total items:', items.length);

      // Find this user's row (case-insensitive)
      const userItem = items.find(
        (item: Record<string, string>) =>
          item.Title && item.Title.toLowerCase() === this.userLoginName.toLowerCase()
      );

      if (userItem && userItem.CitiesData) {
        const cities = JSON.parse(userItem.CitiesData);
        console.log('[WeatherPrefs] Loaded', cities.length, 'cities');
        return cities;
      }

      console.log('[WeatherPrefs] No saved cities for this user');
      return [];
    } catch (error) {
      console.error('[WeatherPrefs] Load error:', error);
      return [];
    }
  }

  /**
   * Save cities for the current user. Creates or updates the item.
   */
  public async saveCities(cities: ICityResult[]): Promise<void> {
    try {
      const ok = await this.ensureList();
      if (!ok) return;

      const citiesData = JSON.stringify(cities);
      console.log('[WeatherPrefs] Saving', cities.length, 'cities...');

      const existingItem = await this.findUserItem();

      if (existingItem) {
        await this.updateItem(existingItem.Id, citiesData);
        console.log('[WeatherPrefs] Updated item', existingItem.Id);
      } else {
        await this.createItem(citiesData);
        console.log('[WeatherPrefs] Created new item');
      }
    } catch (error) {
      console.error('[WeatherPrefs] Save error:', error);
    }
  }

  private async findUserItem(): Promise<{ Id: number; Title: string } | undefined> {
    const url = `${this.siteUrl}/_api/web/lists/getbytitle('${LIST_TITLE}')/items?$select=Id,Title&$top=500`;

    const response = await this.spHttpClient.get(
      url,
      SPHttpClient.configurations.v1,
      { headers: { 'Accept': 'application/json;odata=nometadata' } }
    );

    if (response.ok) {
      const data = await response.json();
      return (data.value || []).find(
        (item: { Id: number; Title: string }) =>
          item.Title && item.Title.toLowerCase() === this.userLoginName.toLowerCase()
      );
    }
    return undefined;
  }

  private async createItem(citiesData: string): Promise<void> {
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
          CitiesData: citiesData,
        }),
      }
    );

    if (!response.ok) {
      const text = await response.text();
      console.error('[WeatherPrefs] Create failed:', response.status, text);
    }
  }

  private async updateItem(itemId: number, citiesData: string): Promise<void> {
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
          CitiesData: citiesData,
        }),
      }
    );

    if (!response.ok) {
      const text = await response.text();
      console.error('[WeatherPrefs] Update failed:', response.status, text);
    }
  }

  /**
   * Ensure the list exists with the CitiesData field.
   * Creates the list using XML schema so the custom field is included atomically.
   * Returns true if the list is ready, false if setup failed.
   */
  private async ensureList(): Promise<boolean> {
    if (this.listEnsured) return true;

    // Check if list already exists
    const checkUrl = `${this.siteUrl}/_api/web/lists/getbytitle('${LIST_TITLE}')`;
    try {
      const checkResp = await this.spHttpClient.get(
        checkUrl,
        SPHttpClient.configurations.v1,
        { headers: { 'Accept': 'application/json;odata=nometadata' } }
      );

      if (checkResp.ok) {
        // List exists — verify field by trying to read items with CitiesData
        const testUrl = `${this.siteUrl}/_api/web/lists/getbytitle('${LIST_TITLE}')/items?$select=Id,CitiesData&$top=1`;
        const testResp = await this.spHttpClient.get(
          testUrl,
          SPHttpClient.configurations.v1,
          { headers: { 'Accept': 'application/json;odata=nometadata' } }
        );

        if (testResp.ok) {
          this.listEnsured = true;
          console.log('[WeatherPrefs] List ready');
          return true;
        }

        // List exists but CitiesData field is missing — try adding it
        console.log('[WeatherPrefs] List exists but CitiesData field missing, adding...');
        const added = await this.addFieldViaXml();
        if (added) {
          this.listEnsured = true;
          return true;
        }
        console.error('[WeatherPrefs] Could not add CitiesData field');
        return false;
      }
    } catch {
      // List doesn't exist
    }

    // Create list with field via XML schema
    console.log('[WeatherPrefs] Creating list with XML schema...');

    // Use the list creation endpoint with a custom field XML
    const createUrl = `${this.siteUrl}/_api/web/lists`;
    const createResp = await this.spHttpClient.post(
      createUrl,
      SPHttpClient.configurations.v1,
      {
        headers: {
          'Accept': 'application/json;odata=nometadata',
          'Content-Type': 'application/json;odata=nometadata',
        },
        body: JSON.stringify({
          Title: LIST_TITLE,
          Description: 'Weather Dashboard — stores saved city preferences per user',
          BaseTemplate: 100,
          Hidden: false,
        }),
      }
    );

    if (!createResp.ok) {
      const text = await createResp.text();
      console.error('[WeatherPrefs] List creation failed:', createResp.status, text);
      return false;
    }

    console.log('[WeatherPrefs] List created, adding CitiesData field...');

    // Add field using XML schema (more reliable than FieldTypeKind)
    const added = await this.addFieldViaXml();
    if (added) {
      this.listEnsured = true;
      console.log('[WeatherPrefs] List and field ready');
      return true;
    }

    console.error('[WeatherPrefs] Field creation failed');
    return false;
  }

  /**
   * Add CitiesData field using AddFieldAsXml — more reliable than the
   * fields endpoint with FieldTypeKind which was silently failing.
   */
  private async addFieldViaXml(): Promise<boolean> {
    const addFieldUrl = `${this.siteUrl}/_api/web/lists/getbytitle('${LIST_TITLE}')/fields/addfieldasxml`;

    const fieldXml = '<Field Type="Note" DisplayName="CitiesData" Name="CitiesData" StaticName="CitiesData" NumLines="6" RichText="FALSE" UnlimitedLengthInDocumentLibrary="TRUE" />';

    const response = await this.spHttpClient.post(
      addFieldUrl,
      SPHttpClient.configurations.v1,
      {
        headers: {
          'Accept': 'application/json;odata=nometadata',
          'Content-Type': 'application/json;odata=nometadata',
        },
        body: JSON.stringify({
          parameters: {
            __metadata: { type: 'SP.XmlSchemaFieldCreationInformation' },
            SchemaXml: fieldXml,
            Options: 8, // AddFieldInternalNameHint
          },
        }),
      }
    );

    if (!response.ok) {
      const text = await response.text();
      console.error('[WeatherPrefs] AddFieldAsXml failed:', response.status, text);
      return false;
    }

    console.log('[WeatherPrefs] CitiesData field created via XML');
    return true;
  }
}
