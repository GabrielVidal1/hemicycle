export function polar(r: number, angleRad: number) {
  return { x: r * Math.cos(angleRad), y: r * Math.sin(angleRad) };
}
