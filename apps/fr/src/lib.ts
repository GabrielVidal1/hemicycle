import type {
  Dossier,
  Groupe,
  Legislature,
  Position,
  ScrutinDetail,
  ScrutinIndexEntry,
} from "@hemicycle/french-assemblee-nationale-votes";
import { POSITION_COLORS } from "@hemicycle/french-assemblee-nationale-votes";

/**
 * Best-effort left → right political ordering of French parliamentary groups,
 * matched on the (legislature-stable) group label so party wedges render in a
 * sensible order. Lower rank = further left.
 */
const SPECTRUM: [RegExp, number][] = [
  [/insoumis|france insoumise|\blfi\b|\bfi\b/i, 0],
  [/communist|gauche démocrate|\bgdr\b/i, 1],
  [/écolog|ecolog|\bgest\b|verts/i, 2],
  [/socialist|\bser\b|\bsoc\b|place publique/i, 3],
  [/liberté.*territoire|\bliot\b|indépendants/i, 4],
  [/démocrate|modem|\bdem\b/i, 5],
  [
    /renaissance|en marche|ensemble pour la république|\bepr\b|\brem\b|\blrem\b/i,
    6,
  ],
  [/horizons|\bhor\b/i, 7],
  [/\budi\b|union des démocrates|centristes|\buai\b/i, 7.5],
  [/les républicains|droite républicaine|\blr\b|\bdr\b/i, 8],
  [/rassemblement national|\brn\b|front national|\bfn\b|ciotti|\budr\b/i, 9],
  [/non.?inscrit|\bni\b/i, 10],
];

export function groupRank(
  ref: string | null,
  groupes: Record<string, Groupe>,
): number {
  const label =
    (ref && (groupes[ref]?.libelle || groupes[ref]?.abbrev)) || ref || "";
  for (const [re, rank] of SPECTRUM) if (re.test(label)) return rank;
  return 5.5; // unknown → centre
}

export function groupLabel(
  ref: string | null,
  groupes: Record<string, Groupe>,
): string {
  if (!ref) return "—";
  return groupes[ref]?.abbrev || groupes[ref]?.libelle || ref;
}

export const POSITIONS: Position[] = [
  "pour",
  "abstention",
  "contre",
  "nonVotant",
];
export const POSITION_LABELS: Record<Position, string> = {
  pour: "Pour",
  contre: "Contre",
  abstention: "Abstention",
  nonVotant: "Non-votant",
};

export interface SeatDatum {
  idx: number;
  position: Position;
  group: string | null;
  seatConfig: {
    color: string;
    props: { style: React.CSSProperties };
  };
}

/**
 * Build the hemicycle seat data for a scrutin: one seat per recorded voice,
 * grouped into political wedges (left → right) and coloured by vote position.
 * Works for every legislature since it relies only on per-group counts.
 */
export function buildSeats(
  scrutin: ScrutinDetail,
  groupes: Record<string, Groupe>,
): SeatDatum[] {
  const ordered = [...scrutin.groupes].sort(
    (a, b) =>
      groupRank(a.ref, groupes) - groupRank(b.ref, groupes) ||
      (a.ref || "").localeCompare(b.ref || ""),
  );
  const seats: SeatDatum[] = [];
  let idx = 0;
  for (const g of ordered) {
    const counts: Record<Position, number> = {
      pour: g.pour ?? 0,
      abstention: g.abstention ?? 0,
      contre: g.contre ?? 0,
      nonVotant: g.nonVotant ?? 0,
    };
    for (const position of POSITIONS) {
      for (let i = 0; i < counts[position]; i++) {
        seats.push({
          idx,
          position,
          group: g.ref,
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

function turnout(s: ScrutinIndexEntry): number {
  const syn = s.synthese;
  return (
    syn.votants ?? (syn.pour ?? 0) + (syn.contre ?? 0) + (syn.abstention ?? 0)
  );
}

/**
 * Pick the most representative scrutin to display for a law: the vote on the
 * whole text. We score solemn votes (SPS) and "ensemble" votes highly, then
 * fall back to the highest-turnout scrutin — which is almost always the final
 * adoption vote (amendment ballots have far lower participation).
 */
export function pickDisplayEntry(dossier: Dossier): ScrutinIndexEntry | null {
  const withDetail = dossier.scrutins.filter((s) => s.detail);
  if (!withDetail.length) return null;
  const score = (s: ScrutinIndexEntry) => {
    const isEnsemble = /\bl?'?ensemble\b/i.test(s.objet ?? s.titre ?? "");
    return (
      (s.type === "SPS" ? 1_000_000 : 0) +
      (isEnsemble ? 500_000 : 0) +
      turnout(s)
    );
  };
  return [...withDetail].sort((a, b) => score(b) - score(a))[0];
}

export function tallies(scrutin: ScrutinDetail): Record<Position, number> {
  const out: Record<Position, number> = {
    pour: 0,
    contre: 0,
    abstention: 0,
    nonVotant: 0,
  };
  for (const g of scrutin.groupes) {
    out.pour += g.pour ?? 0;
    out.contre += g.contre ?? 0;
    out.abstention += g.abstention ?? 0;
    out.nonVotant += g.nonVotant ?? 0;
  }
  return out;
}

export function frenchDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  const months = [
    "janv.",
    "févr.",
    "mars",
    "avr.",
    "mai",
    "juin",
    "juil.",
    "août",
    "sept.",
    "oct.",
    "nov.",
    "déc.",
  ];
  if (!y || !m || !d) return iso;
  return `${Number(d)} ${months[Number(m) - 1]} ${y}`;
}

export const LEGISLATURE_ROMAN: Record<Legislature, string> = {
  14: "XIV",
  15: "XV",
  16: "XVI",
  17: "XVII",
};
