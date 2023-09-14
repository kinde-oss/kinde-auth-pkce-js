import {getFlag} from '../getFlag/getFlag';

const getBooleanFlag = (
  code: string,
  defaultValue?: boolean
): boolean | Error => {
  try {
    const flag = getFlag<'b'>(code, defaultValue, 'b');
    return flag.value;
  } catch (err) {
    console.error(err);
    return err as Error;
  }
};

export {getBooleanFlag};
