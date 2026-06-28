import { useEffect, useMemo, useRef, useState } from "react";
import { Hemicycle, type HemicycleData } from "@hemicycle/react";
import {
  listDossiers,
  loadGroupes,
  loadLegislatureDetail,
  loadScrutinsIndex,
  POSITION_COLORS,
  type Dossier,
  type Groupe,
  type Legislature,
  type ScrutinDetail,
  type ScrutinIndexEntry,
} from "@hemicycle/french-assemblee-nationale-votes";
import {
  loadSummariesIndex,
  loadDossierSummary,
  type SummaryIndexEntry,
  type DossierSummary,
} from "@hemicycle/french-assemblee-nationale-debats";
import {
  buildSeats,
  frenchDate,
  groupLabel,
  groupRank,
  LEGISLATURE_ROMAN,
  pickDisplayEntry,
  POSITION_LABELS,
  POSITIONS,
  tallies,
} from "./lib";
import { TranscriptDrawer } from "./Transcript";

type Tab = "comprendre" | "vote" | "debats";

export function App() {
  const [summaries, setSummaries] = useState<SummaryIndexEntry[] | null>(null);
  const [index, setIndex] = useState<ScrutinIndexEntry[] | null>(null);
  const [groupes, setGroupes] = useState<Record<string, Groupe> | null>(null);
  const [selectedRef, setSelectedRef] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("comprendre");

  const [summary, setSummary] = useState<DossierSummary | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const summaryCache = useRef(new Map<string, DossierSummary>());

  const [scrutin, setScrutin] = useState<ScrutinDetail | null>(null);
  const detailCache = useRef(new Map<Legislature, ScrutinDetail[]>());

  // Initial load: the laws we have explainers for, plus the votes reference.
  useEffect(() => {
    Promise.all([loadSummariesIndex(), loadScrutinsIndex(), loadGroupes()]).then(
      ([sum, idx, grp]) => {
        setSummaries(sum);
        setIndex(idx);
        setGroupes(grp);
      },
    );
  }, []);

  useEffect(() => {
    if (!selectedRef && summaries && summaries.length)
      setSelectedRef(summaries[0].ref);
  }, [summaries, selectedRef]);

  // Votes dossier for the selected law (for the hemicycle).
  const dossier = useMemo<Dossier | null>(() => {
    if (!index || !selectedRef) return null;
    return listDossiers(index).find((d) => d.ref === selectedRef) ?? null;
  }, [index, selectedRef]);

  const displayEntry = useMemo(
    () => (dossier ? pickDisplayEntry(dossier) : null),
    [dossier],
  );

  // Load the LLM explainer for the selected law.
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
    loadDossierSummary(selectedRef)
      .then((s) => {
        summaryCache.current.set(selectedRef, s);
        if (!cancelled) setSummary(s);
      })
      .finally(() => !cancelled && setLoadingSummary(false));
    return () => {
      cancelled = true;
    };
  }, [selectedRef]);

  // Load the displayed scrutin's nominal detail (for the hemicycle).
  useEffect(() => {
    if (!displayEntry) {
      setScrutin(null);
      return;
    }
    let cancelled = false;
    const leg = displayEntry.legislature as Legislature;
    const find = (list: ScrutinDetail[]) =>
      list.find((s) => s.uid === displayEntry.uid) ?? null;
    const cached = detailCache.current.get(leg);
    if (cached) {
      setScrutin(find(cached));
      return;
    }
    loadLegislatureDetail(leg).then((list) => {
      detailCache.current.set(leg, list);
      if (!cancelled) setScrutin(find(list));
    });
    return () => {
      cancelled = true;
    };
  }, [displayEntry]);

  const ready = summaries && index && groupes;

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden>
            ▟▖
          </span>
          <div>
            <h1>Comprendre les lois de l'Assemblée nationale</h1>
            <p className="tagline">
              Ce que dit chaque loi, ce qui s'est dit dans l'hémicycle, et comment
              les députés ont voté — résumé à partir des comptes rendus officiels.
            </p>
          </div>
        </div>

        <div className="picker">
          <label htmlFor="law" className="picker-label">
            Choisir une loi
          </label>
          <select
            id="law"
            value={selectedRef ?? ""}
            onChange={(e) => setSelectedRef(e.target.value)}
            disabled={!ready}
          >
            {!ready && <option>Chargement…</option>}
            {(summaries ?? []).map((s) => (
              <option key={s.ref} value={s.ref}>
                {frenchDate(s.lastDate)} · {s.titre ?? s.ref}
              </option>
            ))}
          </select>
          {ready && (
            <span className="picker-count">
              {summaries!.length} loi{summaries!.length > 1 ? "s" : ""} expliquée
              {summaries!.length > 1 ? "s" : ""} · à partir des débats en séance
            </span>
          )}
        </div>
      </header>

      <main>
        {!ready && <div className="status">Chargement…</div>}
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
            {tab === "vote" && (
              <VoteView
                dossier={dossier}
                scrutin={scrutin}
                groupes={groupes!}
                fallbackTitle={summary?.titre ?? selectedRef}
              />
            )}
            {tab === "debats" && (
              <DebatsTab summary={summary} loading={loadingSummary} />
            )}
          </>
        )}
      </main>

      <footer className="footer">
        Données&nbsp;:{" "}
        <a href="https://data.assemblee-nationale.fr">Assemblée nationale</a> ·
        Licence Ouverte (Etalab). Résumés générés par un modèle de langage local —
        à recouper avec les comptes rendus officiels cités. Hémicycle rendu avec{" "}
        <a href="https://hemicycle.dev">@hemicycle/react</a>.
      </footer>
    </div>
  );
}

