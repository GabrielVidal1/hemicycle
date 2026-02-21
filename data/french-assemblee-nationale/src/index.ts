import { HemicycleWithAislesProps } from "@hemicycle/core";

export const frAssembleeNationaleHemicycleProps: Omit<
  HemicycleWithAislesProps,
  "data"
> = {
  rows: 14,
  totalAngle: 190,
  seatsPerSection: [73, 85, 87, 82, 80, 81, 86, 76],
  aisleNumber: 7,
  mirror: true,
  innerRadius: 30,
  outerRadius: 95,
};
