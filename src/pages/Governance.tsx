import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { logAudit } from "@/lib/auditLog";
import {
  EmptyState, ErrorState, HumanReviewNotice, LoadingState, PageHeading, StatusPill,
} from "@/components/compliance/GateUI";
import { RecordSheet, type FieldDef } from "@/components/compliance/RecordSheet";
import { toOptions, useStaff, withOrg } from "@/hooks/useComplianceLookups";

type Tbl =
  | "governance_meetings"
  | "governance_actions"
  | "conflict_of_interest_declarations"
  | "internal_audits"
  | "registration_groups";

export default function Governance() {
  const { user, hasRole, isMockAudit } = useAuth();
  const qc = useQueryClient();
  const canEdit = !isMockAudit && hasRole(["super_admin", "compliance_officer", "executive"]);
  const { data: staff = [] } = useStaff();
  const [sheet, setSheet] = useState<{ table: Tbl; initial?: Record<string, any> } | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["governance"],
    queryFn: async () => {
      const [meetings, actions, coi, audits, groups] = await Promise.all([
        supabase.from("governance_meetings" as any).select("*").eq("record_status", "active").order("meeting_date", { ascending: false }),
        supabase.from("governance_actions" as any).select("*").order("due_date"),
        supabase.from("conflict_of_interest_declarations" as any).select("*").order("declared_at", { ascending: false }),
        supabase.from("internal_audits" as any).select("*").eq("record_status", "active").order("planned_date", { ascending: false }),
        supabase.from("registration_groups" as any).select("*").eq("record_status", "active").order("code"),
      ]);
      for (const r of [meetings, actions, coi, audits, groups]) if (r.error) throw r.error;
      return {
        meetings: (meetings.data as any[]) ?? [],
        actions: (actions.data as any[]) ?? [],
        coi: (coi.data as any[]) ?? [],
        audits: (audits.data as any[]) ?? [],
        groups: (groups.data as any[]) ?? [],
      };
    },
  });

  const save = useMutation({
    mutationFn: async ({ table, values }: { table: Tbl; values: Record<string, any> }) => {
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
      qc.invalidateQueries({ queryKey: ["governance"] });
      toast({ title: "Saved", description: "The governance record has been written to the audit trail." });
    },
    onError: (e: any) => toast({ variant: "destructive", title: "Blocked by the compliance engine", description: e.message }),
  });

  const staffName = (id: string) => staff.find((s) => s.id === id)?.full_name ?? "—";
  const today = new Date().toISOString().split("T")[0];
  const overdueActions = (data?.actions ?? []).filter((a) => a.status !== "completed" && a.due_date && a.due_date < today);

  const meetingFields: FieldDef[] = [
    {
      name: "meeting_type", label: "Meeting type", type: "select", required: true,
      options: ["board", "management_review", "clinical_governance", "quality_safeguarding", "wh_s"].map((v) => ({ value: v, label: v.replace(/_/g, " ") })),
    },
    { name: "meeting_date", label: "Meeting date", type: "date", required: true },
    { name: "agenda", label: "Agenda", type: "textarea", required: true },
    { name: "minutes", label: "Minutes", type: "textarea", required: true },
    { name: "decisions", label: "Decisions", type: "textarea", required: true },
    { name: "next_meeting_date", label: "Next meeting", type: "date" },
  ];

  const actionFields: FieldDef[] = [
    { name: "meeting_id", label: "Meeting", type: "select", required: true, options: (data?.meetings ?? []).map((m) => ({ value: m.id, label: `${m.meeting_type} — ${m.meeting_date}` })) },
    { name: "action", label: "Action", type: "textarea", required: true },
    { name: "owner_id", label: "Owner", type: "select", required: true, options: toOptions(staff) },
    { name: "due_date", label: "Due date", type: "date", required: true },
    { name: "status", label: "Status", type: "select", required: true, options: ["open", "in_progress", "completed"].map((v) => ({ value: v, label: v.replace(/_/g, " ") })) },
    { name: "notes", label: "Notes", type: "textarea" },
  ];

  const coiFields: FieldDef[] = [
    { name: "user_id", label: "Person declaring", type: "select", required: true, options: toOptions(staff) },
    {
      name: "declaration_type", label: "Declaration type", type: "select", required: true,
      options: ["annual", "on_engagement", "event_based"].map((v) => ({ value: v, label: v.replace(/_/g, " ") })),
    },
    { name: "has_conflict", label: "A conflict exists", type: "checkbox" },
    { name: "description", label: "Description", type: "textarea", showIf: (v) => !!v.has_conflict },
    { name: "secondary_employment", label: "Secondary employment", type: "textarea" },
    { name: "mitigation", label: "Mitigation", type: "textarea", showIf: (v) => !!v.has_conflict },
    { name: "declared_at", label: "Declared at", type: "datetime", required: true },
    { name: "status", label: "Status", type: "select", required: true, options: ["submitted", "reviewed", "actioned"].map((v) => ({ value: v, label: v })) },
  ];

  const auditFields: FieldDef[] = [
    { name: "title", label: "Audit title", type: "text", required: true },
    { name: "scope", label: "Scope", type: "textarea", required: true },
    { name: "module", label: "Module", type: "text", required: true, help: "For example: core, medication, waste, SIL." },
    { name: "linked_outcome_code", label: "Linked practice outcome code", type: "text" },
    { name: "planned_date", label: "Planned date", type: "date", required: true },
    { name: "completed_date", label: "Completed date", type: "date" },
    { name: "lead_auditor", label: "Lead auditor", type: "select", options: toOptions(staff) },
    { name: "findings", label: "Findings", type: "textarea" },
    { name: "rating", label: "Rating", type: "select", options: ["conformant", "minor_finding", "major_finding"].map((v) => ({ value: v, label: v.replace(/_/g, " ") })) },
    { name: "status", label: "Status", type: "select", required: true, options: ["planned", "in_progress", "completed"].map((v) => ({ value: v, label: v.replace(/_/g, " ") })) },
  ];

  const groupFields: FieldDef[] = [
    { name: "code", label: "Registration group code", type: "text", required: true },
    { name: "name", label: "Name", type: "text", required: true },
    { name: "is_confirmed", label: "Confirmed as delivered by this organisation", type: "checkbox", help: "Confirmation is a human declaration; the system does not verify registration." },
    { name: "notes", label: "Notes", type: "textarea" },
  ];

  const auditBlockers = (v: Record<string, any>) =>
    v.status === "completed" && (!v.completed_date || !String(v.findings ?? "").trim() || !v.rating)
      ? ["A completed internal audit requires a completion date, findings and a rating."]
      : [];

  const coiBlockers = (v: Record<string, any>) =>
    v.has_conflict && !String(v.mitigation ?? "").trim()
      ? ["A declared conflict requires a documented mitigation."]
      : [];

  return (
    <div className="space-y-6">
      <PageHeading
        title="Governance and operational management"
        description="Board and management review records, governance actions, conflict of interest declarations, the internal audit schedule and the registration groups the organisation declares it delivers."
        actions={
          <>
            <Button onClick={() => setSheet({ table: "governance_meetings" })} disabled={!canEdit}>Record meeting</Button>
            <Button variant="outline" onClick={() => setSheet({ table: "internal_audits" })} disabled={!canEdit}>Plan internal audit</Button>
            <Button variant="outline" onClick={() => setSheet({ table: "conflict_of_interest_declarations" })} disabled={!canEdit}>New declaration</Button>
          </>
        }
      />
      <HumanReviewNotice />

      <div className="grid gap-4 sm:grid-cols-4">
        <Card><CardHeader className="pb-2"><CardDescription>Meetings recorded</CardDescription></CardHeader><CardContent className="text-2xl font-semibold">{data?.meetings.length ?? 0}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Overdue actions</CardDescription></CardHeader><CardContent className="text-2xl font-semibold text-destructive">{overdueActions.length}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Declared conflicts</CardDescription></CardHeader><CardContent className="text-2xl font-semibold">{(data?.coi ?? []).filter((c) => c.has_conflict).length}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Confirmed registration groups</CardDescription></CardHeader><CardContent className="text-2xl font-semibold">{(data?.groups ?? []).filter((g) => g.is_confirmed).length}</CardContent></Card>
      </div>

      {error ? <ErrorState error={error} /> : isLoading ? <LoadingState /> : (
        <Tabs defaultValue="meetings">
          <TabsList>
            <TabsTrigger value="meetings">Meetings</TabsTrigger>
            <TabsTrigger value="actions">Actions</TabsTrigger>
            <TabsTrigger value="coi">Conflicts of interest</TabsTrigger>
            <TabsTrigger value="audits">Internal audits</TabsTrigger>
            <TabsTrigger value="groups">Registration groups</TabsTrigger>
          </TabsList>

          <TabsContent value="meetings">
            {data!.meetings.length === 0 ? <EmptyState title="No meetings recorded" description="Governance meetings evidence oversight of quality and safeguarding." /> : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader><TableRow><TableHead>Type</TableHead><TableHead>Date</TableHead><TableHead>Decisions</TableHead><TableHead>Next</TableHead><TableHead className="w-24">Action</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {data!.meetings.map((m) => (
                      <TableRow key={m.id}>
                        <TableCell>{String(m.meeting_type).replace(/_/g, " ")}</TableCell>
                        <TableCell>{m.meeting_date}</TableCell>
                        <TableCell className="max-w-md truncate">{m.decisions}</TableCell>
                        <TableCell>{m.next_meeting_date ?? "—"}</TableCell>
                        <TableCell><Button size="sm" variant="outline" disabled={!canEdit} onClick={() => setSheet({ table: "governance_meetings", initial: m })}>Open</Button></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>

          <TabsContent value="actions">
            <div className="mb-3">
              <Button variant="outline" size="sm" disabled={!canEdit || data!.meetings.length === 0} onClick={() => setSheet({ table: "governance_actions" })}>Add action</Button>
            </div>
            {data!.actions.length === 0 ? <EmptyState title="No governance actions" description="Actions arising from meetings are tracked to completion here." /> : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader><TableRow><TableHead>Action</TableHead><TableHead>Owner</TableHead><TableHead>Due</TableHead><TableHead>Status</TableHead><TableHead className="w-24">Action</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {data!.actions.map((a) => (
                      <TableRow key={a.id}>
                        <TableCell className="max-w-md">{a.action}</TableCell>
                        <TableCell>{staffName(a.owner_id)}</TableCell>
                        <TableCell>{a.due_date}</TableCell>
                        <TableCell>
                          <StatusPill tone={a.status === "completed" ? "ok" : a.due_date < today ? "bad" : "warn"}>
                            {a.status === "completed" ? "Completed" : a.due_date < today ? "Overdue" : String(a.status).replace(/_/g, " ")}
                          </StatusPill>
                        </TableCell>
                        <TableCell><Button size="sm" variant="outline" disabled={!canEdit} onClick={() => setSheet({ table: "governance_actions", initial: a })}>Open</Button></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>

          <TabsContent value="coi">
            {data!.coi.length === 0 ? <EmptyState title="No declarations" description="Conflict of interest declarations evidence governance integrity." /> : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader><TableRow><TableHead>Person</TableHead><TableHead>Type</TableHead><TableHead>Conflict</TableHead><TableHead>Declared</TableHead><TableHead>Status</TableHead><TableHead className="w-24">Action</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {data!.coi.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell>{staffName(c.user_id)}</TableCell>
                        <TableCell>{String(c.declaration_type).replace(/_/g, " ")}</TableCell>
                        <TableCell>{c.has_conflict ? <StatusPill tone="warn">Declared</StatusPill> : "None"}</TableCell>
                        <TableCell>{c.declared_at ? new Date(c.declared_at).toLocaleDateString() : "—"}</TableCell>
                        <TableCell>{c.status}</TableCell>
                        <TableCell><Button size="sm" variant="outline" disabled={!canEdit} onClick={() => setSheet({ table: "conflict_of_interest_declarations", initial: c })}>Open</Button></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>

          <TabsContent value="audits">
            {data!.audits.length === 0 ? <EmptyState title="No internal audits" description="An internal audit schedule evidences continuous improvement." /> : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader><TableRow><TableHead>Title</TableHead><TableHead>Module</TableHead><TableHead>Planned</TableHead><TableHead>Status</TableHead><TableHead>Rating</TableHead><TableHead className="w-24">Action</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {data!.audits.map((a) => (
                      <TableRow key={a.id}>
                        <TableCell>{a.title}</TableCell>
                        <TableCell>{a.module}</TableCell>
                        <TableCell>{a.planned_date}</TableCell>
                        <TableCell><StatusPill tone={a.status === "completed" ? "ok" : "warn"}>{String(a.status).replace(/_/g, " ")}</StatusPill></TableCell>
                        <TableCell>{a.rating ? String(a.rating).replace(/_/g, " ") : "—"}</TableCell>
                        <TableCell><Button size="sm" variant="outline" disabled={!canEdit} onClick={() => setSheet({ table: "internal_audits", initial: a })}>Open</Button></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>

          <TabsContent value="groups">
            <div className="mb-3">
              <Button variant="outline" size="sm" disabled={!canEdit} onClick={() => setSheet({ table: "registration_groups" })}>Add registration group</Button>
            </div>
            {data!.groups.length === 0 ? <EmptyState title="No registration groups recorded" description="Record the registration groups the organisation delivers, such as 0107, 0115 or 0138." /> : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader><TableRow><TableHead>Code</TableHead><TableHead>Name</TableHead><TableHead>Confirmed</TableHead><TableHead>Notes</TableHead><TableHead className="w-24">Action</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {data!.groups.map((g) => (
                      <TableRow key={g.id}>
                        <TableCell className="font-mono">{g.code}</TableCell>
                        <TableCell>{g.name}</TableCell>
                        <TableCell>{g.is_confirmed ? <StatusPill tone="ok">Confirmed</StatusPill> : <StatusPill tone="warn">Unconfirmed</StatusPill>}</TableCell>
                        <TableCell className="max-w-sm truncate">{g.notes ?? "—"}</TableCell>
                        <TableCell><Button size="sm" variant="outline" disabled={!canEdit} onClick={() => setSheet({ table: "registration_groups", initial: g })}>Open</Button></TableCell>
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
          title={
            sheet.table === "governance_meetings" ? "Governance meeting"
              : sheet.table === "governance_actions" ? "Governance action"
              : sheet.table === "conflict_of_interest_declarations" ? "Conflict of interest declaration"
              : sheet.table === "internal_audits" ? "Internal audit"
              : "Registration group"
          }
          description="Governance records are organisation-scoped, audit-logged and archived rather than deleted."
          fields={
            sheet.table === "governance_meetings" ? meetingFields
              : sheet.table === "governance_actions" ? actionFields
              : sheet.table === "conflict_of_interest_declarations" ? coiFields
              : sheet.table === "internal_audits" ? auditFields
              : groupFields
          }
          initial={sheet.initial}
          blockers={
            sheet.table === "internal_audits" ? auditBlockers
              : sheet.table === "conflict_of_interest_declarations" ? coiBlockers
              : undefined
          }
          readOnly={!canEdit}
          readOnlyReason="Mock audit mode or your role prevents changes."
          onSubmit={async (values) => {
            const extra =
              sheet.table === "governance_meetings" ? { recorded_by: user?.id }
                : sheet.table === "registration_groups" && values.is_confirmed
                ? { confirmed_by: user?.id, confirmed_at: new Date().toISOString() }
                : {};
            await save.mutateAsync({ table: sheet.table, values: { ...values, ...extra } });
            setSheet(null);
          }}
        />
      )}
    </div>
  );
}
