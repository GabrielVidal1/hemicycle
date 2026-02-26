import { Hemicycle } from "@hemicycle/core";
import { useMemo } from "react";

export function CorePreview() {
  const totalSeats = 80;
  const rows = 4;

  const layoutPoints = useMemo(() => {
    return new Hemicycle({
      totalSeats,
      rows,
    }).getSeatsLayout();
  }, [totalSeats, rows]);

  const rowColors = ["#22d3ee", "#818cf8", "#a78bfa", "#c084fc"];

  return (
    <div className="flex flex-col items-center gap-3 w-full">
      <div className="text-white/40 text-xs font-mono uppercase tracking-widest mb-1">
        Raw geometry output
      </div>

      <svg
        width={280}
        height={158}
        viewBox="-99 -99 198 103"
        className="overflow-visible"
      >
        {layoutPoints.map((seat, i) => (
          <circle
            key={i}
            cx={seat.x}
            cy={seat.y}
            r={4}
            fill={rowColors[seat.rowIndex % rowColors.length]}
            opacity={0.85}
          />
        ))}

        {/* axis */}
        <line
          x1={10}
          y1={148}
          x2={270}
          y2={148}
          stroke="rgba(255,255,255,0.1)"
          strokeWidth={1}
        />
        <circle cx={140} cy={148} r={3} fill="rgba(255,255,255,0.2)" />

        {/* annotation */}
        <text
          x={145}
          y={146}
          fill="rgba(255,255,255,0.25)"
          fontSize={9}
          fontFamily="monospace"
        >
          origin
        </text>
      </svg>

      <div className="flex gap-2 flex-wrap justify-center">
        {rowColors.map((c, i) => (
          <span
            key={i}
            className="text-xs font-mono flex items-center gap-1 text-white/50"
          >
            <span
              className="w-2 h-2 rounded-full inline-block"
              style={{ background: c }}
            />
            row {i + 1}
          </span>
        ))}
      </div>

      <div className="text-white/30 text-xs font-mono">
        layout[i] → &#123; x, y, angle1Rad, … &#125;
      </div>
    </div>
  );
}
