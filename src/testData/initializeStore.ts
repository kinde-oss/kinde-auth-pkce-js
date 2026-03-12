import {store} from '../state/store';
import {getAccessTokenStub} from './accessTokenStub';
import {getIdTokenStub} from './idTokenStub';

const initializeStore = () => {
  store.setItem('kinde_access_token', getAccessTokenStub());
  store.setItem('kinde_id_token', getIdTokenStub());
};

export {initializeStore};
