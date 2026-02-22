import { HemicycleConfig } from "hemicycleEngine/config";
import { RowBand } from "./computeRowBands";

type DistributeSeatsFromTotalParams = Pick<
  HemicycleConfig,
  "rows" | "rowMargin" | "totalSeats"
>;

/**
 * Distributes seats across rows based on their radial position, ensuring a visually balanced layout.
 */
export function distributeSeatsFromTotal(
  rowBands: RowBand[],
  { rows, rowMargin, totalSeats }: DistributeSeatsFromTotalParams,
): number[] {
  // If there's only one row, allocate all seats to it.
  if (rows === 1) return [totalSeats];

  // If there is more rows that seats, allocate one seat per row until we run out of seats.
  if (rows >= totalSeats) {
    const distribution = Array(rows).fill(0);
    for (let i = 0; i < totalSeats; i++) {
      distribution[i]++;
    }
    return distribution;
  }

  const midRadii = rowBands.map(({ rowInnerRadius, rowOuterRadius }) => {
    const bandInnerR = rowInnerRadius + rowMargin / 2;
    const bandOuterR = rowOuterRadius - rowMargin / 2;
    return (bandInnerR + bandOuterR) / 2;
  });

  const totalArc = midRadii.reduce((s, r) => s + r, 0);
  const real = midRadii.map((r) => (r / totalArc) * totalSeats);
  const floored = real.map(Math.floor);
  const remainder = real.map((v, i) => v - floored[i]);
  const leftover = totalSeats - floored.reduce((a, b) => a + b, 0);

  const indices = remainder.map((r, i) => ({ r, i })).sort((a, b) => b.r - a.r);

  for (let k = 0; k < leftover; k++) floored[indices[k].i]++;

  const seatsPerRow = floored.map((n) => Math.max(n, 1));

  return seatsPerRow;
}
