import {getStringFlag} from './getStringFlag';
import {initializeStore} from '../../testData/initializeStore';

initializeStore();

describe('getStringFlag util', () => {
  test('return correct string value', () => {
    expect(getStringFlag('theme')).toBe('pink');
  });
  test('return value if available even when fallback supplied', () => {
    expect(getStringFlag('theme', 'orange')).toBe('pink');
  });
  test('use default value if flag does not exist', () => {
    expect(getStringFlag('cta_color', 'blue')).toBe('blue');
  });

  test('error out when flag does not exist and no default provided', () => {
    expect(getStringFlag('cta_color').message).toBe(
      'Flag cta_color was not found, and no default value has been provided'
    );
  });
  test('error out when flag is of wrong type', () => {
    expect(getStringFlag('is_dark_mode', false).message).toBe(
      'Flag is_dark_mode is of type boolean - requested type string'
    );
  });
});
