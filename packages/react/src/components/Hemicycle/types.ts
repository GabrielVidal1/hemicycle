import { HemicycleData } from "@hemicycle/core";
import { DataWithConfig, HemicycleConfig } from "@hemicycle/vanilla";

type SeatConfig = HemicycleConfig["seatConfig"] & {
  wrapper?: (content: React.ReactNode) => React.ReactNode;
};

type DataType<T extends object> = DataWithConfig<T> & SeatConfig;

export type HemicycleProps<T extends object = object> = HemicycleConfig & {
  data: HemicycleData<DataType<T>>[];
};
