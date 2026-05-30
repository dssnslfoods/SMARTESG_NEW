import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './AuthContext';

// ─── Types ────────────────────────────────────────────────────────────────────
// permMap[menuKey][role] = is_active
type PermMap = Record<string, Record<string, boolean>>;
// allowMap[menuKey] = is_allowed (tenant-level allowlist set by super_admin)
type AllowMap = Record<string, boolean>;

interface MenuPermissionsContextType {
  /** True if the current user's role should see this menu item. */
  canSeeMenu: (menuKey: string) => boolean;
  /** Full role × menu permission map — used by the per-tenant menu UI. */
  allPermissions: PermMap;
  /** Tenant-level allowlist (from super_admin). */
  tenantAllowlist: AllowMap;
  loading: boolean;
  /** Re-fetch from DB. */
  refresh: () => Promise<void>;
}

const MenuPermissionsContext = createContext<MenuPermissionsContextType | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────
export function MenuPermissionsProvider({ children }: { children: ReactNode }) {
  const { role, user } = useAuth();
  const [permMap, setPermMap] = useState<PermMap>({});
  const [allowMap, setAllowMap] = useState<AllowMap>({});
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);

  const fetchPermissions = useCallback(async () => {
    setLoading(true);
    try {
      // Both queries in parallel — they read different tables.
      const [permRes, allowRes] = await Promise.all([
        supabase.from('menu_permission').select('menu_key, role, is_active'),
        supabase.from('tenant_menu_allowlist').select('menu_key, is_allowed'),
      ]);

      if (permRes.error) throw permRes.error;

      const pMap: PermMap = {};
      (permRes.data ?? []).forEach((row: any) => {
        if (!pMap[row.menu_key]) pMap[row.menu_key] = {};
        pMap[row.menu_key][row.role] = row.is_active;
      });
      setPermMap(pMap);

      const aMap: AllowMap = {};
      (allowRes.data ?? []).forEach((row: any) => {
        aMap[row.menu_key] = row.is_allowed;
      });
      setAllowMap(aMap);
    } catch (e) {
      console.error('MenuPermissions fetch error:', e);
    } finally {
      // Mark loaded deterministically (even on error) so menu visibility is
      // resolved from the DB result — never left hanging on a code default.
      setLoaded(true);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) {
      fetchPermissions();
    } else {
      // Reset on logout
      setPermMap({});
      setAllowMap({});
      setLoaded(false);
    }
  }, [user, fetchPermissions]);

  const canSeeMenu = useCallback(
    (menuKey: string): boolean => {
      // 1. Super admin → always sees everything (bypass both tiers)
      if (role === 'super_admin') return true;
      if (!role) return false;

      // 2. Tier-1 check: tenant-level allowlist set by super_admin.
      //    Missing row defaults to allowed=true (new tenants get everything).
      if (loaded && allowMap[menuKey] === false) return false;

      // 3. Admin within tenant is the configurator → sees every tenant-allowed menu.
      if (role === 'admin') return true;

      // 4. Non-admin roles: visibility is decided SOLELY by what the tenant
      //    admin configured in the Menu Permissions page (menu_permission table).
      //    No hardcoded defaults are ever consulted for the decision — a missing
      //    or false entry means "not granted". Before the DB result is in
      //    (loaded === false) we deny by default rather than assume from code.
      if (!loaded) return false;
      return permMap[menuKey]?.[role] ?? false;
    },
    [role, permMap, allowMap, loaded],
  );

  return (
    <MenuPermissionsContext.Provider
      value={{
        canSeeMenu,
        allPermissions: permMap,
        tenantAllowlist: allowMap,
        loading,
        refresh: fetchPermissions,
      }}
    >
      {children}
    </MenuPermissionsContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useMenuPermissions() {
  const ctx = useContext(MenuPermissionsContext);
  if (!ctx) throw new Error('useMenuPermissions must be used within MenuPermissionsProvider');
  return ctx;
}
