import { HemicycleConfig as BaseHemicycleConfig } from "@hemicycle/core";
import { SeatConfig } from "./seatConfig";

export type HemicycleConfig = BaseHemicycleConfig & {
  width: number;
  height: number;

  seatConfig: SeatConfig;

  hideEmptySeats?: boolean;
};
