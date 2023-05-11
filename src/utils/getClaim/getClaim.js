import {store} from '../../state/store';

export const getClaim = (claim, tokenKey = 'access_token') => {
  const token = store.getItem(`kinde_${tokenKey}`);
  return token ? {name: claim, value: token[claim]} : null;
};
