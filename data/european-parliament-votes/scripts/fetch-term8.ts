/**
 * Fetch & normalize European Parliament **term 8** (2014-07 → 2019-04) roll-call
 * votes from the EP's own Open Data Portal — the source HowTheyVote.eu does NOT
 * cover (it starts at term 9, July 2019).
 *
 * Why a second source: HowTheyVote's CSV export only goes back to term 9. The
 * authoritative machine-readable term-8 nominal data is the EP's per-sitting
 * "Results of roll-call votes" XML, published as the `PV-8-YYYY-MM-DD-RCV`
 * document. The doceo www host (www.europarl.europa.eu/doceo/...RCV_EN.xml) is
 * behind an AWS-WAF JS challenge that blocks datacentre IPs, but the EP
 * **Open Data Portal** (data.europarl.europa.eu) serves the very same XML as a
 * document *distribution* with NO WAF challenge:
 *
 *   1. GET /api/v2/meetings?year=YYYY                    -> plenary sitting days
 *   2. GET /api/v2/documents/PV-8-<date>-RCV             -> the RCV doc + its
 *        distribution paths (…-RCV-FNL_fr.xml is the consolidated nominal XML)
 *   3. GET /distribution/…/PV-8-<date>-RCV-FNL_fr.xml    -> the actual XML
 *
 * The XML schema (`PV.RollCallVoteResults`):
 *   <RollCallVote.Result Identifier="79481" Date="2017-04-05 12:07:20">
 *     <RollCallVote.Description.Text> RC-B8-0237/2017 - Am 18 </…>
 *     <Result.For Number="73">
 *       <Result.PoliticalGroup.List Identifier="ECR">
 *         <PoliticalGroup.Member.Name MepId="6667">Marias</…>
 *   …with Result.Against / Result.Abstention blocks of the same shape.
 *
 * Two id-namespace gotchas, both handled here:
 *   - The XML `MepId` is the EP's *legacy* MEP-card id, NOT the Open Data Portal
 *     person id that HowTheyVote uses (e.g. Goerens is XML MepId 1793 but ODP /
 *     HowTheyVote id 840). So we crosswalk every XML member to an ODP person id
 *     by name (surname + given-name, Unicode-folded), using the full term-8 ODP
 *     MEP roster (base + incoming + outgoing). This keeps the MEP id space
 *     **identical** to the existing terms-9/10 data so ids merge, not duplicate.
 *   - The XML group ids are the term-8 group labels (PPE, S&D, ALDE, Verts/ALE,
 *     GUE/NGL, ECR, EFDD, ENF, NI). Continuous groups reuse the existing codes
 *     (PPE→EPP, S&D→SD, Verts/ALE→GREEN_EFA, GUE/NGL→GUE_NGL, ECR, NI); the
 *     term-8-only groups (ALDE, EFDD, ENF) are added as their own codes so we
 *     don't anachronistically relabel them as their term-9 successors.
 *
 * Sizing: as with the rest of the package we ship full per-MEP nominal detail
 * only for the substantive "main" votes (final vote / single vote / resolution /
 * consent), and index every roll-call vote with its for/against/abstention
 * totals. is_main is not a field in the term-8 XML, so it is derived from the
 * sub-vote subject (see isMainSubject).
 */

import {
  mkdirSync,
  readFileSync,
  writeFileSync,
  existsSync,
  readdirSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createHash } from "node:crypto";

const execFileP = promisify(execFile);

const ODP = "https://data.europarl.europa.eu/api/v2";
const ODP_DIST = "https://data.europarl.europa.eu";

// Cache downloaded sitting XML on disk: the redmap backend is slow/flaky, so a
// re-run (or a resumed run after a transient failure) reuses what was fetched.
const CACHE_DIR = join(tmpdir(), "ep-term8-rcv-cache");
mkdirSync(CACHE_DIR, { recursive: true });

/** Term 8 ran from the constitutive sitting (1 July 2014) to 18 April 2019. */
export const TERM8_FROM = "2014-07-01";
export const TERM8_TO = "2019-07-01"; // exclusive upper bound (term 9 starts 2019-07-02)

