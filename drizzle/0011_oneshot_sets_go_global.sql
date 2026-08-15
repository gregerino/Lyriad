-- One-shot sets leave the scene they were born in: a bank of pads is picked the
-- same way a scene is, and any scene can show any set.
--
-- Every scene got a default "Set 1" when it was created, so the naive move would
-- turn a handful of scenes into a switcher full of identically named, empty
-- sets. The untouched ones are dropped first, and whatever name collisions are
-- left are resolved by the scene the set came from — the only thing that told
-- two "Set 1"s apart.
DELETE FROM "scene_oneshot_sets" AS t
WHERE t."name" ~ '^Set [0-9]+$'
  AND NOT EXISTS (
    SELECT 1 FROM "scene_oneshot_slots" AS s
    WHERE s."set_id" = t."id" AND s."audio_file_id" IS NOT NULL
  );--> statement-breakpoint
UPDATE "scene_oneshot_sets" AS t
SET "name" = s."name" || ' · ' || t."name"
FROM "scenes" AS s
WHERE s."id" = t."scene_id"
  AND EXISTS (
    SELECT 1 FROM "scene_oneshot_sets" AS o
    WHERE o."id" <> t."id" AND o."name" = t."name"
  );--> statement-breakpoint
UPDATE "scene_oneshot_sets" AS t
SET "position" = ordered."position"
FROM (
  SELECT src."id",
         (row_number() OVER (ORDER BY s."created_at", src."position", src."created_at") - 1)::smallint AS "position"
  FROM "scene_oneshot_sets" AS src
  JOIN "scenes" AS s ON s."id" = src."scene_id"
) AS ordered
WHERE ordered."id" = t."id";--> statement-breakpoint
ALTER TABLE "scene_oneshot_sets" DROP CONSTRAINT "scene_oneshot_sets_scene_id_scenes_id_fk";--> statement-breakpoint
ALTER TABLE "scene_oneshot_sets" DROP COLUMN "scene_id";--> statement-breakpoint
ALTER TABLE "scene_oneshot_sets" RENAME TO "oneshot_sets";--> statement-breakpoint
ALTER TABLE "scene_oneshot_slots" RENAME TO "oneshot_slots";--> statement-breakpoint
ALTER TABLE "oneshot_sets" RENAME CONSTRAINT "scene_oneshot_sets_pkey" TO "oneshot_sets_pkey";--> statement-breakpoint
ALTER TABLE "oneshot_slots" RENAME CONSTRAINT "scene_oneshot_slots_set_id_slot_index_pk" TO "oneshot_slots_set_id_slot_index_pk";--> statement-breakpoint
ALTER TABLE "oneshot_slots" RENAME CONSTRAINT "scene_oneshot_slots_set_id_scene_oneshot_sets_id_fk" TO "oneshot_slots_set_id_oneshot_sets_id_fk";--> statement-breakpoint
ALTER TABLE "oneshot_slots" RENAME CONSTRAINT "scene_oneshot_slots_audio_file_id_audio_files_id_fk" TO "oneshot_slots_audio_file_id_audio_files_id_fk";--> statement-breakpoint
ALTER TABLE "oneshot_slots" RENAME CONSTRAINT "scene_oneshot_slots_slot_index_check" TO "oneshot_slots_slot_index_check";--> statement-breakpoint
ALTER TABLE "oneshot_slots" RENAME CONSTRAINT "scene_oneshot_slots_volume_check" TO "oneshot_slots_volume_check";
