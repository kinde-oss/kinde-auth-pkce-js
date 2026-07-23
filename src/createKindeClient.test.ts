jest.mock('./utils/index', () => ({
  setupChallenge: jest.fn(),
  isJWTActive: jest.fn(),
  getClaim: jest.fn(),
  getClaimValue: jest.fn(),
  getUserOrganizations: jest.fn(),
  getIntegerFlag: jest.fn(),
  getStringFlag: jest.fn(),
  getBooleanFlag: jest.fn(),
  getFlag: jest.fn(),
  isTokenValid: jest.fn(() => true),
  isCustomDomain: jest.fn(() => false)
}));

jest.mock('./kindeUtils', () => {
  const actual =
    jest.requireActual<typeof import('./kindeUtils')>('./kindeUtils');
  return {
    ...actual,
    generatePortalUrl: jest.fn(),
    setActiveStorage: jest.fn(),
    setInsecureStorage: jest.fn(),
    checkAuth: jest.fn().mockResolvedValue({success: false}),
    exchangeAuthCode: jest.fn().mockResolvedValue({success: true}),
    getUserProfile: jest.fn().mockResolvedValue(undefined),
    refreshToken: jest.fn().mockResolvedValue({success: false}),
    navigateToKinde: jest.fn().mockImplementation((opts: {url: string}) => {
      (global as typeof globalThis & {location: {href: string}}).location.href =
        opts.url;
    })
  };
});

import createKindeClient from './createKindeClient';
import {
  setActiveStorage,
  checkAuth,
  exchangeAuthCode,
  getUserProfile,
  refreshToken,
  storageSettings,
  StorageKeys,
  RefreshType,
  navigateToKinde
} from './kindeUtils';
import {store} from './state/store';
import {SESSION_PREFIX, storageMap} from './constants';
import {isJWTActive, isTokenValid} from './utils/index';
import {isTokenValid as actualIsTokenValid} from './utils/isTokenValid/isTokenValid';

const mockSetActiveStorage = setActiveStorage as jest.Mock;
const mockCheckAuth = checkAuth as jest.Mock;
const mockExchangeAuthCode = exchangeAuthCode as jest.Mock;
const mockGetUserProfile = getUserProfile as jest.Mock;
const mockRefreshToken = refreshToken as jest.Mock;
const mockNavigateToKinde = navigateToKinde as jest.Mock;
const mockIsJWTActive = isJWTActive as jest.MockedFunction<typeof isJWTActive>;
const mockIsTokenValid = isTokenValid as jest.MockedFunction<
  typeof isTokenValid
>;

type StorageMock = {
  getItem: jest.Mock;
  setItem: jest.Mock;
  removeItem: jest.Mock;
  clear: jest.Mock;
};

const createStorageMock = (): StorageMock => ({
  getItem: jest.fn(() => null),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn()
});

const b64url = (value: unknown) =>
  Buffer.from(JSON.stringify(value), 'utf8')
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

/** Minimal JWT strings for refresh response parsing (jwt-decode in setStore). */
const makeJwt = (payload: Record<string, unknown>) =>
  `${b64url({alg: 'none', typ: 'JWT'})}.${b64url(payload)}.x`;

const setWindowLocation = (search = '', hostname = 'localhost') => {
  const host = hostname === 'localhost' ? 'localhost:3000' : hostname;
  const location = {
    href: `http://${host}/${search}`,
    search,
    hostname,
    pathname: '/',
    protocol: 'http:',
    host,
    toString() {
      return this.href;
    }
  };

  Object.defineProperty(global, 'window', {
    value: {
      location,
      history: {
        pushState: jest.fn()
      }
    },
    writable: true,
    configurable: true
  });

  Object.defineProperty(global, 'location', {
    value: location,
    writable: true,
    configurable: true
  });

  return location;
};

