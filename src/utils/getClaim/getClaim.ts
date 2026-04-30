import {getClaimSync} from '@kinde/js-utils';
import type {ClaimTokenKey, KindeClaim} from '../../types';

// Import to ensure storage adapter is initialized
import '../../state/initStorage';

export const getClaim = (
  claim: string,
  tokenKey: ClaimTokenKey = 'access_token'
): KindeClaim | null => {
  try {
    // Map our token key format to js-utils format
    const tokenType = tokenKey === 'access_token' ? 'accessToken' : 'idToken';

    // Use the sync version from js-utils
    const result = getClaimSync(claim, tokenType);

    return result ? {name: result.name as string, value: result.value} : null;
  } catch (error) {
    console.error('Error getting claim:', error);
    return null;
  }
};
