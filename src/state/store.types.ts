export interface Store {
  setItem: (key: string, value: unknown) => void;
  getItem: (key: string) => unknown;
  removeItem: (key: string) => void;
  reset: () => void;
}

export type StoreItems = {
  [key: string]: unknown;
};
