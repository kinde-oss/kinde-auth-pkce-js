import {store} from '../state/store';
import {accessTokenStub} from './accessTokenStub';
import {idTokenStub} from './idTokenStub';

const initializeStore = () => {
  store.setItem('kinde_access_token', accessTokenStub);
  store.setItem('kinde_id_token', idTokenStub);
};
export {initializeStore};
