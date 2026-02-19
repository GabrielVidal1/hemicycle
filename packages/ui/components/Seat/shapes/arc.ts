import { polar } from "../../../technical/polar";
import { SeatPathGenerator } from "./type";
export const sectorPath: SeatPathGenerator = ({
  innerR,
  outerR,
  angle1Rad,
  angle2Rad,
  cornerRadius = 6,
}): string => {
  const a1 = angle1Rad;
  const a2 = angle2Rad;
  const sweep = a2 > a1 ? 1 : 0;
  const largeArc = Math.abs(a2 - a1) > Math.PI ? 1 : 0;
  const dir = sweep ? 1 : -1;

  const r = Math.min(
    cornerRadius,
    (outerR - innerR) / 2,
    (Math.abs(a2 - a1) * innerR) / 2,
  );

  // Angular offsets where the rounded corners end and the arcs begin
  const dInner = r / innerR;
  const dOuter = r / outerR;

  // The 4 arc-start/end points (on the actual arc radii, inset from corners)
  const innerArcStart = polar(innerR, a1 + dir * dInner);
  const innerArcEnd = polar(innerR, a2 - dir * dInner);
  const outerArcStart = polar(outerR, a2 - dir * dOuter); // outer arc runs in 1-sweep direction
  const outerArcEnd = polar(outerR, a1 + dir * dOuter);

  // The 4 radial-line start/end points (inset from corners along the radial)
  const radA1Inner = polar(innerR + r, a1);
  const radA1Outer = polar(outerR - r, a1);
  const radA2Inner = polar(innerR + r, a2);
  const radA2Outer = polar(outerR - r, a2);

  return [
    `M ${innerArcStart.x} ${innerArcStart.y}`,
    `A ${innerR} ${innerR} 0 ${largeArc} ${sweep} ${innerArcEnd.x} ${innerArcEnd.y}`,
    `A ${r} ${r} 0 0 ${1 - sweep} ${radA2Inner.x} ${radA2Inner.y}`,
    `L ${radA2Outer.x} ${radA2Outer.y}`,
    `A ${r} ${r} 0 0 ${1 - sweep} ${outerArcStart.x} ${outerArcStart.y}`,
    `A ${outerR} ${outerR} 0 ${largeArc} ${1 - sweep} ${outerArcEnd.x} ${outerArcEnd.y}`,
    `A ${r} ${r} 0 0 ${1 - sweep} ${radA1Outer.x} ${radA1Outer.y}`,
    `L ${radA1Inner.x} ${radA1Inner.y}`,
    `A ${r} ${r} 0 0 ${1 - sweep} ${innerArcStart.x} ${innerArcStart.y}`,
    "Z",
  ].join(" ");
};
