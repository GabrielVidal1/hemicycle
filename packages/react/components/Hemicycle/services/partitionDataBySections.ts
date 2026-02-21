import { HemicycleData } from "../types";

/**
 * Splits `data` into `sectionCount` groups based on each item's `idx` field.
 * Items with explicit x/y coordinates are passed through to the first section.
 */
export function partitionDataBySections(
  data: HemicycleData[],
  sectionCount: number,
  seatsPerSection: number[],
): HemicycleData[][] {
  const sections: HemicycleData[][] = Array.from(
    { length: sectionCount },
    () => [],
  );

  // Cumulative seat offsets per section
  const offsets = seatsPerSection.reduce<number[]>((acc, _count, i) => {
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
