import {storageMap} from './constants/index';

import {
  getClaim,
  getClaimValue,
  getUserOrganizations,
  getIntegerFlag,
  getStringFlag,
  getBooleanFlag,
  getFlag,
  isJWTActive,
  JWT,
  isTokenValid
} from './utils/index';
import {store} from './state/store';
import type {
  AuthOptions,
  KindeClient,
  KindeClientOptions,
  KindeOrganization,
  KindePermission,
  KindePermissions,
  KindeUser,
  OrgOptions,
  RedirectOptions,
  ErrorProps,
  LogoutOptions,
  GetTokenOptions,
  KindeStateTokenBundle
} from './types';
import {
  generateAuthUrl,
  generatePortalUrl,
  GeneratePortalUrlParams,
  IssuerRouteTypes,
  PromptTypes,
  Scopes,
  setActiveStorage,
  StorageKeys,
  isAuthenticated as isAuthenticatedFromJsUtils,
  getUserProfile as getUserProfileFromJsUtils,
  LocalStorage,
  checkAuth,
  setInsecureStorage,
  LoginMethodParams,
  base64UrlEncode,
  navigateToKinde,
  exchangeAuthCode,
  LoginOptions,
  UserProfile,
  RefreshTokenResult,
  isCustomDomain
} from './kindeUtils';
import {getRedirectUrl} from './utils/getRedirectUrl';
import {hasCookie} from './utils/hasCookie/hasCookie';
import {version} from './utils/version';
import {jwtDecode} from 'jwt-decode';

enum AuthEvent {
  login = 'login',
  logout = 'logout',
  register = 'register',
  tokenRefreshed = 'tokenRefreshed'
}

type StateWithKinde = StringProperties & {
  kinde: KindeState;
};
type KindeState = {event: AuthEvent};

type StringProperties = {
  [P in string as P extends 'kinde' ? never : P]: string;
};

type EventTypes = {
  (
    event: AuthEvent.tokenRefreshed,
    state: RefreshTokenResult,
    context: KindeClient
  ): void;
  (
    event: AuthEvent,
    state: Record<string, unknown>,
    context: KindeClient
  ): void;
};

export type KindeCallbacks = {
  onSuccess?: (
    user: UserProfile,
    state: Record<string, unknown>,
    context: KindeClient
  ) => void;
  onError?: (
    props: ErrorProps,
    state: Record<string, string>,
    context: KindeClient
  ) => void;
  onEvent?: EventTypes;
};

const isSameOriginOpener = (): boolean => {
  try {
    const opener = window.opener;
    if (!opener || opener.closed) return false;
    return opener.location.origin === window.location.origin;
  } catch {
    return false;
  }
};

