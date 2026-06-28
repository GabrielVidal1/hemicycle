import { useEffect, useMemo, useRef, useState } from "react";
import { Hemicycle, type HemicycleData } from "@hemicycle/react";
import {
  listProcedures,
  POSITION_COLORS,
  type DetailYear,
  type Group,
  type Procedure,
  type VoteDetail,
  type VoteIndexEntry,
} from "@hemicycle/european-parliament-votes";
import { loadGroups, loadVotesIndex, loadYearDetail } from "./data";
import {
  buildSeats,
  euDate,
  groupLabel,
  orderedGroups,
  pickDisplayVote,
  POSITION_LABELS,
  POSITIONS,
  tallies,
  yearOf,
} from "./lib";

export function App() {
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
      </footer>
    </div>
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
