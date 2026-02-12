import {version} from './utils/version';
import {SESSION_PREFIX, storageMap} from './constants/index';
import {jwtDecode} from 'jwt-decode';
import {hasCookie} from './utils/hasCookie/hasCookie';
import {LocalStorage} from '@kinde/js-utils';

import {
  type JWT,
  isJWTActive,
  getClaim,
  getClaimValue,
  getUserOrganizations,
  getIntegerFlag,
  getStringFlag,
  getBooleanFlag,
  getFlag,
  isTokenValid,
  isCustomDomain
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
  RedirectOptions,
  ErrorProps,
  GetTokenOptions
} from './types';
import {
  generateAuthUrl,
  generatePortalUrl,
  GeneratePortalUrlParams,
  IssuerRouteTypes,
  MemoryStorage,
  PromptTypes,
  Scopes,
  setActiveStorage,
  getActiveStorage,
  StorageKeys
} from './kindeUtils';

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
    on_error_callback,
    scope = 'openid profile email offline',
    proxy_redirect_uri,
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
  console.log(
    'PESICKA, inside createKindeClient, setting active storage',
    JSON.stringify(store)
  );
  setActiveStorage(store);

  const getStorage = getActiveStorage();
  console.log('PESICKA, getStorage', JSON.stringify(getStorage));

  // If code is running on localhost, it's a development environment
  const isDevelopment =
    location.hostname === 'localhost' || location.hostname === '127.0.0.1';

  // Indicates using a custom domain on a production environment
  const isUseCookie =
    !isDevelopment &&
    !is_dangerously_use_local_storage &&
    isCustomDomain(domain);

  const isUseLocalStorage = false;
  //isDevelopment || is_dangerously_use_local_storage;

  // Use LocalStorage from @kinde/js-utils for persistent storage
  const localStorageAdapter = new LocalStorage();

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

    const idToken = jwtDecode(data.id_token)! as JWT & KindeUser;
    const idTokenHeader = jwtDecode(data.id_token, {header: true});
    const accessToken = jwtDecode(data.access_token);
    const accessTokenHeader = jwtDecode(data.access_token, {header: true});

    const validatorOptions = {
      iss: domain,
      azp: clientId,
      aud: audience
    };
    const isIDValid = isTokenValid(
      {
        payload: idToken,
        header: idTokenHeader
      },
      {...validatorOptions, aud: clientId}
    );
    const isAccessValid = isTokenValid(
      {
        payload: accessToken,
        header: accessTokenHeader
      },
      validatorOptions
    );

    if (isIDValid && isAccessValid) {
      store.setItem(storageMap.token_bundle, data);
      store.setItem(storageMap.access_token, accessToken);
      store.setItem(storageMap.id_token, idToken);

      // Also store raw JWT strings for @kinde/js-utils compatibility
      store.setSessionItem('accessToken', data.access_token);
      store.setSessionItem('idToken', data.id_token);

      if (idToken.sub) {
        store.setItem(storageMap.user, {
          id: idToken.sub,
          given_name: idToken.given_name,
          family_name: idToken.family_name,
          email: idToken.email,
          picture: idToken.picture
        });
      }

      if (isUseLocalStorage) {
        localStorageAdapter.setSessionItem(
          storageMap.refresh_token as any,
          data.refresh_token
        );
      } else {
        store.setItem(storageMap.refresh_token, data.refresh_token);
      }
    }
  };

  const useRefreshToken = async (
    {tokenType} = {tokenType: storageMap.access_token}
  ) => {
    const localStorageRefreshToken = isUseLocalStorage
      ? (localStorageAdapter.getSessionItem(
          storageMap.refresh_token as any
        ) as string)
      : (store.getItem(storageMap.refresh_token) as string);

    const isCallTokenEndpoint =
      localStorageRefreshToken || (isUseCookie && hasCookie('_kbrte'));
    if (isCallTokenEndpoint) {
      try {
        const response = await fetch(config.token_endpoint, {
          method: 'POST',
          ...(isUseCookie && {credentials: 'include'}),
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
            ...(!isUseCookie &&
              localStorageRefreshToken && {
                refresh_token: localStorageRefreshToken
              })
          })
        });

        const data = await response.json();
        setStore(data);

        if (tokenType === storageMap.id_token) {
          return data.id_token;
        }

        return data.access_token;
      } catch (err) {
        console.error(err);
      }
    }
  };

  const getTokenType = async (
    tokenType: storageMap,
    options: GetTokenOptions
  ) => {
    const token = store.getItem(storageMap.token_bundle) as KindeState;

    if (!token || options.isForceRefresh) {
      return await useRefreshToken({tokenType});
    }

    const tokenToReturn = store.getItem(tokenType);
    const isTokenActive = isJWTActive(tokenToReturn as JWT);

    if (isTokenActive) {
      return tokenType === storageMap.access_token
        ? token.access_token
        : token.id_token;
    } else {
      return await useRefreshToken({tokenType});
    }
  };

  const getToken = async (options: GetTokenOptions = {}) => {
    return await getTokenType(storageMap.access_token, options);
  };

  const getIdToken = async (options: GetTokenOptions = {}) => {
    return await getTokenType(storageMap.id_token, options);
  };

  const isAuthenticated = async () => {
    const accessToken = store.getItem(storageMap.access_token);
    if (!accessToken) {
      return false;
    }

    const isTokenActive = isJWTActive(accessToken as JWT);
    if (isTokenActive) {
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

  const clearUrlParams = () => {
    const url = new URL(window.location.toString());
    url.search = '';
    window.history.pushState({}, '', url);
  };

  const handleRedirectToApp = async (q: URLSearchParams) => {
    const code = q.get('code')!;
    const state = q.get('state');
    const error = q.get('error');

    if (error?.toLowerCase() === 'login_link_expired') {
      const reauthState = q.get('reauth_state');
      if (reauthState) {
        const decodedAuthState = atob(reauthState);
        try {
          const reauthState = JSON.parse(decodedAuthState);
          if (reauthState) {
            login(reauthState);
          }
        } catch (ex) {
          throw new Error(
            ex instanceof Error
              ? ex.message
              : 'Unknown Error parsing reauth state'
          );
        }
      }
      return;
    }

    const stringState = sessionStorage.getItem(`${SESSION_PREFIX}-${state}`);

    // Verify state
    if (!stringState) {
      console.error('Invalid state');
    } else {
      if (error) {
        const error = q.get('error');
        const errorDescription = q.get('error_description');
        clearUrlParams();
        sessionStorage.removeItem(`${SESSION_PREFIX}-${state}`);

        const {appState} = JSON.parse(stringState);
        if (on_error_callback) {
          on_error_callback({
            error,
            errorDescription,
            state,
            appState
          } as ErrorProps);
        } else {
          window.location.href = appState.kindeOriginUrl;
        }
        return false;
      }
      const {appState, codeVerifier} = JSON.parse(stringState);
      // Exchange authorisation code for an access token
      try {
        const response = await fetch(config.token_endpoint, {
          method: 'POST',
          ...(isUseCookie && {credentials: 'include'}),
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
        clearUrlParams();
        sessionStorage.removeItem(`${SESSION_PREFIX}-${state}`);

        const user = getUser();

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
      app_state = {},
      prompt,
      is_create_org,
      org_name = '',
      org_code,
      authUrlParams = {}
    } = options;

    if (!app_state.kindeOriginUrl) {
      app_state.kindeOriginUrl = window.location.href;
    }

    const routeType =
      is_create_org || prompt === 'create'
        ? IssuerRouteTypes.register
        : IssuerRouteTypes.login;

    const loginOptions = {
      redirectURL: redirect_uri,
      clientId: client_id,
      scope: config.requested_scopes.split(' ') as Scopes[],
      supportsReauth: true,
      prompt: options.prompt as PromptTypes,
      orgCode: org_code ?? options.orgCode,
      orgName: org_name || options.orgName,
      isCreateOrg: is_create_org ?? options.isCreateOrg,
      audience: audience ?? options.audience,
      lang: options.lang,
      loginHint: options.loginHint,
      connectionId: options.connectionId,
      hasSuccessPage: options.hasSuccessPage,
      workflowDeploymentId: options.workflowDeploymentId,
      properties: options.properties,
      reauthState: options.reauthState,
      planInterest: options.planInterest,
      pricingTableKey: options.pricingTableKey,
      pagesMode: options.pagesMode
    };

    const {url, state, codeVerifier} = await generateAuthUrl(
      config.domain,
      routeType,
      loginOptions
    );

    if (Object.keys(authUrlParams).length > 0) {
      const merged = new URLSearchParams(url.search);
      Object.entries(authUrlParams as Record<string, string>).forEach(
        ([key, value]) => merged.set(key, value)
      );
      url.search = String(merged);
    }

    window.location.href = url.toString();
  };

  const register = async (options?: AuthOptions) => {
    await redirectToKinde({
      ...options,
      prompt: 'create'
    });
  };

  const login = async (options?: AuthOptions) => {
    await redirectToKinde({
      ...options
    });
  };

  const createOrg = async (options?: OrgOptions) => {
    await redirectToKinde({
      ...options,
      prompt: 'create',
      is_create_org: true
    });
  };

  const getUser = (): KindeUser => {
    return store.getItem(storageMap.user) as KindeUser;
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
      store.setItem(storageMap.user, {
        id: json.sub,
        given_name: json.given_name,
        family_name: json.family_name,
        email: json.email,
        picture: json.picture
      });
      return store.getItem(storageMap.user) as KindeUser;
    } catch (err) {
      console.error(err);
    }
  };

  const logout = async () => {
    const url = new URL(`${config.domain}/logout`);

    try {
      store.reset();

      if (isUseLocalStorage) {
        localStorageAdapter.removeSessionItem(storageMap.refresh_token as any);
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

  const portal = async (
    options: Partial<Omit<GeneratePortalUrlParams, 'domain'>> = {}
  ) => {
    try {
      const isAuth = await isAuthenticated();
      if (!isAuth) {
        throw new Error('User must be authenticated to access portal');
      }

      const returnUrl = options.returnUrl || window.location.href;
      const tokens = store.getItem(storageMap.token_bundle) as KindeState;

      if (!tokens || !tokens.access_token) {
        throw new Error('No valid access token found');
      }

      const storage = new MemoryStorage();
      await storage.setSessionItem(
        StorageKeys.accessToken,
        tokens.access_token
      );
      setActiveStorage(storage);

      const portalUrl = await generatePortalUrl({
        ...options,
        domain: config.domain,
        returnUrl
      });

      window.location.href = portalUrl.url.toString();
    } catch (err) {
      console.error(err);
    }
  };

  const init = async () => {
    const q = new URLSearchParams(window.location.search);
    // Is a redirect from Kinde Auth server
    if (isKindeRedirect(q)) {
      console.log('PESICKA, handle redirect to App');
      await handleRedirectToApp(q);
    } else {
      // For onload / new tab / page refresh
      if (isUseCookie || isUseLocalStorage) {
        await useRefreshToken();
      }
    }
  };

  const isKindeRedirect = (searchParams: URLSearchParams) => {
    // Check if the search params hve the code parameter
    const hasOauthCode = searchParams.has('code');
    const hasError = searchParams.has('error');
    if (!hasOauthCode && !hasError) return false;
    // Also check if redirect_uri matches current url
    const {protocol, host, pathname} = window.location;

    const currentRedirectUri = `${protocol}//${host}${pathname}`;
    const expectedRedirectUri = proxy_redirect_uri || redirect_uri;
    console.log(
      'PESICKA, isKindeRedirect',
      currentRedirectUri,
      expectedRedirectUri
    );
    return (
      currentRedirectUri === expectedRedirectUri ||
      currentRedirectUri === `${expectedRedirectUri}/ `
    );
  };

  await init();

  return {
    getToken,
    getIdToken,
    getUser,
    getUserProfile,
    login,
    logout,
    register,
    portal,
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
