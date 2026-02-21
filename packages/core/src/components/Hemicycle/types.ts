import { SeatConfig } from "../Seat/types";

export type BaseHemicycleData = {
  id: string | number;
} & Pick<SeatConfig, "shape" | "color" | "props">;

export type HemicycleDataBase<T extends object> = BaseHemicycleData & T;

type HemicycleDataWithCoordinates<T extends object> = HemicycleDataBase<T> & {
  x: number;
  y: number;
  idx?: never;
};

type HemicycleDataWithIndex<T extends object> = HemicycleDataBase<T> & {
  /** Index of the seat in the layout (required if no coordinates). */
  idx: number;
};

export type HemicycleData<T extends object = object> =
  | HemicycleDataWithCoordinates<T>
  | HemicycleDataWithIndex<T>;

export const isHemicycleDataWithCoordinates = <T extends object>(
  data: HemicycleData<T>,
): data is HemicycleDataWithCoordinates<T> => {
  return "x" in data && "y" in data;
};
