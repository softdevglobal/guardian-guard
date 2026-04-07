import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AccessibilityProvider } from "@/contexts/AccessibilityContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "@/components/AppLayout";
import Dashboard from "./pages/Dashboard";
import Incidents from "./pages/Incidents";
import Risks from "./pages/Risks";
import Complaints from "./pages/Complaints";
import Policies from "./pages/Policies";
import Participants from "./pages/Participants";
import StaffCompliance from "./pages/StaffCompliance";
import Training from "./pages/Training";
import AuditLogs from "./pages/AuditLogs";
import Heartbeat from "./pages/Heartbeat";
import Settings from "./pages/Settings";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function ProtectedPage({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute>
      <AppLayout>{children}</AppLayout>
    </ProtectedRoute>
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
              <Route path="/" element={<ProtectedPage><Dashboard /></ProtectedPage>} />
              <Route path="/incidents" element={<ProtectedPage><Incidents /></ProtectedPage>} />
              <Route path="/risks" element={<ProtectedPage><Risks /></ProtectedPage>} />
              <Route path="/complaints" element={<ProtectedPage><Complaints /></ProtectedPage>} />
              <Route path="/policies" element={<ProtectedPage><Policies /></ProtectedPage>} />
              <Route path="/participants" element={<ProtectedPage><Participants /></ProtectedPage>} />
              <Route path="/staff" element={<ProtectedPage><StaffCompliance /></ProtectedPage>} />
              <Route path="/training" element={<ProtectedPage><Training /></ProtectedPage>} />
              <Route path="/audit" element={<ProtectedPage><AuditLogs /></ProtectedPage>} />
              <Route path="/heartbeat" element={<ProtectedPage><Heartbeat /></ProtectedPage>} />
              <Route path="/settings" element={<ProtectedPage><Settings /></ProtectedPage>} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </AccessibilityProvider>
  </QueryClientProvider>
);

export default App;
