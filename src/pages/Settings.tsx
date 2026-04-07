import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Settings as SettingsIcon, Shield, Bell, Users } from "lucide-react";

export default function Settings() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Organisation and system configuration</p>
      </div>

      <Tabs defaultValue="organisation" className="space-y-4">
        <TabsList>
          <TabsTrigger value="organisation" className="touch-target">
            <SettingsIcon className="mr-2 h-4 w-4" aria-hidden="true" />
            Organisation
          </TabsTrigger>
          <TabsTrigger value="security" className="touch-target">
            <Shield className="mr-2 h-4 w-4" aria-hidden="true" />
            Security
          </TabsTrigger>
          <TabsTrigger value="notifications" className="touch-target">
            <Bell className="mr-2 h-4 w-4" aria-hidden="true" />
            Notifications
          </TabsTrigger>
          <TabsTrigger value="roles" className="touch-target">
            <Users className="mr-2 h-4 w-4" aria-hidden="true" />
            Roles & Access
          </TabsTrigger>
        </TabsList>

        <TabsContent value="organisation">
          <Card>
            <CardHeader><CardTitle>Organisation Details</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="org-name">Organisation Name</Label>
                  <Input id="org-name" defaultValue="DGTG PTY LTD" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="org-abn">ABN</Label>
                  <Input id="org-abn" defaultValue="12 345 678 901" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="org-ndis">NDIS Registration Number</Label>
                  <Input id="org-ndis" defaultValue="4-XXXXXXXXX" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="org-contact">Primary Contact Email</Label>
                  <Input id="org-contact" type="email" defaultValue="compliance@dgtg.com.au" />
                </div>
              </div>
              <Button className="touch-target">Save Changes</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security">
          <Card>
            <CardHeader><CardTitle>Security Settings</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Enforce MFA for Admin Roles</Label>
                  <p className="text-sm text-muted-foreground">Require multi-factor authentication for all admin, supervisor, compliance, and HR roles</p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>IP Allowlist</Label>
                  <p className="text-sm text-muted-foreground">Restrict access to approved IP addresses for sensitive roles</p>
                </div>
                <Switch />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Suspicious Access Alerts</Label>
                  <p className="text-sm text-muted-foreground">Alert on unusual login patterns, new devices, or bulk data access</p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="space-y-2">
                <Label htmlFor="session-timeout">Session Timeout (minutes)</Label>
                <Input id="session-timeout" type="number" defaultValue={30} className="w-32" />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications">
          <Card>
            <CardHeader><CardTitle>Notification Preferences</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Incident Alerts</Label>
                  <p className="text-sm text-muted-foreground">Notify on new incident reports</p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Compliance Score Drops</Label>
                  <p className="text-sm text-muted-foreground">Alert when compliance score falls below threshold</p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>AI Heartbeat Alerts</Label>
                  <p className="text-sm text-muted-foreground">Notify on high-severity AI detections</p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Staff Expiry Reminders</Label>
                  <p className="text-sm text-muted-foreground">60-day advance warning for expiring clearances</p>
                </div>
                <Switch defaultChecked />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="roles">
          <Card>
            <CardHeader><CardTitle>Role Management</CardTitle></CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Roles are configured through RBAC. Each user is assigned a role that determines their module access and data scope.
              </p>
              <div className="space-y-2">
                {["Super Admin", "Compliance Officer", "Supervisor", "Trainer", "Support Worker", "HR Admin", "Executive", "Participant"].map((role) => (
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
