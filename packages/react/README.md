# @hemicycle/react

[![npm version](https://img.shields.io/npm/v/@hemicycle/react)](https://www.npmjs.com/package/@hemicycle/react)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js >=18](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](https://nodejs.org/)

> React component for rendering parliament-style hemicycle seat charts.

`@hemicycle/react` is the React wrapper around [`@hemicycle/vanilla`](https://www.npmjs.com/package/@hemicycle/vanilla). Drop in a `<Hemicycle>` component, pass your seat data as props, and get a fully rendered SVG chart that re-renders reactively on changes.

---

## Features

- **Single `<Hemicycle>` component** — configure layout and data entirely through props
- **Per-seat React wrappers** — wrap any seat with a custom React node (tooltips, popovers, links, etc.)
- **Per-seat SVG props** — attach `onClick`, `aria-*`, `data-*`, and any other SVG attributes to individual seats
- **All `@hemicycle/vanilla` options** — shapes (`arc`, `rect`, `circle`), aisles, mirroring, radii, and more
- **TypeScript generics** — type your seat data end-to-end with `HemicycleProps<T>`

---

## Installation

```bash
npm install @hemicycle/react
```

Requires **React ≥ 18** and **Node.js ≥ 18**.

---

## Quick Start

```tsx
import { Hemicycle } from "@hemicycle/react";

export function ParliamentChart() {
  return (
    <Hemicycle
      rows={7}
      totalSeats={577}
      innerRadius={40}
      outerRadius={95}
      width={800}
      height={420}
    />
  );
}
```

---

## API

### `<Hemicycle>`

All props are optional. Accepts all [`@hemicycle/vanilla` config options](https://www.npmjs.com/package/@hemicycle/vanilla) plus:

| Prop         | Type                            | Description                                       |
| ------------ | ------------------------------- | ------------------------------------------------- |
| `data`       | `HemicycleData<T>[]`            | Seat data array (see below)                       |
| `svgProps`   | `React.SVGProps<SVGSVGElement>` | Extra props forwarded to the root `<svg>` element |
| `seatConfig` | `SeatConfig<T>`                 | Default visual style and behavior for all seats   |

#### `SeatConfig<T>`

Extends the vanilla `SeatConfig` (`shape`, `color`, `borderRadius`, `radius`) with two React-specific additions:

| Option    | Type                             | Description                                       |
| --------- | -------------------------------- | ------------------------------------------------- |
| `wrapper` | `(content, data) => ReactNode`   | Wraps each seat's `<path>` in a custom React node |
| `props`   | `React.SVGProps<SVGPathElement>` | Default SVG props applied to every seat `<path>`  |

---

### Seat data

Each item in the `data` array identifies a seat by index or by coordinates, exactly as in `@hemicycle/core`, and may include a per-seat `seatConfig` to override styles and behavior for that seat:

```ts
type HemicycleData<T> = T &
  ({ idx: number } | { rowIndex: number; seatIndex: number }) & {
    seatConfig?: SeatConfig<T>;
  };
```

Per-seat `seatConfig` is merged on top of the global `seatConfig` prop, so you only need to specify what differs.

---

## Examples

### Coloring seats by party

```tsx
const members = [
  { idx: 0, party: "Left", color: "#e63946" },
  { idx: 1, party: "Center", color: "#457b9d" },
  // ...
];

<Hemicycle
  rows={7}
  totalSeats={577}
  data={members.map((m) => ({
    idx: m.idx,
    party: m.party,
    seatConfig: { color: m.color },
  }))}
/>;
```

### Clickable seats with tooltips

```tsx
<Hemicycle
  rows={5}
  totalSeats={100}
  data={seats.map((seat) => ({
    idx: seat.idx,
    seatConfig: {
      color: seat.partyColor,
      props: {
        onClick: () => setSelected(seat),
        style: { cursor: "pointer" },
      },
      wrapper: (content, data) => (
        <Tooltip key={data?.idx} label={data?.party}>
          {content}
        </Tooltip>
      ),
    },
  }))}
/>
```

### Custom SVG container props

```tsx
<Hemicycle
  rows={5}
  totalSeats={100}
  svgProps={{
    className: "my-chart",
    "aria-label": "Parliament seating chart",
    style: { maxWidth: "100%" },
  }}
/>
```

### Typed seat data

```tsx
type Member = {
  name: string;
  party: string;
};

const data: HemicycleData<Member>[] = members.map((m) => ({
  idx: m.seatNumber,
  name: m.name,
  party: m.party,
  seatConfig: { color: m.partyColor },
}));

<Hemicycle<Member> data={data} rows={7} totalSeats={577} />;
```

---

## Seat Shapes

| Shape    | Description                                                      |
| -------- | ---------------------------------------------------------------- |
| `arc`    | Curved wedge following the concentric arc of the row _(default)_ |
| `rect`   | Rectangle aligned to the seat's arc midpoint                     |
| `circle` | Circle centered at the seat's midpoint                           |

---

## Related

- [`@hemicycle/core`](https://www.npmjs.com/package/@hemicycle/core) — layout engine (geometry only, no rendering)
- [`@hemicycle/vanilla`](https://www.npmjs.com/package/@hemicycle/vanilla) — framework-free SVG renderer

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
