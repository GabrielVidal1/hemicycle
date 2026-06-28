# @hemicycle/european-parliament-debates

Plenary debate verbatim reports ("Verbatim report of proceedings" /
"Compte rendu in extenso", **CRE**) of the **European Parliament**, parsed from
the official [EP Open Data Portal](https://data.europarl.europa.eu) XML,
segmented per agenda item, linked to the legislative procedures (dossiers) of
[`@hemicycle/european-parliament-votes`](../european-parliament-votes), and
summarized by a **local open-weight LLM** into plain-language explainers — so
anyone can understand a debated text and the arguments raised for and against it,
with every claim traceable to the MEP who made it.

The EU counterpart of
[`@hemicycle/french-assemblee-nationale-debats`](../french-assemblee-nationale-debats).
Used by **[eu.hemicycle.dev](https://eu.hemicycle.dev)** (`apps/eu`).

## What ships

Two tiers of data so the browser code-splits the small bits and fetches the big
bits on demand:

| File | How it loads | Contents |
| --- | --- | --- |
| `data/sittings-index.json` | bundled (lazy import) | every parsed sitting (date, term, counts) |
| `data/blocks-index.json` | bundled | every debate block (agenda item), with its procedure link |
| `data/procedure-debats.json` | bundled | procedure → its debate blocks / sittings |
| `data/summaries-index.json` | bundled | the procedures an LLM explainer exists for (the picker) |
| `public/summaries/<refSlug>.json` | `fetch` (`/eu-debats`) | the explainer + per-debate summaries for one procedure |
| `public/sittings/<term>/<uid>.json` | `fetch` (`/eu-debats`) | the full transcript of one sitting |

```ts
import {
  loadSummariesIndex,    // procedures with an explainer
  loadProcedureSummary,  // the explainer for one procedure (+ per-debate summaries, sources)
  loadSitting,           // full transcript of a sitting
  setDebatsBase,         // where the per-item JSON is fetched from (default "/eu-debats")
} from "@hemicycle/european-parliament-debates";
```

Each summary argument carries a `source` index into a `sources[]` array, every
source pointing back to the exact intervention (speaker + MEP id, sitting,
official `europarl.europa.eu` verbatim URL) it was drawn from.

> **Multilingual.** The EP verbatim records each speech in the language it was
> delivered in (`Intervention.lg`); only agenda-item titles are translated. The
> summaries are written in **English** by a multilingual model that reads the
> original-language interventions.

## Regenerating the data

```bash
# 1. fetch + parse + link the verbatim reports (emits indexes + .cache transcripts)
yarn fetch

# 2. summarize with the local LLM (LM Studio on the EVOX2 box, see implement-ai skill)
LMSTUDIO_API_KEY=… yarn summarize                  # the default slice (most-debated)
LMSTUDIO_API_KEY=… yarn summarize "2023/0079(COD)" # specific procedures
LMSTUDIO_API_KEY=… yarn summarize --top 10         # the N most-debated procedures
#                                  --force          # re-summarize existing
```

`yarn fetch` writes the full per-sitting transcripts to a git-ignored `.cache/`;
`yarn summarize` ships only the transcripts of the procedures it summarizes into
`public/sittings`. The LLM output under `public/summaries` is committed (it is
the expensive artifact — the box is not on the deploy machine).

## How linking works

The EP verbatim is a single multilingual XML per sitting, structured as
`DEBATS > CHAPTER > (TL-CHAP title, INTERVENTION*)`. Each **CHAPTER** is one
agenda item; `fetch-data.ts` treats it as a debate block. Linking to a procedure
uses the EP document / procedure references printed in the item title and the
chair's opening words:

1. an explicit procedure reference (`YYYY/NNNN(TYPE)`), matched against the votes
   dataset's `procedureReference`;
2. a document reference in the **title** (e.g. `A9-0238/2023`), matched against
   the votes dataset's `reference` → its procedure;
3. a document reference in the opening interventions.

Only sittings whose **final multilingual XML** is published are parsed — the
provisional verbatim ships as PDF/DOCX only and lags the final XML, so the most
recent sittings are absent until their XML appears.

## Licence

Code: MIT. Data: © European Union — European Parliament, verbatim reports of
proceedings (CRE), via the EP Open Data Portal. Summaries generated locally with
an open-weight LLM and should be checked against the cited official verbatim.
