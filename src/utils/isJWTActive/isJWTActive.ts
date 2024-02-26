import {JWT} from './isJWTActive.types';

const LEEWAY = 60;

export const isJWTActive = (jwtToken: JWT): boolean => {
  const unixTime = Math.floor(Date.now() / 1000);
  return jwtToken.exp + LEEWAY > unixTime;
};
