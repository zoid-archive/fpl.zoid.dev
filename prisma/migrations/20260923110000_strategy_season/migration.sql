-- Existing strategies follow the current season, as they did before.
ALTER TABLE "Strategy" ADD COLUMN "season" TEXT NOT NULL DEFAULT 'current';
