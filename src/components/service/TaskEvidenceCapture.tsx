import { useRef, useState } from "react";
import { Camera, ImageUp, Loader2, ShieldAlert, WifiOff } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import {
  fileToDataUrl,
  queueEvidence,
  requestLocationOnce,
  uploadTaskEvidence,
  type CaptureGeo,
} from "@/lib/taskEvidence";
import {
  evaluateGeofence,
  photoRefusalAlternative,
  photographyAllowed,
  type EvidencePreferences,
  type EvidenceType,
} from "@/lib/serviceShifts";
import { EvidenceThumb } from "@/components/service/EvidenceThumb";

const TYPE_LABEL: Record<EvidenceType, string> = { before: "Before", after: "After", issue: "Issue" };

export interface TaskEvidenceCaptureProps {
  organisationId: string;
  workerId: string;
  shiftId: string;
  shiftTaskId?: string | null;
  participantId: string;
  preferences: EvidencePreferences | null;
  consentId?: string | null;
  allowGalleryUpload?: boolean;
  fence?: { latitude?: number | null; longitude?: number | null; radius_metres?: number | null } | null;
  existing?: { id: string; evidence_type: EvidenceType; storage_path: string; caption?: string | null; record_status?: string }[];
  disabled?: boolean;
  onUploaded?: () => void;
}

/**
 * Secure, consent-aware evidence capture. Files go to the private task-evidence bucket
 * and are never exposed with a public URL.
 */
