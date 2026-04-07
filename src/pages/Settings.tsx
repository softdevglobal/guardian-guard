import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Settings as SettingsIcon, Shield, Bell, Users, AlertTriangle } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

export default function Settings() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Organisation query
  const { data: org } = useQuery({
    queryKey: ["organisation", user?.organisation_id],
    queryFn: async () => {
      if (!user?.organisation_id) return null;
      const { data, error } = await supabase.from("organisations").select("*").eq("id", user.organisation_id).single();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.organisation_id,
  });

  // Notification preferences
  const { data: prefs } = useQuery({
    queryKey: ["notification_preferences", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("notification_preferences")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const upsertPrefs = useMutation({
    mutationFn: async (updates: Record<string, unknown>) => {
      if (!user) throw new Error("Not authenticated");
      const existing = prefs;
      if (existing) {
        const { error } = await supabase
          .from("notification_preferences")
          .update(updates)
          .eq("user_id", user.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("notification_preferences")
          .insert({ user_id: user.id, ...updates });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notification_preferences", user?.id] });
      toast({ title: "Notification preferences saved" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const [orgForm, setOrgForm] = useState<{ name: string; abn: string; ndis_registration: string; primary_contact_email: string } | null>(null);

  const currentForm = orgForm ?? {
    name: org?.name ?? "",
    abn: org?.abn ?? "",
    ndis_registration: org?.ndis_registration ?? "",
    primary_contact_email: org?.primary_contact_email ?? "",
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!user?.organisation_id) throw new Error("No org");
      const { error } = await supabase.from("organisations").update({
        name: currentForm.name,
        abn: currentForm.abn,
        ndis_registration: currentForm.ndis_registration,
        primary_contact_email: currentForm.primary_contact_email,
      }).eq("id", user.organisation_id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organisation"] });
      toast({ title: "Settings saved" });
      setOrgForm(null);
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const currentPrefs = {
    email_enabled: prefs?.email_enabled ?? true,
    in_app_enabled: prefs?.in_app_enabled ?? true,
    critical_only: prefs?.critical_only ?? false,
    digest_frequency: prefs?.digest_frequency ?? "instant",
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Organisation and system configuration</p>
      </div>

      <Tabs defaultValue="organisation" className="space-y-4">
        <TabsList>
          <TabsTrigger value="organisation" className="touch-target"><SettingsIcon className="mr-2 h-4 w-4" />Organisation</TabsTrigger>
          <TabsTrigger value="security" className="touch-target"><Shield className="mr-2 h-4 w-4" />Security</TabsTrigger>
          <TabsTrigger value="notifications" className="touch-target"><Bell className="mr-2 h-4 w-4" />Notifications</TabsTrigger>
          <TabsTrigger value="roles" className="touch-target"><Users className="mr-2 h-4 w-4" />Roles & Access</TabsTrigger>
        </TabsList>

        <TabsContent value="organisation">
          <Card>
            <CardHeader><CardTitle>Organisation Details</CardTitle></CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={e => { e.preventDefault(); saveMutation.mutate(); }}>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2"><Label htmlFor="org-name">Organisation Name</Label><Input id="org-name" value={currentForm.name} onChange={e => setOrgForm({ ...currentForm, name: e.target.value })} /></div>
                  <div className="space-y-2"><Label htmlFor="org-abn">ABN</Label><Input id="org-abn" value={currentForm.abn} onChange={e => setOrgForm({ ...currentForm, abn: e.target.value })} /></div>
                  <div className="space-y-2"><Label htmlFor="org-ndis">NDIS Registration</Label><Input id="org-ndis" value={currentForm.ndis_registration} onChange={e => setOrgForm({ ...currentForm, ndis_registration: e.target.value })} /></div>
                  <div className="space-y-2"><Label htmlFor="org-email">Primary Contact Email</Label><Input id="org-email" type="email" value={currentForm.primary_contact_email} onChange={e => setOrgForm({ ...currentForm, primary_contact_email: e.target.value })} /></div>
                </div>
                <Button type="submit" className="touch-target" disabled={saveMutation.isPending}>{saveMutation.isPending ? "Saving..." : "Save Changes"}</Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security">
          <Card>
            <CardHeader><CardTitle>Security Settings</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between"><div><Label>Enforce MFA for Admin Roles</Label><p className="text-sm text-muted-foreground">Require multi-factor authentication for admin roles</p></div><Switch defaultChecked /></div>
              <div className="flex items-center justify-between"><div><Label>IP Allowlist</Label><p className="text-sm text-muted-foreground">Restrict access to approved IP addresses</p></div><Switch /></div>
              <div className="flex items-center justify-between"><div><Label>Suspicious Access Alerts</Label><p className="text-sm text-muted-foreground">Alert on unusual login patterns</p></div><Switch defaultChecked /></div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications">
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Notification Delivery</CardTitle>
                <CardDescription>Control how you receive compliance notifications</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>In-App Notifications</Label>
                    <p className="text-sm text-muted-foreground">Show notifications in the bell menu and notifications page</p>
                  </div>
                  <Switch
                    checked={currentPrefs.in_app_enabled}
                    onCheckedChange={(checked) => upsertPrefs.mutate({ in_app_enabled: checked })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Email Notifications</Label>
                    <p className="text-sm text-muted-foreground">Receive notification emails for compliance events</p>
                  </div>
                  <Switch
                    checked={currentPrefs.email_enabled}
                    onCheckedChange={(checked) => upsertPrefs.mutate({ email_enabled: checked })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Critical Only Mode</Label>
                    <p className="text-sm text-muted-foreground">Only receive critical and urgent notifications (info/warning suppressed)</p>
                  </div>
                  <Switch
                    checked={currentPrefs.critical_only}
                    onCheckedChange={(checked) => upsertPrefs.mutate({ critical_only: checked })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Non-Critical Digest Frequency</Label>
                    <p className="text-sm text-muted-foreground">How often to batch non-critical notifications</p>
                  </div>
                  <Select
                    value={currentPrefs.digest_frequency}
                    onValueChange={(val) => upsertPrefs.mutate({ digest_frequency: val })}
                  >
                    <SelectTrigger className="w-[140px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="instant">Instant</SelectItem>
                      <SelectItem value="hourly">Hourly</SelectItem>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            <Card className="border-destructive/30">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                  Mandatory Notifications
                </CardTitle>
                <CardDescription>These compliance notifications cannot be disabled per NDIS requirements</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  "Reportable incident alerts",
                  "Expired staff clearance warnings",
                  "Privacy breach notifications",
                  "Urgent safeguarding concerns",
                  "Policy review overdue alerts",
                ].map(item => (
                  <div key={item} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="destructive" className="text-[9px]">Required</Badge>
                      <span className="text-sm">{item}</span>
                    </div>
                    <Switch checked disabled />
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="roles">
          <Card>
            <CardHeader><CardTitle>Role Management</CardTitle></CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">Roles are configured through RBAC. Each user is assigned a role that determines their module access.</p>
              <div className="space-y-2">
                {["Super Admin", "Compliance Officer", "Supervisor", "Trainer", "Support Worker", "HR Admin", "Executive", "Participant"].map(role => (
                  <div key={role} className="flex items-center justify-between rounded-lg border p-3">
                    <span className="font-medium text-sm">{role}</span>
                    <Button variant="outline" size="sm" className="touch-target">Configure</Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
