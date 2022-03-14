import {SESSION_PREFIX} from './config/index';
import {randomString, pkceChallengeFromVerifier} from './utils/index';

const createKindeClient = async (options) => {
  if (!options) {
    throw Error('Please provide your Kinde credentials');
  }

  if (options !== Object(options)) {
    throw Error('The Kinde SDK must be initiated with an object');
  }

  const {redirect_uri, domain, is_live = true} = options;

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

  if (typeof is_live !== 'boolean') {
    throw TypeError('Please supply a boolean value for is_live');
  }

  const client_id = is_live ? 'spa@live' : 'spa@sandbox';

  const config = {
    client_id,
    redirect_uri,
    authorization_endpoint: `${domain}/oauth2/auth`,
    token_endpoint: `${domain}/oauth2/token`,
    requested_scopes: 'openid offline',
    domain
  };

  const setupTheThings = async () => {
    const state = randomString();
    const code_verifier = randomString(); // the secret
    // Hash and base64-urlencode the secret to use as the challenge
    const code_challenge = await pkceChallengeFromVerifier(code_verifier);

    sessionStorage.setItem(`${SESSION_PREFIX}-${state}`, code_verifier);

    // Build and encode the authorisation request url
    const url = new URL(config.authorization_endpoint);
    return {state, code_challenge, url};
  };

  const getToken = async () => {
    const storedToken = localStorage.getItem('kinde_token');

    if (storedToken) {
      try {
        const token = JSON.parse(storedToken);
        const response = await fetch(config.token_endpoint, {
          method: 'POST',
          headers: new Headers({
            'Content-type': 'application/x-www-form-urlencoded; charset=UTF-8'
          }),
          body: new URLSearchParams({
            client_id: config.client_id,
            grant_type: 'refresh_token',
            refresh_token: token.refresh_token
          })
        });

        const data = await response.json();
        localStorage.setItem('kinde_token', JSON.stringify(data));
        return data.access_token;
      } catch (err) {
        console.log(err);
      }
    }
  };

  await getToken();

  const handleKindeRedirect = async (type) => {
    const {state, code_challenge, url} = await setupTheThings();

    url.search = new URLSearchParams({
      redirect_uri,
      client_id,
      response_type: 'code',
      scope: config.requested_scopes,
      code_challenge,
      code_challenge_method: 'S256',
      state,
      start_page: type
    });

    window.location = url;
  };

  const register = async () => {
    await handleKindeRedirect('registration');
  };

  const login = async () => {
    await handleKindeRedirect('login');
  };

  const handleRedirectCallback = async () => {
    const q = new URLSearchParams(window.location.search);
    if (!q.has('code')) {
      return {};
    }

    const code = q.get('code');
    const state = q.get('state');
    const error = q.get('error');

    if (error) {
      console.error(`Error returned from authorization server: ${error}`);
    }

    // Verify state
    const code_verifier = sessionStorage.getItem(`${SESSION_PREFIX}-${state}`);
    if (!code_verifier) {
      console.error('Invalid state');
    } else {
      // Exchange authorisation code for an access token
      try {
        const response = await fetch(config.token_endpoint, {
          method: 'POST',
          headers: new Headers({
            'Content-type': 'application/x-www-form-urlencoded; charset=UTF-8'
          }),
          body: new URLSearchParams({
            client_id: config.client_id,
            code,
            code_verifier,
            grant_type: 'authorization_code',
            redirect_uri: config.redirect_uri
          })
        });

        const data = await response.json();
        localStorage.setItem('kinde_token', JSON.stringify(data));

        // Remove auth code from address bar
        const url = new URL(window.location);
        url.search = '';
        // window.history.pushState('', document.title, url);
        sessionStorage.removeItem(`${SESSION_PREFIX}-${state}`);
        return {
          kindeState: data
        };
      } catch (err) {
        console.log(err);
        sessionStorage.removeItem(`${SESSION_PREFIX}-${state}`);
      }
    }
  };

  const logout = async () => {
    try {
      //   const storedToken = localStorage.getItem('kinde_token');
      //   const token = JSON.parse(storedToken);
      //   const response = await fetch(`${domain}/auth/logout`, {
      //     headers: { Authorization: "Bearer " + token.access_token },
      //     body: new URLSearchParams({
      //       client_id: config.client_id,
      //     }),
      //   });
      //   const data = await response.json();
      //   console.log(data);
      localStorage.removeItem('kinde_token');
      window.location = config.redirect_uri;
      //   return data;
    } catch (err) {
      console.log(err);
    }
  };

  const getUser = async () => {
    const storedToken = localStorage.getItem('kinde_token');
    const token = JSON.parse(storedToken);
    if (token) {
      try {
        const response = await fetch(`${domain}/oauth2/user_profile`, {
          headers: new Headers({
            Authorization: 'Bearer ' + token.access_token
          })
        });

        return await response.json();
      } catch (err) {
        console.log(err);
      }
    }
  };

  return {
    getToken,
    getUser,
    handleRedirectCallback,
    login,
    logout,
    register
  };
};

export default createKindeClient;
