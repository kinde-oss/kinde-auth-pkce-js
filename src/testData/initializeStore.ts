import {store} from '../state/store';
import {accessTokenStub} from './accessTokenStub';
import {idTokenStub} from './idTokenStub';
import {createMockJWT} from './createMockJWT';

const initializeStore = () => {
  // Store decoded tokens for backward compatibility
  store.setItem('kinde_access_token', accessTokenStub);
  store.setItem('kinde_id_token', idTokenStub);

  // Store raw JWT strings for @kinde/js-utils compatibility
  const accessTokenJWT = createMockJWT(accessTokenStub);
  const idTokenJWT = createMockJWT(idTokenStub);

  store.setSessionItem('accessToken', accessTokenJWT);
  store.setSessionItem('idToken', idTokenJWT);
};

export {initializeStore};
