/**
 * @hemicycle/european-parliament-votes
 *
 * Roll-call vote data of the European Parliament for parliamentary terms 9–10
 * (July 2019 → today), normalized for displaying how every MEP and political
 * group voted on a given text — ready to colour a Hemicycle seat chart.
 *
 * The bundle ships only types + small helpers. The (large) datasets are loaded
 * on demand via dynamic import so consumers (e.g. a Vite app) code-split them
 * into separate lazy chunks instead of inlining the whole dataset:
 *
 *   import { loadVotesIndex, loadYearDetail, seatColors } from "@hemicycle/european-parliament-votes";
 *   const index  = await loadVotesIndex();          // every roll-call vote (lightweight)
 *   const detail = await loadYearDetail(2024);       // full per-MEP nominal votes for main votes
 *   const colors = seatColors(detail[0]);
 *
 * Data © HowTheyVote.eu, CC BY 4.0 (https://github.com/HowTheyVote/data).
 */

/** A position code as stored in the nominal data. */
export type PositionCode = "F" | "A" | "B" | "D";
/** A human-readable vote position. */
export type Position = "for" | "against" | "abstention" | "didNotVote";

export const POSITION_BY_CODE: Record<PositionCode, Position> = {
  F: "for",
  A: "against",
  B: "abstention",
  D: "didNotVote",
};

/** A political group's aggregate result on a vote. */
export interface GroupResult {
  /** group code (see {@link Group}). */
  g: string;
  members: number;
  for: number;
  against: number;
  abstention: number;
  didNotVote: number;
  /** majority position of the group: "for" | "against" | "abstention". */
  majority: string;
}

/** One MEP's nominal vote within a roll-call vote. */
export interface NominalVote {
  /** member id (see {@link Mep}). */
  m: number;
  /** position code: F=for, A=against, B=abstention, D=did not vote. */
  v: PositionCode;
  /** group code of the MEP for this vote (see {@link Group}). */
  g: string | null;
}

export interface VoteTotals {
  for: number | null;
  against: number | null;
  abstention: number | null;
  didNotVote: number | null;
}

/** Lightweight record shipped for EVERY roll-call vote (browse/search). */
export interface VoteIndexEntry {
  id: number;
  /** ISO datetime of the vote, e.g. "2024-04-24 12:51:08". */
  timestamp: string;
  /** EP parliamentary term (9 or 10). */
  term: number;
  title: string | null;
  /** EP document reference of the voted text, e.g. "RC-B9-0006/2019". */
  reference: string | null;
  /** sub-vote label (amendment/§ being voted), null for whole-text votes. */
  amendmentSubject: string | null;
  /** true for the substantive "main" vote (final vote on the text). */
  isMain: boolean;
  /** procedure (dossier) reference this vote belongs to, e.g. "2019/2730(RSP)". */
  procedureReference: string | null;
  procedureTitle: string | null;
  /** procedure type code (RSP, COD, INI, BUD...). */
  procedureType: string | null;
  /** "ADOPTED" | "REJECTED" | null (unknown, e.g. procedural). */
  result: string | null;
  totals: VoteTotals;
  /** true when full per-MEP nominal detail is available via {@link loadYearDetail}. */
  detail: boolean;
}

/** Full detail of a vote, including the per-MEP nominal breakdown. */
export type VoteDetail = Omit<VoteIndexEntry, "detail"> & {
  groups: GroupResult[];
  votes: NominalVote[];
};

/** A political group. */
export interface Group {
  label: string | null;
  abbrev: string | null;
  /** hex colour associated with the group, e.g. "#3399FF". */
  color: string | null;
}

/** A Member of the European Parliament. */
export interface Mep {
  firstName: string | null;
  lastName: string | null;
  /** ISO-ish country code as used by the source (e.g. "DEU", "FRA"). */
  country: string | null;
}

export interface Meta {
  source: string;
  sourceSite: string;
  license: string;
  generatedFrom: Record<string, string>;
  coverage: {
    from: string | null;
    to: string | null;
    terms: number[];
    note: string;
  };
  terms: { term: number; total: number; detail: number }[];
  years: { year: string; total: number; detail: number }[];
  totals: {
    votes: number;
    withDetail: number;
    nominalCells: number;
    groups: number;
    meps: number;
    countries: number;
  };
  note: string;
}

/** Parliamentary terms covered by this dataset. */
export const TERMS = [9, 10] as const;
export type Term = (typeof TERMS)[number];

/** Years for which a per-MEP detail file ships. */
export const DETAIL_YEARS = [
  2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026,
] as const;
export type DetailYear = (typeof DETAIL_YEARS)[number];

/** Default palette for colouring seats by vote position. */
export const POSITION_COLORS: Record<Position, string> = {
  for: "#3a9d4e",
  against: "#c0392b",
  abstention: "#e0a32e",
  didNotVote: "#c9ccd1",
};

// --- Data loaders (code-split JSON subpath exports) ------------------------

