import type {StorageKeys} from '@kinde/js-utils';

type Awaitable<T> = T | Promise<T>;

export interface Store {
  asyncStore: boolean;
  reset: () => void;
  // Legacy method names for backward compatibility
  setItem: (key: string, value: unknown) => void;
  getItem: (key: string) => unknown;
  removeItem: (key: string) => void;
  // SessionManager interface methods
  getSessionItem: <T = unknown>(
    itemKey: string | StorageKeys
  ) => Awaitable<T | unknown | null>;
  setSessionItem: <T = unknown>(
    itemKey: string | StorageKeys,
    itemValue: T
  ) => Awaitable<void>;
  removeSessionItem: (itemKey: string | StorageKeys) => Awaitable<void>;
  destroySession: () => Awaitable<void>;
  setItems(items: Partial<Record<string, unknown>>): Awaitable<void>;
  removeItems(...items: string[]): Awaitable<void>;
  getItems(...items: string[]): Awaitable<Partial<Record<string, unknown>>>;
  subscribe(listener: () => void | Promise<void>): () => void;
  notifyListeners(): void;
}
