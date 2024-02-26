import {JWT} from './isJWTActive.types';

export const isJWTActive = (jwtToken: JWT): boolean => {
  const unixTime = Math.floor(Date.now() / 1000);
  return jwtToken.exp > unixTime;
};
