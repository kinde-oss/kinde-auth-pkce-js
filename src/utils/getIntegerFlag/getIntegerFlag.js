import {getFlag} from '../getFlag/getFlag';

const getIntegerFlag = (code, defaultValue) => {
  try {
    const flag = getFlag(code, defaultValue, 'i');
    return flag.value;
  } catch (err) {
    console.error(err);
    return err;
  }
};

export {getIntegerFlag};
