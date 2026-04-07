import { useEffect, useCallback, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type NotificationSeverity = "info" | "warning" | "urgent" | "critical";

export interface AppNotification {
  id: string;
  user_id: string;
  organisation_id: string | null;
  title: string;
  message: string | null;
  notification_type: string;
  severity: string;
  source_table: string | null;
  source_record_id: string | null;
  link: string | null;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
  created_by: string | null;
  metadata: Record<string, unknown> | null;
}

/**
 * Realtime security model:
 * 
 * ENFORCED BY RLS (server-side):
 * - SELECT policy: users can only read rows where user_id = auth.uid()
 * - UPDATE policy: users can only update rows where user_id = auth.uid()
 * - No DELETE policy exists — notifications cannot be deleted
 * - No anon access — all policies require 'authenticated' role
 * 
 * CLIENT-SIDE FILTERING (not a security boundary):
 * - Realtime filter `user_id=eq.${user.id}` reduces unnecessary client events
 *   but does NOT prevent a malicious client from subscribing without the filter.
 *   However, RLS on the underlying table means the change event payload is
 *   governed by the subscriber's auth token — Supabase only sends rows the
 *   subscriber is authorized to SELECT.
 * 
 * REMAINING RISK:
 * - Channel event metadata (table name, event type) is visible to any
 *   authenticated subscriber on the same channel name, even without row access.
 *   This is a Supabase platform limitation — no row data leaks, but the
 *   existence of an INSERT event is observable.
 * - Mitigation: use a unique channel name per subscriber instance, scoped by
 *   user id, to prevent cross-user channel sharing and cross-component channel
 *   reuse collisions.
 */

export function useNotifications(options?: { limit?: number }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const limit = options?.limit ?? 50;
  const subscriptionIdRef = useRef<string | null>(null);

  if (!subscriptionIdRef.current) {
    subscriptionIdRef.current =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2);
  }

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ["notifications", user?.id, limit],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data as unknown as AppNotification[];
    },
    refetchInterval: 30000,
  });

  // Realtime subscription — scoped channel per hook instance to avoid channel reuse collisions
  useEffect(() => {
    if (!user || !subscriptionIdRef.current) return;

    const channelName = `notifications-${user.id}-${subscriptionIdRef.current}`;
    const channel = supabase.channel(channelName);

    channel.on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "notifications",
        filter: `user_id=eq.${user.id}`,
      },
      () => {
        queryClient.invalidateQueries({ queryKey: ["notifications", user.id] });
      }
    );

    channel.subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user, queryClient]);

  const markRead = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications", user?.id] }),
  });

  const markAllRead = useMutation({
    mutationFn: async () => {
      if (!user) return;
      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("user_id", user.id)
        .eq("is_read", false);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications", user?.id] }),
  });

  const logClick = useCallback(async (notification: AppNotification) => {
    if (!user) return;
    await supabase.from("notification_audit_log").insert({
      notification_id: notification.id,
      user_id: user.id,
      event_type: "clicked",
      source_table: notification.source_table,
      source_record_id: notification.source_record_id,
    });
  }, [user]);

  const unreadCount = notifications.filter(n => !n.is_read).length;
  const criticalUnread = notifications.filter(n => !n.is_read && n.severity === "critical");

  return {
    notifications,
    isLoading,
    unreadCount,
    criticalUnread,
    markRead,
    markAllRead,
    logClick,
  };
}
