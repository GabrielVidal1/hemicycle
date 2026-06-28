# @hemicycle/french-assemblee-nationale-debats

Debate transcripts ("comptes rendus intégraux des séances publiques") of the
French **Assemblée nationale**, parsed from the official Sycéron XML, segmented
per debated text, linked to the law projects (dossiers) of
[`@hemicycle/french-assemblee-nationale-votes`](../french-assemblee-nationale-votes),
and summarized by a **local open-weight LLM** into plain-language explainers — so
anyone can understand a new law and the arguments raised for and against it, with
every claim traceable to its source intervention.

Used by **[fr.hemicycle.dev](https://fr.hemicycle.dev)** (`apps/fr`).

## What ships

Two tiers of data so the browser code-splits the small bits and fetches the big
bits on demand:

| File | How it loads | Contents |
| --- | --- | --- |
| `data/seances-index.json` | bundled (lazy import) | every sitting (date, session, président, counts) |
| `data/blocks-index.json` | bundled | every debate block, with its dossier link |
| `data/dossier-debats.json` | bundled | law → its debate blocks / sittings |
| `data/summaries-index.json` | bundled | the laws an LLM explainer exists for (the picker) |
| `public/summaries/<ref>.json` | `fetch` (`/debats`) | the explainer + per-séance summaries for one law |
| `public/seances/<leg>/<uid>.json` | `fetch` (`/debats`) | the full transcript of one sitting |

```ts
import {
  loadSummariesIndex,   // laws with an explainer
  loadDossierSummary,   // the explainer for one law (+ per-séance summaries, sources)
  loadSeance,           // full transcript of a sitting
  setDebatsBase,        // where the per-item JSON is fetched from (default "/debats")
} from "@hemicycle/french-assemblee-nationale-debats";
```

Each summary argument carries a `source` index into a `sources[]` array, every
source pointing back to the exact intervention (speaker, séance, official
`assemblee-nationale.fr` URL) it was drawn from.

## Regenerating the data

```bash
# 1. fetch + parse + link transcripts (downloads ~100 MB; emits indexes + .cache transcripts)
yarn fetch

# 2. summarize with the local LLM (LM Studio on the EVOX2 box, see implement-ai skill)
LMSTUDIO_API_KEY=… yarn summarize                  # the default slice of laws
LMSTUDIO_API_KEY=… yarn summarize DLR5L17N52977    # specific dossiers
LMSTUDIO_API_KEY=… yarn summarize --top 10         # the N most recent laws with debate
#                                  --force          # re-summarize existing
```

`yarn fetch` writes the full per-séance transcripts to a git-ignored `.cache/`;
`yarn summarize` ships only the transcripts of the laws it summarizes into
`public/seances`. The LLM output under `public/summaries` is committed (it is the
expensive artifact — the box is not on the deploy machine).

## How linking works

The debate XML doesn't carry a dossier id on each intervention. Each bill's
discussion opens with a `TITRE_TEXTE_DISCUSSION` section header whose text is the
law's short title; `fetch-data.ts` segments on those headers and matches the
title (accent/elision-normalized) against the dossiers of the votes dataset
within a date window. Coverage is currently limited to laws for which the votes
dataset has a `dossierTitre` (legislature 17). Extending to legislature 16 and
beyond means pulling titles from the AN *Dossiers Législatifs* dataset.

Data © Assemblée nationale, Licence Ouverte / Open Licence (Etalab). Summaries
generated locally with an open-weight LLM and should be recouped against the
cited official comptes rendus.
