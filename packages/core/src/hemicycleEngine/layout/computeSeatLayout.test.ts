import { RowBand } from "hemicycleEngine/seatDistribution/computeRowBands";
import { describe, expect, it } from "vitest";
import { computeSeatLayout } from "./computeSeatLayout";

describe("computeSeatLayout", () => {
  const rowBands: RowBand[] = [
    { rowInnerRadius: 100, rowOuterRadius: 150 },
    { rowInnerRadius: 150, rowOuterRadius: 200 },
  ];

  const baseParams = {
    totalAngle: 180,
    rowMargin: 0,
    angleOffset: 0,
    mirror: false,
    seatConfig: {
      seatMargin: 2,
      orderBy: "row" as const,
    },
    seatsPerRow: [4, 6],
  };

  it("generates correct total number of seats", () => {
    const layout = computeSeatLayout(rowBands, baseParams);

    expect(layout).toHaveLength(10); // 4 + 6
  });

  it("indexes seats sequentially", () => {
    const layout = computeSeatLayout(rowBands, baseParams);

    layout.forEach((seat, i) => {
      expect(seat.idx).toBe(i);
    });
  });

  it("assigns correct row and seat indices", () => {
    const layout = computeSeatLayout(rowBands, baseParams);

    expect(layout[0].rowIndex).toBe(0);
    expect(layout[0].seatIndex).toBe(0);

    expect(layout[4].rowIndex).toBe(1);
    expect(layout[4].seatIndex).toBe(0);
  });

  it("produces finite coordinates", () => {
    const layout = computeSeatLayout(rowBands, baseParams);

    layout.forEach((seat) => {
      expect(Number.isFinite(seat.x)).toBe(true);
      expect(Number.isFinite(seat.y)).toBe(true);
    });
  });

  it("keeps seats within radial bounds", () => {
    const layout = computeSeatLayout(rowBands, baseParams);

    layout.forEach((seat) => {
      const r = Math.sqrt(seat.x ** 2 + seat.y ** 2);
      expect(r).toBeGreaterThanOrEqual(seat.innerR);
      expect(r).toBeLessThanOrEqual(seat.outerR);
    });
  });

  it("assigns radialIdx column-wise inner→outer when mirror=false", () => {
    const layout = computeSeatLayout(rowBands, baseParams);

    const firstColumn = layout
      .filter((s) => s.seatIndex === 0)
      .sort((a, b) => a.radialIdx - b.radialIdx);

    expect(firstColumn.map((s) => s.rowIndex)).toEqual([0, 1]);
  });

  it("assigns radialIdx column-wise outer→inner when mirror=true", () => {
    const layout = computeSeatLayout(rowBands, {
      ...baseParams,
      mirror: true,
    });

    const firstColumn = layout
      .filter((s) => s.seatIndex === 0)
      .sort((a, b) => a.radialIdx - b.radialIdx);

    expect(firstColumn.map((s) => s.rowIndex)).toEqual([1, 0]);
  });
});
