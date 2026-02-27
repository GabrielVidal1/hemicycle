import { Hemicycle, HemicycleData } from "@hemicycle/react";
import { ComputedSeatData } from "@hemicycle/vanilla";
import { Tooltip } from "antd";
import { useMemo } from "react";
import { useScreen } from "../hooks/useScreen";

// ─── Constants ───────────────────────────────────────────────────────────────

const TOTAL_SEATS = 150;

const PARTY_THRESHOLDS = [
  { label: "Far Left", short: "FL", from: 0 },
  { label: "Left", short: "L", from: 0.1 },
  { label: "Centre-Left", short: "CL", from: 0.25 },
  { label: "Centre", short: "C", from: 0.4 },
  { label: "Centre-Right", short: "CR", from: 0.55 },
  { label: "Right", short: "R", from: 0.7 },
  { label: "Far Right", short: "FR", from: 0.85 },
];

function getParty(idx: number, total: number) {
  const pct = idx / total;
  return [...PARTY_THRESHOLDS].reverse().find((p) => pct >= p.from)!;
}

function getSeatColor(idx: number, total: number) {
  return `hsl(${(idx * 360) / total}, 70%, 50%)`;
}

// ─── Spectrum bar ─────────────────────────────────────────────────────────────

function SpectrumBar({ idx, total }: { idx: number; total: number }) {
  const pct = (idx / total) * 100;
  return (
    <div className="relative h-1.5 w-full rounded-full overflow-hidden">
      {/* rainbow track */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(90deg,#ef4444,#f97316,#eab308,#22c55e,#06b6d4,#6366f1,#a855f7,#ec4899)",
        }}
      />
      {/* dark overlay so the marker pops */}
      <div className="absolute inset-0 bg-black/30" />
      {/* marker */}
      <div
        className="absolute top-1/2 -translate-y-1/2 size-3 rounded-full border-2 border-white shadow-lg shadow-black/60 -translate-x-1/2"
        style={{
          left: `${pct}%`,
          background: getSeatColor(idx, total),
        }}
      />
    </div>
  );
}

// ─── Tooltip content ──────────────────────────────────────────────────────────

function SeatTooltipContent({
  seat,
  total,
}: {
  seat: ComputedSeatData;
  total: number;
}) {
  const color = getSeatColor(seat.radialIdx, total);
  const party = getParty(seat.radialIdx, total);

  return (
    <div className="w-44 font-mono text-xs">
      {/* header */}
      <div
        className="flex items-center justify-between px-3 py-2 rounded-t"
        style={{ background: color + "22", borderBottom: `2px solid ${color}` }}
      />

      {/* body */}
      <div className="bg-[#111] rounded-b px-3 py-2.5 space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="font-bold text-white tracking-widest uppercase text-[10px]">
            {party.label}
          </span>
          <span className="text-white/50 text-[10px]">
            #{String(seat.idx + 1).padStart(3, "0")}
          </span>
        </div>
        {/* row / col */}
        <div className="flex justify-between text-[10px]">
          <span className="text-white/40">
            Row {seat.rowIndex} · Col {seat.seatIndex}
          </span>
        </div>

        {/* spectrum */}
        <div className="space-y-1">
          <SpectrumBar idx={seat.radialIdx} total={total} />
          <div className="flex justify-between text-[9px] text-white/20">
            <span>Left</span>
            <span>Right</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface HemicycleSVGProps {
  animated: boolean;
  disableAnimation?: boolean;
}

export function HemicycleSVG({
  animated,
  disableAnimation,
}: HemicycleSVGProps) {
  const totalSeats = TOTAL_SEATS;

  const { width } = useScreen();

  const data = useMemo<HemicycleData[]>(() => {
    return Array.from({ length: totalSeats }, (_, idx) => {
      const ff = (idx / totalSeats) * 0.8;

      return {
        idx,
        seatConfig: {
          color: getSeatColor(idx, totalSeats),
          props: {
            style: {
              opacity: animated || disableAnimation ? 1 : 0,
              transition: animated
                ? `opacity 0.4s ease ${ff}s, transform 0.4s ease ${ff}s`
                : "none",
              transformOrigin: "0 0",
            },
          },
          wrapper: (content, seat) =>
            seat ? (
              <Tooltip
                key={seat.idx}
                title={<SeatTooltipContent seat={seat} total={totalSeats} />}
                // transparent background — the card styles itself
                color="transparent"
                styles={{
                  container: {
                    padding: 0,
                    background: "transparent",
                    boxShadow: "none",
                  },
                  root: {
                    maxWidth: "none",
                  },
                }}
                mouseEnterDelay={0.05}
                mouseLeaveDelay={0.1}
              >
                {content}
              </Tooltip>
            ) : (
              content
            ),
        },
      };
    });
  }, [totalSeats, animated]);

  return (
    <Hemicycle
      rows={6}
      width={Math.min(width, 600)}
      height={350}
      totalSeats={totalSeats}
      data={data}
      totalAngle={200}
      orderBy="radial"
      aislesCount={4}
      aislesWidth={4}
      arcAislesCount={1}
      arcAislesWidth={4}
    />
  );
}
