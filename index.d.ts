export type KindeUser = {
  first_name: string | null;
  id: string | null;
  last_name: string | null;
  preferred_email: string | null;
  provided_id: string | null;
};

export type KindeClientOptions = {
  client_id?: string;
  redirect_uri: string;
  domain: string;
  is_live?: boolean;
  logout_uri?: string;
};

export type KindeState = {
  access_token: string;
  expires_in: number;
  id_token: string;
  refresh_token: string;
  scope: string;
  token_type: string;
};

export type KindeClient = {
  getToken: () => Promise<string | undefined>;
  getUser: () => Promise<KindeUser | undefined>;
  handleRedirectCallback: () => Promise<{kindeState: KindeState} | undefined>;
  login: (options: any) => Promise<void>;
  logout: () => Promise<void>;
  register: (options: any) => Promise<void>;
  createOrg: (options: any) => Promise<void>;
};
export function createKindeClient(
  options: KindeClientOptions
): Promise<KindeClient>;
