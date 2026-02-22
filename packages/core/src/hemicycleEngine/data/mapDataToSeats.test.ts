import type { SeatPosition } from "hemicycleEngine/layout";
import { describe, expect, it } from "vitest";
import { mapDataToSeats } from "./mapDataToSeats";

describe("mapDataToSeats", () => {
  const baseLayout: SeatPosition[] = [
    {
      idx: 0,
      radialIdx: 10,
      seatIndex: 1,
      rowIndex: 1,
    },
    {
      idx: 1,
      radialIdx: 11,
      seatIndex: 2,
      rowIndex: 1,
    },
  ];

  it("maps data using seatIndex + rowIndex when provided", () => {
    const data = [
      { seatIndex: 1, rowIndex: 1, value: "A" },
      { seatIndex: 2, rowIndex: 1, value: "B" },
    ];

    const result = mapDataToSeats({
      layout: baseLayout,
      data,
    });

    expect(result[0].data?.value).toBe("A");
    expect(result[1].data?.value).toBe("B");
  });

  it("maps data using idx when coordinates are not provided", () => {
    const data = [
      { idx: 0, value: "A" },
      { idx: 1, value: "B" },
    ];

    const result = mapDataToSeats({
      layout: baseLayout,
      data,
    });

    expect(result[0].data?.value).toBe("A");
    expect(result[1].data?.value).toBe("B");
  });

  it("uses radialIdx when orderBy is not 'row'", () => {
    const data = [
      { idx: 10, value: "RadialA" },
      { idx: 11, value: "RadialB" },
    ];

    const result = mapDataToSeats({
      orderBy: "radial",
      layout: baseLayout,
      data,
    });

    expect(result[0].data?.value).toBe("RadialA");
    expect(result[1].data?.value).toBe("RadialB");
  });

  it("prefers coordinate match over idx match", () => {
    const data = [
      { idx: 0, value: "ByIdx" },
      { seatIndex: 1, rowIndex: 1, value: "ByCoordinates" },
    ];

    const result = mapDataToSeats({
      layout: baseLayout,
      data,
    });

    expect(result[0].data?.value).toBe("ByCoordinates");
  });

  it("returns null when no matching data exists", () => {
    const result = mapDataToSeats({
      layout: baseLayout,
      data: [],
    });

    expect(result[0].data).toBeNull();
    expect(result[1].data).toBeNull();
  });
});
