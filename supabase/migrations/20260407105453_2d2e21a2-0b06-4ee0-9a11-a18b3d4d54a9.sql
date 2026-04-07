-- Add fingerprint column for deduplication
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS fingerprint text,
  ADD COLUMN IF NOT EXISTS dedupe_bucket text;

-- Create unique index on fingerprint (nulls are excluded — only deduped notifications get a fingerprint)
CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_fingerprint
  ON public.notifications (fingerprint)
  WHERE fingerprint IS NOT NULL;

-- Index for faster lookups by user + read status
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON public.notifications (user_id, is_read)
  WHERE is_read = false;