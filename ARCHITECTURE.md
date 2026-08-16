# Lyriad — teknisk arkitektur

Personligt soundboard-verktyg för tabletop-rollspel. En användare, inget
publikt konto, ingen delning mellan användare. Hostas på Vercel.

## 1. Stack

| Del | Val | Motivering |
|---|---|---|
| Framework | Next.js 16 (App Router), TypeScript | Frontend + backend i samma projekt, passar Vercel bäst |
| Backend | Next.js Route Handlers (`src/app/api/**`) | Ingen separat serverprocess att drifta |
| Styling | Tailwind CSS v4 | Snabb iteration, redan uppsatt |
| Databas | **Neon Postgres** (via Vercel Marketplace) | Se resonemang nedan |
| Filsystem för ljud | Cloudflare R2 (S3-kompatibelt) | Billig lagring, inga egress-avgifter, funkar direkt mot S3 SDK |
| ORM | Drizzle ORM | Typesäkert, lätt, fungerar bra med Neons serverless-drivrutin |
| State (klient) | Zustand | Enkel, oberoende av React context-träd, passar realtids-ljudstate |
| Auth | Signerad, httpOnly session-cookie | Ett konto, inget behov av en full auth-leverantör |
| Hosting | Vercel (Fluid Compute) | Krav från uppgiften |

### Databasval: Neon istället för SQLite

Vercel Postgres/KV erbjuds inte längre — databaser köps via Vercel
Marketplace, där Neon är förstahandsvalet och är byggt för just serverless
(HTTP-driver, ingen connection pooling-problematik i Vercel-funktioner).

Rekommendationen är att köra **Neon i både dev och prod**, inte SQLite
lokalt:

- Ett litet soundboard-schema (4 tabeller) har inget att vinna på SQLite:s
  enkelhet, men risken med SQLite lokalt + Postgres i prod är att
  SQL-dialekt, typer (UUID, arrays, CHECK-constraints) och driver-beteende
  divergerar — bugs som bara syns efter deploy.
- Neon har ett gratis free tier och stöder **databas-branching**: skapa en
  `dev`-branch av samma schema för lokal utveckling, helt isolerad från
  produktionsdatan, utan att hantera en lokal Postgres-installation.
- Om du senare vill jobba offline går det utmärkt att lägga till en lokal
  Postgres via Docker med samma schema — men det är inte nödvändigt för att
  komma igång.

## 2. Autentisering

Ett enda konto, inget registreringsflöde:

- Lösenord sätts via miljövariabel (`AUTH_PASSWORD_HASH`, hashat med
  bcrypt/scrypt vid deploy — aldrig klartext i env).
- `POST /api/auth/login` verifierar lösenordet och sätter en signerad,
  `httpOnly`, `secure`, `sameSite=lax`-cookie (HMAC-signerad payload, t.ex.
  via `jose`) med kort payload (`{ authenticated: true, iat }`) och lång
  giltighetstid.
- `middleware.ts` (Node.js runtime via Fluid Compute) skyddar alla routes
  utom `/login` och `/api/auth/login` — omdirigerar till `/login` om
  cookien saknas eller är ogiltig.
- `POST /api/auth/logout` rensar cookien.
- Ingen databastabell för användare — kontot existerar bara som env-var +
  session-logik.

## 3. Datamodell

Alla fyra tabeller i Postgres (Neon), hanterade via Drizzle-migrationer.

