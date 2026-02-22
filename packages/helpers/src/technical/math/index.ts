export function polar(r: number, angleRad: number) {
  return { x: r * Math.cos(angleRad), y: r * Math.sin(angleRad) };
}

export function sum(arr: number[]) {
  return arr.reduce((acc, val) => acc + val, 0);
}

export function toRadians(deg: number) {
  return (deg * Math.PI) / 180;
}
