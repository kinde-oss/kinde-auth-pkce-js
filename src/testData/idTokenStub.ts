const nowInSeconds = Math.floor(Date.now() / 1000);

const idTokenStub = {
  at_hash: '-p1234',
  aud: ['https://account.acme.com', '123456789'],
  auth_time: nowInSeconds - 60,
  azp: '123456789',
  email: 'jaime@lannister.com',
  exp: nowInSeconds + 60 * 60,
  family_name: 'Lannister',
  given_name: 'Jaime',
  iat: nowInSeconds - 60,
  iss: 'https://account.acme.com',
  jti: '123-1-1-123-1234',
  name: 'Jaime Lannister',
  org_codes: ['org_1235', 'org_7890'],
  picture: 'https://some-image.com',
  provided_id: '1',
  sub: 'kp:123456',
  updated_at: 1683631328
};

export {idTokenStub};
