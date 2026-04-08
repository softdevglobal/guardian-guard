import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { CheckCircle, Clock, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { useState } from "react";

interface Props {
  recordType: string;
  recordId: string;
  organisationId: string;
}

export function ApprovalStatus({ recordType, recordId, organisationId }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [notes, setNotes] = useState("");

  const { data: approvals = [] } = useQuery({
    queryKey: ["approvals", recordType, recordId],
    queryFn: async () => {
      const { data } = await supabase
        .from("approvals" as any)
        .select("*")
        .eq("record_type", recordType)
        .eq("record_id", recordId)
        .order("created_at", { ascending: true });
      return (data ?? []) as any[];
    },
  });

  const canApprove = user && ["super_admin", "compliance_officer", "supervisor"].includes(user.role);

  const approveMutation = useMutation({
    mutationFn: async () => {
      if (!user) return;
      const pending = approvals.find((a: any) => a.status === "pending");
      if (pending) {
        await supabase.from("approvals" as any).update({
          approved_by: user.id,
          approved_at: new Date().toISOString(),
          status: "approved",
          notes: notes || null,
        } as any).eq("id", pending.id);
      } else {
        await supabase.from("approvals" as any).insert({
          record_type: recordType,
          record_id: recordId,
          required_role: user.role,
          approved_by: user.id,
          approved_at: new Date().toISOString(),
          status: "approved",
          notes: notes || null,
          organisation_id: organisationId,
        } as any);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["approvals", recordType, recordId] });
      setNotes("");
      toast({ title: "Approval recorded" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const pendingCount = approvals.filter((a: any) => a.status === "pending").length;
  const approvedCount = approvals.filter((a: any) => a.status === "approved").length;

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-semibold flex items-center gap-2">
        Approvals
        {pendingCount > 0 && <Badge variant="outline" className="text-warning text-[10px]">{pendingCount} pending</Badge>}
        {approvedCount > 0 && <Badge variant="outline" className="text-success text-[10px]">{approvedCount} approved</Badge>}
      </h4>

      {approvals.map((a: any) => (
        <div key={a.id} className="flex items-center gap-2 text-sm">
          {a.status === "approved" ? (
            <CheckCircle className="h-3.5 w-3.5 text-success shrink-0" />
          ) : (
            <Clock className="h-3.5 w-3.5 text-warning shrink-0" />
          )}
          <span className="capitalize">{a.required_role?.replace(/_/g, " ")}</span>
          {a.status === "approved" && a.approved_at && (
            <span className="text-xs text-muted-foreground">
              — approved {format(new Date(a.approved_at), "PP")}
            </span>
          )}
          {a.status === "pending" && <span className="text-xs text-warning">Awaiting approval</span>}
        </div>
      ))}

      {canApprove && (
        <Card className="border-dashed">
          <CardContent className="pt-3 space-y-2">
            <Textarea
              placeholder="Approval notes (optional)"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              className="text-sm"
            />
            <Button size="sm" onClick={() => approveMutation.mutate()} disabled={approveMutation.isPending}>
              {approveMutation.isPending && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
              <CheckCircle className="h-3 w-3 mr-1" />
              Record Approval
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
