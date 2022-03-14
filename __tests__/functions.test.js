import createKindeClient from '../src/main.js';
import {LocalStorageMock} from '../mocks/mock-local-storage';

import {TextEncoder, TextDecoder} from 'util';
import crypto from 'crypto';

// eslint-disable-next-line no-undef
global.TextEncoder = TextEncoder;
// eslint-disable-next-line no-undef
global.TextDecoder = TextDecoder;
// eslint-disable-next-line no-undef
Object.defineProperty(global.self, 'crypto', {
  value: {
    subtle: crypto.webcrypto.subtle,
    getRandomValues: crypto.webcrypto.getRandomValues
  }
});

Object.defineProperty(window, 'sessionStorage', {
  value: new LocalStorageMock()
});

let kindeClient = null;
let redirect_uri = 'https://pixie.localtest.me';

beforeEach(async () => {
  delete window.location;
  window.location = new URL('https://example.org');

  kindeClient = await createKindeClient({
    domain: 'https://sdk.kinde.localtest.me',
    redirect_uri
  });
});

describe('createKindeClient -> login', () => {
  it('should redirect to the correct url', async () => {
    await kindeClient.login();

    expect(window.location.href).toStrictEqual(
      expect.stringContaining('https://sdk.kinde.localtest.me/oauth2/auth?')
    );

    expect(window.location.href).toStrictEqual(
      expect.stringContaining('start_page=login')
    );

    expect(window.location.href).toStrictEqual(
      expect.stringContaining('redirect_uri=')
    );

    expect(window.location.href).toStrictEqual(
      expect.stringContaining('client_id=')
    );

    expect(window.location.href).toStrictEqual(
      expect.stringContaining('response_type=')
    );

    expect(window.location.href).toStrictEqual(
      expect.stringContaining('scope=')
    );

    expect(window.location.href).toStrictEqual(
      expect.stringContaining('code_challenge=')
    );

    expect(window.location.href).toStrictEqual(
      expect.stringContaining('code_challenge_method=')
    );

    expect(window.location.href).toStrictEqual(
      expect.stringContaining('state=')
    );
  });
});

describe('createKindeClient -> logout', () => {
  it('should redirect to the correct url', async () => {
    await kindeClient.logout();
    expect(window.location).toBe(redirect_uri);
  });
});
