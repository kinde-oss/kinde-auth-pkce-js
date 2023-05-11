import {getFlag} from '../getFlag/getFlag';

const getStringFlag = (code, defaultValue) => {
  try {
    const flag = getFlag(code, defaultValue, 's');
    return flag.value;
  } catch (err) {
    console.error(err);
    return err;
  }
};

export {getStringFlag};