export interface Term8GroupResult {
  g: string;
  members: number;
  for: number;
  against: number;
  abstention: number;
  didNotVote: number;
  majority: string;
}
export interface Term8Nominal {
  m: number;
  v: "F" | "A" | "B";
  g: string | null;
}
export interface Term8Vote {
  /** EP RollCallVote.Result identifier (term-8 id space; disjoint from term-9). */
  id: number;
  timestamp: string;
  term: 8;
  title: string | null;
  reference: string | null;
  amendmentSubject: string | null;
  isMain: boolean;
  procedureReference: string | null;
  procedureTitle: string | null;
  procedureType: string | null;
  result: string | null;
  totals: {
    for: number | null;
    against: number | null;
    abstention: number | null;
    didNotVote: number | null;
  };
  groups: Term8GroupResult[];
  votes: Term8Nominal[];
}

export interface Term8Result {
  votes: Term8Vote[];
  /** ODP person id -> { firstName, lastName, country } for term-8 members. */
  meps: Record<
    string,
    {
      firstName: string | null;
      lastName: string | null;
      country: string | null;
    }
  >;
  /** group code -> { label, abbrev } for term-8-only groups (ALDE/EFDD/ENF). */
  groups: Record<string, { label: string; abbrev: string }>;
  /** diagnostics surfaced to the caller / meta. */
  stats: {
    sittings: number;
    sittingsWithRcv: number;
    votes: number;
    mainVotes: number;
    unresolvedCells: number;
    unresolvedNames: string[];
    rosterSize: number;
    from: string | null;
    to: string | null;
  };
}

// --- HTTP helpers (ODP is occasionally flaky; retry a few times) ------------

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const JSON_CACHE = join(CACHE_DIR, "json");
mkdirSync(JSON_CACHE, { recursive: true });

/** One quick probe of the ODP JSON API: is it reachable (not IP-blocked)? */
async function apiReachable(url: string): Promise<boolean> {
  try {
    const { stdout } = await execFileP("curl", [
      "-s",
      "-L",
      "--http1.1",
      "--max-time",
      "20",
      "-o",
      "/dev/null",
      "-w",
      "%{http_code}",
      "-H",
      "Accept: application/ld+json",
      url,
    ]);
    return stdout.trim() === "200";
  } catch {
    return false;
  }
}

/**
 * GET a JSON-LD ODP endpoint via `curl --http1.1`, cached on disk. The ODP's
 * JSON API (data.europarl.europa.eu/api/v2) rate-limits/IP-bans bursts with 403
 * and intermittently 500s; HTTP/1.1 via curl + disk caching + patient backoff
 * makes the (large, one-time) crawl resumable and gentle. `null` on 404/204.
 */
async function getJson(url: string): Promise<any> {
  const key = createHash("sha1").update(url).digest("hex");
  const hit = join(JSON_CACHE, `${key}.json`);
  const miss = join(JSON_CACHE, `${key}.none`);
  if (existsSync(hit)) return JSON.parse(readFileSync(hit, "utf8"));
  if (existsSync(miss)) return null;

  const out = join(JSON_CACHE, `${key}.tmp`);
  for (let attempt = 0; attempt < 8; attempt++) {
    try {
      const { stdout } = await execFileP("curl", [
        "-s",
        "-L",
        "--http1.1",
        "--max-time",
        "60",
        "-H",
        "Accept: application/ld+json",
        "-o",
        out,
        "-w",
        "%{http_code}",
        url,
      ]);
      const code = stdout.trim();
      if (code === "404" || code === "204") {
        writeFileSync(miss, "");
        return null;
      }
      if (code !== "200" || !existsSync(out)) throw new Error(`HTTP ${code}`);
      const body = readFileSync(out, "utf8");
      const parsed = JSON.parse(body); // throws if not JSON (e.g. WAF HTML)
      writeFileSync(hit, body);
      return parsed;
    } catch (e) {
      if (attempt === 7) throw e;
      // long backoff: an IP rate-limit (403) clears on the order of a minute.
      await sleep(2000 * (attempt + 1) + Math.random() * 1000);
    }
  }
}

/**
 * Download a distribution XML to disk via `curl --http1.1`. The redmap backend
 * behind the distribution URLs returns 500 to Node's (HTTP/2) `fetch` but serves
 * correctly over HTTP/1.1, which curl negotiates — so the XML must be fetched
 * with curl. Returns the file contents, or null on a genuine 404.
 */
async function curlDownload(
  url: string,
  outFile: string,
): Promise<string | null> {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const { stdout } = await execFileP("curl", [
        "-s",
        "-L",
        "--http1.1",
        "--max-time",
        "60",
        "-o",
        outFile,
        "-w",
        "%{http_code}",
        url,
      ]);
      const code = stdout.trim();
      if (code === "404") return null;
      if (code === "200" && existsSync(outFile)) {
        const body = readFileSync(outFile, "utf8");
        if (body.length > 200 && body.includes("<")) return body;
      }
      throw new Error(`curl HTTP ${code}`);
    } catch (e) {
      if (attempt === 4) throw e;
      await sleep(800 * (attempt + 1));
    }
  }
  return null;
}

