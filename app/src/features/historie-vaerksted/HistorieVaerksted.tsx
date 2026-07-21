/**
 * HistorieVaerksted — admin-CMS for Historiernes Bjerge (Fase 2-forberedelse).
 * Flow og felter portet 1:1 fra ejer-godkendt demo
 * (nour-historie-vaerksted-demo.html); farvesceneri genbruger forælder-
 * portalens nattehimmel/guld-tema (historie-vaerksted.css).
 *
 * Vises for admin/approver/editor (styret i ParentAuth) — men det er
 * databasen (RLS + triggerens Lag D), IKKE denne komponent, der afgør hvem
 * der reelt kan kilde-verificere eller udgive. Knapperne skjules for
 * redaktør som en høflighed, ikke som sikkerhed.
 */

import { useMemo, useState } from "react";
import type { Account, Content, QuizQuestion } from "@/lib/types";
import { ALDERSSPAEND, validateQuizVariant, type AlderKey, type AqidahDraftInput } from "./engine";
import { useHistorieVaerksted, type StatusFilter } from "./useHistorieVaerksted";
import "./historie-vaerksted.css";

/** De fire quiz-varianter i formularen, og hvilket AqidahDraftInput-felt hver skriver til. */
const QUIZ_VARIANTER = [
  { key: "faelles", label: "Fælles", inputKey: "quiz_da" as const },
  { key: "simpel", label: "Simpel (3–6)", inputKey: "quiz_da_simple" as const },
  { key: "mellem", label: "Mellem (7–10)", inputKey: "quiz_da_medium" as const },
  { key: "dyb", label: "Dyb (11–14)", inputKey: "quiz_da_deep" as const },
] as const;
type QuizVariantKey = (typeof QUIZ_VARIANTER)[number]["key"];
type QuizState = Record<QuizVariantKey, QuizQuestion[]>;

const TOM_QUIZ_STATE: QuizState = { faelles: [], simpel: [], mellem: [], dyb: [] };

export interface HistorieVaerkstedProps {
  role: Account["role"];
}

function kanGodkende(role: Account["role"]): boolean {
  return role === "admin" || role === "approver";
}

export function HistorieVaerksted({ role }: HistorieVaerkstedProps) {
  const hv = useHistorieVaerksted();
  const { state } = hv;
  const godkender = kanGodkende(role);

  return (
    <div className="flex w-full flex-col gap-3 text-left">
      <div className="flex gap-2" role="tablist" aria-label="Historie-værksted">
        <TabButton
          id="liste"
          label="Fortællinger"
          current={state.tab}
          onPick={(t) => (t === "liste" ? hv.cancelEdit() : hv.startEdit(null))}
        />
        <TabButton id="nyt" label="Ny fortælling" current={state.tab} onPick={() => hv.startEdit(null)} />
      </div>

      <p className="hv-wallnote rounded-2xl px-4 py-3 text-xs leading-relaxed">
        <b>Muren gælder her — strengere end noget andet sted:</b> AI skriver aldrig en fortælling.
        Kun godkendt kildetekst fra autoriserede kilder må indsættes.{" "}
        {godkender
          ? "Som godkender kan du kilde-verificere og udgive."
          : "Som redaktør kan du oprette og redigere kladder — kun en godkender kan kilde-verificere og udgive dem."}{" "}
        De hellige repræsenteres altid kun som lys.
      </p>

      {state.notice && (
        <p className="hv-notice rounded-2xl px-4 py-2.5 text-center text-sm font-semibold" role="status">
          {state.notice}
        </p>
      )}

      {state.loading && <p className="hv-dim py-6 text-center text-sm">Henter fortællinger…</p>}
      {state.error && (
        <p className="hv-err py-3 text-center text-sm" role="alert">
          {state.error}
        </p>
      )}

      {!state.loading && !state.error && state.tab === "liste" && <StoryListe hv={hv} godkender={godkender} />}
      {!state.loading && !state.error && state.tab === "nyt" && <StoryForm hv={hv} />}
    </div>
  );
}

type HV = ReturnType<typeof useHistorieVaerksted>;

