CREATE TABLE "audio_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"filename" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"r2_key" text NOT NULL,
	"mime_type" text NOT NULL,
	"category" text,
	"tags" text[] DEFAULT '{}'::text[] NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "audio_files_r2_key_unique" UNIQUE("r2_key")
);
--> statement-breakpoint
CREATE TABLE "scene_music_slots" (
	"scene_id" uuid NOT NULL,
	"slot_index" smallint NOT NULL,
	"audio_file_id" uuid,
	"volume" real DEFAULT 0.8 NOT NULL,
	"loop" boolean DEFAULT true NOT NULL,
	"fade_in_ms" integer DEFAULT 0 NOT NULL,
	"fade_out_ms" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "scene_music_slots_scene_id_slot_index_pk" PRIMARY KEY("scene_id","slot_index"),
	CONSTRAINT "scene_music_slots_slot_index_check" CHECK ("scene_music_slots"."slot_index" BETWEEN 1 AND 10),
	CONSTRAINT "scene_music_slots_volume_check" CHECK ("scene_music_slots"."volume" BETWEEN 0 AND 1),
	CONSTRAINT "scene_music_slots_fade_in_ms_check" CHECK ("scene_music_slots"."fade_in_ms" >= 0),
	CONSTRAINT "scene_music_slots_fade_out_ms_check" CHECK ("scene_music_slots"."fade_out_ms" >= 0)
);
--> statement-breakpoint
CREATE TABLE "scene_oneshot_slots" (
	"scene_id" uuid NOT NULL,
	"slot_index" smallint NOT NULL,
	"audio_file_id" uuid,
	"volume" real DEFAULT 0.8 NOT NULL,
	"color" text,
	"icon" text,
	CONSTRAINT "scene_oneshot_slots_scene_id_slot_index_pk" PRIMARY KEY("scene_id","slot_index"),
	CONSTRAINT "scene_oneshot_slots_slot_index_check" CHECK ("scene_oneshot_slots"."slot_index" BETWEEN 1 AND 20),
	CONSTRAINT "scene_oneshot_slots_volume_check" CHECK ("scene_oneshot_slots"."volume" BETWEEN 0 AND 1)
);
--> statement-breakpoint
CREATE TABLE "scenes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "scene_music_slots" ADD CONSTRAINT "scene_music_slots_scene_id_scenes_id_fk" FOREIGN KEY ("scene_id") REFERENCES "public"."scenes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scene_music_slots" ADD CONSTRAINT "scene_music_slots_audio_file_id_audio_files_id_fk" FOREIGN KEY ("audio_file_id") REFERENCES "public"."audio_files"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scene_oneshot_slots" ADD CONSTRAINT "scene_oneshot_slots_scene_id_scenes_id_fk" FOREIGN KEY ("scene_id") REFERENCES "public"."scenes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scene_oneshot_slots" ADD CONSTRAINT "scene_oneshot_slots_audio_file_id_audio_files_id_fk" FOREIGN KEY ("audio_file_id") REFERENCES "public"."audio_files"("id") ON DELETE set null ON UPDATE no action;