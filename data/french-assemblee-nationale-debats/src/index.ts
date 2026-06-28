/**
 * @hemicycle/french-assemblee-nationale-debats
 *
 * Debate transcripts ("comptes rendus intégraux des séances publiques") of the
 * French National Assembly, parsed from the official Sycéron XML, segmented per
 * debated text, linked to the law projects (dossiers) of
 * `@hemicycle/french-assemblee-nationale-votes`, and summarized by a local LLM
 * into plain-language explainers — so anyone can understand a new law and the
 * arguments raised for and against it, every claim traceable to its source
 * intervention.
 *
 * Two tiers of data:
 *   - small INDEX files, code-split via dynamic import (bundled lazily):
 *       loadSeancesIndex() · loadBlocksIndex() · loadDossierDebatsIndex() · loadSummariesIndex()
 *   - large PER-ITEM files, fetched at runtime from a static base path (default
 *     "/debats", override with setDebatsBase()):
 *       loadSeance(leg, uid)  — full transcript of one sitting
 *       loadDossierSummary(ref) — the LLM explainer + per-séance summaries for a law
 *
 * Data © Assemblée nationale, Licence Ouverte / Open Licence (Etalab).
 * Summaries generated locally with an open-weight LLM (see meta).
 */

// --- Transcript primitives -------------------------------------------------

/** One spoken intervention (a `<paragraphe>` in the Sycéron XML). */
export interface Intervention {
  /** ordre_absolu_seance — strictly increasing position within the sitting. */
  o: number;
  /** id_acteur (PAxxxxxx) of the speaker, when one is attributed. */
  a: string | null;
  /** display name of the speaker as printed ("M. le président", "Mme Untel, ministre…"). */
  nom: string;
  /** roledebat attribute ("president", "orateur", …) when present. */
  role: string | null;
  /** code_grammaire of the paragraph (PAROLE_GENERIQUE, DISC_ARTICLES_*, …). */
  code: string | null;
  /** id_syceron — stable id of this paragraph, used as a citation anchor. */
  s: string | null;
  /** the spoken text, inline markup stripped, whitespace-normalized. */
  t: string;
}

/** Full transcript of one sitting (séance). */
export interface Seance {
  uid: string;
  seanceRef: string | null;
  leg: number;
  /** ISO date (YYYY-MM-DD) of the sitting. */
  date: string;
  /** human date ("mercredi 15 octobre 2025"). */
  dateLong: string | null;
  session: string | null;
  numSeance: string | null;
  president: string | null;
  interventions: Intervention[];
}

/** Lightweight record shipped for EVERY sitting (browse/index). */
export interface SeanceIndexEntry {
  uid: string;
  seanceRef: string | null;
  leg: number;
  date: string;
  dateLong: string | null;
  session: string | null;
  numSeance: string | null;
  president: string | null;
  nIntervention: number;
  nBlocks: number;
}

/**
 * A debate "block": the contiguous run of interventions discussing one text,
 * opened by a TITRE_TEXTE_DISCUSSION section header. Linked to a dossier
 * (law project) when its title matches one in the votes dataset.
 */
export interface DebateBlock {
  id: string;
  seanceUid: string;
  leg: number;
  date: string;
  /** the section title as printed — the debated text's short name. */
  titre: string;
  startOrdre: number;
  endOrdre: number;
  nIntervention: number;
  /** dossierRef (law file) this block was linked to, or null. */
  dossierRef: string | null;
  /** how the link was established ("exact" | "substr" | "jaccard" | "seanceRef" | null). */
  matchKind: string | null;
}

/** A law project (dossier) and the debates attached to it. */
export interface DossierDebats {
  ref: string;
  titre: string | null;
  leg: number;
  /** ids of the debate blocks (chronological). */
  blocks: string[];
  /** uids of the sittings the law was discussed in. */
  seances: string[];
  firstDate: string;
  lastDate: string;
  nIntervention: number;
}

// --- Summaries -------------------------------------------------------------

/** A pointer back to the transcript backing a summary claim. */
export interface Source {
  seanceUid: string;
  leg: number;
  /** ordre of the cited intervention within the sitting. */
  ordre: number;
  /** id_syceron of the cited paragraph, when known. */
  syceron: string | null;
  /** the speaker, for display. */
  orateur: string | null;
  date: string;
  /** link to the official compte rendu of the sitting. */
  url: string;
}

/** An argument raised in debate, with its source. */
export interface Argument {
  /** the argument in plain language. */
  point: string;
  /** who made it (speaker / group), when attributable. */
  orateur: string | null;
  /** index into the parent summary's `sources` array. */
  source: number | null;
}

/** A notable speaker in a debate. */
export interface Speaker {
  nom: string;
  /** their role / stance in one short phrase. */
  role: string;
}

