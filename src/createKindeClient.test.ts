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
    isAuthenticated: jest.fn().mockResolvedValue(false),
    getUserProfile: jest.fn().mockResolvedValue(undefined),
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
  isAuthenticated,
  storageSettings,
  StorageKeys
} from './kindeUtils';
import {store} from './state/store';
import {SESSION_PREFIX, storageMap} from './constants';
import {isJWTActive} from './utils/index';

const mockSetActiveStorage = setActiveStorage as jest.Mock;
const mockCheckAuth = checkAuth as jest.Mock;
const mockExchangeAuthCode = exchangeAuthCode as jest.Mock;
const mockGetUserProfile = getUserProfile as jest.Mock;
const mockIsAuthenticated = isAuthenticated as jest.Mock;
const mockIsJWTActive = isJWTActive as jest.MockedFunction<typeof isJWTActive>;

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
    mockIsAuthenticated.mockReset();
    mockIsAuthenticated.mockResolvedValue(false);
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
    mockIsAuthenticated.mockResolvedValue(true);
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
    mockIsAuthenticated.mockResolvedValue(true);
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
    mockIsAuthenticated.mockResolvedValue(false);

    await createKindeClient({
      domain: 'https://example.kinde.com',
      redirect_uri: 'http://localhost:3000/'
    });

    expect(mockGetUserProfile).not.toHaveBeenCalled();
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
