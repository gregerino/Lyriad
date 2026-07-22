CREATE TABLE "audio_file_collections" (
	"audio_file_id" uuid NOT NULL,
	"collection_id" uuid NOT NULL,
	CONSTRAINT "audio_file_collections_audio_file_id_collection_id_pk" PRIMARY KEY("audio_file_id","collection_id")
);
--> statement-breakpoint
CREATE TABLE "collections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audio_file_collections" ADD CONSTRAINT "audio_file_collections_audio_file_id_audio_files_id_fk" FOREIGN KEY ("audio_file_id") REFERENCES "public"."audio_files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audio_file_collections" ADD CONSTRAINT "audio_file_collections_collection_id_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."collections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audio_files" ADD CONSTRAINT "audio_files_category_check" CHECK ("audio_files"."category" IS NULL OR "audio_files"."category" IN ('music', 'oneshot'));