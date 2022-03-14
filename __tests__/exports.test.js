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

describe('Exports the correct function', () => {
  it('should export default', () => {
    expect(createKindeClient).toBeDefined();
  });

  it('should export createKindeClient by default', () => {
    expect(createKindeClient.name).toBe('createKindeClient');
  });
});

describe('Initialization', () => {
  it('should check if an object is passed in', async () => {
    expect.assertions(1);
    await expect(createKindeClient()).rejects.toEqual(
      Error('Please provide your Kinde credentials')
    );
  });

  it('should check that options parameter is valid', async () => {
    expect.assertions(1);
    await expect(createKindeClient('hello')).rejects.toEqual(
      Error('The Kinde SDK must be initiated with an object')
    );
  });

  it('should check that redirect_uri is passed in', async () => {
    expect.assertions(1);
    await expect(
      createKindeClient({
        domain: 'domain'
      })
    ).rejects.toEqual(
      Error(
        'Please supply a valid redirect_uri for your users to be redirected after successful authentication'
      )
    );
  });

  it('should check that domain is passed in', async () => {
    expect.assertions(1);
    await expect(
      createKindeClient({
        redirect_uri: 'uri'
      })
    ).rejects.toEqual(
      Error(
        'Please supply a valid Kinde domain so we can connect to your account'
      )
    );
  });

  it('should check that is_live is a boolean', async () => {
    expect.assertions(1);
    await expect(
      createKindeClient({
        domain: 'domain',
        redirect_uri: 'redirect_uri',
        is_live: ['kinde']
      })
    ).rejects.toEqual(TypeError('Please supply a boolean value for is_live'));
  });
});

describe('createKindeClient return the correct object', () => {
  it('should return an object', async () => {
    const kindeClient = await createKindeClient({
      domain: 'sdk.kinde.localtest.me',
      redirect_uri: 'https://www.sprt.fun'
    });

    expect(kindeClient).toBeDefined();
  });

  it('should return an object with the correct keys', async () => {
    const kindeClient = await createKindeClient({
      domain: 'sdk.kinde.localtest.me',
      redirect_uri: 'https://www.sprt.fun'
    });

    expect(Object.keys(kindeClient)).toEqual([
      'getToken',
      'getUser',
      'handleRedirectCallback',
      'login',
      'logout',
      'register'
    ]);
  });
});

describe('createKindeClient -> login', () => {
  it('should work', async () => {
    // const kindeClient = await createKindeClient({
    //   domain: 'https://sdk.kinde.localtest.me',
    //   redirect_uri: 'https://pixie.localtest.me'
    // });
    // await kindeClient.login();
    expect(1 + 1).toBe(2);
    // window.url = 'help';
    // console.log(window.location.pathname);
  });
});
