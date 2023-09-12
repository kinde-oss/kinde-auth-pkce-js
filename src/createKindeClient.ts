import {version} from './utils/version';
import {SESSION_PREFIX} from './constants/index';
import {
  type JWT,
  isValidJwt,
  parseJwt,
  setupChallenge,
  getClaim,
  getClaimValue,
  getUserOrganizations,
  getIntegerFlag,
  getStringFlag,
  getBooleanFlag,
  getFlag
} from './utils/index';
import {store} from './state/store';
import type {
  AuthOptions,
  KindeClient,
  KindeClientOptions,
  KindeOrganization,
  KindePermission,
  KindePermissions,
  KindeState,
  KindeUser,
  OrgOptions,
  RedirectOptions
} from './types';

const createKindeClient = async (
  options: KindeClientOptions
): Promise<KindeClient> => {
  if (!options) {
    throw Error('Please provide your Kinde credentials');
  }

  if (options !== Object(options)) {
    throw Error('The Kinde SDK must be initiated with an object');
  }

  const {
    audience,
    client_id: clientId,
    domain,
    is_dangerously_use_local_storage = false,
    redirect_uri,
    logout_uri = redirect_uri,
    on_redirect_callback,
    scope = 'openid profile email offline',
    _framework,
    _frameworkVersion
  } = options;

  if (audience && typeof audience !== 'string') {
    throw Error('Please supply a valid audience for your api');
  }

  if (scope && typeof scope !== 'string') {
    throw Error('Please supply a valid scope');
  }

  if (!redirect_uri || typeof options.redirect_uri !== 'string') {
    throw Error(
      'Please supply a valid redirect_uri for your users to be redirected after successful authentication'
    );
  }

  if (!domain || typeof domain !== 'string') {
    throw Error(
      'Please supply a valid Kinde domain so we can connect to your account'
    );
  }

  if (typeof is_dangerously_use_local_storage !== 'boolean') {
    throw TypeError(
      'Please supply a boolean value for is_dangerously_use_local_storage'
    );
  }

  const client_id = clientId || 'spa@live';

  //   Indicates using a custom domain on a production environment
  const is_use_cookie =
    !is_dangerously_use_local_storage && !domain.includes('.kinde.com');

  const config = {
    audience,
    client_id,
    redirect_uri,
    authorization_endpoint: `${domain}/oauth2/auth`,
    token_endpoint: `${domain}/oauth2/token`,
    requested_scopes: scope,
    domain,
    _framework,
    _frameworkVersion
  };

  const setStore = (data: KindeState & {error: string}) => {
    if (!data || data.error) return;

    const accessToken = parseJwt(data.access_token);
    const idToken = parseJwt(data.id_token)! as JWT & KindeUser;
    store.setItem('kinde_token', data);
    store.setItem('kinde_access_token', accessToken);
    store.setItem('kinde_id_token', idToken);
    store.setItem('user', {
      id: idToken.sub,
      given_name: idToken.given_name,
      family_name: idToken.family_name,
      email: idToken.email,
      picture: idToken.picture
    });

    if (is_dangerously_use_local_storage) {
      localStorage.setItem('kinde_refresh_token', data.refresh_token);
    } else {
      store.setItem('kinde_refresh_token', data.refresh_token);
    }
  };

  const useRefreshToken = async () => {
    const refresh_token = is_dangerously_use_local_storage
      ? (localStorage.getItem('kinde_refresh_token') as string)
      : (store.getItem('kinde_refresh_token') as string);

    if (refresh_token || is_use_cookie) {
      try {
        const response = await fetch(config.token_endpoint, {
          method: 'POST',
          ...(is_use_cookie && {credentials: 'include'}),
          headers: new Headers({
            'Content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
            'Kinde-SDK': `
            ${config._framework || 'JavaScript'}/${
              config._frameworkVersion || version
            }`
          }),
          body: new URLSearchParams({
            client_id: config.client_id,
            grant_type: 'refresh_token',
            ...(!is_use_cookie && refresh_token && {refresh_token})
          })
        });

        const data = await response.json();
        setStore(data);

        return data.access_token;
      } catch (err) {
        console.error(err);
      }
    }
  };

  const getToken = async () => {
    const token = store.getItem('kinde_token') as KindeState;

    if (!token) {
      return await useRefreshToken();
    }

    const accessToken = store.getItem('kinde_access_token');
    const isTokenValid = isValidJwt(accessToken as JWT);

    if (isTokenValid) {
      return token.access_token;
    } else {
      return await useRefreshToken();
    }
  };

  const isAuthenticated = async () => {
    const accessToken = store.getItem('kinde_access_token');
    if (!accessToken) {
      return false;
    }

    const isTokenValid = isValidJwt(accessToken as JWT);
    if (isTokenValid) {
      return true;
    }

    await useRefreshToken();
    return true;
  };

  const getPermissions = (): KindePermissions => {
    const orgCode = getClaimValue('org_code') as string;
    const permissions = (getClaimValue('permissions') ?? []) as string[];
    return {
      permissions,
      orgCode
    };
  };

  const getPermission = (key: string): KindePermission => {
    const orgCode = getClaimValue('org_code') as string;
    const permissions = (getClaimValue('permissions') ?? []) as string[];
    return {
      isGranted: permissions.some((p) => p === key),
      orgCode
    };
  };

  const getOrganization = (): KindeOrganization => {
    const orgCode = getClaimValue('org_code') as string;
    return {
      orgCode
    };
  };

  const handleRedirectToApp = async (q: URLSearchParams) => {
    const code = q.get('code')!;
    const state = q.get('state');
    const error = q.get('error');

    if (error) {
      console.error(`Error returned from authorization server: ${error}`);
    }

    const stringState = sessionStorage.getItem(`${SESSION_PREFIX}-${state}`);

    // Verify state
    if (!stringState) {
      console.error('Invalid state');
    } else {
      const {appState, codeVerifier} = JSON.parse(stringState);
      // Exchange authorisation code for an access token
      try {
        const response = await fetch(config.token_endpoint, {
          method: 'POST',
          ...(is_use_cookie && {credentials: 'include'}),
          headers: new Headers({
            'Content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
            'Kinde-SDK': `${config._framework || 'JavaScript'}/${
              config._frameworkVersion || version
            }`
          }),
          body: new URLSearchParams({
            client_id: config.client_id,
            code,
            code_verifier: codeVerifier,
            grant_type: 'authorization_code',
            redirect_uri: config.redirect_uri
          })
        });

        const data = await response.json();

        setStore(data);
        // Remove auth code from address bar
        const url = new URL(window.location.toString());
        url.search = '';
        sessionStorage.removeItem(`${SESSION_PREFIX}-${state}`);

        const user = getUser();
        window.history.pushState({}, '', url);

        if (on_redirect_callback) {
          on_redirect_callback(user, appState);
        }
      } catch (err) {
        console.error(err);
        sessionStorage.removeItem(`${SESSION_PREFIX}-${state}`);
      }
    }
  };

  const redirectToKinde = async (options: RedirectOptions) => {
    const {
      app_state,
      start_page,
      is_create_org,
      org_name = '',
      org_code
    } = options;

    const {state, code_challenge, url} = await setupChallenge(
      config.authorization_endpoint,
      app_state
    );

    const searchParams: Record<string, string> = {
      redirect_uri,
      client_id,
      response_type: 'code',
      scope: config.requested_scopes,
      code_challenge,
      code_challenge_method: 'S256',
      state
    };

    if (start_page) {
      searchParams.start_page = start_page;
    }

    if (audience) {
      searchParams.audience = audience;
    }

    if (org_code) {
      searchParams.org_code = org_code;
    }

    if (is_create_org) {
      searchParams.is_create_org = String(is_create_org);
      searchParams.org_name = org_name;
    }

    url.search = String(new URLSearchParams(searchParams));
    window.location.href = url.toString();
  };

  const register = async (options: AuthOptions) => {
    await redirectToKinde({
      ...options,
      start_page: 'registration'
    });
  };

  const login = async (options: AuthOptions) => {
    await redirectToKinde({
      ...options
    });
  };

  const createOrg = async (options: OrgOptions) => {
    await redirectToKinde({
      ...options,
      start_page: 'registration',
      is_create_org: true
    });
  };

  const getUser = (): KindeUser => {
    return store.getItem('user') as KindeUser;
  };

  const getUserProfile = async () => {
    const token = await getToken();
    const headers = {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`
    };

    try {
      const res = await fetch(`${config.domain}/oauth2/v2/user_profile`, {
        method: 'GET',
        headers: headers
      });
      const json = await res.json();
      store.setItem('user', {
        id: json.sub,
        given_name: json.given_name,
        family_name: json.family_name,
        email: json.email,
        picture: json.picture
      });
      return store.getItem('user') as KindeUser;
    } catch (err) {
      console.error(err);
    }
  };

  const logout = async () => {
    const url = new URL(`${config.domain}/logout`);

    try {
      store.reset();

      if (is_dangerously_use_local_storage) {
        localStorage.removeItem('kinde_refresh_token');
      }

      const searchParams = new URLSearchParams({
        redirect: logout_uri
      });
      url.search = String(searchParams);

      window.location.href = url.toString();
    } catch (err) {
      console.error(err);
    }
  };

  const init = async () => {
    const q = new URLSearchParams(window.location.search);
    // Is a redirect from Kinde Auth server
    if (q.has('code')) {
      await handleRedirectToApp(q);
    } else {
      // For onload / new tab / page refresh
      if (is_use_cookie || is_dangerously_use_local_storage) {
        await useRefreshToken();
      }
    }
  };

  await init();

  return {
    getToken,
    getUser,
    getUserProfile,
    login,
    logout,
    register,
    isAuthenticated,
    createOrg,
    getClaim,
    getFlag,
    getBooleanFlag,
    getStringFlag,
    getIntegerFlag,
    getPermissions,
    getPermission,
    getOrganization,
    getUserOrganizations
  };
};

export default createKindeClient;
