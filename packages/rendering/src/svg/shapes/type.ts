type ArcGeometry = {
  innerR: number;
  outerR: number;
  angle1Rad: number;
  angle2Rad: number;
};

export type Geometry = ArcGeometry & {
  // Optional corner radius for arc and rectangular seats (ignored for circular seats).
  borderRadius?: number;
};

export type SvgPathGenerator = (params: Geometry) => string;
