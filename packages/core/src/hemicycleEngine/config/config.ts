import { HemicycleArcAisleConfig } from "./arcAislesConfig";
import { GlobalSeatConfig } from "./seatConfig";

export type HemicycleConfig = HemicycleArcAisleConfig & {
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

  // MISC CONFIG
  /** Optional configuration for seat appearance and shape. */
  seatConfig: GlobalSeatConfig;

  /* Optional flag to mirror the layout horizontally (default: false). */
  mirror: boolean;

  /** Optional array defining the distribution of seats across rows; if not provided, seats are distributed evenly. */
  seatsPerRow?: number[];
};
