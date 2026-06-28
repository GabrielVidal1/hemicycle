# @hemicycle/european-parliament-votes

Roll-call vote data of the **European Parliament** for parliamentary terms
**9–10** (July 2019 → today), normalized for displaying how every MEP and
political group voted on a given text — and ready to colour a
[Hemicycle](https://hemicycle.dev) seat chart.

Built for [`hemicycle.dev`](https://hemicycle.dev).

## What's in it

| Dataset       | Shipped as           | Contents                                                                                           |
| ------------- | -------------------- | -------------------------------------------------------------------------------------------------- |
| **Index**     | `loadVotesIndex()`   | a lightweight record for **every** roll-call vote (~24.5k): date, title, procedure, result, totals |
| **Detail**    | `loadYearDetail(yr)` | full **per-MEP nominal** breakdown for the substantive **"main"** votes, split per calendar year   |
| **Detail**    | `loadTermDetail(t)`  | the same, concatenated for a whole parliamentary term (9 or 10)                                    |
| **Groups**    | `loadGroups()`       | `groupCode → { label, abbrev, color }`                                                             |
| **MEPs**      | `loadMeps()`         | `memberId → { firstName, lastName, country }`                                                      |
| **Countries** | `loadCountries()`    | `countryCode → label`                                                                              |
| **Meta**      | `loadMeta()`         | provenance, counts, per-term/year totals, source URLs                                              |

The published JS bundle is tiny — the (large) JSON datasets are loaded lazily so
consumers code-split them instead of inlining the whole dataset.

## Coverage

The source ([HowTheyVote.eu](https://howtheyvote.eu)) covers EP roll-call votes
from the **9th parliamentary term (2 July 2019)** onward, so this package spans
**terms 9 and 10** (≈ 2019 → today). **Term 8 (2014–2019) is not included** — the
[EP Open Data Portal](https://data.europarl.europa.eu) would be the path to extend
back. See `meta.json` for exact counts and the live date range.

> **Why only "main" votes get per-MEP detail.** There are ~24.5k roll-call votes
> and ~17.4M nominal cells; shipping per-MEP detail for _all_ of them would be
> ~0.5 GB. As with the French package, full per-MEP nominal detail is shipped only
> for the substantive **"main"** votes (the final vote on each text, `isMain` in
> the index) — but the index lists **every** vote with its for/against/abstention
> totals.

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

The committed JSON under `data/` is generated from
[HowTheyVote.eu's open data](https://github.com/HowTheyVote/data) (no inputs are
committed):

```bash
yarn fetch   # downloads ~70 MB of CSV archives, rebuilds data/
yarn build   # bundle with tsdown
```

See [`scripts/fetch-data.ts`](scripts/fetch-data.ts).

## Licence

Code: MIT. Data: © [HowTheyVote.eu](https://howtheyvote.eu),
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) — itself derived from
European Parliament public roll-call vote results.
