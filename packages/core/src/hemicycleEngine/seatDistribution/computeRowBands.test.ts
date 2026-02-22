import { describe, expect, it } from "vitest";
import { computeRowBands } from "./computeRowBands";

describe("computeRowBands", () => {
  const baseParams = {
    rows: 4,
    innerRadius: 0,
    outerRadius: 100,
    rowMargin: 0,
  };

  it("distributes rows evenly when no arc aisles are provided", () => {
    const bands = computeRowBands({
      ...baseParams,
      arcAislesCount: 0,
      arcAislesWidth: 1,
    });

    expect(bands).toHaveLength(4);

    const thickness = 100 / 4;

    bands.forEach((band, i) => {
      expect(band.rowInnerRadius).toBeCloseTo(i * thickness);
      expect(band.rowOuterRadius).toBeCloseTo((i + 1) * thickness);
    });
  });

  it("accounts for arcAislesCount", () => {
    const bands = computeRowBands({
      ...baseParams,
      arcAislesWidth: 10,
      arcAislesCount: 1,
    });

    expect(bands).toHaveLength(4);

    // Ensure final outer radius matches expected
    expect(bands.at(-1)?.rowOuterRadius).toBeCloseTo(100);
  });

  it("accounts for arcAislesEvery", () => {
    const bands = computeRowBands({
      ...baseParams,
      arcAislesWidth: 5,
      arcAislesEvery: 2,
    });

    expect(bands).toHaveLength(4);

    expect(bands.at(-1)?.rowOuterRadius).toBeCloseTo(100);
  });

  it("clamps arcAislesCount to rows - 1", () => {
    const bands = computeRowBands({
      ...baseParams,
      arcAislesWidth: 5,
      arcAislesCount: 10,
    });

    expect(bands).toHaveLength(4);
    expect(bands.at(-1)?.rowOuterRadius).toBeCloseTo(100);
  });

  it("maintains radial continuity (no overlaps or gaps inside rows)", () => {
    const bands = computeRowBands({
      ...baseParams,
      arcAislesWidth: 5,
      arcAislesCount: 2,
    });

    for (let i = 1; i < bands.length; i++) {
      expect(bands[i].rowInnerRadius).toBeGreaterThanOrEqual(
        bands[i - 1].rowOuterRadius,
      );
    }
  });
});