// ── Comprendre ─────────────────────────────────────────────────────────────

function ComprendreTab({
  summary,
  loading,
}: {
  summary: DossierSummary | null;
  loading: boolean;
}) {
  if (loading || !summary)
    return <div className="status">Chargement du résumé…</div>;
  return (
    <section className="explainer">
      <div className="explainer-head">
        <h2>{summary.titre}</h2>
        <p className="issue">{summary.issue}</p>
      </div>

      <p className="lede">{summary.resumeSimple}</p>
      {summary.enJeu && (
        <div className="enjeu">
          <span className="enjeu-label">Ce qui est en jeu</span>
          <p>{summary.enJeu}</p>
        </div>
      )}

      <div className="args">
        <ArgColumn
          kind="pour"
          title="Arguments pour"
          args={summary.argumentsPour}
          sources={summary.sources}
        />
        <ArgColumn
          kind="contre"
          title="Arguments contre"
          args={summary.argumentsContre}
          sources={summary.sources}
        />
      </div>

      {summary.chronologie.length > 0 && (
        <div className="panel">
          <h3>Chronologie du débat</h3>
          <ol className="timeline">
            {summary.chronologie.map((c, i) => (
              <li key={i}>
                <span className="t-date">{frenchDate(c.date)}</span>
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
          <h3>Voix du débat</h3>
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
                  {s.orateur || "Intervention"} · séance du {frenchDate(s.date)}
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
  args: DossierSummary["argumentsPour"];
  sources: DossierSummary["sources"];
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

// ── Les débats ─────────────────────────────────────────────────────────────

function DebatsTab({
  summary,
  loading,
}: {
  summary: DossierSummary | null;
  loading: boolean;
}) {
  const [open, setOpen] = useState<{ leg: number; uid: string; ordre?: number } | null>(
    null,
  );
  if (loading || !summary)
    return <div className="status">Chargement des débats…</div>;
  return (
    <section className="debats">
      <p className="debats-intro">
        {summary.blocks.length} séance{summary.blocks.length > 1 ? "s" : ""} de
        débat sur ce texte. Chaque résumé renvoie aux interventions du compte rendu
        officiel.
      </p>
      {summary.blocks.map((b) => (
        <article className="seance-card" key={b.blockId}>
          <header>
            <h3>{frenchDate(b.date)}</h3>
            <button
              className="btn-link"
              onClick={() => setOpen({ leg: summary.leg, uid: b.seanceUid })}
            >
              Lire le compte rendu →
            </button>
          </header>
          <p className="seance-resume">{b.resume}</p>
          <div className="args args-compact">
            <div className="arg-col is-pour">
              <h4>
                <span className="arg-dot" /> Pour
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
                <span className="arg-dot" /> Contre
              </h4>
              <ul>
                {b.argumentsContre.map((a, i) => (
                  <SeanceArg key={i} a={a} b={b} onOpen={setOpen} />
                ))}
                {b.argumentsContre.length === 0 && <li className="muted">—</li>}
              </ul>
            </div>
          </div>
        </article>
      ))}
      {open && (
        <TranscriptDrawer
          leg={open.leg}
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
  a: DossierSummary["blocks"][number]["argumentsPour"][number];
  b: DossierSummary["blocks"][number];
  onOpen: (o: { leg: number; uid: string; ordre?: number }) => void;
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
                onOpen({ leg: src.leg, uid: src.seanceUid, ordre: src.ordre })
              }
            >
              voir l'intervention
            </button>
          </>
        )}
      </span>
    </li>
  );
}

// ── Le vote (preserved from the original viewer) ────────────────────────────

function VoteView({
  dossier,
  scrutin,
  groupes,
  fallbackTitle,
}: {
  dossier: Dossier | null;
  scrutin: ScrutinDetail | null;
  groupes: Record<string, Groupe>;
  fallbackTitle: string;
}) {
  const seats = useMemo(
    () => (scrutin ? buildSeats(scrutin, groupes) : []),
    [scrutin, groupes],
  );
  const data = useMemo<HemicycleData[]>(
    () => seats.map((s) => ({ idx: s.idx, seatConfig: s.seatConfig })),
    [seats],
  );
  const total = seats.length;
  const rows = Math.max(6, Math.min(15, Math.round(Math.sqrt(total / 2.8))));
  const counts = scrutin ? tallies(scrutin) : null;
  const adopted = scrutin?.sort?.toLowerCase().includes("adopt");
  const orderedGroups = scrutin
    ? [...scrutin.groupes].sort(
        (a, b) => groupRank(a.ref, groupes) - groupRank(b.ref, groupes),
      )
    : [];

  if (!scrutin)
    return (
      <section className="vote">
        <div className="status">
          Pas de scrutin nominatif disponible pour cette loi.
        </div>
      </section>
    );

  return (
    <section className="vote">
      <div className="vote-head">
        <h2>{dossier?.titre ?? fallbackTitle}</h2>
        <p className="vote-sub">
          {scrutin.type === "SPS" ? "Scrutin solennel" : "Scrutin public"} ·{" "}
          {frenchDate(scrutin.date)} · {scrutin.legislature}
          <sup>e</sup> législature (
          {LEGISLATURE_ROMAN[scrutin.legislature as Legislature]})
        </p>
      </div>

      <div className={`verdict ${adopted ? "is-adopted" : "is-rejected"}`}>
        {adopted ? "✓ Adopté" : "✕ Rejeté"}
      </div>

      <div className="chart">
        {total > 0 && (
          <Hemicycle
            rows={rows}
            totalSeats={total}
            data={data}
            totalAngle={180}
            innerRadius={32}
            outerRadius={95}
            orderBy="radial"
            seatMargin={1}
            svgProps={{ width: "100%", height: "auto", style: { maxHeight: 420 } }}
          />
        )}
        {counts && (
          <div className="totals">
            {POSITIONS.filter((p) => p !== "nonVotant").map((p) => (
              <div className="total" key={p}>
                <span className="dot" style={{ background: POSITION_COLORS[p] }} />
                <span className="total-n">{counts[p]}</span>
                <span className="total-l">{POSITION_LABELS[p]}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <table className="breakdown">
        <thead>
          <tr>
            <th>Groupe</th>
            <th className="num">Pour</th>
            <th className="num">Contre</th>
            <th className="num">Abst.</th>
            <th>Position</th>
          </tr>
        </thead>
        <tbody>
          {orderedGroups.map((g) => {
            const color = (g.ref && groupes[g.ref]?.couleur) || "#888";
            return (
              <tr key={g.ref ?? Math.random()}>
                <td>
                  <span className="swatch" style={{ background: color }} />
                  {groupLabel(g.ref, groupes)}
                </td>
                <td className="num">{g.pour ?? 0}</td>
                <td className="num">{g.contre ?? 0}</td>
                <td className="num">{g.abstention ?? 0}</td>
                <td className="pos">{g.position ?? "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
