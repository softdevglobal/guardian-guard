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
import { Plus, Lock } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";

const statusColors: Record<string, string> = {
  detected: "bg-info text-info-foreground",
  contained: "bg-warning text-warning-foreground",
  assessed: "bg-warning text-warning-foreground",
  actioned: "bg-success text-success-foreground",
  closed: "bg-muted text-muted-foreground",
};

const INITIAL_FORM = {
  incident_type: "unauthorised_access",
  breach_description: "",
  containment_action: "",
  risk_rating: "medium",
  notification_required: false,
  data_type_involved: [] as string[],
  affected_records_count: 0,
};

export default function Privacy() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(INITIAL_FORM);
  const [selected, setSelected] = useState<any>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const { data: incidents = [], isLoading } = useQuery({
    queryKey: ["privacy-incidents"],
    queryFn: async () => {
      const { data, error } = await supabase.from("privacy_incidents").select("*").eq("record_status", "active").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase.from("privacy_incidents").insert({
        incident_type: form.incident_type as any,
        breach_description: form.breach_description || null,
        containment_action: form.containment_action || null,
        risk_rating: form.risk_rating,
        notification_required: form.notification_required,
        affected_records_count: form.affected_records_count,
        detected_by: user.id,
        organisation_id: user.organisation_id!,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["privacy-incidents"] });
      setDialogOpen(false);
      setForm(INITIAL_FORM);
      toast({ title: "Privacy incident reported" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const set = (key: string, val: any) => setForm((f) => ({ ...f, [key]: val }));
  const openCount = incidents.filter((i) => !["actioned", "closed"].includes(i.status)).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Privacy & Data Protection</h1>
          <p className="text-muted-foreground">Track data breaches and privacy incidents</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild><Button className="touch-target"><Plus className="mr-2 h-4 w-4" />Report Privacy Incident</Button></DialogTrigger>
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Report Privacy Incident</DialogTitle></DialogHeader>
            <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); createMutation.mutate(); }}>
              <div className="space-y-2">
                <Label>Incident Type</Label>
                <Select value={form.incident_type} onValueChange={(v) => set("incident_type", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unauthorised_access">Unauthorised Access</SelectItem>
                    <SelectItem value="misdirected_email">Misdirected Email</SelectItem>
                    <SelectItem value="lost_device">Lost Device</SelectItem>
                    <SelectItem value="suspicious_login">Suspicious Login</SelectItem>
                    <SelectItem value="oversharing">Oversharing</SelectItem>
                    <SelectItem value="export_misuse">Export Misuse</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Risk Rating</Label>
                  <Select value={form.risk_rating} onValueChange={(v) => set("risk_rating", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="critical">Critical</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Affected Records</Label>
                  <Input type="number" min={0} value={form.affected_records_count} onChange={(e) => set("affected_records_count", Number(e.target.value))} />
                </div>
              </div>
              <div className="space-y-2"><Label>Breach Description *</Label><Textarea value={form.breach_description} onChange={(e) => set("breach_description", e.target.value)} rows={3} required /></div>
              <div className="space-y-2"><Label>Containment Action</Label><Textarea value={form.containment_action} onChange={(e) => set("containment_action", e.target.value)} rows={2} /></div>
              <div className="flex items-center justify-between">
                <Label>Notification Required?</Label>
                <Switch checked={form.notification_required} onCheckedChange={(v) => set("notification_required", v)} />
              </div>
              <Button type="submit" className="w-full" disabled={createMutation.isPending}>{createMutation.isPending ? "Submitting..." : "Report Incident"}</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <section aria-label="Privacy summary" className="grid gap-4 sm:grid-cols-2">
        <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Open Incidents</CardTitle><Lock className="h-4 w-4 text-destructive" aria-hidden /></CardHeader><CardContent><div className="text-2xl font-bold">{openCount}</div></CardContent></Card>
        <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Total Incidents</CardTitle><Lock className="h-4 w-4 text-muted-foreground" aria-hidden /></CardHeader><CardContent><div className="text-2xl font-bold">{incidents.length}</div></CardContent></Card>
      </section>

      <Card>
        <CardHeader><CardTitle>All Privacy Incidents</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? <p className="text-center py-4 text-muted-foreground">Loading...</p> : incidents.length === 0 ? <p className="text-center py-4 text-muted-foreground">No privacy incidents found</p> : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Type</TableHead><TableHead>Risk Rating</TableHead><TableHead>Status</TableHead><TableHead>Records Affected</TableHead></TableRow></TableHeader>
                <TableBody>
                  {incidents.map((i) => (
                    <TableRow key={i.id} className="cursor-pointer hover:bg-muted/50" onClick={() => { setSelected(i); setSheetOpen(true); }}>
                      <TableCell className="text-sm">{format(new Date(i.date_detected), "PP")}</TableCell>
                      <TableCell className="capitalize text-sm">{i.incident_type.replace(/_/g, " ")}</TableCell>
                      <TableCell><Badge variant={i.risk_rating === "critical" || i.risk_rating === "high" ? "destructive" : "outline"} className="capitalize">{i.risk_rating ?? "medium"}</Badge></TableCell>
                      <TableCell><Badge className={`${statusColors[i.status] ?? ""} capitalize`}>{i.status.replace(/_/g, " ")}</Badge></TableCell>
                      <TableCell className="font-mono">{i.affected_records_count ?? 0}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          {selected && (
            <>
              <SheetHeader><SheetTitle>Privacy Incident Detail</SheetTitle></SheetHeader>
              <div className="mt-4 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div><p className="text-xs text-muted-foreground">Type</p><p className="text-sm capitalize">{selected.incident_type.replace(/_/g, " ")}</p></div>
                  <div><p className="text-xs text-muted-foreground">Risk Rating</p><Badge variant={selected.risk_rating === "critical" || selected.risk_rating === "high" ? "destructive" : "outline"} className="capitalize">{selected.risk_rating}</Badge></div>
                  <div><p className="text-xs text-muted-foreground">Status</p><Badge className={`${statusColors[selected.status] ?? ""} capitalize`}>{selected.status.replace(/_/g, " ")}</Badge></div>
                  <div><p className="text-xs text-muted-foreground">Records Affected</p><p className="text-sm">{selected.affected_records_count ?? 0}</p></div>
                  <div><p className="text-xs text-muted-foreground">Notification Required</p><p className="text-sm">{selected.notification_required ? "Yes" : "No"}</p></div>
                  <div><p className="text-xs text-muted-foreground">Date Detected</p><p className="text-sm">{format(new Date(selected.date_detected), "PP")}</p></div>
                </div>
                <Separator />
                <div><p className="text-xs text-muted-foreground">Description</p><p className="text-sm whitespace-pre-wrap">{selected.breach_description ?? "—"}</p></div>
                {selected.containment_action && <div><p className="text-xs text-muted-foreground">Containment Action</p><p className="text-sm whitespace-pre-wrap">{selected.containment_action}</p></div>}
                {selected.corrective_action && <div><p className="text-xs text-muted-foreground">Corrective Action</p><p className="text-sm whitespace-pre-wrap">{selected.corrective_action}</p></div>}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
