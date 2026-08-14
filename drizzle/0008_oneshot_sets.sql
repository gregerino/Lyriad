CREATE TABLE "scene_oneshot_sets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scene_id" uuid NOT NULL,
	"name" text NOT NULL,
	"position" smallint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "scene_oneshot_slots" ADD COLUMN "set_id" uuid;--> statement-breakpoint
ALTER TABLE "scene_oneshot_slots" ADD COLUMN "loop" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "scene_oneshot_sets" ADD CONSTRAINT "scene_oneshot_sets_scene_id_scenes_id_fk" FOREIGN KEY ("scene_id") REFERENCES "public"."scenes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scene_oneshot_slots" ADD CONSTRAINT "scene_oneshot_slots_set_id_scene_oneshot_sets_id_fk" FOREIGN KEY ("set_id") REFERENCES "public"."scene_oneshot_sets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
INSERT INTO "scene_oneshot_sets" ("scene_id", "name", "position") SELECT "id", 'Set 1', 0 FROM "scenes";--> statement-breakpoint
UPDATE "scene_oneshot_slots" AS s SET "set_id" = t."id" FROM "scene_oneshot_sets" AS t WHERE t."scene_id" = s."scene_id";
