import { SeatLayout } from "hemicycleEngine/layout";

export type HemicycleDataWithCoordinates = {
  seatIndex: number;
  rowIndex: number;
  idx?: never;
};

export type HemicycleDataWithIdx = {
  /**
   * Index of the seat in the layout (required if no coordinates).
   * */
  idx: number;
  seatIndex?: never;
  rowIndex?: never;
};

export type HemicycleData<T extends object = object> = T &
  (HemicycleDataWithCoordinates | HemicycleDataWithIdx);

/** Combined type for a seat, including both layout, style and associated data. */
export type SeatData<
  T extends object = object,
  S extends object = SeatLayout,
> = S & {
  data: HemicycleData<T> | null;
};
