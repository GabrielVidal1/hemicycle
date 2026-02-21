import { Hemicycle } from "@hemicycle/core";
import React from "react";

const TOTAL_SEATS = 640;
const TOTAL_AISLES = 7;

export default function HemicycleSchema() {
  const seatsPerSection = [73, 85, 87, 82, 80, 81, 86, 76];

  const seatData = Array.from(
    { length: seatsPerSection.reduce((sum, seats) => sum + seats, 0) },
    (_, i) => ({
      id: `seat-${i}`,
      idx: i, // assign a unique index to each seat
      i, // assign a unique index to each seat
    }),
  );

  return (
    <div>
      <div style={{ width: "100%", maxWidth: "900px" }}>
        <Hemicycle.WithAisles
          rows={14}
          totalSeats={TOTAL_SEATS}
          data={seatData}
          innerRadius={30}
          outerRadius={95}
          totalAngle={190}
          mirror
          aisleNumber={TOTAL_AISLES}
          seatsPerSection={seatsPerSection}
          seatConfig={{
            shape: "arc",
            borderRadius: 1,
            seatMargin: 0.8,
            color: "#dddddd",
            wrapper: (content: React.ReactNode, seatData) => {
              return (
                <g key={seatData?.id} style={{ cursor: "pointer" }}>
                  {/* Seat shape with highlight on hover */}
                  <g>{content}</g>

                  {/* Seat index label, shown on hover */}
                  <text
                    x={seatData?.x}
                    y={seatData?.y}
                    textAnchor="middle"
                    dominantBaseline="auto"
                    fontSize="1.5"
                    pointerEvents="none"
                    style={{ userSelect: "none", zIndex: 100 }}
                  >
                    {seatData?.i != null ? seatData.i + 1 : 0}
                  </text>
                </g>
              );
            },
          }}
        />
      </div>
    </div>
  );
}
