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
import { Plus, Eye, EyeOff } from "lucide-react";
import { toast } from "@/hooks/use-toast";

const getRiskColor = (score: number) => {
  if (score >= 70) return "text-destructive";
  if (score >= 40) return "text-warning";
  return "text-success";
};

export default function Participants() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ first_name: "", last_name: "", email: "", phone: "" });

  const { data: participants = [], isLoading } = useQuery({
    queryKey: ["participants"],
    queryFn: async () => {
      const { data, error } = await supabase.from("participants").select("*").eq("record_status", "active").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase.from("participants").insert({
        first_name: form.first_name, last_name: form.last_name, email: form.email || null,
        phone: form.phone || null, organisation_id: user.organisation_id!, created_by: user.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["participants"] });
      setDialogOpen(false);
      setForm({ first_name: "", last_name: "", email: "", phone: "" });
      toast({ title: "Participant added" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const toggleReveal = async (id: string) => {
    if (!revealed.has(id) && user) {
      // Log the reveal
      await supabase.from("access_reveal_logs").insert({
        participant_id: id, user_id: user.id, field_accessed: "full_name",
        reason: "Operational access", access_granted: true,
      });
    }
    setRevealed(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const maskName = (first: string, last: string) => `${first} ${last.charAt(0)}.`;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Participant Profiles</h1>
          <p className="text-muted-foreground">Outcome tracking with sensitive data masking</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild><Button className="touch-target"><Plus className="mr-2 h-4 w-4" />Add Participant</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Participant</DialogTitle></DialogHeader>
            <form className="space-y-4" onSubmit={e => { e.preventDefault(); createMutation.mutate(); }}>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>First Name</Label><Input value={form.first_name} onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))} required /></div>
                <div className="space-y-2"><Label>Last Name</Label><Input value={form.last_name} onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))} required /></div>
              </div>
              <div className="space-y-2"><Label>Email</Label><Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
              <div className="space-y-2"><Label>Phone</Label><Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></div>
              <Button type="submit" className="w-full" disabled={createMutation.isPending}>{createMutation.isPending ? "Adding..." : "Add Participant"}</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader><CardTitle>All Participants</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? <p className="text-center py-4 text-muted-foreground">Loading...</p> : participants.length === 0 ? <p className="text-center py-4 text-muted-foreground">No participants found</p> : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Status</TableHead><TableHead>Email</TableHead><TableHead>Phone</TableHead><TableHead>Data Access</TableHead></TableRow></TableHeader>
                <TableBody>
                  {participants.map(p => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{revealed.has(p.id) ? `${p.first_name} ${p.last_name}` : maskName(p.first_name, p.last_name)}</TableCell>
                      <TableCell><Badge variant={p.status === "active" ? "default" : "secondary"} className="capitalize">{p.status}</Badge></TableCell>
                      <TableCell className="text-muted-foreground">{revealed.has(p.id) ? (p.email ?? "—") : "••••"}</TableCell>
                      <TableCell className="text-muted-foreground">{revealed.has(p.id) ? (p.phone ?? "—") : "••••"}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => toggleReveal(p.id)} className="touch-target" aria-label={revealed.has(p.id) ? "Mask data" : "Reveal data"}>
                          {revealed.has(p.id) ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </TableCell>
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
