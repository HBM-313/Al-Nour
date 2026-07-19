/**
 * App — Nours rigtige indgang.
 *
 * Fundament-demoen (aldersskind-kontakter, frit spil, testprofil-sektioner)
 * er afløst af AppShell (milepælen "Barnets rejse → profilen", ejer-godkendt
 * demo nour-app-skal-demo.html): landing → forælder-login/samtykke/dashboard
 * → børne-indgang (dyre-pin) → lukket børne-tilstand på barnets profil —
 * eller gæste-sti ("prøv uden konto") med lokal-gem og "gem dit lys"-
 * opfordring.
 */

import { AppShell } from "@/features/app-shell";

export default function App() {
  return <AppShell />;
}
