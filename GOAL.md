# GOAL — where hemicycle is going

> **Draft north star — needs Gabriel's confirmation.** Inferred from the
> README, CLAUDE.md and the deployed sites (hemicycle.dev, fr.hemicycle.dev,
> eu.hemicycle.dev) on 2026-08-15; correct it and delete this line.

## North star

**Make it possible for anyone to understand a law their parliament just
passed, in plain language, with every claim traceable to the person who
said it.**

Hemicycle is two things wearing one name: a small, dependency-free
seat-chart rendering library (`@hemicycle/core` → `vanilla` → `react`,
published to npm) and, built on top of it, a pair of civic-tech sites —
`fr.hemicycle.dev` (Assemblée nationale) and `eu.hemicycle.dev` (European
Parliament) — that turn official debate transcripts into "Comprendre / Le
vote / Les débats" explainers via a local LLM, with every argument citing
the actual intervention it came from. The bet: existing vote-trackers (Nos
Députés, VoteWatch, HowTheyVote) show *how* a body voted; nobody cheaply
shows *why*, sourced to the transcript, for a general reader. The seat-chart
library is the reusable byproduct that makes the sites easy to build and
funds their existence as an open-source portfolio piece.

## Target

- **Me (Gabriel)** — a working civic-tech portfolio piece; `@hemicycle/*`
  as a maintained open-source library people actually install.
- **French/EU citizens curious about a specific law or vote** — arrive from
  a search or a share, read one page, leave understanding the law and who
  argued what.
- **Developers who need a parliament seat chart** — install one npm package,
  get a working, accessible SVG hemicycle with zero dependencies.

## Being worked on

<!-- Claims by goal-keeper agents. One bullet per in-flight item; the agent
     removes its own line in the same commit that ticks the checkbox. Leave
     the section empty (this comment only) when nothing is in flight. -->

- [eu] Add explainer (Comprendre) tab to apps/eu — @2026-08-15T16:00Z

## Horizons

### Short term — v0.2 (now)
- Wire the already-generated `@hemicycle/european-parliament-debates` data
  (6 committed summaries) into `apps/eu` — an explainer tab mirroring
  `apps/fr`'s Comprendre / Le vote / Les débats, so `eu.hemicycle.dev` stops
  being vote-only.
- Grow FR law-explainer coverage past the current 5 summarized laws by
  running `yarn summarize` for more of the ~64 linkable leg-17 dossiers.
- Fix the argument-source gap: 4 of the 5 committed FR summaries have at
  least one pour/contre argument whose citation renders as "Non spécifié".

### Middle term — v0.3
- Per-deputy / per-MEP pages: a member's voting record and cited
  interventions across laws, not just per-law views. The single biggest
  feature gap versus comparable trackers (OpenCongress, They Vote For You).
- URL routing (`react-router` or equivalent) so a law, vote, or member has
  a real, shareable, bookmarkable, deep-linkable URL — today the SPA state
  resets on refresh in both `apps/fr` and `apps/eu`.

### Long term — v1.0 / someday
Both sites cover their full available history (not just the current
leg/term slice), every debated law has a sourced explainer, members have
accountability pages, and `@hemicycle/*` has outside adopters beyond this
repo — measured by non-Gabriel GitHub stars or npm installs, not vanity
metrics.

## Wishlist

- [ ] Add an explainer ("Comprendre") tab to `apps/eu`, consuming the
  already-committed `@hemicycle/european-parliament-debates` summaries —
  same pattern as `apps/fr`'s Comprendre/Le vote/Les débats tabs.
- [ ] Run `LMSTUDIO_API_KEY=… yarn summarize --top 20` in
  `data/french-assemblee-nationale-debats` (wake EVOX2 via the `evox2`
  skill first) to grow FR coverage from 5 to ~20+ laws.
- [ ] Debug why 4/5 committed FR summaries have a pour/contre argument
  whose `source` resolves to "Non spécifié" instead of a real citation —
  likely a summarize-prompt/schema issue in `scripts/summarize.ts`.
- [ ] Add `react-router` (or a minimal hash router) to `apps/fr` and
  `apps/eu` so the selected law/vote is reflected in the URL and
  shareable — check with `screenshot`/browser that a direct link to a law
  loads that law, not the picker default.
- [ ] Add per-deputy pages to `apps/fr`: given a deputy's name/id (already
  present in vote data as `acteurRef`), list every law they voted on and
  every intervention of theirs cited in a summary.
- [ ] Add per-MEP pages to `apps/eu`, same idea, keyed on `MEPID` from the
  votes/debates packages.
