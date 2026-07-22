/**
 * ErrorScreen — børnevenlig fejlskærm, ejer-godkendt demo (fejlskaerm-demo.html,
 * 2026-07-22). Rolig, dansk, ét stort lys-tema "Prøv igen"-lys. ALDRIG en
 * teknisk stak-trace. Ingen eksterne links (børnesikkerhed).
 *
 * "app": fuld nattehimmel-overtagelse, kun "Prøv igen" — der findes ikke
 *        noget snævrere sted at vende tilbage til.
 * "game": kontained kort i lektionens eksisterende mørke ramme. 7-14 år får
 *         desuden "‹ Tilbage til kortet" som sikkerhedsnet; 3-6 år (soft)
 *         holdes til ét enkelt, stort valg.
 */

import type { AgeSkin } from "@/lib/types";
import "./error-boundary.css";

interface SkinCopy {
  title: string;
  body: string;
  cta: string;
  exit: string | null;
}

const COPY: Record<AgeSkin, SkinCopy> = {
  soft: {
    title: "Uh oh! Lyset blinkede 🏮",
    body: "Det var ikke dig. Tryk på det store lys for at prøve igen.",
    cta: "Prøv igen ✨",
    exit: null,
  },
  mid: {
    title: "Der gik noget galt for et øjeblik",
    body: "Det er ikke din skyld. Dit fremskridt er gemt — prøv igen.",
    cta: "Prøv igen",
    exit: "Tilbage til kortet",
  },
  teen: {
    title: "Uventet fejl",
    body: "Der opstod en teknisk fejl. Du kan roligt prøve igen — dit fremskridt er gemt undervejs.",
    cta: "Prøv igen",
    exit: "Tilbage til kortet",
  },
};

export interface ErrorScreenProps {
  scope: "app" | "game";
  skin: AgeSkin;
  onRetry: () => void;
  onExit?: () => void;
}

export function ErrorScreen({ scope, skin, onRetry, onExit }: ErrorScreenProps) {
  const c = COPY[skin];

  if (scope === "app") {
    return (
      <div className="eb-scene" data-age-skin={skin} role="alert">
        <div className="eb-app">
          <Lamp />
          <p className="eb-title">{c.title}</p>
          <p className="eb-body">{c.body}</p>
          <button className="eb-btn-gold" onClick={onRetry}>
            {c.cta}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="eb-game-wrap" data-age-skin={skin} role="alert">
      <div className="eb-card">
        <Lamp small />
        <p className="eb-title">{c.title}</p>
        <p className="eb-body">{c.body}</p>
        <button className="eb-btn-gold" onClick={onRetry}>
          {c.cta}
        </button>
        {c.exit && onExit && (
          <button className="eb-btn-ghost" onClick={onExit}>
            ‹ {c.exit}
          </button>
        )}
      </div>
    </div>
  );
}

function Lamp({ small = false }: { small?: boolean }) {
  return (
    <div className={small ? "eb-lamp eb-lamp-sm" : "eb-lamp"} aria-hidden="true">
      🏮
    </div>
  );
}
