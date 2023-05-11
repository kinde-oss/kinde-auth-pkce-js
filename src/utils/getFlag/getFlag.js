import {flagDataTypeMap} from '../../constants/index';
import {getClaimValue} from '../getClaimValue/getClaimValue';

const getFlag = (code, defaultValue, flagType) => {
  const flags = getClaimValue('feature_flags');
  const flag = flags && flags[code] ? flags[code] : {};

  if (flag.v == null && defaultValue == null) {
    throw Error(
      `Flag ${code} was not found, and no default value has been provided`
    );
  }

  if (flagType && flag.t && flagType !== flag.t) {
    throw Error(
      `Flag ${code} is of type ${flagDataTypeMap[flag.t]} - requested type ${
        flagDataTypeMap[flagType]
      }`
    );
  }
  return {
    code,
    type: flagDataTypeMap[flag.t || flagType],
    value: flag.v == null ? defaultValue : flag.v,
    is_default: flag.v == null
  };
};

export {getFlag};
