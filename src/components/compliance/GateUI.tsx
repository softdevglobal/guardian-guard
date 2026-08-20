import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, Info, Lock, ShieldQuestion } from "lucide-react";

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

export function ErrorState({ error }: { error: unknown }) {
  return (
    <Alert variant="destructive">
      <AlertTriangle className="h-4 w-4" aria-hidden="true" />
      <AlertTitle>Could not load records</AlertTitle>
      <AlertDescription>{error instanceof Error ? error.message : "An unexpected error occurred."}</AlertDescription>
    </Alert>
  );
}

export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
        <Info className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
        <p className="font-medium">{title}</p>
        <p className="max-w-md text-sm text-muted-foreground">{description}</p>
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
