import { merge } from "@hemicycle/helpers";
import {
  DEFAULT_HEMICYCLE_CONFIG,
  HemicycleConfig,
  validateConfig,
} from "./config";
import { mapDataToSeats } from "./data/mapDataToSeats";
import { HemicycleData, SeatData } from "./data/types";
import { validateData } from "./data/validateData";
import { computeSeatLayout, SeatLayout } from "./layout";
import { computeRowBands, distributeSeatsFromTotal } from "./seatDistribution";

export class HemicycleEngine<T extends object = object> {
  private config: HemicycleConfig = DEFAULT_HEMICYCLE_CONFIG;

  private computedSeatsPerRow: number[] = [];
  private seatsLayout: SeatLayout[] = [];
  private seatData: SeatData<T>[] = [];

  constructor(config: Partial<HemicycleConfig>) {
    this.updateConfig(config);
  }

  private computeSeatsLayout() {
    const rowBands = computeRowBands(this.config);
    this.computedSeatsPerRow =
      this.config.seatsPerRow ??
      distributeSeatsFromTotal(rowBands, this.config);

    this.seatsLayout = computeSeatLayout(rowBands, {
      ...this.config,
      seatsPerRow: this.computedSeatsPerRow,
    });
  }

  updateConfig(config: Partial<HemicycleConfig>) {
    this.config = merge({}, this.config, config);
    validateConfig(this.config);
    this.computeSeatsLayout();
  }

  updateData(data: HemicycleData<T>[]) {
    validateData(data, this.config, this.computedSeatsPerRow);
    this.seatData = mapDataToSeats({
      orderBy: this.config.seatConfig.orderBy,
      layout: this.seatsLayout,
      data,
    });
  }

  getSeatsLayout(): SeatLayout[] {
    return this.seatsLayout;
  }

  getSeatData(): SeatData<T>[] {
    return this.seatData;
  }

  getConfig(): HemicycleConfig {
    return this.config;
  }
}
