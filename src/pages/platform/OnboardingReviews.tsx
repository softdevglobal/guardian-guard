import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { EmptyState, ErrorState, HumanReviewNotice, LoadingState, PageHeading, StatusPill } from "@/components/compliance/GateUI";
import { maskSensitive } from "@/lib/platform";
import { callPlatformAdmin } from "@/lib/platformApi";

export default function OnboardingReviews() {
  const qc = useQueryClient();
  const [notes, setNotes] = useState<Record<string, string>>({});

  const queue = useQuery({
    queryKey: ["platform-onboarding-queue"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organisation_onboarding" as any)
        .select("*, organisations(legal_name, name, account_status), provider_pathways(name)")
        .in("status", ["submitted", "in_review", "returned"])
        .order("submitted_at", { ascending: true });
      if (error) throw error;
      const rows = (data ?? []) as any[];
      const ids = rows.map((r) => r.id);
      const [reqs, answers, findings, docs] = await Promise.all([
        supabase.from("pathway_requirements" as any).select("*").eq("is_active", true),
        ids.length ? supabase.from("onboarding_answers" as any).select("*").in("onboarding_id", ids) : Promise.resolve({ data: [] as any[] }),
        ids.length ? supabase.from("onboarding_review_findings" as any).select("*").in("onboarding_id", ids) : Promise.resolve({ data: [] as any[] }),
        supabase.from("organisation_documents" as any).select("id, organisation_id, requirement_key, title, expiry_date"),
      ]);
      return {
        rows,
        reqs: ((reqs as any).data ?? []) as any[],
        answers: ((answers as any).data ?? []) as any[],
        findings: ((findings as any).data ?? []) as any[],
        docs: ((docs as any).data ?? []) as any[],
      };
    },
  });

  const decide = useMutation({
    mutationFn: async ({ onb, requirement_key, decision }: { onb: any; requirement_key: string; decision: "approved" | "returned" }) => {
      const note = notes[`${onb.id}:${requirement_key}`] ?? "";
      if (decision === "returned" && note.trim().length < 5) {
        throw new Error("Explain what the client needs to fix before returning a requirement.");
      }
      const { error } = await supabase.from("onboarding_review_findings" as any).upsert(
        {
          organisation_id: onb.organisation_id,
          onboarding_id: onb.id,
          requirement_key,
          decision,
          reviewer_notes: note || null,
          reviewed_at: new Date().toISOString(),
        },
        { onConflict: "onboarding_id,requirement_key" },
      );
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["platform-onboarding-queue"] });
      toast({ title: "Review recorded" });
    },
    onError: (e: any) => toast({ variant: "destructive", title: "Could not record review", description: e.message }),
  });

  const finalise = useMutation({
    mutationFn: async ({ organisation_id, action, reason }: { organisation_id: string; action: string; reason?: string }) =>
      callPlatformAdmin({ action, organisation_id, reason }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["platform-onboarding-queue"] });
      qc.invalidateQueries({ queryKey: ["platform-summary"] });
      toast({ title: "Onboarding updated", description: "Approved tenants have their mapped modules activated." });
    },
    onError: (e: any) => toast({ variant: "destructive", title: "Action failed", description: e.message }),
  });

  if (queue.isLoading) return <div className="p-6"><LoadingState rows={4} /></div>;
  if (queue.error) return <div className="p-6"><ErrorState error={queue.error} /></div>;
  const d = queue.data!;

  return (
    <div className="space-y-6 p-6">
      <PageHeading
        title="Onboarding reviews"
        description="Approve or return each requirement a client submitted, then activate the tenant when the mandatory items pass. Approval records your review — it never certifies the provider."
      />
      <HumanReviewNotice />

      {d.rows.length === 0 && (
        <EmptyState title="Nothing awaiting review" description="Submitted onboarding packs land here. You can also open a client directly from the Clients page." />
      )}

      {d.rows.map((onb) => {
        const reqs = d.reqs.filter((r) => r.pathway_id === onb.pathway_id).sort((a, b) => a.sort_order - b.sort_order);
        const answers = d.answers.filter((a) => a.onboarding_id === onb.id);
        const findings = d.findings.filter((f) => f.onboarding_id === onb.id);
        const orgDocs = d.docs.filter((x) => x.organisation_id === onb.organisation_id);
        return (
          <Card key={onb.id}>
            <CardHeader>
              <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                <Link className="underline" to={`/platform/clients/${onb.organisation_id}`}>
                  {onb.organisations?.legal_name ?? onb.organisations?.name}
                </Link>
                <StatusPill tone={onb.status === "submitted" ? "warn" : "neutral"}>{onb.status}</StatusPill>
                <span className="text-xs font-normal text-muted-foreground">{onb.provider_pathways?.name}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {reqs.length === 0 && <p className="text-sm text-muted-foreground">This pathway has no active requirements configured.</p>}
              {reqs.map((r) => {
                const a = answers.find((x) => x.requirement_key === r.requirement_key);
                const f = findings.find((x) => x.requirement_key === r.requirement_key);
                const doc = orgDocs.find((x) => x.requirement_key === r.requirement_key);
                const key = `${onb.id}:${r.requirement_key}`;
                const value =
                  a?.value_text ?? a?.value_date ?? (a?.value_number != null ? String(a.value_number) : null) ??
                  (typeof a?.value_bool === "boolean" ? String(a.value_bool) : null);
                return (
                  <div key={r.id} className="space-y-2 rounded-md border p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium">{r.label}{r.is_mandatory && " *"}</p>
                        <p className="text-xs text-muted-foreground">
                          {a?.is_masked ? maskSensitive(value, "sensitive") : (value ?? "No answer")} {doc ? `· document: ${doc.title}` : r.requires_document ? "· no document uploaded" : ""}
                        </p>
                      </div>
                      <StatusPill tone={f?.decision === "approved" ? "ok" : f?.decision === "returned" ? "bad" : "neutral"}>
                        {f?.decision ?? "not reviewed"}
                      </StatusPill>
                    </div>
                    <Textarea
                      aria-label={`Reviewer notes for ${r.label}`}
                      placeholder="Reviewer notes (required when returning)"
                      value={notes[key] ?? ""}
                      onChange={(e) => setNotes((n) => ({ ...n, [key]: e.target.value }))}
                    />
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" className="min-h-[44px]" disabled={decide.isPending}
                        onClick={() => decide.mutate({ onb, requirement_key: r.requirement_key, decision: "approved" })}>
                        Approve requirement
                      </Button>
                      <Button size="sm" variant="outline" className="min-h-[44px]" disabled={decide.isPending}
                        onClick={() => decide.mutate({ onb, requirement_key: r.requirement_key, decision: "returned" })}>
                        Return requirement
                      </Button>
                    </div>
                  </div>
                );
              })}

              <div className="flex flex-wrap gap-2 pt-2">
                <Button className="min-h-[44px]" disabled={finalise.isPending}
                  onClick={() => finalise.mutate({ organisation_id: onb.organisation_id, action: "approve_onboarding" })}>
                  Approve and activate tenant
                </Button>
                <Button variant="outline" className="min-h-[44px]" disabled={finalise.isPending}
                  onClick={() => finalise.mutate({
                    organisation_id: onb.organisation_id,
                    action: "return_onboarding",
                    reason: notes[`return:${onb.id}`] ?? "",
                  })}>
                  Return whole submission
                </Button>
                <Textarea
                  aria-label="Reason for returning the submission"
                  className="w-full"
                  placeholder="Reason for returning the whole submission"
                  value={notes[`return:${onb.id}`] ?? ""}
                  onChange={(e) => setNotes((n) => ({ ...n, [`return:${onb.id}`]: e.target.value }))}
                />
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
