import { Hemicycle, HemicycleData, randomColor, SeatShape } from "@repo/ui";
import { InputNumber, Slider, Tooltip } from "antd";
import React, { useMemo, useState } from "react";

// ─── Section Header ───────────────────────────────────────────────────────────
const SectionLabel: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => (
  <div className="flex items-center gap-2 mb-3 mt-5 first:mt-0">
    <span className="text-[10px] font-bold tracking-[0.18em] uppercase text-slate-400 select-none">
      {children}
    </span>
    <div className="flex-1 h-px bg-slate-100" />
  </div>
);

// ─── Control Row ──────────────────────────────────────────────────────────────
interface ControlRowProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}

const ControlRow: React.FC<ControlRowProps> = ({
  label,
  value,
  min,
  max,
  step,
  onChange,
}) => (
  <div className="flex items-center gap-3 py-1.5 group">
    {/* Label */}
    <span className="w-32 shrink-0 text-[11px] font-medium text-slate-500 group-hover:text-slate-700 transition-colors text-right leading-tight">
      {label}
    </span>

    {/* Slider */}
    <div className="flex-1 min-w-0">
      <Slider
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(v) => onChange(v as number)}
        tooltip={{ formatter: null }}
      />
    </div>

    {/* Number Input */}
    <InputNumber
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(v) => onChange(v as number)}
      size="small"
      className="!w-[62px] shrink-0"
      style={{
        fontSize: 11,
        borderColor: "#e2e8f0",
        borderRadius: 6,
        color: "#334155",
      }}
    />
  </div>
);

// ─── Pill Toggle ──────────────────────────────────────────────────────────────
interface PillToggleProps {
  options: { label: string; value: string }[];
  value: string;
  onChange: (v: string) => void;
}

const PillToggle: React.FC<PillToggleProps> = ({
  options,
  value,
  onChange,
}) => (
  <div className="flex items-center gap-3 py-1.5">
    <span className="w-32 shrink-0 text-[11px] font-medium text-slate-500 text-right">
      Seat Shape
    </span>
    <div className="flex gap-1 bg-slate-100 p-0.5 rounded-lg">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={[
            "px-3 py-1 rounded-md text-[11px] font-semibold transition-all duration-150 cursor-pointer border-none",
            value === opt.value
              ? "bg-white text-slate-800 shadow-sm"
              : "text-slate-600 hover:bg-white hover:text-slate-800",
          ].join(" ")}
        >
          {opt.label}
        </button>
      ))}
    </div>
  </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────
export const HemicycleWithAislesPlayground: React.FC = () => {
  // Layout
  const [rows, setRows] = useState(15);
  const [innerRadius, setInnerRadius] = useState(40);
  const [outerRadius, setOuterRadius] = useState(95);
  const [totalAngle, setTotalAngle] = useState(200);
  const [rowMargin, setRowMargin] = useState(1);
  // Seat
  const [totalSeats, setTotalSeats] = useState(600);
  const [seatMargin, setSeatMargin] = useState(1);
  const [shape, setShape] = useState<SeatShape>("arc");
  const [seatBorderRadius, setSeatBorderRadius] = useState(0.5);
  // Aisles
  const [aisleNumber, setAisleNumber] = useState(7);
  const [aisleWidth, setAisleWidth] = useState(4);

  const data = useMemo(() => {
    return new Array(totalSeats).fill(0).map((_, idx) => {
      const d: HemicycleData = {
        id: `id-${idx}`,
        idx: idx,
        color: randomColor(idx),
      };
      return d;
    });
  }, [totalSeats]);

  return (
    <div className="flex h-screen bg-slate-50 font-sans">
      {/* ── Controls Panel ───────────────────────────────────────────── */}
      <aside className="w-125 shrink-0 bg-white border-r border-slate-100 flex flex-col overflow-hidden shadow-sm">
        {/* Scrollable controls */}
        <div className="flex-1 overflow-y-auto px-5 pb-6 overscroll-contain">
          <SectionLabel>Layout</SectionLabel>
          <ControlRow
            label="Rows"
            value={rows}
            min={1}
            max={15}
            step={1}
            onChange={setRows}
          />
          <ControlRow
            label="Inner Radius"
            value={innerRadius}
            min={0}
            max={200}
            step={1}
            onChange={setInnerRadius}
          />
          <ControlRow
            label="Outer Radius"
            value={outerRadius}
            min={10}
            max={300}
            step={1}
            onChange={setOuterRadius}
          />
          <ControlRow
            label="Total Angle"
            value={totalAngle}
            min={60}
            max={360}
            step={1}
            onChange={setTotalAngle}
          />
          <ControlRow
            label="Row Margin"
            value={rowMargin}
            min={0}
            max={10}
            step={0.5}
            onChange={setRowMargin}
          />

          <SectionLabel>Aisles</SectionLabel>
          <ControlRow
            label="Aisle Count"
            value={aisleNumber}
            min={0}
            max={10}
            step={1}
            onChange={setAisleNumber}
          />
          {aisleNumber > 0 && (
            <ControlRow
              label="Aisle Width °"
              value={aisleWidth}
              min={1}
              max={20}
              step={0.5}
              onChange={setAisleWidth}
            />
          )}

          <SectionLabel>Seats</SectionLabel>
          <PillToggle
            value={shape}
            onChange={(v) => setShape(v as SeatShape)}
            options={[
              { label: "Arc", value: "arc" },
              { label: "Rect", value: "rect" },
              { label: "Circle", value: "circle" },
            ]}
          />
          <ControlRow
            label="Total Seats"
            value={totalSeats}
            min={1}
            max={800}
            step={1}
            onChange={setTotalSeats}
          />
          <ControlRow
            label="Seat Margin"
            value={seatMargin}
            min={0}
            max={10}
            step={0.5}
            onChange={setSeatMargin}
          />
          {shape !== "circle" && (
            <ControlRow
              label="Border Radius"
              value={seatBorderRadius}
              min={0}
              max={4}
              step={0.1}
              onChange={setSeatBorderRadius}
            />
          )}
        </div>
      </aside>

      {/* ── Preview Area ─────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col items-center justify-center bg-slate-50 relative overflow-hidden">
        {/* Subtle grid background */}
        <div
          className="absolute inset-0 pointer-events-none opacity-40"
          style={{
            backgroundImage:
              "radial-gradient(circle, #cbd5e1 1px, transparent 1px)",
            backgroundSize: "24px 24px",
          }}
        />

        {/* Hemicycle canvas */}
        <div className="relative z-10 w-full h-full flex items-center justify-center">
          <Hemicycle.WithAisles
            rows={rows}
            innerRadius={innerRadius}
            outerRadius={outerRadius}
            totalAngle={totalAngle}
            rowMargin={rowMargin}
            data={data}
            totalSeats={totalSeats}
            seatConfig={{
              seatMargin: seatMargin,
              shape: shape,
              borderRadius: seatBorderRadius,
              wrapper: (content, data) => (
                <Tooltip title={`Seat ${data?.idx}`}>{content}</Tooltip>
              ),
              props: {
                style: { cursor: "pointer", pointerEvents: "all" },
              },
            }}
            aisleNumber={aisleNumber}
            aisleWidth={aisleWidth}
          />
        </div>
      </main>
    </div>
  );
};
