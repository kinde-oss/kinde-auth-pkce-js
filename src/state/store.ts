import type {Store} from './store.types';
import {MemoryStorage, storageSettings, StorageKeys} from '../kindeUtils';
import {storageMap} from '../constants';

storageSettings.keyPrefix = 'kinde_';
const memoryStorage = new MemoryStorage();

const createStore = (): Store => {
  const listeners: Array<() => void | Promise<void>> = [];
  let notificationScheduled = false;

  const notifyListeners = (): void => {
    if (notificationScheduled) return;

    notificationScheduled = true;
    queueMicrotask(() => {
      notificationScheduled = false;
      listeners.forEach(async (listener) => {
        try {
          await listener();
        } catch (e) {
          console.error('Store listener error:', e);
        }
      });
    });
  };

  const subscribe = (listener: () => void | Promise<void>) => {
    listeners.push(listener);
    return () => {
      const index = listeners.indexOf(listener);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    };
  };

  // Wrapper functions to handle JSON serialization/deserialization
  // MemoryStorage stores values as strings, so we need to serialize objects
  const serializeValue = (value: unknown): string => {
    if (value === null || value === undefined) {
      return JSON.stringify(value);
    }
    // For primitive types, just convert to string
    if (
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    ) {
      return JSON.stringify(value);
    }
    // For objects and arrays, use JSON
    return JSON.stringify(value);
  };

  const deserializeValue = <T = unknown>(value: unknown): T | null => {
    if (value === null || value === undefined) {
      return null;
    }
    // If it's already a string from MemoryStorage, parse it
    if (typeof value === 'string') {
      try {
        return JSON.parse(value) as T;
      } catch {
        // If parsing fails, return the string as-is
        return value as unknown as T;
      }
    }
    return value as T;
  };

  // SessionManager interface methods
  const getSessionItem = <T = unknown>(
    itemKey: string | StorageKeys
  ): T | unknown | null => {
    const value = memoryStorage.getSessionItem(itemKey as StorageKeys);
    return deserializeValue<T>(value);
  };

  const setSessionItem = <T = unknown>(
    itemKey: string | StorageKeys,
    itemValue: T
  ): void => {
    const serialized = serializeValue(itemValue);
    memoryStorage.setSessionItem(itemKey as StorageKeys, serialized);
    notifyListeners();
  };

  const removeSessionItem = (itemKey: string | StorageKeys): void => {
    memoryStorage.removeSessionItem(itemKey as StorageKeys);
    notifyListeners();
  };

  const destroySession = (): void => {
    memoryStorage.destroySession();
    notifyListeners();
  };

  const setItems = async (
    itemsToSet: Partial<Record<StorageKeys, unknown>>
  ): Promise<void> => {
    const serializedItems: Partial<Record<string, unknown>> = {};
    Object.entries(itemsToSet).forEach(([key, value]) => {
      serializedItems[key] = serializeValue(value);
    });
    await memoryStorage.setItems(serializedItems);
    notifyListeners();
  };

  const getItems = (
    ...itemKeys: StorageKeys[]
  ): Promise<Partial<Record<StorageKeys, unknown>>> => {
    const result: Partial<Record<string, unknown>> = {};
    itemKeys.forEach((key) => {
      const value = getSessionItem(key);
      if (value !== null) {
        result[key] = value;
      }
    });
    return Promise.resolve(result);
  };

  const removeItems = (...itemKeys: string[]): Promise<void> => {
    itemKeys.forEach((key) => {
      removeSessionItem(key);
    });
    notifyListeners();
    return Promise.resolve();
  };

  const convertStorageMapToSessionKeys = (key: string): StorageKeys => {
    switch (key) {
      case storageMap.access_token:
        return StorageKeys.accessToken;
      case storageMap.id_token:
        return StorageKeys.idToken;
      case storageMap.refresh_token:
        return StorageKeys.refreshToken;
      default:
        return key as StorageKeys;
    }
  };

  // Legacy methods for backward compatibility - these delegate to SessionManager methods
  const getItem = (key: string): unknown => {
    const sessionKey = convertStorageMapToSessionKeys(key);
    const isOldKey = key !== sessionKey;

    let value = getSessionItem(key);

    if (value && isOldKey) {
      // Data stored under old (storageMap) key → migrate to StorageKeys key and remove old key
      setSessionItem(sessionKey, value);
      removeSessionItem(key);
      return value;
    }

    if (!value) {
      value = getSessionItem(sessionKey);
      if (value) {
        setSessionItem(sessionKey, value);
      }
    }

    return value;
  };

  const setItem = (key: string, value: unknown): void => {
    const newKey = convertStorageMapToSessionKeys(key);
    setSessionItem(newKey, value);
  };

  const removeItem = (key: string): void => {
    const sessionKey = convertStorageMapToSessionKeys(key);
    removeSessionItem(sessionKey);
    removeSessionItem(key);
  };

  const reset = (): void => {
    destroySession();
  };

  const storeInstance: Store = {
    asyncStore: false,
    reset,
    getItem,
    removeItem,
    setItem,
    // SessionManager interface methods
    getSessionItem,
    setSessionItem,
    removeSessionItem,
    destroySession,
    setItems,
    getItems,
    removeItems,
    subscribe,
    notifyListeners
  };

  return storeInstance;
};

const store = createStore();
export {store, storageSettings};
