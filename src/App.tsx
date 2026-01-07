import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import UserManagement from "./pages/UserManagement";
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
    <LanguageProvider>
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
                <ProtectedRoute allowedRoles={["admin"]}>
                  <UserManagement />
                </ProtectedRoute>
              }
            />
            <Route
              path="/data-entry"
              element={
                <ProtectedRoute allowedRoles={["admin", "supervisor"]}>
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
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </LanguageProvider>
  </QueryClientProvider>
);

export default App;
