const PAYLOAD_CLAIMS = ['iss', 'azp'];
import {isJWTActive} from '..';

const isTokenValid = (token: any, config: any) => {
  if (!token) {
    throw new Error('ID token is required');
  }

  PAYLOAD_CLAIMS.forEach((claim) => {
    if (!token.payload[claim]) {
      throw new Error(`(${claim}) claim is required.`);
    }

    if (token.payload[claim] !== config[claim]) {
      throw new Error(
        `${claim} claim mismatch. Expected: "${config[claim]}", Received: "${token.payload[claim]}"`
      );
    }
  });

  if (token.header.alg !== 'RS256') {
    throw new Error(
      `Unsupported signature alg. Expected: "RS256", Received: "${token.header.alg}"`
    );
  }

  if (config.aud) {
    if (!Array.isArray(token.payload.aud)) {
      throw new Error('(aud) claim must be an array');
    }

    const configAud = config.aud.split(' ');

    const allConfigAudExistInPayload = configAud.every((element: string) =>
      token.payload.aud.includes(element)
    );

    if (!allConfigAudExistInPayload) {
      throw new Error(
        `(aud) claim mismatch. Expected: "${
          config.aud
        }", Received: "${token.payload.aud.join(', ')}"`
      );
    }
  }

  const isJWTExpired = !isJWTActive(token.payload);

  if (isJWTExpired) {
    throw new Error(`Token expired`);
  }

  return true;
};

export {isTokenValid};
