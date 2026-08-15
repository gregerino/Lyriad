import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "./index";
import {
  audioFileCollections,
  audioFiles,
  campaigns,
  collections,
  sceneMixPresets,
  sceneMusicSlots,
  sceneOneshotSets,
  sceneOneshotSlots,
  scenes,
} from "./schema";
import type {
  AudioCategory,
  AudioFile,
  Campaign,
  Collection,
  MixPreset,
  MusicSlot,
  OneShotSet,
  OneShotSlot,
  Scene,
} from "@/types/domain";

const MUSIC_SLOT_COUNT = 10;
const ONESHOT_SLOT_COUNT = 20;
/** What the set every new scene starts with is called. */
const DEFAULT_ONESHOT_SET_NAME = "Set 1";

function toMusicSlot(row: typeof sceneMusicSlots.$inferSelect): MusicSlot {
  return {
    sceneId: row.sceneId,
    slotIndex: row.slotIndex,
    audioFileId: row.audioFileId,
    name: row.name,
    volume: row.volume,
    loop: row.loop,
  };
}

function toOneShotSlot(row: typeof sceneOneshotSlots.$inferSelect): OneShotSlot {
  return {
    setId: row.setId,
    slotIndex: row.slotIndex,
    audioFileId: row.audioFileId,
    name: row.name,
    volume: row.volume,
    loop: row.loop,
    color: row.color,
    icon: row.icon,
  };
}

export function toAudioFile(row: typeof audioFiles.$inferSelect): AudioFile {
  return {
    id: row.id,
    filename: row.filename,
    sizeBytes: row.sizeBytes,
    r2Key: row.r2Key,
    mimeType: row.mimeType,
    category: row.category as AudioCategory | null,
    createdAt: row.createdAt.toISOString(),
  };
}

function toCollection(row: typeof collections.$inferSelect): Collection {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    createdAt: row.createdAt.toISOString(),
  };
}

function toMixPreset(row: typeof sceneMixPresets.$inferSelect): MixPreset {
  return {
    id: row.id,
    sceneId: row.sceneId,
    name: row.name,
    masterVolume: row.masterVolume,
    groupVolumes: row.groupVolumes,
    slotVolumes: row.slotVolumes,
    createdAt: row.createdAt.toISOString(),
  };
}

/**
 * The one-shot sets of a scene, each carrying its own twenty slots. Fetched as
 * two flat queries and stitched here rather than as a join, so a set that is
 * somehow missing rows still comes back as a set.
 */
async function loadOneShotSets(sceneId: string): Promise<OneShotSet[]> {
  const setRows = await db
    .select()
    .from(sceneOneshotSets)
    .where(eq(sceneOneshotSets.sceneId, sceneId))
    .orderBy(asc(sceneOneshotSets.position), asc(sceneOneshotSets.createdAt));
  if (setRows.length === 0) return [];

  const slotRows = await db
    .select()
    .from(sceneOneshotSlots)
    .where(
      inArray(
        sceneOneshotSlots.setId,
        setRows.map((s) => s.id)
      )
    )
    .orderBy(asc(sceneOneshotSlots.slotIndex));

  const slotsBySet = new Map<string, OneShotSlot[]>();
  for (const row of slotRows) {
    const slot = toOneShotSlot(row);
    const existing = slotsBySet.get(slot.setId);
    if (existing) existing.push(slot);
    else slotsBySet.set(slot.setId, [slot]);
  }

  return setRows.map((row) => ({
    id: row.id,
    sceneId: row.sceneId,
    name: row.name,
    position: row.position,
    slots: slotsBySet.get(row.id) ?? [],
  }));
}

async function loadSceneSlots(sceneId: string) {
  const [musicRows, oneShotSets] = await Promise.all([
    db
      .select()
      .from(sceneMusicSlots)
      .where(eq(sceneMusicSlots.sceneId, sceneId))
      .orderBy(asc(sceneMusicSlots.slotIndex)),
    loadOneShotSets(sceneId),
  ]);

  return {
    musicSlots: musicRows.map(toMusicSlot),
    oneShotSets,
  };
}

