import {isCustomDomain} from './isCustomDomain';

describe('isCustomDomain', () => {
  it('should return true for custom domains', () => {
    expect(isCustomDomain('https://custom.domain.com')).toBe(true);
  });

  it('should return true for custom domains with multiple subdomains', () => {
    expect(isCustomDomain('https://auth.custom.domain.com')).toBe(true);
  });

  it('should return false for Kinde naked domain', () => {
    expect(isCustomDomain('https://kinde.com')).toBe(false);
  });

  it('should return false for Kinde domains', () => {
    expect(isCustomDomain('https://myapp.kinde.com')).toBe(false);
  });
});
