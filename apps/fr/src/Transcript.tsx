import { useEffect, useRef, useState } from "react";
import {
  loadSeance,
  seanceUrl,
  type Seance,
} from "@hemicycle/french-assemblee-nationale-debats";
import { frenchDate } from "./lib";

/** A drawer that streams the full official transcript of one sitting. */
export function TranscriptDrawer({
  leg,
  uid,
  focusOrdre,
  onClose,
}: {
  leg: number;
  uid: string;
  focusOrdre?: number;
  onClose: () => void;
}) {
  const [seance, setSeance] = useState<Seance | null>(null);
  const [error, setError] = useState(false);
  const focusRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    setSeance(null);
    setError(false);
    loadSeance(leg, uid)
      .then((s) => !cancelled && setSeance(s))
      .catch(() => !cancelled && setError(true));
    return () => {
      cancelled = true;
    };
  }, [leg, uid]);

  // Close on Escape.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Scroll to the cited intervention once loaded.
  useEffect(() => {
    if (seance && focusOrdre != null && focusRef.current) {
      focusRef.current.scrollIntoView({ block: "center" });
    }
  }, [seance, focusOrdre]);

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside className="drawer" onClick={(e) => e.stopPropagation()}>
        <header className="drawer-head">
          <div>
            <h3>Compte rendu intégral</h3>
            {seance && (
              <p className="drawer-sub">
                {seance.dateLong ?? frenchDate(seance.date)}
                {seance.session ? ` · ${seance.session}` : ""}
              </p>
            )}
          </div>
          <div className="drawer-actions">
            <a href={seanceUrl(leg, uid)} target="_blank" rel="noreferrer">
              source officielle ↗
            </a>
            <button className="drawer-close" onClick={onClose} aria-label="Fermer">
              ✕
            </button>
          </div>
        </header>

        <div className="drawer-body">
          {!seance && !error && <p className="status">Chargement du compte rendu…</p>}
          {error && (
            <p className="status">
              Compte rendu indisponible.{" "}
              <a href={seanceUrl(leg, uid)} target="_blank" rel="noreferrer">
                Lire sur le site de l'Assemblée
              </a>
              .
            </p>
          )}
          {seance &&
            seance.interventions.map((iv) => {
              const isTitle = iv.code === "TITRE_TEXTE_DISCUSSION";
              const isFocus = focusOrdre != null && iv.o === focusOrdre;
              if (isTitle)
                return (
                  <h4 className="cri-title" key={iv.o}>
                    {iv.t}
                  </h4>
                );
              if (!iv.t) return null;
              return (
                <div
                  key={iv.o}
                  ref={isFocus ? focusRef : undefined}
                  className={`cri-para ${isFocus ? "is-focus" : ""} ${
                    iv.role === "president" ? "is-chair" : ""
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
