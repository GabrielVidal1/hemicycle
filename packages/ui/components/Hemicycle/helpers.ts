export function polar(r: number, angleRad: number) {
  return { x: r * Math.cos(angleRad), y: r * Math.sin(angleRad) };
}

export function sectorPath(
  innerR: number,
  outerR: number,
  angle1Rad: number,
  angle2Rad: number,
): string {
  const i1 = polar(innerR, angle1Rad);
  const i2 = polar(innerR, angle2Rad);
  const o1 = polar(outerR, angle1Rad);
  const o2 = polar(outerR, angle2Rad);
  const largeArc = Math.abs(angle2Rad - angle1Rad) > Math.PI ? 1 : 0;
  const sweep = angle2Rad > angle1Rad ? 1 : 0;

  return [
    `M ${i1.x} ${i1.y}`,
    `A ${innerR} ${innerR} 0 ${largeArc} ${sweep} ${i2.x} ${i2.y}`,
    `L ${o2.x} ${o2.y}`,
    `A ${outerR} ${outerR} 0 ${largeArc} ${1 - sweep} ${o1.x} ${o1.y}`,
    "Z",
  ].join(" ");
}

export function distributeSeats(
  totalSeats: number,
  rows: number,
  innerRadius: number,
  radialStep: number,
  effectiveRowMargin: number,
): number[] {
  const midRadii = Array.from({ length: rows }, (_, i) => {
    const rowInnerR = innerRadius + i * radialStep;
    const rowOuterR = rowInnerR + radialStep;
    const bandInnerR = rowInnerR + effectiveRowMargin / 2;
    const bandOuterR = rowOuterR - effectiveRowMargin / 2;
    return (bandInnerR + bandOuterR) / 2;
  });

  const totalArc = midRadii.reduce((s, r) => s + r, 0);
  const real = midRadii.map((r) => (r / totalArc) * totalSeats);
  const floored = real.map(Math.floor);
  const remainder = real.map((v, i) => v - floored[i]);
  const leftover = totalSeats - floored.reduce((a, b) => a + b, 0);

  const indices = remainder.map((r, i) => ({ r, i })).sort((a, b) => b.r - a.r);

  for (let k = 0; k < leftover; k++) floored[indices[k].i]++;

  return floored.map((n) => Math.max(n, 1));
}
