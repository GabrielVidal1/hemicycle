export type HemicycleArcAisleConfig = {
  /** Optional width of arc aisles in linear units; required if arcAislesCount or arcAislesEvery is provided. */
  arcAislesWidth: number;
} & (
  | {
      /* Specifies the number of arc aisles to include, evenly spaced across the layout. */
      arcAislesCount: number;
      arcAislesEvery?: never;
    }
  | {
      /* Specifies the interval (in rows) at which arc aisles should be placed. */
      arcAislesEvery: number;
      arcAislesCount?: never;
    }
);