// --- Name folding & matching ------------------------------------------------

const FOLD: Record<string, string> = {
  Ł: "L",
  ł: "l",
  Ø: "O",
  ø: "o",
  Đ: "D",
  đ: "d",
  Æ: "AE",
  æ: "ae",
  ß: "ss",
};
/** Fold a name to an [A-Z] key: strip diacritics, special letters, punctuation. */
function fold(s: string | null | undefined): string {
  if (!s) return "";
  return s
    .split("")
    .map((c) => FOLD[c] ?? c)
    .join("")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z]/g, "");
}

/** ODP citizenship authority URI -> 3-letter country code (e.g. …/AUT -> AUT). */
function countryCode(uri: string | undefined): string | null {
  if (!uri) return null;
  const c = uri.split("/").pop() || "";
  return /^[A-Z]{3}$/.test(c) ? c : null;
}

// --- Term-8 political-group code mapping ------------------------------------

/** XML group id -> normalized group code used across the dataset. */
const GROUP_CODE: Record<string, string> = {
  PPE: "EPP",
  "S&D": "SD",
  ALDE: "ALDE",
  "Verts/ALE": "GREEN_EFA",
  "GUE/NGL": "GUE_NGL",
  ECR: "ECR",
  EFDD: "EFDD",
  ENF: "ENF",
  NI: "NI",
};
/** Term-8-only groups added to the reference (the others reuse existing codes). */
const TERM8_GROUPS: Record<string, { label: string; abbrev: string }> = {
  ALDE: {
    label: "Alliance of Liberals and Democrats for Europe",
    abbrev: "ALDE",
  },
  EFDD: { label: "Europe of Freedom and Direct Democracy", abbrev: "EFDD" },
  ENF: { label: "Europe of Nations and Freedom", abbrev: "ENF" },
};

// --- "main" (substantive) vote detection from the sub-vote subject ----------

/**
 * The term-8 RCV XML carries no is_main flag, so derive it from the FR subject.
 * Final / substantive ballots use these labels; amendment and split votes use
 * "Am N", "§ N", "Considérant", "Am N=M" etc.
 */
function isMainSubject(subject: string | null): boolean {
  if (!subject) return true; // bare whole-text vote
  const s = subject.toLowerCase();
  return (
    /vote unique/.test(s) ||
    /\br[ée]solution\b/.test(s) ||
    /approbation/.test(s) ||
    /ensemble du texte/.test(s) ||
    /proposition de la commission/.test(s) ||
    /proposition de r[ée]solution/.test(s) ||
    /projet du conseil/.test(s) ||
    /projet de r[ée]solution/.test(s) ||
    /recommandation/.test(s) ||
    /demande de/.test(s)
  );
}

// --- ODP MEP roster (id crosswalk + reference) ------------------------------

interface RosterEntry {
  id: string;
  firstName: string | null;
  lastName: string | null;
  givenFold: string;
  familyFold: string;
  fullFold: string; // family+given folded (handles "Le Pen Marine")
}

function addRosterEntry(
  seen: Map<string, RosterEntry>,
  id: string,
  given: string,
  family: string,
) {
  if (!id || seen.has(id)) return;
  seen.set(id, {
    id,
    firstName: given || null,
    lastName: family || null,
    givenFold: fold(given),
    familyFold: fold(family),
    fullFold: fold(family + given),
  });
}

/**
 * Fallback roster fetch through the r.jina.ai reader proxy (a different egress
 * IP), used when the ODP API IP-blocks this host. The proxy renders the term-8
 * MEP list RDF as text; each MEP is a block of indented lines containing, in
 * order, the display label, given name, family name, the numeric id, and the
 * uppercased sort label — which is all we need for the id↔name crosswalk.
 */
