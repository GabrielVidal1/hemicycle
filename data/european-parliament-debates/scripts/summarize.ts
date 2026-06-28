/**
 * Summarize linked European Parliament debates into plain-language explainers
 * using a local open-weight LLM (LM Studio on the EVOX2 box, OpenAI-compatible
 * API). Two stages:
 *
 *   1. per debate BLOCK (one agenda item, one sitting): map-reduce the
 *      interventions into a structured summary whose every argument cites a real
 *      intervention (by its ordre -> speaker + sitting + official URL).
 *   2. per PROCEDURE (dossier): reduce the block summaries + the final vote
 *      outcome into a citizen-facing explainer ("what this text does", arguments
 *      for/against, chronology, outcome).
 *
 * The EP verbatim is multilingual — each speech is in the speaker's own
 * language. The model reads the original-language interventions and writes the
 * summaries in ENGLISH.
 *
 * Emits (committed — the LLM output is the expensive artifact):
 *   - public/summaries/<refSlug>.json   the explainer + per-debate summaries
 *   - public/sittings/<term>/<uid>.json transcripts of the cited sittings
 *   - data/summaries-index.json         picker index (merged, not clobbered)
 *
 * Usage:
 *   LMSTUDIO_API_KEY=… yarn summarize                    # the default slice (most-debated)
 *   LMSTUDIO_API_KEY=… yarn summarize "2023/0079(COD)"   # specific procedures
 *   LMSTUDIO_API_KEY=… yarn summarize --top 10           # N most-debated procedures
 *   …                                   --force           # re-summarize existing
 */
import OpenAI from "openai";
import { mkdir, writeFile, readFile, copyFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");
const DATA = resolve(ROOT, "data");
const CACHE = resolve(ROOT, ".cache");
const PUBLIC = resolve(ROOT, "public");
const VOTES_INDEX = resolve(
  ROOT,
  "../european-parliament-votes/data/votes-index.json",
);

const BASE_URL = process.env.LM_BASE_URL ?? "http://fedora:1234/v1";
const API_KEY =
  process.env.LMSTUDIO_API_KEY ?? process.env.LM_API_KEY ?? "lm-studio";
// A non-reasoning, multilingual instruction model: it returns JSON directly
// (reasoning models burn the token budget on a <think> preamble before any
// JSON, which stalls a batch). Override with LM_MODEL.
const MODEL = process.env.LM_MODEL ?? "gemma-4-26b-a4b-it";
const CHUNK_CHARS = 120_000;

const refSlug = (ref: string): string =>
  ref.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

const client = new OpenAI({
  baseURL: BASE_URL,
  apiKey: API_KEY,
  timeout: 240_000,
  maxRetries: 0,
});

// --- LLM plumbing ----------------------------------------------------------

function stripThink(s: string): string {
  return s.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
}

function extractJson(s: string): any {
  let t = stripThink(s);
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1].trim();
  t = t.replace(/("ordre"\s*:\s*)N\b/g, "$1null");
  const a = t.indexOf("{");
  const b = t.lastIndexOf("}");
  if (a >= 0 && b > a) t = t.slice(a, b + 1);
  const tidy = (s: string) => s.replace(/,(\s*[}\]])/g, "$1");
  try {
    return JSON.parse(t);
  } catch {
    return JSON.parse(tidy(t));
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function ask(system: string, user: string, maxTokens = 2200): Promise<any> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      const res = await client.chat.completions.create({
        model: MODEL,
        temperature: 0.2 + attempt * 0.1,
        max_tokens: maxTokens,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      });
      return extractJson(res.choices[0]?.message?.content ?? "");
    } catch (e) {
      lastErr = e;
      const connreset = /connection|socket|ECONN|terminated|fetch failed/i.test(
        (e as Error)?.message ?? "",
      );
      await sleep(Math.min(30_000, (connreset ? 6000 : 2000) * 2 ** attempt));
    }
  }
  throw lastErr;
}

// --- transcript helpers ----------------------------------------------------

interface Intervention {
  o: number;
  mepId: number | null;
  nom: string;
  role: string | null;
  lg: string | null;
  s: string | null;
  t: string;
}
interface SittingFile {
  uid: string;
  term: number;
  date: string;
  interventions: Intervention[];
}
interface Block {
  id: string;
  sittingUid: string;
  term: number;
  date: string;
  titre: string;
  type: string;
  startOrdre: number;
  endOrdre: number;
  procedureRef: string | null;
}

