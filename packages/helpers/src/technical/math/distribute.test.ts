import { describe, expect, it } from "vitest";
import { distributeEvenly } from "./distribute";

describe("distributeEvenly", () => {
  it("distributes evenly when divisible", () => {
    expect(distributeEvenly(10, 5)).toEqual([2, 2, 2, 2, 2]);
  });

  it("distributes remainder to the first groups", () => {
    expect(distributeEvenly(10, 3)).toEqual([4, 3, 3]);
  });

  it("handles total less than groups", () => {
    expect(distributeEvenly(3, 5)).toEqual([1, 1, 1, 0, 0]);
  });

  it("handles zero total items", () => {
    expect(distributeEvenly(0, 4)).toEqual([0, 0, 0, 0]);
  });

  it("throws if numberOfGroups is zero", () => {
    expect(() => distributeEvenly(10, 0)).toThrow(
      "Number of groups must be greater than zero.",
    );
  });

  it("throws if numberOfGroups is negative", () => {
    expect(() => distributeEvenly(10, -1)).toThrow(
      "Number of groups must be greater than zero.",
    );
  });

  it("throws if totalNumberOfItems is negative", () => {
    expect(() => distributeEvenly(-5, 3)).toThrow(
      "Total number of items cannot be negative.",
    );
  });
});
