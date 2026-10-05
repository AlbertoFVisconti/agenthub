ALTER TYPE "tool_status" ADD VALUE 'building';--> statement-breakpoint
ALTER TABLE "tools" ADD COLUMN "build_error" text;