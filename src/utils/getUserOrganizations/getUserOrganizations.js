import {getClaimValue} from '../getClaimValue/getClaimValue';

const getUserOrganizations = () => {
  const orgCodes = getClaimValue('org_codes', 'id_token');
  return {
    orgCodes
  };
};

export {getUserOrganizations};
