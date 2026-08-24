import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";

interface OrgDocumentLinkProps {
  /** Path inside the private `org-documents` bucket. */
  storagePath: string | null | undefined;
  fileName?: string | null;
  label?: string;
  className?: string;
}

/**
 * Downloads an onboarding document through a short-lived signed URL so storage RLS
 * decides who can read it (tenant members and platform reviewers).
 */
export function OrgDocumentLink({ storagePath, fileName, label = "Download", className }: OrgDocumentLinkProps) {
  const [loading, setLoading] = useState(false);
  if (!storagePath) return null;

  const download = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.storage
        .from("org-documents")
        .createSignedUrl(storagePath, 3600, { download: fileName || true });
      if (error || !data?.signedUrl) {
        toast({
          variant: "destructive",
          title: "File unavailable",
          description: "You do not have access to this document, or it has been removed.",
        });
        return;
      }
      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      className={className}
      disabled={loading}
      onClick={download}
      aria-label={fileName ? `${label} ${fileName}` : label}
    >
      {loading ? <Loader2 className="mr-1 h-4 w-4 animate-spin" aria-hidden="true" /> : <Download className="mr-1 h-4 w-4" aria-hidden="true" />}
      {label}
    </Button>
  );
}
