/**
 * @hemicycle/european-parliament-debates
 *
 * Plenary debate verbatim reports ("Verbatim report of proceedings" / "Compte
 * rendu in extenso", CRE) of the **European Parliament**, parsed from the
 * official EP Open Data Portal XML, segmented per agenda item, linked to the
 * legislative procedures (dossiers) of
 * `@hemicycle/european-parliament-votes`, and summarized by a local open-weight
 * LLM into plain-language explainers — so anyone can understand a debated text
 * and the arguments raised for and against it, every claim traceable to the MEP
 * who made it.
 *
 * The EP verbatim is **multilingual**: each speech is recorded in the language
 * it was delivered in (`Intervention.lg`); only agenda-item titles are
 * translated. The summaries are written in English by a multilingual model that
 * reads the original-language interventions.
 *
 * Two tiers of data:
 *   - small INDEX files, code-split via dynamic import (bundled lazily):
 *       loadSeancesIndex() · loadBlocksIndex() · loadProcedureDebatsIndex() · loadSummariesIndex()
 *   - large PER-ITEM files, fetched at runtime from a static base path (default
 *     "/eu-debats", override with setDebatsBase()):
 *       loadSitting(term, uid)         — full transcript of one sitting
 *       loadProcedureSummary(ref)      — the LLM explainer + per-debate summaries for a procedure
 *
 * Data © European Union, European Parliament Open Data Portal
 * (https://data.europarl.europa.eu). Summaries generated locally with an
 * open-weight LLM (see meta).
 */

// --- Transcript primitives -------------------------------------------------

/** One spoken intervention (an `<INTERVENTION>` in the EP verbatim XML). */
export interface Intervention {
  /** strictly increasing position within the sitting. */
  o: number;
  /** MEP id of the speaker (the EP person id), or null for non-MEPs (Commission, Council, ...). */
  mepId: number | null;
  /** display name of the speaker ("Rainer Wieland", "Josep Borrell Fontelles"). */
  nom: string;
  /** rendered role / title prefix as printed ("President", "rapporteur", "on behalf of the ... Group"). */
  role: string | null;
  /** ISO language code the speech was delivered in (DE, EN, FR, ...). */
  lg: string | null;
  /** the agenda-item anchor (NUMERO ACT id) this intervention sits under, when known — a citation anchor. */
  s: string | null;
  /** the spoken text, inline markup stripped, paragraphs joined, whitespace-normalized. */
  t: string;
}

/** Full transcript of one sitting (one CRE document = one day). */
export interface Sitting {
  uid: string;
  term: number;
  /** ISO date (YYYY-MM-DD) of the sitting. */
  date: string;
  /** human date ("WEDNESDAY, 24 APRIL 2024"). */
  dateLong: string | null;
  interventions: Intervention[];
}

/** Lightweight record shipped for EVERY sitting (browse/index). */
export interface SittingIndexEntry {
  uid: string;
  term: number;
  date: string;
  dateLong: string | null;
  nIntervention: number;
  nBlocks: number;
}

/**
 * A debate "block": one agenda item (`<CHAPTER>` in the verbatim), the
 * contiguous run of interventions discussing one topic. Linked to a procedure
 * (legislative dossier) when a document/procedure reference resolves against the
 * votes dataset.
 */
export interface DebateBlock {
  id: string;
  sittingUid: string;
  term: number;
  date: string;
  /** the agenda-item title as printed (English). */
  titre: string;
  /** "debate" (real debate item) | "vote" (voting time) | "other" (procedural). */
  type: "debate" | "vote" | "other";
  startOrdre: number;
  endOrdre: number;
  nIntervention: number;
  /** EP document references found in/around the item (e.g. "A9-0238/2023"). */
  docRefs: string[];
  /** procedureReference (dossier) this block was linked to, or null. */
  procedureRef: string | null;
  procedureTitle: string | null;
  /** how the link was established ("title-docref" | "para-docref" | "procref" | null). */
  matchKind: string | null;
}

/** A legislative procedure (dossier) and the debates attached to it. */
export interface ProcedureDebats {
  ref: string;
  titre: string | null;
  /** procedure type code (COD, RSP, INI, BUD, ...). */
  procedureType: string | null;
  term: number;
  /** ids of the debate blocks (chronological). */
  blocks: string[];
  /** uids of the sittings the procedure was discussed in. */
  sittings: string[];
  firstDate: string;
  lastDate: string;
  nIntervention: number;
}

// --- Summaries -------------------------------------------------------------

