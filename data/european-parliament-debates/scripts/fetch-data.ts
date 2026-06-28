/**
 * Fetch & parse European Parliament plenary debate verbatim reports
 * ("Verbatim report of proceedings" / "Compte rendu in extenso", CRE), segment
 * each sitting into per-agenda-item debate blocks, link those blocks to the
 * legislative procedures (dossiers) of the votes dataset, and emit the index
 * files consumed by `@hemicycle/european-parliament-debates`.
 *
 * Source: https://data.europarl.europa.eu (EP Open Data Portal).
 *   - LIST:  /api/v2/documents?work-type=CRE_PLENARY&year=YYYY   (the CRE ids)
 *   - XML:   /distribution/doc/<CRE-id>_mul.xml                  (the verbatim)
 *
 * Only sittings for which the FINAL multilingual XML exists are parsed (the
 * provisional verbatim ships only as PDF/DOCX and lags the final XML, so recent
 * sittings are absent until their XML is published).
 *
 * Outputs:
 *   - data/sittings-index.json      lightweight record for every parsed sitting
 *   - data/blocks-index.json        every debate block, with its procedure link
 *   - data/procedure-debats.json    procedure -> debate blocks / sittings
 *   - data/meta.json                provenance + counts
 *   - data/summaries-index.json     created empty if absent (filled by summarize.ts)
 *   - .cache/sittings/<term>/<uid>.json  full transcript per sitting (gitignored
 *                                        working set; the shipped slice is copied
 *                                        to public/sittings by summarize.ts)
 *
 * Re-run with:  yarn fetch
 */
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, "../data");
const CACHE = resolve(HERE, "../.cache");
const VOTES_INDEX = resolve(
  HERE,
  "../../european-parliament-votes/data/votes-index.json",
);

const API = "https://data.europarl.europa.eu/api/v2";
const DIST = "https://data.europarl.europa.eu/distribution/doc";
const XMLCACHE = resolve(HERE, "../.cache/xml");
const PROBE = resolve(HERE, "../.cache/probe.json");

// Final verbatim XML exists for terms 9-10 (the votes dataset's terms 9-10) but
// is published with a long lag, so recent sittings only have PDF/DOCX. Default
// to the years where final XML is reliably available; override on the CLI
// (e.g. `yarn fetch 2021 2022`). The fetch is resumable — re-running continues
// where a rate-limit window left off (see the probe cache).
const argYears = process.argv.slice(2).filter((a) => /^\d{4}$/.test(a)).map(Number);
const YEARS = argYears.length ? argYears : [2023, 2024];

// The EP portal rate-limits (~100 requests / 15 min per IP) and 403s the burst;
// stay under the limit (~1 request / 9s) and back off hard on a 403/429 so the
// run grinds through the limit instead of failing. Cached XML hits skip the wait.
const REQ_DELAY = 9000;

// --- generic helpers -------------------------------------------------------

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// The distribution host 403s the default Node fetch UA; present a browser one.
const UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

async function getJson(url: string): Promise<any> {
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { Accept: "application/ld+json", "User-Agent": UA },
      });
      if (res.status === 204) return { data: [] };
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e) {
      if (attempt === 3) throw e;
      await sleep(2000 * 2 ** attempt);
    }
  }
}

let lastReq = 0;
async function throttle() {
  const wait = REQ_DELAY - (Date.now() - lastReq);
  if (wait > 0) await sleep(wait);
  lastReq = Date.now();
}

/**
 * Download the verbatim XML for a CRE id, or null when it does not exist.
 * Caches the raw XML under .cache/xml so re-runs (and re-parsing) are free, and
 * backs off hard on a rate-limit 403/429 so the run survives the limit window.
 */
