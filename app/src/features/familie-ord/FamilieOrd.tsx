/**
 * FamilieOrd — "Familieord"-sektionen i forældre-dashboardet (Leverance D4,
 * plan-boernesession-og-dashboard.md §6.5). Portet 1:1 fra ejer-godkendt
 * demo (nour-familieord-demo.html).
 *
 * Familie-niveau, ikke barne-niveau: sektionen lever i Dashboard.tsx's
 * scene-rod (ved siden af børnelisten), ikke inde i et ChildCard — ordene
 * tilhører account_id (forælderens konto), ikke ét specifikt barn.
 */

import { useMemo, useState } from "react";
import type { CustomWord, Letter } from "@/lib/types";
import { useLanguage, type Dictionary } from "@/lib/i18n";
import {
  VOCAB_CATEGORIES,
  detectFirstLetter,
  hasArabicScript,
  isDuplicateWord,
  type CustomWordInput,
  type VocabCategory,
} from "./engine";
import { useFamilieOrd } from "./useFamilieOrd";
import "./familie-ord.css";

export interface FamilieOrdProps {
  accountId: string;
}

export function FamilieOrd({ accountId }: FamilieOrdProps) {
  const fo = useFamilieOrd(accountId);
  const { state, toggleOpen, openForm, closeForm, save, remove } = fo;
  const { t } = useLanguage();

  return (
    <div className="flex w-full flex-col gap-3">
      <button
        type="button"
        onClick={toggleOpen}
        className={`fo-toggle flex w-full items-center justify-between rounded-2xl px-4 py-3 text-sm font-bold ${state.open ? "fo-toggle-on" : ""}`}
        aria-expanded={state.open}
      >
        <span>📖 {t.familieOrd.heading}</span>
        <span aria-hidden>{state.open ? "▲" : "▼"}</span>
      </button>

      {state.open && (
        <div className="fo-card rounded-(--radius-skin) p-4">
          <p className="fo-dim mb-3 text-xs leading-relaxed">{t.familieOrd.subtitle}</p>

          {state.loading && <p className="fo-dim py-4 text-center text-sm">{t.familieOrd.loading}</p>}
          {state.error && (
            <p className="fo-err py-2 text-center text-sm" role="alert">
              {state.error}
            </p>
          )}

          {!state.loading && !state.error && !state.formOpen && (
            <>
              <WordList words={state.words} onEdit={(w) => openForm(w)} onDelete={(w) => void remove(w)} t={t} />
              <button
                type="button"
                onClick={() => openForm(null)}
                className="fo-btn-gold mt-3 w-full rounded-2xl py-3 text-sm font-bold"
              >
                {t.familieOrd.addButton}
              </button>
            </>
          )}

          {state.formOpen && (
            <WordForm
              editing={state.editing}
              letters={state.letters}
              existing={state.words}
              saving={state.saving}
              onSave={save}
              onCancel={closeForm}
              t={t}
            />
          )}

          {!state.formOpen && (
            <p className="fo-wallnote mt-3 rounded-2xl px-4 py-3 text-xs leading-relaxed">
              <b>{t.familieOrd.wallNoteBold}</b> {t.familieOrd.wallNoteText}
            </p>
          )}
        </div>
      )}

      {state.notice && (
        <div className="fo-toast" role="status">
          {state.notice}
        </div>
      )}
    </div>
  );
}

// ----------------------------------------------------------------------------
// Ordliste
// ----------------------------------------------------------------------------

