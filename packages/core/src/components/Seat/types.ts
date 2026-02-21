import { SeatLayout } from "@hemicycle/rendering";
import { SVGProps } from "react";
import { HemicycleData } from "../Hemicycle";

export type SeatShape = "arc" | "rect" | "circle";

/** Configuration for rendering a seat, excluding layout and data properties. */
export type SeatConfig<T extends object = object> = {
  /** The shape of the seat (default: "arc"). */
  shape?: SeatShape;

  /** Optional roundedness for arc and rectangular seats (default: 0, ignored for circular seats). */
  borderRadius?: number;

  /** Linear spacing between seats along the arc (default: 1). */
  seatMargin?: number;

  /** Optional wrapper function to customize seat rendering. */
  wrapper?: (
    content: React.ReactNode,
    seatData: SeatData<T> | null,
  ) => React.ReactNode;

  /** Optional fill color for the seat */
  color?: string;

  /** Additional SVG props to apply to the seat's <path> element. */
  props?: SVGProps<SVGPathElement>;
};

/** Combined type for a seat, including both layout, style and associated data. */
export type SeatData<T extends object = object> = SeatLayout &
  Partial<HemicycleData<T>>;
