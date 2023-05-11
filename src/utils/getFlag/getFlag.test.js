import {getFlag} from './getFlag';
import {initializeStore} from '../../testData/initializeStore';

initializeStore();

describe('getFlag util', () => {
  test('return valid string flag', () => {
    expect(getFlag('theme')).toMatchObject({
      code: 'theme',
      type: 'string',
      value: 'pink',
      is_default: false
    });
  });
  test('return valid boolean flag', () => {
    expect(getFlag('is_dark_mode')).toMatchObject({
      code: 'is_dark_mode',
      type: 'boolean',
      value: true,
      is_default: false
    });
  });
  test('use default value if flag does not exist', () => {
    expect(getFlag('create_competition', false)).toMatchObject({
      code: 'create_competition',
      value: false,
      is_default: true
    });
  });
  const wrap = () => {
    getFlag('competitions_limit', 3, 's');
  };
  test('error out if incorrect type is passed', () => {
    expect(wrap).toThrow(
      'Flag competitions_limit is of type integer - requested type string'
    );
  });
  const wrap2 = () => {
    getFlag('new_feature');
  };
  test('error out if flag does not exist and no default provided', () => {
    expect(wrap2).toThrow(
      'Flag new_feature was not found, and no default value has been provided'
    );
  });
});