function WordList({
  words,
  onEdit,
  onDelete,
  t,
}: {
  words: CustomWord[];
  onEdit: (word: CustomWord) => void;
  onDelete: (word: CustomWord) => void;
  t: Dictionary;
}) {
  if (words.length === 0) {
    return (
      <p className="fo-dim py-2 text-center text-[13.5px] leading-relaxed">
        {t.familieOrd.emptyListLine1}
        <br />
        {t.familieOrd.emptyListLine2}
      </p>
    );
  }
  return (
    <div>
      {words.map((w) => (
        <div key={w.id} className="fo-row flex items-center gap-2.5 py-2.5">
          <div className="fo-emoji flex size-9 shrink-0 items-center justify-center rounded-xl text-xl" aria-hidden>
            {w.emoji || "💬"}
          </div>
          <div className="min-w-0 flex-1">
            <div className="fo-ar arabic" dir="rtl">
              {w.word_ar}
            </div>
            <div className="fo-translit text-[11px]">{w.transliteration}</div>
            <div className="fo-da text-[12px]">{w.word_da}</div>
            <div className="mt-1 flex flex-wrap gap-1">
              <span className="fo-badge rounded-full px-2 py-0.5">
                {w.category[0].toUpperCase() + w.category.slice(1)}
              </span>
              <span className="fo-badge fo-badge-level rounded-full px-2 py-0.5">{t.familieOrd.levelBadge(w.level)}</span>
              {w.register === "fusha" && <span className="fo-badge rounded-full px-2 py-0.5">{t.familieOrd.fushaBadge}</span>}
            </div>
          </div>
          <div className="flex shrink-0 gap-1.5">
            <button
              type="button"
              onClick={() => onEdit(w)}
              aria-label={t.familieOrd.editAriaLabel(w.word_da)}
              className="fo-icon-btn flex size-8 items-center justify-center rounded-lg text-sm"
            >
              ✏️
            </button>
            <button
              type="button"
              onClick={() => onDelete(w)}
              aria-label={t.familieOrd.deleteAriaLabel(w.word_da)}
              className="fo-icon-btn fo-icon-btn-danger flex size-8 items-center justify-center rounded-lg text-sm"
            >
              🗑️
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ----------------------------------------------------------------------------
// Tilføj/rediger-formular
// ----------------------------------------------------------------------------

function WordForm({
  editing,
  letters,
  existing,
  saving,
  onSave,
  onCancel,
  t,
}: {
  editing: CustomWord | null;
  letters: Letter[];
  existing: CustomWord[];
  saving: boolean;
  onSave: (input: CustomWordInput) => Promise<string | null>;
  onCancel: () => void;
  t: Dictionary;
}) {
  const [da, setDa] = useState(editing?.word_da ?? "");
  const [ar, setAr] = useState(editing?.word_ar ?? "");
  const [tr, setTr] = useState(editing?.transliteration ?? "");
  const [category, setCategory] = useState<VocabCategory>(editing?.category ?? "familie");
  const [level, setLevel] = useState(editing?.level ?? 1);
  const [register, setRegister] = useState<"fusha" | "everyday">(editing?.register ?? "everyday");
  const [emoji, setEmoji] = useState(editing?.emoji ?? "");
  const [err, setErr] = useState<string | null>(null);

  const detected = useMemo(() => detectFirstLetter(ar, letters), [ar, letters]);

  const dupMatch = useMemo(() => {
    const others = editing ? existing.filter((w) => w.id !== editing.id) : existing;
    if (!isDuplicateWord({ word_ar: ar, word_da: da }, others)) return null;
    return (
      others.find(
        (w) => w.word_da.trim().toLowerCase() === da.trim().toLowerCase() || w.word_ar === ar.trim(),
      ) ?? null
    );
  }, [ar, da, existing, editing]);

  const onSubmit = async () => {
    setErr(null);
    if (!da.trim()) {
      setErr(t.familieOrd.validationDanishRequired);
      return;
    }
    if (!ar.trim() || !hasArabicScript(ar)) {
      setErr(t.familieOrd.validationArabicRequired);
      return;
    }
    if (!tr.trim()) {
      setErr(t.familieOrd.validationTransliterationRequired);
      return;
    }
    if (dupMatch) {
      setErr(t.familieOrd.duplicateWarning(dupMatch.word_da, dupMatch.word_ar));
      return;
    }
    const saveError = await onSave({
      word_ar: ar.trim(),
      word_da: da.trim(),
      transliteration: tr.trim(),
      category,
      level,
      register,
      emoji: emoji.trim() || null,
      first_letter_id: detected?.id ?? null,
    });
    if (saveError) setErr(saveError);
  };

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-[15px] font-bold">{editing ? t.familieOrd.formHeadingEdit : t.familieOrd.formHeadingNew}</h3>
      <p className="fo-dim text-[12px]">{t.familieOrd.formSubtitle}</p>

      <Field label={t.familieOrd.danishWordLabel}>
        <input
          type="text"
          value={da}
          onChange={(e) => setDa(e.target.value)}
          className="fo-input w-full rounded-2xl px-4 py-2.5 text-sm"
        />
      </Field>

      <Field label={t.familieOrd.arabicWordLabel} hint={t.familieOrd.arabicWordHint}>
        <input
          type="text"
          value={ar}
          onChange={(e) => setAr(e.target.value)}
          lang="ar"
          dir="rtl"
          className="fo-input fo-input-ar arabic w-full rounded-2xl px-4 py-2.5"
        />
      </Field>

      <p className={`fo-letterhint flex min-h-[34px] items-center gap-2 rounded-2xl px-3 py-2 text-xs ${!ar.trim() ? "" : detected ? "" : "fo-letterhint-warn"}`}>
        {!ar.trim() ? (
          t.familieOrd.letterHintEmpty
        ) : detected ? (
          <>
            <span className="arabic text-base" aria-hidden>
              {detected.letter}
            </span>
            {t.familieOrd.letterHintPrefix}
            <b>{detected.name_da}</b>
          </>
        ) : (
          t.familieOrd.letterHintUnknown
        )}
      </p>

      <Field label={t.familieOrd.transliterationLabel}>
        <input
          type="text"
          value={tr}
          onChange={(e) => setTr(e.target.value)}
          className="fo-input w-full rounded-2xl px-4 py-2.5 text-sm"
        />
      </Field>

      <Field label={t.familieOrd.categoryLabel}>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as VocabCategory)}
          className="fo-input w-full rounded-2xl px-3 py-2.5 text-sm"
        >
          {VOCAB_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c[0].toUpperCase() + c.slice(1)}
            </option>
          ))}
        </select>
      </Field>

      <Field label={t.familieOrd.levelLabel}>
        <div className="grid grid-cols-4 gap-1.5">
          {[1, 2, 3, 4].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setLevel(n)}
              aria-pressed={level === n}
              className={`fo-pill rounded-xl py-2 text-[13px] font-bold ${level === n ? "fo-pill-on" : ""}`}
            >
              {n}
            </button>
          ))}
        </div>
      </Field>

      <Field label={t.familieOrd.registerLabel}>
        <div className="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            onClick={() => setRegister("everyday")}
            aria-pressed={register === "everyday"}
            className={`fo-pill rounded-xl py-2 text-[12.5px] font-semibold ${register === "everyday" ? "fo-pill-on" : ""}`}
          >
            {t.familieOrd.registerEveryday}
          </button>
          <button
            type="button"
            onClick={() => setRegister("fusha")}
            aria-pressed={register === "fusha"}
            className={`fo-pill rounded-xl py-2 text-[12.5px] font-semibold ${register === "fusha" ? "fo-pill-on" : ""}`}
          >
            {t.familieOrd.registerFusha}
          </button>
        </div>
      </Field>

      <Field label={t.familieOrd.emojiLabel} hint={t.familieOrd.emojiHint}>
        <input
          type="text"
          value={emoji}
          onChange={(e) => setEmoji(e.target.value)}
          maxLength={4}
          className="fo-input w-full rounded-2xl px-4 py-2.5 text-sm"
        />
      </Field>

      {err && (
        <p className="fo-err text-sm font-bold" role="alert">
          {err}
        </p>
      )}

      <button
        type="button"
        onClick={() => void onSubmit()}
        disabled={saving}
        className="fo-btn-gold w-full rounded-2xl py-3 text-base font-bold disabled:opacity-60"
      >
        {saving ? t.familieOrd.saving : editing ? t.familieOrd.saveChangesButton : t.familieOrd.saveButton}
      </button>
      <button type="button" onClick={onCancel} disabled={saving} className="fo-btn-ghost w-full rounded-2xl py-2.5 text-sm font-semibold">
        {t.familieOrd.cancelButton}
      </button>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-extrabold">
        {label} {hint && <span className="fo-dim font-semibold">{hint}</span>}
      </span>
      {children}
    </label>
  );
}
