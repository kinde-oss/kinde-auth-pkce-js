/**
 * Example: Using storageSettings.keyPrefix
 *
 * The keyPrefix allows you to namespace your storage keys to avoid conflicts
 * when multiple applications or environments share the same storage mechanism.
 */

import {storageSettings} from '@kinde-oss/kinde-auth-pkce-js';
import createKindeClient from '@kinde-oss/kinde-auth-pkce-js';

// Example 1: Set prefix before initializing the client
// This is useful for multi-tenant applications
storageSettings.keyPrefix = 'MyApp-';

const client = await createKindeClient({
  client_id: 'your-client-id',
  domain: 'https://your-domain.kinde.com',
  redirect_uri: window.location.origin
});

// Now all storage keys will be prefixed with "MyApp-"
// For example: "MyApp-kinde_access_token", "MyApp-kinde_id_token", etc.

// Example 2: Use different prefixes for different environments
if (process.env.NODE_ENV === 'development') {
  storageSettings.keyPrefix = 'dev-';
} else if (process.env.NODE_ENV === 'staging') {
  storageSettings.keyPrefix = 'staging-';
} else {
  storageSettings.keyPrefix = 'prod-';
}

// Example 3: Multi-tenant application with tenant-specific prefixes
const tenantId = 'tenant123';
storageSettings.keyPrefix = `${tenantId}-`;

// Example 4: Other useful storageSettings options
storageSettings.maxLength = 5000; // Maximum length for stored values
storageSettings.useInsecureForRefreshToken = false; // Security setting for refresh tokens

// Example 5: Activity timeout configuration
storageSettings.activityTimeoutMinutes = 30; // Auto-logout after 30 minutes of inactivity
storageSettings.activityTimeoutPreWarningMinutes = 5; // Warning 5 minutes before timeout
storageSettings.onActivityTimeout = (timeoutType, tokens) => {
  console.log('Activity timeout:', timeoutType);
  // Handle timeout (e.g., show warning or logout user)
};
