export type KindeUser = {
  given_name: string | null;
  id: string | null;
  family_name: string | null;
  email: string | null;
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
};

export type KindePermissions = {
  permissions: string[];
  orgCode: string;
};

export type KindePermission = {
  isGranted: boolean;
  orgCode: string;
};

export type KindeOrganization = {
  orgCode: string;
};

export type KindeOrganizations = {
  orgCodes: string[];
};

export type KindeClient = {
  getToken: () => Promise<string | undefined>;
  getUser: () => KindeUser;
  login: (options: any) => Promise<void>;
  logout: () => Promise<void>;
  register: (options: any) => Promise<void>;
  createOrg: (options: any) => Promise<void>;
  getClaim: (claim: string, tokenKey?: string) => any;
  getPermissions: () => KindePermissions;
  getPermission: (key: string) => KindePermission;
  getOrganization: () => KindeOrganization;
  getUserOrganizations: () => KindeOrganizations;
};

export function createKindeClient(
  options: KindeClientOptions
): Promise<KindeClient>;

export = createKindeClient;