const createKindeClient = async (
  options: KindeClientOptions
): Promise<KindeClient> => {
  if (!options) {
    throw Error('Please provide your Kinde credentials');
  }

  if (options !== Object(options)) {
    throw Error('The Kinde SDK must be initiated with an object');
  }

  const params = new URLSearchParams(window.location.search);
  const hasInvitationCode = params.has('invitation_code');
  const invitationCode = hasInvitationCode
    ? params.get('invitation_code')
    : null;

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
  setActiveStorage(store);

  // If code is running on localhost, it's a development environment
  const isDevelopment =
    location.hostname === 'localhost' || location.hostname === '127.0.0.1';

  // // Indicates using a custom domain on a production environment
  const isUseCookie =
    !isDevelopment &&
    !is_dangerously_use_local_storage &&
    isCustomDomain(domain);

  const isUseLocalStorage = isDevelopment || is_dangerously_use_local_storage;

  // Use LocalStorage from @kinde/js-utils for persistent storage
  const localStorageAdapter = new LocalStorage();
  setInsecureStorage(localStorageAdapter);

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

  /** @deprecated use `getAccessToken` instead */
  const getToken = async (options: GetTokenOptions = {}) => {
    return await getTokenType(storageMap.access_token, options);
  };

  /** @deprecated only used for old getToken method which is now deprecated */
  const getTokenType = async (
    tokenType: storageMap,
    options: GetTokenOptions
  ) => {
    const token = store.getItem(
      storageMap.token_bundle
    ) as KindeStateTokenBundle;

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

  /* @deprecated only used for old getToken method which is now deprecated */
  const useRefreshToken = async (
    {tokenType} = {tokenType: storageMap.access_token}
  ) => {
    const localStorageRefreshToken = isUseLocalStorage
      ? (localStorage.getItem(storageMap.refresh_token) as string)
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

  /* @deprecated only used for old getToken method which is now deprecated */
  const setStore = (data: KindeStateTokenBundle & {error: string}) => {
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
        localStorage.setItem(storageMap.refresh_token, data.refresh_token);
      } else {
        store.setItem(storageMap.refresh_token, data.refresh_token);
      }
    }
  };

  const getAccessToken = async () => {
    // js-utils (exchangeAuthCode, checkAuth) stores under StorageKeys.accessToken
    const sessionToken = store.getSessionItem(StorageKeys.accessToken);
    const legacyToken = store.getItem(storageMap.access_token);
    return (sessionToken || legacyToken) as string;
  };

  const getIdToken = async () => {
    // js-utils stores under StorageKeys.idToken
    const sessionToken = store.getSessionItem(StorageKeys.idToken);
    const legacyToken = store.getItem(storageMap.id_token);
    return (sessionToken || legacyToken) as string;
  };

  const isAuthenticated = async () => {
    return isAuthenticatedFromJsUtils({
      useRefreshToken: true,
      domain,
      clientId: client_id
    });
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

  const getKindeOriginUrl = () => {
    const url = new URL(window.location.toString());
    url.searchParams.delete('invitation_code');
    url.searchParams.delete('is_invitation');
    return url.toString();
  };

  const normalizeAuthUrlParams = (
    authUrlParams: NonNullable<AuthOptions['authUrlParams']>
  ) => {
    return Object.fromEntries(
      Object.entries(authUrlParams).map(([key, value]) => [key, String(value)])
    );
  };

  const redirectToKinde = async (options: RedirectOptions) => {
    const {
      app_state = {},
      prompt,
      is_create_org,
      org_name = '',
      invitation_code,
      authUrlParams = {}
    } = options;

    const params = new URLSearchParams(window.location.search);

    if (!app_state.kindeOriginUrl) {
      app_state.kindeOriginUrl = getKindeOriginUrl();
    }

    const routeType =
      is_create_org || prompt === 'create'
        ? IssuerRouteTypes.register
        : IssuerRouteTypes.login;

    const optionsState = params.get('state') || ('' as string);

    const authProps: LoginOptions & AuthOptions & {is_invitation?: string} = {
      audience,
      clientId: client_id,
      scope: config.requested_scopes.split(' ') as Scopes[],
      supportsReauth: true,
      ...options,
      prompt:
        options.prompt === PromptTypes.create
          ? PromptTypes.create
          : PromptTypes.login,
      state: base64UrlEncode(
        JSON.stringify({
          kinde: {event: AuthEvent.login, state: optionsState}
        })
      ),
      redirectURL: getRedirectUrl(redirect_uri)
    };

    const authUrl = await generateAuthUrl(config.domain, routeType, authProps);
    if (invitation_code) {
      authProps.invitation_code = invitation_code;
      authProps.is_invitation = 'true';
    }

    if (is_create_org) {
      authProps.isCreateOrg = is_create_org;
      authProps.orgName = org_name;
    }

    const searchRecord: Record<string, string> = {};
    for (const [k, v] of Object.entries({
      ...normalizeAuthUrlParams(authUrlParams),
      ...authProps
    })) {
      if (v === undefined) continue;
      searchRecord[k] = Array.isArray(v) ? v.join(' ') : String(v);
    }
    authUrl.url.search = new URLSearchParams(searchRecord).toString();
    try {
      navigateToKinde({
        url: authUrl.url.toString(),
        handleResult: processAuthResult
      });
    } catch (error) {
      if (on_error_callback) {
        on_error_callback({
          error: 'Error with navigate to Kinde',
          errorDescription: (error as Error).message,
          state: authProps.state,
          appState: {
            kindeOriginUrl: window.location.href
          }
        } as ErrorProps);
      }
    }
  };

  const processAuthResult = async (searchParams: URLSearchParams) => {
    const decoded = atob(searchParams.get('state') || '');
    let returnedState: StateWithKinde;
    let kindeState: KindeState;

    try {
      returnedState = JSON.parse(decoded);
      kindeState = Object.assign(
        returnedState.kinde || {event: PromptTypes.login}
      );
    } catch (error) {
      console.error('Error parsing state:', error);
      on_error_callback?.({
        error: 'ERR_STATE_PARSE',
        errorDescription: String(error),
        state: searchParams.get('state') || '',
        appState: {}
      });
      returnedState = {} as StateWithKinde;
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      kindeState = {event: AuthEvent.login};
    }

    try {
      const codeResponse = await exchangeAuthCode({
        urlParams: searchParams,
        domain,
        clientId: client_id,
        redirectURL: getRedirectUrl(options.redirect_uri || redirect_uri),
        autoRefresh: true
      });

      if (codeResponse.success) {
        const user = await getUserProfile();
        if (user) {
          on_redirect_callback?.(user, {
            ...returnedState,
            kinde: undefined
          });
        }
      } else {
        on_error_callback?.({
          error: 'ERR_CODE_EXCHANGE',
          errorDescription: codeResponse.error,
          state: searchParams.get('state') || '',
          appState: {
            ...returnedState,
            kinde: undefined
          }
        });
      }
    } catch (error) {
      on_error_callback?.({
        error: 'ERR_POPUP_AUTH',
        errorDescription: String(error),
        state: searchParams.get('state') || '',
        appState: {
          ...returnedState,
          kinde: undefined
        }
      } as ErrorProps);
    }
  };

  const register = async (
    options?: (AuthOptions | LoginMethodParams) & {
      state?: Record<string, string>;
    }
  ) => {
    await redirectToKinde({
      ...options,
      prompt: PromptTypes.create
    });
  };

  const login = async (
    options?: (AuthOptions | LoginMethodParams) & {
      state?: Record<string, string>;
    }
  ) => {
    await redirectToKinde({
      ...options
    });
  };

  const createOrg = async (
    options?: (OrgOptions | LoginMethodParams) & {
      state?: Record<string, string>;
    }
  ) => {
    await redirectToKinde({
      ...options,
      prompt: PromptTypes.create,
      is_create_org: true
    });
  };

  const getUser = (): KindeUser => {
    return store.getItem(storageMap.user) as KindeUser;
  };

  const getUserProfile = async () => {
    try {
      const user = await getUserProfileFromJsUtils();

      if (!user) return;

      const mappedUser: KindeUser = {
        id: user.id,
        given_name: user.givenName,
        family_name: user.familyName,
        email: user.email,
        picture: user.picture
      };

      store.setItem(storageMap.user, mappedUser);
      return mappedUser;
    } catch (err) {
      console.error(err);
    }
  };

  const logout = async (options?: string | LogoutOptions) => {
    try {
      const params = new URLSearchParams();

      if (options) {
        if (options && typeof options === 'string') {
          params.append('redirect', options);
        } else if (typeof options === 'object') {
          if (options.redirectUrl || logout_uri) {
            params.append('redirect', options.redirectUrl || logout_uri || '');
          }
          if (options.allSessions) {
            params.append('all_sessions', String(options.allSessions));
          }
        }
      } else {
        params.append('redirect', logout_uri || '');
      }

      await Promise.all([
        store.removeSessionItem(StorageKeys.idToken),
        store.removeSessionItem(StorageKeys.accessToken),
        store.removeSessionItem(StorageKeys.refreshToken),
        localStorageAdapter.removeSessionItem(StorageKeys.refreshToken)
      ]);

      try {
        await navigateToKinde({
          url: `${domain}/logout?${params.toString()}`
        });
      } catch (error) {
        on_error_callback?.({
          error: 'ERR_POPUP',
          errorDescription: (error as Error).message,
          state: '',
          appState: {}
        });
      }
    } catch (error) {
      on_error_callback?.({
        error: 'ERR_LOGOUT',
        errorDescription: String(error),
        state: '',
        appState: {}
      });
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
      const tokens = await getAccessToken();

      if (!tokens) {
        throw new Error('No valid access token found');
      }

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
    try {
      try {
        // This handles the refresh token
        await checkAuth({domain, clientId: client_id});
      } catch (err) {
        console.warn('checkAuth failed:', err);
        on_error_callback?.({
          error: 'ERR_CHECK_AUTH',
          errorDescription: String(err),
          state: '',
          appState: {}
        });
      }
      const params = new URLSearchParams(window.location.search);

      if (params.has('error')) {
        const errorCode = params.get('error');
        if (errorCode?.toLowerCase() === 'login_link_expired') {
          const reauthState = params.get('reauth_state');
          if (reauthState) {
            login({reauthState: reauthState});
          }
          return;
        }
        on_error_callback?.({
          error: 'ERR_CHECK_AUTH',
          errorDescription: String(errorCode),
          state: '',
          appState: {}
        });
        return;
      }

      const isKindeRedirectUri = isKindeRedirect(params);

      const kindeShouldHandle = isKindeRedirectUri && params.has('code');

      if (hasInvitationCode && invitationCode) {
        await login({invitation_code: invitationCode});
        return;
      }
      if (kindeShouldHandle) {
        if (isSameOriginOpener()) {
          const searchParams = new URLSearchParams(window.location.search);
          window.opener.postMessage(
            {
              type: 'KINDE_AUTH_RESULT',
              result: Object.fromEntries(searchParams.entries())
            },
            window.location.origin
          );
          window.close();
          return;
        }
        await processAuthResult(new URLSearchParams(window.location.search));

        return;
      }

      try {
        const user = await getUserProfile();
        if (user) {
          on_redirect_callback?.(user, {
            kindeOriginUrl: window.location.href,
            kinde: {event: AuthEvent.login, state: params.get('state') || ''}
          });
        }
      } catch (error) {
        console.warn('Error getting user profile', error);
        if (on_error_callback) {
          on_error_callback({
            error: 'ERR_GET_USER_PROFILE',
            errorDescription: String(error),
            state: '',
            appState: {}
          });
        }
      }
    } catch (error) {
      console.warn('Error in init', error);
      if (on_error_callback) {
        on_error_callback({
          error: 'ERR_INIT',
          errorDescription: String(error),
          state: '',
          appState: {}
        });
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
    return (
      currentRedirectUri === expectedRedirectUri ||
      currentRedirectUri === `${expectedRedirectUri}/`
    );
  };

  await init();

  return {
    createOrg,
    getToken,
    getAccessToken,
    getBooleanFlag,
    getClaim,
    getFlag,
    getIdToken,
    getIntegerFlag,
    getOrganization,
    getPermissions,
    getPermission,
    getStringFlag,
    getUser,
    getUserOrganizations,
    getUserProfile,
    isAuthenticated,
    login,
    logout,
    portal,
    register
  };
};

export default createKindeClient;
