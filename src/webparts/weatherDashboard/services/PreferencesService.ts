import { SPHttpClient, SPHttpClientResponse } from '@microsoft/sp-http';
import { ICityResult } from '../models/IWeatherData';

/**
 * Uses an Announcements list (BaseTemplate 104) which has a built-in
 * multi-line "Body" field. NO custom field creation needed.
 *
 * Schema (all built-in fields):
 *   Title = user login name
 *   Body  = JSON string of saved cities
 */
const LIST_TITLE = 'WeatherUserPrefs';

export class PreferencesService {
  private spHttpClient: SPHttpClient;
  private siteUrl: string;
  private userLoginName: string;
  private listReady: boolean = false;

  constructor(
    spHttpClient: SPHttpClient,
    siteUrl: string,
    _instanceId: string,
    userLoginName: string
  ) {
    this.spHttpClient = spHttpClient;
    this.siteUrl = siteUrl;
    this.userLoginName = userLoginName;
    console.log('[WP] Init user:', userLoginName);
  }

  public async loadCities(): Promise<ICityResult[]> {
    try {
      if (!await this.ensureList()) return [];

      const url = `${this.siteUrl}/_api/web/lists/getbytitle('${LIST_TITLE}')/items?$select=Id,Title,Body&$top=100`;
      const resp = await this.get(url);
      if (!resp) return [];

      const data = await resp.json();
      const items: Array<{ Id: number; Title: string; Body: string }> = data.value || [];
      console.log('[WP] Items found:', items.length);

      const mine = items.find(i => i.Title?.toLowerCase() === this.userLoginName.toLowerCase());
      if (mine?.Body) {
        const cities: ICityResult[] = JSON.parse(mine.Body);
        console.log('[WP] Loaded', cities.length, 'cities');
        return cities;
      }
      return [];
    } catch (e) {
      console.error('[WP] Load error:', e);
      return [];
    }
  }

  public async saveCities(cities: ICityResult[]): Promise<void> {
    try {
      if (!await this.ensureList()) return;

      const body = JSON.stringify(cities);
      console.log('[WP] Saving', cities.length, 'cities...');

      // Find existing item
      const url = `${this.siteUrl}/_api/web/lists/getbytitle('${LIST_TITLE}')/items?$select=Id,Title&$top=100`;
      const resp = await this.get(url);
      if (!resp) return;

      const data = await resp.json();
      const items: Array<{ Id: number; Title: string }> = data.value || [];
      const mine = items.find(i => i.Title?.toLowerCase() === this.userLoginName.toLowerCase());

      if (mine) {
        await this.patch(mine.Id, body);
      } else {
        await this.create(body);
      }
    } catch (e) {
      console.error('[WP] Save error:', e);
    }
  }

  private async create(body: string): Promise<void> {
    const url = `${this.siteUrl}/_api/web/lists/getbytitle('${LIST_TITLE}')/items`;
    const resp = await this.spHttpClient.post(url, SPHttpClient.configurations.v1, {
      headers: {
        'Accept': 'application/json;odata=nometadata',
        'Content-Type': 'application/json;odata=nometadata',
      },
      body: JSON.stringify({ Title: this.userLoginName, Body: body }),
    });
    if (resp.ok) {
      console.log('[WP] Created item');
    } else {
      console.error('[WP] Create failed:', resp.status, await resp.text());
    }
  }

  private async patch(id: number, body: string): Promise<void> {
    const url = `${this.siteUrl}/_api/web/lists/getbytitle('${LIST_TITLE}')/items(${id})`;
    const resp = await this.spHttpClient.post(url, SPHttpClient.configurations.v1, {
      headers: {
        'Accept': 'application/json;odata=nometadata',
        'Content-Type': 'application/json;odata=nometadata',
        'IF-MATCH': '*',
        'X-HTTP-Method': 'MERGE',
      },
      body: JSON.stringify({ Body: body }),
    });
    if (resp.ok) {
      console.log('[WP] Updated item', id);
    } else {
      console.error('[WP] Update failed:', resp.status, await resp.text());
    }
  }

  private async get(url: string): Promise<SPHttpClientResponse | null> {
    const resp = await this.spHttpClient.get(url, SPHttpClient.configurations.v1, {
      headers: { 'Accept': 'application/json;odata=nometadata' },
    });
    if (!resp.ok) {
      console.error('[WP] GET failed:', resp.status, url);
      return null;
    }
    return resp;
  }

  private async ensureList(): Promise<boolean> {
    if (this.listReady) return true;

    // Check if list exists
    const checkUrl = `${this.siteUrl}/_api/web/lists/getbytitle('${LIST_TITLE}')`;
    const checkResp = await this.spHttpClient.get(checkUrl, SPHttpClient.configurations.v1, {
      headers: { 'Accept': 'application/json;odata=nometadata' },
    });

    if (checkResp.ok) {
      this.listReady = true;
      console.log('[WP] List exists');
      return true;
    }

    // Create as Announcements list (has built-in Body field)
    console.log('[WP] Creating announcements list...');
    const createUrl = `${this.siteUrl}/_api/web/lists`;
    const createResp = await this.spHttpClient.post(createUrl, SPHttpClient.configurations.v1, {
      headers: {
        'Accept': 'application/json;odata=nometadata',
        'Content-Type': 'application/json;odata=nometadata',
      },
      body: JSON.stringify({
        Title: LIST_TITLE,
        Description: 'Weather Dashboard city preferences',
        BaseTemplate: 104,
        Hidden: false,
      }),
    });

    if (createResp.ok) {
      this.listReady = true;
      console.log('[WP] List created (Announcements template)');
      return true;
    }

    console.error('[WP] List creation failed:', createResp.status, await createResp.text());
    return false;
  }
}
