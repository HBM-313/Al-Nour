/**
 * VokabVaerksted — Ordforråds-værkstedet (Leverance C).
 * Flow og funktioner portet 1:1 fra ejer-godkendt demo
 * (nour-vaerksted-demo.html); farvesceneri tilpasset forælder-portalens
 * nattehimmel/guld-tema så fanen føles som en del af samme rum.
 *
 * Vises KUN for admin/editor (styret i ParentAuth) — men adgangen håndhæves
 * af RLS i databasen, aldrig af UI'et.
 */

import { useMemo, useState } from "react";
import type { VocabularyWord } from "@/lib/types";
import { useLanguage, type Dictionary } from "@/lib/i18n";
import {
  VOCAB_CATEGORIES,
  detectFirstLetter,
  hasArabicScript,
  isDuplicateWord,
  type VocabCategory,
} from "./engine";
import { useVokabVaerksted, type StatusFilter } from "./useVokabVaerksted";
import "./vokab-vaerksted.css";

export function VokabVaerksted() {
  const vv = useVokabVaerksted();
  const { state, patch } = vv;
  const { t } = useLanguage();

  return (
    <div className="flex w-full flex-col gap-3 text-left">
      <div className="vv-tabs flex gap-2" role="tablist" aria-label={t.vokabVaerksted.tablistAriaLabel}>
        <TabButton id="liste" label={t.vokabVaerksted.tabList} current={state.tab} onPick={(tab) => patch({ tab })} />
        <TabButton id="nyt" label={t.vokabVaerksted.tabNew} current={state.tab} onPick={(tab) => patch({ tab })} />
        <TabButton id="ai" label={t.vokabVaerksted.aiSuggestions} current={state.tab} onPick={(tab) => patch({ tab })} />
      </div>

      {state.notice && (
        <p className="vv-notice rounded-2xl px-4 py-2.5 text-center text-sm font-semibold" role="status">
          {state.notice}
        </p>
      )}

      {state.loading && <p className="vv-dim py-6 text-center text-sm">{t.vokabVaerksted.loadingVocabulary}</p>}
      {state.error && (
        <p className="vv-err py-3 text-center text-sm" role="alert">
          {state.error}
        </p>
      )}

      {!state.loading && !state.error && state.tab === "liste" && <OrdListe vv={vv} t={t} />}
      {!state.loading && !state.error && state.tab === "nyt" && <NytOrd vv={vv} t={t} />}
      {!state.loading && !state.error && state.tab === "ai" && <AiForslag vv={vv} t={t} />}
    </div>
  );
}

type VV = ReturnType<typeof useVokabVaerksted>;

function TabButton({
  id,
  label,
  current,
  onPick,
}: {
  id: VV["state"]["tab"];
  label: string;
  current: VV["state"]["tab"];
  onPick: (t: VV["state"]["tab"]) => void;
}) {
  const selected = current === id;
  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      onClick={() => onPick(id)}
      className={`vv-tab flex-1 rounded-2xl py-2.5 text-sm font-bold ${selected ? "vv-tab-on" : ""}`}
    >
      {label}
    </button>
  );
}

/* ========================= Ordliste ========================= */

