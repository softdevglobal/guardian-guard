import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import {
  BlockerAlert, EmptyState, ErrorState, HumanReviewNotice, LoadingState, PageHeading, StatusPill,
} from "@/components/compliance/GateUI";
import { logAudit } from "@/lib/auditLog";
import {
  ONBOARDING_STEPS, onboardingProgress, requirementApplies, stepBlockers, submitBlockers,
  type AnswerValue, type PathwayRequirement,
} from "@/lib/platform";

export default function Onboarding() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [stepIndex, setStepIndex] = useState(0);
  const [drafts, setDrafts] = useState<Record<string, AnswerValue>>({});

  const orgId = user?.organisation_id ?? null;

  const data = useQuery({
    queryKey: ["tenant-onboarding", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data: onb, error } = await supabase
        .from("organisation_onboarding" as any)
        .select("*, provider_pathways(name, code)")
        .eq("organisation_id", orgId)
        .maybeSingle();
      if (error) throw error;
      if (!onb) return { onb: null, reqs: [] as PathwayRequirement[], answers: [] as any[], docs: [] as any[] };
      const [reqs, answers, docs] = await Promise.all([
        supabase.from("pathway_requirements" as any).select("*").eq("pathway_id", (onb as any).pathway_id).eq("is_active", true).order("sort_order"),
        supabase.from("onboarding_answers" as any).select("*").eq("onboarding_id", (onb as any).id),
        supabase.from("organisation_documents" as any).select("*").eq("organisation_id", orgId),
      ]);
      return {
        onb: onb as any,
        reqs: ((reqs.data ?? []) as any[]) as PathwayRequirement[],
        answers: (answers.data ?? []) as any[],
        docs: (docs.data ?? []) as any[],
      };
    },
  });

  const answers: Record<string, AnswerValue> = useMemo(() => {
    const map: Record<string, AnswerValue> = {};
    for (const a of data.data?.answers ?? []) {
      map[a.requirement_key] = {
        value_text: a.value_text, value_number: a.value_number, value_bool: a.value_bool, value_date: a.value_date, value_json: a.value_json,
      };
    }
    return { ...map, ...drafts };
  }, [data.data, drafts]);

  const documentKeys = useMemo(
    () => new Set((data.data?.docs ?? []).map((d) => d.requirement_key as string)),
    [data.data],
  );

  const reqs = data.data?.reqs ?? [];
  const progress = onboardingProgress(reqs, answers, documentKeys);
  const step = ONBOARDING_STEPS[stepIndex];
  const stepReqs = reqs.filter((r) => r.step_key === step.key && requirementApplies(r, answers));
  const blockers = stepBlockers(step.key, reqs, answers, documentKeys);
  const allBlockers = submitBlockers(reqs, answers, documentKeys);

  const saveAnswers = useMutation({
    mutationFn: async () => {
      const onb = data.data?.onb;
      if (!onb) throw new Error("No onboarding record for your organisation.");
      const rows = Object.entries(drafts).map(([requirement_key, v]) => {
        const req = reqs.find((r) => r.requirement_key === requirement_key);
        return {
          organisation_id: orgId,
          onboarding_id: onb.id,
          requirement_key,
          step_key: req?.step_key ?? step.key,
          value_text: v.value_text ?? null,
          value_number: v.value_number ?? null,
          value_bool: v.value_bool ?? null,
          value_date: v.value_date ?? null,
          is_masked: req?.sensitivity === "sensitive" || req?.sensitivity === "highly_sensitive",
          answered_by: user?.id ?? null,
        };
      });
      if (rows.length > 0) {
        const { error } = await supabase
          .from("onboarding_answers" as any)
          .upsert(rows, { onConflict: "onboarding_id,requirement_key" });
        if (error) throw error;
      }
      const { error: upErr } = await supabase
        .from("organisation_onboarding" as any)
        .update({
          status: onb.status === "not_started" ? "in_progress" : onb.status === "returned" ? "in_progress" : onb.status,
          current_step: step.key,
          progress_pct: progress,
        })
        .eq("id", onb.id);
      if (upErr) throw upErr;
    },
    onSuccess: () => {
      setDrafts({});
      qc.invalidateQueries({ queryKey: ["tenant-onboarding", orgId] });
      toast({ title: "Progress saved", description: "You can close this and come back at any time." });
    },
    onError: (e: any) => toast({ variant: "destructive", title: "Could not save", description: e.message }),
  });

  const uploadDoc = useMutation({
    mutationFn: async ({ req, file, expiry }: { req: PathwayRequirement; file: File; expiry: string }) => {
      const onb = data.data?.onb;
      if (!onb || !orgId) throw new Error("No onboarding record for your organisation.");
      const path = `${orgId}/${req.requirement_key}/${Date.now()}-${file.name.replace(/[^\w.\-]/g, "_")}`;
      const { error: upErr } = await supabase.storage.from("org-documents").upload(path, file, { upsert: false });
      if (upErr) throw upErr;
      const previous = (data.data?.docs ?? []).find((d) => d.requirement_key === req.requirement_key);
      const { error } = await supabase.from("organisation_documents" as any).insert({
        organisation_id: orgId,
        requirement_key: req.requirement_key,
        document_type: req.field_type,
        title: req.label,
        storage_path: path,
        file_name: file.name,
        mime_type: file.type,
        expiry_date: expiry || null,
        version: (previous?.version ?? 0) + 1,
        supersedes_id: previous?.id ?? null,
        sensitivity: (req.sensitivity as any) ?? "internal",
        is_critical: req.is_mandatory,
      });
      if (error) throw error;
      await logAudit({ action: "onboarding_document_uploaded", module: "onboarding", record_id: onb.id, details: { requirement: req.requirement_key } });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tenant-onboarding", orgId] });
      toast({ title: "Document uploaded", description: "Stored privately. Only your organisation and the reviewer can open it." });
    },
    onError: (e: any) => toast({ variant: "destructive", title: "Upload failed", description: e.message }),
  });

  const submit = useMutation({
    mutationFn: async () => {
      const onb = data.data?.onb;
      if (!onb) throw new Error("No onboarding record.");
      if (allBlockers.length > 0) throw new Error("Complete every mandatory item before submitting.");
      const { error } = await supabase
        .from("organisation_onboarding" as any)
        .update({ status: "submitted", submitted_at: new Date().toISOString(), submitted_by: user?.id ?? null, progress_pct: progress })
        .eq("id", onb.id);
      if (error) throw error;
      await logAudit({ action: "onboarding_submitted", module: "onboarding", record_id: onb.id, severity: "elevated" });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tenant-onboarding", orgId] });
      toast({ title: "Submitted for review", description: "Guardian Guard will review your evidence and activate your modules once approved." });
    },
    onError: (e: any) => toast({ variant: "destructive", title: "Could not submit", description: e.message }),
  });

  if (!orgId) {
    return <div className="p-6"><EmptyState title="No organisation linked" description="Your account is not linked to a provider organisation yet. Contact your administrator." /></div>;
  }
  if (data.isLoading) return <div className="p-6"><LoadingState rows={5} /></div>;
  if (data.error) return <div className="p-6"><ErrorState error={data.error} /></div>;
  if (!data.data?.onb) {
    return (
      <div className="p-6">
        <EmptyState
          title="No onboarding required"
          description="Your organisation does not have an onboarding pack assigned. You can continue using Guardian Guard normally."
        />
      </div>
    );
  }

  const onb = data.data.onb;
  const submitted = onb.status === "submitted";
  const approved = onb.status === "approved";

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6">
      <PageHeading
        title="Get set up"
        description={`Tenant admin setup for ${onb.provider_pathways?.name ?? "your pathway"}. Save and resume at any time — nothing is submitted until you choose to.`}
        actions={<StatusPill tone={approved ? "ok" : submitted ? "warn" : "neutral"}>{onb.status.replace(/_/g, " ")}</StatusPill>}
      />

      <div className="flex items-center gap-2 rounded-md border border-success/40 bg-success/5 p-3 text-sm">
        <ShieldCheck className="h-4 w-4 text-success" aria-hidden="true" />
        Documents are stored in private storage and only opened through short-lived signed links. Dates of birth and screening numbers are masked by default.
      </div>

      {onb.status === "returned" && onb.returned_reason && (
        <BlockerAlert title="Returned for changes" blockers={[onb.returned_reason]} />
      )}

      <Card>
        <CardContent className="space-y-2 py-4">
          <div className="flex items-center justify-between text-sm">
            <span>Step {stepIndex + 1} of {ONBOARDING_STEPS.length}: {step.label}</span>
            <span>{progress}% of mandatory items complete</span>
          </div>
          <Progress value={progress} aria-label="Onboarding progress" />
          <div className="flex flex-wrap gap-1 pt-1">
            {ONBOARDING_STEPS.map((s, i) => (
              <Button key={s.key} size="sm" variant={i === stepIndex ? "default" : "outline"} className="min-h-[36px]" onClick={() => setStepIndex(i)}>
                {s.label}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {step.key === "welcome" && (
        <Card>
          <CardHeader><CardTitle className="text-base">Welcome to Guardian Guard</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p>This short setup collects your business details, licences, insurance and workforce screening evidence so your compliance records have a verified starting point.</p>
            <p>Guardian Guard records and organises your evidence. It does not certify your organisation, and nothing here means you are NDIS registered or compliant — a human reviewer checks everything you submit.</p>
            <HumanReviewNotice />
            <Button className="min-h-[44px]" onClick={() => setStepIndex(1)}>Start setup</Button>
          </CardContent>
        </Card>
      )}

      {step.key === "review" ? (
        <Card>
          <CardHeader><CardTitle className="text-base">Review and submit</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <BlockerAlert blockers={allBlockers} title="Still outstanding" />
            {approved ? (
              <p className="text-sm">Your setup has been approved and your modules are active. <Button variant="link" onClick={() => navigate("/")}>Go to your dashboard</Button></p>
            ) : submitted ? (
              <p className="text-sm text-muted-foreground">Submitted on {new Date(onb.submitted_at).toLocaleString()}. You will be notified when the review is complete.</p>
            ) : (
              <Button className="min-h-[44px]" disabled={allBlockers.length > 0 || submit.isPending} onClick={() => submit.mutate()}>
                Submit for review
              </Button>
            )}
          </CardContent>
        </Card>
      ) : step.key !== "welcome" && (
        <Card>
          <CardHeader><CardTitle className="text-base">{step.label}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {stepReqs.length === 0 && <p className="text-sm text-muted-foreground">Nothing to complete on this step for your pathway.</p>}
            {stepReqs.map((req) => (
              <RequirementField
                key={req.id}
                req={req}
                value={answers[req.requirement_key]}
                disabled={submitted || approved}
                uploaded={(data.data?.docs ?? []).find((d) => d.requirement_key === req.requirement_key)}
                onChange={(v) => setDrafts((d) => ({ ...d, [req.requirement_key]: v }))}
                onUpload={(file, expiry) => uploadDoc.mutate({ req, file, expiry })}
              />
            ))}
            <BlockerAlert blockers={blockers} title="Before this step is complete" />
            <div className="flex flex-wrap gap-2">
              <Button className="min-h-[44px]" disabled={saveAnswers.isPending || submitted || approved} onClick={() => saveAnswers.mutate()}>
                Save and continue later
              </Button>
              <Button variant="outline" className="min-h-[44px]" disabled={stepIndex === 0} onClick={() => setStepIndex((i) => Math.max(0, i - 1))}>Back</Button>
              <Button variant="outline" className="min-h-[44px]" onClick={() => setStepIndex((i) => Math.min(ONBOARDING_STEPS.length - 1, i + 1))}>Next step</Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function RequirementField({
  req, value, onChange, onUpload, uploaded, disabled,
}: {
  req: PathwayRequirement;
  value: AnswerValue | undefined;
  onChange: (v: AnswerValue) => void;
  onUpload: (file: File, expiry: string) => void;
  uploaded?: any;
  disabled?: boolean;
}) {
  const [expiry, setExpiry] = useState("");
  const id = `req-${req.requirement_key}`;
  const sensitive = req.sensitivity === "sensitive" || req.sensitivity === "highly_sensitive";

  return (
    <div className="space-y-2 rounded-md border p-3">
      <Label htmlFor={id}>
        {req.label}{req.is_mandatory && <span aria-hidden="true"> *</span>}
        {sensitive && <span className="ml-2 text-xs text-muted-foreground">(masked once saved)</span>}
      </Label>
      {req.help_text && <p className="text-xs text-muted-foreground">{req.help_text}</p>}

      {req.field_type === "boolean" ? (
        <label className="flex min-h-[44px] items-center gap-2 text-sm">
          <input id={id} type="checkbox" disabled={disabled} checked={value?.value_bool ?? false} onChange={(e) => onChange({ value_bool: e.target.checked })} />
          Yes
        </label>
      ) : req.field_type === "number" ? (
        <Input id={id} type="number" disabled={disabled} className="min-h-[44px]" value={value?.value_number ?? ""} onChange={(e) => onChange({ value_number: Number(e.target.value) })} />
      ) : req.field_type === "date" ? (
        <Input id={id} type="date" disabled={disabled} className="min-h-[44px]" value={value?.value_date ?? ""} onChange={(e) => onChange({ value_date: e.target.value })} />
      ) : req.field_type === "textarea" ? (
        <Textarea id={id} disabled={disabled} value={value?.value_text ?? ""} onChange={(e) => onChange({ value_text: e.target.value })} />
      ) : (
        <Input id={id} disabled={disabled} className="min-h-[44px]" value={value?.value_text ?? ""} onChange={(e) => onChange({ value_text: e.target.value })} />
      )}

      {req.requires_document && (
        <div className="space-y-2 rounded-md bg-muted/40 p-2">
          <p className="text-xs text-muted-foreground">
            {uploaded ? `Uploaded: ${uploaded.file_name} (v${uploaded.version})` : "Upload the supporting certificate or licence."}
          </p>
          {req.requires_expiry && (
            <div className="space-y-1">
              <Label htmlFor={`${id}-expiry`} className="text-xs">Expiry date</Label>
              <Input id={`${id}-expiry`} type="date" disabled={disabled} className="min-h-[44px] max-w-[200px]" value={expiry} onChange={(e) => setExpiry(e.target.value)} />
            </div>
          )}
          <Input
            aria-label={`Upload document for ${req.label}`}
            type="file"
            disabled={disabled}
            className="min-h-[44px]"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onUpload(file, expiry);
              e.target.value = "";
            }}
          />
        </div>
      )}
    </div>
  );
}
