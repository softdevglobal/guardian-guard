import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, ShieldAlert } from "lucide-react";
import { toast } from "@/hooks/use-toast";

export default function Risks() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ title: "", category: "operational", likelihood: "medium", impact: "medium", description: "" });

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
      const { error } = await supabase.from("risks").insert({
        title: form.title, category: form.category, likelihood: form.likelihood, impact: form.impact,
        description: form.description, created_by: user.id, organisation_id: user.organisation_id!,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["risks"] });
      setDialogOpen(false);
      setForm({ title: "", category: "operational", likelihood: "medium", impact: "medium", description: "" });
      toast({ title: "Risk added" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const openCount = risks.filter(r => r.status === "open").length;
  const mitigatingCount = risks.filter(r => r.status === "mitigating").length;
  const resolvedCount = risks.filter(r => r.status === "resolved").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Risk Register</h1>
          <p className="text-muted-foreground">Identify, assess, and mitigate compliance risks</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild><Button className="touch-target"><Plus className="mr-2 h-4 w-4" />Add Risk</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Risk</DialogTitle></DialogHeader>
            <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); createMutation.mutate(); }}>
              <div className="space-y-2"><Label>Title</Label><Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required /></div>
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-2"><Label>Category</Label>
                  <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="operational">Operational</SelectItem><SelectItem value="digital_security">Digital Security</SelectItem><SelectItem value="privacy">Privacy</SelectItem><SelectItem value="workforce">Workforce</SelectItem></SelectContent></Select></div>
                <div className="space-y-2"><Label>Likelihood</Label>
                  <Select value={form.likelihood} onValueChange={v => setForm(f => ({ ...f, likelihood: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="low">Low</SelectItem><SelectItem value="medium">Medium</SelectItem><SelectItem value="high">High</SelectItem></SelectContent></Select></div>
                <div className="space-y-2"><Label>Impact</Label>
                  <Select value={form.impact} onValueChange={v => setForm(f => ({ ...f, impact: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="low">Low</SelectItem><SelectItem value="medium">Medium</SelectItem><SelectItem value="high">High</SelectItem><SelectItem value="critical">Critical</SelectItem></SelectContent></Select></div>
              </div>
              <div className="space-y-2"><Label>Description</Label><Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
              <Button type="submit" className="w-full" disabled={createMutation.isPending}>{createMutation.isPending ? "Saving..." : "Add Risk"}</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <section aria-label="Risk summary" className="grid gap-4 sm:grid-cols-3">
        <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Open Risks</CardTitle><ShieldAlert className="h-4 w-4 text-destructive" /></CardHeader><CardContent><div className="text-2xl font-bold">{openCount}</div></CardContent></Card>
        <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Mitigating</CardTitle><ShieldAlert className="h-4 w-4 text-warning" /></CardHeader><CardContent><div className="text-2xl font-bold">{mitigatingCount}</div></CardContent></Card>
        <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Resolved</CardTitle><ShieldAlert className="h-4 w-4 text-success" /></CardHeader><CardContent><div className="text-2xl font-bold">{resolvedCount}</div></CardContent></Card>
      </section>

      <Card>
        <CardHeader><CardTitle>All Risks</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? <p className="text-center py-4 text-muted-foreground">Loading...</p> : risks.length === 0 ? <p className="text-center py-4 text-muted-foreground">No risks found</p> : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow><TableHead>Title</TableHead><TableHead>Category</TableHead><TableHead>Likelihood</TableHead><TableHead>Impact</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                <TableBody>
                  {risks.map(r => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.title}</TableCell>
                      <TableCell className="capitalize">{r.category}</TableCell>
                      <TableCell><Badge variant={r.likelihood === "high" ? "destructive" : "outline"} className="capitalize">{r.likelihood}</Badge></TableCell>
                      <TableCell><Badge variant={r.impact === "critical" || r.impact === "high" ? "destructive" : "outline"} className="capitalize">{r.impact}</Badge></TableCell>
                      <TableCell><Badge variant="secondary" className="capitalize">{r.status}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