describe('createKindeClient invitation flow', () => {
  beforeEach(() => {
    mockSetActiveStorage.mockReset();
    store.reset();
    Object.defineProperty(global, 'sessionStorage', {
      value: createStorageMock(),
      writable: true,
      configurable: true
    });
    Object.defineProperty(global, 'localStorage', {
      value: createStorageMock(),
      writable: true,
      configurable: true
    });
    global.fetch = jest.fn();
  });

  afterEach(() => {
    storageSettings.onRefreshHandler = undefined;
    jest.clearAllMocks();
  });

  it('starts a new auth flow when invitation_code is present in the URL', async () => {
    setWindowLocation('?invitation_code=invite-123&is_invitation=true&foo=bar');

    await createKindeClient({
      domain: 'https://example.kinde.com',
      redirect_uri: 'http://localhost:3000/'
    });

    const redirectedUrl = new URL(
      (window as typeof globalThis & {location: Location}).location.href
    );

    expect(redirectedUrl.searchParams.get('invitation_code')).toBe(
      'invite-123'
    );
    expect(redirectedUrl.searchParams.get('is_invitation')).toBe('true');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('passes invitation params through manual login calls without mutating custom params', async () => {
    setWindowLocation();
    const authUrlParams = {connection_id: 'conn_123'};

    const client = await createKindeClient({
      domain: 'https://example.kinde.com',
      redirect_uri: 'http://localhost:3000/'
    });

    await client.login({
      invitation_code: 'invite-456',
      authUrlParams
    });

    const redirectedUrl = new URL(
      (window as typeof globalThis & {location: Location}).location.href
    );

    expect(redirectedUrl.searchParams.get('invitation_code')).toBe(
      'invite-456'
    );
    expect(redirectedUrl.searchParams.get('is_invitation')).toBe('true');
    expect(redirectedUrl.searchParams.get('connection_id')).toBe('conn_123');
    expect(authUrlParams).toEqual({connection_id: 'conn_123'});
  });
});

describe('refresh token storage routing (expired access → refresh recovery)', () => {
  const domain = 'https://example.kinde.com';
  const redirectUri = 'http://localhost:3000/';

  beforeEach(() => {
    mockSetActiveStorage.mockReset();
    mockCheckAuth.mockClear();
    store.reset();
    mockIsJWTActive.mockReturnValue(false);

    Object.defineProperty(global, 'sessionStorage', {
      value: createStorageMock(),
      writable: true,
      configurable: true
    });
    Object.defineProperty(global, 'localStorage', {
      value: createStorageMock(),
      writable: true,
      configurable: true
    });

    const now = Math.floor(Date.now() / 1000);
    const freshAccess = makeJwt({exp: now + 3600, sub: 'user-1'});
    const freshId = makeJwt({exp: now + 3600, sub: 'user-1'});

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        access_token: freshAccess,
        id_token: freshId,
        refresh_token: 'new-refresh-token',
        expires_in: 3600,
        scope: 'openid',
        token_type: 'Bearer'
      })
    });
  });

  afterEach(() => {
    storageSettings.onRefreshHandler = undefined;
    jest.clearAllMocks();
  });

  it('reads refresh from localStorage and writes refreshed tokens back there on localhost', async () => {
    setWindowLocation();
    const ls = global.localStorage as unknown as StorageMock;
    ls.getItem.mockImplementation((key: string) =>
      key === storageMap.refresh_token ? 'rt-in-localstorage' : null
    );

    const past = Math.floor(Date.now() / 1000) - 120;
    store.setItem(storageMap.token_bundle, {
      access_token: 'old',
      id_token: 'old',
      refresh_token: 'old-rt',
      expires_in: 3600,
      scope: 'openid',
      token_type: 'Bearer'
    });
    store.setItem(storageMap.access_token, {exp: past});

    const client = await createKindeClient({
      domain,
      redirect_uri: redirectUri
    });

    expect(mockCheckAuth).toHaveBeenCalledWith({
      domain,
      clientId: 'spa@live'
    });

    const token = await client.getToken();
    expect(token).toBeTruthy();
    expect(global.fetch).toHaveBeenCalledTimes(1);

    const fetchInit = (global.fetch as jest.Mock).mock.calls[0][1] as {
      body: URLSearchParams;
    };
    const params = new URLSearchParams(fetchInit.body.toString());
    expect(params.get('grant_type')).toBe('refresh_token');
    expect(params.get('refresh_token')).toBe('rt-in-localstorage');

    expect(ls.setItem).toHaveBeenCalledWith(
      storageMap.refresh_token,
      'new-refresh-token'
    );
  });

  it('reads refresh from the active secure store and persists refreshed tokens there when not on localhost', async () => {
    setWindowLocation('', 'app.example.com');

    const ls = global.localStorage as unknown as StorageMock;
    ls.getItem.mockImplementation(() => null);

    const past = Math.floor(Date.now() / 1000) - 120;
    store.setItem(storageMap.token_bundle, {
      access_token: 'old',
      id_token: 'old',
      refresh_token: 'old-rt',
      expires_in: 3600,
      scope: 'openid',
      token_type: 'Bearer'
    });
    store.setItem(storageMap.access_token, {exp: past});
    store.setItem(storageMap.refresh_token, 'rt-in-session-store');

    const client = await createKindeClient({
      domain,
      redirect_uri: 'http://app.example.com/',
      is_dangerously_use_local_storage: false
    });

    expect(mockCheckAuth).toHaveBeenCalledWith({
      domain,
      clientId: 'spa@live'
    });

    const token = await client.getToken();
    expect(token).toBeTruthy();
    expect(global.fetch).toHaveBeenCalledTimes(1);

    const fetchInit = (global.fetch as jest.Mock).mock.calls[0][1] as {
      body: URLSearchParams;
    };
    const params = new URLSearchParams(fetchInit.body.toString());
    expect(params.get('refresh_token')).toBe('rt-in-session-store');

    expect(store.getItem(storageMap.refresh_token)).toBe('new-refresh-token');
    expect(ls.setItem).not.toHaveBeenCalledWith(
      storageMap.refresh_token,
      expect.anything()
    );
  });
});

describe('on_redirect_callback semantics', () => {
  beforeEach(() => {
    mockSetActiveStorage.mockReset();
    mockCheckAuth.mockClear();
    mockExchangeAuthCode.mockClear();
    mockGetUserProfile.mockReset();
    store.reset();
    Object.defineProperty(global, 'sessionStorage', {
      value: createStorageMock(),
      writable: true,
      configurable: true
    });
    Object.defineProperty(global, 'localStorage', {
      value: createStorageMock(),
      writable: true,
      configurable: true
    });
    global.fetch = jest.fn();
  });

  afterEach(() => {
    storageSettings.onRefreshHandler = undefined;
    jest.clearAllMocks();
  });

  it('fires callback after code exchange with stored app_state', async () => {
    const state = b64url({kinde: {event: 'login'}});
    setWindowLocation(`?code=auth-code&state=${state}`);

    const ss = global.sessionStorage as unknown as StorageMock;
    const storedAppState = {returnTo: '/dashboard'};
    ss.getItem.mockImplementation((key: string) =>
      key === `${SESSION_PREFIX}-app-state-${state}`
        ? JSON.stringify(storedAppState)
        : null
    );
    mockExchangeAuthCode.mockResolvedValue({success: true});
    mockGetUserProfile.mockResolvedValue({id: 'kp:user-1', email: 'u@x.com'});
    const onRedirect = jest.fn();

    await createKindeClient({
      domain: 'https://example.kinde.com',
      redirect_uri: 'http://localhost:3000/',
      on_redirect_callback: onRedirect
    });

    expect(onRedirect).toHaveBeenCalledTimes(1);
    expect(onRedirect).toHaveBeenCalledWith(
      expect.objectContaining({id: 'kp:user-1'}),
      storedAppState
    );
  });

  it('does not fire callback on silent restore page load', async () => {
    setWindowLocation();
    mockGetUserProfile.mockResolvedValue({id: 'kp:user-1', email: 'u@x.com'});
    const onRedirect = jest.fn();

    await createKindeClient({
      domain: 'https://example.kinde.com',
      redirect_uri: 'http://localhost:3000/',
      on_redirect_callback: onRedirect
    });

    expect(onRedirect).not.toHaveBeenCalled();
  });
});

