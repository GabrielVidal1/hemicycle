import React, { useMemo, useState } from "react";
import { Hemicycle } from "./Hemicycle";
import { distributeSeats } from "./helpers";

type Mode = "totalSeats" | "manual";

type SeatData = {
  id: number;
  enabled: boolean;
  x: number;
  y: number;
};

function mulberry32(seed: number) {
  let a = seed | 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const HemicyclePlayground: React.FC = () => {
  // Layout
  const [rows, setRows] = useState(6);
  const [innerRadius, setInnerRadius] = useState(40);
  const [outerRadius, setOuterRadius] = useState(95);
  const [totalAngle, setTotalAngle] = useState(180);
  const [rowMargin, setRowMargin] = useState(1);

  // Mode
  const [mode, setMode] = useState<Mode>("totalSeats");
  const [totalSeats, setTotalSeats] = useState(120);

  // Manual sizing
  const [seatMargin, setSeatMargin] = useState(1);
  const [seatHeight, setSeatHeight] = useState<number | undefined>(undefined);

  // Demo controls
  const [fillPercent, setFillPercent] = useState(70);
  const [seed, setSeed] = useState(1);

  const totalAngleRad = (totalAngle * Math.PI) / 180;
  const radialStep = (outerRadius - innerRadius) / rows;

  const seatsPerRow = useMemo(() => {
    const seatMarginLinear = mode === "totalSeats" ? 1 : (seatMargin ?? 1);

    const effectiveRowMargin = rowMargin ?? seatMarginLinear;

    if (mode === "totalSeats") {
      return distributeSeats(
        totalSeats,
        rows,
        innerRadius,
        radialStep,
        effectiveRowMargin,
      );
    }

    return Array.from({ length: rows }, (_, rowIndex) => {
      const rowInnerR = innerRadius + rowIndex * radialStep;
      const rowOuterR = rowInnerR + radialStep;

      const bandInnerR = rowInnerR + effectiveRowMargin / 2;
      const bandOuterR = rowOuterR - effectiveRowMargin / 2;
      const midR = (bandInnerR + bandOuterR) / 2;

      const seatMarginRad = seatMarginLinear / midR;
      const naturalSeatAngle = (radialStep - effectiveRowMargin) / midR;
      const slotAngle = naturalSeatAngle + seatMarginRad;

      return Math.max(1, Math.round(totalAngleRad / slotAngle));
    });
  }, [
    mode,
    totalSeats,
    rows,
    innerRadius,
    radialStep,
    totalAngleRad,
    seatMargin,
    rowMargin,
  ]);

  const data: SeatData[] = useMemo(() => {
    const rng = mulberry32(seed);
    const enabledP = fillPercent / 100;

    const result: SeatData[] = [];
    let id = 1;

    for (let row = 0; row < rows; row++) {
      const count = seatsPerRow[row] ?? 0;
      for (let seat = 0; seat < count; seat++) {
        result.push({
          id: id++,
          x: seat,
          y: row,
          enabled: rng() < enabledP,
        });
      }
    }

    return result;
  }, [rows, seatsPerRow, fillPercent, seed]);

  return (
    <div style={{ display: "flex", gap: 32 }}>
      {/* Controls */}
      <div style={{ width: 300 }}>
        <h3>Layout</h3>
        <Slider
          label="Rows"
          value={rows}
          min={1}
          max={15}
          step={1}
          onChange={setRows}
        />
        <Slider
          label="Inner Radius"
          value={innerRadius}
          min={0}
          max={200}
          step={1}
          onChange={setInnerRadius}
        />
        <Slider
          label="Outer Radius"
          value={outerRadius}
          min={10}
          max={300}
          step={1}
          onChange={setOuterRadius}
        />
        <Slider
          label="Total Angle"
          value={totalAngle}
          min={60}
          max={360}
          step={1}
          onChange={setTotalAngle}
        />
        <Slider
          label="Row Margin"
          value={rowMargin}
          min={0}
          max={10}
          step={0.5}
          onChange={setRowMargin}
        />

        <h3>Mode</h3>
        <div style={{ marginBottom: 12 }}>
          <button
            onClick={() => setMode("totalSeats")}
            disabled={mode === "totalSeats"}
          >
            Total Seats
          </button>
          <button
            onClick={() => setMode("manual")}
            disabled={mode === "manual"}
            style={{ marginLeft: 8 }}
          >
            Manual
          </button>
        </div>

        {mode === "totalSeats" && (
          <Slider
            label="Total Seats"
            value={totalSeats}
            min={1}
            max={500}
            step={1}
            onChange={setTotalSeats}
          />
        )}

        {mode === "manual" && (
          <>
            <Slider
              label="Seat Margin"
              value={seatMargin}
              min={0}
              max={10}
              step={0.5}
              onChange={setSeatMargin}
            />
            <Slider
              label="Seat Height"
              value={seatHeight ?? 0}
              min={0}
              max={40}
              step={1}
              onChange={(v) => setSeatHeight(v === 0 ? undefined : v)}
            />
          </>
        )}

        <h3>Demo</h3>
        <Slider
          label="Fill %"
          value={fillPercent}
          min={0}
          max={100}
          step={1}
          onChange={setFillPercent}
        />
        <Slider
          label="Seed"
          value={seed}
          min={0}
          max={9999}
          step={1}
          onChange={setSeed}
        />
      </div>

      {/* Preview */}
      <div style={{ flex: 1 }}>
        {mode === "totalSeats" ? (
          <Hemicycle
            rows={rows}
            innerRadius={innerRadius}
            outerRadius={outerRadius}
            totalAngle={totalAngle}
            rowMargin={rowMargin}
            totalSeats={totalSeats}
            data={data}
          />
        ) : (
          <Hemicycle
            rows={rows}
            innerRadius={innerRadius}
            outerRadius={outerRadius}
            totalAngle={totalAngle}
            rowMargin={rowMargin}
            seatMargin={seatMargin}
            seatHeight={seatHeight}
            data={data}
          />
        )}
      </div>
    </div>
  );
};

type SliderProps = {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
};

const Slider: React.FC<SliderProps> = ({
  label,
  value,
  min,
  max,
  step,
  onChange,
}) => {
  return (
    <div style={{ marginBottom: 12 }}>
      <label>
        {label}: <strong>{value}</strong>
      </label>
      <input
        type="range"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ width: "100%" }}
      />
    </div>
  );
};
