import { DEFAULT_SEAT_CONFIG } from "../Seat/constant";
import { HemicycleProps } from "./HemicycleProps";
import { HemicycleWithAislesProps } from "./HemicycleWithAisles";

/**
 * Default values shared across all hemicycle modes.
 */
export const DEFAULT_HEMICYCLE_BASE_PROPS: Required<
  Omit<HemicycleProps, "seatDistribution" | "seatConfig">
> = {
  data: [],
  rows: 5,
  innerRadius: 40,
  outerRadius: 95,
  height: 400,
  width: 800,
  totalAngle: 180,
  angleOffset: 0,
  rowMargin: 1,
  totalSeats: 100,
  mirror: false,
};

export const DEFAULT_HEMICYCLE_WITH_AISLES_PROPS: Required<
  Omit<
    HemicycleWithAislesProps<object>,
    keyof HemicycleProps | "seatsPerSection"
  >
> = {
  aisleNumber: 0,
  aisleWidth: 2,
  mirrorSections: false,
};

export const DEFAULT_HEMICYCLE_PROPS = {
  ...DEFAULT_HEMICYCLE_BASE_PROPS,
  ...DEFAULT_HEMICYCLE_WITH_AISLES_PROPS,
  seatConfig: DEFAULT_SEAT_CONFIG,
};
