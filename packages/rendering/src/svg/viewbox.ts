import { polar, toRadians } from "@hemicycle/helpers";

interface ComputeViewBoxParams {
  outerRadius: number;
  totalAngle: number;
  pad?: number;
}

export function computeViewBox({
  outerRadius,
  totalAngle,
  pad = 4,
}: ComputeViewBoxParams): string {
  const totalAngleRad = toRadians(totalAngle);
  const arcStartAngle = Math.PI + (Math.PI - totalAngleRad) / 2;
  const arcEndAngle = arcStartAngle + totalAngleRad;

  const p1 = polar(outerRadius, arcStartAngle);
  const p2 = polar(outerRadius, arcEndAngle);

  const minX = Math.min(p1.x, p2.x, -outerRadius) - pad;
  const maxX = Math.max(p1.x, p2.x, outerRadius) + pad;
  const minY = -outerRadius - pad;
  const maxY = Math.max(p1.y, p2.y, 0) + pad;

  return `${minX} ${minY} ${maxX - minX} ${maxY - minY}`;
}
