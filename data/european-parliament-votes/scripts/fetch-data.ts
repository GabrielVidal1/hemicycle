/**
 * Fetch & normalize European Parliament roll-call vote data plus the
 * member/group reference, and emit the committed dataset consumed by
 * `@hemicycle/european-parliament-votes`.
 *
 * Source: HowTheyVote.eu's structured export of EVERY EP roll-call vote,
 * published as gzipped CSVs in GitHub releases:
 *   https://github.com/HowTheyVote/data  (release asset: latest)
 *     - votes.csv               one row per roll-call vote (title, procedure, totals, result)
 *     - member_votes.csv        per-MEP nominal breakdown (how each MEP voted)
 *     - members.csv             MEP id -> name, country
 *     - groups.csv              group code -> labels
 *     - group_memberships.csv   MEP id -> group, per term (used to resolve a vote-time group)
 *     - countries.csv           country code -> label
 *
 * Coverage: HowTheyVote starts at the 9th parliamentary term (2 July 2019), so
 * it covers terms 9 and 10 (2019 -> today). Term 8 (2014-2019) is NOT in
 * HowTheyVote, so it is fetched from a SECOND source — the EP Open Data Portal's
 * per-sitting "Results of roll-call votes" XML — and merged into the same
 * normalized dataset (see scripts/fetch-term8.ts). The combined dataset spans
 * terms 8, 9 and 10.
 *
 * Outputs (all under ../data, committed to git):
 *   - votes-index.json           lightweight record for EVERY roll-call vote (browse/search)
 *   - votes-detail/<year>.json   full per-MEP nominal breakdown for "main" votes
 *                                (the substantive final votes; is_main in the source)
 *   - reference/groups.json      groupCode -> { label, abbrev, color }
 *   - reference/meps.json        memberId -> { firstName, lastName, country }
 *   - reference/countries.json   countryCode -> label
 *   - meta.json                  provenance + counts + per-term/year totals
 *
 * Why a subset for detail: there are ~24.5k roll-call votes and ~17.4M nominal
 * cells; shipping per-MEP detail for ALL of them would be ~0.5 GB. As with the
 * French package (which ships nominal detail only for law-project ballots), we
 * ship full per-MEP detail for the ~2.4k "main" votes (final/substantive
 * votes), split per year, which stays in the tens-of-MB range. The index still
 * lists every vote with its for/against/abstention totals.
 *
 * Re-run with:  yarn fetch   (downloads ~70 MB, no inputs committed)
 */
import { gunzipSync, strFromU8 } from "fflate";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { fetchTerm8, type Term8Result } from "./fetch-term8.ts";

// member_votes.csv decompresses to several hundred MB; the `fetch` npm script
// runs this with `--max-old-space-size=6144` (via NODE_OPTIONS) to fit it.

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, "../data");
const BASE = "https://github.com/HowTheyVote/data/releases/latest/download";

const ASSETS = {
  votes: `${BASE}/votes.csv.gz`,
  memberVotes: `${BASE}/member_votes.csv.gz`,
  members: `${BASE}/members.csv.gz`,
  groups: `${BASE}/groups.csv.gz`,
  groupMemberships: `${BASE}/group_memberships.csv.gz`,
  countries: `${BASE}/countries.csv.gz`,
};

/**
 * Hex colours for the EP political groups. The source ships labels but no
 * colours, so we pick the conventional ones used in the EP hemicycle.
 * Keyed by HowTheyVote's group `code`.
 */
const GROUP_COLORS: Record<string, string> = {
  EPP: "#3399FF", // European People's Party (centre-right) — blue
  SD: "#F0001C", // Progressive Alliance of Socialists & Democrats — red
  RENEW: "#FFD700", // Renew Europe (liberal) — gold/yellow
  GREEN_EFA: "#57B45F", // Greens/European Free Alliance — green
  ECR: "#0054A5", // European Conservatives and Reformists — dark blue
  ID: "#2B3856", // Identity and Democracy (former, to term 10) — dark navy
  PFE: "#1D3461", // Patriots for Europe — navy
  ESN: "#4B2E2E", // Europe of Sovereign Nations — brown
  GUE_NGL: "#B71C1C", // The Left (GUE/NGL) — dark red
  GUE_NGL_1995_0: "#B71C1C", // legacy GUE/NGL label
  NI: "#999999", // Non-attached members — grey
  // Term-8-only groups (2014–2019), added by the EP Open Data Portal source.
  ALDE: "#FFD700", // Alliance of Liberals and Democrats for Europe — gold
  EFDD: "#24B9B9", // Europe of Freedom and Direct Democracy — teal
  ENF: "#2B3856", // Europe of Nations and Freedom — dark navy
};

