import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { logAudit } from "@/lib/auditLog";
import {
  EmptyState, ErrorState, HumanReviewNotice, LoadingState, PageHeading, ReadOnlyNotice, StatusPill,
} from "@/components/compliance/GateUI";
import { RecordSheet, type FieldDef } from "@/components/compliance/RecordSheet";
import { withOrg } from "@/hooks/useComplianceLookups";
import { labelValue } from "@/lib/correctiveActions";
import { daysBetween, urgencyFor, urgencyLabel, urgencyTone } from "@/lib/complianceCalendar";

const REGISTRATION_STATUSES = [
  "not_started",
  "preparing_application",
  "application_submitted",
  "audit_required",
  "audit_booked",
  "audit_completed",
  "awaiting_commission",
  "registered",
  "renewal_due",
  "registration_expired",
] as const;

const PERSONNEL_ROLES = ["director", "owner", "ceo", "manager", "responsible_person", "key_personnel"] as const;

/** Application readiness checklist — evidence Guardian Guard can observe in the tenant. */
function checklist(state: {
  hasAbn: boolean;
  hasPersonnel: boolean;
  screeningCurrent: boolean;
  policiesCount: number;
  documentsCount: number;
  openCapa: number;
}) {
  return [
    { key: "entity", label: "Business entity details recorded (ABN, legal name, contact)", done: state.hasAbn, to: "/settings" },
    { key: "personnel", label: "Key personnel recorded with positions and appointment dates", done: state.hasPersonnel, to: "/registration" },
    { key: "screening", label: "Key personnel screening and police checks are current", done: state.screeningCurrent, to: "/registration" },
    { key: "policies", label: "Policy library generated and under review", done: state.policiesCount > 0, to: "/policies" },
    { key: "documents", label: "Supporting documents uploaded (insurance, licences)", done: state.documentsCount > 0, to: "/evidence-room" },
    { key: "capa", label: "No overdue corrective actions outstanding", done: state.openCapa === 0, to: "/corrective-actions" },
  ];
}

