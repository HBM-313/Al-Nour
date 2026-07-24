/**
 * itemStats — fire-and-forget skrivning til profile_item_stats.
 *
 * Leverance D1 (plan-boernesession-og-dashboard.md §6.2): rene tællere
 * pr. barn × item (bogstav eller ord), grundlaget for forælder-dashboardets
 * kommende "her kæmper barnet"-visning (D2). Kaldes af de tre spil (Lyt &
 * Find, Tegn Bogstavet, Match-par) hver gang et bogstav/ord vises OG
 * besvares endeligt.
 *
 * Bevidst LETTERE end lib/progress.ts's offline-kø (progressQueue/
 * IndexedDB): en tabt item-stat-tælling er lavt-risiko — ren statistik,
 * ingen XP/streak/completion involveret — så det ville være unødvendig
 * kompleksitet at give den sin egen IndexedDB-lagerplads. Fejler kaldet
 * (offline/netværk), tabes blot dén ene tælling stille; spillet mærker
 * intet og blokerer aldrig. `record_item_stat`-RPC'en (SECURITY DEFINER,
 * samme tre-vejs ejerskabstjek som record_progress) står for selve
 * akkumuleringen.
 *
 * `correct`-flaget er BEVIDST strengere end spillets egen "rigtig/forkert"-
 * følelse: det betyder "besvaret uden at prøve forkert først" (firstTry),
 * ikke "endte med at blive rigtig". I soft-skindet, hvor barnet aldrig
 * ser en fejl-tilstand og bare prøver videre til det lykkes, ville
 * "endte rigtig" næsten altid være sandt og sige forælderen intet — men
 * "ramte den første gang" viser præcis det mønster planen efterspørger
 * ("Ali forveksler ofte ب og ت").
 */

import { supabase } from "@/lib/supabase";

export type ItemType = "letter" | "vocabulary";

export async function recordItemStat(
  profileId: string,
  itemType: ItemType,
  itemId: string,
  correct: boolean,
): Promise<void> {
  await supabase.rpc("record_item_stat", {
    p_profile_id: profileId,
    p_item_type: itemType,
    p_item_id: itemId,
    p_correct: correct,
  });
  // Ingen fejlhåndtering med vilje — se filens toppkommentar. supabase-js
  // afviser ikke løftet ved en Postgres-/netværksfejl (samme antagelse som
  // updateAccountLanguage i features/parent-auth/engine.ts), så der er
  // intet at fange; kaldestedet bruger `void` og venter aldrig på svaret.
}
