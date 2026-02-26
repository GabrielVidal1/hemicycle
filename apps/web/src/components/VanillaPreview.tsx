import { Hemicycle } from "@hemicycle/react";
import { useMemo, useState } from "react";

export function VanillaPreview() {
  const [frame, setFrame] = useState(0);
  const totalSeats = 80;
  const COLORS = ["#06b6d4", "#8b5cf6", "#ec4899", "#f97316", "#84cc16"];

  const data = useMemo(() => {
    return new Array(totalSeats).fill(0).map((_, idx) => {
      const colorIdx = Math.floor(idx / (totalSeats / COLORS.length));
      const shifted = (colorIdx + frame) % COLORS.length;
      return {
        idx,
        seatConfig: {
          color: COLORS[shifted],
          props: {
            style: { transition: "fill 0.4s ease" },
          },
        },
      };
    });
  }, [frame, totalSeats]);

  return (
    <div className="flex flex-col items-center gap-3 w-full">
      <div className="text-white/40 text-xs font-mono uppercase tracking-widest mb-1">
        Framework-free
      </div>
      <Hemicycle
        rows={4}
        orderBy="radial"
        totalSeats={totalSeats}
        data={data}
        width={280}
        height={158}
        seatMargin={2}
        seatConfig={{
          shape: "rect",
        }}
      />
      <div className="flex items-center gap-3">
        <span className="text-white/40 text-xs font-mono">
          chart.updateData(…)
        </span>
        <button
          onClick={() => setFrame((f) => (f + 1) % COLORS.length)}
          className="text-xs font-mono px-3 py-1.5 rounded border border-white/20 text-white/60 hover:text-white hover:border-white/40 transition-colors"
        >
          Cycle colors →
        </button>
      </div>
    </div>
  );
}
