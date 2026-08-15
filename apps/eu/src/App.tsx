import { useEffect, useMemo, useRef, useState } from "react";
import { Hemicycle, type HemicycleData } from "@hemicycle/react";
import type {
  DetailYear,
  Group,
  Procedure,
  VoteDetail,
  VoteIndexEntry,
} from "@hemicycle/european-parliament-votes";
import {
  loadSummariesIndex,
  loadProcedureSummary,
  type SummaryIndexEntry,
  type ProcedureSummary,
} from "@hemicycle/european-parliament-debates";
import { loadGroups, loadVotesIndex, loadYearDetail } from "./data";
import {
  buildSeats,
  euDate,
  groupLabel,
  listProcedures,
  orderedGroups,
  pickDisplayVote,
  POSITION_COLORS,
  POSITION_LABELS,
  POSITIONS,
  tallies,
  yearOf,
} from "./lib";
import { TranscriptDrawer } from "./Transcript";

// The "Comprendre" explainer tabs are new and only cover a handful of files
// so far (@hemicycle/european-parliament-debates ships 6 summaries against
// thousands of votes) — gate them behind a query param until there's enough
// coverage to be the default experience. ?comprendre=1 switches the picker to
// the explained-files list and adds the Comprendre/Le vote/Les débats tabs,
// mirroring apps/fr; the plain URL keeps today's votes-only viewer untouched.
export function App() {
  const explainOn =
    new URLSearchParams(window.location.search).get("comprendre") === "1";
  return explainOn ? <ExplainerApp /> : <VotesOnlyApp />;
}

