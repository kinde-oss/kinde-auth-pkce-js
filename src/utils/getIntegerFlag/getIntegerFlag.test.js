import {getIntegerFlag} from './getIntegerFlag';
import {initializeStore} from '../../testData/initializeStore';

initializeStore();

describe('getIntegerFlag util', () => {
  test('return correct Integer value', () => {
    expect(getIntegerFlag('competitions_limit')).toBe(5);
  });
  test('return value if available even when fallback supplied', () => {
    expect(getIntegerFlag('competitions_limit', 3)).toBe(5);
  });
  test('use default value if flag does not exist', () => {
    expect(getIntegerFlag('team_count', 2)).toBe(2);
  });

  test('error out when flag does not exist and no default provided', () => {
    expect(getIntegerFlag('team_count').message).toBe(
      'Flag team_count was not found, and no default value has been provided'
    );
  });
  test('error out when flag is of wrong type', () => {
    expect(getIntegerFlag('is_dark_mode', false).message).toBe(
      'Flag is_dark_mode is of type boolean - requested type integer'
    );
  });
});
