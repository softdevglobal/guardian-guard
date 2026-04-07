import { SidebarTrigger } from "@/components/ui/sidebar";
import { AccessibilityToolbar } from "@/components/AccessibilityToolbar";
import { useAuth } from "@/contexts/AuthContext";
import { Search, LogOut, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { NotificationBell } from "@/components/NotificationBell";
import { toast } from "@/hooks/use-toast";
import { logAudit } from "@/lib/auditLog";

export function AppHeader() {
  const { user, logout, isMockAudit, setMockAudit, hasRole } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/auth");
  };

  const toggleMockAudit = async () => {
    const next = !isMockAudit;
    setMockAudit(next);
    if (user) {
      await logAudit({
        action: next ? "mock_audit_started" : "mock_audit_ended",
        module: "audit",
        details: { user_id: user.id, timestamp: new Date().toISOString() },
      });
    }
    toast({
      title: next ? "Mock Audit Mode Enabled" : "Mock Audit Mode Disabled",
      description: next ? "All editing is disabled. Browse freely." : "Normal editing restored.",
    });
  };

  return (
    <>
      {isMockAudit && (
        <div className="bg-purple-600 text-white px-4 py-2 text-center text-sm font-medium flex items-center justify-center gap-3">
          <Eye className="h-4 w-4" />
          MOCK AUDIT MODE — Read-Only View
          <Button variant="secondary" size="sm" onClick={toggleMockAudit} className="ml-2 h-7 text-xs">
            <EyeOff className="mr-1 h-3 w-3" />Exit Mock Audit
          </Button>
        </div>
      )}
      <header className="flex h-14 items-center gap-2 border-b bg-background px-4" role="banner">
        <SidebarTrigger className="touch-target" aria-label="Toggle sidebar" />

        <div className="flex-1 flex items-center gap-2 max-w-md">
          <div className="relative flex-1 hidden md:block">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <Input
              type="search"
              placeholder="Search... (Ctrl+K)"
              className="pl-9 h-9"
              aria-label="Global search"
            />
          </div>
        </div>

        <div className="flex items-center gap-1">
          {!isMockAudit && hasRole(["super_admin", "compliance_officer"]) && (
            <Button variant="ghost" size="sm" onClick={toggleMockAudit} className="text-xs hidden md:flex" aria-label="Enter mock audit mode">
              <Eye className="mr-1 h-4 w-4" />Mock Audit
            </Button>
          )}
          <NotificationBell />
          <AccessibilityToolbar />

          {user && (
            <div className="hidden md:flex items-center gap-2 ml-2 pl-2 border-l">
              <div className="text-right">
                <p className="text-sm font-medium leading-tight">{user.full_name}</p>
                <Badge variant="outline" className="text-[10px] capitalize">
                  {user.role.replace(/_/g, " ")}
                </Badge>
              </div>
              <Button variant="ghost" size="icon" onClick={handleLogout} className="touch-target" aria-label="Log out">
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </header>
    </>
  );
}
