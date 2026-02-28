import { Slider } from "@/components/ui/slider";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Hemicycle, HemicycleData, SeatShape } from "@hemicycle/react";
import React, { useMemo, useRef, useState } from "react";
import { Footer } from "../components/Footer";
import Navbar from "../components/Navbar";

// ─── Section Label ────────────────────────────────────────────────────────────
const SectionLabel: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => (
  <div className="flex items-center gap-3 mb-2 mt-6 first:mt-0">
    <span className="font-mono text-[10px] tracking-widest uppercase text-white/30 select-none whitespace-nowrap">
      {children}
    </span>
    <div className="flex-1 h-px bg-white/10" />
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
  <div className="flex items-center gap-3 py-1 group">
    <span className="w-28 shrink-0 font-mono text-[10px] text-white/30 group-hover:text-white/60 transition-colors text-right leading-tight uppercase tracking-wide">
      {label}
    </span>

    <div className="flex-1 min-w-0 [&_.ant-slider-track]:bg-white [&_.ant-slider-rail]:bg-white/10 [&_.ant-slider-handle]:border-white [&_.ant-slider-handle]:bg-black [&_.ant-slider-handle:hover]:border-white [&_.ant-slider-handle::after]:bg-white [&_.ant-slider-handle::after]:shadow-none">
      <Slider
        min={min}
        max={max}
        step={step}
        value={[value]}
        onValueChange={(v) => onChange(v[0])}
      />
    </div>

    <input
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(v) => onChange(v.target.valueAsNumber)}
      className="w-14.5! shrink-0"
      style={{
        fontSize: 11,
        fontFamily: "monospace",
        background: "transparent",
        borderColor: "rgba(255,255,255,0.15)",
        borderRadius: 0,
        color: "rgba(255,255,255,0.7)",
      }}
    />
  </div>
);

// ─── Pill Toggle ──────────────────────────────────────────────────────────────
interface PillToggleProps {
  title?: string;
  options: { label: string; value: string }[];
  value: string;
  onChange: (v: string) => void;
}

const PillToggle: React.FC<PillToggleProps> = ({
  title,
  options,
  value,
  onChange,
}) => (
  <div className="flex items-center gap-3 py-1.5">
    <span className="w-28 shrink-0 font-mono text-[10px] text-white/30 text-right uppercase tracking-wide">
      {title}
    </span>
    <div className="flex gap-px bg-white/5 border border-white/10 p-0.5">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={[
            "px-3 py-1 font-mono text-[10px] tracking-wide uppercase transition-all duration-150 cursor-pointer border-none",
            value === opt.value
              ? "bg-white text-black"
              : "text-white/40 hover:text-white/70 bg-transparent",
          ].join(" ")}
        >
          {opt.label}
        </button>
      ))}
    </div>
  </div>
);

// ─── SVG Export Helpers ───────────────────────────────────────────────────────
function getSvgString(container: HTMLElement): string | null {
  const svg = container.querySelector("svg");
  if (!svg) return null;
  const serializer = new XMLSerializer();
  return serializer.serializeToString(svg);
}

// ─── Export Button ────────────────────────────────────────────────────────────
interface ExportButtonProps {
  icon: React.ReactNode;
  label: string;
  status: "idle" | "success" | "error";
  onClick: () => void;
}

const ExportButton: React.FC<ExportButtonProps> = ({
  icon,
  label,
  status,
  onClick,
}) => {
  const statusColor =
    status === "success"
      ? "text-emerald-400 border-emerald-400/40"
      : status === "error"
        ? "text-red-400 border-red-400/40"
        : "text-white/40 border-white/15 hover:text-white/80 hover:border-white/40";

  return (
    <button
      onClick={onClick}
      className={[
        "flex items-center gap-1.5 px-3 py-1.5 font-mono text-[10px] tracking-widest uppercase",
        "border bg-black/60 backdrop-blur-sm transition-all duration-150 cursor-pointer",
        statusColor,
      ].join(" ")}
    >
      {icon}
      {status === "success" ? "Done" : status === "error" ? "Error" : label}
    </button>
  );
};

