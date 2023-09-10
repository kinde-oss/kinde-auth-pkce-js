import {store} from '../../state/store';
import type { KindeClaim } from '../../types';
import type { TokenKey } from './getClaim.types';

export const getClaim = (
  claim: string, 
  tokenKey: TokenKey = 'access_token'
): KindeClaim | null=> {
  const token = store.getItem(`kinde_${tokenKey}`) as { [key: string]: unknown };
  return token ? {name: claim, value: token[claim]} : null;
};
