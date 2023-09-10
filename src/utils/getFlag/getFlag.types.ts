import type {KindeFlagValueType} from '../../types';

export type KindeFlagType<T extends keyof KindeFlagValueType> = {
  t: T;
  v: KindeFlagValueType[T];
};
