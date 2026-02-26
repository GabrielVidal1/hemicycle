# @hemicycle/vanilla

[![npm version](https://img.shields.io/npm/v/@hemicycle/vanilla)](https://www.npmjs.com/package/@hemicycle/vanilla)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js >=18](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](https://nodejs.org/)

> Framework-free SVG renderer for parliament-style hemicycle seat charts.

`@hemicycle/vanilla` wraps [`@hemicycle/core`](https://www.npmjs.com/package/@hemicycle/core) with a lightweight rendering layer that writes directly into an `<svg>` element — no framework, no bundler magic required. Pass it a config, call `render()`, and get a fully drawn hemicycle.

---

## Features

- **Direct SVG rendering** — writes `<path>` elements into any `SVGSVGElement` you provide
- **Three seat shapes** — `arc` (default), `rect`, and `circle`
- **Per-seat styling** — override color, shape, and border radius on individual seats via `seatConfig`
- **Hide empty seats** — optionally omit unoccupied seats for sparse layouts
- **All `@hemicycle/core` options** — full access to rows, radii, aisles, mirroring, and ordering
- **TypeScript-first** — fully typed with ESM and CJS dual output

---

## Installation

```bash
npm install @hemicycle/vanilla
```

`@hemicycle/core` is a peer dependency and is included automatically.  
Requires **Node.js ≥ 18** and a DOM environment (browser or jsdom).

---

## Quick Start

```html
<svg id="hemicycle"></svg>
```

```ts
import { Hemicycle } from "@hemicycle/vanilla";

const hemicycle = new Hemicycle({
  rows: 7,
  totalSeats: 577,
  innerRadius: 40,
  outerRadius: 95,
  width: 800,
  height: 420,
});

const svg = document.getElementById("hemicycle") as SVGSVGElement;
hemicycle.render(svg);
```

---

## API

### `new Hemicycle(config)`

Creates a new renderer. Accepts all [`@hemicycle/core` config options](https://www.npmjs.com/package/@hemicycle/core) plus the following:

| Option           | Type         | Default   | Description                                  |
| ---------------- | ------------ | --------- | -------------------------------------------- |
| `width`          | `number`     | `800`     | SVG `width` attribute value                  |
| `height`         | `number`     | `400`     | SVG `height` attribute value                 |
| `seatConfig`     | `SeatConfig` | see below | Default visual style applied to all seats    |
| `hideEmptySeats` | `boolean`    | `false`   | Skip rendering seats with no associated data |

#### `SeatConfig`

| Option         | Type                          | Default  | Description                                                  |
| -------------- | ----------------------------- | -------- | ------------------------------------------------------------ |
| `shape`        | `"arc" \| "rect" \| "circle"` | `"arc"`  | Seat shape                                                   |
| `color`        | `string`                      | `"#ccc"` | Fill color                                                   |
| `borderRadius` | `number`                      | `1.5`    | Corner rounding for `arc` and `rect` shapes                  |
| `radius`       | `number`                      | `2`      | Radius for `circle` shape; radial thickness for `arc`/`rect` |

---

### `hemicycle.render(svg)`

Clears the target `<svg>` element and renders all seats into it. Also sets `viewBox`, `width`, and `height` attributes automatically.

```ts
hemicycle.render(document.querySelector("svg")!);
```

---

### `hemicycle.updateData(data)`

Attaches seat data and computes per-seat paths. Each item must identify a seat by `idx` or by `{ rowIndex, seatIndex }`, and may include a `seatConfig` to override the default style for that seat.

```ts
hemicycle.updateData([
  { idx: 0, party: "Left", seatConfig: { color: "#e63946" } },
  { idx: 1, party: "Center", seatConfig: { color: "#457b9d" } },
]);

hemicycle.render(svg);
```

Data items without a `seatConfig` inherit the global config. The `seatConfig` field is optional — omit it to use the global default.

---

### `hemicycle.updateConfig(config)`

Applies a partial config update. Call `render()` again afterward to redraw.

---

### Other accessors

| Method          | Returns                                                        |
| --------------- | -------------------------------------------------------------- |
| `getSeatData()` | `ComputedSeatData<T>[]` — seat layouts with computed SVG paths |
| `getViewBox()`  | `string` — the computed SVG `viewBox` value                    |
| `getEngine()`   | The underlying `@hemicycle/core` `Hemicycle` instance          |
| `getConfig()`   | `HemicycleConfig`                                              |

---

## Examples

### Coloring seats by party

```ts
const hemicycle = new Hemicycle({
  rows: 7,
  totalSeats: 577,
  seatConfig: { color: "#ddd", shape: "arc" },
});

hemicycle.updateData(
  members.map((m) => ({
    idx: m.seatNumber,
    seatConfig: { color: m.partyColor },
  })),
);

hemicycle.render(document.querySelector("#parliament")!);
```

### Hiding unoccupied seats

```ts
const hemicycle = new Hemicycle({
  rows: 5,
  totalSeats: 100,
  hideEmptySeats: true,
});

hemicycle.updateData(occupiedSeats); // Only these will be drawn
hemicycle.render(svg);
```

### Circular seats with custom radius

```ts
const hemicycle = new Hemicycle({
  rows: 6,
  totalSeats: 200,
  seatConfig: {
    shape: "circle",
    radius: 2.5,
    color: "#adb5bd",
  },
});
```

### Reactive updates

```ts
const hemicycle = new Hemicycle({ rows: 5, totalSeats: 50 });
hemicycle.render(svg);

// On user interaction, update data and re-render:
button.addEventListener("click", () => {
  hemicycle.updateData(newData);
  hemicycle.render(svg); // cleanUp() is called automatically
});
```

---

## Seat Shapes

| Shape    | Description                                                      |
| -------- | ---------------------------------------------------------------- |
| `arc`    | Curved wedge following the concentric arc of the row _(default)_ |
| `rect`   | Rectangular seat aligned to the arc midpoint                     |
| `circle` | Circle centered at the seat's midpoint                           |

---

## Related

- [`@hemicycle/core`](https://www.npmjs.com/package/@hemicycle/core) — layout engine (no rendering)

---

## Contributing

Bug reports and pull requests are welcome on [GitHub](https://github.com/GabrielVidal1/hemicycle).

---

## Support

- **Issues**: [GitHub Issues](https://github.com/GabrielVidal1/hemicycle/issues)
- **Source**: [github.com/GabrielVidal1/hemicycle](https://github.com/GabrielVidal1/hemicycle)

---

## Maintainer

**Gabriel Vidal** — [gvidalayrinhac@gmail.com](mailto:gvidalayrinhac@gmail.com)

---

## License

[MIT](LICENSE)
