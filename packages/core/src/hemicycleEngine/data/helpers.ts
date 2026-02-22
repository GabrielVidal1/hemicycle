import {
  HemicycleData,
  HemicycleDataWithCoordinates,
  HemicycleDataWithIdx,
} from "hemicycleEngine/data/types";

export const isHemicycleDataWithCoordinates = <T extends object>(
  data: HemicycleData<T>,
): data is HemicycleDataWithCoordinates => {
  return "seatIndex" in data && "rowIndex" in data;
};

export const isHemicycleDataWithIdx = <T extends object>(
  data: HemicycleData<T>,
): data is HemicycleDataWithIdx => {
  return "idx" in data;
};
