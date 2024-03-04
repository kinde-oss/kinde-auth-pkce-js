export const SESSION_PREFIX = 'pkce-code-verifier';

export enum flagDataTypeMap {
  s = 'string',
  i = 'integer',
  b = 'boolean'
}

export enum storageMap {
  token_bundle = 'kinde_token',
  access_token = 'kinde_access_token',
  id_token = 'kinde_id_token',
  user = 'user',
  refresh_token = 'kinde_refresh_token'
}
