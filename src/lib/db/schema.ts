import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  real,
  smallint,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const audioFiles = pgTable(
  "audio_files",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    filename: text("filename").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    r2Key: text("r2_key").notNull().unique(),
    mimeType: text("mime_type").notNull(),
    category: text("category"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check(
      "audio_files_category_check",
      sql`${table.category} IS NULL OR ${table.category} IN ('music', 'oneshot')`
    ),
  ]
);

export const collections = pgTable("collections", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const audioFileCollections = pgTable(
  "audio_file_collections",
  {
    audioFileId: uuid("audio_file_id")
      .notNull()
      .references(() => audioFiles.id, { onDelete: "cascade" }),
    collectionId: uuid("collection_id")
      .notNull()
      .references(() => collections.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.audioFileId, table.collectionId] })]
);

export const scenes = pgTable("scenes", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  description: text("description"),
  favorite: boolean("favorite").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const sceneMusicSlots = pgTable(
  "scene_music_slots",
  {
    sceneId: uuid("scene_id")
      .notNull()
      .references(() => scenes.id, { onDelete: "cascade" }),
    slotIndex: smallint("slot_index").notNull(),
    audioFileId: uuid("audio_file_id").references(() => audioFiles.id, {
      onDelete: "set null",
    }),
    name: text("name"),
    volume: real("volume").notNull().default(0.8),
    loop: boolean("loop").notNull().default(true),
    fadeInMs: integer("fade_in_ms").notNull().default(0),
    fadeOutMs: integer("fade_out_ms").notNull().default(0),
  },
  (table) => [
    primaryKey({ columns: [table.sceneId, table.slotIndex] }),
    check("scene_music_slots_slot_index_check", sql`${table.slotIndex} BETWEEN 1 AND 10`),
    check("scene_music_slots_volume_check", sql`${table.volume} BETWEEN 0 AND 1`),
    check("scene_music_slots_fade_in_ms_check", sql`${table.fadeInMs} >= 0`),
    check("scene_music_slots_fade_out_ms_check", sql`${table.fadeOutMs} >= 0`),
  ]
);

export const sceneOneshotSlots = pgTable(
  "scene_oneshot_slots",
  {
    sceneId: uuid("scene_id")
      .notNull()
      .references(() => scenes.id, { onDelete: "cascade" }),
    slotIndex: smallint("slot_index").notNull(),
    audioFileId: uuid("audio_file_id").references(() => audioFiles.id, {
      onDelete: "set null",
    }),
    volume: real("volume").notNull().default(0.8),
    color: text("color"),
    icon: text("icon"),
  },
  (table) => [
    primaryKey({ columns: [table.sceneId, table.slotIndex] }),
    check("scene_oneshot_slots_slot_index_check", sql`${table.slotIndex} BETWEEN 1 AND 20`),
    check("scene_oneshot_slots_volume_check", sql`${table.volume} BETWEEN 0 AND 1`),
  ]
);

export const sceneMixPresets = pgTable(
  "scene_mix_presets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sceneId: uuid("scene_id")
      .notNull()
      .references(() => scenes.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    masterVolume: real("master_volume").notNull(),
    groupVolumes: jsonb("group_volumes").notNull().$type<Record<string, number>>(),
    slotVolumes: jsonb("slot_volumes").notNull().$type<Record<string, number>>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check(
      "scene_mix_presets_master_volume_check",
      sql`${table.masterVolume} BETWEEN 0 AND 1`
    ),
  ]
);
