ALTER TABLE "scenes" ADD COLUMN "favorite" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "audio_files" DROP COLUMN "tags";