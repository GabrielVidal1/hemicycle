export type SeatPathParams = {
  innerR: number;
  outerR: number;
  angle1Rad: number;
  angle2Rad: number;

  // Optional corner radius for arc and rectangular seats (ignored for circular seats).
  borderRadius?: number;
};

export type SeatPathGenerator = (params: SeatPathParams) => string;
