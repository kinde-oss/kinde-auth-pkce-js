# Storage Key Prefix Configuration

## Overview

The Kinde Auth PKCE JS SDK uses `@kinde/js-utils` for storage management, which supports configurable key prefixes. This allows you to namespace your storage keys to avoid conflicts with other applications or manage multi-tenant scenarios.

## Default Behavior

**Default Prefix:** `kinde_` (underscore)

By default, all storage keys are prefixed with `kinde_`. This ensures backward compatibility with previous versions of the SDK.

### Default Storage Keys

When using the default prefix, your storage will contain keys like:

- `kinde_access_token` - Decoded access token object
- `kinde_id_token` - Decoded ID token object
- `kinde_refresh_token` - Refresh token
- `kinde_token` - Token bundle
- `kinde_user` - User information

Additionally, for `@kinde/js-utils` compatibility:

- `kinde_accessToken` - Raw JWT access token string
- `kinde_idToken` - Raw JWT ID token string

## Customizing the Prefix

You can customize the storage prefix by modifying `storageSettings.keyPrefix` **before** initializing the Kinde client.

### Basic Usage

```typescript
import {storageSettings} from '@kinde-oss/kinde-auth-pkce-js';
import createKindeClient from '@kinde-oss/kinde-auth-pkce-js';

// Set custom prefix BEFORE creating the client
storageSettings.keyPrefix = 'MyApp_';

const client = await createKindeClient({
  client_id: 'your-client-id',
  domain: 'https://your-domain.kinde.com',
  redirect_uri: window.location.origin
});

// Now all keys will use "MyApp_" prefix:
// - MyApp_kinde_access_token
// - MyApp_kinde_id_token
// - etc.
```

## Use Cases

### 1. Multi-Tenant Applications

Different tenants can use isolated storage:

```typescript
import {storageSettings} from '@kinde-oss/kinde-auth-pkce-js';

const tenantId = getCurrentTenantId(); // e.g., 'tenant_123'
storageSettings.keyPrefix = `${tenantId}_`;

// Each tenant's data is isolated:
// - tenant_123_kinde_access_token
// - tenant_456_kinde_access_token
```

### 2. Environment-Based Prefixes

Separate development, staging, and production data:

```typescript
if (process.env.NODE_ENV === 'development') {
  storageSettings.keyPrefix = 'dev_';
} else if (process.env.NODE_ENV === 'staging') {
  storageSettings.keyPrefix = 'staging_';
} else {
  storageSettings.keyPrefix = 'prod_';
}
```

### 3. Multiple Kinde Instances

Run multiple Kinde configurations in the same app:

```typescript
// App 1 - Primary auth
storageSettings.keyPrefix = 'app1_';
const client1 = await createKindeClient({...});

// App 2 - Secondary auth
storageSettings.keyPrefix = 'app2_';
const client2 = await createKindeClient({...});
```

### 4. No Prefix

If you want to manage key naming yourself:

```typescript
storageSettings.keyPrefix = '';

// Keys will be stored without any prefix:
// - kinde_access_token (no prefix applied)
// - kinde_id_token (no prefix applied)
```

## Important Notes

### Upgrade Compatibility

**Existing users upgrading from previous versions:**

- ✅ No action needed!
- The default `kinde_` prefix maintains backward compatibility
- Your existing stored tokens will continue to work

### When to Set the Prefix

⚠️ **IMPORTANT:** Always set `storageSettings.keyPrefix` **BEFORE** calling `createKindeClient()`.

```typescript
// ✅ CORRECT
storageSettings.keyPrefix = 'MyApp_';
const client = await createKindeClient({...});

// ❌ WRONG - prefix set too late
const client = await createKindeClient({...});
storageSettings.keyPrefix = 'MyApp_'; // Won't affect already-initialized client
```

### Storage Isolation

Different prefixes create completely isolated storage spaces:

```typescript
// Store with prefix "app1_"
storageSettings.keyPrefix = 'app1_';
store.setItem('key', 'value1');

// Store with prefix "app2_"
storageSettings.keyPrefix = 'app2_';
store.setItem('key', 'value2');

// These are stored separately:
// - app1_key = 'value1'
// - app2_key = 'value2'
```

### Prefix Format

The prefix can be any string:

- ✅ `'MyApp_'` (underscore)
- ✅ `'MyApp-'` (hyphen)
- ✅ `'MyApp.'` (dot)
- ✅ `'my-app:tenant-123:'` (complex)
- ✅ `''` (empty, no prefix)

**Recommendation:** Use a consistent format (e.g., always ending with `_` or `-`) for readability.

## Other Storage Settings

`storageSettings` provides additional configuration options:

### Maximum Length

Limit the size of stored values:

```typescript
storageSettings.maxLength = 5000; // Default: 2000
```

### Refresh Token Security

Control refresh token storage security:

```typescript
storageSettings.useInsecureForRefreshToken = false; // Default: false
```

### Activity Timeout

Configure automatic logout after inactivity:

```typescript
storageSettings.activityTimeoutMinutes = 30;
storageSettings.activityTimeoutPreWarningMinutes = 5;
storageSettings.onActivityTimeout = (timeoutType, tokens) => {
  console.log('User inactive, logging out...');
  // Handle timeout
};
```

## Examples

See `examples/storage-prefix-example.ts` for complete working examples.

## API Reference

### `storageSettings` Object

```typescript
import {storageSettings} from '@kinde-oss/kinde-auth-pkce-js';

interface StorageSettings {
  keyPrefix: string; // Storage key prefix (default: 'kinde_')
  maxLength: number; // Max value length (default: 2000)
  useInsecureForRefreshToken: boolean; // Security setting (default: false)
  activityTimeoutMinutes?: number; // Inactivity timeout
  activityTimeoutPreWarningMinutes?: number; // Warning before timeout
  onActivityTimeout?: (type, tokens) => void; // Timeout callback
}
```

## Troubleshooting

### Can't read stored data after upgrade

If you can't access previously stored tokens:

1. Check if you've changed `storageSettings.keyPrefix`
2. The default is `kinde_` - if you set a different prefix, old data won't be accessible
3. To migrate, either:
   - Keep the default `kinde_` prefix
   - Manually migrate data to the new prefix

### Data not isolated between tenants

Make sure you set the prefix **before** creating the client for each tenant:

```typescript
// ✅ CORRECT
function createTenantClient(tenantId) {
  storageSettings.keyPrefix = `${tenantId}_`;
  return createKindeClient({...});
}

// ❌ WRONG
async function createTenantClient(tenantId) {
  const client = await createKindeClient({...});
  storageSettings.keyPrefix = `${tenantId}_`; // Too late!
  return client;
}
```

### Prefix not being applied

The prefix is managed by `@kinde/js-utils` MemoryStorage. It's applied automatically when using `SessionManager` methods (`setSessionItem`, `getSessionItem`). Legacy methods (`setItem`, `getItem`) also respect the prefix.

## More Information

- See `examples/storage-prefix-example.ts` for code examples
- See `examples/MIGRATION_TO_JSUTILS.md` for migration details
- Visit [Kinde Documentation](https://kinde.com/docs) for more guides
