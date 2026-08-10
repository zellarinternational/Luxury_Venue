ALTER TABLE "floor_plans" ALTER COLUMN "width_units" SET DATA TYPE double precision;--> statement-breakpoint
ALTER TABLE "floor_plans" ALTER COLUMN "height_units" SET DATA TYPE double precision;--> statement-breakpoint
ALTER TABLE "floor_plans" ALTER COLUMN "scale_factor" SET DATA TYPE double precision;--> statement-breakpoint
ALTER TABLE "stages" ALTER COLUMN "x" SET DATA TYPE double precision;--> statement-breakpoint
ALTER TABLE "stages" ALTER COLUMN "y" SET DATA TYPE double precision;--> statement-breakpoint
ALTER TABLE "stages" ALTER COLUMN "rotation" SET DATA TYPE double precision;--> statement-breakpoint
ALTER TABLE "stages" ALTER COLUMN "width" SET DATA TYPE double precision;--> statement-breakpoint
ALTER TABLE "stages" ALTER COLUMN "depth" SET DATA TYPE double precision;--> statement-breakpoint
ALTER TABLE "stages" ALTER COLUMN "backstage_depth" SET DATA TYPE double precision;--> statement-breakpoint
ALTER TABLE "cities" ADD COLUMN "hero_title" text;--> statement-breakpoint
ALTER TABLE "cities" ADD COLUMN "hero_subtitle" text;--> statement-breakpoint
ALTER TABLE "countries" ADD COLUMN "hero_subtitle" text;--> statement-breakpoint
ALTER TABLE "floor_plans" ADD COLUMN "raw" jsonb;--> statement-breakpoint
ALTER TABLE "stages" ADD COLUMN "z_offset" double precision;--> statement-breakpoint
ALTER TABLE "stages" ADD COLUMN "raw" jsonb;--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN "state_id" text;--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN "state_name" text;