import { HemicycleData, HemicycleEngine, SeatData } from "@hemicycle/core";
import { merge, pick } from "@hemicycle/helpers";
import { computeViewBox, svgPathGenerators } from "@hemicycle/rendering";
import { HemicycleConfig } from "./config";
import { DEFAULT_HEMICYCLE_CONFIG } from "./config/defaultConfig";
import { SEAT_CONFIG_FIELDS, SeatConfig } from "./config/seatConfig";
import { validateConfig } from "./config/validateConfig";
import { DataWithConfig } from "./data/types";

export class Hemicycle<T extends object = object> {
  private config: HemicycleConfig = DEFAULT_HEMICYCLE_CONFIG;

  private engine: HemicycleEngine<DataWithConfig<T>> | null = null;

  private svg: SVGSVGElement | null = null;

  constructor(config: Partial<HemicycleConfig>) {
    this.engine = new HemicycleEngine<DataWithConfig<T>>(config);
    this.updateConfig(config);
  }

  getEngine(): HemicycleEngine<DataWithConfig<T>> {
    if (!this.engine) {
      throw new Error("Hemicycle engine not initialized.");
    }
    return this.engine;
  }

  updateConfig(config: Partial<HemicycleConfig>) {
    this.config = merge({}, this.config, config);
    validateConfig(this.config);
    this.getEngine().updateConfig(config);
  }

  updateData(data: HemicycleData<DataWithConfig<T>>[]) {
    this.getEngine().updateData(data);
  }

  getSeatData() {
    const seatData = this.getEngine().getSeatData();
    return seatData.map((seat) => {
      const seatConfig: SeatConfig = {
        ...(this.config.seatConfig ?? {}),
        ...(seat.data ? pick(seat.data, SEAT_CONFIG_FIELDS) : {}),
      };

      const path = svgPathGenerators[seatConfig.shape ?? "arc"](seat);

      return {
        ...seat,
        seatConfig: {
          ...seatConfig,
          path,
        },
      };
    });
  }

  getViewBox() {
    return computeViewBox(this.config);
  }

  cleanUp() {
    // Clear previous content
    while (this.svg?.firstChild) {
      this.svg.removeChild(this.svg.firstChild);
    }
  }

  render(svg: SVGSVGElement) {
    this.cleanUp();
    this.svg = svg;
    const viewBox = this.getViewBox();

    const seatsData = this.getSeatData();

    // Set viewBox
    svg.setAttribute("viewBox", viewBox);
    svg.setAttribute("width", "100%");
    svg.setAttribute("height", "100%");

    // Render seats
    seatsData.forEach((seatData) => {
      if (this.config.hideEmptySeats && !seatData.data) {
        return; // Skip rendering empty seats if hideEmptySeats is true
      }
      const svgPath = this.buildSeatSvg(seatData);
      svg.appendChild(svgPath);
    });
  }

  private buildSeatSvg({
    seatConfig,
    ...seatData
  }: SeatData<DataWithConfig<T>> & { seatConfig: SeatConfig }) {
    const seatPath = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "path",
    );

    const path = svgPathGenerators[seatConfig.shape ?? "arc"](seatData);
    seatPath.setAttribute("d", path);

    seatPath.setAttribute("fill", seatConfig.color ?? "lightgray");
    return seatPath;
  }
}
