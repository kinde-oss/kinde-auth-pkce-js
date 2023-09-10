import {getFlag} from '../getFlag/getFlag';

const getIntegerFlag = (code: string, defaultValue?: number): number | Error => {
  try {
    const flag = getFlag<'i'>(code, defaultValue, 'i');
    return flag.value;
  } catch (err) {
    console.error(err);
    return err as Error;
  }
};

export {getIntegerFlag};
