import {idTokenStub} from '../../testData/idTokenStub';
import {isTokenValid} from './isTokenValid';

const config = {
  iss: 'https://account.acme.com',
  aud: 'https://account.acme.com 123456789',
  azp: '123456789'
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
          payload: {...idTokenStub}
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
          payload: {...idTokenStub}
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
          payload: {...idTokenStub, iss: null}
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
          payload: {...idTokenStub, iss: 'mate'}
        },
        config
      );
    }).toThrow(
      `iss claim mismatch. Expected: "https://account.acme.com", Received: "mate"`
    );
  });

  test('Throw error with missing azp', () => {
    expect(() => {
      isTokenValid(
        {
          header,
          payload: {...idTokenStub, azp: null}
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
          payload: {...idTokenStub, azp: 'mate'}
        },
        config
      );
    }).toThrow(`azp claim mismatch. Expected: "123456789", Received: "mate"`);
  });

  test('Throw error if aud is not an array', () => {
    expect(() => {
      isTokenValid(
        {
          header,
          payload: {...idTokenStub, aud: 'mate'}
        },
        config
      );
    }).toThrow(`(aud) claim must be an array`);
  });

  test('Throw error with incorrect aud', () => {
    expect(() => {
      isTokenValid(
        {
          header,
          payload: {...idTokenStub, aud: ['mate']}
        },
        config
      );
    }).toThrow(
      `(aud) claim mismatch. Expected: "https://account.acme.com 123456789", Received: "mate"`
    );
  });

  test("Extra aud values don't throw", () => {
    expect(
      isTokenValid(
        {
          header,
          payload: {
            ...idTokenStub,
            aud: ['https://account.acme.com', '123456789']
          }
        },
        config
      )
    ).toBe(true);
  });

  test('Throw error if token expired', () => {
    expect(() => {
      isTokenValid(
        {
          header,
          payload: {...idTokenStub, exp: 1683697108}
        },
        config
      );
    }).toThrow(`Token expired`);
  });
});
