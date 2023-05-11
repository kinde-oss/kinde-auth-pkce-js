import {SESSION_PREFIX} from '../../constants/index';
import {randomString, pkceChallengeFromVerifier} from './../../utils/index';

const setupChallenge = async (authorizationEndpoint, appState) => {
  const state = randomString();
  const code_verifier = randomString(); // the secret
  // Hash and base64-urlencode the secret to use as the challenge
  const code_challenge = await pkceChallengeFromVerifier(code_verifier);

  sessionStorage.setItem(
    `${SESSION_PREFIX}-${state}`,
    JSON.stringify({
      codeVerifier: code_verifier,
      appState
    })
  );

  // Build and encode the authorisation request url
  const url = new URL(authorizationEndpoint);
  return {state, code_challenge, url};
};

export {setupChallenge};
