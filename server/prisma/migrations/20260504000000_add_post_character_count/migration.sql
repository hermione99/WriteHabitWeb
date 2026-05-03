-- Add cached character count for profile stats. Avoids scanning all post bodies
-- on every profile load to compute the "characters" stat.
ALTER TABLE "Post" ADD COLUMN "characterCount" INTEGER NOT NULL DEFAULT 0;

-- Backfill from existing bodies. PostgreSQL LENGTH() returns code-point count,
-- which closely matches JS string length for our content.
UPDATE "Post" SET "characterCount" = LENGTH("body");
