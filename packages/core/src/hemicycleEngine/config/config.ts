import { HemicycleArcAisleConfig } from "./arcAislesConfig";

type SeatOrdering = "row" | "radial";

export interface HemicycleConfig extends HemicycleArcAisleConfig {
  // BASE CONFIG
  /** Number of concentric seating rows (required). */
  rows: number;

  /** Total number of seats to distribute across rows (default: 100). */
  totalSeats: number;

  // GEOMETRIC CONFIG
  /** Inner radius of the hemicycle in SVG units (default: 40). */
  innerRadius: number;

  /** Outer radius of the hemicycle in SVG units (default: 95). */
  outerRadius: number;

  /** Total angular span in degrees (default: 180). */
  totalAngle: number;

  /** Optional global angle offset for the entire layout in degrees (default: 0). */
  angleOffset: number;

  /** Radial spacing between rows in linear units; falls back to seatMargin or 1. */
  rowMargin: number;

  /* Optional flag to mirror the layout horizontally (default: false). */
  mirror: boolean;

  /** Optional array defining the distribution of seats across rows; if not provided, seats are distributed evenly. */
  seatsPerRow?: number[];

  /** Linear spacing between seats along the arc (default: 1). */
  seatMargin: number;

  /** Ordering of idx-based seat layout; "row" fills seats sequentially by row, while "radial" fills seats sequentially by distance from the center (default: "row"). */
  orderBy: SeatOrdering;

  /** Number of angular aisles (gaps) to insert, dividing the hemicycle into (aislesCount + 1) sections. Defaults to 0 (no aisles). */
  aislesCount: number;

  /** Width of each angular aisle. Required when aislesCount > 0. Defaults to 2. */
  aislesWidth: number;
}
