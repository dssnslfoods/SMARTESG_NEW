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
import { DEFAULT_PERMISSIONS, type AppRole } from '@/lib/menuConfig';

// ─── Types ────────────────────────────────────────────────────────────────────
// permMap[menuKey][role] = is_active
type PermMap = Record<string, Record<string, boolean>>;

interface MenuPermissionsContextType {
  /** Returns true if the current user's role should see this menu item. */
  canSeeMenu: (menuKey: string) => boolean;
  /** Full permission map — used by the management page. */
  allPermissions: PermMap;
  loading: boolean;
  /** Re-fetch from DB (called after management page saves). */
  refresh: () => Promise<void>;
}

const MenuPermissionsContext = createContext<MenuPermissionsContextType | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────
export function MenuPermissionsProvider({ children }: { children: ReactNode }) {
  const { role, user } = useAuth();
  const [permMap, setPermMap] = useState<PermMap>({});
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);

  const fetchPermissions = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('menu_permission')
        .select('menu_key, role, is_active');

      if (error) throw error;

      const map: PermMap = {};
      (data ?? []).forEach((row: any) => {
        if (!map[row.menu_key]) map[row.menu_key] = {};
        map[row.menu_key][row.role] = row.is_active;
      });
      setPermMap(map);
      setLoaded(true);
    } catch (e) {
      console.error('MenuPermissions fetch error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) {
      fetchPermissions();
    } else {
      // Reset on logout
      setPermMap({});
      setLoaded(false);
    }
  }, [user, fetchPermissions]);

  const canSeeMenu = useCallback(
    (menuKey: string): boolean => {
      // Admin always sees everything
      if (role === 'admin') return true;
      if (!role) return false;

      if (loaded) {
        const roleMap = permMap[menuKey];
        if (roleMap !== undefined) {
          return roleMap[role] ?? false;
        }
        // Key not in DB yet — fall back to default
      }

      // Fallback (also used while loading to avoid flash)
      return (DEFAULT_PERMISSIONS[menuKey] ?? []).includes(role as AppRole);
    },
    [role, permMap, loaded],
  );

  return (
    <MenuPermissionsContext.Provider
      value={{ canSeeMenu, allPermissions: permMap, loading, refresh: fetchPermissions }}
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
