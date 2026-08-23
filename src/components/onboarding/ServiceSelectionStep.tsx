import { useEffect, useMemo, useState } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { BlockerAlert, HumanReviewNotice, LoadingState } from "@/components/compliance/GateUI";
import { logAudit } from "@/lib/auditLog";
import { reportError, toSafeError } from "@/lib/userFacingError";
import {
  useConfirmSelections, useProviderPathway, useSaveSelections,
} from "@/hooks/useServiceSelection";
import {
  NDIS_FUNDING_OPTIONS, normaliseFundingStatus, selectionBlockers, type NdisFundingStatus,
} from "@/lib/serviceSelection";

interface Props {
  /** Current stored NDIS funding answer, if the provider has already answered. */
  ndisStatus: NdisFundingStatus | null;
  confirmed: boolean;
  locked?: boolean;
  onConfirmed?: () => void;
}

/**
 * The first mandatory onboarding decision. Nothing is pre-selected and no pathway
 * is ever assigned by default — the provider tells Guardian Guard what it does.
 */
export function ServiceSelectionStep({ ndisStatus, confirmed, locked, onConfirmed }: Props) {
  const pathway = useProviderPathway(ndisStatus);
  const save = useSaveSelections();
  const confirm = useConfirmSelections();

  // Nothing is pre-selected: an empty stored selection stays an empty selection.
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [funding, setFunding] = useState<NdisFundingStatus | null>(normaliseFundingStatus(ndisStatus));
  const [openCategories, setOpenCategories] = useState<Set<string>>(new Set());

  const storedSelections = Array.isArray(pathway.selections) ? pathway.selections : [];

  useEffect(() => {
    if (storedSelections.length > 0) {
      setChosen(new Set(storedSelections.filter((s) => s.service_type_id).map((s) => s.service_type_id!)));
      setOpenCategories(new Set(storedSelections.map((s) => s.business_category_id)));
    }
  }, [storedSelections.length]);

  useEffect(() => { setFunding(normaliseFundingStatus(ndisStatus)); }, [ndisStatus]);

  const typesByCategory = useMemo(() => {
    const map = new Map<string, typeof pathway.serviceTypes>();
    for (const t of pathway.serviceTypes) {
      const list = map.get(t.business_category_id) ?? [];
      list.push(t);
      map.set(t.business_category_id, list);
    }
    return map;
  }, [pathway.serviceTypes]);

  const draftSelections = useMemo(
    () =>
      pathway.serviceTypes
        .filter((t) => chosen.has(t.id))
        .map((t) => ({
          business_category_id: t.business_category_id,
          service_type_id: t.id,
          ndis_funded: funding !== null && funding !== "non_ndis",
        })),
    [pathway.serviceTypes, chosen, funding],
  );

  const blockers = selectionBlockers(draftSelections, funding);

  if (pathway.isLoading) return <LoadingState rows={6} />;

  const toggleType = (id: string) => {
    if (locked) return;
    setChosen((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const submit = async () => {
    try {
      await save.mutateAsync(draftSelections);
      const result = await confirm.mutateAsync(funding!);
      await logAudit({
        action: confirmed ? "service_selection_changed" : "service_selection_confirmed",
        module: "onboarding",
        severity: "elevated",
        details: { services: draftSelections.length, ndis_funding_status: funding, policies_created: result?.policies_created ?? 0 },
      });
      toast({
        title: "Services confirmed",
        description: `${result?.policies_created ?? 0} draft policies were generated for human review. Nothing is approved automatically.`,
      });
      onConfirmed?.();
    } catch (e) {
      reportError("service-selection", e);
      toast({ variant: "destructive", title: "Could not save your services", description: toSafeError(e, "save your services").description });
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">What type of services does your organisation provide?</CardTitle>
          <p className="text-sm text-muted-foreground">
            Select every category and service you deliver. Your answers decide which questions, licences, training,
            policies, evidence and modules Guardian Guard asks you for. Nothing is assumed.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {pathway.categories.map((cat) => {
            const types = typesByCategory.get(cat.id) ?? [];
            const selectedCount = types.filter((t) => chosen.has(t.id)).length;
            const open = openCategories.has(cat.id) || selectedCount > 0;
            return (
              <div key={cat.id} className="rounded-md border">
                <button
                  type="button"
                  className="flex min-h-[48px] w-full items-center justify-between gap-2 px-3 text-left text-sm font-medium"
                  aria-expanded={open}
                  onClick={() =>
                    setOpenCategories((prev) => {
                      const next = new Set(prev);
                      next.has(cat.id) ? next.delete(cat.id) : next.add(cat.id);
                      return next;
                    })
                  }
                >
                  <span>
                    {cat.name}
                    {cat.description && <span className="block text-xs font-normal text-muted-foreground">{cat.description}</span>}
                  </span>
                  {selectedCount > 0 && <Badge variant="secondary">{selectedCount} selected</Badge>}
                </button>
                {open && (
                  <div className="grid gap-2 border-t p-3 sm:grid-cols-2">
                    {types.map((t) => (
                      <label key={t.id} className="flex min-h-[44px] items-center gap-2 rounded-md px-2 text-sm hover:bg-accent">
                        <Checkbox
                          checked={chosen.has(t.id)}
                          disabled={locked}
                          onCheckedChange={() => toggleType(t.id)}
                          aria-label={t.name}
                        />
                        <span>
                          {t.name}
                          {t.high_risk && <Badge variant="outline" className="ml-2 text-[10px]">Higher risk</Badge>}
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Are these services funded through the NDIS?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {NDIS_FUNDING_OPTIONS.map((opt) => (
            <label key={opt.value} className="flex min-h-[44px] items-center gap-2 rounded-md px-2 text-sm hover:bg-accent">
              <input
                type="radio"
                name="ndis-funding"
                disabled={locked}
                checked={funding === opt.value}
                onChange={() => setFunding(opt.value)}
              />
              <span>{opt.label}</span>
            </label>
          ))}
          <p className="text-xs text-muted-foreground">
            Selecting a business category is not a claim of NDIS registration. Registration groups and NDIS Practice
            Standards are only requested when you tell us your work is NDIS funded.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{confirmed ? "What your confirmed services switch on" : "Your selection"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {chosen.size === 0 ? (
            <p className="text-sm text-muted-foreground">No services selected</p>
          ) : (
            <p className="text-sm text-muted-foreground">{chosen.size} service{chosen.size === 1 ? "" : "s"} selected</p>
          )}
          {confirmed && (
            <div className="flex flex-wrap gap-1">
              {pathway.modules.map((m) => (
                <Badge key={m} variant="outline" className="capitalize">{m.replace(/_/g, " ")}</Badge>
              ))}
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            Nothing is configured until you confirm. Generated policies are created as drafts and require human review
            and approval — Guardian Guard never marks a policy compliant, approved or audit-ready for you.
          </p>
          <HumanReviewNotice />
        </CardContent>
      </Card>

      <BlockerAlert blockers={blockers} title="Before you can confirm" />

      <div className="flex flex-wrap items-center gap-2">
        <Button
          className="min-h-[44px]"
          disabled={locked || blockers.length > 0 || save.isPending || confirm.isPending}
          onClick={submit}
        >
          {confirmed ? "Update services and reconfigure Guardian Guard" : "Confirm services and configure Guardian Guard"}
        </Button>
        {confirmed && (
          <span className="flex items-center gap-1 text-sm text-muted-foreground">
            <Check className="h-4 w-4 text-success" aria-hidden="true" /> Services confirmed
          </span>
        )}
      </div>
      {blockers.length > 0 && (
        <p className="text-sm text-muted-foreground">
          Select at least one service and tell us whether the work is NDIS funded.
        </p>
      )}
      <Label className="sr-only">Service selection</Label>
    </div>
  );
}
