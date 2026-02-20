import type {Store} from './store.types';
import {MemoryStorage, storageSettings, type StorageKeys} from '../kindeUtils';

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
    itemsToSet: Partial<Record<string, unknown>>
  ): Promise<void> => {
    const serializedItems: Partial<Record<string, unknown>> = {};
    Object.entries(itemsToSet).forEach(([key, value]) => {
      serializedItems[key] = serializeValue(value);
    });
    await memoryStorage.setItems(serializedItems);
    notifyListeners();
  };

  const getItems = (
    ...itemKeys: string[]
  ): Promise<Partial<Record<string, unknown>>> => {
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

  // Legacy methods for backward compatibility - these delegate to SessionManager methods
  const getItem = (key: string): unknown => {
    return getSessionItem(key);
  };

  const setItem = (key: string, value: unknown): void => {
    setSessionItem(key, value);
  };

  const removeItem = (key: string): void => {
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
