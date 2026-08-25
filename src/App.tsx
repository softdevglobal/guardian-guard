import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AccessibilityProvider } from "@/contexts/AccessibilityContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { PlatformRoute } from "@/components/PlatformRoute";
import { OnboardingGate } from "@/components/OnboardingGate";
import { ModuleGate } from "@/components/ModuleGate";
import { AppLayout } from "@/components/AppLayout";
import PlatformDashboard from "./pages/platform/PlatformDashboard";
import PlatformClients from "./pages/platform/Clients";
import NewClient from "./pages/platform/NewClient";
import ClientDetail from "./pages/platform/ClientDetail";
import PlatformPackages from "./pages/platform/Packages";
import OnboardingReviews from "./pages/platform/OnboardingReviews";
import PlatformActivity from "./pages/platform/Activity";
import PlatformIncome from "./pages/platform/Income";
import ServiceConfig from "./pages/platform/ServiceConfig";
import Onboarding from "./pages/Onboarding";

import Dashboard from "./pages/Dashboard";
import Incidents from "./pages/Incidents";
import Risks from "./pages/Risks";
import Complaints from "./pages/Complaints";
import Policies from "./pages/Policies";
import Participants from "./pages/Participants";
import StaffCompliance from "./pages/StaffCompliance";
import StaffEnrollment from "./pages/StaffEnrollment";
import Training from "./pages/Training";
import AuditLogs from "./pages/AuditLogs";
import Heartbeat from "./pages/Heartbeat";
import Settings from "./pages/Settings";
import Safeguarding from "./pages/Safeguarding";
import Privacy from "./pages/Privacy";
import Notifications from "./pages/Notifications";
import ControlsMatrix from "./pages/ControlsMatrix";
import EvidenceMatrix from "./pages/EvidenceMatrix";
import CompetencyVault from "./pages/CompetencyVault";
import EvidenceRoom from "./pages/EvidenceRoom";
import ParticipantCare from "./pages/ParticipantCare";
import Medication from "./pages/Medication";
import SafeEnvironment from "./pages/SafeEnvironment";
import SIL from "./pages/SIL";
import RestrictivePractices from "./pages/RestrictivePractices";
import Governance from "./pages/Governance";
import CorrectiveActions from "./pages/CorrectiveActions";
import Registration from "./pages/Registration";
import ComplianceCalendar from "./pages/ComplianceCalendar";
import TrustPortal from "./pages/TrustPortal";
import PublicTrust from "./pages/PublicTrust";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";


const queryClient = new QueryClient();

function ProtectedPage({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute>
      <OnboardingGate>
        <AppLayout>
          <ModuleGate>{children}</ModuleGate>
        </AppLayout>
      </OnboardingGate>
    </ProtectedRoute>
  );
}

function PlatformPage({ children }: { children: React.ReactNode }) {
  return (
    <PlatformRoute>
      <AppLayout>{children}</AppLayout>
    </PlatformRoute>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AccessibilityProvider>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <a href="#main-content" className="skip-link">Skip to main content</a>
            <Routes>
              <Route path="/auth" element={<Auth />} />
              <Route path="/trust/:slug" element={<PublicTrust />} />

              <Route path="/platform/dashboard" element={<PlatformPage><PlatformDashboard /></PlatformPage>} />
              <Route path="/platform/clients" element={<PlatformPage><PlatformClients /></PlatformPage>} />
              <Route path="/platform/clients/new" element={<PlatformPage><NewClient /></PlatformPage>} />
              <Route path="/platform/clients/:id" element={<PlatformPage><ClientDetail /></PlatformPage>} />
              <Route path="/platform/packages" element={<PlatformPage><PlatformPackages /></PlatformPage>} />
              <Route path="/platform/onboarding-reviews" element={<PlatformPage><OnboardingReviews /></PlatformPage>} />
              <Route path="/platform/activity" element={<PlatformPage><PlatformActivity /></PlatformPage>} />
              <Route path="/platform/service-config" element={<PlatformPage><ServiceConfig /></PlatformPage>} />
              <Route path="/platform/income" element={<PlatformPage><PlatformIncome /></PlatformPage>} />
              <Route path="/onboarding" element={<ProtectedRoute><AppLayout><Onboarding /></AppLayout></ProtectedRoute>} />
              <Route path="/" element={<ProtectedPage><Dashboard /></ProtectedPage>} />

              <Route path="/incidents" element={<ProtectedPage><Incidents /></ProtectedPage>} />
              <Route path="/risks" element={<ProtectedPage><Risks /></ProtectedPage>} />
              <Route path="/complaints" element={<ProtectedPage><Complaints /></ProtectedPage>} />
              <Route path="/policies" element={<ProtectedPage><Policies /></ProtectedPage>} />
              <Route path="/participants" element={<ProtectedPage><Participants /></ProtectedPage>} />
              <Route path="/staff" element={<ProtectedPage><StaffCompliance /></ProtectedPage>} />
              <Route path="/staff-enrollment" element={<ProtectedPage><StaffEnrollment /></ProtectedPage>} />
              <Route path="/training" element={<ProtectedPage><Training /></ProtectedPage>} />
              <Route path="/audit" element={<ProtectedPage><AuditLogs /></ProtectedPage>} />
              <Route path="/heartbeat" element={<ProtectedPage><Heartbeat /></ProtectedPage>} />
              <Route path="/safeguarding" element={<ProtectedPage><Safeguarding /></ProtectedPage>} />
              <Route path="/privacy" element={<ProtectedPage><Privacy /></ProtectedPage>} />
              <Route path="/notifications" element={<ProtectedPage><Notifications /></ProtectedPage>} />
              <Route path="/settings" element={<ProtectedPage><Settings /></ProtectedPage>} />
              <Route path="/controls" element={<ProtectedPage><ControlsMatrix /></ProtectedPage>} />
              <Route path="/evidence-matrix" element={<ProtectedPage><EvidenceMatrix /></ProtectedPage>} />

              <Route path="/competency-vault" element={<ProtectedPage><CompetencyVault /></ProtectedPage>} />
              <Route path="/participant-care" element={<ProtectedPage><ParticipantCare /></ProtectedPage>} />
              <Route path="/medication" element={<ProtectedPage><Medication /></ProtectedPage>} />
              <Route path="/safe-environment" element={<ProtectedPage><SafeEnvironment /></ProtectedPage>} />
              <Route path="/sil" element={<ProtectedPage><SIL /></ProtectedPage>} />
              <Route path="/restrictive-practices" element={<ProtectedPage><RestrictivePractices /></ProtectedPage>} />
              <Route path="/governance" element={<ProtectedPage><Governance /></ProtectedPage>} />
              <Route path="/evidence-room" element={<ProtectedPage><EvidenceRoom /></ProtectedPage>} />
              <Route path="/registration" element={<ProtectedPage><Registration /></ProtectedPage>} />
              <Route path="/corrective-actions" element={<ProtectedPage><CorrectiveActions /></ProtectedPage>} />
              <Route path="/calendar" element={<ProtectedPage><ComplianceCalendar /></ProtectedPage>} />
              <Route path="/trust-portal" element={<ProtectedPage><TrustPortal /></ProtectedPage>} />








              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </AccessibilityProvider>
  </QueryClientProvider>
);

export default App;
