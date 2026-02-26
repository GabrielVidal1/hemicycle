# @hemicycle/core

[![npm version](https://img.shields.io/npm/v/@hemicycle/core)](https://www.npmjs.com/package/@hemicycle/core)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js >=18](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](https://nodejs.org/)

> Core layout engine for rendering parliament-style hemicycle seat charts.

`@hemicycle/core` computes the geometry for concentric arc seating arrangements — the kind used to visualize parliaments, assemblies, and any fan-shaped seat layout. Given a seat count and a few sizing parameters, it returns precise coordinates and indices for every seat, ready to render in SVG, Canvas, or any visualization library.

---

## Features

- **Flexible seat distribution** — automatically distributes seats across rows proportional to arc length, or accepts a custom `seatsPerRow` array
- **Aisles support** — insert radial (angular) aisles and/or arc (concentric) aisles to create realistic chamber layouts
- **Mirroring** — horizontally flip the layout for alternative orientations
- **Radial & row ordering** — choose between row-major or radial-major seat indexing to match your data
- **Data mapping** — attach arbitrary data objects to seats by index or by `(rowIndex, seatIndex)` coordinate
- **TypeScript-first** — fully typed with ESM and CJS dual output
- **Zero runtime dependencies** on rendering libraries — outputs plain coordinate objects

---

## Installation

```bash
npm install @hemicycle/core
```

Requires **Node.js ≥ 18**.

---

## Quick Start

```ts
import { Hemicycle } from "@hemicycle/core";

// 1. Create an engine with your layout config
const hemicycle = new Hemicycle({
  rows: 7,
  totalSeats: 577, // e.g. French Assemblée nationale
  innerRadius: 40,
  outerRadius: 95,
  totalAngle: 180,
});

// 2. Get the computed seat positions
const layout = hemicycle.getSeatsLayout();

// Each seat contains coordinates and indices
// layout[0] → { idx, radialIdx, rowIndex, seatIndex, x, y, innerR, outerR, angle1Rad, angle2Rad }
```

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
