export class HemicycleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "HemicycleError";
  }
}

export function isHemicycleError(error: unknown): error is HemicycleError {
  return error instanceof Error && error.name === "HemicycleError";
}

export class HemicycleParamValidationError extends HemicycleError {
  constructor(paramName: string | string[], reason: string) {
    const paramNames = Array.isArray(paramName)
      ? paramName.join(", ")
      : paramName;
    super(`Invalid parameter value "${paramNames}": ${reason}`);
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
      console.warn(message);
    }
  };
};
