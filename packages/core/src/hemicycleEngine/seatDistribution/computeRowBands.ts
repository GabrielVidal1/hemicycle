import {
  HemicycleArcAisleConfig,
  HemicycleConfig,
} from "hemicycleEngine/config";

export type RowBand = {
  rowInnerRadius: number;
  rowOuterRadius: number;
};

type ComputeRowBandsParams = Pick<
  HemicycleConfig,
  "rows" | "innerRadius" | "outerRadius" | "rowMargin"
> &
  HemicycleArcAisleConfig;

/**
 * Computes the inner and outer radius for each row, taking into account arc aisles if specified.
 * The function first calculates the total space taken by arc aisles and then divides the remaining space equally among rows.
 */
export function computeRowBands({
  rows,
  innerRadius,
  outerRadius,
  arcAislesWidth,
  arcAislesCount,
  arcAislesEvery,
}: ComputeRowBandsParams): RowBand[] {
  const totalSpan = outerRadius - innerRadius;

  // --- Compute aisle indices ---
  const aisleIndices: number[] = [];
  if (arcAislesWidth && arcAislesWidth > 0) {
    if (typeof arcAislesCount === "number") {
      const count = Math.min(arcAislesCount, rows - 1);
      const step = rows / (count + 1);
      for (let i = 1; i <= count; i++) {
        aisleIndices.push(Math.floor(i * step));
      }
    }

    if (typeof arcAislesEvery === "number") {
      for (let i = arcAislesEvery; i < rows; i += arcAislesEvery) {
        aisleIndices.push(i);
      }
    }
  }

  const totalAisleThickness = (arcAislesWidth ?? 0) * aisleIndices.length;

  const availableSpan = totalSpan - totalAisleThickness;
  const rowThickness = availableSpan / rows;

  const bands: RowBand[] = [];

  let currentRadius = innerRadius;

  for (let i = 0; i < rows; i++) {
    const rowInnerRadius = currentRadius;
    const rowOuterRadius = rowInnerRadius + rowThickness;

    bands.push({
      rowInnerRadius,
      rowOuterRadius,
    });

    currentRadius = rowOuterRadius;

    if (aisleIndices.includes(i + 1)) {
      currentRadius += arcAislesWidth!;
    }
  }

  return bands;
}
