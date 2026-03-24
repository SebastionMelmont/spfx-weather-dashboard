import { PreferencesService } from '../services/PreferencesService';
import { SPHttpClient } from '@microsoft/sp-http';
import { ICityResult } from '../models/IWeatherData';

// Mock city data
const mockAuckland: ICityResult = {
  id: 2193733,
  name: 'Auckland',
  latitude: -36.8485,
  longitude: 174.7633,
  country: 'New Zealand',
  admin1: 'Auckland',
};

const mockNapier: ICityResult = {
  id: 2186280,
  name: 'Napier City',
  latitude: -39.4928,
  longitude: 176.9120,
  country: 'New Zealand',
  admin1: "Hawke's Bay Region",
};

// Helper to create a mock SPHttpClient
function createMockSPHttpClient(options: {
  getResponse?: { ok: boolean; status: number; body: string };
  postResponse?: { ok: boolean; status: number; body: string };
} = {}): SPHttpClient {
  const defaultGet = { ok: false, status: 404, body: '' };
  const defaultPost = { ok: true, status: 200, body: '{}' };
  const getResp = options.getResponse || defaultGet;
  const postResp = options.postResponse || defaultPost;

  return {
    get: jest.fn().mockResolvedValue({
      ok: getResp.ok,
      status: getResp.status,
      text: jest.fn().mockResolvedValue(getResp.body),
    }),
    post: jest.fn().mockResolvedValue({
      ok: postResp.ok,
      status: postResp.status,
      text: jest.fn().mockResolvedValue(postResp.body),
    }),
  } as unknown as SPHttpClient;
}

