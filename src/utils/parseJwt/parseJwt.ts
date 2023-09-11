import { JWT } from "../isValidJwt/isValidJwt.types";

const parseJwt = (token: string): JWT | null => {
  try {
    return JSON.parse(atob(token.split('.')[1]));
  } catch (e) {
    return null;
  }
};

export {parseJwt};
