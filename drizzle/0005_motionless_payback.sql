ALTER TABLE "scene_music_slots" DROP CONSTRAINT "scene_music_slots_fade_in_ms_check";--> statement-breakpoint
ALTER TABLE "scene_music_slots" DROP CONSTRAINT "scene_music_slots_fade_out_ms_check";--> statement-breakpoint
ALTER TABLE "scene_music_slots" DROP COLUMN "fade_in_ms";--> statement-breakpoint
ALTER TABLE "scene_music_slots" DROP COLUMN "fade_out_ms";