const sittingCache = new Map<string, SittingFile>();
async function loadSitting(term: number, uid: string): Promise<SittingFile> {
  const key = `${term}/${uid}`;
  if (sittingCache.has(key)) return sittingCache.get(key)!;
  const s = JSON.parse(
    await readFile(resolve(CACHE, `sittings/${term}/${uid}.json`), "utf8"),
  );
  sittingCache.set(key, s);
  return s;
}

function sittingUrl(_term: number, uid: string): string {
  return `https://www.europarl.europa.eu/doceo/document/${uid}_EN.html`;
}

/** Substantive speeches of a block (drop the chair's procedural lines). */
function speeches(s: SittingFile, b: Block): Intervention[] {
  return s.interventions.filter(
    (i) =>
      i.o >= b.startOrdre &&
      i.o <= b.endOrdre &&
      i.t.length > 60 &&
      !/pr[aeä]sid/i.test(i.role ?? ""),
  );
}

function render(ivs: Intervention[]): string {
  return ivs
    .map((i) => `[#${i.o}] ${i.nom}${i.lg ? ` (${i.lg})` : ""}: ${i.t}`)
    .join("\n");
}

function chunk(ivs: Intervention[]): Intervention[][] {
  const out: Intervention[][] = [];
  let cur: Intervention[] = [];
  let len = 0;
  for (const i of ivs) {
    const l = i.nom.length + i.t.length + 12;
    if (len + l > CHUNK_CHARS && cur.length) {
      out.push(cur);
      cur = [];
      len = 0;
    }
    cur.push(i);
    len += l;
  }
  if (cur.length) out.push(cur);
  return out;
}

// --- argument -> source mapping --------------------------------------------

interface RawArg {
  point: string;
  orateur?: string | null;
  ordre?: number | null;
}
interface Source {
  sittingUid: string;
  term: number;
  ordre: number;
  mepId: number | null;
  orateur: string | null;
  date: string;
  url: string;
}
interface Argument {
  point: string;
  orateur: string | null;
  source: number | null;
}

function resolveSources(
  args: RawArg[],
  s: SittingFile,
  b: Block,
): { args: Argument[]; sources: Source[] } {
  const sources: Source[] = [];
  const byOrdre = new Map<number, number>();
  const out: Argument[] = [];
  for (const a of args ?? []) {
    if (!a?.point) continue;
    let srcIdx: number | null = null;
    const ord = typeof a.ordre === "number" ? a.ordre : null;
    if (ord != null) {
      if (!byOrdre.has(ord)) {
        const iv = s.interventions.find((i) => i.o === ord);
        if (iv) {
          byOrdre.set(ord, sources.length);
          sources.push({
            sittingUid: s.uid,
            term: b.term,
            ordre: ord,
            mepId: iv.mepId,
            orateur: iv.nom,
            date: b.date,
            url: sittingUrl(b.term, s.uid),
          });
        }
      }
      srcIdx = byOrdre.has(ord) ? byOrdre.get(ord)! : null;
    }
    out.push({ point: a.point, orateur: a.orateur ?? null, source: srcIdx });
  }
  return { args: out, sources };
}

// --- prompts ---------------------------------------------------------------

const SYS_BLOCK =
  "You explain European Parliament plenary debates to an ordinary citizen, " +
  "neutrally, factually and faithfully to what was actually said. You are given " +
  "the interventions of one debate (they may be in several EU languages, each in " +
  "the speaker's own language), each prefixed by its number in brackets (e.g. " +
  "[#188]). You reply ONLY with a valid JSON object, in ENGLISH, with no text " +
  'around it. Every "ordre" field must be an integer (the number of a real ' +
  "intervention). Never invent statements or figures.";

function blockSinglePrompt(titre: string, date: string, body: string): string {
  return (
    `Agenda item: « ${titre} » (sitting of ${date}).\n\n` +
    `Interventions:\n${body}\n\n` +
    `Produce this JSON object (in English):\n` +
    `{\n` +
    `  "resume": "2 to 4 sentences explaining what was debated and what is at stake",\n` +
    `  "pointsCles": ["point", "..."],\n` +
    `  "argumentsPour": [{"point":"argument in favour of the text","orateur":"speaker name","ordre":188}],\n` +
    `  "argumentsContre": [{"point":"argument against the text","orateur":"name","ordre":200}],\n` +
    `  "orateursCles": [{"nom":"name","role":"their position in a few words"}]\n` +
    `}\n` +
    `Replace 188 and 200 with the real (integer) number of the intervention that ` +
    `best supports each point. At most 3 to 6 arguments per side, the most important.`
  );
}