/** LLM summary of a single debate block (one text, one sitting). */
export interface BlockSummary {
  blockId: string;
  seanceUid: string;
  date: string;
  titre: string;
  /** what was debated, in 2-4 plain sentences. */
  resume: string;
  pointsCles: string[];
  argumentsPour: Argument[];
  argumentsContre: Argument[];
  orateursCles: Speaker[];
  sources: Source[];
}

/** LLM explainer of a whole law, built from its block summaries + vote outcome. */
export interface DossierSummary {
  ref: string;
  titre: string | null;
  leg: number;
  /** plain-language "what this law does", for a non-expert reader. */
  resumeSimple: string;
  /** what is at stake / why it matters. */
  enJeu: string;
  argumentsPour: Argument[];
  argumentsContre: Argument[];
  /** key milestones of the debate. */
  chronologie: { date: string; titre: string; fait: string }[];
  orateursCles: Speaker[];
  /** the outcome in one sentence (adopted/rejected, margin, …). */
  issue: string;
  sources: Source[];
  /** the per-séance summaries this explainer was distilled from. */
  blocks: BlockSummary[];
  generatedAt: string;
  model: string;
}

/** Lightweight record shipped for every summarized law (picker/index). */
export interface SummaryIndexEntry {
  ref: string;
  titre: string | null;
  leg: number;
  lastDate: string;
  nBlocks: number;
  nIntervention: number;
}

export interface Meta {
  source: string;
  license: string;
  generatedFrom: string[];
  model: string;
  legislatures: number[];
  totals: {
    seances: number;
    blocks: number;
    dossiers: number;
    summaries: number;
  };
  note: string;
}

/** Legislatures covered by this dataset. */
export const LEGISLATURES = [16, 17] as const;
export type Legislature = (typeof LEGISLATURES)[number];

// --- Runtime base for fetched (non-bundled) per-item files ------------------

let DEBATS_BASE = "/debats";

/** Override where per-séance / per-law JSON is fetched from (default "/debats"). */
export function setDebatsBase(base: string): void {
  DEBATS_BASE = base.replace(/\/$/, "");
}

/** Official compte rendu URL for a sitting. */
export function seanceUrl(leg: number, uid: string): string {
  return `https://www.assemblee-nationale.fr/dyn/${leg}/comptes-rendus/seance/${uid}`;
}

// --- Bundled index loaders (code-split JSON) -------------------------------

async function importJson<T>(p: Promise<any>): Promise<T> {
  return (await p).default as T;
}

/** Every sitting (lightweight). */
export function loadSeancesIndex(): Promise<SeanceIndexEntry[]> {
  return importJson(import("../data/seances-index.json"));
}

/** Every debate block (lightweight), with its dossier link. */
export function loadBlocksIndex(): Promise<DebateBlock[]> {
  return importJson(import("../data/blocks-index.json"));
}

/** Every law project that has at least one linked debate. */
export function loadDossierDebatsIndex(): Promise<DossierDebats[]> {
  return importJson(import("../data/dossier-debats.json"));
}

/** Every law for which an LLM summary has been generated. */
export function loadSummariesIndex(): Promise<SummaryIndexEntry[]> {
  return importJson(import("../data/summaries-index.json"));
}

/** Dataset provenance + counts. */
export function loadMeta(): Promise<Meta> {
  return importJson(import("../data/meta.json"));
}

// --- Runtime per-item fetchers ---------------------------------------------

async function fetchJson<T>(rel: string): Promise<T> {
  const res = await fetch(`${DEBATS_BASE}/${rel}`);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${DEBATS_BASE}/${rel}`);
  return (await res.json()) as T;
}

/** Full transcript of one sitting. */
export function loadSeance(leg: number, uid: string): Promise<Seance> {
  return fetchJson<Seance>(`seances/${leg}/${uid}.json`);
}

/** The full LLM explainer (+ per-séance summaries) for one law. */
export function loadDossierSummary(ref: string): Promise<DossierSummary> {
  return fetchJson<DossierSummary>(`summaries/${ref}.json`);
}

// --- Helpers ---------------------------------------------------------------

/** The interventions of a block, sliced from a loaded séance. */
export function blockInterventions(
  seance: Seance,
  block: Pick<DebateBlock, "startOrdre" | "endOrdre">,
): Intervention[] {
  return seance.interventions.filter(
    (i) => i.o >= block.startOrdre && i.o <= block.endOrdre,
  );
}

/** Find the intervention cited by a Source within a loaded séance. */
export function interventionAt(
  seance: Seance,
  ordre: number,
): Intervention | undefined {
  return seance.interventions.find((i) => i.o === ordre);
}
