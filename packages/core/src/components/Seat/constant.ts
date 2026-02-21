import { SeatConfig } from "./types";

/**
 * Default configuration for seat appearance.
 */
export const DEFAULT_SEAT_CONFIG: SeatConfig = {
  shape: "arc",
  seatMargin: 1,
  wrapper: (content) => content,
  color: "#ccc",
  props: {},
  borderRadius: 1.5,
};