function chunkNotesPrompt(titre: string, body: string): string {
  return (
    `Extract of a debate on « ${titre} ».\n\nInterventions:\n${body}\n\n` +
    `Produce this JSON object (partial notes, in English):\n` +
    `{\n` +
    `  "pointsCles": ["..."],\n` +
    `  "argumentsPour": [{"point":"...","orateur":"...","ordre":188}],\n` +
    `  "argumentsContre": [{"point":"...","orateur":"...","ordre":200}],\n` +
    `  "orateursCles": [{"nom":"...","role":"..."}]\n` +
    `}\n"ordre" = the real integer number of the most representative intervention.`
  );
}

function blockReducePrompt(titre: string, date: string, notes: string): string {
  return (
    `Agenda item: « ${titre} » (sitting of ${date}).\n\n` +
    `Here are partial notes (JSON) drawn from different extracts of the debate:\n${notes}\n\n` +
    `Merge them into a single JSON object, removing redundancy and keeping the ` +
    `most important arguments (keep the "ordre" values):\n` +
    `{\n` +
    `  "resume": "2 to 4 sentences",\n` +
    `  "pointsCles": ["..."],\n` +
    `  "argumentsPour": [{"point":"...","orateur":"...","ordre":188}],\n` +
    `  "argumentsContre": [{"point":"...","orateur":"...","ordre":200}],\n` +
    `  "orateursCles": [{"nom":"...","role":"..."}]\n}\n` +
    `Keep the real "ordre" integers present in the notes.`
  );
}

const SYS_DOSSIER =
  "You write an explainer about a European Parliament legislative text for an " +
  "ordinary citizen, from the summaries of its plenary debates. Neutral, factual " +
  "tone. You reply ONLY with a valid JSON object in ENGLISH. Invent nothing.";

function dossierPrompt(titre: string, issue: string, blocksDigest: string): string {
  return (
    `Text: « ${titre} ».\n` +
    `Vote outcome: ${issue}\n\n` +
    `Summaries of the debate sittings:\n${blocksDigest}\n\n` +
    `Produce this JSON object (in English):\n` +
    `{\n` +
    `  "resumeSimple": "3 to 5 sentences plainly explaining what this text does",\n` +
    `  "enJeu": "1 to 3 sentences on why it matters / what it changes",\n` +
    `  "argumentsPour": [{"point":"argument in favour","orateur":"name or group"}],\n` +
    `  "argumentsContre": [{"point":"argument against","orateur":"name or group"}],\n` +
    `  "chronologie": [{"date":"YYYY-MM-DD","titre":"step","fait":"what happened"}],\n` +
    `  "orateursCles": [{"nom":"name","role":"their role / position"}],\n` +
    `  "issue": "1 sentence summarising the vote outcome"\n` +
    `}`
  );
}

// --- summarization ---------------------------------------------------------

interface BlockSummary {
  blockId: string;
  sittingUid: string;
  date: string;
  titre: string;
  resume: string;
  pointsCles: string[];
  argumentsPour: Argument[];
  argumentsContre: Argument[];
  orateursCles: { nom: string; role: string }[];
  sources: Source[];
}

async function summarizeBlock(b: Block): Promise<BlockSummary | null> {
  const s = await loadSitting(b.term, b.sittingUid);
  const ivs = speeches(s, b);
  if (ivs.length < 2) return null;
  const chunks = chunk(ivs);

  let raw: any;
  if (chunks.length === 1) {
    raw = await ask(SYS_BLOCK, blockSinglePrompt(b.titre, b.date, render(ivs)));
  } else {
    const notes: any[] = [];
    for (const c of chunks) {
      notes.push(await ask(SYS_BLOCK, chunkNotesPrompt(b.titre, render(c)), 1600));
    }
    raw = await ask(
      SYS_BLOCK,
      blockReducePrompt(b.titre, b.date, JSON.stringify(notes)),
    );
  }

  const pour = resolveSources(raw.argumentsPour ?? [], s, b);
  const contre = resolveSources(raw.argumentsContre ?? [], s, b);
  const sources = [...pour.sources];
  const offset = sources.length;
  for (const src of contre.sources) sources.push(src);
  for (const a of contre.args) if (a.source != null) a.source += offset;

  return {
    blockId: b.id,
    sittingUid: b.sittingUid,
    date: b.date,
    titre: b.titre,
    resume: String(raw.resume ?? ""),
    pointsCles: (raw.pointsCles ?? []).map(String),
    argumentsPour: pour.args,
    argumentsContre: contre.args,
    orateursCles: (raw.orateursCles ?? []).map((o: any) => ({
      nom: String(o?.nom ?? ""),
      role: String(o?.role ?? ""),
    })),
    sources,
  };
}

