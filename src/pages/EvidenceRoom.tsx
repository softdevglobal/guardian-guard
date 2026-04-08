import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, FileText, Users, ShieldAlert, MessageSquareWarning, GraduationCap, UserCog, HeartHandshake, Archive, Download } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { csvSafe, downloadCSV } from "@/lib/evidenceChainExport";
import { exportBulkIncidentsCSV } from "@/lib/incidentExport";
import { generateParticipantAuditPDF } from "@/lib/auditPdfExport";

interface ModuleCard {
  key: string;
  title: string;
  icon: any;
  table: string;
  description: string;
}

const MODULES: ModuleCard[] = [
  { key: "incidents", title: "Incidents", icon: AlertTriangle, table: "incidents", description: "All incident records, workflow history, and corrective actions" },
  { key: "complaints", title: "Complaints", icon: MessageSquareWarning, table: "complaints", description: "Complaints with workflow history and resolution records" },
  { key: "risks", title: "Risks", icon: ShieldAlert, table: "risks", description: "Risk register with mitigations and audit trail" },
  { key: "governance", title: "Governance", icon: FileText, table: "policies", description: "Policies, versions, acknowledgements, and approval records" },
  { key: "hr", title: "HR / Staff", icon: UserCog, table: "staff_compliance", description: "Staff compliance, certifications, and eligibility status" },
  { key: "training", title: "Training", icon: GraduationCap, table: "training_completions", description: "Training completions, verifications, and module records" },
  { key: "safeguarding", title: "Safeguarding", icon: HeartHandshake, table: "safeguarding_concerns", description: "Safeguarding concerns, escalations, and outcomes" },
];

async function generateModulePack(moduleKey: string): Promise<string> {
  let csv = "";

  if (moduleKey === "incidents") {
    const { data } = await supabase.from("incidents").select("*").eq("record_status", "active").order("created_at", { ascending: false });
    csv = exportBulkIncidentsCSV(data ?? []);
  } else if (moduleKey === "complaints") {
    const { data } = await supabase.from("complaints").select("*").eq("record_status", "active").order("created_at", { ascending: false });
    const headers = ["Number", "Subject", "Priority", "Status", "Category", "Source", "Created", "Resolved"];
    const rows = (data ?? []).map(c => [c.complaint_number, csvSafe(c.subject), c.priority, c.status, c.complaint_category ?? "", c.complaint_source ?? "", c.created_at, c.resolved_at ?? ""].join(","));
    csv = [headers.join(","), ...rows].join("\n");
  } else if (moduleKey === "risks") {
    const { data } = await supabase.from("risks").select("*").eq("record_status", "active").order("created_at", { ascending: false });
    const headers = ["Title", "Category", "Likelihood", "Impact", "Score", "Level", "Status", "Date Identified"];
    const rows = (data ?? []).map(r => [csvSafe(r.title), r.category, r.likelihood, r.impact, r.risk_score ?? "", r.risk_level ?? "", r.status, r.date_identified ?? ""].join(","));
    csv = [headers.join(","), ...rows].join("\n");
  } else if (moduleKey === "governance") {
    const { data } = await supabase.from("policies").select("*").eq("record_status", "active").order("created_at", { ascending: false });
    const headers = ["Title", "Category", "Version", "Status", "Effective Date", "Next Review", "Approved At"];
    const rows = (data ?? []).map(p => [csvSafe(p.title), p.category ?? "", `v${p.current_version}`, p.status, p.effective_date ?? "", p.next_review_date ?? "", p.approved_at ?? ""].join(","));
    csv = [headers.join(","), ...rows].join("\n");
  } else if (moduleKey === "hr") {
    const { data } = await supabase.from("staff_compliance").select("*, user_profiles:user_id(full_name)").order("updated_at", { ascending: false });
    const headers = ["Staff", "Police Check", "WWCC", "Worker Screening", "Compliance %", "Eligible"];
    const rows = (data ?? []).map((s: any) => [(s.user_profiles as any)?.full_name ?? "", s.police_check_status, s.wwcc_status, s.worker_screening_status, `${s.overall_compliance_pct ?? 0}%`, s.eligible_for_assignment ? "Yes" : "No"].join(","));
    csv = [headers.join(","), ...rows].join("\n");
  } else if (moduleKey === "training") {
    const { data } = await supabase.from("training_completions" as any).select("*").order("completion_date", { ascending: false });
    const headers = ["Training Code", "User ID", "Status", "Completion Date", "Score", "Expiry"];
    const rows = (data ?? []).map((t: any) => [t.training_code, t.user_id, t.status, t.completion_date ?? "", t.score ?? "", t.expiry_date ?? ""].join(","));
    csv = [headers.join(","), ...rows].join("\n");
  } else if (moduleKey === "safeguarding") {
    const { data } = await supabase.from("safeguarding_concerns").select("*").eq("record_status", "active").order("date_raised", { ascending: false });
    const headers = ["Type", "Status", "Date Raised", "Immediate Risk", "Escalation Level", "Source", "Outcome"];
    const rows = (data ?? []).map(s => [s.concern_type, s.status, s.date_raised, s.immediate_safety_risk ? "Yes" : "No", s.escalation_level ?? "", s.source, csvSafe(s.outcome)].join(","));
    csv = [headers.join(","), ...rows].join("\n");
  }

  return csv;
}

