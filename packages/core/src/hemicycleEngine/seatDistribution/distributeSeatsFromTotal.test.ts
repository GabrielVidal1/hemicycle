import { times } from "@hemicycle/helpers";
import { describe, expect, it } from "vitest";
import { distributeSeatsFromTotal } from "./distributeSeatsFromTotal";

const makeRowBands = (rows: number, start = 10, step = 10) =>
  times(rows, (i) => ({
    rowInnerRadius: start + i * step,
    rowOuterRadius: start + (i + 1) * step,
  }));

describe("distributeSeatsFromTotal", () => {
  describe("edge cases", () => {
    it("allocates all seats to the single row if rows === 1", () => {
      const result = distributeSeatsFromTotal(makeRowBands(1), {
        rows: 1,
        rowMargin: 0,
        totalSeats: 42,
      });

      expect(result).toEqual([42]);
    });

    it("distributes one seat per row until seats run out if rows >= totalSeats", () => {
      const result = distributeSeatsFromTotal(makeRowBands(10), {
        rows: 10,
        rowMargin: 0,
        totalSeats: 3,
      });

      expect(result).toEqual([1, 1, 1, 0, 0, 0, 0, 0, 0, 0]);
    });
  });

  describe("general distribution", () => {
    const rows = 5;
    const rowBands = makeRowBands(rows);

    const validBaseParams = {
      rows,
      rowMargin: 0,
      totalSeats: 50,
    };

    it("returns array with length equal to rows", () => {
      const result = distributeSeatsFromTotal(rowBands, validBaseParams);
      expect(result).toHaveLength(rows);
    });

    it("sum of distributed seats equals totalSeats", () => {
      const result = distributeSeatsFromTotal(rowBands, validBaseParams);
      const sum = result.reduce((a, b) => a + b, 0);

      expect(sum).toBe(validBaseParams.totalSeats);
    });

    it("ensures at least one seat per row when rows < totalSeats", () => {
      const result = distributeSeatsFromTotal(rowBands, validBaseParams);

      result.forEach((n) => {
        expect(n).toBeGreaterThanOrEqual(1);
      });
    });

    it("allocates more seats to outer rows (larger mid-radius)", () => {
      const result = distributeSeatsFromTotal(makeRowBands(4, 10, 5), {
        rows: 4,
        rowMargin: 0,
        totalSeats: 40,
      });

      for (let i = 1; i < result.length; i++) {
        expect(result[i]).toBeGreaterThanOrEqual(result[i - 1]);
      }
    });

    it("handles rowMargin correctly without breaking invariants", () => {
      const result = distributeSeatsFromTotal(makeRowBands(6, 10, 5), {
        rows: 6,
        rowMargin: 2,
        totalSeats: 60,
      });

      expect(result).toHaveLength(6);
      expect(result.reduce((a, b) => a + b, 0)).toBe(60);

      result.forEach((n) => {
        expect(n).toBeGreaterThanOrEqual(1);
      });
    });

    it("distributes leftover seats according to largest remainders", () => {
      const rowBands = [
        { rowInnerRadius: 10, rowOuterRadius: 11 }, // mid-radius 10.5
        { rowInnerRadius: 11, rowOuterRadius: 12 }, // mid-radius 11.5
        { rowInnerRadius: 12, rowOuterRadius: 13 }, // mid-radius 12.5
      ];
      const result = distributeSeatsFromTotal(rowBands, {
        rows: 3,
        rowMargin: 0,
        totalSeats: 10,
      });

      expect(result.reduce((a, b) => a + b, 0)).toBe(10);
    });
  });
});
