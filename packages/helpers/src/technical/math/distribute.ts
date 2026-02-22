import { times } from "@hemicycle/helpers";

/**
 * Distributes a total number of items into a specified number of groups as evenly as possible.
 */
export function distributeEvenly(
  totalNumberOfItems: number,
  numberOfGroups: number,
): number[] {
  if (numberOfGroups <= 0) {
    throw new Error("Number of groups must be greater than zero.");
  }

  if (totalNumberOfItems < 0) {
    throw new Error("Total number of items cannot be negative.");
  }

  if (totalNumberOfItems < numberOfGroups) {
    const distribution = Array(numberOfGroups).fill(0);
    for (let i = 0; i < totalNumberOfItems; i++) {
      distribution[i]++;
    }
    return distribution;
  }

  const base = Math.floor(totalNumberOfItems / numberOfGroups);
  const remainder = totalNumberOfItems % numberOfGroups;

  return times(numberOfGroups, (i) => (i < remainder ? base + 1 : base));
}
