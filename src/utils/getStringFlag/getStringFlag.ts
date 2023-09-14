import {getFlag} from '../getFlag/getFlag';

const getStringFlag = (code: string, defaultValue?: string): string | Error => {
  try {
    const flag = getFlag<'s'>(code, defaultValue, 's');
    return flag.value;
  } catch (err) {
    console.error(err);
    return err as Error;
  }
};

export {getStringFlag};