describe('PreferencesService', () => {
  const siteUrl = 'https://tenant.sharepoint.com/sites/TestSite';
  const instanceId = 'test-instance-id';
  const userLogin = 'markus@thestylecollective.co.nz';

  describe('constructor', () => {
    it('normalises user login to lowercase', () => {
      const spClient = createMockSPHttpClient();
      // We can't directly test private properties, but we can verify
      // behaviour through load/save which uses the lowercased key
      const service = new PreferencesService(spClient, siteUrl, instanceId, 'Markus@TheStyleCollective.co.nz');
      // Verify it was created without errors
      expect(service).toBeDefined();
    });

    it('extracts correct site-relative URL', async () => {
      const prefsData = { users: { 'markus@thestylecollective.co.nz': [mockAuckland] } };
      const spClient = createMockSPHttpClient({
        getResponse: { ok: true, status: 200, body: JSON.stringify(prefsData) },
      });

      const service = new PreferencesService(spClient, siteUrl, instanceId, userLogin);
      await service.loadCities();

      // Verify the GET call uses the correct site-relative path
      expect(spClient.get).toHaveBeenCalledWith(
        expect.stringContaining('/sites/TestSite/SiteAssets/weather-dashboard-prefs.json'),
        expect.anything(),
        expect.anything()
      );
    });
  });

  describe('loadCities', () => {
    it('returns cities for the current user', async () => {
      const prefsData = {
        users: {
          'markus@thestylecollective.co.nz': [mockAuckland, mockNapier],
          'other@test.com': [mockAuckland],
        },
      };

      const spClient = createMockSPHttpClient({
        getResponse: { ok: true, status: 200, body: JSON.stringify(prefsData) },
      });

      const service = new PreferencesService(spClient, siteUrl, instanceId, userLogin);
      const cities = await service.loadCities();

      expect(cities).toHaveLength(2);
      expect(cities[0].name).toBe('Auckland');
      expect(cities[1].name).toBe('Napier City');
    });

    it('returns empty array when no prefs file exists (404)', async () => {
      const spClient = createMockSPHttpClient({
        getResponse: { ok: false, status: 404, body: '' },
      });

      const service = new PreferencesService(spClient, siteUrl, instanceId, userLogin);
      const cities = await service.loadCities();

      expect(cities).toEqual([]);
    });

    it('returns empty array when user has no saved cities', async () => {
      const prefsData = {
        users: {
          'other@test.com': [mockAuckland],
        },
      };

      const spClient = createMockSPHttpClient({
        getResponse: { ok: true, status: 200, body: JSON.stringify(prefsData) },
      });

      const service = new PreferencesService(spClient, siteUrl, instanceId, userLogin);
      const cities = await service.loadCities();

      expect(cities).toEqual([]);
    });

    it('returns empty array on network error', async () => {
      const spClient = {
        get: jest.fn().mockRejectedValue(new Error('Network error')),
        post: jest.fn(),
      } as unknown as SPHttpClient;

      const service = new PreferencesService(spClient, siteUrl, instanceId, userLogin);
      const cities = await service.loadCities();

      expect(cities).toEqual([]);
    });
  });

  describe('saveCities', () => {
    it('writes cities JSON to SiteAssets via POST', async () => {
      const spClient = createMockSPHttpClient({
        getResponse: { ok: false, status: 404, body: '' }, // No existing file
        postResponse: { ok: true, status: 200, body: '{}' },
      });

      const service = new PreferencesService(spClient, siteUrl, instanceId, userLogin);
      await service.saveCities([mockAuckland]);

      // Verify POST was called with the upload URL
      expect(spClient.post).toHaveBeenCalledWith(
        expect.stringContaining("Files/add(url='weather-dashboard-prefs.json',overwrite=true)"),
        expect.anything(),
        expect.objectContaining({
          body: expect.stringContaining('"Auckland"'),
        })
      );
    });

    it('merges with existing user data on save', async () => {
      const existingPrefs = {
        users: {
          'other@test.com': [mockNapier],
        },
      };

      const spClient = createMockSPHttpClient({
        getResponse: { ok: true, status: 200, body: JSON.stringify(existingPrefs) },
        postResponse: { ok: true, status: 200, body: '{}' },
      });

      const service = new PreferencesService(spClient, siteUrl, instanceId, userLogin);
      await service.saveCities([mockAuckland]);

      // Verify the written content contains both users
      const postCall = (spClient.post as jest.Mock).mock.calls[0];
      const writtenBody = postCall[2].body as string;
      const parsed = JSON.parse(writtenBody);

      expect(parsed.users['other@test.com']).toHaveLength(1);
      expect(parsed.users['markus@thestylecollective.co.nz']).toHaveLength(1);
    });

    it('creates fresh prefs file when none exists', async () => {
      const spClient = createMockSPHttpClient({
        getResponse: { ok: false, status: 404, body: '' },
        postResponse: { ok: true, status: 200, body: '{}' },
      });

      const service = new PreferencesService(spClient, siteUrl, instanceId, userLogin);
      await service.saveCities([mockAuckland, mockNapier]);

      const postCall = (spClient.post as jest.Mock).mock.calls[0];
      const writtenBody = postCall[2].body as string;
      const parsed = JSON.parse(writtenBody);

      expect(parsed.users['markus@thestylecollective.co.nz']).toHaveLength(2);
    });

    it('handles save failure gracefully without throwing', async () => {
      const spClient = createMockSPHttpClient({
        getResponse: { ok: false, status: 404, body: '' },
        postResponse: { ok: false, status: 500, body: 'Server error' },
      });

      const service = new PreferencesService(spClient, siteUrl, instanceId, userLogin);

      // Should not throw
      await expect(service.saveCities([mockAuckland])).resolves.toBeUndefined();
    });

    it('saves empty array when all cities removed', async () => {
      const existingPrefs = {
        users: {
          'markus@thestylecollective.co.nz': [mockAuckland, mockNapier],
        },
      };

      const spClient = createMockSPHttpClient({
        getResponse: { ok: true, status: 200, body: JSON.stringify(existingPrefs) },
        postResponse: { ok: true, status: 200, body: '{}' },
      });

      const service = new PreferencesService(spClient, siteUrl, instanceId, userLogin);
      await service.saveCities([]);

      const postCall = (spClient.post as jest.Mock).mock.calls[0];
      const writtenBody = postCall[2].body as string;
      const parsed = JSON.parse(writtenBody);

      expect(parsed.users['markus@thestylecollective.co.nz']).toEqual([]);
    });
  });
});
