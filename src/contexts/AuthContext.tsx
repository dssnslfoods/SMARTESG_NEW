import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type AppRole = 'admin' | 'executive' | 'supervisor' | 'staff' | 'guest' | 'super_admin';

interface UserProfile {
  user_id: string;
  tenant_id: string | null;
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

// ── Session-storage cache helpers ────────────────────────────────────────────
// Cache profile + role in sessionStorage so page refreshes skip the 3-query
// round-trip.  The cache is keyed by user ID and auto-invalidated on sign-out.
// TTL: 30 minutes (JWT refresh happens every 60 min; 30 min is safe).
const PROFILE_CACHE_TTL_MS = 30 * 60 * 1000;

interface ProfileCache {
  userId: string;
  profile: UserProfile;
  role: AppRole;
  isSuperAdmin: boolean;
  cachedAt: number;
}

function readProfileCache(userId: string): ProfileCache | null {
  try {
    const raw = sessionStorage.getItem(`auth_cache_${userId}`);
    if (!raw) return null;
    const parsed: ProfileCache = JSON.parse(raw);
    if (Date.now() - parsed.cachedAt > PROFILE_CACHE_TTL_MS) {
      sessionStorage.removeItem(`auth_cache_${userId}`);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeProfileCache(data: ProfileCache) {
  try {
    sessionStorage.setItem(`auth_cache_${data.userId}`, JSON.stringify(data));
  } catch {
    // sessionStorage not available (private mode, quota exceeded) — ignore
  }
}

function clearProfileCache(userId?: string) {
  try {
    if (userId) {
      sessionStorage.removeItem(`auth_cache_${userId}`);
    } else {
      // clear all auth_cache_* keys
      Object.keys(sessionStorage)
        .filter(k => k.startsWith('auth_cache_'))
        .forEach(k => sessionStorage.removeItem(k));
    }
  } catch {
    // ignore
  }
}
// ─────────────────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [roleLoaded, setRoleLoaded] = useState(false);

  const fetchUserData = async (
    userId: string,
    opts: { skipCache?: boolean } = {}
  ): Promise<{ hasRole: boolean; isActive: boolean }> => {
    try {
      setRoleLoaded(false);

      // ── Fast path: serve from sessionStorage on page refresh ──────────────
      if (!opts.skipCache) {
        const cached = readProfileCache(userId);
        if (cached) {
          setProfile(cached.profile);
          setRole(cached.role);
          setIsSuperAdmin(cached.isSuperAdmin);
          setRoleLoaded(true);
          return { hasRole: true, isActive: cached.profile.is_active };
        }
      }

      // ── Slow path: fetch from Supabase (3 queries in parallel) ────────────
      // Run all 3 lookups in parallel — login latency cut ~3x (was serial)
      const [profileRes, roleRes, superAdminRes] = await Promise.all([
        supabase
          .from('app_user_profile')
          .select(`
            *,
            company:company_id(company_name),
            site:site_id(site_name, location)
          `)
          .eq('user_id', userId)
          .maybeSingle(),
        supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', userId)
          .maybeSingle(),
        supabase
          .from('super_admin')
          .select('user_id')
          .eq('user_id', userId)
          .maybeSingle(),
      ]);

      const profileData = profileRes.data;
      const roleData = roleRes.data;
      const superAdminRow = superAdminRes.data;

      let enhancedProfile: UserProfile | null = null;

      if (profileData) {
        enhancedProfile = {
          user_id: profileData.user_id,
          tenant_id: (profileData as any).tenant_id ?? null,
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

      // Super admin = either role='super_admin' OR an entry in super_admin
      // table (legacy / audit). Both sources checked in the parallel batch.
      const superAdminFlag = roleData?.role === 'super_admin' || !!superAdminRow;
      setIsSuperAdmin(superAdminFlag);

      if (roleData) {
        const appRole = roleData.role as AppRole;
        setRole(appRole);
        setRoleLoaded(true);

        // ── Persist to sessionStorage for next page refresh ─────────────────
        if (enhancedProfile) {
          writeProfileCache({
            userId,
            profile: enhancedProfile,
            role: appRole,
            isSuperAdmin: superAdminFlag,
            cachedAt: Date.now(),
          });
        }

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
    
    // Check if user is active — always bypass cache on explicit sign-in
    if (data.user) {
      const { isActive } = await fetchUserData(data.user.id, { skipCache: true });

      if (!isActive) {
        clearProfileCache(data.user.id);
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
    // Clear sessionStorage profile cache before signing out
    if (user?.id) clearProfileCache(user.id);
    else clearProfileCache(); // belt-and-suspenders: clear all
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
      // Always fetch fresh data and overwrite cache
      await fetchUserData(user.id, { skipCache: true });
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
