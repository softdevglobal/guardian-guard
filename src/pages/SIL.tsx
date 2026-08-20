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
  BlockerAlert, EmptyState, ErrorState, HumanReviewNotice, LoadingState, PageHeading, StatusPill,
} from "@/components/compliance/GateUI";
import { RecordSheet, type FieldDef } from "@/components/compliance/RecordSheet";
import { toOptions, useParticipants, withOrg } from "@/hooks/useComplianceLookups";

type Tbl = "sil_houses" | "sil_tenancy_agreements" | "sil_house_drills";

export default function SIL() {
  const { user, hasRole, isMockAudit } = useAuth();
  const qc = useQueryClient();
  const canEdit = !isMockAudit && hasRole(["super_admin", "compliance_officer", "supervisor"]);
  const canConfigure = !isMockAudit && hasRole(["super_admin", "compliance_officer"]);
  const { data: participants = [] } = useParticipants();
  const [sheet, setSheet] = useState<{ table: Tbl; initial?: Record<string, any> } | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["sil"],
    queryFn: async () => {
      const [config, houses, tenancies, drills] = await Promise.all([
        supabase.from("sil_configuration" as any).select("*").maybeSingle(),
        supabase.from("sil_houses" as any).select("*").eq("record_status", "active").order("name"),
        supabase.from("sil_tenancy_agreements" as any).select("*").eq("record_status", "active").order("created_at", { ascending: false }),
        supabase.from("sil_house_drills" as any).select("*").order("drill_date", { ascending: false }).limit(200),
      ]);
      for (const r of [houses, tenancies, drills]) if (r.error) throw r.error;
      return {
        config: (config.data as any) ?? null,
        houses: (houses.data as any[]) ?? [],
        tenancies: (tenancies.data as any[]) ?? [],
        drills: (drills.data as any[]) ?? [],
      };
    },
  });

  const enabled = !!data?.config?.is_enabled && !!data?.config?.registration_confirmed;

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
      qc.invalidateQueries({ queryKey: ["sil"] });
      toast({ title: "Saved", description: "The SIL record has been written to the audit trail." });
    },
    onError: (e: any) => toast({ variant: "destructive", title: "Blocked by the compliance engine", description: e.message }),
  });

  const toggleEnable = useMutation({
    mutationFn: async (next: boolean) => {
      const row = { is_enabled: next, registration_confirmed: next, confirmed_by: user?.id, confirmed_at: new Date().toISOString() };
      if (data?.config?.id) {
        const { error } = await supabase.from("sil_configuration" as any).update(row).eq("id", data.config.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("sil_configuration" as any).insert({ ...row, organisation_id: user?.organisation_id });
        if (error) throw error;
      }
      await logAudit({ action: next ? "sil_enabled" : "sil_disabled", module: "sil_configuration", severity: "high" });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sil"] });
      toast({ title: "SIL configuration updated", description: "The change was recorded in the audit trail." });
    },
    onError: (e: any) => toast({ variant: "destructive", title: "Could not update", description: e.message }),
  });

  const houseName = (id: string) => data?.houses.find((h) => h.id === id)?.name ?? "—";
  const participantName = (id: string) => participants.find((p) => p.id === id)?.full_name ?? "Restricted";

  const houseFields: FieldDef[] = [
    { name: "name", label: "House name", type: "text", required: true },
    { name: "address", label: "Address", type: "textarea", required: true },
    { name: "house_emergency_plan", label: "House emergency and evacuation plan", type: "textarea", required: true },
    { name: "plan_review_date", label: "Plan review date", type: "date", required: true },
  ];

  const tenancyFields: FieldDef[] = [
    { name: "participant_id", label: "Participant", type: "select", required: true, options: toOptions(participants) },
    { name: "house_id", label: "House", type: "select", required: true, options: toOptions(data?.houses ?? [], "name") },
    { name: "agreement_number", label: "Agreement number", type: "text", required: true },
    {
      name: "status", label: "Status", type: "select", required: true,
      options: ["draft", "participant_review", "signed", "active", "ended", "archived"].map((v) => ({ value: v, label: v.replace(/_/g, " ") })),
    },
    {
      name: "independent_of_service_agreement", label: "Tenancy is independent of the service agreement", type: "checkbox",
      help: "SIL requires the participant's housing rights to be separable from their supports.",
    },
    { name: "tenancy_start", label: "Tenancy start", type: "date" },
    { name: "tenancy_end", label: "Tenancy end", type: "date" },
    { name: "rights_acknowledged", label: "Tenancy rights explained and acknowledged", type: "checkbox" },
    { name: "accessible_copy_provided", label: "Accessible copy provided", type: "checkbox" },
    { name: "keys_private_space_preferences", label: "Keys and private space preferences", type: "textarea" },
    { name: "visitor_preferences", label: "Visitor preferences", type: "textarea" },
    { name: "co_tenant_consultation", label: "Co-tenant consultation record", type: "textarea" },
    { name: "shared_space_decisions", label: "Shared space decisions", type: "textarea" },
    { name: "vacancy_consultation", label: "Vacancy consultation", type: "textarea" },
    { name: "conflict_safeguarding_plan", label: "Conflict and safeguarding plan", type: "textarea" },
    { name: "signature_method", label: "Signature method", type: "text" },
    { name: "signed_by_name", label: "Signed by (name)", type: "text" },
    { name: "signed_at", label: "Signed at", type: "datetime" },
    { name: "signed_copy_url", label: "Signed copy reference", type: "text" },
  ];

  const drillFields: FieldDef[] = [
    { name: "house_id", label: "House", type: "select", required: true, options: toOptions(data?.houses ?? [], "name") },
    {
      name: "drill_type", label: "Drill type", type: "select", required: true,
      options: ["fire_evacuation", "medical_emergency", "lockdown", "utility_failure", "pandemic", "other"].map((v) => ({ value: v, label: v.replace(/_/g, " ") })),
    },
    { name: "drill_date", label: "Drill date", type: "date", required: true },
    { name: "outcome", label: "Outcome", type: "textarea", required: true },
    { name: "issues_identified", label: "Issues identified", type: "textarea" },
    { name: "next_due_date", label: "Next drill due", type: "date", required: true },
  ];

  const tenancyBlockers = (v: Record<string, any>) => {
    const out: string[] = [];
    if (["signed", "active"].includes(v.status)) {
      if (!v.independent_of_service_agreement) out.push("The tenancy must be recorded as independent of the service agreement before it can be signed or made active.");
      if (!v.rights_acknowledged) out.push("Tenancy rights must be explained and acknowledged before signing.");
      if (!v.signed_by_name || !v.signed_at) out.push("A signature name and date are required for a signed or active tenancy.");
      if (!String(v.conflict_safeguarding_plan ?? "").trim()) out.push("A conflict and safeguarding plan is required for an active SIL tenancy.");
    }
    return out;
  };

  return (
    <div className="space-y-6">
      <PageHeading
        title="Supported Independent Living"
        description="SIL standards evidence for registration group 0115 and 0138 delivery: house emergency planning, tenancy rights held separately from supports, co-tenant consultation and drill records."
        actions={
          <>
            <Button onClick={() => setSheet({ table: "sil_houses" })} disabled={!canEdit || !enabled}>Add house</Button>
            <Button variant="outline" onClick={() => setSheet({ table: "sil_tenancy_agreements" })} disabled={!canEdit || !enabled}>New tenancy</Button>
            <Button variant="outline" onClick={() => setSheet({ table: "sil_house_drills" })} disabled={!canEdit || !enabled}>Record drill</Button>
          </>
        }
      />
      <HumanReviewNotice />

      <Card>
        <CardHeader className="pb-2">
          <CardDescription>SIL module availability</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1 text-sm">
            <StatusPill tone={enabled ? "ok" : "warn"}>{enabled ? "Enabled — registration confirmed" : "Disabled"}</StatusPill>
            <p className="text-muted-foreground">
              SIL records can only be created when an authorised person has confirmed the organisation delivers SIL under its registration.
              Enabling this module does not verify registration — that confirmation remains a human responsibility.
            </p>
          </div>
          <Button variant={enabled ? "outline" : "default"} disabled={!canConfigure || toggleEnable.isPending} onClick={() => toggleEnable.mutate(!enabled)}>
            {enabled ? "Disable SIL module" : "Confirm registration and enable"}
          </Button>
        </CardContent>
      </Card>

      {!enabled && <BlockerAlert title="SIL records are locked" blockers={["Enable the SIL module above before house, tenancy or drill records can be created."]} />}

      {error ? <ErrorState error={error} /> : isLoading ? <LoadingState /> : (
        <Tabs defaultValue="houses">
          <TabsList>
            <TabsTrigger value="houses">Houses</TabsTrigger>
            <TabsTrigger value="tenancies">Tenancy agreements</TabsTrigger>
            <TabsTrigger value="drills">Drills</TabsTrigger>
          </TabsList>

          <TabsContent value="houses">
            {data!.houses.length === 0 ? (
              <EmptyState title="No houses recorded" description="Each SIL dwelling needs an emergency plan and a review date." />
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Address</TableHead><TableHead>Plan review</TableHead><TableHead className="w-24">Action</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {data!.houses.map((h) => (
                      <TableRow key={h.id}>
                        <TableCell>{h.name}</TableCell>
                        <TableCell>{h.address}</TableCell>
                        <TableCell>{h.plan_review_date ?? "—"}</TableCell>
                        <TableCell><Button size="sm" variant="outline" disabled={!canEdit} onClick={() => setSheet({ table: "sil_houses", initial: h })}>Open</Button></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>

          <TabsContent value="tenancies">
            {data!.tenancies.length === 0 ? (
              <EmptyState title="No tenancy agreements" description="Tenancy agreements evidence that housing rights are held independently of supports." />
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader><TableRow><TableHead>Participant</TableHead><TableHead>House</TableHead><TableHead>Agreement</TableHead><TableHead>Status</TableHead><TableHead>Independent</TableHead><TableHead className="w-24">Action</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {data!.tenancies.map((t) => (
                      <TableRow key={t.id}>
                        <TableCell>{participantName(t.participant_id)}</TableCell>
                        <TableCell>{houseName(t.house_id)}</TableCell>
                        <TableCell>{t.agreement_number}</TableCell>
                        <TableCell><StatusPill tone={t.status === "active" ? "ok" : t.status === "ended" ? "neutral" : "warn"}>{t.status}</StatusPill></TableCell>
                        <TableCell>{t.independent_of_service_agreement ? "Yes" : <StatusPill tone="bad">No</StatusPill>}</TableCell>
                        <TableCell><Button size="sm" variant="outline" disabled={!canEdit} onClick={() => setSheet({ table: "sil_tenancy_agreements", initial: t })}>Open</Button></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>

          <TabsContent value="drills">
            {data!.drills.length === 0 ? (
              <EmptyState title="No drills recorded" description="Drill records evidence emergency and disaster preparedness in each house." />
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader><TableRow><TableHead>House</TableHead><TableHead>Type</TableHead><TableHead>Date</TableHead><TableHead>Issues</TableHead><TableHead>Next due</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {data!.drills.map((d) => (
                      <TableRow key={d.id}>
                        <TableCell>{houseName(d.house_id)}</TableCell>
                        <TableCell>{String(d.drill_type).replace(/_/g, " ")}</TableCell>
                        <TableCell>{d.drill_date}</TableCell>
                        <TableCell>{d.issues_identified || "None recorded"}</TableCell>
                        <TableCell>{d.next_due_date ?? "—"}</TableCell>
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
          title={sheet.table === "sil_houses" ? "SIL house" : sheet.table === "sil_tenancy_agreements" ? "Tenancy agreement" : "House drill"}
          description="SIL records are organisation-scoped, audit-logged and archived rather than deleted."
          fields={sheet.table === "sil_houses" ? houseFields : sheet.table === "sil_tenancy_agreements" ? tenancyFields : drillFields}
          initial={sheet.initial}
          blockers={sheet.table === "sil_tenancy_agreements" ? tenancyBlockers : undefined}
          readOnly={!canEdit || !enabled}
          readOnlyReason="Mock audit mode, your role, or the disabled SIL module prevents changes."
          onSubmit={async (values) => {
            const extra = sheet.table === "sil_house_drills" ? { recorded_by: user?.id } : {};
            await save.mutateAsync({ table: sheet.table, values: { ...values, ...extra } });
            setSheet(null);
          }}
        />
      )}
    </div>
  );
}
