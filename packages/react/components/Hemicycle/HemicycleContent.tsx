import { useMemo } from "react";
import { merge } from "../../technical";
import { SeatRenderer } from "../Seat/Seat";
import { DEFAULT_HEMICYCLE_PROPS } from "./constant";
import { HemicycleProps } from "./HemicycleProps";
import { computeSeatLayout } from "./services/computeSeatLayout";
import { mapSeatData } from "./services/mapSeatData";
import { distributeSeatsFromTotal } from "./services/seatDistribution";

export const HemicycleContent = <T extends object>(
  props: HemicycleProps<T>,
) => {
  const {
    rows,
    innerRadius,
    outerRadius,
    totalAngle,
    angleOffset,
    data: rawData,
    rowMargin,
    totalSeats,
    seatConfig,
    mirror,
  } = merge({}, DEFAULT_HEMICYCLE_PROPS, props);

  const totalAngleRad = (totalAngle * Math.PI) / 180;
  const radialStep = (outerRadius - innerRadius) / rows;

  const effectiveRowMargin = rowMargin ?? seatConfig?.seatMargin;

  const seatsPerRow = useMemo(() => {
    if (props?.seatDistribution) {
      if (props.seatDistribution.length !== rows) {
        console.warn(
          `seatDistribution length (${props.seatDistribution.length}) does not match number of rows (${rows}). Falling back to automatic distribution.`,
        );
      }
      return props.seatDistribution;
    }
    return distributeSeatsFromTotal({
      totalSeats,
      rows,
      innerRadius,
      radialStep,
      effectiveRowMargin,
    });
  }, [
    rows,
    innerRadius,
    radialStep,
    totalAngleRad,
    totalSeats,
    effectiveRowMargin,
  ]);

  const seatLayout = useMemo(
    () =>
      computeSeatLayout({
        rows,
        innerRadius,
        radialStep,
        totalAngleRad,
        seatsPerRow,
        seatMargin: seatConfig?.seatMargin ?? 1,
        effectiveRowMargin,
        angleOffset,
        mirror,
      }),
    [
      rows,
      innerRadius,
      radialStep,
      totalAngleRad,
      seatsPerRow,
      seatConfig?.seatMargin,
      effectiveRowMargin,
      mirror,
    ],
  );

  const seatsData = useMemo(
    () => mapSeatData({ layout: seatLayout, rawData }),
    [seatLayout, rawData],
  );

  return (
    <>
      {seatsData.map((seatData) => (
        <SeatRenderer key={seatData.idx} {...seatConfig} {...seatData} />
      ))}
    </>
  );
};
