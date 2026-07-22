/**
 * errorLog — fail-soft fejllogning til `error_log`-tabellen.
 *
 * DATAMINIMERING (kritisk): sanitizeErrorPayload er en HÅNDSKREVET
 * feltliste, ikke en spread af input. Selv hvis en kalder ved en fejl
 * sender ekstra felter med (fx et profil-id), forlader de aldrig denne
 * funktion — kun message/component/age_skin kan nogensinde nå frem.
 * Tabellen har heller ikke kolonner til andet (se migrationen).
 *
 * FAIL-SOFT (kritisk): reportError må ALDRIG kaste videre eller blokere
 * UI'et. Fejler selve logningen (netværk nede, RLS osv.), er det stille —
 * barnet skal aldrig opleve at "fejlloggeren fejlede" som en synlig fejl.
 */

import type { AgeSkin } from "@/lib/types";

const MAX_MESSAGE_LENGTH = 500;
const MAX_COMPONENT_LENGTH = 100;
const FALLBACK_MESSAGE = "Ukendt fejl";

export interface ErrorLogInput {
  message: string;
  component?: string;
  ageSkin?: AgeSkin;
}

export interface ErrorLogPayload {
  message: string;
  component: string | null;
  age_skin: AgeSkin | null;
}

export interface ErrorLogSenderResult {
  error: { message: string } | null;
}

/** Injicerbar afsender, så reportError kan testes uden Supabase/DOM. */
export type ErrorLogSender = (
  payload: ErrorLogPayload,
) => Promise<ErrorLogSenderResult>;

/**
 * Dataminimerings-hvidliste. Kun disse tre felter — aldrig profil-id,
 * konto-id, navn eller andet persondata, uanset hvad input indeholder.
 */
export function sanitizeErrorPayload(input: ErrorLogInput): ErrorLogPayload {
  const rawMessage =
    typeof input.message === "string" && input.message.length > 0
      ? input.message
      : FALLBACK_MESSAGE;
  const message = rawMessage.slice(0, MAX_MESSAGE_LENGTH);

  const component =
    typeof input.component === "string" && input.component.length > 0
      ? input.component.slice(0, MAX_COMPONENT_LENGTH)
      : null;

  const age_skin: AgeSkin | null =
    input.ageSkin === "soft" || input.ageSkin === "mid" || input.ageSkin === "teen"
      ? input.ageSkin
      : null;

  return { message, component, age_skin };
}

/** Lazy import: rører aldrig Supabase-klienten, medmindre den rent faktisk skal bruges. */
async function defaultSender(payload: ErrorLogPayload): Promise<ErrorLogSenderResult> {
  const { supabase } = await import("@/lib/supabase");
  const { error } = await supabase.from("error_log").insert(payload);
  return { error: error ? { message: error.message } : null };
}

export async function reportError(
  input: ErrorLogInput,
  sender: ErrorLogSender = defaultSender,
): Promise<void> {
  try {
    const payload = sanitizeErrorPayload(input);
    const { error } = await sender(payload);
    if (error) {
      // Fail-soft: konsollen er det værste der sker, aldrig en ny kastet fejl.
      console.error("[error_log] kunne ikke skrive fejlrække:", error.message);
    }
  } catch (loggingFailure) {
    console.error("[error_log] logning fejlede uventet:", loggingFailure);
  }
}
