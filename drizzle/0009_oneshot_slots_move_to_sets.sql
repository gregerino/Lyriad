ALTER TABLE "scene_oneshot_slots" DROP CONSTRAINT "scene_oneshot_slots_scene_id_scenes_id_fk";
--> statement-breakpoint
ALTER TABLE "scene_oneshot_slots" DROP CONSTRAINT "scene_oneshot_slots_scene_id_slot_index_pk";--> statement-breakpoint
ALTER TABLE "scene_oneshot_slots" ALTER COLUMN "set_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "scene_oneshot_slots" ADD CONSTRAINT "scene_oneshot_slots_set_id_slot_index_pk" PRIMARY KEY("set_id","slot_index");--> statement-breakpoint
ALTER TABLE "scene_oneshot_slots" DROP COLUMN "scene_id";