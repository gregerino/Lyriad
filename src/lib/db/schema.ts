import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  integer,
  pgTable,
  primaryKey,
  real,
  smallint,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const audioFiles = pgTable("audio_files", {
  id: uuid("id").primaryKey().defaultRandom(),
  filename: text("filename").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  r2Key: text("r2_key").notNull().unique(),
  mimeType: text("mime_type").notNull(),
  category: text("category"),
  tags: text("tags").array().notNull().default(sql`'{}'::text[]`),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const scenes = pgTable("scenes", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  description: text("description"),
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