```sql
CREATE TABLE campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  position SMALLINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE audio_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  filename TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  r2_key TEXT NOT NULL UNIQUE,
  mime_type TEXT NOT NULL,
  category TEXT,
  tags TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE scenes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  favorite BOOLEAN NOT NULL DEFAULT false,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE scene_music_slots (
  scene_id UUID NOT NULL REFERENCES scenes(id) ON DELETE CASCADE,
  slot_index SMALLINT NOT NULL CHECK (slot_index BETWEEN 1 AND 10),
  audio_file_id UUID REFERENCES audio_files(id) ON DELETE SET NULL,
  volume REAL NOT NULL DEFAULT 0.8 CHECK (volume BETWEEN 0 AND 1),
  loop BOOLEAN NOT NULL DEFAULT true,
  fade_in_ms INTEGER NOT NULL DEFAULT 0 CHECK (fade_in_ms >= 0),
  fade_out_ms INTEGER NOT NULL DEFAULT 0 CHECK (fade_out_ms >= 0),
  PRIMARY KEY (scene_id, slot_index)
);

CREATE TABLE oneshot_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  group_name TEXT,
  position SMALLINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE oneshot_slots (
  set_id UUID NOT NULL REFERENCES oneshot_sets(id) ON DELETE CASCADE,
  slot_index SMALLINT NOT NULL CHECK (slot_index BETWEEN 1 AND 20),
  audio_file_id UUID REFERENCES audio_files(id) ON DELETE SET NULL,
  volume REAL NOT NULL DEFAULT 0.8 CHECK (volume BETWEEN 0 AND 1),
  loop BOOLEAN NOT NULL DEFAULT false,
  color TEXT,
  icon TEXT,
  PRIMARY KEY (set_id, slot_index)
);
```

**Designbeslut:** `PRIMARY KEY (scene_id, slot_index)` respektive
`(set_id, slot_index)` ger både uniknyckeln och gräns-på-antal-rader gratis
— `slot_index` är begränsat till 1–10 (musik) respektive 1–20 (one-shots)
via `CHECK`, så fler rader per scen/set än så kan aldrig existera. Ingen
trigger behövs.

**One-shot-set:** en bank av one-shots ("Strid", "Krogen", "Resan") som
paddgriden visar en i taget. Set hör **inte** till någon scen: en bank med
stridsljud är lika användbar i grottan som på gatan, så ett set väljs till
scenen man spelar precis som scenen själv väljs i flikraden. Setet är en
egen tabell snarare än ett index i slot-nyckeln, eftersom det har ett namn
och en ordning som användaren redigerar.

**Grupper:** `group_name` är ett fritt gruppnamn ("Strid", "Miljö",
"Röster"), på samma sätt som en samling har `category` — en kolumn och inte
en tabell, eftersom väljaren bara behöver namnet och en grupp slutar
existera när dess sista set lämnar den. `NULL` betyder "Utan grupp".
Väljaren till vänster om set-flikarna smalnar av raden till en grupp i
taget, precis som kampanjväljaren gör med scenflikarna, och visas först när
minst ett set faktiskt ligger i en grupp.

Att byta grupp byter också bank: ligger setet som visas inte i gruppen man
öppnar tar dess första set över padgriden. Ett nytt set som skapas medan en
grupp visas hamnar i den gruppen.

Vilket set en scen senast visade är klient-state (`localStorage`,
`lyriad:oneshot-set:<sceneId>`), inte databas-state — det är en egenskap
hos hur scenen spelas, inte hos setet. Faller tillbaka på det första setet
(helst ett ur gruppen man bläddrar i) när det ihågkomna är raderat. Vald
grupp ligger i `lyriad:oneshot-group` och är inte per scen: den följer i
stället med det set som visas, så en scen som lämnades i "Strid" öppnar
väljaren där igen.

När en scen skapas skapas samtidigt alla 10 musikrader (med
`audio_file_id = NULL`), men inget set — scener delar på de set som redan
finns. Ett nytt set skapas med sina 20 slot-rader i samma transaktion. Det
gör att frontend alltid kan förvänta sig fasta arrayer av längd 10/20, utan
att särskilja "tom plats" från "plats finns inte". Finns inga set alls
(nytt system, eller alla raderade) visar paddgriden en uppmaning att skapa
det första.