// --- vote outcome ----------------------------------------------------------

interface VoteIdx {
  term: number;
  timestamp: string;
  title: string | null;
  isMain: boolean;
  procedureReference: string | null;
  result: string | null;
  totals: {
    for: number | null;
    against: number | null;
    abstention: number | null;
    didNotVote: number | null;
  };
}

function outcome(votes: VoteIdx[]): string {
  if (!votes.length) return "No roll-call vote identified in the votes dataset.";
  const score = (v: VoteIdx) => {
    const turnout =
      (v.totals.for ?? 0) + (v.totals.against ?? 0) + (v.totals.abstention ?? 0);
    return (v.isMain ? 1e6 : 0) + turnout;
  };
  const v = [...votes].sort((a, b) => score(b) - score(a))[0];
  const adopted = (v.result ?? "").toUpperCase() === "ADOPTED";
  const date = v.timestamp.slice(0, 10);
  return (
    `${adopted ? "Adopted" : v.result === "REJECTED" ? "Rejected" : "Voted"} on ${date} ` +
    `(${v.totals.for ?? "?"} for, ${v.totals.against ?? "?"} against, ${v.totals.abstention ?? "?"} abstentions).`
  );
}

/** Deterministic fallback when the LLM reduce fails: derive from block summaries. */
function synthesizeDossier(blocks: BlockSummary[], issueRaw: string) {
  const dedup = (arr: { point: string; orateur: string | null }[]) => {
    const seen = new Set<string>();
    const out: { point: string; orateur: string | null }[] = [];
    for (const a of arr) {
      const k = a.point.slice(0, 50).toLowerCase();
      if (a.point && !seen.has(k)) {
        seen.add(k);
        out.push({ point: a.point, orateur: a.orateur });
      }
    }
    return out.slice(0, 6);
  };
  const speakers = new Map<string, string>();
  for (const b of blocks)
    for (const o of b.orateursCles) if (o.nom && !speakers.has(o.nom)) speakers.set(o.nom, o.role);
  return {
    resumeSimple: blocks[0]?.resume ?? "",
    enJeu: "",
    argumentsPour: dedup(blocks.flatMap((b) => b.argumentsPour)),
    argumentsContre: dedup(blocks.flatMap((b) => b.argumentsContre)),
    chronologie: blocks.map((b) => ({
      date: b.date,
      titre: b.titre,
      fait: b.resume.slice(0, 160),
    })),
    orateursCles: [...speakers].slice(0, 6).map(([nom, role]) => ({ nom, role })),
    issue: issueRaw,
  };
}

// --- main ------------------------------------------------------------------

async function writeJson(path: string, data: unknown) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(data));
}

