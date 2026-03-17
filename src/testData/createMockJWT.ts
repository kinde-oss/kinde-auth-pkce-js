/**
 * Generate a mock JWT string for testing
 * This is NOT cryptographically secure - only for tests!
 */
export const createMockJWT = (payload: Record<string, unknown>): string => {
  const header = {
    alg: 'RS256',
    typ: 'JWT',
    kid: 'test-key-id'
  };

  const base64UrlEncode = (obj: Record<string, unknown>): string => {
    const json = JSON.stringify(obj);
    return Buffer.from(json)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  };

  const headerEncoded = base64UrlEncode(header);
  const payloadEncoded = base64UrlEncode(payload);
  const signature = 'mock-signature-for-testing';

  return `${headerEncoded}.${payloadEncoded}.${signature}`;
};