/** A pointer back to the transcript backing a summary claim. */
export interface Source {
  sittingUid: string;
  term: number;
  /** ordre of the cited intervention within the sitting. */
  ordre: number;
  /** MEP id of the cited speaker, when known. */
  mepId: number | null;
  /** the speaker, for display. */
  orateur: string | null;
  date: string;
  /** link to the official verbatim of the sitting. */
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

/** LLM summary of a single debate block (one agenda item, one sitting). */
export interface BlockSummary {
  blockId: string;
  sittingUid: string;
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

/** LLM explainer of a whole procedure, built from its block summaries + vote outcome. */
export interface ProcedureSummary {
  ref: string;
  titre: string | null;
  procedureType: string | null;
  term: number;
  /** plain-language "what this text does", for a non-expert reader. */
  resumeSimple: string;
  /** what is at stake / why it matters. */
  enJeu: string;
  argumentsPour: Argument[];
  argumentsContre: Argument[];
  /** key milestones of the debate. */
  chronologie: { date: string; titre: string; fait: string }[];
  orateursCles: Speaker[];
  /** the outcome in one sentence (adopted/rejected, margin, ...). */
  issue: string;
  sources: Source[];
  /** the per-debate summaries this explainer was distilled from. */
  blocks: BlockSummary[];
  generatedAt: string;
  model: string;
}

/** Lightweight record shipped for every summarized procedure (picker/index). */
export interface SummaryIndexEntry {
  ref: string;
  titre: string | null;
  procedureType: string | null;
  term: number;
  lastDate: string;
  nBlocks: number;
  nIntervention: number;
}

export interface Meta {
  source: string;
  license: string;
  generatedFrom: string;
  model: string;
  terms: number[];
  totals: {
    sittings: number;
    blocks: number;
    debates: number;
    procedures: number;
    summaries: number;
  };
  note: string;
}

/** Parliamentary terms covered by this dataset. */
export const TERMS = [9, 10] as const;
export type Term = (typeof TERMS)[number];

// --- Runtime base for fetched (non-bundled) per-item files ------------------

let DEBATS_BASE = "/eu-debats";

/** Override where per-sitting / per-procedure JSON is fetched from (default "/eu-debats"). */
export function setDebatsBase(base: string): void {
  DEBATS_BASE = base.replace(/\/$/, "");
}

/** Official verbatim-report URL for a sitting (the EP doceo HTML reader). */
export function sittingUrl(_term: number, uid: string): string {
  return `https://www.europarl.europa.eu/doceo/document/${uid}_EN.html`;
}

// --- Bundled index loaders (code-split JSON) -------------------------------

async function importJson<T>(p: Promise<any>): Promise<T> {
  return (await p).default as T;
}

/** Every sitting (lightweight). */
export function loadSeancesIndex(): Promise<SittingIndexEntry[]> {
  return importJson(import("../data/sittings-index.json"));
}

/** Every debate block (lightweight), with its procedure link. */
export function loadBlocksIndex(): Promise<DebateBlock[]> {
  return importJson(import("../data/blocks-index.json"));
}

/** Every procedure that has at least one linked debate. */
export function loadProcedureDebatsIndex(): Promise<ProcedureDebats[]> {
  return importJson(import("../data/procedure-debats.json"));
}

/** Every procedure for which an LLM summary has been generated. */
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
export function loadSitting(term: number, uid: string): Promise<Sitting> {
  return fetchJson<Sitting>(`sittings/${term}/${uid}.json`);
}

/** The full LLM explainer (+ per-debate summaries) for one procedure. */
export function loadProcedureSummary(ref: string): Promise<ProcedureSummary> {
  return fetchJson<ProcedureSummary>(`summaries/${refSlug(ref)}.json`);
}

/** Filesystem-safe slug for a procedure reference ("2019/2730(RSP)" -> "2019-2730-RSP"). */
export function refSlug(ref: string): string {
  return ref.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

// --- Helpers ---------------------------------------------------------------

/** The interventions of a block, sliced from a loaded sitting. */
export function blockInterventions(
  sitting: Sitting,
  block: Pick<DebateBlock, "startOrdre" | "endOrdre">,
): Intervention[] {
  return sitting.interventions.filter(
    (i) => i.o >= block.startOrdre && i.o <= block.endOrdre,
  );
}

/** Find the intervention cited by a Source within a loaded sitting. */
export function interventionAt(
  sitting: Sitting,
  ordre: number,
): Intervention | undefined {
  return sitting.interventions.find((i) => i.o === ordre);
}
