export type KindeUser = {
  given_name: string | null;
  id: string | null;
  family_name: string | null;
  email: string | null;
  picture: string | null;
};

export type KindeState = {
  access_token: string;
  expires_in: number;
  id_token: string;
  refresh_token: string;
  scope: string;
  token_type: string;
};

export type KindeClientOptions = {
  audience?: string;
  client_id?: string;
  redirect_uri: string;
  domain: string;
  is_dangerously_use_local_storage?: boolean;
  logout_uri?: string;
  on_redirect_callback?: (user: KindeUser, appState?: object) => void;
  scope?: string;
  proxy_redirect_uri?: string;
  _framework?: string;
  _frameworkVersion?: string;
};

export type ClaimTokenKey = 'access_token' | 'id_token';

export type KindeClaim = {
  name: string;
  value: unknown;
};

export type KindePermissions = {
  permissions: string[];
  orgCode: string;
};

export type KindePermission = {
  isGranted: boolean;
  orgCode: string;
};

export type KindeFlagValueType = {
  s: string;
  i: number;
  b: boolean;
};

export type KindeFlagTypeString = {
  s: 'string';
  i: 'integer';
  b: 'boolean';
};

export type KindeFlagTypeCode = 'b' | 'i' | 's';

export type KindeFlagTypeValue = 'boolean' | 'integer' | 'string';

export type KindeFlag<T extends KindeFlagTypeCode> = {
  code: string;
  type: KindeFlagTypeString[T] | null;
  value: KindeFlagValueType[T];
  is_default: boolean;
};

export type KindeOrganization = {
  orgCode: string;
};

export type KindeOrganizations = {
  orgCodes: string[];
};

export type OrgOptions = {
  org_name?: string;
  app_state?: object;
};

export type AuthOptions = {
  org_code?: string;
  app_state?: object;
  authUrlParams?: object;
};

export type RedirectOptions = OrgOptions &
  AuthOptions & {
    start_page?: string;
    is_create_org?: boolean;
  };

export type KindeClient = {
  getToken: () => Promise<string | undefined>;
  getIdToken: () => Promise<string | undefined>;
  isAuthenticated: () => Promise<boolean>;
  getUser: () => KindeUser;
  getUserProfile: () => Promise<KindeUser | undefined>;
  login: (options?: AuthOptions) => Promise<void>;
  logout: () => Promise<void>;
  register: (options?: AuthOptions) => Promise<void>;
  createOrg: (options?: OrgOptions) => Promise<void>;
  getClaim: (claim: string, tokenKey?: ClaimTokenKey) => KindeClaim | null;
  getFlag: <T extends KindeFlagTypeCode>(
    code: string,
    defaultValue?: KindeFlagValueType[T],
    flagType?: T
  ) => KindeFlag<T>;
  getBooleanFlag: (code: string, defaultValue?: boolean) => boolean | Error;
  getStringFlag: (code: string, defaultValue: string) => string | Error;
  getIntegerFlag: (code: string, defaultValue: number) => number | Error;
  getPermissions: () => KindePermissions;
  getPermission: (key: string) => KindePermission;
  getOrganization: () => KindeOrganization;
  getUserOrganizations: () => KindeOrganizations;
};
