import {StorageKeys} from '@kinde/js-utils';
import {store} from './store';
import {storageMap} from '../constants';

/**
 * Keys that have storageMap -> StorageKeys mapping and are tested here.
 * storageMap.user and storageMap.token_bundle are excluded (mappings TBD).
 */
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

describe('Store storageMap key handling', () => {
  beforeEach(() => {
    store.reset();
  });

  describe('getItem', () => {
    test.each(MAPPED_STORAGE_KEYS)(
      'migrates value from storageMap key to StorageKeys key, removes old key, and returns value when getting with old key ($storageMapKey)',
      ({storageMapKey, storageKey}) => {
        const value = `value-for-${storageMapKey}`;
        store.setSessionItem(storageMapKey, value);

        const result = store.getItem(storageMapKey);

        expect(result).toBe(value);
        expect(store.getSessionItem(storageKey)).toBe(value);
        expect(store.getSessionItem(storageMapKey)).toBeNull();
      }
    );

    test.each(MAPPED_STORAGE_KEYS)(
      'returns value when stored only under StorageKeys key and getting with old key ($storageMapKey)',
      ({storageMapKey, storageKey}) => {
        const value = `migrated-${storageKey}`;
        store.setSessionItem(storageKey, value);

        const result = store.getItem(storageMapKey);

        expect(result).toBe(value);
        expect(store.getSessionItem(storageKey)).toBe(value);
      }
    );

    test.each(MAPPED_STORAGE_KEYS)(
      'returns value when getting with StorageKey and value is under that key ($storageKey)',
      ({storageKey}) => {
        const value = `direct-${storageKey}`;
        store.setSessionItem(storageKey, value);

        const result = store.getItem(storageKey);

        expect(result).toBe(value);
      }
    );

    test.each(MAPPED_STORAGE_KEYS)(
      'returns null when neither storageMap nor StorageKeys key has value ($storageMapKey)',
      ({storageMapKey}) => {
        const result = store.getItem(storageMapKey);

        expect(result).toBeNull();
      }
    );
  });

  describe('setItem', () => {
    test.each(MAPPED_STORAGE_KEYS)(
      'stores value under StorageKeys key not storageMap key ($storageMapKey)',
      ({storageMapKey, storageKey}) => {
        const value = `set-item-${storageMapKey}`;

        store.setItem(storageMapKey, value);

        expect(store.getSessionItem(storageKey)).toBe(value);
        expect(store.getSessionItem(storageMapKey)).toBeNull();
      }
    );
  });

  describe('removeItem', () => {
    test.each(MAPPED_STORAGE_KEYS)(
      'removes both StorageKeys key and storageMap key ($storageMapKey)',
      ({storageMapKey, storageKey}) => {
        store.setSessionItem(storageKey, 'under-storage-key');
        store.setSessionItem(storageMapKey, 'under-storage-map-key');

        store.removeItem(storageMapKey);

        expect(store.getSessionItem(storageKey)).toBeNull();
        expect(store.getSessionItem(storageMapKey)).toBeNull();
      }
    );

    test.each(MAPPED_STORAGE_KEYS)(
      'removes storageMap key when only that key was set ($storageMapKey)',
      ({storageMapKey, storageKey}) => {
        store.setSessionItem(storageMapKey, 'only-old-key');

        store.removeItem(storageMapKey);

        expect(store.getSessionItem(storageMapKey)).toBeNull();
        expect(store.getSessionItem(storageKey)).toBeNull();
      }
    );

    test.each(MAPPED_STORAGE_KEYS)(
      'removes StorageKeys key when only that key was set ($storageMapKey)',
      ({storageMapKey, storageKey}) => {
        store.setSessionItem(storageKey, 'only-new-key');

        store.removeItem(storageMapKey);

        expect(store.getSessionItem(storageKey)).toBeNull();
        expect(store.getSessionItem(storageMapKey)).toBeNull();
      }
    );
  });

  describe('token_bundle key (no StorageKeys mapping)', () => {
    test('getItem returns value when stored under token_bundle key', () => {
      const value = {access_token: 'at', id_token: 'it'};
      store.setSessionItem(storageMap.token_bundle, value);

      const result = store.getItem(storageMap.token_bundle);

      expect(result).toEqual(value);
    });

    test('getItem does not convert token_bundle to a different key (same key used)', () => {
      const value = {access_token: 'at'};
      store.setSessionItem(storageMap.token_bundle, value);

      store.getItem(storageMap.token_bundle);

      expect(store.getSessionItem(storageMap.token_bundle)).toEqual(value);
    });

    test('setItem stores under token_bundle key (no conversion)', () => {
      const value = {access_token: 'at', id_token: 'it'};
      store.setItem(storageMap.token_bundle, value);

      expect(store.getSessionItem(storageMap.token_bundle)).toEqual(value);
    });

    test('removeItem removes token_bundle key', () => {
      store.setSessionItem(storageMap.token_bundle, {access_token: 'at'});

      store.removeItem(storageMap.token_bundle);

      expect(store.getSessionItem(storageMap.token_bundle)).toBeNull();
    });
  });

  describe('user key (no StorageKeys mapping)', () => {
    test('getItem returns value when stored under user key', () => {
      const value = {id: 'id-1', email: 'u@example.com'};
      store.setSessionItem(storageMap.user, value);

      const result = store.getItem(storageMap.user);

      expect(result).toEqual(value);
    });

    test('getItem does not convert user to a different key (same key used)', () => {
      const value = {id: 'id-1'};
      store.setSessionItem(storageMap.user, value);

      store.getItem(storageMap.user);

      expect(store.getSessionItem(storageMap.user)).toEqual(value);
    });

    test('setItem stores under user key (no conversion)', () => {
      const value = {id: 'id-1', email: 'u@example.com'};
      store.setItem(storageMap.user, value);

      expect(store.getSessionItem(storageMap.user)).toEqual(value);
    });

    test('removeItem removes user key', () => {
      store.setSessionItem(storageMap.user, {id: 'id-1'});

      store.removeItem(storageMap.user);

      expect(store.getSessionItem(storageMap.user)).toBeNull();
    });
  });
});
