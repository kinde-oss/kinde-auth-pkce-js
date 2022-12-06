type KindeUser = {
  given_name: string | null;
  id: string | null;
  family_name: string | null;
  email: string | null;
};

type KindeClientOptions = {
  audience?: string;
  client_id?: string;
  redirect_uri: string;
  domain: string;
  is_dangerously_use_local_storage?: boolean;
  logout_uri?: string;
  scope?: string;
};

type KindeState = {
  access_token: string;
  expires_in: number;
  id_token: string;
  refresh_token: string;
  scope: string;
  token_type: string;
};

type KindePermissions = {
  permissions: string[];
  orgCode: string;
};

type KindePermission = {
  isGranted: boolean;
  orgCode: string;
};

type KindeOrganization = {
  orgCode: string;
};

type KindeOrganizations = {
  orgCodes: string[];
};

type KindeClient = {
  getToken: () => Promise<string | undefined>;
  getUser: () => KindeUser;
  handleRedirectCallback: () => Promise<{kindeState: KindeState} | undefined>;
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

declare function createKindeClient(
  options: KindeClientOptions
): Promise<KindeClient>;

export = createKindeClient;