function OrdListe({ vv, t }: { vv: VV; t: Dictionary }) {
  const { state, patch, togglePublish } = vv;

  const rows = useMemo(() => {
    const q = state.search.trim().toLowerCase();
    return state.words
      .filter((w) => {
        if (state.statusFilter === "kladde" && w.is_published) return false;
        if (state.statusFilter === "udgivet" && !w.is_published) return false;
        if (state.statusFilter === "ai" && w.suggested_by !== "ai") return false;
        if (state.categoryFilter && w.category !== state.categoryFilter) return false;
        if (
          q &&
          !(
            w.word_da.toLowerCase().includes(q) ||
            w.word_ar.includes(state.search.trim()) ||
            w.transliteration.toLowerCase().includes(q)
          )
        )
          return false;
        return true;
      })
      .sort((a, b) =>
        a.is_published === b.is_published
          ? a.word_da.localeCompare(b.word_da, "da")
          : a.is_published
            ? 1
            : -1,
      );
  }, [state.words, state.search, state.statusFilter, state.categoryFilter]);

  return (
    <>
      <input
        type="text"
        value={state.search}
        onChange={(e) => patch({ search: e.target.value })}
        placeholder={t.vokabVaerksted.searchPlaceholder}
        aria-label={t.vokabVaerksted.searchAriaLabel}
        className="vv-input w-full rounded-2xl px-4 py-2.5 text-sm"
      />
      <div className="flex flex-wrap gap-1.5" role="group" aria-label={t.vokabVaerksted.statusGroupAriaLabel}>
        {(
          [
            ["alle", t.vokabVaerksted.statusAll],
            ["kladde", t.vokabVaerksted.statusDraft],
            ["udgivet", t.vokabVaerksted.statusPublished],
            ["ai", t.vokabVaerksted.aiSuggestions],
          ] as [StatusFilter, string][]
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            aria-pressed={state.statusFilter === id}
            onClick={() => patch({ statusFilter: id })}
            className={`vv-chip rounded-full px-3 py-1.5 text-xs font-bold ${state.statusFilter === id ? "vv-chip-on" : ""}`}
          >
            {label}
          </button>
        ))}
      </div>
      <select
        value={state.categoryFilter}
        onChange={(e) => patch({ categoryFilter: e.target.value as VocabCategory | "" })}
        aria-label={t.vokabVaerksted.categoryFilterAriaLabel}
        className="vv-input w-full rounded-2xl px-3 py-2.5 text-sm"
      >
        <option value="">{t.vokabVaerksted.allCategories}</option>
        {VOCAB_CATEGORIES.map((c) => (
          <option key={c} value={c}>
            {c[0].toUpperCase() + c.slice(1)}
          </option>
        ))}
      </select>

      {rows.length === 0 ? (
        <p className="vv-dim py-6 text-center text-sm">{t.vokabVaerksted.emptyList}</p>
      ) : (
        rows.map((w) => <WordCard key={w.id} word={w} onToggle={() => void togglePublish(w)} t={t} />)
      )}
    </>
  );
}

function WordCard({ word, onToggle, t }: { word: VocabularyWord; onToggle: () => void; t: Dictionary }) {
  return (
    <div className={`vv-card flex items-center gap-3 rounded-3xl p-3.5 ${word.is_published ? "vv-published" : ""}`}>
      <span className="vv-lamp" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="vv-ar arabic" dir="rtl" lang="ar">
          {word.word_ar}
        </p>
        <p className="text-sm font-extrabold">
          {word.emoji ? `${word.emoji} ` : ""}
          {word.word_da}
        </p>
        <p className="vv-dim text-xs italic">
          {word.transliteration} · {t.vokabVaerksted.levelAndRegister(word.level, word.register)}
        </p>
        <div className="mt-1.5 flex flex-wrap gap-1">
          <span className="vv-badge vv-b-cat">{word.category}</span>
          {word.is_published ? (
            <span className="vv-badge vv-b-pub">{t.vokabVaerksted.publishedBadge}</span>
          ) : (
            <span className="vv-badge vv-b-draft">{t.vokabVaerksted.draftBadge}</span>
          )}
          {word.suggested_by === "ai" && <span className="vv-badge vv-b-ai">{t.vokabVaerksted.aiSuggestions}</span>}
          {!word.audio_media_id && <span className="vv-badge vv-b-noaudio">{t.vokabVaerksted.noAudioBadge}</span>}
        </div>
      </div>
      <button
        type="button"
        onClick={onToggle}
        className={`vv-btn flex-none rounded-xl px-3 py-2 text-xs font-bold ${word.is_published ? "vv-btn-ghost" : "vv-btn-gold"}`}
      >
        {word.is_published ? t.vokabVaerksted.unpublishButton : t.vokabVaerksted.publishButton}
      </button>
    </div>
  );
}

/* ========================= Nyt ord ========================= */

