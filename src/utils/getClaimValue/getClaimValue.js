import {getClaim} from '../getClaim/getClaim';

const getClaimValue = (claim, tokenKey = 'access_token') => {
  const obj = getClaim(claim, tokenKey);
  return obj && obj.value;
};

export {getClaimValue};
