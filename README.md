# Nour (نور) — Al-Nour

Gratis, dansk-dominant tosproget læringsplatform for børn (3–14 år): arabisk sprog, shia-islamisk viden og akhlaq. Kvalitet før tempo.

## Struktur

```
supabase/migrations/   Fase 0-skema: tabeller, RLS, aqidah-mur-trigger
app/                   React + Vite + Tailwind v4 + PWA frontend
```

## Den hellige grænse (vigtigst)

To indholdstyper der aldrig blandes:

- **Aqidah** (12 imamer, tawhid, teologiske fakta): aldrig AI-genereret. Håndhævet i tre lag:
  1. **Database:** RLS-policies + `enforce_aqidah_wall`-trigger (`supabase/migrations/0002`, `0003`)
  2. **Pipeline:** `app/src/lib/ai/content-pipeline.ts` — hardcodet `content_type='ai_allowed'`
  3. **UI:** `SourceVerifiedBadge` på alt aqidah-indhold
- **AI-tilladt** (akhlaq, sprog, spil): AI må skrive frit, altid som kladde et menneske udgiver.

De hellige repræsenteres kun som **lys** — `sacred_representation`-enum'et har bevidst ingen "figur"-værdi.

## Kom i gang

```bash
cd app
cp .env.example .env.local   # udfyld Supabase EU-credentials
npm install
npm run dev
```

Kør migrationerne i rækkefølge (0001 → 0002 → 0003) i Supabase SQL-editoren eller via `supabase db push`.
