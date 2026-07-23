/**
 * childRoster — enheds-lokal cache af familiens BØRNS grunddata
 * (Leverance B2, plan-boernesession-og-dashboard.md del 4 B2 + del 5.2).
 *
 * Formål: lader profilvælgeren på sigt vises UDEN en levende forælder-
 * session og OFFLINE. Denne fil bygger kun selve lageret og skrives til
 * ved hvert vellykkede barne-login — at boote appen DIREKTE på roster'en
 * i stedet for forælder-login er Leverance B4, ikke denne.
 *
 * ALDRIG pin_hash, ALDRIG noget om forælderen — kun det picker-skærmen
 * reelt skal vise: {profileId, displayName, avatar}. Dette er ikke en
 * sikkerhedsgrænse (data er allerede synligt for enhver med adgang til
 * enhedens skærm i dag), kun en bekvemmeligheds-cache. Fail-soft overalt:
 * localStorage kan mangle (privat browsing) uden at blokere login.
 */

export interface RosterEntry {
  profileId: string;
  displayName: string;
  avatar: string | null;
}

const STORAGE_KEY = "nour_child_roster_v1";

function isRosterEntry(value: unknown): value is RosterEntry {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.profileId === "string" &&
    v.profileId.length > 0 &&
    typeof v.displayName === "string" &&
    (v.avatar === null || typeof v.avatar === "string")
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
