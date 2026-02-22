type SeatOrdering = "row" | "radial";

/** Configuration for rendering a seat, excluding layout and data properties. */
export type GlobalSeatConfig = {
  /** Linear spacing between seats along the arc (default: 1). */
  seatMargin?: number;

  /** Ordering of idx-based seat layout; "row" fills seats sequentially by row, while "radial" fills seats sequentially by distance from the center (default: "row"). */
  orderBy?: SeatOrdering;
};
