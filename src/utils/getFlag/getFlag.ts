import {flagDataTypeMap} from '../../constants/index';
import {getClaimValue} from '../getClaimValue/getClaimValue';
import type {KindeFlagType} from './getFlag.types';
import type {
  KindeFlag,
  KindeFlagValueType,
  KindeFlagTypeCode,
  KindeFlagTypeString
} from '../../types';

const getFlag = <T extends KindeFlagTypeCode>(
  code: string,
  defaultValue?: KindeFlagValueType[T],
  flagType?: T
): KindeFlag<T> => {
  const flags = getClaimValue('feature_flags') as {[key: string]: unknown};
  const flag = (
    flags && flags[code] ? flags[code] : {}
  ) as KindeFlagType<KindeFlagTypeCode>;

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
    type: flagDataTypeMap[flag.t || flagType] as KindeFlagTypeString[T] | null,
    value: (flag.v == null ? defaultValue : flag.v) as KindeFlagValueType[T],
    is_default: flag.v == null
  };
};

export {getFlag};
