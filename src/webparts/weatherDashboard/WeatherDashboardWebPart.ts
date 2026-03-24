import * as React from 'react';
import * as ReactDom from 'react-dom';
import { Version } from '@microsoft/sp-core-library';
import {
  type IPropertyPaneConfiguration,
  PropertyPaneTextField,
  PropertyPaneSlider,
} from '@microsoft/sp-property-pane';
import { BaseClientSideWebPart } from '@microsoft/sp-webpart-base';
import { IReadonlyTheme } from '@microsoft/sp-component-base';

import WeatherDashboard from './components/WeatherDashboard';
import { IWeatherDashboardProps } from './components/IWeatherDashboardProps';
import { ICityResult } from './models/IWeatherData';

export interface IWeatherDashboardWebPartProps {
  /** Title displayed above the dashboard */
  title: string;
  /** Default city to load on first render */
  defaultCity: string;
  /** Auto-refresh interval in minutes (0 = disabled) */
  refreshInterval: number;
  /** SharePoint document library name for saving reports */
  reportLibrary: string;
  /** JSON-serialized array of saved cities */
  savedCities: string;
}

/**
 * Weather Dashboard SPFx Web Part.
 * Displays current weather for multiple cities with NZ formatting,
 * clothing recommendations, UV index, and report saving to SharePoint.
 */
export default class WeatherDashboardWebPart extends BaseClientSideWebPart<IWeatherDashboardWebPartProps> {
  private _isDarkTheme: boolean = false;

  public render(): void {
    const element: React.ReactElement<IWeatherDashboardProps> = React.createElement(
      WeatherDashboard,
      {
        title: this.properties.title,
        defaultCity: this.properties.defaultCity,
        refreshInterval: this.properties.refreshInterval,
        reportLibrary: this.properties.reportLibrary,
        httpClient: this.context.httpClient,
        spHttpClient: this.context.spHttpClient,
        siteUrl: this.context.pageContext.web.absoluteUrl,
        siteServerRelativeUrl: this.context.pageContext.web.serverRelativeUrl,
        savedCities: this.properties.savedCities || '[]',
        onCitiesChanged: this.onCitiesChanged,
        isDarkTheme: this._isDarkTheme,
      }
    );

    ReactDom.render(element, this.domElement);
  }

  protected onInit(): Promise<void> {
    // Set defaults if not configured
    if (!this.properties.title) {
      this.properties.title = 'Weather Dashboard';
    }
    if (!this.properties.defaultCity) {
      this.properties.defaultCity = 'Auckland';
    }
    if (this.properties.refreshInterval === undefined) {
      this.properties.refreshInterval = 15;
    }
    if (!this.properties.reportLibrary) {
      this.properties.reportLibrary = 'Weather Reports';
    }

    return Promise.resolve();
  }

  private onCitiesChanged = (cities: ICityResult[]): void => {
    this.properties.savedCities = JSON.stringify(cities);
  };

  protected onThemeChanged(currentTheme: IReadonlyTheme | undefined): void {
    if (!currentTheme) {
      return;
    }

    this._isDarkTheme = !!currentTheme.isInverted;
    const { semanticColors } = currentTheme;

    if (semanticColors) {
      this.domElement.style.setProperty('--bodyText', semanticColors.bodyText || null);
      this.domElement.style.setProperty('--bodySubtext', semanticColors.bodySubtext || null);
      this.domElement.style.setProperty('--bodyBackground', semanticColors.bodyBackground || null);
      this.domElement.style.setProperty('--link', semanticColors.link || null);
      this.domElement.style.setProperty('--linkHovered', semanticColors.linkHovered || null);
      this.domElement.style.setProperty('--neutralLight', (semanticColors as unknown as Record<string, string>).neutralLight || null);
      this.domElement.style.setProperty('--neutralLighter', (semanticColors as unknown as Record<string, string>).neutralLighter || null);
    }
  }

  protected onDispose(): void {
    ReactDom.unmountComponentAtNode(this.domElement);
  }

  protected get dataVersion(): Version {
    return Version.parse('1.0');
  }

  protected getPropertyPaneConfiguration(): IPropertyPaneConfiguration {
    return {
      pages: [
        {
          header: {
            description: 'Configure the Weather Dashboard web part.',
          },
          groups: [
            {
              groupName: 'Display Settings',
              groupFields: [
                PropertyPaneTextField('title', {
                  label: 'Dashboard Title',
                  value: this.properties.title,
                }),
                PropertyPaneTextField('defaultCity', {
                  label: 'Default City',
                  description: 'City loaded when the web part first appears.',
                  value: this.properties.defaultCity,
                }),
              ],
            },
            {
              groupName: 'Refresh & Reports',
              groupFields: [
                PropertyPaneSlider('refreshInterval', {
                  label: 'Auto-refresh (minutes)',
                  min: 0,
                  max: 60,
                  step: 5,
                  showValue: true,
                  value: this.properties.refreshInterval,
                }),
                PropertyPaneTextField('reportLibrary', {
                  label: 'Report Library Name',
                  description: 'SharePoint document library for saving weather reports.',
                  value: this.properties.reportLibrary,
                }),
              ],
            },
          ],
        },
      ],
    };
  }
}
