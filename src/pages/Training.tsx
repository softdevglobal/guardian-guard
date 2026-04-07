import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus, GraduationCap, Clock, CheckCircle, AlertTriangle } from "lucide-react";
import { toast } from "@/hooks/use-toast";

export default function Training() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ title: "", module_type: "mandatory", duration_hours: "", description: "" });

  const { data: modules = [], isLoading } = useQuery({
    queryKey: ["training-modules"],
    queryFn: async () => {
      const { data, error } = await supabase.from("training_modules").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase.from("training_modules").insert({
        title: form.title, module_type: form.module_type,
        duration_hours: form.duration_hours ? parseFloat(form.duration_hours) : null,
        description: form.description || null, organisation_id: user.organisation_id!,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["training-modules"] });
      setDialogOpen(false);
      setForm({ title: "", module_type: "mandatory", duration_hours: "", description: "" });
      toast({ title: "Module created" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const activeCount = modules.filter(m => m.status === "active").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Training Matrix</h1>
          <p className="text-muted-foreground">Competency mapping, enforcement logic, and auto re-certification</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild><Button className="touch-target"><Plus className="mr-2 h-4 w-4" />Add Module</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Training Module</DialogTitle></DialogHeader>
            <form className="space-y-4" onSubmit={e => { e.preventDefault(); createMutation.mutate(); }}>
              <div className="space-y-2"><Label>Title</Label><Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required /></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Type</Label>
                  <Select value={form.module_type} onValueChange={v => setForm(f => ({ ...f, module_type: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="mandatory">Mandatory</SelectItem><SelectItem value="elective">Elective</SelectItem></SelectContent></Select></div>
                <div className="space-y-2"><Label>Duration (hours)</Label><Input type="number" step="0.5" value={form.duration_hours} onChange={e => setForm(f => ({ ...f, duration_hours: e.target.value }))} /></div>
              </div>
              <div className="space-y-2"><Label>Description</Label><Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
              <Button type="submit" className="w-full" disabled={createMutation.isPending}>{createMutation.isPending ? "Creating..." : "Create Module"}</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Active Modules</CardTitle><GraduationCap className="h-4 w-4 text-primary" /></CardHeader><CardContent><div className="text-2xl font-bold">{activeCount}</div></CardContent></Card>
        <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Avg Completion</CardTitle><CheckCircle className="h-4 w-4 text-success" /></CardHeader><CardContent><div className="text-2xl font-bold">—</div></CardContent></Card>
        <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Overdue</CardTitle><AlertTriangle className="h-4 w-4 text-warning" /></CardHeader><CardContent><div className="text-2xl font-bold">—</div></CardContent></Card>
        <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Expiring (60 days)</CardTitle><Clock className="h-4 w-4 text-info" /></CardHeader><CardContent><div className="text-2xl font-bold">—</div></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Training Modules</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? <p className="text-center py-4 text-muted-foreground">Loading...</p> : modules.length === 0 ? <p className="text-center py-4 text-muted-foreground">No modules found</p> : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow><TableHead>Module</TableHead><TableHead>Type</TableHead><TableHead>Duration</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                <TableBody>
                  {modules.map(m => (
                    <TableRow key={m.id}>
                      <TableCell className="font-medium">{m.title}</TableCell>
                      <TableCell><Badge variant={m.module_type === "mandatory" ? "destructive" : "secondary"} className="capitalize">{m.module_type}</Badge></TableCell>
                      <TableCell>{m.duration_hours ? `${m.duration_hours} hrs` : "—"}</TableCell>
                      <TableCell><Badge variant={m.status === "active" ? "default" : "secondary"} className="capitalize">{m.status}</Badge></TableCell>
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
