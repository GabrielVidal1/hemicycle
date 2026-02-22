import {
  getParamValidator,
  HemicycleParamValidationError,
} from "@hemicycle/helpers";
import { HemicycleConfig } from ".";
import { validateSeatConfig } from "./validateSeatConfig";

export function validateConfig(config: HemicycleConfig): void {
  if (config.width <= 0) {
    throw new HemicycleParamValidationError(
      "width",
      "Width must be a positive number.",
    );
  }
  if (config.height <= 0) {
    throw new HemicycleParamValidationError(
      "height",
      "Height must be a positive number.",
    );
  }

  const validator = getParamValidator("throw", "seatConfig.");
  validateSeatConfig(config.seatConfig, validator);
}
