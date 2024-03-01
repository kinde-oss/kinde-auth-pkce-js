const isCustomDomain = (url: string) => {
  const domain = new URL(url);
  const bareDomain = domain.hostname.split('.').slice(-2).join('.');
  return bareDomain !== 'kinde.com';
};

export {isCustomDomain};