export default function Registration() {
  const { user, hasRole, isMockAudit } = useAuth();
  const qc = useQueryClient();
  const canEdit = !isMockAudit && hasRole(["tenant_admin", "super_admin", "compliance_officer", "executive"]);
  const [personnelSheet, setPersonnelSheet] = useState<{ open: boolean; initial?: Record<string, any> }>({ open: false });
  const [orgSheet, setOrgSheet] = useState(false);

  const org = useQuery({
    queryKey: ["registration-org"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organisations" as any)
        .select("id, name, legal_name, abn, registration_status, registration_number, registration_expiry, registration_applied_at, registration_audit_date, registration_notes")
        .eq("id", user?.organisation_id ?? "")
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
    enabled: !!user?.organisation_id,
  });

  const personnel = useQuery({
    queryKey: ["key-personnel"],
    queryFn: async () => {
      const { data, error } = await supabase.from("key_personnel" as any).select("*").order("full_name");
      if (error) throw error;
      return (data as any[]) ?? [];
    },
  });

  const tasks = useQuery({
    queryKey: ["platform-tasks-tenant"],
    queryFn: async () => {
      const { data, error } = await supabase.from("platform_tasks" as any).select("*").order("due_date");
      if (error) throw error;
      return (data as any[]) ?? [];
    },
  });

  const context = useQuery({
    queryKey: ["registration-context"],
    queryFn: async () => {
      const [policies, documents, capa] = await Promise.all([
        supabase.from("policies" as any).select("id", { count: "exact", head: true }),
        supabase.from("organisation_documents" as any).select("id", { count: "exact", head: true }),
        supabase.from("corrective_actions" as any).select("id, due_date, status"),
      ]);
      for (const r of [policies, documents, capa]) if (r.error) throw r.error;
      const today = new Date().toISOString().slice(0, 10);
      const overdue = ((capa.data as any[]) ?? []).filter((c) => c.status !== "complete" && c.due_date && c.due_date < today).length;
      return { policies: policies.count ?? 0, documents: documents.count ?? 0, overdueCapa: overdue };
    },
  });

  const saveOrg = useMutation({
    mutationFn: async (values: Record<string, any>) => {
      const { error } = await supabase
        .from("organisations" as any)
        .update({
          registration_status: values.registration_status,
          registration_number: values.registration_number || null,
          registration_expiry: values.registration_expiry || null,
          registration_applied_at: values.registration_applied_at || null,
          registration_audit_date: values.registration_audit_date || null,
          registration_notes: values.registration_notes || null,
        })
        .eq("id", user?.organisation_id ?? "");
      if (error) throw error;
      await logAudit({ action: "updated", module: "registration", record_id: user?.organisation_id ?? undefined });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["registration-org"] });
      toast({ title: "Registration details saved", description: "Recorded for evidence. Registration status is determined by the NDIS Commission, not by Guardian Guard." });
    },
    onError: (e: any) => toast({ variant: "destructive", title: "Could not save", description: e.message }),
  });

  const savePersonnel = useMutation({
    mutationFn: async (values: Record<string, any>) => {
      const payload = withOrg(values, user?.organisation_id, user?.id);
      if (values.id) {
        const { id, created_at, updated_at, organisation_id, created_by, ...rest } = payload;
        const { error } = await supabase.from("key_personnel" as any).update(rest).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("key_personnel" as any).insert(payload);
        if (error) throw error;
      }
      await logAudit({ action: values.id ? "updated" : "created", module: "key_personnel", record_id: values.id ?? undefined });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["key-personnel"] });
      qc.invalidateQueries({ queryKey: ["compliance-calendar"] });
      toast({ title: "Saved", description: "Key personnel record written to the audit trail." });
    },
    onError: (e: any) => toast({ variant: "destructive", title: "Could not save", description: e.message }),
  });

  const respondToTask = useMutation({
    mutationFn: async ({ id, response }: { id: string; response: string }) => {
      const { error } = await supabase.from("platform_tasks" as any).update({ provider_response: response, status: "submitted" }).eq("id", id);
      if (error) throw error;
      await logAudit({ action: "submitted", module: "platform_tasks", record_id: id });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["platform-tasks-tenant"] });
      toast({ title: "Submitted", description: "Guardian Guard will review your response." });
    },
    onError: (e: any) => toast({ variant: "destructive", title: "Could not submit", description: e.message }),
  });

  const people = personnel.data ?? [];
  const screeningCurrent =
    people.length > 0 &&
    people.every((p) => {
      if (!p.worker_screening_expiry) return false;
      return daysBetween(p.worker_screening_expiry) >= 0;
    });

  const items = checklist({
    hasAbn: !!org.data?.abn,
    hasPersonnel: people.length > 0,
    screeningCurrent,
    policiesCount: context.data?.policies ?? 0,
    documentsCount: context.data?.documents ?? 0,
    openCapa: context.data?.overdueCapa ?? 0,
  });
  const progress = Math.round((items.filter((i) => i.done).length / items.length) * 100);

  const personnelFields: FieldDef[] = [
    { name: "full_name", label: "Full name", type: "text", required: true },
    { name: "position", label: "Position", type: "text", required: true },
    { name: "role_type", label: "Role type", type: "select", required: true, options: PERSONNEL_ROLES.map((v) => ({ value: v, label: labelValue(v) })) },
    { name: "email", label: "Email", type: "text" },
    { name: "phone", label: "Phone", type: "text" },
    { name: "date_appointed", label: "Date appointed", type: "date" },
    { name: "worker_screening_number", label: "NDIS worker screening number", type: "text" },
    { name: "worker_screening_expiry", label: "Worker screening expiry", type: "date" },
    { name: "police_check_date", label: "Police check date", type: "date" },
    { name: "police_check_expiry", label: "Police check expiry", type: "date" },
    { name: "qualifications", label: "Qualifications", type: "textarea" },
    { name: "experience_summary", label: "Relevant experience", type: "textarea" },
    { name: "declarations", label: "Declarations (bankruptcy, banning orders, conflicts)", type: "textarea" },
    { name: "status", label: "Status", type: "select", required: true, options: ["active", "inactive"].map((v) => ({ value: v, label: labelValue(v) })) },
  ];

  const orgFields: FieldDef[] = [
    { name: "registration_status", label: "Registration stage", type: "select", required: true, options: REGISTRATION_STATUSES.map((v) => ({ value: v, label: labelValue(v) })) },
    { name: "registration_number", label: "NDIS registration number", type: "text" },
    { name: "registration_applied_at", label: "Application submitted", type: "date" },
    { name: "registration_audit_date", label: "Certification audit date", type: "date" },
    { name: "registration_expiry", label: "Registration expiry", type: "date" },
    { name: "registration_notes", label: "Notes", type: "textarea" },
  ];

  return (
    <div className="space-y-6 p-6">
      <PageHeading
        title="NDIS registration centre"
        description="Tracks where your organisation is in the NDIS registration or renewal journey and what evidence still has to be prepared. Guardian Guard records evidence — only the NDIS Commission determines registration."
        actions={canEdit ? <Button className="min-h-[44px]" onClick={() => setOrgSheet(true)}>Update registration details</Button> : undefined}
      />

      {isMockAudit && <ReadOnlyNotice reason="Mock audit mode is on — registration records are read only." />}
      <HumanReviewNotice>
        The checklist below reflects evidence recorded in Guardian Guard. It is an audit-readiness indicator only and never means your organisation is registered, certified or NDIS compliant.
      </HumanReviewNotice>

      {org.isLoading && <LoadingState rows={2} />}
      {org.error && <ErrorState error={org.error} onRetry={() => org.refetch()} />}

      {org.data && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Current stage</CardTitle>
            <CardDescription>{org.data.legal_name ?? org.data.name}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <StatusPill tone={org.data.registration_status === "registered" ? "ok" : "neutral"}>
                {labelValue(org.data.registration_status)}
              </StatusPill>
              {org.data.registration_number && <span className="text-sm text-muted-foreground">Registration {org.data.registration_number}</span>}
              {org.data.registration_expiry && (
                <StatusPill tone={urgencyTone(urgencyFor(daysBetween(org.data.registration_expiry)))}>
                  {urgencyLabel(urgencyFor(daysBetween(org.data.registration_expiry)))} — expires {org.data.registration_expiry}
                </StatusPill>
              )}
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Evidence preparation</span>
                <span className="font-medium">{progress}%</span>
              </div>
              <Progress value={progress} aria-label="Registration evidence preparation" />
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="checklist">
        <TabsList>
          <TabsTrigger value="checklist">Application checklist</TabsTrigger>
          <TabsTrigger value="personnel">Key personnel</TabsTrigger>
          <TabsTrigger value="tasks">Tasks from Guardian Guard</TabsTrigger>
        </TabsList>

        <TabsContent value="checklist" className="pt-4">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Requirement</TableHead>
                    <TableHead>Evidence status</TableHead>
                    <TableHead className="text-right">Go to</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((i) => (
                    <TableRow key={i.key}>
                      <TableCell>{i.label}</TableCell>
                      <TableCell>
                        <StatusPill tone={i.done ? "ok" : "warn"}>{i.done ? "Evidence recorded" : "Not yet evidenced"}</StatusPill>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button asChild variant="outline" size="sm" className="min-h-[36px]">
                          <a href={i.to}>Open</a>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="personnel" className="space-y-4 pt-4">
          {canEdit && (
            <Button className="min-h-[44px]" onClick={() => setPersonnelSheet({ open: true, initial: { status: "active", role_type: "key_personnel" } })}>
              Add key personnel
            </Button>
          )}
          {personnel.isLoading && <LoadingState rows={3} />}
          {personnel.error && <ErrorState error={personnel.error} onRetry={() => personnel.refetch()} />}
          {!personnel.isLoading && people.length === 0 && (
            <EmptyState title="No key personnel recorded" description="Record every director, owner and responsible person the NDIS Commission requires you to declare." />
          )}
          {people.length > 0 && (
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Position</TableHead>
                      <TableHead>Screening expiry</TableHead>
                      <TableHead>Police check expiry</TableHead>
                      <TableHead className="text-right">Manage</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {people.map((p) => {
                      const screening = p.worker_screening_expiry ? urgencyFor(daysBetween(p.worker_screening_expiry)) : null;
                      const police = p.police_check_expiry ? urgencyFor(daysBetween(p.police_check_expiry)) : null;
                      return (
                        <TableRow key={p.id}>
                          <TableCell className="font-medium">{p.full_name}</TableCell>
                          <TableCell>{p.position}</TableCell>
                          <TableCell>
                            {screening ? <StatusPill tone={urgencyTone(screening)}>{p.worker_screening_expiry}</StatusPill> : "Not recorded"}
                          </TableCell>
                          <TableCell>
                            {police ? <StatusPill tone={urgencyTone(police)}>{p.police_check_expiry}</StatusPill> : "Not recorded"}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button variant="outline" size="sm" className="min-h-[36px]" onClick={() => setPersonnelSheet({ open: true, initial: p })}>
                              {canEdit ? "Update" : "View"}
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="tasks" className="space-y-3 pt-4">
          {tasks.isLoading && <LoadingState rows={3} />}
          {tasks.error && <ErrorState error={tasks.error} onRetry={() => tasks.refetch()} />}
          {!tasks.isLoading && (tasks.data ?? []).length === 0 && (
            <EmptyState title="No tasks assigned" description="Compliance tasks assigned by Guardian Guard appear here with their due dates." />
          )}
          {(tasks.data ?? []).map((t) => (
            <Card key={t.id}>
              <CardHeader className="pb-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle className="text-base">{t.title}</CardTitle>
                  <StatusPill tone={t.status === "approved" ? "ok" : t.status === "correction_required" ? "bad" : "neutral"}>
                    {labelValue(t.status)}
                  </StatusPill>
                </div>
                <CardDescription>{t.due_date ? `Due ${t.due_date}` : "No due date"}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {t.instructions && <p className="text-sm">{t.instructions}</p>}
                {t.review_notes && <p className="text-sm text-muted-foreground">Reviewer notes: {t.review_notes}</p>}
                {canEdit && t.status !== "approved" && (
                  <Button
                    variant="outline"
                    className="min-h-[44px]"
                    onClick={() => {
                      const response = window.prompt("Describe what you have done and where the evidence sits:", t.provider_response ?? "");
                      if (response && response.trim()) respondToTask.mutate({ id: t.id, response: response.trim() });
                    }}
                  >
                    Submit response
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>

      <RecordSheet
        open={personnelSheet.open}
        onOpenChange={(open) => setPersonnelSheet((s) => ({ ...s, open }))}
        title={personnelSheet.initial?.id ? "Update key personnel" : "Add key personnel"}
        description="Key personnel details support your registration application and are visible to your organisation only."
        fields={personnelFields}
        initial={personnelSheet.initial}
        readOnly={!canEdit}
        readOnlyReason="Your role can view key personnel but not change them."
        onSubmit={async (values) => savePersonnel.mutateAsync(values)}
      />

      <RecordSheet
        open={orgSheet}
        onOpenChange={setOrgSheet}
        title="Registration details"
        description="Record where your application sits. These values are evidence only — the NDIS Commission determines registration."
        fields={orgFields}
        initial={org.data ?? {}}
        readOnly={!canEdit}
        readOnlyReason="Your role can view registration details but not change them."
        onSubmit={async (values) => saveOrg.mutateAsync(values)}
      />
    </div>
  );
}
