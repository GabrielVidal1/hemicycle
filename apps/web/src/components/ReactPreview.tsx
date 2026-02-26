import { Hemicycle, HemicycleData } from "@hemicycle/react";
import { useMemo, useState } from "react";

// ── Tab Previews ──────────────────────────────────────────────────────────────
export function ReactPreview() {
  const [hoveredSeat, setHoveredSeat] = useState<number | null>(null);
  const [hoveredParty, setHoveredParty] = useState<string | null>(null);
  const [clicked, setClicked] = useState<number | null>(null);

  const totalSeats = 80;

  // Define parties once
  const parties = [
    { color: "#ef4444", label: "Party A", seats: 28 },
    { color: "#3b82f6", label: "Party B", seats: 22 },
    { color: "#22c55e", label: "Party C", seats: 16 },
    { color: "#f59e0b", label: "Party D", seats: 14 },
  ];

  const data = useMemo(() => {
    return new Array(totalSeats).fill(0).map((_, idx) => {
      const isHoveredSeat = hoveredSeat === idx;
      const isClicked = clicked === idx;

      // Determine party for this seat
      let cumulative = 0;
      let party = parties[parties.length - 1];
      for (const p of parties) {
        if (idx < cumulative + p.seats) {
          party = p;
          break;
        }
        cumulative += p.seats;
      }

      const isDimmed = hoveredParty !== null && hoveredParty !== party.label;

      const baseColor = party.color;

      const d: HemicycleData = {
        idx,
        seatConfig: {
          color: isClicked
            ? "#ffffff"
            : isDimmed
            ? baseColor + "33" // faded other parties
            : isHoveredSeat
            ? baseColor + "cc"
            : baseColor,
          props: {
            style: {
              cursor: "pointer",
              filter:
                isHoveredSeat && !isDimmed
                  ? `drop-shadow(0 0 4px ${baseColor})`
                  : "none",
              opacity: isDimmed ? 0.35 : 1,
              transition: "all 0.15s ease",
            },
            onMouseEnter: () => {
              setHoveredSeat(idx);
              setHoveredParty(party.label);
            },
            onMouseLeave: () => {
              setHoveredSeat(null);
              setHoveredParty(null);
            },
            onClick: () => setClicked(idx === clicked ? null : idx),
          },
        },
      };

      return d;
    });
  }, [totalSeats, hoveredSeat, hoveredParty, clicked, parties]);

  return (
    <div className="flex flex-col items-center gap-3 w-full">
      <div className="text-white/40 text-xs font-mono uppercase tracking-widest mb-1">
        Interactive Preview
      </div>

      <Hemicycle
        rows={4}
        totalSeats={totalSeats}
        data={data}
        width={280}
        height={158}
        orderBy="radial"
      />

      <div className="flex gap-3 flex-col justify-center">
        {parties.map((p) => (
          <div
            key={p.label}
            className={"flex items-center gap-1.5"}
            onMouseEnter={() => setHoveredParty(p.label)}
            onMouseLeave={() => setHoveredParty(null)}
          >
            <span
              className="w-2.5 h-2.5 rounded-full inline-block"
              style={{ background: p.color }}
            />
            <span
              className={
                hoveredParty === p.label
                  ? "text-white text-xs font-mono"
                  : "text-white/60 text-xs font-mono"
              }
            >
              {p.label} · {p.seats}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
