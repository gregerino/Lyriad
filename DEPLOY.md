# Deploy till Vercel

Lyriad är ett standard Next.js App Router-projekt (`next build` / `next start`,
inga custom rewrites eller `vercel.ts`) — Vercel bygger det utan extra
konfiguration. Se [ARCHITECTURE.md](ARCHITECTURE.md) för hur R2-uppladdning
och auth fungerar i detalj.

## 1. Koppla GitHub-repot till Vercel

1. [vercel.com/new](https://vercel.com/new) → **Import Git Repository** →
   välj detta repo.
2. Framework Preset upptäcks automatiskt som **Next.js** — lämna Build
   Command / Output Directory på default (`next build`).
3. Klicka **Deploy** en första gång även om miljövariabler saknas ännu —
   bygget går igenom (databas-URL:en läses lazy, se
   [`src/lib/db/index.ts`](src/lib/db/index.ts)), men appen kommer inte
   fungera i praktiken förrän steg 2–3 nedan är klara.

Projektet är redan länkat lokalt via `vercel link` (`.vercel/project.json`),
så `vercel env pull` / `vercel deploy` från CLI:n fungerar direkt om du
föredrar det.

## 2. Databas: Neon via Vercel Storage-fliken

1. I Vercel-dashboarden: projektet → fliken **Storage** → **Create Database**
   → **Neon** (Postgres).
2. Följ flödet för att skapa (eller koppla ett befintligt) Neon-projekt.
   Vercel injicerar automatiskt `DATABASE_URL` (och några `POSTGRES_*`/`PG*`-
   varianter) i projektets miljövariabler — du behöver inte skriva in den
   för hand.
3. Kör migrationerna mot den nya databasen innan första riktiga användning:
   ```bash
   vercel env pull .env.local   # hämtar DATABASE_URL från Vercel
   pnpm db:migrate
   ```
   Detta behöver bara göras när schemat ändras (nya Drizzle-migrationer i
   `drizzle/`), inte vid varje deploy. `drizzle.config.ts` läser in
   `.env.local` själv, så ingen extra miljövariabel behöver sättas i skalet.
4. Vill du ha en isolerad dev-databas: skapa en **branch** av Neon-projektet
   (Neon stöder databas-branching) och peka din lokala `.env.local` mot den
   branchens anslutningssträng istället för produktionens.

**Ordningen spelar roll för destruktiva migrationer.** Om `.env.local` pekar
mot produktionsdatabasen (vilket den gör direkt efter `vercel env pull`, om du
inte skapat en Neon-branch enligt punkt 4) delar din lokala dev-server och
produktionen samma data. Drizzle genererar en explicit kolumnlista i sina
`SELECT`, så en migration som droppar en kolumn får den **redan deployade**
koden att krascha direkt — inte vid nästa deploy. Kör därför alltid i den här
ordningen när en migration tar bort eller byter namn på något:

1. Pusha och låt produktionsdeployen med den nya koden bli klar.
2. Kör `pnpm db:migrate` först därefter.

Migrationer som bara *lägger till* (nya tabeller, nullbara kolumner, defaults)
är ofarliga i valfri ordning.

## 3. Miljövariabler i dashboarden

Projektet → **Settings → Environment Variables**. Se
[.env.example](.env.example) för hela listan. Utöver `DATABASE_URL` (satt
automatiskt av Neon-integrationen ovan) behöver du sätta manuellt:

| Variabel | Hur du får den |
|---|---|
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME` | Från Cloudflare R2-dashboarden (skapa en bucket + API-token med read/write). Lämnas dessa tomma faller appen tillbaka till lokal disk-lagring — **måste** vara satta i produktion, eftersom Vercels filsystem är read-only/efemärt. |
| `AUTH_PASSWORD_HASH`, `SESSION_SECRET` | Generera med `pnpm hash-password <ditt-lösenord>` — skriv ut båda värdena direkt till dashboarden, spara aldrig lösenordet i klartext. |
| `LOCAL_STORAGE_DIR` | Lämna tom i produktion (endast relevant för lokal dev utan R2). |

Sätt alla i minst **Production**-miljön; lägg även till dem i **Preview** om
du vill att preview-deploys ska fungera fullt ut (t.ex. mot samma R2-bucket
eller en Neon dev-branch).

Efter att ha ändrat miljövariabler: trigga en ny deploy (redeploy senaste
commit) — de läses in vid build/cold start, inte live.

## 4. R2-uppladdning och Vercels funktionsgränser

Ljudfiler går **inte** genom en Vercel-funktion. Klienten ber
`/api/audio-files/upload-url` om en presignerad R2 `PUT`-URL och laddar upp
direkt till R2 (`PUT` från webbläsaren), sedan registreras bara metadata
(filnamn, storlek, R2-nyckel) via ett vanligt, litet JSON-anrop. Se
[ARCHITECTURE.md §4](ARCHITECTURE.md#4-ljudfillagring-cloudflare-r2) och
[`src/app/api/audio-files/upload-url/route.ts`](src/app/api/audio-files/upload-url/route.ts).

Det innebär att varken funktions-timeout eller request body-gränsen för
Vercel-funktioner blir en flaskhals, oavsett filstorlek — max filstorlek
(105 MB, `MAX_AUDIO_UPLOAD_BYTES` i
[`src/lib/audio/limits.ts`](src/lib/audio/limits.ts)) styrs av appens egen
validering, inte av plattformen. Inget behöver justeras här för deploy.

**Kom ihåg CORS på bucketen** — utan det får du "Nätverksfel under
uppladdning" i webbläsaren trots att R2-nycklarna är korrekta, eftersom
`PUT` går direkt från klienten till R2 och webbläsaren blockerar preflighten
om bucketen inte tillåter din origin. I Cloudflare-dashboarden: **R2 →
bucketen → Settings → CORS Policy**, lägg till både `http://localhost:3000`
och din produktions-URL (`https://lyriad.vercel.app`) i
`AllowedOrigins` med `AllowedMethods: ["PUT"]`. Se
[ARCHITECTURE.md §4](ARCHITECTURE.md#4-ljudfillagring-cloudflare-r2) för
exempel-JSON. Gäller direkt, ingen redeploy behövs.

Undantaget är den lokala disk-drivrutinen
(`/api/audio-files/local-upload/[token]`), som **går** genom en Vercel-
funktion och skriver till filsystemet — den är bara till för lokal dev utan
R2 konfigurerat och kommer inte fungera i produktion (efemärt filsystem).
Se därför alltid till att `R2_*`-variablerna är satta i Production/Preview.

## 5. Verifiera deploy vid push till main

1. Gör en commit på `main` (eller merga en PR dit) — Vercels GitHub-
   integration triggar automatiskt en Production-deploy.
2. Kolla **Deployments**-fliken i dashboarden: bygget ska gå igenom utan
   varningar om saknade env-vars.
3. Öppna produktions-URL:en → du ska mötas av inloggningssidan
   (`/login`, skyddad av `src/proxy.ts`) — logga in med lösenordet du
   hashade i steg 3.
4. Ladda upp en testfil i biblioteket och skapa en scen för att bekräfta att
   R2-uppladdning och databasen fungerar end-to-end.
5. Icke-`main`-branches/PRs får automatiskt en Preview-deploy med egen URL —
   samma env-vars gäller om du satt dem för Preview-miljön i steg 3.
