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

jest.mock('@kinde/js-utils', () => {
  const actual =
    jest.requireActual<typeof import('@kinde/js-utils')>('@kinde/js-utils');
  return {
    ...actual,
    generatePortalUrl: jest.fn(),
    setActiveStorage: jest.fn(),
    setInsecureStorage: jest.fn(),
    checkAuth: jest.fn().mockResolvedValue({success: false}),
    navigateToKinde: jest.fn().mockImplementation((opts: {url: string}) => {
      (global as typeof globalThis & {location: {href: string}}).location.href =
        opts.url;
    })
  };
});

import createKindeClient from './createKindeClient';
import {setActiveStorage} from '@kinde/js-utils';

const mockSetActiveStorage = setActiveStorage as jest.Mock;

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

const setWindowLocation = (search = '') => {
  const location = {
    href: `http://localhost:3000/${search}`,
    search,
    hostname: 'localhost',
    pathname: '/',
    protocol: 'http:',
    host: 'localhost:3000',
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
