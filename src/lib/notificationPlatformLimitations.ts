/**
 * PLATFORM LIMITATIONS — Guardian Guard Notification Engine
 *
 * This document records known platform-level constraints that cannot be
 * resolved in application code. These are not bugs — they are architectural
 * boundaries of the underlying infrastructure.
 *
 * Last reviewed: 2026-04-07
 *
 * ─────────────────────────────────────────────────────────────────────
 * 1. NOTIFICATION DATA ACCESS — ENFORCED BY RLS
 * ─────────────────────────────────────────────────────────────────────
 *
 * Row-Level Security on the `notifications` table ensures:
 * - Users can only SELECT rows where `user_id = auth.uid()`
 * - Users can only UPDATE rows where `user_id = auth.uid()`
 *   (limited to `is_read` / `read_at` via application logic)
 * - No DELETE policy exists — notifications are append-only
 * - No anonymous access — all policies require `authenticated` role
 * - Admins/compliance can view org-scoped notifications only
 *
 * This is server-enforced. A malicious client cannot bypass RLS
 * regardless of what queries or subscriptions they construct.
 *
 * ─────────────────────────────────────────────────────────────────────
 * 2. REALTIME EVENT EXISTENCE LEAKAGE
 * ─────────────────────────────────────────────────────────────────────
 *
 * Supabase Realtime broadcasts change events to all subscribers on a
 * channel. While RLS filters the *row payload* (subscribers only receive
 * row data they are authorized to SELECT), the *existence* of an event
 * (i.e., "an INSERT happened on this table") is observable by any
 * authenticated user who subscribes to the same channel.
 *
 * What is exposed:
 * - That an INSERT/UPDATE occurred on the `notifications` table
 * - The event type (INSERT, UPDATE)
 * - The table name
 *
 * What is NOT exposed:
 * - Row data (title, message, severity, user_id, etc.)
 * - Any column values
 * - Who the notification is for
 *
 * Mitigation applied:
 * - Each user subscribes on a unique channel: `notifications-${user.id}`
 * - This prevents User A from passively observing User B's event count
 *   because they are on different channels
 * - The `filter` parameter (`user_id=eq.${user.id}`) further reduces
 *   events delivered to the client
 *
 * Residual risk:
 * - A malicious authenticated user who knows another user's ID could
 *   construct a subscription to `notifications-${targetUserId}` and
 *   observe that events occurred (but receive no row data due to RLS)
 * - This is a Supabase platform limitation with no server-side fix
 * - Impact: low (event existence only, no data, no PII)
 *
 * ─────────────────────────────────────────────────────────────────────
 * 3. DEDUPLICATION — ATOMIC BUT DATE-BUCKETED
 * ─────────────────────────────────────────────────────────────────────
 *
 * Deduplication uses a deterministic fingerprint:
 *   {notification_type}:{source_table}:{source_record_id}:{user_id}:{date_bucket}
 *
 * Enforced atomically via `insert_notification_deduped()` database
 * function using INSERT ... ON CONFLICT DO NOTHING on a unique partial
 * index.
 *
 * Known edge case:
 * - If the cron job runs at 23:59 and again at 00:01, a persistent
 *   compliance issue (e.g., stale incident) will generate a new
 *   notification on the new day. This is intentional — persistent
 *   issues should re-notify daily until resolved.
 *
 * ─────────────────────────────────────────────────────────────────────
 * 4. EMAIL DELIVERY — NOT IMPLEMENTED
 * ─────────────────────────────────────────────────────────────────────
 *
 * `notification_preferences.email_enabled` is stored but no email
 * transport exists. All notifications are in-app only.
 *
 * ─────────────────────────────────────────────────────────────────────
 * 5. DIGEST BATCHING — NOT IMPLEMENTED
 * ─────────────────────────────────────────────────────────────────────
 *
 * `notification_preferences.digest_frequency` accepts values like
 * 'instant', 'daily', 'weekly' but all notifications are delivered
 * instantly. Digest aggregation is not yet implemented.
 */

export {};
