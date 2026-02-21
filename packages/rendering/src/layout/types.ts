import { SeatPathParams } from "@rendering/svg/shapes/type";

/** Core layout properties for a seat, including its position and associated data. */
export type SeatLayout = SeatPathParams & {
  idx: number;
  rowIndex: number;
  seatIndex: number;

  // center coordinates, useful for placing labels or handling interactions
  x: number;
  y: number;
};
