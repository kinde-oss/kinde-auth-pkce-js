import {getClaim} from '../getClaim/getClaim';
import type {TokenKey} from '../getClaim/getClaim.types';

const getClaimValue = (
  claim: string,
  tokenKey: TokenKey = 'access_token'
): unknown => {
  const obj = getClaim(claim, tokenKey);
  return obj && obj.value;
};

export {getClaimValue};
