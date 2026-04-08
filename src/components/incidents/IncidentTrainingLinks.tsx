import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { GraduationCap, Plus, Loader2 } from "lucide-react";
import { format } from "date-fns";

interface Props {
  incidentId: string;
  organisationId: string;
}

export function IncidentTrainingLinks({ incidentId, organisationId }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ staff_id: "", training_code: "" });

  const { data: links = [] } = useQuery({
    queryKey: ["incident-training-links", incidentId],
    queryFn: async () => {
      const { data } = await supabase
        .from("incident_training_links" as any)
        .select("*")
        .eq("incident_id", incidentId)
        .order("assigned_at", { ascending: false });
      return (data ?? []) as any[];
    },
  });

  const { data: staffList = [] } = useQuery({
    queryKey: ["staff-list-training"],
    queryFn: async () => {
      const { data } = await supabase.from("user_profiles").select("id, full_name").limit(100);
      return data ?? [];
    },
  });

  const assignMutation = useMutation({
    mutationFn: async () => {
      if (!user || !form.staff_id || !form.training_code) throw new Error("Select staff and training module");
      const { error } = await supabase.from("incident_training_links" as any).insert({
        incident_id: incidentId,
        staff_id: form.staff_id,
        training_code: form.training_code,
        assigned_by: user.id,
        organisation_id: organisationId,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["incident-training-links", incidentId] });
      setForm({ staff_id: "", training_code: "" });
      setShowForm(false);
      toast({ title: "Training assigned" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold flex items-center gap-2">
          <GraduationCap className="h-4 w-4" />
          Training Links ({links.length})
        </h4>
        <Button size="sm" variant="outline" onClick={() => setShowForm(!showForm)}>
          <Plus className="h-3 w-3 mr-1" />Assign Training
        </Button>
      </div>

      {showForm && (
        <Card className="border-dashed">
          <CardContent className="pt-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Staff Member</Label>
                <Select value={form.staff_id} onValueChange={v => setForm(f => ({ ...f, staff_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select staff" /></SelectTrigger>
                  <SelectContent>
                    {staffList.map(s => <SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Training Module</Label>
                <Input
                  placeholder="e.g. INC-MGMT-001"
                  value={form.training_code}
                  onChange={e => setForm(f => ({ ...f, training_code: e.target.value }))}
                />
              </div>
            </div>
            <Button size="sm" onClick={() => assignMutation.mutate()} disabled={assignMutation.isPending}>
              {assignMutation.isPending && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
              Assign
            </Button>
          </CardContent>
        </Card>
      )}

      {links.map((link: any) => {
        const staff = staffList.find(s => s.id === link.staff_id);
        return (
          <div key={link.id} className="flex items-center justify-between rounded-md border p-2 text-sm">
            <div className="flex items-center gap-2">
              <GraduationCap className="h-3.5 w-3.5 text-muted-foreground" />
              <span>{staff?.full_name ?? link.staff_id}</span>
              <span className="text-muted-foreground">→ {link.training_code}</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={link.status === "completed" ? "default" : "outline"} className="text-[10px]">
                {link.status}
              </Badge>
              {link.completed_at && (
                <span className="text-xs text-muted-foreground">{format(new Date(link.completed_at), "PP")}</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
