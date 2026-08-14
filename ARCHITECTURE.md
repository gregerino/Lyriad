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

CREATE TABLE scene_oneshot_slots (
  scene_id UUID NOT NULL REFERENCES scenes(id) ON DELETE CASCADE,
  slot_index SMALLINT NOT NULL CHECK (slot_index BETWEEN 1 AND 20),
  audio_file_id UUID REFERENCES audio_files(id) ON DELETE SET NULL,
  volume REAL NOT NULL DEFAULT 0.8 CHECK (volume BETWEEN 0 AND 1),
  color TEXT,
  icon TEXT,
  PRIMARY KEY (scene_id, slot_index)
);
```

**Designbeslut:** `PRIMARY KEY (scene_id, slot_index)` ger både uniknyckeln
och gräns-på-antal-rader gratis — `slot_index` är begränsat till 1–10
(musik) respektive 1–20 (one-shots) via `CHECK`, så fler rader per scen än
så kan aldrig existera. Ingen trigger behövs.

När en scen skapas skapas samtidigt alla 10 + 20 slot-rader (med
`audio_file_id = NULL`) i samma transaktion. Det gör att frontend alltid
kan förvänta sig fasta arrayer av längd 10/20 per scen, utan att särskilja
"tom plats" från "plats finns inte".

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

`src/audio-engine/` — ingen `<audio>`-tagg, allt går via `AudioContext` för
att kunna mixa flera samtidiga spår med individuell gain/fade:

- Ett delat `AudioContext` + en master `GainNode`.
- **Musikspår (10 platser):** varje aktiv plats har en egen `GainNode` →
  master. Loop hanteras med `AudioBufferSourceNode.loop = true`. Fade
  in/ut sker med `GainNode.gain.linearRampToValueAtTime`. Flera musikspår
  kan vara aktiva samtidigt (mixade) eller styras att vara exklusiva,
  beroende på scenens inställning.
- **One-shots (20 platser):** varje klick skapar en ny
  `AudioBufferSourceNode` (fire-and-forget) routad genom en delad
  one-shot-gain → master, så överlappande triggers fungerar utan att
  avbryta varandra.
- Ljudfiler decodas till `AudioBuffer` en gång och cachas i minnet
  (`Map<audioFileId, AudioBuffer>`) för att undvika omdecodning vid varje
  trigger.
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

GET    /api/scenes                     Lista scener
POST   /api/scenes                     Skapa scen (+ alla 30 slot-rader)
GET    /api/scenes/:id                 Hämta scen + slots
PATCH  /api/scenes/:id                 Uppdatera namn/beskrivning
DELETE /api/scenes/:id                 Radera scen (cascade slots)

PATCH  /api/scenes/:id/music-slots/:slotIndex     Uppdatera slot (audio_file_id, volym, loop, fade)
PATCH  /api/scenes/:id/oneshot-slots/:slotIndex   Uppdatera slot (audio_file_id, volym, färg/ikon)

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
