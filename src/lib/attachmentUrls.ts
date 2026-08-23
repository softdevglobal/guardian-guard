/**
 * Helpers for the private `form-attachments` bucket.
 *
 * The bucket used to be public, so historical records store a full public URL while
 * new records store the storage path. Both are normalised to a path here and served
 * through short-lived signed URLs so access is checked against storage RLS.
 */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const ATTACHMENT_BUCKET = "form-attachments";

const PUBLIC_PREFIX = `/storage/v1/object/public/${ATTACHMENT_BUCKET}/`;
const SIGN_PREFIX = `/storage/v1/object/sign/${ATTACHMENT_BUCKET}/`;

/** Turns a stored value (legacy public URL or plain path) into a bucket-relative path. */
export function attachmentPath(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  for (const prefix of [PUBLIC_PREFIX, SIGN_PREFIX]) {
    const idx = trimmed.indexOf(prefix);
    if (idx !== -1) return trimmed.slice(idx + prefix.length).split("?")[0];
  }
  if (/^https?:\/\//i.test(trimmed)) return null; // external URL — leave as-is
  return trimmed.replace(/^\/+/, "");
}

/** Signed URL for a stored attachment, or null when it cannot be resolved/authorised. */
export async function signAttachment(
  value: string | null | undefined,
  expiresInSeconds = 3600
): Promise<string | null> {
  const path = attachmentPath(value);
  if (!path) return typeof value === "string" && /^https?:\/\//i.test(value) ? value : null;
  const { data, error } = await supabase.storage
    .from(ATTACHMENT_BUCKET)
    .createSignedUrl(path, expiresInSeconds);
  if (error) return null;
  return data?.signedUrl ?? null;
}

/** React helper: resolves a stored attachment value to a signed URL. */
export function useSignedAttachment(value: string | null | undefined) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!value) {
      setUrl(null);
      return;
    }
    signAttachment(value).then((signed) => {
      if (!cancelled) setUrl(signed);
    });
    return () => {
      cancelled = true;
    };
  }, [value]);

  return url;
}