- [ ] Deploy `apps/docs` (Docusaurus) to a real URL via zipgo (matching
  `apps/web`'s raspy2 deploy) instead of the unused `docusaurus deploy`
  GitHub Pages script — right now the docs site has no public home.
- [ ] Extend `@hemicycle/french-assemblee-nationale-debats` to legislature
  16 (currently 16+17 are fetched but linking only works for leg-17 titles
  in the votes dataset) — pull titles from the AN *Dossiers Législatifs*
  dataset to widen the link coverage.
- [ ] Add a "compare two laws" or "compare two members" view to either
  site — a lightweight way to show voting-pattern differences, a feature
  none of the researched comparable trackers do well.

## Non-goals (for now)

- The Sénat (upper house) — no shared dossier id with the AN dataset;
  deferred per existing project notes until there's a clean bridge (URL or
  loi-number matching).
- An AI chat/Q&A interface over the transcripts (what OpenCongress ships) —
  interesting, but a RAG layer over sourced summaries is a bigger lift than
  one goal-keeper session; revisit once member pages and routing exist.
- Redesigning the seat-chart rendering API — `core`/`vanilla`/`react` are
  published and stable; churn there breaks real installs for no user-facing
  win right now.

## Guard rails (for the goal-keeper)

- One item per run, finished end-to-end (implementation + verification via
  a real `screenshot` of the deployed change, not just a local build).
- This repo's remote is **GitHub** (`GabrielVidal1/hemicycle`), not Gitea —
  commit and `git push origin main` directly, don't use the Gitea
  `commit-project` flow. See `CLAUDE.md`.
- Running `yarn summarize` needs the EVOX2 box awake (`evox2` skill) and a
  non-reasoning model (`gemma-4-26b-a4b-it` — reasoning models like
  `qwen3.6-*` never emit valid JSON here). Don't switch the default model
  without re-verifying JSON output.
- `apps/eu` fetches its EP votes dataset as static JSON from `public/data`
  instead of importing the package's JS — bundling it OOMs Vite. Follow the
  same pattern for any new EU debates wiring.
- Don't touch React's pinned `18.3.1` resolution or the published package
  APIs without a changeset (`yarn changeset`).
- Leave `npm publish` / `yarn release` to a human — a scheduled agent
  publishing a public package is not something to automate.

## Research log

<!-- Appended by the goal-seeder agent. Newest first. -->

### 2026-08-15 — first goal, v0.2 horizon

- Read the repo (CLAUDE.md, README, git log) + memories
  ([[hemicycle-debats-summaries]], [[hemicycle-ep-debates-package]]) →
  confirmed `@hemicycle/european-parliament-debates` has 6 committed
  summaries but `apps/eu` never consumes them (memory said so as of
  2026-06-28; still true on 2026-08-15) → top wishlist item.
- `screenshot https://fr.hemicycle.dev` (full page, 4s wait) → law page
  renders correctly but every pour/contre argument shows "Non spécifié"
  instead of a source name → grepped `public/summaries/*.json`: 4 of 5
  committed files hit this fallback → wishlist item to debug the
  summarize prompt/schema.
- `screenshot https://eu.hemicycle.dev` → fully functional votes-by-file
  viewer, 2092 files, terms 8–10 — no explainer tab, confirming the gap
  above visually.
- WebSearch "civic tech open source parliament vote explainer legislative
  tracker 2026" → [OpenCongress](https://opencongress.app/en) (AI-powered,
  stable deep-linked URLs per bill/vote/representative, AI chat over
  legislation) and [They Vote For You](https://civictech.guide/projects/they-vote-for-you)
  (per-representative voting record) → neither `apps/fr` nor `apps/eu` has
  per-member pages or URL routing → both became wishlist items; the AI-chat
  idea was judged too large for one session and moved to Non-goals for now.
- WebSearch "parliament diagram hemicycle chart open source library
  alternatives d3" → confirmed the closest npm competitors are
  [d3-parliament-chart](https://github.com/dkaoster/d3-parliament-chart) and
  [d3-parliament](https://github.com/geoffreybr/d3-parliament) — no obvious
  feature `@hemicycle/*` is missing relative to them; no rendering-API
  change proposed, kept the packages as a stability non-goal instead.
- `grep TODO/FIXME` across `apps` and `packages` (ts/tsx only) → none found;
  code is clean, no small bugs to fold in beyond the "Non spécifié" one.
- `@gabvdl/ui` / private-registry check skipped on purpose: hemicycle is a
  public GitHub-canonical OSS project (own published npm packages), not a
  homelab-internal app — it doesn't and shouldn't depend on the lab's
  private Verdaccio registry.
- `npm outdated` in `packages/core` → no output (nothing outdated or npm
  install not run locally) → no dependency-migration item found.
- Considered and rejected: redesigning the seat-chart geometry/rendering
  API — the packages are published and stable, and no competitor research
  surfaced a compelling reason to churn a public API.
