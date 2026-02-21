import { merge } from "@hemicycle/helpers";
import { computeViewBox } from "@hemicycle/rendering";
import { useMemo } from "react";
import { DEFAULT_HEMICYCLE_PROPS } from "./constant";
import { Hemicycle } from "./Hemicycle";
import { HemicycleContent } from "./HemicycleContent";
import { HemicycleProps } from "./HemicycleProps";
import { partitionDataBySections } from "./services/partitionDataBySections";

export type HemicycleWithAislesProps<T extends object = object> =
  HemicycleProps<T> & {
    /**
     * Number of aisles dividing the hemicycle into sections (min: 1, default: 4).
     * With N aisles, there will be N+1 sections.
     */
    aisleNumber?: number;

    /**
     * Angular width of each aisle in degrees (default: 4).
     */
    aisleWidth?: number;

    mirrorSections?: boolean;

    seatsPerSection?: number[]; // Optional explicit seat counts per section, overrides totalSeats splitting
  };

export const HemicycleWithAisles = <T extends object>(
  props: HemicycleWithAislesProps<T>,
) => {
  const {
    width,
    height,
    outerRadius,
    totalAngle,
    aisleNumber,
    aisleWidth,
    data: rawData,
    angleOffset,
    mirrorSections = false,
    seatsPerSection: seatsPerSectionProp,
    ...contentProps
  } = merge({}, DEFAULT_HEMICYCLE_PROPS, props);

  const clampedAisleNumber = Math.max(1, aisleNumber);
  const sectionCount = clampedAisleNumber + 1;

  const totalAngleRad = (totalAngle * Math.PI) / 180;

  const viewBox = useMemo(
    () => computeViewBox({ outerRadius, totalAngleRad }),
    [outerRadius, totalAngleRad],
  );

  const totalAisleAngle = clampedAisleNumber * aisleWidth;

  const sectionAngle = (totalAngle - totalAisleAngle) / sectionCount;

  const sections = useMemo(() => {
    return Array.from({ length: sectionCount }, (_, rawIndex) => {
      const i = mirrorSections ? sectionCount - 1 - rawIndex : rawIndex;

      const startAngle =
        -(totalAngle / 2) + i * (sectionAngle + aisleWidth) + angleOffset;

      return { startAngle, sectionAngle };
    });
  }, [
    sectionCount,
    sectionAngle,
    totalAngle,
    aisleWidth,
    angleOffset,
    mirrorSections,
  ]);

  /**
   * Approximate equal seat counts per section for data partitioning.
   * We rely on index-based data; for totalSeats mode we spread evenly.
   */
  const totalSeatsValue =
    "totalSeats" in contentProps && contentProps.totalSeats != null
      ? contentProps.totalSeats
      : null;

  const seatsPerSection = useMemo(() => {
    if (seatsPerSectionProp) {
      // If explicit seatsPerSection is provided, use it directly
      return seatsPerSectionProp;
    }

    if (totalSeatsValue == null) return Array(sectionCount).fill(Infinity);
    const base = Math.floor(totalSeatsValue / sectionCount);
    const remainder = totalSeatsValue % sectionCount;
    return Array.from({ length: sectionCount }, (_, i) =>
      i < remainder ? base + 1 : base,
    );
  }, [totalSeatsValue, sectionCount, seatsPerSectionProp]);

  const partitionedData = useMemo(
    () =>
      partitionDataBySections(
        rawData,
        sectionCount,
        seatsPerSection as number[],
      ),
    [rawData, sectionCount, seatsPerSection],
  );

  /**
   * Derive per-section totalSeats for automatic distribution mode.
   */
  const sectionTotalSeats = useMemo(() => {
    if (totalSeatsValue == null) return null;
    return seatsPerSection as number[];
  }, [totalSeatsValue, seatsPerSection]);

  if (aisleNumber === 0) {
    // Fallback to regular hemicycle if no aisles
    return <Hemicycle {...props} />;
  }

  return (
    <svg
      width={width ?? "100%"}
      height={height ?? "100%"}
      viewBox={viewBox}
      style={{ display: "block" }}
    >
      {sections.map(({ startAngle, sectionAngle: angle }, i) => {
        // Build the mode props for this section
        const sectionModeProps =
          sectionTotalSeats != null
            ? { totalSeats: sectionTotalSeats[i] }
            : (() => {
                // eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any
                const { totalSeats: _t, ...rest } = contentProps as any;
                return rest;
              })();

        const sectionData = partitionedData[i] ?? [];

        return (
          <HemicycleContent
            key={i}
            outerRadius={outerRadius}
            totalAngle={angle}
            angleOffset={startAngle + angle / 2}
            data={sectionData}
            {...contentProps}
            {...sectionModeProps}
          />
        );
      })}
    </svg>
  );
};