// ─── Icon: Copy ───────────────────────────────────────────────────────────────
const CopyIcon = () => (
  <svg
    width="11"
    height="11"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="9" y="9" width="13" height="13" rx="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);

// ─── Icon: Download ───────────────────────────────────────────────────────────
const DownloadIcon = () => (
  <svg
    width="11"
    height="11"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);

// ─── Main Component ───────────────────────────────────────────────────────────
export const HemicyclePlayground: React.FC = () => {
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
  const [radius, setRadius] = useState(1.5);
  const [ordering, setOrdering] = useState<"row" | "radial">("radial");
  // Aisles
  const [aisleNumber, setAisleNumber] = useState(5);
  const [aisleWidth, setAisleWidth] = useState(4);
  const [arcAisleNumber, setArcAisleNumber] = useState(0);
  const [arcAisleWidth, setArcAisleWidth] = useState(4);

  // Export state
  const previewRef = useRef<HTMLDivElement>(null);
  const [copyStatus, setCopyStatus] = useState<"idle" | "success" | "error">(
    "idle",
  );
  const [downloadStatus, setDownloadStatus] = useState<
    "idle" | "success" | "error"
  >("idle");

  const data = useMemo<HemicycleData[]>(() => {
    return Array.from({ length: totalSeats }, (_, idx) => ({
      idx,
      seatConfig: {
        color: `hsl(${(idx * 360) / totalSeats}, 80%, 55%)`,
      },
    }));
  }, [totalSeats]);

  const handleCopySvg = async () => {
    if (!previewRef.current) return;
    const svgString = getSvgString(previewRef.current);
    if (!svgString) {
      setCopyStatus("error");
      setTimeout(() => setCopyStatus("idle"), 2000);
      return;
    }
    try {
      await navigator.clipboard.writeText(svgString);
      setCopyStatus("success");
    } catch {
      setCopyStatus("error");
    }
    setTimeout(() => setCopyStatus("idle"), 2000);
  };

  const handleDownloadSvg = () => {
    if (!previewRef.current) return;
    const svgString = getSvgString(previewRef.current);
    if (!svgString) {
      setDownloadStatus("error");
      setTimeout(() => setDownloadStatus("idle"), 2000);
      return;
    }
    try {
      const blob = new Blob([svgString], { type: "image/svg+xml" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "hemicycle.svg";
      a.click();
      URL.revokeObjectURL(url);
      setDownloadStatus("success");
    } catch {
      setDownloadStatus("error");
    }
    setTimeout(() => setDownloadStatus("idle"), 2000);
  };

  return (
    <div className="h-screen bg-black text-white selection:bg-white selection:text-black flex flex-col">
      <Navbar />
      <div className="flex bg-black font-sans h-0 flex-1">
        {/* ── Controls Panel ───────────────────────────────────────────── */}
        <aside className="w-120 shrink-0 bg-black border-r border-white/10 flex flex-col">
          {/* Scrollable controls */}
          <div
            className="flex-1 overflow-y-auto px-5 py-6 overscroll-contain"
            style={{
              scrollbarWidth: "none",
            }}
          >
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
              label="Inner R"
              value={innerRadius}
              min={0}
              max={outerRadius - 10}
              step={1}
              onChange={setInnerRadius}
            />
            <ControlRow
              label="Outer R"
              value={outerRadius}
              min={innerRadius + 10}
              max={300}
              step={1}
              onChange={setOuterRadius}
            />
            <ControlRow
              label="Angle"
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

            <SectionLabel>Seats</SectionLabel>
            <PillToggle
              title="Shape"
              value={shape}
              onChange={(v) => setShape(v as SeatShape)}
              options={[
                { label: "Arc", value: "arc" },
                { label: "Rect", value: "rect" },
                { label: "Circle", value: "circle" },
              ]}
            />
            <ControlRow
              label="Count"
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
            {shape !== "circle" ? (
              <ControlRow
                label="Brd. Radius"
                value={seatBorderRadius}
                min={0}
                max={4}
                step={0.1}
                onChange={setSeatBorderRadius}
              />
            ) : (
              <ControlRow
                label="Radius"
                value={radius}
                min={0.5}
                max={3}
                step={0.1}
                onChange={setRadius}
              />
            )}
            <PillToggle
              title="Order"
              value={ordering}
              onChange={(v) => setOrdering(v as "row" | "radial")}
              options={[
                { label: "Row", value: "row" },
                { label: "Radial", value: "radial" },
              ]}
            />

            <SectionLabel>Aisles</SectionLabel>
            <ControlRow
              label="Radial #"
              value={aisleNumber}
              min={0}
              max={5}
              step={1}
              onChange={setAisleNumber}
            />
            <ControlRow
              label="Radial W"
              value={aisleWidth}
              min={0}
              max={20}
              step={0.5}
              onChange={setAisleWidth}
            />
            <ControlRow
              label="Arc #"
              value={arcAisleNumber}
              min={0}
              max={5}
              step={1}
              onChange={setArcAisleNumber}
            />
            <ControlRow
              label="Arc W"
              value={arcAisleWidth}
              min={0}
              max={20}
              step={0.5}
              onChange={setArcAisleWidth}
            />
          </div>
        </aside>

        {/* ── Preview Area ─────────────────────────────────────────────── */}
        <main className="flex-1 flex flex-col items-center justify-center bg-black relative overflow-hidden">
          {/* Subtle dot-grid background */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage:
                "radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px)",
              backgroundSize: "24px 24px",
            }}
          />

          {/* Seat count badge */}
          <div className="absolute top-5 right-5 font-mono text-[10px] tracking-widest uppercase text-white/20">
            {totalSeats} seats · {rows} rows
          </div>

          {/* Hemicycle */}
          <div
            ref={previewRef}
            className="relative z-10 w-full h-full flex items-center justify-center"
          >
            <Hemicycle
              rows={rows}
              innerRadius={innerRadius}
              outerRadius={outerRadius}
              totalAngle={totalAngle}
              rowMargin={rowMargin}
              data={data}
              totalSeats={totalSeats}
              seatMargin={seatMargin}
              orderBy={ordering}
              aislesCount={aisleNumber}
              aislesWidth={aisleWidth}
              arcAislesCount={arcAisleNumber}
              arcAislesWidth={arcAisleWidth}
              seatConfig={{
                shape,
                radius: shape === "circle" ? radius : undefined,
                borderRadius: seatBorderRadius,
                wrapper: (content, data) => (
                  <Tooltip key={data?.idx}>
                    <TooltipTrigger asChild>{content}</TooltipTrigger>
                    <TooltipContent>
                      <span style={{ fontFamily: "monospace", fontSize: 11 }}>
                        seat {data?.idx}
                      </span>{" "}
                    </TooltipContent>
                  </Tooltip>
                ),
                props: {
                  style: { cursor: "pointer", pointerEvents: "all" },
                },
              }}
            />
          </div>

          {/* ── SVG Export Buttons ──────────────────────────────────────── */}
          <div className="absolute bottom-5 right-5 z-20 flex items-center gap-2">
            <ExportButton
              icon={<CopyIcon />}
              label="Copy SVG"
              status={copyStatus}
              onClick={handleCopySvg}
            />
            <ExportButton
              icon={<DownloadIcon />}
              label="Download SVG"
              status={downloadStatus}
              onClick={handleDownloadSvg}
            />
          </div>
        </main>
      </div>
      <Footer />
    </div>
  );
};
