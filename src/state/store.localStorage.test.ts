import {LocalStorage, StorageKeys, storageSettings} from '../kindeUtils';
import {storageMap} from '../constants';

storageSettings.keyPrefix = 'kinde_';

const NEW_KEY = 'kinde_refreshToken0';
const OLD_KEY = storageMap.refresh_token;
const SAMPLE_TOKEN = 'rt_sample_abc123def456';

const makeLocalStorageMock = () => {
  const store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      Object.keys(store).forEach((k) => delete store[k]);
    },
    get length() {
      return Object.keys(store).length;
    },
    key: (index: number) => Object.keys(store)[index] ?? null
  };
};

describe('localStorage refresh token key mismatch', () => {
  let adapter: InstanceType<typeof LocalStorage>;
  let mockStorage: ReturnType<typeof makeLocalStorageMock>;

  beforeEach(() => {
    mockStorage = makeLocalStorageMock();
    Object.defineProperty(global, 'localStorage', {
      value: mockStorage,
      writable: true,
      configurable: true
    });
    adapter = new LocalStorage();
  });

  afterEach(() => {
    mockStorage.clear();
  });

  test('old key is not readable by LocalStorage adapter', () => {
    localStorage.setItem(OLD_KEY, SAMPLE_TOKEN);

    const result = adapter.getSessionItem(StorageKeys.refreshToken);

    expect(result).toBeNull();
  });

  test('new key is readable by LocalStorage adapter', () => {
    localStorage.setItem(NEW_KEY, SAMPLE_TOKEN);

    expect(adapter.getSessionItem(StorageKeys.refreshToken)).toBe(SAMPLE_TOKEN);
  });

  test('adapter.setSessionItem writes to new key, not old key', () => {
    adapter.setSessionItem(StorageKeys.refreshToken, SAMPLE_TOKEN);

    expect(localStorage.getItem(NEW_KEY)).toBe(SAMPLE_TOKEN);
    expect(localStorage.getItem(OLD_KEY)).toBeNull();
  });

  test('adapter.removeSessionItem clears new key but leaves old key', () => {
    localStorage.setItem(NEW_KEY, SAMPLE_TOKEN);
    localStorage.setItem(OLD_KEY, SAMPLE_TOKEN);

    adapter.removeSessionItem(StorageKeys.refreshToken);

    expect(localStorage.getItem(NEW_KEY)).toBeNull();
    expect(localStorage.getItem(OLD_KEY)).toBe(SAMPLE_TOKEN);
  });

  test('manual migration old key -> new key makes value readable by adapter', () => {
    localStorage.setItem(OLD_KEY, SAMPLE_TOKEN);

    const oldToken = localStorage.getItem(OLD_KEY);
    if (oldToken && !localStorage.getItem(NEW_KEY)) {
      localStorage.setItem(NEW_KEY, oldToken);
      localStorage.removeItem(OLD_KEY);
    }

    expect(adapter.getSessionItem(StorageKeys.refreshToken)).toBe(SAMPLE_TOKEN);
    expect(localStorage.getItem(OLD_KEY)).toBeNull();
  });
});
