import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { EmptyState } from "@/components/compliance/GateUI";

/** Platform console guard — only the SaaS owner role may enter /platform. */
export function PlatformRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, hasRole } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }
  if (!isAuthenticated) return <Navigate to="/auth" replace />;
  if (!hasRole("platform_super_admin")) {
    return (
      <div className="p-6">
        <EmptyState
          title="Platform console is restricted"
          description="Only the Guardian Guard platform owner can view cross-tenant data. If you administer a provider organisation, use your own dashboard instead."
        />
      </div>
    );
  }
  return <>{children}</>;
}
