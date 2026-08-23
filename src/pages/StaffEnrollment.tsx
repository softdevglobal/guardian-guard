import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, type AppRole } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";
import { UserPlus, ShieldAlert, KeyRound, Copy } from "lucide-react";
import { tenantRoleOptions } from "@/lib/permissions";
import { AccessRestricted } from "@/components/compliance/GateUI";

/** Provider role selector — platform roles are never offered to a tenant. */
const ROLE_OPTIONS: AppRole[] = tenantRoleOptions();

const ADMIN_ROLES: AppRole[] = ["tenant_admin", "super_admin", "compliance_officer", "hr_admin"];

const label = (r: string) => r.replace(/_/g, " ");

export default function StaffEnrollment() {
  const { user, hasRole } = useAuth();
  const queryClient = useQueryClient();
  const canEnroll = hasRole(ADMIN_ROLES);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<AppRole>("support_worker");
  const [teamId, setTeamId] = useState<string>("none");
  const [seedCompliance, setSeedCompliance] = useState(true);
  const [tempPassword, setTempPassword] = useState<string | null>(null);

  const { data: teams = [] } = useQuery({
    queryKey: ["enrollment-teams"],
    queryFn: async () => {
      const { data, error } = await supabase.from("teams").select("id, name").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: staff = [], isLoading } = useQuery({
    queryKey: ["enrollment-staff"],
    queryFn: async () => {
      const { data: profiles, error } = await supabase
        .from("user_profiles")
        .select("id, full_name, email, team_id, organisation_id")
        .order("full_name");
      if (error) throw error;
      const { data: roles } = await supabase.from("user_roles").select("user_id, role");
      return (profiles ?? []).map((p) => ({
        ...p,
        role: roles?.find((r) => r.user_id === p.id)?.role ?? null,
      }));
    },
  });

  const pending = staff.filter((s) => !s.role || !s.organisation_id);

  const enroll = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const { data, error } = await supabase.functions.invoke("enroll-staff", { body: payload });
      if (error) throw error;
      if (data?.error) throw new Error(typeof data.error === "string" ? data.error : JSON.stringify(data.error));
      return data as { staff_id: string; created: boolean; seeded_requirements: number; temp_password: string | null };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["enrollment-staff"] });
      queryClient.invalidateQueries({ queryKey: ["staff-compliance-list"] });
      setTempPassword(data.temp_password);
      toast.success(
        data.created
          ? `Staff member created. ${data.seeded_requirements} compliance requirements added.`
          : `Role assigned. ${data.seeded_requirements} compliance requirements added.`
      );
      setFullName("");
      setEmail("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!canEnroll) {
    return (
      <AccessRestricted
        action="staff.enrol"
        roles={user?.roles ?? []}
        description="Staff enrolment is limited to provider administrators."
      />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Staff Enrollment</h1>
        <p className="text-muted-foreground">
          Create staff accounts, assign roles and teams, and seed their compliance checklist. New staff start as
          non-compliant until evidence is verified.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" aria-hidden /> Enroll a staff member
            </CardTitle>
            <CardDescription>
              Creates the account in your organisation ({user?.organisation_id ? "linked" : "no organisation set"}).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                setTempPassword(null);
                enroll.mutate({
                  mode: "create",
                  full_name: fullName.trim(),
                  email: email.trim().toLowerCase(),
                  role,
                  team_id: teamId === "none" ? null : teamId,
                  seed_compliance: seedCompliance,
                });
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="full_name">Full name</Label>
                <Input id="full_name" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Work email</Label>
                <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="role">Role</Label>
                  <Select value={role} onValueChange={(v) => setRole(v as AppRole)}>
                    <SelectTrigger id="role"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ROLE_OPTIONS.map((r) => (
                        <SelectItem key={r} value={r} className="capitalize">{label(r)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="team">Team</Label>
                  <Select value={teamId} onValueChange={setTeamId}>
                    <SelectTrigger id="team"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No team</SelectItem>
                      {teams.map((t) => (
                        <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="seed"
                  checked={seedCompliance}
                  onCheckedChange={(v) => setSeedCompliance(v === true)}
                />
                <Label htmlFor="seed" className="font-normal">
                  Seed mandatory compliance requirements for this role
                </Label>
              </div>
              <Button type="submit" disabled={enroll.isPending}>
                {enroll.isPending ? "Enrolling..." : "Enroll staff member"}
              </Button>
            </form>

            {tempPassword && (
              <Alert className="mt-4">
                <KeyRound className="h-4 w-4" aria-hidden />
                <AlertTitle>Temporary password</AlertTitle>
                <AlertDescription className="flex items-center gap-2">
                  <code className="font-mono text-sm">{tempPassword}</code>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      navigator.clipboard.writeText(tempPassword);
                      toast.success("Copied");
                    }}
                  >
                    <Copy className="h-3 w-3 mr-1" aria-hidden /> Copy
                  </Button>
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Awaiting role assignment ({pending.length})</CardTitle>
            <CardDescription>Self-registered users with no role or organisation.</CardDescription>
          </CardHeader>
          <CardContent>
            {pending.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">Everyone has a role and organisation.</p>
            ) : (
              <div className="space-y-3">
                {pending.map((p) => (
                  <PendingRow
                    key={p.id}
                    id={p.id}
                    name={p.full_name}
                    email={p.email}
                    teams={teams}
                    onAssign={(assignRole, assignTeam) =>
                      enroll.mutate({
                        mode: "assign",
                        user_id: p.id,
                        role: assignRole,
                        team_id: assignTeam === "none" ? null : assignTeam,
                        seed_compliance: true,
                      })
                    }
                    pendingState={enroll.isPending}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>All staff ({staff.length})</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-center py-4 text-muted-foreground">Loading...</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Team</TableHead>
                    <TableHead>Organisation</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {staff.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell>
                        <p className="font-medium">{s.full_name}</p>
                        <p className="text-xs text-muted-foreground">{s.email}</p>
                      </TableCell>
                      <TableCell>
                        {s.role ? (
                          <Badge variant="secondary" className="capitalize">{label(s.role)}</Badge>
                        ) : (
                          <Badge variant="destructive">No role</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        {teams.find((t) => t.id === s.team_id)?.name ?? "—"}
                      </TableCell>
                      <TableCell className="text-sm">{s.organisation_id ? "Linked" : "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function PendingRow({
  id,
  name,
  email,
  teams,
  onAssign,
  pendingState,
}: {
  id: string;
  name: string;
  email: string;
  teams: { id: string; name: string }[];
  onAssign: (role: AppRole, teamId: string) => void;
  pendingState: boolean;
}) {
  const [role, setRole] = useState<AppRole>("support_worker");
  const [team, setTeam] = useState("none");

  return (
    <div className="rounded-md border p-3 space-y-2">
      <div>
        <p className="font-medium">{name}</p>
        <p className="text-xs text-muted-foreground">{email}</p>
      </div>
      <div className="flex flex-col sm:flex-row gap-2">
        <Select value={role} onValueChange={(v) => setRole(v as AppRole)}>
          <SelectTrigger aria-label={`Role for ${name}`} className="sm:w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            {ROLE_OPTIONS.map((r) => (
              <SelectItem key={r} value={r} className="capitalize">{label(r)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={team} onValueChange={setTeam}>
          <SelectTrigger aria-label={`Team for ${name}`} className="sm:w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No team</SelectItem>
            {teams.map((t) => (
              <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button type="button" disabled={pendingState} onClick={() => onAssign(role, team)} data-user-id={id}>
          Assign
        </Button>
      </div>
    </div>
  );
}