describe('on_session_restore_callback semantics', () => {
  beforeEach(() => {
    mockSetActiveStorage.mockReset();
    mockCheckAuth.mockClear();
    mockExchangeAuthCode.mockClear();
    mockGetUserProfile.mockReset();
    mockRefreshToken.mockReset();
    mockRefreshToken.mockResolvedValue({success: false});
    mockIsJWTActive.mockReset();
    mockIsJWTActive.mockReturnValue(false);
    store.reset();
    Object.defineProperty(global, 'sessionStorage', {
      value: createStorageMock(),
      writable: true,
      configurable: true
    });
    Object.defineProperty(global, 'localStorage', {
      value: createStorageMock(),
      writable: true,
      configurable: true
    });
    global.fetch = jest.fn();
  });

  afterEach(() => {
    storageSettings.onRefreshHandler = undefined;
    jest.clearAllMocks();
  });

  it('fires session restore callback on non-redirect authenticated load', async () => {
    setWindowLocation();
    const activeJwt = makeJwt({exp: Math.floor(Date.now() / 1000) + 3600});
    store.setSessionItem(StorageKeys.accessToken, activeJwt);
    mockIsJWTActive.mockReturnValue(true);
    mockGetUserProfile.mockResolvedValue({
      id: 'kp:user-1',
      givenName: 'Test',
      familyName: 'User',
      email: 'u@x.com',
      picture: undefined
    });
    const onSessionRestore = jest.fn();

    await createKindeClient({
      domain: 'https://example.kinde.com',
      redirect_uri: 'http://localhost:3000/',
      on_session_restore_callback: onSessionRestore
    });

    expect(onSessionRestore).toHaveBeenCalledTimes(1);
    expect(onSessionRestore).toHaveBeenCalledWith(
      expect.objectContaining({id: 'kp:user-1', email: 'u@x.com'}),
      expect.objectContaining({
        kindeOriginUrl: 'http://localhost:3000/',
        kinde: {event: 'session_restore'}
      })
    );
  });

  it('populates getUser on session restore without callback when id token is present', async () => {
    setWindowLocation();
    const activeJwt = makeJwt({exp: Math.floor(Date.now() / 1000) + 3600});
    store.setSessionItem(StorageKeys.accessToken, activeJwt);
    mockIsJWTActive.mockReturnValue(true);
    mockGetUserProfile.mockResolvedValue(undefined);
    store.setSessionItem(
      StorageKeys.idToken,
      makeJwt({
        sub: 'kp:user-1',
        email: 'u@x.com',
        given_name: 'Test',
        family_name: 'User'
      })
    );

    const client = await createKindeClient({
      domain: 'https://example.kinde.com',
      redirect_uri: 'http://localhost:3000/'
    });

    expect(mockGetUserProfile).toHaveBeenCalled();
    expect(client.getUser()).toMatchObject({
      id: 'kp:user-1',
      email: 'u@x.com',
      given_name: 'Test',
      family_name: 'User'
    });
  });

  it('does not fetch user profile when session is not authenticated', async () => {
    setWindowLocation();

    await createKindeClient({
      domain: 'https://example.kinde.com',
      redirect_uri: 'http://localhost:3000/'
    });

    expect(mockGetUserProfile).not.toHaveBeenCalled();
  });

  it('does not hydrate user from stale id token when session is not authenticated', async () => {
    setWindowLocation();
    store.setSessionItem(
      StorageKeys.idToken,
      makeJwt({
        sub: 'kp:stale-user',
        email: 'stale@x.com',
        given_name: 'Stale',
        family_name: 'User'
      })
    );

    const client = await createKindeClient({
      domain: 'https://example.kinde.com',
      redirect_uri: 'http://localhost:3000/'
    });

    expect(client.getUser()).toBeFalsy();
  });

  it('clears previously stored user when session is not authenticated on init', async () => {
    setWindowLocation();
    store.setItem(storageMap.user, {
      id: 'kp:stale-user',
      email: 'stale@x.com',
      given_name: 'Stale',
      family_name: 'User'
    });

    const client = await createKindeClient({
      domain: 'https://example.kinde.com',
      redirect_uri: 'http://localhost:3000/'
    });

    expect(client.getUser()).toBeFalsy();
  });

  it('does not fire session restore callback on redirect handling load', async () => {
    const state = b64url({kinde: {event: 'login'}});
    setWindowLocation(`?code=auth-code&state=${state}`);
    const ss = global.sessionStorage as unknown as StorageMock;
    ss.getItem.mockImplementation(() =>
      JSON.stringify({returnTo: '/dashboard'})
    );
    mockExchangeAuthCode.mockResolvedValue({success: true});
    mockGetUserProfile.mockResolvedValue({id: 'kp:user-1', email: 'u@x.com'});
    const onSessionRestore = jest.fn();

    await createKindeClient({
      domain: 'https://example.kinde.com',
      redirect_uri: 'http://localhost:3000/',
      on_session_restore_callback: onSessionRestore
    });

    expect(onSessionRestore).not.toHaveBeenCalled();
  });
});

