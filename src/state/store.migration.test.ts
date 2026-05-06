import {StorageKeys} from '@kinde/js-utils';
import {store} from './store';
import {storageMap} from '../constants';

const MAPPED_STORAGE_KEYS: Array<{
  storageMapKey: string;
  storageKey: string;
}> = [
  {storageMapKey: storageMap.access_token, storageKey: StorageKeys.accessToken},
  {storageMapKey: storageMap.id_token, storageKey: StorageKeys.idToken},
  {
    storageMapKey: storageMap.refresh_token,
    storageKey: StorageKeys.refreshToken
  }
];

const makeDecodedJwt = () => ({
  sub: 'kp:user123',
  exp: Math.floor(Date.now() / 1000) + 3600,
  iss: 'https://app.kinde.com',
  org_code: 'org_abc',
  permissions: ['read:data', 'write:data'],
  feature_flags: {theme: {t: 's', v: 'pink'}}
});

const RAW_JWT =
  'eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJrcDp1c2VyMTIzIn0.mock-signature';

describe('Store migration gaps', () => {
  beforeEach(() => {
    store.reset();
  });

  describe('removeItems does not translate storageMap keys', () => {
    test.each(MAPPED_STORAGE_KEYS)(
      'removeItems with old storageMap key does not clear the StorageKeys key ($storageMapKey)',
      async ({storageMapKey, storageKey}) => {
        store.setSessionItem(storageKey as StorageKeys, 'value-under-new-key');

        await store.removeItems(storageMapKey);

        expect(store.getSessionItem(storageKey)).toBe('value-under-new-key');
        expect(store.getSessionItem(storageMapKey)).toBeNull();
      }
    );

    test.each(MAPPED_STORAGE_KEYS)(
      'removeItems with old storageMap key removes only that literal key ($storageMapKey)',
      async ({storageMapKey}) => {
        store.setSessionItem(storageMapKey, 'value-under-old-key');

        await store.removeItems(storageMapKey);

        expect(store.getSessionItem(storageMapKey)).toBeNull();
      }
    );

    test.each(MAPPED_STORAGE_KEYS)(
      'removeItems with StorageKeys key clears the new key directly ($storageKey)',
      async ({storageKey}) => {
        store.setSessionItem(storageKey as StorageKeys, 'value');

        await store.removeItems(storageKey);

        expect(store.getSessionItem(storageKey)).toBeNull();
      }
    );

    test.each(MAPPED_STORAGE_KEYS)(
      'logout pattern clears both key styles ($storageMapKey)',
      async ({storageMapKey, storageKey}) => {
        store.setSessionItem(storageKey as StorageKeys, 'new-key-token');
        store.setSessionItem(storageMapKey, 'old-key-token');

        store.removeSessionItem(storageKey as StorageKeys);
        await store.removeItems(storageMapKey);

        expect(store.getSessionItem(storageKey)).toBeNull();
        expect(store.getSessionItem(storageMapKey)).toBeNull();
      }
    );

    test.each(MAPPED_STORAGE_KEYS)(
      'removeItem (singular) clears both keys ($storageMapKey)',
      ({storageMapKey, storageKey}) => {
        store.setSessionItem(storageKey as StorageKeys, 'new-key-value');
        store.setSessionItem(storageMapKey, 'old-key-value');

        store.removeItem(storageMapKey);

        expect(store.getSessionItem(storageKey)).toBeNull();
        expect(store.getSessionItem(storageMapKey)).toBeNull();
      }
    );
  });

  describe('object round-trip via legacy setItem/getItem', () => {
    test.each(MAPPED_STORAGE_KEYS)(
      'decoded JWT object written via setItem is returned via getItem ($storageMapKey)',
      ({storageMapKey}) => {
        const decodedJwt = makeDecodedJwt();

        store.setItem(storageMapKey, decodedJwt);
        const result = store.getItem(storageMapKey);

        expect(result).toEqual(decodedJwt);
      }
    );

    test.each(MAPPED_STORAGE_KEYS)(
      'object written via setItem is readable via getSessionItem with new key ($storageMapKey)',
      ({storageMapKey, storageKey}) => {
        const decodedJwt = makeDecodedJwt();

        store.setItem(storageMapKey, decodedJwt);

        expect(store.getSessionItem(storageKey)).toEqual(decodedJwt);
      }
    );

    test('token_bundle object round-trip via setItem/getItem', () => {
      const bundle = {
        access_token: RAW_JWT,
        id_token: RAW_JWT,
        refresh_token: 'refresh-abc',
        expires_in: 3600,
        scope: 'openid profile email',
        token_type: 'Bearer'
      };

      store.setItem(storageMap.token_bundle, bundle);
      const result = store.getItem(storageMap.token_bundle);

      expect(result).toEqual(bundle);
    });
  });

  describe('cross-path compatibility', () => {
    test.each(MAPPED_STORAGE_KEYS)(
      'legacy write to setItem is readable via getSessionItem ($storageMapKey)',
      ({storageMapKey, storageKey}) => {
        store.setItem(storageMapKey, 'token-value');

        const result = store.getSessionItem(storageKey as StorageKeys);

        expect(result).toBe('token-value');
      }
    );

    test.each(MAPPED_STORAGE_KEYS)(
      'new write to setSessionItem is readable via getItem ($storageMapKey)',
      ({storageMapKey, storageKey}) => {
        store.setSessionItem(storageKey as StorageKeys, RAW_JWT);

        const result = store.getItem(storageMapKey);

        expect(result).toBe(RAW_JWT);
      }
    );

    test.each(MAPPED_STORAGE_KEYS)(
      'setSessionItem overwrites value written by setItem ($storageMapKey)',
      ({storageMapKey, storageKey}) => {
        store.setItem(storageMapKey, 'legacy-value');
        store.setSessionItem(storageKey as StorageKeys, 'jsutils-value');

        expect(store.getItem(storageMapKey)).toBe('jsutils-value');
        expect(store.getSessionItem(storageKey)).toBe('jsutils-value');
      }
    );

    test.each(MAPPED_STORAGE_KEYS)(
      'setItem overwrites value written by setSessionItem ($storageMapKey)',
      ({storageMapKey, storageKey}) => {
        store.setSessionItem(storageKey as StorageKeys, 'jsutils-value');
        store.setItem(storageMapKey, 'legacy-value');

        expect(store.getItem(storageMapKey)).toBe('legacy-value');
        expect(store.getSessionItem(storageKey)).toBe('legacy-value');
      }
    );
  });

  describe('migration idempotency', () => {
    test.each(MAPPED_STORAGE_KEYS)(
      'second getItem call after migration returns same value ($storageMapKey)',
      ({storageMapKey}) => {
        store.setSessionItem(storageMapKey, 'original-value');

        const first = store.getItem(storageMapKey);
        const second = store.getItem(storageMapKey);

        expect(first).toBe('original-value');
        expect(second).toBe('original-value');
      }
    );

    test.each(MAPPED_STORAGE_KEYS)(
      'after migration old key is removed and new key holds value ($storageMapKey)',
      ({storageMapKey, storageKey}) => {
        store.setSessionItem(storageMapKey, 'original-value');

        store.getItem(storageMapKey);

        expect(store.getSessionItem(storageMapKey)).toBeNull();
        expect(store.getSessionItem(storageKey)).toBe('original-value');
      }
    );

    test.each(MAPPED_STORAGE_KEYS)(
      'migrating one key does not affect others ($storageMapKey)',
      ({storageMapKey, storageKey}) => {
        store.setSessionItem(storageMapKey, 'migrating-value');
        const otherKey =
          storageMapKey === storageMap.access_token
            ? storageMap.id_token
            : storageMap.access_token;
        store.setSessionItem(otherKey, 'other-value');

        store.getItem(storageMapKey);

        expect(store.getSessionItem(storageKey)).toBe('migrating-value');
        expect(store.getSessionItem(otherKey)).toBe('other-value');
      }
    );
  });
});
