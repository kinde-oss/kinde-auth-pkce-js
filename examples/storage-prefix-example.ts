/**
 * Example: Using storageSettings.keyPrefix
 *
 * The keyPrefix allows you to namespace your storage keys to avoid conflicts
 * when multiple applications or environments share the same storage mechanism.
 *
 * DEFAULT PREFIX: 'kinde_' (underscore)
 * This maintains backward compatibility with previous versions of this SDK.
 */

import {storageSettings} from '@kinde-oss/kinde-auth-pkce-js';
import createKindeClient from '@kinde-oss/kinde-auth-pkce-js';

// Default behavior - uses 'kinde_' prefix
// All storage keys will be: "kinde_access_token", "kinde_id_token", etc.
const client1 = await createKindeClient({
  client_id: 'your-client-id',
  domain: 'https://your-domain.kinde.com',
  redirect_uri: window.location.origin
});

// Example 1: Set custom prefix before initializing the client
// This is useful for multi-tenant applications or avoiding conflicts
storageSettings.keyPrefix = 'MyApp_';

const client2 = await createKindeClient({
  client_id: 'your-client-id',
  domain: 'https://your-domain.kinde.com',
  redirect_uri: window.location.origin
});

// Now all storage keys will be prefixed with "MyApp_"
// For example: "MyApp_kinde_access_token", "MyApp_kinde_id_token", etc.

// Example 2: Use different prefixes for different environments
if (process.env.NODE_ENV === 'development') {
  storageSettings.keyPrefix = 'dev_';
} else if (process.env.NODE_ENV === 'staging') {
  storageSettings.keyPrefix = 'staging_';
} else {
  storageSettings.keyPrefix = 'prod_';
}

// Example 3: Multi-tenant application with tenant-specific prefixes
const tenantId = 'tenant123';
storageSettings.keyPrefix = `${tenantId}_`;

// Example 4: Empty prefix (no prefix applied)
// Use this if you want to manage your own key naming
storageSettings.keyPrefix = '';

// Example 5: Other useful storageSettings options
storageSettings.maxLength = 5000; // Maximum length for stored values
storageSettings.useInsecureForRefreshToken = false; // Security setting for refresh tokens

// Example 6: Activity timeout configuration
storageSettings.activityTimeoutMinutes = 30; // Auto-logout after 30 minutes of inactivity
storageSettings.activityTimeoutPreWarningMinutes = 5; // Warning 5 minutes before timeout
storageSettings.onActivityTimeout = (timeoutType, tokens) => {
  console.log('Activity timeout:', timeoutType);
  // Handle timeout (e.g., show warning or logout user)
};
