/**
 * Storage adapter that bridges between legacy kinde_* key format and @kinde/js-utils StorageKeys format
 * This allows us to use js-utils functions while maintaining backward compatibility
 */

import {
  SessionBase,
  type StorageKeys,
  type SessionManager
} from '@kinde/js-utils';
import {store} from './store';

const KEY_MAP: Record<string, string> = {
  accessToken: 'accessToken',
  idToken: 'idToken',
  refreshToken: 'kinde_refresh_token',
  state: 'kinde_state',
  nonce: 'kinde_nonce',
  codeVerifier: 'kinde_code_verifier'
};

export class KindeStorageAdapter<V extends string = StorageKeys>
  extends SessionBase<V>
  implements SessionManager<V>
{
  asyncStore = false;

  // Map between js-utils StorageKeys and our storage
  // For accessToken and idToken, we store them directly with those keys (raw JWT strings)
  // For other keys, we map to our kinde_* format
  private mapKey(itemKey: V | StorageKeys): string {
    return KEY_MAP[itemKey as string] || (itemKey as string);
  }

  getSessionItem<T = unknown>(itemKey: V | StorageKeys): T | unknown | null {
    const mappedKey = this.mapKey(itemKey);
    const value = store.getItem(mappedKey) as T | null;
    return value;
  }

  setSessionItem<T = unknown>(itemKey: V | StorageKeys, itemValue: T): void {
    const mappedKey = this.mapKey(itemKey);
    store.setItem(mappedKey, itemValue);
    // Notify listeners from parent class
    super.notifyListeners();
  }

  removeSessionItem(itemKey: V | StorageKeys): void {
    const mappedKey = this.mapKey(itemKey);
    store.removeItem(mappedKey);
    // Notify listeners from parent class
    super.notifyListeners();
  }

  destroySession(): void {
    store.reset();
    // Notify listeners from parent class
    super.notifyListeners();
  }
}
