import {getFlag} from '../getFlag/getFlag';

const getBooleanFlag = (code, defaultValue) => {
  try {
    const flag = getFlag(code, defaultValue, 'b');
    return flag.value;
  } catch (err) {
    console.error(err);
    return err;
  }
};

export {getBooleanFlag};
