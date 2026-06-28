/**
 * Fetch & normalize French National Assembly (Assemblée nationale) public-ballot
 * data ("scrutins") plus the actor/organ reference, and emit the committed
 * dataset consumed by `@hemicycle/french-assemblee-nationale-votes`.
 *
 * Source: the official open data at https://data.assemblee-nationale.fr
 *   - Scrutins (one JSON file per public ballot), per legislature.
 *   - AMO30 historique: every actor (deputy) and organe (incl. political groups)
 *     across history — used to resolve names and group colours.
 *
 * Outputs (all under ../data, committed to git):
 *   - scrutins-index.json            lightweight record for EVERY scrutin (browse/search)
 *   - scrutins-detail/<leg>.json     full nominal breakdown for "law-project" scrutins
 *                                    (solemn votes ∪ motions ∪ votes tied to a dossier)
 *   - reference/groupes.json         organeRef -> { libelle, abbrev, couleur, dates }
 *   - reference/acteurs.json         acteurRef -> { nom, prenom, civ, trigramme }
 *   - meta.json                      provenance + counts
 *
 * Re-run with:  yarn fetch   (downloads ~60 MB, no inputs committed)
 */
import { unzipSync, strFromU8 } from "fflate";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, "../data");
const BASE = "https://data.assemblee-nationale.fr/static/openData/repository";

/** Legislatures covered (past ~10+ years). Older ones use a roman-numeral suffix. */
const LEGISLATURES: { leg: number; scrutinsUrl: string; start: string }[] = [
  {
    leg: 14,
    start: "2012-06",
    scrutinsUrl: `${BASE}/14/loi/scrutins/Scrutins_XIV.json.zip`,
  },
  {
    leg: 15,
    start: "2017-06",
    scrutinsUrl: `${BASE}/15/loi/scrutins/Scrutins_XV.json.zip`,
  },
  {
    leg: 16,
    start: "2022-06",
    scrutinsUrl: `${BASE}/16/loi/scrutins/Scrutins.json.zip`,
  },
  {
    leg: 17,
    start: "2024-07",
    scrutinsUrl: `${BASE}/17/loi/scrutins/Scrutins.json.zip`,
  },
];

const AMO30_URL = `${BASE}/17/amo/tous_acteurs_mandats_organes_xi_legislature/AMO30_tous_acteurs_tous_mandats_tous_organes_historique.json.zip`;

type Position = "pour" | "contre" | "abstention" | "nonVotant";

async function download(url: string): Promise<Uint8Array> {
  process.stdout.write(`  GET ${url}\n`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return new Uint8Array(await res.arrayBuffer());
}

/** Unzip in memory, returning [path, parsedJson] for every *.json entry. */
function unzipJson(buf: Uint8Array): { path: string; json: any }[] {
  const files = unzipSync(buf);
  const out: { path: string; json: any }[] = [];
  for (const [path, bytes] of Object.entries(files)) {
    if (!path.endsWith(".json")) continue;
    out.push({ path, json: JSON.parse(strFromU8(bytes)) });
  }
  return out;
}

/** Coerce the AN single-element-or-array quirk into an array. */
function arr<T>(v: T | T[] | null | undefined): T[] {
  if (v == null) return [];
  return Array.isArray(v) ? v : [v];
}

/**
 * Some scalars are serialized as `{ "#text": "value", "@xsi:type": ... }`
 * (notably actor uids in the AMO30 historique) and some as plain strings.
 * Normalize both to a plain string (or null).
 */
function txt(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === "object") {
    const t = (v as any)["#text"];
    return typeof t === "string" ? t : null;
  }
  return String(v);
}

function num(v: unknown): number | null {
  const s = txt(v);
  if (s == null || s === "") return null;
  const n = Number(s);
  return Number.isNaN(n) ? null : n;
}

interface GroupeVote {
  ref: string | null;
  membres: number | null;
  position: string | null; // positionMajoritaire
  pour: number | null;
  contre: number | null;
  abstention: number | null;
  nonVotant: number | null;
}

interface NominalVote {
  a: string | null; // acteurRef
  p: string | null; // numPlace (seat number, zero-padded)
  v: Position;
  g: string | null; // group organeRef
}

