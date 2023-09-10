import {initializeStore} from '../../testData/initializeStore';
import {accessTokenStub} from '../../testData/accessTokenStub';
import {isValidJwt} from './isValidJwt';
import {store} from '../../state/store';

describe('isValidJwt util', () => {
  beforeEach(() => initializeStore());

  test('returns false if provided token is expired', () => {
    const expiredToken = store.getItem('kinde_access_token') as { exp: number };
    expect(isValidJwt(expiredToken)).toBe(false);
  });

  test('return true if provided token is not expired', () => {
    const exp = Date.now() + 1000;
    const unexpiredToken = {...accessTokenStub, exp};
    expect(isValidJwt(unexpiredToken)).toBe(true);
  });
});
