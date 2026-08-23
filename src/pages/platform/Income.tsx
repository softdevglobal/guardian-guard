import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { BlockerAlert, EmptyState, ErrorState, LoadingState, PageHeading, StatusPill } from "@/components/compliance/GateUI";
import { formatMoney } from "@/lib/platform";

const emptyForm = () => ({
  organisation_id: "",
  record_type: "invoice",
  reference: "",
  amount: "0",
  issued_date: new Date().toISOString().slice(0, 10),
  received_date: "",
  status: "issued",
  notes: "",
});

export default function PlatformIncome() {
  const qc = useQueryClient();
  const [form, setForm] = useState(emptyForm());

  const data = useQuery({
    queryKey: ["platform-income"],
    queryFn: async () => {
      const [records, orgs, subs] = await Promise.all([
        supabase.from("platform_income_records" as any).select("*").order("issued_date", { ascending: false }),
        supabase.from("organisations" as any).select("id, legal_name, name, is_demo"),
        supabase.from("tenant_subscriptions" as any).select("organisation_id, monthly_price, status"),
      ]);
      if (records.error) throw records.error;
      return { records: (records.data ?? []) as any[], orgs: (orgs.data ?? []) as any[], subs: (subs.data ?? []) as any[] };
    },
  });

  const mrr = useMemo(
    () => (data.data?.subs ?? []).filter((s) => ["active", "past_due"].includes(s.status)).reduce((t, s) => t + Number(s.monthly_price ?? 0), 0),
    [data.data],
  );
  const received = useMemo(
    () => (data.data?.records ?? []).filter((r) => r.status === "received").reduce((t, r) => t + Number(r.amount ?? 0), 0),
    [data.data],
  );

  const blockers: string[] = [];
  if (!form.organisation_id) blockers.push("Select the client this record belongs to.");
  if (!(Number(form.amount) > 0)) blockers.push("Amount must be greater than zero.");
  if (!form.issued_date) blockers.push("Issued date is required.");

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("platform_income_records" as any).insert({
        organisation_id: form.organisation_id,
        record_type: form.record_type,
        reference: form.reference || null,
        amount: Number(form.amount),
        issued_date: form.issued_date,
        received_date: form.received_date || null,
        status: form.status,
        notes: form.notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setForm(emptyForm());
      qc.invalidateQueries({ queryKey: ["platform-income"] });
      qc.invalidateQueries({ queryKey: ["platform-summary"] });
      toast({ title: "Record saved", description: "Manual entry only — no card details are ever stored." });
    },
    onError: (e: any) => toast({ variant: "destructive", title: "Could not save record", description: e.message }),
  });

  const orgName = (id: string) => {
    const o = (data.data?.orgs ?? []).find((x) => x.id === id);
    return o?.legal_name ?? o?.name ?? "—";
  };

  return (
    <div className="space-y-6 p-6">
      <PageHeading
        title="Income"
        description="Manual invoice, payment, refund and credit records. Contracted MRR and money actually received are reported separately so neither is overstated."
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Contracted MRR</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{formatMoney(mrr)}</p><p className="text-xs text-muted-foreground">Active and past-due subscriptions</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Income received</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{formatMoney(received)}</p><p className="text-xs text-muted-foreground">Records marked received</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Record income</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="inc-org">Client</Label>
            <select id="inc-org" className="min-h-[44px] w-full rounded-md border bg-background px-3 text-sm" value={form.organisation_id} onChange={(e) => setForm({ ...form, organisation_id: e.target.value })}>
              <option value="">Select a client</option>
              {(data.data?.orgs ?? []).filter((o) => !o.is_demo).map((o) => <option key={o.id} value={o.id}>{o.legal_name ?? o.name}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="inc-type">Record type</Label>
            <select id="inc-type" className="min-h-[44px] w-full rounded-md border bg-background px-3 text-sm" value={form.record_type} onChange={(e) => setForm({ ...form, record_type: e.target.value })}>
              <option value="invoice">Invoice</option>
              <option value="payment">Payment</option>
              <option value="refund">Refund</option>
              <option value="credit">Credit</option>
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="inc-ref">Reference</Label>
            <Input id="inc-ref" value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} className="min-h-[44px]" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="inc-amount">Amount (AUD)</Label>
            <Input id="inc-amount" type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="min-h-[44px]" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="inc-issued">Issued date</Label>
            <Input id="inc-issued" type="date" value={form.issued_date} onChange={(e) => setForm({ ...form, issued_date: e.target.value })} className="min-h-[44px]" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="inc-received">Received date</Label>
            <Input id="inc-received" type="date" value={form.received_date} onChange={(e) => setForm({ ...form, received_date: e.target.value })} className="min-h-[44px]" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="inc-status">Status</Label>
            <select id="inc-status" className="min-h-[44px] w-full rounded-md border bg-background px-3 text-sm" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              <option value="issued">Issued</option>
              <option value="received">Received</option>
              <option value="overdue">Overdue</option>
              <option value="void">Void</option>
            </select>
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="inc-notes">Notes</Label>
            <Textarea id="inc-notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          <div className="space-y-3 sm:col-span-2">
            <BlockerAlert blockers={blockers} title="Record incomplete" />
            <Button className="min-h-[44px]" disabled={blockers.length > 0 || save.isPending} onClick={() => save.mutate()}>Save record</Button>
          </div>
        </CardContent>
      </Card>

      {data.isLoading && <LoadingState rows={4} />}
      {data.error && <ErrorState error={data.error} />}
      {!data.isLoading && (data.data?.records ?? []).length === 0 && (
        <EmptyState title="No income records" description="Add your first invoice or payment above to start tracking received revenue." />
      )}

      <div className="space-y-2">
        {(data.data?.records ?? []).map((r) => (
          <Card key={r.id}>
            <CardContent className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
              <div>
                <p className="font-medium">{orgName(r.organisation_id)}</p>
                <p className="text-xs text-muted-foreground">{r.record_type} · {r.reference ?? "no reference"} · issued {r.issued_date}</p>
              </div>
              <div className="flex items-center gap-3">
                <StatusPill tone={r.status === "received" ? "ok" : r.status === "overdue" ? "bad" : "neutral"}>{r.status}</StatusPill>
                <span className="font-semibold">{formatMoney(r.amount)}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
