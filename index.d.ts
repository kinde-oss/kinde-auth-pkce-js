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
  on_redirect_callback?: (user: KindeUser, appState?: any) => void;
  scope?: string;
  _framework?: string;
  _frameworkVersion?: string;
};

export type KindePermissions = {
  permissions: string[];
  orgCode: string;
};

export type KindePermission = {
  isGranted: boolean;
  orgCode: string;
};

export type KindeFlagTypeCode = 'b' | 'i' | 's';

export type KindeFlagTypeValue = 'boolean' | 'integer' | 'string';

export type KindeFlag = {
  code: string;
  type: KindeFlagTypeValue | null;
  value: string | boolean | number;
  defaultValue?: string | boolean | number;
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
};

export type KindeClient = {
  getToken: () => Promise<string | undefined>;
  isAuthenticated: () => Promise<boolean>;
  getUser: () => KindeUser;
  getUserProfile: () => Promise<KindeUser>;
  login: (options: AuthOptions) => Promise<void>;
  logout: () => Promise<void>;
  register: (options: AuthOptions) => Promise<void>;
  createOrg: (options: OrgOptions) => Promise<void>;
  getClaim: (claim: string, tokenKey?: string) => any;
  getFlag: (
    code: string,
    defaultValue?: string | boolean | number,
    flagType?: KindeFlagTypeCode
  ) => KindeFlag;
  getBooleanFlag: (code: string, defaultValue?: boolean) => boolean;
  getStringFlag: (code, defaultValue) => string;
  getIntegerFlag: (code, defaultValue) => number;
  getPermissions: () => KindePermissions;
  getPermission: (key: string) => KindePermission;
  getOrganization: () => KindeOrganization;
  getUserOrganizations: () => KindeOrganizations;
};

export function createKindeClient(
  options: KindeClientOptions
): Promise<KindeClient>;

export = createKindeClient;
