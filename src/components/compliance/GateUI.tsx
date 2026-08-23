import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Info, Lock, ShieldQuestion, ShieldOff } from "lucide-react";
import { accessRestrictedCopy, type PermissionAction } from "@/lib/permissions";
import type { AppRole } from "@/contexts/AuthContext";
import { reportError, toSafeError } from "@/lib/userFacingError";

export function PageHeading({
  title,
  description,
  actions,
}: {
  title: string;
  description: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="space-y-1">
        <h1 className="text-2xl font-serif font-bold">{title}</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">{description}</p>
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

/** Standing reminder that the software supports compliance and never asserts it. */
export function HumanReviewNotice({ children }: { children?: React.ReactNode }) {
  return (
    <Alert>
      <ShieldQuestion className="h-4 w-4" aria-hidden="true" />
      <AlertTitle>Requires human review</AlertTitle>
      <AlertDescription>
        {children ??
          "This module records evidence of practice. It does not determine compliance with the NDIS Practice Standards — an authorised person must review every record before it is relied on in an audit."}
      </AlertDescription>
    </Alert>
  );
}

export function BlockerAlert({ blockers, title = "Blocked" }: { blockers: string[]; title?: string }) {
  if (blockers.length === 0) return null;
  return (
    <Alert variant="destructive">
      <AlertTriangle className="h-4 w-4" aria-hidden="true" />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>
        <ul className="list-disc space-y-1 pl-4">
          {blockers.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
      </AlertDescription>
    </Alert>
  );
}

export function ReadOnlyNotice({ reason }: { reason: string }) {
  return (
    <Alert>
      <Lock className="h-4 w-4" aria-hidden="true" />
      <AlertTitle>Read only</AlertTitle>
      <AlertDescription>{reason}</AlertDescription>
    </Alert>
  );
}

export function LoadingState({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-2" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading records</span>
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-14 w-full" />
      ))}
    </div>
  );
}

/** Never renders raw database or RLS text — the technical detail is logged instead. */
export function ErrorState({ error, onRetry, scope = "load" }: { error: unknown; onRetry?: () => void; scope?: string }) {
  reportError(scope, error);
  const safe = toSafeError(error, "load these records");
  return (
    <Alert variant="destructive">
      <AlertTriangle className="h-4 w-4" aria-hidden="true" />
      <AlertTitle>{safe.title}</AlertTitle>
      <AlertDescription className="space-y-2">
        <p>{safe.description}</p>
        <p className="text-xs">Support reference: <span className="font-mono">{safe.supportReference}</span></p>
        <Button size="sm" variant="outline" onClick={() => (onRetry ? onRetry() : window.location.reload())}>
          Retry
        </Button>
      </AlertDescription>
    </Alert>
  );
}


/** Explains exactly who can grant the missing permission and what to do next. */
export function AccessRestricted({
  action,
  roles,
  description,
}: {
  action: PermissionAction;
  roles: AppRole[];
  description?: string;
}) {
  const copy = accessRestrictedCopy(action, roles);
  return (
    <Alert>
      <ShieldOff className="h-4 w-4" aria-hidden="true" />
      <AlertTitle>Access restricted</AlertTitle>
      <AlertDescription className="space-y-1 text-sm">
        {description && <p>{description}</p>}
        <p><span className="text-muted-foreground">Your role:</span> {copy.currentRole}</p>
        <p><span className="text-muted-foreground">Permission needed:</span> {copy.requiredPermission}</p>
        <p><span className="text-muted-foreground">Who can grant it:</span> {copy.grantedBy}</p>
        <p>{copy.nextAction}</p>
      </AlertDescription>
    </Alert>
  );
}

/** Zero applicable requirements must read as "Not assessable" — never as 0% or 100%. */
export function NotAssessableNotice({ subject }: { subject: string }) {
  return (
    <Alert>
      <Info className="h-4 w-4" aria-hidden="true" />
      <AlertTitle>Not assessable</AlertTitle>
      <AlertDescription>
        There are no applicable {subject} in scope yet, so a readiness figure cannot be calculated.
      </AlertDescription>
    </Alert>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
        <Info className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
        <p className="font-medium">{title}</p>
        <p className="max-w-md text-sm text-muted-foreground">{description}</p>
        {action && <div className="pt-2">{action}</div>}
      </CardContent>
    </Card>
  );
}

const TONE: Record<string, string> = {
  ok: "border-success text-success",
  warn: "border-warning text-warning",
  bad: "border-destructive text-destructive",
  neutral: "border-muted-foreground text-muted-foreground",
};

export function StatusPill({ tone = "neutral", children }: { tone?: keyof typeof TONE | string; children: React.ReactNode }) {
  return (
    <Badge variant="outline" className={TONE[tone] ?? TONE.neutral}>
      {children}
    </Badge>
  );
}
