import {JWT} from './isValidJwt.types';

export const isValidJwt = (jwtToken: JWT): boolean => {
  const unixTime = Math.floor(Date.now() / 1000);
  return jwtToken.exp > unixTime;
};
