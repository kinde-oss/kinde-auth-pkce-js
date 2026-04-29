import {SESSION_PREFIX, storageMap} from './constants/index';

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
  isCustomDomain,
  base64UrlDecode
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
    on_session_restore_callback,
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
    console.warn(
      '[Kinde] `getToken()` is deprecated and will be removed in a future release. ' +
        'It may return undefined with the new auth flow. Please use `getAccessToken()` instead.'
    );
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

  const readLegacyRawToken = (
    key: storageMap.access_token | storageMap.id_token
  ): string | undefined => {
    const value = store.getItem(key);
    if (typeof value === 'string') return value;
    const bundle = store.getItem(storageMap.token_bundle) as
      | KindeStateTokenBundle
      | undefined;
    return key === storageMap.access_token
      ? bundle?.access_token
      : bundle?.id_token;
  };

  const getAccessToken = async () => {
    // js-utils (exchangeAuthCode, checkAuth) stores under StorageKeys.accessToken
    const sessionToken = await store.getSessionItem(StorageKeys.accessToken);
    const legacyToken = readLegacyRawToken(storageMap.access_token);
    return (sessionToken || legacyToken) as string | undefined;
  };

  const getIdToken = async () => {
    // js-utils stores under StorageKeys.idToken
    const sessionToken = await store.getSessionItem(StorageKeys.idToken);
    const legacyToken = readLegacyRawToken(storageMap.id_token);
    return (sessionToken || legacyToken) as string | undefined;
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

  const appStateSessionKey = (oauthState: string) =>
    `${SESSION_PREFIX}-app-state-${oauthState}`;

  const redirectToKinde = async (options: RedirectOptions) => {
    const {
      app_state = {},
      prompt,
      is_create_org,
      org_name = '',
      invitation_code,
      authUrlParams = {},
      ...restRedirectOptions
    } = options;

    const params = new URLSearchParams(window.location.search);

    if (!app_state.kindeOriginUrl) {
      app_state.kindeOriginUrl = getKindeOriginUrl();
    }

    const routeType =
      is_create_org || prompt === 'create'
        ? IssuerRouteTypes.register
        : IssuerRouteTypes.login;

    const eventType =
      options.prompt === PromptTypes.create
        ? AuthEvent.register
        : AuthEvent.login;

    const optionsState = params.get('state') || ('' as string);
    const promptType = PromptTypes[options.prompt as keyof typeof PromptTypes];

    const authProps: LoginOptions & AuthOptions = {
      audience,
      clientId: client_id,
      scope: config.requested_scopes.split(' ') as Scopes[],
      supportsReauth: true,
      ...restRedirectOptions,
      prompt: promptType,
      state: base64UrlEncode(
        JSON.stringify({
          kinde: {event: eventType, state: optionsState}
        })
      ),
      redirectURL: getRedirectUrl(redirect_uri)
    };

    if (invitation_code) {
      authProps.invitationCode = invitation_code;
      authProps.isInvitation = true;
    }

    if (is_create_org) {
      authProps.isCreateOrg = is_create_org;
      authProps.orgName = org_name;
    }

    const authUrl = await generateAuthUrl(config.domain, routeType, authProps);

    // mergeAuthUrlParams only — do not replace the query string with authProps keys:
    // generateAuthUrl already maps redirectURL → redirect_uri, clientId → client_id, etc.
    const reservedParams = new Set([
      'state',
      'client_id',
      'redirect_uri',
      'response_type',
      'scope',
      'code_challenge',
      'code_challenge_method'
    ]);
    for (const [k, v] of Object.entries(
      normalizeAuthUrlParams(authUrlParams)
    )) {
      if (reservedParams.has(k)) continue;
      authUrl.url.searchParams.set(k, String(v));
    }

    const oauthState =
      authUrl.url.searchParams.get('state') || authUrl.state || '';
    if (oauthState) {
      try {
        sessionStorage.setItem(
          appStateSessionKey(oauthState),
          JSON.stringify(app_state)
        );
      } catch {
        // quota / private mode — callback will not receive app_state
      }
    }

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
    const oauthStateParam = searchParams.get('state') || '';
    let storedAppState: Record<string, unknown> = {};
    if (oauthStateParam) {
      const key = appStateSessionKey(oauthStateParam);
      try {
        const raw = sessionStorage.getItem(key);
        if (raw) {
          storedAppState = JSON.parse(raw) as Record<string, unknown>;
        }
      } catch {
        storedAppState = {};
      }
      sessionStorage.removeItem(key);
    }

    const decoded = base64UrlDecode(oauthStateParam);
    try {
      JSON.parse(decoded) as StateWithKinde;
    } catch (error) {
      console.error('Error parsing state:', error);
      on_error_callback?.({
        error: 'ERR_STATE_PARSE',
        errorDescription: String(error),
        state: oauthStateParam,
        appState: storedAppState
      });
      return;
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
          on_redirect_callback?.(user, storedAppState);
        }
      } else {
        on_error_callback?.({
          error: 'ERR_CODE_EXCHANGE',
          errorDescription: codeResponse.error,
          state: oauthStateParam,
          appState: storedAppState
        });
      }
    } catch (error) {
      on_error_callback?.({
        error: 'ERR_POPUP_AUTH',
        errorDescription: String(error),
        state: oauthStateParam,
        appState: storedAppState
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
        localStorageAdapter.removeSessionItem(StorageKeys.refreshToken),
        store.removeItems(
          storageMap.refresh_token,
          storageMap.access_token,
          storageMap.id_token,
          storageMap.user,
          storageMap.token_bundle
        )
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

  const migrateLegacyRefreshTokenKey = () => {
    if (!isUseLocalStorage) return;
    const oldToken = localStorage.getItem(storageMap.refresh_token);
    if (!oldToken) return;

    const newToken = localStorageAdapter.getSessionItem(
      StorageKeys.refreshToken
    );

    if (!newToken) {
      localStorageAdapter.setSessionItem(StorageKeys.refreshToken, oldToken);
    }

    localStorage.removeItem(storageMap.refresh_token);
  };
  const init = async () => {
    try {
      try {
        migrateLegacyRefreshTokenKey();
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

      if (on_session_restore_callback) {
        try {
          const user = await getUserProfile();
          if (user) {
            on_session_restore_callback(user, {
              kindeOriginUrl: window.location.href,
              kinde: {event: 'session_restore'}
            });
          }
        } catch (error) {
          console.warn('Error getting user profile', error);
          on_error_callback?.({
            error: 'ERR_GET_USER_PROFILE',
            errorDescription: String(error),
            state: '',
            appState: {}
          });
        }
      }

      return;
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
