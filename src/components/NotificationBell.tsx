import { useState } from "react";
import { Bell, Check, ExternalLink, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { useNotifications, AppNotification } from "@/hooks/useNotifications";

const severityConfig: Record<string, { icon: string; className: string }> = {
  critical: { icon: "🔴", className: "border-l-4 border-l-destructive bg-destructive/5" },
  urgent: { icon: "🟠", className: "border-l-4 border-l-orange-500 bg-orange-500/5" },
  warning: { icon: "🟡", className: "border-l-4 border-l-yellow-500 bg-yellow-500/5" },
  info: { icon: "🔵", className: "" },
};

export function NotificationBell() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const { notifications, unreadCount, criticalUnread, markRead, markAllRead, logClick } = useNotifications({ limit: 20 });

  const handleClick = async (n: AppNotification) => {
    if (!n.is_read) markRead.mutate(n.id);
    await logClick(n);
    if (n.link) { navigate(n.link); setOpen(false); }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="touch-target relative" aria-label={`Notifications - ${unreadCount} unread`}>
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-[10px]" variant="destructive">
              {unreadCount > 99 ? "99+" : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="end">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold">Notifications</h3>
            {criticalUnread.length > 0 && (
              <Badge variant="destructive" className="text-[10px]">
                <AlertTriangle className="h-3 w-3 mr-1" />
                {criticalUnread.length} critical
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => markAllRead.mutate()}>
                <Check className="h-3 w-3 mr-1" />All read
              </Button>
            )}
            <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => { navigate("/notifications"); setOpen(false); }}>
              View all
            </Button>
          </div>
        </div>
        <Separator />

        {criticalUnread.length > 0 && (
          <>
            <div className="px-3 py-1.5 bg-destructive/10">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-destructive">Pinned — Critical</p>
            </div>
            {criticalUnread.map(n => (
              <NotificationItem key={n.id} notification={n} onClick={() => handleClick(n)} />
            ))}
            <Separator />
          </>
        )}

        <ScrollArea className="max-h-72">
          {notifications.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No notifications</p>
          ) : (
            <div className="divide-y">
              {notifications.filter(n => !(n.severity === "critical" && !n.is_read)).map(n => (
                <NotificationItem key={n.id} notification={n} onClick={() => handleClick(n)} />
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

function NotificationItem({ notification: n, onClick }: { notification: AppNotification; onClick: () => void }) {
  const config = severityConfig[n.severity] || severityConfig.info;
  return (
    <div
      className={`px-4 py-3 text-sm cursor-pointer hover:bg-muted/50 transition-colors ${!n.is_read ? "bg-primary/5 font-medium" : ""} ${config.className}`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onClick()}
    >
      <div className="flex items-start gap-2">
        <span className="text-base leading-none mt-0.5 shrink-0">{config.icon}</span>
        <div className="flex-1 min-w-0">
          <p className="leading-tight">{n.title}</p>
          {n.message && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2 font-normal">{n.message}</p>}
          <div className="flex items-center gap-2 mt-1">
            <p className="text-xs text-muted-foreground">{format(new Date(n.created_at), "PPp")}</p>
            {n.source_table && (
              <Badge variant="outline" className="text-[9px] h-4 capitalize">{n.source_table.replace(/_/g, " ")}</Badge>
            )}
          </div>
        </div>
        {n.link && <ExternalLink className="h-3 w-3 text-muted-foreground shrink-0 mt-0.5" />}
      </div>
    </div>
  );
}