async function fetchRosterViaJina(seen: Map<string, RosterEntry>) {
  const endpoints = [
    "https://data.europarl.europa.eu/api/v2/meps?parliamentary-term=8%26limit=3000",
    "https://data.europarl.europa.eu/api/v2/meps/show-incoming?parliamentary-term=8%26limit=3000",
    "https://data.europarl.europa.eu/api/v2/meps/show-outgoing?parliamentary-term=8%26limit=3000",
  ];
  for (const ep of endpoints) {
    let md = "";
    for (let attempt = 0; attempt < 5 && !md; attempt++) {
      try {
        const { stdout } = await execFileP(
          "curl",
          ["-s", "-L", "--max-time", "120", `https://r.jina.ai/${ep}`],
          { maxBuffer: 64 * 1024 * 1024 },
        );
        if (stdout.includes("\n")) md = stdout;
      } catch {
        await sleep(1500 * (attempt + 1));
      }
    }
    // collapse to non-empty trimmed lines, then walk: a 5-line MEP block is
    // [label, given, family, <digits id>, SORTLABEL]. Anchor on the id line.
    const lines = md
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    for (let i = 0; i < lines.length; i++) {
      if (/^\d{1,7}$/.test(lines[i]) && i >= 3) {
        const id = lines[i];
        const family = lines[i - 1];
        const given = lines[i - 2];
        // sanity: next line should look like an uppercase sort label
        addRosterEntry(seen, id, given, family);
      }
    }
  }
}

async function fetchRoster(): Promise<{
  byFamily: Map<string, RosterEntry[]>;
  byFull: Map<string, RosterEntry[]>;
  all: RosterEntry[];
  /** true if the direct ODP API is blocked (roster came from the proxy). */
  apiBlocked: boolean;
}> {
  const urls = [
    `${ODP}/meps?parliamentary-term=8&limit=3000`,
    `${ODP}/meps/show-incoming?parliamentary-term=8&limit=3000`,
    `${ODP}/meps/show-outgoing?parliamentary-term=8&limit=3000`,
  ];
  const seen = new Map<string, RosterEntry>();
  // Quick direct probe (1 attempt): if the ODP API answers, crawl it directly;
  // if it's IP-blocked, skip straight to the proxy without long retry storms.
  const directUp = await apiReachable(urls[0]);
  let directOk = false;
  if (directUp) {
    try {
      for (const u of urls) {
        const j = await getJson(u);
        for (const m of j?.data ?? []) {
          const family =
            m.familyName || (m.label || "").split(" ").slice(-1)[0];
          addRosterEntry(seen, m.identifier, m.givenName || "", family || "");
        }
      }
      directOk = seen.size > 0;
    } catch (e) {
      console.warn(`  direct roster fetch failed (${(e as Error).message})`);
    }
  } else {
    console.warn("  ODP API not reachable; using r.jina.ai proxy for roster");
  }
  if (!directOk) {
    await fetchRosterViaJina(seen);
    console.log(`  roster via r.jina.ai proxy: ${seen.size} MEPs`);
  }
  const all = [...seen.values()];
  const byFamily = new Map<string, RosterEntry[]>();
  const byFull = new Map<string, RosterEntry[]>();
  const push = (map: Map<string, RosterEntry[]>, k: string, e: RosterEntry) => {
    if (!k) return;
    const a = map.get(k) ?? [];
    a.push(e);
    map.set(k, a);
  };
  for (const e of all) {
    push(byFamily, e.familyFold, e);
    push(byFull, e.fullFold, e);
    push(byFull, fold((e.lastName || "") + (e.firstName || "")), e);
  }
  return { byFamily, byFull, all, apiBlocked: !directOk };
}

/**
 * Resolve one XML member (surname text + group) to an ODP person id.
 * The XML name is usually just a surname ("Goerens") but sometimes
 * "Surname Firstname" ("Le Pen Marine") to disambiguate. Strategy:
 *  1. exact family match (unique) ;
 *  2. full "family+given" / "given+family" match (disambiguates collisions) ;
 *  3. prefix/contains match on the family name (handles compound surnames like
 *     "Aguilera García" in XML vs "Aguilera" in ODP).
 */
function resolveMember(
  rawName: string,
  roster: { byFamily: Map<string, RosterEntry[]>; all: RosterEntry[] },
): RosterEntry | null {
  const f = fold(rawName);
  // exact family
  const fam = roster.byFamily.get(f);
  if (fam && fam.length === 1) return fam[0];
  // full family+given (any permutation of folded tokens already covered by fullFold)
  // try treating the whole folded string as family+given
  for (const e of roster.all) {
    if (e.fullFold === f) return e;
  }
  // collision on family: too ambiguous without more signal -> skip resolve here,
  // caller tries contains fallback below.
  if (fam && fam.length > 1) {
    // can't safely pick; leave to contains heuristic (will also be ambiguous)
    return null;
  }
  // prefix / contains fallback (compound surnames)
  let best: RosterEntry | null = null;
  let bestLen = 0;
  for (const e of roster.all) {
    if (!e.familyFold) continue;
    if (f.startsWith(e.familyFold) || e.familyFold.startsWith(f)) {
      // prefer the longest matching family fold
      if (e.familyFold.length > bestLen) {
        best = e;
        bestLen = e.familyFold.length;
      } else if (e.familyFold.length === bestLen) {
        best = null; // tie -> ambiguous
      }
    }
  }
  return best;
}

