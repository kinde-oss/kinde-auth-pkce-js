import {getUserOrganizationsSync} from '@kinde/js-utils';

// Import to ensure storage adapter is initialized
import '../../state/initStorage';

const getUserOrganizations = (): {orgCodes: string[]} => {
  try {
    const orgCodes = getUserOrganizationsSync() ?? [];
    return {
      orgCodes
    };
  } catch (error) {
    console.error('Error getting user organizations:', error);
    return {orgCodes: []};
  }
};

export {getUserOrganizations};
