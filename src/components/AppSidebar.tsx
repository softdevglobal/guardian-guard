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
  HeartPulse,
  Lock,
  Bell,
  Grid3X3,
  Award,
  Archive,
  ClipboardCheck,
  HeartHandshake,
  Pill,
  SprayCan,
  Home,
  Hand,
  Landmark,
  CheckSquare,
  CalendarDays,
  UserPlus,
  Building2,
  Wallet,
  Rocket,
  SlidersHorizontal,
  BadgeCheck,
  Globe,
} from "lucide-react";

import logoAsset from "@/assets/dgtg-logo.png.asset.json";
const logoImg = logoAsset.url;
import { NavLink } from "@/components/NavLink";
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
import { useOrgSnapshot } from "@/lib/orgSnapshot";

const platformItems = [
  { title: "Platform Dashboard", url: "/platform/dashboard", icon: Building2 },
  { title: "Clients", url: "/platform/clients", icon: Users },
  { title: "Packages", url: "/platform/packages", icon: Wallet },
  { title: "Service Configuration", url: "/platform/service-config", icon: SlidersHorizontal },
  { title: "Onboarding Reviews", url: "/platform/onboarding-reviews", icon: ClipboardCheck },
  { title: "Platform Activity", url: "/platform/activity", icon: Activity },
  { title: "Income", url: "/platform/income", icon: Wallet },
];

type NavItem = {
  title: string;
  url: string;
  icon: React.ElementType;
  module: string;
  badgeKey?: "incidents_open" | "risks_open" | "complaints_open";
};

/**
 * Provider navigation is compliance-only. Daily operations (rosters, shifts,
 * attendance, tasks, timesheets, invoicing) belong to BMS Pro Trade and are
 * deliberately absent here. `badgeKey` reads the shared organisation snapshot.
 */
const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: "Overview",
    items: [
      { title: "Dashboard", url: "/", icon: LayoutDashboard, module: "dashboard" },
      { title: "Get set up", url: "/onboarding", icon: Rocket, module: "onboarding" },
      { title: "NDIS Registration", url: "/registration", icon: BadgeCheck, module: "registration" },
    ],
  },
  {
    label: "People compliance",
    items: [
      { title: "Participants", url: "/participants", icon: Users, module: "participants" },
      { title: "Participant support compliance", url: "/participant-care", icon: HeartPulse, module: "participant_care" },
      { title: "Medication plans", url: "/medication", icon: Pill, module: "medication" },
      { title: "Workers", url: "/staff", icon: UserCog, module: "staff" },
      { title: "Workers and access", url: "/staff-enrollment", icon: UserPlus, module: "staff_enrollment" },
      { title: "Training", url: "/training", icon: GraduationCap, module: "training" },
    ],
  },
  {
    label: "Compliance",
    items: [
      { title: "Incidents", url: "/incidents", icon: AlertTriangle, module: "incidents", badgeKey: "incidents_open" },
      { title: "Complaints", url: "/complaints", icon: MessageSquareWarning, module: "complaints", badgeKey: "complaints_open" },
      { title: "Risks", url: "/risks", icon: ShieldAlert, module: "risks", badgeKey: "risks_open" },
      { title: "Safeguarding", url: "/safeguarding", icon: HeartHandshake, module: "safeguarding" },
      { title: "Privacy", url: "/privacy", icon: Lock, module: "privacy" },
      { title: "Safe environment and waste", url: "/safe-environment", icon: SprayCan, module: "safe_environment" },
      { title: "Restrictive practices", url: "/restrictive-practices", icon: Hand, module: "restrictive_practices" },
      { title: "SIL", url: "/sil", icon: Home, module: "sil" },
    ],
  },
  {
    label: "Documents and governance",
    items: [
      { title: "Policies", url: "/policies", icon: FileText, module: "policies" },
      { title: "Governance", url: "/governance", icon: Landmark, module: "governance" },
      { title: "Evidence Matrix", url: "/evidence-matrix", icon: ClipboardCheck, module: "controls" },
      { title: "Controls Matrix", url: "/controls", icon: Grid3X3, module: "controls" },
      { title: "Competency Vault", url: "/competency-vault", icon: Award, module: "competency" },
      { title: "Evidence Room", url: "/evidence-room", icon: Archive, module: "evidence_room" },
    ],
  },
  {
    label: "Audit management",
    items: [
      { title: "Corrective Actions", url: "/corrective-actions", icon: CheckSquare, module: "corrective_actions" },
      { title: "Compliance Calendar", url: "/calendar", icon: CalendarDays, module: "calendar" },
      { title: "Trust Portal", url: "/trust-portal", icon: Globe, module: "trust_portal" },
      { title: "Audit Logs", url: "/audit", icon: ClipboardList, module: "audit" },
      { title: "Compliance Pulse", url: "/heartbeat", icon: Activity, module: "dashboard" },
    ],
  },
  {
    label: "Account",
    items: [
      { title: "Notifications", url: "/notifications", icon: Bell, module: "dashboard" },
    ],
  },
];

const settingsItem = { title: "Settings", url: "/settings", icon: Settings, module: "settings" };

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { hasModule, hasRole, user } = useAuth();
  const { data: snapshot } = useOrgSnapshot();

  const isPlatformOwner = hasRole("platform_super_admin");
  const groups = NAV_GROUPS.map((g) => ({ ...g, items: g.items.filter((i) => hasModule(i.module)) })).filter(
    (g) => g.items.length > 0
  );

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
        {isPlatformOwner && (
          <SidebarGroup>
            <SidebarGroupLabel>Platform console</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {platformItems.map((item) => (
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

        {groups.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to={item.url}
                        end={item.url === "/"}
                        className="hover:bg-sidebar-accent touch-target flex items-center"
                        activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                      >
                        <item.icon className="mr-2 h-4 w-4 shrink-0" aria-hidden="true" />
                        {!collapsed && <span className="flex-1">{item.title}</span>}
                        {!collapsed && item.badgeKey && (snapshot?.counts?.[item.badgeKey] ?? 0) > 0 && (
                          <Badge
                            variant="destructive"
                            className="ml-auto text-xs"
                            aria-label={`${snapshot?.counts?.[item.badgeKey]} open`}
                          >
                            {snapshot?.counts?.[item.badgeKey]}
                          </Badge>
                        )}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
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
