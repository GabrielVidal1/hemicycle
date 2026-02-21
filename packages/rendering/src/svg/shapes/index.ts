import { sectorPath } from "./arc";
import { circularSeatPath } from "./circle";
import { rectangularSeatPath } from "./rect";
import { SeatPathGenerator } from "./type";

export const seatPathGenerators: Record<
  "arc" | "circle" | "rect",
  SeatPathGenerator
> = {
  arc: sectorPath,
  circle: circularSeatPath,
  rect: rectangularSeatPath,
};
