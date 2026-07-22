import { randomUUID } from "node:crypto";
import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "./index";
import {
  audioFileCollections,
  audioFiles,
  collections,
  sceneMusicSlots,
  sceneOneshotSlots,
  scenes,
} from "./schema";
import type {
  AudioCategory,
  AudioFile,
  Collection,
  MusicSlot,
  OneShotSlot,
  Scene,
} from "@/types/domain";

const MUSIC_SLOT_COUNT = 10;
const ONESHOT_SLOT_COUNT = 20;

function toMusicSlot(row: typeof sceneMusicSlots.$inferSelect): MusicSlot {
  return {
    sceneId: row.sceneId,
    slotIndex: row.slotIndex,
    audioFileId: row.audioFileId,
    volume: row.volume,
    loop: row.loop,
    fade: { fadeInMs: row.fadeInMs, fadeOutMs: row.fadeOutMs },
  };
}

function toOneShotSlot(row: typeof sceneOneshotSlots.$inferSelect): OneShotSlot {
  return {
    sceneId: row.sceneId,
    slotIndex: row.slotIndex,
    audioFileId: row.audioFileId,
    volume: row.volume,
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
    tags: row.tags,
    createdAt: row.createdAt.toISOString(),
  };
}

function toCollection(row: typeof collections.$inferSelect): Collection {
  return {
    id: row.id,
    name: row.name,
    createdAt: row.createdAt.toISOString(),
  };
}

async function loadSceneSlots(sceneId: string) {
  const [musicRows, oneshotRows] = await Promise.all([
    db
      .select()
      .from(sceneMusicSlots)
      .where(eq(sceneMusicSlots.sceneId, sceneId))
      .orderBy(asc(sceneMusicSlots.slotIndex)),
    db
      .select()
      .from(sceneOneshotSlots)
      .where(eq(sceneOneshotSlots.sceneId, sceneId))
      .orderBy(asc(sceneOneshotSlots.slotIndex)),
  ]);

  return {
    musicSlots: musicRows.map(toMusicSlot),
    oneShotSlots: oneshotRows.map(toOneShotSlot),
  };
}

function toScene(
  row: typeof scenes.$inferSelect,
  slots: { musicSlots: MusicSlot[]; oneShotSlots: OneShotSlot[] }
): Scene {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    musicSlots: slots.musicSlots,
    oneShotSlots: slots.oneShotSlots,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listScenes(): Promise<
  Pick<Scene, "id" | "name" | "description" | "createdAt" | "updatedAt">[]
> {
  const rows = await db
    .select({
      id: scenes.id,
      name: scenes.name,
      description: scenes.description,
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
}): Promise<Scene> {
  const id = randomUUID();

  const musicSlotValues = Array.from({ length: MUSIC_SLOT_COUNT }, (_, i) => ({
    sceneId: id,
    slotIndex: i + 1,
  }));
  const oneshotSlotValues = Array.from({ length: ONESHOT_SLOT_COUNT }, (_, i) => ({
    sceneId: id,
    slotIndex: i + 1,
  }));

  await db.batch([
    db.insert(scenes).values({ id, name: input.name, description: input.description }),
    db.insert(sceneMusicSlots).values(musicSlotValues),
    db.insert(sceneOneshotSlots).values(oneshotSlotValues),
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
  patch: { name?: string; description?: string | null }
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
    volume: number;
    loop: boolean;
    fadeInMs: number;
    fadeOutMs: number;
  }>
): Promise<MusicSlot | null> {
  const [row] = await db
    .update(sceneMusicSlots)
    .set(patch)
    .where(and(eq(sceneMusicSlots.sceneId, sceneId), eq(sceneMusicSlots.slotIndex, slotIndex)))
    .returning();
  return row ? toMusicSlot(row) : null;
}

export async function getOneShotSlot(
  sceneId: string,
  slotIndex: number
): Promise<OneShotSlot | null> {
  const [row] = await db
    .select()
    .from(sceneOneshotSlots)
    .where(
      and(eq(sceneOneshotSlots.sceneId, sceneId), eq(sceneOneshotSlots.slotIndex, slotIndex))
    )
    .limit(1);
  return row ? toOneShotSlot(row) : null;
}

export async function updateOneShotSlot(
  sceneId: string,
  slotIndex: number,
  patch: Partial<{
    audioFileId: string | null;
    volume: number;
    color: string | null;
    icon: string | null;
  }>
): Promise<OneShotSlot | null> {
  const [row] = await db
    .update(sceneOneshotSlots)
    .set(patch)
    .where(
      and(eq(sceneOneshotSlots.sceneId, sceneId), eq(sceneOneshotSlots.slotIndex, slotIndex))
    )
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
  tags: string[];
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
  patch: Partial<{ category: AudioCategory | null; tags: string[] }>
): Promise<AudioFile | null> {
  const [row] = await db
    .update(audioFiles)
    .set(patch)
    .where(eq(audioFiles.id, id))
    .returning();
  return row ? toAudioFile(row) : null;
}

export async function bulkUpdateAudioFileTags(
  ids: string[],
  changes: { add?: string[]; remove?: string[] }
): Promise<AudioFile[]> {
  const rows = await db.select().from(audioFiles).where(inArray(audioFiles.id, ids));
  if (rows.length === 0) return [];

  const add = changes.add ?? [];
  const remove = new Set(changes.remove ?? []);

  const updates = rows.map((row) => {
    const nextTags = new Set(row.tags.filter((tag) => !remove.has(tag)));
    for (const tag of add) nextTags.add(tag);
    return db
      .update(audioFiles)
      .set({ tags: Array.from(nextTags) })
      .where(eq(audioFiles.id, row.id))
      .returning();
  });

  const results = await db.batch(
    updates as [(typeof updates)[number], ...(typeof updates)[number][]]
  );
  return results.map(([row]) => toAudioFile(row));
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

export async function createCollection(name: string): Promise<Collection> {
  const [row] = await db.insert(collections).values({ name }).returning();
  return toCollection(row);
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
