import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { Bell, Check, Search, Filter, AlertTriangle, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useNotifications, AppNotification } from "@/hooks/useNotifications";

const severityConfig: Record<string, { icon: string; label: string; className: string }> = {
  critical: { icon: "🔴", label: "Critical", className: "border-l-4 border-l-destructive bg-destructive/5" },
  urgent: { icon: "🟠", label: "Urgent", className: "border-l-4 border-l-orange-500 bg-orange-500/5" },
  warning: { icon: "🟡", label: "Warning", className: "border-l-4 border-l-yellow-500 bg-yellow-500/5" },
  info: { icon: "🔵", label: "Info", className: "" },
};

const MODULES = [
  { value: "all", label: "All Modules" },
  { value: "incidents", label: "Incidents" },
  { value: "complaints", label: "Complaints" },
  { value: "risks", label: "Risks" },
  { value: "safeguarding_concerns", label: "Safeguarding" },
  { value: "privacy_incidents", label: "Privacy" },
  { value: "staff_compliance", label: "Staff Compliance" },
  { value: "policies", label: "Policies" },
  { value: "training_modules", label: "Training" },
];

export default function Notifications() {
  const navigate = useNavigate();
  const { notifications, unreadCount, markRead, markAllRead, logClick } = useNotifications({ limit: 200 });

  const [search, setSearch] = useState("");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [moduleFilter, setModuleFilter] = useState("all");
  const [tab, setTab] = useState("all");

  const filtered = useMemo(() => {
    let list = notifications;

    if (tab === "unread") list = list.filter(n => !n.is_read);
    if (tab === "critical") list = list.filter(n => n.severity === "critical" || n.severity === "urgent");

    if (severityFilter !== "all") list = list.filter(n => n.severity === severityFilter);
    if (moduleFilter !== "all") list = list.filter(n => n.source_table === moduleFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(n =>
        n.title.toLowerCase().includes(q) ||
        (n.message?.toLowerCase().includes(q))
      );
    }

    return list;
  }, [notifications, tab, severityFilter, moduleFilter, search]);

  const handleClick = async (n: AppNotification) => {
    if (!n.is_read) markRead.mutate(n.id);
    await logClick(n);
    if (n.link) navigate(n.link);
  };

  const stats = useMemo(() => ({
    total: notifications.length,
    unread: unreadCount,
    critical: notifications.filter(n => !n.is_read && n.severity === "critical").length,
    urgent: notifications.filter(n => !n.is_read && n.severity === "urgent").length,
  }), [notifications, unreadCount]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Bell className="h-6 w-6" /> Notifications
          </h1>
          <p className="text-muted-foreground">Compliance alerts, workflow updates, and system notifications</p>
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" onClick={() => markAllRead.mutate()}>
            <Check className="h-4 w-4 mr-2" /> Mark all as read ({unreadCount})
          </Button>
        )}
      </div>

      {/* Stats */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Total</p>
            <p className="text-2xl font-bold">{stats.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Unread</p>
            <p className="text-2xl font-bold text-primary">{stats.unread}</p>
          </CardContent>
        </Card>
        <Card className={stats.critical > 0 ? "border-destructive" : ""}>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Critical</p>
            <p className="text-2xl font-bold text-destructive">{stats.critical}</p>
          </CardContent>
        </Card>
        <Card className={stats.urgent > 0 ? "border-orange-500" : ""}>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Urgent</p>
            <p className="text-2xl font-bold text-orange-500">{stats.urgent}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search notifications..."
            className="pl-9"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <Select value={severityFilter} onValueChange={setSeverityFilter}>
          <SelectTrigger className="w-[160px]">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Severity" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Severities</SelectItem>
            <SelectItem value="critical">🔴 Critical</SelectItem>
            <SelectItem value="urgent">🟠 Urgent</SelectItem>
            <SelectItem value="warning">🟡 Warning</SelectItem>
            <SelectItem value="info">🔵 Info</SelectItem>
          </SelectContent>
        </Select>
        <Select value={moduleFilter} onValueChange={setModuleFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Module" />
          </SelectTrigger>
          <SelectContent>
            {MODULES.map(m => (
              <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Tabs + List */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="all">All ({notifications.length})</TabsTrigger>
          <TabsTrigger value="unread">Unread ({unreadCount})</TabsTrigger>
          <TabsTrigger value="critical" className="flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" /> Critical / Urgent
          </TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-4">
          <Card>
            <ScrollArea className="max-h-[600px]">
              {filtered.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Bell className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p>No notifications match your filters</p>
                </div>
              ) : (
                <div className="divide-y">
                  {filtered.map(n => {
                    const config = severityConfig[n.severity] || severityConfig.info;
                    return (
                      <div
                        key={n.id}
                        className={`px-4 py-3 cursor-pointer hover:bg-muted/50 transition-colors ${!n.is_read ? "bg-primary/5" : ""} ${config.className}`}
                        onClick={() => handleClick(n)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={e => e.key === "Enter" && handleClick(n)}
                      >
                        <div className="flex items-start gap-3">
                          <span className="text-lg leading-none mt-0.5 shrink-0">{config.icon}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className={`text-sm leading-tight ${!n.is_read ? "font-semibold" : ""}`}>{n.title}</p>
                              <Badge variant="outline" className="text-[9px] h-4 shrink-0">{config.label}</Badge>
                            </div>
                            {n.message && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{n.message}</p>}
                            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                              <p className="text-xs text-muted-foreground">{format(new Date(n.created_at), "PPp")}</p>
                              {n.source_table && (
                                <Badge variant="secondary" className="text-[9px] h-4 capitalize">
                                  {n.source_table.replace(/_/g, " ")}
                                </Badge>
                              )}
                              {!n.is_read && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-5 text-[10px] px-1.5"
                                  onClick={e => { e.stopPropagation(); markRead.mutate(n.id); }}
                                >
                                  <Check className="h-3 w-3 mr-0.5" />Read
                                </Button>
                              )}
                            </div>
                          </div>
                          {n.link && <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
