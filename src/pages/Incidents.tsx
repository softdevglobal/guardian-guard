import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Search, AlertTriangle, Filter } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import type { Tables } from "@/integrations/supabase/types";

type Incident = Tables<"incidents">;

const statusColors: Record<string, string> = {
  reported: "bg-info text-info-foreground",
  review: "bg-warning text-warning-foreground",
  investigating: "bg-destructive text-destructive-foreground",
  actioned: "bg-success text-success-foreground",
  closed: "bg-muted text-muted-foreground",
};

const severityVariant = (s: string) => {
  if (s === "critical" || s === "high") return "destructive" as const;
  if (s === "medium") return "outline" as const;
  return "secondary" as const;
};

export default function Incidents() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState({ title: "", type: "participant", injury: "no", description: "" });

  const { data: incidents = [], isLoading } = useQuery({
    queryKey: ["incidents"],
    queryFn: async () => {
      const { data, error } = await supabase.from("incidents").select("*").eq("record_status", "active").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");
      const incNumber = `INC-${String(incidents.length + 1).padStart(3, "0")}`;
      const isReportable = formData.injury === "yes" && formData.type === "participant";
      const { error } = await supabase.from("incidents").insert({
        incident_number: incNumber,
        title: formData.title,
        incident_type: formData.type,
        description: formData.description,
        injury_involved: formData.injury === "yes",
        is_reportable: isReportable,
        severity: isReportable ? "high" : "medium",
        reported_by: user.id,
        organisation_id: user.organisation_id!,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["incidents"] });
      setDialogOpen(false);
      setFormData({ title: "", type: "participant", injury: "no", description: "" });
      toast({ title: "Incident reported", description: "The incident has been logged successfully." });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const filtered = incidents.filter((inc) => {
    const matchesSearch = inc.title.toLowerCase().includes(searchTerm.toLowerCase()) || inc.incident_number.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || inc.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Incident Management</h1>
          <p className="text-muted-foreground">Smart classification & NDIS-compliant incident tracking</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="touch-target"><Plus className="mr-2 h-4 w-4" aria-hidden="true" />Report Incident</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Report New Incident</DialogTitle></DialogHeader>
            <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); createMutation.mutate(); }}>
              <div className="space-y-2">
                <Label htmlFor="inc-title">Incident Title</Label>
                <Input id="inc-title" value={formData.title} onChange={(e) => setFormData(f => ({ ...f, title: e.target.value }))} required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Incident Type</Label>
                  <Select value={formData.type} onValueChange={(v) => setFormData(f => ({ ...f, type: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="participant">Participant-related</SelectItem>
                      <SelectItem value="environmental">Environmental</SelectItem>
                      <SelectItem value="complaint">Complaint-related</SelectItem>
                      <SelectItem value="operational">Operational</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Injury Involved?</Label>
                  <Select value={formData.injury} onValueChange={(v) => setFormData(f => ({ ...f, injury: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="yes">Yes</SelectItem>
                      <SelectItem value="no">No</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="inc-desc">Full Description</Label>
                <Textarea id="inc-desc" value={formData.description} onChange={(e) => setFormData(f => ({ ...f, description: e.target.value }))} rows={4} required />
              </div>
              {formData.injury === "yes" && formData.type === "participant" && (
                <div className="rounded-md bg-warning/10 border border-warning/30 p-3">
                  <p className="text-sm font-medium flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-warning" aria-hidden="true" />
                    Auto-classified as NDIS Reportable
                  </p>
                </div>
              )}
              <Button type="submit" className="w-full touch-target" disabled={createMutation.isPending}>
                {createMutation.isPending ? "Submitting..." : "Submit Incident Report"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <Input placeholder="Search incidents..." className="pl-9" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} aria-label="Search incidents" />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-48" aria-label="Filter by status">
                <Filter className="mr-2 h-4 w-4" aria-hidden="true" /><SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="reported">Reported</SelectItem>
                <SelectItem value="review">Under Review</SelectItem>
                <SelectItem value="investigating">Investigating</SelectItem>
                <SelectItem value="actioned">Actioned</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Incidents ({filtered.length})</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground text-center py-4">Loading...</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No incidents found</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Severity</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Reportable</TableHead>
                    <TableHead>Reported</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((inc) => (
                    <TableRow key={inc.id} className="cursor-pointer hover:bg-muted/50">
                      <TableCell className="font-mono text-sm">{inc.incident_number}</TableCell>
                      <TableCell className="font-medium max-w-[200px] truncate">{inc.title}</TableCell>
                      <TableCell className="text-sm capitalize">{inc.incident_type}</TableCell>
                      <TableCell><Badge variant={severityVariant(inc.severity)} className="capitalize">{inc.severity}</Badge></TableCell>
                      <TableCell><Badge className={`${statusColors[inc.status] ?? ""} capitalize`}>{inc.status}</Badge></TableCell>
                      <TableCell>{inc.is_reportable ? <Badge variant="destructive">NDIS Reportable</Badge> : <span className="text-sm text-muted-foreground">No</span>}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{format(new Date(inc.created_at), "PPp")}</TableCell>
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
