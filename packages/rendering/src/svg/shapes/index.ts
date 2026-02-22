import { sectorPath } from "./arc";
import { circularSeatPath } from "./circle";
import { rectangularSeatPath } from "./rect";
import { SvgPathGenerator } from "./type";

export const svgPathGenerators: Record<
  "arc" | "circle" | "rect",
  SvgPathGenerator
> = {
  arc: sectorPath,
  circle: circularSeatPath,
  rect: rectangularSeatPath,
};

export * from "./type";
