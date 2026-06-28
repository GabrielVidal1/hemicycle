/**
 * Summarize linked Assemblée nationale debates into plain-language law
 * explainers using a local open-weight LLM (LM Studio on the EVOX2 box,
 * OpenAI-compatible API). Two stages:
 *
 *   1. per debate BLOCK (one text, one sitting): map-reduce the interventions
 *      into a structured summary whose every argument cites a real
 *      intervention (by its ordre → speaker + séance + official URL).
 *   2. per LAW (dossier): reduce the block summaries + the final vote outcome
 *      into a citizen-facing explainer ("what this law does", arguments
 *      for/against, chronology, outcome).
 *
 * Emits (committed — the LLM output is the expensive artifact):
 *   - public/summaries/<dossierRef>.json   the explainer + per-séance summaries
 *   - public/seances/<leg>/<uid>.json      transcripts of the cited sittings
 *   - data/summaries-index.json            picker index (merged, not clobbered)
 *
 * Usage:
 *   LMSTUDIO_API_KEY=… yarn summarize                 # the default slice
 *   LMSTUDIO_API_KEY=… yarn summarize DLR5L17N52977   # specific dossiers
 *   LMSTUDIO_API_KEY=… yarn summarize --top 10        # N most recent w/ debate
 *   …                                     --force     # re-summarize existing
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
  "../french-assemblee-nationale-votes/data/scrutins-index.json",
);

const BASE_URL = process.env.LM_BASE_URL ?? "http://fedora:1234/v1";
const API_KEY =
  process.env.LMSTUDIO_API_KEY ?? process.env.LM_API_KEY ?? "lm-studio";
// A non-reasoning, multilingual instruction model: it returns JSON directly
// (the qwen3.6 *reasoning* models burn the token budget on a <think>/preamble
// before any JSON, which stalls a batch). Override with LM_MODEL.
const MODEL = process.env.LM_MODEL ?? "gemma-4-26b-a4b-it";
// The model is loaded with a very large context, so summarize a whole block in
// one call; only truly massive blocks split into map-reduce chunks.
const CHUNK_CHARS = 120_000;

/** Default vertical slice: a spread of recent laws of varying size. */
const SLICE = [
  "DLR5L17N52977", // Nationalisation d'ArcelorMittal France
  "DLR5L16N49364", // Réduction de l'impact environnemental de l'industrie textile
  "DLR5L17N52767", // Abrogation du Code noir
  "DLR5L17N51775", // Interdiction de la vaisselle en plastique
  "DLR5L17N54218", // Projet de loi constitutionnelle — Corse autonome
];

