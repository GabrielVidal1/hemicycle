# @hemicycle/french-assemblee-nationale-votes

Public-ballot (**scrutins**) data of the French National Assembly (_Assemblée
nationale_) for legislatures **14–17** (~2012 → today), normalized for displaying
how every deputy and political group voted on a given **law project** — and ready
to colour a [Hemicycle](https://hemicycle.dev) seat chart.

Built for [`fr.hemicycle.dev`](https://hemicycle.dev).

## What's in it

| Dataset      | Shipped as                   | Contents                                                                                                                           |
| ------------ | ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| **Index**    | `loadScrutinsIndex()`        | a lightweight record for **every** scrutin (17k+): date, title, dossier, type, result, totals                                      |
| **Detail**   | `loadLegislatureDetail(leg)` | full **per-deputy nominal** breakdown for "law-project" ballots (solemn votes ∪ motions ∪ any vote tied to a _dossier législatif_) |
| **Groups**   | `loadGroupes()`              | `organeRef → { libelle, abbrev, couleur, … }`                                                                                      |
| **Deputies** | `loadActeurs()`              | `acteurRef → { nom, prenom, civ, trigramme }`                                                                                      |
| **Meta**     | `loadMeta()`                 | provenance, counts, source URLs                                                                                                    |

The published JS bundle is tiny — the (large) JSON datasets are loaded lazily so
consumers code-split them instead of inlining ~12 MB.

## Usage

```ts
import {
  loadScrutinsIndex,
  loadLegislatureDetail,
  loadGroupes,
  loadActeurs,
  listDossiers,
  seatColors,
  deputeName,
} from "@hemicycle/french-assemblee-nationale-votes";

// Browse every vote, or group them into distinct law projects (dossiers)
const index = await loadScrutinsIndex();
const dossiers = listDossiers(index); // newest first, e.g. "Fin de vie"

// Render one vote on a Hemicycle chart
const votes17 = await loadLegislatureDetail(17);
const scrutin = votes17.find((s) => s.type === "SPS"); // a solemn vote
const colorsByPosition = seatColors(scrutin); // numPlace -> hex (pour/contre/abstention)

const groupes = await loadGroupes();
const colorsByGroup = seatColors(scrutin, { by: "groupe", groupes });

// Who voted what
const acteurs = await loadActeurs();
for (const v of scrutin.votes) {
  console.log(deputeName(acteurs[v.a]), "→", v.v, "seat", v.p);
}
```

> **Note on older legislatures.** Recent legislatures (16–17) include a seat number
> (`numPlace`) for every nominal vote, so they render directly on the hemicycle.
> Legislatures 14–15 often publish only aggregate counts (no `numPlace`, sometimes no
> group colour) for solemn votes — the per-deputy data is sparser there.

## Regenerating the data

The committed JSON under `data/` is generated from the official open data at
<https://data.assemblee-nationale.fr> (no inputs are committed):

```bash
yarn fetch   # downloads ~60 MB of scrutins + reference archives, rebuilds data/
yarn build   # bundle with tsdown
```

See [`scripts/fetch-data.ts`](scripts/fetch-data.ts).

## Licence

Code: MIT. Data: © Assemblée nationale, _Licence Ouverte / Open Licence_ (Etalab).
