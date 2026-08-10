ALTER TABLE "shared_configs" ADD COLUMN "selected_table_area_id" uuid;--> statement-breakpoint
ALTER TABLE "shared_configs" ADD COLUMN "custom_table_area" jsonb;--> statement-breakpoint
ALTER TABLE "shared_configs" DROP COLUMN "placed_objects";--> statement-breakpoint
ALTER TABLE "shared_configs" DROP COLUMN "manual_table_count";--> statement-breakpoint
ALTER TABLE "shared_configs" DROP COLUMN "manual_chair_count";