describe('visibility sync hydration', () => {
  const setupVisibilityBrowserMocks = () => {
    setWindowLocation();
    Object.defineProperty(global, 'window', {
      value: {
        ...(global.window as object),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn()
      },
      writable: true,
      configurable: true
    });
    Object.defineProperty(global, 'document', {
      value: {
        visibilityState: 'visible',
        addEventListener: jest.fn(),
        removeEventListener: jest.fn()
      },
      writable: true,
      configurable: true
    });
    Object.defineProperty(global, 'navigator', {
      value: {
        locks: {
          request: async (
            _name: string,
            _options: {ifAvailable: boolean},
            callback: (lock: object) => Promise<void>
          ) => {
            await callback({});
          }
        }
      },
      writable: true,
      configurable: true
    });
    Object.defineProperty(global, 'BroadcastChannel', {
      value: undefined,
      writable: true,
      configurable: true
    });
  };

  beforeEach(() => {
    mockSetActiveStorage.mockReset();
    mockCheckAuth.mockClear();
    mockCheckAuth.mockResolvedValue({success: false});
    mockRefreshToken.mockReset();
    mockRefreshToken.mockResolvedValue({success: false});
    mockIsJWTActive.mockReset();
    mockIsJWTActive.mockReturnValue(false);
    store.reset();
    setupVisibilityBrowserMocks();
    Object.defineProperty(global, 'sessionStorage', {
      value: createStorageMock(),
      writable: true,
      configurable: true
    });
    Object.defineProperty(global, 'localStorage', {
      value: createStorageMock(),
      writable: true,
      configurable: true
    });
    global.fetch = jest.fn();
  });

  afterEach(() => {
    storageSettings.onRefreshHandler = undefined;
    jest.clearAllMocks();
  });

  it('does not hydrate user from stale id token after failed visibility checkAuth', async () => {
    store.setSessionItem(
      StorageKeys.idToken,
      makeJwt({
        sub: 'kp:stale-user',
        email: 'stale@x.com',
        given_name: 'Stale',
        family_name: 'User'
      })
    );
    store.setItem(storageMap.user, {
      id: 'kp:stale-user',
      email: 'stale@x.com',
      given_name: 'Stale',
      family_name: 'User'
    });

    const client = await createKindeClient({
      domain: 'https://example.kinde.com',
      redirect_uri: 'http://localhost:3000/'
    });

    expect(client.getUser()).toBeFalsy();

    store.setItem(storageMap.user, {
      id: 'kp:stale-user',
      email: 'stale@x.com',
      given_name: 'Stale',
      family_name: 'User'
    });

    const visibilityHandler = (
      document.addEventListener as jest.Mock
    ).mock.calls.find(([event]) => event === 'visibilitychange')?.[1] as
      (() => void) | undefined;

    mockCheckAuth.mockClear();
    visibilityHandler?.();
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(mockCheckAuth).toHaveBeenCalled();
    expect(client.getUser()).toBeFalsy();
  });

  it('hydrates user after successful visibility-triggered checkAuth', async () => {
    const now = Math.floor(Date.now() / 1000);
    const accessToken = makeJwt({exp: now + 3600, sub: 'kp:user-1'});
    const idToken = makeJwt({
      sub: 'kp:user-1',
      email: 'u@x.com',
      given_name: 'Test',
      family_name: 'User'
    });

    const client = await createKindeClient({
      domain: 'https://example.kinde.com',
      redirect_uri: 'http://localhost:3000/'
    });

    expect(client.getUser()).toBeFalsy();

    mockCheckAuth.mockResolvedValue({
      success: true,
      [StorageKeys.accessToken]: accessToken,
      [StorageKeys.idToken]: idToken,
      [StorageKeys.refreshToken]: 'refresh-token'
    });
    mockIsJWTActive.mockReturnValue(true);

    const visibilityHandler = (
      document.addEventListener as jest.Mock
    ).mock.calls.find(([event]) => event === 'visibilitychange')?.[1] as
      (() => void) | undefined;

    mockCheckAuth.mockClear();
    visibilityHandler?.();
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(mockCheckAuth).toHaveBeenCalled();
    expect(client.getUser()).toMatchObject({
      id: 'kp:user-1',
      email: 'u@x.com',
      given_name: 'Test',
      family_name: 'User'
    });
  });
});

describe('legacy localStorage refresh key migration', () => {
  beforeEach(() => {
    mockSetActiveStorage.mockReset();
    mockCheckAuth.mockClear();
    mockExchangeAuthCode.mockClear();
    mockGetUserProfile.mockReset();
    store.reset();
    Object.defineProperty(global, 'sessionStorage', {
      value: createStorageMock(),
      writable: true,
      configurable: true
    });
    Object.defineProperty(global, 'localStorage', {
      value: createStorageMock(),
      writable: true,
      configurable: true
    });
    global.fetch = jest.fn();
  });

  afterEach(() => {
    storageSettings.onRefreshHandler = undefined;
    jest.clearAllMocks();
  });

  it('migrates old localStorage refresh key before checkAuth', async () => {
    setWindowLocation();
    const ls = global.localStorage as unknown as StorageMock;
    ls.getItem.mockImplementation((key: string) => {
      if (key === storageMap.refresh_token) return 'legacy-refresh-token';
      if (key === 'kinde_refreshToken0') return null;
      return null;
    });

    await createKindeClient({
      domain: 'https://example.kinde.com',
      redirect_uri: 'http://localhost:3000/'
    });

    expect(ls.setItem).toHaveBeenCalledWith(
      'kinde_refreshToken0',
      'legacy-refresh-token'
    );
    expect(ls.removeItem).toHaveBeenCalledWith(storageMap.refresh_token);
    expect(mockCheckAuth).toHaveBeenCalledWith({
      domain: 'https://example.kinde.com',
      clientId: 'spa@live'
    });
  });

  it('does not overwrite chunked refresh key when it already exists', async () => {
    setWindowLocation();
    const ls = global.localStorage as unknown as StorageMock;
    ls.getItem.mockImplementation((key: string) => {
      if (key === storageMap.refresh_token) return 'legacy-refresh-token';
      if (key === 'kinde_refreshToken0') return 'new-refresh-token';
      return null;
    });

    await createKindeClient({
      domain: 'https://example.kinde.com',
      redirect_uri: 'http://localhost:3000/'
    });

    expect(ls.setItem).not.toHaveBeenCalledWith(
      'kinde_refreshToken0',
      'legacy-refresh-token'
    );
    expect(ls.removeItem).toHaveBeenCalledWith(storageMap.refresh_token);
  });
});

