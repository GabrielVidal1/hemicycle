import { HemicycleParamValidationError, sum } from "@hemicycle/helpers";
import { HemicycleConfig } from "hemicycleEngine/config";

export function validateConfig(config: HemicycleConfig) {
  if (config.rows <= 0)
    throw new HemicycleParamValidationError(
      "rows",
      "Number of rows must be greater than zero.",
    );
  if (config.innerRadius < 0 || config.outerRadius <= config.innerRadius)
    throw new HemicycleParamValidationError(
      "radii",
      "Invalid radii: innerRadius must be non-negative and less than outerRadius.",
    );
  if (config.rowMargin < 0)
    throw new HemicycleParamValidationError(
      "rowMargin",
      "Row margin must be a non-negative number.",
    );
  if (config.totalSeats <= 0)
    throw new HemicycleParamValidationError(
      "totalSeats",
      "Total seats must be greater than zero.",
    );

  if (config.totalAngle < 10 || config.totalAngle > 360)
    throw new HemicycleParamValidationError(
      "totalAngle",
      "Total angle must be between 10 and 360 degrees.",
    );

  if (config.seatsPerRow) {
    const total = sum(config.seatsPerRow);
    if (total !== config.totalSeats) {
      throw new HemicycleParamValidationError(
        "seatsPerRow",
        `Sum of seatsPerRow (${total}) must equal totalSeats (${config.totalSeats}).`,
      );
    }
  }
  const availableWidth = config.outerRadius - config.innerRadius;

  if (config.arcAislesCount) {
    if (config.arcAislesCount < 0 || config.arcAislesCount >= config.rows)
      throw new HemicycleParamValidationError(
        "arcAislesCount",
        "arcAislesCount must be a non-negative integer less than the number of rows.",
      );
    const minimumComputedWidth =
      config.arcAislesCount * config.arcAislesWidth +
      config.rows * config.rowMargin;
    if (availableWidth < minimumComputedWidth) {
      throw new HemicycleParamValidationError(
        "arcAislesCount",
        `With the given radii and rowMargin, the maximum number of arc aisles is ${Math.floor(availableWidth / config.arcAislesWidth)}. Reduce arcAislesCount or adjust radii/rowMargin.`,
      );
    }
  }

  if (config.arcAislesEvery) {
    if (config.arcAislesEvery <= 0 || config.arcAislesEvery >= config.rows)
      throw new HemicycleParamValidationError(
        "arcAislesEvery",
        "arcAislesEvery must be a positive integer less than the number of rows.",
      );

    const aislesCount = Math.floor((config.rows - 1) / config.arcAislesEvery);
    const minimumComputedWidth =
      aislesCount * config.arcAislesWidth + config.rows * config.rowMargin;
    if (availableWidth < minimumComputedWidth) {
      throw new HemicycleParamValidationError(
        "arcAislesEvery",
        `With the given radii and rowMargin, the maximum number of arc aisles is ${Math.floor(availableWidth / config.arcAislesWidth)}. Reduce arcAislesEvery or adjust radii/rowMargin.`,
      );
    }
  }
}
