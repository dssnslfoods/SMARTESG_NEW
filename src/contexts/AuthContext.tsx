import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type AppRole = 'admin' | 'executive' | 'supervisor' | 'staff' | 'guest' | 'super_admin';

interface UserProfile {
  user_id: string;
  full_name: string | null;
  company_id: string | null;
  site_id: string | null;
  is_active: boolean;
  must_change_password?: boolean;
  company_name?: string | null;
  site_name?: string | null;
  site_location?: string | null;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  role: AppRole | null;
  isSuperAdmin: boolean;
  loading: boolean;
  roleLoaded: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null; inactive?: boolean }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  hasRole: (role: AppRole) => boolean;
  canAccess: (allowedRoles: AppRole[]) => boolean;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [roleLoaded, setRoleLoaded] = useState(false);

  const fetchUserData = async (userId: string): Promise<{ hasRole: boolean; isActive: boolean }> => {
    try {
      setRoleLoaded(false);
      
      // Fetch profile with company and site details
      const { data: profileData } = await supabase
        .from('app_user_profile')
        .select(`
          *,
          company:company_id(company_name),
          site:site_id(site_name, location)
        `)
        .eq('user_id', userId)
        .maybeSingle();

      if (profileData) {
        const enhancedProfile: UserProfile = {
          user_id: profileData.user_id,
          full_name: profileData.full_name,
          company_id: profileData.company_id,
          site_id: profileData.site_id,
          is_active: profileData.is_active,
          must_change_password: (profileData as any).must_change_password ?? false,
          company_name: (profileData.company as any)?.company_name ?? null,
          site_name: (profileData.site as any)?.site_name ?? null,
          site_location: (profileData.site as any)?.location ?? null,
        };
        setProfile(enhancedProfile);
      }

      // Fetch role
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .maybeSingle();

      // Super admin = either role='super_admin' OR an entry in super_admin
      // table (legacy / audit). Querying both keeps backward compat.
      const isSuperViaRole = roleData?.role === 'super_admin';
      let isSuperViaTable = false;
      if (!isSuperViaRole) {
        const { data: superAdminRow } = await supabase
          .from('super_admin')
          .select('user_id')
          .eq('user_id', userId)
          .maybeSingle();
        isSuperViaTable = !!superAdminRow;
      }
      setIsSuperAdmin(isSuperViaRole || isSuperViaTable);

      if (roleData) {
        setRole(roleData.role as AppRole);
        setRoleLoaded(true);
        return { hasRole: true, isActive: profileData?.is_active ?? true };
      }

      setRoleLoaded(true);
      return { hasRole: false, isActive: profileData?.is_active ?? true };
    } catch (error) {
      console.error('Error fetching user data:', error);
      setRoleLoaded(true);
      return { hasRole: false, isActive: true };
    }
  };

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (!session?.user) {
          setProfile(null);
          setRole(null);
          setRoleLoaded(true);
        }
        setLoading(false);
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        await fetchUserData(session.user.id);
      } else {
        setRoleLoaded(true);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string): Promise<{ error: Error | null; inactive?: boolean }> => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    if (error) {
      return { error: error as Error };
    }
    
    // Check if user is active
    if (data.user) {
      const { isActive } = await fetchUserData(data.user.id);
      
      if (!isActive) {
        await supabase.auth.signOut();
        setUser(null);
        setSession(null);
        setProfile(null);
        setRole(null);
        return { error: null, inactive: true };
      }
    }
    
    return { error: null };
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: fullName,
        },
      },
    });
    return { error: error as Error | null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    setRole(null);
    setIsSuperAdmin(false);
  };

  const hasRole = (checkRole: AppRole) => role === checkRole;

  const canAccess = (allowedRoles: AppRole[]) => {
    if (!role) return false;
    // super_admin bypasses every route guard
    if (role === 'super_admin') return true;
    return allowedRoles.includes(role);
  };

  const refreshProfile = async () => {
    if (user?.id) {
      await fetchUserData(user.id);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        role,
        isSuperAdmin,
        loading,
        roleLoaded,
        signIn,
        signUp,
        signOut,
        hasRole,
        canAccess,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
