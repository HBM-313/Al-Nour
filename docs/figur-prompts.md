# Nour — faste figur-prompts

*Til generering af de fem ven-figurer i Google Flow (eller et andet billedværktøj). Skrevet 2026-07-27.*

**Prompterne er på engelsk med vilje** — billedmodeller er markant mere præcise på engelsk. Teksten omkring dem er dansk, så du kan bruge filen som opslagsværk.

---

## Sådan bruges filen

En færdig prompt består af **tre blokke sat sammen i denne rækkefølge:**

```
[STILBLOK]  +  [FIGURBLOK]  +  [POSITURBLOK]
```

- **Stilblokken er den samme hver eneste gang.** Den er hele grunden til at figurerne kommer til at ligne hinanden. Ret aldrig i den, heller ikke småting — ét ord ændret giver en figur der ikke passer til de andre.
- **Figurblokken** beskriver hvem det er. Fem af dem.
- **Positurblokken** beskriver hvad figuren gør. Fem af dem.

5 figurer × 5 positurer = **25 billeder** i alt.

### Rækkefølgen der giver ensartede figurer

1. Generér **kun "rolig"-posituren** for alle fem figurer først.
2. Se dem sammen. Er der én der falder udenfor, så ret figurblokken og kør den igen — ikke de andre.
3. Når alle fem hero-billeder er godkendt, brug hvert af dem som **referencebillede** når du genererer figurens fire øvrige positurer. Det er dét der holder ansigtet stabilt.
4. Brug samme seed hvis værktøjet tillader det.

### Vigtigt om beskæring

Hold **samme afstand til figuren i alle fem positurer**. Hvis "jubler" er zoomet tættere på end "rolig", vil figuren hoppe i størrelse når appen skifter tilstand. Stilblokken låser kameraet — lad være med at ændre det pr. positur.

---

## STILBLOK

*Kopiér ordret ind foran hver eneste prompt.*

```
3D rendered character illustration, soft stylised cartoon look, clean and friendly,
appealing children's-book quality. Chibi proportions: head is about one third of
total body height, small rounded body, short soft limbs, simple rounded hands with
four visible fingers. Large expressive eyes with clearly visible iris, dark round
pupil and two small white catchlights. Soft skin with gentle subsurface scattering
and a light natural blush on the cheeks. Smooth matte clay-like surfaces, no fabric
texture noise, no fine detail clutter. Studio lighting: warm key light from upper
left, soft cool fill from the right, gentle rim light from behind separating the
figure from the background. Soft contact shadow on the ground under the feet.
Restricted warm colour palette only: terracotta, rust red, cream, warm sand,
warm brown, muted gold, and deep plum-navy for hair. Plain flat off-white
background, completely empty, no scenery, no furniture, no props unless stated.
Full body visible from head down to ground level, character centred in frame,
camera at the character's chest height, straight-on view with a very slight
three-quarter turn, square 1:1 composition, generous even margin around the figure.
```

---

## FIGURBLOKKE

### Ali — gennemgående ven-guide (dreng)

```
An 8-year-old boy named Ali. Warm medium-brown skin. Short black hair, slightly
tousled, with one small cowlick standing up at the crown. Dark brown eyes with
thick soft eyebrows. Wearing a plain terracotta long-sleeved shirt and sand-coloured
trousers, simple brown shoes. A small brown wooden bead bracelet on his left wrist.
Cheerful, open, easy-going expression.
```

### Zahraa — gennemgående ven-guide (pige)

```
An 8-year-old girl named Zahraa. Light olive skin. Large warm brown eyes. She
wears a warm sand-beige headscarf that completely covers her hair, ears and neck
and drapes softly over her shoulders — absolutely no hair is visible anywhere. Her
dress is rust-red, loose-fitting and floor-length, with long sleeves reaching all
the way to the wrists; the cut is loose so the shape of her body is not defined,
and the hem reaches the ground and covers her feet completely. Only her face and
her hands are visible. A tiny muted gold star pin at the side of her headscarf.
Bright, kind, curious expression.
```

