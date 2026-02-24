import * as Core from "@hemicycle/core";
import { merge } from "@hemicycle/helpers";
import { computeViewBox, svgPathGenerators } from "@hemicycle/rendering";
import { HemicycleConfig } from "./config";
import {
  DEFAULT_HEMICYCLE_CONFIG,
  DEFAULT_SEAT_CONFIG,
} from "./config/defaultConfig";
import { ComputedSeatConfig, SeatConfig } from "./config/seatConfig";
import { validateConfig } from "./config/validateConfig";
import {
  ComputedSeatData,
  HemicycleData,
  HemicycleEngine,
  WithSeatConfig,
} from "./types";

export class Hemicycle<
  T extends object = object,
  SCT extends SeatConfig = SeatConfig,
> {
  private config: HemicycleConfig<SCT> =
    DEFAULT_HEMICYCLE_CONFIG as HemicycleConfig<SCT>;

  private engine: HemicycleEngine<T, SCT> | null = null;

  private svg: SVGSVGElement | null = null;

  private computedSeatData: ComputedSeatData<T, SCT>[] = [];

  constructor(config: Partial<HemicycleConfig<SCT>>) {
    this.engine = new Core.Hemicycle<WithSeatConfig<T, SCT>>(config);
    this.updateConfig(config);
  }

  getEngine(): HemicycleEngine<T, SCT> {
    if (!this.engine) {
      throw new Error("Hemicycle engine not initialized.");
    }
    return this.engine;
  }

  updateConfig(config: Partial<HemicycleConfig<SCT>>) {
    this.config = merge({}, this.config, config);
    validateConfig(this.config);
    this.getEngine().updateConfig(config);
  }

  getConfig() {
    return this.config;
  }

  updateData(data: HemicycleData<T, SCT>[]) {
    const seatData = this.getEngine().updateData(data);
    this.computedSeatData = seatData.map((seat) => {
      const seatConfig = {
        ...DEFAULT_SEAT_CONFIG,
        ...(this.config.seatConfig ?? {}),
        ...(seat.data?.seatConfig ?? {}),
        path: "", // will be computed below
      };
      const path = svgPathGenerators[seatConfig.shape]({
        ...seat,
        ...seatConfig,
      });

      const res: ComputedSeatData<T, SCT> = {
        ...seat,
        seatConfig: {
          ...seatConfig,
          path,
        } as ComputedSeatConfig<SCT>,
      };
      return res;
    });
  }

  getSeatData() {
    return this.computedSeatData;
  }

  getViewBox(): string {
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

    const seatsData = this.getSeatData();

    // Set viewBox
    const viewBox = this.getViewBox();
    svg.setAttribute("viewBox", viewBox);
    const { width, height } = this.config;
    svg.setAttribute("width", width?.toString() ?? "100%");
    svg.setAttribute("height", height?.toString() ?? "100%");

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
  }: ComputedSeatData<T, SCT>): SVGPathElement {
    const seatPath = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "path",
    );
    seatPath.setAttribute("d", seatConfig.path);
    seatPath.setAttribute("fill", seatConfig?.color ?? "lightgray");
    return seatPath;
  }
}
