import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Settings as SettingsIcon, Shield, Bell, Users } from "lucide-react";
import { toast } from "@/hooks/use-toast";

export default function Settings() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

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
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

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
          <Card>
            <CardHeader><CardTitle>Notification Preferences</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between"><div><Label>Incident Alerts</Label><p className="text-sm text-muted-foreground">Notify on new incident reports</p></div><Switch defaultChecked /></div>
              <div className="flex items-center justify-between"><div><Label>Compliance Score Drops</Label><p className="text-sm text-muted-foreground">Alert when compliance score falls below threshold</p></div><Switch defaultChecked /></div>
              <div className="flex items-center justify-between"><div><Label>AI Heartbeat Alerts</Label><p className="text-sm text-muted-foreground">Notify on high-severity AI detections</p></div><Switch defaultChecked /></div>
              <div className="flex items-center justify-between"><div><Label>Staff Expiry Reminders</Label><p className="text-sm text-muted-foreground">60-day advance warning for expiring clearances</p></div><Switch defaultChecked /></div>
            </CardContent>
          </Card>
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
