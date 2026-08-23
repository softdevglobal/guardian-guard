import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { ErrorState, LoadingState, PageHeading } from "@/components/compliance/GateUI";
import { useServiceConfig, SERVICE_SELECTION_KEYS } from "@/hooks/useServiceSelection";
import { reportError, toSafeError } from "@/lib/userFacingError";
import type { RequirementType } from "@/lib/serviceSelection";

const REQUIREMENT_TYPES: RequirementType[] = [
  "licence", "insurance", "screening", "training", "policy",
  "evidence", "risk_template", "task_template", "registration_group", "operational_module",
];

/** Platform-owner surface for the universal onboarding engine's configuration rows. */
export default function ServiceConfig() {
  const qc = useQueryClient();
  const config = useServiceConfig();
  const [catForm, setCatForm] = useState({ code: "", name: "", requires_ndis_registration: false });
  const [typeForm, setTypeForm] = useState({ business_category_id: "", code: "", name: "" });
  const [ruleForm, setRuleForm] = useState({
    business_category_id: "", service_type_id: "",
    requirement_type: "licence" as RequirementType, requirement_reference: "", label: "", required: true,
  });

  const templates = useQuery({
    queryKey: ["master-templates"],
    queryFn: async () => {
      const { data, error } = await supabase.from("master_templates" as any).select("*").order("title");
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: SERVICE_SELECTION_KEYS.config });
  };

  const insert = useMutation({
    mutationFn: async ({ table, row }: { table: string; row: Record<string, unknown> }) => {
      const { error } = await supabase.from(table as any).insert(row as any);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast({ title: "Saved", description: "Configuration updated for all providers." });
    },
    onError: (e) => {
      reportError("service-config", e);
      const safe = toSafeError(e, "save this configuration");
      toast({ title: safe.title, description: `${safe.description} (${safe.supportReference})`, variant: "destructive" });
    },
  });

  const toggleActive = useMutation({
    mutationFn: async ({ table, id, active }: { table: string; id: string; active: boolean }) => {
      const { error } = await supabase.from(table as any).update({ active } as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (e) => {
      reportError("service-config-toggle", e);
      const safe = toSafeError(e, "update this configuration");
      toast({ title: safe.title, description: safe.description, variant: "destructive" });
    },
  });

  const catName = useMemo(
    () => new Map((config.data?.categories ?? []).map((c) => [c.id, c.name])),
    [config.data],
  );

  if (config.isLoading) return <div className="space-y-4"><LoadingState rows={6} /></div>;
  if (config.error) return <ErrorState error={config.error} onRetry={() => config.refetch()} scope="load service configuration" />;

  const categories = config.data?.categories ?? [];
  const serviceTypes = config.data?.serviceTypes ?? [];
  const rules = config.data?.rules ?? [];

  return (
    <div className="space-y-6">
      <PageHeading
        title="Service configuration"
        description="Business categories, services and rules that drive every provider's onboarding pathway, required evidence and operational modules. Changes apply to all tenants."
      />

      <Tabs defaultValue="categories">
        <TabsList>
          <TabsTrigger value="categories">Categories</TabsTrigger>
          <TabsTrigger value="services">Services</TabsTrigger>
          <TabsTrigger value="rules">Requirement rules</TabsTrigger>
          <TabsTrigger value="templates">Policy templates</TabsTrigger>
        </TabsList>

        <TabsContent value="categories" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Add a business category</CardTitle></CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-4 md:items-end">
              <div className="space-y-1">
                <Label htmlFor="cat-code">Code</Label>
                <Input id="cat-code" value={catForm.code} onChange={(e) => setCatForm({ ...catForm, code: e.target.value })} placeholder="allied_health" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="cat-name">Name</Label>
                <Input id="cat-name" value={catForm.name} onChange={(e) => setCatForm({ ...catForm, name: e.target.value })} placeholder="Allied health" />
              </div>
              <div className="flex items-center gap-2">
                <Switch id="cat-ndis" checked={catForm.requires_ndis_registration} onCheckedChange={(v) => setCatForm({ ...catForm, requires_ndis_registration: v })} />
                <Label htmlFor="cat-ndis">Typically NDIS registered</Label>
              </div>
              <Button
                disabled={!catForm.code.trim() || !catForm.name.trim() || insert.isPending}
                onClick={() => insert.mutate({ table: "business_categories", row: { ...catForm, active: true, display_order: categories.length + 1 } }, { onSuccess: () => setCatForm({ code: "", name: "", requires_ndis_registration: false }) })}
              >
                Add category
              </Button>
            </CardContent>
          </Card>
          <ConfigTable
            head={["Name", "Code", "NDIS registration", "Active", ""]}
            rows={categories.map((c) => [
              c.name, c.code, c.requires_ndis_registration ? "Typically required" : "Not assumed",
              <Badge key="a" variant={c.active ? "default" : "secondary"}>{c.active ? "Active" : "Inactive"}</Badge>,
              <Button key="b" size="sm" variant="outline" onClick={() => toggleActive.mutate({ table: "business_categories", id: c.id, active: !c.active })}>
                {c.active ? "Deactivate" : "Activate"}
              </Button>,
            ])}
          />
        </TabsContent>

        <TabsContent value="services" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Add a service under a category</CardTitle></CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-4 md:items-end">
              <div className="space-y-1">
                <Label>Category</Label>
                <Select value={typeForm.business_category_id} onValueChange={(v) => setTypeForm({ ...typeForm, business_category_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                  <SelectContent>{categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="svc-code">Code</Label>
                <Input id="svc-code" value={typeForm.code} onChange={(e) => setTypeForm({ ...typeForm, code: e.target.value })} placeholder="physiotherapy" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="svc-name">Name</Label>
                <Input id="svc-name" value={typeForm.name} onChange={(e) => setTypeForm({ ...typeForm, name: e.target.value })} placeholder="Physiotherapy" />
              </div>
              <Button
                disabled={!typeForm.business_category_id || !typeForm.code.trim() || !typeForm.name.trim() || insert.isPending}
                onClick={() => insert.mutate({ table: "service_types", row: { ...typeForm, active: true, display_order: serviceTypes.length + 1 } }, { onSuccess: () => setTypeForm({ business_category_id: "", code: "", name: "" }) })}
              >
                Add service
              </Button>
            </CardContent>
          </Card>
          <ConfigTable
            head={["Service", "Category", "Flags", "Active", ""]}
            rows={serviceTypes.map((t) => [
              t.name,
              catName.get(t.business_category_id) ?? "—",
              [t.high_risk && "High risk", t.requires_participant_management && "Participants",
               t.requires_clinical_governance && "Clinical", t.requires_worker_screening && "Screening",
               t.supports_geolocation && "Geolocation", t.requires_photos && "Photos"].filter(Boolean).join(", ") || "—",
              <Badge key="a" variant={t.active ? "default" : "secondary"}>{t.active ? "Active" : "Inactive"}</Badge>,
              <Button key="b" size="sm" variant="outline" onClick={() => toggleActive.mutate({ table: "service_types", id: t.id, active: !t.active })}>
                {t.active ? "Deactivate" : "Activate"}
              </Button>,
            ])}
          />
        </TabsContent>

        <TabsContent value="rules" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Add a requirement rule</CardTitle></CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-5 md:items-end">
              <div className="space-y-1">
                <Label>Category</Label>
                <Select value={ruleForm.business_category_id} onValueChange={(v) => setRuleForm({ ...ruleForm, business_category_id: v, service_type_id: "" })}>
                  <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                  <SelectContent>{categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Service (optional)</Label>
                <Select value={ruleForm.service_type_id} onValueChange={(v) => setRuleForm({ ...ruleForm, service_type_id: v })}>
                  <SelectTrigger><SelectValue placeholder="All services" /></SelectTrigger>
                  <SelectContent>
                    {serviceTypes.filter((t) => t.business_category_id === ruleForm.business_category_id).map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Type</Label>
                <Select value={ruleForm.requirement_type} onValueChange={(v) => setRuleForm({ ...ruleForm, requirement_type: v as RequirementType })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{REQUIREMENT_TYPES.map((t) => <SelectItem key={t} value={t}>{t.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="rule-ref">Reference</Label>
                <Input id="rule-ref" value={ruleForm.requirement_reference} onChange={(e) => setRuleForm({ ...ruleForm, requirement_reference: e.target.value })} placeholder="ahpra_registration" />
              </div>
              <Button
                disabled={!ruleForm.business_category_id || !ruleForm.requirement_reference.trim() || insert.isPending}
                onClick={() => insert.mutate({
                  table: "compliance_requirement_rules",
                  row: {
                    business_category_id: ruleForm.business_category_id,
                    service_type_id: ruleForm.service_type_id || null,
                    requirement_type: ruleForm.requirement_type,
                    requirement_reference: ruleForm.requirement_reference.trim(),
                    label: ruleForm.label.trim() || ruleForm.requirement_reference.trim(),
                    required: ruleForm.required,
                    active: true,
                  },
                }, { onSuccess: () => setRuleForm({ ...ruleForm, requirement_reference: "", label: "" }) })}
              >
                Add rule
              </Button>
            </CardContent>
          </Card>
          <ConfigTable
            head={["Type", "Reference", "Category", "Required", "Active", ""]}
            rows={rules.map((r) => [
              r.requirement_type.replace(/_/g, " "),
              r.label || r.requirement_reference,
              r.business_category_id ? (catName.get(r.business_category_id) ?? "—") : "All",
              r.required ? "Mandatory" : "Optional",
              <Badge key="a" variant={r.active ? "default" : "secondary"}>{r.active ? "Active" : "Inactive"}</Badge>,
              <Button key="b" size="sm" variant="outline" onClick={() => toggleActive.mutate({ table: "compliance_requirement_rules", id: r.id, active: !r.active })}>
                {r.active ? "Deactivate" : "Activate"}
              </Button>,
            ])}
          />
        </TabsContent>

        <TabsContent value="templates" className="space-y-4">
          {templates.isLoading && <LoadingState rows={4} />}
          {templates.error && <ErrorState error={templates.error} onRetry={() => templates.refetch()} scope="load policy templates" />}
          {templates.data && (
            <ConfigTable
              head={["Template", "Type", "Category", "Version"]}
              rows={templates.data.map((t) => [
                t.title,
                t.template_type ?? "policy",
                t.business_category_id ? (catName.get(t.business_category_id) ?? "—") : "All",
                t.version ?? "1",
              ])}
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ConfigTable({ head, rows }: { head: string[]; rows: React.ReactNode[][] }) {
  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>{head.map((h, i) => <TableHead key={i}>{h}</TableHead>)}</TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow><TableCell colSpan={head.length} className="text-sm text-muted-foreground">Nothing configured yet.</TableCell></TableRow>
            )}
            {rows.map((r, i) => (
              <TableRow key={i}>{r.map((cell, j) => <TableCell key={j}>{cell}</TableCell>)}</TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
