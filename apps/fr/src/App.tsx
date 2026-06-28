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

export function App() {
  const [index, setIndex] = useState<ScrutinIndexEntry[] | null>(null);
  const [groupes, setGroupes] = useState<Record<string, Groupe> | null>(null);
  const [selectedRef, setSelectedRef] = useState<string | null>(null);
  const [scrutin, setScrutin] = useState<ScrutinDetail | null>(null);
  const [loadingVote, setLoadingVote] = useState(false);
  const detailCache = useRef(new Map<Legislature, ScrutinDetail[]>());

  // Initial load: index + group reference.
  useEffect(() => {
    Promise.all([loadScrutinsIndex(), loadGroupes()]).then(([idx, grp]) => {
      setIndex(idx);
      setGroupes(grp);
    });
  }, []);

  // Law projects (dossiers) that have at least one displayable vote, newest first.
  const dossiers = useMemo<Dossier[]>(() => {
    if (!index) return [];
    return listDossiers(index).filter((d) => d.scrutins.some((s) => s.detail));
  }, [index]);

  useEffect(() => {
    if (!selectedRef && dossiers.length) setSelectedRef(dossiers[0].ref);
  }, [dossiers, selectedRef]);

  const dossier = useMemo(
    () => dossiers.find((d) => d.ref === selectedRef) ?? null,
    [dossiers, selectedRef],
  );
  const displayEntry = useMemo(
    () => (dossier ? pickDisplayEntry(dossier) : null),
    [dossier],
  );

  // Load the detail for the selected vote.
  useEffect(() => {
    if (!displayEntry) {
      setScrutin(null);
      return;
    }
    let cancelled = false;
    setLoadingVote(true);
    const leg = displayEntry.legislature as Legislature;
    const find = (list: ScrutinDetail[]) =>
      list.find((s) => s.uid === displayEntry.uid) ?? null;
    const cached = detailCache.current.get(leg);
    if (cached) {
      setScrutin(find(cached));
      setLoadingVote(false);
      return;
    }
    loadLegislatureDetail(leg).then((list) => {
      detailCache.current.set(leg, list);
      if (!cancelled) {
        setScrutin(find(list));
        setLoadingVote(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [displayEntry]);

  const ready = index && groupes;

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden>
            ▟▖
          </span>
          <div>
            <h1>Votes de l'Assemblée nationale</h1>
            <p className="tagline">
              Le vote des députés sur chaque loi, dans l'hémicycle.
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
            {dossiers.map((d) => (
              <option key={d.ref} value={d.ref}>
                {frenchDate(d.derniereDate)} · {d.titre ?? d.ref}
              </option>
            ))}
          </select>
          {ready && (
            <span className="picker-count">
              {dossiers.length} lois · législatures XIV–XVII
            </span>
          )}
        </div>
      </header>

      <main>
        {!ready && <div className="status">Chargement des données…</div>}
        {ready && dossier && (
          <VoteView
            dossier={dossier}
            scrutin={scrutin}
            groupes={groupes!}
            loading={loadingVote}
          />
        )}
      </main>

      <footer className="footer">
        Données&nbsp;:{" "}
        <a href="https://data.assemblee-nationale.fr">Assemblée nationale</a> ·
        Licence Ouverte (Etalab). Hémicycle rendu avec{" "}
        <a href="https://hemicycle.dev">@hemicycle/react</a>.
      </footer>
    </div>
  );
}

function VoteView({
  dossier,
  scrutin,
  groupes,
  loading,
}: {
  dossier: Dossier;
  scrutin: ScrutinDetail | null;
  groupes: Record<string, Groupe>;
  loading: boolean;
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

  return (
    <section className="vote">
      <div className="vote-head">
        <h2>{dossier.titre ?? dossier.ref}</h2>
        {scrutin && (
          <p className="vote-sub">
            {scrutin.type === "SPS" ? "Scrutin solennel" : "Scrutin public"} ·{" "}
            {frenchDate(scrutin.date)} · {scrutin.legislature}
            <sup>e</sup> législature (
            {LEGISLATURE_ROMAN[scrutin.legislature as Legislature]})
          </p>
        )}
        {scrutin?.objet && scrutin.objet !== dossier.titre && (
          <p className="vote-objet">{scrutin.objet}</p>
        )}
      </div>

      {scrutin && (
        <div className={`verdict ${adopted ? "is-adopted" : "is-rejected"}`}>
          {adopted ? "✓ Adopté" : "✕ Rejeté"}
        </div>
      )}

      <div className="chart">
        {loading && <div className="status">Chargement du scrutin…</div>}
        {!loading && scrutin && total > 0 && (
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
        {!loading && scrutin && counts && (
          <div className="totals">
            {POSITIONS.filter((p) => p !== "nonVotant").map((p) => (
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

      {scrutin && (
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
      )}

      {!loading && scrutin && (
        <p className="vote-foot">
          Scrutin n°{scrutin.numero} · {dossier.scrutins.length} scrutin
          {dossier.scrutins.length > 1 ? "s" : ""} lié
          {dossier.scrutins.length > 1 ? "s" : ""} à cette loi.
        </p>
      )}
    </section>
  );
}
