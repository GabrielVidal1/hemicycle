// path: packages/ui/components/Hemicycle/HemicycleWithAisles.tsx
import { useMemo } from "react";
import { merge } from "../../technical/merge";
import { DEFAULT_HEMICYCLE_PROPS } from "./constant";
import { Hemicycle } from "./Hemicycle";
import { HemicycleContent } from "./HemicycleContent";
import { HemicycleProps } from "./HemicycleProps";
import { computeViewBox } from "./services/viewbox";
import { HemicycleData } from "./types";

export type HemicycleWithAislesProps<T extends object> = HemicycleProps<T> & {
  /**
   * Number of aisles dividing the hemicycle into sections (min: 1, default: 4).
   * With N aisles, there will be N+1 sections.
   */
  aisleNumber?: number;

  /**
   * Angular width of each aisle in degrees (default: 4).
   */
  aisleWidth?: number;
};

/**
 * Splits `data` into `sectionCount` groups based on each item's `idx` field.
 * Items with explicit x/y coordinates are passed through to the first section.
 */
function partitionDataBySections(
  data: HemicycleData[],
  sectionCount: number,
  seatsPerSection: number[],
): HemicycleData[][] {
  const sections: HemicycleData[][] = Array.from(
    { length: sectionCount },
    () => [],
  );

  // Cumulative seat offsets per section
  const offsets = seatsPerSection.reduce<number[]>((acc, count, i) => {
    acc.push(i === 0 ? 0 : acc[i - 1] + seatsPerSection[i - 1]);
    return acc;
  }, []);

  for (const item of data) {
    if ("x" in item && "y" in item) {
      // Coordinates-based items go to section 0 untouched
      sections[0].push(item);
      continue;
    }

    const idx = (item as { idx: number }).idx;
    let placed = false;
    for (let s = 0; s < sectionCount; s++) {
      const start = offsets[s];
      const end = start + seatsPerSection[s];
      if (idx >= start && idx < end) {
        sections[s].push({ ...item, idx: idx - start } as HemicycleData);
        placed = true;
        break;
      }
    }
    if (!placed && sectionCount > 0) {
      // Overflow goes to the last section
      const lastIdx = sectionCount - 1;
      const start = offsets[lastIdx];
      sections[lastIdx].push({ ...item, idx: idx - start } as HemicycleData);
    }
  }

  return sections;
}

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
    ...contentProps
  } = merge({}, DEFAULT_HEMICYCLE_PROPS, props);

  const clampedAisleNumber = Math.max(1, aisleNumber);
  const sectionCount = clampedAisleNumber + 1;

  const totalAngleRad = (totalAngle * Math.PI) / 180;

  const viewBox = useMemo(
    () => computeViewBox({ outerRadius, totalAngleRad }),
    [outerRadius, totalAngleRad],
  );

  /**
   * Total angle consumed by aisles
   */
  const totalAisleAngle = clampedAisleNumber * aisleWidth;

  /**
   * Remaining angle split equally among sections
   */
  const sectionAngle = (totalAngle - totalAisleAngle) / sectionCount;

  /**
   * Build per-section start angles and seat data.
   * Sections are ordered left-to-right (increasing angle from the start).
   */
  const sections = useMemo(() => {
    return Array.from({ length: sectionCount }, (_, i) => {
      // Each section is preceded by i aisles
      const startAngle =
        -(totalAngle / 2) + i * (sectionAngle + aisleWidth) + angleOffset;
      return { startAngle, sectionAngle };
    });
  }, [sectionCount, sectionAngle, totalAngle, aisleWidth, angleOffset]);

  /**
   * Approximate equal seat counts per section for data partitioning.
   * We rely on index-based data; for totalSeats mode we spread evenly.
   */
  const totalSeatsValue =
    "totalSeats" in contentProps && contentProps.totalSeats != null
      ? contentProps.totalSeats
      : null;

  const seatsPerSection = useMemo(() => {
    if (totalSeatsValue == null) return Array(sectionCount).fill(Infinity);
    const base = Math.floor(totalSeatsValue / sectionCount);
    const remainder = totalSeatsValue % sectionCount;
    return Array.from({ length: sectionCount }, (_, i) =>
      i < remainder ? base + 1 : base,
    );
  }, [totalSeatsValue, sectionCount]);

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
