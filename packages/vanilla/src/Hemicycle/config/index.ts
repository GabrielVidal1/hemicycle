import * as Core from "@hemicycle/core";
import { SeatConfig } from "./seatConfig";

export interface HemicycleConfig<SeatConfigType extends SeatConfig = SeatConfig>
  extends Core.HemicycleConfig {
  width: number;
  height: number;

  seatConfig: SeatConfigType;

  /** Optional flag to hide seats that are not occupied (i.e., have no associated data). Defaults to false. */
  hideEmptySeats?: boolean;
}
