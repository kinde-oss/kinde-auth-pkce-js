import {getClaimSync} from '@kinde/js-utils';
import type {ClaimTokenKey} from '../../types';

// Import to ensure storage adapter is initialized
import '../../state/initStorage';

const getClaimValue = (
  claim: string,
  tokenKey: ClaimTokenKey = 'access_token'
): unknown => {
  try {
    // Map our token key format to js-utils format
    const tokenType = tokenKey === 'access_token' ? 'accessToken' : 'idToken';

    // Use the sync version from js-utils
    const result = getClaimSync(claim, tokenType);

    return result?.value ?? null;
  } catch (error) {
    console.error('Error getting claim value:', error);
    return null;
  }
};

export {getClaimValue};
