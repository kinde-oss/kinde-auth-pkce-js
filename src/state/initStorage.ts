/**
 * Initialize the storage adapter for @kinde/js-utils
 * This must be called before using any js-utils functions
 */

import {setActiveStorage} from '../kindeUtils';
import {KindeStorageAdapter} from './storageAdapter';

// Create and set the storage adapter only if not already set
let adapter: KindeStorageAdapter | null = null;

export const initializeStorageAdapter = () => {
  if (!adapter) {
    adapter = new KindeStorageAdapter();
    setActiveStorage(adapter);
  }
  return adapter;
};

// Initialize on module load
initializeStorageAdapter();

export {adapter};
