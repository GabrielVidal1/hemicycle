import { ParamErrorFunction } from "@hemicycle/helpers";
import { SEAT_SHAPES, SeatConfig } from "./seatConfig";

export function validateSeatConfig(
  seatConfig: SeatConfig,
  logger: ParamErrorFunction,
) {
  if ((seatConfig.borderRadius ?? 1) < 0) {
    logger("seatConfig.borderRadius", "Border radius cannot be negative.");
  }

  if (seatConfig.shape && !SEAT_SHAPES.includes(seatConfig.shape)) {
    logger(
      "seatConfig.shape",
      `Invalid seat shape. Supported shapes are: ${SEAT_SHAPES.join(", ")}.`,
    );
  }
}