function TabButton({
  id,
  label,
  current,
  onPick,
}: {
  id: HV["state"]["tab"];
  label: string;
  current: HV["state"]["tab"];
  onPick: (t: HV["state"]["tab"]) => void;
}) {
  const selected = current === id;
  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      onClick={() => onPick(id)}
      className={`hv-tab flex-1 rounded-2xl py-2.5 text-sm font-bold ${selected ? "hv-tab-on" : ""}`}
    >
      {label}
    </button>
  );
}

/* ========================= Fortællings-liste ========================= */

function StoryListe({ hv, godkender }: { hv: HV; godkender: boolean }) {
  const { state, patch } = hv;

  const rows = useMemo(() => {
    const q = state.search.trim().toLowerCase();
    return state.stories.filter((s) => {
      if (state.statusFilter === "kladde" && (s.is_source_verified || s.is_published)) return false;
      if (state.statusFilter === "verificeret" && (!s.is_source_verified || s.is_published)) return false;
      if (state.statusFilter === "udgivet" && !s.is_published) return false;
      if (q && !s.title_da.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [state.stories, state.search, state.statusFilter]);

  return (
    <>
      <input
        type="text"
        value={state.search}
        onChange={(e) => patch({ search: e.target.value })}
        placeholder="Søg på titel…"
        aria-label="Søg i fortællinger"
        className="hv-input w-full rounded-2xl px-4 py-2.5 text-sm"
      />
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Status">
        {(
          [
            ["alle", "Alle"],
            ["kladde", "Kladder"],
            ["verificeret", "Verificeret"],
            ["udgivet", "Udgivet"],
          ] as [StatusFilter, string][]
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            aria-pressed={state.statusFilter === id}
            onClick={() => patch({ statusFilter: id })}
            className={`hv-tab rounded-full px-3 py-1.5 text-xs font-bold ${state.statusFilter === id ? "hv-tab-on" : ""}`}
          >
            {label}
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <p className="hv-dim py-6 text-center text-sm">
          Ingen fortællinger matcher. Tryk “Ny fortælling” for at oprette en kladde.
        </p>
      ) : (
        rows.map((s) => <StoryCard key={s.id} story={s} godkender={godkender} hv={hv} />)
      )}
    </>
  );
}

function statusKlasse(s: Content): string {
  if (s.is_published) return "hv-st-published";
  if (s.is_source_verified) return "hv-st-verified";
  return "";
}

function statusTekst(s: Content): string {
  if (s.is_published) return "Udgivet — lyser i Historiernes Bjerge";
  if (s.is_source_verified) return "Kilde-verificeret — klar til udgivelse";
  return "Kladde";
}

function StoryCard({ story: s, godkender, hv }: { story: Content; godkender: boolean; hv: HV }) {
  const redigerbar = godkender || (!s.is_source_verified && !s.is_published);
  return (
    <div className={`hv-card flex items-start gap-3 rounded-3xl p-3.5 ${statusKlasse(s)}`}>
      <span className="hv-lamp" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-extrabold">
          {s.title_da}
          {s.title_ar ? (
            <span className="hv-ar" dir="rtl" lang="ar">
              {" "}
              {s.title_ar}
            </span>
          ) : null}
        </p>
        <p className="hv-dim text-xs italic">
          {statusTekst(s)} · alder {s.min_age}–{s.max_age} · niveau {s.level ?? "–"}
        </p>
        {s.is_source_verified || s.is_published ? (
          <span className="hv-kildemaerke">✓ Kilde-verificeret{s.source_reference ? ` · ${s.source_reference}` : ""}</span>
        ) : (
          <span className="hv-kladdemaerke">Kladde — endnu ikke verificeret</span>
        )}
        <div className="mt-2 flex flex-wrap gap-2">
          {godkender && !s.is_source_verified && (
            <button type="button" onClick={() => void hv.verify(s)} className="hv-btn hv-btn-guld">
              Markér kilde-verificeret
            </button>
          )}
          {godkender && s.is_source_verified && !s.is_published && (
            <>
              <button type="button" onClick={() => void hv.togglePublish(s)} className="hv-btn hv-btn-guld">
                Tænd lyset (udgiv)
              </button>
              <button type="button" onClick={() => void hv.unverify(s)} className="hv-btn">
                Fjern verifikation
              </button>
            </>
          )}
          {godkender && s.is_published && (
            <button type="button" onClick={() => void hv.togglePublish(s)} className="hv-btn">
              Sluk lyset (afpublicér)
            </button>
          )}
          <button
            type="button"
            onClick={() => hv.startEdit(s.id)}
            disabled={!redigerbar}
            className="hv-btn"
            title={redigerbar ? undefined : "Kun en godkender kan redigere en verificeret/udgivet fortælling"}
          >
            Redigér
          </button>
        </div>
        {!godkender && (s.is_source_verified || s.is_published) && (
          <p className="hv-lockhint">
            🔒 Kilde-verifikation og udgivelse er kun mulig for en godkender — databasen afviser alt andet.
          </p>
        )}
      </div>
    </div>
  );
}

/* ========================= Formular ========================= */

const TOM: AqidahDraftInput = {
  title_da: "",
  title_ar: "",
  source_reference: "",
  body_da: "",
  body_da_simple: "",
  body_da_medium: "",
  body_da_deep: "",
  alder: "3-14",
  level: 1,
  quiz_da: null,
  quiz_da_simple: null,
  quiz_da_medium: null,
  quiz_da_deep: null,
};

function StoryForm({ hv }: { hv: HV }) {
  const { state, save } = hv;
  const redigererStory = state.redigererId ? state.stories.find((s) => s.id === state.redigererId) : null;

  const [f, setF] = useState<AqidahDraftInput>(() =>
    redigererStory
      ? {
          title_da: redigererStory.title_da,
          title_ar: redigererStory.title_ar ?? "",
          source_reference: redigererStory.source_reference ?? "",
          body_da: redigererStory.body_da,
          body_da_simple: redigererStory.body_da_simple ?? "",
          body_da_medium: redigererStory.body_da_medium ?? "",
          body_da_deep: redigererStory.body_da_deep ?? "",
          alder: (ALDERSSPAEND.find(
            (a) => a.min_age === redigererStory.min_age && a.max_age === redigererStory.max_age,
          )?.value ?? "3-14") as AlderKey,
          level: (redigererStory.level ?? 1) as 1 | 2 | 3 | 4,
          quiz_da: redigererStory.quiz_da,
          quiz_da_simple: redigererStory.quiz_da_simple,
          quiz_da_medium: redigererStory.quiz_da_medium,
          quiz_da_deep: redigererStory.quiz_da_deep,
        }
      : TOM,
  );
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Quiz redigeres altid som arrays internt (aldrig null) — konverteres til null ved gem hvis tom.
  const [quiz, setQuiz] = useState<QuizState>(() =>
    redigererStory
      ? {
          faelles: redigererStory.quiz_da ?? [],
          simpel: redigererStory.quiz_da_simple ?? [],
          mellem: redigererStory.quiz_da_medium ?? [],
          dyb: redigererStory.quiz_da_deep ?? [],
        }
      : TOM_QUIZ_STATE,
  );
  const [aktivVariant, setAktivVariant] = useState<QuizVariantKey>("faelles");

  function opdaterVariant(variant: QuizVariantKey, spørgsmål: QuizQuestion[]) {
    setQuiz((q) => ({ ...q, [variant]: spørgsmål }));
  }
  function tilføjSpørgsmål() {
    const nuværende = quiz[aktivVariant];
    if (nuværende.length >= 5) return;
    opdaterVariant(aktivVariant, [
      ...nuværende,
      { question_da: "", options: [{ text_da: "", correct: true }, { text_da: "", correct: false }] },
    ]);
  }
  function fjernSpørgsmål(qi: number) {
    opdaterVariant(aktivVariant, quiz[aktivVariant].filter((_, i) => i !== qi));
  }
  function opdaterSpørgsmålTekst(qi: number, tekst: string) {
    opdaterVariant(
      aktivVariant,
      quiz[aktivVariant].map((q, i) => (i === qi ? { ...q, question_da: tekst } : q)),
    );
  }
  function tilføjSvarmulighed(qi: number) {
    opdaterVariant(
      aktivVariant,
      quiz[aktivVariant].map((q, i) =>
        i === qi && q.options.length < 5 ? { ...q, options: [...q.options, { text_da: "", correct: false }] } : q,
      ),
    );
  }
  function fjernSvarmulighed(qi: number, oi: number) {
    opdaterVariant(
      aktivVariant,
      quiz[aktivVariant].map((q, i) => {
        if (i !== qi || q.options.length <= 2) return q;
        const fjernedeVarKorrekt = q.options[oi].correct;
        const nyeOptions = q.options.filter((_, j) => j !== oi);
        if (fjernedeVarKorrekt) nyeOptions[0] = { ...nyeOptions[0], correct: true };
        return { ...q, options: nyeOptions };
      }),
    );
  }
  function opdaterSvarTekst(qi: number, oi: number, tekst: string) {
    opdaterVariant(
      aktivVariant,
      quiz[aktivVariant].map((q, i) =>
        i === qi ? { ...q, options: q.options.map((o, j) => (j === oi ? { ...o, text_da: tekst } : o)) } : q,
      ),
    );
  }
  function sætKorrekt(qi: number, oi: number) {
    opdaterVariant(
      aktivVariant,
      quiz[aktivVariant].map((q, i) =>
        i === qi ? { ...q, options: q.options.map((o, j) => ({ ...o, correct: j === oi })) } : q,
      ),
    );
  }

  const onSave = async () => {
    setErr(null);
    if (!f.title_da.trim()) {
      setErr("Skriv den danske titel.");
      return;
    }
    if (!f.source_reference.trim()) {
      setErr("Kildehenvisning er obligatorisk for aqidah — databasen afviser oprettelsen uden den.");
      return;
    }
    if (!f.body_da.trim()) {
      setErr("Indsæt den godkendte kildetekst.");
      return;
    }
    for (const v of QUIZ_VARIANTER) {
      const fejl = validateQuizVariant(quiz[v.key], v.label);
      if (fejl) {
        setAktivVariant(v.key);
        setErr(fejl);
        return;
      }
    }
    setBusy(true);
    const saveError = await save(
      {
        ...f,
        title_da: f.title_da.trim(),
        title_ar: f.title_ar?.trim() || null,
        source_reference: f.source_reference.trim(),
        body_da: f.body_da.trim(),
        quiz_da: quiz.faelles.length ? quiz.faelles : null,
        quiz_da_simple: quiz.simpel.length ? quiz.simpel : null,
        quiz_da_medium: quiz.mellem.length ? quiz.mellem : null,
        quiz_da_deep: quiz.dyb.length ? quiz.dyb : null,
      },
      state.redigererId,
    );
    setBusy(false);
    if (saveError) {
      setErr(saveError);
      return;
    }
  };

  return (
    <div className="hv-card flex flex-col gap-1 rounded-3xl p-4">
      <p className="text-sm font-extrabold">{state.redigererId ? "Redigér fortælling" : "Ny fortælling"}</p>

      <Felt label="Titel (dansk)" required>
        <input
          value={f.title_da}
          onChange={(e) => setF({ ...f, title_da: e.target.value })}
          placeholder="Fortællingens danske titel"
          className="hv-input w-full rounded-2xl px-3.5 py-2.5 text-sm"
        />
      </Felt>

      <Felt label="Titel (arabisk)">
        <input
          value={f.title_ar ?? ""}
          onChange={(e) => setF({ ...f, title_ar: e.target.value })}
          dir="rtl"
          lang="ar"
          placeholder="العنوان بالعربية"
          className="hv-input hv-input-ar w-full rounded-2xl px-3.5 py-2.5 text-sm"
        />
      </Felt>

      <Felt label="Kildehenvisning" required>
        <input
          value={f.source_reference}
          onChange={(e) => setF({ ...f, source_reference: e.target.value })}
          placeholder="Fx bog, side, autoriseret kilde"
          className="hv-input w-full rounded-2xl px-3.5 py-2.5 text-sm"
        />
        <p className="hv-felthint">Obligatorisk — databasen afviser en aqidah-række uden kilde.</p>
      </Felt>

      <Felt label="Godkendt kildetekst (dansk)" required>
        <textarea
          value={f.body_da}
          onChange={(e) => setF({ ...f, body_da: e.target.value })}
          placeholder="Indsæt den allerede godkendte kildetekst her — skriv ikke ny aqidah selv"
          rows={5}
          className="hv-input w-full rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed"
        />
      </Felt>

      <details className="mt-1">
        <summary className="cursor-pointer text-xs font-bold text-[#f5b942]">
          Aldersvarianter (valgfrit — simpel / mellem / dyb)
        </summary>
        <div className="mt-2 flex flex-col gap-2">
          <Felt label="Simpel (3–6 år)">
            <textarea
              value={f.body_da_simple ?? ""}
              onChange={(e) => setF({ ...f, body_da_simple: e.target.value })}
              rows={3}
              className="hv-input w-full rounded-2xl px-3.5 py-2.5 text-sm"
            />
          </Felt>
          <Felt label="Mellem (7–10 år)">
            <textarea
              value={f.body_da_medium ?? ""}
              onChange={(e) => setF({ ...f, body_da_medium: e.target.value })}
              rows={3}
              className="hv-input w-full rounded-2xl px-3.5 py-2.5 text-sm"
            />
          </Felt>
          <Felt label="Dyb (11–14 år)">
            <textarea
              value={f.body_da_deep ?? ""}
              onChange={(e) => setF({ ...f, body_da_deep: e.target.value })}
              rows={3}
              className="hv-input w-full rounded-2xl px-3.5 py-2.5 text-sm"
            />
          </Felt>
        </div>
      </details>

      <div className="mt-2 grid grid-cols-2 gap-2">
        <Felt label="Aldersspænd">
          <select
            value={f.alder}
            onChange={(e) => setF({ ...f, alder: e.target.value as AlderKey })}
            className="hv-input w-full rounded-2xl px-3 py-2.5 text-sm"
          >
            {ALDERSSPAEND.map((a) => (
              <option key={a.value} value={a.value}>
                {a.label}
              </option>
            ))}
          </select>
        </Felt>
        <Felt label="Niveau (sprog)">
          <select
            value={f.level}
            onChange={(e) => setF({ ...f, level: Number(e.target.value) as 1 | 2 | 3 | 4 })}
            className="hv-input w-full rounded-2xl px-3 py-2.5 text-sm"
          >
            {[1, 2, 3, 4].map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </Felt>
      </div>

      <div className="hv-quiz-section rounded-3xl p-3.5">
        <p className="text-sm font-extrabold hv-quiz-title">🧠 "Hvad husker du?" — quiz pr. aldersgruppe</p>
        <p className="hv-felthint">
          Samme mur som teksten ovenfor. <b>Fælles</b> vises til alle aldre, medmindre du udfylder en
          aldersvariant — så får netop den gruppe sin egen quiz (samme princip som tekstens
          simpel/mellem/dyb). Hvert spørgsmål: mindst 2 svar, præcis ét rigtigt.
        </p>

        <div className="flex flex-wrap gap-1.5 mt-2" role="tablist" aria-label="Quiz-variant">
          {QUIZ_VARIANTER.map((v) => (
            <button
              key={v.key}
              type="button"
              role="tab"
              aria-selected={aktivVariant === v.key}
              onClick={() => setAktivVariant(v.key)}
              className={`hv-vtab rounded-full px-3 py-1.5 text-xs font-bold ${aktivVariant === v.key ? "hv-vtab-on" : ""}`}
            >
              {v.label}
              {quiz[v.key].length > 0 && <span className="hv-vtab-count">{quiz[v.key].length}</span>}
            </button>
          ))}
        </div>

        {quiz[aktivVariant].length === 0 ? (
          <p className="hv-felthint mt-2">
            Ingen spørgsmål i denne variant endnu — helt valgfrit.{" "}
            {aktivVariant !== "faelles"
              ? "Uden spørgsmål her får aldersgruppen den fælles quiz."
              : "Tryk “+ Tilføj spørgsmål” for at starte."}
          </p>
        ) : (
          quiz[aktivVariant].map((q, qi) => (
            <div key={qi} className="hv-quiz-q rounded-2xl p-3 mt-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="hv-dim text-xs font-bold">Spørgsmål {qi + 1}</span>
                <button
                  type="button"
                  onClick={() => fjernSpørgsmål(qi)}
                  className="hv-q-remove"
                  aria-label={`Fjern spørgsmål ${qi + 1}`}
                >
                  ✕
                </button>
              </div>
              <Felt label="Spørgsmål (dansk)">
                <input
                  value={q.question_da}
                  onChange={(e) => opdaterSpørgsmålTekst(qi, e.target.value)}
                  placeholder="Fx: Hvad husker du bedst fra fortællingen?"
                  className="hv-input w-full rounded-2xl px-3.5 py-2.5 text-sm"
                />
              </Felt>
              <p className="hv-felthint mt-2">Svarmuligheder — vælg det ét rigtige svar med prikken:</p>
              {q.options.map((o, oi) => (
                <div key={oi} className="flex items-center gap-2 mt-1.5">
                  <input
                    type="radio"
                    name={`hv-correct-${aktivVariant}-${qi}`}
                    checked={o.correct}
                    onChange={() => sætKorrekt(qi, oi)}
                    aria-label={`Markér svarmulighed ${oi + 1} som rigtig`}
                    className="hv-radio"
                  />
                  <input
                    value={o.text_da}
                    onChange={(e) => opdaterSvarTekst(qi, oi, e.target.value)}
                    placeholder={`Svarmulighed ${oi + 1}`}
                    className="hv-input flex-1 rounded-2xl px-3.5 py-2 text-sm"
                  />
                  {q.options.length > 2 && (
                    <button
                      type="button"
                      onClick={() => fjernSvarmulighed(qi, oi)}
                      className="hv-opt-remove"
                      aria-label={`Fjern svarmulighed ${oi + 1}`}
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
              <div className="mt-2">
                <button
                  type="button"
                  onClick={() => tilføjSvarmulighed(qi)}
                  disabled={q.options.length >= 5}
                  className="hv-btn"
                >
                  + Svarmulighed
                </button>
              </div>
            </div>
          ))
        )}

        <div className="mt-2.5">
          <button type="button" onClick={tilføjSpørgsmål} disabled={quiz[aktivVariant].length >= 5} className="hv-btn">
            + Tilføj spørgsmål
          </button>
        </div>
      </div>

      <Felt label="Verden">
        <div className="hv-laast rounded-2xl">🔒 Historiernes Bjerge — låst for aqidah</div>
      </Felt>

      <Felt label="De hellige">
        <div className="hv-laast rounded-2xl">🔒 Kun som lys — låst i databasen (sacred_representation = 'light')</div>
        <p className="hv-felthint">
          Profeten ﷺ og de 12 imamer afbildes aldrig som skikkelse. Illustrationer viser lys, kalligrafi og miljø.
        </p>
      </Felt>

      {err && (
        <p className="hv-err text-sm" role="alert">
          {err}
        </p>
      )}

      <div className="mt-2 flex gap-2">
        <button type="button" disabled={busy} onClick={() => void onSave()} className="hv-btn hv-btn-guld flex-1">
          {busy ? "Gemmer…" : "Gem kladde"}
        </button>
        <button type="button" onClick={() => hv.cancelEdit()} className="hv-btn">
          Annullér
        </button>
      </div>
    </div>
  );
}

function Felt({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="mt-2 flex flex-col gap-1 text-xs font-semibold text-[#c9a46b]">
      <span>
        {label} {required && <b className="text-[#f0937b]">*</b>}
      </span>
      {children}
    </label>
  );
}
