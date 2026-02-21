import { SeatLayout } from "@hemicycle/rendering";
import { SeatData } from "../../Seat/types";
import { HemicycleData, isHemicycleDataWithCoordinates } from "../types";

interface MapSeatDataParams<T extends object> {
  layout: SeatLayout[];
  rawData: HemicycleData<T>[];
}

export function mapSeatData<T extends object>({
  layout,
  rawData,
}: MapSeatDataParams<T>): SeatData<T>[] {
  const dataMap = new Map(
    rawData.map((d) => [
      isHemicycleDataWithCoordinates(d) ? `${d.x}-${d.y}` : `${d.idx}`,
      d,
    ]),
  );

  return layout.map((seatLayout) => {
    const seatData: Partial<HemicycleData<T>> =
      dataMap.get(`${seatLayout.seatIndex}-${seatLayout.rowIndex}`) ??
      dataMap.get(`${seatLayout.idx}`) ??
      {};

    return {
      ...seatLayout,
      ...seatData,
    };
  });
}
