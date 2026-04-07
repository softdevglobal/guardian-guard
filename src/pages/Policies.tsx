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
import { Plus, FileText } from "lucide-react";
import { toast } from "@/hooks/use-toast";

const statusColor = (s: string) => {
  if (s === "published") return "bg-success text-success-foreground";
  if (s === "approved") return "bg-info text-info-foreground";
  if (s === "review") return "bg-warning text-warning-foreground";
  return "bg-muted text-muted-foreground";
};

export default function Policies() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [title, setTitle] = useState("");

  const { data: policies = [], isLoading } = useQuery({
    queryKey: ["policies"],
    queryFn: async () => {
      const { data, error } = await supabase.from("policies").select("*").eq("record_status", "active").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase.from("policies").insert({
        title, organisation_id: user.organisation_id!, owner_id: user.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["policies"] });
      setDialogOpen(false); setTitle("");
      toast({ title: "Policy created" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const publishedCount = policies.filter(p => p.status === "published").length;
  const reviewCount = policies.filter(p => p.status === "review").length;
  const draftCount = policies.filter(p => p.status === "draft").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Policy Management</h1>
          <p className="text-muted-foreground">Version-controlled policies with approval workflows</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild><Button className="touch-target"><Plus className="mr-2 h-4 w-4" />Create Policy</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create Policy</DialogTitle></DialogHeader>
            <form className="space-y-4" onSubmit={e => { e.preventDefault(); createMutation.mutate(); }}>
              <div className="space-y-2"><Label>Policy Title</Label><Input value={title} onChange={e => setTitle(e.target.value)} required /></div>
              <Button type="submit" className="w-full" disabled={createMutation.isPending}>{createMutation.isPending ? "Creating..." : "Create"}</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Published</CardTitle><FileText className="h-4 w-4 text-success" /></CardHeader><CardContent><div className="text-2xl font-bold">{publishedCount}</div></CardContent></Card>
        <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Under Review</CardTitle><FileText className="h-4 w-4 text-warning" /></CardHeader><CardContent><div className="text-2xl font-bold">{reviewCount}</div></CardContent></Card>
        <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Draft</CardTitle><FileText className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{draftCount}</div></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle>All Policies</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? <p className="text-center py-4 text-muted-foreground">Loading...</p> : policies.length === 0 ? <p className="text-center py-4 text-muted-foreground">No policies found</p> : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow><TableHead>Policy</TableHead><TableHead>Version</TableHead><TableHead>Status</TableHead><TableHead>Last Review</TableHead><TableHead>Next Review</TableHead></TableRow></TableHeader>
                <TableBody>
                  {policies.map(p => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.title}</TableCell>
                      <TableCell>v{p.current_version}</TableCell>
                      <TableCell><Badge className={`${statusColor(p.status)} capitalize`}>{p.status}</Badge></TableCell>
                      <TableCell className="text-muted-foreground">{p.last_review_date ?? "N/A"}</TableCell>
                      <TableCell className="text-muted-foreground">{p.next_review_date ?? "N/A"}</TableCell>
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
