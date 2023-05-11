import {getBooleanFlag} from './getBooleanFlag';
import {initializeStore} from '../../testData/initializeStore';

initializeStore();

describe('getBooleanFlag util', () => {
  test('return true for flags which are true', () => {
    expect(getBooleanFlag('is_dark_mode')).toBe(true);
  });
  test('return true for flags which are true when false fallback supplied', () => {
    expect(getBooleanFlag('is_dark_mode', false)).toBe(true);
  });
  test('use default value if flag does not exist', () => {
    expect(getBooleanFlag('new_feature', false)).toBe(false);
  });

  test('error out when flag does not exist and no default provided', () => {
    expect(getBooleanFlag('new_feature').message).toBe(
      'Flag new_feature was not found, and no default value has been provided'
    );
  });
  test('error out when flag is of wrong type', () => {
    expect(getBooleanFlag('theme', false).message).toBe(
      'Flag theme is of type string - requested type boolean'
    );
  });
});