interface ScrutinDetail {
  uid: string;
  numero: string;
  legislature: number;
  date: string;
  type: string; // codeTypeVote: SPO (ordinaire), SPS (solennel), MOC (motion de censure)...
  typeLibelle: string | null;
  sort: string | null; // adopté | rejeté
  titre: string | null;
  objet: string | null;
  /** reference id of the dossier législatif (law file), when tied to one. */
  dossierRef: string | null;
  /** title of the dossier législatif — the law project's name. */
  dossierTitre: string | null;
  demandeur: string | null;
  synthese: {
    votants: number | null;
    exprimes: number | null;
    requis: number | null;
    pour: number | null;
    contre: number | null;
    abstention: number | null;
    nonVotant: number | null;
  };
  groupes: GroupeVote[];
  votes: NominalVote[];
}

type ScrutinIndexEntry = Omit<
  ScrutinDetail,
  "groupes" | "votes" | "demandeur"
> & {
  /** whether full nominal detail for this scrutin is shipped in scrutins-detail/<leg>.json */
  detail: boolean;
};

function normalizeScrutin(raw: any): ScrutinDetail {
  const s = raw.scrutin;
  const syn = s.syntheseVote ?? {};
  const dec = syn.decompte ?? {};
  const objet = s.objet ?? {};
  const ventil = s.ventilationVotes?.organe?.groupes?.groupe;

  const groupes: GroupeVote[] = [];
  const votes: NominalVote[] = [];
  for (const g of arr<any>(ventil)) {
    const v = g.vote ?? {};
    const dv = v.decompteVoix ?? {};
    groupes.push({
      ref: txt(g.organeRef),
      membres: num(g.nombreMembresGroupe),
      position: v.positionMajoritaire ?? null,
      pour: num(dv.pour),
      contre: num(dv.contre),
      abstention: num(dv.abstentions),
      nonVotant: num(dv.nonVotants),
    });
    const dn = v.decompteNominatif ?? {};
    const blocks: [string, Position][] = [
      ["pours", "pour"],
      ["contres", "contre"],
      ["abstentions", "abstention"],
      ["nonVotants", "nonVotant"],
    ];
    for (const [key, pos] of blocks) {
      const block = dn[key];
      if (!block) continue;
      for (const votant of arr<any>(block.votant)) {
        votes.push({
          a: txt(votant.acteurRef),
          p: txt(votant.numPlace),
          v: pos,
          g: txt(g.organeRef),
        });
      }
    }
  }

  return {
    uid: txt(s.uid) ?? "",
    numero: txt(s.numero) ?? "",
    legislature: Number(txt(s.legislature)),
    date: txt(s.dateScrutin) ?? "",
    type: txt(s.typeVote?.codeTypeVote) ?? "",
    typeLibelle: txt(s.typeVote?.libelleTypeVote),
    sort: txt(s.sort?.code),
    titre: txt(s.titre),
    objet: txt(objet.libelle),
    dossierRef: txt(objet.dossierLegislatif?.dossierRef),
    dossierTitre: txt(objet.dossierLegislatif?.libelle),
    demandeur: txt(s.demandeur?.texte),
    synthese: {
      votants: num(syn.nombreVotants),
      exprimes: num(syn.suffragesExprimes),
      requis: num(syn.nbrSuffragesRequis),
      pour: num(dec.pour),
      contre: num(dec.contre),
      abstention: num(dec.abstentions),
      nonVotant: num(dec.nonVotants),
    },
    groupes,
    votes,
  };
}

/** A scrutin is a "law-project" vote worth shipping full nominal detail for. */
function isLawProjectVote(s: ScrutinDetail): boolean {
  return s.type === "SPS" || s.type === "MOC" || s.dossierRef != null;
}

async function writeJson(rel: string, data: unknown) {
  const path = resolve(OUT, rel);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(data));
  return path;
}

