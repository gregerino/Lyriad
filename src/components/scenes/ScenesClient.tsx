"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type MouseEvent } from "react";
import { Tooltip } from "@/components/ui/Tooltip";
import { PencilIcon, PlusIcon, StarIcon, XIcon } from "@/components/ui/icons";
import { readActiveCampaignId, writeActiveCampaignId } from "@/lib/activeCampaign";
import { LAST_SCENE_COOKIE } from "@/lib/lastScene";
import type { Campaign, Scene } from "@/types/domain";

type SceneListItem = Pick<
  Scene,
  "id" | "name" | "description" | "favorite" | "campaignId" | "createdAt" | "updatedAt"
>;

/** The bucket scenes that belong to no campaign are shown under. */
const NO_CAMPAIGN = { id: null, name: "Utan kampanj" } as const;

function readLastSceneId(): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${LAST_SCENE_COOKIE}=([^;]*)`));
  return match ? decodeURIComponent(match[1]!) : null;
}

export function ScenesClient() {
  const router = useRouter();
  const [scenes, setScenes] = useState<SceneListItem[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [lastSceneId, setLastSceneId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [newSceneCampaignId, setNewSceneCampaignId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function loadAll() {
    setError(null);
    try {
      const [scenesRes, campaignsRes] = await Promise.all([
        fetch("/api/scenes"),
        fetch("/api/campaigns"),
      ]);
      if (!scenesRes.ok || !campaignsRes.ok) throw new Error("Kunde inte ladda scener");
      const { scenes: sceneRows } = await scenesRes.json();
      const { campaigns: campaignRows } = await campaignsRes.json();
      setScenes(sceneRows);
      setCampaigns(campaignRows);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunde inte ladda scener");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch-on-mount, no external subscription to hang this off
    void loadAll();
    setLastSceneId(readLastSceneId());
    // A new scene lands in the campaign being played unless told otherwise.
    setNewSceneCampaignId(readActiveCampaignId() ?? "");
  }, []);

  function startCreating() {
    setCreating(true);
    setCreateError(null);
  }

  function cancelCreating() {
    setCreating(false);
    setName("");
    setDescription("");
    setCreateError(null);
  }

  async function createScene() {
    const trimmedName = name.trim();
    if (!trimmedName) return;
    setSubmitting(true);
    setCreateError(null);
    try {
      const res = await fetch("/api/scenes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmedName,
          description: description.trim() || null,
          campaignId: newSceneCampaignId || null,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "Kunde inte skapa scenen");
      }
      const { scene } = await res.json();
      router.push(`/scenes/${scene.id}`);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Kunde inte skapa scenen");
      setSubmitting(false);
    }
  }

  async function deleteScene(e: MouseEvent, id: string) {
    e.preventDefault();
    e.stopPropagation();
    setDeletingId(id);
    try {
      const res = await fetch(`/api/scenes/${id}`, { method: "DELETE" });
      if (!res.ok) return;
      setScenes((prev) => prev.filter((s) => s.id !== id));
    } finally {
      setDeletingId(null);
    }
  }

  async function toggleFavorite(e: MouseEvent, id: string, current: boolean) {
    e.preventDefault();
    e.stopPropagation();
    setScenes((prev) => prev.map((s) => (s.id === id ? { ...s, favorite: !current } : s)));
    const res = await fetch(`/api/scenes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ favorite: !current }),
    });
    if (!res.ok) {
      setScenes((prev) => prev.map((s) => (s.id === id ? { ...s, favorite: current } : s)));
    }
  }

  async function moveScene(id: string, campaignId: string | null) {
    const previous = scenes.find((s) => s.id === id)?.campaignId ?? null;
    setScenes((prev) => prev.map((s) => (s.id === id ? { ...s, campaignId } : s)));
    const res = await fetch(`/api/scenes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ campaignId }),
    }).catch(() => null);
    if (!res?.ok) {
      setScenes((prev) => prev.map((s) => (s.id === id ? { ...s, campaignId: previous } : s)));
    }
  }

  const groups = [...campaigns.map((c) => ({ id: c.id as string | null, name: c.name })), NO_CAMPAIGN];

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-8 px-4 py-8 sm:px-6 sm:py-12">
      <div>
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-ember-400">Lyriad</p>
        <h1 className="mt-1 font-display text-2xl font-medium tracking-wide text-parchment-100 sm:text-3xl">
          Scener
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Bläddra bland dina scener, eller skapa en ny.
        </p>
      </div>

      {loading && <p className="text-sm text-muted-foreground">Laddar…</p>}
      {error && <p className="text-sm text-danger-foreground">{error}</p>}

      {!loading && !error && (
        <>
          <CampaignsSection
            campaigns={campaigns}
            sceneCounts={countScenesByCampaign(scenes)}
            onChange={setCampaigns}
          />

          <section className="flex flex-col gap-4">
            {creating ? (
              <div className="flex flex-col gap-2 rounded-lg border border-ember-400/40 bg-surface p-4 shadow-sm sm:max-w-xl">
                <input
                  type="text"
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") cancelCreating();
                  }}
                  placeholder="Namn, t.ex. Krogen i Silverbäcken"
                  className="focus-ring rounded-md border border-border-strong bg-background px-3 py-1.5 text-sm text-parchment-100 placeholder:text-muted-foreground focus:border-ember-400"
                />
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void createScene();
                    if (e.key === "Escape") cancelCreating();
                  }}
                  placeholder="Beskrivning (valfritt)"
                  className="focus-ring rounded-md border border-border-strong bg-background px-3 py-1.5 text-sm text-parchment-100 placeholder:text-muted-foreground focus:border-ember-400"
                />
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  Kampanj
                  <select
                    value={newSceneCampaignId}
                    onChange={(e) => setNewSceneCampaignId(e.target.value)}
                    className="focus-ring rounded-md border border-border-strong bg-background px-2.5 py-1.5 text-xs text-parchment-100 focus:border-ember-400"
                  >
                    <option value="">Utan kampanj</option>
                    {campaigns.map((campaign) => (
                      <option key={campaign.id} value={campaign.id}>
                        {campaign.name}
                      </option>
                    ))}
                  </select>
                </label>
                {createError && <p className="text-xs text-danger-foreground">{createError}</p>}
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => void createScene()}
                    disabled={!name.trim() || submitting}
                    className="focus-ring rounded-md bg-gradient-to-b from-ember-400 to-ember-500 px-3 py-1.5 text-sm font-medium text-ink-950 shadow-sm transition hover:shadow-glow-sm disabled:cursor-not-allowed disabled:from-ink-700 disabled:to-ink-700 disabled:text-parchment-500/50 disabled:shadow-none"
                  >
                    {submitting ? "Skapar…" : "Skapa scen"}
                  </button>
                  <button
                    type="button"
                    onClick={cancelCreating}
                    disabled={submitting}
                    className="focus-ring rounded-md px-3 py-1.5 text-sm font-medium text-parchment-400 transition hover:text-ember-300 disabled:opacity-40"
                  >
                    Avbryt
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={startCreating}
                className="focus-ring flex w-fit items-center gap-2 rounded-lg border-2 border-dashed border-border-strong px-4 py-2.5 text-sm font-medium text-muted-foreground transition hover:border-ember-400/50 hover:text-ember-300"
              >
                <PlusIcon className="h-4 w-4" />
                Ny scen
              </button>
            )}
          </section>

          {groups.map((group) => {
            const groupScenes = scenes.filter((s) => (s.campaignId ?? null) === group.id);
            // An empty "Utan kampanj" heading is noise; an empty campaign is
            // worth showing, so it is obvious where its scenes would land.
            if (groupScenes.length === 0 && group.id === null) return null;

            return (
              <section key={group.id ?? "none"} className="flex flex-col gap-3">
                <h2 className="font-display text-lg font-medium tracking-wide text-parchment-100">
                  {group.name}
                  <span className="ml-2 font-sans text-xs font-normal text-muted-foreground">
                    {groupScenes.length} {groupScenes.length === 1 ? "scen" : "scener"}
                  </span>
                </h2>

                {groupScenes.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Inga scener i den här kampanjen än — flytta hit en scen nedan, eller skapa en ny.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {groupScenes.map((scene) => (
                      <SceneCard
                        key={scene.id}
                        scene={scene}
                        campaigns={campaigns}
                        isLastUsed={scene.id === lastSceneId}
                        deleting={deletingId === scene.id}
                        onToggleFavorite={(e) => void toggleFavorite(e, scene.id, scene.favorite)}
                        onDelete={(e) => void deleteScene(e, scene.id)}
                        onMove={(campaignId) => void moveScene(scene.id, campaignId)}
                      />
                    ))}
                  </div>
                )}
              </section>
            );
          })}

          {scenes.length === 0 && !creating && (
            <p className="text-sm text-muted-foreground">
              Inga scener än — skapa din första ovan.
            </p>
          )}
        </>
      )}
    </div>
  );
}

function countScenesByCampaign(scenes: SceneListItem[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const scene of scenes) {
    if (!scene.campaignId) continue;
    counts.set(scene.campaignId, (counts.get(scene.campaignId) ?? 0) + 1);
  }
  return counts;
}

/**
 * Where campaigns are made, renamed and retired. Deleting one keeps its scenes
 * — they drop back to "Utan kampanj" — so this stays a low-stakes button.
 */
function CampaignsSection({
  campaigns,
  sceneCounts,
  onChange,
}: {
  campaigns: Campaign[];
  sceneCounts: Map<string, number>;
  onChange: (campaigns: Campaign[]) => void;
}) {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");

  async function createCampaign() {
    const trimmed = name.trim();
    if (!trimmed) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      if (!res.ok) throw new Error("Kunde inte skapa kampanjen");
      const { campaign }: { campaign: Campaign } = await res.json();
      onChange([...campaigns, campaign]);
      setName("");
      setCreating(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunde inte skapa kampanjen");
    } finally {
      setSubmitting(false);
    }
  }

  async function renameCampaign(id: string) {
    const trimmed = draftName.trim();
    setEditingId(null);
    const current = campaigns.find((c) => c.id === id);
    if (!current || !trimmed || trimmed === current.name) return;
    onChange(campaigns.map((c) => (c.id === id ? { ...c, name: trimmed } : c)));
    const res = await fetch(`/api/campaigns/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: trimmed }),
    }).catch(() => null);
    if (!res?.ok) onChange(campaigns);
  }

  async function deleteCampaign(id: string) {
    const res = await fetch(`/api/campaigns/${id}`, { method: "DELETE" }).catch(() => null);
    if (!res?.ok) return;
    onChange(campaigns.filter((c) => c.id !== id));
    if (readActiveCampaignId() === id) writeActiveCampaignId(null);
  }

  return (
    <section className="rounded-lg border border-border bg-surface/60 p-4">
      <h2 className="font-display text-lg font-medium tracking-wide text-parchment-100">
        Kampanjer
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Grupperar scenerna. Favoriterna i den kampanj du valt är de flikar som ligger
        ovanför musikplatserna på mixerbordet.
      </p>

      <ul className="mt-3 flex flex-wrap items-center gap-2">
        {campaigns.map((campaign) => (
          <li
            key={campaign.id}
            className="flex items-center gap-1.5 rounded-full border border-border-strong bg-background py-1 pr-1.5 pl-3"
          >
            {editingId === campaign.id ? (
              <input
                type="text"
                autoFocus
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                onBlur={() => void renameCampaign(campaign.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void renameCampaign(campaign.id);
                  if (e.key === "Escape") setEditingId(null);
                }}
                aria-label={`Nytt namn för ${campaign.name}`}
                className="focus-ring w-40 rounded-sm bg-transparent text-sm text-parchment-100 focus:outline-none"
              />
            ) : (
              <>
                <span className="text-sm text-parchment-100">{campaign.name}</span>
                <span className="text-xs text-muted-foreground">
                  {sceneCounts.get(campaign.id) ?? 0}
                </span>
              </>
            )}
            <Tooltip label="Byt namn" placement="bottom" className="flex-none">
              <button
                type="button"
                onClick={() => {
                  setEditingId(campaign.id);
                  setDraftName(campaign.name);
                }}
                aria-label={`Byt namn på ${campaign.name}`}
                className="focus-ring flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition hover:text-ember-300"
              >
                <PencilIcon className="h-3.5 w-3.5" />
              </button>
            </Tooltip>
            <Tooltip
              label="Ta bort kampanjen (scenerna behålls)"
              placement="bottom"
              align="end"
              className="flex-none"
            >
              <button
                type="button"
                onClick={() => void deleteCampaign(campaign.id)}
                aria-label={`Ta bort kampanjen ${campaign.name}`}
                className="focus-ring flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition hover:text-wine-400"
              >
                <XIcon className="h-3.5 w-3.5" />
              </button>
            </Tooltip>
          </li>
        ))}

        <li>
          {creating ? (
            <span className="flex items-center gap-2">
              <input
                type="text"
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void createCampaign();
                  if (e.key === "Escape") {
                    setCreating(false);
                    setName("");
                  }
                }}
                placeholder="Namn, t.ex. Curse of Strahd"
                className="focus-ring rounded-md border border-border-strong bg-background px-3 py-1.5 text-sm text-parchment-100 placeholder:text-muted-foreground focus:border-ember-400"
              />
              <button
                type="button"
                onClick={() => void createCampaign()}
                disabled={!name.trim() || submitting}
                className="focus-ring rounded-md bg-gradient-to-b from-ember-400 to-ember-500 px-3 py-1.5 text-sm font-medium text-ink-950 shadow-sm transition hover:shadow-glow-sm disabled:cursor-not-allowed disabled:from-ink-700 disabled:to-ink-700 disabled:text-parchment-500/50 disabled:shadow-none"
              >
                {submitting ? "Skapar…" : "Skapa"}
              </button>
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="focus-ring flex items-center gap-1.5 rounded-full border border-dashed border-border-strong px-3 py-1.5 text-sm text-muted-foreground transition hover:border-ember-400/50 hover:text-ember-300"
            >
              <PlusIcon className="h-4 w-4" />
              Ny kampanj
            </button>
          )}
        </li>
      </ul>
      {error && <p className="mt-2 text-xs text-danger-foreground">{error}</p>}
    </section>
  );
}

