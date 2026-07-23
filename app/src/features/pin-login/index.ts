export { PinLogin } from "./PinLogin";
export type { PinLoginProps } from "./PinLogin";
// Kontrakter genbrugt af features/opret-profil (samme pool-index-kontrakt):
export { ANIMAL_POOL, setPin } from "./engine";
// Kontrakt genbrugt af app-shell (session-udstedelse, Leverance B2):
export type { ChildSigninCredentials } from "./engine";
// Fælles kort-format + konvertering fra hhv. RLS-profil og enheds-roster
// (Leverance B4) — app-shell bygger picker-listen af begge kilder.
export {
  pinLoginProfileFromProfile,
  pinLoginProfileFromRoster,
} from "./engine";
export type { PinLoginProfile } from "./engine";