**Kampanjer:** en scen hör till högst en kampanj ("Curse of Strahd",
"Phandelver and Below"), och kampanjen är enbart en gruppering — flikraden
ovanför musikplatserna visar favoritscenerna i den kampanj som är vald, så
kvällens spel slipper de andra kampanjernas genvägar. Vilken kampanj som är
vald är klient-state (cookien `lyriad_active_campaign`, se
`src/lib/activeCampaign.ts`), inte databas-state: det är en egenskap hos
skärmen man spelar från, inte hos datan. `ON DELETE SET NULL` gör att en
raderad kampanj lämnar sina scener orörda — de faller tillbaka till "utan
kampanj" istället för att följa med i fallet.

**Loop på one-shots:** `loop` på slot-raden gör att padden spelar tills den
trycks igen istället för att avfyras en gång — regn, en folkmassa, en eld.
Musikslottens `loop` defaultar till `true`, one-shottens till `false`,
eftersom det är vad respektive sorts ljud oftast ska göra.

## 4. Ljudfillagring (Cloudflare R2)

Uppladdning och uppspelning går **inte** via Vercel-funktioner för själva
filöverföringen — bara metadata gör det. Flöde:

1. Klient ber `POST /api/audio-files/upload-url` om en presignerad
   R2-uppladdnings-URL (S3 `PutObjectCommand` presign, via
   `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner`).
2. Klienten laddar upp filen direkt till R2 med den presignerade URL:en
   (`PUT`), utan att gå via Next.js-servern.
3. Klienten anropar `POST /api/audio-files` med filnamn, storlek, R2-nyckel
   och ev. kategori/taggar — servern skriver raden i `audio_files`.
4. Uppspelning sker via en presignerad `GET`-URL (kort livstid, hämtas vid
   behov) eller — enklare för ett personligt verktyg — en R2-bucket med
   publik läsåtkomst bakom en svårgissad nyckel, om presignering visar sig
   krångla med Web Audio-cachning.

Detta undviker Vercel-funktionernas gränser för payload-storlek och
körtid helt för filöverföring.

**CORS på bucketen (obligatoriskt):** eftersom `PUT` går direkt från
webbläsaren till R2 måste bucketen ha en CORS-policy som tillåter det —
annars blockerar webbläsaren preflighten och uppladdningen dör med ett
generiskt nätverksfel (ingen tydlig HTTP-status, eftersom requesten aldrig
når R2). Sätts i Cloudflare-dashboarden: **R2 → bucket → Settings → CORS
Policy**:

```json
[
  {
    "AllowedOrigins": ["http://localhost:3000", "https://lyriad.vercel.app"],
    "AllowedMethods": ["PUT"],
    "AllowedHeaders": ["Content-Type"],
    "MaxAgeSeconds": 3600
  }
]
```

Gäller direkt utan redeploy. R2 stödjer inte wildcard-origins, så lägg till
varje domän (prod + ev. preview-URL:er) explicit.

**Validering:** endast mp3/wav/ogg tillåts (kontrolleras på filändelsen,
inte webbläsarens `Content-Type`, som är opålitlig för wav/ogg), och max
filstorlek är 200 MB (`MAX_AUDIO_UPLOAD_BYTES` i `src/lib/audio/limits.ts`).
Storleken skickas med i begäran om uppladdnings-URL och kontrolleras igen
när filen registreras.

**Lokal utveckling utan R2:** om `R2_ACCOUNT_ID` inte är satt växlar
`src/lib/storage/index.ts` automatiskt till en lokal disk-driver
(`src/lib/storage/local.ts`) — "presignerade" uppladdnings-URL:er blir då
signerade (`jose`/`SESSION_SECRET`) länkar till
`PUT /api/audio-files/local-upload/[token]`, som skriver till
`LOCAL_STORAGE_DIR` (default `.local-storage/`, gitignorad), och
uppspelning sker via `GET /api/audio-files/local-file/[key]`. Samma
frontend-kod (presigned-URL → `PUT` → registrera) fungerar oförändrat mot
båda drivrutinerna. Ett alternativ till disk är att peka R2-klienten mot en
lokal MinIO-instans (S3-kompatibel) — sätt då `R2_*`-variablerna mot
MinIO:s endpoint/nycklar istället.

