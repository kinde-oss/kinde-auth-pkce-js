export const isValidJwt = (jwtToken) => {
  const unixTime = Math.floor(Date.now() / 1000);
  return jwtToken.exp > unixTime;
};