// --- XML parsing ------------------------------------------------------------

function attr(tag: string, name: string): string | null {
  const m = tag.match(new RegExp(`${name}="([^"]*)"`));
  return m ? m[1] : null;
}

/** Decode the few XML entities that appear in names/subjects. */
function decode(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n));
}

interface ParsedVote {
  id: number;
  timestamp: string;
  reference: string | null;
  subject: string | null;
  cells: { mepName: string; group: string; pos: "F" | "A" | "B" }[];
  counts: { F: number; A: number; B: number };
}

/** "DD/MM/YYYY HH:MM:SS(.fff)" (used in 2019 descriptions) -> ISO timestamp. */
function parseDescTimestamp(text: string): string | null {
  const m = text.match(/(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2}):(\d{2})/);
  if (!m) return null;
  return `${m[3]}-${m[2]}-${m[1]} ${m[4]}:${m[5]}:${m[6]}`;
}

/**
 * Parse a single sitting's RollCallVoteResults XML into raw vote records.
 *
 * Two XML schema variants exist across term 8:
 *  - 2014–2018: `<RollCallVote.Result Identifier="79481" Date="…">` with
 *    `<PoliticalGroup.Member.Name MepId="…">` members.
 *  - 2019: no per-vote `Identifier` (just `Number="1."` and a `Date`), and
 *    members are `<Member.Name MepId="…">` (no `PoliticalGroup.` prefix); the
 *    vote time lives in the description text ("… 11/03/2019 17:19:57").
 * Both are handled here. When no `Identifier` is present a stable synthetic id
 * is derived from the date + sequence (offset into a range disjoint from the EP
 * identifier space and from term-9 ids).
 */
function parseSittingXml(xml: string, sittingDate: string): ParsedVote[] {
  const out: ParsedVote[] = [];
  const resultRe =
    /<RollCallVote\.Result\b([^>]*)>([\s\S]*?)<\/RollCallVote\.Result>/g;
  let rm: RegExpExecArray | null;
  let seq = 0;
  while ((rm = resultRe.exec(xml))) {
    const head = rm[1];
    const body = rm[2];
    seq++;

    // description: "<reference> - <subject>" (may also carry the vote time)
    const dm = body.match(
      /<RollCallVote\.Description\.Text>([\s\S]*?)<\/RollCallVote\.Description\.Text>/,
    );
    let reference: string | null = null;
    let subject: string | null = null;
    let descTime: string | null = null;
    if (dm) {
      let text = decode(dm[1].replace(/<[^>]+>/g, " "))
        .replace(/\s+/g, " ")
        .trim();
      descTime = parseDescTimestamp(text);
      if (descTime)
        text = text.replace(/\d{2}\/\d{2}\/\d{4}\s+[\d:.]+/, "").trim();
      const dash = text.indexOf(" - ");
      if (dash >= 0) {
        reference = text.slice(0, dash).trim() || null;
        subject = text.slice(dash + 3).trim() || null;
      } else {
        reference = text || null;
      }
    }

    const dateAttr = attr(head, "Date") || "";
    let timestamp =
      descTime ||
      (dateAttr.includes(":")
        ? dateAttr
        : `${dateAttr || sittingDate} 00:00:00`);

    const idAttr = attr(head, "Identifier");
    // synthetic id for the 2019 schema: 900000000 + YYYYMMDD*100 + seq — large
    // enough to never collide with real EP ids (<~200k) or term-9 ids.
    const id = idAttr
      ? Number(idAttr)
      : 900000000 + Number(sittingDate.replace(/-/g, "")) * 100 + seq;
    if (!id || Number.isNaN(id)) continue;

    const cells: ParsedVote["cells"] = [];
    const counts = { F: 0, A: 0, B: 0 };
    for (const [blockName, pos] of [
      ["Result.For", "F"],
      ["Result.Against", "A"],
      ["Result.Abstention", "B"],
    ] as const) {
      const bRe = new RegExp(
        `<${blockName}\\b([^>]*)>([\\s\\S]*?)</${blockName}>`,
      );
      const bm = body.match(bRe);
      if (!bm) continue;
      const listRe =
        /<Result\.PoliticalGroup\.List\b([^>]*)>([\s\S]*?)<\/Result\.PoliticalGroup\.List>/g;
      let lm: RegExpExecArray | null;
      while ((lm = listRe.exec(bm[2]))) {
        // the group Identifier may be entity-encoded ("S&amp;D"); decode before mapping
        const group = decode(attr(lm[1], "Identifier") || "");
        // members are <PoliticalGroup.Member.Name> (2014-18) or <Member.Name> (2019)
        const memRe =
          /<(?:PoliticalGroup\.)?Member\.Name\b([^>]*)>([\s\S]*?)<\/(?:PoliticalGroup\.)?Member\.Name>/g;
        let mm: RegExpExecArray | null;
        while ((mm = memRe.exec(lm[2]))) {
          const name = decode(mm[2].replace(/<[^>]+>/g, " "))
            .replace(/\s+/g, " ")
            .trim();
          cells.push({ mepName: name, group, pos });
          counts[pos]++;
        }
      }
    }
    out.push({ id, timestamp, reference, subject, cells, counts });
  }
  return out;
}

