import {getUserOrganizations} from './getUserOrganizations';
import {initializeStore} from '../../testData/initializeStore';

initializeStore();

describe('getUserOrganizations util', () => {
  test('return correct organizations', () => {
    expect(getUserOrganizations()).toMatchObject({
      orgCodes: ['org_1235', 'org_7890']
    });
  });
});