function NytOrd({ vv, t }: { vv: VV; t: Dictionary }) {
  const { state, saveDraft } = vv;
  const [ar, setAr] = useState("");
  const [da, setDa] = useState("");
  const [tr, setTr] = useState("");
  const [category, setCategory] = useState<VocabCategory>("familie");
  const [level, setLevel] = useState(1);
  const [register, setRegister] = useState<"fusha" | "everyday">("fusha");
  const [emoji, setEmoji] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const detected = useMemo(() => detectFirstLetter(ar, state.letters), [ar, state.letters]);

  const onSave = async () => {
    setErr(null);
    if (!ar.trim() || !hasArabicScript(ar)) {
      setErr(t.vokabVaerksted.validationArabicRequired);
      return;
    }
    if (!da.trim()) {
      setErr(t.vokabVaerksted.validationDanishRequired);
      return;
    }
    if (!tr.trim()) {
      setErr(t.vokabVaerksted.validationTransliterationRequired);
      return;
    }
    if (isDuplicateWord({ word_ar: ar, word_da: da }, state.words)) {
      setErr(t.vokabVaerksted.validationDuplicate);
      return;
    }
    if (!detected) {
      setErr(t.vokabVaerksted.validationLetterNotDetected);
      return;
    }
    setBusy(true);
    const saveError = await saveDraft({
      word_ar: ar.trim(),
      word_da: da.trim(),
      transliteration: tr.trim(),
      category,
      level,
      register,
      emoji: emoji.trim() || null,
      first_letter_id: detected.id,
    });
    setBusy(false);
    if (saveError) {
      setErr(saveError);
      return;
    }
    setAr("");
    setDa("");
    setTr("");
    setEmoji("");
  };

  return (
    <div className="vv-card flex flex-col gap-3 rounded-3xl p-4">
      <Field label={t.vokabVaerksted.arabicWordLabel} hint={t.vokabVaerksted.arabicWordHint}>
        <input
          type="text"
          value={ar}
          onChange={(e) => setAr(e.target.value)}
          lang="ar"
          dir="rtl"
          placeholder="مِثَال"
          className="vv-input vv-input-ar arabic w-full rounded-2xl px-4 py-2.5"
        />
      </Field>
      {detected && (
        <p className="vv-letterhint flex items-center gap-2 rounded-2xl px-3 py-2 text-xs">
          <span className="arabic text-xl leading-none" aria-hidden>
            {detected.letter}
          </span>
          {t.vokabVaerksted.letterHintPrefix}
          <b>{detected.name_da}</b>
        </p>
      )}
      <Field label={t.vokabVaerksted.danishMeaningLabel}>
        <input
          type="text"
          value={da}
          onChange={(e) => setDa(e.target.value)}
          placeholder="eksempel"
          className="vv-input w-full rounded-2xl px-4 py-2.5 text-sm"
        />
      </Field>
      <Field label={t.vokabVaerksted.transliterationLabel} hint={t.vokabVaerksted.transliterationHint}>
        <input
          type="text"
          value={tr}
          onChange={(e) => setTr(e.target.value)}
          placeholder="mithaal"
          className="vv-input w-full rounded-2xl px-4 py-2.5 text-sm"
        />
      </Field>
      <div className="flex gap-2">
        <Field label={t.vokabVaerksted.categoryLabel} className="flex-1">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as VocabCategory)}
            className="vv-input w-full rounded-2xl px-3 py-2.5 text-sm"
          >
            {VOCAB_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c[0].toUpperCase() + c.slice(1)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t.vokabVaerksted.levelLabel} className="flex-1">
          <select
            value={level}
            onChange={(e) => setLevel(Number(e.target.value))}
            className="vv-input w-full rounded-2xl px-3 py-2.5 text-sm"
          >
            {[1, 2, 3, 4].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <div className="flex gap-2">
        <Field label={t.vokabVaerksted.registerLabel} className="flex-1">
          <select
            value={register}
            onChange={(e) => setRegister(e.target.value as "fusha" | "everyday")}
            className="vv-input w-full rounded-2xl px-3 py-2.5 text-sm"
          >
            <option value="fusha">{t.vokabVaerksted.registerFusha}</option>
            <option value="everyday">{t.vokabVaerksted.registerEveryday}</option>
          </select>
        </Field>
        <Field label={t.vokabVaerksted.emojiLabel} hint={t.vokabVaerksted.emojiHint} className="flex-1">
          <input
            type="text"
            value={emoji}
            onChange={(e) => setEmoji(e.target.value)}
            maxLength={4}
            placeholder="🌟"
            className="vv-input w-full rounded-2xl px-4 py-2.5 text-sm"
          />
        </Field>
      </div>

      {err && (
        <p className="vv-err text-sm font-bold" role="alert">
          {err}
        </p>
      )}
      <button
        type="button"
        onClick={() => void onSave()}
        disabled={busy}
        className="vv-btn vv-btn-gold w-full rounded-2xl py-3 text-base font-bold disabled:opacity-60"
      >
        {busy ? t.vokabVaerksted.saving : t.vokabVaerksted.saveDraft}
      </button>
      <p className="vv-dim text-center text-xs leading-relaxed">{t.vokabVaerksted.newWordFooterNote}</p>
    </div>
  );
}

