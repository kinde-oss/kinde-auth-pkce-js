# Helper Functions and @kinde/js-utils Integration

## Overview

This package provides helper functions for working with Kinde authentication tokens and feature flags. While `@kinde/js-utils` is available via the `/utils` export, the built-in helpers are optimized for this SDK's storage format.

## Built-in Helper Functions (Recommended)

The following helper functions work seamlessly with the SDK's storage:

### Token Claims

```typescript
import createKindeClient from '@kinde-oss/kinde-auth-pkce-js';

const client = await createKindeClient({
  /* config */
});

// Get a specific claim
const claim = client.getClaim('email');
// Returns: { name: 'email', value: 'user@example.com' }

// Get just the claim value
const email = client.getClaimValue('email');
// Returns: 'user@example.com'
```

### Feature Flags

```typescript
// Get any flag type
const flag = client.getFlag('theme');
// Returns: { code: 'theme', type: 'string', value: 'dark', is_default: false }

// Type-specific helpers
const isDarkMode = client.getBooleanFlag('is_dark_mode', false);
const theme = client.getStringFlag('theme', 'light');
const maxItems = client.getIntegerFlag('max_items', 10);
```

### Organizations

```typescript
const orgs = client.getUserOrganizations();
// Returns: { orgCodes: ['org_123', 'org_456'] }
```

## Storage Format Difference

### This SDK's Approach

- Stores **decoded JWT objects** for immediate access
- No decoding overhead on each access
- Works with synchronous functions
- Optimized for browser SPAs

```typescript
// Stored format:
{
  kinde_access_token: {
    sub: 'user_123',
    email: 'user@example.com',
    exp: 1234567890,
    feature_flags: { /* ... */ }
  }
}
```

### @kinde/js-utils Approach

- Stores **raw JWT strings**
- Decodes on each access
- Async-first design
- Works across multiple platforms (Node, Browser, React Native)

```typescript
// Expected storage format:
{
  accessToken: 'eyJhbGciOiJSUzI1Ni...',  // Raw JWT string
  idToken: 'eyJhbGciOiJSUzI1Ni...'      // Raw JWT string
}
```

## Using @kinde/js-utils Functions Directly

If you need advanced features from `@kinde/js-utils` (like `forceApi` for real-time permission checks), you can access them via the `/utils` export. However, note that you'll need to configure storage appropriately:

```typescript
import {
  getClaim,
  getFlag,
  getUserOrganizations,
  setActiveStorage,
  MemoryStorage
} from '@kinde-oss/kinde-auth-pkce-js/utils';

// Set up storage that works with raw JWT strings
const storage = new MemoryStorage();
setActiveStorage(storage);

// Store raw JWT tokens
await storage.setSessionItem('accessToken', rawJWTString);
await storage.setSessionItem('idToken', rawIDTokenString);

// Now js-utils functions will work
const claim = await getClaim('email', 'accessToken');
const flag = await getFlag('theme');
const orgs = await getUserOrganizations();
```

## Recommendation

**Use the built-in SDK helpers** unless you specifically need js-utils features like:

- `forceApi` option (real-time API checks for permissions/flags)
- Cross-platform storage implementations (React Native, Chrome Extensions)
- Advanced token management features

The built-in helpers are:

- ✅ Faster (no JWT decoding overhead)
- ✅ Synchronous (simpler to use)
- ✅ Fully tested with this SDK
- ✅ Optimized for browser SPAs

## See Also

- [Utils Export Documentation](./UTILS_EXPORT.md)
- [Storage Settings](./storage-prefix-example.ts)
