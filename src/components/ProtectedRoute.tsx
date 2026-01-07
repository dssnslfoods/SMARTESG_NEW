import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { MainLayout } from './layout/MainLayout';
import { Loader2 } from 'lucide-react';

type AppRole = 'admin' | 'executive' | 'supervisor' | 'staff' | 'guest';

interface ProtectedRouteProps {
  children: ReactNode;
  allowedRoles?: AppRole[];
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user, role, loading, profile } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // Check if user has required role
  if (allowedRoles && role && !allowedRoles.includes(role)) {
    return <Navigate to="/dashboard" replace />;
  }

  // Check if user is active
  if (profile && !profile.is_active) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-destructive">Account Inactive</h1>
          <p className="mt-2 text-muted-foreground">
            Your account has been deactivated. Please contact an administrator.
          </p>
        </div>
      </div>
    );
  }

  // User has no role assigned yet
  if (!role) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground">Pending Approval</h1>
          <p className="mt-2 text-muted-foreground">
            Your account is pending role assignment. Please contact an administrator.
          </p>
        </div>
      </div>
    );
  }

  return <MainLayout>{children}</MainLayout>;
}
