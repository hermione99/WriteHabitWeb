-- Per-user daily-keyword notification time (KST hour, 0-23). NULL = disabled.
-- Default 9 keeps existing users on the same 09:00 cadence the cron used to run.
ALTER TABLE "User" ADD COLUMN "notificationHour" INTEGER DEFAULT 9;