async function buildReference() {
  console.log("Reference: AMO30 historique (actors + organes)");
  const entries = unzipJson(await download(AMO30_URL));
  const groupes: Record<string, any> = {};
  const acteurs: Record<string, any> = {};
  for (const { path, json } of entries) {
    if (path.includes("/organe/")) {
      const o = json.organe;
      if (o?.codeType !== "GP") continue; // groupe politique only
      groupes[o.uid] = {
        libelle: o.libelle ?? null,
        abbrev: o.libelleAbrege ?? o.libelleAbrev ?? null,
        couleur: o.couleurAssociee ?? null,
        legislature: o.legislature ? Number(o.legislature) : null,
        dateDebut: o.viMoDe?.dateDebut ?? null,
        dateFin: o.viMoDe?.dateFin ?? null,
      };
    } else if (path.includes("/acteur/")) {
      const a = json.acteur;
      const uid = txt(a.uid);
      if (!uid) continue;
      const id = a.etatCivil?.ident ?? {};
      acteurs[uid] = {
        nom: txt(id.nom),
        prenom: txt(id.prenom),
        civ: txt(id.civ),
        trigramme: txt(id.trigramme), // sometimes serialized as an xsi:nil object
      };
    }
  }
  await writeJson("reference/groupes.json", groupes);
  await writeJson("reference/acteurs.json", acteurs);
  console.log(
    `  ${Object.keys(groupes).length} groups, ${Object.keys(acteurs).length} actors`,
  );
  return {
    groupCount: Object.keys(groupes).length,
    actorCount: Object.keys(acteurs).length,
  };
}

async function main() {
  console.log("== Fetching Assemblée nationale scrutins ==");
  const ref = await buildReference();

  const index: ScrutinIndexEntry[] = [];
  const perLeg: {
    leg: number;
    total: number;
    detail: number;
    start: string;
  }[] = [];

  for (const { leg, scrutinsUrl, start } of LEGISLATURES) {
    console.log(`\nLegislature ${leg}: ${scrutinsUrl}`);
    const entries = unzipJson(await download(scrutinsUrl));
    // Two layouts exist: one JSON file per scrutin (`{ scrutin: {...} }`, recent
    // legislatures) and a single aggregated file (`{ scrutins: { scrutin: [...] } }`,
    // older ones like the 14th). Handle both, dedup by uid.
    const byUid = new Map<string, ScrutinDetail>();
    for (const { json } of entries) {
      const raws = json.scrutin
        ? [json.scrutin]
        : json.scrutins
          ? arr<any>(json.scrutins.scrutin)
          : [];
      for (const raw of raws) {
        const s = normalizeScrutin({ scrutin: raw });
        if (s.uid) byUid.set(s.uid, s);
      }
    }
    const scrutins = [...byUid.values()].sort((a, b) =>
      a.date < b.date ? 1 : a.date > b.date ? -1 : 0,
    );

    const detail = scrutins.filter(isLawProjectVote);
    await writeJson(`scrutins-detail/${leg}.json`, detail);

    for (const s of scrutins) {
      index.push({
        uid: s.uid,
        numero: s.numero,
        legislature: s.legislature,
        date: s.date,
        type: s.type,
        typeLibelle: s.typeLibelle,
        sort: s.sort,
        titre: s.titre,
        objet: s.objet,
        dossierRef: s.dossierRef,
        dossierTitre: s.dossierTitre,
        synthese: s.synthese,
        detail: isLawProjectVote(s),
      });
    }
    perLeg.push({ leg, total: scrutins.length, detail: detail.length, start });
    console.log(
      `  ${scrutins.length} scrutins, ${detail.length} with full nominal detail`,
    );
  }

  index.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  await writeJson("scrutins-index.json", index);

  const meta = {
    source: "https://data.assemblee-nationale.fr",
    license: "Licence Ouverte / Open Licence (Etalab)",
    generatedFrom: {
      scrutins: LEGISLATURES.map((l) => l.scrutinsUrl),
      reference: AMO30_URL,
    },
    legislatures: perLeg,
    totals: {
      scrutins: index.length,
      withDetail: index.filter((e) => e.detail).length,
      groups: ref.groupCount,
      actors: ref.actorCount,
    },
    note:
      "scrutins-index.json lists every public ballot; full per-deputy nominal detail " +
      "(scrutins-detail/<leg>.json) is shipped for solemn votes, motions, and any vote " +
      "tied to a dossier législatif. Re-generate with `yarn fetch`.",
  };
  await writeJson("meta.json", meta);

  console.log(
    `\nDone. ${index.length} scrutins indexed, ${meta.totals.withDetail} with detail.`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
