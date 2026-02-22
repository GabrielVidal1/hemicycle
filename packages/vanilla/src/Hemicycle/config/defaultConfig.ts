import { DEFAULT_HEMICYCLE_CONFIG as BASE_DEFAULT_HEMICYCLE_CONFIG } from "@hemicycle/core";
import { HemicycleConfig } from ".";

/**
 * Default values shared across all hemicycle modes.
 */
export const DEFAULT_HEMICYCLE_CONFIG: HemicycleConfig = {
  ...BASE_DEFAULT_HEMICYCLE_CONFIG,
  width: 800,
  height: 400,

  hideEmptySeats: false,

  seatConfig: {
    ...BASE_DEFAULT_HEMICYCLE_CONFIG.seatConfig,
    shape: "arc",
    color: "#ccc",
    borderRadius: 1.5,
  },
};
