import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { MainLayout } from './layout/MainLayout';
import { Loader2 } from 'lucide-react';

type AppRole = 'admin' | 'executive' | 'supervisor' | 'staff' | 'guest' | 'super_admin';

interface ProtectedRouteProps {
  children: ReactNode;
  allowedRoles?: AppRole[];
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user, role, loading, profile, roleLoaded } = useAuth();

  // Wait for both auth and role to be loaded
  if (loading || (user && !roleLoaded)) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // Check if user has required role — super_admin bypasses every route guard
  // (so they can browse any tenant's pages while "viewing as" that tenant).
  if (allowedRoles && role && role !== 'super_admin' && !allowedRoles.includes(role)) {
    return <Navigate to="/dashboard" replace />;
  }

  // Check if user is active - redirect to auth
  if (profile && !profile.is_active) {
    return <Navigate to="/auth" replace />;
  }

  return <MainLayout>{children}</MainLayout>;
}
