import { SeatConfig } from "Hemicycle/config/seatConfig";

export type DataWithConfig<T extends object = object> = T & SeatConfig;
