import {StorageKeys} from '../kindeUtils';
import {store} from './store';
import {
  createTabSync,
  tokensFromRefreshResult,
  type TabSync,
  type TabSyncOptions,
  type TabSyncTokens
} from './tabSync';

const SAMPLE_TOKENS: TabSyncTokens = {
  accessToken: 'access-jwt',
  idToken: 'id-jwt',
  refreshToken: 'refresh-value'
};

const makeStorageMock = () => {
  const data: Record<string, string> = {};
  return {
    getItem: (key: string) => data[key] ?? null,
    setItem: (key: string, value: string) => {
      data[key] = value;
    },
    removeItem: (key: string) => {
      delete data[key];
    },
    clear: () => {
      Object.keys(data).forEach((key) => delete data[key]);
    }
  };
};

describe('tabSync', () => {
  const disposers: Array<() => void> = [];

  const createTrackedTabSync = (options: TabSyncOptions): TabSync => {
    const tabSync = createTabSync(options);
    disposers.push(() => tabSync.dispose());
    return tabSync;
  };

  beforeEach(() => {
    store.reset();

    Object.defineProperty(global, 'BroadcastChannel', {
      value: undefined,
      writable: true,
      configurable: true
    });

    const local = makeStorageMock();
    const session = makeStorageMock();

    Object.defineProperty(global, 'localStorage', {
      value: local,
      writable: true,
      configurable: true
    });
    Object.defineProperty(global, 'sessionStorage', {
      value: session,
      writable: true,
      configurable: true
    });
    Object.defineProperty(global, 'window', {
      value: {
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
        setTimeout: (...args: Parameters<typeof setTimeout>) =>
          setTimeout(...args),
        clearTimeout: (...args: Parameters<typeof clearTimeout>) =>
          clearTimeout(...args)
      },
      writable: true,
      configurable: true
    });
    Object.defineProperty(global, 'document', {
      value: {
        visibilityState: 'visible',
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn()
      },
      writable: true,
      configurable: true
    });
    Object.defineProperty(global, 'navigator', {
      value: {
        locks: undefined
      },
      writable: true,
      configurable: true
    });
  });

  afterEach(() => {
    disposers.forEach((dispose) => dispose());
    disposers.length = 0;
  });

  test('tabId is generated when sessionStorage throws', () => {
    const session = sessionStorage as ReturnType<typeof makeStorageMock>;
    session.getItem = () => {
      throw new Error('sessionStorage disabled');
    };
    session.setItem = () => {
      throw new Error('sessionStorage disabled');
    };

    const tabSync = createTrackedTabSync({store});

    expect(tabSync.tabId).toBeTruthy();
    expect(tabSync.tabId).not.toBe('server');
  });

  test('applyTokens writes access, id, and refresh to the store', async () => {
    const tabSync = createTrackedTabSync({store});

    await tabSync.applyTokens(SAMPLE_TOKENS);

    expect(store.getSessionItem(StorageKeys.accessToken)).toBe('access-jwt');
    expect(store.getSessionItem(StorageKeys.idToken)).toBe('id-jwt');
    expect(store.getSessionItem(StorageKeys.refreshToken)).toBe(
      'refresh-value'
    );
  });

  test('tokensFromRefreshResult maps a successful js-utils result', () => {
    const tokens = tokensFromRefreshResult({
      success: true,
      [StorageKeys.accessToken]: 'at',
      [StorageKeys.idToken]: 'it',
      [StorageKeys.refreshToken]: 'rt'
    });

    expect(tokens).toEqual({
      accessToken: 'at',
      idToken: 'it',
      refreshToken: 'rt'
    });
  });

  test('applyTokensFromResult stores access token when idToken is missing', async () => {
    const tabSync = createTrackedTabSync({store});
    store.setSessionItem(StorageKeys.idToken, 'existing-id');
    const result = {
      success: true as const,
      [StorageKeys.accessToken]: 'at-only'
    };

    expect(tokensFromRefreshResult(result)).toEqual({
      accessToken: 'at-only'
    });

    await tabSync.applyTokensFromResult(result);

    expect(store.getSessionItem(StorageKeys.accessToken)).toBe('at-only');
    expect(store.getSessionItem(StorageKeys.idToken)).toBe('existing-id');
  });

  test('tryWithRefreshLock runs the callback when the lock is available', async () => {
    const tabSync = createTrackedTabSync({store});
    const fn = jest.fn().mockResolvedValue('ok');

    const result = await tabSync.tryWithRefreshLock(fn);

    expect(result).toEqual({
      ran: true,
      value: 'ok',
      usedAmbiguousFallback: true
    });
    expect(fn).toHaveBeenCalledTimes(1);
  });

  test('tryWithRefreshLock uses Web Locks without ambiguous fallback when available', async () => {
    const originalLocks = navigator.locks;
    const request = jest.fn(
      async (
        _name: string,
        _options: {ifAvailable: boolean},
        callback: (lock: object) => Promise<void>
      ) => {
        await callback({});
      }
    );
    Object.defineProperty(navigator, 'locks', {
      value: {request},
      configurable: true
    });

    try {
      const tabSync = createTrackedTabSync({store});
      const fn = jest.fn().mockResolvedValue('ok');
      const result = await tabSync.tryWithRefreshLock(fn);

      expect(result).toEqual({
        ran: true,
        value: 'ok',
        usedAmbiguousFallback: false
      });
      expect(request).toHaveBeenCalled();
    } finally {
      Object.defineProperty(navigator, 'locks', {
        value: originalLocks,
        configurable: true
      });
    }
  });

  test('tryWithRefreshLock skips when a localStorage lock is held by another tab', async () => {
    const originalLocks = navigator.locks;
    Object.defineProperty(navigator, 'locks', {
      value: undefined,
      configurable: true
    });

    try {
      const tabSync = createTrackedTabSync({store});
      localStorage.setItem(
        'kinde_refresh_lock',
        JSON.stringify({
          tabId: 'other-tab',
          until: Date.now() + 60_000
        })
      );

      const fn = jest.fn().mockResolvedValue('ok');
      const result = await tabSync.tryWithRefreshLock(fn);

      expect(result).toEqual({ran: false});
      expect(fn).not.toHaveBeenCalled();
    } finally {
      Object.defineProperty(navigator, 'locks', {
        value: originalLocks,
        configurable: true
      });
    }
  });

  test('tryWithRefreshLock skips when localStorage lock is lost after write', async () => {
    const originalLocks = navigator.locks;
    Object.defineProperty(navigator, 'locks', {
      value: undefined,
      configurable: true
    });

    const local = localStorage as ReturnType<typeof makeStorageMock>;
    const originalSetItem = local.setItem.bind(local);
    local.setItem = (key: string, value: string) => {
      originalSetItem(key, value);
      if (key === 'kinde_refresh_lock') {
        originalSetItem(
          key,
          JSON.stringify({
            tabId: 'other-tab',
            until: Date.now() + 60_000
          })
        );
      }
    };

    try {
      const tabSync = createTrackedTabSync({store});
      const fn = jest.fn().mockResolvedValue('ok');
      const result = await tabSync.tryWithRefreshLock(fn);

      expect(result).toEqual({ran: false});
      expect(fn).not.toHaveBeenCalled();
    } finally {
      Object.defineProperty(navigator, 'locks', {
        value: originalLocks,
        configurable: true
      });
    }
  });

  test('setupListeners applies tokens via localStorage storage event fallback', async () => {
    const tabSync = createTrackedTabSync({store});
    const onTokensUpdated = jest.fn();

    tabSync.setupListeners({onTokensUpdated});

    const message = {
      type: 'tokens_updated' as const,
      tabId: 'other-tab-id',
      tokens: SAMPLE_TOKENS
    };
    localStorage.setItem('kinde_token_sync', JSON.stringify(message));

    const storageHandler = (
      window.addEventListener as jest.Mock
    ).mock.calls.find(([event]) => event === 'storage')?.[1] as
      | ((event: StorageEvent) => void)
      | undefined;

    storageHandler?.({
      key: 'kinde_token_sync',
      newValue: JSON.stringify(message)
    } as StorageEvent);

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(store.getSessionItem(StorageKeys.accessToken)).toBe('access-jwt');
    expect(onTokensUpdated).toHaveBeenCalledWith(SAMPLE_TOKENS);
  });

  test('setupListeners applies access-only tokens_updated messages', async () => {
    const tabSync = createTrackedTabSync({store});
    const onTokensUpdated = jest.fn();
    tabSync.setupListeners({onTokensUpdated});

    const storageHandler = (
      window.addEventListener as jest.Mock
    ).mock.calls.find(([event]) => event === 'storage')?.[1] as
      | ((event: StorageEvent) => void)
      | undefined;

    storageHandler?.({
      key: 'kinde_token_sync',
      newValue: JSON.stringify({
        type: 'tokens_updated',
        tabId: 'other-tab',
        tokens: {accessToken: 'fresh-access'}
      })
    } as StorageEvent);

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(store.getSessionItem(StorageKeys.accessToken)).toBe('fresh-access');
    expect(onTokensUpdated).toHaveBeenCalledWith({
      accessToken: 'fresh-access'
    });
  });

  test('setupListeners clears the store on session_cleared via storage event', async () => {
    store.setSessionItem(StorageKeys.accessToken, 'existing');
    const tabSync = createTrackedTabSync({store});
    const onSessionCleared = jest.fn();

    tabSync.setupListeners({onSessionCleared});

    const message = {
      type: 'session_cleared' as const,
      tabId: 'other-tab-id'
    };

    const storageHandler = (
      window.addEventListener as jest.Mock
    ).mock.calls.find(([event]) => event === 'storage')?.[1] as
      | ((event: StorageEvent) => void)
      | undefined;

    storageHandler?.({
      key: 'kinde_token_sync',
      newValue: JSON.stringify(message)
    } as StorageEvent);

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(store.getSessionItem(StorageKeys.accessToken)).toBeNull();
    expect(onSessionCleared).toHaveBeenCalled();
  });

  test('setupListeners clears mirrored refresh token on session_cleared when insecure storage is configured', async () => {
    const removeSessionItem = jest.fn();
    const tabSync = createTrackedTabSync({
      store,
      insecureStorage: {setSessionItem: jest.fn(), removeSessionItem},
      useInsecureForRefreshToken: true
    });

    tabSync.setupListeners({});

    const message = {
      type: 'session_cleared' as const,
      tabId: 'other-tab-id'
    };

    const storageHandler = (
      window.addEventListener as jest.Mock
    ).mock.calls.find(([event]) => event === 'storage')?.[1] as
      | ((event: StorageEvent) => void)
      | undefined;

    storageHandler?.({
      key: 'kinde_token_sync',
      newValue: JSON.stringify(message)
    } as StorageEvent);

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(removeSessionItem).toHaveBeenCalledWith(StorageKeys.refreshToken);
  });

  test('setupVisibilitySync invokes callback when the document becomes visible', async () => {
    const tabSync = createTrackedTabSync({store});
    const onVisible = jest.fn();

    tabSync.setupVisibilitySync(onVisible);

    const visibilityHandler = (
      document.addEventListener as jest.Mock
    ).mock.calls.find(([event]) => event === 'visibilitychange')?.[1] as
      | (() => void)
      | undefined;

    visibilityHandler?.();

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(onVisible).toHaveBeenCalledTimes(1);
  });

  test('setupVisibilitySync deduplicates visibilitychange and focus in the same tick', async () => {
    const tabSync = createTrackedTabSync({store});
    const onVisible = jest.fn();

    tabSync.setupVisibilitySync(onVisible);

    const visibilityHandler = (
      document.addEventListener as jest.Mock
    ).mock.calls.find(([event]) => event === 'visibilitychange')?.[1] as
      | (() => void)
      | undefined;
    const focusHandler = (window.addEventListener as jest.Mock).mock.calls.find(
      ([event]) => event === 'focus'
    )?.[1] as (() => void) | undefined;

    visibilityHandler?.();
    focusHandler?.();

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(onVisible).toHaveBeenCalledTimes(1);
  });

  test('waitForTokenBroadcast resolves when applyTokens fails on tokens_updated', async () => {
    const consoleError = jest
      .spyOn(console, 'error')
      .mockImplementation(jest.fn());
    const failingStore = {
      ...store,
      setItems: jest.fn().mockRejectedValue(new Error('storage full'))
    };
    const tabSync = createTrackedTabSync({store: failingStore});
    const onTokensUpdated = jest.fn();

    tabSync.setupListeners({onTokensUpdated});

    const waitPromise = tabSync.waitForTokenBroadcast(5000);

    const message = {
      type: 'tokens_updated' as const,
      tabId: 'other-tab-id',
      tokens: SAMPLE_TOKENS
    };

    const storageHandler = (
      window.addEventListener as jest.Mock
    ).mock.calls.find(([event]) => event === 'storage')?.[1] as
      | ((event: StorageEvent) => void)
      | undefined;

    storageHandler?.({
      key: 'kinde_token_sync',
      newValue: JSON.stringify(message)
    } as StorageEvent);

    try {
      await expect(waitPromise).resolves.toEqual(SAMPLE_TOKENS);
      expect(onTokensUpdated).not.toHaveBeenCalled();
      expect(consoleError).toHaveBeenCalledWith(
        'Failed to apply synced tokens:',
        expect.any(Error)
      );
    } finally {
      consoleError.mockRestore();
    }
  });

  test('waitForTokenBroadcast resolves when a storage event delivers tokens', async () => {
    const tabSync = createTrackedTabSync({store});
    tabSync.setupListeners({});

    const waitPromise = tabSync.waitForTokenBroadcast(5000);

    const message = {
      type: 'tokens_updated' as const,
      tabId: 'other-tab-id',
      tokens: SAMPLE_TOKENS
    };

    const storageHandler = (
      window.addEventListener as jest.Mock
    ).mock.calls.find(([event]) => event === 'storage')?.[1] as
      | ((event: StorageEvent) => void)
      | undefined;

    storageHandler?.({
      key: 'kinde_token_sync',
      newValue: JSON.stringify(message)
    } as StorageEvent);

    await expect(waitPromise).resolves.toEqual(SAMPLE_TOKENS);
  });
});
