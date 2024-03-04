import {initializeStore} from '../../testData/initializeStore';
import {accessTokenStub} from '../../testData/accessTokenStub';
import type {JWT} from './isJWTActive.types';
import {isJWTActive} from './isJWTActive';
import {store} from '../../state/store';

describe('isJWTActive util', () => {
  beforeEach(() => initializeStore());

  test('returns false if provided token is expired', () => {
    const expiredToken = {...accessTokenStub, exp: 949363200};
    expect(isJWTActive(expiredToken)).toBe(false);
  });

  test('return true if provided token is not expired', () => {
    const unexpiredToken = store.getItem('kinde_access_token') as JWT;
    expect(isJWTActive(unexpiredToken)).toBe(true);
  });
});
