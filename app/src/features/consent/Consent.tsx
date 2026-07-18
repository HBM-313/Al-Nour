/**
 * Consent — samtykke-skærm (plan-samtykke-flow.md, leverance B).
 *
 * Vises inde i ParentAuth's Welcome-visning når account.consent_given_at
 * er null — dvs. efter login, FØR første barneprofil kan oprettes. Design
 * portet 1:1 fra ejer-godkendt demo (nour-samtykke-demo.html): genbruger
 * parent-auth's nattehimmel/guld-tokens (auth-*-klasser i parent-auth.css)
 * plus et par samtykke-specifikke klasser i consent.css.
 *
 * ⚠️ Samtykketeksten er et fagligt udkast ud fra projektets principper
 * (dataminimering, EU-hosting, ingen tracking) — ikke juridisk rådgivning.
 * Ejeren har godkendt ordlyden (2026-07-19); anbefal juridisk gennemsyn
 * før offentlig lancering.
 *
 * MUREN: rører kun accounts (GDPR-samtykke) — aldrig content/aqidah.
 */

import { useState } from "react";
import type { Account } from "@/lib/types";
import { useConsent } from "./useConsent";
import { CONSENT_VERSION } from "./engine";
import "./consent.css";

export interface ConsentProps {
  account: Account;
  onConsented: (account: Account) => void;
}

export function Consent({ account, onConsented }: ConsentProps) {
  const [accepted, setAccepted] = useState(false);
  const { phase, errorMessage, submit } = useConsent({ onConsented });
  const loading = phase === "submitting";

  return (
    <div className="flex flex-col items-center gap-5 py-2 text-left">
      <div className="text-center">
        <div className="auth-welcome-glow mx-auto size-14 rounded-full" aria-hidden />
        <h2 className="auth-title mt-3 text-xl font-bold">Samtykke til Nour</h2>
        <p className="auth-sub mt-1 text-sm">
          Før vi opretter din første børneprofil, skal vi lige have din tilladelse.
        </p>
      </div>

      <div className="consent-textbox w-full rounded-(--radius-skin) p-4 text-sm">
        <h3>Det vi gemmer om dit barn</h3>
        <ul>
          <li>Kaldenavn (ikke fulde navn)</li>
          <li>Fødselsår (kun til rette indholdsniveau)</li>
          <li>Valgt avatar</li>
          <li>Fremskridt i lektionerne</li>
        </ul>
        <p>
          Vi beder aldrig om adresse, telefonnummer, billeder eller e-mail på barnet. Barnet
          opretter aldrig selv en konto.
        </p>

        <h3>Retsgrundlag</h3>
        <p>
          Vi behandler oplysningerne, fordi du som forælder giver samtykke. Du kan altid trække
          det tilbage.
        </p>

        <h3>Hvor data ligger</h3>
        <p>Hos Supabase i EU (Frankfurt). Ingen data forlader EU.</p>

        <h3>Ingen reklamer, intet sporing</h3>
        <p>Nour viser aldrig reklamer og sporer ikke dit barns adfærd til markedsføring.</p>

        <h3>Dine rettigheder</h3>
        <p>
          Du kan altid se, rette eller slette dit barns profil. Sletning fjerner al data
          permanent med ét klik — kan ikke fortrydes.
        </p>

        <div className="consent-warning">
          ⚠️ Dette er et udkast udarbejdet ud fra projektets principper — ikke juridisk
          rådgivning. Bør gennemgås juridisk før offentlig lancering.
        </div>

        <div className="consent-version">Version: {CONSENT_VERSION}</div>
      </div>

      <label className="consent-checkbox-row flex w-full items-start gap-2.5">
        <input
          type="checkbox"
          checked={accepted}
          onChange={(e) => setAccepted(e.target.checked)}
          className="consent-checkbox"
        />
        <span className="text-sm">
          Jeg er barnets forælder eller værge, og jeg giver samtykke som beskrevet ovenfor.
        </span>
      </label>

      <div aria-live="polite" className="w-full">
        {errorMessage ? (
          <p className="auth-msg-error rounded-(--radius-skin) px-3 py-2.5 text-sm">
            {errorMessage}
          </p>
        ) : null}
      </div>

      <button
        type="button"
        disabled={!accepted || loading}
        onClick={() => void submit(account.id)}
        className="auth-submit flex w-full items-center justify-center gap-2 rounded-(--radius-skin) py-3 text-sm font-bold"
      >
        {loading ? <span className="auth-spinner size-3.5" aria-hidden /> : null}
        {loading ? "Registrerer …" : "Jeg giver samtykke og fortsætter"}
      </button>
    </div>
  );
}
