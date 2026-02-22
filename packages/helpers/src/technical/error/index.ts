import { logger } from "../logger";

export class HemicycleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "HemicycleError";
  }
}

export class HemicycleParamValidationError extends HemicycleError {
  constructor(paramName: string, reason: string) {
    super(`Invalid parameter value "${paramName}": ${reason}`);
    this.name = "HemicycleParamValidationError";
  }
}

export type ParamErrorFunction = (paramName: string, reason: string) => void;

export const getParamValidator = (
  mode: "throw" | "warn" = "throw",
  suffix = "",
): ParamErrorFunction => {
  return (paramName, reason) => {
    const message = `Invalid parameter value "${suffix}${paramName}": ${reason}`;
    if (mode === "throw") {
      throw new HemicycleParamValidationError(`${suffix}${paramName}`, reason);
    } else {
      logger.warn(message);
    }
  };
};