function SceneCard({
  scene,
  campaigns,
  isLastUsed,
  deleting,
  onToggleFavorite,
  onDelete,
  onMove,
}: {
  scene: SceneListItem;
  campaigns: Campaign[];
  isLastUsed: boolean;
  deleting: boolean;
  onToggleFavorite: (e: MouseEvent) => void;
  onDelete: (e: MouseEvent) => void;
  onMove: (campaignId: string | null) => void;
}) {
  return (
    <div className="group relative flex flex-col rounded-lg border border-border bg-surface shadow-sm transition hover:border-ember-400/40 hover:shadow-md">
      <Link
        href={`/scenes/${scene.id}`}
        className="focus-ring flex min-h-[8rem] flex-1 flex-col gap-2 rounded-t-lg p-4 pr-14"
      >
        <p className="font-display text-lg font-medium tracking-wide text-parchment-100">
          {scene.name}
        </p>
        {scene.description && (
          <p className="line-clamp-3 text-sm text-muted-foreground">{scene.description}</p>
        )}
        {isLastUsed && (
          <span className="mt-auto inline-flex w-fit items-center gap-1 rounded-full border border-ember-400/40 bg-ember-400/10 px-2 py-0.5 text-[11px] font-medium text-ember-300">
            Senast använd
          </span>
        )}
      </Link>

      {/* Outside the link, since a select inside one can't be opened. */}
      <div className="flex items-center gap-2 border-t border-border px-4 py-2">
        <select
          value={scene.campaignId ?? ""}
          onChange={(e) => onMove(e.target.value || null)}
          aria-label={`Kampanj för ${scene.name}`}
          className="focus-ring w-full rounded-md border border-border-strong bg-background px-2 py-1 text-xs text-parchment-200 focus:border-ember-400"
        >
          <option value="">Utan kampanj</option>
          {campaigns.map((campaign) => (
            <option key={campaign.id} value={campaign.id}>
              {campaign.name}
            </option>
          ))}
        </select>
      </div>

      <div className="absolute right-3 top-4 flex items-center gap-2.5">
        <Tooltip
          label={scene.favorite ? "Ta bort som favorit" : "Gör till favorit"}
          placement="bottom"
          className="flex-none"
        >
          <button
            type="button"
            onClick={onToggleFavorite}
            aria-label={
              scene.favorite
                ? `Ta bort ${scene.name} som favorit`
                : `Gör ${scene.name} till favorit`
            }
            className={`focus-ring flex-none rounded-full transition ${
              scene.favorite
                ? "text-ember-400 hover:text-ember-300"
                : "hover-reveal text-muted-foreground/60 hover:text-ember-300"
            }`}
          >
            <StarIcon className="h-4 w-4" filled={scene.favorite} />
          </button>
        </Tooltip>
        <Tooltip label="Ta bort scen" placement="bottom" align="end" className="flex-none">
          <button
            type="button"
            onClick={onDelete}
            disabled={deleting}
            aria-label={`Ta bort ${scene.name}`}
            className="hover-reveal focus-ring flex-none rounded-full text-muted-foreground/80 transition hover:text-wine-400 disabled:opacity-40"
          >
            <XIcon className="h-4 w-4" />
          </button>
        </Tooltip>
      </div>
    </div>
  );
}
