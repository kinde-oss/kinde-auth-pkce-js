const PAYLOAD_CLAIMS = ['iss', 'azp'] as const;
import {isJWTActive} from '../isJWTActive/isJWTActive';
import type {JWT} from '../isJWTActive/isJWTActive.types';

type TokenHeader = {
  alg?: string;
  typ?: string;
};

type TokenPayload = {
  iss?: string | null;
  azp?: string | null;
  aud?: string | string[] | null;
  exp?: number;
};

type TokenConfig = {
  iss?: string;
  azp?: string;
  aud?: string;
};

type DecodedToken = {
  header: TokenHeader;
  payload: TokenPayload;
};

const isTokenValid = (token: DecodedToken, config: TokenConfig) => {
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
    const audience = token.payload.aud;
    if (!Array.isArray(audience)) {
      throw new Error('(aud) claim must be an array');
    }

    const configAud = config.aud.split(' ');

    const allConfigAudExistInPayload = configAud.every((element: string) =>
      audience.includes(element)
    );

    if (!allConfigAudExistInPayload) {
      throw new Error(
        `(aud) claim mismatch. Expected: "${
          config.aud
        }", Received: "${audience.join(', ')}"`
      );
    }
  }

  const isJWTExpired = !isJWTActive(token.payload as JWT);

  if (isJWTExpired) {
    throw new Error(`Token expired`);
  }

  return true;
};

export {isTokenValid};
