import {accessTokenStub} from '../../testData/accessTokenStub';
import {isTokenValid} from './isTokenValid';

const config = {
  iss: 'https://app.acme.com',
  aud: 'stake:prod-api',
  azp: '1234567890'
};

const header = {
  typ: 'JWT',
  alg: 'RS256'
};

describe('isIDToken valid', () => {
  test('Throw error if token not provided', () => {
    expect(
      isTokenValid(
        {
          header,
          payload: {...accessTokenStub}
        },
        config
      )
    ).toBe(true);
  });

  test('Throw error with invalid alg', () => {
    expect(() => {
      isTokenValid(
        {
          header: {typ: 'blah', alg: 'HS256'},
          payload: {...accessTokenStub}
        },
        config
      );
    }).toThrow(
      `Unsupported signature alg. Expected: "RS256", Received: "HS256"`
    );
  });

  test('Throw error with missing iss', () => {
    expect(() => {
      isTokenValid(
        {
          header,
          payload: {...accessTokenStub, iss: null}
        },
        config
      );
    }).toThrow(`(iss) claim is required.`);
  });

  test('Throw error with incorrect iss', () => {
    expect(() => {
      isTokenValid(
        {
          header,
          payload: {...accessTokenStub, iss: 'mate'}
        },
        config
      );
    }).toThrow(
      `iss claim mismatch. Expected: "https://app.acme.com", Received: "mate"`
    );
  });

  test('Throw error with missing azp', () => {
    expect(() => {
      isTokenValid(
        {
          header,
          payload: {...accessTokenStub, azp: null}
        },
        config
      );
    }).toThrow(`(azp) claim is required.`);
  });

  test('Throw error with incorrect azp', () => {
    expect(() => {
      isTokenValid(
        {
          header,
          payload: {...accessTokenStub, azp: 'mate'}
        },
        config
      );
    }).toThrow(`azp claim mismatch. Expected: "1234567890", Received: "mate"`);
  });

  test('Throw error if aud is not an array', () => {
    expect(() => {
      isTokenValid(
        {
          header,
          payload: {...accessTokenStub, aud: 'mate'}
        },
        config
      );
    }).toThrow(`(aud) claim must be an array`);
  });

  test('Still pass if aud is undefined', () => {
    expect(
      isTokenValid(
        {
          header,
          payload: {...accessTokenStub}
        },
        {...config, aud: undefined}
      )
    ).toBe(true);
  });

  test('Throw error with incorrect aud', () => {
    expect(() => {
      isTokenValid(
        {
          header,
          payload: {...accessTokenStub, aud: ['mate']}
        },
        config
      );
    }).toThrow(
      `(aud) claim mismatch. Expected: "stake:prod-api", Received: "mate"`
    );
  });

  test('Throw error if token expired', () => {
    expect(() => {
      isTokenValid(
        {
          header,
          payload: {...accessTokenStub, exp: 1683697108}
        },
        config
      );
    }).toThrow(`Token expired`);
  });
});