describe('storageSettings.useInsecureForRefreshToken configuration', () => {
  beforeEach(() => {
    mockSetActiveStorage.mockReset();
    mockCheckAuth.mockClear();
    store.reset();
    storageSettings.useInsecureForRefreshToken = false;
    Object.defineProperty(global, 'sessionStorage', {
      value: createStorageMock(),
      writable: true,
      configurable: true
    });
    Object.defineProperty(global, 'localStorage', {
      value: createStorageMock(),
      writable: true,
      configurable: true
    });
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
    storageSettings.useInsecureForRefreshToken = false;
  });

  it('sets useInsecureForRefreshToken to true on localhost', async () => {
    setWindowLocation('', 'localhost');

    await createKindeClient({
      domain: 'https://auth.example.com',
      redirect_uri: 'http://localhost:3000/'
    });

    expect(storageSettings.useInsecureForRefreshToken).toBe(true);
  });

  it('sets useInsecureForRefreshToken to false on a production custom domain', async () => {
    setWindowLocation('', 'app.example.com');

    await createKindeClient({
      domain: 'https://auth.example.com',
      redirect_uri: 'http://app.example.com/'
    });

    expect(storageSettings.useInsecureForRefreshToken).toBe(false);
  });

  it('sets useInsecureForRefreshToken to true when is_dangerously_use_local_storage is set', async () => {
    setWindowLocation('', 'app.example.com');

    await createKindeClient({
      domain: 'https://auth.example.com',
      redirect_uri: 'http://app.example.com/',
      is_dangerously_use_local_storage: true
    });

    expect(storageSettings.useInsecureForRefreshToken).toBe(true);
  });
});

