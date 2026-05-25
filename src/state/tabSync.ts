import {
  StorageKeys,
  type RefreshTokenResult,
  type RefreshTokenResultSuccess
} from '../kindeUtils';
import type {Store} from './store.types';

const CHANNEL_NAME = 'kinde-auth-pkce';
const LOCK_NAME = 'kinde-token-refresh';
const LS_LOCK_KEY = 'kinde_refresh_lock';
const LS_SYNC_KEY = 'kinde_token_sync';
const LOCK_TTL_MS = 30_000;
const BROADCAST_WAIT_MS = 10_000;

export type TabSyncTokens = {
  accessToken: string;
  idToken: string;
  refreshToken?: string;
};

type TabSyncMessage =
  | {type: 'tokens_updated'; tokens: TabSyncTokens; tabId: string}
  | {type: 'session_cleared'; tabId: string};

type SessionManagerLike = {
  setSessionItem<T>(key: StorageKeys, value: T): void;
  removeSessionItem?: (key: StorageKeys) => void;
};

export type TabSyncOptions = {
  store: Store;
  /** When set, refresh tokens are mirrored to insecure storage (localhost). */
  insecureStorage?: SessionManagerLike | null;
  useInsecureForRefreshToken?: boolean;
};

export type TabSync = {
  tabId: string;
  applyTokens: (tokens: TabSyncTokens) => Promise<void>;
  applyTokensFromResult: (result: RefreshTokenResult) => Promise<void>;
  broadcastTokens: (tokens: TabSyncTokens) => void;
  broadcastSessionCleared: () => void;
  tryWithRefreshLock: <T>(
    fn: () => Promise<T>
  ) => Promise<
    {ran: true; value: T; usedAmbiguousFallback: boolean} | {ran: false}
  >;
  waitForTokenBroadcast: (timeoutMs?: number) => Promise<TabSyncTokens | null>;
  setupListeners: (handlers: {
    onTokensUpdated?: (tokens: TabSyncTokens) => void;
    onSessionCleared?: () => void;
  }) => () => void;
  setupVisibilitySync: (onVisible: () => void | Promise<void>) => () => void;
  dispose: () => void;
};

const isBrowser = (): boolean =>
  typeof window !== 'undefined' &&
  typeof document !== 'undefined' &&
  typeof window.addEventListener === 'function';

