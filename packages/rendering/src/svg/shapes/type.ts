type ArcGeometry = {
  innerR: number;
  outerR: number;
  angle1Rad: number;
  angle2Rad: number;
};

export interface Geometry extends ArcGeometry {
  /** Optional roundedness for arc and rectangular seats (default: 0, ignored for circular seats). */
  borderRadius?: number;

  /** For circle shape, radius of the seat. For arc and rect, distance from inner to outer radius (default: 5) */
  radius?: number;
}

export type SvgPathGenerator = (params: Geometry) => string;
