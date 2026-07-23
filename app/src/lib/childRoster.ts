/**
 * childRoster — enheds-lokal cache af familiens BØRNS grunddata
 * (Leverance B2, plan-boernesession-og-dashboard.md del 4 B2 + del 5.2;
 * fuldt TAGET I BRUG som picker-datakilde uden forælder-session i B4).
 *
 * Formål: lader profilvælgeren vises UDEN en levende forælder-session og
 * OFFLINE (efter mindst ét tidligere login på enheden, jf. del 5.2).
 *
 * ALDRIG pin_hash, ALDRIG noget om forælderen — kun det picker-skærmen
 * reelt skal vise: {profileId, displayName, avatar, hasPin}. `hasPin` er
 * IKKE følsom (afslører kun "denne profil er låst", aldrig hashen eller
 * selve koden) — det er samme oplysning som allerede står i den
 * RLS-hentede profilliste (`profile.pin_hash !== null`), blot husket
 * lokalt så picker'en kan vise pin-skærm-ELLER-direkte-login uden at
 * kunne læse `profiles`-tabellen (ingen forælder-session). Dette er
 * stadig ikke en sikkerhedsgrænse, kun en bekvemmeligheds-cache — data
 * er allerede synligt for enhver med adgang til enhedens skærm i dag.
 * Fail-soft overalt: localStorage kan mangle (privat browsing) uden at
 * blokere login.
 *
 * KENDT, ACCEPTERET DRIFT (dokumenteret, ikke løst her): sætter en
 * forælder et pin på en profil barnet allerede har cachet som ulåst,
 * viser roster'en `hasPin: false` indtil NÆSTE vellykkede login (som
 * altid skriver friske værdier). `usePinLogin` afbøder det værste
 * tilfælde (et dødt "prøv igen" på en tom kode) ved at falde tilbage til
 * pin-skærmen, hvis et tomt forsøg afvises — se pin-login/usePinLogin.ts.
 *
 * Lagernøglen er bumpet til v2 (hasPin er et NYT, PÅKRÆVET felt): gamle
 * v1-poster mangler det, og vi kan ikke gætte værdien sikkert. Bevidst
 * ren afskæring uden migrering — roster'en er kun en bekvemmeligheds-
 * cache, så det værste der sker er ét ekstra forældre-login på enheden.
 */

export interface RosterEntry {
  profileId: string;
  displayName: string;
  avatar: string | null;
  /** Skal barnet vises et pin-tastatur (true), eller logges direkte ind (false)? */
  hasPin: boolean;
}

const STORAGE_KEY = "nour_child_roster_v2";

function isRosterEntry(value: unknown): value is RosterEntry {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.profileId === "string" &&
    v.profileId.length > 0 &&
    typeof v.displayName === "string" &&
    (v.avatar === null || typeof v.avatar === "string") &&
    typeof v.hasPin === "boolean"
  );
}

function readRoster(): RosterEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isRosterEntry);
  } catch {
    return [];
  }
}

function writeRoster(entries: RosterEntry[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // Fail-soft: cachen er bekvemmelighed, ikke et krav for at logge ind.
  }
}

/** Alle børn der har logget ind på denne enhed før. */
export function getChildRoster(): RosterEntry[] {
  return readRoster();
}

/** Husk/opdatér én profil — kaldes ved hvert vellykkede barne-login. */
export function rememberChildInRoster(entry: RosterEntry): void {
  // Hvidliste, ikke tillid til kalderen: rekonstruér et rent objekt med
  // KUN de tre tilladte felter, uanset hvad et fremtidigt kald måtte
  // (fejlagtigt) sende med — samme mønster som sanitizeErrorPayload.
  const clean: RosterEntry = {
    profileId: entry.profileId,
    displayName: entry.displayName,
    avatar: entry.avatar,
    hasPin: entry.hasPin,
  };
  const current = readRoster().filter((e) => e.profileId !== clean.profileId);
  current.push(clean);
  writeRoster(current);
}

/** "Glem denne enhed" (forældre-portalen) — rydder hele familiens cache. */
export function forgetDeviceRoster(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // no-op — intet at rydde, eller localStorage utilgængeligt.
  }
}
