import {getClaimValue} from '../getClaimValue/getClaimValue';

const getUserOrganizations = (): {orgCodes: string[]} => {
  const orgCodes = (getClaimValue('org_codes', 'id_token') ?? []) as string[];
  return {
    orgCodes
  };
};

export {getUserOrganizations};