describe('getAccessToken refresh behaviour', () => {
  const domain = 'https://example.kinde.com';

  beforeEach(() => {
    mockSetActiveStorage.mockReset();
    mockCheckAuth.mockClear();
    mockCheckAuth.mockResolvedValue({success: false});
    mockRefreshToken.mockReset();
    mockIsJWTActive.mockReset();
    store.reset();
    Object.defineProperty(global, 'sessionStorage', {
      value: createStorageMock(),
      writable: true,
      configurable: true
    });
    Object.defineProperty(global, 'localStorage', {
      value: createStorageMock(),
      writable: true,
      configurable: true
    });
    Object.defineProperty(global, 'BroadcastChannel', {
      value: undefined,
      writable: true,
      configurable: true
    });
    storageSettings.onRefreshHandler = undefined;
  });

  afterEach(() => {
    storageSettings.onRefreshHandler = undefined;
    jest.clearAllMocks();
  });

  it('returns an active token without calling refresh', async () => {
    setWindowLocation();
    mockIsJWTActive.mockReturnValue(true);
    const activeJwt = makeJwt({exp: Math.floor(Date.now() / 1000) + 600});
    store.setSessionItem(StorageKeys.accessToken, activeJwt);

    const client = await createKindeClient({
      domain,
      redirect_uri: 'http://localhost:3000/'
    });

    const token = await client.getAccessToken();

    expect(token).toBe(activeJwt);
    expect(mockRefreshToken).not.toHaveBeenCalled();
  });

  it('refreshes and returns a new token when the stored access token is expired', async () => {
    setWindowLocation();
    mockIsJWTActive.mockReturnValue(false);
    const expiredJwt = makeJwt({exp: Math.floor(Date.now() / 1000) - 60});
    const freshJwt = makeJwt({exp: Math.floor(Date.now() / 1000) + 300});
    store.setSessionItem(StorageKeys.accessToken, expiredJwt);
    store.setSessionItem(
      StorageKeys.idToken,
      makeJwt({exp: Math.floor(Date.now() / 1000) + 3600})
    );
    mockRefreshToken.mockResolvedValue({
      success: true,
      [StorageKeys.accessToken]: freshJwt,
      [StorageKeys.idToken]: makeJwt({
        exp: Math.floor(Date.now() / 1000) + 3600
      })
    });

    const client = await createKindeClient({
      domain,
      redirect_uri: 'http://localhost:3000/'
    });

    const token = await client.getAccessToken();

    expect(mockRefreshToken).toHaveBeenCalledWith(
      expect.objectContaining({refreshType: RefreshType.refreshToken})
    );
    expect(token).toBe(freshJwt);
  });

  it('uses cookie refresh on a production custom domain', async () => {
    setWindowLocation('', 'app.example.com');
    mockIsJWTActive.mockReturnValue(false);
    const expiredJwt = makeJwt({exp: Math.floor(Date.now() / 1000) - 60});
    const freshJwt = makeJwt({exp: Math.floor(Date.now() / 1000) + 300});
    store.setSessionItem(StorageKeys.accessToken, expiredJwt);
    store.setSessionItem(
      StorageKeys.idToken,
      makeJwt({exp: Math.floor(Date.now() / 1000) + 3600})
    );
    mockRefreshToken.mockResolvedValue({
      success: true,
      [StorageKeys.accessToken]: freshJwt,
      [StorageKeys.idToken]: makeJwt({
        exp: Math.floor(Date.now() / 1000) + 3600
      })
    });

    const client = await createKindeClient({
      domain: 'https://auth.example.com',
      redirect_uri: 'http://app.example.com/'
    });

    const token = await client.getAccessToken();

    expect(mockRefreshToken).toHaveBeenCalledWith(
      expect.objectContaining({refreshType: RefreshType.cookie})
    );
    expect(token).toBe(freshJwt);
  });

  it('deduplicates concurrent getAccessToken refresh attempts in the same tab', async () => {
    setWindowLocation();
    mockRefreshToken.mockResolvedValue({success: false});

    const client = await createKindeClient({
      domain,
      redirect_uri: 'http://localhost:3000/'
    });

    mockIsJWTActive.mockReturnValue(false);
    const expiredJwt = makeJwt({exp: Math.floor(Date.now() / 1000) - 60});
    const freshJwt = makeJwt({exp: Math.floor(Date.now() / 1000) + 300});
    store.setSessionItem(StorageKeys.accessToken, expiredJwt);
    store.setSessionItem(
      StorageKeys.idToken,
      makeJwt({exp: Math.floor(Date.now() / 1000) + 3600})
    );
    mockRefreshToken.mockClear();
    mockRefreshToken.mockResolvedValue({
      success: true,
      [StorageKeys.accessToken]: freshJwt,
      [StorageKeys.idToken]: makeJwt({
        exp: Math.floor(Date.now() / 1000) + 3600
      })
    });

    const [first, second] = await Promise.all([
      client.getAccessToken(),
      client.getAccessToken()
    ]);

    expect(mockRefreshToken).toHaveBeenCalledTimes(1);
    expect(first).toBe(freshJwt);
    expect(second).toBe(freshJwt);
  });

  it('returns undefined without clearing storage when refresh fails', async () => {
    setWindowLocation();
    mockIsJWTActive.mockReturnValue(false);
    const expiredJwt = makeJwt({exp: Math.floor(Date.now() / 1000) - 60});
    store.setSessionItem(StorageKeys.accessToken, expiredJwt);
    store.setSessionItem(StorageKeys.refreshToken, 'rt-keep');
    mockRefreshToken.mockResolvedValue({
      success: false,
      error: 'invalid_grant'
    });

    const client = await createKindeClient({
      domain,
      redirect_uri: 'http://localhost:3000/'
    });

    const token = await client.getAccessToken();

    expect(token).toBeUndefined();
    expect(store.getSessionItem(StorageKeys.refreshToken)).toBe('rt-keep');
    expect(store.getSessionItem(StorageKeys.accessToken)).toBe(expiredJwt);
  });
});

describe('isAuthenticated refresh behaviour', () => {
  const domain = 'https://example.kinde.com';

  beforeEach(() => {
    mockSetActiveStorage.mockReset();
    mockCheckAuth.mockClear();
    mockCheckAuth.mockResolvedValue({success: false});
    mockRefreshToken.mockReset();
    mockIsJWTActive.mockReset();
    store.reset();
    Object.defineProperty(global, 'sessionStorage', {
      value: createStorageMock(),
      writable: true,
      configurable: true
    });
    Object.defineProperty(global, 'localStorage', {
      value: createStorageMock(),
      writable: true,
      configurable: true
    });
    global.fetch = jest.fn();
  });

  afterEach(() => {
    storageSettings.onRefreshHandler = undefined;
    jest.clearAllMocks();
  });

  it('returns true when the stored access token is active', async () => {
    setWindowLocation();
    mockIsJWTActive.mockReturnValue(true);
    store.setSessionItem(
      StorageKeys.accessToken,
      makeJwt({exp: Math.floor(Date.now() / 1000) + 3600})
    );

    const client = await createKindeClient({
      domain,
      redirect_uri: 'http://localhost:3000/'
    });

    await expect(client.isAuthenticated()).resolves.toBe(true);
    expect(mockRefreshToken).not.toHaveBeenCalled();
  });

  it('uses refreshToken refresh on localhost when the access token is expired', async () => {
    setWindowLocation();
    mockIsJWTActive.mockReturnValue(false);
    const freshJwt = makeJwt({exp: Math.floor(Date.now() / 1000) + 300});
    store.setSessionItem(
      StorageKeys.accessToken,
      makeJwt({exp: Math.floor(Date.now() / 1000) - 60})
    );
    mockRefreshToken.mockResolvedValue({
      success: true,
      [StorageKeys.accessToken]: freshJwt,
      [StorageKeys.idToken]: makeJwt({
        exp: Math.floor(Date.now() / 1000) + 3600
      })
    });

    const client = await createKindeClient({
      domain,
      redirect_uri: 'http://localhost:3000/'
    });

    await expect(client.isAuthenticated()).resolves.toBe(true);
    expect(mockRefreshToken).toHaveBeenCalledWith(
      expect.objectContaining({refreshType: RefreshType.refreshToken})
    );
  });

  it('uses cookie refresh on a production custom domain when the access token is expired', async () => {
    setWindowLocation('', 'app.example.com');
    mockIsJWTActive.mockReturnValue(false);
    const freshJwt = makeJwt({exp: Math.floor(Date.now() / 1000) + 300});
    store.setSessionItem(
      StorageKeys.accessToken,
      makeJwt({exp: Math.floor(Date.now() / 1000) - 60})
    );
    mockRefreshToken.mockResolvedValue({
      success: true,
      [StorageKeys.accessToken]: freshJwt,
      [StorageKeys.idToken]: makeJwt({
        exp: Math.floor(Date.now() / 1000) + 3600
      })
    });

    const client = await createKindeClient({
      domain: 'https://auth.example.com',
      redirect_uri: 'http://app.example.com/'
    });

    await expect(client.isAuthenticated()).resolves.toBe(true);
    expect(mockRefreshToken).toHaveBeenCalledWith(
      expect.objectContaining({refreshType: RefreshType.cookie})
    );
  });

  it('returns false when cookie refresh fails', async () => {
    setWindowLocation('', 'app.example.com');
    mockIsJWTActive.mockReturnValue(false);
    store.setSessionItem(
      StorageKeys.accessToken,
      makeJwt({exp: Math.floor(Date.now() / 1000) - 60})
    );
    mockRefreshToken.mockResolvedValue({
      success: false,
      error: 'No refresh token found'
    });

    const client = await createKindeClient({
      domain: 'https://auth.example.com',
      redirect_uri: 'http://app.example.com/'
    });

    await expect(client.isAuthenticated()).resolves.toBe(false);
    expect(mockRefreshToken).toHaveBeenCalledWith(
      expect.objectContaining({refreshType: RefreshType.cookie})
    );
  });
});

