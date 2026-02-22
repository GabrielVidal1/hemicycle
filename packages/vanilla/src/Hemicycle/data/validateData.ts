import { getParamValidator } from "@hemicycle/helpers";
import { validateSeatConfig } from "Hemicycle/config/validateSeatConfig";
import { DataWithConfig } from "./types";

export function validateData<T extends object>(
  data: DataWithConfig<T>[],
): void {
  // Basic validation to check if each data item has either coordinates or idx
  data.forEach((item, index) => {
    const validator = getParamValidator("warn", `data[${index}].`);
    validateSeatConfig(item, validator);
  });
}