## 5. Ljudmotor (klient, Web Audio API)

`src/audio-engine/` — flera samtidiga spår med individuell volym/fade, där
varje spår spelas på det sätt dess längd tål:

- Ett delat `AudioContext` + en master `GainNode`, för det som faktiskt går
  genom Web Audio (de avkodade one-shottarna).
- **Musikspår (10 platser):** strömmar från ett `HTMLAudioElement` per
  plats, utanför Web Audio-grafen — `createMediaElementSource` kräver ett
  CORS-rent svar och en upplåst `AudioContext` för att inte tystna på iOS,
  och allt musiken behöver är en volymmultiplikator. Loop hanteras med
  `element.loop`, och fade in/ut trappas från en timer på `element.volume`
  (`FADE_STEP_MS`) eftersom `volume` inte har någon egen automation. Flera
  musikspår kan vara aktiva samtidigt (mixade) eller korsfejdas.
- **One-shots (20 platser per set):** varje klick skapar en ny
  `AudioBufferSourceNode` (fire-and-forget) routad genom en delad
  one-shot-gain → master, så överlappande triggers fungerar utan att
  avbryta varandra. En pad med `loop` sätter `source.loop` på instansen och
  spelar tills padden trycks igen (`stopOneShot`). Padden adresseras med
  `oneshot-<setId>-<slotIndex>`, så ett loopande ljud i ett set fortsätter
  spela medan ett annat set visas — bara det set som visas laddas, och det
  som laddats ligger kvar så länge scenen är öppen.
- **Långa one-shots strömmar istället för att avkodas.** `decodeAudioData`
  blåser upp filen till rå float-PCM: en pad med en timmes butiksmiljö i
  (74 MB mp3) blev 1,39 GB i minnet och tog ner fliken på iPad, medan
  desktop svalde gigabytet och lät bli att märkas. Motorn läser därför
  längden från ett `<audio>`-element innan den bestämmer sig, och allt över
  `MAX_DECODED_ONESHOT_SECONDS` (20 s) — liksom allt vars längd inte går
  att avgöra — behåller elementet som sin uppspelare istället. En strömmad
  pad har en instans i taget: ett tryck startar om ljudet istället för att
  lägga en kopia ovanpå, vilket är vad en minutlång ambiens vill ändå.
  Under gränsen avkodas padden fortfarande, eftersom bara en avkodad buffer
  kan överlappa sig själv — hela poängen med en pad man slår två gånger.
  Elementet ligger utanför Web Audio-grafen precis som musikens, så en
  strömmad pad viker in grupp- och mastervolymen i sin egen `volume`.
- Avkodade ljudfiler ligger kvar som `AudioBuffer` så länge scenen är
  öppen, för att slippa omavkodning vid varje trigger.
- Ljudmotorn exponerar en imperativ API-yta (`playMusicSlot`,
  `stopMusicSlot`, `triggerOneShot`, `setSlotVolume`, …) som
  state-lagret (Zustand) anropar — motorn äger inget UI-state själv.

## 6. State management

- **Zustand** för realtids-uppspelningsstate: vilken scen som är aktiv,
  vilka musikslots som spelar, volymer, fade-status. Detta state är
  klient-lokalt och rör sig för snabbt/frekvent för att passa
  server-state-cache.
- Scen-CRUD (skapa/döpa om/radera scener, tilldela ljud till slots) går via
  vanliga `fetch`-anrop mot Route Handlers, med enkel
  loading/error-hantering i komponenterna. Eftersom appen har en användare
  och ingen samtidig redigering från flera klienter behövs ingen
  cache-synkroniseringslösning som TanStack Query till att börja med — kan
  läggas till senare om det känns motiverat.