### Hassan — Hverdagshaven (dreng, storebror)

```
A 9-year-old boy named Hassan. Warm brown skin. Neat warm-brown hair with a slight
natural wave, tidy. Warm brown eyes, calm steady eyebrows. Wearing a muted
olive-gold shirt with the sleeves rolled to the elbow, warm brown trousers, brown
shoes. Slightly taller and more composed than a younger child. Gentle, dependable,
older-brother expression.
```

### Hussain — Hverdagshaven (dreng, lillebror til Hassan)

```
A 7-year-old boy named Hussain, the younger brother of Hassan and clearly related
to him: same warm brown skin tone and same face shape, but rounder cheeks and a
slightly smaller build. Short dark brown hair, cut similar to his brother's but
shorter. Large warm brown eyes. Wearing a rust-red shirt and sand-coloured
trousers, brown shoes. A small gap between his front teeth when he smiles. Lively,
playful, slightly cheeky expression.
```

### Zainab — Hverdagshaven (pige, ældst)

```
A 10-year-old girl named Zainab, the oldest of the group. Warm brown skin. Large
dark brown eyes with a warm, attentive gaze. She wears a cream headscarf that
completely covers her hair, ears and neck and drapes softly over her shoulders —
absolutely no hair is visible anywhere. Her dress is terracotta, loose-fitting and
floor-length, with long sleeves reaching all the way to the wrists; the cut is
loose so the shape of her body is not defined, and the hem reaches the ground and
covers her feet completely. Only her face and her hands are visible. A subtle muted
gold trim along the hem and the sleeve cuffs. Calm, thoughtful, quietly confident
expression.
```

> **Tildækning er en fast regel for alle pigefigurer, ikke et valg** (ejer-beslutning 2026-07-27). Alle piger bærer hijab. Hår, ører, hals, arme, ben og fødder vises aldrig. Kjolen er løstsiddende, gulvlang og har lange ærmer til håndleddet. **Kun ansigt og hænder må være synlige.** Reglen står tre steder i hver pige-prompt — i figurblokken, i undgå-listen og i tjeklisten — med vilje, fordi billedmodeller er tilbøjelige til at lade en hårlok slippe ud ved kanten af tørklædet.

> **Drengefigurerne er uændrede** og har almindeligt hverdagstøj med synlige sko. Ejerens beslutning gjaldt pigerne. Skal drengene også dækkes til anklerne, er det én sætning pr. figurblok.

> **Tøjet er ellers hverdagstøj, ikke festtøj.** Planen beskriver figurerne som *almindelige nutidige børn* i Danmark. Vil du hellere have thobe og kufi til drengene som på stock-billederne, er det kun tøj-sætningen der skal skiftes.

---

## POSITURBLOKKE

### 1. Rolig — hero-billedet, generér denne først

```
Standing relaxed and still, facing the viewer, arms hanging naturally at the sides,
weight resting slightly on one leg, warm closed-mouth smile, eyes looking calmly
straight ahead at the viewer.
```

### 2. Hilser

```
Waving hello with the right arm raised beside the head, palm open toward the
viewer, the other arm relaxed at the side, big open friendly smile showing teeth,
head tilted very slightly, eyes bright and welcoming.
```

### 3. Taler

```
Mid-sentence, explaining something. Mouth open in a soft speaking shape, both hands
raised in a small open gesture at chest height, palms turned slightly upward,
eyebrows raised a little, engaged and animated but not exaggerated.
```

### 4. Tænker

```
Thinking quietly. Head tilted to one side, one hand raised with fingertips resting
near the chin, eyes looking up and slightly to the side, mouth a small soft
thoughtful line. The mood is gently puzzled and patient, never sad, never worried,
never disappointed.
```

### 5. Jubler

```
Celebrating with delight. Both arms raised high above the head, wide open joyful
smile, eyes happily squinted into upward curves, body lifted in a small joyful hop
just above the ground.
```

