/**
 * Fetch & parse French National Assembly debate transcripts ("comptes rendus
 * intégraux", Sycéron XML), segment each sitting into per-text debate blocks,
 * link those blocks to the law projects (dossiers) of the votes dataset, and
 * emit the index files consumed by `@hemicycle/french-assemblee-nationale-debats`.
 *
 * Source: https://data.assemblee-nationale.fr — one `syseron.xml.zip` per
 * legislature, each containing one XML per séance.
 *
 * Outputs:
 *   - data/seances-index.json       lightweight record for every sitting
 *   - data/blocks-index.json        every debate block, with its dossier link
 *   - data/dossier-debats.json      law -> debate blocks / sittings
 *   - data/meta.json                provenance + counts
 *   - data/summaries-index.json     created empty if absent (filled by summarize.ts)
 *   - .cache/seances/<leg>/<uid>.json   full transcript per sitting (gitignored
 *                                       working set; the slice that gets shipped
 *                                       is copied to public/seances by summarize.ts)
 *
 * Re-run with:  yarn fetch
 */
import { unzipSync, strFromU8 } from "fflate";
import { XMLParser } from "fast-xml-parser";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, "../data");
const CACHE = resolve(HERE, "../.cache");
const VOTES_INDEX = resolve(
  HERE,
  "../../french-assemblee-nationale-votes/data/scrutins-index.json",
);
const BASE = "https://data.assemblee-nationale.fr/static/openData/repository";

const LEGISLATURES: { leg: number; url: string }[] = [
  { leg: 16, url: `${BASE}/16/vp/syceronbrut/syseron.xml.zip` },
  { leg: 17, url: `${BASE}/17/vp/syceronbrut/syseron.xml.zip` },
];

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  textNodeName: "#text",
  trimValues: true,
  // Keep the inner content of <texte> verbatim (with its inline <italique>,
  // <exposant>, <br> markup) so word order is preserved; we strip tags below.
  stopNodes: ["*.texte"],
});

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

/** Decode the handful of XML entities that survive a stopNode. */
function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m);
}

/** Turn the raw inner XML of a <texte> stopNode into clean spoken text. */
function textOf(raw: unknown): string {
  if (raw == null) return "";
  // A <texte> with attributes (e.g. stime=) becomes { "@_…": …, "#text": "<raw>" }.
  if (typeof raw === "object" && !Array.isArray(raw)) {
    raw = (raw as Record<string, unknown>)["#text"] ?? "";
  }
  let s = typeof raw === "string" ? raw : String(raw);
  s = s.replace(/<br\s*\/?>/gi, " ").replace(/<[^>]+>/g, "");
  return decodeEntities(s);
}

// --- generic helpers -------------------------------------------------------

async function download(url: string): Promise<Uint8Array> {
  process.stdout.write(`  GET ${url}\n`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return new Uint8Array(await res.arrayBuffer());
}

function unzipXml(buf: Uint8Array): { path: string; xml: string }[] {
  const files = unzipSync(buf);
  const out: { path: string; xml: string }[] = [];
  for (const [path, bytes] of Object.entries(files)) {
    if (!path.endsWith(".xml")) continue;
    out.push({ path, xml: strFromU8(bytes) });
  }
  return out;
}

async function writeJson(base: string, rel: string, data: unknown) {
  const path = resolve(base, rel);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(data));
}

/** Recursively flatten an element's mixed content into plain text. */
function flatten(node: unknown): string {
  if (node == null) return "";
  if (typeof node === "string" || typeof node === "number")
    return String(node);
  if (Array.isArray(node)) return node.map(flatten).join("");
  let out = "";
  for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
    if (k.startsWith("@_")) continue; // attribute
    out += flatten(v);
  }
  return out;
}

