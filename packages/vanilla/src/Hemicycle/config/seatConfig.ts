export const SEAT_SHAPES = ["arc", "rect", "circle"] as const;

export type SeatShape = (typeof SEAT_SHAPES)[number];

export const SEAT_CONFIG_FIELDS = ["shape", "borderRadius", "color"] as const;

export type SeatConfig = {
  /** The shape of the seat (default: "arc"). */
  shape?: SeatShape;

  /** Optional roundedness for arc and rectangular seats (default: 0, ignored for circular seats). */
  borderRadius?: number;

  /** Optional fill color for the seat (default: "lightgray"). */
  color?: string;
};
