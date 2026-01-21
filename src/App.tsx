import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { ReportSectionsProvider } from "@/contexts/ReportSectionsContext";
import { NotificationsProvider } from "@/contexts/NotificationsContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import UserManagement from "./pages/UserManagement";
import AuditLog from "./pages/AuditLog";
import Reports from "./pages/Reports";
import Scorecard from "./pages/reports/Scorecard";
import Environmental from "./pages/reports/Environmental";
import CompanyManagement from "./pages/master/CompanyManagement";
import SiteManagement from "./pages/master/SiteManagement";
import PeriodManagement from "./pages/master/PeriodManagement";
import DimensionManagement from "./pages/master/DimensionManagement";
import ThemeManagement from "./pages/master/ThemeManagement";
import MetricManagement from "./pages/master/MetricManagement";
import DataEntry from "./pages/DataEntry";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <LanguageProvider>
        <NotificationsProvider>
          <ReportSectionsProvider>
            <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/auth" element={<Auth />} />
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <Dashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/users"
                element={
                  <ProtectedRoute allowedRoles={["admin", "supervisor", "executive", "staff"]}>
                    <UserManagement />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/data-entry"
                element={
                  <ProtectedRoute allowedRoles={["admin", "supervisor", "staff"]}>
                    <DataEntry />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/master/companies"
                element={
                  <ProtectedRoute allowedRoles={["admin", "supervisor"]}>
                    <CompanyManagement />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/master/sites"
                element={
                  <ProtectedRoute allowedRoles={["admin", "supervisor"]}>
                    <SiteManagement />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/master/periods"
                element={
                  <ProtectedRoute allowedRoles={["admin", "supervisor"]}>
                    <PeriodManagement />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/master/dimensions"
                element={
                  <ProtectedRoute allowedRoles={["admin", "supervisor"]}>
                    <DimensionManagement />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/master/themes"
                element={
                  <ProtectedRoute allowedRoles={["admin", "supervisor"]}>
                    <ThemeManagement />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/master/metrics"
                element={
                  <ProtectedRoute allowedRoles={["admin", "supervisor"]}>
                    <MetricManagement />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/reports"
                element={
                  <ProtectedRoute allowedRoles={["admin", "executive"]}>
                    <Reports />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/reports/scorecard"
                element={
                  <ProtectedRoute allowedRoles={["admin", "executive"]}>
                    <Scorecard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/reports/environmental"
                element={
                  <ProtectedRoute allowedRoles={["admin", "executive"]}>
                    <Environmental />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/audit-log"
                element={
                  <ProtectedRoute allowedRoles={["admin"]}>
                    <AuditLog />
                  </ProtectedRoute>
                }
              />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
            </TooltipProvider>
          </ReportSectionsProvider>
        </NotificationsProvider>
      </LanguageProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
