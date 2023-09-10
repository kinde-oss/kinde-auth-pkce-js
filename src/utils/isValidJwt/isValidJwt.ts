export const isValidJwt = (jwtToken: {exp: number}): boolean => {
  const unixTime = Math.floor(Date.now() / 1000);
  return jwtToken.exp > unixTime;
};
