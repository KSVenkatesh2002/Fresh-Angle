-- Additive migration: Update automation_settings column defaults for late_slot_grace_minutes and max_posts_per_run
ALTER TABLE "automation_settings" ALTER COLUMN "late_slot_grace_minutes" SET DEFAULT 360;
ALTER TABLE "automation_settings" ALTER COLUMN "max_posts_per_run" SET DEFAULT 2;

