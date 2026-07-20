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
import type { Account, Content } from "@/lib/types";
import { ALDERSSPAEND, type AlderKey, type AqidahDraftInput } from "./engine";
import { useHistorieVaerksted, type StatusFilter } from "./useHistorieVaerksted";
import "./historie-vaerksted.css";

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
        }
      : TOM,
  );
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
    setBusy(true);
    const saveError = await save(
      {
        ...f,
        title_da: f.title_da.trim(),
        title_ar: f.title_ar?.trim() || null,
        source_reference: f.source_reference.trim(),
        body_da: f.body_da.trim(),
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
