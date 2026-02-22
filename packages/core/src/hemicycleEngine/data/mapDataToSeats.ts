import { SeatPosition } from "hemicycleEngine/layout";
import { DEFAULT_HEMICYCLE_CONFIG, HemicycleConfig } from "../config";
import { isHemicycleDataWithCoordinates } from "./helpers";
import { HemicycleData, SeatData } from "./types";

interface MapSeatDataParams<T extends object, S extends object = SeatPosition> {
  layout: S[];
  data: HemicycleData<T>[];

  orderBy?: HemicycleConfig["seatConfig"]["orderBy"];
}

export function mapDataToSeats<T extends object, S extends SeatPosition>({
  layout,
  data,
  orderBy = DEFAULT_HEMICYCLE_CONFIG.seatConfig.orderBy,
}: MapSeatDataParams<T, S>): SeatData<T, S>[] {
  const dataMap = new Map(
    data.map((d, i) => [
      isHemicycleDataWithCoordinates(d)
        ? `${d.seatIndex}-${d.rowIndex}`
        : `${d.idx ?? i}`,
      d,
    ]),
  );

  return layout.map((seatLayout) => {
    const seatLayoutIdx =
      orderBy === "row" ? `${seatLayout.idx}` : `${seatLayout.radialIdx}`;

    const seatData: HemicycleData<T> | null =
      dataMap.get(`${seatLayout.seatIndex}-${seatLayout.rowIndex}`) ??
      dataMap.get(`${seatLayoutIdx}`) ??
      null;

    return {
      ...seatLayout,
      data: seatData,
    };
  });
}
