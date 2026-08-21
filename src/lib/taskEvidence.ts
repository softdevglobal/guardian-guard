import { supabase } from "@/integrations/supabase/client";
import { logAudit } from "@/lib/auditLog";

export const TASK_EVIDENCE_BUCKET = "task-evidence";

/** SHA-256 of the original file bytes, computed in the browser before upload. */
export async function sha256Hex(file: Blob): Promise<string> {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Stable per-device/session identifier used for evidence provenance (not tracking). */
export function deviceIdentifier(): string {
  const key = "gg-device-id";
  let id = localStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(key, id);
  }
  return id;
}

export function sessionIdentifier(): string {
  const key = "gg-session-id";
  let id = sessionStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem(key, id);
  }
  return id;
}

export function evidenceStoragePath(organisationId: string, shiftId: string, file: File): string {
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
  return `${organisationId}/${shiftId}/${crypto.randomUUID()}.${ext}`;
}

export interface CaptureGeo {
  latitude: number | null;
  longitude: number | null;
  accuracy_metres: number | null;
}

/** Requests the browser location once, at action time only. Never continuous tracking. */
export function requestLocationOnce(timeoutMs = 12000): Promise<CaptureGeo> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      resolve({ latitude: null, longitude: null, accuracy_metres: null });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          latitude: Number(pos.coords.latitude.toFixed(6)),
          longitude: Number(pos.coords.longitude.toFixed(6)),
          accuracy_metres: pos.coords.accuracy != null ? Math.round(pos.coords.accuracy) : null,
        }),
      () => resolve({ latitude: null, longitude: null, accuracy_metres: null }),
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 0 }
    );
  });
}

export interface UploadEvidenceArgs {
  file: File;
  organisationId: string;
  shiftId: string;
  shiftTaskId?: string | null;
  participantId: string;
  workerId: string;
  evidenceType: "before" | "after" | "issue";
  caption?: string | null;
  source: "camera" | "gallery";
  consentId?: string | null;
  supersedesEvidenceId?: string | null;
  supersedeReason?: string | null;
  geo?: CaptureGeo | null;
  geofenceResult?: "inside" | "outside" | "unknown" | "inaccurate";
  deviceCaptureAt?: string;
  offlineCapture?: boolean;
}

/** Uploads the original, unmodified image to the private bucket and records its metadata. */
export async function uploadTaskEvidence(args: UploadEvidenceArgs) {
  const hash = await sha256Hex(args.file);
  const path = evidenceStoragePath(args.organisationId, args.shiftId, args.file);

  const { error: uploadError } = await supabase.storage
    .from(TASK_EVIDENCE_BUCKET)
    .upload(path, args.file, { contentType: args.file.type || "image/jpeg", upsert: false });
  if (uploadError) throw uploadError;

  const { data, error } = await supabase
    .from("task_evidence" as any)
    .insert({
      organisation_id: args.organisationId,
      shift_id: args.shiftId,
      shift_task_id: args.shiftTaskId ?? null,
      participant_id: args.participantId,
      worker_id: args.workerId,
      evidence_type: args.evidenceType,
      storage_path: path,
      mime_type: args.file.type || null,
      file_size_bytes: args.file.size,
      sha256_hash: hash,
      caption: args.caption ?? null,
      source: args.source,
      device_capture_at: args.deviceCaptureAt ?? new Date().toISOString(),
      latitude: args.geo?.latitude ?? null,
      longitude: args.geo?.longitude ?? null,
      accuracy_metres: args.geo?.accuracy_metres ?? null,
      geofence_result: args.geofenceResult ?? "unknown",
      device_identifier: deviceIdentifier(),
      session_identifier: sessionIdentifier(),
      consent_id: args.consentId ?? null,
      supersedes_evidence_id: args.supersedesEvidenceId ?? null,
      supersede_reason: args.supersedeReason ?? null,
      offline_capture: args.offlineCapture ?? false,
      synced_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error) throw error;

  await logAudit({
    action: "evidence_uploaded",
    module: "task_evidence",
    record_id: (data as any)?.id,
    details: { shift_id: args.shiftId, evidence_type: args.evidenceType, sha256: hash, source: args.source },
  });

  return { id: (data as any)?.id as string, path, hash };
}

/** Short-lived signed URL. Public URLs are never used for task evidence. */
export async function getSignedEvidenceUrl(evidence: { id: string; storage_path: string; shift_id?: string }, expiresIn = 120) {
  const { data, error } = await supabase.storage.from(TASK_EVIDENCE_BUCKET).createSignedUrl(evidence.storage_path, expiresIn);
  if (error) throw error;
  await logAudit({
    action: "evidence_viewed",
    module: "task_evidence",
    record_id: evidence.id,
    severity: "elevated",
    details: { shift_id: evidence.shift_id, expires_in_seconds: expiresIn },
  });
  return data.signedUrl;
}

/* ---------------- Offline-safe draft queue ---------------- */

export interface QueuedEvidence {
  key: string;
  shiftId: string;
  shiftTaskId: string | null;
  evidenceType: "before" | "after" | "issue";
  caption: string | null;
  deviceCaptureAt: string;
  fileName: string;
  dataUrl: string;
  geo: CaptureGeo | null;
  source: "camera" | "gallery";
}

const QUEUE_KEY = "gg-evidence-queue";

export function readEvidenceQueue(): QueuedEvidence[] {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) || "[]");
  } catch {
    return [];
  }
}

export function writeEvidenceQueue(items: QueuedEvidence[]) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(items));
}

export function queueEvidence(item: QueuedEvidence) {
  writeEvidenceQueue([...readEvidenceQueue(), item]);
}

export function removeQueuedEvidence(key: string) {
  writeEvidenceQueue(readEvidenceQueue().filter((i) => i.key !== key));
}

export async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export async function dataUrlToFile(dataUrl: string, fileName: string): Promise<File> {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  return new File([blob], fileName, { type: blob.type });
}

/* ---------------- Shift note drafts (offline safe) ---------------- */

export function saveShiftDraft(shiftId: string, draft: Record<string, unknown>) {
  localStorage.setItem(`gg-shift-draft-${shiftId}`, JSON.stringify({ ...draft, saved_at: new Date().toISOString() }));
}

export function readShiftDraft(shiftId: string): Record<string, any> | null {
  try {
    const raw = localStorage.getItem(`gg-shift-draft-${shiftId}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearShiftDraft(shiftId: string) {
  localStorage.removeItem(`gg-shift-draft-${shiftId}`);
}
