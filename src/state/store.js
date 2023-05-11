const createStore = () => {
  let items = {};

  const getItem = (key) => items[key];

  const setItem = (key, value) => {
    items[key] = value;
  };

  const removeItem = (key) => {
    delete items[key];
  };

  const reset = () => {
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