const POSITIONS = {
  FOR: "F",
  AGAINST: "A",
  ABSTENTION: "B",
  DID_NOT_VOTE: "D",
} as const;
type RawPosition = keyof typeof POSITIONS;
type PositionCode = (typeof POSITIONS)[RawPosition];

/** Term boundaries (EP terms each start with the constitutive sitting in July). */
function termForDate(date: string): number {
  // date: "YYYY-MM-DD..."
  if (date >= "2024-07-16") return 10;
  return 9; // HowTheyVote data starts 2019-07 (term 9)
}

async function download(url: string): Promise<Uint8Array> {
  process.stdout.write(`  GET ${url}\n`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return new Uint8Array(await res.arrayBuffer());
}

/** Download a *.csv.gz asset and return its rows as objects keyed by header. */
async function downloadCsv(url: string): Promise<Record<string, string>[]> {
  const text = strFromU8(gunzipSync(await download(url)));
  return parseCsv(text);
}

/**
 * Stream a *.csv.gz asset row-by-row via a callback, never materializing the
 * full row array. Used for member_votes.csv (~17.4M rows) which is far too big
 * to hold as parsed objects. The member_votes schema has no quoted/multiline
 * fields, so a simple line/comma split is correct and fast.
 */
async function streamCsv(
  url: string,
  onRow: (row: Record<string, string>) => void,
): Promise<void> {
  const text = strFromU8(gunzipSync(await download(url)));
  let start = 0;
  let header: string[] | null = null;
  const n = text.length;
  for (let i = 0; i <= n; i++) {
    if (i === n || text.charCodeAt(i) === 10 /* \n */) {
      if (i > start) {
        let line = text.slice(start, i);
        if (line.charCodeAt(line.length - 1) === 13 /* \r */)
          line = line.slice(0, -1);
        if (line.length > 0) {
          const cells = line.split(",");
          if (!header) {
            header = cells;
          } else {
            const obj: Record<string, string> = {};
            for (let c = 0; c < header.length; c++)
              obj[header[c]] = cells[c] ?? "";
            onRow(obj);
          }
        }
      }
      start = i + 1;
    }
  }
}

/**
 * Minimal RFC-4180 CSV parser (handles quoted fields, embedded commas,
 * doubled quotes, and embedded newlines — several vote titles span lines).
 */
function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      field = "";
      rows.push(row);
      row = [];
    } else if (c === "\r") {
      // ignore; handled by \n
    } else {
      field += c;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  if (rows.length === 0) return [];
  const header = rows[0];
  const out: Record<string, string>[] = [];
  for (let r = 1; r < rows.length; r++) {
    if (rows[r].length === 1 && rows[r][0] === "") continue; // trailing blank
    const obj: Record<string, string> = {};
    for (let c = 0; c < header.length; c++) obj[header[c]] = rows[r][c] ?? "";
    out.push(obj);
  }
  return out;
}

function num(v: string | undefined): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

function str(v: string | undefined): string | null {
  return v == null || v === "" ? null : v;
}

interface GroupResult {
  /** group code (see reference/groups.json). */
  g: string;
  members: number;
  for: number;
  against: number;
  abstention: number;
  didNotVote: number;
  /** majority position of the group: "for" | "against" | "abstention". */
  majority: string;
}

interface NominalVote {
  /** member id (see reference/meps.json). */
  m: number;
  /** position code: F=for, A=against, B=abstention, D=did not vote. */
  v: PositionCode;
  /** group code at time of vote (see reference/groups.json). */
  g: string | null;
}

interface VoteTotals {
  for: number | null;
  against: number | null;
  abstention: number | null;
  didNotVote: number | null;
}

interface VoteIndexEntry {
  id: number;
  timestamp: string;
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
  /** true when full per-MEP nominal detail ships in votes-detail/<year>.json. */
  detail: boolean;
}

type VoteDetail = Omit<VoteIndexEntry, "detail"> & {
  groups: GroupResult[];
  votes: NominalVote[];
};

async function writeJson(rel: string, data: unknown) {
  const path = resolve(OUT, rel);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(data));
  return path;
}