function toScene(
  row: typeof scenes.$inferSelect,
  slots: { musicSlots: MusicSlot[]; oneShotSets: OneShotSet[] }
): Scene {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    favorite: row.favorite,
    campaignId: row.campaignId,
    musicSlots: slots.musicSlots,
    oneShotSets: slots.oneShotSets,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toCampaign(row: typeof campaigns.$inferSelect): Campaign {
  return {
    id: row.id,
    name: row.name,
    position: row.position,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listCampaigns(): Promise<Campaign[]> {
  const rows = await db
    .select()
    .from(campaigns)
    .orderBy(asc(campaigns.position), asc(campaigns.createdAt));
  return rows.map(toCampaign);
}

export async function createCampaign(input: { name: string }): Promise<Campaign> {
  // New campaigns land last in the switcher, the way one is actually started.
  const [{ next } = { next: 0 }] = await db
    .select({ next: sql<number>`coalesce(max(${campaigns.position}), -1) + 1` })
    .from(campaigns);

  const [row] = await db
    .insert(campaigns)
    .values({ name: input.name, position: next })
    .returning();
  if (!row) throw new Error("Failed to create campaign");
  return toCampaign(row);
}

export async function updateCampaign(
  id: string,
  patch: { name?: string; position?: number }
): Promise<Campaign | null> {
  const [row] = await db.update(campaigns).set(patch).where(eq(campaigns.id, id)).returning();
  return row ? toCampaign(row) : null;
}

/** Scenes survive: the foreign key drops them back to "no campaign". */
export async function deleteCampaign(id: string): Promise<boolean> {
  const [row] = await db.delete(campaigns).where(eq(campaigns.id, id)).returning({
    id: campaigns.id,
  });
  return !!row;
}

export async function listScenes(): Promise<
  Pick<
    Scene,
    "id" | "name" | "description" | "favorite" | "campaignId" | "createdAt" | "updatedAt"
  >[]
> {
  const rows = await db
    .select({
      id: scenes.id,
      name: scenes.name,
      description: scenes.description,
      favorite: scenes.favorite,
      campaignId: scenes.campaignId,
      createdAt: scenes.createdAt,
      updatedAt: scenes.updatedAt,
    })
    .from(scenes)
    .orderBy(asc(scenes.createdAt));

  return rows.map((row) => ({
    ...row,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }));
}

export async function createScene(input: {
  name: string;
  description: string | null;
  campaignId?: string | null;
}): Promise<Scene> {
  const id = randomUUID();
  const setId = randomUUID();

  const musicSlotValues = Array.from({ length: MUSIC_SLOT_COUNT }, (_, i) => ({
    sceneId: id,
    slotIndex: i + 1,
  }));

  await db.batch([
    db.insert(scenes).values({
      id,
      name: input.name,
      description: input.description,
      campaignId: input.campaignId ?? null,
    }),
    db.insert(sceneMusicSlots).values(musicSlotValues),
    db
      .insert(sceneOneshotSets)
      .values({ id: setId, sceneId: id, name: DEFAULT_ONESHOT_SET_NAME, position: 0 }),
    db.insert(sceneOneshotSlots).values(oneShotSlotValues(setId)),
  ]);

  const scene = await getSceneWithSlots(id);
  if (!scene) throw new Error("Failed to load scene after creation");
  return scene;
}

export async function getSceneWithSlots(id: string): Promise<Scene | null> {
  const [row] = await db.select().from(scenes).where(eq(scenes.id, id)).limit(1);
  if (!row) return null;

  const slots = await loadSceneSlots(id);
  return toScene(row, slots);
}

export async function sceneExists(id: string): Promise<boolean> {
  const [row] = await db
    .select({ id: scenes.id })
    .from(scenes)
    .where(eq(scenes.id, id))
    .limit(1);
  return !!row;
}

export async function updateScene(
  id: string,
  patch: {
    name?: string;
    description?: string | null;
    favorite?: boolean;
    campaignId?: string | null;
  }
): Promise<Scene | null> {
  const [row] = await db
    .update(scenes)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(scenes.id, id))
    .returning();
  if (!row) return null;

  const slots = await loadSceneSlots(id);
  return toScene(row, slots);
}

export async function deleteScene(id: string): Promise<boolean> {
  const [row] = await db.delete(scenes).where(eq(scenes.id, id)).returning({ id: scenes.id });
  return !!row;
}

export async function getMusicSlot(
  sceneId: string,
  slotIndex: number
): Promise<MusicSlot | null> {
  const [row] = await db
    .select()
    .from(sceneMusicSlots)
    .where(and(eq(sceneMusicSlots.sceneId, sceneId), eq(sceneMusicSlots.slotIndex, slotIndex)))
    .limit(1);
  return row ? toMusicSlot(row) : null;
}

export async function updateMusicSlot(
  sceneId: string,
  slotIndex: number,
  patch: Partial<{
    audioFileId: string | null;
    name: string | null;
    volume: number;
    loop: boolean;
  }>
): Promise<MusicSlot | null> {
  const [row] = await db
    .update(sceneMusicSlots)
    .set(patch)
    .where(and(eq(sceneMusicSlots.sceneId, sceneId), eq(sceneMusicSlots.slotIndex, slotIndex)))
    .returning();
  return row ? toMusicSlot(row) : null;
}

function oneShotSlotValues(setId: string) {
  return Array.from({ length: ONESHOT_SLOT_COUNT }, (_, i) => ({
    setId,
    slotIndex: i + 1,
  }));
}

/** Resolves a set within a scene — the ownership check every set-scoped route needs. */
export async function getOneShotSet(
  sceneId: string,
  setId: string
): Promise<OneShotSet | null> {
  const [row] = await db
    .select()
    .from(sceneOneshotSets)
    .where(and(eq(sceneOneshotSets.sceneId, sceneId), eq(sceneOneshotSets.id, setId)))
    .limit(1);
  if (!row) return null;

  const slotRows = await db
    .select()
    .from(sceneOneshotSlots)
    .where(eq(sceneOneshotSlots.setId, setId))
    .orderBy(asc(sceneOneshotSlots.slotIndex));

  return {
    id: row.id,
    sceneId: row.sceneId,
    name: row.name,
    position: row.position,
    slots: slotRows.map(toOneShotSlot),
  };
}

export async function countOneShotSets(sceneId: string): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(sceneOneshotSets)
    .where(eq(sceneOneshotSets.sceneId, sceneId));
  return row?.count ?? 0;
}

/** Adds an empty set at the end of the scene's tab row, slots and all. */
export async function createOneShotSet(sceneId: string, name: string): Promise<OneShotSet> {
  const [last] = await db
    .select({ position: sceneOneshotSets.position })
    .from(sceneOneshotSets)
    .where(eq(sceneOneshotSets.sceneId, sceneId))
    .orderBy(desc(sceneOneshotSets.position))
    .limit(1);

  const id = randomUUID();
  await db.batch([
    db
      .insert(sceneOneshotSets)
      .values({ id, sceneId, name, position: (last?.position ?? -1) + 1 }),
    db.insert(sceneOneshotSlots).values(oneShotSlotValues(id)),
  ]);

  const set = await getOneShotSet(sceneId, id);
  if (!set) throw new Error("Failed to load one-shot set after creation");
  return set;
}

export async function updateOneShotSet(
  sceneId: string,
  setId: string,
  patch: Partial<{ name: string; position: number }>
): Promise<OneShotSet | null> {
  const [row] = await db
    .update(sceneOneshotSets)
    .set(patch)
    .where(and(eq(sceneOneshotSets.sceneId, sceneId), eq(sceneOneshotSets.id, setId)))
    .returning({ id: sceneOneshotSets.id });
  return row ? getOneShotSet(sceneId, setId) : null;
}

export async function deleteOneShotSet(sceneId: string, setId: string): Promise<boolean> {
  const [row] = await db
    .delete(sceneOneshotSets)
    .where(and(eq(sceneOneshotSets.sceneId, sceneId), eq(sceneOneshotSets.id, setId)))
    .returning({ id: sceneOneshotSets.id });
  return !!row;
}

export async function getOneShotSlot(
  setId: string,
  slotIndex: number
): Promise<OneShotSlot | null> {
  const [row] = await db
    .select()
    .from(sceneOneshotSlots)
    .where(and(eq(sceneOneshotSlots.setId, setId), eq(sceneOneshotSlots.slotIndex, slotIndex)))
    .limit(1);
  return row ? toOneShotSlot(row) : null;
}

export async function updateOneShotSlot(
  setId: string,
  slotIndex: number,
  patch: Partial<{
    audioFileId: string | null;
    name: string | null;
    volume: number;
    loop: boolean;
    color: string | null;
    icon: string | null;
  }>
): Promise<OneShotSlot | null> {
  const [row] = await db
    .update(sceneOneshotSlots)
    .set(patch)
    .where(and(eq(sceneOneshotSlots.setId, setId), eq(sceneOneshotSlots.slotIndex, slotIndex)))
    .returning();
  return row ? toOneShotSlot(row) : null;
}

export async function listAudioFiles(): Promise<AudioFile[]> {
  const rows = await db.select().from(audioFiles).orderBy(asc(audioFiles.createdAt));
  return rows.map(toAudioFile);
}

export async function getAudioFile(id: string): Promise<AudioFile | null> {
  const [row] = await db.select().from(audioFiles).where(eq(audioFiles.id, id)).limit(1);
  return row ? toAudioFile(row) : null;
}

export async function createAudioFile(input: {
  filename: string;
  sizeBytes: number;
  r2Key: string;
  mimeType: string;
  category: string | null;
}): Promise<AudioFile> {
  const [row] = await db.insert(audioFiles).values(input).returning();
  return toAudioFile(row);
}

export async function deleteAudioFile(id: string): Promise<AudioFile | null> {
  const [row] = await db.delete(audioFiles).where(eq(audioFiles.id, id)).returning();
  return row ? toAudioFile(row) : null;
}

export async function updateAudioFile(
  id: string,
  patch: Partial<{ category: AudioCategory | null }>
): Promise<AudioFile | null> {
  const [row] = await db
    .update(audioFiles)
    .set(patch)
    .where(eq(audioFiles.id, id))
    .returning();
  return row ? toAudioFile(row) : null;
}

export async function listAudioFileCollectionIds(): Promise<Map<string, string[]>> {
  const rows = await db
    .select({
      audioFileId: audioFileCollections.audioFileId,
      collectionId: audioFileCollections.collectionId,
    })
    .from(audioFileCollections);

  const map = new Map<string, string[]>();
  for (const row of rows) {
    const existing = map.get(row.audioFileId);
    if (existing) existing.push(row.collectionId);
    else map.set(row.audioFileId, [row.collectionId]);
  }
  return map;
}

export async function listCollections(): Promise<Collection[]> {
  const rows = await db.select().from(collections).orderBy(asc(collections.createdAt));
  return rows.map(toCollection);
}

export async function getCollection(id: string): Promise<Collection | null> {
  const [row] = await db.select().from(collections).where(eq(collections.id, id)).limit(1);
  return row ? toCollection(row) : null;
}

export async function createCollection(input: {
  name: string;
  category: string | null;
}): Promise<Collection> {
  const [row] = await db.insert(collections).values(input).returning();
  return toCollection(row);
}

export async function updateCollection(
  id: string,
  patch: Partial<{ name: string; category: string | null }>
): Promise<Collection | null> {
  const [row] = await db
    .update(collections)
    .set(patch)
    .where(eq(collections.id, id))
    .returning();
  return row ? toCollection(row) : null;
}

export async function deleteCollection(id: string): Promise<boolean> {
  const [row] = await db
    .delete(collections)
    .where(eq(collections.id, id))
    .returning({ id: collections.id });
  return !!row;
}

export async function collectionExists(id: string): Promise<boolean> {
  const [row] = await db
    .select({ id: collections.id })
    .from(collections)
    .where(eq(collections.id, id))
    .limit(1);
  return !!row;
}

export async function setCollectionMembers(
  collectionId: string,
  changes: { add?: string[]; remove?: string[] }
): Promise<void> {
  const operations = [];

  if (changes.remove && changes.remove.length > 0) {
    operations.push(
      db
        .delete(audioFileCollections)
        .where(
          and(
            eq(audioFileCollections.collectionId, collectionId),
            inArray(audioFileCollections.audioFileId, changes.remove)
          )
        )
    );
  }

  if (changes.add && changes.add.length > 0) {
    operations.push(
      db
        .insert(audioFileCollections)
        .values(changes.add.map((audioFileId) => ({ audioFileId, collectionId })))
        .onConflictDoNothing()
    );
  }

  if (operations.length === 0) return;
  await db.batch(operations as [(typeof operations)[number], ...(typeof operations)[number][]]);
}

export async function listMixPresets(sceneId: string): Promise<MixPreset[]> {
  const rows = await db
    .select()
    .from(sceneMixPresets)
    .where(eq(sceneMixPresets.sceneId, sceneId))
    .orderBy(asc(sceneMixPresets.createdAt));
  return rows.map(toMixPreset);
}

export async function createMixPreset(
  sceneId: string,
  input: {
    name: string;
    masterVolume: number;
    groupVolumes: Record<string, number>;
    slotVolumes: Record<string, number>;
  }
): Promise<MixPreset> {
  const [row] = await db
    .insert(sceneMixPresets)
    .values({ sceneId, ...input })
    .returning();
  return toMixPreset(row);
}

export async function deleteMixPreset(sceneId: string, id: string): Promise<boolean> {
  const [row] = await db
    .delete(sceneMixPresets)
    .where(and(eq(sceneMixPresets.sceneId, sceneId), eq(sceneMixPresets.id, id)))
    .returning({ id: sceneMixPresets.id });
  return !!row;
}
