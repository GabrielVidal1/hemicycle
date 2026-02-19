import { useMemo } from "react";
import { distributeSeats, polar, sectorPath } from "./helpers";
import { Seat, SeatRenderer } from "./Seat";
import { HemicycleData } from "./types";

type HemicycleBaseProps = {
  rows: number;
  data: HemicycleData[];
  innerRadius?: number;
  outerRadius?: number;
  height?: number;
  width?: number;
  totalAngle?: number;
  rowMargin?: number;
};

type ManualSeatProps = {
  seatWidth?: number;
  seatHeight?: number;
  seatMargin?: number;
  totalSeats?: never;
};

type TotalSeatsProps = {
  totalSeats?: number;
  seatWidth?: never;
  seatHeight?: never;
  seatMargin?: never;
};

type HemicycleProps = HemicycleBaseProps & (ManualSeatProps | TotalSeatsProps);

export const Hemicycle: React.FC<HemicycleProps> = ({
  rows,
  innerRadius = 40,
  outerRadius = 95,
  totalAngle = 180,
  data: rawData = [],
  height,
  width,
  rowMargin,
  ...modeProps
}) => {
  const totalAngleRad = (totalAngle * Math.PI) / 180;
  const radialStep = (outerRadius - innerRadius) / rows;

  const isTotalSeatsMode =
    "totalSeats" in modeProps && modeProps.totalSeats != null;

  // seatMargin is a linear distance (same units as innerRadius/outerRadius)
  const seatMarginLinear = isTotalSeatsMode
    ? 1
    : ((modeProps as ManualSeatProps).seatMargin ?? 1);

  // rowMargin defaults to the same linear distance as seatMargin
  const effectiveRowMargin = rowMargin ?? seatMarginLinear;

  const seatsPerRow = useMemo(() => {
    if (isTotalSeatsMode) {
      const { totalSeats = 100 } = modeProps as TotalSeatsProps;
      return distributeSeats(
        totalSeats,
        rows,
        innerRadius,
        radialStep,
        effectiveRowMargin,
      );
    }

    return Array.from({ length: rows }, (_, rowIndex) => {
      const rowInnerR = innerRadius + rowIndex * radialStep;
      const rowOuterR = rowInnerR + radialStep;
      const bandInnerR = rowInnerR + effectiveRowMargin / 2;
      const bandOuterR = rowOuterR - effectiveRowMargin / 2;
      const midR = (bandInnerR + bandOuterR) / 2;

      // Angular margin that produces a constant linear gap at this radius
      const seatMarginRad = seatMarginLinear / midR;
      // Natural seat angle: as tall as it is wide (square-ish)
      const naturalSeatAngle = (radialStep - effectiveRowMargin) / midR;
      const slotAngle = naturalSeatAngle + seatMarginRad;

      return Math.max(1, Math.round(totalAngleRad / slotAngle));
    });
  }, [
    isTotalSeatsMode,
    modeProps,
    rows,
    innerRadius,
    radialStep,
    totalAngleRad,
    seatMarginLinear,
    effectiveRowMargin,
  ]);

  const data: Seat[] = useMemo(() => {
    const seats: Seat[] = [];
    let globalIdx = 0;
    const arcStart = Math.PI + (Math.PI - totalAngleRad) / 2;

    for (let rowIndex = 0; rowIndex < rows; rowIndex++) {
      const rowInnerR = innerRadius + rowIndex * radialStep;
      const rowOuterR = rowInnerR + radialStep;

      const bandInnerR = rowInnerR + effectiveRowMargin / 2;
      const bandOuterR = rowOuterR - effectiveRowMargin / 2;
      const midR = (bandInnerR + bandOuterR) / 2;

      // Per-row angular margin for constant linear gap
      const seatMarginRad = seatMarginLinear / midR;

      const effectiveOuterR =
        !isTotalSeatsMode && (modeProps as ManualSeatProps).seatHeight != null
          ? bandInnerR + (modeProps as ManualSeatProps).seatHeight!
          : bandOuterR;

      const N = seatsPerRow[rowIndex];
      const slotAngleActual = totalAngleRad / N;
      const seatAngle = slotAngleActual - seatMarginRad;

      for (let seatIndex = 0; seatIndex < N; seatIndex++) {
        const slotStart = arcStart + seatIndex * slotAngleActual;
        const a1 = slotStart + seatMarginRad / 2;
        const a2 = a1 + seatAngle;

        const seatData =
          rawData.find((d) => d.x === seatIndex && d.y === rowIndex) ?? {};

        seats.push({
          ...seatData,
          idx: globalIdx++,
          path: sectorPath(bandInnerR, effectiveOuterR, a1, a2),
        });
      }
    }

    return seats;
  }, [
    rawData,
    rows,
    innerRadius,
    radialStep,
    totalAngleRad,
    seatsPerRow,
    seatMarginLinear,
    effectiveRowMargin,
    isTotalSeatsMode,
    modeProps,
  ]);

  const viewBox = useMemo(() => {
    const pad = 4;
    const arcStartAngle = Math.PI + (Math.PI - totalAngleRad) / 2;
    const arcEndAngle = arcStartAngle + totalAngleRad;
    const p1 = polar(outerRadius, arcStartAngle);
    const p2 = polar(outerRadius, arcEndAngle);
    const minX = Math.min(p1.x, p2.x, -outerRadius) - pad;
    const maxX = Math.max(p1.x, p2.x, outerRadius) + pad;
    const minY = -outerRadius - pad;
    const maxY = Math.max(p1.y, p2.y, 0) + pad;
    return `${minX} ${minY} ${maxX - minX} ${maxY - minY}`;
  }, [outerRadius, totalAngleRad]);

  return (
    <svg
      width={width ?? "100%"}
      height={height ?? "100%"}
      viewBox={viewBox}
      style={{ display: "block" }}
    >
      {data.map((seat) => (
        <SeatRenderer key={seat.idx} seat={seat} />
      ))}
    </svg>
  );
};
