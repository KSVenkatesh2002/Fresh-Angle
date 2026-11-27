-- Seed default Buffer social API usage limits (Free tier: 600/day, 1000/30-day per channel)
INSERT INTO "usage_limits" ("provider", "kind", "daily_limit", "monthly_limit", "soft_percent")
VALUES ('buffer', 'social', 600, 1000, 80)
ON CONFLICT ("provider", "kind") DO NOTHING;

