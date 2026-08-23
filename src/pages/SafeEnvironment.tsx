import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { logAudit } from "@/lib/auditLog";
import {
  EmptyState, ErrorState, HumanReviewNotice, LoadingState, PageHeading, StatusPill,
} from "@/components/compliance/GateUI";
import { RecordSheet, type FieldDef } from "@/components/compliance/RecordSheet";
import { toOptions, useStaff, withOrg } from "@/hooks/useComplianceLookups";

type Table = "check_templates" | "environment_checks" | "waste_register";

export default function SafeEnvironment() {
  const { user, hasRole, isMockAudit } = useAuth();
  const qc = useQueryClient();
  const canEdit = !isMockAudit && hasRole(["tenant_admin", "super_admin", "compliance_officer", "supervisor", "support_worker"]);
  const canManageTemplates = !isMockAudit && hasRole(["tenant_admin", "super_admin", "compliance_officer"]);
  const { data: staff = [] } = useStaff();
  const [sheet, setSheet] = useState<{ table: Table; initial?: Record<string, any> } | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["safe-environment"],
    queryFn: async () => {
      const [templates, checks, waste] = await Promise.all([
        supabase.from("check_templates" as any).select("*").order("name"),
        supabase.from("environment_checks" as any).select("*").order("performed_at", { ascending: false }).limit(200),
        supabase.from("waste_register" as any).select("*").eq("record_status", "active").order("created_at", { ascending: false }).limit(200),
      ]);
      if (templates.error) throw templates.error;
      if (checks.error) throw checks.error;
      if (waste.error) throw waste.error;
      return {
        templates: (templates.data as any[]) ?? [],
        checks: (checks.data as any[]) ?? [],
        waste: (waste.data as any[]) ?? [],
      };
    },
  });

  const save = useMutation({
    mutationFn: async ({ table, values }: { table: Table; values: Record<string, any> }) => {
      const payload = withOrg(values, user?.organisation_id, user?.id);
      if (values.id) {
        const { id, ...rest } = payload;
        const { error } = await supabase.from(table as any).update(rest).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from(table as any).insert(payload);
        if (error) throw error;
      }
      await logAudit({ action: values.id ? "updated" : "created", module: table, record_id: values.id ?? undefined });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["safe-environment"] });
      toast({ title: "Saved", description: "The record has been written to the audit trail." });
    },
    onError: (e: any) => toast({ variant: "destructive", title: "Blocked by the compliance engine", description: e.message }),
  });

  const templateName = (id: string) => data?.templates.find((t) => t.id === id)?.name ?? "—";
  const staffName = (id: string) => staff.find((s) => s.id === id)?.full_name ?? "—";

  const overdue = useMemo(() => {
    const today = new Date().toISOString().split("T")[0];
    return (data?.checks ?? []).filter((c) => c.next_due_date && c.next_due_date < today);
  }, [data]);
  const failed = (data?.checks ?? []).filter((c) => c.passed === false);

  const templateFields: FieldDef[] = [
    { name: "name", label: "Check name", type: "text", required: true },
    {
      name: "category", label: "Category", type: "select", required: true,
      options: ["safe_environment", "infection_control", "ppe", "cleaning", "waste", "emergency"].map((v) => ({ value: v, label: v.replace(/_/g, " ") })),
    },
    {
      name: "frequency", label: "Frequency", type: "select", required: true,
      options: ["daily", "weekly", "monthly", "quarterly", "annually"].map((v) => ({ value: v, label: v })),
    },
    { name: "instructions", label: "Instructions", type: "textarea", required: true },
    { name: "is_active", label: "Active", type: "checkbox" },
  ];

  const checkFields: FieldDef[] = [
    {
      name: "template_id", label: "Check template", type: "select", required: true,
      options: (data?.templates ?? []).filter((t) => t.is_active).map((t) => ({ value: t.id, label: `${t.name} (${t.frequency})` })),
    },
    { name: "location", label: "Location", type: "text", required: true },
    { name: "performed_at", label: "Performed at", type: "datetime", required: true },
    { name: "ppe_available", label: "PPE available and in date", type: "checkbox" },
    { name: "cleaning_completed", label: "Cleaning completed", type: "checkbox" },
    { name: "infection_control_ok", label: "Infection control measures in place", type: "checkbox" },
    { name: "hazards_identified", label: "Hazards identified", type: "textarea" },
    { name: "passed", label: "Check passed", type: "checkbox" },
    {
      name: "follow_up_action", label: "Follow-up action", type: "textarea",
      help: "Required when the check has not passed. Failed checks escalate to the supervisor and compliance officer.",
      showIf: (v) => !v.passed,
    },
    { name: "next_due_date", label: "Next due", type: "date", required: true },
  ];

  const wasteFields: FieldDef[] = [
    {
      name: "waste_type", label: "Waste type", type: "select", required: true,
      options: ["general", "clinical", "sharps", "infectious", "hazardous", "other"].map((v) => ({ value: v, label: v.replace(/_/g, " ") })),
    },
    { name: "description", label: "Description", type: "textarea", required: true },
    { name: "quantity", label: "Quantity", type: "text" },
    { name: "storage_location", label: "Storage location", type: "text", required: true },
    { name: "disposal_method", label: "Disposal method", type: "text", required: true },
    { name: "disposal_contractor", label: "Disposal contractor", type: "text" },
    { name: "disposal_date", label: "Disposal date", type: "date" },
    { name: "handled_by", label: "Handled by", type: "select", options: toOptions(staff) },
    { name: "ppe_used", label: "PPE used", type: "text", required: true },
    { name: "spill_or_accident", label: "A spill or accident occurred (record an incident as well)", type: "checkbox" },
    { name: "notes", label: "Notes", type: "textarea" },
  ];

  const checkBlockers = (v: Record<string, any>) =>
    v.passed === false && !String(v.follow_up_action ?? "").trim()
      ? ["A failed check requires a documented follow-up action before it can be saved."]
      : [];

  return (
    <div className="space-y-6">
      <PageHeading
        title="Safe environment and waste"
        description="Core Module safe environment checks and Core Module 4.5 waste management. Scheduled checks, PPE and infection control evidence, hazard follow-up and the hazardous waste register."
        actions={
          <>
            <Button onClick={() => setSheet({ table: "environment_checks" })} disabled={!canEdit}>Record a check</Button>
            <Button variant="outline" onClick={() => setSheet({ table: "waste_register" })} disabled={!canEdit}>Log waste</Button>
            <Button variant="outline" onClick={() => setSheet({ table: "check_templates" })} disabled={!canManageTemplates}>New template</Button>
          </>
        }
      />
      <HumanReviewNotice />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2"><CardDescription>Active templates</CardDescription></CardHeader>
          <CardContent className="text-2xl font-semibold">{(data?.templates ?? []).filter((t) => t.is_active).length}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardDescription>Failed checks awaiting action</CardDescription></CardHeader>
          <CardContent className="text-2xl font-semibold text-destructive">{failed.length}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardDescription>Overdue checks</CardDescription></CardHeader>
          <CardContent className="text-2xl font-semibold text-warning">{overdue.length}</CardContent>
        </Card>
      </div>

      {error ? <ErrorState error={error} /> : isLoading ? <LoadingState /> : (
        <Tabs defaultValue="checks">
          <TabsList>
            <TabsTrigger value="checks">Checks</TabsTrigger>
            <TabsTrigger value="waste">Waste register</TabsTrigger>
            <TabsTrigger value="templates">Templates</TabsTrigger>
          </TabsList>

          <TabsContent value="checks">
            {data!.checks.length === 0 ? (
              <EmptyState title="No checks recorded" description="Recorded checks form the safe environment evidence trail." />
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Check</TableHead><TableHead>Location</TableHead><TableHead>Performed</TableHead>
                      <TableHead>By</TableHead><TableHead>Result</TableHead><TableHead>Next due</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data!.checks.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell>{templateName(c.template_id)}</TableCell>
                        <TableCell>{c.location}</TableCell>
                        <TableCell>{c.performed_at ? new Date(c.performed_at).toLocaleString() : "—"}</TableCell>
                        <TableCell>{staffName(c.performed_by)}</TableCell>
                        <TableCell>
                          <StatusPill tone={c.passed ? "ok" : "bad"}>{c.passed ? "Passed" : "Failed"}</StatusPill>
                          {c.escalated && <StatusPill tone="bad">Escalated</StatusPill>}
                        </TableCell>
                        <TableCell>{c.next_due_date ?? "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>

          <TabsContent value="waste">
            {data!.waste.length === 0 ? (
              <EmptyState title="No waste records" description="Log hazardous and confidential waste handling and disposal here." />
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead><TableHead>Description</TableHead><TableHead>Storage</TableHead>
                      <TableHead>Disposal</TableHead><TableHead>Date</TableHead><TableHead>Spill</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data!.waste.map((w) => (
                      <TableRow key={w.id}>
                        <TableCell>{w.waste_type}</TableCell>
                        <TableCell>{w.description}</TableCell>
                        <TableCell>{w.storage_location}</TableCell>
                        <TableCell>{w.disposal_method}{w.disposal_contractor ? ` — ${w.disposal_contractor}` : ""}</TableCell>
                        <TableCell>{w.disposal_date ?? "Pending"}</TableCell>
                        <TableCell>{w.spill_or_accident ? <StatusPill tone="bad">Yes</StatusPill> : "No"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>

          <TabsContent value="templates">
            {data!.templates.length === 0 ? (
              <EmptyState title="No templates" description="Templates define the scheduled checks staff complete." />
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead><TableHead>Category</TableHead><TableHead>Frequency</TableHead>
                      <TableHead>Active</TableHead><TableHead className="w-24">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data!.templates.map((t) => (
                      <TableRow key={t.id}>
                        <TableCell>{t.name}</TableCell>
                        <TableCell>{t.category}</TableCell>
                        <TableCell>{t.frequency}</TableCell>
                        <TableCell>{t.is_active ? "Yes" : "No"}</TableCell>
                        <TableCell>
                          <Button variant="outline" size="sm" disabled={!canManageTemplates} onClick={() => setSheet({ table: "check_templates", initial: t })}>
                            Open
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}

      {sheet && (
        <RecordSheet
          open
          onOpenChange={(o) => !o && setSheet(null)}
          title={sheet.table === "check_templates" ? "Check template" : sheet.table === "environment_checks" ? "Environment check" : "Waste record"}
          description="Failed checks require a follow-up action and escalate automatically."
          fields={sheet.table === "check_templates" ? templateFields : sheet.table === "environment_checks" ? checkFields : wasteFields}
          initial={sheet.initial}
          blockers={sheet.table === "environment_checks" ? checkBlockers : undefined}
          readOnly={sheet.table === "check_templates" ? !canManageTemplates : !canEdit}
          readOnlyReason="Mock audit mode or your role prevents changes."
          onSubmit={async (values) => {
            const extra = sheet.table === "environment_checks" ? { performed_by: user?.id } : {};
            await save.mutateAsync({ table: sheet.table, values: { ...values, ...extra } });
            setSheet(null);
          }}
        />
      )}
    </div>
  );
}
