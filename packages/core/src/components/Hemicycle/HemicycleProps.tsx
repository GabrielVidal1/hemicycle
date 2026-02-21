import { SeatConfig } from "../Seat/types";
import { HemicycleData } from "./types";

/**
 * Core configuration shared by all hemicycle modes.
 */
export type HemicycleProps<T extends object = object> = {
  /** Number of concentric seating rows (required). */
  rows: number;

  /** Array of seat data objects used to populate and style individual seats (required). */
  data: HemicycleData<T>[];

  /** Inner radius of the hemicycle in SVG units (default: 40). */
  innerRadius?: number;

  /** Outer radius of the hemicycle in SVG units (default: 95). */
  outerRadius?: number;

  /** SVG height; accepts number or CSS string (default: "100%"). */
  height?: number;

  /** SVG width; accepts number or CSS string (default: "100%"). */
  width?: number;

  /** Total angular span in degrees (default: 180). */
  totalAngle?: number;

  /** Optional global angle offset for the entire layout in degrees (default: 0). */
  angleOffset?: number;

  /** Radial spacing between rows in linear units; falls back to seatMargin or 1. */
  rowMargin?: number;

  /** Optional configuration for seat appearance and shape. */
  seatConfig?: SeatConfig<T>;

  /** Total number of seats to distribute across rows (default: 100). */
  totalSeats?: number;

  /* Optional flag to mirror the layout horizontally (default: false). */
  mirror?: boolean;

  /** Optional array defining the distribution of seats across rows; if not provided, seats are distributed evenly. */
  seatDistribution?: number[];
};
