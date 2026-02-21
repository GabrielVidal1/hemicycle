import { SeatLayout } from "../../Seat/types";

interface ComputeSeatLayoutParams {
  rows: number;
  innerRadius: number;
  radialStep: number;
  totalAngleRad: number;
  seatsPerRow: number[];
  seatMargin: number;
  effectiveRowMargin: number;
  angleOffset: number;

  // If true, the layout will be mirrored horizontally (useful for the right side of the hemicycle)
  mirror?: boolean;
}

export function computeSeatLayout({
  rows,
  innerRadius,
  radialStep,
  totalAngleRad,
  seatsPerRow,
  seatMargin,
  effectiveRowMargin,
  angleOffset,
  mirror = false,
}: ComputeSeatLayoutParams): SeatLayout[] {
  const layout: SeatLayout[] = [];
  let globalIdx = 0;

  const arcStart =
    Math.PI + (Math.PI - totalAngleRad) / 2 + (angleOffset * Math.PI) / 180;

  for (let rowIndex = 0; rowIndex < rows; rowIndex++) {
    const rowInnerR = innerRadius + rowIndex * radialStep;
    const rowOuterR = rowInnerR + radialStep;

    const bandInnerR = rowInnerR + effectiveRowMargin / 2;
    const bandOuterR = rowOuterR - effectiveRowMargin / 2;
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
        // Mirror angles horizontally (across Y axis)
        const mirroredA1 = Math.PI - a2;
        const mirroredA2 = Math.PI - a1;

        a1 = mirroredA1;
        a2 = mirroredA2;
      }

      const midAngle = (a1 + a2) / 2;
      const x = midR * Math.cos(midAngle);
      const y = midR * Math.sin(midAngle);

      layout.push({
        idx: globalIdx++,
        rowIndex,
        seatIndex,
        innerR: bandInnerR,
        outerR: bandOuterR,
        angle1Rad: a1,
        angle2Rad: a2,
        x,
        y,
      });
    }
  }

  return layout;
}
