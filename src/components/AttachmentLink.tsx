import { useState } from "react";
import { signAttachment } from "@/lib/attachmentUrls";
import { toast } from "@/hooks/use-toast";

interface AttachmentLinkProps {
  /** Stored attachment value: a bucket path, or a legacy public URL. */
  value: string | null | undefined;
  className?: string;
  children: React.ReactNode;
}

/**
 * Opens a private form attachment through a short-lived signed URL, so storage RLS
 * decides who can read the file instead of the link being universally shareable.
 */
export function AttachmentLink({ value, className, children }: AttachmentLinkProps) {
  const [loading, setLoading] = useState(false);

  const open = async () => {
    if (!value || loading) return;
    setLoading(true);
    try {
      const url = await signAttachment(value);
      if (!url) {
        toast({
          title: "File unavailable",
          description: "You do not have access to this attachment, or it has been removed.",
          variant: "destructive",
        });
        return;
      }
      window.open(url, "_blank", "noopener,noreferrer");
    } finally {
      setLoading(false);
    }
  };

  if (!value) return null;

  return (
    <button type="button" onClick={open} disabled={loading} className={className}>
      {children}
    </button>
  );
}
