import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, FileText, AlertTriangle, Clock } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { format, differenceInDays, parseISO } from "date-fns";
import { logAudit } from "@/lib/auditLog";

const statusColor = (s: string) => {
  if (s === "published") return "bg-success text-success-foreground";
  if (s === "approved") return "bg-info text-info-foreground";
  if (s === "review") return "bg-warning text-warning-foreground";
  if (s === "archived") return "bg-muted text-muted-foreground";
  return "bg-secondary text-secondary-foreground";
};

const CATEGORIES = ["Governance", "Operations", "Safety", "Privacy", "Training", "HR", "Compliance", "Other"];

type PolicyRecord = any;

export default function Policies() {
  const { user, hasRole } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selected, setSelected] = useState<PolicyRecord | null>(null);

  // Form state
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [policyText, setPolicyText] = useState("");
  const [effectiveDate, setEffectiveDate] = useState("");
  const [nextReviewDate, setNextReviewDate] = useState("");
  const [staffAckRequired, setStaffAckRequired] = useState(false);
  const [ackDueDate, setAckDueDate] = useState("");

  const { data: policies = [], isLoading } = useQuery({
    queryKey: ["policies"],
    queryFn: async () => {
      const { data, error } = await supabase.from("policies").select("*").eq("record_status", "active").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: versions = [] } = useQuery({
    queryKey: ["policy-versions", selected?.id],
    enabled: !!selected,
    queryFn: async () => {
      const { data, error } = await supabase.from("policy_versions").select("*").eq("policy_id", selected!.id).order("version_number", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: acknowledgements = [] } = useQuery({
    queryKey: ["policy-acks", selected?.id],
    enabled: !!selected,
    queryFn: async () => {
      const { data, error } = await supabase.from("policy_acknowledgements").select("*, user_profiles:user_id(full_name)").eq("policy_id", selected!.id);
      if (error) throw error;
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase.from("policies").insert({
        title,
        organisation_id: user.organisation_id!,
        owner_id: user.id,
        category: category || null,
        policy_text: policyText || null,
        effective_date: effectiveDate || null,
        next_review_date: nextReviewDate || null,
        staff_acknowledgement_required: staffAckRequired,
        acknowledgement_due_date: ackDueDate || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["policies"] });
      setDialogOpen(false);
      setTitle(""); setCategory(""); setPolicyText(""); setEffectiveDate(""); setNextReviewDate(""); setStaffAckRequired(false); setAckDueDate("");
      toast({ title: "Policy created" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const updates: any = { status };
      if (status === "approved") updates.approved_at = new Date().toISOString();
      if (status === "approved" && user) updates.approved_by = user.id;
      if (status === "published") updates.published_at = new Date().toISOString();
      const { error } = await supabase.from("policies").update(updates).eq("id", id);
      if (error) throw error;
      if (user) await logAudit("policies", `status_changed_to_${status}`, id, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["policies"] });
      toast({ title: "Policy status updated" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const statusFlow: Record<string, string[]> = {
    draft: ["review"],
    review: ["approved", "draft"],
    approved: ["published"],
    published: ["archived"],
    archived: [],
  };

  const publishedCount = policies.filter(p => p.status === "published").length;
  const reviewCount = policies.filter(p => p.status === "review").length;
  const overdueCount = policies.filter(p => p.next_review_date && differenceInDays(parseISO(p.next_review_date), new Date()) < 0).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Policy Management</h1>
          <p className="text-muted-foreground">Version-controlled policies with approval workflows</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild><Button className="touch-target"><Plus className="mr-2 h-4 w-4" />Create Policy</Button></DialogTrigger>
          <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Create Policy</DialogTitle></DialogHeader>
            <form className="space-y-4" onSubmit={e => { e.preventDefault(); createMutation.mutate(); }}>
              <div className="space-y-2"><Label>Title *</Label><Input value={title} onChange={e => setTitle(e.target.value)} required /></div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                  <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Policy Text</Label><Textarea value={policyText} onChange={e => setPolicyText(e.target.value)} rows={6} placeholder="Enter policy content..." /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2"><Label>Effective Date</Label><Input type="date" value={effectiveDate} onChange={e => setEffectiveDate(e.target.value)} /></div>
                <div className="space-y-2"><Label>Next Review Date</Label><Input type="date" value={nextReviewDate} onChange={e => setNextReviewDate(e.target.value)} /></div>
              </div>
              <div className="flex items-center justify-between">
                <Label>Staff Acknowledgement Required</Label>
                <Switch checked={staffAckRequired} onCheckedChange={setStaffAckRequired} />
              </div>
              {staffAckRequired && (
                <div className="space-y-2"><Label>Acknowledgement Due Date</Label><Input type="date" value={ackDueDate} onChange={e => setAckDueDate(e.target.value)} /></div>
              )}
              <Button type="submit" className="w-full" disabled={createMutation.isPending}>Create Policy</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Published</CardTitle><FileText className="h-4 w-4 text-success" /></CardHeader><CardContent><div className="text-2xl font-bold">{publishedCount}</div></CardContent></Card>
        <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Under Review</CardTitle><Clock className="h-4 w-4 text-warning" /></CardHeader><CardContent><div className="text-2xl font-bold">{reviewCount}</div></CardContent></Card>
        <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Overdue Review</CardTitle><AlertTriangle className="h-4 w-4 text-destructive" /></CardHeader><CardContent><div className="text-2xl font-bold">{overdueCount}</div></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle>All Policies</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? <p className="text-center py-4 text-muted-foreground">Loading...</p> : policies.length === 0 ? <p className="text-center py-4 text-muted-foreground">No policies found</p> : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow><TableHead>Policy</TableHead><TableHead>Category</TableHead><TableHead>Version</TableHead><TableHead>Status</TableHead><TableHead>Next Review</TableHead></TableRow></TableHeader>
                <TableBody>
                  {policies.map(p => {
                    const overdue = p.next_review_date && differenceInDays(parseISO(p.next_review_date), new Date()) < 0;
                    return (
                      <TableRow key={p.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelected(p)}>
                        <TableCell className="font-medium">{p.title}</TableCell>
                        <TableCell><Badge variant="outline">{p.category ?? "—"}</Badge></TableCell>
                        <TableCell>v{p.current_version}</TableCell>
                        <TableCell><Badge className={`${statusColor(p.status)} capitalize`}>{p.status}</Badge></TableCell>
                        <TableCell>
                          {p.next_review_date ? (
                            <span className={overdue ? "text-destructive font-medium" : "text-muted-foreground"}>
                              {overdue && <AlertTriangle className="inline h-3 w-3 mr-1" />}
                              {p.next_review_date}
                            </span>
                          ) : "—"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail Sheet */}
      <Sheet open={!!selected} onOpenChange={open => { if (!open) setSelected(null); }}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle>{selected.title}</SheetTitle>
                <div className="flex items-center gap-2 mt-1">
                  <Badge className={`${statusColor(selected.status)} capitalize`}>{selected.status}</Badge>
                  <Badge variant="outline">v{selected.current_version}</Badge>
                  {selected.category && <Badge variant="secondary">{selected.category}</Badge>}
                </div>
              </SheetHeader>

              <Tabs defaultValue="details" className="mt-6">
                <TabsList className="w-full"><TabsTrigger value="details" className="flex-1">Details</TabsTrigger><TabsTrigger value="versions" className="flex-1">Versions</TabsTrigger><TabsTrigger value="ack" className="flex-1">Acknowledgements</TabsTrigger></TabsList>

                <TabsContent value="details" className="space-y-4 mt-4">
                  {/* Workflow Actions */}
                  {statusFlow[selected.status]?.length > 0 && (
                    <div className="flex gap-2">
                      {statusFlow[selected.status].map(nextStatus => (
                        <Button
                          key={nextStatus}
                          size="sm"
                          variant={nextStatus === "draft" ? "outline" : "default"}
                          onClick={() => {
                            updateStatusMutation.mutate({ id: selected.id, status: nextStatus });
                            setSelected({ ...selected, status: nextStatus });
                          }}
                        >
                          Move to {nextStatus.replace(/_/g, " ")}
                        </Button>
                      ))}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div><span className="text-muted-foreground">Effective Date</span><p className="font-medium">{selected.effective_date ?? "—"}</p></div>
                    <div><span className="text-muted-foreground">Next Review</span><p className="font-medium">{selected.next_review_date ?? "—"}</p></div>
                    <div><span className="text-muted-foreground">Last Review</span><p className="font-medium">{selected.last_review_date ?? "—"}</p></div>
                    <div><span className="text-muted-foreground">Staff Ack Required</span><p className="font-medium">{selected.staff_acknowledgement_required ? "Yes" : "No"}</p></div>
                  </div>

                  <Separator />

                  {selected.policy_text && (
                    <div>
                      <h3 className="text-sm font-semibold mb-2">Policy Text</h3>
                      <div className="rounded-lg border p-4 text-sm whitespace-pre-wrap bg-muted/30 max-h-96 overflow-y-auto">{selected.policy_text}</div>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="versions" className="mt-4">
                  {versions.length === 0 ? <p className="text-center py-4 text-muted-foreground">No version history yet</p> : (
                    <div className="space-y-3">
                      {versions.map(v => (
                        <div key={v.id} className="rounded-lg border p-3">
                          <div className="flex items-center justify-between mb-1">
                            <Badge variant="outline">v{v.version_number}</Badge>
                            <span className="text-xs text-muted-foreground">{format(new Date(v.created_at), "PPp")}</span>
                          </div>
                          {v.change_summary && <p className="text-sm text-muted-foreground">{v.change_summary}</p>}
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="ack" className="mt-4">
                  {acknowledgements.length === 0 ? <p className="text-center py-4 text-muted-foreground">No acknowledgements yet</p> : (
                    <Table>
                      <TableHeader><TableRow><TableHead>Staff</TableHead><TableHead>Acknowledged</TableHead><TableHead>Due</TableHead></TableRow></TableHeader>
                      <TableBody>
                        {acknowledgements.map(a => (
                          <TableRow key={a.id}>
                            <TableCell>{(a.user_profiles as any)?.full_name ?? "Unknown"}</TableCell>
                            <TableCell>{a.acknowledged_at ? format(new Date(a.acknowledged_at), "PP") : <Badge variant="outline">Pending</Badge>}</TableCell>
                            <TableCell className="text-muted-foreground">{a.due_date ?? "—"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </TabsContent>
              </Tabs>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