async function getXml(id: string): Promise<string | null> {
  const cached = resolve(XMLCACHE, `${id}.xml`);
  if (existsSync(cached)) {
    const t = await readFile(cached, "utf8");
    return t.length > 200 ? t : null;
  }
  const url = `${DIST}/${id}_mul.xml`;
  for (let attempt = 0; attempt < 20; attempt++) {
    await throttle();
    let res: Response;
    try {
      res = await fetch(url, { headers: { "User-Agent": UA, Accept: "*/*" } });
    } catch {
      await sleep(5000);
      continue;
    }
    if (res.status === 404 || res.status === 410) return null;
    if (res.status === 403 || res.status === 429 || res.status >= 500) {
      // Rate-limited: wait out the window (it resets ~15 min after the burst).
      const back = Math.min(60_000, 15_000 + attempt * 8_000);
      process.stdout.write(`    (HTTP ${res.status}, backing off ${Math.round(back / 1000)}s)\n`);
      await sleep(back);
      continue;
    }
    const text = await res.text();
    if (text.length > 200 && text.includes("<DEBATS")) {
      await mkdir(XMLCACHE, { recursive: true });
      await writeFile(cached, text);
      return text;
    }
    return null;
  }
  return null;
}

/** Resumable probe cache: id -> "ok" | "none" (avoid re-requesting known-absent XML). */
type Probe = Record<string, "ok" | "none">;
async function loadProbe(): Promise<Probe> {
  if (!existsSync(PROBE)) return {};
  try {
    return JSON.parse(await readFile(PROBE, "utf8"));
  } catch {
    return {};
  }
}
async function saveProbe(p: Probe) {
  await mkdir(dirname(PROBE), { recursive: true });
  await writeFile(PROBE, JSON.stringify(p));
}

async function writeJson(base: string, rel: string, data: unknown) {
  const path = resolve(base, rel);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(data));
}

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m);
}

/** Strip inline tags (EMPHAS, BRK, ...) and decode entities into clean text. */
function inlineText(raw: string): string {
  return decodeEntities(
    raw
      .replace(/<BRK\s*\/?>/gi, " ")
      .replace(/<[^>]+>/g, ""),
  )
    .replace(/\s+/g, " ")
    .trim();
}

function clean(s: string): string {
  return decodeEntities(s).replace(/\s+/g, " ").trim();
}

/** All EP document / procedure references mentioned in a string. */
const DOCREF_RE = /(?:RC-)?[ABC]\d{1,2}-\d{4}\/\d{4}/g;
const PROCREF_RE = /\d{4}\/\d{4}\([A-Z]{3,4}\)/g;
function docRefs(s: string): string[] {
  return [...new Set(s.match(DOCREF_RE) ?? [])];
}
function procRefs(s: string): string[] {
  return [...new Set(s.match(PROCREF_RE) ?? [])];
}

/** Procedural agenda items that are not real debates. */
const PROCEDURAL =
  /^(opening|resumption|closure|approval of (the )?minutes|agenda|voting time|explanations of vote|composition of|membership of|order of business|corrigend|written statements|verification of credentials|formal sitting|one-minute speeches|documents received|transfers of appropriations|texts of agreements|decisions concerning|signature of acts)/i;

// --- transcript model ------------------------------------------------------

interface Node {
  o: number;
  mepId: number | null;
  nom: string;
  role: string | null;
  lg: string | null;
  s: string | null;
  t: string;
}

interface Block {
  id: string;
  sittingUid: string;
  term: number;
  date: string;
  titre: string;
  type: "debate" | "vote" | "other";
  startOrdre: number;
  endOrdre: number;
  nIntervention: number;
  docRefs: string[];
  procedureRef: string | null;
  procedureTitle: string | null;
  matchKind: string | null;
}

interface ParsedSitting {
  uid: string;
  term: number;
  date: string;
  dateLong: string | null;
  nodes: Node[];
  blocks: Omit<Block, "procedureRef" | "procedureTitle" | "matchKind">[];
}

function attrs(tag: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of tag.matchAll(/([A-Z_-]+)="([^"]*)"/gi)) out[m[1].toUpperCase()] = m[2];
  return out;
}

function speakerName(lib: string): string {
  // LIB is "First | Last" (pipe-separated); some have no pipe.
  return clean(lib.replace(/\s*\|\s*/g, " "));
}

function roleOf(emphas: string, nom: string): string | null {
  let t = inlineText(emphas).replace(/[.–\-\s]+$/g, "").trim();
  if (nom && t.toLowerCase().startsWith(nom.toLowerCase())) {
    t = t.slice(nom.length).replace(/^[,\s.]+/, "").trim();
  }
  return t || null;
}