export default function EvidenceRoom() {
  const { user } = useAuth();
  const [generating, setGenerating] = useState<string | null>(null);

  const { data: counts = {} } = useQuery({
    queryKey: ["evidence-room-counts"],
    queryFn: async () => {
      const [incidents, complaints, risks, policies, safeguarding] = await Promise.all([
        supabase.from("incidents").select("id", { count: "exact", head: true }).eq("record_status", "active"),
        supabase.from("complaints").select("id", { count: "exact", head: true }).eq("record_status", "active"),
        supabase.from("risks").select("id", { count: "exact", head: true }).eq("record_status", "active"),
        supabase.from("policies").select("id", { count: "exact", head: true }).eq("record_status", "active"),
        supabase.from("safeguarding_concerns").select("id", { count: "exact", head: true }).eq("record_status", "active"),
      ]);
      return {
        incidents: incidents.count ?? 0,
        complaints: complaints.count ?? 0,
        risks: risks.count ?? 0,
        governance: policies.count ?? 0,
        safeguarding: safeguarding.count ?? 0,
      } as Record<string, number>;
    },
  });

  const handleExport = async (moduleKey: string) => {
    setGenerating(moduleKey);
    try {
      const csv = await generateModulePack(moduleKey);
      if (!csv) {
        toast({ title: "No data", description: "No records found for this module." });
        return;
      }
      downloadCSV(csv, `evidence-pack-${moduleKey}-${new Date().toISOString().split("T")[0]}.csv`);
      toast({ title: "Evidence pack downloaded", description: `${moduleKey} evidence exported successfully.` });
    } catch (err: any) {
      toast({ title: "Export failed", description: err.message, variant: "destructive" });
    } finally {
      setGenerating(null);
    }
  };

  const handleFullPack = async () => {
    setGenerating("full");
    try {
      const sections: string[] = [];
      for (const mod of MODULES) {
        const csv = await generateModulePack(mod.key);
        if (csv) {
          sections.push(`\n=== ${mod.title.toUpperCase()} ===\n`);
          sections.push(csv);
        }
      }
      downloadCSV(sections.join("\n"), `full-evidence-pack-${new Date().toISOString().split("T")[0]}.csv`);
      toast({ title: "Full evidence pack downloaded" });
    } catch (err: any) {
      toast({ title: "Export failed", description: err.message, variant: "destructive" });
    } finally {
      setGenerating(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Audit Evidence Room</h1>
          <p className="text-muted-foreground">One-click evidence packs for audit preparation</p>
        </div>
        <Button onClick={handleFullPack} disabled={generating === "full"} className="touch-target">
          <Archive className="mr-2 h-4 w-4" />
          {generating === "full" ? "Generating..." : "Full Evidence Pack"}
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {MODULES.map(mod => (
          <Card key={mod.key} className="hover:shadow-md transition-shadow">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <mod.icon className="h-5 w-5 text-primary" />
                  <CardTitle className="text-base">{mod.title}</CardTitle>
                </div>
                {counts[mod.key] !== undefined && (
                  <Badge variant="secondary">{counts[mod.key]} records</Badge>
                )}
              </div>
              <CardDescription className="text-xs">{mod.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => handleExport(mod.key)}
                disabled={generating === mod.key}
              >
                <Download className="mr-2 h-4 w-4" />
                {generating === mod.key ? "Generating..." : "Export Evidence Pack"}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
