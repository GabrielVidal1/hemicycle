import { useEffect, useRef, useState } from "react";
import {
  loadSitting,
  sittingUrl,
  type Sitting,
} from "@hemicycle/european-parliament-debates";
import { euDate } from "./lib";

/** A drawer that streams the full official verbatim of one sitting. */
export function TranscriptDrawer({
  term,
  uid,
  focusOrdre,
  onClose,
}: {
  term: number;
  uid: string;
  focusOrdre?: number;
  onClose: () => void;
}) {
  const [sitting, setSitting] = useState<Sitting | null>(null);
  const [error, setError] = useState(false);
  const focusRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    setSitting(null);
    setError(false);
    loadSitting(term, uid)
      .then((s) => !cancelled && setSitting(s))
      .catch(() => !cancelled && setError(true));
    return () => {
      cancelled = true;
    };
  }, [term, uid]);

  // Close on Escape.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Scroll to the cited intervention once loaded.
  useEffect(() => {
    if (sitting && focusOrdre != null && focusRef.current) {
      focusRef.current.scrollIntoView({ block: "center" });
    }
  }, [sitting, focusOrdre]);

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside className="drawer" onClick={(e) => e.stopPropagation()}>
        <header className="drawer-head">
          <div>
            <h3>Verbatim report of proceedings</h3>
            {sitting && (
              <p className="drawer-sub">
                {sitting.dateLong ?? euDate(sitting.date)}
              </p>
            )}
          </div>
          <div className="drawer-actions">
            <a href={sittingUrl(term, uid)} target="_blank" rel="noreferrer">
              official source ↗
            </a>
            <button className="drawer-close" onClick={onClose} aria-label="Close">
              ✕
            </button>
          </div>
        </header>

        <div className="drawer-body">
          {!sitting && !error && (
            <p className="status">Loading the verbatim report…</p>
          )}
          {error && (
            <p className="status">
              Verbatim report unavailable.{" "}
              <a href={sittingUrl(term, uid)} target="_blank" rel="noreferrer">
                Read it on the Parliament's website
              </a>
              .
            </p>
          )}
          {sitting &&
            sitting.interventions.map((iv) => {
              const isFocus = focusOrdre != null && iv.o === focusOrdre;
              const isChair = iv.role?.toLowerCase().includes("president") ?? false;
              if (!iv.t) return null;
              return (
                <div
                  key={iv.o}
                  ref={isFocus ? focusRef : undefined}
                  className={`cri-para ${isFocus ? "is-focus" : ""} ${
                    isChair ? "is-chair" : ""
                  }`}
                >
                  {iv.nom && <span className="cri-orateur">{iv.nom}.</span>}{" "}
                  {iv.t}
                </div>
              );
            })}
        </div>
      </aside>
    </div>
  );
}
