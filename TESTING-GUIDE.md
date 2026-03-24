# Weather Dashboard SPFx Web Part — Testing Guide

## Quick Reference
- **Tenant:** thestylecollectiveconz.sharepoint.com
- **Site:** /sites/SailRail
- **Page:** Weather-Reports.aspx
- **Preferences file:** SiteAssets/weather-dashboard-prefs.json

---

## 1. Core Functionality Tests

### 1.1 City Search
| Test | Steps | Expected Result |
|------|-------|----------------|
| Search NZ city | Type "Auckland" in search box | Dropdown shows Auckland, Auckland as top result |
| Search international city | Type "London" | Dropdown shows London, England, United Kingdom |
| Search partial name | Type "nap" | Dropdown shows Napier City and other matches |
| Search gibberish | Type "xyzxyz" | No dropdown results appear |
| Empty search | Clear search box | Dropdown disappears |
| Select from dropdown | Click a city in dropdown | City card appears on dashboard |

### 1.2 Weather Data Display
| Test | Steps | Expected Result |
|------|-------|----------------|
| Temperature shown | Add any city | Temperature displays in °C |
| Weather condition | Add any city | Condition text + icon shown (e.g., "Overcast" with cloud icon) |
| Humidity | Check card details | Humidity shown as percentage |
| Wind speed | Check card details | Wind shown in km/h |
| UV Index | Check card details | UV value shown with severity label and colour |
| Clothing recommendation | Check card details | Layer advice matches temperature range |
| Timestamp | Check card footer | "Updated: DD/MM/YYYY, HH:MM am/pm" in NZ format |

### 1.3 UV Index Colour Coding
| UV Range | Label | Expected Colour |
|----------|-------|----------------|
| 0–2 | Low | Green |
| 3–5 | Moderate | Orange |
| 6–7 | High | Red/Orange |
| 8–10 | Very High | Red |
| 11+ | Extreme | Purple/Red |

### 1.4 Clothing Recommendations
| Temperature | Expected Recommendation |
|-------------|----------------------|
| > 25°C | Single light layer |
| 18–25°C | Light layer + jacket |
| 10–18°C | Two layers |
| 0–10°C | Three layers |
| < 0°C | Four+ layers, heavy coat |

---

## 2. Multi-City Dashboard Tests

| Test | Steps | Expected Result |
|------|-------|----------------|
| Add multiple cities | Search and add Auckland, Napier, Wellington | All 3 cards display side by side |
| Duplicate prevention | Add Auckland, then try adding Auckland again | Warning message "already on dashboard" |
| Remove city | Click X on a city card | Card removed, other cards remain |
| Refresh single city | Click refresh icon on a card | That card reloads weather data |
| Card layout | Add 3+ cities | Cards wrap to next row responsively |

---

## 3. Cross-Browser Persistence Tests

### 3.1 Basic Persistence
| Test | Steps | Expected Result |
|------|-------|----------------|
| Persist on refresh | Add 3 cities → Ctrl+F5 | All 3 cities reload |
| Persist in Edge | Add cities in Edge → close tab → reopen | Cities still there |
| Persist in Chrome | Open same URL in Chrome | Same cities appear |
| Remove persists | Remove a city → refresh | City stays removed |

### 3.2 SiteAssets File Verification
| Test | Steps | Expected Result |
|------|-------|----------------|
| File created | Add a city → go to SiteAssets library | `weather-dashboard-prefs.json` file exists |
| File content | Download and open the JSON file | Valid JSON with user email and city data |
| File updates | Add another city → re-download file | New city appears in JSON |

### 3.3 Edge Cases
| Test | Steps | Expected Result |
|------|-------|----------------|
| Clear all cities | Remove all cities one by one | Empty state message shows, file has empty array |
| Rapid add/remove | Quickly add 3 cities then remove 2 | Debounced save captures final state correctly |
| Simultaneous tabs | Open page in 2 tabs, add different cities | Last save wins (acceptable) |

---

## 4. Error Handling Tests

| Test | Steps | Expected Result |
|------|-------|----------------|
| Network offline | Disconnect internet → try searching | Graceful error, no crash |
| API timeout | Throttle network in DevTools (Slow 3G) | Loading state shows, eventually loads or shows error |
| Invalid city coordinates | (Edge case — hard to reproduce) | Error message on card, not a crash |
| Console errors | Open F12 → Console during normal use | No red errors from weather-dashboard code |

---

## 5. Property Pane Tests

| Test | Steps | Expected Result |
|------|-------|----------------|
| Open property pane | Edit page → click web part → edit icon | Property pane opens on right |
| Change title | Edit "Dashboard Title" field | Title updates on page |
| Change default city | Change to "Wellington" → remove all cities → refresh | Wellington loads as default |
| Refresh interval | Set to 5 minutes | Weather auto-refreshes after 5 min |

---

## 6. Performance Tests

| Test | Steps | Expected Result |
|------|-------|----------------|
| Initial load time | Ctrl+F5 with DevTools Network tab open | Web part renders within 3 seconds |
| Search responsiveness | Type city name | Autocomplete dropdown appears within 1 second |
| Multiple cards | Add 6+ cities | Page remains responsive, no lag |
| Memory leaks | Open page, leave for 30 minutes | No increasing memory in DevTools |

---

## 7. SharePoint Integration Tests

| Test | Steps | Expected Result |
|------|-------|----------------|
| Theme compatibility | Change site theme | Web part colours adapt |
| Mobile view | Open page on mobile or resize browser narrow | Cards stack vertically |
| Edit mode | Edit page with web part | Web part still functions normally |
| Multiple instances | Add web part to 2 different pages | Both work independently |

---

## 8. Cleanup Checklist

After testing, clean up test artifacts:
- [ ] Delete old unused lists: `WeatherDashboardPrefs`, `WDCityPreferences`, `WeatherCities`, `WeatherUserPrefs`
- [ ] Remove old `WeatherReports` document library (if no longer needed)
- [ ] Verify `SiteAssets/weather-dashboard-prefs.json` contains only valid data

---

## Key Learnings (For Future SPFx Development)

1. **Never use custom SharePoint list fields from client-side code** — field provisioning via REST API is unreliable on SharePoint Online. Use SiteAssets JSON files or built-in fields only.
2. **SiteAssets JSON file pattern** — simple, works cross-browser, no provisioning needed. Use `GetFolderByServerRelativeUrl().Files.add()` for writes and `GetFileByServerRelativeUrl()/$value` for reads.
3. **OData $filter with @ symbols** — breaks because @ is an OData parameter alias prefix. Use client-side filtering instead.
4. **SPFx web part properties** — only persist when the page is saved in edit mode. Not suitable for runtime user data.
5. **Reference resources:**
   - https://pnp.github.io/sp-dev-fx-webparts/ (PnP SPFx samples)
   - https://rencore.com/en/blog/sharepoint-framework-weather-web-part
   - https://intuitionlabs.ai/articles/spfx-ai-coding-guide
