import createKindeClient from '../src/main.js';
import {LocalStorageMock} from '../mocks/mock-local-storage';

import {TextEncoder, TextDecoder} from 'util';
import crypto from 'crypto';

// eslint-disable-next-line no-undef
global.TextEncoder = TextEncoder;
// eslint-disable-next-line no-undef
global.TextDecoder = TextDecoder;
// eslint-disable-next-line no-undef
global.localStorage = new LocalStorageMock();
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

Object.defineProperty(window, 'sessionStorage', {
  value: new LocalStorageMock()
});

const stringContainsAll = (str, subStrArr) => {
  return !subStrArr.some((subStr) => !str.includes(subStr));
};

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

    expect(
      stringContainsAll(window.location.href, [
        'https://sdk.kinde.localtest.me/oauth2/auth?',
        'start_page=login',
        'redirect_uri=',
        'client_id=',
        'response_type=',
        'scope=',
        'code_challenge=',
        'code_challenge_method=',
        'state='
      ])
    ).toBe(true);
  });
});

describe('createKindeClient -> logout', () => {
  it('should redirect to the correct url', async () => {
    await kindeClient.logout();
    expect(window.location).toBe(redirect_uri);
  });
});

describe('createKindeClient -> register', () => {
  it('should redirect to the correct url', async () => {
    await kindeClient.register();
    expect(
      stringContainsAll(window.location.href, [
        'https://sdk.kinde.localtest.me/oauth2/auth?',
        'start_page=registration',
        'redirect_uri=',
        'client_id=',
        'response_type=',
        'scope=',
        'code_challenge=',
        'code_challenge_method=',
        'state='
      ])
    ).toBe(true);
  });
});

// describe('createKindeClient -> getToken', () => {
//   it('should work', async () => {
//     const res = {
//       access_token: 'sup'
//     };

//     localStorage.setItem(
//       'kinde_token',
//       JSON.stringify({refresh_token: 'hello'})
//     );

//     // eslint-disable-next-line no-undef
//     global.fetch = jest.fn(() => {
//       Promise.resolve({
//         json: () => Promise.resolve(res)
//       });
//     });

//     expect(await kindeClient.getToken()).toBe('sup');
//   });
// });
describe('createKindeClient -> getUser', () => {
  it('should work', async () => {
    const res = {
      id: 'kp:af23c91f1ab9441b96f7d358580a366c',
      last_name: null,
      first_name: 'EssDee Kay',
      preferred_email: 'peterphanouvong0+sdk@gmail.com'
    };

    // eslint-disable-next-line no-undef
    global.fetch = jest.fn(() =>
      Promise.resolve({
        json: () => Promise.resolve(res)
      })
    );

    localStorage.setItem(
      'kinde_token',
      JSON.stringify({
        access_token: 'jello'
      })
    );

    expect(await kindeClient.getUser()).toBe(res);
  });
});
describe('createKindeClient -> handleRedirectCallback', () => {});
