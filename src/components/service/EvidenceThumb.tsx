import { useState } from "react";
import { Eye, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { getSignedEvidenceUrl } from "@/lib/taskEvidence";

/**
 * Evidence is stored privately. The image is only fetched behind a short-lived signed URL
 * after an authorised, audit-logged request — never a public URL.
 */
export function EvidenceThumb({
  evidence,
  label = "View evidence",
}: {
  evidence: { id: string; storage_path: string; shift_id?: string };
  label?: string;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function reveal() {
    setBusy(true);
    try {
      setUrl(await getSignedEvidenceUrl(evidence));
    } catch (e: any) {
      toast({ variant: "destructive", title: "Could not open evidence", description: e?.message ?? "Unknown error" });
    } finally {
      setBusy(false);
    }
  }

  if (url) {
    return (
      <img
        src={url}
        alt="Service task evidence photo"
        loading="lazy"
        className="h-32 w-full rounded-md border object-cover"
      />
    );
  }

  return (
    <Button type="button" variant="outline" className="h-32 w-full flex-col gap-1 text-xs" onClick={reveal} disabled={busy}>
      {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
      <span>{label}</span>
      <span className="text-[10px] text-muted-foreground">Opens a 2 minute signed link (logged)</span>
    </Button>
  );
}