// Bound each request and handle retries ourselves (a stalled socket must not
// hang the whole batch on the SDK's 10-minute default).
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
  // Drop a ```json … ``` fence if the model wrapped its answer.
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1].trim();
  // Safety net: if the model echoed a bare placeholder, neutralize it.
  t = t.replace(/("ordre"\s*:\s*)N\b/g, "$1null");
  const a = t.indexOf("{");
  const b = t.lastIndexOf("}");
  if (a >= 0 && b > a) t = t.slice(a, b + 1);
  const tidy = (s: string) => s.replace(/,(\s*[}\]])/g, "$1"); // drop trailing commas
  try {
    return JSON.parse(t);
  } catch {
    return JSON.parse(tidy(t));
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function ask(system: string, user: string, maxTokens = 2200): Promise<any> {
  let lastErr: unknown;
  // Retry generously: a connection error usually means the box is reloading the
  // model (or briefly asleep) and needs ~30s; bad JSON usually clears with a
  // fresh, slightly warmer generation.
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
  a: string | null;
  nom: string;
  role: string | null;
  code: string | null;
  s: string | null;
  t: string;
}
interface SeanceFile {
  uid: string;
  leg: number;
  date: string;
  interventions: Intervention[];
}
interface Block {
  id: string;
  seanceUid: string;
  leg: number;
  date: string;
  titre: string;
  startOrdre: number;
  endOrdre: number;
  dossierRef: string | null;
}

const seanceCache = new Map<string, SeanceFile>();
async function loadSeance(leg: number, uid: string): Promise<SeanceFile> {
  const key = `${leg}/${uid}`;
  if (seanceCache.has(key)) return seanceCache.get(key)!;
  const s = JSON.parse(
    await readFile(resolve(CACHE, `seances/${leg}/${uid}.json`), "utf8"),
  );
  seanceCache.set(key, s);
  return s;
}

function seanceUrl(leg: number, uid: string): string {
  return `https://www.assemblee-nationale.fr/dyn/${leg}/comptes-rendus/seance/${uid}`;
}

/** Substantive speeches of a block (drop the chair's procedural lines). */
function speeches(s: SeanceFile, b: Block): Intervention[] {
  return s.interventions.filter(
    (i) =>
      i.o >= b.startOrdre &&
      i.o <= b.endOrdre &&
      i.a &&
      i.role !== "president" &&
      i.t.length > 40,
  );
}

function render(ivs: Intervention[]): string {
  return ivs.map((i) => `[#${i.o}] ${i.nom}: ${i.t}`).join("\n");
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

// --- argument → source mapping ---------------------------------------------

interface RawArg {
  point: string;
  orateur?: string | null;
  ordre?: number | null;
}
interface Source {
  seanceUid: string;
  leg: number;
  ordre: number;
  syceron: string | null;
  orateur: string | null;
  date: string;
  url: string;
}
interface Argument {
  point: string;
  orateur: string | null;
  source: number | null;
}

/** Resolve the {ordre} a model attached to each argument into a Source index. */
function resolveSources(
  args: RawArg[],
  s: SeanceFile,
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
            seanceUid: s.uid,
            leg: b.leg,
            ordre: ord,
            syceron: iv.s,
            orateur: iv.nom,
            date: b.date,
            url: seanceUrl(b.leg, s.uid),
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
  "Tu expliques les débats de l'Assemblée nationale française à un citoyen non spécialiste, " +
  "de façon neutre, factuelle et fidèle aux propos tenus. On te donne les interventions d'un " +
  "débat, chacune préfixée par son numéro entre crochets (ex. [#188]). Tu réponds UNIQUEMENT " +
  "par un objet JSON valide, en français, sans aucun texte autour. Chaque champ \"ordre\" doit " +
  "être un nombre entier (le numéro d'une intervention réelle). N'invente jamais de propos ni de chiffres.";

function blockSinglePrompt(titre: string, date: string, body: string): string {
  return (
    `Texte débattu : « ${titre} » (séance du ${date}).\n\n` +
    `Interventions :\n${body}\n\n` +
    `Produis cet objet JSON :\n` +
    `{\n` +
    `  "resume": "2 à 4 phrases expliquant ce qui a été débattu et l'enjeu",\n` +
    `  "pointsCles": ["point", "..."],\n` +
    `  "argumentsPour": [{"point":"argument en faveur du texte","orateur":"nom de l'orateur","ordre":188}],\n` +
    `  "argumentsContre": [{"point":"argument contre le texte","orateur":"nom","ordre":200}],\n` +
    `  "orateursCles": [{"nom":"nom","role":"sa position en quelques mots"}]\n` +
    `}\n` +
    `Remplace 188 et 200 par le vrai numéro (entier) de l'intervention qui appuie le mieux ` +
    `chaque point. 3 à 6 arguments par camp au maximum, les plus importants.`
  );
}

function chunkNotesPrompt(titre: string, body: string): string {
  return (
    `Extrait d'un débat sur « ${titre} ».\n\nInterventions :\n${body}\n\n` +
    `Produis cet objet JSON (notes partielles) :\n` +
    `{\n` +
    `  "pointsCles": ["..."],\n` +
    `  "argumentsPour": [{"point":"...","orateur":"...","ordre":188}],\n` +
    `  "argumentsContre": [{"point":"...","orateur":"...","ordre":200}],\n` +
    `  "orateursCles": [{"nom":"...","role":"..."}]\n` +
    `}\n"ordre" = le vrai numéro entier de l'intervention la plus représentative.`
  );
}

function blockReducePrompt(titre: string, date: string, notes: string): string {
  return (
    `Texte débattu : « ${titre} » (séance du ${date}).\n\n` +
    `Voici des notes partielles (JSON) tirées de différents extraits du débat :\n${notes}\n\n` +
    `Fusionne-les en un seul objet JSON, en supprimant les redondances et en gardant ` +
    `les arguments les plus importants (conserve les "ordre") :\n` +
    `{\n` +
    `  "resume": "2 à 4 phrases",\n` +
    `  "pointsCles": ["..."],\n` +
    `  "argumentsPour": [{"point":"...","orateur":"...","ordre":188}],\n` +
    `  "argumentsContre": [{"point":"...","orateur":"...","ordre":200}],\n` +
    `  "orateursCles": [{"nom":"...","role":"..."}]\n}\n` +
    `Garde les vrais numéros "ordre" (entiers) présents dans les notes.`
  );
}

const SYS_DOSSIER =
  "Tu rédiges une fiche pédagogique sur une loi pour un citoyen non spécialiste, à partir " +
  "des résumés des séances de débat à l'Assemblée nationale. Ton neutre et factuel. Tu " +
  "réponds UNIQUEMENT par un objet JSON valide en français. N'invente rien.";

function dossierPrompt(titre: string, issue: string, blocksDigest: string): string {
  return (
    `Loi : « ${titre} ».\n` +
    `Issue du vote : ${issue}\n\n` +
    `Résumés des séances de débat :\n${blocksDigest}\n\n` +
    `Produis cet objet JSON :\n` +
    `{\n` +
    `  "resumeSimple": "3 à 5 phrases expliquant simplement ce que fait cette loi",\n` +
    `  "enJeu": "1 à 3 phrases sur pourquoi ce texte compte / ce qu'il change",\n` +
    `  "argumentsPour": [{"point":"argument en faveur","orateur":"nom ou groupe"}],\n` +
    `  "argumentsContre": [{"point":"argument contre","orateur":"nom ou groupe"}],\n` +
    `  "chronologie": [{"date":"AAAA-MM-JJ","titre":"étape","fait":"ce qui s'est passé"}],\n` +
    `  "orateursCles": [{"nom":"nom","role":"son rôle / sa position"}],\n` +
    `  "issue": "1 phrase résumant l'issue du vote"\n` +
    `}`
  );
}

// --- summarization ---------------------------------------------------------

interface BlockSummary {
  blockId: string;
  seanceUid: string;
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
  const s = await loadSeance(b.leg, b.seanceUid);
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
  // Merge the two source pools, re-indexing the contre args.
  const sources = [...pour.sources];
  const offset = sources.length;
  for (const src of contre.sources) sources.push(src);
  for (const a of contre.args) if (a.source != null) a.source += offset;

  return {
    blockId: b.id,
    seanceUid: b.seanceUid,
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

interface ScrutinIdx {
  legislature: number;
  date: string;
  type: string;
  sort: string | null;
  objet: string | null;
  titre: string | null;
  dossierRef: string | null;
  synthese: { pour: number | null; contre: number | null; abstention: number | null; votants: number | null };
}

function outcome(scrutins: ScrutinIdx[]): string {
  if (!scrutins.length) return "Vote non identifié dans les données de scrutins.";
  const score = (s: ScrutinIdx) => {
    const ens = /\bl?'?ensemble\b/i.test(s.objet ?? s.titre ?? "");
    const turnout =
      s.synthese.votants ??
      (s.synthese.pour ?? 0) + (s.synthese.contre ?? 0) + (s.synthese.abstention ?? 0);
    return (s.type === "SPS" ? 1e6 : 0) + (ens ? 5e5 : 0) + turnout;
  };
  const s = [...scrutins].sort((a, b) => score(b) - score(a))[0];
  const adopted = (s.sort ?? "").toLowerCase().includes("adopt");
  const sy = s.synthese;
  return (
    `${adopted ? "Adopté" : "Rejeté"} le ${s.date} ` +
    `(${sy.pour ?? "?"} pour, ${sy.contre ?? "?"} contre, ${sy.abstention ?? "?"} abstentions).`
  );
}

/**
 * Deterministic fallback for the per-law explainer when the LLM reduce fails
 * (bad JSON, box unreachable): derive presentable dossier-level fields from the
 * already-computed per-séance block summaries — no model call needed.
 */
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
  const args = process.argv.slice(2);
  const force = args.includes("--force");
  const topIdx = args.indexOf("--top");
  const top = topIdx >= 0 ? Number(args[topIdx + 1]) : 0;
  const explicit = args.filter((a) => a.startsWith("DLR"));

  const dossierDebats: any[] = JSON.parse(
    await readFile(resolve(DATA, "dossier-debats.json"), "utf8"),
  );
  const blocksIndex: Block[] = JSON.parse(
    await readFile(resolve(DATA, "blocks-index.json"), "utf8"),
  );
  const votesIndex: ScrutinIdx[] = JSON.parse(await readFile(VOTES_INDEX, "utf8"));

  let refs: string[];
  if (explicit.length) refs = explicit;
  else if (top > 0) refs = dossierDebats.slice(0, top).map((d) => d.ref);
  else refs = SLICE;

  console.log(`Model: ${MODEL} @ ${BASE_URL}`);
  console.log(`Summarizing ${refs.length} law(s): ${refs.join(", ")}\n`);

  // Merge into the existing picker index.
  const indexPath = resolve(DATA, "summaries-index.json");
  const indexMap = new Map<string, any>();
  if (existsSync(indexPath)) {
    for (const e of JSON.parse(await readFile(indexPath, "utf8"))) indexMap.set(e.ref, e);
  }

  for (const ref of refs) {
    const dd = dossierDebats.find((d) => d.ref === ref);
    if (!dd) {
      console.warn(`  ! ${ref}: no linked debate, skipped`);
      continue;
    }
    const outPath = resolve(PUBLIC, `summaries/${ref}.json`);
    if (existsSync(outPath) && !force) {
      console.log(`  = ${ref}: already summarized (use --force)`);
      continue;
    }

    const blocks = (dd.blocks as string[])
      .map((id) => blocksIndex.find((b) => b.id === id)!)
      .filter(Boolean)
      .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.startOrdre - b.startOrdre));

    console.log(`  • ${ref} — ${dd.titre} (${blocks.length} séance-blocs)`);
    const blockSummaries: BlockSummary[] = [];
    for (const b of blocks) {
      process.stdout.write(`      ${b.date} ${b.seanceUid} … `);
      try {
        const bs = await summarizeBlock(b);
        if (bs) {
          blockSummaries.push(bs);
          process.stdout.write(`ok (${bs.argumentsPour.length}+${bs.argumentsContre.length} args)\n`);
        } else process.stdout.write("vide\n");
      } catch (e) {
        process.stdout.write(`ERREUR ${(e as Error).message}\n`);
      }
    }
    if (!blockSummaries.length) {
      console.warn(`    ! ${ref}: no usable block, skipped`);
      continue;
    }

    const scrutins = votesIndex.filter((s) => s.dossierRef === ref);
    const issueRaw = outcome(scrutins);
    const digest = blockSummaries
      .map(
        (b) =>
          `### ${b.date} — ${b.titre}\n${b.resume}\n` +
          `POUR: ${b.argumentsPour.map((a) => a.point).join(" | ")}\n` +
          `CONTRE: ${b.argumentsContre.map((a) => a.point).join(" | ")}`,
      )
      .join("\n\n");

    let dr: any;
    try {
      dr = await ask(SYS_DOSSIER, dossierPrompt(dd.titre, issueRaw, digest), 2600);
      if (!dr?.resumeSimple) throw new Error("empty resumeSimple");
    } catch (e) {
      console.warn(
        `    ! ${ref}: dossier reduce failed (${(e as Error).message}) — using block-derived fallback`,
      );
      dr = synthesizeDossier(blockSummaries, issueRaw);
    }

    // Dossier-level sources: dedup the union of block sources, cap at 24.
    const seen = new Set<string>();
    const sources: Source[] = [];
    for (const b of blockSummaries)
      for (const s of b.sources) {
        const k = `${s.seanceUid}#${s.ordre}`;
        if (!seen.has(k)) {
          seen.add(k);
          sources.push(s);
        }
      }

    const summary = {
      ref,
      titre: dd.titre,
      leg: dd.leg,
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

    // Ship the transcripts of the cited sittings.
    for (const uid of dd.seances as string[]) {
      const from = resolve(CACHE, `seances/${dd.leg}/${uid}.json`);
      const to = resolve(PUBLIC, `seances/${dd.leg}/${uid}.json`);
      if (existsSync(from)) {
        await mkdir(dirname(to), { recursive: true });
        await copyFile(from, to);
      }
    }

    indexMap.set(ref, {
      ref,
      titre: dd.titre,
      leg: dd.leg,
      lastDate: dd.lastDate,
      nBlocks: blockSummaries.length,
      nIntervention: dd.nIntervention,
    });
    console.log(`    ✓ ${ref} written (${blockSummaries.length} blocs, ${sources.length} sources)`);
  }

  const index = [...indexMap.values()].sort((a, b) =>
    a.lastDate < b.lastDate ? 1 : -1,
  );
  await writeJson(indexPath, index);
  console.log(`\nDone. ${index.length} law(s) in summaries-index.json.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
