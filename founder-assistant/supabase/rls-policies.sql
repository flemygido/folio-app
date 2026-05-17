-- ─────────────────────────────────────────────────────────────────────────────
-- Row Level Security (RLS) Policies
-- Run this in Supabase SQL Editor after running prisma db push.
--
-- Principle: every table that holds user data is locked so that users can
-- only read/write their own rows. This means even if an API bug exposes a
-- query without a WHERE clause, the database layer prevents cross-user leaks.
-- ─────────────────────────────────────────────────────────────────────────────

-- Helper: the currently authenticated Supabase user id.
-- NextAuth + Prisma Adapter writes users with UUID ids that match auth.uid().
-- If you use service-role key for Prisma migrations/seeding you can bypass RLS;
-- use the anon key (or a restricted role) for the app itself.

-- ─── ENABLE RLS ON ALL USER-DATA TABLES ─────────────────────────────────────

ALTER TABLE "Email"              ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CalendarEvent"      ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DriveFile"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MemoryFact"         ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MemorySuppression"  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DailyBriefing"      ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Task"               ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Reminder"           ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FeedbackEvent"      ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AuditLog"           ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SmartAlert"         ENABLE ROW LEVEL SECURITY;
ALTER TABLE "EmailBehaviorStat"  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SyncCursor"         ENABLE ROW LEVEL SECURITY;
ALTER TABLE "OAuthConnection"    ENABLE ROW LEVEL SECURITY;
ALTER TABLE "UserPersonalityProfile" ENABLE ROW LEVEL SECURITY;

-- ─── EMAIL ───────────────────────────────────────────────────────────────────

CREATE POLICY "users_own_emails" ON "Email"
  FOR ALL USING (auth.uid()::text = "userId");

-- ─── CALENDAR ────────────────────────────────────────────────────────────────

CREATE POLICY "users_own_calendar" ON "CalendarEvent"
  FOR ALL USING (auth.uid()::text = "userId");

-- ─── DRIVE ───────────────────────────────────────────────────────────────────

CREATE POLICY "users_own_drive" ON "DriveFile"
  FOR ALL USING (auth.uid()::text = "userId");

-- ─── MEMORY ──────────────────────────────────────────────────────────────────

CREATE POLICY "users_own_memory" ON "MemoryFact"
  FOR ALL USING (auth.uid()::text = "userId");

CREATE POLICY "users_own_suppressions" ON "MemorySuppression"
  FOR ALL USING (auth.uid()::text = "userId");

-- ─── BRIEFINGS ───────────────────────────────────────────────────────────────

CREATE POLICY "users_own_briefings" ON "DailyBriefing"
  FOR ALL USING (auth.uid()::text = "userId");

-- ─── TASKS ───────────────────────────────────────────────────────────────────

CREATE POLICY "users_own_tasks" ON "Task"
  FOR ALL USING (auth.uid()::text = "userId");

-- ─── REMINDERS ───────────────────────────────────────────────────────────────

CREATE POLICY "users_own_reminders" ON "Reminder"
  FOR ALL USING (auth.uid()::text = "userId");

-- ─── FEEDBACK ────────────────────────────────────────────────────────────────

CREATE POLICY "users_own_feedback" ON "FeedbackEvent"
  FOR ALL USING (auth.uid()::text = "userId");

-- ─── AUDIT LOGS ──────────────────────────────────────────────────────────────

CREATE POLICY "users_own_audit" ON "AuditLog"
  FOR ALL USING (auth.uid()::text = "userId");

-- ─── ALERTS ──────────────────────────────────────────────────────────────────

CREATE POLICY "users_own_alerts" ON "SmartAlert"
  FOR ALL USING (auth.uid()::text = "userId");

-- ─── BEHAVIOR STATS ──────────────────────────────────────────────────────────

CREATE POLICY "users_own_behavior" ON "EmailBehaviorStat"
  FOR ALL USING (auth.uid()::text = "userId");

-- ─── SYNC CURSORS ────────────────────────────────────────────────────────────

CREATE POLICY "users_own_cursors" ON "SyncCursor"
  FOR ALL USING (auth.uid()::text = "userId");

-- ─── OAUTH CONNECTIONS ───────────────────────────────────────────────────────

CREATE POLICY "users_own_oauth" ON "OAuthConnection"
  FOR ALL USING (auth.uid()::text = "userId");

-- ─── PERSONALITY PROFILE ─────────────────────────────────────────────────────

CREATE POLICY "users_own_profile" ON "UserPersonalityProfile"
  FOR ALL USING (auth.uid()::text = "userId");

-- ─── NOTES ────────────────────────────────────────────────────────────────────
--
-- The "User" table itself is managed by NextAuth's PrismaAdapter (server-side
-- only, using the service-role key). Do NOT enable RLS on it unless you also
-- add a service-role bypass policy — otherwise Prisma signIn will fail.
--
-- To run this file:
--   1. Go to Supabase dashboard → SQL Editor
--   2. Paste the contents of this file
--   3. Click Run
--
-- If you get "policy already exists" errors, run the DROP statements first:
--   DROP POLICY IF EXISTS "users_own_emails" ON "Email"; etc.
