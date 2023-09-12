import {store} from '../../state/store';
import type {ClaimTokenKey, KindeClaim} from '../../types';

export const getClaim = (
  claim: string,
  tokenKey: ClaimTokenKey = 'access_token'
): KindeClaim | null => {
  const token = store.getItem(`kinde_${tokenKey}`) as {[key: string]: unknown};
  return token ? {name: claim, value: token[claim]} : null;
};