async function main() {
  const argv = process.argv.slice(2);
  const force = argv.includes("--force");
  const topIdx = argv.indexOf("--top");
  const top = topIdx >= 0 ? Number(argv[topIdx + 1]) : 0;
  const explicit = argv.filter((a) => /^\d{4}\/\d{4}\(/.test(a));

  const procedureDebats: any[] = JSON.parse(
    await readFile(resolve(DATA, "procedure-debats.json"), "utf8"),
  );
  const blocksIndex: Block[] = JSON.parse(
    await readFile(resolve(DATA, "blocks-index.json"), "utf8"),
  );
  const votesIndex: VoteIdx[] = JSON.parse(await readFile(VOTES_INDEX, "utf8"));

  // Default slice: the most-debated procedures (substantive, well-covered).
  const byInterv = [...procedureDebats].sort(
    (a, b) => b.nIntervention - a.nIntervention,
  );
  let refs: string[];
  if (explicit.length) refs = explicit;
  else if (top > 0) refs = byInterv.slice(0, top).map((d) => d.ref);
  else refs = byInterv.slice(0, 6).map((d) => d.ref);

  console.log(`Model: ${MODEL} @ ${BASE_URL}`);
  console.log(`Summarizing ${refs.length} procedure(s): ${refs.join(", ")}\n`);

  const indexPath = resolve(DATA, "summaries-index.json");
  const indexMap = new Map<string, any>();
  if (existsSync(indexPath)) {
    for (const e of JSON.parse(await readFile(indexPath, "utf8"))) indexMap.set(e.ref, e);
  }

  for (const ref of refs) {
    const dd = procedureDebats.find((d) => d.ref === ref);
    if (!dd) {
      console.warn(`  ! ${ref}: no linked debate, skipped`);
      continue;
    }
    const outPath = resolve(PUBLIC, `summaries/${refSlug(ref)}.json`);
    if (existsSync(outPath) && !force) {
      console.log(`  = ${ref}: already summarized (use --force)`);
      continue;
    }

    const blocks = (dd.blocks as string[])
      .map((id) => blocksIndex.find((b) => b.id === id)!)
      .filter(Boolean)
      .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.startOrdre - b.startOrdre));

    console.log(`  • ${ref} — ${dd.titre} (${blocks.length} debate-blocks)`);
    const blockSummaries: BlockSummary[] = [];
    for (const b of blocks) {
      process.stdout.write(`      ${b.date} ${b.sittingUid} … `);
      try {
        const bs = await summarizeBlock(b);
        if (bs) {
          blockSummaries.push(bs);
          process.stdout.write(`ok (${bs.argumentsPour.length}+${bs.argumentsContre.length} args)\n`);
        } else process.stdout.write("empty\n");
      } catch (e) {
        process.stdout.write(`ERROR ${(e as Error).message}\n`);
      }
    }
    if (!blockSummaries.length) {
      console.warn(`    ! ${ref}: no usable block, skipped`);
      continue;
    }

    const votes = votesIndex.filter((v) => v.procedureReference === ref);
    const issueRaw = outcome(votes);
    const digest = blockSummaries
      .map(
        (b) =>
          `### ${b.date} — ${b.titre}\n${b.resume}\n` +
          `FOR: ${b.argumentsPour.map((a) => a.point).join(" | ")}\n` +
          `AGAINST: ${b.argumentsContre.map((a) => a.point).join(" | ")}`,
      )
      .join("\n\n");

    let dr: any;
    try {
      dr = await ask(SYS_DOSSIER, dossierPrompt(dd.titre, issueRaw, digest), 2600);
      if (!dr?.resumeSimple) throw new Error("empty resumeSimple");
    } catch (e) {
      console.warn(
        `    ! ${ref}: procedure reduce failed (${(e as Error).message}) — using block-derived fallback`,
      );
      dr = synthesizeDossier(blockSummaries, issueRaw);
    }

    const seen = new Set<string>();
    const sources: Source[] = [];
    for (const b of blockSummaries)
      for (const s of b.sources) {
        const k = `${s.sittingUid}#${s.ordre}`;
        if (!seen.has(k)) {
          seen.add(k);
          sources.push(s);
        }
      }

    const summary = {
      ref,
      titre: dd.titre,
      procedureType: dd.procedureType,
      term: dd.term,
      resumeSimple: String(dr.resumeSimple ?? ""),
      enJeu: String(dr.enJeu ?? ""),
      argumentsPour: (dr.argumentsPour ?? []).map((a: any) => ({
        point: String(a?.point ?? ""),
        orateur: a?.orateur ?? null,
        source: null,
      })),
      argumentsContre: (dr.argumentsContre ?? []).map((a: any) => ({
        point: String(a?.point ?? ""),
        orateur: a?.orateur ?? null,
        source: null,
      })),
      chronologie: (dr.chronologie ?? []).map((c: any) => ({
        date: String(c?.date ?? ""),
        titre: String(c?.titre ?? ""),
        fait: String(c?.fait ?? ""),
      })),
      orateursCles: (dr.orateursCles ?? []).map((o: any) => ({
        nom: String(o?.nom ?? ""),
        role: String(o?.role ?? ""),
      })),
      issue: String(dr.issue ?? issueRaw),
      sources: sources.slice(0, 24),
      blocks: blockSummaries,
      generatedAt: new Date().toISOString(),
      model: MODEL,
    };

    await writeJson(outPath, summary);

    for (const uid of dd.sittings as string[]) {
      const from = resolve(CACHE, `sittings/${dd.term}/${uid}.json`);
      const to = resolve(PUBLIC, `sittings/${dd.term}/${uid}.json`);
      if (existsSync(from)) {
        await mkdir(dirname(to), { recursive: true });
        await copyFile(from, to);
      }
    }

    indexMap.set(ref, {
      ref,
      titre: dd.titre,
      procedureType: dd.procedureType,
      term: dd.term,
      lastDate: dd.lastDate,
      nBlocks: blockSummaries.length,
      nIntervention: dd.nIntervention,
    });
    console.log(`    ✓ ${ref} written (${blockSummaries.length} blocks, ${sources.length} sources)`);
  }

  const index = [...indexMap.values()].sort((a, b) =>
    a.lastDate < b.lastDate ? 1 : -1,
  );
  await writeJson(indexPath, index);
  console.log(`\nDone. ${index.length} procedure(s) in summaries-index.json.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
