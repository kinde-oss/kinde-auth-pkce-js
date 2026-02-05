/**
 * Example: Using @kinde-oss/kinde-auth-pkce-js/utils
 *
 * The /utils export provides access to all utilities from @kinde/js-utils
 * without needing to install it separately as a dependency.
 */

// Import from the /utils subpath
import {
  storageSettings,
  MemoryStorage,
  LocalStorage,
  StorageKeys,
  base64UrlEncode,
  generateRandomString,
  isCustomDomain
} from '@kinde-oss/kinde-auth-pkce-js/utils';

// Example 1: Configure storage settings
storageSettings.keyPrefix = 'MyApp-';
storageSettings.maxLength = 5000;
storageSettings.activityTimeoutMinutes = 30;

console.log('Storage settings configured:', {
  keyPrefix: storageSettings.keyPrefix,
  maxLength: storageSettings.maxLength
});

// Example 2: Use MemoryStorage directly
const memoryStorage = new MemoryStorage();
memoryStorage.setSessionItem(StorageKeys.accessToken, 'my-token-value');
const token = memoryStorage.getSessionItem(StorageKeys.accessToken);
console.log('Token from memory storage:', token);

// Example 3: Use LocalStorage for persistent storage
const localStorage = new LocalStorage();
localStorage.setSessionItem('user_preference', 'dark_mode');
const preference = localStorage.getSessionItem('user_preference');
console.log('User preference:', preference);

// Example 4: Use utility functions
const randomString = generateRandomString(32);
console.log('Random string:', randomString);

const encodedValue = base64UrlEncode('Hello, World!');
console.log('Base64 URL encoded:', encodedValue);

const isDomainCustom = isCustomDomain('https://myapp.kinde.com');
console.log('Is custom domain:', isDomainCustom);

// Example 5: Access StorageKeys enum
console.log('Available storage keys:', {
  accessToken: StorageKeys.accessToken,
  idToken: StorageKeys.idToken,
  refreshToken: StorageKeys.refreshToken,
  state: StorageKeys.state,
  nonce: StorageKeys.nonce,
  codeVerifier: StorageKeys.codeVerifier
});

/**
 * Benefits of using /utils export:
 *
 * 1. Single dependency - No need to separately install @kinde/js-utils
 * 2. Version alignment - Ensures you're using the same version as the SDK
 * 3. Consistent API - All storage and utility functions use the same patterns
 * 4. TypeScript support - Full type definitions included
 */
