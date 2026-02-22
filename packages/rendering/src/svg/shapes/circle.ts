import { SvgPathGenerator } from "./type";

export const circularSeatPath: SvgPathGenerator = ({
  innerR,
  outerR,
  angle1Rad,
  angle2Rad,
}) => {
  const delta = Math.abs(angle2Rad - angle1Rad);
  const midAngle = (angle1Rad + angle2Rad) / 2;
  const r = (innerR + outerR) / 2;

  // radial limit
  const radialLimit = (outerR - innerR) / 2;

  // angular limit
  const angularLimit = r * Math.sin(delta / 2);

  const radius = Math.min(radialLimit, angularLimit);

  const cx = r * Math.cos(midAngle);
  const cy = r * Math.sin(midAngle);

  return `
    M ${cx - radius}, ${cy}
    a ${radius},${radius} 0 1,0 ${radius * 2},0
    a ${radius},${radius} 0 1,0 -${radius * 2},0
  `;
};
