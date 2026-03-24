import { SPHttpClient } from '@microsoft/sp-http';
import { ICityResult } from '../models/IWeatherData';

/**
 * Stores weather city preferences as a JSON file in SiteAssets.
 * No lists, no custom fields, no content types — just a file.
 *
 * File: SiteAssets/weather-dashboard-prefs.json
 * Format: { "users": { "user@email.com": [ ...cities ] } }
 */
export class PreferencesService {
  private spHttpClient: SPHttpClient;
  private siteUrl: string;
  private siteRelativeUrl: string;
  private userLoginName: string;

  constructor(
    spHttpClient: SPHttpClient,
    siteUrl: string,
    _instanceId: string,
    userLoginName: string
  ) {
    this.spHttpClient = spHttpClient;
    this.siteUrl = siteUrl;
    this.userLoginName = userLoginName.toLowerCase();

    // Extract site-relative URL from absolute URL
    // e.g., https://tenant.sharepoint.com/sites/SailRail → /sites/SailRail
    const url = new URL(siteUrl);
    this.siteRelativeUrl = url.pathname;

    console.log('[WP] Init — user:', this.userLoginName, 'site:', this.siteRelativeUrl);
  }

  private get filePath(): string {
    return `${this.siteRelativeUrl}/SiteAssets/weather-dashboard-prefs.json`;
  }

  /**
   * Load saved cities for the current user from the JSON file.
   */
  public async loadCities(): Promise<ICityResult[]> {
    try {
      const allPrefs = await this.readPrefsFile();
      const cities = allPrefs.users?.[this.userLoginName] || [];
      console.log('[WP] Loaded', cities.length, 'cities');
      return cities;
    } catch (e) {
      console.log('[WP] No saved preferences yet');
      return [];
    }
  }

  /**
   * Save cities for the current user to the JSON file.
   */
  public async saveCities(cities: ICityResult[]): Promise<void> {
    try {
      console.log('[WP] Saving', cities.length, 'cities...');

      // Read existing prefs (or start fresh)
      let allPrefs: IPrefsFile;
      try {
        allPrefs = await this.readPrefsFile();
      } catch {
        allPrefs = { users: {} };
      }

      // Update this user's cities
      allPrefs.users[this.userLoginName] = cities;

      // Write back
      await this.writePrefsFile(allPrefs);
      console.log('[WP] Saved successfully');
    } catch (e) {
      console.error('[WP] Save failed:', e);
    }
  }

  /**
   * Read the prefs JSON file from SiteAssets.
   */
  private async readPrefsFile(): Promise<IPrefsFile> {
    const fileUrl = `${this.siteUrl}/_api/web/GetFileByServerRelativeUrl('${this.filePath}')/$value`;

    const resp = await this.spHttpClient.get(
      fileUrl,
      SPHttpClient.configurations.v1,
      { headers: { 'Accept': 'application/json' } }
    );

    if (!resp.ok) {
      throw new Error(`File read failed: ${resp.status}`);
    }

    const text = await resp.text();
    return JSON.parse(text);
  }

  /**
   * Write the prefs JSON file to SiteAssets using the Files REST API.
   */
  private async writePrefsFile(prefs: IPrefsFile): Promise<void> {
    const content = JSON.stringify(prefs, null, 2);

    // Use Files/add with overwrite=true
    const uploadUrl = `${this.siteUrl}/_api/web/GetFolderByServerRelativeUrl('${this.siteRelativeUrl}/SiteAssets')/Files/add(url='weather-dashboard-prefs.json',overwrite=true)`;

    const resp = await this.spHttpClient.post(
      uploadUrl,
      SPHttpClient.configurations.v1,
      {
        headers: {
          'Accept': 'application/json;odata=nometadata',
          'Content-Type': 'application/octet-stream',
        },
        body: content,
      }
    );

    if (!resp.ok) {
      const errText = await resp.text();
      console.error('[WP] File write failed:', resp.status, errText);
      throw new Error(`File write failed: ${resp.status}`);
    }
  }
}

interface IPrefsFile {
  users: Record<string, ICityResult[]>;
}
