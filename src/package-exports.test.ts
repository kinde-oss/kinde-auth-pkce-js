/**
 * Integration test to verify package.json exports work correctly
 * This simulates how consumers would import from the package
 */

describe('Package exports integration', () => {
  test('main export should work', async () => {
    // Simulate: import createKindeClient from '@kinde-oss/kinde-auth-pkce-js'
    const mainExport = await import('./index');

    expect(mainExport.default).toBeDefined();
    expect(typeof mainExport.default).toBe('function');
  });

  test('should export storageSettings from main', async () => {
    const {storageSettings} = await import('./index');

    expect(storageSettings).toBeDefined();
    expect(storageSettings.keyPrefix).toBeDefined();
  });

  test('should export SessionManager type from main', async () => {
    // This is a type-only test, just verify the import doesn't fail
    const exports = await import('./index');

    expect(exports).toBeDefined();
  });

  test('utils export should re-export from @kinde/js-utils', async () => {
    const utils = await import('./kindeUtils');

    // Verify key exports exist
    expect(utils.storageSettings).toBeDefined();
    expect(utils.MemoryStorage).toBeDefined();
    expect(utils.LocalStorage).toBeDefined();
    expect(utils.StorageKeys).toBeDefined();
    expect(utils.base64UrlEncode).toBeDefined();
    expect(utils.generateRandomString).toBeDefined();
    expect(utils.isCustomDomain).toBeDefined();
  });
});