const getTabId = (): string => {
  if (!isBrowser()) return 'server';
  const key = 'kinde_tab_id';

  let id: string | null = null;
  try {
    id = sessionStorage.getItem(key);
  } catch {
    // sessionStorage may be unavailable (e.g. private mode)
  }

  if (!id) {
    id =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `tab_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    try {
      sessionStorage.setItem(key, id);
    } catch {
      // ignore persistence failures
    }
  }
  return id;
};

export const isSuccessResult = (
  result: RefreshTokenResult
): result is RefreshTokenResultSuccess =>
  result.success === true &&
  typeof result[StorageKeys.accessToken] === 'string';

export const createTabSync = (options: TabSyncOptions): TabSync => {
  const {store, insecureStorage, useInsecureForRefreshToken = false} = options;
  const tabId = getTabId();

  let channel: BroadcastChannel | null = null;
  let lsListener: ((event: StorageEvent) => void) | null = null;
  const pendingBroadcastWaits = new Set<{
    resolve: (tokens: TabSyncTokens | null) => void;
    reject: (error: Error) => void;
    clearTimer: () => void;
  }>();

  const getChannel = (): BroadcastChannel | null => {
    if (!isBrowser() || typeof BroadcastChannel === 'undefined') {
      return null;
    }
    if (!channel) {
      channel = new BroadcastChannel(CHANNEL_NAME);
    }
    return channel;
  };

  const notifyBroadcastWaiters = (tokens: TabSyncTokens | null) => {
    pendingBroadcastWaits.forEach(({resolve, clearTimer}) => {
      clearTimer();
      resolve(tokens);
    });
    pendingBroadcastWaits.clear();
  };

  const postMessage = (message: TabSyncMessage): void => {
    const ch = getChannel();
    if (ch) {
      ch.postMessage(message);
      return;
    }
    if (!isBrowser()) return;
    try {
      localStorage.setItem(
        LS_SYNC_KEY,
        JSON.stringify({...message, at: Date.now()})
      );
      localStorage.removeItem(LS_SYNC_KEY);
    } catch {
      // localStorage may be unavailable
    }
  };

  const clearMirroredRefreshToken = (): void => {
    if (useInsecureForRefreshToken && insecureStorage?.removeSessionItem) {
      insecureStorage.removeSessionItem(StorageKeys.refreshToken);
    }
  };

  const applyTokens = async (tokens: TabSyncTokens): Promise<void> => {
    const items: Partial<Record<StorageKeys, string>> = {
      [StorageKeys.accessToken]: tokens.accessToken,
      [StorageKeys.idToken]: tokens.idToken
    };
    if (tokens.refreshToken) {
      items[StorageKeys.refreshToken] = tokens.refreshToken;
    }
    await store.setItems(items);

    if (useInsecureForRefreshToken && insecureStorage && tokens.refreshToken) {
      insecureStorage.setSessionItem(
        StorageKeys.refreshToken,
        tokens.refreshToken
      );
    }
  };

  const applyTokensFromResult = async (
    result: RefreshTokenResult
  ): Promise<void> => {
    if (!isSuccessResult(result)) return;

    const accessToken = result[StorageKeys.accessToken]!;
    const idToken = result[StorageKeys.idToken];
    const refreshToken = result[StorageKeys.refreshToken];

    if (!idToken) return;

    await applyTokens({
      accessToken,
      idToken,
      ...(refreshToken ? {refreshToken} : {})
    });
  };

  const broadcastTokens = (tokens: TabSyncTokens): void => {
    postMessage({type: 'tokens_updated', tokens, tabId});
  };

  const broadcastSessionCleared = (): void => {
    postMessage({type: 'session_cleared', tabId});
  };

  const readLsLock = (): {tabId: string; until: number} | null => {
    if (!isBrowser()) return null;
    try {
      const raw = localStorage.getItem(LS_LOCK_KEY);
      if (!raw) return null;
      return JSON.parse(raw) as {tabId: string; until: number};
    } catch {
      return null;
    }
  };

  const writeLsLock = (): void => {
    if (!isBrowser()) return;
    localStorage.setItem(
      LS_LOCK_KEY,
      JSON.stringify({tabId, until: Date.now() + LOCK_TTL_MS})
    );
  };

  const clearLsLockIfOwner = (): void => {
    if (!isBrowser()) return;
    const lock = readLsLock();
    if (lock?.tabId === tabId) {
      localStorage.removeItem(LS_LOCK_KEY);
    }
  };

  const tryWithRefreshLock = async <T>(
    fn: () => Promise<T>
  ): Promise<
    {ran: true; value: T; usedAmbiguousFallback: boolean} | {ran: false}
  > => {
    if (!isBrowser()) {
      return {ran: true, value: await fn(), usedAmbiguousFallback: false};
    }

    if (typeof navigator !== 'undefined' && navigator.locks?.request) {
      let acquired = false;
      let result!: T;

      await navigator.locks.request(
        LOCK_NAME,
        {ifAvailable: true},
        async (lock) => {
          if (!lock) return;
          acquired = true;
          result = await fn();
        }
      );

      if (acquired) {
        return {ran: true, value: result, usedAmbiguousFallback: false};
      }
      return {ran: false};
    }

    const existing = readLsLock();
    if (existing && existing.until > Date.now() && existing.tabId !== tabId) {
      return {ran: false};
    }

    writeLsLock();
    const acquired = readLsLock();
    if (!acquired || acquired.tabId !== tabId || acquired.until <= Date.now()) {
      return {ran: false};
    }

    try {
      return {
        ran: true,
        value: await fn(),
        usedAmbiguousFallback: true
      };
    } finally {
      clearLsLockIfOwner();
    }
  };

  const waitForTokenBroadcast = (
    timeoutMs = BROADCAST_WAIT_MS
  ): Promise<TabSyncTokens | null> =>
    new Promise((resolve, reject) => {
      let timer: ReturnType<typeof setTimeout> | undefined;

      const clearTimer = () => {
        if (timer !== undefined) {
          clearTimeout(timer);
          timer = undefined;
        }
      };

      const entry = {
        resolve,
        reject,
        clearTimer
      };
      pendingBroadcastWaits.add(entry);

      timer = setTimeout(() => {
        pendingBroadcastWaits.delete(entry);
        clearTimer();
        resolve(null);
      }, timeoutMs);

      entry.resolve = (tokens) => {
        clearTimer();
        pendingBroadcastWaits.delete(entry);
        resolve(tokens);
      };
    });

  const dispatchMessage = (
    message: TabSyncMessage,
    handlers: {
      onTokensUpdated?: (tokens: TabSyncTokens) => void;
      onSessionCleared?: () => void;
    }
  ): void => {
    if (message.tabId === tabId) return;

    if (message.type === 'tokens_updated') {
      void applyTokens(message.tokens)
        .then(() => {
          handlers.onTokensUpdated?.(message.tokens);
        })
        .catch((error) => {
          console.error('Failed to apply synced tokens:', error);
        })
        .finally(() => {
          notifyBroadcastWaiters(message.tokens);
        });
    } else if (message.type === 'session_cleared') {
      store.reset();
      clearMirroredRefreshToken();
      handlers.onSessionCleared?.();
      notifyBroadcastWaiters(null);
    }
  };

  const setupListeners = (handlers: {
    onTokensUpdated?: (tokens: TabSyncTokens) => void;
    onSessionCleared?: () => void;
  }): (() => void) => {
    const ch = getChannel();
    const onChannelMessage = (event: MessageEvent<TabSyncMessage>) => {
      dispatchMessage(event.data, handlers);
    };

    if (ch) {
      ch.addEventListener('message', onChannelMessage);
    }

    lsListener = (event: StorageEvent) => {
      if (event.key !== LS_SYNC_KEY || !event.newValue) return;
      try {
        const message = JSON.parse(event.newValue) as TabSyncMessage;
        dispatchMessage(message, handlers);
      } catch {
        // ignore malformed payloads
      }
    };

    if (isBrowser()) {
      window.addEventListener('storage', lsListener);
    }

    return () => {
      ch?.removeEventListener('message', onChannelMessage);
      if (lsListener) {
        window.removeEventListener('storage', lsListener);
        lsListener = null;
      }
    };
  };

  const setupVisibilitySync = (
    onVisible: () => void | Promise<void>
  ): (() => void) => {
    if (!isBrowser()) return () => undefined;

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void onVisible();
      }
    };

    const onFocus = () => {
      void onVisible();
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('focus', onFocus);

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('focus', onFocus);
    };
  };

  const dispose = (): void => {
    channel?.close();
    channel = null;
    pendingBroadcastWaits.forEach(({reject, clearTimer}) => {
      clearTimer();
      reject(new Error('Tab sync disposed'));
    });
    pendingBroadcastWaits.clear();
  };

  return {
    tabId,
    applyTokens,
    applyTokensFromResult,
    broadcastTokens,
    broadcastSessionCleared,
    tryWithRefreshLock,
    waitForTokenBroadcast,
    setupListeners,
    setupVisibilitySync,
    dispose
  };
};

export const tokensFromRefreshResult = (
  result: RefreshTokenResult
): TabSyncTokens | null => {
  if (!isSuccessResult(result)) return null;
  const accessToken = result[StorageKeys.accessToken]!;
  const idToken = result[StorageKeys.idToken];
  if (!idToken) return null;
  return {
    accessToken,
    idToken,
    ...(result[StorageKeys.refreshToken]
      ? {refreshToken: result[StorageKeys.refreshToken]}
      : {})
  };
};