describe('logout awaits in-flight refresh', () => {
  beforeEach(() => {
    mockSetActiveStorage.mockReset();
    mockCheckAuth.mockClear();
    mockCheckAuth.mockResolvedValue({success: false});
    mockRefreshToken.mockReset();
    mockNavigateToKinde.mockClear();
    mockNavigateToKinde.mockImplementation((opts: {url: string}) => {
      (global as typeof globalThis & {location: {href: string}}).location.href =
        opts.url;
    });
    mockIsJWTActive.mockReset();
    store.reset();
    Object.defineProperty(global, 'sessionStorage', {
      value: createStorageMock(),
      writable: true,
      configurable: true
    });
    Object.defineProperty(global, 'localStorage', {
      value: createStorageMock(),
      writable: true,
      configurable: true
    });
    Object.defineProperty(global, 'BroadcastChannel', {
      value: undefined,
      writable: true,
      configurable: true
    });
    storageSettings.onRefreshHandler = undefined;
  });

  afterEach(() => {
    storageSettings.onRefreshHandler = undefined;
    jest.clearAllMocks();
  });

  it('awaits an in-flight cookie refresh before navigating to /logout', async () => {
    setWindowLocation('', 'app.example.com');
    mockRefreshToken.mockResolvedValue({success: false});

    const client = await createKindeClient({
      domain: 'https://auth.example.com',
      redirect_uri: 'http://app.example.com/'
    });

    mockIsJWTActive.mockReturnValue(false);
    const expiredJwt = makeJwt({exp: Math.floor(Date.now() / 1000) - 60});
    const freshJwt = makeJwt({exp: Math.floor(Date.now() / 1000) + 300});
    const idJwt = makeJwt({exp: Math.floor(Date.now() / 1000) + 3600});
    store.setSessionItem(StorageKeys.accessToken, expiredJwt);
    store.setSessionItem(StorageKeys.idToken, idJwt);

    let resolveRefresh!: (value: {
      success: true;
      [StorageKeys.accessToken]: string;
      [StorageKeys.idToken]: string;
    }) => void;
    mockRefreshToken.mockReturnValue(
      new Promise((resolve) => {
        resolveRefresh = resolve;
      })
    );

    const accessPromise = client.getAccessToken();
    // Allow the refresh coordination to start and take the in-flight slot.
    await Promise.resolve();
    await Promise.resolve();

    const logoutPromise = client.logout();
    await Promise.resolve();

    expect(mockNavigateToKinde).not.toHaveBeenCalled();

    resolveRefresh({
      success: true,
      [StorageKeys.accessToken]: freshJwt,
      [StorageKeys.idToken]: idJwt
    });

    await accessPromise;
    await logoutPromise;

    expect(mockNavigateToKinde).toHaveBeenCalledTimes(1);
    expect(mockNavigateToKinde).toHaveBeenCalledWith(
      expect.objectContaining({
        url: expect.stringContaining('https://auth.example.com/logout?')
      })
    );
    expect(store.getSessionItem(StorageKeys.accessToken)).toBeNull();
    expect(store.getSessionItem(StorageKeys.idToken)).toBeNull();
    expect(store.getSessionItem(StorageKeys.refreshToken)).toBeNull();
  });

  it('does not apply in-flight refresh tokens after logout has started', async () => {
    setWindowLocation('', 'app.example.com');
    mockRefreshToken.mockResolvedValue({success: false});

    const client = await createKindeClient({
      domain: 'https://auth.example.com',
      redirect_uri: 'http://app.example.com/'
    });

    mockIsJWTActive.mockReturnValue(false);
    const expiredJwt = makeJwt({exp: Math.floor(Date.now() / 1000) - 60});
    const freshJwt = makeJwt({exp: Math.floor(Date.now() / 1000) + 300});
    const idJwt = makeJwt({
      exp: Math.floor(Date.now() / 1000) + 3600,
      sub: 'user-1',
      given_name: 'Ada',
      family_name: 'Lovelace',
      email: 'ada@example.com'
    });
    store.setSessionItem(StorageKeys.accessToken, expiredJwt);
    store.setSessionItem(StorageKeys.idToken, idJwt);

    let resolveRefresh!: (value: {
      success: true;
      [StorageKeys.accessToken]: string;
      [StorageKeys.idToken]: string;
    }) => void;
    mockRefreshToken.mockReturnValue(
      new Promise((resolve) => {
        resolveRefresh = resolve;
      })
    );

    const accessPromise = client.getAccessToken();
    await Promise.resolve();
    await Promise.resolve();

    const logoutPromise = client.logout();
    await Promise.resolve();

    resolveRefresh({
      success: true,
      [StorageKeys.accessToken]: freshJwt,
      [StorageKeys.idToken]: idJwt
    });

    const token = await accessPromise;
    await logoutPromise;

    // Refresh result discarded after logout started; local state stays cleared.
    expect(token).toBeUndefined();
    expect(store.getSessionItem(StorageKeys.accessToken)).toBeNull();
    expect(store.getItem(storageMap.user)).toBeNull();
  });

  it('navigates to logout when no refresh is in flight', async () => {
    setWindowLocation('', 'app.example.com');
    mockIsJWTActive.mockReturnValue(true);
    const activeJwt = makeJwt({exp: Math.floor(Date.now() / 1000) + 600});
    store.setSessionItem(StorageKeys.accessToken, activeJwt);
    store.setSessionItem(
      StorageKeys.idToken,
      makeJwt({exp: Math.floor(Date.now() / 1000) + 3600})
    );

    const client = await createKindeClient({
      domain: 'https://auth.example.com',
      redirect_uri: 'http://app.example.com/'
    });

    await client.logout('http://app.example.com/logged-out');

    expect(mockNavigateToKinde).toHaveBeenCalledWith({
      url: 'https://auth.example.com/logout?redirect=http%3A%2F%2Fapp.example.com%2Flogged-out'
    });
    expect(store.getSessionItem(StorageKeys.accessToken)).toBeNull();
  });
});

