import {JWT} from './isJWTActive.types';

// Early expiraton in seconds
const EARLY_EXPIRATION = 30;

export const isJWTActive = (jwtToken: JWT): boolean => {
  const unixTime = Math.floor(Date.now() / 1000);
  return jwtToken.exp - EARLY_EXPIRATION > unixTime;
};