async function importJson<T>(p: Promise<any>): Promise<T> {
  return (await p).default as T;
}

/** Load the lightweight index of every roll-call vote across all terms. */
export function loadVotesIndex(): Promise<VoteIndexEntry[]> {
  return importJson(import("../data/votes-index.json"));
}

/** Load the full per-MEP nominal detail (main votes) for one calendar year. */
export function loadYearDetail(year: DetailYear): Promise<VoteDetail[]> {
  switch (year) {
    case 2019:
      return importJson(import("../data/votes-detail/2019.json"));
    case 2020:
      return importJson(import("../data/votes-detail/2020.json"));
    case 2021:
      return importJson(import("../data/votes-detail/2021.json"));
    case 2022:
      return importJson(import("../data/votes-detail/2022.json"));
    case 2023:
      return importJson(import("../data/votes-detail/2023.json"));
    case 2024:
      return importJson(import("../data/votes-detail/2024.json"));
    case 2025:
      return importJson(import("../data/votes-detail/2025.json"));
    case 2026:
      return importJson(import("../data/votes-detail/2026.json"));
    default:
      throw new Error(`No detail file for year ${year}`);
  }
}

/**
 * Load the full per-MEP nominal detail for a whole parliamentary term
 * (concatenates the relevant year files).
 */
export async function loadTermDetail(term: Term): Promise<VoteDetail[]> {
  const years: DetailYear[] =
    term === 9 ? [2019, 2020, 2021, 2022, 2023, 2024] : [2024, 2025, 2026];
  const parts = await Promise.all(years.map((y) => loadYearDetail(y)));
  return parts.flat().filter((v) => v.term === term);
}

/** Load the political-group reference (groupCode -> group). */
export function loadGroups(): Promise<Record<string, Group>> {
  return importJson(import("../data/reference/groups.json"));
}

/** Load the MEP reference (memberId -> MEP). */
export function loadMeps(): Promise<Record<string, Mep>> {
  return importJson(import("../data/reference/meps.json"));
}

/** Load the country reference (countryCode -> label). */
export function loadCountries(): Promise<Record<string, string>> {
  return importJson(import("../data/reference/countries.json"));
}

/** Load dataset provenance + counts. */
export function loadMeta(): Promise<Meta> {
  return importJson(import("../data/meta.json"));
}

// --- Helpers ---------------------------------------------------------------

/** Human-readable name for an MEP. */
export function mepName(m: Mep | undefined | null): string {
  if (!m) return "";
  return [m.firstName, m.lastName].filter(Boolean).join(" ").trim();
}

/** Map memberId -> position for a vote. */
export function votesByMep(vote: VoteDetail): Record<number, Position> {
  const out: Record<number, Position> = {};
  for (const v of vote.votes) out[v.m] = POSITION_BY_CODE[v.v];
  return out;
}

/**
 * Produce a memberId -> hex-colour map for rendering a vote on a Hemicycle
 * chart. By default colours by vote position (for/against/abstention/...);
 * pass `by: "group"` (with the group reference) to colour by political group.
 *
 * The EP source has no fixed seat numbers, so this keys by MEP id — consumers
 * map MEP ids to seats via their own seating layout.
 */
export function seatColors(
  vote: VoteDetail,
  opts: {
    by?: "position" | "group";
    groups?: Record<string, Group>;
    palette?: Record<Position, string>;
    fallback?: string;
  } = {},
): Record<number, string> {
  const {
    by = "position",
    groups,
    palette = POSITION_COLORS,
    fallback = "#c9ccd1",
  } = opts;
  const out: Record<number, string> = {};
  for (const v of vote.votes) {
    if (by === "group") {
      out[v.m] = (v.g && groups?.[v.g]?.color) || fallback;
    } else {
      out[v.m] = palette[POSITION_BY_CODE[v.v]] ?? fallback;
    }
  }
  return out;
}

/** Filter helper over the index. */
export const hasDetail = (e: Pick<VoteIndexEntry, "detail">): boolean =>
  e.detail;

/** All votes tied to a given procedure (dossier) reference, newest first. */
export function byProcedure(
  index: VoteIndexEntry[],
  procedureReference: string,
): VoteIndexEntry[] {
  return index.filter((e) => e.procedureReference === procedureReference);
}

/** A procedure (legislative dossier / resolution) and the votes attached to it. */
export interface Procedure {
  reference: string;
  title: string | null;
  type: string | null;
  term: number;
  /** datetime of the most recent vote on this procedure. */
  lastVote: string;
  votes: VoteIndexEntry[];
}

/**
 * Group the index into distinct procedures (dossiers / resolutions), newest
 * first. Votes with no procedure reference (procedural / standalone ballots)
 * are skipped.
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
 * Alias of {@link listProcedures} — in EP terminology a "dossier" is a
 * legislative procedure. Provided for parity with the French package's
 * `listDossiers`.
 */
export const listDossiers = listProcedures;
