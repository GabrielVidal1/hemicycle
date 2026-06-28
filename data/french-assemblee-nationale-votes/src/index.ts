/**
 * @hemicycle/french-assemblee-nationale-votes
 *
 * Public-ballot ("scrutins") data of the French National Assembly for
 * legislatures 14–17 (~2012 → today), normalized for displaying how every
 * deputy / political group voted on a given law project — ready to colour a
 * Hemicycle seat chart.
 *
 * The bundle ships only types + small helpers. The (large) datasets are loaded
 * on demand via dynamic import so consumers (e.g. a Vite app) code-split them
 * into separate lazy chunks instead of inlining ~12 MB:
 *
 *   import { loadScrutinsIndex, loadLegislatureDetail, seatColors } from "@hemicycle/french-assemblee-nationale-votes";
 *   const index  = await loadScrutinsIndex();              // every scrutin (lightweight)
 *   const detail = await loadLegislatureDetail(17);        // full nominal votes for law-project ballots
 *   const colors = seatColors(detail.find(s => s.type === "SPS")!);
 *
 * Data © Assemblée nationale, Licence Ouverte / Open Licence (Etalab).
 */

export type Position = "pour" | "contre" | "abstention" | "nonVotant";

/** A political group's aggregate position on a scrutin. */
export interface GroupeVote {
  /** organeRef of the group (see {@link Groupe}). */
  ref: string | null;
  membres: number | null;
  /** majority position of the group ("pour" | "contre" | "abstention"...). */
  position: string | null;
  pour: number | null;
  contre: number | null;
  abstention: number | null;
  nonVotant: number | null;
}

/** One deputy's nominal vote within a scrutin. */
export interface NominalVote {
  /** acteurRef of the deputy (see {@link Acteur}). */
  a: string | null;
  /** numPlace — the hemicycle seat number (zero-padded string). */
  p: string | null;
  v: Position;
  /** organeRef of the deputy's group for this vote. */
  g: string | null;
}

export interface ScrutinSynthese {
  votants: number | null;
  exprimes: number | null;
  requis: number | null;
  pour: number | null;
  contre: number | null;
  abstention: number | null;
  nonVotant: number | null;
}

/** Full detail of a scrutin, including the per-deputy nominal breakdown. */
export interface ScrutinDetail {
  uid: string;
  numero: string;
  legislature: number;
  date: string;
  /** codeTypeVote: SPO (ordinaire), SPS (solennel), MOC (motion de censure)... */
  type: string;
  typeLibelle: string | null;
  /** "adopté" | "rejeté" (null when undetermined). */
  sort: string | null;
  titre: string | null;
  objet: string | null;
  /** reference id of the dossier législatif (law file), when the ballot is tied to one. */
  dossierRef: string | null;
  /** title of the dossier législatif — the law project's name. */
  dossierTitre: string | null;
  demandeur: string | null;
  synthese: ScrutinSynthese;
  groupes: GroupeVote[];
  votes: NominalVote[];
}

/** Lightweight record shipped for EVERY scrutin (browse/search). */
export interface ScrutinIndexEntry {
  uid: string;
  numero: string;
  legislature: number;
  date: string;
  type: string;
  typeLibelle: string | null;
  sort: string | null;
  titre: string | null;
  objet: string | null;
  dossierRef: string | null;
  dossierTitre: string | null;
  synthese: ScrutinSynthese;
  /** true when full nominal detail is available via {@link loadLegislatureDetail}. */
  detail: boolean;
}

/** A political group (groupe politique). */
export interface Groupe {
  libelle: string | null;
  abbrev: string | null;
  /** hex colour associated with the group, e.g. "#313567". */
  couleur: string | null;
  legislature: number | null;
  dateDebut: string | null;
  dateFin: string | null;
}

/** A deputy (acteur). */
export interface Acteur {
  nom: string | null;
  prenom: string | null;
  civ: string | null;
  trigramme: string | null;
}

export interface Meta {
  source: string;
  license: string;
  generatedFrom: { scrutins: string[]; reference: string };
  legislatures: { leg: number; total: number; detail: number; start: string }[];
  totals: {
    scrutins: number;
    withDetail: number;
    groups: number;
    actors: number;
  };
  note: string;
}

/** Legislatures covered by this dataset. */
export const LEGISLATURES = [14, 15, 16, 17] as const;
export type Legislature = (typeof LEGISLATURES)[number];

/** Default palette for colouring seats by vote position. */
export const POSITION_COLORS: Record<Position, string> = {
  pour: "#3a9d4e",
  contre: "#c0392b",
  abstention: "#e0a32e",
  nonVotant: "#c9ccd1",
};

// --- Data loaders (code-split JSON subpath exports) ------------------------

async function importJson<T>(p: Promise<any>): Promise<T> {
  return (await p).default as T;
}

