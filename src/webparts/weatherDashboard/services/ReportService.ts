import { SPHttpClient, SPHttpClientResponse } from '@microsoft/sp-http';
import { ICityWeather } from '../models/IWeatherData';
import { getWeatherInfo } from '../helpers/weatherCodes';
import { getClothingRecommendation } from '../helpers/clothingHelper';
import { formatNZDateTime, getUVLabel } from '../helpers/formatHelper';

/**
 * Service for saving weather reports to a SharePoint document library.
 */
export class ReportService {
  private spHttpClient: SPHttpClient;
  private siteUrl: string;

  constructor(spHttpClient: SPHttpClient, siteUrl: string) {
    this.spHttpClient = spHttpClient;
    this.siteUrl = siteUrl;
  }

  /**
   * Generate a plain-text weather report for all cities.
   * @param cities - Array of city weather data
   * @returns Report content as a string
   */
  public generateReport(cities: ICityWeather[]): string {
    const now = new Date();
    const lines: string[] = [
      '========================================',
      '       WEATHER DASHBOARD REPORT',
      '========================================',
      `Generated: ${formatNZDateTime(now)}`,
      `Cities: ${cities.length}`,
      '========================================',
      '',
    ];

    for (const entry of cities) {
      const { city, weather } = entry;
      const location = city.admin1
        ? `${city.name}, ${city.admin1}, ${city.country}`
        : `${city.name}, ${city.country}`;

      lines.push(`--- ${location} ---`);

      if (!weather) {
        lines.push('  Weather data unavailable');
        lines.push('');
        continue;
      }

      const condition = getWeatherInfo(weather.weatherCode);
      const clothing = getClothingRecommendation(weather.temperature);
      const uvLabel = getUVLabel(weather.uvIndex);

      lines.push(`  Condition:   ${condition.icon} ${condition.description}`);
      lines.push(`  Temperature: ${weather.temperature}\u00B0C`);
      lines.push(`  Humidity:    ${weather.humidity}%`);
      lines.push(`  Wind Speed:  ${weather.windSpeed} km/h`);
      lines.push(`  UV Index:    ${weather.uvIndex} (${uvLabel})`);
      lines.push(`  Clothing:    ${clothing}`);

      if (entry.lastUpdated) {
        lines.push(`  Updated:     ${formatNZDateTime(entry.lastUpdated)}`);
      }

      lines.push('');
    }

    lines.push('========================================');
    lines.push('End of report');
    lines.push('========================================');

    return lines.join('\n');
  }

  /**
   * Save a weather report to a SharePoint document library.
   * Creates the file in the "Weather Reports" library (creates it via folder if needed).
   * @param cities - Array of city weather data
   * @param libraryName - Document library name (default: "Weather Reports")
   * @returns The server-relative URL of the created file
   */
  public async saveReport(
    cities: ICityWeather[],
    libraryName: string = 'Weather Reports'
  ): Promise<string> {
    const content = this.generateReport(cities);
    const now = new Date();
    const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const cityNames = cities
      .map((c) => c.city.name)
      .join('_')
      .replace(/[^a-zA-Z0-9_]/g, '');
    const fileName = `WeatherReport_${cityNames}_${timestamp}.txt`;

    // Ensure the document library folder exists
    await this.ensureFolder(libraryName);

    // Upload file to the library
    const uploadUrl =
      `${this.siteUrl}/_api/web/getfolderbyserverrelativeurl('${libraryName}')/files/add(overwrite=true,url='${fileName}')`;

    try {
      const response: SPHttpClientResponse = await this.spHttpClient.post(
        uploadUrl,
        SPHttpClient.configurations.v1,
        {
          headers: {
            'Accept': 'application/json;odata=nometadata',
            'Content-Type': 'text/plain',
          },
          body: content,
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Upload failed: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      return result.ServerRelativeUrl || `${libraryName}/${fileName}`;
    } catch (error) {
      console.error('Report save failed:', error);
      throw new Error(`Failed to save report to "${libraryName}". Ensure the library exists and you have write permissions.`);
    }
  }

  /**
   * Ensure a folder/library exists at the site level.
   * @param folderName - The folder or library name
   */
  private async ensureFolder(folderName: string): Promise<void> {
    const checkUrl =
      `${this.siteUrl}/_api/web/getfolderbyserverrelativeurl('${folderName}')`;

    try {
      const response = await this.spHttpClient.get(
        checkUrl,
        SPHttpClient.configurations.v1
      );

      if (response.ok) {
        return; // folder exists
      }
    } catch {
      // folder doesn't exist, continue to create
    }

    // If library doesn't exist, we cannot create it via REST easily.
    // Throw a helpful error instead.
    throw new Error(
      `Document library "${folderName}" not found. Please create a document library named "${folderName}" in your SharePoint site.`
    );
  }
}