export function TaskEvidenceCapture(props: TaskEvidenceCaptureProps) {
  const {
    organisationId, workerId, shiftId, shiftTaskId, participantId, preferences,
    allowGalleryUpload = false, fence, existing = [], disabled, onUploaded,
  } = props;

  const [type, setType] = useState<EvidenceType>("before");
  const [caption, setCaption] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [supersedeId, setSupersedeId] = useState<string | null>(null);
  const [supersedeReason, setSupersedeReason] = useState("");
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  const refusal = photoRefusalAlternative(preferences);
  const allowed = photographyAllowed(preferences, type);

  async function handleFile(file: File | undefined, source: "camera" | "gallery") {
    if (!file) return;
    if (supersedeId && !supersedeReason.trim()) {
      toast({ variant: "destructive", title: "Reason required", description: "Say why the earlier photo is being replaced." });
      return;
    }
    setBusy(true);
    setStatus("Capturing location and hashing the original image…");
    const deviceCaptureAt = new Date().toISOString();
    let geo: CaptureGeo | null = null;
    try {
      geo = await requestLocationOnce();
      const fenceResult = evaluateGeofence({
        captured: geo,
        fence: fence ?? null,
      }).result;

      setStatus("Uploading to the private evidence store…");
      await uploadTaskEvidence({
        file, organisationId, shiftId, shiftTaskId: shiftTaskId ?? null, participantId, workerId,
        evidenceType: type, caption: caption || null, source, consentId: props.consentId ?? null,
        supersedesEvidenceId: supersedeId, supersedeReason: supersedeReason || null,
        geo, geofenceResult: fenceResult, deviceCaptureAt,
      });
      setCaption("");
      setSupersedeId(null);
      setSupersedeReason("");
      setStatus(`${TYPE_LABEL[type]} evidence saved.`);
      toast({ title: "Evidence saved", description: `${TYPE_LABEL[type]} photo stored privately with a SHA-256 hash.` });
      onUploaded?.();
    } catch (e: any) {
      try {
        const dataUrl = await fileToDataUrl(file);
        queueEvidence({
          key: crypto.randomUUID(), shiftId, shiftTaskId: shiftTaskId ?? null, evidenceType: type,
          caption: caption || null, deviceCaptureAt, fileName: file.name, dataUrl, geo, source,
        });
        setStatus("Saved to the offline queue on this device.");
        toast({
          title: "Saved offline",
          description: "Upload failed, so this photo is queued on your device and will sync when you are back online.",
        });
      } catch {
        toast({ variant: "destructive", title: "Could not save evidence", description: e?.message ?? "Unknown error" });
      }
    } finally {
      setBusy(false);
      if (cameraRef.current) cameraRef.current.value = "";
      if (galleryRef.current) galleryRef.current.value = "";
    }
  }

  return (
    <div className="space-y-3 rounded-lg border p-3">
      <p aria-live="polite" className="sr-only">{status}</p>

      {refusal.requiresWrittenAlternative ? (
        <Alert>
          <ShieldAlert className="h-4 w-4" aria-hidden="true" />
          <AlertTitle>Photography is not permitted for this participant</AlertTitle>
          <AlertDescription>
            {refusal.message} This does not stop the service and does not block completion.
          </AlertDescription>
        </Alert>
      ) : (
        <Alert>
          <ShieldAlert className="h-4 w-4" aria-hidden="true" />
          <AlertTitle>Before you open the camera</AlertTitle>
          <AlertDescription className="space-y-1">
            <p>{preferences?.participant_may_appear ? "The participant may appear in photos." : "The participant must not appear in photos."}</p>
            {preferences?.photography_restrictions && <p>Restrictions: {preferences.photography_restrictions}</p>}
            {preferences?.private_area_restrictions && <p>Private areas: {preferences.private_area_restrictions}</p>}
          </AlertDescription>
        </Alert>
      )}

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Evidence type</legend>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Evidence type">
          {(["before", "after", "issue"] as EvidenceType[]).map((t) => (
            <Button
              key={t}
              type="button"
              role="radio"
              aria-checked={type === t}
              variant={type === t ? "default" : "outline"}
              className="min-h-[44px] min-w-[88px]"
              onClick={() => setType(t)}
            >
              {TYPE_LABEL[t]}
            </Button>
          ))}
        </div>
      </fieldset>

      <div className="space-y-1">
        <Label htmlFor={`caption-${shiftTaskId ?? shiftId}`}>Caption (plain language)</Label>
        <Input
          id={`caption-${shiftTaskId ?? shiftId}`}
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          placeholder="What does this photo show?"
          className="min-h-[44px]"
        />
      </div>

      {supersedeId && (
        <div className="space-y-1">
          <Label htmlFor={`supersede-${shiftTaskId ?? shiftId}`}>Why is the earlier photo being replaced?</Label>
          <Input
            id={`supersede-${shiftTaskId ?? shiftId}`}
            value={supersedeReason}
            onChange={(e) => setSupersedeReason(e.target.value)}
            className="min-h-[44px]"
          />
          <p className="text-xs text-muted-foreground">The original is kept and marked as superseded. Nothing is deleted.</p>
        </div>
      )}

      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={(e) => handleFile(e.target.files?.[0], "camera")}
      />
      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(e) => handleFile(e.target.files?.[0], "gallery")}
      />

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          className="min-h-[44px]"
          disabled={disabled || busy || !allowed}
          onClick={() => cameraRef.current?.click()}
        >
          {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : <Camera className="mr-2 h-4 w-4" aria-hidden="true" />}
          Take {TYPE_LABEL[type].toLowerCase()} photo
        </Button>
        {allowGalleryUpload && (
          <Button
            type="button"
            variant="outline"
            className="min-h-[44px]"
            disabled={disabled || busy || !allowed}
            onClick={() => galleryRef.current?.click()}
          >
            <ImageUp className="mr-2 h-4 w-4" aria-hidden="true" />
            Upload from gallery
          </Button>
        )}
      </div>
      {!allowed && (
        <p className="text-xs text-muted-foreground">
          {TYPE_LABEL[type]} photos are not permitted for this participant. Record written service notes instead.
        </p>
      )}
      {allowGalleryUpload && (
        <p className="flex items-center gap-1 text-xs text-muted-foreground">
          <WifiOff className="h-3 w-3" aria-hidden="true" /> Gallery uploads are recorded with their source and reviewed by your supervisor.
        </p>
      )}

      {existing.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium">Captured evidence</p>
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {existing.map((e) => (
              <li key={e.id} className="space-y-1">
                <EvidenceThumb evidence={{ id: e.id, storage_path: e.storage_path, shift_id: shiftId }} />
                <div className="flex items-center gap-1">
                  <Badge variant={e.record_status === "archived" ? "outline" : "secondary"}>
                    {TYPE_LABEL[e.evidence_type]}{e.record_status === "archived" ? " · superseded" : ""}
                  </Badge>
                </div>
                {e.caption && <p className="text-xs text-muted-foreground">{e.caption}</p>}
                {e.record_status !== "archived" && !disabled && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="min-h-[44px] text-xs"
                    onClick={() => setSupersedeId(e.id)}
                  >
                    Mark incorrect and replace
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