/** Load the lightweight index of every scrutin across all legislatures. */
export function loadScrutinsIndex(): Promise<ScrutinIndexEntry[]> {
  return importJson(import("../data/scrutins-index.json"));
}

/** Load the full nominal detail (law-project ballots) for one legislature. */
export function loadLegislatureDetail(
  leg: Legislature,
): Promise<ScrutinDetail[]> {
  switch (leg) {
    case 14:
      return importJson(import("../data/scrutins-detail/14.json"));
    case 15:
      return importJson(import("../data/scrutins-detail/15.json"));
    case 16:
      return importJson(import("../data/scrutins-detail/16.json"));
    case 17:
      return importJson(import("../data/scrutins-detail/17.json"));
    default:
      throw new Error(`Unknown legislature ${leg}`);
  }
}

/** Load the political-group reference (organeRef -> group). */
export function loadGroupes(): Promise<Record<string, Groupe>> {
  return importJson(import("../data/reference/groupes.json"));
}

/** Load the deputy reference (acteurRef -> deputy). */
export function loadActeurs(): Promise<Record<string, Acteur>> {
  return importJson(import("../data/reference/acteurs.json"));
}

/** Load dataset provenance + counts. */
export function loadMeta(): Promise<Meta> {
  return importJson(import("../data/meta.json"));
}

// --- Helpers ---------------------------------------------------------------

/** Human-readable name for a deputy. */
export function deputeName(a: Acteur | undefined | null): string {
  if (!a) return "";
  return [a.prenom, a.nom].filter(Boolean).join(" ").trim();
}

/** Map seat number (numPlace) -> the nominal vote cast there. */
export function votesBySeat(
  scrutin: ScrutinDetail,
): Record<string, NominalVote> {
  const out: Record<string, NominalVote> = {};
  for (const v of scrutin.votes) {
    if (v.p != null) out[v.p] = v;
  }
  return out;
}

/** Map acteurRef -> position for a scrutin. */
export function votesByActeur(
  scrutin: ScrutinDetail,
): Record<string, Position> {
  const out: Record<string, Position> = {};
  for (const v of scrutin.votes) {
    if (v.a != null) out[v.a] = v.v;
  }
  return out;
}

/**
 * Produce a seat-number -> hex-colour map for rendering a scrutin on a
 * Hemicycle chart. By default colours by vote position (pour/contre/...);
 * pass `by: "groupe"` (with the group reference) to colour by political group.
 */
export function seatColors(
  scrutin: ScrutinDetail,
  opts: {
    by?: "position" | "groupe";
    groupes?: Record<string, Groupe>;
    palette?: Record<Position, string>;
    fallback?: string;
  } = {},
): Record<string, string> {
  const {
    by = "position",
    groupes,
    palette = POSITION_COLORS,
    fallback = "#c9ccd1",
  } = opts;
  const out: Record<string, string> = {};
  for (const v of scrutin.votes) {
    if (v.p == null) continue;
    if (by === "groupe") {
      out[v.p] = (v.g && groupes?.[v.g]?.couleur) || fallback;
    } else {
      out[v.p] = palette[v.v] ?? fallback;
    }
  }
  return out;
}

/** Filter helpers over the index. */
export const isLawProjectVote = (
  e: Pick<ScrutinIndexEntry, "detail">,
): boolean => e.detail;

/** All scrutins tied to a given dossier législatif, newest first. */
export function byDossier(
  index: ScrutinIndexEntry[],
  dossierRef: string,
): ScrutinIndexEntry[] {
  return index.filter((e) => e.dossierRef === dossierRef);
}

/** A law project (dossier législatif) and the votes attached to it. */
export interface Dossier {
  ref: string;
  titre: string | null;
  legislature: number;
  /** date of the most recent scrutin on this dossier. */
  derniereDate: string;
  scrutins: ScrutinIndexEntry[];
}

/**
 * Group the index into distinct law projects (dossiers législatifs), newest
 * first. Scrutins with no dossier reference (procedural / standalone ballots)
 * are skipped.
 */
export function listDossiers(index: ScrutinIndexEntry[]): Dossier[] {
  const map = new Map<string, Dossier>();
  for (const e of index) {
    if (!e.dossierRef) continue;
    let d = map.get(e.dossierRef);
    if (!d) {
      d = {
        ref: e.dossierRef,
        titre: e.dossierTitre,
        legislature: e.legislature,
        derniereDate: e.date,
        scrutins: [],
      };
      map.set(e.dossierRef, d);
    }
    d.scrutins.push(e);
    if (e.date > d.derniereDate) d.derniereDate = e.date;
    if (!d.titre && e.dossierTitre) d.titre = e.dossierTitre;
  }
  return [...map.values()].sort((a, b) =>
    a.derniereDate < b.derniereDate ? 1 : -1,
  );
}
