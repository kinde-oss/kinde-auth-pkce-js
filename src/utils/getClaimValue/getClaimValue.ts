import {getClaim} from '../getClaim/getClaim';
import type {ClaimTokenKey} from '../../types';

const getClaimValue = (
  claim: string,
  tokenKey: ClaimTokenKey = 'access_token'
): unknown => {
  const obj = getClaim(claim, tokenKey);
  return obj && obj.value;
};

export {getClaimValue};
