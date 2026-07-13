# Migrationer

**Vigtigt om drift:** Den live-database (projekt `ifwlbfuzkuidfzqsvnjz`, eu-central-1) blev
oprindeligt oprettet med migrationen `fase0_schema` — en slankere variant end 0001–0003 i
denne mappe (bl.a. uden title_da/sacred_representation-kolonner, og med accounts.id = auth.uid()).

- `0001–0003`: reference-design fra planlægningen (matcher IKKE live 1:1)
- `20260713193405_fase0_aqidah_mur_haerdet.sql`: deployeret hærdning, matcher live

Ved næste skemaændring: beslut om live skal udvides mod 0001-designet (titler,
aldersvarianter, sacred_representation) eller om 0001–0003 skal omskrives til
at matche live. Se handoff.md → åbne beslutninger.
