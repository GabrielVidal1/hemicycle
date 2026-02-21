import { SeatShape } from "../types";
import { sectorPath } from "./arc";
import { circularSeatPath } from "./circle";
import { rectangularSeatPath } from "./rect";
import { SeatPathGenerator } from "./type";

export const seatPathGenerators: Record<SeatShape, SeatPathGenerator> = {
  arc: sectorPath,
  circle: circularSeatPath,
  rect: rectangularSeatPath,
};