function Field({
  label,
  hint,
  className,
  children,
}: {
  label: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`flex flex-col gap-1.5 ${className ?? ""}`}>
      <span className="text-xs font-extrabold">
        {label} {hint && <span className="vv-dim font-semibold">{hint}</span>}
      </span>
      {children}
    </label>
  );
}

/* ========================= AI-forslag ========================= */

function AiForslag({ vv, t }: { vv: VV; t: Dictionary }) {
  const { state, loadSuggestions, saveSuggestion, discardSuggestion } = vv;
  const [category, setCategory] = useState<VocabCategory>("dyr");
  const [count, setCount] = useState(5);

  return (
    <>
      <p className="vv-wallnote rounded-2xl px-4 py-3 text-xs leading-relaxed">
        <b>{t.vokabVaerksted.aiWallNoteBold}</b> {t.vokabVaerksted.aiWallNoteText}{" "}
        <span className="vv-badge vv-b-ai">{t.vokabVaerksted.aiSuggestions}</span>
        {t.vokabVaerksted.aiWallNoteSuffix}
      </p>
      <div className="vv-card flex flex-col gap-3 rounded-3xl p-4">
        <div className="flex gap-2">
          <Field label={t.vokabVaerksted.categoryLabel} className="flex-1">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as VocabCategory)}
              className="vv-input w-full rounded-2xl px-3 py-2.5 text-sm"
            >
              {VOCAB_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c[0].toUpperCase() + c.slice(1)}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t.vokabVaerksted.suggestionCountLabel} className="flex-1">
            <select
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
              className="vv-input w-full rounded-2xl px-3 py-2.5 text-sm"
            >
              <option value={3}>3</option>
              <option value={5}>5</option>
            </select>
          </Field>
        </div>
        <button
          type="button"
          onClick={() => void loadSuggestions(category, count)}
          disabled={state.aiLoading}
          className="vv-btn vv-btn-gold w-full rounded-2xl py-3 text-base font-bold disabled:opacity-60"
        >
          {state.aiLoading ? t.vokabVaerksted.aiThinking : t.vokabVaerksted.fetchSuggestions}
        </button>
      </div>

      {state.aiError && (
        <p className="vv-err py-2 text-center text-sm" role="alert">
          {state.aiError}
        </p>
      )}
      {!state.aiLoading && !state.aiError && state.suggestions.length === 0 && (
        <p className="vv-dim py-4 text-center text-xs">{t.vokabVaerksted.suggestionsEmptyState}</p>
      )}

      {state.suggestions.map((s) => {
        const detected = detectFirstLetter(s.word_ar, state.letters);
        return (
          <div key={s.word_ar} className="vv-card vv-sugg flex items-center gap-3 rounded-3xl p-3.5">
            <div className="min-w-0 flex-1">
              <p className="vv-ar arabic" dir="rtl" lang="ar">
                {s.word_ar}
              </p>
              <p className="text-sm font-extrabold">
                {s.emoji ? `${s.emoji} ` : ""}
                {s.word_da}
              </p>
              <p className="vv-dim text-xs italic">
                {s.transliteration}
                {detected ? t.vokabVaerksted.linkedToLetter(detected.name_da) : ""}
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1">
                <span className="vv-badge vv-b-ai">{t.vokabVaerksted.aiSuggestions}</span>
                <span className="vv-badge vv-b-draft">{t.vokabVaerksted.draftBadgeToSave}</span>
              </div>
            </div>
            <div className="flex flex-none flex-col gap-1.5">
              <button
                type="button"
                onClick={() => void saveSuggestion(s, category, detected?.id ?? null)}
                className="vv-btn vv-btn-gold rounded-xl px-3 py-2 text-xs font-bold"
              >
                {t.vokabVaerksted.saveSuggestionButton}
              </button>
              <button
                type="button"
                onClick={() => discardSuggestion(s)}
                className="vv-btn vv-btn-danger rounded-xl px-3 py-2 text-xs font-bold"
              >
                {t.vokabVaerksted.discardSuggestion}
              </button>
            </div>
          </div>
        );
      })}
    </>
  );
}
