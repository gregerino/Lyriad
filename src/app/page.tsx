import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-zinc-950 text-zinc-50">
      <main className="flex flex-col items-center gap-4 text-center">
        <h1 className="text-4xl font-semibold tracking-tight">Lyriad</h1>
        <p className="text-zinc-400">Soundboard-verktyg för tabletop-rollspel.</p>
        <div className="mt-2 flex items-center gap-4 text-sm">
          <Link href="/scenes" className="text-amber-400 hover:text-amber-300">
            Scener →
          </Link>
          <Link href="/library" className="text-amber-400 hover:text-amber-300">
            Ljudbibliotek →
          </Link>
        </div>
      </main>
    </div>
  );
}
