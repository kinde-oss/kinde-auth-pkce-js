import createKindeClient from '../src/main.js';
import {LocalStorageMock} from '../src/mocks/mock-local-storage';

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

const stringContainsAll = (str, subStrArr) => {
  return !subStrArr.some((subStr) => !str.includes(subStr));
};

let kindeClient = null;
let redirect_uri = 'https://pixie.localtest.me';

beforeEach(async () => {
  localStorage.clear();

  delete window.location;
  window.location = new URL('https://example.org');

  kindeClient = await createKindeClient({
    domain: 'https://sdk.kinde.localtest.me',
    redirect_uri
  });
});

describe('createKindeClient -> login', () => {
  it('should redirect to the correct url', async () => {
    expect.assertions(1);
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
    expect.assertions(1);
    await kindeClient.logout();
    expect(window.location).toBe(redirect_uri);
  });
});

describe('createKindeClient -> register', () => {
  it('should redirect to the correct url', async () => {
    expect.assertions(1);
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

describe('createKindeClient -> getToken', () => {
  it('should work', async () => {
    expect.assertions(1);

    localStorage.setItem(
      'kinde_token',
      JSON.stringify({refresh_token: 'refresh_token'})
    );

    expect(await kindeClient.getToken()).toBe(
      'eyJhbGciOiJSUzI1NiIsImtpZCI6IjQ1OjllOmQwOjljOjE5OjA0OjRiOjRmOjI0OjE4OmZkOmI2OjE4OjQyOjA2OjMzIiwidHlwIjoiSldUIn0.eyJhdWQiOltdLCJleHAiOjE2NDc4NDM4MTUsImlhdCI6MTY0Nzg0MDIxNSwiaXNzIjoiaHR0cHM6Ly9zZGsua2luZGUubG9jYWx0ZXN0Lm1lIiwianRpIjoiOTUwNzYzM2UtYjgxNy00MGJlLWI1OTktMTI0MGQ2NWEzOWFkIiwibmJmIjoxNjQ3ODQwMjE1LCJzY3AiOlsib3BlbmlkIiwib2ZmbGluZSJdLCJzdWIiOiJrcDphZjIzYzkxZjFhYjk0NDFiOTZmN2QzNTg1ODBhMzY2YyJ9.OlD35Js81j6-J6xyusnKSPWR0U72Qh3g9bP1PBm7MPstFdmN755Z2a-9cP-Ve__tdxrf6_K6SbjvsTj4_Mhp6s34uHj2qagI6YJ_wmhH8Vvw5hRqQAKiXjcjPLKeDwjKtX9MhLN6e_XYSL_8OZK_uRs8v3K9J1RcMxK-6O5DiZd4lgdExO-vz90YK9p9ZrW1Sv30DmDGHX6Ylof1sDb_4HI44hkou17asfJ-wGMPihyelC9QRdRT_hhfN43DH4tiBpux2h--rHSeji_MphNAhJJutu4hs_PfABHjE-7BNcpPaO6KcmtT3vy38_Ls_MiWe62w5TZKhY0O0w1XrCLT9Q'
    );
  });

  it('returns undefined when there is no refresh_token', async () => {
    expect.assertions(1);

    expect(await kindeClient.getToken()).toBe(undefined);
  });
});

describe('createKindeClient -> getUser', () => {
  it('should work', async () => {
    expect.assertions(1);

    localStorage.setItem(
      'kinde_token',
      JSON.stringify({
        access_token: 'access_token'
      })
    );

    expect(await kindeClient.getUser()).toStrictEqual({
      id: 'kp:af23c91f1ab9441b96f7d358580a366c',
      last_name: null,
      first_name: 'EssDee Kay',
      preferred_email: 'peterphanouvong0+sdk@gmail.com'
    });
  });

  it('returns undefined when there is no access_token', async () => {
    expect.assertions(1);
    expect(await kindeClient.getUser()).toBe(undefined);
  });
});

describe('createKindeClient -> handleRedirectCallback', () => {});
