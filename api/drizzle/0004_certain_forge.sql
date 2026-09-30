ALTER TABLE "tool_versions" ADD COLUMN "docker_image_ref" text;--> statement-breakpoint
ALTER TABLE "tools" ADD COLUMN "docker_image_ref" text;