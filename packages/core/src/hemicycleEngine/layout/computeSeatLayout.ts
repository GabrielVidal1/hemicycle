import { times, toRadians } from "@hemicycle/helpers";
import { HemicycleConfig } from "hemicycleEngine/config";
import { RowBand } from "hemicycleEngine/seatDistribution/computeRowBands";
import { SeatLayout } from "./types";

type ComputeSeatLayoutParams = Pick<
  HemicycleConfig,
  "totalAngle" | "seatConfig" | "angleOffset" | "mirror" | "rowMargin"
> & {
  seatsPerRow: number[];
};

export function computeSeatLayout(
  rowBands: RowBand[],
  {
    seatConfig,
    seatsPerRow,
    totalAngle,
    rowMargin,
    angleOffset,
    mirror,
  }: ComputeSeatLayoutParams,
): SeatLayout[] {
  const rows = rowBands.length;

  const totalAngleRad = toRadians(totalAngle);

  const seatMargin = seatConfig?.seatMargin ?? 1;
  const effectiveRowMargin = rowMargin ?? seatConfig?.seatMargin ?? 0;
  const arcStart =
    Math.PI + (Math.PI - totalAngleRad) / 2 + toRadians(angleOffset);

  const layout: SeatLayout[] = [];
  let globalIdx = 0;
  const seatMatrix: SeatLayout[][] = [];

  for (let rowIndex = 0; rowIndex < rows; rowIndex++) {
    const { rowInnerRadius, rowOuterRadius } = rowBands[rowIndex];
    seatMatrix[rowIndex] = [];

    // apply row margin inside band
    const bandInnerR = rowInnerRadius + effectiveRowMargin / 2;
    const bandOuterR = rowOuterRadius - effectiveRowMargin / 2;
    const midR = (bandInnerR + bandOuterR) / 2;

    const seatMarginRad = seatMargin / midR;

    const N = seatsPerRow[rowIndex];
    const slotAngleActual = totalAngleRad / N;
    const seatAngle = slotAngleActual - seatMarginRad;

    for (let seatIndex = 0; seatIndex < N; seatIndex++) {
      const slotStart = arcStart + seatIndex * slotAngleActual;

      let a1 = slotStart + seatMarginRad / 2;
      let a2 = a1 + seatAngle;

      if (mirror) {
        const mirroredA1 = Math.PI - a2;
        const mirroredA2 = Math.PI - a1;

        a1 = mirroredA1;
        a2 = mirroredA2;
      }

      const midAngle = (a1 + a2) / 2;
      const x = midR * Math.cos(midAngle);
      const y = midR * Math.sin(midAngle);

      const seat = {
        idx: globalIdx++,
        radialIdx: -1, // temp
        rowIndex,
        seatIndex,
        innerR: bandInnerR,
        outerR: bandOuterR,
        angle1Rad: a1,
        angle2Rad: a2,
        x,
        y,
      };

      layout.push(seat);
      seatMatrix[rowIndex][seatIndex] = seat;
    }
  }

  let radialCounter = 0;
  const maxSeats = Math.max(...seatsPerRow);

  const rowOrder = mirror
    ? times(rows, (i) => rows - 1 - i)
    : times(rows, (i) => i);

  for (let seatIndex = 0; seatIndex < maxSeats; seatIndex++) {
    for (const rowIndex of rowOrder) {
      const seat = seatMatrix[rowIndex][seatIndex];
      if (seat) {
        seat.radialIdx = radialCounter++;
      }
    }
  }

  return layout;
}
