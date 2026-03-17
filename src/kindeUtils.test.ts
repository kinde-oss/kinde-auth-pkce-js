/**
 * Test to verify the /utils export path works correctly
 */

// This test verifies that users can import from @kinde-oss/kinde-auth-pkce-js/utils
// and access all exports from @kinde/js-utils

describe('Utils export path', () => {
  test('should be able to import storageSettings from /utils', async () => {
    // Note: In the actual package, this would be imported from the built dist files
    // For testing purposes, we import directly from @kinde/js-utils
    const {storageSettings} = await import('./kindeUtils');

    expect(storageSettings).toBeDefined();
    expect(storageSettings.keyPrefix).toBeDefined();
    expect(storageSettings.maxLength).toBeDefined();
  });

  test('should be able to import MemoryStorage from /utils', async () => {
    const {MemoryStorage} = await import('./kindeUtils');

    expect(MemoryStorage).toBeDefined();

    // Create an instance to verify it works
    const storage = new MemoryStorage();
    expect(storage).toBeDefined();
    expect(storage.setSessionItem).toBeDefined();
    expect(storage.getSessionItem).toBeDefined();
  });

  test('should be able to import LocalStorage from /utils', async () => {
    const {LocalStorage} = await import('./kindeUtils');

    expect(LocalStorage).toBeDefined();
  });

  test('should be able to import StorageKeys from /utils', async () => {
    const {StorageKeys} = await import('./kindeUtils');

    expect(StorageKeys).toBeDefined();
    expect(StorageKeys.accessToken).toBe('accessToken');
    expect(StorageKeys.idToken).toBe('idToken');
    expect(StorageKeys.refreshToken).toBe('refreshToken');
  });

  test('should export utility functions from @kinde/js-utils', async () => {
    const utils = await import('./kindeUtils');

    // Check for some key utility functions
    expect(utils.base64UrlEncode).toBeDefined();
    expect(utils.generateRandomString).toBeDefined();
    expect(utils.isCustomDomain).toBeDefined();
  });
});
