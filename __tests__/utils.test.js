import {base64UrlEncode} from '../src/utils/base64UrlEncode/base64UrlEncode';
import {sha256} from '../src/utils/sha256/sha256';
import {TextEncoder, TextDecoder} from 'util';
import crypto from 'crypto';
import {randomString} from '../src/utils/randomString/randomString';
import {pkceChallengeFromVerifier} from '../src/utils/pkceChallengeFromVerifier/pkceChallengeFromVerifier';

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

function bufferEqual(buf1, buf2) {
  if (buf1.byteLength != buf2.byteLength) return false;
  var dv1 = new Int8Array(buf1);
  var dv2 = new Int8Array(buf2);
  for (var i = 0; i != buf1.byteLength; i++) {
    if (dv1[i] != dv2[i]) return false;
  }
  return true;
}
describe('sha256', () => {
  it('should return the correct value given an input', async () => {
    const helloBuffer = new Uint8Array([
      44, 242, 77, 186, 95, 176, 163, 14, 38, 232, 59, 42, 197, 185, 226, 158,
      27, 22, 30, 92, 31, 167, 66, 94, 115, 4, 51, 98, 147, 139, 152, 36
    ]).buffer;

    const shaBuffer = await sha256('hello');

    expect(bufferEqual(helloBuffer, shaBuffer)).toBe(true);
  });
});

describe('base64UrlEncode', () => {
  it('should return the correct value given an input', async () => {
    const helloBuffer = new Uint8Array([
      44, 242, 77, 186, 95, 176, 163, 14, 38, 232, 59, 42, 197, 185, 226, 158,
      27, 22, 30, 92, 31, 167, 66, 94, 115, 4, 51, 98, 147, 139, 152, 36
    ]).buffer;

    expect(base64UrlEncode(helloBuffer)).toBe(
      'LPJNul-wow4m6DsqxbninhsWHlwfp0JecwQzYpOLmCQ'
    );
  });
});

describe('randomString', () => {
  it('should return a string', () => {
    expect(randomString()).toStrictEqual(expect.any(String));
  });

  it('should return a string of length 56', () => {
    expect(randomString().length).toBe(56);
  });
});

describe('PKCE Challenge', () => {
  it('should return the correct value give an input', async () => {
    expect(await pkceChallengeFromVerifier('hello')).toBe(
      'LPJNul-wow4m6DsqxbninhsWHlwfp0JecwQzYpOLmCQ'
    );
  });
});