// --- Sitting enumeration ----------------------------------------------------

/** All term-8 plenary sitting dates (YYYY-MM-DD) in [TERM8_FROM, TERM8_TO). */
async function term8SittingDates(): Promise<string[]> {
  const dates = new Set<string>();
  try {
    for (let year = 2014; year <= 2019; year++) {
      const j = await getJson(`${ODP}/meetings?year=${year}&limit=400`);
      for (const m of j?.data ?? []) {
        const id: string = m.activity_id || "";
        const d = id.replace("MTG-PL-", "");
        if (/^\d{4}-\d{2}-\d{2}$/.test(d) && d >= TERM8_FROM && d < TERM8_TO)
          dates.add(d);
      }
    }
  } catch (e) {
    console.warn(`  meetings API failed (${(e as Error).message})`);
  }
  // Fallback: if the meetings API is blocked but we've previously cached the
  // per-sitting probes on disk, derive the sitting list from the cache so a
  // resumed run still covers every day we already know about.
  if (dates.size === 0) {
    for (const f of readdirSync(CACHE_DIR)) {
      const m = f.match(/^(\d{4}-\d{2}-\d{2})\.(xml|none)$/);
      if (m && m[1] >= TERM8_FROM && m[1] < TERM8_TO) dates.add(m[1]);
    }
    console.warn(`  using ${dates.size} sitting dates from the on-disk cache`);
  }
  return [...dates].sort();
}

