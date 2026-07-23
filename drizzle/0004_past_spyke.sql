CREATE TABLE "scene_mix_presets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scene_id" uuid NOT NULL,
	"name" text NOT NULL,
	"master_volume" real NOT NULL,
	"group_volumes" jsonb NOT NULL,
	"slot_volumes" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "scene_mix_presets_master_volume_check" CHECK ("scene_mix_presets"."master_volume" BETWEEN 0 AND 1)
);
--> statement-breakpoint
ALTER TABLE "scene_mix_presets" ADD CONSTRAINT "scene_mix_presets_scene_id_scenes_id_fk" FOREIGN KEY ("scene_id") REFERENCES "public"."scenes"("id") ON DELETE cascade ON UPDATE no action;