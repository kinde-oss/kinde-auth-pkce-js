import {getClaimValue} from './getClaimValue';
import {initializeStore} from '../../testData/initializeStore';

initializeStore();

describe('getClaimValue util', () => {
  test('default to access token', () => {
    expect(getClaimValue('jti')).toBe('1234-12-12-12-123456');
  });
  test('get correct iss claim', () => {
    expect(getClaimValue('iss')).toBe('https://app.acme.com');
  });
});
