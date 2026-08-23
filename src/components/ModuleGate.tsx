import { useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { AccessRestricted, LoadingState } from "@/components/compliance/GateUI";
import { isServiceGated, moduleForPath } from "@/lib/moduleAccess";

/**
 * Blocks direct-URL access to modules the person's role or the organisation's
 * confirmed services do not cover. The URL is preserved and an explanatory
 * message is shown — content is never silently swapped.
 */
export function ModuleGate({ children }: { children: React.ReactNode }) {
  const { hasModule, isLoading, user, orgModules } = useAuth();
  const location = useLocation();
  const module = moduleForPath(location.pathname);

  if (isLoading) return <div className="p-6"><LoadingState rows={5} /></div>;
  if (!module) return <>{children}</>;
  // Wait for the activation set before judging a service-gated module.
  if (isServiceGated(module) && user?.organisation_id && orgModules === null) {
    return <div className="p-6"><LoadingState rows={5} /></div>;
  }
  if (hasModule(module)) return <>{children}</>;

  return (
    <div className="p-6">
      <AccessRestricted
        title="This module is not available"
        description="Your role, or the services your organisation has confirmed in onboarding, do not include this area. Update your service selections in Get set up, or ask an administrator to review your role."
      />
    </div>
  );
}
