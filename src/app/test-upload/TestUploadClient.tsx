"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AudioUploader } from "@/components/audio/AudioUploader";

type SceneSummary = { id: string; name: string };

type TestUploadClientProps = {
  initialScenes: SceneSummary[];
  initialSceneId: string | null;
};

export function TestUploadClient({ initialScenes, initialSceneId }: TestUploadClientProps) {
  const router = useRouter();
  const [scenes, setScenes] = useState(initialScenes);
  const [creating, setCreating] = useState(false);

  async function createTestScene() {
    setCreating(true);
    try {
      const res = await fetch("/api/scenes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: `Testscen ${new Date().toLocaleTimeString("sv-SE")}` }),
      });
      if (!res.ok) return;
      const { scene } = await res.json();
      setScenes((prev) => [...prev, { id: scene.id, name: scene.name }]);
      router.push(`/test-upload?sceneId=${scene.id}`);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center gap-8 bg-zinc-950 px-6 py-16 text-zinc-50">
      <div className="w-full max-w-2xl">
        <h1 className="text-2xl font-semibold tracking-tight">Ladda upp ljudfil</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Testar hela uppladdningsflödet: presignerad URL (eller lokal disk i dev), uppladdning
          med progress, registrering i <code>audio_files</code>, och — om en scen är vald —
          direkt tilldelning till en ledig plats.
        </p>

        <div className="mt-6 flex flex-wrap items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900 p-3 text-sm">
          <span className="text-zinc-400">Scen-kontext:</span>
          <button
            type="button"
            onClick={() => router.push("/test-upload")}
            className={`rounded-md border px-2.5 py-1 text-xs ${
              !initialSceneId ? "border-amber-400 text-amber-400" : "border-zinc-700 text-zinc-300"
            }`}
          >
            Ingen scen
          </button>
          {scenes.map((scene) => (
            <button
              key={scene.id}
              type="button"
              onClick={() => router.push(`/test-upload?sceneId=${scene.id}`)}
              className={`rounded-md border px-2.5 py-1 text-xs ${
                initialSceneId === scene.id
                  ? "border-amber-400 text-amber-400"
                  : "border-zinc-700 text-zinc-300"
              }`}
            >
              {scene.name}
            </button>
          ))}
          <button
            type="button"
            onClick={() => void createTestScene()}
            disabled={creating}
            className="rounded-md border border-zinc-700 px-2.5 py-1 text-xs text-zinc-300 hover:border-zinc-500 disabled:opacity-50"
          >
            {creating ? "Skapar…" : "+ Ny testscen"}
          </button>
        </div>

        <div className="mt-6">
          <AudioUploader sceneId={initialSceneId ?? undefined} />
        </div>
      </div>
    </div>
  );
}
