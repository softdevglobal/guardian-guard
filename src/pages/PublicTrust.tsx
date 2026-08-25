import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, ErrorState, LoadingState, StatusPill } from "@/components/compliance/GateUI";
import { TRUST_DISCLAIMER, type TrustSnapshot } from "@/lib/trustPortal";

export default function PublicTrust() {
  const { slug = "" } = useParams();

  const { data, isLoading, error } = useQuery({
    queryKey: ["public-trust", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("provider_trust_portals" as any)
        .select("slug, is_enabled, published_at, published_snapshot, contact_email, intro_text")
        .eq("slug", slug)
        .maybeSingle();
      if (error) throw error;
      return (data as any) ?? null;
    },
  });

  const snapshot: TrustSnapshot | null = (data?.published_snapshot as TrustSnapshot) ?? null;

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      {isLoading && <LoadingState rows={4} />}
      {error && <ErrorState error={error} />}

      {!isLoading && !error && (!data || !data.is_enabled || !snapshot) && (
        <EmptyState
          title="This trust summary is not available"
          description="The provider has not published a public compliance summary at this address."
        />
      )}

      {snapshot && data?.is_enabled && (
        <>
          <header className="space-y-2">
            <h1 className="text-2xl font-serif font-bold">{snapshot.organisationName} — compliance summary</h1>
            <p className="text-sm text-muted-foreground">
              Published {data.published_at ? new Date(data.published_at).toLocaleDateString() : "—"}
            </p>
            {snapshot.intro && <p className="text-sm">{snapshot.intro}</p>}
          </header>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Evidence the provider records</CardTitle>
              <CardDescription>Statuses only — no participant or worker information is published.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {snapshot.items.map((item) => (
                <div key={item.key} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3">
                  <span className="text-sm">{item.label}</span>
                  <StatusPill tone={item.tone}>{item.value}</StatusPill>
                </div>
              ))}
            </CardContent>
          </Card>

          {snapshot.contactEmail && (
            <p className="text-sm">
              Questions or feedback: <a className="underline" href={`mailto:${snapshot.contactEmail}`}>{snapshot.contactEmail}</a>
            </p>
          )}

          <p className="text-xs text-muted-foreground">{snapshot.disclaimer || TRUST_DISCLAIMER}</p>
        </>
      )}
    </main>
  );
}
