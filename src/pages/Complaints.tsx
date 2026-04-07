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
import { Plus } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";

export default function Complaints() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ subject: "", description: "", priority: "medium" });

  const { data: complaints = [], isLoading } = useQuery({
    queryKey: ["complaints"],
    queryFn: async () => {
      const { data, error } = await supabase.from("complaints").select("*").eq("record_status", "active").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");
      const num = `CMP-${String(complaints.length + 1).padStart(3, "0")}`;
      const { error } = await supabase.from("complaints").insert({
        complaint_number: num, subject: form.subject, description: form.description,
        priority: form.priority, submitted_by: user.id, submitted_by_name: user.full_name,
        organisation_id: user.organisation_id!,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["complaints"] });
      setDialogOpen(false);
      setForm({ subject: "", description: "", priority: "medium" });
      toast({ title: "Complaint logged" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Complaints Management</h1>
          <p className="text-muted-foreground">Track, investigate, and resolve complaints</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild><Button className="touch-target"><Plus className="mr-2 h-4 w-4" />Log Complaint</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Log Complaint</DialogTitle></DialogHeader>
            <form className="space-y-4" onSubmit={e => { e.preventDefault(); createMutation.mutate(); }}>
              <div className="space-y-2"><Label>Subject</Label><Input value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} required /></div>
              <div className="space-y-2"><Label>Priority</Label>
                <Select value={form.priority} onValueChange={v => setForm(f => ({ ...f, priority: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="low">Low</SelectItem><SelectItem value="medium">Medium</SelectItem><SelectItem value="high">High</SelectItem></SelectContent></Select></div>
              <div className="space-y-2"><Label>Description</Label><Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} required /></div>
              <Button type="submit" className="w-full" disabled={createMutation.isPending}>{createMutation.isPending ? "Submitting..." : "Submit"}</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader><CardTitle>All Complaints</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? <p className="text-center py-4 text-muted-foreground">Loading...</p> : complaints.length === 0 ? <p className="text-center py-4 text-muted-foreground">No complaints found</p> : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow><TableHead>ID</TableHead><TableHead>Subject</TableHead><TableHead>Submitted By</TableHead><TableHead>Priority</TableHead><TableHead>Status</TableHead><TableHead>Date</TableHead></TableRow></TableHeader>
                <TableBody>
                  {complaints.map(c => (
                    <TableRow key={c.id}>
                      <TableCell className="font-mono text-sm">{c.complaint_number}</TableCell>
                      <TableCell className="font-medium">{c.subject}</TableCell>
                      <TableCell>{c.submitted_by_name ?? "Unknown"}</TableCell>
                      <TableCell><Badge variant={c.priority === "high" ? "destructive" : "outline"} className="capitalize">{c.priority}</Badge></TableCell>
                      <TableCell><Badge variant="secondary" className="capitalize">{c.status.replace(/_/g, " ")}</Badge></TableCell>
                      <TableCell className="text-muted-foreground">{format(new Date(c.created_at), "PP")}</TableCell>
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
