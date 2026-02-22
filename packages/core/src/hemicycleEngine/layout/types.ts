export type SeatPosition = {
  /** Row major index of the seat. */
  idx: number;

  /** Radial index of the seat within its row. */
  radialIdx: number;

  /** Coordinates in hemicycle space. */
  rowIndex: number;
  seatIndex: number;
};

export type Geometry = {
  innerR: number;
  outerR: number;
  angle1Rad: number;
  angle2Rad: number;
};

/** Core layout properties for a seat, including its position and associated data. */
export type SeatLayout = Geometry &
  SeatPosition & {
    /** Center coordinates, useful for placing labels or handling interactions. */
    x: number;
    y: number;
  };
