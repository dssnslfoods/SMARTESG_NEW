import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { ReportSectionsProvider } from "@/contexts/ReportSectionsContext";
import { NotificationsProvider } from "@/contexts/NotificationsContext";
import { TVModeProvider } from "@/contexts/TVModeContext";
import { MenuPermissionsProvider } from "@/contexts/MenuPermissionsContext";
import { BrandingProvider } from "@/contexts/BrandingContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import PasswordChangeRequired from "@/components/PasswordChangeRequired";

// Auth pages — eagerly imported (small + always needed before user is logged in)
import Auth from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";
import NotFound from "./pages/NotFound";

// All other pages — lazy-loaded so the initial bundle stays small
// and each route only downloads its own chunk on first visit.
const Dashboard           = lazy(() => import("./pages/Dashboard"));
const ESGKeyIssues        = lazy(() => import("./pages/ESGKeyIssues"));
const DataEntry           = lazy(() => import("./pages/DataEntry"));
const UserManagement      = lazy(() => import("./pages/UserManagement"));
const AuditLog            = lazy(() => import("./pages/AuditLog"));
const Reports             = lazy(() => import("./pages/Reports"));
const Environmental       = lazy(() => import("./pages/reports/Environmental"));
const Governance          = lazy(() => import("./pages/reports/Governance"));
const Social              = lazy(() => import("./pages/reports/Social"));
const ESGOverview         = lazy(() => import("./pages/reports/ESGOverview"));
const CompanyManagement   = lazy(() => import("./pages/master/CompanyManagement"));
const SiteManagement      = lazy(() => import("./pages/master/SiteManagement"));
const PeriodManagement    = lazy(() => import("./pages/master/PeriodManagement"));
const DimensionManagement = lazy(() => import("./pages/master/DimensionManagement"));
const ThemeManagement     = lazy(() => import("./pages/master/ThemeManagement"));
const MetricManagement    = lazy(() => import("./pages/master/MetricManagement"));
const SystemSettings      = lazy(() => import("./pages/master/SystemSettings"));
const TargetManagement    = lazy(() => import("./pages/master/TargetManagement"));
const MenuPermission      = lazy(() => import("./pages/master/MenuPermission"));
const TenantManagement    = lazy(() => import("./pages/super/TenantManagement"));
const TenantMenuAccess    = lazy(() => import("./pages/super/TenantMenuAccess"));
const BackupData          = lazy(() => import("./pages/BackupData"));
const HelpCenter          = lazy(() => import("./pages/HelpCenter"));

const RouteFallback = () => (
  <div className="flex items-center justify-center min-h-[40vh]">
    <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
  </div>
);

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <BrandingProvider>
      <MenuPermissionsProvider>
      <LanguageProvider>
        <TVModeProvider>
          <NotificationsProvider>
            <ReportSectionsProvider>
              <TooltipProvider>
            <Toaster />
            <Sonner />
            <PasswordChangeRequired />
            <BrowserRouter>
            <Suspense fallback={<RouteFallback />}>
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <Dashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/esg-key-issues"
                element={
                  <ProtectedRoute allowedRoles={["admin", "supervisor", "executive", "staff", "guest"]}>
                    <ESGKeyIssues />
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
                path="/master/targets"
                element={
                  <ProtectedRoute allowedRoles={["admin", "supervisor", "executive", "staff"]}>
                    <TargetManagement />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/master/menu-permissions"
                element={
                  <ProtectedRoute allowedRoles={["admin"]}>
                    <MenuPermission />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/super-admin/tenants"
                element={
                  <ProtectedRoute>
                    <TenantManagement />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/super-admin/tenant-menu-access"
                element={
                  <ProtectedRoute>
                    <TenantMenuAccess />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/master/settings"
                element={
                  <ProtectedRoute allowedRoles={["admin"]}>
                    <SystemSettings />
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
                path="/reports/environmental"
                element={
                  <ProtectedRoute allowedRoles={["admin", "executive"]}>
                    <Environmental />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/reports/social"
                element={
                  <ProtectedRoute allowedRoles={["admin", "executive"]}>
                    <Social />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/reports/governance"
                element={
                  <ProtectedRoute allowedRoles={["admin", "executive"]}>
                    <Governance />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/reports/esg-overview"
                element={
                  <ProtectedRoute allowedRoles={["admin", "executive"]}>
                    <ESGOverview />
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
              <Route
                path="/backup-data"
                element={
                  <ProtectedRoute allowedRoles={["admin"]}>
                    <BackupData />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/help-center"
                element={
                  <ProtectedRoute allowedRoles={["admin", "supervisor"]}>
                    <HelpCenter />
                  </ProtectedRoute>
                }
              />
              <Route path="*" element={<NotFound />} />
            </Routes>
            </Suspense>
            </BrowserRouter>
              </TooltipProvider>
            </ReportSectionsProvider>
          </NotificationsProvider>
        </TVModeProvider>
      </LanguageProvider>
      </MenuPermissionsProvider>
      </BrandingProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
