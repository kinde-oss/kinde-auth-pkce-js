import {store} from '../state/store';
import {getAccessTokenStub} from './accessTokenStub';
import {getIdTokenStub} from './idTokenStub';
import {createMockJWT} from './createMockJWT';

const initializeStore = () => {
  // Store raw JWT strings for @kinde/js-utils compatibility
  const accessTokenJWT = createMockJWT(getAccessTokenStub());
  const idTokenJWT = createMockJWT(getIdTokenStub());

  store.setSessionItem('accessToken', accessTokenJWT);
  store.setSessionItem('idToken', idTokenJWT);
};

export {initializeStore};
