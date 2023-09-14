import type {StoreItems, Store} from './store.types';

const createStore = (): Store => {
  let items: StoreItems = {};

  const getItem = (key: string): unknown => {
    return items[key];
  };

  const setItem = (key: string, value: unknown): void => {
    items[key] = value;
  };

  const removeItem = (key: string): void => {
    delete items[key];
  };

  const reset = (): void => {
    items = {};
  };

  return {
    reset,
    getItem,
    removeItem,
    setItem
  };
};

const store = createStore();

export {store};
