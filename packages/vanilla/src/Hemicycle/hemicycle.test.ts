// @vitest-environment jsdom
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it } from "vitest";
import { Hemicycle } from "./index";
import { WithSeatConfig } from "./types";

describe("Hemicycle", () => {
  it("initializes engine correctly", () => {
    const hemicycle = new Hemicycle({});
    const engine = hemicycle.getEngine();

    expect(engine).toBeDefined();
  });

  it("updates config without throwing", () => {
    const hemicycle = new Hemicycle({});

    expect(() => {
      hemicycle.updateConfig({ innerRadius: 50 });
    }).not.toThrow();
  });

  it("updates data without throwing", () => {
    const hemicycle = new Hemicycle({});

    const data: WithSeatConfig<any>[] = [{ id: "A" }];

    expect(() => {
      hemicycle.updateData(data);
    }).not.toThrow();
  });

  it("renders seats into svg", () => {
    const hemicycle = new Hemicycle({
      totalSeats: 5,
      innerRadius: 50,
      outerRadius: 100,
      seatConfig: {
        color: "blue",
      },
    });

    const data: WithSeatConfig<any>[] = [{ seatConfig: { color: "red" } }];

    hemicycle.updateData(data);

    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");

    hemicycle.render(svg);

    expect(svg.getAttribute("viewBox")).toBeTruthy();
    expect(svg.children.length).toBe(5);

    Array.from(svg.children).forEach((child, i) => {
      expect(child.tagName).toBe("path");
      if (i === 0) {
        expect(child.getAttribute("fill")).toBe("red");
      } else {
        expect(child.getAttribute("fill")).toBe("blue");
      }
    });
  });

  it("clears previous render before re-rendering", () => {
    const hemicycle = new Hemicycle<any>({
      hideEmptySeats: true,
    });

    const data: WithSeatConfig<any>[] = [{ id: "A" }, { id: "B" }, { id: "C" }];

    hemicycle.updateData(data);

    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");

    hemicycle.render(svg);
    expect(svg.children.length).toBe(3);

    hemicycle.updateData([{ id: "B" }]);

    hemicycle.render(svg);
    expect(svg.children.length).toBe(1);
  });
});