describe('createKindeClient setStore audience validation', () => {
  const domain = 'https://example.kinde.com';
  const redirectUri = 'http://localhost:3000/';
  const clientId = 'spa@live';
  const audience = 'stake:prod-api';

  const makeValidJwt = (
    payload: Record<string, unknown>,
    header: Record<string, unknown> = {alg: 'RS256', typ: 'JWT'}
  ) => `${b64url(header)}.${b64url(payload)}.x`;

  beforeEach(() => {
    mockSetActiveStorage.mockReset();
    mockCheckAuth.mockClear();
    mockIsJWTActive.mockReturnValue(false);
    mockIsTokenValid.mockImplementation(actualIsTokenValid);
    store.reset();
    Object.defineProperty(global, 'sessionStorage', {
      value: createStorageMock(),
      writable: true,
      configurable: true
    });
    Object.defineProperty(global, 'localStorage', {
      value: createStorageMock(),
      writable: true,
      configurable: true
    });
  });

  afterEach(() => {
    mockIsTokenValid.mockImplementation(() => true);
    mockIsJWTActive.mockReset();
    jest.clearAllMocks();
  });

  it('accepts scalar string aud claims via getToken refresh path', async () => {
    setWindowLocation();
    const ls = global.localStorage as unknown as StorageMock;
    ls.getItem.mockImplementation((key: string) =>
      key === storageMap.refresh_token ? 'rt-in-localstorage' : null
    );

    const now = Math.floor(Date.now() / 1000);
    const freshAccess = makeValidJwt({
      iss: domain,
      azp: clientId,
      aud: audience,
      exp: now + 3600
    });
    const freshId = makeValidJwt({
      iss: domain,
      azp: clientId,
      aud: clientId,
      exp: now + 3600,
      sub: 'user-1'
    });

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        access_token: freshAccess,
        id_token: freshId,
        refresh_token: 'new-refresh-token',
        expires_in: 3600,
        scope: 'openid',
        token_type: 'Bearer'
      })
    });

    const past = now - 120;
    store.setItem(storageMap.token_bundle, {
      access_token: 'old',
      id_token: 'old',
      refresh_token: 'old-rt',
      expires_in: 3600,
      scope: 'openid',
      token_type: 'Bearer'
    });
    store.setItem(storageMap.access_token, {exp: past});

    const client = await createKindeClient({
      domain,
      redirect_uri: redirectUri,
      client_id: clientId,
      audience
    });

    await expect(client.getToken()).resolves.toBe(freshAccess);
  });

  it('accepts array aud claims via getToken refresh path', async () => {
    setWindowLocation();
    const ls = global.localStorage as unknown as StorageMock;
    ls.getItem.mockImplementation((key: string) =>
      key === storageMap.refresh_token ? 'rt-in-localstorage' : null
    );

    const now = Math.floor(Date.now() / 1000);
    const freshAccess = makeValidJwt({
      iss: domain,
      azp: clientId,
      aud: [audience],
      exp: now + 3600
    });
    const freshId = makeValidJwt({
      iss: domain,
      azp: clientId,
      aud: [clientId],
      exp: now + 3600,
      sub: 'user-1'
    });

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        access_token: freshAccess,
        id_token: freshId,
        refresh_token: 'new-refresh-token',
        expires_in: 3600,
        scope: 'openid',
        token_type: 'Bearer'
      })
    });

    const past = now - 120;
    store.setItem(storageMap.token_bundle, {
      access_token: 'old',
      id_token: 'old',
      refresh_token: 'old-rt',
      expires_in: 3600,
      scope: 'openid',
      token_type: 'Bearer'
    });
    store.setItem(storageMap.access_token, {exp: past});

    const client = await createKindeClient({
      domain,
      redirect_uri: redirectUri,
      client_id: clientId,
      audience
    });

    await expect(client.getToken()).resolves.toBe(freshAccess);
  });
});