async function main() {
  console.log(
    "== Fetching European Parliament roll-call votes (HowTheyVote) ==",
  );

  // --- Reference: groups, members, countries, memberships -------------------
  console.log("\nReference: groups / members / countries / memberships");
  const [rawGroups, rawMembers, rawCountries, rawMemberships] =
    await Promise.all([
      downloadCsv(ASSETS.groups),
      downloadCsv(ASSETS.members),
      downloadCsv(ASSETS.countries),
      downloadCsv(ASSETS.groupMemberships),
    ]);

  const groups: Record<
    string,
    { label: string | null; abbrev: string | null; color: string | null }
  > = {};
  for (const g of rawGroups) {
    groups[g.code] = {
      label: str(g.label) ?? str(g.official_label),
      abbrev: str(g.short_label) ?? str(g.label),
      color: GROUP_COLORS[g.code] ?? null,
    };
  }

  const meps: Record<
    string,
    {
      firstName: string | null;
      lastName: string | null;
      country: string | null;
    }
  > = {};
  for (const m of rawMembers) {
    meps[m.id] = {
      firstName: str(m.first_name),
      lastName: str(m.last_name),
      country: str(m.country_code),
    };
  }

  const countries: Record<string, string> = {};
  for (const c of rawCountries) countries[c.code] = c.label ?? c.code;

  // member_id -> [ {group, start, end} ] to resolve the vote-time group.
  const membershipsByMember = new Map<
    string,
    { group: string; start: string; end: string }[]
  >();
  for (const m of rawMemberships) {
    const list = membershipsByMember.get(m.member_id) ?? [];
    list.push({
      group: m.group_code,
      start: m.start_date || "",
      end: m.end_date || "9999-12-31",
    });
    membershipsByMember.set(m.member_id, list);
  }
  function groupAt(memberId: string, date: string): string | null {
    const list = membershipsByMember.get(memberId);
    if (!list) return null;
    for (const m of list) if (date >= m.start && date <= m.end) return m.group;
    return null;
  }

  // --- Term 8 (2014-2019), from the EP Open Data Portal ---------------------
  // HowTheyVote does not cover term 8; fetch + normalize it from a second source
  // and merge into the SAME references and per-year detail files (see
  // scripts/fetch-term8.ts). Done before writing the reference files so the new
  // term-8 MEPs/groups are folded into them. Pass the country we already know
  // for cross-term MEPs (from HowTheyVote) so term-8 skips those detail lookups.
  const knownCountry = new Map<string, string | null>();
  for (const [id, m] of Object.entries(meps))
    if (m.country) knownCountry.set(id, m.country);
  const term8: Term8Result = await fetchTerm8(knownCountry);

  // merge term-8 groups (term-8-only ALDE/EFDD/ENF; the rest reuse existing codes)
  for (const [code, g] of Object.entries(term8.groups)) {
    if (!groups[code]) {
      groups[code] = {
        label: g.label,
        abbrev: g.abbrev,
        color: GROUP_COLORS[code] ?? null,
      };
    }
  }
  // merge term-8 MEPs into the shared id space (don't overwrite richer term-9
  // records; only add new ids and backfill missing fields).
  let newMeps = 0;
  for (const [id, m] of Object.entries(term8.meps)) {
    const ex = meps[id];
    if (!ex) {
      meps[id] = m;
      newMeps++;
    } else {
      if (ex.firstName == null && m.firstName) ex.firstName = m.firstName;
      if (ex.lastName == null && m.lastName) ex.lastName = m.lastName;
      if (ex.country == null && m.country) ex.country = m.country;
    }
  }
  console.log(
    `  term-8 added ${newMeps} new MEPs (merged into the shared id space)`,
  );

  await writeJson("reference/groups.json", groups);
  await writeJson("reference/meps.json", meps);
  await writeJson("reference/countries.json", countries);
  console.log(
    `  ${Object.keys(groups).length} groups, ${Object.keys(meps).length} MEPs, ${Object.keys(countries).length} countries`,
  );

  // --- Votes ----------------------------------------------------------------
  console.log("\nVotes: votes.csv");
  const rawVotes = await downloadCsv(ASSETS.votes);

  const voteById = new Map<string, VoteIndexEntry>();
  const index: VoteIndexEntry[] = [];
  for (const v of rawVotes) {
    const timestamp = v.timestamp || "";
    const date = timestamp.slice(0, 10);
    const isMain = v.is_main === "True";
    const entry: VoteIndexEntry = {
      id: Number(v.id),
      timestamp,
      term: termForDate(date),
      title: str(v.display_title),
      reference: str(v.reference),
      amendmentSubject: str(v.amendment_subject),
      isMain,
      procedureReference: str(v.procedure_reference),
      procedureTitle: str(v.procedure_title),
      procedureType: str(v.procedure_type),
      result: str(v.result),
      totals: {
        for: num(v.count_for),
        against: num(v.count_against),
        abstention: num(v.count_abstention),
        didNotVote: num(v.count_did_not_vote),
      },
      detail: isMain, // full nominal detail shipped for "main" votes
    };
    index.push(entry);
    voteById.set(v.id, entry);
  }

  // --- Member votes (per-MEP nominal cells) ---------------------------------
  // Stream the big CSV row-by-row, keeping only cells for "main" votes, and
  // accumulate both the per-MEP list and the per-group tallies per vote.
  console.log("\nMember votes: member_votes.csv (filtered to main votes)");

  interface Acc {
    votes: NominalVote[];
    groups: Map<
      string,
      { for: number; against: number; abstention: number; didNotVote: number }
    >;
  }
  const acc = new Map<string, Acc>();
  let cells = 0;
  await streamCsv(ASSETS.memberVotes, (mv) => {
    const entry = voteById.get(mv.vote_id);
    if (!entry || !entry.detail) return;
    const pos = POSITIONS[mv.position as RawPosition];
    if (!pos) return;
    cells++;
    const date = entry.timestamp.slice(0, 10);
    // Prefer the group recorded on the cell; fall back to membership lookup.
    const g = str(mv.group_code) ?? groupAt(mv.member_id, date);
    let a = acc.get(mv.vote_id);
    if (!a) {
      a = { votes: [], groups: new Map() };
      acc.set(mv.vote_id, a);
    }
    a.votes.push({ m: Number(mv.member_id), v: pos, g });
    if (g) {
      let gt = a.groups.get(g);
      if (!gt)
        a.groups.set(
          g,
          (gt = { for: 0, against: 0, abstention: 0, didNotVote: 0 }),
        );
      if (pos === "F") gt.for++;
      else if (pos === "A") gt.against++;
      else if (pos === "B") gt.abstention++;
      else gt.didNotVote++;
    }
  });
  console.log(`  ${cells} nominal cells across ${acc.size} main votes`);

  // --- Assemble detail records, split per year ------------------------------
  const detailByYear = new Map<string, VoteDetail[]>();
  for (const entry of index) {
    if (!entry.detail) continue;
    const a = acc.get(String(entry.id));
    const groupsArr: GroupResult[] = [];
    if (a) {
      for (const [code, t] of a.groups) {
        const max = Math.max(t.for, t.against, t.abstention);
        const majority =
          max === t.for ? "for" : max === t.against ? "against" : "abstention";
        groupsArr.push({
          g: code,
          members: t.for + t.against + t.abstention + t.didNotVote,
          for: t.for,
          against: t.against,
          abstention: t.abstention,
          didNotVote: t.didNotVote,
          majority,
        });
      }
      groupsArr.sort((x, y) => (x.g < y.g ? -1 : 1));
    }
    const { detail: _d, ...rest } = entry;
    const record: VoteDetail = {
      ...rest,
      groups: groupsArr,
      votes: a ? a.votes : [],
    };
    const year = entry.timestamp.slice(0, 4) || "unknown";
    const list = detailByYear.get(year) ?? [];
    list.push(record);
    detailByYear.set(year, list);
  }

  // --- Merge term-8 votes into the index + per-year detail ------------------
  // Term-8 ids are a disjoint id space from term 9/10, but dedup defensively so
  // a year file is never produced from only one source. Term-8 votes from early
  // 2019 sittings land in votes-detail/2019.json alongside the term-9 2019 ones.
  const seenIds = new Set(index.map((e) => e.id));
  let term8Indexed = 0;
  let term8Detailed = 0;
  for (const v of term8.votes) {
    if (seenIds.has(v.id)) continue;
    seenIds.add(v.id);
    const indexEntry: VoteIndexEntry = {
      id: v.id,
      timestamp: v.timestamp,
      term: v.term,
      title: v.title,
      reference: v.reference,
      amendmentSubject: v.amendmentSubject,
      isMain: v.isMain,
      procedureReference: v.procedureReference,
      procedureTitle: v.procedureTitle,
      procedureType: v.procedureType,
      result: v.result,
      totals: v.totals,
      detail: v.isMain, // ship full nominal detail for main votes (same policy)
    };
    index.push(indexEntry);
    term8Indexed++;
    if (v.isMain) {
      const { detail: _omit, ...rest } = indexEntry;
      const record: VoteDetail = {
        ...rest,
        groups: v.groups,
        votes: v.votes,
      };
      const year = v.timestamp.slice(0, 4) || "unknown";
      const list = detailByYear.get(year) ?? [];
      list.push(record);
      detailByYear.set(year, list);
      term8Detailed++;
    }
  }
  console.log(
    `  merged ${term8Indexed} term-8 votes into the index (${term8Detailed} with per-MEP detail)`,
  );

  const years = [...detailByYear.keys()].sort();
  for (const y of years) {
    const list = detailByYear.get(y)!;
    list.sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1));
    await writeJson(`votes-detail/${y}.json`, list);
  }

  // index newest first
  index.sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1));
  await writeJson("votes-index.json", index);

  // --- Per-term & per-year totals + meta ------------------------------------
  const perTerm = new Map<number, { total: number; detail: number }>();
  const perYear = new Map<string, { total: number; detail: number }>();
  for (const e of index) {
    const t = perTerm.get(e.term) ?? { total: 0, detail: 0 };
    t.total++;
    if (e.detail) t.detail++;
    perTerm.set(e.term, t);
    const y = e.timestamp.slice(0, 4) || "unknown";
    const yy = perYear.get(y) ?? { total: 0, detail: 0 };
    yy.total++;
    if (e.detail) yy.detail++;
    perYear.set(y, yy);
  }

  const term8Cells = term8.votes.reduce((n, v) => n + v.votes.length, 0);
  const dates = index.map((e) => e.timestamp).filter(Boolean);
  const meta = {
    source: "https://github.com/HowTheyVote/data",
    sourceSite: "https://howtheyvote.eu",
    sourceTerm8: "https://data.europarl.europa.eu (EP Open Data Portal)",
    license:
      "Terms 9-10: CC BY 4.0, © HowTheyVote.eu. Term 8: European Parliament Open Data Portal (Results of roll-call votes, PV-8-*-RCV), © European Union.",
    generatedFrom: {
      ...ASSETS,
      term8RollCallVotes:
        "https://data.europarl.europa.eu/api/v2/documents/PV-8-{date}-RCV -> distribution …-RCV-FNL_fr.xml",
      term8Meps:
        "https://data.europarl.europa.eu/api/v2/meps?parliamentary-term=8",
    },
    coverage: {
      from: dates.length ? dates[dates.length - 1] : null,
      to: dates.length ? dates[0] : null,
      terms: [...perTerm.keys()].sort((a, b) => a - b),
      note:
        "Terms 9-10 (2 July 2019 onward) come from HowTheyVote.eu. Term 8 " +
        `(${term8.stats.from ?? "?"} … ${term8.stats.to ?? "?"}) is sourced ` +
        "directly from the European Parliament Open Data Portal's per-sitting " +
        "'Results of roll-call votes' XML (PV-8-*-RCV), which HowTheyVote does not cover.",
    },
    terms: [...perTerm.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([term, t]) => ({ term, ...t })),
    years: [...perYear.entries()]
      .sort((a, b) => (a[0] < b[0] ? -1 : 1))
      .map(([year, y]) => ({ year, ...y })),
    totals: {
      votes: index.length,
      withDetail: index.filter((e) => e.detail).length,
      nominalCells: cells + term8Cells,
      groups: Object.keys(groups).length,
      meps: Object.keys(meps).length,
      countries: Object.keys(countries).length,
    },
    term8: {
      sittingsWithVotes: term8.stats.sittingsWithRcv,
      votes: term8.stats.votes,
      mainVotes: term8.stats.mainVotes,
      nominalCells: term8Cells,
      unresolvedCells: term8.stats.unresolvedCells,
    },
    note:
      "votes-index.json lists every roll-call vote with its for/against/abstention totals; " +
      "full per-MEP nominal detail (votes-detail/<year>.json) is shipped for the substantive " +
      "'main' votes (is_main in the source; for term 8 derived from the sub-vote subject) to " +
      "keep the committed dataset to a sane size. Re-generate with `yarn fetch`.",
  };
  await writeJson("meta.json", meta);

  console.log(
    `\nDone. ${index.length} votes indexed, ${meta.totals.withDetail} with full nominal detail.`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
