import { SidebarTrigger } from "@/components/ui/sidebar";
import { AccessibilityToolbar } from "@/components/AccessibilityToolbar";
import { useAuth } from "@/contexts/AuthContext";
import { Bell, Search, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export function AppHeader() {
  const { user, logout } = useAuth();

  return (
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
        <Button variant="ghost" size="icon" className="touch-target relative" aria-label="Notifications - 4 unread">
          <Bell className="h-5 w-5" />
          <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-[10px]" variant="destructive">
            4
          </Badge>
        </Button>

        <AccessibilityToolbar />

        {user && (
          <div className="hidden md:flex items-center gap-2 ml-2 pl-2 border-l">
            <div className="text-right">
              <p className="text-sm font-medium leading-tight">{user.full_name}</p>
              <Badge variant="outline" className="text-[10px] capitalize">
                {user.role.replace(/_/g, " ")}
              </Badge>
            </div>
            <Button variant="ghost" size="icon" onClick={logout} className="touch-target" aria-label="Log out">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </header>
  );
}
