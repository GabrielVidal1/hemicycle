// NOTE: import ONLY types from the package. Importing any runtime value pulls
// its entry module, whose loaders reference dynamic imports of the bundled JSON
// chunks — which makes rollup OOM on the (large) EP dataset. So POSITION_COLORS
// and listProcedures are inlined here instead.
import type {
  DetailYear,
  Group,
  GroupResult,
  Position,
  Procedure,
  VoteDetail,
  VoteIndexEntry,
} from "@hemicycle/european-parliament-votes";

/** Default palette for colouring seats by vote position (mirrors the package). */
export const POSITION_COLORS: Record<Position, string> = {
  for: "#3a9d4e",
  against: "#c0392b",
  abstention: "#e0a32e",
  didNotVote: "#c9ccd1",
};

/**
 * Group the index into distinct procedures (dossiers / resolutions), newest
 * first. Inlined from the package to avoid importing its runtime. Votes with no
 * procedure reference are skipped.
 */
export function listProcedures(index: VoteIndexEntry[]): Procedure[] {
  const map = new Map<string, Procedure>();
  for (const e of index) {
    if (!e.procedureReference) continue;
    let p = map.get(e.procedureReference);
    if (!p) {
      p = {
        reference: e.procedureReference,
        title: e.procedureTitle,
        type: e.procedureType,
        term: e.term,
        lastVote: e.timestamp,
        votes: [],
      };
      map.set(e.procedureReference, p);
    }
    p.votes.push(e);
    if (e.timestamp > p.lastVote) p.lastVote = e.timestamp;
    if (!p.title && e.procedureTitle) p.title = e.procedureTitle;
  }
  return [...map.values()].sort((a, b) => (a.lastVote < b.lastVote ? 1 : -1));
}

/**
 * Left → right political ordering of EP groups by group code, so party wedges
 * render in a sensible order. Lower rank = further left.
 */
const GROUP_RANK: Record<string, number> = {
  GUE_NGL: 0,
  GUE_NGL_1995_0: 0,
  GREEN_EFA: 1,
  SD: 2,
  RENEW: 3,
  EPP: 4,
  ECR: 5,
  ID: 6,
  PFE: 6.5,
  ESN: 7,
  NI: 8,
};

export function groupRank(code: string | null | undefined): number {
  if (!code) return 4.5;
  return GROUP_RANK[code] ?? 4.5;
}

export function groupLabel(
  code: string | null,
  groups: Record<string, Group>,
): string {
  if (!code) return "—";
  return groups[code]?.abbrev || groups[code]?.label || code;
}

export const POSITIONS: Position[] = [
  "for",
  "against",
  "abstention",
  "didNotVote",
];
export const POSITION_LABELS: Record<Position, string> = {
  for: "For",
  against: "Against",
  abstention: "Abstention",
  didNotVote: "Didn't vote",
};

export interface SeatDatum {
  idx: number;
  position: Position;
  group: string | null;
  seatConfig: { color: string; props: { style: React.CSSProperties } };
}

/**
 * Build hemicycle seat data for a vote: one seat per recorded voice, grouped
 * into political wedges (left → right) and coloured by vote position. Uses only
 * the per-group counts, so it works for every term.
 */
export function buildSeats(
  vote: VoteDetail,
  _groups: Record<string, Group>,
): SeatDatum[] {
  const ordered = [...vote.groups].sort(
    (a, b) =>
      groupRank(a.g) - groupRank(b.g) || (a.g || "").localeCompare(b.g || ""),
  );
  const seats: SeatDatum[] = [];
  let idx = 0;
  for (const g of ordered) {
    const counts: Record<Position, number> = {
      for: g.for ?? 0,
      abstention: g.abstention ?? 0,
      against: g.against ?? 0,
      didNotVote: g.didNotVote ?? 0,
    };
    for (const position of POSITIONS) {
      for (let i = 0; i < counts[position]; i++) {
        seats.push({
          idx,
          position,
          group: g.g,
          seatConfig: {
            color: POSITION_COLORS[position],
            props: { style: { transition: "fill .25s ease" } },
          },
        });
        idx++;
      }
    }
  }
  return seats;
}

function turnout(v: VoteIndexEntry): number {
  const t = v.totals;
  return (t.for ?? 0) + (t.against ?? 0) + (t.abstention ?? 0);
}

/**
 * Pick the most representative vote for a procedure: the vote on the whole text.
 * EP marks the substantive final vote with `isMain`; otherwise fall back to the
 * highest-turnout vote (amendment ballots have lower, but usually full, turnout
 * — isMain is the reliable signal here).
 */
export function pickDisplayVote(procedure: Procedure): VoteIndexEntry | null {
  const withDetail = procedure.votes.filter((v) => v.detail);
  if (!withDetail.length) return null;
  const score = (v: VoteIndexEntry) => (v.isMain ? 1_000_000 : 0) + turnout(v);
  return [...withDetail].sort((a, b) => score(b) - score(a))[0];
}

export function tallies(vote: VoteDetail): Record<Position, number> {
  const out: Record<Position, number> = {
    for: 0,
    against: 0,
    abstention: 0,
    didNotVote: 0,
  };
  for (const g of vote.groups) {
    out.for += g.for ?? 0;
    out.against += g.against ?? 0;
    out.abstention += g.abstention ?? 0;
    out.didNotVote += g.didNotVote ?? 0;
  }
  return out;
}

export function orderedGroups(vote: VoteDetail): GroupResult[] {
  return [...vote.groups].sort((a, b) => groupRank(a.g) - groupRank(b.g));
}

/** Calendar year (used to pick the detail file) from an ISO-ish timestamp. */
export function yearOf(timestamp: string): DetailYear {
  return Number(timestamp.slice(0, 4)) as DetailYear;
}

export function euDate(timestamp: string): string {
  const date = timestamp.slice(0, 10);
  const [y, m, d] = date.split("-");
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  if (!y || !m || !d) return date;
  return `${Number(d)} ${months[Number(m) - 1]} ${y}`;
}
