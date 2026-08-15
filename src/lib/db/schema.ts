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
  /** Free-form theme the collection is filed under ("Strider", "Magi", …). */
  category: text("category"),
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

/**
 * A campaign the scenes are played in — "Curse of Strahd", "Phandelver". Only
 * a grouping: the desk shows one campaign's favourites at a time, so the tab
 * bar above the music slots holds the handful of scenes tonight's game needs.
 */
export const campaigns = pgTable("campaigns", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  /** Order in the campaign switcher; ties fall back to created_at. */
  position: smallint("position").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const scenes = pgTable("scenes", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  description: text("description"),
  favorite: boolean("favorite").notNull().default(false),
  /** Null means the scene belongs to no campaign — it shows under "Utan kampanj". */
  campaignId: uuid("campaign_id").references(() => campaigns.id, {
    onDelete: "set null",
  }),
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
  },
  (table) => [
    primaryKey({ columns: [table.sceneId, table.slotIndex] }),
    check("scene_music_slots_slot_index_check", sql`${table.slotIndex} BETWEEN 1 AND 10`),
    check("scene_music_slots_volume_check", sql`${table.volume} BETWEEN 0 AND 1`),
  ]
);

/**
 * A bank of one-shot pads — "Strid", "Krogen", "Resan". Sets belong to no
 * particular scene: a bank of combat sounds is worth as much in the dungeon as
 * in the street, so the pad grid picks one of these the way the tab bar picks a
 * scene. Which set a scene was left on is remembered per browser, not stored.
 */
export const oneshotSets = pgTable("oneshot_sets", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  /**
   * Free-form group the set is filed under ("Strid", "Miljö", "Röster"), the
   * way a collection has a category. Null means it shows under "Utan grupp".
   * A plain column rather than a table: the switcher needs the name and nothing
   * else, and a group stops existing when its last set leaves it.
   */
  groupName: text("group_name"),
  /** Tab order in the set switcher; ties fall back to created_at. */
  position: smallint("position").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const oneshotSlots = pgTable(
  "oneshot_slots",
  {
    setId: uuid("set_id")
      .notNull()
      .references(() => oneshotSets.id, { onDelete: "cascade" }),
    slotIndex: smallint("slot_index").notNull(),
    audioFileId: uuid("audio_file_id").references(() => audioFiles.id, {
      onDelete: "set null",
    }),
    name: text("name"),
    volume: real("volume").notNull().default(0.8),
    /** A looping pad keeps going until it is pressed again — rain, a crowd, a fire. */
    loop: boolean("loop").notNull().default(false),
    color: text("color"),
    icon: text("icon"),
  },
  (table) => [
    primaryKey({ columns: [table.setId, table.slotIndex] }),
    check("oneshot_slots_slot_index_check", sql`${table.slotIndex} BETWEEN 1 AND 20`),
    check("oneshot_slots_volume_check", sql`${table.volume} BETWEEN 0 AND 1`),
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
