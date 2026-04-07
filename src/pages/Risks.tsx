import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Plus, ShieldAlert } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";

const RISK_CATEGORIES = [
  { value: "participant_safety", label: "Participant Safety" },
  { value: "workforce", label: "Workforce" },
  { value: "digital_platform", label: "Digital Platform" },
  { value: "privacy", label: "Privacy" },
  { value: "compliance", label: "Compliance" },
  { value: "operational", label: "Operational" },
  { value: "financial", label: "Financial" },
  { value: "reputational", label: "Reputational" },
];

function getRiskLevel(score: number) {
  if (score >= 16) return "Critical";
  if (score >= 10) return "High";
  if (score >= 5) return "Medium";
  return "Low";
}

function getRiskBadgeVariant(level: string) {
  if (level === "Critical") return "destructive" as const;
  if (level === "High") return "destructive" as const;
  if (level === "Medium") return "outline" as const;
  return "secondary" as const;
}

const INITIAL_FORM = {
  title: "", category: "operational", description: "",
  likelihood_score: 2, impact_score: 2,
  existing_controls: "", escalation_required: false,
  review_date: "",
};

export default function Risks() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(INITIAL_FORM);
  const [selected, setSelected] = useState<any>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const { data: risks = [], isLoading } = useQuery({
    queryKey: ["risks"],
    queryFn: async () => {
      const { data, error } = await supabase.from("risks").select("*").eq("record_status", "active").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");
      const score = form.likelihood_score * form.impact_score;
      const { error } = await supabase.from("risks").insert({
        title: form.title,
        category: form.category,
        description: form.description,
        likelihood: form.likelihood_score <= 2 ? "low" : form.likelihood_score <= 3 ? "medium" : "high",
        impact: form.impact_score <= 2 ? "low" : form.impact_score <= 3 ? "medium" : form.impact_score <= 4 ? "high" : "critical",
        likelihood_score: form.likelihood_score,
        impact_score: form.impact_score,
        risk_level: getRiskLevel(score),
        existing_controls: form.existing_controls || null,
        escalation_required: form.escalation_required,
        review_date: form.review_date || null,
        date_identified: new Date().toISOString().split("T")[0],
        created_by: user.id,
        organisation_id: user.organisation_id!,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["risks"] });
      setDialogOpen(false);
      setForm(INITIAL_FORM);
      toast({ title: "Risk added" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const set = (key: string, val: any) => setForm((f) => ({ ...f, [key]: val }));
  const riskScore = form.likelihood_score * form.impact_score;

  const openCount = risks.filter((r) => r.status === "open").length;
  const mitigatingCount = risks.filter((r) => r.status === "mitigating").length;
  const closedCount = risks.filter((r) => ["closed", "resolved"].includes(r.status)).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Risk Register</h1>
          <p className="text-muted-foreground">Identify, assess, and mitigate compliance risks</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild><Button className="touch-target"><Plus className="mr-2 h-4 w-4" />Add Risk</Button></DialogTrigger>
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Add Risk</DialogTitle></DialogHeader>
            <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); createMutation.mutate(); }}>
              <div className="space-y-2"><Label>Title *</Label><Input value={form.title} onChange={(e) => set("title", e.target.value)} required /></div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={form.category} onValueChange={(v) => set("category", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{RISK_CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Likelihood (1-5): {form.likelihood_score}</Label>
                  <Input type="range" min={1} max={5} value={form.likelihood_score} onChange={(e) => set("likelihood_score", Number(e.target.value))} />
                </div>
                <div className="space-y-2">
                  <Label>Impact (1-5): {form.impact_score}</Label>
                  <Input type="range" min={1} max={5} value={form.impact_score} onChange={(e) => set("impact_score", Number(e.target.value))} />
                </div>
              </div>
              <div className="rounded-md bg-muted p-3 text-center">
                <p className="text-sm">Risk Score: <strong>{riskScore}</strong> — <Badge variant={getRiskBadgeVariant(getRiskLevel(riskScore))}>{getRiskLevel(riskScore)}</Badge></p>
              </div>
              <div className="space-y-2"><Label>Description</Label><Textarea value={form.description} onChange={(e) => set("description", e.target.value)} /></div>
              <div className="space-y-2"><Label>Existing Controls</Label><Textarea value={form.existing_controls} onChange={(e) => set("existing_controls", e.target.value)} /></div>
              <div className="space-y-2"><Label>Review Date</Label><Input type="date" value={form.review_date} onChange={(e) => set("review_date", e.target.value)} /></div>
              <div className="flex items-center justify-between">
                <Label>Escalation Required?</Label>
                <Switch checked={form.escalation_required} onCheckedChange={(v) => set("escalation_required", v)} />
              </div>
              <Button type="submit" className="w-full" disabled={createMutation.isPending}>{createMutation.isPending ? "Saving..." : "Add Risk"}</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <section aria-label="Risk summary" className="grid gap-4 sm:grid-cols-3">
        <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Open Risks</CardTitle><ShieldAlert className="h-4 w-4 text-destructive" aria-hidden /></CardHeader><CardContent><div className="text-2xl font-bold">{openCount}</div></CardContent></Card>
        <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Mitigating</CardTitle><ShieldAlert className="h-4 w-4 text-warning" aria-hidden /></CardHeader><CardContent><div className="text-2xl font-bold">{mitigatingCount}</div></CardContent></Card>
        <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Closed</CardTitle><ShieldAlert className="h-4 w-4 text-success" aria-hidden /></CardHeader><CardContent><div className="text-2xl font-bold">{closedCount}</div></CardContent></Card>
      </section>

      <Card>
        <CardHeader><CardTitle>All Risks</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? <p className="text-center py-4 text-muted-foreground">Loading...</p> : risks.length === 0 ? <p className="text-center py-4 text-muted-foreground">No risks found</p> : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow><TableHead>Title</TableHead><TableHead>Category</TableHead><TableHead>Score</TableHead><TableHead>Level</TableHead><TableHead>Status</TableHead><TableHead>Review Date</TableHead></TableRow></TableHeader>
                <TableBody>
                  {risks.map((r) => {
                    const score = (r as any).risk_score ?? 0;
                    const level = (r as any).risk_level ?? getRiskLevel(score);
                    return (
                      <TableRow key={r.id} className="cursor-pointer hover:bg-muted/50" onClick={() => { setSelected(r); setSheetOpen(true); }}>
                        <TableCell className="font-medium">{r.title}</TableCell>
                        <TableCell className="capitalize">{r.category.replace(/_/g, " ")}</TableCell>
                        <TableCell className="font-mono">{score}</TableCell>
                        <TableCell><Badge variant={getRiskBadgeVariant(level)}>{level}</Badge></TableCell>
                        <TableCell><Badge variant="secondary" className="capitalize">{r.status}</Badge></TableCell>
                        <TableCell className="text-sm text-muted-foreground">{(r as any).review_date ? format(new Date((r as any).review_date), "PP") : "—"}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Risk Detail Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle>{selected.title}</SheetTitle>
              </SheetHeader>
              <div className="mt-4 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div><p className="text-xs text-muted-foreground">Category</p><p className="text-sm capitalize">{selected.category.replace(/_/g, " ")}</p></div>
                  <div><p className="text-xs text-muted-foreground">Status</p><Badge variant="secondary" className="capitalize">{selected.status}</Badge></div>
                  <div><p className="text-xs text-muted-foreground">Risk Score</p><p className="text-sm font-mono">{(selected as any).risk_score ?? "—"}</p></div>
                  <div><p className="text-xs text-muted-foreground">Risk Level</p><Badge variant={getRiskBadgeVariant((selected as any).risk_level ?? "")}>{(selected as any).risk_level ?? "—"}</Badge></div>
                  <div><p className="text-xs text-muted-foreground">Likelihood</p><p className="text-sm">{(selected as any).likelihood_score ?? selected.likelihood}</p></div>
                  <div><p className="text-xs text-muted-foreground">Impact</p><p className="text-sm">{(selected as any).impact_score ?? selected.impact}</p></div>
                  <div><p className="text-xs text-muted-foreground">Escalation Required</p><p className="text-sm">{(selected as any).escalation_required ? "Yes" : "No"}</p></div>
                  <div><p className="text-xs text-muted-foreground">Review Date</p><p className="text-sm">{(selected as any).review_date ? format(new Date((selected as any).review_date), "PP") : "—"}</p></div>
                </div>
                <Separator />
                <div><p className="text-xs text-muted-foreground">Description</p><p className="text-sm whitespace-pre-wrap">{selected.description ?? "—"}</p></div>
                {(selected as any).existing_controls && (
                  <div><p className="text-xs text-muted-foreground">Existing Controls</p><p className="text-sm whitespace-pre-wrap">{(selected as any).existing_controls}</p></div>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
