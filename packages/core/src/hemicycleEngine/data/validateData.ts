import { HemicycleParamValidationError } from "@hemicycle/helpers";
import { HemicycleConfig } from "../config";
import {
  isHemicycleDataWithCoordinates,
  isHemicycleDataWithIdx,
} from "./helpers";
import { HemicycleData } from "./types";

export function validateData<T extends object>(
  data: HemicycleData<T>[],
  config: HemicycleConfig,
  seatsPerRow: number[],
): void {
  if (!Array.isArray(data)) {
    throw new HemicycleParamValidationError("data", "Data should be an array.");
  }

  // Basic validation to check if each data item has either coordinates or idx
  data.forEach((item, index) => {
    if (isHemicycleDataWithCoordinates(item) && isHemicycleDataWithIdx(item)) {
      console.warn(
        `Data item at index ${index} has both coordinates and idx, coordinates will be used.`,
      );
    }
    if (
      !isHemicycleDataWithCoordinates(item) &&
      !isHemicycleDataWithIdx(item)
    ) {
      console.warn(
        `Data item at index ${index} is missing both coordinates and idx, it will be ignored.`,
      );
    }

    // idx outside bounds
    if (isHemicycleDataWithIdx(item) && config.totalSeats <= item.idx) {
      console.warn(
        `Data item at index ${index} has idx ${item.idx} which is out of bounds (totalSeats: ${config.totalSeats}), it will be ignored.`,
      );
    }

    // coordinates outside bounds
    if (
      isHemicycleDataWithCoordinates(item) &&
      (item.rowIndex >= config.rows ||
        item.seatIndex >= seatsPerRow[item.rowIndex])
    ) {
      console.warn(
        `Data item at index ${index} has coordinates (rowIndex: ${item.rowIndex}, seatIndex: ${item.seatIndex}) which are out of bounds, it will be ignored.`,
      );
    }
  });
}
