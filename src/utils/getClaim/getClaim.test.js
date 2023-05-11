import {getClaim} from './getClaim';
import {initializeStore} from '../../testData/initializeStore';

initializeStore();

describe('getClaim util', () => {
  test('default to access token', () => {
    expect(getClaim('jti')).toMatchObject({
      name: 'jti',
      value: '1234-12-12-12-123456'
    });
  });

  test('get correct iss claim', () => {
    expect(getClaim('iss')).toMatchObject({
      name: 'iss',
      value: 'https://app.acme.com'
    });
  });

  test('get correct azp claim', () => {
    expect(getClaim('azp')).toMatchObject({
      name: 'azp',
      value: '1234567890'
    });
  });

  test('get items from id token', () => {
    expect(getClaim('email', 'id_token')).toMatchObject({
      name: 'email',
      value: 'jaime@lannister.com'
    });
  });
});