## 7. API-yta (Route Handlers)

```
POST   /api/auth/login
POST   /api/auth/logout

GET    /api/campaigns                  Lista kampanjer
POST   /api/campaigns                  Skapa kampanj
PATCH  /api/campaigns/:id              Byt namn/ordning
DELETE /api/campaigns/:id              Radera kampanj (scenerna behålls)

GET    /api/scenes                     Lista scener
POST   /api/scenes                     Skapa scen (+ alla 10 musikrader)
GET    /api/scenes/:id                 Hämta scen + musikslots
PATCH  /api/scenes/:id                 Uppdatera namn/beskrivning/favorit/kampanj
DELETE /api/scenes/:id                 Radera scen (cascade slots)

PATCH  /api/scenes/:id/music-slots/:slotIndex     Uppdatera slot (audio_file_id, volym, loop, fade)

GET    /api/oneshot-sets                          Lista alla set + deras slots
POST   /api/oneshot-sets                          Skapa set (+ dess 20 slot-rader), ev. i en grupp
PATCH  /api/oneshot-sets/:setId                   Byt namn/grupp/ordning på setet
DELETE /api/oneshot-sets/:setId                   Radera set (även det sista)
PATCH  /api/oneshot-sets/:setId/slots/:slotIndex  Uppdatera slot (audio_file_id, volym, loop, färg/ikon)

GET    /api/audio-files                Lista uppladdade filer
POST   /api/audio-files/upload-url     Begär presignerad uppladdnings-URL (R2 eller lokal)
POST   /api/audio-files                Registrera fil efter uppladdning
DELETE /api/audio-files/:id            Radera fil (metadata + lagringsobjekt)

PUT    /api/audio-files/local-upload/:token   Endast lokal disk-drivrutin (dev utan R2)
GET    /api/audio-files/local-file/:key       Endast lokal disk-drivrutin (dev utan R2)
```

## 8. Mappstruktur

```
src/
  app/
    api/            Route Handlers (backend)
      scenes/
      audio-files/
      auth/
    (sidor, layout, page.tsx)
  audio-engine/      Web Audio-motor, oberoende av React
  components/
    ui/              Generiska UI-byggstenar
    scenes/          Scenlista, scen-editor
    slots/           Musik- och one-shot-slot-komponenter
  state/             Zustand-stores
  lib/
    db/              Drizzle-klient, queries
    storage/         R2-klient (S3 SDK), presign-helpers
    auth/            Session/cookie-logik
  types/             Delade domäntyper (Scene, MusicSlot, OneShotSlot, AudioFile)
```

## 9. Deployment (Vercel)

Miljövariabler:

```
DATABASE_URL              Neon-anslutningssträng
R2_ACCOUNT_ID              Lämnas tom lokalt för att falla tillbaka på lokal disk
R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY
R2_BUCKET_NAME
LOCAL_STORAGE_DIR          Valfri, endast lokal disk-drivrutin (default .local-storage/)
AUTH_PASSWORD_HASH         bcrypt/scrypt-hash av lösenordet
SESSION_SECRET             HMAC-nyckel för signering av sessionscookien
```

- Neon och (om den finns i Marketplace) R2/S3-kompatibel lagring kopplas
  via `vercel env` / Vercel Marketplace-integrationer där möjligt, annars
  sätts nycklarna manuellt.
- Inga speciella funktionsgränser behöver justeras eftersom filöverföring
  går direkt mellan klient och R2.
- `vercel.ts` kan användas senare för ev. cache-headers på statiska
  ljud-URL:er, men behövs inte för MVP.

## 10. Icke-mål (v1)

- Flera användarkonton eller delning mellan användare.
- Realtidssynkronisering mellan flera klienter/spelledare samtidigt.
- Mobilapp — responsiv webb räcker.
- Serverstyrd uppspelning (allt drivs klient-side via Web Audio).