/** Parse one CRE verbatim XML into a structured sitting. */
function parseSitting(id: string, xml: string): ParsedSitting | null {
  const m = id.match(/^CRE-(\d+)-(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const term = Number(m[1]);
  const date = `${m[2]}-${m[3]}-${m[4]}`;

  // The first CHAPTER (NUMBER="0") header carries the human date as TL-CHAP.
  let dateLong: string | null = null;
  const firstEn = xml.match(
    /<TL-CHAP\s+VL="EN"[^>]*>([\s\S]*?)<\/TL-CHAP/i,
  );
  if (firstEn) dateLong = clean(firstEn[1]) || null;

  const nodes: Node[] = [];
  const blocks: ParsedSitting["blocks"] = [];
  let ordre = 0;
  let bi = 0;

  // Walk each CHAPTER in document order.
  const chapterRe = /<CHAPTER\b[^>]*>([\s\S]*?)(?=<CHAPTER\b|<\/DEBATS)/gi;
  for (const ch of xml.matchAll(chapterRe)) {
    const body = ch[1];
    const titleM = body.match(/<TL-CHAP\s+VL="EN"\s+TYPE="([^"]*)"[^>]*>([\s\S]*?)<\/TL-CHAP/i);
    const rawType = (titleM?.[1] ?? "OTHER").toUpperCase();
    const titre = titleM ? clean(titleM[2]) : "";

    const startOrdre = ordre + 1;
    let nInt = 0;
    let lastAnchor: string | null = null;

    // Scan NUMERO anchors and INTERVENTION blocks in order. Note the EP DTD
    // closes tags as "</INTERVENTION\n>" (whitespace before ">"), hence \s*>.
    const partRe = /<NUMERO\b([^>]*)>|<INTERVENTION\b[^>]*>([\s\S]*?)<\/INTERVENTION\s*>/gi;
    for (const p of body.matchAll(partRe)) {
      if (p[2] === undefined) {
        const a = attrs(p[0]);
        if (a.ACT) lastAnchor = a.ACT;
        continue;
      }
      const inner = p[2] ?? "";
      const oratM = inner.match(/<ORATEUR\b([^>]*)>([\s\S]*?)<\/ORATEUR\s*>/i);
      const a = oratM ? attrs(oratM[1]) : {};
      const nom = a.LIB ? speakerName(a.LIB) : "";
      const mepId = a.MEPID && a.MEPID !== "0" ? Number(a.MEPID) : null;
      const lg = a.LG || null;
      const emphas = oratM?.[2].match(/<EMPHAS\b[^>]*>([\s\S]*?)<\/EMPHAS\s*>/i)?.[1] ?? "";
      const role = roleOf(emphas, nom);
      const paras = [...inner.matchAll(/<PARA\b[^>]*>([\s\S]*?)<\/PARA\s*>/gi)].map(
        (x) => inlineText(x[1]),
      );
      const t = paras.filter(Boolean).join("\n");
      if (!nom && !t) continue;
      ordre++;
      nInt++;
      nodes.push({ o: ordre, mepId, nom, role, lg, s: lastAnchor, t });
    }

    if (nInt === 0 && !titre) continue;
    const isVote = rawType === "VOTE";
    const isProcedural = !titre || PROCEDURAL.test(titre) || nInt < 2;
    const type: Block["type"] = isVote ? "vote" : isProcedural ? "other" : "debate";

    // Refs: from the title, plus the opening (chair-announced) interventions.
    const opening = nodes
      .slice(startOrdre - 1, startOrdre - 1 + Math.min(nInt, 2))
      .map((n) => n.t)
      .join("\n");
    const titleRefs = docRefs(titre);
    const allDocRefs = [...new Set([...titleRefs, ...docRefs(opening)])];
    const allProcRefs = [...new Set([...procRefs(titre), ...procRefs(opening)])];

    blocks.push({
      id: `${id}-${String(bi++).padStart(2, "0")}`,
      sittingUid: id,
      term,
      date,
      titre,
      type,
      startOrdre,
      endOrdre: ordre,
      nIntervention: nInt,
      docRefs: allDocRefs,
    });
    // stash title/proc refs for linking (kept off the public type)
    (blocks[blocks.length - 1] as any).__procRefs = allProcRefs;
    (blocks[blocks.length - 1] as any).__titleRefs = titleRefs;
  }

  return { uid: id, term, date, dateLong, nodes, blocks };
}

// --- procedure linking -----------------------------------------------------

interface ProcInfo {
  procedureRef: string;
  procedureTitle: string | null;
  procedureType: string | null;
  term: number;
}

/** Build doc-ref -> procedure and procedure-ref -> info maps from the votes index. */
async function loadProcedureMaps(): Promise<{
  byDocRef: Map<string, ProcInfo>;
  byProcRef: Map<string, ProcInfo>;
}> {
  const idx: any[] = JSON.parse(await readFile(VOTES_INDEX, "utf8"));
  const byDocRef = new Map<string, ProcInfo>();
  const byProcRef = new Map<string, ProcInfo>();
  for (const e of idx) {
    if (!e.procedureReference) continue;
    const info: ProcInfo = {
      procedureRef: e.procedureReference,
      procedureTitle: e.procedureTitle ?? e.title ?? null,
      procedureType: e.procedureType ?? null,
      term: e.term,
    };
    if (!byProcRef.has(e.procedureReference)) byProcRef.set(e.procedureReference, info);
    const ref: string | null = e.reference;
    if (ref) {
      const variants = new Set([ref, ref.replace(/^RC-/, "")]);
      for (const v of variants) if (!byDocRef.has(v)) byDocRef.set(v, info);
    }
  }
  return { byDocRef, byProcRef };
}

function linkBlock(
  block: any,
  byDocRef: Map<string, ProcInfo>,
  byProcRef: Map<string, ProcInfo>,
): { ref: string; title: string | null; type: string | null; kind: string } | null {
  const titleRefs: string[] = block.__titleRefs ?? [];
  const procRefList: string[] = block.__procRefs ?? [];
  // 1. explicit procedure reference in title/opening.
  for (const pr of procRefList) {
    const info = byProcRef.get(pr);
    if (info)
      return { ref: info.procedureRef, title: info.procedureTitle, type: info.procedureType, kind: "procref" };
  }
  // 2. document reference in the title (strongest doc-ref signal).
  for (const dr of titleRefs) {
    const info = byDocRef.get(dr) ?? byDocRef.get(dr.replace(/^RC-/, ""));
    if (info)
      return { ref: info.procedureRef, title: info.procedureTitle, type: info.procedureType, kind: "title-docref" };
  }
  // 3. document reference in the opening interventions.
  for (const dr of block.docRefs as string[]) {
    const info = byDocRef.get(dr) ?? byDocRef.get(dr.replace(/^RC-/, ""));
    if (info)
      return { ref: info.procedureRef, title: info.procedureTitle, type: info.procedureType, kind: "para-docref" };
  }
  return null;
}

// --- main ------------------------------------------------------------------

async function main() {
  console.log("== Fetching European Parliament debate verbatim reports (CRE) ==");
  const { byDocRef, byProcRef } = await loadProcedureMaps();
  console.log(`  ${byProcRef.size} procedures / ${byDocRef.size} doc-refs from the votes dataset`);

  const sittingsIndex: any[] = [];
  const allBlocks: Block[] = [];
  let parsedCount = 0;
  let xmlMissing = 0;

  const probe = await loadProbe();
  console.log(`  years: ${YEARS.join(", ")}`);

  for (const year of YEARS) {
    console.log(`\nYear ${year}:`);
    let offset = 0;
    const ids: string[] = [];
    for (;;) {
      const url = `${API}/documents?work-type=CRE_PLENARY&year=${year}&limit=100&offset=${offset}`;
      const page = await getJson(url);
      const data: any[] = page?.data ?? [];
      for (const d of data) if (d.identifier) ids.push(d.identifier);
      if (data.length < 100) break;
      offset += 100;
    }
    console.log(`  ${ids.length} CRE listed`);

    for (const id of ids) {
      if (probe[id] === "none") {
        xmlMissing++;
        continue;
      }
      const xml = await getXml(id);
      if (!xml) {
        probe[id] = "none";
        await saveProbe(probe);
        xmlMissing++;
        continue;
      }
      probe[id] = "ok";
      await saveProbe(probe);
      const s = parseSitting(id, xml);
      if (!s || !s.nodes.length) continue;
      parsedCount++;
      process.stdout.write(`  + ${id} (${s.nodes.length} interv, ${s.blocks.length} items)\n`);

      const linked: Block[] = s.blocks.map((b) => {
        const m = b.type === "debate" ? linkBlock(b, byDocRef, byProcRef) : null;
        const { __procRefs, __titleRefs, ...rest } = b as any;
        return {
          ...(rest as Block),
          procedureRef: m?.ref ?? null,
          procedureTitle: m?.title ?? null,
          matchKind: m?.kind ?? null,
        };
      });
      const hasLinked = linked.some((b) => b.procedureRef);
      allBlocks.push(...linked);

      sittingsIndex.push({
        uid: s.uid,
        term: s.term,
        date: s.date,
        dateLong: s.dateLong,
        nIntervention: s.nodes.length,
        nBlocks: s.blocks.length,
      });

      if (hasLinked) {
        await writeJson(CACHE, `sittings/${s.term}/${s.uid}.json`, {
          uid: s.uid,
          term: s.term,
          date: s.date,
          dateLong: s.dateLong,
          interventions: s.nodes,
        });
      }
    }
  }

  // Group linked debate blocks into procedures.
  const byProcedure = new Map<string, any>();
  for (const b of allBlocks) {
    if (!b.procedureRef) continue;
    let d = byProcedure.get(b.procedureRef);
    if (!d) {
      const info = byProcRef.get(b.procedureRef);
      d = {
        ref: b.procedureRef,
        titre: b.procedureTitle ?? info?.procedureTitle ?? null,
        procedureType: info?.procedureType ?? null,
        term: b.term,
        blocks: [] as string[],
        sittings: new Set<string>(),
        firstDate: b.date,
        lastDate: b.date,
        nIntervention: 0,
      };
      byProcedure.set(b.procedureRef, d);
    }
    d.blocks.push(b.id);
    d.sittings.add(b.sittingUid);
    d.nIntervention += b.nIntervention;
    if (b.date < d.firstDate) d.firstDate = b.date;
    if (b.date > d.lastDate) d.lastDate = b.date;
  }
  const procedureDebats = [...byProcedure.values()]
    .map((d) => ({ ...d, sittings: [...d.sittings].sort() }))
    .sort((a, b) => (a.lastDate < b.lastDate ? 1 : -1));

  sittingsIndex.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

  await writeJson(OUT, "sittings-index.json", sittingsIndex);
  await writeJson(OUT, "blocks-index.json", allBlocks);
  await writeJson(OUT, "procedure-debats.json", procedureDebats);

  if (!existsSync(resolve(OUT, "summaries-index.json"))) {
    await writeJson(OUT, "summaries-index.json", []);
  }

  const debateBlocks = allBlocks.filter((b) => b.type === "debate").length;
  const linkedBlocks = allBlocks.filter((b) => b.procedureRef).length;
  const terms = [...new Set(sittingsIndex.map((s) => s.term))].sort();
  await writeJson(OUT, "meta.json", {
    source: "https://data.europarl.europa.eu (EP Open Data Portal)",
    license: "© European Union — European Parliament, verbatim reports of proceedings (CRE).",
    generatedFrom: `${API}/documents?work-type=CRE_PLENARY (final multilingual XML per sitting)`,
    model: "(summaries: see summaries-index.json)",
    terms,
    totals: {
      sittings: sittingsIndex.length,
      blocks: allBlocks.length,
      debates: debateBlocks,
      procedures: procedureDebats.length,
      summaries: 0,
    },
    note:
      "Debate blocks are agenda items (CHAPTER) of the verbatim, linked to the " +
      "legislative procedures of @hemicycle/european-parliament-votes by the " +
      "EP document / procedure references printed in the item title and the " +
      "chair's opening words. Only sittings whose FINAL multilingual XML is " +
      "published are parsed (the provisional verbatim ships as PDF/DOCX only). " +
      "Full transcripts of linked sittings are cached under .cache/sittings and " +
      "shipped (for summarized procedures) by summarize.ts.",
  });

  console.log(
    `\nDone. ${parsedCount} sittings parsed (${xmlMissing} without XML), ` +
      `${allBlocks.length} blocks (${debateBlocks} debates, ${linkedBlocks} linked), ` +
      `${procedureDebats.length} procedures with debate.`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
