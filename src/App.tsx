import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AccessibilityProvider } from "@/contexts/AccessibilityContext";
import { AuthProvider } from "@/contexts/AuthContext";
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
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

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
              <Route
                path="/"
                element={
                  <AppLayout>
                    <Dashboard />
                  </AppLayout>
                }
              />
              <Route path="/incidents" element={<AppLayout><Incidents /></AppLayout>} />
              <Route path="/risks" element={<AppLayout><Risks /></AppLayout>} />
              <Route path="/complaints" element={<AppLayout><Complaints /></AppLayout>} />
              <Route path="/policies" element={<AppLayout><Policies /></AppLayout>} />
              <Route path="/participants" element={<AppLayout><Participants /></AppLayout>} />
              <Route path="/staff" element={<AppLayout><StaffCompliance /></AppLayout>} />
              <Route path="/training" element={<AppLayout><Training /></AppLayout>} />
              <Route path="/audit" element={<AppLayout><AuditLogs /></AppLayout>} />
              <Route path="/heartbeat" element={<AppLayout><Heartbeat /></AppLayout>} />
              <Route path="/settings" element={<AppLayout><Settings /></AppLayout>} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </AccessibilityProvider>
  </QueryClientProvider>
);

export default App;
