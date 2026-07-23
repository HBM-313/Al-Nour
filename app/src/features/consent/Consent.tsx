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
import { useT } from "@/lib/i18n";
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
  const t = useT("da");

  return (
    <div className="flex flex-col items-center gap-5 py-2 text-left">
      <div className="text-center">
        <div className="auth-welcome-glow mx-auto size-14 rounded-full" aria-hidden />
        <h2 className="auth-title mt-3 text-xl font-bold">{t.consent.heading}</h2>
        <p className="auth-sub mt-1 text-sm">{t.consent.subheading}</p>
      </div>

      <div className="consent-textbox w-full rounded-(--radius-skin) p-4 text-sm">
        <h3>{t.consent.whatWeStoreHeading}</h3>
        <ul>
          <li>{t.consent.storeNickname}</li>
          <li>{t.consent.storeBirthYear}</li>
          <li>{t.consent.storeAvatar}</li>
          <li>{t.consent.storeProgress}</li>
        </ul>
        <p>{t.consent.neverAskText}</p>

        <h3>{t.consent.legalBasisHeading}</h3>
        <p>{t.consent.legalBasisText}</p>

        <h3>{t.consent.whereDataLivesHeading}</h3>
        <p>{t.consent.whereDataLivesText}</p>

        <h3>{t.consent.noAdsHeading}</h3>
        <p>{t.consent.noAdsText}</p>

        <h3>{t.consent.rightsHeading}</h3>
        <p>{t.consent.rightsText}</p>

        <div className="consent-warning">{t.consent.legalWarning}</div>

        <div className="consent-version">{t.consent.versionLabel(CONSENT_VERSION)}</div>
      </div>

      <label className="consent-checkbox-row flex w-full items-start gap-2.5">
        <input
          type="checkbox"
          checked={accepted}
          onChange={(e) => setAccepted(e.target.checked)}
          className="consent-checkbox"
        />
        <span className="text-sm">{t.consent.checkboxLabel}</span>
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
        {loading ? t.consent.registering : t.consent.submitButton}
      </button>
    </div>
  );
}
