/**
 * LessonPicker — lektionslisten for Bogstavernes Dal.
 *
 * Midlertidig navigation indtil det fulde verdenskort ("Landet der vågner")
 * portes: viser de 7 publicerede lektioner i hija'i-orden med en
 * "Anbefalet"-markering på den næste (frit valg uden låsning —
 * ejer-beslutning). Når profiler/auth er bygget, bliver anbefalingen
 * progress-drevet; indtil da anbefales lektion 1.
 *
 * MUREN: læser kun lessons (kurrikulum). Aldrig content/aqidah.
 */

import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useT } from "@/lib/i18n";
import type { Lesson } from "@/lib/types";

export interface LessonPickerProps {
  onPick: (lessonId: string) => void;
}

export function LessonPicker({ onPick }: LessonPickerProps) {
  const t = useT("da");
  const [lessons, setLessons] = useState<Lesson[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void supabase
      .from("lessons")
      .select("*")
      .eq("world", "bogstavernes_dal")
      .eq("is_published", true)
      .gte("order_index", 1)
      .lte("order_index", 7)
      .order("order_index")
      .then((res) => {
        if (cancelled) return;
        if (res.error) setError(res.error.message);
        else setLessons(res.data as Lesson[]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <p className="text-center text-sm text-ink-soft">
        {t.lessonPicker.fetchError(error)}
      </p>
    );
  }
  if (!lessons) {
    return (
      <p className="text-center text-sm text-ink-soft">{t.lessonPicker.loading}</p>
    );
  }

  return (
    <div className="grid w-full gap-3 sm:grid-cols-2">
      {lessons.map((l, i) => {
        const recommended = i === 0;
        return (
          <button
            key={l.id}
            onClick={() => onPick(l.id)}
            className="relative flex items-center gap-3 rounded-(--radius-skin) border border-night/15 bg-white p-4 text-start shadow-sm transition-transform active:scale-[0.98]"
          >
            <span
              className="flex size-11 shrink-0 items-center justify-center rounded-full text-lg font-bold text-white"
              style={{ background: "var(--color-valley)" }}
            >
              {l.order_index}
            </span>
            <span className="min-w-0">
              <span className="block truncate font-semibold text-night">
                {l.title_da}
              </span>
              {l.title_ar && (
                <span
                  dir="rtl"
                  lang="ar"
                  className="arabic block text-lg text-ink-soft"
                >
                  {l.title_ar}
                </span>
              )}
            </span>
            {recommended && (
              <span
                className="absolute -top-2 end-3 flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold"
                style={{ background: "var(--color-nour)", color: "#3d2a00" }}
              >
                <Sparkles className="size-3" /> {t.lessonPicker.recommended}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
