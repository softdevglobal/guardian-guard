import {
  LayoutDashboard,
  AlertTriangle,
  ShieldAlert,
  MessageSquareWarning,
  FileText,
  Users,
  UserCog,
  GraduationCap,
  ClipboardList,
  Settings,
  Activity,
  HeartHandshake,
  Lock,
  Bell,
  Grid3X3,
  Award,
  Archive,
} from "lucide-react";
import logoImg from "@/assets/logo.png";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";

const navItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard, module: "dashboard" },
  { title: "Incidents", url: "/incidents", icon: AlertTriangle, module: "incidents", badge: 3 },
  { title: "Risks", url: "/risks", icon: ShieldAlert, module: "risks" },
  { title: "Complaints", url: "/complaints", icon: MessageSquareWarning, module: "complaints", badge: 1 },
  { title: "Policies", url: "/policies", icon: FileText, module: "policies" },
  { title: "Participants", url: "/participants", icon: Users, module: "participants" },
  { title: "Staff Compliance", url: "/staff", icon: UserCog, module: "staff" },
  { title: "Training", url: "/training", icon: GraduationCap, module: "training" },
  { title: "Audit Logs", url: "/audit", icon: ClipboardList, module: "audit" },
  { title: "Heartbeat", url: "/heartbeat", icon: Activity, module: "dashboard" },
  { title: "Safeguarding", url: "/safeguarding", icon: HeartHandshake, module: "safeguarding" },
  { title: "Privacy", url: "/privacy", icon: Lock, module: "privacy" },
  { title: "Notifications", url: "/notifications", icon: Bell, module: "dashboard" },
];

const governanceItems = [
  { title: "Controls Matrix", url: "/controls", icon: Grid3X3, module: "controls" },
  { title: "Competency Vault", url: "/competency-vault", icon: Award, module: "competency" },
  { title: "Evidence Room", url: "/evidence-room", icon: Archive, module: "evidence_room" },
];

const settingsItem = { title: "Settings", url: "/settings", icon: Settings, module: "settings" };

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { hasModule, user } = useAuth();

  const filteredItems = navItems.filter((item) => hasModule(item.module));
  const filteredGovernance = governanceItems.filter((item) => hasModule(item.module));

  return (
    <Sidebar collapsible="icon" aria-label="Main navigation">
      <SidebarHeader className="border-b border-sidebar-border p-4">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <img src={logoImg} alt="DGTG Logo" className="h-8 w-8 rounded-lg object-cover" />
            <div>
              <p className="text-xl font-serif font-bold">DGTG Guardian</p>
              <p className="text-xs text-muted-foreground">Compliance OS</p>
            </div>
          </div>
        )}
        {collapsed && (
          <img src={logoImg} alt="DGTG Logo" className="h-8 w-8 rounded-lg object-cover mx-auto" />
        )}
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Modules</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {filteredItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === "/"}
                      className="hover:bg-sidebar-accent touch-target flex items-center"
                      activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                    >
                      <item.icon className="mr-2 h-4 w-4 shrink-0" aria-hidden="true" />
                      {!collapsed && <span className="flex-1">{item.title}</span>}
                      {!collapsed && item.badge && (
                        <Badge variant="destructive" className="ml-auto text-xs" aria-label={`${item.badge} pending`}>
                          {item.badge}
                        </Badge>
                      )}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {filteredGovernance.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>Governance</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {filteredGovernance.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to={item.url}
                        className="hover:bg-sidebar-accent touch-target flex items-center"
                        activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                      >
                        <item.icon className="mr-2 h-4 w-4 shrink-0" aria-hidden="true" />
                        {!collapsed && <span className="flex-1">{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-4">
        {hasModule("settings") && (
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild>
                <NavLink
                  to={settingsItem.url}
                  className="hover:bg-sidebar-accent touch-target flex items-center"
                  activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                >
                  <settingsItem.icon className="mr-2 h-4 w-4 shrink-0" aria-hidden="true" />
                  {!collapsed && <span>{settingsItem.title}</span>}
                </NavLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        )}
        {!collapsed && user && (
          <div className="mt-2 rounded-md bg-sidebar-accent p-2">
            <p className="text-xs font-medium truncate">{user.full_name}</p>
            <p className="text-xs text-muted-foreground capitalize">{user.role.replace(/_/g, " ")}</p>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