function clean(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

/** Normalize a title for fuzzy matching (strip accents, drop apostrophes). */
function norm(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/['’]/g, "") // join elided words: d'Arcelor -> darcelor
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// --- transcript model ------------------------------------------------------

interface Node {
  o: number; // ordre_absolu_seance
  a: string | null; // id_acteur
  nom: string; // orateur display name
  role: string | null;
  code: string | null;
  s: string | null; // id_syceron
  t: string; // text
}

interface Block {
  id: string;
  seanceUid: string;
  leg: number;
  date: string;
  titre: string;
  startOrdre: number;
  endOrdre: number;
  nIntervention: number;
  dossierRef: string | null;
  matchKind: string | null;
}

interface ParsedSeance {
  uid: string;
  seanceRef: string | null;
  leg: number;
  date: string;
  dateLong: string | null;
  session: string | null;
  numSeance: string | null;
  president: string | null;
  nodes: Node[];
  blocks: Omit<Block, "dossierRef" | "matchKind">[];
}

function isoDate(d: string | null): string {
  if (!d || d.length < 8) return "";
  return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
}

/** Walk the parsed tree, collecting every element that carries an ordre. */
function collectNodes(obj: unknown, into: Map<number, Node>) {
  if (obj == null || typeof obj !== "object") return;
  if (Array.isArray(obj)) {
    for (const v of obj) collectNodes(v, into);
    return;
  }
  const rec = obj as Record<string, any>;
  const ordreRaw = rec["@_ordre_absolu_seance"];
  if (ordreRaw != null) {
    const o = Number(ordreRaw);
    if (!into.has(o)) {
      let nom = "";
      const ors = rec.orateurs?.orateur;
      const first = Array.isArray(ors) ? ors[0] : ors;
      if (first?.nom != null) nom = clean(flatten(first.nom));
      into.set(o, {
        o,
        a: rec["@_id_acteur"] ?? null,
        nom,
        role: rec["@_roledebat"] ?? null,
        code: rec["@_code_grammaire"] ?? null,
        s: rec["@_id_syceron"] ?? null,
        t: clean(textOf(rec.texte)),
      });
    }
  }
  for (const [k, v] of Object.entries(rec)) {
    if (k.startsWith("@_") || k === "#text") continue;
    collectNodes(v, into);
  }
}

function parseSeance(xml: string): ParsedSeance | null {
  const doc = parser.parse(xml);
  const cr = doc.compteRendu;
  if (!cr) return null;
  const meta = cr.metadonnees ?? {};
  const uid = String(cr.uid ?? "");
  const leg = Number(meta.legislature ?? 0);

  const map = new Map<number, Node>();
  collectNodes(cr.contenu, map);
  const nodes = [...map.values()].sort((a, b) => a.o - b.o);

  // Segment into blocks at every TITRE_TEXTE_DISCUSSION header.
  const blocks: ParsedSeance["blocks"] = [];
  let cur: ParsedSeance["blocks"][number] | null = null;
  const date = isoDate(String(meta.dateSeance ?? ""));
  let bi = 0;
  const close = (endOrdre: number) => {
    if (cur) {
      cur.endOrdre = endOrdre;
      blocks.push(cur);
    }
  };
  for (const n of nodes) {
    if (n.code === "TITRE_TEXTE_DISCUSSION") {
      close(n.o - 1);
      const titre = clean(n.t);
      cur = {
        id: `${uid}-${String(bi++).padStart(2, "0")}`,
        seanceUid: uid,
        leg,
        date,
        titre,
        startOrdre: n.o,
        endOrdre: n.o,
        nIntervention: 0,
      };
    } else if (cur && n.a) {
      cur.nIntervention++;
    }
  }
  close(nodes.length ? nodes[nodes.length - 1].o : 0);

  const presNode = meta.sommaire?.presidentSeance;
  const president = presNode ? clean(flatten(presNode)) : null;

  return {
    uid,
    seanceRef: cr.seanceRef ? String(cr.seanceRef) : null,
    leg,
    date,
    dateLong: meta.dateSeanceJour ? String(meta.dateSeanceJour) : null,
    session: meta.session ? String(meta.session) : null,
    numSeance: meta.numSeance != null ? String(meta.numSeance) : null,
    president,
    nodes,
    blocks,
  };
}

// --- dossier linking -------------------------------------------------------

interface DossierRef {
  ref: string;
  titre: string;
  norm: string;
  leg: number;
  minDate: string;
  maxDate: string;
}

async function loadDossiers(): Promise<DossierRef[]> {
  const idx: any[] = JSON.parse(await readFile(VOTES_INDEX, "utf8"));
  const map = new Map<string, DossierRef>();
  for (const s of idx) {
    if (!s.dossierRef || !s.dossierTitre) continue;
    const d = map.get(s.dossierRef);
    if (!d) {
      map.set(s.dossierRef, {
        ref: s.dossierRef,
        titre: s.dossierTitre,
        norm: norm(s.dossierTitre),
        leg: s.legislature,
        minDate: s.date,
        maxDate: s.date,
      });
    } else {
      if (s.date < d.minDate) d.minDate = s.date;
      if (s.date > d.maxDate) d.maxDate = s.date;
    }
  }
  return [...map.values()];
}

function dayDiff(a: string, b: string): number {
  return Math.abs((Date.parse(a) - Date.parse(b)) / 86_400_000);
}

/** Best dossier match for a debate block, or null. */
function linkBlock(
  titre: string,
  leg: number,
  date: string,
  dossiers: DossierRef[],
): { ref: string; kind: string } | null {
  const nb = norm(titre);
  if (nb.length < 6) return null;
  let best: { ref: string; kind: string; score: number } | null = null;
  for (const d of dossiers) {
    if (d.leg !== leg) continue;
    // Date window: within ~120 days of the dossier's vote span (debates precede
    // the solemn vote; budget debates run for weeks).
    const within =
      date >= d.minDate && date <= d.maxDate
        ? true
        : Math.min(dayDiff(date, d.minDate), dayDiff(date, d.maxDate)) <= 120;
    if (!within) continue;
    const nd = d.norm;
    let score = 0;
    let kind = "";
    if (nb === nd) {
      score = 1;
      kind = "exact";
    } else if (
      (nd.includes(nb) || nb.includes(nd)) &&
      Math.min(nb.length, nd.length) >= 15
    ) {
      score = 0.9;
      kind = "substr";
    } else {
      const A = new Set(nb.split(" "));
      const B = new Set(nd.split(" "));
      if (A.size >= 3 && B.size >= 3) {
        let inter = 0;
        for (const t of A) if (B.has(t)) inter++;
        const j = inter / (A.size + B.size - inter);
        if (j >= 0.55) {
          score = 0.5 + j * 0.4;
          kind = `jaccard${j.toFixed(2)}`;
        }
      }
    }
    if (score > 0 && (!best || score > best.score)) best = { ref: d.ref, kind, score };
  }
  return best ? { ref: best.ref, kind: best.kind } : null;
}

// --- main ------------------------------------------------------------------

async function main() {
  console.log("== Fetching Assemblée nationale debate transcripts ==");
  const dossiers = await loadDossiers();
  console.log(`  ${dossiers.length} dossiers from the votes dataset`);

  const seancesIndex: any[] = [];
  const allBlocks: Block[] = [];
  let parsedCount = 0;

  for (const { leg, url } of LEGISLATURES) {
    console.log(`\nLegislature ${leg}: ${url}`);
    let entries: { path: string; xml: string }[];
    try {
      entries = unzipXml(await download(url));
    } catch (e) {
      console.warn(`  ! skipped (${(e as Error).message})`);
      continue;
    }
    console.log(`  ${entries.length} séances`);
    for (const { xml } of entries) {
      const s = parseSeance(xml);
      if (!s || !s.uid) continue;
      parsedCount++;

      // Link this séance's blocks; keep only séances with a linked debate.
      const linked: Block[] = s.blocks.map((b) => {
        const m = linkBlock(b.titre, b.leg, b.date, dossiers);
        return { ...b, dossierRef: m?.ref ?? null, matchKind: m?.kind ?? null };
      });
      const hasLinked = linked.some((b) => b.dossierRef);
      allBlocks.push(...linked);

      seancesIndex.push({
        uid: s.uid,
        seanceRef: s.seanceRef,
        leg: s.leg,
        date: s.date,
        dateLong: s.dateLong,
        session: s.session,
        numSeance: s.numSeance,
        president: s.president,
        nIntervention: s.nodes.filter((n) => n.a).length,
        nBlocks: s.blocks.length,
      });

      // Cache the full transcript for séances that touch a tracked law.
      if (hasLinked) {
        await writeJson(CACHE, `seances/${s.leg}/${s.uid}.json`, {
          uid: s.uid,
          seanceRef: s.seanceRef,
          leg: s.leg,
          date: s.date,
          dateLong: s.dateLong,
          session: s.session,
          numSeance: s.numSeance,
          president: s.president,
          interventions: s.nodes,
        });
      }
    }
  }

  // Group linked blocks into dossiers.
  const byDossier = new Map<string, any>();
  for (const b of allBlocks) {
    if (!b.dossierRef) continue;
    let d = byDossier.get(b.dossierRef);
    if (!d) {
      const dr = dossiers.find((x) => x.ref === b.dossierRef);
      d = {
        ref: b.dossierRef,
        titre: dr?.titre ?? null,
        leg: b.leg,
        blocks: [] as string[],
        seances: new Set<string>(),
        firstDate: b.date,
        lastDate: b.date,
        nIntervention: 0,
      };
      byDossier.set(b.dossierRef, d);
    }
    d.blocks.push(b.id);
    d.seances.add(b.seanceUid);
    d.nIntervention += b.nIntervention;
    if (b.date < d.firstDate) d.firstDate = b.date;
    if (b.date > d.lastDate) d.lastDate = b.date;
  }
  const dossierDebats = [...byDossier.values()]
    .map((d) => ({ ...d, seances: [...d.seances].sort() }))
    .sort((a, b) => (a.lastDate < b.lastDate ? 1 : -1));

  seancesIndex.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

  await writeJson(OUT, "seances-index.json", seancesIndex);
  await writeJson(OUT, "blocks-index.json", allBlocks);
  await writeJson(OUT, "dossier-debats.json", dossierDebats);

  // Don't clobber existing summaries; create an empty index on first run.
  if (!existsSync(resolve(OUT, "summaries-index.json"))) {
    await writeJson(OUT, "summaries-index.json", []);
  }

  const linkedBlocks = allBlocks.filter((b) => b.dossierRef).length;
  await writeJson(OUT, "meta.json", {
    source: "https://data.assemblee-nationale.fr",
    license: "Licence Ouverte / Open Licence (Etalab)",
    generatedFrom: LEGISLATURES.map((l) => l.url),
    model: "(summaries: see summaries-index.json)",
    legislatures: LEGISLATURES.map((l) => l.leg),
    totals: {
      seances: seancesIndex.length,
      blocks: allBlocks.length,
      dossiers: dossierDebats.length,
      summaries: 0,
    },
    note:
      "Debate blocks are segmented at TITRE_TEXTE_DISCUSSION headers and linked " +
      "to dossiers of @hemicycle/french-assemblee-nationale-votes by normalized " +
      "title match within a date window. Full transcripts of linked séances are " +
      "cached under .cache/seances and shipped (for summarized laws) by summarize.ts.",
  });

  console.log(
    `\nDone. ${parsedCount} séances parsed, ${allBlocks.length} blocks ` +
      `(${linkedBlocks} linked), ${dossierDebats.length} dossiers with debate.`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
