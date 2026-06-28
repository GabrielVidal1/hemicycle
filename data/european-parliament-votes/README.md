# @hemicycle/european-parliament-votes

Roll-call vote data of the **European Parliament** for parliamentary terms
**8–10** (July 2014 → today), normalized for displaying how every MEP and
political group voted on a given text — and ready to colour a
[Hemicycle](https://hemicycle.dev) seat chart.

Built for [`hemicycle.dev`](https://hemicycle.dev).

## What's in it

| Dataset       | Shipped as           | Contents                                                                                         |
| ------------- | -------------------- | ------------------------------------------------------------------------------------------------ |
| **Index**     | `loadVotesIndex()`   | a lightweight record for **every** roll-call vote: date, title, procedure, result, totals        |
| **Detail**    | `loadYearDetail(yr)` | full **per-MEP nominal** breakdown for the substantive **"main"** votes, split per calendar year |
| **Detail**    | `loadTermDetail(t)`  | the same, concatenated for a whole parliamentary term (8, 9 or 10)                               |
| **Groups**    | `loadGroups()`       | `groupCode → { label, abbrev, color }`                                                           |
| **MEPs**      | `loadMeps()`         | `memberId → { firstName, lastName, country }`                                                    |
| **Countries** | `loadCountries()`    | `countryCode → label`                                                                            |
| **Meta**      | `loadMeta()`         | provenance, counts, per-term/year totals, source URLs                                            |

The published JS bundle is tiny — the (large) JSON datasets are loaded lazily so
consumers code-split them instead of inlining the whole dataset.

## Coverage

This package spans **terms 8, 9 and 10** (≈ July 2014 → today) from **two**
sources, merged into one normalized dataset:

- **Terms 9–10** (from **2 July 2019**) come from
  [HowTheyVote.eu](https://howtheyvote.eu) (CC BY 4.0).
- **Term 8** (≈ July 2014 → April 2019) comes directly from the
  [EP Open Data Portal](https://data.europarl.europa.eu)'s per-sitting
  **"Results of roll-call votes"** XML (`PV-8-*-RCV`), which HowTheyVote does not
  cover. MEP ids are crosswalked to the same id space as terms 9–10 (the portal's
  person id, which HowTheyVote also uses), so MEPs who served across terms are a
  single entry — not duplicated. The term-8 political groups that have no term-9
  successor (**ALDE**, **EFDD**, **ENF**) are added under their own codes.

See `meta.json` for exact counts, the live date range, and the term-8 provenance
block (`meta.term8`).

> **Why only "main" votes get per-MEP detail.** There are tens of thousands of
> roll-call votes; shipping per-MEP detail for _all_ of them would be hundreds of
> MB. As with the French package, full per-MEP nominal detail is shipped only for
> the substantive **"main"** votes (the final vote on each text — `isMain` in the
> index; for term 8 this is derived from the sub-vote subject since the term-8 XML
> carries no `is_main` flag) — but the index lists **every** vote with its
> for/against/abstention totals.

## Usage

```ts
import {
  loadVotesIndex,
  loadYearDetail,
  loadGroups,
  loadMeps,
  listProcedures,
  seatColors,
  mepName,
} from "@hemicycle/european-parliament-votes";

// Browse every vote, or group them into distinct procedures (dossiers)
const index = await loadVotesIndex();
const procedures = listProcedures(index); // newest first

// Render one vote on a Hemicycle chart (colour by position)
const votes2024 = await loadYearDetail(2024);
const vote = votes2024.find((v) => v.isMain);
const colorsByPosition = seatColors(vote); // memberId -> hex (for/against/abstention)

const groups = await loadGroups();
const colorsByGroup = seatColors(vote, { by: "group", groups });

// Who voted what
const meps = await loadMeps();
for (const v of vote.votes) {
  console.log(mepName(meps[v.m]), "→", v.v); // F=for A=against B=abstention D=did not vote
}
```

## Regenerating the data

The committed JSON under `data/` is generated from two open sources (no inputs
are committed): [HowTheyVote.eu's open data](https://github.com/HowTheyVote/data)
for terms 9–10 and the [EP Open Data Portal](https://data.europarl.europa.eu) for
term 8.

```bash
yarn fetch   # downloads the CSV archives + term-8 RCV XML, rebuilds data/
yarn build   # bundle with tsdown
```

See [`scripts/fetch-data.ts`](scripts/fetch-data.ts) (terms 9–10 + orchestration)
and [`scripts/fetch-term8.ts`](scripts/fetch-term8.ts) (term 8).

## Licence

Code: MIT. Data — terms 9–10: © [HowTheyVote.eu](https://howtheyvote.eu),
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/); term 8: European
Parliament Open Data Portal, © European Union — both derived from the European
Parliament's public roll-call vote results.