---

## UNDGÅ-LISTE

*Læg denne i det negative felt hvis værktøjet har ét. Har det ikke, så tjek billederne mod listen inden du godkender.*

```
halo, glowing aura around the figure, divine light, light rays from the head or
body, religious iconography, calligraphy on the character, any depiction of a
prophet, imam or saint, visible hair on a female character, loose strand of hair
escaping the headscarf, visible fringe, uncovered head on a girl, visible neck on a
girl, bare arms, short sleeves, rolled sleeves on a girl, bare legs, bare feet,
visible ankles on a girl, tight clothing, form-fitting dress, defined waistline,
short dress, adults, elderly people, bearded men, weapons, flags, political
symbols, photorealistic skin, uncanny realism, busy background, scenery, furniture,
text, letters, numbers, watermark, logo, signature, extra fingers, missing fingers,
malformed hands, distorted face, multiple characters
```

### Hvorfor der står så meget om hår og ærmer

Billedmodeller falder næsten altid tilbage på deres standardbillede af et barn, og det standardbillede har synligt hår. Selv med "hijab" i prompten slipper der ofte en lok ud ved tindingen eller en pandehårsstump frem under kanten. Derfor står forbuddet både i figurblokken og som fem separate poster på undgå-listen. Se særligt efter det ved tindingerne og i nakken.

Samme gælder ærmer: modellen forkorter dem gerne til trekvartlange af sig selv. Ærmet skal nå håndleddet.

### Hvorfor "glowing aura" står øverst

Det er den vigtigste linje på hele listen. Nour repræsenterer de hellige **udelukkende som lys** — det er hele fundamentet under muren. En børnefigur med en glød omkring sig kan læses som præcis dét, og det må aldrig kunne ske ved et uheld. Kommer der et billede tilbage med skær, glorie eller stråler omkring figuren: kassér det, også selvom det er pænt.

Samme grund til at figurerne aldrig må optræde sammen med lys-repræsentationen af de hellige. Det gælder i appen, og det gælder også når du genererer — bland aldrig en figur og en lyskilde i samme billede.

---

## Teknisk output

| | |
|---|---|
| Format | Kvadratisk, mindst 1024 × 1024 |
| Baggrund | Ensfarvet lys — eller transparent hvis værktøjet kan |
| Beskæring | Hele figuren, fødder med, samme afstand i alle fem positurer |
| Filnavn | `<figur>-<positur>.png`, fx `hussain-hilser.png` |
| Antal | 25 billeder (5 figurer × 5 positurer) |

Når billederne er klar, skalerer jeg dem ned, gør baggrunden transparent, konverterer til WebP og lægger dem gennem samme vej som ordforråds-ikonerne: filer i repoet → Edge Function → Storage → `media`-tabellen. Anslået samlet størrelse efter komprimering: **1,5–2 MB for alle 25**.

---

## Tjekliste før du godkender et sæt

- [ ] **Pigefigurer: intet hår synligt** — tjek særligt tindinger, pande og nakke
- [ ] **Pigefigurer: ærmerne når håndleddet**, ingen bare arme
- [ ] **Pigefigurer: kjolen når gulvet**, ingen fødder eller ankler synlige
- [ ] **Pigefigurer: løstsiddende snit**, ingen markeret talje eller kropsform
- [ ] Kun ansigt og hænder er synlige på pigefigurerne
- [ ] Ansigtet er genkendeligt det samme på tværs af alle fem positurer
- [ ] Figuren fylder lige meget i alle fem billeder
- [ ] Ingen glød, glorie eller stråler nogen steder
- [ ] Ingen tekst, vandmærke eller signatur
- [ ] Hænderne har det rigtige antal fingre
- [ ] Farverne holder sig i den varme palet
- [ ] Hassan og Hussain ligner brødre
- [ ] "Tænker" ser eftertænksom ud, ikke ked af det
