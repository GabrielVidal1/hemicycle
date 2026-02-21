import { SeatPathGenerator } from "./type";

export const rectangularSeatPath: SeatPathGenerator = ({
  innerR,
  outerR,
  angle1Rad,
  angle2Rad,
  borderRadius: cornerRadius = 1,
}) => {
  const midAngle = (angle1Rad + angle2Rad) / 2;
  const r = (innerR + outerR) / 2;

  const cx = r * Math.cos(midAngle);
  const cy = r * Math.sin(midAngle);

  const radialSize = outerR - innerR;
  const delta = Math.abs(angle2Rad - angle1Rad);
  const angularSize = 2 * r * Math.sin(delta / 2);
  const size = Math.min(radialSize, angularSize);
  const half = size / 2;

  const cr = Math.min(cornerRadius, half);

  const cos = Math.cos(midAngle);
  const sin = Math.sin(midAngle);

  // Transform local [x, y] to world coordinates
  const toWorld = (lx: number, ly: number): [number, number] => [
    lx * cos - ly * sin + cx,
    lx * sin + ly * cos + cy,
  ];

  // Local corners
  const corners = [
    [-half, -half],
    [half, -half],
    [half, half],
    [-half, half],
  ];

  // For each corner, compute the two tangent points (stepping back by cr along each edge)
  // Edges go: 0→1→2→3→0
  const n = corners.length;
  const tangents = corners.map((_, i) => {
    const prev = corners[(i + n - 1) % n];
    const curr = corners[i];
    const next = corners[(i + 1) % n];

    // Direction from curr toward prev (incoming edge)
    const inDx = prev[0] - curr[0];
    const inDy = prev[1] - curr[1];
    const inLen = Math.hypot(inDx, inDy);

    // Direction from curr toward next (outgoing edge)
    const outDx = next[0] - curr[0];
    const outDy = next[1] - curr[1];
    const outLen = Math.hypot(outDx, outDy);

    const tIn: [number, number] = [
      curr[0] + (inDx / inLen) * cr,
      curr[1] + (inDy / inLen) * cr,
    ];
    const tOut: [number, number] = [
      curr[0] + (outDx / outLen) * cr,
      curr[1] + (outDy / outLen) * cr,
    ];

    return { tIn, tOut };
  });

  const parts: string[] = [];

  tangents.forEach(({ tIn, tOut }, i) => {
    const wIn = toWorld(...tIn);
    const wOut = toWorld(...tOut);

    if (i === 0) {
      parts.push(`M ${wIn[0]} ${wIn[1]}`);
    } else {
      parts.push(`L ${wIn[0]} ${wIn[1]}`);
    }

    // Fillet arc: always 90°, sweep=1 for our CW winding
    parts.push(`A ${cr} ${cr} 0 0 1 ${wOut[0]} ${wOut[1]}`);
  });

  parts.push("Z");
  return parts.join(" ");
};