function VotesOnlyApp() {
  const [index, setIndex] = useState<VoteIndexEntry[] | null>(null);
  const [groups, setGroups] = useState<Record<string, Group> | null>(null);
  const [selectedRef, setSelectedRef] = useState<string | null>(null);
  const [vote, setVote] = useState<VoteDetail | null>(null);
  const [loadingVote, setLoadingVote] = useState(false);
  const detailCache = useRef(new Map<number, VoteDetail[]>());

  useEffect(() => {
    Promise.all([loadVotesIndex(), loadGroups()]).then(([idx, grp]) => {
      setIndex(idx);
      setGroups(grp);
    });
  }, []);

  // Procedures (legislative files / resolutions) with a displayable vote, newest first.
  const procedures = useMemo<Procedure[]>(() => {
    if (!index) return [];
    return listProcedures(index).filter((p) => p.votes.some((v) => v.detail));
  }, [index]);

  useEffect(() => {
    if (!selectedRef && procedures.length)
      setSelectedRef(procedures[0].reference);
  }, [procedures, selectedRef]);

  const procedure = useMemo(
    () => procedures.find((p) => p.reference === selectedRef) ?? null,
    [procedures, selectedRef],
  );
  const displayEntry = useMemo(
    () => (procedure ? pickDisplayVote(procedure) : null),
    [procedure],
  );

  useEffect(() => {
    if (!displayEntry) {
      setVote(null);
      return;
    }
    let cancelled = false;
    setLoadingVote(true);
    const year = yearOf(displayEntry.timestamp);
    const find = (list: VoteDetail[]) =>
      list.find((v) => v.id === displayEntry.id) ?? null;
    const cached = detailCache.current.get(year);
    if (cached) {
      setVote(find(cached));
      setLoadingVote(false);
      return;
    }
    loadYearDetail(year as DetailYear).then((list) => {
      detailCache.current.set(year, list);
      if (!cancelled) {
        setVote(find(list));
        setLoadingVote(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [displayEntry]);

  const ready = index && groups;

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden>
            ★
          </span>
          <div>
            <h1>European Parliament votes</h1>
            <p className="tagline">
              How MEPs voted on each file, in the hemicycle.
            </p>
          </div>
        </div>

        <div className="picker">
          <label htmlFor="file" className="picker-label">
            Choose a file
          </label>
          <select
            id="file"
            value={selectedRef ?? ""}
            onChange={(e) => setSelectedRef(e.target.value)}
            disabled={!ready}
          >
            {!ready && <option>Loading…</option>}
            {procedures.map((p) => (
              <option key={p.reference} value={p.reference}>
                {euDate(p.lastVote)} · {p.title ?? p.reference}
              </option>
            ))}
          </select>
          {ready && (
            <span className="picker-count">
              {procedures.length} files · terms 8–10
            </span>
          )}
        </div>
      </header>

      <main>
        {!ready && <div className="status">Loading data…</div>}
        {ready && procedure && (
          <VoteView
            procedure={procedure}
            vote={vote}
            groups={groups!}
            loading={loadingVote}
          />
        )}
      </main>

      <footer className="footer">
        Data: <a href="https://howtheyvote.eu">HowTheyVote.eu</a> (CC BY 4.0).
        Hemicycle by <a href="https://hemicycle.dev">@hemicycle/react</a>.
        <p className="mode-link">
          <a href="?comprendre=1">Explainers preview →</a>
        </p>
      </footer>
    </div>
  );
}

// ── Explainer preview (Comprendre / Le vote / Les débats) ──────────────────
// Mirrors apps/fr's App.tsx pattern: the picker is driven by the explained
// files (@hemicycle/european-parliament-debates), each cross-referenced
// against the votes index for the "Le vote" tab.

type Tab = "comprendre" | "vote" | "debats";

function ExplainerApp() {
  const [summaries, setSummaries] = useState<SummaryIndexEntry[] | null>(
    null,
  );
  const [index, setIndex] = useState<VoteIndexEntry[] | null>(null);
  const [groups, setGroups] = useState<Record<string, Group> | null>(null);
  const [selectedRef, setSelectedRef] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("comprendre");

  const [summary, setSummary] = useState<ProcedureSummary | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const summaryCache = useRef(new Map<string, ProcedureSummary>());

  const [vote, setVote] = useState<VoteDetail | null>(null);
  const [loadingVote, setLoadingVote] = useState(false);
  const detailCache = useRef(new Map<number, VoteDetail[]>());

  useEffect(() => {
    Promise.all([loadSummariesIndex(), loadVotesIndex(), loadGroups()]).then(
      ([sum, idx, grp]) => {
        setSummaries(sum);
        setIndex(idx);
        setGroups(grp);
      },
    );
  }, []);

  useEffect(() => {
    if (!selectedRef && summaries && summaries.length)
      setSelectedRef(summaries[0].ref);
  }, [summaries, selectedRef]);

  // Votes procedure for the selected file (for the hemicycle).
  const procedure = useMemo<Procedure | null>(() => {
    if (!index || !selectedRef) return null;
    return listProcedures(index).find((p) => p.reference === selectedRef) ?? null;
  }, [index, selectedRef]);

  const displayEntry = useMemo(
    () => (procedure ? pickDisplayVote(procedure) : null),
    [procedure],
  );

  // Load the LLM explainer for the selected file.
  useEffect(() => {
    if (!selectedRef) return;
    setTab("comprendre");
    const cached = summaryCache.current.get(selectedRef);
    if (cached) {
      setSummary(cached);
      return;
    }
    let cancelled = false;
    setLoadingSummary(true);
    setSummary(null);
    loadProcedureSummary(selectedRef)
      .then((s) => {
        summaryCache.current.set(selectedRef, s);
        if (!cancelled) setSummary(s);
      })
      .finally(() => !cancelled && setLoadingSummary(false));
    return () => {
      cancelled = true;
    };
  }, [selectedRef]);

  // Load the displayed vote's nominal detail (for the hemicycle).
  useEffect(() => {
    if (!displayEntry) {
      setVote(null);
      return;
    }
    let cancelled = false;
    setLoadingVote(true);
    const year = yearOf(displayEntry.timestamp);
    const find = (list: VoteDetail[]) =>
      list.find((v) => v.id === displayEntry.id) ?? null;
    const cached = detailCache.current.get(year);
    if (cached) {
      setVote(find(cached));
      setLoadingVote(false);
      return;
    }
    loadYearDetail(year as DetailYear).then((list) => {
      detailCache.current.set(year, list);
      if (!cancelled) {
        setVote(find(list));
        setLoadingVote(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [displayEntry]);

  const ready = summaries && index && groups;

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden>
            ★
          </span>
          <div>
            <h1>Understand European Parliament files</h1>
            <p className="tagline">
              What each file does, what was said in the chamber, and how MEPs
              voted — summarized from the official verbatim reports.
            </p>
          </div>
        </div>

        <div className="picker">
          <label htmlFor="file" className="picker-label">
            Choose a file
          </label>
          <select
            id="file"
            value={selectedRef ?? ""}
            onChange={(e) => setSelectedRef(e.target.value)}
            disabled={!ready}
          >
            {!ready && <option>Loading…</option>}
            {(summaries ?? []).map((s) => (
              <option key={s.ref} value={s.ref}>
                {euDate(s.lastDate)} · {s.titre ?? s.ref}
              </option>
            ))}
          </select>
          {ready && (
            <span className="picker-count">
              {summaries!.length} file{summaries!.length > 1 ? "s" : ""}{" "}
              explained · from the plenary verbatim
            </span>
          )}
        </div>
      </header>

      <main>
        {!ready && <div className="status">Loading…</div>}
        {ready && selectedRef && (
          <>
            <nav className="tabs" role="tablist">
              {(
                [
                  ["comprendre", "Comprendre"],
                  ["vote", "Le vote"],
                  ["debats", "Les débats"],
                ] as [Tab, string][]
              ).map(([t, label]) => (
                <button
                  key={t}
                  role="tab"
                  aria-selected={tab === t}
                  className={`tab ${tab === t ? "is-active" : ""}`}
                  onClick={() => setTab(t)}
                >
                  {label}
                  {t === "debats" && summary ? (
                    <span className="tab-badge">{summary.blocks.length}</span>
                  ) : null}
                </button>
              ))}
            </nav>

            {tab === "comprendre" && (
              <ComprendreTab summary={summary} loading={loadingSummary} />
            )}
            {tab === "vote" &&
              (procedure ? (
                <VoteView
                  procedure={procedure}
                  vote={vote}
                  groups={groups!}
                  loading={loadingVote}
                />
              ) : (
                <section className="vote">
                  <div className="status">
                    No roll-call vote available for this file.
                  </div>
                </section>
              ))}
            {tab === "debats" && (
              <DebatsTab summary={summary} loading={loadingSummary} />
            )}
          </>
        )}
      </main>

      <footer className="footer">
        Data: <a href="https://data.europarl.europa.eu">EP Open Data Portal</a>{" "}
        · <a href="https://howtheyvote.eu">HowTheyVote.eu</a> (CC BY 4.0).
        Summaries generated by a local language model — cross-check against
        the cited official verbatim. Hemicycle by{" "}
        <a href="https://hemicycle.dev">@hemicycle/react</a>.
        <p className="mode-link">
          <a href="?">← All files (votes only)</a>
        </p>
      </footer>
    </div>
  );
}

function ComprendreTab({
  summary,
  loading,
}: {
  summary: ProcedureSummary | null;
  loading: boolean;
}) {
  if (loading || !summary)
    return <div className="status">Loading the explainer…</div>;
  return (
    <section className="explainer">
      <div className="explainer-head">
        <h2>{summary.titre ?? summary.ref}</h2>
        <p className="issue">{summary.issue}</p>
      </div>

      <p className="lede">{summary.resumeSimple}</p>
      {summary.enJeu && (
        <div className="enjeu">
          <span className="enjeu-label">What's at stake</span>
          <p>{summary.enJeu}</p>
        </div>
      )}

      <div className="args">
        <ArgColumn
          kind="pour"
          title="Arguments for"
          args={summary.argumentsPour}
          sources={summary.sources}
        />
        <ArgColumn
          kind="contre"
          title="Arguments against"
          args={summary.argumentsContre}
          sources={summary.sources}
        />
      </div>

      {summary.chronologie.length > 0 && (
        <div className="panel">
          <h3>Timeline of the debate</h3>
          <ol className="timeline">
            {summary.chronologie.map((c, i) => (
              <li key={i}>
                <span className="t-date">{euDate(c.date)}</span>
                <div>
                  <strong>{c.titre}</strong>
                  <p>{c.fait}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}

      {summary.orateursCles.length > 0 && (
        <div className="panel">
          <h3>Voices of the debate</h3>
          <ul className="speakers">
            {summary.orateursCles.map((o, i) => (
              <li key={i}>
                <strong>{o.nom}</strong>
                <span>{o.role}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {summary.sources.length > 0 && (
        <div className="panel sources">
          <h3>Sources ({summary.sources.length})</h3>
          <ul>
            {summary.sources.map((s, i) => (
              <li key={i}>
                <a href={s.url} target="_blank" rel="noreferrer">
                  {s.orateur || "Intervention"} · sitting of {euDate(s.date)}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function ArgColumn({
  kind,
  title,
  args,
  sources,
}: {
  kind: "pour" | "contre";
  title: string;
  args: ProcedureSummary["argumentsPour"];
  sources: ProcedureSummary["sources"];
}) {
  return (
    <div className={`arg-col is-${kind}`}>
      <h3>
        <span className="arg-dot" /> {title}
      </h3>
      {args.length === 0 && <p className="muted">—</p>}
      <ul>
        {args.map((a, i) => {
          const src = a.source != null ? sources[a.source] : null;
          return (
            <li key={i}>
              <p>{a.point}</p>
              <span className="arg-by">
                {a.orateur}
                {src && (
                  <>
                    {" · "}
                    <a href={src.url} target="_blank" rel="noreferrer">
                      source
                    </a>
                  </>
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function DebatsTab({
  summary,
  loading,
}: {
  summary: ProcedureSummary | null;
  loading: boolean;
}) {
  const [open, setOpen] = useState<{
    term: number;
    uid: string;
    ordre?: number;
  } | null>(null);
  if (loading || !summary)
    return <div className="status">Loading the debates…</div>;
  return (
    <section className="debats">
      <p className="debats-intro">
        {summary.blocks.length} sitting{summary.blocks.length > 1 ? "s" : ""}{" "}
        of debate on this file. Each summary points back to the interventions
        of the official verbatim report.
      </p>
      {summary.blocks.map((b) => (
        <article className="seance-card" key={b.blockId}>
          <header>
            <h3>{euDate(b.date)}</h3>
            <button
              className="btn-link"
              onClick={() => setOpen({ term: summary.term, uid: b.sittingUid })}
            >
              Read the verbatim report →
            </button>
          </header>
          <p className="seance-resume">{b.resume}</p>
          <div className="args args-compact">
            <div className="arg-col is-pour">
              <h4>
                <span className="arg-dot" /> For
              </h4>
              <ul>
                {b.argumentsPour.map((a, i) => (
                  <SeanceArg key={i} a={a} b={b} onOpen={setOpen} />
                ))}
                {b.argumentsPour.length === 0 && <li className="muted">—</li>}
              </ul>
            </div>
            <div className="arg-col is-contre">
              <h4>
                <span className="arg-dot" /> Against
              </h4>
              <ul>
                {b.argumentsContre.map((a, i) => (
                  <SeanceArg key={i} a={a} b={b} onOpen={setOpen} />
                ))}
                {b.argumentsContre.length === 0 && (
                  <li className="muted">—</li>
                )}
              </ul>
            </div>
          </div>
        </article>
      ))}
      {open && (
        <TranscriptDrawer
          term={open.term}
          uid={open.uid}
          focusOrdre={open.ordre}
          onClose={() => setOpen(null)}
        />
      )}
    </section>
  );
}

function SeanceArg({
  a,
  b,
  onOpen,
}: {
  a: ProcedureSummary["blocks"][number]["argumentsPour"][number];
  b: ProcedureSummary["blocks"][number];
  onOpen: (o: { term: number; uid: string; ordre?: number }) => void;
}) {
  const src = a.source != null ? b.sources[a.source] : null;
  return (
    <li>
      <p>{a.point}</p>
      <span className="arg-by">
        {a.orateur}
        {src && (
          <>
            {" · "}
            <button
              className="btn-cite"
              onClick={() =>
                onOpen({ term: src.term, uid: src.sittingUid, ordre: src.ordre })
              }
            >
              view intervention
            </button>
          </>
        )}
      </span>
    </li>
  );
}

function VoteView({
  procedure,
  vote,
  groups,
  loading,
}: {
  procedure: Procedure;
  vote: VoteDetail | null;
  groups: Record<string, Group>;
  loading: boolean;
}) {
  const seats = useMemo(
    () => (vote ? buildSeats(vote, groups) : []),
    [vote, groups],
  );
  const data = useMemo<HemicycleData[]>(
    () => seats.map((s) => ({ idx: s.idx, seatConfig: s.seatConfig })),
    [seats],
  );
  const total = seats.length;
  const rows = Math.max(6, Math.min(15, Math.round(Math.sqrt(total / 2.8))));
  const counts = vote ? tallies(vote) : null;
  const adopted = vote?.result?.toUpperCase() === "ADOPTED";

  return (
    <section className="vote">
      <div className="vote-head">
        <h2>{procedure.title ?? procedure.reference}</h2>
        {vote && (
          <p className="vote-sub">
            {vote.isMain ? "Final vote" : "Roll-call vote"} ·{" "}
            {euDate(vote.timestamp)} · term {vote.term} · {procedure.reference}
          </p>
        )}
        {vote?.amendmentSubject && (
          <p className="vote-objet">{vote.amendmentSubject}</p>
        )}
      </div>

      {vote && vote.result && (
        <div className={`verdict ${adopted ? "is-adopted" : "is-rejected"}`}>
          {adopted ? "✓ Adopted" : "✕ Rejected"}
        </div>
      )}

      <div className="chart">
        {loading && <div className="status">Loading vote…</div>}
        {!loading && vote && total > 0 && (
          <Hemicycle
            rows={rows}
            totalSeats={total}
            data={data}
            totalAngle={180}
            innerRadius={32}
            outerRadius={95}
            orderBy="radial"
            seatMargin={1}
            svgProps={{
              width: "100%",
              height: "auto",
              style: { maxHeight: 420 },
            }}
          />
        )}
        {!loading && vote && counts && (
          <div className="totals">
            {POSITIONS.filter((p) => p !== "didNotVote").map((p) => (
              <div className="total" key={p}>
                <span
                  className="dot"
                  style={{ background: POSITION_COLORS[p] }}
                />
                <span className="total-n">{counts[p]}</span>
                <span className="total-l">{POSITION_LABELS[p]}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {vote && (
        <table className="breakdown">
          <thead>
            <tr>
              <th>Group</th>
              <th className="num">For</th>
              <th className="num">Against</th>
              <th className="num">Abst.</th>
              <th>Majority</th>
            </tr>
          </thead>
          <tbody>
            {orderedGroups(vote).map((g) => {
              const color = groups[g.g]?.color || "#888";
              return (
                <tr key={g.g}>
                  <td>
                    <span className="swatch" style={{ background: color }} />
                    {groupLabel(g.g, groups)}
                  </td>
                  <td className="num">{g.for ?? 0}</td>
                  <td className="num">{g.against ?? 0}</td>
                  <td className="num">{g.abstention ?? 0}</td>
                  <td className="pos">{g.majority ?? "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {!loading && vote && (
        <p className="vote-foot">
          {procedure.votes.length} roll-call vote
          {procedure.votes.length > 1 ? "s" : ""} on this file
          {procedure.type ? ` · ${procedure.type}` : ""}.
        </p>
      )}
    </section>
  );
}