/** Resolve a sitting's consolidated RCV XML (…-RCV-FNL_*.xml) and download it. */
async function fetchSittingRcvXml(date: string): Promise<string | null> {
  const cacheFile = join(CACHE_DIR, `${date}.xml`);
  const missFile = join(CACHE_DIR, `${date}.none`);
  if (existsSync(cacheFile)) return readFileSync(cacheFile, "utf8");
  if (existsSync(missFile)) return null; // cached "no RCV that day"

  const doc = await getJson(
    `${ODP}/documents/PV-8-${date}-RCV?format=application%2Fld%2Bjson`,
  );
  if (!doc?.data) {
    writeFileSync(missFile, "");
    return null;
  }
  const text = JSON.stringify(doc);
  // prefer the FNL consolidated XML (any language — the XML is language-neutral
  // except subject text, for which FR is what we parse for isMain markers).
  const matches = [
    ...new Set(text.match(/distribution\/[^"']+RCV-FNL_[a-z]{2}\.xml/g) || []),
  ];
  const pick =
    matches.find((p) => p.endsWith("_fr.xml")) ||
    matches.find((p) => p.endsWith("_en.xml")) ||
    matches[0];
  if (!pick) {
    writeFileSync(missFile, "");
    return null;
  }
  // curl (HTTP/1.1) writes straight into the cache file; Node fetch 500s here.
  const xml = await curlDownload(`${ODP_DIST}/${pick}`, cacheFile);
  if (!xml) writeFileSync(missFile, "");
  return xml;
}

// --- Main entry -------------------------------------------------------------

/**
 * @param knownCountry  MEP id -> country code already known from another source
 *   (HowTheyVote, for MEPs who also served in terms 9-10). For those we skip the
 *   per-MEP ODP detail call entirely — it more than halves the API crawl and so
 *   the risk of tripping the portal's IP rate-limit.
 */
export async function fetchTerm8(
  knownCountry: Map<string, string | null> = new Map(),
): Promise<Term8Result> {
  console.log(
    "\n== Fetching European Parliament term-8 roll-call votes (EP Open Data Portal) ==",
  );

  console.log("Roster: term-8 MEPs (base + incoming + outgoing)");
  const roster = await fetchRoster();
  console.log(`  ${roster.all.length} term-8 MEPs in roster`);

  console.log("Sittings: enumerating term-8 plenary dates");
  const dates = await term8SittingDates();
  console.log(
    `  ${dates.length} candidate sitting days ${dates[0]} … ${dates[dates.length - 1]}`,
  );

  // resolve ODP person detail lazily (for first-name + country) and cache it
  const detailCache = new Map<
    string,
    {
      firstName: string | null;
      lastName: string | null;
      country: string | null;
    }
  >();
  async function mepDetail(
    id: string,
    fallbackFirst: string | null,
    fallbackLast: string | null,
  ) {
    if (detailCache.has(id)) return detailCache.get(id)!;
    let country: string | null = null;
    let firstName = fallbackFirst;
    let lastName = fallbackLast;
    try {
      const j = await getJson(
        `${ODP}/meps/${id}?format=application%2Fld%2Bjson`,
      );
      const d = j?.data?.[0] ?? j?.data ?? j;
      if (d) {
        country = countryCode(d.citizenship);
        firstName = d.givenName ?? firstName;
        lastName = d.familyName ?? lastName;
      }
    } catch {
      /* keep fallbacks */
    }
    const rec = { firstName, lastName, country };
    detailCache.set(id, rec);
    return rec;
  }

  const votes: Term8Vote[] = [];
  const usedMepIds = new Set<string>();
  let sittingsWithRcv = 0;
  let unresolvedCells = 0;
  const unresolvedNames = new Map<string, number>();

  // Download every sitting's RCV XML with bounded concurrency, then parse +
  // normalize sequentially (parsing is CPU-bound and deterministic).
  const SITTING_CONCURRENCY = 4;
  const xmlByDate = new Map<string, string>();
  {
    const queue = [...dates];
    let fetched = 0;
    const failed: string[] = [];
    async function dlWorker() {
      while (queue.length) {
        const date = queue.shift()!;
        // A single sitting failing to download (transient ODP 500/timeout after
        // retries) must not abort the whole multi-year run — log and skip it.
        try {
          const xml = await fetchSittingRcvXml(date);
          if (xml) xmlByDate.set(date, xml);
        } catch (e) {
          failed.push(date);
          console.warn(`  ! skipped sitting ${date}: ${(e as Error).message}`);
        }
        if (++fetched % 50 === 0)
          console.log(`  …${fetched}/${dates.length} sittings probed`);
      }
    }
    await Promise.all(
      Array.from({ length: SITTING_CONCURRENCY }, () => dlWorker()),
    );
    // The redmap backend behind the distribution URLs intermittently 500s under
    // any concurrency but serves fine one-at-a-time. Retry every failed sitting
    // sequentially (concurrency 1) with patient backoff before giving up — these
    // are real data we don't want to drop.
    if (failed.length) {
      console.log(`  retrying ${failed.length} failed sittings sequentially…`);
      const stillFailed: string[] = [];
      for (const date of failed) {
        let ok = false;
        for (let attempt = 0; attempt < 5 && !ok; attempt++) {
          await sleep(1500 + attempt * 1500);
          try {
            const xml = await fetchSittingRcvXml(date);
            if (xml) {
              xmlByDate.set(date, xml);
              ok = true;
            } else {
              ok = true; // genuine 404 (no RCV that day)
            }
          } catch {
            /* retry */
          }
        }
        if (!ok) stillFailed.push(date);
      }
      if (stillFailed.length)
        console.warn(
          `  ${stillFailed.length} sittings still undownloadable: ${stillFailed.join(", ")}`,
        );
      else console.log("  all retried sittings recovered");
    }
  }

  for (const date of dates) {
    const xml = xmlByDate.get(date);
    if (!xml) continue;
    sittingsWithRcv++;
    const parsed = parseSittingXml(xml, date);

    for (const pv of parsed) {
      const groupTally = new Map<
        string,
        { for: number; against: number; abstention: number }
      >();
      const nominal: Term8Nominal[] = [];
      const subject = pv.subject;
      const main = isMainSubject(subject);
      for (const cell of pv.cells) {
        const code = GROUP_CODE[cell.group] ?? cell.group;
        let gt = groupTally.get(code);
        if (!gt)
          groupTally.set(code, (gt = { for: 0, against: 0, abstention: 0 }));
        if (cell.pos === "F") gt.for++;
        else if (cell.pos === "A") gt.against++;
        else gt.abstention++;

        if (main) {
          const entry = resolveMember(cell.mepName, roster);
          if (!entry) {
            unresolvedCells++;
            unresolvedNames.set(
              cell.mepName,
              (unresolvedNames.get(cell.mepName) ?? 0) + 1,
            );
            continue;
          }
          usedMepIds.add(entry.id);
          nominal.push({ m: Number(entry.id), v: cell.pos, g: code });
        }
      }

      const groups: Term8GroupResult[] = [...groupTally.entries()]
        .map(([g, t]) => {
          const max = Math.max(t.for, t.against, t.abstention);
          const majority =
            max === t.for
              ? "for"
              : max === t.against
                ? "against"
                : "abstention";
          return {
            g,
            members: t.for + t.against + t.abstention,
            for: t.for,
            against: t.against,
            abstention: t.abstention,
            didNotVote: 0,
            majority,
          };
        })
        .sort((a, b) => (a.g < b.g ? -1 : 1));

      votes.push({
        id: pv.id,
        timestamp: pv.timestamp,
        term: 8,
        title: pv.reference, // best available short title for term-8 votes
        reference: pv.reference,
        amendmentSubject: main ? null : subject,
        isMain: main,
        procedureReference: null,
        procedureTitle: null,
        procedureType: null,
        result: null,
        totals: {
          for: pv.counts.F,
          against: pv.counts.A,
          abstention: pv.counts.B,
          didNotVote: null,
        },
        groups,
        votes: main ? nominal : [],
      });
    }
  }
  console.log(`  parsed ${sittingsWithRcv} sittings -> ${votes.length} votes`);

  // Reference: build meps map for every resolved member (first name + country).
  // The roster already has names; only `country` needs the ODP person-detail
  // endpoint, so we only call it for MEPs whose country we don't already know
  // from another source — minimizing the API crawl.
  const meps: Term8Result["meps"] = {};
  const rosterById = new Map(roster.all.map((e) => [e.id, e]));
  const needDetail: string[] = [];
  for (const id of usedMepIds) {
    const e = rosterById.get(id);
    const known = knownCountry.get(id);
    if (known != null) {
      // country already known elsewhere; take names from the roster
      meps[id] = {
        firstName: e?.firstName ?? null,
        lastName: e?.lastName ?? null,
        country: known,
      };
    } else {
      needDetail.push(id);
    }
  }
  if (roster.apiBlocked) {
    // The ODP JSON API is IP-blocked (roster came via the proxy); the per-MEP
    // citizenship endpoint isn't reachable. Ship names from the roster with a
    // null country for these term-8-only MEPs rather than stall the build.
    console.warn(
      `  ODP API blocked: leaving country=null for ${needDetail.length} term-8-only MEPs (names still resolved)`,
    );
    for (const id of needDetail) {
      const e = rosterById.get(id);
      meps[id] = {
        firstName: e?.firstName ?? null,
        lastName: e?.lastName ?? null,
        country: null,
      };
    }
  } else {
    console.log(
      `Resolving country via ODP for ${needDetail.length}/${usedMepIds.size} term-8 MEPs (rest already known)`,
    );
    let done = 0;
    const CONCURRENCY = 3;
    const worker = async () => {
      while (needDetail.length) {
        const id = needDetail.pop()!;
        const e = rosterById.get(id);
        meps[id] = await mepDetail(
          id,
          e?.firstName ?? null,
          e?.lastName ?? null,
        );
        if (++done % 100 === 0) console.log(`  …${done} resolved`);
      }
    };
    await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
  }

  votes.sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1));
  const ts = votes.map((v) => v.timestamp).filter(Boolean);
  const result: Term8Result = {
    votes,
    meps,
    groups: TERM8_GROUPS,
    stats: {
      sittings: dates.length,
      sittingsWithRcv,
      votes: votes.length,
      mainVotes: votes.filter((v) => v.isMain).length,
      unresolvedCells,
      unresolvedNames: [...unresolvedNames.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 40)
        .map(([n, c]) => `${n} (${c})`),
      rosterSize: roster.all.length,
      from: ts.length ? ts[ts.length - 1] : null,
      to: ts.length ? ts[0] : null,
    },
  };
  console.log(
    `Term-8 done: ${votes.length} votes (${result.stats.mainVotes} main), ${usedMepIds.size} MEPs, ${unresolvedCells} unresolved nominal cells`,
  );
  return result;
}
