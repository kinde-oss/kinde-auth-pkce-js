const accessTokenStub = {
  aud: ['stake:prod-api'],
  azp: '1234567890',
  exp: 1772323199,
  feature_flags: {
    theme: {
      t: 's',
      v: 'pink'
    },
    is_dark_mode: {
      t: 'b',
      v: true
    },
    competitions_limit: {
      t: 'i',
      v: 5
    }
  },
  iat: 123456789,
  iss: 'https://app.acme.com',
  jti: '1234-12-12-12-123456',
  org_code: 'org_1234567890',
  permissions: [
    'create:competitions',
    'delete:competitions',
    'view:stats',
    'invite:users'
  ],
  scp: ['openid', 'profile', 'email', 'offline'],
  sub: 'kp:1234567654345678'
};

export {accessTokenStub};
